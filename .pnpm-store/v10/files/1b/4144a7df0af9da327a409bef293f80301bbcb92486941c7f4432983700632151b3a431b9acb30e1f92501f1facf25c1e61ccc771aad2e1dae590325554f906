"use strict";
var Sa = Object.create;
var Pt = Object.defineProperty;
var Pa = Object.getOwnPropertyDescriptor;
var xa = Object.getOwnPropertyNames;
var wa = Object.getPrototypeOf, Oa = Object.prototype.hasOwnProperty;
var n = (e, r) => Pt(e, "name", { value: r, configurable: !0 });
var He = (e, r) => () => (r || e((r = { exports: {} }).exports, r), r.exports), Ca = (e, r) => {
  for (var t in r)
    Pt(e, t, { get: r[t], enumerable: !0 });
}, Dr = (e, r, t, o) => {
  if (r && typeof r == "object" || typeof r == "function")
    for (let a of xa(r))
      !Oa.call(e, a) && a !== t && Pt(e, a, { get: () => r[a], enumerable: !(o = Pa(r, a)) || o.enumerable });
  return e;
};
var xt = (e, r, t) => (t = e != null ? Sa(wa(e)) : {}, Dr(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  r || !e || !e.__esModule ? Pt(t, "default", { value: e, enumerable: !0 }) : t,
  e
)), Aa = (e) => Dr(Pt({}, "__esModule", { value: !0 }), e);

// ../node_modules/map-or-similar/src/similar.js
var on = He((Fi, an) => {
  function lt() {
    return this.list = [], this.lastItem = void 0, this.size = 0, this;
  }
  n(lt, "Similar");
  lt.prototype.get = function(e) {
    var r;
    if (this.lastItem && this.isEqual(this.lastItem.key, e))
      return this.lastItem.val;
    if (r = this.indexOf(e), r >= 0)
      return this.lastItem = this.list[r], this.list[r].val;
  };
  lt.prototype.set = function(e, r) {
    var t;
    return this.lastItem && this.isEqual(this.lastItem.key, e) ? (this.lastItem.val = r, this) : (t = this.indexOf(e), t >= 0 ? (this.lastItem =
    this.list[t], this.list[t].val = r, this) : (this.lastItem = { key: e, val: r }, this.list.push(this.lastItem), this.size++, this));
  };
  lt.prototype.delete = function(e) {
    var r;
    if (this.lastItem && this.isEqual(this.lastItem.key, e) && (this.lastItem = void 0), r = this.indexOf(e), r >= 0)
      return this.size--, this.list.splice(r, 1)[0];
  };
  lt.prototype.has = function(e) {
    var r;
    return this.lastItem && this.isEqual(this.lastItem.key, e) ? !0 : (r = this.indexOf(e), r >= 0 ? (this.lastItem = this.list[r], !0) : !1);
  };
  lt.prototype.forEach = function(e, r) {
    var t;
    for (t = 0; t < this.size; t++)
      e.call(r || this, this.list[t].val, this.list[t].key, this);
  };
  lt.prototype.indexOf = function(e) {
    var r;
    for (r = 0; r < this.size; r++)
      if (this.isEqual(this.list[r].key, e))
        return r;
    return -1;
  };
  lt.prototype.isEqual = function(e, r) {
    return e === r || e !== e && r !== r;
  };
  an.exports = lt;
});

// ../node_modules/map-or-similar/src/map-or-similar.js
var un = He((Li, ln) => {
  ln.exports = function(e) {
    if (typeof Map != "function" || e) {
      var r = on();
      return new r();
    } else
      return /* @__PURE__ */ new Map();
  };
});

// ../node_modules/memoizerific/src/memoizerific.js
var fn = He((Mi, cn) => {
  var sn = un();
  cn.exports = function(e) {
    var r = new sn(process.env.FORCE_SIMILAR_INSTEAD_OF_MAP === "true"), t = [];
    return function(o) {
      var a = /* @__PURE__ */ n(function() {
        var i = r, l, b, g = arguments.length - 1, R = Array(g + 1), w = !0, x;
        if ((a.numArgs || a.numArgs === 0) && a.numArgs !== g + 1)
          throw new Error("Memoizerific functions should always be called with the same number of arguments");
        for (x = 0; x < g; x++) {
          if (R[x] = {
            cacheItem: i,
            arg: arguments[x]
          }, i.has(arguments[x])) {
            i = i.get(arguments[x]);
            continue;
          }
          w = !1, l = new sn(process.env.FORCE_SIMILAR_INSTEAD_OF_MAP === "true"), i.set(arguments[x], l), i = l;
        }
        return w && (i.has(arguments[g]) ? b = i.get(arguments[g]) : w = !1), w || (b = o.apply(null, arguments), i.set(arguments[g], b)), e >
        0 && (R[g] = {
          cacheItem: i,
          arg: arguments[g]
        }, w ? ja(t, R) : t.push(R), t.length > e && Da(t.shift())), a.wasMemoized = w, a.numArgs = g + 1, b;
      }, "memoizerific");
      return a.limit = e, a.wasMemoized = !1, a.cache = r, a.lru = t, a;
    };
  };
  function ja(e, r) {
    var t = e.length, o = r.length, a, i, l;
    for (i = 0; i < t; i++) {
      for (a = !0, l = 0; l < o; l++)
        if (!Na(e[i][l].arg, r[l].arg)) {
          a = !1;
          break;
        }
      if (a)
        break;
    }
    e.push(e.splice(i, 1)[0]);
  }
  n(ja, "moveToMostRecentLru");
  function Da(e) {
    var r = e.length, t = e[r - 1], o, a;
    for (t.cacheItem.delete(t.arg), a = r - 2; a >= 0 && (t = e[a], o = t.cacheItem.get(t.arg), !o || !o.size); a--)
      t.cacheItem.delete(t.arg);
  }
  n(Da, "removeCachedResult");
  function Na(e, r) {
    return e === r || e !== e && r !== r;
  }
  n(Na, "isEqual");
});

// ../node_modules/picoquery/lib/string-util.js
var ir = He((or) => {
  "use strict";
  Object.defineProperty(or, "__esModule", { value: !0 });
  or.encodeString = Fa;
  var Xe = Array.from({ length: 256 }, (e, r) => "%" + ((r < 16 ? "0" : "") + r.toString(16)).toUpperCase()), _a = new Int8Array([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
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
  function Fa(e) {
    let r = e.length;
    if (r === 0)
      return "";
    let t = "", o = 0, a = 0;
    e: for (; a < r; a++) {
      let i = e.charCodeAt(a);
      for (; i < 128; ) {
        if (_a[i] !== 1 && (o < a && (t += e.slice(o, a)), o = a + 1, t += Xe[i]), ++a === r)
          break e;
        i = e.charCodeAt(a);
      }
      if (o < a && (t += e.slice(o, a)), i < 2048) {
        o = a + 1, t += Xe[192 | i >> 6] + Xe[128 | i & 63];
        continue;
      }
      if (i < 55296 || i >= 57344) {
        o = a + 1, t += Xe[224 | i >> 12] + Xe[128 | i >> 6 & 63] + Xe[128 | i & 63];
        continue;
      }
      if (++a, a >= r)
        throw new Error("URI malformed");
      let l = e.charCodeAt(a) & 1023;
      o = a + 1, i = 65536 + ((i & 1023) << 10 | l), t += Xe[240 | i >> 18] + Xe[128 | i >> 12 & 63] + Xe[128 | i >> 6 & 63] + Xe[128 | i & 63];
    }
    return o === 0 ? e : o < r ? t + e.slice(o) : t;
  }
  n(Fa, "encodeString");
});

// ../node_modules/picoquery/lib/shared.js
var Bt = He((Ge) => {
  "use strict";
  Object.defineProperty(Ge, "__esModule", { value: !0 });
  Ge.defaultOptions = Ge.defaultShouldSerializeObject = Ge.defaultValueSerializer = void 0;
  var lr = ir(), Ua = /* @__PURE__ */ n((e) => {
    switch (typeof e) {
      case "string":
        return (0, lr.encodeString)(e);
      case "bigint":
      case "boolean":
        return "" + e;
      case "number":
        if (Number.isFinite(e))
          return e < 1e21 ? "" + e : (0, lr.encodeString)("" + e);
        break;
    }
    return e instanceof Date ? (0, lr.encodeString)(e.toISOString()) : "";
  }, "defaultValueSerializer");
  Ge.defaultValueSerializer = Ua;
  var La = /* @__PURE__ */ n((e) => e instanceof Date, "defaultShouldSerializeObject");
  Ge.defaultShouldSerializeObject = La;
  var dn = /* @__PURE__ */ n((e) => e, "identityFunc");
  Ge.defaultOptions = {
    nesting: !0,
    nestingSyntax: "dot",
    arrayRepeat: !1,
    arrayRepeatSyntax: "repeat",
    delimiter: 38,
    valueDeserializer: dn,
    valueSerializer: Ge.defaultValueSerializer,
    keyDeserializer: dn,
    shouldSerializeObject: Ge.defaultShouldSerializeObject
  };
});

// ../node_modules/picoquery/lib/object-util.js
var ur = He((kt) => {
  "use strict";
  Object.defineProperty(kt, "__esModule", { value: !0 });
  kt.getDeepObject = Ia;
  kt.stringifyObject = hn;
  var dt = Bt(), Ma = ir();
  function Ta(e) {
    return e === "__proto__" || e === "constructor" || e === "prototype";
  }
  n(Ta, "isPrototypeKey");
  function Ia(e, r, t, o, a) {
    if (Ta(r))
      return e;
    let i = e[r];
    return typeof i == "object" && i !== null ? i : !o && (a || typeof t == "number" || typeof t == "string" && t * 0 === 0 && t.indexOf(".") ===
    -1) ? e[r] = [] : e[r] = {};
  }
  n(Ia, "getDeepObject");
  var Ba = 20, ka = "[]", za = "[", Ha = "]", Wa = ".";
  function hn(e, r, t = 0, o, a) {
    let { nestingSyntax: i = dt.defaultOptions.nestingSyntax, arrayRepeat: l = dt.defaultOptions.arrayRepeat, arrayRepeatSyntax: b = dt.defaultOptions.
    arrayRepeatSyntax, nesting: g = dt.defaultOptions.nesting, delimiter: R = dt.defaultOptions.delimiter, valueSerializer: w = dt.defaultOptions.
    valueSerializer, shouldSerializeObject: x = dt.defaultOptions.shouldSerializeObject } = r, M = typeof R == "number" ? String.fromCharCode(
    R) : R, _ = a === !0 && l, N = i === "dot" || i === "js" && !a;
    if (t > Ba)
      return "";
    let L = "", A = !0, Q = !1;
    for (let Z in e) {
      let V = e[Z], m;
      o ? (m = o, _ ? b === "bracket" && (m += ka) : N ? (m += Wa, m += Z) : (m += za, m += Z, m += Ha)) : m = Z, A || (L += M), typeof V ==
      "object" && V !== null && !x(V) ? (Q = V.pop !== void 0, (g || l && Q) && (L += hn(V, r, t + 1, m, Q))) : (L += (0, Ma.encodeString)(m),
      L += "=", L += w(V, Z)), A && (A = !1);
    }
    return L;
  }
  n(hn, "stringifyObject");
});

// ../node_modules/fast-decode-uri-component/index.js
var yn = He((Ki, gn) => {
  "use strict";
  var mn = 12, Ka = 0, sr = [
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
  function qa(e) {
    var r = e.indexOf("%");
    if (r === -1) return e;
    for (var t = e.length, o = "", a = 0, i = 0, l = r, b = mn; r > -1 && r < t; ) {
      var g = pn(e[r + 1], 4), R = pn(e[r + 2], 0), w = g | R, x = sr[w];
      if (b = sr[256 + b + x], i = i << 6 | w & sr[364 + x], b === mn)
        o += e.slice(a, l), o += i <= 65535 ? String.fromCharCode(i) : String.fromCharCode(
          55232 + (i >> 10),
          56320 + (i & 1023)
        ), i = 0, a = r + 3, r = l = e.indexOf("%", a);
      else {
        if (b === Ka)
          return null;
        if (r += 3, r < t && e.charCodeAt(r) === 37) continue;
        return null;
      }
    }
    return o + e.slice(a);
  }
  n(qa, "decodeURIComponent");
  var $a = {
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
  function pn(e, r) {
    var t = $a[e];
    return t === void 0 ? 255 : t << r;
  }
  n(pn, "hexCodeToInt");
  gn.exports = qa;
});

// ../node_modules/picoquery/lib/parse.js
var Rn = He((nt) => {
  "use strict";
  var Va = nt && nt.__importDefault || function(e) {
    return e && e.__esModule ? e : { default: e };
  };
  Object.defineProperty(nt, "__esModule", { value: !0 });
  nt.numberValueDeserializer = nt.numberKeyDeserializer = void 0;
  nt.parse = Qa;
  var zt = ur(), ht = Bt(), bn = Va(yn()), Ja = /* @__PURE__ */ n((e) => {
    let r = Number(e);
    return Number.isNaN(r) ? e : r;
  }, "numberKeyDeserializer");
  nt.numberKeyDeserializer = Ja;
  var Ya = /* @__PURE__ */ n((e) => {
    let r = Number(e);
    return Number.isNaN(r) ? e : r;
  }, "numberValueDeserializer");
  nt.numberValueDeserializer = Ya;
  var vn = /\+/g, En = /* @__PURE__ */ n(function() {
  }, "Empty");
  En.prototype = /* @__PURE__ */ Object.create(null);
  function Ht(e, r, t, o, a) {
    let i = e.substring(r, t);
    return o && (i = i.replace(vn, " ")), a && (i = (0, bn.default)(i) || i), i;
  }
  n(Ht, "computeKeySlice");
  function Qa(e, r) {
    let { valueDeserializer: t = ht.defaultOptions.valueDeserializer, keyDeserializer: o = ht.defaultOptions.keyDeserializer, arrayRepeatSyntax: a = ht.
    defaultOptions.arrayRepeatSyntax, nesting: i = ht.defaultOptions.nesting, arrayRepeat: l = ht.defaultOptions.arrayRepeat, nestingSyntax: b = ht.
    defaultOptions.nestingSyntax, delimiter: g = ht.defaultOptions.delimiter } = r ?? {}, R = typeof g == "string" ? g.charCodeAt(0) : g, w = b ===
    "js", x = new En();
    if (typeof e != "string")
      return x;
    let M = e.length, _ = "", N = -1, L = -1, A = -1, Q = x, Z, V = "", m = "", ee = !1, de = !1, ae = !1, Se = !1, Pe = !1, xe = !1, Ae = !1,
    oe = 0, Ue = -1, Ee = -1, we = -1;
    for (let ce = 0; ce < M + 1; ce++) {
      if (oe = ce !== M ? e.charCodeAt(ce) : R, oe === R) {
        if (Ae = L > N, Ae || (L = ce), A !== L - 1 && (m = Ht(e, A + 1, Ue > -1 ? Ue : L, ae, ee), V = o(m), Z !== void 0 && (Q = (0, zt.getDeepObject)(
        Q, Z, V, w && Pe, w && xe))), Ae || V !== "") {
          Ae && (_ = e.slice(L + 1, ce), Se && (_ = _.replace(vn, " ")), de && (_ = (0, bn.default)(_) || _));
          let Fe = t(_, V);
          if (l) {
            let Ce = Q[V];
            Ce === void 0 ? Ue > -1 ? Q[V] = [Fe] : Q[V] = Fe : Ce.pop ? Ce.push(Fe) : Q[V] = [Ce, Fe];
          } else
            Q[V] = Fe;
        }
        _ = "", N = ce, L = ce, ee = !1, de = !1, ae = !1, Se = !1, Pe = !1, xe = !1, Ue = -1, A = ce, Q = x, Z = void 0, V = "";
      } else oe === 93 ? (l && a === "bracket" && we === 91 && (Ue = Ee), i && (b === "index" || w) && L <= N && (A !== Ee && (m = Ht(e, A +
      1, ce, ae, ee), V = o(m), Z !== void 0 && (Q = (0, zt.getDeepObject)(Q, Z, V, void 0, w)), Z = V, ae = !1, ee = !1), A = ce, xe = !0, Pe =
      !1)) : oe === 46 ? i && (b === "dot" || w) && L <= N && (A !== Ee && (m = Ht(e, A + 1, ce, ae, ee), V = o(m), Z !== void 0 && (Q = (0, zt.
      getDeepObject)(Q, Z, V, w)), Z = V, ae = !1, ee = !1), Pe = !0, xe = !1, A = ce) : oe === 91 ? i && (b === "index" || w) && L <= N && (A !==
      Ee && (m = Ht(e, A + 1, ce, ae, ee), V = o(m), w && Z !== void 0 && (Q = (0, zt.getDeepObject)(Q, Z, V, w)), Z = V, ae = !1, ee = !1, Pe =
      !1, xe = !0), A = ce) : oe === 61 ? L <= N ? L = ce : de = !0 : oe === 43 ? L > N ? Se = !0 : ae = !0 : oe === 37 && (L > N ? de = !0 :
      ee = !0);
      Ee = ce, we = oe;
    }
    return x;
  }
  n(Qa, "parse");
});

// ../node_modules/picoquery/lib/stringify.js
var Sn = He((cr) => {
  "use strict";
  Object.defineProperty(cr, "__esModule", { value: !0 });
  cr.stringify = Ga;
  var Xa = ur();
  function Ga(e, r) {
    if (e === null || typeof e != "object")
      return "";
    let t = r ?? {};
    return (0, Xa.stringifyObject)(e, t);
  }
  n(Ga, "stringify");
});

// ../node_modules/picoquery/lib/main.js
var Pn = He((Je) => {
  "use strict";
  var Za = Je && Je.__createBinding || (Object.create ? function(e, r, t, o) {
    o === void 0 && (o = t);
    var a = Object.getOwnPropertyDescriptor(r, t);
    (!a || ("get" in a ? !r.__esModule : a.writable || a.configurable)) && (a = { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return r[t];
    }, "get") }), Object.defineProperty(e, o, a);
  } : function(e, r, t, o) {
    o === void 0 && (o = t), e[o] = r[t];
  }), eo = Je && Je.__exportStar || function(e, r) {
    for (var t in e) t !== "default" && !Object.prototype.hasOwnProperty.call(r, t) && Za(r, e, t);
  };
  Object.defineProperty(Je, "__esModule", { value: !0 });
  Je.stringify = Je.parse = void 0;
  var to = Rn();
  Object.defineProperty(Je, "parse", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return to.parse;
  }, "get") });
  var ro = Sn();
  Object.defineProperty(Je, "stringify", { enumerable: !0, get: /* @__PURE__ */ n(function() {
    return ro.stringify;
  }, "get") });
  eo(Bt(), Je);
});

// ../node_modules/ts-dedent/dist/index.js
var wn = He((Ct) => {
  "use strict";
  Object.defineProperty(Ct, "__esModule", { value: !0 });
  Ct.dedent = void 0;
  function xn(e) {
    for (var r = [], t = 1; t < arguments.length; t++)
      r[t - 1] = arguments[t];
    var o = Array.from(typeof e == "string" ? [e] : e);
    o[o.length - 1] = o[o.length - 1].replace(/\r?\n([\t ]*)$/, "");
    var a = o.reduce(function(b, g) {
      var R = g.match(/\n([\t ]+|(?!\s).)/g);
      return R ? b.concat(R.map(function(w) {
        var x, M;
        return (M = (x = w.match(/[\t ]/g)) === null || x === void 0 ? void 0 : x.length) !== null && M !== void 0 ? M : 0;
      })) : b;
    }, []);
    if (a.length) {
      var i = new RegExp(`
[	 ]{` + Math.min.apply(Math, a) + "}", "g");
      o = o.map(function(b) {
        return b.replace(i, `
`);
      });
    }
    o[0] = o[0].replace(/^\r?\n/, "");
    var l = o[0];
    return r.forEach(function(b, g) {
      var R = l.match(/(?:^|\n)( *)$/), w = R ? R[1] : "", x = b;
      typeof b == "string" && b.includes(`
`) && (x = String(b).split(`
`).map(function(M, _) {
        return _ === 0 ? M : "" + w + M;
      }).join(`
`)), l += x + o[g + 1];
    }), l;
  }
  n(xn, "dedent");
  Ct.dedent = xn;
  Ct.default = xn;
});

