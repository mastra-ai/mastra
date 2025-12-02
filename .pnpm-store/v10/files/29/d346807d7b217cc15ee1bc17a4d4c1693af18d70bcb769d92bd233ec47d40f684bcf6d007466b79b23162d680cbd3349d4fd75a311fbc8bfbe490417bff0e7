"use strict";
var Mt = Object.create;
var Z = Object.defineProperty;
var Ut = Object.getOwnPropertyDescriptor;
var Gt = Object.getOwnPropertyNames;
var kt = Object.getPrototypeOf, Wt = Object.prototype.hasOwnProperty;
var s = (t, e) => Z(t, "name", { value: e, configurable: !0 });
var ke = (t, e) => () => (e || t((e = { exports: {} }).exports, e), e.exports), qt = (t, e) => {
  for (var r in e)
    Z(t, r, { get: e[r], enumerable: !0 });
}, We = (t, e, r, n) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let o of Gt(e))
      !Wt.call(t, o) && o !== r && Z(t, o, { get: () => e[o], enumerable: !(n = Ut(e, o)) || n.enumerable });
  return t;
};
var ee = (t, e, r) => (r = t != null ? Mt(kt(t)) : {}, We(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  e || !t || !t.__esModule ? Z(r, "default", { value: t, enumerable: !0 }) : r,
  t
)), Bt = (t) => We(Z({}, "__esModule", { value: !0 }), t);

// ../node_modules/ts-dedent/dist/index.js
var Be = ke((te) => {
  "use strict";
  Object.defineProperty(te, "__esModule", { value: !0 });
  te.dedent = void 0;
  function qe(t) {
    for (var e = [], r = 1; r < arguments.length; r++)
      e[r - 1] = arguments[r];
    var n = Array.from(typeof t == "string" ? [t] : t);
    n[n.length - 1] = n[n.length - 1].replace(/\r?\n([\t ]*)$/, "");
    var o = n.reduce(function(c, i) {
      var l = i.match(/\n([\t ]+|(?!\s).)/g);
      return l ? c.concat(l.map(function(d) {
        var u, y;
        return (y = (u = d.match(/[\t ]/g)) === null || u === void 0 ? void 0 : u.length) !== null && y !== void 0 ? y : 0;
      })) : c;
    }, []);
    if (o.length) {
      var p = new RegExp(`
[	 ]{` + Math.min.apply(Math, o) + "}", "g");
      n = n.map(function(c) {
        return c.replace(p, `
`);
      });
    }
    n[0] = n[0].replace(/^\r?\n/, "");
    var a = n[0];
    return e.forEach(function(c, i) {
      var l = a.match(/(?:^|\n)( *)$/), d = l ? l[1] : "", u = c;
      typeof c == "string" && c.includes(`
`) && (u = String(c).split(`
`).map(function(y, g) {
        return g === 0 ? y : "" + d + y;
      }).join(`
`)), a += u + n[i + 1];
    }), a;
  }
  s(qe, "dedent");
  te.dedent = qe;
  te.default = qe;
});

