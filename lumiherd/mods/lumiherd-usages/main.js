// Usages: what Claude Code would have cost at list prices, in the right panel's "Usages"
// (a child of the panel-body stack, id "usages"; the tab bar has its button). For any
// plan: on a subscription it shows where the limits go, by day, project and model.
// The numbers come from lumiherd-usage's api-cost.py --report, which reads the
// transcripts (~/.claude/projects) of the computer picked at the top: this one or a
// machine Herdr is connected to. It also saves them to ~/.cache/lumiherd/usage/report.json
// there, for other tools (Lumi Assist) to read. An estimate, not a bill; chats on
// claude.ai or in Claude Desktop's chat aren't in it, only Claude Code's sessions.
// Read when the panel opens and every 5 minutes while it shows.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, exec, appHome, layout, window, machines, readTextFile } from "herdr";

const EVERY = 5 * 60000;
const PERIODS = [{ tab: "1d", days: 1, label: "today" }, { tab: "1w", days: 7, label: "the last 7 days" },
  { tab: "2w", days: 14, label: "the last 14 days" }, { tab: "30d", days: 30, label: "the last 30 days" }];
const GRAPH = 70;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayName = (day) => { const [, m, d] = day.split("-"); return `${MONTHS[m - 1]} ${Number(d)}`; };
const money = (n) => `$${(n ?? 0).toFixed(n >= 100 ? 0 : 2)}`;

const find = (n, id) => (!n ? null : n.id === id ? n : (n.children ?? []).map((c) => find(c, id)).find(Boolean) ?? null);

// The sums of one field ("projects", "models") over days, most first.
function sums(days, field) {
  const by = {};
  for (const d of days) for (const [k, v] of Object.entries(d[field] ?? {})) by[k] = (by[k] ?? 0) + v;
  return Object.entries(by).map(([name, cost]) => ({ name, cost })).filter((x) => x.cost >= 0.005).sort((a, b) => b.cost - a.cost);
}

export default class Usages extends View {
  init(_props, cx) {
    this.where = null; // null: this computer; else a machine's name
    this.period = PERIODS[1];
    this.data = {}; // where ("" for this computer) -> { days } | "error"
    this.busy = new Set();
    this.wasShown = false;
    cx.timer.every(2000, (cx) => {
      const on = this.shown();
      const key = this.where ?? "";
      const old = this.data[key]?.readAt ?? 0;
      if (on && (!this.wasShown || Date.now() - old >= EVERY)) this.read(cx);
      this.wasShown = on;
    });
  }

  shown() {
    if (window()?.visible === false) return false;
    const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
    return Boolean(panel && !panel.hidden && body?.active === "usages");
  }

