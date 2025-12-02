var w = Object.defineProperty;
var i = (o, n) => w(o, "name", { value: n, configurable: !0 });

// src/actions/constants.ts
var S = "actions", a = "storybook/actions", I = `${a}/panel`, y = `${a}/action-event`, P = `${a}/action-clear`, T = "$___storybook.isCyclic";

// src/actions/runtime/action.ts
import { ImplicitActionsDuringRendering as _ } from "storybook/internal/preview-errors";
import { global as d } from "@storybook/global";
import { addons as v } from "storybook/preview-api";

// src/actions/runtime/configureActions.ts
var c = {
  depth: 10,
  clearOnStoryChange: !0,
  limit: 50
}, C = /* @__PURE__ */ i((o = {}) => {
  Object.assign(c, o);
}, "configureActions");

// src/actions/runtime/action.ts
var u = /* @__PURE__ */ i((o, n) => {
  let t = Object.getPrototypeOf(o);
  return !t || n(t) ? t : u(t, n);
}, "findProto"), D = /* @__PURE__ */ i((o) => !!(typeof o == "object" && o && u(o, (n) => /^Synthetic(?:Base)?Event$/.test(n.constructor.name)) &&
typeof o.persist == "function"), "isReactSyntheticEvent"), x = /* @__PURE__ */ i((o) => {
  if (D(o)) {
    let n = Object.create(
      o.constructor.prototype,
      Object.getOwnPropertyDescriptors(o)
    );
    n.persist();
    let t = Object.getOwnPropertyDescriptor(n, "view"), e = t?.value;
    return typeof e == "object" && e?.constructor.name === "Window" && Object.defineProperty(n, "view", {
      ...t,
      value: Object.create(e.constructor.prototype)
    }), n;
  }
  return o;
}, "serializeArg");
function g(o, n = {}) {
  let t = {
    ...c,
    ...n
  }, e = /* @__PURE__ */ i(function(...r) {
    if (n.implicit) {
      let m = ("__STORYBOOK_PREVIEW__" in d ? d.__STORYBOOK_PREVIEW__ : void 0)?.storyRenders.find(
        (s) => s.phase === "playing" || s.phase === "rendering"
      );
      if (m) {
        let s = !globalThis?.FEATURES?.disallowImplicitActionsInRenderV8, f = new _({
          phase: m.phase,
          name: o,
          deprecated: s
        });
        if (s)
          console.warn(f);
        else
          throw f;
      }
    }
    let O = v.getChannel(), h = Date.now().toString(36) + Math.random().toString(36).substring(2), A = 5, l = r.map(x), E = r.length > 1 ? l :
    l[0], b = {
      id: h,
      count: 0,
      data: { name: o, args: E },
      options: {
        ...t,
        maxDepth: A + (t.depth || 3)
      }
    };
    O.emit(y, b);
  }, "actionHandler");
  return e.isAction = !0, e.implicit = n.implicit, e;
}
i(g, "action");

// src/actions/runtime/actions.ts
var L = /* @__PURE__ */ i((...o) => {
  let n = c, t = o;
  t.length === 1 && Array.isArray(t[0]) && ([t] = t), t.length !== 1 && typeof t[t.length - 1] != "string" && (n = {
    ...c,
    ...t.pop()
  });
  let e = t[0];
  (t.length !== 1 || typeof e == "string") && (e = {}, t.forEach((r) => {
    e[r] = r;
  }));
  let p = {};
  return Object.keys(e).forEach((r) => {
    p[r] = g(e[r], n);
  }), p;
}, "actions");
export {
  a as ADDON_ID,
  P as CLEAR_ID,
  T as CYCLIC_KEY,
  y as EVENT_ID,
  I as PANEL_ID,
  S as PARAM_KEY,
  g as action,
  L as actions,
  c as config,
  C as configureActions
};