// ../node_modules/telejson/dist/index.js
var Ne = ke((ms, Et) => {
  "use strict";
  var zt = Object.create, fe = Object.defineProperty, Yt = Object.getOwnPropertyDescriptor, Ke = Object.getOwnPropertyNames, Kt = Object.getPrototypeOf,
  Xt = Object.prototype.hasOwnProperty, f = /* @__PURE__ */ s((t, e) => /* @__PURE__ */ s(function() {
    return e || (0, t[Ke(t)[0]])((e = { exports: {} }).exports, e), e.exports;
  }, "__require"), "__commonJS"), Qt = /* @__PURE__ */ s((t, e) => {
    for (var r in e)
      fe(t, r, { get: e[r], enumerable: !0 });
  }, "__export"), Xe = /* @__PURE__ */ s((t, e, r, n) => {
    if (e && typeof e == "object" || typeof e == "function")
      for (let o of Ke(e))
        !Xt.call(t, o) && o !== r && fe(t, o, { get: /* @__PURE__ */ s(() => e[o], "get"), enumerable: !(n = Yt(e, o)) || n.enumerable });
    return t;
  }, "__copyProps"), _e = /* @__PURE__ */ s((t, e, r) => (r = t != null ? zt(Kt(t)) : {}, Xe(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    e || !t || !t.__esModule ? fe(r, "default", { value: t, enumerable: !0 }) : r,
    t
  )), "__toESM"), Zt = /* @__PURE__ */ s((t) => Xe(fe({}, "__esModule", { value: !0 }), t), "__toCommonJS"), Qe = f({
    "node_modules/.pnpm/es-object-atoms@1.1.1/node_modules/es-object-atoms/index.js"(t, e) {
      "use strict";
      e.exports = Object;
    }
  }), er = f({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/index.js"(t, e) {
      "use strict";
      e.exports = Error;
    }
  }), tr = f({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/eval.js"(t, e) {
      "use strict";
      e.exports = EvalError;
    }
  }), rr = f({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/range.js"(t, e) {
      "use strict";
      e.exports = RangeError;
    }
  }), nr = f({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/ref.js"(t, e) {
      "use strict";
      e.exports = ReferenceError;
    }
  }), or = f({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/syntax.js"(t, e) {
      "use strict";
      e.exports = SyntaxError;
    }
  }), be = f({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/type.js"(t, e) {
      "use strict";
      e.exports = TypeError;
    }
  }), sr = f({
    "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/uri.js"(t, e) {
      "use strict";
      e.exports = URIError;
    }
  }), ir = f({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/abs.js"(t, e) {
      "use strict";
      e.exports = Math.abs;
    }
  }), ar = f({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/floor.js"(t, e) {
      "use strict";
      e.exports = Math.floor;
    }
  }), pr = f({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/max.js"(t, e) {
      "use strict";
      e.exports = Math.max;
    }
  }), cr = f({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/min.js"(t, e) {
      "use strict";
      e.exports = Math.min;
    }
  }), lr = f({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/pow.js"(t, e) {
      "use strict";
      e.exports = Math.pow;
    }
  }), ur = f({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/round.js"(t, e) {
      "use strict";
      e.exports = Math.round;
    }
  }), fr = f({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/isNaN.js"(t, e) {
      "use strict";
      e.exports = Number.isNaN || /* @__PURE__ */ s(function(n) {
        return n !== n;
      }, "isNaN2");
    }
  }), dr = f({
    "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/sign.js"(t, e) {
      "use strict";
      var r = fr();
      e.exports = /* @__PURE__ */ s(function(o) {
        return r(o) || o === 0 ? o : o < 0 ? -1 : 1;
      }, "sign");
    }
  }), yr = f({
    "node_modules/.pnpm/gopd@1.2.0/node_modules/gopd/gOPD.js"(t, e) {
      "use strict";
      e.exports = Object.getOwnPropertyDescriptor;
    }
  }), Se = f({
    "node_modules/.pnpm/gopd@1.2.0/node_modules/gopd/index.js"(t, e) {
      "use strict";
      var r = yr();
      if (r)
        try {
          r([], "length");
        } catch {
          r = null;
        }
      e.exports = r;
    }
  }), hr = f({
    "node_modules/.pnpm/es-define-property@1.0.1/node_modules/es-define-property/index.js"(t, e) {
      "use strict";
      var r = Object.defineProperty || !1;
      if (r)
        try {
          r({}, "a", { value: 1 });
        } catch {
          r = !1;
        }
      e.exports = r;
    }
  }), Ze = f({
    "node_modules/.pnpm/has-symbols@1.1.0/node_modules/has-symbols/shams.js"(t, e) {
      "use strict";
      e.exports = /* @__PURE__ */ s(function() {
        if (typeof Symbol != "function" || typeof Object.getOwnPropertySymbols != "function")
          return !1;
        if (typeof Symbol.iterator == "symbol")
          return !0;
        var n = {}, o = Symbol("test"), p = Object(o);
        if (typeof o == "string" || Object.prototype.toString.call(o) !== "[object Symbol]" || Object.prototype.toString.call(p) !== "[objec\
t Symbol]")
          return !1;
        var a = 42;
        n[o] = a;
        for (var c in n)
          return !1;
        if (typeof Object.keys == "function" && Object.keys(n).length !== 0 || typeof Object.getOwnPropertyNames == "function" && Object.getOwnPropertyNames(
        n).length !== 0)
          return !1;
        var i = Object.getOwnPropertySymbols(n);
        if (i.length !== 1 || i[0] !== o || !Object.prototype.propertyIsEnumerable.call(n, o))
          return !1;
        if (typeof Object.getOwnPropertyDescriptor == "function") {
          var l = (
            /** @type {PropertyDescriptor} */
            Object.getOwnPropertyDescriptor(n, o)
          );
          if (l.value !== a || l.enumerable !== !0)
            return !1;
        }
        return !0;
      }, "hasSymbols");
    }
  }), et = f({
    "node_modules/.pnpm/has-symbols@1.1.0/node_modules/has-symbols/index.js"(t, e) {
      "use strict";
      var r = typeof Symbol < "u" && Symbol, n = Ze();
      e.exports = /* @__PURE__ */ s(function() {
        return typeof r != "function" || typeof Symbol != "function" || typeof r("foo") != "symbol" || typeof Symbol("bar") != "symbol" ? !1 :
        n();
      }, "hasNativeSymbols");
    }
  }), tt = f({
    "node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/Reflect.getPrototypeOf.js"(t, e) {
      "use strict";
      e.exports = typeof Reflect < "u" && Reflect.getPrototypeOf || null;
    }
  }), rt = f({
    "node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/Object.getPrototypeOf.js"(t, e) {
      "use strict";
      var r = Qe();
      e.exports = r.getPrototypeOf || null;
    }
  }), gr = f({
    "node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/implementation.js"(t, e) {
      "use strict";
      var r = "Function.prototype.bind called on incompatible ", n = Object.prototype.toString, o = Math.max, p = "[object Function]", a = /* @__PURE__ */ s(
      function(d, u) {
        for (var y = [], g = 0; g < d.length; g += 1)
          y[g] = d[g];
        for (var h = 0; h < u.length; h += 1)
          y[h + d.length] = u[h];
        return y;
      }, "concatty2"), c = /* @__PURE__ */ s(function(d, u) {
        for (var y = [], g = u || 0, h = 0; g < d.length; g += 1, h += 1)
          y[h] = d[g];
        return y;
      }, "slicy2"), i = /* @__PURE__ */ s(function(l, d) {
        for (var u = "", y = 0; y < l.length; y += 1)
          u += l[y], y + 1 < l.length && (u += d);
        return u;
      }, "joiny");
      e.exports = /* @__PURE__ */ s(function(d) {
        var u = this;
        if (typeof u != "function" || n.apply(u) !== p)
          throw new TypeError(r + u);
        for (var y = c(arguments, 1), g, h = /* @__PURE__ */ s(function() {
          if (this instanceof g) {
            var I = u.apply(
              this,
              a(y, arguments)
            );
            return Object(I) === I ? I : this;
          }
          return u.apply(
            d,
            a(y, arguments)
          );
        }, "binder"), C = o(0, u.length - y.length), w = [], A = 0; A < C; A++)
          w[A] = "$" + A;
        if (g = Function("binder", "return function (" + i(w, ",") + "){ return binder.apply(this,arguments); }")(h), u.prototype) {
          var L = /* @__PURE__ */ s(function() {
          }, "Empty2");
          L.prototype = u.prototype, g.prototype = new L(), L.prototype = null;
        }
        return g;
      }, "bind");
    }
  }), de = f({
    "node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/index.js"(t, e) {
      "use strict";
      var r = gr();
      e.exports = Function.prototype.bind || r;
    }
  }), Te = f({
    "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/functionCall.js"(t, e) {
      "use strict";
      e.exports = Function.prototype.call;
    }
  }), nt = f({
    "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/functionApply.js"(t, e) {
      "use strict";
      e.exports = Function.prototype.apply;
    }
  }), mr = f({
    "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/reflectApply.js"(t, e) {
      "use strict";
      e.exports = typeof Reflect < "u" && Reflect && Reflect.apply;
    }
  }), vr = f({
    "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/actualApply.js"(t, e) {
      "use strict";
      var r = de(), n = nt(), o = Te(), p = mr();
      e.exports = p || r.call(o, n);
    }
  }), ot = f({
    "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/index.js"(t, e) {
      "use strict";
      var r = de(), n = be(), o = Te(), p = vr();
      e.exports = /* @__PURE__ */ s(function(c) {
        if (c.length < 1 || typeof c[0] != "function")
          throw new n("a function is required");
        return p(r, o, c);
      }, "callBindBasic");
    }
  }), Er = f({
    "node_modules/.pnpm/dunder-proto@1.0.1/node_modules/dunder-proto/get.js"(t, e) {
      "use strict";
      var r = ot(), n = Se(), o;
      try {
        o = /** @type {{ __proto__?: typeof Array.prototype }} */
        [].__proto__ === Array.prototype;
      } catch (i) {
        if (!i || typeof i != "object" || !("code" in i) || i.code !== "ERR_PROTO_ACCESS")
          throw i;
      }
      var p = !!o && n && n(
        Object.prototype,
        /** @type {keyof typeof Object.prototype} */
        "__proto__"
      ), a = Object, c = a.getPrototypeOf;
      e.exports = p && typeof p.get == "function" ? r([p.get]) : typeof c == "function" ? (
        /** @type {import('./get')} */
        /* @__PURE__ */ s(function(l) {
          return c(l == null ? l : a(l));
        }, "getDunder")
      ) : !1;
    }
  }), _r = f({
    "node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/index.js"(t, e) {
      "use strict";
      var r = tt(), n = rt(), o = Er();
      e.exports = r ? /* @__PURE__ */ s(function(a) {
        return r(a);
      }, "getProto") : n ? /* @__PURE__ */ s(function(a) {
        if (!a || typeof a != "object" && typeof a != "function")
          throw new TypeError("getProto: not an object");
        return n(a);
      }, "getProto") : o ? /* @__PURE__ */ s(function(a) {
        return o(a);
      }, "getProto") : null;
    }
  }), st = f({
    "node_modules/.pnpm/hasown@2.0.2/node_modules/hasown/index.js"(t, e) {
      "use strict";
      var r = Function.prototype.call, n = Object.prototype.hasOwnProperty, o = de();
      e.exports = o.call(r, n);
    }
  }), br = f({
    "node_modules/.pnpm/get-intrinsic@1.3.0/node_modules/get-intrinsic/index.js"(t, e) {
      "use strict";
      var r, n = Qe(), o = er(), p = tr(), a = rr(), c = nr(), i = or(), l = be(), d = sr(), u = ir(), y = ar(), g = pr(), h = cr(), C = lr(),
      w = ur(), A = dr(), L = Function, I = /* @__PURE__ */ s(function(P) {
        try {
          return L('"use strict"; return (' + P + ").constructor;")();
        } catch {
        }
      }, "getEvalledConstructor"), Y = Se(), xt = hr(), ge = /* @__PURE__ */ s(function() {
        throw new l();
      }, "throwTypeError"), wt = Y ? function() {
        try {
          return arguments.callee, ge;
        } catch {
          try {
            return Y(arguments, "callee").get;
          } catch {
            return ge;
          }
        }
      }() : ge, D = et()(), E = _r(), Pt = rt(), Ot = tt(), Fe = nt(), K = Te(), $ = {}, Ct = typeof Uint8Array > "u" || !E ? r : E(Uint8Array),
      R = {
        __proto__: null,
        "%AggregateError%": typeof AggregateError > "u" ? r : AggregateError,
        "%Array%": Array,
        "%ArrayBuffer%": typeof ArrayBuffer > "u" ? r : ArrayBuffer,
        "%ArrayIteratorPrototype%": D && E ? E([][Symbol.iterator]()) : r,
        "%AsyncFromSyncIteratorPrototype%": r,
        "%AsyncFunction%": $,
        "%AsyncGenerator%": $,
        "%AsyncGeneratorFunction%": $,
        "%AsyncIteratorPrototype%": $,
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
        "%Error%": o,
        "%eval%": eval,
        // eslint-disable-line no-eval
        "%EvalError%": p,
        "%Float16Array%": typeof Float16Array > "u" ? r : Float16Array,
        "%Float32Array%": typeof Float32Array > "u" ? r : Float32Array,
        "%Float64Array%": typeof Float64Array > "u" ? r : Float64Array,
        "%FinalizationRegistry%": typeof FinalizationRegistry > "u" ? r : FinalizationRegistry,
        "%Function%": L,
        "%GeneratorFunction%": $,
        "%Int8Array%": typeof Int8Array > "u" ? r : Int8Array,
        "%Int16Array%": typeof Int16Array > "u" ? r : Int16Array,
        "%Int32Array%": typeof Int32Array > "u" ? r : Int32Array,
        "%isFinite%": isFinite,
        "%isNaN%": isNaN,
        "%IteratorPrototype%": D && E ? E(E([][Symbol.iterator]())) : r,
        "%JSON%": typeof JSON == "object" ? JSON : r,
        "%Map%": typeof Map > "u" ? r : Map,
        "%MapIteratorPrototype%": typeof Map > "u" || !D || !E ? r : E((/* @__PURE__ */ new Map())[Symbol.iterator]()),
        "%Math%": Math,
        "%Number%": Number,
        "%Object%": n,
        "%Object.getOwnPropertyDescriptor%": Y,
        "%parseFloat%": parseFloat,
        "%parseInt%": parseInt,
        "%Promise%": typeof Promise > "u" ? r : Promise,
        "%Proxy%": typeof Proxy > "u" ? r : Proxy,
        "%RangeError%": a,
        "%ReferenceError%": c,
        "%Reflect%": typeof Reflect > "u" ? r : Reflect,
        "%RegExp%": RegExp,
        "%Set%": typeof Set > "u" ? r : Set,
        "%SetIteratorPrototype%": typeof Set > "u" || !D || !E ? r : E((/* @__PURE__ */ new Set())[Symbol.iterator]()),
        "%SharedArrayBuffer%": typeof SharedArrayBuffer > "u" ? r : SharedArrayBuffer,
        "%String%": String,
        "%StringIteratorPrototype%": D && E ? E(""[Symbol.iterator]()) : r,
        "%Symbol%": D ? Symbol : r,
        "%SyntaxError%": i,
        "%ThrowTypeError%": wt,
        "%TypedArray%": Ct,
        "%TypeError%": l,
        "%Uint8Array%": typeof Uint8Array > "u" ? r : Uint8Array,
        "%Uint8ClampedArray%": typeof Uint8ClampedArray > "u" ? r : Uint8ClampedArray,
        "%Uint16Array%": typeof Uint16Array > "u" ? r : Uint16Array,
        "%Uint32Array%": typeof Uint32Array > "u" ? r : Uint32Array,
        "%URIError%": d,
        "%WeakMap%": typeof WeakMap > "u" ? r : WeakMap,
        "%WeakRef%": typeof WeakRef > "u" ? r : WeakRef,
        "%WeakSet%": typeof WeakSet > "u" ? r : WeakSet,
        "%Function.prototype.call%": K,
        "%Function.prototype.apply%": Fe,
        "%Object.defineProperty%": xt,
        "%Object.getPrototypeOf%": Pt,
        "%Math.abs%": u,
        "%Math.floor%": y,
        "%Math.max%": g,
        "%Math.min%": h,
        "%Math.pow%": C,
        "%Math.round%": w,
        "%Math.sign%": A,
        "%Reflect.getPrototypeOf%": Ot
      };
      if (E)
        try {
          null.error;
        } catch (P) {
          Me = E(E(P)), R["%Error.prototype%"] = Me;
        }
      var Me, Nt = /* @__PURE__ */ s(function P(m) {
        var b;
        if (m === "%AsyncFunction%")
          b = I("async function () {}");
        else if (m === "%GeneratorFunction%")
          b = I("function* () {}");
        else if (m === "%AsyncGeneratorFunction%")
          b = I("async function* () {}");
        else if (m === "%AsyncGenerator%") {
          var v = P("%AsyncGeneratorFunction%");
          v && (b = v.prototype);
        } else if (m === "%AsyncIteratorPrototype%") {
          var S = P("%AsyncGenerator%");
          S && E && (b = E(S.prototype));
        }
        return R[m] = b, b;
      }, "doEval2"), Ue = {
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
      }, X = de(), se = st(), It = X.call(K, Array.prototype.concat), Rt = X.call(Fe, Array.prototype.splice), Ge = X.call(K, String.prototype.
      replace), ie = X.call(K, String.prototype.slice), jt = X.call(K, RegExp.prototype.exec), Lt = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g,
      Dt = /\\(\\)?/g, $t = /* @__PURE__ */ s(function(m) {
        var b = ie(m, 0, 1), v = ie(m, -1);
        if (b === "%" && v !== "%")
          throw new i("invalid intrinsic syntax, expected closing `%`");
        if (v === "%" && b !== "%")
          throw new i("invalid intrinsic syntax, expected opening `%`");
        var S = [];
        return Ge(m, Lt, function(O, F, T, ae) {
          S[S.length] = T ? Ge(ae, Dt, "$1") : F || O;
        }), S;
      }, "stringToPath3"), Ft = /* @__PURE__ */ s(function(m, b) {
        var v = m, S;
        if (se(Ue, v) && (S = Ue[v], v = "%" + S[0] + "%"), se(R, v)) {
          var O = R[v];
          if (O === $ && (O = Nt(v)), typeof O > "u" && !b)
            throw new l("intrinsic " + m + " exists, but is not available. Please file an issue!");
          return {
            alias: S,
            name: v,
            value: O
          };
        }
        throw new i("intrinsic " + m + " does not exist!");
      }, "getBaseIntrinsic2");
      e.exports = /* @__PURE__ */ s(function(m, b) {
        if (typeof m != "string" || m.length === 0)
          throw new l("intrinsic name must be a non-empty string");
        if (arguments.length > 1 && typeof b != "boolean")
          throw new l('"allowMissing" argument must be a boolean');
        if (jt(/^%?[^%]*%?$/, m) === null)
          throw new i("`%` may not be present anywhere but at the beginning and end of the intrinsic name");
        var v = $t(m), S = v.length > 0 ? v[0] : "", O = Ft("%" + S + "%", b), F = O.name, T = O.value, ae = !1, me = O.alias;
        me && (S = me[0], Rt(v, It([0, 1], me)));
        for (var pe = 1, Q = !0; pe < v.length; pe += 1) {
          var N = v[pe], ce = ie(N, 0, 1), le = ie(N, -1);
          if ((ce === '"' || ce === "'" || ce === "`" || le === '"' || le === "'" || le === "`") && ce !== le)
            throw new i("property names with quotes must have matching quotes");
          if ((N === "constructor" || !Q) && (ae = !0), S += "." + N, F = "%" + S + "%", se(R, F))
            T = R[F];
          else if (T != null) {
            if (!(N in T)) {
              if (!b)
                throw new l("base intrinsic for " + m + " exists, but the property is not available.");
              return;
            }
            if (Y && pe + 1 >= v.length) {
              var ue = Y(T, N);
              Q = !!ue, Q && "get" in ue && !("originalValue" in ue.get) ? T = ue.get : T = T[N];
            } else
              Q = se(T, N), T = T[N];
            Q && !ae && (R[F] = T);
          }
        }
        return T;
      }, "GetIntrinsic");
    }
  }), Ae = f({
    "node_modules/.pnpm/call-bound@1.0.4/node_modules/call-bound/index.js"(t, e) {
      "use strict";
      var r = br(), n = ot(), o = n([r("%String.prototype.indexOf%")]);
      e.exports = /* @__PURE__ */ s(function(a, c) {
        var i = (
          /** @type {(this: unknown, ...args: unknown[]) => unknown} */
          r(a, !!c)
        );
        return typeof i == "function" && o(a, ".prototype.") > -1 ? n(
          /** @type {const} */
          [i]
        ) : i;
      }, "callBoundIntrinsic");
    }
  }), Sr = f({
    "node_modules/.pnpm/has-tostringtag@1.0.2/node_modules/has-tostringtag/shams.js"(t, e) {
      "use strict";
      var r = Ze();
      e.exports = /* @__PURE__ */ s(function() {
        return r() && !!Symbol.toStringTag;
      }, "hasToStringTagShams");
    }
  }), it = f({
    "node_modules/.pnpm/is-regex@1.2.1/node_modules/is-regex/index.js"(t, e) {
      "use strict";
      var r = Ae(), n = Sr()(), o = st(), p = Se(), a;
      n ? (c = r("RegExp.prototype.exec"), i = {}, l = /* @__PURE__ */ s(function() {
        throw i;
      }, "throwRegexMarker"), d = {
        toString: l,
        valueOf: l
      }, typeof Symbol.toPrimitive == "symbol" && (d[Symbol.toPrimitive] = l), a = /* @__PURE__ */ s(function(h) {
        if (!h || typeof h != "object")
          return !1;
        var C = (
          /** @type {NonNullable<typeof gOPD>} */
          p(
            /** @type {{ lastIndex?: unknown }} */
            h,
            "lastIndex"
          )
        ), w = C && o(C, "value");
        if (!w)
          return !1;
        try {
          c(
            h,
            /** @type {string} */
            /** @type {unknown} */
            d
          );
        } catch (A) {
          return A === i;
        }
      }, "isRegex")) : (u = r("Object.prototype.toString"), y = "[object RegExp]", a = /* @__PURE__ */ s(function(h) {
        return !h || typeof h != "object" && typeof h != "function" ? !1 : u(h) === y;
      }, "isRegex"));
      var c, i, l, d, u, y;
      e.exports = a;
    }
  }), Tr = f({
    "node_modules/.pnpm/is-function@1.0.2/node_modules/is-function/index.js"(t, e) {
      e.exports = n;
      var r = Object.prototype.toString;
      function n(o) {
        if (!o)
          return !1;
        var p = r.call(o);
        return p === "[object Function]" || typeof o == "function" && p !== "[object RegExp]" || typeof window < "u" && // IE8 and below
        (o === window.setTimeout || o === window.alert || o === window.confirm || o === window.prompt);
      }
      s(n, "isFunction3");
    }
  }), Ar = f({
    "node_modules/.pnpm/safe-regex-test@1.1.0/node_modules/safe-regex-test/index.js"(t, e) {
      "use strict";
      var r = Ae(), n = it(), o = r("RegExp.prototype.exec"), p = be();
      e.exports = /* @__PURE__ */ s(function(c) {
        if (!n(c))
          throw new p("`regex` must be a RegExp");
        return /* @__PURE__ */ s(function(l) {
          return o(c, l) !== null;
        }, "test");
      }, "regexTester");
    }
  }), xr = f({
    "node_modules/.pnpm/is-symbol@1.1.1/node_modules/is-symbol/index.js"(t, e) {
      "use strict";
      var r = Ae(), n = r("Object.prototype.toString"), o = et()(), p = Ar();
      o ? (a = r("Symbol.prototype.toString"), c = p(/^Symbol\(.*\)$/), i = /* @__PURE__ */ s(function(d) {
        return typeof d.valueOf() != "symbol" ? !1 : c(a(d));
      }, "isRealSymbolObject"), e.exports = /* @__PURE__ */ s(function(d) {
        if (typeof d == "symbol")
          return !0;
        if (!d || typeof d != "object" || n(d) !== "[object Symbol]")
          return !1;
        try {
          return i(d);
        } catch {
          return !1;
        }
      }, "isSymbol3")) : e.exports = /* @__PURE__ */ s(function(d) {
        return !1;
      }, "isSymbol3");
      var a, c, i;
    }
  }), at = {};
  Qt(at, {
    isJSON: /* @__PURE__ */ s(() => yt, "isJSON"),
    parse: /* @__PURE__ */ s(() => Zo, "parse"),
    replacer: /* @__PURE__ */ s(() => gt, "replacer"),
    reviver: /* @__PURE__ */ s(() => mt, "reviver"),
    stringify: /* @__PURE__ */ s(() => Xo, "stringify")
  });
  Et.exports = Zt(at);
  var wr = _e(it()), Pr = _e(Tr()), Or = _e(xr());
  function Cr(t) {
    return t != null && typeof t == "object" && Array.isArray(t) === !1;
  }
  s(Cr, "isObject");
  var Nr = typeof global == "object" && global && global.Object === Object && global, Ir = Nr, Rr = typeof self == "object" && self && self.
  Object === Object && self, jr = Ir || Rr || Function("return this")(), xe = jr, Lr = xe.Symbol, G = Lr, pt = Object.prototype, Dr = pt.hasOwnProperty,
  $r = pt.toString, re = G ? G.toStringTag : void 0;
  function Fr(t) {
    var e = Dr.call(t, re), r = t[re];
    try {
      t[re] = void 0;
      var n = !0;
    } catch {
    }
    var o = $r.call(t);
    return n && (e ? t[re] = r : delete t[re]), o;
  }
  s(Fr, "getRawTag");
  var Mr = Fr, Ur = Object.prototype, Gr = Ur.toString;
  function kr(t) {
    return Gr.call(t);
  }
  s(kr, "objectToString");
  var Wr = kr, qr = "[object Null]", Br = "[object Undefined]", He = G ? G.toStringTag : void 0;
  function Hr(t) {
    return t == null ? t === void 0 ? Br : qr : He && He in Object(t) ? Mr(t) : Wr(t);
  }
  s(Hr, "baseGetTag");
  var ct = Hr;
  function Vr(t) {
    return t != null && typeof t == "object";
  }
  s(Vr, "isObjectLike");
  var Jr = Vr, zr = "[object Symbol]";
  function Yr(t) {
    return typeof t == "symbol" || Jr(t) && ct(t) == zr;
  }
  s(Yr, "isSymbol");
  var we = Yr;
  function Kr(t, e) {
    for (var r = -1, n = t == null ? 0 : t.length, o = Array(n); ++r < n; )
      o[r] = e(t[r], r, t);
    return o;
  }
  s(Kr, "arrayMap");
  var Xr = Kr, Qr = Array.isArray, Pe = Qr, Zr = 1 / 0, Ve = G ? G.prototype : void 0, Je = Ve ? Ve.toString : void 0;
  function lt(t) {
    if (typeof t == "string")
      return t;
    if (Pe(t))
      return Xr(t, lt) + "";
    if (we(t))
      return Je ? Je.call(t) : "";
    var e = t + "";
    return e == "0" && 1 / t == -Zr ? "-0" : e;
  }
  s(lt, "baseToString");
  var en = lt;
  function tn(t) {
    var e = typeof t;
    return t != null && (e == "object" || e == "function");
  }
  s(tn, "isObject2");
  var ut = tn, rn = "[object AsyncFunction]", nn = "[object Function]", on = "[object GeneratorFunction]", sn = "[object Proxy]";
  function an(t) {
    if (!ut(t))
      return !1;
    var e = ct(t);
    return e == nn || e == on || e == rn || e == sn;
  }
  s(an, "isFunction");
  var pn = an, cn = xe["__core-js_shared__"], Ee = cn, ze = function() {
    var t = /[^.]+$/.exec(Ee && Ee.keys && Ee.keys.IE_PROTO || "");
    return t ? "Symbol(src)_1." + t : "";
  }();
  function ln(t) {
    return !!ze && ze in t;
  }
  s(ln, "isMasked");
  var un = ln, fn = Function.prototype, dn = fn.toString;
  function yn(t) {
    if (t != null) {
      try {
        return dn.call(t);
      } catch {
      }
      try {
        return t + "";
      } catch {
      }
    }
    return "";
  }
  s(yn, "toSource");
  var hn = yn, gn = /[\\^$.*+?()[\]{}|]/g, mn = /^\[object .+?Constructor\]$/, vn = Function.prototype, En = Object.prototype, _n = vn.toString,
  bn = En.hasOwnProperty, Sn = RegExp(
    "^" + _n.call(bn).replace(gn, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
  );
  function Tn(t) {
    if (!ut(t) || un(t))
      return !1;
    var e = pn(t) ? Sn : mn;
    return e.test(hn(t));
  }
  s(Tn, "baseIsNative");
  var An = Tn;
  function xn(t, e) {
    return t?.[e];
  }
  s(xn, "getValue");
  var wn = xn;
  function Pn(t, e) {
    var r = wn(t, e);
    return An(r) ? r : void 0;
  }
  s(Pn, "getNative");
  var ft = Pn;
  function On(t, e) {
    return t === e || t !== t && e !== e;
  }
  s(On, "eq");
  var Cn = On, Nn = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, In = /^\w*$/;
  function Rn(t, e) {
    if (Pe(t))
      return !1;
    var r = typeof t;
    return r == "number" || r == "symbol" || r == "boolean" || t == null || we(t) ? !0 : In.test(t) || !Nn.test(t) || e != null && t in Object(
    e);
  }
  s(Rn, "isKey");
  var jn = Rn, Ln = ft(Object, "create"), ne = Ln;
  function Dn() {
    this.__data__ = ne ? ne(null) : {}, this.size = 0;
  }
  s(Dn, "hashClear");
  var $n = Dn;
  function Fn(t) {
    var e = this.has(t) && delete this.__data__[t];
    return this.size -= e ? 1 : 0, e;
  }
  s(Fn, "hashDelete");
  var Mn = Fn, Un = "__lodash_hash_undefined__", Gn = Object.prototype, kn = Gn.hasOwnProperty;
  function Wn(t) {
    var e = this.__data__;
    if (ne) {
      var r = e[t];
      return r === Un ? void 0 : r;
    }
    return kn.call(e, t) ? e[t] : void 0;
  }
  s(Wn, "hashGet");
  var qn = Wn, Bn = Object.prototype, Hn = Bn.hasOwnProperty;
  function Vn(t) {
    var e = this.__data__;
    return ne ? e[t] !== void 0 : Hn.call(e, t);
  }
  s(Vn, "hashHas");
  var Jn = Vn, zn = "__lodash_hash_undefined__";
  function Yn(t, e) {
    var r = this.__data__;
    return this.size += this.has(t) ? 0 : 1, r[t] = ne && e === void 0 ? zn : e, this;
  }
  s(Yn, "hashSet");
  var Kn = Yn;
  function k(t) {
    var e = -1, r = t == null ? 0 : t.length;
    for (this.clear(); ++e < r; ) {
      var n = t[e];
      this.set(n[0], n[1]);
    }
  }
  s(k, "Hash");
  k.prototype.clear = $n;
  k.prototype.delete = Mn;
  k.prototype.get = qn;
  k.prototype.has = Jn;
  k.prototype.set = Kn;
  var Ye = k;
  function Xn() {
    this.__data__ = [], this.size = 0;
  }
  s(Xn, "listCacheClear");
  var Qn = Xn;
  function Zn(t, e) {
    for (var r = t.length; r--; )
      if (Cn(t[r][0], e))
        return r;
    return -1;
  }
  s(Zn, "assocIndexOf");
  var ye = Zn, eo = Array.prototype, to = eo.splice;
  function ro(t) {
    var e = this.__data__, r = ye(e, t);
    if (r < 0)
      return !1;
    var n = e.length - 1;
    return r == n ? e.pop() : to.call(e, r, 1), --this.size, !0;
  }
  s(ro, "listCacheDelete");
  var no = ro;
  function oo(t) {
    var e = this.__data__, r = ye(e, t);
    return r < 0 ? void 0 : e[r][1];
  }
  s(oo, "listCacheGet");
  var so = oo;
  function io(t) {
    return ye(this.__data__, t) > -1;
  }
  s(io, "listCacheHas");
  var ao = io;
  function po(t, e) {
    var r = this.__data__, n = ye(r, t);
    return n < 0 ? (++this.size, r.push([t, e])) : r[n][1] = e, this;
  }
  s(po, "listCacheSet");
  var co = po;
  function W(t) {
    var e = -1, r = t == null ? 0 : t.length;
    for (this.clear(); ++e < r; ) {
      var n = t[e];
      this.set(n[0], n[1]);
    }
  }
  s(W, "ListCache");
  W.prototype.clear = Qn;
  W.prototype.delete = no;
  W.prototype.get = so;
  W.prototype.has = ao;
  W.prototype.set = co;
  var lo = W, uo = ft(xe, "Map"), fo = uo;
  function yo() {
    this.size = 0, this.__data__ = {
      hash: new Ye(),
      map: new (fo || lo)(),
      string: new Ye()
    };
  }
  s(yo, "mapCacheClear");
  var ho = yo;
  function go(t) {
    var e = typeof t;
    return e == "string" || e == "number" || e == "symbol" || e == "boolean" ? t !== "__proto__" : t === null;
  }
  s(go, "isKeyable");
  var mo = go;
  function vo(t, e) {
    var r = t.__data__;
    return mo(e) ? r[typeof e == "string" ? "string" : "hash"] : r.map;
  }
  s(vo, "getMapData");
  var he = vo;
  function Eo(t) {
    var e = he(this, t).delete(t);
    return this.size -= e ? 1 : 0, e;
  }
  s(Eo, "mapCacheDelete");
  var _o = Eo;
  function bo(t) {
    return he(this, t).get(t);
  }
  s(bo, "mapCacheGet");
  var So = bo;
  function To(t) {
    return he(this, t).has(t);
  }
  s(To, "mapCacheHas");
  var Ao = To;
  function xo(t, e) {
    var r = he(this, t), n = r.size;
    return r.set(t, e), this.size += r.size == n ? 0 : 1, this;
  }
  s(xo, "mapCacheSet");
  var wo = xo;
  function q(t) {
    var e = -1, r = t == null ? 0 : t.length;
    for (this.clear(); ++e < r; ) {
      var n = t[e];
      this.set(n[0], n[1]);
    }
  }
  s(q, "MapCache");
  q.prototype.clear = ho;
  q.prototype.delete = _o;
  q.prototype.get = So;
  q.prototype.has = Ao;
  q.prototype.set = wo;
  var dt = q, Po = "Expected a function";
  function Oe(t, e) {
    if (typeof t != "function" || e != null && typeof e != "function")
      throw new TypeError(Po);
    var r = /* @__PURE__ */ s(function() {
      var n = arguments, o = e ? e.apply(this, n) : n[0], p = r.cache;
      if (p.has(o))
        return p.get(o);
      var a = t.apply(this, n);
      return r.cache = p.set(o, a) || p, a;
    }, "memoized");
    return r.cache = new (Oe.Cache || dt)(), r;
  }
  s(Oe, "memoize");
  Oe.Cache = dt;
  var Oo = Oe, Co = 500;
  function No(t) {
    var e = Oo(t, function(n) {
      return r.size === Co && r.clear(), n;
    }), r = e.cache;
    return e;
  }
  s(No, "memoizeCapped");
  var Io = No, Ro = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g, jo = /\\(\\)?/g, Lo = Io(
  function(t) {
    var e = [];
    return t.charCodeAt(0) === 46 && e.push(""), t.replace(Ro, function(r, n, o, p) {
      e.push(o ? p.replace(jo, "$1") : n || r);
    }), e;
  }), Do = Lo;
  function $o(t) {
    return t == null ? "" : en(t);
  }
  s($o, "toString");
  var Fo = $o;
  function Mo(t, e) {
    return Pe(t) ? t : jn(t, e) ? [t] : Do(Fo(t));
  }
  s(Mo, "castPath");
  var Uo = Mo, Go = 1 / 0;
  function ko(t) {
    if (typeof t == "string" || we(t))
      return t;
    var e = t + "";
    return e == "0" && 1 / t == -Go ? "-0" : e;
  }
  s(ko, "toKey");
  var Wo = ko;
  function qo(t, e) {
    e = Uo(e, t);
    for (var r = 0, n = e.length; t != null && r < n; )
      t = t[Wo(e[r++])];
    return r && r == n ? t : void 0;
  }
  s(qo, "baseGet");
  var Bo = qo;
  function Ho(t, e, r) {
    var n = t == null ? void 0 : Bo(t, e);
    return n === void 0 ? r : n;
  }
  s(Ho, "get");
  var Vo = Ho, Jo = [
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
  ], zo = ["detail"];
  function Yo(t) {
    let e = Jo.filter((r) => t[r] !== void 0).reduce((r, n) => (r[n] = t[n], r), {});
    if (t instanceof CustomEvent)
      for (let r of zo.filter(
        (n) => t[n] !== void 0
      ))
        e[r] = t[r];
    return e;
  }
  s(Yo, "extractEventHiddenProperties");
  var Ce = Cr, Ko = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/, yt = /* @__PURE__ */ s((t) => t.match(/^[\[\{\"\}].*[\]\}\"]$/), "is\
JSON");
  function ht(t) {
    if (!Ce(t))
      return t;
    let e = t, r = !1;
    return typeof Event < "u" && t instanceof Event && (e = Yo(e), r = !0), e = Object.keys(e).reduce((n, o) => {
      try {
        e[o] && e[o].toJSON, n[o] = e[o];
      } catch {
        r = !0;
      }
      return n;
    }, {}), r ? e : t;
  }
  s(ht, "convertUnconventionalData");
  var gt = /* @__PURE__ */ s(function(e) {
    let r, n, o, p;
    return /* @__PURE__ */ s(function(c, i) {
      try {
        if (c === "")
          return p = [], r = /* @__PURE__ */ new Map([[i, "[]"]]), n = /* @__PURE__ */ new Map(), o = [], i;
        let l = n.get(this) || this;
        for (; o.length && l !== o[0]; )
          o.shift(), p.pop();
        if (typeof i == "boolean")
          return i;
        if (i === void 0)
          return e.allowUndefined ? "_undefined_" : void 0;
        if (i === null)
          return null;
        if (typeof i == "number")
          return i === Number.NEGATIVE_INFINITY ? "_-Infinity_" : i === Number.POSITIVE_INFINITY ? "_Infinity_" : Number.isNaN(i) ? "_NaN_" :
          i;
        if (typeof i == "bigint")
          return `_bigint_${i.toString()}`;
        if (typeof i == "string")
          return Ko.test(i) ? e.allowDate ? `_date_${i}` : void 0 : i;
        if ((0, wr.default)(i))
          return e.allowRegExp ? `_regexp_${i.flags}|${i.source}` : void 0;
        if ((0, Pr.default)(i))
          return;
        if ((0, Or.default)(i)) {
          if (!e.allowSymbol)
            return;
          let u = Symbol.keyFor(i);
          return u !== void 0 ? `_gsymbol_${u}` : `_symbol_${i.toString().slice(7, -1)}`;
        }
        if (o.length >= e.maxDepth)
          return Array.isArray(i) ? `[Array(${i.length})]` : "[Object]";
        if (i === this)
          return `_duplicate_${JSON.stringify(p)}`;
        if (i instanceof Error && e.allowError)
          return {
            __isConvertedError__: !0,
            errorProperties: {
              // @ts-expect-error cause is not defined in the current tsconfig target(es2020)
              ...i.cause ? { cause: i.cause } : {},
              ...i,
              name: i.name,
              message: i.message,
              stack: i.stack,
              "_constructor-name_": i.constructor.name
            }
          };
        if (i?.constructor?.name && i.constructor.name !== "Object" && !Array.isArray(i)) {
          let u = r.get(i);
          if (!u) {
            let y = {
              __isClassInstance__: !0,
              __className__: i.constructor.name,
              ...Object.getOwnPropertyNames(i).reduce(
                (g, h) => {
                  try {
                    g[h] = i[h];
                  } catch {
                  }
                  return g;
                },
                {}
              )
            };
            return p.push(c), o.unshift(y), r.set(i, JSON.stringify(p)), i !== y && n.set(i, y), y;
          }
          return `_duplicate_${u}`;
        }
        let d = r.get(i);
        if (!d) {
          let u = Array.isArray(i) ? i : ht(i);
          return p.push(c), o.unshift(u), r.set(i, JSON.stringify(p)), i !== u && n.set(i, u), u;
        }
        return `_duplicate_${d}`;
      } catch {
        return;
      }
    }, "replace");
  }, "replacer2"), mt = /* @__PURE__ */ s(function(e) {
    let r = [], n;
    return /* @__PURE__ */ s(function(p, a) {
      if (p === "" && (n = a, r.forEach(({ target: c, container: i, replacement: l }) => {
        let d = yt(l) ? JSON.parse(l) : l.split(".");
        d.length === 0 ? i[c] = n : i[c] = Vo(n, d);
      })), p === "_constructor-name_")
        return a;
      if (Ce(a) && a.__isConvertedError__) {
        let { message: c, ...i } = a.errorProperties, l = new Error(c);
        return Object.assign(l, i), l;
      }
      if (typeof a == "string" && a.startsWith("_regexp_") && e.allowRegExp) {
        let [, c, i] = a.match(/_regexp_([^|]*)\|(.*)/) || [];
        return new RegExp(i, c);
      }
      return typeof a == "string" && a.startsWith("_date_") && e.allowDate ? new Date(a.replace("_date_", "")) : typeof a == "string" && a.startsWith(
      "_duplicate_") ? (r.push({ target: p, container: this, replacement: a.replace(/^_duplicate_/, "") }), null) : typeof a == "string" && a.
      startsWith("_symbol_") && e.allowSymbol ? Symbol(a.replace("_symbol_", "")) : typeof a == "string" && a.startsWith("_gsymbol_") && e.allowSymbol ?
      Symbol.for(a.replace("_gsymbol_", "")) : typeof a == "string" && a === "_-Infinity_" ? Number.NEGATIVE_INFINITY : typeof a == "string" &&
      a === "_Infinity_" ? Number.POSITIVE_INFINITY : typeof a == "string" && a === "_NaN_" ? Number.NaN : typeof a == "string" && a.startsWith(
      "_bigint_") && typeof BigInt == "function" ? BigInt(a.replace("_bigint_", "")) : a;
    }, "revive");
  }, "reviver2"), vt = {
    maxDepth: 10,
    space: void 0,
    allowRegExp: !0,
    allowDate: !0,
    allowError: !0,
    allowUndefined: !0,
    allowSymbol: !0
  }, Xo = /* @__PURE__ */ s((t, e = {}) => {
    let r = { ...vt, ...e };
    return JSON.stringify(ht(t), gt(r), e.space);
  }, "stringify"), Qo = /* @__PURE__ */ s(() => {
    let t = /* @__PURE__ */ new Map();
    return /* @__PURE__ */ s(function e(r) {
      Ce(r) && Object.entries(r).forEach(([n, o]) => {
        o === "_undefined_" ? r[n] = void 0 : t.get(o) || (t.set(o, !0), e(o));
      }), Array.isArray(r) && r.forEach((n, o) => {
        n === "_undefined_" ? (t.set(n, !0), r[o] = void 0) : t.get(n) || (t.set(n, !0), e(n));
      });
    }, "mutateUndefined");
  }, "mutator"), Zo = /* @__PURE__ */ s((t, e = {}) => {
    let r = { ...vt, ...e }, n = JSON.parse(t, mt(r));
    return Qo()(n), n;
  }, "parse");
});

// src/channels/index.ts
var as = {};
qt(as, {
  Channel: () => U,
  HEARTBEAT_INTERVAL: () => De,
  HEARTBEAT_MAX_LATENCY: () => $e,
  PostMessageTransport: () => H,
  WebsocketTransport: () => J,
  createBrowserChannel: () => is,
  default: () => ss
});
module.exports = Bt(as);
var At = require("@storybook/global");

// src/shared/universal-store/index.ts
var j = ee(Be(), 1);

// src/shared/universal-store/instances.ts
var ve = /* @__PURE__ */ new Map();

// src/shared/universal-store/index.ts
var Ht = "UNIVERSAL_STORE:", x = {
  PENDING: "PENDING",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED"
}, M = class t {
  constructor(e, r) {
    /** Enable debug logs for this store */
    this.debugging = !1;
    // TODO: narrow type of listeners based on event type
    this.listeners = /* @__PURE__ */ new Map([["*", /* @__PURE__ */ new Set()]]);
    /** Gets the current state */
    this.getState = /* @__PURE__ */ s(() => (this.debug("getState", { state: this.state }), this.state), "getState");
    /**
     * Subscribes to store events
     *
     * @returns A function to unsubscribe
     */
    this.subscribe = /* @__PURE__ */ s((e, r) => {
      let n = typeof e == "function", o = n ? "*" : e, p = n ? e : r;
      if (this.debug("subscribe", { eventType: o, listener: p }), !p)
        throw new TypeError(
          `Missing first subscribe argument, or second if first is the event type, when subscribing to a UniversalStore with id '${this.id}'`
        );
      return this.listeners.has(o) || this.listeners.set(o, /* @__PURE__ */ new Set()), this.listeners.get(o).add(p), () => {
        this.debug("unsubscribe", { eventType: o, listener: p }), this.listeners.has(o) && (this.listeners.get(o).delete(p), this.listeners.
        get(o)?.size === 0 && this.listeners.delete(o));
      };
    }, "subscribe");
    /** Sends a custom event to the other stores */
    this.send = /* @__PURE__ */ s((e) => {
      if (this.debug("send", { event: e }), this.status !== t.Status.READY)
        throw new TypeError(
          j.dedent`Cannot send event before store is ready. You can get the current status with store.status,
        or await store.readyPromise to wait for the store to be ready before sending events.
        ${JSON.stringify(
            {
              event: e,
              id: this.id,
              actor: this.actor,
              environment: this.environment
            },
            null,
            2
          )}`
        );
      this.emitToListeners(e, { actor: this.actor }), this.emitToChannel(e, { actor: this.actor });
    }, "send");
    if (this.debugging = e.debug ?? !1, !t.isInternalConstructing)
      throw new TypeError(
        "UniversalStore is not constructable - use UniversalStore.create() instead"
      );
    if (t.isInternalConstructing = !1, this.id = e.id, this.actorId = Date.now().toString(36) + Math.random().toString(36).substring(2), this.
    actorType = e.leader ? t.ActorType.LEADER : t.ActorType.FOLLOWER, this.state = e.initialState, this.channelEventName = `${Ht}${this.id}`,
    this.debug("constructor", {
      options: e,
      environmentOverrides: r,
      channelEventName: this.channelEventName
    }), this.actor.type === t.ActorType.LEADER)
      this.syncing = {
        state: x.RESOLVED,
        promise: Promise.resolve()
      };
    else {
      let n, o, p = new Promise((a, c) => {
        n = /* @__PURE__ */ s(() => {
          this.syncing.state === x.PENDING && (this.syncing.state = x.RESOLVED, a());
        }, "syncingResolve"), o = /* @__PURE__ */ s((i) => {
          this.syncing.state === x.PENDING && (this.syncing.state = x.REJECTED, c(i));
        }, "syncingReject");
      });
      this.syncing = {
        state: x.PENDING,
        promise: p,
        resolve: n,
        reject: o
      };
    }
    this.getState = this.getState.bind(this), this.setState = this.setState.bind(this), this.subscribe = this.subscribe.bind(this), this.onStateChange =
    this.onStateChange.bind(this), this.send = this.send.bind(this), this.emitToChannel = this.emitToChannel.bind(this), this.prepareThis = this.
    prepareThis.bind(this), this.emitToListeners = this.emitToListeners.bind(this), this.handleChannelEvents = this.handleChannelEvents.bind(
    this), this.debug = this.debug.bind(this), this.channel = r?.channel ?? t.preparation.channel, this.environment = r?.environment ?? t.preparation.
    environment, this.channel && this.environment ? (t.preparation.resolve({ channel: this.channel, environment: this.environment }), this.prepareThis(
    { channel: this.channel, environment: this.environment })) : t.preparation.promise.then(this.prepareThis);
  }
  static {
    s(this, "UniversalStore");
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
    t.setupPreparationPromise();
  }
  static setupPreparationPromise() {
    let e, r, n = new Promise(
      (o, p) => {
        e = /* @__PURE__ */ s((a) => {
          o(a);
        }, "resolveRef"), r = /* @__PURE__ */ s((...a) => {
          p(a);
        }, "rejectRef");
      }
    );
    t.preparation = {
      resolve: e,
      reject: r,
      promise: n
    };
  }
  /** The actor object representing the store instance with a unique ID and a type */
  get actor() {
    return Object.freeze({
      id: this.actorId,
      type: this.actorType,
      environment: this.environment ?? t.Environment.UNKNOWN
    });
  }
  /**
   * The current state of the store, that signals both if the store is prepared by Storybook and
   * also - in the case of a follower - if the state has been synced with the leader's state.
   */
  get status() {
    if (!this.channel || !this.environment)
      return t.Status.UNPREPARED;
    switch (this.syncing?.state) {
      case x.PENDING:
      case void 0:
        return t.Status.SYNCING;
      case x.REJECTED:
        return t.Status.ERROR;
      case x.RESOLVED:
      default:
        return t.Status.READY;
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
    return Promise.all([t.preparation.promise, this.syncing?.promise]);
  }
  /** Creates a new instance of UniversalStore */
  static create(e) {
    if (!e || typeof e?.id != "string")
      throw new TypeError("id is required and must be a string, when creating a UniversalStore");
    e.debug && console.debug(
      j.dedent`[UniversalStore]
        create`,
      { options: e }
    );
    let r = ve.get(e.id);
    if (r)
      return console.warn(j.dedent`UniversalStore with id "${e.id}" already exists in this environment, re-using existing.
        You should reuse the existing instance instead of trying to create a new one.`), r;
    t.isInternalConstructing = !0;
    let n = new t(e);
    return ve.set(e.id, n), n;
  }
  /**
   * Used by Storybook to set the channel for all instances of UniversalStore in the given
   * environment.
   *
   * @internal
   */
  static __prepare(e, r) {
    t.preparation.channel = e, t.preparation.environment = r, t.preparation.resolve({ channel: e, environment: r });
  }
  /**
   * Updates the store's state
   *
   * Either a new state or a state updater function can be passed to the method.
   */
  setState(e) {
    let r = this.state, n = typeof e == "function" ? e(r) : e;
    if (this.debug("setState", { newState: n, previousState: r, updater: e }), this.status !== t.Status.READY)
      throw new TypeError(
        j.dedent`Cannot set state before store is ready. You can get the current status with store.status,
        or await store.readyPromise to wait for the store to be ready before sending events.
        ${JSON.stringify(
          {
            newState: n,
            id: this.id,
            actor: this.actor,
            environment: this.environment
          },
          null,
          2
        )}`
      );
    this.state = n;
    let o = {
      type: t.InternalEventType.SET_STATE,
      payload: {
        state: n,
        previousState: r
      }
    };
    this.emitToChannel(o, { actor: this.actor }), this.emitToListeners(o, { actor: this.actor });
  }
  /**
   * Subscribes to state changes
   *
   * @returns Unsubscribe function
   */
  onStateChange(e) {
    return this.debug("onStateChange", { listener: e }), this.subscribe(
      t.InternalEventType.SET_STATE,
      ({ payload: r }, n) => {
        e(r.state, r.previousState, n);
      }
    );
  }
  emitToChannel(e, r) {
    this.debug("emitToChannel", { event: e, eventInfo: r, channel: !!this.channel }), this.channel?.emit(this.channelEventName, {
      event: e,
      eventInfo: r
    });
  }
  prepareThis({
    channel: e,
    environment: r
  }) {
    this.channel = e, this.environment = r, this.debug("prepared", { channel: !!e, environment: r }), this.channel.on(this.channelEventName,
    this.handleChannelEvents), this.actor.type === t.ActorType.LEADER ? this.emitToChannel(
      { type: t.InternalEventType.LEADER_CREATED },
      { actor: this.actor }
    ) : (this.emitToChannel(
      { type: t.InternalEventType.FOLLOWER_CREATED },
      { actor: this.actor }
    ), this.emitToChannel(
      { type: t.InternalEventType.EXISTING_STATE_REQUEST },
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
  emitToListeners(e, r) {
    let n = this.listeners.get(e.type), o = this.listeners.get("*");
    this.debug("emitToListeners", {
      event: e,
      eventInfo: r,
      eventTypeListeners: n,
      everythingListeners: o
    }), [...n ?? [], ...o ?? []].forEach(
      (p) => p(e, r)
    );
  }
  handleChannelEvents(e) {
    let { event: r, eventInfo: n } = e;
    if ([n.actor.id, n.forwardingActor?.id].includes(this.actor.id)) {
      this.debug("handleChannelEvents: Ignoring event from self", { channelEvent: e });
      return;
    } else if (this.syncing?.state === x.PENDING && r.type !== t.InternalEventType.EXISTING_STATE_RESPONSE) {
      this.debug("handleChannelEvents: Ignoring event while syncing", { channelEvent: e });
      return;
    }
    if (this.debug("handleChannelEvents", { channelEvent: e }), this.actor.type === t.ActorType.LEADER) {
      let o = !0;
      switch (r.type) {
        case t.InternalEventType.EXISTING_STATE_REQUEST:
          o = !1;
          let p = {
            type: t.InternalEventType.EXISTING_STATE_RESPONSE,
            payload: this.state
          };
          this.debug("handleChannelEvents: responding to existing state request", {
            responseEvent: p
          }), this.emitToChannel(p, { actor: this.actor }), this.emitToListeners(p, { actor: this.actor });
          break;
        case t.InternalEventType.LEADER_CREATED:
          o = !1, this.syncing.state = x.REJECTED, this.debug("handleChannelEvents: erroring due to second leader being created", {
            event: r
          }), console.error(
            j.dedent`Detected multiple UniversalStore leaders created with the same id "${this.id}".
            Only one leader can exists at a time, your stores are now in an invalid state.
            Leaders detected:
            this: ${JSON.stringify(this.actor, null, 2)}
            other: ${JSON.stringify(n.actor, null, 2)}`
          );
          break;
      }
      o && (this.debug("handleChannelEvents: forwarding event", { channelEvent: e }), this.emitToChannel(r, { actor: n.actor, forwardingActor: this.
      actor }));
    }
    if (this.actor.type === t.ActorType.FOLLOWER)
      switch (r.type) {
        case t.InternalEventType.EXISTING_STATE_RESPONSE:
          if (this.debug("handleChannelEvents: Setting state from leader's existing state response", {
            event: r
          }), this.syncing?.state !== x.PENDING)
            break;
          this.syncing.resolve?.();
          let o = {
            type: t.InternalEventType.SET_STATE,
            payload: {
              state: r.payload,
              previousState: this.state
            }
          };
          this.state = r.payload, this.emitToListeners(o, n);
          break;
      }
    switch (r.type) {
      case t.InternalEventType.SET_STATE:
        this.debug("handleChannelEvents: Setting state", { event: r }), this.state = r.payload.state;
        break;
    }
    this.emitToListeners(r, { actor: n.actor });
  }
  debug(e, r) {
    this.debugging && console.debug(
      j.dedent`[UniversalStore::${this.id}::${this.environment ?? t.Environment.UNKNOWN}]
        ${e}`,
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
    t.preparation.reject(new Error("reset")), t.setupPreparationPromise(), t.isInternalConstructing = !1;
  }
};

// src/channels/main.ts
var Vt = /* @__PURE__ */ s((t) => t.transports !== void 0, "isMulti"), Jt = /* @__PURE__ */ s(() => Math.random().toString(16).slice(2), "ge\
nerateRandomId"), U = class {
  constructor(e = {}) {
    this.sender = Jt();
    this.events = {};
    this.data = {};
    this.transports = [];
    this.isAsync = e.async || !1, Vt(e) ? (this.transports = e.transports || [], this.transports.forEach((r) => {
      r.setHandler((n) => this.handleEvent(n));
    })) : this.transports = e.transport ? [e.transport] : [], this.transports.forEach((r) => {
      r.setHandler((n) => this.handleEvent(n));
    });
  }
  static {
    s(this, "Channel");
  }
  get hasTransport() {
    return this.transports.length > 0;
  }
  addListener(e, r) {
    this.events[e] = this.events[e] || [], this.events[e].push(r);
  }
  emit(e, ...r) {
    let n = { type: e, args: r, from: this.sender }, o = {};
    r.length >= 1 && r[0] && r[0].options && (o = r[0].options);
    let p = /* @__PURE__ */ s(() => {
      this.transports.forEach((a) => {
        a.send(n, o);
      }), this.handleEvent(n);
    }, "handler");
    this.isAsync ? setImmediate(p) : p();
  }
  last(e) {
    return this.data[e];
  }
  eventNames() {
    return Object.keys(this.events);
  }
  listenerCount(e) {
    let r = this.listeners(e);
    return r ? r.length : 0;
  }
  listeners(e) {
    return this.events[e] || void 0;
  }
  once(e, r) {
    let n = this.onceListener(e, r);
    this.addListener(e, n);
  }
  removeAllListeners(e) {
    e ? this.events[e] && delete this.events[e] : this.events = {};
  }
  removeListener(e, r) {
    let n = this.listeners(e);
    n && (this.events[e] = n.filter((o) => o !== r));
  }
  on(e, r) {
    this.addListener(e, r);
  }
  off(e, r) {
    this.removeListener(e, r);
  }
  handleEvent(e) {
    let r = this.listeners(e.type);
    r && r.length && r.forEach((n) => {
      n.apply(e, e.args);
    }), this.data[e.type] = e.args;
  }
  onceListener(e, r) {
    let n = /* @__PURE__ */ s((...o) => (this.removeListener(e, n), r(...o)), "onceListener");
    return n;
  }
};

// src/channels/postmessage/index.ts
var B = require("storybook/internal/client-logger"), ts = ee(require("storybook/internal/core-events"), 1), _ = require("@storybook/global"),
V = ee(Ne(), 1);

// ../node_modules/tiny-invariant/dist/esm/tiny-invariant.js
var es = process.env.NODE_ENV === "production", Ie = "Invariant failed";
function oe(t, e) {
  if (!t) {
    if (es)
      throw new Error(Ie);
    var r = typeof e == "function" ? e() : e, n = r ? "".concat(Ie, ": ").concat(r) : Ie;
    throw new Error(n);
  }
}
s(oe, "invariant");

// src/channels/postmessage/getEventSourceUrl.ts
var _t = require("storybook/internal/client-logger");
var bt = /* @__PURE__ */ s((t) => {
  let e = Array.from(
    document.querySelectorAll("iframe[data-is-storybook]")
  ), [r, ...n] = e.filter((p) => {
    try {
      return p.contentWindow?.location.origin === t.source.location.origin && p.contentWindow?.location.pathname === t.source.location.pathname;
    } catch {
    }
    try {
      return p.contentWindow === t.source;
    } catch {
    }
    let a = p.getAttribute("src"), c;
    try {
      if (!a)
        return !1;
      ({ origin: c } = new URL(a, document.location.toString()));
    } catch {
      return !1;
    }
    return c === t.origin;
  }), o = r?.getAttribute("src");
  if (o && n.length === 0) {
    let { protocol: p, host: a, pathname: c } = new URL(o, document.location.toString());
    return `${p}//${a}${c}`;
  }
  return n.length > 0 && _t.logger.error("found multiple candidates for event source"), null;
}, "getEventSourceUrl");

// src/channels/postmessage/index.ts
var { document: Re, location: je } = _.global, St = "storybook-channel", rs = { maxDepth: 25 }, H = class {
  constructor(e) {
    this.config = e;
    this.connected = !1;
    if (this.buffer = [], typeof _.global?.addEventListener == "function" && _.global.addEventListener("message", this.handleEvent.bind(this),
    !1), e.page !== "manager" && e.page !== "preview")
      throw new Error(`postmsg-channel: "config.page" cannot be "${e.page}"`);
  }
  static {
    s(this, "PostMessageTransport");
  }
  setHandler(e) {
    this.handler = (...r) => {
      e.apply(this, r), !this.connected && this.getLocalFrame().length && (this.flush(), this.connected = !0);
    };
  }
  /**
   * Sends `event` to the associated window. If the window does not yet exist the event will be
   * stored in a buffer and sent when the window exists.
   *
   * @param event
   */
  send(e, r) {
    let {
      target: n,
      // telejson options
      allowRegExp: o,
      allowSymbol: p,
      allowDate: a,
      allowError: c,
      allowUndefined: i,
      maxDepth: l,
      space: d
    } = r || {}, u = Object.fromEntries(
      Object.entries({
        allowRegExp: o,
        allowSymbol: p,
        allowDate: a,
        allowError: c,
        allowUndefined: i,
        maxDepth: l,
        space: d
      }).filter(([w, A]) => typeof A < "u")
    ), y = {
      ...rs,
      ..._.global.CHANNEL_OPTIONS || {},
      ...u
    }, g = this.getFrames(n), h = new URLSearchParams(je?.search || ""), C = (0, V.stringify)(
      {
        key: St,
        event: e,
        refId: h.get("refId")
      },
      y
    );
    return g.length ? (this.buffer.length && this.flush(), g.forEach((w) => {
      try {
        w.postMessage(C, "*");
      } catch {
        B.logger.error("sending over postmessage fail");
      }
    }), Promise.resolve(null)) : new Promise((w, A) => {
      this.buffer.push({ event: e, resolve: w, reject: A });
    });
  }
  flush() {
    let { buffer: e } = this;
    this.buffer = [], e.forEach((r) => {
      this.send(r.event).then(r.resolve).catch(r.reject);
    });
  }
  getFrames(e) {
    if (this.config.page === "manager") {
      let n = Array.from(
        Re.querySelectorAll("iframe[data-is-storybook][data-is-loaded]")
      ).flatMap((o) => {
        try {
          return o.contentWindow && o.dataset.isStorybook !== void 0 && o.id === e ? [o.contentWindow] : [];
        } catch {
          return [];
        }
      });
      return n?.length ? n : this.getCurrentFrames();
    }
    return _.global && _.global.parent && _.global.parent !== _.global.self ? [_.global.parent] : [];
  }
  getCurrentFrames() {
    return this.config.page === "manager" ? Array.from(
      Re.querySelectorAll('[data-is-storybook="true"]')
    ).flatMap((r) => r.contentWindow ? [r.contentWindow] : []) : _.global && _.global.parent ? [_.global.parent] : [];
  }
  getLocalFrame() {
    return this.config.page === "manager" ? Array.from(
      Re.querySelectorAll("#storybook-preview-iframe")
    ).flatMap((r) => r.contentWindow ? [r.contentWindow] : []) : _.global && _.global.parent ? [_.global.parent] : [];
  }
  handleEvent(e) {
    try {
      let { data: r } = e, { key: n, event: o, refId: p } = typeof r == "string" && (0, V.isJSON)(r) ? (0, V.parse)(r, _.global.CHANNEL_OPTIONS ||
      {}) : r;
      if (n === St) {
        let a = this.config.page === "manager" ? '<span style="color: #37D5D3; background: black"> manager </span>' : '<span style="color: #\
1EA7FD; background: black"> preview </span>', c = Object.values(ts).includes(o.type) ? `<span style="color: #FF4785">${o.type}</span>` : `<s\
pan style="color: #FFAE00">${o.type}</span>`;
        if (p && (o.refId = p), o.source = this.config.page === "preview" ? e.origin : bt(e), !o.source) {
          B.pretty.error(
            `${a} received ${c} but was unable to determine the source of the event`
          );
          return;
        }
        let i = `${a} received ${c} (${r.length})`;
        B.pretty.debug(
          je.origin !== o.source ? i : `${i} <span style="color: gray">(on ${je.origin} from ${o.source})</span>`,
          ...o.args
        ), oe(this.handler, "ChannelHandler should be set"), this.handler(o);
      }
    } catch (r) {
      B.logger.error(r);
    }
  }
};

// src/channels/websocket/index.ts
var Tt = ee(require("storybook/internal/core-events"), 1), Le = require("@storybook/global"), z = ee(Ne(), 1);
var { WebSocket: ns } = Le.global, De = 15e3, $e = 5e3, J = class {
  constructor({ url: e, onError: r, page: n }) {
    this.buffer = [];
    this.isReady = !1;
    this.isClosed = !1;
    this.pingTimeout = 0;
    this.socket = new ns(e), this.socket.onopen = () => {
      this.isReady = !0, this.heartbeat(), this.flush();
    }, this.socket.onmessage = ({ data: o }) => {
      let p = typeof o == "string" && (0, z.isJSON)(o) ? (0, z.parse)(o) : o;
      oe(this.handler, "WebsocketTransport handler should be set"), this.handler(p), p.type === "ping" && (this.heartbeat(), this.send({ type: "\
pong" }));
    }, this.socket.onerror = (o) => {
      r && r(o);
    }, this.socket.onclose = (o) => {
      oe(this.handler, "WebsocketTransport handler should be set"), this.handler({
        type: Tt.CHANNEL_WS_DISCONNECT,
        args: [{ reason: o.reason, code: o.code }],
        from: n || "preview"
      }), this.isClosed = !0, clearTimeout(this.pingTimeout);
    };
  }
  static {
    s(this, "WebsocketTransport");
  }
  heartbeat() {
    clearTimeout(this.pingTimeout), this.pingTimeout = setTimeout(() => {
      this.socket.close(3008, "timeout");
    }, De + $e);
  }
  setHandler(e) {
    this.handler = e;
  }
  send(e) {
    this.isClosed || (this.isReady ? this.sendNow(e) : this.sendLater(e));
  }
  sendLater(e) {
    this.buffer.push(e);
  }
  sendNow(e) {
    let r = (0, z.stringify)(e, {
      maxDepth: 15,
      ...Le.global.CHANNEL_OPTIONS
    });
    this.socket.send(r);
  }
  flush() {
    let { buffer: e } = this;
    this.buffer = [], e.forEach((r) => this.send(r));
  }
};

// src/channels/index.ts
var { CONFIG_TYPE: os } = At.global, ss = U;
function is({ page: t, extraTransports: e = [] }) {
  let r = [new H({ page: t }), ...e];
  if (os === "DEVELOPMENT") {
    let o = window.location.protocol === "http:" ? "ws" : "wss", { hostname: p, port: a } = window.location, c = `${o}://${p}:${a}/storybook\
-server-channel`;
    r.push(new J({ url: c, onError: /* @__PURE__ */ s(() => {
    }, "onError"), page: t }));
  }
  let n = new U({ transports: r });
  return M.__prepare(
    n,
    t === "manager" ? M.Environment.MANAGER : M.Environment.PREVIEW
  ), n;
}
s(is, "createBrowserChannel");