  read(cx) {
    const m = this.where, key = m ?? "";
    if (this.busy.has(key)) return;
    this.busy.add(key);
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const script = await readTextFile(`${appHome().replace(/\\/g, "/")}/mods/lumiherd-usage/api-cost.py`).catch(() => null);
        const options = m ? { on: m } : {};
        const args = ["-c", script ?? "", "--report"];
        const r = script ? await exec("python3", args, options).catch(() => null) ?? await exec("python", args, options).catch(() => null) : null;
        let d = null;
        try { d = JSON.parse(r?.stdout || "null"); } catch {}
        this.data[key] = d?.days ? { days: d.days, readAt: Date.now() } : { error: true, readAt: Date.now() };
      } finally { this.busy.delete(key); cx.notify(); }
    });
  }

  pick(where, cx) {
    this.where = where;
    if (!this.data[where ?? ""]) this.read(cx);
    cx.notify();
  }

  render(cx) {
    const t = theme();
    const key = this.where ?? "";
    const got = this.data[key];
    const days = got?.days?.slice(-this.period.days) ?? [];
    const total = days.reduce((a, d) => a + Object.values(d.models ?? {}).reduce((x, y) => x + y, 0), 0);
    const projects = sums(days, "projects"), models = sums(days, "models");
    const ready = (machines() ?? []).filter((m) => m.name && m.layout === "ready").map((m) => m.name);
    const chip = (id, label, on, click) => h_flex().id(id).h(22).px(8).flex_none().items_center().rounded(5).cursor_pointer()
      .text_size(11.5).bg(on ? t.selected : t.background).text_color(on ? t.foreground : t.muted)
      .border_1().border_color(on ? t.border : t.background).hover((s) => s.bg(t.hover)).on_click((_e, cx) => click(cx)).child(label);
    const card = (title, children) => v_flex().flex_none().gap(6).p(10).rounded(8).bg(t.background).border_1().border_color(t.border)
      .child(div().text_size(11).text_color(t.dim).child(title)).children(children);
    const bars = (list, id) => {
      const most = list[0]?.cost || 1;
      return list.slice(0, 12).map((x, i) => v_flex().id(`${id}-${i}`).gap(3).tooltip(`${x.name}: ${money(x.cost)} (${Math.round((x.cost / (total || 1)) * 100)}%)`)
        .child(h_flex().gap(8).items_center().text_size(12.5)
          .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(x.name))
          .child(div().flex_none().text_color(t.muted).child(money(x.cost))))
        .child(div().h(4).rounded(2).bg(t.raised).child(div().h_full().rounded(2).bg(t.accent).w(`${Math.max(2, (x.cost / most) * 100)}%`))));
    };
    // The days' bars, at most one a day.
    const graph = () => {
      const most = Math.max(...days.map((d) => Object.values(d.models ?? {}).reduce((a, b) => a + b, 0)), 0.01);
      return h_flex().h(GRAPH).items_end().gap(2).children(days.map((d, i) => {
        const v = Object.values(d.models ?? {}).reduce((a, b) => a + b, 0);
        return div().id(`day-${i}`).flex_1().h_full().flex().items_end().tooltip(`${dayName(d.day)}: ${money(v)}`)
          .child(div().w_full().rounded(2).bg(v ? t.accent : t.raised).h(Math.max(2, (v / most) * (GRAPH - 2))));
      }));
    };
    return v_flex().id("lumiherd-usages").size_full().min_h(0).rounded(10).overflow_hidden()
      .bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().flex_none().font_semibold().child("Usages"))
        .child(div().flex_1())
        .children(PERIODS.map((p) => chip(`period-${p.tab}`, p.tab, this.period === p, (cx) => { this.period = p; cx.notify(); }))))
      .child(v_flex().id("usages-scroll").flex_1().min_h(0).overflow_y_scrollbar().p(10).gap(8)
        .when(ready.length > 0, (el) => el.child(h_flex().flex_wrap().gap(4)
          .child(chip("where-here", "This computer", this.where === null, (cx) => this.pick(null, cx)))
          .children(ready.map((m) => chip(`where-${m}`, m, this.where === m, (cx) => this.pick(m, cx))))))
        .when(!got, (el) => el.child(div().text_size(12).text_color(t.dim).child("Reading Claude Code's sessions…")))
        .when(Boolean(got?.error), (el) => el.child(div().text_size(12).text_color(t.dim).child("Couldn't read them: this needs Python on that computer")))
        .when(Boolean(got?.days), (el) => el
          .child(card(`Claude Code, ${this.period.label}`, [
            h_flex().items_end().gap(6)
              .child(div().text_size(22).font_semibold().child(`≈ ${money(total)}`))
              .child(div().pb(3).text_size(11).text_color(t.dim).child("at API list prices")),
            ...(this.period.days > 1 ? [graph()] : []),
          ]))
          .child(card("By project", projects.length ? bars(projects, "proj") : [div().text_size(12).text_color(t.dim).child("Nothing in this period")]))
          .child(card("By model", models.length ? bars(models, "model") : [div().text_size(12).text_color(t.dim).child("Nothing in this period")]))
          .child(div().px(2).text_size(10.5).text_color(t.dim)
            .child(`An estimate from tokens, not your bill: on a plan, it shows where the limits go. Claude Code only, not claude.ai chats.${this.busy.has(key) ? " Updating…" : ""}`))));
  }
}
