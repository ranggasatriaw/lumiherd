// sh on another computer (m: a machine's name): the one lumiherd found there
// (shared "lumiherd.sh"), plain "sh" or Git for Windows' on Windows. On this
// computer it stays plain sh: scripts that change settings here (setup.sh) were
// never run under Git's sh, so on Windows they still don't run.
// Mods can't import from each other, so each mod that runs sh has a copy of this
// file; check.sh keeps the copies identical to lumiherd/sh.js.
import { exec, shared } from "herdr";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64(text) {
  const bytes = [];
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[n >> 18] + B64[(n >> 12) & 63] + (b === undefined ? "=" : B64[(n >> 6) & 63]) + (c === undefined ? "=" : B64[n & 63]);
  }
  return out;
}

// exec of the sh at path `sh`. Windows' command line halves backslashes on their
// way into Git's sh, so a -c script goes base64-encoded and is decoded there.
export function shAt(sh, args, opts = {}) {
  if (sh === "sh" || args[0] !== "-c") return exec(sh, args, opts);
  return exec(sh, ["-c", 'eval "$(printf %s "$0" | base64 -d)"', base64(args[1]), ...args.slice(3)], opts);
}

// Like exec("sh", args, options), there (m) or here.
export function shExec(args, m = null, options = {}) {
  if (!m) return exec("sh", args, options);
  return shAt(shared("lumiherd.sh")?.[m] ?? "sh", args, { ...options, on: m });
}
