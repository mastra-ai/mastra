"use strict";
var wt = Object.create;
var H = Object.defineProperty;
var _t = Object.getOwnPropertyDescriptor;
var vt = Object.getOwnPropertyNames;
var Ct = Object.getPrototypeOf, St = Object.prototype.hasOwnProperty;
var d = (u, t) => H(u, "name", { value: t, configurable: !0 });
var xt = (u, t) => () => (t || u((t = { exports: {} }).exports, t), t.exports), kt = (u, t) => {
  for (var e in t)
    H(u, e, { get: t[e], enumerable: !0 });
}, lt = (u, t, e, i) => {
  if (t && typeof t == "object" || typeof t == "function")
    for (let n of vt(t))
      !St.call(u, n) && n !== e && H(u, n, { get: () => t[n], enumerable: !(i = _t(t, n)) || i.enumerable });
  return u;
};
var Et = (u, t, e) => (e = u != null ? wt(Ct(u)) : {}, lt(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  t || !u || !u.__esModule ? H(e, "default", { value: u, enumerable: !0 }) : e,
  u
)), It = (u) => lt(H({}, "__esModule", { value: !0 }), u);

// ../node_modules/@jridgewell/sourcemap-codec/dist/sourcemap-codec.umd.js
var ht = xt((Q, at) => {
  (function(u, t) {
    typeof Q == "object" && typeof at < "u" ? t(Q) : typeof define == "function" && define.amd ? define(["exports"], t) : (u = typeof globalThis <
    "u" ? globalThis : u || self, t(u.sourcemapCodec = {}));
  })(Q, function(u) {
    "use strict";
    let i = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", n = new Uint8Array(64), o = new Uint8Array(128);
    for (let f = 0; f < i.length; f++) {
      let a = i.charCodeAt(f);
      n[f] = a, o[a] = f;
    }
    function r(f, a) {
      let s = 0, h = 0, g = 0;
      do {
        let _ = f.next();
        g = o[_], s |= (g & 31) << h, h += 5;
      } while (g & 32);
      let m = s & 1;
      return s >>>= 1, m && (s = -2147483648 | -s), a + s;
    }
    d(r, "decodeInteger");
    function l(f, a, s) {
      let h = a - s;
      h = h < 0 ? -h << 1 | 1 : h << 1;
      do {
        let g = h & 31;
        h >>>= 5, h > 0 && (g |= 32), f.write(n[g]);
      } while (h > 0);
      return a;
    }
    d(l, "encodeInteger");
    function c(f, a) {
      return f.pos >= a ? !1 : f.peek() !== 44;
    }
    d(c, "hasMoreVlq");
    let p = 1024 * 16, R = typeof TextDecoder < "u" ? /* @__PURE__ */ new TextDecoder() : typeof Buffer < "u" ? {
      decode(f) {
        return Buffer.from(f.buffer, f.byteOffset, f.byteLength).toString();
      }
    } : {
      decode(f) {
        let a = "";
        for (let s = 0; s < f.length; s++)
          a += String.fromCharCode(f[s]);
        return a;
      }
    };
    class D {
      static {
        d(this, "StringWriter");
      }
      constructor() {
        this.pos = 0, this.out = "", this.buffer = new Uint8Array(p);
      }
      write(a) {
        let { buffer: s } = this;
        s[this.pos++] = a, this.pos === p && (this.out += R.decode(s), this.pos = 0);
      }
      flush() {
        let { buffer: a, out: s, pos: h } = this;
        return h > 0 ? s + R.decode(a.subarray(0, h)) : s;
      }
    }
    class W {
      static {
        d(this, "StringReader");
      }
      constructor(a) {
        this.pos = 0, this.buffer = a;
      }
      next() {
        return this.buffer.charCodeAt(this.pos++);
      }
      peek() {
        return this.buffer.charCodeAt(this.pos);
      }
      indexOf(a) {
        let { buffer: s, pos: h } = this, g = s.indexOf(a, h);
        return g === -1 ? s.length : g;
      }
    }
    let it = [];
    function P(f) {
      let { length: a } = f, s = new W(f), h = [], g = [], m = 0;
      for (; s.pos < a; s.pos++) {
        m = r(s, m);
        let _ = r(s, 0);
        if (!c(s, a)) {
          let k = g.pop();
          k[2] = m, k[3] = _;
          continue;
        }
        let b = r(s, 0), w = r(s, 0) & 1 ? [m, _, 0, 0, b, r(s, 0)] : [m, _, 0, 0, b], x = it;
        if (c(s, a)) {
          x = [];
          do {
            let k = r(s, 0);
            x.push(k);
          } while (c(s, a));
        }
        w.vars = x, h.push(w), g.push(w);
      }
      return h;
    }
    d(P, "decodeOriginalScopes");
    function I(f) {
      let a = new D();
      for (let s = 0; s < f.length; )
        s = L(f, s, a, [0]);
      return a.flush();
    }
    d(I, "encodeOriginalScopes");
    function L(f, a, s, h) {
      let g = f[a], { 0: m, 1: _, 2: b, 3: S, 4: C, vars: w } = g;
      a > 0 && s.write(44), h[0] = l(s, m, h[0]), l(s, _, 0), l(s, C, 0);
      let x = g.length === 6 ? 1 : 0;
      l(s, x, 0), g.length === 6 && l(s, g[5], 0);
      for (let k of w)
        l(s, k, 0);
      for (a++; a < f.length; ) {
        let k = f[a], { 0: y, 1: E } = k;
        if (y > b || y === b && E >= S)
          break;
        a = L(f, a, s, h);
      }
      return s.write(44), h[0] = l(s, b, h[0]), l(s, S, 0), a;
    }
    d(L, "_encodeOriginalScopes");
    function j(f) {
      let { length: a } = f, s = new W(f), h = [], g = [], m = 0, _ = 0, b = 0, S = 0, C = 0, w = 0, x = 0, k = 0;
      do {
        let y = s.indexOf(";"), E = 0;
        for (; s.pos < y; s.pos++) {
          if (E = r(s, E), !c(s, y)) {
            let O = g.pop();
            O[2] = m, O[3] = E;
            continue;
          }
          let A = r(s, 0), J = A & 1, G = A & 2, K = A & 4, ot = null, nt = it, M;
          if (J) {
            let O = r(s, _);
            b = r(s, _ === O ? b : 0), _ = O, M = [m, E, 0, 0, O, b];
          } else
            M = [m, E, 0, 0];
          if (M.isScope = !!K, G) {
            let O = S, U = C;
            S = r(s, S);
            let z = O === S;
            C = r(s, z ? C : 0), w = r(s, z && U === C ? w : 0), ot = [S, C, w];
          }
          if (M.callsite = ot, c(s, y)) {
            nt = [];
            do {
              x = m, k = E;
              let O = r(s, 0), U;
              if (O < -1) {
                U = [[r(s, 0)]];
                for (let z = -1; z > O; z--) {
                  let yt = x;
                  x = r(s, x), k = r(s, x === yt ? k : 0);
                  let bt = r(s, 0);
                  U.push([bt, x, k]);
                }
              } else
                U = [[O]];
              nt.push(U);
            } while (c(s, y));
          }
          M.bindings = nt, h.push(M), g.push(M);
        }
        m++, s.pos = y + 1;
      } while (s.pos < a);
      return h;
    }
    d(j, "decodeGeneratedRanges");
    function $(f) {
      if (f.length === 0)
        return "";
      let a = new D();
      for (let s = 0; s < f.length; )
        s = T(f, s, a, [0, 0, 0, 0, 0, 0, 0]);
      return a.flush();
    }
    d($, "encodeGeneratedRanges");
    function T(f, a, s, h) {
      let g = f[a], { 0: m, 1: _, 2: b, 3: S, isScope: C, callsite: w, bindings: x } = g;
      h[0] < m ? (v(s, h[0], m), h[0] = m, h[1] = 0) : a > 0 && s.write(44), h[1] = l(s, g[1], h[1]);
      let k = (g.length === 6 ? 1 : 0) | (w ? 2 : 0) | (C ? 4 : 0);
      if (l(s, k, 0), g.length === 6) {
        let { 4: y, 5: E } = g;
        y !== h[2] && (h[3] = 0), h[2] = l(s, y, h[2]), h[3] = l(s, E, h[3]);
      }
      if (w) {
        let { 0: y, 1: E, 2: A } = g.callsite;
        y !== h[4] ? (h[5] = 0, h[6] = 0) : E !== h[5] && (h[6] = 0), h[4] = l(s, y, h[4]), h[5] = l(s, E, h[5]), h[6] = l(s, A, h[6]);
      }
      if (x)
        for (let y of x) {
          y.length > 1 && l(s, -y.length, 0);
          let E = y[0][0];
          l(s, E, 0);
          let A = m, J = _;
          for (let G = 1; G < y.length; G++) {
            let K = y[G];
            A = l(s, K[1], A), J = l(s, K[2], J), l(s, K[0], 0);
          }
        }
      for (a++; a < f.length; ) {
        let y = f[a], { 0: E, 1: A } = y;
        if (E > b || E === b && A >= S)
          break;
        a = T(f, a, s, h);
      }
      return h[0] < b ? (v(s, h[0], b), h[0] = b, h[1] = 0) : s.write(44), h[1] = l(s, S, h[1]), a;
    }
    d(T, "_encodeGeneratedRanges");
    function v(f, a, s) {
      do
        f.write(59);
      while (++a < s);
    }
    d(v, "catchupLine");
    function N(f) {
      let { length: a } = f, s = new W(f), h = [], g = 0, m = 0, _ = 0, b = 0, S = 0;
      do {
        let C = s.indexOf(";"), w = [], x = !0, k = 0;
        for (g = 0; s.pos < C; ) {
          let y;
          g = r(s, g), g < k && (x = !1), k = g, c(s, C) ? (m = r(s, m), _ = r(s, _), b = r(s, b), c(s, C) ? (S = r(s, S), y = [g, m, _, b, S]) :
          y = [g, m, _, b]) : y = [g], w.push(y), s.pos++;
        }
        x || B(w), h.push(w), s.pos = C + 1;
      } while (s.pos <= a);
      return h;
    }
    d(N, "decode");
    function B(f) {
      f.sort(F);
    }
    d(B, "sort");
    function F(f, a) {
      return f[0] - a[0];
    }
    d(F, "sortComparator");
    function mt(f) {
      let a = new D(), s = 0, h = 0, g = 0, m = 0;
      for (let _ = 0; _ < f.length; _++) {
        let b = f[_];
        if (_ > 0 && a.write(59), b.length === 0)
          continue;
        let S = 0;
        for (let C = 0; C < b.length; C++) {
          let w = b[C];
          C > 0 && a.write(44), S = l(a, w[0], S), w.length !== 1 && (s = l(a, w[1], s), h = l(a, w[2], h), g = l(a, w[3], g), w.length !== 4 &&
          (m = l(a, w[4], m)));
        }
      }
      return a.flush();
    }
    d(mt, "encode"), u.decode = N, u.decodeGeneratedRanges = j, u.decodeOriginalScopes = P, u.encode = mt, u.encodeGeneratedRanges = $, u.encodeOriginalScopes =
    I, Object.defineProperty(u, "__esModule", { value: !0 });
  });
});