// ../node_modules/@remix-run/router/dist/router.cjs.js
var Tt = He((fe) => {
  "use strict";
  Object.defineProperty(fe, "__esModule", { value: !0 });
  function me() {
    return me = Object.assign ? Object.assign.bind() : function(e) {
      for (var r = 1; r < arguments.length; r++) {
        var t = arguments[r];
        for (var o in t)
          Object.prototype.hasOwnProperty.call(t, o) && (e[o] = t[o]);
      }
      return e;
    }, me.apply(this, arguments);
  }
  n(me, "_extends");
  var Te = /* @__PURE__ */ function(e) {
    return e.Pop = "POP", e.Push = "PUSH", e.Replace = "REPLACE", e;
  }({}), Nn = "popstate";
  function co(e) {
    e === void 0 && (e = {});
    let {
      initialEntries: r = ["/"],
      initialIndex: t,
      v5Compat: o = !1
    } = e, a;
    a = r.map((_, N) => w(_, typeof _ == "string" ? null : _.state, N === 0 ? "default" : void 0));
    let i = g(t ?? a.length - 1), l = Te.Pop, b = null;
    function g(_) {
      return Math.min(Math.max(_, 0), a.length - 1);
    }
    n(g, "clampIndex");
    function R() {
      return a[i];
    }
    n(R, "getCurrentLocation");
    function w(_, N, L) {
      N === void 0 && (N = null);
      let A = at(a ? R().pathname : "/", _, N, L);
      return Ze(A.pathname.charAt(0) === "/", "relative pathnames are not supported in memory history: " + JSON.stringify(_)), A;
    }
    n(w, "createMemoryLocation");
    function x(_) {
      return typeof _ == "string" ? _ : et(_);
    }
    return n(x, "createHref"), {
      get index() {
        return i;
      },
      get action() {
        return l;
      },
      get location() {
        return R();
      },
      createHref: x,
      createURL(_) {
        return new URL(x(_), "http://localhost");
      },
      encodeLocation(_) {
        let N = typeof _ == "string" ? Ye(_) : _;
        return {
          pathname: N.pathname || "",
          search: N.search || "",
          hash: N.hash || ""
        };
      },
      push(_, N) {
        l = Te.Push;
        let L = w(_, N);
        i += 1, a.splice(i, a.length, L), o && b && b({
          action: l,
          location: L,
          delta: 1
        });
      },
      replace(_, N) {
        l = Te.Replace;
        let L = w(_, N);
        a[i] = L, o && b && b({
          action: l,
          location: L,
          delta: 0
        });
      },
      go(_) {
        l = Te.Pop;
        let N = g(i + _), L = a[N];
        i = N, b && b({
          action: l,
          location: L,
          delta: _
        });
      },
      listen(_) {
        return b = _, () => {
          b = null;
        };
      }
    };
  }
  n(co, "createMemoryHistory");
  function fo(e) {
    e === void 0 && (e = {});
    function r(o, a) {
      let {
        pathname: i,
        search: l,
        hash: b
      } = o.location;
      return at(
        "",
        {
          pathname: i,
          search: l,
          hash: b
        },
        // state defaults to `null` because `window.history.state` does
        a.state && a.state.usr || null,
        a.state && a.state.key || "default"
      );
    }
    n(r, "createBrowserLocation");
    function t(o, a) {
      return typeof a == "string" ? a : et(a);
    }
    return n(t, "createBrowserHref"), Kn(r, t, null, e);
  }
  n(fo, "createBrowserHistory");
  function ho(e) {
    e === void 0 && (e = {});
    function r(a, i) {
      let {
        pathname: l = "/",
        search: b = "",
        hash: g = ""
      } = Ye(a.location.hash.substr(1));
      return !l.startsWith("/") && !l.startsWith(".") && (l = "/" + l), at(
        "",
        {
          pathname: l,
          search: b,
          hash: g
        },
        // state defaults to `null` because `window.history.state` does
        i.state && i.state.usr || null,
        i.state && i.state.key || "default"
      );
    }
    n(r, "createHashLocation");
    function t(a, i) {
      let l = a.document.querySelector("base"), b = "";
      if (l && l.getAttribute("href")) {
        let g = a.location.href, R = g.indexOf("#");
        b = R === -1 ? g : g.slice(0, R);
      }
      return b + "#" + (typeof i == "string" ? i : et(i));
    }
    n(t, "createHashHref");
    function o(a, i) {
      Ze(a.pathname.charAt(0) === "/", "relative pathnames are not supported in hash history.push(" + JSON.stringify(i) + ")");
    }
    return n(o, "validateHashLocation"), Kn(r, t, o, e);
  }
  n(ho, "createHashHistory");
  function be(e, r) {
    if (e === !1 || e === null || typeof e > "u")
      throw new Error(r);
  }
  n(be, "invariant");
  function Ze(e, r) {
    if (!e) {
      typeof console < "u" && console.warn(r);
      try {
        throw new Error(r);
      } catch {
      }
    }
  }
  n(Ze, "warning");
  function mo() {
    return Math.random().toString(36).substr(2, 8);
  }
  n(mo, "createKey");
  function _n(e, r) {
    return {
      usr: e.state,
      key: e.key,
      idx: r
    };
  }
  n(_n, "getHistoryState");
  function at(e, r, t, o) {
    return t === void 0 && (t = null), me({
      pathname: typeof e == "string" ? e : e.pathname,
      search: "",
      hash: ""
    }, typeof r == "string" ? Ye(r) : r, {
      state: t,
      // TODO: This could be cleaned up.  push/replace should probably just take
      // full Locations now and avoid the need to run through this flow at all
      // But that's a pretty big refactor to the current test suite so going to
      // keep as is for the time being and just let any incoming keys take precedence
      key: r && r.key || o || mo()
    });
  }
  n(at, "createLocation");
  function et(e) {
    let {
      pathname: r = "/",
      search: t = "",
      hash: o = ""
    } = e;
    return t && t !== "?" && (r += t.charAt(0) === "?" ? t : "?" + t), o && o !== "#" && (r += o.charAt(0) === "#" ? o : "#" + o), r;
  }
  n(et, "createPath");
  function Ye(e) {
    let r = {};
    if (e) {
      let t = e.indexOf("#");
      t >= 0 && (r.hash = e.substr(t), e = e.substr(0, t));
      let o = e.indexOf("?");
      o >= 0 && (r.search = e.substr(o), e = e.substr(0, o)), e && (r.pathname = e);
    }
    return r;
  }
  n(Ye, "parsePath");
  function Kn(e, r, t, o) {
    o === void 0 && (o = {});
    let {
      window: a = document.defaultView,
      v5Compat: i = !1
    } = o, l = a.history, b = Te.Pop, g = null, R = w();
    R == null && (R = 0, l.replaceState(me({}, l.state, {
      idx: R
    }), ""));
    function w() {
      return (l.state || {
        idx: null
      }).idx;
    }
    n(w, "getIndex");
    function x() {
      b = Te.Pop;
      let A = w(), Q = A == null ? null : A - R;
      R = A, g && g({
        action: b,
        location: L.location,
        delta: Q
      });
    }
    n(x, "handlePop");
    function M(A, Q) {
      b = Te.Push;
      let Z = at(L.location, A, Q);
      t && t(Z, A), R = w() + 1;
      let V = _n(Z, R), m = L.createHref(Z);
      try {
        l.pushState(V, "", m);
      } catch (ee) {
        if (ee instanceof DOMException && ee.name === "DataCloneError")
          throw ee;
        a.location.assign(m);
      }
      i && g && g({
        action: b,
        location: L.location,
        delta: 1
      });
    }
    n(M, "push");
    function _(A, Q) {
      b = Te.Replace;
      let Z = at(L.location, A, Q);
      t && t(Z, A), R = w();
      let V = _n(Z, R), m = L.createHref(Z);
      l.replaceState(V, "", m), i && g && g({
        action: b,
        location: L.location,
        delta: 0
      });
    }
    n(_, "replace");
    function N(A) {
      let Q = a.location.origin !== "null" ? a.location.origin : a.location.href, Z = typeof A == "string" ? A : et(A);
      return be(Q, "No window.location.(origin|href) available to create URL for href: " + Z), new URL(Z, Q);
    }
    n(N, "createURL");
    let L = {
      get action() {
        return b;
      },
      get location() {
        return e(a, l);
      },
      listen(A) {
        if (g)
          throw new Error("A history only accepts one active listener");
        return a.addEventListener(Nn, x), g = A, () => {
          a.removeEventListener(Nn, x), g = null;
        };
      },
      createHref(A) {
        return r(a, A);
      },
      createURL: N,
      encodeLocation(A) {
        let Q = N(A);
        return {
          pathname: Q.pathname,
          search: Q.search,
          hash: Q.hash
        };
      },
      push: M,
      replace: _,
      go(A) {
        return l.go(A);
      }
    };
    return L;
  }
  n(Kn, "getUrlBasedHistory");
  var _e = /* @__PURE__ */ function(e) {
    return e.data = "data", e.deferred = "deferred", e.redirect = "redirect", e.error = "error", e;
  }({}), po = /* @__PURE__ */ new Set(["lazy", "caseSensitive", "path", "id", "index", "children"]);
  function go(e) {
    return e.index === !0;
  }
  n(go, "isIndexRoute");
  function _t(e, r, t, o) {
    return t === void 0 && (t = []), o === void 0 && (o = {}), e.map((a, i) => {
      let l = [...t, i], b = typeof a.id == "string" ? a.id : l.join("-");
      if (be(a.index !== !0 || !a.children, "Cannot specify children on an index route"), be(!o[b], 'Found a route id collision on id "' + b +
      `".  Route id's must be globally unique within Data Router usages`), go(a)) {
        let g = me({}, a, r(a), {
          id: b
        });
        return o[b] = g, g;
      } else {
        let g = me({}, a, r(a), {
          id: b,
          children: void 0
        });
        return o[b] = g, a.children && (g.children = _t(a.children, r, l, o)), g;
      }
    });
  }
  n(_t, "convertRoutesToDataRoutes");
  function ut(e, r, t) {
    t === void 0 && (t = "/");
    let o = typeof r == "string" ? Ye(r) : r, a = Mt(o.pathname || "/", t);
    if (a == null)
      return null;
    let i = qn(e);
    yo(i);
    let l = null;
    for (let b = 0; l == null && b < i.length; ++b)
      l = Oo(
        i[b],
        // Incoming pathnames are generally encoded from either window.location
        // or from router.navigate, but we want to match against the unencoded
        // paths in the route definitions.  Memory router locations won't be
        // encoded here but there also shouldn't be anything to decode so this
        // should be a safe operation.  This avoids needing matchRoutes to be
        // history-aware.
        jo(a)
      );
    return l;
  }
  n(ut, "matchRoutes");
  function qn(e, r, t, o) {
    r === void 0 && (r = []), t === void 0 && (t = []), o === void 0 && (o = "");
    let a = /* @__PURE__ */ n((i, l, b) => {
      let g = {
        relativePath: b === void 0 ? i.path || "" : b,
        caseSensitive: i.caseSensitive === !0,
        childrenIndex: l,
        route: i
      };
      g.relativePath.startsWith("/") && (be(g.relativePath.startsWith(o), 'Absolute route path "' + g.relativePath + '" nested under path ' +
      ('"' + o + '" is not valid. An absolute child route path ') + "must start with the combined path of all its parent routes."), g.relativePath =
      g.relativePath.slice(o.length));
      let R = Et([o, g.relativePath]), w = t.concat(g);
      i.children && i.children.length > 0 && (be(
        // Our types know better, but runtime JS may not!
        // @ts-expect-error
        i.index !== !0,
        "Index routes must not have child routes. Please remove " + ('all child routes from route path "' + R + '".')
      ), qn(i.children, r, w, R)), !(i.path == null && !i.index) && r.push({
        path: R,
        score: xo(R, i.index),
        routesMeta: w
      });
    }, "flattenRoute");
    return e.forEach((i, l) => {
      var b;
      if (i.path === "" || !((b = i.path) != null && b.includes("?")))
        a(i, l);
      else
        for (let g of $n(i.path))
          a(i, l, g);
    }), r;
  }
  n(qn, "flattenRoutes");
  function $n(e) {
    let r = e.split("/");
    if (r.length === 0) return [];
    let [t, ...o] = r, a = t.endsWith("?"), i = t.replace(/\?$/, "");
    if (o.length === 0)
      return a ? [i, ""] : [i];
    let l = $n(o.join("/")), b = [];
    return b.push(...l.map((g) => g === "" ? i : [i, g].join("/"))), a && b.push(...l), b.map((g) => e.startsWith("/") && g === "" ? "/" : g);
  }
  n($n, "explodeOptionalSegments");
  function yo(e) {
    e.sort((r, t) => r.score !== t.score ? t.score - r.score : wo(r.routesMeta.map((o) => o.childrenIndex), t.routesMeta.map((o) => o.childrenIndex)));
  }
  n(yo, "rankRouteBranches");
  var bo = /^:\w+$/, vo = 3, Eo = 2, Ro = 1, So = 10, Po = -2, Fn = /* @__PURE__ */ n((e) => e === "*", "isSplat");
  function xo(e, r) {
    let t = e.split("/"), o = t.length;
    return t.some(Fn) && (o += Po), r && (o += Eo), t.filter((a) => !Fn(a)).reduce((a, i) => a + (bo.test(i) ? vo : i === "" ? Ro : So), o);
  }
  n(xo, "computeScore");
  function wo(e, r) {
    return e.length === r.length && e.slice(0, -1).every((o, a) => o === r[a]) ? (
      // If two routes are siblings, we should try to match the earlier sibling
      // first. This allows people to have fine-grained control over the matching
      // behavior by simply putting routes with identical paths in the order they
      // want them tried.
      e[e.length - 1] - r[r.length - 1]
    ) : (
      // Otherwise, it doesn't really make sense to rank non-siblings by index,
      // so they sort equally.
      0
    );
  }
  n(wo, "compareIndexes");
  function Oo(e, r) {
    let {
      routesMeta: t
    } = e, o = {}, a = "/", i = [];
    for (let l = 0; l < t.length; ++l) {
      let b = t[l], g = l === t.length - 1, R = a === "/" ? r : r.slice(a.length) || "/", w = Vn({
        path: b.relativePath,
        caseSensitive: b.caseSensitive,
        end: g
      }, R);
      if (!w) return null;
      Object.assign(o, w.params);
      let x = b.route;
      i.push({
        // TODO: Can this as be avoided?
        params: o,
        pathname: Et([a, w.pathname]),
        pathnameBase: Qn(Et([a, w.pathnameBase])),
        route: x
      }), w.pathnameBase !== "/" && (a = Et([a, w.pathnameBase]));
    }
    return i;
  }
  n(Oo, "matchRouteBranch");
  function Co(e, r) {
    r === void 0 && (r = {});
    let t = e;
    t.endsWith("*") && t !== "*" && !t.endsWith("/*") && (Ze(!1, 'Route path "' + t + '" will be treated as if it were ' + ('"' + t.replace(
    /\*$/, "/*") + '" because the `*` character must ') + "always follow a `/` in the pattern. To get rid of this warning, " + ('please chan\
ge the route path to "' + t.replace(/\*$/, "/*") + '".')), t = t.replace(/\*$/, "/*"));
    let o = t.startsWith("/") ? "/" : "", a = /* @__PURE__ */ n((l) => l == null ? "" : typeof l == "string" ? l : String(l), "stringify"), i = t.
    split(/\/+/).map((l, b, g) => {
      if (b === g.length - 1 && l === "*")
        return a(r["*"]);
      let w = l.match(/^:(\w+)(\??)$/);
      if (w) {
        let [, x, M] = w, _ = r[x];
        return be(M === "?" || _ != null, 'Missing ":' + x + '" param'), a(_);
      }
      return l.replace(/\?$/g, "");
    }).filter((l) => !!l);
    return o + i.join("/");
  }
  n(Co, "generatePath");
  function Vn(e, r) {
    typeof e == "string" && (e = {
      path: e,
      caseSensitive: !1,
      end: !0
    });
    let [t, o] = Ao(e.path, e.caseSensitive, e.end), a = r.match(t);
    if (!a) return null;
    let i = a[0], l = i.replace(/(.)\/+$/, "$1"), b = a.slice(1);
    return {
      params: o.reduce((R, w, x) => {
        if (w === "*") {
          let M = b[x] || "";
          l = i.slice(0, i.length - M.length).replace(/(.)\/+$/, "$1");
        }
        return R[w] = Do(b[x] || "", w), R;
      }, {}),
      pathname: i,
      pathnameBase: l,
      pattern: e
    };
  }
  n(Vn, "matchPath");
  function Ao(e, r, t) {
    r === void 0 && (r = !1), t === void 0 && (t = !0), Ze(e === "*" || !e.endsWith("*") || e.endsWith("/*"), 'Route path "' + e + '" will b\
e treated as if it were ' + ('"' + e.replace(/\*$/, "/*") + '" because the `*` character must ') + "always follow a `/` in the pattern. To g\
et rid of this warning, " + ('please change the route path to "' + e.replace(/\*$/, "/*") + '".'));
    let o = [], a = "^" + e.replace(/\/*\*?$/, "").replace(/^\/*/, "/").replace(/[\\.*+^$?{}|()[\]]/g, "\\$&").replace(/\/:(\w+)/g, (l, b) => (o.
    push(b), "/([^\\/]+)"));
    return e.endsWith("*") ? (o.push("*"), a += e === "*" || e === "/*" ? "(.*)$" : "(?:\\/(.+)|\\/*)$") : t ? a += "\\/*$" : e !== "" && e !==
    "/" && (a += "(?:(?=\\/|$))"), [new RegExp(a, r ? void 0 : "i"), o];
  }
  n(Ao, "compilePath");
  function jo(e) {
    try {
      return decodeURI(e);
    } catch (r) {
      return Ze(!1, 'The URL path "' + e + '" could not be decoded because it is is a malformed URL segment. This is probably due to a bad p\
ercent ' + ("encoding (" + r + ").")), e;
    }
  }
  n(jo, "safelyDecodeURI");
  function Do(e, r) {
    try {
      return decodeURIComponent(e);
    } catch (t) {
      return Ze(!1, 'The value for the URL param "' + r + '" will not be decoded because' + (' the string "' + e + '" is a malformed URL seg\
ment. This is probably') + (" due to a bad percent encoding (" + t + ").")), e;
    }
  }
  n(Do, "safelyDecodeURIComponent");
  function Mt(e, r) {
    if (r === "/") return e;
    if (!e.toLowerCase().startsWith(r.toLowerCase()))
      return null;
    let t = r.endsWith("/") ? r.length - 1 : r.length, o = e.charAt(t);
    return o && o !== "/" ? null : e.slice(t) || "/";
  }
  n(Mt, "stripBasename");
  function Jn(e, r) {
    r === void 0 && (r = "/");
    let {
      pathname: t,
      search: o = "",
      hash: a = ""
    } = typeof e == "string" ? Ye(e) : e;
    return {
      pathname: t ? t.startsWith("/") ? t : No(t, r) : r,
      search: Fo(o),
      hash: Uo(a)
    };
  }
  n(Jn, "resolvePath");
  function No(e, r) {
    let t = r.replace(/\/+$/, "").split("/");
    return e.split("/").forEach((a) => {
      a === ".." ? t.length > 1 && t.pop() : a !== "." && t.push(a);
    }), t.length > 1 ? t.join("/") : "/";
  }
  n(No, "resolvePathname");
  function gr(e, r, t, o) {
    return "Cannot include a '" + e + "' character in a manually specified " + ("`to." + r + "` field [" + JSON.stringify(o) + "].  Please s\
eparate it out to the ") + ("`to." + t + "` field. Alternatively you may provide the full path as ") + 'a string in <Link to="..."> and the \
router will parse it for you.';
  }
  n(gr, "getInvalidPathError");
  function Er(e) {
    return e.filter((r, t) => t === 0 || r.route.path && r.route.path.length > 0);
  }
  n(Er, "getPathContributingMatches");
  function Yn(e, r, t, o) {
    o === void 0 && (o = !1);
    let a;
    typeof e == "string" ? a = Ye(e) : (a = me({}, e), be(!a.pathname || !a.pathname.includes("?"), gr("?", "pathname", "search", a)), be(!a.
    pathname || !a.pathname.includes("#"), gr("#", "pathname", "hash", a)), be(!a.search || !a.search.includes("#"), gr("#", "search", "hash",
    a)));
    let i = e === "" || a.pathname === "", l = i ? "/" : a.pathname, b;
    if (o || l == null)
      b = t;
    else {
      let x = r.length - 1;
      if (l.startsWith("..")) {
        let M = l.split("/");
        for (; M[0] === ".."; )
          M.shift(), x -= 1;
        a.pathname = M.join("/");
      }
      b = x >= 0 ? r[x] : "/";
    }
    let g = Jn(a, b), R = l && l !== "/" && l.endsWith("/"), w = (i || l === ".") && t.endsWith("/");
    return !g.pathname.endsWith("/") && (R || w) && (g.pathname += "/"), g;
  }
  n(Yn, "resolveTo");
  function _o(e) {
    return e === "" || e.pathname === "" ? "/" : typeof e == "string" ? Ye(e).pathname : e.pathname;
  }
  n(_o, "getToPathname");
  var Et = /* @__PURE__ */ n((e) => e.join("/").replace(/\/\/+/g, "/"), "joinPaths"), Qn = /* @__PURE__ */ n((e) => e.replace(/\/+$/, "").replace(
  /^\/*/, "/"), "normalizePathname"), Fo = /* @__PURE__ */ n((e) => !e || e === "?" ? "" : e.startsWith("?") ? e : "?" + e, "normalizeSearch"),
  Uo = /* @__PURE__ */ n((e) => !e || e === "#" ? "" : e.startsWith("#") ? e : "#" + e, "normalizeHash"), Lo = /* @__PURE__ */ n(function(r, t) {
    t === void 0 && (t = {});
    let o = typeof t == "number" ? {
      status: t
    } : t, a = new Headers(o.headers);
    return a.has("Content-Type") || a.set("Content-Type", "application/json; charset=utf-8"), new Response(JSON.stringify(r), me({}, o, {
      headers: a
    }));
  }, "json"), Ft = class extends Error {
    static {
      n(this, "AbortedDeferredError");
    }
  }, Vt = class {
    static {
      n(this, "DeferredData");
    }
    constructor(r, t) {
      this.pendingKeysSet = /* @__PURE__ */ new Set(), this.subscribers = /* @__PURE__ */ new Set(), this.deferredKeys = [], be(r && typeof r ==
      "object" && !Array.isArray(r), "defer() only accepts plain objects");
      let o;
      this.abortPromise = new Promise((i, l) => o = l), this.controller = new AbortController();
      let a = /* @__PURE__ */ n(() => o(new Ft("Deferred data aborted")), "onAbort");
      this.unlistenAbortSignal = () => this.controller.signal.removeEventListener("abort", a), this.controller.signal.addEventListener("abor\
t", a), this.data = Object.entries(r).reduce((i, l) => {
        let [b, g] = l;
        return Object.assign(i, {
          [b]: this.trackPromise(b, g)
        });
      }, {}), this.done && this.unlistenAbortSignal(), this.init = t;
    }
    trackPromise(r, t) {
      if (!(t instanceof Promise))
        return t;
      this.deferredKeys.push(r), this.pendingKeysSet.add(r);
      let o = Promise.race([t, this.abortPromise]).then((a) => this.onSettle(o, r, void 0, a), (a) => this.onSettle(o, r, a));
      return o.catch(() => {
      }), Object.defineProperty(o, "_tracked", {
        get: /* @__PURE__ */ n(() => !0, "get")
      }), o;
    }
    onSettle(r, t, o, a) {
      if (this.controller.signal.aborted && o instanceof Ft)
        return this.unlistenAbortSignal(), Object.defineProperty(r, "_error", {
          get: /* @__PURE__ */ n(() => o, "get")
        }), Promise.reject(o);
      if (this.pendingKeysSet.delete(t), this.done && this.unlistenAbortSignal(), o === void 0 && a === void 0) {
        let i = new Error('Deferred data for key "' + t + '" resolved/rejected with `undefined`, you must resolve/reject with a value or `nu\
ll`.');
        return Object.defineProperty(r, "_error", {
          get: /* @__PURE__ */ n(() => i, "get")
        }), this.emit(!1, t), Promise.reject(i);
      }
      return a === void 0 ? (Object.defineProperty(r, "_error", {
        get: /* @__PURE__ */ n(() => o, "get")
      }), this.emit(!1, t), Promise.reject(o)) : (Object.defineProperty(r, "_data", {
        get: /* @__PURE__ */ n(() => a, "get")
      }), this.emit(!1, t), a);
    }
    emit(r, t) {
      this.subscribers.forEach((o) => o(r, t));
    }
    subscribe(r) {
      return this.subscribers.add(r), () => this.subscribers.delete(r);
    }
    cancel() {
      this.controller.abort(), this.pendingKeysSet.forEach((r, t) => this.pendingKeysSet.delete(t)), this.emit(!0);
    }
    async resolveData(r) {
      let t = !1;
      if (!this.done) {
        let o = /* @__PURE__ */ n(() => this.cancel(), "onAbort");
        r.addEventListener("abort", o), t = await new Promise((a) => {
          this.subscribe((i) => {
            r.removeEventListener("abort", o), (i || this.done) && a(i);
          });
        });
      }
      return t;
    }
    get done() {
      return this.pendingKeysSet.size === 0;
    }
    get unwrappedData() {
      return be(this.data !== null && this.done, "Can only unwrap data on initialized and settled deferreds"), Object.entries(this.data).reduce(
      (r, t) => {
        let [o, a] = t;
        return Object.assign(r, {
          [o]: To(a)
        });
      }, {});
    }
    get pendingKeys() {
      return Array.from(this.pendingKeysSet);
    }
  };
  function Mo(e) {
    return e instanceof Promise && e._tracked === !0;
  }
  n(Mo, "isTrackedPromise");
  function To(e) {
    if (!Mo(e))
      return e;
    if (e._error)
      throw e._error;
    return e._data;
  }
  n(To, "unwrapTrackedPromise");
  var Io = /* @__PURE__ */ n(function(r, t) {
    t === void 0 && (t = {});
    let o = typeof t == "number" ? {
      status: t
    } : t;
    return new Vt(r, o);
  }, "defer"), Xn = /* @__PURE__ */ n(function(r, t) {
    t === void 0 && (t = 302);
    let o = t;
    typeof o == "number" ? o = {
      status: o
    } : typeof o.status > "u" && (o.status = 302);
    let a = new Headers(o.headers);
    return a.set("Location", r), new Response(null, me({}, o, {
      headers: a
    }));
  }, "redirect"), Bo = /* @__PURE__ */ n((e, r) => {
    let t = Xn(e, r);
    return t.headers.set("X-Remix-Reload-Document", "true"), t;
  }, "redirectDocument"), Ut = class {
    static {
      n(this, "ErrorResponse");
    }
    constructor(r, t, o, a) {
      a === void 0 && (a = !1), this.status = r, this.statusText = t || "", this.internal = a, o instanceof Error ? (this.data = o.toString(),
      this.error = o) : this.data = o;
    }
  };
  function Rr(e) {
    return e != null && typeof e.status == "number" && typeof e.statusText == "string" && typeof e.internal == "boolean" && "data" in e;
  }
  n(Rr, "isRouteErrorResponse");
  var Gn = ["post", "put", "patch", "delete"], ko = new Set(Gn), zo = ["get", ...Gn], Ho = new Set(zo), Wo = /* @__PURE__ */ new Set([301, 302,
  303, 307, 308]), Ko = /* @__PURE__ */ new Set([307, 308]), $t = {
    state: "idle",
    location: void 0,
    formMethod: void 0,
    formAction: void 0,
    formEncType: void 0,
    formData: void 0,
    json: void 0,
    text: void 0
  }, Zn = {
    state: "idle",
    data: void 0,
    formMethod: void 0,
    formAction: void 0,
    formEncType: void 0,
    formData: void 0,
    json: void 0,
    text: void 0
  }, bt = {
    state: "unblocked",
    proceed: void 0,
    reset: void 0,
    location: void 0
  }, ea = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i, ta = /* @__PURE__ */ n((e) => ({
    hasErrorBoundary: !!e.hasErrorBoundary
  }), "defaultMapRouteProperties");
  function qo(e) {
    let r = e.window ? e.window : typeof window < "u" ? window : void 0, t = typeof r < "u" && typeof r.document < "u" && typeof r.document.
    createElement < "u", o = !t;
    be(e.routes.length > 0, "You must provide a non-empty routes array to createRouter");
    let a;
    if (e.mapRouteProperties)
      a = e.mapRouteProperties;
    else if (e.detectErrorBoundary) {
      let d = e.detectErrorBoundary;
      a = /* @__PURE__ */ n((h) => ({
        hasErrorBoundary: d(h)
      }), "mapRouteProperties");
    } else
      a = ta;
    let i = {}, l = _t(e.routes, a, void 0, i), b, g = e.basename || "/", R = me({
      v7_normalizeFormMethod: !1,
      v7_prependBasename: !1
    }, e.future), w = null, x = /* @__PURE__ */ new Set(), M = null, _ = null, N = null, L = e.hydrationData != null, A = ut(l, e.history.location,
    g), Q = null;
    if (A == null) {
      let d = Ie(404, {
        pathname: e.history.location.pathname
      }), {
        matches: h,
        route: S
      } = Jt(l);
      A = h, Q = {
        [S.id]: d
      };
    }
    let Z = (
      // All initialMatches need to be loaded before we're ready.  If we have lazy
      // functions around still then we'll need to run them in initialize()
      !A.some((d) => d.route.lazy) && // And we have to either have no loaders or have been provided hydrationData
      (!A.some((d) => d.route.loader) || e.hydrationData != null)
    ), V, m = {
      historyAction: e.history.action,
      location: e.history.location,
      matches: A,
      initialized: Z,
      navigation: $t,
      // Don't restore on initial updateState() if we were SSR'd
      restoreScrollPosition: e.hydrationData != null ? !1 : null,
      preventScrollReset: !1,
      revalidation: "idle",
      loaderData: e.hydrationData && e.hydrationData.loaderData || {},
      actionData: e.hydrationData && e.hydrationData.actionData || null,
      errors: e.hydrationData && e.hydrationData.errors || Q,
      fetchers: /* @__PURE__ */ new Map(),
      blockers: /* @__PURE__ */ new Map()
    }, ee = Te.Pop, de = !1, ae, Se = !1, Pe = !1, xe = [], Ae = [], oe = /* @__PURE__ */ new Map(), Ue = 0, Ee = -1, we = /* @__PURE__ */ new Map(),
    ce = /* @__PURE__ */ new Set(), Fe = /* @__PURE__ */ new Map(), Ce = /* @__PURE__ */ new Map(), ve = /* @__PURE__ */ new Map(), Ke = !1;
    function qe() {
      return w = e.history.listen((d) => {
        let {
          action: h,
          location: S,
          delta: T
        } = d;
        if (Ke) {
          Ke = !1;
          return;
        }
        Ze(ve.size === 0 || T != null, "You are trying to use a blocker on a POP navigation to a location that was not created by @remix-run\
/router. This will fail silently in production. This can happen if you are navigating outside the router via `window.history.pushState`/`win\
dow.location.hash` instead of using router navigation APIs.  This can also happen if you are using createHashRouter and the user manually ch\
anges the URL.");
        let te = E({
          currentLocation: m.location,
          nextLocation: S,
          historyAction: h
        });
        if (te && T != null) {
          Ke = !0, e.history.go(T * -1), Qe(te, {
            state: "blocked",
            location: S,
            proceed() {
              Qe(te, {
                state: "proceeding",
                proceed: void 0,
                reset: void 0,
                location: S
              }), e.history.go(T);
            },
            reset() {
              let s = new Map(m.blockers);
              s.set(te, bt), pe({
                blockers: s
              });
            }
          });
          return;
        }
        return B(h, S);
      }), m.initialized || B(Te.Pop, m.location), V;
    }
    n(qe, "initialize");
    function Be() {
      w && w(), x.clear(), ae && ae.abort(), m.fetchers.forEach((d, h) => ie(h)), m.blockers.forEach((d, h) => ot(h));
    }
    n(Be, "dispose");
    function je(d) {
      return x.add(d), () => x.delete(d);
    }
    n(je, "subscribe");
    function pe(d) {
      m = me({}, m, d), x.forEach((h) => h(m));
    }
    n(pe, "updateState");
    function C(d, h) {
      var S, T;
      let te = m.actionData != null && m.navigation.formMethod != null && $e(m.navigation.formMethod) && m.navigation.state === "loading" &&
      ((S = d.state) == null ? void 0 : S._isRedirect) !== !0, s;
      h.actionData ? Object.keys(h.actionData).length > 0 ? s = h.actionData : s = null : te ? s = m.actionData : s = null;
      let f = h.loaderData ? kn(m.loaderData, h.loaderData, h.matches || [], h.errors) : m.loaderData, y = m.blockers;
      y.size > 0 && (y = new Map(y), y.forEach((F, q) => y.set(q, bt)));
      let v = de === !0 || m.navigation.formMethod != null && $e(m.navigation.formMethod) && ((T = d.state) == null ? void 0 : T._isRedirect) !==
      !0;
      b && (l = b, b = void 0), Se || ee === Te.Pop || (ee === Te.Push ? e.history.push(d, d.state) : ee === Te.Replace && e.history.replace(
      d, d.state)), pe(me({}, h, {
        // matches, errors, fetchers go through as-is
        actionData: s,
        loaderData: f,
        historyAction: ee,
        location: d,
        initialized: !0,
        navigation: $t,
        revalidation: "idle",
        restoreScrollPosition: Y(d, h.matches || m.matches),
        preventScrollReset: v,
        blockers: y
      })), ee = Te.Pop, de = !1, Se = !1, Pe = !1, xe = [], Ae = [];
    }
    n(C, "completeNavigation");
    async function D(d, h) {
      if (typeof d == "number") {
        e.history.go(d);
        return;
      }
      let S = yr(m.location, m.matches, g, R.v7_prependBasename, d, h?.fromRouteId, h?.relative), {
        path: T,
        submission: te,
        error: s
      } = Un(R.v7_normalizeFormMethod, !1, S, h), f = m.location, y = at(m.location, T, h && h.state);
      y = me({}, y, e.history.encodeLocation(y));
      let v = h && h.replace != null ? h.replace : void 0, F = Te.Push;
      v === !0 ? F = Te.Replace : v === !1 || te != null && $e(te.formMethod) && te.formAction === m.location.pathname + m.location.search &&
      (F = Te.Replace);
      let q = h && "preventScrollReset" in h ? h.preventScrollReset === !0 : void 0, W = E({
        currentLocation: f,
        nextLocation: y,
        historyAction: F
      });
      if (W) {
        Qe(W, {
          state: "blocked",
          location: y,
          proceed() {
            Qe(W, {
              state: "proceeding",
              proceed: void 0,
              reset: void 0,
              location: y
            }), D(d, h);
          },
          reset() {
            let G = new Map(m.blockers);
            G.set(W, bt), pe({
              blockers: G
            });
          }
        });
        return;
      }
      return await B(F, y, {
        submission: te,
        // Send through the formData serialization error if we have one so we can
        // render at the right error boundary after we match routes
        pendingError: s,
        preventScrollReset: q,
        replace: h && h.replace
      });
    }
    n(D, "navigate");
    function z() {
      if (J(), pe({
        revalidation: "loading"
      }), m.navigation.state !== "submitting") {
        if (m.navigation.state === "idle") {
          B(m.historyAction, m.location, {
            startUninterruptedRevalidation: !0
          });
          return;
        }
        B(ee || m.historyAction, m.navigation.location, {
          overrideNavigation: m.navigation
        });
      }
    }
    n(z, "revalidate");
    async function B(d, h, S) {
      ae && ae.abort(), ae = null, ee = d, Se = (S && S.startUninterruptedRevalidation) === !0, I(m.location, m.matches), de = (S && S.preventScrollReset) ===
      !0;
      let T = b || l, te = S && S.overrideNavigation, s = ut(T, h, g);
      if (!s) {
        let G = Ie(404, {
          pathname: h.pathname
        }), {
          matches: X,
          route: ue
        } = Jt(T);
        j(), C(h, {
          matches: X,
          loaderData: {},
          errors: {
            [ue.id]: G
          }
        });
        return;
      }
      if (m.initialized && !Pe && Qo(m.location, h) && !(S && S.submission && $e(S.submission.formMethod))) {
        C(h, {
          matches: s
        });
        return;
      }
      ae = new AbortController();
      let f = Dt(e.history, h, ae.signal, S && S.submission), y, v;
      if (S && S.pendingError)
        v = {
          [pt(s).route.id]: S.pendingError
        };
      else if (S && S.submission && $e(S.submission.formMethod)) {
        let G = await u(f, h, S.submission, s, {
          replace: S.replace
        });
        if (G.shortCircuited)
          return;
        y = G.pendingActionData, v = G.pendingActionError, te = qt(h, S.submission), f = new Request(f.url, {
          signal: f.signal
        });
      }
      let {
        shortCircuited: F,
        loaderData: q,
        errors: W
      } = await c(f, h, s, te, S && S.submission, S && S.fetcherSubmission, S && S.replace, y, v);
      F || (ae = null, C(h, me({
        matches: s
      }, y ? {
        actionData: y
      } : {}, {
        loaderData: q,
        errors: W
      })));
    }
    n(B, "startNavigation");
    async function u(d, h, S, T, te) {
      te === void 0 && (te = {}), J();
      let s = ei(h, S);
      pe({
        navigation: s
      });
      let f, y = Lt(T, h);
      if (!y.route.action && !y.route.lazy)
        f = {
          type: _e.error,
          error: Ie(405, {
            method: d.method,
            pathname: h.pathname,
            routeId: y.route.id
          })
        };
      else if (f = await mt("action", d, y, T, i, a, g), d.signal.aborted)
        return {
          shortCircuited: !0
        };
      if (yt(f)) {
        let v;
        return te && te.replace != null ? v = te.replace : v = f.location === m.location.pathname + m.location.search, await k(m, f, {
          submission: S,
          replace: v
        }), {
          shortCircuited: !0
        };
      }
      if (gt(f)) {
        let v = pt(T, y.route.id);
        return (te && te.replace) !== !0 && (ee = Te.Push), {
          // Send back an empty object we can use to clear out any prior actionData
          pendingActionData: {},
          pendingActionError: {
            [v.route.id]: f.error
          }
        };
      }
      if (st(f))
        throw Ie(400, {
          type: "defer-action"
        });
      return {
        pendingActionData: {
          [y.route.id]: f.data
        }
      };
    }
    n(u, "handleAction");
    async function c(d, h, S, T, te, s, f, y, v) {
      let F = T || qt(h, te), q = te || s || Wn(F), W = b || l, [G, X] = Ln(e.history, m, S, q, h, Pe, xe, Ae, Fe, ce, W, g, y, v);
      if (j((Re) => !(S && S.some((Ve) => Ve.route.id === Re)) || G && G.some((Ve) => Ve.route.id === Re)), Ee = ++Ue, G.length === 0 && X.length ===
      0) {
        let Re = ge();
        return C(h, me({
          matches: S,
          loaderData: {},
          // Commit pending error if we're short circuiting
          errors: v || null
        }, y ? {
          actionData: y
        } : {}, Re ? {
          fetchers: new Map(m.fetchers)
        } : {})), {
          shortCircuited: !0
        };
      }
      if (!Se) {
        X.forEach((Ve) => {
          let it = m.fetchers.get(Ve.key), er = Nt(void 0, it ? it.data : void 0);
          m.fetchers.set(Ve.key, er);
        });
        let Re = y || m.actionData;
        pe(me({
          navigation: F
        }, Re ? Object.keys(Re).length === 0 ? {
          actionData: null
        } : {
          actionData: Re
        } : {}, X.length > 0 ? {
          fetchers: new Map(m.fetchers)
        } : {}));
      }
      X.forEach((Re) => {
        oe.has(Re.key) && le(Re.key), Re.controller && oe.set(Re.key, Re.controller);
      });
      let ue = /* @__PURE__ */ n(() => X.forEach((Re) => le(Re.key)), "abortPendingFetchRevalidations");
      ae && ae.signal.addEventListener("abort", ue);
      let {
        results: ye,
        loaderResults: he,
        fetcherResults: ke
      } = await $(m.matches, S, G, X, d);
      if (d.signal.aborted)
        return {
          shortCircuited: !0
        };
      ae && ae.signal.removeEventListener("abort", ue), X.forEach((Re) => oe.delete(Re.key));
      let Ne = zn(ye);
      if (Ne) {
        if (Ne.idx >= G.length) {
          let Re = X[Ne.idx - G.length].key;
          ce.add(Re);
        }
        return await k(m, Ne.result, {
          replace: f
        }), {
          shortCircuited: !0
        };
      }
      let {
        loaderData: Le,
        errors: We
      } = Bn(m, S, G, he, v, X, ke, Ce);
      Ce.forEach((Re, Ve) => {
        Re.subscribe((it) => {
          (it || Re.done) && Ce.delete(Ve);
        });
      });
      let ft = ge(), Me = Oe(Ee), Zt = ft || Me || X.length > 0;
      return me({
        loaderData: Le,
        errors: We
      }, Zt ? {
        fetchers: new Map(m.fetchers)
      } : {});
    }
    n(c, "handleLoaders");
    function p(d) {
      return m.fetchers.get(d) || Zn;
    }
    n(p, "getFetcher");
    function P(d, h, S, T) {
      if (o)
        throw new Error("router.fetch() was called during the server render, but it shouldn't be. You are likely calling a useFetcher() meth\
od in the body of your component. Try moving it to a useEffect or a callback.");
      oe.has(d) && le(d);
      let te = b || l, s = yr(m.location, m.matches, g, R.v7_prependBasename, S, h, T?.relative), f = ut(te, s, g);
      if (!f) {
        re(d, h, Ie(404, {
          pathname: s
        }));
        return;
      }
      let {
        path: y,
        submission: v,
        error: F
      } = Un(R.v7_normalizeFormMethod, !0, s, T);
      if (F) {
        re(d, h, F);
        return;
      }
      let q = Lt(f, y);
      if (de = (T && T.preventScrollReset) === !0, v && $e(v.formMethod)) {
        O(d, h, y, q, f, v);
        return;
      }
      Fe.set(d, {
        routeId: h,
        path: y
      }), U(d, h, y, q, f, v);
    }
    n(P, "fetch");
    async function O(d, h, S, T, te, s) {
      if (J(), Fe.delete(d), !T.route.action && !T.route.lazy) {
        let ze = Ie(405, {
          method: s.formMethod,
          pathname: S,
          routeId: h
        });
        re(d, h, ze);
        return;
      }
      let f = m.fetchers.get(d), y = ti(s, f);
      m.fetchers.set(d, y), pe({
        fetchers: new Map(m.fetchers)
      });
      let v = new AbortController(), F = Dt(e.history, S, v.signal, s);
      oe.set(d, v);
      let q = Ue, W = await mt("action", F, T, te, i, a, g);
      if (F.signal.aborted) {
        oe.get(d) === v && oe.delete(d);
        return;
      }
      if (yt(W))
        if (oe.delete(d), Ee > q) {
          let ze = vt(void 0);
          m.fetchers.set(d, ze), pe({
            fetchers: new Map(m.fetchers)
          });
          return;
        } else {
          ce.add(d);
          let ze = Nt(s);
          return m.fetchers.set(d, ze), pe({
            fetchers: new Map(m.fetchers)
          }), k(m, W, {
            submission: s,
            isFetchActionRedirect: !0
          });
        }
      if (gt(W)) {
        re(d, h, W.error);
        return;
      }
      if (st(W))
        throw Ie(400, {
          type: "defer-action"
        });
      let G = m.navigation.location || m.location, X = Dt(e.history, G, v.signal), ue = b || l, ye = m.navigation.state !== "idle" ? ut(ue, m.
      navigation.location, g) : m.matches;
      be(ye, "Didn't find any matches after fetcher action");
      let he = ++Ue;
      we.set(d, he);
      let ke = Nt(s, W.data);
      m.fetchers.set(d, ke);
      let [Ne, Le] = Ln(
        e.history,
        m,
        ye,
        s,
        G,
        Pe,
        xe,
        Ae,
        Fe,
        ce,
        ue,
        g,
        {
          [T.route.id]: W.data
        },
        void 0
        // No need to send through errors since we short circuit above
      );
      Le.filter((ze) => ze.key !== d).forEach((ze) => {
        let St = ze.key, jr = m.fetchers.get(St), Ra = Nt(void 0, jr ? jr.data : void 0);
        m.fetchers.set(St, Ra), oe.has(St) && le(St), ze.controller && oe.set(St, ze.controller);
      }), pe({
        fetchers: new Map(m.fetchers)
      });
      let We = /* @__PURE__ */ n(() => Le.forEach((ze) => le(ze.key)), "abortPendingFetchRevalidations");
      v.signal.addEventListener("abort", We);
      let {
        results: ft,
        loaderResults: Me,
        fetcherResults: Zt
      } = await $(m.matches, ye, Ne, Le, X);
      if (v.signal.aborted)
        return;
      v.signal.removeEventListener("abort", We), we.delete(d), oe.delete(d), Le.forEach((ze) => oe.delete(ze.key));
      let Re = zn(ft);
      if (Re) {
        if (Re.idx >= Ne.length) {
          let ze = Le[Re.idx - Ne.length].key;
          ce.add(ze);
        }
        return k(m, Re.result);
      }
      let {
        loaderData: Ve,
        errors: it
      } = Bn(m, m.matches, Ne, Me, void 0, Le, Zt, Ce);
      if (m.fetchers.has(d)) {
        let ze = vt(W.data);
        m.fetchers.set(d, ze);
      }
      let er = Oe(he);
      m.navigation.state === "loading" && he > Ee ? (be(ee, "Expected pending action"), ae && ae.abort(), C(m.navigation.location, {
        matches: ye,
        loaderData: Ve,
        errors: it,
        fetchers: new Map(m.fetchers)
      })) : (pe(me({
        errors: it,
        loaderData: kn(m.loaderData, Ve, ye, it)
      }, er || Le.length > 0 ? {
        fetchers: new Map(m.fetchers)
      } : {})), Pe = !1);
    }
    n(O, "handleFetcherAction");
    async function U(d, h, S, T, te, s) {
      let f = m.fetchers.get(d), y = Nt(s, f ? f.data : void 0);
      m.fetchers.set(d, y), pe({
        fetchers: new Map(m.fetchers)
      });
      let v = new AbortController(), F = Dt(e.history, S, v.signal);
      oe.set(d, v);
      let q = Ue, W = await mt("loader", F, T, te, i, a, g);
      if (st(W) && (W = await ua(W, F.signal, !0) || W), oe.get(d) === v && oe.delete(d), F.signal.aborted)
        return;
      if (yt(W))
        if (Ee > q) {
          let X = vt(void 0);
          m.fetchers.set(d, X), pe({
            fetchers: new Map(m.fetchers)
          });
          return;
        } else {
          ce.add(d), await k(m, W);
          return;
        }
      if (gt(W)) {
        let X = pt(m.matches, h);
        m.fetchers.delete(d), pe({
          fetchers: new Map(m.fetchers),
          errors: {
            [X.route.id]: W.error
          }
        });
        return;
      }
      be(!st(W), "Unhandled fetcher deferred data");
      let G = vt(W.data);
      m.fetchers.set(d, G), pe({
        fetchers: new Map(m.fetchers)
      });
    }
    n(U, "handleFetcherLoader");
    async function k(d, h, S) {
      let {
        submission: T,
        replace: te,
        isFetchActionRedirect: s
      } = S === void 0 ? {} : S;
      h.revalidate && (Pe = !0);
      let f = at(
        d.location,
        h.location,
        // TODO: This can be removed once we get rid of useTransition in Remix v2
        me({
          _isRedirect: !0
        }, s ? {
          _isFetchActionRedirect: !0
        } : {})
      );
      if (be(f, "Expected a location on the redirect navigation"), t) {
        let F = !1;
        if (h.reloadDocument)
          F = !0;
        else if (ea.test(h.location)) {
          let q = e.history.createURL(h.location);
          F = // Hard reload if it's an absolute URL to a new origin
          q.origin !== r.location.origin || // Hard reload if it's an absolute URL that does not match our basename
          Mt(q.pathname, g) == null;
        }
        if (F) {
          te ? r.location.replace(h.location) : r.location.assign(h.location);
          return;
        }
      }
      ae = null;
      let y = te === !0 ? Te.Replace : Te.Push, v = T || Wn(d.navigation);
      if (Ko.has(h.status) && v && $e(v.formMethod))
        await B(y, f, {
          submission: me({}, v, {
            formAction: h.location
          }),
          // Preserve this flag across redirects
          preventScrollReset: de
        });
      else if (s)
        await B(y, f, {
          overrideNavigation: qt(f),
          fetcherSubmission: v,
          // Preserve this flag across redirects
          preventScrollReset: de
        });
      else {
        let F = qt(f, v);
        await B(y, f, {
          overrideNavigation: F,
          // Preserve this flag across redirects
          preventScrollReset: de
        });
      }
    }
    n(k, "startRedirectNavigation");
    async function $(d, h, S, T, te) {
      let s = await Promise.all([...S.map((v) => mt("loader", te, v, h, i, a, g)), ...T.map((v) => v.matches && v.match && v.controller ? mt(
      "loader", Dt(e.history, v.path, v.controller.signal), v.match, v.matches, i, a, g) : {
        type: _e.error,
        error: Ie(404, {
          pathname: v.path
        })
      })]), f = s.slice(0, S.length), y = s.slice(S.length);
      return await Promise.all([Hn(d, S, f, f.map(() => te.signal), !1, m.loaderData), Hn(d, T.map((v) => v.match), y, T.map((v) => v.controller ?
      v.controller.signal : null), !0)]), {
        results: s,
        loaderResults: f,
        fetcherResults: y
      };
    }
    n($, "callLoadersAndMaybeResolveData");
    function J() {
      Pe = !0, xe.push(...j()), Fe.forEach((d, h) => {
        oe.has(h) && (Ae.push(h), le(h));
      });
    }
    n(J, "interruptActiveLoads");
    function re(d, h, S) {
      let T = pt(m.matches, h);
      ie(d), pe({
        errors: {
          [T.route.id]: S
        },
        fetchers: new Map(m.fetchers)
      });
    }
    n(re, "setFetcherError");
    function ie(d) {
      let h = m.fetchers.get(d);
      oe.has(d) && !(h && h.state === "loading" && we.has(d)) && le(d), Fe.delete(d), we.delete(d), ce.delete(d), m.fetchers.delete(d);
    }
    n(ie, "deleteFetcher");
    function le(d) {
      let h = oe.get(d);
      be(h, "Expected fetch controller: " + d), h.abort(), oe.delete(d);
    }
    n(le, "abortFetcher");
    function se(d) {
      for (let h of d) {
        let S = p(h), T = vt(S.data);
        m.fetchers.set(h, T);
      }
    }
    n(se, "markFetchersDone");
    function ge() {
      let d = [], h = !1;
      for (let S of ce) {
        let T = m.fetchers.get(S);
        be(T, "Expected fetcher: " + S), T.state === "loading" && (ce.delete(S), d.push(S), h = !0);
      }
      return se(d), h;
    }
    n(ge, "markFetchRedirectsDone");
    function Oe(d) {
      let h = [];
      for (let [S, T] of we)
        if (T < d) {
          let te = m.fetchers.get(S);
          be(te, "Expected fetcher: " + S), te.state === "loading" && (le(S), we.delete(S), h.push(S));
        }
      return se(h), h.length > 0;
    }
    n(Oe, "abortStaleFetchLoads");
    function De(d, h) {
      let S = m.blockers.get(d) || bt;
      return ve.get(d) !== h && ve.set(d, h), S;
    }
    n(De, "getBlocker");
    function ot(d) {
      m.blockers.delete(d), ve.delete(d);
    }
    n(ot, "deleteBlocker");
    function Qe(d, h) {
      let S = m.blockers.get(d) || bt;
      be(S.state === "unblocked" && h.state === "blocked" || S.state === "blocked" && h.state === "blocked" || S.state === "blocked" && h.state ===
      "proceeding" || S.state === "blocked" && h.state === "unblocked" || S.state === "proceeding" && h.state === "unblocked", "Invalid bloc\
ker state transition: " + S.state + " -> " + h.state);
      let T = new Map(m.blockers);
      T.set(d, h), pe({
        blockers: T
      });
    }
    n(Qe, "updateBlocker");
    function E(d) {
      let {
        currentLocation: h,
        nextLocation: S,
        historyAction: T
      } = d;
      if (ve.size === 0)
        return;
      ve.size > 1 && Ze(!1, "A router only supports one blocker at a time");
      let te = Array.from(ve.entries()), [s, f] = te[te.length - 1], y = m.blockers.get(s);
      if (!(y && y.state === "proceeding") && f({
        currentLocation: h,
        nextLocation: S,
        historyAction: T
      }))
        return s;
    }
    n(E, "shouldBlockNavigation");
    function j(d) {
      let h = [];
      return Ce.forEach((S, T) => {
        (!d || d(T)) && (S.cancel(), h.push(T), Ce.delete(T));
      }), h;
    }
    n(j, "cancelActiveDeferreds");
    function H(d, h, S) {
      if (M = d, N = h, _ = S || null, !L && m.navigation === $t) {
        L = !0;
        let T = Y(m.location, m.matches);
        T != null && pe({
          restoreScrollPosition: T
        });
      }
      return () => {
        M = null, N = null, _ = null;
      };
    }
    n(H, "enableScrollRestoration");
    function K(d, h) {
      return _ && _(d, h.map((T) => Zo(T, m.loaderData))) || d.key;
    }
    n(K, "getScrollKey");
    function I(d, h) {
      if (M && N) {
        let S = K(d, h);
        M[S] = N();
      }
    }
    n(I, "saveScrollPosition");
    function Y(d, h) {
      if (M) {
        let S = K(d, h), T = M[S];
        if (typeof T == "number")
          return T;
      }
      return null;
    }
    n(Y, "getSavedScrollPosition");
    function ne(d) {
      i = {}, b = _t(d, a, void 0, i);
    }
    return n(ne, "_internalSetRoutes"), V = {
      get basename() {
        return g;
      },
      get state() {
        return m;
      },
      get routes() {
        return l;
      },
      initialize: qe,
      subscribe: je,
      enableScrollRestoration: H,
      navigate: D,
      fetch: P,
      revalidate: z,
      // Passthrough to history-aware createHref used by useHref so we get proper
      // hash-aware URLs in DOM paths
      createHref: /* @__PURE__ */ n((d) => e.history.createHref(d), "createHref"),
      encodeLocation: /* @__PURE__ */ n((d) => e.history.encodeLocation(d), "encodeLocation"),
      getFetcher: p,
      deleteFetcher: ie,
      dispose: Be,
      getBlocker: De,
      deleteBlocker: ot,
      _internalFetchControllers: oe,
      _internalActiveDeferreds: Ce,
      // TODO: Remove setRoutes, it's temporary to avoid dealing with
      // updating the tree while validating the update algorithm.
      _internalSetRoutes: ne
    }, V;
  }
  n(qo, "createRouter");
  var ra = Symbol("deferred");
  function $o(e, r) {
    be(e.length > 0, "You must provide a non-empty routes array to createStaticHandler");
    let t = {}, o = (r ? r.basename : null) || "/", a;
    if (r != null && r.mapRouteProperties)
      a = r.mapRouteProperties;
    else if (r != null && r.detectErrorBoundary) {
      let x = r.detectErrorBoundary;
      a = /* @__PURE__ */ n((M) => ({
        hasErrorBoundary: x(M)
      }), "mapRouteProperties");
    } else
      a = ta;
    let i = _t(e, a, void 0, t);
    async function l(x, M) {
      let {
        requestContext: _
      } = M === void 0 ? {} : M, N = new URL(x.url), L = x.method, A = at("", et(N), null, "default"), Q = ut(i, A, o);
      if (!vr(L) && L !== "HEAD") {
        let V = Ie(405, {
          method: L
        }), {
          matches: m,
          route: ee
        } = Jt(i);
        return {
          basename: o,
          location: A,
          matches: m,
          loaderData: {},
          actionData: null,
          errors: {
            [ee.id]: V
          },
          statusCode: V.status,
          loaderHeaders: {},
          actionHeaders: {},
          activeDeferreds: null
        };
      } else if (!Q) {
        let V = Ie(404, {
          pathname: A.pathname
        }), {
          matches: m,
          route: ee
        } = Jt(i);
        return {
          basename: o,
          location: A,
          matches: m,
          loaderData: {},
          actionData: null,
          errors: {
            [ee.id]: V
          },
          statusCode: V.status,
          loaderHeaders: {},
          actionHeaders: {},
          activeDeferreds: null
        };
      }
      let Z = await g(x, A, Q, _);
      return Rt(Z) ? Z : me({
        location: A,
        basename: o
      }, Z);
    }
    n(l, "query");
    async function b(x, M) {
      let {
        routeId: _,
        requestContext: N
      } = M === void 0 ? {} : M, L = new URL(x.url), A = x.method, Q = at("", et(L), null, "default"), Z = ut(i, Q, o);
      if (!vr(A) && A !== "HEAD" && A !== "OPTIONS")
        throw Ie(405, {
          method: A
        });
      if (!Z)
        throw Ie(404, {
          pathname: Q.pathname
        });
      let V = _ ? Z.find((ae) => ae.route.id === _) : Lt(Z, Q);
      if (_ && !V)
        throw Ie(403, {
          pathname: Q.pathname,
          routeId: _
        });
      if (!V)
        throw Ie(404, {
          pathname: Q.pathname
        });
      let m = await g(x, Q, Z, N, V);
      if (Rt(m))
        return m;
      let ee = m.errors ? Object.values(m.errors)[0] : void 0;
      if (ee !== void 0)
        throw ee;
      if (m.actionData)
        return Object.values(m.actionData)[0];
      if (m.loaderData) {
        var de;
        let ae = Object.values(m.loaderData)[0];
        return (de = m.activeDeferreds) != null && de[V.route.id] && (ae[ra] = m.activeDeferreds[V.route.id]), ae;
      }
    }
    n(b, "queryRoute");
    async function g(x, M, _, N, L) {
      be(x.signal, "query()/queryRoute() requests must contain an AbortController signal");
      try {
        if ($e(x.method.toLowerCase()))
          return await R(x, _, L || Lt(_, M), N, L != null);
        let A = await w(x, _, N, L);
        return Rt(A) ? A : me({}, A, {
          actionData: null,
          actionHeaders: {}
        });
      } catch (A) {
        if (Go(A)) {
          if (A.type === _e.error)
            throw A.response;
          return A.response;
        }
        if (Xo(A))
          return A;
        throw A;
      }
    }
    n(g, "queryImpl");
    async function R(x, M, _, N, L) {
      let A;
      if (!_.route.action && !_.route.lazy) {
        let V = Ie(405, {
          method: x.method,
          pathname: new URL(x.url).pathname,
          routeId: _.route.id
        });
        if (L)
          throw V;
        A = {
          type: _e.error,
          error: V
        };
      } else if (A = await mt("action", x, _, M, t, a, o, {
        isStaticRequest: !0,
        isRouteRequest: L,
        requestContext: N
      }), x.signal.aborted) {
        let V = L ? "queryRoute" : "query";
        throw new Error(V + "() call aborted");
      }
      if (yt(A))
        throw new Response(null, {
          status: A.status,
          headers: {
            Location: A.location
          }
        });
      if (st(A)) {
        let V = Ie(400, {
          type: "defer-action"
        });
        if (L)
          throw V;
        A = {
          type: _e.error,
          error: V
        };
      }
      if (L) {
        if (gt(A))
          throw A.error;
        return {
          matches: [_],
          loaderData: {},
          actionData: {
            [_.route.id]: A.data
          },
          errors: null,
          // Note: statusCode + headers are unused here since queryRoute will
          // return the raw Response or value
          statusCode: 200,
          loaderHeaders: {},
          actionHeaders: {},
          activeDeferreds: null
        };
      }
      if (gt(A)) {
        let V = pt(M, _.route.id), m = await w(x, M, N, void 0, {
          [V.route.id]: A.error
        });
        return me({}, m, {
          statusCode: Rr(A.error) ? A.error.status : 500,
          actionData: null,
          actionHeaders: me({}, A.headers ? {
            [_.route.id]: A.headers
          } : {})
        });
      }
      let Q = new Request(x.url, {
        headers: x.headers,
        redirect: x.redirect,
        signal: x.signal
      }), Z = await w(Q, M, N);
      return me({}, Z, A.statusCode ? {
        statusCode: A.statusCode
      } : {}, {
        actionData: {
          [_.route.id]: A.data
        },
        actionHeaders: me({}, A.headers ? {
          [_.route.id]: A.headers
        } : {})
      });
    }
    n(R, "submit");
    async function w(x, M, _, N, L) {
      let A = N != null;
      if (A && !(N != null && N.route.loader) && !(N != null && N.route.lazy))
        throw Ie(400, {
          method: x.method,
          pathname: new URL(x.url).pathname,
          routeId: N?.route.id
        });
      let Z = (N ? [N] : na(M, Object.keys(L || {})[0])).filter((ae) => ae.route.loader || ae.route.lazy);
      if (Z.length === 0)
        return {
          matches: M,
          // Add a null for all matched routes for proper revalidation on the client
          loaderData: M.reduce((ae, Se) => Object.assign(ae, {
            [Se.route.id]: null
          }), {}),
          errors: L || null,
          statusCode: 200,
          loaderHeaders: {},
          activeDeferreds: null
        };
      let V = await Promise.all([...Z.map((ae) => mt("loader", x, ae, M, t, a, o, {
        isStaticRequest: !0,
        isRouteRequest: A,
        requestContext: _
      }))]);
      if (x.signal.aborted) {
        let ae = A ? "queryRoute" : "query";
        throw new Error(ae + "() call aborted");
      }
      let m = /* @__PURE__ */ new Map(), ee = oa(M, Z, V, L, m), de = new Set(Z.map((ae) => ae.route.id));
      return M.forEach((ae) => {
        de.has(ae.route.id) || (ee.loaderData[ae.route.id] = null);
      }), me({}, ee, {
        matches: M,
        activeDeferreds: m.size > 0 ? Object.fromEntries(m.entries()) : null
      });
    }
    return n(w, "loadRouteData"), {
      dataRoutes: i,
      query: l,
      queryRoute: b
    };
  }
  n($o, "createStaticHandler");
  function Vo(e, r, t) {
    return me({}, r, {
      statusCode: 500,
      errors: {
        [r._deepestRenderedBoundaryId || e[0].id]: t
      }
    });
  }
  n(Vo, "getStaticContextFromError");
  function Jo(e) {
    return e != null && ("formData" in e && e.formData != null || "body" in e && e.body !== void 0);
  }
  n(Jo, "isSubmissionNavigation");
  function yr(e, r, t, o, a, i, l) {
    let b, g;
    if (i != null && l !== "path") {
      b = [];
      for (let w of r)
        if (b.push(w), w.route.id === i) {
          g = w;
          break;
        }
    } else
      b = r, g = r[r.length - 1];
    let R = Yn(a || ".", Er(b).map((w) => w.pathnameBase), Mt(e.pathname, t) || e.pathname, l === "path");
    return a == null && (R.search = e.search, R.hash = e.hash), (a == null || a === "" || a === ".") && g && g.route.index && !Sr(R.search) &&
    (R.search = R.search ? R.search.replace(/^\?/, "?index&") : "?index"), o && t !== "/" && (R.pathname = R.pathname === "/" ? t : Et([t, R.
    pathname])), et(R);
  }
  n(yr, "normalizeTo");
  function Un(e, r, t, o) {
    if (!o || !Jo(o))
      return {
        path: t
      };
    if (o.formMethod && !vr(o.formMethod))
      return {
        path: t,
        error: Ie(405, {
          method: o.formMethod
        })
      };
    let a = /* @__PURE__ */ n(() => ({
      path: t,
      error: Ie(400, {
        type: "invalid-body"
      })
    }), "getInvalidBodyError"), i = o.formMethod || "get", l = e ? i.toUpperCase() : i.toLowerCase(), b = ia(t);
    if (o.body !== void 0) {
      if (o.formEncType === "text/plain") {
        if (!$e(l))
          return a();
        let M = typeof o.body == "string" ? o.body : o.body instanceof FormData || o.body instanceof URLSearchParams ? (
          // https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#plain-text-form-data
          Array.from(o.body.entries()).reduce((_, N) => {
            let [L, A] = N;
            return "" + _ + L + "=" + A + `
`;
          }, "")
        ) : String(o.body);
        return {
          path: t,
          submission: {
            formMethod: l,
            formAction: b,
            formEncType: o.formEncType,
            formData: void 0,
            json: void 0,
            text: M
          }
        };
      } else if (o.formEncType === "application/json") {
        if (!$e(l))
          return a();
        try {
          let M = typeof o.body == "string" ? JSON.parse(o.body) : o.body;
          return {
            path: t,
            submission: {
              formMethod: l,
              formAction: b,
              formEncType: o.formEncType,
              formData: void 0,
              json: M,
              text: void 0
            }
          };
        } catch {
          return a();
        }
      }
    }
    be(typeof FormData == "function", "FormData is not available in this environment");
    let g, R;
    if (o.formData)
      g = br(o.formData), R = o.formData;
    else if (o.body instanceof FormData)
      g = br(o.body), R = o.body;
    else if (o.body instanceof URLSearchParams)
      g = o.body, R = In(g);
    else if (o.body == null)
      g = new URLSearchParams(), R = new FormData();
    else
      try {
        g = new URLSearchParams(o.body), R = In(g);
      } catch {
        return a();
      }
    let w = {
      formMethod: l,
      formAction: b,
      formEncType: o && o.formEncType || "application/x-www-form-urlencoded",
      formData: R,
      json: void 0,
      text: void 0
    };
    if ($e(w.formMethod))
      return {
        path: t,
        submission: w
      };
    let x = Ye(t);
    return r && x.search && Sr(x.search) && g.append("index", ""), x.search = "?" + g, {
      path: et(x),
      submission: w
    };
  }
  n(Un, "normalizeNavigateOptions");
  function na(e, r) {
    let t = e;
    if (r) {
      let o = e.findIndex((a) => a.route.id === r);
      o >= 0 && (t = e.slice(0, o));
    }
    return t;
  }
  n(na, "getLoaderMatchesUntilBoundary");
  function Ln(e, r, t, o, a, i, l, b, g, R, w, x, M, _) {
    let N = _ ? Object.values(_)[0] : M ? Object.values(M)[0] : void 0, L = e.createURL(r.location), A = e.createURL(a), Q = _ ? Object.keys(
    _)[0] : void 0, V = na(t, Q).filter((ee, de) => {
      if (ee.route.lazy)
        return !0;
      if (ee.route.loader == null)
        return !1;
      if (Yo(r.loaderData, r.matches[de], ee) || l.some((Pe) => Pe === ee.route.id))
        return !0;
      let ae = r.matches[de], Se = ee;
      return Mn(ee, me({
        currentUrl: L,
        currentParams: ae.params,
        nextUrl: A,
        nextParams: Se.params
      }, o, {
        actionResult: N,
        defaultShouldRevalidate: (
          // Forced revalidation due to submission, useRevalidator, or X-Remix-Revalidate
          i || // Clicked the same link, resubmitted a GET form
          L.pathname + L.search === A.pathname + A.search || // Search params affect all loaders
          L.search !== A.search || aa(ae, Se)
        )
      }));
    }), m = [];
    return g.forEach((ee, de) => {
      if (!t.some((Ae) => Ae.route.id === ee.routeId))
        return;
      let ae = ut(w, ee.path, x);
      if (!ae) {
        m.push({
          key: de,
          routeId: ee.routeId,
          path: ee.path,
          matches: null,
          match: null,
          controller: null
        });
        return;
      }
      let Se = r.fetchers.get(de), Pe = Lt(ae, ee.path), xe = !1;
      R.has(de) ? xe = !1 : b.includes(de) ? xe = !0 : Se && Se.state !== "idle" && Se.data === void 0 ? xe = i : xe = Mn(Pe, me({
        currentUrl: L,
        currentParams: r.matches[r.matches.length - 1].params,
        nextUrl: A,
        nextParams: t[t.length - 1].params
      }, o, {
        actionResult: N,
        defaultShouldRevalidate: i
      })), xe && m.push({
        key: de,
        routeId: ee.routeId,
        path: ee.path,
        matches: ae,
        match: Pe,
        controller: new AbortController()
      });
    }), [V, m];
  }
  n(Ln, "getMatchesToLoad");
  function Yo(e, r, t) {
    let o = (
      // [a] -> [a, b]
      !r || // [a, b] -> [a, c]
      t.route.id !== r.route.id
    ), a = e[t.route.id] === void 0;
    return o || a;
  }
  n(Yo, "isNewLoader");
  function aa(e, r) {
    let t = e.route.path;
    return (
      // param change for this match, /users/123 -> /users/456
      e.pathname !== r.pathname || // splat param changed, which is not present in match.path
      // e.g. /files/images/avatar.jpg -> files/finances.xls
      t != null && t.endsWith("*") && e.params["*"] !== r.params["*"]
    );
  }
  n(aa, "isNewRouteInstance");
  function Mn(e, r) {
    if (e.route.shouldRevalidate) {
      let t = e.route.shouldRevalidate(r);
      if (typeof t == "boolean")
        return t;
    }
    return r.defaultShouldRevalidate;
  }
  n(Mn, "shouldRevalidateLoader");
  async function Tn(e, r, t) {
    if (!e.lazy)
      return;
    let o = await e.lazy();
    if (!e.lazy)
      return;
    let a = t[e.id];
    be(a, "No route found in manifest");
    let i = {};
    for (let l in o) {
      let g = a[l] !== void 0 && // This property isn't static since it should always be updated based
      // on the route updates
      l !== "hasErrorBoundary";
      Ze(!g, 'Route "' + a.id + '" has a static property "' + l + '" defined but its lazy function is also returning a value for this proper\
ty. ' + ('The lazy route property "' + l + '" will be ignored.')), !g && !po.has(l) && (i[l] = o[l]);
    }
    Object.assign(a, i), Object.assign(a, me({}, r(a), {
      lazy: void 0
    }));
  }
  n(Tn, "loadLazyRouteModule");
  async function mt(e, r, t, o, a, i, l, b) {
    b === void 0 && (b = {});
    let g, R, w, x = /* @__PURE__ */ n((N) => {
      let L, A = new Promise((Q, Z) => L = Z);
      return w = /* @__PURE__ */ n(() => L(), "onReject"), r.signal.addEventListener("abort", w), Promise.race([N({
        request: r,
        params: t.params,
        context: b.requestContext
      }), A]);
    }, "runHandler");
    try {
      let N = t.route[e];
      if (t.route.lazy)
        if (N)
          R = (await Promise.all([x(N), Tn(t.route, i, a)]))[0];
        else if (await Tn(t.route, i, a), N = t.route[e], N)
          R = await x(N);
        else if (e === "action") {
          let L = new URL(r.url), A = L.pathname + L.search;
          throw Ie(405, {
            method: r.method,
            pathname: A,
            routeId: t.route.id
          });
        } else
          return {
            type: _e.data,
            data: void 0
          };
      else if (N)
        R = await x(N);
      else {
        let L = new URL(r.url), A = L.pathname + L.search;
        throw Ie(404, {
          pathname: A
        });
      }
      be(R !== void 0, "You defined " + (e === "action" ? "an action" : "a loader") + " for route " + ('"' + t.route.id + "\" but didn't retu\
rn anything from your `" + e + "` ") + "function. Please return a value or `null`.");
    } catch (N) {
      g = _e.error, R = N;
    } finally {
      w && r.signal.removeEventListener("abort", w);
    }
    if (Rt(R)) {
      let N = R.status;
      if (Wo.has(N)) {
        let Q = R.headers.get("Location");
        if (be(Q, "Redirects returned/thrown from loaders/actions must have a Location header"), !ea.test(Q))
          Q = yr(new URL(r.url), o.slice(0, o.indexOf(t) + 1), l, !0, Q);
        else if (!b.isStaticRequest) {
          let Z = new URL(r.url), V = Q.startsWith("//") ? new URL(Z.protocol + Q) : new URL(Q), m = Mt(V.pathname, l) != null;
          V.origin === Z.origin && m && (Q = V.pathname + V.search + V.hash);
        }
        if (b.isStaticRequest)
          throw R.headers.set("Location", Q), R;
        return {
          type: _e.redirect,
          status: N,
          location: Q,
          revalidate: R.headers.get("X-Remix-Revalidate") !== null,
          reloadDocument: R.headers.get("X-Remix-Reload-Document") !== null
        };
      }
      if (b.isRouteRequest)
        throw {
          type: g === _e.error ? _e.error : _e.data,
          response: R
        };
      let L, A = R.headers.get("Content-Type");
      return A && /\bapplication\/json\b/.test(A) ? L = await R.json() : L = await R.text(), g === _e.error ? {
        type: g,
        error: new Ut(N, R.statusText, L),
        headers: R.headers
      } : {
        type: _e.data,
        data: L,
        statusCode: R.status,
        headers: R.headers
      };
    }
    if (g === _e.error)
      return {
        type: g,
        error: R
      };
    if (la(R)) {
      var M, _;
      return {
        type: _e.deferred,
        deferredData: R,
        statusCode: (M = R.init) == null ? void 0 : M.status,
        headers: ((_ = R.init) == null ? void 0 : _.headers) && new Headers(R.init.headers)
      };
    }
    return {
      type: _e.data,
      data: R
    };
  }
  n(mt, "callLoaderOrAction");
  function Dt(e, r, t, o) {
    let a = e.createURL(ia(r)).toString(), i = {
      signal: t
    };
    if (o && $e(o.formMethod)) {
      let {
        formMethod: l,
        formEncType: b
      } = o;
      i.method = l.toUpperCase(), b === "application/json" ? (i.headers = new Headers({
        "Content-Type": b
      }), i.body = JSON.stringify(o.json)) : b === "text/plain" ? i.body = o.text : b === "application/x-www-form-urlencoded" && o.formData ?
      i.body = br(o.formData) : i.body = o.formData;
    }
    return new Request(a, i);
  }
  n(Dt, "createClientSideRequest");
  function br(e) {
    let r = new URLSearchParams();
    for (let [t, o] of e.entries())
      r.append(t, typeof o == "string" ? o : o.name);
    return r;
  }
  n(br, "convertFormDataToSearchParams");
  function In(e) {
    let r = new FormData();
    for (let [t, o] of e.entries())
      r.append(t, o);
    return r;
  }
  n(In, "convertSearchParamsToFormData");
  function oa(e, r, t, o, a) {
    let i = {}, l = null, b, g = !1, R = {};
    return t.forEach((w, x) => {
      let M = r[x].route.id;
      if (be(!yt(w), "Cannot handle redirect results in processLoaderData"), gt(w)) {
        let _ = pt(e, M), N = w.error;
        o && (N = Object.values(o)[0], o = void 0), l = l || {}, l[_.route.id] == null && (l[_.route.id] = N), i[M] = void 0, g || (g = !0, b =
        Rr(w.error) ? w.error.status : 500), w.headers && (R[M] = w.headers);
      } else
        st(w) ? (a.set(M, w.deferredData), i[M] = w.deferredData.data) : i[M] = w.data, w.statusCode != null && w.statusCode !== 200 && !g &&
        (b = w.statusCode), w.headers && (R[M] = w.headers);
    }), o && (l = o, i[Object.keys(o)[0]] = void 0), {
      loaderData: i,
      errors: l,
      statusCode: b || 200,
      loaderHeaders: R
    };
  }
  n(oa, "processRouteLoaderData");
  function Bn(e, r, t, o, a, i, l, b) {
    let {
      loaderData: g,
      errors: R
    } = oa(r, t, o, a, b);
    for (let w = 0; w < i.length; w++) {
      let {
        key: x,
        match: M,
        controller: _
      } = i[w];
      be(l !== void 0 && l[w] !== void 0, "Did not find corresponding fetcher result");
      let N = l[w];
      if (!(_ && _.signal.aborted))
        if (gt(N)) {
          let L = pt(e.matches, M?.route.id);
          R && R[L.route.id] || (R = me({}, R, {
            [L.route.id]: N.error
          })), e.fetchers.delete(x);
        } else if (yt(N))
          be(!1, "Unhandled fetcher revalidation redirect");
        else if (st(N))
          be(!1, "Unhandled fetcher deferred data");
        else {
          let L = vt(N.data);
          e.fetchers.set(x, L);
        }
    }
    return {
      loaderData: g,
      errors: R
    };
  }
  n(Bn, "processLoaderData");
  function kn(e, r, t, o) {
    let a = me({}, r);
    for (let i of t) {
      let l = i.route.id;
      if (r.hasOwnProperty(l) ? r[l] !== void 0 && (a[l] = r[l]) : e[l] !== void 0 && i.route.loader && (a[l] = e[l]), o && o.hasOwnProperty(
      l))
        break;
    }
    return a;
  }
  n(kn, "mergeLoaderData");
  function pt(e, r) {
    return (r ? e.slice(0, e.findIndex((o) => o.route.id === r) + 1) : [...e]).reverse().find((o) => o.route.hasErrorBoundary === !0) || e[0];
  }
  n(pt, "findNearestBoundary");
  function Jt(e) {
    let r = e.find((t) => t.index || !t.path || t.path === "/") || {
      id: "__shim-error-route__"
    };
    return {
      matches: [{
        params: {},
        pathname: "",
        pathnameBase: "",
        route: r
      }],
      route: r
    };
  }
  n(Jt, "getShortCircuitMatches");
  function Ie(e, r) {
    let {
      pathname: t,
      routeId: o,
      method: a,
      type: i
    } = r === void 0 ? {} : r, l = "Unknown Server Error", b = "Unknown @remix-run/router error";
    return e === 400 ? (l = "Bad Request", a && t && o ? b = "You made a " + a + ' request to "' + t + '" but ' + ('did not provide a `loade\
r` for route "' + o + '", ') + "so there is no way to handle the request." : i === "defer-action" ? b = "defer() is not supported in actions" :
    i === "invalid-body" && (b = "Unable to encode submission body")) : e === 403 ? (l = "Forbidden", b = 'Route "' + o + '" does not match \
URL "' + t + '"') : e === 404 ? (l = "Not Found", b = 'No route matches URL "' + t + '"') : e === 405 && (l = "Method Not Allowed", a && t &&
    o ? b = "You made a " + a.toUpperCase() + ' request to "' + t + '" but ' + ('did not provide an `action` for route "' + o + '", ') + "so\
 there is no way to handle the request." : a && (b = 'Invalid request method "' + a.toUpperCase() + '"')), new Ut(e || 500, l, new Error(b),
    !0);
  }
  n(Ie, "getInternalRouterError");
  function zn(e) {
    for (let r = e.length - 1; r >= 0; r--) {
      let t = e[r];
      if (yt(t))
        return {
          result: t,
          idx: r
        };
    }
  }
  n(zn, "findRedirect");
  function ia(e) {
    let r = typeof e == "string" ? Ye(e) : e;
    return et(me({}, r, {
      hash: ""
    }));
  }
  n(ia, "stripHashFromPath");
  function Qo(e, r) {
    return e.pathname !== r.pathname || e.search !== r.search ? !1 : e.hash === "" ? r.hash !== "" : e.hash === r.hash ? !0 : r.hash !== "";
  }
  n(Qo, "isHashChangeOnly");
  function st(e) {
    return e.type === _e.deferred;
  }
  n(st, "isDeferredResult");
  function gt(e) {
    return e.type === _e.error;
  }
  n(gt, "isErrorResult");
  function yt(e) {
    return (e && e.type) === _e.redirect;
  }
  n(yt, "isRedirectResult");
  function la(e) {
    let r = e;
    return r && typeof r == "object" && typeof r.data == "object" && typeof r.subscribe == "function" && typeof r.cancel == "function" && typeof r.
    resolveData == "function";
  }
  n(la, "isDeferredData");
  function Rt(e) {
    return e != null && typeof e.status == "number" && typeof e.statusText == "string" && typeof e.headers == "object" && typeof e.body < "u";
  }
  n(Rt, "isResponse");
  function Xo(e) {
    if (!Rt(e))
      return !1;
    let r = e.status, t = e.headers.get("Location");
    return r >= 300 && r <= 399 && t != null;
  }
  n(Xo, "isRedirectResponse");
  function Go(e) {
    return e && Rt(e.response) && (e.type === _e.data || e.type === _e.error);
  }
  n(Go, "isQueryRouteResponse");
  function vr(e) {
    return Ho.has(e.toLowerCase());
  }
  n(vr, "isValidMethod");
  function $e(e) {
    return ko.has(e.toLowerCase());
  }
  n($e, "isMutationMethod");
  async function Hn(e, r, t, o, a, i) {
    for (let l = 0; l < t.length; l++) {
      let b = t[l], g = r[l];
      if (!g)
        continue;
      let R = e.find((x) => x.route.id === g.route.id), w = R != null && !aa(R, g) && (i && i[g.route.id]) !== void 0;
      if (st(b) && (a || w)) {
        let x = o[l];
        be(x, "Expected an AbortSignal for revalidating fetcher deferred result"), await ua(b, x, a).then((M) => {
          M && (t[l] = M || t[l]);
        });
      }
    }
  }
  n(Hn, "resolveDeferredResults");
  async function ua(e, r, t) {
    if (t === void 0 && (t = !1), !await e.deferredData.resolveData(r)) {
      if (t)
        try {
          return {
            type: _e.data,
            data: e.deferredData.unwrappedData
          };
        } catch (a) {
          return {
            type: _e.error,
            error: a
          };
        }
      return {
        type: _e.data,
        data: e.deferredData.data
      };
    }
  }
  n(ua, "resolveDeferredData");
  function Sr(e) {
    return new URLSearchParams(e).getAll("index").some((r) => r === "");
  }
  n(Sr, "hasNakedIndexQuery");
  function Zo(e, r) {
    let {
      route: t,
      pathname: o,
      params: a
    } = e;
    return {
      id: t.id,
      pathname: o,
      params: a,
      data: r[t.id],
      handle: t.handle
    };
  }
  n(Zo, "createUseMatchesMatch");
  function Lt(e, r) {
    let t = typeof r == "string" ? Ye(r).search : r.search;
    if (e[e.length - 1].route.index && Sr(t || ""))
      return e[e.length - 1];
    let o = Er(e);
    return o[o.length - 1];
  }
  n(Lt, "getTargetMatch");
  function Wn(e) {
    let {
      formMethod: r,
      formAction: t,
      formEncType: o,
      text: a,
      formData: i,
      json: l
    } = e;
    if (!(!r || !t || !o)) {
      if (a != null)
        return {
          formMethod: r,
          formAction: t,
          formEncType: o,
          formData: void 0,
          json: void 0,
          text: a
        };
      if (i != null)
        return {
          formMethod: r,
          formAction: t,
          formEncType: o,
          formData: i,
          json: void 0,
          text: void 0
        };
      if (l !== void 0)
        return {
          formMethod: r,
          formAction: t,
          formEncType: o,
          formData: void 0,
          json: l,
          text: void 0
        };
    }
  }
  n(Wn, "getSubmissionFromNavigation");
  function qt(e, r) {
    return r ? {
      state: "loading",
      location: e,
      formMethod: r.formMethod,
      formAction: r.formAction,
      formEncType: r.formEncType,
      formData: r.formData,
      json: r.json,
      text: r.text
    } : {
      state: "loading",
      location: e,
      formMethod: void 0,
      formAction: void 0,
      formEncType: void 0,
      formData: void 0,
      json: void 0,
      text: void 0
    };
  }
  n(qt, "getLoadingNavigation");
  function ei(e, r) {
    return {
      state: "submitting",
      location: e,
      formMethod: r.formMethod,
      formAction: r.formAction,
      formEncType: r.formEncType,
      formData: r.formData,
      json: r.json,
      text: r.text
    };
  }
  n(ei, "getSubmittingNavigation");
  function Nt(e, r) {
    return e ? {
      state: "loading",
      formMethod: e.formMethod,
      formAction: e.formAction,
      formEncType: e.formEncType,
      formData: e.formData,
      json: e.json,
      text: e.text,
      data: r,
      " _hasFetcherDoneAnything ": !0
    } : {
      state: "loading",
      formMethod: void 0,
      formAction: void 0,
      formEncType: void 0,
      formData: void 0,
      json: void 0,
      text: void 0,
      data: r,
      " _hasFetcherDoneAnything ": !0
    };
  }
  n(Nt, "getLoadingFetcher");
  function ti(e, r) {
    return {
      state: "submitting",
      formMethod: e.formMethod,
      formAction: e.formAction,
      formEncType: e.formEncType,
      formData: e.formData,
      json: e.json,
      text: e.text,
      data: r ? r.data : void 0,
      " _hasFetcherDoneAnything ": !0
    };
  }
  n(ti, "getSubmittingFetcher");
  function vt(e) {
    return {
      state: "idle",
      formMethod: void 0,
      formAction: void 0,
      formEncType: void 0,
      formData: void 0,
      json: void 0,
      text: void 0,
      data: e,
      " _hasFetcherDoneAnything ": !0
    };
  }
  n(vt, "getDoneFetcher");
  fe.AbortedDeferredError = Ft;
  fe.Action = Te;
  fe.ErrorResponse = Ut;
  fe.IDLE_BLOCKER = bt;
  fe.IDLE_FETCHER = Zn;
  fe.IDLE_NAVIGATION = $t;
  fe.UNSAFE_DEFERRED_SYMBOL = ra;
  fe.UNSAFE_DeferredData = Vt;
  fe.UNSAFE_convertRoutesToDataRoutes = _t;
  fe.UNSAFE_getPathContributingMatches = Er;
  fe.UNSAFE_invariant = be;
  fe.UNSAFE_warning = Ze;
  fe.createBrowserHistory = fo;
  fe.createHashHistory = ho;
  fe.createMemoryHistory = co;
  fe.createPath = et;
  fe.createRouter = qo;
  fe.createStaticHandler = $o;
  fe.defer = Io;
  fe.generatePath = Co;
  fe.getStaticContextFromError = Vo;
  fe.getToPathname = _o;
  fe.isDeferredData = la;
  fe.isRouteErrorResponse = Rr;
  fe.joinPaths = Et;
  fe.json = Lo;
  fe.matchPath = Vn;
  fe.matchRoutes = ut;
  fe.normalizePathname = Qn;
  fe.parsePath = Ye;
  fe.redirect = Xn;
  fe.redirectDocument = Bo;
  fe.resolvePath = Jn;
  fe.resolveTo = Yn;
  fe.stripBasename = Mt;
});

// ../node_modules/react-router/dist/umd/react-router.production.min.js
var ca = He((Yt, sa) => {
  (function(e, r) {
    typeof Yt == "object" && typeof sa < "u" ? r(Yt, require("react"), Tt()) : typeof define == "function" && define.amd ? define(["exports",
    "react", "@remix-run/router"], r) : r((e = typeof globalThis < "u" ? globalThis : e || self).ReactRouter = {}, e.React, e.RemixRouter);
  })(Yt, function(e, r, t) {
    "use strict";
    function o(u) {
      if (u && u.__esModule) return u;
      var c = /* @__PURE__ */ Object.create(null);
      return u && Object.keys(u).forEach(function(p) {
        if (p !== "default") {
          var P = Object.getOwnPropertyDescriptor(u, p);
          Object.defineProperty(c, p, P.get ? P : { enumerable: !0, get: /* @__PURE__ */ n(function() {
            return u[p];
          }, "get") });
        }
      }), c.default = u, Object.freeze(c);
    }
    n(o, "n");
    var a = o(r);
    function i() {
      return i = Object.assign ? Object.assign.bind() : function(u) {
        for (var c = 1; c < arguments.length; c++) {
          var p = arguments[c];
          for (var P in p) Object.prototype.hasOwnProperty.call(p, P) && (u[P] = p[P]);
        }
        return u;
      }, i.apply(this, arguments);
    }
    n(i, "o");
    let l = a.createContext(null), b = a.createContext(null), g = a.createContext(null), R = a.createContext(null), w = a.createContext(null),
    x = a.createContext({ outlet: null, matches: [], isDataRoute: !1 }), M = a.createContext(null);
    function _() {
      return a.useContext(w) != null;
    }
    n(_, "m");
    function N() {
      return _() || t.UNSAFE_invariant(!1), a.useContext(w).location;
    }
    n(N, "h");
    function L(u) {
      a.useContext(R).static || a.useLayoutEffect(u);
    }
    n(L, "f");
    function A() {
      let { isDataRoute: u } = a.useContext(x);
      return u ? function() {
        let { router: c } = Ue(Ae.UseNavigateStable), p = we(oe.UseNavigateStable), P = a.useRef(!1);
        return L(() => {
          P.current = !0;
        }), a.useCallback(function(O, U) {
          U === void 0 && (U = {}), P.current && (typeof O == "number" ? c.navigate(O) : c.navigate(O, i({ fromRouteId: p }, U)));
        }, [c, p]);
      }() : function() {
        _() || t.UNSAFE_invariant(!1);
        let c = a.useContext(l), { basename: p, navigator: P } = a.useContext(R), { matches: O } = a.useContext(x), { pathname: U } = N(), k = JSON.
        stringify(t.UNSAFE_getPathContributingMatches(O).map((J) => J.pathnameBase)), $ = a.useRef(!1);
        return L(() => {
          $.current = !0;
        }), a.useCallback(function(J, re) {
          if (re === void 0 && (re = {}), !$.current) return;
          if (typeof J == "number") return void P.go(J);
          let ie = t.resolveTo(J, JSON.parse(k), U, re.relative === "path");
          c == null && p !== "/" && (ie.pathname = ie.pathname === "/" ? p : t.joinPaths([p, ie.pathname])), (re.replace ? P.replace : P.push)(
          ie, re.state, re);
        }, [p, P, k, U, c]);
      }();
    }
    n(A, "v");
    let Q = a.createContext(null);
    function Z(u) {
      let c = a.useContext(x).outlet;
      return c && a.createElement(Q.Provider, { value: u }, c);
    }
    n(Z, "E");
    function V(u, c) {
      let { relative: p } = c === void 0 ? {} : c, { matches: P } = a.useContext(x), { pathname: O } = N(), U = JSON.stringify(t.UNSAFE_getPathContributingMatches(
      P).map((k) => k.pathnameBase));
      return a.useMemo(() => t.resolveTo(u, JSON.parse(U), O, p === "path"), [u, U, O, p]);
    }
    n(V, "b");
    function m(u, c) {
      return ee(u, c);
    }
    n(m, "y");
    function ee(u, c, p) {
      _() || t.UNSAFE_invariant(!1);
      let { navigator: P } = a.useContext(R), { matches: O } = a.useContext(x), U = O[O.length - 1], k = U ? U.params : {};
      !U || U.pathname;
      let $ = U ? U.pathnameBase : "/";
      U && U.route;
      let J, re = N();
      if (c) {
        var ie;
        let De = typeof c == "string" ? t.parsePath(c) : c;
        $ === "/" || (ie = De.pathname) != null && ie.startsWith($) || t.UNSAFE_invariant(!1), J = De;
      } else J = re;
      let le = J.pathname || "/", se = $ === "/" ? le : le.slice($.length) || "/", ge = t.matchRoutes(u, { pathname: se }), Oe = xe(ge && ge.
      map((De) => Object.assign({}, De, { params: Object.assign({}, k, De.params), pathname: t.joinPaths([$, P.encodeLocation ? P.encodeLocation(
      De.pathname).pathname : De.pathname]), pathnameBase: De.pathnameBase === "/" ? $ : t.joinPaths([$, P.encodeLocation ? P.encodeLocation(
      De.pathnameBase).pathname : De.pathnameBase]) })), O, p);
      return c && Oe ? a.createElement(w.Provider, { value: { location: i({ pathname: "/", search: "", hash: "", state: null, key: "default" },
      J), navigationType: t.Action.Pop } }, Oe) : Oe;
    }
    n(ee, "R");
    function de() {
      let u = ce(), c = t.isRouteErrorResponse(u) ? u.status + " " + u.statusText : u instanceof Error ? u.message : JSON.stringify(u), p = u instanceof
      Error ? u.stack : null, P = { padding: "0.5rem", backgroundColor: "rgba(200,200,200, 0.5)" };
      return a.createElement(a.Fragment, null, a.createElement("h2", null, "Unexpected Application Error!"), a.createElement("h3", { style: {
      fontStyle: "italic" } }, c), p ? a.createElement("pre", { style: P }, p) : null, null);
    }
    n(de, "C");
    let ae = a.createElement(de, null);
    class Se extends a.Component {
      static {
        n(this, "x");
      }
      constructor(c) {
        super(c), this.state = { location: c.location, revalidation: c.revalidation, error: c.error };
      }
      static getDerivedStateFromError(c) {
        return { error: c };
      }
      static getDerivedStateFromProps(c, p) {
        return p.location !== c.location || p.revalidation !== "idle" && c.revalidation === "idle" ? { error: c.error, location: c.location,
        revalidation: c.revalidation } : { error: c.error || p.error, location: p.location, revalidation: c.revalidation || p.revalidation };
      }
      componentDidCatch(c, p) {
        console.error("React Router caught the following error during render", c, p);
      }
      render() {
        return this.state.error ? a.createElement(x.Provider, { value: this.props.routeContext }, a.createElement(M.Provider, { value: this.
        state.error, children: this.props.component })) : this.props.children;
      }
    }
    function Pe(u) {
      let { routeContext: c, match: p, children: P } = u, O = a.useContext(l);
      return O && O.static && O.staticContext && (p.route.errorElement || p.route.ErrorBoundary) && (O.staticContext._deepestRenderedBoundaryId =
      p.route.id), a.createElement(x.Provider, { value: c }, P);
    }
    n(Pe, "U");
    function xe(u, c, p) {
      var P;
      if (c === void 0 && (c = []), p === void 0 && (p = null), u == null) {
        var O;
        if ((O = p) == null || !O.errors) return null;
        u = p.matches;
      }
      let U = u, k = (P = p) == null ? void 0 : P.errors;
      if (k != null) {
        let $ = U.findIndex((J) => J.route.id && k?.[J.route.id]);
        $ >= 0 || t.UNSAFE_invariant(!1), U = U.slice(0, Math.min(U.length, $ + 1));
      }
      return U.reduceRight(($, J, re) => {
        let ie = J.route.id ? k?.[J.route.id] : null, le = null;
        p && (le = J.route.errorElement || ae);
        let se = c.concat(U.slice(0, re + 1)), ge = /* @__PURE__ */ n(() => {
          let Oe;
          return Oe = ie ? le : J.route.Component ? a.createElement(J.route.Component, null) : J.route.element ? J.route.element : $, a.createElement(
          Pe, { match: J, routeContext: { outlet: $, matches: se, isDataRoute: p != null }, children: Oe });
        }, "d");
        return p && (J.route.ErrorBoundary || J.route.errorElement || re === 0) ? a.createElement(Se, { location: p.location, revalidation: p.
        revalidation, component: le, error: ie, children: ge(), routeContext: { outlet: null, matches: se, isDataRoute: !0 } }) : ge();
      }, null);
    }
    n(xe, "S");
    var Ae = function(u) {
      return u.UseBlocker = "useBlocker", u.UseRevalidator = "useRevalidator", u.UseNavigateStable = "useNavigate", u;
    }(Ae || {}), oe = function(u) {
      return u.UseBlocker = "useBlocker", u.UseLoaderData = "useLoaderData", u.UseActionData = "useActionData", u.UseRouteError = "useRouteE\
rror", u.UseNavigation = "useNavigation", u.UseRouteLoaderData = "useRouteLoaderData", u.UseMatches = "useMatches", u.UseRevalidator = "useR\
evalidator", u.UseNavigateStable = "useNavigate", u.UseRouteId = "useRouteId", u;
    }(oe || {});
    function Ue(u) {
      let c = a.useContext(l);
      return c || t.UNSAFE_invariant(!1), c;
    }
    n(Ue, "O");
    function Ee(u) {
      let c = a.useContext(b);
      return c || t.UNSAFE_invariant(!1), c;
    }
    n(Ee, "A");
    function we(u) {
      let c = function(P) {
        let O = a.useContext(x);
        return O || t.UNSAFE_invariant(!1), O;
      }(), p = c.matches[c.matches.length - 1];
      return p.route.id || t.UNSAFE_invariant(!1), p.route.id;
    }
    n(we, "j");
    function ce() {
      var u;
      let c = a.useContext(M), p = Ee(oe.UseRouteError), P = we(oe.UseRouteError);
      return c || ((u = p.errors) == null ? void 0 : u[P]);
    }
    n(ce, "D");
    function Fe() {
      let u = a.useContext(g);
      return u?._data;
    }
    n(Fe, "F");
    let Ce = 0, ve = a.startTransition;
    function Ke(u) {
      let { routes: c, state: p } = u;
      return ee(c, void 0, p);
    }
    n(Ke, "L");
    function qe(u) {
      t.UNSAFE_invariant(!1);
    }
    n(qe, "M");
    function Be(u) {
      let { basename: c = "/", children: p = null, location: P, navigationType: O = t.Action.Pop, navigator: U, static: k = !1 } = u;
      _() && t.UNSAFE_invariant(!1);
      let $ = c.replace(/^\/*/, "/"), J = a.useMemo(() => ({ basename: $, navigator: U, static: k }), [$, U, k]);
      typeof P == "string" && (P = t.parsePath(P));
      let { pathname: re = "/", search: ie = "", hash: le = "", state: se = null, key: ge = "default" } = P, Oe = a.useMemo(() => {
        let De = t.stripBasename(re, $);
        return De == null ? null : { location: { pathname: De, search: ie, hash: le, state: se, key: ge }, navigationType: O };
      }, [$, re, ie, le, se, ge, O]);
      return Oe == null ? null : a.createElement(R.Provider, { value: J }, a.createElement(w.Provider, { children: p, value: Oe }));
    }
    n(Be, "T");
    var je = function(u) {
      return u[u.pending = 0] = "pending", u[u.success = 1] = "success", u[u.error = 2] = "error", u;
    }(je || {});
    let pe = new Promise(() => {
    });
    class C extends a.Component {
      static {
        n(this, "J");
      }
      constructor(c) {
        super(c), this.state = { error: null };
      }
      static getDerivedStateFromError(c) {
        return { error: c };
      }
      componentDidCatch(c, p) {
        console.error("<Await> caught the following error during render", c, p);
      }
      render() {
        let { children: c, errorElement: p, resolve: P } = this.props, O = null, U = je.pending;
        if (P instanceof Promise) if (this.state.error) {
          U = je.error;
          let k = this.state.error;
          O = Promise.reject().catch(() => {
          }), Object.defineProperty(O, "_tracked", { get: /* @__PURE__ */ n(() => !0, "get") }), Object.defineProperty(O, "_error", { get: /* @__PURE__ */ n(
          () => k, "get") });
        } else P._tracked ? (O = P, U = O._error !== void 0 ? je.error : O._data !== void 0 ? je.success : je.pending) : (U = je.pending, Object.
        defineProperty(P, "_tracked", { get: /* @__PURE__ */ n(() => !0, "get") }), O = P.then((k) => Object.defineProperty(P, "_data", { get: /* @__PURE__ */ n(
        () => k, "get") }), (k) => Object.defineProperty(P, "_error", { get: /* @__PURE__ */ n(() => k, "get") })));
        else U = je.success, O = Promise.resolve(), Object.defineProperty(O, "_tracked", { get: /* @__PURE__ */ n(() => !0, "get") }), Object.
        defineProperty(O, "_data", { get: /* @__PURE__ */ n(() => P, "get") });
        if (U === je.error && O._error instanceof t.AbortedDeferredError) throw pe;
        if (U === je.error && !p) throw O._error;
        if (U === je.error) return a.createElement(g.Provider, { value: O, children: p });
        if (U === je.success) return a.createElement(g.Provider, { value: O, children: c });
        throw O;
      }
    }
    function D(u) {
      let { children: c } = u, p = Fe(), P = typeof c == "function" ? c(p) : c;
      return a.createElement(a.Fragment, null, P);
    }
    n(D, "H");
    function z(u, c) {
      c === void 0 && (c = []);
      let p = [];
      return a.Children.forEach(u, (P, O) => {
        if (!a.isValidElement(P)) return;
        let U = [...c, O];
        if (P.type === a.Fragment) return void p.push.apply(p, z(P.props.children, U));
        P.type !== qe && t.UNSAFE_invariant(!1), P.props.index && P.props.children && t.UNSAFE_invariant(!1);
        let k = { id: P.props.id || U.join("-"), caseSensitive: P.props.caseSensitive, element: P.props.element, Component: P.props.Component,
        index: P.props.index, path: P.props.path, loader: P.props.loader, action: P.props.action, errorElement: P.props.errorElement, ErrorBoundary: P.
        props.ErrorBoundary, hasErrorBoundary: P.props.ErrorBoundary != null || P.props.errorElement != null, shouldRevalidate: P.props.shouldRevalidate,
        handle: P.props.handle, lazy: P.props.lazy };
        P.props.children && (k.children = z(P.props.children, U)), p.push(k);
      }), p;
    }
    n(z, "z");
    function B(u) {
      let c = { hasErrorBoundary: u.ErrorBoundary != null || u.errorElement != null };
      return u.Component && Object.assign(c, { element: a.createElement(u.Component), Component: void 0 }), u.ErrorBoundary && Object.assign(
      c, { errorElement: a.createElement(u.ErrorBoundary), ErrorBoundary: void 0 }), c;
    }
    n(B, "q"), Object.defineProperty(e, "AbortedDeferredError", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.AbortedDeferredError;
    }, "get") }), Object.defineProperty(e, "NavigationType", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.Action;
    }, "get") }), Object.defineProperty(e, "createPath", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.createPath;
    }, "get") }), Object.defineProperty(e, "defer", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.defer;
    }, "get") }), Object.defineProperty(e, "generatePath", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.generatePath;
    }, "get") }), Object.defineProperty(e, "isRouteErrorResponse", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.isRouteErrorResponse;
    }, "get") }), Object.defineProperty(e, "json", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.json;
    }, "get") }), Object.defineProperty(e, "matchPath", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.matchPath;
    }, "get") }), Object.defineProperty(e, "matchRoutes", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.matchRoutes;
    }, "get") }), Object.defineProperty(e, "parsePath", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.parsePath;
    }, "get") }), Object.defineProperty(e, "redirect", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.redirect;
    }, "get") }), Object.defineProperty(e, "redirectDocument", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.redirectDocument;
    }, "get") }), Object.defineProperty(e, "resolvePath", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.resolvePath;
    }, "get") }), e.Await = function(u) {
      let { children: c, errorElement: p, resolve: P } = u;
      return a.createElement(C, { resolve: P, errorElement: p }, a.createElement(D, null, c));
    }, e.MemoryRouter = function(u) {
      let { basename: c, children: p, initialEntries: P, initialIndex: O, future: U } = u, k = a.useRef();
      k.current == null && (k.current = t.createMemoryHistory({ initialEntries: P, initialIndex: O, v5Compat: !0 }));
      let $ = k.current, [J, re] = a.useState({ action: $.action, location: $.location }), { v7_startTransition: ie } = U || {}, le = a.useCallback(
      (se) => {
        ie && ve ? ve(() => re(se)) : re(se);
      }, [re, ie]);
      return a.useLayoutEffect(() => $.listen(le), [$, le]), a.createElement(Be, { basename: c, children: p, location: J.location, navigationType: J.
      action, navigator: $ });
    }, e.Navigate = function(u) {
      let { to: c, replace: p, state: P, relative: O } = u;
      _() || t.UNSAFE_invariant(!1);
      let { matches: U } = a.useContext(x), { pathname: k } = N(), $ = A(), J = t.resolveTo(c, t.UNSAFE_getPathContributingMatches(U).map((ie) => ie.
      pathnameBase), k, O === "path"), re = JSON.stringify(J);
      return a.useEffect(() => $(JSON.parse(re), { replace: p, state: P, relative: O }), [$, re, O, p, P]), null;
    }, e.Outlet = function(u) {
      return Z(u.context);
    }, e.Route = qe, e.Router = Be, e.RouterProvider = function(u) {
      let { fallbackElement: c, router: p, future: P } = u, [O, U] = a.useState(p.state), { v7_startTransition: k } = P || {}, $ = a.useCallback(
      (le) => {
        k && ve ? ve(() => U(le)) : U(le);
      }, [U, k]);
      a.useLayoutEffect(() => p.subscribe($), [p, $]);
      let J = a.useMemo(() => ({ createHref: p.createHref, encodeLocation: p.encodeLocation, go: /* @__PURE__ */ n((le) => p.navigate(le), "\
go"), push: /* @__PURE__ */ n((le, se, ge) => p.navigate(le, { state: se, preventScrollReset: ge?.preventScrollReset }), "push"), replace: /* @__PURE__ */ n(
      (le, se, ge) => p.navigate(le, { replace: !0, state: se, preventScrollReset: ge?.preventScrollReset }), "replace") }), [p]), re = p.basename ||
      "/", ie = a.useMemo(() => ({ router: p, navigator: J, static: !1, basename: re }), [p, J, re]);
      return a.createElement(a.Fragment, null, a.createElement(l.Provider, { value: ie }, a.createElement(b.Provider, { value: O }, a.createElement(
      Be, { basename: re, location: O.location, navigationType: O.historyAction, navigator: J }, O.initialized ? a.createElement(Ke, { routes: p.
      routes, state: O }) : c))), null);
    }, e.Routes = function(u) {
      let { children: c, location: p } = u;
      return m(z(c), p);
    }, e.UNSAFE_DataRouterContext = l, e.UNSAFE_DataRouterStateContext = b, e.UNSAFE_LocationContext = w, e.UNSAFE_NavigationContext = R, e.
    UNSAFE_RouteContext = x, e.UNSAFE_mapRouteProperties = B, e.UNSAFE_useRouteId = function() {
      return we(oe.UseRouteId);
    }, e.UNSAFE_useRoutesImpl = ee, e.createMemoryRouter = function(u, c) {
      return t.createRouter({ basename: c?.basename, future: i({}, c?.future, { v7_prependBasename: !0 }), history: t.createMemoryHistory({ initialEntries: c?.
      initialEntries, initialIndex: c?.initialIndex }), hydrationData: c?.hydrationData, routes: u, mapRouteProperties: B }).initialize();
    }, e.createRoutesFromChildren = z, e.createRoutesFromElements = z, e.renderMatches = function(u) {
      return xe(u);
    }, e.unstable_useBlocker = function(u) {
      let { router: c, basename: p } = Ue(Ae.UseBlocker), P = Ee(oe.UseBlocker), [O, U] = a.useState(""), k = a.useCallback(($) => {
        if (typeof u != "function") return !!u;
        if (p === "/") return u($);
        let { currentLocation: J, nextLocation: re, historyAction: ie } = $;
        return u({ currentLocation: i({}, J, { pathname: t.stripBasename(J.pathname, p) || J.pathname }), nextLocation: i({}, re, { pathname: t.
        stripBasename(re.pathname, p) || re.pathname }), historyAction: ie });
      }, [p, u]);
      return a.useEffect(() => {
        let $ = String(++Ce);
        return U($), () => c.deleteBlocker($);
      }, [c]), a.useEffect(() => {
        O !== "" && c.getBlocker(O, k);
      }, [c, O, k]), O && P.blockers.has(O) ? P.blockers.get(O) : t.IDLE_BLOCKER;
    }, e.useActionData = function() {
      let u = Ee(oe.UseActionData);
      return a.useContext(x) || t.UNSAFE_invariant(!1), Object.values(u?.actionData || {})[0];
    }, e.useAsyncError = function() {
      let u = a.useContext(g);
      return u?._error;
    }, e.useAsyncValue = Fe, e.useHref = function(u, c) {
      let { relative: p } = c === void 0 ? {} : c;
      _() || t.UNSAFE_invariant(!1);
      let { basename: P, navigator: O } = a.useContext(R), { hash: U, pathname: k, search: $ } = V(u, { relative: p }), J = k;
      return P !== "/" && (J = k === "/" ? P : t.joinPaths([P, k])), O.createHref({ pathname: J, search: $, hash: U });
    }, e.useInRouterContext = _, e.useLoaderData = function() {
      let u = Ee(oe.UseLoaderData), c = we(oe.UseLoaderData);
      if (!u.errors || u.errors[c] == null) return u.loaderData[c];
      console.error("You cannot `useLoaderData` in an errorElement (routeId: " + c + ")");
    }, e.useLocation = N, e.useMatch = function(u) {
      _() || t.UNSAFE_invariant(!1);
      let { pathname: c } = N();
      return a.useMemo(() => t.matchPath(u, c), [c, u]);
    }, e.useMatches = function() {
      let { matches: u, loaderData: c } = Ee(oe.UseMatches);
      return a.useMemo(() => u.map((p) => {
        let { pathname: P, params: O } = p;
        return { id: p.route.id, pathname: P, params: O, data: c[p.route.id], handle: p.route.handle };
      }), [u, c]);
    }, e.useNavigate = A, e.useNavigation = function() {
      return Ee(oe.UseNavigation).navigation;
    }, e.useNavigationType = function() {
      return a.useContext(w).navigationType;
    }, e.useOutlet = Z, e.useOutletContext = function() {
      return a.useContext(Q);
    }, e.useParams = function() {
      let { matches: u } = a.useContext(x), c = u[u.length - 1];
      return c ? c.params : {};
    }, e.useResolvedPath = V, e.useRevalidator = function() {
      let u = Ue(Ae.UseRevalidator), c = Ee(oe.UseRevalidator);
      return a.useMemo(() => ({ revalidate: u.router.revalidate, state: c.revalidation }), [u.router.revalidate, c.revalidation]);
    }, e.useRouteError = ce, e.useRouteLoaderData = function(u) {
      return Ee(oe.UseRouteLoaderData).loaderData[u];
    }, e.useRoutes = m, Object.defineProperty(e, "__esModule", { value: !0 });
  });
});

