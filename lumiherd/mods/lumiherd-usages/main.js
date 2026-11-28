// Usages: what Claude Code used, in the right panel's "Usages" (a child of the
// panel-body stack, id "usages"; the tab bar has its button). For any plan: on a
// subscription it shows where the limits go. In dollars at API list prices or in
// tokens; by day, by project (click one: its models side by side) and by model.
// Next to a model, how much of its input came from the cache ("cache 97%"): the
// higher, the cheaper the same work.
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
const count = (n) => n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n));

const find = (n, id) => (!n ? null : n.id === id ? n : (n.children ?? []).map((c) => find(c, id)).find(Boolean) ?? null);

// Sums of [cost, input, output, cache read, cache write] by a key of a report row
// ([project, model, cost, …tokens]), most cost first.
function group(rows, key) {
  const by = {};
  for (const r of rows) {
    const k = key(r), s = by[k] ?? (by[k] = { name: k, v: [0, 0, 0, 0, 0] });
    for (let i = 0; i < 5; i++) s.v[i] += r[i + 2] ?? 0;
  }
  return Object.values(by).filter((x) => x.v[0] >= 0.005 || x.v[1] + x.v[2] + x.v[3] + x.v[4] > 0).sort((a, b) => b.v[0] - a.v[0]);
}
const tokensOf = (v) => v[1] + v[2] + v[3] + v[4];
// The share of input read from the cache.
const cacheOf = (v) => { const all = v[1] + v[3] + v[4]; return all ? Math.round((v[3] / all) * 100) : 0; };
const detail = (v) => `${money(v[0])} · ${count(tokensOf(v))} tokens\nInput ${count(v[1])} · output ${count(v[2])}\nCache read ${count(v[3])} · cache write ${count(v[4])} (${cacheOf(v)}% of input from cache)`;