// src/core-server/presets/webpack/loaders/webpack-automock-loader.ts
var qt = {};
kt(qt, {
  default: () => gt
});
module.exports = It(qt);

// ../node_modules/magic-string/dist/magic-string.es.mjs
var ct = Et(ht(), 1);
var X = class u {
  static {
    d(this, "BitSet");
  }
  constructor(t) {
    this.bits = t instanceof u ? t.bits.slice() : [];
  }
  add(t) {
    this.bits[t >> 5] |= 1 << (t & 31);
  }
  has(t) {
    return !!(this.bits[t >> 5] & 1 << (t & 31));
  }
}, Z = class u {
  static {
    d(this, "Chunk");
  }
  constructor(t, e, i) {
    this.start = t, this.end = e, this.original = i, this.intro = "", this.outro = "", this.content = i, this.storeName = !1, this.edited = !1,
    this.previous = null, this.next = null;
  }
  appendLeft(t) {
    this.outro += t;
  }
  appendRight(t) {
    this.intro = this.intro + t;
  }
  clone() {
    let t = new u(this.start, this.end, this.original);
    return t.intro = this.intro, t.outro = this.outro, t.content = this.content, t.storeName = this.storeName, t.edited = this.edited, t;
  }
  contains(t) {
    return this.start < t && t < this.end;
  }
  eachNext(t) {
    let e = this;
    for (; e; )
      t(e), e = e.next;
  }
  eachPrevious(t) {
    let e = this;
    for (; e; )
      t(e), e = e.previous;
  }
  edit(t, e, i) {
    return this.content = t, i || (this.intro = "", this.outro = ""), this.storeName = e, this.edited = !0, this;
  }
  prependLeft(t) {
    this.outro = t + this.outro;
  }
  prependRight(t) {
    this.intro = t + this.intro;
  }
  reset() {
    this.intro = "", this.outro = "", this.edited && (this.content = this.original, this.storeName = !1, this.edited = !1);
  }
  split(t) {
    let e = t - this.start, i = this.original.slice(0, e), n = this.original.slice(e);
    this.original = i;
    let o = new u(t, this.end, n);
    return o.outro = this.outro, this.outro = "", this.end = t, this.edited ? (o.edit("", !1), this.content = "") : this.content = i, o.next =
    this.next, o.next && (o.next.previous = o), o.previous = this, this.next = o, o;
  }
  toString() {
    return this.intro + this.content + this.outro;
  }
  trimEnd(t) {
    if (this.outro = this.outro.replace(t, ""), this.outro.length) return !0;
    let e = this.content.replace(t, "");
    if (e.length)
      return e !== this.content && (this.split(this.start + e.length).edit("", void 0, !0), this.edited && this.edit(e, this.storeName, !0)),
      !0;
    if (this.edit("", void 0, !0), this.intro = this.intro.replace(t, ""), this.intro.length) return !0;
  }
  trimStart(t) {
    if (this.intro = this.intro.replace(t, ""), this.intro.length) return !0;
    let e = this.content.replace(t, "");
    if (e.length) {
      if (e !== this.content) {
        let i = this.split(this.end - e.length);
        this.edited && i.edit(e, this.storeName, !0), this.edit("", void 0, !0);
      }
      return !0;
    } else if (this.edit("", void 0, !0), this.outro = this.outro.replace(t, ""), this.outro.length) return !0;
  }
};
function Lt() {
  return typeof globalThis < "u" && typeof globalThis.btoa == "function" ? (u) => globalThis.btoa(unescape(encodeURIComponent(u))) : typeof Buffer ==
  "function" ? (u) => Buffer.from(u, "utf-8").toString("base64") : () => {
    throw new Error("Unsupported environment: `window.btoa` or `Buffer` should be supported.");
  };
}
d(Lt, "getBtoa");
var Pt = /* @__PURE__ */ Lt(), st = class {
  static {
    d(this, "SourceMap");
  }
  constructor(t) {
    this.version = 3, this.file = t.file, this.sources = t.sources, this.sourcesContent = t.sourcesContent, this.names = t.names, this.mappings =
    (0, ct.encode)(t.mappings), typeof t.x_google_ignoreList < "u" && (this.x_google_ignoreList = t.x_google_ignoreList), typeof t.debugId <
    "u" && (this.debugId = t.debugId);
  }
  toString() {
    return JSON.stringify(this);
  }
  toUrl() {
    return "data:application/json;charset=utf-8;base64," + Pt(this.toString());
  }
};
function Nt(u) {
  let t = u.split(`
`), e = t.filter((o) => /^\t+/.test(o)), i = t.filter((o) => /^ {2,}/.test(o));
  if (e.length === 0 && i.length === 0)
    return null;
  if (e.length >= i.length)
    return "	";
  let n = i.reduce((o, r) => {
    let l = /^ +/.exec(r)[0].length;
    return Math.min(l, o);
  }, 1 / 0);
  return new Array(n + 1).join(" ");
}
d(Nt, "guessIndent");
function Ot(u, t) {
  let e = u.split(/[/\\]/), i = t.split(/[/\\]/);
  for (e.pop(); e[0] === i[0]; )
    e.shift(), i.shift();
  if (e.length) {
    let n = e.length;
    for (; n--; ) e[n] = "..";
  }
  return e.concat(i).join("/");
}
d(Ot, "getRelativePath");
var Rt = Object.prototype.toString;
function At(u) {
  return Rt.call(u) === "[object Object]";
}
d(At, "isObject");
function ut(u) {
  let t = u.split(`
`), e = [];
  for (let i = 0, n = 0; i < t.length; i++)
    e.push(n), n += t[i].length + 1;
  return /* @__PURE__ */ d(function(n) {
    let o = 0, r = e.length;
    for (; o < r; ) {
      let p = o + r >> 1;
      n < e[p] ? r = p : o = p + 1;
    }
    let l = o - 1, c = n - e[l];
    return { line: l, column: c };
  }, "locate");
}
d(ut, "getLocator");
var Dt = /\w/, rt = class {
  static {
    d(this, "Mappings");
  }
  constructor(t) {
    this.hires = t, this.generatedCodeLine = 0, this.generatedCodeColumn = 0, this.raw = [], this.rawSegments = this.raw[this.generatedCodeLine] =
    [], this.pending = null;
  }
  addEdit(t, e, i, n) {
    if (e.length) {
      let o = e.length - 1, r = e.indexOf(`
`, 0), l = -1;
      for (; r >= 0 && o > r; ) {
        let p = [this.generatedCodeColumn, t, i.line, i.column];
        n >= 0 && p.push(n), this.rawSegments.push(p), this.generatedCodeLine += 1, this.raw[this.generatedCodeLine] = this.rawSegments = [],
        this.generatedCodeColumn = 0, l = r, r = e.indexOf(`
`, r + 1);
      }
      let c = [this.generatedCodeColumn, t, i.line, i.column];
      n >= 0 && c.push(n), this.rawSegments.push(c), this.advance(e.slice(l + 1));
    } else this.pending && (this.rawSegments.push(this.pending), this.advance(e));
    this.pending = null;
  }
  addUneditedChunk(t, e, i, n, o) {
    let r = e.start, l = !0, c = !1;
    for (; r < e.end; ) {
      if (i[r] === `
`)
        n.line += 1, n.column = 0, this.generatedCodeLine += 1, this.raw[this.generatedCodeLine] = this.rawSegments = [], this.generatedCodeColumn =
        0, l = !0, c = !1;
      else {
        if (this.hires || l || o.has(r)) {
          let p = [this.generatedCodeColumn, t, n.line, n.column];
          this.hires === "boundary" ? Dt.test(i[r]) ? c || (this.rawSegments.push(p), c = !0) : (this.rawSegments.push(p), c = !1) : this.rawSegments.
          push(p);
        }
        n.column += 1, this.generatedCodeColumn += 1, l = !1;
      }
      r += 1;
    }
    this.pending = null;
  }
  advance(t) {
    if (!t) return;
    let e = t.split(`
`);
    if (e.length > 1) {
      for (let i = 0; i < e.length - 1; i++)
        this.generatedCodeLine++, this.raw[this.generatedCodeLine] = this.rawSegments = [];
      this.generatedCodeColumn = 0;
    }
    this.generatedCodeColumn += e[e.length - 1].length;
  }
}, V = `
`, q = {
  insertLeft: !1,
  insertRight: !1,
  storeName: !1
}, tt = class u {
  static {
    d(this, "MagicString");
  }
  constructor(t, e = {}) {
    let i = new Z(0, t.length, t);
    Object.defineProperties(this, {
      original: { writable: !0, value: t },
      outro: { writable: !0, value: "" },
      intro: { writable: !0, value: "" },
      firstChunk: { writable: !0, value: i },
      lastChunk: { writable: !0, value: i },
      lastSearchedChunk: { writable: !0, value: i },
      byStart: { writable: !0, value: {} },
      byEnd: { writable: !0, value: {} },
      filename: { writable: !0, value: e.filename },
      indentExclusionRanges: { writable: !0, value: e.indentExclusionRanges },
      sourcemapLocations: { writable: !0, value: new X() },
      storedNames: { writable: !0, value: {} },
      indentStr: { writable: !0, value: void 0 },
      ignoreList: { writable: !0, value: e.ignoreList },
      offset: { writable: !0, value: e.offset || 0 }
    }), this.byStart[0] = i, this.byEnd[t.length] = i;
  }
  addSourcemapLocation(t) {
    this.sourcemapLocations.add(t);
  }
  append(t) {
    if (typeof t != "string") throw new TypeError("outro content must be a string");
    return this.outro += t, this;
  }
  appendLeft(t, e) {
    if (t = t + this.offset, typeof e != "string") throw new TypeError("inserted content must be a string");
    this._split(t);
    let i = this.byEnd[t];
    return i ? i.appendLeft(e) : this.intro += e, this;
  }
  appendRight(t, e) {
    if (t = t + this.offset, typeof e != "string") throw new TypeError("inserted content must be a string");
    this._split(t);
    let i = this.byStart[t];
    return i ? i.appendRight(e) : this.outro += e, this;
  }
  clone() {
    let t = new u(this.original, { filename: this.filename, offset: this.offset }), e = this.firstChunk, i = t.firstChunk = t.lastSearchedChunk =
    e.clone();
    for (; e; ) {
      t.byStart[i.start] = i, t.byEnd[i.end] = i;
      let n = e.next, o = n && n.clone();
      o && (i.next = o, o.previous = i, i = o), e = n;
    }
    return t.lastChunk = i, this.indentExclusionRanges && (t.indentExclusionRanges = this.indentExclusionRanges.slice()), t.sourcemapLocations =
    new X(this.sourcemapLocations), t.intro = this.intro, t.outro = this.outro, t;
  }
  generateDecodedMap(t) {
    t = t || {};
    let e = 0, i = Object.keys(this.storedNames), n = new rt(t.hires), o = ut(this.original);
    return this.intro && n.advance(this.intro), this.firstChunk.eachNext((r) => {
      let l = o(r.start);
      r.intro.length && n.advance(r.intro), r.edited ? n.addEdit(
        e,
        r.content,
        l,
        r.storeName ? i.indexOf(r.original) : -1
      ) : n.addUneditedChunk(e, r, this.original, l, this.sourcemapLocations), r.outro.length && n.advance(r.outro);
    }), {
      file: t.file ? t.file.split(/[/\\]/).pop() : void 0,
      sources: [
        t.source ? Ot(t.file || "", t.source) : t.file || ""
      ],
      sourcesContent: t.includeContent ? [this.original] : void 0,
      names: i,
      mappings: n.raw,
      x_google_ignoreList: this.ignoreList ? [e] : void 0
    };
  }
  generateMap(t) {
    return new st(this.generateDecodedMap(t));
  }
  _ensureindentStr() {
    this.indentStr === void 0 && (this.indentStr = Nt(this.original));
  }
  _getRawIndentString() {
    return this._ensureindentStr(), this.indentStr;
  }
  getIndentString() {
    return this._ensureindentStr(), this.indentStr === null ? "	" : this.indentStr;
  }
  indent(t, e) {
    let i = /^[^\r\n]/gm;
    if (At(t) && (e = t, t = void 0), t === void 0 && (this._ensureindentStr(), t = this.indentStr || "	"), t === "") return this;
    e = e || {};
    let n = {};
    e.exclude && (typeof e.exclude[0] == "number" ? [e.exclude] : e.exclude).forEach((R) => {
      for (let D = R[0]; D < R[1]; D += 1)
        n[D] = !0;
    });
    let o = e.indentStart !== !1, r = /* @__PURE__ */ d((p) => o ? `${t}${p}` : (o = !0, p), "replacer");
    this.intro = this.intro.replace(i, r);
    let l = 0, c = this.firstChunk;
    for (; c; ) {
      let p = c.end;
      if (c.edited)
        n[l] || (c.content = c.content.replace(i, r), c.content.length && (o = c.content[c.content.length - 1] === `
`));
      else
        for (l = c.start; l < p; ) {
          if (!n[l]) {
            let R = this.original[l];
            R === `
` ? o = !0 : R !== "\r" && o && (o = !1, l === c.start || (this._splitChunk(c, l), c = c.next), c.prependRight(t));
          }
          l += 1;
        }
      l = c.end, c = c.next;
    }
    return this.outro = this.outro.replace(i, r), this;
  }
  insert() {
    throw new Error(
      "magicString.insert(...) is deprecated. Use prependRight(...) or appendLeft(...)"
    );
  }
  insertLeft(t, e) {
    return q.insertLeft || (console.warn(
      "magicString.insertLeft(...) is deprecated. Use magicString.appendLeft(...) instead"
    ), q.insertLeft = !0), this.appendLeft(t, e);
  }
  insertRight(t, e) {
    return q.insertRight || (console.warn(
      "magicString.insertRight(...) is deprecated. Use magicString.prependRight(...) instead"
    ), q.insertRight = !0), this.prependRight(t, e);
  }
  move(t, e, i) {
    if (t = t + this.offset, e = e + this.offset, i = i + this.offset, i >= t && i <= e) throw new Error("Cannot move a selection inside its\
elf");
    this._split(t), this._split(e), this._split(i);
    let n = this.byStart[t], o = this.byEnd[e], r = n.previous, l = o.next, c = this.byStart[i];
    if (!c && o === this.lastChunk) return this;
    let p = c ? c.previous : this.lastChunk;
    return r && (r.next = l), l && (l.previous = r), p && (p.next = n), c && (c.previous = o), n.previous || (this.firstChunk = o.next), o.next ||
    (this.lastChunk = n.previous, this.lastChunk.next = null), n.previous = p, o.next = c || null, p || (this.firstChunk = n), c || (this.lastChunk =
    o), this;
  }
  overwrite(t, e, i, n) {
    return n = n || {}, this.update(t, e, i, { ...n, overwrite: !n.contentOnly });
  }
  update(t, e, i, n) {
    if (t = t + this.offset, e = e + this.offset, typeof i != "string") throw new TypeError("replacement content must be a string");
    if (this.original.length !== 0) {
      for (; t < 0; ) t += this.original.length;
      for (; e < 0; ) e += this.original.length;
    }
    if (e > this.original.length) throw new Error("end is out of bounds");
    if (t === e)
      throw new Error(
        "Cannot overwrite a zero-length range \u2013 use appendLeft or prependRight instead"
      );
    this._split(t), this._split(e), n === !0 && (q.storeName || (console.warn(
      "The final argument to magicString.overwrite(...) should be an options object. See https://github.com/rich-harris/magic-string"
    ), q.storeName = !0), n = { storeName: !0 });
    let o = n !== void 0 ? n.storeName : !1, r = n !== void 0 ? n.overwrite : !1;
    if (o) {
      let p = this.original.slice(t, e);
      Object.defineProperty(this.storedNames, p, {
        writable: !0,
        value: !0,
        enumerable: !0
      });
    }
    let l = this.byStart[t], c = this.byEnd[e];
    if (l) {
      let p = l;
      for (; p !== c; ) {
        if (p.next !== this.byStart[p.end])
          throw new Error("Cannot overwrite across a split point");
        p = p.next, p.edit("", !1);
      }
      l.edit(i, o, !r);
    } else {
      let p = new Z(t, e, "").edit(i, o);
      c.next = p, p.previous = c;
    }
    return this;
  }
  prepend(t) {
    if (typeof t != "string") throw new TypeError("outro content must be a string");
    return this.intro = t + this.intro, this;
  }
  prependLeft(t, e) {
    if (t = t + this.offset, typeof e != "string") throw new TypeError("inserted content must be a string");
    this._split(t);
    let i = this.byEnd[t];
    return i ? i.prependLeft(e) : this.intro = e + this.intro, this;
  }
  prependRight(t, e) {
    if (t = t + this.offset, typeof e != "string") throw new TypeError("inserted content must be a string");
    this._split(t);
    let i = this.byStart[t];
    return i ? i.prependRight(e) : this.outro = e + this.outro, this;
  }
  remove(t, e) {
    if (t = t + this.offset, e = e + this.offset, this.original.length !== 0) {
      for (; t < 0; ) t += this.original.length;
      for (; e < 0; ) e += this.original.length;
    }
    if (t === e) return this;
    if (t < 0 || e > this.original.length) throw new Error("Character is out of bounds");
    if (t > e) throw new Error("end must be greater than start");
    this._split(t), this._split(e);
    let i = this.byStart[t];
    for (; i; )
      i.intro = "", i.outro = "", i.edit(""), i = e > i.end ? this.byStart[i.end] : null;
    return this;
  }
  reset(t, e) {
    if (t = t + this.offset, e = e + this.offset, this.original.length !== 0) {
      for (; t < 0; ) t += this.original.length;
      for (; e < 0; ) e += this.original.length;
    }
    if (t === e) return this;
    if (t < 0 || e > this.original.length) throw new Error("Character is out of bounds");
    if (t > e) throw new Error("end must be greater than start");
    this._split(t), this._split(e);
    let i = this.byStart[t];
    for (; i; )
      i.reset(), i = e > i.end ? this.byStart[i.end] : null;
    return this;
  }
  lastChar() {
    if (this.outro.length) return this.outro[this.outro.length - 1];
    let t = this.lastChunk;
    do {
      if (t.outro.length) return t.outro[t.outro.length - 1];
      if (t.content.length) return t.content[t.content.length - 1];
      if (t.intro.length) return t.intro[t.intro.length - 1];
    } while (t = t.previous);
    return this.intro.length ? this.intro[this.intro.length - 1] : "";
  }
  lastLine() {
    let t = this.outro.lastIndexOf(V);
    if (t !== -1) return this.outro.substr(t + 1);
    let e = this.outro, i = this.lastChunk;
    do {
      if (i.outro.length > 0) {
        if (t = i.outro.lastIndexOf(V), t !== -1) return i.outro.substr(t + 1) + e;
        e = i.outro + e;
      }
      if (i.content.length > 0) {
        if (t = i.content.lastIndexOf(V), t !== -1) return i.content.substr(t + 1) + e;
        e = i.content + e;
      }
      if (i.intro.length > 0) {
        if (t = i.intro.lastIndexOf(V), t !== -1) return i.intro.substr(t + 1) + e;
        e = i.intro + e;
      }
    } while (i = i.previous);
    return t = this.intro.lastIndexOf(V), t !== -1 ? this.intro.substr(t + 1) + e : this.intro + e;
  }
  slice(t = 0, e = this.original.length - this.offset) {
    if (t = t + this.offset, e = e + this.offset, this.original.length !== 0) {
      for (; t < 0; ) t += this.original.length;
      for (; e < 0; ) e += this.original.length;
    }
    let i = "", n = this.firstChunk;
    for (; n && (n.start > t || n.end <= t); ) {
      if (n.start < e && n.end >= e)
        return i;
      n = n.next;
    }
    if (n && n.edited && n.start !== t)
      throw new Error(`Cannot use replaced character ${t} as slice start anchor.`);
    let o = n;
    for (; n; ) {
      n.intro && (o !== n || n.start === t) && (i += n.intro);
      let r = n.start < e && n.end >= e;
      if (r && n.edited && n.end !== e)
        throw new Error(`Cannot use replaced character ${e} as slice end anchor.`);
      let l = o === n ? t - n.start : 0, c = r ? n.content.length + e - n.end : n.content.length;
      if (i += n.content.slice(l, c), n.outro && (!r || n.end === e) && (i += n.outro), r)
        break;
      n = n.next;
    }
    return i;
  }
  // TODO deprecate this? not really very useful
  snip(t, e) {
    let i = this.clone();
    return i.remove(0, t), i.remove(e, i.original.length), i;
  }
  _split(t) {
    if (this.byStart[t] || this.byEnd[t]) return;
    let e = this.lastSearchedChunk, i = t > e.end;
    for (; e; ) {
      if (e.contains(t)) return this._splitChunk(e, t);
      e = i ? this.byStart[e.end] : this.byEnd[e.start];
    }
  }
  _splitChunk(t, e) {
    if (t.edited && t.content.length) {
      let n = ut(this.original)(e);
      throw new Error(
        `Cannot split a chunk that has already been edited (${n.line}:${n.column} \u2013 "${t.original}")`
      );
    }
    let i = t.split(e);
    return this.byEnd[e] = t, this.byStart[e] = i, this.byEnd[i.end] = i, t === this.lastChunk && (this.lastChunk = i), this.lastSearchedChunk =
    t, !0;
  }
  toString() {
    let t = this.intro, e = this.firstChunk;
    for (; e; )
      t += e.toString(), e = e.next;
    return t + this.outro;
  }
  isEmpty() {
    let t = this.firstChunk;
    do
      if (t.intro.length && t.intro.trim() || t.content.length && t.content.trim() || t.outro.length && t.outro.trim())
        return !1;
    while (t = t.next);
    return !0;
  }
  length() {
    let t = this.firstChunk, e = 0;
    do
      e += t.intro.length + t.content.length + t.outro.length;
    while (t = t.next);
    return e;
  }
  trimLines() {
    return this.trim("[\\r\\n]");
  }
  trim(t) {
    return this.trimStart(t).trimEnd(t);
  }
  trimEndAborted(t) {
    let e = new RegExp((t || "\\s") + "+$");
    if (this.outro = this.outro.replace(e, ""), this.outro.length) return !0;
    let i = this.lastChunk;
    do {
      let n = i.end, o = i.trimEnd(e);
      if (i.end !== n && (this.lastChunk === i && (this.lastChunk = i.next), this.byEnd[i.end] = i, this.byStart[i.next.start] = i.next, this.
      byEnd[i.next.end] = i.next), o) return !0;
      i = i.previous;
    } while (i);
    return !1;
  }
  trimEnd(t) {
    return this.trimEndAborted(t), this;
  }
  trimStartAborted(t) {
    let e = new RegExp("^" + (t || "\\s") + "+");
    if (this.intro = this.intro.replace(e, ""), this.intro.length) return !0;
    let i = this.firstChunk;
    do {
      let n = i.end, o = i.trimStart(e);
      if (i.end !== n && (i === this.lastChunk && (this.lastChunk = i.next), this.byEnd[i.end] = i, this.byStart[i.next.start] = i.next, this.
      byEnd[i.next.end] = i.next), o) return !0;
      i = i.next;
    } while (i);
    return !1;
  }
  trimStart(t) {
    return this.trimStartAborted(t), this;
  }
  hasChanged() {
    return this.original !== this.toString();
  }
  _replaceRegexp(t, e) {
    function i(o, r) {
      return typeof e == "string" ? e.replace(/\$(\$|&|\d+)/g, (l, c) => c === "$" ? "$" : c === "&" ? o[0] : +c < o.length ? o[+c] : `$${c}`) :
      e(...o, o.index, r, o.groups);
    }
    d(i, "getReplacement");
    function n(o, r) {
      let l, c = [];
      for (; l = o.exec(r); )
        c.push(l);
      return c;
    }
    if (d(n, "matchAll"), t.global)
      n(t, this.original).forEach((r) => {
        if (r.index != null) {
          let l = i(r, this.original);
          l !== r[0] && this.overwrite(r.index, r.index + r[0].length, l);
        }
      });
    else {
      let o = this.original.match(t);
      if (o && o.index != null) {
        let r = i(o, this.original);
        r !== o[0] && this.overwrite(o.index, o.index + o[0].length, r);
      }
    }
    return this;
  }
  _replaceString(t, e) {
    let { original: i } = this, n = i.indexOf(t);
    return n !== -1 && this.overwrite(n, n + t.length, e), this;
  }
  replace(t, e) {
    return typeof t == "string" ? this._replaceString(t, e) : this._replaceRegexp(t, e);
  }
  _replaceAllString(t, e) {
    let { original: i } = this, n = t.length;
    for (let o = i.indexOf(t); o !== -1; o = i.indexOf(t, o + n))
      i.slice(o, o + n) !== e && this.overwrite(o, o + n, e);
    return this;
  }
  replaceAll(t, e) {
    if (typeof t == "string")
      return this._replaceAllString(t, e);
    if (!t.global)
      throw new TypeError(
        "MagicString.prototype.replaceAll called with a non-global RegExp argument"
      );
    return this._replaceRegexp(t, e);
  }
};

