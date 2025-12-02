var Sr = Object.create;
var Ae = Object.defineProperty;
var Dr = Object.getOwnPropertyDescriptor;
var Nr = Object.getOwnPropertyNames;
var Or = Object.getPrototypeOf, Pr = Object.prototype.hasOwnProperty;
var a = (e, t) => Ae(e, "name", { value: t, configurable: !0 }), re = /* @__PURE__ */ ((e) => typeof require < "u" ? require : typeof Proxy <
"u" ? new Proxy(e, {
  get: (t, r) => (typeof require < "u" ? require : t)[r]
}) : e)(function(e) {
  if (typeof require < "u") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + e + '" is not supported');
});
var T = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports);
var Cr = (e, t, r, o) => {
  if (t && typeof t == "object" || typeof t == "function")
    for (let n of Nr(t))
      !Pr.call(e, n) && n !== r && Ae(e, n, { get: () => t[n], enumerable: !(o = Dr(t, n)) || o.enumerable });
  return e;
};
var lt = (e, t, r) => (r = e != null ? Sr(Or(e)) : {}, Cr(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  t || !e || !e.__esModule ? Ae(r, "default", { value: e, enumerable: !0 }) : r,
  e
));

// ../node_modules/memoizerific/memoizerific.js
var Tt = T((Mt, Me) => {
  (function(e) {
    if (typeof Mt == "object" && typeof Me < "u")
      Me.exports = e();
    else if (typeof define == "function" && define.amd)
      define([], e);
    else {
      var t;
      typeof window < "u" ? t = window : typeof global < "u" ? t = global : typeof self < "u" ? t = self : t = this, t.memoizerific = e();
    }
  })(function() {
    var e, t, r;
    return (/* @__PURE__ */ a(function o(n, i, s) {
      function l(f, h) {
        if (!i[f]) {
          if (!n[f]) {
            var m = typeof re == "function" && re;
            if (!h && m) return m(f, !0);
            if (u) return u(f, !0);
            var x = new Error("Cannot find module '" + f + "'");
            throw x.code = "MODULE_NOT_FOUND", x;
          }
          var y = i[f] = { exports: {} };
          n[f][0].call(y.exports, function(d) {
            var p = n[f][1][d];
            return l(p || d);
          }, y, y.exports, o, n, i, s);
        }
        return i[f].exports;
      }
      a(l, "s");
      for (var u = typeof re == "function" && re, c = 0; c < s.length; c++) l(s[c]);
      return l;
    }, "e"))({ 1: [function(o, n, i) {
      n.exports = function(s) {
        if (typeof Map != "function" || s) {
          var l = o("./similar");
          return new l();
        } else
          return /* @__PURE__ */ new Map();
      };
    }, { "./similar": 2 }], 2: [function(o, n, i) {
      function s() {
        return this.list = [], this.lastItem = void 0, this.size = 0, this;
      }
      a(s, "Similar"), s.prototype.get = function(l) {
        var u;
        if (this.lastItem && this.isEqual(this.lastItem.key, l))
          return this.lastItem.val;
        if (u = this.indexOf(l), u >= 0)
          return this.lastItem = this.list[u], this.list[u].val;
      }, s.prototype.set = function(l, u) {
        var c;
        return this.lastItem && this.isEqual(this.lastItem.key, l) ? (this.lastItem.val = u, this) : (c = this.indexOf(l), c >= 0 ? (this.lastItem =
        this.list[c], this.list[c].val = u, this) : (this.lastItem = { key: l, val: u }, this.list.push(this.lastItem), this.size++, this));
      }, s.prototype.delete = function(l) {
        var u;
        if (this.lastItem && this.isEqual(this.lastItem.key, l) && (this.lastItem = void 0), u = this.indexOf(l), u >= 0)
          return this.size--, this.list.splice(u, 1)[0];
      }, s.prototype.has = function(l) {
        var u;
        return this.lastItem && this.isEqual(this.lastItem.key, l) ? !0 : (u = this.indexOf(l), u >= 0 ? (this.lastItem = this.list[u], !0) :
        !1);
      }, s.prototype.forEach = function(l, u) {
        var c;
        for (c = 0; c < this.size; c++)
          l.call(u || this, this.list[c].val, this.list[c].key, this);
      }, s.prototype.indexOf = function(l) {
        var u;
        for (u = 0; u < this.size; u++)
          if (this.isEqual(this.list[u].key, l))
            return u;
        return -1;
      }, s.prototype.isEqual = function(l, u) {
        return l === u || l !== l && u !== u;
      }, n.exports = s;
    }, {}], 3: [function(o, n, i) {
      var s = o("map-or-similar");
      n.exports = function(f) {
        var h = new s(!1), m = [];
        return function(x) {
          var y = /* @__PURE__ */ a(function() {
            var d = h, p, v, g = arguments.length - 1, R = Array(g + 1), w = !0, S;
            if ((y.numArgs || y.numArgs === 0) && y.numArgs !== g + 1)
              throw new Error("Memoizerific functions should always be called with the same number of arguments");
            for (S = 0; S < g; S++) {
              if (R[S] = {
                cacheItem: d,
                arg: arguments[S]
              }, d.has(arguments[S])) {
                d = d.get(arguments[S]);
                continue;
              }
              w = !1, p = new s(!1), d.set(arguments[S], p), d = p;
            }
            return w && (d.has(arguments[g]) ? v = d.get(arguments[g]) : w = !1), w || (v = x.apply(null, arguments), d.set(arguments[g], v)),
            f > 0 && (R[g] = {
              cacheItem: d,
              arg: arguments[g]
            }, w ? l(m, R) : m.push(R), m.length > f && u(m.shift())), y.wasMemoized = w, y.numArgs = g + 1, v;
          }, "memoizerific");
          return y.limit = f, y.wasMemoized = !1, y.cache = h, y.lru = m, y;
        };
      };
      function l(f, h) {
        var m = f.length, x = h.length, y, d, p;
        for (d = 0; d < m; d++) {
          for (y = !0, p = 0; p < x; p++)
            if (!c(f[d][p].arg, h[p].arg)) {
              y = !1;
              break;
            }
          if (y)
            break;
        }
        f.push(f.splice(d, 1)[0]);
      }
      a(l, "moveToMostRecentLru");
      function u(f) {
        var h = f.length, m = f[h - 1], x, y;
        for (m.cacheItem.delete(m.arg), y = h - 2; y >= 0 && (m = f[y], x = m.cacheItem.get(m.arg), !x || !x.size); y--)
          m.cacheItem.delete(m.arg);
      }
      a(u, "removeCachedResult");
      function c(f, h) {
        return f === h || f !== f && h !== h;
      }
      a(c, "isEqual");
    }, { "map-or-similar": 1 }] }, {}, [3])(3);
  });
});

