#!/bin/sh
# A screenshot of the Herdr window for checking a change by eye, made safe to share
# with an agent: the small shell under the right panel (which can show secrets, an
# .env being edited, say) is hidden while it's taken, the picture is cut to the part
# asked for, and shots older than 10 minutes are deleted. macOS; needs uv (for Pillow).
#   ./shot.sh [right|left|full] [fraction]   right (default): the right part of the
#   window, 0.38 of its width unless a fraction is given; left: the rest.
# Prints the picture's path.
part=${1:-right}; frac=${2:-0.38}
dir="${TMPDIR:-/tmp}/lumiherd-shots"; mkdir -p "$dir"
find "$dir" -name '*.png' -mmin +10 -delete 2>/dev/null
raw="$dir/raw-$$.png"; out="$dir/shot-$(date +%H%M%S)-$part.png"
herdr-app do layout.hide '{"id":"panel-shell"}' >/dev/null 2>&1
sleep 0.5
herdr-app shot "$raw" >/dev/null || { herdr-app do layout.show '{"id":"panel-shell"}' >/dev/null 2>&1; exit 1; }
herdr-app do layout.show '{"id":"panel-shell"}' >/dev/null 2>&1
uv run -q --with pillow python - "$raw" "$out" "$part" "$frac" <<'PY'
import sys
from PIL import Image
raw, out, part, frac = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
im = Image.open(raw)
w, h = im.size
cut = int(w * (1 - frac))
box = {"right": (cut, 0, w, h), "left": (0, 0, cut, h)}.get(part, (0, 0, w, h))
im.crop(box).save(out)
PY
rm -f "$raw"
echo "$out"
