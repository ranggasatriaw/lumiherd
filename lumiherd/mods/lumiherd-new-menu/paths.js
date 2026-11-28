// A path another computer's sh printed, as that computer writes it. Windows
// (Git's sh; win): /c/Users/x is C:\Users\x, and a cwd read raw out of JSON
// (C:\\Users\\x) loses its escaping. Elsewhere it stays as it is: /c/… can be a
// real folder on Linux.
export function native(p, win) {
  if (!win) return p;
  const m = /^\/([a-zA-Z])(\/.*)?$/.exec(p);
  if (m) return `${m[1].toUpperCase()}:${(m[2] ?? "/").replace(/\//g, "\\")}`;
  return /^[A-Za-z]:\\\\/.test(p) ? p.replace(/\\\\/g, "\\") : p;
}
