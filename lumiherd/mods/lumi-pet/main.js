// Lumi, a chibi pet at the bottom of the sidebar (above the usage), standing on the
// sidebar itself with no card, who shows how the agents are doing at a glance:
//   one needs you        waving, with "!"         (the most urgent wins)
//   one finished unseen  cheering
//   one is working       typing on a laptop
//   all idle             asleep
// Beside her, a speech bubble says it casually, naming the agent as the sidebar does
// (its tab's name, else its session's title, else its space: "Psst, FastrHR
// Planner nungguin jawabanmu!"); its line changes with the state and every
// couple of minutes. A click goes to that agent. Pictures: <pose>.webp next to
// this file when there is one (a looping animation), else <pose>.png.

import { View, div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, agents, run, exec, appHome, window, shared } from "herdr";
// A copy of lumiherd's (mods can't import from each other): an agent's name from its title.
import { agentTask } from "./agent-name.js";
// Whether a file is there: `test -f`, or on Windows (no `test`) PowerShell's Test-Path.
const isFile = (path) => (window()?.platform === "windows"
  ? exec("powershell", ["-NoProfile", "-Command", `if (Test-Path -LiteralPath '${path.replace(/'/g, "''")}') { exit 0 } else { exit 1 }`])
  : exec("test", ["-f", path])).then((r) => r?.code === 0, () => false);

