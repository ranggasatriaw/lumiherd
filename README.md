# Lumiherd

Rangga's Herdr app layout: every project and agent in one sidebar, a Timeline,
agentic to-dos, usage, a launcher and a Ctrl+Tab switcher.

Forked from [Over9k](https://github.com/herunan/herdr-over9k) (MIT, by the Over9k
authors) at `193e9cc`, renamed and maintained here on its own. What it does and how
it's built: [lumiherd/RECIPE.md](lumiherd/RECIPE.md).

## Install

```sh
./pasang.sh
herdr-app do layout.switch '{"name":"lumiherd"}'
```

`pasang.sh` copies `lumiherd/layouts` and `lumiherd/mods` into `~/.config/herdr-app`
and runs `herdr-app check` on each mod. Its keys (`lumiherd/keys.macos.json`) are
not merged automatically.

The Files panel is [Herdr-Roundup](https://github.com/carstenlucke/herdr-roundup)'s
`roundup-files` (Apache-2.0), which opens files in its `roundup-preview`. Those two mods
are not in this repo: copy them from Roundup's `mods/` into `~/.config/herdr-app/mods`.
`pasang.sh` warns when they are missing.

Upstream changes: `git fetch upstream`, then cherry-pick what's wanted (paths
differ: `over9k/` there is `lumiherd/` here).
