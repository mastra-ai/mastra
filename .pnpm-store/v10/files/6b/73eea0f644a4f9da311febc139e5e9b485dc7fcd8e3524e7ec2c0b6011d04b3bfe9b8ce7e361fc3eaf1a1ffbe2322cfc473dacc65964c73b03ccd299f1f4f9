"use strict";
var Pe = Object.defineProperty;
var gr = Object.getOwnPropertyDescriptor;
var hr = Object.getOwnPropertyNames;
var dr = Object.prototype.hasOwnProperty;
var c = (e, t) => Pe(e, "name", { value: t, configurable: !0 });
var yr = (e, t) => {
  for (var n in t)
    Pe(e, n, { get: t[n], enumerable: !0 });
}, br = (e, t, n, r) => {
  if (t && typeof t == "object" || typeof t == "function")
    for (let o of hr(t))
      !dr.call(e, o) && o !== n && Pe(e, o, { get: () => t[o], enumerable: !(r = gr(t, o)) || r.enumerable });
  return e;
};
var Sr = (e) => br(Pe({}, "__esModule", { value: !0 }), e);

// src/instrumenter/index.ts
var ui = {};
yr(ui, {
  CallStates: () => ur,
  EVENTS: () => ee,
  instrument: () => mr
});
module.exports = Sr(ui);

// src/instrumenter/instrumenter.ts
var fr = require("storybook/internal/client-logger"), ye = require("storybook/internal/core-events"), H = require("@storybook/global");

// ../node_modules/tinyrainbow/dist/chunk-BVHSVHOK.js
var Er = {
  reset: [0, 0],
  bold: [1, 22, "\x1B[22m\x1B[1m"],
  dim: [2, 22, "\x1B[22m\x1B[2m"],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  hidden: [8, 28],
  strikethrough: [9, 29],
  black: [30, 39],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  white: [37, 39],
  gray: [90, 39],
  bgBlack: [40, 49],
  bgRed: [41, 49],
  bgGreen: [42, 49],
  bgYellow: [43, 49],
  bgBlue: [44, 49],
  bgMagenta: [45, 49],
  bgCyan: [46, 49],
  bgWhite: [47, 49],
  blackBright: [90, 39],
  redBright: [91, 39],
  greenBright: [92, 39],
  yellowBright: [93, 39],
  blueBright: [94, 39],
  magentaBright: [95, 39],
  cyanBright: [96, 39],
  whiteBright: [97, 39],
  bgBlackBright: [100, 49],
  bgRedBright: [101, 49],
  bgGreenBright: [102, 49],
  bgYellowBright: [103, 49],
  bgBlueBright: [104, 49],
  bgMagentaBright: [105, 49],
  bgCyanBright: [106, 49],
  bgWhiteBright: [107, 49]
}, _r = Object.entries(Er);
function ve(e) {
  return String(e);
}
c(ve, "a");
ve.open = "";
ve.close = "";
function Dt(e = !1) {
  let t = typeof process < "u" ? process : void 0, n = t?.env || {}, r = t?.argv || [];
  return !("NO_COLOR" in n || r.includes("--no-color")) && ("FORCE_COLOR" in n || r.includes("--color") || t?.platform === "win32" || e && n.
  TERM !== "dumb" || "CI" in n) || typeof window < "u" && !!window.chrome;
}
c(Dt, "C");
function Ft(e = !1) {
  let t = Dt(e), n = /* @__PURE__ */ c((i, l, a, m) => {
    let p = "", f = 0;
    do
      p += i.substring(f, m) + a, f = m + l.length, m = i.indexOf(l, f);
    while (~m);
    return p + i.substring(f);
  }, "i"), r = /* @__PURE__ */ c((i, l, a = i) => {
    let m = /* @__PURE__ */ c((p) => {
      let f = String(p), y = f.indexOf(l, i.length);
      return ~y ? i + n(f, l, a, y) + l : i + f + l;
    }, "o");
    return m.open = i, m.close = l, m;
  }, "g"), o = {
    isColorSupported: t
  }, s = /* @__PURE__ */ c((i) => `\x1B[${i}m`, "d");
  for (let [i, l] of _r)
    o[i] = t ? r(
      s(l[0]),
      s(l[1]),
      l[2]
    ) : ve;
  return o;
}
c(Ft, "p");

// ../node_modules/tinyrainbow/dist/node.js
var jt = require("tty");
var Cr = process.env.FORCE_TTY !== void 0 || (0, jt.isatty)(1);
var ne = Ft(Cr);