// ../node_modules/picoquery/lib/string-util.js
var Ie = T((Te) => {
  "use strict";
  Object.defineProperty(Te, "__esModule", { value: !0 });
  Te.encodeString = Ar;
  var C = Array.from({ length: 256 }, (e, t) => "%" + ((t < 16 ? "0" : "") + t.toString(16)).toUpperCase()), _r = new Int8Array([
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
  function Ar(e) {
    let t = e.length;
    if (t === 0)
      return "";
    let r = "", o = 0, n = 0;
    e: for (; n < t; n++) {
      let i = e.charCodeAt(n);
      for (; i < 128; ) {
        if (_r[i] !== 1 && (o < n && (r += e.slice(o, n)), o = n + 1, r += C[i]), ++n === t)
          break e;
        i = e.charCodeAt(n);
      }
      if (o < n && (r += e.slice(o, n)), i < 2048) {
        o = n + 1, r += C[192 | i >> 6] + C[128 | i & 63];
        continue;
      }
      if (i < 55296 || i >= 57344) {
        o = n + 1, r += C[224 | i >> 12] + C[128 | i >> 6 & 63] + C[128 | i & 63];
        continue;
      }
      if (++n, n >= t)
        throw new Error("URI malformed");
      let s = e.charCodeAt(n) & 1023;
      o = n + 1, i = 65536 + ((i & 1023) << 10 | s), r += C[240 | i >> 18] + C[128 | i >> 12 & 63] + C[128 | i >> 6 & 63] + C[128 | i & 63];
    }
    return o === 0 ? e : o < t ? r + e.slice(o) : r;
  }
  a(Ar, "encodeString");
});

// ../node_modules/picoquery/lib/shared.js
var ge = T((_) => {
  "use strict";
  Object.defineProperty(_, "__esModule", { value: !0 });
  _.defaultOptions = _.defaultShouldSerializeObject = _.defaultValueSerializer = void 0;
  var Be = Ie(), Lr = /* @__PURE__ */ a((e) => {
    switch (typeof e) {
      case "string":
        return (0, Be.encodeString)(e);
      case "bigint":
      case "boolean":
        return "" + e;
      case "number":
        if (Number.isFinite(e))
          return e < 1e21 ? "" + e : (0, Be.encodeString)("" + e);
        break;
    }
    return e instanceof Date ? (0, Be.encodeString)(e.toISOString()) : "";
  }, "defaultValueSerializer");
  _.defaultValueSerializer = Lr;
  var Fr = /* @__PURE__ */ a((e) => e instanceof Date, "defaultShouldSerializeObject");
  _.defaultShouldSerializeObject = Fr;
  var It = /* @__PURE__ */ a((e) => e, "identityFunc");
  _.defaultOptions = {
    nesting: !0,
    nestingSyntax: "dot",
    arrayRepeat: !1,
    arrayRepeatSyntax: "repeat",
    delimiter: 38,
    valueDeserializer: It,
    valueSerializer: _.defaultValueSerializer,
    keyDeserializer: It,
    shouldSerializeObject: _.defaultShouldSerializeObject
  };
});

// ../node_modules/picoquery/lib/object-util.js
var ze = T((ye) => {
  "use strict";
  Object.defineProperty(ye, "__esModule", { value: !0 });
  ye.getDeepObject = Mr;
  ye.stringifyObject = Bt;
  var k = ge(), jr = Ie();
  function Ur(e) {
    return e === "__proto__" || e === "constructor" || e === "prototype";
  }
  a(Ur, "isPrototypeKey");
  function Mr(e, t, r, o, n) {
    if (Ur(t))
      return e;
    let i = e[t];
    return typeof i == "object" && i !== null ? i : !o && (n || typeof r == "number" || typeof r == "string" && r * 0 === 0 && r.indexOf(".") ===
    -1) ? e[t] = [] : e[t] = {};
  }
  a(Mr, "getDeepObject");
  var Tr = 20, Ir = "[]", Br = "[", zr = "]", kr = ".";
  function Bt(e, t, r = 0, o, n) {
    let { nestingSyntax: i = k.defaultOptions.nestingSyntax, arrayRepeat: s = k.defaultOptions.arrayRepeat, arrayRepeatSyntax: l = k.defaultOptions.
    arrayRepeatSyntax, nesting: u = k.defaultOptions.nesting, delimiter: c = k.defaultOptions.delimiter, valueSerializer: f = k.defaultOptions.
    valueSerializer, shouldSerializeObject: h = k.defaultOptions.shouldSerializeObject } = t, m = typeof c == "number" ? String.fromCharCode(
    c) : c, x = n === !0 && s, y = i === "dot" || i === "js" && !n;
    if (r > Tr)
      return "";
    let d = "", p = !0, v = !1;
    for (let g in e) {
      let R = e[g], w;
      o ? (w = o, x ? l === "bracket" && (w += Ir) : y ? (w += kr, w += g) : (w += Br, w += g, w += zr)) : w = g, p || (d += m), typeof R ==
      "object" && R !== null && !h(R) ? (v = R.pop !== void 0, (u || s && v) && (d += Bt(R, t, r + 1, w, v))) : (d += (0, jr.encodeString)(w),
      d += "=", d += f(R, g)), p && (p = !1);
    }
    return d;
  }
  a(Bt, "stringifyObject");
});

// ../node_modules/fast-decode-uri-component/index.js
var Wt = T((zo, Vt) => {
  "use strict";
  var zt = 12, Vr = 0, ke = [
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
  function Wr(e) {
    var t = e.indexOf("%");
    if (t === -1) return e;
    for (var r = e.length, o = "", n = 0, i = 0, s = t, l = zt; t > -1 && t < r; ) {
      var u = kt(e[t + 1], 4), c = kt(e[t + 2], 0), f = u | c, h = ke[f];
      if (l = ke[256 + l + h], i = i << 6 | f & ke[364 + h], l === zt)
        o += e.slice(n, s), o += i <= 65535 ? String.fromCharCode(i) : String.fromCharCode(
          55232 + (i >> 10),
          56320 + (i & 1023)
        ), i = 0, n = t + 3, t = s = e.indexOf("%", n);
      else {
        if (l === Vr)
          return null;
        if (t += 3, t < r && e.charCodeAt(t) === 37) continue;
        return null;
      }
    }
    return o + e.slice(n);
  }
  a(Wr, "decodeURIComponent");
  var Hr = {
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
  function kt(e, t) {
    var r = Hr[e];
    return r === void 0 ? 255 : r << t;
  }
  a(kt, "hexCodeToInt");
  Vt.exports = Wr;
});

// ../node_modules/picoquery/lib/parse.js
var $t = T((M) => {
  "use strict";
  var Kr = M && M.__importDefault || function(e) {
    return e && e.__esModule ? e : { default: e };
  };
  Object.defineProperty(M, "__esModule", { value: !0 });
  M.numberValueDeserializer = M.numberKeyDeserializer = void 0;
  M.parse = Jr;
  var ve = ze(), V = ge(), Ht = Kr(Wt()), qr = /* @__PURE__ */ a((e) => {
    let t = Number(e);
    return Number.isNaN(t) ? e : t;
  }, "numberKeyDeserializer");
  M.numberKeyDeserializer = qr;
  var $r = /* @__PURE__ */ a((e) => {
    let t = Number(e);
    return Number.isNaN(t) ? e : t;
  }, "numberValueDeserializer");
  M.numberValueDeserializer = $r;
  var Kt = /\+/g, qt = /* @__PURE__ */ a(function() {
  }, "Empty");
  qt.prototype = /* @__PURE__ */ Object.create(null);
  function Re(e, t, r, o, n) {
    let i = e.substring(t, r);
    return o && (i = i.replace(Kt, " ")), n && (i = (0, Ht.default)(i) || i), i;
  }
  a(Re, "computeKeySlice");
  function Jr(e, t) {
    let { valueDeserializer: r = V.defaultOptions.valueDeserializer, keyDeserializer: o = V.defaultOptions.keyDeserializer, arrayRepeatSyntax: n = V.
    defaultOptions.arrayRepeatSyntax, nesting: i = V.defaultOptions.nesting, arrayRepeat: s = V.defaultOptions.arrayRepeat, nestingSyntax: l = V.
    defaultOptions.nestingSyntax, delimiter: u = V.defaultOptions.delimiter } = t ?? {}, c = typeof u == "string" ? u.charCodeAt(0) : u, f = l ===
    "js", h = new qt();
    if (typeof e != "string")
      return h;
    let m = e.length, x = "", y = -1, d = -1, p = -1, v = h, g, R = "", w = "", S = !1, q = !1, F = !1, _e = !1, X = !1, G = !1, he = !1, j = 0,
    Z = -1, ee = -1, st = -1;
    for (let D = 0; D < m + 1; D++) {
      if (j = D !== m ? e.charCodeAt(D) : c, j === c) {
        if (he = d > y, he || (d = D), p !== d - 1 && (w = Re(e, p + 1, Z > -1 ? Z : d, F, S), R = o(w), g !== void 0 && (v = (0, ve.getDeepObject)(
        v, g, R, f && X, f && G))), he || R !== "") {
          he && (x = e.slice(d + 1, D), _e && (x = x.replace(Kt, " ")), q && (x = (0, Ht.default)(x) || x));
          let te = r(x, R);
          if (s) {
            let pe = v[R];
            pe === void 0 ? Z > -1 ? v[R] = [te] : v[R] = te : pe.pop ? pe.push(te) : v[R] = [pe, te];
          } else
            v[R] = te;
        }
        x = "", y = D, d = D, S = !1, q = !1, F = !1, _e = !1, X = !1, G = !1, Z = -1, p = D, v = h, g = void 0, R = "";
      } else j === 93 ? (s && n === "bracket" && st === 91 && (Z = ee), i && (l === "index" || f) && d <= y && (p !== ee && (w = Re(e, p + 1,
      D, F, S), R = o(w), g !== void 0 && (v = (0, ve.getDeepObject)(v, g, R, void 0, f)), g = R, F = !1, S = !1), p = D, G = !0, X = !1)) :
      j === 46 ? i && (l === "dot" || f) && d <= y && (p !== ee && (w = Re(e, p + 1, D, F, S), R = o(w), g !== void 0 && (v = (0, ve.getDeepObject)(
      v, g, R, f)), g = R, F = !1, S = !1), X = !0, G = !1, p = D) : j === 91 ? i && (l === "index" || f) && d <= y && (p !== ee && (w = Re(
      e, p + 1, D, F, S), R = o(w), f && g !== void 0 && (v = (0, ve.getDeepObject)(v, g, R, f)), g = R, F = !1, S = !1, X = !1, G = !0), p =
      D) : j === 61 ? d <= y ? d = D : q = !0 : j === 43 ? d > y ? _e = !0 : F = !0 : j === 37 && (d > y ? q = !0 : S = !0);
      ee = D, st = j;
    }
    return h;
  }
  a(Jr, "parse");
});

// ../node_modules/picoquery/lib/stringify.js
var Jt = T((Ve) => {
  "use strict";
  Object.defineProperty(Ve, "__esModule", { value: !0 });
  Ve.stringify = Qr;
  var Yr = ze();
  function Qr(e, t) {
    if (e === null || typeof e != "object")
      return "";
    let r = t ?? {};
    return (0, Yr.stringifyObject)(e, r);
  }
  a(Qr, "stringify");
});

// ../node_modules/picoquery/lib/main.js
var Yt = T((P) => {
  "use strict";
  var Xr = P && P.__createBinding || (Object.create ? function(e, t, r, o) {
    o === void 0 && (o = r);
    var n = Object.getOwnPropertyDescriptor(t, r);
    (!n || ("get" in n ? !t.__esModule : n.writable || n.configurable)) && (n = { enumerable: !0, get: /* @__PURE__ */ a(function() {
      return t[r];
    }, "get") }), Object.defineProperty(e, o, n);
  } : function(e, t, r, o) {
    o === void 0 && (o = r), e[o] = t[r];
  }), Gr = P && P.__exportStar || function(e, t) {
    for (var r in e) r !== "default" && !Object.prototype.hasOwnProperty.call(t, r) && Xr(t, e, r);
  };
  Object.defineProperty(P, "__esModule", { value: !0 });
  P.stringify = P.parse = void 0;
  var Zr = $t();
  Object.defineProperty(P, "parse", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return Zr.parse;
  }, "get") });
  var en = Jt();
  Object.defineProperty(P, "stringify", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return en.stringify;
  }, "get") });
  Gr(ge(), P);
});

