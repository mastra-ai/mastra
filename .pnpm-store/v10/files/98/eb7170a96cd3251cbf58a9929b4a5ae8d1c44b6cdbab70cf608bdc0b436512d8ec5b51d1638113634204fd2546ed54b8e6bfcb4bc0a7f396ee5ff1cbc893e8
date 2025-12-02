"use strict";
var Eo = Object.create;
var oe = Object.defineProperty;
var Co = Object.getOwnPropertyDescriptor;
var vo = Object.getOwnPropertyNames;
var ko = Object.getPrototypeOf, Po = Object.prototype.hasOwnProperty;
var n = (e, t) => oe(e, "name", { value: t, configurable: !0 });
var Pt = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports), Le = (e, t) => {
  for (var r in t)
    oe(e, r, { get: t[r], enumerable: !0 });
}, Ot = (e, t, r, o) => {
  if (t && typeof t == "object" || typeof t == "function")
    for (let i of vo(t))
      !Po.call(e, i) && i !== r && oe(e, i, { get: () => t[i], enumerable: !(o = Co(t, i)) || o.enumerable });
  return e;
};
var J = (e, t, r) => (r = e != null ? Eo(ko(e)) : {}, Ot(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  t || !e || !e.__esModule ? oe(r, "default", { value: e, enumerable: !0 }) : r,
  e
)), Oo = (e) => Ot(oe({}, "__esModule", { value: !0 }), e);

// ../node_modules/@ngard/tiny-isequal/index.js
var $t = Pt((De) => {
  Object.defineProperty(De, "__esModule", { value: !0 }), De.isEqual = /* @__PURE__ */ function() {
    var e = Object.prototype.toString, t = Object.getPrototypeOf, r = Object.getOwnPropertySymbols ? function(o) {
      return Object.keys(o).concat(Object.getOwnPropertySymbols(o));
    } : Object.keys;
    return function(o, i) {
      return (/* @__PURE__ */ n(function s(a, p, c) {
        var l, y, u, h = e.call(a), T = e.call(p);
        if (a === p) return !0;
        if (a == null || p == null) return !1;
        if (c.indexOf(a) > -1 && c.indexOf(p) > -1) return !0;
        if (c.push(a, p), h != T || (l = r(a), y = r(p), l.length != y.length || l.some(function(R) {
          return !s(a[R], p[R], c);
        }))) return !1;
        switch (h.slice(8, -1)) {
          case "Symbol":
            return a.valueOf() == p.valueOf();
          case "Date":
          case "Number":
            return +a == +p || +a != +a && +p != +p;
          case "RegExp":
          case "Function":
          case "String":
          case "Boolean":
            return "" + a == "" + p;
          case "Set":
          case "Map":
            l = a.entries(), y = p.entries();
            do
              if (!s((u = l.next()).value, y.next().value, c)) return !1;
            while (!u.done);
            return !0;
          case "ArrayBuffer":
            a = new Uint8Array(a), p = new Uint8Array(p);
          case "DataView":
            a = new Uint8Array(a.buffer), p = new Uint8Array(p.buffer);
          case "Float32Array":
          case "Float64Array":
          case "Int8Array":
          case "Int16Array":
          case "Int32Array":
          case "Uint8Array":
          case "Uint16Array":
          case "Uint32Array":
          case "Uint8ClampedArray":
          case "Arguments":
          case "Array":
            if (a.length != p.length) return !1;
            for (u = 0; u < a.length; u++) if ((u in a || u in p) && (u in a != u in p || !s(a[u], p[u], c))) return !1;
            return !0;
          case "Object":
            return s(t(a), t(p), c);
          default:
            return !1;
        }
      }, "n"))(o, i, []);
    };
  }();
});

// ../node_modules/ts-dedent/dist/index.js
var Q = Pt((ie) => {
  "use strict";
  Object.defineProperty(ie, "__esModule", { value: !0 });
  ie.dedent = void 0;
  function Nt(e) {
    for (var t = [], r = 1; r < arguments.length; r++)
      t[r - 1] = arguments[r];
    var o = Array.from(typeof e == "string" ? [e] : e);
    o[o.length - 1] = o[o.length - 1].replace(/\r?\n([\t ]*)$/, "");
    var i = o.reduce(function(p, c) {
      var l = c.match(/\n([\t ]+|(?!\s).)/g);
      return l ? p.concat(l.map(function(y) {
        var u, h;
        return (h = (u = y.match(/[\t ]/g)) === null || u === void 0 ? void 0 : u.length) !== null && h !== void 0 ? h : 0;
      })) : p;
    }, []);
    if (i.length) {
      var s = new RegExp(`
[	 ]{` + Math.min.apply(Math, i) + "}", "g");
      o = o.map(function(p) {
        return p.replace(s, `
`);
      });
    }
    o[0] = o[0].replace(/^\r?\n/, "");
    var a = o[0];
    return t.forEach(function(p, c) {
      var l = a.match(/(?:^|\n)( *)$/), y = l ? l[1] : "", u = p;
      typeof p == "string" && p.includes(`
`) && (u = String(p).split(`
`).map(function(h, T) {
        return T === 0 ? h : "" + y + h;
      }).join(`
`)), a += u + o[c + 1];
    }), a;
  }
  n(Nt, "dedent");
  ie.dedent = Nt;
  ie.default = Nt;
});

// src/csf/index.ts
var Xn = {};
Le(Xn, {
  combineTags: () => qn,
  definePreview: () => Nn,
  definePreviewAddon: () => jn,
  getCoreAnnotations: () => Ct,
  includeConditionalArg: () => It,
  isExportStory: () => Vn,
  isMeta: () => zn,
  isPreview: () => Bn,
  isStory: () => Gn,
  parseKind: () => Kn,
  sanitize: () => wo,
  storyNameFromExport: () => Yn,
  toId: () => Wn
});
module.exports = Oo(Xn);

// src/csf/toStartCaseStr.ts
function Mt(e) {
  return e.replace(/_/g, " ").replace(/-/g, " ").replace(/\./g, " ").replace(/([^\n])([A-Z])([a-z])/g, (t, r, o, i) => `${r} ${o}${i}`).replace(
  /([a-z])([A-Z])/g, (t, r, o) => `${r} ${o}`).replace(/([a-z])([0-9])/gi, (t, r, o) => `${r} ${o}`).replace(/([0-9])([a-z])/gi, (t, r, o) => `${r}\
 ${o}`).replace(/(\s|^)(\w)/g, (t, r, o) => `${r}${o.toUpperCase()}`).replace(/ +/g, " ").trim();
}
n(Mt, "toStartCaseStr");

// src/csf/includeConditionalArg.ts
var _e = J($t(), 1);
var Ft = /* @__PURE__ */ n((e) => e.map((t) => typeof t < "u").filter(Boolean).length, "count"), Mo = /* @__PURE__ */ n((e, t) => {
  let { exists: r, eq: o, neq: i, truthy: s } = e;
  if (Ft([r, o, i, s]) > 1)
    throw new Error(`Invalid conditional test ${JSON.stringify({ exists: r, eq: o, neq: i })}`);
  if (typeof o < "u")
    return (0, _e.isEqual)(t, o);
  if (typeof i < "u")
    return !(0, _e.isEqual)(t, i);
  if (typeof r < "u") {
    let p = typeof t < "u";
    return r ? p : !p;
  }
  return (typeof s > "u" ? !0 : s) ? !!t : !t;
}, "testValue"), It = /* @__PURE__ */ n((e, t, r) => {
  if (!e.if)
    return !0;
  let { arg: o, global: i } = e.if;
  if (Ft([o, i]) !== 1)
    throw new Error(`Invalid conditional value ${JSON.stringify({ arg: o, global: i })}`);
  let s = o ? t[o] : r[i];
  return Mo(e.if, s);
}, "includeConditionalArg");

// src/csf/csf-factories.ts
var To = require("storybook/internal/csf");

// src/preview-api/modules/addons/main.ts
var he = require("@storybook/global");

// src/preview-api/modules/addons/storybook-channel-mock.ts
var Lt = require("storybook/internal/channels");
function Dt() {
  let e = {
    setHandler: /* @__PURE__ */ n(() => {
    }, "setHandler"),
    send: /* @__PURE__ */ n(() => {
    }, "send")
  };
  return new Lt.Channel({ transport: e });
}
n(Dt, "mockChannel");

// src/preview-api/modules/addons/main.ts
var Ne = class {
  constructor() {
    this.getChannel = /* @__PURE__ */ n(() => {
      if (!this.channel) {
        let t = Dt();
        return this.setChannel(t), t;
      }
      return this.channel;
    }, "getChannel");
    this.ready = /* @__PURE__ */ n(() => this.promise, "ready");
    this.hasChannel = /* @__PURE__ */ n(() => !!this.channel, "hasChannel");
    this.setChannel = /* @__PURE__ */ n((t) => {
      this.channel = t, this.resolve();
    }, "setChannel");
    this.promise = new Promise((t) => {
      this.resolve = () => t(this.getChannel());
    });
  }
  static {
    n(this, "AddonStore");
  }
}, He = "__STORYBOOK_ADDONS_PREVIEW";
function $o() {
  return he.global[He] || (he.global[He] = new Ne()), he.global[He];
}
n($o, "getAddonsStore");
var je = $o();

// src/preview-api/modules/addons/hooks.ts
var Fo = require("storybook/internal/client-logger"), K = require("storybook/internal/core-events"), xe = require("@storybook/global");
var be = class {
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
    this.renderListener = /* @__PURE__ */ n((t) => {
      t === this.currentContext?.id && (this.triggerEffects(), this.currentContext = null, this.removeRenderListeners());
    }, "renderListener");
    this.init();
  }
  static {
    n(this, "HooksContext");
  }
  init() {
    this.hookListsMap = /* @__PURE__ */ new WeakMap(), this.mountedDecorators = /* @__PURE__ */ new Set(), this.prevMountedDecorators = /* @__PURE__ */ new Set(),
    this.currentHooks = [], this.nextHookIndex = 0, this.currentPhase = "NONE", this.currentEffects = [], this.prevEffects = [], this.currentDecoratorName =
    null, this.hasUpdates = !1, this.currentContext = null;
  }
  clean() {
    this.prevEffects.forEach((t) => {
      t.destroy && t.destroy();
    }), this.init(), this.removeRenderListeners();
  }
  getNextHook() {
    let t = this.currentHooks[this.nextHookIndex];
    return this.nextHookIndex += 1, t;
  }
  triggerEffects() {
    this.prevEffects.forEach((t) => {
      !this.currentEffects.includes(t) && t.destroy && t.destroy();
    }), this.currentEffects.forEach((t) => {
      this.prevEffects.includes(t) || (t.destroy = t.create());
    }), this.prevEffects = this.currentEffects, this.currentEffects = [];
  }
  addRenderListeners() {
    this.removeRenderListeners(), je.getChannel().on(K.STORY_RENDERED, this.renderListener);
  }
  removeRenderListeners() {
    je.getChannel().removeListener(K.STORY_RENDERED, this.renderListener);
  }
};
function _t(e) {
  let t = /* @__PURE__ */ n((...r) => {
    let { hooks: o } = typeof r[0] == "function" ? r[1] : r[0], i = o.currentPhase, s = o.currentHooks, a = o.nextHookIndex, p = o.currentDecoratorName;
    o.currentDecoratorName = e.name, o.prevMountedDecorators.has(e) ? (o.currentPhase = "UPDATE", o.currentHooks = o.hookListsMap.get(e) || []) :
    (o.currentPhase = "MOUNT", o.currentHooks = [], o.hookListsMap.set(e, o.currentHooks), o.prevMountedDecorators.add(e)), o.nextHookIndex =
    0;
    let c = xe.global.STORYBOOK_HOOKS_CONTEXT;
    xe.global.STORYBOOK_HOOKS_CONTEXT = o;
    let l = e(...r);
    if (xe.global.STORYBOOK_HOOKS_CONTEXT = c, o.currentPhase === "UPDATE" && o.getNextHook() != null)
      throw new Error(
        "Rendered fewer hooks than expected. This may be caused by an accidental early return statement."
      );
    return o.currentPhase = i, o.currentHooks = s, o.nextHookIndex = a, o.currentDecoratorName = p, l;
  }, "hookified");
  return t.originalFn = e, t;
}
n(_t, "hookify");
var Be = 0, Io = 25, Ht = /* @__PURE__ */ n((e) => (t, r) => {
  let o = e(
    _t(t),
    r.map((i) => _t(i))
  );
  return (i) => {
    let { hooks: s } = i;
    s.prevMountedDecorators ??= /* @__PURE__ */ new Set(), s.mountedDecorators = /* @__PURE__ */ new Set([t, ...r]), s.currentContext = i, s.
    hasUpdates = !1;
    let a = o(i);
    for (Be = 1; s.hasUpdates; )
      if (s.hasUpdates = !1, s.currentEffects = [], a = o(i), Be += 1, Be > Io)
        throw new Error(
          "Too many re-renders. Storybook limits the number of renders to prevent an infinite loop."
        );
    return s.addRenderListeners(), a;
  };
}, "applyHooks");

// ../node_modules/es-toolkit/dist/predicate/isPlainObject.mjs
function ne(e) {
  if (!e || typeof e != "object")
    return !1;
  let t = Object.getPrototypeOf(e);
  return t === null || t === Object.prototype || Object.getPrototypeOf(t) === null ? Object.prototype.toString.call(e) === "[object Object]" :
  !1;
}
n(ne, "isPlainObject");

// ../node_modules/es-toolkit/dist/object/mapValues.mjs
function G(e, t) {
  let r = {}, o = Object.keys(e);
  for (let i = 0; i < o.length; i++) {
    let s = o[i], a = e[s];
    r[s] = t(a, s, e);
  }
  return r;
}
n(G, "mapValues");

