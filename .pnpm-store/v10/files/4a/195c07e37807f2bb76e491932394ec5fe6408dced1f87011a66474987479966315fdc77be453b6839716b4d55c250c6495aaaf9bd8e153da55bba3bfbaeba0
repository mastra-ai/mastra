var Hn = Object.create;
var br = Object.defineProperty;
var Vn = Object.getOwnPropertyDescriptor;
var Wn = Object.getOwnPropertyNames;
var $n = Object.getPrototypeOf, Yn = Object.prototype.hasOwnProperty;
var n = (r, e) => br(r, "name", { value: e, configurable: !0 }), Ee = /* @__PURE__ */ ((r) => typeof require < "u" ? require : typeof Proxy <
"u" ? new Proxy(r, {
  get: (e, t) => (typeof require < "u" ? require : e)[t]
}) : r)(function(r) {
  if (typeof require < "u") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + r + '" is not supported');
});
var I = (r, e) => () => (e || r((e = { exports: {} }).exports, e), e.exports);
var Kn = (r, e, t, o) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let s of Wn(e))
      !Yn.call(r, s) && s !== t && br(r, s, { get: () => e[s], enumerable: !(o = Vn(e, s)) || o.enumerable });
  return r;
};
var ue = (r, e, t) => (t = r != null ? Hn($n(r)) : {}, Kn(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  e || !r || !r.__esModule ? br(t, "default", { value: r, enumerable: !0 }) : t,
  r
));

// ../node_modules/memoizerific/memoizerific.js
var Mr = I((so, jr) => {
  (function(r) {
    if (typeof so == "object" && typeof jr < "u")
      jr.exports = r();
    else if (typeof define == "function" && define.amd)
      define([], r);
    else {
      var e;
      typeof window < "u" ? e = window : typeof global < "u" ? e = global : typeof self < "u" ? e = self : e = this, e.memoizerific = r();
    }
  })(function() {
    var r, e, t;
    return (/* @__PURE__ */ n(function o(s, i, a) {
      function l(p, u) {
        if (!i[p]) {
          if (!s[p]) {
            var y = typeof Ee == "function" && Ee;
            if (!u && y) return y(p, !0);
            if (c) return c(p, !0);
            var h = new Error("Cannot find module '" + p + "'");
            throw h.code = "MODULE_NOT_FOUND", h;
          }
          var g = i[p] = { exports: {} };
          s[p][0].call(g.exports, function(b) {
            var m = s[p][1][b];
            return l(m || b);
          }, g, g.exports, o, s, i, a);
        }
        return i[p].exports;
      }
      n(l, "s");
      for (var c = typeof Ee == "function" && Ee, d = 0; d < a.length; d++) l(a[d]);
      return l;
    }, "e"))({ 1: [function(o, s, i) {
      s.exports = function(a) {
        if (typeof Map != "function" || a) {
          var l = o("./similar");
          return new l();
        } else
          return /* @__PURE__ */ new Map();
      };
    }, { "./similar": 2 }], 2: [function(o, s, i) {
      function a() {
        return this.list = [], this.lastItem = void 0, this.size = 0, this;
      }
      n(a, "Similar"), a.prototype.get = function(l) {
        var c;
        if (this.lastItem && this.isEqual(this.lastItem.key, l))
          return this.lastItem.val;
        if (c = this.indexOf(l), c >= 0)
          return this.lastItem = this.list[c], this.list[c].val;
      }, a.prototype.set = function(l, c) {
        var d;
        return this.lastItem && this.isEqual(this.lastItem.key, l) ? (this.lastItem.val = c, this) : (d = this.indexOf(l), d >= 0 ? (this.lastItem =
        this.list[d], this.list[d].val = c, this) : (this.lastItem = { key: l, val: c }, this.list.push(this.lastItem), this.size++, this));
      }, a.prototype.delete = function(l) {
        var c;
        if (this.lastItem && this.isEqual(this.lastItem.key, l) && (this.lastItem = void 0), c = this.indexOf(l), c >= 0)
          return this.size--, this.list.splice(c, 1)[0];
      }, a.prototype.has = function(l) {
        var c;
        return this.lastItem && this.isEqual(this.lastItem.key, l) ? !0 : (c = this.indexOf(l), c >= 0 ? (this.lastItem = this.list[c], !0) :
        !1);
      }, a.prototype.forEach = function(l, c) {
        var d;
        for (d = 0; d < this.size; d++)
          l.call(c || this, this.list[d].val, this.list[d].key, this);
      }, a.prototype.indexOf = function(l) {
        var c;
        for (c = 0; c < this.size; c++)
          if (this.isEqual(this.list[c].key, l))
            return c;
        return -1;
      }, a.prototype.isEqual = function(l, c) {
        return l === c || l !== l && c !== c;
      }, s.exports = a;
    }, {}], 3: [function(o, s, i) {
      var a = o("map-or-similar");
      s.exports = function(p) {
        var u = new a(!1), y = [];
        return function(h) {
          var g = /* @__PURE__ */ n(function() {
            var b = u, m, T, x = arguments.length - 1, f = Array(x + 1), S = !0, R;
            if ((g.numArgs || g.numArgs === 0) && g.numArgs !== x + 1)
              throw new Error("Memoizerific functions should always be called with the same number of arguments");
            for (R = 0; R < x; R++) {
              if (f[R] = {
                cacheItem: b,
                arg: arguments[R]
              }, b.has(arguments[R])) {
                b = b.get(arguments[R]);
                continue;
              }
              S = !1, m = new a(!1), b.set(arguments[R], m), b = m;
            }
            return S && (b.has(arguments[x]) ? T = b.get(arguments[x]) : S = !1), S || (T = h.apply(null, arguments), b.set(arguments[x], T)),
            p > 0 && (f[x] = {
              cacheItem: b,
              arg: arguments[x]
            }, S ? l(y, f) : y.push(f), y.length > p && c(y.shift())), g.wasMemoized = S, g.numArgs = x + 1, T;
          }, "memoizerific");
          return g.limit = p, g.wasMemoized = !1, g.cache = u, g.lru = y, g;
        };
      };
      function l(p, u) {
        var y = p.length, h = u.length, g, b, m;
        for (b = 0; b < y; b++) {
          for (g = !0, m = 0; m < h; m++)
            if (!d(p[b][m].arg, u[m].arg)) {
              g = !1;
              break;
            }
          if (g)
            break;
        }
        p.push(p.splice(b, 1)[0]);
      }
      n(l, "moveToMostRecentLru");
      function c(p) {
        var u = p.length, y = p[u - 1], h, g;
        for (y.cacheItem.delete(y.arg), g = u - 2; g >= 0 && (y = p[g], h = y.cacheItem.get(y.arg), !h || !h.size); g--)
          y.cacheItem.delete(y.arg);
      }
      n(c, "removeCachedResult");
      function d(p, u) {
        return p === u || p !== p && u !== u;
      }
      n(d, "isEqual");
    }, { "map-or-similar": 1 }] }, {}, [3])(3);
  });
});

// ../node_modules/picoquery/lib/string-util.js
var at = I((it) => {
  "use strict";
  Object.defineProperty(it, "__esModule", { value: !0 });
  it.encodeString = na;
  var G = Array.from({ length: 256 }, (r, e) => "%" + ((e < 16 ? "0" : "") + e.toString(16)).toUpperCase()), oa = new Int8Array([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    0,
    0,
    1,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    1,
    0
  ]);
  function na(r) {
    let e = r.length;
    if (e === 0)
      return "";
    let t = "", o = 0, s = 0;
    e: for (; s < e; s++) {
      let i = r.charCodeAt(s);
      for (; i < 128; ) {
        if (oa[i] !== 1 && (o < s && (t += r.slice(o, s)), o = s + 1, t += G[i]), ++s === e)
          break e;
        i = r.charCodeAt(s);
      }
      if (o < s && (t += r.slice(o, s)), i < 2048) {
        o = s + 1, t += G[192 | i >> 6] + G[128 | i & 63];
        continue;
      }
      if (i < 55296 || i >= 57344) {
        o = s + 1, t += G[224 | i >> 12] + G[128 | i >> 6 & 63] + G[128 | i & 63];
        continue;
      }
      if (++s, s >= e)
        throw new Error("URI malformed");
      let a = r.charCodeAt(s) & 1023;
      o = s + 1, i = 65536 + ((i & 1023) << 10 | a), t += G[240 | i >> 18] + G[128 | i >> 12 & 63] + G[128 | i >> 6 & 63] + G[128 | i & 63];
    }
    return o === 0 ? r : o < e ? t + r.slice(o) : t;
  }
  n(na, "encodeString");
});

// ../node_modules/picoquery/lib/shared.js
var nr = I((U) => {
  "use strict";
  Object.defineProperty(U, "__esModule", { value: !0 });
  U.defaultOptions = U.defaultShouldSerializeObject = U.defaultValueSerializer = void 0;
  var lt = at(), sa = /* @__PURE__ */ n((r) => {
    switch (typeof r) {
      case "string":
        return (0, lt.encodeString)(r);
      case "bigint":
      case "boolean":
        return "" + r;
      case "number":
        if (Number.isFinite(r))
          return r < 1e21 ? "" + r : (0, lt.encodeString)("" + r);
        break;
    }
    return r instanceof Date ? (0, lt.encodeString)(r.toISOString()) : "";
  }, "defaultValueSerializer");
  U.defaultValueSerializer = sa;
  var ia = /* @__PURE__ */ n((r) => r instanceof Date, "defaultShouldSerializeObject");
  U.defaultShouldSerializeObject = ia;
  var zo = /* @__PURE__ */ n((r) => r, "identityFunc");
  U.defaultOptions = {
    nesting: !0,
    nestingSyntax: "dot",
    arrayRepeat: !1,
    arrayRepeatSyntax: "repeat",
    delimiter: 38,
    valueDeserializer: zo,
    valueSerializer: U.defaultValueSerializer,
    keyDeserializer: zo,
    shouldSerializeObject: U.defaultShouldSerializeObject
  };
});

// ../node_modules/picoquery/lib/object-util.js
var ct = I((sr) => {
  "use strict";
  Object.defineProperty(sr, "__esModule", { value: !0 });
  sr.getDeepObject = ca;
  sr.stringifyObject = Bo;
  var ae = nr(), aa = at();
  function la(r) {
    return r === "__proto__" || r === "constructor" || r === "prototype";
  }
  n(la, "isPrototypeKey");
  function ca(r, e, t, o, s) {
    if (la(e))
      return r;
    let i = r[e];
    return typeof i == "object" && i !== null ? i : !o && (s || typeof t == "number" || typeof t == "string" && t * 0 === 0 && t.indexOf(".") ===
    -1) ? r[e] = [] : r[e] = {};
  }
  n(ca, "getDeepObject");
  var da = 20, pa = "[]", ua = "[", fa = "]", ya = ".";
  function Bo(r, e, t = 0, o, s) {
    let { nestingSyntax: i = ae.defaultOptions.nestingSyntax, arrayRepeat: a = ae.defaultOptions.arrayRepeat, arrayRepeatSyntax: l = ae.defaultOptions.
    arrayRepeatSyntax, nesting: c = ae.defaultOptions.nesting, delimiter: d = ae.defaultOptions.delimiter, valueSerializer: p = ae.defaultOptions.
    valueSerializer, shouldSerializeObject: u = ae.defaultOptions.shouldSerializeObject } = e, y = typeof d == "number" ? String.fromCharCode(
    d) : d, h = s === !0 && a, g = i === "dot" || i === "js" && !s;
    if (t > da)
      return "";
    let b = "", m = !0, T = !1;
    for (let x in r) {
      let f = r[x], S;
      o ? (S = o, h ? l === "bracket" && (S += pa) : g ? (S += ya, S += x) : (S += ua, S += x, S += fa)) : S = x, m || (b += y), typeof f ==
      "object" && f !== null && !u(f) ? (T = f.pop !== void 0, (c || a && T) && (b += Bo(f, e, t + 1, S, T))) : (b += (0, aa.encodeString)(S),
      b += "=", b += p(f, x)), m && (m = !1);
    }
    return b;
  }
  n(Bo, "stringifyObject");
});

// ../node_modules/fast-decode-uri-component/index.js
var Vo = I((rf, Ho) => {
  "use strict";
  var Go = 12, ma = 0, dt = [
    // The first part of the table maps bytes to character to a transition.
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    4,
    4,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    6,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    8,
    7,
    7,
    10,
    9,
    9,
    9,
    11,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    // The second part of the table maps a state to a new state when adding a
    // transition.
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    12,
    0,
    0,
    0,
    0,
    24,
    36,
    48,
    60,
    72,
    84,
    96,
    0,
    12,
    12,
    12,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    24,
    24,
    24,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    24,
    24,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    48,
    48,
    48,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    48,
    48,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    48,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // The third part maps the current transition to a mask that needs to apply
    // to the byte.
    127,
    63,
    63,
    63,
    0,
    31,
    15,
    15,
    15,
    7,
    7,
    7
  ];
  function ha(r) {
    var e = r.indexOf("%");
    if (e === -1) return r;
    for (var t = r.length, o = "", s = 0, i = 0, a = e, l = Go; e > -1 && e < t; ) {
      var c = Uo(r[e + 1], 4), d = Uo(r[e + 2], 0), p = c | d, u = dt[p];
      if (l = dt[256 + l + u], i = i << 6 | p & dt[364 + u], l === Go)
        o += r.slice(s, a), o += i <= 65535 ? String.fromCharCode(i) : String.fromCharCode(
          55232 + (i >> 10),
          56320 + (i & 1023)
        ), i = 0, s = e + 3, e = a = r.indexOf("%", s);
      else {
        if (l === ma)
          return null;
        if (e += 3, e < t && r.charCodeAt(e) === 37) continue;
        return null;
      }
    }
    return o + r.slice(s);
  }
  n(ha, "decodeURIComponent");
  var ga = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    a: 10,
    A: 10,
    b: 11,
    B: 11,
    c: 12,
    C: 12,
    d: 13,
    D: 13,
    e: 14,
    E: 14,
    f: 15,
    F: 15
  };
  function Uo(r, e) {
    var t = ga[r];
    return t === void 0 ? 255 : t << e;
  }
  n(Uo, "hexCodeToInt");
  Ho.exports = ha;
});

// ../node_modules/picoquery/lib/parse.js
var Ko = I(($) => {
  "use strict";
  var ba = $ && $.__importDefault || function(r) {
    return r && r.__esModule ? r : { default: r };
  };
  Object.defineProperty($, "__esModule", { value: !0 });
  $.numberValueDeserializer = $.numberKeyDeserializer = void 0;
  $.parse = xa;
  var ir = ct(), le = nr(), Wo = ba(Vo()), Sa = /* @__PURE__ */ n((r) => {
    let e = Number(r);
    return Number.isNaN(e) ? r : e;
  }, "numberKeyDeserializer");
  $.numberKeyDeserializer = Sa;
  var Ta = /* @__PURE__ */ n((r) => {
    let e = Number(r);
    return Number.isNaN(e) ? r : e;
  }, "numberValueDeserializer");
  $.numberValueDeserializer = Ta;
  var $o = /\+/g, Yo = /* @__PURE__ */ n(function() {
  }, "Empty");
  Yo.prototype = /* @__PURE__ */ Object.create(null);
  function ar(r, e, t, o, s) {
    let i = r.substring(e, t);
    return o && (i = i.replace($o, " ")), s && (i = (0, Wo.default)(i) || i), i;
  }
  n(ar, "computeKeySlice");
  function xa(r, e) {
    let { valueDeserializer: t = le.defaultOptions.valueDeserializer, keyDeserializer: o = le.defaultOptions.keyDeserializer, arrayRepeatSyntax: s = le.
    defaultOptions.arrayRepeatSyntax, nesting: i = le.defaultOptions.nesting, arrayRepeat: a = le.defaultOptions.arrayRepeat, nestingSyntax: l = le.
    defaultOptions.nestingSyntax, delimiter: c = le.defaultOptions.delimiter } = e ?? {}, d = typeof c == "string" ? c.charCodeAt(0) : c, p = l ===
    "js", u = new Yo();
    if (typeof r != "string")
      return u;
    let y = r.length, h = "", g = -1, b = -1, m = -1, T = u, x, f = "", S = "", R = !1, w = !1, E = !1, D = !1, k = !1, L = !1, pe = !1, q = 0,
    v = -1, B = -1, Et = -1;
    for (let F = 0; F < y + 1; F++) {
      if (q = F !== y ? r.charCodeAt(F) : d, q === d) {
        if (pe = b > g, pe || (b = F), m !== b - 1 && (S = ar(r, m + 1, v > -1 ? v : b, E, R), f = o(S), x !== void 0 && (T = (0, ir.getDeepObject)(
        T, x, f, p && k, p && L))), pe || f !== "") {
          pe && (h = r.slice(b + 1, F), D && (h = h.replace($o, " ")), w && (h = (0, Wo.default)(h) || h));
          let Ae = t(h, f);
          if (a) {
            let Be = T[f];
            Be === void 0 ? v > -1 ? T[f] = [Ae] : T[f] = Ae : Be.pop ? Be.push(Ae) : T[f] = [Be, Ae];
          } else
            T[f] = Ae;
        }
        h = "", g = F, b = F, R = !1, w = !1, E = !1, D = !1, k = !1, L = !1, v = -1, m = F, T = u, x = void 0, f = "";
      } else q === 93 ? (a && s === "bracket" && Et === 91 && (v = B), i && (l === "index" || p) && b <= g && (m !== B && (S = ar(r, m + 1, F,
      E, R), f = o(S), x !== void 0 && (T = (0, ir.getDeepObject)(T, x, f, void 0, p)), x = f, E = !1, R = !1), m = F, L = !0, k = !1)) : q ===
      46 ? i && (l === "dot" || p) && b <= g && (m !== B && (S = ar(r, m + 1, F, E, R), f = o(S), x !== void 0 && (T = (0, ir.getDeepObject)(
      T, x, f, p)), x = f, E = !1, R = !1), k = !0, L = !1, m = F) : q === 91 ? i && (l === "index" || p) && b <= g && (m !== B && (S = ar(r,
      m + 1, F, E, R), f = o(S), p && x !== void 0 && (T = (0, ir.getDeepObject)(T, x, f, p)), x = f, E = !1, R = !1, k = !1, L = !0), m = F) :
      q === 61 ? b <= g ? b = F : w = !0 : q === 43 ? b > g ? D = !0 : E = !0 : q === 37 && (b > g ? w = !0 : R = !0);
      B = F, Et = q;
    }
    return u;
  }
  n(xa, "parse");
});

// ../node_modules/picoquery/lib/stringify.js
var Xo = I((pt) => {
  "use strict";
  Object.defineProperty(pt, "__esModule", { value: !0 });
  pt.stringify = wa;
  var Ra = ct();
  function wa(r, e) {
    if (r === null || typeof r != "object")
      return "";
    let t = e ?? {};
    return (0, Ra.stringifyObject)(r, t);
  }
  n(wa, "stringify");
});

// ../node_modules/picoquery/lib/main.js
var lr = I((z) => {
  "use strict";
  var Aa = z && z.__createBinding || (Object.create ? function(r, e, t, o) {
    o === void 0 && (o = t);
    var s = Object.getOwnPropertyDescriptor(e, t);
    (!s || ("get" in s ? !e.__esModule : s.writable || s.configurable)) && (s = { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return e[t];
    }, "get") }), Object.defineProperty(r, o, s);
  } : function(r, e, t, o) {
    o === void 0 && (o = t), r[o] = e[t];
  }), Ea = z && z.__exportStar || function(r, e) {
    for (var t in r) t !== "default" && !Object.prototype.hasOwnProperty.call(e, t) && Aa(e, r, t);
  };
  Object.defineProperty(z, "__esModule", { value: !0 });
  z.stringify = z.parse = void 0;
  var Ca = Ko();
  Object.defineProperty(z, "parse", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return Ca.parse;
  }, "get") });
  var va = Xo();
  Object.defineProperty(z, "stringify", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return va.stringify;
  }, "get") });
  Ea(nr(), z);
});