// src/router/utils.ts
import { once as tn } from "storybook/internal/client-logger";

// ../node_modules/es-toolkit/dist/function/noop.mjs
function ut() {
}
a(ut, "noop");

// ../node_modules/es-toolkit/dist/compat/_internal/getSymbols.mjs
function Le(e) {
  return Object.getOwnPropertySymbols(e).filter((t) => Object.prototype.propertyIsEnumerable.call(e, t));
}
a(Le, "getSymbols");

// ../node_modules/es-toolkit/dist/compat/_internal/getTag.mjs
function Fe(e) {
  return e == null ? e === void 0 ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(e);
}
a(Fe, "getTag");

// ../node_modules/es-toolkit/dist/compat/_internal/tags.mjs
var ct = "[object RegExp]", ft = "[object String]", dt = "[object Number]", ht = "[object Boolean]", je = "[object Arguments]", pt = "[objec\
t Symbol]", mt = "[object Date]", gt = "[object Map]", yt = "[object Set]", vt = "[object Array]", Rt = "[object Function]", xt = "[object A\
rrayBuffer]", me = "[object Object]", bt = "[object Error]", Et = "[object DataView]", wt = "[object Uint8Array]", St = "[object Uint8Clampe\
dArray]", Dt = "[object Uint16Array]", Nt = "[object Uint32Array]", Ot = "[object BigUint64Array]", Pt = "[object Int8Array]", Ct = "[object\
 Int16Array]", _t = "[object Int32Array]", At = "[object BigInt64Array]", Lt = "[object Float32Array]", Ft = "[object Float64Array]";

// ../node_modules/es-toolkit/dist/predicate/isPlainObject.mjs
function U(e) {
  if (!e || typeof e != "object")
    return !1;
  let t = Object.getPrototypeOf(e);
  return t === null || t === Object.prototype || Object.getPrototypeOf(t) === null ? Object.prototype.toString.call(e) === "[object Object]" :
  !1;
}
a(U, "isPlainObject");

// ../node_modules/es-toolkit/dist/compat/util/eq.mjs
function jt(e, t) {
  return e === t || Number.isNaN(e) && Number.isNaN(t);
}
a(jt, "eq");

// ../node_modules/es-toolkit/dist/predicate/isEqualWith.mjs
function Ut(e, t, r) {
  return ne(e, t, void 0, void 0, void 0, void 0, r);
}
a(Ut, "isEqualWith");
function ne(e, t, r, o, n, i, s) {
  let l = s(e, t, r, o, n, i);
  if (l !== void 0)
    return l;
  if (typeof e == typeof t)
    switch (typeof e) {
      case "bigint":
      case "string":
      case "boolean":
      case "symbol":
      case "undefined":
        return e === t;
      case "number":
        return e === t || Object.is(e, t);
      case "function":
        return e === t;
      case "object":
        return oe(e, t, i, s);
    }
  return oe(e, t, i, s);
}
a(ne, "isEqualWithImpl");
function oe(e, t, r, o) {
  if (Object.is(e, t))
    return !0;
  let n = Fe(e), i = Fe(t);
  if (n === je && (n = me), i === je && (i = me), n !== i)
    return !1;
  switch (n) {
    case ft:
      return e.toString() === t.toString();
    case dt: {
      let u = e.valueOf(), c = t.valueOf();
      return jt(u, c);
    }
    case ht:
    case mt:
    case pt:
      return Object.is(e.valueOf(), t.valueOf());
    case ct:
      return e.source === t.source && e.flags === t.flags;
    case Rt:
      return e === t;
  }
  r = r ?? /* @__PURE__ */ new Map();
  let s = r.get(e), l = r.get(t);
  if (s != null && l != null)
    return s === t;
  r.set(e, t), r.set(t, e);
  try {
    switch (n) {
      case gt: {
        if (e.size !== t.size)
          return !1;
        for (let [u, c] of e.entries())
          if (!t.has(u) || !ne(c, t.get(u), u, e, t, r, o))
            return !1;
        return !0;
      }
      case yt: {
        if (e.size !== t.size)
          return !1;
        let u = Array.from(e.values()), c = Array.from(t.values());
        for (let f = 0; f < u.length; f++) {
          let h = u[f], m = c.findIndex((x) => ne(h, x, void 0, e, t, r, o));
          if (m === -1)
            return !1;
          c.splice(m, 1);
        }
        return !0;
      }
      case vt:
      case wt:
      case St:
      case Dt:
      case Nt:
      case Ot:
      case Pt:
      case Ct:
      case _t:
      case At:
      case Lt:
      case Ft: {
        if (typeof Buffer < "u" && Buffer.isBuffer(e) !== Buffer.isBuffer(t) || e.length !== t.length)
          return !1;
        for (let u = 0; u < e.length; u++)
          if (!ne(e[u], t[u], u, e, t, r, o))
            return !1;
        return !0;
      }
      case xt:
        return e.byteLength !== t.byteLength ? !1 : oe(new Uint8Array(e), new Uint8Array(t), r, o);
      case Et:
        return e.byteLength !== t.byteLength || e.byteOffset !== t.byteOffset ? !1 : oe(new Uint8Array(e), new Uint8Array(t), r, o);
      case bt:
        return e.name === t.name && e.message === t.message;
      case me: {
        if (!(oe(e.constructor, t.constructor, r, o) || U(e) && U(t)))
          return !1;
        let c = [...Object.keys(e), ...Le(e)], f = [...Object.keys(t), ...Le(t)];
        if (c.length !== f.length)
          return !1;
        for (let h = 0; h < c.length; h++) {
          let m = c[h], x = e[m];
          if (!Object.hasOwn(t, m))
            return !1;
          let y = t[m];
          if (!ne(x, y, m, e, t, r, o))
            return !1;
        }
        return !0;
      }
      default:
        return !1;
    }
  } finally {
    r.delete(e), r.delete(t);
  }
}
a(oe, "areObjectsEqual");

