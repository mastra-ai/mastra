import ESM_COMPAT_Module from "node:module";
import { fileURLToPath as ESM_COMPAT_fileURLToPath } from 'node:url';
import { dirname as ESM_COMPAT_dirname } from 'node:path';
const __filename = ESM_COMPAT_fileURLToPath(import.meta.url);
const __dirname = ESM_COMPAT_dirname(__filename);
const require = ESM_COMPAT_Module.createRequire(import.meta.url);
var Ct = Object.create;
var C = Object.defineProperty;
var Nt = Object.getOwnPropertyDescriptor;
var Dt = Object.getOwnPropertyNames;
var It = Object.getPrototypeOf, Mt = Object.prototype.hasOwnProperty;
var o = (e, i) => C(e, "name", { value: i, configurable: !0 }), P = /* @__PURE__ */ ((e) => typeof require < "u" ? require : typeof Proxy < "\
u" ? new Proxy(e, {
  get: (i, t) => (typeof require < "u" ? require : i)[t]
}) : e)(function(e) {
  if (typeof require < "u") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + e + '" is not supported');
});
var q = (e, i) => () => (e && (i = e(e = 0)), i);
var N = (e, i) => () => (i || e((i = { exports: {} }).exports, i), i.exports), W = (e, i) => {
  for (var t in i)
    C(e, t, { get: i[t], enumerable: !0 });
}, de = (e, i, t, r) => {
  if (i && typeof i == "object" || typeof i == "function")
    for (let a of Dt(i))
      !Mt.call(e, a) && a !== t && C(e, a, { get: () => i[a], enumerable: !(r = Nt(i, a)) || r.enumerable });
  return e;
};
var V = (e, i, t) => (t = e != null ? Ct(It(e)) : {}, de(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  i || !e || !e.__esModule ? C(t, "default", { value: e, enumerable: !0 }) : t,
  e
)), $ = (e) => de(C({}, "__esModule", { value: !0 }), e);