// ../node_modules/entities/lib/maps/entities.json
var mt = I((Sf, _a) => {
  _a.exports = { Aacute: "\xC1", aacute: "\xE1", Abreve: "\u0102", abreve: "\u0103", ac: "\u223E", acd: "\u223F", acE: "\u223E\u0333", Acirc: "\
\xC2", acirc: "\xE2", acute: "\xB4", Acy: "\u0410", acy: "\u0430", AElig: "\xC6", aelig: "\xE6", af: "\u2061", Afr: "\u{1D504}", afr: "\u{1D51E}",
  Agrave: "\xC0", agrave: "\xE0", alefsym: "\u2135", aleph: "\u2135", Alpha: "\u0391", alpha: "\u03B1", Amacr: "\u0100", amacr: "\u0101", amalg: "\
\u2A3F", amp: "&", AMP: "&", andand: "\u2A55", And: "\u2A53", and: "\u2227", andd: "\u2A5C", andslope: "\u2A58", andv: "\u2A5A", ang: "\u2220",
  ange: "\u29A4", angle: "\u2220", angmsdaa: "\u29A8", angmsdab: "\u29A9", angmsdac: "\u29AA", angmsdad: "\u29AB", angmsdae: "\u29AC", angmsdaf: "\
\u29AD", angmsdag: "\u29AE", angmsdah: "\u29AF", angmsd: "\u2221", angrt: "\u221F", angrtvb: "\u22BE", angrtvbd: "\u299D", angsph: "\u2222",
  angst: "\xC5", angzarr: "\u237C", Aogon: "\u0104", aogon: "\u0105", Aopf: "\u{1D538}", aopf: "\u{1D552}", apacir: "\u2A6F", ap: "\u2248", apE: "\
\u2A70", ape: "\u224A", apid: "\u224B", apos: "'", ApplyFunction: "\u2061", approx: "\u2248", approxeq: "\u224A", Aring: "\xC5", aring: "\xE5",
  Ascr: "\u{1D49C}", ascr: "\u{1D4B6}", Assign: "\u2254", ast: "*", asymp: "\u2248", asympeq: "\u224D", Atilde: "\xC3", atilde: "\xE3", Auml: "\
\xC4", auml: "\xE4", awconint: "\u2233", awint: "\u2A11", backcong: "\u224C", backepsilon: "\u03F6", backprime: "\u2035", backsim: "\u223D",
  backsimeq: "\u22CD", Backslash: "\u2216", Barv: "\u2AE7", barvee: "\u22BD", barwed: "\u2305", Barwed: "\u2306", barwedge: "\u2305", bbrk: "\
\u23B5", bbrktbrk: "\u23B6", bcong: "\u224C", Bcy: "\u0411", bcy: "\u0431", bdquo: "\u201E", becaus: "\u2235", because: "\u2235", Because: "\
\u2235", bemptyv: "\u29B0", bepsi: "\u03F6", bernou: "\u212C", Bernoullis: "\u212C", Beta: "\u0392", beta: "\u03B2", beth: "\u2136", between: "\
\u226C", Bfr: "\u{1D505}", bfr: "\u{1D51F}", bigcap: "\u22C2", bigcirc: "\u25EF", bigcup: "\u22C3", bigodot: "\u2A00", bigoplus: "\u2A01", bigotimes: "\
\u2A02", bigsqcup: "\u2A06", bigstar: "\u2605", bigtriangledown: "\u25BD", bigtriangleup: "\u25B3", biguplus: "\u2A04", bigvee: "\u22C1", bigwedge: "\
\u22C0", bkarow: "\u290D", blacklozenge: "\u29EB", blacksquare: "\u25AA", blacktriangle: "\u25B4", blacktriangledown: "\u25BE", blacktriangleleft: "\
\u25C2", blacktriangleright: "\u25B8", blank: "\u2423", blk12: "\u2592", blk14: "\u2591", blk34: "\u2593", block: "\u2588", bne: "=\u20E5", bnequiv: "\
\u2261\u20E5", bNot: "\u2AED", bnot: "\u2310", Bopf: "\u{1D539}", bopf: "\u{1D553}", bot: "\u22A5", bottom: "\u22A5", bowtie: "\u22C8", boxbox: "\
\u29C9", boxdl: "\u2510", boxdL: "\u2555", boxDl: "\u2556", boxDL: "\u2557", boxdr: "\u250C", boxdR: "\u2552", boxDr: "\u2553", boxDR: "\u2554",
  boxh: "\u2500", boxH: "\u2550", boxhd: "\u252C", boxHd: "\u2564", boxhD: "\u2565", boxHD: "\u2566", boxhu: "\u2534", boxHu: "\u2567", boxhU: "\
\u2568", boxHU: "\u2569", boxminus: "\u229F", boxplus: "\u229E", boxtimes: "\u22A0", boxul: "\u2518", boxuL: "\u255B", boxUl: "\u255C", boxUL: "\
\u255D", boxur: "\u2514", boxuR: "\u2558", boxUr: "\u2559", boxUR: "\u255A", boxv: "\u2502", boxV: "\u2551", boxvh: "\u253C", boxvH: "\u256A",
  boxVh: "\u256B", boxVH: "\u256C", boxvl: "\u2524", boxvL: "\u2561", boxVl: "\u2562", boxVL: "\u2563", boxvr: "\u251C", boxvR: "\u255E", boxVr: "\
\u255F", boxVR: "\u2560", bprime: "\u2035", breve: "\u02D8", Breve: "\u02D8", brvbar: "\xA6", bscr: "\u{1D4B7}", Bscr: "\u212C", bsemi: "\u204F",
  bsim: "\u223D", bsime: "\u22CD", bsolb: "\u29C5", bsol: "\\", bsolhsub: "\u27C8", bull: "\u2022", bullet: "\u2022", bump: "\u224E", bumpE: "\
\u2AAE", bumpe: "\u224F", Bumpeq: "\u224E", bumpeq: "\u224F", Cacute: "\u0106", cacute: "\u0107", capand: "\u2A44", capbrcup: "\u2A49", capcap: "\
\u2A4B", cap: "\u2229", Cap: "\u22D2", capcup: "\u2A47", capdot: "\u2A40", CapitalDifferentialD: "\u2145", caps: "\u2229\uFE00", caret: "\u2041",
  caron: "\u02C7", Cayleys: "\u212D", ccaps: "\u2A4D", Ccaron: "\u010C", ccaron: "\u010D", Ccedil: "\xC7", ccedil: "\xE7", Ccirc: "\u0108", ccirc: "\
\u0109", Cconint: "\u2230", ccups: "\u2A4C", ccupssm: "\u2A50", Cdot: "\u010A", cdot: "\u010B", cedil: "\xB8", Cedilla: "\xB8", cemptyv: "\u29B2",
  cent: "\xA2", centerdot: "\xB7", CenterDot: "\xB7", cfr: "\u{1D520}", Cfr: "\u212D", CHcy: "\u0427", chcy: "\u0447", check: "\u2713", checkmark: "\
\u2713", Chi: "\u03A7", chi: "\u03C7", circ: "\u02C6", circeq: "\u2257", circlearrowleft: "\u21BA", circlearrowright: "\u21BB", circledast: "\
\u229B", circledcirc: "\u229A", circleddash: "\u229D", CircleDot: "\u2299", circledR: "\xAE", circledS: "\u24C8", CircleMinus: "\u2296", CirclePlus: "\
\u2295", CircleTimes: "\u2297", cir: "\u25CB", cirE: "\u29C3", cire: "\u2257", cirfnint: "\u2A10", cirmid: "\u2AEF", cirscir: "\u29C2", ClockwiseContourIntegral: "\
\u2232", CloseCurlyDoubleQuote: "\u201D", CloseCurlyQuote: "\u2019", clubs: "\u2663", clubsuit: "\u2663", colon: ":", Colon: "\u2237", Colone: "\
\u2A74", colone: "\u2254", coloneq: "\u2254", comma: ",", commat: "@", comp: "\u2201", compfn: "\u2218", complement: "\u2201", complexes: "\u2102",
  cong: "\u2245", congdot: "\u2A6D", Congruent: "\u2261", conint: "\u222E", Conint: "\u222F", ContourIntegral: "\u222E", copf: "\u{1D554}", Copf: "\
\u2102", coprod: "\u2210", Coproduct: "\u2210", copy: "\xA9", COPY: "\xA9", copysr: "\u2117", CounterClockwiseContourIntegral: "\u2233", crarr: "\
\u21B5", cross: "\u2717", Cross: "\u2A2F", Cscr: "\u{1D49E}", cscr: "\u{1D4B8}", csub: "\u2ACF", csube: "\u2AD1", csup: "\u2AD0", csupe: "\u2AD2",
  ctdot: "\u22EF", cudarrl: "\u2938", cudarrr: "\u2935", cuepr: "\u22DE", cuesc: "\u22DF", cularr: "\u21B6", cularrp: "\u293D", cupbrcap: "\u2A48",
  cupcap: "\u2A46", CupCap: "\u224D", cup: "\u222A", Cup: "\u22D3", cupcup: "\u2A4A", cupdot: "\u228D", cupor: "\u2A45", cups: "\u222A\uFE00",
  curarr: "\u21B7", curarrm: "\u293C", curlyeqprec: "\u22DE", curlyeqsucc: "\u22DF", curlyvee: "\u22CE", curlywedge: "\u22CF", curren: "\xA4",
  curvearrowleft: "\u21B6", curvearrowright: "\u21B7", cuvee: "\u22CE", cuwed: "\u22CF", cwconint: "\u2232", cwint: "\u2231", cylcty: "\u232D",
  dagger: "\u2020", Dagger: "\u2021", daleth: "\u2138", darr: "\u2193", Darr: "\u21A1", dArr: "\u21D3", dash: "\u2010", Dashv: "\u2AE4", dashv: "\
\u22A3", dbkarow: "\u290F", dblac: "\u02DD", Dcaron: "\u010E", dcaron: "\u010F", Dcy: "\u0414", dcy: "\u0434", ddagger: "\u2021", ddarr: "\u21CA",
  DD: "\u2145", dd: "\u2146", DDotrahd: "\u2911", ddotseq: "\u2A77", deg: "\xB0", Del: "\u2207", Delta: "\u0394", delta: "\u03B4", demptyv: "\
\u29B1", dfisht: "\u297F", Dfr: "\u{1D507}", dfr: "\u{1D521}", dHar: "\u2965", dharl: "\u21C3", dharr: "\u21C2", DiacriticalAcute: "\xB4", DiacriticalDot: "\
\u02D9", DiacriticalDoubleAcute: "\u02DD", DiacriticalGrave: "`", DiacriticalTilde: "\u02DC", diam: "\u22C4", diamond: "\u22C4", Diamond: "\u22C4",
  diamondsuit: "\u2666", diams: "\u2666", die: "\xA8", DifferentialD: "\u2146", digamma: "\u03DD", disin: "\u22F2", div: "\xF7", divide: "\xF7",
  divideontimes: "\u22C7", divonx: "\u22C7", DJcy: "\u0402", djcy: "\u0452", dlcorn: "\u231E", dlcrop: "\u230D", dollar: "$", Dopf: "\u{1D53B}",
  dopf: "\u{1D555}", Dot: "\xA8", dot: "\u02D9", DotDot: "\u20DC", doteq: "\u2250", doteqdot: "\u2251", DotEqual: "\u2250", dotminus: "\u2238",
  dotplus: "\u2214", dotsquare: "\u22A1", doublebarwedge: "\u2306", DoubleContourIntegral: "\u222F", DoubleDot: "\xA8", DoubleDownArrow: "\u21D3",
  DoubleLeftArrow: "\u21D0", DoubleLeftRightArrow: "\u21D4", DoubleLeftTee: "\u2AE4", DoubleLongLeftArrow: "\u27F8", DoubleLongLeftRightArrow: "\
\u27FA", DoubleLongRightArrow: "\u27F9", DoubleRightArrow: "\u21D2", DoubleRightTee: "\u22A8", DoubleUpArrow: "\u21D1", DoubleUpDownArrow: "\
\u21D5", DoubleVerticalBar: "\u2225", DownArrowBar: "\u2913", downarrow: "\u2193", DownArrow: "\u2193", Downarrow: "\u21D3", DownArrowUpArrow: "\
\u21F5", DownBreve: "\u0311", downdownarrows: "\u21CA", downharpoonleft: "\u21C3", downharpoonright: "\u21C2", DownLeftRightVector: "\u2950",
  DownLeftTeeVector: "\u295E", DownLeftVectorBar: "\u2956", DownLeftVector: "\u21BD", DownRightTeeVector: "\u295F", DownRightVectorBar: "\u2957",
  DownRightVector: "\u21C1", DownTeeArrow: "\u21A7", DownTee: "\u22A4", drbkarow: "\u2910", drcorn: "\u231F", drcrop: "\u230C", Dscr: "\u{1D49F}",
  dscr: "\u{1D4B9}", DScy: "\u0405", dscy: "\u0455", dsol: "\u29F6", Dstrok: "\u0110", dstrok: "\u0111", dtdot: "\u22F1", dtri: "\u25BF", dtrif: "\
\u25BE", duarr: "\u21F5", duhar: "\u296F", dwangle: "\u29A6", DZcy: "\u040F", dzcy: "\u045F", dzigrarr: "\u27FF", Eacute: "\xC9", eacute: "\xE9",
  easter: "\u2A6E", Ecaron: "\u011A", ecaron: "\u011B", Ecirc: "\xCA", ecirc: "\xEA", ecir: "\u2256", ecolon: "\u2255", Ecy: "\u042D", ecy: "\
\u044D", eDDot: "\u2A77", Edot: "\u0116", edot: "\u0117", eDot: "\u2251", ee: "\u2147", efDot: "\u2252", Efr: "\u{1D508}", efr: "\u{1D522}",
  eg: "\u2A9A", Egrave: "\xC8", egrave: "\xE8", egs: "\u2A96", egsdot: "\u2A98", el: "\u2A99", Element: "\u2208", elinters: "\u23E7", ell: "\
\u2113", els: "\u2A95", elsdot: "\u2A97", Emacr: "\u0112", emacr: "\u0113", empty: "\u2205", emptyset: "\u2205", EmptySmallSquare: "\u25FB",
  emptyv: "\u2205", EmptyVerySmallSquare: "\u25AB", emsp13: "\u2004", emsp14: "\u2005", emsp: "\u2003", ENG: "\u014A", eng: "\u014B", ensp: "\
\u2002", Eogon: "\u0118", eogon: "\u0119", Eopf: "\u{1D53C}", eopf: "\u{1D556}", epar: "\u22D5", eparsl: "\u29E3", eplus: "\u2A71", epsi: "\u03B5",
  Epsilon: "\u0395", epsilon: "\u03B5", epsiv: "\u03F5", eqcirc: "\u2256", eqcolon: "\u2255", eqsim: "\u2242", eqslantgtr: "\u2A96", eqslantless: "\
\u2A95", Equal: "\u2A75", equals: "=", EqualTilde: "\u2242", equest: "\u225F", Equilibrium: "\u21CC", equiv: "\u2261", equivDD: "\u2A78", eqvparsl: "\
\u29E5", erarr: "\u2971", erDot: "\u2253", escr: "\u212F", Escr: "\u2130", esdot: "\u2250", Esim: "\u2A73", esim: "\u2242", Eta: "\u0397", eta: "\
\u03B7", ETH: "\xD0", eth: "\xF0", Euml: "\xCB", euml: "\xEB", euro: "\u20AC", excl: "!", exist: "\u2203", Exists: "\u2203", expectation: "\u2130",
  exponentiale: "\u2147", ExponentialE: "\u2147", fallingdotseq: "\u2252", Fcy: "\u0424", fcy: "\u0444", female: "\u2640", ffilig: "\uFB03",
  fflig: "\uFB00", ffllig: "\uFB04", Ffr: "\u{1D509}", ffr: "\u{1D523}", filig: "\uFB01", FilledSmallSquare: "\u25FC", FilledVerySmallSquare: "\
\u25AA", fjlig: "fj", flat: "\u266D", fllig: "\uFB02", fltns: "\u25B1", fnof: "\u0192", Fopf: "\u{1D53D}", fopf: "\u{1D557}", forall: "\u2200",
  ForAll: "\u2200", fork: "\u22D4", forkv: "\u2AD9", Fouriertrf: "\u2131", fpartint: "\u2A0D", frac12: "\xBD", frac13: "\u2153", frac14: "\xBC",
  frac15: "\u2155", frac16: "\u2159", frac18: "\u215B", frac23: "\u2154", frac25: "\u2156", frac34: "\xBE", frac35: "\u2157", frac38: "\u215C",
  frac45: "\u2158", frac56: "\u215A", frac58: "\u215D", frac78: "\u215E", frasl: "\u2044", frown: "\u2322", fscr: "\u{1D4BB}", Fscr: "\u2131",
  gacute: "\u01F5", Gamma: "\u0393", gamma: "\u03B3", Gammad: "\u03DC", gammad: "\u03DD", gap: "\u2A86", Gbreve: "\u011E", gbreve: "\u011F",
  Gcedil: "\u0122", Gcirc: "\u011C", gcirc: "\u011D", Gcy: "\u0413", gcy: "\u0433", Gdot: "\u0120", gdot: "\u0121", ge: "\u2265", gE: "\u2267",
  gEl: "\u2A8C", gel: "\u22DB", geq: "\u2265", geqq: "\u2267", geqslant: "\u2A7E", gescc: "\u2AA9", ges: "\u2A7E", gesdot: "\u2A80", gesdoto: "\
\u2A82", gesdotol: "\u2A84", gesl: "\u22DB\uFE00", gesles: "\u2A94", Gfr: "\u{1D50A}", gfr: "\u{1D524}", gg: "\u226B", Gg: "\u22D9", ggg: "\u22D9",
  gimel: "\u2137", GJcy: "\u0403", gjcy: "\u0453", gla: "\u2AA5", gl: "\u2277", glE: "\u2A92", glj: "\u2AA4", gnap: "\u2A8A", gnapprox: "\u2A8A",
  gne: "\u2A88", gnE: "\u2269", gneq: "\u2A88", gneqq: "\u2269", gnsim: "\u22E7", Gopf: "\u{1D53E}", gopf: "\u{1D558}", grave: "`", GreaterEqual: "\
\u2265", GreaterEqualLess: "\u22DB", GreaterFullEqual: "\u2267", GreaterGreater: "\u2AA2", GreaterLess: "\u2277", GreaterSlantEqual: "\u2A7E",
  GreaterTilde: "\u2273", Gscr: "\u{1D4A2}", gscr: "\u210A", gsim: "\u2273", gsime: "\u2A8E", gsiml: "\u2A90", gtcc: "\u2AA7", gtcir: "\u2A7A",
  gt: ">", GT: ">", Gt: "\u226B", gtdot: "\u22D7", gtlPar: "\u2995", gtquest: "\u2A7C", gtrapprox: "\u2A86", gtrarr: "\u2978", gtrdot: "\u22D7",
  gtreqless: "\u22DB", gtreqqless: "\u2A8C", gtrless: "\u2277", gtrsim: "\u2273", gvertneqq: "\u2269\uFE00", gvnE: "\u2269\uFE00", Hacek: "\u02C7",
  hairsp: "\u200A", half: "\xBD", hamilt: "\u210B", HARDcy: "\u042A", hardcy: "\u044A", harrcir: "\u2948", harr: "\u2194", hArr: "\u21D4", harrw: "\
\u21AD", Hat: "^", hbar: "\u210F", Hcirc: "\u0124", hcirc: "\u0125", hearts: "\u2665", heartsuit: "\u2665", hellip: "\u2026", hercon: "\u22B9",
  hfr: "\u{1D525}", Hfr: "\u210C", HilbertSpace: "\u210B", hksearow: "\u2925", hkswarow: "\u2926", hoarr: "\u21FF", homtht: "\u223B", hookleftarrow: "\
\u21A9", hookrightarrow: "\u21AA", hopf: "\u{1D559}", Hopf: "\u210D", horbar: "\u2015", HorizontalLine: "\u2500", hscr: "\u{1D4BD}", Hscr: "\
\u210B", hslash: "\u210F", Hstrok: "\u0126", hstrok: "\u0127", HumpDownHump: "\u224E", HumpEqual: "\u224F", hybull: "\u2043", hyphen: "\u2010",
  Iacute: "\xCD", iacute: "\xED", ic: "\u2063", Icirc: "\xCE", icirc: "\xEE", Icy: "\u0418", icy: "\u0438", Idot: "\u0130", IEcy: "\u0415", iecy: "\
\u0435", iexcl: "\xA1", iff: "\u21D4", ifr: "\u{1D526}", Ifr: "\u2111", Igrave: "\xCC", igrave: "\xEC", ii: "\u2148", iiiint: "\u2A0C", iiint: "\
\u222D", iinfin: "\u29DC", iiota: "\u2129", IJlig: "\u0132", ijlig: "\u0133", Imacr: "\u012A", imacr: "\u012B", image: "\u2111", ImaginaryI: "\
\u2148", imagline: "\u2110", imagpart: "\u2111", imath: "\u0131", Im: "\u2111", imof: "\u22B7", imped: "\u01B5", Implies: "\u21D2", incare: "\
\u2105", in: "\u2208", infin: "\u221E", infintie: "\u29DD", inodot: "\u0131", intcal: "\u22BA", int: "\u222B", Int: "\u222C", integers: "\u2124",
  Integral: "\u222B", intercal: "\u22BA", Intersection: "\u22C2", intlarhk: "\u2A17", intprod: "\u2A3C", InvisibleComma: "\u2063", InvisibleTimes: "\
\u2062", IOcy: "\u0401", iocy: "\u0451", Iogon: "\u012E", iogon: "\u012F", Iopf: "\u{1D540}", iopf: "\u{1D55A}", Iota: "\u0399", iota: "\u03B9",
  iprod: "\u2A3C", iquest: "\xBF", iscr: "\u{1D4BE}", Iscr: "\u2110", isin: "\u2208", isindot: "\u22F5", isinE: "\u22F9", isins: "\u22F4", isinsv: "\
\u22F3", isinv: "\u2208", it: "\u2062", Itilde: "\u0128", itilde: "\u0129", Iukcy: "\u0406", iukcy: "\u0456", Iuml: "\xCF", iuml: "\xEF", Jcirc: "\
\u0134", jcirc: "\u0135", Jcy: "\u0419", jcy: "\u0439", Jfr: "\u{1D50D}", jfr: "\u{1D527}", jmath: "\u0237", Jopf: "\u{1D541}", jopf: "\u{1D55B}",
  Jscr: "\u{1D4A5}", jscr: "\u{1D4BF}", Jsercy: "\u0408", jsercy: "\u0458", Jukcy: "\u0404", jukcy: "\u0454", Kappa: "\u039A", kappa: "\u03BA",
  kappav: "\u03F0", Kcedil: "\u0136", kcedil: "\u0137", Kcy: "\u041A", kcy: "\u043A", Kfr: "\u{1D50E}", kfr: "\u{1D528}", kgreen: "\u0138", KHcy: "\
\u0425", khcy: "\u0445", KJcy: "\u040C", kjcy: "\u045C", Kopf: "\u{1D542}", kopf: "\u{1D55C}", Kscr: "\u{1D4A6}", kscr: "\u{1D4C0}", lAarr: "\
\u21DA", Lacute: "\u0139", lacute: "\u013A", laemptyv: "\u29B4", lagran: "\u2112", Lambda: "\u039B", lambda: "\u03BB", lang: "\u27E8", Lang: "\
\u27EA", langd: "\u2991", langle: "\u27E8", lap: "\u2A85", Laplacetrf: "\u2112", laquo: "\xAB", larrb: "\u21E4", larrbfs: "\u291F", larr: "\u2190",
  Larr: "\u219E", lArr: "\u21D0", larrfs: "\u291D", larrhk: "\u21A9", larrlp: "\u21AB", larrpl: "\u2939", larrsim: "\u2973", larrtl: "\u21A2",
  latail: "\u2919", lAtail: "\u291B", lat: "\u2AAB", late: "\u2AAD", lates: "\u2AAD\uFE00", lbarr: "\u290C", lBarr: "\u290E", lbbrk: "\u2772",
  lbrace: "{", lbrack: "[", lbrke: "\u298B", lbrksld: "\u298F", lbrkslu: "\u298D", Lcaron: "\u013D", lcaron: "\u013E", Lcedil: "\u013B", lcedil: "\
\u013C", lceil: "\u2308", lcub: "{", Lcy: "\u041B", lcy: "\u043B", ldca: "\u2936", ldquo: "\u201C", ldquor: "\u201E", ldrdhar: "\u2967", ldrushar: "\
\u294B", ldsh: "\u21B2", le: "\u2264", lE: "\u2266", LeftAngleBracket: "\u27E8", LeftArrowBar: "\u21E4", leftarrow: "\u2190", LeftArrow: "\u2190",
  Leftarrow: "\u21D0", LeftArrowRightArrow: "\u21C6", leftarrowtail: "\u21A2", LeftCeiling: "\u2308", LeftDoubleBracket: "\u27E6", LeftDownTeeVector: "\
\u2961", LeftDownVectorBar: "\u2959", LeftDownVector: "\u21C3", LeftFloor: "\u230A", leftharpoondown: "\u21BD", leftharpoonup: "\u21BC", leftleftarrows: "\
\u21C7", leftrightarrow: "\u2194", LeftRightArrow: "\u2194", Leftrightarrow: "\u21D4", leftrightarrows: "\u21C6", leftrightharpoons: "\u21CB",
  leftrightsquigarrow: "\u21AD", LeftRightVector: "\u294E", LeftTeeArrow: "\u21A4", LeftTee: "\u22A3", LeftTeeVector: "\u295A", leftthreetimes: "\
\u22CB", LeftTriangleBar: "\u29CF", LeftTriangle: "\u22B2", LeftTriangleEqual: "\u22B4", LeftUpDownVector: "\u2951", LeftUpTeeVector: "\u2960",
  LeftUpVectorBar: "\u2958", LeftUpVector: "\u21BF", LeftVectorBar: "\u2952", LeftVector: "\u21BC", lEg: "\u2A8B", leg: "\u22DA", leq: "\u2264",
  leqq: "\u2266", leqslant: "\u2A7D", lescc: "\u2AA8", les: "\u2A7D", lesdot: "\u2A7F", lesdoto: "\u2A81", lesdotor: "\u2A83", lesg: "\u22DA\uFE00",
  lesges: "\u2A93", lessapprox: "\u2A85", lessdot: "\u22D6", lesseqgtr: "\u22DA", lesseqqgtr: "\u2A8B", LessEqualGreater: "\u22DA", LessFullEqual: "\
\u2266", LessGreater: "\u2276", lessgtr: "\u2276", LessLess: "\u2AA1", lesssim: "\u2272", LessSlantEqual: "\u2A7D", LessTilde: "\u2272", lfisht: "\
\u297C", lfloor: "\u230A", Lfr: "\u{1D50F}", lfr: "\u{1D529}", lg: "\u2276", lgE: "\u2A91", lHar: "\u2962", lhard: "\u21BD", lharu: "\u21BC",
  lharul: "\u296A", lhblk: "\u2584", LJcy: "\u0409", ljcy: "\u0459", llarr: "\u21C7", ll: "\u226A", Ll: "\u22D8", llcorner: "\u231E", Lleftarrow: "\
\u21DA", llhard: "\u296B", lltri: "\u25FA", Lmidot: "\u013F", lmidot: "\u0140", lmoustache: "\u23B0", lmoust: "\u23B0", lnap: "\u2A89", lnapprox: "\
\u2A89", lne: "\u2A87", lnE: "\u2268", lneq: "\u2A87", lneqq: "\u2268", lnsim: "\u22E6", loang: "\u27EC", loarr: "\u21FD", lobrk: "\u27E6", longleftarrow: "\
\u27F5", LongLeftArrow: "\u27F5", Longleftarrow: "\u27F8", longleftrightarrow: "\u27F7", LongLeftRightArrow: "\u27F7", Longleftrightarrow: "\
\u27FA", longmapsto: "\u27FC", longrightarrow: "\u27F6", LongRightArrow: "\u27F6", Longrightarrow: "\u27F9", looparrowleft: "\u21AB", looparrowright: "\
\u21AC", lopar: "\u2985", Lopf: "\u{1D543}", lopf: "\u{1D55D}", loplus: "\u2A2D", lotimes: "\u2A34", lowast: "\u2217", lowbar: "_", LowerLeftArrow: "\
\u2199", LowerRightArrow: "\u2198", loz: "\u25CA", lozenge: "\u25CA", lozf: "\u29EB", lpar: "(", lparlt: "\u2993", lrarr: "\u21C6", lrcorner: "\
\u231F", lrhar: "\u21CB", lrhard: "\u296D", lrm: "\u200E", lrtri: "\u22BF", lsaquo: "\u2039", lscr: "\u{1D4C1}", Lscr: "\u2112", lsh: "\u21B0",
  Lsh: "\u21B0", lsim: "\u2272", lsime: "\u2A8D", lsimg: "\u2A8F", lsqb: "[", lsquo: "\u2018", lsquor: "\u201A", Lstrok: "\u0141", lstrok: "\
\u0142", ltcc: "\u2AA6", ltcir: "\u2A79", lt: "<", LT: "<", Lt: "\u226A", ltdot: "\u22D6", lthree: "\u22CB", ltimes: "\u22C9", ltlarr: "\u2976",
  ltquest: "\u2A7B", ltri: "\u25C3", ltrie: "\u22B4", ltrif: "\u25C2", ltrPar: "\u2996", lurdshar: "\u294A", luruhar: "\u2966", lvertneqq: "\
\u2268\uFE00", lvnE: "\u2268\uFE00", macr: "\xAF", male: "\u2642", malt: "\u2720", maltese: "\u2720", Map: "\u2905", map: "\u21A6", mapsto: "\
\u21A6", mapstodown: "\u21A7", mapstoleft: "\u21A4", mapstoup: "\u21A5", marker: "\u25AE", mcomma: "\u2A29", Mcy: "\u041C", mcy: "\u043C", mdash: "\
\u2014", mDDot: "\u223A", measuredangle: "\u2221", MediumSpace: "\u205F", Mellintrf: "\u2133", Mfr: "\u{1D510}", mfr: "\u{1D52A}", mho: "\u2127",
  micro: "\xB5", midast: "*", midcir: "\u2AF0", mid: "\u2223", middot: "\xB7", minusb: "\u229F", minus: "\u2212", minusd: "\u2238", minusdu: "\
\u2A2A", MinusPlus: "\u2213", mlcp: "\u2ADB", mldr: "\u2026", mnplus: "\u2213", models: "\u22A7", Mopf: "\u{1D544}", mopf: "\u{1D55E}", mp: "\
\u2213", mscr: "\u{1D4C2}", Mscr: "\u2133", mstpos: "\u223E", Mu: "\u039C", mu: "\u03BC", multimap: "\u22B8", mumap: "\u22B8", nabla: "\u2207",
  Nacute: "\u0143", nacute: "\u0144", nang: "\u2220\u20D2", nap: "\u2249", napE: "\u2A70\u0338", napid: "\u224B\u0338", napos: "\u0149", napprox: "\
\u2249", natural: "\u266E", naturals: "\u2115", natur: "\u266E", nbsp: "\xA0", nbump: "\u224E\u0338", nbumpe: "\u224F\u0338", ncap: "\u2A43",
  Ncaron: "\u0147", ncaron: "\u0148", Ncedil: "\u0145", ncedil: "\u0146", ncong: "\u2247", ncongdot: "\u2A6D\u0338", ncup: "\u2A42", Ncy: "\u041D",
  ncy: "\u043D", ndash: "\u2013", nearhk: "\u2924", nearr: "\u2197", neArr: "\u21D7", nearrow: "\u2197", ne: "\u2260", nedot: "\u2250\u0338",
  NegativeMediumSpace: "\u200B", NegativeThickSpace: "\u200B", NegativeThinSpace: "\u200B", NegativeVeryThinSpace: "\u200B", nequiv: "\u2262",
  nesear: "\u2928", nesim: "\u2242\u0338", NestedGreaterGreater: "\u226B", NestedLessLess: "\u226A", NewLine: `
`, nexist: "\u2204", nexists: "\u2204", Nfr: "\u{1D511}", nfr: "\u{1D52B}", ngE: "\u2267\u0338", nge: "\u2271", ngeq: "\u2271", ngeqq: "\u2267\u0338",
  ngeqslant: "\u2A7E\u0338", nges: "\u2A7E\u0338", nGg: "\u22D9\u0338", ngsim: "\u2275", nGt: "\u226B\u20D2", ngt: "\u226F", ngtr: "\u226F",
  nGtv: "\u226B\u0338", nharr: "\u21AE", nhArr: "\u21CE", nhpar: "\u2AF2", ni: "\u220B", nis: "\u22FC", nisd: "\u22FA", niv: "\u220B", NJcy: "\
\u040A", njcy: "\u045A", nlarr: "\u219A", nlArr: "\u21CD", nldr: "\u2025", nlE: "\u2266\u0338", nle: "\u2270", nleftarrow: "\u219A", nLeftarrow: "\
\u21CD", nleftrightarrow: "\u21AE", nLeftrightarrow: "\u21CE", nleq: "\u2270", nleqq: "\u2266\u0338", nleqslant: "\u2A7D\u0338", nles: "\u2A7D\u0338",
  nless: "\u226E", nLl: "\u22D8\u0338", nlsim: "\u2274", nLt: "\u226A\u20D2", nlt: "\u226E", nltri: "\u22EA", nltrie: "\u22EC", nLtv: "\u226A\u0338",
  nmid: "\u2224", NoBreak: "\u2060", NonBreakingSpace: "\xA0", nopf: "\u{1D55F}", Nopf: "\u2115", Not: "\u2AEC", not: "\xAC", NotCongruent: "\
\u2262", NotCupCap: "\u226D", NotDoubleVerticalBar: "\u2226", NotElement: "\u2209", NotEqual: "\u2260", NotEqualTilde: "\u2242\u0338", NotExists: "\
\u2204", NotGreater: "\u226F", NotGreaterEqual: "\u2271", NotGreaterFullEqual: "\u2267\u0338", NotGreaterGreater: "\u226B\u0338", NotGreaterLess: "\
\u2279", NotGreaterSlantEqual: "\u2A7E\u0338", NotGreaterTilde: "\u2275", NotHumpDownHump: "\u224E\u0338", NotHumpEqual: "\u224F\u0338", notin: "\
\u2209", notindot: "\u22F5\u0338", notinE: "\u22F9\u0338", notinva: "\u2209", notinvb: "\u22F7", notinvc: "\u22F6", NotLeftTriangleBar: "\u29CF\u0338",
  NotLeftTriangle: "\u22EA", NotLeftTriangleEqual: "\u22EC", NotLess: "\u226E", NotLessEqual: "\u2270", NotLessGreater: "\u2278", NotLessLess: "\
\u226A\u0338", NotLessSlantEqual: "\u2A7D\u0338", NotLessTilde: "\u2274", NotNestedGreaterGreater: "\u2AA2\u0338", NotNestedLessLess: "\u2AA1\u0338",
  notni: "\u220C", notniva: "\u220C", notnivb: "\u22FE", notnivc: "\u22FD", NotPrecedes: "\u2280", NotPrecedesEqual: "\u2AAF\u0338", NotPrecedesSlantEqual: "\
\u22E0", NotReverseElement: "\u220C", NotRightTriangleBar: "\u29D0\u0338", NotRightTriangle: "\u22EB", NotRightTriangleEqual: "\u22ED", NotSquareSubset: "\
\u228F\u0338", NotSquareSubsetEqual: "\u22E2", NotSquareSuperset: "\u2290\u0338", NotSquareSupersetEqual: "\u22E3", NotSubset: "\u2282\u20D2",
  NotSubsetEqual: "\u2288", NotSucceeds: "\u2281", NotSucceedsEqual: "\u2AB0\u0338", NotSucceedsSlantEqual: "\u22E1", NotSucceedsTilde: "\u227F\u0338",
  NotSuperset: "\u2283\u20D2", NotSupersetEqual: "\u2289", NotTilde: "\u2241", NotTildeEqual: "\u2244", NotTildeFullEqual: "\u2247", NotTildeTilde: "\
\u2249", NotVerticalBar: "\u2224", nparallel: "\u2226", npar: "\u2226", nparsl: "\u2AFD\u20E5", npart: "\u2202\u0338", npolint: "\u2A14", npr: "\
\u2280", nprcue: "\u22E0", nprec: "\u2280", npreceq: "\u2AAF\u0338", npre: "\u2AAF\u0338", nrarrc: "\u2933\u0338", nrarr: "\u219B", nrArr: "\
\u21CF", nrarrw: "\u219D\u0338", nrightarrow: "\u219B", nRightarrow: "\u21CF", nrtri: "\u22EB", nrtrie: "\u22ED", nsc: "\u2281", nsccue: "\u22E1",
  nsce: "\u2AB0\u0338", Nscr: "\u{1D4A9}", nscr: "\u{1D4C3}", nshortmid: "\u2224", nshortparallel: "\u2226", nsim: "\u2241", nsime: "\u2244",
  nsimeq: "\u2244", nsmid: "\u2224", nspar: "\u2226", nsqsube: "\u22E2", nsqsupe: "\u22E3", nsub: "\u2284", nsubE: "\u2AC5\u0338", nsube: "\u2288",
  nsubset: "\u2282\u20D2", nsubseteq: "\u2288", nsubseteqq: "\u2AC5\u0338", nsucc: "\u2281", nsucceq: "\u2AB0\u0338", nsup: "\u2285", nsupE: "\
\u2AC6\u0338", nsupe: "\u2289", nsupset: "\u2283\u20D2", nsupseteq: "\u2289", nsupseteqq: "\u2AC6\u0338", ntgl: "\u2279", Ntilde: "\xD1", ntilde: "\
\xF1", ntlg: "\u2278", ntriangleleft: "\u22EA", ntrianglelefteq: "\u22EC", ntriangleright: "\u22EB", ntrianglerighteq: "\u22ED", Nu: "\u039D",
  nu: "\u03BD", num: "#", numero: "\u2116", numsp: "\u2007", nvap: "\u224D\u20D2", nvdash: "\u22AC", nvDash: "\u22AD", nVdash: "\u22AE", nVDash: "\
\u22AF", nvge: "\u2265\u20D2", nvgt: ">\u20D2", nvHarr: "\u2904", nvinfin: "\u29DE", nvlArr: "\u2902", nvle: "\u2264\u20D2", nvlt: "<\u20D2",
  nvltrie: "\u22B4\u20D2", nvrArr: "\u2903", nvrtrie: "\u22B5\u20D2", nvsim: "\u223C\u20D2", nwarhk: "\u2923", nwarr: "\u2196", nwArr: "\u21D6",
  nwarrow: "\u2196", nwnear: "\u2927", Oacute: "\xD3", oacute: "\xF3", oast: "\u229B", Ocirc: "\xD4", ocirc: "\xF4", ocir: "\u229A", Ocy: "\u041E",
  ocy: "\u043E", odash: "\u229D", Odblac: "\u0150", odblac: "\u0151", odiv: "\u2A38", odot: "\u2299", odsold: "\u29BC", OElig: "\u0152", oelig: "\
\u0153", ofcir: "\u29BF", Ofr: "\u{1D512}", ofr: "\u{1D52C}", ogon: "\u02DB", Ograve: "\xD2", ograve: "\xF2", ogt: "\u29C1", ohbar: "\u29B5",
  ohm: "\u03A9", oint: "\u222E", olarr: "\u21BA", olcir: "\u29BE", olcross: "\u29BB", oline: "\u203E", olt: "\u29C0", Omacr: "\u014C", omacr: "\
\u014D", Omega: "\u03A9", omega: "\u03C9", Omicron: "\u039F", omicron: "\u03BF", omid: "\u29B6", ominus: "\u2296", Oopf: "\u{1D546}", oopf: "\
\u{1D560}", opar: "\u29B7", OpenCurlyDoubleQuote: "\u201C", OpenCurlyQuote: "\u2018", operp: "\u29B9", oplus: "\u2295", orarr: "\u21BB", Or: "\
\u2A54", or: "\u2228", ord: "\u2A5D", order: "\u2134", orderof: "\u2134", ordf: "\xAA", ordm: "\xBA", origof: "\u22B6", oror: "\u2A56", orslope: "\
\u2A57", orv: "\u2A5B", oS: "\u24C8", Oscr: "\u{1D4AA}", oscr: "\u2134", Oslash: "\xD8", oslash: "\xF8", osol: "\u2298", Otilde: "\xD5", otilde: "\
\xF5", otimesas: "\u2A36", Otimes: "\u2A37", otimes: "\u2297", Ouml: "\xD6", ouml: "\xF6", ovbar: "\u233D", OverBar: "\u203E", OverBrace: "\u23DE",
  OverBracket: "\u23B4", OverParenthesis: "\u23DC", para: "\xB6", parallel: "\u2225", par: "\u2225", parsim: "\u2AF3", parsl: "\u2AFD", part: "\
\u2202", PartialD: "\u2202", Pcy: "\u041F", pcy: "\u043F", percnt: "%", period: ".", permil: "\u2030", perp: "\u22A5", pertenk: "\u2031", Pfr: "\
\u{1D513}", pfr: "\u{1D52D}", Phi: "\u03A6", phi: "\u03C6", phiv: "\u03D5", phmmat: "\u2133", phone: "\u260E", Pi: "\u03A0", pi: "\u03C0", pitchfork: "\
\u22D4", piv: "\u03D6", planck: "\u210F", planckh: "\u210E", plankv: "\u210F", plusacir: "\u2A23", plusb: "\u229E", pluscir: "\u2A22", plus: "\
+", plusdo: "\u2214", plusdu: "\u2A25", pluse: "\u2A72", PlusMinus: "\xB1", plusmn: "\xB1", plussim: "\u2A26", plustwo: "\u2A27", pm: "\xB1",
  Poincareplane: "\u210C", pointint: "\u2A15", popf: "\u{1D561}", Popf: "\u2119", pound: "\xA3", prap: "\u2AB7", Pr: "\u2ABB", pr: "\u227A",
  prcue: "\u227C", precapprox: "\u2AB7", prec: "\u227A", preccurlyeq: "\u227C", Precedes: "\u227A", PrecedesEqual: "\u2AAF", PrecedesSlantEqual: "\
\u227C", PrecedesTilde: "\u227E", preceq: "\u2AAF", precnapprox: "\u2AB9", precneqq: "\u2AB5", precnsim: "\u22E8", pre: "\u2AAF", prE: "\u2AB3",
  precsim: "\u227E", prime: "\u2032", Prime: "\u2033", primes: "\u2119", prnap: "\u2AB9", prnE: "\u2AB5", prnsim: "\u22E8", prod: "\u220F", Product: "\
\u220F", profalar: "\u232E", profline: "\u2312", profsurf: "\u2313", prop: "\u221D", Proportional: "\u221D", Proportion: "\u2237", propto: "\
\u221D", prsim: "\u227E", prurel: "\u22B0", Pscr: "\u{1D4AB}", pscr: "\u{1D4C5}", Psi: "\u03A8", psi: "\u03C8", puncsp: "\u2008", Qfr: "\u{1D514}",
  qfr: "\u{1D52E}", qint: "\u2A0C", qopf: "\u{1D562}", Qopf: "\u211A", qprime: "\u2057", Qscr: "\u{1D4AC}", qscr: "\u{1D4C6}", quaternions: "\
\u210D", quatint: "\u2A16", quest: "?", questeq: "\u225F", quot: '"', QUOT: '"', rAarr: "\u21DB", race: "\u223D\u0331", Racute: "\u0154", racute: "\
\u0155", radic: "\u221A", raemptyv: "\u29B3", rang: "\u27E9", Rang: "\u27EB", rangd: "\u2992", range: "\u29A5", rangle: "\u27E9", raquo: "\xBB",
  rarrap: "\u2975", rarrb: "\u21E5", rarrbfs: "\u2920", rarrc: "\u2933", rarr: "\u2192", Rarr: "\u21A0", rArr: "\u21D2", rarrfs: "\u291E", rarrhk: "\
\u21AA", rarrlp: "\u21AC", rarrpl: "\u2945", rarrsim: "\u2974", Rarrtl: "\u2916", rarrtl: "\u21A3", rarrw: "\u219D", ratail: "\u291A", rAtail: "\
\u291C", ratio: "\u2236", rationals: "\u211A", rbarr: "\u290D", rBarr: "\u290F", RBarr: "\u2910", rbbrk: "\u2773", rbrace: "}", rbrack: "]",
  rbrke: "\u298C", rbrksld: "\u298E", rbrkslu: "\u2990", Rcaron: "\u0158", rcaron: "\u0159", Rcedil: "\u0156", rcedil: "\u0157", rceil: "\u2309",
  rcub: "}", Rcy: "\u0420", rcy: "\u0440", rdca: "\u2937", rdldhar: "\u2969", rdquo: "\u201D", rdquor: "\u201D", rdsh: "\u21B3", real: "\u211C",
  realine: "\u211B", realpart: "\u211C", reals: "\u211D", Re: "\u211C", rect: "\u25AD", reg: "\xAE", REG: "\xAE", ReverseElement: "\u220B", ReverseEquilibrium: "\
\u21CB", ReverseUpEquilibrium: "\u296F", rfisht: "\u297D", rfloor: "\u230B", rfr: "\u{1D52F}", Rfr: "\u211C", rHar: "\u2964", rhard: "\u21C1",
  rharu: "\u21C0", rharul: "\u296C", Rho: "\u03A1", rho: "\u03C1", rhov: "\u03F1", RightAngleBracket: "\u27E9", RightArrowBar: "\u21E5", rightarrow: "\
\u2192", RightArrow: "\u2192", Rightarrow: "\u21D2", RightArrowLeftArrow: "\u21C4", rightarrowtail: "\u21A3", RightCeiling: "\u2309", RightDoubleBracket: "\
\u27E7", RightDownTeeVector: "\u295D", RightDownVectorBar: "\u2955", RightDownVector: "\u21C2", RightFloor: "\u230B", rightharpoondown: "\u21C1",
  rightharpoonup: "\u21C0", rightleftarrows: "\u21C4", rightleftharpoons: "\u21CC", rightrightarrows: "\u21C9", rightsquigarrow: "\u219D", RightTeeArrow: "\
\u21A6", RightTee: "\u22A2", RightTeeVector: "\u295B", rightthreetimes: "\u22CC", RightTriangleBar: "\u29D0", RightTriangle: "\u22B3", RightTriangleEqual: "\
\u22B5", RightUpDownVector: "\u294F", RightUpTeeVector: "\u295C", RightUpVectorBar: "\u2954", RightUpVector: "\u21BE", RightVectorBar: "\u2953",
  RightVector: "\u21C0", ring: "\u02DA", risingdotseq: "\u2253", rlarr: "\u21C4", rlhar: "\u21CC", rlm: "\u200F", rmoustache: "\u23B1", rmoust: "\
\u23B1", rnmid: "\u2AEE", roang: "\u27ED", roarr: "\u21FE", robrk: "\u27E7", ropar: "\u2986", ropf: "\u{1D563}", Ropf: "\u211D", roplus: "\u2A2E",
  rotimes: "\u2A35", RoundImplies: "\u2970", rpar: ")", rpargt: "\u2994", rppolint: "\u2A12", rrarr: "\u21C9", Rrightarrow: "\u21DB", rsaquo: "\
\u203A", rscr: "\u{1D4C7}", Rscr: "\u211B", rsh: "\u21B1", Rsh: "\u21B1", rsqb: "]", rsquo: "\u2019", rsquor: "\u2019", rthree: "\u22CC", rtimes: "\
\u22CA", rtri: "\u25B9", rtrie: "\u22B5", rtrif: "\u25B8", rtriltri: "\u29CE", RuleDelayed: "\u29F4", ruluhar: "\u2968", rx: "\u211E", Sacute: "\
\u015A", sacute: "\u015B", sbquo: "\u201A", scap: "\u2AB8", Scaron: "\u0160", scaron: "\u0161", Sc: "\u2ABC", sc: "\u227B", sccue: "\u227D",
  sce: "\u2AB0", scE: "\u2AB4", Scedil: "\u015E", scedil: "\u015F", Scirc: "\u015C", scirc: "\u015D", scnap: "\u2ABA", scnE: "\u2AB6", scnsim: "\
\u22E9", scpolint: "\u2A13", scsim: "\u227F", Scy: "\u0421", scy: "\u0441", sdotb: "\u22A1", sdot: "\u22C5", sdote: "\u2A66", searhk: "\u2925",
  searr: "\u2198", seArr: "\u21D8", searrow: "\u2198", sect: "\xA7", semi: ";", seswar: "\u2929", setminus: "\u2216", setmn: "\u2216", sext: "\
\u2736", Sfr: "\u{1D516}", sfr: "\u{1D530}", sfrown: "\u2322", sharp: "\u266F", SHCHcy: "\u0429", shchcy: "\u0449", SHcy: "\u0428", shcy: "\u0448",
  ShortDownArrow: "\u2193", ShortLeftArrow: "\u2190", shortmid: "\u2223", shortparallel: "\u2225", ShortRightArrow: "\u2192", ShortUpArrow: "\
\u2191", shy: "\xAD", Sigma: "\u03A3", sigma: "\u03C3", sigmaf: "\u03C2", sigmav: "\u03C2", sim: "\u223C", simdot: "\u2A6A", sime: "\u2243",
  simeq: "\u2243", simg: "\u2A9E", simgE: "\u2AA0", siml: "\u2A9D", simlE: "\u2A9F", simne: "\u2246", simplus: "\u2A24", simrarr: "\u2972", slarr: "\
\u2190", SmallCircle: "\u2218", smallsetminus: "\u2216", smashp: "\u2A33", smeparsl: "\u29E4", smid: "\u2223", smile: "\u2323", smt: "\u2AAA",
  smte: "\u2AAC", smtes: "\u2AAC\uFE00", SOFTcy: "\u042C", softcy: "\u044C", solbar: "\u233F", solb: "\u29C4", sol: "/", Sopf: "\u{1D54A}", sopf: "\
\u{1D564}", spades: "\u2660", spadesuit: "\u2660", spar: "\u2225", sqcap: "\u2293", sqcaps: "\u2293\uFE00", sqcup: "\u2294", sqcups: "\u2294\uFE00",
  Sqrt: "\u221A", sqsub: "\u228F", sqsube: "\u2291", sqsubset: "\u228F", sqsubseteq: "\u2291", sqsup: "\u2290", sqsupe: "\u2292", sqsupset: "\
\u2290", sqsupseteq: "\u2292", square: "\u25A1", Square: "\u25A1", SquareIntersection: "\u2293", SquareSubset: "\u228F", SquareSubsetEqual: "\
\u2291", SquareSuperset: "\u2290", SquareSupersetEqual: "\u2292", SquareUnion: "\u2294", squarf: "\u25AA", squ: "\u25A1", squf: "\u25AA", srarr: "\
\u2192", Sscr: "\u{1D4AE}", sscr: "\u{1D4C8}", ssetmn: "\u2216", ssmile: "\u2323", sstarf: "\u22C6", Star: "\u22C6", star: "\u2606", starf: "\
\u2605", straightepsilon: "\u03F5", straightphi: "\u03D5", strns: "\xAF", sub: "\u2282", Sub: "\u22D0", subdot: "\u2ABD", subE: "\u2AC5", sube: "\
\u2286", subedot: "\u2AC3", submult: "\u2AC1", subnE: "\u2ACB", subne: "\u228A", subplus: "\u2ABF", subrarr: "\u2979", subset: "\u2282", Subset: "\
\u22D0", subseteq: "\u2286", subseteqq: "\u2AC5", SubsetEqual: "\u2286", subsetneq: "\u228A", subsetneqq: "\u2ACB", subsim: "\u2AC7", subsub: "\
\u2AD5", subsup: "\u2AD3", succapprox: "\u2AB8", succ: "\u227B", succcurlyeq: "\u227D", Succeeds: "\u227B", SucceedsEqual: "\u2AB0", SucceedsSlantEqual: "\
\u227D", SucceedsTilde: "\u227F", succeq: "\u2AB0", succnapprox: "\u2ABA", succneqq: "\u2AB6", succnsim: "\u22E9", succsim: "\u227F", SuchThat: "\
\u220B", sum: "\u2211", Sum: "\u2211", sung: "\u266A", sup1: "\xB9", sup2: "\xB2", sup3: "\xB3", sup: "\u2283", Sup: "\u22D1", supdot: "\u2ABE",
  supdsub: "\u2AD8", supE: "\u2AC6", supe: "\u2287", supedot: "\u2AC4", Superset: "\u2283", SupersetEqual: "\u2287", suphsol: "\u27C9", suphsub: "\
\u2AD7", suplarr: "\u297B", supmult: "\u2AC2", supnE: "\u2ACC", supne: "\u228B", supplus: "\u2AC0", supset: "\u2283", Supset: "\u22D1", supseteq: "\
\u2287", supseteqq: "\u2AC6", supsetneq: "\u228B", supsetneqq: "\u2ACC", supsim: "\u2AC8", supsub: "\u2AD4", supsup: "\u2AD6", swarhk: "\u2926",
  swarr: "\u2199", swArr: "\u21D9", swarrow: "\u2199", swnwar: "\u292A", szlig: "\xDF", Tab: "	", target: "\u2316", Tau: "\u03A4", tau: "\u03C4",
  tbrk: "\u23B4", Tcaron: "\u0164", tcaron: "\u0165", Tcedil: "\u0162", tcedil: "\u0163", Tcy: "\u0422", tcy: "\u0442", tdot: "\u20DB", telrec: "\
\u2315", Tfr: "\u{1D517}", tfr: "\u{1D531}", there4: "\u2234", therefore: "\u2234", Therefore: "\u2234", Theta: "\u0398", theta: "\u03B8", thetasym: "\
\u03D1", thetav: "\u03D1", thickapprox: "\u2248", thicksim: "\u223C", ThickSpace: "\u205F\u200A", ThinSpace: "\u2009", thinsp: "\u2009", thkap: "\
\u2248", thksim: "\u223C", THORN: "\xDE", thorn: "\xFE", tilde: "\u02DC", Tilde: "\u223C", TildeEqual: "\u2243", TildeFullEqual: "\u2245", TildeTilde: "\
\u2248", timesbar: "\u2A31", timesb: "\u22A0", times: "\xD7", timesd: "\u2A30", tint: "\u222D", toea: "\u2928", topbot: "\u2336", topcir: "\u2AF1",
  top: "\u22A4", Topf: "\u{1D54B}", topf: "\u{1D565}", topfork: "\u2ADA", tosa: "\u2929", tprime: "\u2034", trade: "\u2122", TRADE: "\u2122",
  triangle: "\u25B5", triangledown: "\u25BF", triangleleft: "\u25C3", trianglelefteq: "\u22B4", triangleq: "\u225C", triangleright: "\u25B9",
  trianglerighteq: "\u22B5", tridot: "\u25EC", trie: "\u225C", triminus: "\u2A3A", TripleDot: "\u20DB", triplus: "\u2A39", trisb: "\u29CD", tritime: "\
\u2A3B", trpezium: "\u23E2", Tscr: "\u{1D4AF}", tscr: "\u{1D4C9}", TScy: "\u0426", tscy: "\u0446", TSHcy: "\u040B", tshcy: "\u045B", Tstrok: "\
\u0166", tstrok: "\u0167", twixt: "\u226C", twoheadleftarrow: "\u219E", twoheadrightarrow: "\u21A0", Uacute: "\xDA", uacute: "\xFA", uarr: "\
\u2191", Uarr: "\u219F", uArr: "\u21D1", Uarrocir: "\u2949", Ubrcy: "\u040E", ubrcy: "\u045E", Ubreve: "\u016C", ubreve: "\u016D", Ucirc: "\xDB",
  ucirc: "\xFB", Ucy: "\u0423", ucy: "\u0443", udarr: "\u21C5", Udblac: "\u0170", udblac: "\u0171", udhar: "\u296E", ufisht: "\u297E", Ufr: "\
\u{1D518}", ufr: "\u{1D532}", Ugrave: "\xD9", ugrave: "\xF9", uHar: "\u2963", uharl: "\u21BF", uharr: "\u21BE", uhblk: "\u2580", ulcorn: "\u231C",
  ulcorner: "\u231C", ulcrop: "\u230F", ultri: "\u25F8", Umacr: "\u016A", umacr: "\u016B", uml: "\xA8", UnderBar: "_", UnderBrace: "\u23DF",
  UnderBracket: "\u23B5", UnderParenthesis: "\u23DD", Union: "\u22C3", UnionPlus: "\u228E", Uogon: "\u0172", uogon: "\u0173", Uopf: "\u{1D54C}",
  uopf: "\u{1D566}", UpArrowBar: "\u2912", uparrow: "\u2191", UpArrow: "\u2191", Uparrow: "\u21D1", UpArrowDownArrow: "\u21C5", updownarrow: "\
\u2195", UpDownArrow: "\u2195", Updownarrow: "\u21D5", UpEquilibrium: "\u296E", upharpoonleft: "\u21BF", upharpoonright: "\u21BE", uplus: "\u228E",
  UpperLeftArrow: "\u2196", UpperRightArrow: "\u2197", upsi: "\u03C5", Upsi: "\u03D2", upsih: "\u03D2", Upsilon: "\u03A5", upsilon: "\u03C5",
  UpTeeArrow: "\u21A5", UpTee: "\u22A5", upuparrows: "\u21C8", urcorn: "\u231D", urcorner: "\u231D", urcrop: "\u230E", Uring: "\u016E", uring: "\
\u016F", urtri: "\u25F9", Uscr: "\u{1D4B0}", uscr: "\u{1D4CA}", utdot: "\u22F0", Utilde: "\u0168", utilde: "\u0169", utri: "\u25B5", utrif: "\
\u25B4", uuarr: "\u21C8", Uuml: "\xDC", uuml: "\xFC", uwangle: "\u29A7", vangrt: "\u299C", varepsilon: "\u03F5", varkappa: "\u03F0", varnothing: "\
\u2205", varphi: "\u03D5", varpi: "\u03D6", varpropto: "\u221D", varr: "\u2195", vArr: "\u21D5", varrho: "\u03F1", varsigma: "\u03C2", varsubsetneq: "\
\u228A\uFE00", varsubsetneqq: "\u2ACB\uFE00", varsupsetneq: "\u228B\uFE00", varsupsetneqq: "\u2ACC\uFE00", vartheta: "\u03D1", vartriangleleft: "\
\u22B2", vartriangleright: "\u22B3", vBar: "\u2AE8", Vbar: "\u2AEB", vBarv: "\u2AE9", Vcy: "\u0412", vcy: "\u0432", vdash: "\u22A2", vDash: "\
\u22A8", Vdash: "\u22A9", VDash: "\u22AB", Vdashl: "\u2AE6", veebar: "\u22BB", vee: "\u2228", Vee: "\u22C1", veeeq: "\u225A", vellip: "\u22EE",
  verbar: "|", Verbar: "\u2016", vert: "|", Vert: "\u2016", VerticalBar: "\u2223", VerticalLine: "|", VerticalSeparator: "\u2758", VerticalTilde: "\
\u2240", VeryThinSpace: "\u200A", Vfr: "\u{1D519}", vfr: "\u{1D533}", vltri: "\u22B2", vnsub: "\u2282\u20D2", vnsup: "\u2283\u20D2", Vopf: "\
\u{1D54D}", vopf: "\u{1D567}", vprop: "\u221D", vrtri: "\u22B3", Vscr: "\u{1D4B1}", vscr: "\u{1D4CB}", vsubnE: "\u2ACB\uFE00", vsubne: "\u228A\uFE00",
  vsupnE: "\u2ACC\uFE00", vsupne: "\u228B\uFE00", Vvdash: "\u22AA", vzigzag: "\u299A", Wcirc: "\u0174", wcirc: "\u0175", wedbar: "\u2A5F", wedge: "\
\u2227", Wedge: "\u22C0", wedgeq: "\u2259", weierp: "\u2118", Wfr: "\u{1D51A}", wfr: "\u{1D534}", Wopf: "\u{1D54E}", wopf: "\u{1D568}", wp: "\
\u2118", wr: "\u2240", wreath: "\u2240", Wscr: "\u{1D4B2}", wscr: "\u{1D4CC}", xcap: "\u22C2", xcirc: "\u25EF", xcup: "\u22C3", xdtri: "\u25BD",
  Xfr: "\u{1D51B}", xfr: "\u{1D535}", xharr: "\u27F7", xhArr: "\u27FA", Xi: "\u039E", xi: "\u03BE", xlarr: "\u27F5", xlArr: "\u27F8", xmap: "\
\u27FC", xnis: "\u22FB", xodot: "\u2A00", Xopf: "\u{1D54F}", xopf: "\u{1D569}", xoplus: "\u2A01", xotime: "\u2A02", xrarr: "\u27F6", xrArr: "\
\u27F9", Xscr: "\u{1D4B3}", xscr: "\u{1D4CD}", xsqcup: "\u2A06", xuplus: "\u2A04", xutri: "\u25B3", xvee: "\u22C1", xwedge: "\u22C0", Yacute: "\
\xDD", yacute: "\xFD", YAcy: "\u042F", yacy: "\u044F", Ycirc: "\u0176", ycirc: "\u0177", Ycy: "\u042B", ycy: "\u044B", yen: "\xA5", Yfr: "\u{1D51C}",
  yfr: "\u{1D536}", YIcy: "\u0407", yicy: "\u0457", Yopf: "\u{1D550}", yopf: "\u{1D56A}", Yscr: "\u{1D4B4}", yscr: "\u{1D4CE}", YUcy: "\u042E",
  yucy: "\u044E", yuml: "\xFF", Yuml: "\u0178", Zacute: "\u0179", zacute: "\u017A", Zcaron: "\u017D", zcaron: "\u017E", Zcy: "\u0417", zcy: "\
\u0437", Zdot: "\u017B", zdot: "\u017C", zeetrf: "\u2128", ZeroWidthSpace: "\u200B", Zeta: "\u0396", zeta: "\u03B6", zfr: "\u{1D537}", Zfr: "\
\u2128", ZHcy: "\u0416", zhcy: "\u0436", zigrarr: "\u21DD", zopf: "\u{1D56B}", Zopf: "\u2124", Zscr: "\u{1D4B5}", zscr: "\u{1D4CF}", zwj: "\u200D",
  zwnj: "\u200C" };
});

