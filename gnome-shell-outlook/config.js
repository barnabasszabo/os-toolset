// Megosztott beállítások az extension és a kísérő-ablak között.

// Az Outlook naptár webes URL-je, amit a WebKit ablak betölt.
export const CALENDAR_URL = 'https://outlook.office.com/calendar/view/workweek';

// Ablakcím és alapértelmezett méret (a GSettings felülírja, ha van mentett méret).
export const WINDOW_TITLE = 'Outlook naptár';
export const DEFAULT_WIDTH = 1100;
export const DEFAULT_HEIGHT = 800;

// GSettings séma id (a window-width/height kulcsokhoz).
export const SCHEMA_ID = 'org.gnome.shell.extensions.outlook-calendar';

// A kísérő GTK-app application id-je (single-instance: újbóli indítás a meglévőt hozza előtérbe).
export const APP_ID = 'hu.szabobarnabas.OutlookCalendar';

// Chromium/Edge-szerű user agent, hogy az M365 web ne „nem támogatott böngésző"-ként
// degradáljon WebKitGTK alatt.
export const USER_AGENT =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
