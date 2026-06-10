// Kapcsolódási és környezeti beállítások.
// Az auth-adatok a winWidget app-regisztrációjából származnak (public client, PKCE, loopback).

// --- Azure / Microsoft Graph ---
export const CLIENT_ID = '5c64a3e4-41e4-4487-9246-7e9d735cce01';
export const TENANT = '2f2b6561-0a3c-476e-9080-9dc1a1f3f486';

// Loopback redirect a "Mobile and desktop applications" (public client) platformhoz.
// Szándékosan 127.0.0.1 (nem localhost), hogy ne ütközzön a winWidget SPA-redirectjével.
export const REDIRECT_PORT = 4200;
export const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/`;

// offline_access -> refresh_token, hogy ne kelljen óránként újra bejelentkezni.
export const SCOPES = ['openid', 'offline_access', 'User.Read', 'Calendars.Read'];

export const AUTHORIZE_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;
export const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
export const GRAPH_CALENDAR_VIEW = 'https://graph.microsoft.com/v1.0/me/calendarview';

// --- Viselkedés ---
export const DAYS_AHEAD = 3;                 // hány napra előre nézzünk a naptárban
export const MAX_ITEMS = 15;                 // legfeljebb ennyi meeting a legördülőben
export const REFRESH_INTERVAL_SECONDS = 300; // 5 perc
export const PANEL_SUBJECT_MAXLEN = 24;      // a panel-felirat tárgyának max hossza

// --- Teams PWA (Edge) ---
// Az ~/.local/share/applications/msedge-...-Default.desktop alapján.
export const EDGE_BIN = '/opt/microsoft/msedge/microsoft-edge';
export const EDGE_PROFILE = 'Default';
export const TEAMS_PWA_APPID = 'ompifgpmddkgmclendfeacglnodjjndh';
