"use strict";
var cs = Object.create;
var Ce = Object.defineProperty;
var us = Object.getOwnPropertyDescriptor;
var ls = Object.getOwnPropertyNames;
var ps = Object.getPrototypeOf, ds = Object.prototype.hasOwnProperty;
var n = (e, t) => Ce(e, "name", { value: t, configurable: !0 });
var fe = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports), U = (e, t) => {
  for (var r in t)
    Ce(e, r, { get: t[r], enumerable: !0 });
}, Yr = (e, t, r, o) => {
  if (t && typeof t == "object" || typeof t == "function")
    for (let s of ls(t))
      !ds.call(e, s) && s !== r && Ce(e, s, { get: () => t[s], enumerable: !(o = us(t, s)) || o.enumerable });
  return e;
};
var L = (e, t, r) => (r = e != null ? cs(ps(e)) : {}, Yr(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  t || !e || !e.__esModule ? Ce(r, "default", { value: e, enumerable: !0 }) : r,
  e
)), fs = (e) => Yr(Ce({}, "__esModule", { value: !0 }), e);

// ../node_modules/ts-dedent/dist/index.js
var ie = fe((Fe) => {
  "use strict";
  Object.defineProperty(Fe, "__esModule", { value: !0 });
  Fe.dedent = void 0;
  function mo(e) {
    for (var t = [], r = 1; r < arguments.length; r++)
      t[r - 1] = arguments[r];
    var o = Array.from(typeof e == "string" ? [e] : e);
    o[o.length - 1] = o[o.length - 1].replace(/\r?\n([\t ]*)$/, "");
    var s = o.reduce(function(c, u) {
      var l = u.match(/\n([\t ]+|(?!\s).)/g);
      return l ? c.concat(l.map(function(p) {
        var d, f;
        return (f = (d = p.match(/[\t ]/g)) === null || d === void 0 ? void 0 : d.length) !== null && f !== void 0 ? f : 0;
      })) : c;
    }, []);
    if (s.length) {
      var a = new RegExp(`
[	 ]{` + Math.min.apply(Math, s) + "}", "g");
      o = o.map(function(c) {
        return c.replace(a, `
`);
      });
    }
    o[0] = o[0].replace(/^\r?\n/, "");
    var i = o[0];
    return t.forEach(function(c, u) {
      var l = i.match(/(?:^|\n)( *)$/), p = l ? l[1] : "", d = c;
      typeof c == "string" && c.includes(`
`) && (d = String(c).split(`
`).map(function(f, y) {
        return y === 0 ? f : "" + p + f;
      }).join(`
`)), i += d + o[u + 1];
    }), i;
  }
  n(mo, "dedent");
  Fe.dedent = mo;
  Fe.default = mo;
});

// ../node_modules/map-or-similar/src/similar.js
var go = fe((np, ho) => {
  function Z() {
    return this.list = [], this.lastItem = void 0, this.size = 0, this;
  }
  n(Z, "Similar");
  Z.prototype.get = function(e) {
    var t;
    if (this.lastItem && this.isEqual(this.lastItem.key, e))
      return this.lastItem.val;
    if (t = this.indexOf(e), t >= 0)
      return this.lastItem = this.list[t], this.list[t].val;
  };
  Z.prototype.set = function(e, t) {
    var r;
    return this.lastItem && this.isEqual(this.lastItem.key, e) ? (this.lastItem.val = t, this) : (r = this.indexOf(e), r >= 0 ? (this.lastItem =
    this.list[r], this.list[r].val = t, this) : (this.lastItem = { key: e, val: t }, this.list.push(this.lastItem), this.size++, this));
  };
  Z.prototype.delete = function(e) {
    var t;
    if (this.lastItem && this.isEqual(this.lastItem.key, e) && (this.lastItem = void 0), t = this.indexOf(e), t >= 0)
      return this.size--, this.list.splice(t, 1)[0];
  };
  Z.prototype.has = function(e) {
    var t;
    return this.lastItem && this.isEqual(this.lastItem.key, e) ? !0 : (t = this.indexOf(e), t >= 0 ? (this.lastItem = this.list[t], !0) : !1);
  };
  Z.prototype.forEach = function(e, t) {
    var r;
    for (r = 0; r < this.size; r++)
      e.call(t || this, this.list[r].val, this.list[r].key, this);
  };
  Z.prototype.indexOf = function(e) {
    var t;
    for (t = 0; t < this.size; t++)
      if (this.isEqual(this.list[t].key, e))
        return t;
    return -1;
  };
  Z.prototype.isEqual = function(e, t) {
    return e === t || e !== e && t !== t;
  };
  ho.exports = Z;
});

// ../node_modules/map-or-similar/src/map-or-similar.js
var bo = fe((ap, So) => {
  So.exports = function(e) {
    if (typeof Map != "function" || e) {
      var t = go();
      return new t();
    } else
      return /* @__PURE__ */ new Map();
  };
});

// ../node_modules/memoizerific/src/memoizerific.js
var rr = fe((ip, _o) => {
  var Eo = bo();
  _o.exports = function(e) {
    var t = new Eo(process.env.FORCE_SIMILAR_INSTEAD_OF_MAP === "true"), r = [];
    return function(o) {
      var s = /* @__PURE__ */ n(function() {
        var a = t, i, c, u = arguments.length - 1, l = Array(u + 1), p = !0, d;
        if ((s.numArgs || s.numArgs === 0) && s.numArgs !== u + 1)
          throw new Error("Memoizerific functions should always be called with the same number of arguments");
        for (d = 0; d < u; d++) {
          if (l[d] = {
            cacheItem: a,
            arg: arguments[d]
          }, a.has(arguments[d])) {
            a = a.get(arguments[d]);
            continue;
          }
          p = !1, i = new Eo(process.env.FORCE_SIMILAR_INSTEAD_OF_MAP === "true"), a.set(arguments[d], i), a = i;
        }
        return p && (a.has(arguments[u]) ? c = a.get(arguments[u]) : p = !1), p || (c = o.apply(null, arguments), a.set(arguments[u], c)), e >
        0 && (l[u] = {
          cacheItem: a,
          arg: arguments[u]
        }, p ? bs(r, l) : r.push(l), r.length > e && Es(r.shift())), s.wasMemoized = p, s.numArgs = u + 1, c;
      }, "memoizerific");
      return s.limit = e, s.wasMemoized = !1, s.cache = t, s.lru = r, s;
    };
  };
  function bs(e, t) {
    var r = e.length, o = t.length, s, a, i;
    for (a = 0; a < r; a++) {
      for (s = !0, i = 0; i < o; i++)
        if (!_s(e[a][i].arg, t[i].arg)) {
          s = !1;
          break;
        }
      if (s)
        break;
    }
    e.push(e.splice(a, 1)[0]);
  }
  n(bs, "moveToMostRecentLru");
  function Es(e) {
    var t = e.length, r = e[t - 1], o, s;
    for (r.cacheItem.delete(r.arg), s = t - 2; s >= 0 && (r = e[s], o = r.cacheItem.get(r.arg), !o || !o.size); s--)
      r.cacheItem.delete(r.arg);
  }
  n(Es, "removeCachedResult");
  function _s(e, t) {
    return e === t || e !== e && t !== t;
  }
  n(_s, "isEqual");
});

// ../node_modules/store2/dist/store2.js
var cn = fe((Dt, Mt) => {
  (function(e, t) {
    var r = {
      version: "2.14.4",
      areas: {},
      apis: {},
      nsdelim: ".",
      // utilities
      inherit: /* @__PURE__ */ n(function(s, a) {
        for (var i in s)
          a.hasOwnProperty(i) || Object.defineProperty(a, i, Object.getOwnPropertyDescriptor(s, i));
        return a;
      }, "inherit"),
      stringify: /* @__PURE__ */ n(function(s, a) {
        return s === void 0 || typeof s == "function" ? s + "" : JSON.stringify(s, a || r.replace);
      }, "stringify"),
      parse: /* @__PURE__ */ n(function(s, a) {
        try {
          return JSON.parse(s, a || r.revive);
        } catch {
          return s;
        }
      }, "parse"),
      // extension hooks
      fn: /* @__PURE__ */ n(function(s, a) {
        r.storeAPI[s] = a;
        for (var i in r.apis)
          r.apis[i][s] = a;
      }, "fn"),
      get: /* @__PURE__ */ n(function(s, a) {
        return s.getItem(a);
      }, "get"),
      set: /* @__PURE__ */ n(function(s, a, i) {
        s.setItem(a, i);
      }, "set"),
      remove: /* @__PURE__ */ n(function(s, a) {
        s.removeItem(a);
      }, "remove"),
      key: /* @__PURE__ */ n(function(s, a) {
        return s.key(a);
      }, "key"),
      length: /* @__PURE__ */ n(function(s) {
        return s.length;
      }, "length"),
      clear: /* @__PURE__ */ n(function(s) {
        s.clear();
      }, "clear"),
      // core functions
      Store: /* @__PURE__ */ n(function(s, a, i) {
        var c = r.inherit(r.storeAPI, function(l, p, d) {
          return arguments.length === 0 ? c.getAll() : typeof p == "function" ? c.transact(l, p, d) : p !== void 0 ? c.set(l, p, d) : typeof l ==
          "string" || typeof l == "number" ? c.get(l) : typeof l == "function" ? c.each(l) : l ? c.setAll(l, p) : c.clear();
        });
        c._id = s;
        try {
          var u = "__store2_test";
          a.setItem(u, "ok"), c._area = a, a.removeItem(u);
        } catch {
          c._area = r.storage("fake");
        }
        return c._ns = i || "", r.areas[s] || (r.areas[s] = c._area), r.apis[c._ns + c._id] || (r.apis[c._ns + c._id] = c), c;
      }, "Store"),
      storeAPI: {
        // admin functions
        area: /* @__PURE__ */ n(function(s, a) {
          var i = this[s];
          return (!i || !i.area) && (i = r.Store(s, a, this._ns), this[s] || (this[s] = i)), i;
        }, "area"),
        namespace: /* @__PURE__ */ n(function(s, a, i) {
          if (i = i || this._delim || r.nsdelim, !s)
            return this._ns ? this._ns.substring(0, this._ns.length - i.length) : "";
          var c = s, u = this[c];
          if ((!u || !u.namespace) && (u = r.Store(this._id, this._area, this._ns + c + i), u._delim = i, this[c] || (this[c] = u), !a))
            for (var l in r.areas)
              u.area(l, r.areas[l]);
          return u;
        }, "namespace"),
        isFake: /* @__PURE__ */ n(function(s) {
          return s ? (this._real = this._area, this._area = r.storage("fake")) : s === !1 && (this._area = this._real || this._area), this._area.
          name === "fake";
        }, "isFake"),
        toString: /* @__PURE__ */ n(function() {
          return "store" + (this._ns ? "." + this.namespace() : "") + "[" + this._id + "]";
        }, "toString"),
        // storage functions
        has: /* @__PURE__ */ n(function(s) {
          return this._area.has ? this._area.has(this._in(s)) : this._in(s) in this._area;
        }, "has"),
        size: /* @__PURE__ */ n(function() {
          return this.keys().length;
        }, "size"),
        each: /* @__PURE__ */ n(function(s, a) {
          for (var i = 0, c = r.length(this._area); i < c; i++) {
            var u = this._out(r.key(this._area, i));
            if (u !== void 0 && s.call(this, u, this.get(u), a) === !1)
              break;
            c > r.length(this._area) && (c--, i--);
          }
          return a || this;
        }, "each"),
        keys: /* @__PURE__ */ n(function(s) {
          return this.each(function(a, i, c) {
            c.push(a);
          }, s || []);
        }, "keys"),
        get: /* @__PURE__ */ n(function(s, a) {
          var i = r.get(this._area, this._in(s)), c;
          return typeof a == "function" && (c = a, a = null), i !== null ? r.parse(i, c) : a ?? i;
        }, "get"),
        getAll: /* @__PURE__ */ n(function(s) {
          return this.each(function(a, i, c) {
            c[a] = i;
          }, s || {});
        }, "getAll"),
        transact: /* @__PURE__ */ n(function(s, a, i) {
          var c = this.get(s, i), u = a(c);
          return this.set(s, u === void 0 ? c : u), this;
        }, "transact"),
        set: /* @__PURE__ */ n(function(s, a, i) {
          var c = this.get(s), u;
          return c != null && i === !1 ? a : (typeof i == "function" && (u = i, i = void 0), r.set(this._area, this._in(s), r.stringify(a, u),
          i) || c);
        }, "set"),
        setAll: /* @__PURE__ */ n(function(s, a) {
          var i, c;
          for (var u in s)
            c = s[u], this.set(u, c, a) !== c && (i = !0);
          return i;
        }, "setAll"),
        add: /* @__PURE__ */ n(function(s, a, i) {
          var c = this.get(s);
          if (c instanceof Array)
            a = c.concat(a);
          else if (c !== null) {
            var u = typeof c;
            if (u === typeof a && u === "object") {
              for (var l in a)
                c[l] = a[l];
              a = c;
            } else
              a = c + a;
          }
          return r.set(this._area, this._in(s), r.stringify(a, i)), a;
        }, "add"),
        remove: /* @__PURE__ */ n(function(s, a) {
          var i = this.get(s, a);
          return r.remove(this._area, this._in(s)), i;
        }, "remove"),
        clear: /* @__PURE__ */ n(function() {
          return this._ns ? this.each(function(s) {
            r.remove(this._area, this._in(s));
          }, 1) : r.clear(this._area), this;
        }, "clear"),
        clearAll: /* @__PURE__ */ n(function() {
          var s = this._area;
          for (var a in r.areas)
            r.areas.hasOwnProperty(a) && (this._area = r.areas[a], this.clear());
          return this._area = s, this;
        }, "clearAll"),
        // internal use functions
        _in: /* @__PURE__ */ n(function(s) {
          return typeof s != "string" && (s = r.stringify(s)), this._ns ? this._ns + s : s;
        }, "_in"),
        _out: /* @__PURE__ */ n(function(s) {
          return this._ns ? s && s.indexOf(this._ns) === 0 ? s.substring(this._ns.length) : void 0 : (
            // so each() knows to skip it
            s
          );
        }, "_out")
      },
      // end _.storeAPI
      storage: /* @__PURE__ */ n(function(s) {
        return r.inherit(r.storageAPI, { items: {}, name: s });
      }, "storage"),
      storageAPI: {
        length: 0,
        has: /* @__PURE__ */ n(function(s) {
          return this.items.hasOwnProperty(s);
        }, "has"),
        key: /* @__PURE__ */ n(function(s) {
          var a = 0;
          for (var i in this.items)
            if (this.has(i) && s === a++)
              return i;
        }, "key"),
        setItem: /* @__PURE__ */ n(function(s, a) {
          this.has(s) || this.length++, this.items[s] = a;
        }, "setItem"),
        removeItem: /* @__PURE__ */ n(function(s) {
          this.has(s) && (delete this.items[s], this.length--);
        }, "removeItem"),
        getItem: /* @__PURE__ */ n(function(s) {
          return this.has(s) ? this.items[s] : null;
        }, "getItem"),
        clear: /* @__PURE__ */ n(function() {
          for (var s in this.items)
            this.removeItem(s);
        }, "clear")
      }
      // end _.storageAPI
    }, o = (
      // safely set this up (throws error in IE10/32bit mode for local files)
      r.Store("local", function() {
        try {
          return localStorage;
        } catch {
        }
      }())
    );
    o.local = o, o._ = r, o.area("session", function() {
      try {
        return sessionStorage;
      } catch {
      }
    }()), o.area("page", r.storage("page")), typeof t == "function" && t.amd !== void 0 ? t("store2", [], function() {
      return o;
    }) : typeof Mt < "u" && Mt.exports ? Mt.exports = o : (e.store && (r.conflict = e.store), e.store = o);
  })(Dt, Dt && Dt.define);
});