// ../node_modules/entities/lib/maps/legacy.json
var on = I((Tf, Na) => {
  Na.exports = { Aacute: "\xC1", aacute: "\xE1", Acirc: "\xC2", acirc: "\xE2", acute: "\xB4", AElig: "\xC6", aelig: "\xE6", Agrave: "\xC0", agrave: "\
\xE0", amp: "&", AMP: "&", Aring: "\xC5", aring: "\xE5", Atilde: "\xC3", atilde: "\xE3", Auml: "\xC4", auml: "\xE4", brvbar: "\xA6", Ccedil: "\
\xC7", ccedil: "\xE7", cedil: "\xB8", cent: "\xA2", copy: "\xA9", COPY: "\xA9", curren: "\xA4", deg: "\xB0", divide: "\xF7", Eacute: "\xC9",
  eacute: "\xE9", Ecirc: "\xCA", ecirc: "\xEA", Egrave: "\xC8", egrave: "\xE8", ETH: "\xD0", eth: "\xF0", Euml: "\xCB", euml: "\xEB", frac12: "\
\xBD", frac14: "\xBC", frac34: "\xBE", gt: ">", GT: ">", Iacute: "\xCD", iacute: "\xED", Icirc: "\xCE", icirc: "\xEE", iexcl: "\xA1", Igrave: "\
\xCC", igrave: "\xEC", iquest: "\xBF", Iuml: "\xCF", iuml: "\xEF", laquo: "\xAB", lt: "<", LT: "<", macr: "\xAF", micro: "\xB5", middot: "\xB7",
  nbsp: "\xA0", not: "\xAC", Ntilde: "\xD1", ntilde: "\xF1", Oacute: "\xD3", oacute: "\xF3", Ocirc: "\xD4", ocirc: "\xF4", Ograve: "\xD2", ograve: "\
\xF2", ordf: "\xAA", ordm: "\xBA", Oslash: "\xD8", oslash: "\xF8", Otilde: "\xD5", otilde: "\xF5", Ouml: "\xD6", ouml: "\xF6", para: "\xB6",
  plusmn: "\xB1", pound: "\xA3", quot: '"', QUOT: '"', raquo: "\xBB", reg: "\xAE", REG: "\xAE", sect: "\xA7", shy: "\xAD", sup1: "\xB9", sup2: "\
\xB2", sup3: "\xB3", szlig: "\xDF", THORN: "\xDE", thorn: "\xFE", times: "\xD7", Uacute: "\xDA", uacute: "\xFA", Ucirc: "\xDB", ucirc: "\xFB",
  Ugrave: "\xD9", ugrave: "\xF9", uml: "\xA8", Uuml: "\xDC", uuml: "\xFC", Yacute: "\xDD", yacute: "\xFD", yen: "\xA5", yuml: "\xFF" };
});

// ../node_modules/entities/lib/maps/xml.json
var ht = I((xf, La) => {
  La.exports = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };
});

// ../node_modules/entities/lib/maps/decode.json
var nn = I((Rf, qa) => {
  qa.exports = { "0": 65533, "128": 8364, "130": 8218, "131": 402, "132": 8222, "133": 8230, "134": 8224, "135": 8225, "136": 710, "137": 8240,
  "138": 352, "139": 8249, "140": 338, "142": 381, "145": 8216, "146": 8217, "147": 8220, "148": 8221, "149": 8226, "150": 8211, "151": 8212,
  "152": 732, "153": 8482, "154": 353, "155": 8250, "156": 339, "158": 382, "159": 376 };
});

// ../node_modules/entities/lib/decode_codepoint.js
var an = I((ze) => {
  "use strict";
  var za = ze && ze.__importDefault || function(r) {
    return r && r.__esModule ? r : { default: r };
  };
  Object.defineProperty(ze, "__esModule", { value: !0 });
  var sn = za(nn()), Ba = (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    String.fromCodePoint || function(r) {
      var e = "";
      return r > 65535 && (r -= 65536, e += String.fromCharCode(r >>> 10 & 1023 | 55296), r = 56320 | r & 1023), e += String.fromCharCode(r),
      e;
    }
  );
  function Ga(r) {
    return r >= 55296 && r <= 57343 || r > 1114111 ? "\uFFFD" : (r in sn.default && (r = sn.default[r]), Ba(r));
  }
  n(Ga, "decodeCodePoint");
  ze.default = Ga;
});

