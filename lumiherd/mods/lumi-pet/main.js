// Lumi, a chibi pet floating over the sidebar's list, who shows how the agents are
// doing at a glance:
//   one needs you        waving, with "!"         (the most urgent wins)
//   one is working       typing on a laptop
//   one finished unseen  cheering
//   all idle             asleep
// Under her, a word on it ("2 working"). A click goes to the agent that needs you,
// else the one that finished, else the one working. Pictures: blocked/working/
// done/idle.png next to this file (Lumiherd's icon character, drawn chibi).

import { View, div, image } from "gpui-kit";
import { v_flex } from "gpui-base";
import { theme, agents, run } from "herdr";

const SIZE = 84;
const WORDS = { blocked: "nungguin kamu", working: "kerja", done: "selesai", idle: "tidur" };

export default class LumiPet extends View {
  init(_props, cx) {
    // agents() changes on its own; a light timer keeps the pose in step without work.
    cx.timer.every(1000, (cx) => {
      const now = this.state();
      const key = JSON.stringify(now);
      if (key !== this.last) { this.last = key; cx.notify(); }
    });
  }

  // The most urgent state among the agents, how many are in it, and the one to go to.
  state() {
    const list = agents() ?? [];
    for (const s of ["blocked", "done", "working"]) {
      const these = list.filter((a) => a.status === s);
      if (these.length) return { pose: s, count: these.length, to: these[0] };
    }
    return { pose: "idle", count: 0, to: null };
  }

  render(cx) {
    const t = theme();
    const { pose, count, to } = this.state();
    const color = pose === "blocked" ? t.blocked : pose === "working" ? t.working : pose === "done" ? t.done ?? t.ansi2 : t.dim;
    const word = pose === "idle" ? WORDS.idle : `${count > 1 ? `${count} ` : ""}${WORDS[pose]}`;
    return v_flex().id("lumi-pet").items_center().gap(2).px(6).pt(4).pb(2)
      .when(Boolean(to), (el) => el.cursor_pointer().on_click(() => run("agent.focus", { terminal: to.address })))
      .child(image(`mods/lumi-pet/${pose}.png`).w(SIZE).h(SIZE).flex_none())
      .child(div().text_size(10.5).font_semibold().text_color(color).child(word));
  }
}