// ../node_modules/es-toolkit/dist/predicate/isEqual.mjs
function Ue(e, t) {
  return Ut(e, t, ut);
}
a(Ue, "isEqual");

// src/router/utils.ts
var be = lt(Tt(), 1), ae = lt(Yt(), 1);

// ../node_modules/ts-dedent/esm/index.js
function Qt(e) {
  for (var t = [], r = 1; r < arguments.length; r++)
    t[r - 1] = arguments[r];
  var o = Array.from(typeof e == "string" ? [e] : e);
  o[o.length - 1] = o[o.length - 1].replace(/\r?\n([\t ]*)$/, "");
  var n = o.reduce(function(l, u) {
    var c = u.match(/\n([\t ]+|(?!\s).)/g);
    return c ? l.concat(c.map(function(f) {
      var h, m;
      return (m = (h = f.match(/[\t ]/g)) === null || h === void 0 ? void 0 : h.length) !== null && m !== void 0 ? m : 0;
    })) : l;
  }, []);
  if (n.length) {
    var i = new RegExp(`
[	 ]{` + Math.min.apply(Math, n) + "}", "g");
    o = o.map(function(l) {
      return l.replace(i, `
`);
    });
  }
  o[0] = o[0].replace(/^\r?\n/, "");
  var s = o[0];
  return t.forEach(function(l, u) {
    var c = s.match(/(?:^|\n)( *)$/), f = c ? c[1] : "", h = l;
    typeof l == "string" && l.includes(`
`) && (h = String(l).split(`
`).map(function(m, x) {
      return x === 0 ? m : "" + f + m;
    }).join(`
`)), s += h + o[u + 1];
  }), s;
}
a(Qt, "dedent");

// src/router/utils.ts
var rn = /\/([^/]+)\/(?:(.*)_)?([^/]+)?/, Gt = (0, be.default)(1e3)((e) => {
  let t = {
    viewMode: void 0,
    storyId: void 0,
    refId: void 0
  };
  if (e) {
    let [, r, o, n] = e.toLowerCase().match(rn) || [];
    r && Object.assign(t, {
      viewMode: r,
      storyId: n,
      refId: o
    });
  }
  return t;
}), xe = Symbol("Deeply equal"), We = /* @__PURE__ */ a((e, t) => {
  if (typeof e != typeof t)
    return t;
  if (Ue(e, t))
    return xe;
  if (Array.isArray(e) && Array.isArray(t)) {
    let r = t.reduce((o, n, i) => {
      let s = We(e[i], n);
      return s !== xe && (o[i] = s), o;
    }, new Array(t.length));
    return t.length >= e.length ? r : r.concat(new Array(e.length - t.length).fill(void 0));
  }
  return U(e) && U(t) ? Object.keys({ ...e, ...t }).reduce((r, o) => {
    let n = We(e?.[o], t?.[o]);
    return n === xe ? r : Object.assign(r, { [o]: n });
  }, {}) : t;
}, "deepDiff"), Xt = /^[a-zA-Z0-9 _-]*$/, nn = /^-?[0-9]+(\.[0-9]+)?$/, Zt = /^#([a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/i, er = /^(rgba?|hsla?)\(([0-9]{1,3}),\s?([0-9]{1,3})%?,\s?([0-9]{1,3})%?,?\s?([0-9](\.[0-9]{1,2})?)?\)$/i,
He = /* @__PURE__ */ a((e = "", t) => e === null || e === "" || !Xt.test(e) ? !1 : t == null || t instanceof Date || typeof t == "number" ||
typeof t == "boolean" ? !0 : typeof t == "string" ? Xt.test(t) || nn.test(t) || Zt.test(t) || er.test(t) : Array.isArray(t) ? t.every((r) => He(
e, r)) : U(t) ? Object.entries(t).every(([r, o]) => He(r, o)) : !1, "validateArgs"), Ke = /* @__PURE__ */ a((e) => e === void 0 ? "!undefine\
d" : e === null ? "!null" : typeof e == "string" ? Zt.test(e) ? `!hex(${e.slice(1)})` : er.test(e) ? `!${e.replace(/[\s%]/g, "")}` : e : typeof e ==
"boolean" ? `!${e}` : e instanceof Date ? `!date(${e.toISOString()})` : Array.isArray(e) ? e.map(Ke) : U(e) ? Object.entries(e).reduce(
  (t, [r, o]) => Object.assign(t, { [r]: Ke(o) }),
  {}
) : e, "encodeSpecialValues"), on = /* @__PURE__ */ a((e) => {
  switch (e) {
    case "%20":
      return "+";
    case "%5B":
      return "[";
    case "%5D":
      return "]";
    case "%2C":
      return ",";
    case "%3A":
      return ":";
  }
  return e;
}, "decodeKnownQueryChar"), an = /%[0-9A-F]{2}/g, Zo = /* @__PURE__ */ a((e, t) => {
  let r = We(e, t);
  if (!r || r === xe)
    return "";
  let o = Object.entries(r).reduce((n, [i, s]) => He(i, s) ? Object.assign(n, { [i]: s }) : (tn.warn(Qt`
      Omitted potentially unsafe URL args.

      More info: https://storybook.js.org/docs/writing-stories/args?ref=error#setting-args-through-the-url
    `), n), {});
  return (0, ae.stringify)(Ke(o), {
    delimiter: ";",
    // we don't actually create multiple query params
    nesting: !0,
    nestingSyntax: "js"
    // encode objects using dot notation: obj.key=val
  }).replace(an, on).split(";").map((n) => n.replace("=", ":")).join(";");
}, "buildArgsParam"), sn = (0, be.default)(1e3)((e) => e !== void 0 ? (0, ae.parse)(e) : {}), tr = /* @__PURE__ */ a((e) => sn(e.search ? e.
search.slice(1) : ""), "queryFromLocation"), ea = /* @__PURE__ */ a((e) => {
  let t = (0, ae.stringify)(e);
  return t ? "?" + t : "";
}, "stringifyQuery"), rr = (0, be.default)(1e3)((e, t, r = !0) => {
  if (r) {
    if (typeof t != "string")
      throw new Error("startsWith only works with string targets");
    return e && e.startsWith(t) ? { path: e } : null;
  }
  let o = typeof t == "string" && e === t, n = e && t && e.match(t);
  return o || n ? { path: e } : null;
});

// src/router/router.tsx
import de, { useCallback as to } from "react";
import { global as ro } from "@storybook/global";

// ../node_modules/react-router-dom/dist/index.js
import * as E from "react";

// ../node_modules/react-router/dist/index.js
import * as b from "react";

