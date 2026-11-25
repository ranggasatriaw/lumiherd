// Lumi, a chibi pet at the bottom of the sidebar (above the usage), standing on the
// sidebar itself with no card, who shows how the agents are doing at a glance:
//   one needs you        waving, with "!"         (the most urgent wins)
//   one finished unseen  cheering
//   one is working       typing on a laptop
//   all idle             asleep
// Beside her, a word on it ("2 kerja"). A click goes to that agent. Pictures:
// <pose>.webp next to this file when there is one (a looping animation), else
// <pose>.png (Lumiherd's icon character, drawn chibi).

import { View, div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, agents, run, exec, appHome } from "herdr";

const SIZE = 96;
const POSES = ["blocked", "working", "done", "idle"];
const WORDS = { blocked: "nungguin kamu", working: "kerja", done: "selesai", idle: "tidur" };

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
    // agents() changes on its own; this only notices when the pose or count does.
    cx.timer.every(1500, (cx) => {
      const key = JSON.stringify(this.state());
      if (key !== this.last) { this.last = key; cx.notify(); }
    });
  }

  // The most urgent state among the agents, how many are in it, and the one to go to.
  state() {
    const list = agents() ?? [];
    for (const s of ["blocked", "done", "working"]) {
      const these = list.filter((a) => a.status === s);
      if (these.length) return { pose: s, count: these.length, to: these[0].address };
    }
    return { pose: "idle", count: 0, to: null };
  }

  render(cx) {
    const t = theme();
    const { pose, count, to } = this.state();
    const color = pose === "blocked" ? t.blocked : pose === "working" ? t.working : pose === "done" ? t.done ?? t.ansi2 : t.dim;
    const word = pose === "idle" ? WORDS.idle : `${count > 1 ? `${count} ` : ""}${WORDS[pose]}`;
    const file = `mods/lumi-pet/${pose}.${this.animated?.has(pose) ? "webp" : "png"}`;
    return h_flex().id("lumi-pet").size_full().px(10).gap(6).items_end().justify_end()
      .when(Boolean(to), (el) => el.cursor_pointer().on_click(() => run("agent.focus", { terminal: to })))
      .child(v_flex().flex_1().min_w(0).pb(10).items_end()
        .child(div().text_size(11).font_semibold().text_color(color).child(word)))
      .child(image(file).w(SIZE).h(SIZE).flex_none());
  }
}
