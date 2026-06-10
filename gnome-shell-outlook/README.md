# Outlook Calendar — GNOME Shell extension

> Naptár-ikon a felső sávban: kattintásra az **Outlook naptár** nyílik meg egy **átméretezhető, natív GTK4 + WebKitGTK** ablakban. Az ablak mérete megőrződik, a bejelentkezés megmarad.

Ez a README elsősorban **AI-ügynököknek** szól, akik később ezt a kódot módosítják.

---

## TL;DR a karbantartónak (AI)

- **Platform:** GNOME Shell 46 (ESM-extension), GJS 1.80, Wayland. GTK 4.14 + Adw 1.5 + **WebKit 6.0** elérhető a gépen.
- **Miért két rész:** webview-t **nem lehet** a `gnome-shell` (Clutter/St) processzbe ágyazni. Ezért:
  - `extension.js` — csak egy panel-ikon, ami **külön GJS processzt indít**.
  - `calendar-window.js` — önálló **Adw.Application** (GTK4 + WebKitGTK ablak), amit `gjs -m` futtat.
- **Wayland:** az `extension.js` változása **logout/login** után tölt be. A `calendar-window.js` viszont külön processz — annak módosítása **azonnal** él a következő indításnál, relog nélkül.
- **Nincs build.** Forrás = futtatott kód. `install.sh` másol + sémát fordít.
- **Single-instance:** az `Adw.Application` app-id miatt az ablak ismételt indítása a meglévőt hozza előtérbe (nem nyit újat).

UUID: `outlook-calendar@szabobarnabas.hu`

---

## Fájltérkép

| fájl | szerep |
|------|--------|
| `extension.js` | Panel naptár-ikon (`dontCreateMenu`), `button-press-event` → `Gio.Subprocess` indítja a `calendar-window.js`-t a `gjs`-szel. |
| `calendar-window.js` | Adw.Application: HeaderBar (újratöltés gomb) + `WebKit.WebView`. Perzisztens `NetworkSession` (SQLite cookie) → megmaradó login. Méret mentése `close-request`-kor GSettingsbe. |
| `config.js` | `CALENDAR_URL`, ablak-default, `SCHEMA_ID`, `APP_ID`, `USER_AGENT`. |
| `schemas/*.gschema.xml` | `window-width`, `window-height`, `window-maximized`. |
| `metadata.json` | `shell-version`, `settings-schema`. |
| `install.sh` | Telepít + `glib-compile-schemas`. |

---

## Hogyan működik

1. Az `extension.js` egy `PanelMenu.Button`-t tesz a jobb oldali rendszerterületre. Kattintásra `gjs -m <ext-dir>/calendar-window.js`-t indít (`extension.path`-ból).
2. A `calendar-window.js` egy GTK4 ablakot nyit egy `WebKit.WebView`-val, ami betölti a `CALENDAR_URL`-t.
3. A login a webview-ban történik (mint egy böngészőben); a cookie-k a perzisztens `NetworkSession`-be (`~/.local/share/outlook-calendar/`) mentődnek, így legközelebb is be vagy jelentkezve.
4. Bezáráskor az ablakméret a GSettingsbe íródik, és a következő indításkor visszaáll.

> A `USER_AGENT` Edge/Chromium-szerűre van állítva, hogy az M365 web ne degradáljon „nem támogatott böngésző"-re WebKitGTK alatt.

---

## Telepítés

```bash
./install.sh
# Wayland: logout/login (vagy reboot)
gnome-extensions enable outlook-calendar@szabobarnabas.hu
```

Az ablak önállóan is futtatható (auth/render teszteléshez, relog nélkül):
```bash
gjs -m ~/.local/share/gnome-shell/extensions/outlook-calendar@szabobarnabas.hu/calendar-window.js
```

---

## Beállítások (GSettings)

Séma: `org.gnome.shell.extensions.outlook-calendar`. A `calendar-window.js` a sémát az **extension saját `schemas/` könyvtárából** tölti (`SettingsSchemaSource.new_from_directory`), nem kell rendszerszintű telepítés.

| kulcs | típus | default | jelentés |
|-------|-------|---------|----------|
| `window-width` | i | 1100 | utolsó ablakszélesség |
| `window-height` | i | 800 | utolsó ablakmagasság |
| `window-maximized` | b | false | teljes méretű volt-e |

---

## Tesztelés / hibakeresés

```bash
# extension.js parse (csak a resource:// Shell-import hiba a várt):
gjs -m ./extension.js

# calendar-window.js: ténylegesen elindítja az ablakot (kell hozzá grafikus session):
gjs -m ./calendar-window.js

# séma:
glib-compile-schemas --strict --dry-run schemas/

# Shell-log:
journalctl --user -b -o cat /usr/bin/gnome-shell | grep -i -A3 outlookcalendar
```

---

## Ismert korlátok / feltételezések

- A `calendar-window.js` futtatásához kell a `gjs` a PATH-on (az extension `find_program_in_path('gjs')`-t használ).
- A séma-betöltés feltételezi, hogy az `install.sh` lefordította a `schemas/gschemas.compiled`-et az extension könyvtárában.
- WebKitGTK render: ritkán előfordulhat M365-specifikus eltérés a Chromiumhoz képest; a `USER_AGENT` ezen segít, de nem garantál 100% paritást.
- Külön extension a [`gnome-shell-outlook-meetings`](../gnome-shell-outlook-meetings/)-tól (az a következő meetinget mutatja a panelban); ez a teljes naptár-ablakot adja.