// ../node_modules/@vitest/pretty-format/dist/index.js
function Qt(e, t) {
  return t.forEach(function(n) {
    n && typeof n != "string" && !Array.isArray(n) && Object.keys(n).forEach(function(r) {
      if (r !== "default" && !(r in e)) {
        var o = Object.getOwnPropertyDescriptor(n, r);
        Object.defineProperty(e, r, o.get ? o : {
          enumerable: !0,
          get: /* @__PURE__ */ c(function() {
            return n[r];
          }, "get")
        });
      }
    });
  }), Object.freeze(e);
}
c(Qt, "_mergeNamespaces");
function Tr(e, t) {
  let n = Object.keys(e), r = t === null ? n : n.sort(t);
  if (Object.getOwnPropertySymbols)
    for (let o of Object.getOwnPropertySymbols(e))
      Object.getOwnPropertyDescriptor(e, o).enumerable && r.push(o);
  return r;
}
c(Tr, "getKeysOfEnumerableProperties");
function Te(e, t, n, r, o, s, i = ": ") {
  let l = "", a = 0, m = e.next();
  if (!m.done) {
    l += t.spacingOuter;
    let p = n + t.indent;
    for (; !m.done; ) {
      if (l += p, a++ === t.maxWidth) {
        l += "\u2026";
        break;
      }
      let f = s(m.value[0], t, p, r, o), y = s(m.value[1], t, p, r, o);
      l += f + i + y, m = e.next(), m.done ? t.min || (l += ",") : l += `,${t.spacingInner}`;
    }
    l += t.spacingOuter + n;
  }
  return l;
}
c(Te, "printIteratorEntries");
function nt(e, t, n, r, o, s) {
  let i = "", l = 0, a = e.next();
  if (!a.done) {
    i += t.spacingOuter;
    let m = n + t.indent;
    for (; !a.done; ) {
      if (i += m, l++ === t.maxWidth) {
        i += "\u2026";
        break;
      }
      i += s(a.value, t, m, r, o), a = e.next(), a.done ? t.min || (i += ",") : i += `,${t.spacingInner}`;
    }
    i += t.spacingOuter + n;
  }
  return i;
}
c(nt, "printIteratorValues");
function xe(e, t, n, r, o, s) {
  let i = "";
  e = e instanceof ArrayBuffer ? new DataView(e) : e;
  let l = /* @__PURE__ */ c((m) => m instanceof DataView, "isDataView"), a = l(e) ? e.byteLength : e.length;
  if (a > 0) {
    i += t.spacingOuter;
    let m = n + t.indent;
    for (let p = 0; p < a; p++) {
      if (i += m, p === t.maxWidth) {
        i += "\u2026";
        break;
      }
      (l(e) || p in e) && (i += s(l(e) ? e.getInt8(p) : e[p], t, m, r, o)), p < a - 1 ? i += `,${t.spacingInner}` : t.min || (i += ",");
    }
    i += t.spacingOuter + n;
  }
  return i;
}
c(xe, "printListItems");
function rt(e, t, n, r, o, s) {
  let i = "", l = Tr(e, t.compareKeys);
  if (l.length > 0) {
    i += t.spacingOuter;
    let a = n + t.indent;
    for (let m = 0; m < l.length; m++) {
      let p = l[m], f = s(p, t, a, r, o), y = s(e[p], t, a, r, o);
      i += `${a + f}: ${y}`, m < l.length - 1 ? i += `,${t.spacingInner}` : t.min || (i += ",");
    }
    i += t.spacingOuter + n;
  }
  return i;
}
c(rt, "printObjectProperties");
var Or = typeof Symbol == "function" && Symbol.for ? Symbol.for("jest.asymmetricMatcher") : 1267621, Ne = " ", $r = /* @__PURE__ */ c((e, t, n, r, o, s) => {
  let i = e.toString();
  if (i === "ArrayContaining" || i === "ArrayNotContaining")
    return ++r > t.maxDepth ? `[${i}]` : `${i + Ne}[${xe(e.sample, t, n, r, o, s)}]`;
  if (i === "ObjectContaining" || i === "ObjectNotContaining")
    return ++r > t.maxDepth ? `[${i}]` : `${i + Ne}{${rt(e.sample, t, n, r, o, s)}}`;
  if (i === "StringMatching" || i === "StringNotMatching" || i === "StringContaining" || i === "StringNotContaining")
    return i + Ne + s(e.sample, t, n, r, o);
  if (typeof e.toAsymmetricMatcher != "function")
    throw new TypeError(`Asymmetric matcher ${e.constructor.name} does not implement toAsymmetricMatcher()`);
  return e.toAsymmetricMatcher();
}, "serialize$5"), wr = /* @__PURE__ */ c((e) => e && e.$$typeof === Or, "test$5"), Rr = {
  serialize: $r,
  test: wr
}, Ar = " ", vt = /* @__PURE__ */ new Set(["DOMStringMap", "NamedNodeMap"]), Pr = /^(?:HTML\w*Collection|NodeList)$/;
function Nr(e) {
  return vt.has(e) || Pr.test(e);
}
c(Nr, "testName");
var Ir = /* @__PURE__ */ c((e) => e && e.constructor && !!e.constructor.name && Nr(e.constructor.name), "test$4");
function Mr(e) {
  return e.constructor.name === "NamedNodeMap";
}
c(Mr, "isNamedNodeMap");
var Lr = /* @__PURE__ */ c((e, t, n, r, o, s) => {
  let i = e.constructor.name;
  return ++r > t.maxDepth ? `[${i}]` : (t.min ? "" : i + Ar) + (vt.has(i) ? `{${rt(Mr(e) ? [...e].reduce((l, a) => (l[a.name] = a.value, l),
  {}) : { ...e }, t, n, r, o, s)}}` : `[${xe([...e], t, n, r, o, s)}]`);
}, "serialize$4"), xr = {
  serialize: Lr,
  test: Ir
};
function en(e) {
  return e.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
c(en, "escapeHTML");
function ot(e, t, n, r, o, s, i) {
  let l = r + n.indent, a = n.colors;
  return e.map((m) => {
    let p = t[m], f = i(p, n, l, o, s);
    return typeof p != "string" && (f.includes(`
`) && (f = n.spacingOuter + l + f + n.spacingOuter + r), f = `{${f}}`), `${n.spacingInner + r + a.prop.open + m + a.prop.close}=${a.value.open}${f}${a.
    value.close}`;
  }).join("");
}
c(ot, "printProps");
function st(e, t, n, r, o, s) {
  return e.map((i) => t.spacingOuter + n + (typeof i == "string" ? tn(i, t) : s(i, t, n, r, o))).join("");
}
c(st, "printChildren");
function tn(e, t) {
  let n = t.colors.content;
  return n.open + en(e) + n.close;
}
c(tn, "printText");
function Dr(e, t) {
  let n = t.colors.comment;
  return `${n.open}<!--${en(e)}-->${n.close}`;
}
c(Dr, "printComment");
function it(e, t, n, r, o) {
  let s = r.colors.tag;
  return `${s.open}<${e}${t && s.close + t + r.spacingOuter + o + s.open}${n ? `>${s.close}${n}${r.spacingOuter}${o}${s.open}</${e}` : `${t &&
  !r.min ? "" : " "}/`}>${s.close}`;
}
c(it, "printElement");
function ct(e, t) {
  let n = t.colors.tag;
  return `${n.open}<${e}${n.close} \u2026${n.open} />${n.close}`;
}
c(ct, "printElementAsLeaf");
var Fr = 1, nn = 3, rn = 8, on = 11, jr = /^(?:(?:HTML|SVG)\w*)?Element$/;
function Br(e) {
  try {
    return typeof e.hasAttribute == "function" && e.hasAttribute("is");
  } catch {
    return !1;
  }
}
c(Br, "testHasAttribute");
function kr(e) {
  let t = e.constructor.name, { nodeType: n, tagName: r } = e, o = typeof r == "string" && r.includes("-") || Br(e);
  return n === Fr && (jr.test(t) || o) || n === nn && t === "Text" || n === rn && t === "Comment" || n === on && t === "DocumentFragment";
}
c(kr, "testNode");
var zr = /* @__PURE__ */ c((e) => {
  var t;
  return (e == null || (t = e.constructor) === null || t === void 0 ? void 0 : t.name) && kr(e);
}, "test$3");
function Yr(e) {
  return e.nodeType === nn;
}
c(Yr, "nodeIsText");
function Ur(e) {
  return e.nodeType === rn;
}
c(Ur, "nodeIsComment");
function et(e) {
  return e.nodeType === on;
}
c(et, "nodeIsFragment");
var Wr = /* @__PURE__ */ c((e, t, n, r, o, s) => {
  if (Yr(e))
    return tn(e.data, t);
  if (Ur(e))
    return Dr(e.data, t);
  let i = et(e) ? "DocumentFragment" : e.tagName.toLowerCase();
  return ++r > t.maxDepth ? ct(i, t) : it(i, ot(et(e) ? [] : Array.from(e.attributes, (l) => l.name).sort(), et(e) ? {} : [...e.attributes].
  reduce((l, a) => (l[a.name] = a.value, l), {}), t, n + t.indent, r, o, s), st(Array.prototype.slice.call(e.childNodes || e.children), t, n +
  t.indent, r, o, s), t, n);
}, "serialize$3"), Vr = {
  serialize: Wr,
  test: zr
}, qr = "@@__IMMUTABLE_ITERABLE__@@", Kr = "@@__IMMUTABLE_LIST__@@", Gr = "@@__IMMUTABLE_KEYED__@@", Hr = "@@__IMMUTABLE_MAP__@@", Bt = "@@_\
_IMMUTABLE_ORDERED__@@", Jr = "@@__IMMUTABLE_RECORD__@@", Xr = "@@__IMMUTABLE_SEQ__@@", Zr = "@@__IMMUTABLE_SET__@@", Qr = "@@__IMMUTABLE_ST\
ACK__@@", Se = /* @__PURE__ */ c((e) => `Immutable.${e}`, "getImmutableName"), Fe = /* @__PURE__ */ c((e) => `[${e}]`, "printAsLeaf"), Ce = "\
 ", kt = "\u2026";
function vr(e, t, n, r, o, s, i) {
  return ++r > t.maxDepth ? Fe(Se(i)) : `${Se(i) + Ce}{${Te(e.entries(), t, n, r, o, s)}}`;
}
c(vr, "printImmutableEntries");
function eo(e) {
  let t = 0;
  return { next() {
    if (t < e._keys.length) {
      let n = e._keys[t++];
      return {
        done: !1,
        value: [n, e.get(n)]
      };
    }
    return {
      done: !0,
      value: void 0
    };
  } };
}
c(eo, "getRecordEntries");
function to(e, t, n, r, o, s) {
  let i = Se(e._name || "Record");
  return ++r > t.maxDepth ? Fe(i) : `${i + Ce}{${Te(eo(e), t, n, r, o, s)}}`;
}
c(to, "printImmutableRecord");
function no(e, t, n, r, o, s) {
  let i = Se("Seq");
  return ++r > t.maxDepth ? Fe(i) : e[Gr] ? `${i + Ce}{${e._iter || e._object ? Te(e.entries(), t, n, r, o, s) : kt}}` : `${i + Ce}[${e._iter ||
  e._array || e._collection || e._iterable ? nt(e.values(), t, n, r, o, s) : kt}]`;
}
c(no, "printImmutableSeq");
function tt(e, t, n, r, o, s, i) {
  return ++r > t.maxDepth ? Fe(Se(i)) : `${Se(i) + Ce}[${nt(e.values(), t, n, r, o, s)}]`;
}
c(tt, "printImmutableValues");
var ro = /* @__PURE__ */ c((e, t, n, r, o, s) => e[Hr] ? vr(e, t, n, r, o, s, e[Bt] ? "OrderedMap" : "Map") : e[Kr] ? tt(e, t, n, r, o, s, "\
List") : e[Zr] ? tt(e, t, n, r, o, s, e[Bt] ? "OrderedSet" : "Set") : e[Qr] ? tt(e, t, n, r, o, s, "Stack") : e[Xr] ? no(e, t, n, r, o, s) :
to(e, t, n, r, o, s), "serialize$2"), oo = /* @__PURE__ */ c((e) => e && (e[qr] === !0 || e[Jr] === !0), "test$2"), so = {
  serialize: ro,
  test: oo
};
function sn(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
c(sn, "getDefaultExportFromCjs");
var Ie = { exports: {} }, P = {};
var zt;
function io() {
  if (zt) return P;
  zt = 1;
  var e = Symbol.for("react.transitional.element"), t = Symbol.for("react.portal"), n = Symbol.for("react.fragment"), r = Symbol.for("react.\
strict_mode"), o = Symbol.for("react.profiler"), s = Symbol.for("react.consumer"), i = Symbol.for("react.context"), l = Symbol.for("react.fo\
rward_ref"), a = Symbol.for("react.suspense"), m = Symbol.for("react.suspense_list"), p = Symbol.for("react.memo"), f = Symbol.for("react.la\
zy"), y = Symbol.for("react.view_transition"), d = Symbol.for("react.client.reference");
  function g(u) {
    if (typeof u == "object" && u !== null) {
      var h = u.$$typeof;
      switch (h) {
        case e:
          switch (u = u.type, u) {
            case n:
            case o:
            case r:
            case a:
            case m:
            case y:
              return u;
            default:
              switch (u = u && u.$$typeof, u) {
                case i:
                case l:
                case f:
                case p:
                  return u;
                case s:
                  return u;
                default:
                  return h;
              }
          }
        case t:
          return h;
      }
    }
  }
  return c(g, "typeOf"), P.ContextConsumer = s, P.ContextProvider = i, P.Element = e, P.ForwardRef = l, P.Fragment = n, P.Lazy = f, P.Memo =
  p, P.Portal = t, P.Profiler = o, P.StrictMode = r, P.Suspense = a, P.SuspenseList = m, P.isContextConsumer = function(u) {
    return g(u) === s;
  }, P.isContextProvider = function(u) {
    return g(u) === i;
  }, P.isElement = function(u) {
    return typeof u == "object" && u !== null && u.$$typeof === e;
  }, P.isForwardRef = function(u) {
    return g(u) === l;
  }, P.isFragment = function(u) {
    return g(u) === n;
  }, P.isLazy = function(u) {
    return g(u) === f;
  }, P.isMemo = function(u) {
    return g(u) === p;
  }, P.isPortal = function(u) {
    return g(u) === t;
  }, P.isProfiler = function(u) {
    return g(u) === o;
  }, P.isStrictMode = function(u) {
    return g(u) === r;
  }, P.isSuspense = function(u) {
    return g(u) === a;
  }, P.isSuspenseList = function(u) {
    return g(u) === m;
  }, P.isValidElementType = function(u) {
    return typeof u == "string" || typeof u == "function" || u === n || u === o || u === r || u === a || u === m || typeof u == "object" && u !==
    null && (u.$$typeof === f || u.$$typeof === p || u.$$typeof === i || u.$$typeof === s || u.$$typeof === l || u.$$typeof === d || u.getModuleId !==
    void 0);
  }, P.typeOf = g, P;
}
c(io, "requireReactIs_production");
var N = {};
var Yt;
function co() {
  return Yt || (Yt = 1, process.env.NODE_ENV !== "production" && function() {
    function e(u) {
      if (typeof u == "object" && u !== null) {
        var h = u.$$typeof;
        switch (h) {
          case t:
            switch (u = u.type, u) {
              case r:
              case s:
              case o:
              case m:
              case p:
              case d:
                return u;
              default:
                switch (u = u && u.$$typeof, u) {
                  case l:
                  case a:
                  case y:
                  case f:
                    return u;
                  case i:
                    return u;
                  default:
                    return h;
                }
            }
          case n:
            return h;
        }
      }
    }
    c(e, "typeOf");
    var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), o = Symbol.for("reac\
t.strict_mode"), s = Symbol.for("react.profiler"), i = Symbol.for("react.consumer"), l = Symbol.for("react.context"), a = Symbol.for("react.\
forward_ref"), m = Symbol.for("react.suspense"), p = Symbol.for("react.suspense_list"), f = Symbol.for("react.memo"), y = Symbol.for("react.\
lazy"), d = Symbol.for("react.view_transition"), g = Symbol.for("react.client.reference");
    N.ContextConsumer = i, N.ContextProvider = l, N.Element = t, N.ForwardRef = a, N.Fragment = r, N.Lazy = y, N.Memo = f, N.Portal = n, N.Profiler =
    s, N.StrictMode = o, N.Suspense = m, N.SuspenseList = p, N.isContextConsumer = function(u) {
      return e(u) === i;
    }, N.isContextProvider = function(u) {
      return e(u) === l;
    }, N.isElement = function(u) {
      return typeof u == "object" && u !== null && u.$$typeof === t;
    }, N.isForwardRef = function(u) {
      return e(u) === a;
    }, N.isFragment = function(u) {
      return e(u) === r;
    }, N.isLazy = function(u) {
      return e(u) === y;
    }, N.isMemo = function(u) {
      return e(u) === f;
    }, N.isPortal = function(u) {
      return e(u) === n;
    }, N.isProfiler = function(u) {
      return e(u) === s;
    }, N.isStrictMode = function(u) {
      return e(u) === o;
    }, N.isSuspense = function(u) {
      return e(u) === m;
    }, N.isSuspenseList = function(u) {
      return e(u) === p;
    }, N.isValidElementType = function(u) {
      return typeof u == "string" || typeof u == "function" || u === r || u === s || u === o || u === m || u === p || typeof u == "object" &&
      u !== null && (u.$$typeof === y || u.$$typeof === f || u.$$typeof === l || u.$$typeof === i || u.$$typeof === a || u.$$typeof === g ||
      u.getModuleId !== void 0);
    }, N.typeOf = e;
  }()), N;
}
c(co, "requireReactIs_development$1");
var Ut;
function uo() {
  return Ut || (Ut = 1, process.env.NODE_ENV === "production" ? Ie.exports = io() : Ie.exports = co()), Ie.exports;
}
c(uo, "requireReactIs$1");
var cn = uo(), ao = /* @__PURE__ */ sn(cn), lo = /* @__PURE__ */ Qt({
  __proto__: null,
  default: ao
}, [cn]), Me = { exports: {} }, w = {};
var Wt;
function fo() {
  if (Wt) return w;
  Wt = 1;
  var e = Symbol.for("react.element"), t = Symbol.for("react.portal"), n = Symbol.for("react.fragment"), r = Symbol.for("react.strict_mode"),
  o = Symbol.for("react.profiler"), s = Symbol.for("react.provider"), i = Symbol.for("react.context"), l = Symbol.for("react.server_context"),
  a = Symbol.for("react.forward_ref"), m = Symbol.for("react.suspense"), p = Symbol.for("react.suspense_list"), f = Symbol.for("react.memo"),
  y = Symbol.for("react.lazy"), d = Symbol.for("react.offscreen"), g;
  g = Symbol.for("react.module.reference");
  function u(h) {
    if (typeof h == "object" && h !== null) {
      var S = h.$$typeof;
      switch (S) {
        case e:
          switch (h = h.type, h) {
            case n:
            case o:
            case r:
            case m:
            case p:
              return h;
            default:
              switch (h = h && h.$$typeof, h) {
                case l:
                case i:
                case a:
                case y:
                case f:
                case s:
                  return h;
                default:
                  return S;
              }
          }
        case t:
          return S;
      }
    }
  }
  return c(u, "v"), w.ContextConsumer = i, w.ContextProvider = s, w.Element = e, w.ForwardRef = a, w.Fragment = n, w.Lazy = y, w.Memo = f, w.
  Portal = t, w.Profiler = o, w.StrictMode = r, w.Suspense = m, w.SuspenseList = p, w.isAsyncMode = function() {
    return !1;
  }, w.isConcurrentMode = function() {
    return !1;
  }, w.isContextConsumer = function(h) {
    return u(h) === i;
  }, w.isContextProvider = function(h) {
    return u(h) === s;
  }, w.isElement = function(h) {
    return typeof h == "object" && h !== null && h.$$typeof === e;
  }, w.isForwardRef = function(h) {
    return u(h) === a;
  }, w.isFragment = function(h) {
    return u(h) === n;
  }, w.isLazy = function(h) {
    return u(h) === y;
  }, w.isMemo = function(h) {
    return u(h) === f;
  }, w.isPortal = function(h) {
    return u(h) === t;
  }, w.isProfiler = function(h) {
    return u(h) === o;
  }, w.isStrictMode = function(h) {
    return u(h) === r;
  }, w.isSuspense = function(h) {
    return u(h) === m;
  }, w.isSuspenseList = function(h) {
    return u(h) === p;
  }, w.isValidElementType = function(h) {
    return typeof h == "string" || typeof h == "function" || h === n || h === o || h === r || h === m || h === p || h === d || typeof h == "\
object" && h !== null && (h.$$typeof === y || h.$$typeof === f || h.$$typeof === s || h.$$typeof === i || h.$$typeof === a || h.$$typeof ===
    g || h.getModuleId !== void 0);
  }, w.typeOf = u, w;
}
c(fo, "requireReactIs_production_min");
var R = {};
var Vt;
function mo() {
  return Vt || (Vt = 1, process.env.NODE_ENV !== "production" && function() {
    var e = Symbol.for("react.element"), t = Symbol.for("react.portal"), n = Symbol.for("react.fragment"), r = Symbol.for("react.strict_mode"),
    o = Symbol.for("react.profiler"), s = Symbol.for("react.provider"), i = Symbol.for("react.context"), l = Symbol.for("react.server_contex\
t"), a = Symbol.for("react.forward_ref"), m = Symbol.for("react.suspense"), p = Symbol.for("react.suspense_list"), f = Symbol.for("react.mem\
o"), y = Symbol.for("react.lazy"), d = Symbol.for("react.offscreen"), g = !1, u = !1, h = !1, S = !1, _ = !1, O;
    O = Symbol.for("react.module.reference");
    function b(T) {
      return !!(typeof T == "string" || typeof T == "function" || T === n || T === o || _ || T === r || T === m || T === p || S || T === d ||
      g || u || h || typeof T == "object" && T !== null && (T.$$typeof === y || T.$$typeof === f || T.$$typeof === s || T.$$typeof === i || T.
      $$typeof === a || // This needs to include all possible module reference object
      // types supported by any Flight configuration anywhere since
      // we don't know which Flight build this will end up being used
      // with.
      T.$$typeof === O || T.getModuleId !== void 0));
    }
    c(b, "isValidElementType");
    function E(T) {
      if (typeof T == "object" && T !== null) {
        var Qe = T.$$typeof;
        switch (Qe) {
          case e:
            var Ae = T.type;
            switch (Ae) {
              case n:
              case o:
              case r:
              case m:
              case p:
                return Ae;
              default:
                var xt = Ae && Ae.$$typeof;
                switch (xt) {
                  case l:
                  case i:
                  case a:
                  case y:
                  case f:
                  case s:
                    return xt;
                  default:
                    return Qe;
                }
            }
          case t:
            return Qe;
        }
      }
    }
    c(E, "typeOf");
    var $ = i, C = s, A = e, J = a, te = n, L = y, z = f, X = t, W = o, M = r, D = m, F = p, Z = !1, B = !1;
    function q(T) {
      return Z || (Z = !0, console.warn("The ReactIs.isAsyncMode() alias has been deprecated, and will be removed in React 18+.")), !1;
    }
    c(q, "isAsyncMode");
    function se(T) {
      return B || (B = !0, console.warn("The ReactIs.isConcurrentMode() alias has been deprecated, and will be removed in React 18+.")), !1;
    }
    c(se, "isConcurrentMode");
    function K(T) {
      return E(T) === i;
    }
    c(K, "isContextConsumer");
    function G(T) {
      return E(T) === s;
    }
    c(G, "isContextProvider");
    function ce(T) {
      return typeof T == "object" && T !== null && T.$$typeof === e;
    }
    c(ce, "isElement");
    function Q(T) {
      return E(T) === a;
    }
    c(Q, "isForwardRef");
    function V(T) {
      return E(T) === n;
    }
    c(V, "isFragment");
    function ie(T) {
      return E(T) === y;
    }
    c(ie, "isLazy");
    function be(T) {
      return E(T) === f;
    }
    c(be, "isMemo");
    function le(T) {
      return E(T) === t;
    }
    c(le, "isPortal");
    function _e(T) {
      return E(T) === o;
    }
    c(_e, "isProfiler");
    function we(T) {
      return E(T) === r;
    }
    c(we, "isStrictMode");
    function Re(T) {
      return E(T) === m;
    }
    c(Re, "isSuspense");
    function pr(T) {
      return E(T) === p;
    }
    c(pr, "isSuspenseList"), R.ContextConsumer = $, R.ContextProvider = C, R.Element = A, R.ForwardRef = J, R.Fragment = te, R.Lazy = L, R.Memo =
    z, R.Portal = X, R.Profiler = W, R.StrictMode = M, R.Suspense = D, R.SuspenseList = F, R.isAsyncMode = q, R.isConcurrentMode = se, R.isContextConsumer =
    K, R.isContextProvider = G, R.isElement = ce, R.isForwardRef = Q, R.isFragment = V, R.isLazy = ie, R.isMemo = be, R.isPortal = le, R.isProfiler =
    _e, R.isStrictMode = we, R.isSuspense = Re, R.isSuspenseList = pr, R.isValidElementType = b, R.typeOf = E;
  }()), R;
}
c(mo, "requireReactIs_development");
var qt;
function po() {
  return qt || (qt = 1, process.env.NODE_ENV === "production" ? Me.exports = fo() : Me.exports = mo()), Me.exports;
}
c(po, "requireReactIs");
var un = po(), go = /* @__PURE__ */ sn(un), ho = /* @__PURE__ */ Qt({
  __proto__: null,
  default: go
}, [un]), yo = [
  "isAsyncMode",
  "isConcurrentMode",
  "isContextConsumer",
  "isContextProvider",
  "isElement",
  "isForwardRef",
  "isFragment",
  "isLazy",
  "isMemo",
  "isPortal",
  "isProfiler",
  "isStrictMode",
  "isSuspense",
  "isSuspenseList",
  "isValidElementType"
], pe = Object.fromEntries(yo.map((e) => [e, (t) => ho[e](t) || lo[e](t)]));
function an(e, t = []) {
  if (Array.isArray(e))
    for (let n of e)
      an(n, t);
  else e != null && e !== !1 && e !== "" && t.push(e);
  return t;
}
c(an, "getChildren");
function Kt(e) {
  let t = e.type;
  if (typeof t == "string")
    return t;
  if (typeof t == "function")
    return t.displayName || t.name || "Unknown";
  if (pe.isFragment(e))
    return "React.Fragment";
  if (pe.isSuspense(e))
    return "React.Suspense";
  if (typeof t == "object" && t !== null) {
    if (pe.isContextProvider(e))
      return "Context.Provider";
    if (pe.isContextConsumer(e))
      return "Context.Consumer";
    if (pe.isForwardRef(e)) {
      if (t.displayName)
        return t.displayName;
      let n = t.render.displayName || t.render.name || "";
      return n === "" ? "ForwardRef" : `ForwardRef(${n})`;
    }
    if (pe.isMemo(e)) {
      let n = t.displayName || t.type.displayName || t.type.name || "";
      return n === "" ? "Memo" : `Memo(${n})`;
    }
  }
  return "UNDEFINED";
}
c(Kt, "getType");
function bo(e) {
  let { props: t } = e;
  return Object.keys(t).filter((n) => n !== "children" && t[n] !== void 0).sort();
}
c(bo, "getPropKeys$1");
var So = /* @__PURE__ */ c((e, t, n, r, o, s) => ++r > t.maxDepth ? ct(Kt(e), t) : it(Kt(e), ot(bo(e), e.props, t, n + t.indent, r, o, s), st(
an(e.props.children), t, n + t.indent, r, o, s), t, n), "serialize$1"), Eo = /* @__PURE__ */ c((e) => e != null && pe.isElement(e), "test$1"),
_o = {
  serialize: So,
  test: Eo
}, Co = typeof Symbol == "function" && Symbol.for ? Symbol.for("react.test.json") : 245830487;
function To(e) {
  let { props: t } = e;
  return t ? Object.keys(t).filter((n) => t[n] !== void 0).sort() : [];
}
c(To, "getPropKeys");
var Oo = /* @__PURE__ */ c((e, t, n, r, o, s) => ++r > t.maxDepth ? ct(e.type, t) : it(e.type, e.props ? ot(To(e), e.props, t, n + t.indent,
r, o, s) : "", e.children ? st(e.children, t, n + t.indent, r, o, s) : "", t, n), "serialize"), $o = /* @__PURE__ */ c((e) => e && e.$$typeof ===
Co, "test"), wo = {
  serialize: Oo,
  test: $o
}, ln = Object.prototype.toString, Ro = Date.prototype.toISOString, Ao = Error.prototype.toString, Gt = RegExp.prototype.toString;
function Le(e) {
  return typeof e.constructor == "function" && e.constructor.name || "Object";
}
c(Le, "getConstructorName");
function Po(e) {
  return typeof window < "u" && e === window;
}
c(Po, "isWindow");
var No = /^Symbol\((.*)\)(.*)$/, Io = /\n/g, De = class extends Error {
  static {
    c(this, "PrettyFormatPluginError");
  }
  constructor(t, n) {
    super(t), this.stack = n, this.name = this.constructor.name;
  }
};
function Mo(e) {
  return e === "[object Array]" || e === "[object ArrayBuffer]" || e === "[object DataView]" || e === "[object Float32Array]" || e === "[obj\
ect Float64Array]" || e === "[object Int8Array]" || e === "[object Int16Array]" || e === "[object Int32Array]" || e === "[object Uint8Array]" ||
  e === "[object Uint8ClampedArray]" || e === "[object Uint16Array]" || e === "[object Uint32Array]";
}
c(Mo, "isToStringedArrayType");
function Lo(e) {
  return Object.is(e, -0) ? "-0" : String(e);
}
c(Lo, "printNumber");
function xo(e) {
  return `${e}n`;
}
c(xo, "printBigInt");
function Ht(e, t) {
  return t ? `[Function ${e.name || "anonymous"}]` : "[Function]";
}
c(Ht, "printFunction");
function Jt(e) {
  return String(e).replace(No, "Symbol($1)");
}
c(Jt, "printSymbol");
function Xt(e) {
  return `[${Ao.call(e)}]`;
}
c(Xt, "printError");
function fn(e, t, n, r) {
  if (e === !0 || e === !1)
    return `${e}`;
  if (e === void 0)
    return "undefined";
  if (e === null)
    return "null";
  let o = typeof e;
  if (o === "number")
    return Lo(e);
  if (o === "bigint")
    return xo(e);
  if (o === "string")
    return r ? `"${e.replaceAll(/"|\\/g, "\\$&")}"` : `"${e}"`;
  if (o === "function")
    return Ht(e, t);
  if (o === "symbol")
    return Jt(e);
  let s = ln.call(e);
  return s === "[object WeakMap]" ? "WeakMap {}" : s === "[object WeakSet]" ? "WeakSet {}" : s === "[object Function]" || s === "[object Gen\
eratorFunction]" ? Ht(e, t) : s === "[object Symbol]" ? Jt(e) : s === "[object Date]" ? Number.isNaN(+e) ? "Date { NaN }" : Ro.call(e) : s ===
  "[object Error]" ? Xt(e) : s === "[object RegExp]" ? n ? Gt.call(e).replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&") : Gt.call(e) : e instanceof Error ?
  Xt(e) : null;
}
c(fn, "printBasicValue");
function mn(e, t, n, r, o, s) {
  if (o.includes(e))
    return "[Circular]";
  o = [...o], o.push(e);
  let i = ++r > t.maxDepth, l = t.min;
  if (t.callToJSON && !i && e.toJSON && typeof e.toJSON == "function" && !s)
    return fe(e.toJSON(), t, n, r, o, !0);
  let a = ln.call(e);
  return a === "[object Arguments]" ? i ? "[Arguments]" : `${l ? "" : "Arguments "}[${xe(e, t, n, r, o, fe)}]` : Mo(a) ? i ? `[${e.constructor.
  name}]` : `${l || !t.printBasicPrototype && e.constructor.name === "Array" ? "" : `${e.constructor.name} `}[${xe(e, t, n, r, o, fe)}]` : a ===
  "[object Map]" ? i ? "[Map]" : `Map {${Te(e.entries(), t, n, r, o, fe, " => ")}}` : a === "[object Set]" ? i ? "[Set]" : `Set {${nt(e.values(),
  t, n, r, o, fe)}}` : i || Po(e) ? `[${Le(e)}]` : `${l || !t.printBasicPrototype && Le(e) === "Object" ? "" : `${Le(e)} `}{${rt(e, t, n, r,
  o, fe)}}`;
}
c(mn, "printComplexValue");
var Do = {
  test: /* @__PURE__ */ c((e) => e && e instanceof Error, "test"),
  serialize(e, t, n, r, o, s) {
    if (o.includes(e))
      return "[Circular]";
    o = [...o, e];
    let i = ++r > t.maxDepth, { message: l, cause: a, ...m } = e, p = {
      message: l,
      ...typeof a < "u" ? { cause: a } : {},
      ...e instanceof AggregateError ? { errors: e.errors } : {},
      ...m
    }, f = e.name !== "Error" ? e.name : Le(e);
    return i ? `[${f}]` : `${f} {${Te(Object.entries(p).values(), t, n, r, o, s)}}`;
  }
};
function Fo(e) {
  return e.serialize != null;
}
c(Fo, "isNewPlugin");
function pn(e, t, n, r, o, s) {
  let i;
  try {
    i = Fo(e) ? e.serialize(t, n, r, o, s, fe) : e.print(t, (l) => fe(l, n, r, o, s), (l) => {
      let a = r + n.indent;
      return a + l.replaceAll(Io, `
${a}`);
    }, {
      edgeSpacing: n.spacingOuter,
      min: n.min,
      spacing: n.spacingInner
    }, n.colors);
  } catch (l) {
    throw new De(l.message, l.stack);
  }
  if (typeof i != "string")
    throw new TypeError(`pretty-format: Plugin must return type "string" but instead returned "${typeof i}".`);
  return i;
}
c(pn, "printPlugin");
function gn(e, t) {
  for (let n of e)
    try {
      if (n.test(t))
        return n;
    } catch (r) {
      throw new De(r.message, r.stack);
    }
  return null;
}
c(gn, "findPlugin");
function fe(e, t, n, r, o, s) {
  let i = gn(t.plugins, e);
  if (i !== null)
    return pn(i, e, t, n, r, o);
  let l = fn(e, t.printFunctionName, t.escapeRegex, t.escapeString);
  return l !== null ? l : mn(e, t, n, r, o, s);
}
c(fe, "printer");
var ut = {
  comment: "gray",
  content: "reset",
  prop: "yellow",
  tag: "cyan",
  value: "green"
}, hn = Object.keys(ut), re = {
  callToJSON: !0,
  compareKeys: void 0,
  escapeRegex: !1,
  escapeString: !0,
  highlight: !1,
  indent: 2,
  maxDepth: Number.POSITIVE_INFINITY,
  maxWidth: Number.POSITIVE_INFINITY,
  min: !1,
  plugins: [],
  printBasicPrototype: !0,
  printFunctionName: !0,
  theme: ut
};
function jo(e) {
  for (let t of Object.keys(e))
    if (!Object.prototype.hasOwnProperty.call(re, t))
      throw new Error(`pretty-format: Unknown option "${t}".`);
  if (e.min && e.indent !== void 0 && e.indent !== 0)
    throw new Error('pretty-format: Options "min" and "indent" cannot be used together.');
}
c(jo, "validateOptions");
function Bo() {
  return hn.reduce((e, t) => {
    let n = ut[t], r = n && ne[n];
    if (r && typeof r.close == "string" && typeof r.open == "string")
      e[t] = r;
    else
      throw new Error(`pretty-format: Option "theme" has a key "${t}" whose value "${n}" is undefined in ansi-styles.`);
    return e;
  }, /* @__PURE__ */ Object.create(null));
}
c(Bo, "getColorsHighlight");
function ko() {
  return hn.reduce((e, t) => (e[t] = {
    close: "",
    open: ""
  }, e), /* @__PURE__ */ Object.create(null));
}
c(ko, "getColorsEmpty");
function dn(e) {
  return e?.printFunctionName ?? re.printFunctionName;
}
c(dn, "getPrintFunctionName");
function yn(e) {
  return e?.escapeRegex ?? re.escapeRegex;
}
c(yn, "getEscapeRegex");
function bn(e) {
  return e?.escapeString ?? re.escapeString;
}
c(bn, "getEscapeString");
function Zt(e) {
  return {
    callToJSON: e?.callToJSON ?? re.callToJSON,
    colors: e?.highlight ? Bo() : ko(),
    compareKeys: typeof e?.compareKeys == "function" || e?.compareKeys === null ? e.compareKeys : re.compareKeys,
    escapeRegex: yn(e),
    escapeString: bn(e),
    indent: e?.min ? "" : zo(e?.indent ?? re.indent),
    maxDepth: e?.maxDepth ?? re.maxDepth,
    maxWidth: e?.maxWidth ?? re.maxWidth,
    min: e?.min ?? re.min,
    plugins: e?.plugins ?? re.plugins,
    printBasicPrototype: e?.printBasicPrototype ?? !0,
    printFunctionName: dn(e),
    spacingInner: e?.min ? " " : `
`,
    spacingOuter: e?.min ? "" : `
`
  };
}
c(Zt, "getConfig");
function zo(e) {
  return Array.from({ length: e + 1 }).join(" ");
}
c(zo, "createIndent");
function v(e, t) {
  if (t && (jo(t), t.plugins)) {
    let r = gn(t.plugins, e);
    if (r !== null)
      return pn(r, e, Zt(t), "", 0, []);
  }
  let n = fn(e, dn(t), yn(t), bn(t));
  return n !== null ? n : mn(e, Zt(t), "", 0, []);
}
c(v, "format");
var Oe = {
  AsymmetricMatcher: Rr,
  DOMCollection: xr,
  DOMElement: Vr,
  Immutable: so,
  ReactElement: _o,
  ReactTestComponent: wo,
  Error: Do
};

// ../node_modules/loupe/lib/helpers.js
var Sn = {
  bold: ["1", "22"],
  dim: ["2", "22"],
  italic: ["3", "23"],
  underline: ["4", "24"],
  // 5 & 6 are blinking
  inverse: ["7", "27"],
  hidden: ["8", "28"],
  strike: ["9", "29"],
  // 10-20 are fonts
  // 21-29 are resets for 1-9
  black: ["30", "39"],
  red: ["31", "39"],
  green: ["32", "39"],
  yellow: ["33", "39"],
  blue: ["34", "39"],
  magenta: ["35", "39"],
  cyan: ["36", "39"],
  white: ["37", "39"],
  brightblack: ["30;1", "39"],
  brightred: ["31;1", "39"],
  brightgreen: ["32;1", "39"],
  brightyellow: ["33;1", "39"],
  brightblue: ["34;1", "39"],
  brightmagenta: ["35;1", "39"],
  brightcyan: ["36;1", "39"],
  brightwhite: ["37;1", "39"],
  grey: ["90", "39"]
}, Yo = {
  special: "cyan",
  number: "yellow",
  bigint: "yellow",
  boolean: "yellow",
  undefined: "grey",
  null: "bold",
  string: "green",
  symbol: "green",
  date: "magenta",
  regexp: "red"
}, ue = "\u2026";
function Uo(e, t) {
  let n = Sn[Yo[t]] || Sn[t] || "";
  return n ? `\x1B[${n[0]}m${String(e)}\x1B[${n[1]}m` : String(e);
}
c(Uo, "colorise");
function En({
  showHidden: e = !1,
  depth: t = 2,
  colors: n = !1,
  customInspect: r = !0,
  showProxy: o = !1,
  maxArrayLength: s = 1 / 0,
  breakLength: i = 1 / 0,
  seen: l = [],
  // eslint-disable-next-line no-shadow
  truncate: a = 1 / 0,
  stylize: m = String
} = {}, p) {
  let f = {
    showHidden: !!e,
    depth: Number(t),
    colors: !!n,
    customInspect: !!r,
    showProxy: !!o,
    maxArrayLength: Number(s),
    breakLength: Number(i),
    truncate: Number(a),
    seen: l,
    inspect: p,
    stylize: m
  };
  return f.colors && (f.stylize = Uo), f;
}
c(En, "normaliseOptions");
function Wo(e) {
  return e >= "\uD800" && e <= "\uDBFF";
}
c(Wo, "isHighSurrogate");
function Y(e, t, n = ue) {
  e = String(e);
  let r = n.length, o = e.length;
  if (r > t && o > r)
    return n;
  if (o > t && o > r) {
    let s = t - r;
    return s > 0 && Wo(e[s - 1]) && (s = s - 1), `${e.slice(0, s)}${n}`;
  }
  return e;
}
c(Y, "truncate");
function j(e, t, n, r = ", ") {
  n = n || t.inspect;
  let o = e.length;
  if (o === 0)
    return "";
  let s = t.truncate, i = "", l = "", a = "";
  for (let m = 0; m < o; m += 1) {
    let p = m + 1 === e.length, f = m + 2 === e.length;
    a = `${ue}(${e.length - m})`;
    let y = e[m];
    t.truncate = s - i.length - (p ? 0 : r.length);
    let d = l || n(y, t) + (p ? "" : r), g = i.length + d.length, u = g + a.length;
    if (p && g > s && i.length + a.length <= s || !p && !f && u > s || (l = p ? "" : n(e[m + 1], t) + (f ? "" : r), !p && f && u > s && g + l.
    length > s))
      break;
    if (i += d, !p && !f && g + l.length >= s) {
      a = `${ue}(${e.length - m - 1})`;
      break;
    }
    a = "";
  }
  return `${i}${a}`;
}
c(j, "inspectList");
function Vo(e) {
  return e.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/) ? e : JSON.stringify(e).replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
}
c(Vo, "quoteComplexKey");
function ae([e, t], n) {
  return n.truncate -= 2, typeof e == "string" ? e = Vo(e) : typeof e != "number" && (e = `[${n.inspect(e, n)}]`), n.truncate -= e.length, t =
  n.inspect(t, n), `${e}: ${t}`;
}
c(ae, "inspectProperty");