// ../node_modules/es-toolkit/dist/object/pickBy.mjs
function ze(e, t) {
  let r = {}, o = Object.keys(e);
  for (let i = 0; i < o.length; i++) {
    let s = o[i], a = e[s];
    t(a, s) && (r[s] = a);
  }
  return r;
}
n(ze, "pickBy");

// src/preview-api/modules/store/args.ts
var Lo = require("storybook/internal/client-logger");
var Do = J(Q(), 1);
var wi = Symbol("incompatible");
var Ei = Symbol("Deeply equal");
var Ue = "UNTARGETED";
function jt({
  args: e,
  argTypes: t
}) {
  let r = {};
  return Object.entries(e).forEach(([o, i]) => {
    let { target: s = Ue } = t[o] || {};
    r[s] = r[s] || {}, r[s][o] = i;
  }), r;
}
n(jt, "groupArgsByTarget");

// src/preview-api/modules/store/csf/getValuesFromArgTypes.ts
var Bt = /* @__PURE__ */ n((e = {}) => Object.entries(e).reduce((t, [r, { defaultValue: o }]) => (typeof o < "u" && (t[r] = o), t), {}), "ge\
tValuesFromArgTypes");

// src/preview-api/modules/store/csf/normalizeInputTypes.ts
var _o = /* @__PURE__ */ n((e) => typeof e == "string" ? { name: e } : e, "normalizeType"), Ho = /* @__PURE__ */ n((e) => typeof e == "strin\
g" ? { type: e } : e, "normalizeControl"), No = /* @__PURE__ */ n((e, t) => {
  let { type: r, control: o, ...i } = e, s = {
    name: t,
    ...i
  };
  return r && (s.type = _o(r)), o ? s.control = Ho(o) : o === !1 && (s.control = { disable: !0 }), s;
}, "normalizeInputType"), q = /* @__PURE__ */ n((e) => G(e, No), "normalizeInputTypes");

// src/preview-api/modules/store/csf/normalizeStory.ts
var Te = require("storybook/internal/client-logger"), Se = require("storybook/internal/csf"), zt = J(Q(), 1);

// src/preview-api/modules/store/csf/normalizeArrays.ts
var b = /* @__PURE__ */ n((e) => Array.isArray(e) ? e : e ? [e] : [], "normalizeArrays");

// src/preview-api/modules/store/csf/normalizeStory.ts
var jo = zt.dedent`
CSF .story annotations deprecated; annotate story functions directly:
- StoryFn.story.name => StoryFn.storyName
- StoryFn.story.(parameters|decorators) => StoryFn.(parameters|decorators)
See https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#hoisted-csf-annotations for details and codemod.
`;
function Ge(e, t, r) {
  let o = t, i = typeof t == "function" ? t : null, { story: s } = o;
  s && (Te.logger.debug("deprecated story", s), (0, Te.deprecate)(jo));
  let a = (0, Se.storyNameFromExport)(e), p = typeof o != "function" && o.name || o.storyName || s?.name || a, c = [
    ...b(o.decorators),
    ...b(s?.decorators)
  ], l = { ...s?.parameters, ...o.parameters }, y = { ...s?.args, ...o.args }, u = { ...s?.argTypes, ...o.argTypes }, h = [...b(o.loaders), ...b(
  s?.loaders)], T = [
    ...b(o.beforeEach),
    ...b(s?.beforeEach)
  ], R = [
    ...b(o.afterEach),
    ...b(s?.afterEach)
  ], { render: P, play: L, tags: O = [], globals: F = {} } = o, A = l.__id || (0, Se.toId)(r.id, a);
  return {
    moduleExport: t,
    id: A,
    name: p,
    tags: O,
    decorators: c,
    parameters: l,
    args: y,
    argTypes: q(u),
    loaders: h,
    beforeEach: T,
    afterEach: R,
    globals: F,
    ...P && { render: P },
    ...i && { userStoryFn: i },
    ...L && { play: L }
  };
}
n(Ge, "normalizeStory");

// src/preview-api/modules/store/csf/normalizeComponentAnnotations.ts
var Ut = require("storybook/internal/csf");
function Gt(e, t = e.title, r) {
  let { id: o, argTypes: i } = e;
  return {
    id: (0, Ut.sanitize)(o || t),
    ...e,
    title: t,
    ...i && { argTypes: q(i) },
    parameters: {
      fileName: r,
      ...e.parameters
    }
  };
}
n(Gt, "normalizeComponentAnnotations");

// src/preview-api/modules/store/csf/prepareStory.ts
var Ae = require("storybook/internal/csf"), qt = require("storybook/internal/preview-errors"), Xt = require("@storybook/global"), Zt = require("@storybook/global");

// src/preview-api/modules/preview-web/render/mount-utils.ts
function Yt(e) {
  return e != null && Bo(e).includes("mount");
}
n(Yt, "mountDestructured");
function Bo(e) {
  let t = e.toString().match(/[^(]*\(([^)]*)/);
  if (!t)
    return [];
  let r = Wt(t[1]);
  if (!r.length)
    return [];
  let o = r[0];
  return o.startsWith("{") && o.endsWith("}") ? Wt(o.slice(1, -1).replace(/\s/g, "")).map((s) => s.replace(/:.*|=.*/g, "")) : [];
}
n(Bo, "getUsedProps");
function Wt(e) {
  let t = [], r = [], o = 0;
  for (let s = 0; s < e.length; s++)
    if (e[s] === "{" || e[s] === "[")
      r.push(e[s] === "{" ? "}" : "]");
    else if (e[s] === r[r.length - 1])
      r.pop();
    else if (!r.length && e[s] === ",") {
      let a = e.substring(o, s).trim();
      a && t.push(a), o = s + 1;
    }
  let i = e.substring(o).trim();
  return i && t.push(i), t;
}
n(Wt, "splitByComma");

// src/preview-api/modules/store/decorators.ts
function Vt(e, t, r) {
  let o = r(e);
  return (i) => t(o, i);
}
n(Vt, "decorateStory");
function Kt({
  componentId: e,
  title: t,
  kind: r,
  id: o,
  name: i,
  story: s,
  parameters: a,
  initialArgs: p,
  argTypes: c,
  ...l
} = {}) {
  return l;
}
n(Kt, "sanitizeStoryContextUpdate");
function We(e, t) {
  let r = {}, o = /* @__PURE__ */ n((s) => (a) => {
    if (!r.value)
      throw new Error("Decorated function called without init");
    return r.value = {
      ...r.value,
      ...Kt(a)
    }, s(r.value);
  }, "bindWithContext"), i = t.reduce(
    (s, a) => Vt(s, a, o),
    e
  );
  return (s) => (r.value = s, i(s));
}
n(We, "defaultDecorateStory");

// src/preview-api/modules/store/parameters.ts
var D = /* @__PURE__ */ n((...e) => {
  let t = {}, r = e.filter(Boolean), o = r.reduce((i, s) => (Object.entries(s).forEach(([a, p]) => {
    let c = i[a];
    Array.isArray(p) || typeof c > "u" ? i[a] = p : ne(p) && ne(c) ? t[a] = !0 : typeof p < "u" && (i[a] = p);
  }), i), {});
  return Object.keys(t).forEach((i) => {
    let s = r.filter(Boolean).map((a) => a[i]).filter((a) => typeof a < "u");
    s.every((a) => ne(a)) ? o[i] = D(...s) : o[i] = s[s.length - 1];
  }), o;
}, "combineParameters");

// src/preview-api/modules/store/csf/prepareStory.ts
function Ye(e, t, r) {
  let { moduleExport: o, id: i, name: s } = e || {}, a = zo(
    e,
    t,
    r
  ), p = /* @__PURE__ */ n(async (w) => {
    let d = {};
    for (let m of [
      b(r.loaders),
      b(t.loaders),
      b(e.loaders)
    ]) {
      if (w.abortSignal.aborted)
        return d;
      let f = await Promise.all(m.map((x) => x(w)));
      Object.assign(d, ...f);
    }
    return d;
  }, "applyLoaders"), c = /* @__PURE__ */ n(async (w) => {
    let d = new Array();
    for (let m of [
      ...b(r.beforeEach),
      ...b(t.beforeEach),
      ...b(e.beforeEach)
    ]) {
      if (w.abortSignal.aborted)
        return d;
      let f = await m(w);
      f && d.push(f);
    }
    return d;
  }, "applyBeforeEach"), l = /* @__PURE__ */ n(async (w) => {
    let d = [
      ...b(r.afterEach),
      ...b(t.afterEach),
      ...b(e.afterEach)
    ].reverse();
    for (let m of d) {
      if (w.abortSignal.aborted)
        return;
      await m(w);
    }
  }, "applyAfterEach"), y = /* @__PURE__ */ n((w) => w.originalStoryFn(w.args, w), "undecoratedStoryFn"), { applyDecorators: u = We, runStep: h } = r,
  T = [
    ...b(e?.decorators),
    ...b(t?.decorators),
    ...b(r?.decorators)
  ], R = e?.userStoryFn || e?.render || t.render || r.render, P = Ht(u)(y, T), L = /* @__PURE__ */ n((w) => P(w), "unboundStoryFn"), O = e?.
  play ?? t?.play, F = Yt(O);
  if (!R && !F)
    throw new qt.NoRenderFunctionError({ id: i });
  let A = /* @__PURE__ */ n((w) => async () => (await w.renderToCanvas(), w.canvas), "defaultMount"), S = e.mount ?? t.mount ?? r.mount ?? A,
  v = r.testingLibraryRender;
  return {
    storyGlobals: {},
    ...a,
    moduleExport: o,
    id: i,
    name: s,
    story: s,
    originalStoryFn: R,
    undecoratedStoryFn: y,
    unboundStoryFn: L,
    applyLoaders: p,
    applyBeforeEach: c,
    applyAfterEach: l,
    playFunction: O,
    runStep: h,
    mount: S,
    testingLibraryRender: v,
    renderToCanvas: r.renderToCanvas,
    usesMount: F
  };
}
n(Ye, "prepareStory");
function zo(e, t, r) {
  let o = ["dev", "test"], i = Zt.global.DOCS_OPTIONS?.autodocs === !0 ? ["autodocs"] : [], s = (0, Ae.combineTags)(
    ...o,
    ...i,
    ...r.tags ?? [],
    ...t.tags ?? [],
    ...e?.tags ?? []
  ), a = D(
    r.parameters,
    t.parameters,
    e?.parameters
  ), { argTypesEnhancers: p = [], argsEnhancers: c = [] } = r, l = D(
    r.argTypes,
    t.argTypes,
    e?.argTypes
  );
  if (e) {
    let O = e?.userStoryFn || e?.render || t.render || r.render;
    a.__isArgsStory = O && O.length > 0;
  }
  let y = {
    ...r.args,
    ...t.args,
    ...e?.args
  }, u = {
    ...t.globals,
    ...e?.globals
  }, h = {
    componentId: t.id,
    title: t.title,
    kind: t.title,
    // Back compat
    id: e?.id || t.id,
    // if there's no story name, we create a fake one since enhancers expect a name
    name: e?.name || "__meta",
    story: e?.name || "__meta",
    // Back compat
    component: t.component,
    subcomponents: t.subcomponents,
    tags: s,
    parameters: a,
    initialArgs: y,
    argTypes: l,
    storyGlobals: u
  };
  h.argTypes = p.reduce(
    (O, F) => F({ ...h, argTypes: O }),
    h.argTypes
  );
  let T = { ...y };
  h.initialArgs = [...c].reduce(
    (O, F) => ({
      ...O,
      ...F({
        ...h,
        initialArgs: O
      })
    }),
    T
  );
  let { name: R, story: P, ...L } = h;
  return L;
}
n(zo, "preparePartialAnnotations");
function Jt(e) {
  let { args: t } = e, r = {
    ...e,
    allArgs: void 0,
    argsByTarget: void 0
  };
  if (Xt.global.FEATURES?.argTypeTargetsV7) {
    let s = jt(e);
    r = {
      ...e,
      allArgs: e.args,
      argsByTarget: s,
      args: s[Ue] || {}
    };
  }
  let o = Object.entries(r.args).reduce((s, [a, p]) => {
    if (!r.argTypes[a]?.mapping)
      return s[a] = p, s;
    let c = /* @__PURE__ */ n((l) => {
      let y = r.argTypes[a].mapping;
      return y && l in y ? y[l] : l;
    }, "mappingFn");
    return s[a] = Array.isArray(p) ? p.map(c) : c(p), s;
  }, {}), i = Object.entries(o).reduce((s, [a, p]) => {
    let c = r.argTypes[a] || {};
    return (0, Ae.includeConditionalArg)(c, o, r.globals) && (s[a] = p), s;
  }, {});
  return { ...r, unmappedArgs: t, args: i };
}
n(Jt, "prepareContext");

// src/preview-api/modules/store/inferArgTypes.ts
var Qt = require("storybook/internal/client-logger");
var er = J(Q(), 1);
var Ve = /* @__PURE__ */ n((e, t, r) => {
  let o = typeof e;
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
  return e ? r.has(e) ? (Qt.logger.warn(er.dedent`
        We've detected a cycle in arg '${t}'. Args should be JSON-serializable.

        Consider using the mapping feature or fully custom args:
        - Mapping: https://storybook.js.org/docs/writing-stories/args#mapping-to-complex-arg-values
        - Custom args: https://storybook.js.org/docs/essentials/controls#fully-custom-args
      `), { name: "other", value: "cyclic object" }) : (r.add(e), Array.isArray(e) ? { name: "array", value: e.length > 0 ? Ve(e[0], t, new Set(
  r)) : { name: "other", value: "unknown" } } : { name: "object", value: G(e, (s) => Ve(s, t, new Set(r))) }) : { name: "object", value: {} };
}, "inferType"), Ke = /* @__PURE__ */ n((e) => {
  let { id: t, argTypes: r = {}, initialArgs: o = {} } = e, i = G(o, (a, p) => ({
    name: p,
    type: Ve(a, `${t}.${p}`, /* @__PURE__ */ new Set())
  })), s = G(r, (a, p) => ({
    name: p
  }));
  return D(i, s, r);
}, "inferArgTypes");
Ke.secondPass = !0;

// src/preview-api/modules/store/inferControls.ts
var rr = require("storybook/internal/client-logger");

// src/preview-api/modules/store/filterArgTypes.ts
var tr = /* @__PURE__ */ n((e, t) => Array.isArray(t) ? t.includes(e) : e.match(t), "matches"), qe = /* @__PURE__ */ n((e, t, r) => !t && !r ?
e : e && ze(e, (o, i) => {
  let s = o.name || i.toString();
  return !!(!t || tr(s, t)) && (!r || !tr(s, r));
}), "filterArgTypes");

// src/preview-api/modules/store/inferControls.ts
var Uo = /* @__PURE__ */ n((e, t, r) => {
  let { type: o, options: i } = e;
  if (o) {
    if (r.color && r.color.test(t)) {
      let s = o.name;
      if (s === "string")
        return { control: { type: "color" } };
      s !== "enum" && rr.logger.warn(
        `Addon controls: Control of type color only supports string, received "${s}" instead`
      );
    }
    if (r.date && r.date.test(t))
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
        let { value: s } = o;
        return { control: { type: s?.length <= 5 ? "radio" : "select" }, options: s };
      }
      case "function":
      case "symbol":
        return null;
      default:
        return { control: { type: i ? "select" : "object" } };
    }
  }
}, "inferControl"), Re = /* @__PURE__ */ n((e) => {
  let {
    argTypes: t,
    parameters: { __isArgsStory: r, controls: { include: o = null, exclude: i = null, matchers: s = {} } = {} }
  } = e;
  if (!r)
    return t;
  let a = qe(t, o, i), p = G(a, (c, l) => c?.type && Uo(c, l.toString(), s));
  return D(p, a);
}, "inferControls");
Re.secondPass = !0;