// src/core-server/presets/vitePlugins/vite-inject-mocker/constants.ts
var ft = "__vitest_mocker__";

// src/core-server/mocking-utils/esmWalker.ts
function Y(u) {
  return u.type === "Identifier" ? u.name : u.raw;
}
d(Y, "getArbitraryModuleIdentifier");

// src/core-server/mocking-utils/automock.ts
function dt(u, t, e) {
  return $t(u, t ? "autospy" : "automock", e, {
    globalThisAccessor: JSON.stringify(ft)
  });
}
d(dt, "getAutomockCode");
function $t(u, t, e, i = {}) {
  let n = i.globalThisAccessor || '"__vitest_mocker__"', o = e(u), r = new tt(u), l = [], c = 0;
  for (let P of o.body) {
    if (P.type === "ExportAllDeclaration")
      throw new Error(
        "automocking files with `export *` is not supported in browser mode because it cannot be statically analysed"
      );
    if (P.type === "ExportNamedDeclaration") {
      let j = function(v) {
        if (v.type === "Identifier")
          l.push({ name: v.name });
        else if (v.type === "ArrayPattern")
          v.elements.forEach((N) => {
            N && j(N);
          });
        else if (v.type === "ObjectPattern")
          v.properties.forEach((N) => {
            N.type === "RestElement" ? j(N) : N.type === "Property" && j(N.value);
          });
        else if (v.type === "RestElement")
          j(v.argument);
        else {
          if (v.type === "AssignmentPattern")
            throw new Error("AssignmentPattern is not supported. Please open a new bug report.");
          if (v.type === "MemberExpression")
            throw new Error("MemberExpression is not supported. Please open a new bug report.");
        }
      };
      var it = j;
      d(j, "traversePattern");
      let I = P, L = I.declaration;
      L && (L.type === "FunctionDeclaration" ? l.push({ name: L.id.name }) : L.type === "VariableDeclaration" ? L.declarations.forEach((v) => {
        j(v.id);
      }) : L.type === "ClassDeclaration" && l.push({ name: L.id.name }), r.remove(I.start, L.start));
      let $ = I.specifiers || [], T = I.source;
      if (!T && $.length)
        $.forEach((v) => {
          l.push({
            alias: Y(v.exported),
            name: Y(v.local)
          });
        }), r.remove(I.start, I.end);
      else if (T && $.length) {
        let v = [];
        $.forEach((B) => {
          let F = `__vitest_imported_${c++}__`;
          v.push([Y(B.local), F]), l.push({
            name: F,
            alias: Y(B.exported)
          });
        });
        let N = `import { ${v.map(([B, F]) => `${B} as ${F}`).join(", ")} } from '${T.value}'`;
        r.overwrite(I.start, I.end, N);
      }
    }
    if (P.type === "ExportDefaultDeclaration") {
      let I = P, L = I.declaration;
      l.push({ name: "__vitest_default", alias: "default" }), r.overwrite(I.start, L.start, "const __vitest_default = ");
    }
  }
  let p = `
const __vitest_current_es_module__ = {
  __esModule: true,
  ${l.map(({ name: P }) => `["${P}"]: ${P},`).join(`
  `)}
}
const __vitest_mocked_module__ = globalThis[${n}].mockObject(__vitest_current_es_module__, "${t}")
`, R = l.map(({ name: P }, I) => `const __vitest_mocked_${I}__ = __vitest_mocked_module__["${P}"]`).join(`
`), W = `
export {
${l.map(({ name: P, alias: I }, L) => `  __vitest_mocked_${L}__ as ${I || P},`).join(`
`)}
}
`;
  return r.append(p + R + W), r;
}
d($t, "automockModule");

// src/core-server/mocking-utils/extract.ts
var Tt = require("node:fs"), et = require("storybook/internal/babel"), Bt = require("storybook/internal/node-logger"), Ft = require("storybook/internal/telemetry"),
Ut = require("esbuild");
var pt = /* @__PURE__ */ d((u) => et.parser.parse(u, {
  sourceType: "module",
  // Enable plugins to handle modern JavaScript features, including TSX.
  plugins: ["typescript", "jsx", "classProperties", "objectRestSpread"],
  errorRecovery: !0
}).program, "babelParser");

// src/core-server/presets/webpack/loaders/webpack-automock-loader.ts
function gt(u) {
  let e = this.getOptions().spy === "true";
  return dt(u, e, pt).toString();
}
d(gt, "webpackAutomockLoader");