// ../node_modules/loupe/lib/array.js
function at(e, t) {
  let n = Object.keys(e).slice(e.length);
  if (!e.length && !n.length)
    return "[]";
  t.truncate -= 4;
  let r = j(e, t);
  t.truncate -= r.length;
  let o = "";
  return n.length && (o = j(n.map((s) => [s, e[s]]), t, ae)), `[ ${r}${o ? `, ${o}` : ""} ]`;
}
c(at, "inspectArray");

// ../node_modules/loupe/lib/typedarray.js
var qo = /* @__PURE__ */ c((e) => typeof Buffer == "function" && e instanceof Buffer ? "Buffer" : e[Symbol.toStringTag] ? e[Symbol.toStringTag] :
e.constructor.name, "getArrayName");
function oe(e, t) {
  let n = qo(e);
  t.truncate -= n.length + 4;
  let r = Object.keys(e).slice(e.length);
  if (!e.length && !r.length)
    return `${n}[]`;
  let o = "";
  for (let i = 0; i < e.length; i++) {
    let l = `${t.stylize(Y(e[i], t.truncate), "number")}${i === e.length - 1 ? "" : ", "}`;
    if (t.truncate -= l.length, e[i] !== e.length && t.truncate <= 3) {
      o += `${ue}(${e.length - e[i] + 1})`;
      break;
    }
    o += l;
  }
  let s = "";
  return r.length && (s = j(r.map((i) => [i, e[i]]), t, ae)), `${n}[ ${o}${s ? `, ${s}` : ""} ]`;
}
c(oe, "inspectTypedArray");

