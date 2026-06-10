import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

// Naptár-ikon a felső sávban. Kattintásra a kísérő GTK4+WebKit ablakot indítja.
// (Webview a shell processzbe nem ágyazható -> külön GJS processz, lásd calendar-window.js.)
const CalendarButton = GObject.registerClass(
class CalendarButton extends PanelMenu.Button {
    _init(extension) {
        // dontCreateMenu = true -> nincs legördülő, a kattintás közvetlen művelet
        super._init(0.0, 'Outlook Calendar', true);
        this._extension = extension;

        this.add_child(new St.Icon({
            icon_name: 'x-office-calendar-symbolic',
            style_class: 'system-status-icon',
        }));

        this.connect('button-press-event', () => {
            this._openWindow();
            return Clutter.EVENT_STOP;
        });
    }

    _openWindow() {
        const script = GLib.build_filenamev([this._extension.path, 'calendar-window.js']);
        const gjs = GLib.find_program_in_path('gjs') || 'gjs';
        try {
            Gio.Subprocess.new([gjs, '-m', script], Gio.SubprocessFlags.NONE);
        } catch (e) {
            logError(e, 'OutlookCalendar: a naptár-ablak indítása sikertelen');
        }
    }
});

export default class OutlookCalendarExtension extends Extension {
    enable() {
        this._indicator = new CalendarButton(this);
        // A jobb oldali (rendszer) területre, elöl.
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
