"use strict";
var s = Object.defineProperty;
var L = Object.getOwnPropertyDescriptor;
var v = Object.getOwnPropertyNames;
var b = Object.prototype.hasOwnProperty;
var t = (r, e) => s(r, "name", { value: e, configurable: !0 });
var w = (r, e) => {
  for (var n in e)
    s(r, n, { get: e[n], enumerable: !0 });
}, h = (r, e, n, i) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let c of v(e))
      !b.call(r, c) && c !== n && s(r, c, { get: () => e[c], enumerable: !(i = L(e, c)) || i.enumerable });
  return r;
};
var m = (r) => h(s({}, "__esModule", { value: !0 }), r);

// src/client-logger/index.ts
var k = {};
w(k, {
  deprecate: () => F,
  logger: () => y,
  once: () => o,
  pretty: () => a
});
module.exports = m(k);
var p = require("@storybook/global");
var { LOGLEVEL: x } = p.global, g = {
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  silent: 10
}, R = x, l = g[R] || g.info, y = {
  trace: /* @__PURE__ */ t((r, ...e) => {
    l <= g.trace && console.trace(r, ...e);
  }, "trace"),
  debug: /* @__PURE__ */ t((r, ...e) => {
    l <= g.debug && console.debug(r, ...e);
  }, "debug"),
  info: /* @__PURE__ */ t((r, ...e) => {
    l <= g.info && console.info(r, ...e);
  }, "info"),
  warn: /* @__PURE__ */ t((r, ...e) => {
    l <= g.warn && console.warn(r, ...e);
  }, "warn"),
  error: /* @__PURE__ */ t((r, ...e) => {
    l <= g.error && console.error(r, ...e);
  }, "error"),
  log: /* @__PURE__ */ t((r, ...e) => {
    l < g.silent && console.log(r, ...e);
  }, "log")
}, d = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ t((r) => (e, ...n) => {
  if (!d.has(e))
    return d.add(e), y[r](e, ...n);
}, "once");
o.clear = () => d.clear();
o.trace = o("trace");
o.debug = o("debug");
o.info = o("info");
o.warn = o("warn");
o.error = o("error");
o.log = o("log");
var F = o("warn"), a = /* @__PURE__ */ t((r) => (...e) => {
  let n = [];
  if (e.length) {
    let i = /<span\s+style=(['"])([^'"]*)\1\s*>/gi, c = /<\/span>/gi, u;
    for (n.push(e[0].replace(i, "%c").replace(c, "%c")); u = i.exec(e[0]); )
      n.push(u[2]), n.push("");
    for (let f = 1; f < e.length; f++)
      n.push(e[f]);
  }
  y[r].apply(y, n);
}, "pretty");
a.trace = a("trace");
a.debug = a("debug");
a.info = a("info");
a.warn = a("warn");
a.error = a("error");
