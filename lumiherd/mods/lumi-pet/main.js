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
import { theme, agents, run, exec, appHome } from "herdr";
// A copy of lumiherd's (mods can't import from each other): an agent's name from its title.
import { agentTask } from "./agent-name.js";

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
const EVERY = 120000;

// The agent's name: a tab named by hand, else its session's title, else its space.
function name(a) {
  const tab = a.tab_name ?? "";
  if (tab && tab !== a.program?.name && !/^(\d+|t[0-9a-z]+)$/.test(tab)) return tab;
  return agentTask(a, null) || a.space_name || "agen";
} // a new line this often while the state stays

export default class LumiPet extends View {
  init(_props, cx) {
    // Which poses are animated: a .webp beside the .png.
    this.animated = new Set();
    cx.spawn(async (cx) => {
      for (const p of POSES) {
        const r = await exec("test", ["-f", `${appHome()}/mods/lumi-pet/${p}.webp`]).catch(() => null);
        if (r?.code === 0) this.animated.add(p);
      }
      cx.notify();
    });
    // agents() changes on its own; this only redraws when what she shows or says does.
    cx.timer.every(1500, (cx) => {
      const s = this.state();
      const key = JSON.stringify([s.pose, s.count, s.space, Math.floor(Date.now() / EVERY)]);
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
    // The bubble: rounded, its corner toward Lumi kept small, with a dot trailing to her.
    const bubble = h_flex().items_end().gap(3)
      .child(div().max_w(170).px(10).py(7).rounded(12).rounded_br(3).bg(t.background).border_1().border_color(s.pose === "blocked" ? color : t.border)
        .text_size(11.5).line_height("15px").text_color(t.foreground).whitespace_normal().child(this.line(s)))
      .child(div().size(5).mb(2).rounded(3).bg(t.background).border_1().border_color(t.border));
    return h_flex().id("lumi-pet").size_full().pl(10).pr(6).gap(2).items_end().justify_end()
      .when(Boolean(s.to), (el) => el.cursor_pointer().on_click(() => run("agent.focus", { terminal: s.to })))
      .child(v_flex().flex_1().min_w(0).pb(SIZE / 2 - 4).items_end().child(bubble))
      .child(image(file).w(SIZE).h(SIZE).flex_none());
  }
}