// ../node_modules/tslib/tslib.es6.mjs
var He = {};
W(He, {
  __addDisposableResource: () => We,
  __assign: () => B,
  __asyncDelegator: () => Ae,
  __asyncGenerator: () => Le,
  __asyncValues: () => Ce,
  __await: () => F,
  __awaiter: () => Se,
  __classPrivateFieldGet: () => Me,
  __classPrivateFieldIn: () => qe,
  __classPrivateFieldSet: () => ze,
  __createBinding: () => J,
  __decorate: () => ve,
  __disposeResources: () => $e,
  __esDecorate: () => be,
  __exportStar: () => Te,
  __extends: () => he,
  __generator: () => Pe,
  __importDefault: () => Ie,
  __importStar: () => De,
  __makeTemplateObject: () => Ne,
  __metadata: () => Ee,
  __param: () => we,
  __propKey: () => je,
  __read: () => ee,
  __rest: () => ye,
  __rewriteRelativeImportExtension: () => Be,
  __runInitializers: () => _e,
  __setFunctionName: () => Oe,
  __spread: () => Re,
  __spreadArray: () => Fe,
  __spreadArrays: () => ke,
  __values: () => H,
  default: () => Bt
});
function he(e, i) {
  if (typeof i != "function" && i !== null)
    throw new TypeError("Class extends value " + String(i) + " is not a constructor or null");
  Y(e, i);
  function t() {
    this.constructor = e;
  }
  o(t, "__"), e.prototype = i === null ? Object.create(i) : (t.prototype = i.prototype, new t());
}
function ye(e, i) {
  var t = {};
  for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && i.indexOf(r) < 0 && (t[r] = e[r]);
  if (e != null && typeof Object.getOwnPropertySymbols == "function")
    for (var a = 0, r = Object.getOwnPropertySymbols(e); a < r.length; a++)
      i.indexOf(r[a]) < 0 && Object.prototype.propertyIsEnumerable.call(e, r[a]) && (t[r[a]] = e[r[a]]);
  return t;
}
function ve(e, i, t, r) {
  var a = arguments.length, n = a < 3 ? i : r === null ? r = Object.getOwnPropertyDescriptor(i, t) : r, s;
  if (typeof Reflect == "object" && typeof Reflect.decorate == "function") n = Reflect.decorate(e, i, t, r);
  else for (var l = e.length - 1; l >= 0; l--) (s = e[l]) && (n = (a < 3 ? s(n) : a > 3 ? s(i, t, n) : s(i, t)) || n);
  return a > 3 && n && Object.defineProperty(i, t, n), n;
}
function we(e, i) {
  return function(t, r) {
    i(t, r, e);
  };
}
function be(e, i, t, r, a, n) {
  function s(v) {
    if (v !== void 0 && typeof v != "function") throw new TypeError("Function expected");
    return v;
  }
  o(s, "accept");
  for (var l = r.kind, p = l === "getter" ? "get" : l === "setter" ? "set" : "value", c = !i && e ? r.static ? e : e.prototype : null, u = i ||
  (c ? Object.getOwnPropertyDescriptor(c, r.name) : {}), d, x = !1, g = t.length - 1; g >= 0; g--) {
    var m = {};
    for (var f in r) m[f] = f === "access" ? {} : r[f];
    for (var f in r.access) m.access[f] = r.access[f];
    m.addInitializer = function(v) {
      if (x) throw new TypeError("Cannot add initializers after decoration has completed");
      n.push(s(v || null));
    };
    var y = (0, t[g])(l === "accessor" ? { get: u.get, set: u.set } : u[p], m);
    if (l === "accessor") {
      if (y === void 0) continue;
      if (y === null || typeof y != "object") throw new TypeError("Object expected");
      (d = s(y.get)) && (u.get = d), (d = s(y.set)) && (u.set = d), (d = s(y.init)) && a.unshift(d);
    } else (d = s(y)) && (l === "field" ? a.unshift(d) : u[p] = d);
  }
  c && Object.defineProperty(c, r.name, u), x = !0;
}
function _e(e, i, t) {
  for (var r = arguments.length > 2, a = 0; a < i.length; a++)
    t = r ? i[a].call(e, t) : i[a].call(e);
  return r ? t : void 0;
}
function je(e) {
  return typeof e == "symbol" ? e : "".concat(e);
}
function Oe(e, i, t) {
  return typeof i == "symbol" && (i = i.description ? "[".concat(i.description, "]") : ""), Object.defineProperty(e, "name", { configurable: !0,
  value: t ? "".concat(t, " ", i) : i });
}
function Ee(e, i) {
  if (typeof Reflect == "object" && typeof Reflect.metadata == "function") return Reflect.metadata(e, i);
}
function Se(e, i, t, r) {
  function a(n) {
    return n instanceof t ? n : new t(function(s) {
      s(n);
    });
  }
  return o(a, "adopt"), new (t || (t = Promise))(function(n, s) {
    function l(u) {
      try {
        c(r.next(u));
      } catch (d) {
        s(d);
      }
    }
    o(l, "fulfilled");
    function p(u) {
      try {
        c(r.throw(u));
      } catch (d) {
        s(d);
      }
    }
    o(p, "rejected");
    function c(u) {
      u.done ? n(u.value) : a(u.value).then(l, p);
    }
    o(c, "step"), c((r = r.apply(e, i || [])).next());
  });
}
function Pe(e, i) {
  var t = { label: 0, sent: /* @__PURE__ */ o(function() {
    if (n[0] & 1) throw n[1];
    return n[1];
  }, "sent"), trys: [], ops: [] }, r, a, n, s = Object.create((typeof Iterator == "function" ? Iterator : Object).prototype);
  return s.next = l(0), s.throw = l(1), s.return = l(2), typeof Symbol == "function" && (s[Symbol.iterator] = function() {
    return this;
  }), s;
  function l(c) {
    return function(u) {
      return p([c, u]);
    };
  }
  function p(c) {
    if (r) throw new TypeError("Generator is already executing.");
    for (; s && (s = 0, c[0] && (t = 0)), t; ) try {
      if (r = 1, a && (n = c[0] & 2 ? a.return : c[0] ? a.throw || ((n = a.return) && n.call(a), 0) : a.next) && !(n = n.call(a, c[1])).done)
       return n;
      switch (a = 0, n && (c = [c[0] & 2, n.value]), c[0]) {
        case 0:
        case 1:
          n = c;
          break;
        case 4:
          return t.label++, { value: c[1], done: !1 };
        case 5:
          t.label++, a = c[1], c = [0];
          continue;
        case 7:
          c = t.ops.pop(), t.trys.pop();
          continue;
        default:
          if (n = t.trys, !(n = n.length > 0 && n[n.length - 1]) && (c[0] === 6 || c[0] === 2)) {
            t = 0;
            continue;
          }
          if (c[0] === 3 && (!n || c[1] > n[0] && c[1] < n[3])) {
            t.label = c[1];
            break;
          }
          if (c[0] === 6 && t.label < n[1]) {
            t.label = n[1], n = c;
            break;
          }
          if (n && t.label < n[2]) {
            t.label = n[2], t.ops.push(c);
            break;
          }
          n[2] && t.ops.pop(), t.trys.pop();
          continue;
      }
      c = i.call(e, t);
    } catch (u) {
      c = [6, u], a = 0;
    } finally {
      r = n = 0;
    }
    if (c[0] & 5) throw c[1];
    return { value: c[0] ? c[1] : void 0, done: !0 };
  }
}
function Te(e, i) {
  for (var t in e) t !== "default" && !Object.prototype.hasOwnProperty.call(i, t) && J(i, e, t);
}
function H(e) {
  var i = typeof Symbol == "function" && Symbol.iterator, t = i && e[i], r = 0;
  if (t) return t.call(e);
  if (e && typeof e.length == "number") return {
    next: /* @__PURE__ */ o(function() {
      return e && r >= e.length && (e = void 0), { value: e && e[r++], done: !e };
    }, "next")
  };
  throw new TypeError(i ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function ee(e, i) {
  var t = typeof Symbol == "function" && e[Symbol.iterator];
  if (!t) return e;
  var r = t.call(e), a, n = [], s;
  try {
    for (; (i === void 0 || i-- > 0) && !(a = r.next()).done; ) n.push(a.value);
  } catch (l) {
    s = { error: l };
  } finally {
    try {
      a && !a.done && (t = r.return) && t.call(r);
    } finally {
      if (s) throw s.error;
    }
  }
  return n;
}
function Re() {
  for (var e = [], i = 0; i < arguments.length; i++)
    e = e.concat(ee(arguments[i]));
  return e;
}
function ke() {
  for (var e = 0, i = 0, t = arguments.length; i < t; i++) e += arguments[i].length;
  for (var r = Array(e), a = 0, i = 0; i < t; i++)
    for (var n = arguments[i], s = 0, l = n.length; s < l; s++, a++)
      r[a] = n[s];
  return r;
}
function Fe(e, i, t) {
  if (t || arguments.length === 2) for (var r = 0, a = i.length, n; r < a; r++)
    (n || !(r in i)) && (n || (n = Array.prototype.slice.call(i, 0, r)), n[r] = i[r]);
  return e.concat(n || Array.prototype.slice.call(i));
}
function F(e) {
  return this instanceof F ? (this.v = e, this) : new F(e);
}
function Le(e, i, t) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var r = t.apply(e, i || []), a, n = [];
  return a = Object.create((typeof AsyncIterator == "function" ? AsyncIterator : Object).prototype), l("next"), l("throw"), l("return", s), a[Symbol.
  asyncIterator] = function() {
    return this;
  }, a;
  function s(g) {
    return function(m) {
      return Promise.resolve(m).then(g, d);
    };
  }
  function l(g, m) {
    r[g] && (a[g] = function(f) {
      return new Promise(function(y, v) {
        n.push([g, f, y, v]) > 1 || p(g, f);
      });
    }, m && (a[g] = m(a[g])));
  }
  function p(g, m) {
    try {
      c(r[g](m));
    } catch (f) {
      x(n[0][3], f);
    }
  }
  function c(g) {
    g.value instanceof F ? Promise.resolve(g.value.v).then(u, d) : x(n[0][2], g);
  }
  function u(g) {
    p("next", g);
  }
  function d(g) {
    p("throw", g);
  }
  function x(g, m) {
    g(m), n.shift(), n.length && p(n[0][0], n[0][1]);
  }
}
function Ae(e) {
  var i, t;
  return i = {}, r("next"), r("throw", function(a) {
    throw a;
  }), r("return"), i[Symbol.iterator] = function() {
    return this;
  }, i;
  function r(a, n) {
    i[a] = e[a] ? function(s) {
      return (t = !t) ? { value: F(e[a](s)), done: !1 } : n ? n(s) : s;
    } : n;
  }
}
function Ce(e) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var i = e[Symbol.asyncIterator], t;
  return i ? i.call(e) : (e = typeof H == "function" ? H(e) : e[Symbol.iterator](), t = {}, r("next"), r("throw"), r("return"), t[Symbol.asyncIterator] =
  function() {
    return this;
  }, t);
  function r(n) {
    t[n] = e[n] && function(s) {
      return new Promise(function(l, p) {
        s = e[n](s), a(l, p, s.done, s.value);
      });
    };
  }
  function a(n, s, l, p) {
    Promise.resolve(p).then(function(c) {
      n({ value: c, done: l });
    }, s);
  }
}
function Ne(e, i) {
  return Object.defineProperty ? Object.defineProperty(e, "raw", { value: i }) : e.raw = i, e;
}
function De(e) {
  if (e && e.__esModule) return e;
  var i = {};
  if (e != null) for (var t = Q(e), r = 0; r < t.length; r++) t[r] !== "default" && J(i, e, t[r]);
  return Wt(i, e), i;
}
function Ie(e) {
  return e && e.__esModule ? e : { default: e };
}
function Me(e, i, t, r) {
  if (t === "a" && !r) throw new TypeError("Private accessor was defined without a getter");
  if (typeof i == "function" ? e !== i || !r : !i.has(e)) throw new TypeError("Cannot read private member from an object whose class did not\
 declare it");
  return t === "m" ? r : t === "a" ? r.call(e) : r ? r.value : i.get(e);
}
function ze(e, i, t, r, a) {
  if (r === "m") throw new TypeError("Private method is not writable");
  if (r === "a" && !a) throw new TypeError("Private accessor was defined without a setter");
  if (typeof i == "function" ? e !== i || !a : !i.has(e)) throw new TypeError("Cannot write private member to an object whose class did not \
declare it");
  return r === "a" ? a.call(e, t) : a ? a.value = t : i.set(e, t), t;
}
function qe(e, i) {
  if (i === null || typeof i != "object" && typeof i != "function") throw new TypeError("Cannot use 'in' operator on non-object");
  return typeof e == "function" ? i === e : e.has(i);
}
function We(e, i, t) {
  if (i != null) {
    if (typeof i != "object" && typeof i != "function") throw new TypeError("Object expected.");
    var r, a;
    if (t) {
      if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
      r = i[Symbol.asyncDispose];
    }
    if (r === void 0) {
      if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
      r = i[Symbol.dispose], t && (a = r);
    }
    if (typeof r != "function") throw new TypeError("Object not disposable.");
    a && (r = /* @__PURE__ */ o(function() {
      try {
        a.call(this);
      } catch (n) {
        return Promise.reject(n);
      }
    }, "dispose")), e.stack.push({ value: i, dispose: r, async: t });
  } else t && e.stack.push({ async: !0 });
  return i;
}
function $e(e) {
  function i(n) {
    e.error = e.hasError ? new $t(n, e.error, "An error was suppressed during disposal.") : n, e.hasError = !0;
  }
  o(i, "fail");
  var t, r = 0;
  function a() {
    for (; t = e.stack.pop(); )
      try {
        if (!t.async && r === 1) return r = 0, e.stack.push(t), Promise.resolve().then(a);
        if (t.dispose) {
          var n = t.dispose.call(t.value);
          if (t.async) return r |= 2, Promise.resolve(n).then(a, function(s) {
            return i(s), a();
          });
        } else r |= 1;
      } catch (s) {
        i(s);
      }
    if (r === 1) return e.hasError ? Promise.reject(e.error) : Promise.resolve();
    if (e.hasError) throw e.error;
  }
  return o(a, "next"), a();
}
function Be(e, i) {
  return typeof e == "string" && /^\.\.?\//.test(e) ? e.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function(t, r, a, n, s) {
    return r ? i ? ".jsx" : ".js" : a && (!n || !s) ? t : a + n + "." + s.toLowerCase() + "js";
  }) : e;
}
var Y, B, J, Wt, Q, $t, Bt, Je = q(() => {
  Y = /* @__PURE__ */ o(function(e, i) {
    return Y = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(t, r) {
      t.__proto__ = r;
    } || function(t, r) {
      for (var a in r) Object.prototype.hasOwnProperty.call(r, a) && (t[a] = r[a]);
    }, Y(e, i);
  }, "extendStatics");
  o(he, "__extends");
  B = /* @__PURE__ */ o(function() {
    return B = Object.assign || /* @__PURE__ */ o(function(i) {
      for (var t, r = 1, a = arguments.length; r < a; r++) {
        t = arguments[r];
        for (var n in t) Object.prototype.hasOwnProperty.call(t, n) && (i[n] = t[n]);
      }
      return i;
    }, "__assign"), B.apply(this, arguments);
  }, "__assign");
  o(ye, "__rest");
  o(ve, "__decorate");
  o(we, "__param");
  o(be, "__esDecorate");
  o(_e, "__runInitializers");
  o(je, "__propKey");
  o(Oe, "__setFunctionName");
  o(Ee, "__metadata");
  o(Se, "__awaiter");
  o(Pe, "__generator");
  J = Object.create ? function(e, i, t, r) {
    r === void 0 && (r = t);
    var a = Object.getOwnPropertyDescriptor(i, t);
    (!a || ("get" in a ? !i.__esModule : a.writable || a.configurable)) && (a = { enumerable: !0, get: /* @__PURE__ */ o(function() {
      return i[t];
    }, "get") }), Object.defineProperty(e, r, a);
  } : function(e, i, t, r) {
    r === void 0 && (r = t), e[r] = i[t];
  };
  o(Te, "__exportStar");
  o(H, "__values");
  o(ee, "__read");
  o(Re, "__spread");
  o(ke, "__spreadArrays");
  o(Fe, "__spreadArray");
  o(F, "__await");
  o(Le, "__asyncGenerator");
  o(Ae, "__asyncDelegator");
  o(Ce, "__asyncValues");
  o(Ne, "__makeTemplateObject");
  Wt = Object.create ? function(e, i) {
    Object.defineProperty(e, "default", { enumerable: !0, value: i });
  } : function(e, i) {
    e.default = i;
  }, Q = /* @__PURE__ */ o(function(e) {
    return Q = Object.getOwnPropertyNames || function(i) {
      var t = [];
      for (var r in i) Object.prototype.hasOwnProperty.call(i, r) && (t[t.length] = r);
      return t;
    }, Q(e);
  }, "ownKeys");
  o(De, "__importStar");
  o(Ie, "__importDefault");
  o(Me, "__classPrivateFieldGet");
  o(ze, "__classPrivateFieldSet");
  o(qe, "__classPrivateFieldIn");
  o(We, "__addDisposableResource");
  $t = typeof SuppressedError == "function" ? SuppressedError : function(e, i, t) {
    var r = new Error(t);
    return r.name = "SuppressedError", r.error = e, r.suppressed = i, r;
  };
  o($e, "__disposeResources");
  o(Be, "__rewriteRelativeImportExtension");
  Bt = {
    __extends: he,
    __assign: B,
    __rest: ye,
    __decorate: ve,
    __param: we,
    __esDecorate: be,
    __runInitializers: _e,
    __propKey: je,
    __setFunctionName: Oe,
    __metadata: Ee,
    __awaiter: Se,
    __generator: Pe,
    __createBinding: J,
    __exportStar: Te,
    __values: H,
    __read: ee,
    __spread: Re,
    __spreadArrays: ke,
    __spreadArray: Fe,
    __await: F,
    __asyncGenerator: Le,
    __asyncDelegator: Ae,
    __asyncValues: Ce,
    __makeTemplateObject: Ne,
    __importStar: De,
    __importDefault: Ie,
    __classPrivateFieldGet: Me,
    __classPrivateFieldSet: ze,
    __classPrivateFieldIn: qe,
    __addDisposableResource: We,
    __disposeResources: $e,
    __rewriteRelativeImportExtension: Be
  };
});

