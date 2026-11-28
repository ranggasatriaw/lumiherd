#!/usr/bin/env python3
# Claude billed by use (Amazon Bedrock, Vertex, Foundry, an API key): what it cost by day
# and by model, for the Usage rows.
# Claude Code gives a status line one total per session and saves cost by model only
# when a session ends, so this works it out from the transcripts: each API call's
# tokens at list prices, the same sum /usage shows. An estimate, not the bill; a cloud's
# prices can differ, and Claude Code's own background calls aren't in transcripts. Runs on
# the computer whose Claude it is; prints nothing unless that Claude is billed by use
# (claude.json, saved by Lumiherd's status line). Parsed files are kept in a cache, so a
# refresh is cheap.
import datetime, json, os, re, sys

DAYS = 30
VERSION = 6  # Bump when prices change or a call's entry does: the cache holds costs.
# Dollars per million tokens: input, output, cache read. A cache write is 1.25x input
# for 5 minutes, 2x for an hour.
PRICES = {
    "Fable 5.1": (10, 50, 0.25), "Fable 5": (10, 50, 1), "Opus 5.5": (4, 20, 0.2),
    "Opus 5": (5, 25, 0.5), "Sonnet 5.5": (2, 10, 0.2), "Sonnet 5": (2, 10, 0.2),
    "Sonnet 4.6": (3, 15, 0.3), "Haiku 5.5": (0.1, 0.5, 0.01), "Haiku 4.5": (1, 5, 0.1),
}
# A model not listed: its family's usual price.
FAMILY = {"fable": (10, 50, 1), "opus": (5, 25, 0.5), "sonnet": (3, 15, 0.3), "haiku": (1, 5, 0.1)}


def model_name(mid):
    # "claude-opus-5-5" -> "Opus 5.5"; Bedrock's "us.anthropic.claude-opus-5-5-v1:0" too.
    m = re.search(r"claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?![\d])", mid or "")
    if not m:
        return None
    return f"{m.group(1).capitalize()} {m.group(2)}{'.' + m.group(3) if m.group(3) else ''}"


def cost(name, u):
    p = PRICES.get(name) or FAMILY.get(name.split()[0].lower())
    if not p:
        return None
    c = u.get("cache_creation") or {}
    hour = c.get("ephemeral_1h_input_tokens") or 0
    five = max((u.get("cache_creation_input_tokens") or 0) - hour, 0)
    # Fast mode (the Claude API only) is twice the price.
    return (2 if u.get("speed") == "fast" else 1) * (
        (u.get("input_tokens") or 0) * p[0] + (u.get("output_tokens") or 0) * p[1]
        + (u.get("cache_read_input_tokens") or 0) * p[2]
        + five * p[0] * 1.25 + hour * p[0] * 2) / 1e6


ROOTS = {}


def project_name(cwd):
    # A project's folder name: its repo's (the nearest folder up with .git), so a
    # session in repo/src counts as repo; a worktree in the repo counts as the repo.
    # Not in a repo: the folder right under ~/dev, ~/Code or ~/Projects, else its own.
    if not cwd:
        return "?"
    if cwd in ROOTS:
        return ROOTS[cwd]
    path = cwd.replace("\\", "/").rstrip("/")
    if "/Claude/scratch-workspaces/" in path or "/Claude/claude-code-sessions/" in path:
        ROOTS[cwd] = "Claude Desktop (scratch)"
        return ROOTS[cwd]
    for mark in ("/.claude/worktrees/", "/.worktrees/"):
        if mark in path:
            path = path.split(mark)[0]
    root, up = None, path
    while up and "/" in up.strip("/"):
        if os.path.exists(os.path.join(up, ".git")):
            root = up
            break
        up = up.rsplit("/", 1)[0]
    if root is None:
        home = os.path.expanduser("~").replace("\\", "/").rstrip("/")
        root = path
        for top in ("dev", "Code", "Projects"):
            base = f"{home}/{top}/"
            if path.lower().startswith(base.lower()):
                root = base + path[len(base):].split("/")[0]
                break
    ROOTS[cwd] = root.rsplit("/", 1)[-1] or "?"
    return ROOTS[cwd]


