// Servers: what's listening on this computer, in the right panel's "Servers" (a child of
// the panel-body stack, id "servers"; the tab bar has its button). A row per process:
// its name, its folder (macOS/Linux) and every port it listens on, each a link to
// http://localhost:<port>. Dev servers (node, python, bun, deno, ruby, php, java,
// go and the like, Docker, databases) come first; everything else (system helpers,
// Claude Code's own, apps) folds under "N other". A dev server running in your
// Projects folder (Lumiherd's Folders, ~/Code by default) can be stopped: click Stop,
// then Stop? again. Nothing else is: not Docker or databases, nor what runs from
// elsewhere (an assistant's own server in a dot folder, say).
// macOS/Linux: lsof; Windows: PowerShell's Get-NetTCPConnection. Read every 5 s
// while the panel shows it.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, exec, home, layout, window, run, shared } from "herdr";

const EVERY = 5000;
const DEV = /^(node|nodejs|bun|deno|python[\d.]*|ruby|php|java|go|air|uvicorn|gunicorn|flask|rails|puma|vite|next-server|esbuild|cargo|dotnet|hugo|caddy|nginx|httpd|php-fpm|wrangler|workerd|postgres|mysqld|mariadbd|redis-server|mongod|com\.docker\.backend|docker|ollama|llama-server)$/i;
const KEEP = /^(com\.docker\.backend|docker|postgres|mysqld|mariadbd|redis-server|mongod|ollama)$/i; // shown, never stopped here
const LSOF = `lsof -nP -iTCP -sTCP:LISTEN -Fpcn 2>/dev/null`;
const WIN = `Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Group-Object OwningProcess | ForEach-Object { $p = Get-Process -Id $_.Name -ErrorAction SilentlyContinue; [pscustomobject]@{ pid = [int]$_.Name; name = $p.ProcessName; path = $p.Path; ports = @($_.Group | ForEach-Object { $_.LocalPort } | Sort-Object -Unique) } } | ConvertTo-Json -Compress`;

const find = (n, id) => (!n ? null : n.id === id ? n : (n.children ?? []).map((c) => find(c, id)).find(Boolean) ?? null);
const tilde = (p) => (p && home() && p.startsWith(home()) ? `~${p.slice(home().length)}` : p);

export default class Servers extends View {
  init(_props, cx) {
    this.list = null; // [{ pid, name, cwd, ports }]
    this.showOther = false;
    this.arm = null; // the pid whose Stop was clicked once
    this.read(cx);
    cx.timer.every(EVERY, (cx) => { if (this.shown()) this.read(cx); });
  }

  // Only while the right panel is open on this tab, and the window is.
  shown() {
    if (window()?.visible === false) return false;
    const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
    return Boolean(panel && !panel.hidden && body?.active === "servers");
  }