// ../node_modules/@yarnpkg/esbuild-plugin-pnp/lib/index.js
var Ge = N((U) => {
  "use strict";
  Object.defineProperty(U, "__esModule", { value: !0 });
  U.pnpPlugin = void 0;
  var Ue = (Je(), $(He)), Ht = Ue.__importStar(P("fs")), Jt = Ue.__importDefault(P("path")), Ut = /()/, Gt = [".tsx", ".ts", ".jsx", ".mjs",
  ".cjs", ".js", ".css", ".json"];
  function Vt(e) {
    return e.map((i) => {
      let t = i.indexOf("*");
      return t !== -1 ? { prefix: i.slice(0, t), suffix: i.slice(t + 1) } : i;
    });
  }
  o(Vt, "parseExternals");
  function Xt(e, i) {
    for (let t of i)
      if (typeof t == "object") {
        if (e.length >= t.prefix.length + t.suffix.length && e.startsWith(t.prefix) && e.endsWith(t.suffix))
          return !0;
      } else if (e === t || !t.startsWith("/") && !t.startsWith("./") && !t.startsWith("../") && t !== "." && t !== ".." && e.startsWith(`${t}\
/`))
        return !0;
    return !1;
  }
  o(Xt, "isExternal");
  async function Kt(e) {
    return {
      contents: await Ht.promises.readFile(e.path),
      loader: "default",
      // For regular imports in the `file` namespace, resolveDir is the directory the
      // file being resolved lives in. For all other virtual modules, this defaults to
      // empty string: ""
      // A sensible value for pnp imports is the same as the `file` namespace, as pnp
      // still resolves to files on disk (in the cache).
      resolveDir: Jt.default.dirname(e.path)
    };
  }
  o(Kt, "defaultOnLoad");
  async function Zt(e, { resolvedPath: i, error: t, watchFiles: r }) {
    let a = t ? [{ text: t.message }] : [], n;
    switch (e.kind) {
      case "require-call":
      case "require-resolve":
      case "dynamic-import":
        n = { warnings: a };
        break;
      default:
        n = { errors: a };
        break;
    }
    return i !== null ? { namespace: "pnp", path: i, watchFiles: r } : { external: !0, ...n, watchFiles: r };
  }
  o(Zt, "defaultOnResolve");
  function Yt({ baseDir: e = process.cwd(), extensions: i = Gt, filter: t = Ut, onResolve: r = Zt, onLoad: a = Kt } = {}) {
    return {
      name: "@yarnpkg/esbuild-plugin-pnp",
      setup(n) {
        var s, l;
        let { findPnpApi: p } = P("module");
        if (typeof p > "u")
          return;
        let c = Vt((s = n.initialOptions.external) !== null && s !== void 0 ? s : []), u = (l = n.initialOptions.platform) !== null && l !==
        void 0 ? l : "browser", d = u === "node", x = new Set(n.initialOptions.conditions);
        x.add("default"), (u === "browser" || u === "node") && x.add(u);
        let g = new Set(x);
        g.add("import");
        let m = new Set(x);
        m.add("require"), n.onResolve({ filter: t }, (f) => {
          var y, v;
          if (Xt(f.path, c))
            return { external: !0 };
          let _ = x;
          f.kind === "dynamic-import" || f.kind === "import-statement" ? _ = g : (f.kind === "require-call" || f.kind === "require-resolve") &&
          (_ = m);
          let O = f.resolveDir ? `${f.resolveDir}/` : f.importer ? f.importer : `${e}/`, w = p(O);
          if (!w)
            return;
          let E = null, S;
          try {
            E = w.resolveRequest(f.path, O, {
              conditions: _,
              considerBuiltins: d,
              extensions: i
            });
          } catch (z) {
            S = z;
          }
          let R = [w.resolveRequest("pnpapi", null)];
          if (E) {
            let z = w.findPackageLocator(E);
            if (z) {
              let G = w.getPackageInformation(z);
              G?.linkType === "SOFT" && R.push((v = (y = w.resolveVirtual) === null || y === void 0 ? void 0 : y.call(w, E)) !== null && v !==
              void 0 ? v : E);
            }
          }
          return r(f, { resolvedPath: E, error: S, watchFiles: R });
        }), n.onLoad !== null && n.onLoad({ filter: t }, a);
      }
    };
  }
  o(Yt, "pnpPlugin");
  U.pnpPlugin = Yt;
});

// ../node_modules/totalist/sync/index.mjs
var Xe = {};
W(Xe, {
  totalist: () => Ve
});
import { join as te, resolve as Qt } from "path";
import { readdirSync as ei, statSync as ti } from "fs";
function Ve(e, i, t = "") {
  e = Qt(".", e);
  let r = ei(e), a = 0, n, s;
  for (; a < r.length; a++)
    n = te(e, r[a]), s = ti(n), s.isDirectory() ? Ve(n, i, te(t, r[a])) : i(te(t, r[a]), n, s);
}
var Ke = q(() => {
  o(Ve, "totalist");
});

// ../node_modules/@polka/url/build.mjs
var Ye = {};
W(Ye, {
  parse: () => ii
});
import * as Ze from "node:querystring";
function ii(e) {
  let i = e.url;
  if (i == null) return;
  let t = e._parsedUrl;
  if (t && t.raw === i) return t;
  let r = i, a = "", n, s;
  if (i.length > 1) {
    let l = i.indexOf("#", 1);
    l !== -1 && (s = i.substring(l), r = i.substring(0, l)), l = r.indexOf("?", 1), l !== -1 && (a = r.substring(l), r = r.substring(0, l), a.
    length > 1 && (n = Ze.parse(a.substring(1))));
  }
  return e._parsedUrl = { pathname: r, search: a, query: n, hash: s, raw: i };
}
var Qe = q(() => {
  o(ii, "parse");
});

