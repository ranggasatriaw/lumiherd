#!/bin/sh
# Checks for mistakes agents (and people) made here before, so they can't come back.
# Each one is a rule from AGENTS.md that a script can hold instead of a reminder.
# Run before a pull request: ./check.sh (CI runs it too). Needs node; jq or python3.
cd "$(dirname "$0")" || exit 1
fail=0
bad() { printf 'FAIL %s\n' "$*"; fail=1; }

# Herdr mods have no timers of the browser's kind: cx.spawn + cx.sleep, or cx.timer.every.
grep -rnE '\b(setTimeout|setInterval)\s*\(' lumiherd/mods --include='*.js' | while IFS= read -r l; do
  echo "FAIL no setTimeout/setInterval in mods (use cx.spawn + cx.sleep or cx.timer.every): $l"
done | grep . && fail=1

# Windows has no python3 (only python): every python3 call needs a fallback, or the
# python() helper of lumiherd/main.js.
grep -rn 'exec("python3"' lumiherd/mods --include='*.js' | grep -v '"python"' | while IFS= read -r l; do
  echo "FAIL python3 without a python fallback (Windows): $l"
done | grep . && fail=1

# JSON: valid, and without the BOM PowerShell 5 writes (Herdr can't read it).
for f in $(find . -name '*.json' -not -path './.git/*' -not -path '*/node_modules/*'); do
  if [ "$(head -c 3 "$f" | od -An -tx1 | tr -d ' \n')" = "efbbbf" ]; then bad "BOM in $f"; continue; fi
  if command -v jq >/dev/null 2>&1; then jq empty "$f" 2>/dev/null || bad "invalid JSON: $f"
  else python3 -m json.tool "$f" >/dev/null 2>&1 || bad "invalid JSON: $f"; fi
done

# Every mod's JavaScript parses.
for f in $(find lumiherd/mods -name '*.js'); do
  node --check --input-type=module < "$f" >/dev/null 2>&1 || bad "JavaScript doesn't parse: $f ($(node --check --input-type=module < "$f" 2>&1 | grep -m1 -E 'Error'))"
done

# Shell scripts parse.
for f in $(find . -name '*.sh' -not -path './.git/*'); do
  sh -n "$f" 2>/dev/null || bad "shell script doesn't parse: $f"
done

# A panel of Lumiherd's own (a lumiherd-* block in the panel-body stack) has a
# button in the tab bar and a topic in Help.
if command -v jq >/dev/null 2>&1; then
  jq -r '.. | objects | select(.id? == "panel-body") | .children[] | select(.content.mod? // "" | startswith("lumiherd-")) | "\(.id) \(.content.mod)"' lumiherd/layouts/lumiherd.json |
  while read -r id mod; do
    grep -q "panelButton(\"$id\"" lumiherd/mods/lumiherd-tabs/main.js || echo "FAIL panel \"$id\" ($mod) has no button in lumiherd-tabs"
    title=$(grep -oE "panelButton\(\"$id\", \"[^\"]+\"" lumiherd/mods/lumiherd-tabs/main.js | sed -E 's/.*, "([^"]+)"/\1/')
    [ -z "$title" ] || grep -q "topic(\"$title\"" lumiherd/mods/lumiherd-options/help.js || echo "FAIL panel \"$title\" has no topic in lumiherd-options/help.js"
  done | grep . && fail=1
fi

# Herdr's own check of each mod, where Herdr is installed and has a window to load it in.
if [ -z "$CI" ] && command -v herdr-app >/dev/null 2>&1; then
  for d in lumiherd/mods/*/; do
    out=$(herdr-app check "$d" 2>&1) || { echo "$out" | grep -qi 'no window\|not running\|headless' || bad "herdr-app check $d: $(echo "$out" | head -3)"; }
  done
fi

[ "$fail" = 0 ] && echo "All checks passed" || exit 1
