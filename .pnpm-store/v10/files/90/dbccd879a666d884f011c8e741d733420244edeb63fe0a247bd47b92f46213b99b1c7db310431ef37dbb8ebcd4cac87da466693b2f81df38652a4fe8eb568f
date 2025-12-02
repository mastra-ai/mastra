var Br = Object.create;
var ce = Object.defineProperty;
var zr = Object.getOwnPropertyDescriptor;
var Ur = Object.getOwnPropertyNames;
var Gr = Object.getPrototypeOf, Wr = Object.prototype.hasOwnProperty;
var n = (e, t) => ce(e, "name", { value: t, configurable: !0 });
var Yr = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports), xt = (e, t) => {
  for (var r in t)
    ce(e, r, { get: t[r], enumerable: !0 });
}, Vr = (e, t, r, o) => {
  if (t && typeof t == "object" || typeof t == "function")
    for (let i of Ur(t))
      !Wr.call(e, i) && i !== r && ce(e, i, { get: () => t[i], enumerable: !(o = zr(t, i)) || o.enumerable });
  return e;
};
var Kr = (e, t, r) => (r = e != null ? Br(Gr(e)) : {}, Vr(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  t || !e || !e.__esModule ? ce(r, "default", { value: e, enumerable: !0 }) : r,
  e
));

