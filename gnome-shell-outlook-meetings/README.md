# Outlook Meetings — GNOME Shell extension

> Natív GNOME felső-sáv (top panel) widget: a saját Outlook naptárból kiírja a **következő / épp futó meetinget**, legördülőben a többit napokra bontva, és **Teams-csatlakozás** gombbal.

Ez a README elsősorban **AI-ügynököknek** szól, akik később ezt a kódot módosítják. Tartalmazza az architektúrát, a beüzemelést és a két nem-triviális buktatót (Azure auth, Teams origin), amik nélkül a változtatás eltörik.

---

## TL;DR a karbantartónak (AI)

- **Platform:** GNOME Shell 46 (ESM-extension formátum), GJS 1.80, **Wayland**.
- **Wayland kulcstény:** a futó `gnome-shell` nem tölti újra a kódot `disable`/`enable`-re. **Minden `extension.js`/`*.js`/séma változás után KI/BEJELENTKEZÉS (logout) kell.** A `prefs.js` külön processz, az reload nélkül frissül.
- **Nincs build.** A forrás = a futtatott kód. Az `install.sh` átmásolja a fájlokat `~/.local/share/gnome-shell/extensions/<uuid>/`-ba és lefordítja a GSettings sémát.
- **Validálás logout nélkül:** lásd [Tesztelés](#tesztelés). `gjs -m ./extension.js` parse-ellenőrzésre, `glib-compile-schemas --dry-run` a sémára.
- **A két buktató:** (1) az Azure-redirect **public client / native** kell legyen, nem SPA — különben `AADSTS7000218`; (2) a Teams join-link `teams.microsoft.com`, a PWA viszont `teams.cloud.microsoft` — origin-eltérés. Részletek lent.

UUID: `outlook-meetings@szabobarnabas.hu`

---

## Architektúra / fájltérkép

| fájl | szerep |
|------|--------|
| `extension.js` | Belépési pont. `PanelMenu.Button` a panelben (ikon + felirat + opcionális Teams-gomb), legördülő menü felépítése, frissítési időzítő, Teams-indítás. |
| `oauth.js` | `OAuth` osztály: Authorization Code + PKCE flow, **szerveroldali** token-csere (libsoup), refresh-token-es megújítás, token tárolás fájlba. |
| `graph.js` | `getUpcomingMeetings(token, daysAhead)` — Microsoft Graph `me/calendarview` lekérés, UTC→helyi idő, már-futó meetingek bennhagyása. |
| `http.js` | libsoup 3 Promise-wrapper: `getJson(url, token)`, `postForm(url, params)`. |
| `config.js` | Minden hardcode-olt konstans (Azure id-k, endpointok, Edge/PWA elérés, default értékek). |
| `prefs.js` | Adw alapú beállítások oldal (külön processz). |
| `schemas/*.gschema.xml` | GSettings séma. Telepítéskor `gschemas.compiled`-dá fordul. |
| `metadata.json` | `shell-version`, `settings-schema` (= a séma id-je). |
| `stylesheet.css` | Panel/menü stílus, futó/késő kiemelés színek, nap-fejléc. |
| `install.sh` | Telepít + sémát fordít. |

Adatfolyam egy frissítéskor:
`_refresh()` → `oauth.getAccessToken()` (fájl-token vagy refresh) → `getUpcomingMeetings()` → `_updatePanel()` + `_buildMenu()`.

---

## Beüzemelés

### 1. Azure Entra ID app-regisztráció (egyszeri, **kötelező** előfeltétel)

A `config.js` egy meglévő app-regisztrációt használ (a repo `winWidget` projektjével közös):
- `CLIENT_ID = 5c64a3e4-41e4-4487-9246-7e9d735cce01`
- `TENANT = 2f2b6561-0a3c-476e-9080-9dc1a1f3f486`
- scope-ok: `openid offline_access User.Read Calendars.Read`

**A kritikus rész** (lásd [Buktató #1](#buktató-1-azure-auth--spa-vs-public-client)):
az app **Authentication** lapján kell egy **„Mobile and desktop applications" (public client)** platform, benne a redirect:
```
http://127.0.0.1:4200
```
és **„Allow public client flows" = Yes**.
> Szándékosan `127.0.0.1` és **nem** `localhost` — a `http://localhost:4200/` ugyanitt **SPA**-ként van bejegyezve (a `winWidget` használja), és a kettő nem ütközhet ugyanazon a stringen.

### 2. Telepítés
```bash
./install.sh
```
Ez átmásolja a fájlokat és lefordítja a sémát.

### 3. Betöltés és engedélyezés (Wayland)
```bash
# Logout → login (vagy reboot), HOGY A SHELL BETÖLTSE A KÓDOT.
gnome-extensions enable outlook-meetings@szabobarnabas.hu
```

### 4. Bejelentkezés
A panelban a naptár-ikon → **„Bejelentkezés a Microsoft 365-be…"**. Megnyílik a böngésző, belépsz, a token a `~/.config/outlook-meetings/tokens.json` (0600) fájlba kerül.

### 5. Beállítások
```bash
gnome-extensions prefs outlook-meetings@szabobarnabas.hu
```

---

## Buktató #1: Azure auth — SPA vs public client

A token-cserét **szerveroldalon** (libsoup, böngésző nélkül) végezzük, mert a háttérfrissítésnek (5 perc) böngésző nélkül kell mennie.

- Ha a redirect az app-regisztrációban **SPA**-ként van bejegyezve, a szerveroldali (Origin nélküli) token-csere ezzel bukik:
  `AADSTS7000218: The request body must contain ... 'client_assertion' or 'client_secret'`.
- **Megoldás:** **public client / native** platform redirect (`http://127.0.0.1:4200`) + „Allow public client flows = Yes". Ekkor PKCE elég, titok nélkül, és a refresh is megy headless.
- **NE** állítsd vissza böngésző-oldali (SPA, cross-origin `fetch`) token-cserére: SPA-nál a **refresh** is csak cross-origin menne, ami a háttérfrissítést elrontaná.

A flow `oauth.js`-ben: PKCE verifier/challenge → rövid életű `Soup.Server` figyel `127.0.0.1:4200`-on → böngésző megnyitása az authorize URL-re → a redirectből kapott `code` → `postForm(TOKEN_URL, ...)` szerveroldalon → token mentés. Refreshnél `grant_type=refresh_token`.

---

## Buktató #2: Teams join origin

A Graph `onlineMeeting.joinUrl` a **`teams.microsoft.com`** domainen van. A telepített Teams **PWA** viszont a **`teams.cloud.microsoft`** originre van scope-olva (lásd `~/.local/share/applications/msedge-...-Default.desktop`).

Következmények:
- A nyers join-URL `--app-id`-vel indítva **kívül esik a PWA scope-ján** → a PWA a kezdőlapját mutatja, nem a meetinget.
- A PWA (`teams.cloud.microsoft`) és a böngésző-meeting (`teams.microsoft.com`) **külön origin → külön tárolt egyéni háttérképek és eltérő renderelés**.

Ezért a `joinTeams(joinUrl, method)` három módot támogat (GSettings `teams-open-method`):
- **`pwa`** (alapértelmezett): a host átírva `teams.cloud.microsoft`-ra (`toPwaUrl`), majd `--app-id=<PWA>` → a PWA-n belül nyílik (helyes háttér, közös tárhely).
- **`edge-app`**: `--app=<nyers joinUrl>` → külön Edge app-ablak `teams.microsoft.com`-on.
- **`default-browser`**: `xdg-open` / `launch_default_for_uri`.

> A `pwa` mód feltételezi, hogy a `teams.cloud.microsoft` is kiszolgálja a `/l/meetup-join/...` linkeket. Ha nem vinne be a meetingbe, az `edge-app`/`default-browser` a fallback, vagy Edge-oldalon az `edge://apps`-ban a Teams PWA-nál „supported links in this app".

Hardcode-olt értékek (`config.js`): `EDGE_BIN=/opt/microsoft/msedge/microsoft-edge`, `TEAMS_PWA_APPID=ompifgpmddkgmclendfeacglnodjjndh`.

---

## Beállítások (GSettings)

Séma: `org.gnome.shell.extensions.outlook-meetings`

| kulcs | típus | default | jelentés |
|-------|-------|---------|----------|
| `refresh-interval-minutes` | i (1–120) | 5 | naptár-lekérés gyakorisága; változáskor élőben újraütemez |
| `days-ahead` | i (1–14) | 3 | hány napra előre |
| `late-grace-minutes` | i (0–60) | 5 | eddig a percig „most kezdődött" → színes kiemelés, elöl |
| `teams-open-method` | s (`pwa`/`edge-app`/`default-browser`) | `pwa` | Teams megnyitási mód |

Panel-viselkedés: a fejléc a **legkorábbi még be nem fejeződött, nem egész napos** meeting (tehát a futó meetinget mutatja, `▶` jellel; egész napos esemény nem foglalja el a panelt). A `late-grace-minutes`-en belül futó meeting sárgával kiemelve és elöl.

---

## Tesztelés

A teljes futtatás csak `gnome-shell`-en belül megy, de logout nélkül is sokat lehet validálni:

```bash
# Standalone modulok import/szintaxis (gi:// elérhető plain gjs-ben):
gjs -m -e 'import("./config.js"); import("./oauth.js")'   # vagy egy kis import-teszt fájl

# extension.js / prefs.js parse: csak a resource:// (Shell-only) importnál akadhat el,
# ami azt jelenti, hogy a szintaxis OK:
gjs -m ./extension.js   # várt hiba: "Unable to load file from: resource:///org/gnome/shell/..."
gjs -m ./prefs.js       # várt hiba: "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js"

# GSettings séma:
glib-compile-schemas --strict --dry-run schemas/
```

---

## Hibakeresés

```bash
# Shell-log (a logError üzenetek "OutlookMeetings:"-gyel kezdődnek):
journalctl --user -b -o cat /usr/bin/gnome-shell | grep -i -A3 outlook

# Token állapot:
cat ~/.config/outlook-meetings/tokens.json     # access_token, refresh_token, expires_at

# Engedélyezett-e:
gnome-extensions info outlook-meetings@szabobarnabas.hu
```

Auth-hibák reprodukálása logout nélkül: indíts egy kis `gjs` szkriptet, ami importálja az `oauth.js`-t és meghívja `login()`-t / `getAccessToken()`-t, és kiírja a pontos AADSTS üzenetet (`Soup.Server`-rel ugyanúgy figyel `127.0.0.1:4200`-on).

---

## Ismert feltételezések / korlátok

- Hardcode-olt Azure `CLIENT_ID`/`TENANT`, Edge-útvonal, PWA app-id (`config.js`).
- Egy felhasználó, egy Teams PWA profil (`Default`).
- Az időszámítás a rendszer helyi időzónáját használja (`graph.js` UTC→local, `'Z'` pótlással).
- A token egyszerű 0600-as fájlban, nem keyringben (egyszerűség + nincs unlock-prompt). Secret-1 (libsecret) elérhető lenne, ha szigorúbb tárolás kell.