// ../node_modules/react-router/dist/umd/react-router.development.js
var da = He((Qt, fa) => {
  (function(e, r) {
    typeof Qt == "object" && typeof fa < "u" ? r(Qt, require("react"), Tt()) : typeof define == "function" && define.amd ? define(["exports",
    "react", "@remix-run/router"], r) : (e = typeof globalThis < "u" ? globalThis : e || self, r(e.ReactRouter = {}, e.React, e.RemixRouter));
  })(Qt, function(e, r, t) {
    "use strict";
    function o(s) {
      if (s && s.__esModule) return s;
      var f = /* @__PURE__ */ Object.create(null);
      return s && Object.keys(s).forEach(function(y) {
        if (y !== "default") {
          var v = Object.getOwnPropertyDescriptor(s, y);
          Object.defineProperty(f, y, v.get ? v : {
            enumerable: !0,
            get: /* @__PURE__ */ n(function() {
              return s[y];
            }, "get")
          });
        }
      }), f.default = s, Object.freeze(f);
    }
    n(o, "_interopNamespace");
    var a = /* @__PURE__ */ o(r);
    function i() {
      return i = Object.assign ? Object.assign.bind() : function(s) {
        for (var f = 1; f < arguments.length; f++) {
          var y = arguments[f];
          for (var v in y)
            Object.prototype.hasOwnProperty.call(y, v) && (s[v] = y[v]);
        }
        return s;
      }, i.apply(this, arguments);
    }
    n(i, "_extends");
    let l = /* @__PURE__ */ a.createContext(null);
    l.displayName = "DataRouter";
    let b = /* @__PURE__ */ a.createContext(null);
    b.displayName = "DataRouterState";
    let g = /* @__PURE__ */ a.createContext(null);
    g.displayName = "Await";
    let R = /* @__PURE__ */ a.createContext(null);
    R.displayName = "Navigation";
    let w = /* @__PURE__ */ a.createContext(null);
    w.displayName = "Location";
    let x = /* @__PURE__ */ a.createContext({
      outlet: null,
      matches: [],
      isDataRoute: !1
    });
    x.displayName = "Route";
    let M = /* @__PURE__ */ a.createContext(null);
    M.displayName = "RouteError";
    function _(s, f) {
      let {
        relative: y
      } = f === void 0 ? {} : f;
      N() || t.UNSAFE_invariant(
        !1,
        // TODO: This error is probably because they somehow have 2 versions of the
        // router loaded. We can help them understand how to avoid that.
        "useHref() may be used only in the context of a <Router> component."
      );
      let {
        basename: v,
        navigator: F
      } = a.useContext(R), {
        hash: q,
        pathname: W,
        search: G
      } = xe(s, {
        relative: y
      }), X = W;
      return v !== "/" && (X = W === "/" ? v : t.joinPaths([v, W])), F.createHref({
        pathname: X,
        search: G,
        hash: q
      });
    }
    n(_, "useHref");
    function N() {
      return a.useContext(w) != null;
    }
    n(N, "useInRouterContext");
    function L() {
      return N() || t.UNSAFE_invariant(
        !1,
        // TODO: This error is probably because they somehow have 2 versions of the
        // router loaded. We can help them understand how to avoid that.
        "useLocation() may be used only in the context of a <Router> component."
      ), a.useContext(w).location;
    }
    n(L, "useLocation");
    function A() {
      return a.useContext(w).navigationType;
    }
    n(A, "useNavigationType");
    function Q(s) {
      N() || t.UNSAFE_invariant(
        !1,
        // TODO: This error is probably because they somehow have 2 versions of the
        // router loaded. We can help them understand how to avoid that.
        "useMatch() may be used only in the context of a <Router> component."
      );
      let {
        pathname: f
      } = L();
      return a.useMemo(() => t.matchPath(s, f), [f, s]);
    }
    n(Q, "useMatch");
    let Z = "You should call navigate() in a React.useEffect(), not when your component is first rendered.";
    function V(s) {
      a.useContext(R).static || a.useLayoutEffect(s);
    }
    n(V, "useIsomorphicLayoutEffect");
    function m() {
      let {
        isDataRoute: s
      } = a.useContext(x);
      return s ? J() : ee();
    }
    n(m, "useNavigate");
    function ee() {
      N() || t.UNSAFE_invariant(
        !1,
        // TODO: This error is probably because they somehow have 2 versions of the
        // router loaded. We can help them understand how to avoid that.
        "useNavigate() may be used only in the context of a <Router> component."
      );
      let s = a.useContext(l), {
        basename: f,
        navigator: y
      } = a.useContext(R), {
        matches: v
      } = a.useContext(x), {
        pathname: F
      } = L(), q = JSON.stringify(t.UNSAFE_getPathContributingMatches(v).map((X) => X.pathnameBase)), W = a.useRef(!1);
      return V(() => {
        W.current = !0;
      }), a.useCallback(function(X, ue) {
        if (ue === void 0 && (ue = {}), t.UNSAFE_warning(W.current, Z), !W.current) return;
        if (typeof X == "number") {
          y.go(X);
          return;
        }
        let ye = t.resolveTo(X, JSON.parse(q), F, ue.relative === "path");
        s == null && f !== "/" && (ye.pathname = ye.pathname === "/" ? f : t.joinPaths([f, ye.pathname])), (ue.replace ? y.replace : y.push)(
        ye, ue.state, ue);
      }, [f, y, q, F, s]);
    }
    n(ee, "useNavigateUnstable");
    let de = /* @__PURE__ */ a.createContext(null);
    function ae() {
      return a.useContext(de);
    }
    n(ae, "useOutletContext");
    function Se(s) {
      let f = a.useContext(x).outlet;
      return f && /* @__PURE__ */ a.createElement(de.Provider, {
        value: s
      }, f);
    }
    n(Se, "useOutlet");
    function Pe() {
      let {
        matches: s
      } = a.useContext(x), f = s[s.length - 1];
      return f ? f.params : {};
    }
    n(Pe, "useParams");
    function xe(s, f) {
      let {
        relative: y
      } = f === void 0 ? {} : f, {
        matches: v
      } = a.useContext(x), {
        pathname: F
      } = L(), q = JSON.stringify(t.UNSAFE_getPathContributingMatches(v).map((W) => W.pathnameBase));
      return a.useMemo(() => t.resolveTo(s, JSON.parse(q), F, y === "path"), [s, q, F, y]);
    }
    n(xe, "useResolvedPath");
    function Ae(s, f) {
      return oe(s, f);
    }
    n(Ae, "useRoutes");
    function oe(s, f, y) {
      N() || t.UNSAFE_invariant(
        !1,
        // TODO: This error is probably because they somehow have 2 versions of the
        // router loaded. We can help them understand how to avoid that.
        "useRoutes() may be used only in the context of a <Router> component."
      );
      let {
        navigator: v
      } = a.useContext(R), {
        matches: F
      } = a.useContext(x), q = F[F.length - 1], W = q ? q.params : {}, G = q ? q.pathname : "/", X = q ? q.pathnameBase : "/", ue = q && q.route;
      {
        let Me = ue && ue.path || "";
        ie(G, !ue || Me.endsWith("*"), "You rendered descendant <Routes> (or called `useRoutes()`) at " + ('"' + G + '" (under <Route path="' +
        Me + '">) but the ') + `parent route path has no trailing "*". This means if you navigate deeper, the parent won't match anymore and\
 therefore the child routes will never render.

` + ('Please change the parent <Route path="' + Me + '"> to <Route ') + ('path="' + (Me === "/" ? "*" : Me + "/*") + '">.'));
      }
      let ye = L(), he;
      if (f) {
        var ke;
        let Me = typeof f == "string" ? t.parsePath(f) : f;
        X === "/" || (ke = Me.pathname) != null && ke.startsWith(X) || t.UNSAFE_invariant(!1, "When overriding the location using `<Routes l\
ocation>` or `useRoutes(routes, location)`, the location pathname must begin with the portion of the URL pathname that was " + ('matched by \
all parent routes. The current pathname base is "' + X + '" ') + ('but pathname "' + Me.pathname + '" was given in the `location` prop.')), he =
        Me;
      } else
        he = ye;
      let Ne = he.pathname || "/", Le = X === "/" ? Ne : Ne.slice(X.length) || "/", We = t.matchRoutes(s, {
        pathname: Le
      });
      t.UNSAFE_warning(ue || We != null, 'No routes matched location "' + he.pathname + he.search + he.hash + '" '), t.UNSAFE_warning(We == null ||
      We[We.length - 1].route.element !== void 0 || We[We.length - 1].route.Component !== void 0, 'Matched leaf route at location "' + he.pathname +
      he.search + he.hash + '" does not have an element or Component. This means it will render an <Outlet /> with a null value by default r\
esulting in an "empty" page.');
      let ft = Fe(We && We.map((Me) => Object.assign({}, Me, {
        params: Object.assign({}, W, Me.params),
        pathname: t.joinPaths([
          X,
          // Re-encode pathnames that were decoded inside matchRoutes
          v.encodeLocation ? v.encodeLocation(Me.pathname).pathname : Me.pathname
        ]),
        pathnameBase: Me.pathnameBase === "/" ? X : t.joinPaths([
          X,
          // Re-encode pathnames that were decoded inside matchRoutes
          v.encodeLocation ? v.encodeLocation(Me.pathnameBase).pathname : Me.pathnameBase
        ])
      })), F, y);
      return f && ft ? /* @__PURE__ */ a.createElement(w.Provider, {
        value: {
          location: i({
            pathname: "/",
            search: "",
            hash: "",
            state: null,
            key: "default"
          }, he),
          navigationType: t.Action.Pop
        }
      }, ft) : ft;
    }
    n(oe, "useRoutesImpl");
    function Ue() {
      let s = P(), f = t.isRouteErrorResponse(s) ? s.status + " " + s.statusText : s instanceof Error ? s.message : JSON.stringify(s), y = s instanceof
      Error ? s.stack : null, v = "rgba(200,200,200, 0.5)", F = {
        padding: "0.5rem",
        backgroundColor: v
      }, q = {
        padding: "2px 4px",
        backgroundColor: v
      }, W = null;
      return console.error("Error handled by React Router default ErrorBoundary:", s), W = /* @__PURE__ */ a.createElement(a.Fragment, null,
      /* @__PURE__ */ a.createElement("p", null, "\u{1F4BF} Hey developer \u{1F44B}"), /* @__PURE__ */ a.createElement("p", null, "You can p\
rovide a way better UX than this when your app throws errors by providing your own ", /* @__PURE__ */ a.createElement("code", {
        style: q
      }, "ErrorBoundary"), " or", " ", /* @__PURE__ */ a.createElement("code", {
        style: q
      }, "errorElement"), " prop on your route.")), /* @__PURE__ */ a.createElement(a.Fragment, null, /* @__PURE__ */ a.createElement("h2", null,
      "Unexpected Application Error!"), /* @__PURE__ */ a.createElement("h3", {
        style: {
          fontStyle: "italic"
        }
      }, f), y ? /* @__PURE__ */ a.createElement("pre", {
        style: F
      }, y) : null, W);
    }
    n(Ue, "DefaultErrorComponent");
    let Ee = /* @__PURE__ */ a.createElement(Ue, null);
    class we extends a.Component {
      static {
        n(this, "RenderErrorBoundary");
      }
      constructor(f) {
        super(f), this.state = {
          location: f.location,
          revalidation: f.revalidation,
          error: f.error
        };
      }
      static getDerivedStateFromError(f) {
        return {
          error: f
        };
      }
      static getDerivedStateFromProps(f, y) {
        return y.location !== f.location || y.revalidation !== "idle" && f.revalidation === "idle" ? {
          error: f.error,
          location: f.location,
          revalidation: f.revalidation
        } : {
          error: f.error || y.error,
          location: y.location,
          revalidation: f.revalidation || y.revalidation
        };
      }
      componentDidCatch(f, y) {
        console.error("React Router caught the following error during render", f, y);
      }
      render() {
        return this.state.error ? /* @__PURE__ */ a.createElement(x.Provider, {
          value: this.props.routeContext
        }, /* @__PURE__ */ a.createElement(M.Provider, {
          value: this.state.error,
          children: this.props.component
        })) : this.props.children;
      }
    }
    function ce(s) {
      let {
        routeContext: f,
        match: y,
        children: v
      } = s, F = a.useContext(l);
      return F && F.static && F.staticContext && (y.route.errorElement || y.route.ErrorBoundary) && (F.staticContext._deepestRenderedBoundaryId =
      y.route.id), /* @__PURE__ */ a.createElement(x.Provider, {
        value: f
      }, v);
    }
    n(ce, "RenderedRoute");
    function Fe(s, f, y) {
      var v;
      if (f === void 0 && (f = []), y === void 0 && (y = null), s == null) {
        var F;
        if ((F = y) != null && F.errors)
          s = y.matches;
        else
          return null;
      }
      let q = s, W = (v = y) == null ? void 0 : v.errors;
      if (W != null) {
        let G = q.findIndex((X) => X.route.id && W?.[X.route.id]);
        G >= 0 || t.UNSAFE_invariant(!1, "Could not find a matching route for errors on route IDs: " + Object.keys(W).join(",")), q = q.slice(
        0, Math.min(q.length, G + 1));
      }
      return q.reduceRight((G, X, ue) => {
        let ye = X.route.id ? W?.[X.route.id] : null, he = null;
        y && (he = X.route.errorElement || Ee);
        let ke = f.concat(q.slice(0, ue + 1)), Ne = /* @__PURE__ */ n(() => {
          let Le;
          return ye ? Le = he : X.route.Component ? Le = /* @__PURE__ */ a.createElement(X.route.Component, null) : X.route.element ? Le = X.
          route.element : Le = G, /* @__PURE__ */ a.createElement(ce, {
            match: X,
            routeContext: {
              outlet: G,
              matches: ke,
              isDataRoute: y != null
            },
            children: Le
          });
        }, "getChildren");
        return y && (X.route.ErrorBoundary || X.route.errorElement || ue === 0) ? /* @__PURE__ */ a.createElement(we, {
          location: y.location,
          revalidation: y.revalidation,
          component: he,
          error: ye,
          children: Ne(),
          routeContext: {
            outlet: null,
            matches: ke,
            isDataRoute: !0
          }
        }) : Ne();
      }, null);
    }
    n(Fe, "_renderMatches");
    var Ce = /* @__PURE__ */ function(s) {
      return s.UseBlocker = "useBlocker", s.UseRevalidator = "useRevalidator", s.UseNavigateStable = "useNavigate", s;
    }(Ce || {}), ve = /* @__PURE__ */ function(s) {
      return s.UseBlocker = "useBlocker", s.UseLoaderData = "useLoaderData", s.UseActionData = "useActionData", s.UseRouteError = "useRouteE\
rror", s.UseNavigation = "useNavigation", s.UseRouteLoaderData = "useRouteLoaderData", s.UseMatches = "useMatches", s.UseRevalidator = "useR\
evalidator", s.UseNavigateStable = "useNavigate", s.UseRouteId = "useRouteId", s;
    }(ve || {});
    function Ke(s) {
      return s + " must be used within a data router.  See https://reactrouter.com/routers/picking-a-router.";
    }
    n(Ke, "getDataRouterConsoleError");
    function qe(s) {
      let f = a.useContext(l);
      return f || t.UNSAFE_invariant(!1, Ke(s)), f;
    }
    n(qe, "useDataRouterContext");
    function Be(s) {
      let f = a.useContext(b);
      return f || t.UNSAFE_invariant(!1, Ke(s)), f;
    }
    n(Be, "useDataRouterState");
    function je(s) {
      let f = a.useContext(x);
      return f || t.UNSAFE_invariant(!1, Ke(s)), f;
    }
    n(je, "useRouteContext");
    function pe(s) {
      let f = je(s), y = f.matches[f.matches.length - 1];
      return y.route.id || t.UNSAFE_invariant(!1, s + ' can only be used on routes that contain a unique "id"'), y.route.id;
    }
    n(pe, "useCurrentRouteId");
    function C() {
      return pe(ve.UseRouteId);
    }
    n(C, "useRouteId");
    function D() {
      return Be(ve.UseNavigation).navigation;
    }
    n(D, "useNavigation");
    function z() {
      let s = qe(Ce.UseRevalidator), f = Be(ve.UseRevalidator);
      return a.useMemo(() => ({
        revalidate: s.router.revalidate,
        state: f.revalidation
      }), [s.router.revalidate, f.revalidation]);
    }
    n(z, "useRevalidator");
    function B() {
      let {
        matches: s,
        loaderData: f
      } = Be(ve.UseMatches);
      return a.useMemo(() => s.map((y) => {
        let {
          pathname: v,
          params: F
        } = y;
        return {
          id: y.route.id,
          pathname: v,
          params: F,
          data: f[y.route.id],
          handle: y.route.handle
        };
      }), [s, f]);
    }
    n(B, "useMatches");
    function u() {
      let s = Be(ve.UseLoaderData), f = pe(ve.UseLoaderData);
      if (s.errors && s.errors[f] != null) {
        console.error("You cannot `useLoaderData` in an errorElement (routeId: " + f + ")");
        return;
      }
      return s.loaderData[f];
    }
    n(u, "useLoaderData");
    function c(s) {
      return Be(ve.UseRouteLoaderData).loaderData[s];
    }
    n(c, "useRouteLoaderData");
    function p() {
      let s = Be(ve.UseActionData);
      return a.useContext(x) || t.UNSAFE_invariant(!1, "useActionData must be used inside a RouteContext"), Object.values(s?.actionData || {})[0];
    }
    n(p, "useActionData");
    function P() {
      var s;
      let f = a.useContext(M), y = Be(ve.UseRouteError), v = pe(ve.UseRouteError);
      return f || ((s = y.errors) == null ? void 0 : s[v]);
    }
    n(P, "useRouteError");
    function O() {
      let s = a.useContext(g);
      return s?._data;
    }
    n(O, "useAsyncValue");
    function U() {
      let s = a.useContext(g);
      return s?._error;
    }
    n(U, "useAsyncError");
    let k = 0;
    function $(s) {
      let {
        router: f,
        basename: y
      } = qe(Ce.UseBlocker), v = Be(ve.UseBlocker), [F, q] = a.useState(""), W = a.useCallback((G) => {
        if (typeof s != "function")
          return !!s;
        if (y === "/")
          return s(G);
        let {
          currentLocation: X,
          nextLocation: ue,
          historyAction: ye
        } = G;
        return s({
          currentLocation: i({}, X, {
            pathname: t.stripBasename(X.pathname, y) || X.pathname
          }),
          nextLocation: i({}, ue, {
            pathname: t.stripBasename(ue.pathname, y) || ue.pathname
          }),
          historyAction: ye
        });
      }, [y, s]);
      return a.useEffect(() => {
        let G = String(++k);
        return q(G), () => f.deleteBlocker(G);
      }, [f]), a.useEffect(() => {
        F !== "" && f.getBlocker(F, W);
      }, [f, F, W]), F && v.blockers.has(F) ? v.blockers.get(F) : t.IDLE_BLOCKER;
    }
    n($, "useBlocker");
    function J() {
      let {
        router: s
      } = qe(Ce.UseNavigateStable), f = pe(ve.UseNavigateStable), y = a.useRef(!1);
      return V(() => {
        y.current = !0;
      }), a.useCallback(function(F, q) {
        q === void 0 && (q = {}), t.UNSAFE_warning(y.current, Z), y.current && (typeof F == "number" ? s.navigate(F) : s.navigate(F, i({
          fromRouteId: f
        }, q)));
      }, [s, f]);
    }
    n(J, "useNavigateStable");
    let re = {};
    function ie(s, f, y) {
      !f && !re[s] && (re[s] = !0, t.UNSAFE_warning(!1, y));
    }
    n(ie, "warningOnce");
    let se = a["startTransition"];
    function ge(s) {
      let {
        fallbackElement: f,
        router: y,
        future: v
      } = s, [F, q] = a.useState(y.state), {
        v7_startTransition: W
      } = v || {}, G = a.useCallback((he) => {
        W && se ? se(() => q(he)) : q(he);
      }, [q, W]);
      a.useLayoutEffect(() => y.subscribe(G), [y, G]);
      let X = a.useMemo(() => ({
        createHref: y.createHref,
        encodeLocation: y.encodeLocation,
        go: /* @__PURE__ */ n((he) => y.navigate(he), "go"),
        push: /* @__PURE__ */ n((he, ke, Ne) => y.navigate(he, {
          state: ke,
          preventScrollReset: Ne?.preventScrollReset
        }), "push"),
        replace: /* @__PURE__ */ n((he, ke, Ne) => y.navigate(he, {
          replace: !0,
          state: ke,
          preventScrollReset: Ne?.preventScrollReset
        }), "replace")
      }), [y]), ue = y.basename || "/", ye = a.useMemo(() => ({
        router: y,
        navigator: X,
        static: !1,
        basename: ue
      }), [y, X, ue]);
      return /* @__PURE__ */ a.createElement(a.Fragment, null, /* @__PURE__ */ a.createElement(l.Provider, {
        value: ye
      }, /* @__PURE__ */ a.createElement(b.Provider, {
        value: F
      }, /* @__PURE__ */ a.createElement(j, {
        basename: ue,
        location: F.location,
        navigationType: F.historyAction,
        navigator: X
      }, F.initialized ? /* @__PURE__ */ a.createElement(Oe, {
        routes: y.routes,
        state: F
      }) : f))), null);
    }
    n(ge, "RouterProvider");
    function Oe(s) {
      let {
        routes: f,
        state: y
      } = s;
      return oe(f, void 0, y);
    }
    n(Oe, "DataRoutes");
    function De(s) {
      let {
        basename: f,
        children: y,
        initialEntries: v,
        initialIndex: F,
        future: q
      } = s, W = a.useRef();
      W.current == null && (W.current = t.createMemoryHistory({
        initialEntries: v,
        initialIndex: F,
        v5Compat: !0
      }));
      let G = W.current, [X, ue] = a.useState({
        action: G.action,
        location: G.location
      }), {
        v7_startTransition: ye
      } = q || {}, he = a.useCallback((ke) => {
        ye && se ? se(() => ue(ke)) : ue(ke);
      }, [ue, ye]);
      return a.useLayoutEffect(() => G.listen(he), [G, he]), /* @__PURE__ */ a.createElement(j, {
        basename: f,
        children: y,
        location: X.location,
        navigationType: X.action,
        navigator: G
      });
    }
    n(De, "MemoryRouter");
    function ot(s) {
      let {
        to: f,
        replace: y,
        state: v,
        relative: F
      } = s;
      N() || t.UNSAFE_invariant(
        !1,
        // TODO: This error is probably because they somehow have 2 versions of
        // the router loaded. We can help them understand how to avoid that.
        "<Navigate> may be used only in the context of a <Router> component."
      ), t.UNSAFE_warning(!a.useContext(R).static, "<Navigate> must not be used on the initial render in a <StaticRouter>. This is a no-op, \
but you should modify your code so the <Navigate> is only ever rendered in response to some user interaction or state change.");
      let {
        matches: q
      } = a.useContext(x), {
        pathname: W
      } = L(), G = m(), X = t.resolveTo(f, t.UNSAFE_getPathContributingMatches(q).map((ye) => ye.pathnameBase), W, F === "path"), ue = JSON.
      stringify(X);
      return a.useEffect(() => G(JSON.parse(ue), {
        replace: y,
        state: v,
        relative: F
      }), [G, ue, F, y, v]), null;
    }
    n(ot, "Navigate");
    function Qe(s) {
      return Se(s.context);
    }
    n(Qe, "Outlet");
    function E(s) {
      t.UNSAFE_invariant(!1, "A <Route> is only ever to be used as the child of <Routes> element, never rendered directly. Please wrap your \
<Route> in a <Routes>.");
    }
    n(E, "Route");
    function j(s) {
      let {
        basename: f = "/",
        children: y = null,
        location: v,
        navigationType: F = t.Action.Pop,
        navigator: q,
        static: W = !1
      } = s;
      N() && t.UNSAFE_invariant(!1, "You cannot render a <Router> inside another <Router>. You should never have more than one in your app.");
      let G = f.replace(/^\/*/, "/"), X = a.useMemo(() => ({
        basename: G,
        navigator: q,
        static: W
      }), [G, q, W]);
      typeof v == "string" && (v = t.parsePath(v));
      let {
        pathname: ue = "/",
        search: ye = "",
        hash: he = "",
        state: ke = null,
        key: Ne = "default"
      } = v, Le = a.useMemo(() => {
        let We = t.stripBasename(ue, G);
        return We == null ? null : {
          location: {
            pathname: We,
            search: ye,
            hash: he,
            state: ke,
            key: Ne
          },
          navigationType: F
        };
      }, [G, ue, ye, he, ke, Ne, F]);
      return t.UNSAFE_warning(Le != null, '<Router basename="' + G + '"> is not able to match the URL ' + ('"' + ue + ye + he + '" because i\
t does not start with the ') + "basename, so the <Router> won't render anything."), Le == null ? null : /* @__PURE__ */ a.createElement(R.Provider,
      {
        value: X
      }, /* @__PURE__ */ a.createElement(w.Provider, {
        children: y,
        value: Le
      }));
    }
    n(j, "Router");
    function H(s) {
      let {
        children: f,
        location: y
      } = s;
      return Ae(h(f), y);
    }
    n(H, "Routes");
    function K(s) {
      let {
        children: f,
        errorElement: y,
        resolve: v
      } = s;
      return /* @__PURE__ */ a.createElement(ne, {
        resolve: v,
        errorElement: y
      }, /* @__PURE__ */ a.createElement(d, null, f));
    }
    n(K, "Await");
    var I = /* @__PURE__ */ function(s) {
      return s[s.pending = 0] = "pending", s[s.success = 1] = "success", s[s.error = 2] = "error", s;
    }(I || {});
    let Y = new Promise(() => {
    });
    class ne extends a.Component {
      static {
        n(this, "AwaitErrorBoundary");
      }
      constructor(f) {
        super(f), this.state = {
          error: null
        };
      }
      static getDerivedStateFromError(f) {
        return {
          error: f
        };
      }
      componentDidCatch(f, y) {
        console.error("<Await> caught the following error during render", f, y);
      }
      render() {
        let {
          children: f,
          errorElement: y,
          resolve: v
        } = this.props, F = null, q = I.pending;
        if (!(v instanceof Promise))
          q = I.success, F = Promise.resolve(), Object.defineProperty(F, "_tracked", {
            get: /* @__PURE__ */ n(() => !0, "get")
          }), Object.defineProperty(F, "_data", {
            get: /* @__PURE__ */ n(() => v, "get")
          });
        else if (this.state.error) {
          q = I.error;
          let W = this.state.error;
          F = Promise.reject().catch(() => {
          }), Object.defineProperty(F, "_tracked", {
            get: /* @__PURE__ */ n(() => !0, "get")
          }), Object.defineProperty(F, "_error", {
            get: /* @__PURE__ */ n(() => W, "get")
          });
        } else v._tracked ? (F = v, q = F._error !== void 0 ? I.error : F._data !== void 0 ? I.success : I.pending) : (q = I.pending, Object.
        defineProperty(v, "_tracked", {
          get: /* @__PURE__ */ n(() => !0, "get")
        }), F = v.then((W) => Object.defineProperty(v, "_data", {
          get: /* @__PURE__ */ n(() => W, "get")
        }), (W) => Object.defineProperty(v, "_error", {
          get: /* @__PURE__ */ n(() => W, "get")
        })));
        if (q === I.error && F._error instanceof t.AbortedDeferredError)
          throw Y;
        if (q === I.error && !y)
          throw F._error;
        if (q === I.error)
          return /* @__PURE__ */ a.createElement(g.Provider, {
            value: F,
            children: y
          });
        if (q === I.success)
          return /* @__PURE__ */ a.createElement(g.Provider, {
            value: F,
            children: f
          });
        throw F;
      }
    }
    function d(s) {
      let {
        children: f
      } = s, y = O(), v = typeof f == "function" ? f(y) : f;
      return /* @__PURE__ */ a.createElement(a.Fragment, null, v);
    }
    n(d, "ResolveAwait");
    function h(s, f) {
      f === void 0 && (f = []);
      let y = [];
      return a.Children.forEach(s, (v, F) => {
        if (!/* @__PURE__ */ a.isValidElement(v))
          return;
        let q = [...f, F];
        if (v.type === a.Fragment) {
          y.push.apply(y, h(v.props.children, q));
          return;
        }
        v.type !== E && t.UNSAFE_invariant(!1, "[" + (typeof v.type == "string" ? v.type : v.type.name) + "] is not a <Route> component. All\
 component children of <Routes> must be a <Route> or <React.Fragment>"), !v.props.index || !v.props.children || t.UNSAFE_invariant(!1, "An i\
ndex route cannot have child routes.");
        let W = {
          id: v.props.id || q.join("-"),
          caseSensitive: v.props.caseSensitive,
          element: v.props.element,
          Component: v.props.Component,
          index: v.props.index,
          path: v.props.path,
          loader: v.props.loader,
          action: v.props.action,
          errorElement: v.props.errorElement,
          ErrorBoundary: v.props.ErrorBoundary,
          hasErrorBoundary: v.props.ErrorBoundary != null || v.props.errorElement != null,
          shouldRevalidate: v.props.shouldRevalidate,
          handle: v.props.handle,
          lazy: v.props.lazy
        };
        v.props.children && (W.children = h(v.props.children, q)), y.push(W);
      }), y;
    }
    n(h, "createRoutesFromChildren");
    function S(s) {
      return Fe(s);
    }
    n(S, "renderMatches");
    function T(s) {
      let f = {
        // Note: this check also occurs in createRoutesFromChildren so update
        // there if you change this -- please and thank you!
        hasErrorBoundary: s.ErrorBoundary != null || s.errorElement != null
      };
      return s.Component && (s.element && t.UNSAFE_warning(!1, "You should not include both `Component` and `element` on your route - `Compo\
nent` will be used."), Object.assign(f, {
        element: /* @__PURE__ */ a.createElement(s.Component),
        Component: void 0
      })), s.ErrorBoundary && (s.errorElement && t.UNSAFE_warning(!1, "You should not include both `ErrorBoundary` and `errorElement` on you\
r route - `ErrorBoundary` will be used."), Object.assign(f, {
        errorElement: /* @__PURE__ */ a.createElement(s.ErrorBoundary),
        ErrorBoundary: void 0
      })), f;
    }
    n(T, "mapRouteProperties");
    function te(s, f) {
      return t.createRouter({
        basename: f?.basename,
        future: i({}, f?.future, {
          v7_prependBasename: !0
        }),
        history: t.createMemoryHistory({
          initialEntries: f?.initialEntries,
          initialIndex: f?.initialIndex
        }),
        hydrationData: f?.hydrationData,
        routes: s,
        mapRouteProperties: T
      }).initialize();
    }
    n(te, "createMemoryRouter"), Object.defineProperty(e, "AbortedDeferredError", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.AbortedDeferredError;
      }, "get")
    }), Object.defineProperty(e, "NavigationType", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.Action;
      }, "get")
    }), Object.defineProperty(e, "createPath", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.createPath;
      }, "get")
    }), Object.defineProperty(e, "defer", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.defer;
      }, "get")
    }), Object.defineProperty(e, "generatePath", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.generatePath;
      }, "get")
    }), Object.defineProperty(e, "isRouteErrorResponse", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.isRouteErrorResponse;
      }, "get")
    }), Object.defineProperty(e, "json", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.json;
      }, "get")
    }), Object.defineProperty(e, "matchPath", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.matchPath;
      }, "get")
    }), Object.defineProperty(e, "matchRoutes", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.matchRoutes;
      }, "get")
    }), Object.defineProperty(e, "parsePath", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.parsePath;
      }, "get")
    }), Object.defineProperty(e, "redirect", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.redirect;
      }, "get")
    }), Object.defineProperty(e, "redirectDocument", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.redirectDocument;
      }, "get")
    }), Object.defineProperty(e, "resolvePath", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.resolvePath;
      }, "get")
    }), e.Await = K, e.MemoryRouter = De, e.Navigate = ot, e.Outlet = Qe, e.Route = E, e.Router = j, e.RouterProvider = ge, e.Routes = H, e.
    UNSAFE_DataRouterContext = l, e.UNSAFE_DataRouterStateContext = b, e.UNSAFE_LocationContext = w, e.UNSAFE_NavigationContext = R, e.UNSAFE_RouteContext =
    x, e.UNSAFE_mapRouteProperties = T, e.UNSAFE_useRouteId = C, e.UNSAFE_useRoutesImpl = oe, e.createMemoryRouter = te, e.createRoutesFromChildren =
    h, e.createRoutesFromElements = h, e.renderMatches = S, e.unstable_useBlocker = $, e.useActionData = p, e.useAsyncError = U, e.useAsyncValue =
    O, e.useHref = _, e.useInRouterContext = N, e.useLoaderData = u, e.useLocation = L, e.useMatch = Q, e.useMatches = B, e.useNavigate = m,
    e.useNavigation = D, e.useNavigationType = A, e.useOutlet = Se, e.useOutletContext = ae, e.useParams = Pe, e.useResolvedPath = xe, e.useRevalidator =
    z, e.useRouteError = P, e.useRouteLoaderData = c, e.useRoutes = Ae, Object.defineProperty(e, "__esModule", { value: !0 });
  });
});