// ../node_modules/mrmime/index.mjs
var tt = {};
W(tt, {
  lookup: () => ri,
  mimes: () => et
});
function ri(e) {
  let i = ("" + e).trim().toLowerCase(), t = i.lastIndexOf(".");
  return et[~t ? i.substring(++t) : i];
}
var et, it = q(() => {
  et = {
    "3g2": "video/3gpp2",
    "3gp": "video/3gpp",
    "3gpp": "video/3gpp",
    "3mf": "model/3mf",
    aac: "audio/aac",
    ac: "application/pkix-attr-cert",
    adp: "audio/adpcm",
    adts: "audio/aac",
    ai: "application/postscript",
    aml: "application/automationml-aml+xml",
    amlx: "application/automationml-amlx+zip",
    amr: "audio/amr",
    apng: "image/apng",
    appcache: "text/cache-manifest",
    appinstaller: "application/appinstaller",
    appx: "application/appx",
    appxbundle: "application/appxbundle",
    asc: "application/pgp-keys",
    atom: "application/atom+xml",
    atomcat: "application/atomcat+xml",
    atomdeleted: "application/atomdeleted+xml",
    atomsvc: "application/atomsvc+xml",
    au: "audio/basic",
    avci: "image/avci",
    avcs: "image/avcs",
    avif: "image/avif",
    aw: "application/applixware",
    bdoc: "application/bdoc",
    bin: "application/octet-stream",
    bmp: "image/bmp",
    bpk: "application/octet-stream",
    btf: "image/prs.btif",
    btif: "image/prs.btif",
    buffer: "application/octet-stream",
    ccxml: "application/ccxml+xml",
    cdfx: "application/cdfx+xml",
    cdmia: "application/cdmi-capability",
    cdmic: "application/cdmi-container",
    cdmid: "application/cdmi-domain",
    cdmio: "application/cdmi-object",
    cdmiq: "application/cdmi-queue",
    cer: "application/pkix-cert",
    cgm: "image/cgm",
    cjs: "application/node",
    class: "application/java-vm",
    coffee: "text/coffeescript",
    conf: "text/plain",
    cpl: "application/cpl+xml",
    cpt: "application/mac-compactpro",
    crl: "application/pkix-crl",
    css: "text/css",
    csv: "text/csv",
    cu: "application/cu-seeme",
    cwl: "application/cwl",
    cww: "application/prs.cww",
    davmount: "application/davmount+xml",
    dbk: "application/docbook+xml",
    deb: "application/octet-stream",
    def: "text/plain",
    deploy: "application/octet-stream",
    dib: "image/bmp",
    "disposition-notification": "message/disposition-notification",
    dist: "application/octet-stream",
    distz: "application/octet-stream",
    dll: "application/octet-stream",
    dmg: "application/octet-stream",
    dms: "application/octet-stream",
    doc: "application/msword",
    dot: "application/msword",
    dpx: "image/dpx",
    drle: "image/dicom-rle",
    dsc: "text/prs.lines.tag",
    dssc: "application/dssc+der",
    dtd: "application/xml-dtd",
    dump: "application/octet-stream",
    dwd: "application/atsc-dwd+xml",
    ear: "application/java-archive",
    ecma: "application/ecmascript",
    elc: "application/octet-stream",
    emf: "image/emf",
    eml: "message/rfc822",
    emma: "application/emma+xml",
    emotionml: "application/emotionml+xml",
    eps: "application/postscript",
    epub: "application/epub+zip",
    exe: "application/octet-stream",
    exi: "application/exi",
    exp: "application/express",
    exr: "image/aces",
    ez: "application/andrew-inset",
    fdf: "application/fdf",
    fdt: "application/fdt+xml",
    fits: "image/fits",
    g3: "image/g3fax",
    gbr: "application/rpki-ghostbusters",
    geojson: "application/geo+json",
    gif: "image/gif",
    glb: "model/gltf-binary",
    gltf: "model/gltf+json",
    gml: "application/gml+xml",
    gpx: "application/gpx+xml",
    gram: "application/srgs",
    grxml: "application/srgs+xml",
    gxf: "application/gxf",
    gz: "application/gzip",
    h261: "video/h261",
    h263: "video/h263",
    h264: "video/h264",
    heic: "image/heic",
    heics: "image/heic-sequence",
    heif: "image/heif",
    heifs: "image/heif-sequence",
    hej2: "image/hej2k",
    held: "application/atsc-held+xml",
    hjson: "application/hjson",
    hlp: "application/winhlp",
    hqx: "application/mac-binhex40",
    hsj2: "image/hsj2",
    htm: "text/html",
    html: "text/html",
    ics: "text/calendar",
    ief: "image/ief",
    ifb: "text/calendar",
    iges: "model/iges",
    igs: "model/iges",
    img: "application/octet-stream",
    in: "text/plain",
    ini: "text/plain",
    ink: "application/inkml+xml",
    inkml: "application/inkml+xml",
    ipfix: "application/ipfix",
    iso: "application/octet-stream",
    its: "application/its+xml",
    jade: "text/jade",
    jar: "application/java-archive",
    jhc: "image/jphc",
    jls: "image/jls",
    jp2: "image/jp2",
    jpe: "image/jpeg",
    jpeg: "image/jpeg",
    jpf: "image/jpx",
    jpg: "image/jpeg",
    jpg2: "image/jp2",
    jpgm: "image/jpm",
    jpgv: "video/jpeg",
    jph: "image/jph",
    jpm: "image/jpm",
    jpx: "image/jpx",
    js: "text/javascript",
    json: "application/json",
    json5: "application/json5",
    jsonld: "application/ld+json",
    jsonml: "application/jsonml+json",
    jsx: "text/jsx",
    jt: "model/jt",
    jxl: "image/jxl",
    jxr: "image/jxr",
    jxra: "image/jxra",
    jxrs: "image/jxrs",
    jxs: "image/jxs",
    jxsc: "image/jxsc",
    jxsi: "image/jxsi",
    jxss: "image/jxss",
    kar: "audio/midi",
    ktx: "image/ktx",
    ktx2: "image/ktx2",
    less: "text/less",
    lgr: "application/lgr+xml",
    list: "text/plain",
    litcoffee: "text/coffeescript",
    log: "text/plain",
    lostxml: "application/lost+xml",
    lrf: "application/octet-stream",
    m1v: "video/mpeg",
    m21: "application/mp21",
    m2a: "audio/mpeg",
    m2t: "video/mp2t",
    m2ts: "video/mp2t",
    m2v: "video/mpeg",
    m3a: "audio/mpeg",
    m4a: "audio/mp4",
    m4p: "application/mp4",
    m4s: "video/iso.segment",
    ma: "application/mathematica",
    mads: "application/mads+xml",
    maei: "application/mmt-aei+xml",
    man: "text/troff",
    manifest: "text/cache-manifest",
    map: "application/json",
    mar: "application/octet-stream",
    markdown: "text/markdown",
    mathml: "application/mathml+xml",
    mb: "application/mathematica",
    mbox: "application/mbox",
    md: "text/markdown",
    mdx: "text/mdx",
    me: "text/troff",
    mesh: "model/mesh",
    meta4: "application/metalink4+xml",
    metalink: "application/metalink+xml",
    mets: "application/mets+xml",
    mft: "application/rpki-manifest",
    mid: "audio/midi",
    midi: "audio/midi",
    mime: "message/rfc822",
    mj2: "video/mj2",
    mjp2: "video/mj2",
    mjs: "text/javascript",
    mml: "text/mathml",
    mods: "application/mods+xml",
    mov: "video/quicktime",
    mp2: "audio/mpeg",
    mp21: "application/mp21",
    mp2a: "audio/mpeg",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    mp4a: "audio/mp4",
    mp4s: "application/mp4",
    mp4v: "video/mp4",
    mpd: "application/dash+xml",
    mpe: "video/mpeg",
    mpeg: "video/mpeg",
    mpf: "application/media-policy-dataset+xml",
    mpg: "video/mpeg",
    mpg4: "video/mp4",
    mpga: "audio/mpeg",
    mpp: "application/dash-patch+xml",
    mrc: "application/marc",
    mrcx: "application/marcxml+xml",
    ms: "text/troff",
    mscml: "application/mediaservercontrol+xml",
    msh: "model/mesh",
    msi: "application/octet-stream",
    msix: "application/msix",
    msixbundle: "application/msixbundle",
    msm: "application/octet-stream",
    msp: "application/octet-stream",
    mtl: "model/mtl",
    mts: "video/mp2t",
    musd: "application/mmt-usd+xml",
    mxf: "application/mxf",
    mxmf: "audio/mobile-xmf",
    mxml: "application/xv+xml",
    n3: "text/n3",
    nb: "application/mathematica",
    nq: "application/n-quads",
    nt: "application/n-triples",
    obj: "model/obj",
    oda: "application/oda",
    oga: "audio/ogg",
    ogg: "audio/ogg",
    ogv: "video/ogg",
    ogx: "application/ogg",
    omdoc: "application/omdoc+xml",
    onepkg: "application/onenote",
    onetmp: "application/onenote",
    onetoc: "application/onenote",
    onetoc2: "application/onenote",
    opf: "application/oebps-package+xml",
    opus: "audio/ogg",
    otf: "font/otf",
    owl: "application/rdf+xml",
    oxps: "application/oxps",
    p10: "application/pkcs10",
    p7c: "application/pkcs7-mime",
    p7m: "application/pkcs7-mime",
    p7s: "application/pkcs7-signature",
    p8: "application/pkcs8",
    pdf: "application/pdf",
    pfr: "application/font-tdpfr",
    pgp: "application/pgp-encrypted",
    pkg: "application/octet-stream",
    pki: "application/pkixcmp",
    pkipath: "application/pkix-pkipath",
    pls: "application/pls+xml",
    png: "image/png",
    prc: "model/prc",
    prf: "application/pics-rules",
    provx: "application/provenance+xml",
    ps: "application/postscript",
    pskcxml: "application/pskc+xml",
    pti: "image/prs.pti",
    qt: "video/quicktime",
    raml: "application/raml+yaml",
    rapd: "application/route-apd+xml",
    rdf: "application/rdf+xml",
    relo: "application/p2p-overlay+xml",
    rif: "application/reginfo+xml",
    rl: "application/resource-lists+xml",
    rld: "application/resource-lists-diff+xml",
    rmi: "audio/midi",
    rnc: "application/relax-ng-compact-syntax",
    rng: "application/xml",
    roa: "application/rpki-roa",
    roff: "text/troff",
    rq: "application/sparql-query",
    rs: "application/rls-services+xml",
    rsat: "application/atsc-rsat+xml",
    rsd: "application/rsd+xml",
    rsheet: "application/urc-ressheet+xml",
    rss: "application/rss+xml",
    rtf: "text/rtf",
    rtx: "text/richtext",
    rusd: "application/route-usd+xml",
    s3m: "audio/s3m",
    sbml: "application/sbml+xml",
    scq: "application/scvp-cv-request",
    scs: "application/scvp-cv-response",
    sdp: "application/sdp",
    senmlx: "application/senml+xml",
    sensmlx: "application/sensml+xml",
    ser: "application/java-serialized-object",
    setpay: "application/set-payment-initiation",
    setreg: "application/set-registration-initiation",
    sgi: "image/sgi",
    sgm: "text/sgml",
    sgml: "text/sgml",
    shex: "text/shex",
    shf: "application/shf+xml",
    shtml: "text/html",
    sieve: "application/sieve",
    sig: "application/pgp-signature",
    sil: "audio/silk",
    silo: "model/mesh",
    siv: "application/sieve",
    slim: "text/slim",
    slm: "text/slim",
    sls: "application/route-s-tsid+xml",
    smi: "application/smil+xml",
    smil: "application/smil+xml",
    snd: "audio/basic",
    so: "application/octet-stream",
    spdx: "text/spdx",
    spp: "application/scvp-vp-response",
    spq: "application/scvp-vp-request",
    spx: "audio/ogg",
    sql: "application/sql",
    sru: "application/sru+xml",
    srx: "application/sparql-results+xml",
    ssdl: "application/ssdl+xml",
    ssml: "application/ssml+xml",
    stk: "application/hyperstudio",
    stl: "model/stl",
    stpx: "model/step+xml",
    stpxz: "model/step-xml+zip",
    stpz: "model/step+zip",
    styl: "text/stylus",
    stylus: "text/stylus",
    svg: "image/svg+xml",
    svgz: "image/svg+xml",
    swidtag: "application/swid+xml",
    t: "text/troff",
    t38: "image/t38",
    td: "application/urc-targetdesc+xml",
    tei: "application/tei+xml",
    teicorpus: "application/tei+xml",
    text: "text/plain",
    tfi: "application/thraud+xml",
    tfx: "image/tiff-fx",
    tif: "image/tiff",
    tiff: "image/tiff",
    toml: "application/toml",
    tr: "text/troff",
    trig: "application/trig",
    ts: "video/mp2t",
    tsd: "application/timestamped-data",
    tsv: "text/tab-separated-values",
    ttc: "font/collection",
    ttf: "font/ttf",
    ttl: "text/turtle",
    ttml: "application/ttml+xml",
    txt: "text/plain",
    u3d: "model/u3d",
    u8dsn: "message/global-delivery-status",
    u8hdr: "message/global-headers",
    u8mdn: "message/global-disposition-notification",
    u8msg: "message/global",
    ubj: "application/ubjson",
    uri: "text/uri-list",
    uris: "text/uri-list",
    urls: "text/uri-list",
    vcard: "text/vcard",
    vrml: "model/vrml",
    vtt: "text/vtt",
    vxml: "application/voicexml+xml",
    war: "application/java-archive",
    wasm: "application/wasm",
    wav: "audio/wav",
    weba: "audio/webm",
    webm: "video/webm",
    webmanifest: "application/manifest+json",
    webp: "image/webp",
    wgsl: "text/wgsl",
    wgt: "application/widget",
    wif: "application/watcherinfo+xml",
    wmf: "image/wmf",
    woff: "font/woff",
    woff2: "font/woff2",
    wrl: "model/vrml",
    wsdl: "application/wsdl+xml",
    wspolicy: "application/wspolicy+xml",
    x3d: "model/x3d+xml",
    x3db: "model/x3d+fastinfoset",
    x3dbz: "model/x3d+binary",
    x3dv: "model/x3d-vrml",
    x3dvz: "model/x3d+vrml",
    x3dz: "model/x3d+xml",
    xaml: "application/xaml+xml",
    xav: "application/xcap-att+xml",
    xca: "application/xcap-caps+xml",
    xcs: "application/calendar+xml",
    xdf: "application/xcap-diff+xml",
    xdssc: "application/dssc+xml",
    xel: "application/xcap-el+xml",
    xenc: "application/xenc+xml",
    xer: "application/patch-ops-error+xml",
    xfdf: "application/xfdf",
    xht: "application/xhtml+xml",
    xhtml: "application/xhtml+xml",
    xhvml: "application/xv+xml",
    xlf: "application/xliff+xml",
    xm: "audio/xm",
    xml: "text/xml",
    xns: "application/xcap-ns+xml",
    xop: "application/xop+xml",
    xpl: "application/xproc+xml",
    xsd: "application/xml",
    xsf: "application/prs.xsf+xml",
    xsl: "application/xml",
    xslt: "application/xml",
    xspf: "application/xspf+xml",
    xvm: "application/xv+xml",
    xvml: "application/xv+xml",
    yaml: "text/yaml",
    yang: "application/yang",
    yin: "application/yin+xml",
    yml: "text/yaml",
    zip: "application/zip"
  };
  o(ri, "lookup");
});

