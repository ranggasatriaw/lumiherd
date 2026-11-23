#!/bin/sh
# Copies Lumiherd (layout + mods) into the Herdr app's home. Herdr reloads them live.
set -eu
src="$(cd "$(dirname "$0")" && pwd)/lumiherd"
home="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
rsync -a "$src/mods/" "$home/mods/"
rsync -a "$src/layouts/" "$home/layouts/"
for m in "$src"/mods/*/; do herdr-app check "$home/mods/$(basename "$m")" >/dev/null 2>&1 || echo "check failed: $(basename "$m")"; done
# The Files panel is Herdr-Roundup's (github.com/carstenlucke/herdr-roundup): its mods are not in this repo.
for m in roundup-files roundup-preview better-changes; do [ -d "$home/mods/$m" ] || echo "missing $m: the Files/Changes panels need Herdr-Roundup's mods/$m (roundup-*) or munza/herdr-mods' (better-changes) in $home/mods"; done
echo "Lumiherd installed in $home (switch: herdr-app do layout.switch '{\"name\":\"lumiherd\"}')"