// ../node_modules/loupe/lib/date.js
function lt(e, t) {
  let n = e.toJSON();
  if (n === null)
    return "Invalid Date";
  let r = n.split("T"), o = r[0];
  return t.stylize(`${o}T${Y(r[1], t.truncate - o.length - 1)}`, "date");
}
c(lt, "inspectDate");

// ../node_modules/loupe/lib/function.js
function je(e, t) {
  let n = e[Symbol.toStringTag] || "Function", r = e.name;
  return r ? t.stylize(`[${n} ${Y(r, t.truncate - 11)}]`, "special") : t.stylize(`[${n}]`, "special");
}
c(je, "inspectFunction");

// ../node_modules/loupe/lib/map.js
function Ko([e, t], n) {
  return n.truncate -= 4, e = n.inspect(e, n), n.truncate -= e.length, t = n.inspect(t, n), `${e} => ${t}`;
}
c(Ko, "inspectMapEntry");
function Go(e) {
  let t = [];
  return e.forEach((n, r) => {
    t.push([r, n]);
  }), t;
}
c(Go, "mapToEntries");
function ft(e, t) {
  return e.size === 0 ? "Map{}" : (t.truncate -= 7, `Map{ ${j(Go(e), t, Ko)} }`);
}
c(ft, "inspectMap");

// ../node_modules/loupe/lib/number.js
var Ho = Number.isNaN || ((e) => e !== e);
function Be(e, t) {
  return Ho(e) ? t.stylize("NaN", "number") : e === 1 / 0 ? t.stylize("Infinity", "number") : e === -1 / 0 ? t.stylize("-Infinity", "number") :
  e === 0 ? t.stylize(1 / e === 1 / 0 ? "+0" : "-0", "number") : t.stylize(Y(String(e), t.truncate), "number");
}
c(Be, "inspectNumber");

// ../node_modules/loupe/lib/bigint.js
function ke(e, t) {
  let n = Y(e.toString(), t.truncate - 1);
  return n !== ue && (n += "n"), t.stylize(n, "bigint");
}
c(ke, "inspectBigInt");

// ../node_modules/loupe/lib/regexp.js
function mt(e, t) {
  let n = e.toString().split("/")[2], r = t.truncate - (2 + n.length), o = e.source;
  return t.stylize(`/${Y(o, r)}/${n}`, "regexp");
}
c(mt, "inspectRegExp");

// ../node_modules/loupe/lib/set.js
function Jo(e) {
  let t = [];
  return e.forEach((n) => {
    t.push(n);
  }), t;
}
c(Jo, "arrayFromSet");
function pt(e, t) {
  return e.size === 0 ? "Set{}" : (t.truncate -= 7, `Set{ ${j(Jo(e), t)} }`);
}
c(pt, "inspectSet");

// ../node_modules/loupe/lib/string.js
var _n = new RegExp("['\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\u\
ffff]", "g"), Xo = {
  "\b": "\\b",
  "	": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
  "'": "\\'",
  "\\": "\\\\"
}, Zo = 16, Qo = 4;
function vo(e) {
  return Xo[e] || `\\u${`0000${e.charCodeAt(0).toString(Zo)}`.slice(-Qo)}`;
}
c(vo, "escape");
function ze(e, t) {
  return _n.test(e) && (e = e.replace(_n, vo)), t.stylize(`'${Y(e, t.truncate - 2)}'`, "string");
}
c(ze, "inspectString");

// ../node_modules/loupe/lib/symbol.js
function Ye(e) {
  return "description" in Symbol.prototype ? e.description ? `Symbol(${e.description})` : "Symbol()" : e.toString();
}
c(Ye, "inspectSymbol");

// ../node_modules/loupe/lib/promise.js
var Cn = /* @__PURE__ */ c(() => "Promise{\u2026}", "getPromiseValue");
try {
  let { getPromiseDetails: e, kPending: t, kRejected: n } = process.binding("util");
  Array.isArray(e(Promise.resolve())) && (Cn = /* @__PURE__ */ c((r, o) => {
    let [s, i] = e(r);
    return s === t ? "Promise{<pending>}" : `Promise${s === n ? "!" : ""}{${o.inspect(i, o)}}`;
  }, "getPromiseValue"));
} catch {
}
var Tn = Cn;

// ../node_modules/loupe/lib/object.js
function ge(e, t) {
  let n = Object.getOwnPropertyNames(e), r = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(e) : [];
  if (n.length === 0 && r.length === 0)
    return "{}";
  if (t.truncate -= 4, t.seen = t.seen || [], t.seen.includes(e))
    return "[Circular]";
  t.seen.push(e);
  let o = j(n.map((l) => [l, e[l]]), t, ae), s = j(r.map((l) => [l, e[l]]), t, ae);
  t.seen.pop();
  let i = "";
  return o && s && (i = ", "), `{ ${o}${i}${s} }`;
}
c(ge, "inspectObject");

// ../node_modules/loupe/lib/class.js
var gt = typeof Symbol < "u" && Symbol.toStringTag ? Symbol.toStringTag : !1;
function ht(e, t) {
  let n = "";
  return gt && gt in e && (n = e[gt]), n = n || e.constructor.name, (!n || n === "_class") && (n = "<Anonymous Class>"), t.truncate -= n.length,
  `${n}${ge(e, t)}`;
}
c(ht, "inspectClass");

// ../node_modules/loupe/lib/arguments.js
function dt(e, t) {
  return e.length === 0 ? "Arguments[]" : (t.truncate -= 13, `Arguments[ ${j(e, t)} ]`);
}
c(dt, "inspectArguments");

// ../node_modules/loupe/lib/error.js
var es = [
  "stack",
  "line",
  "column",
  "name",
  "message",
  "fileName",
  "lineNumber",
  "columnNumber",
  "number",
  "description",
  "cause"
];
function yt(e, t) {
  let n = Object.getOwnPropertyNames(e).filter((i) => es.indexOf(i) === -1), r = e.name;
  t.truncate -= r.length;
  let o = "";
  if (typeof e.message == "string" ? o = Y(e.message, t.truncate) : n.unshift("message"), o = o ? `: ${o}` : "", t.truncate -= o.length + 5,
  t.seen = t.seen || [], t.seen.includes(e))
    return "[Circular]";
  t.seen.push(e);
  let s = j(n.map((i) => [i, e[i]]), t, ae);
  return `${r}${o}${s ? ` { ${s} }` : ""}`;
}
c(yt, "inspectObject");

// ../node_modules/loupe/lib/html.js
function ts([e, t], n) {
  return n.truncate -= 3, t ? `${n.stylize(String(e), "yellow")}=${n.stylize(`"${t}"`, "string")}` : `${n.stylize(String(e), "yellow")}`;
}
c(ts, "inspectAttribute");
function Ue(e, t) {
  return j(e, t, ns, `
`);
}
c(Ue, "inspectNodeCollection");
function ns(e, t) {
  switch (e.nodeType) {
    case 1:
      return We(e, t);
    case 3:
      return t.inspect(e.data, t);
    default:
      return t.inspect(e, t);
  }
}
c(ns, "inspectNode");
function We(e, t) {
  let n = e.getAttributeNames(), r = e.tagName.toLowerCase(), o = t.stylize(`<${r}`, "special"), s = t.stylize(">", "special"), i = t.stylize(
  `</${r}>`, "special");
  t.truncate -= r.length * 2 + 5;
  let l = "";
  n.length > 0 && (l += " ", l += j(n.map((p) => [p, e.getAttribute(p)]), t, ts, " ")), t.truncate -= l.length;
  let a = t.truncate, m = Ue(e.children, t);
  return m && m.length > a && (m = `${ue}(${e.children.length})`), `${o}${l}${s}${m}${i}`;
}
c(We, "inspectHTML");

// ../node_modules/loupe/lib/index.js
var rs = typeof Symbol == "function" && typeof Symbol.for == "function", bt = rs ? Symbol.for("chai/inspect") : "@@chai/inspect", St = Symbol.
for("nodejs.util.inspect.custom"), On = /* @__PURE__ */ new WeakMap(), $n = {}, wn = {
  undefined: /* @__PURE__ */ c((e, t) => t.stylize("undefined", "undefined"), "undefined"),
  null: /* @__PURE__ */ c((e, t) => t.stylize("null", "null"), "null"),
  boolean: /* @__PURE__ */ c((e, t) => t.stylize(String(e), "boolean"), "boolean"),
  Boolean: /* @__PURE__ */ c((e, t) => t.stylize(String(e), "boolean"), "Boolean"),
  number: Be,
  Number: Be,
  bigint: ke,
  BigInt: ke,
  string: ze,
  String: ze,
  function: je,
  Function: je,
  symbol: Ye,
  // A Symbol polyfill will return `Symbol` not `symbol` from typedetect
  Symbol: Ye,
  Array: at,
  Date: lt,
  Map: ft,
  Set: pt,
  RegExp: mt,
  Promise: Tn,
  // WeakSet, WeakMap are totally opaque to us
  WeakSet: /* @__PURE__ */ c((e, t) => t.stylize("WeakSet{\u2026}", "special"), "WeakSet"),
  WeakMap: /* @__PURE__ */ c((e, t) => t.stylize("WeakMap{\u2026}", "special"), "WeakMap"),
  Arguments: dt,
  Int8Array: oe,
  Uint8Array: oe,
  Uint8ClampedArray: oe,
  Int16Array: oe,
  Uint16Array: oe,
  Int32Array: oe,
  Uint32Array: oe,
  Float32Array: oe,
  Float64Array: oe,
  Generator: /* @__PURE__ */ c(() => "", "Generator"),
  DataView: /* @__PURE__ */ c(() => "", "DataView"),
  ArrayBuffer: /* @__PURE__ */ c(() => "", "ArrayBuffer"),
  Error: yt,
  HTMLCollection: Ue,
  NodeList: Ue
}, os = /* @__PURE__ */ c((e, t, n) => bt in e && typeof e[bt] == "function" ? e[bt](t) : St in e && typeof e[St] == "function" ? e[St](t.depth,
t) : "inspect" in e && typeof e.inspect == "function" ? e.inspect(t.depth, t) : "constructor" in e && On.has(e.constructor) ? On.get(e.constructor)(
e, t) : $n[n] ? $n[n](e, t) : "", "inspectCustom"), ss = Object.prototype.toString;
function Ve(e, t = {}) {
  let n = En(t, Ve), { customInspect: r } = n, o = e === null ? "null" : typeof e;
  if (o === "object" && (o = ss.call(e).slice(8, -1)), o in wn)
    return wn[o](e, n);
  if (r && e) {
    let i = os(e, n, o);
    if (i)
      return typeof i == "string" ? i : Ve(i, n);
  }
  let s = e ? Object.getPrototypeOf(e) : !1;
  return s === Object.prototype || s === null ? ge(e, n) : e && typeof HTMLElement == "function" && e instanceof HTMLElement ? We(e, n) : "c\
onstructor" in e ? e.constructor !== Object ? ht(e, n) : ge(e, n) : e === Object(e) ? ge(e, n) : n.stylize(String(e), o);
}
c(Ve, "inspect");