// ../node_modules/sirv/build.js
var ot = N((Mr, nt) => {
  var ie = P("fs"), { join: ai, normalize: ni, resolve: oi } = P("path"), { totalist: si } = (Ke(), $(Xe)), { parse: li } = (Qe(), $(Ye)), {
  lookup: ci } = (it(), $(tt)), pi = /* @__PURE__ */ o(() => {
  }, "noop");
  function mi(e, i) {
    for (let t = 0; t < i.length; t++)
      if (i[t].test(e)) return !0;
  }
  o(mi, "isMatch");
  function rt(e, i) {
    let t = 0, r, a = e.length - 1;
    e.charCodeAt(a) === 47 && (e = e.substring(0, a));
    let n = [], s = `${e}/index`;
    for (; t < i.length; t++)
      r = i[t] ? `.${i[t]}` : "", e && n.push(e + r), n.push(s + r);
    return n;
  }
  o(rt, "toAssume");
  function ui(e, i, t) {
    let r = 0, a, n = rt(i, t);
    for (; r < n.length; r++)
      if (a = e[n[r]]) return a;
  }
  o(ui, "viaCache");
  function fi(e, i, t, r) {
    let a = 0, n = rt(t, r), s, l, p, c;
    for (; a < n.length; a++)
      if (s = ni(ai(e, p = n[a])), s.startsWith(e) && ie.existsSync(s)) {
        if (l = ie.statSync(s), l.isDirectory()) continue;
        return c = at(p, l, i), c["Cache-Control"] = i ? "no-cache" : "no-store", { abs: s, stats: l, headers: c };
      }
  }
  o(fi, "viaLocal");
  function di(e, i) {
    return i.statusCode = 404, i.end();
  }
  o(di, "is404");
  function gi(e, i, t, r, a) {
    let n = 200, s, l = {};
    a = { ...a };
    for (let p in a)
      s = i.getHeader(p), s && (a[p] = s);
    if ((s = i.getHeader("content-type")) && (a["Content-Type"] = s), e.headers.range) {
      n = 206;
      let [p, c] = e.headers.range.replace("bytes=", "").split("-"), u = l.end = parseInt(c, 10) || r.size - 1, d = l.start = parseInt(p, 10) ||
      0;
      if (u >= r.size && (u = r.size - 1), d >= r.size)
        return i.setHeader("Content-Range", `bytes */${r.size}`), i.statusCode = 416, i.end();
      a["Content-Range"] = `bytes ${d}-${u}/${r.size}`, a["Content-Length"] = u - d + 1, a["Accept-Ranges"] = "bytes";
    }
    i.writeHead(n, a), ie.createReadStream(t, l).pipe(i);
  }
  o(gi, "send");
  var xi = {
    ".br": "br",
    ".gz": "gzip"
  };
  function at(e, i, t) {
    let r = xi[e.slice(-3)], a = ci(e.slice(0, r && -3)) || "";
    a === "text/html" && (a += ";charset=utf-8");
    let n = {
      "Content-Length": i.size,
      "Content-Type": a,
      "Last-Modified": i.mtime.toUTCString()
    };
    return r && (n["Content-Encoding"] = r), t && (n.ETag = `W/"${i.size}-${i.mtime.getTime()}"`), n;
  }
  o(at, "toHeaders");
  nt.exports = function(e, i = {}) {
    e = oi(e || ".");
    let t = i.onNoMatch || di, r = i.setHeaders || pi, a = i.extensions || ["html", "htm"], n = i.gzip && a.map((m) => `${m}.gz`).concat("gz"),
    s = i.brotli && a.map((m) => `${m}.br`).concat("br"), l = {}, p = "/", c = !!i.etag, u = !!i.single;
    if (typeof i.single == "string") {
      let m = i.single.lastIndexOf(".");
      p += ~m ? i.single.substring(0, m) : i.single;
    }
    let d = [];
    i.ignores !== !1 && (d.push(/[/]([A-Za-z\s\d~$._-]+\.\w+){1,}$/), i.dotfiles ? d.push(/\/\.\w/) : d.push(/\/\.well-known/), [].concat(i.
    ignores || []).forEach((m) => {
      d.push(new RegExp(m, "i"));
    }));
    let x = i.maxAge != null && `public,max-age=${i.maxAge}`;
    x && i.immutable ? x += ",immutable" : x && i.maxAge === 0 && (x += ",must-revalidate"), i.dev || si(e, (m, f, y) => {
      if (!/\.well-known[\\+\/]/.test(m)) {
        if (!i.dotfiles && /(^\.|[\\+|\/+]\.)/.test(m)) return;
      }
      let v = at(m, y, c);
      x && (v["Cache-Control"] = x), l["/" + m.normalize().replace(/\\+/g, "/")] = { abs: f, stats: y, headers: v };
    });
    let g = i.dev ? fi.bind(0, e, c) : ui.bind(0, l);
    return function(m, f, y) {
      let v = [""], _ = li(m).pathname, O = m.headers["accept-encoding"] || "";
      if (n && O.includes("gzip") && v.unshift(...n), s && /(br|brotli)/i.test(O) && v.unshift(...s), v.push(...a), _.indexOf("%") !== -1)
        try {
          _ = decodeURI(_);
        } catch {
        }
      let w = g(_, v) || u && !mi(_, d) && g(p, v);
      if (!w) return y ? y() : t(m, f);
      if (c && m.headers["if-none-match"] === w.headers.ETag)
        return f.writeHead(304), f.end();
      (n || s) && f.setHeader("Vary", "Accept-Encoding"), r(f, _, w.stats), gi(m, f, w.abs, w.stats, w.headers);
    };
  };
});

// ../node_modules/ejs/lib/utils.js
var ct = N((T) => {
  "use strict";
  var yi = /[|\\{}()[\]^$+*?.]/g, vi = Object.prototype.hasOwnProperty, ae = /* @__PURE__ */ o(function(e, i) {
    return vi.apply(e, [i]);
  }, "hasOwn");
  T.escapeRegExpChars = function(e) {
    return e ? String(e).replace(yi, "\\$&") : "";
  };
  var wi = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&#34;",
    "'": "&#39;"
  }, bi = /[&<>'"]/g;
  function _i(e) {
    return wi[e] || e;
  }
  o(_i, "encode_char");
  var ji = `var _ENCODE_HTML_RULES = {
      "&": "&amp;"
    , "<": "&lt;"
    , ">": "&gt;"
    , '"': "&#34;"
    , "'": "&#39;"
    }
  , _MATCH_HTML = /[&<>'"]/g;
function encode_char(c) {
  return _ENCODE_HTML_RULES[c] || c;
};
`;
  T.escapeXML = function(e) {
    return e == null ? "" : String(e).replace(bi, _i);
  };
  function lt() {
    return Function.prototype.toString.call(this) + `;
` + ji;
  }
  o(lt, "escapeXMLToString");
  try {
    typeof Object.defineProperty == "function" ? Object.defineProperty(T.escapeXML, "toString", { value: lt }) : T.escapeXML.toString = lt;
  } catch {
    console.warn("Unable to set escapeXML.toString (is the Function prototype frozen?)");
  }
  T.shallowCopy = function(e, i) {
    if (i = i || {}, e != null)
      for (var t in i)
        ae(i, t) && (t === "__proto__" || t === "constructor" || (e[t] = i[t]));
    return e;
  };
  T.shallowCopyFromList = function(e, i, t) {
    if (t = t || [], i = i || {}, e != null)
      for (var r = 0; r < t.length; r++) {
        var a = t[r];
        if (typeof i[a] < "u") {
          if (!ae(i, a) || a === "__proto__" || a === "constructor")
            continue;
          e[a] = i[a];
        }
      }
    return e;
  };
  T.cache = {
    _data: {},
    set: /* @__PURE__ */ o(function(e, i) {
      this._data[e] = i;
    }, "set"),
    get: /* @__PURE__ */ o(function(e) {
      return this._data[e];
    }, "get"),
    remove: /* @__PURE__ */ o(function(e) {
      delete this._data[e];
    }, "remove"),
    reset: /* @__PURE__ */ o(function() {
      this._data = {};
    }, "reset")
  };
  T.hyphenToCamel = function(e) {
    return e.replace(/-[a-z]/g, function(i) {
      return i[1].toUpperCase();
    });
  };
  T.createNullProtoObjWherePossible = function() {
    return typeof Object.create == "function" ? function() {
      return /* @__PURE__ */ Object.create(null);
    } : { __proto__: null } instanceof Object ? function() {
      return {};
    } : function() {
      return { __proto__: null };
    };
  }();
  T.hasOwnOnlyObject = function(e) {
    var i = T.createNullProtoObjWherePossible();
    for (var t in e)
      ae(e, t) && (i[t] = e[t]);
    return i;
  };
});

// ../node_modules/ejs/package.json
var pt = N((Br, Oi) => {
  Oi.exports = {
    name: "ejs",
    description: "Embedded JavaScript templates",
    keywords: [
      "template",
      "engine",
      "ejs"
    ],
    version: "3.1.10",
    author: "Matthew Eernisse <mde@fleegix.org> (http://fleegix.org)",
    license: "Apache-2.0",
    bin: {
      ejs: "./bin/cli.js"
    },
    main: "./lib/ejs.js",
    jsdelivr: "ejs.min.js",
    unpkg: "ejs.min.js",
    repository: {
      type: "git",
      url: "git://github.com/mde/ejs.git"
    },
    bugs: "https://github.com/mde/ejs/issues",
    homepage: "https://github.com/mde/ejs",
    dependencies: {
      jake: "^10.8.5"
    },
    devDependencies: {
      browserify: "^16.5.1",
      eslint: "^6.8.0",
      "git-directory-deploy": "^1.5.1",
      jsdoc: "^4.0.2",
      "lru-cache": "^4.0.1",
      mocha: "^10.2.0",
      "uglify-js": "^3.3.16"
    },
    engines: {
      node: ">=0.10.0"
    },
    scripts: {
      test: "npx jake test"
    }
  };
});

