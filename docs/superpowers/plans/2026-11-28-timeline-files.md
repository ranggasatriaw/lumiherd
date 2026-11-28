# Timeline Files View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Timeline panel gets a `Files` view next to `Prompts`: every file the agent changed, once each, newest first; a click opens the prompt that last changed it.

**Architecture:** A small pure module (`lumiherd-prompts/files.js`) turns the prompts the panel already has (each with `edits`) into file rows; `main.js` adds the header toggle, the Files list and its keyboard. Tests run with `node --test`, added to `check.sh`.

**Tech Stack:** Herdr mod JavaScript (gpui-kit / gpui-base), Node 22+ `node:test` for the pure module.

**Spec:** `docs/superpowers/specs/2026-11-28-timeline-files-design.md`

## Global Constraints

- English for UI labels, code, comments, commit messages (AGENTS.md).
- No `setTimeout`/`setInterval` in mods (check.sh enforces).
- The mod header comment of `lumiherd-prompts/main.js` stays true: it must describe the Files view.
- The Timeline's Help topic (`lumiherd-options/help.js`, `topic("Timeline", …)`) mentions the Files view.
- Windows paths (backslashes) split into name and folder correctly.
- A newly followed agent starts on the Prompts view.
- Run `./check.sh` before the PR; see changes with `./shot.sh right`.

## Review Focus

- A file changed in several prompts: listed once, with the newest prompt's time and index.
- Windows path `C:\Users\rangg\dev\x\main.js` with home `C:\Users\rangg`: name `main.js`, folder `~\dev\x`.
- A file outside home (`/tmp/a.txt`): folder shown as the full folder, no `~`.
- A prompt still running (`done` null): its files use the prompt's `at` as time.
- Clicking a file whose prompt is beyond the cards drawn (`shown`, 100): `shown` grows so the card exists before it is opened.

---

### Task 1: `filesOf` and `ago` in a testable module

**Files:**
- Create: `lumiherd/mods/lumiherd-prompts/files.js`
- Create: `tests/prompts-files.test.mjs`
- Modify: `check.sh` (run `node --test tests/` before the final line; a failure sets `fail=1` with `bad "node tests failed"`)

**Interfaces:**
- Produces:
  - `filesOf(prompts: Array<{at: string, done: string|null, edits: string[]}>, home: string) -> Array<{path, name, folder, at, prompt}>` — `prompts` newest first (as `this.prompts` is); `prompt` is the index in that array of the newest prompt that changed the file; `at` is that prompt's `done ?? at`; rows in the order first met (so newest first).
  - `ago(iso: string, now: number = Date.now()) -> string` — `"now"` under 60 s, `"Nm"` under 1 h, `"Nh"` under 24 h, else `"Nd"`; `""` for an invalid date.

- [ ] **Step 1: Write the failing tests** in `tests/prompts-files.test.mjs` (`import { test } from "node:test"; import assert from "node:assert/strict"; import { filesOf, ago } from "../lumiherd/mods/lumiherd-prompts/files.js";`):
  - `once per file, newest prompt wins`: prompts `[{at:"2026-11-28T10:00:00Z",done:"2026-11-28T10:05:00Z",edits:["/Users/r/Code/a/x.js"]},{at:"2026-11-28T09:00:00Z",done:"2026-11-28T09:01:00Z",edits:["/Users/r/Code/a/x.js","/Users/r/Code/a/y.js"]}]`, home `/Users/r` → paths `["/Users/r/Code/a/x.js","/Users/r/Code/a/y.js"]`, x's `prompt` 0 and `at` `"2026-11-28T10:05:00Z"`, y's `prompt` 1.
  - `name and folder with ~`: `/Users/r/Code/a/x.js` → name `x.js`, folder `~/Code/a`.
  - `windows path`: `C:\Users\rangg\dev\x\main.js`, home `C:\Users\rangg` → name `main.js`, folder `~\dev\x`.
  - `outside home`: `/tmp/a.txt`, home `/Users/r` → folder `/tmp`.
  - `running prompt uses at`: `{at:"2026-11-28T10:00:00Z",done:null,edits:["/Users/r/z"]}` → `at` `"2026-11-28T10:00:00Z"`.
  - `ago`: with `now = Date.parse("2026-11-28T12:00:00Z")`: `"2026-11-28T11:59:30Z"` → `"now"`, `"2026-11-28T11:15:00Z"` → `"45m"`, `"2026-11-28T09:00:00Z"` → `"3h"`, `"2026-11-25T12:00:00Z"` → `"3d"`, `"nope"` → `""`.