// src/preview-api/modules/store/csf/normalizeProjectAnnotations.ts
function se({
  argTypes: e,
  globalTypes: t,
  argTypesEnhancers: r,
  decorators: o,
  loaders: i,
  beforeEach: s,
  afterEach: a,
  initialGlobals: p,
  ...c
}) {
  return {
    ...e && { argTypes: q(e) },
    ...t && { globalTypes: q(t) },
    decorators: b(o),
    loaders: b(i),
    beforeEach: b(s),
    afterEach: b(a),
    argTypesEnhancers: [
      ...r || [],
      Ke,
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
      Re
    ],
    initialGlobals: p,
    ...c
  };
}
n(se, "normalizeProjectAnnotations");

// src/preview-api/modules/store/csf/composeConfigs.ts
var nr = require("@storybook/global");

// src/preview-api/modules/store/csf/beforeAll.ts
var or = /* @__PURE__ */ n((e) => async () => {
  let t = [];
  for (let r of e) {
    let o = await r();
    o && t.unshift(o);
  }
  return async () => {
    for (let r of t)
      await r();
  };
}, "composeBeforeAllHooks");

// src/preview-api/modules/store/csf/stepRunners.ts
function Xe(e) {
  return async (t, r, o) => {
    await e.reduceRight(
      (s, a) => async () => a(t, s, o),
      async () => r(o)
    )();
  };
}
n(Xe, "composeStepRunners");

// src/preview-api/modules/store/csf/composeConfigs.ts
function pe(e, t) {
  return e.map((r) => r.default?.[t] ?? r[t]).filter(Boolean);
}
n(pe, "getField");
function Y(e, t, r = {}) {
  return pe(e, t).reduce((o, i) => {
    let s = b(i);
    return r.reverseFileOrder ? [...s, ...o] : [...o, ...s];
  }, []);
}
n(Y, "getArrayField");
function we(e, t) {
  return Object.assign({}, ...pe(e, t));
}
n(we, "getObjectField");
function ae(e, t) {
  return pe(e, t).pop();
}
n(ae, "getSingletonField");
function le(e) {
  let t = Y(e, "argTypesEnhancers"), r = pe(e, "runStep"), o = Y(e, "beforeAll");
  return {
    parameters: D(...pe(e, "parameters")),
    decorators: Y(e, "decorators", {
      reverseFileOrder: !(nr.global.FEATURES?.legacyDecoratorFileOrder ?? !1)
    }),
    args: we(e, "args"),
    argsEnhancers: Y(e, "argsEnhancers"),
    argTypes: we(e, "argTypes"),
    argTypesEnhancers: [
      ...t.filter((i) => !i.secondPass),
      ...t.filter((i) => i.secondPass)
    ],
    initialGlobals: we(e, "initialGlobals"),
    globalTypes: we(e, "globalTypes"),
    loaders: Y(e, "loaders"),
    beforeAll: or(o),
    beforeEach: Y(e, "beforeEach"),
    afterEach: Y(e, "afterEach"),
    render: ae(e, "render"),
    renderToCanvas: ae(e, "renderToCanvas"),
    applyDecorators: ae(e, "applyDecorators"),
    runStep: Xe(r),
    tags: Y(e, "tags"),
    mount: ae(e, "mount"),
    testingLibraryRender: ae(e, "testingLibraryRender")
  };
}
n(le, "composeConfigs");

// src/preview-api/modules/store/csf/portable-stories.ts
var Wo = require("storybook/internal/csf"), Yo = require("storybook/internal/csf"), lr = require("storybook/internal/preview-errors"), Vo = J(Q(), 1);

// src/preview-api/modules/preview-web/render/animation-utils.ts
function ir() {
  try {
    return (
      // @ts-expect-error This property exists in Vitest browser mode
      !!globalThis.__vitest_browser__ || !!globalThis.window?.navigator?.userAgent?.match(/StorybookTestRunner/)
    );
  } catch {
    return !1;
  }
}
n(ir, "isTestEnvironment");
function sr(e = !0) {
  if (!("document" in globalThis && "createElement" in globalThis.document))
    return () => {
    };
  let t = document.createElement("style");
  t.textContent = `*, *:before, *:after {
    animation: none !important;
  }`, document.head.appendChild(t);
  let r = document.createElement("style");
  return r.textContent = `*, *:before, *:after {
    animation-delay: 0s !important;
    animation-direction: ${e ? "reverse" : "normal"} !important;
    animation-play-state: paused !important;
    transition: none !important;
  }`, document.head.appendChild(r), document.body.clientHeight, document.head.removeChild(t), () => {
    r.parentNode?.removeChild(r);
  };
}
n(sr, "pauseAnimations");
async function ar(e) {
  if (!("document" in globalThis && "getAnimations" in globalThis.document && "querySelectorAll" in globalThis.document))
    return;
  let t = !1;
  await Promise.race([
    // After 50ms, retrieve any running animations and wait for them to finish
    // If new animations are created while waiting, we'll wait for them too
    new Promise((r) => {
      setTimeout(() => {
        let o = [globalThis.document, ...pr(globalThis.document)], i = /* @__PURE__ */ n(async () => {
          if (t || e?.aborted)
            return;
          let s = o.flatMap((a) => a?.getAnimations?.() || []).filter((a) => a.playState === "running" && !Go(a));
          s.length > 0 && (await Promise.all(s.map((a) => a.finished)), await i());
        }, "checkAnimationsFinished");
        i().then(r);
      }, 100);
    }),
    // If animations don't finish within the timeout, continue without waiting
    new Promise(
      (r) => setTimeout(() => {
        t = !0, r(void 0);
      }, 5e3)
    )
  ]);
}
n(ar, "waitForAnimations");
function pr(e) {
  return [e, ...e.querySelectorAll("*")].reduce((t, r) => ("shadowRoot" in r && r.shadowRoot && t.push(r.shadowRoot, ...pr(r.shadowRoot)), t),
  []);
}
n(pr, "getShadowRoots");
function Go(e) {
  if (e instanceof CSSAnimation && e.effect instanceof KeyframeEffect && e.effect.target) {
    let t = getComputedStyle(e.effect.target, e.effect.pseudoElement), r = t.animationName?.split(", ").indexOf(e.animationName);
    return t.animationIterationCount.split(", ")[r] === "infinite";
  }
  return !1;
}
n(Go, "isInfiniteAnimation");

// src/preview-api/modules/store/reporter-api.ts
var Ee = class {
  constructor() {
    this.reports = [];
  }
  static {
    n(this, "ReporterAPI");
  }
  async addReport(t) {
    this.reports.push(t);
  }
};

// src/preview-api/modules/store/csf/portable-stories.ts
var Ko = "ComposedStory", qo = "Unnamed Story";
var V = [];
function Ze(e, t, r, o, i) {
  if (e === void 0)
    throw new Error("Expected a story but received undefined.");
  t.title = t.title ?? Ko;
  let s = Gt(t), a = i || e.storyName || e.story?.name || e.name || qo, p = Ge(
    a,
    e,
    s
  ), c = se(
    le([
      o ?? globalThis.globalProjectAnnotations ?? {},
      r ?? {}
    ])
  ), l = Ye(
    p,
    s,
    c
  ), u = {
    ...Bt(c.globalTypes),
    ...c.initialGlobals,
    ...l.storyGlobals
  }, h = new Ee(), T = /* @__PURE__ */ n(() => {
    let A = Jt({
      hooks: new be(),
      globals: u,
      args: { ...l.initialArgs },
      viewMode: "story",
      reporting: h,
      loaded: {},
      abortSignal: new AbortController().signal,
      step: /* @__PURE__ */ n((S, v) => l.runStep(S, v, A), "step"),
      canvasElement: null,
      canvas: {},
      userEvent: {},
      globalTypes: c.globalTypes,
      ...l,
      context: null,
      mount: null
    });
    return A.parameters.__isPortableStory = !0, A.context = A, l.renderToCanvas && (A.renderToCanvas = async () => {
      let S = await l.renderToCanvas?.(
        {
          componentId: l.componentId,
          title: l.title,
          id: l.id,
          name: l.name,
          tags: l.tags,
          showMain: /* @__PURE__ */ n(() => {
          }, "showMain"),
          showError: /* @__PURE__ */ n((v) => {
            throw new Error(`${v.title}
${v.description}`);
          }, "showError"),
          showException: /* @__PURE__ */ n((v) => {
            throw v;
          }, "showException"),
          forceRemount: !0,
          storyContext: A,
          storyFn: /* @__PURE__ */ n(() => l.unboundStoryFn(A), "storyFn"),
          unboundStoryFn: l.unboundStoryFn
        },
        A.canvasElement
      );
      S && V.push(S);
    }), A.mount = l.mount(A), A;
  }, "initializeContext"), R, P = /* @__PURE__ */ n(async (A) => {
    let S = T();
    return S.canvasElement ??= globalThis?.document?.body, R && (S.loaded = R.loaded), Object.assign(S, A), l.playFunction(S);
  }, "play"), L = /* @__PURE__ */ n((A) => {
    let S = T();
    return Object.assign(S, A), Xo(l, S);
  }, "run"), O = l.playFunction ? P : void 0;
  return Object.assign(
    /* @__PURE__ */ n(function(S) {
      let v = T();
      return R && (v.loaded = R.loaded), v.args = {
        ...v.initialArgs,
        ...S
      }, l.unboundStoryFn(v);
    }, "storyFn"),
    {
      id: l.id,
      storyName: a,
      load: /* @__PURE__ */ n(async () => {
        for (let S of [...V].reverse())
          await S();
        V.length = 0;
        let A = T();
        A.loaded = await l.applyLoaders(A), V.push(...(await l.applyBeforeEach(A)).filter(Boolean)), R = A;
      }, "load"),
      globals: u,
      args: l.initialArgs,
      parameters: l.parameters,
      argTypes: l.argTypes,
      play: O,
      run: L,
      reporting: h,
      tags: l.tags
    }
  );
}
n(Ze, "composeStory");
async function Xo(e, t) {
  for (let s of [...V].reverse())
    await s();
  if (V.length = 0, !t.canvasElement) {
    let s = document.createElement("div");
    globalThis?.document?.body?.appendChild(s), t.canvasElement = s, V.push(() => {
      globalThis?.document?.body?.contains(s) && globalThis?.document?.body?.removeChild(s);
    });
  }
  if (t.loaded = await e.applyLoaders(t), t.abortSignal.aborted)
    return;
  V.push(...(await e.applyBeforeEach(t)).filter(Boolean));
  let r = e.playFunction, o = e.usesMount;
  if (o || await t.mount(), t.abortSignal.aborted)
    return;
  r && (o || (t.mount = async () => {
    throw new lr.MountMustBeDestructuredError({ playFunction: r.toString() });
  }), await r(t));
  let i;
  ir() ? i = sr() : await ar(t.abortSignal), await e.applyAfterEach(t), await i?.();
}
n(Xo, "runStory");

// ../node_modules/tiny-invariant/dist/esm/tiny-invariant.js
var Zo = process.env.NODE_ENV === "production", Je = "Invariant failed";
function Ce(e, t) {
  if (!e) {
    if (Zo)
      throw new Error(Je);
    var r = typeof t == "function" ? t() : t, o = r ? "".concat(Je, ": ").concat(r) : Je;
    throw new Error(o);
  }
}
n(Ce, "invariant");

// src/actions/preview.ts
var Tr = require("storybook/internal/csf");

// src/actions/addArgs.ts
var tt = {};
Le(tt, {
  argsEnhancers: () => en
});

// src/actions/runtime/action.ts
var mr = require("storybook/internal/preview-errors"), et = require("@storybook/global"), ur = require("storybook/preview-api");

// src/actions/constants.ts
var Qe = "storybook/actions", ua = `${Qe}/panel`, cr = `${Qe}/action-event`, fa = `${Qe}/action-clear`;