// ../node_modules/ejs/lib/ejs.js
var vt = N((h) => {
  "use strict";
  var oe = P("fs"), D = P("path"), b = ct(), mt = !1, Ei = pt().version, Si = "<", Pi = ">", Ti = "%", ht = "locals", Ri = "ejs", ki = "(<%%\
|%%>|<%=|<%-|<%_|<%#|<%|%>|-%>|_%>)", yt = [
    "delimiter",
    "scope",
    "context",
    "debug",
    "compileDebug",
    "client",
    "_with",
    "rmWhitespace",
    "strict",
    "filename",
    "async"
  ], Fi = yt.concat("cache"), ut = /^\uFEFF/, ne = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;
  h.cache = b.cache;
  h.fileLoader = oe.readFileSync;
  h.localsName = ht;
  h.promiseImpl = new Function("return this;")().Promise;
  h.resolveInclude = function(e, i, t) {
    var r = D.dirname, a = D.extname, n = D.resolve, s = n(t ? i : r(i), e), l = a(e);
    return l || (s += ".ejs"), s;
  };
  function ft(e, i) {
    var t;
    if (i.some(function(r) {
      return t = h.resolveInclude(e, r, !0), oe.existsSync(t);
    }))
      return t;
  }
  o(ft, "resolvePaths");
  function Li(e, i) {
    var t, r, a = i.views, n = /^[A-Za-z]+:\\|^\//.exec(e);
    if (n && n.length)
      e = e.replace(/^\/*/, ""), Array.isArray(i.root) ? t = ft(e, i.root) : t = h.resolveInclude(e, i.root || "/", !0);
    else if (i.filename && (r = h.resolveInclude(e, i.filename), oe.existsSync(r) && (t = r)), !t && Array.isArray(a) && (t = ft(e, a)), !t &&
    typeof i.includer != "function")
      throw new Error('Could not find the include file "' + i.escapeFunction(e) + '"');
    return t;
  }
  o(Li, "getIncludePath");
  function I(e, i) {
    var t, r = e.filename, a = arguments.length > 1;
    if (e.cache) {
      if (!r)
        throw new Error("cache option requires a filename");
      if (t = h.cache.get(r), t)
        return t;
      a || (i = dt(r).toString().replace(ut, ""));
    } else if (!a) {
      if (!r)
        throw new Error("Internal EJS error: no file name or template provided");
      i = dt(r).toString().replace(ut, "");
    }
    return t = h.compile(i, e), e.cache && h.cache.set(r, t), t;
  }
  o(I, "handleCache");
  function Ai(e, i, t) {
    var r;
    if (t) {
      try {
        r = I(e)(i);
      } catch (a) {
        return t(a);
      }
      t(null, r);
    } else {
      if (typeof h.promiseImpl == "function")
        return new h.promiseImpl(function(a, n) {
          try {
            r = I(e)(i), a(r);
          } catch (s) {
            n(s);
          }
        });
      throw new Error("Please provide a callback function");
    }
  }
  o(Ai, "tryHandleCache");
  function dt(e) {
    return h.fileLoader(e);
  }
  o(dt, "fileLoader");
  function Ci(e, i) {
    var t = b.shallowCopy(b.createNullProtoObjWherePossible(), i);
    if (t.filename = Li(e, t), typeof i.includer == "function") {
      var r = i.includer(e, t.filename);
      if (r && (r.filename && (t.filename = r.filename), r.template))
        return I(t, r.template);
    }
    return I(t);
  }
  o(Ci, "includeFile");
  function gt(e, i, t, r, a) {
    var n = i.split(`
`), s = Math.max(r - 3, 0), l = Math.min(n.length, r + 3), p = a(t), c = n.slice(s, l).map(function(u, d) {
      var x = d + s + 1;
      return (x == r ? " >> " : "    ") + x + "| " + u;
    }).join(`
`);
    throw e.path = p, e.message = (p || "ejs") + ":" + r + `
` + c + `

` + e.message, e;
  }
  o(gt, "rethrow");
  function xt(e) {
    return e.replace(/;(\s*$)/, "$1");
  }
  o(xt, "stripSemi");
  h.compile = /* @__PURE__ */ o(function(i, t) {
    var r;
    return t && t.scope && (mt || (console.warn("`scope` option is deprecated and will be removed in EJS 3"), mt = !0), t.context || (t.context =
    t.scope), delete t.scope), r = new j(i, t), r.compile();
  }, "compile");
  h.render = function(e, i, t) {
    var r = i || b.createNullProtoObjWherePossible(), a = t || b.createNullProtoObjWherePossible();
    return arguments.length == 2 && b.shallowCopyFromList(a, r, yt), I(a, e)(r);
  };
  h.renderFile = function() {
    var e = Array.prototype.slice.call(arguments), i = e.shift(), t, r = { filename: i }, a, n;
    return typeof arguments[arguments.length - 1] == "function" && (t = e.pop()), e.length ? (a = e.shift(), e.length ? b.shallowCopy(r, e.pop()) :
    (a.settings && (a.settings.views && (r.views = a.settings.views), a.settings["view cache"] && (r.cache = !0), n = a.settings["view optio\
ns"], n && b.shallowCopy(r, n)), b.shallowCopyFromList(r, a, Fi)), r.filename = i) : a = b.createNullProtoObjWherePossible(), Ai(r, a, t);
  };
  h.Template = j;
  h.clearCache = function() {
    h.cache.reset();
  };
  function j(e, i) {
    var t = b.hasOwnOnlyObject(i), r = b.createNullProtoObjWherePossible();
    this.templateText = e, this.mode = null, this.truncate = !1, this.currentLine = 1, this.source = "", r.client = t.client || !1, r.escapeFunction =
    t.escape || t.escapeFunction || b.escapeXML, r.compileDebug = t.compileDebug !== !1, r.debug = !!t.debug, r.filename = t.filename, r.openDelimiter =
    t.openDelimiter || h.openDelimiter || Si, r.closeDelimiter = t.closeDelimiter || h.closeDelimiter || Pi, r.delimiter = t.delimiter || h.
    delimiter || Ti, r.strict = t.strict || !1, r.context = t.context, r.cache = t.cache || !1, r.rmWhitespace = t.rmWhitespace, r.root = t.
    root, r.includer = t.includer, r.outputFunctionName = t.outputFunctionName, r.localsName = t.localsName || h.localsName || ht, r.views =
    t.views, r.async = t.async, r.destructuredLocals = t.destructuredLocals, r.legacyInclude = typeof t.legacyInclude < "u" ? !!t.legacyInclude :
    !0, r.strict ? r._with = !1 : r._with = typeof t._with < "u" ? t._with : !0, this.opts = r, this.regex = this.createRegex();
  }
  o(j, "Template");
  j.modes = {
    EVAL: "eval",
    ESCAPED: "escaped",
    RAW: "raw",
    COMMENT: "comment",
    LITERAL: "literal"
  };
  j.prototype = {
    createRegex: /* @__PURE__ */ o(function() {
      var e = ki, i = b.escapeRegExpChars(this.opts.delimiter), t = b.escapeRegExpChars(this.opts.openDelimiter), r = b.escapeRegExpChars(this.
      opts.closeDelimiter);
      return e = e.replace(/%/g, i).replace(/</g, t).replace(/>/g, r), new RegExp(e);
    }, "createRegex"),
    compile: /* @__PURE__ */ o(function() {
      var e, i, t = this.opts, r = "", a = "", n = t.escapeFunction, s, l = t.filename ? JSON.stringify(t.filename) : "undefined";
      if (!this.source) {
        if (this.generateSource(), r += `  var __output = "";
  function __append(s) { if (s !== undefined && s !== null) __output += s }
`, t.outputFunctionName) {
          if (!ne.test(t.outputFunctionName))
            throw new Error("outputFunctionName is not a valid JS identifier.");
          r += "  var " + t.outputFunctionName + ` = __append;
`;
        }
        if (t.localsName && !ne.test(t.localsName))
          throw new Error("localsName is not a valid JS identifier.");
        if (t.destructuredLocals && t.destructuredLocals.length) {
          for (var p = "  var __locals = (" + t.localsName + ` || {}),
`, c = 0; c < t.destructuredLocals.length; c++) {
            var u = t.destructuredLocals[c];
            if (!ne.test(u))
              throw new Error("destructuredLocals[" + c + "] is not a valid JS identifier.");
            c > 0 && (p += `,
  `), p += u + " = __locals." + u;
          }
          r += p + `;
`;
        }
        t._with !== !1 && (r += "  with (" + t.localsName + ` || {}) {
`, a += `  }
`), a += `  return __output;
`, this.source = r + this.source + a;
      }
      t.compileDebug ? e = `var __line = 1
  , __lines = ` + JSON.stringify(this.templateText) + `
  , __filename = ` + l + `;
try {
` + this.source + `} catch (e) {
  rethrow(e, __lines, __filename, __line, escapeFn);
}
` : e = this.source, t.client && (e = "escapeFn = escapeFn || " + n.toString() + `;
` + e, t.compileDebug && (e = "rethrow = rethrow || " + gt.toString() + `;
` + e)), t.strict && (e = `"use strict";
` + e), t.debug && console.log(e), t.compileDebug && t.filename && (e = e + `
//# sourceURL=` + l + `
`);
      try {
        if (t.async)
          try {
            s = new Function("return (async function(){}).constructor;")();
          } catch (m) {
            throw m instanceof SyntaxError ? new Error("This environment does not support async/await") : m;
          }
        else
          s = Function;
        i = new s(t.localsName + ", escapeFn, include, rethrow", e);
      } catch (m) {
        throw m instanceof SyntaxError && (t.filename && (m.message += " in " + t.filename), m.message += ` while compiling ejs

`, m.message += `If the above error is not helpful, you may want to try EJS-Lint:
`, m.message += "https://github.com/RyanZim/EJS-Lint", t.async || (m.message += `
`, m.message += "Or, if you meant to create an async function, pass `async: true` as an option.")), m;
      }
      var d = t.client ? i : /* @__PURE__ */ o(function(f) {
        var y = /* @__PURE__ */ o(function(v, _) {
          var O = b.shallowCopy(b.createNullProtoObjWherePossible(), f);
          return _ && (O = b.shallowCopy(O, _)), Ci(v, t)(O);
        }, "include");
        return i.apply(
          t.context,
          [f || b.createNullProtoObjWherePossible(), n, y, gt]
        );
      }, "anonymous");
      if (t.filename && typeof Object.defineProperty == "function") {
        var x = t.filename, g = D.basename(x, D.extname(x));
        try {
          Object.defineProperty(d, "name", {
            value: g,
            writable: !1,
            enumerable: !1,
            configurable: !0
          });
        } catch {
        }
      }
      return d;
    }, "compile"),
    generateSource: /* @__PURE__ */ o(function() {
      var e = this.opts;
      e.rmWhitespace && (this.templateText = this.templateText.replace(/[\r\n]+/g, `
`).replace(/^\s+|\s+$/gm, "")), this.templateText = this.templateText.replace(/[ \t]*<%_/gm, "<%_").replace(/_%>[ \t]*/gm, "_%>");
      var i = this, t = this.parseTemplateText(), r = this.opts.delimiter, a = this.opts.openDelimiter, n = this.opts.closeDelimiter;
      t && t.length && t.forEach(function(s, l) {
        var p;
        if (s.indexOf(a + r) === 0 && s.indexOf(a + r + r) !== 0 && (p = t[l + 2], !(p == r + n || p == "-" + r + n || p == "_" + r + n)))
          throw new Error('Could not find matching close tag for "' + s + '".');
        i.scanLine(s);
      });
    }, "generateSource"),
    parseTemplateText: /* @__PURE__ */ o(function() {
      for (var e = this.templateText, i = this.regex, t = i.exec(e), r = [], a; t; )
        a = t.index, a !== 0 && (r.push(e.substring(0, a)), e = e.slice(a)), r.push(t[0]), e = e.slice(t[0].length), t = i.exec(e);
      return e && r.push(e), r;
    }, "parseTemplateText"),
    _addOutput: /* @__PURE__ */ o(function(e) {
      if (this.truncate && (e = e.replace(/^(?:\r\n|\r|\n)/, ""), this.truncate = !1), !e)
        return e;
      e = e.replace(/\\/g, "\\\\"), e = e.replace(/\n/g, "\\n"), e = e.replace(/\r/g, "\\r"), e = e.replace(/"/g, '\\"'), this.source += '  \
  ; __append("' + e + `")
`;
    }, "_addOutput"),
    scanLine: /* @__PURE__ */ o(function(e) {
      var i = this, t = this.opts.delimiter, r = this.opts.openDelimiter, a = this.opts.closeDelimiter, n = 0;
      switch (n = e.split(`
`).length - 1, e) {
        case r + t:
        case r + t + "_":
          this.mode = j.modes.EVAL;
          break;
        case r + t + "=":
          this.mode = j.modes.ESCAPED;
          break;
        case r + t + "-":
          this.mode = j.modes.RAW;
          break;
        case r + t + "#":
          this.mode = j.modes.COMMENT;
          break;
        case r + t + t:
          this.mode = j.modes.LITERAL, this.source += '    ; __append("' + e.replace(r + t + t, r + t) + `")
`;
          break;
        case t + t + a:
          this.mode = j.modes.LITERAL, this.source += '    ; __append("' + e.replace(t + t + a, t + a) + `")
`;
          break;
        case t + a:
        case "-" + t + a:
        case "_" + t + a:
          this.mode == j.modes.LITERAL && this._addOutput(e), this.mode = null, this.truncate = e.indexOf("-") === 0 || e.indexOf("_") === 0;
          break;
        default:
          if (this.mode) {
            switch (this.mode) {
              case j.modes.EVAL:
              case j.modes.ESCAPED:
              case j.modes.RAW:
                e.lastIndexOf("//") > e.lastIndexOf(`
`) && (e += `
`);
            }
            switch (this.mode) {
              // Just executing code
              case j.modes.EVAL:
                this.source += "    ; " + e + `
`;
                break;
              // Exec, esc, and output
              case j.modes.ESCAPED:
                this.source += "    ; __append(escapeFn(" + xt(e) + `))
`;
                break;
              // Exec and output
              case j.modes.RAW:
                this.source += "    ; __append(" + xt(e) + `)
`;
                break;
              case j.modes.COMMENT:
                break;
              // Literal <%% mode, append as raw output
              case j.modes.LITERAL:
                this._addOutput(e);
                break;
            }
          } else
            this._addOutput(e);
      }
      i.opts.compileDebug && n && (this.currentLine += n, this.source += "    ; __line = " + this.currentLine + `
`);
    }, "scanLine")
  };
  h.escapeXML = b.escapeXML;
  h.__express = h.renderFile;
  h.VERSION = Ei;
  h.name = Ri;
  typeof window < "u" && (window.ejs = h);
});

// src/builder-manager/index.ts
import { cp as or, rm as sr, writeFile as Ft } from "node:fs/promises";
import { dirname as Lt, join as k, parse as lr } from "node:path";
import { stringifyProcessEnvs as cr } from "storybook/internal/common";
import { globalsModuleInfoMap as pr } from "storybook/internal/manager/globals-module-info";
import { logger as ue } from "storybook/internal/node-logger";

// ../node_modules/@fal-works/esbuild-plugin-global-externals/lib/module-info.js
var ge = /* @__PURE__ */ o((e) => {
  let {
    type: i = "esm",
    varName: t,
    namedExports: r = null,
    defaultExport: a = !0
  } = typeof e == "string" ? { varName: e } : e;
  return { type: i, varName: t, namedExports: r, defaultExport: a };
}, "normalizeModuleInfo");

// ../node_modules/@fal-works/esbuild-plugin-global-externals/lib/on-load.js
var zt = /* @__PURE__ */ o((e) => `module.exports = ${e};`, "createCjsContents");
var qt = /* @__PURE__ */ o((e, i, t) => {
  let r = t ? [`export default ${e};`] : [];
  if (i && i.length) {
    let a = [...new Set(i)].join(", ");
    r.push(`const { ${a} } = ${e};`), r.push(`export { ${a} };`);
  }
  return r.join(`
`);
}, "createEsmContents"), xe = /* @__PURE__ */ o((e) => {
  let { type: i, varName: t, namedExports: r, defaultExport: a } = e;
  switch (i) {
    case "esm":
      return qt(t, r, a);
    case "cjs":
      return zt(t);
  }
}, "createContents");

// ../node_modules/@fal-works/esbuild-plugin-global-externals/lib/with-reg-exp.js
var X = "global-externals", K = /* @__PURE__ */ o((e) => {
  let { modulePathFilter: i, getModuleInfo: t } = e;
  return {
    name: X,
    setup(r) {
      r.onResolve({ filter: i }, (a) => ({
        path: a.path,
        namespace: X
      })), r.onLoad({ filter: /.*/, namespace: X }, (a) => {
        let n = a.path, s = ge(t(n));
        return { contents: xe(s) };
      });
    }
  };
}, "globalExternalsWithRegExp");

// ../node_modules/@fal-works/esbuild-plugin-global-externals/lib/with-object.js
var Z = /* @__PURE__ */ o((e) => {
  let i = {
    modulePathFilter: new RegExp(`^(?:${Object.keys(e).join("|")})$`),
    getModuleInfo: /* @__PURE__ */ o((t) => e[t], "getModuleInfo")
  };
  return K(i);
}, "globalExternals");

// src/builder-manager/index.ts
var At = V(Ge(), 1), fe = V(ot(), 1);

// src/shared/constants/environments-support.ts
var re = [
  "chrome131",
  "edge134",
  "firefox136",
  "safari18.3",
  "ios18.3",
  "opera117"
], hi = "node20", st = {
  // React Native does not support class static blocks without a specific babel plugin
  "class-static-blocks": !1
};

// src/builder-manager/utils/data.ts
import { basename as Mi } from "node:path";
import { getRefs as zi } from "storybook/internal/common";

// src/builder-manager/utils/template.ts
var wt = V(vt(), 1);
import { readFile as Ni } from "node:fs/promises";
import { dirname as Di, join as Ii } from "node:path";
var se = /* @__PURE__ */ o(async (e) => Ii(
  Di(P.resolve("storybook/internal/package.json")),
  "assets/server",
  e
), "getTemplatePath"), bt = /* @__PURE__ */ o(async (e) => {
  let i = await se(e);
  return Ni(i, { encoding: "utf8" });
}, "readTemplate");
var le = /* @__PURE__ */ o(async (e, i, t, r, a, n, s, l, p, c, u, { versionCheck: d, previewUrl: x, configType: g, ignorePreview: m }, f) => {
  let y = await i, v = await e, _ = Object.entries(f).reduce(
    (O, [w, E]) => ({ ...O, [w]: JSON.stringify(E) }),
    {}
  );
  return (0, wt.render)(v, {
    title: y ? `${y} - Storybook` : "Storybook",
    files: { js: n, css: a },
    favicon: await t,
    globals: {
      FEATURES: JSON.stringify(await s, null, 2),
      REFS: JSON.stringify(await l, null, 2),
      LOGLEVEL: JSON.stringify(await p, null, 2),
      DOCS_OPTIONS: JSON.stringify(await c, null, 2),
      CONFIG_TYPE: JSON.stringify(await g, null, 2),
      // These two need to be double stringified because the UI expects a string
      VERSIONCHECK: JSON.stringify(JSON.stringify(d), null, 2),
      PREVIEW_URL: JSON.stringify(x, null, 2),
      // global preview URL
      TAGS_OPTIONS: JSON.stringify(await u, null, 2),
      ..._
    },
    head: await r || "",
    ignorePreview: m
  });
}, "renderHTML");

// src/builder-manager/utils/data.ts
var ce = /* @__PURE__ */ o(async (e) => {
  let i = zi(e), t = e.presets.apply("favicon").then((x) => Mi(x)), r = e.presets.apply("features"), a = e.presets.apply("logLevel"), n = e.
  presets.apply("title"), s = e.presets.apply("docs", {}), l = e.presets.apply("tags", {}), p = bt("template.ejs"), c = e.presets.apply("man\
agerHead"), [u, d] = await Promise.all([
    //
    jt.get(),
    _t(e)
  ]);
  return {
    refs: i,
    features: r,
    title: n,
    docsOptions: s,
    template: p,
    customHead: c,
    instance: u,
    config: d,
    logLevel: a,
    favicon: t,
    tagsOptions: l
  };
}, "getData");

// src/builder-manager/utils/files.ts
import { existsSync as qi } from "node:fs";
import { mkdir as Wi, writeFile as $i } from "node:fs/promises";
import { dirname as Bi, join as Hi, normalize as Ji } from "node:path";

// ../node_modules/slash/index.js
function M(e) {
  return e.startsWith("\\\\?\\") ? e : e.replace(/\\/g, "/");
}
o(M, "slash");

// src/builder-manager/utils/files.ts
async function pe(e, i) {
  let t = await Promise.all(
    i?.map(async (n) => {
      let { location: s, url: l } = Ui(n, e);
      if (!qi(s)) {
        let p = Bi(s);
        await Wi(p, { recursive: !0 });
      }
      return await $i(s, n.contents), l;
    }) || []
  ), r = t.filter((n) => n.endsWith(".js"));
  return { cssFiles: t.filter((n) => n.endsWith(".css")), jsFiles: r };
}
o(pe, "readOrderedFiles");
function Ui(e, i) {
  let t = e.path.replace(i, ""), r = Ji(Hi(i, t)), a = `./sb-addons${M(t).split("/").map(encodeURIComponent).join("/")}`;
  return { location: r, url: a };
}
o(Ui, "sanitizePath");

// src/builder-manager/utils/framework.ts
import { sep as Gi } from "node:path";
import {
  extractProperRendererNameFromFramework as Ot,
  getFrameworkName as Vi
} from "storybook/internal/common";
var Et = /* @__PURE__ */ o((e) => {
  if (e)
    return typeof e == "string" ? e : e.name;
}, "pluckNameFromConfigProperty"), St = /* @__PURE__ */ o((e) => e.replaceAll(Gi, "/"), "normalizePath"), Xi = /* @__PURE__ */ o((e) => St(e).
match(/(@storybook\/.*)$/)?.[1], "pluckStorybookPackageFromPath"), Ki = /* @__PURE__ */ o((e) => St(e).split("node_modules/")[1] ?? e, "pluc\
kThirdPartyPackageFromPath"), me = /* @__PURE__ */ o(async (e) => {
  let i = {}, { builder: t } = await e.presets.apply("core"), r = await Vi(e);
  await Ot(r) && (i.STORYBOOK_RENDERER = await Ot(r) ?? void 0);
  let n = Et(t);
  n && (i.STORYBOOK_BUILDER = Xi(n) ?? Ki(n));
  let s = Et(await e.presets.apply("framework"));
  return s && (i.STORYBOOK_FRAMEWORK = s), i;
}, "buildFrameworkGlobalsFromOptions");

// src/builder-manager/utils/managerEntries.ts
import { existsSync as Zi } from "node:fs";
import { mkdir as Yi, writeFile as Qi } from "node:fs/promises";
import { dirname as er, join as Pt, parse as tr, relative as ir, sep as rr } from "node:path";
import { resolvePathInStorybookCache as ar } from "storybook/internal/common";
var Tt = /* @__PURE__ */ o((e) => e.replaceAll(".", "").replaceAll("@", "").replaceAll(rr, "-").replaceAll("/", "-").replaceAll(new RegExp(/^(-)+/g),
""), "sanitizeBase"), nr = /* @__PURE__ */ o((e) => {
  let i = e.split(/-?node_modules-?/);
  return i[i.length - 1].replaceAll("storybook-addon-", "").replaceAll("dist-", "");
}, "sanitizeFinal");
async function Rt(e, i) {
  return Promise.all(
    e.map(async (t, r) => {
      let { name: a, dir: n } = tr(t), s = ar("sb-manager", i);
      if (!s)
        throw new Error("Could not create/find cache directory");
      let l = ir(process.cwd(), n), p = Pt(
        s,
        nr(Pt(`${Tt(l)}-${r}`, `${Tt(a)}-bundle.js`))
      );
      if (!Zi(p)) {
        let c = er(p);
        await Yi(c, { recursive: !0 });
      }
      return await Qi(p, `import '${M(t).replaceAll(/'/g, "\\'")}';`), p;
    })
  );
}
o(Rt, "wrapManagerEntries");

