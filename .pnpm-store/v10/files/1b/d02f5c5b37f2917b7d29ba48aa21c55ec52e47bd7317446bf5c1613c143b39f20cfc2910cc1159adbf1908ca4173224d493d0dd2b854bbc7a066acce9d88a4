"use strict";
var ur = Object.create;
var D = Object.defineProperty;
var sr = Object.getOwnPropertyDescriptor;
var fr = Object.getOwnPropertyNames;
var pr = Object.getPrototypeOf, lr = Object.prototype.hasOwnProperty;
var a = (e, r) => D(e, "name", { value: r, configurable: !0 });
var F = (e, r) => () => (r || e((r = { exports: {} }).exports, r), r.exports), dr = (e, r) => {
  for (var t in r)
    D(e, t, { get: r[t], enumerable: !0 });
}, we = (e, r, t, n) => {
  if (r && typeof r == "object" || typeof r == "function")
    for (let o of fr(r))
      !lr.call(e, o) && o !== t && D(e, o, { get: () => r[o], enumerable: !(n = sr(r, o)) || n.enumerable });
  return e;
};
var Se = (e, r, t) => (t = e != null ? ur(pr(e)) : {}, we(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  r || !e || !e.__esModule ? D(t, "default", { value: e, enumerable: !0 }) : t,
  e
)), cr = (e) => we(D({}, "__esModule", { value: !0 }), e);

// ../node_modules/@babel/runtime/helpers/extends.js
var Fe = F((za, I) => {
  function ee() {
    return I.exports = ee = Object.assign ? Object.assign.bind() : function(e) {
      for (var r = 1; r < arguments.length; r++) {
        var t = arguments[r];
        for (var n in t) ({}).hasOwnProperty.call(t, n) && (e[n] = t[n]);
      }
      return e;
    }, I.exports.__esModule = !0, I.exports.default = I.exports, ee.apply(null, arguments);
  }
  a(ee, "_extends");
  I.exports = ee, I.exports.__esModule = !0, I.exports.default = I.exports;
});

// ../node_modules/@babel/runtime/helpers/assertThisInitialized.js
var Ce = F((Aa, q) => {
  function mr(e) {
    if (e === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    return e;
  }
  a(mr, "_assertThisInitialized");
  q.exports = mr, q.exports.__esModule = !0, q.exports.default = q.exports;
});

// ../node_modules/@babel/runtime/helpers/setPrototypeOf.js
var Z = F((Ra, R) => {
  function re(e, r) {
    return R.exports = re = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(t, n) {
      return t.__proto__ = n, t;
    }, R.exports.__esModule = !0, R.exports.default = R.exports, re(e, r);
  }
  a(re, "_setPrototypeOf");
  R.exports = re, R.exports.__esModule = !0, R.exports.default = R.exports;
});

// ../node_modules/@babel/runtime/helpers/inheritsLoose.js
var ze = F((Oa, W) => {
  var gr = Z();
  function hr(e, r) {
    e.prototype = Object.create(r.prototype), e.prototype.constructor = e, gr(e, r);
  }
  a(hr, "_inheritsLoose");
  W.exports = hr, W.exports.__esModule = !0, W.exports.default = W.exports;
});

// ../node_modules/@babel/runtime/helpers/getPrototypeOf.js
var Te = F((ka, j) => {
  function te(e) {
    return j.exports = te = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(r) {
      return r.__proto__ || Object.getPrototypeOf(r);
    }, j.exports.__esModule = !0, j.exports.default = j.exports, te(e);
  }
  a(te, "_getPrototypeOf");
  j.exports = te, j.exports.__esModule = !0, j.exports.default = j.exports;
});

// ../node_modules/@babel/runtime/helpers/isNativeFunction.js
var Ae = F((Pa, U) => {
  function br(e) {
    try {
      return Function.toString.call(e).indexOf("[native code]") !== -1;
    } catch {
      return typeof e == "function";
    }
  }
  a(br, "_isNativeFunction");
  U.exports = br, U.exports.__esModule = !0, U.exports.default = U.exports;
});

// ../node_modules/@babel/runtime/helpers/isNativeReflectConstruct.js
var Re = F((La, O) => {
  function Ie() {
    try {
      var e = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
      }));
    } catch {
    }
    return (O.exports = Ie = /* @__PURE__ */ a(function() {
      return !!e;
    }, "_isNativeReflectConstruct"), O.exports.__esModule = !0, O.exports.default = O.exports)();
  }
  a(Ie, "_isNativeReflectConstruct");
  O.exports = Ie, O.exports.__esModule = !0, O.exports.default = O.exports;
});

// ../node_modules/@babel/runtime/helpers/construct.js
var je = F((Ea, V) => {
  var vr = Re(), yr = Z();
  function xr(e, r, t) {
    if (vr()) return Reflect.construct.apply(null, arguments);
    var n = [null];
    n.push.apply(n, r);
    var o = new (e.bind.apply(e, n))();
    return t && yr(o, t.prototype), o;
  }
  a(xr, "_construct");
  V.exports = xr, V.exports.__esModule = !0, V.exports.default = V.exports;
});

// ../node_modules/@babel/runtime/helpers/wrapNativeSuper.js
var Oe = F((qa, M) => {
  var wr = Te(), Sr = Z(), Fr = Ae(), Cr = je();
  function ne(e) {
    var r = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
    return M.exports = ne = /* @__PURE__ */ a(function(n) {
      if (n === null || !Fr(n)) return n;
      if (typeof n != "function") throw new TypeError("Super expression must either be null or a function");
      if (r !== void 0) {
        if (r.has(n)) return r.get(n);
        r.set(n, o);
      }
      function o() {
        return Cr(n, arguments, wr(this).constructor);
      }
      return a(o, "Wrapper"), o.prototype = Object.create(n.prototype, {
        constructor: {
          value: o,
          enumerable: !1,
          writable: !0,
          configurable: !0
        }
      }), Sr(o, n);
    }, "_wrapNativeSuper"), M.exports.__esModule = !0, M.exports.default = M.exports, ne(e);
  }
  a(ne, "_wrapNativeSuper");
  M.exports = ne, M.exports.__esModule = !0, M.exports.default = M.exports;
});

// ../node_modules/@babel/runtime/helpers/taggedTemplateLiteralLoose.js
var Me = F((Ua, N) => {
  function zr(e, r) {
    return r || (r = e.slice(0)), e.raw = r, e;
  }
  a(zr, "_taggedTemplateLiteralLoose");
  N.exports = zr, N.exports.__esModule = !0, N.exports.default = N.exports;
});