// src/actions/runtime/configureActions.ts
var dr = {
  depth: 10,
  clearOnStoryChange: !0,
  limit: 50
};

// src/actions/runtime/action.ts
var fr = /* @__PURE__ */ n((e, t) => {
  let r = Object.getPrototypeOf(e);
  return !r || t(r) ? r : fr(r, t);
}, "findProto"), Jo = /* @__PURE__ */ n((e) => !!(typeof e == "object" && e && fr(e, (t) => /^Synthetic(?:Base)?Event$/.test(t.constructor.name)) &&
typeof e.persist == "function"), "isReactSyntheticEvent"), Qo = /* @__PURE__ */ n((e) => {
  if (Jo(e)) {
    let t = Object.create(
      e.constructor.prototype,
      Object.getOwnPropertyDescriptors(e)
    );
    t.persist();
    let r = Object.getOwnPropertyDescriptor(t, "view"), o = r?.value;
    return typeof o == "object" && o?.constructor.name === "Window" && Object.defineProperty(t, "view", {
      ...r,
      value: Object.create(o.constructor.prototype)
    }), t;
  }
  return e;
}, "serializeArg");
function ce(e, t = {}) {
  let r = {
    ...dr,
    ...t
  }, o = /* @__PURE__ */ n(function(...s) {
    if (t.implicit) {
      let T = ("__STORYBOOK_PREVIEW__" in et.global ? et.global.__STORYBOOK_PREVIEW__ : void 0)?.storyRenders.find(
        (R) => R.phase === "playing" || R.phase === "rendering"
      );
      if (T) {
        let R = !globalThis?.FEATURES?.disallowImplicitActionsInRenderV8, P = new mr.ImplicitActionsDuringRendering({
          phase: T.phase,
          name: e,
          deprecated: R
        });
        if (R)
          console.warn(P);
        else
          throw P;
      }
    }
    let a = ur.addons.getChannel(), p = Date.now().toString(36) + Math.random().toString(36).substring(2), c = 5, l = s.map(Qo), y = s.length >
    1 ? l : l[0], u = {
      id: p,
      count: 0,
      data: { name: e, args: y },
      options: {
        ...r,
        maxDepth: c + (r.depth || 3)
      }
    };
    a.emit(cr, u);
  }, "actionHandler");
  return o.isAction = !0, o.implicit = t.implicit, o;
}
n(ce, "action");

// src/actions/addArgsHelpers.ts
var yr = /* @__PURE__ */ n((e, t) => typeof t[e] > "u" && !(e in t), "isInInitialArgs"), gr = /* @__PURE__ */ n((e) => {
  let {
    initialArgs: t,
    argTypes: r,
    id: o,
    parameters: { actions: i }
  } = e;
  if (!i || i.disable || !i.argTypesRegex || !r)
    return {};
  let s = new RegExp(i.argTypesRegex);
  return Object.entries(r).filter(
    ([p]) => !!s.test(p)
  ).reduce((p, [c, l]) => (yr(c, t) && (p[c] = ce(c, { implicit: !0, id: o })), p), {});
}, "inferActionsFromArgTypesRegex"), hr = /* @__PURE__ */ n((e) => {
  let {
    initialArgs: t,
    argTypes: r,
    parameters: { actions: o }
  } = e;
  return o?.disable || !r ? {} : Object.entries(r).filter(([s, a]) => !!a.action).reduce((s, [a, p]) => (yr(a, t) && (s[a] = ce(typeof p.action ==
  "string" ? p.action : a)), s), {});
}, "addActionsFromArgTypes");

// src/actions/addArgs.ts
var en = [
  hr,
  gr
];

// src/actions/loaders.ts
var rt = {};
Le(rt, {
  loaders: () => rn
});
var br = require("storybook/test");
var xr = !1, tn = /* @__PURE__ */ n((e) => {
  let { parameters: t } = e;
  t?.actions?.disable || xr || ((0, br.onMockCall)((r, o) => {
    let i = r.getMockName();
    i !== "spy" && (!/^next\/.*::/.test(i) || [
      "next/router::useRouter()",
      "next/navigation::useRouter()",
      "next/navigation::redirect",
      "next/cache::",
      "next/headers::cookies().set",
      "next/headers::cookies().delete",
      "next/headers::headers().set",
      "next/headers::headers().delete"
    ].some((s) => i.startsWith(s))) && ce(i)(o);
  }), xr = !0);
}, "logActionsWhenMockCalled"), rn = [tn];

// src/actions/preview.ts
var ot = /* @__PURE__ */ n(() => (0, Tr.definePreviewAddon)({
  ...tt,
  ...rt
}), "default");

// src/backgrounds/preview.ts
var kr = require("storybook/internal/csf");

// src/backgrounds/constants.ts
var on = "storybook/background", ee = "backgrounds";
var Oa = {
  UPDATE: `${on}/update`
};

// src/backgrounds/decorator.ts
var it = require("storybook/preview-api");

// src/backgrounds/defaults.ts
var Sr = {
  light: { name: "light", value: "#F8F8F8" },
  dark: { name: "dark", value: "#333" }
};

// src/backgrounds/utils.ts
var { document: B } = globalThis, Ar = /* @__PURE__ */ n(() => globalThis?.matchMedia ? !!globalThis.matchMedia("(prefers-reduced-motion: re\
duce)")?.matches : !1, "isReduceMotionEnabled"), nt = /* @__PURE__ */ n((e) => {
  (Array.isArray(e) ? e : [e]).forEach(nn);
}, "clearStyles"), nn = /* @__PURE__ */ n((e) => {
  if (!B)
    return;
  let t = B.getElementById(e);
  t && t.parentElement && t.parentElement.removeChild(t);
}, "clearStyle"), Rr = /* @__PURE__ */ n((e, t) => {
  if (!B)
    return;
  let r = B.getElementById(e);
  if (r)
    r.innerHTML !== t && (r.innerHTML = t);
  else {
    let o = B.createElement("style");
    o.setAttribute("id", e), o.innerHTML = t, B.head.appendChild(o);
  }
}, "addGridStyle"), wr = /* @__PURE__ */ n((e, t, r) => {
  if (!B)
    return;
  let o = B.getElementById(e);
  if (o)
    o.innerHTML !== t && (o.innerHTML = t);
  else {
    let i = B.createElement("style");
    i.setAttribute("id", e), i.innerHTML = t;
    let s = `addon-backgrounds-grid${r ? `-docs-${r}` : ""}`, a = B.getElementById(s);
    a ? a.parentElement?.insertBefore(i, a) : B.head.appendChild(i);
  }
}, "addBackgroundStyle");

// src/backgrounds/decorator.ts
var sn = {
  cellSize: 100,
  cellAmount: 10,
  opacity: 0.8
}, Er = "addon-backgrounds", Cr = "addon-backgrounds-grid", an = Ar() ? "" : "transition: background-color 0.3s;", vr = /* @__PURE__ */ n((e, t) => {
  let { globals: r = {}, parameters: o = {}, viewMode: i, id: s } = t, {
    options: a = Sr,
    disable: p,
    grid: c = sn
  } = o[ee] || {}, l = r[ee] || {}, y = typeof l == "string" ? l : l?.value, u = y ? a[y] : void 0, h = typeof u == "string" ? u : u?.value ||
  "transparent", T = typeof l == "string" ? !1 : l.grid || !1, R = !!u && !p, P = i === "docs" ? `#anchor--${s} .docs-story` : ".sb-show-mai\
n", L = i === "docs" ? `#anchor--${s} .docs-story` : ".sb-show-main", O = o.layout === void 0 || o.layout === "padded", F = i === "docs" ? 20 :
  O ? 16 : 0, { cellAmount: A, cellSize: S, opacity: v, offsetX: w = F, offsetY: d = F } = c, m = i === "docs" ? `${Er}-docs-${s}` : `${Er}-\
color`, f = i === "docs" ? s : null;
  (0, it.useEffect)(() => {
    let g = `
    ${P} {
      background: ${h} !important;
      ${an}
      }`;
    if (!R) {
      nt(m);
      return;
    }
    wr(m, g, f);
  }, [P, m, f, R, h]);
  let x = i === "docs" ? `${Cr}-docs-${s}` : `${Cr}`;
  return (0, it.useEffect)(() => {
    if (!T) {
      nt(x);
      return;
    }
    let g = [
      `${S * A}px ${S * A}px`,
      `${S * A}px ${S * A}px`,
      `${S}px ${S}px`,
      `${S}px ${S}px`
    ].join(", "), E = `
        ${L} {
          background-size: ${g} !important;
          background-position: ${w}px ${d}px, ${w}px ${d}px, ${w}px ${d}px, ${w}px ${d}px !important;
          background-blend-mode: difference !important;
          background-image: linear-gradient(rgba(130, 130, 130, ${v}) 1px, transparent 1px),
           linear-gradient(90deg, rgba(130, 130, 130, ${v}) 1px, transparent 1px),
           linear-gradient(rgba(130, 130, 130, ${v / 2}) 1px, transparent 1px),
           linear-gradient(90deg, rgba(130, 130, 130, ${v / 2}) 1px, transparent 1px) !important;
        }
      `;
    Rr(x, E);
  }, [A, S, L, x, T, w, d, v]), e();
}, "withBackgroundAndGrid");

// src/backgrounds/preview.ts
var pn = globalThis.FEATURES?.backgrounds ? [vr] : [], ln = {
  [ee]: {
    grid: {
      cellSize: 20,
      opacity: 0.5,
      cellAmount: 5
    },
    disable: !1
  }
}, cn = {
  [ee]: { value: void 0, grid: !1 }
}, st = /* @__PURE__ */ n(() => (0, kr.definePreviewAddon)({
  decorators: pn,
  parameters: ln,
  initialGlobals: cn
}), "default");

// src/component-testing/preview.ts
var Pr = require("storybook/internal/csf"), Or = require("storybook/internal/instrumenter");
var { step: dn } = (0, Or.instrument)(
  {
    // It seems like the label is unused, but the instrumenter has access to it
    // The context will be bounded later in StoryRender, so that the user can write just:
    // await step("label", (context) => {
    //   // labeled step
    // });
    step: /* @__PURE__ */ n(async (e, t, r) => t(r), "step")
  },
  { intercept: !0 }
), at = /* @__PURE__ */ n(() => (0, Pr.definePreviewAddon)({
  parameters: {
    throwPlayFunctionExceptions: !1
  },
  runStep: dn
}), "default");

// src/highlight/preview.ts
var Ur = require("storybook/internal/csf"), ft = require("storybook/preview-api");

// src/highlight/useHighlights.ts
var Br = require("storybook/internal/core-events");

// src/highlight/constants.ts
var ve = "storybook/highlight", Mr = `${ve}/add`, $r = `${ve}/remove`, Fr = `${ve}/reset`, Ir = `${ve}/scroll-into-view`, pt = 2147483647, z = 28;

// src/highlight/icons.ts
var lt = {
  chevronLeft: [
    "M9.10355 10.1464C9.29882 10.3417 9.29882 10.6583 9.10355 10.8536C8.90829 11.0488 8.59171 11.0488 8.39645 10.8536L4.89645 7.35355C4.7011\
8 7.15829 4.70118 6.84171 4.89645 6.64645L8.39645 3.14645C8.59171 2.95118 8.90829 2.95118 9.10355 3.14645C9.29882 3.34171 9.29882 3.65829 9.\
10355 3.85355L5.95711 7L9.10355 10.1464Z"
  ],
  chevronRight: [
    "M4.89645 10.1464C4.70118 10.3417 4.70118 10.6583 4.89645 10.8536C5.09171 11.0488 5.40829 11.0488 5.60355 10.8536L9.10355 7.35355C9.2988\
2 7.15829 9.29882 6.84171 9.10355 6.64645L5.60355 3.14645C5.40829 2.95118 5.09171 2.95118 4.89645 3.14645C4.70118 3.34171 4.70118 3.65829 4.\
89645 3.85355L8.04289 7L4.89645 10.1464Z"
  ],
  info: [
    "M7 5.5a.5.5 0 01.5.5v4a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zM7 4.5A.75.75 0 107 3a.75.75 0 000 1.5z",
    "M7 14A7 7 0 107 0a7 7 0 000 14zm0-1A6 6 0 107 1a6 6 0 000 12z"
  ],
  shareAlt: [
    "M2 1.004a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-4.5a.5.5 0 00-1 0v4.5H2v-10h4.5a.5.5 0 000-1H2z",
    "M7.354 7.357L12 2.711v1.793a.5.5 0 001 0v-3a.5.5 0 00-.5-.5h-3a.5.5 0 100 1h1.793L6.646 6.65a.5.5 0 10.708.707z"
  ]
};