  read(cx) {
    if (this.busy) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const list = window()?.platform === "windows" ? await this.readWindows() : await this.readUnix();
        const text = JSON.stringify(list);
        if (text !== this.last) { this.last = text; this.list = list; cx.notify(); }
      } finally { this.busy = false; }
    });
  }

  async readUnix() {
    const r = await exec("sh", ["-c", LSOF]).catch(() => null);
    const by = new Map();
    let cur = null;
    for (const line of (r?.stdout ?? "").split("\n")) {
      const k = line[0], v = line.slice(1);
      if (k === "p") { cur = { pid: Number(v), name: "", cwd: null, ports: [] }; by.set(cur.pid, cur); }
      else if (k === "c" && cur) cur.name = v;
      else if (k === "n" && cur) { const port = Number(v.split(":").pop()); if (port && !cur.ports.includes(port)) cur.ports.push(port); }
    }
    const pids = [...by.keys()];
    if (pids.length) {
      const c = await exec("sh", ["-c", `lsof -a -d cwd -p ${pids.join(",")} -Fpn 2>/dev/null`]).catch(() => null);
      let pid = null;
      for (const line of (c?.stdout ?? "").split("\n")) {
        if (line[0] === "p") pid = Number(line.slice(1));
        else if (line[0] === "n" && by.has(pid)) by.get(pid).cwd = line.slice(1);
      }
    }
    return [...by.values()].map((x) => ({ ...x, ports: x.ports.sort((a, b) => a - b) }));
  }

  async readWindows() {
    const r = await exec("powershell", ["-NoProfile", "-Command", WIN]).catch(() => null);
    let rows = [];
    try { rows = JSON.parse(r?.stdout || "[]"); } catch {}
    if (!Array.isArray(rows)) rows = [rows];
    return rows.filter((x) => x?.pid > 4).map((x) => ({ pid: x.pid, name: x.name ?? "?", cwd: null, ports: [].concat(x.ports ?? []).map(Number).sort((a, b) => a - b) }));
  }

  stop(x, cx) {
    if (this.arm !== x.pid) { this.arm = x.pid; cx.notify(); return; }
    this.arm = null;
    cx.spawn(async (cx) => {
      await (window()?.platform === "windows" ? exec("powershell", ["-NoProfile", "-Command", `Stop-Process -Id ${x.pid}`]) : exec("kill", [String(x.pid)])).catch(() => null);
      await cx.sleep(800);
      this.read(cx);
    });
  }

  render(cx) {
    const t = theme();
    const all = this.list ?? [];
    // The Projects folder (Lumiherd's Folders), absolute: only what runs in it can be stopped.
    const loc = (shared("sidebar.options") ?? {}).locations?.projects ?? "~/Code";
    const projects = loc.startsWith("~") && home() ? `${home()}${loc.slice(1)}`.replace(/\/+$/, "") : loc.replace(/\/+$/, "");
    const dev = all.filter((x) => DEV.test(x.name)).sort((a, b) => a.ports[0] - b.ports[0]);
    const other = all.filter((x) => !DEV.test(x.name)).sort((a, b) => a.name.localeCompare(b.name));
    const row = (x, isDev) => {
      const canStop = isDev && !KEEP.test(x.name) && Boolean(x.cwd && projects && (x.cwd === projects || x.cwd.startsWith(`${projects}/`)));
      const armed = this.arm === x.pid;
      return v_flex().id(`srv-${x.pid}`).flex_none().gap(4).px(12).py(8).rounded(8).bg(t.background).border_1().border_color(t.border)
        .child(h_flex().gap(8).items_center()
          .child(div().size(7).rounded(4).flex_none().bg(isDev ? t.ansi2 : t.dim))
          .child(div().flex_none().text_size(12.5).font_semibold().text_color(isDev ? t.foreground : t.muted).child(x.name))
          .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(tilde(x.cwd) ?? `pid ${x.pid}`))
          .when(canStop, (el) => el.child(h_flex().id(`stop-${x.pid}`).flex_none().h(20).px(7).items_center().rounded(5).cursor_pointer()
            .border_1().border_color(armed ? t.ansi1 : t.border).text_size(11).text_color(armed ? t.ansi1 : t.muted)
            .hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.stop(x, cx))
            .child(armed ? "Stop?" : "Stop"))))
        .child(h_flex().flex_wrap().gap(4).pl(15).children(x.ports.map((p) => h_flex().id(`port-${x.pid}-${p}`).h(18).px(6).items_center().rounded(4).cursor_pointer()
          .bg(t.raised).text_size(11).text_color(t.accent).hover((s) => s.bg(t.hover))
          .tooltip(`Open http://localhost:${p}`)
          .on_click((_e, cx) => cx.open_url(`http://localhost:${p}`))
          .child(`:${p}`))));
    };
    return v_flex().id("lumiherd-servers").size_full().min_h(0).rounded(10).overflow_hidden()
      .bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().flex_none().font_semibold().child("Servers"))
        .when(dev.length > 0, (el) => el.child(div().flex_none().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted).child(String(dev.length))))
        .child(div().flex_1())
        .child(div().text_size(11).text_color(t.dim).child("listening on this computer")))
      .child(v_flex().id("servers-scroll").flex_1().min_h(0).overflow_y_scrollbar().p(10).gap(8)
        .when(this.list === null, (el) => el.child(div().text_size(12).text_color(t.dim).child("Looking…")))
        .when(this.list !== null && !dev.length, (el) => el.child(div().text_size(12).text_color(t.dim).child("No dev server is running")))
        .children(dev.map((x) => row(x, true)))
        .when(other.length > 0, (el) => el.child(h_flex().id("servers-other").h(26).px(4).gap(6).items_center().cursor_pointer().text_size(11.5).text_color(t.dim)
          .hover((s) => s.text_color(t.foreground))
          .on_click((_e, cx) => { this.showOther = !this.showOther; cx.notify(); })
          .child(this.showOther ? "▾" : "▸").child(`${other.length} other (system, apps, Claude Code)`)))
        .when(this.showOther, (el) => el.children(other.map((x) => row(x, false)))));
  }
}
