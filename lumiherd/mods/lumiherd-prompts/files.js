// The Timeline's Files view: every file an agent changed, from the prompts the
// panel already has (newest first, each with the files it changed).

// One row per file, newest first: its name, its folder (~ for home; Windows
// paths keep their backslashes), when its newest prompt finished (or started,
// while it runs), and that prompt's index in `prompts`.
export function filesOf(prompts, home) {
  const seen = new Map();
  prompts.forEach((p, i) => {
    for (const path of p.edits ?? []) {
      if (seen.has(path)) continue;
      const name = path.split(/[\\/]/).pop();
      const dir = path.slice(0, Math.max(0, path.length - name.length - 1));
      const under = home && (dir === home || dir.startsWith(home + "/") || dir.startsWith(home + "\\"));
      seen.set(path, { path, name, folder: under ? `~${dir.slice(home.length)}` : dir, at: p.done ?? p.at, prompt: i });
    }
  });
  return [...seen.values()];
}

// "now", "45m", "3h", "3d".
export function ago(iso, now = Date.now()) {
  const s = (now - Date.parse(iso)) / 1000;
  if (isNaN(s)) return "";
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