// src/builder-manager/utils/safeResolve.ts
var kt = /* @__PURE__ */ o((e) => {
  try {
    return Promise.resolve(P.resolve(e));
  } catch {
    return Promise.resolve(!1);
  }
}, "safeResolve");

// src/builder-manager/index.ts
var mr = /^\/($|\?)/, L, A, _t = /* @__PURE__ */ o(async (e) => {
  let [i, t, r, a] = await Promise.all([
    e.presets.apply("managerEntries", []),
    kt(k(e.configDir, "manager")),
    se("addon.tsconfig.json"),
    e.presets.apply("env")
  ]), n = t ? [...i, t] : i;
  return {
    entryPoints: await Rt(n, e.cacheKey),
    outdir: k(e.outputDir || "./", "sb-addons"),
    format: "iife",
    write: !1,
    ignoreAnnotations: !0,
    resolveExtensions: [".ts", ".tsx", ".mjs", ".js", ".jsx"],
    outExtension: { ".js": ".js" },
    loader: {
      ".js": "jsx",
      // media
      ".png": "dataurl",
      ".gif": "dataurl",
      ".jpg": "dataurl",
      ".jpeg": "dataurl",
      ".svg": "dataurl",
      ".webp": "dataurl",
      ".webm": "dataurl",
      ".mp3": "dataurl",
      // modern fonts
      ".woff2": "dataurl",
      // legacy font formats
      ".woff": "dataurl",
      ".eot": "dataurl",
      ".ttf": "dataurl"
    },
    target: re,
    supported: st,
    platform: "browser",
    bundle: !0,
    minify: !1,
    minifyWhitespace: !1,
    minifyIdentifiers: !1,
    minifySyntax: !0,
    metafile: !1,
    // turn this on to assist with debugging the bundling of managerEntries
    // treeShaking: true,
    sourcemap: !1,
    conditions: ["browser", "module", "default"],
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    jsx: "transform",
    jsxImportSource: "react",
    tsconfig: r,
    legalComments: "external",
    plugins: [Z(pr), (0, At.pnpPlugin)()],
    banner: {
      js: "try{"
    },
    footer: {
      js: '}catch(e){ console.error("[Storybook] One of your manager-entries failed: " + import.meta.url, e); }'
    },
    define: {
      "process.env": JSON.stringify(a),
      ...cr(a),
      global: "window",
      module: "{}"
    }
  };
}, "getConfig"), jt = {
  get: /* @__PURE__ */ o(async () => {
    let { build: e } = await import("esbuild");
    return e;
  }, "get")
}, ur = /* @__PURE__ */ o(async function* ({
  startTime: i,
  options: t,
  router: r
}) {
  t.quiet || ue.info("=> Starting manager..");
  let {
    config: a,
    favicon: n,
    customHead: s,
    features: l,
    instance: p,
    refs: c,
    template: u,
    title: d,
    logLevel: x,
    docsOptions: g,
    tagsOptions: m
  } = await ce(t);
  yield;
  let f = a.outdir;
  await sr(f, { recursive: !0, force: !0 }), yield, L = await p({
    ...a
  }), yield;
  let y = k(
    Lt(P.resolve("storybook/internal/package.json")),
    "dist",
    "manager"
  );
  r.use(
    "/sb-addons",
    (0, fe.default)(f, {
      maxAge: 3e5,
      dev: !0,
      immutable: !0
    })
  ), r.use(
    "/sb-manager",
    (0, fe.default)(y, {
      maxAge: 3e5,
      dev: !0,
      immutable: !0
    })
  );
  let { cssFiles: v, jsFiles: _ } = await pe(f, L?.outputFiles);
  L.metafile && t.outputDir && await Ft(
    k(t.outputDir, "metafile.json"),
    JSON.stringify(L.metafile, null, 2)
  );
  let O = await me(t);
  yield;
  let w = await le(
    u,
    d,
    n,
    s,
    v,
    _,
    l,
    c,
    x,
    g,
    m,
    t,
    O
  );
  return yield, r.use("/", ({ url: E }, S, R) => {
    E && mr.test(E) ? (S.statusCode = 200, S.setHeader("Content-Type", "text/html"), S.write(w), S.end()) : R();
  }), r.use("/index.html", (E, S) => {
    S.statusCode = 200, S.setHeader("Content-Type", "text/html"), S.write(w), S.end();
  }), {
    bail: dr,
    stats: {
      toJson: /* @__PURE__ */ o(() => ({}), "toJson")
    },
    totalTime: process.hrtime(i)
  };
}, "starterGeneratorFn"), fr = /* @__PURE__ */ o(async function* ({ startTime: i, options: t }) {
  if (!t.outputDir)
    throw new Error("outputDir is required");
  ue.info("=> Building manager..");
  let {
    config: r,
    customHead: a,
    favicon: n,
    features: s,
    instance: l,
    refs: p,
    template: c,
    title: u,
    logLevel: d,
    docsOptions: x,
    tagsOptions: g
  } = await ce(t);
  yield;
  let m = r.outdir, f = k(
    Lt(P.resolve("storybook/internal/package.json")),
    "dist",
    "manager"
  ), y = k(t.outputDir, "sb-manager");
  L = await l({
    ...r,
    minify: !0
  }), yield;
  let v = or(f, y, {
    filter: /* @__PURE__ */ o((S) => {
      let { ext: R } = lr(S);
      return R ? R === ".js" : !0;
    }, "filter"),
    recursive: !0
  }), { cssFiles: _, jsFiles: O } = await pe(m, L?.outputFiles), w = await me(t);
  yield;
  let E = await le(
    c,
    u,
    n,
    a,
    _,
    O,
    s,
    p,
    d,
    x,
    g,
    t,
    w
  );
  return await Promise.all([Ft(k(t.outputDir, "index.html"), E), v]), ue.trace({ message: "=> Manager built", time: process.hrtime(i) }), {
    toJson: /* @__PURE__ */ o(() => ({}), "toJson")
  };
}, "builderGeneratorFn"), dr = /* @__PURE__ */ o(async () => {
  if (A)
    try {
      await A.throw(new Error());
    } catch {
    }
}, "bail"), Da = /* @__PURE__ */ o(async (e) => {
  A = ur(e);
  let i;
  do
    i = await A.next();
  while (!i.done);
  return i.value;
}, "start"), Ia = /* @__PURE__ */ o(async (e) => {
  A = fr(e);
  let i;
  do
    i = await A.next();
  while (!i.done);
  return i.value;
}, "build"), Ma = [], za = [];
export {
  re as BROWSER_TARGETS,
  hi as NODE_TARGET,
  dr as bail,
  Ia as build,
  Ma as corePresets,
  jt as executor,
  _t as getConfig,
  za as overridePresets,
  Da as start
};
