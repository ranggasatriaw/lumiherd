#!/bin/sh
# Copies Lumiherd (layout + mods) into the Herdr app's home. Herdr reloads them live.
set -eu
src="$(cd "$(dirname "$0")" && pwd)/lumiherd"
home="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
rsync -a "$src/mods/" "$home/mods/"
rsync -a "$src/layouts/" "$home/layouts/"
for m in "$src"/mods/*/; do herdr-app check "$home/mods/$(basename "$m")" >/dev/null 2>&1 || echo "check failed: $(basename "$m")"; done
echo "Lumiherd installed in $home (switch: herdr-app do layout.switch '{\"name\":\"lumiherd\"}')"