- [ ] **Step 2: Run** `node --test tests/` — Expected: FAIL (cannot find module `files.js`).

- [ ] **Step 3: Implement `filesOf` and `ago`** in `files.js` (ES module, `export function`). Split on `/[\\/]/`; folder is the path minus `/` or `\` + name; `~` replaces `home` when the folder equals home or starts with home plus a separator.

- [ ] **Step 4: Run** `node --test tests/` — Expected: all pass. Then add the `node --test tests/` line to `check.sh` and run `./check.sh` — Expected: `All checks passed`.

- [ ] **Step 5: Commit** `files.js`, the test, `check.sh`: "Timeline: files an agent changed, once each (files.js), with node tests in check.sh".

### Task 2: The Files view in the Timeline panel

**Files:**
- Modify: `lumiherd/mods/lumiherd-prompts/main.js` (header comment lines 1–13; `init`; `follow` line 93; `render` header lines 209–217 and body lines 218–225; `on_key_down` lines 199–208)
- Modify: `lumiherd/mods/lumiherd-options/help.js` (`topic("Timeline", …)`, line ~293)

**Interfaces:**
- Consumes: `filesOf(prompts, home)`, `ago(iso)` from `./files.js`.
- State: `this.view` (`"prompts" | "files"`, starts `"prompts"`, reset to `"prompts"` in `follow` when the agent changes); `this.fileAt` (keyboard row in Files, starts 0, reset with the agent).

- [ ] **Step 1: Header toggle.** Replace the `Timeline` title and the `N prompts` badge with two toggles in the style of the sidebar's `by()` (`lumiherd/mods/lumiherd/main.js:2452`: h 18, px 6, rounded 4, selected `bg(t.raised)` and `t.foreground`, else `t.dim`): `Prompts N` and `Files N` (N = `all.length` and `files.length`; N left out when 0). Ids `timeline-view-prompts` / `timeline-view-files`. Agent name and `↓ … · context …` stay to the right.

- [ ] **Step 2: Files list.** When `this.view === "files"`, the scroll area (same privacy gate as today) shows one row per file: `h_flex`, id `file-${i}`, h 30, px 10, rounded 7, gap 8; name (`t.foreground`, flex_none, truncate), folder (`t.dim`, flex_1, min_w 0, truncate, text 11), `ago(f.at)` (`t.dim`, flex_none, text 11); picked row (`this.fileAt`) `bg(t.raised)`, hover `t.hover`. Empty: note `No files changed yet`.

- [ ] **Step 3: Click and Enter on a file** → `this.view = "prompts"; this.shown = Math.max(this.shown ?? SHOWN, f.prompt + 1); this.at = this.open = f.prompt;` then focus and `cx.notify()`. In the Files view ↑/↓ move `this.fileAt`; Esc does nothing there.

- [ ] **Step 4: Docs.** Header comment: add a sentence that the header picks Prompts or Files, and what Files lists and what a click does. Help topic: add `line(key("Files"), "Every file it changed, newest first; click for the prompt")`.

- [ ] **Step 5: Verify.** `./check.sh` → `All checks passed`. `./pasang.sh`, open the Timeline on this agent, `./shot.sh right`: header shows `Prompts N` / `Files N`; Files lists `main.js`, `handoff.sh`… with folders; clicking one opens its prompt card. Switch to another agent: view is back on Prompts.

- [ ] **Step 6: Commit** `main.js`, `help.js`: "Timeline: a Files view, every file the agent changed".
