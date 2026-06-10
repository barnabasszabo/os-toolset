#!/usr/bin/env bash
# Telepíti az Outlook Calendar extensiont a felhasználói GNOME Shell extension könyvtárba.
set -euo pipefail

UUID="outlook-calendar@szabobarnabas.hu"
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

mkdir -p "$DEST/schemas"
cp -f \
    "$SRC/extension.js" \
    "$SRC/calendar-window.js" \
    "$SRC/config.js" \
    "$SRC/metadata.json" \
    "$SRC/stylesheet.css" \
    "$DEST/"
cp -f "$SRC/schemas/"*.gschema.xml "$DEST/schemas/"

# GSettings séma fordítása (a kísérő-ablak ebből olvassa a mentett méretet)
glib-compile-schemas "$DEST/schemas"

echo "Telepítve ide: $DEST"
echo
echo "Következő lépések:"
echo "  1) Wayland alatt jelentkezz ki/be (vagy reboot), hogy a Shell betöltse."
echo "  2) Engedélyezd:   gnome-extensions enable $UUID"
echo "  3) Kattints a naptár-ikonra a felső sávban."
echo
echo "Az ablak tesztelhető önállóan is:"
echo "  gjs -m \"$DEST/calendar-window.js\""
