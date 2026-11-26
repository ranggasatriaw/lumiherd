#!/bin/sh
# Copies Lumiherd (layout + mods) into the Herdr app's home. Herdr reloads them live.
set -eu
src="$(cd "$(dirname "$0")" && pwd)/lumiherd"
home="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
# The small shell under the right panel shows the terminal named lumi-shell. Herdr drops a
# terminal block whose terminal is gone, so start it first. It runs a loop: `exit` gives a new shell.
command -v hc >/dev/null 2>&1 && { hc get lumi-shell >/dev/null 2>&1 \
  || hc run --bg --no-notify --no-parent --keep --name lumi-shell --cwd "$HOME" -- /bin/sh -c 'while :; do "${SHELL:-/bin/zsh}" -l; done' >/dev/null; }
rsync -a "$src/mods/" "$home/mods/"
rsync -a "$src/layouts/" "$home/layouts/"
# Imul, Lumi's little robot, as the agents' icon (a helmet colour per agent). Its
# programs.json goes in only when there is none: one of your own is never replaced.
mkdir -p "$home/imul" && cp "$src"/imul/*.png "$home/imul/"
[ -e "$home/programs.json" ] || cp "$src/imul/programs.json" "$home/programs.json"
# The brand row's picture (Lumi), when you haven't put one of your own.
mkdir -p "$home/brand" && { [ -e "$home/brand/lumiherd.png" ] || cp "$src/brand/lumiherd.png" "$home/brand/lumiherd.png"; }
for m in "$src"/mods/*/; do herdr-app check "$home/mods/$(basename "$m")" >/dev/null 2>&1 || echo "check failed: $(basename "$m")"; done
# The Files panel is Herdr-Roundup's (github.com/carstenlucke/herdr-roundup): its mods are not in this repo.
for m in roundup-files roundup-preview better-changes; do [ -d "$home/mods/$m" ] || echo "missing $m: the Files/Changes panels need Herdr-Roundup's mods/$m (roundup-*) or munza/herdr-mods' (better-changes) in $home/mods"; done
echo "Lumiherd installed in $home (switch: herdr-app do layout.switch '{\"name\":\"lumiherd\"}')"
