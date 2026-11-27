// Tasks: the plan-progress bars of the agent you're in, as a list, in the right
// panel's "Tasks" (a child of the panel-body stack, id "tasks"; the tab bar has its
// button). plan-progress (github.com/zycck/claude-mods) is a Claude Code plugin
// that draws one bar above the prompt per task; it keeps them per session in
// ~/.claude/plugins/store/plan-progress_*.json ("plans:<session id>"). The session
// running in each terminal comes from claude-info.py (Lumiherd's sidebar runs it):
// ~/.cache/lumiherd/agents/<terminal>.json names its transcript, <session id>.jsonl.
// Each task: its title, state and how far along, then every step with a mark
// (✓ done, ● working on it, ○ to do, ✕ failed, – skipped), under its stage's
// name when there are several. Followed: the agent you're in, else the last one.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, exec, home, focused, agents, readTextFile, shared } from "herdr";

const STORE = `cat "$HOME"/.claude/plugins/store/plan-progress_*.json 2>/dev/null | head -c 4000000`;
const STATE = { running: "Working", needs_input: "Needs you", error: "Error", done: "Done" };

export default class Tasks extends View {
  init(_props, cx) {
    this.agent = null;
    this.plans = [];
    this.note = "Open an agent to see its tasks";
    this.follow(cx);
    cx.timer.every(2000, (cx) => this.follow(cx));
  }

  follow(cx) {
    const f = focused();
    const here = f?.agent ?? (f?.terminal && agents().some((a) => a.address === f.terminal) ? f.terminal : null);
    if (here && here !== this.agent) { this.agent = here; this.plans = []; cx.notify(); }
    if (!this.agent || this.busy) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const info = await readTextFile(`${home()}/.cache/lumiherd/agents/${this.agent}.json`).catch(() => null);
        let session = null;
        try { session = (JSON.parse(info)?.transcript ?? "").split("/").pop().replace(/\.jsonl$/, "") || null; } catch {}
        if (!session) return this.show(cx, [], "Tasks show for Claude Code agents");
        const r = await exec("sh", ["-c", STORE]).catch(() => null);
        let store = null;
        try { store = JSON.parse(r?.stdout || "null"); } catch {}
        if (!store) return this.show(cx, [], "Needs the plan-progress plugin in Claude Code");
        const plans = store[`plans:${session}`] ?? [];
        this.show(cx, plans, plans.length ? "" : "No tasks in this session");
      } finally {
        this.busy = false;
      }
    });
  }

  show(cx, plans, note) {
    const next = JSON.stringify([plans, note]);
    if (next === this.last) return;
    this.last = next;
    this.plans = plans;
    this.note = note;
    cx.notify();
  }

  name() {
    const a = agents().find((x) => x.address === this.agent);
    return a?.tab_name || a?.program?.name || "";
  }

  render(cx) {
    const t = theme();
    const color = (s) => (s === "running" ? t.working : s === "needs_input" ? t.blocked : s === "error" ? t.ansi1 : s === "done" ? t.done ?? t.ansi2 : t.dim);
    const wash = (c, a) => (/^#[0-9a-f]{6}$/i.test(c ?? "") ? c + a : t.raised);
    const mark = (st) => (st === "done" ? ["✓", t.ansi2] : st === "active" ? ["●", t.working] : st === "error" ? ["✕", t.ansi1] : st === "skipped" ? ["–", t.dim] : ["○", t.dim]);
    const step = (s, key) => {
      const [m, c] = mark(s.status);
      return h_flex().id(key).gap(8).items_start().py(3)
        .child(div().w(14).flex_none().text_size(12).text_color(c).child(m))
        .child(div().flex_1().min_w(0).whitespace_normal().text_size(12.5).line_height("17px")
          .text_color(s.status === "active" ? t.foreground : s.status === "done" || s.status === "skipped" ? t.muted : t.foreground)
          .when(s.status === "active", (el) => el.font_semibold())
          .child(s.title));
    };
    const card = (p, i) => {
      const steps = (p.stages ?? []).flatMap((g) => g.steps ?? []);
      const done = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
      const c = color(p.state), pct = steps.length ? done / steps.length : 0;
      const many = (p.stages ?? []).length > 1;
      return v_flex().id(`task-${i}`).flex_none().gap(6).px(12).py(10).rounded(10).border_1().border_color(t.border).bg(t.background)
        .child(h_flex().gap(8).items_center()
          .child(div().flex_1().min_w(0).truncate().text_size(13).font_semibold().child(p.title ?? p.id))
          .child(div().flex_none().px(6).py(1).rounded(5).bg(wash(c, "26")).text_color(c).text_size(10.5).child(STATE[p.state] ?? p.state ?? "")))
        .child(h_flex().gap(8).items_center()
          .child(div().flex_1().h(4).rounded(2).bg(t.border).overflow_hidden().child(div().h_full().rounded(2).bg(c).w(`${Math.round(pct * 100)}%`)))
          .child(div().flex_none().text_size(11).text_color(t.dim).child(`${done}/${steps.length}`)))
        .when(Boolean(p.note), (el) => el.child(div().text_size(11.5).text_color(c).whitespace_normal().child(p.note)))
        .child(v_flex().gap(0).children((p.stages ?? []).flatMap((g, gi) => [
          ...(many ? [div().id(`stage-${i}-${gi}`).pt(gi ? 6 : 0).pb(2).text_size(11).text_color(t.dim).child(g.name)] : []),
          ...(g.steps ?? []).map((s, si) => step(s, `step-${i}-${gi}-${si}`)),
        ])));
    };
    // Working and waiting first, then the rest, newest first within each.
    const rank = (p) => (p.state === "needs_input" ? 0 : p.state === "running" ? 1 : p.state === "error" ? 2 : 3);
    const list = [...this.plans].sort((a, b) => rank(a) - rank(b) || (b.startedAt ?? 0) - (a.startedAt ?? 0));
    return v_flex().id("lumiherd-tasks").size_full().min_h(0).rounded(10).overflow_hidden()
      .bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().flex_none().font_semibold().child("Tasks"))
        .when(list.length > 0, (el) => el.child(div().flex_none().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted)
          .child(String(list.length))))
        .child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(this.name())))
      .when(Boolean(this.note), (el) => el.child(div().px(14).py(10).text_size(12).text_color(t.dim).child(this.note)))
      .when(Boolean(shared("lumiherd.private")), (el) => el.child(div().px(14).py(10).text_size(12).text_color(t.dim).child("Hidden: privacy is on (the eye in the sidebar)")))
      .when(!shared("lumiherd.private"), (el) => el.child(v_flex().id("tasks-scroll").flex_1().min_h(0).overflow_y_scrollbar().p(10).gap(10).children(list.map(card))));
  }
}