// src/highlight/utils.ts
var mn = "svg,path,rect,circle,line,polyline,polygon,ellipse,text".split(","), M = /* @__PURE__ */ n((e, t = {}, r) => {
  let o = mn.includes(e) ? document.createElementNS("http://www.w3.org/2000/svg", e) : document.createElement(e);
  return Object.entries(t).forEach(([i, s]) => {
    /[A-Z]/.test(i) ? (i === "onClick" && (o.addEventListener("click", s), o.addEventListener("keydown", (a) => {
      (a.key === "Enter" || a.key === " ") && (a.preventDefault(), s());
    })), i === "onMouseEnter" && o.addEventListener("mouseenter", s), i === "onMouseLeave" && o.addEventListener("mouseleave", s)) : o.setAttribute(
    i, s);
  }), r?.forEach((i) => {
    if (!(i == null || i === !1))
      try {
        o.appendChild(i);
      } catch {
        o.appendChild(document.createTextNode(String(i)));
      }
  }), o;
}, "createElement"), me = /* @__PURE__ */ n((e) => lt[e] && M(
  "svg",
  { width: "14", height: "14", viewBox: "0 0 14 14", xmlns: "http://www.w3.org/2000/svg" },
  lt[e].map(
    (t) => M("path", {
      fill: "currentColor",
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: t
    })
  )
), "createIcon"), Lr = /* @__PURE__ */ n((e) => {
  if ("elements" in e) {
    let { elements: o, color: i, style: s } = e;
    return {
      id: void 0,
      priority: 0,
      selectors: o,
      styles: {
        outline: `2px ${s} ${i}`,
        outlineOffset: "2px",
        boxShadow: "0 0 0 6px rgba(255,255,255,0.6)"
      },
      menu: void 0
    };
  }
  let { menu: t, ...r } = e;
  return {
    id: void 0,
    priority: 0,
    styles: {
      outline: "2px dashed #029cfd"
    },
    ...r,
    menu: Array.isArray(t) ? t.every(Array.isArray) ? t : [t] : void 0
  };
}, "normalizeOptions"), un = /* @__PURE__ */ n((e) => e instanceof Function, "isFunction"), de = /* @__PURE__ */ new Map(), X = /* @__PURE__ */ new Map(),
ke = /* @__PURE__ */ new Map(), U = /* @__PURE__ */ n((e) => {
  let t = Symbol();
  return X.set(t, []), de.set(t, e), { get: /* @__PURE__ */ n(() => de.get(t), "get"), set: /* @__PURE__ */ n((a) => {
    let p = de.get(t), c = un(a) ? a(p) : a;
    c !== p && (de.set(t, c), X.get(t)?.forEach((l) => {
      ke.get(l)?.(), ke.set(l, l(c));
    }));
  }, "set"), subscribe: /* @__PURE__ */ n((a) => (X.get(t)?.push(a), () => {
    let p = X.get(t);
    p && X.set(
      t,
      p.filter((c) => c !== a)
    );
  }), "subscribe"), teardown: /* @__PURE__ */ n(() => {
    X.get(t)?.forEach((a) => {
      ke.get(a)?.(), ke.delete(a);
    }), X.delete(t), de.delete(t);
  }, "teardown") };
}, "useStore"), ct = /* @__PURE__ */ n((e) => {
  let t = document.getElementById("storybook-root"), r = /* @__PURE__ */ new Map();
  for (let o of e) {
    let { priority: i = 0 } = o;
    for (let s of o.selectors) {
      let a = [
        ...document.querySelectorAll(
          // Elements matching the selector, excluding storybook elements and their descendants.
          // Necessary to find portaled elements (e.g. children of `body`).
          `:is(${s}):not([id^="storybook-"], [id^="storybook-"] *, [class^="sb-"], [class^="sb-"] *)`
        ),
        // Elements matching the selector inside the storybook root, as these were excluded above.
        ...t?.querySelectorAll(s) || []
      ];
      for (let p of a) {
        let c = r.get(p);
        (!c || c.priority <= i) && r.set(p, {
          ...o,
          priority: i,
          selectors: Array.from(new Set((c?.selectors || []).concat(s)))
        });
      }
    }
  }
  return r;
}, "mapElements"), Dr = /* @__PURE__ */ n((e) => Array.from(e.entries()).map(([t, { selectors: r, styles: o, hoverStyles: i, focusStyles: s,
menu: a }]) => {
  let { top: p, left: c, width: l, height: y } = t.getBoundingClientRect(), { position: u } = getComputedStyle(t);
  return {
    element: t,
    selectors: r,
    styles: o,
    hoverStyles: i,
    focusStyles: s,
    menu: a,
    top: u === "fixed" ? p : p + window.scrollY,
    left: u === "fixed" ? c : c + window.scrollX,
    width: l,
    height: y
  };
}).sort((t, r) => r.width * r.height - t.width * t.height), "mapBoxes"), dt = /* @__PURE__ */ n((e, t) => {
  let r = e.getBoundingClientRect(), { x: o, y: i } = t;
  return r?.top && r?.left && o >= r.left && o <= r.left + r.width && i >= r.top && i <= r.top + r.height;
}, "isOverMenu"), mt = /* @__PURE__ */ n((e, t, r) => {
  if (!t || !r)
    return !1;
  let { left: o, top: i, width: s, height: a } = e;
  a < z && (i = i - Math.round((z - a) / 2), a = z), s < z && (o = o - Math.round((z - s) / 2), s = z), t.style.position === "fixed" && (o +=
  window.scrollX, i += window.scrollY);
  let { x: p, y: c } = r;
  return p >= o && p <= o + s && c >= i && c <= i + a;
}, "isTargeted"), _r = /* @__PURE__ */ n((e, t, r = {}) => {
  let { x: o, y: i } = t, { margin: s = 5, topOffset: a = 0, centered: p = !1 } = r, { scrollX: c, scrollY: l, innerHeight: y, innerWidth: u } = window,
  h = Math.min(
    e.style.position === "fixed" ? i - l : i,
    y - e.clientHeight - s - a + l
  ), T = p ? e.clientWidth / 2 : 0, R = e.style.position === "fixed" ? Math.max(Math.min(o - c, u - T - s), T + s) : Math.max(
    Math.min(o, u - T - s + c),
    T + s + c
  );
  Object.assign(e.style, {
    ...R !== o && { left: `${R}px` },
    ...h !== i && { top: `${h}px` }
  });
}, "keepInViewport"), ut = /* @__PURE__ */ n((e) => {
  window.HTMLElement.prototype.hasOwnProperty("showPopover") && e.showPopover();
}, "showPopover"), Hr = /* @__PURE__ */ n((e) => {
  window.HTMLElement.prototype.hasOwnProperty("showPopover") && e.hidePopover();
}, "hidePopover"), Nr = /* @__PURE__ */ n((e) => ({
  top: e.top,
  left: e.left,
  width: e.width,
  height: e.height,
  selectors: e.selectors,
  element: {
    attributes: Object.fromEntries(
      Array.from(e.element.attributes).map((t) => [t.name, t.value])
    ),
    localName: e.element.localName,
    tagName: e.element.tagName,
    outerHTML: e.element.outerHTML
  }
}), "getEventDetails");

// src/highlight/useHighlights.ts
var C = "storybook-highlights-menu", jr = "storybook-highlights-root", fn = "storybook-root", zr = /* @__PURE__ */ n((e) => {
  if (globalThis.__STORYBOOK_HIGHLIGHT_INITIALIZED)
    return;
  globalThis.__STORYBOOK_HIGHLIGHT_INITIALIZED = !0;
  let { document: t } = globalThis, r = U([]), o = U(/* @__PURE__ */ new Map()), i = U([]), s = U(), a = U(), p = U([]), c = U([]), l = U(),
  y = U(), u = t.getElementById(jr);
  r.subscribe(() => {
    u || (u = M("div", { id: jr }), t.body.appendChild(u));
  }), r.subscribe((d) => {
    let m = t.getElementById(fn);
    if (!m)
      return;
    o.set(ct(d));
    let f = new MutationObserver(() => o.set(ct(d)));
    return f.observe(m, { subtree: !0, childList: !0 }), () => {
      f.disconnect();
    };
  }), o.subscribe((d) => {
    let m = /* @__PURE__ */ n(() => requestAnimationFrame(() => i.set(Dr(d))), "updateBoxes"), f = new ResizeObserver(m);
    f.observe(t.body), Array.from(d.keys()).forEach((g) => f.observe(g));
    let x = Array.from(t.body.querySelectorAll("*")).filter((g) => {
      let { overflow: E, overflowX: I, overflowY: k } = window.getComputedStyle(g);
      return ["auto", "scroll"].some((j) => [E, I, k].includes(j));
    });
    return x.forEach((g) => g.addEventListener("scroll", m)), () => {
      f.disconnect(), x.forEach((g) => g.removeEventListener("scroll", m));
    };
  }), o.subscribe((d) => {
    let m = Array.from(d.keys()).filter(({ style: x }) => x.position === "sticky"), f = /* @__PURE__ */ n(() => requestAnimationFrame(() => {
      i.set(
        (x) => x.map((g) => {
          if (m.includes(g.element)) {
            let { top: E, left: I } = g.element.getBoundingClientRect();
            return { ...g, top: E + window.scrollY, left: I + window.scrollX };
          }
          return g;
        })
      );
    }), "updateBoxes");
    return t.addEventListener("scroll", f), () => t.removeEventListener("scroll", f);
  }), o.subscribe((d) => {
    p.set((m) => m.filter(({ element: f }) => d.has(f)));
  }), p.subscribe((d) => {
    d.length ? (y.set((m) => d.some((f) => f.element === m?.element) ? m : void 0), l.set((m) => d.some((f) => f.element === m?.element) ? m :
    void 0)) : (y.set(void 0), l.set(void 0), s.set(void 0));
  });
  let h = new Map(/* @__PURE__ */ new Map());
  r.subscribe((d) => {
    d.forEach(({ keyframes: m }) => {
      if (m) {
        let f = h.get(m);
        f || (f = t.createElement("style"), f.setAttribute("data-highlight", "keyframes"), h.set(m, f), t.head.appendChild(f)), f.innerHTML =
        m;
      }
    }), h.forEach((m, f) => {
      d.some((x) => x.keyframes === f) || (m.remove(), h.delete(f));
    });
  });
  let T = new Map(/* @__PURE__ */ new Map());
  i.subscribe((d) => {
    d.forEach((m) => {
      let f = T.get(m.element);
      if (u && !f) {
        let x = {
          popover: "manual",
          "data-highlight-dimensions": `w${m.width.toFixed(0)}h${m.height.toFixed(0)}`,
          "data-highlight-coordinates": `x${m.left.toFixed(0)}y${m.top.toFixed(0)}`
        };
        f = u.appendChild(
          M("div", x, [M("div")])
        ), T.set(m.element, f);
      }
    }), T.forEach((m, f) => {
      d.some(({ element: x }) => x === f) || (m.remove(), T.delete(f));
    });
  }), i.subscribe((d) => {
    let m = d.filter((x) => x.menu);
    if (!m.length)
      return;
    let f = /* @__PURE__ */ n((x) => {
      requestAnimationFrame(() => {
        let g = t.getElementById(C), E = { x: x.pageX, y: x.pageY };
        if (g && !dt(g, E)) {
          let I = m.filter((k) => {
            let j = T.get(k.element);
            return mt(k, j, E);
          });
          s.set(I.length ? E : void 0), p.set(I);
        }
      });
    }, "onClick");
    return t.addEventListener("click", f), () => t.removeEventListener("click", f);
  });
  let R = /* @__PURE__ */ n(() => {
    let d = t.getElementById(C), m = a.get();
    !m || d && dt(d, m) || c.set((f) => {
      let x = i.get().filter((k) => {
        let j = T.get(k.element);
        return mt(k, j, m);
      }), g = f.filter((k) => x.includes(k)), E = x.filter((k) => !f.includes(k)), I = f.length - g.length;
      return E.length || I ? [...g, ...E] : f;
    });
  }, "updateHovered");
  a.subscribe(R), i.subscribe(R);
  let P = /* @__PURE__ */ n(() => {
    let d = y.get(), m = d ? [d] : p.get(), f = m.length === 1 ? m[0] : l.get(), x = s.get() !== void 0;
    i.get().forEach((g) => {
      let E = T.get(g.element);
      if (E) {
        let I = f === g, k = x ? f ? I : m.includes(g) : c.get()?.includes(g);
        Object.assign(E.style, {
          animation: "none",
          background: "transparent",
          border: "none",
          boxSizing: "border-box",
          outline: "none",
          outlineOffset: "0px",
          ...g.styles,
          ...k ? g.hoverStyles : {},
          ...I ? g.focusStyles : {},
          position: getComputedStyle(g.element).position === "fixed" ? "fixed" : "absolute",
          zIndex: pt - 10,
          top: `${g.top}px`,
          left: `${g.left}px`,
          width: `${g.width}px`,
          height: `${g.height}px`,
          margin: 0,
          padding: 0,
          cursor: g.menu && k ? "pointer" : "default",
          pointerEvents: g.menu ? "auto" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "visible"
        }), Object.assign(E.children[0].style, {
          width: "100%",
          height: "100%",
          minHeight: `${z}px`,
          minWidth: `${z}px`,
          boxSizing: "content-box",
          padding: E.style.outlineWidth || "0px"
        }), ut(E);
      }
    });
  }, "updateBoxStyles");
  i.subscribe(P), p.subscribe(P), c.subscribe(P), l.subscribe(P), y.subscribe(P);
  let L = /* @__PURE__ */ n(() => {
    if (!u)
      return;
    let d = t.getElementById(C);
    if (d)
      d.innerHTML = "";
    else {
      let g = { id: C, popover: "manual" };
      d = u.appendChild(M("div", g)), u.appendChild(
        M("style", {}, [
          `
            #${C} {
              position: absolute;
              z-index: ${pt};
              width: 300px;
              padding: 0px;
              margin: 15px 0 0 0;
              transform: translateX(-50%);
              font-family: "Nunito Sans", -apple-system, ".SFNSText-Regular", "San Francisco", BlinkMacSystemFont, "Segoe UI", "Helvetica Ne\
ue", Helvetica, Arial, sans-serif;
              font-size: 12px;
              background: white;
              border: none;
              border-radius: 6px;
              box-shadow: 0 2px 5px 0 rgba(0, 0, 0, 0.05), 0 5px 15px 0 rgba(0, 0, 0, 0.1);
              color: #2E3438;
            }
            #${C} ul {
              list-style: none;
              margin: 0;
              padding: 0;
            }
            #${C} > ul {
              max-height: 300px;
              overflow-y: auto;
              padding: 4px 0;
            }
            #${C} li {
              padding: 0 4px;
              margin: 0;
            }
            #${C} li > :not(ul) {
              display: flex;
              padding: 8px;
              margin: 0;
              align-items: center;
              gap: 8px;
              border-radius: 4px;
            }
            #${C} button {
              width: 100%;
              border: 0;
              background: transparent;
              color: inherit;
              text-align: left;
              font-family: inherit;
              font-size: inherit;
            }
            #${C} button:focus-visible {
              outline-color: #029CFD;
            }
            #${C} button:hover {
              background: rgba(2, 156, 253, 0.07);
              color: #029CFD;
              cursor: pointer;
            }
            #${C} li code {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 16px;
              font-size: 11px;
            }
            #${C} li svg {
              flex-shrink: 0;
              margin: 1px;
              color: #73828C;
            }
            #${C} li > button:hover svg, #${C} li > button:focus-visible svg {
              color: #029CFD;
            }
            #${C} .element-list li svg {
              display: none;
            }
            #${C} li.selectable svg, #${C} li.selected svg {
              display: block;
            }
            #${C} .menu-list {
              border-top: 1px solid rgba(38, 85, 115, 0.15);
            }
            #${C} .menu-list > li:not(:last-child) {
              padding-bottom: 4px;
              margin-bottom: 4px;
              border-bottom: 1px solid rgba(38, 85, 115, 0.15);
            }
            #${C} .menu-items, #${C} .menu-items li {
              padding: 0;
            }
            #${C} .menu-item {
              display: flex;
            }
            #${C} .menu-item-content {
              display: flex;
              flex-direction: column;
              flex-grow: 1;
            }
          `
        ])
      );
    }
    let m = y.get(), f = m ? [m] : p.get();
    if (f.length && (d.style.position = getComputedStyle(f[0].element).position === "fixed" ? "fixed" : "absolute", d.appendChild(
      M(
        "ul",
        { class: "element-list" },
        f.map((g) => {
          let E = f.length > 1 && !!g.menu?.some(
            (j) => j.some(
              (Z) => !Z.selectors || Z.selectors.some((ge) => g.selectors.includes(ge))
            )
          ), I = E ? {
            class: "selectable",
            onClick: /* @__PURE__ */ n(() => y.set(g), "onClick"),
            onMouseEnter: /* @__PURE__ */ n(() => l.set(g), "onMouseEnter"),
            onMouseLeave: /* @__PURE__ */ n(() => l.set(void 0), "onMouseLeave")
          } : m ? { class: "selected", onClick: /* @__PURE__ */ n(() => y.set(void 0), "onClick") } : {}, k = E || m;
          return M("li", I, [
            M(k ? "button" : "div", k ? { type: "button" } : {}, [
              m ? me("chevronLeft") : null,
              M("code", {}, [g.element.outerHTML]),
              E ? me("chevronRight") : null
            ])
          ]);
        })
      )
    )), y.get() || p.get().length === 1) {
      let g = y.get() || p.get()[0], E = g.menu?.filter(
        (I) => I.some(
          (k) => !k.selectors || k.selectors.some((j) => g.selectors.includes(j))
        )
      );
      E?.length && d.appendChild(
        M(
          "ul",
          { class: "menu-list" },
          E.map(
            (I) => M("li", {}, [
              M(
                "ul",
                { class: "menu-items" },
                I.map(
                  ({ id: k, title: j, description: Z, iconLeft: ge, iconRight: vt, clickEvent: kt }) => {
                    let Ie = kt && (() => e.emit(kt, k, Nr(g)));
                    return M("li", {}, [
                      M(
                        Ie ? "button" : "div",
                        Ie ? { class: "menu-item", type: "button", onClick: Ie } : { class: "menu-item" },
                        [
                          ge ? me(ge) : null,
                          M("div", { class: "menu-item-content" }, [
                            M(Z ? "strong" : "span", {}, [j]),
                            Z && M("span", {}, [Z])
                          ]),
                          vt ? me(vt) : null
                        ]
                      )
                    ]);
                  }
                )
              )
            ])
          )
        )
      );
    }
    let x = s.get();
    x ? (Object.assign(d.style, {
      display: "block",
      left: `${d.style.position === "fixed" ? x.x - window.scrollX : x.x}px`,
      top: `${d.style.position === "fixed" ? x.y - window.scrollY : x.y}px`
    }), ut(d), requestAnimationFrame(() => _r(d, x, { topOffset: 15, centered: !0 }))) : (Hr(d), Object.assign(d.style, { display: "none" }));
  }, "renderMenu");
  p.subscribe(L), y.subscribe(L);
  let O = /* @__PURE__ */ n((d) => {
    let m = Lr(d);
    r.set((f) => {
      let x = m.id ? f.filter((g) => g.id !== m.id) : f;
      return m.selectors?.length ? [...x, m] : x;
    });
  }, "addHighlight"), F = /* @__PURE__ */ n((d) => {
    d && r.set((m) => m.filter((f) => f.id !== d));
  }, "removeHighlight"), A = /* @__PURE__ */ n(() => {
    r.set([]), o.set(/* @__PURE__ */ new Map()), i.set([]), s.set(void 0), a.set(void 0), p.set([]), c.set([]), l.set(void 0), y.set(void 0);
  }, "resetState"), S, v = /* @__PURE__ */ n((d, m) => {
    let f = "scrollIntoView-highlight";
    clearTimeout(S), F(f);
    let x = t.querySelector(d);
    if (!x) {
      console.warn(`Cannot scroll into view: ${d} not found`);
      return;
    }
    x.scrollIntoView({ behavior: "smooth", block: "center", ...m });
    let g = `kf-${Math.random().toString(36).substring(2, 15)}`;
    r.set((E) => [
      ...E,
      {
        id: f,
        priority: 1e3,
        selectors: [d],
        styles: {
          outline: "2px solid #1EA7FD",
          outlineOffset: "-1px",
          animation: `${g} 3s linear forwards`
        },
        keyframes: `@keyframes ${g} {
          0% { outline: 2px solid #1EA7FD; }
          20% { outline: 2px solid #1EA7FD00; }
          40% { outline: 2px solid #1EA7FD; }
          60% { outline: 2px solid #1EA7FD00; }
          80% { outline: 2px solid #1EA7FD; }
          100% { outline: 2px solid #1EA7FD00; }
        }`
      }
    ]), S = setTimeout(() => F(f), 3500);
  }, "scrollIntoView"), w = /* @__PURE__ */ n((d) => {
    requestAnimationFrame(() => a.set({ x: d.pageX, y: d.pageY }));
  }, "onMouseMove");
  t.body.addEventListener("mousemove", w), e.on(Mr, O), e.on($r, F), e.on(Fr, A), e.on(Ir, v), e.on(Br.STORY_RENDER_PHASE_CHANGED, ({ newPhase: d }) => {
    d === "loading" && A();
  });
}, "useHighlights");