// ../node_modules/react-router/dist/main.js
var xr = He((ll, Pr) => {
  "use strict";
  process.env.NODE_ENV === "production" ? Pr.exports = ca() : Pr.exports = da();
});

// ../node_modules/react-router-dom/dist/umd/react-router-dom.production.min.js
var ma = He((Xt, ha) => {
  (function(e, r) {
    typeof Xt == "object" && typeof ha < "u" ? r(Xt, require("react"), xr(), Tt()) : typeof define == "function" && define.amd ? define(["ex\
ports", "react", "react-router", "@remix-run/router"], r) : r((e = typeof globalThis < "u" ? globalThis : e || self).ReactRouterDOM = {}, e.
    React, e.ReactRouter, e.RemixRouter);
  })(Xt, function(e, r, t, o) {
    "use strict";
    function a(C) {
      if (C && C.__esModule) return C;
      var D = /* @__PURE__ */ Object.create(null);
      return C && Object.keys(C).forEach(function(z) {
        if (z !== "default") {
          var B = Object.getOwnPropertyDescriptor(C, z);
          Object.defineProperty(D, z, B.get ? B : { enumerable: !0, get: /* @__PURE__ */ n(function() {
            return C[z];
          }, "get") });
        }
      }), D.default = C, Object.freeze(D);
    }
    n(a, "o");
    var i = a(r);
    function l() {
      return l = Object.assign ? Object.assign.bind() : function(C) {
        for (var D = 1; D < arguments.length; D++) {
          var z = arguments[D];
          for (var B in z) Object.prototype.hasOwnProperty.call(z, B) && (C[B] = z[B]);
        }
        return C;
      }, l.apply(this, arguments);
    }
    n(l, "u");
    function b(C, D) {
      if (C == null) return {};
      var z, B, u = {}, c = Object.keys(C);
      for (B = 0; B < c.length; B++) z = c[B], D.indexOf(z) >= 0 || (u[z] = C[z]);
      return u;
    }
    n(b, "i");
    let g = "get", R = "application/x-www-form-urlencoded";
    function w(C) {
      return C != null && typeof C.tagName == "string";
    }
    n(w, "l");
    function x(C) {
      return C === void 0 && (C = ""), new URLSearchParams(typeof C == "string" || Array.isArray(C) || C instanceof URLSearchParams ? C : Object.
      keys(C).reduce((D, z) => {
        let B = C[z];
        return D.concat(Array.isArray(B) ? B.map((u) => [z, u]) : [[z, B]]);
      }, []));
    }
    n(x, "f");
    let M = null, _ = /* @__PURE__ */ new Set(["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"]);
    function N(C) {
      return C == null || _.has(C) ? C : null;
    }
    n(N, "b");
    function L(C, D) {
      let z, B, u, c, p;
      if (w(P = C) && P.tagName.toLowerCase() === "form") {
        let O = C.getAttribute("action");
        B = O ? o.stripBasename(O, D) : null, z = C.getAttribute("method") || g, u = N(C.getAttribute("enctype")) || R, c = new FormData(C);
      } else if (function(O) {
        return w(O) && O.tagName.toLowerCase() === "button";
      }(C) || function(O) {
        return w(O) && O.tagName.toLowerCase() === "input";
      }(C) && (C.type === "submit" || C.type === "image")) {
        let O = C.form;
        if (O == null) throw new Error('Cannot submit a <button> or <input type="submit"> without a <form>');
        let U = C.getAttribute("formaction") || O.getAttribute("action");
        if (B = U ? o.stripBasename(U, D) : null, z = C.getAttribute("formmethod") || O.getAttribute("method") || g, u = N(C.getAttribute("f\
ormenctype")) || N(O.getAttribute("enctype")) || R, c = new FormData(O, C), !function() {
          if (M === null) try {
            new FormData(document.createElement("form"), 0), M = !1;
          } catch {
            M = !0;
          }
          return M;
        }()) {
          let { name: k, type: $, value: J } = C;
          if ($ === "image") {
            let re = k ? k + "." : "";
            c.append(re + "x", "0"), c.append(re + "y", "0");
          } else k && c.append(k, J);
        }
      } else {
        if (w(C)) throw new Error('Cannot submit element that is not <form>, <button>, or <input type="submit|image">');
        z = g, B = null, u = R, p = C;
      }
      var P;
      return c && u === "text/plain" && (p = c, c = void 0), { action: B, method: z.toLowerCase(), encType: u, formData: c, body: p };
    }
    n(L, "p");
    let A = ["onClick", "relative", "reloadDocument", "replace", "state", "target", "to", "preventScrollReset"], Q = ["aria-current", "caseS\
ensitive", "className", "end", "style", "to", "children"], Z = ["reloadDocument", "replace", "state", "method", "action", "onSubmit", "submi\
t", "relative", "preventScrollReset"];
    function V() {
      var C;
      let D = (C = window) == null ? void 0 : C.__staticRouterHydrationData;
      return D && D.errors && (D = l({}, D, { errors: m(D.errors) })), D;
    }
    n(V, "v");
    function m(C) {
      if (!C) return null;
      let D = Object.entries(C), z = {};
      for (let [B, u] of D) if (u && u.__type === "RouteErrorResponse") z[B] = new o.ErrorResponse(u.status, u.statusText, u.data, u.internal ===
      !0);
      else if (u && u.__type === "Error") {
        if (u.__subType) {
          let c = window[u.__subType];
          if (typeof c == "function") try {
            let p = new c(u.message);
            p.stack = "", z[B] = p;
          } catch {
          }
        }
        if (z[B] == null) {
          let c = new Error(u.message);
          c.stack = "", z[B] = c;
        }
      } else z[B] = u;
      return z;
    }
    n(m, "R");
    let ee = i.startTransition, de = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, ae = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i,
    Se = i.forwardRef(function(C, D) {
      let z, { onClick: B, relative: u, reloadDocument: c, replace: p, state: P, target: O, to: U, preventScrollReset: k } = C, $ = b(C, A),
      { basename: J } = i.useContext(t.UNSAFE_NavigationContext), re = !1;
      if (typeof U == "string" && ae.test(U) && (z = U, de)) try {
        let se = new URL(window.location.href), ge = U.startsWith("//") ? new URL(se.protocol + U) : new URL(U), Oe = o.stripBasename(ge.pathname,
        J);
        ge.origin === se.origin && Oe != null ? U = Oe + ge.search + ge.hash : re = !0;
      } catch {
      }
      let ie = t.useHref(U, { relative: u }), le = ce(U, { replace: p, state: P, target: O, preventScrollReset: k, relative: u });
      return i.createElement("a", l({}, $, { href: z || ie, onClick: re || c ? B : function(se) {
        B && B(se), se.defaultPrevented || le(se);
      }, ref: D, target: O }));
    }), Pe = i.forwardRef(function(C, D) {
      let { "aria-current": z = "page", caseSensitive: B = !1, className: u = "", end: c = !1, style: p, to: P, children: O } = C, U = b(C, Q),
      k = t.useResolvedPath(P, { relative: U.relative }), $ = t.useLocation(), J = i.useContext(t.UNSAFE_DataRouterStateContext), { navigator: re } = i.
      useContext(t.UNSAFE_NavigationContext), ie = re.encodeLocation ? re.encodeLocation(k).pathname : k.pathname, le = $.pathname, se = J &&
      J.navigation && J.navigation.location ? J.navigation.location.pathname : null;
      B || (le = le.toLowerCase(), se = se ? se.toLowerCase() : null, ie = ie.toLowerCase());
      let ge, Oe = le === ie || !c && le.startsWith(ie) && le.charAt(ie.length) === "/", De = se != null && (se === ie || !c && se.startsWith(
      ie) && se.charAt(ie.length) === "/"), ot = Oe ? z : void 0;
      ge = typeof u == "function" ? u({ isActive: Oe, isPending: De }) : [u, Oe ? "active" : null, De ? "pending" : null].filter(Boolean).join(
      " ");
      let Qe = typeof p == "function" ? p({ isActive: Oe, isPending: De }) : p;
      return i.createElement(Se, l({}, U, { "aria-current": ot, className: ge, ref: D, style: Qe, to: P }), typeof O == "function" ? O({ isActive: Oe,
      isPending: De }) : O);
    }), xe = i.forwardRef((C, D) => {
      let z = Ce();
      return i.createElement(Ae, l({}, C, { submit: z, ref: D }));
    }), Ae = i.forwardRef((C, D) => {
      let { reloadDocument: z, replace: B, state: u, method: c = g, action: p, onSubmit: P, submit: O, relative: U, preventScrollReset: k } = C,
      $ = b(C, Z), J = c.toLowerCase() === "get" ? "get" : "post", re = Ke(p, { relative: U });
      return i.createElement("form", l({ ref: D, method: J, action: re, onSubmit: z ? P : (ie) => {
        if (P && P(ie), ie.defaultPrevented) return;
        ie.preventDefault();
        let le = ie.nativeEvent.submitter, se = le?.getAttribute("formmethod") || c;
        O(le || ie.currentTarget, { method: se, replace: B, state: u, relative: U, preventScrollReset: k });
      } }, $));
    });
    var oe = function(C) {
      return C.UseScrollRestoration = "useScrollRestoration", C.UseSubmit = "useSubmit", C.UseSubmitFetcher = "useSubmitFetcher", C.UseFetcher =
      "useFetcher", C;
    }(oe || {}), Ue = function(C) {
      return C.UseFetchers = "useFetchers", C.UseScrollRestoration = "useScrollRestoration", C;
    }(Ue || {});
    function Ee(C) {
      let D = i.useContext(t.UNSAFE_DataRouterContext);
      return D || o.UNSAFE_invariant(!1), D;
    }
    n(Ee, "_");
    function we(C) {
      let D = i.useContext(t.UNSAFE_DataRouterStateContext);
      return D || o.UNSAFE_invariant(!1), D;
    }
    n(we, "F");
    function ce(C, D) {
      let { target: z, replace: B, state: u, preventScrollReset: c, relative: p } = D === void 0 ? {} : D, P = t.useNavigate(), O = t.useLocation(),
      U = t.useResolvedPath(C, { relative: p });
      return i.useCallback((k) => {
        if (function($, J) {
          return !($.button !== 0 || J && J !== "_self" || function(re) {
            return !!(re.metaKey || re.altKey || re.ctrlKey || re.shiftKey);
          }($));
        }(k, z)) {
          k.preventDefault();
          let $ = B !== void 0 ? B : t.createPath(O) === t.createPath(U);
          P(C, { replace: $, state: u, preventScrollReset: c, relative: p });
        }
      }, [O, P, U, B, u, z, C, c, p]);
    }
    n(ce, "U");
    function Fe() {
      if (typeof document > "u") throw new Error("You are calling submit during the server render. Try calling submit within a `useEffect` o\
r callback instead.");
    }
    n(Fe, "x");
    function Ce() {
      let { router: C } = Ee(oe.UseSubmit), { basename: D } = i.useContext(t.UNSAFE_NavigationContext), z = t.UNSAFE_useRouteId();
      return i.useCallback(function(B, u) {
        u === void 0 && (u = {}), Fe();
        let { action: c, method: p, encType: P, formData: O, body: U } = L(B, D);
        C.navigate(u.action || c, { preventScrollReset: u.preventScrollReset, formData: O, body: U, formMethod: u.method || p, formEncType: u.
        encType || P, replace: u.replace, state: u.state, fromRouteId: z });
      }, [C, D, z]);
    }
    n(Ce, "L");
    function ve(C, D) {
      let { router: z } = Ee(oe.UseSubmitFetcher), { basename: B } = i.useContext(t.UNSAFE_NavigationContext);
      return i.useCallback(function(u, c) {
        c === void 0 && (c = {}), Fe();
        let { action: p, method: P, encType: O, formData: U, body: k } = L(u, B);
        D == null && o.UNSAFE_invariant(!1), z.fetch(C, D, c.action || p, { preventScrollReset: c.preventScrollReset, formData: U, body: k, formMethod: c.
        method || P, formEncType: c.encType || O });
      }, [z, B, C, D]);
    }
    n(ve, "D");
    function Ke(C, D) {
      let { relative: z } = D === void 0 ? {} : D, { basename: B } = i.useContext(t.UNSAFE_NavigationContext), u = i.useContext(t.UNSAFE_RouteContext);
      u || o.UNSAFE_invariant(!1);
      let [c] = u.matches.slice(-1), p = l({}, t.useResolvedPath(C || ".", { relative: z })), P = t.useLocation();
      if (C == null && (p.search = P.search, c.route.index)) {
        let O = new URLSearchParams(p.search);
        O.delete("index"), p.search = O.toString() ? "?" + O.toString() : "";
      }
      return C && C !== "." || !c.route.index || (p.search = p.search ? p.search.replace(/^\?/, "?index&") : "?index"), B !== "/" && (p.pathname =
      p.pathname === "/" ? B : o.joinPaths([B, p.pathname])), t.createPath(p);
    }
    n(Ke, "T");
    let qe = 0, Be = "react-router-scroll-positions", je = {};
    function pe(C) {
      let { getKey: D, storageKey: z } = C === void 0 ? {} : C, { router: B } = Ee(oe.UseScrollRestoration), { restoreScrollPosition: u, preventScrollReset: c } = we(
      Ue.UseScrollRestoration), { basename: p } = i.useContext(t.UNSAFE_NavigationContext), P = t.useLocation(), O = t.useMatches(), U = t.useNavigation();
      i.useEffect(() => (window.history.scrollRestoration = "manual", () => {
        window.history.scrollRestoration = "auto";
      }), []), function(k, $) {
        let { capture: J } = $ || {};
        i.useEffect(() => {
          let re = J != null ? { capture: J } : void 0;
          return window.addEventListener("pagehide", k, re), () => {
            window.removeEventListener("pagehide", k, re);
          };
        }, [k, J]);
      }(i.useCallback(() => {
        if (U.state === "idle") {
          let k = (D ? D(P, O) : null) || P.key;
          je[k] = window.scrollY;
        }
        sessionStorage.setItem(z || Be, JSON.stringify(je)), window.history.scrollRestoration = "auto";
      }, [z, D, U.state, P, O])), typeof document < "u" && (i.useLayoutEffect(() => {
        try {
          let k = sessionStorage.getItem(z || Be);
          k && (je = JSON.parse(k));
        } catch {
        }
      }, [z]), i.useLayoutEffect(() => {
        let k = D && p !== "/" ? (J, re) => D(l({}, J, { pathname: o.stripBasename(J.pathname, p) || J.pathname }), re) : D, $ = B?.enableScrollRestoration(
        je, () => window.scrollY, k);
        return () => $ && $();
      }, [B, p, D]), i.useLayoutEffect(() => {
        if (u !== !1) if (typeof u != "number") {
          if (P.hash) {
            let k = document.getElementById(decodeURIComponent(P.hash.slice(1)));
            if (k) return void k.scrollIntoView();
          }
          c !== !0 && window.scrollTo(0, 0);
        } else window.scrollTo(0, u);
      }, [P, u, c]));
    }
    n(pe, "H"), Object.defineProperty(e, "AbortedDeferredError", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.AbortedDeferredError;
    }, "get") }), Object.defineProperty(e, "Await", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.Await;
    }, "get") }), Object.defineProperty(e, "MemoryRouter", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.MemoryRouter;
    }, "get") }), Object.defineProperty(e, "Navigate", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.Navigate;
    }, "get") }), Object.defineProperty(e, "NavigationType", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.NavigationType;
    }, "get") }), Object.defineProperty(e, "Outlet", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.Outlet;
    }, "get") }), Object.defineProperty(e, "Route", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.Route;
    }, "get") }), Object.defineProperty(e, "Router", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.Router;
    }, "get") }), Object.defineProperty(e, "RouterProvider", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.RouterProvider;
    }, "get") }), Object.defineProperty(e, "Routes", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.Routes;
    }, "get") }), Object.defineProperty(e, "UNSAFE_DataRouterContext", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.UNSAFE_DataRouterContext;
    }, "get") }), Object.defineProperty(e, "UNSAFE_DataRouterStateContext", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.UNSAFE_DataRouterStateContext;
    }, "get") }), Object.defineProperty(e, "UNSAFE_LocationContext", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.UNSAFE_LocationContext;
    }, "get") }), Object.defineProperty(e, "UNSAFE_NavigationContext", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.UNSAFE_NavigationContext;
    }, "get") }), Object.defineProperty(e, "UNSAFE_RouteContext", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.UNSAFE_RouteContext;
    }, "get") }), Object.defineProperty(e, "UNSAFE_useRouteId", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.UNSAFE_useRouteId;
    }, "get") }), Object.defineProperty(e, "createMemoryRouter", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.createMemoryRouter;
    }, "get") }), Object.defineProperty(e, "createPath", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.createPath;
    }, "get") }), Object.defineProperty(e, "createRoutesFromChildren", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.createRoutesFromChildren;
    }, "get") }), Object.defineProperty(e, "createRoutesFromElements", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.createRoutesFromElements;
    }, "get") }), Object.defineProperty(e, "defer", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.defer;
    }, "get") }), Object.defineProperty(e, "generatePath", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.generatePath;
    }, "get") }), Object.defineProperty(e, "isRouteErrorResponse", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.isRouteErrorResponse;
    }, "get") }), Object.defineProperty(e, "json", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.json;
    }, "get") }), Object.defineProperty(e, "matchPath", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.matchPath;
    }, "get") }), Object.defineProperty(e, "matchRoutes", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.matchRoutes;
    }, "get") }), Object.defineProperty(e, "parsePath", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.parsePath;
    }, "get") }), Object.defineProperty(e, "redirect", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.redirect;
    }, "get") }), Object.defineProperty(e, "redirectDocument", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.redirectDocument;
    }, "get") }), Object.defineProperty(e, "renderMatches", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.renderMatches;
    }, "get") }), Object.defineProperty(e, "resolvePath", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.resolvePath;
    }, "get") }), Object.defineProperty(e, "unstable_useBlocker", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.unstable_useBlocker;
    }, "get") }), Object.defineProperty(e, "useActionData", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useActionData;
    }, "get") }), Object.defineProperty(e, "useAsyncError", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useAsyncError;
    }, "get") }), Object.defineProperty(e, "useAsyncValue", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useAsyncValue;
    }, "get") }), Object.defineProperty(e, "useHref", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useHref;
    }, "get") }), Object.defineProperty(e, "useInRouterContext", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useInRouterContext;
    }, "get") }), Object.defineProperty(e, "useLoaderData", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useLoaderData;
    }, "get") }), Object.defineProperty(e, "useLocation", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useLocation;
    }, "get") }), Object.defineProperty(e, "useMatch", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useMatch;
    }, "get") }), Object.defineProperty(e, "useMatches", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useMatches;
    }, "get") }), Object.defineProperty(e, "useNavigate", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useNavigate;
    }, "get") }), Object.defineProperty(e, "useNavigation", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useNavigation;
    }, "get") }), Object.defineProperty(e, "useNavigationType", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useNavigationType;
    }, "get") }), Object.defineProperty(e, "useOutlet", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useOutlet;
    }, "get") }), Object.defineProperty(e, "useOutletContext", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useOutletContext;
    }, "get") }), Object.defineProperty(e, "useParams", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useParams;
    }, "get") }), Object.defineProperty(e, "useResolvedPath", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useResolvedPath;
    }, "get") }), Object.defineProperty(e, "useRevalidator", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useRevalidator;
    }, "get") }), Object.defineProperty(e, "useRouteError", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useRouteError;
    }, "get") }), Object.defineProperty(e, "useRouteLoaderData", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useRouteLoaderData;
    }, "get") }), Object.defineProperty(e, "useRoutes", { enumerable: !0, get: /* @__PURE__ */ n(function() {
      return t.useRoutes;
    }, "get") }), e.BrowserRouter = function(C) {
      let { basename: D, children: z, future: B, window: u } = C, c = i.useRef();
      c.current == null && (c.current = o.createBrowserHistory({ window: u, v5Compat: !0 }));
      let p = c.current, [P, O] = i.useState({ action: p.action, location: p.location }), { v7_startTransition: U } = B || {}, k = i.useCallback(
      ($) => {
        U && ee ? ee(() => O($)) : O($);
      }, [O, U]);
      return i.useLayoutEffect(() => p.listen(k), [p, k]), i.createElement(t.Router, { basename: D, children: z, location: P.location, navigationType: P.
      action, navigator: p });
    }, e.Form = xe, e.HashRouter = function(C) {
      let { basename: D, children: z, future: B, window: u } = C, c = i.useRef();
      c.current == null && (c.current = o.createHashHistory({ window: u, v5Compat: !0 }));
      let p = c.current, [P, O] = i.useState({ action: p.action, location: p.location }), { v7_startTransition: U } = B || {}, k = i.useCallback(
      ($) => {
        U && ee ? ee(() => O($)) : O($);
      }, [O, U]);
      return i.useLayoutEffect(() => p.listen(k), [p, k]), i.createElement(t.Router, { basename: D, children: z, location: P.location, navigationType: P.
      action, navigator: p });
    }, e.Link = Se, e.NavLink = Pe, e.ScrollRestoration = function(C) {
      let { getKey: D, storageKey: z } = C;
      return pe({ getKey: D, storageKey: z }), null;
    }, e.UNSAFE_useScrollRestoration = pe, e.createBrowserRouter = function(C, D) {
      return o.createRouter({ basename: D?.basename, future: l({}, D?.future, { v7_prependBasename: !0 }), history: o.createBrowserHistory({
      window: D?.window }), hydrationData: D?.hydrationData || V(), routes: C, mapRouteProperties: t.UNSAFE_mapRouteProperties }).initialize();
    }, e.createHashRouter = function(C, D) {
      return o.createRouter({ basename: D?.basename, future: l({}, D?.future, { v7_prependBasename: !0 }), history: o.createHashHistory({ window: D?.
      window }), hydrationData: D?.hydrationData || V(), routes: C, mapRouteProperties: t.UNSAFE_mapRouteProperties }).initialize();
    }, e.createSearchParams = x, e.unstable_HistoryRouter = function(C) {
      let { basename: D, children: z, future: B, history: u } = C, [c, p] = i.useState({ action: u.action, location: u.location }), { v7_startTransition: P } = B ||
      {}, O = i.useCallback((U) => {
        P && ee ? ee(() => p(U)) : p(U);
      }, [p, P]);
      return i.useLayoutEffect(() => u.listen(O), [u, O]), i.createElement(t.Router, { basename: D, children: z, location: c.location, navigationType: c.
      action, navigator: u });
    }, e.unstable_usePrompt = function(C) {
      let { when: D, message: z } = C, B = t.unstable_useBlocker(D);
      i.useEffect(() => {
        B.state === "blocked" && (window.confirm(z) ? setTimeout(B.proceed, 0) : B.reset());
      }, [B, z]), i.useEffect(() => {
        B.state !== "blocked" || D || B.reset();
      }, [B, D]);
    }, e.useBeforeUnload = function(C, D) {
      let { capture: z } = D || {};
      i.useEffect(() => {
        let B = z != null ? { capture: z } : void 0;
        return window.addEventListener("beforeunload", C, B), () => {
          window.removeEventListener("beforeunload", C, B);
        };
      }, [C, z]);
    }, e.useFetcher = function() {
      var C;
      let { router: D } = Ee(oe.UseFetcher), z = i.useContext(t.UNSAFE_RouteContext);
      z || o.UNSAFE_invariant(!1);
      let B = (C = z.matches[z.matches.length - 1]) == null ? void 0 : C.route.id;
      B == null && o.UNSAFE_invariant(!1);
      let [u] = i.useState(() => String(++qe)), [c] = i.useState(() => (B || o.UNSAFE_invariant(!1), function(k, $) {
        return i.forwardRef((J, re) => {
          let ie = ve(k, $);
          return i.createElement(Ae, l({}, J, { ref: re, submit: ie }));
        });
      }(u, B))), [p] = i.useState(() => (k) => {
        D || o.UNSAFE_invariant(!1), B || o.UNSAFE_invariant(!1), D.fetch(u, B, k);
      }), P = ve(u, B), O = D.getFetcher(u), U = i.useMemo(() => l({ Form: c, submit: P, load: p }, O), [O, c, P, p]);
      return i.useEffect(() => () => {
        D ? D.deleteFetcher(u) : console.warn("No router available to clean up from useFetcher()");
      }, [D, u]), U;
    }, e.useFetchers = function() {
      return [...we(Ue.UseFetchers).fetchers.values()];
    }, e.useFormAction = Ke, e.useLinkClickHandler = ce, e.useSearchParams = function(C) {
      let D = i.useRef(x(C)), z = i.useRef(!1), B = t.useLocation(), u = i.useMemo(() => function(P, O) {
        let U = x(P);
        return O && O.forEach((k, $) => {
          U.has($) || O.getAll($).forEach((J) => {
            U.append($, J);
          });
        }), U;
      }(B.search, z.current ? null : D.current), [B.search]), c = t.useNavigate(), p = i.useCallback((P, O) => {
        let U = x(typeof P == "function" ? P(u) : P);
        z.current = !0, c("?" + U, O);
      }, [c, u]);
      return [u, p];
    }, e.useSubmit = Ce, Object.defineProperty(e, "__esModule", { value: !0 });
  });
});

