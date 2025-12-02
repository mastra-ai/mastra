var lr = Object.defineProperty;
var i = (e, t) => lr(e, "name", { value: t, configurable: !0 });

// src/instrumenter/instrumenter.ts
import { once as qs } from "storybook/internal/client-logger";
import {
  FORCE_REMOUNT as ir,
  SET_CURRENT_STORY as Ks,
  STORY_RENDER_PHASE_CHANGED as Gs
} from "storybook/internal/core-events";
import { global as Z } from "@storybook/global";

// ../node_modules/tinyrainbow/dist/chunk-BVHSVHOK.js
var fr = {
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
}, mr = Object.entries(fr);
function Ge(e) {
  return String(e);
}
i(Ge, "a");
Ge.open = "";
Ge.close = "";
function Ft(e = !1) {
  let t = typeof process < "u" ? process : void 0, n = t?.env || {}, r = t?.argv || [];
  return !("NO_COLOR" in n || r.includes("--no-color")) && ("FORCE_COLOR" in n || r.includes("--color") || t?.platform === "win32" || e && n.
  TERM !== "dumb" || "CI" in n) || typeof window < "u" && !!window.chrome;
}
i(Ft, "C");
function jt(e = !1) {
  let t = Ft(e), n = /* @__PURE__ */ i((c, a, u, m) => {
    let p = "", l = 0;
    do
      p += c.substring(l, m) + u, l = m + a.length, m = c.indexOf(a, l);
    while (~m);
    return p + c.substring(l);
  }, "i"), r = /* @__PURE__ */ i((c, a, u = c) => {
    let m = /* @__PURE__ */ i((p) => {
      let l = String(p), b = l.indexOf(a, c.length);
      return ~b ? c + n(l, a, u, b) + a : c + l + a;
    }, "o");
    return m.open = c, m.close = a, m;
  }, "g"), o = {
    isColorSupported: t
  }, s = /* @__PURE__ */ i((c) => `\x1B[${c}m`, "d");
  for (let [c, a] of mr)
    o[c] = t ? r(
      s(a[0]),
      s(a[1]),
      a[2]
    ) : Ge;
  return o;
}
i(jt, "p");

// ../node_modules/tinyrainbow/dist/browser.js
var v = jt();