// src/highlight/preview.ts
globalThis?.FEATURES?.highlight && ft.addons?.ready && ft.addons.ready().then(zr);
var yt = /* @__PURE__ */ n(() => (0, Ur.definePreviewAddon)({}), "default");

// src/measure/preview.ts
var po = require("storybook/internal/csf");

// src/measure/constants.ts
var Pe = "storybook/measure-addon", ip = `${Pe}/tool`, Gr = "measureEnabled", sp = {
  RESULT: `${Pe}/result`,
  REQUEST: `${Pe}/request`,
  CLEAR: `${Pe}/clear`
};

// src/measure/withMeasure.ts
var xt = require("storybook/preview-api");

// src/measure/box-model/canvas.ts
var ue = require("@storybook/global");
function Wr() {
  let e = ue.global.document.documentElement, t = Math.max(e.scrollHeight, e.offsetHeight);
  return { width: Math.max(e.scrollWidth, e.offsetWidth), height: t };
}
n(Wr, "getDocumentWidthAndHeight");
function yn() {
  let e = ue.global.document.createElement("canvas");
  e.id = "storybook-addon-measure";
  let t = e.getContext("2d");
  Ce(t != null);
  let { width: r, height: o } = Wr();
  return gt(e, t, { width: r, height: o }), e.style.position = "absolute", e.style.left = "0", e.style.top = "0", e.style.zIndex = "21474836\
47", e.style.pointerEvents = "none", ue.global.document.body.appendChild(e), { canvas: e, context: t, width: r, height: o };
}
n(yn, "createCanvas");
function gt(e, t, { width: r, height: o }) {
  e.style.width = `${r}px`, e.style.height = `${o}px`;
  let i = ue.global.window.devicePixelRatio;
  e.width = Math.floor(r * i), e.height = Math.floor(o * i), t.scale(i, i);
}
n(gt, "setCanvasWidthAndHeight");
var $ = {};
function Yr() {
  $.canvas || ($ = yn());
}
n(Yr, "init");
function Vr() {
  $.context && $.context.clearRect(0, 0, $.width ?? 0, $.height ?? 0);
}
n(Vr, "clear");
function Kr(e) {
  Vr(), e($.context);
}
n(Kr, "draw");
function qr() {
  Ce($.canvas, "Canvas should exist in the state."), Ce($.context, "Context should exist in the state."), gt($.canvas, $.context, { width: 0,
  height: 0 });
  let { width: e, height: t } = Wr();
  gt($.canvas, $.context, { width: e, height: t }), $.width = e, $.height = t;
}
n(qr, "rescale");
function Xr() {
  $.canvas && (Vr(), $.canvas.parentNode?.removeChild($.canvas), $ = {});
}
n(Xr, "destroy");

// src/measure/box-model/visualizer.ts
var N = require("@storybook/global");

// src/measure/box-model/labels.ts
var te = {
  margin: "#f6b26b",
  border: "#ffe599",
  padding: "#93c47d",
  content: "#6fa8dc",
  text: "#232020"
}, W = 6;
function Zr(e, { x: t, y: r, w: o, h: i, r: s }) {
  t = t - o / 2, r = r - i / 2, o < 2 * s && (s = o / 2), i < 2 * s && (s = i / 2), e.beginPath(), e.moveTo(t + s, r), e.arcTo(t + o, r, t +
  o, r + i, s), e.arcTo(t + o, r + i, t, r + i, s), e.arcTo(t, r + i, t, r, s), e.arcTo(t, r, t + o, r, s), e.closePath();
}
n(Zr, "roundedRect");
function gn(e, { padding: t, border: r, width: o, height: i, top: s, left: a }) {
  let p = o - r.left - r.right - t.left - t.right, c = i - t.top - t.bottom - r.top - r.bottom, l = a + r.left + t.left, y = s + r.top + t.top;
  return e === "top" ? l += p / 2 : e === "right" ? (l += p, y += c / 2) : e === "bottom" ? (l += p / 2, y += c) : e === "left" ? y += c / 2 :
  e === "center" && (l += p / 2, y += c / 2), { x: l, y };
}
n(gn, "positionCoordinate");
function hn(e, t, { margin: r, border: o, padding: i }, s, a) {
  let p = /* @__PURE__ */ n((h) => 0, "shift"), c = 0, l = 0, y = a ? 1 : 0.5, u = a ? s * 2 : 0;
  return e === "padding" ? p = /* @__PURE__ */ n((h) => i[h] * y + u, "shift") : e === "border" ? p = /* @__PURE__ */ n((h) => i[h] + o[h] *
  y + u, "shift") : e === "margin" && (p = /* @__PURE__ */ n((h) => i[h] + o[h] + r[h] * y + u, "shift")), t === "top" ? l = -p("top") : t ===
  "right" ? c = p("right") : t === "bottom" ? l = p("bottom") : t === "left" && (c = -p("left")), { offsetX: c, offsetY: l };
}
n(hn, "offset");
function xn(e, t) {
  return Math.abs(e.x - t.x) < Math.abs(e.w + t.w) / 2 && Math.abs(e.y - t.y) < Math.abs(e.h + t.h) / 2;
}
n(xn, "collide");
function bn(e, t, r) {
  return e === "top" ? t.y = r.y - r.h - W : e === "right" ? t.x = r.x + r.w / 2 + W + t.w / 2 : e === "bottom" ? t.y = r.y + r.h + W : e ===
  "left" && (t.x = r.x - r.w / 2 - W - t.w / 2), { x: t.x, y: t.y };
}
n(bn, "overlapAdjustment");
function Jr(e, t, { x: r, y: o, w: i, h: s }, a) {
  return Zr(e, { x: r, y: o, w: i, h: s, r: 3 }), e.fillStyle = `${te[t]}dd`, e.fill(), e.strokeStyle = te[t], e.stroke(), e.fillStyle = te.
  text, e.fillText(a, r, o), Zr(e, { x: r, y: o, w: i, h: s, r: 3 }), e.fillStyle = `${te[t]}dd`, e.fill(), e.strokeStyle = te[t], e.stroke(),
  e.fillStyle = te.text, e.fillText(a, r, o), { x: r, y: o, w: i, h: s };
}
n(Jr, "textWithRect");
function Qr(e, t) {
  e.font = "600 12px monospace", e.textBaseline = "middle", e.textAlign = "center";
  let r = e.measureText(t), o = r.actualBoundingBoxAscent + r.actualBoundingBoxDescent, i = r.width + W * 2, s = o + W * 2;
  return { w: i, h: s };
}
n(Qr, "configureText");
function Tn(e, t, { type: r, position: o = "center", text: i }, s, a = !1) {
  let { x: p, y: c } = gn(o, t), { offsetX: l, offsetY: y } = hn(r, o, t, W + 1, a);
  p += l, c += y;
  let { w: u, h } = Qr(e, i);
  if (s && xn({ x: p, y: c, w: u, h }, s)) {
    let T = bn(o, { x: p, y: c, w: u, h }, s);
    p = T.x, c = T.y;
  }
  return Jr(e, r, { x: p, y: c, w: u, h }, i);
}
n(Tn, "drawLabel");
function Sn(e, { w: t, h: r }) {
  let o = t * 0.5 + W, i = r * 0.5 + W;
  return {
    offsetX: (e.x === "left" ? -1 : 1) * o,
    offsetY: (e.y === "top" ? -1 : 1) * i
  };
}
n(Sn, "floatingOffset");
function An(e, t, { type: r, text: o }) {
  let { floatingAlignment: i, extremities: s } = t, a = s[i.x], p = s[i.y], { w: c, h: l } = Qr(e, o), { offsetX: y, offsetY: u } = Sn(i, {
    w: c,
    h: l
  });
  return a += y, p += u, Jr(e, r, { x: a, y: p, w: c, h: l }, o);
}
n(An, "drawFloatingLabel");
function fe(e, t, r, o) {
  let i = [];
  r.forEach((s, a) => {
    let p = o && s.position === "center" ? An(e, t, s) : Tn(e, t, s, i[a - 1], o);
    i[a] = p;
  });
}
n(fe, "drawStack");
function eo(e, t, r, o) {
  let i = r.reduce((s, a) => (Object.prototype.hasOwnProperty.call(s, a.position) || (s[a.position] = []), s[a.position]?.push(a), s), {});
  i.top && fe(e, t, i.top, o), i.right && fe(e, t, i.right, o), i.bottom && fe(e, t, i.bottom, o), i.left && fe(e, t, i.left, o), i.center &&
  fe(e, t, i.center, o);
}
n(eo, "labelStacks");