// ../node_modules/react-router-dom/dist/umd/react-router-dom.development.js
var ga = He((Gt, pa) => {
  (function(e, r) {
    typeof Gt == "object" && typeof pa < "u" ? r(Gt, require("react"), xr(), Tt()) : typeof define == "function" && define.amd ? define(["ex\
ports", "react", "react-router", "@remix-run/router"], r) : (e = typeof globalThis < "u" ? globalThis : e || self, r(e.ReactRouterDOM = {}, e.
    React, e.ReactRouter, e.RemixRouter));
  })(Gt, function(e, r, t, o) {
    "use strict";
    function a(E) {
      if (E && E.__esModule) return E;
      var j = /* @__PURE__ */ Object.create(null);
      return E && Object.keys(E).forEach(function(H) {
        if (H !== "default") {
          var K = Object.getOwnPropertyDescriptor(E, H);
          Object.defineProperty(j, H, K.get ? K : {
            enumerable: !0,
            get: /* @__PURE__ */ n(function() {
              return E[H];
            }, "get")
          });
        }
      }), j.default = E, Object.freeze(j);
    }
    n(a, "_interopNamespace");
    var i = /* @__PURE__ */ a(r);
    function l() {
      return l = Object.assign ? Object.assign.bind() : function(E) {
        for (var j = 1; j < arguments.length; j++) {
          var H = arguments[j];
          for (var K in H)
            Object.prototype.hasOwnProperty.call(H, K) && (E[K] = H[K]);
        }
        return E;
      }, l.apply(this, arguments);
    }
    n(l, "_extends");
    function b(E, j) {
      if (E == null) return {};
      var H = {}, K = Object.keys(E), I, Y;
      for (Y = 0; Y < K.length; Y++)
        I = K[Y], !(j.indexOf(I) >= 0) && (H[I] = E[I]);
      return H;
    }
    n(b, "_objectWithoutPropertiesLoose");
    let g = "get", R = "application/x-www-form-urlencoded";
    function w(E) {
      return E != null && typeof E.tagName == "string";
    }
    n(w, "isHtmlElement");
    function x(E) {
      return w(E) && E.tagName.toLowerCase() === "button";
    }
    n(x, "isButtonElement");
    function M(E) {
      return w(E) && E.tagName.toLowerCase() === "form";
    }
    n(M, "isFormElement");
    function _(E) {
      return w(E) && E.tagName.toLowerCase() === "input";
    }
    n(_, "isInputElement");
    function N(E) {
      return !!(E.metaKey || E.altKey || E.ctrlKey || E.shiftKey);
    }
    n(N, "isModifiedEvent");
    function L(E, j) {
      return E.button === 0 && // Ignore everything but left clicks
      (!j || j === "_self") && // Let browser handle "target=_blank" etc.
      !N(E);
    }
    n(L, "shouldProcessLinkClick");
    function A(E) {
      return E === void 0 && (E = ""), new URLSearchParams(typeof E == "string" || Array.isArray(E) || E instanceof URLSearchParams ? E : Object.
      keys(E).reduce((j, H) => {
        let K = E[H];
        return j.concat(Array.isArray(K) ? K.map((I) => [H, I]) : [[H, K]]);
      }, []));
    }
    n(A, "createSearchParams");
    function Q(E, j) {
      let H = A(E);
      return j && j.forEach((K, I) => {
        H.has(I) || j.getAll(I).forEach((Y) => {
          H.append(I, Y);
        });
      }), H;
    }
    n(Q, "getSearchParamsForLocation");
    let Z = null;
    function V() {
      if (Z === null)
        try {
          new FormData(
            document.createElement("form"),
            // @ts-expect-error if FormData supports the submitter parameter, this will throw
            0
          ), Z = !1;
        } catch {
          Z = !0;
        }
      return Z;
    }
    n(V, "isFormDataSubmitterSupported");
    let m = /* @__PURE__ */ new Set(["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"]);
    function ee(E) {
      return E != null && !m.has(E) ? (o.UNSAFE_warning(!1, '"' + E + '" is not a valid `encType` for `<Form>`/`<fetcher.Form>` ' + ('and wi\
ll default to "' + R + '"')), null) : E;
    }
    n(ee, "getFormEncType");
    function de(E, j) {
      let H, K, I, Y, ne;
      if (M(E)) {
        let d = E.getAttribute("action");
        K = d ? o.stripBasename(d, j) : null, H = E.getAttribute("method") || g, I = ee(E.getAttribute("enctype")) || R, Y = new FormData(E);
      } else if (x(E) || _(E) && (E.type === "submit" || E.type === "image")) {
        let d = E.form;
        if (d == null)
          throw new Error('Cannot submit a <button> or <input type="submit"> without a <form>');
        let h = E.getAttribute("formaction") || d.getAttribute("action");
        if (K = h ? o.stripBasename(h, j) : null, H = E.getAttribute("formmethod") || d.getAttribute("method") || g, I = ee(E.getAttribute("\
formenctype")) || ee(d.getAttribute("enctype")) || R, Y = new FormData(d, E), !V()) {
          let {
            name: S,
            type: T,
            value: te
          } = E;
          if (T === "image") {
            let s = S ? S + "." : "";
            Y.append(s + "x", "0"), Y.append(s + "y", "0");
          } else S && Y.append(S, te);
        }
      } else {
        if (w(E))
          throw new Error('Cannot submit element that is not <form>, <button>, or <input type="submit|image">');
        H = g, K = null, I = R, ne = E;
      }
      return Y && I === "text/plain" && (ne = Y, Y = void 0), {
        action: K,
        method: H.toLowerCase(),
        encType: I,
        formData: Y,
        body: ne
      };
    }
    n(de, "getFormSubmissionInfo");
    let ae = ["onClick", "relative", "reloadDocument", "replace", "state", "target", "to", "preventScrollReset"], Se = ["aria-current", "cas\
eSensitive", "className", "end", "style", "to", "children"], Pe = ["reloadDocument", "replace", "state", "method", "action", "onSubmit", "su\
bmit", "relative", "preventScrollReset"];
    function xe(E, j) {
      return o.createRouter({
        basename: j?.basename,
        future: l({}, j?.future, {
          v7_prependBasename: !0
        }),
        history: o.createBrowserHistory({
          window: j?.window
        }),
        hydrationData: j?.hydrationData || oe(),
        routes: E,
        mapRouteProperties: t.UNSAFE_mapRouteProperties
      }).initialize();
    }
    n(xe, "createBrowserRouter");
    function Ae(E, j) {
      return o.createRouter({
        basename: j?.basename,
        future: l({}, j?.future, {
          v7_prependBasename: !0
        }),
        history: o.createHashHistory({
          window: j?.window
        }),
        hydrationData: j?.hydrationData || oe(),
        routes: E,
        mapRouteProperties: t.UNSAFE_mapRouteProperties
      }).initialize();
    }
    n(Ae, "createHashRouter");
    function oe() {
      var E;
      let j = (E = window) == null ? void 0 : E.__staticRouterHydrationData;
      return j && j.errors && (j = l({}, j, {
        errors: Ue(j.errors)
      })), j;
    }
    n(oe, "parseHydrationData");
    function Ue(E) {
      if (!E) return null;
      let j = Object.entries(E), H = {};
      for (let [K, I] of j)
        if (I && I.__type === "RouteErrorResponse")
          H[K] = new o.ErrorResponse(I.status, I.statusText, I.data, I.internal === !0);
        else if (I && I.__type === "Error") {
          if (I.__subType) {
            let Y = window[I.__subType];
            if (typeof Y == "function")
              try {
                let ne = new Y(I.message);
                ne.stack = "", H[K] = ne;
              } catch {
              }
          }
          if (H[K] == null) {
            let Y = new Error(I.message);
            Y.stack = "", H[K] = Y;
          }
        } else
          H[K] = I;
      return H;
    }
    n(Ue, "deserializeErrors");
    let we = i["startTransition"];
    function ce(E) {
      let {
        basename: j,
        children: H,
        future: K,
        window: I
      } = E, Y = i.useRef();
      Y.current == null && (Y.current = o.createBrowserHistory({
        window: I,
        v5Compat: !0
      }));
      let ne = Y.current, [d, h] = i.useState({
        action: ne.action,
        location: ne.location
      }), {
        v7_startTransition: S
      } = K || {}, T = i.useCallback((te) => {
        S && we ? we(() => h(te)) : h(te);
      }, [h, S]);
      return i.useLayoutEffect(() => ne.listen(T), [ne, T]), /* @__PURE__ */ i.createElement(t.Router, {
        basename: j,
        children: H,
        location: d.location,
        navigationType: d.action,
        navigator: ne
      });
    }
    n(ce, "BrowserRouter");
    function Fe(E) {
      let {
        basename: j,
        children: H,
        future: K,
        window: I
      } = E, Y = i.useRef();
      Y.current == null && (Y.current = o.createHashHistory({
        window: I,
        v5Compat: !0
      }));
      let ne = Y.current, [d, h] = i.useState({
        action: ne.action,
        location: ne.location
      }), {
        v7_startTransition: S
      } = K || {}, T = i.useCallback((te) => {
        S && we ? we(() => h(te)) : h(te);
      }, [h, S]);
      return i.useLayoutEffect(() => ne.listen(T), [ne, T]), /* @__PURE__ */ i.createElement(t.Router, {
        basename: j,
        children: H,
        location: d.location,
        navigationType: d.action,
        navigator: ne
      });
    }
    n(Fe, "HashRouter");
    function Ce(E) {
      let {
        basename: j,
        children: H,
        future: K,
        history: I
      } = E, [Y, ne] = i.useState({
        action: I.action,
        location: I.location
      }), {
        v7_startTransition: d
      } = K || {}, h = i.useCallback((S) => {
        d && we ? we(() => ne(S)) : ne(S);
      }, [ne, d]);
      return i.useLayoutEffect(() => I.listen(h), [I, h]), /* @__PURE__ */ i.createElement(t.Router, {
        basename: j,
        children: H,
        location: Y.location,
        navigationType: Y.action,
        navigator: I
      });
    }
    n(Ce, "HistoryRouter"), Ce.displayName = "unstable_HistoryRouter";
    let ve = typeof window < "u" && typeof window.document < "u" && typeof window.document.createElement < "u", Ke = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i,
    qe = /* @__PURE__ */ i.forwardRef(/* @__PURE__ */ n(function(j, H) {
      let {
        onClick: K,
        relative: I,
        reloadDocument: Y,
        replace: ne,
        state: d,
        target: h,
        to: S,
        preventScrollReset: T
      } = j, te = b(j, ae), {
        basename: s
      } = i.useContext(t.UNSAFE_NavigationContext), f, y = !1;
      if (typeof S == "string" && Ke.test(S) && (f = S, ve))
        try {
          let W = new URL(window.location.href), G = S.startsWith("//") ? new URL(W.protocol + S) : new URL(S), X = o.stripBasename(G.pathname,
          s);
          G.origin === W.origin && X != null ? S = X + G.search + G.hash : y = !0;
        } catch {
          o.UNSAFE_warning(!1, '<Link to="' + S + '"> contains an invalid URL which will probably break when clicked - please update to a va\
lid URL path.');
        }
      let v = t.useHref(S, {
        relative: I
      }), F = p(S, {
        replace: ne,
        state: d,
        target: h,
        preventScrollReset: T,
        relative: I
      });
      function q(W) {
        K && K(W), W.defaultPrevented || F(W);
      }
      return n(q, "handleClick"), // eslint-disable-next-line jsx-a11y/anchor-has-content
      /* @__PURE__ */ i.createElement("a", l({}, te, {
        href: f || v,
        onClick: y || Y ? K : q,
        ref: H,
        target: h
      }));
    }, "LinkWithRef"));
    qe.displayName = "Link";
    let Be = /* @__PURE__ */ i.forwardRef(/* @__PURE__ */ n(function(j, H) {
      let {
        "aria-current": K = "page",
        caseSensitive: I = !1,
        className: Y = "",
        end: ne = !1,
        style: d,
        to: h,
        children: S
      } = j, T = b(j, Se), te = t.useResolvedPath(h, {
        relative: T.relative
      }), s = t.useLocation(), f = i.useContext(t.UNSAFE_DataRouterStateContext), {
        navigator: y
      } = i.useContext(t.UNSAFE_NavigationContext), v = y.encodeLocation ? y.encodeLocation(te).pathname : te.pathname, F = s.pathname, q = f &&
      f.navigation && f.navigation.location ? f.navigation.location.pathname : null;
      I || (F = F.toLowerCase(), q = q ? q.toLowerCase() : null, v = v.toLowerCase());
      let W = F === v || !ne && F.startsWith(v) && F.charAt(v.length) === "/", G = q != null && (q === v || !ne && q.startsWith(v) && q.charAt(
      v.length) === "/"), X = W ? K : void 0, ue;
      typeof Y == "function" ? ue = Y({
        isActive: W,
        isPending: G
      }) : ue = [Y, W ? "active" : null, G ? "pending" : null].filter(Boolean).join(" ");
      let ye = typeof d == "function" ? d({
        isActive: W,
        isPending: G
      }) : d;
      return /* @__PURE__ */ i.createElement(qe, l({}, T, {
        "aria-current": X,
        className: ue,
        ref: H,
        style: ye,
        to: h
      }), typeof S == "function" ? S({
        isActive: W,
        isPending: G
      }) : S);
    }, "NavLinkWithRef"));
    Be.displayName = "NavLink";
    let je = /* @__PURE__ */ i.forwardRef((E, j) => {
      let H = U();
      return /* @__PURE__ */ i.createElement(pe, l({}, E, {
        submit: H,
        ref: j
      }));
    });
    je.displayName = "Form";
    let pe = /* @__PURE__ */ i.forwardRef((E, j) => {
      let {
        reloadDocument: H,
        replace: K,
        state: I,
        method: Y = g,
        action: ne,
        onSubmit: d,
        submit: h,
        relative: S,
        preventScrollReset: T
      } = E, te = b(E, Pe), s = Y.toLowerCase() === "get" ? "get" : "post", f = $(ne, {
        relative: S
      }), y = /* @__PURE__ */ n((v) => {
        if (d && d(v), v.defaultPrevented) return;
        v.preventDefault();
        let F = v.nativeEvent.submitter, q = F?.getAttribute("formmethod") || Y;
        h(F || v.currentTarget, {
          method: q,
          replace: K,
          state: I,
          relative: S,
          preventScrollReset: T
        });
      }, "submitHandler");
      return /* @__PURE__ */ i.createElement("form", l({
        ref: j,
        method: s,
        action: f,
        onSubmit: H ? d : y
      }, te));
    });
    pe.displayName = "FormImpl";
    function C(E) {
      let {
        getKey: j,
        storageKey: H
      } = E;
      return Oe({
        getKey: j,
        storageKey: H
      }), null;
    }
    n(C, "ScrollRestoration"), C.displayName = "ScrollRestoration";
    var D = /* @__PURE__ */ function(E) {
      return E.UseScrollRestoration = "useScrollRestoration", E.UseSubmit = "useSubmit", E.UseSubmitFetcher = "useSubmitFetcher", E.UseFetcher =
      "useFetcher", E;
    }(D || {}), z = /* @__PURE__ */ function(E) {
      return E.UseFetchers = "useFetchers", E.UseScrollRestoration = "useScrollRestoration", E;
    }(z || {});
    function B(E) {
      return E + " must be used within a data router.  See https://reactrouter.com/routers/picking-a-router.";
    }
    n(B, "getDataRouterConsoleError");
    function u(E) {
      let j = i.useContext(t.UNSAFE_DataRouterContext);
      return j || o.UNSAFE_invariant(!1, B(E)), j;
    }
    n(u, "useDataRouterContext");
    function c(E) {
      let j = i.useContext(t.UNSAFE_DataRouterStateContext);
      return j || o.UNSAFE_invariant(!1, B(E)), j;
    }
    n(c, "useDataRouterState");
    function p(E, j) {
      let {
        target: H,
        replace: K,
        state: I,
        preventScrollReset: Y,
        relative: ne
      } = j === void 0 ? {} : j, d = t.useNavigate(), h = t.useLocation(), S = t.useResolvedPath(E, {
        relative: ne
      });
      return i.useCallback((T) => {
        if (L(T, H)) {
          T.preventDefault();
          let te = K !== void 0 ? K : t.createPath(h) === t.createPath(S);
          d(E, {
            replace: te,
            state: I,
            preventScrollReset: Y,
            relative: ne
          });
        }
      }, [h, d, S, K, I, H, E, Y, ne]);
    }
    n(p, "useLinkClickHandler");
    function P(E) {
      o.UNSAFE_warning(typeof URLSearchParams < "u", "You cannot use the `useSearchParams` hook in a browser that does not support the URLSe\
archParams API. If you need to support Internet Explorer 11, we recommend you load a polyfill such as https://github.com/ungap/url-search-pa\
rams\n\nIf you're unsure how to load polyfills, we recommend you check out https://polyfill.io/v3/ which provides some recommendations about h\
ow to load polyfills only for users that need them, instead of for every user.");
      let j = i.useRef(A(E)), H = i.useRef(!1), K = t.useLocation(), I = i.useMemo(() => (
        // Only merge in the defaults if we haven't yet called setSearchParams.
        // Once we call that we want those to take precedence, otherwise you can't
        // remove a param with setSearchParams({}) if it has an initial value
        Q(K.search, H.current ? null : j.current)
      ), [K.search]), Y = t.useNavigate(), ne = i.useCallback((d, h) => {
        let S = A(typeof d == "function" ? d(I) : d);
        H.current = !0, Y("?" + S, h);
      }, [Y, I]);
      return [I, ne];
    }
    n(P, "useSearchParams");
    function O() {
      if (typeof document > "u")
        throw new Error("You are calling submit during the server render. Try calling submit within a `useEffect` or callback instead.");
    }
    n(O, "validateClientSideSubmission");
    function U() {
      let {
        router: E
      } = u(D.UseSubmit), {
        basename: j
      } = i.useContext(t.UNSAFE_NavigationContext), H = t.UNSAFE_useRouteId();
      return i.useCallback(function(K, I) {
        I === void 0 && (I = {}), O();
        let {
          action: Y,
          method: ne,
          encType: d,
          formData: h,
          body: S
        } = de(K, j);
        E.navigate(I.action || Y, {
          preventScrollReset: I.preventScrollReset,
          formData: h,
          body: S,
          formMethod: I.method || ne,
          formEncType: I.encType || d,
          replace: I.replace,
          state: I.state,
          fromRouteId: H
        });
      }, [E, j, H]);
    }
    n(U, "useSubmit");
    function k(E, j) {
      let {
        router: H
      } = u(D.UseSubmitFetcher), {
        basename: K
      } = i.useContext(t.UNSAFE_NavigationContext);
      return i.useCallback(function(I, Y) {
        Y === void 0 && (Y = {}), O();
        let {
          action: ne,
          method: d,
          encType: h,
          formData: S,
          body: T
        } = de(I, K);
        j == null && o.UNSAFE_invariant(!1, "No routeId available for useFetcher()"), H.fetch(E, j, Y.action || ne, {
          preventScrollReset: Y.preventScrollReset,
          formData: S,
          body: T,
          formMethod: Y.method || d,
          formEncType: Y.encType || h
        });
      }, [H, K, E, j]);
    }
    n(k, "useSubmitFetcher");
    function $(E, j) {
      let {
        relative: H
      } = j === void 0 ? {} : j, {
        basename: K
      } = i.useContext(t.UNSAFE_NavigationContext), I = i.useContext(t.UNSAFE_RouteContext);
      I || o.UNSAFE_invariant(!1, "useFormAction must be used inside a RouteContext");
      let [Y] = I.matches.slice(-1), ne = l({}, t.useResolvedPath(E || ".", {
        relative: H
      })), d = t.useLocation();
      if (E == null && (ne.search = d.search, Y.route.index)) {
        let h = new URLSearchParams(ne.search);
        h.delete("index"), ne.search = h.toString() ? "?" + h.toString() : "";
      }
      return (!E || E === ".") && Y.route.index && (ne.search = ne.search ? ne.search.replace(/^\?/, "?index&") : "?index"), K !== "/" && (ne.
      pathname = ne.pathname === "/" ? K : o.joinPaths([K, ne.pathname])), t.createPath(ne);
    }
    n($, "useFormAction");
    function J(E, j) {
      let H = /* @__PURE__ */ i.forwardRef((K, I) => {
        let Y = k(E, j);
        return /* @__PURE__ */ i.createElement(pe, l({}, K, {
          ref: I,
          submit: Y
        }));
      });
      return H.displayName = "fetcher.Form", H;
    }
    n(J, "createFetcherForm");
    let re = 0;
    function ie() {
      var E;
      let {
        router: j
      } = u(D.UseFetcher), H = i.useContext(t.UNSAFE_RouteContext);
      H || o.UNSAFE_invariant(!1, "useFetcher must be used inside a RouteContext");
      let K = (E = H.matches[H.matches.length - 1]) == null ? void 0 : E.route.id;
      K == null && o.UNSAFE_invariant(!1, 'useFetcher can only be used on routes that contain a unique "id"');
      let [I] = i.useState(() => String(++re)), [Y] = i.useState(() => (K || o.UNSAFE_invariant(!1, "No routeId available for fetcher.Form()"),
      J(I, K))), [ne] = i.useState(() => (T) => {
        j || o.UNSAFE_invariant(!1, "No router available for fetcher.load()"), K || o.UNSAFE_invariant(!1, "No routeId available for fetcher\
.load()"), j.fetch(I, K, T);
      }), d = k(I, K), h = j.getFetcher(I), S = i.useMemo(() => l({
        Form: Y,
        submit: d,
        load: ne
      }, h), [h, Y, d, ne]);
      return i.useEffect(() => () => {
        if (!j) {
          console.warn("No router available to clean up from useFetcher()");
          return;
        }
        j.deleteFetcher(I);
      }, [j, I]), S;
    }
    n(ie, "useFetcher");
    function le() {
      return [...c(z.UseFetchers).fetchers.values()];
    }
    n(le, "useFetchers");
    let se = "react-router-scroll-positions", ge = {};
    function Oe(E) {
      let {
        getKey: j,
        storageKey: H
      } = E === void 0 ? {} : E, {
        router: K
      } = u(D.UseScrollRestoration), {
        restoreScrollPosition: I,
        preventScrollReset: Y
      } = c(z.UseScrollRestoration), {
        basename: ne
      } = i.useContext(t.UNSAFE_NavigationContext), d = t.useLocation(), h = t.useMatches(), S = t.useNavigation();
      i.useEffect(() => (window.history.scrollRestoration = "manual", () => {
        window.history.scrollRestoration = "auto";
      }), []), ot(i.useCallback(() => {
        if (S.state === "idle") {
          let T = (j ? j(d, h) : null) || d.key;
          ge[T] = window.scrollY;
        }
        sessionStorage.setItem(H || se, JSON.stringify(ge)), window.history.scrollRestoration = "auto";
      }, [H, j, S.state, d, h])), typeof document < "u" && (i.useLayoutEffect(() => {
        try {
          let T = sessionStorage.getItem(H || se);
          T && (ge = JSON.parse(T));
        } catch {
        }
      }, [H]), i.useLayoutEffect(() => {
        let T = j && ne !== "/" ? (s, f) => j(
          // Strip the basename to match useLocation()
          l({}, s, {
            pathname: o.stripBasename(s.pathname, ne) || s.pathname
          }),
          f
        ) : j, te = K?.enableScrollRestoration(ge, () => window.scrollY, T);
        return () => te && te();
      }, [K, ne, j]), i.useLayoutEffect(() => {
        if (I !== !1) {
          if (typeof I == "number") {
            window.scrollTo(0, I);
            return;
          }
          if (d.hash) {
            let T = document.getElementById(decodeURIComponent(d.hash.slice(1)));
            if (T) {
              T.scrollIntoView();
              return;
            }
          }
          Y !== !0 && window.scrollTo(0, 0);
        }
      }, [d, I, Y]));
    }
    n(Oe, "useScrollRestoration");
    function De(E, j) {
      let {
        capture: H
      } = j || {};
      i.useEffect(() => {
        let K = H != null ? {
          capture: H
        } : void 0;
        return window.addEventListener("beforeunload", E, K), () => {
          window.removeEventListener("beforeunload", E, K);
        };
      }, [E, H]);
    }
    n(De, "useBeforeUnload");
    function ot(E, j) {
      let {
        capture: H
      } = j || {};
      i.useEffect(() => {
        let K = H != null ? {
          capture: H
        } : void 0;
        return window.addEventListener("pagehide", E, K), () => {
          window.removeEventListener("pagehide", E, K);
        };
      }, [E, H]);
    }
    n(ot, "usePageHide");
    function Qe(E) {
      let {
        when: j,
        message: H
      } = E, K = t.unstable_useBlocker(j);
      i.useEffect(() => {
        K.state === "blocked" && (window.confirm(H) ? setTimeout(K.proceed, 0) : K.reset());
      }, [K, H]), i.useEffect(() => {
        K.state === "blocked" && !j && K.reset();
      }, [K, j]);
    }
    n(Qe, "usePrompt"), Object.defineProperty(e, "AbortedDeferredError", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.AbortedDeferredError;
      }, "get")
    }), Object.defineProperty(e, "Await", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.Await;
      }, "get")
    }), Object.defineProperty(e, "MemoryRouter", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.MemoryRouter;
      }, "get")
    }), Object.defineProperty(e, "Navigate", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.Navigate;
      }, "get")
    }), Object.defineProperty(e, "NavigationType", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.NavigationType;
      }, "get")
    }), Object.defineProperty(e, "Outlet", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.Outlet;
      }, "get")
    }), Object.defineProperty(e, "Route", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.Route;
      }, "get")
    }), Object.defineProperty(e, "Router", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.Router;
      }, "get")
    }), Object.defineProperty(e, "RouterProvider", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.RouterProvider;
      }, "get")
    }), Object.defineProperty(e, "Routes", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.Routes;
      }, "get")
    }), Object.defineProperty(e, "UNSAFE_DataRouterContext", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.UNSAFE_DataRouterContext;
      }, "get")
    }), Object.defineProperty(e, "UNSAFE_DataRouterStateContext", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.UNSAFE_DataRouterStateContext;
      }, "get")
    }), Object.defineProperty(e, "UNSAFE_LocationContext", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.UNSAFE_LocationContext;
      }, "get")
    }), Object.defineProperty(e, "UNSAFE_NavigationContext", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.UNSAFE_NavigationContext;
      }, "get")
    }), Object.defineProperty(e, "UNSAFE_RouteContext", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.UNSAFE_RouteContext;
      }, "get")
    }), Object.defineProperty(e, "UNSAFE_useRouteId", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.UNSAFE_useRouteId;
      }, "get")
    }), Object.defineProperty(e, "createMemoryRouter", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.createMemoryRouter;
      }, "get")
    }), Object.defineProperty(e, "createPath", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.createPath;
      }, "get")
    }), Object.defineProperty(e, "createRoutesFromChildren", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.createRoutesFromChildren;
      }, "get")
    }), Object.defineProperty(e, "createRoutesFromElements", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.createRoutesFromElements;
      }, "get")
    }), Object.defineProperty(e, "defer", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.defer;
      }, "get")
    }), Object.defineProperty(e, "generatePath", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.generatePath;
      }, "get")
    }), Object.defineProperty(e, "isRouteErrorResponse", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.isRouteErrorResponse;
      }, "get")
    }), Object.defineProperty(e, "json", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.json;
      }, "get")
    }), Object.defineProperty(e, "matchPath", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.matchPath;
      }, "get")
    }), Object.defineProperty(e, "matchRoutes", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.matchRoutes;
      }, "get")
    }), Object.defineProperty(e, "parsePath", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.parsePath;
      }, "get")
    }), Object.defineProperty(e, "redirect", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.redirect;
      }, "get")
    }), Object.defineProperty(e, "redirectDocument", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.redirectDocument;
      }, "get")
    }), Object.defineProperty(e, "renderMatches", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.renderMatches;
      }, "get")
    }), Object.defineProperty(e, "resolvePath", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.resolvePath;
      }, "get")
    }), Object.defineProperty(e, "unstable_useBlocker", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.unstable_useBlocker;
      }, "get")
    }), Object.defineProperty(e, "useActionData", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useActionData;
      }, "get")
    }), Object.defineProperty(e, "useAsyncError", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useAsyncError;
      }, "get")
    }), Object.defineProperty(e, "useAsyncValue", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useAsyncValue;
      }, "get")
    }), Object.defineProperty(e, "useHref", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useHref;
      }, "get")
    }), Object.defineProperty(e, "useInRouterContext", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useInRouterContext;
      }, "get")
    }), Object.defineProperty(e, "useLoaderData", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useLoaderData;
      }, "get")
    }), Object.defineProperty(e, "useLocation", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useLocation;
      }, "get")
    }), Object.defineProperty(e, "useMatch", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useMatch;
      }, "get")
    }), Object.defineProperty(e, "useMatches", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useMatches;
      }, "get")
    }), Object.defineProperty(e, "useNavigate", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useNavigate;
      }, "get")
    }), Object.defineProperty(e, "useNavigation", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useNavigation;
      }, "get")
    }), Object.defineProperty(e, "useNavigationType", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useNavigationType;
      }, "get")
    }), Object.defineProperty(e, "useOutlet", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useOutlet;
      }, "get")
    }), Object.defineProperty(e, "useOutletContext", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useOutletContext;
      }, "get")
    }), Object.defineProperty(e, "useParams", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useParams;
      }, "get")
    }), Object.defineProperty(e, "useResolvedPath", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useResolvedPath;
      }, "get")
    }), Object.defineProperty(e, "useRevalidator", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useRevalidator;
      }, "get")
    }), Object.defineProperty(e, "useRouteError", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useRouteError;
      }, "get")
    }), Object.defineProperty(e, "useRouteLoaderData", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useRouteLoaderData;
      }, "get")
    }), Object.defineProperty(e, "useRoutes", {
      enumerable: !0,
      get: /* @__PURE__ */ n(function() {
        return t.useRoutes;
      }, "get")
    }), e.BrowserRouter = ce, e.Form = je, e.HashRouter = Fe, e.Link = qe, e.NavLink = Be, e.ScrollRestoration = C, e.UNSAFE_useScrollRestoration =
    Oe, e.createBrowserRouter = xe, e.createHashRouter = Ae, e.createSearchParams = A, e.unstable_HistoryRouter = Ce, e.unstable_usePrompt =
    Qe, e.useBeforeUnload = De, e.useFetcher = ie, e.useFetchers = le, e.useFormAction = $, e.useLinkClickHandler = p, e.useSearchParams = P,
    e.useSubmit = U, Object.defineProperty(e, "__esModule", { value: !0 });
  });
});