const SIZE = 96;
const POSES = ["blocked", "working", "done", "idle"];
// {s}: the agent's space; {n}: how many. "one" lines for a single agent, "many" for more.
const LINES = {
  blocked: {
    one: ["Psst, {s} nungguin jawabanmu!", "Hei~ {s} butuh kamu sebentar", "{s} lagi nanya tuh, cek yuk!"],
    many: ["{n} agen nungguin kamu nih!", "Ada {n} yang nanya, yuk dicek~"],
  },
  done: {
    one: ["Yeay, {s} udah beres!", "{s} selesai~ cek hasilnya yuk", "Beres! {s} siap kamu lihat"],
    many: ["{n} agen udah beres, mantap!", "Yeay, {n} kerjaan selesai~"],
  },
  working: {
    one: ["{s} lagi ngerjain, aku temenin ya", "Sstt… {s} lagi fokus", "Semangat, {s}!"],
    many: ["{n} agen lagi sibuk~", "Rame nih, {n} agen kerja bareng", "Aku pantau {n} agen ya"],
  },
  idle: { one: ["Sepi… aku bobo dulu ya", "Zzz… bangunin kalau butuh", "Lagi santai, belum ada kerjaan"] },
};
const EVERY = 120000; // a new line this often while the state stays
// In the game look (Options › Usage › Game style) she also watches the points: a limit
// at 20 or less (HP the weekly one, SP the 5-hour one, KO at 0) or an agent's MP (the
// context left) at 25 or less. She says each once, for SHOW ms, when it starts (while
// agents work or rest); not again until it has recovered and dropped again. A limit can
// only be waited out, so it mustn't sit in her bubble. What she has said is kept
// (localStorage "lumi.told"), so a restart doesn't repeat it.
const LOW = 20, LOW_MP = 25, SHOW = 30000;
const until = (at) => {
  const s = Math.max(0, at - Date.now() / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h >= 24 ? `${Math.floor(h / 24)}h ${h % 24}j` : h ? `${h}j ${m}m` : `${m}m`;
};

// The agent's name: a tab named by hand, else its session's title, else its space.
function name(a) {
  const tab = a.tab_name ?? "";
  if (tab && tab !== a.program?.name && !/^(\d+|t[0-9a-z]+)$/.test(tab)) return tab;
  return agentTask(a, null) || a.space_name || "agen";
}

export default class LumiPet extends View {
  init(_props, cx) {
    // Which poses are animated: a .webp beside the .png.
    this.animated = new Set();
    cx.spawn(async (cx) => {
      for (const p of POSES) {
        if (await isFile(`${appHome()}/mods/lumi-pet/${p}.webp`)) this.animated.add(p);
      }
      cx.notify();
    });
    try { this.told = JSON.parse(localStorage.getItem("lumi.told") ?? "{}") ?? {}; } catch { this.told = {}; }
    this.warn = this.warning();
    // agents() changes on its own; this only redraws when what she shows or says does.
    cx.timer.every(1500, (cx) => {
      const s = this.state();
      this.warn = this.warning();
      const key = JSON.stringify([s.pose, s.count, s.space, Math.floor(Date.now() / EVERY), this.warn?.text]);
      if (key !== this.last) { this.last = key; cx.notify(); }
    });
  }

  // The most urgent state among the agents, how many are in it, and the one to go to.
  state() {
    const list = agents() ?? [];
    for (const s of ["blocked", "done", "working"]) {
      const these = list.filter((a) => a.status === s).sort((x, y) => (y.seq ?? 0) - (x.seq ?? 0));
      if (these.length) return { pose: s, count: these.length, to: these[0].address, space: name(these[0]) };
    }
    return { pose: "idle", count: 0, to: null, space: null };
  }

  // What's running low and new, most urgent first: a KO, HP, SP, then the agent with
  // least MP. Each is shown for SHOW ms from when it started, then left alone until it
  // recovers. Null when there's nothing to say (or the game look is off).
  warning() {
    if ((shared("sidebar.options") ?? {}).game === false) return null;
    const now = Date.now(), out = [];
    for (const s of shared("lumiherd.usage") ?? []) {
      for (const l of s.limits ?? []) {
        const pts = 100 - l.used, hp = /^7d/.test(l.label), sp = /^5h/.test(l.label);
        if (!(hp || sp) || pts > LOW) continue;
        if (hp && pts <= 0) out.push({ key: `ko:${s.key}`, rank: 0, text: `${s.name} KO! Bangkit lagi ${l.at ? `${until(l.at)} lagi` : "nanti"}`, danger: true });
        else if (hp) out.push({ key: `hp:${s.key}`, rank: 1, text: `HP ${s.name} tinggal ${pts}, hemat-hemat ya~`, danger: true });
        else out.push({ key: `sp:${s.key}`, rank: 2, text: `Shield ${s.name} tinggal ${pts}, rehat dulu ${l.at ? until(l.at) : "sebentar"}?`, danger: false });
      }
    }
    const ctx = shared("lumiherd.contexts") ?? {};
    for (const a of agents() ?? []) {
      const mp = ctx[a.address] != null ? 100 - ctx[a.address] : null;
      if (mp != null && mp <= LOW_MP) out.push({ key: `mp:${a.address}`, rank: 3, mp, text: `MP ${name(a)} tinggal ${mp}, mau di-heal?`, danger: mp <= 10, to: a.address });
    }
    // When each started; one that's gone (recovered) is forgotten, so it can come again.
    const live = new Set(out.map((w) => w.key));
    let changed = false;
    for (const k of Object.keys(this.told ?? {})) if (!live.has(k)) { delete this.told[k]; changed = true; }
    for (const w of out) if (!(w.key in this.told)) { this.told[w.key] = now; changed = true; }
    if (changed) { try { localStorage.setItem("lumi.told", JSON.stringify(this.told)); } catch {} }
    return out.filter((w) => now - this.told[w.key] < SHOW).sort((x, y) => x.rank - y.rank || (x.mp ?? 0) - (y.mp ?? 0))[0] ?? null;
  }

  line({ pose, count, space }) {
    const set = LINES[pose];
    const list = count > 1 && set.many ? set.many : set.one;
    const pick = list[(Math.floor(Date.now() / EVERY) + count) % list.length];
    return pick.replace("{s}", space ?? "").replace("{n}", String(count));
  }

  render(cx) {
    const t = theme();
    const s = this.state();
    const color = s.pose === "blocked" ? t.blocked : s.pose === "working" ? t.working : s.pose === "done" ? t.done ?? t.ansi2 : t.dim;
    const file = `mods/lumi-pet/${s.pose}.${this.animated?.has(s.pose) ? "webp" : "png"}`;
    // While nobody needs you and nothing just finished, every other line is a warning.
    const warn = s.pose === "working" || s.pose === "idle" ? this.warn : null;
    const said = warn ? warn.text : this.line(s), to = warn?.to ?? s.to;
    // The bubble: rounded, its corner toward Lumi kept small, with a dot trailing to her.
    // It shrinks with a narrow sidebar (the words wrap) instead of running off its edge.
    const bubble = h_flex().w_full().min_w(0).justify_end().items_end().gap(3)
      .child(div().min_w(0).flex_shrink(1).max_w(170).px(10).py(7).rounded(12).rounded_br(3).bg(t.background)
        .border_1().border_color(warn ? (warn.danger ? t.ansi1 : t.ansi3) : s.pose === "blocked" ? color : t.border)
        .text_size(11.5).line_height("15px").text_color(t.foreground).whitespace_normal().child(said))
      .child(div().size(5).mb(2).rounded(3).bg(t.background).border_1().border_color(t.border));
    return h_flex().id("lumi-pet").size_full().pl(10).pr(6).gap(2).items_end().justify_end()
      .when(Boolean(to), (el) => el.cursor_pointer().on_click(() => run("agent.focus", { terminal: to })))
      .child(v_flex().flex_1().min_w(0).pb(SIZE / 2 - 4).child(bubble))
      .child(image(file).w(SIZE).h(SIZE).flex_none());
  }
}