// ../node_modules/entities/lib/decode.js
var bt = I((H) => {
  "use strict";
  var cr = H && H.__importDefault || function(r) {
    return r && r.__esModule ? r : { default: r };
  };
  Object.defineProperty(H, "__esModule", { value: !0 });
  H.decodeHTML = H.decodeHTMLStrict = H.decodeXML = void 0;
  var gt = cr(mt()), Ua = cr(on()), Ha = cr(ht()), ln = cr(an()), Va = /&(?:[a-zA-Z0-9]+|#[xX][\da-fA-F]+|#\d+);/g;
  H.decodeXML = dn(Ha.default);
  H.decodeHTMLStrict = dn(gt.default);
  function dn(r) {
    var e = pn(r);
    return function(t) {
      return String(t).replace(Va, e);
    };
  }
  n(dn, "getStrictDecoder");
  var cn = /* @__PURE__ */ n(function(r, e) {
    return r < e ? 1 : -1;
  }, "sorter");
  H.decodeHTML = function() {
    for (var r = Object.keys(Ua.default).sort(cn), e = Object.keys(gt.default).sort(cn), t = 0, o = 0; t < e.length; t++)
      r[o] === e[t] ? (e[t] += ";?", o++) : e[t] += ";";
    var s = new RegExp("&(?:" + e.join("|") + "|#[xX][\\da-fA-F]+;?|#\\d+;?)", "g"), i = pn(gt.default);
    function a(l) {
      return l.substr(-1) !== ";" && (l += ";"), i(l);
    }
    return n(a, "replacer"), function(l) {
      return String(l).replace(s, a);
    };
  }();
  function pn(r) {
    return /* @__PURE__ */ n(function(t) {
      if (t.charAt(1) === "#") {
        var o = t.charAt(2);
        return o === "X" || o === "x" ? ln.default(parseInt(t.substr(3), 16)) : ln.default(parseInt(t.substr(2), 10));
      }
      return r[t.slice(1, -1)] || t;
    }, "replace");
  }
  n(pn, "getReplacer");
});

// ../node_modules/entities/lib/encode.js
var Tt = I((M) => {
  "use strict";
  var un = M && M.__importDefault || function(r) {
    return r && r.__esModule ? r : { default: r };
  };
  Object.defineProperty(M, "__esModule", { value: !0 });
  M.escapeUTF8 = M.escape = M.encodeNonAsciiHTML = M.encodeHTML = M.encodeXML = void 0;
  var Wa = un(ht()), fn = mn(Wa.default), yn = hn(fn);
  M.encodeXML = Sn(fn);
  var $a = un(mt()), St = mn($a.default), Ya = hn(St);
  M.encodeHTML = Xa(St, Ya);
  M.encodeNonAsciiHTML = Sn(St);
  function mn(r) {
    return Object.keys(r).sort().reduce(function(e, t) {
      return e[r[t]] = "&" + t + ";", e;
    }, {});
  }
  n(mn, "getInverseObj");
  function hn(r) {
    for (var e = [], t = [], o = 0, s = Object.keys(r); o < s.length; o++) {
      var i = s[o];
      i.length === 1 ? e.push("\\" + i) : t.push(i);
    }
    e.sort();
    for (var a = 0; a < e.length - 1; a++) {
      for (var l = a; l < e.length - 1 && e[l].charCodeAt(1) + 1 === e[l + 1].charCodeAt(1); )
        l += 1;
      var c = 1 + l - a;
      c < 3 || e.splice(a, c, e[a] + "-" + e[l]);
    }
    return t.unshift("[" + e.join("") + "]"), new RegExp(t.join("|"), "g");
  }
  n(hn, "getInverseReplacer");
  var gn = /(?:[\x80-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/g,
  Ka = (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    String.prototype.codePointAt != null ? (
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      function(r) {
        return r.codePointAt(0);
      }
    ) : (
      // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      function(r) {
        return (r.charCodeAt(0) - 55296) * 1024 + r.charCodeAt(1) - 56320 + 65536;
      }
    )
  );
  function dr(r) {
    return "&#x" + (r.length > 1 ? Ka(r) : r.charCodeAt(0)).toString(16).toUpperCase() + ";";
  }
  n(dr, "singleCharReplacer");
  function Xa(r, e) {
    return function(t) {
      return t.replace(e, function(o) {
        return r[o];
      }).replace(gn, dr);
    };
  }
  n(Xa, "getInverse");
  var bn = new RegExp(yn.source + "|" + gn.source, "g");
  function Ja(r) {
    return r.replace(bn, dr);
  }
  n(Ja, "escape");
  M.escape = Ja;
  function Qa(r) {
    return r.replace(yn, dr);
  }
  n(Qa, "escapeUTF8");
  M.escapeUTF8 = Qa;
  function Sn(r) {
    return function(e) {
      return e.replace(bn, function(t) {
        return r[t] || dr(t);
      });
    };
  }
  n(Sn, "getASCIIEncoder");
});

// ../node_modules/entities/lib/index.js
var xn = I((A) => {
  "use strict";
  Object.defineProperty(A, "__esModule", { value: !0 });
  A.decodeXMLStrict = A.decodeHTML5Strict = A.decodeHTML4Strict = A.decodeHTML5 = A.decodeHTML4 = A.decodeHTMLStrict = A.decodeHTML = A.decodeXML =
  A.encodeHTML5 = A.encodeHTML4 = A.escapeUTF8 = A.escape = A.encodeNonAsciiHTML = A.encodeHTML = A.encodeXML = A.encode = A.decodeStrict = A.
  decode = void 0;
  var pr = bt(), Tn = Tt();
  function Za(r, e) {
    return (!e || e <= 0 ? pr.decodeXML : pr.decodeHTML)(r);
  }
  n(Za, "decode");
  A.decode = Za;
  function el(r, e) {
    return (!e || e <= 0 ? pr.decodeXML : pr.decodeHTMLStrict)(r);
  }
  n(el, "decodeStrict");
  A.decodeStrict = el;
  function rl(r, e) {
    return (!e || e <= 0 ? Tn.encodeXML : Tn.encodeHTML)(r);
  }
  n(rl, "encode");
  A.encode = rl;
  var ce = Tt();
  Object.defineProperty(A, "encodeXML", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ce.encodeXML;
  }, "get") });
  Object.defineProperty(A, "encodeHTML", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ce.encodeHTML;
  }, "get") });
  Object.defineProperty(A, "encodeNonAsciiHTML", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ce.encodeNonAsciiHTML;
  }, "get") });
  Object.defineProperty(A, "escape", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ce.escape;
  }, "get") });
  Object.defineProperty(A, "escapeUTF8", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ce.escapeUTF8;
  }, "get") });
  Object.defineProperty(A, "encodeHTML4", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ce.encodeHTML;
  }, "get") });
  Object.defineProperty(A, "encodeHTML5", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ce.encodeHTML;
  }, "get") });
  var ee = bt();
  Object.defineProperty(A, "decodeXML", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ee.decodeXML;
  }, "get") });
  Object.defineProperty(A, "decodeHTML", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ee.decodeHTML;
  }, "get") });
  Object.defineProperty(A, "decodeHTMLStrict", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ee.decodeHTMLStrict;
  }, "get") });
  Object.defineProperty(A, "decodeHTML4", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ee.decodeHTML;
  }, "get") });
  Object.defineProperty(A, "decodeHTML5", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ee.decodeHTML;
  }, "get") });
  Object.defineProperty(A, "decodeHTML4Strict", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ee.decodeHTMLStrict;
  }, "get") });
  Object.defineProperty(A, "decodeHTML5Strict", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ee.decodeHTMLStrict;
  }, "get") });
  Object.defineProperty(A, "decodeXMLStrict", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ee.decodeXML;
  }, "get") });
});