export default class Usages extends View {
  init(_props, cx) {
    this.where = null; // null: this computer; else a machine's name
    this.period = PERIODS[1];
    this.unit = "cost"; // or "tokens"
    this.open = new Set(); // projects shown with their models
    this.data = {}; // where ("" for this computer) -> { days, readAt } | { error, readAt }
    this.busy = new Set();
    this.wasShown = false;
    cx.timer.every(2000, (cx) => {
      const on = this.shown();
      const old = this.data[this.where ?? ""]?.readAt ?? 0;
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
    const rows = days.flatMap((d) => d.rows ?? []);
    const tok = this.unit === "tokens";
    const val = (v) => (tok ? tokensOf(v) : v[0]);
    const show = (v) => (tok ? count(tokensOf(v)) : money(v[0]));
    const all = group(rows, () => "all")[0]?.v ?? [0, 0, 0, 0, 0];
    const projects = group(rows, (r) => r[0]), models = group(rows, (r) => r[1]);
    const ready = (machines() ?? []).filter((m) => m.name && m.layout === "ready").map((m) => m.name);
    const chip = (id, label, on, click) => h_flex().id(id).h(22).px(8).flex_none().items_center().rounded(5).cursor_pointer()
      .text_size(11.5).bg(on ? t.selected : t.background).text_color(on ? t.foreground : t.muted)
      .border_1().border_color(on ? t.border : t.background).hover((s) => s.bg(t.hover)).on_click((_e, cx) => click(cx)).child(label);
    const card = (title, children) => v_flex().flex_none().gap(6).p(10).rounded(8).bg(t.background).border_1().border_color(t.border)
      .child(div().text_size(11).text_color(t.dim).child(title)).children(children);
    const none = () => div().text_size(12).text_color(t.dim).child("Nothing in this period");
    const bar = (share, color) => div().h(4).rounded(2).bg(t.raised).child(div().h_full().rounded(2).bg(color).w(`${Math.max(2, share * 100)}%`));
    // A model's line: its value, and how much of its input came from the cache.
    const modelLine = (x, id, most, small) => v_flex().id(id).gap(3).tooltip(detail(x.v))
      .child(h_flex().gap(8).items_center().text_size(small ? 11.5 : 12.5)
        .child(div().flex_1().min_w(0).truncate().text_color(small ? t.muted : t.foreground).child(x.name))
        .child(div().flex_none().text_size(11).text_color(t.dim).child(`cache ${cacheOf(x.v)}%`))
        .child(div().flex_none().min_w(46).text_right().text_color(t.muted).child(show(x.v))))
      .child(bar(val(x.v) / (most || 1), small ? t.muted : t.accent));
    const projectsMost = val(projects[0]?.v ?? all);
    const projectRow = (x, i) => {
      const open = this.open.has(x.name);
      const mine = group(rows.filter((r) => r[0] === x.name), (r) => r[1]);
      return v_flex().gap(5)
        .child(v_flex().id(`proj-${i}`).gap(3).cursor_pointer().tooltip(detail(x.v))
          .on_click((_e, cx) => { if (open) this.open.delete(x.name); else this.open.add(x.name); cx.notify(); })
          .child(h_flex().gap(6).items_center().text_size(12.5)
            .child(div().flex_none().w(10).text_size(10).text_color(t.dim).child(open ? "▾" : "▸"))
            .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(x.name))
            .when(!open && mine.length > 1, (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(`${mine.length} models`)))
            .child(div().flex_none().text_color(t.muted).child(show(x.v))))
          .child(bar(val(x.v) / (projectsMost || 1), t.accent)))
        .when(open, (el) => el.child(v_flex().pl(16).gap(5).children(mine.map((m, j) => modelLine(m, `proj-${i}-${j}`, val(mine[0].v), true)))));
    };
    // The days' bars, one a day.
    const graph = () => {
      const each = days.map((d) => group(d.rows ?? [], () => "all")[0]?.v ?? [0, 0, 0, 0, 0]);
      const most = Math.max(...each.map(val), 0.01);
      return h_flex().h(GRAPH).items_end().gap(2).children(days.map((d, i) => div().id(`day-${i}`).flex_1().h_full().flex().items_end()
        .tooltip(`${dayName(d.day)}: ${show(each[i])}`)
        .child(div().w_full().rounded(2).bg(val(each[i]) ? t.accent : t.raised).h(Math.max(2, (val(each[i]) / most) * (GRAPH - 2))))));
    };
    return v_flex().id("lumiherd-usages").size_full().min_h(0).rounded(10).overflow_hidden()
      .bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().flex_none().font_semibold().child("Usages"))
        .child(div().flex_1())
        .children(PERIODS.map((p) => chip(`period-${p.tab}`, p.tab, this.period === p, (cx) => { this.period = p; cx.notify(); }))))
      .child(v_flex().id("usages-scroll").flex_1().min_h(0).overflow_y_scrollbar().p(10).gap(8)
        .child(h_flex().gap(4).items_center()
          .child(h_flex().flex_1().min_w(0).flex_wrap().gap(4)
            .when(ready.length > 0, (el) => el.child(chip("where-here", "This computer", this.where === null, (cx) => this.pick(null, cx)))
              .children(ready.map((m) => chip(`where-${m}`, m, this.where === m, (cx) => this.pick(m, cx))))))
          .child(chip("unit-cost", "$", !tok, (cx) => { this.unit = "cost"; cx.notify(); }))
          .child(chip("unit-tokens", "Tokens", tok, (cx) => { this.unit = "tokens"; cx.notify(); })))
        .when(!got, (el) => el.child(div().text_size(12).text_color(t.dim).child("Reading Claude Code's sessions…")))
        .when(Boolean(got?.error), (el) => el.child(div().text_size(12).text_color(t.dim).child("Couldn't read them: this needs Python on that computer")))
        .when(Boolean(got?.days), (el) => el
          .child(card(`Claude Code, ${this.period.label}`, [
            h_flex().id("usages-total").items_end().gap(6).tooltip(detail(all))
              .child(div().text_size(22).font_semibold().child(tok ? count(tokensOf(all)) : `≈ ${money(all[0])}`))
              .child(div().pb(3).text_size(11).text_color(t.dim).child(tok ? `tokens · cache ${cacheOf(all)}% of input` : `at API list prices · ${count(tokensOf(all))} tokens`)),
            ...(this.period.days > 1 ? [graph()] : []),
          ]))
          .child(card("By project (click: its models)", projects.length ? projects.slice(0, 15).map(projectRow) : [none()]))
          .child(card("By model", models.length ? models.map((x, i) => modelLine(x, `model-${i}`, val(models[0].v), false)) : [none()]))
          .child(div().px(2).text_size(10.5).text_color(t.dim)
            .child(`An estimate from tokens, not your bill: on a plan, it shows where the limits go. Cache = input read from the cache, the higher the cheaper. Claude Code only, not claude.ai chats.${this.busy.has(key) ? " Updating…" : ""}`))));
  }
}
