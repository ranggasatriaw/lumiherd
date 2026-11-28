# Lumiherd

Rangga's layout and mods for Herdr.app. It runs on his Mac and on Hyperion (his
Windows PC), so every change has to work on both.

## Language
- **Talking to Rangga** (chat, PR descriptions): Bahasa Indonesia, keeping
  technical terms in English as they are (branch, merge, panel, cache, …).
- **English** for everything else: UI labels, code, identifiers, comments,
  commit messages, PR titles, data files and keys, and anything one agent writes
  for another (prompts, messages to peer sessions, handoff notes).
- Name UI in English first, even when the idea came up in Indonesian: the
  panel Rangga first heard of as "Laporan" shipped as "Usages".

## Subagents and second opinions (this project)
- Whoever orchestrates or plans may dispatch **Sonnet or Haiku** subagents:
  the smallest that fits (Haiku for lookups and mechanical edits, Sonnet for
  code and reviews).
- Higher models (Fable, Opus) are **only** for a second opinion or advice,
  and **only when Rangga asks** for one in this project.
- A second opinion or review from another vendor: Codex (`gpt-6.1-sol`) or GLM
  (`zai/glm-5.4` through omp), at the lowest effort that fits. Launch it through
  herdr-core so it shows in Herdr, then read its answer:
  - `hc run --bg --no-notify --name secondop-codex --label task="Codex: <topic>" --cwd <repo> -- codex exec -m gpt-6.1-sol -c model_reasoning_effort=<low|high> -s read-only -o <out.md> "<prompt>"`
  - `hc run --bg --no-notify --name secondop-glm --label task="GLM: <topic>" --cwd <repo> -- omp -p --model zai/glm-5.4 --thinking <low|high> "<prompt>"`
  - `hc wait <name>`, read the answer (`out.md`, or `hc read <name>`), then `hc rm <name>`.
  - Verify what it finds before acting on it.

## Layout of the repo
- `lumiherd/mods/<mod>/main.js`: one mod per folder: the sidebar (`lumiherd`),
  `lumiherd-usage` (sidebar usage rows), `lumiherd-usages` (Usages panel),
  `lumiherd-tasks`, `lumiherd-servers`, `lumi-pet`, `lumiherd-tabs` (tab bar and
  panel buttons), `lumiherd-options` (Options and Help), and more.
- `lumiherd/layouts/lumiherd.json`: the blocks. The right panel is the
  `panel-body` stack; each panel is a block in it.
- `pasang.sh` / `pasang.ps1`: copy layouts and mods into `~/.config/herdr-app`;
  Herdr reloads them live.
- How it all works: `lumiherd/RECIPE.md`.

## Writing a mod
- No `setTimeout`: use `cx.spawn` with `cx.sleep`, or `cx.timer.every`.
- Mods talk through `shared` / `setShared` (`sidebar.options`, `lumiherd.usage`,
  `lumiherd.contexts`, `lumiherd.private`, …).
- A new panel needs: a block in the layout, a button in `lumiherd-tabs`, a
  switch in `lumiherd-options` (`DEFAULTS` and `PANEL_ITEMS`) and a topic in
  `lumiherd-options/help.js`.
- Privacy mode (`lumiherd.private`, the eye in the brand row): names, folders
  and task text are swapped for aliases. New text that shows a name or a path
  has to follow it.
- Commands on another machine: `exec(cmd, args, { on: machine })`.

## Comments
- The header of a mod (what it shows, where its data comes from) is its
  documentation: keep it true when the mod changes.
- Elsewhere, a comment only for a "why" the code can't say: an outside
  constraint (Windows, a Herdr quirk, a safety rule).
- No history ("was X, now Y"), no restating the code, no notes to yourself.
- A comment that excuses a pattern others could copy (a timer, a workaround)
  means the rule belongs in `check.sh` or in a helper, not in a comment.

## Windows (Hyperion, `ssh hyperion`)
- Run PowerShell from a `.ps1` copied over with scp: inline quoting through cmd
  breaks.
- PowerShell 5 `Set-Content` writes a BOM: strip it before Herdr reads the JSON.
- PowerShell 5 drops the quotes in JSON passed to a program: escape them with
  `-replace '"','\"'`.
- There is no `test` or `ps`: use `Test-Path`. Python is `python`, not
  `python3`; try both.
- gh reads Windows Credential Manager, which an SSH session can't: it looks
  signed out over SSH but works in a desktop terminal (an `hc` one).

## Safety
- Servers panel: Stop only for a dev server running inside the Projects folder
  (`~/Code` by default). Never Docker, databases, or Hermes (`~/.hermes`).
- Keys (Z.ai and others) go through stdin or a file, never in argv or output.

## Testing
- `./check.sh` before every pull request (CI runs it too). When an agent makes
  the same mistake twice, add a check there instead of another line here.
- `./shot.sh [right|left|full]` to see a change: it hides the small shell
  (it can show secrets), crops, and deletes shots after 10 minutes. Not a raw
  `herdr-app shot`.
- After a merge, install on the Mac and on Hyperion (`git pull` there too).
