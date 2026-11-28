import { test } from "node:test";
import assert from "node:assert/strict";
import { filesOf, ago } from "../lumiherd/mods/lumiherd-prompts/files.js";

test("once per file, newest prompt wins", () => {
  const rows = filesOf([
    { at: "2026-11-28T10:00:00Z", done: "2026-11-28T10:05:00Z", edits: ["/Users/r/Code/a/x.js"] },
    { at: "2026-11-28T09:00:00Z", done: "2026-11-28T09:01:00Z", edits: ["/Users/r/Code/a/x.js", "/Users/r/Code/a/y.js"] },
  ], "/Users/r");
  assert.deepEqual(rows.map((r) => r.path), ["/Users/r/Code/a/x.js", "/Users/r/Code/a/y.js"]);
  assert.equal(rows[0].prompt, 0);
  assert.equal(rows[0].at, "2026-11-28T10:05:00Z");
  assert.equal(rows[1].prompt, 1);
});

test("name and folder with ~", () => {
  const [r] = filesOf([{ at: "2026-11-28T10:00:00Z", done: null, edits: ["/Users/r/Code/a/x.js"] }], "/Users/r");
  assert.equal(r.name, "x.js");
  assert.equal(r.folder, "~/Code/a");
});

test("windows path", () => {
  const [r] = filesOf([{ at: "2026-11-28T10:00:00Z", done: null, edits: ["C:\\Users\\rangg\\dev\\x\\main.js"] }], "C:\\Users\\rangg");
  assert.equal(r.name, "main.js");
  assert.equal(r.folder, "~\\dev\\x");
});

test("outside home", () => {
  const [r] = filesOf([{ at: "2026-11-28T10:00:00Z", done: null, edits: ["/tmp/a.txt"] }], "/Users/r");
  assert.equal(r.folder, "/tmp");
});

test("running prompt uses at", () => {
  const [r] = filesOf([{ at: "2026-11-28T10:00:00Z", done: null, edits: ["/Users/r/z"] }], "/Users/r");
  assert.equal(r.at, "2026-11-28T10:00:00Z");
});

test("ago", () => {
  const now = Date.parse("2026-11-28T12:00:00Z");
  assert.equal(ago("2026-11-28T11:59:30Z", now), "now");
  assert.equal(ago("2026-11-28T11:15:00Z", now), "45m");
  assert.equal(ago("2026-11-28T09:00:00Z", now), "3h");
  assert.equal(ago("2026-11-25T12:00:00Z", now), "3d");
  assert.equal(ago("nope", now), "");
});