// ../node_modules/@vitest/utils/dist/chunk-_commonjsHelpers.js
var { AsymmetricMatcher: cs, DOMCollection: us, DOMElement: as, Immutable: ls, ReactElement: fs, ReactTestComponent: ms } = Oe, Rn = [
  ms,
  fs,
  as,
  us,
  ls,
  cs
];
function he(e, t = 10, { maxLength: n, ...r } = {}) {
  let o = n ?? 1e4, s;
  try {
    s = v(e, {
      maxDepth: t,
      escapeString: !1,
      plugins: Rn,
      ...r
    });
  } catch {
    s = v(e, {
      callToJSON: !1,
      maxDepth: t,
      escapeString: !1,
      plugins: Rn,
      ...r
    });
  }
  return s.length >= o && t > 1 ? he(e, Math.floor(Math.min(t, Number.MAX_SAFE_INTEGER) / 2), {
    maxLength: n,
    ...r
  }) : s;
}
c(he, "stringify");
var ps = /%[sdjifoOc%]/g;
function An(...e) {
  if (typeof e[0] != "string") {
    let s = [];
    for (let i = 0; i < e.length; i++)
      s.push($e(e[i], {
        depth: 0,
        colors: !1
      }));
    return s.join(" ");
  }
  let t = e.length, n = 1, r = e[0], o = String(r).replace(ps, (s) => {
    if (s === "%%")
      return "%";
    if (n >= t)
      return s;
    switch (s) {
      case "%s": {
        let i = e[n++];
        return typeof i == "bigint" ? `${i.toString()}n` : typeof i == "number" && i === 0 && 1 / i < 0 ? "-0" : typeof i == "object" && i !==
        null ? typeof i.toString == "function" && i.toString !== Object.prototype.toString ? i.toString() : $e(i, {
          depth: 0,
          colors: !1
        }) : String(i);
      }
      case "%d": {
        let i = e[n++];
        return typeof i == "bigint" ? `${i.toString()}n` : Number(i).toString();
      }
      case "%i": {
        let i = e[n++];
        return typeof i == "bigint" ? `${i.toString()}n` : Number.parseInt(String(i)).toString();
      }
      case "%f":
        return Number.parseFloat(String(e[n++])).toString();
      case "%o":
        return $e(e[n++], {
          showHidden: !0,
          showProxy: !0
        });
      case "%O":
        return $e(e[n++]);
      case "%c":
        return n++, "";
      case "%j":
        try {
          return JSON.stringify(e[n++]);
        } catch (i) {
          let l = i.message;
          if (l.includes("circular structure") || l.includes("cyclic structures") || l.includes("cyclic object"))
            return "[Circular]";
          throw i;
        }
      default:
        return s;
    }
  });
  for (let s = e[n]; n < t; s = e[++n])
    s === null || typeof s != "object" ? o += ` ${s}` : o += ` ${$e(s)}`;
  return o;
}
c(An, "format");
function $e(e, t = {}) {
  return t.truncate === 0 && (t.truncate = Number.POSITIVE_INFINITY), Ve(e, t);
}
c($e, "inspect");
function Pn(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
c(Pn, "getDefaultExportFromCjs");

// ../node_modules/@vitest/utils/dist/helpers.js
function gs(e) {
  return e === Object.prototype || e === Function.prototype || e === RegExp.prototype;
}
c(gs, "isFinalObj");
function qe(e) {
  return Object.prototype.toString.apply(e).slice(8, -1);
}
c(qe, "getType");
function hs(e, t) {
  let n = typeof t == "function" ? t : (r) => t.add(r);
  Object.getOwnPropertyNames(e).forEach(n), Object.getOwnPropertySymbols(e).forEach(n);
}
c(hs, "collectOwnProperties");
function _t(e) {
  let t = /* @__PURE__ */ new Set();
  return gs(e) ? [] : (hs(e, t), Array.from(t));
}
c(_t, "getOwnProperties");
var Nn = { forceWritable: !1 };
function Ct(e, t = Nn) {
  return Et(e, /* @__PURE__ */ new WeakMap(), t);
}
c(Ct, "deepClone");
function Et(e, t, n = Nn) {
  let r, o;
  if (t.has(e))
    return t.get(e);
  if (Array.isArray(e)) {
    for (o = Array.from({ length: r = e.length }), t.set(e, o); r--; )
      o[r] = Et(e[r], t, n);
    return o;
  }
  if (Object.prototype.toString.call(e) === "[object Object]") {
    o = Object.create(Object.getPrototypeOf(e)), t.set(e, o);
    let s = _t(e);
    for (let i of s) {
      let l = Object.getOwnPropertyDescriptor(e, i);
      if (!l)
        continue;
      let a = Et(e[i], t, n);
      n.forceWritable ? Object.defineProperty(o, i, {
        enumerable: l.enumerable,
        configurable: !0,
        writable: !0,
        value: a
      }) : "get" in l ? Object.defineProperty(o, i, {
        ...l,
        get() {
          return a;
        }
      }) : Object.defineProperty(o, i, {
        ...l,
        value: a
      });
    }
    return o;
  }
  return e;
}
c(Et, "clone");

// ../node_modules/@vitest/utils/dist/diff.js
var U = -1, k = 1, x = 0, I = class {
  static {
    c(this, "Diff");
  }
  0;
  1;
  constructor(t, n) {
    this[0] = t, this[1] = n;
  }
};
function ds(e, t) {
  if (!e || !t || e.charAt(0) !== t.charAt(0))
    return 0;
  let n = 0, r = Math.min(e.length, t.length), o = r, s = 0;
  for (; n < o; )
    e.substring(s, o) === t.substring(s, o) ? (n = o, s = n) : r = o, o = Math.floor((r - n) / 2 + n);
  return o;
}
c(ds, "diff_commonPrefix");
function Kn(e, t) {
  if (!e || !t || e.charAt(e.length - 1) !== t.charAt(t.length - 1))
    return 0;
  let n = 0, r = Math.min(e.length, t.length), o = r, s = 0;
  for (; n < o; )
    e.substring(e.length - o, e.length - s) === t.substring(t.length - o, t.length - s) ? (n = o, s = n) : r = o, o = Math.floor((r - n) / 2 +
    n);
  return o;
}
c(Kn, "diff_commonSuffix");
function In(e, t) {
  let n = e.length, r = t.length;
  if (n === 0 || r === 0)
    return 0;
  n > r ? e = e.substring(n - r) : n < r && (t = t.substring(0, n));
  let o = Math.min(n, r);
  if (e === t)
    return o;
  let s = 0, i = 1;
  for (; ; ) {
    let l = e.substring(o - i), a = t.indexOf(l);
    if (a === -1)
      return s;
    i += a, (a === 0 || e.substring(o - i) === t.substring(0, i)) && (s = i, i++);
  }
}
c(In, "diff_commonOverlap_");
function ys(e) {
  let t = !1, n = [], r = 0, o = null, s = 0, i = 0, l = 0, a = 0, m = 0;
  for (; s < e.length; )
    e[s][0] === x ? (n[r++] = s, i = a, l = m, a = 0, m = 0, o = e[s][1]) : (e[s][0] === k ? a += e[s][1].length : m += e[s][1].length, o &&
    o.length <= Math.max(i, l) && o.length <= Math.max(a, m) && (e.splice(n[r - 1], 0, new I(U, o)), e[n[r - 1] + 1][0] = k, r--, r--, s = r >
    0 ? n[r - 1] : -1, i = 0, l = 0, a = 0, m = 0, o = null, t = !0)), s++;
  for (t && Gn(e), Es(e), s = 1; s < e.length; ) {
    if (e[s - 1][0] === U && e[s][0] === k) {
      let p = e[s - 1][1], f = e[s][1], y = In(p, f), d = In(f, p);
      y >= d ? (y >= p.length / 2 || y >= f.length / 2) && (e.splice(s, 0, new I(x, f.substring(0, y))), e[s - 1][1] = p.substring(0, p.length -
      y), e[s + 1][1] = f.substring(y), s++) : (d >= p.length / 2 || d >= f.length / 2) && (e.splice(s, 0, new I(x, p.substring(0, d))), e[s -
      1][0] = k, e[s - 1][1] = f.substring(0, f.length - d), e[s + 1][0] = U, e[s + 1][1] = p.substring(d), s++), s++;
    }
    s++;
  }
}
c(ys, "diff_cleanupSemantic");
var Mn = /[^a-z0-9]/i, Ln = /\s/, xn = /[\r\n]/, bs = /\n\r?\n$/, Ss = /^\r?\n\r?\n/;
function Es(e) {
  let t = 1;
  for (; t < e.length - 1; ) {
    if (e[t - 1][0] === x && e[t + 1][0] === x) {
      let n = e[t - 1][1], r = e[t][1], o = e[t + 1][1], s = Kn(n, r);
      if (s) {
        let p = r.substring(r.length - s);
        n = n.substring(0, n.length - s), r = p + r.substring(0, r.length - s), o = p + o;
      }
      let i = n, l = r, a = o, m = Ke(n, r) + Ke(r, o);
      for (; r.charAt(0) === o.charAt(0); ) {
        n += r.charAt(0), r = r.substring(1) + o.charAt(0), o = o.substring(1);
        let p = Ke(n, r) + Ke(r, o);
        p >= m && (m = p, i = n, l = r, a = o);
      }
      e[t - 1][1] !== i && (i ? e[t - 1][1] = i : (e.splice(t - 1, 1), t--), e[t][1] = l, a ? e[t + 1][1] = a : (e.splice(t + 1, 1), t--));
    }
    t++;
  }
}
c(Es, "diff_cleanupSemanticLossless");
function Gn(e) {
  e.push(new I(x, ""));
  let t = 0, n = 0, r = 0, o = "", s = "", i;
  for (; t < e.length; )
    switch (e[t][0]) {
      case k:
        r++, s += e[t][1], t++;
        break;
      case U:
        n++, o += e[t][1], t++;
        break;
      case x:
        n + r > 1 ? (n !== 0 && r !== 0 && (i = ds(s, o), i !== 0 && (t - n - r > 0 && e[t - n - r - 1][0] === x ? e[t - n - r - 1][1] += s.
        substring(0, i) : (e.splice(0, 0, new I(x, s.substring(0, i))), t++), s = s.substring(i), o = o.substring(i)), i = Kn(s, o), i !== 0 &&
        (e[t][1] = s.substring(s.length - i) + e[t][1], s = s.substring(0, s.length - i), o = o.substring(0, o.length - i))), t -= n + r, e.
        splice(t, n + r), o.length && (e.splice(t, 0, new I(U, o)), t++), s.length && (e.splice(t, 0, new I(k, s)), t++), t++) : t !== 0 && e[t -
        1][0] === x ? (e[t - 1][1] += e[t][1], e.splice(t, 1)) : t++, r = 0, n = 0, o = "", s = "";
        break;
    }
  e[e.length - 1][1] === "" && e.pop();
  let l = !1;
  for (t = 1; t < e.length - 1; )
    e[t - 1][0] === x && e[t + 1][0] === x && (e[t][1].substring(e[t][1].length - e[t - 1][1].length) === e[t - 1][1] ? (e[t][1] = e[t - 1][1] +
    e[t][1].substring(0, e[t][1].length - e[t - 1][1].length), e[t + 1][1] = e[t - 1][1] + e[t + 1][1], e.splice(t - 1, 1), l = !0) : e[t][1].
    substring(0, e[t + 1][1].length) === e[t + 1][1] && (e[t - 1][1] += e[t + 1][1], e[t][1] = e[t][1].substring(e[t + 1][1].length) + e[t +
    1][1], e.splice(t + 1, 1), l = !0)), t++;
  l && Gn(e);
}
c(Gn, "diff_cleanupMerge");
function Ke(e, t) {
  if (!e || !t)
    return 6;
  let n = e.charAt(e.length - 1), r = t.charAt(0), o = n.match(Mn), s = r.match(Mn), i = o && n.match(Ln), l = s && r.match(Ln), a = i && n.
  match(xn), m = l && r.match(xn), p = a && e.match(bs), f = m && t.match(Ss);
  return p || f ? 5 : a || m ? 4 : o && !i && l ? 3 : i || l ? 2 : o || s ? 1 : 0;
}
c(Ke, "diff_cleanupSemanticScore_");
var Hn = "Compared values have no visual difference.", _s = "Compared values serialize to the same structure.\nPrinting internal object struc\
ture without calling `toJSON` instead.", Ge = {}, Dn;
function Cs() {
  if (Dn) return Ge;
  Dn = 1, Object.defineProperty(Ge, "__esModule", {
    value: !0
  }), Ge.default = y;
  let e = "diff-sequences", t = 0, n = /* @__PURE__ */ c((d, g, u, h, S) => {
    let _ = 0;
    for (; d < g && u < h && S(d, u); )
      d += 1, u += 1, _ += 1;
    return _;
  }, "countCommonItemsF"), r = /* @__PURE__ */ c((d, g, u, h, S) => {
    let _ = 0;
    for (; d <= g && u <= h && S(g, h); )
      g -= 1, h -= 1, _ += 1;
    return _;
  }, "countCommonItemsR"), o = /* @__PURE__ */ c((d, g, u, h, S, _, O) => {
    let b = 0, E = -d, $ = _[b], C = $;
    _[b] += n(
      $ + 1,
      g,
      h + $ - E + 1,
      u,
      S
    );
    let A = d < O ? d : O;
    for (b += 1, E += 2; b <= A; b += 1, E += 2) {
      if (b !== d && C < _[b])
        $ = _[b];
      else if ($ = C + 1, g <= $)
        return b - 1;
      C = _[b], _[b] = $ + n($ + 1, g, h + $ - E + 1, u, S);
    }
    return O;
  }, "extendPathsF"), s = /* @__PURE__ */ c((d, g, u, h, S, _, O) => {
    let b = 0, E = d, $ = _[b], C = $;
    _[b] -= r(
      g,
      $ - 1,
      u,
      h + $ - E - 1,
      S
    );
    let A = d < O ? d : O;
    for (b += 1, E -= 2; b <= A; b += 1, E -= 2) {
      if (b !== d && _[b] < C)
        $ = _[b];
      else if ($ = C - 1, $ < g)
        return b - 1;
      C = _[b], _[b] = $ - r(
        g,
        $ - 1,
        u,
        h + $ - E - 1,
        S
      );
    }
    return O;
  }, "extendPathsR"), i = /* @__PURE__ */ c((d, g, u, h, S, _, O, b, E, $, C) => {
    let A = h - g, J = u - g, L = S - h - J, z = -L - (d - 1), X = -L + (d - 1), W = t, M = d < b ? d : b;
    for (let D = 0, F = -d; D <= M; D += 1, F += 2) {
      let Z = D === 0 || D !== d && W < O[D], B = Z ? O[D] : W, q = Z ? B : B + 1, se = A + q - F, K = n(
        q + 1,
        u,
        se + 1,
        S,
        _
      ), G = q + K;
      if (W = O[D], O[D] = G, z <= F && F <= X) {
        let ce = (d - 1 - (F + L)) / 2;
        if (ce <= $ && E[ce] - 1 <= G) {
          let Q = A + B - (Z ? F + 1 : F - 1), V = r(
            g,
            B,
            h,
            Q,
            _
          ), ie = B - V, be = Q - V, le = ie + 1, _e = be + 1;
          C.nChangePreceding = d - 1, d - 1 === le + _e - g - h ? (C.aEndPreceding = g, C.bEndPreceding = h) : (C.aEndPreceding = le, C.bEndPreceding =
          _e), C.nCommonPreceding = V, V !== 0 && (C.aCommonPreceding = le, C.bCommonPreceding = _e), C.nCommonFollowing = K, K !== 0 && (C.
          aCommonFollowing = q + 1, C.bCommonFollowing = se + 1);
          let we = G + 1, Re = se + K + 1;
          return C.nChangeFollowing = d - 1, d - 1 === u + S - we - Re ? (C.aStartFollowing = u, C.bStartFollowing = S) : (C.aStartFollowing =
          we, C.bStartFollowing = Re), !0;
        }
      }
    }
    return !1;
  }, "extendOverlappablePathsF"), l = /* @__PURE__ */ c((d, g, u, h, S, _, O, b, E, $, C) => {
    let A = S - u, J = u - g, L = S - h - J, z = L - d, X = L + d, W = t, M = d < $ ? d : $;
    for (let D = 0, F = d; D <= M; D += 1, F -= 2) {
      let Z = D === 0 || D !== d && E[D] < W, B = Z ? E[D] : W, q = Z ? B : B - 1, se = A + q - F, K = r(
        g,
        q - 1,
        h,
        se - 1,
        _
      ), G = q - K;
      if (W = E[D], E[D] = G, z <= F && F <= X) {
        let ce = (d + (F - L)) / 2;
        if (ce <= b && G - 1 <= O[ce]) {
          let Q = se - K;
          if (C.nChangePreceding = d, d === G + Q - g - h ? (C.aEndPreceding = g, C.bEndPreceding = h) : (C.aEndPreceding = G, C.bEndPreceding =
          Q), C.nCommonPreceding = K, K !== 0 && (C.aCommonPreceding = G, C.bCommonPreceding = Q), C.nChangeFollowing = d - 1, d === 1)
            C.nCommonFollowing = 0, C.aStartFollowing = u, C.bStartFollowing = S;
          else {
            let V = A + B - (Z ? F - 1 : F + 1), ie = n(
              B,
              u,
              V,
              S,
              _
            );
            C.nCommonFollowing = ie, ie !== 0 && (C.aCommonFollowing = B, C.bCommonFollowing = V);
            let be = B + ie, le = V + ie;
            d - 1 === u + S - be - le ? (C.aStartFollowing = u, C.bStartFollowing = S) : (C.aStartFollowing = be, C.bStartFollowing = le);
          }
          return !0;
        }
      }
    }
    return !1;
  }, "extendOverlappablePathsR"), a = /* @__PURE__ */ c((d, g, u, h, S, _, O, b, E) => {
    let $ = h - g, C = S - u, A = u - g, J = S - h, te = J - A, L = A, z = A;
    if (O[0] = g - 1, b[0] = u, te % 2 === 0) {
      let X = (d || te) / 2, W = (A + J) / 2;
      for (let M = 1; M <= W; M += 1)
        if (L = o(M, u, S, $, _, O, L), M < X)
          z = s(M, g, h, C, _, b, z);
        else if (
          // If a reverse path overlaps a forward path in the same diagonal,
          // return a division of the index intervals at the middle change.
          l(
            M,
            g,
            u,
            h,
            S,
            _,
            O,
            L,
            b,
            z,
            E
          )
        )
          return;
    } else {
      let X = ((d || te) + 1) / 2, W = (A + J + 1) / 2, M = 1;
      for (L = o(M, u, S, $, _, O, L), M += 1; M <= W; M += 1)
        if (z = s(
          M - 1,
          g,
          h,
          C,
          _,
          b,
          z
        ), M < X)
          L = o(M, u, S, $, _, O, L);
        else if (
          // If a forward path overlaps a reverse path in the same diagonal,
          // return a division of the index intervals at the middle change.
          i(
            M,
            g,
            u,
            h,
            S,
            _,
            O,
            L,
            b,
            z,
            E
          )
        )
          return;
    }
    throw new Error(
      `${e}: no overlap aStart=${g} aEnd=${u} bStart=${h} bEnd=${S}`
    );
  }, "divide"), m = /* @__PURE__ */ c((d, g, u, h, S, _, O, b, E, $) => {
    if (S - h < u - g) {
      if (_ = !_, _ && O.length === 1) {
        let { foundSubsequence: G, isCommon: ce } = O[0];
        O[1] = {
          foundSubsequence: /* @__PURE__ */ c((Q, V, ie) => {
            G(Q, ie, V);
          }, "foundSubsequence"),
          isCommon: /* @__PURE__ */ c((Q, V) => ce(V, Q), "isCommon")
        };
      }
      let se = g, K = u;
      g = h, u = S, h = se, S = K;
    }
    let { foundSubsequence: C, isCommon: A } = O[_ ? 1 : 0];
    a(
      d,
      g,
      u,
      h,
      S,
      A,
      b,
      E,
      $
    );
    let {
      nChangePreceding: J,
      aEndPreceding: te,
      bEndPreceding: L,
      nCommonPreceding: z,
      aCommonPreceding: X,
      bCommonPreceding: W,
      nCommonFollowing: M,
      aCommonFollowing: D,
      bCommonFollowing: F,
      nChangeFollowing: Z,
      aStartFollowing: B,
      bStartFollowing: q
    } = $;
    g < te && h < L && m(
      J,
      g,
      te,
      h,
      L,
      _,
      O,
      b,
      E,
      $
    ), z !== 0 && C(z, X, W), M !== 0 && C(M, D, F), B < u && q < S && m(
      Z,
      B,
      u,
      q,
      S,
      _,
      O,
      b,
      E,
      $
    );
  }, "findSubsequences"), p = /* @__PURE__ */ c((d, g) => {
    if (typeof g != "number")
      throw new TypeError(`${e}: ${d} typeof ${typeof g} is not a number`);
    if (!Number.isSafeInteger(g))
      throw new RangeError(`${e}: ${d} value ${g} is not a safe integer`);
    if (g < 0)
      throw new RangeError(`${e}: ${d} value ${g} is a negative integer`);
  }, "validateLength"), f = /* @__PURE__ */ c((d, g) => {
    let u = typeof g;
    if (u !== "function")
      throw new TypeError(`${e}: ${d} typeof ${u} is not a function`);
  }, "validateCallback");
  function y(d, g, u, h) {
    p("aLength", d), p("bLength", g), f("isCommon", u), f("foundSubsequence", h);
    let S = n(0, d, 0, g, u);
    if (S !== 0 && h(S, 0, 0), d !== S || g !== S) {
      let _ = S, O = S, b = r(
        _,
        d - 1,
        O,
        g - 1,
        u
      ), E = d - b, $ = g - b, C = S + b;
      d !== C && g !== C && m(
        0,
        _,
        E,
        O,
        $,
        !1,
        [
          {
            foundSubsequence: h,
            isCommon: u
          }
        ],
        [t],
        [t],
        {
          aCommonFollowing: t,
          aCommonPreceding: t,
          aEndPreceding: t,
          aStartFollowing: t,
          bCommonFollowing: t,
          bCommonPreceding: t,
          bEndPreceding: t,
          bStartFollowing: t,
          nChangeFollowing: t,
          nChangePreceding: t,
          nCommonFollowing: t,
          nCommonPreceding: t
        }
      ), b !== 0 && h(b, E, $);
    }
  }
  return c(y, "diffSequence"), Ge;
}
c(Cs, "requireBuild");
var Ts = Cs(), Jn = /* @__PURE__ */ Pn(Ts);
function Os(e, t) {
  return e.replace(/\s+$/, (n) => t(n));
}
c(Os, "formatTrailingSpaces");
function Pt(e, t, n, r, o, s) {
  return e.length !== 0 ? n(`${r} ${Os(e, o)}`) : r !== " " ? n(r) : t && s.length !== 0 ? n(`${r} ${s}`) : "";
}
c(Pt, "printDiffLine");
function Xn(e, t, { aColor: n, aIndicator: r, changeLineTrailingSpaceColor: o, emptyFirstOrLastLinePlaceholder: s }) {
  return Pt(e, t, n, r, o, s);
}
c(Xn, "printDeleteLine");
function Zn(e, t, { bColor: n, bIndicator: r, changeLineTrailingSpaceColor: o, emptyFirstOrLastLinePlaceholder: s }) {
  return Pt(e, t, n, r, o, s);
}
c(Zn, "printInsertLine");
function Qn(e, t, { commonColor: n, commonIndicator: r, commonLineTrailingSpaceColor: o, emptyFirstOrLastLinePlaceholder: s }) {
  return Pt(e, t, n, r, o, s);
}
c(Qn, "printCommonLine");
function Fn(e, t, n, r, { patchColor: o }) {
  return o(`@@ -${e + 1},${t - e} +${n + 1},${r - n} @@`);
}
c(Fn, "createPatchMark");
function $s(e, t) {
  let n = e.length, r = t.contextLines, o = r + r, s = n, i = !1, l = 0, a = 0;
  for (; a !== n; ) {
    let b = a;
    for (; a !== n && e[a][0] === x; )
      a += 1;
    if (b !== a)
      if (b === 0)
        a > r && (s -= a - r, i = !0);
      else if (a === n) {
        let E = a - b;
        E > r && (s -= E - r, i = !0);
      } else {
        let E = a - b;
        E > o && (s -= E - o, l += 1);
      }
    for (; a !== n && e[a][0] !== x; )
      a += 1;
  }
  let m = l !== 0 || i;
  l !== 0 ? s += l + 1 : i && (s += 1);
  let p = s - 1, f = [], y = 0;
  m && f.push("");
  let d = 0, g = 0, u = 0, h = 0, S = /* @__PURE__ */ c((b) => {
    let E = f.length;
    f.push(Qn(b, E === 0 || E === p, t)), u += 1, h += 1;
  }, "pushCommonLine"), _ = /* @__PURE__ */ c((b) => {
    let E = f.length;
    f.push(Xn(b, E === 0 || E === p, t)), u += 1;
  }, "pushDeleteLine"), O = /* @__PURE__ */ c((b) => {
    let E = f.length;
    f.push(Zn(b, E === 0 || E === p, t)), h += 1;
  }, "pushInsertLine");
  for (a = 0; a !== n; ) {
    let b = a;
    for (; a !== n && e[a][0] === x; )
      a += 1;
    if (b !== a)
      if (b === 0) {
        a > r && (b = a - r, d = b, g = b, u = d, h = g);
        for (let E = b; E !== a; E += 1)
          S(e[E][1]);
      } else if (a === n) {
        let E = a - b > r ? b + r : a;
        for (let $ = b; $ !== E; $ += 1)
          S(e[$][1]);
      } else {
        let E = a - b;
        if (E > o) {
          let $ = b + r;
          for (let A = b; A !== $; A += 1)
            S(e[A][1]);
          f[y] = Fn(d, u, g, h, t), y = f.length, f.push("");
          let C = E - o;
          d = u + C, g = h + C, u = d, h = g;
          for (let A = a - r; A !== a; A += 1)
            S(e[A][1]);
        } else
          for (let $ = b; $ !== a; $ += 1)
            S(e[$][1]);
      }
    for (; a !== n && e[a][0] === U; )
      _(e[a][1]), a += 1;
    for (; a !== n && e[a][0] === k; )
      O(e[a][1]), a += 1;
  }
  return m && (f[y] = Fn(d, u, g, h, t)), f.join(`
`);
}
c($s, "joinAlignedDiffsNoExpand");
function ws(e, t) {
  return e.map((n, r, o) => {
    let s = n[1], i = r === 0 || r === o.length - 1;
    switch (n[0]) {
      case U:
        return Xn(s, i, t);
      case k:
        return Zn(s, i, t);
      default:
        return Qn(s, i, t);
    }
  }).join(`
`);
}
c(ws, "joinAlignedDiffsExpand");
var Tt = /* @__PURE__ */ c((e) => e, "noColor"), vn = 5, Rs = 0;
function As() {
  return {
    aAnnotation: "Expected",
    aColor: ne.green,
    aIndicator: "-",
    bAnnotation: "Received",
    bColor: ne.red,
    bIndicator: "+",
    changeColor: ne.inverse,
    changeLineTrailingSpaceColor: Tt,
    commonColor: ne.dim,
    commonIndicator: " ",
    commonLineTrailingSpaceColor: Tt,
    compareKeys: void 0,
    contextLines: vn,
    emptyFirstOrLastLinePlaceholder: "",
    expand: !1,
    includeChangeCounts: !1,
    omitAnnotationLines: !1,
    patchColor: ne.yellow,
    printBasicPrototype: !1,
    truncateThreshold: Rs,
    truncateAnnotation: "... Diff result is truncated",
    truncateAnnotationColor: Tt
  };
}
c(As, "getDefaultOptions");
function Ps(e) {
  return e && typeof e == "function" ? e : void 0;
}
c(Ps, "getCompareKeys");
function Ns(e) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= 0 ? e : vn;
}
c(Ns, "getContextLines");
function de(e = {}) {
  return {
    ...As(),
    ...e,
    compareKeys: Ps(e.compareKeys),
    contextLines: Ns(e.contextLines)
  };
}
c(de, "normalizeDiffOptions");
function Ee(e) {
  return e.length === 1 && e[0].length === 0;
}
c(Ee, "isEmptyString");
function Is(e) {
  let t = 0, n = 0;
  return e.forEach((r) => {
    switch (r[0]) {
      case U:
        t += 1;
        break;
      case k:
        n += 1;
        break;
    }
  }), {
    a: t,
    b: n
  };
}
c(Is, "countChanges");
function Ms({ aAnnotation: e, aColor: t, aIndicator: n, bAnnotation: r, bColor: o, bIndicator: s, includeChangeCounts: i, omitAnnotationLines: l }, a) {
  if (l)
    return "";
  let m = "", p = "";
  if (i) {
    let d = String(a.a), g = String(a.b), u = r.length - e.length, h = " ".repeat(Math.max(0, u)), S = " ".repeat(Math.max(0, -u)), _ = g.length -
    d.length, O = " ".repeat(Math.max(0, _)), b = " ".repeat(Math.max(0, -_));
    m = `${h}  ${n} ${O}${d}`, p = `${S}  ${s} ${b}${g}`;
  }
  let f = `${n} ${e}${m}`, y = `${s} ${r}${p}`;
  return `${t(f)}
${o(y)}

`;
}
c(Ms, "printAnnotation");
function Nt(e, t, n) {
  return Ms(n, Is(e)) + (n.expand ? ws(e, n) : $s(e, n)) + (t ? n.truncateAnnotationColor(`
${n.truncateAnnotation}`) : "");
}
c(Nt, "printDiffLines");
function Je(e, t, n) {
  let r = de(n), [o, s] = er(Ee(e) ? [] : e, Ee(t) ? [] : t, r);
  return Nt(o, s, r);
}
c(Je, "diffLinesUnified");
function Ls(e, t, n, r, o) {
  if (Ee(e) && Ee(n) && (e = [], n = []), Ee(t) && Ee(r) && (t = [], r = []), e.length !== n.length || t.length !== r.length)
    return Je(e, t, o);
  let [s, i] = er(n, r, o), l = 0, a = 0;
  return s.forEach((m) => {
    switch (m[0]) {
      case U:
        m[1] = e[l], l += 1;
        break;
      case k:
        m[1] = t[a], a += 1;
        break;
      default:
        m[1] = t[a], l += 1, a += 1;
    }
  }), Nt(s, i, de(o));
}
c(Ls, "diffLinesUnified2");
function er(e, t, n) {
  let r = n?.truncateThreshold ?? !1, o = Math.max(Math.floor(n?.truncateThreshold ?? 0), 0), s = r ? Math.min(e.length, o) : e.length, i = r ?
  Math.min(t.length, o) : t.length, l = s !== e.length || i !== t.length, a = /* @__PURE__ */ c((d, g) => e[d] === t[g], "isCommon"), m = [],
  p = 0, f = 0;
  for (Jn(s, i, a, /* @__PURE__ */ c((d, g, u) => {
    for (; p !== g; p += 1)
      m.push(new I(U, e[p]));
    for (; f !== u; f += 1)
      m.push(new I(k, t[f]));
    for (; d !== 0; d -= 1, p += 1, f += 1)
      m.push(new I(x, t[f]));
  }, "foundSubsequence")); p !== s; p += 1)
    m.push(new I(U, e[p]));
  for (; f !== i; f += 1)
    m.push(new I(k, t[f]));
  return [m, l];
}
c(er, "diffLinesRaw");
function jn(e) {
  if (e === void 0)
    return "undefined";
  if (e === null)
    return "null";
  if (Array.isArray(e))
    return "array";
  if (typeof e == "boolean")
    return "boolean";
  if (typeof e == "function")
    return "function";
  if (typeof e == "number")
    return "number";
  if (typeof e == "string")
    return "string";
  if (typeof e == "bigint")
    return "bigint";
  if (typeof e == "object") {
    if (e != null) {
      if (e.constructor === RegExp)
        return "regexp";
      if (e.constructor === Map)
        return "map";
      if (e.constructor === Set)
        return "set";
      if (e.constructor === Date)
        return "date";
    }
    return "object";
  } else if (typeof e == "symbol")
    return "symbol";
  throw new Error(`value of unknown type: ${e}`);
}
c(jn, "getType");
function Bn(e) {
  return e.includes(`\r
`) ? `\r
` : `
`;
}
c(Bn, "getNewLineSymbol");
function xs(e, t, n) {
  let r = n?.truncateThreshold ?? !1, o = Math.max(Math.floor(n?.truncateThreshold ?? 0), 0), s = e.length, i = t.length;
  if (r) {
    let d = e.includes(`
`), g = t.includes(`
`), u = Bn(e), h = Bn(t), S = d ? `${e.split(u, o).join(u)}
` : e, _ = g ? `${t.split(h, o).join(h)}
` : t;
    s = S.length, i = _.length;
  }
  let l = s !== e.length || i !== t.length, a = /* @__PURE__ */ c((d, g) => e[d] === t[g], "isCommon"), m = 0, p = 0, f = [];
  return Jn(s, i, a, /* @__PURE__ */ c((d, g, u) => {
    m !== g && f.push(new I(U, e.slice(m, g))), p !== u && f.push(new I(k, t.slice(p, u))), m = g + d, p = u + d, f.push(new I(x, t.slice(u,
    p)));
  }, "foundSubsequence")), m !== s && f.push(new I(U, e.slice(m))), p !== i && f.push(new I(k, t.slice(p))), [f, l];
}
c(xs, "diffStrings");
function Ds(e, t, n) {
  return t.reduce((r, o) => r + (o[0] === x ? o[1] : o[0] === e && o[1].length !== 0 ? n(o[1]) : ""), "");
}
c(Ds, "concatenateRelevantDiffs");
var He = class {
  static {
    c(this, "ChangeBuffer");
  }
  op;
  line;
  lines;
  changeColor;
  constructor(t, n) {
    this.op = t, this.line = [], this.lines = [], this.changeColor = n;
  }
  pushSubstring(t) {
    this.pushDiff(new I(this.op, t));
  }
  pushLine() {
    this.lines.push(this.line.length !== 1 ? new I(this.op, Ds(this.op, this.line, this.changeColor)) : this.line[0][0] === this.op ? this.line[0] :
    new I(this.op, this.line[0][1])), this.line.length = 0;
  }
  isLineEmpty() {
    return this.line.length === 0;
  }
  // Minor input to buffer.
  pushDiff(t) {
    this.line.push(t);
  }
  // Main input to buffer.
  align(t) {
    let n = t[1];
    if (n.includes(`
`)) {
      let r = n.split(`
`), o = r.length - 1;
      r.forEach((s, i) => {
        i < o ? (this.pushSubstring(s), this.pushLine()) : s.length !== 0 && this.pushSubstring(s);
      });
    } else
      this.pushDiff(t);
  }
  // Output from buffer.
  moveLinesTo(t) {
    this.isLineEmpty() || this.pushLine(), t.push(...this.lines), this.lines.length = 0;
  }
}, $t = class {
  static {
    c(this, "CommonBuffer");
  }
  deleteBuffer;
  insertBuffer;
  lines;
  constructor(t, n) {
    this.deleteBuffer = t, this.insertBuffer = n, this.lines = [];
  }
  pushDiffCommonLine(t) {
    this.lines.push(t);
  }
  pushDiffChangeLines(t) {
    let n = t[1].length === 0;
    (!n || this.deleteBuffer.isLineEmpty()) && this.deleteBuffer.pushDiff(t), (!n || this.insertBuffer.isLineEmpty()) && this.insertBuffer.pushDiff(
    t);
  }
  flushChangeLines() {
    this.deleteBuffer.moveLinesTo(this.lines), this.insertBuffer.moveLinesTo(this.lines);
  }
  // Input to buffer.
  align(t) {
    let n = t[0], r = t[1];
    if (r.includes(`
`)) {
      let o = r.split(`
`), s = o.length - 1;
      o.forEach((i, l) => {
        if (l === 0) {
          let a = new I(n, i);
          this.deleteBuffer.isLineEmpty() && this.insertBuffer.isLineEmpty() ? (this.flushChangeLines(), this.pushDiffCommonLine(a)) : (this.
          pushDiffChangeLines(a), this.flushChangeLines());
        } else l < s ? this.pushDiffCommonLine(new I(n, i)) : i.length !== 0 && this.pushDiffChangeLines(new I(n, i));
      });
    } else
      this.pushDiffChangeLines(t);
  }
  // Output from buffer.
  getLines() {
    return this.flushChangeLines(), this.lines;
  }
};
function Fs(e, t) {
  let n = new He(U, t), r = new He(k, t), o = new $t(n, r);
  return e.forEach((s) => {
    switch (s[0]) {
      case U:
        n.align(s);
        break;
      case k:
        r.align(s);
        break;
      default:
        o.align(s);
    }
  }), o.getLines();
}
c(Fs, "getAlignedDiffs");
function js(e, t) {
  if (t) {
    let n = e.length - 1;
    return e.some((r, o) => r[0] === x && (o !== n || r[1] !== `
`));
  }
  return e.some((n) => n[0] === x);
}
c(js, "hasCommonDiff");
function Bs(e, t, n) {
  if (e !== t && e.length !== 0 && t.length !== 0) {
    let r = e.includes(`
`) || t.includes(`
`), [o, s] = tr(r ? `${e}
` : e, r ? `${t}
` : t, !0, n);
    if (js(o, r)) {
      let i = de(n), l = Fs(o, i.changeColor);
      return Nt(l, s, i);
    }
  }
  return Je(e.split(`
`), t.split(`
`), n);
}
c(Bs, "diffStringsUnified");
function tr(e, t, n, r) {
  let [o, s] = xs(e, t, r);
  return n && ys(o), [o, s];
}
c(tr, "diffStringsRaw");
function wt(e, t) {
  let { commonColor: n } = de(t);
  return n(e);
}
c(wt, "getCommonMessage");
var { AsymmetricMatcher: ks, DOMCollection: zs, DOMElement: Ys, Immutable: Us, ReactElement: Ws, ReactTestComponent: Vs } = Oe, nr = [
  Vs,
  Ws,
  Ys,
  zs,
  Us,
  ks,
  Oe.Error
], Rt = {
  maxDepth: 20,
  plugins: nr
}, rr = {
  callToJSON: !1,
  maxDepth: 8,
  plugins: nr
};
function qs(e, t, n) {
  if (Object.is(e, t))
    return "";
  let r = jn(e), o = r, s = !1;
  if (r === "object" && typeof e.asymmetricMatch == "function") {
    if (e.$$typeof !== Symbol.for("jest.asymmetricMatcher") || typeof e.getExpectedType != "function")
      return;
    o = e.getExpectedType(), s = o === "string";
  }
  if (o !== jn(t)) {
    let h = function(O) {
      return O.length <= u ? O : `${O.slice(0, u)}...`;
    };
    c(h, "truncate");
    let { aAnnotation: i, aColor: l, aIndicator: a, bAnnotation: m, bColor: p, bIndicator: f } = de(n), y = At(rr, n), d = v(e, y), g = v(t,
    y), u = 1e5;
    d = h(d), g = h(g);
    let S = `${l(`${a} ${i}:`)} 
${d}`, _ = `${p(`${f} ${m}:`)} 
${g}`;
    return `${S}

${_}`;
  }
  if (!s)
    switch (r) {
      case "string":
        return Je(e.split(`
`), t.split(`
`), n);
      case "boolean":
      case "number":
        return Ks(e, t, n);
      case "map":
        return Ot(kn(e), kn(t), n);
      case "set":
        return Ot(zn(e), zn(t), n);
      default:
        return Ot(e, t, n);
    }
}
c(qs, "diff");
function Ks(e, t, n) {
  let r = v(e, Rt), o = v(t, Rt);
  return r === o ? "" : Je(r.split(`
`), o.split(`
`), n);
}
c(Ks, "comparePrimitive");
function kn(e) {
  return new Map(Array.from(e.entries()).sort());
}
c(kn, "sortMap");
function zn(e) {
  return new Set(Array.from(e.values()).sort());
}
c(zn, "sortSet");
function Ot(e, t, n) {
  let r, o = !1;
  try {
    let i = At(Rt, n);
    r = Yn(e, t, i, n);
  } catch {
    o = !0;
  }
  let s = wt(Hn, n);
  if (r === void 0 || r === s) {
    let i = At(rr, n);
    r = Yn(e, t, i, n), r !== s && !o && (r = `${wt(_s, n)}

${r}`);
  }
  return r;
}
c(Ot, "compareObjects");
function At(e, t) {
  let { compareKeys: n, printBasicPrototype: r, maxDepth: o } = de(t);
  return {
    ...e,
    compareKeys: n,
    printBasicPrototype: r,
    maxDepth: o ?? e.maxDepth
  };
}
c(At, "getFormatOptions");
function Yn(e, t, n, r) {
  let o = {
    ...n,
    indent: 0
  }, s = v(e, o), i = v(t, o);
  if (s === i)
    return wt(Hn, r);
  {
    let l = v(e, n), a = v(t, n);
    return Ls(l.split(`
`), a.split(`
`), s.split(`
`), i.split(`
`), r);
  }
}
c(Yn, "getObjectsDifference");
var Un = 2e4;
function Wn(e) {
  return qe(e) === "Object" && typeof e.asymmetricMatch == "function";
}
c(Wn, "isAsymmetricMatcher");
function Vn(e, t) {
  let n = qe(e), r = qe(t);
  return n === r && (n === "Object" || n === "Array");
}
c(Vn, "isReplaceable");
function or(e, t, n) {
  let { aAnnotation: r, bAnnotation: o } = de(n);
  if (typeof t == "string" && typeof e == "string" && t.length > 0 && e.length > 0 && t.length <= Un && e.length <= Un && t !== e) {
    if (t.includes(`
`) || e.includes(`
`))
      return Bs(t, e, n);
    let [p] = tr(t, e, !0), f = p.some((u) => u[0] === x), y = Gs(r, o), d = y(r) + Xs(qn(p, U, f)), g = y(o) + Js(qn(p, k, f));
    return `${d}
${g}`;
  }
  let s = Ct(t, { forceWritable: !0 }), i = Ct(e, { forceWritable: !0 }), { replacedExpected: l, replacedActual: a } = sr(i, s);
  return qs(l, a, n);
}
c(or, "printDiffOrStringify");
function sr(e, t, n = /* @__PURE__ */ new WeakSet(), r = /* @__PURE__ */ new WeakSet()) {
  return e instanceof Error && t instanceof Error && typeof e.cause < "u" && typeof t.cause > "u" ? (delete e.cause, {
    replacedActual: e,
    replacedExpected: t
  }) : Vn(e, t) ? n.has(e) || r.has(t) ? {
    replacedActual: e,
    replacedExpected: t
  } : (n.add(e), r.add(t), _t(t).forEach((o) => {
    let s = t[o], i = e[o];
    if (Wn(s))
      s.asymmetricMatch(i) && (e[o] = s);
    else if (Wn(i))
      i.asymmetricMatch(s) && (t[o] = i);
    else if (Vn(i, s)) {
      let l = sr(i, s, n, r);
      e[o] = l.replacedActual, t[o] = l.replacedExpected;
    }
  }), {
    replacedActual: e,
    replacedExpected: t
  }) : {
    replacedActual: e,
    replacedExpected: t
  };
}
c(sr, "replaceAsymmetricMatcher");
function Gs(...e) {
  let t = e.reduce((n, r) => r.length > n ? r.length : n, 0);
  return (n) => `${n}: ${" ".repeat(t - n.length)}`;
}
c(Gs, "getLabelPrinter");
var Hs = "\xB7";
function ir(e) {
  return e.replace(/\s+$/gm, (t) => Hs.repeat(t.length));
}
c(ir, "replaceTrailingSpaces");
function Js(e) {
  return ne.red(ir(he(e)));
}
c(Js, "printReceived");
function Xs(e) {
  return ne.green(ir(he(e)));
}
c(Xs, "printExpected");
function qn(e, t, n) {
  return e.reduce((r, o) => r + (o[0] === x ? o[1] : o[0] === t ? n ? ne.inverse(o[1]) : o[1] : ""), "");
}
c(qn, "getCommonAndChangedSubstrings");

