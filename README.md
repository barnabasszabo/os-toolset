# os-toolset

Személyes „OS toolbar" eszközgyűjtemény: kis asztali widgetek és menüsor-/panel-alkalmazások, amelyek a napi munkaeszközöket (Outlook naptár, Teams, Jira, szótár) az operációs rendszer sávjából teszik egy kattintásra elérhetővé — **macOS**, **Windows** és **Linux/GNOME** alatt.

Minden alprojekt önálló, saját függőségekkel és build-del. Közös bennük a „mindig kéznél lévő, könnyűsúlyú segéd" filozófia, és több helyen a **Microsoft Entra (Azure AD) + Microsoft Graph** integráció.

---

## Projektek

| Könyvtár | Platform | Technológia | Mit csinál |
|----------|----------|-------------|------------|
| [`gnome-shell-outlook-meetings`](gnome-shell-outlook-meetings/) | Linux / GNOME 46 | GJS (natív GNOME Shell extension), libsoup, MS Graph | A következő / épp futó Outlook meeting a felső sávban, legördülő a többivel, Teams-csatlakozás gomb. |
| [`winWidget`](winWidget/) | Windows 11 | Electron, MSAL, MS Graph | Always-on-top, frameless widget: naptár, Jira, idő, Outlook nézetek webview-kban; Entra auth. |
| [`os-menubar-outlook-web`](os-menubar-outlook-web/) | macOS / Linux | Electron + `menubar` | Az Outlook web megnyitása az OS tálcasávból. |
| [`outlook-webapp`](outlook-webapp/) | cross-platform | Electron Forge | Outlook naptár webapp-csomagolás. |
| [`os-menubar-english-dictionary`](os-menubar-english-dictionary/) | macOS / Win / Linux | Angular + Electron | Szótár/fordító a menüsorban (Google Translate + Oxford API). |

---

## Alprojektek röviden

### `gnome-shell-outlook-meetings` (Linux / GNOME)
Natív GNOME Shell extension a felső sávba. A saját Outlook naptárból mutatja a következő (vagy épp futó) meetinget, legördülőben napokra bontva a többit, és Teams-meetingnél csatlakozás gombot ad (a Teams PWA-ban nyit). OAuth Authorization Code + PKCE, szerveroldali token-csere és háttérfrissítés. **Részletes beüzemelés és a buktatók (Azure public-client redirect, Teams origin) a [saját README-jében](gnome-shell-outlook-meetings/README.md).**

### `winWidget` (Windows)
Always-on-top, keret nélküli, mozgatható widget Windows 11-re. Microsoft Entra autentikációval és Graph API-val több nézetet ad (naptár, Jira, idő, Outlook) webview-ablakokban, méret-megőrzéssel. Az auth a `msal-config.js`-ben konfigurálható. CI build: `.github/workflows/build-winwidget.yml`.

### `os-menubar-outlook-web` (macOS / Linux)
Egyszerű Electron `menubar` app, amely az Outlook webet teszi elérhetővé az OS tálcasávjából — nem kell külön böngészőben keresgélni.

### `outlook-webapp`
Electron Forge-alapú csomagolás az Outlook naptár webapphoz (deb/rpm/zip/squirrel makerekkel).

### `os-menubar-english-dictionary` (macOS / Win / Linux)
Angular + Electron menüsor-app: szavak fordítása (Google Translate) és Oxford-szótár. Saját Oxford API app-id/app-key beállítható (regisztráció: developer.oxforddictionaries.com).

---

## Fejlesztés

Minden projekt külön települ és fut. Általános minta a (nem-GNOME) Electron-projekteknél:

```bash
cd <projekt>
npm install
npm start         # fejlesztői futtatás
npm run build     # csomagolás (electron-builder / electron-forge)
```

A GNOME extension nem buildelődik — a forrás a futtatott kód; telepítés és a Wayland-specifikus újratöltés a [`gnome-shell-outlook-meetings/README.md`](gnome-shell-outlook-meetings/README.md)-ben.

---

## Közös témák

- **Microsoft Entra / Graph:** a `winWidget` és a `gnome-shell-outlook-meetings` is Azure app-regisztrációt használ Graph-lekérésekhez (`Calendars.Read` stb.). Figyelni kell a redirect-platform típusára (SPA vs. public client) — lásd a GNOME-projekt README-jét.
- **Webview-widgetek:** több projekt beágyazott webnézetekben mutat MS 365 felületeket, méret-megőrzéssel.

---

## Szerző

Barnabás Szabó — http://szabobarnabas.hu
