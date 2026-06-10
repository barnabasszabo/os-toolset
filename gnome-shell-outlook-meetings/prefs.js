import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class OutlookMeetingsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Általános',
            icon_name: 'preferences-system-symbolic',
        });

        // --- Frissítés ---
        const refreshGroup = new Adw.PreferencesGroup({
            title: 'Frissítés',
            description: 'A naptár lekérdezésének gyakorisága és időablaka.',
        });

        const refreshRow = new Adw.SpinRow({
            title: 'Frissítési időköz',
            subtitle: 'percben',
            adjustment: new Gtk.Adjustment({
                lower: 1, upper: 120, step_increment: 1, page_increment: 5,
                value: settings.get_int('refresh-interval-minutes'),
            }),
        });
        settings.bind('refresh-interval-minutes', refreshRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        refreshGroup.add(refreshRow);

        const daysRow = new Adw.SpinRow({
            title: 'Előretekintés',
            subtitle: 'hány napra előre mutassa a meetingeket',
            adjustment: new Gtk.Adjustment({
                lower: 1, upper: 14, step_increment: 1,
                value: settings.get_int('days-ahead'),
            }),
        });
        settings.bind('days-ahead', daysRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        refreshGroup.add(daysRow);

        page.add(refreshGroup);

        // --- Megjelenés / viselkedés ---
        const behGroup = new Adw.PreferencesGroup({
            title: 'Futó meeting',
            description: 'A panelban a legkorábbi még be nem fejeződött meeting jelenik meg — így a már futó (és emiatt elöl lévő) meetinget látod, nem a következő jövőbelit.',
        });

        const graceRow = new Adw.SpinRow({
            title: 'Késés-kiemelés küszöb',
            subtitle: 'eddig a percig számít „most kezdődött"-nek és kap színes kiemelést',
            adjustment: new Gtk.Adjustment({
                lower: 0, upper: 60, step_increment: 1,
                value: settings.get_int('late-grace-minutes'),
            }),
        });
        settings.bind('late-grace-minutes', graceRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        behGroup.add(graceRow);

        page.add(behGroup);

        // --- Teams ---
        const teamsGroup = new Adw.PreferencesGroup({title: 'Teams'});

        const METHODS = ['pwa', 'edge-app', 'default-browser'];
        const methodRow = new Adw.ComboRow({
            title: 'Teams meeting megnyitása',
            subtitle: 'PWA = helyes háttér + közös tárhely (ajánlott)',
            model: new Gtk.StringList({
                strings: ['Teams PWA', 'Edge app-ablak', 'Alapértelmezett böngésző'],
            }),
        });
        const current = settings.get_string('teams-open-method');
        methodRow.selected = Math.max(0, METHODS.indexOf(current));
        methodRow.connect('notify::selected', row => {
            settings.set_string('teams-open-method', METHODS[row.selected] || 'pwa');
        });
        teamsGroup.add(methodRow);

        page.add(teamsGroup);

        window.add(page);
    }
}