// ../node_modules/@vitest/utils/dist/error.js
var Zs = "@@__IMMUTABLE_RECORD__@@", Qs = "@@__IMMUTABLE_ITERABLE__@@";
function vs(e) {
  return e && (e[Qs] || e[Zs]);
}
c(vs, "isImmutable");
var ei = Object.getPrototypeOf({});
function cr(e) {
  return e instanceof Error ? `<unserializable>: ${e.message}` : typeof e == "string" ? `<unserializable>: ${e}` : "<unserializable>";
}
c(cr, "getUnserializableMessage");
function me(e, t = /* @__PURE__ */ new WeakMap()) {
  if (!e || typeof e == "string")
    return e;
  if (e instanceof Error && "toJSON" in e && typeof e.toJSON == "function") {
    let n = e.toJSON();
    return n && n !== e && typeof n == "object" && (typeof e.message == "string" && Xe(() => n.message ?? (n.message = e.message)), typeof e.
    stack == "string" && Xe(() => n.stack ?? (n.stack = e.stack)), typeof e.name == "string" && Xe(() => n.name ?? (n.name = e.name)), e.cause !=
    null && Xe(() => n.cause ?? (n.cause = me(e.cause, t)))), me(n, t);
  }
  if (typeof e == "function")
    return `Function<${e.name || "anonymous"}>`;
  if (typeof e == "symbol")
    return e.toString();
  if (typeof e != "object")
    return e;
  if (typeof Buffer < "u" && e instanceof Buffer)
    return `<Buffer(${e.length}) ...>`;
  if (typeof Uint8Array < "u" && e instanceof Uint8Array)
    return `<Uint8Array(${e.length}) ...>`;
  if (vs(e))
    return me(e.toJSON(), t);
  if (e instanceof Promise || e.constructor && e.constructor.prototype === "AsyncFunction")
    return "Promise";
  if (typeof Element < "u" && e instanceof Element)
    return e.tagName;
  if (typeof e.asymmetricMatch == "function")
    return `${e.toString()} ${An(e.sample)}`;
  if (typeof e.toJSON == "function")
    return me(e.toJSON(), t);
  if (t.has(e))
    return t.get(e);
  if (Array.isArray(e)) {
    let n = new Array(e.length);
    return t.set(e, n), e.forEach((r, o) => {
      try {
        n[o] = me(r, t);
      } catch (s) {
        n[o] = cr(s);
      }
    }), n;
  } else {
    let n = /* @__PURE__ */ Object.create(null);
    t.set(e, n);
    let r = e;
    for (; r && r !== ei; )
      Object.getOwnPropertyNames(r).forEach((o) => {
        if (!(o in n))
          try {
            n[o] = me(e[o], t);
          } catch (s) {
            delete n[o], n[o] = cr(s);
          }
      }), r = Object.getPrototypeOf(r);
    return n;
  }
}
c(me, "serializeValue");
function Xe(e) {
  try {
    return e();
  } catch {
  }
}
c(Xe, "safe");
function ti(e) {
  return e.replace(/__(vite_ssr_import|vi_import)_\d+__\./g, "");
}
c(ti, "normalizeErrorMessage");
function It(e, t, n = /* @__PURE__ */ new WeakSet()) {
  if (!e || typeof e != "object")
    return { message: String(e) };
  let r = e;
  (r.showDiff || r.showDiff === void 0 && r.expected !== void 0 && r.actual !== void 0) && (r.diff = or(r.actual, r.expected, {
    ...t,
    ...r.diffOptions
  })), "expected" in r && typeof r.expected != "string" && (r.expected = he(r.expected, 10)), "actual" in r && typeof r.actual != "string" &&
  (r.actual = he(r.actual, 10));
  try {
    typeof r.message == "string" && (r.message = ti(r.message));
  } catch {
  }
  try {
    !n.has(r) && typeof r.cause == "object" && (n.add(r), r.cause = It(r.cause, t, n));
  } catch {
  }
  try {
    return me(r);
  } catch (o) {
    return me(new Error(`Failed to fully serialize error: ${o?.message}
Inner error message: ${r?.message}`));
  }
}
c(It, "processError");

