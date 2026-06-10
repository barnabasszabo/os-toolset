import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Config from './config.js';
import {OAuth} from './oauth.js';
import {getUpcomingMeetings} from './graph.js';

const DAYS_FULL = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
const MONTHS_HU = ['jan', 'feb', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szep', 'okt', 'nov', 'dec'];

function pad(n) {
    return String(n).padStart(2, '0');
}
function fmtTime(d) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}
function dayHeader(d, now) {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    let name;
    if (isSameDay(d, now)) name = 'Ma';
    else if (isSameDay(d, tomorrow)) name = 'Holnap';
    else name = DAYS_FULL[d.getDay()];
    return `${name} · ${MONTHS_HU[d.getMonth()]} ${d.getDate()}.`;
}
function truncate(s, max) {
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// 'late' = épp fut és legfeljebb graceMin perce kezdődött (színes kiemelés, elöl);
// 'running' = fut, de régebben kezdődött; 'upcoming' = még nem kezdődött.
function meetingStatus(m, now, graceMin) {
    const start = m.start.getTime();
    const end = m.end.getTime();
    const t = now.getTime();
    if (start <= t && t <= end) {
        const elapsedMin = (t - start) / 60000;
        return elapsedMin <= graceMin ? 'late' : 'running';
    }
    return 'upcoming';
}

function openUri(uri) {
    if (uri) Gio.AppInfo.launch_default_for_uri(uri, null);
}

// A join-URL host-ját a Teams PWA doménjére írjuk, hogy a PWA scope-ján belül maradjon
// (így a PWA-ban nyílik: helyes háttér-renderelés és közös tárhely).
function toPwaUrl(joinUrl) {
    return joinUrl.replace(/^https:\/\/teams\.microsoft\.com\//i, 'https://teams.cloud.microsoft/');
}

function spawnEdge(argv) {
    Gio.Subprocess.new([Config.EDGE_BIN, `--profile-directory=${Config.EDGE_PROFILE}`, ...argv],
        Gio.SubprocessFlags.NONE);
}

// Teams meeting megnyitása a beállított mód szerint.
//  pwa            -> a PWA-ban (host átírva teams.cloud.microsoft-ra, --app-id)
//  edge-app       -> külön Edge app-ablak a nyers join-URL-lel
//  default-browser-> alapértelmezett böngésző
function joinTeams(joinUrl, method) {
    if (!joinUrl) return;
    try {
        if (method === 'default-browser') {
            openUri(joinUrl);
        } else if (method === 'edge-app') {
            spawnEdge([`--app=${joinUrl}`]);
        } else {
            // 'pwa' (alapértelmezett)
            spawnEdge([`--app-id=${Config.TEAMS_PWA_APPID}`, toPwaUrl(joinUrl)]);
        }
    } catch (e) {
        logError(e, 'OutlookMeetings: Teams indítás sikertelen, fallback böngészőre');
        openUri(joinUrl);
    }
}

const OutlookButton = GObject.registerClass(
class OutlookButton extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Outlook Meetings');
        this._extension = extension;
        this._settings = extension.getSettings();
        this._oauth = new OAuth();
        this._timeoutId = 0;
        this._settingsIds = [];
        this._loginInProgress = false;
        this._headlineJoinUrl = null;

        // Panel tartalom: ikon + felirat + (opcionális) Teams gomb
        const box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        this._icon = new St.Icon({
            icon_name: 'x-office-calendar-symbolic',
            style_class: 'system-status-icon',
        });
        this._label = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'om-panel-label',
        });
        // Panel-szintű Teams gomb (csak ha a kiemelt meetingnek van join-URL-je)
        this._panelJoin = new St.Button({
            label: 'Teams',
            style_class: 'om-panel-join',
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });
        // button-press-event-tel csatlakozunk ÉS megállítjuk az eseményt, hogy ne a menü nyíljon
        this._panelJoin.connect('button-press-event', () => {
            joinTeams(this._headlineJoinUrl, this._settings.get_string('teams-open-method'));
            return Clutter.EVENT_STOP;
        });

        box.add_child(this._icon);
        box.add_child(this._label);
        box.add_child(this._panelJoin);
        this.add_child(box);

        this._setPanel('Outlook', false);

        // Beállítás-változások: időköz -> újraütemezés, többi -> frissítés
        this._settingsIds.push(this._settings.connect('changed::refresh-interval-minutes',
            () => this._scheduleTimer()));
        for (const key of ['days-ahead', 'late-grace-minutes']) {
            this._settingsIds.push(this._settings.connect(`changed::${key}`,
                () => this._refresh()));
        }

        this._refresh();
        this._scheduleTimer();
    }

    _scheduleTimer() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        const minutes = this._settings.get_int('refresh-interval-minutes') || 5;
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, minutes * 60, () => {
                this._refresh();
                return GLib.SOURCE_CONTINUE;
            });
    }

    // `late` igaz -> a panel-felirat is kap egy „késés" színt
    _setPanel(text, late) {
        this._label.text = text ? ` ${text}` : '';
        if (late) this._label.add_style_class_name('om-late-text');
        else this._label.remove_style_class_name('om-late-text');
    }

    _showPanelJoin(joinUrl) {
        this._headlineJoinUrl = joinUrl || null;
        this._panelJoin.visible = !!joinUrl;
    }

    stop() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        for (const id of this._settingsIds) {
            try { this._settings.disconnect(id); } catch (_) {}
        }
        this._settingsIds = [];
    }

    async _refresh() {
        try {
            if (!this._oauth.isAuthenticated()) {
                this._loggedOut();
                return;
            }
            const token = await this._oauth.getAccessToken();
            if (!token) {
                this._loggedOut();
                return;
            }
            const daysAhead = this._settings.get_int('days-ahead') || Config.DAYS_AHEAD;
            const meetings = await getUpcomingMeetings(token, daysAhead);
            this._updatePanel(meetings);
            this._buildMenu(meetings);
        } catch (e) {
            logError(e, 'OutlookMeetings: frissítés hiba');
            this._setPanel('Hiba', false);
            this._showPanelJoin(null);
            this._buildErrorMenu(e.message);
        }
    }

    _loggedOut() {
        this._setPanel('Bejelentkezés', false);
        this._showPanelJoin(null);
        this._buildLoggedOutMenu();
    }

    _updatePanel(meetings) {
        if (!meetings.length) {
            this._setPanel('Nincs meeting', false);
            this._showPanelJoin(null);
            return;
        }
        const now = new Date();
        const grace = this._settings.get_int('late-grace-minutes');
        // A lista kezdés szerint rendezett -> a legkorábbi még nem zárult, nem egész napos
        // meeting a fejléc (futó vagy következő). Egész napos esemény nem foglalja el a panelt.
        const head = meetings.find(m => !m.isAllDay) || meetings[0];
        const status = meetingStatus(head, now, grace);
        const running = status === 'late' || status === 'running';
        const prefix = running ? '▶ ' : '';
        const when = isSameDay(head.start, now)
            ? fmtTime(head.start)
            : `${DAYS_FULL[head.start.getDay()].slice(0, 3)} ${fmtTime(head.start)}`;
        this._setPanel(`${prefix}${when} ${truncate(head.subject, Config.PANEL_SUBJECT_MAXLEN)}`,
            status === 'late');
        this._showPanelJoin(head.joinUrl);
    }

    _clearMenu() {
        this.menu.removeAll();
    }

    _buildLoggedOutMenu() {
        this._clearMenu();
        const item = new PopupMenu.PopupMenuItem('Bejelentkezés a Microsoft 365-be…');
        item.connect('activate', () => this._doLogin());
        this.menu.addMenuItem(item);
        this._addPrefsItem();
    }

    _buildErrorMenu(message) {
        this._clearMenu();
        const info = new PopupMenu.PopupMenuItem(`Hiba: ${truncate(message || '', 60)}`);
        info.setSensitive(false);
        this.menu.addMenuItem(info);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const retry = new PopupMenu.PopupMenuItem('Újrapróbálás');
        retry.connect('activate', () => this._refresh());
        this.menu.addMenuItem(retry);
        const relog = new PopupMenu.PopupMenuItem('Újbóli bejelentkezés');
        relog.connect('activate', () => this._doLogin());
        this.menu.addMenuItem(relog);
        this._addPrefsItem();
    }

    _buildMenu(meetings) {
        this._clearMenu();

        if (!meetings.length) {
            const empty = new PopupMenu.PopupMenuItem('Nincs közelgő meeting');
            empty.setSensitive(false);
            this.menu.addMenuItem(empty);
        } else {
            const now = new Date();
            const grace = this._settings.get_int('late-grace-minutes');
            let lastDayKey = null;
            let first = true;
            for (const m of meetings) {
                const dayKey = `${m.start.getFullYear()}-${m.start.getMonth()}-${m.start.getDate()}`;
                if (dayKey !== lastDayKey) {
                    // Hangsúlyos nap-elválasztó minden naphoz
                    if (!first)
                        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                    const head = new PopupMenu.PopupMenuItem(dayHeader(m.start, now),
                        {reactive: false, can_focus: false});
                    head.add_style_class_name('om-day-head');
                    this.menu.addMenuItem(head);
                }
                lastDayKey = dayKey;
                first = false;
                this.menu.addMenuItem(this._meetingRow(m, meetingStatus(m, now, grace)));
            }
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const refresh = new PopupMenu.PopupMenuItem('Frissítés');
        refresh.connect('activate', () => this._refresh());
        this.menu.addMenuItem(refresh);

        const calendar = new PopupMenu.PopupMenuItem('Naptár megnyitása (Outlook)');
        calendar.connect('activate', () => openUri('https://outlook.office.com/calendar/'));
        this.menu.addMenuItem(calendar);

        this._addPrefsItem();

        const logout = new PopupMenu.PopupMenuItem('Kijelentkezés');
        logout.connect('activate', () => {
            this._oauth.logout();
            this._refresh();
        });
        this.menu.addMenuItem(logout);
    }

    _addPrefsItem() {
        const prefs = new PopupMenu.PopupMenuItem('Beállítások…');
        prefs.connect('activate', () => this._extension.openPreferences());
        this.menu.addMenuItem(prefs);
    }

    // Egy meeting sora: idő + tárgy (kattintásra Outlook weblink) és külön Teams gomb.
    // `status` szerint színes kiemelés (late/running).
    _meetingRow(m, status) {
        const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        let rowClass = 'om-row';
        if (status === 'late') rowClass += ' om-late';
        else if (status === 'running') rowClass += ' om-running';
        const row = new St.BoxLayout({x_expand: true, style_class: rowClass});

        const infoBox = new St.BoxLayout({x_expand: true, style_class: 'om-info-box'});
        const marker = (status === 'late' || status === 'running') ? '▶ ' : '';
        const timeLabel = new St.Label({
            text: m.isAllDay ? 'egész nap' : `${marker}${fmtTime(m.start)}–${fmtTime(m.end)}`,
            style_class: 'om-time',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const subjLabel = new St.Label({
            text: truncate(m.subject, 40),
            x_expand: true,
            style_class: 'om-subject',
            y_align: Clutter.ActorAlign.CENTER,
        });
        infoBox.add_child(timeLabel);
        infoBox.add_child(subjLabel);

        const infoBtn = new St.Button({
            child: infoBox,
            x_expand: true,
            style_class: 'om-info-btn',
        });
        infoBtn.connect('clicked', () => {
            openUri(m.webLink);
            this.menu.close();
        });
        row.add_child(infoBtn);

        if (m.joinUrl) {
            const joinBtn = new St.Button({
                label: 'Teams',
                style_class: 'button om-join-btn',
                y_align: Clutter.ActorAlign.CENTER,
            });
            joinBtn.connect('clicked', () => {
                joinTeams(m.joinUrl, this._settings.get_string('teams-open-method'));
                this.menu.close();
            });
            row.add_child(joinBtn);
        }

        item.add_child(row);
        return item;
    }

    async _doLogin() {
        if (this._loginInProgress) return;
        this._loginInProgress = true;
        this._setPanel('Bejelentkezés…', false);
        try {
            await this._oauth.login();
            await this._refresh();
        } catch (e) {
            logError(e, 'OutlookMeetings: bejelentkezés hiba');
            this._setPanel('Bejelentkezés', false);
            this._buildErrorMenu(e.message);
        } finally {
            this._loginInProgress = false;
        }
    }
});

export default class OutlookMeetingsExtension extends Extension {
    enable() {
        this._indicator = new OutlookButton(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.stop();
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
