#!/usr/bin/env bash
# Telepíti az extensiont a felhasználói GNOME Shell extension könyvtárba.
set -euo pipefail

UUID="outlook-meetings@szabobarnabas.hu"
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

mkdir -p "$DEST/schemas"
cp -f \
    "$SRC/extension.js" \
    "$SRC/prefs.js" \
    "$SRC/metadata.json" \
    "$SRC/config.js" \
    "$SRC/oauth.js" \
    "$SRC/graph.js" \
    "$SRC/http.js" \
    "$SRC/stylesheet.css" \
    "$DEST/"
cp -f "$SRC/schemas/"*.gschema.xml "$DEST/schemas/"

# GSettings séma fordítása
glib-compile-schemas "$DEST/schemas"

echo "Telepítve ide: $DEST"
echo
echo "Következő lépések:"
echo "  1) Wayland alatt jelentkezz ki/be (vagy reboot), hogy a Shell betöltse az új kódot."
echo "  2) Engedélyezd (ha kell):   gnome-extensions enable $UUID"
echo "  3) Beállítások:             gnome-extensions prefs $UUID"
echo
echo "Hibakeresés (a Shell logja):"
echo "  journalctl --user -b -o cat /usr/bin/gnome-shell | grep -i outlook"