// src/instrumenter/EVENTS.ts
var ee = {
  CALL: "storybook/instrumenter/call",
  SYNC: "storybook/instrumenter/sync",
  START: "storybook/instrumenter/start",
  BACK: "storybook/instrumenter/back",
  GOTO: "storybook/instrumenter/goto",
  NEXT: "storybook/instrumenter/next",
  END: "storybook/instrumenter/end"
};

// src/instrumenter/preview-api.ts
var Ze = globalThis.__STORYBOOK_ADDONS_PREVIEW;

// src/instrumenter/types.ts
var ur = /* @__PURE__ */ ((o) => (o.DONE = "done", o.ERROR = "error", o.ACTIVE = "active", o.WAITING = "waiting", o))(ur || {});

// src/instrumenter/instrumenter.ts
var ni = new Error(
  "This function ran after the play function completed. Did you forget to `await` it?"
), ar = /* @__PURE__ */ c((e) => Object.prototype.toString.call(e) === "[object Object]", "isObject"), ri = /* @__PURE__ */ c((e) => Object.
prototype.toString.call(e) === "[object Module]", "isModule"), oi = /* @__PURE__ */ c((e) => {
  if (!ar(e) && !ri(e))
    return !1;
  if (e.constructor === void 0)
    return !0;
  let t = e.constructor.prototype;
  return !!ar(t);
}, "isInstrumentable"), si = /* @__PURE__ */ c((e) => {
  try {
    return new e.constructor();
  } catch {
    return {};
  }
}, "construct"), Mt = /* @__PURE__ */ c(() => ({
  renderPhase: "preparing",
  isDebugging: !1,
  isPlaying: !1,
  isLocked: !1,
  cursor: 0,
  calls: [],
  shadowCalls: [],
  callRefsByResult: /* @__PURE__ */ new Map(),
  chainedCallIds: /* @__PURE__ */ new Set(),
  ancestors: [],
  playUntil: void 0,
  resolvers: {},
  syncTimeout: void 0
}), "getInitialState"), lr = /* @__PURE__ */ c((e, t = !1) => {
  let n = (t ? e.shadowCalls : e.calls).filter((o) => o.retain);
  if (!n.length)
    return;
  let r = new Map(
    Array.from(e.callRefsByResult.entries()).filter(([, o]) => o.retain)
  );
  return { cursor: n.length, calls: n, callRefsByResult: r };
}, "getRetainedState"), Lt = class {
  constructor() {
    this.detached = !1;
    this.initialized = !1;
    // State is tracked per story to deal with multiple stories on the same canvas (i.e. docs mode)
    this.state = {};
    this.loadParentWindowState = /* @__PURE__ */ c(() => {
      try {
        this.state = H.global.window?.parent?.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__ || {};
      } catch {
        this.detached = !0;
      }
    }, "loadParentWindowState");
    this.updateParentWindowState = /* @__PURE__ */ c(() => {
      try {
        H.global.window.parent.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__ = this.state;
      } catch {
        this.detached = !0;
      }
    }, "updateParentWindowState");
    this.loadParentWindowState();
    let t = /* @__PURE__ */ c(({
      storyId: a,
      renderPhase: m,
      isPlaying: p = !0,
      isDebugging: f = !1
    }) => {
      let y = this.getState(a);
      this.setState(a, {
        ...Mt(),
        ...lr(y, f),
        renderPhase: m || y.renderPhase,
        shadowCalls: f ? y.shadowCalls : [],
        chainedCallIds: f ? y.chainedCallIds : /* @__PURE__ */ new Set(),
        playUntil: f ? y.playUntil : void 0,
        isPlaying: p,
        isDebugging: f
      }), this.sync(a);
    }, "resetState"), n = /* @__PURE__ */ c((a) => ({ storyId: m, playUntil: p }) => {
      this.getState(m).isDebugging || this.setState(m, ({ calls: y }) => ({
        calls: [],
        shadowCalls: y.map((d) => ({ ...d, status: "waiting" })),
        isDebugging: !0
      }));
      let f = this.getLog(m);
      this.setState(m, ({ shadowCalls: y }) => {
        if (p || !f.length)
          return { playUntil: p };
        let d = y.findIndex((g) => g.id === f[0].callId);
        return {
          playUntil: y.slice(0, d).filter((g) => g.interceptable && !g.ancestors?.length).slice(-1)[0]?.id
        };
      }), a.emit(ye.FORCE_REMOUNT, { storyId: m, isDebugging: !0 });
    }, "start"), r = /* @__PURE__ */ c((a) => ({ storyId: m }) => {
      let p = this.getLog(m).filter((y) => !y.ancestors?.length), f = p.reduceRight((y, d, g) => y >= 0 || d.status === "waiting" ? y : g, -1);
      n(a)({ storyId: m, playUntil: p[f - 1]?.callId });
    }, "back"), o = /* @__PURE__ */ c((a) => ({ storyId: m, callId: p }) => {
      let { calls: f, shadowCalls: y, resolvers: d } = this.getState(m), g = f.find(({ id: h }) => h === p), u = y.find(({ id: h }) => h ===
      p);
      if (!g && u && Object.values(d).length > 0) {
        let h = this.getLog(m).find((S) => S.status === "waiting")?.callId;
        u.id !== h && this.setState(m, { playUntil: u.id }), Object.values(d).forEach((S) => S());
      } else
        n(a)({ storyId: m, playUntil: p });
    }, "goto"), s = /* @__PURE__ */ c((a) => ({ storyId: m }) => {
      let { resolvers: p } = this.getState(m);
      if (Object.values(p).length > 0)
        Object.values(p).forEach((f) => f());
      else {
        let f = this.getLog(m).find((y) => y.status === "waiting")?.callId;
        f ? n(a)({ storyId: m, playUntil: f }) : i({ storyId: m });
      }
    }, "next"), i = /* @__PURE__ */ c(({ storyId: a }) => {
      this.setState(a, { playUntil: void 0, isDebugging: !1 }), Object.values(this.getState(a).resolvers).forEach((m) => m());
    }, "end"), l = /* @__PURE__ */ c(({
      storyId: a,
      newPhase: m
    }) => {
      let { isDebugging: p } = this.getState(a);
      if (m === "preparing" && p)
        return t({ storyId: a, renderPhase: m });
      if (m === "playing")
        return t({ storyId: a, renderPhase: m, isDebugging: p });
      m === "played" ? this.setState(a, {
        renderPhase: m,
        isLocked: !1,
        isPlaying: !1,
        isDebugging: !1
      }) : m === "errored" ? this.setState(a, {
        renderPhase: m,
        isLocked: !1,
        isPlaying: !1
      }) : m === "aborted" ? this.setState(a, {
        renderPhase: m,
        isLocked: !0,
        isPlaying: !1
      }) : this.setState(a, {
        renderPhase: m
      }), this.sync(a);
    }, "renderPhaseChanged");
    Ze && Ze.ready().then(() => {
      this.channel = Ze.getChannel(), this.channel.on(ye.FORCE_REMOUNT, t), this.channel.on(ye.STORY_RENDER_PHASE_CHANGED, l), this.channel.
      on(ye.SET_CURRENT_STORY, () => {
        this.initialized ? this.cleanup() : this.initialized = !0;
      }), this.channel.on(ee.START, n(this.channel)), this.channel.on(ee.BACK, r(this.channel)), this.channel.on(ee.GOTO, o(this.channel)), this.
      channel.on(ee.NEXT, s(this.channel)), this.channel.on(ee.END, i);
    });
  }
  static {
    c(this, "Instrumenter");
  }
  getState(t) {
    return this.state[t] || Mt();
  }
  setState(t, n) {
    if (t) {
      let r = this.getState(t), o = typeof n == "function" ? n(r) : n;
      this.state = { ...this.state, [t]: { ...r, ...o } }, this.updateParentWindowState();
    }
  }
  cleanup() {
    this.state = Object.entries(this.state).reduce(
      (r, [o, s]) => {
        let i = lr(s);
        return i && (r[o] = Object.assign(Mt(), i)), r;
      },
      {}
    );
    let n = { controlStates: {
      detached: this.detached,
      start: !1,
      back: !1,
      goto: !1,
      next: !1,
      end: !1
    }, logItems: [] };
    this.channel?.emit(ee.SYNC, n), this.updateParentWindowState();
  }
  getLog(t) {
    let { calls: n, shadowCalls: r } = this.getState(t), o = [...r];
    n.forEach((i, l) => {
      o[l] = i;
    });
    let s = /* @__PURE__ */ new Set();
    return o.reduceRight((i, l) => (l.args.forEach((a) => {
      a?.__callId__ && s.add(a.__callId__);
    }), l.path.forEach((a) => {
      a.__callId__ && s.add(a.__callId__);
    }), (l.interceptable || l.exception) && !s.has(l.id) && (i.unshift({ callId: l.id, status: l.status, ancestors: l.ancestors }), s.add(l.
    id)), i), []);
  }
  // Traverses the object structure to recursively patch all function properties.
  // Returns the original object, or a new object with the same constructor,
  // depending on whether it should mutate.
  instrument(t, n, r = 0) {
    if (!oi(t))
      return t;
    let { mutate: o = !1, path: s = [] } = n, i = n.getKeys ? n.getKeys(t, r) : Object.keys(t);
    return r += 1, i.reduce(
      (l, a) => {
        let m = ii(t, a);
        if (typeof m?.get == "function") {
          if (m.configurable) {
            let f = /* @__PURE__ */ c(() => m?.get?.bind(t)?.(), "getter");
            Object.defineProperty(l, a, {
              get: /* @__PURE__ */ c(() => this.instrument(f(), { ...n, path: s.concat(a) }, r), "get")
            });
          }
          return l;
        }
        let p = t[a];
        return typeof p != "function" ? (l[a] = this.instrument(p, { ...n, path: s.concat(a) }, r), l) : "__originalFn__" in p && typeof p.__originalFn__ ==
        "function" ? (l[a] = p, l) : (l[a] = (...f) => this.track(a, p, t, f, n), l[a].__originalFn__ = p, Object.defineProperty(l[a], "name",
        { value: a, writable: !1 }), Object.keys(p).length > 0 && Object.assign(
          l[a],
          this.instrument({ ...p }, { ...n, path: s.concat(a) }, r)
        ), l);
      },
      o ? t : si(t)
    );
  }
  // Monkey patch an object method to record calls.
  // Returns a function that invokes the original function, records the invocation ("call") and
  // returns the original result.
  track(t, n, r, o, s) {
    let i = o?.[0]?.__storyId__ || H.global.__STORYBOOK_PREVIEW__?.selectionStore?.selection?.storyId, { cursor: l, ancestors: a } = this.getState(
    i);
    this.setState(i, { cursor: l + 1 });
    let m = `${a.slice(-1)[0] || i} [${l}] ${t}`, { path: p = [], intercept: f = !1, retain: y = !1 } = s, d = typeof f == "function" ? f(t,
    p) : f, g = { id: m, cursor: l, storyId: i, ancestors: a, path: p, method: t, args: o, interceptable: d, retain: y }, h = (d && !a.length ?
    this.intercept : this.invoke).call(this, n, r, g, s);
    return this.instrument(h, { ...s, mutate: !0, path: [{ __callId__: g.id }] });
  }
  intercept(t, n, r, o) {
    let { chainedCallIds: s, isDebugging: i, playUntil: l } = this.getState(r.storyId), a = s.has(r.id);
    return !i || a || l ? (l === r.id && this.setState(r.storyId, { playUntil: void 0 }), this.invoke(t, n, r, o)) : new Promise((m) => {
      this.setState(r.storyId, ({ resolvers: p }) => ({
        isLocked: !1,
        resolvers: { ...p, [r.id]: m }
      }));
    }).then(() => (this.setState(r.storyId, (m) => {
      let { [r.id]: p, ...f } = m.resolvers;
      return { isLocked: !0, resolvers: f };
    }), this.invoke(t, n, r, o)));
  }
  invoke(t, n, r, o) {
    let { callRefsByResult: s, renderPhase: i } = this.getState(r.storyId), l = 25, a = /* @__PURE__ */ c((f, y, d) => {
      if (d.includes(f))
        return "[Circular]";
      if (d = [...d, f], y > l)
        return "...";
      if (s.has(f))
        return s.get(f);
      if (f instanceof Array)
        return f.map((g) => a(g, ++y, d));
      if (f instanceof Date)
        return { __date__: { value: f.toISOString() } };
      if (f instanceof Error) {
        let { name: g, message: u, stack: h } = f;
        return { __error__: { name: g, message: u, stack: h } };
      }
      if (f instanceof RegExp) {
        let { flags: g, source: u } = f;
        return { __regexp__: { flags: g, source: u } };
      }
      if (f instanceof H.global.window?.HTMLElement) {
        let { prefix: g, localName: u, id: h, classList: S, innerText: _ } = f, O = Array.from(S);
        return { __element__: { prefix: g, localName: u, id: h, classNames: O, innerText: _ } };
      }
      return typeof f == "function" ? {
        __function__: { name: "getMockName" in f ? f.getMockName() : f.name }
      } : typeof f == "symbol" ? { __symbol__: { description: f.description } } : typeof f == "object" && f?.constructor?.name && f?.constructor?.
      name !== "Object" ? { __class__: { name: f.constructor.name } } : Object.prototype.toString.call(f) === "[object Object]" ? Object.fromEntries(
        Object.entries(f).map(([g, u]) => [g, a(u, ++y, d)])
      ) : f;
    }, "serializeValues"), m = {
      ...r,
      args: r.args.map((f) => a(f, 0, []))
    };
    r.path.forEach((f) => {
      f?.__callId__ && this.setState(r.storyId, ({ chainedCallIds: y }) => ({
        chainedCallIds: new Set(Array.from(y).concat(f.__callId__))
      }));
    });
    let p = /* @__PURE__ */ c((f) => {
      if (f instanceof Error) {
        let { name: y, message: d, stack: g, callId: u = r.id } = f, {
          showDiff: h = void 0,
          diff: S = void 0,
          actual: _ = void 0,
          expected: O = void 0
        } = f.name === "AssertionError" ? It(f) : f, b = { name: y, message: d, stack: g, callId: u, showDiff: h, diff: S, actual: _, expected: O };
        if (this.update({ ...m, status: "error", exception: b }), this.setState(r.storyId, (E) => ({
          callRefsByResult: new Map([
            ...Array.from(E.callRefsByResult.entries()),
            [f, { __callId__: r.id, retain: r.retain }]
          ])
        })), r.ancestors?.length)
          throw Object.prototype.hasOwnProperty.call(f, "callId") || Object.defineProperty(f, "callId", { value: r.id }), f;
      }
      throw f;
    }, "handleException");
    try {
      if (i === "played" && !r.retain)
        throw ni;
      let y = (o.getArgs ? o.getArgs(r, this.getState(r.storyId)) : r.args).map((g) => typeof g != "function" || ci(g) || Object.keys(g).length ?
      g : (...u) => {
        let { cursor: h, ancestors: S } = this.getState(r.storyId);
        this.setState(r.storyId, { cursor: 0, ancestors: [...S, r.id] });
        let _ = /* @__PURE__ */ c(() => this.setState(r.storyId, { cursor: h, ancestors: S }), "restore"), O = !1;
        try {
          let b = g(...u);
          return b instanceof Promise ? (O = !0, b.finally(_)) : b;
        } finally {
          O || _();
        }
      }), d = t.apply(n, y);
      return d && ["object", "function", "symbol"].includes(typeof d) && this.setState(r.storyId, (g) => ({
        callRefsByResult: new Map([
          ...Array.from(g.callRefsByResult.entries()),
          [d, { __callId__: r.id, retain: r.retain }]
        ])
      })), this.update({
        ...m,
        status: d instanceof Promise ? "active" : "done"
      }), d instanceof Promise ? d.then((g) => (this.update({ ...m, status: "done" }), g), p) : d;
    } catch (f) {
      return p(f);
    }
  }
  // Sends the call info to the manager and synchronizes the log.
  update(t) {
    this.channel?.emit(ee.CALL, t), this.setState(t.storyId, ({ calls: n }) => {
      let r = n.concat(t).reduce((o, s) => Object.assign(o, { [s.id]: s }), {});
      return {
        // Calls are sorted to ensure parent calls always come before calls in their callback.
        calls: Object.values(r).sort(
          (o, s) => o.id.localeCompare(s.id, void 0, { numeric: !0 })
        )
      };
    }), this.sync(t.storyId);
  }
  // Builds a log of interceptable calls and control states and sends it to the manager.
  // Uses a 0ms debounce because this might get called many times in one tick.
  sync(t) {
    let n = /* @__PURE__ */ c(() => {
      let { isLocked: r, isPlaying: o } = this.getState(t), s = this.getLog(t), i = s.filter(({ ancestors: f }) => !f.length).find((f) => f.
      status === "waiting")?.callId, l = s.some((f) => f.status === "active");
      if (this.detached || r || l || s.length === 0) {
        let y = { controlStates: {
          detached: this.detached,
          start: !1,
          back: !1,
          goto: !1,
          next: !1,
          end: !1
        }, logItems: s };
        this.channel?.emit(ee.SYNC, y);
        return;
      }
      let a = s.some(
        (f) => f.status === "done" || f.status === "error"
      ), p = { controlStates: {
        detached: this.detached,
        start: a,
        back: a,
        goto: !0,
        next: o,
        end: o
      }, logItems: s, pausedAt: i };
      this.channel?.emit(ee.SYNC, p);
    }, "synchronize");
    this.setState(t, ({ syncTimeout: r }) => (clearTimeout(r), { syncTimeout: setTimeout(n, 0) }));
  }
};
function mr(e, t = {}) {
  try {
    let n = !1, r = !1;
    return H.global.window?.location?.search?.includes("instrument=true") ? n = !0 : H.global.window?.location?.search?.includes("instrument\
=false") && (r = !0), H.global.window?.parent === H.global.window && !n || r ? e : (H.global.window && !H.global.window.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__ &&
    (H.global.window.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__ = new Lt()), (H.global.window?.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__).
    instrument(e, t));
  } catch (n) {
    return fr.once.warn(n), e;
  }
}
c(mr, "instrument");
function ii(e, t) {
  let n = e;
  for (; n != null; ) {
    let r = Object.getOwnPropertyDescriptor(n, t);
    if (r)
      return r;
    n = Object.getPrototypeOf(n);
  }
}
c(ii, "getPropertyDescriptor");
function ci(e) {
  if (typeof e != "function")
    return !1;
  let t = Object.getOwnPropertyDescriptor(e, "prototype");
  return t ? !t.writable : !1;
}
c(ci, "isClass");
