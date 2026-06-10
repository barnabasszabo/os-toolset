# os-toolset

Natív **GNOME Shell** segédek, amelyek a napi Microsoft 365 munkaeszközöket (Outlook naptár, Teams) a felső sávból teszik egy kattintásra elérhetővé. Tisztán **GJS** (GNOME JavaScript) — nincs Electron.

Minden alprojekt önálló GNOME Shell extension, saját telepítővel.

---

## Projektek

| Könyvtár | Mit csinál |
|----------|------------|
| [`gnome-shell-outlook-meetings`](gnome-shell-outlook-meetings/) | A következő / épp futó Outlook meeting a felső sávban, legördülő a többi meetinggel napokra bontva, futó/késő kiemeléssel és Teams-csatlakozás gombbal. MSAL-mentes OAuth (PKCE) + Microsoft Graph. |
| [`gnome-shell-outlook`](gnome-shell-outlook/) | Naptár-ikon a felső sávban: kattintásra az Outlook naptár nyílik egy átméretezhető, natív GTK4 + WebKitGTK ablakban (méret megőrizve, login perzisztens). |

A kettő kiegészíti egymást: a *meetings* a következő eseményt mutatja a panelban, a másik a teljes naptárat nyitja külön ablakban.

---

## Környezet

- GNOME Shell 45–47 (fejlesztve: 46), GJS 1.80, Wayland.
- A `gnome-shell-outlook` ablakához: GTK 4, libadwaita 1, WebKitGTK 6.0.
- A Microsoft 365 integrációhoz Azure Entra ID app-regisztráció kell (lásd a `gnome-shell-outlook-meetings` README-jét — különösen a **public client redirect** buktatót).

---

## Telepítés

Mindkét projekt azonos minta szerint:

```bash
cd <projekt>
./install.sh
# Wayland: jelentkezz ki/be (vagy reboot), hogy a Shell betöltse
gnome-extensions enable <uuid>
```

UUID-k:
- `outlook-meetings@szabobarnabas.hu`
- `outlook-calendar@szabobarnabas.hu`

Részletek, architektúra és buktatók az egyes projektek README-jeiben (AI-karbantartóknak is).

---

## Szerző

Barnabás Szabó — http://szabobarnabas.hu
