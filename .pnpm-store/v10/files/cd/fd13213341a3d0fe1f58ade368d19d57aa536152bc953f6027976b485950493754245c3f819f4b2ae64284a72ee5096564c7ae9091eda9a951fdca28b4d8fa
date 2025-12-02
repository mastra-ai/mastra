var wp = Object.create;
var Tn = Object.defineProperty;
var bp = Object.getOwnPropertyDescriptor;
var yp = Object.getOwnPropertyNames;
var Rp = Object.getPrototypeOf, xp = Object.prototype.hasOwnProperty;
var o = (e, t) => Tn(e, "name", { value: t, configurable: !0 }), Xr = /* @__PURE__ */ ((e) => typeof require < "u" ? require : typeof Proxy <
"u" ? new Proxy(e, {
  get: (t, r) => (typeof require < "u" ? require : t)[r]
}) : e)(function(e) {
  if (typeof require < "u") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + e + '" is not supported');
});
var C = (e, t) => () => (e && (t = e(e = 0)), t);
var H = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports), Zr = (e, t) => {
  for (var r in t)
    Tn(e, r, { get: t[r], enumerable: !0 });
}, Ep = (e, t, r, n) => {
  if (t && typeof t == "object" || typeof t == "function")
    for (let a of yp(t))
      !xp.call(e, a) && a !== r && Tn(e, a, { get: () => t[a], enumerable: !(n = bp(t, a)) || n.enumerable });
  return e;
};
var me = (e, t, r) => (r = e != null ? wp(Rp(e)) : {}, Ep(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  t || !e || !e.__esModule ? Tn(r, "default", { value: e, enumerable: !0 }) : r,
  e
));

// ../node_modules/@babel/runtime/helpers/esm/extends.js
function W() {
  return W = Object.assign ? Object.assign.bind() : function(e) {
    for (var t = 1; t < arguments.length; t++) {
      var r = arguments[t];
      for (var n in r) ({}).hasOwnProperty.call(r, n) && (e[n] = r[n]);
    }
    return e;
  }, W.apply(null, arguments);
}
var Kr = C(() => {
  o(W, "_extends");
});

// ../node_modules/@babel/runtime/helpers/esm/assertThisInitialized.js
function Tl(e) {
  if (e === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  return e;
}
var Hl = C(() => {
  o(Tl, "_assertThisInitialized");
});

// ../node_modules/@babel/runtime/helpers/esm/setPrototypeOf.js
function ht(e, t) {
  return ht = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(r, n) {
    return r.__proto__ = n, r;
  }, ht(e, t);
}
var Hn = C(() => {
  o(ht, "_setPrototypeOf");
});

// ../node_modules/@babel/runtime/helpers/esm/getPrototypeOf.js
function Pn(e) {
  return Pn = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(t) {
    return t.__proto__ || Object.getPrototypeOf(t);
  }, Pn(e);
}
var kl = C(() => {
  o(Pn, "_getPrototypeOf");
});

// ../node_modules/memoizerific/memoizerific.js
var Qr = H((Ul, ia) => {
  (function(e) {
    if (typeof Ul == "object" && typeof ia < "u")
      ia.exports = e();
    else if (typeof define == "function" && define.amd)
      define([], e);
    else {
      var t;
      typeof window < "u" ? t = window : typeof global < "u" ? t = global : typeof self < "u" ? t = self : t = this, t.memoizerific = e();
    }
  })(function() {
    var e, t, r;
    return (/* @__PURE__ */ o(function n(a, i, c) {
      function l(f, d) {
        if (!i[f]) {
          if (!a[f]) {
            var m = typeof Xr == "function" && Xr;
            if (!d && m) return m(f, !0);
            if (s) return s(f, !0);
            var v = new Error("Cannot find module '" + f + "'");
            throw v.code = "MODULE_NOT_FOUND", v;
          }
          var y = i[f] = { exports: {} };
          a[f][0].call(y.exports, function(p) {
            var h = a[f][1][p];
            return l(h || p);
          }, y, y.exports, n, a, i, c);
        }
        return i[f].exports;
      }
      o(l, "s");
      for (var s = typeof Xr == "function" && Xr, u = 0; u < c.length; u++) l(c[u]);
      return l;
    }, "e"))({ 1: [function(n, a, i) {
      a.exports = function(c) {
        if (typeof Map != "function" || c) {
          var l = n("./similar");
          return new l();
        } else
          return /* @__PURE__ */ new Map();
      };
    }, { "./similar": 2 }], 2: [function(n, a, i) {
      function c() {
        return this.list = [], this.lastItem = void 0, this.size = 0, this;
      }
      o(c, "Similar"), c.prototype.get = function(l) {
        var s;
        if (this.lastItem && this.isEqual(this.lastItem.key, l))
          return this.lastItem.val;
        if (s = this.indexOf(l), s >= 0)
          return this.lastItem = this.list[s], this.list[s].val;
      }, c.prototype.set = function(l, s) {
        var u;
        return this.lastItem && this.isEqual(this.lastItem.key, l) ? (this.lastItem.val = s, this) : (u = this.indexOf(l), u >= 0 ? (this.lastItem =
        this.list[u], this.list[u].val = s, this) : (this.lastItem = { key: l, val: s }, this.list.push(this.lastItem), this.size++, this));
      }, c.prototype.delete = function(l) {
        var s;
        if (this.lastItem && this.isEqual(this.lastItem.key, l) && (this.lastItem = void 0), s = this.indexOf(l), s >= 0)
          return this.size--, this.list.splice(s, 1)[0];
      }, c.prototype.has = function(l) {
        var s;
        return this.lastItem && this.isEqual(this.lastItem.key, l) ? !0 : (s = this.indexOf(l), s >= 0 ? (this.lastItem = this.list[s], !0) :
        !1);
      }, c.prototype.forEach = function(l, s) {
        var u;
        for (u = 0; u < this.size; u++)
          l.call(s || this, this.list[u].val, this.list[u].key, this);
      }, c.prototype.indexOf = function(l) {
        var s;
        for (s = 0; s < this.size; s++)
          if (this.isEqual(this.list[s].key, l))
            return s;
        return -1;
      }, c.prototype.isEqual = function(l, s) {
        return l === s || l !== l && s !== s;
      }, a.exports = c;
    }, {}], 3: [function(n, a, i) {
      var c = n("map-or-similar");
      a.exports = function(f) {
        var d = new c(!1), m = [];
        return function(v) {
          var y = /* @__PURE__ */ o(function() {
            var p = d, h, g, w = arguments.length - 1, b = Array(w + 1), x = !0, E;
            if ((y.numArgs || y.numArgs === 0) && y.numArgs !== w + 1)
              throw new Error("Memoizerific functions should always be called with the same number of arguments");
            for (E = 0; E < w; E++) {
              if (b[E] = {
                cacheItem: p,
                arg: arguments[E]
              }, p.has(arguments[E])) {
                p = p.get(arguments[E]);
                continue;
              }
              x = !1, h = new c(!1), p.set(arguments[E], h), p = h;
            }
            return x && (p.has(arguments[w]) ? g = p.get(arguments[w]) : x = !1), x || (g = v.apply(null, arguments), p.set(arguments[w], g)),
            f > 0 && (b[w] = {
              cacheItem: p,
              arg: arguments[w]
            }, x ? l(m, b) : m.push(b), m.length > f && s(m.shift())), y.wasMemoized = x, y.numArgs = w + 1, g;
          }, "memoizerific");
          return y.limit = f, y.wasMemoized = !1, y.cache = d, y.lru = m, y;
        };
      };
      function l(f, d) {
        var m = f.length, v = d.length, y, p, h;
        for (p = 0; p < m; p++) {
          for (y = !0, h = 0; h < v; h++)
            if (!u(f[p][h].arg, d[h].arg)) {
              y = !1;
              break;
            }
          if (y)
            break;
        }
        f.push(f.splice(p, 1)[0]);
      }
      o(l, "moveToMostRecentLru");
      function s(f) {
        var d = f.length, m = f[d - 1], v, y;
        for (m.cacheItem.delete(m.arg), y = d - 2; y >= 0 && (m = f[y], v = m.cacheItem.get(m.arg), !v || !v.size); y--)
          m.cacheItem.delete(m.arg);
      }
      o(s, "removeCachedResult");
      function u(f, d) {
        return f === d || f !== f && d !== d;
      }
      o(u, "isEqual");
    }, { "map-or-similar": 1 }] }, {}, [3])(3);
  });
});

// ../node_modules/@babel/runtime/helpers/esm/objectWithoutPropertiesLoose.js
function ur(e, t) {
  if (e == null) return {};
  var r = {};
  for (var n in e) if ({}.hasOwnProperty.call(e, n)) {
    if (t.indexOf(n) !== -1) continue;
    r[n] = e[n];
  }
  return r;
}
var Bn = C(() => {
  o(ur, "_objectWithoutPropertiesLoose");
});

// ../node_modules/@babel/runtime/helpers/esm/objectWithoutProperties.js
function ql(e, t) {
  if (e == null) return {};
  var r, n, a = ur(e, t);
  if (Object.getOwnPropertySymbols) {
    var i = Object.getOwnPropertySymbols(e);
    for (n = 0; n < i.length; n++) r = i[n], t.indexOf(r) === -1 && {}.propertyIsEnumerable.call(e, r) && (a[r] = e[r]);
  }
  return a;
}
var Gl = C(() => {
  Bn();
  o(ql, "_objectWithoutProperties");
});

// ../node_modules/@babel/runtime/helpers/esm/arrayLikeToArray.js
function en(e, t) {
  (t == null || t > e.length) && (t = e.length);
  for (var r = 0, n = Array(t); r < t; r++) n[r] = e[r];
  return n;
}
var la = C(() => {
  o(en, "_arrayLikeToArray");
});

// ../node_modules/@babel/runtime/helpers/esm/arrayWithoutHoles.js
function Yl(e) {
  if (Array.isArray(e)) return en(e);
}
var Xl = C(() => {
  la();
  o(Yl, "_arrayWithoutHoles");
});

// ../node_modules/@babel/runtime/helpers/esm/iterableToArray.js
function Zl(e) {
  if (typeof Symbol < "u" && e[Symbol.iterator] != null || e["@@iterator"] != null) return Array.from(e);
}
var Kl = C(() => {
  o(Zl, "_iterableToArray");
});

// ../node_modules/@babel/runtime/helpers/esm/unsupportedIterableToArray.js
function Jl(e, t) {
  if (e) {
    if (typeof e == "string") return en(e, t);
    var r = {}.toString.call(e).slice(8, -1);
    return r === "Object" && e.constructor && (r = e.constructor.name), r === "Map" || r === "Set" ? Array.from(e) : r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.
    test(r) ? en(e, t) : void 0;
  }
}
var Ql = C(() => {
  la();
  o(Jl, "_unsupportedIterableToArray");
});

// ../node_modules/@babel/runtime/helpers/esm/nonIterableSpread.js
function ec() {
  throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
var tc = C(() => {
  o(ec, "_nonIterableSpread");
});

// ../node_modules/@babel/runtime/helpers/esm/toConsumableArray.js
function Nn(e) {
  return Yl(e) || Zl(e) || Jl(e) || ec();
}
var rc = C(() => {
  Xl();
  Kl();
  Ql();
  tc();
  o(Nn, "_toConsumableArray");
});

// ../node_modules/@babel/runtime/helpers/esm/typeof.js
function Dt(e) {
  "@babel/helpers - typeof";
  return Dt = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
    return typeof t;
  } : function(t) {
    return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
  }, Dt(e);
}
var ca = C(() => {
  o(Dt, "_typeof");
});

// ../node_modules/@babel/runtime/helpers/esm/toPrimitive.js
function nc(e, t) {
  if (Dt(e) != "object" || !e) return e;
  var r = e[Symbol.toPrimitive];
  if (r !== void 0) {
    var n = r.call(e, t || "default");
    if (Dt(n) != "object") return n;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (t === "string" ? String : Number)(e);
}
var oc = C(() => {
  ca();
  o(nc, "toPrimitive");
});

// ../node_modules/@babel/runtime/helpers/esm/toPropertyKey.js
function ac(e) {
  var t = nc(e, "string");
  return Dt(t) == "symbol" ? t : t + "";
}
var ic = C(() => {
  ca();
  oc();
  o(ac, "toPropertyKey");
});

// ../node_modules/@babel/runtime/helpers/esm/defineProperty.js
function Fn(e, t, r) {
  return (t = ac(t)) in e ? Object.defineProperty(e, t, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[t] = r, e;
}
var sa = C(() => {
  ic();
  o(Fn, "_defineProperty");
});

// ../node_modules/react-syntax-highlighter/dist/esm/create-element.js
import p2 from "react";
function lc(e, t) {
  var r = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(e);
    t && (n = n.filter(function(a) {
      return Object.getOwnPropertyDescriptor(e, a).enumerable;
    })), r.push.apply(r, n);
  }
  return r;
}
function fr(e) {
  for (var t = 1; t < arguments.length; t++) {
    var r = arguments[t] != null ? arguments[t] : {};
    t % 2 ? lc(Object(r), !0).forEach(function(n) {
      Fn(e, n, r[n]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r)) : lc(Object(r)).forEach(function(n) {
      Object.defineProperty(e, n, Object.getOwnPropertyDescriptor(r, n));
    });
  }
  return e;
}
function m2(e) {
  var t = e.length;
  if (t === 0 || t === 1) return e;
  if (t === 2)
    return [e[0], e[1], "".concat(e[0], ".").concat(e[1]), "".concat(e[1], ".").concat(e[0])];
  if (t === 3)
    return [e[0], e[1], e[2], "".concat(e[0], ".").concat(e[1]), "".concat(e[0], ".").concat(e[2]), "".concat(e[1], ".").concat(e[0]), "".concat(
    e[1], ".").concat(e[2]), "".concat(e[2], ".").concat(e[0]), "".concat(e[2], ".").concat(e[1]), "".concat(e[0], ".").concat(e[1], ".").concat(
    e[2]), "".concat(e[0], ".").concat(e[2], ".").concat(e[1]), "".concat(e[1], ".").concat(e[0], ".").concat(e[2]), "".concat(e[1], ".").concat(
    e[2], ".").concat(e[0]), "".concat(e[2], ".").concat(e[0], ".").concat(e[1]), "".concat(e[2], ".").concat(e[1], ".").concat(e[0])];
  if (t >= 4)
    return [e[0], e[1], e[2], e[3], "".concat(e[0], ".").concat(e[1]), "".concat(e[0], ".").concat(e[2]), "".concat(e[0], ".").concat(e[3]),
    "".concat(e[1], ".").concat(e[0]), "".concat(e[1], ".").concat(e[2]), "".concat(e[1], ".").concat(e[3]), "".concat(e[2], ".").concat(e[0]),
    "".concat(e[2], ".").concat(e[1]), "".concat(e[2], ".").concat(e[3]), "".concat(e[3], ".").concat(e[0]), "".concat(e[3], ".").concat(e[1]),
    "".concat(e[3], ".").concat(e[2]), "".concat(e[0], ".").concat(e[1], ".").concat(e[2]), "".concat(e[0], ".").concat(e[1], ".").concat(e[3]),
    "".concat(e[0], ".").concat(e[2], ".").concat(e[1]), "".concat(e[0], ".").concat(e[2], ".").concat(e[3]), "".concat(e[0], ".").concat(e[3],
    ".").concat(e[1]), "".concat(e[0], ".").concat(e[3], ".").concat(e[2]), "".concat(e[1], ".").concat(e[0], ".").concat(e[2]), "".concat(e[1],
    ".").concat(e[0], ".").concat(e[3]), "".concat(e[1], ".").concat(e[2], ".").concat(e[0]), "".concat(e[1], ".").concat(e[2], ".").concat(
    e[3]), "".concat(e[1], ".").concat(e[3], ".").concat(e[0]), "".concat(e[1], ".").concat(e[3], ".").concat(e[2]), "".concat(e[2], ".").concat(
    e[0], ".").concat(e[1]), "".concat(e[2], ".").concat(e[0], ".").concat(e[3]), "".concat(e[2], ".").concat(e[1], ".").concat(e[0]), "".concat(
    e[2], ".").concat(e[1], ".").concat(e[3]), "".concat(e[2], ".").concat(e[3], ".").concat(e[0]), "".concat(e[2], ".").concat(e[3], ".").concat(
    e[1]), "".concat(e[3], ".").concat(e[0], ".").concat(e[1]), "".concat(e[3], ".").concat(e[0], ".").concat(e[2]), "".concat(e[3], ".").concat(
    e[1], ".").concat(e[0]), "".concat(e[3], ".").concat(e[1], ".").concat(e[2]), "".concat(e[3], ".").concat(e[2], ".").concat(e[0]), "".concat(
    e[3], ".").concat(e[2], ".").concat(e[1]), "".concat(e[0], ".").concat(e[1], ".").concat(e[2], ".").concat(e[3]), "".concat(e[0], ".").concat(
    e[1], ".").concat(e[3], ".").concat(e[2]), "".concat(e[0], ".").concat(e[2], ".").concat(e[1], ".").concat(e[3]), "".concat(e[0], ".").concat(
    e[2], ".").concat(e[3], ".").concat(e[1]), "".concat(e[0], ".").concat(e[3], ".").concat(e[1], ".").concat(e[2]), "".concat(e[0], ".").concat(
    e[3], ".").concat(e[2], ".").concat(e[1]), "".concat(e[1], ".").concat(e[0], ".").concat(e[2], ".").concat(e[3]), "".concat(e[1], ".").concat(
    e[0], ".").concat(e[3], ".").concat(e[2]), "".concat(e[1], ".").concat(e[2], ".").concat(e[0], ".").concat(e[3]), "".concat(e[1], ".").concat(
    e[2], ".").concat(e[3], ".").concat(e[0]), "".concat(e[1], ".").concat(e[3], ".").concat(e[0], ".").concat(e[2]), "".concat(e[1], ".").concat(
    e[3], ".").concat(e[2], ".").concat(e[0]), "".concat(e[2], ".").concat(e[0], ".").concat(e[1], ".").concat(e[3]), "".concat(e[2], ".").concat(
    e[0], ".").concat(e[3], ".").concat(e[1]), "".concat(e[2], ".").concat(e[1], ".").concat(e[0], ".").concat(e[3]), "".concat(e[2], ".").concat(
    e[1], ".").concat(e[3], ".").concat(e[0]), "".concat(e[2], ".").concat(e[3], ".").concat(e[0], ".").concat(e[1]), "".concat(e[2], ".").concat(
    e[3], ".").concat(e[1], ".").concat(e[0]), "".concat(e[3], ".").concat(e[0], ".").concat(e[1], ".").concat(e[2]), "".concat(e[3], ".").concat(
    e[0], ".").concat(e[2], ".").concat(e[1]), "".concat(e[3], ".").concat(e[1], ".").concat(e[0], ".").concat(e[2]), "".concat(e[3], ".").concat(
    e[1], ".").concat(e[2], ".").concat(e[0]), "".concat(e[3], ".").concat(e[2], ".").concat(e[0], ".").concat(e[1]), "".concat(e[3], ".").concat(
    e[2], ".").concat(e[1], ".").concat(e[0])];
}
function h2(e) {
  if (e.length === 0 || e.length === 1) return e;
  var t = e.join(".");
  return ua[t] || (ua[t] = m2(e)), ua[t];
}
function g2(e) {
  var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, r = arguments.length > 2 ? arguments[2] : void 0, n = e.filter(
  function(i) {
    return i !== "token";
  }), a = h2(n);
  return a.reduce(function(i, c) {
    return fr(fr({}, i), r[c]);
  }, t);
}
function cc(e) {
  return e.join(" ");
}
function v2(e, t) {
  var r = 0;
  return function(n) {
    return r += 1, n.map(function(a, i) {
      return _t({
        node: a,
        stylesheet: e,
        useInlineStyles: t,
        key: "code-segment-".concat(r, "-").concat(i)
      });
    });
  };
}
function _t(e) {
  var t = e.node, r = e.stylesheet, n = e.style, a = n === void 0 ? {} : n, i = e.useInlineStyles, c = e.key, l = t.properties, s = t.type, u = t.
  tagName, f = t.value;
  if (s === "text")
    return f;
  if (u) {
    var d = v2(r, i), m;
    if (!i)
      m = fr(fr({}, l), {}, {
        className: cc(l.className)
      });
    else {
      var v = Object.keys(r).reduce(function(g, w) {
        return w.split(".").forEach(function(b) {
          g.includes(b) || g.push(b);
        }), g;
      }, []), y = l.className && l.className.includes("token") ? ["token"] : [], p = l.className && y.concat(l.className.filter(function(g) {
        return !v.includes(g);
      }));
      m = fr(fr({}, l), {}, {
        className: cc(p) || void 0,
        style: g2(l.className, Object.assign({}, l.style, a), r)
      });
    }
    var h = d(t.children);
    return /* @__PURE__ */ p2.createElement(u, W({
      key: c
    }, m), h);
  }
}
var ua, fa = C(() => {
  Kr();
  sa();
  o(lc, "ownKeys");
  o(fr, "_objectSpread");
  o(m2, "powerSetPermutations");
  ua = {};
  o(h2, "getClassNameCombinations");
  o(g2, "createStyleObject");
  o(cc, "createClassNameString");
  o(v2, "createChildren");
  o(_t, "createElement");
});

// ../node_modules/react-syntax-highlighter/dist/esm/checkForListedLanguage.js
var sc, uc = C(() => {
  sc = /* @__PURE__ */ o(function(e, t) {
    var r = e.listLanguages();
    return r.indexOf(t) !== -1;
  }, "default");
});

// ../node_modules/react-syntax-highlighter/dist/esm/highlight.js
import $t from "react";
function fc(e, t) {
  var r = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(e);
    t && (n = n.filter(function(a) {
      return Object.getOwnPropertyDescriptor(e, a).enumerable;
    })), r.push.apply(r, n);
  }
  return r;
}
function bt(e) {
  for (var t = 1; t < arguments.length; t++) {
    var r = arguments[t] != null ? arguments[t] : {};
    t % 2 ? fc(Object(r), !0).forEach(function(n) {
      Fn(e, n, r[n]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r)) : fc(Object(r)).forEach(function(n) {
      Object.defineProperty(e, n, Object.getOwnPropertyDescriptor(r, n));
    });
  }
  return e;
}
function y2(e) {
  return e.match(b2);
}
function R2(e) {
  var t = e.lines, r = e.startingLineNumber, n = e.style;
  return t.map(function(a, i) {
    var c = i + r;
    return /* @__PURE__ */ $t.createElement("span", {
      key: "line-".concat(i),
      className: "react-syntax-highlighter-line-number",
      style: typeof n == "function" ? n(c) : n
    }, "".concat(c, `
`));
  });
}
function x2(e) {
  var t = e.codeString, r = e.codeStyle, n = e.containerStyle, a = n === void 0 ? {
    float: "left",
    paddingRight: "10px"
  } : n, i = e.numberStyle, c = i === void 0 ? {} : i, l = e.startingLineNumber;
  return /* @__PURE__ */ $t.createElement("code", {
    style: Object.assign({}, r, a)
  }, R2({
    lines: t.replace(/\n$/, "").split(`
`),
    style: c,
    startingLineNumber: l
  }));
}
function E2(e) {
  return "".concat(e.toString().length, ".25em");
}
function dc(e, t) {
  return {
    type: "element",
    tagName: "span",
    properties: {
      key: "line-number--".concat(e),
      className: ["comment", "linenumber", "react-syntax-highlighter-line-number"],
      style: t
    },
    children: [{
      type: "text",
      value: e
    }]
  };
}
function pc(e, t, r) {
  var n = {
    display: "inline-block",
    minWidth: E2(r),
    paddingRight: "1em",
    textAlign: "right",
    userSelect: "none"
  }, a = typeof e == "function" ? e(t) : e, i = bt(bt({}, n), a);
  return i;
}
function Dn(e) {
  var t = e.children, r = e.lineNumber, n = e.lineNumberStyle, a = e.largestLineNumber, i = e.showInlineLineNumbers, c = e.lineProps, l = c ===
  void 0 ? {} : c, s = e.className, u = s === void 0 ? [] : s, f = e.showLineNumbers, d = e.wrapLongLines, m = e.wrapLines, v = m === void 0 ?
  !1 : m, y = v ? bt({}, typeof l == "function" ? l(r) : l) : {};
  if (y.className = y.className ? [].concat(Nn(y.className.trim().split(/\s+/)), Nn(u)) : u, r && i) {
    var p = pc(n, r, a);
    t.unshift(dc(r, p));
  }
  return d & f && (y.style = bt({
    display: "flex"
  }, y.style)), {
    type: "element",
    tagName: "span",
    properties: y,
    children: t
  };
}
function mc(e) {
  for (var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : [], r = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] :
  [], n = 0; n < e.length; n++) {
    var a = e[n];
    if (a.type === "text")
      r.push(Dn({
        children: [a],
        className: Nn(new Set(t))
      }));
    else if (a.children) {
      var i = t.concat(a.properties.className);
      mc(a.children, i).forEach(function(c) {
        return r.push(c);
      });
    }
  }
  return r;
}
function S2(e, t, r, n, a, i, c, l, s) {
  var u, f = mc(e.value), d = [], m = -1, v = 0;
  function y(E, R) {
    var S = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [];
    return Dn({
      children: E,
      lineNumber: R,
      lineNumberStyle: l,
      largestLineNumber: c,
      showInlineLineNumbers: a,
      lineProps: r,
      className: S,
      showLineNumbers: n,
      wrapLongLines: s,
      wrapLines: t
    });
  }
  o(y, "createWrappedLine");
  function p(E, R) {
    if (n && R && a) {
      var S = pc(l, R, c);
      E.unshift(dc(R, S));
    }
    return E;
  }
  o(p, "createUnwrappedLine");
  function h(E, R) {
    var S = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [];
    return t || S.length > 0 ? y(E, R, S) : p(E, R);
  }
  o(h, "createLine");
  for (var g = /* @__PURE__ */ o(function() {
    var R = f[v], S = R.children[0].value, A = y2(S);
    if (A) {
      var M = S.split(`
`);
      M.forEach(function(L, P) {
        var _ = n && d.length + i, D = {
          type: "text",
          value: "".concat(L, `
`)
        };
        if (P === 0) {
          var K = f.slice(m + 1, v).concat(Dn({
            children: [D],
            className: R.properties.className
          })), T = h(K, _);
          d.push(T);
        } else if (P === M.length - 1) {
          var z = f[v + 1] && f[v + 1].children && f[v + 1].children[0], k = {
            type: "text",
            value: "".concat(L)
          };
          if (z) {
            var V = Dn({
              children: [k],
              className: R.properties.className
            });
            f.splice(v + 1, 0, V);
          } else {
            var F = [k], j = h(F, _, R.properties.className);
            d.push(j);
          }
        } else {
          var O = [D], G = h(O, _, R.properties.className);
          d.push(G);
        }
      }), m = v;
    }
    v++;
  }, "_loop"); v < f.length; )
    g();
  if (m !== f.length - 1) {
    var w = f.slice(m + 1, f.length);
    if (w && w.length) {
      var b = n && d.length + i, x = h(w, b);
      d.push(x);
    }
  }
  return t ? d : (u = []).concat.apply(u, d);
}
function C2(e) {
  var t = e.rows, r = e.stylesheet, n = e.useInlineStyles;
  return t.map(function(a, i) {
    return _t({
      node: a,
      stylesheet: r,
      useInlineStyles: n,
      key: "code-segement".concat(i)
    });
  });
}
function hc(e) {
  return e && typeof e.highlightAuto < "u";
}
function M2(e) {
  var t = e.astGenerator, r = e.language, n = e.code, a = e.defaultCodeValue;
  if (hc(t)) {
    var i = sc(t, r);
    return r === "text" ? {
      value: a,
      language: "text"
    } : i ? t.highlight(r, n) : t.highlightAuto(n);
  }
  try {
    return r && r !== "text" ? {
      value: t.highlight(n, r)
    } : {
      value: a
    };
  } catch {
    return {
      value: a
    };
  }
}
function da(e, t) {
  return /* @__PURE__ */ o(function(n) {
    var a = n.language, i = n.children, c = n.style, l = c === void 0 ? t : c, s = n.customStyle, u = s === void 0 ? {} : s, f = n.codeTagProps,
    d = f === void 0 ? {
      className: a ? "language-".concat(a) : void 0,
      style: bt(bt({}, l['code[class*="language-"]']), l['code[class*="language-'.concat(a, '"]')])
    } : f, m = n.useInlineStyles, v = m === void 0 ? !0 : m, y = n.showLineNumbers, p = y === void 0 ? !1 : y, h = n.showInlineLineNumbers, g = h ===
    void 0 ? !0 : h, w = n.startingLineNumber, b = w === void 0 ? 1 : w, x = n.lineNumberContainerStyle, E = n.lineNumberStyle, R = E === void 0 ?
    {} : E, S = n.wrapLines, A = n.wrapLongLines, M = A === void 0 ? !1 : A, L = n.lineProps, P = L === void 0 ? {} : L, _ = n.renderer, D = n.
    PreTag, K = D === void 0 ? "pre" : D, T = n.CodeTag, z = T === void 0 ? "code" : T, k = n.code, V = k === void 0 ? (Array.isArray(i) ? i[0] :
    i) || "" : k, F = n.astGenerator, j = ql(n, w2);
    F = F || e;
    var O = p ? /* @__PURE__ */ $t.createElement(x2, {
      containerStyle: x,
      codeStyle: d.style || {},
      numberStyle: R,
      startingLineNumber: b,
      codeString: V
    }) : null, G = l.hljs || l['pre[class*="language-"]'] || {
      backgroundColor: "#fff"
    }, Ee = hc(F) ? "hljs" : "prismjs", pe = v ? Object.assign({}, j, {
      style: Object.assign({}, G, u)
    }) : Object.assign({}, j, {
      className: j.className ? "".concat(Ee, " ").concat(j.className) : Ee,
      style: Object.assign({}, u)
    });
    if (M ? d.style = bt({
      whiteSpace: "pre-wrap"
    }, d.style) : d.style = bt({
      whiteSpace: "pre"
    }, d.style), !F)
      return /* @__PURE__ */ $t.createElement(K, pe, O, /* @__PURE__ */ $t.createElement(z, d, V));
    (S === void 0 && _ || M) && (S = !0), _ = _ || C2;
    var se = [{
      type: "text",
      value: V
    }], ue = M2({
      astGenerator: F,
      language: a,
      code: V,
      defaultCodeValue: se
    });
    ue.language === null && (ue.value = se);
    var ve = ue.value.length;
    ve === 1 && ue.value[0].type === "text" && (ve = ue.value[0].value.split(`
`).length);
    var Se = ve + b, Ot = S2(ue, S, P, p, g, b, Se, R, M);
    return /* @__PURE__ */ $t.createElement(K, pe, /* @__PURE__ */ $t.createElement(z, d, !g && O, _({
      rows: Ot,
      stylesheet: l,
      useInlineStyles: v
    })));
  }, "SyntaxHighlighter");
}
var w2, b2, gc = C(() => {
  Gl();
  rc();
  sa();
  fa();
  uc();
  w2 = ["language", "children", "style", "customStyle", "codeTagProps", "useInlineStyles", "showLineNumbers", "showInlineLineNumbers", "star\
tingLineNumber", "lineNumberContainerStyle", "lineNumberStyle", "wrapLines", "wrapLongLines", "lineProps", "renderer", "PreTag", "CodeTag", "\
code", "astGenerator"];
  o(fc, "ownKeys");
  o(bt, "_objectSpread");
  b2 = /\n/g;
  o(y2, "getNewLines");
  o(R2, "getAllLineNumbers");
  o(x2, "AllLineNumbers");
  o(E2, "getEmWidthOfNumber");
  o(dc, "getInlineLineNumber");
  o(pc, "assembleLineNumberStyles");
  o(Dn, "createLineElement");
  o(mc, "flattenCodeTree");
  o(S2, "processLines");
  o(C2, "defaultRenderer");
  o(hc, "isHighlightJs");
  o(M2, "getCodeTree");
  o(da, "default");
});

// ../node_modules/xtend/immutable.js
var wc = H((kb, vc) => {
  vc.exports = L2;
  var A2 = Object.prototype.hasOwnProperty;
  function L2() {
    for (var e = {}, t = 0; t < arguments.length; t++) {
      var r = arguments[t];
      for (var n in r)
        A2.call(r, n) && (e[n] = r[n]);
    }
    return e;
  }
  o(L2, "extend");
});

// ../node_modules/hastscript/node_modules/property-information/lib/util/schema.js
var ma = H((Bb, yc) => {
  "use strict";
  yc.exports = bc;
  var pa = bc.prototype;
  pa.space = null;
  pa.normal = {};
  pa.property = {};
  function bc(e, t, r) {
    this.property = e, this.normal = t, r && (this.space = r);
  }
  o(bc, "Schema");
});

// ../node_modules/hastscript/node_modules/property-information/lib/util/merge.js
var Ec = H((Fb, xc) => {
  "use strict";
  var Rc = wc(), I2 = ma();
  xc.exports = z2;
  function z2(e) {
    for (var t = e.length, r = [], n = [], a = -1, i, c; ++a < t; )
      i = e[a], r.push(i.property), n.push(i.normal), c = i.space;
    return new I2(
      Rc.apply(null, r),
      Rc.apply(null, n),
      c
    );
  }
  o(z2, "merge");
});

// ../node_modules/hastscript/node_modules/property-information/normalize.js
var _n = H((_b, Sc) => {
  "use strict";
  Sc.exports = T2;
  function T2(e) {
    return e.toLowerCase();
  }
  o(T2, "normalize");
});

// ../node_modules/hastscript/node_modules/property-information/lib/util/info.js
var ha = H((Vb, Mc) => {
  "use strict";
  Mc.exports = Cc;
  var Fe = Cc.prototype;
  Fe.space = null;
  Fe.attribute = null;
  Fe.property = null;
  Fe.boolean = !1;
  Fe.booleanish = !1;
  Fe.overloadedBoolean = !1;
  Fe.number = !1;
  Fe.commaSeparated = !1;
  Fe.spaceSeparated = !1;
  Fe.commaOrSpaceSeparated = !1;
  Fe.mustUseProperty = !1;
  Fe.defined = !1;
  function Cc(e, t) {
    this.property = e, this.attribute = t;
  }
  o(Cc, "Info");
});

// ../node_modules/hastscript/node_modules/property-information/lib/util/types.js
var $n = H((yt) => {
  "use strict";
  var H2 = 0;
  yt.boolean = Vt();
  yt.booleanish = Vt();
  yt.overloadedBoolean = Vt();
  yt.number = Vt();
  yt.spaceSeparated = Vt();
  yt.commaSeparated = Vt();
  yt.commaOrSpaceSeparated = Vt();
  function Vt() {
    return Math.pow(2, ++H2);
  }
  o(Vt, "increment");
});

// ../node_modules/hastscript/node_modules/property-information/lib/util/defined-info.js
var va = H((qb, Tc) => {
  "use strict";
  var Ic = ha(), Ac = $n();
  Tc.exports = ga;
  ga.prototype = new Ic();
  ga.prototype.defined = !0;
  var zc = [
    "boolean",
    "booleanish",
    "overloadedBoolean",
    "number",
    "commaSeparated",
    "spaceSeparated",
    "commaOrSpaceSeparated"
  ], P2 = zc.length;
  function ga(e, t, r, n) {
    var a = -1, i;
    for (Lc(this, "space", n), Ic.call(this, e, t); ++a < P2; )
      i = zc[a], Lc(this, i, (r & Ac[i]) === Ac[i]);
  }
  o(ga, "DefinedInfo");
  function Lc(e, t, r) {
    r && (e[t] = r);
  }
  o(Lc, "mark");
});

// ../node_modules/hastscript/node_modules/property-information/lib/util/create.js
var dr = H((Yb, Pc) => {
  "use strict";
  var Hc = _n(), k2 = ma(), O2 = va();
  Pc.exports = B2;
  function B2(e) {
    var t = e.space, r = e.mustUseProperty || [], n = e.attributes || {}, a = e.properties, i = e.transform, c = {}, l = {}, s, u;
    for (s in a)
      u = new O2(
        s,
        i(n, s),
        a[s],
        t
      ), r.indexOf(s) !== -1 && (u.mustUseProperty = !0), c[s] = u, l[Hc(s)] = s, l[Hc(u.attribute)] = s;
    return new k2(c, l, t);
  }
  o(B2, "create");
});

// ../node_modules/hastscript/node_modules/property-information/lib/xlink.js
var Oc = H((Zb, kc) => {
  "use strict";
  var N2 = dr();
  kc.exports = N2({
    space: "xlink",
    transform: F2,
    properties: {
      xLinkActuate: null,
      xLinkArcRole: null,
      xLinkHref: null,
      xLinkRole: null,
      xLinkShow: null,
      xLinkTitle: null,
      xLinkType: null
    }
  });
  function F2(e, t) {
    return "xlink:" + t.slice(5).toLowerCase();
  }
  o(F2, "xlinkTransform");
});

// ../node_modules/hastscript/node_modules/property-information/lib/xml.js
var Nc = H((Jb, Bc) => {
  "use strict";
  var D2 = dr();
  Bc.exports = D2({
    space: "xml",
    transform: _2,
    properties: {
      xmlLang: null,
      xmlBase: null,
      xmlSpace: null
    }
  });
  function _2(e, t) {
    return "xml:" + t.slice(3).toLowerCase();
  }
  o(_2, "xmlTransform");
});

// ../node_modules/hastscript/node_modules/property-information/lib/util/case-sensitive-transform.js
var Dc = H((e9, Fc) => {
  "use strict";
  Fc.exports = $2;
  function $2(e, t) {
    return t in e ? e[t] : t;
  }
  o($2, "caseSensitiveTransform");
});

// ../node_modules/hastscript/node_modules/property-information/lib/util/case-insensitive-transform.js
var wa = H((r9, _c) => {
  "use strict";
  var V2 = Dc();
  _c.exports = j2;
  function j2(e, t) {
    return V2(e, t.toLowerCase());
  }
  o(j2, "caseInsensitiveTransform");
});

// ../node_modules/hastscript/node_modules/property-information/lib/xmlns.js
var Vc = H((o9, $c) => {
  "use strict";
  var W2 = dr(), U2 = wa();
  $c.exports = W2({
    space: "xmlns",
    attributes: {
      xmlnsxlink: "xmlns:xlink"
    },
    transform: U2,
    properties: {
      xmlns: null,
      xmlnsXLink: null
    }
  });
});

// ../node_modules/hastscript/node_modules/property-information/lib/aria.js
var Wc = H((a9, jc) => {
  "use strict";
  var ba = $n(), q2 = dr(), Ae = ba.booleanish, De = ba.number, jt = ba.spaceSeparated;
  jc.exports = q2({
    transform: G2,
    properties: {
      ariaActiveDescendant: null,
      ariaAtomic: Ae,
      ariaAutoComplete: null,
      ariaBusy: Ae,
      ariaChecked: Ae,
      ariaColCount: De,
      ariaColIndex: De,
      ariaColSpan: De,
      ariaControls: jt,
      ariaCurrent: null,
      ariaDescribedBy: jt,
      ariaDetails: null,
      ariaDisabled: Ae,
      ariaDropEffect: jt,
      ariaErrorMessage: null,
      ariaExpanded: Ae,
      ariaFlowTo: jt,
      ariaGrabbed: Ae,
      ariaHasPopup: null,
      ariaHidden: Ae,
      ariaInvalid: null,
      ariaKeyShortcuts: null,
      ariaLabel: null,
      ariaLabelledBy: jt,
      ariaLevel: De,
      ariaLive: null,
      ariaModal: Ae,
      ariaMultiLine: Ae,
      ariaMultiSelectable: Ae,
      ariaOrientation: null,
      ariaOwns: jt,
      ariaPlaceholder: null,
      ariaPosInSet: De,
      ariaPressed: Ae,
      ariaReadOnly: Ae,
      ariaRelevant: null,
      ariaRequired: Ae,
      ariaRoleDescription: jt,
      ariaRowCount: De,
      ariaRowIndex: De,
      ariaRowSpan: De,
      ariaSelected: Ae,
      ariaSetSize: De,
      ariaSort: null,
      ariaValueMax: De,
      ariaValueMin: De,
      ariaValueNow: De,
      ariaValueText: null,
      role: null
    }
  });
  function G2(e, t) {
    return t === "role" ? t : "aria-" + t.slice(4).toLowerCase();
  }
  o(G2, "ariaTransform");
});

// ../node_modules/hastscript/node_modules/property-information/lib/html.js
var qc = H((l9, Uc) => {
  "use strict";
  var pr = $n(), Y2 = dr(), X2 = wa(), B = pr.boolean, Z2 = pr.overloadedBoolean, tn = pr.booleanish, Y = pr.number, ye = pr.spaceSeparated,
  Vn = pr.commaSeparated;
  Uc.exports = Y2({
    space: "html",
    attributes: {
      acceptcharset: "accept-charset",
      classname: "class",
      htmlfor: "for",
      httpequiv: "http-equiv"
    },
    transform: X2,
    mustUseProperty: ["checked", "multiple", "muted", "selected"],
    properties: {
      // Standard Properties.
      abbr: null,
      accept: Vn,
      acceptCharset: ye,
      accessKey: ye,
      action: null,
      allow: null,
      allowFullScreen: B,
      allowPaymentRequest: B,
      allowUserMedia: B,
      alt: null,
      as: null,
      async: B,
      autoCapitalize: null,
      autoComplete: ye,
      autoFocus: B,
      autoPlay: B,
      capture: B,
      charSet: null,
      checked: B,
      cite: null,
      className: ye,
      cols: Y,
      colSpan: null,
      content: null,
      contentEditable: tn,
      controls: B,
      controlsList: ye,
      coords: Y | Vn,
      crossOrigin: null,
      data: null,
      dateTime: null,
      decoding: null,
      default: B,
      defer: B,
      dir: null,
      dirName: null,
      disabled: B,
      download: Z2,
      draggable: tn,
      encType: null,
      enterKeyHint: null,
      form: null,
      formAction: null,
      formEncType: null,
      formMethod: null,
      formNoValidate: B,
      formTarget: null,
      headers: ye,
      height: Y,
      hidden: B,
      high: Y,
      href: null,
      hrefLang: null,
      htmlFor: ye,
      httpEquiv: ye,
      id: null,
      imageSizes: null,
      imageSrcSet: Vn,
      inputMode: null,
      integrity: null,
      is: null,
      isMap: B,
      itemId: null,
      itemProp: ye,
      itemRef: ye,
      itemScope: B,
      itemType: ye,
      kind: null,
      label: null,
      lang: null,
      language: null,
      list: null,
      loading: null,
      loop: B,
      low: Y,
      manifest: null,
      max: null,
      maxLength: Y,
      media: null,
      method: null,
      min: null,
      minLength: Y,
      multiple: B,
      muted: B,
      name: null,
      nonce: null,
      noModule: B,
      noValidate: B,
      onAbort: null,
      onAfterPrint: null,
      onAuxClick: null,
      onBeforePrint: null,
      onBeforeUnload: null,
      onBlur: null,
      onCancel: null,
      onCanPlay: null,
      onCanPlayThrough: null,
      onChange: null,
      onClick: null,
      onClose: null,
      onContextMenu: null,
      onCopy: null,
      onCueChange: null,
      onCut: null,
      onDblClick: null,
      onDrag: null,
      onDragEnd: null,
      onDragEnter: null,
      onDragExit: null,
      onDragLeave: null,
      onDragOver: null,
      onDragStart: null,
      onDrop: null,
      onDurationChange: null,
      onEmptied: null,
      onEnded: null,
      onError: null,
      onFocus: null,
      onFormData: null,
      onHashChange: null,
      onInput: null,
      onInvalid: null,
      onKeyDown: null,
      onKeyPress: null,
      onKeyUp: null,
      onLanguageChange: null,
      onLoad: null,
      onLoadedData: null,
      onLoadedMetadata: null,
      onLoadEnd: null,
      onLoadStart: null,
      onMessage: null,
      onMessageError: null,
      onMouseDown: null,
      onMouseEnter: null,
      onMouseLeave: null,
      onMouseMove: null,
      onMouseOut: null,
      onMouseOver: null,
      onMouseUp: null,
      onOffline: null,
      onOnline: null,
      onPageHide: null,
      onPageShow: null,
      onPaste: null,
      onPause: null,
      onPlay: null,
      onPlaying: null,
      onPopState: null,
      onProgress: null,
      onRateChange: null,
      onRejectionHandled: null,
      onReset: null,
      onResize: null,
      onScroll: null,
      onSecurityPolicyViolation: null,
      onSeeked: null,
      onSeeking: null,
      onSelect: null,
      onSlotChange: null,
      onStalled: null,
      onStorage: null,
      onSubmit: null,
      onSuspend: null,
      onTimeUpdate: null,
      onToggle: null,
      onUnhandledRejection: null,
      onUnload: null,
      onVolumeChange: null,
      onWaiting: null,
      onWheel: null,
      open: B,
      optimum: Y,
      pattern: null,
      ping: ye,
      placeholder: null,
      playsInline: B,
      poster: null,
      preload: null,
      readOnly: B,
      referrerPolicy: null,
      rel: ye,
      required: B,
      reversed: B,
      rows: Y,
      rowSpan: Y,
      sandbox: ye,
      scope: null,
      scoped: B,
      seamless: B,
      selected: B,
      shape: null,
      size: Y,
      sizes: null,
      slot: null,
      span: Y,
      spellCheck: tn,
      src: null,
      srcDoc: null,
      srcLang: null,
      srcSet: Vn,
      start: Y,
      step: null,
      style: null,
      tabIndex: Y,
      target: null,
      title: null,
      translate: null,
      type: null,
      typeMustMatch: B,
      useMap: null,
      value: tn,
      width: Y,
      wrap: null,
      // Legacy.
      // See: https://html.spec.whatwg.org/#other-elements,-attributes-and-apis
      align: null,
      // Several. Use CSS `text-align` instead,
      aLink: null,
      // `<body>`. Use CSS `a:active {color}` instead
      archive: ye,
      // `<object>`. List of URIs to archives
      axis: null,
      // `<td>` and `<th>`. Use `scope` on `<th>`
      background: null,
      // `<body>`. Use CSS `background-image` instead
      bgColor: null,
      // `<body>` and table elements. Use CSS `background-color` instead
      border: Y,
      // `<table>`. Use CSS `border-width` instead,
      borderColor: null,
      // `<table>`. Use CSS `border-color` instead,
      bottomMargin: Y,
      // `<body>`
      cellPadding: null,
      // `<table>`
      cellSpacing: null,
      // `<table>`
      char: null,
      // Several table elements. When `align=char`, sets the character to align on
      charOff: null,
      // Several table elements. When `char`, offsets the alignment
      classId: null,
      // `<object>`
      clear: null,
      // `<br>`. Use CSS `clear` instead
      code: null,
      // `<object>`
      codeBase: null,
      // `<object>`
      codeType: null,
      // `<object>`
      color: null,
      // `<font>` and `<hr>`. Use CSS instead
      compact: B,
      // Lists. Use CSS to reduce space between items instead
      declare: B,
      // `<object>`
      event: null,
      // `<script>`
      face: null,
      // `<font>`. Use CSS instead
      frame: null,
      // `<table>`
      frameBorder: null,
      // `<iframe>`. Use CSS `border` instead
      hSpace: Y,
      // `<img>` and `<object>`
      leftMargin: Y,
      // `<body>`
      link: null,
      // `<body>`. Use CSS `a:link {color: *}` instead
      longDesc: null,
      // `<frame>`, `<iframe>`, and `<img>`. Use an `<a>`
      lowSrc: null,
      // `<img>`. Use a `<picture>`
      marginHeight: Y,
      // `<body>`
      marginWidth: Y,
      // `<body>`
      noResize: B,
      // `<frame>`
      noHref: B,
      // `<area>`. Use no href instead of an explicit `nohref`
      noShade: B,
      // `<hr>`. Use background-color and height instead of borders
      noWrap: B,
      // `<td>` and `<th>`
      object: null,
      // `<applet>`
      profile: null,
      // `<head>`
      prompt: null,
      // `<isindex>`
      rev: null,
      // `<link>`
      rightMargin: Y,
      // `<body>`
      rules: null,
      // `<table>`
      scheme: null,
      // `<meta>`
      scrolling: tn,
      // `<frame>`. Use overflow in the child context
      standby: null,
      // `<object>`
      summary: null,
      // `<table>`
      text: null,
      // `<body>`. Use CSS `color` instead
      topMargin: Y,
      // `<body>`
      valueType: null,
      // `<param>`
      version: null,
      // `<html>`. Use a doctype.
      vAlign: null,
      // Several. Use CSS `vertical-align` instead
      vLink: null,
      // `<body>`. Use CSS `a:visited {color}` instead
      vSpace: Y,
      // `<img>` and `<object>`
      // Non-standard Properties.
      allowTransparency: null,
      autoCorrect: null,
      autoSave: null,
      disablePictureInPicture: B,
      disableRemotePlayback: B,
      prefix: null,
      property: null,
      results: Y,
      security: null,
      unselectable: null
    }
  });
});

// ../node_modules/hastscript/node_modules/property-information/html.js
var Yc = H((c9, Gc) => {
  "use strict";
  var K2 = Ec(), J2 = Oc(), Q2 = Nc(), e4 = Vc(), t4 = Wc(), r4 = qc();
  Gc.exports = K2([Q2, J2, e4, t4, r4]);
});

// ../node_modules/hastscript/node_modules/property-information/find.js
var Kc = H((s9, Zc) => {
  "use strict";
  var n4 = _n(), o4 = va(), a4 = ha(), ya = "data";
  Zc.exports = c4;
  var i4 = /^data[-\w.:]+$/i, Xc = /-[a-z]/g, l4 = /[A-Z]/g;
  function c4(e, t) {
    var r = n4(t), n = t, a = a4;
    return r in e.normal ? e.property[e.normal[r]] : (r.length > 4 && r.slice(0, 4) === ya && i4.test(t) && (t.charAt(4) === "-" ? n = s4(t) :
    t = u4(t), a = o4), new a(n, t));
  }
  o(c4, "find");
  function s4(e) {
    var t = e.slice(5).replace(Xc, d4);
    return ya + t.charAt(0).toUpperCase() + t.slice(1);
  }
  o(s4, "datasetToProperty");
  function u4(e) {
    var t = e.slice(4);
    return Xc.test(t) ? e : (t = t.replace(l4, f4), t.charAt(0) !== "-" && (t = "-" + t), ya + t);
  }
  o(u4, "datasetToAttribute");
  function f4(e) {
    return "-" + e.toLowerCase();
  }
  o(f4, "kebab");
  function d4(e) {
    return e.charAt(1).toUpperCase();
  }
  o(d4, "camelcase");
});

// ../node_modules/hast-util-parse-selector/index.js
var es = H((f9, Qc) => {
  "use strict";
  Qc.exports = p4;
  var Jc = /[#.]/g;
  function p4(e, t) {
    for (var r = e || "", n = t || "div", a = {}, i = 0, c, l, s; i < r.length; )
      Jc.lastIndex = i, s = Jc.exec(r), c = r.slice(i, s ? s.index : r.length), c && (l ? l === "#" ? a.id = c : a.className ? a.className.push(
      c) : a.className = [c] : n = c, i += c.length), s && (l = s[0], i++);
    return { type: "element", tagName: n, properties: a, children: [] };
  }
  o(p4, "parse");
});

// ../node_modules/hastscript/node_modules/space-separated-tokens/index.js
var rs = H((Ra) => {
  "use strict";
  Ra.parse = g4;
  Ra.stringify = v4;
  var ts = "", m4 = " ", h4 = /[ \t\n\r\f]+/g;
  function g4(e) {
    var t = String(e || ts).trim();
    return t === ts ? [] : t.split(h4);
  }
  o(g4, "parse");
  function v4(e) {
    return e.join(m4).trim();
  }
  o(v4, "stringify");
});

// ../node_modules/hastscript/node_modules/comma-separated-tokens/index.js
var os = H((Ea) => {
  "use strict";
  Ea.parse = w4;
  Ea.stringify = b4;
  var xa = ",", ns = " ", rn = "";
  function w4(e) {
    for (var t = [], r = String(e || rn), n = r.indexOf(xa), a = 0, i = !1, c; !i; )
      n === -1 && (n = r.length, i = !0), c = r.slice(a, n).trim(), (c || !i) && t.push(c), a = n + 1, n = r.indexOf(xa, a);
    return t;
  }
  o(w4, "parse");
  function b4(e, t) {
    var r = t || {}, n = r.padLeft === !1 ? rn : ns, a = r.padRight ? ns : rn;
    return e[e.length - 1] === rn && (e = e.concat(rn)), e.join(a + xa + n).trim();
  }
  o(b4, "stringify");
});

// ../node_modules/hastscript/factory.js
var fs = H((v9, us) => {
  "use strict";
  var y4 = Kc(), as = _n(), R4 = es(), is = rs().parse, ls = os().parse;
  us.exports = E4;
  var x4 = {}.hasOwnProperty;
  function E4(e, t, r) {
    var n = r ? L4(r) : null;
    return a;
    function a(c, l) {
      var s = R4(c, t), u = Array.prototype.slice.call(arguments, 2), f = s.tagName.toLowerCase(), d;
      if (s.tagName = n && x4.call(n, f) ? n[f] : f, l && S4(l, s) && (u.unshift(l), l = null), l)
        for (d in l)
          i(s.properties, d, l[d]);
      return ss(s.children, u), s.tagName === "template" && (s.content = { type: "root", children: s.children }, s.children = []), s;
    }
    function i(c, l, s) {
      var u, f, d;
      s == null || s !== s || (u = y4(e, l), f = u.property, d = s, typeof d == "string" && (u.spaceSeparated ? d = is(d) : u.commaSeparated ?
      d = ls(d) : u.commaOrSpaceSeparated && (d = is(ls(d).join(" ")))), f === "style" && typeof s != "string" && (d = A4(d)), f === "classN\
ame" && c.className && (d = c.className.concat(d)), c[f] = M4(u, f, d));
    }
  }
  o(E4, "factory");
  function S4(e, t) {
    return typeof e == "string" || "length" in e || C4(t.tagName, e);
  }
  o(S4, "isChildren");
  function C4(e, t) {
    var r = t.type;
    return e === "input" || !r || typeof r != "string" ? !1 : typeof t.children == "object" && "length" in t.children ? !0 : (r = r.toLowerCase(),
    e === "button" ? r !== "menu" && r !== "submit" && r !== "reset" && r !== "button" : "value" in t);
  }
  o(C4, "isNode");
  function ss(e, t) {
    var r, n;
    if (typeof t == "string" || typeof t == "number") {
      e.push({ type: "text", value: String(t) });
      return;
    }
    if (typeof t == "object" && "length" in t) {
      for (r = -1, n = t.length; ++r < n; )
        ss(e, t[r]);
      return;
    }
    if (typeof t != "object" || !("type" in t))
      throw new Error("Expected node, nodes, or string, got `" + t + "`");
    e.push(t);
  }
  o(ss, "addChild");
  function M4(e, t, r) {
    var n, a, i;
    if (typeof r != "object" || !("length" in r))
      return cs(e, t, r);
    for (a = r.length, n = -1, i = []; ++n < a; )
      i[n] = cs(e, t, r[n]);
    return i;
  }
  o(M4, "parsePrimitives");
  function cs(e, t, r) {
    var n = r;
    return e.number || e.positiveNumber ? !isNaN(n) && n !== "" && (n = Number(n)) : (e.boolean || e.overloadedBoolean) && typeof n == "stri\
ng" && (n === "" || as(r) === as(t)) && (n = !0), n;
  }
  o(cs, "parsePrimitive");
  function A4(e) {
    var t = [], r;
    for (r in e)
      t.push([r, e[r]].join(": "));
    return t.join("; ");
  }
  o(A4, "style");
  function L4(e) {
    for (var t = e.length, r = -1, n = {}, a; ++r < t; )
      a = e[r], n[a.toLowerCase()] = a;
    return n;
  }
  o(L4, "createAdjustMap");
});

// ../node_modules/hastscript/html.js
var ms = H((b9, ps) => {
  "use strict";
  var I4 = Yc(), z4 = fs(), ds = z4(I4, "div");
  ds.displayName = "html";
  ps.exports = ds;
});

// ../node_modules/hastscript/index.js
var gs = H((y9, hs) => {
  "use strict";
  hs.exports = ms();
});

// ../node_modules/refractor/node_modules/character-entities-legacy/index.json
var vs = H((R9, T4) => {
  T4.exports = {
    AElig: "\xC6",
    AMP: "&",
    Aacute: "\xC1",
    Acirc: "\xC2",
    Agrave: "\xC0",
    Aring: "\xC5",
    Atilde: "\xC3",
    Auml: "\xC4",
    COPY: "\xA9",
    Ccedil: "\xC7",
    ETH: "\xD0",
    Eacute: "\xC9",
    Ecirc: "\xCA",
    Egrave: "\xC8",
    Euml: "\xCB",
    GT: ">",
    Iacute: "\xCD",
    Icirc: "\xCE",
    Igrave: "\xCC",
    Iuml: "\xCF",
    LT: "<",
    Ntilde: "\xD1",
    Oacute: "\xD3",
    Ocirc: "\xD4",
    Ograve: "\xD2",
    Oslash: "\xD8",
    Otilde: "\xD5",
    Ouml: "\xD6",
    QUOT: '"',
    REG: "\xAE",
    THORN: "\xDE",
    Uacute: "\xDA",
    Ucirc: "\xDB",
    Ugrave: "\xD9",
    Uuml: "\xDC",
    Yacute: "\xDD",
    aacute: "\xE1",
    acirc: "\xE2",
    acute: "\xB4",
    aelig: "\xE6",
    agrave: "\xE0",
    amp: "&",
    aring: "\xE5",
    atilde: "\xE3",
    auml: "\xE4",
    brvbar: "\xA6",
    ccedil: "\xE7",
    cedil: "\xB8",
    cent: "\xA2",
    copy: "\xA9",
    curren: "\xA4",
    deg: "\xB0",
    divide: "\xF7",
    eacute: "\xE9",
    ecirc: "\xEA",
    egrave: "\xE8",
    eth: "\xF0",
    euml: "\xEB",
    frac12: "\xBD",
    frac14: "\xBC",
    frac34: "\xBE",
    gt: ">",
    iacute: "\xED",
    icirc: "\xEE",
    iexcl: "\xA1",
    igrave: "\xEC",
    iquest: "\xBF",
    iuml: "\xEF",
    laquo: "\xAB",
    lt: "<",
    macr: "\xAF",
    micro: "\xB5",
    middot: "\xB7",
    nbsp: "\xA0",
    not: "\xAC",
    ntilde: "\xF1",
    oacute: "\xF3",
    ocirc: "\xF4",
    ograve: "\xF2",
    ordf: "\xAA",
    ordm: "\xBA",
    oslash: "\xF8",
    otilde: "\xF5",
    ouml: "\xF6",
    para: "\xB6",
    plusmn: "\xB1",
    pound: "\xA3",
    quot: '"',
    raquo: "\xBB",
    reg: "\xAE",
    sect: "\xA7",
    shy: "\xAD",
    sup1: "\xB9",
    sup2: "\xB2",
    sup3: "\xB3",
    szlig: "\xDF",
    thorn: "\xFE",
    times: "\xD7",
    uacute: "\xFA",
    ucirc: "\xFB",
    ugrave: "\xF9",
    uml: "\xA8",
    uuml: "\xFC",
    yacute: "\xFD",
    yen: "\xA5",
    yuml: "\xFF"
  };
});

// ../node_modules/refractor/node_modules/character-reference-invalid/index.json
var ws = H((x9, H4) => {
  H4.exports = {
    "0": "\uFFFD",
    "128": "\u20AC",
    "130": "\u201A",
    "131": "\u0192",
    "132": "\u201E",
    "133": "\u2026",
    "134": "\u2020",
    "135": "\u2021",
    "136": "\u02C6",
    "137": "\u2030",
    "138": "\u0160",
    "139": "\u2039",
    "140": "\u0152",
    "142": "\u017D",
    "145": "\u2018",
    "146": "\u2019",
    "147": "\u201C",
    "148": "\u201D",
    "149": "\u2022",
    "150": "\u2013",
    "151": "\u2014",
    "152": "\u02DC",
    "153": "\u2122",
    "154": "\u0161",
    "155": "\u203A",
    "156": "\u0153",
    "158": "\u017E",
    "159": "\u0178"
  };
});

// ../node_modules/refractor/node_modules/is-decimal/index.js
var Sa = H((E9, bs) => {
  "use strict";
  bs.exports = P4;
  function P4(e) {
    var t = typeof e == "string" ? e.charCodeAt(0) : e;
    return t >= 48 && t <= 57;
  }
  o(P4, "decimal");
});

// ../node_modules/refractor/node_modules/is-hexadecimal/index.js
var Rs = H((C9, ys) => {
  "use strict";
  ys.exports = k4;
  function k4(e) {
    var t = typeof e == "string" ? e.charCodeAt(0) : e;
    return t >= 97 && t <= 102 || t >= 65 && t <= 70 || t >= 48 && t <= 57;
  }
  o(k4, "hexadecimal");
});

// ../node_modules/refractor/node_modules/is-alphabetical/index.js
var Es = H((A9, xs) => {
  "use strict";
  xs.exports = O4;
  function O4(e) {
    var t = typeof e == "string" ? e.charCodeAt(0) : e;
    return t >= 97 && t <= 122 || t >= 65 && t <= 90;
  }
  o(O4, "alphabetical");
});

// ../node_modules/refractor/node_modules/is-alphanumerical/index.js
var Cs = H((I9, Ss) => {
  "use strict";
  var B4 = Es(), N4 = Sa();
  Ss.exports = F4;
  function F4(e) {
    return B4(e) || N4(e);
  }
  o(F4, "alphanumerical");
});

// ../node_modules/refractor/node_modules/parse-entities/decode-entity.browser.js
var As = H((T9, Ms) => {
  "use strict";
  var jn, D4 = 59;
  Ms.exports = _4;
  function _4(e) {
    var t = "&" + e + ";", r;
    return jn = jn || document.createElement("i"), jn.innerHTML = t, r = jn.textContent, r.charCodeAt(r.length - 1) === D4 && e !== "semi" ||
    r === t ? !1 : r;
  }
  o(_4, "decodeEntity");
});

// ../node_modules/refractor/node_modules/parse-entities/index.js
var $s = H((P9, _s) => {
  "use strict";
  var Ls = vs(), Is = ws(), $4 = Sa(), V4 = Rs(), Ps = Cs(), j4 = As();
  _s.exports = rm;
  var W4 = {}.hasOwnProperty, mr = String.fromCharCode, U4 = Function.prototype, zs = {
    warning: null,
    reference: null,
    text: null,
    warningContext: null,
    referenceContext: null,
    textContext: null,
    position: {},
    additional: null,
    attribute: !1,
    nonTerminated: !0
  }, q4 = 9, Ts = 10, G4 = 12, Y4 = 32, Hs = 38, X4 = 59, Z4 = 60, K4 = 61, J4 = 35, Q4 = 88, em = 120, tm = 65533, hr = "named", Ma = "hexa\
decimal", Aa = "decimal", La = {};
  La[Ma] = 16;
  La[Aa] = 10;
  var Wn = {};
  Wn[hr] = Ps;
  Wn[Aa] = $4;
  Wn[Ma] = V4;
  var ks = 1, Os = 2, Bs = 3, Ns = 4, Fs = 5, Ca = 6, Ds = 7, Rt = {};
  Rt[ks] = "Named character references must be terminated by a semicolon";
  Rt[Os] = "Numeric character references must be terminated by a semicolon";
  Rt[Bs] = "Named character references cannot be empty";
  Rt[Ns] = "Numeric character references cannot be empty";
  Rt[Fs] = "Named character references must be known";
  Rt[Ca] = "Numeric character references cannot be disallowed";
  Rt[Ds] = "Numeric character references cannot be outside the permissible Unicode range";
  function rm(e, t) {
    var r = {}, n, a;
    t || (t = {});
    for (a in zs)
      n = t[a], r[a] = n ?? zs[a];
    return (r.position.indent || r.position.start) && (r.indent = r.position.indent || [], r.position = r.position.start), nm(e, r);
  }
  o(rm, "parseEntities");
  function nm(e, t) {
    var r = t.additional, n = t.nonTerminated, a = t.text, i = t.reference, c = t.warning, l = t.textContext, s = t.referenceContext, u = t.
    warningContext, f = t.position, d = t.indent || [], m = e.length, v = 0, y = -1, p = f.column || 1, h = f.line || 1, g = "", w = [], b, x,
    E, R, S, A, M, L, P, _, D, K, T, z, k, V, F, j, O;
    for (typeof r == "string" && (r = r.charCodeAt(0)), V = G(), L = c ? Ee : U4, v--, m++; ++v < m; )
      if (S === Ts && (p = d[y] || 1), S = e.charCodeAt(v), S === Hs) {
        if (M = e.charCodeAt(v + 1), M === q4 || M === Ts || M === G4 || M === Y4 || M === Hs || M === Z4 || M !== M || r && M === r) {
          g += mr(S), p++;
          continue;
        }
        for (T = v + 1, K = T, O = T, M === J4 ? (O = ++K, M = e.charCodeAt(O), M === Q4 || M === em ? (z = Ma, O = ++K) : z = Aa) : z = hr,
        b = "", D = "", R = "", k = Wn[z], O--; ++O < m && (M = e.charCodeAt(O), !!k(M)); )
          R += mr(M), z === hr && W4.call(Ls, R) && (b = R, D = Ls[R]);
        E = e.charCodeAt(O) === X4, E && (O++, x = z === hr ? j4(R) : !1, x && (b = R, D = x)), j = 1 + O - T, !E && !n || (R ? z === hr ? (E &&
        !D ? L(Fs, 1) : (b !== R && (O = K + b.length, j = 1 + O - K, E = !1), E || (P = b ? ks : Bs, t.attribute ? (M = e.charCodeAt(O), M ===
        K4 ? (L(P, j), D = null) : Ps(M) ? D = null : L(P, j)) : L(P, j))), A = D) : (E || L(Os, j), A = parseInt(R, La[z]), om(A) ? (L(Ds, j),
        A = mr(tm)) : A in Is ? (L(Ca, j), A = Is[A]) : (_ = "", am(A) && L(Ca, j), A > 65535 && (A -= 65536, _ += mr(A >>> 10 | 55296), A =
        56320 | A & 1023), A = _ + mr(A))) : z !== hr && L(Ns, j)), A ? (pe(), V = G(), v = O - 1, p += O - T + 1, w.push(A), F = G(), F.offset++,
        i && i.call(
          s,
          A,
          { start: V, end: F },
          e.slice(T - 1, O)
        ), V = F) : (R = e.slice(T - 1, O), g += R, p += R.length, v = O - 1);
      } else
        S === 10 && (h++, y++, p = 0), S === S ? (g += mr(S), p++) : pe();
    return w.join("");
    function G() {
      return {
        line: h,
        column: p,
        offset: v + (f.offset || 0)
      };
    }
    function Ee(se, ue) {
      var ve = G();
      ve.column += ue, ve.offset += ue, c.call(u, Rt[se], ve, se);
    }
    function pe() {
      g && (w.push(g), a && a.call(l, g, { start: V, end: G() }), g = "");
    }
  }
  o(nm, "parse");
  function om(e) {
    return e >= 55296 && e <= 57343 || e > 1114111;
  }
  o(om, "prohibited");
  function am(e) {
    return e >= 1 && e <= 8 || e === 11 || e >= 13 && e <= 31 || e >= 127 && e <= 159 || e >= 64976 && e <= 65007 || (e & 65535) === 65535 ||
    (e & 65535) === 65534;
  }
  o(am, "disallowed");
});

// ../node_modules/refractor/node_modules/prismjs/components/prism-core.js
var js = H((O9, Un) => {
  var im = typeof window < "u" ? window : typeof WorkerGlobalScope < "u" && self instanceof WorkerGlobalScope ? self : {};
  var Vs = function(e) {
    var t = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i, r = 0, n = {}, a = {
      /**
       * By default, Prism will attempt to highlight all code elements (by calling {@link Prism.highlightAll}) on the
       * current page after the page finished loading. This might be a problem if e.g. you wanted to asynchronously load
       * additional languages or plugins yourself.
       *
       * By setting this value to `true`, Prism will not automatically highlight all code elements on the page.
       *
       * You obviously have to change this value before the automatic highlighting started. To do this, you can add an
       * empty Prism object into the global scope before loading the Prism script like this:
       *
       * ```js
       * window.Prism = window.Prism || {};
       * Prism.manual = true;
       * // add a new <script> to load Prism's script
       * ```
       *
       * @default false
       * @type {boolean}
       * @memberof Prism
       * @public
       */
      manual: e.Prism && e.Prism.manual,
      /**
       * By default, if Prism is in a web worker, it assumes that it is in a worker it created itself, so it uses
       * `addEventListener` to communicate with its parent instance. However, if you're using Prism manually in your
       * own worker, you don't want it to do this.
       *
       * By setting this value to `true`, Prism will not add its own listeners to the worker.
       *
       * You obviously have to change this value before Prism executes. To do this, you can add an
       * empty Prism object into the global scope before loading the Prism script like this:
       *
       * ```js
       * window.Prism = window.Prism || {};
       * Prism.disableWorkerMessageHandler = true;
       * // Load Prism's script
       * ```
       *
       * @default false
       * @type {boolean}
       * @memberof Prism
       * @public
       */
      disableWorkerMessageHandler: e.Prism && e.Prism.disableWorkerMessageHandler,
      /**
       * A namespace for utility methods.
       *
       * All function in this namespace that are not explicitly marked as _public_ are for __internal use only__ and may
       * change or disappear at any time.
       *
       * @namespace
       * @memberof Prism
       */
      util: {
        encode: /* @__PURE__ */ o(function p(h) {
          return h instanceof i ? new i(h.type, p(h.content), h.alias) : Array.isArray(h) ? h.map(p) : h.replace(/&/g, "&amp;").replace(/</g,
          "&lt;").replace(/\u00a0/g, " ");
        }, "encode"),
        /**
         * Returns the name of the type of the given value.
         *
         * @param {any} o
         * @returns {string}
         * @example
         * type(null)      === 'Null'
         * type(undefined) === 'Undefined'
         * type(123)       === 'Number'
         * type('foo')     === 'String'
         * type(true)      === 'Boolean'
         * type([1, 2])    === 'Array'
         * type({})        === 'Object'
         * type(String)    === 'Function'
         * type(/abc+/)    === 'RegExp'
         */
        type: /* @__PURE__ */ o(function(p) {
          return Object.prototype.toString.call(p).slice(8, -1);
        }, "type"),
        /**
         * Returns a unique number for the given object. Later calls will still return the same number.
         *
         * @param {Object} obj
         * @returns {number}
         */
        objId: /* @__PURE__ */ o(function(p) {
          return p.__id || Object.defineProperty(p, "__id", { value: ++r }), p.__id;
        }, "objId"),
        /**
         * Creates a deep clone of the given object.
         *
         * The main intended use of this function is to clone language definitions.
         *
         * @param {T} o
         * @param {Record<number, any>} [visited]
         * @returns {T}
         * @template T
         */
        clone: /* @__PURE__ */ o(function p(h, g) {
          g = g || {};
          var w, b;
          switch (a.util.type(h)) {
            case "Object":
              if (b = a.util.objId(h), g[b])
                return g[b];
              w = /** @type {Record<string, any>} */
              {}, g[b] = w;
              for (var x in h)
                h.hasOwnProperty(x) && (w[x] = p(h[x], g));
              return (
                /** @type {any} */
                w
              );
            case "Array":
              return b = a.util.objId(h), g[b] ? g[b] : (w = [], g[b] = w, /** @type {Array} */
              /** @type {any} */
              h.forEach(function(E, R) {
                w[R] = p(E, g);
              }), /** @type {any} */
              w);
            default:
              return h;
          }
        }, "deepClone"),
        /**
         * Returns the Prism language of the given element set by a `language-xxxx` or `lang-xxxx` class.
         *
         * If no language is set for the element or the element is `null` or `undefined`, `none` will be returned.
         *
         * @param {Element} element
         * @returns {string}
         */
        getLanguage: /* @__PURE__ */ o(function(p) {
          for (; p; ) {
            var h = t.exec(p.className);
            if (h)
              return h[1].toLowerCase();
            p = p.parentElement;
          }
          return "none";
        }, "getLanguage"),
        /**
         * Sets the Prism `language-xxxx` class of the given element.
         *
         * @param {Element} element
         * @param {string} language
         * @returns {void}
         */
        setLanguage: /* @__PURE__ */ o(function(p, h) {
          p.className = p.className.replace(RegExp(t, "gi"), ""), p.classList.add("language-" + h);
        }, "setLanguage"),
        /**
         * Returns the script element that is currently executing.
         *
         * This does __not__ work for line script element.
         *
         * @returns {HTMLScriptElement | null}
         */
        currentScript: /* @__PURE__ */ o(function() {
          if (typeof document > "u")
            return null;
          if ("currentScript" in document)
            return (
              /** @type {any} */
              document.currentScript
            );
          try {
            throw new Error();
          } catch (w) {
            var p = (/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(w.stack) || [])[1];
            if (p) {
              var h = document.getElementsByTagName("script");
              for (var g in h)
                if (h[g].src == p)
                  return h[g];
            }
            return null;
          }
        }, "currentScript"),
        /**
         * Returns whether a given class is active for `element`.
         *
         * The class can be activated if `element` or one of its ancestors has the given class and it can be deactivated
         * if `element` or one of its ancestors has the negated version of the given class. The _negated version_ of the
         * given class is just the given class with a `no-` prefix.
         *
         * Whether the class is active is determined by the closest ancestor of `element` (where `element` itself is
         * closest ancestor) that has the given class or the negated version of it. If neither `element` nor any of its
         * ancestors have the given class or the negated version of it, then the default activation will be returned.
         *
         * In the paradoxical situation where the closest ancestor contains __both__ the given class and the negated
         * version of it, the class is considered active.
         *
         * @param {Element} element
         * @param {string} className
         * @param {boolean} [defaultActivation=false]
         * @returns {boolean}
         */
        isActive: /* @__PURE__ */ o(function(p, h, g) {
          for (var w = "no-" + h; p; ) {
            var b = p.classList;
            if (b.contains(h))
              return !0;
            if (b.contains(w))
              return !1;
            p = p.parentElement;
          }
          return !!g;
        }, "isActive")
      },
      /**
       * This namespace contains all currently loaded languages and the some helper functions to create and modify languages.
       *
       * @namespace
       * @memberof Prism
       * @public
       */
      languages: {
        /**
         * The grammar for plain, unformatted text.
         */
        plain: n,
        plaintext: n,
        text: n,
        txt: n,
        /**
         * Creates a deep copy of the language with the given id and appends the given tokens.
         *
         * If a token in `redef` also appears in the copied language, then the existing token in the copied language
         * will be overwritten at its original position.
         *
         * ## Best practices
         *
         * Since the position of overwriting tokens (token in `redef` that overwrite tokens in the copied language)
         * doesn't matter, they can technically be in any order. However, this can be confusing to others that trying to
         * understand the language definition because, normally, the order of tokens matters in Prism grammars.
         *
         * Therefore, it is encouraged to order overwriting tokens according to the positions of the overwritten tokens.
         * Furthermore, all non-overwriting tokens should be placed after the overwriting ones.
         *
         * @param {string} id The id of the language to extend. This has to be a key in `Prism.languages`.
         * @param {Grammar} redef The new tokens to append.
         * @returns {Grammar} The new language created.
         * @public
         * @example
         * Prism.languages['css-with-colors'] = Prism.languages.extend('css', {
         *     // Prism.languages.css already has a 'comment' token, so this token will overwrite CSS' 'comment' token
         *     // at its original position
         *     'comment': { ... },
         *     // CSS doesn't have a 'color' token, so this token will be appended
         *     'color': /\b(?:red|green|blue)\b/
         * });
         */
        extend: /* @__PURE__ */ o(function(p, h) {
          var g = a.util.clone(a.languages[p]);
          for (var w in h)
            g[w] = h[w];
          return g;
        }, "extend"),
        /**
         * Inserts tokens _before_ another token in a language definition or any other grammar.
         *
         * ## Usage
         *
         * This helper method makes it easy to modify existing languages. For example, the CSS language definition
         * not only defines CSS highlighting for CSS documents, but also needs to define highlighting for CSS embedded
         * in HTML through `<style>` elements. To do this, it needs to modify `Prism.languages.markup` and add the
         * appropriate tokens. However, `Prism.languages.markup` is a regular JavaScript object literal, so if you do
         * this:
         *
         * ```js
         * Prism.languages.markup.style = {
         *     // token
         * };
         * ```
         *
         * then the `style` token will be added (and processed) at the end. `insertBefore` allows you to insert tokens
         * before existing tokens. For the CSS example above, you would use it like this:
         *
         * ```js
         * Prism.languages.insertBefore('markup', 'cdata', {
         *     'style': {
         *         // token
         *     }
         * });
         * ```
         *
         * ## Special cases
         *
         * If the grammars of `inside` and `insert` have tokens with the same name, the tokens in `inside`'s grammar
         * will be ignored.
         *
         * This behavior can be used to insert tokens after `before`:
         *
         * ```js
         * Prism.languages.insertBefore('markup', 'comment', {
         *     'comment': Prism.languages.markup.comment,
         *     // tokens after 'comment'
         * });
         * ```
         *
         * ## Limitations
         *
         * The main problem `insertBefore` has to solve is iteration order. Since ES2015, the iteration order for object
         * properties is guaranteed to be the insertion order (except for integer keys) but some browsers behave
         * differently when keys are deleted and re-inserted. So `insertBefore` can't be implemented by temporarily
         * deleting properties which is necessary to insert at arbitrary positions.
         *
         * To solve this problem, `insertBefore` doesn't actually insert the given tokens into the target object.
         * Instead, it will create a new object and replace all references to the target object with the new one. This
         * can be done without temporarily deleting properties, so the iteration order is well-defined.
         *
         * However, only references that can be reached from `Prism.languages` or `insert` will be replaced. I.e. if
         * you hold the target object in a variable, then the value of the variable will not change.
         *
         * ```js
         * var oldMarkup = Prism.languages.markup;
         * var newMarkup = Prism.languages.insertBefore('markup', 'comment', { ... });
         *
         * assert(oldMarkup !== Prism.languages.markup);
         * assert(newMarkup === Prism.languages.markup);
         * ```
         *
         * @param {string} inside The property of `root` (e.g. a language id in `Prism.languages`) that contains the
         * object to be modified.
         * @param {string} before The key to insert before.
         * @param {Grammar} insert An object containing the key-value pairs to be inserted.
         * @param {Object<string, any>} [root] The object containing `inside`, i.e. the object that contains the
         * object to be modified.
         *
         * Defaults to `Prism.languages`.
         * @returns {Grammar} The new grammar object.
         * @public
         */
        insertBefore: /* @__PURE__ */ o(function(p, h, g, w) {
          w = w || /** @type {any} */
          a.languages;
          var b = w[p], x = {};
          for (var E in b)
            if (b.hasOwnProperty(E)) {
              if (E == h)
                for (var R in g)
                  g.hasOwnProperty(R) && (x[R] = g[R]);
              g.hasOwnProperty(E) || (x[E] = b[E]);
            }
          var S = w[p];
          return w[p] = x, a.languages.DFS(a.languages, function(A, M) {
            M === S && A != p && (this[A] = x);
          }), x;
        }, "insertBefore"),
        // Traverse a language definition with Depth First Search
        DFS: /* @__PURE__ */ o(function p(h, g, w, b) {
          b = b || {};
          var x = a.util.objId;
          for (var E in h)
            if (h.hasOwnProperty(E)) {
              g.call(h, E, h[E], w || E);
              var R = h[E], S = a.util.type(R);
              S === "Object" && !b[x(R)] ? (b[x(R)] = !0, p(R, g, null, b)) : S === "Array" && !b[x(R)] && (b[x(R)] = !0, p(R, g, E, b));
            }
        }, "DFS")
      },
      plugins: {},
      /**
       * This is the most high-level function in Prism’s API.
       * It fetches all the elements that have a `.language-xxxx` class and then calls {@link Prism.highlightElement} on
       * each one of them.
       *
       * This is equivalent to `Prism.highlightAllUnder(document, async, callback)`.
       *
       * @param {boolean} [async=false] Same as in {@link Prism.highlightAllUnder}.
       * @param {HighlightCallback} [callback] Same as in {@link Prism.highlightAllUnder}.
       * @memberof Prism
       * @public
       */
      highlightAll: /* @__PURE__ */ o(function(p, h) {
        a.highlightAllUnder(document, p, h);
      }, "highlightAll"),
      /**
       * Fetches all the descendants of `container` that have a `.language-xxxx` class and then calls
       * {@link Prism.highlightElement} on each one of them.
       *
       * The following hooks will be run:
       * 1. `before-highlightall`
       * 2. `before-all-elements-highlight`
       * 3. All hooks of {@link Prism.highlightElement} for each element.
       *
       * @param {ParentNode} container The root element, whose descendants that have a `.language-xxxx` class will be highlighted.
       * @param {boolean} [async=false] Whether each element is to be highlighted asynchronously using Web Workers.
       * @param {HighlightCallback} [callback] An optional callback to be invoked on each element after its highlighting is done.
       * @memberof Prism
       * @public
       */
      highlightAllUnder: /* @__PURE__ */ o(function(p, h, g) {
        var w = {
          callback: g,
          container: p,
          selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
        };
        a.hooks.run("before-highlightall", w), w.elements = Array.prototype.slice.apply(w.container.querySelectorAll(w.selector)), a.hooks.run(
        "before-all-elements-highlight", w);
        for (var b = 0, x; x = w.elements[b++]; )
          a.highlightElement(x, h === !0, w.callback);
      }, "highlightAllUnder"),
      /**
       * Highlights the code inside a single element.
       *
       * The following hooks will be run:
       * 1. `before-sanity-check`
       * 2. `before-highlight`
       * 3. All hooks of {@link Prism.highlight}. These hooks will be run by an asynchronous worker if `async` is `true`.
       * 4. `before-insert`
       * 5. `after-highlight`
       * 6. `complete`
       *
       * Some the above hooks will be skipped if the element doesn't contain any text or there is no grammar loaded for
       * the element's language.
       *
       * @param {Element} element The element containing the code.
       * It must have a class of `language-xxxx` to be processed, where `xxxx` is a valid language identifier.
       * @param {boolean} [async=false] Whether the element is to be highlighted asynchronously using Web Workers
       * to improve performance and avoid blocking the UI when highlighting very large chunks of code. This option is
       * [disabled by default](https://prismjs.com/faq.html#why-is-asynchronous-highlighting-disabled-by-default).
       *
       * Note: All language definitions required to highlight the code must be included in the main `prism.js` file for
       * asynchronous highlighting to work. You can build your own bundle on the
       * [Download page](https://prismjs.com/download.html).
       * @param {HighlightCallback} [callback] An optional callback to be invoked after the highlighting is done.
       * Mostly useful when `async` is `true`, since in that case, the highlighting is done asynchronously.
       * @memberof Prism
       * @public
       */
      highlightElement: /* @__PURE__ */ o(function(p, h, g) {
        var w = a.util.getLanguage(p), b = a.languages[w];
        a.util.setLanguage(p, w);
        var x = p.parentElement;
        x && x.nodeName.toLowerCase() === "pre" && a.util.setLanguage(x, w);
        var E = p.textContent, R = {
          element: p,
          language: w,
          grammar: b,
          code: E
        };
        function S(M) {
          R.highlightedCode = M, a.hooks.run("before-insert", R), R.element.innerHTML = R.highlightedCode, a.hooks.run("after-highlight", R),
          a.hooks.run("complete", R), g && g.call(R.element);
        }
        if (o(S, "insertHighlightedCode"), a.hooks.run("before-sanity-check", R), x = R.element.parentElement, x && x.nodeName.toLowerCase() ===
        "pre" && !x.hasAttribute("tabindex") && x.setAttribute("tabindex", "0"), !R.code) {
          a.hooks.run("complete", R), g && g.call(R.element);
          return;
        }
        if (a.hooks.run("before-highlight", R), !R.grammar) {
          S(a.util.encode(R.code));
          return;
        }
        if (h && e.Worker) {
          var A = new Worker(a.filename);
          A.onmessage = function(M) {
            S(M.data);
          }, A.postMessage(JSON.stringify({
            language: R.language,
            code: R.code,
            immediateClose: !0
          }));
        } else
          S(a.highlight(R.code, R.grammar, R.language));
      }, "highlightElement"),
      /**
       * Low-level function, only use if you know what you’re doing. It accepts a string of text as input
       * and the language definitions to use, and returns a string with the HTML produced.
       *
       * The following hooks will be run:
       * 1. `before-tokenize`
       * 2. `after-tokenize`
       * 3. `wrap`: On each {@link Token}.
       *
       * @param {string} text A string with the code to be highlighted.
       * @param {Grammar} grammar An object containing the tokens to use.
       *
       * Usually a language definition like `Prism.languages.markup`.
       * @param {string} language The name of the language definition passed to `grammar`.
       * @returns {string} The highlighted HTML.
       * @memberof Prism
       * @public
       * @example
       * Prism.highlight('var foo = true;', Prism.languages.javascript, 'javascript');
       */
      highlight: /* @__PURE__ */ o(function(p, h, g) {
        var w = {
          code: p,
          grammar: h,
          language: g
        };
        if (a.hooks.run("before-tokenize", w), !w.grammar)
          throw new Error('The language "' + w.language + '" has no grammar.');
        return w.tokens = a.tokenize(w.code, w.grammar), a.hooks.run("after-tokenize", w), i.stringify(a.util.encode(w.tokens), w.language);
      }, "highlight"),
      /**
       * This is the heart of Prism, and the most low-level function you can use. It accepts a string of text as input
       * and the language definitions to use, and returns an array with the tokenized code.
       *
       * When the language definition includes nested tokens, the function is called recursively on each of these tokens.
       *
       * This method could be useful in other contexts as well, as a very crude parser.
       *
       * @param {string} text A string with the code to be highlighted.
       * @param {Grammar} grammar An object containing the tokens to use.
       *
       * Usually a language definition like `Prism.languages.markup`.
       * @returns {TokenStream} An array of strings and tokens, a token stream.
       * @memberof Prism
       * @public
       * @example
       * let code = `var foo = 0;`;
       * let tokens = Prism.tokenize(code, Prism.languages.javascript);
       * tokens.forEach(token => {
       *     if (token instanceof Prism.Token && token.type === 'number') {
       *         console.log(`Found numeric literal: ${token.content}`);
       *     }
       * });
       */
      tokenize: /* @__PURE__ */ o(function(p, h) {
        var g = h.rest;
        if (g) {
          for (var w in g)
            h[w] = g[w];
          delete h.rest;
        }
        var b = new s();
        return u(b, b.head, p), l(p, b, h, b.head, 0), d(b);
      }, "tokenize"),
      /**
       * @namespace
       * @memberof Prism
       * @public
       */
      hooks: {
        all: {},
        /**
         * Adds the given callback to the list of callbacks for the given hook.
         *
         * The callback will be invoked when the hook it is registered for is run.
         * Hooks are usually directly run by a highlight function but you can also run hooks yourself.
         *
         * One callback function can be registered to multiple hooks and the same hook multiple times.
         *
         * @param {string} name The name of the hook.
         * @param {HookCallback} callback The callback function which is given environment variables.
         * @public
         */
        add: /* @__PURE__ */ o(function(p, h) {
          var g = a.hooks.all;
          g[p] = g[p] || [], g[p].push(h);
        }, "add"),
        /**
         * Runs a hook invoking all registered callbacks with the given environment variables.
         *
         * Callbacks will be invoked synchronously and in the order in which they were registered.
         *
         * @param {string} name The name of the hook.
         * @param {Object<string, any>} env The environment variables of the hook passed to all callbacks registered.
         * @public
         */
        run: /* @__PURE__ */ o(function(p, h) {
          var g = a.hooks.all[p];
          if (!(!g || !g.length))
            for (var w = 0, b; b = g[w++]; )
              b(h);
        }, "run")
      },
      Token: i
    };
    e.Prism = a;
    function i(p, h, g, w) {
      this.type = p, this.content = h, this.alias = g, this.length = (w || "").length | 0;
    }
    o(i, "Token"), i.stringify = /* @__PURE__ */ o(function p(h, g) {
      if (typeof h == "string")
        return h;
      if (Array.isArray(h)) {
        var w = "";
        return h.forEach(function(S) {
          w += p(S, g);
        }), w;
      }
      var b = {
        type: h.type,
        content: p(h.content, g),
        tag: "span",
        classes: ["token", h.type],
        attributes: {},
        language: g
      }, x = h.alias;
      x && (Array.isArray(x) ? Array.prototype.push.apply(b.classes, x) : b.classes.push(x)), a.hooks.run("wrap", b);
      var E = "";
      for (var R in b.attributes)
        E += " " + R + '="' + (b.attributes[R] || "").replace(/"/g, "&quot;") + '"';
      return "<" + b.tag + ' class="' + b.classes.join(" ") + '"' + E + ">" + b.content + "</" + b.tag + ">";
    }, "stringify");
    function c(p, h, g, w) {
      p.lastIndex = h;
      var b = p.exec(g);
      if (b && w && b[1]) {
        var x = b[1].length;
        b.index += x, b[0] = b[0].slice(x);
      }
      return b;
    }
    o(c, "matchPattern");
    function l(p, h, g, w, b, x) {
      for (var E in g)
        if (!(!g.hasOwnProperty(E) || !g[E])) {
          var R = g[E];
          R = Array.isArray(R) ? R : [R];
          for (var S = 0; S < R.length; ++S) {
            if (x && x.cause == E + "," + S)
              return;
            var A = R[S], M = A.inside, L = !!A.lookbehind, P = !!A.greedy, _ = A.alias;
            if (P && !A.pattern.global) {
              var D = A.pattern.toString().match(/[imsuy]*$/)[0];
              A.pattern = RegExp(A.pattern.source, D + "g");
            }
            for (var K = A.pattern || A, T = w.next, z = b; T !== h.tail && !(x && z >= x.reach); z += T.value.length, T = T.next) {
              var k = T.value;
              if (h.length > p.length)
                return;
              if (!(k instanceof i)) {
                var V = 1, F;
                if (P) {
                  if (F = c(K, z, p, L), !F || F.index >= p.length)
                    break;
                  var Ee = F.index, j = F.index + F[0].length, O = z;
                  for (O += T.value.length; Ee >= O; )
                    T = T.next, O += T.value.length;
                  if (O -= T.value.length, z = O, T.value instanceof i)
                    continue;
                  for (var G = T; G !== h.tail && (O < j || typeof G.value == "string"); G = G.next)
                    V++, O += G.value.length;
                  V--, k = p.slice(z, O), F.index -= z;
                } else if (F = c(K, 0, k, L), !F)
                  continue;
                var Ee = F.index, pe = F[0], se = k.slice(0, Ee), ue = k.slice(Ee + pe.length), ve = z + k.length;
                x && ve > x.reach && (x.reach = ve);
                var Se = T.prev;
                se && (Se = u(h, Se, se), z += se.length), f(h, Se, V);
                var Ot = new i(E, M ? a.tokenize(pe, M) : pe, _, pe);
                if (T = u(h, Se, Ot), ue && u(h, T, ue), V > 1) {
                  var Yr = {
                    cause: E + "," + S,
                    reach: ve
                  };
                  l(p, h, g, T.prev, z, Yr), x && Yr.reach > x.reach && (x.reach = Yr.reach);
                }
              }
            }
          }
        }
    }
    o(l, "matchGrammar");
    function s() {
      var p = { value: null, prev: null, next: null }, h = { value: null, prev: p, next: null };
      p.next = h, this.head = p, this.tail = h, this.length = 0;
    }
    o(s, "LinkedList");
    function u(p, h, g) {
      var w = h.next, b = { value: g, prev: h, next: w };
      return h.next = b, w.prev = b, p.length++, b;
    }
    o(u, "addAfter");
    function f(p, h, g) {
      for (var w = h.next, b = 0; b < g && w !== p.tail; b++)
        w = w.next;
      h.next = w, w.prev = h, p.length -= b;
    }
    o(f, "removeRange");
    function d(p) {
      for (var h = [], g = p.head.next; g !== p.tail; )
        h.push(g.value), g = g.next;
      return h;
    }
    if (o(d, "toArray"), !e.document)
      return e.addEventListener && (a.disableWorkerMessageHandler || e.addEventListener("message", function(p) {
        var h = JSON.parse(p.data), g = h.language, w = h.code, b = h.immediateClose;
        e.postMessage(a.highlight(w, a.languages[g], g)), b && e.close();
      }, !1)), a;
    var m = a.util.currentScript();
    m && (a.filename = m.src, m.hasAttribute("data-manual") && (a.manual = !0));
    function v() {
      a.manual || a.highlightAll();
    }
    if (o(v, "highlightAutomaticallyCallback"), !a.manual) {
      var y = document.readyState;
      y === "loading" || y === "interactive" && m && m.defer ? document.addEventListener("DOMContentLoaded", v) : window.requestAnimationFrame ?
      window.requestAnimationFrame(v) : window.setTimeout(v, 16);
    }
    return a;
  }(im);
  typeof Un < "u" && Un.exports && (Un.exports = Vs);
  typeof global < "u" && (global.Prism = Vs);
});

// ../node_modules/refractor/lang/markup.js
var za = H((N9, Ws) => {
  "use strict";
  Ws.exports = Ia;
  Ia.displayName = "markup";
  Ia.aliases = ["html", "mathml", "svg", "xml", "ssml", "atom", "rss"];
  function Ia(e) {
    e.languages.markup = {
      comment: {
        pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
        greedy: !0
      },
      prolog: {
        pattern: /<\?[\s\S]+?\?>/,
        greedy: !0
      },
      doctype: {
        // https://www.w3.org/TR/xml/#NT-doctypedecl
        pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
        greedy: !0,
        inside: {
          "internal-subset": {
            pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
            lookbehind: !0,
            greedy: !0,
            inside: null
            // see below
          },
          string: {
            pattern: /"[^"]*"|'[^']*'/,
            greedy: !0
          },
          punctuation: /^<!|>$|[[\]]/,
          "doctype-tag": /^DOCTYPE/i,
          name: /[^\s<>'"]+/
        }
      },
      cdata: {
        pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
        greedy: !0
      },
      tag: {
        pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
        greedy: !0,
        inside: {
          tag: {
            pattern: /^<\/?[^\s>\/]+/,
            inside: {
              punctuation: /^<\/?/,
              namespace: /^[^\s>\/:]+:/
            }
          },
          "special-attr": [],
          "attr-value": {
            pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
            inside: {
              punctuation: [
                {
                  pattern: /^=/,
                  alias: "attr-equals"
                },
                /"|'/
              ]
            }
          },
          punctuation: /\/?>/,
          "attr-name": {
            pattern: /[^\s>\/]+/,
            inside: {
              namespace: /^[^\s>\/:]+:/
            }
          }
        }
      },
      entity: [
        {
          pattern: /&[\da-z]{1,8};/i,
          alias: "named-entity"
        },
        /&#x?[\da-f]{1,8};/i
      ]
    }, e.languages.markup.tag.inside["attr-value"].inside.entity = e.languages.markup.entity, e.languages.markup.doctype.inside["internal-su\
bset"].inside = e.languages.markup, e.hooks.add("wrap", function(t) {
      t.type === "entity" && (t.attributes.title = t.content.value.replace(/&amp;/, "&"));
    }), Object.defineProperty(e.languages.markup.tag, "addInlined", {
      /**
       * Adds an inlined language to markup.
       *
       * An example of an inlined language is CSS with `<style>` tags.
       *
       * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
       * case insensitive.
       * @param {string} lang The language key.
       * @example
       * addInlined('style', 'css');
       */
      value: /* @__PURE__ */ o(function(r, n) {
        var a = {};
        a["language-" + n] = {
          pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
          lookbehind: !0,
          inside: e.languages[n]
        }, a.cdata = /^<!\[CDATA\[|\]\]>$/i;
        var i = {
          "included-cdata": {
            pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
            inside: a
          }
        };
        i["language-" + n] = {
          pattern: /[\s\S]+/,
          inside: e.languages[n]
        };
        var c = {};
        c[r] = {
          pattern: RegExp(
            /(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(
              /__/g,
              function() {
                return r;
              }
            ),
            "i"
          ),
          lookbehind: !0,
          greedy: !0,
          inside: i
        }, e.languages.insertBefore("markup", "cdata", c);
      }, "addInlined")
    }), Object.defineProperty(e.languages.markup.tag, "addAttribute", {
      /**
       * Adds an pattern to highlight languages embedded in HTML attributes.
       *
       * An example of an inlined language is CSS with `style` attributes.
       *
       * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
       * case insensitive.
       * @param {string} lang The language key.
       * @example
       * addAttribute('style', 'css');
       */
      value: /* @__PURE__ */ o(function(t, r) {
        e.languages.markup.tag.inside["special-attr"].push({
          pattern: RegExp(
            /(^|["'\s])/.source + "(?:" + t + ")" + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
            "i"
          ),
          lookbehind: !0,
          inside: {
            "attr-name": /^[^\s=]+/,
            "attr-value": {
              pattern: /=[\s\S]+/,
              inside: {
                value: {
                  pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
                  lookbehind: !0,
                  alias: [r, "language-" + r],
                  inside: e.languages[r]
                },
                punctuation: [
                  {
                    pattern: /^=/,
                    alias: "attr-equals"
                  },
                  /"|'/
                ]
              }
            }
          }
        });
      }, "value")
    }), e.languages.html = e.languages.markup, e.languages.mathml = e.languages.markup, e.languages.svg = e.languages.markup, e.languages.xml =
    e.languages.extend("markup", {}), e.languages.ssml = e.languages.xml, e.languages.atom = e.languages.xml, e.languages.rss = e.languages.
    xml;
  }
  o(Ia, "markup");
});

// ../node_modules/refractor/lang/css.js
var Ha = H((D9, Us) => {
  "use strict";
  Us.exports = Ta;
  Ta.displayName = "css";
  Ta.aliases = [];
  function Ta(e) {
    (function(t) {
      var r = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;
      t.languages.css = {
        comment: /\/\*[\s\S]*?\*\//,
        atrule: {
          pattern: /@[\w-](?:[^;{\s]|\s+(?![\s{]))*(?:;|(?=\s*\{))/,
          inside: {
            rule: /^@[\w-]+/,
            "selector-function-argument": {
              pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
              lookbehind: !0,
              alias: "selector"
            },
            keyword: {
              pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
              lookbehind: !0
            }
            // See rest below
          }
        },
        url: {
          // https://drafts.csswg.org/css-values-3/#urls
          pattern: RegExp(
            "\\burl\\((?:" + r.source + "|" + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ")\\)",
            "i"
          ),
          greedy: !0,
          inside: {
            function: /^url/i,
            punctuation: /^\(|\)$/,
            string: {
              pattern: RegExp("^" + r.source + "$"),
              alias: "url"
            }
          }
        },
        selector: {
          pattern: RegExp(
            `(^|[{}\\s])[^{}\\s](?:[^{};"'\\s]|\\s+(?![\\s{])|` + r.source + ")*(?=\\s*\\{)"
          ),
          lookbehind: !0
        },
        string: {
          pattern: r,
          greedy: !0
        },
        property: {
          pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
          lookbehind: !0
        },
        important: /!important\b/i,
        function: {
          pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
          lookbehind: !0
        },
        punctuation: /[(){};:,]/
      }, t.languages.css.atrule.inside.rest = t.languages.css;
      var n = t.languages.markup;
      n && (n.tag.addInlined("style", "css"), n.tag.addAttribute("style", "css"));
    })(e);
  }
  o(Ta, "css");
});

// ../node_modules/refractor/lang/clike.js
var Gs = H(($9, qs) => {
  "use strict";
  qs.exports = Pa;
  Pa.displayName = "clike";
  Pa.aliases = [];
  function Pa(e) {
    e.languages.clike = {
      comment: [
        {
          pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
          lookbehind: !0,
          greedy: !0
        },
        {
          pattern: /(^|[^\\:])\/\/.*/,
          lookbehind: !0,
          greedy: !0
        }
      ],
      string: {
        pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
        greedy: !0
      },
      "class-name": {
        pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
        lookbehind: !0,
        inside: {
          punctuation: /[.\\]/
        }
      },
      keyword: /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
      boolean: /\b(?:false|true)\b/,
      function: /\b\w+(?=\()/,
      number: /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
      operator: /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
      punctuation: /[{}[\];(),.:]/
    };
  }
  o(Pa, "clike");
});

// ../node_modules/refractor/lang/javascript.js
var Xs = H((j9, Ys) => {
  "use strict";
  Ys.exports = ka;
  ka.displayName = "javascript";
  ka.aliases = ["js"];
  function ka(e) {
    e.languages.javascript = e.languages.extend("clike", {
      "class-name": [
        e.languages.clike["class-name"],
        {
          pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
          lookbehind: !0
        }
      ],
      keyword: [
        {
          pattern: /((?:^|\})\s*)catch\b/,
          lookbehind: !0
        },
        {
          pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
          lookbehind: !0
        }
      ],
      // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
      function: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
      number: {
        pattern: RegExp(
          /(^|[^\w$])/.source + "(?:" + // constant
          (/NaN|Infinity/.source + "|" + // binary integer
          /0[bB][01]+(?:_[01]+)*n?/.source + "|" + // octal integer
          /0[oO][0-7]+(?:_[0-7]+)*n?/.source + "|" + // hexadecimal integer
          /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source + "|" + // decimal bigint
          /\d+(?:_\d+)*n/.source + "|" + // decimal number (integer or float) but no bigint
          /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source) + ")" + /(?![\w$])/.source
        ),
        lookbehind: !0
      },
      operator: /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
    }), e.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/, e.languages.
    insertBefore("javascript", "keyword", {
      regex: {
        // eslint-disable-next-line regexp/no-dupe-characters-character-class
        pattern: /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)\/(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/,
        lookbehind: !0,
        greedy: !0,
        inside: {
          "regex-source": {
            pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
            lookbehind: !0,
            alias: "language-regex",
            inside: e.languages.regex
          },
          "regex-delimiter": /^\/|\/$/,
          "regex-flags": /^[a-z]+$/
        }
      },
      // This must be declared before keyword because we use "function" inside the look-forward
      "function-variable": {
        pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
        alias: "function"
      },
      parameter: [
        {
          pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
          lookbehind: !0,
          inside: e.languages.javascript
        },
        {
          pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
          lookbehind: !0,
          inside: e.languages.javascript
        },
        {
          pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
          lookbehind: !0,
          inside: e.languages.javascript
        },
        {
          pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
          lookbehind: !0,
          inside: e.languages.javascript
        }
      ],
      constant: /\b[A-Z](?:[A-Z_]|\dx?)*\b/
    }), e.languages.insertBefore("javascript", "string", {
      hashbang: {
        pattern: /^#!.*/,
        greedy: !0,
        alias: "comment"
      },
      "template-string": {
        pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
        greedy: !0,
        inside: {
          "template-punctuation": {
            pattern: /^`|`$/,
            alias: "string"
          },
          interpolation: {
            pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
            lookbehind: !0,
            inside: {
              "interpolation-punctuation": {
                pattern: /^\$\{|\}$/,
                alias: "punctuation"
              },
              rest: e.languages.javascript
            }
          },
          string: /[\s\S]+/
        }
      },
      "string-property": {
        pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
        lookbehind: !0,
        greedy: !0,
        alias: "property"
      }
    }), e.languages.insertBefore("javascript", "operator", {
      "literal-property": {
        pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
        lookbehind: !0,
        alias: "property"
      }
    }), e.languages.markup && (e.languages.markup.tag.addInlined("script", "javascript"), e.languages.markup.tag.addAttribute(
      /on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.
      source,
      "javascript"
    )), e.languages.js = e.languages.javascript;
  }
  o(ka, "javascript");
});

// ../node_modules/refractor/core.js
var Qs = H((U9, Js) => {
  "use strict";
  var nn = typeof globalThis == "object" ? globalThis : typeof self == "object" ? self : typeof window == "object" ? window : typeof global ==
  "object" ? global : {}, lm = xm();
  nn.Prism = { manual: !0, disableWorkerMessageHandler: !0 };
  var cm = gs(), sm = $s(), Zs = js(), um = za(), fm = Ha(), dm = Gs(), pm = Xs();
  lm();
  var Oa = {}.hasOwnProperty;
  function Ks() {
  }
  o(Ks, "Refractor");
  Ks.prototype = Zs;
  var oe = new Ks();
  Js.exports = oe;
  oe.highlight = hm;
  oe.register = on;
  oe.alias = mm;
  oe.registered = gm;
  oe.listLanguages = vm;
  on(um);
  on(fm);
  on(dm);
  on(pm);
  oe.util.encode = ym;
  oe.Token.stringify = wm;
  function on(e) {
    if (typeof e != "function" || !e.displayName)
      throw new Error("Expected `function` for `grammar`, got `" + e + "`");
    oe.languages[e.displayName] === void 0 && e(oe);
  }
  o(on, "register");
  function mm(e, t) {
    var r = oe.languages, n = e, a, i, c, l;
    t && (n = {}, n[e] = t);
    for (a in n)
      for (i = n[a], i = typeof i == "string" ? [i] : i, c = i.length, l = -1; ++l < c; )
        r[i[l]] = r[a];
  }
  o(mm, "alias");
  function hm(e, t) {
    var r = Zs.highlight, n;
    if (typeof e != "string")
      throw new Error("Expected `string` for `value`, got `" + e + "`");
    if (oe.util.type(t) === "Object")
      n = t, t = null;
    else {
      if (typeof t != "string")
        throw new Error("Expected `string` for `name`, got `" + t + "`");
      if (Oa.call(oe.languages, t))
        n = oe.languages[t];
      else
        throw new Error("Unknown language: `" + t + "` is not registered");
    }
    return r.call(this, e, n, t);
  }
  o(hm, "highlight");
  function gm(e) {
    if (typeof e != "string")
      throw new Error("Expected `string` for `language`, got `" + e + "`");
    return Oa.call(oe.languages, e);
  }
  o(gm, "registered");
  function vm() {
    var e = oe.languages, t = [], r;
    for (r in e)
      Oa.call(e, r) && typeof e[r] == "object" && t.push(r);
    return t;
  }
  o(vm, "listLanguages");
  function wm(e, t, r) {
    var n;
    return typeof e == "string" ? { type: "text", value: e } : oe.util.type(e) === "Array" ? bm(e, t) : (n = {
      type: e.type,
      content: oe.Token.stringify(e.content, t, r),
      tag: "span",
      classes: ["token", e.type],
      attributes: {},
      language: t,
      parent: r
    }, e.alias && (n.classes = n.classes.concat(e.alias)), oe.hooks.run("wrap", n), cm(
      n.tag + "." + n.classes.join("."),
      Rm(n.attributes),
      n.content
    ));
  }
  o(wm, "stringify");
  function bm(e, t) {
    for (var r = [], n = e.length, a = -1, i; ++a < n; )
      i = e[a], i !== "" && i !== null && i !== void 0 && r.push(i);
    for (a = -1, n = r.length; ++a < n; )
      i = r[a], r[a] = oe.Token.stringify(i, t, r);
    return r;
  }
  o(bm, "stringifyAll");
  function ym(e) {
    return e;
  }
  o(ym, "encode");
  function Rm(e) {
    var t;
    for (t in e)
      e[t] = sm(e[t]);
    return e;
  }
  o(Rm, "attributes");
  function xm() {
    var e = "Prism" in nn, t = e ? nn.Prism : void 0;
    return r;
    function r() {
      e ? nn.Prism = t : delete nn.Prism, e = void 0, t = void 0;
    }
  }
  o(xm, "capture");
});

// ../node_modules/react-syntax-highlighter/dist/esm/prism-light.js
var qn, Ba, Gn, e1 = C(() => {
  gc();
  qn = me(Qs()), Ba = da(qn.default, {});
  Ba.registerLanguage = function(e, t) {
    return qn.default.register(t);
  };
  Ba.alias = function(e, t) {
    return qn.default.alias(e, t);
  };
  Gn = Ba;
});

// ../node_modules/react-syntax-highlighter/dist/esm/index.js
var t1 = C(() => {
  fa();
});

// ../node_modules/refractor/lang/bash.js
var n1 = H((K9, r1) => {
  "use strict";
  r1.exports = Na;
  Na.displayName = "bash";
  Na.aliases = ["shell"];
  function Na(e) {
    (function(t) {
      var r = "\\b(?:BASH|BASHOPTS|BASH_ALIASES|BASH_ARGC|BASH_ARGV|BASH_CMDS|BASH_COMPLETION_COMPAT_DIR|BASH_LINENO|BASH_REMATCH|BASH_SOURCE\
|BASH_VERSINFO|BASH_VERSION|COLORTERM|COLUMNS|COMP_WORDBREAKS|DBUS_SESSION_BUS_ADDRESS|DEFAULTS_PATH|DESKTOP_SESSION|DIRSTACK|DISPLAY|EUID|G\
DMSESSION|GDM_LANG|GNOME_KEYRING_CONTROL|GNOME_KEYRING_PID|GPG_AGENT_INFO|GROUPS|HISTCONTROL|HISTFILE|HISTFILESIZE|HISTSIZE|HOME|HOSTNAME|HO\
STTYPE|IFS|INSTANCE|JOB|LANG|LANGUAGE|LC_ADDRESS|LC_ALL|LC_IDENTIFICATION|LC_MEASUREMENT|LC_MONETARY|LC_NAME|LC_NUMERIC|LC_PAPER|LC_TELEPHON\
E|LC_TIME|LESSCLOSE|LESSOPEN|LINES|LOGNAME|LS_COLORS|MACHTYPE|MAILCHECK|MANDATORY_PATH|NO_AT_BRIDGE|OLDPWD|OPTERR|OPTIND|ORBIT_SOCKETDIR|OST\
YPE|PAPERSIZE|PATH|PIPESTATUS|PPID|PS1|PS2|PS3|PS4|PWD|RANDOM|REPLY|SECONDS|SELINUX_INIT|SESSION|SESSIONTYPE|SESSION_MANAGER|SHELL|SHELLOPTS\
|SHLVL|SSH_AUTH_SOCK|TERM|UID|UPSTART_EVENTS|UPSTART_INSTANCE|UPSTART_JOB|UPSTART_SESSION|USER|WINDOWID|XAUTHORITY|XDG_CONFIG_DIRS|XDG_CURRE\
NT_DESKTOP|XDG_DATA_DIRS|XDG_GREETER_DATA_DIR|XDG_MENU_PREFIX|XDG_RUNTIME_DIR|XDG_SEAT|XDG_SEAT_PATH|XDG_SESSION_DESKTOP|XDG_SESSION_ID|XDG_\
SESSION_PATH|XDG_SESSION_TYPE|XDG_VTNR|XMODIFIERS)\\b", n = {
        pattern: /(^(["']?)\w+\2)[ \t]+\S.*/,
        lookbehind: !0,
        alias: "punctuation",
        // this looks reasonably well in all themes
        inside: null
        // see below
      }, a = {
        bash: n,
        environment: {
          pattern: RegExp("\\$" + r),
          alias: "constant"
        },
        variable: [
          // [0]: Arithmetic Environment
          {
            pattern: /\$?\(\([\s\S]+?\)\)/,
            greedy: !0,
            inside: {
              // If there is a $ sign at the beginning highlight $(( and )) as variable
              variable: [
                {
                  pattern: /(^\$\(\([\s\S]+)\)\)/,
                  lookbehind: !0
                },
                /^\$\(\(/
              ],
              number: /\b0x[\dA-Fa-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[Ee]-?\d+)?/,
              // Operators according to https://www.gnu.org/software/bash/manual/bashref.html#Shell-Arithmetic
              operator: /--|\+\+|\*\*=?|<<=?|>>=?|&&|\|\||[=!+\-*/%<>^&|]=?|[?~:]/,
              // If there is no $ sign at the beginning highlight (( and )) as punctuation
              punctuation: /\(\(?|\)\)?|,|;/
            }
          },
          // [1]: Command Substitution
          {
            pattern: /\$\((?:\([^)]+\)|[^()])+\)|`[^`]+`/,
            greedy: !0,
            inside: {
              variable: /^\$\(|^`|\)$|`$/
            }
          },
          // [2]: Brace expansion
          {
            pattern: /\$\{[^}]+\}/,
            greedy: !0,
            inside: {
              operator: /:[-=?+]?|[!\/]|##?|%%?|\^\^?|,,?/,
              punctuation: /[\[\]]/,
              environment: {
                pattern: RegExp("(\\{)" + r),
                lookbehind: !0,
                alias: "constant"
              }
            }
          },
          /\$(?:\w+|[#?*!@$])/
        ],
        // Escape sequences from echo and printf's manuals, and escaped quotes.
        entity: /\\(?:[abceEfnrtv\\"]|O?[0-7]{1,3}|U[0-9a-fA-F]{8}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{1,2})/
      };
      t.languages.bash = {
        shebang: {
          pattern: /^#!\s*\/.*/,
          alias: "important"
        },
        comment: {
          pattern: /(^|[^"{\\$])#.*/,
          lookbehind: !0
        },
        "function-name": [
          // a) function foo {
          // b) foo() {
          // c) function foo() {
          // but not “foo {”
          {
            // a) and c)
            pattern: /(\bfunction\s+)[\w-]+(?=(?:\s*\(?:\s*\))?\s*\{)/,
            lookbehind: !0,
            alias: "function"
          },
          {
            // b)
            pattern: /\b[\w-]+(?=\s*\(\s*\)\s*\{)/,
            alias: "function"
          }
        ],
        // Highlight variable names as variables in for and select beginnings.
        "for-or-select": {
          pattern: /(\b(?:for|select)\s+)\w+(?=\s+in\s)/,
          alias: "variable",
          lookbehind: !0
        },
        // Highlight variable names as variables in the left-hand part
        // of assignments (“=” and “+=”).
        "assign-left": {
          pattern: /(^|[\s;|&]|[<>]\()\w+(?=\+?=)/,
          inside: {
            environment: {
              pattern: RegExp("(^|[\\s;|&]|[<>]\\()" + r),
              lookbehind: !0,
              alias: "constant"
            }
          },
          alias: "variable",
          lookbehind: !0
        },
        string: [
          // Support for Here-documents https://en.wikipedia.org/wiki/Here_document
          {
            pattern: /((?:^|[^<])<<-?\s*)(\w+)\s[\s\S]*?(?:\r?\n|\r)\2/,
            lookbehind: !0,
            greedy: !0,
            inside: a
          },
          // Here-document with quotes around the tag
          // → No expansion (so no “inside”).
          {
            pattern: /((?:^|[^<])<<-?\s*)(["'])(\w+)\2\s[\s\S]*?(?:\r?\n|\r)\3/,
            lookbehind: !0,
            greedy: !0,
            inside: {
              bash: n
            }
          },
          // “Normal” string
          {
            // https://www.gnu.org/software/bash/manual/html_node/Double-Quotes.html
            pattern: /(^|[^\\](?:\\\\)*)"(?:\\[\s\S]|\$\([^)]+\)|\$(?!\()|`[^`]+`|[^"\\`$])*"/,
            lookbehind: !0,
            greedy: !0,
            inside: a
          },
          {
            // https://www.gnu.org/software/bash/manual/html_node/Single-Quotes.html
            pattern: /(^|[^$\\])'[^']*'/,
            lookbehind: !0,
            greedy: !0
          },
          {
            // https://www.gnu.org/software/bash/manual/html_node/ANSI_002dC-Quoting.html
            pattern: /\$'(?:[^'\\]|\\[\s\S])*'/,
            greedy: !0,
            inside: {
              entity: a.entity
            }
          }
        ],
        environment: {
          pattern: RegExp("\\$?" + r),
          alias: "constant"
        },
        variable: a.variable,
        function: {
          pattern: /(^|[\s;|&]|[<>]\()(?:add|apropos|apt|apt-cache|apt-get|aptitude|aspell|automysqlbackup|awk|basename|bash|bc|bconsole|bg|bzip2|cal|cat|cfdisk|chgrp|chkconfig|chmod|chown|chroot|cksum|clear|cmp|column|comm|composer|cp|cron|crontab|csplit|curl|cut|date|dc|dd|ddrescue|debootstrap|df|diff|diff3|dig|dir|dircolors|dirname|dirs|dmesg|docker|docker-compose|du|egrep|eject|env|ethtool|expand|expect|expr|fdformat|fdisk|fg|fgrep|file|find|fmt|fold|format|free|fsck|ftp|fuser|gawk|git|gparted|grep|groupadd|groupdel|groupmod|groups|grub-mkconfig|gzip|halt|head|hg|history|host|hostname|htop|iconv|id|ifconfig|ifdown|ifup|import|install|ip|jobs|join|kill|killall|less|link|ln|locate|logname|logrotate|look|lpc|lpr|lprint|lprintd|lprintq|lprm|ls|lsof|lynx|make|man|mc|mdadm|mkconfig|mkdir|mke2fs|mkfifo|mkfs|mkisofs|mknod|mkswap|mmv|more|most|mount|mtools|mtr|mutt|mv|nano|nc|netstat|nice|nl|node|nohup|notify-send|npm|nslookup|op|open|parted|passwd|paste|pathchk|ping|pkill|pnpm|podman|podman-compose|popd|pr|printcap|printenv|ps|pushd|pv|quota|quotacheck|quotactl|ram|rar|rcp|reboot|remsync|rename|renice|rev|rm|rmdir|rpm|rsync|scp|screen|sdiff|sed|sendmail|seq|service|sftp|sh|shellcheck|shuf|shutdown|sleep|slocate|sort|split|ssh|stat|strace|su|sudo|sum|suspend|swapon|sync|tac|tail|tar|tee|time|timeout|top|touch|tr|traceroute|tsort|tty|umount|uname|unexpand|uniq|units|unrar|unshar|unzip|update-grub|uptime|useradd|userdel|usermod|users|uudecode|uuencode|v|vcpkg|vdir|vi|vim|virsh|vmstat|wait|watch|wc|wget|whereis|which|who|whoami|write|xargs|xdg-open|yarn|yes|zenity|zip|zsh|zypper)(?=$|[)\s;|&])/,
          lookbehind: !0
        },
        keyword: {
          pattern: /(^|[\s;|&]|[<>]\()(?:case|do|done|elif|else|esac|fi|for|function|if|in|select|then|until|while)(?=$|[)\s;|&])/,
          lookbehind: !0
        },
        // https://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html
        builtin: {
          pattern: /(^|[\s;|&]|[<>]\()(?:\.|:|alias|bind|break|builtin|caller|cd|command|continue|declare|echo|enable|eval|exec|exit|export|getopts|hash|help|let|local|logout|mapfile|printf|pwd|read|readarray|readonly|return|set|shift|shopt|source|test|times|trap|type|typeset|ulimit|umask|unalias|unset)(?=$|[)\s;|&])/,
          lookbehind: !0,
          // Alias added to make those easier to distinguish from strings.
          alias: "class-name"
        },
        boolean: {
          pattern: /(^|[\s;|&]|[<>]\()(?:false|true)(?=$|[)\s;|&])/,
          lookbehind: !0
        },
        "file-descriptor": {
          pattern: /\B&\d\b/,
          alias: "important"
        },
        operator: {
          // Lots of redirections here, but not just that.
          pattern: /\d?<>|>\||\+=|=[=~]?|!=?|<<[<-]?|[&\d]?>>|\d[<>]&?|[<>][&=]?|&[>&]?|\|[&|]?/,
          inside: {
            "file-descriptor": {
              pattern: /^\d/,
              alias: "important"
            }
          }
        },
        punctuation: /\$?\(\(?|\)\)?|\.\.|[{}[\];\\]/,
        number: {
          pattern: /(^|\s)(?:[1-9]\d*|0)(?:[.,]\d+)?\b/,
          lookbehind: !0
        }
      }, n.inside = t.languages.bash;
      for (var i = [
        "comment",
        "function-name",
        "for-or-select",
        "assign-left",
        "string",
        "environment",
        "function",
        "keyword",
        "builtin",
        "boolean",
        "file-descriptor",
        "operator",
        "punctuation",
        "number"
      ], c = a.variable[1].inside, l = 0; l < i.length; l++)
        c[i[l]] = t.languages.bash[i[l]];
      t.languages.shell = t.languages.bash;
    })(e);
  }
  o(Na, "bash");
});

// ../node_modules/react-syntax-highlighter/dist/esm/languages/prism/bash.js
var o1, a1, i1 = C(() => {
  o1 = me(n1()), a1 = o1.default;
});

// ../node_modules/react-syntax-highlighter/dist/esm/languages/prism/css.js
var l1, c1, s1 = C(() => {
  l1 = me(Ha()), c1 = l1.default;
});

// ../node_modules/refractor/lang/graphql.js
var f1 = H((ty, u1) => {
  "use strict";
  u1.exports = Fa;
  Fa.displayName = "graphql";
  Fa.aliases = [];
  function Fa(e) {
    e.languages.graphql = {
      comment: /#.*/,
      description: {
        pattern: /(?:"""(?:[^"]|(?!""")")*"""|"(?:\\.|[^\\"\r\n])*")(?=\s*[a-z_])/i,
        greedy: !0,
        alias: "string",
        inside: {
          "language-markdown": {
            pattern: /(^"(?:"")?)(?!\1)[\s\S]+(?=\1$)/,
            lookbehind: !0,
            inside: e.languages.markdown
          }
        }
      },
      string: {
        pattern: /"""(?:[^"]|(?!""")")*"""|"(?:\\.|[^\\"\r\n])*"/,
        greedy: !0
      },
      number: /(?:\B-|\b)\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
      boolean: /\b(?:false|true)\b/,
      variable: /\$[a-z_]\w*/i,
      directive: {
        pattern: /@[a-z_]\w*/i,
        alias: "function"
      },
      "attr-name": {
        pattern: /\b[a-z_]\w*(?=\s*(?:\((?:[^()"]|"(?:\\.|[^\\"\r\n])*")*\))?:)/i,
        greedy: !0
      },
      "atom-input": {
        pattern: /\b[A-Z]\w*Input\b/,
        alias: "class-name"
      },
      scalar: /\b(?:Boolean|Float|ID|Int|String)\b/,
      constant: /\b[A-Z][A-Z_\d]*\b/,
      "class-name": {
        pattern: /(\b(?:enum|implements|interface|on|scalar|type|union)\s+|&\s*|:\s*|\[)[A-Z_]\w*/,
        lookbehind: !0
      },
      fragment: {
        pattern: /(\bfragment\s+|\.{3}\s*(?!on\b))[a-zA-Z_]\w*/,
        lookbehind: !0,
        alias: "function"
      },
      "definition-mutation": {
        pattern: /(\bmutation\s+)[a-zA-Z_]\w*/,
        lookbehind: !0,
        alias: "function"
      },
      "definition-query": {
        pattern: /(\bquery\s+)[a-zA-Z_]\w*/,
        lookbehind: !0,
        alias: "function"
      },
      keyword: /\b(?:directive|enum|extend|fragment|implements|input|interface|mutation|on|query|repeatable|scalar|schema|subscription|type|union)\b/,
      operator: /[!=|&]|\.{3}/,
      "property-query": /\w+(?=\s*\()/,
      object: /\w+(?=\s*\{)/,
      punctuation: /[!(){}\[\]:=,]/,
      property: /\w+/
    }, e.hooks.add("after-tokenize", /* @__PURE__ */ o(function(r) {
      if (r.language !== "graphql")
        return;
      var n = r.tokens.filter(function(h) {
        return typeof h != "string" && h.type !== "comment" && h.type !== "scalar";
      }), a = 0;
      function i(h) {
        return n[a + h];
      }
      o(i, "getToken");
      function c(h, g) {
        g = g || 0;
        for (var w = 0; w < h.length; w++) {
          var b = i(w + g);
          if (!b || b.type !== h[w])
            return !1;
        }
        return !0;
      }
      o(c, "isTokenType");
      function l(h, g) {
        for (var w = 1, b = a; b < n.length; b++) {
          var x = n[b], E = x.content;
          if (x.type === "punctuation" && typeof E == "string") {
            if (h.test(E))
              w++;
            else if (g.test(E) && (w--, w === 0))
              return b;
          }
        }
        return -1;
      }
      o(l, "findClosingBracket");
      function s(h, g) {
        var w = h.alias;
        w ? Array.isArray(w) || (h.alias = w = [w]) : h.alias = w = [], w.push(g);
      }
      for (o(s, "addAlias"); a < n.length; ) {
        var u = n[a++];
        if (u.type === "keyword" && u.content === "mutation") {
          var f = [];
          if (c(["definition-mutation", "punctuation"]) && i(1).content === "(") {
            a += 2;
            var d = l(/^\($/, /^\)$/);
            if (d === -1)
              continue;
            for (; a < d; a++) {
              var m = i(0);
              m.type === "variable" && (s(m, "variable-input"), f.push(m.content));
            }
            a = d + 1;
          }
          if (c(["punctuation", "property-query"]) && i(0).content === "{" && (a++, s(i(0), "property-mutation"), f.length > 0)) {
            var v = l(/^\{$/, /^\}$/);
            if (v === -1)
              continue;
            for (var y = a; y < v; y++) {
              var p = n[y];
              p.type === "variable" && f.indexOf(p.content) >= 0 && s(p, "variable-input");
            }
          }
        }
      }
    }, "afterTokenizeGraphql"));
  }
  o(Fa, "graphql");
});

// ../node_modules/react-syntax-highlighter/dist/esm/languages/prism/graphql.js
var d1, p1, m1 = C(() => {
  d1 = me(f1()), p1 = d1.default;
});

// ../node_modules/refractor/lang/js-extras.js
var g1 = H((oy, h1) => {
  "use strict";
  h1.exports = Da;
  Da.displayName = "jsExtras";
  Da.aliases = [];
  function Da(e) {
    (function(t) {
      t.languages.insertBefore("javascript", "function-variable", {
        "method-variable": {
          pattern: RegExp(
            "(\\.\\s*)" + t.languages.javascript["function-variable"].pattern.source
          ),
          lookbehind: !0,
          alias: ["function-variable", "method", "function", "property-access"]
        }
      }), t.languages.insertBefore("javascript", "function", {
        method: {
          pattern: RegExp(
            "(\\.\\s*)" + t.languages.javascript.function.source
          ),
          lookbehind: !0,
          alias: ["function", "property-access"]
        }
      }), t.languages.insertBefore("javascript", "constant", {
        "known-class-name": [
          {
            // standard built-ins
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
            pattern: /\b(?:(?:Float(?:32|64)|(?:Int|Uint)(?:8|16|32)|Uint8Clamped)?Array|ArrayBuffer|BigInt|Boolean|DataView|Date|Error|Function|Intl|JSON|(?:Weak)?(?:Map|Set)|Math|Number|Object|Promise|Proxy|Reflect|RegExp|String|Symbol|WebAssembly)\b/,
            alias: "class-name"
          },
          {
            // errors
            pattern: /\b(?:[A-Z]\w*)Error\b/,
            alias: "class-name"
          }
        ]
      });
      function r(s, u) {
        return RegExp(
          s.replace(/<ID>/g, function() {
            return /(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*/.source;
          }),
          u
        );
      }
      o(r, "withId"), t.languages.insertBefore("javascript", "keyword", {
        imports: {
          // https://tc39.es/ecma262/#sec-imports
          pattern: r(
            /(\bimport\b\s*)(?:<ID>(?:\s*,\s*(?:\*\s*as\s+<ID>|\{[^{}]*\}))?|\*\s*as\s+<ID>|\{[^{}]*\})(?=\s*\bfrom\b)/.source
          ),
          lookbehind: !0,
          inside: t.languages.javascript
        },
        exports: {
          // https://tc39.es/ecma262/#sec-exports
          pattern: r(
            /(\bexport\b\s*)(?:\*(?:\s*as\s+<ID>)?(?=\s*\bfrom\b)|\{[^{}]*\})/.source
          ),
          lookbehind: !0,
          inside: t.languages.javascript
        }
      }), t.languages.javascript.keyword.unshift(
        {
          pattern: /\b(?:as|default|export|from|import)\b/,
          alias: "module"
        },
        {
          pattern: /\b(?:await|break|catch|continue|do|else|finally|for|if|return|switch|throw|try|while|yield)\b/,
          alias: "control-flow"
        },
        {
          pattern: /\bnull\b/,
          alias: ["null", "nil"]
        },
        {
          pattern: /\bundefined\b/,
          alias: "nil"
        }
      ), t.languages.insertBefore("javascript", "operator", {
        spread: {
          pattern: /\.{3}/,
          alias: "operator"
        },
        arrow: {
          pattern: /=>/,
          alias: "operator"
        }
      }), t.languages.insertBefore("javascript", "punctuation", {
        "property-access": {
          pattern: r(/(\.\s*)#?<ID>/.source),
          lookbehind: !0
        },
        "maybe-class-name": {
          pattern: /(^|[^$\w\xA0-\uFFFF])[A-Z][$\w\xA0-\uFFFF]+/,
          lookbehind: !0
        },
        dom: {
          // this contains only a few commonly used DOM variables
          pattern: /\b(?:document|(?:local|session)Storage|location|navigator|performance|window)\b/,
          alias: "variable"
        },
        console: {
          pattern: /\bconsole(?=\s*\.)/,
          alias: "class-name"
        }
      });
      for (var n = [
        "function",
        "function-variable",
        "method",
        "method-variable",
        "property-access"
      ], a = 0; a < n.length; a++) {
        var i = n[a], c = t.languages.javascript[i];
        t.util.type(c) === "RegExp" && (c = t.languages.javascript[i] = {
          pattern: c
        });
        var l = c.inside || {};
        c.inside = l, l["maybe-class-name"] = /^[A-Z][\s\S]*/;
      }
    })(e);
  }
  o(Da, "jsExtras");
});

// ../node_modules/react-syntax-highlighter/dist/esm/languages/prism/js-extras.js
var v1, w1, b1 = C(() => {
  v1 = me(g1()), w1 = v1.default;
});

// ../node_modules/refractor/lang/json.js
var R1 = H((ly, y1) => {
  "use strict";
  y1.exports = _a;
  _a.displayName = "json";
  _a.aliases = ["webmanifest"];
  function _a(e) {
    e.languages.json = {
      property: {
        pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
        lookbehind: !0,
        greedy: !0
      },
      string: {
        pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
        lookbehind: !0,
        greedy: !0
      },
      comment: {
        pattern: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
        greedy: !0
      },
      number: /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
      punctuation: /[{}[\],]/,
      operator: /:/,
      boolean: /\b(?:false|true)\b/,
      null: {
        pattern: /\bnull\b/,
        alias: "keyword"
      }
    }, e.languages.webmanifest = e.languages.json;
  }
  o(_a, "json");
});

// ../node_modules/react-syntax-highlighter/dist/esm/languages/prism/json.js
var x1, E1, S1 = C(() => {
  x1 = me(R1()), E1 = x1.default;
});

// ../node_modules/refractor/lang/jsx.js
var Va = H((uy, C1) => {
  "use strict";
  C1.exports = $a;
  $a.displayName = "jsx";
  $a.aliases = [];
  function $a(e) {
    (function(t) {
      var r = t.util.clone(t.languages.javascript), n = /(?:\s|\/\/.*(?!.)|\/\*(?:[^*]|\*(?!\/))\*\/)/.source, a = /(?:\{(?:\{(?:\{[^{}]*\}|[^{}])*\}|[^{}])*\})/.
      source, i = /(?:\{<S>*\.{3}(?:[^{}]|<BRACES>)*\})/.source;
      function c(u, f) {
        return u = u.replace(/<S>/g, function() {
          return n;
        }).replace(/<BRACES>/g, function() {
          return a;
        }).replace(/<SPREAD>/g, function() {
          return i;
        }), RegExp(u, f);
      }
      o(c, "re"), i = c(i).source, t.languages.jsx = t.languages.extend("markup", r), t.languages.jsx.tag.pattern = c(
        /<\/?(?:[\w.:-]+(?:<S>+(?:[\w.:$-]+(?:=(?:"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'|[^\s{'"/>=]+|<BRACES>))?|<SPREAD>))*<S>*\/?)?>/.
        source
      ), t.languages.jsx.tag.inside.tag.pattern = /^<\/?[^\s>\/]*/, t.languages.jsx.tag.inside["attr-value"].pattern = /=(?!\{)(?:"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'|[^\s'">]+)/,
      t.languages.jsx.tag.inside.tag.inside["class-name"] = /^[A-Z]\w*(?:\.[A-Z]\w*)*$/, t.languages.jsx.tag.inside.comment = r.comment, t.languages.
      insertBefore(
        "inside",
        "attr-name",
        {
          spread: {
            pattern: c(/<SPREAD>/.source),
            inside: t.languages.jsx
          }
        },
        t.languages.jsx.tag
      ), t.languages.insertBefore(
        "inside",
        "special-attr",
        {
          script: {
            // Allow for two levels of nesting
            pattern: c(/=<BRACES>/.source),
            alias: "language-javascript",
            inside: {
              "script-punctuation": {
                pattern: /^=(?=\{)/,
                alias: "punctuation"
              },
              rest: t.languages.jsx
            }
          }
        },
        t.languages.jsx.tag
      );
      var l = /* @__PURE__ */ o(function(u) {
        return u ? typeof u == "string" ? u : typeof u.content == "string" ? u.content : u.content.map(l).join("") : "";
      }, "stringifyToken"), s = /* @__PURE__ */ o(function(u) {
        for (var f = [], d = 0; d < u.length; d++) {
          var m = u[d], v = !1;
          if (typeof m != "string" && (m.type === "tag" && m.content[0] && m.content[0].type === "tag" ? m.content[0].content[0].content ===
          "</" ? f.length > 0 && f[f.length - 1].tagName === l(m.content[0].content[1]) && f.pop() : m.content[m.content.length - 1].content ===
          "/>" || f.push({
            tagName: l(m.content[0].content[1]),
            openedBraces: 0
          }) : f.length > 0 && m.type === "punctuation" && m.content === "{" ? f[f.length - 1].openedBraces++ : f.length > 0 && f[f.length -
          1].openedBraces > 0 && m.type === "punctuation" && m.content === "}" ? f[f.length - 1].openedBraces-- : v = !0), (v || typeof m ==
          "string") && f.length > 0 && f[f.length - 1].openedBraces === 0) {
            var y = l(m);
            d < u.length - 1 && (typeof u[d + 1] == "string" || u[d + 1].type === "plain-text") && (y += l(u[d + 1]), u.splice(d + 1, 1)), d >
            0 && (typeof u[d - 1] == "string" || u[d - 1].type === "plain-text") && (y = l(u[d - 1]) + y, u.splice(d - 1, 1), d--), u[d] = new t.
            Token(
              "plain-text",
              y,
              null,
              y
            );
          }
          m.content && typeof m.content != "string" && s(m.content);
        }
      }, "walkTokens");
      t.hooks.add("after-tokenize", function(u) {
        u.language !== "jsx" && u.language !== "tsx" || s(u.tokens);
      });
    })(e);
  }
  o($a, "jsx");
});

// ../node_modules/react-syntax-highlighter/dist/esm/languages/prism/jsx.js
var M1, A1, L1 = C(() => {
  M1 = me(Va()), A1 = M1.default;
});

// ../node_modules/refractor/lang/markdown.js
var z1 = H((py, I1) => {
  "use strict";
  I1.exports = ja;
  ja.displayName = "markdown";
  ja.aliases = ["md"];
  function ja(e) {
    (function(t) {
      var r = /(?:\\.|[^\\\n\r]|(?:\n|\r\n?)(?![\r\n]))/.source;
      function n(d) {
        return d = d.replace(/<inner>/g, function() {
          return r;
        }), RegExp(/((?:^|[^\\])(?:\\{2})*)/.source + "(?:" + d + ")");
      }
      o(n, "createInline");
      var a = /(?:\\.|``(?:[^`\r\n]|`(?!`))+``|`[^`\r\n]+`|[^\\|\r\n`])+/.source, i = /\|?__(?:\|__)+\|?(?:(?:\n|\r\n?)|(?![\s\S]))/.source.
      replace(
        /__/g,
        function() {
          return a;
        }
      ), c = /\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?(?:\n|\r\n?)/.source;
      t.languages.markdown = t.languages.extend("markup", {}), t.languages.insertBefore("markdown", "prolog", {
        "front-matter-block": {
          pattern: /(^(?:\s*[\r\n])?)---(?!.)[\s\S]*?[\r\n]---(?!.)/,
          lookbehind: !0,
          greedy: !0,
          inside: {
            punctuation: /^---|---$/,
            "front-matter": {
              pattern: /\S+(?:\s+\S+)*/,
              alias: ["yaml", "language-yaml"],
              inside: t.languages.yaml
            }
          }
        },
        blockquote: {
          // > ...
          pattern: /^>(?:[\t ]*>)*/m,
          alias: "punctuation"
        },
        table: {
          pattern: RegExp(
            "^" + i + c + "(?:" + i + ")*",
            "m"
          ),
          inside: {
            "table-data-rows": {
              pattern: RegExp(
                "^(" + i + c + ")(?:" + i + ")*$"
              ),
              lookbehind: !0,
              inside: {
                "table-data": {
                  pattern: RegExp(a),
                  inside: t.languages.markdown
                },
                punctuation: /\|/
              }
            },
            "table-line": {
              pattern: RegExp("^(" + i + ")" + c + "$"),
              lookbehind: !0,
              inside: {
                punctuation: /\||:?-{3,}:?/
              }
            },
            "table-header-row": {
              pattern: RegExp("^" + i + "$"),
              inside: {
                "table-header": {
                  pattern: RegExp(a),
                  alias: "important",
                  inside: t.languages.markdown
                },
                punctuation: /\|/
              }
            }
          }
        },
        code: [
          {
            // Prefixed by 4 spaces or 1 tab and preceded by an empty line
            pattern: /((?:^|\n)[ \t]*\n|(?:^|\r\n?)[ \t]*\r\n?)(?: {4}|\t).+(?:(?:\n|\r\n?)(?: {4}|\t).+)*/,
            lookbehind: !0,
            alias: "keyword"
          },
          {
            // ```optional language
            // code block
            // ```
            pattern: /^```[\s\S]*?^```$/m,
            greedy: !0,
            inside: {
              "code-block": {
                pattern: /^(```.*(?:\n|\r\n?))[\s\S]+?(?=(?:\n|\r\n?)^```$)/m,
                lookbehind: !0
              },
              "code-language": {
                pattern: /^(```).+/,
                lookbehind: !0
              },
              punctuation: /```/
            }
          }
        ],
        title: [
          {
            // title 1
            // =======
            // title 2
            // -------
            pattern: /\S.*(?:\n|\r\n?)(?:==+|--+)(?=[ \t]*$)/m,
            alias: "important",
            inside: {
              punctuation: /==+$|--+$/
            }
          },
          {
            // # title 1
            // ###### title 6
            pattern: /(^\s*)#.+/m,
            lookbehind: !0,
            alias: "important",
            inside: {
              punctuation: /^#+|#+$/
            }
          }
        ],
        hr: {
          // ***
          // ---
          // * * *
          // -----------
          pattern: /(^\s*)([*-])(?:[\t ]*\2){2,}(?=\s*$)/m,
          lookbehind: !0,
          alias: "punctuation"
        },
        list: {
          // * item
          // + item
          // - item
          // 1. item
          pattern: /(^\s*)(?:[*+-]|\d+\.)(?=[\t ].)/m,
          lookbehind: !0,
          alias: "punctuation"
        },
        "url-reference": {
          // [id]: http://example.com "Optional title"
          // [id]: http://example.com 'Optional title'
          // [id]: http://example.com (Optional title)
          // [id]: <http://example.com> "Optional title"
          pattern: /!?\[[^\]]+\]:[\t ]+(?:\S+|<(?:\\.|[^>\\])+>)(?:[\t ]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?/,
          inside: {
            variable: {
              pattern: /^(!?\[)[^\]]+/,
              lookbehind: !0
            },
            string: /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$/,
            punctuation: /^[\[\]!:]|[<>]/
          },
          alias: "url"
        },
        bold: {
          // **strong**
          // __strong__
          // allow one nested instance of italic text using the same delimiter
          pattern: n(
            /\b__(?:(?!_)<inner>|_(?:(?!_)<inner>)+_)+__\b|\*\*(?:(?!\*)<inner>|\*(?:(?!\*)<inner>)+\*)+\*\*/.source
          ),
          lookbehind: !0,
          greedy: !0,
          inside: {
            content: {
              pattern: /(^..)[\s\S]+(?=..$)/,
              lookbehind: !0,
              inside: {}
              // see below
            },
            punctuation: /\*\*|__/
          }
        },
        italic: {
          // *em*
          // _em_
          // allow one nested instance of bold text using the same delimiter
          pattern: n(
            /\b_(?:(?!_)<inner>|__(?:(?!_)<inner>)+__)+_\b|\*(?:(?!\*)<inner>|\*\*(?:(?!\*)<inner>)+\*\*)+\*/.source
          ),
          lookbehind: !0,
          greedy: !0,
          inside: {
            content: {
              pattern: /(^.)[\s\S]+(?=.$)/,
              lookbehind: !0,
              inside: {}
              // see below
            },
            punctuation: /[*_]/
          }
        },
        strike: {
          // ~~strike through~~
          // ~strike~
          // eslint-disable-next-line regexp/strict
          pattern: n(/(~~?)(?:(?!~)<inner>)+\2/.source),
          lookbehind: !0,
          greedy: !0,
          inside: {
            content: {
              pattern: /(^~~?)[\s\S]+(?=\1$)/,
              lookbehind: !0,
              inside: {}
              // see below
            },
            punctuation: /~~?/
          }
        },
        "code-snippet": {
          // `code`
          // ``code``
          pattern: /(^|[^\\`])(?:``[^`\r\n]+(?:`[^`\r\n]+)*``(?!`)|`[^`\r\n]+`(?!`))/,
          lookbehind: !0,
          greedy: !0,
          alias: ["code", "keyword"]
        },
        url: {
          // [example](http://example.com "Optional title")
          // [example][id]
          // [example] [id]
          pattern: n(
            /!?\[(?:(?!\])<inner>)+\](?:\([^\s)]+(?:[\t ]+"(?:\\.|[^"\\])*")?\)|[ \t]?\[(?:(?!\])<inner>)+\])/.source
          ),
          lookbehind: !0,
          greedy: !0,
          inside: {
            operator: /^!/,
            content: {
              pattern: /(^\[)[^\]]+(?=\])/,
              lookbehind: !0,
              inside: {}
              // see below
            },
            variable: {
              pattern: /(^\][ \t]?\[)[^\]]+(?=\]$)/,
              lookbehind: !0
            },
            url: {
              pattern: /(^\]\()[^\s)]+/,
              lookbehind: !0
            },
            string: {
              pattern: /(^[ \t]+)"(?:\\.|[^"\\])*"(?=\)$)/,
              lookbehind: !0
            }
          }
        }
      }), ["url", "bold", "italic", "strike"].forEach(function(d) {
        ["url", "bold", "italic", "strike", "code-snippet"].forEach(function(m) {
          d !== m && (t.languages.markdown[d].inside.content.inside[m] = t.languages.markdown[m]);
        });
      }), t.hooks.add("after-tokenize", function(d) {
        if (d.language !== "markdown" && d.language !== "md")
          return;
        function m(v) {
          if (!(!v || typeof v == "string"))
            for (var y = 0, p = v.length; y < p; y++) {
              var h = v[y];
              if (h.type !== "code") {
                m(h.content);
                continue;
              }
              var g = h.content[1], w = h.content[3];
              if (g && w && g.type === "code-language" && w.type === "code-block" && typeof g.content == "string") {
                var b = g.content.replace(/\b#/g, "sharp").replace(/\b\+\+/g, "pp");
                b = (/[a-z][\w-]*/i.exec(b) || [""])[0].toLowerCase();
                var x = "language-" + b;
                w.alias ? typeof w.alias == "string" ? w.alias = [w.alias, x] : w.alias.push(x) : w.alias = [x];
              }
            }
        }
        o(m, "walkTokens"), m(d.tokens);
      }), t.hooks.add("wrap", function(d) {
        if (d.type === "code-block") {
          for (var m = "", v = 0, y = d.classes.length; v < y; v++) {
            var p = d.classes[v], h = /language-(.+)/.exec(p);
            if (h) {
              m = h[1];
              break;
            }
          }
          var g = t.languages[m];
          if (g)
            d.content = t.highlight(
              f(d.content.value),
              g,
              m
            );
          else if (m && m !== "none" && t.plugins.autoloader) {
            var w = "md-" + (/* @__PURE__ */ new Date()).valueOf() + "-" + Math.floor(Math.random() * 1e16);
            d.attributes.id = w, t.plugins.autoloader.loadLanguages(m, function() {
              var b = document.getElementById(w);
              b && (b.innerHTML = t.highlight(
                b.textContent,
                t.languages[m],
                m
              ));
            });
          }
        }
      });
      var l = RegExp(t.languages.markup.tag.pattern.source, "gi"), s = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"'
      }, u = String.fromCodePoint || String.fromCharCode;
      function f(d) {
        var m = d.replace(l, "");
        return m = m.replace(/&(\w{1,8}|#x?[\da-f]{1,8});/gi, function(v, y) {
          if (y = y.toLowerCase(), y[0] === "#") {
            var p;
            return y[1] === "x" ? p = parseInt(y.slice(2), 16) : p = Number(y.slice(1)), u(p);
          } else {
            var h = s[y];
            return h || v;
          }
        }), m;
      }
      o(f, "textContent"), t.languages.md = t.languages.markdown;
    })(e);
  }
  o(ja, "markdown");
});

// ../node_modules/react-syntax-highlighter/dist/esm/languages/prism/markdown.js
var T1, H1, P1 = C(() => {
  T1 = me(z1()), H1 = T1.default;
});

// ../node_modules/react-syntax-highlighter/dist/esm/languages/prism/markup.js
var k1, O1, B1 = C(() => {
  k1 = me(za()), O1 = k1.default;
});

// ../node_modules/refractor/lang/typescript.js
var Ua = H((vy, N1) => {
  "use strict";
  N1.exports = Wa;
  Wa.displayName = "typescript";
  Wa.aliases = ["ts"];
  function Wa(e) {
    (function(t) {
      t.languages.typescript = t.languages.extend("javascript", {
        "class-name": {
          pattern: /(\b(?:class|extends|implements|instanceof|interface|new|type)\s+)(?!keyof\b)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?:\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>)?/,
          lookbehind: !0,
          greedy: !0,
          inside: null
          // see below
        },
        builtin: /\b(?:Array|Function|Promise|any|boolean|console|never|number|string|symbol|unknown)\b/
      }), t.languages.typescript.keyword.push(
        /\b(?:abstract|declare|is|keyof|readonly|require)\b/,
        // keywords that have to be followed by an identifier
        /\b(?:asserts|infer|interface|module|namespace|type)\b(?=\s*(?:[{_$a-zA-Z\xA0-\uFFFF]|$))/,
        // This is for `import type *, {}`
        /\btype\b(?=\s*(?:[\{*]|$))/
      ), delete t.languages.typescript.parameter, delete t.languages.typescript["literal-property"];
      var r = t.languages.extend("typescript", {});
      delete r["class-name"], t.languages.typescript["class-name"].inside = r, t.languages.insertBefore("typescript", "function", {
        decorator: {
          pattern: /@[$\w\xA0-\uFFFF]+/,
          inside: {
            at: {
              pattern: /^@/,
              alias: "operator"
            },
            function: /^[\s\S]+/
          }
        },
        "generic-function": {
          // e.g. foo<T extends "bar" | "baz">( ...
          pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>(?=\s*\()/,
          greedy: !0,
          inside: {
            function: /^#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*/,
            generic: {
              pattern: /<[\s\S]+/,
              // everything after the first <
              alias: "class-name",
              inside: r
            }
          }
        }
      }), t.languages.ts = t.languages.typescript;
    })(e);
  }
  o(Wa, "typescript");
});

// ../node_modules/refractor/lang/tsx.js
var D1 = H((by, F1) => {
  "use strict";
  var Em = Va(), Sm = Ua();
  F1.exports = qa;
  qa.displayName = "tsx";
  qa.aliases = [];
  function qa(e) {
    e.register(Em), e.register(Sm), function(t) {
      var r = t.util.clone(t.languages.typescript);
      t.languages.tsx = t.languages.extend("jsx", r), delete t.languages.tsx.parameter, delete t.languages.tsx["literal-property"];
      var n = t.languages.tsx.tag;
      n.pattern = RegExp(
        /(^|[^\w$]|(?=<\/))/.source + "(?:" + n.pattern.source + ")",
        n.pattern.flags
      ), n.lookbehind = !0;
    }(e);
  }
  o(qa, "tsx");
});

// ../node_modules/react-syntax-highlighter/dist/esm/languages/prism/tsx.js
var _1, $1, V1 = C(() => {
  _1 = me(D1()), $1 = _1.default;
});

// ../node_modules/react-syntax-highlighter/dist/esm/languages/prism/typescript.js
var j1, W1, U1 = C(() => {
  j1 = me(Ua()), W1 = j1.default;
});

// ../node_modules/refractor/lang/yaml.js
var G1 = H((Ey, q1) => {
  "use strict";
  q1.exports = Ga;
  Ga.displayName = "yaml";
  Ga.aliases = ["yml"];
  function Ga(e) {
    (function(t) {
      var r = /[*&][^\s[\]{},]+/, n = /!(?:<[\w\-%#;/?:@&=+$,.!~*'()[\]]+>|(?:[a-zA-Z\d-]*!)?[\w\-%#;/?:@&=+$.~*'()]+)?/, a = "(?:" + n.source +
      "(?:[ 	]+" + r.source + ")?|" + r.source + "(?:[ 	]+" + n.source + ")?)", i = /(?:[^\s\x00-\x08\x0e-\x1f!"#%&'*,\-:>?@[\]`{|}\x7f-\x84\x86-\x9f\ud800-\udfff\ufffe\uffff]|[?:-]<PLAIN>)(?:[ \t]*(?:(?![#:])<PLAIN>|:<PLAIN>))*/.
      source.replace(
        /<PLAIN>/g,
        function() {
          return /[^\s\x00-\x08\x0e-\x1f,[\]{}\x7f-\x84\x86-\x9f\ud800-\udfff\ufffe\uffff]/.source;
        }
      ), c = /"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'/.source;
      function l(s, u) {
        u = (u || "").replace(/m/g, "") + "m";
        var f = /([:\-,[{]\s*(?:\s<<prop>>[ \t]+)?)(?:<<value>>)(?=[ \t]*(?:$|,|\]|\}|(?:[\r\n]\s*)?#))/.source.replace(/<<prop>>/g, function() {
          return a;
        }).replace(/<<value>>/g, function() {
          return s;
        });
        return RegExp(f, u);
      }
      o(l, "createValuePattern"), t.languages.yaml = {
        scalar: {
          pattern: RegExp(
            /([\-:]\s*(?:\s<<prop>>[ \t]+)?[|>])[ \t]*(?:((?:\r?\n|\r)[ \t]+)\S[^\r\n]*(?:\2[^\r\n]+)*)/.source.replace(
              /<<prop>>/g,
              function() {
                return a;
              }
            )
          ),
          lookbehind: !0,
          alias: "string"
        },
        comment: /#.*/,
        key: {
          pattern: RegExp(
            /((?:^|[:\-,[{\r\n?])[ \t]*(?:<<prop>>[ \t]+)?)<<key>>(?=\s*:\s)/.source.replace(/<<prop>>/g, function() {
              return a;
            }).replace(/<<key>>/g, function() {
              return "(?:" + i + "|" + c + ")";
            })
          ),
          lookbehind: !0,
          greedy: !0,
          alias: "atrule"
        },
        directive: {
          pattern: /(^[ \t]*)%.+/m,
          lookbehind: !0,
          alias: "important"
        },
        datetime: {
          pattern: l(
            /\d{4}-\d\d?-\d\d?(?:[tT]|[ \t]+)\d\d?:\d{2}:\d{2}(?:\.\d*)?(?:[ \t]*(?:Z|[-+]\d\d?(?::\d{2})?))?|\d{4}-\d{2}-\d{2}|\d\d?:\d{2}(?::\d{2}(?:\.\d*)?)?/.
            source
          ),
          lookbehind: !0,
          alias: "number"
        },
        boolean: {
          pattern: l(/false|true/.source, "i"),
          lookbehind: !0,
          alias: "important"
        },
        null: {
          pattern: l(/null|~/.source, "i"),
          lookbehind: !0,
          alias: "important"
        },
        string: {
          pattern: l(c),
          lookbehind: !0,
          greedy: !0
        },
        number: {
          pattern: l(
            /[+-]?(?:0x[\da-f]+|0o[0-7]+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|\.inf|\.nan)/.source,
            "i"
          ),
          lookbehind: !0
        },
        tag: n,
        important: r,
        punctuation: /---|[:[\]{}\-,|>?]|\.\.\./
      }, t.languages.yml = t.languages.yaml;
    })(e);
  }
  o(Ga, "yaml");
});

// ../node_modules/react-syntax-highlighter/dist/esm/languages/prism/yaml.js
var Y1, X1, Z1 = C(() => {
  Y1 = me(G1()), X1 = Y1.default;
});

// src/components/components/ActionBar/ActionBar.tsx
import K1 from "react";
import { styled as J1 } from "storybook/theming";
var Cm, Q1, Ya, Xa = C(() => {
  "use strict";
  Cm = J1.div(({ theme: e }) => ({
    position: "absolute",
    bottom: 0,
    right: 0,
    maxWidth: "100%",
    display: "flex",
    background: e.background.content,
    zIndex: 1
  })), Q1 = J1.button(
    ({ theme: e }) => ({
      margin: 0,
      border: "0 none",
      padding: "4px 10px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      color: e.color.defaultText,
      background: e.background.content,
      fontSize: 12,
      lineHeight: "16px",
      fontFamily: e.typography.fonts.base,
      fontWeight: e.typography.weight.bold,
      borderTop: `1px solid ${e.appBorderColor}`,
      borderLeft: `1px solid ${e.appBorderColor}`,
      marginLeft: -1,
      borderRadius: "4px 0 0 0",
      "&:not(:last-child)": { borderRight: `1px solid ${e.appBorderColor}` },
      "& + *": {
        borderLeft: `1px solid ${e.appBorderColor}`,
        borderRadius: 0
      },
      "&:focus": {
        boxShadow: `${e.color.secondary} 0 -3px 0 0 inset`,
        outline: "0 none",
        "@media (forced-colors: active)": {
          outline: "1px solid highlight"
        }
      }
    }),
    ({ disabled: e }) => e && {
      cursor: "not-allowed",
      opacity: 0.5
    }
  );
  Q1.displayName = "ActionButton";
  Ya = /* @__PURE__ */ o(({ actionItems: e, ...t }) => /* @__PURE__ */ K1.createElement(Cm, { ...t }, e.map(({ title: r, className: n, onClick: a,
  disabled: i }, c) => /* @__PURE__ */ K1.createElement(Q1, { key: c, className: n, onClick: a, disabled: !!i }, r))), "ActionBar");
});

// ../node_modules/@radix-ui/react-scroll-area/node_modules/@radix-ui/react-compose-refs/dist/index.mjs
import * as e5 from "react";
function Mm(e, t) {
  typeof e == "function" ? e(t) : e != null && (e.current = t);
}
function Za(...e) {
  return (t) => e.forEach((r) => Mm(r, t));
}
function it(...e) {
  return e5.useCallback(Za(...e), e);
}
var Yn = C(() => {
  o(Mm, "setRef");
  o(Za, "composeRefs");
  o(it, "useComposedRefs");
});

// ../node_modules/@radix-ui/react-scroll-area/node_modules/@radix-ui/react-slot/dist/index.mjs
import * as he from "react";
import { Fragment as Am, jsx as Ka } from "react/jsx-runtime";
function Im(e) {
  return he.isValidElement(e) && e.type === Lm;
}
function zm(e, t) {
  let r = { ...t };
  for (let n in t) {
    let a = e[n], i = t[n];
    /^on[A-Z]/.test(n) ? a && i ? r[n] = (...l) => {
      i(...l), a(...l);
    } : a && (r[n] = a) : n === "style" ? r[n] = { ...a, ...i } : n === "className" && (r[n] = [a, i].filter(Boolean).join(" "));
  }
  return { ...e, ...r };
}
function Tm(e) {
  let t = Object.getOwnPropertyDescriptor(e.props, "ref")?.get, r = t && "isReactWarning" in t && t.isReactWarning;
  return r ? e.ref : (t = Object.getOwnPropertyDescriptor(e, "ref")?.get, r = t && "isReactWarning" in t && t.isReactWarning, r ? e.props.ref :
  e.props.ref || e.ref);
}
var Qa, Ja, Lm, t5 = C(() => {
  Yn();
  Qa = he.forwardRef((e, t) => {
    let { children: r, ...n } = e, a = he.Children.toArray(r), i = a.find(Im);
    if (i) {
      let c = i.props.children, l = a.map((s) => s === i ? he.Children.count(c) > 1 ? he.Children.only(null) : he.isValidElement(c) ? c.props.
      children : null : s);
      return /* @__PURE__ */ Ka(Ja, { ...n, ref: t, children: he.isValidElement(c) ? he.cloneElement(c, void 0, l) : null });
    }
    return /* @__PURE__ */ Ka(Ja, { ...n, ref: t, children: r });
  });
  Qa.displayName = "Slot";
  Ja = he.forwardRef((e, t) => {
    let { children: r, ...n } = e;
    if (he.isValidElement(r)) {
      let a = Tm(r);
      return he.cloneElement(r, {
        ...zm(n, r.props),
        // @ts-ignore
        ref: t ? Za(t, a) : a
      });
    }
    return he.Children.count(r) > 1 ? he.Children.only(null) : null;
  });
  Ja.displayName = "SlotClone";
  Lm = /* @__PURE__ */ o(({ children: e }) => /* @__PURE__ */ Ka(Am, { children: e }), "Slottable");
  o(Im, "isSlottable");
  o(zm, "mergeProps");
  o(Tm, "getElementRef");
});

// ../node_modules/@radix-ui/react-scroll-area/node_modules/@radix-ui/react-primitive/dist/index.mjs
import * as r5 from "react";
import * as Hm from "react-dom";
import { jsx as Pm } from "react/jsx-runtime";
var km, gr, n5 = C(() => {
  t5();
  km = [
    "a",
    "button",
    "div",
    "form",
    "h2",
    "h3",
    "img",
    "input",
    "label",
    "li",
    "nav",
    "ol",
    "p",
    "span",
    "svg",
    "ul"
  ], gr = km.reduce((e, t) => {
    let r = r5.forwardRef((n, a) => {
      let { asChild: i, ...c } = n, l = i ? Qa : t;
      return typeof window < "u" && (window[Symbol.for("radix-ui")] = !0), /* @__PURE__ */ Pm(l, { ...c, ref: a });
    });
    return r.displayName = `Primitive.${t}`, { ...e, [t]: r };
  }, {});
});

// ../node_modules/@radix-ui/react-scroll-area/node_modules/@radix-ui/react-use-layout-effect/dist/index.mjs
import * as o5 from "react";
var an, ei = C(() => {
  an = globalThis?.document ? o5.useLayoutEffect : () => {
  };
});

// ../node_modules/@radix-ui/react-scroll-area/node_modules/@radix-ui/react-presence/dist/index.mjs
import * as Le from "react";
import * as a5 from "react-dom";
import * as i5 from "react";
function Om(e, t) {
  return i5.useReducer((r, n) => t[r][n] ?? r, e);
}
function Bm(e) {
  let [t, r] = Le.useState(), n = Le.useRef({}), a = Le.useRef(e), i = Le.useRef("none"), c = e ? "mounted" : "unmounted", [l, s] = Om(c, {
    mounted: {
      UNMOUNT: "unmounted",
      ANIMATION_OUT: "unmountSuspended"
    },
    unmountSuspended: {
      MOUNT: "mounted",
      ANIMATION_END: "unmounted"
    },
    unmounted: {
      MOUNT: "mounted"
    }
  });
  return Le.useEffect(() => {
    let u = Xn(n.current);
    i.current = l === "mounted" ? u : "none";
  }, [l]), an(() => {
    let u = n.current, f = a.current;
    if (f !== e) {
      let m = i.current, v = Xn(u);
      e ? s("MOUNT") : v === "none" || u?.display === "none" ? s("UNMOUNT") : s(f && m !== v ? "ANIMATION_OUT" : "UNMOUNT"), a.current = e;
    }
  }, [e, s]), an(() => {
    if (t) {
      let u = /* @__PURE__ */ o((d) => {
        let v = Xn(n.current).includes(d.animationName);
        d.target === t && v && a5.flushSync(() => s("ANIMATION_END"));
      }, "handleAnimationEnd"), f = /* @__PURE__ */ o((d) => {
        d.target === t && (i.current = Xn(n.current));
      }, "handleAnimationStart");
      return t.addEventListener("animationstart", f), t.addEventListener("animationcancel", u), t.addEventListener("animationend", u), () => {
        t.removeEventListener("animationstart", f), t.removeEventListener("animationcancel", u), t.removeEventListener("animationend", u);
      };
    } else
      s("ANIMATION_END");
  }, [t, s]), {
    isPresent: ["mounted", "unmountSuspended"].includes(l),
    ref: Le.useCallback((u) => {
      u && (n.current = getComputedStyle(u)), r(u);
    }, [])
  };
}
function Xn(e) {
  return e?.animationName || "none";
}
function Nm(e) {
  let t = Object.getOwnPropertyDescriptor(e.props, "ref")?.get, r = t && "isReactWarning" in t && t.isReactWarning;
  return r ? e.ref : (t = Object.getOwnPropertyDescriptor(e, "ref")?.get, r = t && "isReactWarning" in t && t.isReactWarning, r ? e.props.ref :
  e.props.ref || e.ref);
}
var vr, l5 = C(() => {
  "use client";
  Yn();
  ei();
  o(Om, "useStateMachine");
  vr = /* @__PURE__ */ o((e) => {
    let { present: t, children: r } = e, n = Bm(t), a = typeof r == "function" ? r({ present: n.isPresent }) : Le.Children.only(r), i = it(n.
    ref, Nm(a));
    return typeof r == "function" || n.isPresent ? Le.cloneElement(a, { ref: i }) : null;
  }, "Presence");
  vr.displayName = "Presence";
  o(Bm, "usePresence");
  o(Xn, "getAnimationName");
  o(Nm, "getElementRef");
});

// ../node_modules/@radix-ui/react-scroll-area/node_modules/@radix-ui/react-context/dist/index.mjs
import * as lt from "react";
import { jsx as Fm } from "react/jsx-runtime";
function c5(e, t = []) {
  let r = [];
  function n(i, c) {
    let l = lt.createContext(c), s = r.length;
    r = [...r, c];
    function u(d) {
      let { scope: m, children: v, ...y } = d, p = m?.[e][s] || l, h = lt.useMemo(() => y, Object.values(y));
      return /* @__PURE__ */ Fm(p.Provider, { value: h, children: v });
    }
    o(u, "Provider");
    function f(d, m) {
      let v = m?.[e][s] || l, y = lt.useContext(v);
      if (y) return y;
      if (c !== void 0) return c;
      throw new Error(`\`${d}\` must be used within \`${i}\``);
    }
    return o(f, "useContext2"), u.displayName = i + "Provider", [u, f];
  }
  o(n, "createContext3");
  let a = /* @__PURE__ */ o(() => {
    let i = r.map((c) => lt.createContext(c));
    return /* @__PURE__ */ o(function(l) {
      let s = l?.[e] || i;
      return lt.useMemo(
        () => ({ [`__scope${e}`]: { ...l, [e]: s } }),
        [l, s]
      );
    }, "useScope");
  }, "createScope");
  return a.scopeName = e, [n, Dm(a, ...t)];
}
function Dm(...e) {
  let t = e[0];
  if (e.length === 1) return t;
  let r = /* @__PURE__ */ o(() => {
    let n = e.map((a) => ({
      useScope: a(),
      scopeName: a.scopeName
    }));
    return /* @__PURE__ */ o(function(i) {
      let c = n.reduce((l, { useScope: s, scopeName: u }) => {
        let d = s(i)[`__scope${u}`];
        return { ...l, ...d };
      }, {});
      return lt.useMemo(() => ({ [`__scope${t.scopeName}`]: c }), [c]);
    }, "useComposedScopes");
  }, "createScope");
  return r.scopeName = t.scopeName, r;
}
var s5 = C(() => {
  o(c5, "createContextScope");
  o(Dm, "composeContextScopes");
});

// ../node_modules/@radix-ui/react-scroll-area/node_modules/@radix-ui/react-use-callback-ref/dist/index.mjs
import * as wr from "react";
function xt(e) {
  let t = wr.useRef(e);
  return wr.useEffect(() => {
    t.current = e;
  }), wr.useMemo(() => (...r) => t.current?.(...r), []);
}
var u5 = C(() => {
  o(xt, "useCallbackRef");
});

// ../node_modules/@radix-ui/react-scroll-area/node_modules/@radix-ui/react-direction/dist/index.mjs
import * as Zn from "react";
import { jsx as Ky } from "react/jsx-runtime";
function f5(e) {
  let t = Zn.useContext(_m);
  return e || t || "ltr";
}
var _m, d5 = C(() => {
  _m = Zn.createContext(void 0);
  o(f5, "useDirection");
});

// ../node_modules/@radix-ui/number/dist/index.mjs
function p5(e, [t, r]) {
  return Math.min(r, Math.max(t, e));
}
var m5 = C(() => {
  o(p5, "clamp");
});

// ../node_modules/@radix-ui/react-scroll-area/node_modules/@radix-ui/primitive/dist/index.mjs
function Et(e, t, { checkForDefaultPrevented: r = !0 } = {}) {
  return /* @__PURE__ */ o(function(a) {
    if (e?.(a), r === !1 || !a.defaultPrevented)
      return t?.(a);
  }, "handleEvent");
}
var h5 = C(() => {
  o(Et, "composeEventHandlers");
});

// ../node_modules/@radix-ui/react-scroll-area/dist/index.mjs
import * as I from "react";
import * as v5 from "react";
import { Fragment as Vm, jsx as U, jsxs as jm } from "react/jsx-runtime";
function $m(e, t) {
  return v5.useReducer((r, n) => t[r][n] ?? r, e);
}
function Jn(e) {
  return e ? parseInt(e, 10) : 0;
}
function L5(e, t) {
  let r = e / t;
  return isNaN(r) ? 0 : r;
}
function Qn(e) {
  let t = L5(e.viewport, e.content), r = e.scrollbar.paddingStart + e.scrollbar.paddingEnd, n = (e.scrollbar.size - r) * t;
  return Math.max(n, 18);
}
function Jm(e, t, r, n = "ltr") {
  let a = Qn(r), i = a / 2, c = t || i, l = a - c, s = r.scrollbar.paddingStart + c, u = r.scrollbar.size - r.scrollbar.paddingEnd - l, f = r.
  content - r.viewport, d = n === "ltr" ? [0, f] : [f * -1, 0];
  return I5([s, u], d)(e);
}
function g5(e, t, r = "ltr") {
  let n = Qn(t), a = t.scrollbar.paddingStart + t.scrollbar.paddingEnd, i = t.scrollbar.size - a, c = t.content - t.viewport, l = i - n, s = r ===
  "ltr" ? [0, c] : [c * -1, 0], u = p5(e, s);
  return I5([0, c], [0, l])(u);
}
function I5(e, t) {
  return (r) => {
    if (e[0] === e[1] || t[0] === t[1]) return t[0];
    let n = (t[1] - t[0]) / (e[1] - e[0]);
    return t[0] + n * (r - e[0]);
  };
}
function z5(e, t) {
  return e > 0 && e < t;
}
function eo(e, t) {
  let r = xt(e), n = I.useRef(0);
  return I.useEffect(() => () => window.clearTimeout(n.current), []), I.useCallback(() => {
    window.clearTimeout(n.current), n.current = window.setTimeout(r, t);
  }, [r, t]);
}
function br(e, t) {
  let r = xt(t);
  an(() => {
    let n = 0;
    if (e) {
      let a = new ResizeObserver(() => {
        cancelAnimationFrame(n), n = window.requestAnimationFrame(r);
      });
      return a.observe(e), () => {
        window.cancelAnimationFrame(n), a.unobserve(e);
      };
    }
  }, [e, r]);
}
function eh(e, t) {
  let { asChild: r, children: n } = e;
  if (!r) return typeof t == "function" ? t(n) : t;
  let a = I.Children.only(n);
  return I.cloneElement(a, {
    children: typeof t == "function" ? t(a.props.children) : t
  });
}
var ti, w5, mR, Wm, _e, b5, y5, R5, rt, x5, Um, qm, E5, ri, Gm, Ym, Xm, S5, C5, Kn, M5, Zm, ni, A5, Km, Qm, T5, H5, P5, k5, O5, B5 = C(() => {
  "use client";
  n5();
  l5();
  s5();
  Yn();
  u5();
  d5();
  ei();
  m5();
  h5();
  o($m, "useStateMachine");
  ti = "ScrollArea", [w5, mR] = c5(ti), [Wm, _e] = w5(ti), b5 = I.forwardRef(
    (e, t) => {
      let {
        __scopeScrollArea: r,
        type: n = "hover",
        dir: a,
        scrollHideDelay: i = 600,
        ...c
      } = e, [l, s] = I.useState(null), [u, f] = I.useState(null), [d, m] = I.useState(null), [v, y] = I.useState(null), [p, h] = I.useState(
      null), [g, w] = I.useState(0), [b, x] = I.useState(0), [E, R] = I.useState(!1), [S, A] = I.useState(!1), M = it(t, (P) => s(P)), L = f5(
      a);
      return /* @__PURE__ */ U(
        Wm,
        {
          scope: r,
          type: n,
          dir: L,
          scrollHideDelay: i,
          scrollArea: l,
          viewport: u,
          onViewportChange: f,
          content: d,
          onContentChange: m,
          scrollbarX: v,
          onScrollbarXChange: y,
          scrollbarXEnabled: E,
          onScrollbarXEnabledChange: R,
          scrollbarY: p,
          onScrollbarYChange: h,
          scrollbarYEnabled: S,
          onScrollbarYEnabledChange: A,
          onCornerWidthChange: w,
          onCornerHeightChange: x,
          children: /* @__PURE__ */ U(
            gr.div,
            {
              dir: L,
              ...c,
              ref: M,
              style: {
                position: "relative",
                // Pass corner sizes as CSS vars to reduce re-renders of context consumers
                "--radix-scroll-area-corner-width": g + "px",
                "--radix-scroll-area-corner-height": b + "px",
                ...e.style
              }
            }
          )
        }
      );
    }
  );
  b5.displayName = ti;
  y5 = "ScrollAreaViewport", R5 = I.forwardRef(
    (e, t) => {
      let { __scopeScrollArea: r, children: n, asChild: a, nonce: i, ...c } = e, l = _e(y5, r), s = I.useRef(null), u = it(t, s, l.onViewportChange);
      return /* @__PURE__ */ jm(Vm, { children: [
        /* @__PURE__ */ U(
          "style",
          {
            dangerouslySetInnerHTML: {
              __html: `
[data-radix-scroll-area-viewport] {
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}
[data-radix-scroll-area-viewport]::-webkit-scrollbar {
  display: none;
}
:where([data-radix-scroll-area-viewport]) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
:where([data-radix-scroll-area-content]) {
  flex-grow: 1;
}
`
            },
            nonce: i
          }
        ),
        /* @__PURE__ */ U(
          gr.div,
          {
            "data-radix-scroll-area-viewport": "",
            ...c,
            asChild: a,
            ref: u,
            style: {
              /**
               * We don't support `visible` because the intention is to have at least one scrollbar
               * if this component is used and `visible` will behave like `auto` in that case
               * https://developer.mozilla.org/en-US/docs/Web/CSS/overflow#description
               *
               * We don't handle `auto` because the intention is for the native implementation
               * to be hidden if using this component. We just want to ensure the node is scrollable
               * so could have used either `scroll` or `auto` here. We picked `scroll` to prevent
               * the browser from having to work out whether to render native scrollbars or not,
               * we tell it to with the intention of hiding them in CSS.
               */
              overflowX: l.scrollbarXEnabled ? "scroll" : "hidden",
              overflowY: l.scrollbarYEnabled ? "scroll" : "hidden",
              ...e.style
            },
            children: eh({ asChild: a, children: n }, (f) => /* @__PURE__ */ U(
              "div",
              {
                "data-radix-scroll-area-content": "",
                ref: l.onContentChange,
                style: { minWidth: l.scrollbarXEnabled ? "fit-content" : void 0 },
                children: f
              }
            ))
          }
        )
      ] });
    }
  );
  R5.displayName = y5;
  rt = "ScrollAreaScrollbar", x5 = I.forwardRef(
    (e, t) => {
      let { forceMount: r, ...n } = e, a = _e(rt, e.__scopeScrollArea), { onScrollbarXEnabledChange: i, onScrollbarYEnabledChange: c } = a, l = e.
      orientation === "horizontal";
      return I.useEffect(() => (l ? i(!0) : c(!0), () => {
        l ? i(!1) : c(!1);
      }), [l, i, c]), a.type === "hover" ? /* @__PURE__ */ U(Um, { ...n, ref: t, forceMount: r }) : a.type === "scroll" ? /* @__PURE__ */ U(
      qm, { ...n, ref: t, forceMount: r }) : a.type === "auto" ? /* @__PURE__ */ U(E5, { ...n, ref: t, forceMount: r }) : a.type === "always" ?
      /* @__PURE__ */ U(ri, { ...n, ref: t }) : null;
    }
  );
  x5.displayName = rt;
  Um = I.forwardRef((e, t) => {
    let { forceMount: r, ...n } = e, a = _e(rt, e.__scopeScrollArea), [i, c] = I.useState(!1);
    return I.useEffect(() => {
      let l = a.scrollArea, s = 0;
      if (l) {
        let u = /* @__PURE__ */ o(() => {
          window.clearTimeout(s), c(!0);
        }, "handlePointerEnter"), f = /* @__PURE__ */ o(() => {
          s = window.setTimeout(() => c(!1), a.scrollHideDelay);
        }, "handlePointerLeave");
        return l.addEventListener("pointerenter", u), l.addEventListener("pointerleave", f), () => {
          window.clearTimeout(s), l.removeEventListener("pointerenter", u), l.removeEventListener("pointerleave", f);
        };
      }
    }, [a.scrollArea, a.scrollHideDelay]), /* @__PURE__ */ U(vr, { present: r || i, children: /* @__PURE__ */ U(
      E5,
      {
        "data-state": i ? "visible" : "hidden",
        ...n,
        ref: t
      }
    ) });
  }), qm = I.forwardRef((e, t) => {
    let { forceMount: r, ...n } = e, a = _e(rt, e.__scopeScrollArea), i = e.orientation === "horizontal", c = eo(() => s("SCROLL_END"), 100),
    [l, s] = $m("hidden", {
      hidden: {
        SCROLL: "scrolling"
      },
      scrolling: {
        SCROLL_END: "idle",
        POINTER_ENTER: "interacting"
      },
      interacting: {
        SCROLL: "interacting",
        POINTER_LEAVE: "idle"
      },
      idle: {
        HIDE: "hidden",
        SCROLL: "scrolling",
        POINTER_ENTER: "interacting"
      }
    });
    return I.useEffect(() => {
      if (l === "idle") {
        let u = window.setTimeout(() => s("HIDE"), a.scrollHideDelay);
        return () => window.clearTimeout(u);
      }
    }, [l, a.scrollHideDelay, s]), I.useEffect(() => {
      let u = a.viewport, f = i ? "scrollLeft" : "scrollTop";
      if (u) {
        let d = u[f], m = /* @__PURE__ */ o(() => {
          let v = u[f];
          d !== v && (s("SCROLL"), c()), d = v;
        }, "handleScroll");
        return u.addEventListener("scroll", m), () => u.removeEventListener("scroll", m);
      }
    }, [a.viewport, i, s, c]), /* @__PURE__ */ U(vr, { present: r || l !== "hidden", children: /* @__PURE__ */ U(
      ri,
      {
        "data-state": l === "hidden" ? "hidden" : "visible",
        ...n,
        ref: t,
        onPointerEnter: Et(e.onPointerEnter, () => s("POINTER_ENTER")),
        onPointerLeave: Et(e.onPointerLeave, () => s("POINTER_LEAVE"))
      }
    ) });
  }), E5 = I.forwardRef((e, t) => {
    let r = _e(rt, e.__scopeScrollArea), { forceMount: n, ...a } = e, [i, c] = I.useState(!1), l = e.orientation === "horizontal", s = eo(() => {
      if (r.viewport) {
        let u = r.viewport.offsetWidth < r.viewport.scrollWidth, f = r.viewport.offsetHeight < r.viewport.scrollHeight;
        c(l ? u : f);
      }
    }, 10);
    return br(r.viewport, s), br(r.content, s), /* @__PURE__ */ U(vr, { present: n || i, children: /* @__PURE__ */ U(
      ri,
      {
        "data-state": i ? "visible" : "hidden",
        ...a,
        ref: t
      }
    ) });
  }), ri = I.forwardRef((e, t) => {
    let { orientation: r = "vertical", ...n } = e, a = _e(rt, e.__scopeScrollArea), i = I.useRef(null), c = I.useRef(0), [l, s] = I.useState(
    {
      content: 0,
      viewport: 0,
      scrollbar: { size: 0, paddingStart: 0, paddingEnd: 0 }
    }), u = L5(l.viewport, l.content), f = {
      ...n,
      sizes: l,
      onSizesChange: s,
      hasThumb: u > 0 && u < 1,
      onThumbChange: /* @__PURE__ */ o((m) => i.current = m, "onThumbChange"),
      onThumbPointerUp: /* @__PURE__ */ o(() => c.current = 0, "onThumbPointerUp"),
      onThumbPointerDown: /* @__PURE__ */ o((m) => c.current = m, "onThumbPointerDown")
    };
    function d(m, v) {
      return Jm(m, c.current, l, v);
    }
    return o(d, "getScrollPosition"), r === "horizontal" ? /* @__PURE__ */ U(
      Gm,
      {
        ...f,
        ref: t,
        onThumbPositionChange: /* @__PURE__ */ o(() => {
          if (a.viewport && i.current) {
            let m = a.viewport.scrollLeft, v = g5(m, l, a.dir);
            i.current.style.transform = `translate3d(${v}px, 0, 0)`;
          }
        }, "onThumbPositionChange"),
        onWheelScroll: /* @__PURE__ */ o((m) => {
          a.viewport && (a.viewport.scrollLeft = m);
        }, "onWheelScroll"),
        onDragScroll: /* @__PURE__ */ o((m) => {
          a.viewport && (a.viewport.scrollLeft = d(m, a.dir));
        }, "onDragScroll")
      }
    ) : r === "vertical" ? /* @__PURE__ */ U(
      Ym,
      {
        ...f,
        ref: t,
        onThumbPositionChange: /* @__PURE__ */ o(() => {
          if (a.viewport && i.current) {
            let m = a.viewport.scrollTop, v = g5(m, l);
            i.current.style.transform = `translate3d(0, ${v}px, 0)`;
          }
        }, "onThumbPositionChange"),
        onWheelScroll: /* @__PURE__ */ o((m) => {
          a.viewport && (a.viewport.scrollTop = m);
        }, "onWheelScroll"),
        onDragScroll: /* @__PURE__ */ o((m) => {
          a.viewport && (a.viewport.scrollTop = d(m));
        }, "onDragScroll")
      }
    ) : null;
  }), Gm = I.forwardRef((e, t) => {
    let { sizes: r, onSizesChange: n, ...a } = e, i = _e(rt, e.__scopeScrollArea), [c, l] = I.useState(), s = I.useRef(null), u = it(t, s, i.
    onScrollbarXChange);
    return I.useEffect(() => {
      s.current && l(getComputedStyle(s.current));
    }, [s]), /* @__PURE__ */ U(
      C5,
      {
        "data-orientation": "horizontal",
        ...a,
        ref: u,
        sizes: r,
        style: {
          bottom: 0,
          left: i.dir === "rtl" ? "var(--radix-scroll-area-corner-width)" : 0,
          right: i.dir === "ltr" ? "var(--radix-scroll-area-corner-width)" : 0,
          "--radix-scroll-area-thumb-width": Qn(r) + "px",
          ...e.style
        },
        onThumbPointerDown: /* @__PURE__ */ o((f) => e.onThumbPointerDown(f.x), "onThumbPointerDown"),
        onDragScroll: /* @__PURE__ */ o((f) => e.onDragScroll(f.x), "onDragScroll"),
        onWheelScroll: /* @__PURE__ */ o((f, d) => {
          if (i.viewport) {
            let m = i.viewport.scrollLeft + f.deltaX;
            e.onWheelScroll(m), z5(m, d) && f.preventDefault();
          }
        }, "onWheelScroll"),
        onResize: /* @__PURE__ */ o(() => {
          s.current && i.viewport && c && n({
            content: i.viewport.scrollWidth,
            viewport: i.viewport.offsetWidth,
            scrollbar: {
              size: s.current.clientWidth,
              paddingStart: Jn(c.paddingLeft),
              paddingEnd: Jn(c.paddingRight)
            }
          });
        }, "onResize")
      }
    );
  }), Ym = I.forwardRef((e, t) => {
    let { sizes: r, onSizesChange: n, ...a } = e, i = _e(rt, e.__scopeScrollArea), [c, l] = I.useState(), s = I.useRef(null), u = it(t, s, i.
    onScrollbarYChange);
    return I.useEffect(() => {
      s.current && l(getComputedStyle(s.current));
    }, [s]), /* @__PURE__ */ U(
      C5,
      {
        "data-orientation": "vertical",
        ...a,
        ref: u,
        sizes: r,
        style: {
          top: 0,
          right: i.dir === "ltr" ? 0 : void 0,
          left: i.dir === "rtl" ? 0 : void 0,
          bottom: "var(--radix-scroll-area-corner-height)",
          "--radix-scroll-area-thumb-height": Qn(r) + "px",
          ...e.style
        },
        onThumbPointerDown: /* @__PURE__ */ o((f) => e.onThumbPointerDown(f.y), "onThumbPointerDown"),
        onDragScroll: /* @__PURE__ */ o((f) => e.onDragScroll(f.y), "onDragScroll"),
        onWheelScroll: /* @__PURE__ */ o((f, d) => {
          if (i.viewport) {
            let m = i.viewport.scrollTop + f.deltaY;
            e.onWheelScroll(m), z5(m, d) && f.preventDefault();
          }
        }, "onWheelScroll"),
        onResize: /* @__PURE__ */ o(() => {
          s.current && i.viewport && c && n({
            content: i.viewport.scrollHeight,
            viewport: i.viewport.offsetHeight,
            scrollbar: {
              size: s.current.clientHeight,
              paddingStart: Jn(c.paddingTop),
              paddingEnd: Jn(c.paddingBottom)
            }
          });
        }, "onResize")
      }
    );
  }), [Xm, S5] = w5(rt), C5 = I.forwardRef((e, t) => {
    let {
      __scopeScrollArea: r,
      sizes: n,
      hasThumb: a,
      onThumbChange: i,
      onThumbPointerUp: c,
      onThumbPointerDown: l,
      onThumbPositionChange: s,
      onDragScroll: u,
      onWheelScroll: f,
      onResize: d,
      ...m
    } = e, v = _e(rt, r), [y, p] = I.useState(null), h = it(t, (M) => p(M)), g = I.useRef(null), w = I.useRef(""), b = v.viewport, x = n.content -
    n.viewport, E = xt(f), R = xt(s), S = eo(d, 10);
    function A(M) {
      if (g.current) {
        let L = M.clientX - g.current.left, P = M.clientY - g.current.top;
        u({ x: L, y: P });
      }
    }
    return o(A, "handleDragScroll"), I.useEffect(() => {
      let M = /* @__PURE__ */ o((L) => {
        let P = L.target;
        y?.contains(P) && E(L, x);
      }, "handleWheel");
      return document.addEventListener("wheel", M, { passive: !1 }), () => document.removeEventListener("wheel", M, { passive: !1 });
    }, [b, y, x, E]), I.useEffect(R, [n, R]), br(y, S), br(v.content, S), /* @__PURE__ */ U(
      Xm,
      {
        scope: r,
        scrollbar: y,
        hasThumb: a,
        onThumbChange: xt(i),
        onThumbPointerUp: xt(c),
        onThumbPositionChange: R,
        onThumbPointerDown: xt(l),
        children: /* @__PURE__ */ U(
          gr.div,
          {
            ...m,
            ref: h,
            style: { position: "absolute", ...m.style },
            onPointerDown: Et(e.onPointerDown, (M) => {
              M.button === 0 && (M.target.setPointerCapture(M.pointerId), g.current = y.getBoundingClientRect(), w.current = document.body.style.
              webkitUserSelect, document.body.style.webkitUserSelect = "none", v.viewport && (v.viewport.style.scrollBehavior = "auto"), A(M));
            }),
            onPointerMove: Et(e.onPointerMove, A),
            onPointerUp: Et(e.onPointerUp, (M) => {
              let L = M.target;
              L.hasPointerCapture(M.pointerId) && L.releasePointerCapture(M.pointerId), document.body.style.webkitUserSelect = w.current, v.
              viewport && (v.viewport.style.scrollBehavior = ""), g.current = null;
            })
          }
        )
      }
    );
  }), Kn = "ScrollAreaThumb", M5 = I.forwardRef(
    (e, t) => {
      let { forceMount: r, ...n } = e, a = S5(Kn, e.__scopeScrollArea);
      return /* @__PURE__ */ U(vr, { present: r || a.hasThumb, children: /* @__PURE__ */ U(Zm, { ref: t, ...n }) });
    }
  ), Zm = I.forwardRef(
    (e, t) => {
      let { __scopeScrollArea: r, style: n, ...a } = e, i = _e(Kn, r), c = S5(Kn, r), { onThumbPositionChange: l } = c, s = it(
        t,
        (d) => c.onThumbChange(d)
      ), u = I.useRef(), f = eo(() => {
        u.current && (u.current(), u.current = void 0);
      }, 100);
      return I.useEffect(() => {
        let d = i.viewport;
        if (d) {
          let m = /* @__PURE__ */ o(() => {
            if (f(), !u.current) {
              let v = Qm(d, l);
              u.current = v, l();
            }
          }, "handleScroll");
          return l(), d.addEventListener("scroll", m), () => d.removeEventListener("scroll", m);
        }
      }, [i.viewport, f, l]), /* @__PURE__ */ U(
        gr.div,
        {
          "data-state": c.hasThumb ? "visible" : "hidden",
          ...a,
          ref: s,
          style: {
            width: "var(--radix-scroll-area-thumb-width)",
            height: "var(--radix-scroll-area-thumb-height)",
            ...n
          },
          onPointerDownCapture: Et(e.onPointerDownCapture, (d) => {
            let v = d.target.getBoundingClientRect(), y = d.clientX - v.left, p = d.clientY - v.top;
            c.onThumbPointerDown({ x: y, y: p });
          }),
          onPointerUp: Et(e.onPointerUp, c.onThumbPointerUp)
        }
      );
    }
  );
  M5.displayName = Kn;
  ni = "ScrollAreaCorner", A5 = I.forwardRef(
    (e, t) => {
      let r = _e(ni, e.__scopeScrollArea), n = !!(r.scrollbarX && r.scrollbarY);
      return r.type !== "scroll" && n ? /* @__PURE__ */ U(Km, { ...e, ref: t }) : null;
    }
  );
  A5.displayName = ni;
  Km = I.forwardRef((e, t) => {
    let { __scopeScrollArea: r, ...n } = e, a = _e(ni, r), [i, c] = I.useState(0), [l, s] = I.useState(0), u = !!(i && l);
    return br(a.scrollbarX, () => {
      let f = a.scrollbarX?.offsetHeight || 0;
      a.onCornerHeightChange(f), s(f);
    }), br(a.scrollbarY, () => {
      let f = a.scrollbarY?.offsetWidth || 0;
      a.onCornerWidthChange(f), c(f);
    }), u ? /* @__PURE__ */ U(
      gr.div,
      {
        ...n,
        ref: t,
        style: {
          width: i,
          height: l,
          position: "absolute",
          right: a.dir === "ltr" ? 0 : void 0,
          left: a.dir === "rtl" ? 0 : void 0,
          bottom: 0,
          ...e.style
        }
      }
    ) : null;
  });
  o(Jn, "toInt");
  o(L5, "getThumbRatio");
  o(Qn, "getThumbSize");
  o(Jm, "getScrollPositionFromPointer");
  o(g5, "getThumbOffsetFromScroll");
  o(I5, "linearScale");
  o(z5, "isScrollingWithinScrollbarBounds");
  Qm = /* @__PURE__ */ o((e, t = () => {
  }) => {
    let r = { left: e.scrollLeft, top: e.scrollTop }, n = 0;
    return (/* @__PURE__ */ o(function a() {
      let i = { left: e.scrollLeft, top: e.scrollTop }, c = r.left !== i.left, l = r.top !== i.top;
      (c || l) && t(), r = i, n = window.requestAnimationFrame(a);
    }, "loop"))(), () => window.cancelAnimationFrame(n);
  }, "addUnlinkedScrollListener");
  o(eo, "useDebounceCallback");
  o(br, "useResizeObserver");
  o(eh, "getSubtree");
  T5 = b5, H5 = R5, P5 = x5, k5 = M5, O5 = A5;
});

// src/components/components/ScrollArea/ScrollArea.tsx
import Wt, { forwardRef as rh } from "react";
import { styled as to } from "storybook/theming";
var nh, oh, N5, F5, yr, ro = C(() => {
  "use strict";
  B5();
  nh = to(T5)(
    ({ scrollbarsize: e, offset: t }) => ({
      width: "100%",
      height: "100%",
      overflow: "hidden",
      "--scrollbar-size": `${e + t}px`,
      "--radix-scroll-area-thumb-width": `${e}px`
    })
  ), oh = to(H5)({
    width: "100%",
    height: "100%"
  }), N5 = to(P5)(({ offset: e, horizontal: t, vertical: r }) => ({
    display: "flex",
    userSelect: "none",
    // ensures no selection
    touchAction: "none",
    // disable browser handling of all panning and zooming gestures on touch devices
    background: "transparent",
    transition: "all 0.2s ease-out",
    borderRadius: "var(--scrollbar-size)",
    zIndex: 1,
    '&[data-orientation="vertical"]': {
      width: "var(--scrollbar-size)",
      paddingRight: e,
      marginTop: e,
      marginBottom: t === "true" && r === "true" ? 0 : e
    },
    '&[data-orientation="horizontal"]': {
      flexDirection: "column",
      height: "var(--scrollbar-size)",
      paddingBottom: e,
      marginLeft: e,
      marginRight: t === "true" && r === "true" ? 0 : e
    }
  })), F5 = to(k5)(({ theme: e }) => ({
    flex: 1,
    background: e.textMutedColor,
    opacity: 0.5,
    borderRadius: "var(--scrollbar-size)",
    position: "relative",
    transition: "opacity 0.2s ease-out",
    "&:hover": { opacity: 0.8 },
    /* increase target size for touch devices https://www.w3.org/WAI/WCAG21/Understanding/target-size.html */
    "::before": {
      content: '""',
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%,-50%)",
      width: "100%",
      height: "100%"
    }
  })), yr = rh(
    ({ children: e, horizontal: t = !1, vertical: r = !1, offset: n = 2, scrollbarSize: a = 6, className: i }, c) => /* @__PURE__ */ Wt.createElement(
    nh, { scrollbarsize: a, offset: n, className: i }, /* @__PURE__ */ Wt.createElement(oh, { ref: c }, e), t && /* @__PURE__ */ Wt.createElement(
      N5,
      {
        orientation: "horizontal",
        offset: n,
        horizontal: t.toString(),
        vertical: r.toString()
      },
      /* @__PURE__ */ Wt.createElement(F5, null)
    ), r && /* @__PURE__ */ Wt.createElement(
      N5,
      {
        orientation: "vertical",
        offset: n,
        horizontal: t.toString(),
        vertical: r.toString()
      },
      /* @__PURE__ */ Wt.createElement(F5, null)
    ), t && r && /* @__PURE__ */ Wt.createElement(O5, null))
  );
  yr.displayName = "ScrollArea";
});

// src/components/components/syntaxhighlighter/syntaxhighlighter.tsx
var ai = {};
Zr(ai, {
  SyntaxHighlighter: () => sn,
  createCopyToClipboardFunction: () => oi,
  default: () => wh,
  supportedLanguages: () => $5
});
import cn, { useCallback as ah, useEffect as ih, useState as D5 } from "react";
import { logger as lh } from "storybook/internal/client-logger";
import { global as ch } from "@storybook/global";
import { styled as oo } from "storybook/theming";
function oi() {
  return no.navigator?.clipboard ? async (e) => {
    try {
      await no.top?.navigator.clipboard.writeText(e);
    } catch {
      await no.navigator.clipboard.writeText(e);
    }
  } : async (e) => {
    let t = ln.createElement("TEXTAREA"), r = ln.activeElement;
    t.value = e, ln.body.appendChild(t), t.select(), ln.execCommand("copy"), ln.body.removeChild(t), r.focus();
  };
}
var _5, ln, no, $5, sh, uh, fh, dh, ph, mh, hh, V5, gh, vh, sn, wh, un = C(() => {
  "use strict";
  _5 = me(Qr(), 1);
  t1();
  i1();
  s1();
  m1();
  b1();
  S1();
  L1();
  P1();
  B1();
  V1();
  U1();
  Z1();
  e1();
  Xa();
  ro();
  ({ document: ln, window: no } = ch), $5 = {
    jsextra: w1,
    jsx: A1,
    json: E1,
    yml: X1,
    md: H1,
    bash: a1,
    css: c1,
    html: O1,
    tsx: $1,
    typescript: W1,
    graphql: p1
  };
  Object.entries($5).forEach(([e, t]) => {
    Gn.registerLanguage(e, t);
  });
  sh = (0, _5.default)(2)(
    (e) => Object.entries(e.code || {}).reduce((t, [r, n]) => ({ ...t, [`* .${r}`]: n }), {})
  ), uh = oi();
  o(oi, "createCopyToClipboardFunction");
  fh = oo.div(
    ({ theme: e }) => ({
      position: "relative",
      overflow: "hidden",
      color: e.color.defaultText
    }),
    ({ theme: e, bordered: t }) => t ? {
      border: `1px solid ${e.appBorderColor}`,
      borderRadius: e.borderRadius,
      background: e.background.content
    } : {},
    ({ showLineNumbers: e }) => e ? {
      // use the before pseudo element to display line numbers
      ".react-syntax-highlighter-line-number::before": {
        content: "attr(data-line-number)"
      }
    } : {}
  ), dh = /* @__PURE__ */ o(({ children: e, className: t }) => /* @__PURE__ */ cn.createElement(yr, { horizontal: !0, vertical: !0, className: t },
  e), "UnstyledScroller"), ph = oo(dh)(
    {
      position: "relative"
    },
    ({ theme: e }) => sh(e)
  ), mh = oo.pre(({ theme: e, padded: t }) => ({
    display: "flex",
    justifyContent: "flex-start",
    margin: 0,
    padding: t ? e.layoutMargin : 0
  })), hh = oo.div(({ theme: e }) => ({
    flex: 1,
    paddingLeft: 2,
    // TODO: To match theming/global.ts for now
    paddingRight: e.layoutMargin,
    opacity: 1,
    fontFamily: e.typography.fonts.mono
  })), V5 = /* @__PURE__ */ o((e) => {
    let t = [...e.children], r = t[0], n = r.children[0].value, a = {
      ...r,
      // empty the line-number element
      children: [],
      properties: {
        ...r.properties,
        // add a data-line-number attribute to line-number element, so we can access the line number with `content: attr(data-line-number)`
        "data-line-number": n,
        // remove the 'userSelect: none' style, which will produce extra empty lines when copy-pasting in firefox
        style: { ...r.properties.style, userSelect: "auto" }
      }
    };
    return t[0] = a, { ...e, children: t };
  }, "processLineNumber"), gh = /* @__PURE__ */ o(({ rows: e, stylesheet: t, useInlineStyles: r }) => e.map((n, a) => _t({
    node: V5(n),
    stylesheet: t,
    useInlineStyles: r,
    key: `code-segement${a}`
  })), "defaultRenderer"), vh = /* @__PURE__ */ o((e, t) => t ? e ? ({ rows: r, ...n }) => e({ rows: r.map((a) => V5(a)), ...n }) : gh : e, "\
wrapRenderer"), sn = /* @__PURE__ */ o(({
    children: e,
    language: t = "jsx",
    copyable: r = !1,
    bordered: n = !1,
    padded: a = !1,
    format: i = !0,
    formatter: c = void 0,
    className: l = void 0,
    showLineNumbers: s = !1,
    ...u
  }) => {
    if (typeof e != "string" || !e.trim())
      return null;
    let [f, d] = D5("");
    ih(() => {
      c ? c(i, e).then(d) : d(e.trim());
    }, [e, i, c]);
    let [m, v] = D5(!1), y = ah(
      (h) => {
        h.preventDefault(), uh(f).then(() => {
          v(!0), no.setTimeout(() => v(!1), 1500);
        }).catch(lh.error);
      },
      [f]
    ), p = vh(u.renderer, s);
    return /* @__PURE__ */ cn.createElement(
      fh,
      {
        bordered: n,
        padded: a,
        showLineNumbers: s,
        className: l
      },
      /* @__PURE__ */ cn.createElement(ph, null, /* @__PURE__ */ cn.createElement(
        Gn,
        {
          padded: a || n,
          language: t,
          showLineNumbers: s,
          showInlineLineNumbers: s,
          useInlineStyles: !1,
          PreTag: mh,
          CodeTag: hh,
          lineNumberContainerStyle: {},
          ...u,
          renderer: p
        },
        f
      )),
      r ? /* @__PURE__ */ cn.createElement(Ya, { actionItems: [{ title: m ? "Copied" : "Copy", onClick: y }] }) : null
    );
  }, "SyntaxHighlighter");
  sn.registerLanguage = (...e) => Gn.registerLanguage(...e);
  wh = sn;
});

// ../node_modules/ts-dedent/esm/index.js
function Z5(e) {
  for (var t = [], r = 1; r < arguments.length; r++)
    t[r - 1] = arguments[r];
  var n = Array.from(typeof e == "string" ? [e] : e);
  n[n.length - 1] = n[n.length - 1].replace(/\r?\n([\t ]*)$/, "");
  var a = n.reduce(function(l, s) {
    var u = s.match(/\n([\t ]+|(?!\s).)/g);
    return u ? l.concat(u.map(function(f) {
      var d, m;
      return (m = (d = f.match(/[\t ]/g)) === null || d === void 0 ? void 0 : d.length) !== null && m !== void 0 ? m : 0;
    })) : l;
  }, []);
  if (a.length) {
    var i = new RegExp(`
[	 ]{` + Math.min.apply(Math, a) + "}", "g");
    n = n.map(function(l) {
      return l.replace(i, `
`);
    });
  }
  n[0] = n[0].replace(/^\r?\n/, "");
  var c = n[0];
  return t.forEach(function(l, s) {
    var u = c.match(/(?:^|\n)( *)$/), f = u ? u[1] : "", d = l;
    typeof l == "string" && l.includes(`
`) && (d = String(l).split(`
`).map(function(m, v) {
      return v === 0 ? m : "" + f + m;
    }).join(`
`)), c += d + n[s + 1];
  }), c;
}
var K5 = C(() => {
  o(Z5, "dedent");
});

// src/components/components/syntaxhighlighter/formatter.ts
var Q5 = {};
Zr(Q5, {
  formatter: () => tg
});
var J5, tg, eu = C(() => {
  "use strict";
  J5 = me(Qr(), 1);
  K5();
  tg = (0, J5.default)(2)(async (e, t) => e === !1 ? t : Z5(t));
});

// ../node_modules/react-popper/lib/esm/utils.js
import * as Lo from "react";
var L0, I0, Nf = C(() => {
  L0 = /* @__PURE__ */ o(function(t) {
    return t.reduce(function(r, n) {
      var a = n[0], i = n[1];
      return r[a] = i, r;
    }, {});
  }, "fromEntries"), I0 = typeof window < "u" && window.document && window.document.createElement ? Lo.useLayoutEffect : Lo.useEffect;
});

// ../node_modules/@popperjs/core/lib/enums.js
var te, le, ae, ne, Io, At, ut, Kt, Ff, zo, kr, Df, z0, To, K3, J3, Q3, e7, t7, r7, n7, o7, a7, _f, ke = C(() => {
  te = "top", le = "bottom", ae = "right", ne = "left", Io = "auto", At = [te, le, ae, ne], ut = "start", Kt = "end", Ff = "clippingParents",
  zo = "viewport", kr = "popper", Df = "reference", z0 = /* @__PURE__ */ At.reduce(function(e, t) {
    return e.concat([t + "-" + ut, t + "-" + Kt]);
  }, []), To = /* @__PURE__ */ [].concat(At, [Io]).reduce(function(e, t) {
    return e.concat([t, t + "-" + ut, t + "-" + Kt]);
  }, []), K3 = "beforeRead", J3 = "read", Q3 = "afterRead", e7 = "beforeMain", t7 = "main", r7 = "afterMain", n7 = "beforeWrite", o7 = "writ\
e", a7 = "afterWrite", _f = [K3, J3, Q3, e7, t7, r7, n7, o7, a7];
});

// ../node_modules/@popperjs/core/lib/dom-utils/getNodeName.js
function fe(e) {
  return e ? (e.nodeName || "").toLowerCase() : null;
}
var Lt = C(() => {
  o(fe, "getNodeName");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getWindow.js
function Z(e) {
  if (e == null)
    return window;
  if (e.toString() !== "[object Window]") {
    var t = e.ownerDocument;
    return t && t.defaultView || window;
  }
  return e;
}
var Je = C(() => {
  o(Z, "getWindow");
});

// ../node_modules/@popperjs/core/lib/dom-utils/instanceOf.js
function We(e) {
  var t = Z(e).Element;
  return e instanceof t || e instanceof Element;
}
function ce(e) {
  var t = Z(e).HTMLElement;
  return e instanceof t || e instanceof HTMLElement;
}
function Or(e) {
  if (typeof ShadowRoot > "u")
    return !1;
  var t = Z(e).ShadowRoot;
  return e instanceof t || e instanceof ShadowRoot;
}
var Oe = C(() => {
  Je();
  o(We, "isElement");
  o(ce, "isHTMLElement");
  o(Or, "isShadowRoot");
});

// ../node_modules/@popperjs/core/lib/modifiers/applyStyles.js
function i7(e) {
  var t = e.state;
  Object.keys(t.elements).forEach(function(r) {
    var n = t.styles[r] || {}, a = t.attributes[r] || {}, i = t.elements[r];
    !ce(i) || !fe(i) || (Object.assign(i.style, n), Object.keys(a).forEach(function(c) {
      var l = a[c];
      l === !1 ? i.removeAttribute(c) : i.setAttribute(c, l === !0 ? "" : l);
    }));
  });
}
function l7(e) {
  var t = e.state, r = {
    popper: {
      position: t.options.strategy,
      left: "0",
      top: "0",
      margin: "0"
    },
    arrow: {
      position: "absolute"
    },
    reference: {}
  };
  return Object.assign(t.elements.popper.style, r.popper), t.styles = r, t.elements.arrow && Object.assign(t.elements.arrow.style, r.arrow),
  function() {
    Object.keys(t.elements).forEach(function(n) {
      var a = t.elements[n], i = t.attributes[n] || {}, c = Object.keys(t.styles.hasOwnProperty(n) ? t.styles[n] : r[n]), l = c.reduce(function(s, u) {
        return s[u] = "", s;
      }, {});
      !ce(a) || !fe(a) || (Object.assign(a.style, l), Object.keys(i).forEach(function(s) {
        a.removeAttribute(s);
      }));
    });
  };
}
var $f, Vf = C(() => {
  Lt();
  Oe();
  o(i7, "applyStyles");
  o(l7, "effect");
  $f = {
    name: "applyStyles",
    enabled: !0,
    phase: "write",
    fn: i7,
    effect: l7,
    requires: ["computeStyles"]
  };
});

// ../node_modules/@popperjs/core/lib/utils/getBasePlacement.js
function de(e) {
  return e.split("-")[0];
}
var It = C(() => {
  o(de, "getBasePlacement");
});

// ../node_modules/@popperjs/core/lib/utils/math.js
var Qe, Jt, ft, zt = C(() => {
  Qe = Math.max, Jt = Math.min, ft = Math.round;
});

// ../node_modules/@popperjs/core/lib/utils/userAgent.js
function Br() {
  var e = navigator.userAgentData;
  return e != null && e.brands && Array.isArray(e.brands) ? e.brands.map(function(t) {
    return t.brand + "/" + t.version;
  }).join(" ") : navigator.userAgent;
}
var T0 = C(() => {
  o(Br, "getUAString");
});

// ../node_modules/@popperjs/core/lib/dom-utils/isLayoutViewport.js
function wn() {
  return !/^((?!chrome|android).)*safari/i.test(Br());
}
var H0 = C(() => {
  T0();
  o(wn, "isLayoutViewport");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getBoundingClientRect.js
function Ue(e, t, r) {
  t === void 0 && (t = !1), r === void 0 && (r = !1);
  var n = e.getBoundingClientRect(), a = 1, i = 1;
  t && ce(e) && (a = e.offsetWidth > 0 && ft(n.width) / e.offsetWidth || 1, i = e.offsetHeight > 0 && ft(n.height) / e.offsetHeight || 1);
  var c = We(e) ? Z(e) : window, l = c.visualViewport, s = !wn() && r, u = (n.left + (s && l ? l.offsetLeft : 0)) / a, f = (n.top + (s && l ?
  l.offsetTop : 0)) / i, d = n.width / a, m = n.height / i;
  return {
    width: d,
    height: m,
    top: f,
    right: u + d,
    bottom: f + m,
    left: u,
    x: u,
    y: f
  };
}
var Nr = C(() => {
  Oe();
  zt();
  Je();
  H0();
  o(Ue, "getBoundingClientRect");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getLayoutRect.js
function Qt(e) {
  var t = Ue(e), r = e.offsetWidth, n = e.offsetHeight;
  return Math.abs(t.width - r) <= 1 && (r = t.width), Math.abs(t.height - n) <= 1 && (n = t.height), {
    x: e.offsetLeft,
    y: e.offsetTop,
    width: r,
    height: n
  };
}
var Ho = C(() => {
  Nr();
  o(Qt, "getLayoutRect");
});

// ../node_modules/@popperjs/core/lib/dom-utils/contains.js
function bn(e, t) {
  var r = t.getRootNode && t.getRootNode();
  if (e.contains(t))
    return !0;
  if (r && Or(r)) {
    var n = t;
    do {
      if (n && e.isSameNode(n))
        return !0;
      n = n.parentNode || n.host;
    } while (n);
  }
  return !1;
}
var P0 = C(() => {
  Oe();
  o(bn, "contains");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getComputedStyle.js
function xe(e) {
  return Z(e).getComputedStyle(e);
}
var Fr = C(() => {
  Je();
  o(xe, "getComputedStyle");
});

// ../node_modules/@popperjs/core/lib/dom-utils/isTableElement.js
function k0(e) {
  return ["table", "td", "th"].indexOf(fe(e)) >= 0;
}
var jf = C(() => {
  Lt();
  o(k0, "isTableElement");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getDocumentElement.js
function ge(e) {
  return ((We(e) ? e.ownerDocument : (
    // $FlowFixMe[prop-missing]
    e.document
  )) || window.document).documentElement;
}
var dt = C(() => {
  Oe();
  o(ge, "getDocumentElement");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getParentNode.js
function pt(e) {
  return fe(e) === "html" ? e : (
    // this is a quicker (but less type safe) way to save quite some bytes from the bundle
    // $FlowFixMe[incompatible-return]
    // $FlowFixMe[prop-missing]
    e.assignedSlot || // step into the shadow DOM of the parent of a slotted node
    e.parentNode || // DOM Element detected
    (Or(e) ? e.host : null) || // ShadowRoot detected
    // $FlowFixMe[incompatible-call]: HTMLElement is a Node
    ge(e)
  );
}
var yn = C(() => {
  Lt();
  dt();
  Oe();
  o(pt, "getParentNode");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getOffsetParent.js
function Wf(e) {
  return !ce(e) || // https://github.com/popperjs/popper-core/issues/837
  xe(e).position === "fixed" ? null : e.offsetParent;
}
function c7(e) {
  var t = /firefox/i.test(Br()), r = /Trident/i.test(Br());
  if (r && ce(e)) {
    var n = xe(e);
    if (n.position === "fixed")
      return null;
  }
  var a = pt(e);
  for (Or(a) && (a = a.host); ce(a) && ["html", "body"].indexOf(fe(a)) < 0; ) {
    var i = xe(a);
    if (i.transform !== "none" || i.perspective !== "none" || i.contain === "paint" || ["transform", "perspective"].indexOf(i.willChange) !==
    -1 || t && i.willChange === "filter" || t && i.filter && i.filter !== "none")
      return a;
    a = a.parentNode;
  }
  return null;
}
function et(e) {
  for (var t = Z(e), r = Wf(e); r && k0(r) && xe(r).position === "static"; )
    r = Wf(r);
  return r && (fe(r) === "html" || fe(r) === "body" && xe(r).position === "static") ? t : r || c7(e) || t;
}
var Dr = C(() => {
  Je();
  Lt();
  Fr();
  Oe();
  jf();
  yn();
  T0();
  o(Wf, "getTrueOffsetParent");
  o(c7, "getContainingBlock");
  o(et, "getOffsetParent");
});

// ../node_modules/@popperjs/core/lib/utils/getMainAxisFromPlacement.js
function er(e) {
  return ["top", "bottom"].indexOf(e) >= 0 ? "x" : "y";
}
var Po = C(() => {
  o(er, "getMainAxisFromPlacement");
});

// ../node_modules/@popperjs/core/lib/utils/within.js
function tr(e, t, r) {
  return Qe(e, Jt(t, r));
}
function Uf(e, t, r) {
  var n = tr(e, t, r);
  return n > r ? r : n;
}
var O0 = C(() => {
  zt();
  o(tr, "within");
  o(Uf, "withinMaxClamp");
});

// ../node_modules/@popperjs/core/lib/utils/getFreshSideObject.js
function Rn() {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
}
var B0 = C(() => {
  o(Rn, "getFreshSideObject");
});

// ../node_modules/@popperjs/core/lib/utils/mergePaddingObject.js
function xn(e) {
  return Object.assign({}, Rn(), e);
}
var N0 = C(() => {
  B0();
  o(xn, "mergePaddingObject");
});

// ../node_modules/@popperjs/core/lib/utils/expandToHashMap.js
function En(e, t) {
  return t.reduce(function(r, n) {
    return r[n] = e, r;
  }, {});
}
var F0 = C(() => {
  o(En, "expandToHashMap");
});

// ../node_modules/@popperjs/core/lib/modifiers/arrow.js
function u7(e) {
  var t, r = e.state, n = e.name, a = e.options, i = r.elements.arrow, c = r.modifiersData.popperOffsets, l = de(r.placement), s = er(l), u = [
  ne, ae].indexOf(l) >= 0, f = u ? "height" : "width";
  if (!(!i || !c)) {
    var d = s7(a.padding, r), m = Qt(i), v = s === "y" ? te : ne, y = s === "y" ? le : ae, p = r.rects.reference[f] + r.rects.reference[s] -
    c[s] - r.rects.popper[f], h = c[s] - r.rects.reference[s], g = et(i), w = g ? s === "y" ? g.clientHeight || 0 : g.clientWidth || 0 : 0, b = p /
    2 - h / 2, x = d[v], E = w - m[f] - d[y], R = w / 2 - m[f] / 2 + b, S = tr(x, R, E), A = s;
    r.modifiersData[n] = (t = {}, t[A] = S, t.centerOffset = S - R, t);
  }
}
function f7(e) {
  var t = e.state, r = e.options, n = r.element, a = n === void 0 ? "[data-popper-arrow]" : n;
  a != null && (typeof a == "string" && (a = t.elements.popper.querySelector(a), !a) || bn(t.elements.popper, a) && (t.elements.arrow = a));
}
var s7, qf, Gf = C(() => {
  It();
  Ho();
  P0();
  Dr();
  Po();
  O0();
  N0();
  F0();
  ke();
  s7 = /* @__PURE__ */ o(function(t, r) {
    return t = typeof t == "function" ? t(Object.assign({}, r.rects, {
      placement: r.placement
    })) : t, xn(typeof t != "number" ? t : En(t, At));
  }, "toPaddingObject");
  o(u7, "arrow");
  o(f7, "effect");
  qf = {
    name: "arrow",
    enabled: !0,
    phase: "main",
    fn: u7,
    effect: f7,
    requires: ["popperOffsets"],
    requiresIfExists: ["preventOverflow"]
  };
});

// ../node_modules/@popperjs/core/lib/utils/getVariation.js
function qe(e) {
  return e.split("-")[1];
}
var _r = C(() => {
  o(qe, "getVariation");
});

// ../node_modules/@popperjs/core/lib/modifiers/computeStyles.js
function p7(e, t) {
  var r = e.x, n = e.y, a = t.devicePixelRatio || 1;
  return {
    x: ft(r * a) / a || 0,
    y: ft(n * a) / a || 0
  };
}
function Yf(e) {
  var t, r = e.popper, n = e.popperRect, a = e.placement, i = e.variation, c = e.offsets, l = e.position, s = e.gpuAcceleration, u = e.adaptive,
  f = e.roundOffsets, d = e.isFixed, m = c.x, v = m === void 0 ? 0 : m, y = c.y, p = y === void 0 ? 0 : y, h = typeof f == "function" ? f({
    x: v,
    y: p
  }) : {
    x: v,
    y: p
  };
  v = h.x, p = h.y;
  var g = c.hasOwnProperty("x"), w = c.hasOwnProperty("y"), b = ne, x = te, E = window;
  if (u) {
    var R = et(r), S = "clientHeight", A = "clientWidth";
    if (R === Z(r) && (R = ge(r), xe(R).position !== "static" && l === "absolute" && (S = "scrollHeight", A = "scrollWidth")), R = R, a === te ||
    (a === ne || a === ae) && i === Kt) {
      x = le;
      var M = d && R === E && E.visualViewport ? E.visualViewport.height : (
        // $FlowFixMe[prop-missing]
        R[S]
      );
      p -= M - n.height, p *= s ? 1 : -1;
    }
    if (a === ne || (a === te || a === le) && i === Kt) {
      b = ae;
      var L = d && R === E && E.visualViewport ? E.visualViewport.width : (
        // $FlowFixMe[prop-missing]
        R[A]
      );
      v -= L - n.width, v *= s ? 1 : -1;
    }
  }
  var P = Object.assign({
    position: l
  }, u && d7), _ = f === !0 ? p7({
    x: v,
    y: p
  }, Z(r)) : {
    x: v,
    y: p
  };
  if (v = _.x, p = _.y, s) {
    var D;
    return Object.assign({}, P, (D = {}, D[x] = w ? "0" : "", D[b] = g ? "0" : "", D.transform = (E.devicePixelRatio || 1) <= 1 ? "translate\
(" + v + "px, " + p + "px)" : "translate3d(" + v + "px, " + p + "px, 0)", D));
  }
  return Object.assign({}, P, (t = {}, t[x] = w ? p + "px" : "", t[b] = g ? v + "px" : "", t.transform = "", t));
}
function m7(e) {
  var t = e.state, r = e.options, n = r.gpuAcceleration, a = n === void 0 ? !0 : n, i = r.adaptive, c = i === void 0 ? !0 : i, l = r.roundOffsets,
  s = l === void 0 ? !0 : l, u = {
    placement: de(t.placement),
    variation: qe(t.placement),
    popper: t.elements.popper,
    popperRect: t.rects.popper,
    gpuAcceleration: a,
    isFixed: t.options.strategy === "fixed"
  };
  t.modifiersData.popperOffsets != null && (t.styles.popper = Object.assign({}, t.styles.popper, Yf(Object.assign({}, u, {
    offsets: t.modifiersData.popperOffsets,
    position: t.options.strategy,
    adaptive: c,
    roundOffsets: s
  })))), t.modifiersData.arrow != null && (t.styles.arrow = Object.assign({}, t.styles.arrow, Yf(Object.assign({}, u, {
    offsets: t.modifiersData.arrow,
    position: "absolute",
    adaptive: !1,
    roundOffsets: s
  })))), t.attributes.popper = Object.assign({}, t.attributes.popper, {
    "data-popper-placement": t.placement
  });
}
var d7, Xf, Zf = C(() => {
  ke();
  Dr();
  Je();
  dt();
  Fr();
  It();
  _r();
  zt();
  d7 = {
    top: "auto",
    right: "auto",
    bottom: "auto",
    left: "auto"
  };
  o(p7, "roundOffsetsByDPR");
  o(Yf, "mapToStyles");
  o(m7, "computeStyles");
  Xf = {
    name: "computeStyles",
    enabled: !0,
    phase: "beforeWrite",
    fn: m7,
    data: {}
  };
});

// ../node_modules/@popperjs/core/lib/modifiers/eventListeners.js
function h7(e) {
  var t = e.state, r = e.instance, n = e.options, a = n.scroll, i = a === void 0 ? !0 : a, c = n.resize, l = c === void 0 ? !0 : c, s = Z(t.
  elements.popper), u = [].concat(t.scrollParents.reference, t.scrollParents.popper);
  return i && u.forEach(function(f) {
    f.addEventListener("scroll", r.update, ko);
  }), l && s.addEventListener("resize", r.update, ko), function() {
    i && u.forEach(function(f) {
      f.removeEventListener("scroll", r.update, ko);
    }), l && s.removeEventListener("resize", r.update, ko);
  };
}
var ko, Kf, Jf = C(() => {
  Je();
  ko = {
    passive: !0
  };
  o(h7, "effect");
  Kf = {
    name: "eventListeners",
    enabled: !0,
    phase: "write",
    fn: /* @__PURE__ */ o(function() {
    }, "fn"),
    effect: h7,
    data: {}
  };
});

// ../node_modules/@popperjs/core/lib/utils/getOppositePlacement.js
function $r(e) {
  return e.replace(/left|right|bottom|top/g, function(t) {
    return g7[t];
  });
}
var g7, Qf = C(() => {
  g7 = {
    left: "right",
    right: "left",
    bottom: "top",
    top: "bottom"
  };
  o($r, "getOppositePlacement");
});

// ../node_modules/@popperjs/core/lib/utils/getOppositeVariationPlacement.js
function Oo(e) {
  return e.replace(/start|end/g, function(t) {
    return v7[t];
  });
}
var v7, ed = C(() => {
  v7 = {
    start: "end",
    end: "start"
  };
  o(Oo, "getOppositeVariationPlacement");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getWindowScroll.js
function rr(e) {
  var t = Z(e), r = t.pageXOffset, n = t.pageYOffset;
  return {
    scrollLeft: r,
    scrollTop: n
  };
}
var Bo = C(() => {
  Je();
  o(rr, "getWindowScroll");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getWindowScrollBarX.js
function nr(e) {
  return Ue(ge(e)).left + rr(e).scrollLeft;
}
var No = C(() => {
  Nr();
  dt();
  Bo();
  o(nr, "getWindowScrollBarX");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getViewportRect.js
function D0(e, t) {
  var r = Z(e), n = ge(e), a = r.visualViewport, i = n.clientWidth, c = n.clientHeight, l = 0, s = 0;
  if (a) {
    i = a.width, c = a.height;
    var u = wn();
    (u || !u && t === "fixed") && (l = a.offsetLeft, s = a.offsetTop);
  }
  return {
    width: i,
    height: c,
    x: l + nr(e),
    y: s
  };
}
var td = C(() => {
  Je();
  dt();
  No();
  H0();
  o(D0, "getViewportRect");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getDocumentRect.js
function _0(e) {
  var t, r = ge(e), n = rr(e), a = (t = e.ownerDocument) == null ? void 0 : t.body, i = Qe(r.scrollWidth, r.clientWidth, a ? a.scrollWidth :
  0, a ? a.clientWidth : 0), c = Qe(r.scrollHeight, r.clientHeight, a ? a.scrollHeight : 0, a ? a.clientHeight : 0), l = -n.scrollLeft + nr(
  e), s = -n.scrollTop;
  return xe(a || r).direction === "rtl" && (l += Qe(r.clientWidth, a ? a.clientWidth : 0) - i), {
    width: i,
    height: c,
    x: l,
    y: s
  };
}
var rd = C(() => {
  dt();
  Fr();
  No();
  Bo();
  zt();
  o(_0, "getDocumentRect");
});

// ../node_modules/@popperjs/core/lib/dom-utils/isScrollParent.js
function or(e) {
  var t = xe(e), r = t.overflow, n = t.overflowX, a = t.overflowY;
  return /auto|scroll|overlay|hidden/.test(r + a + n);
}
var Fo = C(() => {
  Fr();
  o(or, "isScrollParent");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getScrollParent.js
function Do(e) {
  return ["html", "body", "#document"].indexOf(fe(e)) >= 0 ? e.ownerDocument.body : ce(e) && or(e) ? e : Do(pt(e));
}
var nd = C(() => {
  yn();
  Fo();
  Lt();
  Oe();
  o(Do, "getScrollParent");
});

// ../node_modules/@popperjs/core/lib/dom-utils/listScrollParents.js
function Tt(e, t) {
  var r;
  t === void 0 && (t = []);
  var n = Do(e), a = n === ((r = e.ownerDocument) == null ? void 0 : r.body), i = Z(n), c = a ? [i].concat(i.visualViewport || [], or(n) ? n :
  []) : n, l = t.concat(c);
  return a ? l : (
    // $FlowFixMe[incompatible-call]: isBody tells us target will be an HTMLElement here
    l.concat(Tt(pt(c)))
  );
}
var $0 = C(() => {
  nd();
  yn();
  Je();
  Fo();
  o(Tt, "listScrollParents");
});

// ../node_modules/@popperjs/core/lib/utils/rectToClientRect.js
function Vr(e) {
  return Object.assign({}, e, {
    left: e.x,
    top: e.y,
    right: e.x + e.width,
    bottom: e.y + e.height
  });
}
var V0 = C(() => {
  o(Vr, "rectToClientRect");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getClippingRect.js
function w7(e, t) {
  var r = Ue(e, !1, t === "fixed");
  return r.top = r.top + e.clientTop, r.left = r.left + e.clientLeft, r.bottom = r.top + e.clientHeight, r.right = r.left + e.clientWidth, r.
  width = e.clientWidth, r.height = e.clientHeight, r.x = r.left, r.y = r.top, r;
}
function od(e, t, r) {
  return t === zo ? Vr(D0(e, r)) : We(t) ? w7(t, r) : Vr(_0(ge(e)));
}
function b7(e) {
  var t = Tt(pt(e)), r = ["absolute", "fixed"].indexOf(xe(e).position) >= 0, n = r && ce(e) ? et(e) : e;
  return We(n) ? t.filter(function(a) {
    return We(a) && bn(a, n) && fe(a) !== "body";
  }) : [];
}
function j0(e, t, r, n) {
  var a = t === "clippingParents" ? b7(e) : [].concat(t), i = [].concat(a, [r]), c = i[0], l = i.reduce(function(s, u) {
    var f = od(e, u, n);
    return s.top = Qe(f.top, s.top), s.right = Jt(f.right, s.right), s.bottom = Jt(f.bottom, s.bottom), s.left = Qe(f.left, s.left), s;
  }, od(e, c, n));
  return l.width = l.right - l.left, l.height = l.bottom - l.top, l.x = l.left, l.y = l.top, l;
}
var ad = C(() => {
  ke();
  td();
  rd();
  $0();
  Dr();
  dt();
  Fr();
  Oe();
  Nr();
  yn();
  P0();
  Lt();
  V0();
  zt();
  o(w7, "getInnerBoundingClientRect");
  o(od, "getClientRectFromMixedType");
  o(b7, "getClippingParents");
  o(j0, "getClippingRect");
});

// ../node_modules/@popperjs/core/lib/utils/computeOffsets.js
function Sn(e) {
  var t = e.reference, r = e.element, n = e.placement, a = n ? de(n) : null, i = n ? qe(n) : null, c = t.x + t.width / 2 - r.width / 2, l = t.
  y + t.height / 2 - r.height / 2, s;
  switch (a) {
    case te:
      s = {
        x: c,
        y: t.y - r.height
      };
      break;
    case le:
      s = {
        x: c,
        y: t.y + t.height
      };
      break;
    case ae:
      s = {
        x: t.x + t.width,
        y: l
      };
      break;
    case ne:
      s = {
        x: t.x - r.width,
        y: l
      };
      break;
    default:
      s = {
        x: t.x,
        y: t.y
      };
  }
  var u = a ? er(a) : null;
  if (u != null) {
    var f = u === "y" ? "height" : "width";
    switch (i) {
      case ut:
        s[u] = s[u] - (t[f] / 2 - r[f] / 2);
        break;
      case Kt:
        s[u] = s[u] + (t[f] / 2 - r[f] / 2);
        break;
      default:
    }
  }
  return s;
}
var W0 = C(() => {
  It();
  _r();
  Po();
  ke();
  o(Sn, "computeOffsets");
});

// ../node_modules/@popperjs/core/lib/utils/detectOverflow.js
function tt(e, t) {
  t === void 0 && (t = {});
  var r = t, n = r.placement, a = n === void 0 ? e.placement : n, i = r.strategy, c = i === void 0 ? e.strategy : i, l = r.boundary, s = l ===
  void 0 ? Ff : l, u = r.rootBoundary, f = u === void 0 ? zo : u, d = r.elementContext, m = d === void 0 ? kr : d, v = r.altBoundary, y = v ===
  void 0 ? !1 : v, p = r.padding, h = p === void 0 ? 0 : p, g = xn(typeof h != "number" ? h : En(h, At)), w = m === kr ? Df : kr, b = e.rects.
  popper, x = e.elements[y ? w : m], E = j0(We(x) ? x : x.contextElement || ge(e.elements.popper), s, f, c), R = Ue(e.elements.reference), S = Sn(
  {
    reference: R,
    element: b,
    strategy: "absolute",
    placement: a
  }), A = Vr(Object.assign({}, b, S)), M = m === kr ? A : R, L = {
    top: E.top - M.top + g.top,
    bottom: M.bottom - E.bottom + g.bottom,
    left: E.left - M.left + g.left,
    right: M.right - E.right + g.right
  }, P = e.modifiersData.offset;
  if (m === kr && P) {
    var _ = P[a];
    Object.keys(L).forEach(function(D) {
      var K = [ae, le].indexOf(D) >= 0 ? 1 : -1, T = [te, le].indexOf(D) >= 0 ? "y" : "x";
      L[D] += _[T] * K;
    });
  }
  return L;
}
var Cn = C(() => {
  ad();
  dt();
  Nr();
  W0();
  V0();
  ke();
  Oe();
  N0();
  F0();
  o(tt, "detectOverflow");
});

// ../node_modules/@popperjs/core/lib/utils/computeAutoPlacement.js
function U0(e, t) {
  t === void 0 && (t = {});
  var r = t, n = r.placement, a = r.boundary, i = r.rootBoundary, c = r.padding, l = r.flipVariations, s = r.allowedAutoPlacements, u = s ===
  void 0 ? To : s, f = qe(n), d = f ? l ? z0 : z0.filter(function(y) {
    return qe(y) === f;
  }) : At, m = d.filter(function(y) {
    return u.indexOf(y) >= 0;
  });
  m.length === 0 && (m = d);
  var v = m.reduce(function(y, p) {
    return y[p] = tt(e, {
      placement: p,
      boundary: a,
      rootBoundary: i,
      padding: c
    })[de(p)], y;
  }, {});
  return Object.keys(v).sort(function(y, p) {
    return v[y] - v[p];
  });
}
var id = C(() => {
  _r();
  ke();
  Cn();
  It();
  o(U0, "computeAutoPlacement");
});

// ../node_modules/@popperjs/core/lib/modifiers/flip.js
function y7(e) {
  if (de(e) === Io)
    return [];
  var t = $r(e);
  return [Oo(e), t, Oo(t)];
}
function R7(e) {
  var t = e.state, r = e.options, n = e.name;
  if (!t.modifiersData[n]._skip) {
    for (var a = r.mainAxis, i = a === void 0 ? !0 : a, c = r.altAxis, l = c === void 0 ? !0 : c, s = r.fallbackPlacements, u = r.padding, f = r.
    boundary, d = r.rootBoundary, m = r.altBoundary, v = r.flipVariations, y = v === void 0 ? !0 : v, p = r.allowedAutoPlacements, h = t.options.
    placement, g = de(h), w = g === h, b = s || (w || !y ? [$r(h)] : y7(h)), x = [h].concat(b).reduce(function(pe, se) {
      return pe.concat(de(se) === Io ? U0(t, {
        placement: se,
        boundary: f,
        rootBoundary: d,
        padding: u,
        flipVariations: y,
        allowedAutoPlacements: p
      }) : se);
    }, []), E = t.rects.reference, R = t.rects.popper, S = /* @__PURE__ */ new Map(), A = !0, M = x[0], L = 0; L < x.length; L++) {
      var P = x[L], _ = de(P), D = qe(P) === ut, K = [te, le].indexOf(_) >= 0, T = K ? "width" : "height", z = tt(t, {
        placement: P,
        boundary: f,
        rootBoundary: d,
        altBoundary: m,
        padding: u
      }), k = K ? D ? ae : ne : D ? le : te;
      E[T] > R[T] && (k = $r(k));
      var V = $r(k), F = [];
      if (i && F.push(z[_] <= 0), l && F.push(z[k] <= 0, z[V] <= 0), F.every(function(pe) {
        return pe;
      })) {
        M = P, A = !1;
        break;
      }
      S.set(P, F);
    }
    if (A)
      for (var j = y ? 3 : 1, O = /* @__PURE__ */ o(function(se) {
        var ue = x.find(function(ve) {
          var Se = S.get(ve);
          if (Se)
            return Se.slice(0, se).every(function(Ot) {
              return Ot;
            });
        });
        if (ue)
          return M = ue, "break";
      }, "_loop"), G = j; G > 0; G--) {
        var Ee = O(G);
        if (Ee === "break") break;
      }
    t.placement !== M && (t.modifiersData[n]._skip = !0, t.placement = M, t.reset = !0);
  }
}
var ld, cd = C(() => {
  Qf();
  It();
  ed();
  Cn();
  id();
  ke();
  _r();
  o(y7, "getExpandedFallbackPlacements");
  o(R7, "flip");
  ld = {
    name: "flip",
    enabled: !0,
    phase: "main",
    fn: R7,
    requiresIfExists: ["offset"],
    data: {
      _skip: !1
    }
  };
});

// ../node_modules/@popperjs/core/lib/modifiers/hide.js
function sd(e, t, r) {
  return r === void 0 && (r = {
    x: 0,
    y: 0
  }), {
    top: e.top - t.height - r.y,
    right: e.right - t.width + r.x,
    bottom: e.bottom - t.height + r.y,
    left: e.left - t.width - r.x
  };
}
function ud(e) {
  return [te, ae, le, ne].some(function(t) {
    return e[t] >= 0;
  });
}
function x7(e) {
  var t = e.state, r = e.name, n = t.rects.reference, a = t.rects.popper, i = t.modifiersData.preventOverflow, c = tt(t, {
    elementContext: "reference"
  }), l = tt(t, {
    altBoundary: !0
  }), s = sd(c, n), u = sd(l, a, i), f = ud(s), d = ud(u);
  t.modifiersData[r] = {
    referenceClippingOffsets: s,
    popperEscapeOffsets: u,
    isReferenceHidden: f,
    hasPopperEscaped: d
  }, t.attributes.popper = Object.assign({}, t.attributes.popper, {
    "data-popper-reference-hidden": f,
    "data-popper-escaped": d
  });
}
var fd, dd = C(() => {
  ke();
  Cn();
  o(sd, "getSideOffsets");
  o(ud, "isAnySideFullyClipped");
  o(x7, "hide");
  fd = {
    name: "hide",
    enabled: !0,
    phase: "main",
    requiresIfExists: ["preventOverflow"],
    fn: x7
  };
});

// ../node_modules/@popperjs/core/lib/modifiers/offset.js
function E7(e, t, r) {
  var n = de(e), a = [ne, te].indexOf(n) >= 0 ? -1 : 1, i = typeof r == "function" ? r(Object.assign({}, t, {
    placement: e
  })) : r, c = i[0], l = i[1];
  return c = c || 0, l = (l || 0) * a, [ne, ae].indexOf(n) >= 0 ? {
    x: l,
    y: c
  } : {
    x: c,
    y: l
  };
}
function S7(e) {
  var t = e.state, r = e.options, n = e.name, a = r.offset, i = a === void 0 ? [0, 0] : a, c = To.reduce(function(f, d) {
    return f[d] = E7(d, t.rects, i), f;
  }, {}), l = c[t.placement], s = l.x, u = l.y;
  t.modifiersData.popperOffsets != null && (t.modifiersData.popperOffsets.x += s, t.modifiersData.popperOffsets.y += u), t.modifiersData[n] =
  c;
}
var pd, md = C(() => {
  It();
  ke();
  o(E7, "distanceAndSkiddingToXY");
  o(S7, "offset");
  pd = {
    name: "offset",
    enabled: !0,
    phase: "main",
    requires: ["popperOffsets"],
    fn: S7
  };
});

// ../node_modules/@popperjs/core/lib/modifiers/popperOffsets.js
function C7(e) {
  var t = e.state, r = e.name;
  t.modifiersData[r] = Sn({
    reference: t.rects.reference,
    element: t.rects.popper,
    strategy: "absolute",
    placement: t.placement
  });
}
var hd, gd = C(() => {
  W0();
  o(C7, "popperOffsets");
  hd = {
    name: "popperOffsets",
    enabled: !0,
    phase: "read",
    fn: C7,
    data: {}
  };
});

// ../node_modules/@popperjs/core/lib/utils/getAltAxis.js
function q0(e) {
  return e === "x" ? "y" : "x";
}
var vd = C(() => {
  o(q0, "getAltAxis");
});

// ../node_modules/@popperjs/core/lib/modifiers/preventOverflow.js
function M7(e) {
  var t = e.state, r = e.options, n = e.name, a = r.mainAxis, i = a === void 0 ? !0 : a, c = r.altAxis, l = c === void 0 ? !1 : c, s = r.boundary,
  u = r.rootBoundary, f = r.altBoundary, d = r.padding, m = r.tether, v = m === void 0 ? !0 : m, y = r.tetherOffset, p = y === void 0 ? 0 : y,
  h = tt(t, {
    boundary: s,
    rootBoundary: u,
    padding: d,
    altBoundary: f
  }), g = de(t.placement), w = qe(t.placement), b = !w, x = er(g), E = q0(x), R = t.modifiersData.popperOffsets, S = t.rects.reference, A = t.
  rects.popper, M = typeof p == "function" ? p(Object.assign({}, t.rects, {
    placement: t.placement
  })) : p, L = typeof M == "number" ? {
    mainAxis: M,
    altAxis: M
  } : Object.assign({
    mainAxis: 0,
    altAxis: 0
  }, M), P = t.modifiersData.offset ? t.modifiersData.offset[t.placement] : null, _ = {
    x: 0,
    y: 0
  };
  if (R) {
    if (i) {
      var D, K = x === "y" ? te : ne, T = x === "y" ? le : ae, z = x === "y" ? "height" : "width", k = R[x], V = k + h[K], F = k - h[T], j = v ?
      -A[z] / 2 : 0, O = w === ut ? S[z] : A[z], G = w === ut ? -A[z] : -S[z], Ee = t.elements.arrow, pe = v && Ee ? Qt(Ee) : {
        width: 0,
        height: 0
      }, se = t.modifiersData["arrow#persistent"] ? t.modifiersData["arrow#persistent"].padding : Rn(), ue = se[K], ve = se[T], Se = tr(0, S[z],
      pe[z]), Ot = b ? S[z] / 2 - j - Se - ue - L.mainAxis : O - Se - ue - L.mainAxis, Yr = b ? -S[z] / 2 + j + Se + ve + L.mainAxis : G + Se +
      ve + L.mainAxis, Xo = t.elements.arrow && et(t.elements.arrow), pp = Xo ? x === "y" ? Xo.clientTop || 0 : Xo.clientLeft || 0 : 0, xl = (D =
      P?.[x]) != null ? D : 0, mp = k + Ot - xl - pp, hp = k + Yr - xl, El = tr(v ? Jt(V, mp) : V, k, v ? Qe(F, hp) : F);
      R[x] = El, _[x] = El - k;
    }
    if (l) {
      var Sl, gp = x === "x" ? te : ne, vp = x === "x" ? le : ae, Bt = R[E], zn = E === "y" ? "height" : "width", Cl = Bt + h[gp], Ml = Bt -
      h[vp], Zo = [te, ne].indexOf(g) !== -1, Al = (Sl = P?.[E]) != null ? Sl : 0, Ll = Zo ? Cl : Bt - S[zn] - A[zn] - Al + L.altAxis, Il = Zo ?
      Bt + S[zn] + A[zn] - Al - L.altAxis : Ml, zl = v && Zo ? Uf(Ll, Bt, Il) : tr(v ? Ll : Cl, Bt, v ? Il : Ml);
      R[E] = zl, _[E] = zl - Bt;
    }
    t.modifiersData[n] = _;
  }
}
var wd, bd = C(() => {
  ke();
  It();
  Po();
  vd();
  O0();
  Ho();
  Dr();
  Cn();
  _r();
  B0();
  zt();
  o(M7, "preventOverflow");
  wd = {
    name: "preventOverflow",
    enabled: !0,
    phase: "main",
    fn: M7,
    requiresIfExists: ["offset"]
  };
});

// ../node_modules/@popperjs/core/lib/modifiers/index.js
var G0 = C(() => {
});

// ../node_modules/@popperjs/core/lib/dom-utils/getHTMLElementScroll.js
function Y0(e) {
  return {
    scrollLeft: e.scrollLeft,
    scrollTop: e.scrollTop
  };
}
var yd = C(() => {
  o(Y0, "getHTMLElementScroll");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getNodeScroll.js
function X0(e) {
  return e === Z(e) || !ce(e) ? rr(e) : Y0(e);
}
var Rd = C(() => {
  Bo();
  Je();
  Oe();
  yd();
  o(X0, "getNodeScroll");
});

// ../node_modules/@popperjs/core/lib/dom-utils/getCompositeRect.js
function A7(e) {
  var t = e.getBoundingClientRect(), r = ft(t.width) / e.offsetWidth || 1, n = ft(t.height) / e.offsetHeight || 1;
  return r !== 1 || n !== 1;
}
function Z0(e, t, r) {
  r === void 0 && (r = !1);
  var n = ce(t), a = ce(t) && A7(t), i = ge(t), c = Ue(e, a, r), l = {
    scrollLeft: 0,
    scrollTop: 0
  }, s = {
    x: 0,
    y: 0
  };
  return (n || !n && !r) && ((fe(t) !== "body" || // https://github.com/popperjs/popper-core/issues/1078
  or(i)) && (l = X0(t)), ce(t) ? (s = Ue(t, !0), s.x += t.clientLeft, s.y += t.clientTop) : i && (s.x = nr(i))), {
    x: c.left + l.scrollLeft - s.x,
    y: c.top + l.scrollTop - s.y,
    width: c.width,
    height: c.height
  };
}
var xd = C(() => {
  Nr();
  Rd();
  Lt();
  Oe();
  No();
  dt();
  Fo();
  zt();
  o(A7, "isElementScaled");
  o(Z0, "getCompositeRect");
});

// ../node_modules/@popperjs/core/lib/utils/orderModifiers.js
function L7(e) {
  var t = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set(), n = [];
  e.forEach(function(i) {
    t.set(i.name, i);
  });
  function a(i) {
    r.add(i.name);
    var c = [].concat(i.requires || [], i.requiresIfExists || []);
    c.forEach(function(l) {
      if (!r.has(l)) {
        var s = t.get(l);
        s && a(s);
      }
    }), n.push(i);
  }
  return o(a, "sort"), e.forEach(function(i) {
    r.has(i.name) || a(i);
  }), n;
}
function K0(e) {
  var t = L7(e);
  return _f.reduce(function(r, n) {
    return r.concat(t.filter(function(a) {
      return a.phase === n;
    }));
  }, []);
}
var Ed = C(() => {
  ke();
  o(L7, "order");
  o(K0, "orderModifiers");
});

// ../node_modules/@popperjs/core/lib/utils/debounce.js
function J0(e) {
  var t;
  return function() {
    return t || (t = new Promise(function(r) {
      Promise.resolve().then(function() {
        t = void 0, r(e());
      });
    })), t;
  };
}
var Sd = C(() => {
  o(J0, "debounce");
});

// ../node_modules/@popperjs/core/lib/utils/mergeByName.js
function Q0(e) {
  var t = e.reduce(function(r, n) {
    var a = r[n.name];
    return r[n.name] = a ? Object.assign({}, a, n, {
      options: Object.assign({}, a.options, n.options),
      data: Object.assign({}, a.data, n.data)
    }) : n, r;
  }, {});
  return Object.keys(t).map(function(r) {
    return t[r];
  });
}
var Cd = C(() => {
  o(Q0, "mergeByName");
});

// ../node_modules/@popperjs/core/lib/createPopper.js
function Ad() {
  for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++)
    t[r] = arguments[r];
  return !t.some(function(n) {
    return !(n && typeof n.getBoundingClientRect == "function");
  });
}
function Ld(e) {
  e === void 0 && (e = {});
  var t = e, r = t.defaultModifiers, n = r === void 0 ? [] : r, a = t.defaultOptions, i = a === void 0 ? Md : a;
  return /* @__PURE__ */ o(function(l, s, u) {
    u === void 0 && (u = i);
    var f = {
      placement: "bottom",
      orderedModifiers: [],
      options: Object.assign({}, Md, i),
      modifiersData: {},
      elements: {
        reference: l,
        popper: s
      },
      attributes: {},
      styles: {}
    }, d = [], m = !1, v = {
      state: f,
      setOptions: /* @__PURE__ */ o(function(g) {
        var w = typeof g == "function" ? g(f.options) : g;
        p(), f.options = Object.assign({}, i, f.options, w), f.scrollParents = {
          reference: We(l) ? Tt(l) : l.contextElement ? Tt(l.contextElement) : [],
          popper: Tt(s)
        };
        var b = K0(Q0([].concat(n, f.options.modifiers)));
        return f.orderedModifiers = b.filter(function(x) {
          return x.enabled;
        }), y(), v.update();
      }, "setOptions"),
      // Sync update – it will always be executed, even if not necessary. This
      // is useful for low frequency updates where sync behavior simplifies the
      // logic.
      // For high frequency updates (e.g. `resize` and `scroll` events), always
      // prefer the async Popper#update method
      forceUpdate: /* @__PURE__ */ o(function() {
        if (!m) {
          var g = f.elements, w = g.reference, b = g.popper;
          if (Ad(w, b)) {
            f.rects = {
              reference: Z0(w, et(b), f.options.strategy === "fixed"),
              popper: Qt(b)
            }, f.reset = !1, f.placement = f.options.placement, f.orderedModifiers.forEach(function(L) {
              return f.modifiersData[L.name] = Object.assign({}, L.data);
            });
            for (var x = 0; x < f.orderedModifiers.length; x++) {
              if (f.reset === !0) {
                f.reset = !1, x = -1;
                continue;
              }
              var E = f.orderedModifiers[x], R = E.fn, S = E.options, A = S === void 0 ? {} : S, M = E.name;
              typeof R == "function" && (f = R({
                state: f,
                options: A,
                name: M,
                instance: v
              }) || f);
            }
          }
        }
      }, "forceUpdate"),
      // Async and optimistically optimized update – it will not be executed if
      // not necessary (debounced to run at most once-per-tick)
      update: J0(function() {
        return new Promise(function(h) {
          v.forceUpdate(), h(f);
        });
      }),
      destroy: /* @__PURE__ */ o(function() {
        p(), m = !0;
      }, "destroy")
    };
    if (!Ad(l, s))
      return v;
    v.setOptions(u).then(function(h) {
      !m && u.onFirstUpdate && u.onFirstUpdate(h);
    });
    function y() {
      f.orderedModifiers.forEach(function(h) {
        var g = h.name, w = h.options, b = w === void 0 ? {} : w, x = h.effect;
        if (typeof x == "function") {
          var E = x({
            state: f,
            name: g,
            instance: v,
            options: b
          }), R = /* @__PURE__ */ o(function() {
          }, "noopFn");
          d.push(E || R);
        }
      });
    }
    o(y, "runModifierEffects");
    function p() {
      d.forEach(function(h) {
        return h();
      }), d = [];
    }
    return o(p, "cleanupModifierEffects"), v;
  }, "createPopper");
}
var Md, Id = C(() => {
  xd();
  Ho();
  $0();
  Dr();
  Ed();
  Sd();
  Cd();
  Oe();
  Md = {
    placement: "bottom",
    modifiers: [],
    strategy: "absolute"
  };
  o(Ad, "areValidElements");
  o(Ld, "popperGenerator");
});

// ../node_modules/@popperjs/core/lib/popper.js
var I7, el, zd = C(() => {
  Id();
  Jf();
  gd();
  Zf();
  Vf();
  md();
  cd();
  bd();
  Gf();
  dd();
  G0();
  I7 = [Kf, hd, Xf, $f, pd, ld, wd, qf, fd], el = /* @__PURE__ */ Ld({
    defaultModifiers: I7
  });
});

// ../node_modules/@popperjs/core/lib/index.js
var Td = C(() => {
  ke();
  G0();
  zd();
});

// ../node_modules/react-fast-compare/index.js
var Pd = H((hP, Hd) => {
  var z7 = typeof Element < "u", T7 = typeof Map == "function", H7 = typeof Set == "function", P7 = typeof ArrayBuffer == "function" && !!ArrayBuffer.
  isView;
  function _o(e, t) {
    if (e === t) return !0;
    if (e && t && typeof e == "object" && typeof t == "object") {
      if (e.constructor !== t.constructor) return !1;
      var r, n, a;
      if (Array.isArray(e)) {
        if (r = e.length, r != t.length) return !1;
        for (n = r; n-- !== 0; )
          if (!_o(e[n], t[n])) return !1;
        return !0;
      }
      var i;
      if (T7 && e instanceof Map && t instanceof Map) {
        if (e.size !== t.size) return !1;
        for (i = e.entries(); !(n = i.next()).done; )
          if (!t.has(n.value[0])) return !1;
        for (i = e.entries(); !(n = i.next()).done; )
          if (!_o(n.value[1], t.get(n.value[0]))) return !1;
        return !0;
      }
      if (H7 && e instanceof Set && t instanceof Set) {
        if (e.size !== t.size) return !1;
        for (i = e.entries(); !(n = i.next()).done; )
          if (!t.has(n.value[0])) return !1;
        return !0;
      }
      if (P7 && ArrayBuffer.isView(e) && ArrayBuffer.isView(t)) {
        if (r = e.length, r != t.length) return !1;
        for (n = r; n-- !== 0; )
          if (e[n] !== t[n]) return !1;
        return !0;
      }
      if (e.constructor === RegExp) return e.source === t.source && e.flags === t.flags;
      if (e.valueOf !== Object.prototype.valueOf && typeof e.valueOf == "function" && typeof t.valueOf == "function") return e.valueOf() ===
      t.valueOf();
      if (e.toString !== Object.prototype.toString && typeof e.toString == "function" && typeof t.toString == "function") return e.toString() ===
      t.toString();
      if (a = Object.keys(e), r = a.length, r !== Object.keys(t).length) return !1;
      for (n = r; n-- !== 0; )
        if (!Object.prototype.hasOwnProperty.call(t, a[n])) return !1;
      if (z7 && e instanceof Element) return !1;
      for (n = r; n-- !== 0; )
        if (!((a[n] === "_owner" || a[n] === "__v" || a[n] === "__o") && e.$$typeof) && !_o(e[a[n]], t[a[n]]))
          return !1;
      return !0;
    }
    return e !== e && t !== t;
  }
  o(_o, "equal");
  Hd.exports = /* @__PURE__ */ o(function(t, r) {
    try {
      return _o(t, r);
    } catch (n) {
      if ((n.message || "").match(/stack|recursion/i))
        return console.warn("react-fast-compare cannot handle circular refs"), !1;
      throw n;
    }
  }, "isEqual");
});

// ../node_modules/react-popper/lib/esm/usePopper.js
import * as Ht from "react";
import * as kd from "react-dom";
var Od, k7, tl, Bd = C(() => {
  Td();
  Od = me(Pd());
  Nf();
  k7 = [], tl = /* @__PURE__ */ o(function(t, r, n) {
    n === void 0 && (n = {});
    var a = Ht.useRef(null), i = {
      onFirstUpdate: n.onFirstUpdate,
      placement: n.placement || "bottom",
      strategy: n.strategy || "absolute",
      modifiers: n.modifiers || k7
    }, c = Ht.useState({
      styles: {
        popper: {
          position: i.strategy,
          left: "0",
          top: "0"
        },
        arrow: {
          position: "absolute"
        }
      },
      attributes: {}
    }), l = c[0], s = c[1], u = Ht.useMemo(function() {
      return {
        name: "updateState",
        enabled: !0,
        phase: "write",
        fn: /* @__PURE__ */ o(function(v) {
          var y = v.state, p = Object.keys(y.elements);
          kd.flushSync(function() {
            s({
              styles: L0(p.map(function(h) {
                return [h, y.styles[h] || {}];
              })),
              attributes: L0(p.map(function(h) {
                return [h, y.attributes[h]];
              }))
            });
          });
        }, "fn"),
        requires: ["computeStyles"]
      };
    }, []), f = Ht.useMemo(function() {
      var m = {
        onFirstUpdate: i.onFirstUpdate,
        placement: i.placement,
        strategy: i.strategy,
        modifiers: [].concat(i.modifiers, [u, {
          name: "applyStyles",
          enabled: !1
        }])
      };
      return (0, Od.default)(a.current, m) ? a.current || m : (a.current = m, m);
    }, [i.onFirstUpdate, i.placement, i.strategy, i.modifiers, u]), d = Ht.useRef();
    return I0(function() {
      d.current && d.current.setOptions(f);
    }, [f]), I0(function() {
      if (!(t == null || r == null)) {
        var m = n.createPopper || el, v = m(t, r, f);
        return d.current = v, function() {
          v.destroy(), d.current = null;
        };
      }
    }, [t, r, n.createPopper]), {
      state: d.current ? d.current.state : null,
      styles: l.styles,
      attributes: l.attributes,
      update: d.current ? d.current.update : null,
      forceUpdate: d.current ? d.current.forceUpdate : null
    };
  }, "usePopper");
});

// ../node_modules/react-popper/lib/esm/index.js
var Nd = C(() => {
  Bd();
});

// ../node_modules/react-popper-tooltip/dist/esm/react-popper-tooltip.js
import * as $ from "react";
function _d(e) {
  var t = $.useRef(e);
  return t.current = e, $.useCallback(function() {
    return t.current;
  }, []);
}
function B7(e) {
  var t = e.initial, r = e.value, n = e.onChange, a = n === void 0 ? O7 : n;
  if (t === void 0 && r === void 0)
    throw new TypeError('Either "value" or "initial" variable must be set. Now both are undefined');
  var i = $.useState(t), c = i[0], l = i[1], s = _d(c), u = $.useCallback(function(d) {
    var m = s(), v = typeof d == "function" ? d(m) : d;
    typeof v.persist == "function" && v.persist(), l(v), typeof a == "function" && a(v);
  }, [s, a]), f = r !== void 0;
  return [f ? r : c, f ? a : u];
}
function $d(e, t) {
  return e === void 0 && (e = 0), t === void 0 && (t = 0), function() {
    return {
      width: 0,
      height: 0,
      top: t,
      right: e,
      bottom: t,
      left: e,
      x: 0,
      y: 0,
      toJSON: /* @__PURE__ */ o(function() {
        return null;
      }, "toJSON")
    };
  };
}
function Vd(e, t) {
  var r, n, a;
  e === void 0 && (e = {}), t === void 0 && (t = {});
  var i = Object.keys(Dd).reduce(function(T, z) {
    var k;
    return W({}, T, (k = {}, k[z] = T[z] !== void 0 ? T[z] : Dd[z], k));
  }, e), c = $.useMemo(
    function() {
      return [{
        name: "offset",
        options: {
          offset: i.offset
        }
      }];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Array.isArray(i.offset) ? i.offset : []
  ), l = W({}, t, {
    placement: t.placement || i.placement,
    modifiers: t.modifiers || c
  }), s = $.useState(null), u = s[0], f = s[1], d = $.useState(null), m = d[0], v = d[1], y = B7({
    initial: i.defaultVisible,
    value: i.visible,
    onChange: i.onVisibleChange
  }), p = y[0], h = y[1], g = $.useRef();
  $.useEffect(function() {
    return function() {
      return clearTimeout(g.current);
    };
  }, []);
  var w = tl(i.followCursor ? Fd : u, m, l), b = w.styles, x = w.attributes, E = ur(w, N7), R = E.update, S = _d({
    visible: p,
    triggerRef: u,
    tooltipRef: m,
    finalConfig: i
  }), A = $.useCallback(
    function(T) {
      return Array.isArray(i.trigger) ? i.trigger.includes(T) : i.trigger === T;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Array.isArray(i.trigger) ? i.trigger : [i.trigger]
  ), M = $.useCallback(function() {
    clearTimeout(g.current), g.current = window.setTimeout(function() {
      return h(!1);
    }, i.delayHide);
  }, [i.delayHide, h]), L = $.useCallback(function() {
    clearTimeout(g.current), g.current = window.setTimeout(function() {
      return h(!0);
    }, i.delayShow);
  }, [i.delayShow, h]), P = $.useCallback(function() {
    S().visible ? M() : L();
  }, [S, M, L]);
  $.useEffect(function() {
    if (S().finalConfig.closeOnOutsideClick) {
      var T = /* @__PURE__ */ o(function(k) {
        var V, F = S(), j = F.tooltipRef, O = F.triggerRef, G = (k.composedPath == null || (V = k.composedPath()) == null ? void 0 : V[0]) ||
        k.target;
        G instanceof Node && j != null && O != null && !j.contains(G) && !O.contains(G) && M();
      }, "handleClickOutside");
      return document.addEventListener("mousedown", T), function() {
        return document.removeEventListener("mousedown", T);
      };
    }
  }, [S, M]), $.useEffect(function() {
    if (!(u == null || !A("click")))
      return u.addEventListener("click", P), function() {
        return u.removeEventListener("click", P);
      };
  }, [u, A, P]), $.useEffect(function() {
    if (!(u == null || !A("double-click")))
      return u.addEventListener("dblclick", P), function() {
        return u.removeEventListener("dblclick", P);
      };
  }, [u, A, P]), $.useEffect(function() {
    if (!(u == null || !A("right-click"))) {
      var T = /* @__PURE__ */ o(function(k) {
        k.preventDefault(), P();
      }, "preventDefaultAndToggle");
      return u.addEventListener("contextmenu", T), function() {
        return u.removeEventListener("contextmenu", T);
      };
    }
  }, [u, A, P]), $.useEffect(function() {
    if (!(u == null || !A("focus")))
      return u.addEventListener("focus", L), u.addEventListener("blur", M), function() {
        u.removeEventListener("focus", L), u.removeEventListener("blur", M);
      };
  }, [u, A, L, M]), $.useEffect(function() {
    if (!(u == null || !A("hover")))
      return u.addEventListener("mouseenter", L), u.addEventListener("mouseleave", M), function() {
        u.removeEventListener("mouseenter", L), u.removeEventListener("mouseleave", M);
      };
  }, [u, A, L, M]), $.useEffect(function() {
    if (!(m == null || !A("hover") || !S().finalConfig.interactive))
      return m.addEventListener("mouseenter", L), m.addEventListener("mouseleave", M), function() {
        m.removeEventListener("mouseenter", L), m.removeEventListener("mouseleave", M);
      };
  }, [m, A, L, M, S]);
  var _ = E == null || (r = E.state) == null || (n = r.modifiersData) == null || (a = n.hide) == null ? void 0 : a.isReferenceHidden;
  $.useEffect(function() {
    i.closeOnTriggerHidden && _ && M();
  }, [i.closeOnTriggerHidden, M, _]), $.useEffect(function() {
    if (!i.followCursor || u == null) return;
    function T(z) {
      var k = z.clientX, V = z.clientY;
      Fd.getBoundingClientRect = $d(k, V), R?.();
    }
    return o(T, "setMousePosition"), u.addEventListener("mousemove", T), function() {
      return u.removeEventListener("mousemove", T);
    };
  }, [i.followCursor, u, R]), $.useEffect(function() {
    if (!(m == null || R == null || i.mutationObserverOptions == null)) {
      var T = new MutationObserver(R);
      return T.observe(m, i.mutationObserverOptions), function() {
        return T.disconnect();
      };
    }
  }, [i.mutationObserverOptions, m, R]);
  var D = /* @__PURE__ */ o(function(z) {
    return z === void 0 && (z = {}), W({}, z, {
      style: W({}, z.style, b.popper)
    }, x.popper, {
      "data-popper-interactive": i.interactive
    });
  }, "getTooltipProps"), K = /* @__PURE__ */ o(function(z) {
    return z === void 0 && (z = {}), W({}, z, x.arrow, {
      style: W({}, z.style, b.arrow),
      "data-popper-arrow": !0
    });
  }, "getArrowProps");
  return W({
    getArrowProps: K,
    getTooltipProps: D,
    setTooltipRef: v,
    setTriggerRef: f,
    tooltipRef: m,
    triggerRef: u,
    visible: p
  }, E);
}
var O7, N7, Fd, Dd, jd = C(() => {
  Bn();
  Kr();
  Nd();
  o(_d, "useGetLatest");
  O7 = /* @__PURE__ */ o(function() {
  }, "noop");
  o(B7, "useControlledState");
  o($d, "generateBoundingClientRect");
  N7 = ["styles", "attributes"], Fd = {
    getBoundingClientRect: $d()
  }, Dd = {
    closeOnOutsideClick: !0,
    closeOnTriggerHidden: !1,
    defaultVisible: !1,
    delayHide: 0,
    delayShow: 0,
    followCursor: !1,
    interactive: !1,
    mutationObserverOptions: {
      attributes: !0,
      childList: !0,
      subtree: !0
    },
    offset: [0, 6],
    trigger: "hover"
  };
  o(Vd, "usePopperTooltip");
});

// src/components/components/tooltip/Tooltip.tsx
import rl from "react";
import { lighten as Mn, styled as Ud } from "storybook/theming";
var Wd, Ge, Pt, F7, D7, nl, qd = C(() => {
  "use strict";
  Wd = me(Qr(), 1), Ge = (0, Wd.default)(1e3)(
    (e, t, r, n = 0) => t.split("-")[0] === e ? r : n
  ), Pt = 8, F7 = Ud.div(
    {
      position: "absolute",
      borderStyle: "solid"
    },
    ({ placement: e }) => {
      let t = 0, r = 0;
      switch (!0) {
        case (e.startsWith("left") || e.startsWith("right")): {
          r = 8;
          break;
        }
        case (e.startsWith("top") || e.startsWith("bottom")): {
          t = 8;
          break;
        }
        default:
      }
      return { transform: `translate3d(${t}px, ${r}px, 0px)` };
    },
    ({ theme: e, color: t, placement: r }) => ({
      bottom: `${Ge("top", r, `${Pt * -1}px`, "auto")}`,
      top: `${Ge("bottom", r, `${Pt * -1}px`, "auto")}`,
      right: `${Ge("left", r, `${Pt * -1}px`, "auto")}`,
      left: `${Ge("right", r, `${Pt * -1}px`, "auto")}`,
      borderBottomWidth: `${Ge("top", r, "0", Pt)}px`,
      borderTopWidth: `${Ge("bottom", r, "0", Pt)}px`,
      borderRightWidth: `${Ge("left", r, "0", Pt)}px`,
      borderLeftWidth: `${Ge("right", r, "0", Pt)}px`,
      borderTopColor: Ge(
        "top",
        r,
        e.color[t] || t || e.base === "light" ? Mn(e.background.app) : e.background.app,
        "transparent"
      ),
      borderBottomColor: Ge(
        "bottom",
        r,
        e.color[t] || t || e.base === "light" ? Mn(e.background.app) : e.background.app,
        "transparent"
      ),
      borderLeftColor: Ge(
        "left",
        r,
        e.color[t] || t || e.base === "light" ? Mn(e.background.app) : e.background.app,
        "transparent"
      ),
      borderRightColor: Ge(
        "right",
        r,
        e.color[t] || t || e.base === "light" ? Mn(e.background.app) : e.background.app,
        "transparent"
      )
    })
  ), D7 = Ud.div(
    ({ hidden: e }) => ({
      display: e ? "none" : "inline-block",
      zIndex: 2147483647,
      colorScheme: "light dark"
    }),
    ({ theme: e, color: t, hasChrome: r }) => r ? {
      background: t && e.color[t] || t || e.base === "light" ? Mn(e.background.app) : e.background.app,
      filter: `
            drop-shadow(0px 5px 5px rgba(0,0,0,0.05))
            drop-shadow(0 1px 3px rgba(0,0,0,0.1))
          `,
      borderRadius: e.appBorderRadius + 2,
      fontSize: e.typography.size.s1
    } : {}
  ), nl = rl.forwardRef(
    ({
      placement: e = "top",
      hasChrome: t = !0,
      children: r,
      arrowProps: n = {},
      tooltipRef: a,
      color: i,
      withArrows: c,
      ...l
    }, s) => /* @__PURE__ */ rl.createElement(D7, { "data-testid": "tooltip", hasChrome: t, ref: s, ...l, color: i }, t && c && /* @__PURE__ */ rl.
    createElement(F7, { placement: e, ...n, color: i }), r)
  );
  nl.displayName = "Tooltip";
});

// src/components/components/tooltip/WithTooltip.tsx
var al = {};
Zr(al, {
  WithToolTipState: () => ol,
  WithTooltip: () => ol,
  WithTooltipPure: () => Yd
});
import An, { useCallback as _7, useEffect as $7, useState as V7 } from "react";
import j7 from "react-dom";
import { global as W7 } from "@storybook/global";
import { styled as Gd } from "storybook/theming";
var $o, U7, q7, Yd, ol, Vo = C(() => {
  "use strict";
  jd();
  qd();
  ({ document: $o } = W7), U7 = Gd.div`
  display: inline-block;
  cursor: ${(e) => e.trigger === "hover" || e.trigger?.includes("hover") ? "default" : "pointer"};
`, q7 = Gd.g`
  cursor: ${(e) => e.trigger === "hover" || e.trigger?.includes("hover") ? "default" : "pointer"};
`, Yd = /* @__PURE__ */ o(({
    svg: e = !1,
    trigger: t = "click",
    closeOnOutsideClick: r = !1,
    placement: n = "top",
    modifiers: a = [
      {
        name: "preventOverflow",
        options: {
          padding: 8
        }
      },
      {
        name: "offset",
        options: {
          offset: [8, 8]
        }
      },
      {
        name: "arrow",
        options: {
          padding: 8
        }
      }
    ],
    hasChrome: i = !0,
    defaultVisible: c = !1,
    withArrows: l,
    offset: s,
    tooltip: u,
    children: f,
    closeOnTriggerHidden: d,
    mutationObserverOptions: m,
    delayHide: v = t === "hover" ? 200 : 0,
    visible: y,
    interactive: p,
    delayShow: h = t === "hover" ? 400 : 0,
    strategy: g,
    followCursor: w,
    onVisibleChange: b,
    ...x
  }) => {
    let E = e ? q7 : U7, {
      getArrowProps: R,
      getTooltipProps: S,
      setTooltipRef: A,
      setTriggerRef: M,
      visible: L,
      state: P
    } = Vd(
      {
        trigger: t,
        placement: n,
        defaultVisible: c,
        delayHide: v,
        interactive: p,
        closeOnOutsideClick: r,
        closeOnTriggerHidden: d,
        onVisibleChange: b,
        delayShow: h,
        followCursor: w,
        mutationObserverOptions: m,
        visible: y,
        offset: s
      },
      {
        modifiers: a,
        strategy: g
      }
    ), _ = L ? /* @__PURE__ */ An.createElement(
      nl,
      {
        placement: P?.placement,
        ref: A,
        hasChrome: i,
        arrowProps: R(),
        withArrows: l,
        ...S()
      },
      typeof u == "function" ? u({ onHide: /* @__PURE__ */ o(() => b(!1), "onHide") }) : u
    ) : null;
    return /* @__PURE__ */ An.createElement(An.Fragment, null, /* @__PURE__ */ An.createElement(E, { trigger: t, ref: M, ...x }, f), L && j7.
    createPortal(_, $o.body));
  }, "WithTooltipPure"), ol = /* @__PURE__ */ o(({
    startOpen: e = !1,
    onVisibleChange: t,
    ...r
  }) => {
    let [n, a] = V7(e), i = _7(
      (c) => {
        t && t(c) === !1 || a(c);
      },
      [t]
    );
    return $7(() => {
      let c = /* @__PURE__ */ o(() => i(!1), "hide");
      $o.addEventListener("keydown", c, !1);
      let l = Array.from($o.getElementsByTagName("iframe")), s = [];
      return l.forEach((u) => {
        let f = /* @__PURE__ */ o(() => {
          try {
            u.contentWindow.document && (u.contentWindow.document.addEventListener("click", c), s.push(() => {
              try {
                u.contentWindow.document.removeEventListener("click", c);
              } catch {
              }
            }));
          } catch {
          }
        }, "bind");
        f(), u.addEventListener("load", f), s.push(() => {
          u.removeEventListener("load", f);
        });
      }), () => {
        $o.removeEventListener("keydown", c), s.forEach((u) => {
          u();
        });
      };
    }), /* @__PURE__ */ An.createElement(Yd, { ...r, visible: n, onVisibleChange: i });
  }, "WithToolTipState");
});

// src/components/index.ts
import { createElement as Ew, forwardRef as Sw } from "react";

// src/components/components/typography/components.tsx
import ee from "react";

// src/components/components/typography/DocumentFormatting.tsx
var J = /* @__PURE__ */ o(({ ...e }, t) => {
  let r = [e.class, e.className];
  return delete e.class, e.className = ["sbdocs", `sbdocs-${t}`, ...r].filter(Boolean).join(" "), e;
}, "nameSpaceClassNames");

// src/components/components/typography/ResetWrapper.tsx
import { styled as s2 } from "storybook/theming";

// ../node_modules/polished/dist/polished.esm.js
Kr();
Hl();

// ../node_modules/@babel/runtime/helpers/esm/inheritsLoose.js
Hn();
function Pl(e, t) {
  e.prototype = Object.create(t.prototype), e.prototype.constructor = e, ht(e, t);
}
o(Pl, "_inheritsLoose");

// ../node_modules/@babel/runtime/helpers/esm/wrapNativeSuper.js
kl();
Hn();

// ../node_modules/@babel/runtime/helpers/esm/isNativeFunction.js
function Ol(e) {
  try {
    return Function.toString.call(e).indexOf("[native code]") !== -1;
  } catch {
    return typeof e == "function";
  }
}
o(Ol, "_isNativeFunction");

// ../node_modules/@babel/runtime/helpers/esm/isNativeReflectConstruct.js
function Ko() {
  try {
    var e = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (Ko = /* @__PURE__ */ o(function() {
    return !!e;
  }, "_isNativeReflectConstruct"))();
}
o(Ko, "_isNativeReflectConstruct");

// ../node_modules/@babel/runtime/helpers/esm/construct.js
Hn();
function Bl(e, t, r) {
  if (Ko()) return Reflect.construct.apply(null, arguments);
  var n = [null];
  n.push.apply(n, t);
  var a = new (e.bind.apply(e, n))();
  return r && ht(a, r.prototype), a;
}
o(Bl, "_construct");

// ../node_modules/@babel/runtime/helpers/esm/wrapNativeSuper.js
function kn(e) {
  var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
  return kn = /* @__PURE__ */ o(function(n) {
    if (n === null || !Ol(n)) return n;
    if (typeof n != "function") throw new TypeError("Super expression must either be null or a function");
    if (t !== void 0) {
      if (t.has(n)) return t.get(n);
      t.set(n, a);
    }
    function a() {
      return Bl(n, arguments, Pn(this).constructor);
    }
    return o(a, "Wrapper"), a.prototype = Object.create(n.prototype, {
      constructor: {
        value: a,
        enumerable: !1,
        writable: !0,
        configurable: !0
      }
    }), ht(a, n);
  }, "_wrapNativeSuper"), kn(e);
}
o(kn, "_wrapNativeSuper");

// ../node_modules/polished/dist/polished.esm.js
var Sp = {
  1: `Passed invalid arguments to hsl, please pass multiple numbers e.g. hsl(360, 0.75, 0.4) or an object e.g. rgb({ hue: 255, saturation: 0\
.4, lightness: 0.75 }).

`,
  2: `Passed invalid arguments to hsla, please pass multiple numbers e.g. hsla(360, 0.75, 0.4, 0.7) or an object e.g. rgb({ hue: 255, satura\
tion: 0.4, lightness: 0.75, alpha: 0.7 }).

`,
  3: `Passed an incorrect argument to a color function, please pass a string representation of a color.

`,
  4: `Couldn't generate valid rgb string from %s, it returned %s.

`,
  5: `Couldn't parse the color string. Please provide the color as a string in hex, rgb, rgba, hsl or hsla notation.

`,
  6: `Passed invalid arguments to rgb, please pass multiple numbers e.g. rgb(255, 205, 100) or an object e.g. rgb({ red: 255, green: 205, bl\
ue: 100 }).

`,
  7: `Passed invalid arguments to rgba, please pass multiple numbers e.g. rgb(255, 205, 100, 0.75) or an object e.g. rgb({ red: 255, green: \
205, blue: 100, alpha: 0.75 }).

`,
  8: `Passed invalid argument to toColorString, please pass a RgbColor, RgbaColor, HslColor or HslaColor object.

`,
  9: `Please provide a number of steps to the modularScale helper.

`,
  10: `Please pass a number or one of the predefined scales to the modularScale helper as the ratio.

`,
  11: `Invalid value passed as base to modularScale, expected number or em string but got "%s"

`,
  12: `Expected a string ending in "px" or a number passed as the first argument to %s(), got "%s" instead.

`,
  13: `Expected a string ending in "px" or a number passed as the second argument to %s(), got "%s" instead.

`,
  14: `Passed invalid pixel value ("%s") to %s(), please pass a value like "12px" or 12.

`,
  15: `Passed invalid base value ("%s") to %s(), please pass a value like "12px" or 12.

`,
  16: `You must provide a template to this method.

`,
  17: `You passed an unsupported selector state to this method.

`,
  18: `minScreen and maxScreen must be provided as stringified numbers with the same units.

`,
  19: `fromSize and toSize must be provided as stringified numbers with the same units.

`,
  20: `expects either an array of objects or a single object with the properties prop, fromSize, and toSize.

`,
  21: "expects the objects in the first argument array to have the properties `prop`, `fromSize`, and `toSize`.\n\n",
  22: "expects the first argument object to have the properties `prop`, `fromSize`, and `toSize`.\n\n",
  23: `fontFace expects a name of a font-family.

`,
  24: `fontFace expects either the path to the font file(s) or a name of a local copy.

`,
  25: `fontFace expects localFonts to be an array.

`,
  26: `fontFace expects fileFormats to be an array.

`,
  27: `radialGradient requries at least 2 color-stops to properly render.

`,
  28: `Please supply a filename to retinaImage() as the first argument.

`,
  29: `Passed invalid argument to triangle, please pass correct pointingDirection e.g. 'right'.

`,
  30: "Passed an invalid value to `height` or `width`. Please provide a pixel based unit.\n\n",
  31: `The animation shorthand only takes 8 arguments. See the specification for more information: http://mdn.io/animation

`,
  32: `To pass multiple animations please supply them in arrays, e.g. animation(['rotate', '2s'], ['move', '1s'])
To pass a single animation please supply them in simple values, e.g. animation('rotate', '2s')

`,
  33: `The animation shorthand arrays can only have 8 elements. See the specification for more information: http://mdn.io/animation

`,
  34: `borderRadius expects a radius value as a string or number as the second argument.

`,
  35: `borderRadius expects one of "top", "bottom", "left" or "right" as the first argument.

`,
  36: `Property must be a string value.

`,
  37: `Syntax Error at %s.

`,
  38: `Formula contains a function that needs parentheses at %s.

`,
  39: `Formula is missing closing parenthesis at %s.

`,
  40: `Formula has too many closing parentheses at %s.

`,
  41: `All values in a formula must have the same unit or be unitless.

`,
  42: `Please provide a number of steps to the modularScale helper.

`,
  43: `Please pass a number or one of the predefined scales to the modularScale helper as the ratio.

`,
  44: `Invalid value passed as base to modularScale, expected number or em/rem string but got %s.

`,
  45: `Passed invalid argument to hslToColorString, please pass a HslColor or HslaColor object.

`,
  46: `Passed invalid argument to rgbToColorString, please pass a RgbColor or RgbaColor object.

`,
  47: `minScreen and maxScreen must be provided as stringified numbers with the same units.

`,
  48: `fromSize and toSize must be provided as stringified numbers with the same units.

`,
  49: `Expects either an array of objects or a single object with the properties prop, fromSize, and toSize.

`,
  50: `Expects the objects in the first argument array to have the properties prop, fromSize, and toSize.

`,
  51: `Expects the first argument object to have the properties prop, fromSize, and toSize.

`,
  52: `fontFace expects either the path to the font file(s) or a name of a local copy.

`,
  53: `fontFace expects localFonts to be an array.

`,
  54: `fontFace expects fileFormats to be an array.

`,
  55: `fontFace expects a name of a font-family.

`,
  56: `linearGradient requries at least 2 color-stops to properly render.

`,
  57: `radialGradient requries at least 2 color-stops to properly render.

`,
  58: `Please supply a filename to retinaImage() as the first argument.

`,
  59: `Passed invalid argument to triangle, please pass correct pointingDirection e.g. 'right'.

`,
  60: "Passed an invalid value to `height` or `width`. Please provide a pixel based unit.\n\n",
  61: `Property must be a string value.

`,
  62: `borderRadius expects a radius value as a string or number as the second argument.

`,
  63: `borderRadius expects one of "top", "bottom", "left" or "right" as the first argument.

`,
  64: `The animation shorthand only takes 8 arguments. See the specification for more information: http://mdn.io/animation.

`,
  65: `To pass multiple animations please supply them in arrays, e.g. animation(['rotate', '2s'], ['move', '1s'])\\nTo pass a single animatio\
n please supply them in simple values, e.g. animation('rotate', '2s').

`,
  66: `The animation shorthand arrays can only have 8 elements. See the specification for more information: http://mdn.io/animation.

`,
  67: `You must provide a template to this method.

`,
  68: `You passed an unsupported selector state to this method.

`,
  69: `Expected a string ending in "px" or a number passed as the first argument to %s(), got %s instead.

`,
  70: `Expected a string ending in "px" or a number passed as the second argument to %s(), got %s instead.

`,
  71: `Passed invalid pixel value %s to %s(), please pass a value like "12px" or 12.

`,
  72: `Passed invalid base value %s to %s(), please pass a value like "12px" or 12.

`,
  73: `Please provide a valid CSS variable.

`,
  74: `CSS variable not found and no default was provided.

`,
  75: `important requires a valid style object, got a %s instead.

`,
  76: `fromSize and toSize must be provided as stringified numbers with the same units as minScreen and maxScreen.

`,
  77: `remToPx expects a value in "rem" but you provided it in "%s".

`,
  78: `base must be set in "px" or "%" but you set it in "%s".
`
};
function Cp() {
  for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++)
    t[r] = arguments[r];
  var n = t[0], a = [], i;
  for (i = 1; i < t.length; i += 1)
    a.push(t[i]);
  return a.forEach(function(c) {
    n = n.replace(/%[a-z]/, c);
  }), n;
}
o(Cp, "format");
var Ce = /* @__PURE__ */ function(e) {
  Pl(t, e);
  function t(r) {
    for (var n, a = arguments.length, i = new Array(a > 1 ? a - 1 : 0), c = 1; c < a; c++)
      i[c - 1] = arguments[c];
    return n = e.call(this, Cp.apply(void 0, [Sp[r]].concat(i))) || this, Tl(n);
  }
  return o(t, "PolishedError"), t;
}(/* @__PURE__ */ kn(Error));
function Nl(e, t) {
  return e.substr(-t.length) === t;
}
o(Nl, "endsWith");
var Mp = /^([+-]?(?:\d+|\d*\.\d+))([a-z]*|%)$/;
function Fl(e) {
  if (typeof e != "string") return e;
  var t = e.match(Mp);
  return t ? parseFloat(e) : e;
}
o(Fl, "stripUnit");
var Ap = /* @__PURE__ */ o(function(t) {
  return function(r, n) {
    n === void 0 && (n = "16px");
    var a = r, i = n;
    if (typeof r == "string") {
      if (!Nl(r, "px"))
        throw new Ce(69, t, r);
      a = Fl(r);
    }
    if (typeof n == "string") {
      if (!Nl(n, "px"))
        throw new Ce(70, t, n);
      i = Fl(n);
    }
    if (typeof a == "string")
      throw new Ce(71, r, t);
    if (typeof i == "string")
      throw new Ce(72, n, t);
    return "" + a / i + t;
  };
}, "pxtoFactory"), _l = Ap, c8 = _l("em");
var s8 = _l("rem");
function Jo(e) {
  return Math.round(e * 255);
}
o(Jo, "colorToInt");
function Lp(e, t, r) {
  return Jo(e) + "," + Jo(t) + "," + Jo(r);
}
o(Lp, "convertToInt");
function Jr(e, t, r, n) {
  if (n === void 0 && (n = Lp), t === 0)
    return n(r, r, r);
  var a = (e % 360 + 360) % 360 / 60, i = (1 - Math.abs(2 * r - 1)) * t, c = i * (1 - Math.abs(a % 2 - 1)), l = 0, s = 0, u = 0;
  a >= 0 && a < 1 ? (l = i, s = c) : a >= 1 && a < 2 ? (l = c, s = i) : a >= 2 && a < 3 ? (s = i, u = c) : a >= 3 && a < 4 ? (s = c, u = i) :
  a >= 4 && a < 5 ? (l = c, u = i) : a >= 5 && a < 6 && (l = i, u = c);
  var f = r - i / 2, d = l + f, m = s + f, v = u + f;
  return n(d, m, v);
}
o(Jr, "hslToRgb");
var Dl = {
  aliceblue: "f0f8ff",
  antiquewhite: "faebd7",
  aqua: "00ffff",
  aquamarine: "7fffd4",
  azure: "f0ffff",
  beige: "f5f5dc",
  bisque: "ffe4c4",
  black: "000",
  blanchedalmond: "ffebcd",
  blue: "0000ff",
  blueviolet: "8a2be2",
  brown: "a52a2a",
  burlywood: "deb887",
  cadetblue: "5f9ea0",
  chartreuse: "7fff00",
  chocolate: "d2691e",
  coral: "ff7f50",
  cornflowerblue: "6495ed",
  cornsilk: "fff8dc",
  crimson: "dc143c",
  cyan: "00ffff",
  darkblue: "00008b",
  darkcyan: "008b8b",
  darkgoldenrod: "b8860b",
  darkgray: "a9a9a9",
  darkgreen: "006400",
  darkgrey: "a9a9a9",
  darkkhaki: "bdb76b",
  darkmagenta: "8b008b",
  darkolivegreen: "556b2f",
  darkorange: "ff8c00",
  darkorchid: "9932cc",
  darkred: "8b0000",
  darksalmon: "e9967a",
  darkseagreen: "8fbc8f",
  darkslateblue: "483d8b",
  darkslategray: "2f4f4f",
  darkslategrey: "2f4f4f",
  darkturquoise: "00ced1",
  darkviolet: "9400d3",
  deeppink: "ff1493",
  deepskyblue: "00bfff",
  dimgray: "696969",
  dimgrey: "696969",
  dodgerblue: "1e90ff",
  firebrick: "b22222",
  floralwhite: "fffaf0",
  forestgreen: "228b22",
  fuchsia: "ff00ff",
  gainsboro: "dcdcdc",
  ghostwhite: "f8f8ff",
  gold: "ffd700",
  goldenrod: "daa520",
  gray: "808080",
  green: "008000",
  greenyellow: "adff2f",
  grey: "808080",
  honeydew: "f0fff0",
  hotpink: "ff69b4",
  indianred: "cd5c5c",
  indigo: "4b0082",
  ivory: "fffff0",
  khaki: "f0e68c",
  lavender: "e6e6fa",
  lavenderblush: "fff0f5",
  lawngreen: "7cfc00",
  lemonchiffon: "fffacd",
  lightblue: "add8e6",
  lightcoral: "f08080",
  lightcyan: "e0ffff",
  lightgoldenrodyellow: "fafad2",
  lightgray: "d3d3d3",
  lightgreen: "90ee90",
  lightgrey: "d3d3d3",
  lightpink: "ffb6c1",
  lightsalmon: "ffa07a",
  lightseagreen: "20b2aa",
  lightskyblue: "87cefa",
  lightslategray: "789",
  lightslategrey: "789",
  lightsteelblue: "b0c4de",
  lightyellow: "ffffe0",
  lime: "0f0",
  limegreen: "32cd32",
  linen: "faf0e6",
  magenta: "f0f",
  maroon: "800000",
  mediumaquamarine: "66cdaa",
  mediumblue: "0000cd",
  mediumorchid: "ba55d3",
  mediumpurple: "9370db",
  mediumseagreen: "3cb371",
  mediumslateblue: "7b68ee",
  mediumspringgreen: "00fa9a",
  mediumturquoise: "48d1cc",
  mediumvioletred: "c71585",
  midnightblue: "191970",
  mintcream: "f5fffa",
  mistyrose: "ffe4e1",
  moccasin: "ffe4b5",
  navajowhite: "ffdead",
  navy: "000080",
  oldlace: "fdf5e6",
  olive: "808000",
  olivedrab: "6b8e23",
  orange: "ffa500",
  orangered: "ff4500",
  orchid: "da70d6",
  palegoldenrod: "eee8aa",
  palegreen: "98fb98",
  paleturquoise: "afeeee",
  palevioletred: "db7093",
  papayawhip: "ffefd5",
  peachpuff: "ffdab9",
  peru: "cd853f",
  pink: "ffc0cb",
  plum: "dda0dd",
  powderblue: "b0e0e6",
  purple: "800080",
  rebeccapurple: "639",
  red: "f00",
  rosybrown: "bc8f8f",
  royalblue: "4169e1",
  saddlebrown: "8b4513",
  salmon: "fa8072",
  sandybrown: "f4a460",
  seagreen: "2e8b57",
  seashell: "fff5ee",
  sienna: "a0522d",
  silver: "c0c0c0",
  skyblue: "87ceeb",
  slateblue: "6a5acd",
  slategray: "708090",
  slategrey: "708090",
  snow: "fffafa",
  springgreen: "00ff7f",
  steelblue: "4682b4",
  tan: "d2b48c",
  teal: "008080",
  thistle: "d8bfd8",
  tomato: "ff6347",
  turquoise: "40e0d0",
  violet: "ee82ee",
  wheat: "f5deb3",
  white: "fff",
  whitesmoke: "f5f5f5",
  yellow: "ff0",
  yellowgreen: "9acd32"
};
function Ip(e) {
  if (typeof e != "string") return e;
  var t = e.toLowerCase();
  return Dl[t] ? "#" + Dl[t] : e;
}
o(Ip, "nameToHex");
var zp = /^#[a-fA-F0-9]{6}$/, Tp = /^#[a-fA-F0-9]{8}$/, Hp = /^#[a-fA-F0-9]{3}$/, Pp = /^#[a-fA-F0-9]{4}$/, Qo = /^rgb\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*\)$/i,
kp = /^rgb(?:a)?\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i, Op = /^hsl\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*\)$/i,
Bp = /^hsl(?:a)?\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i;
function cr(e) {
  if (typeof e != "string")
    throw new Ce(3);
  var t = Ip(e);
  if (t.match(zp))
    return {
      red: parseInt("" + t[1] + t[2], 16),
      green: parseInt("" + t[3] + t[4], 16),
      blue: parseInt("" + t[5] + t[6], 16)
    };
  if (t.match(Tp)) {
    var r = parseFloat((parseInt("" + t[7] + t[8], 16) / 255).toFixed(2));
    return {
      red: parseInt("" + t[1] + t[2], 16),
      green: parseInt("" + t[3] + t[4], 16),
      blue: parseInt("" + t[5] + t[6], 16),
      alpha: r
    };
  }
  if (t.match(Hp))
    return {
      red: parseInt("" + t[1] + t[1], 16),
      green: parseInt("" + t[2] + t[2], 16),
      blue: parseInt("" + t[3] + t[3], 16)
    };
  if (t.match(Pp)) {
    var n = parseFloat((parseInt("" + t[4] + t[4], 16) / 255).toFixed(2));
    return {
      red: parseInt("" + t[1] + t[1], 16),
      green: parseInt("" + t[2] + t[2], 16),
      blue: parseInt("" + t[3] + t[3], 16),
      alpha: n
    };
  }
  var a = Qo.exec(t);
  if (a)
    return {
      red: parseInt("" + a[1], 10),
      green: parseInt("" + a[2], 10),
      blue: parseInt("" + a[3], 10)
    };
  var i = kp.exec(t.substring(0, 50));
  if (i)
    return {
      red: parseInt("" + i[1], 10),
      green: parseInt("" + i[2], 10),
      blue: parseInt("" + i[3], 10),
      alpha: parseFloat("" + i[4]) > 1 ? parseFloat("" + i[4]) / 100 : parseFloat("" + i[4])
    };
  var c = Op.exec(t);
  if (c) {
    var l = parseInt("" + c[1], 10), s = parseInt("" + c[2], 10) / 100, u = parseInt("" + c[3], 10) / 100, f = "rgb(" + Jr(l, s, u) + ")", d = Qo.
    exec(f);
    if (!d)
      throw new Ce(4, t, f);
    return {
      red: parseInt("" + d[1], 10),
      green: parseInt("" + d[2], 10),
      blue: parseInt("" + d[3], 10)
    };
  }
  var m = Bp.exec(t.substring(0, 50));
  if (m) {
    var v = parseInt("" + m[1], 10), y = parseInt("" + m[2], 10) / 100, p = parseInt("" + m[3], 10) / 100, h = "rgb(" + Jr(v, y, p) + ")", g = Qo.
    exec(h);
    if (!g)
      throw new Ce(4, t, h);
    return {
      red: parseInt("" + g[1], 10),
      green: parseInt("" + g[2], 10),
      blue: parseInt("" + g[3], 10),
      alpha: parseFloat("" + m[4]) > 1 ? parseFloat("" + m[4]) / 100 : parseFloat("" + m[4])
    };
  }
  throw new Ce(5);
}
o(cr, "parseToRgb");
function Np(e) {
  var t = e.red / 255, r = e.green / 255, n = e.blue / 255, a = Math.max(t, r, n), i = Math.min(t, r, n), c = (a + i) / 2;
  if (a === i)
    return e.alpha !== void 0 ? {
      hue: 0,
      saturation: 0,
      lightness: c,
      alpha: e.alpha
    } : {
      hue: 0,
      saturation: 0,
      lightness: c
    };
  var l, s = a - i, u = c > 0.5 ? s / (2 - a - i) : s / (a + i);
  switch (a) {
    case t:
      l = (r - n) / s + (r < n ? 6 : 0);
      break;
    case r:
      l = (n - t) / s + 2;
      break;
    default:
      l = (t - r) / s + 4;
      break;
  }
  return l *= 60, e.alpha !== void 0 ? {
    hue: l,
    saturation: u,
    lightness: c,
    alpha: e.alpha
  } : {
    hue: l,
    saturation: u,
    lightness: c
  };
}
o(Np, "rgbToHsl");
function gt(e) {
  return Np(cr(e));
}
o(gt, "parseToHsl");
var Fp = /* @__PURE__ */ o(function(t) {
  return t.length === 7 && t[1] === t[2] && t[3] === t[4] && t[5] === t[6] ? "#" + t[1] + t[3] + t[5] : t;
}, "reduceHexValue"), ta = Fp;
function Nt(e) {
  var t = e.toString(16);
  return t.length === 1 ? "0" + t : t;
}
o(Nt, "numberToHex");
function ea(e) {
  return Nt(Math.round(e * 255));
}
o(ea, "colorToHex");
function Dp(e, t, r) {
  return ta("#" + ea(e) + ea(t) + ea(r));
}
o(Dp, "convertToHex");
function On(e, t, r) {
  return Jr(e, t, r, Dp);
}
o(On, "hslToHex");
function _p(e, t, r) {
  if (typeof e == "number" && typeof t == "number" && typeof r == "number")
    return On(e, t, r);
  if (typeof e == "object" && t === void 0 && r === void 0)
    return On(e.hue, e.saturation, e.lightness);
  throw new Ce(1);
}
o(_p, "hsl");
function $p(e, t, r, n) {
  if (typeof e == "number" && typeof t == "number" && typeof r == "number" && typeof n == "number")
    return n >= 1 ? On(e, t, r) : "rgba(" + Jr(e, t, r) + "," + n + ")";
  if (typeof e == "object" && t === void 0 && r === void 0 && n === void 0)
    return e.alpha >= 1 ? On(e.hue, e.saturation, e.lightness) : "rgba(" + Jr(e.hue, e.saturation, e.lightness) + "," + e.alpha + ")";
  throw new Ce(2);
}
o($p, "hsla");
function ra(e, t, r) {
  if (typeof e == "number" && typeof t == "number" && typeof r == "number")
    return ta("#" + Nt(e) + Nt(t) + Nt(r));
  if (typeof e == "object" && t === void 0 && r === void 0)
    return ta("#" + Nt(e.red) + Nt(e.green) + Nt(e.blue));
  throw new Ce(6);
}
o(ra, "rgb");
function Ft(e, t, r, n) {
  if (typeof e == "string" && typeof t == "number") {
    var a = cr(e);
    return "rgba(" + a.red + "," + a.green + "," + a.blue + "," + t + ")";
  } else {
    if (typeof e == "number" && typeof t == "number" && typeof r == "number" && typeof n == "number")
      return n >= 1 ? ra(e, t, r) : "rgba(" + e + "," + t + "," + r + "," + n + ")";
    if (typeof e == "object" && t === void 0 && r === void 0 && n === void 0)
      return e.alpha >= 1 ? ra(e.red, e.green, e.blue) : "rgba(" + e.red + "," + e.green + "," + e.blue + "," + e.alpha + ")";
  }
  throw new Ce(7);
}
o(Ft, "rgba");
var Vp = /* @__PURE__ */ o(function(t) {
  return typeof t.red == "number" && typeof t.green == "number" && typeof t.blue == "number" && (typeof t.alpha != "number" || typeof t.alpha >
  "u");
}, "isRgb"), jp = /* @__PURE__ */ o(function(t) {
  return typeof t.red == "number" && typeof t.green == "number" && typeof t.blue == "number" && typeof t.alpha == "number";
}, "isRgba"), Wp = /* @__PURE__ */ o(function(t) {
  return typeof t.hue == "number" && typeof t.saturation == "number" && typeof t.lightness == "number" && (typeof t.alpha != "number" || typeof t.
  alpha > "u");
}, "isHsl"), Up = /* @__PURE__ */ o(function(t) {
  return typeof t.hue == "number" && typeof t.saturation == "number" && typeof t.lightness == "number" && typeof t.alpha == "number";
}, "isHsla");
function vt(e) {
  if (typeof e != "object") throw new Ce(8);
  if (jp(e)) return Ft(e);
  if (Vp(e)) return ra(e);
  if (Up(e)) return $p(e);
  if (Wp(e)) return _p(e);
  throw new Ce(8);
}
o(vt, "toColorString");
function $l(e, t, r) {
  return /* @__PURE__ */ o(function() {
    var a = r.concat(Array.prototype.slice.call(arguments));
    return a.length >= t ? e.apply(this, a) : $l(e, t, a);
  }, "fn");
}
o($l, "curried");
function He(e) {
  return $l(e, e.length, []);
}
o(He, "curry");
function qp(e, t) {
  if (t === "transparent") return t;
  var r = gt(t);
  return vt(W({}, r, {
    hue: r.hue + parseFloat(e)
  }));
}
o(qp, "adjustHue");
var u8 = He(qp);
function sr(e, t, r) {
  return Math.max(e, Math.min(t, r));
}
o(sr, "guard");
function Gp(e, t) {
  if (t === "transparent") return t;
  var r = gt(t);
  return vt(W({}, r, {
    lightness: sr(0, 1, r.lightness - parseFloat(e))
  }));
}
o(Gp, "darken");
var Yp = He(Gp), wt = Yp;
function Xp(e, t) {
  if (t === "transparent") return t;
  var r = gt(t);
  return vt(W({}, r, {
    saturation: sr(0, 1, r.saturation - parseFloat(e))
  }));
}
o(Xp, "desaturate");
var f8 = He(Xp);
function Zp(e, t) {
  if (t === "transparent") return t;
  var r = gt(t);
  return vt(W({}, r, {
    lightness: sr(0, 1, r.lightness + parseFloat(e))
  }));
}
o(Zp, "lighten");
var Kp = He(Zp), na = Kp;
function Jp(e, t, r) {
  if (t === "transparent") return r;
  if (r === "transparent") return t;
  if (e === 0) return r;
  var n = cr(t), a = W({}, n, {
    alpha: typeof n.alpha == "number" ? n.alpha : 1
  }), i = cr(r), c = W({}, i, {
    alpha: typeof i.alpha == "number" ? i.alpha : 1
  }), l = a.alpha - c.alpha, s = parseFloat(e) * 2 - 1, u = s * l === -1 ? s : s + l, f = 1 + s * l, d = (u / f + 1) / 2, m = 1 - d, v = {
    red: Math.floor(a.red * d + c.red * m),
    green: Math.floor(a.green * d + c.green * m),
    blue: Math.floor(a.blue * d + c.blue * m),
    alpha: a.alpha * parseFloat(e) + c.alpha * (1 - parseFloat(e))
  };
  return Ft(v);
}
o(Jp, "mix");
var Qp = He(Jp), Vl = Qp;
function e2(e, t) {
  if (t === "transparent") return t;
  var r = cr(t), n = typeof r.alpha == "number" ? r.alpha : 1, a = W({}, r, {
    alpha: sr(0, 1, (n * 100 + parseFloat(e) * 100) / 100)
  });
  return Ft(a);
}
o(e2, "opacify");
var d8 = He(e2);
function t2(e, t) {
  if (t === "transparent") return t;
  var r = gt(t);
  return vt(W({}, r, {
    saturation: sr(0, 1, r.saturation + parseFloat(e))
  }));
}
o(t2, "saturate");
var p8 = He(t2);
function r2(e, t) {
  return t === "transparent" ? t : vt(W({}, gt(t), {
    hue: parseFloat(e)
  }));
}
o(r2, "setHue");
var m8 = He(r2);
function n2(e, t) {
  return t === "transparent" ? t : vt(W({}, gt(t), {
    lightness: parseFloat(e)
  }));
}
o(n2, "setLightness");
var h8 = He(n2);
function o2(e, t) {
  return t === "transparent" ? t : vt(W({}, gt(t), {
    saturation: parseFloat(e)
  }));
}
o(o2, "setSaturation");
var g8 = He(o2);
function a2(e, t) {
  return t === "transparent" ? t : Vl(parseFloat(e), "rgb(0, 0, 0)", t);
}
o(a2, "shade");
var v8 = He(a2);
function i2(e, t) {
  return t === "transparent" ? t : Vl(parseFloat(e), "rgb(255, 255, 255)", t);
}
o(i2, "tint");
var w8 = He(i2);
function l2(e, t) {
  if (t === "transparent") return t;
  var r = cr(t), n = typeof r.alpha == "number" ? r.alpha : 1, a = W({}, r, {
    alpha: sr(0, 1, +(n * 100 - parseFloat(e) * 100).toFixed(2) / 100)
  });
  return Ft(a);
}
o(l2, "transparentize");
var c2 = He(l2), we = c2;

// src/components/components/typography/lib/common.tsx
var Ne = /* @__PURE__ */ o(({ theme: e }) => ({
  margin: "20px 0 8px",
  padding: 0,
  cursor: "text",
  position: "relative",
  color: e.color.defaultText,
  "&:first-of-type": {
    marginTop: 0,
    paddingTop: 0
  },
  "&:hover a.anchor": {
    textDecoration: "none"
  },
  "& tt, & code": {
    fontSize: "inherit"
  }
}), "headerCommon"), at = /* @__PURE__ */ o(({ theme: e }) => ({
  lineHeight: 1,
  margin: "0 2px",
  padding: "3px 5px",
  whiteSpace: "nowrap",
  borderRadius: 3,
  fontSize: e.typography.size.s2 - 1,
  border: e.base === "light" ? `1px solid ${e.color.mediumlight}` : `1px solid ${e.color.darker}`,
  color: e.base === "light" ? we(0.1, e.color.defaultText) : we(0.3, e.color.defaultText),
  backgroundColor: e.base === "light" ? e.color.lighter : e.color.border
}), "codeCommon"), N = /* @__PURE__ */ o(({ theme: e }) => ({
  fontFamily: e.typography.fonts.base,
  fontSize: e.typography.size.s3,
  margin: 0,
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
  WebkitTapHighlightColor: "rgba(0, 0, 0, 0)",
  WebkitOverflowScrolling: "touch"
}), "withReset"), Me = {
  margin: "16px 0"
};

// src/components/components/typography/ResetWrapper.tsx
var jl = s2.div(N);

// src/components/components/typography/elements/A.tsx
import { styled as f2 } from "storybook/theming";

// src/components/components/typography/elements/Link.tsx
import u2 from "react";
var Wl = /* @__PURE__ */ o(({
  href: e = "",
  ...t
}) => {
  let n = /^\//.test(e) ? `./?path=${e}` : e, i = /^#.*/.test(e) ? "_self" : "_top";
  return /* @__PURE__ */ u2.createElement("a", { href: n, target: i, ...t });
}, "Link");

// src/components/components/typography/elements/A.tsx
var oa = f2(Wl)(N, ({ theme: e }) => ({
  fontSize: "inherit",
  lineHeight: "24px",
  color: e.color.secondary,
  textDecoration: "none",
  "&.absent": {
    color: "#cc0000"
  },
  "&.anchor": {
    display: "block",
    paddingLeft: 30,
    marginLeft: -30,
    cursor: "pointer",
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0
  }
}));

// src/components/components/typography/elements/Blockquote.tsx
import { styled as d2 } from "storybook/theming";
var aa = d2.blockquote(N, Me, ({ theme: e }) => ({
  borderLeft: `4px solid ${e.color.medium}`,
  padding: "0 15px",
  color: e.color.dark,
  "& > :first-of-type": {
    marginTop: 0
  },
  "& > :last-child": {
    marginBottom: 0
  }
}));

// src/components/components/typography/elements/Code.tsx
un();
import W5, { Children as bh } from "react";
import { styled as U5 } from "storybook/theming";

// src/components/components/typography/lib/isReactChildString.tsx
var j5 = /* @__PURE__ */ o((e) => typeof e == "string", "isReactChildString");

// src/components/components/typography/elements/Code.tsx
var yh = /[\n\r]/g, Rh = U5.code(
  ({ theme: e }) => ({
    // from reset
    fontFamily: e.typography.fonts.mono,
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
    display: "inline-block",
    paddingLeft: 2,
    paddingRight: 2,
    verticalAlign: "baseline",
    color: "inherit"
  }),
  at
), xh = U5(sn)(({ theme: e }) => ({
  // DocBlocks-specific styling and overrides
  fontFamily: e.typography.fonts.mono,
  fontSize: `${e.typography.size.s2 - 1}px`,
  lineHeight: "19px",
  margin: "25px 0 40px",
  borderRadius: e.appBorderRadius,
  boxShadow: e.base === "light" ? "rgba(0, 0, 0, 0.10) 0 1px 3px 0" : "rgba(0, 0, 0, 0.20) 0 2px 5px 0",
  "pre.prismjs": {
    padding: 20,
    background: "inherit"
  }
})), ii = /* @__PURE__ */ o(({
  className: e,
  children: t,
  ...r
}) => {
  let n = (e || "").match(/lang-(\S+)/), a = bh.toArray(t);
  return a.filter(j5).some((c) => c.match(yh)) ? /* @__PURE__ */ W5.createElement(
    xh,
    {
      bordered: !0,
      copyable: !0,
      language: n?.[1] ?? "text",
      format: !1,
      ...r
    },
    t
  ) : /* @__PURE__ */ W5.createElement(Rh, { ...r, className: e }, a);
}, "Code");

// src/components/components/typography/elements/DL.tsx
import { styled as Eh } from "storybook/theming";
var li = Eh.dl(N, Me, {
  padding: 0,
  "& dt": {
    fontSize: "14px",
    fontWeight: "bold",
    fontStyle: "italic",
    padding: 0,
    margin: "16px 0 4px"
  },
  "& dt:first-of-type": {
    padding: 0
  },
  "& dt > :first-of-type": {
    marginTop: 0
  },
  "& dt > :last-child": {
    marginBottom: 0
  },
  "& dd": {
    margin: "0 0 16px",
    padding: "0 15px"
  },
  "& dd > :first-of-type": {
    marginTop: 0
  },
  "& dd > :last-child": {
    marginBottom: 0
  }
});

// src/components/components/typography/elements/Div.tsx
import { styled as Sh } from "storybook/theming";
var ci = Sh.div(N);

// src/components/components/typography/elements/H1.tsx
import { styled as Ch } from "storybook/theming";
var si = Ch.h1(N, Ne, ({ theme: e }) => ({
  fontSize: `${e.typography.size.l1}px`,
  fontWeight: e.typography.weight.bold
}));

// src/components/components/typography/elements/H2.tsx
import { styled as Mh } from "storybook/theming";
var ui = Mh.h2(N, Ne, ({ theme: e }) => ({
  fontSize: `${e.typography.size.m2}px`,
  paddingBottom: 4,
  borderBottom: `1px solid ${e.appBorderColor}`
}));

// src/components/components/typography/elements/H3.tsx
import { styled as Ah } from "storybook/theming";
var fi = Ah.h3(N, Ne, ({ theme: e }) => ({
  fontSize: `${e.typography.size.m1}px`
}));

// src/components/components/typography/elements/H4.tsx
import { styled as Lh } from "storybook/theming";
var di = Lh.h4(N, Ne, ({ theme: e }) => ({
  fontSize: `${e.typography.size.s3}px`
}));

// src/components/components/typography/elements/H5.tsx
import { styled as Ih } from "storybook/theming";
var pi = Ih.h5(N, Ne, ({ theme: e }) => ({
  fontSize: `${e.typography.size.s2}px`
}));

// src/components/components/typography/elements/H6.tsx
import { styled as zh } from "storybook/theming";
var mi = zh.h6(N, Ne, ({ theme: e }) => ({
  fontSize: `${e.typography.size.s2}px`,
  color: e.color.dark
}));

// src/components/components/typography/elements/HR.tsx
import { styled as Th } from "storybook/theming";
var hi = Th.hr(({ theme: e }) => ({
  border: "0 none",
  borderTop: `1px solid ${e.appBorderColor}`,
  height: 4,
  padding: 0
}));

// src/components/components/typography/elements/Img.tsx
import { styled as Hh } from "storybook/theming";
var gi = Hh.img({
  maxWidth: "100%"
});

// src/components/components/typography/elements/LI.tsx
import { styled as Ph } from "storybook/theming";
var vi = Ph.li(N, ({ theme: e }) => ({
  fontSize: e.typography.size.s2,
  color: e.color.defaultText,
  lineHeight: "24px",
  "& + li": {
    marginTop: ".25em"
  },
  "& ul, & ol": {
    marginTop: ".25em",
    marginBottom: 0
  },
  "& code": at({ theme: e })
}));

// src/components/components/typography/elements/OL.tsx
import { styled as kh } from "storybook/theming";
var Oh = {
  paddingLeft: 30,
  "& :first-of-type": {
    marginTop: 0
  },
  "& :last-child": {
    marginBottom: 0
  }
}, wi = kh.ol(N, Me, Oh, {
  listStyle: "decimal"
});

// src/components/components/typography/elements/P.tsx
import { styled as Bh } from "storybook/theming";
var bi = Bh.p(N, Me, ({ theme: e }) => ({
  fontSize: e.typography.size.s2,
  lineHeight: "24px",
  color: e.color.defaultText,
  "& code": at({ theme: e })
}));

// src/components/components/typography/elements/Pre.tsx
import { styled as Nh } from "storybook/theming";
var yi = Nh.pre(N, Me, ({ theme: e }) => ({
  // reset
  fontFamily: e.typography.fonts.mono,
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
  lineHeight: "18px",
  padding: "11px 1rem",
  whiteSpace: "pre-wrap",
  color: "inherit",
  borderRadius: 3,
  margin: "1rem 0",
  "&:not(.prismjs)": {
    background: "transparent",
    border: "none",
    borderRadius: 0,
    padding: 0,
    margin: 0
  },
  "& pre, &.prismjs": {
    padding: 15,
    margin: 0,
    whiteSpace: "pre-wrap",
    color: "inherit",
    fontSize: "13px",
    lineHeight: "19px",
    code: {
      color: "inherit",
      fontSize: "inherit"
    }
  },
  "& code": {
    whiteSpace: "pre"
  },
  "& code, & tt": {
    border: "none"
  }
}));

// src/components/components/typography/elements/Span.tsx
import { styled as Fh } from "storybook/theming";
var Ri = Fh.span(N, ({ theme: e }) => ({
  "&.frame": {
    display: "block",
    overflow: "hidden",
    "& > span": {
      border: `1px solid ${e.color.medium}`,
      display: "block",
      float: "left",
      overflow: "hidden",
      margin: "13px 0 0",
      padding: 7,
      width: "auto"
    },
    "& span img": {
      display: "block",
      float: "left"
    },
    "& span span": {
      clear: "both",
      color: e.color.darkest,
      display: "block",
      padding: "5px 0 0"
    }
  },
  "&.align-center": {
    display: "block",
    overflow: "hidden",
    clear: "both",
    "& > span": {
      display: "block",
      overflow: "hidden",
      margin: "13px auto 0",
      textAlign: "center"
    },
    "& span img": {
      margin: "0 auto",
      textAlign: "center"
    }
  },
  "&.align-right": {
    display: "block",
    overflow: "hidden",
    clear: "both",
    "& > span": {
      display: "block",
      overflow: "hidden",
      margin: "13px 0 0",
      textAlign: "right"
    },
    "& span img": {
      margin: 0,
      textAlign: "right"
    }
  },
  "&.float-left": {
    display: "block",
    marginRight: 13,
    overflow: "hidden",
    float: "left",
    "& span": {
      margin: "13px 0 0"
    }
  },
  "&.float-right": {
    display: "block",
    marginLeft: 13,
    overflow: "hidden",
    float: "right",
    "& > span": {
      display: "block",
      overflow: "hidden",
      margin: "13px auto 0",
      textAlign: "right"
    }
  }
}));

// src/components/components/typography/elements/TT.tsx
import { styled as Dh } from "storybook/theming";
var xi = Dh.title(at);

// src/components/components/typography/elements/Table.tsx
import { styled as _h } from "storybook/theming";
var Ei = _h.table(N, Me, ({ theme: e }) => ({
  fontSize: e.typography.size.s2,
  lineHeight: "24px",
  padding: 0,
  borderCollapse: "collapse",
  "& tr": {
    borderTop: `1px solid ${e.appBorderColor}`,
    backgroundColor: e.appContentBg,
    margin: 0,
    padding: 0
  },
  "& tr:nth-of-type(2n)": {
    backgroundColor: e.base === "dark" ? e.color.darker : e.color.lighter
  },
  "& tr th": {
    fontWeight: "bold",
    color: e.color.defaultText,
    border: `1px solid ${e.appBorderColor}`,
    margin: 0,
    padding: "6px 13px"
  },
  "& tr td": {
    border: `1px solid ${e.appBorderColor}`,
    color: e.color.defaultText,
    margin: 0,
    padding: "6px 13px"
  },
  "& tr th :first-of-type, & tr td :first-of-type": {
    marginTop: 0
  },
  "& tr th :last-child, & tr td :last-child": {
    marginBottom: 0
  }
}));

// src/components/components/typography/elements/UL.tsx
import { styled as $h } from "storybook/theming";
var Vh = {
  paddingLeft: 30,
  "& :first-of-type": {
    marginTop: 0
  },
  "& :last-child": {
    marginBottom: 0
  }
}, Si = $h.ul(N, Me, Vh, { listStyle: "disc" });

// src/components/components/typography/components.tsx
var Ci = {
  h1: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(si, { ...J(e, "h1") }), "h1"),
  h2: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(ui, { ...J(e, "h2") }), "h2"),
  h3: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(fi, { ...J(e, "h3") }), "h3"),
  h4: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(di, { ...J(e, "h4") }), "h4"),
  h5: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(pi, { ...J(e, "h5") }), "h5"),
  h6: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(mi, { ...J(e, "h6") }), "h6"),
  pre: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(yi, { ...J(e, "pre") }), "pre"),
  a: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(oa, { ...J(e, "a") }), "a"),
  hr: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(hi, { ...J(e, "hr") }), "hr"),
  dl: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(li, { ...J(e, "dl") }), "dl"),
  blockquote: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(aa, { ...J(e, "blockquote") }), "blockquote"),
  table: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(Ei, { ...J(e, "table") }), "table"),
  img: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(gi, { ...J(e, "img") }), "img"),
  div: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(ci, { ...J(e, "div") }), "div"),
  span: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(Ri, { ...J(e, "span") }), "span"),
  li: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(vi, { ...J(e, "li") }), "li"),
  ul: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(Si, { ...J(e, "ul") }), "ul"),
  ol: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(wi, { ...J(e, "ol") }), "ol"),
  p: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(bi, { ...J(e, "p") }), "p"),
  code: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(ii, { ...J(e, "code") }), "code"),
  tt: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(xi, { ...J(e, "tt") }), "tt"),
  resetwrapper: /* @__PURE__ */ o((e) => /* @__PURE__ */ ee.createElement(jl, { ...J(e, "resetwrapper") }), "resetwrapper")
};

// src/components/components/Badge/Badge.tsx
import Wh from "react";
import { styled as Uh } from "storybook/theming";
var qh = Uh.div(
  ({ theme: e, compact: t }) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: e.typography.size.s1,
    fontWeight: e.typography.weight.bold,
    lineHeight: "12px",
    minWidth: 20,
    borderRadius: 20,
    padding: t ? "4px 7px" : "4px 10px"
  }),
  {
    svg: {
      height: 12,
      width: 12,
      marginRight: 4,
      marginTop: -2,
      path: {
        fill: "currentColor"
      }
    }
  },
  ({ theme: e, status: t }) => {
    switch (t) {
      case "critical":
        return {
          color: e.color.critical,
          background: e.background.critical
        };
      case "negative":
        return {
          color: e.color.negativeText,
          background: e.background.negative,
          boxShadow: e.base === "light" ? `inset 0 0 0 1px ${we(0.9, e.color.negativeText)}` : "none"
        };
      case "warning":
        return {
          color: e.color.warningText,
          background: e.background.warning,
          boxShadow: e.base === "light" ? `inset 0 0 0 1px ${we(0.9, e.color.warningText)}` : "none"
        };
      case "neutral":
        return {
          color: e.textMutedColor,
          background: e.base === "light" ? e.background.app : e.barBg,
          boxShadow: `inset 0 0 0 1px ${we(0.8, e.textMutedColor)}`
        };
      case "positive":
        return {
          color: e.color.positiveText,
          background: e.background.positive,
          boxShadow: e.base === "light" ? `inset 0 0 0 1px ${we(0.9, e.color.positiveText)}` : "none"
        };
      case "active":
        return {
          color: e.color.secondary,
          background: e.background.hoverable,
          boxShadow: `inset 0 0 0 1px ${we(0.9, e.color.secondary)}`
        };
      default:
        return {};
    }
  }
), Gh = /* @__PURE__ */ o(({ ...e }) => /* @__PURE__ */ Wh.createElement(qh, { ...e }), "Badge");

// src/components/components/typography/link/link.tsx
import Mi from "react";

// ../node_modules/@storybook/icons/dist/index.mjs
import * as Ye from "react";
var q5 = /* @__PURE__ */ Ye.forwardRef(({ color: e = "currentColor", size: t = 14, ...r }, n) => /* @__PURE__ */ Ye.createElement(
  "svg",
  {
    width: t,
    height: t,
    viewBox: "0 0 14 14",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    ref: n,
    ...r
  },
  /* @__PURE__ */ Ye.createElement(
    "path",
    {
      d: "M10.139 8.725l1.36-1.323a.568.568 0 00.151-.54.534.534 0 00-.377-.396l-2.705-.708 2.22-4.976a.568.568 0 00-.15-.666.497.497 0 00-.\
648.008L5.464 4.05l.708.71 2.848-2.47-1.64 3.677.697.697 2.164.567-.81.787.708.708zM2.523 6.6a.566.566 0 00-.177.544.534.534 0 00.382.41l2.7\
82.721-1.494 5.013a.563.563 0 00.217.627.496.496 0 00.629-.06l3.843-3.736-.708-.707-2.51 2.44 1.137-3.814-.685-.685-2.125-.55.844-.731-.71-.\
71L2.524 6.6zM1.854 1.146a.5.5 0 10-.708.708l11 11a.5.5 0 00.708-.708l-11-11z",
      fill: e
    }
  )
));
var G5 = /* @__PURE__ */ Ye.forwardRef(({ color: e = "currentColor", size: t = 14, ...r }, n) => /* @__PURE__ */ Ye.createElement(
  "svg",
  {
    width: t,
    height: t,
    viewBox: "0 0 14 14",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    ref: n,
    ...r
  },
  /* @__PURE__ */ Ye.createElement(
    "path",
    {
      d: "M1.854 1.146a.5.5 0 10-.708.708L6.293 7l-5.147 5.146a.5.5 0 00.708.708L7 7.707l5.146 5.147a.5.5 0 00.708-.708L7.707 7l5.147-5.146a\
.5.5 0 00-.708-.708L7 6.293 1.854 1.146z",
      fill: e
    }
  )
));
var Y5 = /* @__PURE__ */ Ye.forwardRef(({ color: e = "currentColor", size: t = 14, ...r }, n) => /* @__PURE__ */ Ye.createElement(
  "svg",
  {
    width: t,
    height: t,
    viewBox: "0 0 14 14",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    ref: n,
    ...r
  },
  /* @__PURE__ */ Ye.createElement(
    "path",
    {
      d: "M11.104 7.354l-5.5 5.5a.5.5 0 01-.708-.708L10.043 7 4.896 1.854a.5.5 0 11.708-.708l5.5 5.5a.5.5 0 010 .708z",
      fill: e
    }
  )
));

// src/components/components/typography/link/link.tsx
import { styled as X5 } from "storybook/theming";
var Yh = 0, Xh = /* @__PURE__ */ o((e) => e.button === Yh && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey, "isPlainLeftClick"), Zh = /* @__PURE__ */ o(
(e, t) => {
  Xh(e) && (e.preventDefault(), t(e));
}, "cancelled"), Kh = X5.span(
  ({ withArrow: e }) => e ? {
    "> svg:last-of-type": {
      height: "0.7em",
      width: "0.7em",
      marginRight: 0,
      marginLeft: "0.25em",
      bottom: "auto",
      verticalAlign: "inherit"
    }
  } : {},
  ({ containsIcon: e }) => e ? {
    svg: {
      height: "1em",
      width: "1em",
      verticalAlign: "middle",
      position: "relative",
      bottom: 0,
      marginRight: 0
    }
  } : {}
), Jh = X5.a(
  ({ theme: e }) => ({
    display: "inline-block",
    transition: "all 150ms ease-out",
    textDecoration: "none",
    color: e.color.secondary,
    "&:hover, &:focus": {
      cursor: "pointer",
      color: wt(0.07, e.color.secondary),
      "svg path:not([fill])": {
        fill: wt(0.07, e.color.secondary)
      }
    },
    "&:active": {
      color: wt(0.1, e.color.secondary),
      "svg path:not([fill])": {
        fill: wt(0.1, e.color.secondary)
      }
    },
    svg: {
      display: "inline-block",
      height: "1em",
      width: "1em",
      verticalAlign: "text-top",
      position: "relative",
      bottom: "-0.125em",
      marginRight: "0.4em",
      "& path": {
        fill: e.color.secondary
      }
    }
  }),
  ({ theme: e, secondary: t, tertiary: r }) => {
    let n;
    return t && (n = [e.textMutedColor, e.color.dark, e.color.darker]), r && (n = [e.color.dark, e.color.darkest, e.textMutedColor]), n ? {
      color: n[0],
      "svg path:not([fill])": {
        fill: n[0]
      },
      "&:hover": {
        color: n[1],
        "svg path:not([fill])": {
          fill: n[1]
        }
      },
      "&:active": {
        color: n[2],
        "svg path:not([fill])": {
          fill: n[2]
        }
      }
    } : {};
  },
  ({ nochrome: e }) => e ? {
    color: "inherit",
    "&:hover, &:active": {
      color: "inherit",
      textDecoration: "underline"
    }
  } : {},
  ({ theme: e, inverse: t }) => t ? {
    color: e.color.lightest,
    ":not([fill])": {
      fill: e.color.lightest
    },
    "&:hover": {
      color: e.color.lighter,
      "svg path:not([fill])": {
        fill: e.color.lighter
      }
    },
    "&:active": {
      color: e.color.light,
      "svg path:not([fill])": {
        fill: e.color.light
      }
    }
  } : {},
  ({ isButton: e }) => e ? {
    border: 0,
    borderRadius: 0,
    background: "none",
    padding: 0,
    fontSize: "inherit"
  } : {}
), Ai = /* @__PURE__ */ o(({
  cancel: e = !0,
  children: t,
  onClick: r = void 0,
  withArrow: n = !1,
  containsIcon: a = !1,
  className: i = void 0,
  style: c = void 0,
  ...l
}) => /* @__PURE__ */ Mi.createElement(
  Jh,
  {
    ...l,
    onClick: r && e ? (s) => Zh(s, r) : r,
    className: i
  },
  /* @__PURE__ */ Mi.createElement(Kh, { withArrow: n, containsIcon: a }, t, n && /* @__PURE__ */ Mi.createElement(Y5, null))
), "Link");

// src/components/components/typography/DocumentWrapper.tsx
import { styled as Qh } from "storybook/theming";
var eg = Qh.div(({ theme: e }) => ({
  fontSize: `${e.typography.size.s2}px`,
  lineHeight: "1.6",
  h1: {
    fontSize: `${e.typography.size.l1}px`,
    fontWeight: e.typography.weight.bold
  },
  h2: {
    fontSize: `${e.typography.size.m2}px`,
    borderBottom: `1px solid ${e.appBorderColor}`
  },
  h3: {
    fontSize: `${e.typography.size.m1}px`
  },
  h4: {
    fontSize: `${e.typography.size.s3}px`
  },
  h5: {
    fontSize: `${e.typography.size.s2}px`
  },
  h6: {
    fontSize: `${e.typography.size.s2}px`,
    color: e.color.dark
  },
  "pre:not(.prismjs)": {
    background: "transparent",
    border: "none",
    borderRadius: 0,
    padding: 0,
    margin: 0
  },
  "pre pre, pre.prismjs": {
    padding: 15,
    margin: 0,
    whiteSpace: "pre-wrap",
    color: "inherit",
    fontSize: "13px",
    lineHeight: "19px"
  },
  "pre pre code, pre.prismjs code": {
    color: "inherit",
    fontSize: "inherit"
  },
  "pre code": {
    margin: 0,
    padding: 0,
    whiteSpace: "pre",
    border: "none",
    background: "transparent"
  },
  "pre code, pre tt": {
    backgroundColor: "transparent",
    border: "none"
  },
  /* GitHub inspired Markdown styles loosely from https://gist.github.com/tuzz/3331384 */
  "body > *:first-of-type": {
    marginTop: "0 !important"
  },
  "body > *:last-child": {
    marginBottom: "0 !important"
  },
  a: {
    color: e.color.secondary,
    textDecoration: "none"
  },
  "a.absent": {
    color: "#cc0000"
  },
  "a.anchor": {
    display: "block",
    paddingLeft: 30,
    marginLeft: -30,
    cursor: "pointer",
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0
  },
  "h1, h2, h3, h4, h5, h6": {
    margin: "20px 0 10px",
    padding: 0,
    cursor: "text",
    position: "relative",
    "&:first-of-type": {
      marginTop: 0,
      paddingTop: 0
    },
    "&:hover a.anchor": {
      textDecoration: "none"
    },
    "& tt, & code": {
      fontSize: "inherit"
    }
  },
  "h1:first-of-type + h2": {
    marginTop: 0,
    paddingTop: 0
  },
  "p, blockquote, ul, ol, dl, li, table, pre": {
    margin: "15px 0"
  },
  hr: {
    border: "0 none",
    borderTop: `1px solid ${e.appBorderColor}`,
    height: 4,
    padding: 0
  },
  "body > h1:first-of-type, body > h2:first-of-type, body > h3:first-of-type, body > h4:first-of-type, body > h5:first-of-type, body > h6:fi\
rst-of-type": {
    marginTop: 0,
    paddingTop: 0
  },
  "body > h1:first-of-type + h2": {
    marginTop: 0,
    paddingTop: 0
  },
  "a:first-of-type h1, a:first-of-type h2, a:first-of-type h3, a:first-of-type h4, a:first-of-type h5, a:first-of-type h6": {
    marginTop: 0,
    paddingTop: 0
  },
  "h1 p, h2 p, h3 p, h4 p, h5 p, h6 p": {
    marginTop: 0
  },
  "li p.first": {
    display: "inline-block"
  },
  "ul, ol": {
    paddingLeft: 30,
    "& :first-of-type": {
      marginTop: 0
    },
    "& :last-child": {
      marginBottom: 0
    }
  },
  dl: {
    padding: 0
  },
  "dl dt": {
    fontSize: "14px",
    fontWeight: "bold",
    fontStyle: "italic",
    margin: "0 0 15px",
    padding: "0 15px",
    "&:first-of-type": {
      padding: 0
    },
    "& > :first-of-type": {
      marginTop: 0
    },
    "& > :last-child": {
      marginBottom: 0
    }
  },
  blockquote: {
    borderLeft: `4px solid ${e.color.medium}`,
    padding: "0 15px",
    color: e.color.dark,
    "& > :first-of-type": {
      marginTop: 0
    },
    "& > :last-child": {
      marginBottom: 0
    }
  },
  table: {
    padding: 0,
    borderCollapse: "collapse",
    "& tr": {
      borderTop: `1px solid ${e.appBorderColor}`,
      backgroundColor: "white",
      margin: 0,
      padding: 0,
      "& th": {
        fontWeight: "bold",
        border: `1px solid ${e.appBorderColor}`,
        textAlign: "left",
        margin: 0,
        padding: "6px 13px"
      },
      "& td": {
        border: `1px solid ${e.appBorderColor}`,
        textAlign: "left",
        margin: 0,
        padding: "6px 13px"
      },
      "&:nth-of-type(2n)": {
        backgroundColor: e.color.lighter
      },
      "& th :first-of-type, & td :first-of-type": {
        marginTop: 0
      },
      "& th :last-child, & td :last-child": {
        marginBottom: 0
      }
    }
  },
  img: {
    maxWidth: "100%"
  },
  "span.frame": {
    display: "block",
    overflow: "hidden",
    "& > span": {
      border: `1px solid ${e.color.medium}`,
      display: "block",
      float: "left",
      overflow: "hidden",
      margin: "13px 0 0",
      padding: 7,
      width: "auto"
    },
    "& span img": {
      display: "block",
      float: "left"
    },
    "& span span": {
      clear: "both",
      color: e.color.darkest,
      display: "block",
      padding: "5px 0 0"
    }
  },
  "span.align-center": {
    display: "block",
    overflow: "hidden",
    clear: "both",
    "& > span": {
      display: "block",
      overflow: "hidden",
      margin: "13px auto 0",
      textAlign: "center"
    },
    "& span img": {
      margin: "0 auto",
      textAlign: "center"
    }
  },
  "span.align-right": {
    display: "block",
    overflow: "hidden",
    clear: "both",
    "& > span": {
      display: "block",
      overflow: "hidden",
      margin: "13px 0 0",
      textAlign: "right"
    },
    "& span img": {
      margin: 0,
      textAlign: "right"
    }
  },
  "span.float-left": {
    display: "block",
    marginRight: 13,
    overflow: "hidden",
    float: "left",
    "& span": {
      margin: "13px 0 0"
    }
  },
  "span.float-right": {
    display: "block",
    marginLeft: 13,
    overflow: "hidden",
    float: "right",
    "& > span": {
      display: "block",
      overflow: "hidden",
      margin: "13px auto 0",
      textAlign: "right"
    }
  },
  "code, tt": {
    margin: "0 2px",
    padding: "0 5px",
    whiteSpace: "nowrap",
    border: `1px solid ${e.color.mediumlight}`,
    backgroundColor: e.color.lighter,
    borderRadius: 3,
    color: e.base === "dark" ? e.color.darkest : e.color.dark
  }
}));

// src/components/components/syntaxhighlighter/lazy-syntaxhighlighter.tsx
import Rr, { Suspense as rg, lazy as tu } from "react";
var Ut = [], xr = null, ng = tu(async () => {
  let { SyntaxHighlighter: e } = await Promise.resolve().then(() => (un(), ai));
  return Ut.length > 0 && (Ut.forEach((t) => {
    e.registerLanguage(...t);
  }), Ut = []), xr === null && (xr = e), {
    default: /* @__PURE__ */ o((t) => /* @__PURE__ */ Rr.createElement(e, { ...t }), "default")
  };
}), og = tu(async () => {
  let [{ SyntaxHighlighter: e }, { formatter: t }] = await Promise.all([
    Promise.resolve().then(() => (un(), ai)),
    Promise.resolve().then(() => (eu(), Q5))
  ]);
  return Ut.length > 0 && (Ut.forEach((r) => {
    e.registerLanguage(...r);
  }), Ut = []), xr === null && (xr = e), {
    default: /* @__PURE__ */ o((r) => /* @__PURE__ */ Rr.createElement(e, { ...r, formatter: t }), "default")
  };
}), ru = /* @__PURE__ */ o((e) => /* @__PURE__ */ Rr.createElement(rg, { fallback: /* @__PURE__ */ Rr.createElement("div", null) }, e.format !==
!1 ? /* @__PURE__ */ Rr.createElement(og, { ...e }) : /* @__PURE__ */ Rr.createElement(ng, { ...e })), "SyntaxHighlighter");
ru.registerLanguage = (...e) => {
  if (xr !== null) {
    xr.registerLanguage(...e);
    return;
  }
  Ut.push(e);
};

// src/components/index.ts
un();
Xa();

// src/components/components/Modal/Modal.tsx
import zr from "react";

// ../node_modules/@radix-ui/react-dialog/dist/index.mjs
var Ro = {};
Zr(Ro, {
  Close: () => h0,
  Content: () => d0,
  Description: () => m0,
  Dialog: () => Ji,
  DialogClose: () => l0,
  DialogContent: () => n0,
  DialogDescription: () => i0,
  DialogOverlay: () => r0,
  DialogPortal: () => t0,
  DialogTitle: () => a0,
  DialogTrigger: () => Qi,
  Overlay: () => f0,
  Portal: () => u0,
  Root: () => s0,
  Title: () => p0,
  Trigger: () => Rv,
  WarningProvider: () => vv,
  createDialogScope: () => uv
});
import * as q from "react";

// ../node_modules/@radix-ui/react-dialog/node_modules/@radix-ui/primitive/dist/index.mjs
function Er(e, t, { checkForDefaultPrevented: r = !0 } = {}) {
  return /* @__PURE__ */ o(function(a) {
    if (e?.(a), r === !1 || !a.defaultPrevented)
      return t?.(a);
  }, "handleEvent");
}
o(Er, "composeEventHandlers");

// ../node_modules/@radix-ui/react-compose-refs/dist/index.mjs
import * as ou from "react";
function nu(e, t) {
  if (typeof e == "function")
    return e(t);
  e != null && (e.current = t);
}
o(nu, "setRef");
function Li(...e) {
  return (t) => {
    let r = !1, n = e.map((a) => {
      let i = nu(a, t);
      return !r && typeof i == "function" && (r = !0), i;
    });
    if (r)
      return () => {
        for (let a = 0; a < n.length; a++) {
          let i = n[a];
          typeof i == "function" ? i() : nu(e[a], null);
        }
      };
  };
}
o(Li, "composeRefs");
function Xe(...e) {
  return ou.useCallback(Li(...e), e);
}
o(Xe, "useComposedRefs");

// ../node_modules/@radix-ui/react-dialog/node_modules/@radix-ui/react-context/dist/index.mjs
import * as $e from "react";
import { jsx as au } from "react/jsx-runtime";
function iu(e, t) {
  let r = $e.createContext(t), n = /* @__PURE__ */ o((i) => {
    let { children: c, ...l } = i, s = $e.useMemo(() => l, Object.values(l));
    return /* @__PURE__ */ au(r.Provider, { value: s, children: c });
  }, "Provider");
  n.displayName = e + "Provider";
  function a(i) {
    let c = $e.useContext(r);
    if (c) return c;
    if (t !== void 0) return t;
    throw new Error(`\`${i}\` must be used within \`${e}\``);
  }
  return o(a, "useContext2"), [n, a];
}
o(iu, "createContext2");
function lu(e, t = []) {
  let r = [];
  function n(i, c) {
    let l = $e.createContext(c), s = r.length;
    r = [...r, c];
    let u = /* @__PURE__ */ o((d) => {
      let { scope: m, children: v, ...y } = d, p = m?.[e]?.[s] || l, h = $e.useMemo(() => y, Object.values(y));
      return /* @__PURE__ */ au(p.Provider, { value: h, children: v });
    }, "Provider");
    u.displayName = i + "Provider";
    function f(d, m) {
      let v = m?.[e]?.[s] || l, y = $e.useContext(v);
      if (y) return y;
      if (c !== void 0) return c;
      throw new Error(`\`${d}\` must be used within \`${i}\``);
    }
    return o(f, "useContext2"), [u, f];
  }
  o(n, "createContext3");
  let a = /* @__PURE__ */ o(() => {
    let i = r.map((c) => $e.createContext(c));
    return /* @__PURE__ */ o(function(l) {
      let s = l?.[e] || i;
      return $e.useMemo(
        () => ({ [`__scope${e}`]: { ...l, [e]: s } }),
        [l, s]
      );
    }, "useScope");
  }, "createScope");
  return a.scopeName = e, [n, ag(a, ...t)];
}
o(lu, "createContextScope");
function ag(...e) {
  let t = e[0];
  if (e.length === 1) return t;
  let r = /* @__PURE__ */ o(() => {
    let n = e.map((a) => ({
      useScope: a(),
      scopeName: a.scopeName
    }));
    return /* @__PURE__ */ o(function(i) {
      let c = n.reduce((l, { useScope: s, scopeName: u }) => {
        let d = s(i)[`__scope${u}`];
        return { ...l, ...d };
      }, {});
      return $e.useMemo(() => ({ [`__scope${t.scopeName}`]: c }), [c]);
    }, "useComposedScopes");
  }, "createScope");
  return r.scopeName = t.scopeName, r;
}
o(ag, "composeContextScopes");

// ../node_modules/@radix-ui/react-dialog/node_modules/@radix-ui/react-id/dist/index.mjs
import * as Ii from "react";

// ../node_modules/@radix-ui/react-use-layout-effect/dist/index.mjs
import * as cu from "react";
var ct = globalThis?.document ? cu.useLayoutEffect : () => {
};

// ../node_modules/@radix-ui/react-dialog/node_modules/@radix-ui/react-id/dist/index.mjs
var ig = Ii[" useId ".trim().toString()] || (() => {
}), lg = 0;
function ao(e) {
  let [t, r] = Ii.useState(ig());
  return ct(() => {
    e || r((n) => n ?? String(lg++));
  }, [e]), e || (t ? `radix-${t}` : "");
}
o(ao, "useId");

// ../node_modules/@radix-ui/react-dialog/node_modules/@radix-ui/react-use-controllable-state/dist/index.mjs
import * as Ve from "react";
import * as io from "react";
var cg = Ve[" useInsertionEffect ".trim().toString()] || ct;
function su({
  prop: e,
  defaultProp: t,
  onChange: r = /* @__PURE__ */ o(() => {
  }, "onChange"),
  caller: n
}) {
  let [a, i, c] = sg({
    defaultProp: t,
    onChange: r
  }), l = e !== void 0, s = l ? e : a;
  {
    let f = Ve.useRef(e !== void 0);
    Ve.useEffect(() => {
      let d = f.current;
      d !== l && console.warn(
        `${n} is changing from ${d ? "controlled" : "uncontrolled"} to ${l ? "controlled" : "uncontrolled"}. Components should not switch fr\
om controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`
      ), f.current = l;
    }, [l, n]);
  }
  let u = Ve.useCallback(
    (f) => {
      if (l) {
        let d = ug(f) ? f(e) : f;
        d !== e && c.current?.(d);
      } else
        i(f);
    },
    [l, e, i, c]
  );
  return [s, u];
}
o(su, "useControllableState");
function sg({
  defaultProp: e,
  onChange: t
}) {
  let [r, n] = Ve.useState(e), a = Ve.useRef(r), i = Ve.useRef(t);
  return cg(() => {
    i.current = t;
  }, [t]), Ve.useEffect(() => {
    a.current !== r && (i.current?.(r), a.current = r);
  }, [r, a]), [r, n, i];
}
o(sg, "useUncontrolledState");
function ug(e) {
  return typeof e == "function";
}
o(ug, "isFunction");
var XE = Symbol("RADIX:SYNC_STATE");

// ../node_modules/@radix-ui/react-dismissable-layer/dist/index.mjs
import * as Q from "react";

// ../node_modules/@radix-ui/react-dismissable-layer/node_modules/@radix-ui/primitive/dist/index.mjs
function lo(e, t, { checkForDefaultPrevented: r = !0 } = {}) {
  return /* @__PURE__ */ o(function(a) {
    if (e?.(a), r === !1 || !a.defaultPrevented)
      return t?.(a);
  }, "handleEvent");
}
o(lo, "composeEventHandlers");

// ../node_modules/@radix-ui/react-primitive/dist/index.mjs
import * as du from "react";
import * as pu from "react-dom";

// ../node_modules/@radix-ui/react-slot/dist/index.mjs
import * as ie from "react";
import { Fragment as rS, jsx as uu } from "react/jsx-runtime";
// @__NO_SIDE_EFFECTS__
function fn(e) {
  let t = /* @__PURE__ */ fg(e), r = ie.forwardRef((n, a) => {
    let { children: i, ...c } = n, l = ie.Children.toArray(i), s = l.find(pg);
    if (s) {
      let u = s.props.children, f = l.map((d) => d === s ? ie.Children.count(u) > 1 ? ie.Children.only(null) : ie.isValidElement(u) ? u.props.
      children : null : d);
      return /* @__PURE__ */ uu(t, { ...c, ref: a, children: ie.isValidElement(u) ? ie.cloneElement(u, void 0, f) : null });
    }
    return /* @__PURE__ */ uu(t, { ...c, ref: a, children: i });
  });
  return r.displayName = `${e}.Slot`, r;
}
o(fn, "createSlot");
var fu = /* @__PURE__ */ fn("Slot");
// @__NO_SIDE_EFFECTS__
function fg(e) {
  let t = ie.forwardRef((r, n) => {
    let { children: a, ...i } = r;
    if (ie.isValidElement(a)) {
      let c = hg(a), l = mg(i, a.props);
      return a.type !== ie.Fragment && (l.ref = n ? Li(n, c) : c), ie.cloneElement(a, l);
    }
    return ie.Children.count(a) > 1 ? ie.Children.only(null) : null;
  });
  return t.displayName = `${e}.SlotClone`, t;
}
o(fg, "createSlotClone");
var dg = Symbol("radix.slottable");
function pg(e) {
  return ie.isValidElement(e) && typeof e.type == "function" && "__radixId" in e.type && e.type.__radixId === dg;
}
o(pg, "isSlottable");
function mg(e, t) {
  let r = { ...t };
  for (let n in t) {
    let a = e[n], i = t[n];
    /^on[A-Z]/.test(n) ? a && i ? r[n] = (...l) => {
      i(...l), a(...l);
    } : a && (r[n] = a) : n === "style" ? r[n] = { ...a, ...i } : n === "className" && (r[n] = [a, i].filter(Boolean).join(" "));
  }
  return { ...e, ...r };
}
o(mg, "mergeProps");
function hg(e) {
  let t = Object.getOwnPropertyDescriptor(e.props, "ref")?.get, r = t && "isReactWarning" in t && t.isReactWarning;
  return r ? e.ref : (t = Object.getOwnPropertyDescriptor(e, "ref")?.get, r = t && "isReactWarning" in t && t.isReactWarning, r ? e.props.ref :
  e.props.ref || e.ref);
}
o(hg, "getElementRef");

// ../node_modules/@radix-ui/react-primitive/dist/index.mjs
import { jsx as gg } from "react/jsx-runtime";
var vg = [
  "a",
  "button",
  "div",
  "form",
  "h2",
  "h3",
  "img",
  "input",
  "label",
  "li",
  "nav",
  "ol",
  "p",
  "select",
  "span",
  "svg",
  "ul"
], Pe = vg.reduce((e, t) => {
  let r = fn(`Primitive.${t}`), n = du.forwardRef((a, i) => {
    let { asChild: c, ...l } = a, s = c ? r : t;
    return typeof window < "u" && (window[Symbol.for("radix-ui")] = !0), /* @__PURE__ */ gg(s, { ...l, ref: i });
  });
  return n.displayName = `Primitive.${t}`, { ...e, [t]: n };
}, {});
function mu(e, t) {
  e && pu.flushSync(() => e.dispatchEvent(t));
}
o(mu, "dispatchDiscreteCustomEvent");

// ../node_modules/@radix-ui/react-use-callback-ref/dist/index.mjs
import * as Sr from "react";
function St(e) {
  let t = Sr.useRef(e);
  return Sr.useEffect(() => {
    t.current = e;
  }), Sr.useMemo(() => (...r) => t.current?.(...r), []);
}
o(St, "useCallbackRef");

// ../node_modules/@radix-ui/react-use-escape-keydown/dist/index.mjs
import * as hu from "react";
function gu(e, t = globalThis?.document) {
  let r = St(e);
  hu.useEffect(() => {
    let n = /* @__PURE__ */ o((a) => {
      a.key === "Escape" && r(a);
    }, "handleKeyDown");
    return t.addEventListener("keydown", n, { capture: !0 }), () => t.removeEventListener("keydown", n, { capture: !0 });
  }, [r, t]);
}
o(gu, "useEscapeKeydown");

// ../node_modules/@radix-ui/react-dismissable-layer/dist/index.mjs
import { jsx as bu } from "react/jsx-runtime";
var wg = "DismissableLayer", zi = "dismissableLayer.update", bg = "dismissableLayer.pointerDownOutside", yg = "dismissableLayer.focusOutside",
vu, yu = Q.createContext({
  layers: /* @__PURE__ */ new Set(),
  layersWithOutsidePointerEventsDisabled: /* @__PURE__ */ new Set(),
  branches: /* @__PURE__ */ new Set()
}), Ti = Q.forwardRef(
  (e, t) => {
    let {
      disableOutsidePointerEvents: r = !1,
      onEscapeKeyDown: n,
      onPointerDownOutside: a,
      onFocusOutside: i,
      onInteractOutside: c,
      onDismiss: l,
      ...s
    } = e, u = Q.useContext(yu), [f, d] = Q.useState(null), m = f?.ownerDocument ?? globalThis?.document, [, v] = Q.useState({}), y = Xe(t, (S) => d(
    S)), p = Array.from(u.layers), [h] = [...u.layersWithOutsidePointerEventsDisabled].slice(-1), g = p.indexOf(h), w = f ? p.indexOf(f) : -1,
    b = u.layersWithOutsidePointerEventsDisabled.size > 0, x = w >= g, E = Eg((S) => {
      let A = S.target, M = [...u.branches].some((L) => L.contains(A));
      !x || M || (a?.(S), c?.(S), S.defaultPrevented || l?.());
    }, m), R = Sg((S) => {
      let A = S.target;
      [...u.branches].some((L) => L.contains(A)) || (i?.(S), c?.(S), S.defaultPrevented || l?.());
    }, m);
    return gu((S) => {
      w === u.layers.size - 1 && (n?.(S), !S.defaultPrevented && l && (S.preventDefault(), l()));
    }, m), Q.useEffect(() => {
      if (f)
        return r && (u.layersWithOutsidePointerEventsDisabled.size === 0 && (vu = m.body.style.pointerEvents, m.body.style.pointerEvents = "\
none"), u.layersWithOutsidePointerEventsDisabled.add(f)), u.layers.add(f), wu(), () => {
          r && u.layersWithOutsidePointerEventsDisabled.size === 1 && (m.body.style.pointerEvents = vu);
        };
    }, [f, m, r, u]), Q.useEffect(() => () => {
      f && (u.layers.delete(f), u.layersWithOutsidePointerEventsDisabled.delete(f), wu());
    }, [f, u]), Q.useEffect(() => {
      let S = /* @__PURE__ */ o(() => v({}), "handleUpdate");
      return document.addEventListener(zi, S), () => document.removeEventListener(zi, S);
    }, []), /* @__PURE__ */ bu(
      Pe.div,
      {
        ...s,
        ref: y,
        style: {
          pointerEvents: b ? x ? "auto" : "none" : void 0,
          ...e.style
        },
        onFocusCapture: lo(e.onFocusCapture, R.onFocusCapture),
        onBlurCapture: lo(e.onBlurCapture, R.onBlurCapture),
        onPointerDownCapture: lo(
          e.onPointerDownCapture,
          E.onPointerDownCapture
        )
      }
    );
  }
);
Ti.displayName = wg;
var Rg = "DismissableLayerBranch", xg = Q.forwardRef((e, t) => {
  let r = Q.useContext(yu), n = Q.useRef(null), a = Xe(t, n);
  return Q.useEffect(() => {
    let i = n.current;
    if (i)
      return r.branches.add(i), () => {
        r.branches.delete(i);
      };
  }, [r.branches]), /* @__PURE__ */ bu(Pe.div, { ...e, ref: a });
});
xg.displayName = Rg;
function Eg(e, t = globalThis?.document) {
  let r = St(e), n = Q.useRef(!1), a = Q.useRef(() => {
  });
  return Q.useEffect(() => {
    let i = /* @__PURE__ */ o((l) => {
      if (l.target && !n.current) {
        let u = /* @__PURE__ */ o(function() {
          Ru(
            bg,
            r,
            f,
            { discrete: !0 }
          );
        }, "handleAndDispatchPointerDownOutsideEvent2");
        var s = u;
        let f = { originalEvent: l };
        l.pointerType === "touch" ? (t.removeEventListener("click", a.current), a.current = u, t.addEventListener("click", a.current, { once: !0 })) :
        u();
      } else
        t.removeEventListener("click", a.current);
      n.current = !1;
    }, "handlePointerDown"), c = window.setTimeout(() => {
      t.addEventListener("pointerdown", i);
    }, 0);
    return () => {
      window.clearTimeout(c), t.removeEventListener("pointerdown", i), t.removeEventListener("click", a.current);
    };
  }, [t, r]), {
    // ensures we check React component tree (not just DOM tree)
    onPointerDownCapture: /* @__PURE__ */ o(() => n.current = !0, "onPointerDownCapture")
  };
}
o(Eg, "usePointerDownOutside");
function Sg(e, t = globalThis?.document) {
  let r = St(e), n = Q.useRef(!1);
  return Q.useEffect(() => {
    let a = /* @__PURE__ */ o((i) => {
      i.target && !n.current && Ru(yg, r, { originalEvent: i }, {
        discrete: !1
      });
    }, "handleFocus");
    return t.addEventListener("focusin", a), () => t.removeEventListener("focusin", a);
  }, [t, r]), {
    onFocusCapture: /* @__PURE__ */ o(() => n.current = !0, "onFocusCapture"),
    onBlurCapture: /* @__PURE__ */ o(() => n.current = !1, "onBlurCapture")
  };
}
o(Sg, "useFocusOutside");
function wu() {
  let e = new CustomEvent(zi);
  document.dispatchEvent(e);
}
o(wu, "dispatchUpdate");
function Ru(e, t, r, { discrete: n }) {
  let a = r.originalEvent.target, i = new CustomEvent(e, { bubbles: !1, cancelable: !0, detail: r });
  t && a.addEventListener(e, t, { once: !0 }), n ? mu(a, i) : a.dispatchEvent(i);
}
o(Ru, "handleAndDispatchCustomEvent");

// ../node_modules/@radix-ui/react-focus-scope/dist/index.mjs
import * as je from "react";
import { jsx as Cg } from "react/jsx-runtime";
var Hi = "focusScope.autoFocusOnMount", Pi = "focusScope.autoFocusOnUnmount", xu = { bubbles: !1, cancelable: !0 }, Mg = "FocusScope", ki = je.forwardRef(
(e, t) => {
  let {
    loop: r = !1,
    trapped: n = !1,
    onMountAutoFocus: a,
    onUnmountAutoFocus: i,
    ...c
  } = e, [l, s] = je.useState(null), u = St(a), f = St(i), d = je.useRef(null), m = Xe(t, (p) => s(p)), v = je.useRef({
    paused: !1,
    pause() {
      this.paused = !0;
    },
    resume() {
      this.paused = !1;
    }
  }).current;
  je.useEffect(() => {
    if (n) {
      let w = /* @__PURE__ */ o(function(R) {
        if (v.paused || !l) return;
        let S = R.target;
        l.contains(S) ? d.current = S : Ct(d.current, { select: !0 });
      }, "handleFocusIn2"), b = /* @__PURE__ */ o(function(R) {
        if (v.paused || !l) return;
        let S = R.relatedTarget;
        S !== null && (l.contains(S) || Ct(d.current, { select: !0 }));
      }, "handleFocusOut2"), x = /* @__PURE__ */ o(function(R) {
        if (document.activeElement === document.body)
          for (let A of R)
            A.removedNodes.length > 0 && Ct(l);
      }, "handleMutations2");
      var p = w, h = b, g = x;
      document.addEventListener("focusin", w), document.addEventListener("focusout", b);
      let E = new MutationObserver(x);
      return l && E.observe(l, { childList: !0, subtree: !0 }), () => {
        document.removeEventListener("focusin", w), document.removeEventListener("focusout", b), E.disconnect();
      };
    }
  }, [n, l, v.paused]), je.useEffect(() => {
    if (l) {
      Su.add(v);
      let p = document.activeElement;
      if (!l.contains(p)) {
        let g = new CustomEvent(Hi, xu);
        l.addEventListener(Hi, u), l.dispatchEvent(g), g.defaultPrevented || (Ag(Hg(Mu(l)), { select: !0 }), document.activeElement === p &&
        Ct(l));
      }
      return () => {
        l.removeEventListener(Hi, u), setTimeout(() => {
          let g = new CustomEvent(Pi, xu);
          l.addEventListener(Pi, f), l.dispatchEvent(g), g.defaultPrevented || Ct(p ?? document.body, { select: !0 }), l.removeEventListener(
          Pi, f), Su.remove(v);
        }, 0);
      };
    }
  }, [l, u, f, v]);
  let y = je.useCallback(
    (p) => {
      if (!r && !n || v.paused) return;
      let h = p.key === "Tab" && !p.altKey && !p.ctrlKey && !p.metaKey, g = document.activeElement;
      if (h && g) {
        let w = p.currentTarget, [b, x] = Lg(w);
        b && x ? !p.shiftKey && g === x ? (p.preventDefault(), r && Ct(b, { select: !0 })) : p.shiftKey && g === b && (p.preventDefault(), r &&
        Ct(x, { select: !0 })) : g === w && p.preventDefault();
      }
    },
    [r, n, v.paused]
  );
  return /* @__PURE__ */ Cg(Pe.div, { tabIndex: -1, ...c, ref: m, onKeyDown: y });
});
ki.displayName = Mg;
function Ag(e, { select: t = !1 } = {}) {
  let r = document.activeElement;
  for (let n of e)
    if (Ct(n, { select: t }), document.activeElement !== r) return;
}
o(Ag, "focusFirst");
function Lg(e) {
  let t = Mu(e), r = Eu(t, e), n = Eu(t.reverse(), e);
  return [r, n];
}
o(Lg, "getTabbableEdges");
function Mu(e) {
  let t = [], r = document.createTreeWalker(e, NodeFilter.SHOW_ELEMENT, {
    acceptNode: /* @__PURE__ */ o((n) => {
      let a = n.tagName === "INPUT" && n.type === "hidden";
      return n.disabled || n.hidden || a ? NodeFilter.FILTER_SKIP : n.tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }, "acceptNode")
  });
  for (; r.nextNode(); ) t.push(r.currentNode);
  return t;
}
o(Mu, "getTabbableCandidates");
function Eu(e, t) {
  for (let r of e)
    if (!Ig(r, { upTo: t })) return r;
}
o(Eu, "findVisible");
function Ig(e, { upTo: t }) {
  if (getComputedStyle(e).visibility === "hidden") return !0;
  for (; e; ) {
    if (t !== void 0 && e === t) return !1;
    if (getComputedStyle(e).display === "none") return !0;
    e = e.parentElement;
  }
  return !1;
}
o(Ig, "isHidden");
function zg(e) {
  return e instanceof HTMLInputElement && "select" in e;
}
o(zg, "isSelectableInput");
function Ct(e, { select: t = !1 } = {}) {
  if (e && e.focus) {
    let r = document.activeElement;
    e.focus({ preventScroll: !0 }), e !== r && zg(e) && t && e.select();
  }
}
o(Ct, "focus");
var Su = Tg();
function Tg() {
  let e = [];
  return {
    add(t) {
      let r = e[0];
      t !== r && r?.pause(), e = Cu(e, t), e.unshift(t);
    },
    remove(t) {
      e = Cu(e, t), e[0]?.resume();
    }
  };
}
o(Tg, "createFocusScopesStack");
function Cu(e, t) {
  let r = [...e], n = r.indexOf(t);
  return n !== -1 && r.splice(n, 1), r;
}
o(Cu, "arrayRemove");
function Hg(e) {
  return e.filter((t) => t.tagName !== "A");
}
o(Hg, "removeLinks");

// ../node_modules/@radix-ui/react-portal/dist/index.mjs
import * as co from "react";
import Pg from "react-dom";
import { jsx as kg } from "react/jsx-runtime";
var Og = "Portal", Oi = co.forwardRef((e, t) => {
  let { container: r, ...n } = e, [a, i] = co.useState(!1);
  ct(() => i(!0), []);
  let c = r || a && globalThis?.document?.body;
  return c ? Pg.createPortal(/* @__PURE__ */ kg(Pe.div, { ...n, ref: t }), c) : null;
});
Oi.displayName = Og;

// ../node_modules/@radix-ui/react-dialog/node_modules/@radix-ui/react-presence/dist/index.mjs
import * as Ie from "react";
import * as Au from "react";
function Bg(e, t) {
  return Au.useReducer((r, n) => t[r][n] ?? r, e);
}
o(Bg, "useStateMachine");
var dn = /* @__PURE__ */ o((e) => {
  let { present: t, children: r } = e, n = Ng(t), a = typeof r == "function" ? r({ present: n.isPresent }) : Ie.Children.only(r), i = Xe(n.ref,
  Fg(a));
  return typeof r == "function" || n.isPresent ? Ie.cloneElement(a, { ref: i }) : null;
}, "Presence");
dn.displayName = "Presence";
function Ng(e) {
  let [t, r] = Ie.useState(), n = Ie.useRef(null), a = Ie.useRef(e), i = Ie.useRef("none"), c = e ? "mounted" : "unmounted", [l, s] = Bg(c, {
    mounted: {
      UNMOUNT: "unmounted",
      ANIMATION_OUT: "unmountSuspended"
    },
    unmountSuspended: {
      MOUNT: "mounted",
      ANIMATION_END: "unmounted"
    },
    unmounted: {
      MOUNT: "mounted"
    }
  });
  return Ie.useEffect(() => {
    let u = so(n.current);
    i.current = l === "mounted" ? u : "none";
  }, [l]), ct(() => {
    let u = n.current, f = a.current;
    if (f !== e) {
      let m = i.current, v = so(u);
      e ? s("MOUNT") : v === "none" || u?.display === "none" ? s("UNMOUNT") : s(f && m !== v ? "ANIMATION_OUT" : "UNMOUNT"), a.current = e;
    }
  }, [e, s]), ct(() => {
    if (t) {
      let u, f = t.ownerDocument.defaultView ?? window, d = /* @__PURE__ */ o((v) => {
        let p = so(n.current).includes(v.animationName);
        if (v.target === t && p && (s("ANIMATION_END"), !a.current)) {
          let h = t.style.animationFillMode;
          t.style.animationFillMode = "forwards", u = f.setTimeout(() => {
            t.style.animationFillMode === "forwards" && (t.style.animationFillMode = h);
          });
        }
      }, "handleAnimationEnd"), m = /* @__PURE__ */ o((v) => {
        v.target === t && (i.current = so(n.current));
      }, "handleAnimationStart");
      return t.addEventListener("animationstart", m), t.addEventListener("animationcancel", d), t.addEventListener("animationend", d), () => {
        f.clearTimeout(u), t.removeEventListener("animationstart", m), t.removeEventListener("animationcancel", d), t.removeEventListener("a\
nimationend", d);
      };
    } else
      s("ANIMATION_END");
  }, [t, s]), {
    isPresent: ["mounted", "unmountSuspended"].includes(l),
    ref: Ie.useCallback((u) => {
      n.current = u ? getComputedStyle(u) : null, r(u);
    }, [])
  };
}
o(Ng, "usePresence");
function so(e) {
  return e?.animationName || "none";
}
o(so, "getAnimationName");
function Fg(e) {
  let t = Object.getOwnPropertyDescriptor(e.props, "ref")?.get, r = t && "isReactWarning" in t && t.isReactWarning;
  return r ? e.ref : (t = Object.getOwnPropertyDescriptor(e, "ref")?.get, r = t && "isReactWarning" in t && t.isReactWarning, r ? e.props.ref :
  e.props.ref || e.ref);
}
o(Fg, "getElementRef");

// ../node_modules/@radix-ui/react-focus-guards/dist/index.mjs
import * as Iu from "react";
var Bi = 0;
function zu() {
  Iu.useEffect(() => {
    let e = document.querySelectorAll("[data-radix-focus-guard]");
    return document.body.insertAdjacentElement("afterbegin", e[0] ?? Lu()), document.body.insertAdjacentElement("beforeend", e[1] ?? Lu()), Bi++,
    () => {
      Bi === 1 && document.querySelectorAll("[data-radix-focus-guard]").forEach((t) => t.remove()), Bi--;
    };
  }, []);
}
o(zu, "useFocusGuards");
function Lu() {
  let e = document.createElement("span");
  return e.setAttribute("data-radix-focus-guard", ""), e.tabIndex = 0, e.style.outline = "none", e.style.opacity = "0", e.style.position = "\
fixed", e.style.pointerEvents = "none", e;
}
o(Lu, "createFocusGuard");

// ../node_modules/tslib/tslib.es6.mjs
var ze = /* @__PURE__ */ o(function() {
  return ze = Object.assign || /* @__PURE__ */ o(function(t) {
    for (var r, n = 1, a = arguments.length; n < a; n++) {
      r = arguments[n];
      for (var i in r) Object.prototype.hasOwnProperty.call(r, i) && (t[i] = r[i]);
    }
    return t;
  }, "__assign"), ze.apply(this, arguments);
}, "__assign");
function uo(e, t) {
  var r = {};
  for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && t.indexOf(n) < 0 && (r[n] = e[n]);
  if (e != null && typeof Object.getOwnPropertySymbols == "function")
    for (var a = 0, n = Object.getOwnPropertySymbols(e); a < n.length; a++)
      t.indexOf(n[a]) < 0 && Object.prototype.propertyIsEnumerable.call(e, n[a]) && (r[n[a]] = e[n[a]]);
  return r;
}
o(uo, "__rest");
function Tu(e, t, r) {
  if (r || arguments.length === 2) for (var n = 0, a = t.length, i; n < a; n++)
    (i || !(n in t)) && (i || (i = Array.prototype.slice.call(t, 0, n)), i[n] = t[n]);
  return e.concat(i || Array.prototype.slice.call(t));
}
o(Tu, "__spreadArray");

// ../node_modules/react-remove-scroll/dist/es2015/Combination.js
import * as go from "react";

// ../node_modules/react-remove-scroll/dist/es2015/UI.js
import * as be from "react";

// ../node_modules/react-remove-scroll-bar/dist/es2015/constants.js
var qt = "right-scroll-bar-position", Gt = "width-before-scroll-bar", Ni = "with-scroll-bars-hidden", Fi = "--removed-body-scroll-bar-size";

// ../node_modules/use-callback-ref/dist/es2015/assignRef.js
function fo(e, t) {
  return typeof e == "function" ? e(t) : e && (e.current = t), e;
}
o(fo, "assignRef");

// ../node_modules/use-callback-ref/dist/es2015/useRef.js
import { useState as Dg } from "react";
function Hu(e, t) {
  var r = Dg(function() {
    return {
      // value
      value: e,
      // last callback
      callback: t,
      // "memoized" public interface
      facade: {
        get current() {
          return r.value;
        },
        set current(n) {
          var a = r.value;
          a !== n && (r.value = n, r.callback(n, a));
        }
      }
    };
  })[0];
  return r.callback = t, r.facade;
}
o(Hu, "useCallbackRef");

// ../node_modules/use-callback-ref/dist/es2015/useMergeRef.js
import * as po from "react";
var _g = typeof window < "u" ? po.useLayoutEffect : po.useEffect, Pu = /* @__PURE__ */ new WeakMap();
function Di(e, t) {
  var r = Hu(t || null, function(n) {
    return e.forEach(function(a) {
      return fo(a, n);
    });
  });
  return _g(function() {
    var n = Pu.get(r);
    if (n) {
      var a = new Set(n), i = new Set(e), c = r.current;
      a.forEach(function(l) {
        i.has(l) || fo(l, null);
      }), i.forEach(function(l) {
        a.has(l) || fo(l, c);
      });
    }
    Pu.set(r, e);
  }, [e]), r;
}
o(Di, "useMergeRefs");

// ../node_modules/use-sidecar/dist/es2015/medium.js
function $g(e) {
  return e;
}
o($g, "ItoI");
function Vg(e, t) {
  t === void 0 && (t = $g);
  var r = [], n = !1, a = {
    read: /* @__PURE__ */ o(function() {
      if (n)
        throw new Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");
      return r.length ? r[r.length - 1] : e;
    }, "read"),
    useMedium: /* @__PURE__ */ o(function(i) {
      var c = t(i, n);
      return r.push(c), function() {
        r = r.filter(function(l) {
          return l !== c;
        });
      };
    }, "useMedium"),
    assignSyncMedium: /* @__PURE__ */ o(function(i) {
      for (n = !0; r.length; ) {
        var c = r;
        r = [], c.forEach(i);
      }
      r = {
        push: /* @__PURE__ */ o(function(l) {
          return i(l);
        }, "push"),
        filter: /* @__PURE__ */ o(function() {
          return r;
        }, "filter")
      };
    }, "assignSyncMedium"),
    assignMedium: /* @__PURE__ */ o(function(i) {
      n = !0;
      var c = [];
      if (r.length) {
        var l = r;
        r = [], l.forEach(i), c = r;
      }
      var s = /* @__PURE__ */ o(function() {
        var f = c;
        c = [], f.forEach(i);
      }, "executeQueue"), u = /* @__PURE__ */ o(function() {
        return Promise.resolve().then(s);
      }, "cycle");
      u(), r = {
        push: /* @__PURE__ */ o(function(f) {
          c.push(f), u();
        }, "push"),
        filter: /* @__PURE__ */ o(function(f) {
          return c = c.filter(f), r;
        }, "filter")
      };
    }, "assignMedium")
  };
  return a;
}
o(Vg, "innerCreateMedium");
function _i(e) {
  e === void 0 && (e = {});
  var t = Vg(null);
  return t.options = ze({ async: !0, ssr: !1 }, e), t;
}
o(_i, "createSidecarMedium");

// ../node_modules/use-sidecar/dist/es2015/exports.js
import * as ku from "react";
var Ou = /* @__PURE__ */ o(function(e) {
  var t = e.sideCar, r = uo(e, ["sideCar"]);
  if (!t)
    throw new Error("Sidecar: please provide `sideCar` property to import the right car");
  var n = t.read();
  if (!n)
    throw new Error("Sidecar medium not found");
  return ku.createElement(n, ze({}, r));
}, "SideCar");
Ou.isSideCarExport = !0;
function $i(e, t) {
  return e.useMedium(t), Ou;
}
o($i, "exportSidecar");

// ../node_modules/react-remove-scroll/dist/es2015/medium.js
var mo = _i();

// ../node_modules/react-remove-scroll/dist/es2015/UI.js
var Vi = /* @__PURE__ */ o(function() {
}, "nothing"), pn = be.forwardRef(function(e, t) {
  var r = be.useRef(null), n = be.useState({
    onScrollCapture: Vi,
    onWheelCapture: Vi,
    onTouchMoveCapture: Vi
  }), a = n[0], i = n[1], c = e.forwardProps, l = e.children, s = e.className, u = e.removeScrollBar, f = e.enabled, d = e.shards, m = e.sideCar,
  v = e.noIsolation, y = e.inert, p = e.allowPinchZoom, h = e.as, g = h === void 0 ? "div" : h, w = e.gapMode, b = uo(e, ["forwardProps", "c\
hildren", "className", "removeScrollBar", "enabled", "shards", "sideCar", "noIsolation", "inert", "allowPinchZoom", "as", "gapMode"]), x = m,
  E = Di([r, t]), R = ze(ze({}, b), a);
  return be.createElement(
    be.Fragment,
    null,
    f && be.createElement(x, { sideCar: mo, removeScrollBar: u, shards: d, noIsolation: v, inert: y, setCallbacks: i, allowPinchZoom: !!p, lockRef: r,
    gapMode: w }),
    c ? be.cloneElement(be.Children.only(l), ze(ze({}, R), { ref: E })) : be.createElement(g, ze({}, R, { className: s, ref: E }), l)
  );
});
pn.defaultProps = {
  enabled: !0,
  removeScrollBar: !0,
  inert: !1
};
pn.classNames = {
  fullWidth: Gt,
  zeroRight: qt
};

// ../node_modules/react-remove-scroll/dist/es2015/SideEffect.js
import * as X from "react";

// ../node_modules/react-remove-scroll-bar/dist/es2015/component.js
import * as Mr from "react";

// ../node_modules/react-style-singleton/dist/es2015/hook.js
import * as Fu from "react";

// ../node_modules/get-nonce/dist/es2015/index.js
var Bu;
var Nu = /* @__PURE__ */ o(function() {
  if (Bu)
    return Bu;
  if (typeof __webpack_nonce__ < "u")
    return __webpack_nonce__;
}, "getNonce");

// ../node_modules/react-style-singleton/dist/es2015/singleton.js
function jg() {
  if (!document)
    return null;
  var e = document.createElement("style");
  e.type = "text/css";
  var t = Nu();
  return t && e.setAttribute("nonce", t), e;
}
o(jg, "makeStyleTag");
function Wg(e, t) {
  e.styleSheet ? e.styleSheet.cssText = t : e.appendChild(document.createTextNode(t));
}
o(Wg, "injectStyles");
function Ug(e) {
  var t = document.head || document.getElementsByTagName("head")[0];
  t.appendChild(e);
}
o(Ug, "insertStyleTag");
var ji = /* @__PURE__ */ o(function() {
  var e = 0, t = null;
  return {
    add: /* @__PURE__ */ o(function(r) {
      e == 0 && (t = jg()) && (Wg(t, r), Ug(t)), e++;
    }, "add"),
    remove: /* @__PURE__ */ o(function() {
      e--, !e && t && (t.parentNode && t.parentNode.removeChild(t), t = null);
    }, "remove")
  };
}, "stylesheetSingleton");

// ../node_modules/react-style-singleton/dist/es2015/hook.js
var Wi = /* @__PURE__ */ o(function() {
  var e = ji();
  return function(t, r) {
    Fu.useEffect(function() {
      return e.add(t), function() {
        e.remove();
      };
    }, [t && r]);
  };
}, "styleHookSingleton");

// ../node_modules/react-style-singleton/dist/es2015/component.js
var mn = /* @__PURE__ */ o(function() {
  var e = Wi(), t = /* @__PURE__ */ o(function(r) {
    var n = r.styles, a = r.dynamic;
    return e(n, a), null;
  }, "Sheet");
  return t;
}, "styleSingleton");

// ../node_modules/react-remove-scroll-bar/dist/es2015/utils.js
var qg = {
  left: 0,
  top: 0,
  right: 0,
  gap: 0
}, Ui = /* @__PURE__ */ o(function(e) {
  return parseInt(e || "", 10) || 0;
}, "parse"), Gg = /* @__PURE__ */ o(function(e) {
  var t = window.getComputedStyle(document.body), r = t[e === "padding" ? "paddingLeft" : "marginLeft"], n = t[e === "padding" ? "paddingTop" :
  "marginTop"], a = t[e === "padding" ? "paddingRight" : "marginRight"];
  return [Ui(r), Ui(n), Ui(a)];
}, "getOffset"), qi = /* @__PURE__ */ o(function(e) {
  if (e === void 0 && (e = "margin"), typeof window > "u")
    return qg;
  var t = Gg(e), r = document.documentElement.clientWidth, n = window.innerWidth;
  return {
    left: t[0],
    top: t[1],
    right: t[2],
    gap: Math.max(0, n - r + t[2] - t[0])
  };
}, "getGapWidth");

// ../node_modules/react-remove-scroll-bar/dist/es2015/component.js
var Yg = mn(), Cr = "data-scroll-locked", Xg = /* @__PURE__ */ o(function(e, t, r, n) {
  var a = e.left, i = e.top, c = e.right, l = e.gap;
  return r === void 0 && (r = "margin"), `
  .`.concat(Ni, ` {
   overflow: hidden `).concat(n, `;
   padding-right: `).concat(l, "px ").concat(n, `;
  }
  body[`).concat(Cr, `] {
    overflow: hidden `).concat(n, `;
    overscroll-behavior: contain;
    `).concat([
    t && "position: relative ".concat(n, ";"),
    r === "margin" && `
    padding-left: `.concat(a, `px;
    padding-top: `).concat(i, `px;
    padding-right: `).concat(c, `px;
    margin-left:0;
    margin-top:0;
    margin-right: `).concat(l, "px ").concat(n, `;
    `),
    r === "padding" && "padding-right: ".concat(l, "px ").concat(n, ";")
  ].filter(Boolean).join(""), `
  }
  
  .`).concat(qt, ` {
    right: `).concat(l, "px ").concat(n, `;
  }
  
  .`).concat(Gt, ` {
    margin-right: `).concat(l, "px ").concat(n, `;
  }
  
  .`).concat(qt, " .").concat(qt, ` {
    right: 0 `).concat(n, `;
  }
  
  .`).concat(Gt, " .").concat(Gt, ` {
    margin-right: 0 `).concat(n, `;
  }
  
  body[`).concat(Cr, `] {
    `).concat(Fi, ": ").concat(l, `px;
  }
`);
}, "getStyles"), Du = /* @__PURE__ */ o(function() {
  var e = parseInt(document.body.getAttribute(Cr) || "0", 10);
  return isFinite(e) ? e : 0;
}, "getCurrentUseCounter"), Zg = /* @__PURE__ */ o(function() {
  Mr.useEffect(function() {
    return document.body.setAttribute(Cr, (Du() + 1).toString()), function() {
      var e = Du() - 1;
      e <= 0 ? document.body.removeAttribute(Cr) : document.body.setAttribute(Cr, e.toString());
    };
  }, []);
}, "useLockAttribute"), Gi = /* @__PURE__ */ o(function(e) {
  var t = e.noRelative, r = e.noImportant, n = e.gapMode, a = n === void 0 ? "margin" : n;
  Zg();
  var i = Mr.useMemo(function() {
    return qi(a);
  }, [a]);
  return Mr.createElement(Yg, { styles: Xg(i, !t, a, r ? "" : "!important") });
}, "RemoveScrollBar");

// ../node_modules/react-remove-scroll/dist/es2015/aggresiveCapture.js
var Yi = !1;
if (typeof window < "u")
  try {
    hn = Object.defineProperty({}, "passive", {
      get: /* @__PURE__ */ o(function() {
        return Yi = !0, !0;
      }, "get")
    }), window.addEventListener("test", hn, hn), window.removeEventListener("test", hn, hn);
  } catch {
    Yi = !1;
  }
var hn, Yt = Yi ? { passive: !1 } : !1;

// ../node_modules/react-remove-scroll/dist/es2015/handleScroll.js
var Kg = /* @__PURE__ */ o(function(e) {
  return e.tagName === "TEXTAREA";
}, "alwaysContainsScroll"), _u = /* @__PURE__ */ o(function(e, t) {
  if (!(e instanceof Element))
    return !1;
  var r = window.getComputedStyle(e);
  return (
    // not-not-scrollable
    r[t] !== "hidden" && // contains scroll inside self
    !(r.overflowY === r.overflowX && !Kg(e) && r[t] === "visible")
  );
}, "elementCanBeScrolled"), Jg = /* @__PURE__ */ o(function(e) {
  return _u(e, "overflowY");
}, "elementCouldBeVScrolled"), Qg = /* @__PURE__ */ o(function(e) {
  return _u(e, "overflowX");
}, "elementCouldBeHScrolled"), Xi = /* @__PURE__ */ o(function(e, t) {
  var r = t.ownerDocument, n = t;
  do {
    typeof ShadowRoot < "u" && n instanceof ShadowRoot && (n = n.host);
    var a = $u(e, n);
    if (a) {
      var i = Vu(e, n), c = i[1], l = i[2];
      if (c > l)
        return !0;
    }
    n = n.parentNode;
  } while (n && n !== r.body);
  return !1;
}, "locationCouldBeScrolled"), ev = /* @__PURE__ */ o(function(e) {
  var t = e.scrollTop, r = e.scrollHeight, n = e.clientHeight;
  return [
    t,
    r,
    n
  ];
}, "getVScrollVariables"), tv = /* @__PURE__ */ o(function(e) {
  var t = e.scrollLeft, r = e.scrollWidth, n = e.clientWidth;
  return [
    t,
    r,
    n
  ];
}, "getHScrollVariables"), $u = /* @__PURE__ */ o(function(e, t) {
  return e === "v" ? Jg(t) : Qg(t);
}, "elementCouldBeScrolled"), Vu = /* @__PURE__ */ o(function(e, t) {
  return e === "v" ? ev(t) : tv(t);
}, "getScrollVariables"), rv = /* @__PURE__ */ o(function(e, t) {
  return e === "h" && t === "rtl" ? -1 : 1;
}, "getDirectionFactor"), ju = /* @__PURE__ */ o(function(e, t, r, n, a) {
  var i = rv(e, window.getComputedStyle(t).direction), c = i * n, l = r.target, s = t.contains(l), u = !1, f = c > 0, d = 0, m = 0;
  do {
    var v = Vu(e, l), y = v[0], p = v[1], h = v[2], g = p - h - i * y;
    (y || g) && $u(e, l) && (d += g, m += y), l instanceof ShadowRoot ? l = l.host : l = l.parentNode;
  } while (
    // portaled content
    !s && l !== document.body || // self content
    s && (t.contains(l) || t === l)
  );
  return (f && (a && Math.abs(d) < 1 || !a && c > d) || !f && (a && Math.abs(m) < 1 || !a && -c > m)) && (u = !0), u;
}, "handleScroll");

// ../node_modules/react-remove-scroll/dist/es2015/SideEffect.js
var ho = /* @__PURE__ */ o(function(e) {
  return "changedTouches" in e ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY] : [0, 0];
}, "getTouchXY"), Wu = /* @__PURE__ */ o(function(e) {
  return [e.deltaX, e.deltaY];
}, "getDeltaXY"), Uu = /* @__PURE__ */ o(function(e) {
  return e && "current" in e ? e.current : e;
}, "extractRef"), nv = /* @__PURE__ */ o(function(e, t) {
  return e[0] === t[0] && e[1] === t[1];
}, "deltaCompare"), ov = /* @__PURE__ */ o(function(e) {
  return `
  .block-interactivity-`.concat(e, ` {pointer-events: none;}
  .allow-interactivity-`).concat(e, ` {pointer-events: all;}
`);
}, "generateStyle"), av = 0, Ar = [];
function qu(e) {
  var t = X.useRef([]), r = X.useRef([0, 0]), n = X.useRef(), a = X.useState(av++)[0], i = X.useState(mn)[0], c = X.useRef(e);
  X.useEffect(function() {
    c.current = e;
  }, [e]), X.useEffect(function() {
    if (e.inert) {
      document.body.classList.add("block-interactivity-".concat(a));
      var p = Tu([e.lockRef.current], (e.shards || []).map(Uu), !0).filter(Boolean);
      return p.forEach(function(h) {
        return h.classList.add("allow-interactivity-".concat(a));
      }), function() {
        document.body.classList.remove("block-interactivity-".concat(a)), p.forEach(function(h) {
          return h.classList.remove("allow-interactivity-".concat(a));
        });
      };
    }
  }, [e.inert, e.lockRef.current, e.shards]);
  var l = X.useCallback(function(p, h) {
    if ("touches" in p && p.touches.length === 2 || p.type === "wheel" && p.ctrlKey)
      return !c.current.allowPinchZoom;
    var g = ho(p), w = r.current, b = "deltaX" in p ? p.deltaX : w[0] - g[0], x = "deltaY" in p ? p.deltaY : w[1] - g[1], E, R = p.target, S = Math.
    abs(b) > Math.abs(x) ? "h" : "v";
    if ("touches" in p && S === "h" && R.type === "range")
      return !1;
    var A = Xi(S, R);
    if (!A)
      return !0;
    if (A ? E = S : (E = S === "v" ? "h" : "v", A = Xi(S, R)), !A)
      return !1;
    if (!n.current && "changedTouches" in p && (b || x) && (n.current = E), !E)
      return !0;
    var M = n.current || E;
    return ju(M, h, p, M === "h" ? b : x, !0);
  }, []), s = X.useCallback(function(p) {
    var h = p;
    if (!(!Ar.length || Ar[Ar.length - 1] !== i)) {
      var g = "deltaY" in h ? Wu(h) : ho(h), w = t.current.filter(function(E) {
        return E.name === h.type && (E.target === h.target || h.target === E.shadowParent) && nv(E.delta, g);
      })[0];
      if (w && w.should) {
        h.cancelable && h.preventDefault();
        return;
      }
      if (!w) {
        var b = (c.current.shards || []).map(Uu).filter(Boolean).filter(function(E) {
          return E.contains(h.target);
        }), x = b.length > 0 ? l(h, b[0]) : !c.current.noIsolation;
        x && h.cancelable && h.preventDefault();
      }
    }
  }, []), u = X.useCallback(function(p, h, g, w) {
    var b = { name: p, delta: h, target: g, should: w, shadowParent: iv(g) };
    t.current.push(b), setTimeout(function() {
      t.current = t.current.filter(function(x) {
        return x !== b;
      });
    }, 1);
  }, []), f = X.useCallback(function(p) {
    r.current = ho(p), n.current = void 0;
  }, []), d = X.useCallback(function(p) {
    u(p.type, Wu(p), p.target, l(p, e.lockRef.current));
  }, []), m = X.useCallback(function(p) {
    u(p.type, ho(p), p.target, l(p, e.lockRef.current));
  }, []);
  X.useEffect(function() {
    return Ar.push(i), e.setCallbacks({
      onScrollCapture: d,
      onWheelCapture: d,
      onTouchMoveCapture: m
    }), document.addEventListener("wheel", s, Yt), document.addEventListener("touchmove", s, Yt), document.addEventListener("touchstart", f,
    Yt), function() {
      Ar = Ar.filter(function(p) {
        return p !== i;
      }), document.removeEventListener("wheel", s, Yt), document.removeEventListener("touchmove", s, Yt), document.removeEventListener("touc\
hstart", f, Yt);
    };
  }, []);
  var v = e.removeScrollBar, y = e.inert;
  return X.createElement(
    X.Fragment,
    null,
    y ? X.createElement(i, { styles: ov(a) }) : null,
    v ? X.createElement(Gi, { gapMode: e.gapMode }) : null
  );
}
o(qu, "RemoveScrollSideCar");
function iv(e) {
  for (var t = null; e !== null; )
    e instanceof ShadowRoot && (t = e.host, e = e.host), e = e.parentNode;
  return t;
}
o(iv, "getOutermostShadowParent");

// ../node_modules/react-remove-scroll/dist/es2015/sidecar.js
var Gu = $i(mo, qu);

// ../node_modules/react-remove-scroll/dist/es2015/Combination.js
var Yu = go.forwardRef(function(e, t) {
  return go.createElement(pn, ze({}, e, { ref: t, sideCar: Gu }));
});
Yu.classNames = pn.classNames;
var Zi = Yu;

// ../node_modules/aria-hidden/dist/es2015/index.js
var lv = /* @__PURE__ */ o(function(e) {
  if (typeof document > "u")
    return null;
  var t = Array.isArray(e) ? e[0] : e;
  return t.ownerDocument.body;
}, "getDefaultParent"), Lr = /* @__PURE__ */ new WeakMap(), vo = /* @__PURE__ */ new WeakMap(), wo = {}, Ki = 0, Xu = /* @__PURE__ */ o(function(e) {
  return e && (e.host || Xu(e.parentNode));
}, "unwrapHost"), cv = /* @__PURE__ */ o(function(e, t) {
  return t.map(function(r) {
    if (e.contains(r))
      return r;
    var n = Xu(r);
    return n && e.contains(n) ? n : (console.error("aria-hidden", r, "in not contained inside", e, ". Doing nothing"), null);
  }).filter(function(r) {
    return !!r;
  });
}, "correctTargets"), sv = /* @__PURE__ */ o(function(e, t, r, n) {
  var a = cv(t, Array.isArray(e) ? e : [e]);
  wo[r] || (wo[r] = /* @__PURE__ */ new WeakMap());
  var i = wo[r], c = [], l = /* @__PURE__ */ new Set(), s = new Set(a), u = /* @__PURE__ */ o(function(d) {
    !d || l.has(d) || (l.add(d), u(d.parentNode));
  }, "keep");
  a.forEach(u);
  var f = /* @__PURE__ */ o(function(d) {
    !d || s.has(d) || Array.prototype.forEach.call(d.children, function(m) {
      if (l.has(m))
        f(m);
      else
        try {
          var v = m.getAttribute(n), y = v !== null && v !== "false", p = (Lr.get(m) || 0) + 1, h = (i.get(m) || 0) + 1;
          Lr.set(m, p), i.set(m, h), c.push(m), p === 1 && y && vo.set(m, !0), h === 1 && m.setAttribute(r, "true"), y || m.setAttribute(n, "\
true");
        } catch (g) {
          console.error("aria-hidden: cannot operate on ", m, g);
        }
    });
  }, "deep");
  return f(t), l.clear(), Ki++, function() {
    c.forEach(function(d) {
      var m = Lr.get(d) - 1, v = i.get(d) - 1;
      Lr.set(d, m), i.set(d, v), m || (vo.has(d) || d.removeAttribute(n), vo.delete(d)), v || d.removeAttribute(r);
    }), Ki--, Ki || (Lr = /* @__PURE__ */ new WeakMap(), Lr = /* @__PURE__ */ new WeakMap(), vo = /* @__PURE__ */ new WeakMap(), wo = {});
  };
}, "applyAttributeToOthers"), Zu = /* @__PURE__ */ o(function(e, t, r) {
  r === void 0 && (r = "data-aria-hidden");
  var n = Array.from(Array.isArray(e) ? e : [e]), a = t || lv(e);
  return a ? (n.push.apply(n, Array.from(a.querySelectorAll("[aria-live]"))), sv(n, a, r, "aria-hidden")) : function() {
    return null;
  };
}, "hideOthers");

// ../node_modules/@radix-ui/react-dialog/dist/index.mjs
import { Fragment as Ku, jsx as re, jsxs as Ju } from "react/jsx-runtime";
var yo = "Dialog", [Qu, uv] = lu(yo), [fv, Ze] = Qu(yo), Ji = /* @__PURE__ */ o((e) => {
  let {
    __scopeDialog: t,
    children: r,
    open: n,
    defaultOpen: a,
    onOpenChange: i,
    modal: c = !0
  } = e, l = q.useRef(null), s = q.useRef(null), [u, f] = su({
    prop: n,
    defaultProp: a ?? !1,
    onChange: i,
    caller: yo
  });
  return /* @__PURE__ */ re(
    fv,
    {
      scope: t,
      triggerRef: l,
      contentRef: s,
      contentId: ao(),
      titleId: ao(),
      descriptionId: ao(),
      open: u,
      onOpenChange: f,
      onOpenToggle: q.useCallback(() => f((d) => !d), [f]),
      modal: c,
      children: r
    }
  );
}, "Dialog");
Ji.displayName = yo;
var ef = "DialogTrigger", Qi = q.forwardRef(
  (e, t) => {
    let { __scopeDialog: r, ...n } = e, a = Ze(ef, r), i = Xe(t, a.triggerRef);
    return /* @__PURE__ */ re(
      Pe.button,
      {
        type: "button",
        "aria-haspopup": "dialog",
        "aria-expanded": a.open,
        "aria-controls": a.contentId,
        "data-state": c0(a.open),
        ...n,
        ref: i,
        onClick: Er(e.onClick, a.onOpenToggle)
      }
    );
  }
);
Qi.displayName = ef;
var e0 = "DialogPortal", [dv, tf] = Qu(e0, {
  forceMount: void 0
}), t0 = /* @__PURE__ */ o((e) => {
  let { __scopeDialog: t, forceMount: r, children: n, container: a } = e, i = Ze(e0, t);
  return /* @__PURE__ */ re(dv, { scope: t, forceMount: r, children: q.Children.map(n, (c) => /* @__PURE__ */ re(dn, { present: r || i.open,
  children: /* @__PURE__ */ re(Oi, { asChild: !0, container: a, children: c }) })) });
}, "DialogPortal");
t0.displayName = e0;
var bo = "DialogOverlay", r0 = q.forwardRef(
  (e, t) => {
    let r = tf(bo, e.__scopeDialog), { forceMount: n = r.forceMount, ...a } = e, i = Ze(bo, e.__scopeDialog);
    return i.modal ? /* @__PURE__ */ re(dn, { present: n || i.open, children: /* @__PURE__ */ re(mv, { ...a, ref: t }) }) : null;
  }
);
r0.displayName = bo;
var pv = fn("DialogOverlay.RemoveScroll"), mv = q.forwardRef(
  (e, t) => {
    let { __scopeDialog: r, ...n } = e, a = Ze(bo, r);
    return (
      // Make sure `Content` is scrollable even when it doesn't live inside `RemoveScroll`
      // ie. when `Overlay` and `Content` are siblings
      /* @__PURE__ */ re(Zi, { as: pv, allowPinchZoom: !0, shards: [a.contentRef], children: /* @__PURE__ */ re(
        Pe.div,
        {
          "data-state": c0(a.open),
          ...n,
          ref: t,
          style: { pointerEvents: "auto", ...n.style }
        }
      ) })
    );
  }
), Xt = "DialogContent", n0 = q.forwardRef(
  (e, t) => {
    let r = tf(Xt, e.__scopeDialog), { forceMount: n = r.forceMount, ...a } = e, i = Ze(Xt, e.__scopeDialog);
    return /* @__PURE__ */ re(dn, { present: n || i.open, children: i.modal ? /* @__PURE__ */ re(hv, { ...a, ref: t }) : /* @__PURE__ */ re(
    gv, { ...a, ref: t }) });
  }
);
n0.displayName = Xt;
var hv = q.forwardRef(
  (e, t) => {
    let r = Ze(Xt, e.__scopeDialog), n = q.useRef(null), a = Xe(t, r.contentRef, n);
    return q.useEffect(() => {
      let i = n.current;
      if (i) return Zu(i);
    }, []), /* @__PURE__ */ re(
      rf,
      {
        ...e,
        ref: a,
        trapFocus: r.open,
        disableOutsidePointerEvents: !0,
        onCloseAutoFocus: Er(e.onCloseAutoFocus, (i) => {
          i.preventDefault(), r.triggerRef.current?.focus();
        }),
        onPointerDownOutside: Er(e.onPointerDownOutside, (i) => {
          let c = i.detail.originalEvent, l = c.button === 0 && c.ctrlKey === !0;
          (c.button === 2 || l) && i.preventDefault();
        }),
        onFocusOutside: Er(
          e.onFocusOutside,
          (i) => i.preventDefault()
        )
      }
    );
  }
), gv = q.forwardRef(
  (e, t) => {
    let r = Ze(Xt, e.__scopeDialog), n = q.useRef(!1), a = q.useRef(!1);
    return /* @__PURE__ */ re(
      rf,
      {
        ...e,
        ref: t,
        trapFocus: !1,
        disableOutsidePointerEvents: !1,
        onCloseAutoFocus: /* @__PURE__ */ o((i) => {
          e.onCloseAutoFocus?.(i), i.defaultPrevented || (n.current || r.triggerRef.current?.focus(), i.preventDefault()), n.current = !1, a.
          current = !1;
        }, "onCloseAutoFocus"),
        onInteractOutside: /* @__PURE__ */ o((i) => {
          e.onInteractOutside?.(i), i.defaultPrevented || (n.current = !0, i.detail.originalEvent.type === "pointerdown" && (a.current = !0));
          let c = i.target;
          r.triggerRef.current?.contains(c) && i.preventDefault(), i.detail.originalEvent.type === "focusin" && a.current && i.preventDefault();
        }, "onInteractOutside")
      }
    );
  }
), rf = q.forwardRef(
  (e, t) => {
    let { __scopeDialog: r, trapFocus: n, onOpenAutoFocus: a, onCloseAutoFocus: i, ...c } = e, l = Ze(Xt, r), s = q.useRef(null), u = Xe(t, s);
    return zu(), /* @__PURE__ */ Ju(Ku, { children: [
      /* @__PURE__ */ re(
        ki,
        {
          asChild: !0,
          loop: !0,
          trapped: n,
          onMountAutoFocus: a,
          onUnmountAutoFocus: i,
          children: /* @__PURE__ */ re(
            Ti,
            {
              role: "dialog",
              id: l.contentId,
              "aria-describedby": l.descriptionId,
              "aria-labelledby": l.titleId,
              "data-state": c0(l.open),
              ...c,
              ref: u,
              onDismiss: /* @__PURE__ */ o(() => l.onOpenChange(!1), "onDismiss")
            }
          )
        }
      ),
      /* @__PURE__ */ Ju(Ku, { children: [
        /* @__PURE__ */ re(wv, { titleId: l.titleId }),
        /* @__PURE__ */ re(yv, { contentRef: s, descriptionId: l.descriptionId })
      ] })
    ] });
  }
), o0 = "DialogTitle", a0 = q.forwardRef(
  (e, t) => {
    let { __scopeDialog: r, ...n } = e, a = Ze(o0, r);
    return /* @__PURE__ */ re(Pe.h2, { id: a.titleId, ...n, ref: t });
  }
);
a0.displayName = o0;
var nf = "DialogDescription", i0 = q.forwardRef(
  (e, t) => {
    let { __scopeDialog: r, ...n } = e, a = Ze(nf, r);
    return /* @__PURE__ */ re(Pe.p, { id: a.descriptionId, ...n, ref: t });
  }
);
i0.displayName = nf;
var of = "DialogClose", l0 = q.forwardRef(
  (e, t) => {
    let { __scopeDialog: r, ...n } = e, a = Ze(of, r);
    return /* @__PURE__ */ re(
      Pe.button,
      {
        type: "button",
        ...n,
        ref: t,
        onClick: Er(e.onClick, () => a.onOpenChange(!1))
      }
    );
  }
);
l0.displayName = of;
function c0(e) {
  return e ? "open" : "closed";
}
o(c0, "getState");
var af = "DialogTitleWarning", [vv, lf] = iu(af, {
  contentName: Xt,
  titleName: o0,
  docsSlug: "dialog"
}), wv = /* @__PURE__ */ o(({ titleId: e }) => {
  let t = lf(af), r = `\`${t.contentName}\` requires a \`${t.titleName}\` for the component to be accessible for screen reader users.

If you want to hide the \`${t.titleName}\`, you can wrap it with our VisuallyHidden component.

For more information, see https://radix-ui.com/primitives/docs/components/${t.docsSlug}`;
  return q.useEffect(() => {
    e && (document.getElementById(e) || console.error(r));
  }, [r, e]), null;
}, "TitleWarning"), bv = "DialogDescriptionWarning", yv = /* @__PURE__ */ o(({ contentRef: e, descriptionId: t }) => {
  let n = `Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {${lf(bv).contentName}}.`;
  return q.useEffect(() => {
    let a = e.current?.getAttribute("aria-describedby");
    t && a && (document.getElementById(t) || console.warn(n));
  }, [n, e, t]), null;
}, "DescriptionWarning"), s0 = Ji, Rv = Qi, u0 = t0, f0 = r0, d0 = n0, p0 = a0, m0 = i0, h0 = l0;

// src/components/components/Modal/Modal.styled.tsx
var b0 = {};
Zr(b0, {
  Actions: () => Nv,
  CloseButton: () => sf,
  Col: () => ff,
  Container: () => w0,
  Content: () => Pv,
  Description: () => Bv,
  Error: () => Fv,
  ErrorWrapper: () => df,
  Header: () => kv,
  Overlay: () => v0,
  Row: () => uf,
  Title: () => Ov
});
import Mt from "react";
import { keyframes as g0, styled as st } from "storybook/theming";

// src/components/components/IconButton/IconButton.tsx
import Iv, { forwardRef as zv } from "react";

// src/components/components/Button/Button.tsx
import xv, { forwardRef as Ev, useEffect as Sv, useState as Cv } from "react";
import { isPropValid as Mv, styled as Av } from "storybook/theming";
var Ir = Ev(
  ({
    asChild: e = !1,
    animation: t = "none",
    size: r = "small",
    variant: n = "outline",
    padding: a = "medium",
    disabled: i = !1,
    active: c = !1,
    onClick: l,
    ...s
  }, u) => {
    let f = "button";
    e && (f = fu);
    let [d, m] = Cv(!1), v = /* @__PURE__ */ o((y) => {
      l && l(y), t !== "none" && m(!0);
    }, "handleClick");
    return Sv(() => {
      let y = setTimeout(() => {
        d && m(!1);
      }, 1e3);
      return () => clearTimeout(y);
    }, [d]), /* @__PURE__ */ xv.createElement(
      Lv,
      {
        as: f,
        ref: u,
        variant: n,
        size: r,
        padding: a,
        disabled: i,
        active: c,
        animating: d,
        animation: t,
        onClick: v,
        ...s
      }
    );
  }
);
Ir.displayName = "Button";
var Lv = Av("button", {
  shouldForwardProp: /* @__PURE__ */ o((e) => Mv(e), "shouldForwardProp")
})(({ theme: e, variant: t, size: r, disabled: n, active: a, animating: i, animation: c = "none", padding: l }) => ({
  border: 0,
  cursor: n ? "not-allowed" : "pointer",
  display: "inline-flex",
  gap: "6px",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  padding: l === "none" ? 0 : l === "small" && r === "small" ? "0 7px" : l === "small" && r === "medium" ? "0 9px" : r === "small" ? "0 10px" :
  r === "medium" ? "0 12px" : 0,
  height: r === "small" ? "28px" : "32px",
  position: "relative",
  textAlign: "center",
  textDecoration: "none",
  transitionProperty: "background, box-shadow",
  transitionDuration: "150ms",
  transitionTimingFunction: "ease-out",
  verticalAlign: "top",
  whiteSpace: "nowrap",
  userSelect: "none",
  opacity: n ? 0.5 : 1,
  margin: 0,
  fontSize: `${e.typography.size.s1}px`,
  fontWeight: e.typography.weight.bold,
  lineHeight: "1",
  background: t === "solid" ? e.color.secondary : t === "outline" ? e.button.background : t === "ghost" && a ? e.background.hoverable : "tra\
nsparent",
  ...t === "ghost" ? {
    // This is a hack to apply bar styles to the button as soon as it is part of a bar
    // It is a temporary solution until we have implemented Theming 2.0.
    ".sb-bar &": {
      background: a ? we(0.9, e.barTextColor) : "transparent",
      color: a ? e.barSelectedColor : e.barTextColor,
      "&:hover": {
        color: e.barHoverColor,
        background: we(0.86, e.barHoverColor)
      },
      "&:active": {
        color: e.barSelectedColor,
        background: we(0.9, e.barSelectedColor)
      },
      "&:focus": {
        boxShadow: `${Ft(e.barHoverColor, 1)} 0 0 0 1px inset`,
        outline: "none"
      }
    }
  } : {},
  color: t === "solid" ? e.color.lightest : t === "outline" ? e.input.color : t === "ghost" && a ? e.color.secondary : t === "ghost" ? e.color.
  mediumdark : e.input.color,
  boxShadow: t === "outline" ? `${e.button.border} 0 0 0 1px inset` : "none",
  borderRadius: e.input.borderRadius,
  // Making sure that the button never shrinks below its minimum size
  flexShrink: 0,
  "&:hover": {
    color: t === "ghost" ? e.color.secondary : void 0,
    background: (() => {
      let s = e.color.secondary;
      return t === "solid" && (s = e.color.secondary), t === "outline" && (s = e.button.background), t === "ghost" ? we(0.86, e.color.secondary) :
      e.base === "light" ? wt(0.02, s) : na(0.03, s);
    })()
  },
  "&:active": {
    color: t === "ghost" ? e.color.secondary : void 0,
    background: (() => {
      let s = e.color.secondary;
      return t === "solid" && (s = e.color.secondary), t === "outline" && (s = e.button.background), t === "ghost" ? e.background.hoverable :
      e.base === "light" ? wt(0.02, s) : na(0.03, s);
    })()
  },
  "&:focus": {
    boxShadow: `${Ft(e.color.secondary, 1)} 0 0 0 1px inset`,
    outline: "none"
  },
  "> svg": {
    animation: i && c !== "none" ? `${e.animation[c]} 1000ms ease-out` : ""
  }
}));

// src/components/components/IconButton/IconButton.tsx
var xo = zv(
  ({ padding: e = "small", variant: t = "ghost", ...r }, n) => /* @__PURE__ */ Iv.createElement(Ir, { padding: e, variant: t, ref: n, ...r })
);
xo.displayName = "IconButton";

// src/components/components/Modal/Modal.styled.tsx
var cf = g0({
  from: { opacity: 0 },
  to: { opacity: 1 }
}), Tv = g0({
  from: { maxHeight: 0 },
  to: {}
}), Hv = g0({
  from: {
    opacity: 0,
    transform: "translate(-50%, -50%) scale(0.9)"
  },
  to: {
    opacity: 1,
    transform: "translate(-50%, -50%) scale(1)"
  }
}), v0 = st.div({
  backdropFilter: "blur(24px)",
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  zIndex: 10,
  animation: `${cf} 200ms`
}), w0 = st.div(
  ({ theme: e, width: t, height: r }) => ({
    backgroundColor: e.background.bar,
    borderRadius: 6,
    boxShadow: "0px 4px 67px 0px #00000040",
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: t ?? 740,
    height: r ?? "auto",
    maxWidth: "calc(100% - 40px)",
    maxHeight: "85vh",
    overflow: "auto",
    zIndex: 11,
    animation: `${Hv} 200ms`,
    "&:focus-visible": {
      outline: "none"
    }
  })
), sf = /* @__PURE__ */ o((e) => /* @__PURE__ */ Mt.createElement(h0, { asChild: !0 }, /* @__PURE__ */ Mt.createElement(xo, { "aria-label": "\
Close", ...e }, /* @__PURE__ */ Mt.createElement(G5, null))), "CloseButton"), Pv = st.div({
  display: "flex",
  flexDirection: "column",
  margin: 16,
  gap: 16
}), uf = st.div({
  display: "flex",
  justifyContent: "space-between",
  gap: 16
}), ff = st.div({
  display: "flex",
  flexDirection: "column",
  gap: 4
}), kv = /* @__PURE__ */ o((e) => /* @__PURE__ */ Mt.createElement(uf, null, /* @__PURE__ */ Mt.createElement(ff, { ...e }), /* @__PURE__ */ Mt.
createElement(sf, null)), "Header"), Ov = st(p0)(({ theme: e }) => ({
  margin: 0,
  fontSize: e.typography.size.s3,
  fontWeight: e.typography.weight.bold
})), Bv = st(m0)(({ theme: e }) => ({
  position: "relative",
  zIndex: 1,
  margin: 0,
  fontSize: e.typography.size.s2
})), Nv = st.div({
  display: "flex",
  flexDirection: "row-reverse",
  gap: 8
}), df = st.div(({ theme: e }) => ({
  maxHeight: 100,
  overflow: "auto",
  animation: `${Tv} 300ms, ${cf} 300ms`,
  backgroundColor: e.background.critical,
  color: e.color.lightest,
  fontSize: e.typography.size.s2,
  "& > div": {
    position: "relative",
    padding: "8px 16px"
  }
})), Fv = /* @__PURE__ */ o(({
  children: e,
  ...t
}) => /* @__PURE__ */ Mt.createElement(df, { ...t }, /* @__PURE__ */ Mt.createElement("div", null, e)), "Error");

// src/components/components/Modal/Modal.tsx
function Dv({
  children: e,
  width: t,
  height: r,
  onEscapeKeyDown: n,
  onInteractOutside: a = /* @__PURE__ */ o((u) => u.preventDefault(), "onInteractOutside"),
  className: i,
  container: c,
  portalSelector: l,
  ...s
}) {
  let u = c ?? (l ? document.querySelector(l) : null) ?? document.body;
  return /* @__PURE__ */ zr.createElement(s0, { ...s }, /* @__PURE__ */ zr.createElement(u0, { container: u }, /* @__PURE__ */ zr.createElement(
  f0, { asChild: !0 }, /* @__PURE__ */ zr.createElement(v0, null)), /* @__PURE__ */ zr.createElement(
    d0,
    {
      asChild: !0,
      onInteractOutside: a,
      onEscapeKeyDown: n
    },
    /* @__PURE__ */ zr.createElement(w0, { className: i, width: t, height: r }, e)
  )));
}
o(Dv, "BaseModal");
var _v = Object.assign(Dv, b0, { Dialog: Ro });

// src/components/components/spaced/Spaced.tsx
import $v from "react";
import { ignoreSsrWarning as pf, styled as Vv } from "storybook/theming";
var jv = /* @__PURE__ */ o((e) => typeof e == "number" ? e : Number(e), "toNumber"), Wv = Vv.div(
  ({ theme: e, col: t, row: r = 1 }) => t ? {
    display: "inline-block",
    verticalAlign: "inherit",
    "& > *": {
      marginLeft: t * e.layoutMargin,
      verticalAlign: "inherit"
    },
    [`& > *:first-child${pf}`]: {
      marginLeft: 0
    }
  } : {
    "& > *": {
      marginTop: r * e.layoutMargin
    },
    [`& > *:first-child${pf}`]: {
      marginTop: 0
    }
  },
  ({ theme: e, outer: t, col: r, row: n }) => {
    switch (!0) {
      case !!(t && r):
        return {
          marginLeft: t * e.layoutMargin,
          marginRight: t * e.layoutMargin
        };
      case !!(t && n):
        return {
          marginTop: t * e.layoutMargin,
          marginBottom: t * e.layoutMargin
        };
      default:
        return {};
    }
  }
), Uv = /* @__PURE__ */ o(({ col: e, row: t, outer: r, children: n, ...a }) => {
  let i = jv(typeof r == "number" || !r ? r : e || t);
  return /* @__PURE__ */ $v.createElement(Wv, { col: e, row: t, outer: i, ...a }, n);
}, "Spaced");

// src/components/components/placeholder/placeholder.tsx
import y0, { Children as qv } from "react";
import { styled as R0 } from "storybook/theming";
var Gv = R0.div(({ theme: e }) => ({
  fontWeight: e.typography.weight.bold
})), Yv = R0.div(), Xv = R0.div(({ theme: e }) => ({
  padding: 30,
  textAlign: "center",
  color: e.color.defaultText,
  fontSize: e.typography.size.s2 - 1
})), Zv = /* @__PURE__ */ o(({ children: e, ...t }) => {
  let [r, n] = qv.toArray(e);
  return /* @__PURE__ */ y0.createElement(Xv, { ...t }, /* @__PURE__ */ y0.createElement(Gv, null, r), n && /* @__PURE__ */ y0.createElement(
  Yv, null, n));
}, "Placeholder");

// src/components/index.ts
ro();

// src/components/components/Zoom/ZoomElement.tsx
import hf, { useCallback as e3, useEffect as t3, useRef as r3, useState as n3 } from "react";
import { styled as o3 } from "storybook/theming";

// ../node_modules/use-resize-observer/dist/bundle.esm.js
import { useRef as Zt, useEffect as x0, useCallback as E0, useState as Kv, useMemo as Jv } from "react";
function Qv(e, t) {
  var r = Zt(null), n = Zt(null);
  n.current = t;
  var a = Zt(null);
  x0(function() {
    i();
  });
  var i = E0(function() {
    var c = a.current, l = n.current, s = c || (l ? l instanceof Element ? l : l.current : null);
    r.current && r.current.element === s && r.current.subscriber === e || (r.current && r.current.cleanup && r.current.cleanup(), r.current =
    {
      element: s,
      subscriber: e,
      // Only calling the subscriber, if there's an actual element to report.
      // Setting cleanup to undefined unless a subscriber returns one, as an existing cleanup function would've been just called.
      cleanup: s ? e(s) : void 0
    });
  }, [e]);
  return x0(function() {
    return function() {
      r.current && r.current.cleanup && (r.current.cleanup(), r.current = null);
    };
  }, []), E0(function(c) {
    a.current = c, i();
  }, [i]);
}
o(Qv, "useResolvedElement");
function mf(e, t, r) {
  return e[t] ? e[t][0] ? e[t][0][r] : (
    // TS complains about this, because the RO entry type follows the spec and does not reflect Firefox's current
    // behaviour of returning objects instead of arrays for `borderBoxSize` and `contentBoxSize`.
    // @ts-ignore
    e[t][r]
  ) : t === "contentBoxSize" ? e.contentRect[r === "inlineSize" ? "width" : "height"] : void 0;
}
o(mf, "extractSize");
function Eo(e) {
  e === void 0 && (e = {});
  var t = e.onResize, r = Zt(void 0);
  r.current = t;
  var n = e.round || Math.round, a = Zt(), i = Kv({
    width: void 0,
    height: void 0
  }), c = i[0], l = i[1], s = Zt(!1);
  x0(function() {
    return s.current = !1, function() {
      s.current = !0;
    };
  }, []);
  var u = Zt({
    width: void 0,
    height: void 0
  }), f = Qv(E0(function(d) {
    return (!a.current || a.current.box !== e.box || a.current.round !== n) && (a.current = {
      box: e.box,
      round: n,
      instance: new ResizeObserver(function(m) {
        var v = m[0], y = e.box === "border-box" ? "borderBoxSize" : e.box === "device-pixel-content-box" ? "devicePixelContentBoxSize" : "c\
ontentBoxSize", p = mf(v, y, "inlineSize"), h = mf(v, y, "blockSize"), g = p ? n(p) : void 0, w = h ? n(h) : void 0;
        if (u.current.width !== g || u.current.height !== w) {
          var b = {
            width: g,
            height: w
          };
          u.current.width = g, u.current.height = w, r.current ? r.current(b) : s.current || l(b);
        }
      })
    }), a.current.instance.observe(d, {
      box: e.box
    }), function() {
      a.current && a.current.instance.unobserve(d);
    };
  }, [e.box, n]), e.ref);
  return Jv(function() {
    return {
      ref: f,
      width: c.width,
      height: c.height
    };
  }, [f, c.width, c.height]);
}
o(Eo, "useResizeObserver");

// src/components/components/Zoom/ZoomElement.tsx
var a3 = o3.div(
  ({ centered: e = !1, scale: t = 1, elementHeight: r }) => ({
    height: r || "auto",
    transformOrigin: e ? "center top" : "left top",
    transform: `scale(${1 / t})`
  })
);
function gf({ centered: e, scale: t, children: r }) {
  let n = r3(null), [a, i] = n3(0), c = e3(
    ({ height: l }) => {
      l && i(l / t);
    },
    [t]
  );
  return t3(() => {
    n.current && i(n.current.getBoundingClientRect().height);
  }, [t]), Eo({
    ref: n,
    onResize: c
  }), /* @__PURE__ */ hf.createElement(a3, { centered: e, scale: t, elementHeight: a }, /* @__PURE__ */ hf.createElement("div", { ref: n, className: "\
innerZoomElementWrapper" }, r));
}
o(gf, "ZoomElement");

// src/components/components/Zoom/ZoomIFrame.tsx
import vf, { Component as i3 } from "react";
var S0 = class S0 extends i3 {
  constructor() {
    super(...arguments);
    // @ts-expect-error (non strict)
    this.iframe = null;
  }
  componentDidMount() {
    let { iFrameRef: r } = this.props;
    this.iframe = r.current;
  }
  shouldComponentUpdate(r) {
    let { scale: n, active: a } = this.props;
    return n !== r.scale && this.setIframeInnerZoom(r.scale), a !== r.active && this.iframe.setAttribute("data-is-storybook", r.active ? "tr\
ue" : "false"), r.children.props.src !== this.props.children.props.src;
  }
  setIframeInnerZoom(r) {
    try {
      Object.assign(this.iframe.contentDocument.body.style, {
        width: `${r * 100}%`,
        height: `${r * 100}%`,
        transform: `scale(${1 / r})`,
        transformOrigin: "top left"
      });
    } catch {
      this.setIframeZoom(r);
    }
  }
  setIframeZoom(r) {
    Object.assign(this.iframe.style, {
      width: `${r * 100}%`,
      height: `${r * 100}%`,
      transform: `scale(${1 / r})`,
      transformOrigin: "top left"
    });
  }
  render() {
    let { children: r } = this.props;
    return /* @__PURE__ */ vf.createElement(vf.Fragment, null, r);
  }
};
o(S0, "ZoomIFrame");
var So = S0;

// src/components/components/Zoom/Zoom.tsx
var l3 = {
  Element: gf,
  IFrame: So
};

// src/components/components/ErrorFormatter/ErrorFormatter.tsx
import Te, { Fragment as Tr } from "react";
import { global as c3 } from "@storybook/global";
import { styled as C0 } from "storybook/theming";
var { document: s3 } = c3, u3 = C0.strong(({ theme: e }) => ({
  color: e.color.orange
})), f3 = C0.strong(({ theme: e }) => ({
  color: e.color.ancillary,
  textDecoration: "underline"
})), wf = C0.em(({ theme: e }) => ({
  color: e.textMutedColor
})), d3 = /(Error): (.*)\n/, p3 = /at (?:(.*) )?\(?(.+)\)?/, m3 = /([^@]+)?(?:\/<)?@(.+)?/, h3 = /([^@]+)?@(.+)?/, g3 = /* @__PURE__ */ o(({
error: e }) => {
  if (!e)
    return /* @__PURE__ */ Te.createElement(Tr, null, "This error has no stack or message");
  if (!e.stack)
    return /* @__PURE__ */ Te.createElement(Tr, null, e.message || "This error has no stack or message");
  let t = e.stack.toString();
  t && e.message && !t.includes(e.message) && (t = `Error: ${e.message}

${t}`);
  let r = t.match(d3);
  if (!r)
    return /* @__PURE__ */ Te.createElement(Tr, null, t);
  let [, n, a] = r, i = t.split(/\n/).slice(1), [, ...c] = i.map((l) => {
    let s = l.match(p3) || l.match(m3) || l.match(h3);
    return s ? {
      name: (s[1] || "").replace("/<", ""),
      location: s[2].replace(s3.location.origin, "")
    } : null;
  }).filter(Boolean);
  return /* @__PURE__ */ Te.createElement(Tr, null, /* @__PURE__ */ Te.createElement("span", null, n), ": ", /* @__PURE__ */ Te.createElement(
  u3, null, a), /* @__PURE__ */ Te.createElement("br", null), c.map(
    (l, s) => l?.name ? /* @__PURE__ */ Te.createElement(Tr, { key: s }, "  ", "at ", /* @__PURE__ */ Te.createElement(f3, null, l.name), " \
(", /* @__PURE__ */ Te.createElement(wf, null, l.location), ")", /* @__PURE__ */ Te.createElement("br", null)) : /* @__PURE__ */ Te.createElement(
    Tr, { key: s }, "  ", "at ", /* @__PURE__ */ Te.createElement(wf, null, l?.location), /* @__PURE__ */ Te.createElement("br", null))
  ));
}, "ErrorFormatter");

// src/components/components/Form/Form.tsx
import { styled as X3 } from "storybook/theming";

// src/components/components/Form/Checkbox.tsx
import v3 from "react";
import { color as gn, styled as w3 } from "storybook/internal/theming";
var b3 = w3.input({
  appearance: "none",
  display: "grid",
  placeContent: "center",
  width: 14,
  height: 14,
  flexShrink: 0,
  margin: 0,
  border: `1px solid ${gn.border}`,
  borderRadius: 2,
  backgroundColor: "white",
  transition: "background-color 0.1s",
  "&:enabled": {
    cursor: "pointer"
  },
  "&:disabled": {
    backgroundColor: gn.medium
  },
  "&:disabled:checked, &:disabled:indeterminate": {
    backgroundColor: gn.mediumdark
  },
  "&:checked, &:indeterminate": {
    backgroundColor: gn.secondary
  },
  "&:checked::before": {
    content: '""',
    width: 14,
    height: 14,
    background: `no-repeat center url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14'%3E%3Cpath fill='n\
one' stroke='%23fff' stroke-width='2' d='m3 7 2.5 2.5L11 4'/%3E%3C/svg%3E")`
  },
  "&:indeterminate::before": {
    content: '""',
    width: 8,
    height: 2,
    background: "white"
  },
  "&:enabled:focus-visible": {
    outline: `1px solid ${gn.secondary}`,
    outlineOffset: 1
  }
}), bf = /* @__PURE__ */ o((e) => /* @__PURE__ */ v3.createElement(b3, { ...e, type: "checkbox" }), "Checkbox");

// src/components/components/Form/Field.tsx
import M0 from "react";
import { styled as yf } from "storybook/theming";
var y3 = yf.label(({ theme: e }) => ({
  display: "flex",
  borderBottom: `1px solid ${e.appBorderColor}`,
  margin: "0 15px",
  padding: "8px 0",
  "&:last-child": {
    marginBottom: "3rem"
  }
})), R3 = yf.span(({ theme: e }) => ({
  minWidth: 100,
  fontWeight: e.typography.weight.bold,
  marginRight: 15,
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  lineHeight: "16px"
})), Rf = /* @__PURE__ */ o(({ label: e, children: t, ...r }) => /* @__PURE__ */ M0.createElement(y3, { ...r }, e ? /* @__PURE__ */ M0.createElement(
R3, null, /* @__PURE__ */ M0.createElement("span", null, e)) : null, t), "Field");

// src/components/components/Form/Input.tsx
import E3 from "react";
import { forwardRef as S3 } from "react";
import { styled as C3 } from "storybook/theming";

// src/components/components/Form/styles.ts
var Hr = /* @__PURE__ */ o(({ size: e }) => {
  switch (e) {
    case "100%":
      return { width: "100%" };
    case "flex":
      return { flex: 1 };
    case "auto":
    default:
      return { display: "inline" };
  }
}, "sizes"), Co = /* @__PURE__ */ o(({
  align: e
}) => {
  switch (e) {
    case "end":
      return { textAlign: "right" };
    case "center":
      return { textAlign: "center" };
    case "start":
    default:
      return { textAlign: "left" };
  }
}, "alignment"), Mo = /* @__PURE__ */ o(({
  valid: e,
  theme: t
}) => {
  switch (e) {
    case "valid":
      return { boxShadow: `${t.color.positive} 0 0 0 1px inset !important` };
    case "error":
      return { boxShadow: `${t.color.negative} 0 0 0 1px inset !important` };
    case "warn":
      return {
        boxShadow: `${t.color.warning} 0 0 0 1px inset`
      };
    case void 0:
    case null:
    default:
      return {};
  }
}, "validation"), x3 = {
  // resets
  appearance: "none",
  border: "0 none",
  boxSizing: "inherit",
  display: " block",
  margin: " 0",
  background: "transparent",
  padding: 0,
  fontSize: "inherit",
  position: "relative"
}, Ao = /* @__PURE__ */ o(({ theme: e }) => ({
  ...x3,
  transition: "box-shadow 200ms ease-out, opacity 200ms ease-out",
  color: e.input.color || "inherit",
  background: e.input.background,
  boxShadow: `${e.input.border} 0 0 0 1px inset`,
  borderRadius: e.input.borderRadius,
  fontSize: e.typography.size.s2 - 1,
  lineHeight: "20px",
  padding: "6px 10px",
  // 32
  boxSizing: "border-box",
  height: 32,
  '&[type="file"]': {
    height: "auto"
  },
  "&:focus": {
    boxShadow: `${e.color.secondary} 0 0 0 1px inset`,
    outline: "none",
    "@media (forced-colors: active)": {
      outline: "1px solid highlight"
    }
  },
  "&[disabled]": {
    cursor: "not-allowed",
    opacity: 0.5
  },
  "&:-webkit-autofill": { WebkitBoxShadow: `0 0 0 3em ${e.color.lightest} inset` },
  "&::placeholder": {
    color: e.textMutedColor,
    opacity: 1
  }
}), "styles");

// src/components/components/Form/Input.tsx
var xf = Object.assign(
  C3(
    S3(/* @__PURE__ */ o(function({ size: t, valid: r, align: n, ...a }, i) {
      return /* @__PURE__ */ E3.createElement("input", { ...a, ref: i });
    }, "Input"))
  )(Ao, Hr, Co, Mo, {
    minHeight: 32
  }),
  {
    displayName: "Input"
  }
);

// src/components/components/Form/Radio.tsx
import M3 from "react";
import { color as vn, styled as A3 } from "storybook/internal/theming";
var L3 = A3.input({
  appearance: "none",
  display: "grid",
  placeContent: "center",
  width: 16,
  height: 16,
  flexShrink: 0,
  margin: -1,
  border: `1px solid ${vn.border}`,
  borderRadius: 8,
  backgroundColor: "white",
  transition: "background-color 0.1s",
  "&:enabled": {
    cursor: "pointer"
  },
  "&:disabled": {
    backgroundColor: vn.medium
  },
  "&:disabled:checked": {
    backgroundColor: vn.mediumdark
  },
  "&:checked": {
    backgroundColor: vn.secondary,
    boxShadow: "inset 0 0 0 2px white"
  },
  "&:enabled:focus-visible": {
    outline: `1px solid ${vn.secondary}`,
    outlineOffset: 1
  }
}), Ef = /* @__PURE__ */ o((e) => /* @__PURE__ */ M3.createElement(L3, { ...e, type: "radio" }), "Radio");

// src/components/components/Form/Select.tsx
import Pr from "react";
import { lighten as I3, styled as z3 } from "storybook/theming";

// src/preview-api/modules/preview-web/render/animation-utils.ts
function Sf() {
  try {
    return (
      // @ts-expect-error This property exists in Vitest browser mode
      !!globalThis.__vitest_browser__ || !!globalThis.window?.navigator?.userAgent?.match(/StorybookTestRunner/)
    );
  } catch {
    return !1;
  }
}
o(Sf, "isTestEnvironment");

// src/components/components/Form/Select.tsx
var T3 = z3.select(Hr, ({ theme: e }) => ({
  appearance: "none",
  background: `calc(100% - 12px) center no-repeat url("data:image/svg+xml,%3Csvg width='8' height='4' viewBox='0 0 8 4' fill='none' xmlns='h\
ttp://www.w3.org/2000/svg'%3E%3Cpath d='M1.30303 0.196815C1.13566 0.0294472 0.864304 0.0294472 0.696937 0.196815C0.529569 0.364182 0.529569 \
0.635539 0.696937 0.802906L3.69694 3.80291C3.8643 3.97027 4.13566 3.97027 4.30303 3.80291L7.30303 0.802906C7.4704 0.635539 7.4704 0.364182 7\
.30303 0.196815C7.13566 0.0294473 6.8643 0.0294473 6.69694 0.196815L3.99998 2.89377L1.30303 0.196815Z' fill='%2373828C'/%3E%3C/svg%3E%0A")`,
  backgroundSize: 10,
  padding: "6px 30px 6px 10px",
  "@supports (appearance: base-select)": {
    appearance: "base-select",
    background: e.input.background,
    padding: "6px 10px"
  },
  transition: "box-shadow 200ms ease-out, opacity 200ms ease-out",
  color: e.input.color || "inherit",
  boxShadow: `${e.input.border} 0 0 0 1px inset`,
  borderRadius: e.input.borderRadius,
  fontSize: e.typography.size.s2 - 1,
  lineHeight: "20px",
  boxSizing: "border-box",
  border: "none",
  cursor: "pointer",
  "& > button": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: 8,
    "& > svg": {
      width: 14,
      height: 14,
      color: e.color.mediumdark
    }
  },
  "&:has(option:not([hidden]):checked)": {
    color: e.color.defaultText
  },
  "&:focus-visible, &:focus-within": {
    outline: "none",
    boxShadow: `${e.color.secondary} 0 0 0 1px inset`
  },
  "&::picker-icon": {
    display: "none"
  },
  "&::picker(select)": {
    appearance: "base-select",
    border: "1px solid #e4e4e7",
    padding: 4,
    marginTop: 4,
    background: e.base === "light" ? I3(e.background.app) : e.background.app,
    filter: `
      drop-shadow(0 5px 5px rgba(0,0,0,0.05))
      drop-shadow(0 0 3px rgba(0,0,0,0.1))
    `,
    borderRadius: e.appBorderRadius + 2,
    fontSize: e.typography.size.s1,
    cursor: "default",
    transition: "opacity 100ms ease-in-out, transform 100ms ease-in-out",
    transformOrigin: "top",
    transform: "translateY(0)",
    opacity: 1,
    "@starting-style": {
      transform: "translateY(-0.25rem) scale(0.95)",
      opacity: 0
    }
  },
  "& optgroup label": {
    display: "block",
    padding: "3px 6px"
  },
  "& option": {
    lineHeight: "18px",
    padding: "7px 10px",
    borderRadius: 4,
    outline: "none",
    cursor: "pointer",
    color: e.color.defaultText,
    "&::checkmark": {
      display: "none"
    },
    "&:hover, &:focus-visible": {
      backgroundColor: e.background.hoverable
    },
    "&:checked": {
      color: e.color.secondary,
      fontWeight: e.typography.weight.bold
    },
    "&:disabled": {
      backgroundColor: "transparent",
      cursor: "default",
      color: e.color.defaultText
    }
  }
})), Cf = /* @__PURE__ */ o(({ children: e, ...t }) => (
  // @ts-expect-error Weird props mismatch
  /* @__PURE__ */ Pr.createElement(T3, { ...t }, !Sf() && /* @__PURE__ */ Pr.createElement("button", null, /* @__PURE__ */ Pr.createElement(
  "selectedcontent", null), /* @__PURE__ */ Pr.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    /* @__PURE__ */ Pr.createElement("path", { d: "m6 9 6 6 6-6" })
  )), /* @__PURE__ */ Pr.createElement("optgroup", null, e))
), "Select");

// src/components/components/Form/Textarea.tsx
import q3, { forwardRef as G3 } from "react";

// ../node_modules/react-textarea-autosize/dist/react-textarea-autosize.browser.esm.js
Kr();
Bn();
import * as Ke from "react";

// ../node_modules/use-latest/dist/use-latest.esm.js
import P3 from "react";

// ../node_modules/use-isomorphic-layout-effect/dist/use-isomorphic-layout-effect.browser.esm.js
import { useLayoutEffect as H3 } from "react";
var Mf = H3;

// ../node_modules/use-latest/dist/use-latest.esm.js
var Af = /* @__PURE__ */ o(function(t) {
  var r = P3.useRef(t);
  return Mf(function() {
    r.current = t;
  }), r;
}, "useLatest");

// ../node_modules/use-composed-ref/dist/use-composed-ref.esm.js
import Lf from "react";
var If = /* @__PURE__ */ o(function(t, r) {
  if (typeof t == "function") {
    t(r);
    return;
  }
  t.current = r;
}, "updateRef"), zf = /* @__PURE__ */ o(function(t, r) {
  var n = Lf.useRef();
  return Lf.useCallback(function(a) {
    t.current = a, n.current && If(n.current, null), n.current = r, r && If(r, a);
  }, [r]);
}, "useComposedRef");

// ../node_modules/react-textarea-autosize/dist/react-textarea-autosize.browser.esm.js
var Tf = {
  "min-height": "0",
  "max-height": "none",
  height: "0",
  visibility: "hidden",
  overflow: "hidden",
  position: "absolute",
  "z-index": "-1000",
  top: "0",
  right: "0",
  display: "block"
}, k3 = /* @__PURE__ */ o(function(t) {
  Object.keys(Tf).forEach(function(r) {
    t.style.setProperty(r, Tf[r], "important");
  });
}, "forceHiddenStyles"), Hf = k3, Re = null, Pf = /* @__PURE__ */ o(function(t, r) {
  var n = t.scrollHeight;
  return r.sizingStyle.boxSizing === "border-box" ? n + r.borderSize : n - r.paddingSize;
}, "getHeight");
function O3(e, t, r, n) {
  r === void 0 && (r = 1), n === void 0 && (n = 1 / 0), Re || (Re = document.createElement("textarea"), Re.setAttribute("tabindex", "-1"), Re.
  setAttribute("aria-hidden", "true"), Hf(Re)), Re.parentNode === null && document.body.appendChild(Re);
  var a = e.paddingSize, i = e.borderSize, c = e.sizingStyle, l = c.boxSizing;
  Object.keys(c).forEach(function(m) {
    var v = m;
    Re.style[v] = c[v];
  }), Hf(Re), Re.value = t;
  var s = Pf(Re, e);
  Re.value = t, s = Pf(Re, e), Re.value = "x";
  var u = Re.scrollHeight - a, f = u * r;
  l === "border-box" && (f = f + a + i), s = Math.max(f, s);
  var d = u * n;
  return l === "border-box" && (d = d + a + i), s = Math.min(d, s), [s, u];
}
o(O3, "calculateNodeHeight");
var kf = /* @__PURE__ */ o(function() {
}, "noop"), B3 = /* @__PURE__ */ o(function(t, r) {
  return t.reduce(function(n, a) {
    return n[a] = r[a], n;
  }, {});
}, "pick"), N3 = [
  "borderBottomWidth",
  "borderLeftWidth",
  "borderRightWidth",
  "borderTopWidth",
  "boxSizing",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  // non-standard
  "tabSize",
  "textIndent",
  // non-standard
  "textRendering",
  "textTransform",
  "width",
  "wordBreak",
  "wordSpacing",
  "scrollbarGutter"
], F3 = !!document.documentElement.currentStyle, D3 = /* @__PURE__ */ o(function(t) {
  var r = window.getComputedStyle(t);
  if (r === null)
    return null;
  var n = B3(N3, r), a = n.boxSizing;
  if (a === "")
    return null;
  F3 && a === "border-box" && (n.width = parseFloat(n.width) + parseFloat(n.borderRightWidth) + parseFloat(n.borderLeftWidth) + parseFloat(n.
  paddingRight) + parseFloat(n.paddingLeft) + "px");
  var i = parseFloat(n.paddingBottom) + parseFloat(n.paddingTop), c = parseFloat(n.borderBottomWidth) + parseFloat(n.borderTopWidth);
  return {
    sizingStyle: n,
    paddingSize: i,
    borderSize: c
  };
}, "getSizingData"), _3 = D3;
function A0(e, t, r) {
  var n = Af(r);
  Ke.useLayoutEffect(function() {
    var a = /* @__PURE__ */ o(function(c) {
      return n.current(c);
    }, "handler");
    if (e)
      return e.addEventListener(t, a), function() {
        return e.removeEventListener(t, a);
      };
  }, []);
}
o(A0, "useListener");
var $3 = /* @__PURE__ */ o(function(t, r) {
  A0(document.body, "reset", function(n) {
    t.current.form === n.target && r(n);
  });
}, "useFormResetListener"), V3 = /* @__PURE__ */ o(function(t) {
  A0(window, "resize", t);
}, "useWindowResizeListener"), j3 = /* @__PURE__ */ o(function(t) {
  A0(document.fonts, "loadingdone", t);
}, "useFontsLoadedListener"), W3 = ["cacheMeasurements", "maxRows", "minRows", "onChange", "onHeightChange"], U3 = /* @__PURE__ */ o(function(t, r) {
  var n = t.cacheMeasurements, a = t.maxRows, i = t.minRows, c = t.onChange, l = c === void 0 ? kf : c, s = t.onHeightChange, u = s === void 0 ?
  kf : s, f = ur(t, W3), d = f.value !== void 0, m = Ke.useRef(null), v = zf(m, r), y = Ke.useRef(0), p = Ke.useRef(), h = /* @__PURE__ */ o(
  function() {
    var b = m.current, x = n && p.current ? p.current : _3(b);
    if (x) {
      p.current = x;
      var E = O3(x, b.value || b.placeholder || "x", i, a), R = E[0], S = E[1];
      y.current !== R && (y.current = R, b.style.setProperty("height", R + "px", "important"), u(R, {
        rowHeight: S
      }));
    }
  }, "resizeTextarea"), g = /* @__PURE__ */ o(function(b) {
    d || h(), l(b);
  }, "handleChange");
  return Ke.useLayoutEffect(h), $3(m, function() {
    if (!d) {
      var w = m.current.value;
      requestAnimationFrame(function() {
        var b = m.current;
        b && w !== b.value && h();
      });
    }
  }), V3(h), j3(h), /* @__PURE__ */ Ke.createElement("textarea", W({}, f, {
    onChange: g,
    ref: v
  }));
}, "TextareaAutosize"), Of = /* @__PURE__ */ Ke.forwardRef(U3);

// src/components/components/Form/Textarea.tsx
import { styled as Y3 } from "storybook/theming";
var Bf = Object.assign(
  Y3(
    G3(/* @__PURE__ */ o(function({ size: t, valid: r, align: n, ...a }, i) {
      return /* @__PURE__ */ q3.createElement(Of, { ...a, ref: i });
    }, "Textarea"))
  )(Ao, Hr, Co, Mo, ({ height: e = 400 }) => ({
    overflow: "visible",
    maxHeight: e
  })),
  {
    displayName: "Textarea"
  }
);

// src/components/components/Form/Form.tsx
var Z3 = Object.assign(
  X3.form({
    boxSizing: "border-box",
    width: "100%"
  }),
  {
    Field: Rf,
    Input: xf,
    Select: Cf,
    Textarea: Bf,
    Button: Ir,
    Checkbox: bf,
    Radio: Ef
  }
);

// src/components/components/tooltip/lazy-WithTooltip.tsx
import jr, { Suspense as Xd, lazy as Zd } from "react";
var G7 = Zd(
  () => Promise.resolve().then(() => (Vo(), al)).then((e) => ({ default: e.WithTooltip }))
), Y7 = /* @__PURE__ */ o((e) => /* @__PURE__ */ jr.createElement(Xd, { fallback: /* @__PURE__ */ jr.createElement("div", null) }, /* @__PURE__ */ jr.
createElement(G7, { ...e })), "WithTooltip"), X7 = Zd(
  () => Promise.resolve().then(() => (Vo(), al)).then((e) => ({ default: e.WithTooltipPure }))
), Z7 = /* @__PURE__ */ o((e) => /* @__PURE__ */ jr.createElement(Xd, { fallback: /* @__PURE__ */ jr.createElement("div", null) }, /* @__PURE__ */ jr.
createElement(X7, { ...e })), "WithTooltipPure");

// src/components/components/tooltip/TooltipMessage.tsx
import Wr from "react";
import { styled as Ln } from "storybook/theming";
var K7 = Ln.div(({ theme: e }) => ({
  fontWeight: e.typography.weight.bold
})), J7 = Ln.span(), Q7 = Ln.div(({ theme: e }) => ({
  marginTop: 8,
  textAlign: "center",
  "> *": {
    margin: "0 8px",
    fontWeight: e.typography.weight.bold
  }
})), e6 = Ln.div(({ theme: e }) => ({
  color: e.color.defaultText,
  lineHeight: "18px"
})), t6 = Ln.div({
  padding: 15,
  width: 280,
  boxSizing: "border-box"
}), r6 = /* @__PURE__ */ o(({ title: e, desc: t, links: r }) => /* @__PURE__ */ Wr.createElement(t6, null, /* @__PURE__ */ Wr.createElement(
e6, null, e && /* @__PURE__ */ Wr.createElement(K7, null, e), t && /* @__PURE__ */ Wr.createElement(J7, null, t)), r && /* @__PURE__ */ Wr.createElement(
Q7, null, r.map(({ title: n, ...a }) => /* @__PURE__ */ Wr.createElement(Ai, { ...a, key: n }, n)))), "TooltipMessage");

// src/components/components/tooltip/TooltipNote.tsx
import n6 from "react";
import { styled as o6 } from "storybook/theming";
var a6 = o6.div(({ theme: e }) => ({
  padding: "2px 6px",
  lineHeight: "16px",
  fontSize: 10,
  fontWeight: e.typography.weight.bold,
  color: e.color.lightest,
  boxShadow: "0 0 5px 0 rgba(0, 0, 0, 0.3)",
  borderRadius: 4,
  whiteSpace: "nowrap",
  pointerEvents: "none",
  zIndex: -1,
  background: e.base === "light" ? "rgba(60, 60, 60, 0.9)" : "rgba(0, 0, 0, 0.95)",
  margin: 6
})), i6 = /* @__PURE__ */ o(({ note: e, ...t }) => /* @__PURE__ */ n6.createElement(a6, { ...t }, e), "TooltipNote");

// src/components/components/tooltip/TooltipLinkList.tsx
import In, { Fragment as h6, useCallback as g6 } from "react";
import { styled as Jd } from "storybook/theming";

// src/components/components/tooltip/ListItem.tsx
var Kd = me(Qr(), 1);
import nt from "react";
import { styled as Ur } from "storybook/theming";
var l6 = Ur(({ active: e, loading: t, disabled: r, ...n }) => /* @__PURE__ */ nt.createElement("span", { ...n }))(
  ({ theme: e }) => ({
    color: e.color.defaultText,
    // Previously was theme.typography.weight.normal but this weight does not exists in Theme
    fontWeight: e.typography.weight.regular
  }),
  ({ active: e, theme: t }) => e ? {
    color: t.color.secondary,
    fontWeight: t.typography.weight.bold
  } : {},
  ({ loading: e, theme: t }) => e ? {
    display: "inline-block",
    flex: "none",
    ...t.animation.inlineGlow
  } : {},
  ({ disabled: e, theme: t }) => e ? {
    color: t.textMutedColor
  } : {}
), c6 = Ur.span({
  display: "flex",
  "& svg": {
    height: 12,
    width: 12,
    margin: "3px 0",
    verticalAlign: "top"
  },
  "& path": {
    fill: "inherit"
  }
}), s6 = Ur.span(
  {
    flex: 1,
    textAlign: "left",
    display: "flex",
    flexDirection: "column"
  },
  ({ isIndented: e }) => e ? { marginLeft: 24 } : {}
), u6 = Ur.span(
  ({ theme: e }) => ({
    fontSize: "11px",
    lineHeight: "14px"
  }),
  ({ active: e, theme: t }) => e ? {
    color: t.color.secondary
  } : {},
  ({ theme: e, disabled: t }) => t ? {
    color: e.textMutedColor
  } : {}
), f6 = Ur.span(
  ({ active: e, theme: t }) => e ? {
    color: t.color.secondary
  } : {},
  () => ({
    display: "flex",
    maxWidth: 14
  })
), d6 = Ur.div(
  ({ theme: e }) => ({
    width: "100%",
    border: "none",
    borderRadius: e.appBorderRadius,
    background: "none",
    fontSize: e.typography.size.s1,
    transition: "all 150ms ease-out",
    color: e.color.dark,
    textDecoration: "none",
    justifyContent: "space-between",
    lineHeight: "18px",
    padding: "7px 10px",
    display: "flex",
    alignItems: "center",
    "& > * + *": {
      paddingLeft: 10
    }
  }),
  ({ theme: e, href: t, onClick: r }) => (t || r) && {
    cursor: "pointer",
    "&:hover": {
      background: e.background.hoverable
    },
    "&:hover svg": {
      opacity: 1
    }
  },
  ({ theme: e, as: t }) => t === "label" && {
    "&:has(input:not(:disabled))": {
      cursor: "pointer",
      "&:hover": {
        background: e.background.hoverable
      }
    }
  },
  ({ disabled: e }) => e && { cursor: "not-allowed" }
), p6 = (0, Kd.default)(100)(({ onClick: e, input: t, href: r, LinkWrapper: n }) => ({
  ...e && {
    as: "button",
    onClick: e
  },
  ...t && {
    as: "label"
  },
  ...r && {
    as: "a",
    href: r,
    ...n && {
      as: n,
      to: r
    }
  }
})), m6 = /* @__PURE__ */ o((e) => {
  let {
    loading: t = !1,
    title: r = /* @__PURE__ */ nt.createElement("span", null, "Loading state"),
    center: n = null,
    right: a = null,
    active: i = !1,
    disabled: c = !1,
    isIndented: l = !1,
    href: s = void 0,
    onClick: u = void 0,
    icon: f,
    input: d,
    LinkWrapper: m = void 0,
    ...v
  } = e, y = { active: i, disabled: c }, p = p6(e), h = f || d;
  return /* @__PURE__ */ nt.createElement(d6, { ...v, ...y, ...p }, /* @__PURE__ */ nt.createElement(nt.Fragment, null, h && /* @__PURE__ */ nt.
  createElement(f6, { ...y }, h), r || n ? /* @__PURE__ */ nt.createElement(s6, { isIndented: l && !h }, r && /* @__PURE__ */ nt.createElement(
  l6, { ...y, loading: t }, r), n && /* @__PURE__ */ nt.createElement(u6, { ...y }, n)) : null, a && /* @__PURE__ */ nt.createElement(c6, { ...y },
  a)));
}, "ListItem"), il = m6;

// src/components/components/tooltip/TooltipLinkList.tsx
var v6 = Jd.div(
  {
    minWidth: 180,
    overflow: "hidden",
    overflowY: "auto",
    maxHeight: 15.5 * 32 + 8
    // 15.5 items at 32px each + 8px padding
  },
  ({ theme: e }) => ({
    borderRadius: e.appBorderRadius + 2
  }),
  ({ theme: e }) => e.base === "dark" ? { background: e.background.content } : {}
), w6 = Jd.div(({ theme: e }) => ({
  padding: 4,
  "& + &": {
    borderTop: `1px solid ${e.appBorderColor}`
  }
})), b6 = /* @__PURE__ */ o(({ id: e, onClick: t, ...r }) => {
  let { active: n, disabled: a, title: i, href: c } = r, l = g6(
    (s) => t?.(s, { id: e, active: n, disabled: a, title: i, href: c }),
    [t, e, n, a, i, c]
  );
  return /* @__PURE__ */ In.createElement(il, { id: `list-item-${e}`, ...r, ...t && { onClick: l } });
}, "Item"), ll = /* @__PURE__ */ o(({ links: e, LinkWrapper: t, ...r }) => {
  let n = Array.isArray(e[0]) ? e : [e], a = n.some(
    (i) => i.some((c) => "icon" in c && c.icon || "input" in c && c.input)
  );
  return /* @__PURE__ */ In.createElement(v6, { ...r }, n.filter((i) => i.length).map((i, c) => /* @__PURE__ */ In.createElement(w6, { key: i.
  map((l) => l.id).join(`~${c}~`) }, i.map((l) => "content" in l ? /* @__PURE__ */ In.createElement(h6, { key: l.id }, l.content) : /* @__PURE__ */ In.
  createElement(b6, { key: l.id, isIndented: a, LinkWrapper: t, ...l })))));
}, "TooltipLinkList");

// src/components/components/tabs/tabs.tsx
import Be, { Component as ap, memo as _6, useMemo as $6 } from "react";
import { sanitize as V6 } from "storybook/internal/csf";
import { styled as hl } from "storybook/theming";

// src/components/components/bar/bar.tsx
ro();
import qr, { Children as y6 } from "react";
import { styled as sl } from "storybook/theming";
var cl = sl.div(
  {
    display: "flex",
    whiteSpace: "nowrap",
    flexBasis: "auto",
    marginLeft: 3,
    marginRight: 10
  },
  ({ scrollable: e }) => e ? { flexShrink: 0 } : {},
  ({ left: e }) => e ? {
    "& > *": {
      marginLeft: 4
    }
  } : {},
  ({ right: e }) => e ? {
    gap: 6
  } : {}
);
cl.displayName = "Side";
var R6 = /* @__PURE__ */ o(({ children: e, className: t, scrollable: r }) => r ? /* @__PURE__ */ qr.createElement(yr, { vertical: !1, className: t },
e) : /* @__PURE__ */ qr.createElement("div", { className: t }, e), "UnstyledBar"), ul = sl(R6)(
  ({ backgroundColor: e, theme: t, scrollable: r = !0 }) => ({
    color: t.barTextColor,
    width: "100%",
    minHeight: 40,
    flexShrink: 0,
    scrollbarColor: `${t.barTextColor} ${e || t.barBg}`,
    scrollbarWidth: "thin",
    overflow: r ? "auto" : "hidden",
    overflowY: "hidden"
  }),
  ({ theme: e, border: t = !1 }) => t ? {
    boxShadow: `${e.appBorderColor}  0 -1px 0 0 inset`,
    background: e.barBg
  } : {}
);
ul.displayName = "Bar";
var x6 = sl.div(({ bgColor: e }) => ({
  display: "flex",
  justifyContent: "space-between",
  position: "relative",
  flexWrap: "nowrap",
  flexShrink: 0,
  height: 40,
  backgroundColor: e || ""
})), jo = /* @__PURE__ */ o(({ children: e, backgroundColor: t, className: r, ...n }) => {
  let [a, i] = y6.toArray(e);
  return /* @__PURE__ */ qr.createElement(ul, { backgroundColor: t, className: `sb-bar ${r}`, ...n }, /* @__PURE__ */ qr.createElement(x6, {
  bgColor: t }, /* @__PURE__ */ qr.createElement(cl, { scrollable: n.scrollable, left: !0 }, a), i ? /* @__PURE__ */ qr.createElement(cl, { right: !0 },
  i) : null));
}, "FlexBar");
jo.displayName = "FlexBar";

// src/components/components/bar/button.tsx
import Qd, { forwardRef as E6 } from "react";
import { isPropValid as S6, styled as C6 } from "storybook/theming";
var M6 = /* @__PURE__ */ o((e) => typeof e.props.href == "string", "isLink"), A6 = /* @__PURE__ */ o((e) => typeof e.props.href != "string",
"isButton");
function L6({ children: e, ...t }, r) {
  let n = { props: t, ref: r };
  if (M6(n))
    return /* @__PURE__ */ Qd.createElement("a", { ref: n.ref, ...n.props }, e);
  if (A6(n))
    return /* @__PURE__ */ Qd.createElement("button", { ref: n.ref, type: "button", ...n.props }, e);
  throw new Error("invalid props");
}
o(L6, "ForwardRefFunction");
var ep = E6(L6);
ep.displayName = "ButtonOrLink";
var ar = C6(ep, { shouldForwardProp: S6 })(
  {
    whiteSpace: "normal",
    display: "inline-flex",
    overflow: "hidden",
    verticalAlign: "top",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    textDecoration: "none",
    "&:empty": {
      display: "none"
    },
    "&[hidden]": {
      display: "none"
    }
  },
  ({ theme: e }) => ({
    padding: "0 15px",
    transition: "color 0.2s linear, border-bottom-color 0.2s linear",
    height: 40,
    lineHeight: "12px",
    cursor: "pointer",
    background: "transparent",
    border: "0 solid transparent",
    borderTop: "3px solid transparent",
    borderBottom: "3px solid transparent",
    fontWeight: "bold",
    fontSize: 13,
    "&:focus": {
      outline: "0 none",
      borderBottomColor: e.barSelectedColor
    }
  }),
  ({ active: e, textColor: t, theme: r }) => e ? {
    color: t || r.barSelectedColor,
    borderBottomColor: r.barSelectedColor
  } : {
    color: t || r.barTextColor,
    borderBottomColor: "transparent",
    "&:hover": {
      color: r.barHoverColor
    }
  }
);
ar.displayName = "TabButton";

// src/components/components/tabs/EmptyTabContent.tsx
import Wo from "react";
import { styled as Uo } from "storybook/theming";
var I6 = Uo.div(({ theme: e }) => ({
  height: "100%",
  display: "flex",
  padding: 30,
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  gap: 15,
  background: e.background.content
})), z6 = Uo.div({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  maxWidth: 415
}), T6 = Uo.div(({ theme: e }) => ({
  fontWeight: e.typography.weight.bold,
  fontSize: e.typography.size.s2 - 1,
  textAlign: "center",
  color: e.textColor
})), H6 = Uo.div(({ theme: e }) => ({
  fontWeight: e.typography.weight.regular,
  fontSize: e.typography.size.s2 - 1,
  textAlign: "center",
  color: e.textMutedColor
})), qo = /* @__PURE__ */ o(({ title: e, description: t, footer: r }) => /* @__PURE__ */ Wo.createElement(I6, null, /* @__PURE__ */ Wo.createElement(
z6, null, /* @__PURE__ */ Wo.createElement(T6, null, e), t && /* @__PURE__ */ Wo.createElement(H6, null, t)), r), "EmptyTabContent");

// src/components/components/tabs/tabs.helpers.tsx
import P6, { Children as k6 } from "react";
import { styled as O6 } from "storybook/theming";
var fl = O6.div(
  ({ active: e }) => e ? { display: "block" } : { display: "none" }
), tp = /* @__PURE__ */ o((e) => k6.toArray(e).map(
  // @ts-expect-error (non strict)
  ({
    props: { title: t, id: r, color: n, children: a }
  }) => {
    let i = Array.isArray(
      a
    ) ? a[0] : a;
    return {
      title: t,
      id: r,
      ...n ? { color: n } : {},
      render: typeof i == "function" ? i : ({ active: l }) => /* @__PURE__ */ P6.createElement(fl, { active: l, role: "tabpanel" }, i)
    };
  }
), "childrenToList");

// src/components/components/tabs/tabs.hooks.tsx
import ir, { useCallback as rp, useLayoutEffect as B6, useRef as Go, useState as dl } from "react";
import { sanitize as N6 } from "storybook/internal/csf";
import { styled as np } from "storybook/theming";
Vo();
var F6 = np.span(({ theme: e, isActive: t }) => ({
  display: "inline-block",
  width: 0,
  height: 0,
  marginLeft: 8,
  color: t ? e.color.secondary : e.color.mediumdark,
  borderRight: "3px solid transparent",
  borderLeft: "3px solid transparent",
  borderTop: "3px solid",
  transition: "transform .1s ease-out"
})), D6 = np(ar)(({ active: e, theme: t, preActive: r }) => `
    color: ${r || e ? t.barSelectedColor : t.barTextColor};
    .addon-collapsible-icon {
      color: ${r || e ? t.barSelectedColor : t.barTextColor};
    }
    &:hover {
      color: ${t.barHoverColor};
      .addon-collapsible-icon {
        color: ${t.barHoverColor};
      }
    }
  `);
function op(e) {
  let t = Go(), r = Go(), n = Go(/* @__PURE__ */ new Map()), { width: a = 1 } = Eo({
    // @ts-expect-error (non strict)
    ref: t
  }), [i, c] = dl(e), [l, s] = dl([]), u = Go(e), f = rp(
    ({
      menuName: m,
      actions: v
    }) => {
      let y = l.some(({ active: g }) => g), [p, h] = dl(!1);
      return /* @__PURE__ */ ir.createElement(ir.Fragment, null, /* @__PURE__ */ ir.createElement(
        ol,
        {
          interactive: !0,
          visible: p,
          onVisibleChange: h,
          placement: "bottom",
          delayHide: 100,
          tooltip: /* @__PURE__ */ ir.createElement(
            ll,
            {
              links: l.map(({ title: g, id: w, color: b, active: x }) => ({
                id: w,
                title: g,
                color: b,
                active: x,
                onClick: /* @__PURE__ */ o((E) => {
                  E.preventDefault(), v.onSelect(w);
                }, "onClick")
              }))
            }
          )
        },
        /* @__PURE__ */ ir.createElement(
          D6,
          {
            id: "addons-menu-button",
            ref: r,
            active: y,
            preActive: p,
            style: { visibility: l.length ? "visible" : "hidden" },
            "aria-hidden": !l.length,
            className: "tabbutton",
            type: "button",
            role: "tab"
          },
          m,
          /* @__PURE__ */ ir.createElement(
            F6,
            {
              className: "addon-collapsible-icon",
              isActive: y || p
            }
          )
        )
      ), l.map(({ title: g, id: w, color: b }, x) => {
        let E = `index-${x}`;
        return /* @__PURE__ */ ir.createElement(
          ar,
          {
            id: `tabbutton-${N6(w) ?? E}`,
            style: { visibility: "hidden" },
            "aria-hidden": !0,
            tabIndex: -1,
            ref: (R) => {
              n.current.set(w, R);
            },
            className: "tabbutton",
            type: "button",
            key: w,
            textColor: b,
            role: "tab"
          },
          g
        );
      }));
    },
    [l]
  ), d = rp(() => {
    if (!t.current || !r.current)
      return;
    let { x: m, width: v } = t.current.getBoundingClientRect(), { width: y } = r.current.getBoundingClientRect(), p = l.length ? m + v - y :
    m + v, h = [], g = 0, w = e.filter((b) => {
      let { id: x } = b, E = n.current.get(x), { width: R = 0 } = E?.getBoundingClientRect() || {}, S = m + g + R > p;
      return (!S || !E) && h.push(b), g += R, S;
    });
    (h.length !== i.length || u.current !== e) && (c(h), s(w), u.current = e);
  }, [l.length, e, i]);
  return B6(d, [d, a]), {
    tabRefs: n,
    addonsRef: r,
    tabBarRef: t,
    visibleList: i,
    invisibleList: l,
    AddonTab: f
  };
}
o(op, "useList");

// src/components/components/tabs/tabs.tsx
var j6 = "/* emotion-disable-server-rendering-unsafe-selector-warning-please-do-not-use-this-the-warning-exists-for-a-reason */", W6 = hl.div(
  ({ theme: e, bordered: t }) => t ? {
    backgroundClip: "padding-box",
    border: `1px solid ${e.appBorderColor}`,
    borderRadius: e.appBorderRadius,
    overflow: "hidden",
    boxSizing: "border-box"
  } : {},
  ({ absolute: e }) => e ? {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column"
  } : {
    display: "block"
  }
), gl = hl.div({
  overflow: "hidden",
  "&:first-of-type": {
    marginLeft: -3
  },
  whiteSpace: "nowrap",
  flexGrow: 1
});
gl.displayName = "TabBar";
var U6 = hl.div(
  {
    display: "block",
    position: "relative",
    container: "tab-content / inline-size"
  },
  ({ theme: e }) => ({
    fontSize: e.typography.size.s2 - 1,
    background: e.background.content
  }),
  ({ bordered: e, theme: t }) => e ? {
    borderRadius: `0 0 ${t.appBorderRadius - 1}px ${t.appBorderRadius - 1}px`
  } : {},
  ({ absolute: e, bordered: t }) => e ? {
    height: `calc(100% - ${t ? 42 : 40}px)`,
    position: "absolute",
    left: 0 + (t ? 1 : 0),
    right: 0 + (t ? 1 : 0),
    bottom: 0 + (t ? 1 : 0),
    top: 40 + (t ? 1 : 0),
    overflow: "auto",
    [`& > *:first-child${j6}`]: {
      position: "absolute",
      left: 0 + (t ? 1 : 0),
      right: 0 + (t ? 1 : 0),
      bottom: 0 + (t ? 1 : 0),
      top: 0 + (t ? 1 : 0),
      height: `calc(100% - ${t ? 2 : 0}px)`,
      overflow: "auto"
    }
  } : {}
), q6 = /* @__PURE__ */ o(({ active: e, render: t, children: r }) => /* @__PURE__ */ Be.createElement(fl, { active: e }, t ? t() : r), "TabW\
rapper");
var wl = class wl extends ap {
  constructor(t) {
    super(t), this.state = { hasError: !1 };
  }
  static getDerivedStateFromError() {
    return { hasError: !0 };
  }
  componentDidCatch(t, r) {
    console.error("Error rendering addon panel"), console.error(t), console.error(r.componentStack);
  }
  render() {
    return this.state.hasError && this.props.active ? /* @__PURE__ */ Be.createElement(
      qo,
      {
        title: "This addon has errors",
        description: "Check your browser logs and addon code to pinpoint what went wrong. This issue was not caused by Storybook."
      }
    ) : this.props.children;
  }
};
o(wl, "TabErrorBoundary");
var pl = wl, vl = _6(
  ({
    children: e,
    selected: t = null,
    actions: r,
    absolute: n = !1,
    bordered: a = !1,
    tools: i = null,
    backgroundColor: c,
    id: l = null,
    menuName: s = "Tabs",
    emptyState: u,
    showToolsWhenEmpty: f
  }) => {
    let d = $6(
      () => tp(e).map((g, w) => ({
        ...g,
        active: t ? g.id === t : w === 0
      })),
      [e, t]
    ), { visibleList: m, tabBarRef: v, tabRefs: y, AddonTab: p } = op(d), h = u ?? /* @__PURE__ */ Be.createElement(qo, { title: "Nothing fo\
und" });
    return !f && d.length === 0 ? h : (
      // @ts-expect-error (non strict)
      /* @__PURE__ */ Be.createElement(W6, { absolute: n, bordered: a, id: l }, /* @__PURE__ */ Be.createElement(jo, { scrollable: !1, border: !0,
      backgroundColor: c }, /* @__PURE__ */ Be.createElement(gl, { style: { whiteSpace: "normal" }, ref: v, role: "tablist" }, m.map(({ title: g,
      id: w, active: b, color: x }, E) => {
        let R = `index-${E}`;
        return /* @__PURE__ */ Be.createElement(
          ar,
          {
            id: `tabbutton-${V6(w) ?? R}`,
            ref: (S) => {
              y.current.set(w, S);
            },
            className: `tabbutton ${b ? "tabbutton-active" : ""}`,
            type: "button",
            key: w,
            active: b,
            textColor: x,
            onClick: (S) => {
              S.preventDefault(), r.onSelect(w);
            },
            role: "tab"
          },
          typeof g == "function" ? /* @__PURE__ */ Be.createElement("title", null) : g
        );
      }), /* @__PURE__ */ Be.createElement(p, { menuName: s, actions: r })), i), /* @__PURE__ */ Be.createElement(U6, { id: "panel-tab-conte\
nt", bordered: a, absolute: n }, d.length ? d.map(({ id: g, active: w, render: b }) => /* @__PURE__ */ Be.createElement(pl, { key: g, active: w },
      Be.createElement(b, { active: w }, null))) : h))
    );
  }
);
vl.displayName = "Tabs";
var Yo = class Yo extends ap {
  constructor(r) {
    super(r);
    this.handlers = {
      onSelect: /* @__PURE__ */ o((r) => this.setState({ selected: r }), "onSelect")
    };
    this.state = {
      selected: r.initial
    };
  }
  render() {
    let { bordered: r = !1, absolute: n = !1, children: a, backgroundColor: i, menuName: c } = this.props, { selected: l } = this.state;
    return /* @__PURE__ */ Be.createElement(
      vl,
      {
        bordered: r,
        absolute: n,
        selected: l,
        backgroundColor: i,
        menuName: c,
        actions: this.handlers
      },
      a
    );
  }
};
o(Yo, "TabsState"), Yo.defaultProps = {
  children: [],
  // @ts-expect-error (non strict)
  initial: null,
  absolute: !1,
  bordered: !1,
  backgroundColor: "",
  // @ts-expect-error (non strict)
  menuName: void 0
};
var ml = Yo;

// src/components/components/bar/separator.tsx
import ip, { Fragment as G6 } from "react";
import { styled as Y6 } from "storybook/theming";
var bl = Y6.span(
  ({ theme: e }) => ({
    width: 1,
    height: 20,
    background: e.appBorderColor,
    marginLeft: 2,
    marginRight: 2
  }),
  ({ force: e }) => e ? {} : {
    "& + &": {
      display: "none"
    }
  }
);
bl.displayName = "Separator";
var X6 = /* @__PURE__ */ o((e) => e.reduce(
  (t, r, n) => r ? /* @__PURE__ */ ip.createElement(G6, { key: r.id || r.key || `f-${n}` }, t, n > 0 ? /* @__PURE__ */ ip.createElement(bl, {
  key: `s-${n}` }) : null, r.render() || r) : t,
  null
), "interleaveSeparators");

// src/components/components/addon-panel/addon-panel.tsx
import Z6, { useEffect as K6, useRef as J6 } from "react";
var Q6 = /* @__PURE__ */ o((e) => {
  let t = J6();
  return K6(() => {
    t.current = e;
  }, [e]), t.current;
}, "usePrevious"), ew = /* @__PURE__ */ o((e, t) => {
  let r = Q6(t);
  return e ? t : r;
}, "useUpdate"), tw = /* @__PURE__ */ o(({ active: e, children: t }) => (
  // the hidden attribute is an valid html element that's both accessible and works to visually hide content
  /* @__PURE__ */ Z6.createElement("div", { hidden: !e }, ew(e, t))
), "AddonPanel");

// src/components/brand/StorybookLogo.tsx
import ot from "react";
var rw = /* @__PURE__ */ o(({ alt: e, ...t }) => /* @__PURE__ */ ot.createElement("svg", { width: "200px", height: "40px", viewBox: "0 0 200\
 40", ...t, role: "img" }, e ? /* @__PURE__ */ ot.createElement("title", null, e) : null, /* @__PURE__ */ ot.createElement("defs", null, /* @__PURE__ */ ot.
createElement(
  "path",
  {
    d: "M1.2 36.9L0 3.9c0-1.1.8-2 1.9-2.1l28-1.8a2 2 0 0 1 2.2 1.9 2 2 0 0 1 0 .1v36a2 2 0 0 1-2 2 2 2 0 0 1-.1 0L3.2 38.8a2 2 0 0 1-2-2z",
    id: "a"
  }
)), /* @__PURE__ */ ot.createElement("g", { fill: "none", fillRule: "evenodd" }, /* @__PURE__ */ ot.createElement(
  "path",
  {
    d: "M53.3 31.7c-1.7 0-3.4-.3-5-.7-1.5-.5-2.8-1.1-3.9-2l1.6-3.5c2.2 1.5 4.6 2.3 7.3 2.3 1.5 0 2.5-.2 3.3-.7.7-.5 1.1-1 1.1-1.9 0-.7-.3-1.\
3-1-1.7s-2-.8-3.7-1.2c-2-.4-3.6-.9-4.8-1.5-1.1-.5-2-1.2-2.6-2-.5-1-.8-2-.8-3.2 0-1.4.4-2.6 1.2-3.6.7-1.1 1.8-2 3.2-2.6 1.3-.6 2.9-.9 4.7-.9 \
1.6 0 3.1.3 4.6.7 1.5.5 2.7 1.1 3.5 2l-1.6 3.5c-2-1.5-4.2-2.3-6.5-2.3-1.3 0-2.3.2-3 .8-.8.5-1.2 1.1-1.2 2 0 .5.2 1 .5 1.3.2.3.7.6 1.4.9l2.9.\
8c2.9.6 5 1.4 6.2 2.4a5 5 0 0 1 2 4.2 6 6 0 0 1-2.5 5c-1.7 1.2-4 1.9-7 1.9zm21-3.6l1.4-.1-.2 3.5-1.9.1c-2.4 0-4.1-.5-5.2-1.5-1.1-1-1.6-2.7-1\
.6-4.8v-6h-3v-3.6h3V11h4.8v4.6h4v3.6h-4v6c0 1.8.9 2.8 2.6 2.8zm11.1 3.5c-1.6 0-3-.3-4.3-1a7 7 0 0 1-3-2.8c-.6-1.3-1-2.7-1-4.4 0-1.6.4-3 1-4.\
3a7 7 0 0 1 3-2.8c1.2-.7 2.7-1 4.3-1 1.7 0 3.2.3 4.4 1a7 7 0 0 1 3 2.8c.6 1.2 1 2.7 1 4.3 0 1.7-.4 3.1-1 4.4a7 7 0 0 1-3 2.8c-1.2.7-2.7 1-4.\
4 1zm0-3.6c2.4 0 3.6-1.6 3.6-4.6 0-1.5-.3-2.6-1-3.4a3.2 3.2 0 0 0-2.6-1c-2.3 0-3.5 1.4-3.5 4.4 0 3 1.2 4.6 3.5 4.6zm21.7-8.8l-2.7.3c-1.3.2-2\
.3.5-2.8 1.2-.6.6-.9 1.4-.9 2.5v8.2H96V15.7h4.6v2.6c.8-1.8 2.5-2.8 5-3h1.3l.3 4zm14-3.5h4.8L116.4 37h-4.9l3-6.6-6.4-14.8h5l4 10 4-10zm16-.4c\
1.4 0 2.6.3 3.6 1 1 .6 1.9 1.6 2.5 2.8.6 1.2.9 2.7.9 4.3 0 1.6-.3 3-1 4.3a6.9 6.9 0 0 1-2.4 2.9c-1 .7-2.2 1-3.6 1-1 0-2-.2-3-.7-.8-.4-1.5-1-\
2-1.9v2.4h-4.7V8.8h4.8v9c.5-.8 1.2-1.4 2-1.9.9-.4 1.8-.6 3-.6zM135.7 28c1.1 0 2-.4 2.6-1.2.6-.8 1-2 1-3.4 0-1.5-.4-2.5-1-3.3s-1.5-1.1-2.6-1.\
1-2 .3-2.6 1.1c-.6.8-1 2-1 3.3 0 1.5.4 2.6 1 3.4.6.8 1.5 1.2 2.6 1.2zm18.9 3.6c-1.7 0-3.2-.3-4.4-1a7 7 0 0 1-3-2.8c-.6-1.3-1-2.7-1-4.4 0-1.6\
.4-3 1-4.3a7 7 0 0 1 3-2.8c1.2-.7 2.7-1 4.4-1 1.6 0 3 .3 4.3 1a7 7 0 0 1 3 2.8c.6 1.2 1 2.7 1 4.3 0 1.7-.4 3.1-1 4.4a7 7 0 0 1-3 2.8c-1.2.7-\
2.7 1-4.3 1zm0-3.6c2.3 0 3.5-1.6 3.5-4.6 0-1.5-.3-2.6-1-3.4a3.2 3.2 0 0 0-2.5-1c-2.4 0-3.6 1.4-3.6 4.4 0 3 1.2 4.6 3.6 4.6zm18 3.6c-1.7 0-3.\
2-.3-4.4-1a7 7 0 0 1-3-2.8c-.6-1.3-1-2.7-1-4.4 0-1.6.4-3 1-4.3a7 7 0 0 1 3-2.8c1.2-.7 2.7-1 4.4-1 1.6 0 3 .3 4.4 1a7 7 0 0 1 2.9 2.8c.6 1.2 \
1 2.7 1 4.3 0 1.7-.4 3.1-1 4.4a7 7 0 0 1-3 2.8c-1.2.7-2.7 1-4.3 1zm0-3.6c2.3 0 3.5-1.6 3.5-4.6 0-1.5-.3-2.6-1-3.4a3.2 3.2 0 0 0-2.5-1c-2.4 0\
-3.6 1.4-3.6 4.4 0 3 1.2 4.6 3.6 4.6zm27.4 3.4h-6l-6-7v7h-4.8V8.8h4.9v13.6l5.8-6.7h5.7l-6.6 7.5 7 8.2z",
    fill: "currentColor"
  }
), /* @__PURE__ */ ot.createElement("mask", { id: "b", fill: "#fff" }, /* @__PURE__ */ ot.createElement("use", { xlinkHref: "#a" })), /* @__PURE__ */ ot.
createElement("use", { fill: "#FF4785", fillRule: "nonzero", xlinkHref: "#a" }), /* @__PURE__ */ ot.createElement(
  "path",
  {
    d: "M23.7 5L24 .2l3.9-.3.1 4.8a.3.3 0 0 1-.5.2L26 3.8l-1.7 1.4a.3.3 0 0 1-.5-.3zm-5 10c0 .9 5.3.5 6 0 0-5.4-2.8-8.2-8-8.2-5.3 0-8.2 2.8-\
8.2 7.1 0 7.4 10 7.6 10 11.6 0 1.2-.5 1.9-1.8 1.9-1.6 0-2.2-.9-2.1-3.6 0-.6-6.1-.8-6.3 0-.5 6.7 3.7 8.6 8.5 8.6 4.6 0 8.3-2.5 8.3-7 0-7.9-10\
.2-7.7-10.2-11.6 0-1.6 1.2-1.8 2-1.8.6 0 2 0 1.9 3z",
    fill: "#FFF",
    fillRule: "nonzero",
    mask: "url(#b)"
  }
))), "StorybookLogo");

// src/components/brand/StorybookIcon.tsx
import Gr from "react";
var nw = /* @__PURE__ */ o((e) => /* @__PURE__ */ Gr.createElement("svg", { viewBox: "0 0 64 64", ...e }, /* @__PURE__ */ Gr.createElement("\
title", null, "Storybook icon"), /* @__PURE__ */ Gr.createElement("g", { id: "Artboard", stroke: "none", strokeWidth: "1", fill: "none", fillRule: "\
evenodd" }, /* @__PURE__ */ Gr.createElement(
  "path",
  {
    d: "M8.04798541,58.7875918 L6.07908839,6.32540407 C6.01406344,4.5927838 7.34257463,3.12440831 9.07303814,3.01625434 L53.6958037,0.227331\
489 C55.457209,0.117243658 56.974354,1.45590096 57.0844418,3.21730626 C57.0885895,3.28366922 57.0906648,3.35014546 57.0906648,3.41663791 L57\
.0906648,60.5834697 C57.0906648,62.3483119 55.6599776,63.7789992 53.8951354,63.7789992 C53.847325,63.7789992 53.7995207,63.7779262 53.751758\
5,63.775781 L11.0978899,61.8600599 C9.43669044,61.7854501 8.11034889,60.4492961 8.04798541,58.7875918 Z",
    id: "path-1",
    fill: "#FF4785",
    fillRule: "nonzero"
  }
), /* @__PURE__ */ Gr.createElement(
  "path",
  {
    d: "M35.9095005,24.1768792 C35.9095005,25.420127 44.2838488,24.8242707 45.4080313,23.9509748 C45.4080313,15.4847538 40.8652557,11.035887\
8 32.5466666,11.0358878 C24.2280775,11.0358878 19.5673077,15.553972 19.5673077,22.3311017 C19.5673077,34.1346028 35.4965208,34.3605071 35.49\
65208,40.7987804 C35.4965208,42.606015 34.6115646,43.6790606 32.6646607,43.6790606 C30.127786,43.6790606 29.1248356,42.3834613 29.2428298,37\
.9783269 C29.2428298,37.0226907 19.5673077,36.7247626 19.2723223,37.9783269 C18.5211693,48.6535354 25.1720308,51.7326752 32.7826549,51.73267\
52 C40.1572906,51.7326752 45.939005,47.8018145 45.939005,40.6858282 C45.939005,28.035186 29.7738035,28.3740425 29.7738035,22.1051974 C29.773\
8035,19.5637737 31.6617103,19.2249173 32.7826549,19.2249173 C33.9625966,19.2249173 36.0864917,19.4328883 35.9095005,24.1768792 Z",
    id: "path9_fill-path",
    fill: "#FFFFFF",
    fillRule: "nonzero"
  }
), /* @__PURE__ */ Gr.createElement(
  "path",
  {
    d: "M44.0461638,0.830433986 L50.1874092,0.446606143 L50.443532,7.7810017 C50.4527198,8.04410717 50.2468789,8.26484453 49.9837734,8.27403\
237 C49.871115,8.27796649 49.7607078,8.24184808 49.6721567,8.17209069 L47.3089847,6.3104681 L44.5110468,8.43287463 C44.3012992,8.591981 44.0\
022839,8.55092814 43.8431776,8.34118051 C43.7762017,8.25288717 43.742082,8.14401677 43.7466857,8.03329059 L44.0461638,0.830433986 Z",
    id: "Path",
    fill: "#FFFFFF"
  }
))), "StorybookIcon");

// src/components/components/Loader/Loader.tsx
import mt from "react";
import { keyframes as aw, styled as lr } from "storybook/theming";

// src/components/components/shared/animation.ts
import { keyframes as ow } from "storybook/theming";
var lp = ow`
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
`;

// src/components/components/Loader/Loader.tsx
var iw = lr.div(({ size: e = 32 }) => ({
  borderRadius: "50%",
  cursor: "progress",
  display: "inline-block",
  overflow: "hidden",
  position: "absolute",
  transition: "all 200ms ease-out",
  verticalAlign: "top",
  top: "50%",
  left: "50%",
  marginTop: -(e / 2),
  marginLeft: -(e / 2),
  height: e,
  width: e,
  zIndex: 4,
  borderWidth: 2,
  borderStyle: "solid",
  borderColor: "rgba(97, 97, 97, 0.29)",
  borderTopColor: "rgb(100,100,100)",
  animation: `${lp} 0.7s linear infinite`,
  mixBlendMode: "difference"
})), cp = lr.div({
  position: "absolute",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  width: "100%",
  height: "100%"
}), lw = lr.div(({ theme: e }) => ({
  position: "relative",
  width: "80%",
  marginBottom: "0.75rem",
  maxWidth: 300,
  height: 5,
  borderRadius: 5,
  background: we(0.8, e.color.secondary),
  overflow: "hidden",
  cursor: "progress"
})), cw = lr.div(({ theme: e }) => ({
  position: "absolute",
  top: 0,
  left: 0,
  height: "100%",
  background: e.color.secondary
})), sp = lr.div(({ theme: e }) => ({
  minHeight: "2em",
  fontSize: `${e.typography.size.s1}px`,
  color: e.textMutedColor
})), sw = lr(q5)(({ theme: e }) => ({
  width: 20,
  height: 20,
  marginBottom: "0.5rem",
  color: e.textMutedColor
})), uw = aw`
  from { content: "..." }
  33% { content: "." }
  66% { content: ".." }
  to { content: "..." }
`, fw = lr.span({
  "&::after": {
    content: "'...'",
    animation: `${uw} 1s linear infinite`,
    animationDelay: "1s",
    display: "inline-block",
    width: "1em",
    height: "auto"
  }
}), dw = /* @__PURE__ */ o(({ progress: e, error: t, size: r, ...n }) => {
  if (t)
    return /* @__PURE__ */ mt.createElement(cp, { "aria-label": t.toString(), "aria-live": "polite", role: "status", ...n }, /* @__PURE__ */ mt.
    createElement(sw, null), /* @__PURE__ */ mt.createElement(sp, null, t.message));
  if (e) {
    let { value: a, modules: i } = e, { message: c } = e;
    return i && (c += ` ${i.complete} / ${i.total} modules`), /* @__PURE__ */ mt.createElement(
      cp,
      {
        "aria-label": "Content is loading...",
        "aria-live": "polite",
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": a * 100,
        "aria-valuetext": c,
        role: "progressbar",
        ...n
      },
      /* @__PURE__ */ mt.createElement(lw, null, /* @__PURE__ */ mt.createElement(cw, { style: { width: `${a * 100}%` } })),
      /* @__PURE__ */ mt.createElement(sp, null, c, a < 1 && /* @__PURE__ */ mt.createElement(fw, { key: c }))
    );
  }
  return /* @__PURE__ */ mt.createElement(
    iw,
    {
      "aria-label": "Content is loading...",
      "aria-live": "polite",
      role: "status",
      size: r,
      ...n
    }
  );
}, "Loader");

// src/components/components/ProgressSpinner/ProgressSpinner.tsx
import kt from "react";
import { keyframes as pw, styled as fp } from "storybook/theming";
var yl = "http://www.w3.org/2000/svg", mw = pw({
  "0%": {
    transform: "rotate(0deg)"
  },
  "100%": {
    transform: "rotate(360deg)"
  }
}), up = fp.div(({ size: e }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  minWidth: e,
  minHeight: e
})), Rl = fp.svg(
  ({ size: e, width: t }) => ({
    position: "absolute",
    width: `${e}px!important`,
    height: `${e}px!important`,
    transform: "rotate(-90deg)",
    circle: {
      r: (e - Math.ceil(t)) / 2,
      cx: e / 2,
      cy: e / 2,
      opacity: 0.15,
      fill: "transparent",
      stroke: "currentColor",
      strokeWidth: t,
      strokeLinecap: "round",
      strokeDasharray: Math.PI * (e - Math.ceil(t))
    }
  }),
  ({ progress: e }) => e && {
    circle: {
      opacity: 0.75
    }
  },
  ({ spinner: e }) => e && {
    animation: `${mw} 1s linear infinite`,
    circle: {
      opacity: 0.25
    }
  }
), hw = /* @__PURE__ */ o(({
  percentage: e = void 0,
  running: t = !0,
  size: r = 24,
  width: n = 1.5,
  children: a = null,
  ...i
}) => typeof e == "number" ? /* @__PURE__ */ kt.createElement(up, { size: r, ...i }, a, /* @__PURE__ */ kt.createElement(Rl, { size: r, width: n,
xmlns: yl }, /* @__PURE__ */ kt.createElement("circle", null)), t && /* @__PURE__ */ kt.createElement(Rl, { size: r, width: n, xmlns: yl, spinner: !0 },
/* @__PURE__ */ kt.createElement("circle", { strokeDashoffset: Math.PI * (r - Math.ceil(n)) * (1 - e / 100) })), /* @__PURE__ */ kt.createElement(
Rl, { size: r, width: n, xmlns: yl, progress: !0 }, /* @__PURE__ */ kt.createElement("circle", { strokeDashoffset: Math.PI * (r - Math.ceil(
n)) * (1 - e / 100) }))) : /* @__PURE__ */ kt.createElement(up, { size: r, ...i }, a), "ProgressSpinner");

// src/components/components/utils/getStoryHref.ts
function gw(e) {
  let t = {}, r = e.split("&");
  for (let n = 0; n < r.length; n++) {
    let a = r[n].split("=");
    t[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || "");
  }
  return t;
}
o(gw, "parseQuery");
var vw = /* @__PURE__ */ o((e, t, r = {}) => {
  let [n, a] = e.split("?"), i = a ? {
    ...gw(a),
    ...r,
    id: t
  } : {
    ...r,
    id: t
  };
  return `${n}?${Object.entries(i).map((c) => `${c[0]}=${c[1]}`).join("&")}`;
}, "getStoryHref");

// src/components/components/clipboard/ClipboardCode.tsx
import ww from "react";
import { color as bw, styled as yw, typography as dp } from "storybook/theming";
var Rw = yw.pre`
  line-height: 18px;
  padding: 11px 1rem;
  white-space: pre-wrap;
  background: rgba(0, 0, 0, 0.05);
  color: ${bw.darkest};
  border-radius: 3px;
  margin: 1rem 0;
  width: 100%;
  display: block;
  overflow: hidden;
  font-family: ${dp.fonts.mono};
  font-size: ${dp.size.s2 - 1}px;
`, xw = /* @__PURE__ */ o(({ code: e, ...t }) => /* @__PURE__ */ ww.createElement(Rw, { id: "clipboard-code", ...t }, e), "ClipboardCode");

// src/components/index.ts
var yO = Ci, Cw = {};
Object.keys(Ci).forEach((e) => {
  Cw[e] = Sw((t, r) => Ew(e, { ...t, ref: r }));
});
export {
  oa as A,
  Ya as ActionBar,
  tw as AddonPanel,
  Gh as Badge,
  ul as Bar,
  aa as Blockquote,
  Ir as Button,
  xw as ClipboardCode,
  ii as Code,
  li as DL,
  ci as Div,
  eg as DocumentWrapper,
  qo as EmptyTabContent,
  g3 as ErrorFormatter,
  jo as FlexBar,
  Z3 as Form,
  si as H1,
  ui as H2,
  fi as H3,
  di as H4,
  pi as H5,
  mi as H6,
  hi as HR,
  xo as IconButton,
  gi as Img,
  vi as LI,
  Ai as Link,
  il as ListItem,
  dw as Loader,
  _v as Modal,
  wi as OL,
  bi as P,
  Zv as Placeholder,
  yi as Pre,
  hw as ProgressSpinner,
  jl as ResetWrapper,
  yr as ScrollArea,
  bl as Separator,
  Uv as Spaced,
  Ri as Span,
  nw as StorybookIcon,
  rw as StorybookLogo,
  ru as SyntaxHighlighter,
  xi as TT,
  gl as TabBar,
  ar as TabButton,
  q6 as TabWrapper,
  Ei as Table,
  vl as Tabs,
  ml as TabsState,
  ll as TooltipLinkList,
  r6 as TooltipMessage,
  i6 as TooltipNote,
  Si as UL,
  Y7 as WithTooltip,
  Z7 as WithTooltipPure,
  l3 as Zoom,
  at as codeCommon,
  yO as components,
  oi as createCopyToClipboardFunction,
  vw as getStoryHref,
  X6 as interleaveSeparators,
  J as nameSpaceClassNames,
  Cw as resetComponents,
  N as withReset
};
