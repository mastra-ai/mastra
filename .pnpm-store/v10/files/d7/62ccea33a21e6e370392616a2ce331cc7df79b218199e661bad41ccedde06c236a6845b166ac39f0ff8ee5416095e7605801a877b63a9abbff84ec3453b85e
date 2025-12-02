var cf = Object.create;
var Fr = Object.defineProperty;
var pf = Object.getOwnPropertyDescriptor;
var uf = Object.getOwnPropertyNames;
var df = Object.getPrototypeOf, ff = Object.prototype.hasOwnProperty;
var a = (e, t) => Fr(e, "name", { value: t, configurable: !0 }), rr = /* @__PURE__ */ ((e) => typeof require < "u" ? require : typeof Proxy <
"u" ? new Proxy(e, {
  get: (t, r) => (typeof require < "u" ? require : t)[r]
}) : e)(function(e) {
  if (typeof require < "u") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + e + '" is not supported');
});
var $ = (e, t) => () => (e && (t = e(e = 0)), t);
var J = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports), mf = (e, t) => {
  for (var r in t)
    Fr(e, r, { get: t[r], enumerable: !0 });
}, gf = (e, t, r, o) => {
  if (t && typeof t == "object" || typeof t == "function")
    for (let n of uf(t))
      !ff.call(e, n) && n !== r && Fr(e, n, { get: () => t[n], enumerable: !(o = pf(t, n)) || o.enumerable });
  return e;
};
var Ee = (e, t, r) => (r = e != null ? cf(df(e)) : {}, gf(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  t || !e || !e.__esModule ? Fr(r, "default", { value: e, enumerable: !0 }) : r,
  e
));

// ../node_modules/es-toolkit/dist/compat/predicate/isSymbol.mjs
function Rr(e) {
  return typeof e == "symbol" || e instanceof Symbol;
}
var dn = $(() => {
  a(Rr, "isSymbol");
});

// ../node_modules/es-toolkit/dist/compat/util/toNumber.mjs
function Di(e) {
  return Rr(e) ? NaN : Number(e);
}
var Mi = $(() => {
  dn();
  a(Di, "toNumber");
});

// ../node_modules/es-toolkit/dist/compat/util/toFinite.mjs
function Bi(e) {
  return e ? (e = Di(e), e === 1 / 0 || e === -1 / 0 ? (e < 0 ? -1 : 1) * Number.MAX_VALUE : e === e ? e : 0) : e === 0 ? e : 0;
}
var Fi = $(() => {
  Mi();
  a(Bi, "toFinite");
});

// ../node_modules/es-toolkit/dist/compat/util/toInteger.mjs
function Ri(e) {
  let t = Bi(e), r = t % 1;
  return r ? t - r : t;
}
var ji = $(() => {
  Fi();
  a(Ri, "toInteger");
});

// ../node_modules/es-toolkit/dist/array/uniq.mjs
function Hi(e) {
  return Array.from(new Set(e));
}
var $i = $(() => {
  a(Hi, "uniq");
});

// ../node_modules/es-toolkit/dist/predicate/isPrimitive.mjs
function Vi(e) {
  return e == null || typeof e != "object" && typeof e != "function";
}
var zi = $(() => {
  a(Vi, "isPrimitive");
});

// ../node_modules/es-toolkit/dist/predicate/isTypedArray.mjs
function jr(e) {
  return ArrayBuffer.isView(e) && !(e instanceof DataView);
}
var fn = $(() => {
  a(jr, "isTypedArray");
});

// ../node_modules/es-toolkit/dist/compat/_internal/getSymbols.mjs
function Hr(e) {
  return Object.getOwnPropertySymbols(e).filter((t) => Object.prototype.propertyIsEnumerable.call(e, t));
}
var mn = $(() => {
  a(Hr, "getSymbols");
});

// ../node_modules/es-toolkit/dist/compat/_internal/getTag.mjs
function Ui(e) {
  return e == null ? e === void 0 ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(e);
}
var qi = $(() => {
  a(Ui, "getTag");
});

// ../node_modules/es-toolkit/dist/compat/_internal/tags.mjs
var Wi, $r, Vr, zr, Ur, Gi, Ji, Ki, Yi, Xi, Zi, Qi, es, ts, rs, os, ns, as, is, ss, ls, cs, gn = $(() => {
  Wi = "[object RegExp]", $r = "[object String]", Vr = "[object Number]", zr = "[object Boolean]", Ur = "[object Arguments]", Gi = "[object \
Symbol]", Ji = "[object Date]", Ki = "[object Map]", Yi = "[object Set]", Xi = "[object Array]", Zi = "[object ArrayBuffer]", Qi = "[object \
Object]", es = "[object DataView]", ts = "[object Uint8Array]", rs = "[object Uint8ClampedArray]", os = "[object Uint16Array]", ns = "[objec\
t Uint32Array]", as = "[object Int8Array]", is = "[object Int16Array]", ss = "[object Int32Array]", ls = "[object Float32Array]", cs = "[obj\
ect Float64Array]";
});

// ../node_modules/es-toolkit/dist/object/cloneDeepWith.mjs
function ps(e, t) {
  return Mt(e, void 0, e, /* @__PURE__ */ new Map(), t);
}
function Mt(e, t, r, o = /* @__PURE__ */ new Map(), n = void 0) {
  let i = n?.(e, t, r, o);
  if (i != null)
    return i;
  if (Vi(e))
    return e;
  if (o.has(e))
    return o.get(e);
  if (Array.isArray(e)) {
    let s = new Array(e.length);
    o.set(e, s);
    for (let l = 0; l < e.length; l++)
      s[l] = Mt(e[l], l, r, o, n);
    return Object.hasOwn(e, "index") && (s.index = e.index), Object.hasOwn(e, "input") && (s.input = e.input), s;
  }
  if (e instanceof Date)
    return new Date(e.getTime());
  if (e instanceof RegExp) {
    let s = new RegExp(e.source, e.flags);
    return s.lastIndex = e.lastIndex, s;
  }
  if (e instanceof Map) {
    let s = /* @__PURE__ */ new Map();
    o.set(e, s);
    for (let [l, c] of e)
      s.set(l, Mt(c, l, r, o, n));
    return s;
  }
  if (e instanceof Set) {
    let s = /* @__PURE__ */ new Set();
    o.set(e, s);
    for (let l of e)
      s.add(Mt(l, void 0, r, o, n));
    return s;
  }
  if (typeof Buffer < "u" && Buffer.isBuffer(e))
    return e.subarray();
  if (jr(e)) {
    let s = new (Object.getPrototypeOf(e)).constructor(e.length);
    o.set(e, s);
    for (let l = 0; l < e.length; l++)
      s[l] = Mt(e[l], l, r, o, n);
    return s;
  }
  if (e instanceof ArrayBuffer || typeof SharedArrayBuffer < "u" && e instanceof SharedArrayBuffer)
    return e.slice(0);
  if (e instanceof DataView) {
    let s = new DataView(e.buffer.slice(0), e.byteOffset, e.byteLength);
    return o.set(e, s), rt(s, e, r, o, n), s;
  }
  if (typeof File < "u" && e instanceof File) {
    let s = new File([e], e.name, {
      type: e.type
    });
    return o.set(e, s), rt(s, e, r, o, n), s;
  }
  if (e instanceof Blob) {
    let s = new Blob([e], { type: e.type });
    return o.set(e, s), rt(s, e, r, o, n), s;
  }
  if (e instanceof Error) {
    let s = new e.constructor();
    return o.set(e, s), s.message = e.message, s.name = e.name, s.stack = e.stack, s.cause = e.cause, rt(s, e, r, o, n), s;
  }
  if (typeof e == "object" && hf(e)) {
    let s = Object.create(Object.getPrototypeOf(e));
    return o.set(e, s), rt(s, e, r, o, n), s;
  }
  return e;
}
function rt(e, t, r = e, o, n) {
  let i = [...Object.keys(t), ...Hr(t)];
  for (let s = 0; s < i.length; s++) {
    let l = i[s], c = Object.getOwnPropertyDescriptor(e, l);
    (c == null || c.writable) && (e[l] = Mt(t[l], l, r, o, n));
  }
}
function hf(e) {
  switch (Ui(e)) {
    case Ur:
    case Xi:
    case Zi:
    case es:
    case zr:
    case Ji:
    case ls:
    case cs:
    case as:
    case is:
    case ss:
    case Ki:
    case Vr:
    case Qi:
    case Wi:
    case Yi:
    case $r:
    case Gi:
    case ts:
    case rs:
    case os:
    case ns:
      return !0;
    default:
      return !1;
  }
}
var us = $(() => {
  mn();
  qi();
  gn();
  zi();
  fn();
  a(ps, "cloneDeepWith");
  a(Mt, "cloneDeepWithImpl");
  a(rt, "copyProperties");
  a(hf, "isCloneableObject");
});

// ../node_modules/es-toolkit/dist/predicate/isLength.mjs
function ds(e) {
  return Number.isSafeInteger(e) && e >= 0;
}
var fs = $(() => {
  a(ds, "isLength");
});

// ../node_modules/es-toolkit/dist/compat/predicate/isArrayLike.mjs
function Bt(e) {
  return e != null && typeof e != "function" && ds(e.length);
}
var qr = $(() => {
  fs();
  a(Bt, "isArrayLike");
});

// ../node_modules/es-toolkit/dist/compat/object/cloneDeepWith.mjs
function ms(e, t) {
  return ps(e, (r, o, n, i) => {
    let s = t?.(r, o, n, i);
    if (s != null)
      return s;
    if (typeof e == "object")
      switch (Object.prototype.toString.call(e)) {
        case Vr:
        case $r:
        case zr: {
          let l = new e.constructor(e?.valueOf());
          return rt(l, e), l;
        }
        case Ur: {
          let l = {};
          return rt(l, e), l.length = e.length, l[Symbol.iterator] = e[Symbol.iterator], l;
        }
        default:
          return;
      }
  });
}
var gs = $(() => {
  us();
  gn();
  a(ms, "cloneDeepWith");
});

// ../node_modules/es-toolkit/dist/compat/object/cloneDeep.mjs
function hn(e) {
  return ms(e);
}
var hs = $(() => {
  gs();
  a(hn, "cloneDeep");
});

// ../node_modules/es-toolkit/dist/math/range.mjs
function ys(e, t, r = 1) {
  if (t == null && (t = e, e = 0), !Number.isInteger(r) || r === 0)
    throw new Error("The step value must be a non-zero integer.");
  let o = Math.max(Math.ceil((t - e) / r), 0), n = new Array(o);
  for (let i = 0; i < o; i++)
    n[i] = e + i * r;
  return n;
}
var bs = $(() => {
  a(ys, "range");
});

// ../node_modules/es-toolkit/dist/compat/array/uniq.mjs
function yn(e) {
  return Bt(e) ? Hi(Array.from(e)) : [];
}
var xs = $(() => {
  $i();
  qr();
  a(yn, "uniq");
});

// ../node_modules/es-toolkit/dist/function/debounce.mjs
function vs(e, t, { signal: r, edges: o } = {}) {
  let n, i = null, s = o != null && o.includes("leading"), l = o == null || o.includes("trailing"), c = /* @__PURE__ */ a(() => {
    i !== null && (e.apply(n, i), n = void 0, i = null);
  }, "invoke"), u = /* @__PURE__ */ a(() => {
    l && c(), m();
  }, "onTimerEnd"), d = null, g = /* @__PURE__ */ a(() => {
    d != null && clearTimeout(d), d = setTimeout(() => {
      d = null, u();
    }, t);
  }, "schedule"), p = /* @__PURE__ */ a(() => {
    d !== null && (clearTimeout(d), d = null);
  }, "cancelTimer"), m = /* @__PURE__ */ a(() => {
    p(), n = void 0, i = null;
  }, "cancel"), f = /* @__PURE__ */ a(() => {
    p(), c();
  }, "flush"), y = /* @__PURE__ */ a(function(...h) {
    if (r?.aborted)
      return;
    n = this, i = h;
    let b = d == null;
    g(), s && b && c();
  }, "debounced");
  return y.schedule = g, y.cancel = m, y.flush = f, r?.addEventListener("abort", m, { once: !0 }), y;
}
var Es = $(() => {
  a(vs, "debounce");
});

// ../node_modules/es-toolkit/dist/compat/function/debounce.mjs
function bn(e, t = 0, r = {}) {
  typeof r != "object" && (r = {});
  let { signal: o, leading: n = !1, trailing: i = !0, maxWait: s } = r, l = Array(2);
  n && (l[0] = "leading"), i && (l[1] = "trailing");
  let c, u = null, d = vs(function(...m) {
    c = e.apply(this, m), u = null;
  }, t, { signal: o, edges: l }), g = /* @__PURE__ */ a(function(...m) {
    if (s != null) {
      if (u === null)
        u = Date.now();
      else if (Date.now() - u >= s)
        return c = e.apply(this, m), u = Date.now(), d.cancel(), d.schedule(), c;
    }
    return d.apply(this, m), c;
  }, "debounced"), p = /* @__PURE__ */ a(() => (d.flush(), c), "flush");
  return g.cancel = d.cancel, g.flush = p, g;
}
var Ss = $(() => {
  Es();
  a(bn, "debounce");
});

// ../node_modules/es-toolkit/dist/predicate/isBuffer.mjs
function Cs(e) {
  return typeof Buffer < "u" && Buffer.isBuffer(e);
}
var ws = $(() => {
  a(Cs, "isBuffer");
});

// ../node_modules/es-toolkit/dist/compat/_internal/isPrototype.mjs
function Ts(e) {
  let t = e?.constructor, r = typeof t == "function" ? t.prototype : Object.prototype;
  return e === r;
}
var As = $(() => {
  a(Ts, "isPrototype");
});

// ../node_modules/es-toolkit/dist/compat/predicate/isTypedArray.mjs
function ks(e) {
  return jr(e);
}
var Os = $(() => {
  fn();
  a(ks, "isTypedArray");
});

// ../node_modules/es-toolkit/dist/compat/util/times.mjs
function Is(e, t) {
  if (e = Ri(e), e < 1 || !Number.isSafeInteger(e))
    return [];
  let r = new Array(e);
  for (let o = 0; o < e; o++)
    r[o] = typeof t == "function" ? t(o) : o;
  return r;
}
var Ps = $(() => {
  ji();
  a(Is, "times");
});

// ../node_modules/es-toolkit/dist/compat/object/keysIn.mjs
function Ls(e) {
  if (e == null)
    return [];
  switch (typeof e) {
    case "object":
    case "function":
      return Bt(e) ? bf(e) : Ts(e) ? yf(e) : Wr(e);
    default:
      return Wr(Object(e));
  }
}
function Wr(e) {
  let t = [];
  for (let r in e)
    t.push(r);
  return t;
}
function yf(e) {
  return Wr(e).filter((r) => r !== "constructor");
}
function bf(e) {
  let t = Is(e.length, (o) => `${o}`), r = new Set(t);
  return Cs(e) && (r.add("offset"), r.add("parent")), ks(e) && (r.add("buffer"), r.add("byteLength"), r.add("byteOffset")), [...t, ...Wr(e).
  filter((o) => !r.has(o))];
}
var Ns = $(() => {
  ws();
  As();
  qr();
  Os();
  Ps();
  a(Ls, "keysIn");
  a(Wr, "keysInImpl");
  a(yf, "prototypeKeysIn");
  a(bf, "arrayLikeKeysIn");
});

// ../node_modules/es-toolkit/dist/compat/_internal/getSymbolsIn.mjs
function _s(e) {
  let t = [];
  for (; e; )
    t.push(...Hr(e)), e = Object.getPrototypeOf(e);
  return t;
}
var Ds = $(() => {
  mn();
  a(_s, "getSymbolsIn");
});

// ../node_modules/es-toolkit/dist/compat/object/pickBy.mjs
function xn(e, t) {
  if (e == null)
    return {};
  let r = {};
  if (t == null)
    return e;
  let o = Bt(e) ? ys(0, e.length) : [...Ls(e), ..._s(e)];
  for (let n = 0; n < o.length; n++) {
    let i = Rr(o[n]) ? o[n] : o[n].toString(), s = e[i];
    t(s, i, e) && (r[i] = s);
  }
  return r;
}
var Ms = $(() => {
  Ns();
  bs();
  Ds();
  qr();
  dn();
  a(xn, "pickBy");
});

// ../node_modules/es-toolkit/dist/compat/index.mjs
var or = $(() => {
  xs();
  Ss();
  hs();
  Ms();
});

// ../addons/docs/src/blocks/controls/helpers.ts
var X, ct, Ne = $(() => {
  "use strict";
  X = /* @__PURE__ */ a((e) => `control-${e.replace(/\s+/g, "-")}`, "getControlId"), ct = /* @__PURE__ */ a((e) => `set-${e.replace(/\s+/g, "\
-")}`, "getControlSetterButtonId");
});

// ../node_modules/color-name/index.js
var uc = J((A5, pc) => {
  "use strict";
  pc.exports = {
    aliceblue: [240, 248, 255],
    antiquewhite: [250, 235, 215],
    aqua: [0, 255, 255],
    aquamarine: [127, 255, 212],
    azure: [240, 255, 255],
    beige: [245, 245, 220],
    bisque: [255, 228, 196],
    black: [0, 0, 0],
    blanchedalmond: [255, 235, 205],
    blue: [0, 0, 255],
    blueviolet: [138, 43, 226],
    brown: [165, 42, 42],
    burlywood: [222, 184, 135],
    cadetblue: [95, 158, 160],
    chartreuse: [127, 255, 0],
    chocolate: [210, 105, 30],
    coral: [255, 127, 80],
    cornflowerblue: [100, 149, 237],
    cornsilk: [255, 248, 220],
    crimson: [220, 20, 60],
    cyan: [0, 255, 255],
    darkblue: [0, 0, 139],
    darkcyan: [0, 139, 139],
    darkgoldenrod: [184, 134, 11],
    darkgray: [169, 169, 169],
    darkgreen: [0, 100, 0],
    darkgrey: [169, 169, 169],
    darkkhaki: [189, 183, 107],
    darkmagenta: [139, 0, 139],
    darkolivegreen: [85, 107, 47],
    darkorange: [255, 140, 0],
    darkorchid: [153, 50, 204],
    darkred: [139, 0, 0],
    darksalmon: [233, 150, 122],
    darkseagreen: [143, 188, 143],
    darkslateblue: [72, 61, 139],
    darkslategray: [47, 79, 79],
    darkslategrey: [47, 79, 79],
    darkturquoise: [0, 206, 209],
    darkviolet: [148, 0, 211],
    deeppink: [255, 20, 147],
    deepskyblue: [0, 191, 255],
    dimgray: [105, 105, 105],
    dimgrey: [105, 105, 105],
    dodgerblue: [30, 144, 255],
    firebrick: [178, 34, 34],
    floralwhite: [255, 250, 240],
    forestgreen: [34, 139, 34],
    fuchsia: [255, 0, 255],
    gainsboro: [220, 220, 220],
    ghostwhite: [248, 248, 255],
    gold: [255, 215, 0],
    goldenrod: [218, 165, 32],
    gray: [128, 128, 128],
    green: [0, 128, 0],
    greenyellow: [173, 255, 47],
    grey: [128, 128, 128],
    honeydew: [240, 255, 240],
    hotpink: [255, 105, 180],
    indianred: [205, 92, 92],
    indigo: [75, 0, 130],
    ivory: [255, 255, 240],
    khaki: [240, 230, 140],
    lavender: [230, 230, 250],
    lavenderblush: [255, 240, 245],
    lawngreen: [124, 252, 0],
    lemonchiffon: [255, 250, 205],
    lightblue: [173, 216, 230],
    lightcoral: [240, 128, 128],
    lightcyan: [224, 255, 255],
    lightgoldenrodyellow: [250, 250, 210],
    lightgray: [211, 211, 211],
    lightgreen: [144, 238, 144],
    lightgrey: [211, 211, 211],
    lightpink: [255, 182, 193],
    lightsalmon: [255, 160, 122],
    lightseagreen: [32, 178, 170],
    lightskyblue: [135, 206, 250],
    lightslategray: [119, 136, 153],
    lightslategrey: [119, 136, 153],
    lightsteelblue: [176, 196, 222],
    lightyellow: [255, 255, 224],
    lime: [0, 255, 0],
    limegreen: [50, 205, 50],
    linen: [250, 240, 230],
    magenta: [255, 0, 255],
    maroon: [128, 0, 0],
    mediumaquamarine: [102, 205, 170],
    mediumblue: [0, 0, 205],
    mediumorchid: [186, 85, 211],
    mediumpurple: [147, 112, 219],
    mediumseagreen: [60, 179, 113],
    mediumslateblue: [123, 104, 238],
    mediumspringgreen: [0, 250, 154],
    mediumturquoise: [72, 209, 204],
    mediumvioletred: [199, 21, 133],
    midnightblue: [25, 25, 112],
    mintcream: [245, 255, 250],
    mistyrose: [255, 228, 225],
    moccasin: [255, 228, 181],
    navajowhite: [255, 222, 173],
    navy: [0, 0, 128],
    oldlace: [253, 245, 230],
    olive: [128, 128, 0],
    olivedrab: [107, 142, 35],
    orange: [255, 165, 0],
    orangered: [255, 69, 0],
    orchid: [218, 112, 214],
    palegoldenrod: [238, 232, 170],
    palegreen: [152, 251, 152],
    paleturquoise: [175, 238, 238],
    palevioletred: [219, 112, 147],
    papayawhip: [255, 239, 213],
    peachpuff: [255, 218, 185],
    peru: [205, 133, 63],
    pink: [255, 192, 203],
    plum: [221, 160, 221],
    powderblue: [176, 224, 230],
    purple: [128, 0, 128],
    rebeccapurple: [102, 51, 153],
    red: [255, 0, 0],
    rosybrown: [188, 143, 143],
    royalblue: [65, 105, 225],
    saddlebrown: [139, 69, 19],
    salmon: [250, 128, 114],
    sandybrown: [244, 164, 96],
    seagreen: [46, 139, 87],
    seashell: [255, 245, 238],
    sienna: [160, 82, 45],
    silver: [192, 192, 192],
    skyblue: [135, 206, 235],
    slateblue: [106, 90, 205],
    slategray: [112, 128, 144],
    slategrey: [112, 128, 144],
    snow: [255, 250, 250],
    springgreen: [0, 255, 127],
    steelblue: [70, 130, 180],
    tan: [210, 180, 140],
    teal: [0, 128, 128],
    thistle: [216, 191, 216],
    tomato: [255, 99, 71],
    turquoise: [64, 224, 208],
    violet: [238, 130, 238],
    wheat: [245, 222, 179],
    white: [255, 255, 255],
    whitesmoke: [245, 245, 245],
    yellow: [255, 255, 0],
    yellowgreen: [154, 205, 50]
  };
});

// ../node_modules/color-convert/conversions.js
var la = J((k5, fc) => {
  var fr = uc(), dc = {};
  for (let e of Object.keys(fr))
    dc[fr[e]] = e;
  var A = {
    rgb: { channels: 3, labels: "rgb" },
    hsl: { channels: 3, labels: "hsl" },
    hsv: { channels: 3, labels: "hsv" },
    hwb: { channels: 3, labels: "hwb" },
    cmyk: { channels: 4, labels: "cmyk" },
    xyz: { channels: 3, labels: "xyz" },
    lab: { channels: 3, labels: "lab" },
    lch: { channels: 3, labels: "lch" },
    hex: { channels: 1, labels: ["hex"] },
    keyword: { channels: 1, labels: ["keyword"] },
    ansi16: { channels: 1, labels: ["ansi16"] },
    ansi256: { channels: 1, labels: ["ansi256"] },
    hcg: { channels: 3, labels: ["h", "c", "g"] },
    apple: { channels: 3, labels: ["r16", "g16", "b16"] },
    gray: { channels: 1, labels: ["gray"] }
  };
  fc.exports = A;
  for (let e of Object.keys(A)) {
    if (!("channels" in A[e]))
      throw new Error("missing channels property: " + e);
    if (!("labels" in A[e]))
      throw new Error("missing channel labels property: " + e);
    if (A[e].labels.length !== A[e].channels)
      throw new Error("channel and label counts mismatch: " + e);
    let { channels: t, labels: r } = A[e];
    delete A[e].channels, delete A[e].labels, Object.defineProperty(A[e], "channels", { value: t }), Object.defineProperty(A[e], "labels", {
    value: r });
  }
  A.rgb.hsl = function(e) {
    let t = e[0] / 255, r = e[1] / 255, o = e[2] / 255, n = Math.min(t, r, o), i = Math.max(t, r, o), s = i - n, l, c;
    i === n ? l = 0 : t === i ? l = (r - o) / s : r === i ? l = 2 + (o - t) / s : o === i && (l = 4 + (t - r) / s), l = Math.min(l * 60, 360),
    l < 0 && (l += 360);
    let u = (n + i) / 2;
    return i === n ? c = 0 : u <= 0.5 ? c = s / (i + n) : c = s / (2 - i - n), [l, c * 100, u * 100];
  };
  A.rgb.hsv = function(e) {
    let t, r, o, n, i, s = e[0] / 255, l = e[1] / 255, c = e[2] / 255, u = Math.max(s, l, c), d = u - Math.min(s, l, c), g = /* @__PURE__ */ a(
    function(p) {
      return (u - p) / 6 / d + 1 / 2;
    }, "diffc");
    return d === 0 ? (n = 0, i = 0) : (i = d / u, t = g(s), r = g(l), o = g(c), s === u ? n = o - r : l === u ? n = 1 / 3 + t - o : c === u &&
    (n = 2 / 3 + r - t), n < 0 ? n += 1 : n > 1 && (n -= 1)), [
      n * 360,
      i * 100,
      u * 100
    ];
  };
  A.rgb.hwb = function(e) {
    let t = e[0], r = e[1], o = e[2], n = A.rgb.hsl(e)[0], i = 1 / 255 * Math.min(t, Math.min(r, o));
    return o = 1 - 1 / 255 * Math.max(t, Math.max(r, o)), [n, i * 100, o * 100];
  };
  A.rgb.cmyk = function(e) {
    let t = e[0] / 255, r = e[1] / 255, o = e[2] / 255, n = Math.min(1 - t, 1 - r, 1 - o), i = (1 - t - n) / (1 - n) || 0, s = (1 - r - n) /
    (1 - n) || 0, l = (1 - o - n) / (1 - n) || 0;
    return [i * 100, s * 100, l * 100, n * 100];
  };
  function my(e, t) {
    return (e[0] - t[0]) ** 2 + (e[1] - t[1]) ** 2 + (e[2] - t[2]) ** 2;
  }
  a(my, "comparativeDistance");
  A.rgb.keyword = function(e) {
    let t = dc[e];
    if (t)
      return t;
    let r = 1 / 0, o;
    for (let n of Object.keys(fr)) {
      let i = fr[n], s = my(e, i);
      s < r && (r = s, o = n);
    }
    return o;
  };
  A.keyword.rgb = function(e) {
    return fr[e];
  };
  A.rgb.xyz = function(e) {
    let t = e[0] / 255, r = e[1] / 255, o = e[2] / 255;
    t = t > 0.04045 ? ((t + 0.055) / 1.055) ** 2.4 : t / 12.92, r = r > 0.04045 ? ((r + 0.055) / 1.055) ** 2.4 : r / 12.92, o = o > 0.04045 ?
    ((o + 0.055) / 1.055) ** 2.4 : o / 12.92;
    let n = t * 0.4124 + r * 0.3576 + o * 0.1805, i = t * 0.2126 + r * 0.7152 + o * 0.0722, s = t * 0.0193 + r * 0.1192 + o * 0.9505;
    return [n * 100, i * 100, s * 100];
  };
  A.rgb.lab = function(e) {
    let t = A.rgb.xyz(e), r = t[0], o = t[1], n = t[2];
    r /= 95.047, o /= 100, n /= 108.883, r = r > 8856e-6 ? r ** (1 / 3) : 7.787 * r + 16 / 116, o = o > 8856e-6 ? o ** (1 / 3) : 7.787 * o +
    16 / 116, n = n > 8856e-6 ? n ** (1 / 3) : 7.787 * n + 16 / 116;
    let i = 116 * o - 16, s = 500 * (r - o), l = 200 * (o - n);
    return [i, s, l];
  };
  A.hsl.rgb = function(e) {
    let t = e[0] / 360, r = e[1] / 100, o = e[2] / 100, n, i, s;
    if (r === 0)
      return s = o * 255, [s, s, s];
    o < 0.5 ? n = o * (1 + r) : n = o + r - o * r;
    let l = 2 * o - n, c = [0, 0, 0];
    for (let u = 0; u < 3; u++)
      i = t + 1 / 3 * -(u - 1), i < 0 && i++, i > 1 && i--, 6 * i < 1 ? s = l + (n - l) * 6 * i : 2 * i < 1 ? s = n : 3 * i < 2 ? s = l + (n -
      l) * (2 / 3 - i) * 6 : s = l, c[u] = s * 255;
    return c;
  };
  A.hsl.hsv = function(e) {
    let t = e[0], r = e[1] / 100, o = e[2] / 100, n = r, i = Math.max(o, 0.01);
    o *= 2, r *= o <= 1 ? o : 2 - o, n *= i <= 1 ? i : 2 - i;
    let s = (o + r) / 2, l = o === 0 ? 2 * n / (i + n) : 2 * r / (o + r);
    return [t, l * 100, s * 100];
  };
  A.hsv.rgb = function(e) {
    let t = e[0] / 60, r = e[1] / 100, o = e[2] / 100, n = Math.floor(t) % 6, i = t - Math.floor(t), s = 255 * o * (1 - r), l = 255 * o * (1 -
    r * i), c = 255 * o * (1 - r * (1 - i));
    switch (o *= 255, n) {
      case 0:
        return [o, c, s];
      case 1:
        return [l, o, s];
      case 2:
        return [s, o, c];
      case 3:
        return [s, l, o];
      case 4:
        return [c, s, o];
      case 5:
        return [o, s, l];
    }
  };
  A.hsv.hsl = function(e) {
    let t = e[0], r = e[1] / 100, o = e[2] / 100, n = Math.max(o, 0.01), i, s;
    s = (2 - r) * o;
    let l = (2 - r) * n;
    return i = r * n, i /= l <= 1 ? l : 2 - l, i = i || 0, s /= 2, [t, i * 100, s * 100];
  };
  A.hwb.rgb = function(e) {
    let t = e[0] / 360, r = e[1] / 100, o = e[2] / 100, n = r + o, i;
    n > 1 && (r /= n, o /= n);
    let s = Math.floor(6 * t), l = 1 - o;
    i = 6 * t - s, (s & 1) !== 0 && (i = 1 - i);
    let c = r + i * (l - r), u, d, g;
    switch (s) {
      default:
      case 6:
      case 0:
        u = l, d = c, g = r;
        break;
      case 1:
        u = c, d = l, g = r;
        break;
      case 2:
        u = r, d = l, g = c;
        break;
      case 3:
        u = r, d = c, g = l;
        break;
      case 4:
        u = c, d = r, g = l;
        break;
      case 5:
        u = l, d = r, g = c;
        break;
    }
    return [u * 255, d * 255, g * 255];
  };
  A.cmyk.rgb = function(e) {
    let t = e[0] / 100, r = e[1] / 100, o = e[2] / 100, n = e[3] / 100, i = 1 - Math.min(1, t * (1 - n) + n), s = 1 - Math.min(1, r * (1 - n) +
    n), l = 1 - Math.min(1, o * (1 - n) + n);
    return [i * 255, s * 255, l * 255];
  };
  A.xyz.rgb = function(e) {
    let t = e[0] / 100, r = e[1] / 100, o = e[2] / 100, n, i, s;
    return n = t * 3.2406 + r * -1.5372 + o * -0.4986, i = t * -0.9689 + r * 1.8758 + o * 0.0415, s = t * 0.0557 + r * -0.204 + o * 1.057, n =
    n > 31308e-7 ? 1.055 * n ** (1 / 2.4) - 0.055 : n * 12.92, i = i > 31308e-7 ? 1.055 * i ** (1 / 2.4) - 0.055 : i * 12.92, s = s > 31308e-7 ?
    1.055 * s ** (1 / 2.4) - 0.055 : s * 12.92, n = Math.min(Math.max(0, n), 1), i = Math.min(Math.max(0, i), 1), s = Math.min(Math.max(0, s),
    1), [n * 255, i * 255, s * 255];
  };
  A.xyz.lab = function(e) {
    let t = e[0], r = e[1], o = e[2];
    t /= 95.047, r /= 100, o /= 108.883, t = t > 8856e-6 ? t ** (1 / 3) : 7.787 * t + 16 / 116, r = r > 8856e-6 ? r ** (1 / 3) : 7.787 * r +
    16 / 116, o = o > 8856e-6 ? o ** (1 / 3) : 7.787 * o + 16 / 116;
    let n = 116 * r - 16, i = 500 * (t - r), s = 200 * (r - o);
    return [n, i, s];
  };
  A.lab.xyz = function(e) {
    let t = e[0], r = e[1], o = e[2], n, i, s;
    i = (t + 16) / 116, n = r / 500 + i, s = i - o / 200;
    let l = i ** 3, c = n ** 3, u = s ** 3;
    return i = l > 8856e-6 ? l : (i - 16 / 116) / 7.787, n = c > 8856e-6 ? c : (n - 16 / 116) / 7.787, s = u > 8856e-6 ? u : (s - 16 / 116) /
    7.787, n *= 95.047, i *= 100, s *= 108.883, [n, i, s];
  };
  A.lab.lch = function(e) {
    let t = e[0], r = e[1], o = e[2], n;
    n = Math.atan2(o, r) * 360 / 2 / Math.PI, n < 0 && (n += 360);
    let s = Math.sqrt(r * r + o * o);
    return [t, s, n];
  };
  A.lch.lab = function(e) {
    let t = e[0], r = e[1], n = e[2] / 360 * 2 * Math.PI, i = r * Math.cos(n), s = r * Math.sin(n);
    return [t, i, s];
  };
  A.rgb.ansi16 = function(e, t = null) {
    let [r, o, n] = e, i = t === null ? A.rgb.hsv(e)[2] : t;
    if (i = Math.round(i / 50), i === 0)
      return 30;
    let s = 30 + (Math.round(n / 255) << 2 | Math.round(o / 255) << 1 | Math.round(r / 255));
    return i === 2 && (s += 60), s;
  };
  A.hsv.ansi16 = function(e) {
    return A.rgb.ansi16(A.hsv.rgb(e), e[2]);
  };
  A.rgb.ansi256 = function(e) {
    let t = e[0], r = e[1], o = e[2];
    return t === r && r === o ? t < 8 ? 16 : t > 248 ? 231 : Math.round((t - 8) / 247 * 24) + 232 : 16 + 36 * Math.round(t / 255 * 5) + 6 * Math.
    round(r / 255 * 5) + Math.round(o / 255 * 5);
  };
  A.ansi16.rgb = function(e) {
    let t = e % 10;
    if (t === 0 || t === 7)
      return e > 50 && (t += 3.5), t = t / 10.5 * 255, [t, t, t];
    let r = (~~(e > 50) + 1) * 0.5, o = (t & 1) * r * 255, n = (t >> 1 & 1) * r * 255, i = (t >> 2 & 1) * r * 255;
    return [o, n, i];
  };
  A.ansi256.rgb = function(e) {
    if (e >= 232) {
      let i = (e - 232) * 10 + 8;
      return [i, i, i];
    }
    e -= 16;
    let t, r = Math.floor(e / 36) / 5 * 255, o = Math.floor((t = e % 36) / 6) / 5 * 255, n = t % 6 / 5 * 255;
    return [r, o, n];
  };
  A.rgb.hex = function(e) {
    let r = (((Math.round(e[0]) & 255) << 16) + ((Math.round(e[1]) & 255) << 8) + (Math.round(e[2]) & 255)).toString(16).toUpperCase();
    return "000000".substring(r.length) + r;
  };
  A.hex.rgb = function(e) {
    let t = e.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);
    if (!t)
      return [0, 0, 0];
    let r = t[0];
    t[0].length === 3 && (r = r.split("").map((l) => l + l).join(""));
    let o = parseInt(r, 16), n = o >> 16 & 255, i = o >> 8 & 255, s = o & 255;
    return [n, i, s];
  };
  A.rgb.hcg = function(e) {
    let t = e[0] / 255, r = e[1] / 255, o = e[2] / 255, n = Math.max(Math.max(t, r), o), i = Math.min(Math.min(t, r), o), s = n - i, l, c;
    return s < 1 ? l = i / (1 - s) : l = 0, s <= 0 ? c = 0 : n === t ? c = (r - o) / s % 6 : n === r ? c = 2 + (o - t) / s : c = 4 + (t - r) /
    s, c /= 6, c %= 1, [c * 360, s * 100, l * 100];
  };
  A.hsl.hcg = function(e) {
    let t = e[1] / 100, r = e[2] / 100, o = r < 0.5 ? 2 * t * r : 2 * t * (1 - r), n = 0;
    return o < 1 && (n = (r - 0.5 * o) / (1 - o)), [e[0], o * 100, n * 100];
  };
  A.hsv.hcg = function(e) {
    let t = e[1] / 100, r = e[2] / 100, o = t * r, n = 0;
    return o < 1 && (n = (r - o) / (1 - o)), [e[0], o * 100, n * 100];
  };
  A.hcg.rgb = function(e) {
    let t = e[0] / 360, r = e[1] / 100, o = e[2] / 100;
    if (r === 0)
      return [o * 255, o * 255, o * 255];
    let n = [0, 0, 0], i = t % 1 * 6, s = i % 1, l = 1 - s, c = 0;
    switch (Math.floor(i)) {
      case 0:
        n[0] = 1, n[1] = s, n[2] = 0;
        break;
      case 1:
        n[0] = l, n[1] = 1, n[2] = 0;
        break;
      case 2:
        n[0] = 0, n[1] = 1, n[2] = s;
        break;
      case 3:
        n[0] = 0, n[1] = l, n[2] = 1;
        break;
      case 4:
        n[0] = s, n[1] = 0, n[2] = 1;
        break;
      default:
        n[0] = 1, n[1] = 0, n[2] = l;
    }
    return c = (1 - r) * o, [
      (r * n[0] + c) * 255,
      (r * n[1] + c) * 255,
      (r * n[2] + c) * 255
    ];
  };
  A.hcg.hsv = function(e) {
    let t = e[1] / 100, r = e[2] / 100, o = t + r * (1 - t), n = 0;
    return o > 0 && (n = t / o), [e[0], n * 100, o * 100];
  };
  A.hcg.hsl = function(e) {
    let t = e[1] / 100, o = e[2] / 100 * (1 - t) + 0.5 * t, n = 0;
    return o > 0 && o < 0.5 ? n = t / (2 * o) : o >= 0.5 && o < 1 && (n = t / (2 * (1 - o))), [e[0], n * 100, o * 100];
  };
  A.hcg.hwb = function(e) {
    let t = e[1] / 100, r = e[2] / 100, o = t + r * (1 - t);
    return [e[0], (o - t) * 100, (1 - o) * 100];
  };
  A.hwb.hcg = function(e) {
    let t = e[1] / 100, o = 1 - e[2] / 100, n = o - t, i = 0;
    return n < 1 && (i = (o - n) / (1 - n)), [e[0], n * 100, i * 100];
  };
  A.apple.rgb = function(e) {
    return [e[0] / 65535 * 255, e[1] / 65535 * 255, e[2] / 65535 * 255];
  };
  A.rgb.apple = function(e) {
    return [e[0] / 255 * 65535, e[1] / 255 * 65535, e[2] / 255 * 65535];
  };
  A.gray.rgb = function(e) {
    return [e[0] / 100 * 255, e[0] / 100 * 255, e[0] / 100 * 255];
  };
  A.gray.hsl = function(e) {
    return [0, 0, e[0]];
  };
  A.gray.hsv = A.gray.hsl;
  A.gray.hwb = function(e) {
    return [0, 100, e[0]];
  };
  A.gray.cmyk = function(e) {
    return [0, 0, 0, e[0]];
  };
  A.gray.lab = function(e) {
    return [e[0], 0, 0];
  };
  A.gray.hex = function(e) {
    let t = Math.round(e[0] / 100 * 255) & 255, o = ((t << 16) + (t << 8) + t).toString(16).toUpperCase();
    return "000000".substring(o.length) + o;
  };
  A.rgb.gray = function(e) {
    return [(e[0] + e[1] + e[2]) / 3 / 255 * 100];
  };
});

// ../node_modules/color-convert/route.js
var gc = J((I5, mc) => {
  var bo = la();
  function gy() {
    let e = {}, t = Object.keys(bo);
    for (let r = t.length, o = 0; o < r; o++)
      e[t[o]] = {
        // http://jsperf.com/1-vs-infinity
        // micro-opt, but this is simple.
        distance: -1,
        parent: null
      };
    return e;
  }
  a(gy, "buildGraph");
  function hy(e) {
    let t = gy(), r = [e];
    for (t[e].distance = 0; r.length; ) {
      let o = r.pop(), n = Object.keys(bo[o]);
      for (let i = n.length, s = 0; s < i; s++) {
        let l = n[s], c = t[l];
        c.distance === -1 && (c.distance = t[o].distance + 1, c.parent = o, r.unshift(l));
      }
    }
    return t;
  }
  a(hy, "deriveBFS");
  function yy(e, t) {
    return function(r) {
      return t(e(r));
    };
  }
  a(yy, "link");
  function by(e, t) {
    let r = [t[e].parent, e], o = bo[t[e].parent][e], n = t[e].parent;
    for (; t[n].parent; )
      r.unshift(t[n].parent), o = yy(bo[t[n].parent][n], o), n = t[n].parent;
    return o.conversion = r, o;
  }
  a(by, "wrapConversion");
  mc.exports = function(e) {
    let t = hy(e), r = {}, o = Object.keys(t);
    for (let n = o.length, i = 0; i < n; i++) {
      let s = o[i];
      t[s].parent !== null && (r[s] = by(s, t));
    }
    return r;
  };
});

// ../node_modules/color-convert/index.js
var yc = J((L5, hc) => {
  var ca = la(), xy = gc(), qt = {}, vy = Object.keys(ca);
  function Ey(e) {
    let t = /* @__PURE__ */ a(function(...r) {
      let o = r[0];
      return o == null ? o : (o.length > 1 && (r = o), e(r));
    }, "wrappedFn");
    return "conversion" in e && (t.conversion = e.conversion), t;
  }
  a(Ey, "wrapRaw");
  function Sy(e) {
    let t = /* @__PURE__ */ a(function(...r) {
      let o = r[0];
      if (o == null)
        return o;
      o.length > 1 && (r = o);
      let n = e(r);
      if (typeof n == "object")
        for (let i = n.length, s = 0; s < i; s++)
          n[s] = Math.round(n[s]);
      return n;
    }, "wrappedFn");
    return "conversion" in e && (t.conversion = e.conversion), t;
  }
  a(Sy, "wrapRounded");
  vy.forEach((e) => {
    qt[e] = {}, Object.defineProperty(qt[e], "channels", { value: ca[e].channels }), Object.defineProperty(qt[e], "labels", { value: ca[e].labels });
    let t = xy(e);
    Object.keys(t).forEach((o) => {
      let n = t[o];
      qt[e][o] = Sy(n), qt[e][o].raw = Ey(n);
    });
  });
  hc.exports = qt;
});

// ../node_modules/react-colorful/dist/index.mjs
import K, { useRef as pt, useMemo as Cy, useEffect as Eo, useState as wy, useCallback as Ty, useLayoutEffect as Ay } from "react";
function Ot() {
  return (Ot = Object.assign || function(e) {
    for (var t = 1; t < arguments.length; t++) {
      var r = arguments[t];
      for (var o in r) Object.prototype.hasOwnProperty.call(r, o) && (e[o] = r[o]);
    }
    return e;
  }).apply(this, arguments);
}
function ma(e, t) {
  if (e == null) return {};
  var r, o, n = {}, i = Object.keys(e);
  for (o = 0; o < i.length; o++) t.indexOf(r = i[o]) >= 0 || (n[r] = e[r]);
  return n;
}
function pa(e) {
  var t = pt(e), r = pt(function(o) {
    t.current && t.current(o);
  });
  return t.current = e, r.current;
}
function Oc(e, t, r) {
  var o = pa(r), n = wy(function() {
    return e.toHsva(t);
  }), i = n[0], s = n[1], l = pt({ color: t, hsva: i });
  Eo(function() {
    if (!e.equal(t, l.current.color)) {
      var u = e.toHsva(t);
      l.current = { hsva: u, color: t }, s(u);
    }
  }, [t, e]), Eo(function() {
    var u;
    Ac(i, l.current.hsva) || e.equal(u = e.fromHsva(i), l.current.color) || (l.current = { hsva: i, color: u }, o(u));
  }, [i, e, o]);
  var c = Ty(function(u) {
    s(function(d) {
      return Object.assign({}, d, u);
    });
  }, []);
  return [i, c];
}
var Wt, mr, ua, bc, xc, ga, gr, ha, ae, ky, Oy, da, Iy, Py, Ly, Ny, Ec, fa, vo, Sc, _y, xo, Dy, Cc, wc, Tc, Ac, kc, My, By, Fy, Ry, vc, Ic, jy,
Hy, Pc, $y, Lc, Vy, Nc, zy, _c, Dc = $(() => {
  a(Ot, "u");
  a(ma, "c");
  a(pa, "i");
  Wt = /* @__PURE__ */ a(function(e, t, r) {
    return t === void 0 && (t = 0), r === void 0 && (r = 1), e > r ? r : e < t ? t : e;
  }, "s"), mr = /* @__PURE__ */ a(function(e) {
    return "touches" in e;
  }, "f"), ua = /* @__PURE__ */ a(function(e) {
    return e && e.ownerDocument.defaultView || self;
  }, "v"), bc = /* @__PURE__ */ a(function(e, t, r) {
    var o = e.getBoundingClientRect(), n = mr(t) ? function(i, s) {
      for (var l = 0; l < i.length; l++) if (i[l].identifier === s) return i[l];
      return i[0];
    }(t.touches, r) : t;
    return { left: Wt((n.pageX - (o.left + ua(e).pageXOffset)) / o.width), top: Wt((n.pageY - (o.top + ua(e).pageYOffset)) / o.height) };
  }, "d"), xc = /* @__PURE__ */ a(function(e) {
    !mr(e) && e.preventDefault();
  }, "h"), ga = K.memo(function(e) {
    var t = e.onMove, r = e.onKey, o = ma(e, ["onMove", "onKey"]), n = pt(null), i = pa(t), s = pa(r), l = pt(null), c = pt(!1), u = Cy(function() {
      var m = /* @__PURE__ */ a(function(h) {
        xc(h), (mr(h) ? h.touches.length > 0 : h.buttons > 0) && n.current ? i(bc(n.current, h, l.current)) : y(!1);
      }, "e"), f = /* @__PURE__ */ a(function() {
        return y(!1);
      }, "r");
      function y(h) {
        var b = c.current, x = ua(n.current), v = h ? x.addEventListener : x.removeEventListener;
        v(b ? "touchmove" : "mousemove", m), v(b ? "touchend" : "mouseup", f);
      }
      return a(y, "t"), [function(h) {
        var b = h.nativeEvent, x = n.current;
        if (x && (xc(b), !function(E, S) {
          return S && !mr(E);
        }(b, c.current) && x)) {
          if (mr(b)) {
            c.current = !0;
            var v = b.changedTouches || [];
            v.length && (l.current = v[0].identifier);
          }
          x.focus(), i(bc(x, b, l.current)), y(!0);
        }
      }, function(h) {
        var b = h.which || h.keyCode;
        b < 37 || b > 40 || (h.preventDefault(), s({ left: b === 39 ? 0.05 : b === 37 ? -0.05 : 0, top: b === 40 ? 0.05 : b === 38 ? -0.05 :
        0 }));
      }, y];
    }, [s, i]), d = u[0], g = u[1], p = u[2];
    return Eo(function() {
      return p;
    }, [p]), K.createElement("div", Ot({}, o, { onTouchStart: d, onMouseDown: d, className: "react-colorful__interactive", ref: n, onKeyDown: g,
    tabIndex: 0, role: "slider" }));
  }), gr = /* @__PURE__ */ a(function(e) {
    return e.filter(Boolean).join(" ");
  }, "g"), ha = /* @__PURE__ */ a(function(e) {
    var t = e.color, r = e.left, o = e.top, n = o === void 0 ? 0.5 : o, i = gr(["react-colorful__pointer", e.className]);
    return K.createElement("div", { className: i, style: { top: 100 * n + "%", left: 100 * r + "%" } }, K.createElement("div", { className: "\
react-colorful__pointer-fill", style: { backgroundColor: t } }));
  }, "p"), ae = /* @__PURE__ */ a(function(e, t, r) {
    return t === void 0 && (t = 0), r === void 0 && (r = Math.pow(10, t)), Math.round(r * e) / r;
  }, "b"), ky = { grad: 0.9, turn: 360, rad: 360 / (2 * Math.PI) }, Oy = /* @__PURE__ */ a(function(e) {
    return Cc(da(e));
  }, "x"), da = /* @__PURE__ */ a(function(e) {
    return e[0] === "#" && (e = e.substring(1)), e.length < 6 ? { r: parseInt(e[0] + e[0], 16), g: parseInt(e[1] + e[1], 16), b: parseInt(e[2] +
    e[2], 16), a: e.length === 4 ? ae(parseInt(e[3] + e[3], 16) / 255, 2) : 1 } : { r: parseInt(e.substring(0, 2), 16), g: parseInt(e.substring(
    2, 4), 16), b: parseInt(e.substring(4, 6), 16), a: e.length === 8 ? ae(parseInt(e.substring(6, 8), 16) / 255, 2) : 1 };
  }, "C"), Iy = /* @__PURE__ */ a(function(e, t) {
    return t === void 0 && (t = "deg"), Number(e) * (ky[t] || 1);
  }, "E"), Py = /* @__PURE__ */ a(function(e) {
    var t = /hsla?\(?\s*(-?\d*\.?\d+)(deg|rad|grad|turn)?[,\s]+(-?\d*\.?\d+)%?[,\s]+(-?\d*\.?\d+)%?,?\s*[/\s]*(-?\d*\.?\d+)?(%)?\s*\)?/i.exec(
    e);
    return t ? Ly({ h: Iy(t[1], t[2]), s: Number(t[3]), l: Number(t[4]), a: t[5] === void 0 ? 1 : Number(t[5]) / (t[6] ? 100 : 1) }) : { h: 0,
    s: 0, v: 0, a: 1 };
  }, "H"), Ly = /* @__PURE__ */ a(function(e) {
    var t = e.s, r = e.l;
    return { h: e.h, s: (t *= (r < 50 ? r : 100 - r) / 100) > 0 ? 2 * t / (r + t) * 100 : 0, v: r + t, a: e.a };
  }, "N"), Ny = /* @__PURE__ */ a(function(e) {
    return Dy(Sc(e));
  }, "w"), Ec = /* @__PURE__ */ a(function(e) {
    var t = e.s, r = e.v, o = e.a, n = (200 - t) * r / 100;
    return { h: ae(e.h), s: ae(n > 0 && n < 200 ? t * r / 100 / (n <= 100 ? n : 200 - n) * 100 : 0), l: ae(n / 2), a: ae(o, 2) };
  }, "y"), fa = /* @__PURE__ */ a(function(e) {
    var t = Ec(e);
    return "hsl(" + t.h + ", " + t.s + "%, " + t.l + "%)";
  }, "q"), vo = /* @__PURE__ */ a(function(e) {
    var t = Ec(e);
    return "hsla(" + t.h + ", " + t.s + "%, " + t.l + "%, " + t.a + ")";
  }, "k"), Sc = /* @__PURE__ */ a(function(e) {
    var t = e.h, r = e.s, o = e.v, n = e.a;
    t = t / 360 * 6, r /= 100, o /= 100;
    var i = Math.floor(t), s = o * (1 - r), l = o * (1 - (t - i) * r), c = o * (1 - (1 - t + i) * r), u = i % 6;
    return { r: ae(255 * [o, l, s, s, c, o][u]), g: ae(255 * [c, o, o, l, s, s][u]), b: ae(255 * [s, s, c, o, o, l][u]), a: ae(n, 2) };
  }, "I"), _y = /* @__PURE__ */ a(function(e) {
    var t = /rgba?\(?\s*(-?\d*\.?\d+)(%)?[,\s]+(-?\d*\.?\d+)(%)?[,\s]+(-?\d*\.?\d+)(%)?,?\s*[/\s]*(-?\d*\.?\d+)?(%)?\s*\)?/i.exec(e);
    return t ? Cc({ r: Number(t[1]) / (t[2] ? 100 / 255 : 1), g: Number(t[3]) / (t[4] ? 100 / 255 : 1), b: Number(t[5]) / (t[6] ? 100 / 255 :
    1), a: t[7] === void 0 ? 1 : Number(t[7]) / (t[8] ? 100 : 1) }) : { h: 0, s: 0, v: 0, a: 1 };
  }, "z"), xo = /* @__PURE__ */ a(function(e) {
    var t = e.toString(16);
    return t.length < 2 ? "0" + t : t;
  }, "D"), Dy = /* @__PURE__ */ a(function(e) {
    var t = e.r, r = e.g, o = e.b, n = e.a, i = n < 1 ? xo(ae(255 * n)) : "";
    return "#" + xo(t) + xo(r) + xo(o) + i;
  }, "K"), Cc = /* @__PURE__ */ a(function(e) {
    var t = e.r, r = e.g, o = e.b, n = e.a, i = Math.max(t, r, o), s = i - Math.min(t, r, o), l = s ? i === t ? (r - o) / s : i === r ? 2 + (o -
    t) / s : 4 + (t - r) / s : 0;
    return { h: ae(60 * (l < 0 ? l + 6 : l)), s: ae(i ? s / i * 100 : 0), v: ae(i / 255 * 100), a: n };
  }, "L"), wc = K.memo(function(e) {
    var t = e.hue, r = e.onChange, o = gr(["react-colorful__hue", e.className]);
    return K.createElement("div", { className: o }, K.createElement(ga, { onMove: /* @__PURE__ */ a(function(n) {
      r({ h: 360 * n.left });
    }, "onMove"), onKey: /* @__PURE__ */ a(function(n) {
      r({ h: Wt(t + 360 * n.left, 0, 360) });
    }, "onKey"), "aria-label": "Hue", "aria-valuenow": ae(t), "aria-valuemax": "360", "aria-valuemin": "0" }, K.createElement(ha, { className: "\
react-colorful__hue-pointer", left: t / 360, color: fa({ h: t, s: 100, v: 100, a: 1 }) })));
  }), Tc = K.memo(function(e) {
    var t = e.hsva, r = e.onChange, o = { backgroundColor: fa({ h: t.h, s: 100, v: 100, a: 1 }) };
    return K.createElement("div", { className: "react-colorful__saturation", style: o }, K.createElement(ga, { onMove: /* @__PURE__ */ a(function(n) {
      r({ s: 100 * n.left, v: 100 - 100 * n.top });
    }, "onMove"), onKey: /* @__PURE__ */ a(function(n) {
      r({ s: Wt(t.s + 100 * n.left, 0, 100), v: Wt(t.v - 100 * n.top, 0, 100) });
    }, "onKey"), "aria-label": "Color", "aria-valuetext": "Saturation " + ae(t.s) + "%, Brightness " + ae(t.v) + "%" }, K.createElement(ha, {
    className: "react-colorful__saturation-pointer", top: 1 - t.v / 100, left: t.s / 100, color: fa(t) })));
  }), Ac = /* @__PURE__ */ a(function(e, t) {
    if (e === t) return !0;
    for (var r in e) if (e[r] !== t[r]) return !1;
    return !0;
  }, "F"), kc = /* @__PURE__ */ a(function(e, t) {
    return e.replace(/\s/g, "") === t.replace(/\s/g, "");
  }, "P"), My = /* @__PURE__ */ a(function(e, t) {
    return e.toLowerCase() === t.toLowerCase() || Ac(da(e), da(t));
  }, "X");
  a(Oc, "Y");
  Fy = typeof window < "u" ? Ay : Eo, Ry = /* @__PURE__ */ a(function() {
    return By || (typeof __webpack_nonce__ < "u" ? __webpack_nonce__ : void 0);
  }, "$"), vc = /* @__PURE__ */ new Map(), Ic = /* @__PURE__ */ a(function(e) {
    Fy(function() {
      var t = e.current ? e.current.ownerDocument : document;
      if (t !== void 0 && !vc.has(t)) {
        var r = t.createElement("style");
        r.innerHTML = `.react-colorful{position:relative;display:flex;flex-direction:column;width:200px;height:200px;-webkit-user-select:non\
e;-moz-user-select:none;-ms-user-select:none;user-select:none;cursor:default}.react-colorful__saturation{position:relative;flex-grow:1;borde\
r-color:transparent;border-bottom:12px solid #000;border-radius:8px 8px 0 0;background-image:linear-gradient(0deg,#000,transparent),linear-g\
radient(90deg,#fff,hsla(0,0%,100%,0))}.react-colorful__alpha-gradient,.react-colorful__pointer-fill{content:"";position:absolute;left:0;top:\
0;right:0;bottom:0;pointer-events:none;border-radius:inherit}.react-colorful__alpha-gradient,.react-colorful__saturation{box-shadow:inset 0 \
0 0 1px rgba(0,0,0,.05)}.react-colorful__alpha,.react-colorful__hue{position:relative;height:24px}.react-colorful__hue{background:linear-gra\
dient(90deg,red 0,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,red)}.react-colorful__last-control{border-radius:0 0 8px 8px}.react-colorful_\
_interactive{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:inherit;outline:none;touch-action:none}.react-colorful__pointer{p\
osition:absolute;z-index:1;box-sizing:border-box;width:28px;height:28px;transform:translate(-50%,-50%);background-color:#fff;border:2px soli\
d #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.2)}.react-colorful__interactive:focus .react-colorful__pointer{transform:translate\
(-50%,-50%) scale(1.1)}.react-colorful__alpha,.react-colorful__alpha-pointer{background-color:#fff;background-image:url('data:image/svg+xml;\
charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill-opacity=".05"><path d="M8 0h8v8H8zM0 8h8v8H0z"/></svg>')}.\
react-colorful__saturation-pointer{z-index:3}.react-colorful__hue-pointer{z-index:2}`, vc.set(t, r);
        var o = Ry();
        o && r.setAttribute("nonce", o), t.head.appendChild(r);
      }
    }, []);
  }, "Q"), jy = /* @__PURE__ */ a(function(e) {
    var t = e.className, r = e.colorModel, o = e.color, n = o === void 0 ? r.defaultColor : o, i = e.onChange, s = ma(e, ["className", "colo\
rModel", "color", "onChange"]), l = pt(null);
    Ic(l);
    var c = Oc(r, n, i), u = c[0], d = c[1], g = gr(["react-colorful", t]);
    return K.createElement("div", Ot({}, s, { ref: l, className: g }), K.createElement(Tc, { hsva: u, onChange: d }), K.createElement(wc, { hue: u.
    h, onChange: d, className: "react-colorful__last-control" }));
  }, "U"), Hy = { defaultColor: "000", toHsva: Oy, fromHsva: /* @__PURE__ */ a(function(e) {
    return Ny({ h: e.h, s: e.s, v: e.v, a: 1 });
  }, "fromHsva"), equal: My }, Pc = /* @__PURE__ */ a(function(e) {
    return K.createElement(jy, Ot({}, e, { colorModel: Hy }));
  }, "Z"), $y = /* @__PURE__ */ a(function(e) {
    var t = e.className, r = e.hsva, o = e.onChange, n = { backgroundImage: "linear-gradient(90deg, " + vo(Object.assign({}, r, { a: 0 })) +
    ", " + vo(Object.assign({}, r, { a: 1 })) + ")" }, i = gr(["react-colorful__alpha", t]), s = ae(100 * r.a);
    return K.createElement("div", { className: i }, K.createElement("div", { className: "react-colorful__alpha-gradient", style: n }), K.createElement(
    ga, { onMove: /* @__PURE__ */ a(function(l) {
      o({ a: l.left });
    }, "onMove"), onKey: /* @__PURE__ */ a(function(l) {
      o({ a: Wt(r.a + l.left) });
    }, "onKey"), "aria-label": "Alpha", "aria-valuetext": s + "%", "aria-valuenow": s, "aria-valuemin": "0", "aria-valuemax": "100" }, K.createElement(
    ha, { className: "react-colorful__alpha-pointer", left: r.a, color: vo(r) })));
  }, "ee"), Lc = /* @__PURE__ */ a(function(e) {
    var t = e.className, r = e.colorModel, o = e.color, n = o === void 0 ? r.defaultColor : o, i = e.onChange, s = ma(e, ["className", "colo\
rModel", "color", "onChange"]), l = pt(null);
    Ic(l);
    var c = Oc(r, n, i), u = c[0], d = c[1], g = gr(["react-colorful", t]);
    return K.createElement("div", Ot({}, s, { ref: l, className: g }), K.createElement(Tc, { hsva: u, onChange: d }), K.createElement(wc, { hue: u.
    h, onChange: d }), K.createElement($y, { hsva: u, onChange: d, className: "react-colorful__last-control" }));
  }, "re"), Vy = { defaultColor: "hsla(0, 0%, 0%, 1)", toHsva: Py, fromHsva: vo, equal: kc }, Nc = /* @__PURE__ */ a(function(e) {
    return K.createElement(Lc, Ot({}, e, { colorModel: Vy }));
  }, "ue"), zy = { defaultColor: "rgba(0, 0, 0, 1)", toHsva: _y, fromHsva: /* @__PURE__ */ a(function(e) {
    var t = Sc(e);
    return "rgba(" + t.r + ", " + t.g + ", " + t.b + ", " + t.a + ")";
  }, "fromHsva"), equal: kc }, _c = /* @__PURE__ */ a(function(e) {
    return K.createElement(Lc, Ot({}, e, { colorModel: zy }));
  }, "He");
});

// ../addons/docs/src/blocks/controls/Color.tsx
var Vc = {};
mf(Vc, {
  ColorControl: () => $c,
  default: () => fb
});
import De, { useCallback as wo, useEffect as Bc, useMemo as Fc, useState as Co } from "react";
import { Form as Uy, TooltipNote as qy, WithTooltip as Rc } from "storybook/internal/components";
import { MarkupIcon as Wy } from "@storybook/icons";
import { styled as ut } from "storybook/theming";
var Oe, Gy, Jy, Ky, Yy, Xy, Zy, Qy, Mc, eb, tb, jc, ya, rb, ob, nb, ba, ab, ib, So, Hc, sb, lb, cb, Gt, pb, ub, To, db, $c, fb, zc = $(() => {
  "use strict";
  Oe = Ee(yc());
  or();
  Dc();
  Ne();
  Gy = ut.div({
    position: "relative",
    maxWidth: 250,
    '&[aria-readonly="true"]': {
      opacity: 0.5
    }
  }), Jy = ut(Rc)({
    position: "absolute",
    zIndex: 1,
    top: 4,
    left: 4,
    "[aria-readonly=true] &": {
      cursor: "not-allowed"
    }
  }), Ky = ut.div({
    width: 200,
    margin: 5,
    ".react-colorful__saturation": {
      borderRadius: "4px 4px 0 0"
    },
    ".react-colorful__hue": {
      boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 5%)"
    },
    ".react-colorful__last-control": {
      borderRadius: "0 0 4px 4px"
    }
  }), Yy = ut(qy)(({ theme: e }) => ({
    fontFamily: e.typography.fonts.base
  })), Xy = ut.div({
    display: "grid",
    gridTemplateColumns: "repeat(9, 16px)",
    gap: 6,
    padding: 3,
    marginTop: 5,
    width: 200
  }), Zy = ut.div(({ theme: e, active: t }) => ({
    width: 16,
    height: 16,
    boxShadow: t ? `${e.appBorderColor} 0 0 0 1px inset, ${e.textMutedColor}50 0 0 0 4px` : `${e.appBorderColor} 0 0 0 1px inset`,
    borderRadius: e.appBorderRadius
  })), Qy = `url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill-opacity=".05"><path d\
="M8 0h8v8H8zM0 8h8v8H0z"/></svg>')`, Mc = /* @__PURE__ */ a(({ value: e, style: t, ...r }) => {
    let o = `linear-gradient(${e}, ${e}), ${Qy}, linear-gradient(#fff, #fff)`;
    return /* @__PURE__ */ De.createElement(Zy, { ...r, style: { ...t, backgroundImage: o } });
  }, "Swatch"), eb = ut(Uy.Input)(({ theme: e, readOnly: t }) => ({
    width: "100%",
    paddingLeft: 30,
    paddingRight: 30,
    boxSizing: "border-box",
    fontFamily: e.typography.fonts.base
  })), tb = ut(Wy)(({ theme: e }) => ({
    position: "absolute",
    zIndex: 1,
    top: 6,
    right: 7,
    width: 20,
    height: 20,
    padding: 4,
    boxSizing: "border-box",
    cursor: "pointer",
    color: e.input.color
  })), jc = /* @__PURE__ */ ((o) => (o.RGB = "rgb", o.HSL = "hsl", o.HEX = "hex", o))(jc || {}), ya = Object.values(jc), rb = /\(([0-9]+),\s*([0-9]+)%?,\s*([0-9]+)%?,?\s*([0-9.]+)?\)/,
  ob = /^\s*rgba?\(([0-9]+),\s*([0-9]+),\s*([0-9]+),?\s*([0-9.]+)?\)\s*$/i, nb = /^\s*hsla?\(([0-9]+),\s*([0-9]+)%,\s*([0-9]+)%,?\s*([0-9.]+)?\)\s*$/i,
  ba = /^\s*#?([0-9a-f]{3}|[0-9a-f]{6})\s*$/i, ab = /^\s*#?([0-9a-f]{3})\s*$/i, ib = {
    hex: Pc,
    rgb: _c,
    hsl: Nc
  }, So = {
    hex: "transparent",
    rgb: "rgba(0, 0, 0, 0)",
    hsl: "hsla(0, 0%, 0%, 0)"
  }, Hc = /* @__PURE__ */ a((e) => {
    let t = e?.match(rb);
    if (!t)
      return [0, 0, 0, 1];
    let [, r, o, n, i = 1] = t;
    return [r, o, n, i].map(Number);
  }, "stringToArgs"), sb = /* @__PURE__ */ a((e) => {
    let [t, r, o, n] = Hc(e), [i, s, l] = Oe.default.rgb.hsl([t, r, o]) || [0, 0, 0];
    return {
      valid: !0,
      value: e,
      keyword: Oe.default.rgb.keyword([t, r, o]),
      colorSpace: "rgb",
      rgb: e,
      hsl: `hsla(${i}, ${s}%, ${l}%, ${n})`,
      hex: `#${Oe.default.rgb.hex([t, r, o]).toLowerCase()}`
    };
  }, "parseRgb"), lb = /* @__PURE__ */ a((e) => {
    let [t, r, o, n] = Hc(e), [i, s, l] = Oe.default.hsl.rgb([t, r, o]) || [0, 0, 0];
    return {
      valid: !0,
      value: e,
      keyword: Oe.default.hsl.keyword([t, r, o]),
      colorSpace: "hsl",
      rgb: `rgba(${i}, ${s}, ${l}, ${n})`,
      hsl: e,
      hex: `#${Oe.default.hsl.hex([t, r, o]).toLowerCase()}`
    };
  }, "parseHsl"), cb = /* @__PURE__ */ a((e) => {
    let t = e.replace("#", ""), r = Oe.default.keyword.rgb(t) || Oe.default.hex.rgb(t), o = Oe.default.rgb.hsl(r), n = e;
    /[^#a-f0-9]/i.test(e) ? n = t : ba.test(e) && (n = `#${t}`);
    let i = !0;
    if (n.startsWith("#"))
      i = ba.test(n);
    else
      try {
        Oe.default.keyword.hex(n);
      } catch {
        i = !1;
      }
    return {
      valid: i,
      value: n,
      keyword: Oe.default.rgb.keyword(r),
      colorSpace: "hex",
      rgb: `rgba(${r[0]}, ${r[1]}, ${r[2]}, 1)`,
      hsl: `hsla(${o[0]}, ${o[1]}%, ${o[2]}%, 1)`,
      hex: n
    };
  }, "parseHexOrKeyword"), Gt = /* @__PURE__ */ a((e) => {
    if (e)
      return ob.test(e) ? sb(e) : nb.test(e) ? lb(e) : cb(e);
  }, "parseValue"), pb = /* @__PURE__ */ a((e, t, r) => {
    if (!e || !t?.valid)
      return So[r];
    if (r !== "hex")
      return t?.[r] || So[r];
    if (!t.hex.startsWith("#"))
      try {
        return `#${Oe.default.keyword.hex(t.hex)}`;
      } catch {
        return So.hex;
      }
    let o = t.hex.match(ab);
    if (!o)
      return ba.test(t.hex) ? t.hex : So.hex;
    let [n, i, s] = o[1].split("");
    return `#${n}${n}${i}${i}${s}${s}`;
  }, "getRealValue"), ub = /* @__PURE__ */ a((e, t) => {
    let [r, o] = Co(e || ""), [n, i] = Co(() => Gt(r)), [s, l] = Co(n?.colorSpace || "hex");
    Bc(() => {
      let g = e || "", p = Gt(g);
      o(g), i(p), l(p?.colorSpace || "hex");
    }, [e]);
    let c = Fc(
      () => pb(r, n, s).toLowerCase(),
      [r, n, s]
    ), u = wo(
      (g) => {
        let p = Gt(g), m = p?.value || g || "";
        o(m), m === "" && (i(void 0), t(void 0)), p && (i(p), l(p.colorSpace), t(p.value));
      },
      [t]
    ), d = wo(() => {
      let p = (ya.indexOf(s) + 1) % ya.length, m = ya[p];
      l(m);
      let f = n?.[m] || "";
      o(f), t(f);
    }, [n, s, t]);
    return { value: r, realValue: c, updateValue: u, color: n, colorSpace: s, cycleColorSpace: d };
  }, "useColorInput"), To = /* @__PURE__ */ a((e) => e.replace(/\s*/, "").toLowerCase(), "id"), db = /* @__PURE__ */ a((e, t, r) => {
    let [o, n] = Co(t?.valid ? [t] : []);
    Bc(() => {
      t === void 0 && n([]);
    }, [t]);
    let i = Fc(() => (e || []).map((c) => typeof c == "string" ? Gt(c) : c.title ? { ...Gt(c.color), keyword: c.title } : Gt(c.color)).concat(
    o).filter(Boolean).slice(-27), [e, o]), s = wo(
      (l) => {
        l?.valid && (i.some(
          (c) => c && c[r] && To(c[r] || "") === To(l[r] || "")
        ) || n((c) => c.concat(l)));
      },
      [r, i]
    );
    return { presets: i, addPreset: s };
  }, "usePresets"), $c = /* @__PURE__ */ a(({
    name: e,
    value: t,
    onChange: r,
    onFocus: o,
    onBlur: n,
    presetColors: i,
    startOpen: s = !1,
    argType: l
  }) => {
    let c = wo(bn(r, 200), [r]), { value: u, realValue: d, updateValue: g, color: p, colorSpace: m, cycleColorSpace: f } = ub(
      t,
      c
    ), { presets: y, addPreset: h } = db(i ?? [], p, m), b = ib[m], x = !!l?.table?.readonly;
    return /* @__PURE__ */ De.createElement(Gy, { "aria-readonly": x }, /* @__PURE__ */ De.createElement(
      Jy,
      {
        startOpen: s,
        trigger: x ? null : void 0,
        closeOnOutsideClick: !0,
        onVisibleChange: () => p && h(p),
        tooltip: /* @__PURE__ */ De.createElement(Ky, null, /* @__PURE__ */ De.createElement(
          b,
          {
            color: d === "transparent" ? "#000000" : d,
            onChange: g,
            onFocus: o,
            onBlur: n
          }
        ), y.length > 0 && /* @__PURE__ */ De.createElement(Xy, null, y.map((v, E) => /* @__PURE__ */ De.createElement(
          Rc,
          {
            key: `${v?.value || E}-${E}`,
            hasChrome: !1,
            tooltip: /* @__PURE__ */ De.createElement(Yy, { note: v?.keyword || v?.value || "" })
          },
          /* @__PURE__ */ De.createElement(
            Mc,
            {
              value: v?.[m] || "",
              active: !!(p && v && v[m] && To(v[m] || "") === To(p[m])),
              onClick: () => v && g(v.value || "")
            }
          )
        ))))
      },
      /* @__PURE__ */ De.createElement(Mc, { value: d, style: { margin: 4 } })
    ), /* @__PURE__ */ De.createElement(
      eb,
      {
        id: X(e),
        value: u,
        onChange: (v) => g(v.target.value),
        onFocus: (v) => v.target.select(),
        readOnly: x,
        placeholder: "Choose color..."
      }
    ), u ? /* @__PURE__ */ De.createElement(tb, { onClick: f }) : null);
  }, "ColorControl"), fb = $c;
});

// ../node_modules/memoizerific/memoizerific.js
var Yc = J((Kc, Ea) => {
  (function(e) {
    if (typeof Kc == "object" && typeof Ea < "u")
      Ea.exports = e();
    else if (typeof define == "function" && define.amd)
      define([], e);
    else {
      var t;
      typeof window < "u" ? t = window : typeof global < "u" ? t = global : typeof self < "u" ? t = self : t = this, t.memoizerific = e();
    }
  })(function() {
    var e, t, r;
    return (/* @__PURE__ */ a(function o(n, i, s) {
      function l(d, g) {
        if (!i[d]) {
          if (!n[d]) {
            var p = typeof rr == "function" && rr;
            if (!g && p) return p(d, !0);
            if (c) return c(d, !0);
            var m = new Error("Cannot find module '" + d + "'");
            throw m.code = "MODULE_NOT_FOUND", m;
          }
          var f = i[d] = { exports: {} };
          n[d][0].call(f.exports, function(y) {
            var h = n[d][1][y];
            return l(h || y);
          }, f, f.exports, o, n, i, s);
        }
        return i[d].exports;
      }
      a(l, "s");
      for (var c = typeof rr == "function" && rr, u = 0; u < s.length; u++) l(s[u]);
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
        var c;
        if (this.lastItem && this.isEqual(this.lastItem.key, l))
          return this.lastItem.val;
        if (c = this.indexOf(l), c >= 0)
          return this.lastItem = this.list[c], this.list[c].val;
      }, s.prototype.set = function(l, c) {
        var u;
        return this.lastItem && this.isEqual(this.lastItem.key, l) ? (this.lastItem.val = c, this) : (u = this.indexOf(l), u >= 0 ? (this.lastItem =
        this.list[u], this.list[u].val = c, this) : (this.lastItem = { key: l, val: c }, this.list.push(this.lastItem), this.size++, this));
      }, s.prototype.delete = function(l) {
        var c;
        if (this.lastItem && this.isEqual(this.lastItem.key, l) && (this.lastItem = void 0), c = this.indexOf(l), c >= 0)
          return this.size--, this.list.splice(c, 1)[0];
      }, s.prototype.has = function(l) {
        var c;
        return this.lastItem && this.isEqual(this.lastItem.key, l) ? !0 : (c = this.indexOf(l), c >= 0 ? (this.lastItem = this.list[c], !0) :
        !1);
      }, s.prototype.forEach = function(l, c) {
        var u;
        for (u = 0; u < this.size; u++)
          l.call(c || this, this.list[u].val, this.list[u].key, this);
      }, s.prototype.indexOf = function(l) {
        var c;
        for (c = 0; c < this.size; c++)
          if (this.isEqual(this.list[c].key, l))
            return c;
        return -1;
      }, s.prototype.isEqual = function(l, c) {
        return l === c || l !== l && c !== c;
      }, n.exports = s;
    }, {}], 3: [function(o, n, i) {
      var s = o("map-or-similar");
      n.exports = function(d) {
        var g = new s(!1), p = [];
        return function(m) {
          var f = /* @__PURE__ */ a(function() {
            var y = g, h, b, x = arguments.length - 1, v = Array(x + 1), E = !0, S;
            if ((f.numArgs || f.numArgs === 0) && f.numArgs !== x + 1)
              throw new Error("Memoizerific functions should always be called with the same number of arguments");
            for (S = 0; S < x; S++) {
              if (v[S] = {
                cacheItem: y,
                arg: arguments[S]
              }, y.has(arguments[S])) {
                y = y.get(arguments[S]);
                continue;
              }
              E = !1, h = new s(!1), y.set(arguments[S], h), y = h;
            }
            return E && (y.has(arguments[x]) ? b = y.get(arguments[x]) : E = !1), E || (b = m.apply(null, arguments), y.set(arguments[x], b)),
            d > 0 && (v[x] = {
              cacheItem: y,
              arg: arguments[x]
            }, E ? l(p, v) : p.push(v), p.length > d && c(p.shift())), f.wasMemoized = E, f.numArgs = x + 1, b;
          }, "memoizerific");
          return f.limit = d, f.wasMemoized = !1, f.cache = g, f.lru = p, f;
        };
      };
      function l(d, g) {
        var p = d.length, m = g.length, f, y, h;
        for (y = 0; y < p; y++) {
          for (f = !0, h = 0; h < m; h++)
            if (!u(d[y][h].arg, g[h].arg)) {
              f = !1;
              break;
            }
          if (f)
            break;
        }
        d.push(d.splice(y, 1)[0]);
      }
      a(l, "moveToMostRecentLru");
      function c(d) {
        var g = d.length, p = d[g - 1], m, f;
        for (p.cacheItem.delete(p.arg), f = g - 2; f >= 0 && (p = d[f], m = p.cacheItem.get(p.arg), !m || !m.size); f--)
          p.cacheItem.delete(p.arg);
      }
      a(c, "removeCachedResult");
      function u(d, g) {
        return d === g || d !== d && g !== g;
      }
      a(u, "isEqual");
    }, { "map-or-similar": 1 }] }, {}, [3])(3);
  });
});

// ../node_modules/entities/lib/maps/entities.json
var Ga = J((o_, b1) => {
  b1.exports = { Aacute: "\xC1", aacute: "\xE1", Abreve: "\u0102", abreve: "\u0103", ac: "\u223E", acd: "\u223F", acE: "\u223E\u0333", Acirc: "\
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
var Xp = J((n_, x1) => {
  x1.exports = { Aacute: "\xC1", aacute: "\xE1", Acirc: "\xC2", acirc: "\xE2", acute: "\xB4", AElig: "\xC6", aelig: "\xE6", Agrave: "\xC0", agrave: "\
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
var Ja = J((a_, v1) => {
  v1.exports = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };
});

// ../node_modules/entities/lib/maps/decode.json
var Zp = J((i_, E1) => {
  E1.exports = { "0": 65533, "128": 8364, "130": 8218, "131": 402, "132": 8222, "133": 8230, "134": 8224, "135": 8225, "136": 710, "137": 8240,
  "138": 352, "139": 8249, "140": 338, "142": 381, "145": 8216, "146": 8217, "147": 8220, "148": 8221, "149": 8226, "150": 8211, "151": 8212,
  "152": 732, "153": 8482, "154": 353, "155": 8250, "156": 339, "158": 382, "159": 376 };
});

// ../node_modules/entities/lib/decode_codepoint.js
var eu = J((Tr) => {
  "use strict";
  var S1 = Tr && Tr.__importDefault || function(e) {
    return e && e.__esModule ? e : { default: e };
  };
  Object.defineProperty(Tr, "__esModule", { value: !0 });
  var Qp = S1(Zp()), C1 = (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    String.fromCodePoint || function(e) {
      var t = "";
      return e > 65535 && (e -= 65536, t += String.fromCharCode(e >>> 10 & 1023 | 55296), e = 56320 | e & 1023), t += String.fromCharCode(e),
      t;
    }
  );
  function w1(e) {
    return e >= 55296 && e <= 57343 || e > 1114111 ? "\uFFFD" : (e in Qp.default && (e = Qp.default[e]), C1(e));
  }
  a(w1, "decodeCodePoint");
  Tr.default = w1;
});

// ../node_modules/entities/lib/decode.js
var Ya = J((We) => {
  "use strict";
  var Ro = We && We.__importDefault || function(e) {
    return e && e.__esModule ? e : { default: e };
  };
  Object.defineProperty(We, "__esModule", { value: !0 });
  We.decodeHTML = We.decodeHTMLStrict = We.decodeXML = void 0;
  var Ka = Ro(Ga()), T1 = Ro(Xp()), A1 = Ro(Ja()), tu = Ro(eu()), k1 = /&(?:[a-zA-Z0-9]+|#[xX][\da-fA-F]+|#\d+);/g;
  We.decodeXML = ou(A1.default);
  We.decodeHTMLStrict = ou(Ka.default);
  function ou(e) {
    var t = nu(e);
    return function(r) {
      return String(r).replace(k1, t);
    };
  }
  a(ou, "getStrictDecoder");
  var ru = /* @__PURE__ */ a(function(e, t) {
    return e < t ? 1 : -1;
  }, "sorter");
  We.decodeHTML = function() {
    for (var e = Object.keys(T1.default).sort(ru), t = Object.keys(Ka.default).sort(ru), r = 0, o = 0; r < t.length; r++)
      e[o] === t[r] ? (t[r] += ";?", o++) : t[r] += ";";
    var n = new RegExp("&(?:" + t.join("|") + "|#[xX][\\da-fA-F]+;?|#\\d+;?)", "g"), i = nu(Ka.default);
    function s(l) {
      return l.substr(-1) !== ";" && (l += ";"), i(l);
    }
    return a(s, "replacer"), function(l) {
      return String(l).replace(n, s);
    };
  }();
  function nu(e) {
    return /* @__PURE__ */ a(function(r) {
      if (r.charAt(1) === "#") {
        var o = r.charAt(2);
        return o === "X" || o === "x" ? tu.default(parseInt(r.substr(3), 16)) : tu.default(parseInt(r.substr(2), 10));
      }
      return e[r.slice(1, -1)] || r;
    }, "replace");
  }
  a(nu, "getReplacer");
});

// ../node_modules/entities/lib/encode.js
var Za = J((Te) => {
  "use strict";
  var au = Te && Te.__importDefault || function(e) {
    return e && e.__esModule ? e : { default: e };
  };
  Object.defineProperty(Te, "__esModule", { value: !0 });
  Te.escapeUTF8 = Te.escape = Te.encodeNonAsciiHTML = Te.encodeHTML = Te.encodeXML = void 0;
  var O1 = au(Ja()), iu = lu(O1.default), su = cu(iu);
  Te.encodeXML = du(iu);
  var I1 = au(Ga()), Xa = lu(I1.default), P1 = cu(Xa);
  Te.encodeHTML = N1(Xa, P1);
  Te.encodeNonAsciiHTML = du(Xa);
  function lu(e) {
    return Object.keys(e).sort().reduce(function(t, r) {
      return t[e[r]] = "&" + r + ";", t;
    }, {});
  }
  a(lu, "getInverseObj");
  function cu(e) {
    for (var t = [], r = [], o = 0, n = Object.keys(e); o < n.length; o++) {
      var i = n[o];
      i.length === 1 ? t.push("\\" + i) : r.push(i);
    }
    t.sort();
    for (var s = 0; s < t.length - 1; s++) {
      for (var l = s; l < t.length - 1 && t[l].charCodeAt(1) + 1 === t[l + 1].charCodeAt(1); )
        l += 1;
      var c = 1 + l - s;
      c < 3 || t.splice(s, c, t[s] + "-" + t[l]);
    }
    return r.unshift("[" + t.join("") + "]"), new RegExp(r.join("|"), "g");
  }
  a(cu, "getInverseReplacer");
  var pu = /(?:[\x80-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/g,
  L1 = (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    String.prototype.codePointAt != null ? (
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      function(e) {
        return e.codePointAt(0);
      }
    ) : (
      // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      function(e) {
        return (e.charCodeAt(0) - 55296) * 1024 + e.charCodeAt(1) - 56320 + 65536;
      }
    )
  );
  function jo(e) {
    return "&#x" + (e.length > 1 ? L1(e) : e.charCodeAt(0)).toString(16).toUpperCase() + ";";
  }
  a(jo, "singleCharReplacer");
  function N1(e, t) {
    return function(r) {
      return r.replace(t, function(o) {
        return e[o];
      }).replace(pu, jo);
    };
  }
  a(N1, "getInverse");
  var uu = new RegExp(su.source + "|" + pu.source, "g");
  function _1(e) {
    return e.replace(uu, jo);
  }
  a(_1, "escape");
  Te.escape = _1;
  function D1(e) {
    return e.replace(su, jo);
  }
  a(D1, "escapeUTF8");
  Te.escapeUTF8 = D1;
  function du(e) {
    return function(t) {
      return t.replace(uu, function(r) {
        return e[r] || jo(r);
      });
    };
  }
  a(du, "getASCIIEncoder");
});

// ../node_modules/entities/lib/index.js
var mu = J((F) => {
  "use strict";
  Object.defineProperty(F, "__esModule", { value: !0 });
  F.decodeXMLStrict = F.decodeHTML5Strict = F.decodeHTML4Strict = F.decodeHTML5 = F.decodeHTML4 = F.decodeHTMLStrict = F.decodeHTML = F.decodeXML =
  F.encodeHTML5 = F.encodeHTML4 = F.escapeUTF8 = F.escape = F.encodeNonAsciiHTML = F.encodeHTML = F.encodeXML = F.encode = F.decodeStrict = F.
  decode = void 0;
  var Ho = Ya(), fu = Za();
  function M1(e, t) {
    return (!t || t <= 0 ? Ho.decodeXML : Ho.decodeHTML)(e);
  }
  a(M1, "decode");
  F.decode = M1;
  function B1(e, t) {
    return (!t || t <= 0 ? Ho.decodeXML : Ho.decodeHTMLStrict)(e);
  }
  a(B1, "decodeStrict");
  F.decodeStrict = B1;
  function F1(e, t) {
    return (!t || t <= 0 ? fu.encodeXML : fu.encodeHTML)(e);
  }
  a(F1, "encode");
  F.encode = F1;
  var Nt = Za();
  Object.defineProperty(F, "encodeXML", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return Nt.encodeXML;
  }, "get") });
  Object.defineProperty(F, "encodeHTML", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return Nt.encodeHTML;
  }, "get") });
  Object.defineProperty(F, "encodeNonAsciiHTML", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return Nt.encodeNonAsciiHTML;
  }, "get") });
  Object.defineProperty(F, "escape", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return Nt.escape;
  }, "get") });
  Object.defineProperty(F, "escapeUTF8", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return Nt.escapeUTF8;
  }, "get") });
  Object.defineProperty(F, "encodeHTML4", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return Nt.encodeHTML;
  }, "get") });
  Object.defineProperty(F, "encodeHTML5", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return Nt.encodeHTML;
  }, "get") });
  var yt = Ya();
  Object.defineProperty(F, "decodeXML", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return yt.decodeXML;
  }, "get") });
  Object.defineProperty(F, "decodeHTML", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return yt.decodeHTML;
  }, "get") });
  Object.defineProperty(F, "decodeHTMLStrict", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return yt.decodeHTMLStrict;
  }, "get") });
  Object.defineProperty(F, "decodeHTML4", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return yt.decodeHTML;
  }, "get") });
  Object.defineProperty(F, "decodeHTML5", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return yt.decodeHTML;
  }, "get") });
  Object.defineProperty(F, "decodeHTML4Strict", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return yt.decodeHTMLStrict;
  }, "get") });
  Object.defineProperty(F, "decodeHTML5Strict", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return yt.decodeHTMLStrict;
  }, "get") });
  Object.defineProperty(F, "decodeXMLStrict", { enumerable: !0, get: /* @__PURE__ */ a(function() {
    return yt.decodeXML;
  }, "get") });
});

// ../node_modules/ansi-to-html/lib/ansi_to_html.js
var Tu = J((g_, wu) => {
  "use strict";
  function R1(e, t) {
    if (!(e instanceof t))
      throw new TypeError("Cannot call a class as a function");
  }
  a(R1, "_classCallCheck");
  function gu(e, t) {
    for (var r = 0; r < t.length; r++) {
      var o = t[r];
      o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, o.key, o);
    }
  }
  a(gu, "_defineProperties");
  function j1(e, t, r) {
    return t && gu(e.prototype, t), r && gu(e, r), e;
  }
  a(j1, "_createClass");
  function Eu(e, t) {
    var r = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (!r) {
      if (Array.isArray(e) || (r = H1(e)) || t && e && typeof e.length == "number") {
        r && (e = r);
        var o = 0, n = /* @__PURE__ */ a(function() {
        }, "F");
        return { s: n, n: /* @__PURE__ */ a(function() {
          return o >= e.length ? { done: !0 } : { done: !1, value: e[o++] };
        }, "n"), e: /* @__PURE__ */ a(function(u) {
          throw u;
        }, "e"), f: n };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var i = !0, s = !1, l;
    return { s: /* @__PURE__ */ a(function() {
      r = r.call(e);
    }, "s"), n: /* @__PURE__ */ a(function() {
      var u = r.next();
      return i = u.done, u;
    }, "n"), e: /* @__PURE__ */ a(function(u) {
      s = !0, l = u;
    }, "e"), f: /* @__PURE__ */ a(function() {
      try {
        !i && r.return != null && r.return();
      } finally {
        if (s) throw l;
      }
    }, "f") };
  }
  a(Eu, "_createForOfIteratorHelper");
  function H1(e, t) {
    if (e) {
      if (typeof e == "string") return hu(e, t);
      var r = Object.prototype.toString.call(e).slice(8, -1);
      if (r === "Object" && e.constructor && (r = e.constructor.name), r === "Map" || r === "Set") return Array.from(e);
      if (r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)) return hu(e, t);
    }
  }
  a(H1, "_unsupportedIterableToArray");
  function hu(e, t) {
    (t == null || t > e.length) && (t = e.length);
    for (var r = 0, o = new Array(t); r < t; r++)
      o[r] = e[r];
    return o;
  }
  a(hu, "_arrayLikeToArray");
  var $1 = mu(), yu = {
    fg: "#FFF",
    bg: "#000",
    newline: !1,
    escapeXML: !1,
    stream: !1,
    colors: V1()
  };
  function V1() {
    var e = {
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
    return $o(0, 5).forEach(function(t) {
      $o(0, 5).forEach(function(r) {
        $o(0, 5).forEach(function(o) {
          return z1(t, r, o, e);
        });
      });
    }), $o(0, 23).forEach(function(t) {
      var r = t + 232, o = Su(t * 10 + 8);
      e[r] = "#" + o + o + o;
    }), e;
  }
  a(V1, "getDefaultColors");
  function z1(e, t, r, o) {
    var n = 16 + e * 36 + t * 6 + r, i = e > 0 ? e * 40 + 55 : 0, s = t > 0 ? t * 40 + 55 : 0, l = r > 0 ? r * 40 + 55 : 0;
    o[n] = U1([i, s, l]);
  }
  a(z1, "setStyleColor");
  function Su(e) {
    for (var t = e.toString(16); t.length < 2; )
      t = "0" + t;
    return t;
  }
  a(Su, "toHexString");
  function U1(e) {
    var t = [], r = Eu(e), o;
    try {
      for (r.s(); !(o = r.n()).done; ) {
        var n = o.value;
        t.push(Su(n));
      }
    } catch (i) {
      r.e(i);
    } finally {
      r.f();
    }
    return "#" + t.join("");
  }
  a(U1, "toColorHexString");
  function bu(e, t, r, o) {
    var n;
    return t === "text" ? n = J1(r, o) : t === "display" ? n = W1(e, r, o) : t === "xterm256Foreground" ? n = zo(e, o.colors[r]) : t === "xt\
erm256Background" ? n = Uo(e, o.colors[r]) : t === "rgb" && (n = q1(e, r)), n;
  }
  a(bu, "generateOutput");
  function q1(e, t) {
    t = t.substring(2).slice(0, -1);
    var r = +t.substr(0, 2), o = t.substring(5).split(";"), n = o.map(function(i) {
      return ("0" + Number(i).toString(16)).substr(-2);
    }).join("");
    return Vo(e, (r === 38 ? "color:#" : "background-color:#") + n);
  }
  a(q1, "handleRgb");
  function W1(e, t, r) {
    t = parseInt(t, 10);
    var o = {
      "-1": /* @__PURE__ */ a(function() {
        return "<br/>";
      }, "_"),
      0: /* @__PURE__ */ a(function() {
        return e.length && Cu(e);
      }, "_"),
      1: /* @__PURE__ */ a(function() {
        return bt(e, "b");
      }, "_"),
      3: /* @__PURE__ */ a(function() {
        return bt(e, "i");
      }, "_"),
      4: /* @__PURE__ */ a(function() {
        return bt(e, "u");
      }, "_"),
      8: /* @__PURE__ */ a(function() {
        return Vo(e, "display:none");
      }, "_"),
      9: /* @__PURE__ */ a(function() {
        return bt(e, "strike");
      }, "_"),
      22: /* @__PURE__ */ a(function() {
        return Vo(e, "font-weight:normal;text-decoration:none;font-style:normal");
      }, "_"),
      23: /* @__PURE__ */ a(function() {
        return vu(e, "i");
      }, "_"),
      24: /* @__PURE__ */ a(function() {
        return vu(e, "u");
      }, "_"),
      39: /* @__PURE__ */ a(function() {
        return zo(e, r.fg);
      }, "_"),
      49: /* @__PURE__ */ a(function() {
        return Uo(e, r.bg);
      }, "_"),
      53: /* @__PURE__ */ a(function() {
        return Vo(e, "text-decoration:overline");
      }, "_")
    }, n;
    return o[t] ? n = o[t]() : 4 < t && t < 7 ? n = bt(e, "blink") : 29 < t && t < 38 ? n = zo(e, r.colors[t - 30]) : 39 < t && t < 48 ? n =
    Uo(e, r.colors[t - 40]) : 89 < t && t < 98 ? n = zo(e, r.colors[8 + (t - 90)]) : 99 < t && t < 108 && (n = Uo(e, r.colors[8 + (t - 100)])),
    n;
  }
  a(W1, "handleDisplay");
  function Cu(e) {
    var t = e.slice(0);
    return e.length = 0, t.reverse().map(function(r) {
      return "</" + r + ">";
    }).join("");
  }
  a(Cu, "resetStyles");
  function $o(e, t) {
    for (var r = [], o = e; o <= t; o++)
      r.push(o);
    return r;
  }
  a($o, "range");
  function G1(e) {
    return function(t) {
      return (e === null || t.category !== e) && e !== "all";
    };
  }
  a(G1, "notCategory");
  function xu(e) {
    e = parseInt(e, 10);
    var t = null;
    return e === 0 ? t = "all" : e === 1 ? t = "bold" : 2 < e && e < 5 ? t = "underline" : 4 < e && e < 7 ? t = "blink" : e === 8 ? t = "hid\
e" : e === 9 ? t = "strike" : 29 < e && e < 38 || e === 39 || 89 < e && e < 98 ? t = "foreground-color" : (39 < e && e < 48 || e === 49 || 99 <
    e && e < 108) && (t = "background-color"), t;
  }
  a(xu, "categoryForCode");
  function J1(e, t) {
    return t.escapeXML ? $1.encodeXML(e) : e;
  }
  a(J1, "pushText");
  function bt(e, t, r) {
    return r || (r = ""), e.push(t), "<".concat(t).concat(r ? ' style="'.concat(r, '"') : "", ">");
  }
  a(bt, "pushTag");
  function Vo(e, t) {
    return bt(e, "span", t);
  }
  a(Vo, "pushStyle");
  function zo(e, t) {
    return bt(e, "span", "color:" + t);
  }
  a(zo, "pushForegroundColor");
  function Uo(e, t) {
    return bt(e, "span", "background-color:" + t);
  }
  a(Uo, "pushBackgroundColor");
  function vu(e, t) {
    var r;
    if (e.slice(-1)[0] === t && (r = e.pop()), r)
      return "</" + t + ">";
  }
  a(vu, "closeTag");
  function K1(e, t, r) {
    var o = !1, n = 3;
    function i() {
      return "";
    }
    a(i, "remove");
    function s(S, w) {
      return r("xterm256Foreground", w), "";
    }
    a(s, "removeXterm256Foreground");
    function l(S, w) {
      return r("xterm256Background", w), "";
    }
    a(l, "removeXterm256Background");
    function c(S) {
      return t.newline ? r("display", -1) : r("text", S), "";
    }
    a(c, "newline");
    function u(S, w) {
      o = !0, w.trim().length === 0 && (w = "0"), w = w.trimRight(";").split(";");
      var P = Eu(w), N;
      try {
        for (P.s(); !(N = P.n()).done; ) {
          var q = N.value;
          r("display", q);
        }
      } catch (H) {
        P.e(H);
      } finally {
        P.f();
      }
      return "";
    }
    a(u, "ansiMess");
    function d(S) {
      return r("text", S), "";
    }
    a(d, "realText");
    function g(S) {
      return r("rgb", S), "";
    }
    a(g, "rgb");
    var p = [{
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
      sub: g
    }, {
      pattern: /^\x1b\[38;5;(\d+)m/,
      sub: s
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
      sub: u
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
      sub: d
    }];
    function m(S, w) {
      w > n && o || (o = !1, e = e.replace(S.pattern, S.sub));
    }
    a(m, "process");
    var f = [], y = e, h = y.length;
    e: for (; h > 0; ) {
      for (var b = 0, x = 0, v = p.length; x < v; b = ++x) {
        var E = p[b];
        if (m(E, b), e.length !== h) {
          h = e.length;
          continue e;
        }
      }
      if (e.length === h)
        break;
      f.push(0), h = e.length;
    }
    return f;
  }
  a(K1, "tokenize");
  function Y1(e, t, r) {
    return t !== "text" && (e = e.filter(G1(xu(r))), e.push({
      token: t,
      data: r,
      category: xu(r)
    })), e;
  }
  a(Y1, "updateStickyStack");
  var X1 = /* @__PURE__ */ function() {
    function e(t) {
      R1(this, e), t = t || {}, t.colors && (t.colors = Object.assign({}, yu.colors, t.colors)), this.options = Object.assign({}, yu, t), this.
      stack = [], this.stickyStack = [];
    }
    return a(e, "Filter"), j1(e, [{
      key: "toHtml",
      value: /* @__PURE__ */ a(function(r) {
        var o = this;
        r = typeof r == "string" ? [r] : r;
        var n = this.stack, i = this.options, s = [];
        return this.stickyStack.forEach(function(l) {
          var c = bu(n, l.token, l.data, i);
          c && s.push(c);
        }), K1(r.join(""), i, function(l, c) {
          var u = bu(n, l, c, i);
          u && s.push(u), i.stream && (o.stickyStack = Y1(o.stickyStack, l, c));
        }), n.length && s.push(Cu(n)), s.join("");
      }, "toHtml")
    }]), e;
  }();
  wu.exports = X1;
});

// ../node_modules/@devtools-ds/object-inspector/node_modules/@babel/runtime/helpers/extends.js
var qo = J((H_, ni) => {
  function oi() {
    return ni.exports = oi = Object.assign || function(e) {
      for (var t = 1; t < arguments.length; t++) {
        var r = arguments[t];
        for (var o in r)
          Object.prototype.hasOwnProperty.call(r, o) && (e[o] = r[o]);
      }
      return e;
    }, oi.apply(this, arguments);
  }
  a(oi, "_extends");
  ni.exports = oi;
});

// ../node_modules/@devtools-ds/object-inspector/node_modules/@babel/runtime/helpers/objectWithoutPropertiesLoose.js
var Nu = J((V_, Lu) => {
  function dv(e, t) {
    if (e == null) return {};
    var r = {}, o = Object.keys(e), n, i;
    for (i = 0; i < o.length; i++)
      n = o[i], !(t.indexOf(n) >= 0) && (r[n] = e[n]);
    return r;
  }
  a(dv, "_objectWithoutPropertiesLoose");
  Lu.exports = dv;
});

// ../node_modules/@devtools-ds/object-inspector/node_modules/@babel/runtime/helpers/objectWithoutProperties.js
var Wo = J((U_, _u) => {
  var fv = Nu();
  function mv(e, t) {
    if (e == null) return {};
    var r = fv(e, t), o, n;
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (n = 0; n < i.length; n++)
        o = i[n], !(t.indexOf(o) >= 0) && Object.prototype.propertyIsEnumerable.call(e, o) && (r[o] = e[o]);
    }
    return r;
  }
  a(mv, "_objectWithoutProperties");
  _u.exports = mv;
});

// ../node_modules/@devtools-ds/themes/node_modules/@babel/runtime/helpers/defineProperty.js
var Bu = J((Y_, Mu) => {
  function hv(e, t, r) {
    return t in e ? Object.defineProperty(e, t, {
      value: r,
      enumerable: !0,
      configurable: !0,
      writable: !0
    }) : e[t] = r, e;
  }
  a(hv, "_defineProperty");
  Mu.exports = hv;
});

// ../node_modules/@devtools-ds/themes/node_modules/@babel/runtime/helpers/objectSpread2.js
var ju = J((Z_, Ru) => {
  var yv = Bu();
  function Fu(e, t) {
    var r = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var o = Object.getOwnPropertySymbols(e);
      t && (o = o.filter(function(n) {
        return Object.getOwnPropertyDescriptor(e, n).enumerable;
      })), r.push.apply(r, o);
    }
    return r;
  }
  a(Fu, "ownKeys");
  function bv(e) {
    for (var t = 1; t < arguments.length; t++) {
      var r = arguments[t] != null ? arguments[t] : {};
      t % 2 ? Fu(r, !0).forEach(function(o) {
        yv(e, o, r[o]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r)) : Fu(r).forEach(function(o) {
        Object.defineProperty(e, o, Object.getOwnPropertyDescriptor(r, o));
      });
    }
    return e;
  }
  a(bv, "_objectSpread2");
  Ru.exports = bv;
});

// ../node_modules/@devtools-ds/themes/node_modules/@babel/runtime/helpers/objectWithoutPropertiesLoose.js
var $u = J((eD, Hu) => {
  function xv(e, t) {
    if (e == null) return {};
    var r = {}, o = Object.keys(e), n, i;
    for (i = 0; i < o.length; i++)
      n = o[i], !(t.indexOf(n) >= 0) && (r[n] = e[n]);
    return r;
  }
  a(xv, "_objectWithoutPropertiesLoose");
  Hu.exports = xv;
});

// ../node_modules/@devtools-ds/themes/node_modules/@babel/runtime/helpers/objectWithoutProperties.js
var zu = J((rD, Vu) => {
  var vv = $u();
  function Ev(e, t) {
    if (e == null) return {};
    var r = vv(e, t), o, n;
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (n = 0; n < i.length; n++)
        o = i[n], !(t.indexOf(o) >= 0) && Object.prototype.propertyIsEnumerable.call(e, o) && (r[o] = e[o]);
    }
    return r;
  }
  a(Ev, "_objectWithoutProperties");
  Vu.exports = Ev;
});

// ../node_modules/@devtools-ds/object-inspector/node_modules/@babel/runtime/helpers/defineProperty.js
var Gu = J((lD, Wu) => {
  function Cv(e, t, r) {
    return t in e ? Object.defineProperty(e, t, {
      value: r,
      enumerable: !0,
      configurable: !0,
      writable: !0
    }) : e[t] = r, e;
  }
  a(Cv, "_defineProperty");
  Wu.exports = Cv;
});

// ../node_modules/@devtools-ds/object-inspector/node_modules/@babel/runtime/helpers/objectSpread2.js
var Yu = J((pD, Ku) => {
  var wv = Gu();
  function Ju(e, t) {
    var r = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var o = Object.getOwnPropertySymbols(e);
      t && (o = o.filter(function(n) {
        return Object.getOwnPropertyDescriptor(e, n).enumerable;
      })), r.push.apply(r, o);
    }
    return r;
  }
  a(Ju, "ownKeys");
  function Tv(e) {
    for (var t = 1; t < arguments.length; t++) {
      var r = arguments[t] != null ? arguments[t] : {};
      t % 2 ? Ju(r, !0).forEach(function(o) {
        wv(e, o, r[o]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r)) : Ju(r).forEach(function(o) {
        Object.defineProperty(e, o, Object.getOwnPropertyDescriptor(r, o));
      });
    }
    return e;
  }
  a(Tv, "_objectSpread2");
  Ku.exports = Tv;
});

// ../node_modules/@devtools-ds/tree/node_modules/@babel/runtime/helpers/extends.js
var Xu = J((dD, di) => {
  function ui() {
    return di.exports = ui = Object.assign || function(e) {
      for (var t = 1; t < arguments.length; t++) {
        var r = arguments[t];
        for (var o in r)
          Object.prototype.hasOwnProperty.call(r, o) && (e[o] = r[o]);
      }
      return e;
    }, ui.apply(this, arguments);
  }
  a(ui, "_extends");
  di.exports = ui;
});

// ../node_modules/@devtools-ds/tree/node_modules/@babel/runtime/helpers/objectWithoutPropertiesLoose.js
var Qu = J((mD, Zu) => {
  function Av(e, t) {
    if (e == null) return {};
    var r = {}, o = Object.keys(e), n, i;
    for (i = 0; i < o.length; i++)
      n = o[i], !(t.indexOf(n) >= 0) && (r[n] = e[n]);
    return r;
  }
  a(Av, "_objectWithoutPropertiesLoose");
  Zu.exports = Av;
});

// ../node_modules/@devtools-ds/tree/node_modules/@babel/runtime/helpers/objectWithoutProperties.js
var td = J((hD, ed) => {
  var kv = Qu();
  function Ov(e, t) {
    if (e == null) return {};
    var r = kv(e, t), o, n;
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (n = 0; n < i.length; n++)
        o = i[n], !(t.indexOf(o) >= 0) && Object.prototype.propertyIsEnumerable.call(e, o) && (r[o] = e[o]);
    }
    return r;
  }
  a(Ov, "_objectWithoutProperties");
  ed.exports = Ov;
});

// src/core-server/presets/common-manager.ts
import { global as BC } from "@storybook/global";
import { addons as FC } from "storybook/manager-api";

// src/controls/manager.tsx
import Me from "react";
import { AddonPanel as W0 } from "storybook/internal/components";
import { SAVE_STORY_REQUEST as hp, SAVE_STORY_RESPONSE as La } from "storybook/internal/core-events";
import { FailedIcon as G0, PassedIcon as yp } from "@storybook/icons";

// ../node_modules/dequal/dist/index.mjs
var Ni = Object.prototype.hasOwnProperty;
function _i(e, t, r) {
  for (r of e.keys())
    if (ze(r, t)) return r;
}
a(_i, "find");
function ze(e, t) {
  var r, o, n;
  if (e === t) return !0;
  if (e && t && (r = e.constructor) === t.constructor) {
    if (r === Date) return e.getTime() === t.getTime();
    if (r === RegExp) return e.toString() === t.toString();
    if (r === Array) {
      if ((o = e.length) === t.length)
        for (; o-- && ze(e[o], t[o]); ) ;
      return o === -1;
    }
    if (r === Set) {
      if (e.size !== t.size)
        return !1;
      for (o of e)
        if (n = o, n && typeof n == "object" && (n = _i(t, n), !n) || !t.has(n)) return !1;
      return !0;
    }
    if (r === Map) {
      if (e.size !== t.size)
        return !1;
      for (o of e)
        if (n = o[0], n && typeof n == "object" && (n = _i(t, n), !n) || !ze(o[1], t.get(n)))
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
        if (Ni.call(e, r) && ++o && !Ni.call(t, r) || !(r in t) || !ze(e[r], t[r])) return !1;
      return Object.keys(t).length === o;
    }
  }
  return e !== e && t !== t;
}
a(ze, "dequal");

// src/controls/manager.tsx
import { addons as Na, experimental_requestResponse as bp, types as J0 } from "storybook/manager-api";
import { color as _a } from "storybook/theming";

// src/controls/components/ControlsPanel.tsx
import Oa, { useEffect as N0, useMemo as _0, useState as D0 } from "react";
import { global as M0 } from "@storybook/global";
import {
  useArgTypes as B0,
  useArgs as F0,
  useGlobals as R0,
  useParameter as j0,
  useStorybookState as H0
} from "storybook/manager-api";
import { styled as $0 } from "storybook/theming";

// ../addons/docs/src/blocks/components/ArgsTable/ArgsTable.tsx
or();
import V from "react";
import { once as l0 } from "storybook/internal/client-logger";
import { IconButton as c0, Link as p0, ResetWrapper as u0 } from "storybook/internal/components";
import { includeConditionalArg as d0 } from "storybook/internal/csf";
import { DocumentIcon as f0, UndoIcon as m0 } from "@storybook/icons";

// ../node_modules/@babel/runtime/helpers/esm/extends.js
function he() {
  return he = Object.assign ? Object.assign.bind() : function(e) {
    for (var t = 1; t < arguments.length; t++) {
      var r = arguments[t];
      for (var o in r) ({}).hasOwnProperty.call(r, o) && (e[o] = r[o]);
    }
    return e;
  }, he.apply(null, arguments);
}
a(he, "_extends");

// ../node_modules/@babel/runtime/helpers/esm/assertThisInitialized.js
function Bs(e) {
  if (e === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  return e;
}
a(Bs, "_assertThisInitialized");

// ../node_modules/@babel/runtime/helpers/esm/setPrototypeOf.js
function ot(e, t) {
  return ot = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(r, o) {
    return r.__proto__ = o, r;
  }, ot(e, t);
}
a(ot, "_setPrototypeOf");

// ../node_modules/@babel/runtime/helpers/esm/inheritsLoose.js
function Fs(e, t) {
  e.prototype = Object.create(t.prototype), e.prototype.constructor = e, ot(e, t);
}
a(Fs, "_inheritsLoose");

// ../node_modules/@babel/runtime/helpers/esm/getPrototypeOf.js
function Gr(e) {
  return Gr = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(t) {
    return t.__proto__ || Object.getPrototypeOf(t);
  }, Gr(e);
}
a(Gr, "_getPrototypeOf");

// ../node_modules/@babel/runtime/helpers/esm/isNativeFunction.js
function Rs(e) {
  try {
    return Function.toString.call(e).indexOf("[native code]") !== -1;
  } catch {
    return typeof e == "function";
  }
}
a(Rs, "_isNativeFunction");

// ../node_modules/@babel/runtime/helpers/esm/isNativeReflectConstruct.js
function vn() {
  try {
    var e = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
  } catch {
  }
  return (vn = /* @__PURE__ */ a(function() {
    return !!e;
  }, "_isNativeReflectConstruct"))();
}
a(vn, "_isNativeReflectConstruct");

// ../node_modules/@babel/runtime/helpers/esm/construct.js
function js(e, t, r) {
  if (vn()) return Reflect.construct.apply(null, arguments);
  var o = [null];
  o.push.apply(o, t);
  var n = new (e.bind.apply(e, o))();
  return r && ot(n, r.prototype), n;
}
a(js, "_construct");

// ../node_modules/@babel/runtime/helpers/esm/wrapNativeSuper.js
function Jr(e) {
  var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
  return Jr = /* @__PURE__ */ a(function(o) {
    if (o === null || !Rs(o)) return o;
    if (typeof o != "function") throw new TypeError("Super expression must either be null or a function");
    if (t !== void 0) {
      if (t.has(o)) return t.get(o);
      t.set(o, n);
    }
    function n() {
      return js(o, arguments, Gr(this).constructor);
    }
    return a(n, "Wrapper"), n.prototype = Object.create(o.prototype, {
      constructor: {
        value: n,
        enumerable: !1,
        writable: !0,
        configurable: !0
      }
    }), ot(n, o);
  }, "_wrapNativeSuper"), Jr(e);
}
a(Jr, "_wrapNativeSuper");

// ../node_modules/polished/dist/polished.esm.js
var xf = {
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
function vf() {
  for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++)
    t[r] = arguments[r];
  var o = t[0], n = [], i;
  for (i = 1; i < t.length; i += 1)
    n.push(t[i]);
  return n.forEach(function(s) {
    o = o.replace(/%[a-z]/, s);
  }), o;
}
a(vf, "format");
var Se = /* @__PURE__ */ function(e) {
  Fs(t, e);
  function t(r) {
    for (var o, n = arguments.length, i = new Array(n > 1 ? n - 1 : 0), s = 1; s < n; s++)
      i[s - 1] = arguments[s];
    return o = e.call(this, vf.apply(void 0, [xf[r]].concat(i))) || this, Bs(o);
  }
  return a(t, "PolishedError"), t;
}(/* @__PURE__ */ Jr(Error));
function Hs(e, t) {
  return e.substr(-t.length) === t;
}
a(Hs, "endsWith");
var Ef = /^([+-]?(?:\d+|\d*\.\d+))([a-z]*|%)$/;
function $s(e) {
  if (typeof e != "string") return e;
  var t = e.match(Ef);
  return t ? parseFloat(e) : e;
}
a($s, "stripUnit");
var Sf = /* @__PURE__ */ a(function(t) {
  return function(r, o) {
    o === void 0 && (o = "16px");
    var n = r, i = o;
    if (typeof r == "string") {
      if (!Hs(r, "px"))
        throw new Se(69, t, r);
      n = $s(r);
    }
    if (typeof o == "string") {
      if (!Hs(o, "px"))
        throw new Se(70, t, o);
      i = $s(o);
    }
    if (typeof n == "string")
      throw new Se(71, r, t);
    if (typeof i == "string")
      throw new Se(72, o, t);
    return "" + n / i + t;
  };
}, "pxtoFactory"), zs = Sf, QT = zs("em");
var eA = zs("rem");
function En(e) {
  return Math.round(e * 255);
}
a(En, "colorToInt");
function Cf(e, t, r) {
  return En(e) + "," + En(t) + "," + En(r);
}
a(Cf, "convertToInt");
function nr(e, t, r, o) {
  if (o === void 0 && (o = Cf), t === 0)
    return o(r, r, r);
  var n = (e % 360 + 360) % 360 / 60, i = (1 - Math.abs(2 * r - 1)) * t, s = i * (1 - Math.abs(n % 2 - 1)), l = 0, c = 0, u = 0;
  n >= 0 && n < 1 ? (l = i, c = s) : n >= 1 && n < 2 ? (l = s, c = i) : n >= 2 && n < 3 ? (c = i, u = s) : n >= 3 && n < 4 ? (c = s, u = i) :
  n >= 4 && n < 5 ? (l = s, u = i) : n >= 5 && n < 6 && (l = i, u = s);
  var d = r - i / 2, g = l + d, p = c + d, m = u + d;
  return o(g, p, m);
}
a(nr, "hslToRgb");
var Vs = {
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
function wf(e) {
  if (typeof e != "string") return e;
  var t = e.toLowerCase();
  return Vs[t] ? "#" + Vs[t] : e;
}
a(wf, "nameToHex");
var Tf = /^#[a-fA-F0-9]{6}$/, Af = /^#[a-fA-F0-9]{8}$/, kf = /^#[a-fA-F0-9]{3}$/, Of = /^#[a-fA-F0-9]{4}$/, Sn = /^rgb\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*\)$/i,
If = /^rgb(?:a)?\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i, Pf = /^hsl\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*\)$/i,
Lf = /^hsl(?:a)?\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i;
function Ft(e) {
  if (typeof e != "string")
    throw new Se(3);
  var t = wf(e);
  if (t.match(Tf))
    return {
      red: parseInt("" + t[1] + t[2], 16),
      green: parseInt("" + t[3] + t[4], 16),
      blue: parseInt("" + t[5] + t[6], 16)
    };
  if (t.match(Af)) {
    var r = parseFloat((parseInt("" + t[7] + t[8], 16) / 255).toFixed(2));
    return {
      red: parseInt("" + t[1] + t[2], 16),
      green: parseInt("" + t[3] + t[4], 16),
      blue: parseInt("" + t[5] + t[6], 16),
      alpha: r
    };
  }
  if (t.match(kf))
    return {
      red: parseInt("" + t[1] + t[1], 16),
      green: parseInt("" + t[2] + t[2], 16),
      blue: parseInt("" + t[3] + t[3], 16)
    };
  if (t.match(Of)) {
    var o = parseFloat((parseInt("" + t[4] + t[4], 16) / 255).toFixed(2));
    return {
      red: parseInt("" + t[1] + t[1], 16),
      green: parseInt("" + t[2] + t[2], 16),
      blue: parseInt("" + t[3] + t[3], 16),
      alpha: o
    };
  }
  var n = Sn.exec(t);
  if (n)
    return {
      red: parseInt("" + n[1], 10),
      green: parseInt("" + n[2], 10),
      blue: parseInt("" + n[3], 10)
    };
  var i = If.exec(t.substring(0, 50));
  if (i)
    return {
      red: parseInt("" + i[1], 10),
      green: parseInt("" + i[2], 10),
      blue: parseInt("" + i[3], 10),
      alpha: parseFloat("" + i[4]) > 1 ? parseFloat("" + i[4]) / 100 : parseFloat("" + i[4])
    };
  var s = Pf.exec(t);
  if (s) {
    var l = parseInt("" + s[1], 10), c = parseInt("" + s[2], 10) / 100, u = parseInt("" + s[3], 10) / 100, d = "rgb(" + nr(l, c, u) + ")", g = Sn.
    exec(d);
    if (!g)
      throw new Se(4, t, d);
    return {
      red: parseInt("" + g[1], 10),
      green: parseInt("" + g[2], 10),
      blue: parseInt("" + g[3], 10)
    };
  }
  var p = Lf.exec(t.substring(0, 50));
  if (p) {
    var m = parseInt("" + p[1], 10), f = parseInt("" + p[2], 10) / 100, y = parseInt("" + p[3], 10) / 100, h = "rgb(" + nr(m, f, y) + ")", b = Sn.
    exec(h);
    if (!b)
      throw new Se(4, t, h);
    return {
      red: parseInt("" + b[1], 10),
      green: parseInt("" + b[2], 10),
      blue: parseInt("" + b[3], 10),
      alpha: parseFloat("" + p[4]) > 1 ? parseFloat("" + p[4]) / 100 : parseFloat("" + p[4])
    };
  }
  throw new Se(5);
}
a(Ft, "parseToRgb");
function Nf(e) {
  var t = e.red / 255, r = e.green / 255, o = e.blue / 255, n = Math.max(t, r, o), i = Math.min(t, r, o), s = (n + i) / 2;
  if (n === i)
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
  var l, c = n - i, u = s > 0.5 ? c / (2 - n - i) : c / (n + i);
  switch (n) {
    case t:
      l = (r - o) / c + (r < o ? 6 : 0);
      break;
    case r:
      l = (o - t) / c + 2;
      break;
    default:
      l = (t - r) / c + 4;
      break;
  }
  return l *= 60, e.alpha !== void 0 ? {
    hue: l,
    saturation: u,
    lightness: s,
    alpha: e.alpha
  } : {
    hue: l,
    saturation: u,
    lightness: s
  };
}
a(Nf, "rgbToHsl");
function nt(e) {
  return Nf(Ft(e));
}
a(nt, "parseToHsl");
var _f = /* @__PURE__ */ a(function(t) {
  return t.length === 7 && t[1] === t[2] && t[3] === t[4] && t[5] === t[6] ? "#" + t[1] + t[3] + t[5] : t;
}, "reduceHexValue"), wn = _f;
function Ct(e) {
  var t = e.toString(16);
  return t.length === 1 ? "0" + t : t;
}
a(Ct, "numberToHex");
function Cn(e) {
  return Ct(Math.round(e * 255));
}
a(Cn, "colorToHex");
function Df(e, t, r) {
  return wn("#" + Cn(e) + Cn(t) + Cn(r));
}
a(Df, "convertToHex");
function Kr(e, t, r) {
  return nr(e, t, r, Df);
}
a(Kr, "hslToHex");
function Mf(e, t, r) {
  if (typeof e == "number" && typeof t == "number" && typeof r == "number")
    return Kr(e, t, r);
  if (typeof e == "object" && t === void 0 && r === void 0)
    return Kr(e.hue, e.saturation, e.lightness);
  throw new Se(1);
}
a(Mf, "hsl");
function Bf(e, t, r, o) {
  if (typeof e == "number" && typeof t == "number" && typeof r == "number" && typeof o == "number")
    return o >= 1 ? Kr(e, t, r) : "rgba(" + nr(e, t, r) + "," + o + ")";
  if (typeof e == "object" && t === void 0 && r === void 0 && o === void 0)
    return e.alpha >= 1 ? Kr(e.hue, e.saturation, e.lightness) : "rgba(" + nr(e.hue, e.saturation, e.lightness) + "," + e.alpha + ")";
  throw new Se(2);
}
a(Bf, "hsla");
function Tn(e, t, r) {
  if (typeof e == "number" && typeof t == "number" && typeof r == "number")
    return wn("#" + Ct(e) + Ct(t) + Ct(r));
  if (typeof e == "object" && t === void 0 && r === void 0)
    return wn("#" + Ct(e.red) + Ct(e.green) + Ct(e.blue));
  throw new Se(6);
}
a(Tn, "rgb");
function Be(e, t, r, o) {
  if (typeof e == "string" && typeof t == "number") {
    var n = Ft(e);
    return "rgba(" + n.red + "," + n.green + "," + n.blue + "," + t + ")";
  } else {
    if (typeof e == "number" && typeof t == "number" && typeof r == "number" && typeof o == "number")
      return o >= 1 ? Tn(e, t, r) : "rgba(" + e + "," + t + "," + r + "," + o + ")";
    if (typeof e == "object" && t === void 0 && r === void 0 && o === void 0)
      return e.alpha >= 1 ? Tn(e.red, e.green, e.blue) : "rgba(" + e.red + "," + e.green + "," + e.blue + "," + e.alpha + ")";
  }
  throw new Se(7);
}
a(Be, "rgba");
var Ff = /* @__PURE__ */ a(function(t) {
  return typeof t.red == "number" && typeof t.green == "number" && typeof t.blue == "number" && (typeof t.alpha != "number" || typeof t.alpha >
  "u");
}, "isRgb"), Rf = /* @__PURE__ */ a(function(t) {
  return typeof t.red == "number" && typeof t.green == "number" && typeof t.blue == "number" && typeof t.alpha == "number";
}, "isRgba"), jf = /* @__PURE__ */ a(function(t) {
  return typeof t.hue == "number" && typeof t.saturation == "number" && typeof t.lightness == "number" && (typeof t.alpha != "number" || typeof t.
  alpha > "u");
}, "isHsl"), Hf = /* @__PURE__ */ a(function(t) {
  return typeof t.hue == "number" && typeof t.saturation == "number" && typeof t.lightness == "number" && typeof t.alpha == "number";
}, "isHsla");
function at(e) {
  if (typeof e != "object") throw new Se(8);
  if (Rf(e)) return Be(e);
  if (Ff(e)) return Tn(e);
  if (Hf(e)) return Bf(e);
  if (jf(e)) return Mf(e);
  throw new Se(8);
}
a(at, "toColorString");
function Us(e, t, r) {
  return /* @__PURE__ */ a(function() {
    var n = r.concat(Array.prototype.slice.call(arguments));
    return n.length >= t ? e.apply(this, n) : Us(e, t, n);
  }, "fn");
}
a(Us, "curried");
function ke(e) {
  return Us(e, e.length, []);
}
a(ke, "curry");
function $f(e, t) {
  if (t === "transparent") return t;
  var r = nt(t);
  return at(he({}, r, {
    hue: r.hue + parseFloat(e)
  }));
}
a($f, "adjustHue");
var tA = ke($f);
function Rt(e, t, r) {
  return Math.max(e, Math.min(t, r));
}
a(Rt, "guard");
function Vf(e, t) {
  if (t === "transparent") return t;
  var r = nt(t);
  return at(he({}, r, {
    lightness: Rt(0, 1, r.lightness - parseFloat(e))
  }));
}
a(Vf, "darken");
var zf = ke(Vf), Le = zf;
function Uf(e, t) {
  if (t === "transparent") return t;
  var r = nt(t);
  return at(he({}, r, {
    saturation: Rt(0, 1, r.saturation - parseFloat(e))
  }));
}
a(Uf, "desaturate");
var rA = ke(Uf);
function qf(e, t) {
  if (t === "transparent") return t;
  var r = nt(t);
  return at(he({}, r, {
    lightness: Rt(0, 1, r.lightness + parseFloat(e))
  }));
}
a(qf, "lighten");
var Wf = ke(qf), Ke = Wf;
function Gf(e, t, r) {
  if (t === "transparent") return r;
  if (r === "transparent") return t;
  if (e === 0) return r;
  var o = Ft(t), n = he({}, o, {
    alpha: typeof o.alpha == "number" ? o.alpha : 1
  }), i = Ft(r), s = he({}, i, {
    alpha: typeof i.alpha == "number" ? i.alpha : 1
  }), l = n.alpha - s.alpha, c = parseFloat(e) * 2 - 1, u = c * l === -1 ? c : c + l, d = 1 + c * l, g = (u / d + 1) / 2, p = 1 - g, m = {
    red: Math.floor(n.red * g + s.red * p),
    green: Math.floor(n.green * g + s.green * p),
    blue: Math.floor(n.blue * g + s.blue * p),
    alpha: n.alpha * parseFloat(e) + s.alpha * (1 - parseFloat(e))
  };
  return Be(m);
}
a(Gf, "mix");
var Jf = ke(Gf), qs = Jf;
function Kf(e, t) {
  if (t === "transparent") return t;
  var r = Ft(t), o = typeof r.alpha == "number" ? r.alpha : 1, n = he({}, r, {
    alpha: Rt(0, 1, (o * 100 + parseFloat(e) * 100) / 100)
  });
  return Be(n);
}
a(Kf, "opacify");
var Yf = ke(Kf), wt = Yf;
function Xf(e, t) {
  if (t === "transparent") return t;
  var r = nt(t);
  return at(he({}, r, {
    saturation: Rt(0, 1, r.saturation + parseFloat(e))
  }));
}
a(Xf, "saturate");
var oA = ke(Xf);
function Zf(e, t) {
  return t === "transparent" ? t : at(he({}, nt(t), {
    hue: parseFloat(e)
  }));
}
a(Zf, "setHue");
var nA = ke(Zf);
function Qf(e, t) {
  return t === "transparent" ? t : at(he({}, nt(t), {
    lightness: parseFloat(e)
  }));
}
a(Qf, "setLightness");
var aA = ke(Qf);
function em(e, t) {
  return t === "transparent" ? t : at(he({}, nt(t), {
    saturation: parseFloat(e)
  }));
}
a(em, "setSaturation");
var iA = ke(em);
function tm(e, t) {
  return t === "transparent" ? t : qs(parseFloat(e), "rgb(0, 0, 0)", t);
}
a(tm, "shade");
var sA = ke(tm);
function rm(e, t) {
  return t === "transparent" ? t : qs(parseFloat(e), "rgb(255, 255, 255)", t);
}
a(rm, "tint");
var lA = ke(rm);
function om(e, t) {
  if (t === "transparent") return t;
  var r = Ft(t), o = typeof r.alpha == "number" ? r.alpha : 1, n = he({}, r, {
    alpha: Rt(0, 1, +(o * 100 - parseFloat(e) * 100).toFixed(2) / 100)
  });
  return Be(n);
}
a(om, "transparentize");
var nm = ke(om), B = nm;

// ../addons/docs/src/blocks/components/ArgsTable/ArgsTable.tsx
import { styled as Ca } from "storybook/theming";

// ../addons/docs/src/blocks/components/Source.tsx
import Ye from "react";
import { SyntaxHighlighter as cm } from "storybook/internal/components";
import {
  ThemeProvider as pm,
  convert as um,
  ignoreSsrWarning as dm,
  styled as An,
  themes as Ws,
  useTheme as fm
} from "storybook/theming";

// ../addons/docs/src/blocks/components/EmptyBlock.tsx
import am from "react";
import { withReset as im } from "storybook/internal/components";
import { styled as sm } from "storybook/theming";
var lm = sm.div(im, ({ theme: e }) => ({
  backgroundColor: e.base === "light" ? "rgba(0,0,0,.01)" : "rgba(255,255,255,.01)",
  borderRadius: e.appBorderRadius,
  border: `1px dashed ${e.appBorderColor}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  margin: "25px 0 40px",
  color: B(0.3, e.color.defaultText),
  fontSize: e.typography.size.s2
})), Yr = /* @__PURE__ */ a((e) => /* @__PURE__ */ am.createElement(lm, { ...e, className: "docblock-emptyblock sb-unstyled" }), "EmptyBlock");

// ../addons/docs/src/blocks/components/Source.tsx
var mm = An(
  cm
)(({ theme: e }) => ({
  // DocBlocks-specific styling and overrides
  fontSize: `${e.typography.size.s2 - 1}px`,
  lineHeight: "19px",
  margin: "25px 0 40px",
  borderRadius: e.appBorderRadius,
  boxShadow: e.base === "light" ? "rgba(0, 0, 0, 0.10) 0 1px 3px 0" : "rgba(0, 0, 0, 0.20) 0 2px 5px 0",
  "pre.prismjs": {
    padding: 20,
    background: "inherit"
  }
}));
var gm = An.div(({ theme: e }) => ({
  background: e.background.content,
  borderRadius: e.appBorderRadius,
  border: `1px solid ${e.appBorderColor}`,
  boxShadow: e.base === "light" ? "rgba(0, 0, 0, 0.10) 0 1px 3px 0" : "rgba(0, 0, 0, 0.20) 0 2px 5px 0",
  margin: "25px 0 40px",
  padding: "20px 20px 20px 22px"
})), Xr = An.div(({ theme: e }) => ({
  animation: `${e.animation.glow} 1.5s ease-in-out infinite`,
  background: e.appBorderColor,
  height: 17,
  marginTop: 1,
  width: "60%",
  [`&:first-child${dm}`]: {
    margin: 0
  }
})), hm = /* @__PURE__ */ a(() => /* @__PURE__ */ Ye.createElement(gm, null, /* @__PURE__ */ Ye.createElement(Xr, null), /* @__PURE__ */ Ye.
createElement(Xr, { style: { width: "80%" } }), /* @__PURE__ */ Ye.createElement(Xr, { style: { width: "30%" } }), /* @__PURE__ */ Ye.createElement(
Xr, { style: { width: "80%" } })), "SourceSkeleton"), Gs = /* @__PURE__ */ a(({
  isLoading: e,
  error: t,
  language: r,
  code: o,
  dark: n,
  format: i = !0,
  ...s
}) => {
  let { typography: l } = fm();
  if (e)
    return /* @__PURE__ */ Ye.createElement(hm, null);
  if (t)
    return /* @__PURE__ */ Ye.createElement(Yr, null, t);
  let c = /* @__PURE__ */ Ye.createElement(
    mm,
    {
      bordered: !0,
      copyable: !0,
      format: i,
      language: r ?? "jsx",
      className: "docblock-source sb-unstyled",
      ...s
    },
    o
  );
  if (typeof n > "u")
    return c;
  let u = n ? Ws.dark : Ws.light;
  return /* @__PURE__ */ Ye.createElement(
    pm,
    {
      theme: um({
        ...u,
        fontCode: l.fonts.mono,
        fontBase: l.fonts.base
      })
    },
    c
  );
}, "Source");

// ../addons/docs/src/blocks/components/DocsPage.tsx
import wA from "react";
import { withReset as Js } from "storybook/internal/components";
import { styled as Zr } from "storybook/theming";
var te = /* @__PURE__ */ a((e) => `& :where(${e}:not(.sb-anchor, .sb-unstyled, .sb-unstyled ${e}))`, "toGlobalSelector"), kn = 600, OA = Zr.
h1(Js, ({ theme: e }) => ({
  color: e.color.defaultText,
  fontSize: e.typography.size.m3,
  fontWeight: e.typography.weight.bold,
  lineHeight: "32px",
  [`@media (min-width: ${kn}px)`]: {
    fontSize: e.typography.size.l1,
    lineHeight: "36px",
    marginBottom: "16px"
  }
})), IA = Zr.h2(Js, ({ theme: e }) => ({
  fontWeight: e.typography.weight.regular,
  fontSize: e.typography.size.s3,
  lineHeight: "20px",
  borderBottom: "none",
  marginBottom: 15,
  [`@media (min-width: ${kn}px)`]: {
    fontSize: e.typography.size.m1,
    lineHeight: "28px",
    marginBottom: 24
  },
  color: B(0.25, e.color.defaultText)
})), PA = Zr.div(({ theme: e }) => {
  let t = {
    fontFamily: e.typography.fonts.base,
    fontSize: e.typography.size.s3,
    margin: 0,
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
    WebkitTapHighlightColor: "rgba(0, 0, 0, 0)",
    WebkitOverflowScrolling: "touch"
  }, r = {
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
    "& code": {
      fontSize: "inherit"
    }
  }, o = {
    lineHeight: 1,
    margin: "0 2px",
    padding: "3px 5px",
    whiteSpace: "nowrap",
    borderRadius: 3,
    fontSize: e.typography.size.s2 - 1,
    border: e.base === "light" ? `1px solid ${e.color.mediumlight}` : `1px solid ${e.color.darker}`,
    color: e.base === "light" ? B(0.1, e.color.defaultText) : B(0.3, e.color.defaultText),
    backgroundColor: e.base === "light" ? e.color.lighter : e.color.border
  };
  return {
    maxWidth: 1e3,
    width: "100%",
    minWidth: 0,
    [te("a")]: {
      ...t,
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
    },
    [te("blockquote")]: {
      ...t,
      margin: "16px 0",
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
    [te("div")]: t,
    [te("dl")]: {
      ...t,
      margin: "16px 0",
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
    },
    [te("h1")]: {
      ...t,
      ...r,
      fontSize: `${e.typography.size.l1}px`,
      fontWeight: e.typography.weight.bold
    },
    [te("h2")]: {
      ...t,
      ...r,
      fontSize: `${e.typography.size.m2}px`,
      paddingBottom: 4,
      borderBottom: `1px solid ${e.appBorderColor}`
    },
    [te("h3")]: {
      ...t,
      ...r,
      fontSize: `${e.typography.size.m1}px`,
      fontWeight: e.typography.weight.bold
    },
    [te("h4")]: {
      ...t,
      ...r,
      fontSize: `${e.typography.size.s3}px`
    },
    [te("h5")]: {
      ...t,
      ...r,
      fontSize: `${e.typography.size.s2}px`
    },
    [te("h6")]: {
      ...t,
      ...r,
      fontSize: `${e.typography.size.s2}px`,
      color: e.color.dark
    },
    [te("hr")]: {
      border: "0 none",
      borderTop: `1px solid ${e.appBorderColor}`,
      height: 4,
      padding: 0
    },
    [te("img")]: {
      maxWidth: "100%"
    },
    [te("li")]: {
      ...t,
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
      "& code": o
    },
    [te("ol")]: {
      ...t,
      margin: "16px 0",
      paddingLeft: 30,
      "& :first-of-type": {
        marginTop: 0
      },
      "& :last-child": {
        marginBottom: 0
      }
    },
    [te("p")]: {
      ...t,
      margin: "16px 0",
      fontSize: e.typography.size.s2,
      lineHeight: "24px",
      color: e.color.defaultText,
      "& code": o
    },
    [te("pre")]: {
      ...t,
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
    },
    [te("span")]: {
      ...t,
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
    },
    [te("table")]: {
      ...t,
      margin: "16px 0",
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
    },
    [te("ul")]: {
      ...t,
      margin: "16px 0",
      paddingLeft: 30,
      "& :first-of-type": {
        marginTop: 0
      },
      "& :last-child": {
        marginBottom: 0
      },
      listStyle: "disc"
    }
  };
}), LA = Zr.div(({ theme: e }) => ({
  background: e.background.content,
  display: "flex",
  flexDirection: "row-reverse",
  justifyContent: "center",
  padding: "4rem 20px",
  minHeight: "100vh",
  boxSizing: "border-box",
  gap: "3rem",
  [`@media (min-width: ${kn}px)`]: {}
}));

// ../addons/docs/src/blocks/components/Preview.tsx
import Re, { Children as Am, useCallback as km, useState as Ln } from "react";
import { ActionBar as Om, Zoom as Im } from "storybook/internal/components";
import { styled as jt } from "storybook/theming";

// ../addons/docs/src/blocks/components/BlockBackgroundStyles.tsx
var it = /* @__PURE__ */ a((e) => ({
  borderRadius: e.appBorderRadius,
  background: e.background.content,
  boxShadow: e.base === "light" ? "rgba(0, 0, 0, 0.10) 0 1px 3px 0" : "rgba(0, 0, 0, 0.20) 0 2px 5px 0",
  border: `1px solid ${e.appBorderColor}`
}), "getBlockBackgroundStyle");

// ../addons/docs/src/blocks/components/Story.tsx
import WA, { useEffect as GA, useRef as JA, useState as KA } from "react";
import { ErrorFormatter as XA, Loader as ZA, getStoryHref as QA } from "storybook/internal/components";
import { styled as bm } from "storybook/theming";

// ../addons/docs/src/blocks/components/IFrame.tsx
import FA, { Component as RA } from "react";
var { window: jA } = globalThis;

// ../addons/docs/src/blocks/components/ZoomContext.tsx
import { createContext as ym } from "react";
var On = ym({
  scale: 1
});

// ../addons/docs/src/blocks/components/Story.tsx
var { PREVIEW_URL: ok } = globalThis;
var nk = bm.strong(({ theme: e }) => ({
  color: e.color.orange
}));

// ../addons/docs/src/blocks/components/Toolbar.tsx
import Fe from "react";
import { FlexBar as xm, IconButton as In } from "storybook/internal/components";
import { ZoomIcon as vm, ZoomOutIcon as Em, ZoomResetIcon as Sm } from "@storybook/icons";
import { styled as Pn } from "storybook/theming";
var Cm = Pn(xm)({
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  transition: "transform .2s linear"
}), wm = Pn.div({
  display: "flex",
  alignItems: "center",
  gap: 4
}), Tm = Pn.div(({ theme: e }) => ({
  width: 14,
  height: 14,
  borderRadius: 2,
  margin: "0 7px",
  backgroundColor: e.appBorderColor,
  animation: `${e.animation.glow} 1.5s ease-in-out infinite`
})), Ks = /* @__PURE__ */ a(({
  isLoading: e,
  storyId: t,
  baseUrl: r,
  zoom: o,
  resetZoom: n,
  ...i
}) => /* @__PURE__ */ Fe.createElement(Cm, { ...i }, /* @__PURE__ */ Fe.createElement(wm, { key: "left" }, e ? [1, 2, 3].map((s) => /* @__PURE__ */ Fe.
createElement(Tm, { key: s })) : /* @__PURE__ */ Fe.createElement(Fe.Fragment, null, /* @__PURE__ */ Fe.createElement(
  In,
  {
    key: "zoomin",
    onClick: (s) => {
      s.preventDefault(), o(0.8);
    },
    title: "Zoom in"
  },
  /* @__PURE__ */ Fe.createElement(vm, null)
), /* @__PURE__ */ Fe.createElement(
  In,
  {
    key: "zoomout",
    onClick: (s) => {
      s.preventDefault(), o(1.25);
    },
    title: "Zoom out"
  },
  /* @__PURE__ */ Fe.createElement(Em, null)
), /* @__PURE__ */ Fe.createElement(
  In,
  {
    key: "zoomreset",
    onClick: (s) => {
      s.preventDefault(), n();
    },
    title: "Reset zoom"
  },
  /* @__PURE__ */ Fe.createElement(Sm, null)
)))), "Toolbar");

// ../addons/docs/src/blocks/components/Preview.tsx
var Pm = jt.div(
  ({ isColumn: e, columns: t, layout: r }) => ({
    display: e || !t ? "block" : "flex",
    position: "relative",
    flexWrap: "wrap",
    overflow: "auto",
    flexDirection: e ? "column" : "row",
    "& .innerZoomElementWrapper > *": e ? {
      width: r !== "fullscreen" ? "calc(100% - 20px)" : "100%",
      display: "block"
    } : {
      maxWidth: r !== "fullscreen" ? "calc(100% - 20px)" : "100%",
      display: "inline-block"
    }
  }),
  ({ layout: e = "padded", inline: t }) => e === "centered" || e === "padded" ? {
    padding: t ? "32px 22px" : "0px",
    "& .innerZoomElementWrapper > *": {
      width: "auto",
      border: "8px solid transparent!important"
    }
  } : {},
  ({ layout: e = "padded", inline: t }) => e === "centered" && t ? {
    display: "flex",
    justifyContent: "center",
    justifyItems: "center",
    alignContent: "center",
    alignItems: "center"
  } : {},
  ({ columns: e }) => e && e > 1 ? { ".innerZoomElementWrapper > *": { minWidth: `calc(100% / ${e} - 20px)` } } : {}
), Ys = jt(Gs)(({ theme: e }) => ({
  margin: 0,
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderBottomLeftRadius: e.appBorderRadius,
  borderBottomRightRadius: e.appBorderRadius,
  border: "none",
  background: e.base === "light" ? "rgba(0, 0, 0, 0.85)" : Le(0.05, e.background.content),
  color: e.color.lightest,
  button: {
    background: e.base === "light" ? "rgba(0, 0, 0, 0.85)" : Le(0.05, e.background.content)
  }
})), Lm = jt.div(
  ({ theme: e, withSource: t, isExpanded: r }) => ({
    position: "relative",
    overflow: "hidden",
    margin: "25px 0 40px",
    ...it(e),
    borderBottomLeftRadius: t && r && 0,
    borderBottomRightRadius: t && r && 0,
    borderBottomWidth: r && 0,
    "h3 + &": {
      marginTop: "16px"
    }
  }),
  ({ withToolbar: e }) => e && { paddingTop: 40 }
), Nm = /* @__PURE__ */ a((e, t, r) => {
  switch (!0) {
    case !!(e && e.error):
      return {
        source: null,
        actionItem: {
          title: "No code available",
          className: "docblock-code-toggle docblock-code-toggle--disabled",
          disabled: !0,
          onClick: /* @__PURE__ */ a(() => r(!1), "onClick")
        }
      };
    case t:
      return {
        source: /* @__PURE__ */ Re.createElement(Ys, { ...e, dark: !0 }),
        actionItem: {
          title: "Hide code",
          className: "docblock-code-toggle docblock-code-toggle--expanded",
          onClick: /* @__PURE__ */ a(() => r(!1), "onClick")
        }
      };
    default:
      return {
        source: /* @__PURE__ */ Re.createElement(Ys, { ...e, dark: !0 }),
        actionItem: {
          title: "Show code",
          className: "docblock-code-toggle",
          onClick: /* @__PURE__ */ a(() => r(!0), "onClick")
        }
      };
  }
}, "getSource");
function _m(e) {
  if (Am.count(e) === 1) {
    let t = e;
    if (t.props)
      return t.props.id;
  }
  return null;
}
a(_m, "getStoryId");
var Dm = jt(Ks)({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 40
}), Mm = jt.div({
  overflow: "hidden",
  position: "relative"
}), Bm = /* @__PURE__ */ a(({
  isLoading: e,
  isColumn: t,
  columns: r,
  children: o,
  withSource: n,
  withToolbar: i = !1,
  isExpanded: s = !1,
  additionalActions: l,
  className: c,
  layout: u = "padded",
  inline: d = !1,
  ...g
}) => {
  let [p, m] = Ln(s), { source: f, actionItem: y } = Nm(n, p, m), [h, b] = Ln(1), x = [c].concat(["sbdocs", "sbdocs-preview", "sb-unstyled"]),
  v = n ? [y] : [], [E, S] = Ln(
    l ? [...l] : []
  ), w = [...v, ...E], { window: P } = globalThis, N = km(async (H) => {
    let { createCopyToClipboardFunction: G } = await import("storybook/internal/components");
    G();
  }, []), q = /* @__PURE__ */ a((H) => {
    let G = P.getSelection();
    G && G.type === "Range" || (H.preventDefault(), E.filter((Z) => Z.title === "Copied").length === 0 && N(f?.props.code ?? "").then(() => {
      S([
        ...E,
        {
          title: "Copied",
          onClick: /* @__PURE__ */ a(() => {
          }, "onClick")
        }
      ]), P.setTimeout(
        () => S(
          E.filter((Z) => Z.title !== "Copied")
        ),
        1500
      );
    }));
  }, "onCopyCapture");
  return /* @__PURE__ */ Re.createElement(
    Lm,
    {
      withSource: n,
      withToolbar: i,
      ...g,
      className: x.join(" ")
    },
    i && /* @__PURE__ */ Re.createElement(
      Dm,
      {
        isLoading: e,
        border: !0,
        zoom: (H) => b(h * H),
        resetZoom: () => b(1),
        storyId: _m(o),
        baseUrl: "./iframe.html"
      }
    ),
    /* @__PURE__ */ Re.createElement(On.Provider, { value: { scale: h } }, /* @__PURE__ */ Re.createElement(Mm, { className: "docs-story", onCopyCapture: n &&
    q }, /* @__PURE__ */ Re.createElement(
      Pm,
      {
        isColumn: t || !Array.isArray(o),
        columns: r,
        layout: u,
        inline: d
      },
      /* @__PURE__ */ Re.createElement(Im.Element, { centered: u === "centered", scale: d ? h : 1 }, Array.isArray(o) ? o.map((H, G) => /* @__PURE__ */ Re.
      createElement("div", { key: G }, H)) : /* @__PURE__ */ Re.createElement("div", null, o))
    ), /* @__PURE__ */ Re.createElement(Om, { actionItems: w }))),
    n && p && f
  );
}, "Preview"), Ck = jt(Bm)(() => ({
  ".docs-story": {
    paddingTop: 32,
    paddingBottom: 40
  }
}));

// ../addons/docs/src/blocks/components/ArgsTable/TabbedArgsTable.tsx
import kk from "react";
import { TabsState as Ik } from "storybook/internal/components";

// ../addons/docs/src/blocks/components/Typeset.tsx
import Rk from "react";
import { withReset as Fm } from "storybook/internal/components";
import { styled as Qr } from "storybook/theming";
var zk = Qr.div(({ theme: e }) => ({
  marginRight: 30,
  fontSize: `${e.typography.size.s1}px`,
  color: e.base === "light" ? B(0.4, e.color.defaultText) : B(0.6, e.color.defaultText)
})), Uk = Qr.div({
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis"
}), qk = Qr.div({
  display: "flex",
  flexDirection: "row",
  alignItems: "baseline",
  "&:not(:last-child)": { marginBottom: "1rem" }
}), Wk = Qr.div(Fm, ({ theme: e }) => ({
  ...it(e),
  margin: "25px 0 40px",
  padding: "30px 20px"
}));

// ../addons/docs/src/blocks/components/ColorPalette.tsx
import Yk from "react";
import { ResetWrapper as Zk } from "storybook/internal/components";
import { styled as Ce } from "storybook/theming";
var r2 = Ce.div(({ theme: e }) => ({
  fontWeight: e.typography.weight.bold,
  color: e.color.defaultText
})), o2 = Ce.div(({ theme: e }) => ({
  color: e.base === "light" ? B(0.2, e.color.defaultText) : B(0.6, e.color.defaultText)
})), n2 = Ce.div({
  flex: "0 0 30%",
  lineHeight: "20px",
  marginTop: 5
}), a2 = Ce.div(({ theme: e }) => ({
  flex: 1,
  textAlign: "center",
  fontFamily: e.typography.fonts.mono,
  fontSize: e.typography.size.s1,
  lineHeight: 1,
  overflow: "hidden",
  color: e.base === "light" ? B(0.4, e.color.defaultText) : B(0.6, e.color.defaultText),
  "> div": {
    display: "inline-block",
    overflow: "hidden",
    maxWidth: "100%",
    textOverflow: "ellipsis"
  },
  span: {
    display: "block",
    marginTop: 2
  }
})), i2 = Ce.div({
  display: "flex",
  flexDirection: "row"
}), s2 = Ce.div(({ background: e }) => ({
  position: "relative",
  flex: 1,
  "&::before": {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: e,
    content: '""'
  }
})), l2 = Ce.div(({ theme: e }) => ({
  ...it(e),
  display: "flex",
  flexDirection: "row",
  height: 50,
  marginBottom: 5,
  overflow: "hidden",
  backgroundColor: "white",
  backgroundImage: "repeating-linear-gradient(-45deg, #ccc, #ccc 1px, #fff 1px, #fff 16px)",
  backgroundClip: "padding-box"
})), c2 = Ce.div({
  display: "flex",
  flexDirection: "column",
  flex: 1,
  position: "relative",
  marginBottom: 30
}), p2 = Ce.div({
  flex: 1,
  display: "flex",
  flexDirection: "row"
}), u2 = Ce.div({
  display: "flex",
  alignItems: "flex-start"
}), d2 = Ce.div({
  flex: "0 0 30%"
}), f2 = Ce.div({
  flex: 1
}), m2 = Ce.div(({ theme: e }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  paddingBottom: 20,
  fontWeight: e.typography.weight.bold,
  color: e.base === "light" ? B(0.4, e.color.defaultText) : B(0.6, e.color.defaultText)
})), g2 = Ce.div(({ theme: e }) => ({
  fontSize: e.typography.size.s2,
  lineHeight: "20px",
  display: "flex",
  flexDirection: "column"
}));

// ../addons/docs/src/blocks/components/IconGallery.tsx
import x2 from "react";
import { ResetWrapper as E2 } from "storybook/internal/components";
import { styled as eo } from "storybook/theming";
var w2 = eo.div(({ theme: e }) => ({
  fontFamily: e.typography.fonts.base,
  fontSize: e.typography.size.s1,
  color: e.color.defaultText,
  marginLeft: 10,
  lineHeight: 1.2,
  display: "-webkit-box",
  overflow: "hidden",
  wordBreak: "break-word",
  textOverflow: "ellipsis",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical"
})), T2 = eo.div(({ theme: e }) => ({
  ...it(e),
  overflow: "hidden",
  height: 40,
  width: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
  "> img, > svg": {
    width: 20,
    height: 20
  }
})), A2 = eo.div({
  display: "inline-flex",
  flexDirection: "row",
  alignItems: "center",
  width: "100%"
}), k2 = eo.div({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gridGap: "8px 16px",
  gridAutoFlow: "row dense",
  gridAutoRows: 50
});

// ../addons/docs/src/blocks/components/TableOfContents.tsx
import aO, { useEffect as iO, useId as sO } from "react";
import { NAVIGATE_URL as cO } from "storybook/internal/core-events";
import { styled as _n } from "storybook/theming";
var dO = _n.aside(() => ({
  width: "10rem",
  "@media (max-width: 768px)": {
    display: "none"
  }
})), fO = _n.nav(({ theme: e }) => ({
  position: "fixed",
  bottom: 0,
  top: 0,
  width: "10rem",
  paddingTop: "4rem",
  paddingBottom: "2rem",
  overflowY: "auto",
  fontFamily: e.typography.fonts.base,
  fontSize: e.typography.size.s2,
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
  WebkitTapHighlightColor: "rgba(0, 0, 0, 0)",
  WebkitOverflowScrolling: "touch",
  "& *": {
    boxSizing: "border-box"
  },
  "& > .toc-wrapper > .toc-list": {
    paddingLeft: 0,
    borderLeft: `solid 2px ${e.color.mediumlight}`,
    ".toc-list": {
      paddingLeft: 0,
      borderLeft: `solid 2px ${e.color.mediumlight}`,
      ".toc-list": {
        paddingLeft: 0,
        borderLeft: `solid 2px ${e.color.mediumlight}`
      }
    }
  },
  "& .toc-list-item": {
    position: "relative",
    listStyleType: "none",
    marginLeft: 20,
    paddingTop: 3,
    paddingBottom: 3
  },
  "& .toc-list-item::before": {
    content: '""',
    position: "absolute",
    height: "100%",
    top: 0,
    left: 0,
    transform: "translateX(calc(-2px - 20px))",
    borderLeft: `solid 2px ${e.color.mediumdark}`,
    opacity: 0,
    transition: "opacity 0.2s"
  },
  "& .toc-list-item.is-active-li::before": {
    opacity: 1
  },
  "& .toc-list-item > a": {
    color: e.color.defaultText,
    textDecoration: "none"
  },
  "& .toc-list-item.is-active-li > a": {
    fontWeight: 600,
    color: e.color.secondary,
    textDecoration: "none"
  }
})), mO = _n.p(({ theme: e }) => ({
  fontWeight: 600,
  fontSize: "0.875em",
  color: e.textColor,
  textTransform: "uppercase",
  marginBottom: 10
}));

// ../addons/docs/src/blocks/components/ArgsTable/ArgRow.tsx
import ie, { useState as Fb } from "react";
import { codeCommon as Rb } from "storybook/internal/components";

// ../node_modules/markdown-to-jsx/dist/index.modern.js
import * as ro from "react";
function Tt() {
  return Tt = Object.assign ? Object.assign.bind() : function(e) {
    for (var t = 1; t < arguments.length; t++) {
      var r = arguments[t];
      for (var o in r) Object.prototype.hasOwnProperty.call(r, o) && (e[o] = r[o]);
    }
    return e;
  }, Tt.apply(this, arguments);
}
a(Tt, "t");
var Rm = ["children", "options"], I = { blockQuote: "0", breakLine: "1", breakThematic: "2", codeBlock: "3", codeFenced: "4", codeInline: "5",
footnote: "6", footnoteReference: "7", gfmTask: "8", heading: "9", headingSetext: "10", htmlBlock: "11", htmlComment: "12", htmlSelfClosing: "\
13", image: "14", link: "15", linkAngleBraceStyleDetector: "16", linkBareUrlDetector: "17", linkMailtoDetector: "18", newlineCoalescer: "19",
orderedList: "20", paragraph: "21", ref: "22", refImage: "23", refLink: "24", table: "25", tableSeparator: "26", text: "27", textBolded: "28",
textEmphasized: "29", textEscaped: "30", textMarked: "31", textStrikethroughed: "32", unorderedList: "33" }, Xs;
(function(e) {
  e[e.MAX = 0] = "MAX", e[e.HIGH = 1] = "HIGH", e[e.MED = 2] = "MED", e[e.LOW = 3] = "LOW", e[e.MIN = 4] = "MIN";
})(Xs || (Xs = {}));
var Zs = ["allowFullScreen", "allowTransparency", "autoComplete", "autoFocus", "autoPlay", "cellPadding", "cellSpacing", "charSet", "classId",
"colSpan", "contentEditable", "contextMenu", "crossOrigin", "encType", "formAction", "formEncType", "formMethod", "formNoValidate", "formTar\
get", "frameBorder", "hrefLang", "inputMode", "keyParams", "keyType", "marginHeight", "marginWidth", "maxLength", "mediaGroup", "minLength",
"noValidate", "radioGroup", "readOnly", "rowSpan", "spellCheck", "srcDoc", "srcLang", "srcSet", "tabIndex", "useMap"].reduce((e, t) => (e[t.
toLowerCase()] = t, e), { class: "className", for: "htmlFor" }), Qs = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: "\xA0", quot: "\u201C" },
jm = ["style", "script"], Hm = ["src", "href", "data", "formAction", "srcDoc", "action"], $m = /([-A-Z0-9_:]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|(?:\{((?:\\.|{[^}]*?}|[^}])*)\})))?/gi,
Vm = /mailto:/i, zm = /\n{2,}$/, al = /^(\s*>[\s\S]*?)(?=\n\n|$)/, Um = /^ *> ?/gm, qm = /^(?:\[!([^\]]*)\]\n)?([\s\S]*)/, Wm = /^ {2,}\n/, Gm = /^(?:( *[-*_])){3,} *(?:\n *)+\n/,
il = /^(?: {1,3})?(`{3,}|~{3,}) *(\S+)? *([^\n]*?)?\n([\s\S]*?)(?:\1\n?|$)/, sl = /^(?: {4}[^\n]+\n*)+(?:\n *)+\n?/, Jm = /^(`+)((?:\\`|(?!\1)`|[^`])+)\1/,
Km = /^(?:\n *)*\n/, Ym = /\r\n?/g, Xm = /^\[\^([^\]]+)](:(.*)((\n+ {4,}.*)|(\n(?!\[\^).+))*)/, Zm = /^\[\^([^\]]+)]/, Qm = /\f/g, eg = /^---[ \t]*\n(.|\n)*\n---[ \t]*\n/,
tg = /^\s*?\[(x|\s)\]/, ll = /^ *(#{1,6}) *([^\n]+?)(?: +#*)?(?:\n *)*(?:\n|$)/, cl = /^ *(#{1,6}) +([^\n]+?)(?: +#*)?(?:\n *)*(?:\n|$)/, pl = /^([^\n]+)\n *(=|-){3,} *(?:\n *)+\n/,
Rn = /^ *(?!<[a-z][^ >/]* ?\/>)<([a-z][^ >/]*) ?((?:[^>]*[^/])?)>\n?(\s*(?:<\1[^>]*?>[\s\S]*?<\/\1>|(?!<\1\b)[\s\S])*?)<\/\1>(?!<\/\1>)\n*/i,
rg = /&([a-z0-9]+|#[0-9]{1,6}|#x[0-9a-fA-F]{1,6});/gi, ul = /^<!--[\s\S]*?(?:-->)/, og = /^(data|aria|x)-[a-z_][a-z\d_.-]*$/, jn = /^ *<([a-z][a-z0-9:]*)(?:\s+((?:<.*?>|[^>])*))?\/?>(?!<\/\1>)(\s*\n)?/i,
ng = /^\{.*\}$/, ag = /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/, ig = /^<([^ >]+@[^ >]+)>/, sg = /^<([^ >]+:\/[^ >]+)>/, lg = /-([a-z])?/gi, dl = /^(\|.*)\n(?: *(\|? *[-:]+ *\|[-| :]*)\n((?:.*\|.*\n)*))?\n?/,
cg = /^\[([^\]]*)\]:\s+<?([^\s>]+)>?\s*("([^"]*)")?/, pg = /^!\[([^\]]*)\] ?\[([^\]]*)\]/, ug = /^\[([^\]]*)\] ?\[([^\]]*)\]/, dg = /(\n|^[-*]\s|^#|^ {2,}|^-{2,}|^>\s)/,
fg = /\t/g, mg = /(^ *\||\| *$)/g, gg = /^ *:-+: *$/, hg = /^ *:-+ *$/, yg = /^ *-+: *$/, oo = "((?:\\[.*?\\][([].*?[)\\]]|<.*?>(?:.*?<.*?>)?|`\
.*?`|\\\\\\1|[\\s\\S])+?)", bg = new RegExp(`^([*_])\\1${oo}\\1\\1(?!\\1)`), xg = new RegExp(`^([*_])${oo}\\1(?!\\1)`), vg = new RegExp(`^(=\
=)${oo}\\1`), Eg = new RegExp(`^(~~)${oo}\\1`), Sg = /^\\([^0-9A-Za-z\s])/, el = /\\([^0-9A-Za-z\s])/g, Cg = /^([\s\S](?:(?!  |[0-9]\.)[^=*_~\-\n<`\\\[!])*)/,
wg = /^\n+/, Tg = /^([ \t]*)/, Ag = /\\([^\\])/g, kg = /(?:^|\n)( *)$/, Hn = "(?:\\d+\\.)", $n = "(?:[*+-])";
function fl(e) {
  return "( *)(" + (e === 1 ? Hn : $n) + ") +";
}
a(fl, "de");
var ml = fl(1), gl = fl(2);
function hl(e) {
  return new RegExp("^" + (e === 1 ? ml : gl));
}
a(hl, "fe");
var Og = hl(1), Ig = hl(2);
function yl(e) {
  return new RegExp("^" + (e === 1 ? ml : gl) + "[^\\n]*(?:\\n(?!\\1" + (e === 1 ? Hn : $n) + " )[^\\n]*)*(\\n|$)", "gm");
}
a(yl, "ge");
var Pg = yl(1), Lg = yl(2);
function bl(e) {
  let t = e === 1 ? Hn : $n;
  return new RegExp("^( *)(" + t + ") [\\s\\S]+?(?:\\n{2,}(?! )(?!\\1" + t + " (?!" + t + " ))\\n*|\\s*\\n*$)");
}
a(bl, "xe");
var xl = bl(1), vl = bl(2);
function tl(e, t) {
  let r = t === 1, o = r ? xl : vl, n = r ? Pg : Lg, i = r ? Og : Ig;
  return { match: Ht(function(s, l) {
    let c = kg.exec(l.prevCapture);
    return c && (l.list || !l.inline && !l.simple) ? o.exec(s = c[1] + s) : null;
  }), order: 1, parse(s, l, c) {
    let u = r ? +s[2] : void 0, d = s[0].replace(zm, `
`).match(n), g = !1;
    return { items: d.map(function(p, m) {
      let f = i.exec(p)[0].length, y = new RegExp("^ {1," + f + "}", "gm"), h = p.replace(y, "").replace(i, ""), b = m === d.length - 1, x = h.
      indexOf(`

`) !== -1 || b && g;
      g = x;
      let v = c.inline, E = c.list, S;
      c.list = !0, x ? (c.inline = !1, S = sr(h) + `

`) : (c.inline = !0, S = sr(h));
      let w = l(S, c);
      return c.inline = v, c.list = E, w;
    }), ordered: r, start: u };
  }, render: /* @__PURE__ */ a((s, l, c) => e(s.ordered ? "ol" : "ul", { key: c.key, start: s.type === I.orderedList ? s.start : void 0 }, s.
  items.map(function(u, d) {
    return e("li", { key: d }, l(u, c));
  })), "render") };
}
a(tl, "Ce");
var Ng = new RegExp(`^\\[((?:\\[[^\\]]*\\]|[^\\[\\]]|\\](?=[^\\[]*\\]))*)\\]\\(\\s*<?((?:\\([^)]*\\)|[^\\s\\\\]|\\\\.)*?)>?(?:\\s+['"]([\\s\\S]*?)['"])?\\s*\\)`),
_g = /^!\[(.*?)\]\( *((?:\([^)]*\)|[^() ])*) *"?([^)"]*)?"?\)/, El = [al, il, sl, ll, pl, cl, dl, xl, vl], Dg = [...El, /^[^\n]+(?:  \n|\n{2,})/,
Rn, ul, jn];
function sr(e) {
  let t = e.length;
  for (; t > 0 && e[t - 1] <= " "; ) t--;
  return e.slice(0, t);
}
a(sr, "ze");
function ar(e) {
  return e.replace(/[ÀÁÂÃÄÅàáâãäåæÆ]/g, "a").replace(/[çÇ]/g, "c").replace(/[ðÐ]/g, "d").replace(/[ÈÉÊËéèêë]/g, "e").
  replace(/[ÏïÎîÍíÌì]/g, "i").replace(/[Ññ]/g, "n").replace(/[øØœŒÕõÔôÓóÒò]/g, "o").replace(/[ÜüÛûÚúÙù]/g, "u").
  replace(/[ŸÿÝý]/g, "y").replace(/[^a-z0-9- ]/gi, "").replace(/ /gi, "-").toLowerCase();
}
a(ar, "Le");
function Mg(e) {
  return yg.test(e) ? "right" : gg.test(e) ? "center" : hg.test(e) ? "left" : null;
}
a(Mg, "Ae");
function rl(e, t, r, o) {
  let n = r.inTable;
  r.inTable = !0;
  let i = [[]], s = "";
  function l() {
    if (!s) return;
    let c = i[i.length - 1];
    c.push.apply(c, t(s, r)), s = "";
  }
  return a(l, "a"), e.trim().split(/(`[^`]*`|\\\||\|)/).filter(Boolean).forEach((c, u, d) => {
    c.trim() === "|" && (l(), o) ? u !== 0 && u !== d.length - 1 && i.push([]) : s += c;
  }), l(), r.inTable = n, i;
}
a(rl, "Oe");
function Bg(e, t, r) {
  r.inline = !0;
  let o = e[2] ? e[2].replace(mg, "").split("|").map(Mg) : [], n = e[3] ? function(s, l, c) {
    return s.trim().split(`
`).map(function(u) {
      return rl(u, l, c, !0);
    });
  }(e[3], t, r) : [], i = rl(e[1], t, r, !!n.length);
  return r.inline = !1, n.length ? { align: o, cells: n, header: i, type: I.table } : { children: i, type: I.paragraph };
}
a(Bg, "Te");
function ol(e, t) {
  return e.align[t] == null ? {} : { textAlign: e.align[t] };
}
a(ol, "Be");
function Ht(e) {
  return e.inline = 1, e;
}
a(Ht, "Me");
function st(e) {
  return Ht(function(t, r) {
    return r.inline ? e.exec(t) : null;
  });
}
a(st, "Re");
function lt(e) {
  return Ht(function(t, r) {
    return r.inline || r.simple ? e.exec(t) : null;
  });
}
a(lt, "Ie");
function Xe(e) {
  return function(t, r) {
    return r.inline || r.simple ? null : e.exec(t);
  };
}
a(Xe, "De");
function ir(e) {
  return Ht(function(t) {
    return e.exec(t);
  });
}
a(ir, "Ue");
function Fg(e, t) {
  if (t.inline || t.simple) return null;
  let r = "";
  e.split(`
`).every((n) => (n += `
`, !El.some((i) => i.test(n)) && (r += n, !!n.trim())));
  let o = sr(r);
  return o == "" ? null : [r, , o];
}
a(Fg, "Ne");
var Rg = /(javascript|vbscript|data(?!:image)):/i;
function jg(e) {
  try {
    let t = decodeURIComponent(e).replace(/[^A-Za-z0-9/:]/g, "");
    if (Rg.test(t)) return null;
  } catch {
    return null;
  }
  return e;
}
a(jg, "He");
function nl(e) {
  return e.replace(Ag, "$1");
}
a(nl, "Pe");
function to(e, t, r) {
  let o = r.inline || !1, n = r.simple || !1;
  r.inline = !0, r.simple = !0;
  let i = e(t, r);
  return r.inline = o, r.simple = n, i;
}
a(to, "_e");
function Hg(e, t, r) {
  let o = r.inline || !1, n = r.simple || !1;
  r.inline = !1, r.simple = !0;
  let i = e(t, r);
  return r.inline = o, r.simple = n, i;
}
a(Hg, "Fe");
function $g(e, t, r) {
  let o = r.inline || !1;
  r.inline = !1;
  let n = e(t, r);
  return r.inline = o, n;
}
a($g, "We");
var Dn = /* @__PURE__ */ a((e, t, r) => ({ children: to(t, e[2], r) }), "Ge");
function Mn() {
  return {};
}
a(Mn, "Ze");
function Bn() {
  return null;
}
a(Bn, "qe");
function Vg(...e) {
  return e.filter(Boolean).join(" ");
}
a(Vg, "Qe");
function Fn(e, t, r) {
  let o = e, n = t.split(".");
  for (; n.length && (o = o[n[0]], o !== void 0); ) n.shift();
  return o || r;
}
a(Fn, "Ve");
function zg(e = "", t = {}) {
  function r(p, m, ...f) {
    let y = Fn(t.overrides, `${p}.props`, {});
    return t.createElement(function(h, b) {
      let x = Fn(b, h);
      return x ? typeof x == "function" || typeof x == "object" && "render" in x ? x : Fn(b, `${h}.component`, h) : h;
    }(p, t.overrides), Tt({}, m, y, { className: Vg(m?.className, y.className) || void 0 }), ...f);
  }
  a(r, "u");
  function o(p) {
    p = p.replace(eg, "");
    let m = !1;
    t.forceInline ? m = !0 : t.forceBlock || (m = dg.test(p) === !1);
    let f = u(c(m ? p : `${sr(p).replace(wg, "")}

`, { inline: m }));
    for (; typeof f[f.length - 1] == "string" && !f[f.length - 1].trim(); ) f.pop();
    if (t.wrapper === null) return f;
    let y = t.wrapper || (m ? "span" : "div"), h;
    if (f.length > 1 || t.forceWrapper) h = f;
    else {
      if (f.length === 1) return h = f[0], typeof h == "string" ? r("span", { key: "outer" }, h) : h;
      h = null;
    }
    return t.createElement(y, { key: "outer" }, h);
  }
  a(o, "Z");
  function n(p, m) {
    let f = m.match($m);
    return f ? f.reduce(function(y, h) {
      let b = h.indexOf("=");
      if (b !== -1) {
        let x = function(w) {
          return w.indexOf("-") !== -1 && w.match(og) === null && (w = w.replace(lg, function(P, N) {
            return N.toUpperCase();
          })), w;
        }(h.slice(0, b)).trim(), v = function(w) {
          let P = w[0];
          return (P === '"' || P === "'") && w.length >= 2 && w[w.length - 1] === P ? w.slice(1, -1) : w;
        }(h.slice(b + 1).trim()), E = Zs[x] || x;
        if (E === "ref") return y;
        let S = y[E] = function(w, P, N, q) {
          return P === "style" ? function(H) {
            let G = [], Z = "", se = !1, ee = !1, pe = "";
            if (!H) return G;
            for (let j = 0; j < H.length; j++) {
              let T = H[j];
              if (T !== '"' && T !== "'" || se || (ee ? T === pe && (ee = !1, pe = "") : (ee = !0, pe = T)), T === "(" && Z.endsWith("url") ?
              se = !0 : T === ")" && se && (se = !1), T !== ";" || ee || se) Z += T;
              else {
                let L = Z.trim();
                if (L) {
                  let k = L.indexOf(":");
                  if (k > 0) {
                    let ne = L.slice(0, k).trim(), Ve = L.slice(k + 1).trim();
                    G.push([ne, Ve]);
                  }
                }
                Z = "";
              }
            }
            let _ = Z.trim();
            if (_) {
              let j = _.indexOf(":");
              if (j > 0) {
                let T = _.slice(0, j).trim(), L = _.slice(j + 1).trim();
                G.push([T, L]);
              }
            }
            return G;
          }(N).reduce(function(H, [G, Z]) {
            return H[G.replace(/(-[a-z])/g, (se) => se[1].toUpperCase())] = q(Z, w, G), H;
          }, {}) : Hm.indexOf(P) !== -1 ? q(N, w, P) : (N.match(ng) && (N = N.slice(1, N.length - 1)), N === "true" || N !== "false" && N);
        }(p, x, v, t.sanitizer);
        typeof S == "string" && (Rn.test(S) || jn.test(S)) && (y[E] = o(S.trim()));
      } else h !== "style" && (y[Zs[h] || h] = !0);
      return y;
    }, {}) : null;
  }
  a(n, "q"), t.overrides = t.overrides || {}, t.sanitizer = t.sanitizer || jg, t.slugify = t.slugify || ar, t.namedCodesToUnicode = t.namedCodesToUnicode ?
  Tt({}, Qs, t.namedCodesToUnicode) : Qs, t.createElement = t.createElement || ro.createElement;
  let i = [], s = {}, l = { [I.blockQuote]: { match: Xe(al), order: 1, parse(p, m, f) {
    let [, y, h] = p[0].replace(Um, "").match(qm);
    return { alert: y, children: m(h, f) };
  }, render(p, m, f) {
    let y = { key: f.key };
    return p.alert && (y.className = "markdown-alert-" + t.slugify(p.alert.toLowerCase(), ar), p.children.unshift({ attrs: {}, children: [{ type: I.
    text, text: p.alert }], noInnerParse: !0, type: I.htmlBlock, tag: "header" })), r("blockquote", y, m(p.children, f));
  } }, [I.breakLine]: { match: ir(Wm), order: 1, parse: Mn, render: /* @__PURE__ */ a((p, m, f) => r("br", { key: f.key }), "render") }, [I.
  breakThematic]: { match: Xe(Gm), order: 1, parse: Mn, render: /* @__PURE__ */ a((p, m, f) => r("hr", { key: f.key }), "render") }, [I.codeBlock]: {
  match: Xe(sl), order: 0, parse: /* @__PURE__ */ a((p) => ({ lang: void 0, text: sr(p[0].replace(/^ {4}/gm, "")).replace(el, "$1") }), "par\
se"), render: /* @__PURE__ */ a((p, m, f) => r("pre", { key: f.key }, r("code", Tt({}, p.attrs, { className: p.lang ? `lang-${p.lang}` : "" }),
  p.text)), "render") }, [I.codeFenced]: { match: Xe(il), order: 0, parse: /* @__PURE__ */ a((p) => ({ attrs: n("code", p[3] || ""), lang: p[2] ||
  void 0, text: p[4], type: I.codeBlock }), "parse") }, [I.codeInline]: { match: lt(Jm), order: 3, parse: /* @__PURE__ */ a((p) => ({ text: p[2].
  replace(el, "$1") }), "parse"), render: /* @__PURE__ */ a((p, m, f) => r("code", { key: f.key }, p.text), "render") }, [I.footnote]: { match: Xe(
  Xm), order: 0, parse: /* @__PURE__ */ a((p) => (i.push({ footnote: p[2], identifier: p[1] }), {}), "parse"), render: Bn }, [I.footnoteReference]: {
  match: st(Zm), order: 1, parse: /* @__PURE__ */ a((p) => ({ target: `#${t.slugify(p[1], ar)}`, text: p[1] }), "parse"), render: /* @__PURE__ */ a(
  (p, m, f) => r("a", { key: f.key, href: t.sanitizer(p.target, "a", "href") }, r("sup", { key: f.key }, p.text)), "render") }, [I.gfmTask]: {
  match: st(tg), order: 1, parse: /* @__PURE__ */ a((p) => ({ completed: p[1].toLowerCase() === "x" }), "parse"), render: /* @__PURE__ */ a(
  (p, m, f) => r("input", { checked: p.completed, key: f.key, readOnly: !0, type: "checkbox" }), "render") }, [I.heading]: { match: Xe(t.enforceAtxHeadings ?
  cl : ll), order: 1, parse: /* @__PURE__ */ a((p, m, f) => ({ children: to(m, p[2], f), id: t.slugify(p[2], ar), level: p[1].length }), "pa\
rse"), render: /* @__PURE__ */ a((p, m, f) => r(`h${p.level}`, { id: p.id, key: f.key }, m(p.children, f)), "render") }, [I.headingSetext]: {
  match: Xe(pl), order: 0, parse: /* @__PURE__ */ a((p, m, f) => ({ children: to(m, p[1], f), level: p[2] === "=" ? 1 : 2, type: I.heading }),
  "parse") }, [I.htmlBlock]: { match: ir(Rn), order: 1, parse(p, m, f) {
    let [, y] = p[3].match(Tg), h = new RegExp(`^${y}`, "gm"), b = p[3].replace(h, ""), x = (v = b, Dg.some((N) => N.test(v)) ? $g : to);
    var v;
    let E = p[1].toLowerCase(), S = jm.indexOf(E) !== -1, w = (S ? E : p[1]).trim(), P = { attrs: n(w, p[2]), noInnerParse: S, tag: w };
    return f.inAnchor = f.inAnchor || E === "a", S ? P.text = p[3] : P.children = x(m, b, f), f.inAnchor = !1, P;
  }, render: /* @__PURE__ */ a((p, m, f) => r(p.tag, Tt({ key: f.key }, p.attrs), p.text || (p.children ? m(p.children, f) : "")), "render") },
  [I.htmlSelfClosing]: { match: ir(jn), order: 1, parse(p) {
    let m = p[1].trim();
    return { attrs: n(m, p[2] || ""), tag: m };
  }, render: /* @__PURE__ */ a((p, m, f) => r(p.tag, Tt({}, p.attrs, { key: f.key })), "render") }, [I.htmlComment]: { match: ir(ul), order: 1,
  parse: /* @__PURE__ */ a(() => ({}), "parse"), render: Bn }, [I.image]: { match: lt(_g), order: 1, parse: /* @__PURE__ */ a((p) => ({ alt: p[1],
  target: nl(p[2]), title: p[3] }), "parse"), render: /* @__PURE__ */ a((p, m, f) => r("img", { key: f.key, alt: p.alt || void 0, title: p.title ||
  void 0, src: t.sanitizer(p.target, "img", "src") }), "render") }, [I.link]: { match: st(Ng), order: 3, parse: /* @__PURE__ */ a((p, m, f) => ({
  children: Hg(m, p[1], f), target: nl(p[2]), title: p[3] }), "parse"), render: /* @__PURE__ */ a((p, m, f) => r("a", { key: f.key, href: t.
  sanitizer(p.target, "a", "href"), title: p.title }, m(p.children, f)), "render") }, [I.linkAngleBraceStyleDetector]: { match: st(sg), order: 0,
  parse: /* @__PURE__ */ a((p) => ({ children: [{ text: p[1], type: I.text }], target: p[1], type: I.link }), "parse") }, [I.linkBareUrlDetector]: {
  match: Ht((p, m) => m.inAnchor || t.disableAutoLink ? null : st(ag)(p, m)), order: 0, parse: /* @__PURE__ */ a((p) => ({ children: [{ text: p[1],
  type: I.text }], target: p[1], title: void 0, type: I.link }), "parse") }, [I.linkMailtoDetector]: { match: st(ig), order: 0, parse(p) {
    let m = p[1], f = p[1];
    return Vm.test(f) || (f = "mailto:" + f), { children: [{ text: m.replace("mailto:", ""), type: I.text }], target: f, type: I.link };
  } }, [I.orderedList]: tl(r, 1), [I.unorderedList]: tl(r, 2), [I.newlineCoalescer]: { match: Xe(Km), order: 3, parse: Mn, render: /* @__PURE__ */ a(
  () => `
`, "render") }, [I.paragraph]: { match: Ht(Fg), order: 3, parse: Dn, render: /* @__PURE__ */ a((p, m, f) => r("p", { key: f.key }, m(p.children,
  f)), "render") }, [I.ref]: { match: st(cg), order: 0, parse: /* @__PURE__ */ a((p) => (s[p[1]] = { target: p[2], title: p[4] }, {}), "pars\
e"), render: Bn }, [I.refImage]: { match: lt(pg), order: 0, parse: /* @__PURE__ */ a((p) => ({ alt: p[1] || void 0, ref: p[2] }), "parse"), render: /* @__PURE__ */ a(
  (p, m, f) => s[p.ref] ? r("img", { key: f.key, alt: p.alt, src: t.sanitizer(s[p.ref].target, "img", "src"), title: s[p.ref].title }) : null,
  "render") }, [I.refLink]: { match: st(ug), order: 0, parse: /* @__PURE__ */ a((p, m, f) => ({ children: m(p[1], f), fallbackChildren: p[0],
  ref: p[2] }), "parse"), render: /* @__PURE__ */ a((p, m, f) => s[p.ref] ? r("a", { key: f.key, href: t.sanitizer(s[p.ref].target, "a", "hr\
ef"), title: s[p.ref].title }, m(p.children, f)) : r("span", { key: f.key }, p.fallbackChildren), "render") }, [I.table]: { match: Xe(dl), order: 1,
  parse: Bg, render(p, m, f) {
    let y = p;
    return r("table", { key: f.key }, r("thead", null, r("tr", null, y.header.map(function(h, b) {
      return r("th", { key: b, style: ol(y, b) }, m(h, f));
    }))), r("tbody", null, y.cells.map(function(h, b) {
      return r("tr", { key: b }, h.map(function(x, v) {
        return r("td", { key: v, style: ol(y, v) }, m(x, f));
      }));
    })));
  } }, [I.text]: { match: ir(Cg), order: 4, parse: /* @__PURE__ */ a((p) => ({ text: p[0].replace(rg, (m, f) => t.namedCodesToUnicode[f] ? t.
  namedCodesToUnicode[f] : m) }), "parse"), render: /* @__PURE__ */ a((p) => p.text, "render") }, [I.textBolded]: { match: lt(bg), order: 2,
  parse: /* @__PURE__ */ a((p, m, f) => ({ children: m(p[2], f) }), "parse"), render: /* @__PURE__ */ a((p, m, f) => r("strong", { key: f.key },
  m(p.children, f)), "render") }, [I.textEmphasized]: { match: lt(xg), order: 3, parse: /* @__PURE__ */ a((p, m, f) => ({ children: m(p[2], f) }),
  "parse"), render: /* @__PURE__ */ a((p, m, f) => r("em", { key: f.key }, m(p.children, f)), "render") }, [I.textEscaped]: { match: lt(Sg),
  order: 1, parse: /* @__PURE__ */ a((p) => ({ text: p[1], type: I.text }), "parse") }, [I.textMarked]: { match: lt(vg), order: 3, parse: Dn,
  render: /* @__PURE__ */ a((p, m, f) => r("mark", { key: f.key }, m(p.children, f)), "render") }, [I.textStrikethroughed]: { match: lt(Eg),
  order: 3, parse: Dn, render: /* @__PURE__ */ a((p, m, f) => r("del", { key: f.key }, m(p.children, f)), "render") } };
  t.disableParsingRawHTML === !0 && (delete l[I.htmlBlock], delete l[I.htmlSelfClosing]);
  let c = function(p) {
    let m = Object.keys(p);
    function f(y, h) {
      let b, x, v = [], E = "", S = "";
      for (h.prevCapture = h.prevCapture || ""; y; ) {
        let w = 0;
        for (; w < m.length; ) {
          if (E = m[w], b = p[E], h.inline && !b.match.inline) {
            w++;
            continue;
          }
          let P = b.match(y, h);
          if (P) {
            S = P[0], h.prevCapture += S, y = y.substring(S.length), x = b.parse(P, f, h), x.type == null && (x.type = E), v.push(x);
            break;
          }
          w++;
        }
      }
      return h.prevCapture = "", v;
    }
    return a(f, "n"), m.sort(function(y, h) {
      let b = p[y].order, x = p[h].order;
      return b !== x ? b - x : y < h ? -1 : 1;
    }), function(y, h) {
      return f(function(b) {
        return b.replace(Ym, `
`).replace(Qm, "").replace(fg, "    ");
      }(y), h);
    };
  }(l), u = (d = /* @__PURE__ */ function(p, m) {
    return function(f, y, h) {
      let b = p[f.type].render;
      return m ? m(() => b(f, y, h), f, y, h) : b(f, y, h);
    };
  }(l, t.renderRule), /* @__PURE__ */ a(function p(m, f = {}) {
    if (Array.isArray(m)) {
      let y = f.key, h = [], b = !1;
      for (let x = 0; x < m.length; x++) {
        f.key = x;
        let v = p(m[x], f), E = typeof v == "string";
        E && b ? h[h.length - 1] += v : v !== null && h.push(v), b = E;
      }
      return f.key = y, h;
    }
    return d(m, p, f);
  }, "e"));
  var d;
  let g = o(e);
  return i.length ? r("div", null, g, r("footer", { key: "footer" }, i.map(function(p) {
    return r("div", { id: t.slugify(p.identifier, ar), key: p.identifier }, p.identifier, u(c(p.footnote, { inline: !0 })));
  }))) : g;
}
a(zg, "Xe");
var Sl = /* @__PURE__ */ a((e) => {
  let { children: t = "", options: r } = e, o = function(n, i) {
    if (n == null) return {};
    var s, l, c = {}, u = Object.keys(n);
    for (l = 0; l < u.length; l++) i.indexOf(s = u[l]) >= 0 || (c[s] = n[s]);
    return c;
  }(e, Rm);
  return ro.cloneElement(zg(t, r), o);
}, "default");

// ../addons/docs/src/blocks/components/ArgsTable/ArgRow.tsx
import { styled as Jt } from "storybook/theming";

// ../addons/docs/src/blocks/components/ArgsTable/ArgControl.tsx
import hr, { useCallback as va, useEffect as yb, useState as qc } from "react";
import { Link as bb } from "storybook/internal/components";

// ../addons/docs/src/blocks/controls/index.tsx
import xa, { Suspense as mb, lazy as gb } from "react";

// ../addons/docs/src/blocks/controls/Boolean.tsx
import lr, { useCallback as Ug } from "react";
import { Button as qg } from "storybook/internal/components";
Ne();
import { styled as Wg } from "storybook/theming";
var Gg = Wg.label(({ theme: e }) => ({
  lineHeight: "18px",
  alignItems: "center",
  marginBottom: 8,
  display: "inline-block",
  position: "relative",
  whiteSpace: "nowrap",
  background: e.boolean.background,
  borderRadius: "3em",
  padding: 1,
  '&[aria-disabled="true"]': {
    opacity: 0.5,
    input: {
      cursor: "not-allowed"
    }
  },
  input: {
    appearance: "none",
    width: "100%",
    height: "100%",
    position: "absolute",
    left: 0,
    top: 0,
    margin: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    borderRadius: "3em",
    "&:focus": {
      outline: "none",
      boxShadow: `${e.color.secondary} 0 0 0 1px inset !important`
    },
    "@media (forced-colors: active)": {
      "&:focus": {
        outline: "1px solid highlight"
      }
    }
  },
  span: {
    textAlign: "center",
    fontSize: e.typography.size.s1,
    fontWeight: e.typography.weight.bold,
    lineHeight: "1",
    cursor: "pointer",
    display: "inline-block",
    padding: "7px 15px",
    transition: "all 100ms ease-out",
    userSelect: "none",
    borderRadius: "3em",
    color: B(0.5, e.color.defaultText),
    background: "transparent",
    "&:hover": {
      boxShadow: `${wt(0.3, e.appBorderColor)} 0 0 0 1px inset`
    },
    "&:active": {
      boxShadow: `${wt(0.05, e.appBorderColor)} 0 0 0 2px inset`,
      color: wt(1, e.appBorderColor)
    },
    "&:first-of-type": {
      paddingRight: 8
    },
    "&:last-of-type": {
      paddingLeft: 8
    }
  },
  "input:checked ~ span:last-of-type, input:not(:checked) ~ span:first-of-type": {
    background: e.boolean.selectedBackground,
    boxShadow: e.base === "light" ? `${wt(0.1, e.appBorderColor)} 0 0 2px` : `${e.appBorderColor} 0 0 0 1px`,
    color: e.color.defaultText,
    padding: "7px 15px",
    "@media (forced-colors: active)": {
      textDecoration: "underline"
    }
  }
})), Jg = /* @__PURE__ */ a((e) => e === "true", "parse"), Cl = /* @__PURE__ */ a(({
  name: e,
  value: t,
  onChange: r,
  onBlur: o,
  onFocus: n,
  argType: i
}) => {
  let s = Ug(() => r(!1), [r]), l = !!i?.table?.readonly;
  if (t === void 0)
    return /* @__PURE__ */ lr.createElement(
      qg,
      {
        variant: "outline",
        size: "medium",
        id: ct(e),
        onClick: s,
        disabled: l
      },
      "Set boolean"
    );
  let c = X(e), u = typeof t == "string" ? Jg(t) : t;
  return /* @__PURE__ */ lr.createElement(Gg, { "aria-disabled": l, htmlFor: c, "aria-label": e }, /* @__PURE__ */ lr.createElement(
    "input",
    {
      id: c,
      type: "checkbox",
      onChange: (d) => r(d.target.checked),
      checked: u,
      role: "switch",
      disabled: l,
      name: e,
      onBlur: o,
      onFocus: n
    }
  ), /* @__PURE__ */ lr.createElement("span", { "aria-hidden": "true" }, "False"), /* @__PURE__ */ lr.createElement("span", { "aria-hidden": "\
true" }, "True"));
}, "BooleanControl");

// ../addons/docs/src/blocks/controls/Date.tsx
Ne();
import no, { useEffect as Kg, useRef as wl, useState as Yg } from "react";
import { Form as Xg } from "storybook/internal/components";
import { styled as Al } from "storybook/theming";
var Zg = /* @__PURE__ */ a((e) => {
  let [t, r, o] = e.split("-"), n = /* @__PURE__ */ new Date();
  return n.setFullYear(parseInt(t, 10), parseInt(r, 10) - 1, parseInt(o, 10)), n;
}, "parseDate"), Qg = /* @__PURE__ */ a((e) => {
  let [t, r] = e.split(":"), o = /* @__PURE__ */ new Date();
  return o.setHours(parseInt(t, 10)), o.setMinutes(parseInt(r, 10)), o;
}, "parseTime"), eh = /* @__PURE__ */ a((e) => {
  let t = new Date(e), r = `000${t.getFullYear()}`.slice(-4), o = `0${t.getMonth() + 1}`.slice(-2), n = `0${t.getDate()}`.slice(-2);
  return `${r}-${o}-${n}`;
}, "formatDate"), th = /* @__PURE__ */ a((e) => {
  let t = new Date(e), r = `0${t.getHours()}`.slice(-2), o = `0${t.getMinutes()}`.slice(-2);
  return `${r}:${o}`;
}, "formatTime"), Tl = Al(Xg.Input)(({ readOnly: e }) => ({
  opacity: e ? 0.5 : 1
})), rh = Al.div(({ theme: e }) => ({
  flex: 1,
  display: "flex",
  input: {
    marginLeft: 10,
    flex: 1,
    height: 32,
    // hardcode height bc Chromium bug https://bugs.chromium.org/p/chromium/issues/detail?id=417606
    "&::-webkit-calendar-picker-indicator": {
      opacity: 0.5,
      height: 12,
      filter: e.base === "light" ? void 0 : "invert(1)"
    }
  },
  "input:first-of-type": {
    marginLeft: 0,
    flexGrow: 4
  },
  "input:last-of-type": {
    flexGrow: 3
  }
})), kl = /* @__PURE__ */ a(({ name: e, value: t, onChange: r, onFocus: o, onBlur: n, argType: i }) => {
  let [s, l] = Yg(!0), c = wl(), u = wl(), d = !!i?.table?.readonly;
  Kg(() => {
    s !== !1 && (c && c.current && (c.current.value = t ? eh(t) : ""), u && u.current && (u.current.value = t ? th(t) : ""));
  }, [t]);
  let g = /* @__PURE__ */ a((f) => {
    if (!f.target.value)
      return r();
    let y = Zg(f.target.value), h = new Date(t ?? "");
    h.setFullYear(y.getFullYear(), y.getMonth(), y.getDate());
    let b = h.getTime();
    b && r(b), l(!!b);
  }, "onDateChange"), p = /* @__PURE__ */ a((f) => {
    if (!f.target.value)
      return r();
    let y = Qg(f.target.value), h = new Date(t ?? "");
    h.setHours(y.getHours()), h.setMinutes(y.getMinutes());
    let b = h.getTime();
    b && r(b), l(!!b);
  }, "onTimeChange"), m = X(e);
  return /* @__PURE__ */ no.createElement(rh, null, /* @__PURE__ */ no.createElement(
    Tl,
    {
      type: "date",
      max: "9999-12-31",
      ref: c,
      id: `${m}-date`,
      name: `${m}-date`,
      readOnly: d,
      onChange: g,
      onFocus: o,
      onBlur: n
    }
  ), /* @__PURE__ */ no.createElement(
    Tl,
    {
      type: "time",
      id: `${m}-time`,
      name: `${m}-time`,
      ref: u,
      onChange: p,
      readOnly: d,
      onFocus: o,
      onBlur: n
    }
  ), s ? null : /* @__PURE__ */ no.createElement("div", null, "invalid"));
}, "DateControl");

// ../addons/docs/src/blocks/controls/Number.tsx
Ne();
import Vn, { useCallback as Ol, useEffect as Il, useRef as oh, useState as zn } from "react";
import { Button as nh, Form as ah } from "storybook/internal/components";
import { styled as Pl } from "storybook/theming";
var ih = Pl.label({
  display: "flex"
}), Ll = /* @__PURE__ */ a((e) => {
  let t = parseFloat(e);
  return Number.isNaN(t) ? void 0 : t;
}, "parse");
var sh = Pl(ah.Input)(({ readOnly: e }) => ({
  opacity: e ? 0.5 : 1
})), Nl = /* @__PURE__ */ a(({
  name: e,
  value: t,
  onChange: r,
  min: o,
  max: n,
  step: i,
  onBlur: s,
  onFocus: l,
  argType: c
}) => {
  let [u, d] = zn(typeof t == "number" ? t : ""), [g, p] = zn(!1), [m, f] = zn(null), y = !!c?.table?.readonly, h = Ol(
    (v) => {
      d(v.target.value);
      let E = parseFloat(v.target.value);
      Number.isNaN(E) ? f(new Error(`'${v.target.value}' is not a number`)) : (r(E), f(null));
    },
    [r, f]
  ), b = Ol(() => {
    d("0"), r(0), p(!0);
  }, [p]), x = oh(null);
  return Il(() => {
    g && x.current && x.current.select();
  }, [g]), Il(() => {
    let v = typeof t == "number" ? t : "";
    u !== v && d(v);
  }, [t]), t === void 0 ? /* @__PURE__ */ Vn.createElement(
    nh,
    {
      variant: "outline",
      size: "medium",
      id: ct(e),
      onClick: b,
      disabled: y
    },
    "Set number"
  ) : /* @__PURE__ */ Vn.createElement(ih, null, /* @__PURE__ */ Vn.createElement(
    sh,
    {
      ref: x,
      id: X(e),
      type: "number",
      onChange: h,
      size: "flex",
      placeholder: "Edit number...",
      value: u,
      valid: m ? "error" : void 0,
      autoFocus: g,
      readOnly: y,
      name: e,
      min: o,
      max: n,
      step: i,
      onFocus: l,
      onBlur: s
    }
  ));
}, "NumberControl");

// ../addons/docs/src/blocks/controls/options/Options.tsx
import Ch from "react";

// ../addons/docs/src/blocks/controls/options/Checkbox.tsx
Ne();
import $t, { useEffect as lh, useState as ch } from "react";
import { logger as ph } from "storybook/internal/client-logger";
import { styled as Un } from "storybook/theming";

// ../addons/docs/src/blocks/controls/options/helpers.ts
var ao = /* @__PURE__ */ a((e, t) => {
  let r = t && Object.entries(t).find(([o, n]) => n === e);
  return r ? r[0] : void 0;
}, "selectedKey"), cr = /* @__PURE__ */ a((e, t) => e && t ? Object.entries(t).filter((r) => e.includes(r[1])).map((r) => r[0]) : [], "selec\
tedKeys"), io = /* @__PURE__ */ a((e, t) => e && t && e.map((r) => t[r]), "selectedValues");

// ../addons/docs/src/blocks/controls/options/Checkbox.tsx
var uh = Un.div(
  ({ isInline: e }) => e ? {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    label: {
      display: "inline-flex",
      marginRight: 15
    }
  } : {
    label: {
      display: "flex"
    }
  },
  (e) => {
    if (e["aria-readonly"] === "true")
      return {
        input: {
          cursor: "not-allowed"
        }
      };
  }
), dh = Un.span({
  "[aria-readonly=true] &": {
    opacity: 0.5
  }
}), fh = Un.label({
  lineHeight: "20px",
  alignItems: "center",
  marginBottom: 8,
  "&:last-child": {
    marginBottom: 0
  },
  input: {
    margin: 0,
    marginRight: 6
  }
}), qn = /* @__PURE__ */ a(({
  name: e,
  options: t,
  value: r,
  onChange: o,
  isInline: n,
  argType: i
}) => {
  if (!t)
    return ph.warn(`Checkbox with no options: ${e}`), /* @__PURE__ */ $t.createElement($t.Fragment, null, "-");
  let s = cr(r || [], t), [l, c] = ch(s), u = !!i?.table?.readonly, d = /* @__PURE__ */ a((p) => {
    let m = p.target.value, f = [...l];
    f.includes(m) ? f.splice(f.indexOf(m), 1) : f.push(m), o(io(f, t)), c(f);
  }, "handleChange");
  lh(() => {
    c(cr(r || [], t));
  }, [r]);
  let g = X(e);
  return /* @__PURE__ */ $t.createElement(uh, { "aria-readonly": u, isInline: n }, Object.keys(t).map((p, m) => {
    let f = `${g}-${m}`;
    return /* @__PURE__ */ $t.createElement(fh, { key: f, htmlFor: f }, /* @__PURE__ */ $t.createElement(
      "input",
      {
        type: "checkbox",
        disabled: u,
        id: f,
        name: f,
        value: p,
        onChange: d,
        checked: l?.includes(p)
      }
    ), /* @__PURE__ */ $t.createElement(dh, null, p));
  }));
}, "CheckboxControl");

// ../addons/docs/src/blocks/controls/options/Radio.tsx
Ne();
import Vt from "react";
import { logger as mh } from "storybook/internal/client-logger";
import { styled as Wn } from "storybook/theming";
var gh = Wn.div(
  ({ isInline: e }) => e ? {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    label: {
      display: "inline-flex",
      marginRight: 15
    }
  } : {
    label: {
      display: "flex"
    }
  },
  (e) => {
    if (e["aria-readonly"] === "true")
      return {
        input: {
          cursor: "not-allowed"
        }
      };
  }
), hh = Wn.span({
  "[aria-readonly=true] &": {
    opacity: 0.5
  }
}), yh = Wn.label({
  lineHeight: "20px",
  alignItems: "center",
  marginBottom: 8,
  "&:last-child": {
    marginBottom: 0
  },
  input: {
    margin: 0,
    marginRight: 6
  }
}), Gn = /* @__PURE__ */ a(({
  name: e,
  options: t,
  value: r,
  onChange: o,
  isInline: n,
  argType: i
}) => {
  if (!t)
    return mh.warn(`Radio with no options: ${e}`), /* @__PURE__ */ Vt.createElement(Vt.Fragment, null, "-");
  let s = ao(r, t), l = X(e), c = !!i?.table?.readonly;
  return /* @__PURE__ */ Vt.createElement(gh, { "aria-readonly": c, isInline: n }, Object.keys(t).map((u, d) => {
    let g = `${l}-${d}`;
    return /* @__PURE__ */ Vt.createElement(yh, { key: g, htmlFor: g }, /* @__PURE__ */ Vt.createElement(
      "input",
      {
        type: "radio",
        id: g,
        name: l,
        disabled: c,
        value: u,
        onChange: (p) => o(t[p.currentTarget.value]),
        checked: u === s
      }
    ), /* @__PURE__ */ Vt.createElement(hh, null, u));
  }));
}, "RadioControl");

// ../addons/docs/src/blocks/controls/options/Select.tsx
Ne();
import _e from "react";
import { logger as bh } from "storybook/internal/client-logger";
import { ChevronSmallDownIcon as xh } from "@storybook/icons";
import { styled as Dl } from "storybook/theming";
var vh = {
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
}, Ml = Dl.select(vh, ({ theme: e }) => ({
  boxSizing: "border-box",
  position: "relative",
  padding: "6px 10px",
  width: "100%",
  color: e.input.color || "inherit",
  background: e.input.background,
  borderRadius: e.input.borderRadius,
  boxShadow: `${e.input.border} 0 0 0 1px inset`,
  fontSize: e.typography.size.s2 - 1,
  lineHeight: "20px",
  "&:focus": {
    boxShadow: `${e.color.secondary} 0 0 0 1px inset`,
    outline: "none"
  },
  "&[disabled]": {
    cursor: "not-allowed",
    opacity: 0.5
  },
  "::placeholder": {
    color: e.textMutedColor
  },
  "&[multiple]": {
    overflow: "auto",
    padding: 0,
    option: {
      display: "block",
      padding: "6px 10px",
      marginLeft: 1,
      marginRight: 1
    }
  }
})), Bl = Dl.span(({ theme: e }) => ({
  display: "inline-block",
  lineHeight: "normal",
  overflow: "hidden",
  position: "relative",
  verticalAlign: "top",
  width: "100%",
  svg: {
    position: "absolute",
    zIndex: 1,
    pointerEvents: "none",
    height: "12px",
    marginTop: "-6px",
    right: "12px",
    top: "50%",
    fill: e.textMutedColor,
    path: {
      fill: e.textMutedColor
    }
  }
})), _l = "Choose option...", Eh = /* @__PURE__ */ a(({ name: e, value: t, options: r, onChange: o, argType: n }) => {
  let i = /* @__PURE__ */ a((u) => {
    o(r[u.currentTarget.value]);
  }, "handleChange"), s = ao(t, r) || _l, l = X(e), c = !!n?.table?.readonly;
  return /* @__PURE__ */ _e.createElement(Bl, null, /* @__PURE__ */ _e.createElement(xh, null), /* @__PURE__ */ _e.createElement(Ml, { disabled: c,
  id: l, value: s, onChange: i }, /* @__PURE__ */ _e.createElement("option", { key: "no-selection", disabled: !0 }, _l), Object.keys(r).map(
  (u) => /* @__PURE__ */ _e.createElement("option", { key: u, value: u }, u))));
}, "SingleSelect"), Sh = /* @__PURE__ */ a(({ name: e, value: t, options: r, onChange: o, argType: n }) => {
  let i = /* @__PURE__ */ a((u) => {
    let d = Array.from(u.currentTarget.options).filter((g) => g.selected).map((g) => g.value);
    o(io(d, r));
  }, "handleChange"), s = cr(t, r), l = X(e), c = !!n?.table?.readonly;
  return /* @__PURE__ */ _e.createElement(Bl, null, /* @__PURE__ */ _e.createElement(
    Ml,
    {
      disabled: c,
      id: l,
      multiple: !0,
      value: s,
      onChange: i
    },
    Object.keys(r).map((u) => /* @__PURE__ */ _e.createElement("option", { key: u, value: u }, u))
  ));
}, "MultiSelect"), Jn = /* @__PURE__ */ a((e) => {
  let { name: t, options: r } = e;
  return r ? e.isMulti ? /* @__PURE__ */ _e.createElement(Sh, { ...e }) : /* @__PURE__ */ _e.createElement(Eh, { ...e }) : (bh.warn(`Select \
with no options: ${t}`), /* @__PURE__ */ _e.createElement(_e.Fragment, null, "-"));
}, "SelectControl");

// ../addons/docs/src/blocks/controls/options/Options.tsx
var wh = /* @__PURE__ */ a((e, t) => Array.isArray(e) ? e.reduce((r, o) => (r[t?.[o] || String(o)] = o, r), {}) : e, "normalizeOptions"), Th = {
  check: qn,
  "inline-check": qn,
  radio: Gn,
  "inline-radio": Gn,
  select: Jn,
  "multi-select": Jn
}, At = /* @__PURE__ */ a((e) => {
  let { type: t = "select", labels: r, argType: o } = e, n = {
    ...e,
    argType: o,
    options: o ? wh(o.options, r) : {},
    isInline: t.includes("inline"),
    isMulti: t.includes("multi")
  }, i = Th[t];
  if (i)
    return /* @__PURE__ */ Ch.createElement(i, { ...n });
  throw new Error(`Unknown options type: ${t}`);
}, "OptionsControl");

// ../addons/docs/src/blocks/controls/Object.tsx
or();
Ne();
import ue, { useCallback as tc, useEffect as Lh, useMemo as Nh, useRef as _h, useState as ia } from "react";
import { Button as Dh, Form as Mh, IconButton as Bh } from "storybook/internal/components";
import { AddIcon as Fh, EyeCloseIcon as Rh, EyeIcon as jh, SubtractIcon as Hh } from "@storybook/icons";
import { styled as Ut, useTheme as $h } from "storybook/theming";

// ../addons/docs/src/blocks/controls/react-editable-json-tree/index.tsx
import mo, { Component as Ph } from "react";

// ../addons/docs/src/blocks/controls/react-editable-json-tree/JsonNodes.tsx
import O, { Component as zt, cloneElement as we } from "react";

// ../addons/docs/src/blocks/controls/react-editable-json-tree/JsonNodeAccordion.tsx
import Kn from "react";
import { styled as Yn } from "storybook/theming";
var Ah = Yn.div(({ theme: e }) => ({
  position: "relative",
  ":hover": {
    "& > .rejt-accordion-button::after": {
      background: e.color.secondary
    },
    "& > .rejt-accordion-region > :is(.rejt-plus-menu, .rejt-minus-menu)": {
      opacity: 1
    }
  }
})), kh = Yn.button(({ theme: e }) => ({
  padding: 0,
  background: "transparent",
  border: "none",
  marginRight: "3px",
  lineHeight: "22px",
  color: e.color.secondary,
  "::after": {
    content: '""',
    position: "absolute",
    top: 0,
    display: "block",
    width: "100%",
    marginLeft: "-1rem",
    height: "22px",
    background: "transparent",
    borderRadius: 4,
    transition: "background 0.2s",
    opacity: 0.1,
    paddingRight: "20px"
  },
  "::before": {
    content: '""',
    position: "absolute"
  },
  '&[aria-expanded="true"]::before': {
    left: -10,
    top: 10,
    borderTop: "3px solid rgba(153,153,153,0.6)",
    borderLeft: "3px solid transparent",
    borderRight: "3px solid transparent"
  },
  '&[aria-expanded="false"]::before': {
    left: -8,
    top: 8,
    borderTop: "3px solid transparent",
    borderBottom: "3px solid transparent",
    borderLeft: "3px solid rgba(153,153,153,0.6)"
  }
})), Oh = Yn.div({
  display: "inline"
});
function Xn({
  children: e,
  name: t,
  collapsed: r,
  keyPath: o,
  deep: n,
  ...i
}) {
  let l = `${o.at(-1) ?? "root"}-${t}-${n}`, c = {
    trigger: `${l}-trigger`,
    region: `${l}-region`
  }, u = o.length > 0 ? "li" : "div";
  return /* @__PURE__ */ Kn.createElement(Ah, { as: u }, /* @__PURE__ */ Kn.createElement(
    kh,
    {
      type: "button",
      "aria-expanded": !r,
      id: c.trigger,
      "aria-controls": c.region,
      className: "rejt-accordion-button",
      ...i
    },
    t,
    " :"
  ), /* @__PURE__ */ Kn.createElement(
    Oh,
    {
      role: "region",
      id: c.region,
      "aria-labelledby": c.trigger,
      className: "rejt-accordion-region"
    },
    e
  ));
}
a(Xn, "JsonNodeAccordion");

// ../addons/docs/src/blocks/controls/react-editable-json-tree/types/dataTypes.ts
var Fl = "Error", Rl = "Object", jl = "Array", Hl = "String", $l = "Number", Vl = "Boolean", zl = "Date", Ul = "Null", ql = "Undefined", Wl = "\
Function", Gl = "Symbol";

// ../addons/docs/src/blocks/controls/react-editable-json-tree/types/deltaTypes.ts
var so = "ADD_DELTA_TYPE", lo = "REMOVE_DELTA_TYPE", co = "UPDATE_DELTA_TYPE";

// ../addons/docs/src/blocks/controls/react-editable-json-tree/types/inputUsageTypes.ts
var po = "value", Kl = "key";

// ../addons/docs/src/blocks/controls/react-editable-json-tree/utils/objectTypes.ts
function Ze(e) {
  return e !== null && typeof e == "object" && !Array.isArray(e) && typeof e[Symbol.iterator] == "function" ? "Iterable" : Object.prototype.
  toString.call(e).slice(8, -1);
}
a(Ze, "getObjectType");
function Zn(e, t) {
  let r = Ze(e), o = Ze(t);
  return (r === "Function" || o === "Function") && o !== r;
}
a(Zn, "isComponentWillChange");

// ../addons/docs/src/blocks/controls/react-editable-json-tree/JsonNodes.tsx
var Qn = class Qn extends zt {
  constructor(t) {
    super(t), this.state = {
      inputRefKey: null,
      inputRefValue: null
    }, this.refInputValue = this.refInputValue.bind(this), this.refInputKey = this.refInputKey.bind(this), this.onKeydown = this.onKeydown.bind(
    this), this.onSubmit = this.onSubmit.bind(this);
  }
  componentDidMount() {
    let { inputRefKey: t, inputRefValue: r } = this.state, { onlyValue: o } = this.props;
    t && typeof t.focus == "function" && t.focus(), o && r && typeof r.focus == "function" && r.focus();
  }
  onKeydown(t) {
    if (t.altKey || t.ctrlKey || t.metaKey || t.shiftKey || t.repeat)
      return;
    let { inputRefKey: r, inputRefValue: o } = this.state, { addButtonElement: n, handleCancel: i } = this.props;
    [r, o, n].some(
      (l) => l === t.target
    ) && ((t.code === "Enter" || t.key === "Enter") && (t.preventDefault(), this.onSubmit()), (t.code === "Escape" || t.key === "Escape") &&
    (t.preventDefault(), i()));
  }
  onSubmit() {
    let { handleAdd: t, onlyValue: r, onSubmitValueParser: o, keyPath: n, deep: i } = this.props, { inputRefKey: s, inputRefValue: l } = this.
    state, c = {};
    if (!r) {
      if (!s.value)
        return;
      c.key = s.value;
    }
    c.newValue = o(!1, n, i, c.key, l.value), t(c);
  }
  refInputKey(t) {
    this.state.inputRefKey = t;
  }
  refInputValue(t) {
    this.state.inputRefValue = t;
  }
  render() {
    let {
      handleCancel: t,
      onlyValue: r,
      addButtonElement: o,
      cancelButtonElement: n,
      inputElementGenerator: i,
      keyPath: s,
      deep: l
    } = this.props, c = o && we(o, {
      onClick: this.onSubmit
    }), u = n && we(n, {
      onClick: t
    }), d = i(po, s, l), g = we(d, {
      placeholder: "Value",
      ref: this.refInputValue,
      onKeyDown: this.onKeydown
    }), p = null;
    if (!r) {
      let m = i(Kl, s, l);
      p = we(m, {
        placeholder: "Key",
        ref: this.refInputKey,
        onKeyDown: this.onKeydown
      });
    }
    return /* @__PURE__ */ O.createElement("span", { className: "rejt-add-value-node" }, p, g, c, u);
  }
};
a(Qn, "JsonAddValue");
var pr = Qn;
pr.defaultProps = {
  onlyValue: !1,
  addButtonElement: /* @__PURE__ */ O.createElement("button", null, "+"),
  cancelButtonElement: /* @__PURE__ */ O.createElement("button", null, "c")
};
var ea = class ea extends zt {
  constructor(t) {
    super(t);
    let r = [...t.keyPath || [], t.name];
    this.state = {
      data: t.data,
      name: t.name,
      keyPath: r ?? [],
      deep: t.deep ?? 0,
      nextDeep: (t.deep ?? 0) + 1,
      collapsed: t.isCollapsed(r, t.deep ?? 0, t.data),
      addFormVisible: !1
    }, this.handleCollapseMode = this.handleCollapseMode.bind(this), this.handleRemoveItem = this.handleRemoveItem.bind(this), this.handleAddMode =
    this.handleAddMode.bind(this), this.handleAddValueAdd = this.handleAddValueAdd.bind(this), this.handleAddValueCancel = this.handleAddValueCancel.
    bind(this), this.handleEditValue = this.handleEditValue.bind(this), this.onChildUpdate = this.onChildUpdate.bind(this), this.renderCollapsed =
    this.renderCollapsed.bind(this), this.renderNotCollapsed = this.renderNotCollapsed.bind(this);
  }
  static getDerivedStateFromProps(t, r) {
    return t.data !== r.data ? { data: t.data } : null;
  }
  onChildUpdate(t, r) {
    let { data: o, keyPath: n = [] } = this.state;
    o[t] = r, this.setState({
      data: o
    });
    let { onUpdate: i } = this.props, s = n.length;
    i(n[s - 1], o);
  }
  handleAddMode() {
    this.setState({
      addFormVisible: !0
    });
  }
  handleCollapseMode() {
    this.setState((t) => ({
      collapsed: !t.collapsed
    }));
  }
  handleRemoveItem(t) {
    return () => {
      let { beforeRemoveAction: r, logger: o } = this.props, { data: n, keyPath: i, nextDeep: s } = this.state, l = n[t];
      (r || Promise.resolve.bind(Promise))(t, i, s, l).then(() => {
        let c = {
          keyPath: i,
          deep: s,
          key: t,
          oldValue: l,
          type: lo
        };
        n.splice(t, 1), this.setState({ data: n });
        let { onUpdate: u, onDeltaUpdate: d } = this.props;
        u(i[i.length - 1], n), d(c);
      }).catch(o.error);
    };
  }
  handleAddValueAdd({ key: t, newValue: r }) {
    let { data: o, keyPath: n = [], nextDeep: i } = this.state, { beforeAddAction: s, logger: l } = this.props;
    (s || Promise.resolve.bind(Promise))(t, n, i, r).then(() => {
      o[t] = r, this.setState({
        data: o
      }), this.handleAddValueCancel();
      let { onUpdate: c, onDeltaUpdate: u } = this.props;
      c(n[n.length - 1], o), u({
        type: so,
        keyPath: n,
        deep: i,
        key: t,
        newValue: r
      });
    }).catch(l.error);
  }
  handleAddValueCancel() {
    this.setState({
      addFormVisible: !1
    });
  }
  handleEditValue({ key: t, value: r }) {
    return new Promise((o, n) => {
      let { beforeUpdateAction: i } = this.props, { data: s, keyPath: l, nextDeep: c } = this.state, u = s[t];
      (i || Promise.resolve.bind(Promise))(t, l, c, u, r).then(() => {
        s[t] = r, this.setState({
          data: s
        });
        let { onUpdate: d, onDeltaUpdate: g } = this.props;
        d(l[l.length - 1], s), g({
          type: co,
          keyPath: l,
          deep: c,
          key: t,
          newValue: r,
          oldValue: u
        }), o(void 0);
      }).catch(n);
    });
  }
  renderCollapsed() {
    let { name: t, data: r, keyPath: o, deep: n } = this.state, { handleRemove: i, readOnly: s, getStyle: l, dataType: c, minusMenuElement: u } = this.
    props, { minus: d, collapsed: g } = l(t, r, o, n, c), p = s(t, r, o, n, c), m = u && we(u, {
      onClick: i,
      className: "rejt-minus-menu",
      style: d,
      "aria-label": `remove the array '${String(t)}'`
    });
    return /* @__PURE__ */ O.createElement(O.Fragment, null, /* @__PURE__ */ O.createElement("span", { style: g }, "[...] ", r.length, " ", r.
    length === 1 ? "item" : "items"), !p && m);
  }
  renderNotCollapsed() {
    let { name: t, data: r, keyPath: o, deep: n, addFormVisible: i, nextDeep: s } = this.state, {
      isCollapsed: l,
      handleRemove: c,
      onDeltaUpdate: u,
      readOnly: d,
      getStyle: g,
      dataType: p,
      addButtonElement: m,
      cancelButtonElement: f,
      inputElementGenerator: y,
      textareaElementGenerator: h,
      minusMenuElement: b,
      plusMenuElement: x,
      beforeRemoveAction: v,
      beforeAddAction: E,
      beforeUpdateAction: S,
      logger: w,
      onSubmitValueParser: P
    } = this.props, { minus: N, plus: q, delimiter: H, ul: G, addForm: Z } = g(t, r, o, n, p), se = d(t, r, o, n, p), ee = x && we(x, {
      onClick: this.handleAddMode,
      className: "rejt-plus-menu",
      style: q,
      "aria-label": `add a new item to the '${String(t)}' array`
    }), pe = b && we(b, {
      onClick: c,
      className: "rejt-minus-menu",
      style: N,
      "aria-label": `remove the array '${String(t)}'`
    });
    return /* @__PURE__ */ O.createElement(O.Fragment, null, /* @__PURE__ */ O.createElement("span", { className: "rejt-not-collapsed-delimi\
ter", style: H }, "["), !i && ee, /* @__PURE__ */ O.createElement("ul", { className: "rejt-not-collapsed-list", style: G }, r.map((L, k) => /* @__PURE__ */ O.
    createElement(
      kt,
      {
        key: k,
        name: k.toString(),
        data: L,
        keyPath: o,
        deep: s,
        isCollapsed: l,
        handleRemove: this.handleRemoveItem(k),
        handleUpdateValue: this.handleEditValue,
        onUpdate: this.onChildUpdate,
        onDeltaUpdate: u,
        readOnly: d,
        getStyle: g,
        addButtonElement: m,
        cancelButtonElement: f,
        inputElementGenerator: y,
        textareaElementGenerator: h,
        minusMenuElement: b,
        plusMenuElement: x,
        beforeRemoveAction: v,
        beforeAddAction: E,
        beforeUpdateAction: S,
        logger: w,
        onSubmitValueParser: P
      }
    ))), !se && i && /* @__PURE__ */ O.createElement("div", { className: "rejt-add-form", style: Z }, /* @__PURE__ */ O.createElement(
      pr,
      {
        handleAdd: this.handleAddValueAdd,
        handleCancel: this.handleAddValueCancel,
        onlyValue: !0,
        addButtonElement: m,
        cancelButtonElement: f,
        inputElementGenerator: y,
        keyPath: o,
        deep: n,
        onSubmitValueParser: P
      }
    )), /* @__PURE__ */ O.createElement("span", { className: "rejt-not-collapsed-delimiter", style: H }, "]"), !se && pe);
  }
  render() {
    let { name: t, collapsed: r, keyPath: o, deep: n } = this.state, i = r ? this.renderCollapsed() : this.renderNotCollapsed();
    return /* @__PURE__ */ O.createElement(
      Xn,
      {
        name: t,
        collapsed: r,
        deep: n,
        keyPath: o,
        onClick: this.handleCollapseMode
      },
      i
    );
  }
};
a(ea, "JsonArray");
var uo = ea;
uo.defaultProps = {
  keyPath: [],
  deep: 0,
  minusMenuElement: /* @__PURE__ */ O.createElement("span", null, " - "),
  plusMenuElement: /* @__PURE__ */ O.createElement("span", null, " + ")
};
var ta = class ta extends zt {
  constructor(t) {
    super(t);
    let r = [...t.keyPath || [], t.name];
    this.state = {
      value: t.value,
      name: t.name,
      keyPath: r ?? [],
      deep: t.deep ?? 0,
      editEnabled: !1,
      inputRef: null
    }, this.handleEditMode = this.handleEditMode.bind(this), this.refInput = this.refInput.bind(this), this.handleCancelEdit = this.handleCancelEdit.
    bind(this), this.handleEdit = this.handleEdit.bind(this), this.onKeydown = this.onKeydown.bind(this);
  }
  static getDerivedStateFromProps(t, r) {
    return t.value !== r.value ? { value: t.value } : null;
  }
  componentDidUpdate() {
    let { editEnabled: t, inputRef: r, name: o, value: n, keyPath: i, deep: s } = this.state, { readOnly: l, dataType: c } = this.props, u = l(
    o, n, i, s, c);
    t && !u && typeof r.focus == "function" && r.focus();
  }
  onKeydown(t) {
    let { inputRef: r } = this.state;
    t.altKey || t.ctrlKey || t.metaKey || t.shiftKey || t.repeat || r !== t.target || ((t.code === "Enter" || t.key === "Enter") && (t.preventDefault(),
    this.handleEdit()), (t.code === "Escape" || t.key === "Escape") && (t.preventDefault(), this.handleCancelEdit()));
  }
  handleEdit() {
    let { handleUpdateValue: t, originalValue: r, logger: o, onSubmitValueParser: n, keyPath: i } = this.props, { inputRef: s, name: l, deep: c } = this.
    state;
    if (!s)
      return;
    let u = n(!0, i, c, l, s.value), d = {
      value: u,
      key: l
    };
    (t || Promise.resolve.bind(Promise))(d).then(() => {
      Zn(r, u) || this.handleCancelEdit();
    }).catch(o.error);
  }
  handleEditMode() {
    this.setState({
      editEnabled: !0
    });
  }
  refInput(t) {
    this.state.inputRef = t;
  }
  handleCancelEdit() {
    this.setState({
      editEnabled: !1
    });
  }
  render() {
    let { name: t, value: r, editEnabled: o, keyPath: n, deep: i } = this.state, {
      handleRemove: s,
      originalValue: l,
      readOnly: c,
      dataType: u,
      getStyle: d,
      textareaElementGenerator: g,
      minusMenuElement: p,
      keyPath: m = []
    } = this.props, f = d(t, l, n, i, u), y = null, h = null, b = c(t, l, n, i, u);
    if (o && !b) {
      let x = g(
        po,
        m,
        i,
        t,
        l,
        u
      ), v = we(x, {
        ref: this.refInput,
        defaultValue: r,
        onKeyDown: this.onKeydown
      });
      y = /* @__PURE__ */ O.createElement("span", { className: "rejt-edit-form", style: f.editForm }, v), h = null;
    } else {
      y = /* @__PURE__ */ O.createElement(
        "span",
        {
          className: "rejt-value",
          style: f.value,
          onClick: b ? void 0 : this.handleEditMode
        },
        r
      );
      let x = m.at(-1), v = p && we(p, {
        onClick: s,
        className: "rejt-minus-menu",
        style: f.minus,
        "aria-label": `remove the function '${String(t)}'${String(x) ? ` from '${String(x)}'` : ""}`
      });
      h = b ? null : v;
    }
    return /* @__PURE__ */ O.createElement("li", { className: "rejt-value-node", style: f.li }, /* @__PURE__ */ O.createElement("span", { className: "\
rejt-name", style: f.name }, t, " :", " "), y, h);
  }
};
a(ta, "JsonFunctionValue");
var fo = ta;
fo.defaultProps = {
  keyPath: [],
  deep: 0,
  handleUpdateValue: /* @__PURE__ */ a(() => {
  }, "handleUpdateValue"),
  cancelButtonElement: /* @__PURE__ */ O.createElement("button", null, "c"),
  minusMenuElement: /* @__PURE__ */ O.createElement("span", null, " - ")
};
var ra = class ra extends zt {
  constructor(t) {
    super(t), this.state = {
      data: t.data,
      name: t.name,
      keyPath: t.keyPath ?? [],
      deep: t.deep ?? 0
    };
  }
  static getDerivedStateFromProps(t, r) {
    return t.data !== r.data ? { data: t.data } : null;
  }
  render() {
    let { data: t, name: r, keyPath: o, deep: n } = this.state, {
      isCollapsed: i,
      handleRemove: s,
      handleUpdateValue: l,
      onUpdate: c,
      onDeltaUpdate: u,
      readOnly: d,
      getStyle: g,
      addButtonElement: p,
      cancelButtonElement: m,
      inputElementGenerator: f,
      textareaElementGenerator: y,
      minusMenuElement: h,
      plusMenuElement: b,
      beforeRemoveAction: x,
      beforeAddAction: v,
      beforeUpdateAction: E,
      logger: S,
      onSubmitValueParser: w
    } = this.props, P = /* @__PURE__ */ a(() => !0, "readOnlyTrue"), N = Ze(t);
    switch (N) {
      case Fl:
        return /* @__PURE__ */ O.createElement(
          ur,
          {
            data: t,
            name: r,
            isCollapsed: i,
            keyPath: o,
            deep: n,
            handleRemove: s,
            onUpdate: c,
            onDeltaUpdate: u,
            readOnly: P,
            dataType: N,
            getStyle: g,
            addButtonElement: p,
            cancelButtonElement: m,
            inputElementGenerator: f,
            textareaElementGenerator: y,
            minusMenuElement: h,
            plusMenuElement: b,
            beforeRemoveAction: x,
            beforeAddAction: v,
            beforeUpdateAction: E,
            logger: S,
            onSubmitValueParser: w
          }
        );
      case Rl:
        return /* @__PURE__ */ O.createElement(
          ur,
          {
            data: t,
            name: r,
            isCollapsed: i,
            keyPath: o,
            deep: n,
            handleRemove: s,
            onUpdate: c,
            onDeltaUpdate: u,
            readOnly: d,
            dataType: N,
            getStyle: g,
            addButtonElement: p,
            cancelButtonElement: m,
            inputElementGenerator: f,
            textareaElementGenerator: y,
            minusMenuElement: h,
            plusMenuElement: b,
            beforeRemoveAction: x,
            beforeAddAction: v,
            beforeUpdateAction: E,
            logger: S,
            onSubmitValueParser: w
          }
        );
      case jl:
        return /* @__PURE__ */ O.createElement(
          uo,
          {
            data: t,
            name: r,
            isCollapsed: i,
            keyPath: o,
            deep: n,
            handleRemove: s,
            onUpdate: c,
            onDeltaUpdate: u,
            readOnly: d,
            dataType: N,
            getStyle: g,
            addButtonElement: p,
            cancelButtonElement: m,
            inputElementGenerator: f,
            textareaElementGenerator: y,
            minusMenuElement: h,
            plusMenuElement: b,
            beforeRemoveAction: x,
            beforeAddAction: v,
            beforeUpdateAction: E,
            logger: S,
            onSubmitValueParser: w
          }
        );
      case Hl:
        return /* @__PURE__ */ O.createElement(
          Ue,
          {
            name: r,
            value: `"${t}"`,
            originalValue: t,
            keyPath: o,
            deep: n,
            handleRemove: s,
            handleUpdateValue: l,
            readOnly: d,
            dataType: N,
            getStyle: g,
            cancelButtonElement: m,
            inputElementGenerator: f,
            minusMenuElement: h,
            logger: S,
            onSubmitValueParser: w
          }
        );
      case $l:
        return /* @__PURE__ */ O.createElement(
          Ue,
          {
            name: r,
            value: t,
            originalValue: t,
            keyPath: o,
            deep: n,
            handleRemove: s,
            handleUpdateValue: l,
            readOnly: d,
            dataType: N,
            getStyle: g,
            cancelButtonElement: m,
            inputElementGenerator: f,
            minusMenuElement: h,
            logger: S,
            onSubmitValueParser: w
          }
        );
      case Vl:
        return /* @__PURE__ */ O.createElement(
          Ue,
          {
            name: r,
            value: t ? "true" : "false",
            originalValue: t,
            keyPath: o,
            deep: n,
            handleRemove: s,
            handleUpdateValue: l,
            readOnly: d,
            dataType: N,
            getStyle: g,
            cancelButtonElement: m,
            inputElementGenerator: f,
            minusMenuElement: h,
            logger: S,
            onSubmitValueParser: w
          }
        );
      case zl:
        return /* @__PURE__ */ O.createElement(
          Ue,
          {
            name: r,
            value: t.toISOString(),
            originalValue: t,
            keyPath: o,
            deep: n,
            handleRemove: s,
            handleUpdateValue: l,
            readOnly: P,
            dataType: N,
            getStyle: g,
            cancelButtonElement: m,
            inputElementGenerator: f,
            minusMenuElement: h,
            logger: S,
            onSubmitValueParser: w
          }
        );
      case Ul:
        return /* @__PURE__ */ O.createElement(
          Ue,
          {
            name: r,
            value: "null",
            originalValue: "null",
            keyPath: o,
            deep: n,
            handleRemove: s,
            handleUpdateValue: l,
            readOnly: d,
            dataType: N,
            getStyle: g,
            cancelButtonElement: m,
            inputElementGenerator: f,
            minusMenuElement: h,
            logger: S,
            onSubmitValueParser: w
          }
        );
      case ql:
        return /* @__PURE__ */ O.createElement(
          Ue,
          {
            name: r,
            value: "undefined",
            originalValue: "undefined",
            keyPath: o,
            deep: n,
            handleRemove: s,
            handleUpdateValue: l,
            readOnly: d,
            dataType: N,
            getStyle: g,
            cancelButtonElement: m,
            inputElementGenerator: f,
            minusMenuElement: h,
            logger: S,
            onSubmitValueParser: w
          }
        );
      case Wl:
        return /* @__PURE__ */ O.createElement(
          fo,
          {
            name: r,
            value: t.toString(),
            originalValue: t,
            keyPath: o,
            deep: n,
            handleRemove: s,
            handleUpdateValue: l,
            readOnly: d,
            dataType: N,
            getStyle: g,
            cancelButtonElement: m,
            textareaElementGenerator: y,
            minusMenuElement: h,
            logger: S,
            onSubmitValueParser: w
          }
        );
      case Gl:
        return /* @__PURE__ */ O.createElement(
          Ue,
          {
            name: r,
            value: t.toString(),
            originalValue: t,
            keyPath: o,
            deep: n,
            handleRemove: s,
            handleUpdateValue: l,
            readOnly: P,
            dataType: N,
            getStyle: g,
            cancelButtonElement: m,
            inputElementGenerator: f,
            minusMenuElement: h,
            logger: S,
            onSubmitValueParser: w
          }
        );
      default:
        return null;
    }
  }
};
a(ra, "JsonNode");
var kt = ra;
kt.defaultProps = {
  keyPath: [],
  deep: 0
};
var oa = class oa extends zt {
  constructor(t) {
    super(t);
    let r = t.deep === -1 ? [] : [...t.keyPath || [], t.name];
    this.state = {
      name: t.name,
      data: t.data,
      keyPath: r ?? [],
      deep: t.deep ?? 0,
      nextDeep: (t.deep ?? 0) + 1,
      collapsed: t.isCollapsed(r, t.deep ?? 0, t.data),
      addFormVisible: !1
    }, this.handleCollapseMode = this.handleCollapseMode.bind(this), this.handleRemoveValue = this.handleRemoveValue.bind(this), this.handleAddMode =
    this.handleAddMode.bind(this), this.handleAddValueAdd = this.handleAddValueAdd.bind(this), this.handleAddValueCancel = this.handleAddValueCancel.
    bind(this), this.handleEditValue = this.handleEditValue.bind(this), this.onChildUpdate = this.onChildUpdate.bind(this), this.renderCollapsed =
    this.renderCollapsed.bind(this), this.renderNotCollapsed = this.renderNotCollapsed.bind(this);
  }
  static getDerivedStateFromProps(t, r) {
    return t.data !== r.data ? { data: t.data } : null;
  }
  onChildUpdate(t, r) {
    let { data: o, keyPath: n = [] } = this.state;
    o[t] = r, this.setState({
      data: o
    });
    let { onUpdate: i } = this.props, s = n.length;
    i(n[s - 1], o);
  }
  handleAddMode() {
    this.setState({
      addFormVisible: !0
    });
  }
  handleAddValueCancel() {
    this.setState({
      addFormVisible: !1
    });
  }
  handleAddValueAdd({ key: t, newValue: r }) {
    let { data: o, keyPath: n = [], nextDeep: i } = this.state, { beforeAddAction: s, logger: l } = this.props;
    (s || Promise.resolve.bind(Promise))(t, n, i, r).then(() => {
      o[t] = r, this.setState({
        data: o
      }), this.handleAddValueCancel();
      let { onUpdate: c, onDeltaUpdate: u } = this.props;
      c(n[n.length - 1], o), u({
        type: so,
        keyPath: n,
        deep: i,
        key: t,
        newValue: r
      });
    }).catch(l.error);
  }
  handleRemoveValue(t) {
    return () => {
      let { beforeRemoveAction: r, logger: o } = this.props, { data: n, keyPath: i = [], nextDeep: s } = this.state, l = n[t];
      (r || Promise.resolve.bind(Promise))(t, i, s, l).then(() => {
        let c = {
          keyPath: i,
          deep: s,
          key: t,
          oldValue: l,
          type: lo
        };
        delete n[t], this.setState({ data: n });
        let { onUpdate: u, onDeltaUpdate: d } = this.props;
        u(i[i.length - 1], n), d(c);
      }).catch(o.error);
    };
  }
  handleCollapseMode() {
    this.setState((t) => ({
      collapsed: !t.collapsed
    }));
  }
  handleEditValue({ key: t, value: r }) {
    return new Promise((o, n) => {
      let { beforeUpdateAction: i } = this.props, { data: s, keyPath: l = [], nextDeep: c } = this.state, u = s[t];
      (i || Promise.resolve.bind(Promise))(t, l, c, u, r).then(() => {
        s[t] = r, this.setState({
          data: s
        });
        let { onUpdate: d, onDeltaUpdate: g } = this.props;
        d(l[l.length - 1], s), g({
          type: co,
          keyPath: l,
          deep: c,
          key: t,
          newValue: r,
          oldValue: u
        }), o();
      }).catch(n);
    });
  }
  renderCollapsed() {
    let { name: t, keyPath: r, deep: o, data: n } = this.state, { handleRemove: i, readOnly: s, dataType: l, getStyle: c, minusMenuElement: u } = this.
    props, { minus: d, collapsed: g } = c(t, n, r, o, l), p = Object.getOwnPropertyNames(n), m = s(t, n, r, o, l), f = u && we(u, {
      onClick: i,
      className: "rejt-minus-menu",
      style: d,
      "aria-label": `remove the object '${String(t)}'`
    });
    return /* @__PURE__ */ O.createElement(O.Fragment, null, /* @__PURE__ */ O.createElement("span", { style: g }, "{...}", " ", p.length, "\
 ", p.length === 1 ? "key" : "keys"), !m && f);
  }
  renderNotCollapsed() {
    let { name: t, data: r, keyPath: o, deep: n, nextDeep: i, addFormVisible: s } = this.state, {
      isCollapsed: l,
      handleRemove: c,
      onDeltaUpdate: u,
      readOnly: d,
      getStyle: g,
      dataType: p,
      addButtonElement: m,
      cancelButtonElement: f,
      inputElementGenerator: y,
      textareaElementGenerator: h,
      minusMenuElement: b,
      plusMenuElement: x,
      beforeRemoveAction: v,
      beforeAddAction: E,
      beforeUpdateAction: S,
      logger: w,
      onSubmitValueParser: P
    } = this.props, { minus: N, plus: q, addForm: H, ul: G, delimiter: Z } = g(t, r, o, n, p), se = Object.getOwnPropertyNames(r), ee = d(t,
    r, o, n, p), pe = x && we(x, {
      onClick: this.handleAddMode,
      className: "rejt-plus-menu",
      style: q,
      "aria-label": `add a new property to the object '${String(t)}'`
    }), _ = b && we(b, {
      onClick: c,
      className: "rejt-minus-menu",
      style: N,
      "aria-label": `remove the object '${String(t)}'`
    }), j = se.map((k) => /* @__PURE__ */ O.createElement(
      kt,
      {
        key: k,
        name: k,
        data: r[k],
        keyPath: o,
        deep: i,
        isCollapsed: l,
        handleRemove: this.handleRemoveValue(k),
        handleUpdateValue: this.handleEditValue,
        onUpdate: this.onChildUpdate,
        onDeltaUpdate: u,
        readOnly: d,
        getStyle: g,
        addButtonElement: m,
        cancelButtonElement: f,
        inputElementGenerator: y,
        textareaElementGenerator: h,
        minusMenuElement: b,
        plusMenuElement: x,
        beforeRemoveAction: v,
        beforeAddAction: E,
        beforeUpdateAction: S,
        logger: w,
        onSubmitValueParser: P
      }
    ));
    return /* @__PURE__ */ O.createElement(O.Fragment, null, /* @__PURE__ */ O.createElement("span", { className: "rejt-not-collapsed-delimi\
ter", style: Z }, "{"), !ee && pe, /* @__PURE__ */ O.createElement("ul", { className: "rejt-not-collapsed-list", style: G }, j), !ee && s &&
    /* @__PURE__ */ O.createElement("div", { className: "rejt-add-form", style: H }, /* @__PURE__ */ O.createElement(
      pr,
      {
        handleAdd: this.handleAddValueAdd,
        handleCancel: this.handleAddValueCancel,
        addButtonElement: m,
        cancelButtonElement: f,
        inputElementGenerator: y,
        keyPath: o,
        deep: n,
        onSubmitValueParser: P
      }
    )), /* @__PURE__ */ O.createElement("span", { className: "rejt-not-collapsed-delimiter", style: Z }, "}"), !ee && _);
  }
  render() {
    let { name: t, collapsed: r, keyPath: o, deep: n = 0 } = this.state, i = r ? this.renderCollapsed() : this.renderNotCollapsed();
    return /* @__PURE__ */ O.createElement(
      Xn,
      {
        name: t,
        collapsed: r,
        deep: n,
        keyPath: o,
        onClick: this.handleCollapseMode
      },
      i
    );
  }
};
a(oa, "JsonObject");
var ur = oa;
ur.defaultProps = {
  keyPath: [],
  deep: 0,
  minusMenuElement: /* @__PURE__ */ O.createElement("span", null, " - "),
  plusMenuElement: /* @__PURE__ */ O.createElement("span", null, " + ")
};
var na = class na extends zt {
  constructor(t) {
    super(t);
    let r = [...t.keyPath || [], t.name];
    this.state = {
      value: t.value,
      name: t.name,
      keyPath: r ?? [],
      deep: t.deep ?? 0,
      editEnabled: !1,
      inputRef: null
    }, this.handleEditMode = this.handleEditMode.bind(this), this.refInput = this.refInput.bind(this), this.handleCancelEdit = this.handleCancelEdit.
    bind(this), this.handleEdit = this.handleEdit.bind(this), this.onKeydown = this.onKeydown.bind(this);
  }
  static getDerivedStateFromProps(t, r) {
    return t.value !== r.value ? { value: t.value } : null;
  }
  componentDidUpdate() {
    let { editEnabled: t, inputRef: r, name: o, value: n, keyPath: i, deep: s } = this.state, { readOnly: l, dataType: c } = this.props, u = l(
    o, n, i, s, c);
    t && !u && typeof r.focus == "function" && r.focus();
  }
  onKeydown(t) {
    let { inputRef: r } = this.state;
    t.altKey || t.ctrlKey || t.metaKey || t.shiftKey || t.repeat || r !== t.target || ((t.code === "Enter" || t.key === "Enter") && (t.preventDefault(),
    this.handleEdit()), (t.code === "Escape" || t.key === "Escape") && (t.preventDefault(), this.handleCancelEdit()));
  }
  handleEdit() {
    let { handleUpdateValue: t, originalValue: r, logger: o, onSubmitValueParser: n, keyPath: i } = this.props, { inputRef: s, name: l, deep: c } = this.
    state;
    if (!s)
      return;
    let u = n(!0, i, c, l, s.value), d = {
      value: u,
      key: l
    };
    (t || Promise.resolve.bind(Promise))(d).then(() => {
      Zn(r, u) || this.handleCancelEdit();
    }).catch(o.error);
  }
  handleEditMode() {
    this.setState({
      editEnabled: !0
    });
  }
  refInput(t) {
    this.state.inputRef = t;
  }
  handleCancelEdit() {
    this.setState({
      editEnabled: !1
    });
  }
  render() {
    let { name: t, value: r, editEnabled: o, keyPath: n, deep: i } = this.state, {
      handleRemove: s,
      originalValue: l,
      readOnly: c,
      dataType: u,
      getStyle: d,
      inputElementGenerator: g,
      minusMenuElement: p,
      keyPath: m
    } = this.props, f = d(t, l, n, i, u), y = c(t, l, n, i, u), h = o && !y, b = g(
      po,
      m,
      i,
      t,
      l,
      u
    ), x = we(b, {
      ref: this.refInput,
      defaultValue: JSON.stringify(l),
      onKeyDown: this.onKeydown
    }), v = n.at(-2), E = p && we(p, {
      onClick: s,
      className: "rejt-minus-menu",
      style: f.minus,
      "aria-label": `remove the property '${String(t)}' with value '${String(l)}'${String(v) ? ` from '${String(v)}'` : ""}`
    });
    return /* @__PURE__ */ O.createElement("li", { className: "rejt-value-node", style: f.li }, /* @__PURE__ */ O.createElement("span", { className: "\
rejt-name", style: f.name }, t, " : "), h ? /* @__PURE__ */ O.createElement("span", { className: "rejt-edit-form", style: f.editForm }, x) :
    /* @__PURE__ */ O.createElement(
      "span",
      {
        className: "rejt-value",
        style: f.value,
        onClick: y ? void 0 : this.handleEditMode
      },
      String(r)
    ), !y && !h && E);
  }
};
a(na, "JsonValue");
var Ue = na;
Ue.defaultProps = {
  keyPath: [],
  deep: 0,
  handleUpdateValue: /* @__PURE__ */ a(() => Promise.resolve(), "handleUpdateValue"),
  cancelButtonElement: /* @__PURE__ */ O.createElement("button", null, "c"),
  minusMenuElement: /* @__PURE__ */ O.createElement("span", null, " - ")
};

// ../addons/docs/src/blocks/controls/react-editable-json-tree/utils/parse.ts
function Xl(e) {
  let t = e;
  if (t.indexOf("function") === 0)
    return (0, eval)(`(${t})`);
  try {
    t = JSON.parse(e);
  } catch {
  }
  return t;
}
a(Xl, "parse");

// ../addons/docs/src/blocks/controls/react-editable-json-tree/utils/styles.ts
var Zl = {
  minus: {
    color: "red"
  },
  plus: {
    color: "green"
  },
  collapsed: {
    color: "grey"
  },
  delimiter: {},
  ul: {
    padding: "0px",
    margin: "0 0 0 25px",
    listStyle: "none"
  },
  name: {
    color: "#2287CD"
  },
  addForm: {}
}, Ql = {
  minus: {
    color: "red"
  },
  plus: {
    color: "green"
  },
  collapsed: {
    color: "grey"
  },
  delimiter: {},
  ul: {
    padding: "0px",
    margin: "0 0 0 25px",
    listStyle: "none"
  },
  name: {
    color: "#2287CD"
  },
  addForm: {}
}, ec = {
  minus: {
    color: "red"
  },
  editForm: {},
  value: {
    color: "#7bba3d"
  },
  li: {
    minHeight: "22px",
    lineHeight: "22px",
    outline: "0px"
  },
  name: {
    color: "#2287CD"
  }
};

// ../addons/docs/src/blocks/controls/react-editable-json-tree/index.tsx
var aa = class aa extends Ph {
  constructor(t) {
    super(t), this.state = {
      data: t.data,
      rootName: t.rootName
    }, this.onUpdate = this.onUpdate.bind(this), this.removeRoot = this.removeRoot.bind(this);
  }
  static getDerivedStateFromProps(t, r) {
    return t.data !== r.data || t.rootName !== r.rootName ? {
      data: t.data,
      rootName: t.rootName
    } : null;
  }
  onUpdate(t, r) {
    this.setState({ data: r }), this.props.onFullyUpdate?.(r);
  }
  removeRoot() {
    this.onUpdate(null, null);
  }
  render() {
    let { data: t, rootName: r } = this.state, {
      isCollapsed: o,
      onDeltaUpdate: n,
      readOnly: i,
      getStyle: s,
      addButtonElement: l,
      cancelButtonElement: c,
      inputElement: u,
      textareaElement: d,
      minusMenuElement: g,
      plusMenuElement: p,
      beforeRemoveAction: m,
      beforeAddAction: f,
      beforeUpdateAction: y,
      logger: h,
      onSubmitValueParser: b,
      fallback: x = null
    } = this.props, v = Ze(t), E = i;
    Ze(i) === "Boolean" && (E = /* @__PURE__ */ a(() => i, "readOnlyFunction"));
    let S = u;
    u && Ze(u) !== "Function" && (S = /* @__PURE__ */ a(() => u, "inputElementFunction"));
    let w = d;
    return d && Ze(d) !== "Function" && (w = /* @__PURE__ */ a(() => d, "textareaElementFunction")), v === "Object" || v === "Array" ? /* @__PURE__ */ mo.
    createElement("div", { className: "rejt-tree" }, /* @__PURE__ */ mo.createElement(
      kt,
      {
        data: t,
        name: r || "root",
        deep: -1,
        isCollapsed: o ?? (() => !1),
        onUpdate: this.onUpdate,
        onDeltaUpdate: n ?? (() => {
        }),
        readOnly: E,
        getStyle: s ?? (() => ({})),
        addButtonElement: l,
        cancelButtonElement: c,
        inputElementGenerator: S,
        textareaElementGenerator: w,
        minusMenuElement: g,
        plusMenuElement: p,
        handleRemove: this.removeRoot,
        beforeRemoveAction: m,
        beforeAddAction: f,
        beforeUpdateAction: y,
        logger: h ?? {},
        onSubmitValueParser: b ?? ((P) => P)
      }
    )) : x;
  }
};
a(aa, "JsonTree");
var dr = aa;
dr.defaultProps = {
  rootName: "root",
  isCollapsed: /* @__PURE__ */ a((e, t) => t !== -1, "isCollapsed"),
  getStyle: /* @__PURE__ */ a((e, t, r, o, n) => {
    switch (n) {
      case "Object":
      case "Error":
        return Zl;
      case "Array":
        return Ql;
      default:
        return ec;
    }
  }, "getStyle"),
  readOnly: /* @__PURE__ */ a(() => !1, "readOnly"),
  onFullyUpdate: /* @__PURE__ */ a(() => {
  }, "onFullyUpdate"),
  onDeltaUpdate: /* @__PURE__ */ a(() => {
  }, "onDeltaUpdate"),
  beforeRemoveAction: /* @__PURE__ */ a(() => Promise.resolve(), "beforeRemoveAction"),
  beforeAddAction: /* @__PURE__ */ a(() => Promise.resolve(), "beforeAddAction"),
  beforeUpdateAction: /* @__PURE__ */ a(() => Promise.resolve(), "beforeUpdateAction"),
  logger: { error: /* @__PURE__ */ a(() => {
  }, "error") },
  onSubmitValueParser: /* @__PURE__ */ a((e, t, r, o, n) => Xl(n), "onSubmitValueParser"),
  inputElement: /* @__PURE__ */ a(() => /* @__PURE__ */ mo.createElement("input", null), "inputElement"),
  textareaElement: /* @__PURE__ */ a(() => /* @__PURE__ */ mo.createElement("textarea", null), "textareaElement"),
  fallback: null
};

// ../addons/docs/src/blocks/controls/Object.tsx
var { window: Vh } = globalThis, zh = Ut.div(({ theme: e }) => ({
  position: "relative",
  display: "flex",
  '&[aria-readonly="true"]': {
    opacity: 0.5
  },
  ".rejt-tree": {
    marginLeft: "1rem",
    fontSize: "13px",
    listStyleType: "none"
  },
  ".rejt-value-node:hover": {
    "& > button": {
      opacity: 1
    }
  },
  ".rejt-add-form": {
    marginLeft: 10
  },
  ".rejt-add-value-node": {
    display: "inline-flex",
    alignItems: "center"
  },
  ".rejt-name": {
    lineHeight: "22px"
  },
  ".rejt-not-collapsed-delimiter": {
    lineHeight: "22px"
  },
  ".rejt-value": {
    display: "inline-block",
    border: "1px solid transparent",
    borderRadius: 4,
    margin: "1px 0",
    padding: "0 4px",
    cursor: "text",
    color: e.color.defaultText
  },
  ".rejt-value-node:hover > .rejt-value": {
    background: e.color.lighter,
    borderColor: e.appBorderColor
  }
})), rc = Ut.button(({ theme: e, primary: t }) => ({
  border: 0,
  height: 20,
  margin: 1,
  borderRadius: 4,
  background: t ? e.color.secondary : "transparent",
  color: t ? e.color.lightest : e.color.dark,
  fontWeight: t ? "bold" : "normal",
  cursor: "pointer"
})), oc = Ut.button(({ theme: e }) => ({
  background: "none",
  border: 0,
  display: "inline-flex",
  verticalAlign: "middle",
  padding: 3,
  marginLeft: 5,
  color: e.textMutedColor,
  opacity: 0,
  transition: "opacity 0.2s",
  cursor: "pointer",
  position: "relative",
  svg: {
    width: 9,
    height: 9
  },
  ":disabled": {
    cursor: "not-allowed"
  },
  ":hover, :focus-visible": {
    opacity: 1
  },
  "&:hover:not(:disabled), &:focus-visible:not(:disabled)": {
    "&.rejt-plus-menu": {
      color: e.color.ancillary
    },
    "&.rejt-minus-menu": {
      color: e.color.negative
    }
  }
})), nc = Ut.input(({ theme: e, placeholder: t }) => ({
  outline: 0,
  margin: t ? 1 : "1px 0",
  padding: "3px 4px",
  color: e.color.defaultText,
  background: e.background.app,
  border: `1px solid ${e.appBorderColor}`,
  borderRadius: 4,
  lineHeight: "14px",
  width: t === "Key" ? 80 : 120,
  "&:focus": {
    border: `1px solid ${e.color.secondary}`
  }
})), Uh = Ut(Bh)(({ theme: e }) => ({
  position: "absolute",
  zIndex: 2,
  top: 2,
  right: 2,
  height: 21,
  padding: "0 3px",
  background: e.background.bar,
  border: `1px solid ${e.appBorderColor}`,
  borderRadius: 3,
  color: e.textMutedColor,
  fontSize: "9px",
  fontWeight: "bold",
  textDecoration: "none",
  span: {
    marginLeft: 3,
    marginTop: 1
  }
})), qh = Ut(Mh.Textarea)(({ theme: e }) => ({
  flex: 1,
  padding: "7px 6px",
  fontFamily: e.typography.fonts.mono,
  fontSize: "12px",
  lineHeight: "18px",
  "&::placeholder": {
    fontFamily: e.typography.fonts.base,
    fontSize: "13px"
  },
  "&:placeholder-shown": {
    padding: "7px 10px"
  }
})), Wh = {
  bubbles: !0,
  cancelable: !0,
  key: "Enter",
  code: "Enter",
  keyCode: 13
}, Gh = /* @__PURE__ */ a((e) => {
  e.currentTarget.dispatchEvent(new Vh.KeyboardEvent("keydown", Wh));
}, "dispatchEnterKey"), Jh = /* @__PURE__ */ a((e) => {
  e.currentTarget.select();
}, "selectValue"), Kh = /* @__PURE__ */ a((e) => () => ({
  name: {
    color: e.color.secondary
  },
  collapsed: {
    color: e.color.dark
  },
  ul: {
    listStyle: "none",
    margin: "0 0 0 1rem",
    padding: 0
  },
  li: {
    outline: 0
  }
}), "getCustomStyleFunction"), sa = /* @__PURE__ */ a(({ name: e, value: t, onChange: r, argType: o }) => {
  let n = $h(), i = Nh(() => t && hn(t), [t]), s = i != null, [l, c] = ia(!s), [u, d] = ia(null), g = !!o?.table?.readonly, p = tc(
    (v) => {
      try {
        v && r(JSON.parse(v)), d(null);
      } catch (E) {
        d(E);
      }
    },
    [r]
  ), [m, f] = ia(!1), y = tc(() => {
    r({}), f(!0);
  }, [f]), h = _h(null);
  if (Lh(() => {
    m && h.current && h.current.select();
  }, [m]), !s)
    return /* @__PURE__ */ ue.createElement(Dh, { disabled: g, id: ct(e), onClick: y }, "Set object");
  let b = /* @__PURE__ */ ue.createElement(
    qh,
    {
      ref: h,
      id: X(e),
      name: e,
      defaultValue: t === null ? "" : JSON.stringify(t, null, 2),
      onBlur: (v) => p(v.target.value),
      placeholder: "Edit JSON string...",
      autoFocus: m,
      valid: u ? "error" : void 0,
      readOnly: g
    }
  ), x = Array.isArray(t) || typeof t == "object" && t?.constructor === Object;
  return /* @__PURE__ */ ue.createElement(zh, { "aria-readonly": g }, x && /* @__PURE__ */ ue.createElement(
    Uh,
    {
      role: "switch",
      "aria-checked": l,
      "aria-label": `Edit the ${e} properties in text format`,
      onClick: (v) => {
        v.preventDefault(), c((E) => !E);
      }
    },
    l ? /* @__PURE__ */ ue.createElement(Rh, null) : /* @__PURE__ */ ue.createElement(jh, null),
    /* @__PURE__ */ ue.createElement("span", null, "RAW")
  ), l ? b : /* @__PURE__ */ ue.createElement(
    dr,
    {
      readOnly: g || !x,
      isCollapsed: x ? (
        /* default value */
        void 0
      ) : () => !0,
      data: i,
      rootName: e,
      onFullyUpdate: r,
      getStyle: Kh(n),
      cancelButtonElement: /* @__PURE__ */ ue.createElement(rc, { type: "button" }, "Cancel"),
      addButtonElement: /* @__PURE__ */ ue.createElement(rc, { type: "submit", primary: !0 }, "Save"),
      plusMenuElement: /* @__PURE__ */ ue.createElement(oc, { type: "button" }, /* @__PURE__ */ ue.createElement(Fh, null)),
      minusMenuElement: /* @__PURE__ */ ue.createElement(oc, { type: "button" }, /* @__PURE__ */ ue.createElement(Hh, null)),
      inputElement: (v, E, S, w) => w ? /* @__PURE__ */ ue.createElement(nc, { onFocus: Jh, onBlur: Gh }) : /* @__PURE__ */ ue.createElement(
      nc, null),
      fallback: b
    }
  ));
}, "ObjectControl");

// ../addons/docs/src/blocks/controls/Range.tsx
import go, { useMemo as Yh } from "react";
import { styled as ho } from "storybook/theming";
Ne();
var Xh = ho.input(
  ({ theme: e, min: t, max: r, value: o, disabled: n }) => ({
    // Resytled using http://danielstern.ca/range.css/#/
    "&": {
      width: "100%",
      backgroundColor: "transparent",
      appearance: "none"
    },
    "&::-webkit-slider-runnable-track": {
      background: e.base === "light" ? `linear-gradient(to right, 
            ${e.color.green} 0%, ${e.color.green} ${(o - t) / (r - t) * 100}%, 
            ${Le(0.02, e.input.background)} ${(o - t) / (r - t) * 100}%, 
            ${Le(0.02, e.input.background)} 100%)` : `linear-gradient(to right, 
            ${e.color.green} 0%, ${e.color.green} ${(o - t) / (r - t) * 100}%, 
            ${Ke(0.02, e.input.background)} ${(o - t) / (r - t) * 100}%, 
            ${Ke(0.02, e.input.background)} 100%)`,
      boxShadow: `${e.appBorderColor} 0 0 0 1px inset`,
      borderRadius: 6,
      width: "100%",
      height: 6,
      cursor: n ? "not-allowed" : "pointer"
    },
    "&::-webkit-slider-thumb": {
      marginTop: "-6px",
      width: 16,
      height: 16,
      border: `1px solid ${Be(e.appBorderColor, 0.2)}`,
      borderRadius: "50px",
      boxShadow: `0 1px 3px 0px ${Be(e.appBorderColor, 0.2)}`,
      cursor: n ? "not-allowed" : "grab",
      appearance: "none",
      background: `${e.input.background}`,
      transition: "all 150ms ease-out",
      "&:hover": {
        background: `${Le(0.05, e.input.background)}`,
        transform: "scale3d(1.1, 1.1, 1.1) translateY(-1px)",
        transition: "all 50ms ease-out"
      },
      "&:active": {
        background: `${e.input.background}`,
        transform: "scale3d(1, 1, 1) translateY(0px)",
        cursor: n ? "not-allowed" : "grab"
      }
    },
    "&:focus": {
      outline: "none",
      "&::-webkit-slider-runnable-track": {
        borderColor: Be(e.color.secondary, 0.4)
      },
      "&::-webkit-slider-thumb": {
        borderColor: e.color.secondary,
        boxShadow: `0 0px 5px 0px ${e.color.secondary}`
      }
    },
    "&::-moz-range-track": {
      background: e.base === "light" ? `linear-gradient(to right, 
            ${e.color.green} 0%, ${e.color.green} ${(o - t) / (r - t) * 100}%, 
            ${Le(0.02, e.input.background)} ${(o - t) / (r - t) * 100}%, 
            ${Le(0.02, e.input.background)} 100%)` : `linear-gradient(to right, 
            ${e.color.green} 0%, ${e.color.green} ${(o - t) / (r - t) * 100}%, 
            ${Ke(0.02, e.input.background)} ${(o - t) / (r - t) * 100}%, 
            ${Ke(0.02, e.input.background)} 100%)`,
      boxShadow: `${e.appBorderColor} 0 0 0 1px inset`,
      borderRadius: 6,
      width: "100%",
      height: 6,
      cursor: n ? "not-allowed" : "pointer",
      outline: "none"
    },
    "&::-moz-range-thumb": {
      width: 16,
      height: 16,
      border: `1px solid ${Be(e.appBorderColor, 0.2)}`,
      borderRadius: "50px",
      boxShadow: `0 1px 3px 0px ${Be(e.appBorderColor, 0.2)}`,
      cursor: n ? "not-allowed" : "grap",
      background: `${e.input.background}`,
      transition: "all 150ms ease-out",
      "&:hover": {
        background: `${Le(0.05, e.input.background)}`,
        transform: "scale3d(1.1, 1.1, 1.1) translateY(-1px)",
        transition: "all 50ms ease-out"
      },
      "&:active": {
        background: `${e.input.background}`,
        transform: "scale3d(1, 1, 1) translateY(0px)",
        cursor: "grabbing"
      }
    },
    "&::-ms-track": {
      background: e.base === "light" ? `linear-gradient(to right, 
            ${e.color.green} 0%, ${e.color.green} ${(o - t) / (r - t) * 100}%, 
            ${Le(0.02, e.input.background)} ${(o - t) / (r - t) * 100}%, 
            ${Le(0.02, e.input.background)} 100%)` : `linear-gradient(to right, 
            ${e.color.green} 0%, ${e.color.green} ${(o - t) / (r - t) * 100}%, 
            ${Ke(0.02, e.input.background)} ${(o - t) / (r - t) * 100}%, 
            ${Ke(0.02, e.input.background)} 100%)`,
      boxShadow: `${e.appBorderColor} 0 0 0 1px inset`,
      color: "transparent",
      width: "100%",
      height: "6px",
      cursor: "pointer"
    },
    "&::-ms-fill-lower": {
      borderRadius: 6
    },
    "&::-ms-fill-upper": {
      borderRadius: 6
    },
    "&::-ms-thumb": {
      width: 16,
      height: 16,
      background: `${e.input.background}`,
      border: `1px solid ${Be(e.appBorderColor, 0.2)}`,
      borderRadius: 50,
      cursor: "grab",
      marginTop: 0
    },
    "@supports (-ms-ime-align:auto)": { "input[type=range]": { margin: "0" } }
  })
), ac = ho.span({
  paddingLeft: 5,
  paddingRight: 5,
  fontSize: 12,
  whiteSpace: "nowrap",
  fontFeatureSettings: "tnum",
  fontVariantNumeric: "tabular-nums",
  "[aria-readonly=true] &": {
    opacity: 0.5
  }
}), Zh = ho(ac)(({ numberOFDecimalsPlaces: e, max: t }) => ({
  // Fixed width of "current / max" label to avoid slider width changes
  // 3 = size of separator " / "
  width: `${e + t.toString().length * 2 + 3}ch`,
  textAlign: "right",
  flexShrink: 0
})), Qh = ho.div({
  display: "flex",
  alignItems: "center",
  width: "100%"
});
function ey(e) {
  let t = e.toString().match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  return t ? Math.max(
    0,
    // Number of digits right of decimal point.
    (t[1] ? t[1].length : 0) - // Adjust for scientific notation.
    (t[2] ? +t[2] : 0)
  ) : 0;
}
a(ey, "getNumberOfDecimalPlaces");
var ic = /* @__PURE__ */ a(({
  name: e,
  value: t,
  onChange: r,
  min: o = 0,
  max: n = 100,
  step: i = 1,
  onBlur: s,
  onFocus: l,
  argType: c
}) => {
  let u = /* @__PURE__ */ a((m) => {
    r(Ll(m.target.value));
  }, "handleChange"), d = t !== void 0, g = Yh(() => ey(i), [i]), p = !!c?.table?.readonly;
  return /* @__PURE__ */ go.createElement(Qh, { "aria-readonly": p }, /* @__PURE__ */ go.createElement(ac, null, o), /* @__PURE__ */ go.createElement(
    Xh,
    {
      id: X(e),
      type: "range",
      disabled: p,
      onChange: u,
      name: e,
      min: o,
      max: n,
      step: i,
      onFocus: l,
      onBlur: s,
      value: t ?? o
    }
  ), /* @__PURE__ */ go.createElement(Zh, { numberOFDecimalsPlaces: g, max: n }, d ? t.toFixed(g) : "--", " / ", n));
}, "RangeControl");

// ../addons/docs/src/blocks/controls/Text.tsx
Ne();
import yo, { useCallback as ty, useState as ry } from "react";
import { Button as oy, Form as ny } from "storybook/internal/components";
import { styled as sc } from "storybook/theming";
var ay = sc.label({
  display: "flex"
}), iy = sc.div(({ isMaxed: e }) => ({
  marginLeft: "0.75rem",
  paddingTop: "0.35rem",
  color: e ? "red" : void 0
})), lc = /* @__PURE__ */ a(({
  name: e,
  value: t,
  onChange: r,
  onFocus: o,
  onBlur: n,
  maxLength: i,
  argType: s
}) => {
  let l = /* @__PURE__ */ a((m) => {
    r(m.target.value);
  }, "handleChange"), c = !!s?.table?.readonly, [u, d] = ry(!1), g = ty(() => {
    r(""), d(!0);
  }, [d]);
  if (t === void 0)
    return /* @__PURE__ */ yo.createElement(
      oy,
      {
        variant: "outline",
        size: "medium",
        disabled: c,
        id: ct(e),
        onClick: g
      },
      "Set string"
    );
  let p = typeof t == "string";
  return /* @__PURE__ */ yo.createElement(ay, null, /* @__PURE__ */ yo.createElement(
    ny.Textarea,
    {
      id: X(e),
      maxLength: i,
      onChange: l,
      disabled: c,
      size: "flex",
      placeholder: "Edit string...",
      autoFocus: u,
      valid: p ? void 0 : "error",
      name: e,
      value: p ? t : "",
      onFocus: o,
      onBlur: n
    }
  ), i && /* @__PURE__ */ yo.createElement(iy, { isMaxed: t?.length === i }, t?.length ?? 0, " / ", i));
}, "TextControl");

// ../addons/docs/src/blocks/controls/Files.tsx
Ne();
import sy, { useEffect as ly, useRef as cy } from "react";
import { Form as py } from "storybook/internal/components";
import { styled as uy } from "storybook/theming";
var dy = uy(py.Input)({
  padding: 10
});
function fy(e) {
  e.forEach((t) => {
    t.startsWith("blob:") && URL.revokeObjectURL(t);
  });
}
a(fy, "revokeOldUrls");
var cc = /* @__PURE__ */ a(({
  onChange: e,
  name: t,
  accept: r = "image/*",
  value: o,
  argType: n
}) => {
  let i = cy(null), s = n?.control?.readOnly;
  function l(c) {
    if (!c.target.files)
      return;
    let u = Array.from(c.target.files).map((d) => URL.createObjectURL(d));
    e(u), fy(o || []);
  }
  return a(l, "handleFileChange"), ly(() => {
    o == null && i.current && (i.current.value = "");
  }, [o, t]), /* @__PURE__ */ sy.createElement(
    dy,
    {
      ref: i,
      id: X(t),
      type: "file",
      name: t,
      multiple: !0,
      disabled: s,
      onChange: l,
      accept: r,
      size: "flex"
    }
  );
}, "FilesControl");

// ../addons/docs/src/blocks/controls/index.tsx
var hb = gb(() => Promise.resolve().then(() => (zc(), Vc))), Uc = /* @__PURE__ */ a((e) => /* @__PURE__ */ xa.createElement(mb, { fallback: /* @__PURE__ */ xa.
createElement("div", null) }, /* @__PURE__ */ xa.createElement(hb, { ...e })), "ColorControl");

// ../addons/docs/src/blocks/components/ArgsTable/ArgControl.tsx
var xb = {
  array: sa,
  object: sa,
  boolean: Cl,
  color: Uc,
  date: kl,
  number: Nl,
  check: At,
  "inline-check": At,
  radio: At,
  "inline-radio": At,
  select: At,
  "multi-select": At,
  range: ic,
  text: lc,
  file: cc
}, Wc = /* @__PURE__ */ a(() => /* @__PURE__ */ hr.createElement(hr.Fragment, null, "-"), "NoControl"), Gc = /* @__PURE__ */ a(({ row: e, arg: t,
updateArgs: r, isHovered: o }) => {
  let { key: n, control: i } = e, [s, l] = qc(!1), [c, u] = qc({ value: t });
  yb(() => {
    s || u({ value: t });
  }, [s, t]);
  let d = va(
    (y) => (u({ value: y }), r({ [n]: y }), y),
    [r, n]
  ), g = va(() => l(!1), []), p = va(() => l(!0), []);
  if (!i || i.disable) {
    let y = i?.disable !== !0 && e?.type?.name !== "function";
    return o && y ? /* @__PURE__ */ hr.createElement(
      bb,
      {
        href: "https://storybook.js.org/docs/essentials/controls?ref=ui",
        target: "_blank",
        withArrow: !0
      },
      "Setup controls"
    ) : /* @__PURE__ */ hr.createElement(Wc, null);
  }
  let m = { name: n, argType: e, value: c.value, onChange: d, onBlur: g, onFocus: p }, f = xb[i.type] || Wc;
  return /* @__PURE__ */ hr.createElement(f, { ...m, ...i, controlType: i.type });
}, "ArgControl");

// ../addons/docs/src/blocks/components/ArgsTable/ArgJsDoc.tsx
import ye from "react";
import { codeCommon as vb } from "storybook/internal/components";
import { styled as Eb } from "storybook/theming";
var Sb = Eb.table(({ theme: e }) => ({
  "&&": {
    // Escape default table styles
    borderCollapse: "collapse",
    borderSpacing: 0,
    border: "none",
    tr: {
      border: "none !important",
      background: "none"
    },
    "td, th": {
      padding: 0,
      border: "none",
      width: "auto!important"
    },
    // End escape
    marginTop: 0,
    marginBottom: 0,
    "th:first-of-type, td:first-of-type": {
      paddingLeft: 0
    },
    "th:last-of-type, td:last-of-type": {
      paddingRight: 0
    },
    td: {
      paddingTop: 0,
      paddingBottom: 4,
      "&:not(:first-of-type)": {
        paddingLeft: 10,
        paddingRight: 0
      }
    },
    tbody: {
      boxShadow: "none",
      border: "none"
    },
    code: vb({ theme: e }),
    div: {
      span: {
        fontWeight: "bold"
      }
    },
    "& code": {
      margin: 0,
      display: "inline-block",
      fontSize: e.typography.size.s1
    }
  }
})), Jc = /* @__PURE__ */ a(({ tags: e }) => {
  let t = (e.params || []).filter((i) => i.description), r = t.length !== 0, o = e.deprecated != null, n = e.returns != null && e.returns.description !=
  null;
  return !r && !n && !o ? null : /* @__PURE__ */ ye.createElement(ye.Fragment, null, /* @__PURE__ */ ye.createElement(Sb, null, /* @__PURE__ */ ye.
  createElement("tbody", null, o && /* @__PURE__ */ ye.createElement("tr", { key: "deprecated" }, /* @__PURE__ */ ye.createElement("td", { colSpan: 2 },
  /* @__PURE__ */ ye.createElement("strong", null, "Deprecated"), ": ", e.deprecated?.toString())), r && t.map((i) => /* @__PURE__ */ ye.createElement(
  "tr", { key: i.name }, /* @__PURE__ */ ye.createElement("td", null, /* @__PURE__ */ ye.createElement("code", null, i.name)), /* @__PURE__ */ ye.
  createElement("td", null, i.description))), n && /* @__PURE__ */ ye.createElement("tr", { key: "returns" }, /* @__PURE__ */ ye.createElement(
  "td", null, /* @__PURE__ */ ye.createElement("code", null, "Returns")), /* @__PURE__ */ ye.createElement("td", null, e.returns?.description)))));
}, "ArgJsDoc");

// ../addons/docs/src/blocks/components/ArgsTable/ArgValue.tsx
or();
var tp = Ee(Yc());
import de, { useState as Xc } from "react";
import { SyntaxHighlighter as Cb, WithTooltipPure as wb, codeCommon as ep } from "storybook/internal/components";
import { ChevronSmallDownIcon as Tb, ChevronSmallUpIcon as Ab } from "@storybook/icons";
import { styled as It } from "storybook/theming";
var Sa = 8, Zc = It.div(({ isExpanded: e }) => ({
  display: "flex",
  flexDirection: e ? "column" : "row",
  flexWrap: "wrap",
  alignItems: "flex-start",
  marginBottom: "-4px",
  minWidth: 100
})), kb = It.span(ep, ({ theme: e, simple: t = !1 }) => ({
  flex: "0 0 auto",
  fontFamily: e.typography.fonts.mono,
  fontSize: e.typography.size.s1,
  wordBreak: "break-word",
  whiteSpace: "normal",
  maxWidth: "100%",
  margin: 0,
  marginRight: "4px",
  marginBottom: "4px",
  paddingTop: "2px",
  paddingBottom: "2px",
  lineHeight: "13px",
  ...t && {
    background: "transparent",
    border: "0 none",
    paddingLeft: 0
  }
})), Ob = It.button(({ theme: e }) => ({
  fontFamily: e.typography.fonts.mono,
  color: e.color.secondary,
  marginBottom: "4px",
  background: "none",
  border: "none"
})), Ib = It.div(ep, ({ theme: e }) => ({
  fontFamily: e.typography.fonts.mono,
  color: e.color.secondary,
  fontSize: e.typography.size.s1,
  // overrides codeCommon
  margin: 0,
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center"
})), Pb = It.div(({ theme: e, width: t }) => ({
  width: t,
  minWidth: 200,
  maxWidth: 800,
  padding: 15,
  // Don't remove the mono fontFamily here even if it seems useless, this is used by the browser to calculate the length of a "ch" unit.
  fontFamily: e.typography.fonts.mono,
  fontSize: e.typography.size.s1,
  // Most custom stylesheet will reset the box-sizing to "border-box" and will break the tooltip.
  boxSizing: "content-box",
  "& code": {
    padding: "0 !important"
  }
})), Lb = It(Ab)({
  marginLeft: 4
}), Nb = It(Tb)({
  marginLeft: 4
}), _b = /* @__PURE__ */ a(() => /* @__PURE__ */ de.createElement("span", null, "-"), "EmptyArg"), rp = /* @__PURE__ */ a(({ text: e, simple: t }) => /* @__PURE__ */ de.
createElement(kb, { simple: t }, e), "ArgText"), Db = (0, tp.default)(1e3)((e) => {
  let t = e.split(/\r?\n/);
  return `${Math.max(...t.map((r) => r.length))}ch`;
}), Mb = /* @__PURE__ */ a((e) => {
  if (!e)
    return [e];
  let r = e.split("|").map((o) => o.trim());
  return yn(r);
}, "getSummaryItems"), Qc = /* @__PURE__ */ a((e, t = !0) => {
  let r = e;
  return t || (r = e.slice(0, Sa)), r.map((o) => /* @__PURE__ */ de.createElement(rp, { key: o, text: o === "" ? '""' : o }));
}, "renderSummaryItems"), Bb = /* @__PURE__ */ a(({ value: e, initialExpandedArgs: t }) => {
  let { summary: r, detail: o } = e, [n, i] = Xc(!1), [s, l] = Xc(t || !1);
  if (r == null)
    return null;
  let c = typeof r.toString == "function" ? r.toString() : r;
  if (o == null) {
    if (/[(){}[\]<>]/.test(c))
      return /* @__PURE__ */ de.createElement(rp, { text: c });
    let d = Mb(c), g = d.length;
    return g > Sa ? /* @__PURE__ */ de.createElement(Zc, { isExpanded: s }, Qc(d, s), /* @__PURE__ */ de.createElement(Ob, { onClick: () => l(
    !s) }, s ? "Show less..." : `Show ${g - Sa} more...`)) : /* @__PURE__ */ de.createElement(Zc, null, Qc(d));
  }
  return /* @__PURE__ */ de.createElement(
    wb,
    {
      closeOnOutsideClick: !0,
      placement: "bottom",
      visible: n,
      onVisibleChange: (u) => {
        i(u);
      },
      tooltip: /* @__PURE__ */ de.createElement(Pb, { width: Db(o) }, /* @__PURE__ */ de.createElement(Cb, { language: "jsx", format: !1 }, o))
    },
    /* @__PURE__ */ de.createElement(Ib, { className: "sbdocs-expandable" }, /* @__PURE__ */ de.createElement("span", null, c), n ? /* @__PURE__ */ de.
    createElement(Lb, null) : /* @__PURE__ */ de.createElement(Nb, null))
  );
}, "ArgSummary"), Ao = /* @__PURE__ */ a(({ value: e, initialExpandedArgs: t }) => e == null ? /* @__PURE__ */ de.createElement(_b, null) : /* @__PURE__ */ de.
createElement(Bb, { value: e, initialExpandedArgs: t }), "ArgValue");

// ../addons/docs/src/blocks/components/ArgsTable/ArgRow.tsx
var jb = Jt.span({ fontWeight: "bold" }), Hb = Jt.span(({ theme: e }) => ({
  color: e.color.negative,
  fontFamily: e.typography.fonts.mono,
  cursor: "help"
})), $b = Jt.div(({ theme: e }) => ({
  "&&": {
    p: {
      margin: "0 0 10px 0"
    },
    a: {
      color: e.color.secondary
    }
  },
  code: {
    ...Rb({ theme: e }),
    fontSize: 12,
    fontFamily: e.typography.fonts.mono
  },
  "& code": {
    margin: 0,
    display: "inline-block"
  },
  "& pre > code": {
    whiteSpace: "pre-wrap"
  }
})), Vb = Jt.div(({ theme: e, hasDescription: t }) => ({
  color: e.base === "light" ? B(0.1, e.color.defaultText) : B(0.2, e.color.defaultText),
  marginTop: t ? 4 : 0
})), zb = Jt.div(({ theme: e, hasDescription: t }) => ({
  color: e.base === "light" ? B(0.1, e.color.defaultText) : B(0.2, e.color.defaultText),
  marginTop: t ? 12 : 0,
  marginBottom: 12
})), Ub = Jt.td(({ expandable: e }) => ({
  paddingLeft: e ? "40px !important" : "20px !important"
})), qb = /* @__PURE__ */ a((e) => e && { summary: typeof e == "string" ? e : e.name }, "toSummary"), yr = /* @__PURE__ */ a((e) => {
  let [t, r] = Fb(!1), { row: o, updateArgs: n, compact: i, expandable: s, initialExpandedArgs: l } = e, { name: c, description: u } = o, d = o.
  table || {}, g = d.type || qb(o.type), p = d.defaultValue || o.defaultValue, m = o.type?.required, f = u != null && u !== "";
  return /* @__PURE__ */ ie.createElement("tr", { onMouseEnter: () => r(!0), onMouseLeave: () => r(!1) }, /* @__PURE__ */ ie.createElement(Ub,
  { expandable: s ?? !1 }, /* @__PURE__ */ ie.createElement(jb, null, c), m ? /* @__PURE__ */ ie.createElement(Hb, { title: "Required" }, "*") :
  null), i ? null : /* @__PURE__ */ ie.createElement("td", null, f && /* @__PURE__ */ ie.createElement($b, null, /* @__PURE__ */ ie.createElement(
  Sl, null, u)), d.jsDocTags != null ? /* @__PURE__ */ ie.createElement(ie.Fragment, null, /* @__PURE__ */ ie.createElement(zb, { hasDescription: f },
  /* @__PURE__ */ ie.createElement(Ao, { value: g, initialExpandedArgs: l })), /* @__PURE__ */ ie.createElement(Jc, { tags: d.jsDocTags })) :
  /* @__PURE__ */ ie.createElement(Vb, { hasDescription: f }, /* @__PURE__ */ ie.createElement(Ao, { value: g, initialExpandedArgs: l }))), i ?
  null : /* @__PURE__ */ ie.createElement("td", null, /* @__PURE__ */ ie.createElement(Ao, { value: p, initialExpandedArgs: l })), n ? /* @__PURE__ */ ie.
  createElement("td", null, /* @__PURE__ */ ie.createElement(Gc, { ...e, isHovered: t })) : null);
}, "ArgRow");

// ../addons/docs/src/blocks/components/ArgsTable/Empty.tsx
import je, { useEffect as Wb, useState as Gb } from "react";
import { EmptyTabContent as Jb, Link as op } from "storybook/internal/components";
import { DocumentIcon as np } from "@storybook/icons";
import { styled as ap } from "storybook/theming";
var Kb = ap.div(({ inAddonPanel: e, theme: t }) => ({
  height: e ? "100%" : "auto",
  display: "flex",
  border: e ? "none" : `1px solid ${t.appBorderColor}`,
  borderRadius: e ? 0 : t.appBorderRadius,
  padding: e ? 0 : 40,
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  gap: 15,
  background: t.background.content
})), Yb = ap.div(({ theme: e }) => ({
  display: "flex",
  fontSize: e.typography.size.s2 - 1,
  gap: 25
})), ip = /* @__PURE__ */ a(({ inAddonPanel: e }) => {
  let [t, r] = Gb(!0);
  return Wb(() => {
    let o = setTimeout(() => {
      r(!1);
    }, 100);
    return () => clearTimeout(o);
  }, []), t ? null : /* @__PURE__ */ je.createElement(Kb, { inAddonPanel: e }, /* @__PURE__ */ je.createElement(
    Jb,
    {
      title: e ? "Interactive story playground" : "Args table with interactive controls couldn't be auto-generated",
      description: /* @__PURE__ */ je.createElement(je.Fragment, null, "Controls give you an easy to use interface to test your components. \
Set your story args and you'll see controls appearing here automatically."),
      footer: /* @__PURE__ */ je.createElement(Yb, null, e && /* @__PURE__ */ je.createElement(je.Fragment, null, /* @__PURE__ */ je.createElement(
        op,
        {
          href: "https://storybook.js.org/docs/essentials/controls?ref=ui",
          target: "_blank",
          withArrow: !0
        },
        /* @__PURE__ */ je.createElement(np, null),
        " Read docs"
      )), !e && /* @__PURE__ */ je.createElement(
        op,
        {
          href: "https://storybook.js.org/docs/essentials/controls?ref=ui",
          target: "_blank",
          withArrow: !0
        },
        /* @__PURE__ */ je.createElement(np, null),
        " Learn how to set that up"
      ))
    }
  ));
}, "Empty");

// ../addons/docs/src/blocks/components/ArgsTable/SectionRow.tsx
import qe, { useState as Xb } from "react";
import { ChevronDownIcon as Zb, ChevronRightIcon as Qb } from "@storybook/icons";
import { styled as dt } from "storybook/theming";
var e0 = dt(Zb)(({ theme: e }) => ({
  marginRight: 8,
  marginLeft: -10,
  marginTop: -2,
  // optical alignment
  height: 12,
  width: 12,
  color: e.base === "light" ? B(0.25, e.color.defaultText) : B(0.3, e.color.defaultText),
  border: "none",
  display: "inline-block"
})), t0 = dt(Qb)(({ theme: e }) => ({
  marginRight: 8,
  marginLeft: -10,
  marginTop: -2,
  // optical alignment
  height: 12,
  width: 12,
  color: e.base === "light" ? B(0.25, e.color.defaultText) : B(0.3, e.color.defaultText),
  border: "none",
  display: "inline-block"
})), r0 = dt.span(({ theme: e }) => ({
  display: "flex",
  lineHeight: "20px",
  alignItems: "center"
})), o0 = dt.td(({ theme: e }) => ({
  position: "relative",
  letterSpacing: "0.35em",
  textTransform: "uppercase",
  fontWeight: e.typography.weight.bold,
  fontSize: e.typography.size.s1 - 1,
  color: e.base === "light" ? B(0.4, e.color.defaultText) : B(0.6, e.color.defaultText),
  background: `${e.background.app} !important`,
  "& ~ td": {
    background: `${e.background.app} !important`
  }
})), n0 = dt.td(({ theme: e }) => ({
  position: "relative",
  fontWeight: e.typography.weight.bold,
  fontSize: e.typography.size.s2 - 1,
  background: e.background.app
})), a0 = dt.td({
  position: "relative"
}), i0 = dt.tr(({ theme: e }) => ({
  "&:hover > td": {
    backgroundColor: `${Ke(5e-3, e.background.app)} !important`,
    boxShadow: `${e.color.mediumlight} 0 - 1px 0 0 inset`,
    cursor: "row-resize"
  }
})), sp = dt.button({
  // reset button style
  background: "none",
  border: "none",
  padding: "0",
  font: "inherit",
  // add custom style
  position: "absolute",
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  height: "100%",
  width: "100%",
  color: "transparent",
  cursor: "row-resize !important"
}), ko = /* @__PURE__ */ a(({
  level: e = "section",
  label: t,
  children: r,
  initialExpanded: o = !0,
  colSpan: n = 3
}) => {
  let [i, s] = Xb(o), l = e === "subsection" ? n0 : o0, c = r?.length || 0, u = e === "subsection" ? `${c} item${c !== 1 ? "s" : ""}` : "", d = `${i ?
  "Hide" : "Show"} ${e === "subsection" ? c : t} item${c !== 1 ? "s" : ""}`;
  return /* @__PURE__ */ qe.createElement(qe.Fragment, null, /* @__PURE__ */ qe.createElement(i0, { title: d }, /* @__PURE__ */ qe.createElement(
  l, { colSpan: 1 }, /* @__PURE__ */ qe.createElement(sp, { onClick: (g) => s(!i), tabIndex: 0 }, d), /* @__PURE__ */ qe.createElement(r0, null,
  i ? /* @__PURE__ */ qe.createElement(e0, null) : /* @__PURE__ */ qe.createElement(t0, null), t)), /* @__PURE__ */ qe.createElement(a0, { colSpan: n -
  1 }, /* @__PURE__ */ qe.createElement(
    sp,
    {
      onClick: (g) => s(!i),
      tabIndex: -1,
      style: { outline: "none" }
    },
    d
  ), i ? null : u)), i ? r : null);
}, "SectionRow");

// ../addons/docs/src/blocks/components/ArgsTable/Skeleton.tsx
import M from "react";
import { styled as Io } from "storybook/theming";
var s0 = Io.div(({ theme: e }) => ({
  width: "100%",
  borderSpacing: 0,
  color: e.color.defaultText
})), Oo = Io.div(({ theme: e }) => ({
  display: "flex",
  borderBottom: `1px solid ${e.appBorderColor}`,
  "&:last-child": {
    borderBottom: 0
  }
})), fe = Io.div(
  ({ position: e, theme: t }) => {
    let r = {
      display: "flex",
      flexDirection: "column",
      gap: 5,
      padding: "10px 15px",
      alignItems: "flex-start"
    };
    switch (e) {
      case "first":
        return {
          ...r,
          width: "25%",
          paddingLeft: 20
        };
      case "second":
        return {
          ...r,
          width: "35%"
        };
      case "third":
        return {
          ...r,
          width: "15%"
        };
      case "last":
        return {
          ...r,
          width: "25%",
          paddingRight: 20
        };
    }
  }
), re = Io.div(
  ({ theme: e, width: t, height: r }) => ({
    animation: `${e.animation.glow} 1.5s ease-in-out infinite`,
    background: e.appBorderColor,
    width: t || "100%",
    height: r || 16,
    borderRadius: 3
  })
), lp = /* @__PURE__ */ a(() => /* @__PURE__ */ M.createElement(s0, null, /* @__PURE__ */ M.createElement(Oo, null, /* @__PURE__ */ M.createElement(
fe, { position: "first" }, /* @__PURE__ */ M.createElement(re, { width: "60%" })), /* @__PURE__ */ M.createElement(fe, { position: "second" },
/* @__PURE__ */ M.createElement(re, { width: "30%" })), /* @__PURE__ */ M.createElement(fe, { position: "third" }, /* @__PURE__ */ M.createElement(
re, { width: "60%" })), /* @__PURE__ */ M.createElement(fe, { position: "last" }, /* @__PURE__ */ M.createElement(re, { width: "60%" }))), /* @__PURE__ */ M.
createElement(Oo, null, /* @__PURE__ */ M.createElement(fe, { position: "first" }, /* @__PURE__ */ M.createElement(re, { width: "60%" })), /* @__PURE__ */ M.
createElement(fe, { position: "second" }, /* @__PURE__ */ M.createElement(re, { width: "80%" }), /* @__PURE__ */ M.createElement(re, { width: "\
30%" })), /* @__PURE__ */ M.createElement(fe, { position: "third" }, /* @__PURE__ */ M.createElement(re, { width: "60%" })), /* @__PURE__ */ M.
createElement(fe, { position: "last" }, /* @__PURE__ */ M.createElement(re, { width: "60%" }))), /* @__PURE__ */ M.createElement(Oo, null, /* @__PURE__ */ M.
createElement(fe, { position: "first" }, /* @__PURE__ */ M.createElement(re, { width: "60%" })), /* @__PURE__ */ M.createElement(fe, { position: "\
second" }, /* @__PURE__ */ M.createElement(re, { width: "80%" }), /* @__PURE__ */ M.createElement(re, { width: "30%" })), /* @__PURE__ */ M.
createElement(fe, { position: "third" }, /* @__PURE__ */ M.createElement(re, { width: "60%" })), /* @__PURE__ */ M.createElement(fe, { position: "\
last" }, /* @__PURE__ */ M.createElement(re, { width: "60%" }))), /* @__PURE__ */ M.createElement(Oo, null, /* @__PURE__ */ M.createElement(
fe, { position: "first" }, /* @__PURE__ */ M.createElement(re, { width: "60%" })), /* @__PURE__ */ M.createElement(fe, { position: "second" },
/* @__PURE__ */ M.createElement(re, { width: "80%" }), /* @__PURE__ */ M.createElement(re, { width: "30%" })), /* @__PURE__ */ M.createElement(
fe, { position: "third" }, /* @__PURE__ */ M.createElement(re, { width: "60%" })), /* @__PURE__ */ M.createElement(fe, { position: "last" },
/* @__PURE__ */ M.createElement(re, { width: "60%" })))), "Skeleton");

// ../addons/docs/src/blocks/components/ArgsTable/ArgsTable.tsx
var g0 = Ca.table(({ theme: e, compact: t, inAddonPanel: r }) => ({
  "&&": {
    // Resets for cascading/system styles
    borderSpacing: 0,
    color: e.color.defaultText,
    "td, th": {
      padding: 0,
      border: "none",
      verticalAlign: "top",
      textOverflow: "ellipsis"
    },
    // End Resets
    fontSize: e.typography.size.s2 - 1,
    lineHeight: "20px",
    textAlign: "left",
    width: "100%",
    // Margin collapse
    marginTop: r ? 0 : 25,
    marginBottom: r ? 0 : 40,
    "thead th:first-of-type, td:first-of-type": {
      // intentionally specify thead here
      width: "25%"
    },
    "th:first-of-type, td:first-of-type": {
      paddingLeft: 20
    },
    "th:nth-of-type(2), td:nth-of-type(2)": {
      ...t ? null : {
        // Description column
        width: "35%"
      }
    },
    "td:nth-of-type(3)": {
      ...t ? null : {
        // Defaults column
        width: "15%"
      }
    },
    "th:last-of-type, td:last-of-type": {
      paddingRight: 20,
      ...t ? null : {
        // Controls column
        width: "25%"
      }
    },
    th: {
      color: e.base === "light" ? B(0.25, e.color.defaultText) : B(0.45, e.color.defaultText),
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 15,
      paddingRight: 15
    },
    td: {
      paddingTop: "10px",
      paddingBottom: "10px",
      "&:not(:first-of-type)": {
        paddingLeft: 15,
        paddingRight: 15
      },
      "&:last-of-type": {
        paddingRight: 20
      }
    },
    // Makes border alignment consistent w/other DocBlocks
    marginLeft: r ? 0 : 1,
    marginRight: r ? 0 : 1,
    tbody: {
      // Safari doesn't love shadows on tbody so we need to use a shadow filter. In order to do this,
      // the table cells all need to be solid so they have a background color applied.
      // I wasn't sure what kinds of content go in these tables so I was extra specific with selectors
      // to avoid unexpected surprises.
      ...r ? null : {
        filter: e.base === "light" ? "drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.10))" : "drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.20))"
      },
      "> tr > *": {
        // For filter to work properly, the table cells all need to be opaque.
        background: e.background.content,
        borderTop: `1px solid ${e.appBorderColor}`
      },
      ...r ? null : {
        // This works and I don't know why. :)
        "> tr:first-of-type > *": {
          borderBlockStart: `1px solid ${e.appBorderColor}`
        },
        "> tr:last-of-type > *": {
          borderBlockEnd: `1px solid ${e.appBorderColor}`
        },
        "> tr > *:first-of-type": {
          borderInlineStart: `1px solid ${e.appBorderColor}`
        },
        "> tr > *:last-of-type": {
          borderInlineEnd: `1px solid ${e.appBorderColor}`
        },
        // Thank you, Safari, for making me write code like this.
        "> tr:first-of-type > td:first-of-type": {
          borderTopLeftRadius: e.appBorderRadius
        },
        "> tr:first-of-type > td:last-of-type": {
          borderTopRightRadius: e.appBorderRadius
        },
        "> tr:last-of-type > td:first-of-type": {
          borderBottomLeftRadius: e.appBorderRadius
        },
        "> tr:last-of-type > td:last-of-type": {
          borderBottomRightRadius: e.appBorderRadius
        }
      }
    }
    // End awesome table styling
  }
})), h0 = Ca.div({
  position: "relative"
}), y0 = Ca.div({
  position: "absolute",
  right: 8,
  top: 6
});
var b0 = {
  alpha: /* @__PURE__ */ a((e, t) => (e.name ?? "").localeCompare(t.name ?? ""), "alpha"),
  requiredFirst: /* @__PURE__ */ a((e, t) => +!!t.type?.required - +!!e.type?.required || (e.name ?? "").localeCompare(t.name ?? ""), "requi\
redFirst"),
  none: null
}, x0 = /* @__PURE__ */ a((e, t) => {
  let r = { ungrouped: [], ungroupedSubsections: {}, sections: {} };
  if (!e)
    return r;
  Object.entries(e).forEach(([s, l]) => {
    let { category: c, subcategory: u } = l?.table || {};
    if (c) {
      let d = r.sections[c] || { ungrouped: [], subsections: {} };
      if (!u)
        d.ungrouped.push({ key: s, ...l });
      else {
        let g = d.subsections[u] || [];
        g.push({ key: s, ...l }), d.subsections[u] = g;
      }
      r.sections[c] = d;
    } else if (u) {
      let d = r.ungroupedSubsections[u] || [];
      d.push({ key: s, ...l }), r.ungroupedSubsections[u] = d;
    } else
      r.ungrouped.push({ key: s, ...l });
  });
  let o = b0[t], n = /* @__PURE__ */ a((s) => o ? Object.keys(s).reduce(
    (l, c) => ({
      ...l,
      [c]: s[c].sort(o)
    }),
    {}
  ) : s, "sortSubsection");
  return {
    ungrouped: o ? r.ungrouped.sort(o) : r.ungrouped,
    ungroupedSubsections: n(r.ungroupedSubsections),
    sections: Object.keys(r.sections).reduce(
      (s, l) => ({
        ...s,
        [l]: {
          ungrouped: o ? r.sections[l].ungrouped.sort(o) : r.sections[l].ungrouped,
          subsections: n(r.sections[l].subsections)
        }
      }),
      {}
    )
  };
}, "groupRows"), v0 = /* @__PURE__ */ a((e, t, r) => {
  try {
    return d0(e, t, r);
  } catch (o) {
    return l0.warn(o.message), !1;
  }
}, "safeIncludeConditionalArg"), Nn = /* @__PURE__ */ a((e) => {
  let {
    updateArgs: t,
    resetArgs: r,
    compact: o,
    inAddonPanel: n,
    initialExpandedArgs: i,
    sort: s = "none",
    isLoading: l
  } = e;
  if ("error" in e) {
    let { error: x } = e;
    return /* @__PURE__ */ V.createElement(Yr, null, x, "\xA0", /* @__PURE__ */ V.createElement(p0, { href: "http://storybook.js.org/docs/?r\
ef=ui", target: "_blank", withArrow: !0 }, /* @__PURE__ */ V.createElement(f0, null), " Read the docs"));
  }
  if (l)
    return /* @__PURE__ */ V.createElement(lp, null);
  let { rows: c, args: u, globals: d } = "rows" in e ? e : { rows: void 0, args: void 0, globals: void 0 }, g = x0(
    xn(
      c || {},
      (x) => !x?.table?.disable && v0(x, u || {}, d || {})
    ),
    s
  ), p = g.ungrouped.length === 0, m = Object.entries(g.sections).length === 0, f = Object.entries(g.ungroupedSubsections).length === 0;
  if (p && m && f)
    return /* @__PURE__ */ V.createElement(ip, { inAddonPanel: n });
  let y = 1;
  t && (y += 1), o || (y += 2);
  let h = Object.keys(g.sections).length > 0, b = { updateArgs: t, compact: o, inAddonPanel: n, initialExpandedArgs: i };
  return /* @__PURE__ */ V.createElement(u0, null, /* @__PURE__ */ V.createElement(h0, null, t && !l && r && /* @__PURE__ */ V.createElement(
  y0, null, /* @__PURE__ */ V.createElement(
    c0,
    {
      onClick: () => r(),
      "aria-label": "Reset controls",
      title: "Reset controls"
    },
    /* @__PURE__ */ V.createElement(m0, null)
  )), /* @__PURE__ */ V.createElement(g0, { compact: o, inAddonPanel: n, className: "docblock-argstable sb-unstyled" }, /* @__PURE__ */ V.createElement(
  "thead", { className: "docblock-argstable-head" }, /* @__PURE__ */ V.createElement("tr", null, /* @__PURE__ */ V.createElement("th", null,
  /* @__PURE__ */ V.createElement("span", null, "Name")), o ? null : /* @__PURE__ */ V.createElement("th", null, /* @__PURE__ */ V.createElement(
  "span", null, "Description")), o ? null : /* @__PURE__ */ V.createElement("th", null, /* @__PURE__ */ V.createElement("span", null, "Defau\
lt")), t ? /* @__PURE__ */ V.createElement("th", null, /* @__PURE__ */ V.createElement("span", null, "Control")) : null)), /* @__PURE__ */ V.
  createElement("tbody", { className: "docblock-argstable-body" }, g.ungrouped.map((x) => /* @__PURE__ */ V.createElement(yr, { key: x.key, row: x,
  arg: u && u[x.key], ...b })), Object.entries(g.ungroupedSubsections).map(([x, v]) => /* @__PURE__ */ V.createElement(
    ko,
    {
      key: x,
      label: x,
      level: "subsection",
      colSpan: y
    },
    v.map((E) => /* @__PURE__ */ V.createElement(
      yr,
      {
        key: E.key,
        row: E,
        arg: u && u[E.key],
        expandable: h,
        ...b
      }
    ))
  )), Object.entries(g.sections).map(([x, v]) => /* @__PURE__ */ V.createElement(ko, { key: x, label: x, level: "section", colSpan: y }, v.ungrouped.
  map((E) => /* @__PURE__ */ V.createElement(yr, { key: E.key, row: E, arg: u && u[E.key], ...b })), Object.entries(v.subsections).map(([E, S]) => /* @__PURE__ */ V.
  createElement(
    ko,
    {
      key: E,
      label: E,
      level: "subsection",
      colSpan: y
    },
    S.map((w) => /* @__PURE__ */ V.createElement(
      yr,
      {
        key: w.key,
        row: w,
        arg: u && u[w.key],
        expandable: h,
        ...b
      }
    ))
  ))))))));
}, "ArgsTable");

// src/controls/constants.ts
var br = "addon-controls", Po = "controls";

// src/controls/components/SaveStory.tsx
import R from "react";
import {
  Bar as E0,
  Button as cp,
  Form as pp,
  IconButton as wa,
  Modal as ft,
  TooltipNote as Ta,
  WithTooltip as Aa
} from "storybook/internal/components";
import { AddIcon as S0, CheckIcon as C0, UndoIcon as w0 } from "@storybook/icons";
import { keyframes as up, styled as Kt } from "storybook/theming";
var T0 = up({
  from: { transform: "translateY(40px)" },
  to: { transform: "translateY(0)" }
}), A0 = up({
  from: { background: "var(--highlight-bg-color)" },
  to: {}
}), k0 = Kt.div({
  containerType: "size",
  position: "sticky",
  bottom: 0,
  height: 39,
  overflow: "hidden",
  zIndex: 1
}), O0 = Kt(E0)(({ theme: e }) => ({
  "--highlight-bg-color": e.base === "dark" ? "#153B5B" : "#E0F0FF",
  display: "flex",
  flexDirection: "row-reverse",
  // hide Info rather than Actions on overflow
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 6,
  padding: "6px 10px",
  animation: `${T0} 300ms, ${A0} 2s`,
  background: e.background.bar,
  borderTop: `1px solid ${e.appBorderColor}`,
  fontSize: e.typography.size.s2,
  "@container (max-width: 799px)": {
    flexDirection: "row",
    justifyContent: "flex-end"
  }
})), I0 = Kt.div({
  display: "flex",
  flex: "99 0 auto",
  alignItems: "center",
  marginLeft: 10,
  gap: 6
}), P0 = Kt.div(({ theme: e }) => ({
  display: "flex",
  flex: "1 0 0",
  alignItems: "center",
  gap: 2,
  color: e.color.mediumdark,
  fontSize: e.typography.size.s2
})), ka = Kt.div({
  "@container (max-width: 799px)": {
    lineHeight: 0,
    textIndent: "-9999px",
    "&::after": {
      content: "attr(data-short-label)",
      display: "block",
      lineHeight: "initial",
      textIndent: "0"
    }
  }
}), L0 = Kt(pp.Input)(({ theme: e }) => ({
  "::placeholder": {
    color: e.color.mediumdark
  },
  "&:invalid:not(:placeholder-shown)": {
    boxShadow: `${e.color.negative} 0 0 0 1px inset`
  }
})), dp = /* @__PURE__ */ a(({
  saveStory: e,
  createStory: t,
  resetArgs: r,
  portalSelector: o
}) => {
  let n = R.useRef(null), [i, s] = R.useState(!1), [l, c] = R.useState(!1), [u, d] = R.useState(""), [g, p] = R.useState(null), m = /* @__PURE__ */ a(
  async () => {
    i || (s(!0), await e().catch(() => {
    }), s(!1));
  }, "onSaveStory"), f = /* @__PURE__ */ a(() => {
    c(!0), d(""), setTimeout(() => n.current?.focus(), 0);
  }, "onShowForm"), y = /* @__PURE__ */ a((b) => {
    let x = b.target.value.replace(/^[^a-z]/i, "").replace(/[^a-z0-9-_ ]/gi, "").replaceAll(/([-_ ]+[a-z0-9])/gi, (v) => v.toUpperCase().replace(
    /[-_ ]/g, ""));
    d(x.charAt(0).toUpperCase() + x.slice(1));
  }, "onChange");
  return /* @__PURE__ */ R.createElement(k0, { id: "save-from-controls" }, /* @__PURE__ */ R.createElement(O0, null, /* @__PURE__ */ R.createElement(
  P0, null, /* @__PURE__ */ R.createElement(
    Aa,
    {
      as: "div",
      hasChrome: !1,
      trigger: "hover",
      tooltip: /* @__PURE__ */ R.createElement(Ta, { note: "Save changes to story" })
    },
    /* @__PURE__ */ R.createElement(wa, { "aria-label": "Save changes to story", disabled: i, onClick: m }, /* @__PURE__ */ R.createElement(
    C0, null), /* @__PURE__ */ R.createElement(ka, { "data-short-label": "Save" }, "Update story"))
  ), /* @__PURE__ */ R.createElement(
    Aa,
    {
      as: "div",
      hasChrome: !1,
      trigger: "hover",
      tooltip: /* @__PURE__ */ R.createElement(Ta, { note: "Create new story with these settings" })
    },
    /* @__PURE__ */ R.createElement(wa, { "aria-label": "Create new story with these settings", onClick: f }, /* @__PURE__ */ R.createElement(
    S0, null), /* @__PURE__ */ R.createElement(ka, { "data-short-label": "New" }, "Create new story"))
  ), /* @__PURE__ */ R.createElement(
    Aa,
    {
      as: "div",
      hasChrome: !1,
      trigger: "hover",
      tooltip: /* @__PURE__ */ R.createElement(Ta, { note: "Reset changes" })
    },
    /* @__PURE__ */ R.createElement(wa, { "aria-label": "Reset changes", onClick: () => r() }, /* @__PURE__ */ R.createElement(w0, null), /* @__PURE__ */ R.
    createElement("span", null, "Reset"))
  )), /* @__PURE__ */ R.createElement(I0, null, /* @__PURE__ */ R.createElement(ka, { "data-short-label": "Unsaved changes" }, "You modified\
 this story. Do you want to save your changes?")), /* @__PURE__ */ R.createElement(
    ft,
    {
      width: 350,
      open: l,
      onOpenChange: c,
      portalSelector: o
    },
    /* @__PURE__ */ R.createElement(pp, { onSubmit: /* @__PURE__ */ a(async (b) => {
      if (b.preventDefault(), !i)
        try {
          p(null), s(!0), await t(u.replace(/^[^a-z]/i, "").replaceAll(/[^a-z0-9]/gi, "")), c(!1), s(!1);
        } catch (x) {
          p(x.message), s(!1);
        }
    }, "onSubmitForm"), id: "create-new-story-form" }, /* @__PURE__ */ R.createElement(ft.Content, null, /* @__PURE__ */ R.createElement(ft.
    Header, null, /* @__PURE__ */ R.createElement(ft.Title, null, "Create new story"), /* @__PURE__ */ R.createElement(ft.Description, null,
    "This will add a new story to your existing stories file.")), /* @__PURE__ */ R.createElement(
      L0,
      {
        onChange: y,
        placeholder: "Story export name",
        readOnly: i,
        ref: n,
        value: u
      }
    ), /* @__PURE__ */ R.createElement(ft.Actions, null, /* @__PURE__ */ R.createElement(cp, { disabled: i || !u, size: "medium", type: "sub\
mit", variant: "solid" }, "Create"), /* @__PURE__ */ R.createElement(ft.Dialog.Close, { asChild: !0 }, /* @__PURE__ */ R.createElement(cp, {
    disabled: i, size: "medium", type: "reset" }, "Cancel"))))),
    g && /* @__PURE__ */ R.createElement(ft.Error, null, g)
  )));
}, "SaveStory");

// src/controls/components/ControlsPanel.tsx
var fp = /* @__PURE__ */ a((e) => Object.entries(e).reduce(
  (t, [r, o]) => o !== void 0 ? Object.assign(t, { [r]: o }) : t,
  {}
), "clean"), V0 = $0.div({
  display: "grid",
  gridTemplateRows: "1fr 39px",
  height: "100%",
  maxHeight: "100vh",
  overflowY: "auto"
}), mp = /* @__PURE__ */ a(({ saveStory: e, createStory: t }) => {
  let [r, o] = D0(!0), [n, i, s, l] = F0(), [c] = R0(), u = B0(), {
    expanded: d,
    sort: g,
    presetColors: p,
    disableSaveFromUI: m = !1
  } = j0(Po, {}), { path: f, previewInitialized: y } = H0();
  N0(() => {
    y && o(!1);
  }, [y]);
  let h = Object.values(u).some((v) => v?.control), b = Object.entries(u).reduce((v, [E, S]) => {
    let w = S?.control;
    return typeof w != "object" || w?.type !== "color" || w?.presetColors ? v[E] = S : v[E] = { ...S, control: { ...w, presetColors: p } }, v;
  }, {}), x = _0(
    () => !!n && !!l && !ze(fp(n), fp(l)),
    [n, l]
  );
  return /* @__PURE__ */ Oa.createElement(V0, null, /* @__PURE__ */ Oa.createElement(
    Nn,
    {
      key: f,
      compact: !d && h,
      rows: b,
      args: n,
      globals: c,
      updateArgs: i,
      resetArgs: s,
      inAddonPanel: !0,
      sort: g,
      isLoading: r
    }
  ), h && x && M0.CONFIG_TYPE === "DEVELOPMENT" && m !== !0 && /* @__PURE__ */ Oa.createElement(dp, { resetArgs: s, saveStory: e, createStory: t }));
}, "ControlsPanel");

// src/controls/components/Title.tsx
import Ia from "react";
import { Badge as z0 } from "storybook/internal/components";
import { useArgTypes as U0, useStorybookApi as q0 } from "storybook/manager-api";
function gp() {
  let t = q0().getSelectedPanel(), r = U0(), o = Object.values(r).filter(
    (i) => i?.control && !i?.table?.disable
  ).length;
  return /* @__PURE__ */ Ia.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ Ia.createElement(
  "span", null, "Controls"), o === 0 ? null : /* @__PURE__ */ Ia.createElement(z0, { compact: !0, status: t === br ? "active" : "neutral" },
  o));
}
a(gp, "Title");

// src/controls/stringifyArgs.tsx
var Pa = /* @__PURE__ */ a((e) => JSON.stringify(e, (t, r) => typeof r == "function" ? "__sb_empty_function_arg__" : r), "stringifyArgs");

// src/controls/manager.tsx
var xp = Na.register(br, (e) => {
  if (globalThis?.FEATURES?.controls) {
    let t = Na.getChannel(), r = /* @__PURE__ */ a(async () => {
      let n = e.getCurrentStoryData();
      if (n.type !== "story")
        throw new Error("Not a story");
      try {
        let i = await bp(t, hp, La, {
          // Only send updated args
          args: Pa(
            Object.entries(n.args || {}).reduce((s, [l, c]) => (ze(c, n.initialArgs?.[l]) || (s[l] = c), s), {})
          ),
          csfId: n.id,
          importPath: n.importPath
        });
        e.addNotification({
          id: "save-story-success",
          icon: /* @__PURE__ */ Me.createElement(yp, { color: _a.positive }),
          content: {
            headline: "Story saved",
            subHeadline: /* @__PURE__ */ Me.createElement(Me.Fragment, null, "Updated story ", /* @__PURE__ */ Me.createElement("b", null, i.
            sourceStoryName), ".")
          },
          duration: 8e3
        });
      } catch (i) {
        throw e.addNotification({
          id: "save-story-error",
          icon: /* @__PURE__ */ Me.createElement(G0, { color: _a.negative }),
          content: {
            headline: "Failed to save story",
            subHeadline: i?.message || "Check the Storybook process on the command line for more details."
          },
          duration: 8e3
        }), i;
      }
    }, "saveStory"), o = /* @__PURE__ */ a(async (n) => {
      let i = e.getCurrentStoryData();
      if (i.type !== "story")
        throw new Error("Not a story");
      let s = await bp(t, hp, La, {
        args: i.args && Pa(i.args),
        csfId: i.id,
        importPath: i.importPath,
        name: n
      });
      e.addNotification({
        id: "save-story-success",
        icon: /* @__PURE__ */ Me.createElement(yp, { color: _a.positive }),
        content: {
          headline: "Story created",
          subHeadline: /* @__PURE__ */ Me.createElement(Me.Fragment, null, "Added story ", /* @__PURE__ */ Me.createElement("b", null, s.newStoryName),
          " based on ", /* @__PURE__ */ Me.createElement("b", null, s.sourceStoryName), ".")
        },
        duration: 8e3,
        onClick: /* @__PURE__ */ a(({ onDismiss: l }) => {
          l(), e.selectStory(s.newStoryId);
        }, "onClick")
      });
    }, "createStory");
    Na.add(br, {
      title: gp,
      type: J0.PANEL,
      paramKey: Po,
      render: /* @__PURE__ */ a(({ active: n }) => !n || !e.getCurrentStoryData() ? null : /* @__PURE__ */ Me.createElement(W0, { active: n },
      /* @__PURE__ */ Me.createElement(mp, { saveStory: r, createStory: o })), "render")
    }), t.on(La, (n) => {
      if (!n.success)
        return;
      let i = e.getCurrentStoryData();
      i.type === "story" && (e.resetStoryArgs(i), n.payload.newStoryId && e.selectStory(n.payload.newStoryId));
    });
  }
});

// src/actions/manager.tsx
import u1 from "react";
import { addons as Up, types as d1 } from "storybook/manager-api";

// src/actions/components/Title.tsx
import Da from "react";
import { Badge as K0 } from "storybook/internal/components";
import { STORY_CHANGED as Y0 } from "storybook/internal/core-events";
import { useAddonState as X0, useChannel as Z0, useStorybookApi as Q0 } from "storybook/manager-api";

// src/actions/constants.ts
var vp = "actions", Pt = "storybook/actions", Lo = `${Pt}/panel`, xr = `${Pt}/action-event`, No = `${Pt}/action-clear`;

// src/actions/components/Title.tsx
function Ep() {
  let t = Q0().getSelectedPanel(), [{ count: r }, o] = X0(Pt, { count: 0 });
  return Z0({
    [xr]: () => {
      o((i) => ({ ...i, count: i.count + 1 }));
    },
    [Y0]: () => {
      o((i) => ({ ...i, count: 0 }));
    },
    [No]: () => {
      o((i) => ({ ...i, count: 0 }));
    }
  }), /* @__PURE__ */ Da.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ Da.createElement(
  "span", null, "Actions"), r === 0 ? null : /* @__PURE__ */ Da.createElement(K0, { compact: !0, status: t === Lo ? "active" : "neutral" }, r));
}
a(Ep, "Title");

// src/actions/containers/ActionLogger/index.tsx
import l1, { Component as c1 } from "react";
import { STORY_CHANGED as zp } from "storybook/internal/core-events";

// src/actions/components/ActionLogger/index.tsx
import et, { Fragment as Zx, forwardRef as Qx, useEffect as e1, useRef as t1 } from "react";
import { ActionBar as r1, ScrollArea as o1 } from "storybook/internal/components";

// ../node_modules/react-inspector/dist/index.mjs
import Fa from "react";
import Sr, { useContext as dx, useCallback as fx, useLayoutEffect as mx, useState as gx, memo as Pp } from "react";
import { createContext as hx } from "react";
import mt, { Children as yx, memo as bx } from "react";
import Sp, { createContext as xx, useContext as vx, useMemo as Ex } from "react";
import vr from "react";
import Ax from "react";
import be from "react";
import le from "react";
import Er from "react";
import _o, { useCallback as Tp, useState as Dx } from "react";
import Qe from "react";
import Yt from "react";
import Xt, { useCallback as Ap, useState as Fx } from "react";
import zx from "react";
import oe from "react";
import Ba from "react";
var ex = Object.create, $a = Object.defineProperty, tx = Object.getOwnPropertyDescriptor, Ip = Object.getOwnPropertyNames, rx = Object.getPrototypeOf,
ox = Object.prototype.hasOwnProperty, Va = /* @__PURE__ */ a((e, t) => /* @__PURE__ */ a(function() {
  return t || (0, e[Ip(e)[0]])((t = { exports: {} }).exports, t), t.exports;
}, "__require"), "__commonJS"), nx = /* @__PURE__ */ a((e, t) => {
  for (var r in t)
    $a(e, r, { get: t[r], enumerable: !0 });
}, "__export"), ax = /* @__PURE__ */ a((e, t, r, o) => {
  if (t && typeof t == "object" || typeof t == "function")
    for (let n of Ip(t))
      !ox.call(e, n) && n !== r && $a(e, n, { get: /* @__PURE__ */ a(() => t[n], "get"), enumerable: !(o = tx(t, n)) || o.enumerable });
  return e;
}, "__copyProps"), ix = /* @__PURE__ */ a((e, t, r) => (r = e != null ? ex(rx(e)) : {}, ax(t || !e || !e.__esModule ? $a(r, "default", { value: e,
enumerable: !0 }) : r, e)), "__toESM"), sx = Va({
  "node_modules/is-object/index.js"(e, t) {
    "use strict";
    t.exports = /* @__PURE__ */ a(function(o) {
      return typeof o == "object" && o !== null;
    }, "isObject");
  }
}), lx = Va({
  "node_modules/is-window/index.js"(e, t) {
    "use strict";
    t.exports = function(r) {
      if (r == null)
        return !1;
      var o = Object(r);
      return o === o.window;
    };
  }
}), cx = Va({
  "node_modules/is-dom/index.js"(e, t) {
    var r = sx(), o = lx();
    function n(i) {
      return !r(i) || !o(window) || typeof window.Node != "function" ? !1 : typeof i.nodeType == "number" && typeof i.nodeName == "string";
    }
    a(n, "isNode"), t.exports = n;
  }
}), Bo = {};
nx(Bo, {
  chromeDark: /* @__PURE__ */ a(() => px, "chromeDark"),
  chromeLight: /* @__PURE__ */ a(() => ux, "chromeLight")
});
var px = {
  BASE_FONT_FAMILY: "Menlo, monospace",
  BASE_FONT_SIZE: "11px",
  BASE_LINE_HEIGHT: 1.2,
  BASE_BACKGROUND_COLOR: "rgb(36, 36, 36)",
  BASE_COLOR: "rgb(213, 213, 213)",
  OBJECT_PREVIEW_ARRAY_MAX_PROPERTIES: 10,
  OBJECT_PREVIEW_OBJECT_MAX_PROPERTIES: 5,
  OBJECT_NAME_COLOR: "rgb(227, 110, 236)",
  OBJECT_VALUE_NULL_COLOR: "rgb(127, 127, 127)",
  OBJECT_VALUE_UNDEFINED_COLOR: "rgb(127, 127, 127)",
  OBJECT_VALUE_REGEXP_COLOR: "rgb(233, 63, 59)",
  OBJECT_VALUE_STRING_COLOR: "rgb(233, 63, 59)",
  OBJECT_VALUE_SYMBOL_COLOR: "rgb(233, 63, 59)",
  OBJECT_VALUE_NUMBER_COLOR: "hsl(252, 100%, 75%)",
  OBJECT_VALUE_BOOLEAN_COLOR: "hsl(252, 100%, 75%)",
  OBJECT_VALUE_FUNCTION_PREFIX_COLOR: "rgb(85, 106, 242)",
  HTML_TAG_COLOR: "rgb(93, 176, 215)",
  HTML_TAGNAME_COLOR: "rgb(93, 176, 215)",
  HTML_TAGNAME_TEXT_TRANSFORM: "lowercase",
  HTML_ATTRIBUTE_NAME_COLOR: "rgb(155, 187, 220)",
  HTML_ATTRIBUTE_VALUE_COLOR: "rgb(242, 151, 102)",
  HTML_COMMENT_COLOR: "rgb(137, 137, 137)",
  HTML_DOCTYPE_COLOR: "rgb(192, 192, 192)",
  ARROW_COLOR: "rgb(145, 145, 145)",
  ARROW_MARGIN_RIGHT: 3,
  ARROW_FONT_SIZE: 12,
  ARROW_ANIMATION_DURATION: "0",
  TREENODE_FONT_FAMILY: "Menlo, monospace",
  TREENODE_FONT_SIZE: "11px",
  TREENODE_LINE_HEIGHT: 1.2,
  TREENODE_PADDING_LEFT: 12,
  TABLE_BORDER_COLOR: "rgb(85, 85, 85)",
  TABLE_TH_BACKGROUND_COLOR: "rgb(44, 44, 44)",
  TABLE_TH_HOVER_COLOR: "rgb(48, 48, 48)",
  TABLE_SORT_ICON_COLOR: "black",
  TABLE_DATA_BACKGROUND_IMAGE: "linear-gradient(rgba(255, 255, 255, 0), rgba(255, 255, 255, 0) 50%, rgba(51, 139, 255, 0.0980392) 50%, rgba(\
51, 139, 255, 0.0980392))",
  TABLE_DATA_BACKGROUND_SIZE: "128px 32px"
}, ux = {
  BASE_FONT_FAMILY: "Menlo, monospace",
  BASE_FONT_SIZE: "11px",
  BASE_LINE_HEIGHT: 1.2,
  BASE_BACKGROUND_COLOR: "white",
  BASE_COLOR: "black",
  OBJECT_PREVIEW_ARRAY_MAX_PROPERTIES: 10,
  OBJECT_PREVIEW_OBJECT_MAX_PROPERTIES: 5,
  OBJECT_NAME_COLOR: "rgb(136, 19, 145)",
  OBJECT_VALUE_NULL_COLOR: "rgb(128, 128, 128)",
  OBJECT_VALUE_UNDEFINED_COLOR: "rgb(128, 128, 128)",
  OBJECT_VALUE_REGEXP_COLOR: "rgb(196, 26, 22)",
  OBJECT_VALUE_STRING_COLOR: "rgb(196, 26, 22)",
  OBJECT_VALUE_SYMBOL_COLOR: "rgb(196, 26, 22)",
  OBJECT_VALUE_NUMBER_COLOR: "rgb(28, 0, 207)",
  OBJECT_VALUE_BOOLEAN_COLOR: "rgb(28, 0, 207)",
  OBJECT_VALUE_FUNCTION_PREFIX_COLOR: "rgb(13, 34, 170)",
  HTML_TAG_COLOR: "rgb(168, 148, 166)",
  HTML_TAGNAME_COLOR: "rgb(136, 18, 128)",
  HTML_TAGNAME_TEXT_TRANSFORM: "lowercase",
  HTML_ATTRIBUTE_NAME_COLOR: "rgb(153, 69, 0)",
  HTML_ATTRIBUTE_VALUE_COLOR: "rgb(26, 26, 166)",
  HTML_COMMENT_COLOR: "rgb(35, 110, 37)",
  HTML_DOCTYPE_COLOR: "rgb(192, 192, 192)",
  ARROW_COLOR: "#6e6e6e",
  ARROW_MARGIN_RIGHT: 3,
  ARROW_FONT_SIZE: 12,
  ARROW_ANIMATION_DURATION: "0",
  TREENODE_FONT_FAMILY: "Menlo, monospace",
  TREENODE_FONT_SIZE: "11px",
  TREENODE_LINE_HEIGHT: 1.2,
  TREENODE_PADDING_LEFT: 12,
  TABLE_BORDER_COLOR: "#aaa",
  TABLE_TH_BACKGROUND_COLOR: "#eee",
  TABLE_TH_HOVER_COLOR: "hsla(0, 0%, 90%, 1)",
  TABLE_SORT_ICON_COLOR: "#6e6e6e",
  TABLE_DATA_BACKGROUND_IMAGE: "linear-gradient(to bottom, white, white 50%, rgb(234, 243, 255) 50%, rgb(234, 243, 255))",
  TABLE_DATA_BACKGROUND_SIZE: "128px 32px"
}, Lp = hx([{}, () => {
}]), Ma = {
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  KhtmlUserSelect: "none",
  MozUserSelect: "none",
  msUserSelect: "none",
  OUserSelect: "none",
  userSelect: "none"
}, Do = /* @__PURE__ */ a((e) => ({
  DOMNodePreview: {
    htmlOpenTag: {
      base: {
        color: e.HTML_TAG_COLOR
      },
      tagName: {
        color: e.HTML_TAGNAME_COLOR,
        textTransform: e.HTML_TAGNAME_TEXT_TRANSFORM
      },
      htmlAttributeName: {
        color: e.HTML_ATTRIBUTE_NAME_COLOR
      },
      htmlAttributeValue: {
        color: e.HTML_ATTRIBUTE_VALUE_COLOR
      }
    },
    htmlCloseTag: {
      base: {
        color: e.HTML_TAG_COLOR
      },
      offsetLeft: {
        marginLeft: -e.TREENODE_PADDING_LEFT
      },
      tagName: {
        color: e.HTML_TAGNAME_COLOR,
        textTransform: e.HTML_TAGNAME_TEXT_TRANSFORM
      }
    },
    htmlComment: {
      color: e.HTML_COMMENT_COLOR
    },
    htmlDoctype: {
      color: e.HTML_DOCTYPE_COLOR
    }
  },
  ObjectPreview: {
    objectDescription: {
      fontStyle: "italic"
    },
    preview: {
      fontStyle: "italic"
    },
    arrayMaxProperties: e.OBJECT_PREVIEW_ARRAY_MAX_PROPERTIES,
    objectMaxProperties: e.OBJECT_PREVIEW_OBJECT_MAX_PROPERTIES
  },
  ObjectName: {
    base: {
      color: e.OBJECT_NAME_COLOR
    },
    dimmed: {
      opacity: 0.6
    }
  },
  ObjectValue: {
    objectValueNull: {
      color: e.OBJECT_VALUE_NULL_COLOR
    },
    objectValueUndefined: {
      color: e.OBJECT_VALUE_UNDEFINED_COLOR
    },
    objectValueRegExp: {
      color: e.OBJECT_VALUE_REGEXP_COLOR
    },
    objectValueString: {
      color: e.OBJECT_VALUE_STRING_COLOR
    },
    objectValueSymbol: {
      color: e.OBJECT_VALUE_SYMBOL_COLOR
    },
    objectValueNumber: {
      color: e.OBJECT_VALUE_NUMBER_COLOR
    },
    objectValueBoolean: {
      color: e.OBJECT_VALUE_BOOLEAN_COLOR
    },
    objectValueFunctionPrefix: {
      color: e.OBJECT_VALUE_FUNCTION_PREFIX_COLOR,
      fontStyle: "italic"
    },
    objectValueFunctionName: {
      fontStyle: "italic"
    }
  },
  TreeView: {
    treeViewOutline: {
      padding: 0,
      margin: 0,
      listStyleType: "none"
    }
  },
  TreeNode: {
    treeNodeBase: {
      color: e.BASE_COLOR,
      backgroundColor: e.BASE_BACKGROUND_COLOR,
      lineHeight: e.TREENODE_LINE_HEIGHT,
      cursor: "default",
      boxSizing: "border-box",
      listStyle: "none",
      fontFamily: e.TREENODE_FONT_FAMILY,
      fontSize: e.TREENODE_FONT_SIZE
    },
    treeNodePreviewContainer: {},
    treeNodePlaceholder: {
      whiteSpace: "pre",
      fontSize: e.ARROW_FONT_SIZE,
      marginRight: e.ARROW_MARGIN_RIGHT,
      ...Ma
    },
    treeNodeArrow: {
      base: {
        color: e.ARROW_COLOR,
        display: "inline-block",
        fontSize: e.ARROW_FONT_SIZE,
        marginRight: e.ARROW_MARGIN_RIGHT,
        ...parseFloat(e.ARROW_ANIMATION_DURATION) > 0 ? {
          transition: `transform ${e.ARROW_ANIMATION_DURATION} ease 0s`
        } : {},
        ...Ma
      },
      expanded: {
        WebkitTransform: "rotateZ(90deg)",
        MozTransform: "rotateZ(90deg)",
        transform: "rotateZ(90deg)"
      },
      collapsed: {
        WebkitTransform: "rotateZ(0deg)",
        MozTransform: "rotateZ(0deg)",
        transform: "rotateZ(0deg)"
      }
    },
    treeNodeChildNodesContainer: {
      margin: 0,
      paddingLeft: e.TREENODE_PADDING_LEFT
    }
  },
  TableInspector: {
    base: {
      color: e.BASE_COLOR,
      position: "relative",
      border: `1px solid ${e.TABLE_BORDER_COLOR}`,
      fontFamily: e.BASE_FONT_FAMILY,
      fontSize: e.BASE_FONT_SIZE,
      lineHeight: "120%",
      boxSizing: "border-box",
      cursor: "default"
    }
  },
  TableInspectorHeaderContainer: {
    base: {
      top: 0,
      height: "17px",
      left: 0,
      right: 0,
      overflowX: "hidden"
    },
    table: {
      tableLayout: "fixed",
      borderSpacing: 0,
      borderCollapse: "separate",
      height: "100%",
      width: "100%",
      margin: 0
    }
  },
  TableInspectorDataContainer: {
    tr: {
      display: "table-row"
    },
    td: {
      boxSizing: "border-box",
      border: "none",
      height: "16px",
      verticalAlign: "top",
      padding: "1px 4px",
      WebkitUserSelect: "text",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      overflow: "hidden",
      lineHeight: "14px"
    },
    div: {
      position: "static",
      top: "17px",
      bottom: 0,
      overflowY: "overlay",
      transform: "translateZ(0)",
      left: 0,
      right: 0,
      overflowX: "hidden"
    },
    table: {
      positon: "static",
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      borderTop: "0 none transparent",
      margin: 0,
      backgroundImage: e.TABLE_DATA_BACKGROUND_IMAGE,
      backgroundSize: e.TABLE_DATA_BACKGROUND_SIZE,
      tableLayout: "fixed",
      borderSpacing: 0,
      borderCollapse: "separate",
      width: "100%",
      fontSize: e.BASE_FONT_SIZE,
      lineHeight: "120%"
    }
  },
  TableInspectorTH: {
    base: {
      position: "relative",
      height: "auto",
      textAlign: "left",
      backgroundColor: e.TABLE_TH_BACKGROUND_COLOR,
      borderBottom: `1px solid ${e.TABLE_BORDER_COLOR}`,
      fontWeight: "normal",
      verticalAlign: "middle",
      padding: "0 4px",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      overflow: "hidden",
      lineHeight: "14px",
      ":hover": {
        backgroundColor: e.TABLE_TH_HOVER_COLOR
      }
    },
    div: {
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      overflow: "hidden",
      fontSize: e.BASE_FONT_SIZE,
      lineHeight: "120%"
    }
  },
  TableInspectorLeftBorder: {
    none: {
      borderLeft: "none"
    },
    solid: {
      borderLeft: `1px solid ${e.TABLE_BORDER_COLOR}`
    }
  },
  TableInspectorSortIcon: {
    display: "block",
    marginRight: 3,
    width: 8,
    height: 7,
    marginTop: -7,
    color: e.TABLE_SORT_ICON_COLOR,
    fontSize: 12,
    ...Ma
  }
}), "createTheme"), Ra = "chromeLight", Np = xx(Do(Bo[Ra])), Ie = /* @__PURE__ */ a((e) => vx(Np)[e], "useStyles"), za = /* @__PURE__ */ a((e) => /* @__PURE__ */ a(
({ theme: r = Ra, ...o }) => {
  let n = Ex(() => {
    switch (Object.prototype.toString.call(r)) {
      case "[object String]":
        return Do(Bo[r]);
      case "[object Object]":
        return Do(r);
      default:
        return Do(Bo[Ra]);
    }
  }, [r]);
  return /* @__PURE__ */ Sp.createElement(Np.Provider, {
    value: n
  }, /* @__PURE__ */ Sp.createElement(e, {
    ...o
  }));
}, "ThemeAcceptor"), "themeAcceptor"), Sx = /* @__PURE__ */ a(({ expanded: e, styles: t }) => /* @__PURE__ */ mt.createElement("span", {
  style: {
    ...t.base,
    ...e ? t.expanded : t.collapsed
  }
}, "\u25B6"), "Arrow"), Cx = bx((e) => {
  e = {
    expanded: !0,
    nodeRenderer: /* @__PURE__ */ a(({ name: d }) => /* @__PURE__ */ mt.createElement("span", null, d), "nodeRenderer"),
    onClick: /* @__PURE__ */ a(() => {
    }, "onClick"),
    shouldShowArrow: !1,
    shouldShowPlaceholder: !0,
    ...e
  };
  let { expanded: t, onClick: r, children: o, nodeRenderer: n, title: i, shouldShowArrow: s, shouldShowPlaceholder: l } = e, c = Ie("TreeNod\
e"), u = n;
  return /* @__PURE__ */ mt.createElement("li", {
    "aria-expanded": t,
    role: "treeitem",
    style: c.treeNodeBase,
    title: i
  }, /* @__PURE__ */ mt.createElement("div", {
    style: c.treeNodePreviewContainer,
    onClick: r
  }, s || yx.count(o) > 0 ? /* @__PURE__ */ mt.createElement(Sx, {
    expanded: t,
    styles: c.treeNodeArrow
  }) : l && /* @__PURE__ */ mt.createElement("span", {
    style: c.treeNodePlaceholder
  }, "\xA0"), /* @__PURE__ */ mt.createElement(u, {
    ...e
  })), /* @__PURE__ */ mt.createElement("ol", {
    role: "group",
    style: c.treeNodeChildNodesContainer
  }, t ? o : void 0));
}), Fo = "$", Cp = "*";
function Mo(e, t) {
  return !t(e).next().done;
}
a(Mo, "hasChildNodes");
var wx = /* @__PURE__ */ a((e) => Array.from({ length: e }, (t, r) => [Fo].concat(Array.from({ length: r }, () => "*")).join(".")), "wildcar\
dPathsFromLevel"), Tx = /* @__PURE__ */ a((e, t, r, o, n) => {
  let i = [].concat(wx(o)).concat(r).filter((l) => typeof l == "string"), s = [];
  return i.forEach((l) => {
    let c = l.split("."), u = /* @__PURE__ */ a((d, g, p) => {
      if (p === c.length) {
        s.push(g);
        return;
      }
      let m = c[p];
      if (p === 0)
        Mo(d, t) && (m === Fo || m === Cp) && u(d, Fo, p + 1);
      else if (m === Cp)
        for (let { name: f, data: y } of t(d))
          Mo(y, t) && u(y, `${g}.${f}`, p + 1);
      else {
        let f = d[m];
        Mo(f, t) && u(f, `${g}.${m}`, p + 1);
      }
    }, "populatePaths");
    u(e, "", 0);
  }), s.reduce((l, c) => (l[c] = !0, l), { ...n });
}, "getExpandedPaths"), _p = Pp((e) => {
  let { data: t, dataIterator: r, path: o, depth: n, nodeRenderer: i } = e, [s, l] = dx(Lp), c = Mo(t, r), u = !!s[o], d = fx(() => c && l((g) => ({
    ...g,
    [o]: !u
  })), [c, l, o, u]);
  return /* @__PURE__ */ Sr.createElement(Cx, {
    expanded: u,
    onClick: d,
    shouldShowArrow: c,
    shouldShowPlaceholder: n > 0,
    nodeRenderer: i,
    ...e
  }, u ? [...r(t)].map(({ name: g, data: p, ...m }) => /* @__PURE__ */ Sr.createElement(_p, {
    name: g,
    data: p,
    depth: n + 1,
    path: `${o}.${g}`,
    key: g,
    dataIterator: r,
    nodeRenderer: i,
    ...m
  })) : null);
}), Dp = Pp(({ name: e, data: t, dataIterator: r, nodeRenderer: o, expandPaths: n, expandLevel: i }) => {
  let s = Ie("TreeView"), l = gx({}), [, c] = l;
  return mx(() => c((u) => Tx(t, r, n, i, u)), [t, r, n, i]), /* @__PURE__ */ Sr.createElement(Lp.Provider, {
    value: l
  }, /* @__PURE__ */ Sr.createElement("ol", {
    role: "tree",
    style: s.treeViewOutline
  }, /* @__PURE__ */ Sr.createElement(_p, {
    name: e,
    data: t,
    dataIterator: r,
    depth: 0,
    path: Fo,
    nodeRenderer: o
  })));
}), Ua = /* @__PURE__ */ a(({ name: e, dimmed: t = !1, styles: r = {} }) => {
  let o = Ie("ObjectName"), n = {
    ...o.base,
    ...t ? o.dimmed : {},
    ...r
  };
  return /* @__PURE__ */ Ax.createElement("span", {
    style: n
  }, e);
}, "ObjectName"), Cr = /* @__PURE__ */ a(({ object: e, styles: t }) => {
  let r = Ie("ObjectValue"), o = /* @__PURE__ */ a((n) => ({ ...r[n], ...t }), "mkStyle");
  switch (typeof e) {
    case "bigint":
      return /* @__PURE__ */ le.createElement("span", {
        style: o("objectValueNumber")
      }, String(e), "n");
    case "number":
      return /* @__PURE__ */ le.createElement("span", {
        style: o("objectValueNumber")
      }, String(e));
    case "string":
      return /* @__PURE__ */ le.createElement("span", {
        style: o("objectValueString")
      }, '"', e, '"');
    case "boolean":
      return /* @__PURE__ */ le.createElement("span", {
        style: o("objectValueBoolean")
      }, String(e));
    case "undefined":
      return /* @__PURE__ */ le.createElement("span", {
        style: o("objectValueUndefined")
      }, "undefined");
    case "object":
      return e === null ? /* @__PURE__ */ le.createElement("span", {
        style: o("objectValueNull")
      }, "null") : e instanceof Date ? /* @__PURE__ */ le.createElement("span", null, e.toString()) : e instanceof RegExp ? /* @__PURE__ */ le.
      createElement("span", {
        style: o("objectValueRegExp")
      }, e.toString()) : Array.isArray(e) ? /* @__PURE__ */ le.createElement("span", null, `Array(${e.length})`) : e.constructor ? typeof e.
      constructor.isBuffer == "function" && e.constructor.isBuffer(e) ? /* @__PURE__ */ le.createElement("span", null, `Buffer[${e.length}]`) :
      /* @__PURE__ */ le.createElement("span", null, e.constructor.name) : /* @__PURE__ */ le.createElement("span", null, "Object");
    case "function":
      return /* @__PURE__ */ le.createElement("span", null, /* @__PURE__ */ le.createElement("span", {
        style: o("objectValueFunctionPrefix")
      }, "\u0192\xA0"), /* @__PURE__ */ le.createElement("span", {
        style: o("objectValueFunctionName")
      }, e.name, "()"));
    case "symbol":
      return /* @__PURE__ */ le.createElement("span", {
        style: o("objectValueSymbol")
      }, e.toString());
    default:
      return /* @__PURE__ */ le.createElement("span", null);
  }
}, "ObjectValue"), Mp = Object.prototype.hasOwnProperty, kx = Object.prototype.propertyIsEnumerable;
function ja(e, t) {
  let r = Object.getOwnPropertyDescriptor(e, t);
  if (r.get)
    try {
      return r.get();
    } catch {
      return r.get;
    }
  return e[t];
}
a(ja, "getPropertyValue");
function wp(e, t) {
  return e.length === 0 ? [] : e.slice(1).reduce((r, o) => r.concat([t, o]), [e[0]]);
}
a(wp, "intersperse");
var Ha = /* @__PURE__ */ a(({ data: e }) => {
  let t = Ie("ObjectPreview"), r = e;
  if (typeof r != "object" || r === null || r instanceof Date || r instanceof RegExp)
    return /* @__PURE__ */ be.createElement(Cr, {
      object: r
    });
  if (Array.isArray(r)) {
    let o = t.arrayMaxProperties, n = r.slice(0, o).map((s, l) => /* @__PURE__ */ be.createElement(Cr, {
      key: l,
      object: s
    }));
    r.length > o && n.push(/* @__PURE__ */ be.createElement("span", {
      key: "ellipsis"
    }, "\u2026"));
    let i = r.length;
    return /* @__PURE__ */ be.createElement(be.Fragment, null, /* @__PURE__ */ be.createElement("span", {
      style: t.objectDescription
    }, i === 0 ? "" : `(${i})\xA0`), /* @__PURE__ */ be.createElement("span", {
      style: t.preview
    }, "[", wp(n, ", "), "]"));
  } else {
    let o = t.objectMaxProperties, n = [];
    for (let s in r)
      if (Mp.call(r, s)) {
        let l;
        n.length === o - 1 && Object.keys(r).length > o && (l = /* @__PURE__ */ be.createElement("span", {
          key: "ellipsis"
        }, "\u2026"));
        let c = ja(r, s);
        if (n.push(/* @__PURE__ */ be.createElement("span", {
          key: s
        }, /* @__PURE__ */ be.createElement(Ua, {
          name: s || '""'
        }), ":\xA0", /* @__PURE__ */ be.createElement(Cr, {
          object: c
        }), l)), l)
          break;
      }
    let i = r.constructor ? r.constructor.name : "Object";
    return /* @__PURE__ */ be.createElement(be.Fragment, null, /* @__PURE__ */ be.createElement("span", {
      style: t.objectDescription
    }, i === "Object" ? "" : `${i} `), /* @__PURE__ */ be.createElement("span", {
      style: t.preview
    }, "{", wp(n, ", "), "}"));
  }
}, "ObjectPreview"), Ox = /* @__PURE__ */ a(({ name: e, data: t }) => typeof e == "string" ? /* @__PURE__ */ vr.createElement("span", null, /* @__PURE__ */ vr.
createElement(Ua, {
  name: e
}), /* @__PURE__ */ vr.createElement("span", null, ": "), /* @__PURE__ */ vr.createElement(Ha, {
  data: t
})) : /* @__PURE__ */ vr.createElement(Ha, {
  data: t
}), "ObjectRootLabel"), Ix = /* @__PURE__ */ a(({ name: e, data: t, isNonenumerable: r = !1 }) => {
  let o = t;
  return /* @__PURE__ */ Er.createElement("span", null, typeof e == "string" ? /* @__PURE__ */ Er.createElement(Ua, {
    name: e,
    dimmed: r
  }) : /* @__PURE__ */ Er.createElement(Ha, {
    data: e
  }), /* @__PURE__ */ Er.createElement("span", null, ": "), /* @__PURE__ */ Er.createElement(Cr, {
    object: o
  }));
}, "ObjectLabel"), Px = /* @__PURE__ */ a((e, t) => /* @__PURE__ */ a(function* (o) {
  if (!(typeof o == "object" && o !== null || typeof o == "function"))
    return;
  let i = Array.isArray(o);
  if (!i && o[Symbol.iterator]) {
    let s = 0;
    for (let l of o) {
      if (Array.isArray(l) && l.length === 2) {
        let [c, u] = l;
        yield {
          name: c,
          data: u
        };
      } else
        yield {
          name: s.toString(),
          data: l
        };
      s++;
    }
  } else {
    let s = Object.getOwnPropertyNames(o);
    t === !0 && !i ? s.sort() : typeof t == "function" && s.sort(t);
    for (let l of s)
      if (kx.call(o, l)) {
        let c = ja(o, l);
        yield {
          name: l || '""',
          data: c
        };
      } else if (e) {
        let c;
        try {
          c = ja(o, l);
        } catch {
        }
        c !== void 0 && (yield {
          name: l,
          data: c,
          isNonenumerable: !0
        });
      }
    e && o !== Object.prototype && (yield {
      name: "__proto__",
      data: Object.getPrototypeOf(o),
      isNonenumerable: !0
    });
  }
}, "objectIterator"), "createIterator"), Lx = /* @__PURE__ */ a(({ depth: e, name: t, data: r, isNonenumerable: o }) => e === 0 ? /* @__PURE__ */ Fa.
createElement(Ox, {
  name: t,
  data: r
}) : /* @__PURE__ */ Fa.createElement(Ix, {
  name: t,
  data: r,
  isNonenumerable: o
}), "defaultNodeRenderer"), Nx = /* @__PURE__ */ a(({ showNonenumerable: e = !1, sortObjectKeys: t, nodeRenderer: r, ...o }) => {
  let n = Px(e, t), i = r || Lx;
  return /* @__PURE__ */ Fa.createElement(Dp, {
    nodeRenderer: i,
    dataIterator: n,
    ...o
  });
}, "ObjectInspector"), _x = za(Nx);
function Mx(e) {
  if (typeof e == "object") {
    let t = [];
    if (Array.isArray(e)) {
      let o = e.length;
      t = [...Array(o).keys()];
    } else e !== null && (t = Object.keys(e));
    let r = t.reduce((o, n) => {
      let i = e[n];
      return typeof i == "object" && i !== null && Object.keys(i).reduce((l, c) => (l.includes(c) || l.push(c), l), o), o;
    }, []);
    return {
      rowHeaders: t,
      colHeaders: r
    };
  }
}
a(Mx, "getHeaders");
var Bx = /* @__PURE__ */ a(({ rows: e, columns: t, rowsData: r }) => {
  let o = Ie("TableInspectorDataContainer"), n = Ie("TableInspectorLeftBorder");
  return /* @__PURE__ */ Qe.createElement("div", {
    style: o.div
  }, /* @__PURE__ */ Qe.createElement("table", {
    style: o.table
  }, /* @__PURE__ */ Qe.createElement("colgroup", null), /* @__PURE__ */ Qe.createElement("tbody", null, e.map((i, s) => /* @__PURE__ */ Qe.
  createElement("tr", {
    key: i,
    style: o.tr
  }, /* @__PURE__ */ Qe.createElement("td", {
    style: { ...o.td, ...n.none }
  }, i), t.map((l) => {
    let c = r[s];
    return typeof c == "object" && c !== null && Mp.call(c, l) ? /* @__PURE__ */ Qe.createElement("td", {
      key: l,
      style: { ...o.td, ...n.solid }
    }, /* @__PURE__ */ Qe.createElement(Cr, {
      object: c[l]
    })) : /* @__PURE__ */ Qe.createElement("td", {
      key: l,
      style: { ...o.td, ...n.solid }
    });
  }))))));
}, "DataContainer"), Rx = /* @__PURE__ */ a((e) => /* @__PURE__ */ Xt.createElement("div", {
  style: {
    position: "absolute",
    top: 1,
    right: 0,
    bottom: 1,
    display: "flex",
    alignItems: "center"
  }
}, e.children), "SortIconContainer"), jx = /* @__PURE__ */ a(({ sortAscending: e }) => {
  let t = Ie("TableInspectorSortIcon"), r = e ? "\u25B2" : "\u25BC";
  return /* @__PURE__ */ Xt.createElement("div", {
    style: t
  }, r);
}, "SortIcon"), kp = /* @__PURE__ */ a(({
  sortAscending: e = !1,
  sorted: t = !1,
  onClick: r = void 0,
  borderStyle: o = {},
  children: n,
  ...i
}) => {
  let s = Ie("TableInspectorTH"), [l, c] = Fx(!1), u = Ap(() => c(!0), []), d = Ap(() => c(!1), []);
  return /* @__PURE__ */ Xt.createElement("th", {
    ...i,
    style: {
      ...s.base,
      ...o,
      ...l ? s.base[":hover"] : {}
    },
    onMouseEnter: u,
    onMouseLeave: d,
    onClick: r
  }, /* @__PURE__ */ Xt.createElement("div", {
    style: s.div
  }, n), t && /* @__PURE__ */ Xt.createElement(Rx, null, /* @__PURE__ */ Xt.createElement(jx, {
    sortAscending: e
  })));
}, "TH"), Hx = /* @__PURE__ */ a(({
  indexColumnText: e = "(index)",
  columns: t = [],
  sorted: r,
  sortIndexColumn: o,
  sortColumn: n,
  sortAscending: i,
  onTHClick: s,
  onIndexTHClick: l
}) => {
  let c = Ie("TableInspectorHeaderContainer"), u = Ie("TableInspectorLeftBorder");
  return /* @__PURE__ */ Yt.createElement("div", {
    style: c.base
  }, /* @__PURE__ */ Yt.createElement("table", {
    style: c.table
  }, /* @__PURE__ */ Yt.createElement("tbody", null, /* @__PURE__ */ Yt.createElement("tr", null, /* @__PURE__ */ Yt.createElement(kp, {
    borderStyle: u.none,
    sorted: r && o,
    sortAscending: i,
    onClick: l
  }, e), t.map((d) => /* @__PURE__ */ Yt.createElement(kp, {
    borderStyle: u.solid,
    key: d,
    sorted: r && n === d,
    sortAscending: i,
    onClick: s.bind(null, d)
  }, d))))));
}, "HeaderContainer"), $x = /* @__PURE__ */ a(({
  data: e,
  columns: t
}) => {
  let r = Ie("TableInspector"), [{ sorted: o, sortIndexColumn: n, sortColumn: i, sortAscending: s }, l] = Dx({
    sorted: !1,
    sortIndexColumn: !1,
    sortColumn: void 0,
    sortAscending: !1
  }), c = Tp(() => {
    l(({ sortIndexColumn: f, sortAscending: y }) => ({
      sorted: !0,
      sortIndexColumn: !0,
      sortColumn: void 0,
      sortAscending: f ? !y : !0
    }));
  }, []), u = Tp((f) => {
    l(({ sortColumn: y, sortAscending: h }) => ({
      sorted: !0,
      sortIndexColumn: !1,
      sortColumn: f,
      sortAscending: f === y ? !h : !0
    }));
  }, []);
  if (typeof e != "object" || e === null)
    return /* @__PURE__ */ _o.createElement("div", null);
  let { rowHeaders: d, colHeaders: g } = Mx(e);
  t !== void 0 && (g = t);
  let p = d.map((f) => e[f]), m;
  if (i !== void 0 ? m = p.map((f, y) => typeof f == "object" && f !== null ? [f[i], y] : [void 0, y]) : n && (m = d.map((f, y) => [d[y], y])),
  m !== void 0) {
    let f = /* @__PURE__ */ a((h, b) => (x, v) => {
      let E = h(x), S = h(v), w = typeof E, P = typeof S, N = /* @__PURE__ */ a((H, G) => H < G ? -1 : H > G ? 1 : 0, "lt"), q;
      if (w === P)
        q = N(E, S);
      else {
        let H = {
          string: 0,
          number: 1,
          object: 2,
          symbol: 3,
          boolean: 4,
          undefined: 5,
          function: 6
        };
        q = N(H[w], H[P]);
      }
      return b || (q = -q), q;
    }, "comparator"), y = m.sort(f((h) => h[0], s)).map((h) => h[1]);
    d = y.map((h) => d[h]), p = y.map((h) => p[h]);
  }
  return /* @__PURE__ */ _o.createElement("div", {
    style: r.base
  }, /* @__PURE__ */ _o.createElement(Hx, {
    columns: g,
    sorted: o,
    sortIndexColumn: n,
    sortColumn: i,
    sortAscending: s,
    onTHClick: u,
    onIndexTHClick: c
  }), /* @__PURE__ */ _o.createElement(Bx, {
    rows: d,
    columns: g,
    rowsData: p
  }));
}, "TableInspector"), Vx = za($x), Ux = 80, Bp = /* @__PURE__ */ a((e) => e.childNodes.length === 0 || e.childNodes.length === 1 && e.childNodes[0].
nodeType === Node.TEXT_NODE && e.textContent.length < Ux, "shouldInline"), qx = /* @__PURE__ */ a(({ tagName: e, attributes: t, styles: r }) => /* @__PURE__ */ oe.
createElement("span", {
  style: r.base
}, "<", /* @__PURE__ */ oe.createElement("span", {
  style: r.tagName
}, e), (() => {
  if (t) {
    let o = [];
    for (let n = 0; n < t.length; n++) {
      let i = t[n];
      o.push(/* @__PURE__ */ oe.createElement("span", {
        key: n
      }, " ", /* @__PURE__ */ oe.createElement("span", {
        style: r.htmlAttributeName
      }, i.name), '="', /* @__PURE__ */ oe.createElement("span", {
        style: r.htmlAttributeValue
      }, i.value), '"'));
    }
    return o;
  }
})(), ">"), "OpenTag"), Op = /* @__PURE__ */ a(({ tagName: e, isChildNode: t = !1, styles: r }) => /* @__PURE__ */ oe.createElement("span", {
  style: Object.assign({}, r.base, t && r.offsetLeft)
}, "</", /* @__PURE__ */ oe.createElement("span", {
  style: r.tagName
}, e), ">"), "CloseTag"), Wx = {
  1: "ELEMENT_NODE",
  3: "TEXT_NODE",
  7: "PROCESSING_INSTRUCTION_NODE",
  8: "COMMENT_NODE",
  9: "DOCUMENT_NODE",
  10: "DOCUMENT_TYPE_NODE",
  11: "DOCUMENT_FRAGMENT_NODE"
}, Gx = /* @__PURE__ */ a(({ isCloseTag: e, data: t, expanded: r }) => {
  let o = Ie("DOMNodePreview");
  if (e)
    return /* @__PURE__ */ oe.createElement(Op, {
      styles: o.htmlCloseTag,
      isChildNode: !0,
      tagName: t.tagName
    });
  switch (t.nodeType) {
    case Node.ELEMENT_NODE:
      return /* @__PURE__ */ oe.createElement("span", null, /* @__PURE__ */ oe.createElement(qx, {
        tagName: t.tagName,
        attributes: t.attributes,
        styles: o.htmlOpenTag
      }), Bp(t) ? t.textContent : !r && "\u2026", !r && /* @__PURE__ */ oe.createElement(Op, {
        tagName: t.tagName,
        styles: o.htmlCloseTag
      }));
    case Node.TEXT_NODE:
      return /* @__PURE__ */ oe.createElement("span", null, t.textContent);
    case Node.CDATA_SECTION_NODE:
      return /* @__PURE__ */ oe.createElement("span", null, "<![CDATA[" + t.textContent + "]]>");
    case Node.COMMENT_NODE:
      return /* @__PURE__ */ oe.createElement("span", {
        style: o.htmlComment
      }, "<!--", t.textContent, "-->");
    case Node.PROCESSING_INSTRUCTION_NODE:
      return /* @__PURE__ */ oe.createElement("span", null, t.nodeName);
    case Node.DOCUMENT_TYPE_NODE:
      return /* @__PURE__ */ oe.createElement("span", {
        style: o.htmlDoctype
      }, "<!DOCTYPE ", t.name, t.publicId ? ` PUBLIC "${t.publicId}"` : "", !t.publicId && t.systemId ? " SYSTEM" : "", t.systemId ? ` "${t.
      systemId}"` : "", ">");
    case Node.DOCUMENT_NODE:
      return /* @__PURE__ */ oe.createElement("span", null, t.nodeName);
    case Node.DOCUMENT_FRAGMENT_NODE:
      return /* @__PURE__ */ oe.createElement("span", null, t.nodeName);
    default:
      return /* @__PURE__ */ oe.createElement("span", null, Wx[t.nodeType]);
  }
}, "DOMNodePreview"), Jx = /* @__PURE__ */ a(function* (e) {
  if (e && e.childNodes) {
    if (Bp(e))
      return;
    for (let r = 0; r < e.childNodes.length; r++) {
      let o = e.childNodes[r];
      o.nodeType === Node.TEXT_NODE && o.textContent.trim().length === 0 || (yield {
        name: `${o.tagName}[${r}]`,
        data: o
      });
    }
    e.tagName && (yield {
      name: "CLOSE_TAG",
      data: {
        tagName: e.tagName
      },
      isCloseTag: !0
    });
  }
}, "domIterator"), Kx = /* @__PURE__ */ a((e) => /* @__PURE__ */ zx.createElement(Dp, {
  nodeRenderer: Gx,
  dataIterator: Jx,
  ...e
}), "DOMInspector"), Yx = za(Kx), Xx = ix(cx()), Fp = /* @__PURE__ */ a(({ table: e = !1, data: t, ...r }) => e ? /* @__PURE__ */ Ba.createElement(
Vx, {
  data: t,
  ...r
}) : (0, Xx.default)(t) ? /* @__PURE__ */ Ba.createElement(Yx, {
  data: t,
  ...r
}) : /* @__PURE__ */ Ba.createElement(_x, {
  data: t,
  ...r
}), "Inspector");

// src/actions/components/ActionLogger/index.tsx
import { styled as n1, withTheme as a1 } from "storybook/theming";

// src/actions/components/ActionLogger/style.tsx
import { styled as qa } from "storybook/theming";
var Rp = qa.div({
  display: "flex",
  padding: 0,
  borderLeft: "5px solid transparent",
  borderBottom: "1px solid transparent",
  transition: "all 0.1s",
  alignItems: "flex-start",
  whiteSpace: "pre"
}), jp = qa.div(({ theme: e }) => ({
  backgroundColor: wt(0.5, e.appBorderColor),
  color: e.color.inverseText,
  fontSize: e.typography.size.s1,
  fontWeight: e.typography.weight.bold,
  lineHeight: 1,
  padding: "1px 5px",
  borderRadius: 20,
  margin: "2px 0px"
})), Hp = qa.div({
  flex: 1,
  padding: "0 0 0 5px"
});

// src/actions/components/ActionLogger/index.tsx
var $p = Qx(
  ({ children: e, className: t }, r) => /* @__PURE__ */ et.createElement(o1, { ref: r, horizontal: !0, vertical: !0, className: t }, e)
);
$p.displayName = "UnstyledWrapped";
var i1 = n1($p)({
  margin: 0,
  padding: "10px 5px 20px"
}), s1 = a1(({ theme: e, ...t }) => /* @__PURE__ */ et.createElement(Fp, { theme: e.addonActionsTheme || "chromeLight", table: !1, ...t })),
Vp = /* @__PURE__ */ a(({ actions: e, onClear: t }) => {
  let r = t1(null), o = r.current, n = o && o.scrollHeight - o.scrollTop === o.clientHeight;
  return e1(() => {
    n && (r.current.scrollTop = r.current.scrollHeight);
  }, [n, e.length]), /* @__PURE__ */ et.createElement(Zx, null, /* @__PURE__ */ et.createElement(i1, { ref: r }, e.map((i) => /* @__PURE__ */ et.
  createElement(Rp, { key: i.id }, i.count > 1 && /* @__PURE__ */ et.createElement(jp, null, i.count), /* @__PURE__ */ et.createElement(Hp, null,
  /* @__PURE__ */ et.createElement(
    s1,
    {
      sortObjectKeys: !0,
      showNonenumerable: !1,
      name: i.data.name,
      data: i.data.args ?? i.data
    }
  ))))), /* @__PURE__ */ et.createElement(r1, { actionItems: [{ title: "Clear", onClick: t }] }));
}, "ActionLogger");

// src/actions/containers/ActionLogger/index.tsx
var p1 = /* @__PURE__ */ a((e, t) => {
  try {
    return ze(e, t);
  } catch {
    return !1;
  }
}, "safeDeepEqual"), Wa = class Wa extends c1 {
  constructor(r) {
    super(r);
    this.handleStoryChange = /* @__PURE__ */ a(() => {
      let { actions: r } = this.state;
      r.length > 0 && r[0].options.clearOnStoryChange && this.clearActions();
    }, "handleStoryChange");
    this.addAction = /* @__PURE__ */ a((r) => {
      this.setState((o) => {
        let n = [...o.actions], i = n.length && n[n.length - 1];
        return i && p1(i.data, r.data) ? i.count++ : (r.count = 1, n.push(r)), { actions: n.slice(0, r.options.limit) };
      });
    }, "addAction");
    this.clearActions = /* @__PURE__ */ a(() => {
      let { api: r } = this.props;
      r.emit(No), this.setState({ actions: [] });
    }, "clearActions");
    this.mounted = !1, this.state = { actions: [] };
  }
  componentDidMount() {
    this.mounted = !0;
    let { api: r } = this.props;
    r.on(xr, this.addAction), r.on(zp, this.handleStoryChange);
  }
  componentWillUnmount() {
    this.mounted = !1;
    let { api: r } = this.props;
    r.off(zp, this.handleStoryChange), r.off(xr, this.addAction);
  }
  render() {
    let { actions: r = [] } = this.state, { active: o } = this.props, n = {
      actions: r,
      onClear: this.clearActions
    };
    return o ? /* @__PURE__ */ l1.createElement(Vp, { ...n }) : null;
  }
};
a(Wa, "ActionLogger");
var wr = Wa;

// src/actions/manager.tsx
var qp = Up.register(Pt, (e) => {
  globalThis?.FEATURES?.actions && Up.add(Lo, {
    title: Ep,
    type: d1.PANEL,
    render: /* @__PURE__ */ a(({ active: t }) => /* @__PURE__ */ u1.createElement(wr, { api: e, active: !!t }), "render"),
    paramKey: vp
  });
});

// src/component-testing/manager.tsx
import an from "react";
import { AddonPanel as DS } from "storybook/internal/components";
import { Consumer as MS, addons as Dd, types as BS } from "storybook/manager-api";

// src/component-testing/components/Panel.tsx
import Id, { Fragment as bS, memo as xS, useEffect as wi, useMemo as Pd, useRef as tn, useState as Ti } from "react";
import {
  FORCE_REMOUNT as vS,
  PLAY_FUNCTION_THREW_EXCEPTION as ES,
  STORY_RENDER_PHASE_CHANGED as SS,
  STORY_THREW_EXCEPTION as CS,
  UNHANDLED_ERRORS_WHILE_PLAYING as wS
} from "storybook/internal/core-events";
import { global as Ai } from "@storybook/global";
import {
  experimental_useStatusStore as TS,
  useAddonState as AS,
  useChannel as kS,
  useParameter as OS
} from "storybook/manager-api";

// src/component-testing/constants.ts
var Lt = "storybook/interactions", Zt = `${Lt}/panel`, f1 = "writing-tests/integrations/vitest-addon", Wp = `${f1}#what-happens-when-there-a\
re-different-test-results-in-multiple-environments`, Gp = "writing-stories/play-function#writing-stories-with-the-play-function", Pe = "inte\
rnal_render_call";

// ../addons/a11y/src/constants.ts
var gt = "storybook/a11y", m1 = `${gt}/panel`;
var zN = `${gt}/result`, UN = `${gt}/request`, qN = `${gt}/running`, WN = `${gt}/error`, GN = `${gt}/manual`, JN = `${gt}/select`, g1 = "wri\
ting-tests/accessibility-testing", KN = `${g1}#why-are-my-tests-failing-in-different-environments`;

// ../addons/vitest/src/constants.ts
var Jp = "storybook/test", XN = `${Jp}/test-provider`, Kp = "STORYBOOK_ADDON_TEST_CHANNEL";
var h1 = "writing-tests/integrations/vitest-addon", ZN = `${h1}#what-happens-if-vitest-itself-has-an-error`;
var y1 = {
  id: Jp,
  initialState: {
    config: {
      coverage: !1,
      a11y: !1
    },
    watching: !1,
    cancelling: !1,
    fatalError: void 0,
    indexUrl: void 0,
    previewAnnotations: [],
    currentRun: {
      triggeredBy: void 0,
      config: {
        coverage: !1,
        a11y: !1
      },
      componentTestCount: {
        success: 0,
        error: 0
      },
      a11yCount: {
        success: 0,
        warning: 0,
        error: 0
      },
      storyIds: void 0,
      totalTestCount: void 0,
      startedAt: void 0,
      finishedAt: void 0,
      unhandledErrors: [],
      coverageSummary: void 0
    }
  }
};
var QN = `UNIVERSAL_STORE:${y1.id}`;
var Yp = "storybook/component-test";

// src/instrumenter/EVENTS.ts
var ht = {
  CALL: "storybook/instrumenter/call",
  SYNC: "storybook/instrumenter/sync",
  START: "storybook/instrumenter/start",
  BACK: "storybook/instrumenter/back",
  GOTO: "storybook/instrumenter/goto",
  NEXT: "storybook/instrumenter/next",
  END: "storybook/instrumenter/end"
};

// src/component-testing/components/InteractionsPanel.tsx
import * as Q from "react";
import { styled as er } from "storybook/theming";

// src/component-testing/utils.ts
var Au = Ee(Tu(), 1);
import { useTheme as Q1 } from "storybook/theming";

// ../node_modules/ansi-regex/index.js
function Qa({ onlyFirst: e = !1 } = {}) {
  let r = [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?(?:\\u0007|\\u001B\\u005C|\\u00\
9C))",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))"
  ].join("|");
  return new RegExp(r, e ? void 0 : "g");
}
a(Qa, "ansiRegex");

// ../node_modules/strip-ansi/index.js
var Z1 = Qa();
function ei(e) {
  if (typeof e != "string")
    throw new TypeError(`Expected a \`string\`, got \`${typeof e}\``);
  return e.replace(Z1, "");
}
a(ei, "stripAnsi");

// src/component-testing/utils.ts
function ku(e) {
  return ti(e) || ri(e);
}
a(ku, "isTestAssertionError");
function ti(e) {
  return e && typeof e == "object" && "name" in e && typeof e.name == "string" && e.name === "AssertionError";
}
a(ti, "isChaiError");
function ri(e) {
  return e && typeof e == "object" && "message" in e && typeof e.message == "string" && ei(e.message).startsWith("expect(");
}
a(ri, "isJestError");
function ev(e) {
  return new Au.default({
    escapeXML: !0,
    fg: e.color.defaultText,
    bg: e.background.content
  });
}
a(ev, "createAnsiToHtmlFilter");
function Qt() {
  let e = Q1();
  return ev(e);
}
a(Qt, "useAnsiToHtmlFilter");

// src/component-testing/components/DetachedDebuggerMessage.tsx
import Ou from "react";
import { Link as tv } from "storybook/internal/components";
import { styled as rv } from "storybook/theming";
var ov = rv.div(({ theme: { color: e, typography: t, background: r } }) => ({
  textAlign: "start",
  padding: "11px 15px",
  fontSize: `${t.size.s2 - 1}px`,
  fontWeight: t.weight.regular,
  lineHeight: "1rem",
  background: r.app,
  borderBottom: `1px solid ${e.border}`,
  color: e.defaultText,
  backgroundClip: "padding-box",
  position: "relative"
})), Iu = /* @__PURE__ */ a(({ storyUrl: e }) => /* @__PURE__ */ Ou.createElement(ov, null, "Debugger controls are not available on composed\
 Storybooks.", " ", /* @__PURE__ */ Ou.createElement(
  tv,
  {
    href: `${e}&addonPanel=${Zt}`,
    target: "_blank",
    rel: "noopener noreferrer",
    withArrow: !0
  },
  "Open in external Storybook"
)), "DetachedDebuggerMessage");

// src/component-testing/components/EmptyState.tsx
import _t, { useEffect as nv, useState as av } from "react";
import { EmptyTabContent as iv, Link as sv } from "storybook/internal/components";
import { DocumentIcon as lv } from "@storybook/icons";
import { useStorybookApi as cv } from "storybook/manager-api";
import { styled as pv } from "storybook/theming";
var uv = pv.div(({ theme: e }) => ({
  display: "flex",
  fontSize: e.typography.size.s2 - 1,
  gap: 25
})), Pu = /* @__PURE__ */ a(() => {
  let [e, t] = av(!0), o = cv().getDocsUrl({
    subpath: Gp,
    versioned: !0,
    renderer: !0
  });
  return nv(() => {
    let n = setTimeout(() => {
      t(!1);
    }, 100);
    return () => clearTimeout(n);
  }, []), e ? null : /* @__PURE__ */ _t.createElement("div", null, /* @__PURE__ */ _t.createElement(
    iv,
    {
      title: "Interactions",
      description: /* @__PURE__ */ _t.createElement(_t.Fragment, null, "Interactions allow you to verify the functional aspects of UIs. Writ\
e a play function for your story and you'll see it run here."),
      footer: /* @__PURE__ */ _t.createElement(uv, null, /* @__PURE__ */ _t.createElement(sv, { href: o, target: "_blank", withArrow: !0 }, /* @__PURE__ */ _t.
      createElement(lv, null), " Read docs"))
    }
  ));
}, "Empty");

// src/component-testing/components/Interaction.tsx
import * as W from "react";
import { IconButton as TE, TooltipNote as AE, WithTooltip as kE } from "storybook/internal/components";
import { ChevronDownIcon as OE, ChevronUpIcon as IE } from "@storybook/icons";
import { styled as He, typography as en } from "storybook/theming";

// src/component-testing/components/MatcherResult.tsx
import Y from "react";
import { styled as yd, typography as gE } from "storybook/theming";

// src/component-testing/components/MethodCall.tsx
import C, { Fragment as Gv } from "react";
import { logger as Jv } from "storybook/internal/client-logger";

// ../node_modules/@devtools-ds/object-inspector/dist/esm/ObjectInspector.js
var ud = Ee(qo()), dd = Ee(Wo());
import gi, { useEffect as qv, useState as Wv } from "react";

// ../node_modules/clsx/dist/clsx.m.js
function ai(e) {
  var t, r, o = "";
  if (e)
    if (typeof e == "object")
      if (Array.isArray(e))
        for (t = 0; t < e.length; t++)
          e[t] && (r = ai(e[t])) && (o && (o += " "), o += r);
      else
        for (t in e)
          e[t] && (r = ai(t)) && (o && (o += " "), o += r);
    else typeof e != "boolean" && !e.call && (o && (o += " "), o += e);
  return o;
}
a(ai, "toVal");
function me() {
  for (var e = 0, t, r = ""; e < arguments.length; )
    (t = ai(arguments[e++])) && (r && (r += " "), r += t);
  return r;
}
a(me, "default");

// ../node_modules/@devtools-ds/object-parser/dist/esm/index.js
var ii = /* @__PURE__ */ a((e) => Array.isArray(e) || // Detect https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays
ArrayBuffer.isView(e) && !(e instanceof DataView), "isArray"), si = /* @__PURE__ */ a((e) => e !== null && typeof e == "object" && !ii(e) &&
!(e instanceof Date) && !(e instanceof RegExp) && !(e instanceof Error) && !(e instanceof WeakMap) && !(e instanceof WeakSet), "isObject"), gv = /* @__PURE__ */ a(
(e) => si(e) || ii(e) || typeof e == "function" || e instanceof Promise, "isKnownObject"), li = /* @__PURE__ */ a((e) => {
  let t = /unique/;
  return Promise.race([e, t]).then((r) => r === t ? ["pending"] : ["fulfilled", r], (r) => ["rejected", r]);
}, "getPromiseState"), Ge = /* @__PURE__ */ a(async (e, t, r, o, n, i) => {
  let s = {
    key: e,
    depth: r,
    value: t,
    type: "value",
    parent: void 0
  };
  if (t && gv(t) && r < 100) {
    let l = [], c = "object";
    if (ii(t)) {
      for (let u = 0; u < t.length; u++)
        l.push(async () => {
          let d = await Ge(u.toString(), t[u], r + 1, o);
          return d.parent = s, d;
        });
      c = "array";
    } else {
      let u = Object.getOwnPropertyNames(t);
      o && u.sort();
      for (let d = 0; d < u.length; d++) {
        let g;
        try {
          g = t[u[d]];
        } catch {
        }
        l.push(async () => {
          let p = await Ge(u[d], g, r + 1, o);
          return p.parent = s, p;
        });
      }
      if (typeof t == "function" && (c = "function"), t instanceof Promise) {
        let [d, g] = await li(t);
        l.push(async () => {
          let p = await Ge("<state>", d, r + 1, o);
          return p.parent = s, p;
        }), d !== "pending" && l.push(async () => {
          let p = await Ge("<value>", g, r + 1, o);
          return p.parent = s, p;
        }), c = "promise";
      }
      if (t instanceof Map) {
        let g = Array.from(t.entries()).map((p) => {
          let [m, f] = p;
          return {
            "<key>": m,
            "<value>": f
          };
        });
        l.push(async () => {
          let p = await Ge("<entries>", g, r + 1, o);
          return p.parent = s, p;
        }), l.push(async () => {
          let p = await Ge("size", t.size, r + 1, o);
          return p.parent = s, p;
        }), c = "map";
      }
      if (t instanceof Set) {
        let g = Array.from(t.entries()).map((p) => p[1]);
        l.push(async () => {
          let p = await Ge("<entries>", g, r + 1, o);
          return p.parent = s, p;
        }), l.push(async () => {
          let p = await Ge("size", t.size, r + 1, o);
          return p.parent = s, p;
        }), c = "set";
      }
    }
    t !== Object.prototype && i && l.push(async () => {
      let u = await Ge("<prototype>", Object.getPrototypeOf(t), r + 1, o, !0);
      return u.parent = s, u;
    }), s.type = c, s.children = l, s.isPrototype = n;
  }
  return s;
}, "buildAST"), Du = /* @__PURE__ */ a((e, t, r) => Ge("root", e, 0, t === !1 ? t : !0, void 0, r === !1 ? r : !0), "parse");

// ../node_modules/@devtools-ds/themes/dist/esm/utils.js
var ci = Ee(ju()), Uu = Ee(zu());
import Go from "react";
var Sv = ["children"];
var pi = /* @__PURE__ */ Go.createContext({
  theme: "chrome",
  colorScheme: "light"
});
var qu = /* @__PURE__ */ a((e) => {
  let {
    children: t
  } = e, r = (0, Uu.default)(e, Sv), o = Go.useContext(pi);
  return /* @__PURE__ */ Go.createElement(pi.Provider, {
    value: (0, ci.default)((0, ci.default)({}, o), r)
  }, t);
}, "ThemeProvider"), xt = /* @__PURE__ */ a((e, t = {}) => {
  let r = Go.useContext(pi), o = e.theme || r.theme || "chrome", n = e.colorScheme || r.colorScheme || "light", i = me(t[o], t[n]);
  return {
    currentColorScheme: n,
    currentTheme: o,
    themeClass: i
  };
}, "useTheme");

// ../node_modules/@devtools-ds/object-inspector/dist/esm/ObjectInspectorItem.js
var fi = Ee(Yu());
import Or, { useEffect as zv, useState as cd } from "react";

// ../node_modules/@devtools-ds/tree/dist/esm/index.js
var Ko = Ee(Xu()), rd = Ee(td());
import ge, { useState as Nv, useEffect as _v } from "react";

// ../node_modules/@devtools-ds/tree/dist/esm/TreeContext.js
import Iv from "react";
var Pv = /* @__PURE__ */ Iv.createContext({
  isChild: !1,
  depth: 0,
  hasHover: !0
}), Jo = Pv;

// ../node_modules/@devtools-ds/tree/dist/esm/Tree.css.js
var xe = { tree: "Tree-tree-fbbbe38", item: "Tree-item-353d6f3", group: "Tree-group-d3c3d8a", label: "Tree-label-d819155", focusWhite: "Tree\
-focusWhite-f1e00c2", arrow: "Tree-arrow-03ab2e7", hover: "Tree-hover-3cc4e5d", open: "Tree-open-3f1a336", dark: "Tree-dark-1b4aa00", chrome: "\
Tree-chrome-bcbcac6", light: "Tree-light-09174ee" };

// ../node_modules/@devtools-ds/tree/dist/esm/index.js
var Lv = ["theme", "hover", "colorScheme", "children", "label", "className", "onUpdate", "onSelect", "open"], Ar = /* @__PURE__ */ a((e) => {
  let {
    theme: t,
    hover: r,
    colorScheme: o,
    children: n,
    label: i,
    className: s,
    onUpdate: l,
    onSelect: c,
    open: u
  } = e, d = (0, rd.default)(e, Lv), {
    themeClass: g,
    currentTheme: p
  } = xt({
    theme: t,
    colorScheme: o
  }, xe), [m, f] = Nv(u);
  _v(() => {
    f(u);
  }, [u]);
  let y = /* @__PURE__ */ a((T) => {
    f(T), l && l(T);
  }, "updateState"), h = ge.Children.count(n) > 0, b = /* @__PURE__ */ a((T, L) => {
    if (T.isSameNode(L || null)) return;
    let k = T.querySelector('[tabindex="-1"]');
    k?.focus(), T.setAttribute("aria-selected", "true"), L?.removeAttribute("aria-selected");
  }, "updateFocus"), x = /* @__PURE__ */ a((T, L) => {
    let k = T;
    for (; k && k.parentElement; ) {
      if (k.getAttribute("role") === L)
        return k;
      k = k.parentElement;
    }
    return null;
  }, "getParent"), v = /* @__PURE__ */ a((T) => {
    let L = x(T, "tree");
    return L ? Array.from(L.querySelectorAll("li")) : [];
  }, "getListElements"), E = /* @__PURE__ */ a((T) => {
    let L = x(T, "group"), k = L?.previousElementSibling;
    if (k && k.getAttribute("tabindex") === "-1") {
      let ne = k.parentElement, Ve = T.parentElement;
      b(ne, Ve);
    }
  }, "moveBack"), S = /* @__PURE__ */ a((T, L) => {
    let k = v(T);
    k.forEach((ne) => {
      ne.removeAttribute("aria-selected");
    }), L === "start" && k[0] && b(k[0]), L === "end" && k[k.length - 1] && b(k[k.length - 1]);
  }, "moveHome"), w = /* @__PURE__ */ a((T, L) => {
    let k = v(T) || [];
    for (let ne = 0; ne < k.length; ne++) {
      let Ve = k[ne];
      if (Ve.getAttribute("aria-selected") === "true") {
        L === "up" && k[ne - 1] ? b(k[ne - 1], Ve) : L === "down" && k[ne + 1] && b(k[ne + 1], Ve);
        return;
      }
    }
    b(k[0]);
  }, "moveFocusAdjacent"), P = /* @__PURE__ */ a((T, L) => {
    let k = T.target;
    (T.key === "Enter" || T.key === " ") && y(!m), T.key === "ArrowRight" && m && !L ? w(k, "down") : T.key === "ArrowRight" && y(!0), T.key ===
    "ArrowLeft" && (!m || L) ? E(k) : T.key === "ArrowLeft" && y(!1), T.key === "ArrowDown" && w(k, "down"), T.key === "ArrowUp" && w(k, "up"),
    T.key === "Home" && S(k, "start"), T.key === "End" && S(k, "end");
  }, "handleKeypress"), N = /* @__PURE__ */ a((T, L) => {
    let k = T.target, ne = x(k, "treeitem"), Ve = v(k) || [], Pi = !1;
    for (let un = 0; un < Ve.length; un++) {
      let Li = Ve[un];
      if (Li.getAttribute("aria-selected") === "true") {
        ne && (Pi = !0, b(ne, Li));
        break;
      }
    }
    !Pi && ne && b(ne), L || y(!m);
  }, "handleClick"), q = /* @__PURE__ */ a((T) => {
    let L = T.currentTarget;
    !L.contains(document.activeElement) && L.getAttribute("role") === "tree" && L.setAttribute("tabindex", "0");
  }, "handleBlur"), H = /* @__PURE__ */ a((T) => {
    let L = T.target;
    if (L.getAttribute("role") === "tree") {
      let k = L.querySelector('[aria-selected="true"]');
      k ? b(k) : w(L, "down"), L.setAttribute("tabindex", "-1");
    }
  }, "handleFocus"), G = /* @__PURE__ */ a(() => {
    c?.();
  }, "handleButtonFocus"), Z = /* @__PURE__ */ a((T) => {
    let L = T * 0.9 + 0.3;
    return {
      paddingLeft: `${L}em`,
      width: `calc(100% - ${L}em)`
    };
  }, "getPaddingStyles"), {
    isChild: se,
    depth: ee,
    hasHover: pe
  } = ge.useContext(Jo), _ = pe ? r : !1;
  if (!se)
    return /* @__PURE__ */ ge.createElement("ul", (0, Ko.default)({
      role: "tree",
      tabIndex: 0,
      className: me(xe.tree, xe.group, g, s),
      onFocus: H,
      onBlur: q
    }, d), /* @__PURE__ */ ge.createElement(Jo.Provider, {
      value: {
        isChild: !0,
        depth: 0,
        hasHover: _
      }
    }, /* @__PURE__ */ ge.createElement(Ar, e)));
  if (!h)
    return /* @__PURE__ */ ge.createElement("li", (0, Ko.default)({
      role: "treeitem",
      className: xe.item
    }, d), /* @__PURE__ */ ge.createElement("div", {
      role: "button",
      className: me(xe.label, {
        [xe.hover]: _,
        [xe.focusWhite]: p === "firefox"
      }),
      tabIndex: -1,
      style: Z(ee),
      onKeyDown: /* @__PURE__ */ a((T) => {
        P(T, se);
      }, "onKeyDown"),
      onClick: /* @__PURE__ */ a((T) => N(T, !0), "onClick"),
      onFocus: G
    }, /* @__PURE__ */ ge.createElement("span", null, i)));
  let j = me(xe.arrow, {
    [xe.open]: m
  });
  return /* @__PURE__ */ ge.createElement("li", {
    role: "treeitem",
    "aria-expanded": m,
    className: xe.item
  }, /* @__PURE__ */ ge.createElement("div", {
    role: "button",
    tabIndex: -1,
    className: me(xe.label, {
      [xe.hover]: _,
      [xe.focusWhite]: p === "firefox"
    }),
    style: Z(ee),
    onClick: /* @__PURE__ */ a((T) => N(T), "onClick"),
    onKeyDown: /* @__PURE__ */ a((T) => P(T), "onKeyDown"),
    onFocus: G
  }, /* @__PURE__ */ ge.createElement("span", null, /* @__PURE__ */ ge.createElement("span", {
    "aria-hidden": !0,
    className: j
  }), /* @__PURE__ */ ge.createElement("span", null, i))), /* @__PURE__ */ ge.createElement("ul", (0, Ko.default)({
    role: "group",
    className: me(s, xe.group)
  }, d), m && ge.Children.map(n, (T) => /* @__PURE__ */ ge.createElement(Jo.Provider, {
    value: {
      isChild: !0,
      depth: ee + 1,
      hasHover: _
    }
  }, T))));
}, "Tree");
Ar.defaultProps = {
  open: !1,
  hover: !0
};

// ../node_modules/@devtools-ds/object-inspector/dist/esm/ObjectValue.js
var od = Ee(qo()), nd = Ee(Wo());
import tt, { useState as Mv, useEffect as Bv } from "react";

// ../node_modules/@devtools-ds/object-inspector/dist/esm/ObjectInspector.css.js
var z = { "object-inspector": "ObjectInspector-object-inspector-0c33e82", objectInspector: "ObjectInspector-object-inspector-0c33e82", "obje\
ct-label": "ObjectInspector-object-label-b81482b", objectLabel: "ObjectInspector-object-label-b81482b", text: "ObjectInspector-text-25f57f3",
key: "ObjectInspector-key-4f712bb", value: "ObjectInspector-value-f7ec2e5", string: "ObjectInspector-string-c496000", regex: "ObjectInspecto\
r-regex-59d45a3", error: "ObjectInspector-error-b818698", boolean: "ObjectInspector-boolean-2dd1642", number: "ObjectInspector-number-a6daab\
b", undefined: "ObjectInspector-undefined-3a68263", null: "ObjectInspector-null-74acb50", function: "ObjectInspector-function-07bbdcd", "fun\
ction-decorator": "ObjectInspector-function-decorator-3d22c24", functionDecorator: "ObjectInspector-function-decorator-3d22c24", prototype: "\
ObjectInspector-prototype-f2449ee", dark: "ObjectInspector-dark-0c96c97", chrome: "ObjectInspector-chrome-2f3ca98", light: "ObjectInspector-\
light-78bef54" };

// ../node_modules/@devtools-ds/object-inspector/dist/esm/ObjectValue.js
var Dv = ["ast", "theme", "showKey", "colorScheme", "className"], Ae = /* @__PURE__ */ a((e, t, r, o, n) => {
  let i = e.includes("-") ? `"${e}"` : e, s = n <= 0;
  return /* @__PURE__ */ tt.createElement("span", {
    className: z.text
  }, !s && o && /* @__PURE__ */ tt.createElement(tt.Fragment, null, /* @__PURE__ */ tt.createElement("span", {
    className: z.key
  }, i), /* @__PURE__ */ tt.createElement("span", null, ":\xA0")), /* @__PURE__ */ tt.createElement("span", {
    className: r
  }, t));
}, "buildValue"), ad = /* @__PURE__ */ a((e) => {
  let {
    ast: t,
    theme: r,
    showKey: o,
    colorScheme: n,
    className: i
  } = e, s = (0, nd.default)(e, Dv), {
    themeClass: l
  } = xt({
    theme: r,
    colorScheme: n
  }, z), [c, u] = Mv(/* @__PURE__ */ tt.createElement("span", null)), d = /* @__PURE__ */ tt.createElement("span", null);
  return Bv(() => {
    t.value instanceof Promise && (/* @__PURE__ */ a(async (p) => {
      u(Ae(t.key, `Promise { "${await li(p)}" }`, z.key, o, t.depth));
    }, "waitForPromiseResult"))(t.value);
  }, [t, o]), typeof t.value == "number" || typeof t.value == "bigint" ? d = Ae(t.key, String(t.value), z.number, o, t.depth) : typeof t.value ==
  "boolean" ? d = Ae(t.key, String(t.value), z.boolean, o, t.depth) : typeof t.value == "string" ? d = Ae(t.key, `"${t.value}"`, z.string, o,
  t.depth) : typeof t.value > "u" ? d = Ae(t.key, "undefined", z.undefined, o, t.depth) : typeof t.value == "symbol" ? d = Ae(t.key, t.value.
  toString(), z.string, o, t.depth) : typeof t.value == "function" ? d = Ae(t.key, `${t.value.name}()`, z.key, o, t.depth) : typeof t.value ==
  "object" && (t.value === null ? d = Ae(t.key, "null", z.null, o, t.depth) : Array.isArray(t.value) ? d = Ae(t.key, `Array(${t.value.length}\
)`, z.key, o, t.depth) : t.value instanceof Date ? d = Ae(t.key, `Date ${t.value.toString()}`, z.value, o, t.depth) : t.value instanceof RegExp ?
  d = Ae(t.key, t.value.toString(), z.regex, o, t.depth) : t.value instanceof Error ? d = Ae(t.key, t.value.toString(), z.error, o, t.depth) :
  si(t.value) ? d = Ae(t.key, "{\u2026}", z.key, o, t.depth) : d = Ae(t.key, t.value.constructor.name, z.key, o, t.depth)), /* @__PURE__ */ tt.
  createElement("span", (0, od.default)({
    className: me(l, i)
  }, s), c, d);
}, "ObjectValue");
ad.defaultProps = {
  showKey: !0
};
var Yo = ad;

// ../node_modules/@devtools-ds/object-inspector/dist/esm/ObjectLabel.js
var Dt = Ee(qo()), id = Ee(Wo());
import D from "react";
var Fv = ["ast", "theme", "previewMax", "open", "colorScheme", "className"], kr = /* @__PURE__ */ a((e, t, r) => {
  let o = [];
  for (let n = 0; n < e.length; n++) {
    let i = e[n];
    if (i.isPrototype || (o.push(/* @__PURE__ */ D.createElement(Yo, {
      key: i.key,
      ast: i,
      showKey: r
    })), n < e.length - 1 ? o.push(", ") : o.push(" ")), i.isPrototype && n === e.length - 1 && (o.pop(), o.push(" ")), n === t - 1 && e.length >
    t) {
      o.push("\u2026 ");
      break;
    }
  }
  return o;
}, "buildPreview"), Rv = /* @__PURE__ */ a((e, t, r, o) => {
  let n = e.value.length;
  return t ? /* @__PURE__ */ D.createElement("span", null, "Array(", n, ")") : /* @__PURE__ */ D.createElement(D.Fragment, null, /* @__PURE__ */ D.
  createElement("span", null, `${o === "firefox" ? "Array" : ""}(${n}) [ `), kr(e.children, r, !1), /* @__PURE__ */ D.createElement("span", null,
  "]"));
}, "getArrayLabel"), jv = /* @__PURE__ */ a((e, t, r, o) => e.isPrototype ? /* @__PURE__ */ D.createElement("span", null, `Object ${o === "f\
irefox" ? "{ \u2026 }" : ""}`) : t ? /* @__PURE__ */ D.createElement("span", null, "{\u2026}") : /* @__PURE__ */ D.createElement(D.Fragment,
null, /* @__PURE__ */ D.createElement("span", null, `${o === "firefox" ? "Object " : ""}{ `), kr(e.children, r, !0), /* @__PURE__ */ D.createElement(
"span", null, "}")), "getObjectLabel"), Hv = /* @__PURE__ */ a((e, t, r) => t ? /* @__PURE__ */ D.createElement("span", null, `Promise { "${String(
e.children[0].value)}" }`) : /* @__PURE__ */ D.createElement(D.Fragment, null, /* @__PURE__ */ D.createElement("span", null, "Promise { "), kr(
e.children, r, !0), /* @__PURE__ */ D.createElement("span", null, "}")), "getPromiseLabel"), $v = /* @__PURE__ */ a((e, t, r, o) => {
  let {
    size: n
  } = e.value;
  return t ? /* @__PURE__ */ D.createElement("span", null, `Map(${n})`) : /* @__PURE__ */ D.createElement(D.Fragment, null, /* @__PURE__ */ D.
  createElement("span", null, `Map${o === "chrome" ? `(${n})` : ""} { `), kr(e.children, r, !0), /* @__PURE__ */ D.createElement("span", null,
  "}"));
}, "getMapLabel"), Vv = /* @__PURE__ */ a((e, t, r) => {
  let {
    size: o
  } = e.value;
  return t ? /* @__PURE__ */ D.createElement("span", null, "Set(", o, ")") : /* @__PURE__ */ D.createElement(D.Fragment, null, /* @__PURE__ */ D.
  createElement("span", null, `Set(${e.value.size}) {`), kr(e.children, r, !0), /* @__PURE__ */ D.createElement("span", null, "}"));
}, "getSetLabel"), sd = /* @__PURE__ */ a((e) => {
  let {
    ast: t,
    theme: r,
    previewMax: o,
    open: n,
    colorScheme: i,
    className: s
  } = e, l = (0, id.default)(e, Fv), {
    themeClass: c,
    currentTheme: u
  } = xt({
    theme: r,
    colorScheme: i
  }, z), d = t.isPrototype || !1, g = me(z.objectLabel, c, s, {
    [z.prototype]: d
  }), p = t.depth <= 0, m = /* @__PURE__ */ a(() => /* @__PURE__ */ D.createElement("span", {
    className: d ? z.prototype : z.key
  }, p ? "" : `${t.key}: `), "Key");
  return t.type === "array" ? /* @__PURE__ */ D.createElement("span", (0, Dt.default)({
    className: g
  }, l), /* @__PURE__ */ D.createElement(m, null), Rv(t, n, o, u)) : t.type === "function" ? /* @__PURE__ */ D.createElement("span", (0, Dt.default)(
  {
    className: g
  }, l), /* @__PURE__ */ D.createElement(m, null), u === "chrome" && /* @__PURE__ */ D.createElement("span", {
    className: z.functionDecorator
  }, "\u0192 "), /* @__PURE__ */ D.createElement("span", {
    className: me({
      [z.function]: !d
    })
  }, `${t.value.name}()`)) : t.type === "promise" ? /* @__PURE__ */ D.createElement("span", (0, Dt.default)({
    className: g
  }, l), /* @__PURE__ */ D.createElement(m, null), Hv(t, n, o)) : t.type === "map" ? /* @__PURE__ */ D.createElement("span", (0, Dt.default)(
  {
    className: g
  }, l), /* @__PURE__ */ D.createElement(m, null), $v(t, n, o, u)) : t.type === "set" ? /* @__PURE__ */ D.createElement("span", (0, Dt.default)(
  {
    className: g
  }, l), /* @__PURE__ */ D.createElement(m, null), Vv(t, n, o)) : /* @__PURE__ */ D.createElement("span", (0, Dt.default)({
    className: g
  }, l), /* @__PURE__ */ D.createElement(m, null), jv(t, n, o, u));
}, "ObjectLabel");
sd.defaultProps = {
  previewMax: 8,
  open: !1
};
var ld = sd;

// ../node_modules/@devtools-ds/object-inspector/dist/esm/ObjectInspectorItem.js
var mi = /* @__PURE__ */ a((e) => {
  let {
    ast: t,
    expandLevel: r,
    depth: o
  } = e, [n, i] = cd(), [s, l] = cd(o < r);
  return zv(() => {
    (/* @__PURE__ */ a(async () => {
      if (t.type !== "value") {
        let u = t.children.map((p) => p()), d = await Promise.all(u), g = (0, fi.default)((0, fi.default)({}, t), {}, {
          children: d
        });
        i(g);
      }
    }, "resolve"))();
  }, [t]), n ? /* @__PURE__ */ Or.createElement(Ar, {
    hover: !1,
    open: s,
    label: /* @__PURE__ */ Or.createElement(ld, {
      open: s,
      ast: n
    }),
    onSelect: /* @__PURE__ */ a(() => {
      var c;
      (c = e.onSelect) === null || c === void 0 || c.call(e, t);
    }, "onSelect"),
    onUpdate: /* @__PURE__ */ a((c) => {
      l(c);
    }, "onUpdate")
  }, n.children.map((c) => /* @__PURE__ */ Or.createElement(mi, {
    key: c.key,
    ast: c,
    depth: o + 1,
    expandLevel: r,
    onSelect: e.onSelect
  }))) : /* @__PURE__ */ Or.createElement(Ar, {
    hover: !1,
    label: /* @__PURE__ */ Or.createElement(Yo, {
      ast: t
    }),
    onSelect: /* @__PURE__ */ a(() => {
      var c;
      (c = e.onSelect) === null || c === void 0 || c.call(e, t);
    }, "onSelect")
  });
}, "ObjectInspectorItem");
mi.defaultProps = {
  expandLevel: 0,
  depth: 0
};
var pd = mi;

// ../node_modules/@devtools-ds/object-inspector/dist/esm/ObjectInspector.js
var Uv = ["data", "expandLevel", "sortKeys", "includePrototypes", "className", "theme", "colorScheme", "onSelect"], Xo = /* @__PURE__ */ a((e) => {
  let {
    data: t,
    expandLevel: r,
    sortKeys: o,
    includePrototypes: n,
    className: i,
    theme: s,
    colorScheme: l,
    onSelect: c
  } = e, u = (0, dd.default)(e, Uv), [d, g] = Wv(void 0), {
    themeClass: p,
    currentTheme: m,
    currentColorScheme: f
  } = xt({
    theme: s,
    colorScheme: l
  }, z);
  return qv(() => {
    (/* @__PURE__ */ a(async () => {
      g(await Du(t, o, n));
    }, "runParser"))();
  }, [t, o, n]), /* @__PURE__ */ gi.createElement("div", (0, ud.default)({
    className: me(z.objectInspector, i, p)
  }, u), d && /* @__PURE__ */ gi.createElement(qu, {
    theme: m,
    colorScheme: f
  }, /* @__PURE__ */ gi.createElement(pd, {
    ast: d,
    expandLevel: r,
    onSelect: c
  })));
}, "ObjectInspector");
Xo.defaultProps = {
  expandLevel: 0,
  sortKeys: !0,
  includePrototypes: !0
};

// src/component-testing/components/MethodCall.tsx
import { useTheme as hi } from "storybook/theming";
var Kv = {
  base: "#444",
  nullish: "#7D99AA",
  string: "#16B242",
  number: "#5D40D0",
  boolean: "#f41840",
  objectkey: "#698394",
  instance: "#A15C20",
  function: "#EA7509",
  muted: "#7D99AA",
  tag: {
    name: "#6F2CAC",
    suffix: "#1F99E5"
  },
  date: "#459D9C",
  error: {
    name: "#D43900",
    message: "#444"
  },
  regex: {
    source: "#A15C20",
    flags: "#EA7509"
  },
  meta: "#EA7509",
  method: "#0271B6"
}, Yv = {
  base: "#eee",
  nullish: "#aaa",
  string: "#5FE584",
  number: "#6ba5ff",
  boolean: "#ff4191",
  objectkey: "#accfe6",
  instance: "#E3B551",
  function: "#E3B551",
  muted: "#aaa",
  tag: {
    name: "#f57bff",
    suffix: "#8EB5FF"
  },
  date: "#70D4D3",
  error: {
    name: "#f40",
    message: "#eee"
  },
  regex: {
    source: "#FAD483",
    flags: "#E3B551"
  },
  meta: "#FAD483",
  method: "#5EC1FF"
}, ce = /* @__PURE__ */ a(() => {
  let { base: e } = hi();
  return e === "dark" ? Yv : Kv;
}, "useThemeColors"), Xv = /[^A-Z0-9]/i, fd = /[\s.,…]+$/gm, md = /* @__PURE__ */ a((e, t) => {
  if (e.length <= t)
    return e;
  for (let r = t - 1; r >= 0; r -= 1)
    if (Xv.test(e[r]) && r > 10)
      return `${e.slice(0, r).replace(fd, "")}\u2026`;
  return `${e.slice(0, t).replace(fd, "")}\u2026`;
}, "ellipsize"), Zv = /* @__PURE__ */ a((e) => {
  try {
    return JSON.stringify(e, null, 1);
  } catch {
    return String(e);
  }
}, "stringify"), gd = /* @__PURE__ */ a((e, t) => e.flatMap(
  (r, o) => o === e.length - 1 ? [r] : [r, C.cloneElement(t, { key: `sep${o}` })]
), "interleave"), vt = /* @__PURE__ */ a(({
  value: e,
  nested: t,
  showObjectInspector: r,
  callsById: o,
  ...n
}) => {
  switch (!0) {
    case e === null:
      return /* @__PURE__ */ C.createElement(Qv, { ...n });
    case e === void 0:
      return /* @__PURE__ */ C.createElement(eE, { ...n });
    case Array.isArray(e):
      return /* @__PURE__ */ C.createElement(nE, { ...n, value: e, callsById: o });
    case typeof e == "string":
      return /* @__PURE__ */ C.createElement(tE, { ...n, value: e });
    case typeof e == "number":
      return /* @__PURE__ */ C.createElement(rE, { ...n, value: e });
    case typeof e == "boolean":
      return /* @__PURE__ */ C.createElement(oE, { ...n, value: e });
    case Object.prototype.hasOwnProperty.call(e, "__date__"):
      return /* @__PURE__ */ C.createElement(cE, { ...n, ...e.__date__ });
    case Object.prototype.hasOwnProperty.call(e, "__error__"):
      return /* @__PURE__ */ C.createElement(pE, { ...n, ...e.__error__ });
    case Object.prototype.hasOwnProperty.call(e, "__regexp__"):
      return /* @__PURE__ */ C.createElement(uE, { ...n, ...e.__regexp__ });
    case Object.prototype.hasOwnProperty.call(e, "__function__"):
      return /* @__PURE__ */ C.createElement(sE, { ...n, ...e.__function__ });
    case Object.prototype.hasOwnProperty.call(e, "__symbol__"):
      return /* @__PURE__ */ C.createElement(dE, { ...n, ...e.__symbol__ });
    case Object.prototype.hasOwnProperty.call(e, "__element__"):
      return /* @__PURE__ */ C.createElement(lE, { ...n, ...e.__element__ });
    case Object.prototype.hasOwnProperty.call(e, "__class__"):
      return /* @__PURE__ */ C.createElement(iE, { ...n, ...e.__class__ });
    case Object.prototype.hasOwnProperty.call(e, "__callId__"):
      return /* @__PURE__ */ C.createElement(Zo, { call: o?.get(e.__callId__), callsById: o });
    case Object.prototype.toString.call(e) === "[object Object]":
      return /* @__PURE__ */ C.createElement(
        aE,
        {
          value: e,
          showInspector: r,
          callsById: o,
          ...n
        }
      );
    default:
      return /* @__PURE__ */ C.createElement(fE, { value: e, ...n });
  }
}, "Node"), Qv = /* @__PURE__ */ a((e) => {
  let t = ce();
  return /* @__PURE__ */ C.createElement("span", { style: { color: t.nullish }, ...e }, "null");
}, "NullNode"), eE = /* @__PURE__ */ a((e) => {
  let t = ce();
  return /* @__PURE__ */ C.createElement("span", { style: { color: t.nullish }, ...e }, "undefined");
}, "UndefinedNode"), tE = /* @__PURE__ */ a(({ value: e, ...t }) => {
  let r = ce();
  return /* @__PURE__ */ C.createElement("span", { style: { color: r.string }, ...t }, JSON.stringify(md(e, 50)));
}, "StringNode"), rE = /* @__PURE__ */ a(({ value: e, ...t }) => {
  let r = ce();
  return /* @__PURE__ */ C.createElement("span", { style: { color: r.number }, ...t }, e);
}, "NumberNode"), oE = /* @__PURE__ */ a(({ value: e, ...t }) => {
  let r = ce();
  return /* @__PURE__ */ C.createElement("span", { style: { color: r.boolean }, ...t }, String(e));
}, "BooleanNode"), nE = /* @__PURE__ */ a(({
  value: e,
  nested: t = !1,
  callsById: r
}) => {
  let o = ce();
  if (t)
    return /* @__PURE__ */ C.createElement("span", { style: { color: o.base } }, "[\u2026]");
  let n = e.slice(0, 3).map((s, l) => /* @__PURE__ */ C.createElement(vt, { key: `${l}--${JSON.stringify(s)}`, value: s, nested: !0, callsById: r })),
  i = gd(n, /* @__PURE__ */ C.createElement("span", null, ", "));
  return e.length <= 3 ? /* @__PURE__ */ C.createElement("span", { style: { color: o.base } }, "[", i, "]") : /* @__PURE__ */ C.createElement(
  "span", { style: { color: o.base } }, "(", e.length, ") [", i, ", \u2026]");
}, "ArrayNode"), aE = /* @__PURE__ */ a(({
  showInspector: e,
  value: t,
  callsById: r,
  nested: o = !1
}) => {
  let n = hi().base === "dark", i = ce();
  if (e)
    return /* @__PURE__ */ C.createElement(C.Fragment, null, /* @__PURE__ */ C.createElement(
      Xo,
      {
        id: "interactions-object-inspector",
        data: t,
        includePrototypes: !1,
        colorScheme: n ? "dark" : "light"
      }
    ));
  if (o)
    return /* @__PURE__ */ C.createElement("span", { style: { color: i.base } }, "{\u2026}");
  let s = gd(
    Object.entries(t).slice(0, 2).map(([l, c]) => /* @__PURE__ */ C.createElement(Gv, { key: l }, /* @__PURE__ */ C.createElement("span", { style: {
    color: i.objectkey } }, l, ": "), /* @__PURE__ */ C.createElement(vt, { value: c, callsById: r, nested: !0 }))),
    /* @__PURE__ */ C.createElement("span", null, ", ")
  );
  return Object.keys(t).length <= 2 ? /* @__PURE__ */ C.createElement("span", { style: { color: i.base } }, "{ ", s, " }") : /* @__PURE__ */ C.
  createElement("span", { style: { color: i.base } }, "(", Object.keys(t).length, ") ", "{ ", s, ", \u2026 }");
}, "ObjectNode"), iE = /* @__PURE__ */ a(({ name: e }) => {
  let t = ce();
  return /* @__PURE__ */ C.createElement("span", { style: { color: t.instance } }, e);
}, "ClassNode"), sE = /* @__PURE__ */ a(({ name: e }) => {
  let t = ce();
  return e ? /* @__PURE__ */ C.createElement("span", { style: { color: t.function } }, e) : /* @__PURE__ */ C.createElement("span", { style: {
  color: t.nullish, fontStyle: "italic" } }, "anonymous");
}, "FunctionNode"), lE = /* @__PURE__ */ a(({
  prefix: e,
  localName: t,
  id: r,
  classNames: o = [],
  innerText: n
}) => {
  let i = e ? `${e}:${t}` : t, s = ce();
  return /* @__PURE__ */ C.createElement("span", { style: { wordBreak: "keep-all" } }, /* @__PURE__ */ C.createElement("span", { key: `${i}_\
lt`, style: { color: s.muted } }, "<"), /* @__PURE__ */ C.createElement("span", { key: `${i}_tag`, style: { color: s.tag.name } }, i), /* @__PURE__ */ C.
  createElement("span", { key: `${i}_suffix`, style: { color: s.tag.suffix } }, r ? `#${r}` : o.reduce((l, c) => `${l}.${c}`, "")), /* @__PURE__ */ C.
  createElement("span", { key: `${i}_gt`, style: { color: s.muted } }, ">"), !r && o.length === 0 && n && /* @__PURE__ */ C.createElement(C.
  Fragment, null, /* @__PURE__ */ C.createElement("span", { key: `${i}_text` }, n), /* @__PURE__ */ C.createElement("span", { key: `${i}_clo\
se_lt`, style: { color: s.muted } }, "<"), /* @__PURE__ */ C.createElement("span", { key: `${i}_close_tag`, style: { color: s.tag.name } }, "\
/", i), /* @__PURE__ */ C.createElement("span", { key: `${i}_close_gt`, style: { color: s.muted } }, ">")));
}, "ElementNode"), cE = /* @__PURE__ */ a(({ value: e }) => {
  let t = new Date(e);
  isNaN(Number(t)) && (Jv.warn("Invalid date value:", e), t = null);
  let r = ce();
  if (!t)
    return /* @__PURE__ */ C.createElement("span", { style: { whiteSpace: "nowrap", color: r.date } }, "Invalid date");
  let [o, n, i] = t.toISOString().split(/[T.Z]/);
  return /* @__PURE__ */ C.createElement("span", { style: { whiteSpace: "nowrap", color: r.date } }, o, /* @__PURE__ */ C.createElement("spa\
n", { style: { opacity: 0.7 } }, "T"), n === "00:00:00" ? /* @__PURE__ */ C.createElement("span", { style: { opacity: 0.7 } }, n) : n, i ===
  "000" ? /* @__PURE__ */ C.createElement("span", { style: { opacity: 0.7 } }, ".", i) : `.${i}`, /* @__PURE__ */ C.createElement("span", { style: {
  opacity: 0.7 } }, "Z"));
}, "DateNode"), pE = /* @__PURE__ */ a(({ name: e, message: t }) => {
  let r = ce();
  return /* @__PURE__ */ C.createElement("span", { style: { color: r.error.name } }, e, t && ": ", t && /* @__PURE__ */ C.createElement("spa\
n", { style: { color: r.error.message }, title: t.length > 50 ? t : "" }, md(t, 50)));
}, "ErrorNode"), uE = /* @__PURE__ */ a(({ flags: e, source: t }) => {
  let r = ce();
  return /* @__PURE__ */ C.createElement("span", { style: { whiteSpace: "nowrap", color: r.regex.flags } }, "/", /* @__PURE__ */ C.createElement(
  "span", { style: { color: r.regex.source } }, t), "/", e);
}, "RegExpNode"), dE = /* @__PURE__ */ a(({ description: e }) => {
  let t = ce();
  return /* @__PURE__ */ C.createElement("span", { style: { whiteSpace: "nowrap", color: t.instance } }, "Symbol(", e && /* @__PURE__ */ C.createElement(
  "span", { style: { color: t.meta } }, '"', e, '"'), ")");
}, "SymbolNode"), fE = /* @__PURE__ */ a(({ value: e }) => {
  let t = ce();
  return /* @__PURE__ */ C.createElement("span", { style: { color: t.meta } }, Zv(e));
}, "OtherNode"), mE = /* @__PURE__ */ a(({ label: e }) => {
  let t = ce(), { typography: r } = hi();
  return /* @__PURE__ */ C.createElement(
    "span",
    {
      style: {
        color: t.base,
        fontFamily: r.fonts.base,
        fontSize: r.size.s2 - 1
      }
    },
    e
  );
}, "StepNode"), Zo = /* @__PURE__ */ a(({
  call: e,
  callsById: t
}) => {
  if (!e)
    return null;
  if (e.method === "step" && e.path?.length === 0)
    return /* @__PURE__ */ C.createElement(mE, { label: e.args[0] });
  let r = e.path?.flatMap((i, s) => {
    let l = i.__callId__;
    return [
      l ? /* @__PURE__ */ C.createElement(Zo, { key: `elem${s}`, call: t?.get(l), callsById: t }) : /* @__PURE__ */ C.createElement("span", {
      key: `elem${s}` }, i),
      /* @__PURE__ */ C.createElement("wbr", { key: `wbr${s}` }),
      /* @__PURE__ */ C.createElement("span", { key: `dot${s}` }, ".")
    ];
  }), o = e.args?.flatMap((i, s, l) => {
    let c = /* @__PURE__ */ C.createElement(vt, { key: `node${s}`, value: i, callsById: t });
    return s < l.length - 1 ? [c, /* @__PURE__ */ C.createElement("span", { key: `comma${s}` }, ",\xA0"), /* @__PURE__ */ C.createElement("w\
br", { key: `wbr${s}` })] : [c];
  }), n = ce();
  return /* @__PURE__ */ C.createElement(C.Fragment, null, /* @__PURE__ */ C.createElement("span", { style: { color: n.base } }, r), /* @__PURE__ */ C.
  createElement("span", { style: { color: n.method } }, e.method), /* @__PURE__ */ C.createElement("span", { style: { color: n.base } }, "(",
  /* @__PURE__ */ C.createElement("wbr", null), o, /* @__PURE__ */ C.createElement("wbr", null), ")"));
}, "MethodCall");

// src/component-testing/components/MatcherResult.tsx
var hd = /* @__PURE__ */ a((e, t = 0) => {
  for (let r = t, o = 1; r < e.length; r += 1)
    if (e[r] === "(" ? o += 1 : e[r] === ")" && (o -= 1), o === 0)
      return e.slice(t, r);
  return "";
}, "getParams"), yi = /* @__PURE__ */ a((e) => {
  try {
    return e === "undefined" ? void 0 : JSON.parse(e);
  } catch {
    return e;
  }
}, "parseValue"), hE = yd.span(({ theme: e }) => ({
  color: e.base === "light" ? e.color.positiveText : e.color.positive
})), yE = yd.span(({ theme: e }) => ({
  color: e.base === "light" ? e.color.negativeText : e.color.negative
})), bi = /* @__PURE__ */ a(({ value: e, parsed: t }) => t ? /* @__PURE__ */ Y.createElement(vt, { showObjectInspector: !0, value: e, style: {
color: "#D43900" } }) : /* @__PURE__ */ Y.createElement(yE, null, e), "Received"), xi = /* @__PURE__ */ a(({ value: e, parsed: t }) => t ? typeof e ==
"string" && e.startsWith("called with") ? /* @__PURE__ */ Y.createElement(Y.Fragment, null, e) : /* @__PURE__ */ Y.createElement(vt, { showObjectInspector: !0,
value: e, style: { color: "#16B242" } }) : /* @__PURE__ */ Y.createElement(hE, null, e), "Expected"), vi = /* @__PURE__ */ a(({
  message: e,
  style: t = {}
}) => {
  let r = Qt(), o = e.split(`
`);
  return /* @__PURE__ */ Y.createElement(
    "pre",
    {
      style: {
        margin: 0,
        padding: "8px 10px 8px 36px",
        fontSize: gE.size.s1,
        ...t
      }
    },
    o.flatMap((n, i) => {
      if (n.startsWith("expect(")) {
        let g = hd(n, 7), p = g ? 7 + g.length : 0, m = g && n.slice(p).match(/\.(to|last|nth)[A-Z]\w+\(/);
        if (m) {
          let f = p + (m.index ?? 0) + m[0].length, y = hd(n, f);
          if (y)
            return [
              "expect(",
              /* @__PURE__ */ Y.createElement(bi, { key: `received_${g}`, value: g }),
              n.slice(p, f),
              /* @__PURE__ */ Y.createElement(xi, { key: `expected_${y}`, value: y }),
              n.slice(f + y.length),
              /* @__PURE__ */ Y.createElement("br", { key: `br${i}` })
            ];
        }
      }
      if (n.match(/^\s*- /))
        return [/* @__PURE__ */ Y.createElement(xi, { key: n + i, value: n }), /* @__PURE__ */ Y.createElement("br", { key: `br${i}` })];
      if (n.match(/^\s*\+ /) || n.match(/^Received: $/))
        return [/* @__PURE__ */ Y.createElement(bi, { key: n + i, value: n }), /* @__PURE__ */ Y.createElement("br", { key: `br${i}` })];
      let [, s, l] = n.match(/^(Expected|Received): (.*)$/) || [];
      if (s && l)
        return s === "Expected" ? [
          "Expected: ",
          /* @__PURE__ */ Y.createElement(xi, { key: n + i, value: yi(l), parsed: !0 }),
          /* @__PURE__ */ Y.createElement("br", { key: `br${i}` })
        ] : [
          "Received: ",
          /* @__PURE__ */ Y.createElement(bi, { key: n + i, value: yi(l), parsed: !0 }),
          /* @__PURE__ */ Y.createElement("br", { key: `br${i}` })
        ];
      let [, c, u] = n.match(/(Expected number|Received number|Number) of calls: (\d+)$/i) || [];
      if (c && u)
        return [
          `${c} of calls: `,
          /* @__PURE__ */ Y.createElement(vt, { key: n + i, value: Number(u) }),
          /* @__PURE__ */ Y.createElement("br", { key: `br${i}` })
        ];
      let [, d] = n.match(/^Received has value: (.+)$/) || [];
      return d ? [
        "Received has value: ",
        /* @__PURE__ */ Y.createElement(vt, { key: n + i, value: yi(d) }),
        /* @__PURE__ */ Y.createElement("br", { key: `br${i}` })
      ] : [
        /* @__PURE__ */ Y.createElement(
          "span",
          {
            key: n + i,
            dangerouslySetInnerHTML: { __html: r.toHtml(n) }
          }
        ),
        /* @__PURE__ */ Y.createElement("br", { key: `br${i}` })
      ];
    })
  );
}, "MatcherResult");

// src/component-testing/components/StatusIcon.tsx
import Ir from "react";
import { CheckIcon as bE, CircleIcon as xE, PlayIcon as vE, StopAltIcon as EE } from "@storybook/icons";
import { styled as SE, useTheme as CE } from "storybook/theming";
var wE = SE.div({
  width: 14,
  height: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
}), Qo = /* @__PURE__ */ a(({ status: e }) => {
  let t = CE();
  switch (e) {
    case "done":
      return /* @__PURE__ */ Ir.createElement(bE, { color: t.color.positive, "data-testid": "icon-done" });
    case "error":
      return /* @__PURE__ */ Ir.createElement(EE, { color: t.color.negative, "data-testid": "icon-error" });
    case "active":
      return /* @__PURE__ */ Ir.createElement(vE, { color: t.color.secondary, "data-testid": "icon-active" });
    case "waiting":
      return /* @__PURE__ */ Ir.createElement(wE, { "data-testid": "icon-waiting" }, /* @__PURE__ */ Ir.createElement(xE, { color: B(0.5, "#\
CCCCCC"), size: 6 }));
    default:
      return null;
  }
}, "StatusIcon");

// src/component-testing/components/Interaction.tsx
var PE = He.div({
  fontFamily: en.fonts.mono,
  fontSize: en.size.s1,
  overflowWrap: "break-word",
  inlineSize: "calc( 100% - 40px )"
}), LE = He("div", {
  shouldForwardProp: /* @__PURE__ */ a((e) => !["call", "pausedAt"].includes(e.toString()), "shouldForwardProp")
})(
  ({ theme: e, call: t }) => ({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    borderBottom: `1px solid ${e.appBorderColor}`,
    fontFamily: en.fonts.base,
    fontSize: 13,
    ...t.status === "error" && {
      backgroundColor: e.base === "dark" ? B(0.93, e.color.negative) : e.background.warning
    },
    paddingLeft: (t.ancestors?.length ?? 0) * 20
  }),
  ({ theme: e, call: t, pausedAt: r }) => r === t.id && {
    "&::before": {
      content: '""',
      position: "absolute",
      top: -5,
      zIndex: 1,
      borderTop: "4.5px solid transparent",
      borderLeft: `7px solid ${e.color.warning}`,
      borderBottom: "4.5px solid transparent"
    },
    "&::after": {
      content: '""',
      position: "absolute",
      top: -1,
      zIndex: 1,
      width: "100%",
      borderTop: `1.5px solid ${e.color.warning}`
    }
  }
), NE = He.div(({ theme: e, isInteractive: t }) => ({
  display: "flex",
  "&:hover": t ? {} : { background: e.background.hoverable }
})), _E = He("button", {
  shouldForwardProp: /* @__PURE__ */ a((e) => !["call"].includes(e.toString()), "shouldForwardProp")
})(({ theme: e, disabled: t, call: r }) => ({
  flex: 1,
  display: "grid",
  background: "none",
  border: 0,
  gridTemplateColumns: "15px 1fr",
  alignItems: "center",
  minHeight: 40,
  margin: 0,
  padding: "8px 15px",
  textAlign: "start",
  cursor: t || r.status === "error" ? "default" : "pointer",
  "&:focus-visible": {
    outline: 0,
    boxShadow: `inset 3px 0 0 0 ${r.status === "error" ? e.color.warning : e.color.secondary}`,
    background: r.status === "error" ? "transparent" : e.background.hoverable
  },
  "& > div": {
    opacity: r.status === "waiting" ? 0.5 : 1
  }
})), DE = He.div({
  display: "flex",
  alignItems: "center",
  padding: 6
}), ME = He(TE)(({ theme: e }) => ({
  color: e.textMutedColor,
  margin: "0 3px"
})), BE = He(AE)(({ theme: e }) => ({
  fontFamily: e.typography.fonts.base
})), Ei = He("div")(({ theme: e }) => ({
  padding: "8px 10px 8px 36px",
  fontSize: en.size.s1,
  color: e.color.defaultText,
  pre: {
    margin: 0,
    padding: 0
  }
})), FE = He.span(({ theme: e }) => ({
  color: e.base === "dark" ? "#5EC1FF" : "#0271B6"
})), RE = He.span(({ theme: e }) => ({
  color: e.base === "dark" ? "#eee" : "#444"
})), jE = He.p(({ theme: e }) => ({
  color: e.base === "dark" ? e.color.negative : e.color.negativeText,
  fontSize: e.typography.size.s2,
  maxWidth: 500,
  textWrap: "balance"
})), HE = /* @__PURE__ */ a(({ exception: e }) => {
  let t = Qt();
  if (!e)
    return null;
  if (e.callId === Pe)
    return /* @__PURE__ */ W.createElement(Ei, null, /* @__PURE__ */ W.createElement("pre", null, /* @__PURE__ */ W.createElement(FE, null, e.
    name, ":"), " ", /* @__PURE__ */ W.createElement(RE, null, e.message)), /* @__PURE__ */ W.createElement(jE, null, "The component failed \
to render properly. Automated component tests will not run until this is resolved. Check the full error message in Storybook\u2019s canvas to deb\
ug."));
  if (ri(e))
    return /* @__PURE__ */ W.createElement(vi, { ...e });
  if (ti(e))
    return /* @__PURE__ */ W.createElement(Ei, null, /* @__PURE__ */ W.createElement(
      vi,
      {
        message: `${e.message}${e.diff ? `

${e.diff}` : ""}`,
        style: { padding: 0 }
      }
    ), /* @__PURE__ */ W.createElement("p", null, "See the full stack trace in the browser console."));
  let r = e.message.split(`

`), o = r.length > 1;
  return /* @__PURE__ */ W.createElement(Ei, null, /* @__PURE__ */ W.createElement("pre", { dangerouslySetInnerHTML: { __html: t.toHtml(r[0]) } }),
  o && /* @__PURE__ */ W.createElement("p", null, "See the full stack trace in the browser console."));
}, "Exception"), bd = /* @__PURE__ */ a(({
  call: e,
  callsById: t,
  controls: r,
  controlStates: o,
  childCallIds: n,
  isHidden: i,
  isCollapsed: s,
  toggleCollapsed: l,
  pausedAt: c
}) => {
  let [u, d] = W.useState(!1), g = !o.goto || !e.interceptable || !!e.ancestors?.length;
  return i || e.id === Pe ? null : /* @__PURE__ */ W.createElement(LE, { call: e, pausedAt: c }, /* @__PURE__ */ W.createElement(NE, { isInteractive: g },
  /* @__PURE__ */ W.createElement(
    _E,
    {
      "aria-label": "Interaction step",
      call: e,
      onClick: () => r.goto(e.id),
      disabled: g,
      onMouseEnter: () => o.goto && d(!0),
      onMouseLeave: () => o.goto && d(!1)
    },
    /* @__PURE__ */ W.createElement(Qo, { status: u ? "active" : e.status }),
    /* @__PURE__ */ W.createElement(PE, { style: { marginLeft: 6, marginBottom: 1 } }, /* @__PURE__ */ W.createElement(Zo, { call: e, callsById: t }))
  ), /* @__PURE__ */ W.createElement(DE, null, (n?.length ?? 0) > 0 && /* @__PURE__ */ W.createElement(
    kE,
    {
      hasChrome: !1,
      tooltip: /* @__PURE__ */ W.createElement(BE, { note: `${s ? "Show" : "Hide"} interactions` })
    },
    /* @__PURE__ */ W.createElement(
      ME,
      {
        onClick: l,
        "aria-label": s ? "Expand interaction" : "Collapse interaction"
      },
      s ? /* @__PURE__ */ W.createElement(OE, null) : /* @__PURE__ */ W.createElement(IE, null)
    )
  ))), e.status === "error" && e.exception?.callId === e.id && /* @__PURE__ */ W.createElement(HE, { exception: e.exception }));
}, "Interaction");

// src/component-testing/components/Subnav.tsx
import U from "react";
import {
  Bar as WE,
  Button as GE,
  IconButton as JE,
  P as KE,
  Separator as YE,
  TooltipNote as XE,
  WithTooltip as Pr
} from "storybook/internal/components";
import {
  FastForwardIcon as ZE,
  PlayBackIcon as QE,
  PlayNextIcon as eS,
  RewindIcon as tS,
  SyncIcon as rS
} from "@storybook/icons";
import { styled as $e, useTheme as oS } from "storybook/theming";

// src/component-testing/components/StatusBadge.tsx
import $E from "react";
import { styled as VE, typography as Si } from "storybook/theming";
var zE = {
  rendering: "mediumdark",
  playing: "warning",
  completed: "positive",
  errored: "negative",
  aborted: "purple"
}, UE = {
  rendering: "Wait",
  playing: "Runs",
  completed: "Pass",
  errored: "Fail",
  aborted: "Bail"
}, qE = VE.div(({ theme: e, status: t }) => ({
  display: "inline-block",
  padding: "4px 6px 4px 8px",
  borderRadius: "4px",
  backgroundColor: e.color[zE[t]],
  color: "white",
  fontFamily: Si.fonts.base,
  textTransform: "uppercase",
  fontSize: Si.size.s1,
  letterSpacing: 3,
  fontWeight: Si.weight.bold,
  minWidth: 65,
  textAlign: "center"
})), xd = /* @__PURE__ */ a(({ status: e }) => {
  let t = UE[e];
  return /* @__PURE__ */ $E.createElement(qE, { "aria-label": "Status of the test run", status: e }, t);
}, "StatusBadge");

// src/component-testing/components/Subnav.tsx
var nS = $e.div(({ theme: e }) => ({
  boxShadow: `${e.appBorderColor} 0 -1px 0 0 inset`,
  background: e.background.app,
  position: "sticky",
  top: 0,
  zIndex: 1
})), aS = $e.nav({
  height: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingLeft: 15
}), iS = $e(GE)(({ theme: e }) => ({
  borderRadius: 4,
  padding: 6,
  color: e.textMutedColor,
  "&:not(:disabled)": {
    "&:hover,&:focus-visible": {
      color: e.color.secondary
    }
  }
})), Lr = $e(XE)(({ theme: e }) => ({
  fontFamily: e.typography.fonts.base
})), Nr = $e(JE)(({ theme: e }) => ({
  color: e.textMutedColor,
  margin: "0 3px"
})), sS = $e(YE)({
  marginTop: 0
}), lS = $e(KE)(({ theme: e }) => ({
  color: e.textMutedColor,
  justifyContent: "flex-end",
  textAlign: "right",
  whiteSpace: "nowrap",
  marginTop: "auto",
  marginBottom: 1,
  paddingRight: 15,
  fontSize: 13
})), vd = $e.div({
  display: "flex",
  alignItems: "center"
}), cS = $e(Nr)({
  marginLeft: 9
}), pS = $e(iS)({
  marginLeft: 9,
  marginRight: 9,
  marginBottom: 1,
  lineHeight: "12px"
}), uS = $e(Nr)(({ theme: e, animating: t, disabled: r }) => ({
  opacity: r ? 0.5 : 1,
  svg: {
    animation: t ? `${e.animation.rotate360} 200ms ease-out` : void 0
  }
})), Ed = /* @__PURE__ */ a(({
  controls: e,
  controlStates: t,
  status: r,
  storyFileName: o,
  onScrollToEnd: n
}) => {
  let i = r === "errored" ? "Scroll to error" : "Scroll to end", s = oS();
  return /* @__PURE__ */ U.createElement(nS, null, /* @__PURE__ */ U.createElement(WE, { backgroundColor: s.background.app }, /* @__PURE__ */ U.
  createElement(aS, { "aria-label": "Component tests toolbar" }, /* @__PURE__ */ U.createElement(vd, null, /* @__PURE__ */ U.createElement(xd,
  { status: r }), /* @__PURE__ */ U.createElement(pS, { onClick: n, disabled: !n }, i), /* @__PURE__ */ U.createElement(sS, null), /* @__PURE__ */ U.
  createElement(Pr, { trigger: "hover", hasChrome: !1, tooltip: /* @__PURE__ */ U.createElement(Lr, { note: "Go to start" }) }, /* @__PURE__ */ U.
  createElement(
    cS,
    {
      "aria-label": "Go to start",
      onClick: e.start,
      disabled: !t.start
    },
    /* @__PURE__ */ U.createElement(tS, null)
  )), /* @__PURE__ */ U.createElement(Pr, { trigger: "hover", hasChrome: !1, tooltip: /* @__PURE__ */ U.createElement(Lr, { note: "Go back" }) },
  /* @__PURE__ */ U.createElement(
    Nr,
    {
      "aria-label": "Go back",
      onClick: e.back,
      disabled: !t.back
    },
    /* @__PURE__ */ U.createElement(QE, null)
  )), /* @__PURE__ */ U.createElement(Pr, { trigger: "hover", hasChrome: !1, tooltip: /* @__PURE__ */ U.createElement(Lr, { note: "Go forwar\
d" }) }, /* @__PURE__ */ U.createElement(
    Nr,
    {
      "aria-label": "Go forward",
      onClick: e.next,
      disabled: !t.next
    },
    /* @__PURE__ */ U.createElement(eS, null)
  )), /* @__PURE__ */ U.createElement(Pr, { trigger: "hover", hasChrome: !1, tooltip: /* @__PURE__ */ U.createElement(Lr, { note: "Go to end" }) },
  /* @__PURE__ */ U.createElement(
    Nr,
    {
      "aria-label": "Go to end",
      onClick: e.end,
      disabled: !t.end
    },
    /* @__PURE__ */ U.createElement(ZE, null)
  )), /* @__PURE__ */ U.createElement(Pr, { trigger: "hover", hasChrome: !1, tooltip: /* @__PURE__ */ U.createElement(Lr, { note: "Rerun" }) },
  /* @__PURE__ */ U.createElement(uS, { "aria-label": "Rerun", onClick: e.rerun }, /* @__PURE__ */ U.createElement(rS, null)))), o && /* @__PURE__ */ U.
  createElement(vd, null, /* @__PURE__ */ U.createElement(lS, null, o)))));
}, "Subnav");

// src/component-testing/components/TestDiscrepancyMessage.tsx
import Sd from "react";
import { Link as dS } from "storybook/internal/components";
import { useStorybookApi as fS } from "storybook/manager-api";
import { styled as mS } from "storybook/theming";
var gS = mS.div(({ theme: { color: e, typography: t, background: r } }) => ({
  textAlign: "start",
  padding: "11px 15px",
  fontSize: `${t.size.s2 - 1}px`,
  fontWeight: t.weight.regular,
  lineHeight: "1rem",
  background: r.app,
  borderBottom: `1px solid ${e.border}`,
  color: e.defaultText,
  backgroundClip: "padding-box",
  position: "relative",
  code: {
    fontSize: `${t.size.s1 - 1}px`,
    color: "inherit",
    margin: "0 0.2em",
    padding: "0 0.2em",
    background: "rgba(255, 255, 255, 0.8)",
    borderRadius: "2px",
    boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.1)"
  }
})), Cd = /* @__PURE__ */ a(({ browserTestStatus: e }) => {
  let r = fS().getDocsUrl({
    subpath: Wp,
    versioned: !0,
    renderer: !0
  }), [o, n] = e === "error" ? ["the CLI", "this browser"] : ["this browser", "the CLI"];
  return /* @__PURE__ */ Sd.createElement(gS, null, "This interaction test passed in ", o, ", but the tests failed in ", n, ".", " ", /* @__PURE__ */ Sd.
  createElement(dS, { href: r, target: "_blank", withArrow: !0 }, "Learn what could cause this"));
}, "TestDiscrepancyMessage");

// src/component-testing/components/InteractionsPanel.tsx
var hS = er.div(({ theme: e }) => ({
  height: "100%",
  background: e.background.content
})), wd = er.div(({ theme: e }) => ({
  borderBottom: `1px solid ${e.appBorderColor}`,
  backgroundColor: e.base === "dark" ? B(0.93, e.color.negative) : e.background.warning,
  padding: 15,
  fontSize: e.typography.size.s2 - 1,
  lineHeight: "19px"
})), Ci = er.code(({ theme: e }) => ({
  margin: "0 1px",
  padding: 3,
  fontSize: e.typography.size.s1 - 1,
  lineHeight: 1,
  verticalAlign: "top",
  background: "rgba(0, 0, 0, 0.05)",
  border: `1px solid ${e.appBorderColor}`,
  borderRadius: 3
})), Td = er.div({
  paddingBottom: 4,
  fontWeight: "bold"
}), yS = er.p({
  margin: 0,
  padding: "0 0 20px"
}), Ad = er.pre(({ theme: e }) => ({
  margin: 0,
  padding: 0,
  "&:not(:last-child)": {
    paddingBottom: 16
  },
  fontSize: e.typography.size.s1 - 1
})), Od = Q.memo(
  /* @__PURE__ */ a(function({
    storyUrl: t,
    status: r,
    calls: o,
    controls: n,
    controlStates: i,
    interactions: s,
    fileName: l,
    hasException: c,
    caughtException: u,
    unhandledErrors: d,
    pausedAt: g,
    onScrollToEnd: p,
    endRef: m,
    hasResultMismatch: f,
    browserTestStatus: y
  }) {
    let h = Qt(), b = s.some((x) => x.id !== Pe);
    return /* @__PURE__ */ Q.createElement(hS, null, f && /* @__PURE__ */ Q.createElement(Cd, { browserTestStatus: y }), i.detached && (b ||
    c) && /* @__PURE__ */ Q.createElement(Iu, { storyUrl: t }), /* @__PURE__ */ Q.createElement(
      Ed,
      {
        controls: n,
        controlStates: i,
        status: r,
        storyFileName: l,
        onScrollToEnd: p
      }
    ), /* @__PURE__ */ Q.createElement("div", { "aria-label": "Interactions list" }, s.map((x) => /* @__PURE__ */ Q.createElement(
      bd,
      {
        key: x.id,
        call: x,
        callsById: o,
        controls: n,
        controlStates: i,
        childCallIds: x.childCallIds,
        isHidden: x.isHidden,
        isCollapsed: x.isCollapsed,
        toggleCollapsed: x.toggleCollapsed,
        pausedAt: g
      }
    ))), u && !ku(u) && /* @__PURE__ */ Q.createElement(wd, null, /* @__PURE__ */ Q.createElement(Td, null, "Caught exception in ", /* @__PURE__ */ Q.createElement(
    Ci, null, "play"), " function"), /* @__PURE__ */ Q.createElement(
      Ad,
      {
        "data-chromatic": "ignore",
        dangerouslySetInnerHTML: {
          __html: h.toHtml(kd(u))
        }
      }
    )), d && /* @__PURE__ */ Q.createElement(wd, null, /* @__PURE__ */ Q.createElement(Td, null, "Unhandled Errors"), /* @__PURE__ */ Q.createElement(
    yS, null, "Found ", d.length, " unhandled error", d.length > 1 ? "s" : "", " ", "while running the play function. This might cause false\
 positive assertions. Resolve unhandled errors or ignore unhandled errors with setting the", /* @__PURE__ */ Q.createElement(Ci, null, "test\
.dangerouslyIgnoreUnhandledErrors"), " ", "parameter to ", /* @__PURE__ */ Q.createElement(Ci, null, "true"), "."), d.map((x, v) => /* @__PURE__ */ Q.createElement(
    Ad, { key: v, "data-chromatic": "ignore" }, kd(x)))), /* @__PURE__ */ Q.createElement("div", { ref: m }), r === "completed" && !u && !b &&
    /* @__PURE__ */ Q.createElement(Pu, null));
  }, "InteractionsPanel")
);
function kd(e) {
  return e.stack || `${e.name}: ${e.message}`;
}
a(kd, "printSerializedError");

// src/component-testing/components/Panel.tsx
var _r = {
  detached: !1,
  start: !1,
  back: !1,
  goto: !1,
  next: !1,
  end: !1
}, Ld = {
  rendering: "rendering",
  playing: "playing",
  completed: "completed",
  errored: "errored",
  aborted: "aborted"
}, IS = {
  done: "status-value:success",
  error: "status-value:error",
  active: "status-value:pending",
  waiting: "status-value:pending"
}, PS = /* @__PURE__ */ a(({
  log: e,
  calls: t,
  collapsed: r,
  setCollapsed: o
}) => {
  let n = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
  return e.map(({ callId: l, ancestors: c, status: u }) => {
    let d = !1;
    return c.forEach((g) => {
      r.has(g) && (d = !0), i.set(g, (i.get(g) || []).concat(l));
    }), { ...t.get(l), status: u, isHidden: d };
  }).map((l) => {
    let c = l.status === "error" && l.ancestors && n.get(l.ancestors.slice(-1)[0])?.status === "active" ? "active" : l.status;
    return n.set(l.id, { ...l, status: c }), {
      ...l,
      status: c,
      childCallIds: i.get(l.id),
      isCollapsed: r.has(l.id),
      toggleCollapsed: /* @__PURE__ */ a(() => o((u) => (u.has(l.id) ? u.delete(l.id) : u.add(l.id), new Set(u))), "toggleCollapsed")
    };
  });
}, "getInteractions"), rn = /* @__PURE__ */ a((e, {
  log: t,
  calls: r,
  collapsed: o,
  setCollapsed: n
}) => PS({ log: t, calls: r, collapsed: o, setCollapsed: n }).reduce(
  (i, s) => (s.id === Pe ? i.interactions.push(s) : e.status !== "rendering" && (i.controlStates = e.controlStates, i.interactions.push(s), s.
  method !== "step" && i.interactionsCount++), i),
  {
    ...e,
    controlStates: _r,
    interactions: [],
    interactionsCount: 0
  }
), "getPanelState"), ki = /* @__PURE__ */ a((e, t) => ({
  id: Pe,
  method: "render",
  args: [],
  cursor: 0,
  storyId: e,
  ancestors: [],
  path: [],
  interceptable: !0,
  retain: !1,
  exception: t
}), "getInternalRenderCall"), on = /* @__PURE__ */ a((e) => ({
  callId: Pe,
  status: e,
  ancestors: []
}), "getInternalRenderLogItem"), Nd = xS(
  /* @__PURE__ */ a(function({ refId: t, storyId: r, storyUrl: o }) {
    let { statusValue: n, testRunId: i } = TS((_) => {
      let j = t ? void 0 : _[r]?.[Yp];
      return {
        statusValue: j?.value,
        testRunId: j?.data?.testRunId
      };
    }), [s, l] = AS(Lt, {
      status: "rendering",
      controlStates: _r,
      interactions: [],
      interactionsCount: 0,
      hasException: !1,
      pausedAt: void 0,
      caughtException: void 0,
      unhandledErrors: void 0
    }), [c, u] = Ti(void 0), [d, g] = Ti(/* @__PURE__ */ new Set()), [p, m] = Ti(!1), {
      status: f = "rendering",
      controlStates: y = _r,
      interactions: h = [],
      pausedAt: b = void 0,
      caughtException: x = void 0,
      unhandledErrors: v = void 0
    } = s, E = tn([on("active")]), S = tn(
      /* @__PURE__ */ new Map([[Pe, ki(r)]])
    ), w = /* @__PURE__ */ a(({ status: _, ...j }) => S.current.set(j.id, j), "setCall"), P = tn();
    wi(() => {
      let _;
      return Ai.IntersectionObserver && (_ = new Ai.IntersectionObserver(
        ([j]) => u(j.isIntersecting ? void 0 : j.target),
        { root: Ai.document.querySelector("#panel-tab-content") }
      ), P.current && _.observe(P.current)), () => _?.disconnect();
    }, []);
    let N = tn(0), q = kS(
      {
        [ht.CALL]: w,
        [ht.SYNC]: (_) => {
          E.current = [on("done"), ..._.logItems], l(
            (j) => rn(
              { ...j, controlStates: _.controlStates, pausedAt: _.pausedAt },
              { log: E.current, calls: S.current, collapsed: d, setCollapsed: g }
            )
          );
        },
        [SS]: (_) => {
          _.newPhase === "preparing" || _.newPhase === "loading" || (N.current = Math.max(N.current, _.renderId || 0), N.current === _.renderId &&
          (_.newPhase === "rendering" ? (E.current = [on("active")], S.current.set(Pe, ki(r)), l({
            status: "rendering",
            controlStates: _r,
            pausedAt: void 0,
            interactions: [],
            interactionsCount: 0,
            hasException: !1,
            caughtException: void 0,
            unhandledErrors: void 0
          })) : l((j) => {
            let T = _.newPhase in Ld ? Ld[_.newPhase] : j.status;
            return rn(
              { ...j, status: T, pausedAt: void 0 },
              { log: E.current, calls: S.current, collapsed: d, setCollapsed: g }
            );
          })));
        },
        [CS]: (_) => {
          E.current = [on("error")], S.current.set(
            Pe,
            ki(r, { ..._, callId: Pe })
          ), l(
            (j) => rn(
              {
                ...j,
                hasException: !0,
                caughtException: void 0,
                controlStates: _r,
                pausedAt: void 0
              },
              { log: E.current, calls: S.current, collapsed: d, setCollapsed: g }
            )
          );
        },
        [ES]: (_) => {
          l((j) => ({ ...j, caughtException: _, hasException: !0 }));
        },
        [wS]: (_) => {
          l((j) => ({ ...j, unhandledErrors: _, hasException: !0 }));
        }
      },
      [d]
    );
    wi(() => {
      l(
        (_) => rn(_, { log: E.current, calls: S.current, collapsed: d, setCollapsed: g })
      );
    }, [l, d]);
    let H = Pd(
      () => ({
        start: /* @__PURE__ */ a(() => q(ht.START, { storyId: r }), "start"),
        back: /* @__PURE__ */ a(() => q(ht.BACK, { storyId: r }), "back"),
        goto: /* @__PURE__ */ a((_) => q(ht.GOTO, { storyId: r, callId: _ }), "goto"),
        next: /* @__PURE__ */ a(() => q(ht.NEXT, { storyId: r }), "next"),
        end: /* @__PURE__ */ a(() => q(ht.END, { storyId: r }), "end"),
        rerun: /* @__PURE__ */ a(() => {
          q(vS, { storyId: r });
        }, "rerun")
      }),
      [q, r]
    ), G = OS("fileName", ""), [Z] = G.toString().split("/").slice(-1), se = /* @__PURE__ */ a(() => c?.scrollIntoView({ behavior: "smooth",
    block: "end" }), "scrollToTarget"), ee = !!x || !!v || h.some((_) => _.status === "error"), pe = Pd(() => f !== "playing" && (h.length >
    0 || ee) ? ee ? "error" : "done" : f === "playing" ? "active" : void 0, [f, h, ee]);
    return wi(() => {
      if (pe && n && n !== "status-value:pending" && n !== IS[pe]) {
        let j = setTimeout(
          () => m((T) => (T || q(Kp, {
            type: "test-discrepancy",
            payload: {
              browserStatus: pe === "done" ? "PASS" : "FAIL",
              cliStatus: pe === "done" ? "FAIL" : "PASS",
              storyId: r,
              testRunId: i
            }
          }), !0)),
          2e3
        );
        return () => clearTimeout(j);
      } else
        m(!1);
    }, [q, pe, n, r, i]), /* @__PURE__ */ Id.createElement(bS, { key: "component-tests" }, /* @__PURE__ */ Id.createElement(
      Od,
      {
        storyUrl: o,
        status: f,
        hasResultMismatch: p,
        browserTestStatus: pe,
        calls: S.current,
        controls: H,
        controlStates: { ...y, detached: !!t || y.detached },
        interactions: h,
        fileName: Z,
        hasException: ee,
        caughtException: x,
        unhandledErrors: v,
        pausedAt: b,
        endRef: P,
        onScrollToEnd: c && se
      }
    ));
  }, "PanelMemoized")
);

// src/component-testing/components/PanelTitle.tsx
import nn from "react";
import { Badge as LS } from "storybook/internal/components";
import { useAddonState as NS, useStorybookApi as _S } from "storybook/manager-api";
function _d() {
  let t = _S().getSelectedPanel(), [r = {}] = NS(Lt), { status: o, hasException: n, interactionsCount: i } = r;
  return /* @__PURE__ */ nn.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ nn.createElement(
  "span", null, "Interactions"), i && o !== "errored" && !n ? /* @__PURE__ */ nn.createElement(LS, { compact: !0, status: t === Zt ? "active" :
  "neutral" }, i) : null, o === "errored" || n ? /* @__PURE__ */ nn.createElement(Qo, { status: "error" }) : null);
}
a(_d, "PanelTitle");

// src/component-testing/manager.tsx
var Md = Dd.register(Lt, () => {
  if (globalThis?.FEATURES?.interactions) {
    let e = /* @__PURE__ */ a(({ state: t }) => {
      let r = t.refId && t.refs[t.refId]?.url || document.location.origin, { pathname: o, search: n = "" } = t.location, i = o + (t.refId ? n.
      replace(`/${t.refId}_`, "/") : n);
      return {
        refId: t.refId,
        storyId: t.storyId,
        storyUrl: r + i
      };
    }, "filter");
    Dd.add(Zt, {
      type: BS.PANEL,
      title: /* @__PURE__ */ a(() => /* @__PURE__ */ an.createElement(_d, null), "title"),
      match: /* @__PURE__ */ a(({ viewMode: t }) => t === "story", "match"),
      render: /* @__PURE__ */ a(({ active: t }) => /* @__PURE__ */ an.createElement(DS, { active: !!t }, /* @__PURE__ */ an.createElement(MS,
      { filter: e }, (r) => /* @__PURE__ */ an.createElement(Nd, { ...r }))), "render")
    });
  }
});

// src/backgrounds/manager.tsx
import KS from "react";
import { addons as Hd, types as YS } from "storybook/manager-api";

// src/backgrounds/components/Tool.tsx
import Je, { Fragment as FS, memo as Rd, useCallback as RS, useState as jS } from "react";
import { IconButton as Fd, TooltipLinkList as HS, WithTooltip as $S } from "storybook/internal/components";
import { CircleIcon as VS, GridIcon as zS, PhotoIcon as US, RefreshIcon as qS } from "@storybook/icons";
import { useGlobals as WS, useParameter as GS } from "storybook/manager-api";

// src/backgrounds/constants.ts
var sn = "storybook/background", Dr = "backgrounds";
var HB = {
  UPDATE: `${sn}/update`
};

// src/backgrounds/defaults.ts
var Bd = {
  light: { name: "light", value: "#F8F8F8" },
  dark: { name: "dark", value: "#333" }
};

// src/backgrounds/components/Tool.tsx
var jd = Rd(/* @__PURE__ */ a(function() {
  let t = GS(Dr), [r, o, n] = WS(), [i, s] = jS(!1), { options: l = Bd, disable: c = !0 } = t || {};
  if (c)
    return null;
  let u = r[Dr] || {}, d = u.value, g = u.grid || !1, p = l[d], m = !!n?.[Dr], f = Object.keys(l).length;
  return /* @__PURE__ */ Je.createElement(
    JS,
    {
      length: f,
      backgroundMap: l,
      item: p,
      updateGlobals: o,
      backgroundName: d,
      setIsTooltipVisible: s,
      isLocked: m,
      isGridActive: g,
      isTooltipVisible: i
    }
  );
}, "BackgroundSelector")), JS = Rd(/* @__PURE__ */ a(function(t) {
  let {
    item: r,
    length: o,
    updateGlobals: n,
    setIsTooltipVisible: i,
    backgroundMap: s,
    backgroundName: l,
    isLocked: c,
    isGridActive: u,
    isTooltipVisible: d
  } = t, g = RS(
    (p) => {
      n({
        [Dr]: p
      });
    },
    [n]
  );
  return /* @__PURE__ */ Je.createElement(FS, null, /* @__PURE__ */ Je.createElement(
    Fd,
    {
      key: "grid",
      active: u,
      disabled: c,
      title: "Apply a grid to the preview",
      onClick: () => g({ value: l, grid: !u })
    },
    /* @__PURE__ */ Je.createElement(zS, null)
  ), o > 0 ? /* @__PURE__ */ Je.createElement(
    $S,
    {
      key: "background",
      placement: "top",
      closeOnOutsideClick: !0,
      tooltip: ({ onHide: p }) => /* @__PURE__ */ Je.createElement(
        HS,
        {
          links: [
            ...r ? [
              {
                id: "reset",
                title: "Reset background",
                icon: /* @__PURE__ */ Je.createElement(qS, null),
                onClick: /* @__PURE__ */ a(() => {
                  g(void 0), p();
                }, "onClick")
              }
            ] : [],
            ...Object.entries(s).map(([m, f]) => ({
              id: m,
              title: f.name,
              icon: /* @__PURE__ */ Je.createElement(VS, { color: f?.value || "grey" }),
              active: m === l,
              onClick: /* @__PURE__ */ a(() => {
                g({ value: m, grid: u }), p();
              }, "onClick")
            }))
          ].flat()
        }
      ),
      onVisibleChange: i
    },
    /* @__PURE__ */ Je.createElement(
      Fd,
      {
        disabled: c,
        key: "background",
        title: "Change the background of the preview",
        active: !!r || d
      },
      /* @__PURE__ */ Je.createElement(US, null)
    )
  ) : null);
}, "PureTool"));

// src/backgrounds/manager.tsx
var $d = Hd.register(sn, () => {
  globalThis?.FEATURES?.backgrounds && Hd.add(sn, {
    title: "Backgrounds",
    type: YS.TOOL,
    match: /* @__PURE__ */ a(({ viewMode: e, tabId: t }) => !!(e && e.match(/^(story|docs)$/)) && !t, "match"),
    render: /* @__PURE__ */ a(() => /* @__PURE__ */ KS.createElement(jd, null), "render")
  });
});

// src/measure/manager.tsx
import oC from "react";
import { addons as Ud, types as nC } from "storybook/manager-api";

// src/measure/Tool.tsx
import Vd, { useCallback as XS, useEffect as ZS } from "react";
import { IconButton as QS } from "storybook/internal/components";
import { RulerIcon as eC } from "@storybook/icons";
import { useGlobals as tC, useStorybookApi as rC } from "storybook/manager-api";

// src/measure/constants.ts
var Et = "storybook/measure-addon", ln = `${Et}/tool`;
var o3 = {
  RESULT: `${Et}/result`,
  REQUEST: `${Et}/request`,
  CLEAR: `${Et}/clear`
};

// src/measure/Tool.tsx
var zd = /* @__PURE__ */ a(() => {
  let [e, t] = tC(), { measureEnabled: r } = e || {}, o = rC(), n = XS(
    () => t({
      measureEnabled: !r
    }),
    [t, r]
  );
  return ZS(() => {
    o.setAddonShortcut(Et, {
      label: "Toggle Measure [M]",
      defaultShortcut: ["M"],
      actionName: "measure",
      showInMenu: !1,
      action: n
    });
  }, [n, o]), /* @__PURE__ */ Vd.createElement(
    QS,
    {
      key: ln,
      active: r,
      title: "Enable measure",
      onClick: n
    },
    /* @__PURE__ */ Vd.createElement(eC, null)
  );
}, "Tool");

// src/measure/manager.tsx
var qd = Ud.register(Et, () => {
  globalThis?.FEATURES?.measure && Ud.add(ln, {
    type: nC.TOOL,
    title: "Measure",
    match: /* @__PURE__ */ a(({ viewMode: e, tabId: t }) => e === "story" && !t, "match"),
    render: /* @__PURE__ */ a(() => /* @__PURE__ */ oC.createElement(zd, null), "render")
  });
});

// src/outline/manager.tsx
import dC from "react";
import { addons as Jd, types as fC } from "storybook/manager-api";

// src/outline/OutlineSelector.tsx
import Wd, { memo as aC, useCallback as iC, useEffect as sC } from "react";
import { IconButton as lC } from "storybook/internal/components";
import { OutlineIcon as cC } from "@storybook/icons";
import { useGlobals as pC, useStorybookApi as uC } from "storybook/manager-api";

// src/outline/constants.ts
var Mr = "storybook/outline", Oi = "outline";

// src/outline/OutlineSelector.tsx
var Gd = aC(/* @__PURE__ */ a(function() {
  let [t, r] = pC(), o = uC(), n = [!0, "true"].includes(t[Oi]), i = iC(
    () => r({
      [Oi]: !n
    }),
    [n]
  );
  return sC(() => {
    o.setAddonShortcut(Mr, {
      label: "Toggle Outline",
      defaultShortcut: ["alt", "O"],
      actionName: "outline",
      showInMenu: !1,
      action: i
    });
  }, [i, o]), /* @__PURE__ */ Wd.createElement(
    lC,
    {
      key: "outline",
      active: n,
      title: "Apply outlines to the preview",
      onClick: i
    },
    /* @__PURE__ */ Wd.createElement(cC, null)
  );
}, "OutlineSelector"));

// src/outline/manager.tsx
var Kd = Jd.register(Mr, () => {
  globalThis?.FEATURES?.outline && Jd.add(Mr, {
    title: "Outline",
    type: fC.TOOL,
    match: /* @__PURE__ */ a(({ viewMode: e, tabId: t }) => !!(e && e.match(/^(story|docs)$/)) && !t, "match"),
    render: /* @__PURE__ */ a(() => /* @__PURE__ */ dC.createElement(Gd, null), "render")
  });
});

// src/viewport/manager.tsx
import * as sf from "react";
import { addons as af, types as MC } from "storybook/manager-api";

// src/viewport/components/Tool.tsx
import ve, { Fragment as EC, useCallback as SC, useEffect as CC, useState as wC } from "react";
import { IconButton as TC, TooltipLinkList as AC, WithTooltip as kC } from "storybook/internal/components";
import { GrowIcon as OC, RefreshIcon as IC, TransferIcon as PC } from "@storybook/icons";
import { useGlobals as LC, useParameter as NC } from "storybook/manager-api";
import { Global as _C } from "storybook/theming";

// src/viewport/constants.ts
var St = "storybook/viewport", Br = "viewport", N3 = `${St}/panel`, Yd = `${St}/tool`;

// src/viewport/defaults.ts
var Xd = {
  mobile1: {
    name: "Small mobile",
    styles: {
      height: "568px",
      width: "320px"
    },
    type: "mobile"
  },
  mobile2: {
    name: "Large mobile",
    styles: {
      height: "896px",
      width: "414px"
    },
    type: "mobile"
  },
  tablet: {
    name: "Tablet",
    styles: {
      height: "1112px",
      width: "834px"
    },
    type: "tablet"
  },
  desktop: {
    name: "Desktop",
    styles: {
      height: "1024px",
      width: "1280px"
    },
    type: "desktop"
  }
};

// src/viewport/responsiveViewport.tsx
var tr = {
  name: "Reset viewport",
  styles: {
    height: "100%",
    width: "100%"
  },
  type: "desktop"
};

// src/viewport/shortcuts.ts
var Zd = /* @__PURE__ */ a((e, t) => e.indexOf(t), "getCurrentViewportIndex"), mC = /* @__PURE__ */ a((e, t) => {
  let r = Zd(e, t);
  return r === e.length - 1 ? e[0] : e[r + 1];
}, "getNextViewport"), gC = /* @__PURE__ */ a((e, t) => {
  let r = Zd(e, t);
  return r < 1 ? e[e.length - 1] : e[r - 1];
}, "getPreviousViewport"), Qd = /* @__PURE__ */ a(async (e, t, r, o) => {
  await e.setAddonShortcut(St, {
    label: "Previous viewport",
    defaultShortcut: ["alt", "shift", "V"],
    actionName: "previous",
    action: /* @__PURE__ */ a(() => {
      r({
        viewport: gC(o, t)
      });
    }, "action")
  }), await e.setAddonShortcut(St, {
    label: "Next viewport",
    defaultShortcut: ["alt", "V"],
    actionName: "next",
    action: /* @__PURE__ */ a(() => {
      r({
        viewport: mC(o, t)
      });
    }, "action")
  }), await e.setAddonShortcut(St, {
    label: "Reset viewport",
    defaultShortcut: ["alt", "control", "V"],
    actionName: "reset",
    action: /* @__PURE__ */ a(() => {
      r({
        viewport: { value: void 0, isRotated: !1 }
      });
    }, "action")
  });
}, "registerShortcuts");

// src/viewport/utils.tsx
import cn, { Fragment as hC } from "react";
import { IconButton as yC } from "storybook/internal/components";
import { BrowserIcon as bC, MobileIcon as xC, TabletIcon as vC } from "@storybook/icons";
import { styled as pn } from "storybook/theming";
var ef = pn.div({
  display: "inline-flex",
  alignItems: "center"
}), Ii = pn.div(({ theme: e }) => ({
  display: "inline-block",
  textDecoration: "none",
  padding: 10,
  fontWeight: e.typography.weight.bold,
  fontSize: e.typography.size.s2 - 1,
  lineHeight: "1",
  height: 40,
  border: "none",
  borderTop: "3px solid transparent",
  borderBottom: "3px solid transparent",
  background: "transparent"
})), tf = pn(yC)(() => ({
  display: "inline-flex",
  alignItems: "center"
})), rf = pn.div(({ theme: e }) => ({
  fontSize: e.typography.size.s2 - 1,
  marginLeft: 10
})), of = {
  desktop: /* @__PURE__ */ cn.createElement(bC, null),
  mobile: /* @__PURE__ */ cn.createElement(xC, null),
  tablet: /* @__PURE__ */ cn.createElement(vC, null),
  other: /* @__PURE__ */ cn.createElement(hC, null)
};

// src/viewport/components/Tool.tsx
var nf = /* @__PURE__ */ a(({ api: e }) => {
  let t = NC(Br), [r, o, n] = LC(), [i, s] = wC(!1), { options: l = Xd, disable: c } = t || {}, u = r?.[Br] || {}, d = typeof u == "string" ?
  u : u.value, g = typeof u == "string" ? !1 : u.isRotated, p = l[d] || tr, m = i || p !== tr, f = Br in n, y = Object.keys(l).length;
  if (CC(() => {
    Qd(e, d, o, Object.keys(l));
  }, [l, d, o, e]), p.styles === null || !l || y < 1)
    return null;
  if (typeof p.styles == "function")
    return console.warn(
      "Addon Viewport no longer supports dynamic styles using a function, use css calc() instead"
    ), null;
  let h = g ? p.styles.height : p.styles.width, b = g ? p.styles.width : p.styles.height;
  return c ? null : /* @__PURE__ */ ve.createElement(
    DC,
    {
      item: p,
      updateGlobals: o,
      viewportMap: l,
      viewportName: d,
      isRotated: g,
      setIsTooltipVisible: s,
      isLocked: f,
      isActive: m,
      width: h,
      height: b
    }
  );
}, "ViewportTool"), DC = ve.memo(/* @__PURE__ */ a(function(t) {
  let {
    item: r,
    viewportMap: o,
    viewportName: n,
    isRotated: i,
    updateGlobals: s,
    setIsTooltipVisible: l,
    isLocked: c,
    isActive: u,
    width: d,
    height: g
  } = t, p = SC(
    (m) => s({ [Br]: m }),
    [s]
  );
  return /* @__PURE__ */ ve.createElement(EC, null, /* @__PURE__ */ ve.createElement(
    kC,
    {
      placement: "bottom",
      tooltip: ({ onHide: m }) => /* @__PURE__ */ ve.createElement(
        AC,
        {
          links: [
            ...length > 0 && r !== tr ? [
              {
                id: "reset",
                title: "Reset viewport",
                icon: /* @__PURE__ */ ve.createElement(IC, null),
                onClick: /* @__PURE__ */ a(() => {
                  p(void 0), m();
                }, "onClick")
              }
            ] : [],
            ...Object.entries(o).map(([f, y]) => ({
              id: f,
              title: y.name,
              icon: of[y.type],
              active: f === n,
              onClick: /* @__PURE__ */ a(() => {
                p({ value: f, isRotated: !1 }), m();
              }, "onClick")
            }))
          ].flat()
        }
      ),
      closeOnOutsideClick: !0,
      onVisibleChange: l
    },
    /* @__PURE__ */ ve.createElement(
      tf,
      {
        disabled: c,
        key: "viewport",
        title: "Change the size of the preview",
        active: u,
        onDoubleClick: () => {
          p({ value: void 0, isRotated: !1 });
        }
      },
      /* @__PURE__ */ ve.createElement(OC, null),
      r !== tr ? /* @__PURE__ */ ve.createElement(rf, null, r.name, " ", i ? "(L)" : "(P)") : null
    )
  ), /* @__PURE__ */ ve.createElement(
    _C,
    {
      styles: {
        'iframe[data-is-storybook="true"]': { width: d, height: g }
      }
    }
  ), r !== tr ? /* @__PURE__ */ ve.createElement(ef, null, /* @__PURE__ */ ve.createElement(Ii, { title: "Viewport width" }, d.replace("px",
  "")), c ? "/" : /* @__PURE__ */ ve.createElement(
    TC,
    {
      key: "viewport-rotate",
      title: "Rotate viewport",
      onClick: () => {
        p({ value: n, isRotated: !i });
      }
    },
    /* @__PURE__ */ ve.createElement(PC, null)
  ), /* @__PURE__ */ ve.createElement(Ii, { title: "Viewport height" }, g.replace("px", ""))) : null);
}, "PureTool"));

// src/viewport/manager.tsx
var lf = af.register(St, (e) => {
  globalThis?.FEATURES?.viewport && af.add(Yd, {
    title: "viewport / media-queries",
    type: MC.TOOL,
    match: /* @__PURE__ */ a(({ viewMode: t, tabId: r }) => t === "story" && !r, "match"),
    render: /* @__PURE__ */ a(() => /* @__PURE__ */ sf.createElement(nf, { api: e }), "render")
  });
});

// src/core-server/presets/common-manager.ts
var RC = "tag-filters", jC = "static-filter", HC = FC.register(RC, (e) => {
  let t = Object.entries(BC.TAGS_OPTIONS ?? {}).reduce(
    (r, o) => {
      let [n, i] = o;
      return i.excludeFromSidebar && (r[n] = !0), r;
    },
    {}
  );
  e.experimental_setFilter(jC, (r) => {
    let o = r.tags ?? [];
    return (
      // we can filter out the primary story, but we still want to show autodocs
      (o.includes("dev") || r.type === "docs") && o.filter((n) => t[n]).length === 0
    );
  });
}), hF = [
  qd,
  HC,
  qp,
  $d,
  Md,
  xp,
  lf,
  Kd
];
export {
  hF as default
};