// ../node_modules/ansi-to-html/lib/ansi_to_html.js
var Dn = I((Of, On) => {
  "use strict";
  function tl(r, e) {
    if (!(r instanceof e))
      throw new TypeError("Cannot call a class as a function");
  }
  n(tl, "_classCallCheck");
  function Rn(r, e) {
    for (var t = 0; t < e.length; t++) {
      var o = e[t];
      o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(r, o.key, o);
    }
  }
  n(Rn, "_defineProperties");
  function ol(r, e, t) {
    return e && Rn(r.prototype, e), t && Rn(r, t), r;
  }
  n(ol, "_createClass");
  function Pn(r, e) {
    var t = typeof Symbol < "u" && r[Symbol.iterator] || r["@@iterator"];
    if (!t) {
      if (Array.isArray(r) || (t = nl(r)) || e && r && typeof r.length == "number") {
        t && (r = t);
        var o = 0, s = /* @__PURE__ */ n(function() {
        }, "F");
        return { s, n: /* @__PURE__ */ n(function() {
          return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] };
        }, "n"), e: /* @__PURE__ */ n(function(d) {
          throw d;
        }, "e"), f: s };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var i = !0, a = !1, l;
    return { s: /* @__PURE__ */ n(function() {
      t = t.call(r);
    }, "s"), n: /* @__PURE__ */ n(function() {
      var d = t.next();
      return i = d.done, d;
    }, "n"), e: /* @__PURE__ */ n(function(d) {
      a = !0, l = d;
    }, "e"), f: /* @__PURE__ */ n(function() {
      try {
        !i && t.return != null && t.return();
      } finally {
        if (a) throw l;
      }
    }, "f") };
  }
  n(Pn, "_createForOfIteratorHelper");
  function nl(r, e) {
    if (r) {
      if (typeof r == "string") return wn(r, e);
      var t = Object.prototype.toString.call(r).slice(8, -1);
      if (t === "Object" && r.constructor && (t = r.constructor.name), t === "Map" || t === "Set") return Array.from(r);
      if (t === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t)) return wn(r, e);
    }
  }
  n(nl, "_unsupportedIterableToArray");
  function wn(r, e) {
    (e == null || e > r.length) && (e = r.length);
    for (var t = 0, o = new Array(e); t < e; t++)
      o[t] = r[t];
    return o;
  }
  n(wn, "_arrayLikeToArray");
  var sl = xn(), An = {
    fg: "#FFF",
    bg: "#000",
    newline: !1,
    escapeXML: !1,
    stream: !1,
    colors: il()
  };
  function il() {
    var r = {
      0: "#000",
      1: "#A00",
      2: "#0A0",
      3: "#A50",
      4: "#00A",
      5: "#A0A",
      6: "#0AA",
      7: "#AAA",
      8: "#555",
      9: "#F55",
      10: "#5F5",
      11: "#FF5",
      12: "#55F",
      13: "#F5F",
      14: "#5FF",
      15: "#FFF"
    };
    return ur(0, 5).forEach(function(e) {
      ur(0, 5).forEach(function(t) {
        ur(0, 5).forEach(function(o) {
          return al(e, t, o, r);
        });
      });
    }), ur(0, 23).forEach(function(e) {
      var t = e + 232, o = Fn(e * 10 + 8);
      r[t] = "#" + o + o + o;
    }), r;
  }
  n(il, "getDefaultColors");
  function al(r, e, t, o) {
    var s = 16 + r * 36 + e * 6 + t, i = r > 0 ? r * 40 + 55 : 0, a = e > 0 ? e * 40 + 55 : 0, l = t > 0 ? t * 40 + 55 : 0;
    o[s] = ll([i, a, l]);
  }
  n(al, "setStyleColor");
  function Fn(r) {
    for (var e = r.toString(16); e.length < 2; )
      e = "0" + e;
    return e;
  }
  n(Fn, "toHexString");
  function ll(r) {
    var e = [], t = Pn(r), o;
    try {
      for (t.s(); !(o = t.n()).done; ) {
        var s = o.value;
        e.push(Fn(s));
      }
    } catch (i) {
      t.e(i);
    } finally {
      t.f();
    }
    return "#" + e.join("");
  }
  n(ll, "toColorHexString");
  function En(r, e, t, o) {
    var s;
    return e === "text" ? s = ul(t, o) : e === "display" ? s = dl(r, t, o) : e === "xterm256Foreground" ? s = yr(r, o.colors[t]) : e === "xt\
erm256Background" ? s = mr(r, o.colors[t]) : e === "rgb" && (s = cl(r, t)), s;
  }
  n(En, "generateOutput");
  function cl(r, e) {
    e = e.substring(2).slice(0, -1);
    var t = +e.substr(0, 2), o = e.substring(5).split(";"), s = o.map(function(i) {
      return ("0" + Number(i).toString(16)).substr(-2);
    }).join("");
    return fr(r, (t === 38 ? "color:#" : "background-color:#") + s);
  }
  n(cl, "handleRgb");
  function dl(r, e, t) {
    e = parseInt(e, 10);
    var o = {
      "-1": /* @__PURE__ */ n(function() {
        return "<br/>";
      }, "_"),
      0: /* @__PURE__ */ n(function() {
        return r.length && In(r);
      }, "_"),
      1: /* @__PURE__ */ n(function() {
        return re(r, "b");
      }, "_"),
      3: /* @__PURE__ */ n(function() {
        return re(r, "i");
      }, "_"),
      4: /* @__PURE__ */ n(function() {
        return re(r, "u");
      }, "_"),
      8: /* @__PURE__ */ n(function() {
        return fr(r, "display:none");
      }, "_"),
      9: /* @__PURE__ */ n(function() {
        return re(r, "strike");
      }, "_"),
      22: /* @__PURE__ */ n(function() {
        return fr(r, "font-weight:normal;text-decoration:none;font-style:normal");
      }, "_"),
      23: /* @__PURE__ */ n(function() {
        return vn(r, "i");
      }, "_"),
      24: /* @__PURE__ */ n(function() {
        return vn(r, "u");
      }, "_"),
      39: /* @__PURE__ */ n(function() {
        return yr(r, t.fg);
      }, "_"),
      49: /* @__PURE__ */ n(function() {
        return mr(r, t.bg);
      }, "_"),
      53: /* @__PURE__ */ n(function() {
        return fr(r, "text-decoration:overline");
      }, "_")
    }, s;
    return o[e] ? s = o[e]() : 4 < e && e < 7 ? s = re(r, "blink") : 29 < e && e < 38 ? s = yr(r, t.colors[e - 30]) : 39 < e && e < 48 ? s =
    mr(r, t.colors[e - 40]) : 89 < e && e < 98 ? s = yr(r, t.colors[8 + (e - 90)]) : 99 < e && e < 108 && (s = mr(r, t.colors[8 + (e - 100)])),
    s;
  }
  n(dl, "handleDisplay");
  function In(r) {
    var e = r.slice(0);
    return r.length = 0, e.reverse().map(function(t) {
      return "</" + t + ">";
    }).join("");
  }
  n(In, "resetStyles");
  function ur(r, e) {
    for (var t = [], o = r; o <= e; o++)
      t.push(o);
    return t;
  }
  n(ur, "range");
  function pl(r) {
    return function(e) {
      return (r === null || e.category !== r) && r !== "all";
    };
  }
  n(pl, "notCategory");
  function Cn(r) {
    r = parseInt(r, 10);
    var e = null;
    return r === 0 ? e = "all" : r === 1 ? e = "bold" : 2 < r && r < 5 ? e = "underline" : 4 < r && r < 7 ? e = "blink" : r === 8 ? e = "hid\
e" : r === 9 ? e = "strike" : 29 < r && r < 38 || r === 39 || 89 < r && r < 98 ? e = "foreground-color" : (39 < r && r < 48 || r === 49 || 99 <
    r && r < 108) && (e = "background-color"), e;
  }
  n(Cn, "categoryForCode");
  function ul(r, e) {
    return e.escapeXML ? sl.encodeXML(r) : r;
  }
  n(ul, "pushText");
  function re(r, e, t) {
    return t || (t = ""), r.push(e), "<".concat(e).concat(t ? ' style="'.concat(t, '"') : "", ">");
  }
  n(re, "pushTag");
  function fr(r, e) {
    return re(r, "span", e);
  }
  n(fr, "pushStyle");
  function yr(r, e) {
    return re(r, "span", "color:" + e);
  }
  n(yr, "pushForegroundColor");
  function mr(r, e) {
    return re(r, "span", "background-color:" + e);
  }
  n(mr, "pushBackgroundColor");
  function vn(r, e) {
    var t;
    if (r.slice(-1)[0] === e && (t = r.pop()), t)
      return "</" + e + ">";
  }
  n(vn, "closeTag");
  function fl(r, e, t) {
    var o = !1, s = 3;
    function i() {
      return "";
    }
    n(i, "remove");
    function a(R, w) {
      return t("xterm256Foreground", w), "";
    }
    n(a, "removeXterm256Foreground");
    function l(R, w) {
      return t("xterm256Background", w), "";
    }
    n(l, "removeXterm256Background");
    function c(R) {
      return e.newline ? t("display", -1) : t("text", R), "";
    }
    n(c, "newline");
    function d(R, w) {
      o = !0, w.trim().length === 0 && (w = "0"), w = w.trimRight(";").split(";");
      var E = Pn(w), D;
      try {
        for (E.s(); !(D = E.n()).done; ) {
          var k = D.value;
          t("display", k);
        }
      } catch (L) {
        E.e(L);
      } finally {
        E.f();
      }
      return "";
    }
    n(d, "ansiMess");
    function p(R) {
      return t("text", R), "";
    }
    n(p, "realText");
    function u(R) {
      return t("rgb", R), "";
    }
    n(u, "rgb");
    var y = [{
      pattern: /^\x08+/,
      sub: i
    }, {
      pattern: /^\x1b\[[012]?K/,
      sub: i
    }, {
      pattern: /^\x1b\[\(B/,
      sub: i
    }, {
      pattern: /^\x1b\[[34]8;2;\d+;\d+;\d+m/,
      sub: u
    }, {
      pattern: /^\x1b\[38;5;(\d+)m/,
      sub: a
    }, {
      pattern: /^\x1b\[48;5;(\d+)m/,
      sub: l
    }, {
      pattern: /^\n/,
      sub: c
    }, {
      pattern: /^\r+\n/,
      sub: c
    }, {
      pattern: /^\r/,
      sub: c
    }, {
      pattern: /^\x1b\[((?:\d{1,3};?)+|)m/,
      sub: d
    }, {
      // CSI n J
      // ED - Erase in Display Clears part of the screen.
      // If n is 0 (or missing), clear from cursor to end of screen.
      // If n is 1, clear from cursor to beginning of the screen.
      // If n is 2, clear entire screen (and moves cursor to upper left on DOS ANSI.SYS).
      // If n is 3, clear entire screen and delete all lines saved in the scrollback buffer
      //   (this feature was added for xterm and is supported by other terminal applications).
      pattern: /^\x1b\[\d?J/,
      sub: i
    }, {
      // CSI n ; m f
      // HVP - Horizontal Vertical Position Same as CUP
      pattern: /^\x1b\[\d{0,3};\d{0,3}f/,
      sub: i
    }, {
      // catch-all for CSI sequences?
      pattern: /^\x1b\[?[\d;]{0,3}/,
      sub: i
    }, {
      /**
       * extracts real text - not containing:
       * - `\x1b' - ESC - escape (Ascii 27)
       * - '\x08' - BS - backspace (Ascii 8)
       * - `\n` - Newline - linefeed (LF) (ascii 10)
       * - `\r` - Windows Carriage Return (CR)
       */
      pattern: /^(([^\x1b\x08\r\n])+)/,
      sub: p
    }];
    function h(R, w) {
      w > s && o || (o = !1, r = r.replace(R.pattern, R.sub));
    }
    n(h, "process");
    var g = [], b = r, m = b.length;
    e: for (; m > 0; ) {
      for (var T = 0, x = 0, f = y.length; x < f; T = ++x) {
        var S = y[T];
        if (h(S, T), r.length !== m) {
          m = r.length;
          continue e;
        }
      }
      if (r.length === m)
        break;
      g.push(0), m = r.length;
    }
    return g;
  }
  n(fl, "tokenize");
  function yl(r, e, t) {
    return e !== "text" && (r = r.filter(pl(Cn(t))), r.push({
      token: e,
      data: t,
      category: Cn(t)
    })), r;
  }
  n(yl, "updateStickyStack");
  var ml = /* @__PURE__ */ function() {
    function r(e) {
      tl(this, r), e = e || {}, e.colors && (e.colors = Object.assign({}, An.colors, e.colors)), this.options = Object.assign({}, An, e), this.
      stack = [], this.stickyStack = [];
    }
    return n(r, "Filter"), ol(r, [{
      key: "toHtml",
      value: /* @__PURE__ */ n(function(t) {
        var o = this;
        t = typeof t == "string" ? [t] : t;
        var s = this.stack, i = this.options, a = [];
        return this.stickyStack.forEach(function(l) {
          var c = En(s, l.token, l.data, i);
          c && a.push(c);
        }), fl(t.join(""), i, function(l, c) {
          var d = En(s, l, c, i);
          d && a.push(d), i.stream && (o.stickyStack = yl(o.stickyStack, l, c));
        }), s.length && a.push(In(s)), a.join("");
      }, "toHtml")
    }]), r;
  }();
  On.exports = ml;
});

// src/preview-api/modules/addons/main.ts
import { global as Tr } from "@storybook/global";

// src/preview-api/modules/addons/storybook-channel-mock.ts
import { Channel as Xn } from "storybook/internal/channels";
function Sr() {
  let r = {
    setHandler: /* @__PURE__ */ n(() => {
    }, "setHandler"),
    send: /* @__PURE__ */ n(() => {
    }, "send")
  };
  return new Xn({ transport: r });
}
n(Sr, "mockChannel");

// src/preview-api/modules/addons/main.ts
var wr = class wr {
  constructor() {
    this.getChannel = /* @__PURE__ */ n(() => {
      if (!this.channel) {
        let e = Sr();
        return this.setChannel(e), e;
      }
      return this.channel;
    }, "getChannel");
    this.ready = /* @__PURE__ */ n(() => this.promise, "ready");
    this.hasChannel = /* @__PURE__ */ n(() => !!this.channel, "hasChannel");
    this.setChannel = /* @__PURE__ */ n((e) => {
      this.channel = e, this.resolve();
    }, "setChannel");
    this.promise = new Promise((e) => {
      this.resolve = () => e(this.getChannel());
    });
  }
};
n(wr, "AddonStore");
var Rr = wr, xr = "__STORYBOOK_ADDONS_PREVIEW";
function Jn() {
  return Tr[xr] || (Tr[xr] = new Rr()), Tr[xr];
}
n(Jn, "getAddonsStore");
var _ = Jn();

// src/preview-api/modules/addons/hooks.ts
import { logger as Ce } from "storybook/internal/client-logger";
import {
  FORCE_RE_RENDER as Qn,
  RESET_STORY_ARGS as Zn,
  STORY_RENDERED as Ct,
  UPDATE_GLOBALS as es,
  UPDATE_STORY_ARGS as rs
} from "storybook/internal/core-events";
import { global as Ge } from "@storybook/global";
var Pr = class Pr {
  constructor() {
    this.hookListsMap = void 0;
    this.mountedDecorators = void 0;
    this.prevMountedDecorators = void 0;
    this.currentHooks = void 0;
    this.nextHookIndex = void 0;
    this.currentPhase = void 0;
    this.currentEffects = void 0;
    this.prevEffects = void 0;
    this.currentDecoratorName = void 0;
    this.hasUpdates = void 0;
    this.currentContext = void 0;
    this.renderListener = /* @__PURE__ */ n((e) => {
      e === this.currentContext?.id && (this.triggerEffects(), this.currentContext = null, this.removeRenderListeners());
    }, "renderListener");
    this.init();
  }
  init() {
    this.hookListsMap = /* @__PURE__ */ new WeakMap(), this.mountedDecorators = /* @__PURE__ */ new Set(), this.prevMountedDecorators = /* @__PURE__ */ new Set(),
    this.currentHooks = [], this.nextHookIndex = 0, this.currentPhase = "NONE", this.currentEffects = [], this.prevEffects = [], this.currentDecoratorName =
    null, this.hasUpdates = !1, this.currentContext = null;
  }
  clean() {
    this.prevEffects.forEach((e) => {
      e.destroy && e.destroy();
    }), this.init(), this.removeRenderListeners();
  }
  getNextHook() {
    let e = this.currentHooks[this.nextHookIndex];
    return this.nextHookIndex += 1, e;
  }
  triggerEffects() {
    this.prevEffects.forEach((e) => {
      !this.currentEffects.includes(e) && e.destroy && e.destroy();
    }), this.currentEffects.forEach((e) => {
      this.prevEffects.includes(e) || (e.destroy = e.create());
    }), this.prevEffects = this.currentEffects, this.currentEffects = [];
  }
  addRenderListeners() {
    this.removeRenderListeners(), _.getChannel().on(Ct, this.renderListener);
  }
  removeRenderListeners() {
    _.getChannel().removeListener(Ct, this.renderListener);
  }
};
n(Pr, "HooksContext");
var te = Pr;
function vt(r) {
  let e = /* @__PURE__ */ n((...t) => {
    let { hooks: o } = typeof t[0] == "function" ? t[1] : t[0], s = o.currentPhase, i = o.currentHooks, a = o.nextHookIndex, l = o.currentDecoratorName;
    o.currentDecoratorName = r.name, o.prevMountedDecorators.has(r) ? (o.currentPhase = "UPDATE", o.currentHooks = o.hookListsMap.get(r) || []) :
    (o.currentPhase = "MOUNT", o.currentHooks = [], o.hookListsMap.set(r, o.currentHooks), o.prevMountedDecorators.add(r)), o.nextHookIndex =
    0;
    let c = Ge.STORYBOOK_HOOKS_CONTEXT;
    Ge.STORYBOOK_HOOKS_CONTEXT = o;
    let d = r(...t);
    if (Ge.STORYBOOK_HOOKS_CONTEXT = c, o.currentPhase === "UPDATE" && o.getNextHook() != null)
      throw new Error(
        "Rendered fewer hooks than expected. This may be caused by an accidental early return statement."
      );
    return o.currentPhase = s, o.currentHooks = i, o.nextHookIndex = a, o.currentDecoratorName = l, d;
  }, "hookified");
  return e.originalFn = r, e;
}
n(vt, "hookify");
var Ar = 0, ts = 25, Er = /* @__PURE__ */ n((r) => (e, t) => {
  let o = r(
    vt(e),
    t.map((s) => vt(s))
  );
  return (s) => {
    let { hooks: i } = s;
    i.prevMountedDecorators ??= /* @__PURE__ */ new Set(), i.mountedDecorators = /* @__PURE__ */ new Set([e, ...t]), i.currentContext = s, i.
    hasUpdates = !1;
    let a = o(s);
    for (Ar = 1; i.hasUpdates; )
      if (i.hasUpdates = !1, i.currentEffects = [], a = o(s), Ar += 1, Ar > ts)
        throw new Error(
          "Too many re-renders. Storybook limits the number of renders to prevent an infinite loop."
        );
    return i.addRenderListeners(), a;
  };
}, "applyHooks"), os = /* @__PURE__ */ n((r, e) => r.length === e.length && r.every((t, o) => t === e[o]), "areDepsEqual"), Cr = /* @__PURE__ */ n(
() => new Error("Storybook preview hooks can only be called inside decorators and story functions."), "invalidHooksError");
function Pt() {
  return Ge.STORYBOOK_HOOKS_CONTEXT || null;
}
n(Pt, "getHooksContextOrNull");
function vr() {
  let r = Pt();
  if (r == null)
    throw Cr();
  return r;
}
n(vr, "getHooksContextOrThrow");
function ns(r, e, t) {
  let o = vr();
  if (o.currentPhase === "MOUNT") {
    t != null && !Array.isArray(t) && Ce.warn(
      `${r} received a final argument that is not an array (instead, received ${t}). When specified, the final argument must be an array.`
    );
    let s = { name: r, deps: t };
    return o.currentHooks.push(s), e(s), s;
  }
  if (o.currentPhase === "UPDATE") {
    let s = o.getNextHook();
    if (s == null)
      throw new Error("Rendered more hooks than during the previous render.");
    return s.name !== r && Ce.warn(
      `Storybook has detected a change in the order of Hooks${o.currentDecoratorName ? ` called by ${o.currentDecoratorName}` : ""}. This wi\
ll lead to bugs and errors if not fixed.`
    ), t != null && s.deps == null && Ce.warn(
      `${r} received a final argument during this render, but not during the previous render. Even though the final argument is optional, it\
s type cannot change between renders.`
    ), t != null && s.deps != null && t.length !== s.deps.length && Ce.warn(`The final argument passed to ${r} changed size between renders.\
 The order and size of this array must remain constant.
Previous: ${s.deps}
Incoming: ${t}`), (t == null || s.deps == null || !os(t, s.deps)) && (e(s), s.deps = t), s;
  }
  throw Cr();
}
n(ns, "useHook");
function Ue(r, e, t) {
  let { memoizedState: o } = ns(
    r,
    (s) => {
      s.memoizedState = e();
    },
    t
  );
  return o;
}
n(Ue, "useMemoLike");
function ss(r, e) {
  return Ue("useMemo", r, e);
}
n(ss, "useMemo");
function ve(r, e) {
  return Ue("useCallback", () => r, e);
}
n(ve, "useCallback");
function Ft(r, e) {
  return Ue(r, () => ({ current: e }), []);
}
n(Ft, "useRefLike");
function is(r) {
  return Ft("useRef", r);
}
n(is, "useRef");
function as() {
  let r = Pt();
  if (r != null && r.currentPhase !== "NONE")
    r.hasUpdates = !0;
  else
    try {
      _.getChannel().emit(Qn);
    } catch {
      Ce.warn("State updates of Storybook preview hooks work only in browser");
    }
}
n(as, "triggerUpdate");
function It(r, e) {
  let t = Ft(
    r,
    // @ts-expect-error S type should never be function, but there's no way to tell that to TypeScript
    typeof e == "function" ? e() : e
  ), o = /* @__PURE__ */ n((s) => {
    t.current = typeof s == "function" ? s(t.current) : s, as();
  }, "setState");
  return [t.current, o];
}
n(It, "useStateLike");
function ls(r) {
  return It("useState", r);
}
n(ls, "useState");
function cs(r, e, t) {
  let o = t != null ? () => t(e) : e, [s, i] = It("useReducer", o);
  return [s, /* @__PURE__ */ n((l) => i((c) => r(c, l)), "dispatch")];
}
n(cs, "useReducer");
function Ot(r, e) {
  let t = vr(), o = Ue("useEffect", () => ({ create: r }), e);
  t.currentEffects.includes(o) || t.currentEffects.push(o);
}
n(Ot, "useEffect");
function ds(r, e = []) {
  let t = _.getChannel();
  return Ot(() => (Object.entries(r).forEach(([o, s]) => t.on(o, s)), () => {
    Object.entries(r).forEach(
      ([o, s]) => t.removeListener(o, s)
    );
  }), [...Object.keys(r), ...e]), ve(t.emit.bind(t), [t]);
}
n(ds, "useChannel");
function He() {
  let { currentContext: r } = vr();
  if (r == null)
    throw Cr();
  return r;
}
n(He, "useStoryContext");
function ps(r, e) {
  let { parameters: t } = He();
  if (r)
    return t[r] ?? e;
}
n(ps, "useParameter");
function us() {
  let r = _.getChannel(), { id: e, args: t } = He(), o = ve(
    (i) => r.emit(rs, { storyId: e, updatedArgs: i }),
    [r, e]
  ), s = ve(
    (i) => r.emit(Zn, { storyId: e, argNames: i }),
    [r, e]
  );
  return [t, o, s];
}
n(us, "useArgs");
function fs() {
  let r = _.getChannel(), { globals: e } = He(), t = ve(
    (o) => r.emit(es, { globals: o }),
    [r]
  );
  return [e, t];
}
n(fs, "useGlobals");

// src/preview-api/modules/addons/make-decorator.ts
var ys = /* @__PURE__ */ n(({
  name: r,
  parameterName: e,
  wrapper: t,
  skipIfNoParametersOrOptions: o = !1
}) => {
  let s = /* @__PURE__ */ n((i) => (a, l) => {
    let c = l.parameters && l.parameters[e];
    return c && c.disable || o && !i && !c ? a(l) : t(a, l, {
      options: i,
      parameters: c
    });
  }, "decorator");
  return (...i) => typeof i[0] == "function" ? s()(...i) : (...a) => {
    if (a.length > 1)
      return i.length > 1 ? s(i)(...a) : s(...i)(...a);
    throw new Error(
      `Passing stories directly into ${r}() is not allowed,
        instead use addDecorator(${r}) and pass options with the '${e}' parameter`
    );
  };
}, "makeDecorator");

// src/preview-api/modules/store/StoryStore.ts
import { getCoreAnnotations as ri } from "storybook/internal/csf";
import {
  CalledExtractOnStoreError as ti,
  MissingStoryFromCsfFileError as oi
} from "storybook/internal/preview-errors";

// ../node_modules/es-toolkit/dist/function/noop.mjs
function Dt() {
}
n(Dt, "noop");

// ../node_modules/es-toolkit/dist/compat/_internal/getSymbols.mjs
function Fr(r) {
  return Object.getOwnPropertySymbols(r).filter((e) => Object.prototype.propertyIsEnumerable.call(r, e));
}
n(Fr, "getSymbols");

// ../node_modules/es-toolkit/dist/compat/_internal/getTag.mjs
function Ir(r) {
  return r == null ? r === void 0 ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(r);
}
n(Ir, "getTag");

// ../node_modules/es-toolkit/dist/compat/_internal/tags.mjs
var kt = "[object RegExp]", jt = "[object String]", Mt = "[object Number]", _t = "[object Boolean]", Or = "[object Arguments]", Nt = "[objec\
t Symbol]", Lt = "[object Date]", qt = "[object Map]", zt = "[object Set]", Bt = "[object Array]", Gt = "[object Function]", Ut = "[object A\
rrayBuffer]", Ve = "[object Object]", Ht = "[object Error]", Vt = "[object DataView]", Wt = "[object Uint8Array]", $t = "[object Uint8Clampe\
dArray]", Yt = "[object Uint16Array]", Kt = "[object Uint32Array]", Xt = "[object BigUint64Array]", Jt = "[object Int8Array]", Qt = "[object\
 Int16Array]", Zt = "[object Int32Array]", eo = "[object BigInt64Array]", ro = "[object Float32Array]", to = "[object Float64Array]";

// ../node_modules/es-toolkit/dist/predicate/isPlainObject.mjs
function j(r) {
  if (!r || typeof r != "object")
    return !1;
  let e = Object.getPrototypeOf(r);
  return e === null || e === Object.prototype || Object.getPrototypeOf(e) === null ? Object.prototype.toString.call(r) === "[object Object]" :
  !1;
}
n(j, "isPlainObject");

// ../node_modules/es-toolkit/dist/object/mapValues.mjs
function V(r, e) {
  let t = {}, o = Object.keys(r);
  for (let s = 0; s < o.length; s++) {
    let i = o[s], a = r[i];
    t[i] = e(a, i, r);
  }
  return t;
}
n(V, "mapValues");

// ../node_modules/es-toolkit/dist/object/pickBy.mjs
function Dr(r, e) {
  let t = {}, o = Object.keys(r);
  for (let s = 0; s < o.length; s++) {
    let i = o[s], a = r[i];
    e(a, i) && (t[i] = a);
  }
  return t;
}
n(Dr, "pickBy");

// ../node_modules/es-toolkit/dist/compat/util/eq.mjs
function oo(r, e) {
  return r === e || Number.isNaN(r) && Number.isNaN(e);
}
n(oo, "eq");

// ../node_modules/es-toolkit/dist/predicate/isEqualWith.mjs
function no(r, e, t) {
  return Pe(r, e, void 0, void 0, void 0, void 0, t);
}
n(no, "isEqualWith");
function Pe(r, e, t, o, s, i, a) {
  let l = a(r, e, t, o, s, i);
  if (l !== void 0)
    return l;
  if (typeof r == typeof e)
    switch (typeof r) {
      case "bigint":
      case "string":
      case "boolean":
      case "symbol":
      case "undefined":
        return r === e;
      case "number":
        return r === e || Object.is(r, e);
      case "function":
        return r === e;
      case "object":
        return Fe(r, e, i, a);
    }
  return Fe(r, e, i, a);
}
n(Pe, "isEqualWithImpl");
function Fe(r, e, t, o) {
  if (Object.is(r, e))
    return !0;
  let s = Ir(r), i = Ir(e);
  if (s === Or && (s = Ve), i === Or && (i = Ve), s !== i)
    return !1;
  switch (s) {
    case jt:
      return r.toString() === e.toString();
    case Mt: {
      let c = r.valueOf(), d = e.valueOf();
      return oo(c, d);
    }
    case _t:
    case Lt:
    case Nt:
      return Object.is(r.valueOf(), e.valueOf());
    case kt:
      return r.source === e.source && r.flags === e.flags;
    case Gt:
      return r === e;
  }
  t = t ?? /* @__PURE__ */ new Map();
  let a = t.get(r), l = t.get(e);
  if (a != null && l != null)
    return a === e;
  t.set(r, e), t.set(e, r);
  try {
    switch (s) {
      case qt: {
        if (r.size !== e.size)
          return !1;
        for (let [c, d] of r.entries())
          if (!e.has(c) || !Pe(d, e.get(c), c, r, e, t, o))
            return !1;
        return !0;
      }
      case zt: {
        if (r.size !== e.size)
          return !1;
        let c = Array.from(r.values()), d = Array.from(e.values());
        for (let p = 0; p < c.length; p++) {
          let u = c[p], y = d.findIndex((h) => Pe(u, h, void 0, r, e, t, o));
          if (y === -1)
            return !1;
          d.splice(y, 1);
        }
        return !0;
      }
      case Bt:
      case Wt:
      case $t:
      case Yt:
      case Kt:
      case Xt:
      case Jt:
      case Qt:
      case Zt:
      case eo:
      case ro:
      case to: {
        if (typeof Buffer < "u" && Buffer.isBuffer(r) !== Buffer.isBuffer(e) || r.length !== e.length)
          return !1;
        for (let c = 0; c < r.length; c++)
          if (!Pe(r[c], e[c], c, r, e, t, o))
            return !1;
        return !0;
      }
      case Ut:
        return r.byteLength !== e.byteLength ? !1 : Fe(new Uint8Array(r), new Uint8Array(e), t, o);
      case Vt:
        return r.byteLength !== e.byteLength || r.byteOffset !== e.byteOffset ? !1 : Fe(new Uint8Array(r), new Uint8Array(e), t, o);
      case Ht:
        return r.name === e.name && r.message === e.message;
      case Ve: {
        if (!(Fe(r.constructor, e.constructor, t, o) || j(r) && j(e)))
          return !1;
        let d = [...Object.keys(r), ...Fr(r)], p = [...Object.keys(e), ...Fr(e)];
        if (d.length !== p.length)
          return !1;
        for (let u = 0; u < d.length; u++) {
          let y = d[u], h = r[y];
          if (!Object.hasOwn(e, y))
            return !1;
          let g = e[y];
          if (!Pe(h, g, y, r, e, t, o))
            return !1;
        }
        return !0;
      }
      default:
        return !1;
    }
  } finally {
    t.delete(r), t.delete(e);
  }
}
n(Fe, "areObjectsEqual");

// ../node_modules/es-toolkit/dist/predicate/isEqual.mjs
function kr(r, e) {
  return no(r, e, Dt);
}
n(kr, "isEqual");

// src/preview-api/modules/store/StoryStore.ts
var rr = ue(Mr(), 1);

// src/preview-api/modules/store/args.ts
import { once as _r } from "storybook/internal/client-logger";

// ../node_modules/ts-dedent/esm/index.js
function P(r) {
  for (var e = [], t = 1; t < arguments.length; t++)
    e[t - 1] = arguments[t];
  var o = Array.from(typeof r == "string" ? [r] : r);
  o[o.length - 1] = o[o.length - 1].replace(/\r?\n([\t ]*)$/, "");
  var s = o.reduce(function(l, c) {
    var d = c.match(/\n([\t ]+|(?!\s).)/g);
    return d ? l.concat(d.map(function(p) {
      var u, y;
      return (y = (u = p.match(/[\t ]/g)) === null || u === void 0 ? void 0 : u.length) !== null && y !== void 0 ? y : 0;
    })) : l;
  }, []);
  if (s.length) {
    var i = new RegExp(`
[	 ]{` + Math.min.apply(Math, s) + "}", "g");
    o = o.map(function(l) {
      return l.replace(i, `
`);
    });
  }
  o[0] = o[0].replace(/^\r?\n/, "");
  var a = o[0];
  return e.forEach(function(l, c) {
    var d = a.match(/(?:^|\n)( *)$/), p = d ? d[1] : "", u = l;
    typeof l == "string" && l.includes(`
`) && (u = String(l).split(`
`).map(function(y, h) {
      return h === 0 ? y : "" + p + y;
    }).join(`
`)), a += u + o[c + 1];
  }), a;
}
n(P, "dedent");

// src/preview-api/modules/store/args.ts
var fe = Symbol("incompatible"), Nr = /* @__PURE__ */ n((r, e) => {
  let t = e.type;
  if (r == null || !t || e.mapping)
    return r;
  switch (t.name) {
    case "string":
      return String(r);
    case "enum":
      return r;
    case "number":
      return Number(r);
    case "boolean":
      return String(r) === "true";
    case "array":
      return !t.value || !Array.isArray(r) ? fe : r.reduce((o, s, i) => {
        let a = Nr(s, { type: t.value });
        return a !== fe && (o[i] = a), o;
      }, new Array(r.length));
    case "object":
      return typeof r == "string" || typeof r == "number" ? r : !t.value || typeof r != "object" ? fe : Object.entries(r).reduce((o, [s, i]) => {
        let a = Nr(i, { type: t.value[s] });
        return a === fe ? o : Object.assign(o, { [s]: a });
      }, {});
    default:
      return fe;
  }
}, "map"), io = /* @__PURE__ */ n((r, e) => Object.entries(r).reduce((t, [o, s]) => {
  if (!e[o])
    return t;
  let i = Nr(s, e[o]);
  return i === fe ? t : Object.assign(t, { [o]: i });
}, {}), "mapArgsToTypes"), Ie = /* @__PURE__ */ n((r, e) => Array.isArray(r) && Array.isArray(e) ? e.reduce(
  (t, o, s) => (t[s] = Ie(r[s], e[s]), t),
  [...r]
).filter((t) => t !== void 0) : !j(r) || !j(e) ? e : Object.keys({ ...r, ...e }).reduce((t, o) => {
  if (o in e) {
    let s = Ie(r[o], e[o]);
    s !== void 0 && (t[o] = s);
  } else
    t[o] = r[o];
  return t;
}, {}), "combineArgs"), ao = /* @__PURE__ */ n((r, e) => Object.entries(e).reduce((t, [o, { options: s }]) => {
  function i() {
    return o in r && (t[o] = r[o]), t;
  }
  if (n(i, "allowArg"), !s)
    return i();
  if (!Array.isArray(s))
    return _r.error(P`
        Invalid argType: '${o}.options' should be an array.

        More info: https://storybook.js.org/docs/api/arg-types?ref=error
      `), i();
  if (s.some((u) => u && ["object", "function"].includes(typeof u)))
    return _r.error(P`
        Invalid argType: '${o}.options' should only contain primitives. Use a 'mapping' for complex values.

        More info: https://storybook.js.org/docs/writing-stories/args?ref=error#mapping-to-complex-arg-values
      `), i();
  let a = Array.isArray(r[o]), l = a && r[o].findIndex((u) => !s.includes(u)), c = a && l === -1;
  if (r[o] === void 0 || s.includes(r[o]) || c)
    return i();
  let d = a ? `${o}[${l}]` : o, p = s.map((u) => typeof u == "string" ? `'${u}'` : String(u)).join(", ");
  return _r.warn(`Received illegal value for '${d}'. Supported options: ${p}`), t;
}, {}), "validateOptions"), oe = Symbol("Deeply equal"), ye = /* @__PURE__ */ n((r, e) => {
  if (typeof r != typeof e)
    return e;
  if (kr(r, e))
    return oe;
  if (Array.isArray(r) && Array.isArray(e)) {
    let t = e.reduce((o, s, i) => {
      let a = ye(r[i], s);
      return a !== oe && (o[i] = a), o;
    }, new Array(e.length));
    return e.length >= r.length ? t : t.concat(new Array(r.length - e.length).fill(void 0));
  }
  return j(r) && j(e) ? Object.keys({ ...r, ...e }).reduce((t, o) => {
    let s = ye(r?.[o], e?.[o]);
    return s === oe ? t : Object.assign(t, { [o]: s });
  }, {}) : e;
}, "deepDiff"), Lr = "UNTARGETED";
function lo({
  args: r,
  argTypes: e
}) {
  let t = {};
  return Object.entries(r).forEach(([o, s]) => {
    let { target: i = Lr } = e[o] || {};
    t[i] = t[i] || {}, t[i][o] = s;
  }), t;
}
n(lo, "groupArgsByTarget");

// src/preview-api/modules/store/ArgsStore.ts
function ms(r) {
  return Object.keys(r).forEach((e) => r[e] === void 0 && delete r[e]), r;
}
n(ms, "deleteUndefined");
var qr = class qr {
  constructor() {
    this.initialArgsByStoryId = {};
    this.argsByStoryId = {};
  }
  get(e) {
    if (!(e in this.argsByStoryId))
      throw new Error(`No args known for ${e} -- has it been rendered yet?`);
    return this.argsByStoryId[e];
  }
  setInitial(e) {
    if (!this.initialArgsByStoryId[e.id])
      this.initialArgsByStoryId[e.id] = e.initialArgs, this.argsByStoryId[e.id] = e.initialArgs;
    else if (this.initialArgsByStoryId[e.id] !== e.initialArgs) {
      let t = ye(this.initialArgsByStoryId[e.id], this.argsByStoryId[e.id]);
      this.initialArgsByStoryId[e.id] = e.initialArgs, this.argsByStoryId[e.id] = e.initialArgs, t !== oe && this.updateFromDelta(e, t);
    }
  }
  updateFromDelta(e, t) {
    let o = ao(t, e.argTypes);
    this.argsByStoryId[e.id] = Ie(this.argsByStoryId[e.id], o);
  }
  updateFromPersisted(e, t) {
    let o = io(t, e.argTypes);
    return this.updateFromDelta(e, o);
  }
  update(e, t) {
    if (!(e in this.argsByStoryId))
      throw new Error(`No args known for ${e} -- has it been rendered yet?`);
    this.argsByStoryId[e] = ms({
      ...this.argsByStoryId[e],
      ...t
    });
  }
};
n(qr, "ArgsStore");
var We = qr;

// src/preview-api/modules/store/GlobalsStore.ts
import { logger as hs } from "storybook/internal/client-logger";

// src/preview-api/modules/store/csf/getValuesFromArgTypes.ts
var $e = /* @__PURE__ */ n((r = {}) => Object.entries(r).reduce((e, [t, { defaultValue: o }]) => (typeof o < "u" && (e[t] = o), e), {}), "ge\
tValuesFromArgTypes");

// src/preview-api/modules/store/GlobalsStore.ts
var zr = class zr {
  constructor({
    globals: e = {},
    globalTypes: t = {}
  }) {
    this.set({ globals: e, globalTypes: t });
  }
  set({ globals: e = {}, globalTypes: t = {} }) {
    let o = this.initialGlobals && ye(this.initialGlobals, this.globals);
    this.allowedGlobalNames = /* @__PURE__ */ new Set([...Object.keys(e), ...Object.keys(t)]);
    let s = $e(t);
    this.initialGlobals = { ...s, ...e }, this.globals = this.initialGlobals, o && o !== oe && this.updateFromPersisted(o);
  }
  filterAllowedGlobals(e) {
    return Object.entries(e).reduce((t, [o, s]) => (this.allowedGlobalNames.has(o) ? t[o] = s : hs.warn(
      `Attempted to set a global (${o}) that is not defined in initial globals or globalTypes`
    ), t), {});
  }
  updateFromPersisted(e) {
    let t = this.filterAllowedGlobals(e);
    this.globals = { ...this.globals, ...t };
  }
  get() {
    return this.globals;
  }
  update(e) {
    this.globals = { ...this.globals, ...this.filterAllowedGlobals(e) };
    for (let t in e)
      e[t] === void 0 && (this.globals[t] = this.initialGlobals[t]);
  }
};
n(zr, "GlobalsStore");
var Ye = zr;

// src/preview-api/modules/store/StoryIndexStore.ts
var co = ue(Mr(), 1);
import { MissingStoryAfterHmrError as gs } from "storybook/internal/preview-errors";
var bs = (0, co.default)(1)(
  (r) => Object.values(r).reduce(
    (e, t) => (e[t.importPath] = e[t.importPath] || t, e),
    {}
  )
), Br = class Br {
  constructor({ entries: e } = { v: 5, entries: {} }) {
    this.entries = e;
  }
  entryFromSpecifier(e) {
    let t = Object.values(this.entries);
    if (e === "*")
      return t[0];
    if (typeof e == "string")
      return this.entries[e] ? this.entries[e] : t.find((i) => i.id.startsWith(e));
    let { name: o, title: s } = e;
    return t.find((i) => i.name === o && i.title === s);
  }
  storyIdToEntry(e) {
    let t = this.entries[e];
    if (!t)
      throw new gs({ storyId: e });
    return t;
  }
  importPathToEntry(e) {
    return bs(this.entries)[e];
  }
};
n(Br, "StoryIndexStore");
var Ke = Br;

// src/preview-api/modules/store/csf/normalizeInputTypes.ts
var Ss = /* @__PURE__ */ n((r) => typeof r == "string" ? { name: r } : r, "normalizeType"), Ts = /* @__PURE__ */ n((r) => typeof r == "strin\
g" ? { type: r } : r, "normalizeControl"), xs = /* @__PURE__ */ n((r, e) => {
  let { type: t, control: o, ...s } = r, i = {
    name: e,
    ...s
  };
  return t && (i.type = Ss(t)), o ? i.control = Ts(o) : o === !1 && (i.control = { disable: !0 }), i;
}, "normalizeInputType"), ne = /* @__PURE__ */ n((r) => V(r, xs), "normalizeInputTypes");

// src/preview-api/modules/store/csf/normalizeStory.ts
import { deprecate as Rs, logger as ws } from "storybook/internal/client-logger";
import { storyNameFromExport as As, toId as Es } from "storybook/internal/csf";

// src/preview-api/modules/store/csf/normalizeArrays.ts
var C = /* @__PURE__ */ n((r) => Array.isArray(r) ? r : r ? [r] : [], "normalizeArrays");

// src/preview-api/modules/store/csf/normalizeStory.ts
var Cs = P`
CSF .story annotations deprecated; annotate story functions directly:
- StoryFn.story.name => StoryFn.storyName
- StoryFn.story.(parameters|decorators) => StoryFn.(parameters|decorators)
See https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#hoisted-csf-annotations for details and codemod.
`;
function me(r, e, t) {
  let o = e, s = typeof e == "function" ? e : null, { story: i } = o;
  i && (ws.debug("deprecated story", i), Rs(Cs));
  let a = As(r), l = typeof o != "function" && o.name || o.storyName || i?.name || a, c = [
    ...C(o.decorators),
    ...C(i?.decorators)
  ], d = { ...i?.parameters, ...o.parameters }, p = { ...i?.args, ...o.args }, u = { ...i?.argTypes, ...o.argTypes }, y = [...C(o.loaders), ...C(
  i?.loaders)], h = [
    ...C(o.beforeEach),
    ...C(i?.beforeEach)
  ], g = [
    ...C(o.afterEach),
    ...C(i?.afterEach)
  ], { render: b, play: m, tags: T = [], globals: x = {} } = o, f = d.__id || Es(t.id, a);
  return {
    moduleExport: e,
    id: f,
    name: l,
    tags: T,
    decorators: c,
    parameters: d,
    args: p,
    argTypes: ne(u),
    loaders: y,
    beforeEach: h,
    afterEach: g,
    globals: x,
    ...b && { render: b },
    ...s && { userStoryFn: s },
    ...m && { play: m }
  };
}
n(me, "normalizeStory");

// src/preview-api/modules/store/csf/processCSFFile.ts
import { logger as uo } from "storybook/internal/client-logger";
import { isExportStory as po, isStory as Ps } from "storybook/internal/csf";

// src/preview-api/modules/store/csf/normalizeComponentAnnotations.ts
import { sanitize as vs } from "storybook/internal/csf";
function Oe(r, e = r.title, t) {
  let { id: o, argTypes: s } = r;
  return {
    id: vs(o || e),
    ...r,
    title: e,
    ...s && { argTypes: ne(s) },
    parameters: {
      fileName: t,
      ...r.parameters
    }
  };
}
n(Oe, "normalizeComponentAnnotations");

// src/preview-api/modules/store/csf/processCSFFile.ts
var Fs = /* @__PURE__ */ n((r) => {
  let { globals: e, globalTypes: t } = r;
  (e || t) && uo.error(
    "Global args/argTypes can only be set globally",
    JSON.stringify({
      globals: e,
      globalTypes: t
    })
  );
}, "checkGlobals"), Is = /* @__PURE__ */ n((r) => {
  let { options: e } = r;
  e?.storySort && uo.error("The storySort option parameter can only be set globally");
}, "checkStorySort"), Xe = /* @__PURE__ */ n((r) => {
  r && (Fs(r), Is(r));
}, "checkDisallowedParameters");
function fo(r, e, t) {
  let { default: o, __namedExportsOrder: s, ...i } = r, a = Object.values(i)[0];
  if (Ps(a)) {
    let d = Oe(a.meta.input, t, e);
    Xe(d.parameters);
    let p = { meta: d, stories: {}, moduleExports: r };
    return Object.keys(i).forEach((u) => {
      if (po(u, d)) {
        let y = me(u, i[u].input, d);
        Xe(y.parameters), p.stories[y.id] = y;
      }
    }), p.projectAnnotations = a.meta.preview.composed, p;
  }
  let l = Oe(
    o,
    t,
    e
  );
  Xe(l.parameters);
  let c = { meta: l, stories: {}, moduleExports: r };
  return Object.keys(i).forEach((d) => {
    if (po(d, l)) {
      let p = me(d, i[d], l);
      Xe(p.parameters), c.stories[p.id] = p;
    }
  }), c;
}
n(fo, "processCSFFile");

// src/preview-api/modules/store/csf/prepareStory.ts
import { combineTags as Ds, includeConditionalArg as ks } from "storybook/internal/csf";
import { NoRenderFunctionError as js } from "storybook/internal/preview-errors";
import { global as Ms } from "@storybook/global";
import { global as _s } from "@storybook/global";

// src/preview-api/modules/preview-web/render/mount-utils.ts
function mo(r) {
  return r != null && Os(r).includes("mount");
}
n(mo, "mountDestructured");
function Os(r) {
  let e = r.toString().match(/[^(]*\(([^)]*)/);
  if (!e)
    return [];
  let t = yo(e[1]);
  if (!t.length)
    return [];
  let o = t[0];
  return o.startsWith("{") && o.endsWith("}") ? yo(o.slice(1, -1).replace(/\s/g, "")).map((i) => i.replace(/:.*|=.*/g, "")) : [];
}
n(Os, "getUsedProps");
function yo(r) {
  let e = [], t = [], o = 0;
  for (let i = 0; i < r.length; i++)
    if (r[i] === "{" || r[i] === "[")
      t.push(r[i] === "{" ? "}" : "]");
    else if (r[i] === t[t.length - 1])
      t.pop();
    else if (!t.length && r[i] === ",") {
      let a = r.substring(o, i).trim();
      a && e.push(a), o = i + 1;
    }
  let s = r.substring(o).trim();
  return s && e.push(s), e;
}
n(yo, "splitByComma");

// src/preview-api/modules/store/decorators.ts
function ho(r, e, t) {
  let o = t(r);
  return (s) => e(o, s);
}
n(ho, "decorateStory");
function go({
  componentId: r,
  title: e,
  kind: t,
  id: o,
  name: s,
  story: i,
  parameters: a,
  initialArgs: l,
  argTypes: c,
  ...d
} = {}) {
  return d;
}
n(go, "sanitizeStoryContextUpdate");
function Gr(r, e) {
  let t = {}, o = /* @__PURE__ */ n((i) => (a) => {
    if (!t.value)
      throw new Error("Decorated function called without init");
    return t.value = {
      ...t.value,
      ...go(a)
    }, i(t.value);
  }, "bindWithContext"), s = e.reduce(
    (i, a) => ho(i, a, o),
    r
  );
  return (i) => (t.value = i, s(i));
}
n(Gr, "defaultDecorateStory");

// src/preview-api/modules/store/parameters.ts
var N = /* @__PURE__ */ n((...r) => {
  let e = {}, t = r.filter(Boolean), o = t.reduce((s, i) => (Object.entries(i).forEach(([a, l]) => {
    let c = s[a];
    Array.isArray(l) || typeof c > "u" ? s[a] = l : j(l) && j(c) ? e[a] = !0 : typeof l < "u" && (s[a] = l);
  }), s), {});
  return Object.keys(e).forEach((s) => {
    let i = t.filter(Boolean).map((a) => a[s]).filter((a) => typeof a < "u");
    i.every((a) => j(a)) ? o[s] = N(...i) : o[s] = i[i.length - 1];
  }), o;
}, "combineParameters");

// src/preview-api/modules/store/csf/prepareStory.ts
function De(r, e, t) {
  let { moduleExport: o, id: s, name: i } = r || {}, a = bo(
    r,
    e,
    t
  ), l = /* @__PURE__ */ n(async (w) => {
    let E = {};
    for (let D of [
      C(t.loaders),
      C(e.loaders),
      C(r.loaders)
    ]) {
      if (w.abortSignal.aborted)
        return E;
      let k = await Promise.all(D.map((L) => L(w)));
      Object.assign(E, ...k);
    }
    return E;
  }, "applyLoaders"), c = /* @__PURE__ */ n(async (w) => {
    let E = new Array();
    for (let D of [
      ...C(t.beforeEach),
      ...C(e.beforeEach),
      ...C(r.beforeEach)
    ]) {
      if (w.abortSignal.aborted)
        return E;
      let k = await D(w);
      k && E.push(k);
    }
    return E;
  }, "applyBeforeEach"), d = /* @__PURE__ */ n(async (w) => {
    let E = [
      ...C(t.afterEach),
      ...C(e.afterEach),
      ...C(r.afterEach)
    ].reverse();
    for (let D of E) {
      if (w.abortSignal.aborted)
        return;
      await D(w);
    }
  }, "applyAfterEach"), p = /* @__PURE__ */ n((w) => w.originalStoryFn(w.args, w), "undecoratedStoryFn"), { applyDecorators: u = Gr, runStep: y } = t,
  h = [
    ...C(r?.decorators),
    ...C(e?.decorators),
    ...C(t?.decorators)
  ], g = r?.userStoryFn || r?.render || e.render || t.render, b = Er(u)(p, h), m = /* @__PURE__ */ n((w) => b(w), "unboundStoryFn"), T = r?.
  play ?? e?.play, x = mo(T);
  if (!g && !x)
    throw new js({ id: s });
  let f = /* @__PURE__ */ n((w) => async () => (await w.renderToCanvas(), w.canvas), "defaultMount"), S = r.mount ?? e.mount ?? t.mount ?? f,
  R = t.testingLibraryRender;
  return {
    storyGlobals: {},
    ...a,
    moduleExport: o,
    id: s,
    name: i,
    story: i,
    originalStoryFn: g,
    undecoratedStoryFn: p,
    unboundStoryFn: m,
    applyLoaders: l,
    applyBeforeEach: c,
    applyAfterEach: d,
    playFunction: T,
    runStep: y,
    mount: S,
    testingLibraryRender: R,
    renderToCanvas: t.renderToCanvas,
    usesMount: x
  };
}
n(De, "prepareStory");
function Ur(r, e, t) {
  return {
    ...bo(void 0, r, e),
    moduleExport: t
  };
}
n(Ur, "prepareMeta");
function bo(r, e, t) {
  let o = ["dev", "test"], s = _s.DOCS_OPTIONS?.autodocs === !0 ? ["autodocs"] : [], i = Ds(
    ...o,
    ...s,
    ...t.tags ?? [],
    ...e.tags ?? [],
    ...r?.tags ?? []
  ), a = N(
    t.parameters,
    e.parameters,
    r?.parameters
  ), { argTypesEnhancers: l = [], argsEnhancers: c = [] } = t, d = N(
    t.argTypes,
    e.argTypes,
    r?.argTypes
  );
  if (r) {
    let T = r?.userStoryFn || r?.render || e.render || t.render;
    a.__isArgsStory = T && T.length > 0;
  }
  let p = {
    ...t.args,
    ...e.args,
    ...r?.args
  }, u = {
    ...e.globals,
    ...r?.globals
  }, y = {
    componentId: e.id,
    title: e.title,
    kind: e.title,
    // Back compat
    id: r?.id || e.id,
    // if there's no story name, we create a fake one since enhancers expect a name
    name: r?.name || "__meta",
    story: r?.name || "__meta",
    // Back compat
    component: e.component,
    subcomponents: e.subcomponents,
    tags: i,
    parameters: a,
    initialArgs: p,
    argTypes: d,
    storyGlobals: u
  };
  y.argTypes = l.reduce(
    (T, x) => x({ ...y, argTypes: T }),
    y.argTypes
  );
  let h = { ...p };
  y.initialArgs = [...c].reduce(
    (T, x) => ({
      ...T,
      ...x({
        ...y,
        initialArgs: T
      })
    }),
    h
  );
  let { name: g, story: b, ...m } = y;
  return m;
}
n(bo, "preparePartialAnnotations");
function Je(r) {
  let { args: e } = r, t = {
    ...r,
    allArgs: void 0,
    argsByTarget: void 0
  };
  if (Ms.FEATURES?.argTypeTargetsV7) {
    let i = lo(r);
    t = {
      ...r,
      allArgs: r.args,
      argsByTarget: i,
      args: i[Lr] || {}
    };
  }
  let o = Object.entries(t.args).reduce((i, [a, l]) => {
    if (!t.argTypes[a]?.mapping)
      return i[a] = l, i;
    let c = /* @__PURE__ */ n((d) => {
      let p = t.argTypes[a].mapping;
      return p && d in p ? p[d] : d;
    }, "mappingFn");
    return i[a] = Array.isArray(l) ? l.map(c) : c(l), i;
  }, {}), s = Object.entries(o).reduce((i, [a, l]) => {
    let c = t.argTypes[a] || {};
    return ks(c, o, t.globals) && (i[a] = l), i;
  }, {});
  return { ...t, unmappedArgs: e, args: s };
}
n(Je, "prepareContext");

// src/preview-api/modules/store/inferArgTypes.ts
import { logger as Ns } from "storybook/internal/client-logger";
var Hr = /* @__PURE__ */ n((r, e, t) => {
  let o = typeof r;
  switch (o) {
    case "boolean":
    case "string":
    case "number":
    case "function":
    case "symbol":
      return { name: o };
    default:
      break;
  }
  return r ? t.has(r) ? (Ns.warn(P`
        We've detected a cycle in arg '${e}'. Args should be JSON-serializable.

        Consider using the mapping feature or fully custom args:
        - Mapping: https://storybook.js.org/docs/writing-stories/args#mapping-to-complex-arg-values
        - Custom args: https://storybook.js.org/docs/essentials/controls#fully-custom-args
      `), { name: "other", value: "cyclic object" }) : (t.add(r), Array.isArray(r) ? { name: "array", value: r.length > 0 ? Hr(r[0], e, new Set(
  t)) : { name: "other", value: "unknown" } } : { name: "object", value: V(r, (i) => Hr(i, e, new Set(t))) }) : { name: "object", value: {} };
}, "inferType"), Vr = /* @__PURE__ */ n((r) => {
  let { id: e, argTypes: t = {}, initialArgs: o = {} } = r, s = V(o, (a, l) => ({
    name: l,
    type: Hr(a, `${e}.${l}`, /* @__PURE__ */ new Set())
  })), i = V(t, (a, l) => ({
    name: l
  }));
  return N(s, i, t);
}, "inferArgTypes");
Vr.secondPass = !0;

// src/preview-api/modules/store/inferControls.ts
import { logger as Ls } from "storybook/internal/client-logger";

// src/preview-api/modules/store/filterArgTypes.ts
var So = /* @__PURE__ */ n((r, e) => Array.isArray(e) ? e.includes(r) : r.match(e), "matches"), Qe = /* @__PURE__ */ n((r, e, t) => !e && !t ?
r : r && Dr(r, (o, s) => {
  let i = o.name || s.toString();
  return !!(!e || So(i, e)) && (!t || !So(i, t));
}), "filterArgTypes");

// src/preview-api/modules/store/inferControls.ts
var qs = /* @__PURE__ */ n((r, e, t) => {
  let { type: o, options: s } = r;
  if (o) {
    if (t.color && t.color.test(e)) {
      let i = o.name;
      if (i === "string")
        return { control: { type: "color" } };
      i !== "enum" && Ls.warn(
        `Addon controls: Control of type color only supports string, received "${i}" instead`
      );
    }
    if (t.date && t.date.test(e))
      return { control: { type: "date" } };
    switch (o.name) {
      case "array":
        return { control: { type: "object" } };
      case "boolean":
        return { control: { type: "boolean" } };
      case "string":
        return { control: { type: "text" } };
      case "number":
        return { control: { type: "number" } };
      case "enum": {
        let { value: i } = o;
        return { control: { type: i?.length <= 5 ? "radio" : "select" }, options: i };
      }
      case "function":
      case "symbol":
        return null;
      default:
        return { control: { type: s ? "select" : "object" } };
    }
  }
}, "inferControl"), ke = /* @__PURE__ */ n((r) => {
  let {
    argTypes: e,
    parameters: { __isArgsStory: t, controls: { include: o = null, exclude: s = null, matchers: i = {} } = {} }
  } = r;
  if (!t)
    return e;
  let a = Qe(e, o, s), l = V(a, (c, d) => c?.type && qs(c, d.toString(), i));
  return N(l, a);
}, "inferControls");
ke.secondPass = !0;

// src/preview-api/modules/store/csf/normalizeProjectAnnotations.ts
function he({
  argTypes: r,
  globalTypes: e,
  argTypesEnhancers: t,
  decorators: o,
  loaders: s,
  beforeEach: i,
  afterEach: a,
  initialGlobals: l,
  ...c
}) {
  return {
    ...r && { argTypes: ne(r) },
    ...e && { globalTypes: ne(e) },
    decorators: C(o),
    loaders: C(s),
    beforeEach: C(i),
    afterEach: C(a),
    argTypesEnhancers: [
      ...t || [],
      Vr,
      // There's an architectural decision to be made regarding embedded addons in core:
      //
      // Option 1: Keep embedded addons but ensure consistency by moving addon-specific code
      // (like inferControls) to live alongside the addon code itself. This maintains the
      // concept of core addons while improving code organization.
      //
      // Option 2: Fully integrate these addons into core, potentially moving UI components
      // into the manager and treating them as core features rather than addons. This is a
      // bigger architectural change requiring careful consideration.
      //
      // For now, we're keeping inferControls here as we need time to properly evaluate
      // these options and their implications. Some features (like Angular's cleanArgsDecorator)
      // currently rely on this behavior.
      //
      // TODO: Make an architectural decision on the handling of core addons
      ke
    ],
    initialGlobals: l,
    ...c
  };
}
n(he, "normalizeProjectAnnotations");

// src/preview-api/modules/store/csf/composeConfigs.ts
import { global as zs } from "@storybook/global";

// src/preview-api/modules/store/csf/beforeAll.ts
var To = /* @__PURE__ */ n((r) => async () => {
  let e = [];
  for (let t of r) {
    let o = await t();
    o && e.unshift(o);
  }
  return async () => {
    for (let t of e)
      await t();
  };
}, "composeBeforeAllHooks");

// src/preview-api/modules/store/csf/stepRunners.ts
function Wr(r) {
  return async (e, t, o) => {
    await r.reduceRight(
      (i, a) => async () => a(e, i, o),
      async () => t(o)
    )();
  };
}
n(Wr, "composeStepRunners");

// src/preview-api/modules/store/csf/composeConfigs.ts
function Me(r, e) {
  return r.map((t) => t.default?.[e] ?? t[e]).filter(Boolean);
}
n(Me, "getField");
function Y(r, e, t = {}) {
  return Me(r, e).reduce((o, s) => {
    let i = C(s);
    return t.reverseFileOrder ? [...i, ...o] : [...o, ...i];
  }, []);
}
n(Y, "getArrayField");
function Ze(r, e) {
  return Object.assign({}, ...Me(r, e));
}
n(Ze, "getObjectField");
function je(r, e) {
  return Me(r, e).pop();
}
n(je, "getSingletonField");
function K(r) {
  let e = Y(r, "argTypesEnhancers"), t = Me(r, "runStep"), o = Y(r, "beforeAll");
  return {
    parameters: N(...Me(r, "parameters")),
    decorators: Y(r, "decorators", {
      reverseFileOrder: !(zs.FEATURES?.legacyDecoratorFileOrder ?? !1)
    }),
    args: Ze(r, "args"),
    argsEnhancers: Y(r, "argsEnhancers"),
    argTypes: Ze(r, "argTypes"),
    argTypesEnhancers: [
      ...e.filter((s) => !s.secondPass),
      ...e.filter((s) => s.secondPass)
    ],
    initialGlobals: Ze(r, "initialGlobals"),
    globalTypes: Ze(r, "globalTypes"),
    loaders: Y(r, "loaders"),
    beforeAll: To(o),
    beforeEach: Y(r, "beforeEach"),
    afterEach: Y(r, "afterEach"),
    render: je(r, "render"),
    renderToCanvas: je(r, "renderToCanvas"),
    applyDecorators: je(r, "applyDecorators"),
    runStep: Wr(t),
    tags: Y(r, "tags"),
    mount: je(r, "mount"),
    testingLibraryRender: je(r, "testingLibraryRender")
  };
}
n(K, "composeConfigs");

// src/preview-api/modules/store/csf/portable-stories.ts
import { isExportStory as Us } from "storybook/internal/csf";
import { getCoreAnnotations as Hs } from "storybook/internal/csf";
import { MountMustBeDestructuredError as Vs } from "storybook/internal/preview-errors";

// src/preview-api/modules/preview-web/render/animation-utils.ts
function er() {
  try {
    return (
      // @ts-expect-error This property exists in Vitest browser mode
      !!globalThis.__vitest_browser__ || !!globalThis.window?.navigator?.userAgent?.match(/StorybookTestRunner/)
    );
  } catch {
    return !1;
  }
}
n(er, "isTestEnvironment");
function ge(r = !0) {
  if (!("document" in globalThis && "createElement" in globalThis.document))
    return () => {
    };
  let e = document.createElement("style");
  e.textContent = `*, *:before, *:after {
    animation: none !important;
  }`, document.head.appendChild(e);
  let t = document.createElement("style");
  return t.textContent = `*, *:before, *:after {
    animation-delay: 0s !important;
    animation-direction: ${r ? "reverse" : "normal"} !important;
    animation-play-state: paused !important;
    transition: none !important;
  }`, document.head.appendChild(t), document.body.clientHeight, document.head.removeChild(e), () => {
    t.parentNode?.removeChild(t);
  };
}
n(ge, "pauseAnimations");
async function be(r) {
  if (!("document" in globalThis && "getAnimations" in globalThis.document && "querySelectorAll" in globalThis.document))
    return;
  let e = !1;
  await Promise.race([
    // After 50ms, retrieve any running animations and wait for them to finish
    // If new animations are created while waiting, we'll wait for them too
    new Promise((t) => {
      setTimeout(() => {
        let o = [globalThis.document, ...xo(globalThis.document)], s = /* @__PURE__ */ n(async () => {
          if (e || r?.aborted)
            return;
          let i = o.flatMap((a) => a?.getAnimations?.() || []).filter((a) => a.playState === "running" && !Bs(a));
          i.length > 0 && (await Promise.all(i.map((a) => a.finished)), await s());
        }, "checkAnimationsFinished");
        s().then(t);
      }, 100);
    }),
    // If animations don't finish within the timeout, continue without waiting
    new Promise(
      (t) => setTimeout(() => {
        e = !0, t(void 0);
      }, 5e3)
    )
  ]);
}
n(be, "waitForAnimations");
function xo(r) {
  return [r, ...r.querySelectorAll("*")].reduce((e, t) => ("shadowRoot" in t && t.shadowRoot && e.push(t.shadowRoot, ...xo(t.shadowRoot)), e),
  []);
}
n(xo, "getShadowRoots");
function Bs(r) {
  if (r instanceof CSSAnimation && r.effect instanceof KeyframeEffect && r.effect.target) {
    let e = getComputedStyle(r.effect.target, r.effect.pseudoElement), t = e.animationName?.split(", ").indexOf(r.animationName);
    return e.animationIterationCount.split(", ")[t] === "infinite";
  }
  return !1;
}
n(Bs, "isInfiniteAnimation");

// src/preview-api/modules/store/reporter-api.ts
var $r = class $r {
  constructor() {
    this.reports = [];
  }
  async addReport(e) {
    this.reports.push(e);
  }
};
n($r, "ReporterAPI");
var se = $r;

// src/preview-api/modules/store/csf/csf-factory-utils.ts
import { isStory as Gs } from "storybook/internal/csf";
function Yr(r, e, t) {
  return Gs(r) ? {
    story: r.input,
    meta: r.meta.input,
    preview: r.meta.preview.composed
  } : { story: r, meta: e, preview: t };
}
n(Yr, "getCsfFactoryAnnotations");

// src/preview-api/modules/store/csf/portable-stories.ts
function Ws(r) {
  globalThis.defaultProjectAnnotations = r;
}
n(Ws, "setDefaultProjectAnnotations");
var $s = "ComposedStory", Ys = "Unnamed Story";
function Ks(r) {
  return r ? K([r]) : {};
}
n(Ks, "extractAnnotation");
function Xs(r) {
  let e = Array.isArray(r) ? r : [r];
  return globalThis.globalProjectAnnotations = K([
    ...Hs(),
    globalThis.defaultProjectAnnotations ?? {},
    K(e.map(Ks))
  ]), globalThis.globalProjectAnnotations ?? {};
}
n(Xs, "setProjectAnnotations");
var X = [];
function Ro(r, e, t, o, s) {
  if (r === void 0)
    throw new Error("Expected a story but received undefined.");
  e.title = e.title ?? $s;
  let i = Oe(e), a = s || r.storyName || r.story?.name || r.name || Ys, l = me(
    a,
    r,
    i
  ), c = he(
    K([
      o ?? globalThis.globalProjectAnnotations ?? {},
      t ?? {}
    ])
  ), d = De(
    l,
    i,
    c
  ), u = {
    ...$e(c.globalTypes),
    ...c.initialGlobals,
    ...d.storyGlobals
  }, y = new se(), h = /* @__PURE__ */ n(() => {
    let f = Je({
      hooks: new te(),
      globals: u,
      args: { ...d.initialArgs },
      viewMode: "story",
      reporting: y,
      loaded: {},
      abortSignal: new AbortController().signal,
      step: /* @__PURE__ */ n((S, R) => d.runStep(S, R, f), "step"),
      canvasElement: null,
      canvas: {},
      userEvent: {},
      globalTypes: c.globalTypes,
      ...d,
      context: null,
      mount: null
    });
    return f.parameters.__isPortableStory = !0, f.context = f, d.renderToCanvas && (f.renderToCanvas = async () => {
      let S = await d.renderToCanvas?.(
        {
          componentId: d.componentId,
          title: d.title,
          id: d.id,
          name: d.name,
          tags: d.tags,
          showMain: /* @__PURE__ */ n(() => {
          }, "showMain"),
          showError: /* @__PURE__ */ n((R) => {
            throw new Error(`${R.title}
${R.description}`);
          }, "showError"),
          showException: /* @__PURE__ */ n((R) => {
            throw R;
          }, "showException"),
          forceRemount: !0,
          storyContext: f,
          storyFn: /* @__PURE__ */ n(() => d.unboundStoryFn(f), "storyFn"),
          unboundStoryFn: d.unboundStoryFn
        },
        f.canvasElement
      );
      S && X.push(S);
    }), f.mount = d.mount(f), f;
  }, "initializeContext"), g, b = /* @__PURE__ */ n(async (f) => {
    let S = h();
    return S.canvasElement ??= globalThis?.document?.body, g && (S.loaded = g.loaded), Object.assign(S, f), d.playFunction(S);
  }, "play"), m = /* @__PURE__ */ n((f) => {
    let S = h();
    return Object.assign(S, f), ei(d, S);
  }, "run"), T = d.playFunction ? b : void 0;
  return Object.assign(
    /* @__PURE__ */ n(function(S) {
      let R = h();
      return g && (R.loaded = g.loaded), R.args = {
        ...R.initialArgs,
        ...S
      }, d.unboundStoryFn(R);
    }, "storyFn"),
    {
      id: d.id,
      storyName: a,
      load: /* @__PURE__ */ n(async () => {
        for (let S of [...X].reverse())
          await S();
        X.length = 0;
        let f = h();
        f.loaded = await d.applyLoaders(f), X.push(...(await d.applyBeforeEach(f)).filter(Boolean)), g = f;
      }, "load"),
      globals: u,
      args: d.initialArgs,
      parameters: d.parameters,
      argTypes: d.argTypes,
      play: T,
      run: m,
      reporting: y,
      tags: d.tags
    }
  );
}
n(Ro, "composeStory");
var Js = /* @__PURE__ */ n((r, e, t, o) => Ro(r, e, t, {}, o), "defaultComposeStory");
function Qs(r, e, t = Js) {
  let { default: o, __esModule: s, __namedExportsOrder: i, ...a } = r, l = o;
  return Object.entries(a).reduce(
    (d, [p, u]) => {
      let { story: y, meta: h } = Yr(u);
      return !l && h && (l = h), Us(p, l) ? Object.assign(d, {
        [p]: t(y, l, e, p)
      }) : d;
    },
    {}
  );
}
n(Qs, "composeStories");
function Zs(r) {
  return r.extend({
    mount: /* @__PURE__ */ n(async ({ mount: e, page: t }, o) => {
      await o(async (s, ...i) => {
        if (!("__pw_type" in s) || "__pw_type" in s && s.__pw_type !== "jsx")
          throw new Error(P`
              Portable stories in Playwright CT only work when referencing JSX elements.
              Please use JSX format for your components such as:

              instead of:
              await mount(MyComponent, { props: { foo: 'bar' } })

              do:
              await mount(<MyComponent foo="bar"/>)

              More info: https://storybook.js.org/docs/api/portable-stories/portable-stories-playwright?ref=error
            `);
        let { props: a, ...l } = s;
        await t.evaluate(async (d) => {
          let p = await globalThis.__pwUnwrapObject?.(d);
          return ("__pw_type" in p ? p.type : p)?.load?.();
        }, l);
        let c = await e(s, ...i);
        return await t.evaluate(async (d) => {
          let p = await globalThis.__pwUnwrapObject?.(d), u = "__pw_type" in p ? p.type : p, y = document.querySelector("#root");
          return u?.play?.({ canvasElement: y });
        }, l), c;
      });
    }, "mount")
  });
}
n(Zs, "createPlaywrightTest");
async function ei(r, e) {
  for (let i of [...X].reverse())
    await i();
  if (X.length = 0, !e.canvasElement) {
    let i = document.createElement("div");
    globalThis?.document?.body?.appendChild(i), e.canvasElement = i, X.push(() => {
      globalThis?.document?.body?.contains(i) && globalThis?.document?.body?.removeChild(i);
    });
  }
  if (e.loaded = await r.applyLoaders(e), e.abortSignal.aborted)
    return;
  X.push(...(await r.applyBeforeEach(e)).filter(Boolean));
  let t = r.playFunction, o = r.usesMount;
  if (o || await e.mount(), e.abortSignal.aborted)
    return;
  t && (o || (e.mount = async () => {
    throw new Vs({ playFunction: t.toString() });
  }), await t(e));
  let s;
  er() ? s = ge() : await be(e.abortSignal), await r.applyAfterEach(e), await s?.();
}
n(ei, "runStory");

// src/preview-api/modules/store/StoryStore.ts
var wo = 1e3, ni = 1e4, Kr = class Kr {
  constructor(e, t, o) {
    this.importFn = t;
    this.storyIndex = new Ke(e), this.projectAnnotations = he(
      K([...ri(), o])
    );
    let { initialGlobals: s, globalTypes: i } = this.projectAnnotations;
    this.args = new We(), this.userGlobals = new Ye({ globals: s, globalTypes: i }), this.hooks = {}, this.cleanupCallbacks = {}, this.processCSFFileWithCache =
    (0, rr.default)(wo)(fo), this.prepareMetaWithCache = (0, rr.default)(wo)(Ur), this.prepareStoryWithCache = (0, rr.default)(ni)(De);
  }
  setProjectAnnotations(e) {
    this.projectAnnotations = he(e);
    let { initialGlobals: t, globalTypes: o } = e;
    this.userGlobals.set({ globals: t, globalTypes: o });
  }
  // This means that one of the CSF files has changed.
  // If the `importFn` has changed, we will invalidate both caches.
  // If the `storyIndex` data has changed, we may or may not invalidate the caches, depending
  // on whether we've loaded the relevant files yet.
  async onStoriesChanged({
    importFn: e,
    storyIndex: t
  }) {
    e && (this.importFn = e), t && (this.storyIndex.entries = t.entries), this.cachedCSFFiles && await this.cacheAllCSFFiles();
  }
  // Get an entry from the index, waiting on initialization if necessary
  async storyIdToEntry(e) {
    return this.storyIndex.storyIdToEntry(e);
  }
  // To load a single CSF file to service a story we need to look up the importPath in the index
  async loadCSFFileByStoryId(e) {
    let { importPath: t, title: o } = this.storyIndex.storyIdToEntry(e), s = await this.importFn(t);
    return this.processCSFFileWithCache(s, t, o);
  }
  async loadAllCSFFiles() {
    let e = {};
    return Object.entries(this.storyIndex.entries).forEach(([o, { importPath: s }]) => {
      e[s] = o;
    }), (await Promise.all(
      Object.entries(e).map(async ([o, s]) => ({
        importPath: o,
        csfFile: await this.loadCSFFileByStoryId(s)
      }))
    )).reduce(
      (o, { importPath: s, csfFile: i }) => (o[s] = i, o),
      {}
    );
  }
  async cacheAllCSFFiles() {
    this.cachedCSFFiles = await this.loadAllCSFFiles();
  }
  preparedMetaFromCSFFile({ csfFile: e }) {
    let t = e.meta;
    return this.prepareMetaWithCache(
      t,
      this.projectAnnotations,
      e.moduleExports.default
    );
  }
  // Load the CSF file for a story and prepare the story from it and the project annotations.
  async loadStory({ storyId: e }) {
    let t = await this.loadCSFFileByStoryId(e);
    return this.storyFromCSFFile({ storyId: e, csfFile: t });
  }
  // This function is synchronous for convenience -- often times if you have a CSF file already
  // it is easier not to have to await `loadStory`.
  storyFromCSFFile({
    storyId: e,
    csfFile: t
  }) {
    let o = t.stories[e];
    if (!o)
      throw new oi({ storyId: e });
    let s = t.meta, i = this.prepareStoryWithCache(
      o,
      s,
      t.projectAnnotations ?? this.projectAnnotations
    );
    return this.args.setInitial(i), this.hooks[i.id] = this.hooks[i.id] || new te(), i;
  }
  // If we have a CSF file we can get all the stories from it synchronously
  componentStoriesFromCSFFile({
    csfFile: e
  }) {
    return Object.keys(this.storyIndex.entries).filter((t) => !!e.stories[t]).map((t) => this.storyFromCSFFile({ storyId: t, csfFile: e }));
  }
  async loadEntry(e) {
    let t = await this.storyIdToEntry(e), o = t.type === "docs" ? t.storiesImports : [], [s, ...i] = await Promise.all([
      this.importFn(t.importPath),
      ...o.map((a) => {
        let l = this.storyIndex.importPathToEntry(a);
        return this.loadCSFFileByStoryId(l.id);
      })
    ]);
    return { entryExports: s, csfFiles: i };
  }
  // A prepared story does not include args, globals or hooks. These are stored in the story store
  // and updated separtely to the (immutable) story.
  getStoryContext(e, { forceInitialArgs: t = !1 } = {}) {
    let o = this.userGlobals.get(), { initialGlobals: s } = this.userGlobals, i = new se();
    return Je({
      ...e,
      args: t ? e.initialArgs : this.args.get(e.id),
      initialGlobals: s,
      globalTypes: this.projectAnnotations.globalTypes,
      userGlobals: o,
      reporting: i,
      globals: {
        ...o,
        ...e.storyGlobals
      },
      hooks: this.hooks[e.id]
    });
  }
  addCleanupCallbacks(e, ...t) {
    this.cleanupCallbacks[e.id] = (this.cleanupCallbacks[e.id] || []).concat(t);
  }
  async cleanupStory(e) {
    this.hooks[e.id].clean();
    let t = this.cleanupCallbacks[e.id];
    if (t)
      for (let o of [...t].reverse())
        await o();
    delete this.cleanupCallbacks[e.id];
  }
  extract(e = { includeDocsOnly: !1 }) {
    let { cachedCSFFiles: t } = this;
    if (!t)
      throw new ti();
    return Object.entries(this.storyIndex.entries).reduce(
      (o, [s, { type: i, importPath: a }]) => {
        if (i === "docs")
          return o;
        let l = t[a], c = this.storyFromCSFFile({ storyId: s, csfFile: l });
        return !e.includeDocsOnly && c.parameters.docsOnly || (o[s] = Object.entries(c).reduce(
          (d, [p, u]) => p === "moduleExport" || typeof u == "function" ? d : Array.isArray(u) ? Object.assign(d, { [p]: u.slice().sort() }) :
          Object.assign(d, { [p]: u }),
          {
            //
            args: c.initialArgs,
            globals: {
              ...this.userGlobals.initialGlobals,
              ...this.userGlobals.globals,
              ...c.storyGlobals
            }
          }
        )), o;
      },
      {}
    );
  }
};
n(Kr, "StoryStore");
var Se = Kr;

// src/preview-api/modules/store/autoTitle.ts
import { once as si } from "storybook/internal/client-logger";

// ../node_modules/slash/index.js
function Xr(r) {
  return r.startsWith("\\\\?\\") ? r : r.replace(/\\/g, "/");
}
n(Xr, "slash");

// src/preview-api/modules/store/autoTitle.ts
var ii = /* @__PURE__ */ n((r) => {
  if (r.length === 0)
    return r;
  let e = r[r.length - 1], t = e?.replace(/(?:[.](?:story|stories))?([.][^.]+)$/i, "");
  if (r.length === 1)
    return [t];
  let o = r[r.length - 2];
  return t && o && t.toLowerCase() === o.toLowerCase() ? [...r.slice(0, -2), t] : t && (/^(story|stories)([.][^.]+)$/i.test(e) || /^index$/i.
  test(t)) ? r.slice(0, -1) : [...r.slice(0, -1), t];
}, "sanitize");
function Ao(r) {
  return r.flatMap((e) => e.split("/")).filter(Boolean).join("/");
}
n(Ao, "pathJoin");
var Eo = /* @__PURE__ */ n((r, e, t) => {
  let { directory: o, importPathMatcher: s, titlePrefix: i = "" } = e || {};
  typeof r == "number" && si.warn(P`
      CSF Auto-title received a numeric fileName. This typically happens when
      webpack is mis-configured in production mode. To force webpack to produce
      filenames, set optimization.moduleIds = "named" in your webpack config.
    `);
  let a = Xr(String(r));
  if (s.exec(a)) {
    if (!t) {
      let l = a.replace(o, ""), c = Ao([i, l]).split("/");
      return c = ii(c), c.join("/");
    }
    return i ? Ao([i, t]) : t;
  }
}, "userOrAutoTitleFromSpecifier"), ai = /* @__PURE__ */ n((r, e, t) => {
  for (let o = 0; o < e.length; o += 1) {
    let s = Eo(r, e[o], t);
    if (s)
      return s;
  }
  return t || void 0;
}, "userOrAutoTitle");

// src/preview-api/modules/store/storySort.ts
var Co = /\s*\/\s*/, vo = /* @__PURE__ */ n((r = {}) => (e, t) => {
  if (e.title === t.title && !r.includeNames)
    return 0;
  let o = r.method || "configure", s = r.order || [], i = e.title.trim().split(Co), a = t.title.trim().split(Co);
  r.includeNames && (i.push(e.name), a.push(t.name));
  let l = 0;
  for (; i[l] || a[l]; ) {
    if (!i[l])
      return -1;
    if (!a[l])
      return 1;
    let c = i[l], d = a[l];
    if (c !== d) {
      let u = s.indexOf(c), y = s.indexOf(d), h = s.indexOf("*");
      return u !== -1 || y !== -1 ? (u === -1 && (h !== -1 ? u = h : u = s.length), y === -1 && (h !== -1 ? y = h : y = s.length), u - y) : o ===
      "configure" ? 0 : c.localeCompare(d, r.locales ? r.locales : void 0, {
        numeric: !0,
        sensitivity: "accent"
      });
    }
    let p = s.indexOf(c);
    p === -1 && (p = s.indexOf("*")), s = p !== -1 && Array.isArray(s[p + 1]) ? s[p + 1] : [], l += 1;
  }
  return 0;
}, "storySort");

// src/preview-api/modules/store/sortStories.ts
var li = /* @__PURE__ */ n((r, e, t) => {
  if (e) {
    let o;
    typeof e == "function" ? o = e : o = vo(e), r.sort(o);
  } else
    r.sort(
      (o, s) => t.indexOf(o.importPath) - t.indexOf(s.importPath)
    );
  return r;
}, "sortStoriesCommon"), ci = /* @__PURE__ */ n((r, e, t) => {
  try {
    return li(r, e, t);
  } catch (o) {
    throw new Error(P`
    Error sorting stories with sort parameter ${e}:

    > ${o.message}
    
    Are you using a V6-style sort function in V7 mode?

    More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#v7-style-story-sort
  `);
  }
}, "sortStoriesV7");

// src/preview-api/modules/preview-web/Preview.tsx
import { deprecate as mi, logger as Do } from "storybook/internal/client-logger";
import {
  ARGTYPES_INFO_REQUEST as hi,
  ARGTYPES_INFO_RESPONSE as ko,
  CONFIG_ERROR as gi,
  FORCE_REMOUNT as bi,
  FORCE_RE_RENDER as Si,
  GLOBALS_UPDATED as jo,
  RESET_STORY_ARGS as Ti,
  SET_GLOBALS as xi,
  STORY_ARGS_UPDATED as Ri,
  STORY_HOT_UPDATED as wi,
  STORY_INDEX_INVALIDATED as Ai,
  UPDATE_GLOBALS as Ei,
  UPDATE_STORY_ARGS as Ci
} from "storybook/internal/core-events";
import {
  CalledPreviewMethodBeforeInitializationError as W,
  MissingRenderToCanvasError as vi,
  StoryIndexFetchError as Pi,
  StoryStoreAccessedBeforeInitializationError as Fi
} from "storybook/internal/preview-errors";
import { global as Ii } from "@storybook/global";

// src/preview-api/modules/preview-web/render/StoryRender.ts
import {
  PLAY_FUNCTION_THREW_EXCEPTION as di,
  STORY_FINISHED as Po,
  STORY_RENDERED as pi,
  STORY_RENDER_PHASE_CHANGED as Fo,
  UNHANDLED_ERRORS_WHILE_PLAYING as ui
} from "storybook/internal/core-events";
import {
  MountMustBeDestructuredError as fi,
  NoStoryMountedError as yi
} from "storybook/internal/preview-errors";

// src/preview-api/modules/preview-web/render/Render.ts
var J = new Error("prepareAborted");

// src/preview-api/modules/preview-web/render/StoryRender.ts
var { AbortController: Io } = globalThis;
function Oo(r) {
  try {
    let { name: e = "Error", message: t = String(r), stack: o } = r;
    return { name: e, message: t, stack: o };
  } catch {
    return { name: "Error", message: String(r) };
  }
}
n(Oo, "serializeError");
var Jr = class Jr {
  constructor(e, t, o, s, i, a, l = { autoplay: !0, forceInitialArgs: !1 }, c) {
    this.channel = e;
    this.store = t;
    this.renderToScreen = o;
    this.callbacks = s;
    this.id = i;
    this.viewMode = a;
    this.renderOptions = l;
    this.type = "story";
    this.notYetRendered = !0;
    this.rerenderEnqueued = !1;
    this.disableKeyListeners = !1;
    this.teardownRender = /* @__PURE__ */ n(() => {
    }, "teardownRender");
    this.torndown = !1;
    this.abortController = new Io(), this.renderId = Date.now(), c && (this.story = c, this.phase = "preparing");
  }
  async runPhase(e, t, o) {
    this.phase = t, this.channel.emit(Fo, {
      newPhase: this.phase,
      renderId: this.renderId,
      storyId: this.id
    }), o && (await o(), this.checkIfAborted(e));
  }
  checkIfAborted(e) {
    return e.aborted ? (this.phase = "aborted", this.channel.emit(Fo, {
      newPhase: this.phase,
      renderId: this.renderId,
      storyId: this.id
    }), !0) : !1;
  }
  async prepare() {
    if (await this.runPhase(this.abortController.signal, "preparing", async () => {
      this.story = await this.store.loadStory({ storyId: this.id });
    }), this.abortController.signal.aborted)
      throw await this.store.cleanupStory(this.story), J;
  }
  // The two story "renders" are equal and have both loaded the same story
  isEqual(e) {
    return !!(this.id === e.id && this.story && this.story === e.story);
  }
  isPreparing() {
    return ["preparing"].includes(this.phase);
  }
  isPending() {
    return ["loading", "beforeEach", "rendering", "playing", "afterEach"].includes(
      this.phase
    );
  }
  async renderToElement(e) {
    return this.canvasElement = e, this.render({ initial: !0, forceRemount: !0 });
  }
  storyContext() {
    if (!this.story)
      throw new Error("Cannot call storyContext before preparing");
    let { forceInitialArgs: e } = this.renderOptions;
    return this.store.getStoryContext(this.story, { forceInitialArgs: e });
  }
  async render({
    initial: e = !1,
    forceRemount: t = !1
  } = {}) {
    let { canvasElement: o } = this;
    if (!this.story)
      throw new Error("cannot render when not prepared");
    let s = this.story;
    if (!o)
      throw new Error("cannot render when canvasElement is unset");
    let {
      id: i,
      componentId: a,
      title: l,
      name: c,
      tags: d,
      applyLoaders: p,
      applyBeforeEach: u,
      applyAfterEach: y,
      unboundStoryFn: h,
      playFunction: g,
      runStep: b
    } = s;
    t && !e && (this.cancelRender(), this.abortController = new Io());
    let m = this.abortController.signal, T = !1, x = s.usesMount;
    try {
      let f = {
        ...this.storyContext(),
        viewMode: this.viewMode,
        abortSignal: m,
        canvasElement: o,
        loaded: {},
        step: /* @__PURE__ */ n((v, B) => b(v, B, f), "step"),
        context: null,
        canvas: {},
        userEvent: {},
        renderToCanvas: /* @__PURE__ */ n(async () => {
          let v = await this.renderToScreen(S, o);
          this.teardownRender = v || (() => {
          }), T = !0;
        }, "renderToCanvas"),
        // The story provides (set in a renderer) a mount function that is a higher order function
        // (context) => (...args) => Canvas
        //
        // Before assigning it to the context, we resolve the context dependency,
        // so that a user can just call it as await mount(...args) in their play function.
        mount: /* @__PURE__ */ n(async (...v) => {
          this.callbacks.showStoryDuringRender?.();
          let B = null;
          return await this.runPhase(m, "rendering", async () => {
            B = await s.mount(f)(...v);
          }), x && await this.runPhase(m, "playing"), B;
        }, "mount")
      };
      f.context = f;
      let S = {
        componentId: a,
        title: l,
        kind: l,
        id: i,
        name: c,
        story: c,
        tags: d,
        ...this.callbacks,
        showError: /* @__PURE__ */ n((v) => (this.phase = "errored", this.callbacks.showError(v)), "showError"),
        showException: /* @__PURE__ */ n((v) => (this.phase = "errored", this.callbacks.showException(v)), "showException"),
        forceRemount: t || this.notYetRendered,
        storyContext: f,
        storyFn: /* @__PURE__ */ n(() => h(f), "storyFn"),
        unboundStoryFn: h
      };
      if (await this.runPhase(m, "loading", async () => {
        f.loaded = await p(f);
      }), m.aborted)
        return;
      let R = await u(f);
      if (this.store.addCleanupCallbacks(s, ...R), this.checkIfAborted(m) || (!T && !x && await f.mount(), this.notYetRendered = !1, m.aborted))
        return;
      let w = this.story.parameters?.test?.dangerouslyIgnoreUnhandledErrors === !0, E = /* @__PURE__ */ new Set(), D = /* @__PURE__ */ n((v) => {
        v.error && E.add(v.error);
      }, "onError"), k = /* @__PURE__ */ n((v) => {
        v.reason && E.add(v.reason);
      }, "onUnhandledRejection");
      if (this.renderOptions.autoplay && t && g && this.phase !== "errored") {
        window?.addEventListener?.("error", D), window?.addEventListener?.("unhandledrejection", k), this.disableKeyListeners = !0;
        try {
          if (x ? await g(f) : (f.mount = async () => {
            throw new fi({ playFunction: g.toString() });
          }, await this.runPhase(m, "playing", async () => g(f))), !T)
            throw new yi();
          this.checkIfAborted(m), !w && E.size > 0 ? await this.runPhase(m, "errored") : await this.runPhase(m, "played");
        } catch (v) {
          if (this.callbacks.showStoryDuringRender?.(), await this.runPhase(m, "errored", async () => {
            this.channel.emit(di, Oo(v));
          }), this.story.parameters.throwPlayFunctionExceptions !== !1)
            throw v;
          console.error(v);
        }
        if (!w && E.size > 0 && this.channel.emit(
          ui,
          Array.from(E).map(Oo)
        ), this.disableKeyListeners = !1, window?.removeEventListener?.("unhandledrejection", k), window?.removeEventListener?.("error", D),
        m.aborted)
          return;
      }
      await this.runPhase(m, "completing", async () => {
        er() ? this.store.addCleanupCallbacks(s, ge()) : await be(m);
      }), await this.runPhase(m, "completed", async () => {
        this.channel.emit(pi, i);
      }), this.phase !== "errored" && await this.runPhase(m, "afterEach", async () => {
        await y(f);
      });
      let L = !w && E.size > 0, pe = f.reporting.reports.some(
        (v) => v.status === "failed"
      ), q = L || pe;
      await this.runPhase(
        m,
        "finished",
        async () => this.channel.emit(Po, {
          storyId: i,
          status: q ? "error" : "success",
          reporters: f.reporting.reports
        })
      );
    } catch (f) {
      this.phase = "errored", this.callbacks.showException(f), await this.runPhase(
        m,
        "finished",
        async () => this.channel.emit(Po, {
          storyId: i,
          status: "error",
          reporters: []
        })
      );
    }
    this.rerenderEnqueued && (this.rerenderEnqueued = !1, this.render());
  }
  /**
   * Rerender the story. If the story is currently pending (loading/rendering), the rerender will be
   * enqueued, and will be executed after the current render is completed. Rerendering while playing
   * will not be enqueued, and will be executed immediately, to support rendering args changes while
   * playing.
   */
  async rerender() {
    if (this.isPending() && this.phase !== "playing")
      this.rerenderEnqueued = !0;
    else
      return this.render();
  }
  async remount() {
    return await this.teardown(), this.render({ forceRemount: !0 });
  }
  // If the story is torn down (either a new story is rendered or the docs page removes it)
  // we need to consider the fact that the initial render may not be finished
  // (possibly the loaders or the play function are still running). We use the controller
  // as a method to abort them, ASAP, but this is not foolproof as we cannot control what
  // happens inside the user's code.
  cancelRender() {
    this.abortController.abort();
  }
  cancelPlayFunction() {
    this.phase === "playing" && (this.abortController.abort(), this.runPhase(this.abortController.signal, "aborted"));
  }
  async teardown() {
    this.torndown = !0, this.cancelRender(), this.story && await this.store.cleanupStory(this.story);
    for (let e = 0; e < 3; e += 1) {
      if (!this.isPending()) {
        await this.teardownRender();
        return;
      }
      await new Promise((t) => setTimeout(t, 0));
    }
    window?.location?.reload?.(), await new Promise(() => {
    });
  }
};
n(Jr, "StoryRender");
var ie = Jr;

// src/preview-api/modules/preview-web/Preview.tsx
var { fetch: Oi } = Ii, Di = "./index.json", Qr = class Qr {
  constructor(e, t, o = _.getChannel(), s = !0) {
    this.importFn = e;
    this.getProjectAnnotations = t;
    this.channel = o;
    this.storyRenders = [];
    this.storeInitializationPromise = new Promise((i, a) => {
      this.resolveStoreInitializationPromise = i, this.rejectStoreInitializationPromise = a;
    }), s && this.initialize();
  }
  // Create a proxy object for `__STORYBOOK_STORY_STORE__` and `__STORYBOOK_PREVIEW__.storyStore`
  // That proxies through to the store once ready, and errors beforehand. This means we can set
  // `__STORYBOOK_STORY_STORE__ = __STORYBOOK_PREVIEW__.storyStore` without having to wait, and
  // similarly integrators can access the `storyStore` on the preview at any time, although
  // it is considered deprecated and we will no longer allow access in 9.0
  get storyStore() {
    return new Proxy(
      {},
      {
        get: /* @__PURE__ */ n((e, t) => {
          if (this.storyStoreValue)
            return mi("Accessing the Story Store is deprecated and will be removed in 9.0"), this.storyStoreValue[t];
          throw new Fi();
        }, "get")
      }
    );
  }
  // INITIALIZATION
  async initialize() {
    this.setupListeners();
    try {
      let e = await this.getProjectAnnotationsOrRenderError();
      await this.runBeforeAllHook(e), await this.initializeWithProjectAnnotations(e);
    } catch (e) {
      this.rejectStoreInitializationPromise(e);
    }
  }
  ready() {
    return this.storeInitializationPromise;
  }
  setupListeners() {
    this.channel.on(Ai, this.onStoryIndexChanged.bind(this)), this.channel.on(Ei, this.onUpdateGlobals.bind(this)), this.channel.on(Ci, this.
    onUpdateArgs.bind(this)), this.channel.on(hi, this.onRequestArgTypesInfo.bind(this)), this.channel.on(Ti, this.onResetArgs.bind(this)), this.
    channel.on(Si, this.onForceReRender.bind(this)), this.channel.on(bi, this.onForceRemount.bind(this)), this.channel.on(wi, this.onStoryHotUpdated.
    bind(this));
  }
  async getProjectAnnotationsOrRenderError() {
    try {
      let e = await this.getProjectAnnotations();
      if (this.renderToCanvas = e.renderToCanvas, !this.renderToCanvas)
        throw new vi();
      return e;
    } catch (e) {
      throw this.renderPreviewEntryError("Error reading preview.js:", e), e;
    }
  }
  // If initialization gets as far as project annotations, this function runs.
  async initializeWithProjectAnnotations(e) {
    this.projectAnnotationsBeforeInitialization = e;
    try {
      let t = await this.getStoryIndexFromServer();
      return this.initializeWithStoryIndex(t);
    } catch (t) {
      throw this.renderPreviewEntryError("Error loading story index:", t), t;
    }
  }
  async runBeforeAllHook(e) {
    try {
      await this.beforeAllCleanup?.(), this.beforeAllCleanup = await e.beforeAll?.();
    } catch (t) {
      throw this.renderPreviewEntryError("Error in beforeAll hook:", t), t;
    }
  }
  async getStoryIndexFromServer() {
    let e = await Oi(Di);
    if (e.status === 200)
      return e.json();
    throw new Pi({ text: await e.text() });
  }
  // If initialization gets as far as the story index, this function runs.
  initializeWithStoryIndex(e) {
    if (!this.projectAnnotationsBeforeInitialization)
      throw new Error("Cannot call initializeWithStoryIndex until project annotations resolve");
    this.storyStoreValue = new Se(
      e,
      this.importFn,
      this.projectAnnotationsBeforeInitialization
    ), delete this.projectAnnotationsBeforeInitialization, this.setInitialGlobals(), this.resolveStoreInitializationPromise();
  }
  async setInitialGlobals() {
    this.emitGlobals();
  }
  emitGlobals() {
    if (!this.storyStoreValue)
      throw new W({ methodName: "emitGlobals" });
    let e = {
      globals: this.storyStoreValue.userGlobals.get() || {},
      globalTypes: this.storyStoreValue.projectAnnotations.globalTypes || {}
    };
    this.channel.emit(xi, e);
  }
  // EVENT HANDLERS
  // This happens when a config file gets reloaded
  async onGetProjectAnnotationsChanged({
    getProjectAnnotations: e
  }) {
    delete this.previewEntryError, this.getProjectAnnotations = e;
    let t = await this.getProjectAnnotationsOrRenderError();
    if (await this.runBeforeAllHook(t), !this.storyStoreValue) {
      await this.initializeWithProjectAnnotations(t);
      return;
    }
    this.storyStoreValue.setProjectAnnotations(t), this.emitGlobals();
  }
  async onStoryIndexChanged() {
    if (delete this.previewEntryError, !(!this.storyStoreValue && !this.projectAnnotationsBeforeInitialization))
      try {
        let e = await this.getStoryIndexFromServer();
        if (this.projectAnnotationsBeforeInitialization) {
          this.initializeWithStoryIndex(e);
          return;
        }
        await this.onStoriesChanged({ storyIndex: e });
      } catch (e) {
        throw this.renderPreviewEntryError("Error loading story index:", e), e;
      }
  }
  // This happens when a glob gets HMR-ed
  async onStoriesChanged({
    importFn: e,
    storyIndex: t
  }) {
    if (!this.storyStoreValue)
      throw new W({ methodName: "onStoriesChanged" });
    await this.storyStoreValue.onStoriesChanged({ importFn: e, storyIndex: t });
  }
  async onUpdateGlobals({
    globals: e,
    currentStory: t
  }) {
    if (this.storyStoreValue || await this.storeInitializationPromise, !this.storyStoreValue)
      throw new W({ methodName: "onUpdateGlobals" });
    if (this.storyStoreValue.userGlobals.update(e), t) {
      let { initialGlobals: o, storyGlobals: s, userGlobals: i, globals: a } = this.storyStoreValue.getStoryContext(t);
      this.channel.emit(jo, {
        initialGlobals: o,
        userGlobals: i,
        storyGlobals: s,
        globals: a
      });
    } else {
      let { initialGlobals: o, globals: s } = this.storyStoreValue.userGlobals;
      this.channel.emit(jo, {
        initialGlobals: o,
        userGlobals: s,
        storyGlobals: {},
        globals: s
      });
    }
    await Promise.all(this.storyRenders.map((o) => o.rerender()));
  }
  async onUpdateArgs({ storyId: e, updatedArgs: t }) {
    if (!this.storyStoreValue)
      throw new W({ methodName: "onUpdateArgs" });
    this.storyStoreValue.args.update(e, t), await Promise.all(
      this.storyRenders.filter((o) => o.id === e && !o.renderOptions.forceInitialArgs).map(
        (o) => (
          // We only run the play function, with in a force remount.
          // But when mount is destructured, the rendering happens inside of the play function.
          o.story && o.story.usesMount ? o.remount() : o.rerender()
        )
      )
    ), this.channel.emit(Ri, {
      storyId: e,
      args: this.storyStoreValue.args.get(e)
    });
  }
  async onRequestArgTypesInfo({ id: e, payload: t }) {
    try {
      await this.storeInitializationPromise;
      let o = await this.storyStoreValue?.loadStory(t);
      this.channel.emit(ko, {
        id: e,
        success: !0,
        payload: { argTypes: o?.argTypes || {} },
        error: null
      });
    } catch (o) {
      this.channel.emit(ko, {
        id: e,
        success: !1,
        error: o?.message
      });
    }
  }
  async onResetArgs({ storyId: e, argNames: t }) {
    if (!this.storyStoreValue)
      throw new W({ methodName: "onResetArgs" });
    let s = this.storyRenders.find((l) => l.id === e)?.story || await this.storyStoreValue.loadStory({ storyId: e }), a = (t || [
      .../* @__PURE__ */ new Set([
        ...Object.keys(s.initialArgs),
        ...Object.keys(this.storyStoreValue.args.get(e))
      ])
    ]).reduce((l, c) => (l[c] = s.initialArgs[c], l), {});
    await this.onUpdateArgs({ storyId: e, updatedArgs: a });
  }
  // ForceReRender does not include a story id, so we simply must
  // re-render all stories in case they are relevant
  async onForceReRender() {
    await Promise.all(this.storyRenders.map((e) => e.rerender()));
  }
  async onForceRemount({ storyId: e }) {
    await Promise.all(this.storyRenders.filter((t) => t.id === e).map((t) => t.remount()));
  }
  async onStoryHotUpdated() {
    await Promise.all(this.storyRenders.map((e) => e.cancelPlayFunction()));
  }
  // Used by docs to render a story to a given element
  // Note this short-circuits the `prepare()` phase of the StoryRender,
  // main to be consistent with the previous behaviour. In the future,
  // we will change it to go ahead and load the story, which will end up being
  // "instant", although async.
  renderStoryToElement(e, t, o, s) {
    if (!this.renderToCanvas || !this.storyStoreValue)
      throw new W({
        methodName: "renderStoryToElement"
      });
    let i = new ie(
      this.channel,
      this.storyStoreValue,
      this.renderToCanvas,
      o,
      e.id,
      "docs",
      s,
      e
    );
    return i.renderToElement(t), this.storyRenders.push(i), async () => {
      await this.teardownRender(i);
    };
  }
  async teardownRender(e, { viewModeChanged: t } = {}) {
    this.storyRenders = this.storyRenders.filter((o) => o !== e), await e?.teardown?.({ viewModeChanged: t });
  }
  // API
  async loadStory({ storyId: e }) {
    if (!this.storyStoreValue)
      throw new W({ methodName: "loadStory" });
    return this.storyStoreValue.loadStory({ storyId: e });
  }
  getStoryContext(e, { forceInitialArgs: t = !1 } = {}) {
    if (!this.storyStoreValue)
      throw new W({ methodName: "getStoryContext" });
    return this.storyStoreValue.getStoryContext(e, { forceInitialArgs: t });
  }
  async extract(e) {
    if (!this.storyStoreValue)
      throw new W({ methodName: "extract" });
    if (this.previewEntryError)
      throw this.previewEntryError;
    return await this.storyStoreValue.cacheAllCSFFiles(), this.storyStoreValue.extract(e);
  }
  // UTILITIES
  renderPreviewEntryError(e, t) {
    this.previewEntryError = t, Do.error(e), Do.error(t), this.channel.emit(gi, t);
  }
};
n(Qr, "Preview");
var Te = Qr;

// src/preview-api/modules/preview-web/PreviewWeb.tsx
import { global as bl } from "@storybook/global";

// src/preview-api/modules/preview-web/PreviewWithSelection.tsx
import { logger as or } from "storybook/internal/client-logger";
import {
  CURRENT_STORY_WAS_SET as Mo,
  DOCS_PREPARED as Ni,
  GLOBALS_UPDATED as _o,
  PRELOAD_ENTRIES as Li,
  PREVIEW_KEYDOWN as qi,
  SET_CURRENT_STORY as zi,
  STORY_CHANGED as Bi,
  STORY_ERRORED as Gi,
  STORY_MISSING as No,
  STORY_PREPARED as Ui,
  STORY_RENDER_PHASE_CHANGED as Lo,
  STORY_SPECIFIED as Hi,
  STORY_THREW_EXCEPTION as Vi,
  STORY_UNCHANGED as Wi,
  UPDATE_QUERY_PARAMS as $i
} from "storybook/internal/core-events";
import {
  CalledPreviewMethodBeforeInitializationError as ot,
  EmptyIndexError as Yi,
  MdxFileWithNoCsfReferencesError as Ki,
  NoStoryMatchError as Xi
} from "storybook/internal/preview-errors";

// ../node_modules/tiny-invariant/dist/esm/tiny-invariant.js
var ki = !1, Zr = "Invariant failed";
function tr(r, e) {
  if (!r) {
    if (ki)
      throw new Error(Zr);
    var t = typeof e == "function" ? e() : e, o = t ? "".concat(Zr, ": ").concat(t) : Zr;
    throw new Error(o);
  }
}
n(tr, "invariant");

// src/preview-api/modules/preview-web/render/CsfDocsRender.ts
import { DOCS_RENDERED as Mi } from "storybook/internal/core-events";

// src/preview-api/modules/preview-web/docs-context/DocsContext.ts
import { isStory as ji } from "storybook/internal/csf";
var et = class et {
  constructor(e, t, o, s) {
    this.channel = e;
    this.store = t;
    this.renderStoryToElement = o;
    this.storyIdByName = /* @__PURE__ */ n((e) => {
      let t = this.nameToStoryId.get(e);
      if (t)
        return t;
      throw new Error(`No story found with that name: ${e}`);
    }, "storyIdByName");
    this.componentStories = /* @__PURE__ */ n(() => this.componentStoriesValue, "componentStories");
    this.componentStoriesFromCSFFile = /* @__PURE__ */ n((e) => this.store.componentStoriesFromCSFFile({ csfFile: e }), "componentStoriesFro\
mCSFFile");
    this.storyById = /* @__PURE__ */ n((e) => {
      if (!e) {
        if (!this.primaryStory)
          throw new Error(
            "No primary story defined for docs entry. Did you forget to use `<Meta>`?"
          );
        return this.primaryStory;
      }
      let t = this.storyIdToCSFFile.get(e);
      if (!t)
        throw new Error(`Called \`storyById\` for story that was never loaded: ${e}`);
      return this.store.storyFromCSFFile({ storyId: e, csfFile: t });
    }, "storyById");
    this.getStoryContext = /* @__PURE__ */ n((e) => ({
      ...this.store.getStoryContext(e),
      loaded: {},
      viewMode: "docs"
    }), "getStoryContext");
    this.loadStory = /* @__PURE__ */ n((e) => this.store.loadStory({ storyId: e }), "loadStory");
    this.componentStoriesValue = [], this.storyIdToCSFFile = /* @__PURE__ */ new Map(), this.exportToStory = /* @__PURE__ */ new Map(), this.
    exportsToCSFFile = /* @__PURE__ */ new Map(), this.nameToStoryId = /* @__PURE__ */ new Map(), this.attachedCSFFiles = /* @__PURE__ */ new Set(),
    s.forEach((i, a) => {
      this.referenceCSFFile(i);
    });
  }
  // This docs entry references this CSF file and can synchronously load the stories, as well
  // as reference them by module export. If the CSF is part of the "component" stories, they
  // can also be referenced by name and are in the componentStories list.
  referenceCSFFile(e) {
    this.exportsToCSFFile.set(e.moduleExports, e), this.exportsToCSFFile.set(e.moduleExports.default, e), this.store.componentStoriesFromCSFFile(
    { csfFile: e }).forEach((o) => {
      let s = e.stories[o.id];
      this.storyIdToCSFFile.set(s.id, e), this.exportToStory.set(s.moduleExport, o);
    });
  }
  attachCSFFile(e) {
    if (!this.exportsToCSFFile.has(e.moduleExports))
      throw new Error("Cannot attach a CSF file that has not been referenced");
    if (this.attachedCSFFiles.has(e))
      return;
    this.attachedCSFFiles.add(e), this.store.componentStoriesFromCSFFile({ csfFile: e }).forEach((o) => {
      this.nameToStoryId.set(o.name, o.id), this.componentStoriesValue.push(o), this.primaryStory || (this.primaryStory = o);
    });
  }
  referenceMeta(e, t) {
    let o = this.resolveModuleExport(e);
    if (o.type !== "meta")
      throw new Error(
        "<Meta of={} /> must reference a CSF file module export or meta export. Did you mistakenly reference your component instead of your \
CSF file?"
      );
    t && this.attachCSFFile(o.csfFile);
  }
  get projectAnnotations() {
    let { projectAnnotations: e } = this.store;
    if (!e)
      throw new Error("Can't get projectAnnotations from DocsContext before they are initialized");
    return e;
  }
  resolveAttachedModuleExportType(e) {
    if (e === "story") {
      if (!this.primaryStory)
        throw new Error(
          "No primary story attached to this docs file, did you forget to use <Meta of={} />?"
        );
      return { type: "story", story: this.primaryStory };
    }
    if (this.attachedCSFFiles.size === 0)
      throw new Error(
        "No CSF file attached to this docs file, did you forget to use <Meta of={} />?"
      );
    let t = Array.from(this.attachedCSFFiles)[0];
    if (e === "meta")
      return { type: "meta", csfFile: t };
    let { component: o } = t.meta;
    if (!o)
      throw new Error(
        "Attached CSF file does not defined a component, did you forget to export one?"
      );
    return { type: "component", component: o };
  }
  resolveModuleExport(e) {
    let t = this.exportsToCSFFile.get(e);
    if (t)
      return { type: "meta", csfFile: t };
    let o = this.exportToStory.get(
      ji(e) ? e.input : e
    );
    return o ? { type: "story", story: o } : { type: "component", component: e };
  }
  resolveOf(e, t = []) {
    let o;
    if (["component", "meta", "story"].includes(e)) {
      let s = e;
      o = this.resolveAttachedModuleExportType(s);
    } else
      o = this.resolveModuleExport(e);
    if (t.length && !t.includes(o.type)) {
      let s = o.type === "component" ? "component or unknown" : o.type;
      throw new Error(P`Invalid value passed to the 'of' prop. The value was resolved to a '${s}' type but the only types for this block are: ${t.
      join(
        ", "
      )}.
        - Did you pass a component to the 'of' prop when the block only supports a story or a meta?
        - ... or vice versa?
        - Did you pass a story, CSF file or meta to the 'of' prop that is not indexed, ie. is not targeted by the 'stories' globs in the main configuration?`);
    }
    switch (o.type) {
      case "component":
        return {
          ...o,
          projectAnnotations: this.projectAnnotations
        };
      case "meta":
        return {
          ...o,
          preparedMeta: this.store.preparedMetaFromCSFFile({ csfFile: o.csfFile })
        };
      case "story":
      default:
        return o;
    }
  }
};
n(et, "DocsContext");
var Q = et;

// src/preview-api/modules/preview-web/render/CsfDocsRender.ts
var rt = class rt {
  constructor(e, t, o, s) {
    this.channel = e;
    this.store = t;
    this.entry = o;
    this.callbacks = s;
    this.type = "docs";
    this.subtype = "csf";
    this.torndown = !1;
    this.disableKeyListeners = !1;
    this.preparing = !1;
    this.id = o.id, this.renderId = Date.now();
  }
  isPreparing() {
    return this.preparing;
  }
  async prepare() {
    this.preparing = !0;
    let { entryExports: e, csfFiles: t = [] } = await this.store.loadEntry(this.id);
    if (this.torndown)
      throw J;
    let { importPath: o, title: s } = this.entry, i = this.store.processCSFFileWithCache(
      e,
      o,
      s
    ), a = Object.keys(i.stories)[0];
    this.story = this.store.storyFromCSFFile({ storyId: a, csfFile: i }), this.csfFiles = [i, ...t], this.preparing = !1;
  }
  isEqual(e) {
    return !!(this.id === e.id && this.story && this.story === e.story);
  }
  docsContext(e) {
    if (!this.csfFiles)
      throw new Error("Cannot render docs before preparing");
    let t = new Q(
      this.channel,
      this.store,
      e,
      this.csfFiles
    );
    return this.csfFiles.forEach((o) => t.attachCSFFile(o)), t;
  }
  async renderToElement(e, t) {
    if (!this.story || !this.csfFiles)
      throw new Error("Cannot render docs before preparing");
    let o = this.docsContext(t), { docs: s } = this.story.parameters || {};
    if (!s)
      throw new Error(
        "Cannot render a story in viewMode=docs if `@storybook/addon-docs` is not installed"
      );
    let i = await s.renderer(), { render: a } = i, l = /* @__PURE__ */ n(async () => {
      try {
        await a(o, s, e), this.channel.emit(Mi, this.id);
      } catch (c) {
        this.callbacks.showException(c);
      }
    }, "renderDocs");
    return this.rerender = async () => l(), this.teardownRender = async ({ viewModeChanged: c }) => {
      !c || !e || i.unmount(e);
    }, l();
  }
  async teardown({ viewModeChanged: e } = {}) {
    this.teardownRender?.({ viewModeChanged: e }), this.torndown = !0;
  }
};
n(rt, "CsfDocsRender");
var _e = rt;

// src/preview-api/modules/preview-web/render/MdxDocsRender.ts
import { DOCS_RENDERED as _i } from "storybook/internal/core-events";
var tt = class tt {
  constructor(e, t, o, s) {
    this.channel = e;
    this.store = t;
    this.entry = o;
    this.callbacks = s;
    this.type = "docs";
    this.subtype = "mdx";
    this.torndown = !1;
    this.disableKeyListeners = !1;
    this.preparing = !1;
    this.id = o.id, this.renderId = Date.now();
  }
  isPreparing() {
    return this.preparing;
  }
  async prepare() {
    this.preparing = !0;
    let { entryExports: e, csfFiles: t = [] } = await this.store.loadEntry(this.id);
    if (this.torndown)
      throw J;
    this.csfFiles = t, this.exports = e, this.preparing = !1;
  }
  isEqual(e) {
    return !!(this.id === e.id && this.exports && this.exports === e.exports);
  }
  docsContext(e) {
    if (!this.csfFiles)
      throw new Error("Cannot render docs before preparing");
    return new Q(
      this.channel,
      this.store,
      e,
      this.csfFiles
    );
  }
  async renderToElement(e, t) {
    if (!this.exports || !this.csfFiles || !this.store.projectAnnotations)
      throw new Error("Cannot render docs before preparing");
    let o = this.docsContext(t), { docs: s } = this.store.projectAnnotations.parameters ?? {};
    if (!s)
      throw new Error(
        "Cannot render a story in viewMode=docs if `@storybook/addon-docs` is not installed"
      );
    let i = { ...s, page: this.exports.default }, a = await s.renderer(), { render: l } = a, c = /* @__PURE__ */ n(async () => {
      try {
        await l(o, i, e), this.channel.emit(_i, this.id);
      } catch (d) {
        this.callbacks.showException(d);
      }
    }, "renderDocs");
    return this.rerender = async () => c(), this.teardownRender = async ({ viewModeChanged: d } = {}) => {
      !d || !e || (a.unmount(e), this.torndown = !0);
    }, c();
  }
  async teardown({ viewModeChanged: e } = {}) {
    this.teardownRender?.({ viewModeChanged: e }), this.torndown = !0;
  }
};
n(tt, "MdxDocsRender");
var Ne = tt;

// src/preview-api/modules/preview-web/PreviewWithSelection.tsx
var Ji = globalThis;
function Qi(r) {
  let e = r.composedPath && r.composedPath()[0] || r.target;
  return /input|textarea/i.test(e.tagName) || e.getAttribute("contenteditable") !== null;
}
n(Qi, "focusInInput");
var qo = "attached-mdx", Zi = "unattached-mdx";
function ea({ tags: r }) {
  return r?.includes(Zi) || r?.includes(qo);
}
n(ea, "isMdxEntry");
function nt(r) {
  return r.type === "story";
}
n(nt, "isStoryRender");
function ra(r) {
  return r.type === "docs";
}
n(ra, "isDocsRender");
function ta(r) {
  return ra(r) && r.subtype === "csf";
}
n(ta, "isCsfDocsRender");
var st = class st extends Te {
  constructor(t, o, s, i) {
    super(t, o, void 0, !1);
    this.importFn = t;
    this.getProjectAnnotations = o;
    this.selectionStore = s;
    this.view = i;
    this.initialize();
  }
  setupListeners() {
    super.setupListeners(), Ji.onkeydown = this.onKeydown.bind(this), this.channel.on(zi, this.onSetCurrentStory.bind(this)), this.channel.on(
    $i, this.onUpdateQueryParams.bind(this)), this.channel.on(Li, this.onPreloadStories.bind(this));
  }
  async setInitialGlobals() {
    if (!this.storyStoreValue)
      throw new ot({ methodName: "setInitialGlobals" });
    let { globals: t } = this.selectionStore.selectionSpecifier || {};
    t && this.storyStoreValue.userGlobals.updateFromPersisted(t), this.emitGlobals();
  }
  // If initialization gets as far as the story index, this function runs.
  async initializeWithStoryIndex(t) {
    return await super.initializeWithStoryIndex(t), this.selectSpecifiedStory();
  }
  // Use the selection specifier to choose a story, then render it
  async selectSpecifiedStory() {
    if (!this.storyStoreValue)
      throw new ot({
        methodName: "selectSpecifiedStory"
      });
    if (this.selectionStore.selection) {
      await this.renderSelection();
      return;
    }
    if (!this.selectionStore.selectionSpecifier) {
      this.renderMissingStory();
      return;
    }
    let { storySpecifier: t, args: o } = this.selectionStore.selectionSpecifier, s = this.storyStoreValue.storyIndex.entryFromSpecifier(t);
    if (!s) {
      t === "*" ? this.renderStoryLoadingException(t, new Yi()) : this.renderStoryLoadingException(
        t,
        new Xi({ storySpecifier: t.toString() })
      );
      return;
    }
    let { id: i, type: a } = s;
    this.selectionStore.setSelection({ storyId: i, viewMode: a }), this.channel.emit(Hi, this.selectionStore.selection), this.channel.emit(Mo,
    this.selectionStore.selection), await this.renderSelection({ persistedArgs: o });
  }
  // EVENT HANDLERS
  // This happens when a config file gets reloaded
  async onGetProjectAnnotationsChanged({
    getProjectAnnotations: t
  }) {
    await super.onGetProjectAnnotationsChanged({ getProjectAnnotations: t }), this.selectionStore.selection && this.renderSelection();
  }
  // This happens when a glob gets HMR-ed
  async onStoriesChanged({
    importFn: t,
    storyIndex: o
  }) {
    await super.onStoriesChanged({ importFn: t, storyIndex: o }), this.selectionStore.selection ? await this.renderSelection() : await this.
    selectSpecifiedStory();
  }
  onKeydown(t) {
    if (!this.storyRenders.find((o) => o.disableKeyListeners) && !Qi(t)) {
      let { altKey: o, ctrlKey: s, metaKey: i, shiftKey: a, key: l, code: c, keyCode: d } = t;
      this.channel.emit(qi, {
        event: { altKey: o, ctrlKey: s, metaKey: i, shiftKey: a, key: l, code: c, keyCode: d }
      });
    }
  }
  async onSetCurrentStory(t) {
    this.selectionStore.setSelection({ viewMode: "story", ...t }), await this.storeInitializationPromise, this.channel.emit(Mo, this.selectionStore.
    selection), this.renderSelection();
  }
  onUpdateQueryParams(t) {
    this.selectionStore.setQueryParams(t);
  }
  async onUpdateGlobals({ globals: t }) {
    let o = this.currentRender instanceof ie && this.currentRender.story || void 0;
    super.onUpdateGlobals({ globals: t, currentStory: o }), (this.currentRender instanceof Ne || this.currentRender instanceof _e) && await this.
    currentRender.rerender?.();
  }
  async onUpdateArgs({ storyId: t, updatedArgs: o }) {
    super.onUpdateArgs({ storyId: t, updatedArgs: o });
  }
  async onPreloadStories({ ids: t }) {
    await this.storeInitializationPromise, this.storyStoreValue && await Promise.allSettled(t.map((o) => this.storyStoreValue?.loadEntry(o)));
  }
  // RENDERING
  // We can either have:
  // - a story selected in "story" viewMode,
  //     in which case we render it to the root element, OR
  // - a story selected in "docs" viewMode,
  //     in which case we render the docsPage for that story
  async renderSelection({ persistedArgs: t } = {}) {
    let { renderToCanvas: o } = this;
    if (!this.storyStoreValue || !o)
      throw new ot({ methodName: "renderSelection" });
    let { selection: s } = this.selectionStore;
    if (!s)
      throw new Error("Cannot call renderSelection as no selection was made");
    let { storyId: i } = s, a;
    try {
      a = await this.storyStoreValue.storyIdToEntry(i);
    } catch (h) {
      this.currentRender && await this.teardownRender(this.currentRender), this.renderStoryLoadingException(i, h);
      return;
    }
    let l = this.currentSelection?.storyId !== i, c = this.currentRender?.type !== a.type;
    a.type === "story" ? this.view.showPreparingStory({ immediate: c }) : this.view.showPreparingDocs({ immediate: c }), this.currentRender?.
    isPreparing() && await this.teardownRender(this.currentRender);
    let d;
    a.type === "story" ? d = new ie(
      this.channel,
      this.storyStoreValue,
      o,
      this.mainStoryCallbacks(i),
      i,
      "story"
    ) : ea(a) ? d = new Ne(
      this.channel,
      this.storyStoreValue,
      a,
      this.mainStoryCallbacks(i)
    ) : d = new _e(
      this.channel,
      this.storyStoreValue,
      a,
      this.mainStoryCallbacks(i)
    );
    let p = this.currentSelection;
    this.currentSelection = s;
    let u = this.currentRender;
    this.currentRender = d;
    try {
      await d.prepare();
    } catch (h) {
      u && await this.teardownRender(u), h !== J && this.renderStoryLoadingException(i, h);
      return;
    }
    let y = !l && u && !d.isEqual(u);
    if (t && nt(d) && (tr(!!d.story), this.storyStoreValue.args.updateFromPersisted(d.story, t)), u && !u.torndown && !l && !y && !c) {
      this.currentRender = u, this.channel.emit(Wi, i), this.view.showMain();
      return;
    }
    if (u && await this.teardownRender(u, { viewModeChanged: c }), p && (l || c) && this.channel.emit(Bi, i), nt(d)) {
      tr(!!d.story);
      let {
        parameters: h,
        initialArgs: g,
        argTypes: b,
        unmappedArgs: m,
        initialGlobals: T,
        userGlobals: x,
        storyGlobals: f,
        globals: S
      } = this.storyStoreValue.getStoryContext(d.story);
      this.channel.emit(Ui, {
        id: i,
        parameters: h,
        initialArgs: g,
        argTypes: b,
        args: m
      }), this.channel.emit(_o, { userGlobals: x, storyGlobals: f, globals: S, initialGlobals: T });
    } else {
      let { parameters: h } = this.storyStoreValue.projectAnnotations, { initialGlobals: g, globals: b } = this.storyStoreValue.userGlobals;
      if (this.channel.emit(_o, {
        globals: b,
        initialGlobals: g,
        storyGlobals: {},
        userGlobals: b
      }), ta(d) || d.entry.tags?.includes(qo)) {
        if (!d.csfFiles)
          throw new Ki({ storyId: i });
        ({ parameters: h } = this.storyStoreValue.preparedMetaFromCSFFile({
          csfFile: d.csfFiles[0]
        }));
      }
      this.channel.emit(Ni, {
        id: i,
        parameters: h
      });
    }
    nt(d) ? (tr(!!d.story), this.storyRenders.push(d), this.currentRender.renderToElement(
      this.view.prepareForStory(d.story)
    )) : this.currentRender.renderToElement(
      this.view.prepareForDocs(),
      // This argument is used for docs, which is currently only compatible with HTMLElements
      this.renderStoryToElement.bind(this)
    );
  }
  async teardownRender(t, { viewModeChanged: o = !1 } = {}) {
    this.storyRenders = this.storyRenders.filter((s) => s !== t), await t?.teardown?.({ viewModeChanged: o });
  }
  // UTILITIES
  mainStoryCallbacks(t) {
    return {
      showStoryDuringRender: /* @__PURE__ */ n(() => this.view.showStoryDuringRender(), "showStoryDuringRender"),
      showMain: /* @__PURE__ */ n(() => this.view.showMain(), "showMain"),
      showError: /* @__PURE__ */ n((o) => this.renderError(t, o), "showError"),
      showException: /* @__PURE__ */ n((o) => this.renderException(t, o), "showException")
    };
  }
  renderPreviewEntryError(t, o) {
    super.renderPreviewEntryError(t, o), this.view.showErrorDisplay(o);
  }
  renderMissingStory() {
    this.view.showNoPreview(), this.channel.emit(No);
  }
  renderStoryLoadingException(t, o) {
    or.error(o), this.view.showErrorDisplay(o), this.channel.emit(No, t);
  }
  // renderException is used if we fail to render the story and it is uncaught by the app layer
  renderException(t, o) {
    let { name: s = "Error", message: i = String(o), stack: a } = o, l = this.currentRender?.renderId;
    this.channel.emit(Vi, { name: s, message: i, stack: a }), this.channel.emit(Lo, { newPhase: "errored", renderId: l, storyId: t }), this.
    view.showErrorDisplay(o), or.error(`Error rendering story '${t}':`), or.error(o);
  }
  // renderError is used by the various app layers to inform the user they have done something
  // wrong -- for instance returned the wrong thing from a story
  renderError(t, { title: o, description: s }) {
    let i = this.currentRender?.renderId;
    this.channel.emit(Gi, { title: o, description: s }), this.channel.emit(Lo, { newPhase: "errored", renderId: i, storyId: t }), this.view.
    showErrorDisplay({ message: o, stack: s }), or.error(`Error rendering story ${o}: ${s}`);
  }
};
n(st, "PreviewWithSelection");
var xe = st;

// src/preview-api/modules/preview-web/UrlStore.ts
var qe = ue(lr(), 1);
import { global as Oa } from "@storybook/global";

// src/preview-api/modules/preview-web/parseArgsParam.ts
import { once as Pa } from "storybook/internal/client-logger";
var Qo = ue(lr(), 1);
var Jo = /^[a-zA-Z0-9 _-]*$/, Zo = /^-?[0-9]+(\.[0-9]+)?$/, Fa = /^#([a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/i, en = /^(rgba?|hsla?)\(([0-9]{1,3}),\s?([0-9]{1,3})%?,\s?([0-9]{1,3})%?,?\s?([0-9](\.[0-9]{1,2})?)?\)$/i,
ut = /* @__PURE__ */ n((r = "", e) => r === null || r === "" || !Jo.test(r) ? !1 : e == null || e instanceof Date || typeof e == "number" ||
typeof e == "boolean" ? !0 : typeof e == "string" ? Jo.test(e) || Zo.test(e) || Fa.test(e) || en.test(e) : Array.isArray(e) ? e.every((t) => ut(
r, t)) : j(e) ? Object.entries(e).every(([t, o]) => ut(t, o)) : !1, "validateArgs"), Ia = {
  delimiter: ";",
  // we're parsing a single query param
  nesting: !0,
  arrayRepeat: !0,
  arrayRepeatSyntax: "bracket",
  nestingSyntax: "js",
  // objects are encoded using dot notation
  valueDeserializer(r) {
    if (r.startsWith("!")) {
      if (r === "!undefined")
        return;
      if (r === "!null")
        return null;
      if (r === "!true")
        return !0;
      if (r === "!false")
        return !1;
      if (r.startsWith("!date(") && r.endsWith(")"))
        return new Date(r.replaceAll(" ", "+").slice(6, -1));
      if (r.startsWith("!hex(") && r.endsWith(")"))
        return `#${r.slice(5, -1)}`;
      let e = r.slice(1).match(en);
      if (e)
        return r.startsWith("!rgba") || r.startsWith("!RGBA") ? `${e[1]}(${e[2]}, ${e[3]}, ${e[4]}, ${e[5]})` : r.startsWith("!hsla") || r.startsWith(
        "!HSLA") ? `${e[1]}(${e[2]}, ${e[3]}%, ${e[4]}%, ${e[5]})` : r.startsWith("!rgb") || r.startsWith("!RGB") ? `${e[1]}(${e[2]}, ${e[3]}\
, ${e[4]})` : `${e[1]}(${e[2]}, ${e[3]}%, ${e[4]}%)`;
    }
    return Zo.test(r) ? Number(r) : r;
  }
}, ft = /* @__PURE__ */ n((r) => {
  let e = r.split(";").map((t) => t.replace("=", "~").replace(":", "="));
  return Object.entries((0, Qo.parse)(e.join(";"), Ia)).reduce((t, [o, s]) => ut(o, s) ? Object.assign(t, { [o]: s }) : (Pa.warn(P`
      Omitted potentially unsafe URL args.

      More info: https://storybook.js.org/docs/writing-stories/args#setting-args-through-the-url?ref=error
    `), t), {});
}, "parseArgsParam");

// src/preview-api/modules/preview-web/UrlStore.ts
var { history: rn, document: Z } = Oa;
function Da(r) {
  let e = (r || "").match(/^\/story\/(.+)/);
  if (!e)
    throw new Error(`Invalid path '${r}',  must start with '/story/'`);
  return e[1];
}
n(Da, "pathToId");
var tn = /* @__PURE__ */ n(({
  selection: r,
  extraParams: e
}) => {
  let t = Z?.location.search.slice(1), { path: o, selectedKind: s, selectedStory: i, ...a } = (0, qe.parse)(t);
  return `?${(0, qe.stringify)({
    ...a,
    ...e,
    ...r && { id: r.storyId, viewMode: r.viewMode }
  })}`;
}, "getQueryString"), ka = /* @__PURE__ */ n((r) => {
  if (!r)
    return;
  let e = tn({ selection: r }), { hash: t = "" } = Z.location;
  Z.title = r.storyId, rn.replaceState({}, "", `${Z.location.pathname}${e}${t}`);
}, "setPath"), ja = /* @__PURE__ */ n((r) => r != null && typeof r == "object" && Array.isArray(r) === !1, "isObject"), Le = /* @__PURE__ */ n(
(r) => {
  if (r !== void 0) {
    if (typeof r == "string")
      return r;
    if (Array.isArray(r))
      return Le(r[0]);
    if (ja(r))
      return Le(
        Object.values(r).filter(Boolean)
      );
  }
}, "getFirstString"), Ma = /* @__PURE__ */ n(() => {
  if (typeof Z < "u") {
    let r = Z.location.search.slice(1), e = (0, qe.parse)(r), t = typeof e.args == "string" ? ft(e.args) : void 0, o = typeof e.globals == "\
string" ? ft(e.globals) : void 0, s = Le(e.viewMode);
    (typeof s != "string" || !s.match(/docs|story/)) && (s = "story");
    let i = Le(e.path), a = i ? Da(i) : Le(e.id);
    if (a)
      return { storySpecifier: a, args: t, globals: o, viewMode: s };
  }
  return null;
}, "getSelectionSpecifierFromPath"), yt = class yt {
  constructor() {
    this.selectionSpecifier = Ma();
  }
  setSelection(e) {
    this.selection = e, ka(this.selection);
  }
  setQueryParams(e) {
    let t = tn({ extraParams: e }), { hash: o = "" } = Z.location;
    rn.replaceState({}, "", `${Z.location.pathname}${t}${o}`);
  }
};
n(yt, "UrlStore");
var Re = yt;

// src/preview-api/modules/preview-web/WebView.ts
var Mn = ue(Dn(), 1), _n = ue(lr(), 1);
import { logger as hl } from "storybook/internal/client-logger";
import { global as gl } from "@storybook/global";
var { document: O } = gl, kn = 100, Nn = /* @__PURE__ */ ((i) => (i.MAIN = "MAIN", i.NOPREVIEW = "NOPREVIEW", i.PREPARING_STORY = "PREPARING\
_STORY", i.PREPARING_DOCS = "PREPARING_DOCS", i.ERROR = "ERROR", i))(Nn || {}), xt = {
  PREPARING_STORY: "sb-show-preparing-story",
  PREPARING_DOCS: "sb-show-preparing-docs",
  MAIN: "sb-show-main",
  NOPREVIEW: "sb-show-nopreview",
  ERROR: "sb-show-errordisplay"
}, Rt = {
  centered: "sb-main-centered",
  fullscreen: "sb-main-fullscreen",
  padded: "sb-main-padded"
}, jn = new Mn.default({
  escapeXML: !0
}), wt = class wt {
  constructor() {
    this.testing = !1;
    if (typeof O < "u") {
      let { __SPECIAL_TEST_PARAMETER__: e } = (0, _n.parse)(O.location.search.slice(1));
      switch (e) {
        case "preparing-story": {
          this.showPreparingStory(), this.testing = !0;
          break;
        }
        case "preparing-docs": {
          this.showPreparingDocs(), this.testing = !0;
          break;
        }
        default:
      }
    }
  }
  // Get ready to render a story, returning the element to render to
  prepareForStory(e) {
    return this.showStory(), this.applyLayout(e.parameters.layout), O.documentElement.scrollTop = 0, O.documentElement.scrollLeft = 0, this.
    storyRoot();
  }
  storyRoot() {
    return O.getElementById("storybook-root");
  }
  prepareForDocs() {
    return this.showMain(), this.showDocs(), this.applyLayout("fullscreen"), O.documentElement.scrollTop = 0, O.documentElement.scrollLeft =
    0, this.docsRoot();
  }
  docsRoot() {
    return O.getElementById("storybook-docs");
  }
  applyLayout(e = "padded") {
    if (e === "none") {
      O.body.classList.remove(this.currentLayoutClass), this.currentLayoutClass = null;
      return;
    }
    this.checkIfLayoutExists(e);
    let t = Rt[e];
    O.body.classList.remove(this.currentLayoutClass), O.body.classList.add(t), this.currentLayoutClass = t;
  }
  checkIfLayoutExists(e) {
    Rt[e] || hl.warn(
      P`
          The desired layout: ${e} is not a valid option.
          The possible options are: ${Object.keys(Rt).join(", ")}, none.
        `
    );
  }
  showMode(e) {
    clearTimeout(this.preparingTimeout), Object.keys(Nn).forEach((t) => {
      t === e ? O.body.classList.add(xt[t]) : O.body.classList.remove(xt[t]);
    });
  }
  showErrorDisplay({ message: e = "", stack: t = "" }) {
    let o = e, s = t, i = e.split(`
`);
    i.length > 1 && ([o] = i, s = i.slice(1).join(`
`).replace(/^\n/, "")), O.getElementById("error-message").innerHTML = jn.toHtml(o), O.getElementById("error-stack").innerHTML = jn.toHtml(s),
    this.showMode("ERROR");
  }
  showNoPreview() {
    this.testing || (this.showMode("NOPREVIEW"), this.storyRoot()?.setAttribute("hidden", "true"), this.docsRoot()?.setAttribute("hidden", "\
true"));
  }
  showPreparingStory({ immediate: e = !1 } = {}) {
    clearTimeout(this.preparingTimeout), e ? this.showMode("PREPARING_STORY") : this.preparingTimeout = setTimeout(
      () => this.showMode("PREPARING_STORY"),
      kn
    );
  }
  showPreparingDocs({ immediate: e = !1 } = {}) {
    clearTimeout(this.preparingTimeout), e ? this.showMode("PREPARING_DOCS") : this.preparingTimeout = setTimeout(() => this.showMode("PREPA\
RING_DOCS"), kn);
  }
  showMain() {
    this.showMode("MAIN");
  }
  showDocs() {
    this.storyRoot().setAttribute("hidden", "true"), this.docsRoot().removeAttribute("hidden");
  }
  showStory() {
    this.docsRoot().setAttribute("hidden", "true"), this.storyRoot().removeAttribute("hidden");
  }
  showStoryDuringRender() {
    O.body.classList.add(xt.MAIN);
  }
};
n(wt, "WebView");
var we = wt;

// src/preview-api/modules/preview-web/PreviewWeb.tsx
var At = class At extends xe {
  constructor(t, o) {
    super(t, o, new Re(), new we());
    this.importFn = t;
    this.getProjectAnnotations = o;
    bl.__STORYBOOK_PREVIEW__ = this;
  }
};
n(At, "PreviewWeb");
var hr = At;

// src/preview-api/modules/preview-web/simulate-pageload.ts
import { global as Sl } from "@storybook/global";
var { document: de } = Sl, Tl = [
  "application/javascript",
  "application/ecmascript",
  "application/x-ecmascript",
  "application/x-javascript",
  "text/ecmascript",
  "text/javascript",
  "text/javascript1.0",
  "text/javascript1.1",
  "text/javascript1.2",
  "text/javascript1.3",
  "text/javascript1.4",
  "text/javascript1.5",
  "text/jscript",
  "text/livescript",
  "text/x-ecmascript",
  "text/x-javascript",
  // Support modern javascript
  "module"
], xl = "script", Ln = "scripts-root";
function gr() {
  let r = de.createEvent("Event");
  r.initEvent("DOMContentLoaded", !0, !0), de.dispatchEvent(r);
}
n(gr, "simulateDOMContentLoaded");
function Rl(r, e, t) {
  let o = de.createElement("script");
  o.type = r.type === "module" ? "module" : "text/javascript", r.src ? (o.onload = e, o.onerror = e, o.src = r.src) : o.textContent = r.innerText,
  t ? t.appendChild(o) : de.head.appendChild(o), r.parentNode.removeChild(r), r.src || e();
}
n(Rl, "insertScript");
function qn(r, e, t = 0) {
  r[t](() => {
    t++, t === r.length ? e() : qn(r, e, t);
  });
}
n(qn, "insertScriptsSequentially");
function zn(r) {
  let e = de.getElementById(Ln);
  e ? e.innerHTML = "" : (e = de.createElement("div"), e.id = Ln, de.body.appendChild(e));
  let t = Array.from(r.querySelectorAll(xl));
  if (t.length) {
    let o = [];
    t.forEach((s) => {
      let i = s.getAttribute("type");
      (!i || Tl.includes(i)) && o.push((a) => Rl(s, a, e));
    }), o.length && qn(o, gr, void 0);
  } else
    gr();
}
n(zn, "simulatePageLoad");

// src/docs-tools/shared.ts
var Bn = "storybook/docs", $f = `${Bn}/panel`;
var Gn = `${Bn}/snippet-rendered`;

// src/preview-api/modules/preview-web/emitTransformCode.ts
async function Un(r, e) {
  let t = e.parameters?.docs?.source?.transform, { id: o, unmappedArgs: s } = e, i = t && r ? t?.(r, e) : r, a = i ? await i : void 0;
  _.getChannel().emit(Gn, {
    id: o,
    source: a,
    args: s
  });
}
n(Un, "emitTransformCode");
export {
  Q as DocsContext,
  te as HooksContext,
  Te as Preview,
  hr as PreviewWeb,
  xe as PreviewWithSelection,
  se as ReporterAPI,
  Se as StoryStore,
  Re as UrlStore,
  we as WebView,
  _ as addons,
  Er as applyHooks,
  Ie as combineArgs,
  N as combineParameters,
  K as composeConfigs,
  Wr as composeStepRunners,
  Qs as composeStories,
  Ro as composeStory,
  Zs as createPlaywrightTest,
  ho as decorateStory,
  Gr as defaultDecorateStory,
  Un as emitTransformCode,
  Qe as filterArgTypes,
  Yr as getCsfFactoryAnnotations,
  ke as inferControls,
  ys as makeDecorator,
  Sr as mockChannel,
  C as normalizeArrays,
  he as normalizeProjectAnnotations,
  me as normalizeStory,
  ge as pauseAnimations,
  Ur as prepareMeta,
  De as prepareStory,
  go as sanitizeStoryContextUpdate,
  Ws as setDefaultProjectAnnotations,
  Xs as setProjectAnnotations,
  gr as simulateDOMContentLoaded,
  zn as simulatePageLoad,
  ci as sortStoriesV7,
  us as useArgs,
  ve as useCallback,
  ds as useChannel,
  Ot as useEffect,
  fs as useGlobals,
  ss as useMemo,
  ps as useParameter,
  cs as useReducer,
  is as useRef,
  ls as useState,
  He as useStoryContext,
  ai as userOrAutoTitle,
  Eo as userOrAutoTitleFromSpecifier,
  be as waitForAnimations
};