// ../node_modules/react-router-dom/dist/main.js
var ya = He((cl, wr) => {
  "use strict";
  process.env.NODE_ENV === "production" ? wr.exports = ma() : wr.exports = ga();
});

// src/router/index.ts
var ii = {};
Ca(ii, {
  BaseLocationProvider: () => oi,
  DEEPLY_EQUAL: () => At,
  Link: () => va,
  Location: () => Cr,
  LocationProvider: () => ai,
  Match: () => Ar,
  Route: () => Ea,
  buildArgsParam: () => lo,
  deepDiff: () => Wt,
  getMatch: () => pr,
  parsePath: () => hr,
  queryFromLocation: () => mr,
  stringifyQuery: () => so,
  useNavigate: () => ni
});
module.exports = Aa(ii);

// src/router/utils.ts
var Cn = require("storybook/internal/client-logger");

// ../node_modules/es-toolkit/dist/function/noop.mjs
function Nr() {
}
n(Nr, "noop");

// ../node_modules/es-toolkit/dist/compat/_internal/getSymbols.mjs
function tr(e) {
  return Object.getOwnPropertySymbols(e).filter((r) => Object.prototype.propertyIsEnumerable.call(e, r));
}
n(tr, "getSymbols");

// ../node_modules/es-toolkit/dist/compat/_internal/getTag.mjs
function rr(e) {
  return e == null ? e === void 0 ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(e);
}
n(rr, "getTag");