// src/measure/box-model/visualizer.ts
var Oe = {
  margin: "#f6b26ba8",
  border: "#ffe599a8",
  padding: "#93c47d8c",
  content: "#6fa8dca8"
}, to = 30;
function H(e) {
  return parseInt(e.replace("px", ""), 10);
}
n(H, "pxToNumber");
function re(e) {
  return Number.isInteger(e) ? e : e.toFixed(2);
}
n(re, "round");
function ht(e) {
  return e.filter((t) => t.text !== 0 && t.text !== "0");
}
n(ht, "filterZeroValues");
function Rn(e) {
  let t = {
    top: N.global.window.scrollY,
    bottom: N.global.window.scrollY + N.global.window.innerHeight,
    left: N.global.window.scrollX,
    right: N.global.window.scrollX + N.global.window.innerWidth
  }, r = {
    top: Math.abs(t.top - e.top),
    bottom: Math.abs(t.bottom - e.bottom),
    left: Math.abs(t.left - e.left),
    right: Math.abs(t.right - e.right)
  };
  return {
    x: r.left > r.right ? "left" : "right",
    y: r.top > r.bottom ? "top" : "bottom"
  };
}
n(Rn, "floatingAlignment");
function wn(e) {
  let t = N.global.getComputedStyle(e), { top: r, left: o, right: i, bottom: s, width: a, height: p } = e.getBoundingClientRect(), {
    marginTop: c,
    marginBottom: l,
    marginLeft: y,
    marginRight: u,
    paddingTop: h,
    paddingBottom: T,
    paddingLeft: R,
    paddingRight: P,
    borderBottomWidth: L,
    borderTopWidth: O,
    borderLeftWidth: F,
    borderRightWidth: A
  } = t;
  r = r + N.global.window.scrollY, o = o + N.global.window.scrollX, s = s + N.global.window.scrollY, i = i + N.global.window.scrollX;
  let S = {
    top: H(c),
    bottom: H(l),
    left: H(y),
    right: H(u)
  }, v = {
    top: H(h),
    bottom: H(T),
    left: H(R),
    right: H(P)
  }, w = {
    top: H(O),
    bottom: H(L),
    left: H(F),
    right: H(A)
  }, d = {
    top: r - S.top,
    bottom: s + S.bottom,
    left: o - S.left,
    right: i + S.right
  };
  return {
    margin: S,
    padding: v,
    border: w,
    top: r,
    left: o,
    bottom: s,
    right: i,
    width: a,
    height: p,
    extremities: d,
    floatingAlignment: Rn(d)
  };
}
n(wn, "measureElement");
function En(e, { margin: t, width: r, height: o, top: i, left: s, bottom: a, right: p }) {
  let c = o + t.bottom + t.top;
  e.fillStyle = Oe.margin, e.fillRect(s, i - t.top, r, t.top), e.fillRect(p, i - t.top, t.right, c), e.fillRect(s, a, r, t.bottom), e.fillRect(
  s - t.left, i - t.top, t.left, c);
  let l = [
    {
      type: "margin",
      text: re(t.top),
      position: "top"
    },
    {
      type: "margin",
      text: re(t.right),
      position: "right"
    },
    {
      type: "margin",
      text: re(t.bottom),
      position: "bottom"
    },
    {
      type: "margin",
      text: re(t.left),
      position: "left"
    }
  ];
  return ht(l);
}
n(En, "drawMargin");
function Cn(e, { padding: t, border: r, width: o, height: i, top: s, left: a, bottom: p, right: c }) {
  let l = o - r.left - r.right, y = i - t.top - t.bottom - r.top - r.bottom;
  e.fillStyle = Oe.padding, e.fillRect(a + r.left, s + r.top, l, t.top), e.fillRect(
    c - t.right - r.right,
    s + t.top + r.top,
    t.right,
    y
  ), e.fillRect(
    a + r.left,
    p - t.bottom - r.bottom,
    l,
    t.bottom
  ), e.fillRect(a + r.left, s + t.top + r.top, t.left, y);
  let u = [
    {
      type: "padding",
      text: t.top,
      position: "top"
    },
    {
      type: "padding",
      text: t.right,
      position: "right"
    },
    {
      type: "padding",
      text: t.bottom,
      position: "bottom"
    },
    {
      type: "padding",
      text: t.left,
      position: "left"
    }
  ];
  return ht(u);
}
n(Cn, "drawPadding");
function vn(e, { border: t, width: r, height: o, top: i, left: s, bottom: a, right: p }) {
  let c = o - t.top - t.bottom;
  e.fillStyle = Oe.border, e.fillRect(s, i, r, t.top), e.fillRect(s, a - t.bottom, r, t.bottom), e.fillRect(s, i + t.top, t.left, c), e.fillRect(
  p - t.right, i + t.top, t.right, c);
  let l = [
    {
      type: "border",
      text: t.top,
      position: "top"
    },
    {
      type: "border",
      text: t.right,
      position: "right"
    },
    {
      type: "border",
      text: t.bottom,
      position: "bottom"
    },
    {
      type: "border",
      text: t.left,
      position: "left"
    }
  ];
  return ht(l);
}
n(vn, "drawBorder");
function kn(e, { padding: t, border: r, width: o, height: i, top: s, left: a }) {
  let p = o - r.left - r.right - t.left - t.right, c = i - t.top - t.bottom - r.top - r.bottom;
  return e.fillStyle = Oe.content, e.fillRect(
    a + r.left + t.left,
    s + r.top + t.top,
    p,
    c
  ), [
    {
      type: "content",
      position: "center",
      text: `${re(p)} x ${re(c)}`
    }
  ];
}
n(kn, "drawContent");
function Pn(e) {
  return (t) => {
    if (e && t) {
      let r = wn(e), o = En(t, r), i = Cn(t, r), s = vn(t, r), a = kn(t, r), p = r.width <= to * 3 || r.height <= to;
      eo(
        t,
        r,
        [...a, ...i, ...s, ...o],
        p
      );
    }
  };
}
n(Pn, "drawBoxModel");
function ro(e) {
  Kr(Pn(e));
}
n(ro, "drawSelectedElement");

// src/measure/util.ts
var oo = require("@storybook/global");
var no = /* @__PURE__ */ n((e, t) => {
  let r = oo.global.document.elementFromPoint(e, t), o = /* @__PURE__ */ n((s) => {
    if (s && s.shadowRoot) {
      let a = s.shadowRoot.elementFromPoint(e, t);
      return s.isEqualNode(a) ? s : a.shadowRoot ? o(a) : a;
    }
    return s;
  }, "crawlShadows");
  return o(r) || r;
}, "deepElementFromPoint");

// src/measure/withMeasure.ts
var io, Me = { x: 0, y: 0 };
function so(e, t) {
  io = no(e, t), ro(io);
}
n(so, "findAndDrawElement");
var ao = /* @__PURE__ */ n((e, t) => {
  let { measureEnabled: r } = t.globals || {};
  return (0, xt.useEffect)(() => {
    if (typeof globalThis.document > "u")
      return;
    let o = /* @__PURE__ */ n((i) => {
      window.requestAnimationFrame(() => {
        i.stopPropagation(), Me.x = i.clientX, Me.y = i.clientY;
      });
    }, "onPointerMove");
    return globalThis.document.addEventListener("pointermove", o), () => {
      globalThis.document.removeEventListener("pointermove", o);
    };
  }, []), (0, xt.useEffect)(() => {
    let o = /* @__PURE__ */ n((s) => {
      window.requestAnimationFrame(() => {
        s.stopPropagation(), so(s.clientX, s.clientY);
      });
    }, "onPointerOver"), i = /* @__PURE__ */ n(() => {
      window.requestAnimationFrame(() => {
        qr();
      });
    }, "onResize");
    return t.viewMode === "story" && r && (globalThis.document.addEventListener("pointerover", o), Yr(), globalThis.window.addEventListener(
    "resize", i), so(Me.x, Me.y)), () => {
      globalThis.window.removeEventListener("resize", i), Xr();
    };
  }, [r, t.viewMode]), e();
}, "withMeasure");

// src/measure/preview.ts
var On = globalThis.FEATURES?.measure ? [ao] : [], Mn = {
  [Gr]: !1
}, bt = /* @__PURE__ */ n(() => (0, po.definePreviewAddon)({
  decorators: On,
  initialGlobals: Mn
}), "default");

// src/outline/preview.ts
var uo = require("storybook/internal/csf");

// src/outline/constants.ts
var $e = "outline";

// src/outline/withOutline.ts
var Fe = require("storybook/preview-api");

// src/outline/helpers.ts
var ye = require("@storybook/global");
var Tt = /* @__PURE__ */ n((e) => {
  (Array.isArray(e) ? e : [e]).forEach($n);
}, "clearStyles"), $n = /* @__PURE__ */ n((e) => {
  let t = typeof e == "string" ? e : e.join(""), r = ye.global.document.getElementById(t);
  r && r.parentElement && r.parentElement.removeChild(r);
}, "clearStyle"), lo = /* @__PURE__ */ n((e, t) => {
  let r = ye.global.document.getElementById(e);
  if (r)
    r.innerHTML !== t && (r.innerHTML = t);
  else {
    let o = ye.global.document.createElement("style");
    o.setAttribute("id", e), o.innerHTML = t, ye.global.document.head.appendChild(o);
  }
}, "addOutlineStyles");

