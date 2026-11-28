#!/usr/bin/env python3
# The sidebar's project scan (MARKED and PROJECTS_FROM_RULES in main.js) for a
# computer without sh, such as Windows; the same rules, Python 3 standard library.
#   argument: the Projects folder as set ("~/Code" or a full path), or none:
#     then the folder the agents' rule files name on a line about projects
#     (a `~/…` in backticks; lumiherd's handoff block left out), else home
# Prints {"home", "named", "dirs"}: home, the folder the rules named (or ""),
# and the project folders: a git repo directly in the Projects folder, or up to
# two levels under home a folder set up for an agent (CLAUDE.md,
# CLAUDE.local.md, AGENTS.md, a .claude folder), not in hidden folders under
# home or in node_modules.
import json, os, re, sys

HOME = os.path.expanduser("~")
MARKERS = {"CLAUDE.md", "CLAUDE.local.md", "AGENTS.md"}


def full(d):
    if d == "~":
        return HOME
    if d.startswith("~/"):
        return os.path.normpath(os.path.join(HOME, d[2:]))
    return d


def named():
    kimi = os.environ.get("KIMI_CODE_HOME") or os.path.join(HOME, ".kimi-code")
    files = [os.path.join(HOME, ".claude", "CLAUDE.md"), os.path.join(HOME, ".codex", "AGENTS.md"),
             os.path.join(HOME, ".pi", "agent", "AGENTS.md"), os.path.join(kimi, "AGENTS.md")]
    for f in files:
        try:
            text = open(f, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        text = re.sub(r"<!-- lumiherd:handoff -->.*?<!-- /lumiherd:handoff -->", "", text, flags=re.S)
        for line in text.splitlines():
            if "project" not in line.lower():
                continue
            for d in re.findall(r"`(~/[^` ]+)`", line):
                d = d.rstrip("/")
                if os.path.isdir(full(d)):
                    return d
    return ""


def repos(folder, found):
    try:
        for e in os.scandir(folder):
            if e.is_dir(follow_symlinks=False) and os.path.exists(os.path.join(e.path, ".git")):
                found.add(e.path)
    except OSError:
        pass


def marked(folder, depth, found):
    try:
        entries = list(os.scandir(folder))
    except OSError:
        return
    for e in entries:
        if (depth == 1 and e.name.startswith(".")) or e.name == "node_modules":
            continue
        is_dir = e.is_dir(follow_symlinks=False)
        if e.name in MARKERS or (e.name == ".claude" and is_dir):
            found.add(folder)
        if is_dir and depth < 3:
            marked(e.path, depth + 1, found)


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    rules = "" if arg else named()
    found = set()
    repos(full(arg or rules or "~"), found)
    marked(HOME, 1, found)
    print(json.dumps({"home": HOME, "named": rules, "dirs": sorted(found)}, separators=(",", ":")))


main()