// ../node_modules/telejson/dist/index.js
var Ln = fe((Ad, Un) => {
  "use strict";
  var na = Object.create, Ut = Object.defineProperty, sa = Object.getOwnPropertyDescriptor, yn = Object.getOwnPropertyNames, aa = Object.getPrototypeOf,
  ia = Object.prototype.hasOwnProperty, b = /* @__PURE__ */ n((e, t) => /* @__PURE__ */ n(function() {
    return t || (0, e[yn(e)[0]])((t = { exports: {} }).exports, t), t.exports;
  }, "__require"), "__commonJS"), ca = /* @__PURE__ */ n((e, t) => {
    for (var r in t)
      Ut(e, r, { get: t[r], enumerable: !0 });
  }, "__export"), mn = /* @__PURE__ */ n((e, t, r, o) => {
    if (t && typeof t == "object" || typeof t == "function")
      for (let s of yn(t))
        !ia.call(e, s) && s !== r && Ut(e, s, { get: /* @__PURE__ */ n(() => t[s], "get"), enumerable: !(o = sa(t, s)) || o.enumerable });
    return e;
  }, "__copyProps"), Nr = /* @__PURE__ */ n((e, t, r) => (r = e != null ? na(aa(e)) : {}, mn(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    t || !e || !e.__esModule ? Ut(r, "default", { value: e, enumerable: !0 }) : r,
    e
  )), "__toESM"), ua = /* @__PURE__ */ n((e) => mn(Ut({}, "__esModule", { value: !0 }), e), "__toCommonJS"), hn = b({
    "node_modules/.pnpm/es-object-atoms@1.1.1/node_modules/es-object-atoms/index.js"(e, t) {
      "use strict";
      t.exports = Object;
    }
  }), la = b({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/index.js"(e, t) {
      "use strict";
      t.exports = Error;
    }
  }), pa = b({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/eval.js"(e, t) {
      "use strict";
      t.exports = EvalError;
    }
  }), da = b({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/range.js"(e, t) {
      "use strict";
      t.exports = RangeError;
    }
  }), fa = b({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/ref.js"(e, t) {
      "use strict";
      t.exports = ReferenceError;
    }
  }), ya = b({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/syntax.js"(e, t) {
      "use strict";
      t.exports = SyntaxError;
    }
  }), kr = b({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/type.js"(e, t) {
      "use strict";
      t.exports = TypeError;
    }
  }), ma = b({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/uri.js"(e, t) {
      "use strict";
      t.exports = URIError;
    }
  }), ha = b({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/abs.js"(e, t) {
      "use strict";
      t.exports = Math.abs;
    }
  }), ga = b({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/floor.js"(e, t) {
      "use strict";
      t.exports = Math.floor;
    }
  }), Sa = b({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/max.js"(e, t) {
      "use strict";
      t.exports = Math.max;
    }
  }), ba = b({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/min.js"(e, t) {
      "use strict";
      t.exports = Math.min;
    }
  }), Ea = b({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/pow.js"(e, t) {
      "use strict";
      t.exports = Math.pow;
    }
  }), _a = b({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/round.js"(e, t) {
      "use strict";
      t.exports = Math.round;
    }
  }), Pa = b({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/isNaN.js"(e, t) {
      "use strict";
      t.exports = Number.isNaN || /* @__PURE__ */ n(function(o) {
        return o !== o;
      }, "isNaN2");
    }
  }), Aa = b({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/sign.js"(e, t) {
      "use strict";
      var r = Pa();
      t.exports = /* @__PURE__ */ n(function(s) {
        return r(s) || s === 0 ? s : s < 0 ? -1 : 1;
      }, "sign");
    }
  }), va = b({
    "node_modules/.pnpm/gopd@1.2.0/node_modules/gopd/gOPD.js"(e, t) {
      "use strict";
      t.exports = Object.getOwnPropertyDescriptor;
    }
  }), jr = b({
    "node_modules/.pnpm/gopd@1.2.0/node_modules/gopd/index.js"(e, t) {
      "use strict";
      var r = va();
      if (r)
        try {
          r([], "length");
        } catch {
          r = null;
        }
      t.exports = r;
    }
  }), Ia = b({
    "node_modules/.pnpm/es-define-property@1.0.1/node_modules/es-define-property/index.js"(e, t) {
      "use strict";
      var r = Object.defineProperty || !1;
      if (r)
        try {
          r({}, "a", { value: 1 });
        } catch {
          r = !1;
        }
      t.exports = r;
    }
  }), gn = b({
    "node_modules/.pnpm/has-symbols@1.1.0/node_modules/has-symbols/shams.js"(e, t) {
      "use strict";
      t.exports = /* @__PURE__ */ n(function() {
        if (typeof Symbol != "function" || typeof Object.getOwnPropertySymbols != "function")
          return !1;
        if (typeof Symbol.iterator == "symbol")
          return !0;
        var o = {}, s = Symbol("test"), a = Object(s);
        if (typeof s == "string" || Object.prototype.toString.call(s) !== "[object Symbol]" || Object.prototype.toString.call(a) !== "[objec\
t Symbol]")
          return !1;
        var i = 42;
        o[s] = i;
        for (var c in o)
          return !1;
        if (typeof Object.keys == "function" && Object.keys(o).length !== 0 || typeof Object.getOwnPropertyNames == "function" && Object.getOwnPropertyNames(
        o).length !== 0)
          return !1;
        var u = Object.getOwnPropertySymbols(o);
        if (u.length !== 1 || u[0] !== s || !Object.prototype.propertyIsEnumerable.call(o, s))
          return !1;
        if (typeof Object.getOwnPropertyDescriptor == "function") {
          var l = (
            /** @type {PropertyDescriptor} */
            Object.getOwnPropertyDescriptor(o, s)
          );
          if (l.value !== i || l.enumerable !== !0)
            return !1;
        }
        return !0;
      }, "hasSymbols");
    }
  }), Sn = b({
    "node_modules/.pnpm/has-symbols@1.1.0/node_modules/has-symbols/index.js"(e, t) {
      "use strict";
      var r = typeof Symbol < "u" && Symbol, o = gn();
      t.exports = /* @__PURE__ */ n(function() {
        return typeof r != "function" || typeof Symbol != "function" || typeof r("foo") != "symbol" || typeof Symbol("bar") != "symbol" ? !1 :
        o();
      }, "hasNativeSymbols");
    }
  }), bn = b({
    "node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/Reflect.getPrototypeOf.js"(e, t) {
      "use strict";
      t.exports = typeof Reflect < "u" && Reflect.getPrototypeOf || null;
    }
  }), En = b({
    "node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/Object.getPrototypeOf.js"(e, t) {
      "use strict";
      var r = hn();
      t.exports = r.getPrototypeOf || null;
    }
  }), xa = b({
    "node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/implementation.js"(e, t) {
      "use strict";
      var r = "Function.prototype.bind called on incompatible ", o = Object.prototype.toString, s = Math.max, a = "[object Function]", i = /* @__PURE__ */ n(
      function(p, d) {
        for (var f = [], y = 0; y < p.length; y += 1)
          f[y] = p[y];
        for (var m = 0; m < d.length; m += 1)
          f[m + p.length] = d[m];
        return f;
      }, "concatty2"), c = /* @__PURE__ */ n(function(p, d) {
        for (var f = [], y = d || 0, m = 0; y < p.length; y += 1, m += 1)
          f[m] = p[y];
        return f;
      }, "slicy2"), u = /* @__PURE__ */ n(function(l, p) {
        for (var d = "", f = 0; f < l.length; f += 1)
          d += l[f], f + 1 < l.length && (d += p);
        return d;
      }, "joiny");
      t.exports = /* @__PURE__ */ n(function(p) {
        var d = this;
        if (typeof d != "function" || o.apply(d) !== a)
          throw new TypeError(r + d);
        for (var f = c(arguments, 1), y, m = /* @__PURE__ */ n(function() {
          if (this instanceof y) {
            var A = d.apply(
              this,
              i(f, arguments)
            );
            return Object(A) === A ? A : this;
          }
          return d.apply(
            p,
            i(f, arguments)
          );
        }, "binder"), h = s(0, d.length - f.length), g = [], S = 0; S < h; S++)
          g[S] = "$" + S;
        if (y = Function("binder", "return function (" + u(g, ",") + "){ return binder.apply(this,arguments); }")(m), d.prototype) {
          var E = /* @__PURE__ */ n(function() {
          }, "Empty2");
          E.prototype = d.prototype, y.prototype = new E(), E.prototype = null;
        }
        return y;
      }, "bind");
    }
  }), Lt = b({
    "node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/index.js"(e, t) {
      "use strict";
      var r = xa();
      t.exports = Function.prototype.bind || r;
    }
  }), Dr = b({
    "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/functionCall.js"(e, t) {
      "use strict";
      t.exports = Function.prototype.call;
    }
  }), _n = b({
    "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/functionApply.js"(e, t) {
      "use strict";
      t.exports = Function.prototype.apply;
    }
  }), Ta = b({
    "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/reflectApply.js"(e, t) {
      "use strict";
      t.exports = typeof Reflect < "u" && Reflect && Reflect.apply;
    }
  }), Ra = b({
    "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/actualApply.js"(e, t) {
      "use strict";
      var r = Lt(), o = _n(), s = Dr(), a = Ta();
      t.exports = a || r.call(s, o);
    }
  }), Pn = b({
    "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/index.js"(e, t) {
      "use strict";
      var r = Lt(), o = kr(), s = Dr(), a = Ra();
      t.exports = /* @__PURE__ */ n(function(c) {
        if (c.length < 1 || typeof c[0] != "function")
          throw new o("a function is required");
        return a(r, s, c);
      }, "callBindBasic");
    }
  }), wa = b({
    "node_modules/.pnpm/dunder-proto@1.0.1/node_modules/dunder-proto/get.js"(e, t) {
      "use strict";
      var r = Pn(), o = jr(), s;
      try {
        s = /** @type {{ __proto__?: typeof Array.prototype }} */
        [].__proto__ === Array.prototype;
      } catch (u) {
        if (!u || typeof u != "object" || !("code" in u) || u.code !== "ERR_PROTO_ACCESS")
          throw u;
      }
      var a = !!s && o && o(
        Object.prototype,
        /** @type {keyof typeof Object.prototype} */
        "__proto__"
      ), i = Object, c = i.getPrototypeOf;
      t.exports = a && typeof a.get == "function" ? r([a.get]) : typeof c == "function" ? (
        /** @type {import('./get')} */
        /* @__PURE__ */ n(function(l) {
          return c(l == null ? l : i(l));
        }, "getDunder")
      ) : !1;
    }
  }), Oa = b({
    "node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/index.js"(e, t) {
      "use strict";
      var r = bn(), o = En(), s = wa();
      t.exports = r ? /* @__PURE__ */ n(function(i) {
        return r(i);
      }, "getProto") : o ? /* @__PURE__ */ n(function(i) {
        if (!i || typeof i != "object" && typeof i != "function")
          throw new TypeError("getProto: not an object");
        return o(i);
      }, "getProto") : s ? /* @__PURE__ */ n(function(i) {
        return s(i);
      }, "getProto") : null;
    }
  }), An = b({
    "node_modules/.pnpm/hasown@2.0.2/node_modules/hasown/index.js"(e, t) {
      "use strict";
      var r = Function.prototype.call, o = Object.prototype.hasOwnProperty, s = Lt();
      t.exports = s.call(r, o);
    }
  }), Ca = b({
    "node_modules/.pnpm/get-intrinsic@1.3.0/node_modules/get-intrinsic/index.js"(e, t) {
      "use strict";
      var r, o = hn(), s = la(), a = pa(), i = da(), c = fa(), u = ya(), l = kr(), p = ma(), d = ha(), f = ga(), y = Sa(), m = ba(), h = Ea(),
      g = _a(), S = Aa(), E = Function, A = /* @__PURE__ */ n(function(z) {
        try {
          return E('"use strict"; return (' + z + ").constructor;")();
        } catch {
        }
      }, "getEvalledConstructor"), T = jr(), N = Ia(), v = /* @__PURE__ */ n(function() {
        throw new l();
      }, "throwTypeError"), w = T ? function() {
        try {
          return arguments.callee, v;
        } catch {
          try {
            return T(arguments, "callee").get;
          } catch {
            return v;
          }
        }
      }() : v, k = Sn()(), I = Oa(), Te = En(), Qn = bn(), Kr = _n(), Re = Dr(), pe = {}, Zn = typeof Uint8Array > "u" || !I ? r : I(Uint8Array),
      ne = {
        __proto__: null,
        "%AggregateError%": typeof AggregateError > "u" ? r : AggregateError,
        "%Array%": Array,
        "%ArrayBuffer%": typeof ArrayBuffer > "u" ? r : ArrayBuffer,
        "%ArrayIteratorPrototype%": k && I ? I([][Symbol.iterator]()) : r,
        "%AsyncFromSyncIteratorPrototype%": r,
        "%AsyncFunction%": pe,
        "%AsyncGenerator%": pe,
        "%AsyncGeneratorFunction%": pe,
        "%AsyncIteratorPrototype%": pe,
        "%Atomics%": typeof Atomics > "u" ? r : Atomics,
        "%BigInt%": typeof BigInt > "u" ? r : BigInt,
        "%BigInt64Array%": typeof BigInt64Array > "u" ? r : BigInt64Array,
        "%BigUint64Array%": typeof BigUint64Array > "u" ? r : BigUint64Array,
        "%Boolean%": Boolean,
        "%DataView%": typeof DataView > "u" ? r : DataView,
        "%Date%": Date,
        "%decodeURI%": decodeURI,
        "%decodeURIComponent%": decodeURIComponent,
        "%encodeURI%": encodeURI,
        "%encodeURIComponent%": encodeURIComponent,
        "%Error%": s,
        "%eval%": eval,
        // eslint-disable-line no-eval
        "%EvalError%": a,
        "%Float16Array%": typeof Float16Array > "u" ? r : Float16Array,
        "%Float32Array%": typeof Float32Array > "u" ? r : Float32Array,
        "%Float64Array%": typeof Float64Array > "u" ? r : Float64Array,
        "%FinalizationRegistry%": typeof FinalizationRegistry > "u" ? r : FinalizationRegistry,
        "%Function%": E,
        "%GeneratorFunction%": pe,
        "%Int8Array%": typeof Int8Array > "u" ? r : Int8Array,
        "%Int16Array%": typeof Int16Array > "u" ? r : Int16Array,
        "%Int32Array%": typeof Int32Array > "u" ? r : Int32Array,
        "%isFinite%": isFinite,
        "%isNaN%": isNaN,
        "%IteratorPrototype%": k && I ? I(I([][Symbol.iterator]())) : r,
        "%JSON%": typeof JSON == "object" ? JSON : r,
        "%Map%": typeof Map > "u" ? r : Map,
        "%MapIteratorPrototype%": typeof Map > "u" || !k || !I ? r : I((/* @__PURE__ */ new Map())[Symbol.iterator]()),
        "%Math%": Math,
        "%Number%": Number,
        "%Object%": o,
        "%Object.getOwnPropertyDescriptor%": T,
        "%parseFloat%": parseFloat,
        "%parseInt%": parseInt,
        "%Promise%": typeof Promise > "u" ? r : Promise,
        "%Proxy%": typeof Proxy > "u" ? r : Proxy,
        "%RangeError%": i,
        "%ReferenceError%": c,
        "%Reflect%": typeof Reflect > "u" ? r : Reflect,
        "%RegExp%": RegExp,
        "%Set%": typeof Set > "u" ? r : Set,
        "%SetIteratorPrototype%": typeof Set > "u" || !k || !I ? r : I((/* @__PURE__ */ new Set())[Symbol.iterator]()),
        "%SharedArrayBuffer%": typeof SharedArrayBuffer > "u" ? r : SharedArrayBuffer,
        "%String%": String,
        "%StringIteratorPrototype%": k && I ? I(""[Symbol.iterator]()) : r,
        "%Symbol%": k ? Symbol : r,
        "%SyntaxError%": u,
        "%ThrowTypeError%": w,
        "%TypedArray%": Zn,
        "%TypeError%": l,
        "%Uint8Array%": typeof Uint8Array > "u" ? r : Uint8Array,
        "%Uint8ClampedArray%": typeof Uint8ClampedArray > "u" ? r : Uint8ClampedArray,
        "%Uint16Array%": typeof Uint16Array > "u" ? r : Uint16Array,
        "%Uint32Array%": typeof Uint32Array > "u" ? r : Uint32Array,
        "%URIError%": p,
        "%WeakMap%": typeof WeakMap > "u" ? r : WeakMap,
        "%WeakRef%": typeof WeakRef > "u" ? r : WeakRef,
        "%WeakSet%": typeof WeakSet > "u" ? r : WeakSet,
        "%Function.prototype.call%": Re,
        "%Function.prototype.apply%": Kr,
        "%Object.defineProperty%": N,
        "%Object.getPrototypeOf%": Te,
        "%Math.abs%": d,
        "%Math.floor%": f,
        "%Math.max%": y,
        "%Math.min%": m,
        "%Math.pow%": h,
        "%Math.round%": g,
        "%Math.sign%": S,
        "%Reflect.getPrototypeOf%": Qn
      };
      if (I)
        try {
          null.error;
        } catch (z) {
          zr = I(I(z)), ne["%Error.prototype%"] = zr;
        }
      var zr, es = /* @__PURE__ */ n(function z(x) {
        var C;
        if (x === "%AsyncFunction%")
          C = A("async function () {}");
        else if (x === "%GeneratorFunction%")
          C = A("function* () {}");
        else if (x === "%AsyncGeneratorFunction%")
          C = A("async function* () {}");
        else if (x === "%AsyncGenerator%") {
          var R = z("%AsyncGeneratorFunction%");
          R && (C = R.prototype);
        } else if (x === "%AsyncIteratorPrototype%") {
          var j = z("%AsyncGenerator%");
          j && I && (C = I(j.prototype));
        }
        return ne[x] = C, C;
      }, "doEval2"), Hr = {
        __proto__: null,
        "%ArrayBufferPrototype%": ["ArrayBuffer", "prototype"],
        "%ArrayPrototype%": ["Array", "prototype"],
        "%ArrayProto_entries%": ["Array", "prototype", "entries"],
        "%ArrayProto_forEach%": ["Array", "prototype", "forEach"],
        "%ArrayProto_keys%": ["Array", "prototype", "keys"],
        "%ArrayProto_values%": ["Array", "prototype", "values"],
        "%AsyncFunctionPrototype%": ["AsyncFunction", "prototype"],
        "%AsyncGenerator%": ["AsyncGeneratorFunction", "prototype"],
        "%AsyncGeneratorPrototype%": ["AsyncGeneratorFunction", "prototype", "prototype"],
        "%BooleanPrototype%": ["Boolean", "prototype"],
        "%DataViewPrototype%": ["DataView", "prototype"],
        "%DatePrototype%": ["Date", "prototype"],
        "%ErrorPrototype%": ["Error", "prototype"],
        "%EvalErrorPrototype%": ["EvalError", "prototype"],
        "%Float32ArrayPrototype%": ["Float32Array", "prototype"],
        "%Float64ArrayPrototype%": ["Float64Array", "prototype"],
        "%FunctionPrototype%": ["Function", "prototype"],
        "%Generator%": ["GeneratorFunction", "prototype"],
        "%GeneratorPrototype%": ["GeneratorFunction", "prototype", "prototype"],
        "%Int8ArrayPrototype%": ["Int8Array", "prototype"],
        "%Int16ArrayPrototype%": ["Int16Array", "prototype"],
        "%Int32ArrayPrototype%": ["Int32Array", "prototype"],
        "%JSONParse%": ["JSON", "parse"],
        "%JSONStringify%": ["JSON", "stringify"],
        "%MapPrototype%": ["Map", "prototype"],
        "%NumberPrototype%": ["Number", "prototype"],
        "%ObjectPrototype%": ["Object", "prototype"],
        "%ObjProto_toString%": ["Object", "prototype", "toString"],
        "%ObjProto_valueOf%": ["Object", "prototype", "valueOf"],
        "%PromisePrototype%": ["Promise", "prototype"],
        "%PromiseProto_then%": ["Promise", "prototype", "then"],
        "%Promise_all%": ["Promise", "all"],
        "%Promise_reject%": ["Promise", "reject"],
        "%Promise_resolve%": ["Promise", "resolve"],
        "%RangeErrorPrototype%": ["RangeError", "prototype"],
        "%ReferenceErrorPrototype%": ["ReferenceError", "prototype"],
        "%RegExpPrototype%": ["RegExp", "prototype"],
        "%SetPrototype%": ["Set", "prototype"],
        "%SharedArrayBufferPrototype%": ["SharedArrayBuffer", "prototype"],
        "%StringPrototype%": ["String", "prototype"],
        "%SymbolPrototype%": ["Symbol", "prototype"],
        "%SyntaxErrorPrototype%": ["SyntaxError", "prototype"],
        "%TypedArrayPrototype%": ["TypedArray", "prototype"],
        "%TypeErrorPrototype%": ["TypeError", "prototype"],
        "%Uint8ArrayPrototype%": ["Uint8Array", "prototype"],
        "%Uint8ClampedArrayPrototype%": ["Uint8ClampedArray", "prototype"],
        "%Uint16ArrayPrototype%": ["Uint16Array", "prototype"],
        "%Uint32ArrayPrototype%": ["Uint32Array", "prototype"],
        "%URIErrorPrototype%": ["URIError", "prototype"],
        "%WeakMapPrototype%": ["WeakMap", "prototype"],
        "%WeakSetPrototype%": ["WeakSet", "prototype"]
      }, we = Lt(), qe = An(), ts = we.call(Re, Array.prototype.concat), rs = we.call(Kr, Array.prototype.splice), qr = we.call(Re, String.prototype.
      replace), Ye = we.call(Re, String.prototype.slice), os = we.call(Re, RegExp.prototype.exec), ns = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g,
      ss = /\\(\\)?/g, as = /* @__PURE__ */ n(function(x) {
        var C = Ye(x, 0, 1), R = Ye(x, -1);
        if (C === "%" && R !== "%")
          throw new u("invalid intrinsic syntax, expected closing `%`");
        if (R === "%" && C !== "%")
          throw new u("invalid intrinsic syntax, expected opening `%`");
        var j = [];
        return qr(x, ns, function(H, de, M, Je) {
          j[j.length] = M ? qr(Je, ss, "$1") : de || H;
        }), j;
      }, "stringToPath3"), is = /* @__PURE__ */ n(function(x, C) {
        var R = x, j;
        if (qe(Hr, R) && (j = Hr[R], R = "%" + j[0] + "%"), qe(ne, R)) {
          var H = ne[R];
          if (H === pe && (H = es(R)), typeof H > "u" && !C)
            throw new l("intrinsic " + x + " exists, but is not available. Please file an issue!");
          return {
            alias: j,
            name: R,
            value: H
          };
        }
        throw new u("intrinsic " + x + " does not exist!");
      }, "getBaseIntrinsic2");
      t.exports = /* @__PURE__ */ n(function(x, C) {
        if (typeof x != "string" || x.length === 0)
          throw new l("intrinsic name must be a non-empty string");
        if (arguments.length > 1 && typeof C != "boolean")
          throw new l('"allowMissing" argument must be a boolean');
        if (os(/^%?[^%]*%?$/, x) === null)
          throw new u("`%` may not be present anywhere but at the beginning and end of the intrinsic name");
        var R = as(x), j = R.length > 0 ? R[0] : "", H = is("%" + j + "%", C), de = H.name, M = H.value, Je = !1, Bt = H.alias;
        Bt && (j = Bt[0], rs(R, ts([0, 1], Bt)));
        for (var Xe = 1, Oe = !0; Xe < R.length; Xe += 1) {
          var J = R[Xe], Qe = Ye(J, 0, 1), Ze = Ye(J, -1);
          if ((Qe === '"' || Qe === "'" || Qe === "`" || Ze === '"' || Ze === "'" || Ze === "`") && Qe !== Ze)
            throw new u("property names with quotes must have matching quotes");
          if ((J === "constructor" || !Oe) && (Je = !0), j += "." + J, de = "%" + j + "%", qe(ne, de))
            M = ne[de];
          else if (M != null) {
            if (!(J in M)) {
              if (!C)
                throw new l("base intrinsic for " + x + " exists, but the property is not available.");
              return;
            }
            if (T && Xe + 1 >= R.length) {
              var et = T(M, J);
              Oe = !!et, Oe && "get" in et && !("originalValue" in et.get) ? M = et.get : M = M[J];
            } else
              Oe = qe(M, J), M = M[J];
            Oe && !Je && (ne[de] = M);
          }
        }
        return M;
      }, "GetIntrinsic");
    }
  }), Mr = b({
    "node_modules/.pnpm/call-bound@1.0.4/node_modules/call-bound/index.js"(e, t) {
      "use strict";
      var r = Ca(), o = Pn(), s = o([r("%String.prototype.indexOf%")]);
      t.exports = /* @__PURE__ */ n(function(i, c) {
        var u = (
          /** @type {(this: unknown, ...args: unknown[]) => unknown} */
          r(i, !!c)
        );
        return typeof u == "function" && s(i, ".prototype.") > -1 ? o(
          /** @type {const} */
          [u]
        ) : u;
      }, "callBoundIntrinsic");
    }
  }), Na = b({
    "node_modules/.pnpm/has-tostringtag@1.0.2/node_modules/has-tostringtag/shams.js"(e, t) {
      "use strict";
      var r = gn();
      t.exports = /* @__PURE__ */ n(function() {
        return r() && !!Symbol.toStringTag;
      }, "hasToStringTagShams");
    }
  }), vn = b({
    "node_modules/.pnpm/is-regex@1.2.1/node_modules/is-regex/index.js"(e, t) {
      "use strict";
      var r = Mr(), o = Na()(), s = An(), a = jr(), i;
      o ? (c = r("RegExp.prototype.exec"), u = {}, l = /* @__PURE__ */ n(function() {
        throw u;
      }, "throwRegexMarker"), p = {
        toString: l,
        valueOf: l
      }, typeof Symbol.toPrimitive == "symbol" && (p[Symbol.toPrimitive] = l), i = /* @__PURE__ */ n(function(m) {
        if (!m || typeof m != "object")
          return !1;
        var h = (
          /** @type {NonNullable<typeof gOPD>} */
          a(
            /** @type {{ lastIndex?: unknown }} */
            m,
            "lastIndex"
          )
        ), g = h && s(h, "value");
        if (!g)
          return !1;
        try {
          c(
            m,
            /** @type {string} */
            /** @type {unknown} */
            p
          );
        } catch (S) {
          return S === u;
        }
      }, "isRegex")) : (d = r("Object.prototype.toString"), f = "[object RegExp]", i = /* @__PURE__ */ n(function(m) {
        return !m || typeof m != "object" && typeof m != "function" ? !1 : d(m) === f;
      }, "isRegex"));
      var c, u, l, p, d, f;
      t.exports = i;
    }
  }), ka = b({
    "node_modules/.pnpm/is-function@1.0.2/node_modules/is-function/index.js"(e, t) {
      t.exports = o;
      var r = Object.prototype.toString;
      function o(s) {
        if (!s)
          return !1;
        var a = r.call(s);
        return a === "[object Function]" || typeof s == "function" && a !== "[object RegExp]" || typeof window < "u" && // IE8 and below
        (s === window.setTimeout || s === window.alert || s === window.confirm || s === window.prompt);
      }
      n(o, "isFunction3");
    }
  }), ja = b({
    "node_modules/.pnpm/safe-regex-test@1.1.0/node_modules/safe-regex-test/index.js"(e, t) {
      "use strict";
      var r = Mr(), o = vn(), s = r("RegExp.prototype.exec"), a = kr();
      t.exports = /* @__PURE__ */ n(function(c) {
        if (!o(c))
          throw new a("`regex` must be a RegExp");
        return /* @__PURE__ */ n(function(l) {
          return s(c, l) !== null;
        }, "test");
      }, "regexTester");
    }
  }), Da = b({
    "node_modules/.pnpm/is-symbol@1.1.1/node_modules/is-symbol/index.js"(e, t) {
      "use strict";
      var r = Mr(), o = r("Object.prototype.toString"), s = Sn()(), a = ja();
      s ? (i = r("Symbol.prototype.toString"), c = a(/^Symbol\(.*\)$/), u = /* @__PURE__ */ n(function(p) {
        return typeof p.valueOf() != "symbol" ? !1 : c(i(p));
      }, "isRealSymbolObject"), t.exports = /* @__PURE__ */ n(function(p) {
        if (typeof p == "symbol")
          return !0;
        if (!p || typeof p != "object" || o(p) !== "[object Symbol]")
          return !1;
        try {
          return u(p);
        } catch {
          return !1;
        }
      }, "isSymbol3")) : t.exports = /* @__PURE__ */ n(function(p) {
        return !1;
      }, "isSymbol3");
      var i, c, u;
    }
  }), In = {};
  ca(In, {
    isJSON: /* @__PURE__ */ n(() => Nn, "isJSON"),
    parse: /* @__PURE__ */ n(() => iu, "parse"),
    replacer: /* @__PURE__ */ n(() => jn, "replacer"),
    reviver: /* @__PURE__ */ n(() => Dn, "reviver"),
    stringify: /* @__PURE__ */ n(() => su, "stringify")
  });
  Un.exports = ua(In);
  var Ma = Nr(vn()), Ua = Nr(ka()), La = Nr(Da());
  function Fa(e) {
    return e != null && typeof e == "object" && Array.isArray(e) === !1;
  }
  n(Fa, "isObject");
  var Wa = typeof global == "object" && global && global.Object === Object && global, Ga = Wa, $a = typeof self == "object" && self && self.
  Object === Object && self, Ba = Ga || $a || Function("return this")(), Ur = Ba, Va = Ur.Symbol, Pe = Va, xn = Object.prototype, Ka = xn.hasOwnProperty,
  za = xn.toString, Be = Pe ? Pe.toStringTag : void 0;
  function Ha(e) {
    var t = Ka.call(e, Be), r = e[Be];
    try {
      e[Be] = void 0;
      var o = !0;
    } catch {
    }
    var s = za.call(e);
    return o && (t ? e[Be] = r : delete e[Be]), s;
  }
  n(Ha, "getRawTag");
  var qa = Ha, Ya = Object.prototype, Ja = Ya.toString;
  function Xa(e) {
    return Ja.call(e);
  }
  n(Xa, "objectToString");
  var Qa = Xa, Za = "[object Null]", ei = "[object Undefined]", un = Pe ? Pe.toStringTag : void 0;
  function ti(e) {
    return e == null ? e === void 0 ? ei : Za : un && un in Object(e) ? qa(e) : Qa(e);
  }
  n(ti, "baseGetTag");
  var Tn = ti;
  function ri(e) {
    return e != null && typeof e == "object";
  }
  n(ri, "isObjectLike");
  var oi = ri, ni = "[object Symbol]";
  function si(e) {
    return typeof e == "symbol" || oi(e) && Tn(e) == ni;
  }
  n(si, "isSymbol");
  var Lr = si;
  function ai(e, t) {
    for (var r = -1, o = e == null ? 0 : e.length, s = Array(o); ++r < o; )
      s[r] = t(e[r], r, e);
    return s;
  }
  n(ai, "arrayMap");
  var ii = ai, ci = Array.isArray, Fr = ci, ui = 1 / 0, ln = Pe ? Pe.prototype : void 0, pn = ln ? ln.toString : void 0;
  function Rn(e) {
    if (typeof e == "string")
      return e;
    if (Fr(e))
      return ii(e, Rn) + "";
    if (Lr(e))
      return pn ? pn.call(e) : "";
    var t = e + "";
    return t == "0" && 1 / e == -ui ? "-0" : t;
  }
  n(Rn, "baseToString");
  var li = Rn;
  function pi(e) {
    var t = typeof e;
    return e != null && (t == "object" || t == "function");
  }
  n(pi, "isObject2");
  var wn = pi, di = "[object AsyncFunction]", fi = "[object Function]", yi = "[object GeneratorFunction]", mi = "[object Proxy]";
  function hi(e) {
    if (!wn(e))
      return !1;
    var t = Tn(e);
    return t == fi || t == yi || t == di || t == mi;
  }
  n(hi, "isFunction");
  var gi = hi, Si = Ur["__core-js_shared__"], Cr = Si, dn = function() {
    var e = /[^.]+$/.exec(Cr && Cr.keys && Cr.keys.IE_PROTO || "");
    return e ? "Symbol(src)_1." + e : "";
  }();
  function bi(e) {
    return !!dn && dn in e;
  }
  n(bi, "isMasked");
  var Ei = bi, _i = Function.prototype, Pi = _i.toString;
  function Ai(e) {
    if (e != null) {
      try {
        return Pi.call(e);
      } catch {
      }
      try {
        return e + "";
      } catch {
      }
    }
    return "";
  }
  n(Ai, "toSource");
  var vi = Ai, Ii = /[\\^$.*+?()[\]{}|]/g, xi = /^\[object .+?Constructor\]$/, Ti = Function.prototype, Ri = Object.prototype, wi = Ti.toString,
  Oi = Ri.hasOwnProperty, Ci = RegExp(
    "^" + wi.call(Oi).replace(Ii, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
  );
  function Ni(e) {
    if (!wn(e) || Ei(e))
      return !1;
    var t = gi(e) ? Ci : xi;
    return t.test(vi(e));
  }
  n(Ni, "baseIsNative");
  var ki = Ni;
  function ji(e, t) {
    return e?.[t];
  }
  n(ji, "getValue");
  var Di = ji;
  function Mi(e, t) {
    var r = Di(e, t);
    return ki(r) ? r : void 0;
  }
  n(Mi, "getNative");
  var On = Mi;
  function Ui(e, t) {
    return e === t || e !== e && t !== t;
  }
  n(Ui, "eq");
  var Li = Ui, Fi = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, Wi = /^\w*$/;
  function Gi(e, t) {
    if (Fr(e))
      return !1;
    var r = typeof e;
    return r == "number" || r == "symbol" || r == "boolean" || e == null || Lr(e) ? !0 : Wi.test(e) || !Fi.test(e) || t != null && e in Object(
    t);
  }
  n(Gi, "isKey");
  var $i = Gi, Bi = On(Object, "create"), Ve = Bi;
  function Vi() {
    this.__data__ = Ve ? Ve(null) : {}, this.size = 0;
  }
  n(Vi, "hashClear");
  var Ki = Vi;
  function zi(e) {
    var t = this.has(e) && delete this.__data__[e];
    return this.size -= t ? 1 : 0, t;
  }
  n(zi, "hashDelete");
  var Hi = zi, qi = "__lodash_hash_undefined__", Yi = Object.prototype, Ji = Yi.hasOwnProperty;
  function Xi(e) {
    var t = this.__data__;
    if (Ve) {
      var r = t[e];
      return r === qi ? void 0 : r;
    }
    return Ji.call(t, e) ? t[e] : void 0;
  }
  n(Xi, "hashGet");
  var Qi = Xi, Zi = Object.prototype, ec = Zi.hasOwnProperty;
  function tc(e) {
    var t = this.__data__;
    return Ve ? t[e] !== void 0 : ec.call(t, e);
  }
  n(tc, "hashHas");
  var rc = tc, oc = "__lodash_hash_undefined__";
  function nc(e, t) {
    var r = this.__data__;
    return this.size += this.has(e) ? 0 : 1, r[e] = Ve && t === void 0 ? oc : t, this;
  }
  n(nc, "hashSet");
  var sc = nc;
  function Ae(e) {
    var t = -1, r = e == null ? 0 : e.length;
    for (this.clear(); ++t < r; ) {
      var o = e[t];
      this.set(o[0], o[1]);
    }
  }
  n(Ae, "Hash");
  Ae.prototype.clear = Ki;
  Ae.prototype.delete = Hi;
  Ae.prototype.get = Qi;
  Ae.prototype.has = rc;
  Ae.prototype.set = sc;
  var fn = Ae;
  function ac() {
    this.__data__ = [], this.size = 0;
  }
  n(ac, "listCacheClear");
  var ic = ac;
  function cc(e, t) {
    for (var r = e.length; r--; )
      if (Li(e[r][0], t))
        return r;
    return -1;
  }
  n(cc, "assocIndexOf");
  var Ft = cc, uc = Array.prototype, lc = uc.splice;
  function pc(e) {
    var t = this.__data__, r = Ft(t, e);
    if (r < 0)
      return !1;
    var o = t.length - 1;
    return r == o ? t.pop() : lc.call(t, r, 1), --this.size, !0;
  }
  n(pc, "listCacheDelete");
  var dc = pc;
  function fc(e) {
    var t = this.__data__, r = Ft(t, e);
    return r < 0 ? void 0 : t[r][1];
  }
  n(fc, "listCacheGet");
  var yc = fc;
  function mc(e) {
    return Ft(this.__data__, e) > -1;
  }
  n(mc, "listCacheHas");
  var hc = mc;
  function gc(e, t) {
    var r = this.__data__, o = Ft(r, e);
    return o < 0 ? (++this.size, r.push([e, t])) : r[o][1] = t, this;
  }
  n(gc, "listCacheSet");
  var Sc = gc;
  function ve(e) {
    var t = -1, r = e == null ? 0 : e.length;
    for (this.clear(); ++t < r; ) {
      var o = e[t];
      this.set(o[0], o[1]);
    }
  }
  n(ve, "ListCache");
  ve.prototype.clear = ic;
  ve.prototype.delete = dc;
  ve.prototype.get = yc;
  ve.prototype.has = hc;
  ve.prototype.set = Sc;
  var bc = ve, Ec = On(Ur, "Map"), _c = Ec;
  function Pc() {
    this.size = 0, this.__data__ = {
      hash: new fn(),
      map: new (_c || bc)(),
      string: new fn()
    };
  }
  n(Pc, "mapCacheClear");
  var Ac = Pc;
  function vc(e) {
    var t = typeof e;
    return t == "string" || t == "number" || t == "symbol" || t == "boolean" ? e !== "__proto__" : e === null;
  }
  n(vc, "isKeyable");
  var Ic = vc;
  function xc(e, t) {
    var r = e.__data__;
    return Ic(t) ? r[typeof t == "string" ? "string" : "hash"] : r.map;
  }
  n(xc, "getMapData");
  var Wt = xc;
  function Tc(e) {
    var t = Wt(this, e).delete(e);
    return this.size -= t ? 1 : 0, t;
  }
  n(Tc, "mapCacheDelete");
  var Rc = Tc;
  function wc(e) {
    return Wt(this, e).get(e);
  }
  n(wc, "mapCacheGet");
  var Oc = wc;
  function Cc(e) {
    return Wt(this, e).has(e);
  }
  n(Cc, "mapCacheHas");
  var Nc = Cc;
  function kc(e, t) {
    var r = Wt(this, e), o = r.size;
    return r.set(e, t), this.size += r.size == o ? 0 : 1, this;
  }
  n(kc, "mapCacheSet");
  var jc = kc;
  function Ie(e) {
    var t = -1, r = e == null ? 0 : e.length;
    for (this.clear(); ++t < r; ) {
      var o = e[t];
      this.set(o[0], o[1]);
    }
  }
  n(Ie, "MapCache");
  Ie.prototype.clear = Ac;
  Ie.prototype.delete = Rc;
  Ie.prototype.get = Oc;
  Ie.prototype.has = Nc;
  Ie.prototype.set = jc;
  var Cn = Ie, Dc = "Expected a function";
  function Wr(e, t) {
    if (typeof e != "function" || t != null && typeof t != "function")
      throw new TypeError(Dc);
    var r = /* @__PURE__ */ n(function() {
      var o = arguments, s = t ? t.apply(this, o) : o[0], a = r.cache;
      if (a.has(s))
        return a.get(s);
      var i = e.apply(this, o);
      return r.cache = a.set(s, i) || a, i;
    }, "memoized");
    return r.cache = new (Wr.Cache || Cn)(), r;
  }
  n(Wr, "memoize");
  Wr.Cache = Cn;
  var Mc = Wr, Uc = 500;
  function Lc(e) {
    var t = Mc(e, function(o) {
      return r.size === Uc && r.clear(), o;
    }), r = t.cache;
    return t;
  }
  n(Lc, "memoizeCapped");
  var Fc = Lc, Wc = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g, Gc = /\\(\\)?/g, $c = Fc(
  function(e) {
    var t = [];
    return e.charCodeAt(0) === 46 && t.push(""), e.replace(Wc, function(r, o, s, a) {
      t.push(s ? a.replace(Gc, "$1") : o || r);
    }), t;
  }), Bc = $c;
  function Vc(e) {
    return e == null ? "" : li(e);
  }
  n(Vc, "toString");
  var Kc = Vc;
  function zc(e, t) {
    return Fr(e) ? e : $i(e, t) ? [e] : Bc(Kc(e));
  }
  n(zc, "castPath");
  var Hc = zc, qc = 1 / 0;
  function Yc(e) {
    if (typeof e == "string" || Lr(e))
      return e;
    var t = e + "";
    return t == "0" && 1 / e == -qc ? "-0" : t;
  }
  n(Yc, "toKey");
  var Jc = Yc;
  function Xc(e, t) {
    t = Hc(t, e);
    for (var r = 0, o = t.length; e != null && r < o; )
      e = e[Jc(t[r++])];
    return r && r == o ? e : void 0;
  }
  n(Xc, "baseGet");
  var Qc = Xc;
  function Zc(e, t, r) {
    var o = e == null ? void 0 : Qc(e, t);
    return o === void 0 ? r : o;
  }
  n(Zc, "get");
  var eu = Zc, tu = [
    "bubbles",
    "cancelBubble",
    "cancelable",
    "composed",
    "currentTarget",
    "defaultPrevented",
    "eventPhase",
    "isTrusted",
    "returnValue",
    "srcElement",
    "target",
    "timeStamp",
    "type"
  ], ru = ["detail"];
  function ou(e) {
    let t = tu.filter((r) => e[r] !== void 0).reduce((r, o) => (r[o] = e[o], r), {});
    if (e instanceof CustomEvent)
      for (let r of ru.filter(
        (o) => e[o] !== void 0
      ))
        t[r] = e[r];
    return t;
  }
  n(ou, "extractEventHiddenProperties");
  var Gr = Fa, nu = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/, Nn = /* @__PURE__ */ n((e) => e.match(/^[\[\{\"\}].*[\]\}\"]$/), "is\
JSON");
  function kn(e) {
    if (!Gr(e))
      return e;
    let t = e, r = !1;
    return typeof Event < "u" && e instanceof Event && (t = ou(t), r = !0), t = Object.keys(t).reduce((o, s) => {
      try {
        t[s] && t[s].toJSON, o[s] = t[s];
      } catch {
        r = !0;
      }
      return o;
    }, {}), r ? t : e;
  }
  n(kn, "convertUnconventionalData");
  var jn = /* @__PURE__ */ n(function(t) {
    let r, o, s, a;
    return /* @__PURE__ */ n(function(c, u) {
      try {
        if (c === "")
          return a = [], r = /* @__PURE__ */ new Map([[u, "[]"]]), o = /* @__PURE__ */ new Map(), s = [], u;
        let l = o.get(this) || this;
        for (; s.length && l !== s[0]; )
          s.shift(), a.pop();
        if (typeof u == "boolean")
          return u;
        if (u === void 0)
          return t.allowUndefined ? "_undefined_" : void 0;
        if (u === null)
          return null;
        if (typeof u == "number")
          return u === Number.NEGATIVE_INFINITY ? "_-Infinity_" : u === Number.POSITIVE_INFINITY ? "_Infinity_" : Number.isNaN(u) ? "_NaN_" :
          u;
        if (typeof u == "bigint")
          return `_bigint_${u.toString()}`;
        if (typeof u == "string")
          return nu.test(u) ? t.allowDate ? `_date_${u}` : void 0 : u;
        if ((0, Ma.default)(u))
          return t.allowRegExp ? `_regexp_${u.flags}|${u.source}` : void 0;
        if ((0, Ua.default)(u))
          return;
        if ((0, La.default)(u)) {
          if (!t.allowSymbol)
            return;
          let d = Symbol.keyFor(u);
          return d !== void 0 ? `_gsymbol_${d}` : `_symbol_${u.toString().slice(7, -1)}`;
        }
        if (s.length >= t.maxDepth)
          return Array.isArray(u) ? `[Array(${u.length})]` : "[Object]";
        if (u === this)
          return `_duplicate_${JSON.stringify(a)}`;
        if (u instanceof Error && t.allowError)
          return {
            __isConvertedError__: !0,
            errorProperties: {
              // @ts-expect-error cause is not defined in the current tsconfig target(es2020)
              ...u.cause ? { cause: u.cause } : {},
              ...u,
              name: u.name,
              message: u.message,
              stack: u.stack,
              "_constructor-name_": u.constructor.name
            }
          };
        if (u?.constructor?.name && u.constructor.name !== "Object" && !Array.isArray(u)) {
          let d = r.get(u);
          if (!d) {
            let f = {
              __isClassInstance__: !0,
              __className__: u.constructor.name,
              ...Object.getOwnPropertyNames(u).reduce(
                (y, m) => {
                  try {
                    y[m] = u[m];
                  } catch {
                  }
                  return y;
                },
                {}
              )
            };
            return a.push(c), s.unshift(f), r.set(u, JSON.stringify(a)), u !== f && o.set(u, f), f;
          }
          return `_duplicate_${d}`;
        }
        let p = r.get(u);
        if (!p) {
          let d = Array.isArray(u) ? u : kn(u);
          return a.push(c), s.unshift(d), r.set(u, JSON.stringify(a)), u !== d && o.set(u, d), d;
        }
        return `_duplicate_${p}`;
      } catch {
        return;
      }
    }, "replace");
  }, "replacer2"), Dn = /* @__PURE__ */ n(function(t) {
    let r = [], o;
    return /* @__PURE__ */ n(function(a, i) {
      if (a === "" && (o = i, r.forEach(({ target: c, container: u, replacement: l }) => {
        let p = Nn(l) ? JSON.parse(l) : l.split(".");
        p.length === 0 ? u[c] = o : u[c] = eu(o, p);
      })), a === "_constructor-name_")
        return i;
      if (Gr(i) && i.__isConvertedError__) {
        let { message: c, ...u } = i.errorProperties, l = new Error(c);
        return Object.assign(l, u), l;
      }
      if (typeof i == "string" && i.startsWith("_regexp_") && t.allowRegExp) {
        let [, c, u] = i.match(/_regexp_([^|]*)\|(.*)/) || [];
        return new RegExp(u, c);
      }
      return typeof i == "string" && i.startsWith("_date_") && t.allowDate ? new Date(i.replace("_date_", "")) : typeof i == "string" && i.startsWith(
      "_duplicate_") ? (r.push({ target: a, container: this, replacement: i.replace(/^_duplicate_/, "") }), null) : typeof i == "string" && i.
      startsWith("_symbol_") && t.allowSymbol ? Symbol(i.replace("_symbol_", "")) : typeof i == "string" && i.startsWith("_gsymbol_") && t.allowSymbol ?
      Symbol.for(i.replace("_gsymbol_", "")) : typeof i == "string" && i === "_-Infinity_" ? Number.NEGATIVE_INFINITY : typeof i == "string" &&
      i === "_Infinity_" ? Number.POSITIVE_INFINITY : typeof i == "string" && i === "_NaN_" ? Number.NaN : typeof i == "string" && i.startsWith(
      "_bigint_") && typeof BigInt == "function" ? BigInt(i.replace("_bigint_", "")) : i;
    }, "revive");
  }, "reviver2"), Mn = {
    maxDepth: 10,
    space: void 0,
    allowRegExp: !0,
    allowDate: !0,
    allowError: !0,
    allowUndefined: !0,
    allowSymbol: !0
  }, su = /* @__PURE__ */ n((e, t = {}) => {
    let r = { ...Mn, ...t };
    return JSON.stringify(kn(e), jn(r), t.space);
  }, "stringify"), au = /* @__PURE__ */ n(() => {
    let e = /* @__PURE__ */ new Map();
    return /* @__PURE__ */ n(function t(r) {
      Gr(r) && Object.entries(r).forEach(([o, s]) => {
        s === "_undefined_" ? r[o] = void 0 : e.get(s) || (e.set(s, !0), t(s));
      }), Array.isArray(r) && r.forEach((o, s) => {
        o === "_undefined_" ? (e.set(o, !0), r[s] = void 0) : e.get(o) || (e.set(o, !0), t(o));
      });
    }, "mutateUndefined");
  }, "mutator"), iu = /* @__PURE__ */ n((e, t = {}) => {
    let r = { ...Mn, ...t }, o = JSON.parse(e, Dn(r));
    return au()(o), o;
  }, "parse");
});

// src/manager-api/index.ts
var Iu = {};
U(Iu, {
  ActiveTabs: () => pu,
  Consumer: () => Gn,
  ManagerContext: () => He,
  Provider: () => Br,
  RequestResponseError: () => ze,
  addons: () => po,
  combineParameters: () => ar,
  controlOrMetaKey: () => Us,
  controlOrMetaSymbol: () => Ms,
  eventMatchesShortcut: () => Fs,
  eventToShortcut: () => Rt,
  experimental_MockUniversalStore: () => $t,
  experimental_UniversalStore: () => G,
  experimental_getStatusStore: () => Jo,
  experimental_getTestProviderStore: () => Yn,
  experimental_requestResponse: () => lu,
  experimental_useStatusStore: () => Xo,
  experimental_useTestProviderStore: () => Jn,
  experimental_useUniversalStore: () => _e,
  internal_fullStatusStore: () => Ge,
  internal_fullTestProviderStore: () => qn,
  internal_universalStatusStore: () => Qo,
  internal_universalTestProviderStore: () => Xn,
  isMacLike: () => Tt,
  isShortcutTaken: () => Ls,
  keyToSymbol: () => $o,
  merge: () => K,
  mockChannel: () => At,
  optionOrAltSymbol: () => Go,
  shortcutMatchesShortcut: () => wt,
  shortcutToHumanString: () => Ws,
  types: () => Au,
  useAddonState: () => gu,
  useArgTypes: () => Pu,
  useArgs: () => Su,
  useChannel: () => Vr,
  useGlobalTypes: () => Eu,
  useGlobals: () => bu,
  useParameter: () => hu,
  useSharedState: () => Bn,
  useStoryPrepared: () => mu,
  useStorybookApi: () => X,
  useStorybookState: () => yu
});
module.exports = fs(Iu);

// src/manager-api/root.tsx
var P = L(require("react"), 1), O = require("storybook/internal/core-events");

// ../node_modules/es-toolkit/dist/array/countBy.mjs
function Vt(e, t) {
  let r = {};
  for (let o = 0; o < e.length; o++) {
    let s = e[o], a = t(s);
    r[a] = (r[a] ?? 0) + 1;
  }
  return r;
}
n(Vt, "countBy");

// ../node_modules/es-toolkit/dist/array/partition.mjs
function tt(e, t) {
  let r = [], o = [];
  for (let s = 0; s < e.length; s++) {
    let a = e[s];
    t(a) ? r.push(a) : o.push(a);
  }
  return [r, o];
}
n(tt, "partition");

// ../node_modules/es-toolkit/dist/function/noop.mjs
function Jr() {
}
n(Jr, "noop");

// ../node_modules/es-toolkit/dist/predicate/isPrimitive.mjs
function Xr(e) {
  return e == null || typeof e != "object" && typeof e != "function";
}
n(Xr, "isPrimitive");

// ../node_modules/es-toolkit/dist/predicate/isTypedArray.mjs
function Qr(e) {
  return ArrayBuffer.isView(e) && !(e instanceof DataView);
}
n(Qr, "isTypedArray");

// ../node_modules/es-toolkit/dist/compat/_internal/getSymbols.mjs
function Ne(e) {
  return Object.getOwnPropertySymbols(e).filter((t) => Object.prototype.propertyIsEnumerable.call(e, t));
}
n(Ne, "getSymbols");

// ../node_modules/es-toolkit/dist/compat/_internal/getTag.mjs
function ke(e) {
  return e == null ? e === void 0 ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(e);
}
n(ke, "getTag");

// ../node_modules/es-toolkit/dist/compat/_internal/tags.mjs
var rt = "[object RegExp]", ot = "[object String]", nt = "[object Number]", st = "[object Boolean]", je = "[object Arguments]", at = "[objec\
t Symbol]", it = "[object Date]", ct = "[object Map]", ut = "[object Set]", lt = "[object Array]", Zr = "[object Function]", pt = "[object A\
rrayBuffer]", ye = "[object Object]", eo = "[object Error]", dt = "[object DataView]", ft = "[object Uint8Array]", yt = "[object Uint8Clampe\
dArray]", mt = "[object Uint16Array]", ht = "[object Uint32Array]", to = "[object BigUint64Array]", gt = "[object Int8Array]", St = "[object\
 Int16Array]", bt = "[object Int32Array]", ro = "[object BigInt64Array]", Et = "[object Float32Array]", _t = "[object Float64Array]";

// ../node_modules/es-toolkit/dist/object/cloneDeepWith.mjs
function se(e, t, r, o = /* @__PURE__ */ new Map(), s = void 0) {
  let a = s?.(e, t, r, o);
  if (a != null)
    return a;
  if (Xr(e))
    return e;
  if (o.has(e))
    return o.get(e);
  if (Array.isArray(e)) {
    let i = new Array(e.length);
    o.set(e, i);
    for (let c = 0; c < e.length; c++)
      i[c] = se(e[c], c, r, o, s);
    return Object.hasOwn(e, "index") && (i.index = e.index), Object.hasOwn(e, "input") && (i.input = e.input), i;
  }
  if (e instanceof Date)
    return new Date(e.getTime());
  if (e instanceof RegExp) {
    let i = new RegExp(e.source, e.flags);
    return i.lastIndex = e.lastIndex, i;
  }
  if (e instanceof Map) {
    let i = /* @__PURE__ */ new Map();
    o.set(e, i);
    for (let [c, u] of e)
      i.set(c, se(u, c, r, o, s));
    return i;
  }
  if (e instanceof Set) {
    let i = /* @__PURE__ */ new Set();
    o.set(e, i);
    for (let c of e)
      i.add(se(c, void 0, r, o, s));
    return i;
  }
  if (typeof Buffer < "u" && Buffer.isBuffer(e))
    return e.subarray();
  if (Qr(e)) {
    let i = new (Object.getPrototypeOf(e)).constructor(e.length);
    o.set(e, i);
    for (let c = 0; c < e.length; c++)
      i[c] = se(e[c], c, r, o, s);
    return i;
  }
  if (e instanceof ArrayBuffer || typeof SharedArrayBuffer < "u" && e instanceof SharedArrayBuffer)
    return e.slice(0);
  if (e instanceof DataView) {
    let i = new DataView(e.buffer.slice(0), e.byteOffset, e.byteLength);
    return o.set(e, i), De(i, e, r, o, s), i;
  }
  if (typeof File < "u" && e instanceof File) {
    let i = new File([e], e.name, {
      type: e.type
    });
    return o.set(e, i), De(i, e, r, o, s), i;
  }
  if (e instanceof Blob) {
    let i = new Blob([e], { type: e.type });
    return o.set(e, i), De(i, e, r, o, s), i;
  }
  if (e instanceof Error) {
    let i = new e.constructor();
    return o.set(e, i), i.message = e.message, i.name = e.name, i.stack = e.stack, i.cause = e.cause, De(i, e, r, o, s), i;
  }
  if (typeof e == "object" && ys(e)) {
    let i = Object.create(Object.getPrototypeOf(e));
    return o.set(e, i), De(i, e, r, o, s), i;
  }
  return e;
}
n(se, "cloneDeepWithImpl");
function De(e, t, r = e, o, s) {
  let a = [...Object.keys(t), ...Ne(t)];
  for (let i = 0; i < a.length; i++) {
    let c = a[i], u = Object.getOwnPropertyDescriptor(e, c);
    (u == null || u.writable) && (e[c] = se(t[c], c, r, o, s));
  }
}
n(De, "copyProperties");
function ys(e) {
  switch (ke(e)) {
    case je:
    case lt:
    case pt:
    case dt:
    case st:
    case it:
    case Et:
    case _t:
    case gt:
    case St:
    case bt:
    case ct:
    case nt:
    case ye:
    case rt:
    case ut:
    case ot:
    case at:
    case ft:
    case yt:
    case mt:
    case ht:
      return !0;
    default:
      return !1;
  }
}
n(ys, "isCloneableObject");

// ../node_modules/es-toolkit/dist/object/cloneDeep.mjs
function oo(e) {
  return se(e, void 0, e, /* @__PURE__ */ new Map(), void 0);
}
n(oo, "cloneDeep");

// ../node_modules/es-toolkit/dist/predicate/isPlainObject.mjs
function me(e) {
  if (!e || typeof e != "object")
    return !1;
  let t = Object.getPrototypeOf(e);
  return t === null || t === Object.prototype || Object.getPrototypeOf(t) === null ? Object.prototype.toString.call(e) === "[object Object]" :
  !1;
}
n(me, "isPlainObject");

// ../node_modules/es-toolkit/dist/object/mapValues.mjs
function Kt(e, t) {
  let r = {}, o = Object.keys(e);
  for (let s = 0; s < o.length; s++) {
    let a = o[s], i = e[a];
    r[a] = t(i, a, e);
  }
  return r;
}
n(Kt, "mapValues");

// ../node_modules/es-toolkit/dist/object/merge.mjs
function he(e, t) {
  let r = Object.keys(t);
  for (let o = 0; o < r.length; o++) {
    let s = r[o], a = t[s], i = e[s];
    Array.isArray(a) ? Array.isArray(i) ? e[s] = he(i, a) : e[s] = he([], a) : me(a) ? me(i) ? e[s] = he(i, a) : e[s] = he({}, a) : (i === void 0 ||
    a !== void 0) && (e[s] = a);
  }
  return e;
}
n(he, "merge");

// ../node_modules/es-toolkit/dist/compat/predicate/isObjectLike.mjs
function zt(e) {
  return typeof e == "object" && e !== null;
}
n(zt, "isObjectLike");

// ../node_modules/es-toolkit/dist/object/mergeWith.mjs
function Q(e, t, r) {
  let o = Object.keys(t);
  for (let s = 0; s < o.length; s++) {
    let a = o[s], i = t[a], c = e[a], u = r(c, i, a, e, t);
    u != null ? e[a] = u : Array.isArray(i) ? e[a] = Q(c ?? [], i, r) : zt(c) && zt(i) ? e[a] = Q(c ?? {}, i, r) : (c === void 0 || i !== void 0) &&
    (e[a] = i);
  }
  return e;
}
n(Q, "mergeWith");

// ../node_modules/es-toolkit/dist/object/pick.mjs
function ae(e, t) {
  let r = {};
  for (let o = 0; o < t.length; o++) {
    let s = t[o];
    Object.hasOwn(e, s) && (r[s] = e[s]);
  }
  return r;
}
n(ae, "pick");

// ../node_modules/es-toolkit/dist/object/toMerged.mjs
function Me(e, t) {
  return he(oo(e), t);
}
n(Me, "toMerged");

// ../node_modules/es-toolkit/dist/compat/util/eq.mjs
function no(e, t) {
  return e === t || Number.isNaN(e) && Number.isNaN(t);
}
n(no, "eq");

// ../node_modules/es-toolkit/dist/predicate/isEqualWith.mjs
function so(e, t, r) {
  return Ue(e, t, void 0, void 0, void 0, void 0, r);
}
n(so, "isEqualWith");
function Ue(e, t, r, o, s, a, i) {
  let c = i(e, t, r, o, s, a);
  if (c !== void 0)
    return c;
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
        return Le(e, t, a, i);
    }
  return Le(e, t, a, i);
}
n(Ue, "isEqualWithImpl");
function Le(e, t, r, o) {
  if (Object.is(e, t))
    return !0;
  let s = ke(e), a = ke(t);
  if (s === je && (s = ye), a === je && (a = ye), s !== a)
    return !1;
  switch (s) {
    case ot:
      return e.toString() === t.toString();
    case nt: {
      let u = e.valueOf(), l = t.valueOf();
      return no(u, l);
    }
    case st:
    case it:
    case at:
      return Object.is(e.valueOf(), t.valueOf());
    case rt:
      return e.source === t.source && e.flags === t.flags;
    case Zr:
      return e === t;
  }
  r = r ?? /* @__PURE__ */ new Map();
  let i = r.get(e), c = r.get(t);
  if (i != null && c != null)
    return i === t;
  r.set(e, t), r.set(t, e);
  try {
    switch (s) {
      case ct: {
        if (e.size !== t.size)
          return !1;
        for (let [u, l] of e.entries())
          if (!t.has(u) || !Ue(l, t.get(u), u, e, t, r, o))
            return !1;
        return !0;
      }
      case ut: {
        if (e.size !== t.size)
          return !1;
        let u = Array.from(e.values()), l = Array.from(t.values());
        for (let p = 0; p < u.length; p++) {
          let d = u[p], f = l.findIndex((y) => Ue(d, y, void 0, e, t, r, o));
          if (f === -1)
            return !1;
          l.splice(f, 1);
        }
        return !0;
      }
      case lt:
      case ft:
      case yt:
      case mt:
      case ht:
      case to:
      case gt:
      case St:
      case bt:
      case ro:
      case Et:
      case _t: {
        if (typeof Buffer < "u" && Buffer.isBuffer(e) !== Buffer.isBuffer(t) || e.length !== t.length)
          return !1;
        for (let u = 0; u < e.length; u++)
          if (!Ue(e[u], t[u], u, e, t, r, o))
            return !1;
        return !0;
      }
      case pt:
        return e.byteLength !== t.byteLength ? !1 : Le(new Uint8Array(e), new Uint8Array(t), r, o);
      case dt:
        return e.byteLength !== t.byteLength || e.byteOffset !== t.byteOffset ? !1 : Le(new Uint8Array(e), new Uint8Array(t), r, o);
      case eo:
        return e.name === t.name && e.message === t.message;
      case ye: {
        if (!(Le(e.constructor, t.constructor, r, o) || me(e) && me(t)))
          return !1;
        let l = [...Object.keys(e), ...Ne(e)], p = [...Object.keys(t), ...Ne(t)];
        if (l.length !== p.length)
          return !1;
        for (let d = 0; d < l.length; d++) {
          let f = l[d], y = e[f];
          if (!Object.hasOwn(t, f))
            return !1;
          let m = t[f];
          if (!Ue(y, m, f, e, t, r, o))
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
n(Le, "areObjectsEqual");

// ../node_modules/es-toolkit/dist/predicate/isEqual.mjs
function F(e, t) {
  return so(e, t, Jr);
}
n(F, "isEqual");

// src/manager-api/context.ts
var ao = require("react");
var io = /* @__PURE__ */ n(({ api: e, state: t }) => (0, ao.createContext)({ api: e, state: t }), "createContext");

// src/manager-api/lib/merge.ts
var Ht = require("storybook/internal/client-logger");
var K = /* @__PURE__ */ n((e, ...t) => {
  let r = {};
  r = Q(
    {},
    e,
    (o, s) => {
      if (Array.isArray(s) && Array.isArray(o))
        return s.forEach((a) => {
          o.find((c) => c === a || F(c, a)) || o.push(a);
        }), o;
      if (Array.isArray(o))
        return Ht.logger.log(["the types mismatch, picking", o]), o;
    }
  );
  for (let o of t)
    r = Q(r, o, (s, a) => {
      if (Array.isArray(a) && Array.isArray(s))
        return a.forEach((i) => {
          s.find((u) => u === i || F(u, i)) || s.push(i);
        }), s;
      if (Array.isArray(s))
        return Ht.logger.log(["the types mismatch, picking", s]), s;
    });
  return r;
}, "default"), co = /* @__PURE__ */ n((e, ...t) => {
  let r = {};
  r = Q(
    {},
    e,
    (o, s) => {
      if (Array.isArray(s))
        return s;
    }
  );
  for (let o of t)
    r = Q(r, o, (s, a) => {
      if (Array.isArray(a))
        return a;
    });
  return r;
}, "noArrayMerge");

// src/manager-api/initial-state.ts
var ms = /* @__PURE__ */ n((...e) => e.reduce((t, r) => K(t, r), {}), "main"), Pt = ms;

// src/manager-api/lib/addons.ts
var lo = require("storybook/internal/client-logger"), Yt = require("storybook/internal/core-events"), Xt = require("storybook/internal/types"),
vt = require("@storybook/global");

// src/manager-api/lib/storybook-channel-mock.ts
var uo = require("storybook/internal/channels");
function At() {
  let e = {
    setHandler: /* @__PURE__ */ n(() => {
    }, "setHandler"),
    send: /* @__PURE__ */ n(() => {
    }, "send")
  };
  return new uo.Channel({ transport: e });
}
n(At, "mockChannel");

// src/manager-api/lib/addons.ts
var Jt = class {
  constructor() {
    this.loaders = {};
    this.elements = {};
    this.config = {};
    this.getChannel = /* @__PURE__ */ n(() => (this.channel || this.setChannel(At()), this.channel), "getChannel");
    this.ready = /* @__PURE__ */ n(() => this.promise, "ready");
    this.hasChannel = /* @__PURE__ */ n(() => !!this.channel, "hasChannel");
    this.setChannel = /* @__PURE__ */ n((t) => {
      this.channel = t, this.resolve();
    }, "setChannel");
    this.setConfig = /* @__PURE__ */ n((t) => {
      Object.assign(this.config, t), this.hasChannel() ? this.getChannel().emit(Yt.SET_CONFIG, this.config) : this.ready().then((r) => {
        r.emit(Yt.SET_CONFIG, this.config);
      });
    }, "setConfig");
    this.getConfig = /* @__PURE__ */ n(() => this.config, "getConfig");
    /**
     * Registers an addon loader function.
     *
     * @param {string} id - The id of the addon loader.
     * @param {(api: API) => void} callback - The function that will be called to register the addon.
     * @returns {void}
     */
    this.register = /* @__PURE__ */ n((t, r) => {
      this.loaders[t] && lo.logger.warn(`${t} was loaded twice, this could have bad side-effects`), this.loaders[t] = r;
    }, "register");
    this.loadAddons = /* @__PURE__ */ n((t) => {
      Object.values(this.loaders).forEach((r) => r(t));
    }, "loadAddons");
    this.promise = new Promise((t) => {
      this.resolve = () => t(this.getChannel());
    });
  }
  static {
    n(this, "AddonStore");
  }
  getElements(t) {
    return this.elements[t] || (this.elements[t] = {}), this.elements[t];
  }
  /**
   * Adds an addon to the addon store.
   *
   * @param {string} id - The id of the addon.
   * @param {Addon_Type} addon - The addon to add.
   * @returns {void}
   */
  add(t, r) {
    let { type: o } = r, s = this.getElements(o);
    s[t] = { ...r, id: t };
  }
  experimental_getRegisteredAddons() {
    return Object.keys(this.loaders);
  }
}, qt = "__STORYBOOK_ADDONS_MANAGER";
function hs() {
  return vt.global[qt] || (vt.global[qt] = new Jt()), vt.global[qt];
}
n(hs, "getAddonsStore");
var po = hs();

// src/manager-api/modules/addons.ts
var er = {};
U(er, {
  ensurePanel: () => Zt,
  init: () => gs
});
var Qt = require("storybook/internal/types");
function Zt(e, t, r) {
  let o = Object.keys(e);
  return o.indexOf(t) >= 0 ? t : o.length ? o[0] : r;
}
n(Zt, "ensurePanel");
var gs = /* @__PURE__ */ n(({ provider: e, store: t, fullAPI: r }) => {
  let o = {
    getElements: /* @__PURE__ */ n((s) => e.getElements(s), "getElements"),
    getSelectedPanel: /* @__PURE__ */ n(() => {
      let { selectedPanel: s } = t.getState();
      return Zt(o.getElements(Qt.Addon_TypesEnum.PANEL), s, s);
    }, "getSelectedPanel"),
    setSelectedPanel: /* @__PURE__ */ n((s) => {
      t.setState({ selectedPanel: s }, { persistence: "session" });
    }, "setSelectedPanel"),
    setAddonState(s, a, i) {
      let c = typeof a == "function" ? a : () => a;
      return t.setState(
        (u) => ({ ...u, addons: { ...u.addons, [s]: c(u.addons[s]) } }),
        i
      ).then(() => o.getAddonState(s));
    },
    getAddonState: /* @__PURE__ */ n((s) => t.getState().addons[s] || globalThis?.STORYBOOK_ADDON_STATE[s], "getAddonState")
  };
  return {
    api: o,
    state: {
      selectedPanel: Zt(
        o.getElements(Qt.Addon_TypesEnum.PANEL),
        t.getState().selectedPanel
      ),
      addons: {}
    }
  };
}, "init");

// src/manager-api/modules/channel.ts
var tr = {};
U(tr, {
  init: () => Ss
});
var Ss = /* @__PURE__ */ n(({ provider: e }) => ({ api: {
  getChannel: /* @__PURE__ */ n(() => e.channel, "getChannel"),
  on: /* @__PURE__ */ n((r, o) => (e.channel?.on(r, o), () => e.channel?.off(r, o)), "on"),
  off: /* @__PURE__ */ n((r, o) => e.channel?.off(r, o), "off"),
  once: /* @__PURE__ */ n((r, o) => e.channel?.once(r, o), "once"),
  emit: /* @__PURE__ */ n((r, o, ...s) => {
    o?.options?.target && o.options.target !== "storybook-preview-iframe" && !o.options.target.startsWith("storybook-ref-") && (o.options.target =
    o.options.target !== "storybook_internal" ? `storybook-ref-${o.options.target}` : "storybook-preview-iframe"), e.channel?.emit(r, o, ...s);
  }, "emit")
}, state: {} }), "init");

// src/manager-api/modules/globals.ts
var pr = {};
U(pr, {
  init: () => Os
});
var lr = require("storybook/internal/client-logger"), Se = require("storybook/internal/core-events");

// ../node_modules/dequal/dist/index.mjs
var fo = Object.prototype.hasOwnProperty;
function yo(e, t, r) {
  for (r of e.keys())
    if (B(r, t)) return r;
}
n(yo, "find");
function B(e, t) {
  var r, o, s;
  if (e === t) return !0;
  if (e && t && (r = e.constructor) === t.constructor) {
    if (r === Date) return e.getTime() === t.getTime();
    if (r === RegExp) return e.toString() === t.toString();
    if (r === Array) {
      if ((o = e.length) === t.length)
        for (; o-- && B(e[o], t[o]); ) ;
      return o === -1;
    }
    if (r === Set) {
      if (e.size !== t.size)
        return !1;
      for (o of e)
        if (s = o, s && typeof s == "object" && (s = yo(t, s), !s) || !t.has(s)) return !1;
      return !0;
    }
    if (r === Map) {
      if (e.size !== t.size)
        return !1;
      for (o of e)
        if (s = o[0], s && typeof s == "object" && (s = yo(t, s), !s) || !B(o[1], t.get(s)))
          return !1;
      return !0;
    }
    if (r === ArrayBuffer)
      e = new Uint8Array(e), t = new Uint8Array(t);
    else if (r === DataView) {
      if ((o = e.byteLength) === t.byteLength)
        for (; o-- && e.getInt8(o) === t.getInt8(o); ) ;
      return o === -1;
    }
    if (ArrayBuffer.isView(e)) {
      if ((o = e.byteLength) === t.byteLength)
        for (; o-- && e[o] === t[o]; ) ;
      return o === -1;
    }
    if (!r || typeof e == "object") {
      o = 0;
      for (r in e)
        if (fo.call(e, r) && ++o && !fo.call(t, r) || !(r in t) || !B(e[r], t[r])) return !1;
      return Object.keys(t).length === o;
    }
  }
  return e !== e && t !== t;
}
n(B, "dequal");

// src/manager-api/lib/events.ts
var ko = require("storybook/internal/client-logger");

// src/manager-api/modules/refs.ts
var ur = {};
U(ur, {
  defaultStoryMapper: () => No,
  getSourceType: () => cr,
  init: () => ws
});
var ir = require("@storybook/global"), Co = L(ie(), 1);

// src/manager-api/lib/stories.ts
var Ao = require("storybook/internal/csf");
var nr = L(rr(), 1), or = L(ie(), 1);

// src/manager-api/lib/intersect.ts
var Po = /* @__PURE__ */ n((e, t) => !Array.isArray(e) || !Array.isArray(t) || !e.length || !t.length ? [] : e.reduce((r, o) => (t.includes(
o) && r.push(o), r), []), "default");

// src/manager-api/lib/stories.ts
var Ps = /\s*\/\s*/, vo = /* @__PURE__ */ n(({
  globalParameters: e,
  kindParameters: t,
  stories: r
}) => Kt(r, (o) => ({
  ...o,
  parameters: ar(
    e,
    t[o.kind],
    o.parameters
  )
})), "denormalizeStoryParameters"), Io = /* @__PURE__ */ n((e) => ({ v: 5, entries: Object.entries(e).reduce(
  (r, [o, s]) => {
    if (!s)
      return r;
    let { docsOnly: a, fileName: i, ...c } = s.parameters, u = {
      title: s.kind,
      id: o,
      name: s.name,
      importPath: i
    };
    if (a)
      r[o] = {
        type: "docs",
        tags: ["stories-mdx"],
        storiesImports: [],
        ...u
      };
    else {
      let { argTypes: l, args: p, initialArgs: d } = s;
      r[o] = {
        type: "story",
        ...u,
        parameters: c,
        argTypes: l,
        args: p,
        initialArgs: d
      };
    }
    return r;
  },
  {}
) }), "transformSetStoriesStoryDataToPreparedStoryIndex"), As = /* @__PURE__ */ n((e) => ({
  v: 3,
  stories: Object.values(e.stories).reduce(
    (t, r) => (t[r.id] = {
      ...r,
      title: r.kind,
      name: r.name || r.story,
      importPath: r.parameters.fileName || ""
    }, t),
    {}
  )
}), "transformStoryIndexV2toV3"), vs = /* @__PURE__ */ n((e) => {
  let t = Vt(Object.values(e.stories), (r) => r.title);
  return {
    v: 4,
    entries: Object.values(e.stories).reduce(
      (r, o) => {
        let s = "story";
        return (o.parameters?.docsOnly || o.name === "Page" && t[o.title] === 1) && (s = "docs"), r[o.id] = {
          type: s,
          ...s === "docs" && { tags: ["stories-mdx"], storiesImports: [] },
          ...o
        }, delete r[o.id].story, delete r[o.id].kind, r;
      },
      {}
    )
  };
}, "transformStoryIndexV3toV4"), Is = /* @__PURE__ */ n((e) => ({
  v: 5,
  entries: Object.values(e.entries).reduce(
    (t, r) => (t[r.id] = {
      ...r,
      tags: r.tags ? ["dev", "test", ...r.tags] : ["dev"]
    }, t),
    {}
  )
}), "transformStoryIndexV4toV5"), ge = /* @__PURE__ */ n((e, { provider: t, docsOptions: r, filters: o, allStatuses: s }) => {
  if (!e.v)
    throw new Error("Composition: Missing stories.json version");
  let a = e;
  a = a.v === 2 ? As(a) : a, a = a.v === 3 ? vs(a) : a, a = a.v === 4 ? Is(a) : a, a = a;
  let i = Object.values(a.entries).filter((h) => {
    let g = !0, S = s[h.id] ?? {};
    return Object.values(S).some(({ value: E }) => E === "status-value:error") || Object.values(o).forEach((E) => {
      g !== !1 && (g = E({ ...h, statuses: S }));
    }), g;
  }), { sidebar: c = {} } = t.getConfig(), { showRoots: u, collapsedRoots: l = [], renderLabel: p } = c, d = typeof u < "u", f = i.reduce((h, g) => {
    if (r.docsMode && g.type !== "docs")
      return h;
    let { title: S } = g, E = S.trim().split(Ps), A = (!d || u) && E.length > 1 ? [E.shift()] : [], T = [...A, ...E], N = T.reduce((v, w, k) => {
      let I = k > 0 && v[k - 1], Te = (0, Ao.sanitize)(I ? `${I}-${w}` : w);
      if (w.trim() === "")
        throw new Error(or.dedent`Invalid title ${S} ending in slash.`);
      if (I === Te)
        throw new Error(
          or.dedent`
          Invalid part '${w}', leading to id === parentId ('${Te}'), inside title '${S}'
          
          Did you create a path that uses the separator char accidentally, such as 'Vue <docs/>' where '/' is a separator char? See https://github.com/storybookjs/storybook/issues/6128
          `
        );
      return v.push(Te), v;
    }, []);
    return N.forEach((v, w) => {
      let k = N[w + 1] || g.id;
      A.length && w === 0 ? h[v] = K(h[v] || {}, {
        type: "root",
        id: v,
        name: T[w],
        tags: [],
        depth: w,
        renderLabel: p,
        startCollapsed: l.includes(v),
        // Note that this will later get appended to the previous list of children (see below)
        children: [k]
      }) : (!h[v] || h[v].type === "component") && w === N.length - 1 ? h[v] = K(h[v] || {}, {
        type: "component",
        id: v,
        name: T[w],
        tags: [],
        parent: N[w - 1],
        depth: w,
        renderLabel: p,
        ...k && {
          children: [k]
        }
      }) : h[v] = K(h[v] || {}, {
        type: "group",
        id: v,
        name: T[w],
        tags: [],
        parent: N[w - 1],
        depth: w,
        renderLabel: p,
        ...k && {
          children: [k]
        }
      });
    }), h[g.id] = {
      type: "story",
      tags: [],
      ...g,
      depth: N.length,
      parent: N[N.length - 1],
      renderLabel: p,
      prepared: !!g.parameters
    }, h;
  }, {});
  function y(h, g) {
    return h[g.id] || (h[g.id] = g, (g.type === "root" || g.type === "group" || g.type === "component") && (g.children.forEach((S) => y(h, f[S])),
    g.tags = g.children.reduce((S, E) => {
      let A = h[E];
      return S === null ? A.tags : Po(S, A.tags);
    }, null))), h;
  }
  n(y, "addItem");
  let m = Object.values(f).filter((h) => h.type !== "root" && !h.parent).reduce(y, {});
  return Object.values(f).filter((h) => h.type === "root").reduce(y, m);
}, "transformStoryIndexToStoriesHash"), sr = /* @__PURE__ */ n((e, t) => t ? Object.fromEntries(
  Object.entries(e).map(([r, o]) => {
    let s = t[r];
    return o.type === "story" && s?.type === "story" && s.prepared ? [r, { ...s, ...o, prepared: !0 }] : [r, o];
  })
) : e, "addPreparedStories"), xo = (0, nr.default)(1)((e) => Object.entries(e).reduce((t, r) => {
  let o = r[1];
  return o.type === "component" && t.push([...o.children]), t;
}, [])), To = (0, nr.default)(1)((e) => Object.keys(e).filter((t) => ["story", "docs"].includes(e[t].type)));

// src/manager-api/modules/refs.ts
var { location: xs, fetch: Ro } = ir.global, cr = /* @__PURE__ */ n((e, t) => {
  let { origin: r, pathname: o } = xs, { origin: s, pathname: a } = new URL(e), i = `${r + o}`.replace("/iframe.html", "").replace(/\/$/, ""),
  c = `${s + a}`.replace("/iframe.html", "").replace(/\/$/, "");
  return i === c ? ["local", c] : t || e ? ["external", c] : [null, null];
}, "getSourceType"), No = /* @__PURE__ */ n((e, t) => ({ ...t, kind: t.kind.replace("|", "/") }), "defaultStoryMapper"), wo = /* @__PURE__ */ n(
(e, t) => Object.entries(e).reduce((r, [o, s]) => ({ ...r, [o]: { ...s, refId: t.id } }), {}), "addRefIds");
async function Oo(e) {
  if (!e)
    return {};
  try {
    let t = await e;
    if (t === !1 || t === !0)
      throw new Error("Unexpected boolean response");
    if (!t.ok)
      throw new Error(`Unexpected response not OK: ${t.statusText}`);
    let r = await t.json();
    return r.entries || r.stories ? { storyIndex: r } : r;
  } catch (t) {
    return { indexError: t };
  }
}
n(Oo, "handleRequest");
var Ts = /* @__PURE__ */ n((e) => {
  let t = /https?:\/\/(.+:.+)@/, r = e, o, [, s] = e.match(t) || [];
  return s && (r = e.replace(`${s}@`, ""), o = btoa(`${s}`)), {
    url: r,
    authorization: o
  };
}, "parseUrl"), Rs = /* @__PURE__ */ n((e, t, r) => {
  let { storyMapper: o } = r;
  return o ? Object.entries(e).reduce((s, [a, i]) => ({ ...s, [a]: o(t, i) }), {}) : e;
}, "map"), ws = /* @__PURE__ */ n(({ store: e, provider: t, singleStory: r, docsOptions: o = {} }, { runCheck: s = !0 } = {}) => {
  let a = {
    findRef: /* @__PURE__ */ n((u) => {
      let l = a.getRefs();
      return Object.values(l).find(({ url: p }) => p.match(u));
    }, "findRef"),
    changeRefVersion: /* @__PURE__ */ n(async (u, l) => {
      let { versions: p, title: d } = a.getRefs()[u], f = {
        id: u,
        url: l,
        versions: p,
        title: d,
        index: {},
        filteredIndex: {},
        expanded: !0
      };
      await a.setRef(u, { ...f, type: "unknown" }, !1), await a.checkRef(f);
    }, "changeRefVersion"),
    changeRefState: /* @__PURE__ */ n((u, l) => {
      let { [u]: p, ...d } = a.getRefs();
      d[u] = { ...p, previewInitialized: l }, e.setState({
        refs: d
      });
    }, "changeRefState"),
    checkRef: /* @__PURE__ */ n(async (u) => {
      let { id: l, url: p, version: d, type: f } = u, y = f === "server-checked", m = {}, h = d ? `?version=${d}` : "", g = y ? "omit" : "in\
clude", S = Ts(p), E = {
        Accept: "application/json"
      };
      S.authorization && Object.assign(E, {
        Authorization: `Basic ${S.authorization}`
      });
      let [A, T] = await Promise.all(
        ["index.json", "stories.json"].map(
          async (v) => Oo(
            Ro(`${S.url}/${v}${h}`, {
              headers: E,
              credentials: g
            })
          )
        )
      );
      if (!A.indexError || !T.indexError) {
        let v = await Oo(
          Ro(`${S.url}/metadata.json${h}`, {
            headers: E,
            credentials: g,
            cache: "no-cache"
          }).catch(() => !1)
        );
        Object.assign(m, {
          ...A.indexError ? T : A,
          ...!v.indexError && v
        });
      } else y || (m.indexError = {
        message: Co.dedent`
            Error: Loading of ref failed
              at fetch (lib/api/src/modules/refs.ts)

            URL: ${S.url}

            We weren't able to load the above URL,
            it's possible a CORS error happened.

            Please check your dev-tools network tab.
          `
      });
      let N = u.versions && Object.keys(u.versions).length ? u.versions : m.versions;
      await a.setRef(l, {
        id: l,
        url: S.url,
        ...m,
        ...N ? { versions: N } : {},
        type: m.storyIndex ? "lazy" : "auto-inject"
      });
    }, "checkRef"),
    getRefs: /* @__PURE__ */ n(() => {
      let { refs: u = {} } = e.getState();
      return u;
    }, "getRefs"),
    setRef: /* @__PURE__ */ n(async (u, { storyIndex: l, setStoriesData: p, ...d }, f = !1) => {
      if (r)
        return;
      let y, m, h, { filters: g } = e.getState(), { storyMapper: S = No } = t.getConfig(), E = a.getRefs()[u];
      (l || p) && (y = p ? Io(
        Rs(p, E, { storyMapper: S })
      ) : l, h = ge(l, {
        provider: t,
        docsOptions: o,
        filters: g,
        allStatuses: {}
      }), m = ge(l, {
        provider: t,
        docsOptions: o,
        filters: {},
        allStatuses: {}
      })), m && (m = wo(m, E)), h && (h = wo(h, E)), await a.updateRef(u, { ...E, ...d, index: m, filteredIndex: h, internal_index: y });
    }, "setRef"),
    updateRef: /* @__PURE__ */ n(async (u, l) => {
      let { [u]: p, ...d } = a.getRefs();
      d[u] = { ...p, ...l };
      let f = Object.keys(c).reduce((y, m) => (y[m] = d[m], y), {});
      await e.setState({
        refs: f
      });
    }, "updateRef")
  }, i = !r && ir.global.REFS || {}, c = i;
  return s && new Promise(async (u) => {
    for (let l of Object.values(i))
      await a.checkRef({ ...l, stories: {} });
    u(void 0);
  }), {
    api: a,
    state: {
      refs: c
    }
  };
}, "init");

// src/manager-api/lib/events.ts
var D = /* @__PURE__ */ n((e, t) => {
  let { source: r, refId: o, type: s } = e, [a, i] = cr(r, o), c;
  (o || a === "external") && (c = o && t.getRefs()[o] ? t.getRefs()[o] : t.findRef(i));
  let u = {
    source: r,
    sourceType: a,
    sourceLocation: i,
    refId: o,
    ref: c,
    type: s
  };
  switch (!0) {
    case typeof o == "string":
    case a === "local":
    case a === "external":
      return u;
    // if we couldn't find the source, something risky happened, we ignore the input, and log a warning
    default:
      return ko.logger.warn(`Received a ${s} frame that was not configured as a ref`), null;
  }
}, "getEventMetadata");

// src/manager-api/modules/globals.ts
var Os = /* @__PURE__ */ n(({ store: e, fullAPI: t, provider: r }) => {
  let o = {
    getGlobals() {
      return e.getState().globals;
    },
    getUserGlobals() {
      return e.getState().userGlobals;
    },
    getStoryGlobals() {
      return e.getState().storyGlobals;
    },
    getGlobalTypes() {
      return e.getState().globalTypes;
    },
    updateGlobals(i) {
      r.channel?.emit(Se.UPDATE_GLOBALS, {
        globals: i,
        options: {
          target: "storybook-preview-iframe"
        }
      });
    }
  }, s = {
    globals: {},
    userGlobals: {},
    storyGlobals: {},
    globalTypes: {}
  }, a = /* @__PURE__ */ n(({
    globals: i,
    storyGlobals: c,
    userGlobals: u
  }) => {
    let {
      globals: l,
      userGlobals: p,
      storyGlobals: d
    } = e.getState();
    B(i, l) || e.setState({ globals: i }), B(u, p) || e.setState({ userGlobals: u }), B(c, d) || e.setState({ storyGlobals: c });
  }, "updateGlobals");
  return r.channel?.on(
    Se.GLOBALS_UPDATED,
    /* @__PURE__ */ n(function({ globals: c, storyGlobals: u, userGlobals: l }) {
      let { ref: p } = D(this, t);
      p ? lr.logger.warn(
        "received a GLOBALS_UPDATED from a non-local ref. This is not currently supported."
      ) : a({ globals: c, storyGlobals: u, userGlobals: l });
    }, "handleGlobalsUpdated")
  ), r.channel?.on(
    Se.SET_GLOBALS,
    /* @__PURE__ */ n(function({ globals: c, globalTypes: u }) {
      let { ref: l } = D(this, t), p = e.getState()?.globals;
      l ? Object.keys(c).length > 0 && lr.logger.warn("received globals from a non-local ref. This is not currently supported.") : e.setState(
      { globals: c, userGlobals: c, globalTypes: u }), p && Object.keys(p).length !== 0 && !B(c, p) && o.updateGlobals(p);
    }, "handleSetGlobals")
  ), {
    api: o,
    state: s
  };
}, "init");

// src/manager-api/modules/layout.ts
var xt = {};
U(xt, {
  ActiveTabs: () => Fo,
  defaultLayoutState: () => W,
  focusableUIElements: () => We,
  init: () => Ns
});
var Mo = require("storybook/internal/core-events"), Uo = require("@storybook/global");
var Lo = require("storybook/theming/create");
var { document: Cs } = Uo.global, jo = /* @__PURE__ */ n((e) => typeof e == "function", "isFunction"), Fo = {
  SIDEBAR: "sidebar",
  CANVAS: "canvas",
  ADDONS: "addons"
}, W = {
  ui: {
    enableShortcuts: !0
  },
  layout: {
    initialActive: Fo.CANVAS,
    showToolbar: !0,
    navSize: 300,
    bottomPanelHeight: 300,
    rightPanelWidth: 400,
    recentVisibleSizes: {
      navSize: 300,
      bottomPanelHeight: 300,
      rightPanelWidth: 400
    },
    panelPosition: "bottom",
    showTabs: !0
  },
  layoutCustomisations: {
    showSidebar: void 0,
    showToolbar: void 0
  },
  selectedPanel: void 0,
  theme: (0, Lo.create)()
}, We = {
  storySearchField: "storybook-explorer-searchfield",
  storyListMenu: "storybook-explorer-menu",
  storyPanelRoot: "storybook-panel-root"
}, dr = /* @__PURE__ */ n((e) => e.layout.navSize > 0, "getIsNavShown"), fr = /* @__PURE__ */ n((e) => {
  let { bottomPanelHeight: t, rightPanelWidth: r, panelPosition: o } = e.layout;
  return o === "bottom" && t > 0 || o === "right" && r > 0;
}, "getIsPanelShown"), Do = /* @__PURE__ */ n((e) => !dr(e) && !fr(e), "getIsFullscreen"), It = /* @__PURE__ */ n((e) => ({
  navSize: e.navSize > 0 ? e.navSize : e.recentVisibleSizes.navSize,
  bottomPanelHeight: e.bottomPanelHeight > 0 ? e.bottomPanelHeight : e.recentVisibleSizes.bottomPanelHeight,
  rightPanelWidth: e.rightPanelWidth > 0 ? e.rightPanelWidth : e.recentVisibleSizes.rightPanelWidth
}), "getRecentVisibleSizes"), Ns = /* @__PURE__ */ n(({ store: e, provider: t, singleStory: r }) => {
  let o = {
    toggleFullscreen(a) {
      return e.setState(
        (i) => {
          let c = Do(i), u = typeof a == "boolean" ? a : !c;
          return u === c ? { layout: i.layout } : u ? {
            layout: {
              ...i.layout,
              navSize: 0,
              bottomPanelHeight: 0,
              rightPanelWidth: 0,
              recentVisibleSizes: It(i.layout)
            }
          } : {
            layout: {
              ...i.layout,
              navSize: i.singleStory ? 0 : i.layout.recentVisibleSizes.navSize,
              bottomPanelHeight: i.layout.recentVisibleSizes.bottomPanelHeight,
              rightPanelWidth: i.layout.recentVisibleSizes.rightPanelWidth
            }
          };
        },
        { persistence: "session" }
      );
    },
    togglePanel(a) {
      return e.setState(
        (i) => {
          let c = fr(i), u = typeof a == "boolean" ? a : !c;
          return u === c ? { layout: i.layout } : u ? {
            layout: {
              ...i.layout,
              bottomPanelHeight: i.layout.recentVisibleSizes.bottomPanelHeight,
              rightPanelWidth: i.layout.recentVisibleSizes.rightPanelWidth
            }
          } : {
            layout: {
              ...i.layout,
              bottomPanelHeight: 0,
              rightPanelWidth: 0,
              recentVisibleSizes: It(i.layout)
            }
          };
        },
        { persistence: "session" }
      );
    },
    togglePanelPosition(a) {
      return e.setState(
        (i) => {
          let c = a || (i.layout.panelPosition === "right" ? "bottom" : "right");
          return {
            layout: {
              ...i.layout,
              panelPosition: c,
              bottomPanelHeight: i.layout.recentVisibleSizes.bottomPanelHeight,
              rightPanelWidth: i.layout.recentVisibleSizes.rightPanelWidth
            }
          };
        },
        { persistence: "permanent" }
      );
    },
    toggleNav(a) {
      return e.setState(
        (i) => {
          if (i.singleStory)
            return { layout: i.layout };
          let c = dr(i), u = typeof a == "boolean" ? a : !c;
          return u === c ? { layout: i.layout } : u ? {
            layout: {
              ...i.layout,
              navSize: i.layout.recentVisibleSizes.navSize
            }
          } : {
            layout: {
              ...i.layout,
              navSize: 0,
              recentVisibleSizes: It(i.layout)
            }
          };
        },
        { persistence: "session" }
      );
    },
    toggleToolbar(a) {
      return e.setState(
        (i) => {
          let c = typeof a < "u" ? a : !i.layout.showToolbar;
          return {
            layout: {
              ...i.layout,
              showToolbar: c
            }
          };
        },
        { persistence: "session" }
      );
    },
    setSizes({
      navSize: a,
      bottomPanelHeight: i,
      rightPanelWidth: c
    }) {
      return e.setState(
        (u) => {
          let l = {
            ...u.layout,
            navSize: a ?? u.layout.navSize,
            bottomPanelHeight: i ?? u.layout.bottomPanelHeight,
            rightPanelWidth: c ?? u.layout.rightPanelWidth
          };
          return {
            layout: {
              ...l,
              recentVisibleSizes: It(l)
            }
          };
        },
        { persistence: "session" }
      );
    },
    focusOnUIElement(a, i) {
      if (!a)
        return;
      let c = Cs.getElementById(a);
      c && (c.focus(), i && c.select());
    },
    getInitialOptions() {
      let { theme: a, selectedPanel: i, layoutCustomisations: c, ...u } = t.getConfig();
      return {
        ...W,
        layout: {
          ...Me(
            W.layout,
            ae(u, Object.keys(W.layout))
          ),
          ...r && { navSize: 0 }
        },
        layoutCustomisations: {
          ...W.layoutCustomisations,
          ...c ?? {}
        },
        ui: Me(W.ui, ae(u, Object.keys(W.ui))),
        selectedPanel: i || W.selectedPanel,
        theme: a || W.theme
      };
    },
    getIsFullscreen() {
      return Do(e.getState());
    },
    getIsPanelShown() {
      return fr(e.getState());
    },
    getIsNavShown() {
      return dr(e.getState());
    },
    getShowToolbarWithCustomisations(a) {
      let i = e.getState();
      return jo(i.layoutCustomisations.showToolbar) ? i.layoutCustomisations.showToolbar(i, a) ?? a : a;
    },
    getNavSizeWithCustomisations(a) {
      let i = e.getState();
      if (jo(i.layoutCustomisations.showSidebar)) {
        let c = i.layoutCustomisations.showSidebar(i, a !== 0);
        if (a === 0 && c === !0)
          return i.layout.recentVisibleSizes.navSize;
        if (a !== 0 && c === !1)
          return 0;
      }
      return a;
    },
    setOptions: /* @__PURE__ */ n((a) => {
      let { layout: i, ui: c, selectedPanel: u, theme: l } = e.getState();
      if (!a)
        return;
      let p = {
        ...i,
        ...a.layout || {},
        ...ae(a, Object.keys(i)),
        ...r && { navSize: 0 }
      }, d = {
        ...c,
        ...a.ui,
        ...Me(a.ui || {}, ae(a, Object.keys(c)))
      }, f = {
        ...l,
        ...a.theme
      }, y = {};
      F(c, d) || (y.ui = d), F(i, p) || (y.layout = p), a.selectedPanel && !F(u, a.selectedPanel) && (y.selectedPanel = a.selectedPanel), Object.
      keys(y).length && e.setState(y, { persistence: "permanent" }), F(l, f) || e.setState({ theme: f });
    }, "setOptions")
  }, s = ae(e.getState(), ["layout", "selectedPanel"]);
  return t.channel?.on(Mo.SET_CONFIG, () => {
    o.setOptions(K(o.getInitialOptions(), s));
  }), {
    api: o,
    state: K(o.getInitialOptions(), s)
  };
}, "init");

// src/manager-api/modules/notifications.ts
var yr = {};
U(yr, {
  init: () => ks
});
var ks = /* @__PURE__ */ n(({ store: e }) => ({ api: {
  addNotification: /* @__PURE__ */ n((o) => {
    e.setState(({ notifications: s }) => {
      let [a, i] = tt(s, (c) => c.id === o.id);
      return a.forEach((c) => {
        c.onClear && c.onClear({ dismissed: !1, timeout: !1 });
      }), { notifications: [...i, o] };
    });
  }, "addNotification"),
  clearNotification: /* @__PURE__ */ n((o) => {
    e.setState(({ notifications: s }) => {
      let [a, i] = tt(s, (c) => c.id === o);
      return a.forEach((c) => {
        c.onClear && c.onClear({ dismissed: !1, timeout: !1 });
      }), { notifications: i };
    });
  }, "clearNotification")
}, state: { notifications: [] } }), "init");

// src/manager-api/modules/provider.ts
var mr = {};
U(mr, {
  init: () => js
});
var js = /* @__PURE__ */ n(({ provider: e, fullAPI: t }) => ({
  api: e.renderPreview ? { renderPreview: e.renderPreview } : {},
  state: {},
  init: /* @__PURE__ */ n(() => {
    e.handleAPI(t);
  }, "init")
}), "init");

// src/manager-api/modules/settings.ts
var hr = {};
U(hr, {
  init: () => Ds
});
var Ds = /* @__PURE__ */ n(({ store: e, navigate: t, fullAPI: r }) => ({
  state: { settings: { lastTrackedStoryId: null } },
  api: {
    closeSettings: /* @__PURE__ */ n(() => {
      let {
        settings: { lastTrackedStoryId: a }
      } = e.getState();
      a ? r.selectStory(a) : r.selectFirstStory();
    }, "closeSettings"),
    changeSettingsTab: /* @__PURE__ */ n((a) => {
      t(`/settings/${a}`);
    }, "changeSettingsTab"),
    isSettingsScreenActive: /* @__PURE__ */ n(() => {
      let { path: a } = r.getUrlState();
      return !!(a || "").match(/^\/settings/);
    }, "isSettingsScreenActive"),
    retrieveSelection() {
      let { settings: a } = e.getState();
      return a.lastTrackedStoryId;
    },
    storeSelection: /* @__PURE__ */ n(async () => {
      let { storyId: a, settings: i } = e.getState();
      await e.setState({
        settings: { ...i, lastTrackedStoryId: a }
      });
    }, "storeSelection")
  }
}), "init");

// src/manager-api/modules/shortcuts.ts
var _r = {};
U(_r, {
  controlOrMetaKey: () => be,
  defaultShortcuts: () => Ee,
  init: () => $s,
  isMacLike: () => Ko,
  keys: () => Er
});
var ee = require("storybook/internal/core-events"), Vo = require("@storybook/global");

// src/manager-api/lib/shortcut.ts
var Wo = require("@storybook/global");
var { navigator: gr } = Wo.global, Tt = /* @__PURE__ */ n(() => gr && gr.platform ? !!gr.platform.match(/(Mac|iPhone|iPod|iPad)/i) : !1, "is\
MacLike"), Ms = /* @__PURE__ */ n(() => Tt() ? "\u2318" : "ctrl", "controlOrMetaSymbol"), Us = /* @__PURE__ */ n(() => Tt() ? "meta" : "cont\
rol", "controlOrMetaKey"), Go = /* @__PURE__ */ n(() => Tt() ? "\u2325" : "alt", "optionOrAltSymbol"), Ls = /* @__PURE__ */ n((e, t) => JSON.
stringify(e) === JSON.stringify(t), "isShortcutTaken"), Rt = /* @__PURE__ */ n((e) => {
  if (["Meta", "Alt", "Control", "Shift"].includes(e.key))
    return null;
  let t = [];
  if (e.altKey && t.push("alt"), e.ctrlKey && t.push("control"), e.metaKey && t.push("meta"), e.shiftKey && t.push("shift"), e.key && e.key.
  length === 1 && e.key !== " ") {
    let r = e.key.toUpperCase(), o = e.code?.toUpperCase().replace("KEY", "").replace("DIGIT", "");
    o && o.length === 1 && o !== r ? t.push([r, o]) : t.push(r);
  }
  return e.key === " " && t.push("space"), e.key === "Escape" && t.push("escape"), e.key === "ArrowRight" && t.push("ArrowRight"), e.key ===
  "ArrowDown" && t.push("ArrowDown"), e.key === "ArrowUp" && t.push("ArrowUp"), e.key === "ArrowLeft" && t.push("ArrowLeft"), t.length > 0 ?
  t : null;
}, "eventToShortcut"), wt = /* @__PURE__ */ n((e, t) => !e || !t || (e.join("").startsWith("shift/") && e.shift(), e.length !== t.length) ? !1 :
!e.find(
  (r, o) => Array.isArray(r) ? !r.includes(t[o]) : r !== t[o]
), "shortcutMatchesShortcut"), Fs = /* @__PURE__ */ n((e, t) => wt(Rt(e), t), "eventMatchesShortcut"), $o = /* @__PURE__ */ n((e) => e === "\
alt" ? Go() : e === "control" ? "\u2303" : e === "meta" ? "\u2318" : e === "shift" ? "\u21E7\u200B" : e === "Enter" || e === "Backspace" || e ===
"Esc" || e === "escape" ? "" : e === " " ? "SPACE" : e === "ArrowUp" ? "\u2191" : e === "ArrowDown" ? "\u2193" : e === "ArrowLeft" ? "\u2190" :
e === "ArrowRight" ? "\u2192" : e.toUpperCase(), "keyToSymbol"), Ws = /* @__PURE__ */ n((e) => e.map($o).join(" "), "shortcutToHumanString");

// src/manager-api/modules/shortcuts.ts
var { navigator: Sr, document: Bo } = Vo.global, Ko = /* @__PURE__ */ n(() => Sr && Sr.platform ? !!Sr.platform.match(/(Mac|iPhone|iPod|iPad)/i) :
!1, "isMacLike"), be = /* @__PURE__ */ n(() => Ko() ? "meta" : "control", "controlOrMetaKey");
function Er(e) {
  return Object.keys(e);
}
n(Er, "keys");
var Ee = Object.freeze({
  fullScreen: ["alt", "F"],
  togglePanel: ["alt", "A"],
  panelPosition: ["alt", "D"],
  toggleNav: ["alt", "S"],
  toolbar: ["alt", "T"],
  search: [be(), "K"],
  focusNav: ["1"],
  focusIframe: ["2"],
  focusPanel: ["3"],
  prevComponent: ["alt", "ArrowUp"],
  nextComponent: ["alt", "ArrowDown"],
  prevStory: ["alt", "ArrowLeft"],
  nextStory: ["alt", "ArrowRight"],
  shortcutsPage: [be(), "shift", ","],
  aboutPage: [be(), ","],
  escape: ["escape"],
  // This one is not customizable
  collapseAll: [be(), "shift", "ArrowUp"],
  expandAll: [be(), "shift", "ArrowDown"],
  remount: ["alt", "R"]
}), br = {};
function Gs(e) {
  let t = e.target;
  return !!(/input|textarea/i.test(t.tagName) || t.getAttribute("contenteditable") !== null || t.closest("dialog[open]"));
}
n(Gs, "shouldSkipShortcut");
var $s = /* @__PURE__ */ n(({ store: e, fullAPI: t, provider: r }) => {
  let o = {
    // Getting and setting shortcuts
    getShortcutKeys() {
      return e.getState().shortcuts;
    },
    getDefaultShortcuts() {
      return {
        ...Ee,
        ...o.getAddonsShortcutDefaults()
      };
    },
    getAddonsShortcuts() {
      return br;
    },
    getAddonsShortcutLabels() {
      let c = {};
      return Object.entries(o.getAddonsShortcuts()).forEach(([u, { label: l }]) => {
        c[u] = l;
      }), c;
    },
    getAddonsShortcutDefaults() {
      let c = {};
      return Object.entries(o.getAddonsShortcuts()).forEach(([u, { defaultShortcut: l }]) => {
        c[u] = l;
      }), c;
    },
    async setShortcuts(c) {
      return await e.setState({ shortcuts: c }, { persistence: "permanent" }), c;
    },
    async restoreAllDefaultShortcuts() {
      return o.setShortcuts(o.getDefaultShortcuts());
    },
    async setShortcut(c, u) {
      let l = o.getShortcutKeys();
      return await o.setShortcuts({ ...l, [c]: u }), u;
    },
    async setAddonShortcut(c, u) {
      let l = o.getShortcutKeys();
      return await o.setShortcuts({
        ...l,
        [`${c}-${u.actionName}`]: u.defaultShortcut
      }), br[`${c}-${u.actionName}`] = u, u;
    },
    async restoreDefaultShortcut(c) {
      let u = o.getDefaultShortcuts()[c];
      return o.setShortcut(c, u);
    },
    // Listening to shortcut events
    handleKeydownEvent(c) {
      let u = Rt(c), l = o.getShortcutKeys(), d = Er(l).find(
        (f) => wt(u, l[f])
      );
      d && o.handleShortcutFeature(d, c);
    },
    // warning: event might not have a full prototype chain because it may originate from the channel
    handleShortcutFeature(c, u) {
      let {
        ui: { enableShortcuts: l },
        storyId: p
      } = e.getState();
      if (l)
        switch (u?.preventDefault && u.preventDefault(), c) {
          case "escape": {
            t.getIsFullscreen() ? t.toggleFullscreen(!1) : t.getIsNavShown() && t.toggleNav(!0);
            break;
          }
          case "focusNav": {
            t.getIsFullscreen() && t.toggleFullscreen(!1), t.getIsNavShown() || t.toggleNav(!0), t.focusOnUIElement(We.storyListMenu);
            break;
          }
          case "search": {
            t.getIsFullscreen() && t.toggleFullscreen(!1), t.getIsNavShown() || t.toggleNav(!0), setTimeout(() => {
              t.focusOnUIElement(We.storySearchField, !0);
            }, 0);
            break;
          }
          case "focusIframe": {
            let d = Bo.getElementById("storybook-preview-iframe");
            if (d)
              try {
                d.contentWindow.focus();
              } catch {
              }
            break;
          }
          case "focusPanel": {
            t.getIsFullscreen() && t.toggleFullscreen(!1), t.getIsPanelShown() || t.togglePanel(!0), t.focusOnUIElement(We.storyPanelRoot);
            break;
          }
          case "nextStory": {
            t.jumpToStory(1);
            break;
          }
          case "prevStory": {
            t.jumpToStory(-1);
            break;
          }
          case "nextComponent": {
            t.jumpToComponent(1);
            break;
          }
          case "prevComponent": {
            t.jumpToComponent(-1);
            break;
          }
          case "fullScreen": {
            t.toggleFullscreen();
            break;
          }
          case "togglePanel": {
            t.togglePanel();
            break;
          }
          case "toggleNav": {
            t.toggleNav();
            break;
          }
          case "toolbar": {
            t.toggleToolbar();
            break;
          }
          case "panelPosition": {
            t.getIsFullscreen() && t.toggleFullscreen(!1), t.getIsPanelShown() || t.togglePanel(!0), t.togglePanelPosition();
            break;
          }
          case "aboutPage": {
            t.navigate("/settings/about");
            break;
          }
          case "shortcutsPage": {
            t.navigate("/settings/shortcuts");
            break;
          }
          case "collapseAll": {
            t.emit(ee.STORIES_COLLAPSE_ALL);
            break;
          }
          case "expandAll": {
            t.emit(ee.STORIES_EXPAND_ALL);
            break;
          }
          case "remount": {
            t.emit(ee.FORCE_REMOUNT, { storyId: p });
            break;
          }
          default:
            br[c].action();
            break;
        }
    }
  }, { shortcuts: s = Ee } = e.getState(), a = {
    // Any saved shortcuts that are still in our set of defaults
    shortcuts: Er(Ee).reduce(
      (c, u) => ({ ...c, [u]: s[u] || Ee[u] }),
      Ee
    )
  };
  return { api: o, state: a, init: /* @__PURE__ */ n(() => {
    Bo.addEventListener("keydown", (c) => {
      Gs(c) || o.handleKeydownEvent(c);
    }), r.channel?.on(ee.PREVIEW_KEYDOWN, (c) => {
      o.handleKeydownEvent(c.event);
    });
  }, "initModule") };
}, "init");

// src/manager-api/modules/stories.ts
var Ir = {};
U(Ir, {
  init: () => Js
});
var Zo = require("storybook/internal/client-logger"), _ = require("storybook/internal/core-events"), re = require("storybook/internal/csf"),
en = require("@storybook/global");

// src/storybook-error.ts
function zo({
  code: e,
  category: t
}) {
  let r = String(e).padStart(4, "0");
  return `SB_${t}_${r}`;
}
n(zo, "parseErrorCode");
function Ho(e) {
  if (/^(?!.*storybook\.js\.org)|[?&]ref=error\b/.test(e))
    return e;
  try {
    let t = new URL(e);
    return t.searchParams.set("ref", "error"), t.toString();
  } catch {
    return e;
  }
}
n(Ho, "appendErrorRef");
var te = class e extends Error {
  constructor(r) {
    super(e.getFullMessage(r));
    /**
     * Data associated with the error. Used to provide additional information in the error message or
     * to be passed to telemetry.
     */
    this.data = {};
    /** Flag used to easily determine if the error originates from Storybook. */
    this.fromStorybook = !0;
    this.category = r.category, this.documentation = r.documentation ?? !1, this.code = r.code;
  }
  static {
    n(this, "StorybookError");
  }
  get fullErrorCode() {
    return zo({ code: this.code, category: this.category });
  }
  /** Overrides the default `Error.name` property in the format: SB_<CATEGORY>_<CODE>. */
  get name() {
    let r = this.constructor.name;
    return `${this.fullErrorCode} (${r})`;
  }
  /** Generates the error message along with additional documentation link (if applicable). */
  static getFullMessage({
    documentation: r,
    code: o,
    category: s,
    message: a
  }) {
    let i;
    return r === !0 ? i = `https://storybook.js.org/error/${zo({ code: o, category: s })}?ref=error` : typeof r == "string" ? i = Ho(r) : Array.
    isArray(r) && (i = `
${r.map((c) => `	- ${Ho(c)}`).join(`
`)}`), `${a}${i != null ? `

More info: ${i}
` : ""}`;
  }
};

// src/manager-errors.ts
var Ot = class extends te {
  constructor(r) {
    super({
      category: "MANAGER_API",
      code: 1,
      message: `Status has typeId "${r.status.typeId}" but was added to store with typeId "${r.typeId}". Full status: ${JSON.stringify(
        r.status,
        null,
        2
      )}`
    });
    this.data = r;
  }
  static {
    n(this, "StatusTypeIdMismatchError");
  }
};

// src/preview-errors.ts
var Bs = L(ie(), 1);
var Ct = class extends te {
  constructor(r) {
    super({
      category: "PREVIEW_API",
      code: 16,
      message: `Status has typeId "${r.status.typeId}" but was added to store with typeId "${r.typeId}". Full status: ${JSON.stringify(
        r.status,
        null,
        2
      )}`
    });
    this.data = r;
  }
  static {
    n(this, "StatusTypeIdMismatchError");
  }
};

// src/server-errors.ts
var Vs = L(ie(), 1);
var Nt = class extends te {
  constructor(r) {
    super({
      category: "CORE-SERVER",
      code: 16,
      message: `Status has typeId "${r.status.typeId}" but was added to store with typeId "${r.typeId}". Full status: ${JSON.stringify(
        r.status,
        null,
        2
      )}`
    });
    this.data = r;
  }
  static {
    n(this, "StatusTypeIdMismatchError");
  }
};

// src/shared/status-store/index.ts
var qo = {
  id: "storybook/status",
  leader: !0,
  initialState: {}
}, Pr = {
  SELECT: "select"
};
function Yo({
  universalStatusStore: e,
  useUniversalStore: t,
  environment: r
}) {
  let o = {
    getAll() {
      return e.getState();
    },
    set(a) {
      e.setState((i) => {
        let c = { ...i };
        for (let u of a) {
          let { storyId: l, typeId: p } = u;
          c[l] = { ...c[l] ?? {}, [p]: u };
        }
        return c;
      });
    },
    onAllStatusChange(a) {
      return e.onStateChange((i, c) => {
        a(i, c);
      });
    },
    onSelect(a) {
      return e.subscribe(Pr.SELECT, (i) => {
        a(i.payload);
      });
    },
    selectStatuses: /* @__PURE__ */ n((a) => {
      e.send({ type: Pr.SELECT, payload: a });
    }, "selectStatuses"),
    unset(a) {
      if (!a) {
        e.setState({});
        return;
      }
      e.setState((i) => {
        let c = { ...i };
        for (let u of a)
          delete c[u];
        return c;
      });
    },
    typeId: void 0
  }, s = /* @__PURE__ */ n((a) => ({
    getAll: o.getAll,
    set(i) {
      e.setState((c) => {
        let u = { ...c };
        for (let l of i) {
          let { storyId: p } = l;
          if (l.typeId !== a)
            switch (r) {
              case "server":
                throw new Nt({
                  status: l,
                  typeId: a
                });
              case "manager":
                throw new Ot({
                  status: l,
                  typeId: a
                });
              case "preview":
              default:
                throw new Ct({
                  status: l,
                  typeId: a
                });
            }
          u[p] = { ...u[p] ?? {}, [a]: l };
        }
        return u;
      });
    },
    onAllStatusChange: o.onAllStatusChange,
    onSelect(i) {
      return e.subscribe(Pr.SELECT, (c) => {
        c.payload.some((u) => u.typeId === a) && i(c.payload);
      });
    },
    unset(i) {
      e.setState((c) => {
        let u = { ...c };
        for (let l in u)
          if (u[l]?.[a] && (!i || i?.includes(l))) {
            let { [a]: p, ...d } = u[l];
            u[l] = d;
          }
        return u;
      });
    },
    typeId: a
  }), "getStatusStoreByTypeId");
  return t ? {
    getStatusStoreByTypeId: s,
    fullStatusStore: o,
    universalStatusStore: e,
    useStatusStore: /* @__PURE__ */ n((a) => t(e, a)[0], "useStatusStore")
  } : { getStatusStoreByTypeId: s, fullStatusStore: o, universalStatusStore: e };
}
n(Yo, "createStatusStore");

// src/shared/universal-store/index.ts
var ce = L(ie(), 1);

// src/shared/universal-store/instances.ts
var Ar = /* @__PURE__ */ new Map();

// src/shared/universal-store/index.ts
var Ks = "UNIVERSAL_STORE:", V = {
  PENDING: "PENDING",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED"
}, G = class e {
  constructor(t, r) {
    /** Enable debug logs for this store */
    this.debugging = !1;
    // TODO: narrow type of listeners based on event type
    this.listeners = /* @__PURE__ */ new Map([["*", /* @__PURE__ */ new Set()]]);
    /** Gets the current state */
    this.getState = /* @__PURE__ */ n(() => (this.debug("getState", { state: this.state }), this.state), "getState");
    /**
     * Subscribes to store events
     *
     * @returns A function to unsubscribe
     */
    this.subscribe = /* @__PURE__ */ n((t, r) => {
      let o = typeof t == "function", s = o ? "*" : t, a = o ? t : r;
      if (this.debug("subscribe", { eventType: s, listener: a }), !a)
        throw new TypeError(
          `Missing first subscribe argument, or second if first is the event type, when subscribing to a UniversalStore with id '${this.id}'`
        );
      return this.listeners.has(s) || this.listeners.set(s, /* @__PURE__ */ new Set()), this.listeners.get(s).add(a), () => {
        this.debug("unsubscribe", { eventType: s, listener: a }), this.listeners.has(s) && (this.listeners.get(s).delete(a), this.listeners.
        get(s)?.size === 0 && this.listeners.delete(s));
      };
    }, "subscribe");
    /** Sends a custom event to the other stores */
    this.send = /* @__PURE__ */ n((t) => {
      if (this.debug("send", { event: t }), this.status !== e.Status.READY)
        throw new TypeError(
          ce.dedent`Cannot send event before store is ready. You can get the current status with store.status,
        or await store.readyPromise to wait for the store to be ready before sending events.
        ${JSON.stringify(
            {
              event: t,
              id: this.id,
              actor: this.actor,
              environment: this.environment
            },
            null,
            2
          )}`
        );
      this.emitToListeners(t, { actor: this.actor }), this.emitToChannel(t, { actor: this.actor });
    }, "send");
    if (this.debugging = t.debug ?? !1, !e.isInternalConstructing)
      throw new TypeError(
        "UniversalStore is not constructable - use UniversalStore.create() instead"
      );
    if (e.isInternalConstructing = !1, this.id = t.id, this.actorId = Date.now().toString(36) + Math.random().toString(36).substring(2), this.
    actorType = t.leader ? e.ActorType.LEADER : e.ActorType.FOLLOWER, this.state = t.initialState, this.channelEventName = `${Ks}${this.id}`,
    this.debug("constructor", {
      options: t,
      environmentOverrides: r,
      channelEventName: this.channelEventName
    }), this.actor.type === e.ActorType.LEADER)
      this.syncing = {
        state: V.RESOLVED,
        promise: Promise.resolve()
      };
    else {
      let o, s, a = new Promise((i, c) => {
        o = /* @__PURE__ */ n(() => {
          this.syncing.state === V.PENDING && (this.syncing.state = V.RESOLVED, i());
        }, "syncingResolve"), s = /* @__PURE__ */ n((u) => {
          this.syncing.state === V.PENDING && (this.syncing.state = V.REJECTED, c(u));
        }, "syncingReject");
      });
      this.syncing = {
        state: V.PENDING,
        promise: a,
        resolve: o,
        reject: s
      };
    }
    this.getState = this.getState.bind(this), this.setState = this.setState.bind(this), this.subscribe = this.subscribe.bind(this), this.onStateChange =
    this.onStateChange.bind(this), this.send = this.send.bind(this), this.emitToChannel = this.emitToChannel.bind(this), this.prepareThis = this.
    prepareThis.bind(this), this.emitToListeners = this.emitToListeners.bind(this), this.handleChannelEvents = this.handleChannelEvents.bind(
    this), this.debug = this.debug.bind(this), this.channel = r?.channel ?? e.preparation.channel, this.environment = r?.environment ?? e.preparation.
    environment, this.channel && this.environment ? (e.preparation.resolve({ channel: this.channel, environment: this.environment }), this.prepareThis(
    { channel: this.channel, environment: this.environment })) : e.preparation.promise.then(this.prepareThis);
  }
  static {
    n(this, "UniversalStore");
  }
  static {
    /**
     * Defines the possible actor types in the store system
     *
     * @readonly
     */
    this.ActorType = {
      LEADER: "LEADER",
      FOLLOWER: "FOLLOWER"
    };
  }
  static {
    /**
     * Defines the possible environments the store can run in
     *
     * @readonly
     */
    this.Environment = {
      SERVER: "SERVER",
      MANAGER: "MANAGER",
      PREVIEW: "PREVIEW",
      UNKNOWN: "UNKNOWN",
      MOCK: "MOCK"
    };
  }
  static {
    /**
     * Internal event types used for store synchronization
     *
     * @readonly
     */
    this.InternalEventType = {
      EXISTING_STATE_REQUEST: "__EXISTING_STATE_REQUEST",
      EXISTING_STATE_RESPONSE: "__EXISTING_STATE_RESPONSE",
      SET_STATE: "__SET_STATE",
      LEADER_CREATED: "__LEADER_CREATED",
      FOLLOWER_CREATED: "__FOLLOWER_CREATED"
    };
  }
  static {
    this.Status = {
      UNPREPARED: "UNPREPARED",
      SYNCING: "SYNCING",
      READY: "READY",
      ERROR: "ERROR"
    };
  }
  static {
    // This is used to check if constructor was called from the static factory create()
    this.isInternalConstructing = !1;
  }
  static {
    e.setupPreparationPromise();
  }
  static setupPreparationPromise() {
    let t, r, o = new Promise(
      (s, a) => {
        t = /* @__PURE__ */ n((i) => {
          s(i);
        }, "resolveRef"), r = /* @__PURE__ */ n((...i) => {
          a(i);
        }, "rejectRef");
      }
    );
    e.preparation = {
      resolve: t,
      reject: r,
      promise: o
    };
  }
  /** The actor object representing the store instance with a unique ID and a type */
  get actor() {
    return Object.freeze({
      id: this.actorId,
      type: this.actorType,
      environment: this.environment ?? e.Environment.UNKNOWN
    });
  }
  /**
   * The current state of the store, that signals both if the store is prepared by Storybook and
   * also - in the case of a follower - if the state has been synced with the leader's state.
   */
  get status() {
    if (!this.channel || !this.environment)
      return e.Status.UNPREPARED;
    switch (this.syncing?.state) {
      case V.PENDING:
      case void 0:
        return e.Status.SYNCING;
      case V.REJECTED:
        return e.Status.ERROR;
      case V.RESOLVED:
      default:
        return e.Status.READY;
    }
  }
  /**
   * A promise that resolves when the store is fully ready. A leader will be ready when the store
   * has been prepared by Storybook, which is almost instantly.
   *
   * A follower will be ready when the state has been synced with the leader's state, within a few
   * hundred milliseconds.
   */
  untilReady() {
    return Promise.all([e.preparation.promise, this.syncing?.promise]);
  }
  /** Creates a new instance of UniversalStore */
  static create(t) {
    if (!t || typeof t?.id != "string")
      throw new TypeError("id is required and must be a string, when creating a UniversalStore");
    t.debug && console.debug(
      ce.dedent`[UniversalStore]
        create`,
      { options: t }
    );
    let r = Ar.get(t.id);
    if (r)
      return console.warn(ce.dedent`UniversalStore with id "${t.id}" already exists in this environment, re-using existing.
        You should reuse the existing instance instead of trying to create a new one.`), r;
    e.isInternalConstructing = !0;
    let o = new e(t);
    return Ar.set(t.id, o), o;
  }
  /**
   * Used by Storybook to set the channel for all instances of UniversalStore in the given
   * environment.
   *
   * @internal
   */
  static __prepare(t, r) {
    e.preparation.channel = t, e.preparation.environment = r, e.preparation.resolve({ channel: t, environment: r });
  }
  /**
   * Updates the store's state
   *
   * Either a new state or a state updater function can be passed to the method.
   */
  setState(t) {
    let r = this.state, o = typeof t == "function" ? t(r) : t;
    if (this.debug("setState", { newState: o, previousState: r, updater: t }), this.status !== e.Status.READY)
      throw new TypeError(
        ce.dedent`Cannot set state before store is ready. You can get the current status with store.status,
        or await store.readyPromise to wait for the store to be ready before sending events.
        ${JSON.stringify(
          {
            newState: o,
            id: this.id,
            actor: this.actor,
            environment: this.environment
          },
          null,
          2
        )}`
      );
    this.state = o;
    let s = {
      type: e.InternalEventType.SET_STATE,
      payload: {
        state: o,
        previousState: r
      }
    };
    this.emitToChannel(s, { actor: this.actor }), this.emitToListeners(s, { actor: this.actor });
  }
  /**
   * Subscribes to state changes
   *
   * @returns Unsubscribe function
   */
  onStateChange(t) {
    return this.debug("onStateChange", { listener: t }), this.subscribe(
      e.InternalEventType.SET_STATE,
      ({ payload: r }, o) => {
        t(r.state, r.previousState, o);
      }
    );
  }
  emitToChannel(t, r) {
    this.debug("emitToChannel", { event: t, eventInfo: r, channel: !!this.channel }), this.channel?.emit(this.channelEventName, {
      event: t,
      eventInfo: r
    });
  }
  prepareThis({
    channel: t,
    environment: r
  }) {
    this.channel = t, this.environment = r, this.debug("prepared", { channel: !!t, environment: r }), this.channel.on(this.channelEventName,
    this.handleChannelEvents), this.actor.type === e.ActorType.LEADER ? this.emitToChannel(
      { type: e.InternalEventType.LEADER_CREATED },
      { actor: this.actor }
    ) : (this.emitToChannel(
      { type: e.InternalEventType.FOLLOWER_CREATED },
      { actor: this.actor }
    ), this.emitToChannel(
      { type: e.InternalEventType.EXISTING_STATE_REQUEST },
      { actor: this.actor }
    ), setTimeout(() => {
      this.syncing.reject(
        new TypeError(
          `No existing state found for follower with id: '${this.id}'. Make sure a leader with the same id exists before creating a follower\
.`
        )
      );
    }, 1e3));
  }
  emitToListeners(t, r) {
    let o = this.listeners.get(t.type), s = this.listeners.get("*");
    this.debug("emitToListeners", {
      event: t,
      eventInfo: r,
      eventTypeListeners: o,
      everythingListeners: s
    }), [...o ?? [], ...s ?? []].forEach(
      (a) => a(t, r)
    );
  }
  handleChannelEvents(t) {
    let { event: r, eventInfo: o } = t;
    if ([o.actor.id, o.forwardingActor?.id].includes(this.actor.id)) {
      this.debug("handleChannelEvents: Ignoring event from self", { channelEvent: t });
      return;
    } else if (this.syncing?.state === V.PENDING && r.type !== e.InternalEventType.EXISTING_STATE_RESPONSE) {
      this.debug("handleChannelEvents: Ignoring event while syncing", { channelEvent: t });
      return;
    }
    if (this.debug("handleChannelEvents", { channelEvent: t }), this.actor.type === e.ActorType.LEADER) {
      let s = !0;
      switch (r.type) {
        case e.InternalEventType.EXISTING_STATE_REQUEST:
          s = !1;
          let a = {
            type: e.InternalEventType.EXISTING_STATE_RESPONSE,
            payload: this.state
          };
          this.debug("handleChannelEvents: responding to existing state request", {
            responseEvent: a
          }), this.emitToChannel(a, { actor: this.actor }), this.emitToListeners(a, { actor: this.actor });
          break;
        case e.InternalEventType.LEADER_CREATED:
          s = !1, this.syncing.state = V.REJECTED, this.debug("handleChannelEvents: erroring due to second leader being created", {
            event: r
          }), console.error(
            ce.dedent`Detected multiple UniversalStore leaders created with the same id "${this.id}".
            Only one leader can exists at a time, your stores are now in an invalid state.
            Leaders detected:
            this: ${JSON.stringify(this.actor, null, 2)}
            other: ${JSON.stringify(o.actor, null, 2)}`
          );
          break;
      }
      s && (this.debug("handleChannelEvents: forwarding event", { channelEvent: t }), this.emitToChannel(r, { actor: o.actor, forwardingActor: this.
      actor }));
    }
    if (this.actor.type === e.ActorType.FOLLOWER)
      switch (r.type) {
        case e.InternalEventType.EXISTING_STATE_RESPONSE:
          if (this.debug("handleChannelEvents: Setting state from leader's existing state response", {
            event: r
          }), this.syncing?.state !== V.PENDING)
            break;
          this.syncing.resolve?.();
          let s = {
            type: e.InternalEventType.SET_STATE,
            payload: {
              state: r.payload,
              previousState: this.state
            }
          };
          this.state = r.payload, this.emitToListeners(s, o);
          break;
      }
    switch (r.type) {
      case e.InternalEventType.SET_STATE:
        this.debug("handleChannelEvents: Setting state", { event: r }), this.state = r.payload.state;
        break;
    }
    this.emitToListeners(r, { actor: o.actor });
  }
  debug(t, r) {
    this.debugging && console.debug(
      ce.dedent`[UniversalStore::${this.id}::${this.environment ?? e.Environment.UNKNOWN}]
        ${t}`,
      JSON.stringify(
        {
          data: r,
          actor: this.actor,
          state: this.state,
          status: this.status
        },
        null,
        2
      )
    );
  }
  /**
   * Used to reset the static fields of the UniversalStore class when cleaning up tests
   *
   * @internal
   */
  static __reset() {
    e.preparation.reject(new Error("reset")), e.setupPreparationPromise(), e.isInternalConstructing = !1;
  }
};

// src/shared/universal-store/use-universal-store-manager.ts
var ue = L(require("react"), 1);
var _e = /* @__PURE__ */ n((e, t) => {
  let r = ue.useRef(
    t ? t(e.getState()) : e.getState()
  ), o = ue.useCallback(
    (i) => e.onStateChange((c, u) => {
      if (!t) {
        r.current = c, i();
        return;
      }
      let l = t(c), p = t(u);
      !F(l, p) && (r.current = l, i());
    }),
    [e, t]
  ), s = ue.useCallback(() => {
    let i = e.getState(), c = t ? t(i) : i;
    return F(c, r.current) || (r.current = c), r.current;
  }, [e, t]);
  return [ue.useSyncExternalStore(o, s), e.setState];
}, "useUniversalStore");

// src/manager-api/stores/status.ts
var zs = Yo({
  universalStatusStore: G.create({
    ...qo,
    leader: globalThis.CONFIG_TYPE === "PRODUCTION"
  }),
  useUniversalStore: _e,
  environment: "manager"
}), { fullStatusStore: Ge, getStatusStoreByTypeId: Jo, useStatusStore: Xo, universalStatusStore: Qo } = zs;

// src/manager-api/modules/stories.ts
var { fetch: Hs } = en.global, qs = "./index.json", Ys = ["enableShortcuts", "theme", "showRoots"];
function vr(e) {
  if (!e || typeof e == "string")
    return e;
  let t = { ...e };
  return Ys.forEach((r) => {
    r in t && delete t[r];
  }), t;
}
n(vr, "removeRemovedOptions");
var Js = /* @__PURE__ */ n(({
  fullAPI: e,
  store: t,
  navigate: r,
  provider: o,
  storyId: s,
  viewMode: a,
  docsOptions: i = {}
}) => {
  let c = {
    storyId: re.toId,
    getData: /* @__PURE__ */ n((l, p) => {
      let d = c.resolveStory(l, p);
      if (d?.type === "story" || d?.type === "docs")
        return d;
    }, "getData"),
    isPrepared: /* @__PURE__ */ n((l, p) => {
      let d = c.getData(l, p);
      return d ? d.type === "story" ? d.prepared : !0 : !1;
    }, "isPrepared"),
    resolveStory: /* @__PURE__ */ n((l, p) => {
      let { refs: d, index: f } = t.getState();
      if (!(p && !d[p]))
        return p ? d?.[p]?.index?.[l] ?? void 0 : f ? f[l] : void 0;
    }, "resolveStory"),
    getCurrentStoryData: /* @__PURE__ */ n(() => {
      let { storyId: l, refId: p } = t.getState();
      return c.getData(l, p);
    }, "getCurrentStoryData"),
    getParameters: /* @__PURE__ */ n((l, p) => {
      let { storyId: d, refId: f } = typeof l == "string" ? { storyId: l, refId: void 0 } : l, y = c.getData(d, f);
      if (["story", "docs"].includes(y?.type)) {
        let { parameters: m } = y;
        if (m)
          return p ? m[p] : m;
      }
      return null;
    }, "getParameters"),
    getCurrentParameter: /* @__PURE__ */ n((l) => {
      let { storyId: p, refId: d } = t.getState();
      return c.getParameters({ storyId: p, refId: d }, l) || void 0;
    }, "getCurrentParameter"),
    jumpToComponent: /* @__PURE__ */ n((l) => {
      let { index: p, storyId: d, refs: f, refId: y } = t.getState();
      if (!c.getData(d, y))
        return;
      let h = y ? f[y].index || {} : p;
      if (!h)
        return;
      let g = c.findSiblingStoryId(d, h, l, !0);
      g && c.selectStory(g, void 0, { ref: y });
    }, "jumpToComponent"),
    jumpToStory: /* @__PURE__ */ n((l) => {
      let { index: p, storyId: d, refs: f, refId: y } = t.getState(), m = c.getData(d, y);
      if (!m)
        return;
      let h = m.refId ? f[m.refId].index : p;
      if (!h)
        return;
      let g = c.findSiblingStoryId(d, h, l, !1);
      g && c.selectStory(g, void 0, { ref: y });
    }, "jumpToStory"),
    selectFirstStory: /* @__PURE__ */ n(() => {
      let { index: l } = t.getState();
      if (!l)
        return;
      let p = Object.keys(l).find((d) => l[d].type === "story");
      if (p) {
        c.selectStory(p);
        return;
      }
      r("/");
    }, "selectFirstStory"),
    selectStory: /* @__PURE__ */ n((l = void 0, p = void 0, d = {}) => {
      let { ref: f } = d, { storyId: y, index: m, refs: h } = t.getState(), g = f ? h[f].index : m, S = y?.split("--", 2)[0];
      if (g)
        if (p)
          if (l) {
            let E = f ? `${f}_${(0, re.toId)(l, p)}` : (0, re.toId)(l, p);
            if (g[E])
              c.selectStory(E, void 0, d);
            else {
              let A = g[(0, re.sanitize)(l)];
              if (A?.type === "component") {
                let T = A.children.find((N) => g[N].name === p);
                T && c.selectStory(T, void 0, d);
              }
            }
          } else {
            let E = (0, re.toId)(S, p);
            c.selectStory(E, void 0, d);
          }
        else {
          let E = l ? g[l] || g[(0, re.sanitize)(l)] : g[S];
          if (!E)
            throw new Error(`Unknown id or title: '${l}'`);
          t.setState({
            settings: { ...t.getState().settings, lastTrackedStoryId: E.id }
          });
          let A = c.findLeafEntry(g, E.id), T = A.refId ? `${A.refId}_${A.id}` : A.id;
          r(`/${A.type}/${T}`);
        }
    }, "selectStory"),
    findLeafEntry(l, p) {
      let d = l[p];
      if (d.type === "docs" || d.type === "story")
        return d;
      let f = d.children[0];
      return c.findLeafEntry(l, f);
    },
    findLeafStoryId(l, p) {
      return c.findLeafEntry(l, p)?.id;
    },
    findAllLeafStoryIds(l) {
      let { index: p } = t.getState();
      if (!p)
        return [];
      let d = /* @__PURE__ */ n((f, y = []) => {
        let m = p[f];
        return m && (m.type === "story" ? y.push(m.id) : "children" in m && m.children.forEach((h) => d(h, y))), y;
      }, "findChildEntriesRecursively");
      return d(l, []);
    },
    findSiblingStoryId(l, p, d, f) {
      if (f) {
        let h = xo(p), g = h.findIndex((S) => S.includes(l));
        return g === h.length - 1 && d > 0 || g === 0 && d < 0 ? void 0 : h[g + d] ? h[g + d][0] : void 0;
      }
      let y = To(p), m = y.indexOf(l);
      if (!(m === y.length - 1 && d > 0) && !(m === 0 && d < 0))
        return y[m + d];
    },
    updateStoryArgs: /* @__PURE__ */ n((l, p) => {
      let { id: d, refId: f } = l;
      o.channel?.emit(_.UPDATE_STORY_ARGS, {
        storyId: d,
        updatedArgs: p,
        options: { target: f }
      });
    }, "updateStoryArgs"),
    resetStoryArgs: /* @__PURE__ */ n((l, p) => {
      let { id: d, refId: f } = l;
      o.channel?.emit(_.RESET_STORY_ARGS, {
        storyId: d,
        argNames: p,
        options: { target: f }
      });
    }, "resetStoryArgs"),
    fetchIndex: /* @__PURE__ */ n(async () => {
      try {
        let l = await Hs(qs);
        if (l.status !== 200)
          throw new Error(await l.text());
        let p = await l.json();
        if (p.v < 3) {
          Zo.logger.warn(`Skipping story index with version v${p.v}, awaiting SET_STORIES.`);
          return;
        }
        await c.setIndex(p);
      } catch (l) {
        await t.setState({ indexError: l });
      }
    }, "fetchIndex"),
    // The story index we receive on SET_INDEX is "prepared" in that it has parameters
    // The story index we receive on fetchStoryIndex is not, but all the prepared fields are optional
    // so we can cast one to the other easily enough
    setIndex: /* @__PURE__ */ n(async (l) => {
      let { filteredIndex: p, index: d, filters: f } = t.getState(), y = Ge.getAll(), m = ge(l, {
        provider: o,
        docsOptions: i,
        filters: f,
        allStatuses: y
      }), h = ge(l, {
        provider: o,
        docsOptions: i,
        filters: {},
        allStatuses: y
      });
      await t.setState({
        internal_index: l,
        filteredIndex: sr(m, p),
        index: sr(h, d),
        indexError: void 0
      });
    }, "setIndex"),
    // FIXME: is there a bug where filtered stories get added back in on updateStory???
    updateStory: /* @__PURE__ */ n(async (l, p, d) => {
      if (d) {
        let { id: f, index: y, filteredIndex: m } = d;
        y[l] = {
          ...y[l],
          ...p
        }, m[l] = {
          ...m[l],
          ...p
        }, await e.updateRef(f, { index: y, filteredIndex: m });
      } else {
        let { index: f, filteredIndex: y } = t.getState();
        f && (f[l] = {
          ...f[l],
          ...p
        }), y && (y[l] = {
          ...y[l],
          ...p
        }), (f || y) && await t.setState({ index: f, filteredIndex: y });
      }
    }, "updateStory"),
    updateDocs: /* @__PURE__ */ n(async (l, p, d) => {
      if (d) {
        let { id: f, index: y, filteredIndex: m } = d;
        y[l] = {
          ...y[l],
          ...p
        }, m[l] = {
          ...m[l],
          ...p
        }, await e.updateRef(f, { index: y, filteredIndex: m });
      } else {
        let { index: f, filteredIndex: y } = t.getState();
        f && (f[l] = {
          ...f[l],
          ...p
        }), y && (y[l] = {
          ...y[l],
          ...p
        }), (f || y) && await t.setState({ index: f, filteredIndex: y });
      }
    }, "updateDocs"),
    setPreviewInitialized: /* @__PURE__ */ n(async (l) => {
      l ? e.updateRef(l.id, { previewInitialized: !0 }) : t.setState({ previewInitialized: !0 });
    }, "setPreviewInitialized"),
    experimental_setFilter: /* @__PURE__ */ n(async (l, p) => {
      await t.setState({ filters: { ...t.getState().filters, [l]: p } });
      let { internal_index: d } = t.getState();
      if (!d)
        return;
      await c.setIndex(d);
      let f = await e.getRefs();
      Object.entries(f).forEach(([y, { internal_index: m, ...h }]) => {
        e.setRef(y, { ...h, storyIndex: m }, !0);
      }), o.channel?.emit(_.SET_FILTER, { id: l });
    }, "experimental_setFilter")
  };
  o.channel?.on(
    _.STORY_SPECIFIED,
    /* @__PURE__ */ n(function({
      storyId: p,
      viewMode: d
    }) {
      let { sourceType: f } = D(this, e);
      if (f === "local") {
        let y = t.getState(), m = y.path === "/" || y.viewMode === "story" || y.viewMode === "docs", h = y.viewMode && y.storyId, g = y.viewMode !==
        d || y.storyId !== p, { type: S } = y.index?.[y.storyId] || {};
        m && (h && g && !(S === "root" || S === "component" || S === "group") ? o.channel?.emit(_.SET_CURRENT_STORY, {
          storyId: y.storyId,
          viewMode: y.viewMode
        }) : g && r(`/${d}/${p}`));
      }
    }, "handler")
  ), o.channel?.on(_.CURRENT_STORY_WAS_SET, /* @__PURE__ */ n(function() {
    let { ref: p } = D(this, e);
    c.setPreviewInitialized(p);
  }, "handler")), o.channel?.on(_.STORY_CHANGED, /* @__PURE__ */ n(function() {
    let { sourceType: p } = D(this, e);
    if (p === "local") {
      let d = c.getCurrentParameter("options");
      d && e.setOptions(vr(d));
    }
  }, "handler")), o.channel?.on(
    _.STORY_PREPARED,
    /* @__PURE__ */ n(function({ id: p, ...d }) {
      let { ref: f, sourceType: y } = D(this, e);
      if (c.updateStory(p, { ...d, prepared: !0 }, f), !f && !t.getState().hasCalledSetOptions) {
        let { options: m } = d.parameters;
        e.setOptions(vr(m)), t.setState({ hasCalledSetOptions: !0 });
      }
      if (y === "local") {
        let { storyId: m, index: h, refId: g } = t.getState();
        if (!h)
          return;
        let S = Array.from(
          /* @__PURE__ */ new Set([
            c.findSiblingStoryId(m, h, 1, !0),
            c.findSiblingStoryId(m, h, -1, !0)
          ])
        ).filter(Boolean);
        o.channel?.emit(_.PRELOAD_ENTRIES, {
          ids: S,
          options: { target: g }
        });
      }
    }, "handler")
  ), o.channel?.on(
    _.DOCS_PREPARED,
    /* @__PURE__ */ n(function({ id: p, ...d }) {
      let { ref: f } = D(this, e);
      c.updateStory(p, { ...d, prepared: !0 }, f);
    }, "handler")
  ), o.channel?.on(_.SET_INDEX, /* @__PURE__ */ n(function(p) {
    let { ref: d } = D(this, e);
    if (d)
      e.setRef(d.id, { ...d, storyIndex: p }, !0);
    else {
      c.setIndex(p);
      let f = c.getCurrentParameter("options");
      e.setOptions(vr(f));
    }
  }, "handler")), o.channel?.on(_.SET_STORIES, /* @__PURE__ */ n(function(p) {
    let { ref: d } = D(this, e), f = p.v ? vo(p) : p.stories;
    if (d)
      e.setRef(d.id, { ...d, setStoriesData: f }, !0);
    else
      throw new Error("Cannot call SET_STORIES for local frame");
  }, "handler")), o.channel?.on(
    _.SELECT_STORY,
    /* @__PURE__ */ n(function({
      kind: p,
      title: d = p,
      story: f,
      name: y = f,
      storyId: m,
      ...h
    }) {
      let { ref: g } = D(this, e);
      g ? e.selectStory(m || d, y, { ...h, ref: g.id }) : e.selectStory(m || d, y, h);
    }, "handler")
  ), o.channel?.on(
    _.STORY_ARGS_UPDATED,
    /* @__PURE__ */ n(function({ storyId: p, args: d }) {
      let { ref: f } = D(this, e);
      c.updateStory(p, { args: d }, f);
    }, "handleStoryArgsUpdated")
  ), o.channel?.on(_.CONFIG_ERROR, /* @__PURE__ */ n(function(p) {
    let { ref: d } = D(this, e);
    c.setPreviewInitialized(d);
  }, "handleConfigError")), o.channel?.on(_.STORY_MISSING, /* @__PURE__ */ n(function(p) {
    let { ref: d } = D(this, e);
    c.setPreviewInitialized(d);
  }, "handleConfigError")), o.channel?.on(_.SET_CONFIG, () => {
    let l = o.getConfig();
    l?.sidebar?.filters && t.setState({
      filters: {
        ...t.getState().filters,
        ...l?.sidebar?.filters
      }
    });
  }), Ge.onAllStatusChange(async () => {
    let { internal_index: l } = t.getState();
    if (!l)
      return;
    await c.setIndex(l);
    let p = await e.getRefs();
    Object.entries(p).forEach(([d, { internal_index: f, ...y }]) => {
      e.setRef(d, { ...y, storyIndex: f }, !0);
    });
  });
  let u = o.getConfig();
  return {
    api: c,
    state: {
      storyId: s,
      viewMode: a,
      hasCalledSetOptions: !1,
      previewInitialized: !1,
      filters: u?.sidebar?.filters || {}
    },
    init: /* @__PURE__ */ n(async () => {
      o.channel?.on(_.STORY_INDEX_INVALIDATED, () => c.fetchIndex()), await c.fetchIndex();
    }, "init")
  };
}, "init");

// src/manager-api/modules/url.ts
var Rr = {};
U(Rr, {
  init: () => Qs
});
var q = require("storybook/internal/core-events"), $e = require("storybook/internal/router"), tn = require("@storybook/global");
var { window: xr } = tn.global, le = /* @__PURE__ */ n((e) => {
  if (e === "true" || e === "1")
    return !0;
  if (e === "false" || e === "0")
    return !1;
}, "parseBoolean"), Tr, Xs = /* @__PURE__ */ n(({
  state: { location: e, path: t, viewMode: r, storyId: o },
  singleStory: s
}) => {
  let {
    full: a,
    panel: i,
    nav: c,
    shortcuts: u,
    addonPanel: l,
    tabs: p,
    path: d,
    ...f
    // the rest gets passed to the iframe
  } = (0, $e.queryFromLocation)(e), y, m, h;
  le(a) === !0 ? (y = 0, m = 0, h = 0) : le(a) === !1 && (y = W.layout.navSize, m = W.layout.bottomPanelHeight, h = W.layout.rightPanelWidth),
  s || (le(c) === !0 && (y = W.layout.navSize), le(c) === !1 && (y = 0)), le(i) === !1 && (m = 0, h = 0);
  let g = {
    navSize: y,
    bottomPanelHeight: m,
    rightPanelWidth: h,
    panelPosition: ["right", "bottom"].includes(i) ? i : void 0,
    showTabs: le(p)
  }, S = {
    enableShortcuts: le(u)
  }, E = l || void 0, A = o, T = B(Tr, f) ? Tr : f;
  return Tr = T, { viewMode: r, layout: g, ui: S, selectedPanel: E, location: e, path: t, customQueryParams: T, storyId: A };
}, "initialUrlSupport"), Qs = /* @__PURE__ */ n((e) => {
  let { store: t, navigate: r, provider: o, fullAPI: s } = e, a = /* @__PURE__ */ n((l, p = {}, d = {}) => {
    let f = Object.entries(p).filter(([, m]) => m).sort(([m], [h]) => m < h ? -1 : 1).map(([m, h]) => `${m}=${h}`), y = [l, ...f].join("&");
    return r(y, d);
  }, "navigateTo"), i = {
    getQueryParam(l) {
      let { customQueryParams: p } = t.getState();
      return p ? p[l] : void 0;
    },
    getUrlState() {
      let { location: l, path: p, customQueryParams: d, storyId: f, url: y, viewMode: m } = t.getState();
      return {
        path: p,
        hash: l.hash ?? "",
        queryParams: d,
        storyId: f,
        url: y,
        viewMode: m
      };
    },
    setQueryParams(l) {
      let { customQueryParams: p } = t.getState(), d = {}, f = {
        ...p,
        ...Object.entries(l).reduce((y, [m, h]) => (h !== null && (y[m] = h), y), d)
      };
      B(p, f) || (t.setState({ customQueryParams: f }), o.channel?.emit(q.UPDATE_QUERY_PARAMS, f));
    },
    applyQueryParams(l, p) {
      let { path: d, hash: f = "", queryParams: y } = i.getUrlState();
      a(`${d}${f}`, { ...y, ...l }, p), i.setQueryParams(l);
    },
    navigateUrl(l, p) {
      r(l, { plain: !0, ...p });
    }
  }, c = /* @__PURE__ */ n(() => {
    let { path: l, hash: p = "", queryParams: d, viewMode: f } = i.getUrlState();
    if (f !== "story")
      return;
    let y = s.getCurrentStoryData();
    if (y?.type !== "story")
      return;
    let { args: m, initialArgs: h } = y, g = (0, $e.buildArgsParam)(h, m);
    a(`${l}${p}`, { ...d, args: g }, { replace: !0 }), i.setQueryParams({ args: g });
  }, "updateArgsParam");
  o.channel?.on(q.SET_CURRENT_STORY, () => c());
  let u;
  return o.channel?.on(q.STORY_ARGS_UPDATED, () => {
    "requestIdleCallback" in xr ? (u && xr.cancelIdleCallback(u), u = xr.requestIdleCallback(c, { timeout: 1e3 })) : (u && clearTimeout(u), setTimeout(
    c, 100));
  }), o.channel?.on(q.GLOBALS_UPDATED, ({ userGlobals: l, initialGlobals: p }) => {
    let { path: d, hash: f = "", queryParams: y } = i.getUrlState(), m = (0, $e.buildArgsParam)(p, l);
    a(`${d}${f}`, { ...y, globals: m }, { replace: !0 }), i.setQueryParams({ globals: m });
  }), o.channel?.on(q.NAVIGATE_URL, (l, p) => {
    i.navigateUrl(l, p);
  }), {
    api: i,
    state: Xs(e)
  };
}, "init");

// src/manager-api/modules/versions.ts
var wr = {};
U(wr, {
  init: () => ta
});
var kt = require("@storybook/global"), nn = L(rr(), 1), $ = L(require("semver"), 1);

// src/manager-api/version.ts
var rn = "9.1.13";

// src/manager-api/modules/versions.ts
var { VERSIONCHECK: Zs } = kt.global, on = (0, nn.default)(1)(() => {
  try {
    return { ...JSON.parse(Zs).data || {} };
  } catch {
    return {};
  }
}), ea = /* @__PURE__ */ n((e) => e.includes("vue") ? "vue" : e, "normalizeRendererName"), ta = /* @__PURE__ */ n(({ store: e }) => {
  let { dismissedVersionNotification: t } = e.getState(), r = {
    versions: {
      current: {
        version: rn
      },
      ...on()
    },
    dismissedVersionNotification: t
  }, o = {
    getCurrentVersion: /* @__PURE__ */ n(() => {
      let {
        versions: { current: a }
      } = e.getState();
      return a;
    }, "getCurrentVersion"),
    getLatestVersion: /* @__PURE__ */ n(() => {
      let {
        versions: { latest: a, next: i, current: c }
      } = e.getState();
      return c && $.default.prerelease(c.version) && i ? a && $.default.gt(a.version, i.version) ? a : i : a;
    }, "getLatestVersion"),
    // TODO: Move this to it's own "info" module later
    getDocsUrl: /* @__PURE__ */ n(({ subpath: a, versioned: i, renderer: c }) => {
      let {
        versions: { latest: u, current: l }
      } = e.getState(), p = "https://storybook.js.org/docs/";
      if (i && l?.version && u?.version) {
        let y = $.default.diff(u.version, l.version);
        y === "patch" || y === null || // assume latest version when current version is a 0.0.0 canary
        $.default.satisfies(l.version, "0.0.0", { includePrerelease: !0 }) || (p += `${$.default.major(l.version)}.${$.default.minor(l.version)}\
/`);
      }
      let [d, f] = a?.split("#") || [];
      if (d && (p += `${d}/`), c && typeof kt.global.STORYBOOK_RENDERER < "u") {
        let y = kt.global.STORYBOOK_RENDERER;
        y && (p += `?renderer=${ea(y)}`);
      }
      return f && (p += `#${f}`), p;
    }, "getDocsUrl"),
    versionUpdateAvailable: /* @__PURE__ */ n(() => {
      let a = o.getLatestVersion(), i = o.getCurrentVersion();
      if (a) {
        if (!a.version || !i.version)
          return !0;
        let u = !!$.default.prerelease(i.version) ? `${$.default.major(i.version)}.${$.default.minor(i.version)}.${$.default.patch(
          i.version
        )}` : i.version, l = $.default.diff(u, a.version);
        return $.default.gt(a.version, u) && l !== "patch" && !l.includes("pre");
      }
      return !1;
    }, "versionUpdateAvailable")
  };
  return { init: /* @__PURE__ */ n(async () => {
    let { versions: a = {} } = e.getState(), { latest: i, next: c } = on();
    await e.setState({
      versions: { ...a, latest: i, next: c }
    });
  }, "initModule"), state: r, api: o };
}, "init");

// src/manager-api/modules/whatsnew.tsx
var Or = {};
U(Or, {
  init: () => oa
});
var jt = L(require("react"), 1), oe = require("storybook/internal/core-events"), an = require("@storybook/global");
var sn = "whats-new", ra = /* @__PURE__ */ n(({ color: e = "currentColor", size: t = 14 }) => /* @__PURE__ */ jt.default.createElement(
  "svg",
  {
    width: t,
    height: t,
    viewBox: "0 0 14 14",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg"
  },
  /* @__PURE__ */ jt.default.createElement(
    "path",
    {
      fillRule: "evenodd",
      clipRule: "evenodd",
      d: "M2.042.616a.704.704 0 00-.66.729L1.816 12.9c.014.367.306.66.672.677l9.395.422h.032a.704.704 0 00.704-.703V.704c0-.015 0-.03-.002-.\
044a.704.704 0 00-.746-.659l-.773.049.057 1.615a.105.105 0 01-.17.086l-.52-.41-.617.468a.105.105 0 01-.168-.088L9.746.134 2.042.616zm8.003 4\
.747c-.247.192-2.092.324-2.092.05.04-1.045-.429-1.091-.689-1.091-.247 0-.662.075-.662.634 0 .57.607.893 1.32 1.27 1.014.538 2.24 1.188 2.24 \
2.823 0 1.568-1.273 2.433-2.898 2.433-1.676 0-3.141-.678-2.976-3.03.065-.275 2.197-.21 2.197 0-.026.971.195 1.256.753 1.256.43 0 .624-.236.6\
24-.634 0-.602-.633-.958-1.361-1.367-.987-.554-2.148-1.205-2.148-2.7 0-1.494 1.027-2.489 2.86-2.489 1.832 0 2.832.98 2.832 2.845z",
      fill: e
    }
  )
), "StorybookIcon"), oa = /* @__PURE__ */ n(({ fullAPI: e, store: t, provider: r }) => {
  let o = {
    whatsNewData: void 0
  };
  function s(l) {
    t.setState({ whatsNewData: l }), o.whatsNewData = l;
  }
  n(s, "setWhatsNewState");
  let a = {
    isWhatsNewUnread() {
      return o.whatsNewData?.status === "SUCCESS" && !o.whatsNewData.postIsRead;
    },
    whatsNewHasBeenRead() {
      o.whatsNewData?.status === "SUCCESS" && (c({ lastReadPost: o.whatsNewData.url }), s({ ...o.whatsNewData, postIsRead: !0 }), e.clearNotification(
      sn));
    },
    toggleWhatsNewNotifications() {
      o.whatsNewData?.status === "SUCCESS" && (s({
        ...o.whatsNewData,
        disableWhatsNewNotifications: !o.whatsNewData.disableWhatsNewNotifications
      }), r.channel?.emit(oe.TOGGLE_WHATS_NEW_NOTIFICATIONS, {
        disableWhatsNewNotifications: o.whatsNewData.disableWhatsNewNotifications
      }));
    }
  };
  function i() {
    return r.channel?.emit(oe.REQUEST_WHATS_NEW_DATA), new Promise(
      (l) => r.channel?.once(
        oe.RESULT_WHATS_NEW_DATA,
        ({ data: p }) => l(p)
      )
    );
  }
  n(i, "getLatestWhatsNewPost");
  function c(l) {
    r.channel?.emit(oe.SET_WHATS_NEW_CACHE, l);
  }
  return n(c, "setWhatsNewCache"), { init: /* @__PURE__ */ n(async () => {
    if (an.global.CONFIG_TYPE !== "DEVELOPMENT")
      return;
    let l = await i();
    s(l);
    let p = e.getUrlState();
    !(p?.path === "/onboarding" || p.queryParams?.onboarding === "true") && l.status === "SUCCESS" && !l.disableWhatsNewNotifications && l.showNotification &&
    e.addNotification({
      id: sn,
      link: "/settings/whats-new",
      content: {
        headline: l.title,
        subHeadline: "Learn what's new in Storybook"
      },
      icon: /* @__PURE__ */ jt.default.createElement(ra, null),
      onClear({ dismissed: f }) {
        f && c({ lastDismissedPost: l.url });
      }
    });
  }, "initModule"), state: o, api: a };
}, "init");

// src/manager-api/store.ts
var xe = L(cn(), 1);

// src/manager-api/lib/store-setup.ts
var Gt = L(Ln(), 1);
var Fn = /* @__PURE__ */ n((e) => {
  e.fn("set", function(t, r) {
    return e.set(
      // @ts-expect-error('this' implicitly has type 'any')
      this._area,
      // @ts-expect-error('this' implicitly has type 'any')
      this._in(t),
      (0, Gt.stringify)(r, { maxDepth: 50 })
    );
  }), e.fn("get", function(t, r) {
    let o = e.get(this._area, this._in(t));
    return o !== null ? (0, Gt.parse)(o) : r || o;
  });
}, "default");

// src/manager-api/store.ts
Fn(xe.default._);
var Wn = "@storybook/manager/store";
function $r(e) {
  return e.get(Wn) || {};
}
n($r, "get");
function cu(e, t) {
  return e.set(Wn, t);
}
n(cu, "set");
function uu(e, t) {
  let r = $r(e);
  return cu(e, { ...r, ...t });
}
n(uu, "update");
var Ke = class {
  static {
    n(this, "Store");
  }
  constructor({ setState: t, getState: r }) {
    this.upstreamSetState = t, this.upstreamGetState = r;
  }
  // The assumption is that this will be called once, to initialize the React state
  // when the module is instantiated
  getInitialState(t) {
    return { ...t, ...$r(xe.default.local), ...$r(xe.default.session) };
  }
  getState() {
    return this.upstreamGetState();
  }
  async setState(t, r, o) {
    let s, a;
    typeof r == "function" ? (s = r, a = o) : a = r;
    let { persistence: i = "none" } = a || {}, c = {}, u = {};
    typeof t == "function" ? c = /* @__PURE__ */ n((p) => (u = t(p), u), "patch") : (c = t, u = c);
    let l = await new Promise((p) => {
      this.upstreamSetState(c, () => {
        p(this.getState());
      });
    });
    if (i !== "none") {
      let p = i === "session" ? xe.default.session : xe.default.local;
      await uu(p, u);
    }
    return s && s(l), l;
  }
};

// src/manager-api/lib/request-response.ts
var ze = class extends Error {
  constructor(r, o) {
    super(r);
    this.payload = void 0;
    this.payload = o;
  }
  static {
    n(this, "RequestResponseError");
  }
}, lu = /* @__PURE__ */ n((e, t, r, o, s = 5e3) => {
  let a;
  return new Promise((i, c) => {
    let u = {
      id: Math.random().toString(16).slice(2),
      payload: o
    }, l = /* @__PURE__ */ n((p) => {
      p.id === u.id && (clearTimeout(a), e.off(r, l), p.success ? i(p.payload) : c(new ze(p.error, p.payload)));
    }, "responseHandler");
    e.emit(t, u), e.on(r, l), a = setTimeout(() => {
      e.off(r, l), c(new ze("Timed out waiting for response"));
    }, s);
  });
}, "experimental_requestResponse");

// src/manager-api/root.tsx
var { ActiveTabs: pu } = xt;
var He = io({ api: void 0, state: Pt({}) }), ar = /* @__PURE__ */ n((...e) => co({}, ...e), "combineParameters"), Br = class extends P.Component {
  constructor(r) {
    super(r);
    this.api = {};
    this.initModules = /* @__PURE__ */ n(() => {
      this.modules.forEach((r) => {
        "init" in r && r.init();
      });
    }, "initModules");
    let {
      location: o,
      path: s,
      refId: a,
      viewMode: i = r.docsOptions.docsMode ? "docs" : r.viewMode,
      singleStory: c,
      storyId: u,
      docsOptions: l,
      navigate: p
    } = r, d = new Ke({
      getState: /* @__PURE__ */ n(() => this.state, "getState"),
      setState: /* @__PURE__ */ n((S, E) => (this.setState(S, () => E(this.state)), this.state), "setState")
    }), f = { location: o, path: s, viewMode: i, singleStory: c, storyId: u, refId: a }, y = { docsOptions: l };
    this.state = d.getInitialState(Pt({ ...f, ...y }));
    let m = {
      navigate: p,
      store: d,
      provider: r.provider
    };
    this.modules = [
      mr,
      tr,
      er,
      xt,
      yr,
      hr,
      _r,
      Ir,
      ur,
      pr,
      Rr,
      wr,
      Or
    ].map(
      (S) => S.init({ ...f, ...y, ...m, state: this.state, fullAPI: this.api })
    );
    let h = Pt(this.state, ...this.modules.map((S) => S.state)), g = Object.assign(this.api, { navigate: p }, ...this.modules.map((S) => S.api));
    this.state = h, this.api = g;
  }
  static {
    n(this, "ManagerProvider");
  }
  static {
    this.displayName = "Manager";
  }
  static getDerivedStateFromProps(r, o) {
    return o.path !== r.path ? {
      ...o,
      location: r.location,
      path: r.path,
      refId: r.refId,
      viewMode: r.viewMode,
      storyId: r.storyId
    } : null;
  }
  shouldComponentUpdate(r, o) {
    let s = this.props, a = this.state;
    return s.path !== r.path || !F(a, o);
  }
  render() {
    let { children: r } = this.props, o = {
      state: this.state,
      api: this.api
    };
    return /* @__PURE__ */ P.default.createElement(du, { effect: this.initModules }, /* @__PURE__ */ P.default.createElement(He.Provider, { value: o },
    /* @__PURE__ */ P.default.createElement(Gn, null, r)));
  }
}, du = /* @__PURE__ */ n(({ children: e, effect: t }) => (P.default.useEffect(t, []), e), "EffectOnMount"), fu = /* @__PURE__ */ n((e) => e,
"defaultFilter");
function Gn({
  // @ts-expect-error (Converted from ts-ignore)
  filter: e = fu,
  children: t
}) {
  let r = (0, P.useContext)(He), o = (0, P.useRef)(t), s = (0, P.useRef)(e);
  if (typeof o.current != "function")
    return /* @__PURE__ */ P.default.createElement(P.Fragment, null, o.current);
  let a = s.current(r), i = (0, P.useMemo)(() => [...Object.entries(a).reduce((c, u) => c.concat(u), [])], [r.state]);
  return (0, P.useMemo)(() => {
    let c = o.current;
    return /* @__PURE__ */ P.default.createElement(c, { ...a });
  }, i);
}
n(Gn, "ManagerConsumer");
function yu() {
  let { state: e } = (0, P.useContext)(He);
  return e;
}
n(yu, "useStorybookState");
function X() {
  let { api: e } = (0, P.useContext)(He);
  return e;
}
n(X, "useStorybookApi");
function $n(e, t) {
  return typeof e > "u" ? t : e;
}
n($n, "orDefault");
var Vr = /* @__PURE__ */ n((e, t = []) => {
  let r = X();
  return (0, P.useEffect)(() => (Object.entries(e).forEach(([o, s]) => r.on(o, s)), () => {
    Object.entries(e).forEach(([o, s]) => r.off(o, s));
  }), t), r.emit;
}, "useChannel");
function mu(e) {
  return X().isPrepared(e);
}
n(mu, "useStoryPrepared");
function hu(e, t) {
  let r = X(), [o, s] = (0, P.useState)(r.getCurrentParameter(e)), a = (0, P.useCallback)(() => {
    let i = r.getCurrentParameter(e);
    s(i);
  }, [r, e]);
  return Vr(
    {
      [O.STORY_PREPARED]: a,
      [O.DOCS_PREPARED]: a
    },
    [a]
  ), $n(o, t);
}
n(hu, "useParameter");
globalThis.STORYBOOK_ADDON_STATE = {};
var { STORYBOOK_ADDON_STATE: Y } = globalThis;
function Bn(e, t) {
  let r = X(), o = r.getAddonState(e) || Y[e], s = $n(
    o,
    Y[e] ? Y[e] : t
  ), a = !1;
  s === t && t !== void 0 && (Y[e] = t, a = !0), (0, P.useEffect)(() => {
    a && r.setAddonState(e, t);
  }, [a]);
  let i = (0, P.useCallback)(
    async (p, d) => {
      await r.setAddonState(e, p, d);
      let f = r.getAddonState(e);
      return Y[e] = f, f;
    },
    [r, e]
  ), c = (0, P.useMemo)(() => {
    let p = {
      [`${O.SHARED_STATE_CHANGED}-client-${e}`]: i,
      [`${O.SHARED_STATE_SET}-client-${e}`]: i
    }, d = {
      [O.SET_STORIES]: async () => {
        let f = r.getAddonState(e);
        f ? (Y[e] = f, r.emit(`${O.SHARED_STATE_SET}-manager-${e}`, f)) : Y[e] ? (await i(Y[e]), r.emit(`${O.SHARED_STATE_SET}-manager-${e}`,
        Y[e])) : t !== void 0 && (await i(t), Y[e] = t, r.emit(`${O.SHARED_STATE_SET}-manager-${e}`, t));
      },
      [O.STORY_CHANGED]: () => {
        let f = r.getAddonState(e);
        f !== void 0 && r.emit(`${O.SHARED_STATE_SET}-manager-${e}`, f);
      }
    };
    return {
      ...p,
      ...d
    };
  }, [e]), u = Vr(c), l = (0, P.useCallback)(
    async (p, d) => {
      await i(p, d);
      let f = r.getAddonState(e);
      u(`${O.SHARED_STATE_CHANGED}-manager-${e}`, f);
    },
    [r, u, i, e]
  );
  return [s, l];
}
n(Bn, "useSharedState");
function gu(e, t) {
  return Bn(e, t);
}
n(gu, "useAddonState");
function Su() {
  let { getCurrentStoryData: e, updateStoryArgs: t, resetStoryArgs: r } = X(), o = e(), s = o?.type === "story" ? o.args : {}, a = o?.type ===
  "story" ? o.initialArgs : {}, i = (0, P.useCallback)(
    (u) => t(o, u),
    [o, t]
  ), c = (0, P.useCallback)(
    (u) => r(o, u),
    [o, r]
  );
  return [s, i, c, a];
}
n(Su, "useArgs");
function bu() {
  let e = X();
  return [e.getGlobals(), e.updateGlobals, e.getStoryGlobals(), e.getUserGlobals()];
}
n(bu, "useGlobals");
function Eu() {
  return X().getGlobalTypes();
}
n(Eu, "useGlobalTypes");
function _u() {
  let { getCurrentStoryData: e } = X();
  return e();
}
n(_u, "useCurrentStory");
function Pu() {
  let e = _u();
  return e?.type === "story" && e.argTypes || {};
}
n(Pu, "useArgTypes");
var Au = Xt.Addon_TypesEnum;

// src/shared/universal-store/mock.ts
var Vn = require("storybook/internal/channels"), Kn = L(ie(), 1);
var $t = class e extends G {
  static {
    n(this, "MockUniversalStore");
  }
  constructor(t, r) {
    G.isInternalConstructing = !0, super(
      { ...t, leader: !0 },
      { channel: new Vn.Channel({}), environment: G.Environment.MOCK }
    ), G.isInternalConstructing = !1, typeof r?.fn == "function" && (this.testUtils = r, this.getState = r.fn(this.getState), this.setState =
    r.fn(this.setState), this.subscribe = r.fn(this.subscribe), this.onStateChange = r.fn(this.onStateChange), this.send = r.fn(this.send));
  }
  /** Create a mock universal store. This is just an alias for the constructor */
  static create(t, r) {
    return new e(t, r);
  }
  unsubscribeAll() {
    if (!this.testUtils)
      throw new Error(
        Kn.default`Cannot call unsubscribeAll on a store that does not have testUtils.
        Please provide testUtils as the second argument when creating the store.`
      );
    let t = /* @__PURE__ */ n((r) => {
      try {
        r.value();
      } catch {
      }
    }, "callReturnedUnsubscribeFn");
    this.subscribe.mock?.results.forEach(t), this.onStateChange.mock?.results.forEach(t);
  }
};

// src/shared/test-provider-store/index.ts
var zn = {
  id: "storybook/test-provider",
  leader: !0,
  initialState: {}
};
function Hn({
  universalTestProviderStore: e,
  useUniversalStore: t
}) {
  let r = {
    settingsChanged: /* @__PURE__ */ n(() => {
      e.untilReady().then(() => {
        e.send({ type: "settings-changed" });
      });
    }, "settingsChanged"),
    onRunAll: /* @__PURE__ */ n((a) => e.subscribe("run-all", a), "onRunAll"),
    onClearAll: /* @__PURE__ */ n((a) => e.subscribe("clear-all", a), "onClearAll")
  }, o = {
    ...r,
    getFullState: e.getState,
    setFullState: e.setState,
    onSettingsChanged: /* @__PURE__ */ n((a) => e.subscribe("settings-changed", a), "onSettingsChanged"),
    runAll: /* @__PURE__ */ n(async () => {
      await e.untilReady(), e.send({ type: "run-all" });
    }, "runAll"),
    clearAll: /* @__PURE__ */ n(async () => {
      await e.untilReady(), e.send({ type: "clear-all" });
    }, "clearAll")
  }, s = /* @__PURE__ */ n((a) => {
    let i = /* @__PURE__ */ n(() => e.getState()[a] ?? "test-provider-state:pending", "getStateForTestProvider"), c = /* @__PURE__ */ n((u) => {
      e.untilReady().then(() => {
        e.setState((l) => ({
          ...l,
          [a]: u
        }));
      });
    }, "setStateForTestProvider");
    return {
      ...r,
      testProviderId: a,
      getState: i,
      setState: c,
      runWithState: /* @__PURE__ */ n(async (u) => {
        c("test-provider-state:running");
        try {
          await u(), c("test-provider-state:succeeded");
        } catch {
          c("test-provider-state:crashed");
        }
      }, "runWithState")
    };
  }, "getTestProviderStoreById");
  return t ? {
    getTestProviderStoreById: s,
    fullTestProviderStore: o,
    universalTestProviderStore: e,
    useTestProviderStore: /* @__PURE__ */ n((a) => t(e, a)[0], "useTestProviderStore")
  } : {
    getTestProviderStoreById: s,
    fullTestProviderStore: o,
    universalTestProviderStore: e
  };
}
n(Hn, "createTestProviderStore");

// src/manager-api/stores/test-provider.ts
var vu = Hn({
  universalTestProviderStore: G.create({
    ...zn,
    leader: globalThis.CONFIG_TYPE === "PRODUCTION"
  }),
  useUniversalStore: _e
}), {
  fullTestProviderStore: qn,
  getTestProviderStoreById: Yn,
  useTestProviderStore: Jn,
  universalTestProviderStore: Xn
} = vu;
