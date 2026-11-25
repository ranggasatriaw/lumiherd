#!/usr/bin/env python3
# What the sidebar shows under each omp (oh-my-pi) agent, read from omp's own files:
#   the omp process's HC_TERMINAL_ID      which Herdr terminal it runs in
#   ~/.omp/agent/sessions/*/<start>_<id>.jsonl
#                                         its session: the one named after the moment
#                                         the process started (else the newest for its
#                                         folder); the last model_change and
#                                         thinking_level_change, and the last reply's
#                                         tokens and time
#   ~/.omp/agent/models.db                the model's name and context window
# Prints one JSON object keyed by terminal, in the fields claude-info.py uses
# ({model, id, effort, context, lastAt, cacheUntil, transcript}). Python 3, standard
# library (sqlite3).
import glob, json, os, re, sqlite3, subprocess, sys, time
from datetime import datetime, timezone

HOME = os.path.expanduser("~/.omp/agent")
NAME = re.compile(r"^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z_")


def omp_procs():
    # pid, seconds since it started, for every process whose program is omp.
    try:
        out = subprocess.run(["ps", "-axo", "pid=,etime=,comm="], capture_output=True, text=True, timeout=5).stdout
    except Exception:
        return []
    procs = []
    for line in out.splitlines():
        parts = line.split(None, 2)
        if len(parts) == 3 and os.path.basename(parts[2].strip()) == "omp":
            procs.append((int(parts[0]), elapsed(parts[1])))
    return procs


def elapsed(s):
    # ps etime: [[dd-]hh:]mm:ss
    days, _, rest = s.rpartition("-")
    nums = [int(x) for x in rest.split(":")]
    while len(nums) < 3:
        nums.insert(0, 0)
    return (int(days) if days else 0) * 86400 + nums[0] * 3600 + nums[1] * 60 + nums[2]


def env_of(pid, key):
    try:
        out = subprocess.run(["ps", "eww", "-o", "command=", "-p", str(pid)], capture_output=True, text=True, timeout=5).stdout
    except Exception:
        return None
    m = re.search(r"(?:^|\s)" + key + r"=(\S+)", out)
    return m.group(1) if m else None


def cwd_of(pid):
    try:
        out = subprocess.run(["lsof", "-a", "-p", str(pid), "-d", "cwd", "-Fn"], capture_output=True, text=True, timeout=5).stdout
    except Exception:
        return None
    for line in out.splitlines():
        if line.startswith("n"):
            return line[1:]
    return None


def started(path):
    m = NAME.match(os.path.basename(path))
    if not m:
        return None
    d, hh, mm, ss, ms = m.groups()
    return datetime.fromisoformat(f"{d}T{hh}:{mm}:{ss}.{ms}+00:00").timestamp()


def header_cwd(path):
    try:
        with open(path) as f:
            for _ in range(5):
                d = json.loads(f.readline() or "{}")
                if d.get("type") == "session":
                    return d.get("cwd")
    except Exception:
        pass
    return None


def session_of(start, cwd, files):
    # The session named after this process's start (it writes one as it starts);
    # after /resume, the newest one for its folder.
    near = [(abs(started(f) - start), f) for f in files if started(f) is not None and abs(started(f) - start) < 20]
    if near:
        return min(near)[1]
    mine = [f for f in files if cwd and header_cwd(f) == cwd]
    return max(mine, key=os.path.getmtime) if mine else None


def windows():
    out = {}
    try:
        db = sqlite3.connect(f"file:{HOME}/models.db?mode=ro", uri=True)
        for prov, models in db.execute("select provider_id, models from model_cache"):
            try:
                for m in json.loads(models):
                    out[f"{prov}/{m.get('id')}"] = (m.get("name") or m.get("id"), m.get("contextWindow"))
            except Exception:
                continue
        db.close()
    except Exception:
        pass
    return out


def read(path, models):
    info = {"model": None, "id": None, "effort": None, "ultracode": False, "lastAt": None, "context": None,
            "cacheUntil": None, "transcript": path}
    model = None
    last = None
    with open(path) as f:
        for line in f:
            if '"model_change"' not in line and '"thinking_level_change"' not in line and '"assistant"' not in line:
                continue
            try:
                d = json.loads(line)
            except Exception:
                continue
            if d.get("type") == "model_change":
                model = d.get("model")
            elif d.get("type") == "thinking_level_change" and d.get("thinkingLevel"):
                info["effort"] = d["thinkingLevel"]
            elif (d.get("message") or {}).get("role") == "assistant":
                last = d
    if last:
        m = last["message"]
        if m.get("provider") and m.get("model"):
            model = f"{m['provider']}/{m['model']}"
        try:
            info["lastAt"] = datetime.fromisoformat(last["timestamp"].replace("Z", "+00:00")).timestamp()
        except Exception:
            pass
    if model:
        name, window = models.get(model, (model.split("/", 1)[-1], None))
        info["id"] = model
        info["model"] = re.sub(r"^glm", "GLM", name)
        u = (last or {}).get("message", {}).get("usage") or {}
        used = u.get("totalTokens") or sum(u.get(k) or 0 for k in ("input", "output", "cacheRead", "cacheWrite"))
        if window and last:
            info["context"] = round(used * 100 / window)
    return info


def main():
    found = {}
    procs = omp_procs()
    if procs:
        files = glob.glob(os.path.join(HOME, "sessions", "*", "*.jsonl"))
        models = windows()
        now = time.time()
        for pid, age in procs:
            term = env_of(pid, "HC_TERMINAL_ID")
            if not term or not re.fullmatch(r"[A-Za-z0-9_.-]+", term):
                continue
            path = session_of(now - age, cwd_of(pid), files)
            if not path:
                continue
            try:
                found[term] = read(path, models)
            except Exception:
                continue
    json.dump(found, sys.stdout, separators=(",", ":"))


main()
