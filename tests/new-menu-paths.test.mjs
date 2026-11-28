import { test } from "node:test";
import assert from "node:assert/strict";
import { native } from "../lumiherd/mods/lumiherd-new-menu/paths.js";

test("Git sh path on Windows", () => {
  assert.equal(native("/c/Users/rangg/Code/x", true), "C:\\Users\\rangg\\Code\\x");
  assert.equal(native("/c", true), "C:\\");
});

test("JSON-escaped Windows path", () => {
  assert.equal(native("C:\\\\Users\\\\rangg\\\\dev\\\\x", true), "C:\\Users\\rangg\\dev\\x");
});

test("already Windows form stays", () => {
  assert.equal(native("C:\\Users\\rangg", true), "C:\\Users\\rangg");
});

test("not Windows: unchanged", () => {
  assert.equal(native("/c/Users/x", false), "/c/Users/x");
  assert.equal(native("/home/u/Code", false), "/home/u/Code");
});