// ../node_modules/polished/dist/polished.cjs.js
var he = F((u) => {
  "use strict";
  Object.defineProperty(u, "__esModule", { value: !0 });
  var Tr = Fe(), Ar = Ce(), Ir = ze(), Rr = Oe(), jr = Me();
  function J(e) {
    return e && typeof e == "object" && "default" in e ? e : { default: e };
  }
  a(J, "_interopDefaultLegacy");
  var h = /* @__PURE__ */ J(Tr), Or = /* @__PURE__ */ J(Ar), Mr = /* @__PURE__ */ J(Ir), kr = /* @__PURE__ */ J(Rr), Ge = /* @__PURE__ */ J(
  jr);
  function ke() {
    var e;
    return e = arguments.length - 1, e < 0 || arguments.length <= e ? void 0 : arguments[e];
  }
  a(ke, "last");
  function $r(e) {
    return -e;
  }
  a($r, "negation");
  function Pr(e, r) {
    return e + r;
  }
  a(Pr, "addition");
  function Br(e, r) {
    return e - r;
  }
  a(Br, "subtraction");
  function Lr(e, r) {
    return e * r;
  }
  a(Lr, "multiplication");
  function Hr(e, r) {
    return e / r;
  }
  a(Hr, "division");
  function Er() {
    return Math.max.apply(Math, arguments);
  }
  a(Er, "max");
  function Dr() {
    return Math.min.apply(Math, arguments);
  }
  a(Dr, "min");
  function qr() {
    return Array.of.apply(Array, arguments);
  }
  a(qr, "comma");
  var Wr = {
    symbols: {
      "*": {
        infix: {
          symbol: "*",
          f: Lr,
          notation: "infix",
          precedence: 4,
          rightToLeft: 0,
          argCount: 2
        },
        symbol: "*",
        regSymbol: "\\*"
      },
      "/": {
        infix: {
          symbol: "/",
          f: Hr,
          notation: "infix",
          precedence: 4,
          rightToLeft: 0,
          argCount: 2
        },
        symbol: "/",
        regSymbol: "/"
      },
      "+": {
        infix: {
          symbol: "+",
          f: Pr,
          notation: "infix",
          precedence: 2,
          rightToLeft: 0,
          argCount: 2
        },
        prefix: {
          symbol: "+",
          f: ke,
          notation: "prefix",
          precedence: 3,
          rightToLeft: 0,
          argCount: 1
        },
        symbol: "+",
        regSymbol: "\\+"
      },
      "-": {
        infix: {
          symbol: "-",
          f: Br,
          notation: "infix",
          precedence: 2,
          rightToLeft: 0,
          argCount: 2
        },
        prefix: {
          symbol: "-",
          f: $r,
          notation: "prefix",
          precedence: 3,
          rightToLeft: 0,
          argCount: 1
        },
        symbol: "-",
        regSymbol: "-"
      },
      ",": {
        infix: {
          symbol: ",",
          f: qr,
          notation: "infix",
          precedence: 1,
          rightToLeft: 0,
          argCount: 2
        },
        symbol: ",",
        regSymbol: ","
      },
      "(": {
        prefix: {
          symbol: "(",
          f: ke,
          notation: "prefix",
          precedence: 0,
          rightToLeft: 0,
          argCount: 1
        },
        symbol: "(",
        regSymbol: "\\("
      },
      ")": {
        postfix: {
          symbol: ")",
          f: void 0,
          notation: "postfix",
          precedence: 0,
          rightToLeft: 0,
          argCount: 1
        },
        symbol: ")",
        regSymbol: "\\)"
      },
      min: {
        func: {
          symbol: "min",
          f: Dr,
          notation: "func",
          precedence: 0,
          rightToLeft: 0,
          argCount: 1
        },
        symbol: "min",
        regSymbol: "min\\b"
      },
      max: {
        func: {
          symbol: "max",
          f: Er,
          notation: "func",
          precedence: 0,
          rightToLeft: 0,
          argCount: 1
        },
        symbol: "max",
        regSymbol: "max\\b"
      }
    }
  }, $e = Wr, Ur = {
    1: `Passed invalid arguments to hsl, please pass multiple numbers e.g. hsl(360, 0.75, 0.4) or an object e.g. rgb({ hue: 255, saturation:\
 0.4, lightness: 0.75 }).

`,
    2: `Passed invalid arguments to hsla, please pass multiple numbers e.g. hsla(360, 0.75, 0.4, 0.7) or an object e.g. rgb({ hue: 255, satu\
ration: 0.4, lightness: 0.75, alpha: 0.7 }).

`,
    3: `Passed an incorrect argument to a color function, please pass a string representation of a color.

`,
    4: `Couldn't generate valid rgb string from %s, it returned %s.

`,
    5: `Couldn't parse the color string. Please provide the color as a string in hex, rgb, rgba, hsl or hsla notation.

`,
    6: `Passed invalid arguments to rgb, please pass multiple numbers e.g. rgb(255, 205, 100) or an object e.g. rgb({ red: 255, green: 205, \
blue: 100 }).

`,
    7: `Passed invalid arguments to rgba, please pass multiple numbers e.g. rgb(255, 205, 100, 0.75) or an object e.g. rgb({ red: 255, green\
: 205, blue: 100, alpha: 0.75 }).

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
    65: `To pass multiple animations please supply them in arrays, e.g. animation(['rotate', '2s'], ['move', '1s'])\\nTo pass a single animat\
ion please supply them in simple values, e.g. animation('rotate', '2s').

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
  function Vr() {
    for (var e = arguments.length, r = new Array(e), t = 0; t < e; t++)
      r[t] = arguments[t];
    var n = r[0], o = [], i;
    for (i = 1; i < r.length; i += 1)
      o.push(r[i]);
    return o.forEach(function(s) {
      n = n.replace(/%[a-z]/, s);
    }), n;
  }
  a(Vr, "format");
  var p = /* @__PURE__ */ function(e) {
    Mr.default(r, e);
    function r(t) {
      var n;
      if (process.env.NODE_ENV === "production")
        n = e.call(this, "An error occurred. See https://github.com/styled-components/polished/blob/main/src/internalHelpers/errors.md#" + t +
        " for more information.") || this;
      else {
        for (var o = arguments.length, i = new Array(o > 1 ? o - 1 : 0), s = 1; s < o; s++)
          i[s - 1] = arguments[s];
        n = e.call(this, Vr.apply(void 0, [Ur[t]].concat(i))) || this;
      }
      return Or.default(n);
    }
    return a(r, "PolishedError"), r;
  }(/* @__PURE__ */ kr.default(Error)), Pe = /((?!\w)a|na|hc|mc|dg|me[r]?|xe|ni(?![a-zA-Z])|mm|cp|tp|xp|q(?!s)|hv|xamv|nimv|wv|sm|s(?!\D|$)|ged|darg?|nrut)/g;
  function Nr(e) {
    var r = {};
    return r.symbols = e ? h.default({}, $e.symbols, e.symbols) : h.default({}, $e.symbols), r;
  }
  a(Nr, "mergeSymbolMaps");
  function Be(e, r) {
    var t, n = e.pop();
    return r.push(n.f.apply(n, (t = []).concat.apply(t, r.splice(-n.argCount)))), n.precedence;
  }
  a(Be, "exec");
  function Gr(e, r) {
    var t = Nr(r), n, o = [t.symbols["("].prefix], i = [], s = new RegExp(
      // Pattern for numbers
      "\\d+(?:\\.\\d+)?|" + // ...and patterns for individual operators/function names
      Object.keys(t.symbols).map(function(v) {
        return t.symbols[v];
      }).sort(function(v, T) {
        return T.symbol.length - v.symbol.length;
      }).map(function(v) {
        return v.regSymbol;
      }).join("|") + "|(\\S)",
      "g"
    );
    s.lastIndex = 0;
    var f = !1;
    do {
      n = s.exec(e);
      var l = n || [")", void 0], c = l[0], b = l[1], d = t.symbols[c], m = d && !d.prefix && !d.func, x = !d || !d.postfix && !d.infix;
      if (b || (f ? x : m))
        throw new p(37, n ? n.index : e.length, e);
      if (f) {
        var w = d.postfix || d.infix;
        do {
          var z = o[o.length - 1];
          if ((w.precedence - z.precedence || z.rightToLeft) > 0) break;
        } while (Be(o, i));
        f = w.notation === "postfix", w.symbol !== ")" && (o.push(w), f && Be(o, i));
      } else if (d) {
        if (o.push(d.prefix || d.func), d.func && (n = s.exec(e), !n || n[0] !== "("))
          throw new p(38, n ? n.index : e.length, e);
      } else
        i.push(+c), f = !0;
    } while (n && o.length);
    if (o.length)
      throw new p(39, n ? n.index : e.length, e);
    if (n)
      throw new p(40, n ? n.index : e.length, e);
    return i.pop();
  }
  a(Gr, "calculate");
  function ae(e) {
    return e.split("").reverse().join("");
  }
  a(ae, "reverseString");
  function Qr(e, r) {
    var t = ae(e), n = t.match(Pe);
    if (n && !n.every(function(i) {
      return i === n[0];
    }))
      throw new p(41);
    var o = ae(t.replace(Pe, ""));
    return "" + Gr(o, r) + (n ? ae(n[0]) : "");
  }
  a(Qr, "math");
  var Yr = /--[\S]*/g;
  function Jr(e, r) {
    if (!e || !e.match(Yr))
      throw new p(73);
    var t;
    if (typeof document < "u" && document.documentElement !== null && (t = getComputedStyle(document.documentElement).getPropertyValue(e)), t)
      return t.trim();
    if (r)
      return r;
    throw new p(74);
  }
  a(Jr, "cssVar");
  function G(e) {
    return e.charAt(0).toUpperCase() + e.slice(1);
  }
  a(G, "capitalizeString");
  var Zr = ["Top", "Right", "Bottom", "Left"];
  function Xr(e, r) {
    if (!e) return r.toLowerCase();
    var t = e.split("-");
    if (t.length > 1)
      return t.splice(1, 0, r), t.reduce(function(o, i) {
        return "" + o + G(i);
      });
    var n = e.replace(/([a-z])([A-Z])/g, "$1" + r + "$2");
    return e === n ? "" + e + r : n;
  }
  a(Xr, "generateProperty");
  function Kr(e, r) {
    for (var t = {}, n = 0; n < r.length; n += 1)
      (r[n] || r[n] === 0) && (t[Xr(e, Zr[n])] = r[n]);
    return t;
  }
  a(Kr, "generateStyles");
  function $(e) {
    for (var r = arguments.length, t = new Array(r > 1 ? r - 1 : 0), n = 1; n < r; n++)
      t[n - 1] = arguments[n];
    var o = t[0], i = t[1], s = i === void 0 ? o : i, f = t[2], l = f === void 0 ? o : f, c = t[3], b = c === void 0 ? s : c, d = [o, s, l, b];
    return Kr(e, d);
  }
  a($, "directionalProperty");
  function Le(e, r) {
    return e.substr(-r.length) === r;
  }
  a(Le, "endsWith");
  var _r = /^([+-]?(?:\d+|\d*\.\d+))([a-z]*|%)$/;
  function se(e) {
    if (typeof e != "string") return e;
    var r = e.match(_r);
    return r ? parseFloat(e) : e;
  }
  a(se, "stripUnit");
  var et = /* @__PURE__ */ a(function(r) {
    return function(t, n) {
      n === void 0 && (n = "16px");
      var o = t, i = n;
      if (typeof t == "string") {
        if (!Le(t, "px"))
          throw new p(69, r, t);
        o = se(t);
      }
      if (typeof n == "string") {
        if (!Le(n, "px"))
          throw new p(70, r, n);
        i = se(n);
      }
      if (typeof o == "string")
        throw new p(71, t, r);
      if (typeof i == "string")
        throw new p(72, n, r);
      return "" + o / i + r;
    };
  }, "pxtoFactory"), Qe = et, rt = Qe("em"), tt = rt, nt = /^([+-]?(?:\d+|\d*\.\d+))([a-z]*|%)$/;
  function A(e) {
    if (typeof e != "string") return [e, ""];
    var r = e.match(nt);
    return r ? [parseFloat(e), r[2]] : [e, void 0];
  }
  a(A, "getValueAndUnit");
  function Ye(e, r) {
    if (typeof e != "object" || e === null)
      throw new p(75, typeof e);
    var t = {};
    return Object.keys(e).forEach(function(n) {
      typeof e[n] == "object" && e[n] !== null ? t[n] = Ye(e[n], r) : !r || r && (r === n || r.indexOf(n) >= 0) ? t[n] = e[n] + " !important" :
      t[n] = e[n];
    }), t;
  }
  a(Ye, "important");
  var Je = {
    minorSecond: 1.067,
    majorSecond: 1.125,
    minorThird: 1.2,
    majorThird: 1.25,
    perfectFourth: 1.333,
    augFourth: 1.414,
    perfectFifth: 1.5,
    minorSixth: 1.6,
    goldenSection: 1.618,
    majorSixth: 1.667,
    minorSeventh: 1.778,
    majorSeventh: 1.875,
    octave: 2,
    majorTenth: 2.5,
    majorEleventh: 2.667,
    majorTwelfth: 3,
    doubleOctave: 4
  };
  function at(e) {
    return Je[e];
  }
  a(at, "getRatio");
  function ot(e, r, t) {
    if (r === void 0 && (r = "1em"), t === void 0 && (t = 1.333), typeof e != "number")
      throw new p(42);
    if (typeof t == "string" && !Je[t])
      throw new p(43);
    var n = typeof r == "string" ? A(r) : [r, ""], o = n[0], i = n[1], s = typeof t == "string" ? at(t) : t;
    if (typeof o == "string")
      throw new p(44, r);
    return "" + o * Math.pow(s, e) + (i || "");
  }
  a(ot, "modularScale");
  var it = Qe("rem"), ut = it, fe = 16;
  function Ze(e) {
    var r = A(e);
    if (r[1] === "px")
      return parseFloat(e);
    if (r[1] === "%")
      return parseFloat(e) / 100 * fe;
    throw new p(78, r[1]);
  }
  a(Ze, "convertBase");
  function st() {
    if (typeof document < "u" && document.documentElement !== null) {
      var e = getComputedStyle(document.documentElement).fontSize;
      return e ? Ze(e) : fe;
    }
    return fe;
  }
  a(st, "getBaseFromDoc");
  function ft(e, r) {
    var t = A(e);
    if (t[1] !== "rem" && t[1] !== "")
      throw new p(77, t[1]);
    var n = r ? Ze(r) : st();
    return t[0] * n + "px";
  }
  a(ft, "remToPx");
  var pt = {
    back: "cubic-bezier(0.600, -0.280, 0.735, 0.045)",
    circ: "cubic-bezier(0.600,  0.040, 0.980, 0.335)",
    cubic: "cubic-bezier(0.550,  0.055, 0.675, 0.190)",
    expo: "cubic-bezier(0.950,  0.050, 0.795, 0.035)",
    quad: "cubic-bezier(0.550,  0.085, 0.680, 0.530)",
    quart: "cubic-bezier(0.895,  0.030, 0.685, 0.220)",
    quint: "cubic-bezier(0.755,  0.050, 0.855, 0.060)",
    sine: "cubic-bezier(0.470,  0.000, 0.745, 0.715)"
  };
  function lt(e) {
    return pt[e.toLowerCase().trim()];
  }
  a(lt, "easeIn");
  var dt = {
    back: "cubic-bezier(0.680, -0.550, 0.265, 1.550)",
    circ: "cubic-bezier(0.785,  0.135, 0.150, 0.860)",
    cubic: "cubic-bezier(0.645,  0.045, 0.355, 1.000)",
    expo: "cubic-bezier(1.000,  0.000, 0.000, 1.000)",
    quad: "cubic-bezier(0.455,  0.030, 0.515, 0.955)",
    quart: "cubic-bezier(0.770,  0.000, 0.175, 1.000)",
    quint: "cubic-bezier(0.860,  0.000, 0.070, 1.000)",
    sine: "cubic-bezier(0.445,  0.050, 0.550, 0.950)"
  };
  function ct(e) {
    return dt[e.toLowerCase().trim()];
  }
  a(ct, "easeInOut");
  var mt = {
    back: "cubic-bezier(0.175,  0.885, 0.320, 1.275)",
    cubic: "cubic-bezier(0.215,  0.610, 0.355, 1.000)",
    circ: "cubic-bezier(0.075,  0.820, 0.165, 1.000)",
    expo: "cubic-bezier(0.190,  1.000, 0.220, 1.000)",
    quad: "cubic-bezier(0.250,  0.460, 0.450, 0.940)",
    quart: "cubic-bezier(0.165,  0.840, 0.440, 1.000)",
    quint: "cubic-bezier(0.230,  1.000, 0.320, 1.000)",
    sine: "cubic-bezier(0.390,  0.575, 0.565, 1.000)"
  };
  function gt(e) {
    return mt[e.toLowerCase().trim()];
  }
  a(gt, "easeOut");
  function pe(e, r, t, n) {
    t === void 0 && (t = "320px"), n === void 0 && (n = "1200px");
    var o = A(e), i = o[0], s = o[1], f = A(r), l = f[0], c = f[1], b = A(t), d = b[0], m = b[1], x = A(n), w = x[0], z = x[1];
    if (typeof d != "number" || typeof w != "number" || !m || !z || m !== z)
      throw new p(47);
    if (typeof i != "number" || typeof l != "number" || s !== c)
      throw new p(48);
    if (s !== m || c !== z)
      throw new p(76);
    var v = (i - l) / (d - w), T = l - v * w;
    return "calc(" + T.toFixed(2) + (s || "") + " + " + (100 * v).toFixed(2) + "vw)";
  }
  a(pe, "between");
  function ht(e) {
    var r;
    e === void 0 && (e = "&");
    var t = e + "::after";
    return r = {}, r[t] = {
      clear: "both",
      content: '""',
      display: "table"
    }, r;
  }
  a(ht, "clearFix");
  function bt(e) {
    return e === void 0 && (e = 0), {
      position: "absolute",
      top: e,
      right: e,
      bottom: e,
      left: e
    };
  }
  a(bt, "cover");
  function vt(e, r) {
    r === void 0 && (r = 1);
    var t = {
      display: "inline-block",
      maxWidth: e || "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      wordWrap: "normal"
    };
    return r > 1 ? h.default({}, t, {
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: r,
      display: "-webkit-box",
      whiteSpace: "normal"
    }) : t;
  }
  a(vt, "ellipsis");
  function yt(e, r) {
    var t = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (t) return (t = t.call(e)).next.bind(t);
    if (Array.isArray(e) || (t = xt(e)) || r && e && typeof e.length == "number") {
      t && (e = t);
      var n = 0;
      return function() {
        return n >= e.length ? { done: !0 } : { done: !1, value: e[n++] };
      };
    }
    throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  a(yt, "_createForOfIteratorHelperLoose");
  function xt(e, r) {
    if (e) {
      if (typeof e == "string") return He(e, r);
      var t = Object.prototype.toString.call(e).slice(8, -1);
      if (t === "Object" && e.constructor && (t = e.constructor.name), t === "Map" || t === "Set") return Array.from(e);
      if (t === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t)) return He(e, r);
    }
  }
  a(xt, "_unsupportedIterableToArray");
  function He(e, r) {
    (r == null || r > e.length) && (r = e.length);
    for (var t = 0, n = new Array(r); t < r; t++) n[t] = e[t];
    return n;
  }
  a(He, "_arrayLikeToArray");
  function wt(e, r, t) {
    if (r === void 0 && (r = "320px"), t === void 0 && (t = "1200px"), !Array.isArray(e) && typeof e != "object" || e === null)
      throw new p(49);
    if (Array.isArray(e)) {
      for (var n = {}, o = {}, i = yt(e), s; !(s = i()).done; ) {
        var f, l, c = s.value;
        if (!c.prop || !c.fromSize || !c.toSize)
          throw new p(50);
        o[c.prop] = c.fromSize, n["@media (min-width: " + r + ")"] = h.default({}, n["@media (min-width: " + r + ")"], (f = {}, f[c.prop] = pe(
        c.fromSize, c.toSize, r, t), f)), n["@media (min-width: " + t + ")"] = h.default({}, n["@media (min-width: " + t + ")"], (l = {}, l[c.
        prop] = c.toSize, l));
      }
      return h.default({}, o, n);
    } else {
      var b, d, m;
      if (!e.prop || !e.fromSize || !e.toSize)
        throw new p(51);
      return m = {}, m[e.prop] = e.fromSize, m["@media (min-width: " + r + ")"] = (b = {}, b[e.prop] = pe(e.fromSize, e.toSize, r, t), b), m["\
@media (min-width: " + t + ")"] = (d = {}, d[e.prop] = e.toSize, d), m;
    }
  }
  a(wt, "fluidRange");
  var St = /^\s*data:([a-z]+\/[a-z-]+(;[a-z-]+=[a-z-]+)?)?(;charset=[a-z0-9-]+)?(;base64)?,[a-z0-9!$&',()*+,;=\-._~:@/?%\s]*\s*$/i, Ft = {
    woff: "woff",
    woff2: "woff2",
    ttf: "truetype",
    otf: "opentype",
    eot: "embedded-opentype",
    svg: "svg",
    svgz: "svg"
  };
  function Ee(e, r) {
    return r ? ' format("' + Ft[e] + '")' : "";
  }
  a(Ee, "generateFormatHint");
  function Ct(e) {
    return !!e.replace(/\s+/g, " ").match(St);
  }
  a(Ct, "isDataURI");
  function zt(e, r, t) {
    if (Ct(e))
      return 'url("' + e + '")' + Ee(r[0], t);
    var n = r.map(function(o) {
      return 'url("' + e + "." + o + '")' + Ee(o, t);
    });
    return n.join(", ");
  }
  a(zt, "generateFileReferences");
  function Tt(e) {
    var r = e.map(function(t) {
      return 'local("' + t + '")';
    });
    return r.join(", ");
  }
  a(Tt, "generateLocalReferences");
  function At(e, r, t, n) {
    var o = [];
    return r && o.push(Tt(r)), e && o.push(zt(e, t, n)), o.join(", ");
  }
  a(At, "generateSources");
  function It(e) {
    var r = e.fontFamily, t = e.fontFilePath, n = e.fontStretch, o = e.fontStyle, i = e.fontVariant, s = e.fontWeight, f = e.fileFormats, l = f ===
    void 0 ? ["eot", "woff2", "woff", "ttf", "svg"] : f, c = e.formatHint, b = c === void 0 ? !1 : c, d = e.localFonts, m = d === void 0 ? [
    r] : d, x = e.unicodeRange, w = e.fontDisplay, z = e.fontVariationSettings, v = e.fontFeatureSettings;
    if (!r) throw new p(55);
    if (!t && !m)
      throw new p(52);
    if (m && !Array.isArray(m))
      throw new p(53);
    if (!Array.isArray(l))
      throw new p(54);
    var T = {
      "@font-face": {
        fontFamily: r,
        src: At(t, m, l, b),
        unicodeRange: x,
        fontStretch: n,
        fontStyle: o,
        fontVariant: i,
        fontWeight: s,
        fontDisplay: w,
        fontVariationSettings: z,
        fontFeatureSettings: v
      }
    };
    return JSON.parse(JSON.stringify(T));
  }
  a(It, "fontFace");
  function Rt() {
    return {
      textIndent: "101%",
      overflow: "hidden",
      whiteSpace: "nowrap"
    };
  }
  a(Rt, "hideText");
  function jt() {
    return {
      border: "0",
      clip: "rect(0 0 0 0)",
      height: "1px",
      margin: "-1px",
      overflow: "hidden",
      padding: "0",
      position: "absolute",
      whiteSpace: "nowrap",
      width: "1px"
    };
  }
  a(jt, "hideVisually");
  function Xe(e) {
    return e === void 0 && (e = 1.3), `
    @media only screen and (-webkit-min-device-pixel-ratio: ` + e + `),
    only screen and (min--moz-device-pixel-ratio: ` + e + `),
    only screen and (-o-min-device-pixel-ratio: ` + e + `/1),
    only screen and (min-resolution: ` + Math.round(e * 96) + `dpi),
    only screen and (min-resolution: ` + e + `dppx)
  `;
  }
  a(Xe, "hiDPI");
  function Ke(e) {
    for (var r = "", t = arguments.length, n = new Array(t > 1 ? t - 1 : 0), o = 1; o < t; o++)
      n[o - 1] = arguments[o];
    for (var i = 0; i < e.length; i += 1)
      if (r += e[i], i === n.length - 1 && n[i]) {
        var s = n.filter(function(f) {
          return !!f;
        });
        s.length > 1 ? (r = r.slice(0, -1), r += ", " + n[i]) : s.length === 1 && (r += "" + n[i]);
      } else n[i] && (r += n[i] + " ");
    return r.trim();
  }
  a(Ke, "constructGradientValue");
  var De;
  function Ot(e) {
    var r = e.colorStops, t = e.fallback, n = e.toDirection, o = n === void 0 ? "" : n;
    if (!r || r.length < 2)
      throw new p(56);
    return {
      backgroundColor: t || r[0].replace(/,\s+/g, ",").split(" ")[0].replace(/,(?=\S)/g, ", "),
      backgroundImage: Ke(De || (De = Ge.default(["linear-gradient(", "", ")"])), o, r.join(", ").replace(/,(?=\S)/g, ", "))
    };
  }
  a(Ot, "linearGradient");
  function Mt() {
    var e;
    return [(e = {
      html: {
        lineHeight: "1.15",
        textSizeAdjust: "100%"
      },
      body: {
        margin: "0"
      },
      main: {
        display: "block"
      },
      h1: {
        fontSize: "2em",
        margin: "0.67em 0"
      },
      hr: {
        boxSizing: "content-box",
        height: "0",
        overflow: "visible"
      },
      pre: {
        fontFamily: "monospace, monospace",
        fontSize: "1em"
      },
      a: {
        backgroundColor: "transparent"
      },
      "abbr[title]": {
        borderBottom: "none",
        textDecoration: "underline"
      }
    }, e[`b,
    strong`] = {
      fontWeight: "bolder"
    }, e[`code,
    kbd,
    samp`] = {
      fontFamily: "monospace, monospace",
      fontSize: "1em"
    }, e.small = {
      fontSize: "80%"
    }, e[`sub,
    sup`] = {
      fontSize: "75%",
      lineHeight: "0",
      position: "relative",
      verticalAlign: "baseline"
    }, e.sub = {
      bottom: "-0.25em"
    }, e.sup = {
      top: "-0.5em"
    }, e.img = {
      borderStyle: "none"
    }, e[`button,
    input,
    optgroup,
    select,
    textarea`] = {
      fontFamily: "inherit",
      fontSize: "100%",
      lineHeight: "1.15",
      margin: "0"
    }, e[`button,
    input`] = {
      overflow: "visible"
    }, e[`button,
    select`] = {
      textTransform: "none"
    }, e[`button,
    html [type="button"],
    [type="reset"],
    [type="submit"]`] = {
      WebkitAppearance: "button"
    }, e[`button::-moz-focus-inner,
    [type="button"]::-moz-focus-inner,
    [type="reset"]::-moz-focus-inner,
    [type="submit"]::-moz-focus-inner`] = {
      borderStyle: "none",
      padding: "0"
    }, e[`button:-moz-focusring,
    [type="button"]:-moz-focusring,
    [type="reset"]:-moz-focusring,
    [type="submit"]:-moz-focusring`] = {
      outline: "1px dotted ButtonText"
    }, e.fieldset = {
      padding: "0.35em 0.625em 0.75em"
    }, e.legend = {
      boxSizing: "border-box",
      color: "inherit",
      display: "table",
      maxWidth: "100%",
      padding: "0",
      whiteSpace: "normal"
    }, e.progress = {
      verticalAlign: "baseline"
    }, e.textarea = {
      overflow: "auto"
    }, e[`[type="checkbox"],
    [type="radio"]`] = {
      boxSizing: "border-box",
      padding: "0"
    }, e[`[type="number"]::-webkit-inner-spin-button,
    [type="number"]::-webkit-outer-spin-button`] = {
      height: "auto"
    }, e['[type="search"]'] = {
      WebkitAppearance: "textfield",
      outlineOffset: "-2px"
    }, e['[type="search"]::-webkit-search-decoration'] = {
      WebkitAppearance: "none"
    }, e["::-webkit-file-upload-button"] = {
      WebkitAppearance: "button",
      font: "inherit"
    }, e.details = {
      display: "block"
    }, e.summary = {
      display: "list-item"
    }, e.template = {
      display: "none"
    }, e["[hidden]"] = {
      display: "none"
    }, e), {
      "abbr[title]": {
        textDecoration: "underline dotted"
      }
    }];
  }
  a(Mt, "normalize");
  var qe;
  function kt(e) {
    var r = e.colorStops, t = e.extent, n = t === void 0 ? "" : t, o = e.fallback, i = e.position, s = i === void 0 ? "" : i, f = e.shape, l = f ===
    void 0 ? "" : f;
    if (!r || r.length < 2)
      throw new p(57);
    return {
      backgroundColor: o || r[0].split(" ")[0],
      backgroundImage: Ke(qe || (qe = Ge.default(["radial-gradient(", "", "", "", ")"])), s, l, n, r.join(", "))
    };
  }
  a(kt, "radialGradient");
  function $t(e, r, t, n, o) {
    var i;
    if (t === void 0 && (t = "png"), o === void 0 && (o = "_2x"), !e)
      throw new p(58);
    var s = t.replace(/^\./, ""), f = n ? n + "." + s : "" + e + o + "." + s;
    return i = {
      backgroundImage: "url(" + e + "." + s + ")"
    }, i[Xe()] = h.default({
      backgroundImage: "url(" + f + ")"
    }, r ? {
      backgroundSize: r
    } : {}), i;
  }
  a($t, "retinaImage");
  var Pt = {
    easeInBack: "cubic-bezier(0.600, -0.280, 0.735, 0.045)",
    easeInCirc: "cubic-bezier(0.600,  0.040, 0.980, 0.335)",
    easeInCubic: "cubic-bezier(0.550,  0.055, 0.675, 0.190)",
    easeInExpo: "cubic-bezier(0.950,  0.050, 0.795, 0.035)",
    easeInQuad: "cubic-bezier(0.550,  0.085, 0.680, 0.530)",
    easeInQuart: "cubic-bezier(0.895,  0.030, 0.685, 0.220)",
    easeInQuint: "cubic-bezier(0.755,  0.050, 0.855, 0.060)",
    easeInSine: "cubic-bezier(0.470,  0.000, 0.745, 0.715)",
    easeOutBack: "cubic-bezier(0.175,  0.885, 0.320, 1.275)",
    easeOutCubic: "cubic-bezier(0.215,  0.610, 0.355, 1.000)",
    easeOutCirc: "cubic-bezier(0.075,  0.820, 0.165, 1.000)",
    easeOutExpo: "cubic-bezier(0.190,  1.000, 0.220, 1.000)",
    easeOutQuad: "cubic-bezier(0.250,  0.460, 0.450, 0.940)",
    easeOutQuart: "cubic-bezier(0.165,  0.840, 0.440, 1.000)",
    easeOutQuint: "cubic-bezier(0.230,  1.000, 0.320, 1.000)",
    easeOutSine: "cubic-bezier(0.390,  0.575, 0.565, 1.000)",
    easeInOutBack: "cubic-bezier(0.680, -0.550, 0.265, 1.550)",
    easeInOutCirc: "cubic-bezier(0.785,  0.135, 0.150, 0.860)",
    easeInOutCubic: "cubic-bezier(0.645,  0.045, 0.355, 1.000)",
    easeInOutExpo: "cubic-bezier(1.000,  0.000, 0.000, 1.000)",
    easeInOutQuad: "cubic-bezier(0.455,  0.030, 0.515, 0.955)",
    easeInOutQuart: "cubic-bezier(0.770,  0.000, 0.175, 1.000)",
    easeInOutQuint: "cubic-bezier(0.860,  0.000, 0.070, 1.000)",
    easeInOutSine: "cubic-bezier(0.445,  0.050, 0.550, 0.950)"
  };
  function Bt(e) {
    return Pt[e];
  }
  a(Bt, "getTimingFunction");
  function Lt(e) {
    return Bt(e);
  }
  a(Lt, "timingFunctions");
  var Ht = /* @__PURE__ */ a(function(r, t, n) {
    var o = "" + n[0] + (n[1] || ""), i = "" + n[0] / 2 + (n[1] || ""), s = "" + t[0] + (t[1] || ""), f = "" + t[0] / 2 + (t[1] || "");
    switch (r) {
      case "top":
        return "0 " + i + " " + s + " " + i;
      case "topLeft":
        return o + " " + s + " 0 0";
      case "left":
        return f + " " + o + " " + f + " 0";
      case "bottomLeft":
        return o + " 0 0 " + s;
      case "bottom":
        return s + " " + i + " 0 " + i;
      case "bottomRight":
        return "0 0 " + o + " " + s;
      case "right":
        return f + " 0 " + f + " " + o;
      case "topRight":
      default:
        return "0 " + o + " " + s + " 0";
    }
  }, "getBorderWidth"), Et = /* @__PURE__ */ a(function(r, t) {
    switch (r) {
      case "top":
      case "bottomRight":
        return {
          borderBottomColor: t
        };
      case "right":
      case "bottomLeft":
        return {
          borderLeftColor: t
        };
      case "bottom":
      case "topLeft":
        return {
          borderTopColor: t
        };
      case "left":
      case "topRight":
        return {
          borderRightColor: t
        };
      default:
        throw new p(59);
    }
  }, "getBorderColor");
  function Dt(e) {
    var r = e.pointingDirection, t = e.height, n = e.width, o = e.foregroundColor, i = e.backgroundColor, s = i === void 0 ? "transparent" :
    i, f = A(n), l = A(t);
    if (isNaN(l[0]) || isNaN(f[0]))
      throw new p(60);
    return h.default({
      width: "0",
      height: "0",
      borderColor: s
    }, Et(r, o), {
      borderStyle: "solid",
      borderWidth: Ht(r, l, f)
    });
  }
  a(Dt, "triangle");
  function qt(e) {
    e === void 0 && (e = "break-word");
    var r = e === "break-word" ? "break-all" : e;
    return {
      overflowWrap: e,
      wordWrap: e,
      wordBreak: r
    };
  }
  a(qt, "wordWrap");
  function oe(e) {
    return Math.round(e * 255);
  }
  a(oe, "colorToInt");
  function Wt(e, r, t) {
    return oe(e) + "," + oe(r) + "," + oe(t);
  }
  a(Wt, "convertToInt");
  function Q(e, r, t, n) {
    if (n === void 0 && (n = Wt), r === 0)
      return n(t, t, t);
    var o = (e % 360 + 360) % 360 / 60, i = (1 - Math.abs(2 * t - 1)) * r, s = i * (1 - Math.abs(o % 2 - 1)), f = 0, l = 0, c = 0;
    o >= 0 && o < 1 ? (f = i, l = s) : o >= 1 && o < 2 ? (f = s, l = i) : o >= 2 && o < 3 ? (l = i, c = s) : o >= 3 && o < 4 ? (l = s, c = i) :
    o >= 4 && o < 5 ? (f = s, c = i) : o >= 5 && o < 6 && (f = i, c = s);
    var b = t - i / 2, d = f + b, m = l + b, x = c + b;
    return n(d, m, x);
  }
  a(Q, "hslToRgb");
  var We = {
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
  function Ut(e) {
    if (typeof e != "string") return e;
    var r = e.toLowerCase();
    return We[r] ? "#" + We[r] : e;
  }
  a(Ut, "nameToHex");
  var Vt = /^#[a-fA-F0-9]{6}$/, Nt = /^#[a-fA-F0-9]{8}$/, Gt = /^#[a-fA-F0-9]{3}$/, Qt = /^#[a-fA-F0-9]{4}$/, ie = /^rgb\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*\)$/i,
  Yt = /^rgb(?:a)?\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i, Jt = /^hsl\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*\)$/i,
  Zt = /^hsl(?:a)?\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i;
  function k(e) {
    if (typeof e != "string")
      throw new p(3);
    var r = Ut(e);
    if (r.match(Vt))
      return {
        red: parseInt("" + r[1] + r[2], 16),
        green: parseInt("" + r[3] + r[4], 16),
        blue: parseInt("" + r[5] + r[6], 16)
      };
    if (r.match(Nt)) {
      var t = parseFloat((parseInt("" + r[7] + r[8], 16) / 255).toFixed(2));
      return {
        red: parseInt("" + r[1] + r[2], 16),
        green: parseInt("" + r[3] + r[4], 16),
        blue: parseInt("" + r[5] + r[6], 16),
        alpha: t
      };
    }
    if (r.match(Gt))
      return {
        red: parseInt("" + r[1] + r[1], 16),
        green: parseInt("" + r[2] + r[2], 16),
        blue: parseInt("" + r[3] + r[3], 16)
      };
    if (r.match(Qt)) {
      var n = parseFloat((parseInt("" + r[4] + r[4], 16) / 255).toFixed(2));
      return {
        red: parseInt("" + r[1] + r[1], 16),
        green: parseInt("" + r[2] + r[2], 16),
        blue: parseInt("" + r[3] + r[3], 16),
        alpha: n
      };
    }
    var o = ie.exec(r);
    if (o)
      return {
        red: parseInt("" + o[1], 10),
        green: parseInt("" + o[2], 10),
        blue: parseInt("" + o[3], 10)
      };
    var i = Yt.exec(r.substring(0, 50));
    if (i)
      return {
        red: parseInt("" + i[1], 10),
        green: parseInt("" + i[2], 10),
        blue: parseInt("" + i[3], 10),
        alpha: parseFloat("" + i[4]) > 1 ? parseFloat("" + i[4]) / 100 : parseFloat("" + i[4])
      };
    var s = Jt.exec(r);
    if (s) {
      var f = parseInt("" + s[1], 10), l = parseInt("" + s[2], 10) / 100, c = parseInt("" + s[3], 10) / 100, b = "rgb(" + Q(f, l, c) + ")", d = ie.
      exec(b);
      if (!d)
        throw new p(4, r, b);
      return {
        red: parseInt("" + d[1], 10),
        green: parseInt("" + d[2], 10),
        blue: parseInt("" + d[3], 10)
      };
    }
    var m = Zt.exec(r.substring(0, 50));
    if (m) {
      var x = parseInt("" + m[1], 10), w = parseInt("" + m[2], 10) / 100, z = parseInt("" + m[3], 10) / 100, v = "rgb(" + Q(x, w, z) + ")", T = ie.
      exec(v);
      if (!T)
        throw new p(4, r, v);
      return {
        red: parseInt("" + T[1], 10),
        green: parseInt("" + T[2], 10),
        blue: parseInt("" + T[3], 10),
        alpha: parseFloat("" + m[4]) > 1 ? parseFloat("" + m[4]) / 100 : parseFloat("" + m[4])
      };
    }
    throw new p(5);
  }
  a(k, "parseToRgb");
  function Xt(e) {
    var r = e.red / 255, t = e.green / 255, n = e.blue / 255, o = Math.max(r, t, n), i = Math.min(r, t, n), s = (o + i) / 2;
    if (o === i)
      return e.alpha !== void 0 ? {
        hue: 0,
        saturation: 0,
        lightness: s,
        alpha: e.alpha
      } : {
        hue: 0,
        saturation: 0,
        lightness: s
      };
    var f, l = o - i, c = s > 0.5 ? l / (2 - o - i) : l / (o + i);
    switch (o) {
      case r:
        f = (t - n) / l + (t < n ? 6 : 0);
        break;
      case t:
        f = (n - r) / l + 2;
        break;
      default:
        f = (r - t) / l + 4;
        break;
    }
    return f *= 60, e.alpha !== void 0 ? {
      hue: f,
      saturation: c,
      lightness: s,
      alpha: e.alpha
    } : {
      hue: f,
      saturation: c,
      lightness: s
    };
  }
  a(Xt, "rgbToHsl");
  function C(e) {
    return Xt(k(e));
  }
  a(C, "parseToHsl");
  var Kt = /* @__PURE__ */ a(function(r) {
    return r.length === 7 && r[1] === r[2] && r[3] === r[4] && r[5] === r[6] ? "#" + r[1] + r[3] + r[5] : r;
  }, "reduceHexValue"), le = Kt;
  function P(e) {
    var r = e.toString(16);
    return r.length === 1 ? "0" + r : r;
  }
  a(P, "numberToHex");
  function ue(e) {
    return P(Math.round(e * 255));
  }
  a(ue, "colorToHex");
  function _t(e, r, t) {
    return le("#" + ue(e) + ue(r) + ue(t));
  }
  a(_t, "convertToHex");
  function X(e, r, t) {
    return Q(e, r, t, _t);
  }
  a(X, "hslToHex");
  function de(e, r, t) {
    if (typeof e == "number" && typeof r == "number" && typeof t == "number")
      return X(e, r, t);
    if (typeof e == "object" && r === void 0 && t === void 0)
      return X(e.hue, e.saturation, e.lightness);
    throw new p(1);
  }
  a(de, "hsl");
  function ce(e, r, t, n) {
    if (typeof e == "number" && typeof r == "number" && typeof t == "number" && typeof n == "number")
      return n >= 1 ? X(e, r, t) : "rgba(" + Q(e, r, t) + "," + n + ")";
    if (typeof e == "object" && r === void 0 && t === void 0 && n === void 0)
      return e.alpha >= 1 ? X(e.hue, e.saturation, e.lightness) : "rgba(" + Q(e.hue, e.saturation, e.lightness) + "," + e.alpha + ")";
    throw new p(2);
  }
  a(ce, "hsla");
  function Y(e, r, t) {
    if (typeof e == "number" && typeof r == "number" && typeof t == "number")
      return le("#" + P(e) + P(r) + P(t));
    if (typeof e == "object" && r === void 0 && t === void 0)
      return le("#" + P(e.red) + P(e.green) + P(e.blue));
    throw new p(6);
  }
  a(Y, "rgb");
  function L(e, r, t, n) {
    if (typeof e == "string" && typeof r == "number") {
      var o = k(e);
      return "rgba(" + o.red + "," + o.green + "," + o.blue + "," + r + ")";
    } else {
      if (typeof e == "number" && typeof r == "number" && typeof t == "number" && typeof n == "number")
        return n >= 1 ? Y(e, r, t) : "rgba(" + e + "," + r + "," + t + "," + n + ")";
      if (typeof e == "object" && r === void 0 && t === void 0 && n === void 0)
        return e.alpha >= 1 ? Y(e.red, e.green, e.blue) : "rgba(" + e.red + "," + e.green + "," + e.blue + "," + e.alpha + ")";
    }
    throw new p(7);
  }
  a(L, "rgba");
  var en = /* @__PURE__ */ a(function(r) {
    return typeof r.red == "number" && typeof r.green == "number" && typeof r.blue == "number" && (typeof r.alpha != "number" || typeof r.alpha >
    "u");
  }, "isRgb"), rn = /* @__PURE__ */ a(function(r) {
    return typeof r.red == "number" && typeof r.green == "number" && typeof r.blue == "number" && typeof r.alpha == "number";
  }, "isRgba"), tn = /* @__PURE__ */ a(function(r) {
    return typeof r.hue == "number" && typeof r.saturation == "number" && typeof r.lightness == "number" && (typeof r.alpha != "number" || typeof r.
    alpha > "u");
  }, "isHsl"), nn = /* @__PURE__ */ a(function(r) {
    return typeof r.hue == "number" && typeof r.saturation == "number" && typeof r.lightness == "number" && typeof r.alpha == "number";
  }, "isHsla");
  function S(e) {
    if (typeof e != "object") throw new p(8);
    if (rn(e)) return L(e);
    if (en(e)) return Y(e);
    if (nn(e)) return ce(e);
    if (tn(e)) return de(e);
    throw new p(8);
  }
  a(S, "toColorString");
  function _e(e, r, t) {
    return /* @__PURE__ */ a(function() {
      var o = t.concat(Array.prototype.slice.call(arguments));
      return o.length >= r ? e.apply(this, o) : _e(e, r, o);
    }, "fn");
  }
  a(_e, "curried");
  function y(e) {
    return _e(e, e.length, []);
  }
  a(y, "curry");
  function an(e, r) {
    if (r === "transparent") return r;
    var t = C(r);
    return S(h.default({}, t, {
      hue: t.hue + parseFloat(e)
    }));
  }
  a(an, "adjustHue");
  var on = y(an), un = on;
  function sn(e) {
    if (e === "transparent") return e;
    var r = C(e);
    return S(h.default({}, r, {
      hue: (r.hue + 180) % 360
    }));
  }
  a(sn, "complement");
  function H(e, r, t) {
    return Math.max(e, Math.min(r, t));
  }
  a(H, "guard");
  function fn(e, r) {
    if (r === "transparent") return r;
    var t = C(r);
    return S(h.default({}, t, {
      lightness: H(0, 1, t.lightness - parseFloat(e))
    }));
  }
  a(fn, "darken");
  var pn = y(fn), ln = pn;
  function dn(e, r) {
    if (r === "transparent") return r;
    var t = C(r);
    return S(h.default({}, t, {
      saturation: H(0, 1, t.saturation - parseFloat(e))
    }));
  }
  a(dn, "desaturate");
  var cn = y(dn), mn = cn;
  function K(e) {
    if (e === "transparent") return 0;
    var r = k(e), t = Object.keys(r).map(function(s) {
      var f = r[s] / 255;
      return f <= 0.03928 ? f / 12.92 : Math.pow((f + 0.055) / 1.055, 2.4);
    }), n = t[0], o = t[1], i = t[2];
    return parseFloat((0.2126 * n + 0.7152 * o + 0.0722 * i).toFixed(3));
  }
  a(K, "getLuminance");
  function me(e, r) {
    var t = K(e), n = K(r);
    return parseFloat((t > n ? (t + 0.05) / (n + 0.05) : (n + 0.05) / (t + 0.05)).toFixed(2));
  }
  a(me, "getContrast");
  function gn(e) {
    return e === "transparent" ? e : S(h.default({}, C(e), {
      saturation: 0
    }));
  }
  a(gn, "grayscale");
  function hn(e) {
    if (typeof e == "object" && typeof e.hue == "number" && typeof e.saturation == "number" && typeof e.lightness == "number")
      return e.alpha && typeof e.alpha == "number" ? ce({
        hue: e.hue,
        saturation: e.saturation,
        lightness: e.lightness,
        alpha: e.alpha
      }) : de({
        hue: e.hue,
        saturation: e.saturation,
        lightness: e.lightness
      });
    throw new p(45);
  }
  a(hn, "hslToColorString");
  function bn(e) {
    if (e === "transparent") return e;
    var r = k(e);
    return S(h.default({}, r, {
      red: 255 - r.red,
      green: 255 - r.green,
      blue: 255 - r.blue
    }));
  }
  a(bn, "invert");
  function vn(e, r) {
    if (r === "transparent") return r;
    var t = C(r);
    return S(h.default({}, t, {
      lightness: H(0, 1, t.lightness + parseFloat(e))
    }));
  }
  a(vn, "lighten");
  var yn = y(vn), xn = yn;
  function wn(e, r) {
    var t = me(e, r);
    return {
      AA: t >= 4.5,
      AALarge: t >= 3,
      AAA: t >= 7,
      AAALarge: t >= 4.5
    };
  }
  a(wn, "meetsContrastGuidelines");
  function Sn(e, r, t) {
    if (r === "transparent") return t;
    if (t === "transparent") return r;
    if (e === 0) return t;
    var n = k(r), o = h.default({}, n, {
      alpha: typeof n.alpha == "number" ? n.alpha : 1
    }), i = k(t), s = h.default({}, i, {
      alpha: typeof i.alpha == "number" ? i.alpha : 1
    }), f = o.alpha - s.alpha, l = parseFloat(e) * 2 - 1, c = l * f === -1 ? l : l + f, b = 1 + l * f, d = (c / b + 1) / 2, m = 1 - d, x = {
      red: Math.floor(o.red * d + s.red * m),
      green: Math.floor(o.green * d + s.green * m),
      blue: Math.floor(o.blue * d + s.blue * m),
      alpha: o.alpha * parseFloat(e) + s.alpha * (1 - parseFloat(e))
    };
    return L(x);
  }
  a(Sn, "mix");
  var Fn = y(Sn), ge = Fn;
  function Cn(e, r) {
    if (r === "transparent") return r;
    var t = k(r), n = typeof t.alpha == "number" ? t.alpha : 1, o = h.default({}, t, {
      alpha: H(0, 1, (n * 100 + parseFloat(e) * 100) / 100)
    });
    return L(o);
  }
  a(Cn, "opacify");
  var zn = y(Cn), Tn = zn, Ue = "#000", Ve = "#fff";
  function An(e, r, t, n) {
    r === void 0 && (r = Ue), t === void 0 && (t = Ve), n === void 0 && (n = !0);
    var o = K(e) > 0.179, i = o ? r : t;
    return !n || me(e, i) >= 4.5 ? i : o ? Ue : Ve;
  }
  a(An, "readableColor");
  function In(e) {
    if (typeof e == "object" && typeof e.red == "number" && typeof e.green == "number" && typeof e.blue == "number")
      return typeof e.alpha == "number" ? L({
        red: e.red,
        green: e.green,
        blue: e.blue,
        alpha: e.alpha
      }) : Y({
        red: e.red,
        green: e.green,
        blue: e.blue
      });
    throw new p(46);
  }
  a(In, "rgbToColorString");
  function Rn(e, r) {
    if (r === "transparent") return r;
    var t = C(r);
    return S(h.default({}, t, {
      saturation: H(0, 1, t.saturation + parseFloat(e))
    }));
  }
  a(Rn, "saturate");
  var jn = y(Rn), On = jn;
  function Mn(e, r) {
    return r === "transparent" ? r : S(h.default({}, C(r), {
      hue: parseFloat(e)
    }));
  }
  a(Mn, "setHue");
  var kn = y(Mn), $n = kn;
  function Pn(e, r) {
    return r === "transparent" ? r : S(h.default({}, C(r), {
      lightness: parseFloat(e)
    }));
  }
  a(Pn, "setLightness");
  var Bn = y(Pn), Ln = Bn;
  function Hn(e, r) {
    return r === "transparent" ? r : S(h.default({}, C(r), {
      saturation: parseFloat(e)
    }));
  }
  a(Hn, "setSaturation");
  var En = y(Hn), Dn = En;
  function qn(e, r) {
    return r === "transparent" ? r : ge(parseFloat(e), "rgb(0, 0, 0)", r);
  }
  a(qn, "shade");
  var Wn = y(qn), Un = Wn;
  function Vn(e, r) {
    return r === "transparent" ? r : ge(parseFloat(e), "rgb(255, 255, 255)", r);
  }
  a(Vn, "tint");
  var Nn = y(Vn), Gn = Nn;
  function Qn(e, r) {
    if (r === "transparent") return r;
    var t = k(r), n = typeof t.alpha == "number" ? t.alpha : 1, o = h.default({}, t, {
      alpha: H(0, 1, +(n * 100 - parseFloat(e) * 100).toFixed(2) / 100)
    });
    return L(o);
  }
  a(Qn, "transparentize");
  var Yn = y(Qn), Jn = Yn;
  function Zn() {
    for (var e = arguments.length, r = new Array(e), t = 0; t < e; t++)
      r[t] = arguments[t];
    var n = Array.isArray(r[0]);
    if (!n && r.length > 8)
      throw new p(64);
    var o = r.map(function(i) {
      if (n && !Array.isArray(i) || !n && Array.isArray(i))
        throw new p(65);
      if (Array.isArray(i) && i.length > 8)
        throw new p(66);
      return Array.isArray(i) ? i.join(" ") : i;
    }).join(", ");
    return {
      animation: o
    };
  }
  a(Zn, "animation");
  function Xn() {
    for (var e = arguments.length, r = new Array(e), t = 0; t < e; t++)
      r[t] = arguments[t];
    return {
      backgroundImage: r.join(", ")
    };
  }
  a(Xn, "backgroundImages");
  function Kn() {
    for (var e = arguments.length, r = new Array(e), t = 0; t < e; t++)
      r[t] = arguments[t];
    return {
      background: r.join(", ")
    };
  }
  a(Kn, "backgrounds");
  var _n = ["top", "right", "bottom", "left"];
  function ea(e) {
    for (var r = arguments.length, t = new Array(r > 1 ? r - 1 : 0), n = 1; n < r; n++)
      t[n - 1] = arguments[n];
    if (typeof e == "string" && _n.indexOf(e) >= 0) {
      var o;
      return o = {}, o["border" + G(e) + "Width"] = t[0], o["border" + G(e) + "Style"] = t[1], o["border" + G(e) + "Color"] = t[2], o;
    } else
      return t.unshift(e), {
        borderWidth: t[0],
        borderStyle: t[1],
        borderColor: t[2]
      };
  }
  a(ea, "border");
  function ra() {
    for (var e = arguments.length, r = new Array(e), t = 0; t < e; t++)
      r[t] = arguments[t];
    return $.apply(void 0, ["borderColor"].concat(r));
  }
  a(ra, "borderColor");
  function ta(e, r) {
    var t = G(e);
    if (!r && r !== 0)
      throw new p(62);
    if (t === "Top" || t === "Bottom") {
      var n;
      return n = {}, n["border" + t + "RightRadius"] = r, n["border" + t + "LeftRadius"] = r, n;
    }
    if (t === "Left" || t === "Right") {
      var o;
      return o = {}, o["borderTop" + t + "Radius"] = r, o["borderBottom" + t + "Radius"] = r, o;
    }
    throw new p(63);
  }
  a(ta, "borderRadius");
  function na() {
    for (var e = arguments.length, r = new Array(e), t = 0; t < e; t++)
      r[t] = arguments[t];
    return $.apply(void 0, ["borderStyle"].concat(r));
  }
  a(na, "borderStyle");
  function aa() {
    for (var e = arguments.length, r = new Array(e), t = 0; t < e; t++)
      r[t] = arguments[t];
    return $.apply(void 0, ["borderWidth"].concat(r));
  }
  a(aa, "borderWidth");
  function Ne(e, r) {
    var t = r ? ":" + r : "";
    return e(t);
  }
  a(Ne, "generateSelectors");
  function er(e, r, t) {
    if (!r) throw new p(67);
    if (e.length === 0) return Ne(r, null);
    for (var n = [], o = 0; o < e.length; o += 1) {
      if (t && t.indexOf(e[o]) < 0)
        throw new p(68);
      n.push(Ne(r, e[o]));
    }
    return n = n.join(","), n;
  }
  a(er, "statefulSelectors");
  var oa = [void 0, null, "active", "focus", "hover"];
  function ia(e) {
    return "button" + e + `,
  input[type="button"]` + e + `,
  input[type="reset"]` + e + `,
  input[type="submit"]` + e;
  }
  a(ia, "template$1");
  function ua() {
    for (var e = arguments.length, r = new Array(e), t = 0; t < e; t++)
      r[t] = arguments[t];
    return er(r, ia, oa);
  }
  a(ua, "buttons");
  function sa() {
    for (var e = arguments.length, r = new Array(e), t = 0; t < e; t++)
      r[t] = arguments[t];
    return $.apply(void 0, ["margin"].concat(r));
  }
  a(sa, "margin");
  function fa() {
    for (var e = arguments.length, r = new Array(e), t = 0; t < e; t++)
      r[t] = arguments[t];
    return $.apply(void 0, ["padding"].concat(r));
  }
  a(fa, "padding");
  var pa = ["absolute", "fixed", "relative", "static", "sticky"];
  function la(e) {
    for (var r = arguments.length, t = new Array(r > 1 ? r - 1 : 0), n = 1; n < r; n++)
      t[n - 1] = arguments[n];
    return pa.indexOf(e) >= 0 && e ? h.default({}, $.apply(void 0, [""].concat(t)), {
      position: e
    }) : $.apply(void 0, ["", e].concat(t));
  }
  a(la, "position");
  function da(e, r) {
    return r === void 0 && (r = e), {
      height: e,
      width: r
    };
  }
  a(da, "size");
  var ca = [void 0, null, "active", "focus", "hover"];
  function ma(e) {
    return 'input[type="color"]' + e + `,
    input[type="date"]` + e + `,
    input[type="datetime"]` + e + `,
    input[type="datetime-local"]` + e + `,
    input[type="email"]` + e + `,
    input[type="month"]` + e + `,
    input[type="number"]` + e + `,
    input[type="password"]` + e + `,
    input[type="search"]` + e + `,
    input[type="tel"]` + e + `,
    input[type="text"]` + e + `,
    input[type="time"]` + e + `,
    input[type="url"]` + e + `,
    input[type="week"]` + e + `,
    input:not([type])` + e + `,
    textarea` + e;
  }
  a(ma, "template");
  function ga() {
    for (var e = arguments.length, r = new Array(e), t = 0; t < e; t++)
      r[t] = arguments[t];
    return er(r, ma, ca);
  }
  a(ga, "textInputs");
  function ha() {
    for (var e = arguments.length, r = new Array(e), t = 0; t < e; t++)
      r[t] = arguments[t];
    if (Array.isArray(r[0]) && r.length === 2) {
      var n = r[1];
      if (typeof n != "string")
        throw new p(61);
      var o = r[0].map(function(i) {
        return i + " " + n;
      }).join(", ");
      return {
        transition: o
      };
    } else
      return {
        transition: r.join(", ")
      };
  }
  a(ha, "transitions");
  u.adjustHue = un;
  u.animation = Zn;
  u.backgroundImages = Xn;
  u.backgrounds = Kn;
  u.between = pe;
  u.border = ea;
  u.borderColor = ra;
  u.borderRadius = ta;
  u.borderStyle = na;
  u.borderWidth = aa;
  u.buttons = ua;
  u.clearFix = ht;
  u.complement = sn;
  u.cover = bt;
  u.cssVar = Jr;
  u.darken = ln;
  u.desaturate = mn;
  u.directionalProperty = $;
  u.easeIn = lt;
  u.easeInOut = ct;
  u.easeOut = gt;
  u.ellipsis = vt;
  u.em = tt;
  u.fluidRange = wt;
  u.fontFace = It;
  u.getContrast = me;
  u.getLuminance = K;
  u.getValueAndUnit = A;
  u.grayscale = gn;
  u.hiDPI = Xe;
  u.hideText = Rt;
  u.hideVisually = jt;
  u.hsl = de;
  u.hslToColorString = hn;
  u.hsla = ce;
  u.important = Ye;
  u.invert = bn;
  u.lighten = xn;
  u.linearGradient = Ot;
  u.margin = sa;
  u.math = Qr;
  u.meetsContrastGuidelines = wn;
  u.mix = ge;
  u.modularScale = ot;
  u.normalize = Mt;
  u.opacify = Tn;
  u.padding = fa;
  u.parseToHsl = C;
  u.parseToRgb = k;
  u.position = la;
  u.radialGradient = kt;
  u.readableColor = An;
  u.rem = ut;
  u.remToPx = ft;
  u.retinaImage = $t;
  u.rgb = Y;
  u.rgbToColorString = In;
  u.rgba = L;
  u.saturate = On;
  u.setHue = $n;
  u.setLightness = Ln;
  u.setSaturation = Dn;
  u.shade = Un;
  u.size = da;
  u.stripUnit = se;
  u.textInputs = ga;
  u.timingFunctions = Lt;
  u.tint = Gn;
  u.toColorString = S;
  u.transitions = ha;
  u.transparentize = Jn;
  u.triangle = Dt;
  u.wordWrap = qt;
});

// src/theming/create.ts
var Fa = {};
dr(Fa, {
  create: () => Sa,
  themes: () => _
});
module.exports = cr(Fa);

// src/theming/base.ts
var rr = Se(he(), 1), g = {
  // Official color palette
  primary: "#FF4785",
  // coral
  secondary: "#029CFD",
  // ocean
  tertiary: "#FAFBFC",
  ancillary: "#22a699",
  // Complimentary
  orange: "#FC521F",
  gold: "#FFAE00",
  green: "#66BF3C",
  seafoam: "#37D5D3",
  purple: "#6F2CAC",
  ultraviolet: "#2A0481",
  // Monochrome
  lightest: "#FFFFFF",
  lighter: "#F7FAFC",
  light: "#EEF3F6",
  mediumlight: "#ECF4F9",
  medium: "#D9E8F2",
  mediumdark: "#73828C",
  dark: "#5C6870",
  darker: "#454E54",
  darkest: "#2E3438",
  // For borders
  border: "hsla(203, 50%, 30%, 0.15)",
  // Status
  positive: "#66BF3C",
  negative: "#FF4400",
  warning: "#E69D00",
  critical: "#FFFFFF",
  // Text
  defaultText: "#2E3438",
  inverseText: "#FFFFFF",
  positiveText: "#448028",
  negativeText: "#D43900",
  warningText: "#A15C20"
}, be = {
  app: "#F6F9FC",
  bar: g.lightest,
  content: g.lightest,
  preview: g.lightest,
  gridCellSize: 10,
  hoverable: (0, rr.transparentize)(0.9, g.secondary),
  // hover state for items in a list
  // Notification, error, and warning backgrounds
  positive: "#E1FFD4",
  negative: "#FEDED2",
  warning: "#FFF5CF",
  critical: "#FF4400"
}, E = {
  fonts: {
    base: [
      '"Nunito Sans"',
      "-apple-system",
      '".SFNSText-Regular"',
      '"San Francisco"',
      "BlinkMacSystemFont",
      '"Segoe UI"',
      '"Helvetica Neue"',
      "Helvetica",
      "Arial",
      "sans-serif"
    ].join(", "),
    mono: [
      "ui-monospace",
      "Menlo",
      "Monaco",
      '"Roboto Mono"',
      '"Oxygen Mono"',
      '"Ubuntu Monospace"',
      '"Source Code Pro"',
      '"Droid Sans Mono"',
      '"Courier New"',
      "monospace"
    ].join(", ")
  },
  weight: {
    regular: 400,
    bold: 700
  },
  size: {
    s1: 12,
    s2: 14,
    s3: 16,
    m1: 20,
    m2: 24,
    m3: 28,
    l1: 32,
    l2: 40,
    l3: 48,
    code: 90
  }
};

// src/theming/themes/dark.ts
var ba = {
  base: "dark",
  // Storybook-specific color palette
  colorPrimary: "#FF4785",
  // coral
  colorSecondary: "#029CFD",
  // ocean
  // UI
  appBg: "#222425",
  appContentBg: "#1B1C1D",
  appPreviewBg: g.lightest,
  appBorderColor: "rgba(255,255,255,.1)",
  appBorderRadius: 4,
  // Fonts
  fontBase: E.fonts.base,
  fontCode: E.fonts.mono,
  // Text colors
  textColor: "#C9CDCF",
  textInverseColor: "#222425",
  textMutedColor: "#798186",
  // Toolbar default and active colors
  barTextColor: g.mediumdark,
  barHoverColor: g.secondary,
  barSelectedColor: g.secondary,
  barBg: "#292C2E",
  // Form colors
  buttonBg: "#222425",
  buttonBorder: "rgba(255,255,255,.1)",
  booleanBg: "#222425",
  booleanSelectedBg: "#2E3438",
  inputBg: "#1B1C1D",
  inputBorder: "rgba(255,255,255,.1)",
  inputTextColor: g.lightest,
  inputBorderRadius: 4
}, tr = ba;

// src/theming/themes/light.ts
var va = {
  base: "light",
  // Storybook-specific color palette
  colorPrimary: "#FF4785",
  // coral
  colorSecondary: "#029CFD",
  // ocean
  // UI
  appBg: be.app,
  appContentBg: g.lightest,
  appPreviewBg: g.lightest,
  appBorderColor: g.border,
  appBorderRadius: 4,
  // Fonts
  fontBase: E.fonts.base,
  fontCode: E.fonts.mono,
  // Text colors
  textColor: g.darkest,
  textInverseColor: g.lightest,
  textMutedColor: g.dark,
  // Toolbar default and active colors
  barTextColor: g.mediumdark,
  barHoverColor: g.secondary,
  barSelectedColor: g.secondary,
  barBg: g.lightest,
  // Form colors
  buttonBg: be.app,
  buttonBorder: g.medium,
  booleanBg: g.mediumlight,
  booleanSelectedBg: g.lightest,
  inputBg: g.lightest,
  inputBorder: g.border,
  inputTextColor: g.darkest,
  inputBorderRadius: 4
}, ve = va;

// src/theming/utils.ts
var nr = require("storybook/internal/client-logger"), ar = require("@storybook/global"), B = Se(he(), 1);
var { window: ye } = ar.global;
var ya = /* @__PURE__ */ a((e) => typeof e != "string" ? (nr.logger.warn(
  `Color passed to theme object should be a string. Instead ${e}(${typeof e}) was passed.`
), !1) : !0, "isColorString"), xa = /* @__PURE__ */ a((e) => !/(gradient|var|calc)/.test(e), "isValidColorForPolished"), wa = /* @__PURE__ */ a(
(e, r) => e === "darken" ? (0, B.rgba)(`${(0, B.darken)(1, r)}`, 0.95) : e === "lighten" ? (0, B.rgba)(`${(0, B.lighten)(1, r)}`, 0.95) : r,
"applyPolished"), or = /* @__PURE__ */ a((e) => (r) => {
  if (!ya(r) || !xa(r))
    return r;
  try {
    return wa(e, r);
  } catch {
    return r;
  }
}, "colorFactory"), Ka = or("lighten"), _a = or("darken"), ir = /* @__PURE__ */ a(() => !ye || !ye.matchMedia ? "light" : ye.matchMedia("(pr\
efers-color-scheme: dark)").matches ? "dark" : "light", "getPreferredColorScheme");

// src/theming/create.ts
var _ = {
  light: ve,
  dark: tr,
  normal: ve
}, xe = ir(), Sa = /* @__PURE__ */ a((e = { base: xe }, r) => {
  let t = {
    ..._[xe],
    ..._[e.base] || {},
    ...e,
    base: _[e.base] ? e.base : xe
  };
  return {
    ...r,
    ...t,
    barSelectedColor: e.barSelectedColor || t.colorSecondary
  };
}, "create");