// ../node_modules/@remix-run/router/dist/router.js
function ie() {
  return ie = Object.assign ? Object.assign.bind() : function(e) {
    for (var t = 1; t < arguments.length; t++) {
      var r = arguments[t];
      for (var o in r)
        Object.prototype.hasOwnProperty.call(r, o) && (e[o] = r[o]);
    }
    return e;
  }, ie.apply(this, arguments);
}
a(ie, "_extends");
var A;
(function(e) {
  e.Pop = "POP", e.Push = "PUSH", e.Replace = "REPLACE";
})(A || (A = {}));
var nr = "popstate";
function ir(e) {
  e === void 0 && (e = {});
  function t(o, n) {
    let {
      pathname: i,
      search: s,
      hash: l
    } = o.location;
    return $e(
      "",
      {
        pathname: i,
        search: s,
        hash: l
      },
      // state defaults to `null` because `window.history.state` does
      n.state && n.state.usr || null,
      n.state && n.state.key || "default"
    );
  }
  a(t, "createBrowserLocation");
  function r(o, n) {
    return typeof n == "string" ? n : I(n);
  }
  return a(r, "createBrowserHref"), un(t, r, null, e);
}
a(ir, "createBrowserHistory");
function N(e, t) {
  if (e === !1 || e === null || typeof e > "u")
    throw new Error(t);
}
a(N, "invariant");
function W(e, t) {
  if (!e) {
    typeof console < "u" && console.warn(t);
    try {
      throw new Error(t);
    } catch {
    }
  }
}
a(W, "warning");
function ln() {
  return Math.random().toString(36).substr(2, 8);
}
a(ln, "createKey");
function or(e, t) {
  return {
    usr: e.state,
    key: e.key,
    idx: t
  };
}
a(or, "getHistoryState");
function $e(e, t, r, o) {
  return r === void 0 && (r = null), ie({
    pathname: typeof e == "string" ? e : e.pathname,
    search: "",
    hash: ""
  }, typeof t == "string" ? H(t) : t, {
    state: r,
    // TODO: This could be cleaned up.  push/replace should probably just take
    // full Locations now and avoid the need to run through this flow at all
    // But that's a pretty big refactor to the current test suite so going to
    // keep as is for the time being and just let any incoming keys take precedence
    key: t && t.key || o || ln()
  });
}
a($e, "createLocation");
function I(e) {
  let {
    pathname: t = "/",
    search: r = "",
    hash: o = ""
  } = e;
  return r && r !== "?" && (t += r.charAt(0) === "?" ? r : "?" + r), o && o !== "#" && (t += o.charAt(0) === "#" ? o : "#" + o), t;
}
a(I, "createPath");
function H(e) {
  let t = {};
  if (e) {
    let r = e.indexOf("#");
    r >= 0 && (t.hash = e.substr(r), e = e.substr(0, r));
    let o = e.indexOf("?");
    o >= 0 && (t.search = e.substr(o), e = e.substr(0, o)), e && (t.pathname = e);
  }
  return t;
}
a(H, "parsePath");
function un(e, t, r, o) {
  o === void 0 && (o = {});
  let {
    window: n = document.defaultView,
    v5Compat: i = !1
  } = o, s = n.history, l = A.Pop, u = null, c = f();
  c == null && (c = 0, s.replaceState(ie({}, s.state, {
    idx: c
  }), ""));
  function f() {
    return (s.state || {
      idx: null
    }).idx;
  }
  a(f, "getIndex");
  function h() {
    l = A.Pop;
    let p = f(), v = p == null ? null : p - c;
    c = p, u && u({
      action: l,
      location: d.location,
      delta: v
    });
  }
  a(h, "handlePop");
  function m(p, v) {
    l = A.Push;
    let g = $e(d.location, p, v);
    r && r(g, p), c = f() + 1;
    let R = or(g, c), w = d.createHref(g);
    try {
      s.pushState(R, "", w);
    } catch (S) {
      if (S instanceof DOMException && S.name === "DataCloneError")
        throw S;
      n.location.assign(w);
    }
    i && u && u({
      action: l,
      location: d.location,
      delta: 1
    });
  }
  a(m, "push");
  function x(p, v) {
    l = A.Replace;
    let g = $e(d.location, p, v);
    r && r(g, p), c = f();
    let R = or(g, c), w = d.createHref(g);
    s.replaceState(R, "", w), i && u && u({
      action: l,
      location: d.location,
      delta: 0
    });
  }
  a(x, "replace");
  function y(p) {
    let v = n.location.origin !== "null" ? n.location.origin : n.location.href, g = typeof p == "string" ? p : I(p);
    return N(v, "No window.location.(origin|href) available to create URL for href: " + g), new URL(g, v);
  }
  a(y, "createURL");
  let d = {
    get action() {
      return l;
    },
    get location() {
      return e(n, s);
    },
    listen(p) {
      if (u)
        throw new Error("A history only accepts one active listener");
      return n.addEventListener(nr, h), u = p, () => {
        n.removeEventListener(nr, h), u = null;
      };
    },
    createHref(p) {
      return t(n, p);
    },
    createURL: y,
    encodeLocation(p) {
      let v = y(p);
      return {
        pathname: v.pathname,
        search: v.search,
        hash: v.hash
      };
    },
    push: m,
    replace: x,
    go(p) {
      return s.go(p);
    }
  };
  return d;
}
a(un, "getUrlBasedHistory");
var ar;
(function(e) {
  e.data = "data", e.deferred = "deferred", e.redirect = "redirect", e.error = "error";
})(ar || (ar = {}));
function K(e, t) {
  if (t === "/") return e;
  if (!e.toLowerCase().startsWith(t.toLowerCase()))
    return null;
  let r = t.endsWith("/") ? t.length - 1 : t.length, o = e.charAt(r);
  return o && o !== "/" ? null : e.slice(r) || "/";
}
a(K, "stripBasename");
function Je(e, t) {
  t === void 0 && (t = "/");
  let {
    pathname: r,
    search: o = "",
    hash: n = ""
  } = typeof e == "string" ? H(e) : e;
  return {
    pathname: r ? r.startsWith("/") ? r : cn(r, t) : t,
    search: fn(o),
    hash: dn(n)
  };
}
a(Je, "resolvePath");
function cn(e, t) {
  let r = t.replace(/\/+$/, "").split("/");
  return e.split("/").forEach((n) => {
    n === ".." ? r.length > 1 && r.pop() : n !== "." && r.push(n);
  }), r.length > 1 ? r.join("/") : "/";
}
a(cn, "resolvePathname");
function qe(e, t, r, o) {
  return "Cannot include a '" + e + "' character in a manually specified " + ("`to." + t + "` field [" + JSON.stringify(o) + "].  Please sep\
arate it out to the ") + ("`to." + r + "` field. Alternatively you may provide the full path as ") + 'a string in <Link to="..."> and the ro\
uter will parse it for you.';
}
a(qe, "getInvalidPathError");
function Ye(e) {
  return e.filter((t, r) => r === 0 || t.route.path && t.route.path.length > 0);
}
a(Ye, "getPathContributingMatches");
function Qe(e, t, r, o) {
  o === void 0 && (o = !1);
  let n;
  typeof e == "string" ? n = H(e) : (n = ie({}, e), N(!n.pathname || !n.pathname.includes("?"), qe("?", "pathname", "search", n)), N(!n.pathname ||
  !n.pathname.includes("#"), qe("#", "pathname", "hash", n)), N(!n.search || !n.search.includes("#"), qe("#", "search", "hash", n)));
  let i = e === "" || n.pathname === "", s = i ? "/" : n.pathname, l;
  if (o || s == null)
    l = r;
  else {
    let h = t.length - 1;
    if (s.startsWith("..")) {
      let m = s.split("/");
      for (; m[0] === ".."; )
        m.shift(), h -= 1;
      n.pathname = m.join("/");
    }
    l = h >= 0 ? t[h] : "/";
  }
  let u = Je(n, l), c = s && s !== "/" && s.endsWith("/"), f = (i || s === ".") && r.endsWith("/");
  return !u.pathname.endsWith("/") && (c || f) && (u.pathname += "/"), u;
}
a(Qe, "resolveTo");
var se = /* @__PURE__ */ a((e) => e.join("/").replace(/\/\/+/g, "/"), "joinPaths");
var fn = /* @__PURE__ */ a((e) => !e || e === "?" ? "" : e.startsWith("?") ? e : "?" + e, "normalizeSearch"), dn = /* @__PURE__ */ a((e) => !e ||
e === "#" ? "" : e.startsWith("#") ? e : "#" + e, "normalizeHash");
var sr = ["post", "put", "patch", "delete"], na = new Set(sr), hn = ["get", ...sr], oa = new Set(hn);
var aa = Symbol("deferred");