// ../node_modules/es-toolkit/dist/compat/_internal/tags.mjs
var _r = "[object RegExp]", Fr = "[object String]", Ur = "[object Number]", Lr = "[object Boolean]", nr = "[object Arguments]", Mr = "[objec\
t Symbol]", Tr = "[object Date]", Ir = "[object Map]", Br = "[object Set]", kr = "[object Array]", zr = "[object Function]", Hr = "[object A\
rrayBuffer]", It = "[object Object]", Wr = "[object Error]", Kr = "[object DataView]", qr = "[object Uint8Array]", $r = "[object Uint8Clampe\
dArray]", Vr = "[object Uint16Array]", Jr = "[object Uint32Array]", Yr = "[object BigUint64Array]", Qr = "[object Int8Array]", Xr = "[object\
 Int16Array]", Gr = "[object Int32Array]", Zr = "[object BigInt64Array]", en = "[object Float32Array]", tn = "[object Float64Array]";

// ../node_modules/es-toolkit/dist/predicate/isPlainObject.mjs
function rt(e) {
  if (!e || typeof e != "object")
    return !1;
  let r = Object.getPrototypeOf(e);
  return r === null || r === Object.prototype || Object.getPrototypeOf(r) === null ? Object.prototype.toString.call(e) === "[object Object]" :
  !1;
}
n(rt, "isPlainObject");

