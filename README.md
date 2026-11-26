# Lumiherd

Rangga's Herdr app layout: every project and agent in one sidebar, a Timeline,
the agents' tasks, usage, Lumi (a chibi pet who shows how the agents are doing),
a small shell, a launcher and a Ctrl+Tab switcher.

Forked from [Over9k](https://github.com/herunan/herdr-over9k) (MIT, by the Over9k
authors) at `193e9cc`, renamed and maintained here on its own. What it does and how
it's built: [lumiherd/RECIPE.md](lumiherd/RECIPE.md).

## Install

```sh
./pasang.sh
herdr-app do layout.switch '{"name":"lumiherd"}'
```

On Windows (no rsync), from PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File pasang.ps1
herdr-app do layout.switch '{"name":"lumiherd"}'
```

`pasang.sh` copies `lumiherd/layouts` and `lumiherd/mods` into `~/.config/herdr-app`
and runs `herdr-app check` on each mod. Its keys (`lumiherd/keys.macos.json`) are
not merged automatically.

Under the right panel sits a small shell that stays the same whichever tab is open:
the terminal named `lumi-shell`, which `pasang.sh` starts when it isn't running.
`exit` gives a fresh shell. Herdr removes the block from the layout if that terminal
is removed (`hc rm lumi-shell`); run `pasang.sh` again to bring both back.

Agents show as **Imul**, Lumi's little robot cat: one helmet colour per agent
(Claude terracotta, Codex blue, omp purple), from `lumiherd/imul/` through Herdr's
`programs.json`. `pasang.sh` writes that file only when you have none; to keep your
own, add its three entries to yours.

The Tasks panel lists the tasks of the agent you're in, as the Claude Code plugin
[plan-progress](https://github.com/zycck/claude-mods) (MIT) keeps them: install it in
Claude Code (`/plugin marketplace add zycck/claude-mods`, then
`/plugin install plan-progress@zycck-mods`). Without it the panel says so.

The Files panel is [Herdr-Roundup](https://github.com/carstenlucke/herdr-roundup)'s
`roundup-files` (Apache-2.0), which opens files in its `roundup-preview`. Those two mods
are not in this repo: copy them from Roundup's `mods/` into `~/.config/herdr-app/mods`.
`pasang.sh` warns when they are missing.

The PRs panel is [Branch PR](https://github.com/munza/herdr-mods/tree/main/branch-pr)
(Apache-2.0): build and install it from its repo (`go -C branch-pr/helper run ./install`, needs Go
and a signed-in `gh`). The PRs button shows only when `mods/branch-pr` is installed.

The Changes panel is [Better Changes](https://github.com/munza/herdr-mods/tree/main/better-changes)
(Apache-2.0; copy its `mods/better-changes` into `~/.config/herdr-app/mods`), with
[Better Icons](https://github.com/munza/herdr-mods/tree/main/better-icons) for file icons.

Over9k changes: `git fetch over9k` (the remote is named `over9k`, not `upstream`, so PR tools treat this repo as its own), then cherry-pick what's wanted (paths
differ: `over9k/` there is `lumiherd/` here).