// ../node_modules/@vitest/pretty-format/dist/index.js
function Xt(e, t) {
  return t.forEach(function(n) {
    n && typeof n != "string" && !Array.isArray(n) && Object.keys(n).forEach(function(r) {
      if (r !== "default" && !(r in e)) {
        var o = Object.getOwnPropertyDescriptor(n, r);
        Object.defineProperty(e, r, o.get ? o : {
          enumerable: !0,
          get: /* @__PURE__ */ i(function() {
            return n[r];
          }, "get")
        });
      }
    });
  }), Object.freeze(e);
}
i(Xt, "_mergeNamespaces");
function pr(e, t) {
  let n = Object.keys(e), r = t === null ? n : n.sort(t);
  if (Object.getOwnPropertySymbols)
    for (let o of Object.getOwnPropertySymbols(e))
      Object.getOwnPropertyDescriptor(e, o).enumerable && r.push(o);
  return r;
}
i(pr, "getKeysOfEnumerableProperties");
function Ee(e, t, n, r, o, s, c = ": ") {
  let a = "", u = 0, m = e.next();
  if (!m.done) {
    a += t.spacingOuter;
    let p = n + t.indent;
    for (; !m.done; ) {
      if (a += p, u++ === t.maxWidth) {
        a += "\u2026";
        break;
      }
      let l = s(m.value[0], t, p, r, o), b = s(m.value[1], t, p, r, o);
      a += l + c + b, m = e.next(), m.done ? t.min || (a += ",") : a += `,${t.spacingInner}`;
    }
    a += t.spacingOuter + n;
  }
  return a;
}
i(Ee, "printIteratorEntries");
function Qe(e, t, n, r, o, s) {
  let c = "", a = 0, u = e.next();
  if (!u.done) {
    c += t.spacingOuter;
    let m = n + t.indent;
    for (; !u.done; ) {
      if (c += m, a++ === t.maxWidth) {
        c += "\u2026";
        break;
      }
      c += s(u.value, t, m, r, o), u = e.next(), u.done ? t.min || (c += ",") : c += `,${t.spacingInner}`;
    }
    c += t.spacingOuter + n;
  }
  return c;
}
i(Qe, "printIteratorValues");
function Ae(e, t, n, r, o, s) {
  let c = "";
  e = e instanceof ArrayBuffer ? new DataView(e) : e;
  let a = /* @__PURE__ */ i((m) => m instanceof DataView, "isDataView"), u = a(e) ? e.byteLength : e.length;
  if (u > 0) {
    c += t.spacingOuter;
    let m = n + t.indent;
    for (let p = 0; p < u; p++) {
      if (c += m, p === t.maxWidth) {
        c += "\u2026";
        break;
      }
      (a(e) || p in e) && (c += s(a(e) ? e.getInt8(p) : e[p], t, m, r, o)), p < u - 1 ? c += `,${t.spacingInner}` : t.min || (c += ",");
    }
    c += t.spacingOuter + n;
  }
  return c;
}
i(Ae, "printListItems");
function ve(e, t, n, r, o, s) {
  let c = "", a = pr(e, t.compareKeys);
  if (a.length > 0) {
    c += t.spacingOuter;
    let u = n + t.indent;
    for (let m = 0; m < a.length; m++) {
      let p = a[m], l = s(p, t, u, r, o), b = s(e[p], t, u, r, o);
      c += `${u + l}: ${b}`, m < a.length - 1 ? c += `,${t.spacingInner}` : t.min || (c += ",");
    }
    c += t.spacingOuter + n;
  }
  return c;
}
i(ve, "printObjectProperties");
var gr = typeof Symbol == "function" && Symbol.for ? Symbol.for("jest.asymmetricMatcher") : 1267621, we = " ", hr = /* @__PURE__ */ i((e, t, n, r, o, s) => {
  let c = e.toString();
  if (c === "ArrayContaining" || c === "ArrayNotContaining")
    return ++r > t.maxDepth ? `[${c}]` : `${c + we}[${Ae(e.sample, t, n, r, o, s)}]`;
  if (c === "ObjectContaining" || c === "ObjectNotContaining")
    return ++r > t.maxDepth ? `[${c}]` : `${c + we}{${ve(e.sample, t, n, r, o, s)}}`;
  if (c === "StringMatching" || c === "StringNotMatching" || c === "StringContaining" || c === "StringNotContaining")
    return c + we + s(e.sample, t, n, r, o);
  if (typeof e.toAsymmetricMatcher != "function")
    throw new TypeError(`Asymmetric matcher ${e.constructor.name} does not implement toAsymmetricMatcher()`);
  return e.toAsymmetricMatcher();
}, "serialize$5"), dr = /* @__PURE__ */ i((e) => e && e.$$typeof === gr, "test$5"), yr = {
  serialize: hr,
  test: dr
}, br = " ", Zt = /* @__PURE__ */ new Set(["DOMStringMap", "NamedNodeMap"]), Sr = /^(?:HTML\w*Collection|NodeList)$/;
function Er(e) {
  return Zt.has(e) || Sr.test(e);
}
i(Er, "testName");
var _r = /* @__PURE__ */ i((e) => e && e.constructor && !!e.constructor.name && Er(e.constructor.name), "test$4");
function Tr(e) {
  return e.constructor.name === "NamedNodeMap";
}
i(Tr, "isNamedNodeMap");
var Cr = /* @__PURE__ */ i((e, t, n, r, o, s) => {
  let c = e.constructor.name;
  return ++r > t.maxDepth ? `[${c}]` : (t.min ? "" : c + br) + (Zt.has(c) ? `{${ve(Tr(e) ? [...e].reduce((a, u) => (a[u.name] = u.value, a),
  {}) : { ...e }, t, n, r, o, s)}}` : `[${Ae([...e], t, n, r, o, s)}]`);
}, "serialize$4"), Or = {
  serialize: Cr,
  test: _r
};
function Qt(e) {
  return e.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
i(Qt, "escapeHTML");
function et(e, t, n, r, o, s, c) {
  let a = r + n.indent, u = n.colors;
  return e.map((m) => {
    let p = t[m], l = c(p, n, a, o, s);
    return typeof p != "string" && (l.includes(`
`) && (l = n.spacingOuter + a + l + n.spacingOuter + r), l = `{${l}}`), `${n.spacingInner + r + u.prop.open + m + u.prop.close}=${u.value.open}${l}${u.
    value.close}`;
  }).join("");
}
i(et, "printProps");
function tt(e, t, n, r, o, s) {
  return e.map((c) => t.spacingOuter + n + (typeof c == "string" ? vt(c, t) : s(c, t, n, r, o))).join("");
}
i(tt, "printChildren");
function vt(e, t) {
  let n = t.colors.content;
  return n.open + Qt(e) + n.close;
}
i(vt, "printText");
function $r(e, t) {
  let n = t.colors.comment;
  return `${n.open}<!--${Qt(e)}-->${n.close}`;
}
i($r, "printComment");
function nt(e, t, n, r, o) {
  let s = r.colors.tag;
  return `${s.open}<${e}${t && s.close + t + r.spacingOuter + o + s.open}${n ? `>${s.close}${n}${r.spacingOuter}${o}${s.open}</${e}` : `${t &&
  !r.min ? "" : " "}/`}>${s.close}`;
}
i(nt, "printElement");
function rt(e, t) {
  let n = t.colors.tag;
  return `${n.open}<${e}${n.close} \u2026${n.open} />${n.close}`;
}
i(rt, "printElementAsLeaf");
var wr = 1, en = 3, tn = 8, nn = 11, Rr = /^(?:(?:HTML|SVG)\w*)?Element$/;
function Ar(e) {
  try {
    return typeof e.hasAttribute == "function" && e.hasAttribute("is");
  } catch {
    return !1;
  }
}
i(Ar, "testHasAttribute");
function Pr(e) {
  let t = e.constructor.name, { nodeType: n, tagName: r } = e, o = typeof r == "string" && r.includes("-") || Ar(e);
  return n === wr && (Rr.test(t) || o) || n === en && t === "Text" || n === tn && t === "Comment" || n === nn && t === "DocumentFragment";
}
i(Pr, "testNode");
var Nr = /* @__PURE__ */ i((e) => {
  var t;
  return (e == null || (t = e.constructor) === null || t === void 0 ? void 0 : t.name) && Pr(e);
}, "test$3");
function Ir(e) {
  return e.nodeType === en;
}
i(Ir, "nodeIsText");
function Mr(e) {
  return e.nodeType === tn;
}
i(Mr, "nodeIsComment");
function He(e) {
  return e.nodeType === nn;
}
i(He, "nodeIsFragment");
var Lr = /* @__PURE__ */ i((e, t, n, r, o, s) => {
  if (Ir(e))
    return vt(e.data, t);
  if (Mr(e))
    return $r(e.data, t);
  let c = He(e) ? "DocumentFragment" : e.tagName.toLowerCase();
  return ++r > t.maxDepth ? rt(c, t) : nt(c, et(He(e) ? [] : Array.from(e.attributes, (a) => a.name).sort(), He(e) ? {} : [...e.attributes].
  reduce((a, u) => (a[u.name] = u.value, a), {}), t, n + t.indent, r, o, s), tt(Array.prototype.slice.call(e.childNodes || e.children), t, n +
  t.indent, r, o, s), t, n);
}, "serialize$3"), xr = {
  serialize: Lr,
  test: Nr
}, Dr = "@@__IMMUTABLE_ITERABLE__@@", Fr = "@@__IMMUTABLE_LIST__@@", jr = "@@__IMMUTABLE_KEYED__@@", kr = "@@__IMMUTABLE_MAP__@@", kt = "@@_\
_IMMUTABLE_ORDERED__@@", Br = "@@__IMMUTABLE_RECORD__@@", zr = "@@__IMMUTABLE_SEQ__@@", Yr = "@@__IMMUTABLE_SET__@@", Ur = "@@__IMMUTABLE_ST\
ACK__@@", de = /* @__PURE__ */ i((e) => `Immutable.${e}`, "getImmutableName"), Ne = /* @__PURE__ */ i((e) => `[${e}]`, "printAsLeaf"), Se = "\
 ", Bt = "\u2026";
function Wr(e, t, n, r, o, s, c) {
  return ++r > t.maxDepth ? Ne(de(c)) : `${de(c) + Se}{${Ee(e.entries(), t, n, r, o, s)}}`;
}
i(Wr, "printImmutableEntries");
function Vr(e) {
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
i(Vr, "getRecordEntries");
function qr(e, t, n, r, o, s) {
  let c = de(e._name || "Record");
  return ++r > t.maxDepth ? Ne(c) : `${c + Se}{${Ee(Vr(e), t, n, r, o, s)}}`;
}
i(qr, "printImmutableRecord");
function Kr(e, t, n, r, o, s) {
  let c = de("Seq");
  return ++r > t.maxDepth ? Ne(c) : e[jr] ? `${c + Se}{${e._iter || e._object ? Ee(e.entries(), t, n, r, o, s) : Bt}}` : `${c + Se}[${e._iter ||
  e._array || e._collection || e._iterable ? Qe(e.values(), t, n, r, o, s) : Bt}]`;
}
i(Kr, "printImmutableSeq");
function Je(e, t, n, r, o, s, c) {
  return ++r > t.maxDepth ? Ne(de(c)) : `${de(c) + Se}[${Qe(e.values(), t, n, r, o, s)}]`;
}
i(Je, "printImmutableValues");
var Gr = /* @__PURE__ */ i((e, t, n, r, o, s) => e[kr] ? Wr(e, t, n, r, o, s, e[kt] ? "OrderedMap" : "Map") : e[Fr] ? Je(e, t, n, r, o, s, "\
List") : e[Yr] ? Je(e, t, n, r, o, s, e[kt] ? "OrderedSet" : "Set") : e[Ur] ? Je(e, t, n, r, o, s, "Stack") : e[zr] ? Kr(e, t, n, r, o, s) :
qr(e, t, n, r, o, s), "serialize$2"), Hr = /* @__PURE__ */ i((e) => e && (e[Dr] === !0 || e[Br] === !0), "test$2"), Jr = {
  serialize: Gr,
  test: Hr
};
function rn(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
i(rn, "getDefaultExportFromCjs");
var Xe = { exports: {} };
var A = {};
var zt;
function Xr() {
  return zt || (zt = 1, function() {
    function e(f) {
      if (typeof f == "object" && f !== null) {
        var d = f.$$typeof;
        switch (d) {
          case t:
            switch (f = f.type, f) {
              case r:
              case s:
              case o:
              case m:
              case p:
              case g:
                return f;
              default:
                switch (f = f && f.$$typeof, f) {
                  case a:
                  case u:
                  case b:
                  case l:
                    return f;
                  case c:
                    return f;
                  default:
                    return d;
                }
            }
          case n:
            return d;
        }
      }
    }
    i(e, "typeOf");
    var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), o = Symbol.for("reac\
t.strict_mode"), s = Symbol.for("react.profiler"), c = Symbol.for("react.consumer"), a = Symbol.for("react.context"), u = Symbol.for("react.\
forward_ref"), m = Symbol.for("react.suspense"), p = Symbol.for("react.suspense_list"), l = Symbol.for("react.memo"), b = Symbol.for("react.\
lazy"), g = Symbol.for("react.view_transition"), h = Symbol.for("react.client.reference");
    A.ContextConsumer = c, A.ContextProvider = a, A.Element = t, A.ForwardRef = u, A.Fragment = r, A.Lazy = b, A.Memo = l, A.Portal = n, A.Profiler =
    s, A.StrictMode = o, A.Suspense = m, A.SuspenseList = p, A.isContextConsumer = function(f) {
      return e(f) === c;
    }, A.isContextProvider = function(f) {
      return e(f) === a;
    }, A.isElement = function(f) {
      return typeof f == "object" && f !== null && f.$$typeof === t;
    }, A.isForwardRef = function(f) {
      return e(f) === u;
    }, A.isFragment = function(f) {
      return e(f) === r;
    }, A.isLazy = function(f) {
      return e(f) === b;
    }, A.isMemo = function(f) {
      return e(f) === l;
    }, A.isPortal = function(f) {
      return e(f) === n;
    }, A.isProfiler = function(f) {
      return e(f) === s;
    }, A.isStrictMode = function(f) {
      return e(f) === o;
    }, A.isSuspense = function(f) {
      return e(f) === m;
    }, A.isSuspenseList = function(f) {
      return e(f) === p;
    }, A.isValidElementType = function(f) {
      return typeof f == "string" || typeof f == "function" || f === r || f === s || f === o || f === m || f === p || typeof f == "object" &&
      f !== null && (f.$$typeof === b || f.$$typeof === l || f.$$typeof === a || f.$$typeof === c || f.$$typeof === u || f.$$typeof === h ||
      f.getModuleId !== void 0);
    }, A.typeOf = e;
  }()), A;
}
i(Xr, "requireReactIs_development$1");
var Yt;
function Zr() {
  return Yt || (Yt = 1, Xe.exports = Xr()), Xe.exports;
}
i(Zr, "requireReactIs$1");
var on = Zr(), Qr = /* @__PURE__ */ rn(on), vr = /* @__PURE__ */ Xt({
  __proto__: null,
  default: Qr
}, [on]), Ze = { exports: {} };
var w = {};
var Ut;
function eo() {
  return Ut || (Ut = 1, function() {
    var e = Symbol.for("react.element"), t = Symbol.for("react.portal"), n = Symbol.for("react.fragment"), r = Symbol.for("react.strict_mode"),
    o = Symbol.for("react.profiler"), s = Symbol.for("react.provider"), c = Symbol.for("react.context"), a = Symbol.for("react.server_contex\
t"), u = Symbol.for("react.forward_ref"), m = Symbol.for("react.suspense"), p = Symbol.for("react.suspense_list"), l = Symbol.for("react.mem\
o"), b = Symbol.for("react.lazy"), g = Symbol.for("react.offscreen"), h = !1, f = !1, d = !1, S = !1, _ = !1, O;
    O = Symbol.for("react.module.reference");
    function y(C) {
      return !!(typeof C == "string" || typeof C == "function" || C === n || C === o || _ || C === r || C === m || C === p || S || C === g ||
      h || f || d || typeof C == "object" && C !== null && (C.$$typeof === b || C.$$typeof === l || C.$$typeof === s || C.$$typeof === c || C.
      $$typeof === u || // This needs to include all possible module reference object
      // types supported by any Flight configuration anywhere since
      // we don't know which Flight build this will end up being used
      // with.
      C.$$typeof === O || C.getModuleId !== void 0));
    }
    i(y, "isValidElementType");
    function E(C) {
      if (typeof C == "object" && C !== null) {
        var Ke = C.$$typeof;
        switch (Ke) {
          case e:
            var $e = C.type;
            switch ($e) {
              case n:
              case o:
              case r:
              case m:
              case p:
                return $e;
              default:
                var Dt = $e && $e.$$typeof;
                switch (Dt) {
                  case a:
                  case c:
                  case u:
                  case b:
                  case l:
                  case s:
                    return Dt;
                  default:
                    return Ke;
                }
            }
          case t:
            return Ke;
        }
      }
    }
    i(E, "typeOf");
    var $ = c, T = s, R = e, K = u, Q = n, I = b, k = l, G = t, Y = o, N = r, L = m, x = p, H = !1, F = !1;
    function W(C) {
      return H || (H = !0, console.warn("The ReactIs.isAsyncMode() alias has been deprecated, and will be removed in React 18+.")), !1;
    }
    i(W, "isAsyncMode");
    function re(C) {
      return F || (F = !0, console.warn("The ReactIs.isConcurrentMode() alias has been deprecated, and will be removed in React 18+.")), !1;
    }
    i(re, "isConcurrentMode");
    function V(C) {
      return E(C) === c;
    }
    i(V, "isContextConsumer");
    function q(C) {
      return E(C) === s;
    }
    i(q, "isContextProvider");
    function se(C) {
      return typeof C == "object" && C !== null && C.$$typeof === e;
    }
    i(se, "isElement");
    function J(C) {
      return E(C) === u;
    }
    i(J, "isForwardRef");
    function U(C) {
      return E(C) === n;
    }
    i(U, "isFragment");
    function oe(C) {
      return E(C) === b;
    }
    i(oe, "isLazy");
    function he(C) {
      return E(C) === l;
    }
    i(he, "isMemo");
    function ue(C) {
      return E(C) === t;
    }
    i(ue, "isPortal");
    function be(C) {
      return E(C) === o;
    }
    i(be, "isProfiler");
    function Ce(C) {
      return E(C) === r;
    }
    i(Ce, "isStrictMode");
    function Oe(C) {
      return E(C) === m;
    }
    i(Oe, "isSuspense");
    function ar(C) {
      return E(C) === p;
    }
    i(ar, "isSuspenseList"), w.ContextConsumer = $, w.ContextProvider = T, w.Element = R, w.ForwardRef = K, w.Fragment = Q, w.Lazy = I, w.Memo =
    k, w.Portal = G, w.Profiler = Y, w.StrictMode = N, w.Suspense = L, w.SuspenseList = x, w.isAsyncMode = W, w.isConcurrentMode = re, w.isContextConsumer =
    V, w.isContextProvider = q, w.isElement = se, w.isForwardRef = J, w.isFragment = U, w.isLazy = oe, w.isMemo = he, w.isPortal = ue, w.isProfiler =
    be, w.isStrictMode = Ce, w.isSuspense = Oe, w.isSuspenseList = ar, w.isValidElementType = y, w.typeOf = E;
  }()), w;
}
i(eo, "requireReactIs_development");
var Wt;
function to() {
  return Wt || (Wt = 1, Ze.exports = eo()), Ze.exports;
}
i(to, "requireReactIs");
var sn = to(), no = /* @__PURE__ */ rn(sn), ro = /* @__PURE__ */ Xt({
  __proto__: null,
  default: no
}, [sn]), oo = [
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
], fe = Object.fromEntries(oo.map((e) => [e, (t) => ro[e](t) || vr[e](t)]));
function cn(e, t = []) {
  if (Array.isArray(e))
    for (let n of e)
      cn(n, t);
  else e != null && e !== !1 && e !== "" && t.push(e);
  return t;
}
i(cn, "getChildren");
function Vt(e) {
  let t = e.type;
  if (typeof t == "string")
    return t;
  if (typeof t == "function")
    return t.displayName || t.name || "Unknown";
  if (fe.isFragment(e))
    return "React.Fragment";
  if (fe.isSuspense(e))
    return "React.Suspense";
  if (typeof t == "object" && t !== null) {
    if (fe.isContextProvider(e))
      return "Context.Provider";
    if (fe.isContextConsumer(e))
      return "Context.Consumer";
    if (fe.isForwardRef(e)) {
      if (t.displayName)
        return t.displayName;
      let n = t.render.displayName || t.render.name || "";
      return n === "" ? "ForwardRef" : `ForwardRef(${n})`;
    }
    if (fe.isMemo(e)) {
      let n = t.displayName || t.type.displayName || t.type.name || "";
      return n === "" ? "Memo" : `Memo(${n})`;
    }
  }
  return "UNDEFINED";
}
i(Vt, "getType");
function so(e) {
  let { props: t } = e;
  return Object.keys(t).filter((n) => n !== "children" && t[n] !== void 0).sort();
}
i(so, "getPropKeys$1");
var io = /* @__PURE__ */ i((e, t, n, r, o, s) => ++r > t.maxDepth ? rt(Vt(e), t) : nt(Vt(e), et(so(e), e.props, t, n + t.indent, r, o, s), tt(
cn(e.props.children), t, n + t.indent, r, o, s), t, n), "serialize$1"), co = /* @__PURE__ */ i((e) => e != null && fe.isElement(e), "test$1"),
uo = {
  serialize: io,
  test: co
}, ao = typeof Symbol == "function" && Symbol.for ? Symbol.for("react.test.json") : 245830487;
function lo(e) {
  let { props: t } = e;
  return t ? Object.keys(t).filter((n) => t[n] !== void 0).sort() : [];
}
i(lo, "getPropKeys");
var fo = /* @__PURE__ */ i((e, t, n, r, o, s) => ++r > t.maxDepth ? rt(e.type, t) : nt(e.type, e.props ? et(lo(e), e.props, t, n + t.indent,
r, o, s) : "", e.children ? tt(e.children, t, n + t.indent, r, o, s) : "", t, n), "serialize"), mo = /* @__PURE__ */ i((e) => e && e.$$typeof ===
ao, "test"), po = {
  serialize: fo,
  test: mo
}, un = Object.prototype.toString, go = Date.prototype.toISOString, ho = Error.prototype.toString, qt = RegExp.prototype.toString;
function Re(e) {
  return typeof e.constructor == "function" && e.constructor.name || "Object";
}
i(Re, "getConstructorName");
function yo(e) {
  return typeof window < "u" && e === window;
}
i(yo, "isWindow");
var bo = /^Symbol\((.*)\)(.*)$/, So = /\n/g, st = class st extends Error {
  constructor(t, n) {
    super(t), this.stack = n, this.name = this.constructor.name;
  }
};
i(st, "PrettyFormatPluginError");
var Pe = st;
function Eo(e) {
  return e === "[object Array]" || e === "[object ArrayBuffer]" || e === "[object DataView]" || e === "[object Float32Array]" || e === "[obj\
ect Float64Array]" || e === "[object Int8Array]" || e === "[object Int16Array]" || e === "[object Int32Array]" || e === "[object Uint8Array]" ||
  e === "[object Uint8ClampedArray]" || e === "[object Uint16Array]" || e === "[object Uint32Array]";
}
i(Eo, "isToStringedArrayType");
function _o(e) {
  return Object.is(e, -0) ? "-0" : String(e);
}
i(_o, "printNumber");
function To(e) {
  return `${e}n`;
}
i(To, "printBigInt");
function Kt(e, t) {
  return t ? `[Function ${e.name || "anonymous"}]` : "[Function]";
}
i(Kt, "printFunction");
function Gt(e) {
  return String(e).replace(bo, "Symbol($1)");
}
i(Gt, "printSymbol");
function Ht(e) {
  return `[${ho.call(e)}]`;
}
i(Ht, "printError");
function an(e, t, n, r) {
  if (e === !0 || e === !1)
    return `${e}`;
  if (e === void 0)
    return "undefined";
  if (e === null)
    return "null";
  let o = typeof e;
  if (o === "number")
    return _o(e);
  if (o === "bigint")
    return To(e);
  if (o === "string")
    return r ? `"${e.replaceAll(/"|\\/g, "\\$&")}"` : `"${e}"`;
  if (o === "function")
    return Kt(e, t);
  if (o === "symbol")
    return Gt(e);
  let s = un.call(e);
  return s === "[object WeakMap]" ? "WeakMap {}" : s === "[object WeakSet]" ? "WeakSet {}" : s === "[object Function]" || s === "[object Gen\
eratorFunction]" ? Kt(e, t) : s === "[object Symbol]" ? Gt(e) : s === "[object Date]" ? Number.isNaN(+e) ? "Date { NaN }" : go.call(e) : s ===
  "[object Error]" ? Ht(e) : s === "[object RegExp]" ? n ? qt.call(e).replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&") : qt.call(e) : e instanceof Error ?
  Ht(e) : null;
}
i(an, "printBasicValue");
function ln(e, t, n, r, o, s) {
  if (o.includes(e))
    return "[Circular]";
  o = [...o], o.push(e);
  let c = ++r > t.maxDepth, a = t.min;
  if (t.callToJSON && !c && e.toJSON && typeof e.toJSON == "function" && !s)
    return ae(e.toJSON(), t, n, r, o, !0);
  let u = un.call(e);
  return u === "[object Arguments]" ? c ? "[Arguments]" : `${a ? "" : "Arguments "}[${Ae(e, t, n, r, o, ae)}]` : Eo(u) ? c ? `[${e.constructor.
  name}]` : `${a || !t.printBasicPrototype && e.constructor.name === "Array" ? "" : `${e.constructor.name} `}[${Ae(e, t, n, r, o, ae)}]` : u ===
  "[object Map]" ? c ? "[Map]" : `Map {${Ee(e.entries(), t, n, r, o, ae, " => ")}}` : u === "[object Set]" ? c ? "[Set]" : `Set {${Qe(e.values(),
  t, n, r, o, ae)}}` : c || yo(e) ? `[${Re(e)}]` : `${a || !t.printBasicPrototype && Re(e) === "Object" ? "" : `${Re(e)} `}{${ve(e, t, n, r,
  o, ae)}}`;
}
i(ln, "printComplexValue");
var Co = {
  test: /* @__PURE__ */ i((e) => e && e instanceof Error, "test"),
  serialize(e, t, n, r, o, s) {
    if (o.includes(e))
      return "[Circular]";
    o = [...o, e];
    let c = ++r > t.maxDepth, { message: a, cause: u, ...m } = e, p = {
      message: a,
      ...typeof u < "u" ? { cause: u } : {},
      ...e instanceof AggregateError ? { errors: e.errors } : {},
      ...m
    }, l = e.name !== "Error" ? e.name : Re(e);
    return c ? `[${l}]` : `${l} {${Ee(Object.entries(p).values(), t, n, r, o, s)}}`;
  }
};
function Oo(e) {
  return e.serialize != null;
}
i(Oo, "isNewPlugin");
function fn(e, t, n, r, o, s) {
  let c;
  try {
    c = Oo(e) ? e.serialize(t, n, r, o, s, ae) : e.print(t, (a) => ae(a, n, r, o, s), (a) => {
      let u = r + n.indent;
      return u + a.replaceAll(So, `
${u}`);
    }, {
      edgeSpacing: n.spacingOuter,
      min: n.min,
      spacing: n.spacingInner
    }, n.colors);
  } catch (a) {
    throw new Pe(a.message, a.stack);
  }
  if (typeof c != "string")
    throw new TypeError(`pretty-format: Plugin must return type "string" but instead returned "${typeof c}".`);
  return c;
}
i(fn, "printPlugin");
function mn(e, t) {
  for (let n of e)
    try {
      if (n.test(t))
        return n;
    } catch (r) {
      throw new Pe(r.message, r.stack);
    }
  return null;
}
i(mn, "findPlugin");
function ae(e, t, n, r, o, s) {
  let c = mn(t.plugins, e);
  if (c !== null)
    return fn(c, e, t, n, r, o);
  let a = an(e, t.printFunctionName, t.escapeRegex, t.escapeString);
  return a !== null ? a : ln(e, t, n, r, o, s);
}
i(ae, "printer");
var ot = {
  comment: "gray",
  content: "reset",
  prop: "yellow",
  tag: "cyan",
  value: "green"
}, pn = Object.keys(ot), ee = {
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
  theme: ot
};
function $o(e) {
  for (let t of Object.keys(e))
    if (!Object.prototype.hasOwnProperty.call(ee, t))
      throw new Error(`pretty-format: Unknown option "${t}".`);
  if (e.min && e.indent !== void 0 && e.indent !== 0)
    throw new Error('pretty-format: Options "min" and "indent" cannot be used together.');
}
i($o, "validateOptions");
function wo() {
  return pn.reduce((e, t) => {
    let n = ot[t], r = n && v[n];
    if (r && typeof r.close == "string" && typeof r.open == "string")
      e[t] = r;
    else
      throw new Error(`pretty-format: Option "theme" has a key "${t}" whose value "${n}" is undefined in ansi-styles.`);
    return e;
  }, /* @__PURE__ */ Object.create(null));
}
i(wo, "getColorsHighlight");
function Ro() {
  return pn.reduce((e, t) => (e[t] = {
    close: "",
    open: ""
  }, e), /* @__PURE__ */ Object.create(null));
}
i(Ro, "getColorsEmpty");
function gn(e) {
  return e?.printFunctionName ?? ee.printFunctionName;
}
i(gn, "getPrintFunctionName");
function hn(e) {
  return e?.escapeRegex ?? ee.escapeRegex;
}
i(hn, "getEscapeRegex");
function dn(e) {
  return e?.escapeString ?? ee.escapeString;
}
i(dn, "getEscapeString");
function Jt(e) {
  return {
    callToJSON: e?.callToJSON ?? ee.callToJSON,
    colors: e?.highlight ? wo() : Ro(),
    compareKeys: typeof e?.compareKeys == "function" || e?.compareKeys === null ? e.compareKeys : ee.compareKeys,
    escapeRegex: hn(e),
    escapeString: dn(e),
    indent: e?.min ? "" : Ao(e?.indent ?? ee.indent),
    maxDepth: e?.maxDepth ?? ee.maxDepth,
    maxWidth: e?.maxWidth ?? ee.maxWidth,
    min: e?.min ?? ee.min,
    plugins: e?.plugins ?? ee.plugins,
    printBasicPrototype: e?.printBasicPrototype ?? !0,
    printFunctionName: gn(e),
    spacingInner: e?.min ? " " : `
`,
    spacingOuter: e?.min ? "" : `
`
  };
}
i(Jt, "getConfig");
function Ao(e) {
  return Array.from({ length: e + 1 }).join(" ");
}
i(Ao, "createIndent");
function X(e, t) {
  if (t && ($o(t), t.plugins)) {
    let r = mn(t.plugins, e);
    if (r !== null)
      return fn(r, e, Jt(t), "", 0, []);
  }
  let n = an(e, gn(t), hn(t), dn(t));
  return n !== null ? n : ln(e, Jt(t), "", 0, []);
}
i(X, "format");
var _e = {
  AsymmetricMatcher: yr,
  DOMCollection: Or,
  DOMElement: xr,
  Immutable: Jr,
  ReactElement: uo,
  ReactTestComponent: po,
  Error: Co
};

// ../node_modules/loupe/lib/helpers.js
var yn = {
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
}, Po = {
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
}, ie = "\u2026";
function No(e, t) {
  let n = yn[Po[t]] || yn[t] || "";
  return n ? `\x1B[${n[0]}m${String(e)}\x1B[${n[1]}m` : String(e);
}
i(No, "colorise");
function bn({
  showHidden: e = !1,
  depth: t = 2,
  colors: n = !1,
  customInspect: r = !0,
  showProxy: o = !1,
  maxArrayLength: s = 1 / 0,
  breakLength: c = 1 / 0,
  seen: a = [],
  // eslint-disable-next-line no-shadow
  truncate: u = 1 / 0,
  stylize: m = String
} = {}, p) {
  let l = {
    showHidden: !!e,
    depth: Number(t),
    colors: !!n,
    customInspect: !!r,
    showProxy: !!o,
    maxArrayLength: Number(s),
    breakLength: Number(c),
    truncate: Number(u),
    seen: a,
    inspect: p,
    stylize: m
  };
  return l.colors && (l.stylize = No), l;
}
i(bn, "normaliseOptions");
function Io(e) {
  return e >= "\uD800" && e <= "\uDBFF";
}
i(Io, "isHighSurrogate");
function B(e, t, n = ie) {
  e = String(e);
  let r = n.length, o = e.length;
  if (r > t && o > r)
    return n;
  if (o > t && o > r) {
    let s = t - r;
    return s > 0 && Io(e[s - 1]) && (s = s - 1), `${e.slice(0, s)}${n}`;
  }
  return e;
}
i(B, "truncate");
function D(e, t, n, r = ", ") {
  n = n || t.inspect;
  let o = e.length;
  if (o === 0)
    return "";
  let s = t.truncate, c = "", a = "", u = "";
  for (let m = 0; m < o; m += 1) {
    let p = m + 1 === e.length, l = m + 2 === e.length;
    u = `${ie}(${e.length - m})`;
    let b = e[m];
    t.truncate = s - c.length - (p ? 0 : r.length);
    let g = a || n(b, t) + (p ? "" : r), h = c.length + g.length, f = h + u.length;
    if (p && h > s && c.length + u.length <= s || !p && !l && f > s || (a = p ? "" : n(e[m + 1], t) + (l ? "" : r), !p && l && f > s && h + a.
    length > s))
      break;
    if (c += g, !p && !l && h + a.length >= s) {
      u = `${ie}(${e.length - m - 1})`;
      break;
    }
    u = "";
  }
  return `${c}${u}`;
}
i(D, "inspectList");
function Mo(e) {
  return e.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/) ? e : JSON.stringify(e).replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
}
i(Mo, "quoteComplexKey");
function ce([e, t], n) {
  return n.truncate -= 2, typeof e == "string" ? e = Mo(e) : typeof e != "number" && (e = `[${n.inspect(e, n)}]`), n.truncate -= e.length, t =
  n.inspect(t, n), `${e}: ${t}`;
}
i(ce, "inspectProperty");

// ../node_modules/loupe/lib/array.js
function it(e, t) {
  let n = Object.keys(e).slice(e.length);
  if (!e.length && !n.length)
    return "[]";
  t.truncate -= 4;
  let r = D(e, t);
  t.truncate -= r.length;
  let o = "";
  return n.length && (o = D(n.map((s) => [s, e[s]]), t, ce)), `[ ${r}${o ? `, ${o}` : ""} ]`;
}
i(it, "inspectArray");

// ../node_modules/loupe/lib/typedarray.js
var Lo = /* @__PURE__ */ i((e) => typeof Buffer == "function" && e instanceof Buffer ? "Buffer" : e[Symbol.toStringTag] ? e[Symbol.toStringTag] :
e.constructor.name, "getArrayName");
function te(e, t) {
  let n = Lo(e);
  t.truncate -= n.length + 4;
  let r = Object.keys(e).slice(e.length);
  if (!e.length && !r.length)
    return `${n}[]`;
  let o = "";
  for (let c = 0; c < e.length; c++) {
    let a = `${t.stylize(B(e[c], t.truncate), "number")}${c === e.length - 1 ? "" : ", "}`;
    if (t.truncate -= a.length, e[c] !== e.length && t.truncate <= 3) {
      o += `${ie}(${e.length - e[c] + 1})`;
      break;
    }
    o += a;
  }
  let s = "";
  return r.length && (s = D(r.map((c) => [c, e[c]]), t, ce)), `${n}[ ${o}${s ? `, ${s}` : ""} ]`;
}
i(te, "inspectTypedArray");

// ../node_modules/loupe/lib/date.js
function ct(e, t) {
  let n = e.toJSON();
  if (n === null)
    return "Invalid Date";
  let r = n.split("T"), o = r[0];
  return t.stylize(`${o}T${B(r[1], t.truncate - o.length - 1)}`, "date");
}
i(ct, "inspectDate");

// ../node_modules/loupe/lib/function.js
function Ie(e, t) {
  let n = e[Symbol.toStringTag] || "Function", r = e.name;
  return r ? t.stylize(`[${n} ${B(r, t.truncate - 11)}]`, "special") : t.stylize(`[${n}]`, "special");
}
i(Ie, "inspectFunction");

// ../node_modules/loupe/lib/map.js
function xo([e, t], n) {
  return n.truncate -= 4, e = n.inspect(e, n), n.truncate -= e.length, t = n.inspect(t, n), `${e} => ${t}`;
}
i(xo, "inspectMapEntry");
function Do(e) {
  let t = [];
  return e.forEach((n, r) => {
    t.push([r, n]);
  }), t;
}
i(Do, "mapToEntries");
function ut(e, t) {
  return e.size === 0 ? "Map{}" : (t.truncate -= 7, `Map{ ${D(Do(e), t, xo)} }`);
}
i(ut, "inspectMap");

// ../node_modules/loupe/lib/number.js
var Fo = Number.isNaN || ((e) => e !== e);
function Me(e, t) {
  return Fo(e) ? t.stylize("NaN", "number") : e === 1 / 0 ? t.stylize("Infinity", "number") : e === -1 / 0 ? t.stylize("-Infinity", "number") :
  e === 0 ? t.stylize(1 / e === 1 / 0 ? "+0" : "-0", "number") : t.stylize(B(String(e), t.truncate), "number");
}
i(Me, "inspectNumber");

// ../node_modules/loupe/lib/bigint.js
function Le(e, t) {
  let n = B(e.toString(), t.truncate - 1);
  return n !== ie && (n += "n"), t.stylize(n, "bigint");
}
i(Le, "inspectBigInt");

// ../node_modules/loupe/lib/regexp.js
function at(e, t) {
  let n = e.toString().split("/")[2], r = t.truncate - (2 + n.length), o = e.source;
  return t.stylize(`/${B(o, r)}/${n}`, "regexp");
}
i(at, "inspectRegExp");

// ../node_modules/loupe/lib/set.js
function jo(e) {
  let t = [];
  return e.forEach((n) => {
    t.push(n);
  }), t;
}
i(jo, "arrayFromSet");
function lt(e, t) {
  return e.size === 0 ? "Set{}" : (t.truncate -= 7, `Set{ ${D(jo(e), t)} }`);
}
i(lt, "inspectSet");

// ../node_modules/loupe/lib/string.js
var Sn = new RegExp("['\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\u\
ffff]", "g"), ko = {
  "\b": "\\b",
  "	": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
  "'": "\\'",
  "\\": "\\\\"
}, Bo = 16, zo = 4;
function Yo(e) {
  return ko[e] || `\\u${`0000${e.charCodeAt(0).toString(Bo)}`.slice(-zo)}`;
}
i(Yo, "escape");
function xe(e, t) {
  return Sn.test(e) && (e = e.replace(Sn, Yo)), t.stylize(`'${B(e, t.truncate - 2)}'`, "string");
}
i(xe, "inspectString");

// ../node_modules/loupe/lib/symbol.js
function De(e) {
  return "description" in Symbol.prototype ? e.description ? `Symbol(${e.description})` : "Symbol()" : e.toString();
}
i(De, "inspectSymbol");

// ../node_modules/loupe/lib/promise.js
var En = /* @__PURE__ */ i(() => "Promise{\u2026}", "getPromiseValue");
try {
  let { getPromiseDetails: e, kPending: t, kRejected: n } = process.binding("util");
  Array.isArray(e(Promise.resolve())) && (En = /* @__PURE__ */ i((r, o) => {
    let [s, c] = e(r);
    return s === t ? "Promise{<pending>}" : `Promise${s === n ? "!" : ""}{${o.inspect(c, o)}}`;
  }, "getPromiseValue"));
} catch {
}
var _n = En;

// ../node_modules/loupe/lib/object.js
function me(e, t) {
  let n = Object.getOwnPropertyNames(e), r = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(e) : [];
  if (n.length === 0 && r.length === 0)
    return "{}";
  if (t.truncate -= 4, t.seen = t.seen || [], t.seen.includes(e))
    return "[Circular]";
  t.seen.push(e);
  let o = D(n.map((a) => [a, e[a]]), t, ce), s = D(r.map((a) => [a, e[a]]), t, ce);
  t.seen.pop();
  let c = "";
  return o && s && (c = ", "), `{ ${o}${c}${s} }`;
}
i(me, "inspectObject");

// ../node_modules/loupe/lib/class.js
var ft = typeof Symbol < "u" && Symbol.toStringTag ? Symbol.toStringTag : !1;
function mt(e, t) {
  let n = "";
  return ft && ft in e && (n = e[ft]), n = n || e.constructor.name, (!n || n === "_class") && (n = "<Anonymous Class>"), t.truncate -= n.length,
  `${n}${me(e, t)}`;
}
i(mt, "inspectClass");

// ../node_modules/loupe/lib/arguments.js
function pt(e, t) {
  return e.length === 0 ? "Arguments[]" : (t.truncate -= 13, `Arguments[ ${D(e, t)} ]`);
}
i(pt, "inspectArguments");

// ../node_modules/loupe/lib/error.js
var Uo = [
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
function gt(e, t) {
  let n = Object.getOwnPropertyNames(e).filter((c) => Uo.indexOf(c) === -1), r = e.name;
  t.truncate -= r.length;
  let o = "";
  if (typeof e.message == "string" ? o = B(e.message, t.truncate) : n.unshift("message"), o = o ? `: ${o}` : "", t.truncate -= o.length + 5,
  t.seen = t.seen || [], t.seen.includes(e))
    return "[Circular]";
  t.seen.push(e);
  let s = D(n.map((c) => [c, e[c]]), t, ce);
  return `${r}${o}${s ? ` { ${s} }` : ""}`;
}
i(gt, "inspectObject");

// ../node_modules/loupe/lib/html.js
function Wo([e, t], n) {
  return n.truncate -= 3, t ? `${n.stylize(String(e), "yellow")}=${n.stylize(`"${t}"`, "string")}` : `${n.stylize(String(e), "yellow")}`;
}
i(Wo, "inspectAttribute");
function Fe(e, t) {
  return D(e, t, Vo, `
`);
}
i(Fe, "inspectNodeCollection");
function Vo(e, t) {
  switch (e.nodeType) {
    case 1:
      return je(e, t);
    case 3:
      return t.inspect(e.data, t);
    default:
      return t.inspect(e, t);
  }
}
i(Vo, "inspectNode");
function je(e, t) {
  let n = e.getAttributeNames(), r = e.tagName.toLowerCase(), o = t.stylize(`<${r}`, "special"), s = t.stylize(">", "special"), c = t.stylize(
  `</${r}>`, "special");
  t.truncate -= r.length * 2 + 5;
  let a = "";
  n.length > 0 && (a += " ", a += D(n.map((p) => [p, e.getAttribute(p)]), t, Wo, " ")), t.truncate -= a.length;
  let u = t.truncate, m = Fe(e.children, t);
  return m && m.length > u && (m = `${ie}(${e.children.length})`), `${o}${a}${s}${m}${c}`;
}
i(je, "inspectHTML");

// ../node_modules/loupe/lib/index.js
var qo = typeof Symbol == "function" && typeof Symbol.for == "function", ht = qo ? Symbol.for("chai/inspect") : "@@chai/inspect", dt = Symbol.
for("nodejs.util.inspect.custom"), Tn = /* @__PURE__ */ new WeakMap(), Cn = {}, On = {
  undefined: /* @__PURE__ */ i((e, t) => t.stylize("undefined", "undefined"), "undefined"),
  null: /* @__PURE__ */ i((e, t) => t.stylize("null", "null"), "null"),
  boolean: /* @__PURE__ */ i((e, t) => t.stylize(String(e), "boolean"), "boolean"),
  Boolean: /* @__PURE__ */ i((e, t) => t.stylize(String(e), "boolean"), "Boolean"),
  number: Me,
  Number: Me,
  bigint: Le,
  BigInt: Le,
  string: xe,
  String: xe,
  function: Ie,
  Function: Ie,
  symbol: De,
  // A Symbol polyfill will return `Symbol` not `symbol` from typedetect
  Symbol: De,
  Array: it,
  Date: ct,
  Map: ut,
  Set: lt,
  RegExp: at,
  Promise: _n,
  // WeakSet, WeakMap are totally opaque to us
  WeakSet: /* @__PURE__ */ i((e, t) => t.stylize("WeakSet{\u2026}", "special"), "WeakSet"),
  WeakMap: /* @__PURE__ */ i((e, t) => t.stylize("WeakMap{\u2026}", "special"), "WeakMap"),
  Arguments: pt,
  Int8Array: te,
  Uint8Array: te,
  Uint8ClampedArray: te,
  Int16Array: te,
  Uint16Array: te,
  Int32Array: te,
  Uint32Array: te,
  Float32Array: te,
  Float64Array: te,
  Generator: /* @__PURE__ */ i(() => "", "Generator"),
  DataView: /* @__PURE__ */ i(() => "", "DataView"),
  ArrayBuffer: /* @__PURE__ */ i(() => "", "ArrayBuffer"),
  Error: gt,
  HTMLCollection: Fe,
  NodeList: Fe
}, Ko = /* @__PURE__ */ i((e, t, n) => ht in e && typeof e[ht] == "function" ? e[ht](t) : dt in e && typeof e[dt] == "function" ? e[dt](t.depth,
t) : "inspect" in e && typeof e.inspect == "function" ? e.inspect(t.depth, t) : "constructor" in e && Tn.has(e.constructor) ? Tn.get(e.constructor)(
e, t) : Cn[n] ? Cn[n](e, t) : "", "inspectCustom"), Go = Object.prototype.toString;
function ke(e, t = {}) {
  let n = bn(t, ke), { customInspect: r } = n, o = e === null ? "null" : typeof e;
  if (o === "object" && (o = Go.call(e).slice(8, -1)), o in On)
    return On[o](e, n);
  if (r && e) {
    let c = Ko(e, n, o);
    if (c)
      return typeof c == "string" ? c : ke(c, n);
  }
  let s = e ? Object.getPrototypeOf(e) : !1;
  return s === Object.prototype || s === null ? me(e, n) : e && typeof HTMLElement == "function" && e instanceof HTMLElement ? je(e, n) : "c\
onstructor" in e ? e.constructor !== Object ? mt(e, n) : me(e, n) : e === Object(e) ? me(e, n) : n.stylize(String(e), o);
}
i(ke, "inspect");

// ../node_modules/@vitest/utils/dist/chunk-_commonjsHelpers.js
var { AsymmetricMatcher: Jo, DOMCollection: Xo, DOMElement: Zo, Immutable: Qo, ReactElement: vo, ReactTestComponent: es } = _e, $n = [
  es,
  vo,
  Zo,
  Xo,
  Qo,
  Jo
];
function pe(e, t = 10, { maxLength: n, ...r } = {}) {
  let o = n ?? 1e4, s;
  try {
    s = X(e, {
      maxDepth: t,
      escapeString: !1,
      plugins: $n,
      ...r
    });
  } catch {
    s = X(e, {
      callToJSON: !1,
      maxDepth: t,
      escapeString: !1,
      plugins: $n,
      ...r
    });
  }
  return s.length >= o && t > 1 ? pe(e, Math.floor(Math.min(t, Number.MAX_SAFE_INTEGER) / 2), {
    maxLength: n,
    ...r
  }) : s;
}
i(pe, "stringify");
var ts = /%[sdjifoOc%]/g;
function wn(...e) {
  if (typeof e[0] != "string") {
    let s = [];
    for (let c = 0; c < e.length; c++)
      s.push(Te(e[c], {
        depth: 0,
        colors: !1
      }));
    return s.join(" ");
  }
  let t = e.length, n = 1, r = e[0], o = String(r).replace(ts, (s) => {
    if (s === "%%")
      return "%";
    if (n >= t)
      return s;
    switch (s) {
      case "%s": {
        let c = e[n++];
        return typeof c == "bigint" ? `${c.toString()}n` : typeof c == "number" && c === 0 && 1 / c < 0 ? "-0" : typeof c == "object" && c !==
        null ? typeof c.toString == "function" && c.toString !== Object.prototype.toString ? c.toString() : Te(c, {
          depth: 0,
          colors: !1
        }) : String(c);
      }
      case "%d": {
        let c = e[n++];
        return typeof c == "bigint" ? `${c.toString()}n` : Number(c).toString();
      }
      case "%i": {
        let c = e[n++];
        return typeof c == "bigint" ? `${c.toString()}n` : Number.parseInt(String(c)).toString();
      }
      case "%f":
        return Number.parseFloat(String(e[n++])).toString();
      case "%o":
        return Te(e[n++], {
          showHidden: !0,
          showProxy: !0
        });
      case "%O":
        return Te(e[n++]);
      case "%c":
        return n++, "";
      case "%j":
        try {
          return JSON.stringify(e[n++]);
        } catch (c) {
          let a = c.message;
          if (a.includes("circular structure") || a.includes("cyclic structures") || a.includes("cyclic object"))
            return "[Circular]";
          throw c;
        }
      default:
        return s;
    }
  });
  for (let s = e[n]; n < t; s = e[++n])
    s === null || typeof s != "object" ? o += ` ${s}` : o += ` ${Te(s)}`;
  return o;
}
i(wn, "format");
function Te(e, t = {}) {
  return t.truncate === 0 && (t.truncate = Number.POSITIVE_INFINITY), ke(e, t);
}
i(Te, "inspect");
function Rn(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
i(Rn, "getDefaultExportFromCjs");

// ../node_modules/@vitest/utils/dist/helpers.js
function ns(e) {
  return e === Object.prototype || e === Function.prototype || e === RegExp.prototype;
}
i(ns, "isFinalObj");
function Be(e) {
  return Object.prototype.toString.apply(e).slice(8, -1);
}
i(Be, "getType");
function rs(e, t) {
  let n = typeof t == "function" ? t : (r) => t.add(r);
  Object.getOwnPropertyNames(e).forEach(n), Object.getOwnPropertySymbols(e).forEach(n);
}
i(rs, "collectOwnProperties");
function bt(e) {
  let t = /* @__PURE__ */ new Set();
  return ns(e) ? [] : (rs(e, t), Array.from(t));
}
i(bt, "getOwnProperties");
var An = { forceWritable: !1 };
function St(e, t = An) {
  return yt(e, /* @__PURE__ */ new WeakMap(), t);
}
i(St, "deepClone");
function yt(e, t, n = An) {
  let r, o;
  if (t.has(e))
    return t.get(e);
  if (Array.isArray(e)) {
    for (o = Array.from({ length: r = e.length }), t.set(e, o); r--; )
      o[r] = yt(e[r], t, n);
    return o;
  }
  if (Object.prototype.toString.call(e) === "[object Object]") {
    o = Object.create(Object.getPrototypeOf(e)), t.set(e, o);
    let s = bt(e);
    for (let c of s) {
      let a = Object.getOwnPropertyDescriptor(e, c);
      if (!a)
        continue;
      let u = yt(e[c], t, n);
      n.forceWritable ? Object.defineProperty(o, c, {
        enumerable: a.enumerable,
        configurable: !0,
        writable: !0,
        value: u
      }) : "get" in a ? Object.defineProperty(o, c, {
        ...a,
        get() {
          return u;
        }
      }) : Object.defineProperty(o, c, {
        ...a,
        value: u
      });
    }
    return o;
  }
  return e;
}
i(yt, "clone");

// ../node_modules/@vitest/utils/dist/diff.js
var z = -1, j = 1, M = 0, At = class At {
  0;
  1;
  constructor(t, n) {
    this[0] = t, this[1] = n;
  }
};
i(At, "Diff");
var P = At;
function os(e, t) {
  if (!e || !t || e.charAt(0) !== t.charAt(0))
    return 0;
  let n = 0, r = Math.min(e.length, t.length), o = r, s = 0;
  for (; n < o; )
    e.substring(s, o) === t.substring(s, o) ? (n = o, s = n) : r = o, o = Math.floor((r - n) / 2 + n);
  return o;
}
i(os, "diff_commonPrefix");
function Vn(e, t) {
  if (!e || !t || e.charAt(e.length - 1) !== t.charAt(t.length - 1))
    return 0;
  let n = 0, r = Math.min(e.length, t.length), o = r, s = 0;
  for (; n < o; )
    e.substring(e.length - o, e.length - s) === t.substring(t.length - o, t.length - s) ? (n = o, s = n) : r = o, o = Math.floor((r - n) / 2 +
    n);
  return o;
}
i(Vn, "diff_commonSuffix");
function Pn(e, t) {
  let n = e.length, r = t.length;
  if (n === 0 || r === 0)
    return 0;
  n > r ? e = e.substring(n - r) : n < r && (t = t.substring(0, n));
  let o = Math.min(n, r);
  if (e === t)
    return o;
  let s = 0, c = 1;
  for (; ; ) {
    let a = e.substring(o - c), u = t.indexOf(a);
    if (u === -1)
      return s;
    c += u, (u === 0 || e.substring(o - c) === t.substring(0, c)) && (s = c, c++);
  }
}
i(Pn, "diff_commonOverlap_");
function ss(e) {
  let t = !1, n = [], r = 0, o = null, s = 0, c = 0, a = 0, u = 0, m = 0;
  for (; s < e.length; )
    e[s][0] === M ? (n[r++] = s, c = u, a = m, u = 0, m = 0, o = e[s][1]) : (e[s][0] === j ? u += e[s][1].length : m += e[s][1].length, o &&
    o.length <= Math.max(c, a) && o.length <= Math.max(u, m) && (e.splice(n[r - 1], 0, new P(z, o)), e[n[r - 1] + 1][0] = j, r--, r--, s = r >
    0 ? n[r - 1] : -1, c = 0, a = 0, u = 0, m = 0, o = null, t = !0)), s++;
  for (t && qn(e), us(e), s = 1; s < e.length; ) {
    if (e[s - 1][0] === z && e[s][0] === j) {
      let p = e[s - 1][1], l = e[s][1], b = Pn(p, l), g = Pn(l, p);
      b >= g ? (b >= p.length / 2 || b >= l.length / 2) && (e.splice(s, 0, new P(M, l.substring(0, b))), e[s - 1][1] = p.substring(0, p.length -
      b), e[s + 1][1] = l.substring(b), s++) : (g >= p.length / 2 || g >= l.length / 2) && (e.splice(s, 0, new P(M, p.substring(0, g))), e[s -
      1][0] = j, e[s - 1][1] = l.substring(0, l.length - g), e[s + 1][0] = z, e[s + 1][1] = p.substring(g), s++), s++;
    }
    s++;
  }
}
i(ss, "diff_cleanupSemantic");
var Nn = /[^a-z0-9]/i, In = /\s/, Mn = /[\r\n]/, is = /\n\r?\n$/, cs = /^\r?\n\r?\n/;
function us(e) {
  let t = 1;
  for (; t < e.length - 1; ) {
    if (e[t - 1][0] === M && e[t + 1][0] === M) {
      let n = e[t - 1][1], r = e[t][1], o = e[t + 1][1], s = Vn(n, r);
      if (s) {
        let p = r.substring(r.length - s);
        n = n.substring(0, n.length - s), r = p + r.substring(0, r.length - s), o = p + o;
      }
      let c = n, a = r, u = o, m = ze(n, r) + ze(r, o);
      for (; r.charAt(0) === o.charAt(0); ) {
        n += r.charAt(0), r = r.substring(1) + o.charAt(0), o = o.substring(1);
        let p = ze(n, r) + ze(r, o);
        p >= m && (m = p, c = n, a = r, u = o);
      }
      e[t - 1][1] !== c && (c ? e[t - 1][1] = c : (e.splice(t - 1, 1), t--), e[t][1] = a, u ? e[t + 1][1] = u : (e.splice(t + 1, 1), t--));
    }
    t++;
  }
}
i(us, "diff_cleanupSemanticLossless");
function qn(e) {
  e.push(new P(M, ""));
  let t = 0, n = 0, r = 0, o = "", s = "", c;
  for (; t < e.length; )
    switch (e[t][0]) {
      case j:
        r++, s += e[t][1], t++;
        break;
      case z:
        n++, o += e[t][1], t++;
        break;
      case M:
        n + r > 1 ? (n !== 0 && r !== 0 && (c = os(s, o), c !== 0 && (t - n - r > 0 && e[t - n - r - 1][0] === M ? e[t - n - r - 1][1] += s.
        substring(0, c) : (e.splice(0, 0, new P(M, s.substring(0, c))), t++), s = s.substring(c), o = o.substring(c)), c = Vn(s, o), c !== 0 &&
        (e[t][1] = s.substring(s.length - c) + e[t][1], s = s.substring(0, s.length - c), o = o.substring(0, o.length - c))), t -= n + r, e.
        splice(t, n + r), o.length && (e.splice(t, 0, new P(z, o)), t++), s.length && (e.splice(t, 0, new P(j, s)), t++), t++) : t !== 0 && e[t -
        1][0] === M ? (e[t - 1][1] += e[t][1], e.splice(t, 1)) : t++, r = 0, n = 0, o = "", s = "";
        break;
    }
  e[e.length - 1][1] === "" && e.pop();
  let a = !1;
  for (t = 1; t < e.length - 1; )
    e[t - 1][0] === M && e[t + 1][0] === M && (e[t][1].substring(e[t][1].length - e[t - 1][1].length) === e[t - 1][1] ? (e[t][1] = e[t - 1][1] +
    e[t][1].substring(0, e[t][1].length - e[t - 1][1].length), e[t + 1][1] = e[t - 1][1] + e[t + 1][1], e.splice(t - 1, 1), a = !0) : e[t][1].
    substring(0, e[t + 1][1].length) === e[t + 1][1] && (e[t - 1][1] += e[t + 1][1], e[t][1] = e[t][1].substring(e[t + 1][1].length) + e[t +
    1][1], e.splice(t + 1, 1), a = !0)), t++;
  a && qn(e);
}
i(qn, "diff_cleanupMerge");
function ze(e, t) {
  if (!e || !t)
    return 6;
  let n = e.charAt(e.length - 1), r = t.charAt(0), o = n.match(Nn), s = r.match(Nn), c = o && n.match(In), a = s && r.match(In), u = c && n.
  match(Mn), m = a && r.match(Mn), p = u && e.match(is), l = m && t.match(cs);
  return p || l ? 5 : u || m ? 4 : o && !c && a ? 3 : c || a ? 2 : o || s ? 1 : 0;
}
i(ze, "diff_cleanupSemanticScore_");
var Kn = "Compared values have no visual difference.", as = "Compared values serialize to the same structure.\nPrinting internal object struc\
ture without calling `toJSON` instead.", Ye = {}, Ln;
function ls() {
  if (Ln) return Ye;
  Ln = 1, Object.defineProperty(Ye, "__esModule", {
    value: !0
  }), Ye.default = b;
  let e = "diff-sequences", t = 0, n = /* @__PURE__ */ i((g, h, f, d, S) => {
    let _ = 0;
    for (; g < h && f < d && S(g, f); )
      g += 1, f += 1, _ += 1;
    return _;
  }, "countCommonItemsF"), r = /* @__PURE__ */ i((g, h, f, d, S) => {
    let _ = 0;
    for (; g <= h && f <= d && S(h, d); )
      h -= 1, d -= 1, _ += 1;
    return _;
  }, "countCommonItemsR"), o = /* @__PURE__ */ i((g, h, f, d, S, _, O) => {
    let y = 0, E = -g, $ = _[y], T = $;
    _[y] += n(
      $ + 1,
      h,
      d + $ - E + 1,
      f,
      S
    );
    let R = g < O ? g : O;
    for (y += 1, E += 2; y <= R; y += 1, E += 2) {
      if (y !== g && T < _[y])
        $ = _[y];
      else if ($ = T + 1, h <= $)
        return y - 1;
      T = _[y], _[y] = $ + n($ + 1, h, d + $ - E + 1, f, S);
    }
    return O;
  }, "extendPathsF"), s = /* @__PURE__ */ i((g, h, f, d, S, _, O) => {
    let y = 0, E = g, $ = _[y], T = $;
    _[y] -= r(
      h,
      $ - 1,
      f,
      d + $ - E - 1,
      S
    );
    let R = g < O ? g : O;
    for (y += 1, E -= 2; y <= R; y += 1, E -= 2) {
      if (y !== g && _[y] < T)
        $ = _[y];
      else if ($ = T - 1, $ < h)
        return y - 1;
      T = _[y], _[y] = $ - r(
        h,
        $ - 1,
        f,
        d + $ - E - 1,
        S
      );
    }
    return O;
  }, "extendPathsR"), c = /* @__PURE__ */ i((g, h, f, d, S, _, O, y, E, $, T) => {
    let R = d - h, K = f - h, I = S - d - K, k = -I - (g - 1), G = -I + (g - 1), Y = t, N = g < y ? g : y;
    for (let L = 0, x = -g; L <= N; L += 1, x += 2) {
      let H = L === 0 || L !== g && Y < O[L], F = H ? O[L] : Y, W = H ? F : F + 1, re = R + W - x, V = n(
        W + 1,
        f,
        re + 1,
        S,
        _
      ), q = W + V;
      if (Y = O[L], O[L] = q, k <= x && x <= G) {
        let se = (g - 1 - (x + I)) / 2;
        if (se <= $ && E[se] - 1 <= q) {
          let J = R + F - (H ? x + 1 : x - 1), U = r(
            h,
            F,
            d,
            J,
            _
          ), oe = F - U, he = J - U, ue = oe + 1, be = he + 1;
          T.nChangePreceding = g - 1, g - 1 === ue + be - h - d ? (T.aEndPreceding = h, T.bEndPreceding = d) : (T.aEndPreceding = ue, T.bEndPreceding =
          be), T.nCommonPreceding = U, U !== 0 && (T.aCommonPreceding = ue, T.bCommonPreceding = be), T.nCommonFollowing = V, V !== 0 && (T.
          aCommonFollowing = W + 1, T.bCommonFollowing = re + 1);
          let Ce = q + 1, Oe = re + V + 1;
          return T.nChangeFollowing = g - 1, g - 1 === f + S - Ce - Oe ? (T.aStartFollowing = f, T.bStartFollowing = S) : (T.aStartFollowing =
          Ce, T.bStartFollowing = Oe), !0;
        }
      }
    }
    return !1;
  }, "extendOverlappablePathsF"), a = /* @__PURE__ */ i((g, h, f, d, S, _, O, y, E, $, T) => {
    let R = S - f, K = f - h, I = S - d - K, k = I - g, G = I + g, Y = t, N = g < $ ? g : $;
    for (let L = 0, x = g; L <= N; L += 1, x -= 2) {
      let H = L === 0 || L !== g && E[L] < Y, F = H ? E[L] : Y, W = H ? F : F - 1, re = R + W - x, V = r(
        h,
        W - 1,
        d,
        re - 1,
        _
      ), q = W - V;
      if (Y = E[L], E[L] = q, k <= x && x <= G) {
        let se = (g + (x - I)) / 2;
        if (se <= y && q - 1 <= O[se]) {
          let J = re - V;
          if (T.nChangePreceding = g, g === q + J - h - d ? (T.aEndPreceding = h, T.bEndPreceding = d) : (T.aEndPreceding = q, T.bEndPreceding =
          J), T.nCommonPreceding = V, V !== 0 && (T.aCommonPreceding = q, T.bCommonPreceding = J), T.nChangeFollowing = g - 1, g === 1)
            T.nCommonFollowing = 0, T.aStartFollowing = f, T.bStartFollowing = S;
          else {
            let U = R + F - (H ? x - 1 : x + 1), oe = n(
              F,
              f,
              U,
              S,
              _
            );
            T.nCommonFollowing = oe, oe !== 0 && (T.aCommonFollowing = F, T.bCommonFollowing = U);
            let he = F + oe, ue = U + oe;
            g - 1 === f + S - he - ue ? (T.aStartFollowing = f, T.bStartFollowing = S) : (T.aStartFollowing = he, T.bStartFollowing = ue);
          }
          return !0;
        }
      }
    }
    return !1;
  }, "extendOverlappablePathsR"), u = /* @__PURE__ */ i((g, h, f, d, S, _, O, y, E) => {
    let $ = d - h, T = S - f, R = f - h, K = S - d, Q = K - R, I = R, k = R;
    if (O[0] = h - 1, y[0] = f, Q % 2 === 0) {
      let G = (g || Q) / 2, Y = (R + K) / 2;
      for (let N = 1; N <= Y; N += 1)
        if (I = o(N, f, S, $, _, O, I), N < G)
          k = s(N, h, d, T, _, y, k);
        else if (
          // If a reverse path overlaps a forward path in the same diagonal,
          // return a division of the index intervals at the middle change.
          a(
            N,
            h,
            f,
            d,
            S,
            _,
            O,
            I,
            y,
            k,
            E
          )
        )
          return;
    } else {
      let G = ((g || Q) + 1) / 2, Y = (R + K + 1) / 2, N = 1;
      for (I = o(N, f, S, $, _, O, I), N += 1; N <= Y; N += 1)
        if (k = s(
          N - 1,
          h,
          d,
          T,
          _,
          y,
          k
        ), N < G)
          I = o(N, f, S, $, _, O, I);
        else if (
          // If a forward path overlaps a reverse path in the same diagonal,
          // return a division of the index intervals at the middle change.
          c(
            N,
            h,
            f,
            d,
            S,
            _,
            O,
            I,
            y,
            k,
            E
          )
        )
          return;
    }
    throw new Error(
      `${e}: no overlap aStart=${h} aEnd=${f} bStart=${d} bEnd=${S}`
    );
  }, "divide"), m = /* @__PURE__ */ i((g, h, f, d, S, _, O, y, E, $) => {
    if (S - d < f - h) {
      if (_ = !_, _ && O.length === 1) {
        let { foundSubsequence: q, isCommon: se } = O[0];
        O[1] = {
          foundSubsequence: /* @__PURE__ */ i((J, U, oe) => {
            q(J, oe, U);
          }, "foundSubsequence"),
          isCommon: /* @__PURE__ */ i((J, U) => se(U, J), "isCommon")
        };
      }
      let re = h, V = f;
      h = d, f = S, d = re, S = V;
    }
    let { foundSubsequence: T, isCommon: R } = O[_ ? 1 : 0];
    u(
      g,
      h,
      f,
      d,
      S,
      R,
      y,
      E,
      $
    );
    let {
      nChangePreceding: K,
      aEndPreceding: Q,
      bEndPreceding: I,
      nCommonPreceding: k,
      aCommonPreceding: G,
      bCommonPreceding: Y,
      nCommonFollowing: N,
      aCommonFollowing: L,
      bCommonFollowing: x,
      nChangeFollowing: H,
      aStartFollowing: F,
      bStartFollowing: W
    } = $;
    h < Q && d < I && m(
      K,
      h,
      Q,
      d,
      I,
      _,
      O,
      y,
      E,
      $
    ), k !== 0 && T(k, G, Y), N !== 0 && T(N, L, x), F < f && W < S && m(
      H,
      F,
      f,
      W,
      S,
      _,
      O,
      y,
      E,
      $
    );
  }, "findSubsequences"), p = /* @__PURE__ */ i((g, h) => {
    if (typeof h != "number")
      throw new TypeError(`${e}: ${g} typeof ${typeof h} is not a number`);
    if (!Number.isSafeInteger(h))
      throw new RangeError(`${e}: ${g} value ${h} is not a safe integer`);
    if (h < 0)
      throw new RangeError(`${e}: ${g} value ${h} is a negative integer`);
  }, "validateLength"), l = /* @__PURE__ */ i((g, h) => {
    let f = typeof h;
    if (f !== "function")
      throw new TypeError(`${e}: ${g} typeof ${f} is not a function`);
  }, "validateCallback");
  function b(g, h, f, d) {
    p("aLength", g), p("bLength", h), l("isCommon", f), l("foundSubsequence", d);
    let S = n(0, g, 0, h, f);
    if (S !== 0 && d(S, 0, 0), g !== S || h !== S) {
      let _ = S, O = S, y = r(
        _,
        g - 1,
        O,
        h - 1,
        f
      ), E = g - y, $ = h - y, T = S + y;
      g !== T && h !== T && m(
        0,
        _,
        E,
        O,
        $,
        !1,
        [
          {
            foundSubsequence: d,
            isCommon: f
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
      ), y !== 0 && d(y, E, $);
    }
  }
  return i(b, "diffSequence"), Ye;
}
i(ls, "requireBuild");
var fs = ls(), Gn = /* @__PURE__ */ Rn(fs);
function ms(e, t) {
  return e.replace(/\s+$/, (n) => t(n));
}
i(ms, "formatTrailingSpaces");
function wt(e, t, n, r, o, s) {
  return e.length !== 0 ? n(`${r} ${ms(e, o)}`) : r !== " " ? n(r) : t && s.length !== 0 ? n(`${r} ${s}`) : "";
}
i(wt, "printDiffLine");
function Hn(e, t, { aColor: n, aIndicator: r, changeLineTrailingSpaceColor: o, emptyFirstOrLastLinePlaceholder: s }) {
  return wt(e, t, n, r, o, s);
}
i(Hn, "printDeleteLine");
function Jn(e, t, { bColor: n, bIndicator: r, changeLineTrailingSpaceColor: o, emptyFirstOrLastLinePlaceholder: s }) {
  return wt(e, t, n, r, o, s);
}
i(Jn, "printInsertLine");
function Xn(e, t, { commonColor: n, commonIndicator: r, commonLineTrailingSpaceColor: o, emptyFirstOrLastLinePlaceholder: s }) {
  return wt(e, t, n, r, o, s);
}
i(Xn, "printCommonLine");
function xn(e, t, n, r, { patchColor: o }) {
  return o(`@@ -${e + 1},${t - e} +${n + 1},${r - n} @@`);
}
i(xn, "createPatchMark");
function ps(e, t) {
  let n = e.length, r = t.contextLines, o = r + r, s = n, c = !1, a = 0, u = 0;
  for (; u !== n; ) {
    let y = u;
    for (; u !== n && e[u][0] === M; )
      u += 1;
    if (y !== u)
      if (y === 0)
        u > r && (s -= u - r, c = !0);
      else if (u === n) {
        let E = u - y;
        E > r && (s -= E - r, c = !0);
      } else {
        let E = u - y;
        E > o && (s -= E - o, a += 1);
      }
    for (; u !== n && e[u][0] !== M; )
      u += 1;
  }
  let m = a !== 0 || c;
  a !== 0 ? s += a + 1 : c && (s += 1);
  let p = s - 1, l = [], b = 0;
  m && l.push("");
  let g = 0, h = 0, f = 0, d = 0, S = /* @__PURE__ */ i((y) => {
    let E = l.length;
    l.push(Xn(y, E === 0 || E === p, t)), f += 1, d += 1;
  }, "pushCommonLine"), _ = /* @__PURE__ */ i((y) => {
    let E = l.length;
    l.push(Hn(y, E === 0 || E === p, t)), f += 1;
  }, "pushDeleteLine"), O = /* @__PURE__ */ i((y) => {
    let E = l.length;
    l.push(Jn(y, E === 0 || E === p, t)), d += 1;
  }, "pushInsertLine");
  for (u = 0; u !== n; ) {
    let y = u;
    for (; u !== n && e[u][0] === M; )
      u += 1;
    if (y !== u)
      if (y === 0) {
        u > r && (y = u - r, g = y, h = y, f = g, d = h);
        for (let E = y; E !== u; E += 1)
          S(e[E][1]);
      } else if (u === n) {
        let E = u - y > r ? y + r : u;
        for (let $ = y; $ !== E; $ += 1)
          S(e[$][1]);
      } else {
        let E = u - y;
        if (E > o) {
          let $ = y + r;
          for (let R = y; R !== $; R += 1)
            S(e[R][1]);
          l[b] = xn(g, f, h, d, t), b = l.length, l.push("");
          let T = E - o;
          g = f + T, h = d + T, f = g, d = h;
          for (let R = u - r; R !== u; R += 1)
            S(e[R][1]);
        } else
          for (let $ = y; $ !== u; $ += 1)
            S(e[$][1]);
      }
    for (; u !== n && e[u][0] === z; )
      _(e[u][1]), u += 1;
    for (; u !== n && e[u][0] === j; )
      O(e[u][1]), u += 1;
  }
  return m && (l[b] = xn(g, f, h, d, t)), l.join(`
`);
}
i(ps, "joinAlignedDiffsNoExpand");
function gs(e, t) {
  return e.map((n, r, o) => {
    let s = n[1], c = r === 0 || r === o.length - 1;
    switch (n[0]) {
      case z:
        return Hn(s, c, t);
      case j:
        return Jn(s, c, t);
      default:
        return Xn(s, c, t);
    }
  }).join(`
`);
}
i(gs, "joinAlignedDiffsExpand");
var Et = /* @__PURE__ */ i((e) => e, "noColor"), Zn = 5, hs = 0;
function ds() {
  return {
    aAnnotation: "Expected",
    aColor: v.green,
    aIndicator: "-",
    bAnnotation: "Received",
    bColor: v.red,
    bIndicator: "+",
    changeColor: v.inverse,
    changeLineTrailingSpaceColor: Et,
    commonColor: v.dim,
    commonIndicator: " ",
    commonLineTrailingSpaceColor: Et,
    compareKeys: void 0,
    contextLines: Zn,
    emptyFirstOrLastLinePlaceholder: "",
    expand: !1,
    includeChangeCounts: !1,
    omitAnnotationLines: !1,
    patchColor: v.yellow,
    printBasicPrototype: !1,
    truncateThreshold: hs,
    truncateAnnotation: "... Diff result is truncated",
    truncateAnnotationColor: Et
  };
}
i(ds, "getDefaultOptions");
function ys(e) {
  return e && typeof e == "function" ? e : void 0;
}
i(ys, "getCompareKeys");
function bs(e) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= 0 ? e : Zn;
}
i(bs, "getContextLines");
function ge(e = {}) {
  return {
    ...ds(),
    ...e,
    compareKeys: ys(e.compareKeys),
    contextLines: bs(e.contextLines)
  };
}
i(ge, "normalizeDiffOptions");
function ye(e) {
  return e.length === 1 && e[0].length === 0;
}
i(ye, "isEmptyString");
function Ss(e) {
  let t = 0, n = 0;
  return e.forEach((r) => {
    switch (r[0]) {
      case z:
        t += 1;
        break;
      case j:
        n += 1;
        break;
    }
  }), {
    a: t,
    b: n
  };
}
i(Ss, "countChanges");
function Es({ aAnnotation: e, aColor: t, aIndicator: n, bAnnotation: r, bColor: o, bIndicator: s, includeChangeCounts: c, omitAnnotationLines: a }, u) {
  if (a)
    return "";
  let m = "", p = "";
  if (c) {
    let g = String(u.a), h = String(u.b), f = r.length - e.length, d = " ".repeat(Math.max(0, f)), S = " ".repeat(Math.max(0, -f)), _ = h.length -
    g.length, O = " ".repeat(Math.max(0, _)), y = " ".repeat(Math.max(0, -_));
    m = `${d}  ${n} ${O}${g}`, p = `${S}  ${s} ${y}${h}`;
  }
  let l = `${n} ${e}${m}`, b = `${s} ${r}${p}`;
  return `${t(l)}
${o(b)}

`;
}
i(Es, "printAnnotation");
function Rt(e, t, n) {
  return Es(n, Ss(e)) + (n.expand ? gs(e, n) : ps(e, n)) + (t ? n.truncateAnnotationColor(`
${n.truncateAnnotation}`) : "");
}
i(Rt, "printDiffLines");
function We(e, t, n) {
  let r = ge(n), [o, s] = Qn(ye(e) ? [] : e, ye(t) ? [] : t, r);
  return Rt(o, s, r);
}
i(We, "diffLinesUnified");
function _s(e, t, n, r, o) {
  if (ye(e) && ye(n) && (e = [], n = []), ye(t) && ye(r) && (t = [], r = []), e.length !== n.length || t.length !== r.length)
    return We(e, t, o);
  let [s, c] = Qn(n, r, o), a = 0, u = 0;
  return s.forEach((m) => {
    switch (m[0]) {
      case z:
        m[1] = e[a], a += 1;
        break;
      case j:
        m[1] = t[u], u += 1;
        break;
      default:
        m[1] = t[u], a += 1, u += 1;
    }
  }), Rt(s, c, ge(o));
}
i(_s, "diffLinesUnified2");
function Qn(e, t, n) {
  let r = n?.truncateThreshold ?? !1, o = Math.max(Math.floor(n?.truncateThreshold ?? 0), 0), s = r ? Math.min(e.length, o) : e.length, c = r ?
  Math.min(t.length, o) : t.length, a = s !== e.length || c !== t.length, u = /* @__PURE__ */ i((g, h) => e[g] === t[h], "isCommon"), m = [],
  p = 0, l = 0;
  for (Gn(s, c, u, /* @__PURE__ */ i((g, h, f) => {
    for (; p !== h; p += 1)
      m.push(new P(z, e[p]));
    for (; l !== f; l += 1)
      m.push(new P(j, t[l]));
    for (; g !== 0; g -= 1, p += 1, l += 1)
      m.push(new P(M, t[l]));
  }, "foundSubsequence")); p !== s; p += 1)
    m.push(new P(z, e[p]));
  for (; l !== c; l += 1)
    m.push(new P(j, t[l]));
  return [m, a];
}
i(Qn, "diffLinesRaw");
function Dn(e) {
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
i(Dn, "getType");
function Fn(e) {
  return e.includes(`\r
`) ? `\r
` : `
`;
}
i(Fn, "getNewLineSymbol");
function Ts(e, t, n) {
  let r = n?.truncateThreshold ?? !1, o = Math.max(Math.floor(n?.truncateThreshold ?? 0), 0), s = e.length, c = t.length;
  if (r) {
    let g = e.includes(`
`), h = t.includes(`
`), f = Fn(e), d = Fn(t), S = g ? `${e.split(f, o).join(f)}
` : e, _ = h ? `${t.split(d, o).join(d)}
` : t;
    s = S.length, c = _.length;
  }
  let a = s !== e.length || c !== t.length, u = /* @__PURE__ */ i((g, h) => e[g] === t[h], "isCommon"), m = 0, p = 0, l = [];
  return Gn(s, c, u, /* @__PURE__ */ i((g, h, f) => {
    m !== h && l.push(new P(z, e.slice(m, h))), p !== f && l.push(new P(j, t.slice(p, f))), m = h + g, p = f + g, l.push(new P(M, t.slice(f,
    p)));
  }, "foundSubsequence")), m !== s && l.push(new P(z, e.slice(m))), p !== c && l.push(new P(j, t.slice(p))), [l, a];
}
i(Ts, "diffStrings");
function Cs(e, t, n) {
  return t.reduce((r, o) => r + (o[0] === M ? o[1] : o[0] === e && o[1].length !== 0 ? n(o[1]) : ""), "");
}
i(Cs, "concatenateRelevantDiffs");
var Pt = class Pt {
  op;
  line;
  lines;
  changeColor;
  constructor(t, n) {
    this.op = t, this.line = [], this.lines = [], this.changeColor = n;
  }
  pushSubstring(t) {
    this.pushDiff(new P(this.op, t));
  }
  pushLine() {
    this.lines.push(this.line.length !== 1 ? new P(this.op, Cs(this.op, this.line, this.changeColor)) : this.line[0][0] === this.op ? this.line[0] :
    new P(this.op, this.line[0][1])), this.line.length = 0;
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
      r.forEach((s, c) => {
        c < o ? (this.pushSubstring(s), this.pushLine()) : s.length !== 0 && this.pushSubstring(s);
      });
    } else
      this.pushDiff(t);
  }
  // Output from buffer.
  moveLinesTo(t) {
    this.isLineEmpty() || this.pushLine(), t.push(...this.lines), this.lines.length = 0;
  }
};
i(Pt, "ChangeBuffer");
var Ue = Pt, Nt = class Nt {
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
      o.forEach((c, a) => {
        if (a === 0) {
          let u = new P(n, c);
          this.deleteBuffer.isLineEmpty() && this.insertBuffer.isLineEmpty() ? (this.flushChangeLines(), this.pushDiffCommonLine(u)) : (this.
          pushDiffChangeLines(u), this.flushChangeLines());
        } else a < s ? this.pushDiffCommonLine(new P(n, c)) : c.length !== 0 && this.pushDiffChangeLines(new P(n, c));
      });
    } else
      this.pushDiffChangeLines(t);
  }
  // Output from buffer.
  getLines() {
    return this.flushChangeLines(), this.lines;
  }
};
i(Nt, "CommonBuffer");
var Tt = Nt;
function Os(e, t) {
  let n = new Ue(z, t), r = new Ue(j, t), o = new Tt(n, r);
  return e.forEach((s) => {
    switch (s[0]) {
      case z:
        n.align(s);
        break;
      case j:
        r.align(s);
        break;
      default:
        o.align(s);
    }
  }), o.getLines();
}
i(Os, "getAlignedDiffs");
function $s(e, t) {
  if (t) {
    let n = e.length - 1;
    return e.some((r, o) => r[0] === M && (o !== n || r[1] !== `
`));
  }
  return e.some((n) => n[0] === M);
}
i($s, "hasCommonDiff");
function ws(e, t, n) {
  if (e !== t && e.length !== 0 && t.length !== 0) {
    let r = e.includes(`
`) || t.includes(`
`), [o, s] = vn(r ? `${e}
` : e, r ? `${t}
` : t, !0, n);
    if ($s(o, r)) {
      let c = ge(n), a = Os(o, c.changeColor);
      return Rt(a, s, c);
    }
  }
  return We(e.split(`
`), t.split(`
`), n);
}
i(ws, "diffStringsUnified");
function vn(e, t, n, r) {
  let [o, s] = Ts(e, t, r);
  return n && ss(o), [o, s];
}
i(vn, "diffStringsRaw");
function Ct(e, t) {
  let { commonColor: n } = ge(t);
  return n(e);
}
i(Ct, "getCommonMessage");
var { AsymmetricMatcher: Rs, DOMCollection: As, DOMElement: Ps, Immutable: Ns, ReactElement: Is, ReactTestComponent: Ms } = _e, er = [
  Ms,
  Is,
  Ps,
  As,
  Ns,
  Rs,
  _e.Error
], Ot = {
  maxDepth: 20,
  plugins: er
}, tr = {
  callToJSON: !1,
  maxDepth: 8,
  plugins: er
};
function Ls(e, t, n) {
  if (Object.is(e, t))
    return "";
  let r = Dn(e), o = r, s = !1;
  if (r === "object" && typeof e.asymmetricMatch == "function") {
    if (e.$$typeof !== Symbol.for("jest.asymmetricMatcher") || typeof e.getExpectedType != "function")
      return;
    o = e.getExpectedType(), s = o === "string";
  }
  if (o !== Dn(t)) {
    let d = function(O) {
      return O.length <= f ? O : `${O.slice(0, f)}...`;
    };
    i(d, "truncate");
    let { aAnnotation: c, aColor: a, aIndicator: u, bAnnotation: m, bColor: p, bIndicator: l } = ge(n), b = $t(tr, n), g = X(e, b), h = X(t,
    b), f = 1e5;
    g = d(g), h = d(h);
    let S = `${a(`${u} ${c}:`)} 
${g}`, _ = `${p(`${l} ${m}:`)} 
${h}`;
    return `${S}

${_}`;
  }
  if (!s)
    switch (r) {
      case "string":
        return We(e.split(`
`), t.split(`
`), n);
      case "boolean":
      case "number":
        return xs(e, t, n);
      case "map":
        return _t(jn(e), jn(t), n);
      case "set":
        return _t(kn(e), kn(t), n);
      default:
        return _t(e, t, n);
    }
}
i(Ls, "diff");
function xs(e, t, n) {
  let r = X(e, Ot), o = X(t, Ot);
  return r === o ? "" : We(r.split(`
`), o.split(`
`), n);
}
i(xs, "comparePrimitive");
function jn(e) {
  return new Map(Array.from(e.entries()).sort());
}
i(jn, "sortMap");
function kn(e) {
  return new Set(Array.from(e.values()).sort());
}
i(kn, "sortSet");
function _t(e, t, n) {
  let r, o = !1;
  try {
    let c = $t(Ot, n);
    r = Bn(e, t, c, n);
  } catch {
    o = !0;
  }
  let s = Ct(Kn, n);
  if (r === void 0 || r === s) {
    let c = $t(tr, n);
    r = Bn(e, t, c, n), r !== s && !o && (r = `${Ct(as, n)}

${r}`);
  }
  return r;
}
i(_t, "compareObjects");
function $t(e, t) {
  let { compareKeys: n, printBasicPrototype: r, maxDepth: o } = ge(t);
  return {
    ...e,
    compareKeys: n,
    printBasicPrototype: r,
    maxDepth: o ?? e.maxDepth
  };
}
i($t, "getFormatOptions");
function Bn(e, t, n, r) {
  let o = {
    ...n,
    indent: 0
  }, s = X(e, o), c = X(t, o);
  if (s === c)
    return Ct(Kn, r);
  {
    let a = X(e, n), u = X(t, n);
    return _s(a.split(`
`), u.split(`
`), s.split(`
`), c.split(`
`), r);
  }
}
i(Bn, "getObjectsDifference");
var zn = 2e4;
function Yn(e) {
  return Be(e) === "Object" && typeof e.asymmetricMatch == "function";
}
i(Yn, "isAsymmetricMatcher");
function Un(e, t) {
  let n = Be(e), r = Be(t);
  return n === r && (n === "Object" || n === "Array");
}
i(Un, "isReplaceable");
function nr(e, t, n) {
  let { aAnnotation: r, bAnnotation: o } = ge(n);
  if (typeof t == "string" && typeof e == "string" && t.length > 0 && e.length > 0 && t.length <= zn && e.length <= zn && t !== e) {
    if (t.includes(`
`) || e.includes(`
`))
      return ws(t, e, n);
    let [p] = vn(t, e, !0), l = p.some((f) => f[0] === M), b = Ds(r, o), g = b(r) + ks(Wn(p, z, l)), h = b(o) + js(Wn(p, j, l));
    return `${g}
${h}`;
  }
  let s = St(t, { forceWritable: !0 }), c = St(e, { forceWritable: !0 }), { replacedExpected: a, replacedActual: u } = rr(c, s);
  return Ls(a, u, n);
}
i(nr, "printDiffOrStringify");
function rr(e, t, n = /* @__PURE__ */ new WeakSet(), r = /* @__PURE__ */ new WeakSet()) {
  return e instanceof Error && t instanceof Error && typeof e.cause < "u" && typeof t.cause > "u" ? (delete e.cause, {
    replacedActual: e,
    replacedExpected: t
  }) : Un(e, t) ? n.has(e) || r.has(t) ? {
    replacedActual: e,
    replacedExpected: t
  } : (n.add(e), r.add(t), bt(t).forEach((o) => {
    let s = t[o], c = e[o];
    if (Yn(s))
      s.asymmetricMatch(c) && (e[o] = s);
    else if (Yn(c))
      c.asymmetricMatch(s) && (t[o] = c);
    else if (Un(c, s)) {
      let a = rr(c, s, n, r);
      e[o] = a.replacedActual, t[o] = a.replacedExpected;
    }
  }), {
    replacedActual: e,
    replacedExpected: t
  }) : {
    replacedActual: e,
    replacedExpected: t
  };
}
i(rr, "replaceAsymmetricMatcher");
function Ds(...e) {
  let t = e.reduce((n, r) => r.length > n ? r.length : n, 0);
  return (n) => `${n}: ${" ".repeat(t - n.length)}`;
}
i(Ds, "getLabelPrinter");
var Fs = "\xB7";
function or(e) {
  return e.replace(/\s+$/gm, (t) => Fs.repeat(t.length));
}
i(or, "replaceTrailingSpaces");
function js(e) {
  return v.red(or(pe(e)));
}
i(js, "printReceived");
function ks(e) {
  return v.green(or(pe(e)));
}
i(ks, "printExpected");
function Wn(e, t, n) {
  return e.reduce((r, o) => r + (o[0] === M ? o[1] : o[0] === t ? n ? v.inverse(o[1]) : o[1] : ""), "");
}
i(Wn, "getCommonAndChangedSubstrings");

// ../node_modules/@vitest/utils/dist/error.js
var Bs = "@@__IMMUTABLE_RECORD__@@", zs = "@@__IMMUTABLE_ITERABLE__@@";
function Ys(e) {
  return e && (e[zs] || e[Bs]);
}
i(Ys, "isImmutable");
var Us = Object.getPrototypeOf({});
function sr(e) {
  return e instanceof Error ? `<unserializable>: ${e.message}` : typeof e == "string" ? `<unserializable>: ${e}` : "<unserializable>";
}
i(sr, "getUnserializableMessage");
function le(e, t = /* @__PURE__ */ new WeakMap()) {
  if (!e || typeof e == "string")
    return e;
  if (e instanceof Error && "toJSON" in e && typeof e.toJSON == "function") {
    let n = e.toJSON();
    return n && n !== e && typeof n == "object" && (typeof e.message == "string" && Ve(() => n.message ?? (n.message = e.message)), typeof e.
    stack == "string" && Ve(() => n.stack ?? (n.stack = e.stack)), typeof e.name == "string" && Ve(() => n.name ?? (n.name = e.name)), e.cause !=
    null && Ve(() => n.cause ?? (n.cause = le(e.cause, t)))), le(n, t);
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
  if (Ys(e))
    return le(e.toJSON(), t);
  if (e instanceof Promise || e.constructor && e.constructor.prototype === "AsyncFunction")
    return "Promise";
  if (typeof Element < "u" && e instanceof Element)
    return e.tagName;
  if (typeof e.asymmetricMatch == "function")
    return `${e.toString()} ${wn(e.sample)}`;
  if (typeof e.toJSON == "function")
    return le(e.toJSON(), t);
  if (t.has(e))
    return t.get(e);
  if (Array.isArray(e)) {
    let n = new Array(e.length);
    return t.set(e, n), e.forEach((r, o) => {
      try {
        n[o] = le(r, t);
      } catch (s) {
        n[o] = sr(s);
      }
    }), n;
  } else {
    let n = /* @__PURE__ */ Object.create(null);
    t.set(e, n);
    let r = e;
    for (; r && r !== Us; )
      Object.getOwnPropertyNames(r).forEach((o) => {
        if (!(o in n))
          try {
            n[o] = le(e[o], t);
          } catch (s) {
            delete n[o], n[o] = sr(s);
          }
      }), r = Object.getPrototypeOf(r);
    return n;
  }
}
i(le, "serializeValue");
function Ve(e) {
  try {
    return e();
  } catch {
  }
}
i(Ve, "safe");
function Ws(e) {
  return e.replace(/__(vite_ssr_import|vi_import)_\d+__\./g, "");
}
i(Ws, "normalizeErrorMessage");
function It(e, t, n = /* @__PURE__ */ new WeakSet()) {
  if (!e || typeof e != "object")
    return { message: String(e) };
  let r = e;
  (r.showDiff || r.showDiff === void 0 && r.expected !== void 0 && r.actual !== void 0) && (r.diff = nr(r.actual, r.expected, {
    ...t,
    ...r.diffOptions
  })), "expected" in r && typeof r.expected != "string" && (r.expected = pe(r.expected, 10)), "actual" in r && typeof r.actual != "string" &&
  (r.actual = pe(r.actual, 10));
  try {
    typeof r.message == "string" && (r.message = Ws(r.message));
  } catch {
  }
  try {
    !n.has(r) && typeof r.cause == "object" && (n.add(r), r.cause = It(r.cause, t, n));
  } catch {
  }
  try {
    return le(r);
  } catch (o) {
    return le(new Error(`Failed to fully serialize error: ${o?.message}
Inner error message: ${r?.message}`));
  }
}
i(It, "processError");

// src/instrumenter/EVENTS.ts
var ne = {
  CALL: "storybook/instrumenter/call",
  SYNC: "storybook/instrumenter/sync",
  START: "storybook/instrumenter/start",
  BACK: "storybook/instrumenter/back",
  GOTO: "storybook/instrumenter/goto",
  NEXT: "storybook/instrumenter/next",
  END: "storybook/instrumenter/end"
};

// src/instrumenter/preview-api.ts
var qe = globalThis.__STORYBOOK_ADDONS_PREVIEW;

// src/instrumenter/types.ts
var Vs = /* @__PURE__ */ ((o) => (o.DONE = "done", o.ERROR = "error", o.ACTIVE = "active", o.WAITING = "waiting", o))(Vs || {});

// src/instrumenter/instrumenter.ts
var Hs = new Error(
  "This function ran after the play function completed. Did you forget to `await` it?"
), cr = /* @__PURE__ */ i((e) => Object.prototype.toString.call(e) === "[object Object]", "isObject"), Js = /* @__PURE__ */ i((e) => Object.
prototype.toString.call(e) === "[object Module]", "isModule"), Xs = /* @__PURE__ */ i((e) => {
  if (!cr(e) && !Js(e))
    return !1;
  if (e.constructor === void 0)
    return !0;
  let t = e.constructor.prototype;
  return !!cr(t);
}, "isInstrumentable"), Zs = /* @__PURE__ */ i((e) => {
  try {
    return new e.constructor();
  } catch {
    return {};
  }
}, "construct"), Mt = /* @__PURE__ */ i(() => ({
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
}), "getInitialState"), ur = /* @__PURE__ */ i((e, t = !1) => {
  let n = (t ? e.shadowCalls : e.calls).filter((o) => o.retain);
  if (!n.length)
    return;
  let r = new Map(
    Array.from(e.callRefsByResult.entries()).filter(([, o]) => o.retain)
  );
  return { cursor: n.length, calls: n, callRefsByResult: r };
}, "getRetainedState"), xt = class xt {
  constructor() {
    this.detached = !1;
    this.initialized = !1;
    // State is tracked per story to deal with multiple stories on the same canvas (i.e. docs mode)
    this.state = {};
    this.loadParentWindowState = /* @__PURE__ */ i(() => {
      try {
        this.state = Z.window?.parent?.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__ || {};
      } catch {
        this.detached = !0;
      }
    }, "loadParentWindowState");
    this.updateParentWindowState = /* @__PURE__ */ i(() => {
      try {
        Z.window.parent.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__ = this.state;
      } catch {
        this.detached = !0;
      }
    }, "updateParentWindowState");
    this.loadParentWindowState();
    let t = /* @__PURE__ */ i(({
      storyId: u,
      renderPhase: m,
      isPlaying: p = !0,
      isDebugging: l = !1
    }) => {
      let b = this.getState(u);
      this.setState(u, {
        ...Mt(),
        ...ur(b, l),
        renderPhase: m || b.renderPhase,
        shadowCalls: l ? b.shadowCalls : [],
        chainedCallIds: l ? b.chainedCallIds : /* @__PURE__ */ new Set(),
        playUntil: l ? b.playUntil : void 0,
        isPlaying: p,
        isDebugging: l
      }), this.sync(u);
    }, "resetState"), n = /* @__PURE__ */ i((u) => ({ storyId: m, playUntil: p }) => {
      this.getState(m).isDebugging || this.setState(m, ({ calls: b }) => ({
        calls: [],
        shadowCalls: b.map((g) => ({ ...g, status: "waiting" })),
        isDebugging: !0
      }));
      let l = this.getLog(m);
      this.setState(m, ({ shadowCalls: b }) => {
        if (p || !l.length)
          return { playUntil: p };
        let g = b.findIndex((h) => h.id === l[0].callId);
        return {
          playUntil: b.slice(0, g).filter((h) => h.interceptable && !h.ancestors?.length).slice(-1)[0]?.id
        };
      }), u.emit(ir, { storyId: m, isDebugging: !0 });
    }, "start"), r = /* @__PURE__ */ i((u) => ({ storyId: m }) => {
      let p = this.getLog(m).filter((b) => !b.ancestors?.length), l = p.reduceRight((b, g, h) => b >= 0 || g.status === "waiting" ? b : h, -1);
      n(u)({ storyId: m, playUntil: p[l - 1]?.callId });
    }, "back"), o = /* @__PURE__ */ i((u) => ({ storyId: m, callId: p }) => {
      let { calls: l, shadowCalls: b, resolvers: g } = this.getState(m), h = l.find(({ id: d }) => d === p), f = b.find(({ id: d }) => d ===
      p);
      if (!h && f && Object.values(g).length > 0) {
        let d = this.getLog(m).find((S) => S.status === "waiting")?.callId;
        f.id !== d && this.setState(m, { playUntil: f.id }), Object.values(g).forEach((S) => S());
      } else
        n(u)({ storyId: m, playUntil: p });
    }, "goto"), s = /* @__PURE__ */ i((u) => ({ storyId: m }) => {
      let { resolvers: p } = this.getState(m);
      if (Object.values(p).length > 0)
        Object.values(p).forEach((l) => l());
      else {
        let l = this.getLog(m).find((b) => b.status === "waiting")?.callId;
        l ? n(u)({ storyId: m, playUntil: l }) : c({ storyId: m });
      }
    }, "next"), c = /* @__PURE__ */ i(({ storyId: u }) => {
      this.setState(u, { playUntil: void 0, isDebugging: !1 }), Object.values(this.getState(u).resolvers).forEach((m) => m());
    }, "end"), a = /* @__PURE__ */ i(({
      storyId: u,
      newPhase: m
    }) => {
      let { isDebugging: p } = this.getState(u);
      if (m === "preparing" && p)
        return t({ storyId: u, renderPhase: m });
      if (m === "playing")
        return t({ storyId: u, renderPhase: m, isDebugging: p });
      m === "played" ? this.setState(u, {
        renderPhase: m,
        isLocked: !1,
        isPlaying: !1,
        isDebugging: !1
      }) : m === "errored" ? this.setState(u, {
        renderPhase: m,
        isLocked: !1,
        isPlaying: !1
      }) : m === "aborted" ? this.setState(u, {
        renderPhase: m,
        isLocked: !0,
        isPlaying: !1
      }) : this.setState(u, {
        renderPhase: m
      }), this.sync(u);
    }, "renderPhaseChanged");
    qe && qe.ready().then(() => {
      this.channel = qe.getChannel(), this.channel.on(ir, t), this.channel.on(Gs, a), this.channel.on(Ks, () => {
        this.initialized ? this.cleanup() : this.initialized = !0;
      }), this.channel.on(ne.START, n(this.channel)), this.channel.on(ne.BACK, r(this.channel)), this.channel.on(ne.GOTO, o(this.channel)), this.
      channel.on(ne.NEXT, s(this.channel)), this.channel.on(ne.END, c);
    });
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
        let c = ur(s);
        return c && (r[o] = Object.assign(Mt(), c)), r;
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
    this.channel?.emit(ne.SYNC, n), this.updateParentWindowState();
  }
  getLog(t) {
    let { calls: n, shadowCalls: r } = this.getState(t), o = [...r];
    n.forEach((c, a) => {
      o[a] = c;
    });
    let s = /* @__PURE__ */ new Set();
    return o.reduceRight((c, a) => (a.args.forEach((u) => {
      u?.__callId__ && s.add(u.__callId__);
    }), a.path.forEach((u) => {
      u.__callId__ && s.add(u.__callId__);
    }), (a.interceptable || a.exception) && !s.has(a.id) && (c.unshift({ callId: a.id, status: a.status, ancestors: a.ancestors }), s.add(a.
    id)), c), []);
  }
  // Traverses the object structure to recursively patch all function properties.
  // Returns the original object, or a new object with the same constructor,
  // depending on whether it should mutate.
  instrument(t, n, r = 0) {
    if (!Xs(t))
      return t;
    let { mutate: o = !1, path: s = [] } = n, c = n.getKeys ? n.getKeys(t, r) : Object.keys(t);
    return r += 1, c.reduce(
      (a, u) => {
        let m = vs(t, u);
        if (typeof m?.get == "function") {
          if (m.configurable) {
            let l = /* @__PURE__ */ i(() => m?.get?.bind(t)?.(), "getter");
            Object.defineProperty(a, u, {
              get: /* @__PURE__ */ i(() => this.instrument(l(), { ...n, path: s.concat(u) }, r), "get")
            });
          }
          return a;
        }
        let p = t[u];
        return typeof p != "function" ? (a[u] = this.instrument(p, { ...n, path: s.concat(u) }, r), a) : "__originalFn__" in p && typeof p.__originalFn__ ==
        "function" ? (a[u] = p, a) : (a[u] = (...l) => this.track(u, p, t, l, n), a[u].__originalFn__ = p, Object.defineProperty(a[u], "name",
        { value: u, writable: !1 }), Object.keys(p).length > 0 && Object.assign(
          a[u],
          this.instrument({ ...p }, { ...n, path: s.concat(u) }, r)
        ), a);
      },
      o ? t : Zs(t)
    );
  }
  // Monkey patch an object method to record calls.
  // Returns a function that invokes the original function, records the invocation ("call") and
  // returns the original result.
  track(t, n, r, o, s) {
    let c = o?.[0]?.__storyId__ || Z.__STORYBOOK_PREVIEW__?.selectionStore?.selection?.storyId, { cursor: a, ancestors: u } = this.getState(
    c);
    this.setState(c, { cursor: a + 1 });
    let m = `${u.slice(-1)[0] || c} [${a}] ${t}`, { path: p = [], intercept: l = !1, retain: b = !1 } = s, g = typeof l == "function" ? l(t,
    p) : l, h = { id: m, cursor: a, storyId: c, ancestors: u, path: p, method: t, args: o, interceptable: g, retain: b }, d = (g && !u.length ?
    this.intercept : this.invoke).call(this, n, r, h, s);
    return this.instrument(d, { ...s, mutate: !0, path: [{ __callId__: h.id }] });
  }
  intercept(t, n, r, o) {
    let { chainedCallIds: s, isDebugging: c, playUntil: a } = this.getState(r.storyId), u = s.has(r.id);
    return !c || u || a ? (a === r.id && this.setState(r.storyId, { playUntil: void 0 }), this.invoke(t, n, r, o)) : new Promise((m) => {
      this.setState(r.storyId, ({ resolvers: p }) => ({
        isLocked: !1,
        resolvers: { ...p, [r.id]: m }
      }));
    }).then(() => (this.setState(r.storyId, (m) => {
      let { [r.id]: p, ...l } = m.resolvers;
      return { isLocked: !0, resolvers: l };
    }), this.invoke(t, n, r, o)));
  }
  invoke(t, n, r, o) {
    let { callRefsByResult: s, renderPhase: c } = this.getState(r.storyId), a = 25, u = /* @__PURE__ */ i((l, b, g) => {
      if (g.includes(l))
        return "[Circular]";
      if (g = [...g, l], b > a)
        return "...";
      if (s.has(l))
        return s.get(l);
      if (l instanceof Array)
        return l.map((h) => u(h, ++b, g));
      if (l instanceof Date)
        return { __date__: { value: l.toISOString() } };
      if (l instanceof Error) {
        let { name: h, message: f, stack: d } = l;
        return { __error__: { name: h, message: f, stack: d } };
      }
      if (l instanceof RegExp) {
        let { flags: h, source: f } = l;
        return { __regexp__: { flags: h, source: f } };
      }
      if (l instanceof Z.window?.HTMLElement) {
        let { prefix: h, localName: f, id: d, classList: S, innerText: _ } = l, O = Array.from(S);
        return { __element__: { prefix: h, localName: f, id: d, classNames: O, innerText: _ } };
      }
      return typeof l == "function" ? {
        __function__: { name: "getMockName" in l ? l.getMockName() : l.name }
      } : typeof l == "symbol" ? { __symbol__: { description: l.description } } : typeof l == "object" && l?.constructor?.name && l?.constructor?.
      name !== "Object" ? { __class__: { name: l.constructor.name } } : Object.prototype.toString.call(l) === "[object Object]" ? Object.fromEntries(
        Object.entries(l).map(([h, f]) => [h, u(f, ++b, g)])
      ) : l;
    }, "serializeValues"), m = {
      ...r,
      args: r.args.map((l) => u(l, 0, []))
    };
    r.path.forEach((l) => {
      l?.__callId__ && this.setState(r.storyId, ({ chainedCallIds: b }) => ({
        chainedCallIds: new Set(Array.from(b).concat(l.__callId__))
      }));
    });
    let p = /* @__PURE__ */ i((l) => {
      if (l instanceof Error) {
        let { name: b, message: g, stack: h, callId: f = r.id } = l, {
          showDiff: d = void 0,
          diff: S = void 0,
          actual: _ = void 0,
          expected: O = void 0
        } = l.name === "AssertionError" ? It(l) : l, y = { name: b, message: g, stack: h, callId: f, showDiff: d, diff: S, actual: _, expected: O };
        if (this.update({ ...m, status: "error", exception: y }), this.setState(r.storyId, (E) => ({
          callRefsByResult: new Map([
            ...Array.from(E.callRefsByResult.entries()),
            [l, { __callId__: r.id, retain: r.retain }]
          ])
        })), r.ancestors?.length)
          throw Object.prototype.hasOwnProperty.call(l, "callId") || Object.defineProperty(l, "callId", { value: r.id }), l;
      }
      throw l;
    }, "handleException");
    try {
      if (c === "played" && !r.retain)
        throw Hs;
      let b = (o.getArgs ? o.getArgs(r, this.getState(r.storyId)) : r.args).map((h) => typeof h != "function" || ei(h) || Object.keys(h).length ?
      h : (...f) => {
        let { cursor: d, ancestors: S } = this.getState(r.storyId);
        this.setState(r.storyId, { cursor: 0, ancestors: [...S, r.id] });
        let _ = /* @__PURE__ */ i(() => this.setState(r.storyId, { cursor: d, ancestors: S }), "restore"), O = !1;
        try {
          let y = h(...f);
          return y instanceof Promise ? (O = !0, y.finally(_)) : y;
        } finally {
          O || _();
        }
      }), g = t.apply(n, b);
      return g && ["object", "function", "symbol"].includes(typeof g) && this.setState(r.storyId, (h) => ({
        callRefsByResult: new Map([
          ...Array.from(h.callRefsByResult.entries()),
          [g, { __callId__: r.id, retain: r.retain }]
        ])
      })), this.update({
        ...m,
        status: g instanceof Promise ? "active" : "done"
      }), g instanceof Promise ? g.then((h) => (this.update({ ...m, status: "done" }), h), p) : g;
    } catch (l) {
      return p(l);
    }
  }
  // Sends the call info to the manager and synchronizes the log.
  update(t) {
    this.channel?.emit(ne.CALL, t), this.setState(t.storyId, ({ calls: n }) => {
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
    let n = /* @__PURE__ */ i(() => {
      let { isLocked: r, isPlaying: o } = this.getState(t), s = this.getLog(t), c = s.filter(({ ancestors: l }) => !l.length).find((l) => l.
      status === "waiting")?.callId, a = s.some((l) => l.status === "active");
      if (this.detached || r || a || s.length === 0) {
        let b = { controlStates: {
          detached: this.detached,
          start: !1,
          back: !1,
          goto: !1,
          next: !1,
          end: !1
        }, logItems: s };
        this.channel?.emit(ne.SYNC, b);
        return;
      }
      let u = s.some(
        (l) => l.status === "done" || l.status === "error"
      ), p = { controlStates: {
        detached: this.detached,
        start: u,
        back: u,
        goto: !0,
        next: o,
        end: o
      }, logItems: s, pausedAt: c };
      this.channel?.emit(ne.SYNC, p);
    }, "synchronize");
    this.setState(t, ({ syncTimeout: r }) => (clearTimeout(r), { syncTimeout: setTimeout(n, 0) }));
  }
};
i(xt, "Instrumenter");
var Lt = xt;
function Qs(e, t = {}) {
  try {
    let n = !1, r = !1;
    return Z.window?.location?.search?.includes("instrument=true") ? n = !0 : Z.window?.location?.search?.includes("instrument=false") && (r =
    !0), Z.window?.parent === Z.window && !n || r ? e : (Z.window && !Z.window.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__ && (Z.window.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__ =
    new Lt()), (Z.window?.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__).instrument(e, t));
  } catch (n) {
    return qs.warn(n), e;
  }
}
i(Qs, "instrument");
function vs(e, t) {
  let n = e;
  for (; n != null; ) {
    let r = Object.getOwnPropertyDescriptor(n, t);
    if (r)
      return r;
    n = Object.getPrototypeOf(n);
  }
}
i(vs, "getPropertyDescriptor");
function ei(e) {
  if (typeof e != "function")
    return !1;
  let t = Object.getOwnPropertyDescriptor(e, "prototype");
  return t ? !t.writable : !1;
}
i(ei, "isClass");
export {
  Vs as CallStates,
  ne as EVENTS,
  Qs as instrument
};