// ../node_modules/es-toolkit/dist/compat/util/eq.mjs
function rn(e, r) {
  return e === r || Number.isNaN(e) && Number.isNaN(r);
}
n(rn, "eq");

// ../node_modules/es-toolkit/dist/predicate/isEqualWith.mjs
function nn(e, r, t) {
  return wt(e, r, void 0, void 0, void 0, void 0, t);
}
n(nn, "isEqualWith");
function wt(e, r, t, o, a, i, l) {
  let b = l(e, r, t, o, a, i);
  if (b !== void 0)
    return b;
  if (typeof e == typeof r)
    switch (typeof e) {
      case "bigint":
      case "string":
      case "boolean":
      case "symbol":
      case "undefined":
        return e === r;
      case "number":
        return e === r || Object.is(e, r);
      case "function":
        return e === r;
      case "object":
        return Ot(e, r, i, l);
    }
  return Ot(e, r, i, l);
}
n(wt, "isEqualWithImpl");
function Ot(e, r, t, o) {
  if (Object.is(e, r))
    return !0;
  let a = rr(e), i = rr(r);
  if (a === nr && (a = It), i === nr && (i = It), a !== i)
    return !1;
  switch (a) {
    case Fr:
      return e.toString() === r.toString();
    case Ur: {
      let g = e.valueOf(), R = r.valueOf();
      return rn(g, R);
    }
    case Lr:
    case Tr:
    case Mr:
      return Object.is(e.valueOf(), r.valueOf());
    case _r:
      return e.source === r.source && e.flags === r.flags;
    case zr:
      return e === r;
  }
  t = t ?? /* @__PURE__ */ new Map();
  let l = t.get(e), b = t.get(r);
  if (l != null && b != null)
    return l === r;
  t.set(e, r), t.set(r, e);
  try {
    switch (a) {
      case Ir: {
        if (e.size !== r.size)
          return !1;
        for (let [g, R] of e.entries())
          if (!r.has(g) || !wt(R, r.get(g), g, e, r, t, o))
            return !1;
        return !0;
      }
      case Br: {
        if (e.size !== r.size)
          return !1;
        let g = Array.from(e.values()), R = Array.from(r.values());
        for (let w = 0; w < g.length; w++) {
          let x = g[w], M = R.findIndex((_) => wt(x, _, void 0, e, r, t, o));
          if (M === -1)
            return !1;
          R.splice(M, 1);
        }
        return !0;
      }
      case kr:
      case qr:
      case $r:
      case Vr:
      case Jr:
      case Yr:
      case Qr:
      case Xr:
      case Gr:
      case Zr:
      case en:
      case tn: {
        if (typeof Buffer < "u" && Buffer.isBuffer(e) !== Buffer.isBuffer(r) || e.length !== r.length)
          return !1;
        for (let g = 0; g < e.length; g++)
          if (!wt(e[g], r[g], g, e, r, t, o))
            return !1;
        return !0;
      }
      case Hr:
        return e.byteLength !== r.byteLength ? !1 : Ot(new Uint8Array(e), new Uint8Array(r), t, o);
      case Kr:
        return e.byteLength !== r.byteLength || e.byteOffset !== r.byteOffset ? !1 : Ot(new Uint8Array(e), new Uint8Array(r), t, o);
      case Wr:
        return e.name === r.name && e.message === r.message;
      case It: {
        if (!(Ot(e.constructor, r.constructor, t, o) || rt(e) && rt(r)))
          return !1;
        let R = [...Object.keys(e), ...tr(e)], w = [...Object.keys(r), ...tr(r)];
        if (R.length !== w.length)
          return !1;
        for (let x = 0; x < R.length; x++) {
          let M = R[x], _ = e[M];
          if (!Object.hasOwn(r, M))
            return !1;
          let N = r[M];
          if (!wt(_, N, M, e, r, t, o))
            return !1;
        }
        return !0;
      }
      default:
        return !1;
    }
  } finally {
    t.delete(e), t.delete(r);
  }
}
n(Ot, "areObjectsEqual");

// ../node_modules/es-toolkit/dist/predicate/isEqual.mjs
function ar(e, r) {
  return nn(e, r, Nr);
}
n(ar, "isEqual");

// src/router/utils.ts
var Kt = xt(fn(), 1), jt = xt(Pn(), 1), An = xt(wn(), 1);
var no = /\/([^/]+)\/(?:(.*)_)?([^/]+)?/, hr = (0, Kt.default)(1e3)((e) => {
  let r = {
    viewMode: void 0,
    storyId: void 0,
    refId: void 0
  };
  if (e) {
    let [, t, o, a] = e.toLowerCase().match(no) || [];
    t && Object.assign(r, {
      viewMode: t,
      storyId: a,
      refId: o
    });
  }
  return r;
}), At = Symbol("Deeply equal"), Wt = /* @__PURE__ */ n((e, r) => {
  if (typeof e != typeof r)
    return r;
  if (ar(e, r))
    return At;
  if (Array.isArray(e) && Array.isArray(r)) {
    let t = r.reduce((o, a, i) => {
      let l = Wt(e[i], a);
      return l !== At && (o[i] = l), o;
    }, new Array(r.length));
    return r.length >= e.length ? t : t.concat(new Array(e.length - r.length).fill(void 0));
  }
  return rt(e) && rt(r) ? Object.keys({ ...e, ...r }).reduce((t, o) => {
    let a = Wt(e?.[o], r?.[o]);
    return a === At ? t : Object.assign(t, { [o]: a });
  }, {}) : r;
}, "deepDiff"), On = /^[a-zA-Z0-9 _-]*$/, ao = /^-?[0-9]+(\.[0-9]+)?$/, jn = /^#([a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/i, Dn = /^(rgba?|hsla?)\(([0-9]{1,3}),\s?([0-9]{1,3})%?,\s?([0-9]{1,3})%?,?\s?([0-9](\.[0-9]{1,2})?)?\)$/i,
fr = /* @__PURE__ */ n((e = "", r) => e === null || e === "" || !On.test(e) ? !1 : r == null || r instanceof Date || typeof r == "number" ||
typeof r == "boolean" ? !0 : typeof r == "string" ? On.test(r) || ao.test(r) || jn.test(r) || Dn.test(r) : Array.isArray(r) ? r.every((t) => fr(
e, t)) : rt(r) ? Object.entries(r).every(([t, o]) => fr(t, o)) : !1, "validateArgs"), dr = /* @__PURE__ */ n((e) => e === void 0 ? "!undefin\
ed" : e === null ? "!null" : typeof e == "string" ? jn.test(e) ? `!hex(${e.slice(1)})` : Dn.test(e) ? `!${e.replace(/[\s%]/g, "")}` : e : typeof e ==
"boolean" ? `!${e}` : e instanceof Date ? `!date(${e.toISOString()})` : Array.isArray(e) ? e.map(dr) : rt(e) ? Object.entries(e).reduce(
  (r, [t, o]) => Object.assign(r, { [t]: dr(o) }),
  {}
) : e, "encodeSpecialValues"), oo = /* @__PURE__ */ n((e) => {
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
}, "decodeKnownQueryChar"), io = /%[0-9A-F]{2}/g, lo = /* @__PURE__ */ n((e, r) => {
  let t = Wt(e, r);
  if (!t || t === At)
    return "";
  let o = Object.entries(t).reduce((a, [i, l]) => fr(i, l) ? Object.assign(a, { [i]: l }) : (Cn.once.warn(An.dedent`
      Omitted potentially unsafe URL args.

      More info: https://storybook.js.org/docs/writing-stories/args?ref=error#setting-args-through-the-url
    `), a), {});
  return (0, jt.stringify)(dr(o), {
    delimiter: ";",
    // we don't actually create multiple query params
    nesting: !0,
    nestingSyntax: "js"
    // encode objects using dot notation: obj.key=val
  }).replace(io, oo).split(";").map((a) => a.replace("=", ":")).join(";");
}, "buildArgsParam"), uo = (0, Kt.default)(1e3)((e) => e !== void 0 ? (0, jt.parse)(e) : {}), mr = /* @__PURE__ */ n((e) => uo(e.search ? e.
search.slice(1) : ""), "queryFromLocation"), so = /* @__PURE__ */ n((e) => {
  let r = (0, jt.stringify)(e);
  return r ? "?" + r : "";
}, "stringifyQuery"), pr = (0, Kt.default)(1e3)((e, r, t = !0) => {
  if (t) {
    if (typeof r != "string")
      throw new Error("startsWith only works with string targets");
    return e && e.startsWith(r) ? { path: e } : null;
  }
  let o = typeof r == "string" && e === r, a = e && r && e.match(r);
  return o || a ? { path: e } : null;
});

// src/router/router.tsx
var ct = xt(require("react"), 1), ba = require("@storybook/global"), tt = xt(ya(), 1);
var { document: Or } = ba.global, ri = /* @__PURE__ */ n(() => `${Or.location.pathname}?`, "getBase"), ni = /* @__PURE__ */ n(() => {
  let e = tt.useNavigate();
  return (0, ct.useCallback)((r, { plain: t, ...o } = {}) => {
    if (typeof r == "string" && r.startsWith("#")) {
      r === "#" ? e(Or.location.search) : Or.location.hash = r;
      return;
    }
    if (typeof r == "string") {
      let a = t ? r : `?path=${r}`;
      return e(a, o);
    }
    if (typeof r == "number")
      return e(r);
  }, []);
}, "useNavigate"), va = /* @__PURE__ */ n(({ to: e, children: r, ...t }) => /* @__PURE__ */ ct.default.createElement(tt.Link, { to: `${ri()}\
path=${e}`, ...t }, r), "Link");
va.displayName = "QueryLink";
var Cr = /* @__PURE__ */ n(({ children: e }) => {
  let r = tt.useLocation(), { path: t, singleStory: o } = mr(r), { viewMode: a, storyId: i, refId: l } = hr(t);
  return /* @__PURE__ */ ct.default.createElement(ct.default.Fragment, null, e({
    path: t || "/",
    location: r,
    viewMode: a,
    storyId: i,
    refId: l,
    singleStory: o === "true"
  }));
}, "Location");
Cr.displayName = "QueryLocation";
function Ar({
  children: e,
  path: r,
  startsWith: t = !1
}) {
  return /* @__PURE__ */ ct.default.createElement(Cr, null, ({ path: o, ...a }) => e({
    match: pr(o, r, t),
    ...a
  }));
}
n(Ar, "Match");
Ar.displayName = "QueryMatch";
function Ea(e) {
  let { children: r, ...t } = e;
  return t.startsWith === void 0 && (t.startsWith = !1), /* @__PURE__ */ ct.default.createElement(Ar, { ...t }, ({ match: a }) => a ? r : null);
}
n(Ea, "Route");
Ea.displayName = "Route";
var ai = /* @__PURE__ */ n((...e) => tt.BrowserRouter(...e), "LocationProvider"), oi = /* @__PURE__ */ n((...e) => tt.Router(...e), "BaseLoc\
ationProvider");
