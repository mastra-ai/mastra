var u = Object.defineProperty;
var a = (r, e) => u(r, "name", { value: e, configurable: !0 });

// src/client-logger/index.ts
import { global as p } from "@storybook/global";
var { LOGLEVEL: L } = p, t = {
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  silent: 10
}, v = L, c = t[v] || t.info, i = {
  trace: /* @__PURE__ */ a((r, ...e) => {
    c <= t.trace && console.trace(r, ...e);
  }, "trace"),
  debug: /* @__PURE__ */ a((r, ...e) => {
    c <= t.debug && console.debug(r, ...e);
  }, "debug"),
  info: /* @__PURE__ */ a((r, ...e) => {
    c <= t.info && console.info(r, ...e);
  }, "info"),
  warn: /* @__PURE__ */ a((r, ...e) => {
    c <= t.warn && console.warn(r, ...e);
  }, "warn"),
  error: /* @__PURE__ */ a((r, ...e) => {
    c <= t.error && console.error(r, ...e);
  }, "error"),
  log: /* @__PURE__ */ a((r, ...e) => {
    c < t.silent && console.log(r, ...e);
  }, "log")
}, s = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ a((r) => (e, ...g) => {
  if (!s.has(e))
    return s.add(e), i[r](e, ...g);
}, "once");
o.clear = () => s.clear();
o.trace = o("trace");
o.debug = o("debug");
o.info = o("info");
o.warn = o("warn");
o.error = o("error");
o.log = o("log");
var h = o("warn"), n = /* @__PURE__ */ a((r) => (...e) => {
  let g = [];
  if (e.length) {
    let y = /<span\s+style=(['"])([^'"]*)\1\s*>/gi, d = /<\/span>/gi, f;
    for (g.push(e[0].replace(y, "%c").replace(d, "%c")); f = y.exec(e[0]); )
      g.push(f[2]), g.push("");
    for (let l = 1; l < e.length; l++)
      g.push(e[l]);
  }
  i[r].apply(i, g);
}, "pretty");
n.trace = n("trace");
n.debug = n("debug");
n.info = n("info");
n.warn = n("warn");
n.error = n("error");
export {
  h as deprecate,
  i as logger,
  o as once,
  n as pretty
};