// ../node_modules/react-router/dist/index.js
function Xe() {
  return Xe = Object.assign ? Object.assign.bind() : function(e) {
    for (var t = 1; t < arguments.length; t++) {
      var r = arguments[t];
      for (var o in r)
        Object.prototype.hasOwnProperty.call(r, o) && (e[o] = r[o]);
    }
    return e;
  }, Xe.apply(this, arguments);
}
a(Xe, "_extends");
var $ = /* @__PURE__ */ b.createContext(null);
$.displayName = "DataRouter";
var J = /* @__PURE__ */ b.createContext(null);
J.displayName = "DataRouterState";
var xn = /* @__PURE__ */ b.createContext(null);
xn.displayName = "Await";
var O = /* @__PURE__ */ b.createContext(null);
O.displayName = "Navigation";
var le = /* @__PURE__ */ b.createContext(null);
le.displayName = "Location";
var B = /* @__PURE__ */ b.createContext({
  outlet: null,
  matches: [],
  isDataRoute: !1
});
B.displayName = "Route";
var bn = /* @__PURE__ */ b.createContext(null);
bn.displayName = "RouteError";
function Ge(e, t) {
  let {
    relative: r
  } = t === void 0 ? {} : t;
  ue() || N(
    !1,
    // TODO: This error is probably because they somehow have 2 versions of the
    // router loaded. We can help them understand how to avoid that.
    "useHref() may be used only in the context of a <Router> component."
  );
  let {
    basename: o,
    navigator: n
  } = b.useContext(O), {
    hash: i,
    pathname: s,
    search: l
  } = Y(e, {
    relative: r
  }), u = s;
  return o !== "/" && (u = s === "/" ? o : se([o, s])), n.createHref({
    pathname: u,
    search: l,
    hash: i
  });
}
a(Ge, "useHref");
function ue() {
  return b.useContext(le) != null;
}
a(ue, "useInRouterContext");
function L() {
  return ue() || N(
    !1,
    // TODO: This error is probably because they somehow have 2 versions of the
    // router loaded. We can help them understand how to avoid that.
    "useLocation() may be used only in the context of a <Router> component."
  ), b.useContext(le).location;
}
a(L, "useLocation");
var dr = "You should call navigate() in a React.useEffect(), not when your component is first rendered.";
function hr(e) {
  b.useContext(O).static || b.useLayoutEffect(e);
}
a(hr, "useIsomorphicLayoutEffect");
function ce() {
  let {
    isDataRoute: e
  } = b.useContext(B);
  return e ? Dn() : En();
}
a(ce, "useNavigate");
function En() {
  ue() || N(
    !1,
    // TODO: This error is probably because they somehow have 2 versions of the
    // router loaded. We can help them understand how to avoid that.
    "useNavigate() may be used only in the context of a <Router> component."
  );
  let e = b.useContext($), {
    basename: t,
    navigator: r
  } = b.useContext(O), {
    matches: o
  } = b.useContext(B), {
    pathname: n
  } = L(), i = JSON.stringify(Ye(o).map((u) => u.pathnameBase)), s = b.useRef(!1);
  return hr(() => {
    s.current = !0;
  }), b.useCallback(function(u, c) {
    if (c === void 0 && (c = {}), W(s.current, dr), !s.current) return;
    if (typeof u == "number") {
      r.go(u);
      return;
    }
    let f = Qe(u, JSON.parse(i), n, c.relative === "path");
    e == null && t !== "/" && (f.pathname = f.pathname === "/" ? t : se([t, f.pathname])), (c.replace ? r.replace : r.push)(f, c.state, c);
  }, [t, r, i, n, e]);
}
a(En, "useNavigateUnstable");
function Y(e, t) {
  let {
    relative: r
  } = t === void 0 ? {} : t, {
    matches: o
  } = b.useContext(B), {
    pathname: n
  } = L(), i = JSON.stringify(Ye(o).map((s) => s.pathnameBase));
  return b.useMemo(() => Qe(e, JSON.parse(i), n, r === "path"), [e, i, n, r]);
}
a(Y, "useResolvedPath");
var pr = /* @__PURE__ */ function(e) {
  return e.UseBlocker = "useBlocker", e.UseRevalidator = "useRevalidator", e.UseNavigateStable = "useNavigate", e;
}(pr || {}), fe = /* @__PURE__ */ function(e) {
  return e.UseBlocker = "useBlocker", e.UseLoaderData = "useLoaderData", e.UseActionData = "useActionData", e.UseRouteError = "useRouteError",
  e.UseNavigation = "useNavigation", e.UseRouteLoaderData = "useRouteLoaderData", e.UseMatches = "useMatches", e.UseRevalidator = "useRevali\
dator", e.UseNavigateStable = "useNavigate", e.UseRouteId = "useRouteId", e;
}(fe || {});
function Ze(e) {
  return e + " must be used within a data router.  See https://reactrouter.com/routers/picking-a-router.";
}
a(Ze, "getDataRouterConsoleError");
function wn(e) {
  let t = b.useContext($);
  return t || N(!1, Ze(e)), t;
}
a(wn, "useDataRouterContext");
function mr(e) {
  let t = b.useContext(J);
  return t || N(!1, Ze(e)), t;
}
a(mr, "useDataRouterState");
function Sn(e) {
  let t = b.useContext(B);
  return t || N(!1, Ze(e)), t;
}
a(Sn, "useRouteContext");
function gr(e) {
  let t = Sn(e), r = t.matches[t.matches.length - 1];
  return r.route.id || N(!1, e + ' can only be used on routes that contain a unique "id"'), r.route.id;
}
a(gr, "useCurrentRouteId");
function et() {
  return gr(fe.UseRouteId);
}
a(et, "useRouteId");
function tt() {
  return mr(fe.UseNavigation).navigation;
}
a(tt, "useNavigation");
function rt() {
  let {
    matches: e,
    loaderData: t
  } = mr(fe.UseMatches);
  return b.useMemo(() => e.map((r) => {
    let {
      pathname: o,
      params: n
    } = r;
    return {
      id: r.route.id,
      pathname: o,
      params: n,
      data: t[r.route.id],
      handle: r.route.handle
    };
  }), [e, t]);
}
a(rt, "useMatches");
function Dn() {
  let {
    router: e
  } = wn(pr.UseNavigateStable), t = gr(fe.UseNavigateStable), r = b.useRef(!1);
  return hr(() => {
    r.current = !0;
  }), b.useCallback(function(n, i) {
    i === void 0 && (i = {}), W(r.current, dr), r.current && (typeof n == "number" ? e.navigate(n) : e.navigate(n, Xe({
      fromRouteId: t
    }, i)));
  }, [e, t]);
}
a(Dn, "useNavigateStable");
var Nn = "startTransition", fa = b[Nn];
function Q(e) {
  let {
    basename: t = "/",
    children: r = null,
    location: o,
    navigationType: n = A.Pop,
    navigator: i,
    static: s = !1
  } = e;
  ue() && N(!1, "You cannot render a <Router> inside another <Router>. You should never have more than one in your app.");
  let l = t.replace(/^\/*/, "/"), u = b.useMemo(() => ({
    basename: l,
    navigator: i,
    static: s
  }), [l, i, s]);
  typeof o == "string" && (o = H(o));
  let {
    pathname: c = "/",
    search: f = "",
    hash: h = "",
    state: m = null,
    key: x = "default"
  } = o, y = b.useMemo(() => {
    let d = K(c, l);
    return d == null ? null : {
      location: {
        pathname: d,
        search: f,
        hash: h,
        state: m,
        key: x
      },
      navigationType: n
    };
  }, [l, c, f, h, m, x, n]);
  return W(y != null, '<Router basename="' + l + '"> is not able to match the URL ' + ('"' + c + f + h + '" because it does not start with t\
he ') + "basename, so the <Router> won't render anything."), y == null ? null : /* @__PURE__ */ b.createElement(O.Provider, {
    value: u
  }, /* @__PURE__ */ b.createElement(le.Provider, {
    children: r,
    value: y
  }));
}
a(Q, "Router");
var da = new Promise(() => {
});

// ../node_modules/react-router-dom/dist/index.js
function z() {
  return z = Object.assign ? Object.assign.bind() : function(e) {
    for (var t = 1; t < arguments.length; t++) {
      var r = arguments[t];
      for (var o in r)
        Object.prototype.hasOwnProperty.call(r, o) && (e[o] = r[o]);
    }
    return e;
  }, z.apply(this, arguments);
}
a(z, "_extends");
function at(e, t) {
  if (e == null) return {};
  var r = {}, o = Object.keys(e), n, i;
  for (i = 0; i < o.length; i++)
    n = o[i], !(t.indexOf(n) >= 0) && (r[n] = e[n]);
  return r;
}
a(at, "_objectWithoutPropertiesLoose");
var Se = "get", De = "application/x-www-form-urlencoded";
function Pe(e) {
  return e != null && typeof e.tagName == "string";
}
a(Pe, "isHtmlElement");
function Cn(e) {
  return Pe(e) && e.tagName.toLowerCase() === "button";
}
a(Cn, "isButtonElement");
function _n(e) {
  return Pe(e) && e.tagName.toLowerCase() === "form";
}
a(_n, "isFormElement");
function An(e) {
  return Pe(e) && e.tagName.toLowerCase() === "input";
}
a(An, "isInputElement");
function Ln(e) {
  return !!(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey);
}
a(Ln, "isModifiedEvent");
function Fn(e, t) {
  return e.button === 0 && // Ignore everything but left clicks
  (!t || t === "_self") && // Let browser handle "target=_blank" etc.
  !Ln(e);
}
a(Fn, "shouldProcessLinkClick");
var Ee = null;
function jn() {
  if (Ee === null)
    try {
      new FormData(
        document.createElement("form"),
        // @ts-expect-error if FormData supports the submitter parameter, this will throw
        0
      ), Ee = !1;
    } catch {
      Ee = !0;
    }
  return Ee;
}
a(jn, "isFormDataSubmitterSupported");
var Un = /* @__PURE__ */ new Set(["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"]);
function nt(e) {
  return e != null && !Un.has(e) ? (W(!1, '"' + e + '" is not a valid `encType` for `<Form>`/`<fetcher.Form>` ' + ('and will default to "' +
  De + '"')), null) : e;
}
a(nt, "getFormEncType");
function Mn(e, t) {
  let r, o, n, i, s;
  if (_n(e)) {
    let l = e.getAttribute("action");
    o = l ? K(l, t) : null, r = e.getAttribute("method") || Se, n = nt(e.getAttribute("enctype")) || De, i = new FormData(e);
  } else if (Cn(e) || An(e) && (e.type === "submit" || e.type === "image")) {
    let l = e.form;
    if (l == null)
      throw new Error('Cannot submit a <button> or <input type="submit"> without a <form>');
    let u = e.getAttribute("formaction") || l.getAttribute("action");
    if (o = u ? K(u, t) : null, r = e.getAttribute("formmethod") || l.getAttribute("method") || Se, n = nt(e.getAttribute("formenctype")) ||
    nt(l.getAttribute("enctype")) || De, i = new FormData(l, e), !jn()) {
      let {
        name: c,
        type: f,
        value: h
      } = e;
      if (f === "image") {
        let m = c ? c + "." : "";
        i.append(m + "x", "0"), i.append(m + "y", "0");
      } else c && i.append(c, h);
    }
  } else {
    if (Pe(e))
      throw new Error('Cannot submit element that is not <form>, <button>, or <input type="submit|image">');
    r = Se, o = null, n = De, s = e;
  }
  return i && n === "text/plain" && (s = i, i = void 0), {
    action: o,
    method: r.toLowerCase(),
    encType: n,
    formData: i,
    body: s
  };
}
a(Mn, "getFormSubmissionInfo");
var Tn = ["onClick", "relative", "reloadDocument", "replace", "state", "target", "to", "preventScrollReset"], In = ["aria-current", "caseSen\
sitive", "className", "end", "style", "to", "children"], Bn = ["reloadDocument", "replace", "state", "method", "action", "onSubmit", "submit",
"relative", "preventScrollReset"];
var zn = "startTransition", Ne = E[zn];
function vr(e) {
  let {
    basename: t,
    children: r,
    future: o,
    window: n
  } = e, i = E.useRef();
  i.current == null && (i.current = ir({
    window: n,
    v5Compat: !0
  }));
  let s = i.current, [l, u] = E.useState({
    action: s.action,
    location: s.location
  }), {
    v7_startTransition: c
  } = o || {}, f = E.useCallback((h) => {
    c && Ne ? Ne(() => u(h)) : u(h);
  }, [u, c]);
  return E.useLayoutEffect(() => s.listen(f), [s, f]), /* @__PURE__ */ E.createElement(Q, {
    basename: t,
    children: r,
    location: l.location,
    navigationType: l.action,
    navigator: s
  });
}
a(vr, "BrowserRouter");
function kn(e) {
  let {
    basename: t,
    children: r,
    future: o,
    history: n
  } = e, [i, s] = E.useState({
    action: n.action,
    location: n.location
  }), {
    v7_startTransition: l
  } = o || {}, u = E.useCallback((c) => {
    l && Ne ? Ne(() => s(c)) : s(c);
  }, [s, l]);
  return E.useLayoutEffect(() => n.listen(u), [n, u]), /* @__PURE__ */ E.createElement(Q, {
    basename: t,
    children: r,
    location: i.location,
    navigationType: i.action,
    navigator: n
  });
}
a(kn, "HistoryRouter");
kn.displayName = "unstable_HistoryRouter";
var Vn = typeof window < "u" && typeof window.document < "u" && typeof window.document.createElement < "u", Wn = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i,
Ce = /* @__PURE__ */ E.forwardRef(/* @__PURE__ */ a(function(t, r) {
  let {
    onClick: o,
    relative: n,
    reloadDocument: i,
    replace: s,
    state: l,
    target: u,
    to: c,
    preventScrollReset: f
  } = t, h = at(t, Tn), {
    basename: m
  } = E.useContext(O), x, y = !1;
  if (typeof c == "string" && Wn.test(c) && (x = c, Vn))
    try {
      let g = new URL(window.location.href), R = c.startsWith("//") ? new URL(g.protocol + c) : new URL(c), w = K(R.pathname, m);
      R.origin === g.origin && w != null ? c = w + R.search + R.hash : y = !0;
    } catch {
      W(!1, '<Link to="' + c + '"> contains an invalid URL which will probably break when clicked - please update to a valid URL path.');
    }
  let d = Ge(c, {
    relative: n
  }), p = Jn(c, {
    replace: s,
    state: l,
    target: u,
    preventScrollReset: f,
    relative: n
  });
  function v(g) {
    o && o(g), g.defaultPrevented || p(g);
  }
  return a(v, "handleClick"), // eslint-disable-next-line jsx-a11y/anchor-has-content
  /* @__PURE__ */ E.createElement("a", z({}, h, {
    href: x || d,
    onClick: y || i ? o : v,
    ref: r,
    target: u
  }));
}, "LinkWithRef"));
Ce.displayName = "Link";
var Hn = /* @__PURE__ */ E.forwardRef(/* @__PURE__ */ a(function(t, r) {
  let {
    "aria-current": o = "page",
    caseSensitive: n = !1,
    className: i = "",
    end: s = !1,
    style: l,
    to: u,
    children: c
  } = t, f = at(t, In), h = Y(u, {
    relative: f.relative
  }), m = L(), x = E.useContext(J), {
    navigator: y
  } = E.useContext(O), d = y.encodeLocation ? y.encodeLocation(h).pathname : h.pathname, p = m.pathname, v = x && x.navigation && x.navigation.
  location ? x.navigation.location.pathname : null;
  n || (p = p.toLowerCase(), v = v ? v.toLowerCase() : null, d = d.toLowerCase());
  let g = p === d || !s && p.startsWith(d) && p.charAt(d.length) === "/", R = v != null && (v === d || !s && v.startsWith(d) && v.charAt(d.length) ===
  "/"), w = g ? o : void 0, S;
  typeof i == "function" ? S = i({
    isActive: g,
    isPending: R
  }) : S = [i, g ? "active" : null, R ? "pending" : null].filter(Boolean).join(" ");
  let q = typeof l == "function" ? l({
    isActive: g,
    isPending: R
  }) : l;
  return /* @__PURE__ */ E.createElement(Ce, z({}, f, {
    "aria-current": w,
    className: S,
    ref: r,
    style: q,
    to: u
  }), typeof c == "function" ? c({
    isActive: g,
    isPending: R
  }) : c);
}, "NavLinkWithRef"));
Hn.displayName = "NavLink";
var Kn = /* @__PURE__ */ E.forwardRef((e, t) => {
  let r = Qn();
  return /* @__PURE__ */ E.createElement(Rr, z({}, e, {
    submit: r,
    ref: t
  }));
});
Kn.displayName = "Form";
var Rr = /* @__PURE__ */ E.forwardRef((e, t) => {
  let {
    reloadDocument: r,
    replace: o,
    state: n,
    method: i = Se,
    action: s,
    onSubmit: l,
    submit: u,
    relative: c,
    preventScrollReset: f
  } = e, h = at(e, Bn), m = i.toLowerCase() === "get" ? "get" : "post", x = Xn(s, {
    relative: c
  });
  return /* @__PURE__ */ E.createElement("form", z({
    ref: t,
    method: m,
    action: x,
    onSubmit: r ? l : /* @__PURE__ */ a((d) => {
      if (l && l(d), d.defaultPrevented) return;
      d.preventDefault();
      let p = d.nativeEvent.submitter, v = p?.getAttribute("formmethod") || i;
      u(p || d.currentTarget, {
        method: v,
        replace: o,
        state: n,
        relative: c,
        preventScrollReset: f
      });
    }, "submitHandler")
  }, h));
});
Rr.displayName = "FormImpl";
function qn(e) {
  let {
    getKey: t,
    storageKey: r
  } = e;
  return Gn({
    getKey: t,
    storageKey: r
  }), null;
}
a(qn, "ScrollRestoration");
qn.displayName = "ScrollRestoration";
var Oe;
(function(e) {
  e.UseScrollRestoration = "useScrollRestoration", e.UseSubmit = "useSubmit", e.UseSubmitFetcher = "useSubmitFetcher", e.UseFetcher = "useFe\
tcher";
})(Oe || (Oe = {}));
var ot;
(function(e) {
  e.UseFetchers = "useFetchers", e.UseScrollRestoration = "useScrollRestoration";
})(ot || (ot = {}));
function xr(e) {
  return e + " must be used within a data router.  See https://reactrouter.com/routers/picking-a-router.";
}
a(xr, "getDataRouterConsoleError");
function br(e) {
  let t = E.useContext($);
  return t || N(!1, xr(e)), t;
}
a(br, "useDataRouterContext");
function $n(e) {
  let t = E.useContext(J);
  return t || N(!1, xr(e)), t;
}
a($n, "useDataRouterState");
function Jn(e, t) {
  let {
    target: r,
    replace: o,
    state: n,
    preventScrollReset: i,
    relative: s
  } = t === void 0 ? {} : t, l = ce(), u = L(), c = Y(e, {
    relative: s
  });
  return E.useCallback((f) => {
    if (Fn(f, r)) {
      f.preventDefault();
      let h = o !== void 0 ? o : I(u) === I(c);
      l(e, {
        replace: h,
        state: n,
        preventScrollReset: i,
        relative: s
      });
    }
  }, [u, l, c, o, n, r, e, i, s]);
}
a(Jn, "useLinkClickHandler");
function Yn() {
  if (typeof document > "u")
    throw new Error("You are calling submit during the server render. Try calling submit within a `useEffect` or callback instead.");
}
a(Yn, "validateClientSideSubmission");
function Qn() {
  let {
    router: e
  } = br(Oe.UseSubmit), {
    basename: t
  } = E.useContext(O), r = et();
  return E.useCallback(function(o, n) {
    n === void 0 && (n = {}), Yn();
    let {
      action: i,
      method: s,
      encType: l,
      formData: u,
      body: c
    } = Mn(o, t);
    e.navigate(n.action || i, {
      preventScrollReset: n.preventScrollReset,
      formData: u,
      body: c,
      formMethod: n.method || s,
      formEncType: n.encType || l,
      replace: n.replace,
      state: n.state,
      fromRouteId: r
    });
  }, [e, t, r]);
}
a(Qn, "useSubmit");
function Xn(e, t) {
  let {
    relative: r
  } = t === void 0 ? {} : t, {
    basename: o
  } = E.useContext(O), n = E.useContext(B);
  n || N(!1, "useFormAction must be used inside a RouteContext");
  let [i] = n.matches.slice(-1), s = z({}, Y(e || ".", {
    relative: r
  })), l = L();
  if (e == null && (s.search = l.search, i.route.index)) {
    let u = new URLSearchParams(s.search);
    u.delete("index"), s.search = u.toString() ? "?" + u.toString() : "";
  }
  return (!e || e === ".") && i.route.index && (s.search = s.search ? s.search.replace(/^\?/, "?index&") : "?index"), o !== "/" && (s.pathname =
  s.pathname === "/" ? o : se([o, s.pathname])), I(s);
}
a(Xn, "useFormAction");
var yr = "react-router-scroll-positions", we = {};
function Gn(e) {
  let {
    getKey: t,
    storageKey: r
  } = e === void 0 ? {} : e, {
    router: o
  } = br(Oe.UseScrollRestoration), {
    restoreScrollPosition: n,
    preventScrollReset: i
  } = $n(ot.UseScrollRestoration), {
    basename: s
  } = E.useContext(O), l = L(), u = rt(), c = tt();
  E.useEffect(() => (window.history.scrollRestoration = "manual", () => {
    window.history.scrollRestoration = "auto";
  }), []), Zn(E.useCallback(() => {
    if (c.state === "idle") {
      let f = (t ? t(l, u) : null) || l.key;
      we[f] = window.scrollY;
    }
    sessionStorage.setItem(r || yr, JSON.stringify(we)), window.history.scrollRestoration = "auto";
  }, [r, t, c.state, l, u])), typeof document < "u" && (E.useLayoutEffect(() => {
    try {
      let f = sessionStorage.getItem(r || yr);
      f && (we = JSON.parse(f));
    } catch {
    }
  }, [r]), E.useLayoutEffect(() => {
    let f = t && s !== "/" ? (m, x) => t(
      // Strip the basename to match useLocation()
      z({}, m, {
        pathname: K(m.pathname, s) || m.pathname
      }),
      x
    ) : t, h = o?.enableScrollRestoration(we, () => window.scrollY, f);
    return () => h && h();
  }, [o, s, t]), E.useLayoutEffect(() => {
    if (n !== !1) {
      if (typeof n == "number") {
        window.scrollTo(0, n);
        return;
      }
      if (l.hash) {
        let f = document.getElementById(decodeURIComponent(l.hash.slice(1)));
        if (f) {
          f.scrollIntoView();
          return;
        }
      }
      i !== !0 && window.scrollTo(0, 0);
    }
  }, [l, n, i]));
}
a(Gn, "useScrollRestoration");
function Zn(e, t) {
  let {
    capture: r
  } = t || {};
  E.useEffect(() => {
    let o = r != null ? {
      capture: r
    } : void 0;
    return window.addEventListener("pagehide", e, o), () => {
      window.removeEventListener("pagehide", e, o);
    };
  }, [e, r]);
}
a(Zn, "usePageHide");

// src/router/router.tsx
var { document: it } = ro, no = /* @__PURE__ */ a(() => `${it.location.pathname}?`, "getBase"), Ja = /* @__PURE__ */ a(() => {
  let e = ce();
  return to((t, { plain: r, ...o } = {}) => {
    if (typeof t == "string" && t.startsWith("#")) {
      t === "#" ? e(it.location.search) : it.location.hash = t;
      return;
    }
    if (typeof t == "string") {
      let n = r ? t : `?path=${t}`;
      return e(n, o);
    }
    if (typeof t == "number")
      return e(t);
  }, []);
}, "useNavigate"), oo = /* @__PURE__ */ a(({ to: e, children: t, ...r }) => /* @__PURE__ */ de.createElement(Ce, { to: `${no()}path=${e}`, ...r },
t), "Link");
oo.displayName = "QueryLink";
var Er = /* @__PURE__ */ a(({ children: e }) => {
  let t = L(), { path: r, singleStory: o } = tr(t), { viewMode: n, storyId: i, refId: s } = Gt(r);
  return /* @__PURE__ */ de.createElement(de.Fragment, null, e({
    path: r || "/",
    location: t,
    viewMode: n,
    storyId: i,
    refId: s,
    singleStory: o === "true"
  }));
}, "Location");
Er.displayName = "QueryLocation";
function wr({
  children: e,
  path: t,
  startsWith: r = !1
}) {
  return /* @__PURE__ */ de.createElement(Er, null, ({ path: o, ...n }) => e({
    match: rr(o, t, r),
    ...n
  }));
}
a(wr, "Match");
wr.displayName = "QueryMatch";
function ao(e) {
  let { children: t, ...r } = e;
  return r.startsWith === void 0 && (r.startsWith = !1), /* @__PURE__ */ de.createElement(wr, { ...r }, ({ match: n }) => n ? t : null);
}
a(ao, "Route");
ao.displayName = "Route";
var Ya = /* @__PURE__ */ a((...e) => vr(...e), "LocationProvider"), Qa = /* @__PURE__ */ a((...e) => Q(...e), "BaseLocationProvider");
export {
  Qa as BaseLocationProvider,
  xe as DEEPLY_EQUAL,
  oo as Link,
  Er as Location,
  Ya as LocationProvider,
  wr as Match,
  ao as Route,
  Zo as buildArgsParam,
  We as deepDiff,
  rr as getMatch,
  Gt as parsePath,
  tr as queryFromLocation,
  ea as stringifyQuery,
  Ja as useNavigate
};