def read_transcript(path):
    # Each API call once, by its id ({"calls": {id: [day, model, cost]}}): it spans several
    # lines. And the folder most of them ran in ("cwd"): the session's project, though
    # it started in a scratch folder or cd'ed into a subfolder now and then.
    calls, where = {}, {}
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            if '"type":"assistant"' not in line:
                continue
            try:
                d = json.loads(line)
                m = d.get("message") or {}
                name, use = model_name(m.get("model")), m.get("usage")
                if d.get("type") != "assistant" or not name or not use:
                    continue
                at = datetime.datetime.fromisoformat(d["timestamp"].replace("Z", "+00:00"))
                c = cost(name, use)
                if c is not None:
                    calls[d.get("requestId") or d.get("uuid")] = [at.astimezone().strftime("%Y-%m-%d"), name, round(c, 7)]
                    if d.get("cwd"):
                        where[d["cwd"]] = where.get(d["cwd"], 0) + c
            except (ValueError, KeyError, TypeError, AttributeError):
                continue
    return {"calls": calls, "cwd": max(where, key=where.get) if where else None}


def scan(root, cutoff, cache):
    # Every transcript, subagents' too, changed since cutoff; the cache for those unchanged.
    files = {}
    for folder, _dirs, names in os.walk(root):
        for n in names:
            if not n.endswith(".jsonl"):
                continue
            p = os.path.join(folder, n)
            try:
                s = os.stat(p)
            except OSError:
                continue
            if s.st_mtime < cutoff:
                continue
            old = cache.get(p)
            if old and old[0] == s.st_mtime and old[1] == s.st_size:
                files[p] = old
                continue
            try:
                files[p] = [s.st_mtime, s.st_size, read_transcript(p)]
            except OSError:
                pass
    return files


def main():
    # --report: for any plan (the Usages panel; also saved to report.json, for Lumi
    # Assist and the like), with each day's cost by project too.
    report = "--report" in sys.argv[1:]
    home = os.path.expanduser("~")
    usage = os.path.join(home, ".cache", "lumiherd", "usage")
    try:
        with open(os.path.join(usage, "claude.json")) as f:
            saved = json.load(f)
        # "bedrock": what status lines from before other kinds of billing wrote.
        plan = saved.get("api") or ("Bedrock" if saved.get("bedrock") else None)
    except (OSError, ValueError, AttributeError):
        plan = None
    if not plan and not report:
        return
    os.makedirs(usage, exist_ok=True)
    store = os.path.join(usage, "api-cost-cache.json")
    try:
        with open(store) as f:
            saved = json.load(f)
        cache = saved["files"] if saved.get("v") == VERSION else {}
    except (OSError, ValueError, KeyError):
        cache = {}
    now = datetime.datetime.now()
    days = [(now - datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(DAYS - 1, -1, -1)]
    # A resumed chat copies its history into a new file: one count per call across files.
    files = scan(os.path.join(home, ".claude", "projects"), now.timestamp() - (DAYS + 1) * 86400, cache)
    # Each call with its session's project; a subagent's (<session>/subagents/x.jsonl) is
    # its session's.
    calls = {}
    for p, f in files.items():
        cwd = f[2]["cwd"]
        if os.path.basename(os.path.dirname(p)) == "subagents":
            parent = files.get(os.path.dirname(os.path.dirname(p)) + ".jsonl")
            cwd = (parent and parent[2]["cwd"]) or cwd
        pr = project_name(cwd)
        for k, v in f[2]["calls"].items():
            calls[k] = v + [pr]
    by_day = {d: {} for d in days}
    by_project = {d: {} for d in days}
    for day, name, c, *rest in calls.values():
        if day in by_day:
            by_day[day][name] = by_day[day].get(name, 0) + c
            pr = rest[0] if rest else "?"
            by_project[day][pr] = by_project[day].get(pr, 0) + c
    tmp = f"{store}.{os.getpid()}"
    try:
        with open(tmp, "w") as f:
            json.dump({"v": VERSION, "files": files}, f, separators=(",", ":"))
        os.replace(tmp, store)
    except OSError:
        pass
    out = {"plan": plan, "days": [{"day": d, "models": {n: round(c, 6) for n, c in by_day[d].items()}} for d in days]}
    if report:
        for row in out["days"]:
            row["projects"] = {n: round(c, 6) for n, c in by_project[row["day"]].items()}
        out = {"at": int(now.timestamp()), "estimate": "tokens at list prices, not a bill", **out}
        tmp = os.path.join(usage, f"report.json.{os.getpid()}")
        try:
            with open(tmp, "w") as f:
                json.dump(out, f, separators=(",", ":"))
            os.replace(tmp, os.path.join(usage, "report.json"))
        except OSError:
            pass
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