// ../node_modules/@ngard/tiny-isequal/index.js
var Tt = Yr((Ee) => {
  Object.defineProperty(Ee, "__esModule", { value: !0 }), Ee.isEqual = /* @__PURE__ */ function() {
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

// src/csf/toStartCaseStr.ts
function bt(e) {
  return e.replace(/_/g, " ").replace(/-/g, " ").replace(/\./g, " ").replace(/([^\n])([A-Z])([a-z])/g, (t, r, o, i) => `${r} ${o}${i}`).replace(
  /([a-z])([A-Z])/g, (t, r, o) => `${r} ${o}`).replace(/([a-z])([0-9])/gi, (t, r, o) => `${r} ${o}`).replace(/([0-9])([a-z])/gi, (t, r, o) => `${r}\
 ${o}`).replace(/(\s|^)(\w)/g, (t, r, o) => `${r}${o.toUpperCase()}`).replace(/ +/g, " ").trim();
}
n(bt, "toStartCaseStr");

// src/csf/includeConditionalArg.ts
var Ce = Kr(Tt(), 1);
var St = /* @__PURE__ */ n((e) => e.map((t) => typeof t < "u").filter(Boolean).length, "count"), qr = /* @__PURE__ */ n((e, t) => {
  let { exists: r, eq: o, neq: i, truthy: s } = e;
  if (St([r, o, i, s]) > 1)
    throw new Error(`Invalid conditional test ${JSON.stringify({ exists: r, eq: o, neq: i })}`);
  if (typeof o < "u")
    return (0, Ce.isEqual)(t, o);
  if (typeof i < "u")
    return !(0, Ce.isEqual)(t, i);
  if (typeof r < "u") {
    let p = typeof t < "u";
    return r ? p : !p;
  }
  return (typeof s > "u" ? !0 : s) ? !!t : !t;
}, "testValue"), Xr = /* @__PURE__ */ n((e, t, r) => {
  if (!e.if)
    return !0;
  let { arg: o, global: i } = e.if;
  if (St([o, i]) !== 1)
    throw new Error(`Invalid conditional value ${JSON.stringify({ arg: o, global: i })}`);
  let s = o ? t[o] : r[i];
  return qr(e.if, s);
}, "includeConditionalArg");

// src/csf/csf-factories.ts
import { combineTags as Hn } from "storybook/internal/csf";

// src/preview-api/modules/addons/main.ts
import { global as ve } from "@storybook/global";

// src/preview-api/modules/addons/storybook-channel-mock.ts
import { Channel as Zr } from "storybook/internal/channels";
function At() {
  let e = {
    setHandler: /* @__PURE__ */ n(() => {
    }, "setHandler"),
    send: /* @__PURE__ */ n(() => {
    }, "send")
  };
  return new Zr({ transport: e });
}
n(At, "mockChannel");

// src/preview-api/modules/addons/main.ts
var Me = class Me {
  constructor() {
    this.getChannel = /* @__PURE__ */ n(() => {
      if (!this.channel) {
        let t = At();
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
};
n(Me, "AddonStore");
var Pe = Me, ke = "__STORYBOOK_ADDONS_PREVIEW";
function Jr() {
  return ve[ke] || (ve[ke] = new Pe()), ve[ke];
}
n(Jr, "getAddonsStore");
var Oe = Jr();

// src/preview-api/modules/addons/hooks.ts
import { logger as ri } from "storybook/internal/client-logger";
import {
  FORCE_RE_RENDER as ni,
  RESET_STORY_ARGS as ii,
  STORY_RENDERED as Rt,
  UPDATE_GLOBALS as si,
  UPDATE_STORY_ARGS as ai
} from "storybook/internal/core-events";
import { global as $e } from "@storybook/global";
var Ie = class Ie {
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
    this.removeRenderListeners(), Oe.getChannel().on(Rt, this.renderListener);
  }
  removeRenderListeners() {
    Oe.getChannel().removeListener(Rt, this.renderListener);
  }
};
n(Ie, "HooksContext");
var de = Ie;
function wt(e) {
  let t = /* @__PURE__ */ n((...r) => {
    let { hooks: o } = typeof r[0] == "function" ? r[1] : r[0], i = o.currentPhase, s = o.currentHooks, a = o.nextHookIndex, p = o.currentDecoratorName;
    o.currentDecoratorName = e.name, o.prevMountedDecorators.has(e) ? (o.currentPhase = "UPDATE", o.currentHooks = o.hookListsMap.get(e) || []) :
    (o.currentPhase = "MOUNT", o.currentHooks = [], o.hookListsMap.set(e, o.currentHooks), o.prevMountedDecorators.add(e)), o.nextHookIndex =
    0;
    let c = $e.STORYBOOK_HOOKS_CONTEXT;
    $e.STORYBOOK_HOOKS_CONTEXT = o;
    let l = e(...r);
    if ($e.STORYBOOK_HOOKS_CONTEXT = c, o.currentPhase === "UPDATE" && o.getNextHook() != null)
      throw new Error(
        "Rendered fewer hooks than expected. This may be caused by an accidental early return statement."
      );
    return o.currentPhase = i, o.currentHooks = s, o.nextHookIndex = a, o.currentDecoratorName = p, l;
  }, "hookified");
  return t.originalFn = e, t;
}
n(wt, "hookify");
var Fe = 0, Qr = 25, Et = /* @__PURE__ */ n((e) => (t, r) => {
  let o = e(
    wt(t),
    r.map((i) => wt(i))
  );
  return (i) => {
    let { hooks: s } = i;
    s.prevMountedDecorators ??= /* @__PURE__ */ new Set(), s.mountedDecorators = /* @__PURE__ */ new Set([t, ...r]), s.currentContext = i, s.
    hasUpdates = !1;
    let a = o(i);
    for (Fe = 1; s.hasUpdates; )
      if (s.hasUpdates = !1, s.currentEffects = [], a = o(i), Fe += 1, Fe > Qr)
        throw new Error(
          "Too many re-renders. Storybook limits the number of renders to prevent an infinite loop."
        );
    return s.addRenderListeners(), a;
  };
}, "applyHooks");

// ../node_modules/es-toolkit/dist/predicate/isPlainObject.mjs
function ee(e) {
  if (!e || typeof e != "object")
    return !1;
  let t = Object.getPrototypeOf(e);
  return t === null || t === Object.prototype || Object.getPrototypeOf(t) === null ? Object.prototype.toString.call(e) === "[object Object]" :
  !1;
}
n(ee, "isPlainObject");

// ../node_modules/es-toolkit/dist/object/mapValues.mjs
function U(e, t) {
  let r = {}, o = Object.keys(e);
  for (let i = 0; i < o.length; i++) {
    let s = o[i], a = e[s];
    r[s] = t(a, s, e);
  }
  return r;
}
n(U, "mapValues");

// ../node_modules/es-toolkit/dist/object/pickBy.mjs
function Le(e, t) {
  let r = {}, o = Object.keys(e);
  for (let i = 0; i < o.length; i++) {
    let s = o[i], a = e[s];
    t(a, s) && (r[s] = a);
  }
  return r;
}
n(Le, "pickBy");

// src/preview-api/modules/store/args.ts
import { once as Ei } from "storybook/internal/client-logger";

// ../node_modules/ts-dedent/esm/index.js
function W(e) {
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
n(W, "dedent");

// src/preview-api/modules/store/args.ts
var vi = Symbol("incompatible");
var ki = Symbol("Deeply equal");
var De = "UNTARGETED";
function Ct({
  args: e,
  argTypes: t
}) {
  let r = {};
  return Object.entries(e).forEach(([o, i]) => {
    let { target: s = De } = t[o] || {};
    r[s] = r[s] || {}, r[s][o] = i;
  }), r;
}
n(Ct, "groupArgsByTarget");

// src/preview-api/modules/store/csf/getValuesFromArgTypes.ts
var vt = /* @__PURE__ */ n((e = {}) => Object.entries(e).reduce((t, [r, { defaultValue: o }]) => (typeof o < "u" && (t[r] = o), t), {}), "ge\
tValuesFromArgTypes");

// src/preview-api/modules/store/csf/normalizeInputTypes.ts
var eo = /* @__PURE__ */ n((e) => typeof e == "string" ? { name: e } : e, "normalizeType"), to = /* @__PURE__ */ n((e) => typeof e == "strin\
g" ? { type: e } : e, "normalizeControl"), ro = /* @__PURE__ */ n((e, t) => {
  let { type: r, control: o, ...i } = e, s = {
    name: t,
    ...i
  };
  return r && (s.type = eo(r)), o ? s.control = to(o) : o === !1 && (s.control = { disable: !0 }), s;
}, "normalizeInputType"), K = /* @__PURE__ */ n((e) => U(e, ro), "normalizeInputTypes");

// src/preview-api/modules/store/csf/normalizeStory.ts
import { deprecate as oo, logger as no } from "storybook/internal/client-logger";
import { storyNameFromExport as io, toId as so } from "storybook/internal/csf";

// src/preview-api/modules/store/csf/normalizeArrays.ts
var b = /* @__PURE__ */ n((e) => Array.isArray(e) ? e : e ? [e] : [], "normalizeArrays");

// src/preview-api/modules/store/csf/normalizeStory.ts
var ao = W`
CSF .story annotations deprecated; annotate story functions directly:
- StoryFn.story.name => StoryFn.storyName
- StoryFn.story.(parameters|decorators) => StoryFn.(parameters|decorators)
See https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#hoisted-csf-annotations for details and codemod.
`;
function _e(e, t, r) {
  let o = t, i = typeof t == "function" ? t : null, { story: s } = o;
  s && (no.debug("deprecated story", s), oo(ao));
  let a = io(e), p = typeof o != "function" && o.name || o.storyName || s?.name || a, c = [
    ...b(o.decorators),
    ...b(s?.decorators)
  ], l = { ...s?.parameters, ...o.parameters }, y = { ...s?.args, ...o.args }, u = { ...s?.argTypes, ...o.argTypes }, h = [...b(o.loaders), ...b(
  s?.loaders)], T = [
    ...b(o.beforeEach),
    ...b(s?.beforeEach)
  ], R = [
    ...b(o.afterEach),
    ...b(s?.afterEach)
  ], { render: P, play: L, tags: O = [], globals: F = {} } = o, A = l.__id || so(r.id, a);
  return {
    moduleExport: t,
    id: A,
    name: p,
    tags: O,
    decorators: c,
    parameters: l,
    args: y,
    argTypes: K(u),
    loaders: h,
    beforeEach: T,
    afterEach: R,
    globals: F,
    ...P && { render: P },
    ...i && { userStoryFn: i },
    ...L && { play: L }
  };
}
n(_e, "normalizeStory");

// src/preview-api/modules/store/csf/normalizeComponentAnnotations.ts
import { sanitize as po } from "storybook/internal/csf";
function kt(e, t = e.title, r) {
  let { id: o, argTypes: i } = e;
  return {
    id: po(o || t),
    ...e,
    title: t,
    ...i && { argTypes: K(i) },
    parameters: {
      fileName: r,
      ...e.parameters
    }
  };
}
n(kt, "normalizeComponentAnnotations");

// src/preview-api/modules/store/csf/prepareStory.ts
import { combineTags as co, includeConditionalArg as mo } from "storybook/internal/csf";
import { NoRenderFunctionError as uo } from "storybook/internal/preview-errors";
import { global as fo } from "@storybook/global";
import { global as yo } from "@storybook/global";

// src/preview-api/modules/preview-web/render/mount-utils.ts
function Ot(e) {
  return e != null && lo(e).includes("mount");
}
n(Ot, "mountDestructured");
function lo(e) {
  let t = e.toString().match(/[^(]*\(([^)]*)/);
  if (!t)
    return [];
  let r = Pt(t[1]);
  if (!r.length)
    return [];
  let o = r[0];
  return o.startsWith("{") && o.endsWith("}") ? Pt(o.slice(1, -1).replace(/\s/g, "")).map((s) => s.replace(/:.*|=.*/g, "")) : [];
}
n(lo, "getUsedProps");
function Pt(e) {
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
n(Pt, "splitByComma");

// src/preview-api/modules/store/decorators.ts
function Mt(e, t, r) {
  let o = r(e);
  return (i) => t(o, i);
}
n(Mt, "decorateStory");
function $t({
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
n($t, "sanitizeStoryContextUpdate");
function He(e, t) {
  let r = {}, o = /* @__PURE__ */ n((s) => (a) => {
    if (!r.value)
      throw new Error("Decorated function called without init");
    return r.value = {
      ...r.value,
      ...$t(a)
    }, s(r.value);
  }, "bindWithContext"), i = t.reduce(
    (s, a) => Mt(s, a, o),
    e
  );
  return (s) => (r.value = s, i(s));
}
n(He, "defaultDecorateStory");

// src/preview-api/modules/store/parameters.ts
var D = /* @__PURE__ */ n((...e) => {
  let t = {}, r = e.filter(Boolean), o = r.reduce((i, s) => (Object.entries(s).forEach(([a, p]) => {
    let c = i[a];
    Array.isArray(p) || typeof c > "u" ? i[a] = p : ee(p) && ee(c) ? t[a] = !0 : typeof p < "u" && (i[a] = p);
  }), i), {});
  return Object.keys(t).forEach((i) => {
    let s = r.filter(Boolean).map((a) => a[i]).filter((a) => typeof a < "u");
    s.every((a) => ee(a)) ? o[i] = D(...s) : o[i] = s[s.length - 1];
  }), o;
}, "combineParameters");

// src/preview-api/modules/store/csf/prepareStory.ts
function Ne(e, t, r) {
  let { moduleExport: o, id: i, name: s } = e || {}, a = go(
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
  }, "applyAfterEach"), y = /* @__PURE__ */ n((w) => w.originalStoryFn(w.args, w), "undecoratedStoryFn"), { applyDecorators: u = He, runStep: h } = r,
  T = [
    ...b(e?.decorators),
    ...b(t?.decorators),
    ...b(r?.decorators)
  ], R = e?.userStoryFn || e?.render || t.render || r.render, P = Et(u)(y, T), L = /* @__PURE__ */ n((w) => P(w), "unboundStoryFn"), O = e?.
  play ?? t?.play, F = Ot(O);
  if (!R && !F)
    throw new uo({ id: i });
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
n(Ne, "prepareStory");
function go(e, t, r) {
  let o = ["dev", "test"], i = yo.DOCS_OPTIONS?.autodocs === !0 ? ["autodocs"] : [], s = co(
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
n(go, "preparePartialAnnotations");
function Ft(e) {
  let { args: t } = e, r = {
    ...e,
    allArgs: void 0,
    argsByTarget: void 0
  };
  if (fo.FEATURES?.argTypeTargetsV7) {
    let s = Ct(e);
    r = {
      ...e,
      allArgs: e.args,
      argsByTarget: s,
      args: s[De] || {}
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
    return mo(c, o, r.globals) && (s[a] = p), s;
  }, {});
  return { ...r, unmappedArgs: t, args: i };
}
n(Ft, "prepareContext");

// src/preview-api/modules/store/inferArgTypes.ts
import { logger as ho } from "storybook/internal/client-logger";
var je = /* @__PURE__ */ n((e, t, r) => {
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
  return e ? r.has(e) ? (ho.warn(W`
        We've detected a cycle in arg '${t}'. Args should be JSON-serializable.

        Consider using the mapping feature or fully custom args:
        - Mapping: https://storybook.js.org/docs/writing-stories/args#mapping-to-complex-arg-values
        - Custom args: https://storybook.js.org/docs/essentials/controls#fully-custom-args
      `), { name: "other", value: "cyclic object" }) : (r.add(e), Array.isArray(e) ? { name: "array", value: e.length > 0 ? je(e[0], t, new Set(
  r)) : { name: "other", value: "unknown" } } : { name: "object", value: U(e, (s) => je(s, t, new Set(r))) }) : { name: "object", value: {} };
}, "inferType"), Be = /* @__PURE__ */ n((e) => {
  let { id: t, argTypes: r = {}, initialArgs: o = {} } = e, i = U(o, (a, p) => ({
    name: p,
    type: je(a, `${t}.${p}`, /* @__PURE__ */ new Set())
  })), s = U(r, (a, p) => ({
    name: p
  }));
  return D(i, s, r);
}, "inferArgTypes");
Be.secondPass = !0;

// src/preview-api/modules/store/inferControls.ts
import { logger as xo } from "storybook/internal/client-logger";

// src/preview-api/modules/store/filterArgTypes.ts
var It = /* @__PURE__ */ n((e, t) => Array.isArray(t) ? t.includes(e) : e.match(t), "matches"), ze = /* @__PURE__ */ n((e, t, r) => !t && !r ?
e : e && Le(e, (o, i) => {
  let s = o.name || i.toString();
  return !!(!t || It(s, t)) && (!r || !It(s, r));
}), "filterArgTypes");

// src/preview-api/modules/store/inferControls.ts
var bo = /* @__PURE__ */ n((e, t, r) => {
  let { type: o, options: i } = e;
  if (o) {
    if (r.color && r.color.test(t)) {
      let s = o.name;
      if (s === "string")
        return { control: { type: "color" } };
      s !== "enum" && xo.warn(
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
}, "inferControl"), me = /* @__PURE__ */ n((e) => {
  let {
    argTypes: t,
    parameters: { __isArgsStory: r, controls: { include: o = null, exclude: i = null, matchers: s = {} } = {} }
  } = e;
  if (!r)
    return t;
  let a = ze(t, o, i), p = U(a, (c, l) => c?.type && bo(c, l.toString(), s));
  return D(p, a);
}, "inferControls");
me.secondPass = !0;

// src/preview-api/modules/store/csf/normalizeProjectAnnotations.ts
function te({
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
    ...e && { argTypes: K(e) },
    ...t && { globalTypes: K(t) },
    decorators: b(o),
    loaders: b(i),
    beforeEach: b(s),
    afterEach: b(a),
    argTypesEnhancers: [
      ...r || [],
      Be,
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
      me
    ],
    initialGlobals: p,
    ...c
  };
}
n(te, "normalizeProjectAnnotations");

// src/preview-api/modules/store/csf/composeConfigs.ts
import { global as To } from "@storybook/global";

// src/preview-api/modules/store/csf/beforeAll.ts
var Lt = /* @__PURE__ */ n((e) => async () => {
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
function Ue(e) {
  return async (t, r, o) => {
    await e.reduceRight(
      (s, a) => async () => a(t, s, o),
      async () => r(o)
    )();
  };
}
n(Ue, "composeStepRunners");

// src/preview-api/modules/store/csf/composeConfigs.ts
function oe(e, t) {
  return e.map((r) => r.default?.[t] ?? r[t]).filter(Boolean);
}
n(oe, "getField");
function Y(e, t, r = {}) {
  return oe(e, t).reduce((o, i) => {
    let s = b(i);
    return r.reverseFileOrder ? [...s, ...o] : [...o, ...s];
  }, []);
}
n(Y, "getArrayField");
function ue(e, t) {
  return Object.assign({}, ...oe(e, t));
}
n(ue, "getObjectField");
function re(e, t) {
  return oe(e, t).pop();
}
n(re, "getSingletonField");
function ne(e) {
  let t = Y(e, "argTypesEnhancers"), r = oe(e, "runStep"), o = Y(e, "beforeAll");
  return {
    parameters: D(...oe(e, "parameters")),
    decorators: Y(e, "decorators", {
      reverseFileOrder: !(To.FEATURES?.legacyDecoratorFileOrder ?? !1)
    }),
    args: ue(e, "args"),
    argsEnhancers: Y(e, "argsEnhancers"),
    argTypes: ue(e, "argTypes"),
    argTypesEnhancers: [
      ...t.filter((i) => !i.secondPass),
      ...t.filter((i) => i.secondPass)
    ],
    initialGlobals: ue(e, "initialGlobals"),
    globalTypes: ue(e, "globalTypes"),
    loaders: Y(e, "loaders"),
    beforeAll: Lt(o),
    beforeEach: Y(e, "beforeEach"),
    afterEach: Y(e, "afterEach"),
    render: re(e, "render"),
    renderToCanvas: re(e, "renderToCanvas"),
    applyDecorators: re(e, "applyDecorators"),
    runStep: Ue(r),
    tags: Y(e, "tags"),
    mount: re(e, "mount"),
    testingLibraryRender: re(e, "testingLibraryRender")
  };
}
n(ne, "composeConfigs");

// src/preview-api/modules/store/csf/portable-stories.ts
import { isExportStory as Zs } from "storybook/internal/csf";
import { getCoreAnnotations as Qs } from "storybook/internal/csf";
import { MountMustBeDestructuredError as Ao } from "storybook/internal/preview-errors";

// src/preview-api/modules/preview-web/render/animation-utils.ts
function Dt() {
  try {
    return (
      // @ts-expect-error This property exists in Vitest browser mode
      !!globalThis.__vitest_browser__ || !!globalThis.window?.navigator?.userAgent?.match(/StorybookTestRunner/)
    );
  } catch {
    return !1;
  }
}
n(Dt, "isTestEnvironment");
function _t(e = !0) {
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
n(_t, "pauseAnimations");
async function Ht(e) {
  if (!("document" in globalThis && "getAnimations" in globalThis.document && "querySelectorAll" in globalThis.document))
    return;
  let t = !1;
  await Promise.race([
    // After 50ms, retrieve any running animations and wait for them to finish
    // If new animations are created while waiting, we'll wait for them too
    new Promise((r) => {
      setTimeout(() => {
        let o = [globalThis.document, ...Nt(globalThis.document)], i = /* @__PURE__ */ n(async () => {
          if (t || e?.aborted)
            return;
          let s = o.flatMap((a) => a?.getAnimations?.() || []).filter((a) => a.playState === "running" && !So(a));
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
n(Ht, "waitForAnimations");
function Nt(e) {
  return [e, ...e.querySelectorAll("*")].reduce((t, r) => ("shadowRoot" in r && r.shadowRoot && t.push(r.shadowRoot, ...Nt(r.shadowRoot)), t),
  []);
}
n(Nt, "getShadowRoots");
function So(e) {
  if (e instanceof CSSAnimation && e.effect instanceof KeyframeEffect && e.effect.target) {
    let t = getComputedStyle(e.effect.target, e.effect.pseudoElement), r = t.animationName?.split(", ").indexOf(e.animationName);
    return t.animationIterationCount.split(", ")[r] === "infinite";
  }
  return !1;
}
n(So, "isInfiniteAnimation");

// src/preview-api/modules/store/reporter-api.ts
var Ge = class Ge {
  constructor() {
    this.reports = [];
  }
  async addReport(t) {
    this.reports.push(t);
  }
};
n(Ge, "ReporterAPI");
var fe = Ge;

// src/preview-api/modules/store/csf/portable-stories.ts
var Ro = "ComposedStory", wo = "Unnamed Story";
var V = [];
function We(e, t, r, o, i) {
  if (e === void 0)
    throw new Error("Expected a story but received undefined.");
  t.title = t.title ?? Ro;
  let s = kt(t), a = i || e.storyName || e.story?.name || e.name || wo, p = _e(
    a,
    e,
    s
  ), c = te(
    ne([
      o ?? globalThis.globalProjectAnnotations ?? {},
      r ?? {}
    ])
  ), l = Ne(
    p,
    s,
    c
  ), u = {
    ...vt(c.globalTypes),
    ...c.initialGlobals,
    ...l.storyGlobals
  }, h = new fe(), T = /* @__PURE__ */ n(() => {
    let A = Ft({
      hooks: new de(),
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
    return Object.assign(S, A), Eo(l, S);
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
n(We, "composeStory");
async function Eo(e, t) {
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
    throw new Ao({ playFunction: r.toString() });
  }), await r(t));
  let i;
  Dt() ? i = _t() : await Ht(t.abortSignal), await e.applyAfterEach(t), await i?.();
}
n(Eo, "runStory");

// ../node_modules/tiny-invariant/dist/esm/tiny-invariant.js
var Co = !1, Ye = "Invariant failed";
function ye(e, t) {
  if (!e) {
    if (Co)
      throw new Error(Ye);
    var r = typeof t == "function" ? t() : t, o = r ? "".concat(Ye, ": ").concat(r) : Ye;
    throw new Error(o);
  }
}
n(ye, "invariant");

// src/actions/preview.ts
import { definePreviewAddon as Lo } from "storybook/internal/csf";

// src/actions/addArgs.ts
var Ke = {};
xt(Ke, {
  argsEnhancers: () => Mo
});

// src/actions/runtime/action.ts
import { ImplicitActionsDuringRendering as vo } from "storybook/internal/preview-errors";
import { global as zt } from "@storybook/global";
import { addons as ko } from "storybook/preview-api";

// src/actions/constants.ts
var Ve = "storybook/actions", Ia = `${Ve}/panel`, jt = `${Ve}/action-event`, La = `${Ve}/action-clear`;

// src/actions/runtime/configureActions.ts
var Bt = {
  depth: 10,
  clearOnStoryChange: !0,
  limit: 50
};

// src/actions/runtime/action.ts
var Ut = /* @__PURE__ */ n((e, t) => {
  let r = Object.getPrototypeOf(e);
  return !r || t(r) ? r : Ut(r, t);
}, "findProto"), Po = /* @__PURE__ */ n((e) => !!(typeof e == "object" && e && Ut(e, (t) => /^Synthetic(?:Base)?Event$/.test(t.constructor.name)) &&
typeof e.persist == "function"), "isReactSyntheticEvent"), Oo = /* @__PURE__ */ n((e) => {
  if (Po(e)) {
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
function ie(e, t = {}) {
  let r = {
    ...Bt,
    ...t
  }, o = /* @__PURE__ */ n(function(...s) {
    if (t.implicit) {
      let T = ("__STORYBOOK_PREVIEW__" in zt ? zt.__STORYBOOK_PREVIEW__ : void 0)?.storyRenders.find(
        (R) => R.phase === "playing" || R.phase === "rendering"
      );
      if (T) {
        let R = !globalThis?.FEATURES?.disallowImplicitActionsInRenderV8, P = new vo({
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
    let a = ko.getChannel(), p = Date.now().toString(36) + Math.random().toString(36).substring(2), c = 5, l = s.map(Oo), y = s.length > 1 ?
    l : l[0], u = {
      id: p,
      count: 0,
      data: { name: e, args: y },
      options: {
        ...r,
        maxDepth: c + (r.depth || 3)
      }
    };
    a.emit(jt, u);
  }, "actionHandler");
  return o.isAction = !0, o.implicit = t.implicit, o;
}
n(ie, "action");

// src/actions/addArgsHelpers.ts
var Gt = /* @__PURE__ */ n((e, t) => typeof t[e] > "u" && !(e in t), "isInInitialArgs"), Wt = /* @__PURE__ */ n((e) => {
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
  ).reduce((p, [c, l]) => (Gt(c, t) && (p[c] = ie(c, { implicit: !0, id: o })), p), {});
}, "inferActionsFromArgTypesRegex"), Yt = /* @__PURE__ */ n((e) => {
  let {
    initialArgs: t,
    argTypes: r,
    parameters: { actions: o }
  } = e;
  return o?.disable || !r ? {} : Object.entries(r).filter(([s, a]) => !!a.action).reduce((s, [a, p]) => (Gt(a, t) && (s[a] = ie(typeof p.action ==
  "string" ? p.action : a)), s), {});
}, "addActionsFromArgTypes");

// src/actions/addArgs.ts
var Mo = [
  Yt,
  Wt
];

// src/actions/loaders.ts
var qe = {};
xt(qe, {
  loaders: () => Io
});
import { onMockCall as $o } from "storybook/test";
var Vt = !1, Fo = /* @__PURE__ */ n((e) => {
  let { parameters: t } = e;
  t?.actions?.disable || Vt || ($o((r, o) => {
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
    ].some((s) => i.startsWith(s))) && ie(i)(o);
  }), Vt = !0);
}, "logActionsWhenMockCalled"), Io = [Fo];

// src/actions/preview.ts
var Xe = /* @__PURE__ */ n(() => Lo({
  ...Ke,
  ...qe
}), "default");

// src/backgrounds/preview.ts
import { definePreviewAddon as jo } from "storybook/internal/csf";

// src/backgrounds/constants.ts
var Do = "storybook/background", Z = "backgrounds";
var rp = {
  UPDATE: `${Do}/update`
};

// src/backgrounds/decorator.ts
import { useEffect as Jt } from "storybook/preview-api";

// src/backgrounds/defaults.ts
var Kt = {
  light: { name: "light", value: "#F8F8F8" },
  dark: { name: "dark", value: "#333" }
};

// src/backgrounds/utils.ts
var { document: N } = globalThis, qt = /* @__PURE__ */ n(() => globalThis?.matchMedia ? !!globalThis.matchMedia("(prefers-reduced-motion: re\
duce)")?.matches : !1, "isReduceMotionEnabled"), Ze = /* @__PURE__ */ n((e) => {
  (Array.isArray(e) ? e : [e]).forEach(_o);
}, "clearStyles"), _o = /* @__PURE__ */ n((e) => {
  if (!N)
    return;
  let t = N.getElementById(e);
  t && t.parentElement && t.parentElement.removeChild(t);
}, "clearStyle"), Xt = /* @__PURE__ */ n((e, t) => {
  if (!N)
    return;
  let r = N.getElementById(e);
  if (r)
    r.innerHTML !== t && (r.innerHTML = t);
  else {
    let o = N.createElement("style");
    o.setAttribute("id", e), o.innerHTML = t, N.head.appendChild(o);
  }
}, "addGridStyle"), Zt = /* @__PURE__ */ n((e, t, r) => {
  if (!N)
    return;
  let o = N.getElementById(e);
  if (o)
    o.innerHTML !== t && (o.innerHTML = t);
  else {
    let i = N.createElement("style");
    i.setAttribute("id", e), i.innerHTML = t;
    let s = `addon-backgrounds-grid${r ? `-docs-${r}` : ""}`, a = N.getElementById(s);
    a ? a.parentElement?.insertBefore(i, a) : N.head.appendChild(i);
  }
}, "addBackgroundStyle");

// src/backgrounds/decorator.ts
var Ho = {
  cellSize: 100,
  cellAmount: 10,
  opacity: 0.8
}, Qt = "addon-backgrounds", er = "addon-backgrounds-grid", No = qt() ? "" : "transition: background-color 0.3s;", tr = /* @__PURE__ */ n((e, t) => {
  let { globals: r = {}, parameters: o = {}, viewMode: i, id: s } = t, {
    options: a = Kt,
    disable: p,
    grid: c = Ho
  } = o[Z] || {}, l = r[Z] || {}, y = typeof l == "string" ? l : l?.value, u = y ? a[y] : void 0, h = typeof u == "string" ? u : u?.value ||
  "transparent", T = typeof l == "string" ? !1 : l.grid || !1, R = !!u && !p, P = i === "docs" ? `#anchor--${s} .docs-story` : ".sb-show-mai\
n", L = i === "docs" ? `#anchor--${s} .docs-story` : ".sb-show-main", O = o.layout === void 0 || o.layout === "padded", F = i === "docs" ? 20 :
  O ? 16 : 0, { cellAmount: A, cellSize: S, opacity: v, offsetX: w = F, offsetY: d = F } = c, m = i === "docs" ? `${Qt}-docs-${s}` : `${Qt}-\
color`, f = i === "docs" ? s : null;
  Jt(() => {
    let g = `
    ${P} {
      background: ${h} !important;
      ${No}
      }`;
    if (!R) {
      Ze(m);
      return;
    }
    Zt(m, g, f);
  }, [P, m, f, R, h]);
  let x = i === "docs" ? `${er}-docs-${s}` : `${er}`;
  return Jt(() => {
    if (!T) {
      Ze(x);
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
    Xt(x, E);
  }, [A, S, L, x, T, w, d, v]), e();
}, "withBackgroundAndGrid");

// src/backgrounds/preview.ts
var Bo = globalThis.FEATURES?.backgrounds ? [tr] : [], zo = {
  [Z]: {
    grid: {
      cellSize: 20,
      opacity: 0.5,
      cellAmount: 5
    },
    disable: !1
  }
}, Uo = {
  [Z]: { value: void 0, grid: !1 }
}, Je = /* @__PURE__ */ n(() => jo({
  decorators: Bo,
  parameters: zo,
  initialGlobals: Uo
}), "default");

// src/component-testing/preview.ts
import { definePreviewAddon as Go } from "storybook/internal/csf";
import { instrument as Wo } from "storybook/internal/instrumenter";
var { step: Yo } = Wo(
  {
    // It seems like the label is unused, but the instrumenter has access to it
    // The context will be bounded later in StoryRender, so that the user can write just:
    // await step("label", (context) => {
    //   // labeled step
    // });
    step: /* @__PURE__ */ n(async (e, t, r) => t(r), "step")
  },
  { intercept: !0 }
), Qe = /* @__PURE__ */ n(() => Go({
  parameters: {
    throwPlayFunctionExceptions: !1
  },
  runStep: Yo
}), "default");

// src/highlight/preview.ts
import { definePreviewAddon as Zo } from "storybook/internal/csf";
import { addons as ur } from "storybook/preview-api";

// src/highlight/useHighlights.ts
import { STORY_RENDER_PHASE_CHANGED as qo } from "storybook/internal/core-events";

// src/highlight/constants.ts
var ge = "storybook/highlight", rr = `${ge}/add`, or = `${ge}/remove`, nr = `${ge}/reset`, ir = `${ge}/scroll-into-view`, et = 2147483647, B = 28;

// src/highlight/icons.ts
var tt = {
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
var Vo = "svg,path,rect,circle,line,polyline,polygon,ellipse,text".split(","), M = /* @__PURE__ */ n((e, t = {}, r) => {
  let o = Vo.includes(e) ? document.createElementNS("http://www.w3.org/2000/svg", e) : document.createElement(e);
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
}, "createElement"), ae = /* @__PURE__ */ n((e) => tt[e] && M(
  "svg",
  { width: "14", height: "14", viewBox: "0 0 14 14", xmlns: "http://www.w3.org/2000/svg" },
  tt[e].map(
    (t) => M("path", {
      fill: "currentColor",
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: t
    })
  )
), "createIcon"), sr = /* @__PURE__ */ n((e) => {
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
}, "normalizeOptions"), Ko = /* @__PURE__ */ n((e) => e instanceof Function, "isFunction"), se = /* @__PURE__ */ new Map(), q = /* @__PURE__ */ new Map(),
he = /* @__PURE__ */ new Map(), z = /* @__PURE__ */ n((e) => {
  let t = Symbol();
  return q.set(t, []), se.set(t, e), { get: /* @__PURE__ */ n(() => se.get(t), "get"), set: /* @__PURE__ */ n((a) => {
    let p = se.get(t), c = Ko(a) ? a(p) : a;
    c !== p && (se.set(t, c), q.get(t)?.forEach((l) => {
      he.get(l)?.(), he.set(l, l(c));
    }));
  }, "set"), subscribe: /* @__PURE__ */ n((a) => (q.get(t)?.push(a), () => {
    let p = q.get(t);
    p && q.set(
      t,
      p.filter((c) => c !== a)
    );
  }), "subscribe"), teardown: /* @__PURE__ */ n(() => {
    q.get(t)?.forEach((a) => {
      he.get(a)?.(), he.delete(a);
    }), q.delete(t), se.delete(t);
  }, "teardown") };
}, "useStore"), rt = /* @__PURE__ */ n((e) => {
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
}, "mapElements"), ar = /* @__PURE__ */ n((e) => Array.from(e.entries()).map(([t, { selectors: r, styles: o, hoverStyles: i, focusStyles: s,
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
}).sort((t, r) => r.width * r.height - t.width * t.height), "mapBoxes"), ot = /* @__PURE__ */ n((e, t) => {
  let r = e.getBoundingClientRect(), { x: o, y: i } = t;
  return r?.top && r?.left && o >= r.left && o <= r.left + r.width && i >= r.top && i <= r.top + r.height;
}, "isOverMenu"), nt = /* @__PURE__ */ n((e, t, r) => {
  if (!t || !r)
    return !1;
  let { left: o, top: i, width: s, height: a } = e;
  a < B && (i = i - Math.round((B - a) / 2), a = B), s < B && (o = o - Math.round((B - s) / 2), s = B), t.style.position === "fixed" && (o +=
  window.scrollX, i += window.scrollY);
  let { x: p, y: c } = r;
  return p >= o && p <= o + s && c >= i && c <= i + a;
}, "isTargeted"), pr = /* @__PURE__ */ n((e, t, r = {}) => {
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
}, "keepInViewport"), it = /* @__PURE__ */ n((e) => {
  window.HTMLElement.prototype.hasOwnProperty("showPopover") && e.showPopover();
}, "showPopover"), lr = /* @__PURE__ */ n((e) => {
  window.HTMLElement.prototype.hasOwnProperty("showPopover") && e.hidePopover();
}, "hidePopover"), cr = /* @__PURE__ */ n((e) => ({
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
var C = "storybook-highlights-menu", dr = "storybook-highlights-root", Xo = "storybook-root", mr = /* @__PURE__ */ n((e) => {
  if (globalThis.__STORYBOOK_HIGHLIGHT_INITIALIZED)
    return;
  globalThis.__STORYBOOK_HIGHLIGHT_INITIALIZED = !0;
  let { document: t } = globalThis, r = z([]), o = z(/* @__PURE__ */ new Map()), i = z([]), s = z(), a = z(), p = z([]), c = z([]), l = z(),
  y = z(), u = t.getElementById(dr);
  r.subscribe(() => {
    u || (u = M("div", { id: dr }), t.body.appendChild(u));
  }), r.subscribe((d) => {
    let m = t.getElementById(Xo);
    if (!m)
      return;
    o.set(rt(d));
    let f = new MutationObserver(() => o.set(rt(d)));
    return f.observe(m, { subtree: !0, childList: !0 }), () => {
      f.disconnect();
    };
  }), o.subscribe((d) => {
    let m = /* @__PURE__ */ n(() => requestAnimationFrame(() => i.set(ar(d))), "updateBoxes"), f = new ResizeObserver(m);
    f.observe(t.body), Array.from(d.keys()).forEach((g) => f.observe(g));
    let x = Array.from(t.body.querySelectorAll("*")).filter((g) => {
      let { overflow: E, overflowX: I, overflowY: k } = window.getComputedStyle(g);
      return ["auto", "scroll"].some((H) => [E, I, k].includes(H));
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
        if (g && !ot(g, E)) {
          let I = m.filter((k) => {
            let H = T.get(k.element);
            return nt(k, H, E);
          });
          s.set(I.length ? E : void 0), p.set(I);
        }
      });
    }, "onClick");
    return t.addEventListener("click", f), () => t.removeEventListener("click", f);
  });
  let R = /* @__PURE__ */ n(() => {
    let d = t.getElementById(C), m = a.get();
    !m || d && ot(d, m) || c.set((f) => {
      let x = i.get().filter((k) => {
        let H = T.get(k.element);
        return nt(k, H, m);
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
          zIndex: et - 10,
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
          minHeight: `${B}px`,
          minWidth: `${B}px`,
          boxSizing: "content-box",
          padding: E.style.outlineWidth || "0px"
        }), it(E);
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
              z-index: ${et};
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
            (H) => H.some(
              (X) => !X.selectors || X.selectors.some((le) => g.selectors.includes(le))
            )
          ), I = E ? {
            class: "selectable",
            onClick: /* @__PURE__ */ n(() => y.set(g), "onClick"),
            onMouseEnter: /* @__PURE__ */ n(() => l.set(g), "onMouseEnter"),
            onMouseLeave: /* @__PURE__ */ n(() => l.set(void 0), "onMouseLeave")
          } : m ? { class: "selected", onClick: /* @__PURE__ */ n(() => y.set(void 0), "onClick") } : {}, k = E || m;
          return M("li", I, [
            M(k ? "button" : "div", k ? { type: "button" } : {}, [
              m ? ae("chevronLeft") : null,
              M("code", {}, [g.element.outerHTML]),
              E ? ae("chevronRight") : null
            ])
          ]);
        })
      )
    )), y.get() || p.get().length === 1) {
      let g = y.get() || p.get()[0], E = g.menu?.filter(
        (I) => I.some(
          (k) => !k.selectors || k.selectors.some((H) => g.selectors.includes(H))
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
                  ({ id: k, title: H, description: X, iconLeft: le, iconRight: gt, clickEvent: ht }) => {
                    let we = ht && (() => e.emit(ht, k, cr(g)));
                    return M("li", {}, [
                      M(
                        we ? "button" : "div",
                        we ? { class: "menu-item", type: "button", onClick: we } : { class: "menu-item" },
                        [
                          le ? ae(le) : null,
                          M("div", { class: "menu-item-content" }, [
                            M(X ? "strong" : "span", {}, [H]),
                            X && M("span", {}, [X])
                          ]),
                          gt ? ae(gt) : null
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
    }), it(d), requestAnimationFrame(() => pr(d, x, { topOffset: 15, centered: !0 }))) : (lr(d), Object.assign(d.style, { display: "none" }));
  }, "renderMenu");
  p.subscribe(L), y.subscribe(L);
  let O = /* @__PURE__ */ n((d) => {
    let m = sr(d);
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
  t.body.addEventListener("mousemove", w), e.on(rr, O), e.on(or, F), e.on(nr, A), e.on(ir, v), e.on(qo, ({ newPhase: d }) => {
    d === "loading" && A();
  });
}, "useHighlights");

// src/highlight/preview.ts
globalThis?.FEATURES?.highlight && ur?.ready && ur.ready().then(mr);
var st = /* @__PURE__ */ n(() => Zo({}), "default");

// src/measure/preview.ts
import { definePreviewAddon as yn } from "storybook/internal/csf";

// src/measure/constants.ts
var xe = "storybook/measure-addon", Hp = `${xe}/tool`, fr = "measureEnabled", Np = {
  RESULT: `${xe}/result`,
  REQUEST: `${xe}/request`,
  CLEAR: `${xe}/clear`
};

// src/measure/withMeasure.ts
import { useEffect as kr } from "storybook/preview-api";

// src/measure/box-model/canvas.ts
import { global as be } from "@storybook/global";
function yr() {
  let e = be.document.documentElement, t = Math.max(e.scrollHeight, e.offsetHeight);
  return { width: Math.max(e.scrollWidth, e.offsetWidth), height: t };
}
n(yr, "getDocumentWidthAndHeight");
function Jo() {
  let e = be.document.createElement("canvas");
  e.id = "storybook-addon-measure";
  let t = e.getContext("2d");
  ye(t != null);
  let { width: r, height: o } = yr();
  return at(e, t, { width: r, height: o }), e.style.position = "absolute", e.style.left = "0", e.style.top = "0", e.style.zIndex = "21474836\
47", e.style.pointerEvents = "none", be.document.body.appendChild(e), { canvas: e, context: t, width: r, height: o };
}
n(Jo, "createCanvas");
function at(e, t, { width: r, height: o }) {
  e.style.width = `${r}px`, e.style.height = `${o}px`;
  let i = be.window.devicePixelRatio;
  e.width = Math.floor(r * i), e.height = Math.floor(o * i), t.scale(i, i);
}
n(at, "setCanvasWidthAndHeight");
var $ = {};
function gr() {
  $.canvas || ($ = Jo());
}
n(gr, "init");
function hr() {
  $.context && $.context.clearRect(0, 0, $.width ?? 0, $.height ?? 0);
}
n(hr, "clear");
function xr(e) {
  hr(), e($.context);
}
n(xr, "draw");
function br() {
  ye($.canvas, "Canvas should exist in the state."), ye($.context, "Context should exist in the state."), at($.canvas, $.context, { width: 0,
  height: 0 });
  let { width: e, height: t } = yr();
  at($.canvas, $.context, { width: e, height: t }), $.width = e, $.height = t;
}
n(br, "rescale");
function Tr() {
  $.canvas && (hr(), $.canvas.parentNode?.removeChild($.canvas), $ = {});
}
n(Tr, "destroy");

// src/measure/box-model/visualizer.ts
import { global as j } from "@storybook/global";

// src/measure/box-model/labels.ts
var J = {
  margin: "#f6b26b",
  border: "#ffe599",
  padding: "#93c47d",
  content: "#6fa8dc",
  text: "#232020"
}, G = 6;
function Sr(e, { x: t, y: r, w: o, h: i, r: s }) {
  t = t - o / 2, r = r - i / 2, o < 2 * s && (s = o / 2), i < 2 * s && (s = i / 2), e.beginPath(), e.moveTo(t + s, r), e.arcTo(t + o, r, t +
  o, r + i, s), e.arcTo(t + o, r + i, t, r + i, s), e.arcTo(t, r + i, t, r, s), e.arcTo(t, r, t + o, r, s), e.closePath();
}
n(Sr, "roundedRect");
function Qo(e, { padding: t, border: r, width: o, height: i, top: s, left: a }) {
  let p = o - r.left - r.right - t.left - t.right, c = i - t.top - t.bottom - r.top - r.bottom, l = a + r.left + t.left, y = s + r.top + t.top;
  return e === "top" ? l += p / 2 : e === "right" ? (l += p, y += c / 2) : e === "bottom" ? (l += p / 2, y += c) : e === "left" ? y += c / 2 :
  e === "center" && (l += p / 2, y += c / 2), { x: l, y };
}
n(Qo, "positionCoordinate");
function en(e, t, { margin: r, border: o, padding: i }, s, a) {
  let p = /* @__PURE__ */ n((h) => 0, "shift"), c = 0, l = 0, y = a ? 1 : 0.5, u = a ? s * 2 : 0;
  return e === "padding" ? p = /* @__PURE__ */ n((h) => i[h] * y + u, "shift") : e === "border" ? p = /* @__PURE__ */ n((h) => i[h] + o[h] *
  y + u, "shift") : e === "margin" && (p = /* @__PURE__ */ n((h) => i[h] + o[h] + r[h] * y + u, "shift")), t === "top" ? l = -p("top") : t ===
  "right" ? c = p("right") : t === "bottom" ? l = p("bottom") : t === "left" && (c = -p("left")), { offsetX: c, offsetY: l };
}
n(en, "offset");
function tn(e, t) {
  return Math.abs(e.x - t.x) < Math.abs(e.w + t.w) / 2 && Math.abs(e.y - t.y) < Math.abs(e.h + t.h) / 2;
}
n(tn, "collide");
function rn(e, t, r) {
  return e === "top" ? t.y = r.y - r.h - G : e === "right" ? t.x = r.x + r.w / 2 + G + t.w / 2 : e === "bottom" ? t.y = r.y + r.h + G : e ===
  "left" && (t.x = r.x - r.w / 2 - G - t.w / 2), { x: t.x, y: t.y };
}
n(rn, "overlapAdjustment");
function Ar(e, t, { x: r, y: o, w: i, h: s }, a) {
  return Sr(e, { x: r, y: o, w: i, h: s, r: 3 }), e.fillStyle = `${J[t]}dd`, e.fill(), e.strokeStyle = J[t], e.stroke(), e.fillStyle = J.text,
  e.fillText(a, r, o), Sr(e, { x: r, y: o, w: i, h: s, r: 3 }), e.fillStyle = `${J[t]}dd`, e.fill(), e.strokeStyle = J[t], e.stroke(), e.fillStyle =
  J.text, e.fillText(a, r, o), { x: r, y: o, w: i, h: s };
}
n(Ar, "textWithRect");
function Rr(e, t) {
  e.font = "600 12px monospace", e.textBaseline = "middle", e.textAlign = "center";
  let r = e.measureText(t), o = r.actualBoundingBoxAscent + r.actualBoundingBoxDescent, i = r.width + G * 2, s = o + G * 2;
  return { w: i, h: s };
}
n(Rr, "configureText");
function on(e, t, { type: r, position: o = "center", text: i }, s, a = !1) {
  let { x: p, y: c } = Qo(o, t), { offsetX: l, offsetY: y } = en(r, o, t, G + 1, a);
  p += l, c += y;
  let { w: u, h } = Rr(e, i);
  if (s && tn({ x: p, y: c, w: u, h }, s)) {
    let T = rn(o, { x: p, y: c, w: u, h }, s);
    p = T.x, c = T.y;
  }
  return Ar(e, r, { x: p, y: c, w: u, h }, i);
}
n(on, "drawLabel");
function nn(e, { w: t, h: r }) {
  let o = t * 0.5 + G, i = r * 0.5 + G;
  return {
    offsetX: (e.x === "left" ? -1 : 1) * o,
    offsetY: (e.y === "top" ? -1 : 1) * i
  };
}
n(nn, "floatingOffset");
function sn(e, t, { type: r, text: o }) {
  let { floatingAlignment: i, extremities: s } = t, a = s[i.x], p = s[i.y], { w: c, h: l } = Rr(e, o), { offsetX: y, offsetY: u } = nn(i, {
    w: c,
    h: l
  });
  return a += y, p += u, Ar(e, r, { x: a, y: p, w: c, h: l }, o);
}
n(sn, "drawFloatingLabel");
function pe(e, t, r, o) {
  let i = [];
  r.forEach((s, a) => {
    let p = o && s.position === "center" ? sn(e, t, s) : on(e, t, s, i[a - 1], o);
    i[a] = p;
  });
}
n(pe, "drawStack");
function wr(e, t, r, o) {
  let i = r.reduce((s, a) => (Object.prototype.hasOwnProperty.call(s, a.position) || (s[a.position] = []), s[a.position]?.push(a), s), {});
  i.top && pe(e, t, i.top, o), i.right && pe(e, t, i.right, o), i.bottom && pe(e, t, i.bottom, o), i.left && pe(e, t, i.left, o), i.center &&
  pe(e, t, i.center, o);
}
n(wr, "labelStacks");

// src/measure/box-model/visualizer.ts
var Te = {
  margin: "#f6b26ba8",
  border: "#ffe599a8",
  padding: "#93c47d8c",
  content: "#6fa8dca8"
}, Er = 30;
function _(e) {
  return parseInt(e.replace("px", ""), 10);
}
n(_, "pxToNumber");
function Q(e) {
  return Number.isInteger(e) ? e : e.toFixed(2);
}
n(Q, "round");
function pt(e) {
  return e.filter((t) => t.text !== 0 && t.text !== "0");
}
n(pt, "filterZeroValues");
function an(e) {
  let t = {
    top: j.window.scrollY,
    bottom: j.window.scrollY + j.window.innerHeight,
    left: j.window.scrollX,
    right: j.window.scrollX + j.window.innerWidth
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
n(an, "floatingAlignment");
function pn(e) {
  let t = j.getComputedStyle(e), { top: r, left: o, right: i, bottom: s, width: a, height: p } = e.getBoundingClientRect(), {
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
  r = r + j.window.scrollY, o = o + j.window.scrollX, s = s + j.window.scrollY, i = i + j.window.scrollX;
  let S = {
    top: _(c),
    bottom: _(l),
    left: _(y),
    right: _(u)
  }, v = {
    top: _(h),
    bottom: _(T),
    left: _(R),
    right: _(P)
  }, w = {
    top: _(O),
    bottom: _(L),
    left: _(F),
    right: _(A)
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
    floatingAlignment: an(d)
  };
}
n(pn, "measureElement");
function ln(e, { margin: t, width: r, height: o, top: i, left: s, bottom: a, right: p }) {
  let c = o + t.bottom + t.top;
  e.fillStyle = Te.margin, e.fillRect(s, i - t.top, r, t.top), e.fillRect(p, i - t.top, t.right, c), e.fillRect(s, a, r, t.bottom), e.fillRect(
  s - t.left, i - t.top, t.left, c);
  let l = [
    {
      type: "margin",
      text: Q(t.top),
      position: "top"
    },
    {
      type: "margin",
      text: Q(t.right),
      position: "right"
    },
    {
      type: "margin",
      text: Q(t.bottom),
      position: "bottom"
    },
    {
      type: "margin",
      text: Q(t.left),
      position: "left"
    }
  ];
  return pt(l);
}
n(ln, "drawMargin");
function cn(e, { padding: t, border: r, width: o, height: i, top: s, left: a, bottom: p, right: c }) {
  let l = o - r.left - r.right, y = i - t.top - t.bottom - r.top - r.bottom;
  e.fillStyle = Te.padding, e.fillRect(a + r.left, s + r.top, l, t.top), e.fillRect(
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
  return pt(u);
}
n(cn, "drawPadding");
function dn(e, { border: t, width: r, height: o, top: i, left: s, bottom: a, right: p }) {
  let c = o - t.top - t.bottom;
  e.fillStyle = Te.border, e.fillRect(s, i, r, t.top), e.fillRect(s, a - t.bottom, r, t.bottom), e.fillRect(s, i + t.top, t.left, c), e.fillRect(
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
  return pt(l);
}
n(dn, "drawBorder");
function mn(e, { padding: t, border: r, width: o, height: i, top: s, left: a }) {
  let p = o - r.left - r.right - t.left - t.right, c = i - t.top - t.bottom - r.top - r.bottom;
  return e.fillStyle = Te.content, e.fillRect(
    a + r.left + t.left,
    s + r.top + t.top,
    p,
    c
  ), [
    {
      type: "content",
      position: "center",
      text: `${Q(p)} x ${Q(c)}`
    }
  ];
}
n(mn, "drawContent");
function un(e) {
  return (t) => {
    if (e && t) {
      let r = pn(e), o = ln(t, r), i = cn(t, r), s = dn(t, r), a = mn(t, r), p = r.width <= Er * 3 || r.height <= Er;
      wr(
        t,
        r,
        [...a, ...i, ...s, ...o],
        p
      );
    }
  };
}
n(un, "drawBoxModel");
function Cr(e) {
  xr(un(e));
}
n(Cr, "drawSelectedElement");

// src/measure/util.ts
import { global as fn } from "@storybook/global";
var vr = /* @__PURE__ */ n((e, t) => {
  let r = fn.document.elementFromPoint(e, t), o = /* @__PURE__ */ n((s) => {
    if (s && s.shadowRoot) {
      let a = s.shadowRoot.elementFromPoint(e, t);
      return s.isEqualNode(a) ? s : a.shadowRoot ? o(a) : a;
    }
    return s;
  }, "crawlShadows");
  return o(r) || r;
}, "deepElementFromPoint");

// src/measure/withMeasure.ts
var Pr, Se = { x: 0, y: 0 };
function Or(e, t) {
  Pr = vr(e, t), Cr(Pr);
}
n(Or, "findAndDrawElement");
var Mr = /* @__PURE__ */ n((e, t) => {
  let { measureEnabled: r } = t.globals || {};
  return kr(() => {
    if (typeof globalThis.document > "u")
      return;
    let o = /* @__PURE__ */ n((i) => {
      window.requestAnimationFrame(() => {
        i.stopPropagation(), Se.x = i.clientX, Se.y = i.clientY;
      });
    }, "onPointerMove");
    return globalThis.document.addEventListener("pointermove", o), () => {
      globalThis.document.removeEventListener("pointermove", o);
    };
  }, []), kr(() => {
    let o = /* @__PURE__ */ n((s) => {
      window.requestAnimationFrame(() => {
        s.stopPropagation(), Or(s.clientX, s.clientY);
      });
    }, "onPointerOver"), i = /* @__PURE__ */ n(() => {
      window.requestAnimationFrame(() => {
        br();
      });
    }, "onResize");
    return t.viewMode === "story" && r && (globalThis.document.addEventListener("pointerover", o), gr(), globalThis.window.addEventListener(
    "resize", i), Or(Se.x, Se.y)), () => {
      globalThis.window.removeEventListener("resize", i), Tr();
    };
  }, [r, t.viewMode]), e();
}, "withMeasure");

// src/measure/preview.ts
var gn = globalThis.FEATURES?.measure ? [Mr] : [], hn = {
  [fr]: !1
}, lt = /* @__PURE__ */ n(() => yn({
  decorators: gn,
  initialGlobals: hn
}), "default");

// src/outline/preview.ts
import { definePreviewAddon as Sn } from "storybook/internal/csf";

// src/outline/constants.ts
var Ae = "outline";

// src/outline/withOutline.ts
import { useEffect as bn, useMemo as Tn } from "storybook/preview-api";

// src/outline/helpers.ts
import { global as Re } from "@storybook/global";
var ct = /* @__PURE__ */ n((e) => {
  (Array.isArray(e) ? e : [e]).forEach(xn);
}, "clearStyles"), xn = /* @__PURE__ */ n((e) => {
  let t = typeof e == "string" ? e : e.join(""), r = Re.document.getElementById(t);
  r && r.parentElement && r.parentElement.removeChild(r);
}, "clearStyle"), $r = /* @__PURE__ */ n((e, t) => {
  let r = Re.document.getElementById(e);
  if (r)
    r.innerHTML !== t && (r.innerHTML = t);
  else {
    let o = Re.document.createElement("style");
    o.setAttribute("id", e), o.innerHTML = t, Re.document.head.appendChild(o);
  }
}, "addOutlineStyles");

// src/outline/outlineCSS.ts
function dt(e) {
  return W`
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
n(dt, "outlineCSS");

// src/outline/withOutline.ts
var Fr = /* @__PURE__ */ n((e, t) => {
  let r = t.globals || {}, o = [!0, "true"].includes(r[Ae]), i = t.viewMode === "docs", s = Tn(() => dt(i ? '[data-story-block="true"]' : ".\
sb-show-main"), [t]);
  return bn(() => {
    let a = i ? `addon-outline-docs-${t.id}` : "addon-outline";
    return o ? $r(a, s) : ct(a), () => {
      ct(a);
    };
  }, [o, s, t]), e();
}, "withOutline");

// src/outline/preview.ts
var An = globalThis.FEATURES?.outline ? [Fr] : [], Rn = {
  [Ae]: !1
}, mt = /* @__PURE__ */ n(() => Sn({ decorators: An, initialGlobals: Rn }), "default");

// src/test/preview.ts
import { definePreviewAddon as wn } from "storybook/internal/csf";
import { instrument as En } from "storybook/internal/instrumenter";
import {
  clearAllMocks as Cn,
  fn as vn,
  isMockFunction as kn,
  resetAllMocks as Pn,
  restoreAllMocks as On,
  uninstrumentedUserEvent as Mn,
  within as $n
} from "storybook/test";
var Fn = /* @__PURE__ */ n(({ parameters: e }) => {
  e?.test?.mockReset === !0 ? Pn() : e?.test?.clearMocks === !0 ? Cn() : e?.test?.restoreMocks !== !1 && On();
}, "resetAllMocksLoader"), ut = /* @__PURE__ */ n((e, t = 0, r) => {
  if (t > 5 || e == null)
    return e;
  if (kn(e))
    return r && e.mockName(r), e;
  if (typeof e == "function" && "isAction" in e && e.isAction && !("implicit" in e && e.implicit)) {
    let o = vn(e);
    return r && o.mockName(r), o;
  }
  if (Array.isArray(e)) {
    t++;
    for (let o = 0; o < e.length; o++)
      Object.getOwnPropertyDescriptor(e, o)?.writable && (e[o] = ut(e[o], t));
    return e;
  }
  if (typeof e == "object" && e.constructor === Object) {
    t++;
    for (let [o, i] of Object.entries(e))
      Object.getOwnPropertyDescriptor(e, o)?.writable && (e[o] = ut(i, t, o));
    return e;
  }
  return e;
}, "traverseArgs"), In = /* @__PURE__ */ n(({ initialArgs: e }) => {
  ut(e);
}, "nameSpiesAndWrapActionsInSpies"), Ir = !1, Ln = /* @__PURE__ */ n(async (e) => {
  globalThis.HTMLElement && e.canvasElement instanceof globalThis.HTMLElement && (e.canvas = $n(e.canvasElement));
  let t = globalThis.window?.navigator?.clipboard;
  if (t) {
    e.userEvent = En(
      { userEvent: Mn.setup() },
      {
        intercept: !0,
        getKeys: /* @__PURE__ */ n((o) => Object.keys(o).filter((i) => i !== "eventWrapper"), "getKeys")
      }
    ).userEvent, Object.defineProperty(globalThis.window.navigator, "clipboard", {
      get: /* @__PURE__ */ n(() => t, "get"),
      configurable: !0
    });
    let r = HTMLElement.prototype.focus;
    Ir || Object.defineProperties(HTMLElement.prototype, {
      focus: {
        configurable: !0,
        set: /* @__PURE__ */ n((o) => {
          r = o, Ir = !0;
        }, "set"),
        get: /* @__PURE__ */ n(() => r, "get")
      }
    });
  }
}, "enhanceContext"), ft = /* @__PURE__ */ n(() => wn({
  loaders: [Fn, In, Ln]
}), "default");

// src/viewport/preview.ts
import { definePreviewAddon as Dn } from "storybook/internal/csf";

// src/viewport/constants.ts
var Lr = "storybook/viewport", Dr = "viewport", Ll = `${Lr}/panel`, Dl = `${Lr}/tool`;

// src/viewport/preview.ts
var _n = {
  [Dr]: { value: void 0, isRotated: !1 }
}, yt = /* @__PURE__ */ n(() => Dn({
  initialGlobals: _n
}), "default");

// src/csf/core-annotations.ts
function _r() {
  return [
    // @ts-expect-error CJS fallback
    (lt.default ?? lt)(),
    // @ts-expect-error CJS fallback
    (Je.default ?? Je)(),
    // @ts-expect-error CJS fallback
    (st.default ?? st)(),
    // @ts-expect-error CJS fallback
    (mt.default ?? mt)(),
    // @ts-expect-error CJS fallback
    (yt.default ?? yt)(),
    // @ts-expect-error CJS fallback
    (Xe.default ?? Xe)(),
    // @ts-expect-error CJS fallback
    (Qe.default ?? Qe)(),
    // @ts-expect-error CJS fallback
    (ft.default ?? ft)()
  ];
}
n(_r, "getCoreAnnotations");

// src/csf/csf-factories.ts
function tc(e) {
  let t, r = {
    _tag: "Preview",
    input: e,
    get composed() {
      if (t)
        return t;
      let { addons: o, ...i } = e;
      return t = te(
        ne([..._r(), ...o ?? [], i])
      ), t;
    },
    meta(o) {
      return Nn(o, this);
    }
  };
  return globalThis.globalProjectAnnotations = r.composed, r;
}
n(tc, "definePreview");
function rc(e) {
  return e;
}
n(rc, "definePreviewAddon");
function oc(e) {
  return e != null && typeof e == "object" && "_tag" in e && e?._tag === "Preview";
}
n(oc, "isPreview");
function nc(e) {
  return e != null && typeof e == "object" && "_tag" in e && e?._tag === "Meta";
}
n(nc, "isMeta");
function Nn(e, t) {
  return {
    _tag: "Meta",
    input: e,
    preview: t,
    get composed() {
      throw new Error("Not implemented");
    },
    // @ts-expect-error hard
    story(r = {}) {
      return Hr(typeof r == "function" ? { render: r } : r, this);
    }
  };
}
n(Nn, "defineMeta");
function ic(e) {
  return e != null && typeof e == "object" && "_tag" in e && e?._tag === "Story";
}
n(ic, "isStory");
function Hr(e, t) {
  let r, o = /* @__PURE__ */ n(() => (r || (r = We(
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
      return Hr(
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
          tags: Hn(...this.input.tags ?? [], ...i.tags ?? [])
        },
        this.meta
      );
    }
  };
}
n(Hr, "defineStory");

// src/csf/index.ts
var jn = /* @__PURE__ */ n((e) => e.toLowerCase().replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "-").replace(/-+/g,
"-").replace(/^-+/, "").replace(/-+$/, ""), "sanitize"), Nr = /* @__PURE__ */ n((e, t) => {
  let r = jn(e);
  if (r === "")
    throw new Error(`Invalid ${t} '${e}', must include alphanumeric characters`);
  return r;
}, "sanitizeSafe"), lc = /* @__PURE__ */ n((e, t) => `${Nr(e, "kind")}${t ? `--${Nr(t, "name")}` : ""}`, "toId"), cc = /* @__PURE__ */ n((e) => bt(
e), "storyNameFromExport");
function jr(e, t) {
  return Array.isArray(t) ? t.includes(e) : e.match(t);
}
n(jr, "matches");
function dc(e, { includeStories: t, excludeStories: r }) {
  return (
    // https://babeljs.io/docs/en/babel-plugin-transform-modules-commonjs
    e !== "__esModule" && (!t || jr(e, t)) && (!r || !jr(e, r))
  );
}
n(dc, "isExportStory");
var mc = /* @__PURE__ */ n((e, { rootSeparator: t, groupSeparator: r }) => {
  let [o, i] = e.split(t, 2), s = (i || e).split(r).filter((a) => !!a);
  return {
    root: i ? o : null,
    groups: s
  };
}, "parseKind"), uc = /* @__PURE__ */ n((...e) => {
  let t = e.reduce((r, o) => (o.startsWith("!") ? r.delete(o.slice(1)) : r.add(o), r), /* @__PURE__ */ new Set());
  return Array.from(t);
}, "combineTags");
export {
  uc as combineTags,
  tc as definePreview,
  rc as definePreviewAddon,
  _r as getCoreAnnotations,
  Xr as includeConditionalArg,
  dc as isExportStory,
  nc as isMeta,
  oc as isPreview,
  ic as isStory,
  mc as parseKind,
  jn as sanitize,
  cc as storyNameFromExport,
  lc as toId
};
