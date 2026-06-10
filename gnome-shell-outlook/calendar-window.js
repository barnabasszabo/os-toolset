// Önálló GTK4 + WebKitGTK ablak az Outlook naptárhoz.
// Az extension indítja: `gjs -m calendar-window.js`.
// Single-instance (Adw.Application app-id) -> újbóli indítás a meglévő ablakot hozza előtérbe.
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import WebKit from 'gi://WebKit?version=6.0';

import * as Config from './config.js';

const SCRIPT_DIR = GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]);

// A GSettings sémát az extension saját schemas/ könyvtárából töltjük (nem kell rendszerszintű telepítés).
function getSettings() {
    const schemaDir = GLib.build_filenamev([SCRIPT_DIR, 'schemas']);
    const source = Gio.SettingsSchemaSource.new_from_directory(
        schemaDir, Gio.SettingsSchemaSource.get_default(), false);
    const schema = source.lookup(Config.SCHEMA_ID, true);
    if (!schema)
        throw new Error(`Nincs lefordított séma itt: ${schemaDir} (futtasd az install.sh-t)`);
    return new Gio.Settings({settings_schema: schema});
}

// Perzisztens WebKit munkamenet, hogy a Microsoft-bejelentkezés megmaradjon.
function makeWebView() {
    const dataDir = GLib.build_filenamev([GLib.get_user_data_dir(), 'outlook-calendar']);
    GLib.mkdir_with_parents(dataDir, 0o700);

    const netSession = WebKit.NetworkSession.new(
        GLib.build_filenamev([dataDir, 'data']),
        GLib.build_filenamev([dataDir, 'cache']));
    netSession.get_cookie_manager().set_persistent_storage(
        GLib.build_filenamev([dataDir, 'cookies.sqlite']),
        WebKit.CookiePersistentStorage.SQLITE);

    const webview = new WebKit.WebView({
        network_session: netSession,
        vexpand: true,
        hexpand: true,
    });
    webview.get_settings().set_user_agent(Config.USER_AGENT);
    webview.load_uri(Config.CALENDAR_URL);
    return webview;
}

function buildWindow(app) {
    const settings = getSettings();
    const webview = makeWebView();

    const win = new Adw.ApplicationWindow({
        application: app,
        title: Config.WINDOW_TITLE,
    });
    win.set_default_size(
        settings.get_int('window-width') || Config.DEFAULT_WIDTH,
        settings.get_int('window-height') || Config.DEFAULT_HEIGHT);
    if (settings.get_boolean('window-maximized'))
        win.maximize();

    const header = new Adw.HeaderBar();
    const reload = new Gtk.Button({
        icon_name: 'view-refresh-symbolic',
        tooltip_text: 'Újratöltés',
    });
    reload.connect('clicked', () => webview.reload());
    header.pack_start(reload);

    const toolbar = new Adw.ToolbarView();
    toolbar.add_top_bar(header);
    toolbar.set_content(webview);
    win.set_content(toolbar);

    // Méret megőrzése bezáráskor.
    win.connect('close-request', () => {
        settings.set_boolean('window-maximized', win.maximized);
        if (!win.maximized) {
            settings.set_int('window-width', win.get_width());
            settings.set_int('window-height', win.get_height());
        }
        return false; // engedjük a bezárást
    });

    return win;
}

const app = new Adw.Application({
    application_id: Config.APP_ID,
    flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
});

app.connect('activate', () => {
    let win = app.get_active_window();
    if (!win)
        win = buildWindow(app);
    win.present();
});

app.run([]);