// src/outline/outlineCSS.ts
var co = J(Q(), 1);
function St(e) {
  return co.dedent`
    ${e} body {
      outline: 1px solid #2980b9 !important;
    }

    ${e} article {
      outline: 1px solid #3498db !important;
    }

    ${e} nav {
      outline: 1px solid #0088c3 !important;
    }

    ${e} aside {
      outline: 1px solid #33a0ce !important;
    }

    ${e} section {
      outline: 1px solid #66b8da !important;
    }

    ${e} header {
      outline: 1px solid #99cfe7 !important;
    }

    ${e} footer {
      outline: 1px solid #cce7f3 !important;
    }

    ${e} h1 {
      outline: 1px solid #162544 !important;
    }

    ${e} h2 {
      outline: 1px solid #314e6e !important;
    }

    ${e} h3 {
      outline: 1px solid #3e5e85 !important;
    }

    ${e} h4 {
      outline: 1px solid #449baf !important;
    }

    ${e} h5 {
      outline: 1px solid #c7d1cb !important;
    }

    ${e} h6 {
      outline: 1px solid #4371d0 !important;
    }

    ${e} main {
      outline: 1px solid #2f4f90 !important;
    }

    ${e} address {
      outline: 1px solid #1a2c51 !important;
    }

    ${e} div {
      outline: 1px solid #036cdb !important;
    }

    ${e} p {
      outline: 1px solid #ac050b !important;
    }

    ${e} hr {
      outline: 1px solid #ff063f !important;
    }

    ${e} pre {
      outline: 1px solid #850440 !important;
    }

    ${e} blockquote {
      outline: 1px solid #f1b8e7 !important;
    }

    ${e} ol {
      outline: 1px solid #ff050c !important;
    }

    ${e} ul {
      outline: 1px solid #d90416 !important;
    }

    ${e} li {
      outline: 1px solid #d90416 !important;
    }

    ${e} dl {
      outline: 1px solid #fd3427 !important;
    }

    ${e} dt {
      outline: 1px solid #ff0043 !important;
    }

    ${e} dd {
      outline: 1px solid #e80174 !important;
    }

    ${e} figure {
      outline: 1px solid #ff00bb !important;
    }

    ${e} figcaption {
      outline: 1px solid #bf0032 !important;
    }

    ${e} table {
      outline: 1px solid #00cc99 !important;
    }

    ${e} caption {
      outline: 1px solid #37ffc4 !important;
    }

    ${e} thead {
      outline: 1px solid #98daca !important;
    }

    ${e} tbody {
      outline: 1px solid #64a7a0 !important;
    }

    ${e} tfoot {
      outline: 1px solid #22746b !important;
    }

    ${e} tr {
      outline: 1px solid #86c0b2 !important;
    }

    ${e} th {
      outline: 1px solid #a1e7d6 !important;
    }

    ${e} td {
      outline: 1px solid #3f5a54 !important;
    }

    ${e} col {
      outline: 1px solid #6c9a8f !important;
    }

    ${e} colgroup {
      outline: 1px solid #6c9a9d !important;
    }

    ${e} button {
      outline: 1px solid #da8301 !important;
    }

    ${e} datalist {
      outline: 1px solid #c06000 !important;
    }

    ${e} fieldset {
      outline: 1px solid #d95100 !important;
    }

    ${e} form {
      outline: 1px solid #d23600 !important;
    }

    ${e} input {
      outline: 1px solid #fca600 !important;
    }

    ${e} keygen {
      outline: 1px solid #b31e00 !important;
    }

    ${e} label {
      outline: 1px solid #ee8900 !important;
    }

    ${e} legend {
      outline: 1px solid #de6d00 !important;
    }

    ${e} meter {
      outline: 1px solid #e8630c !important;
    }

    ${e} optgroup {
      outline: 1px solid #b33600 !important;
    }

    ${e} option {
      outline: 1px solid #ff8a00 !important;
    }

    ${e} output {
      outline: 1px solid #ff9619 !important;
    }

    ${e} progress {
      outline: 1px solid #e57c00 !important;
    }

    ${e} select {
      outline: 1px solid #e26e0f !important;
    }

    ${e} textarea {
      outline: 1px solid #cc5400 !important;
    }

    ${e} details {
      outline: 1px solid #33848f !important;
    }

    ${e} summary {
      outline: 1px solid #60a1a6 !important;
    }

    ${e} command {
      outline: 1px solid #438da1 !important;
    }

    ${e} menu {
      outline: 1px solid #449da6 !important;
    }

    ${e} del {
      outline: 1px solid #bf0000 !important;
    }

    ${e} ins {
      outline: 1px solid #400000 !important;
    }

    ${e} img {
      outline: 1px solid #22746b !important;
    }

    ${e} iframe {
      outline: 1px solid #64a7a0 !important;
    }

    ${e} embed {
      outline: 1px solid #98daca !important;
    }

    ${e} object {
      outline: 1px solid #00cc99 !important;
    }

    ${e} param {
      outline: 1px solid #37ffc4 !important;
    }

    ${e} video {
      outline: 1px solid #6ee866 !important;
    }

    ${e} audio {
      outline: 1px solid #027353 !important;
    }

    ${e} source {
      outline: 1px solid #012426 !important;
    }

    ${e} canvas {
      outline: 1px solid #a2f570 !important;
    }

    ${e} track {
      outline: 1px solid #59a600 !important;
    }

    ${e} map {
      outline: 1px solid #7be500 !important;
    }

    ${e} area {
      outline: 1px solid #305900 !important;
    }

    ${e} a {
      outline: 1px solid #ff62ab !important;
    }

    ${e} em {
      outline: 1px solid #800b41 !important;
    }

    ${e} strong {
      outline: 1px solid #ff1583 !important;
    }

    ${e} i {
      outline: 1px solid #803156 !important;
    }

    ${e} b {
      outline: 1px solid #cc1169 !important;
    }

    ${e} u {
      outline: 1px solid #ff0430 !important;
    }

    ${e} s {
      outline: 1px solid #f805e3 !important;
    }

    ${e} small {
      outline: 1px solid #d107b2 !important;
    }

    ${e} abbr {
      outline: 1px solid #4a0263 !important;
    }

    ${e} q {
      outline: 1px solid #240018 !important;
    }

    ${e} cite {
      outline: 1px solid #64003c !important;
    }

    ${e} dfn {
      outline: 1px solid #b4005a !important;
    }

    ${e} sub {
      outline: 1px solid #dba0c8 !important;
    }

    ${e} sup {
      outline: 1px solid #cc0256 !important;
    }

    ${e} time {
      outline: 1px solid #d6606d !important;
    }

    ${e} code {
      outline: 1px solid #e04251 !important;
    }

    ${e} kbd {
      outline: 1px solid #5e001f !important;
    }

    ${e} samp {
      outline: 1px solid #9c0033 !important;
    }

    ${e} var {
      outline: 1px solid #d90047 !important;
    }

    ${e} mark {
      outline: 1px solid #ff0053 !important;
    }

    ${e} bdi {
      outline: 1px solid #bf3668 !important;
    }

    ${e} bdo {
      outline: 1px solid #6f1400 !important;
    }

    ${e} ruby {
      outline: 1px solid #ff7b93 !important;
    }

    ${e} rt {
      outline: 1px solid #ff2f54 !important;
    }

    ${e} rp {
      outline: 1px solid #803e49 !important;
    }

    ${e} span {
      outline: 1px solid #cc2643 !important;
    }

    ${e} br {
      outline: 1px solid #db687d !important;
    }

    ${e} wbr {
      outline: 1px solid #db175b !important;
    }`;
}
n(St, "outlineCSS");

// src/outline/withOutline.ts
var mo = /* @__PURE__ */ n((e, t) => {
  let r = t.globals || {}, o = [!0, "true"].includes(r[$e]), i = t.viewMode === "docs", s = (0, Fe.useMemo)(() => St(i ? '[data-story-block=\
"true"]' : ".sb-show-main"), [t]);
  return (0, Fe.useEffect)(() => {
    let a = i ? `addon-outline-docs-${t.id}` : "addon-outline";
    return o ? lo(a, s) : Tt(a), () => {
      Tt(a);
    };
  }, [o, s, t]), e();
}, "withOutline");

// src/outline/preview.ts
var Fn = globalThis.FEATURES?.outline ? [mo] : [], In = {
  [$e]: !1
}, At = /* @__PURE__ */ n(() => (0, uo.definePreviewAddon)({ decorators: Fn, initialGlobals: In }), "default");

// src/test/preview.ts
var yo = require("storybook/internal/csf"), go = require("storybook/internal/instrumenter"), _ = require("storybook/test");
var Ln = /* @__PURE__ */ n(({ parameters: e }) => {
  e?.test?.mockReset === !0 ? (0, _.resetAllMocks)() : e?.test?.clearMocks === !0 ? (0, _.clearAllMocks)() : e?.test?.restoreMocks !== !1 &&
  (0, _.restoreAllMocks)();
}, "resetAllMocksLoader"), Rt = /* @__PURE__ */ n((e, t = 0, r) => {
  if (t > 5 || e == null)
    return e;
  if ((0, _.isMockFunction)(e))
    return r && e.mockName(r), e;
  if (typeof e == "function" && "isAction" in e && e.isAction && !("implicit" in e && e.implicit)) {
    let o = (0, _.fn)(e);
    return r && o.mockName(r), o;
  }
  if (Array.isArray(e)) {
    t++;
    for (let o = 0; o < e.length; o++)
      Object.getOwnPropertyDescriptor(e, o)?.writable && (e[o] = Rt(e[o], t));
    return e;
  }
  if (typeof e == "object" && e.constructor === Object) {
    t++;
    for (let [o, i] of Object.entries(e))
      Object.getOwnPropertyDescriptor(e, o)?.writable && (e[o] = Rt(i, t, o));
    return e;
  }
  return e;
}, "traverseArgs"), Dn = /* @__PURE__ */ n(({ initialArgs: e }) => {
  Rt(e);
}, "nameSpiesAndWrapActionsInSpies"), fo = !1, _n = /* @__PURE__ */ n(async (e) => {
  globalThis.HTMLElement && e.canvasElement instanceof globalThis.HTMLElement && (e.canvas = (0, _.within)(e.canvasElement));
  let t = globalThis.window?.navigator?.clipboard;
  if (t) {
    e.userEvent = (0, go.instrument)(
      { userEvent: _.uninstrumentedUserEvent.setup() },
      {
        intercept: !0,
        getKeys: /* @__PURE__ */ n((o) => Object.keys(o).filter((i) => i !== "eventWrapper"), "getKeys")
      }
    ).userEvent, Object.defineProperty(globalThis.window.navigator, "clipboard", {
      get: /* @__PURE__ */ n(() => t, "get"),
      configurable: !0
    });
    let r = HTMLElement.prototype.focus;
    fo || Object.defineProperties(HTMLElement.prototype, {
      focus: {
        configurable: !0,
        set: /* @__PURE__ */ n((o) => {
          r = o, fo = !0;
        }, "set"),
        get: /* @__PURE__ */ n(() => r, "get")
      }
    });
  }
}, "enhanceContext"), wt = /* @__PURE__ */ n(() => (0, yo.definePreviewAddon)({
  loaders: [Ln, Dn, _n]
}), "default");

// src/viewport/preview.ts
var bo = require("storybook/internal/csf");

// src/viewport/constants.ts
var ho = "storybook/viewport", xo = "viewport", Gp = `${ho}/panel`, Wp = `${ho}/tool`;

// src/viewport/preview.ts
var Hn = {
  [xo]: { value: void 0, isRotated: !1 }
}, Et = /* @__PURE__ */ n(() => (0, bo.definePreviewAddon)({
  initialGlobals: Hn
}), "default");

// src/csf/core-annotations.ts
function Ct() {
  return [
    // @ts-expect-error CJS fallback
    (bt.default ?? bt)(),
    // @ts-expect-error CJS fallback
    (st.default ?? st)(),
    // @ts-expect-error CJS fallback
    (yt.default ?? yt)(),
    // @ts-expect-error CJS fallback
    (At.default ?? At)(),
    // @ts-expect-error CJS fallback
    (Et.default ?? Et)(),
    // @ts-expect-error CJS fallback
    (ot.default ?? ot)(),
    // @ts-expect-error CJS fallback
    (at.default ?? at)(),
    // @ts-expect-error CJS fallback
    (wt.default ?? wt)()
  ];
}
n(Ct, "getCoreAnnotations");

// src/csf/csf-factories.ts
function Nn(e) {
  let t, r = {
    _tag: "Preview",
    input: e,
    get composed() {
      if (t)
        return t;
      let { addons: o, ...i } = e;
      return t = se(
        le([...Ct(), ...o ?? [], i])
      ), t;
    },
    meta(o) {
      return Un(o, this);
    }
  };
  return globalThis.globalProjectAnnotations = r.composed, r;
}
n(Nn, "definePreview");
function jn(e) {
  return e;
}
n(jn, "definePreviewAddon");
function Bn(e) {
  return e != null && typeof e == "object" && "_tag" in e && e?._tag === "Preview";
}
n(Bn, "isPreview");
function zn(e) {
  return e != null && typeof e == "object" && "_tag" in e && e?._tag === "Meta";
}
n(zn, "isMeta");
function Un(e, t) {
  return {
    _tag: "Meta",
    input: e,
    preview: t,
    get composed() {
      throw new Error("Not implemented");
    },
    // @ts-expect-error hard
    story(r = {}) {
      return So(typeof r == "function" ? { render: r } : r, this);
    }
  };
}
n(Un, "defineMeta");
function Gn(e) {
  return e != null && typeof e == "object" && "_tag" in e && e?._tag === "Story";
}
n(Gn, "isStory");
function So(e, t) {
  let r, o = /* @__PURE__ */ n(() => (r || (r = Ze(
    e,
    t.input,
    void 0,
    t.preview.composed
  )), r), "compose");
  return {
    _tag: "Story",
    input: e,
    meta: t,
    __compose: o,
    get composed() {
      let i = o(), { args: s, argTypes: a, parameters: p, id: c, tags: l, globals: y, storyName: u } = i;
      return { args: s, argTypes: a, parameters: p, id: c, tags: l, name: u, globals: y };
    },
    get play() {
      return e.play ?? t.input?.play ?? (async () => {
      });
    },
    get run() {
      return o().run ?? (async () => {
      });
    },
    extend(i) {
      return So(
        {
          ...this.input,
          ...i,
          args: { ...this.input.args, ...i.args },
          argTypes: D(this.input.argTypes, i.argTypes),
          afterEach: [
            ...b(this.input?.afterEach ?? []),
            ...b(i.afterEach ?? [])
          ],
          beforeEach: [
            ...b(this.input?.beforeEach ?? []),
            ...b(i.beforeEach ?? [])
          ],
          decorators: [
            ...b(this.input?.decorators ?? []),
            ...b(i.decorators ?? [])
          ],
          globals: { ...this.input.globals, ...i.globals },
          loaders: [
            ...b(this.input?.loaders ?? []),
            ...b(i.loaders ?? [])
          ],
          parameters: D(this.input.parameters, i.parameters),
          tags: (0, To.combineTags)(...this.input.tags ?? [], ...i.tags ?? [])
        },
        this.meta
      );
    }
  };
}
n(So, "defineStory");

// src/csf/index.ts
var wo = /* @__PURE__ */ n((e) => e.toLowerCase().replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "-").replace(/-+/g,
"-").replace(/^-+/, "").replace(/-+$/, ""), "sanitize"), Ao = /* @__PURE__ */ n((e, t) => {
  let r = wo(e);
  if (r === "")
    throw new Error(`Invalid ${t} '${e}', must include alphanumeric characters`);
  return r;
}, "sanitizeSafe"), Wn = /* @__PURE__ */ n((e, t) => `${Ao(e, "kind")}${t ? `--${Ao(t, "name")}` : ""}`, "toId"), Yn = /* @__PURE__ */ n((e) => Mt(
e), "storyNameFromExport");
function Ro(e, t) {
  return Array.isArray(t) ? t.includes(e) : e.match(t);
}
n(Ro, "matches");
function Vn(e, { includeStories: t, excludeStories: r }) {
  return (
    // https://babeljs.io/docs/en/babel-plugin-transform-modules-commonjs
    e !== "__esModule" && (!t || Ro(e, t)) && (!r || !Ro(e, r))
  );
}
n(Vn, "isExportStory");
var Kn = /* @__PURE__ */ n((e, { rootSeparator: t, groupSeparator: r }) => {
  let [o, i] = e.split(t, 2), s = (i || e).split(r).filter((a) => !!a);
  return {
    root: i ? o : null,
    groups: s
  };
}, "parseKind"), qn = /* @__PURE__ */ n((...e) => {
  let t = e.reduce((r, o) => (o.startsWith("!") ? r.delete(o.slice(1)) : r.add(o), r), /* @__PURE__ */ new Set());
  return Array.from(t);
}, "combineTags");
