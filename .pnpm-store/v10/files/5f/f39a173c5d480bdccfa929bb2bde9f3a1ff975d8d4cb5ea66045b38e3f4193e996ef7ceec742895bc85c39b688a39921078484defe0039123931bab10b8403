"use strict";
var a = Object.defineProperty;
var D = Object.getOwnPropertyDescriptor;
var x = Object.getOwnPropertyNames;
var R = Object.prototype.hasOwnProperty;
var i = (t, o) => a(t, "name", { value: o, configurable: !0 });
var j = (t, o) => {
  for (var n in o)
    a(t, n, { get: o[n], enumerable: !0 });
}, S = (t, o, n, e) => {
  if (o && typeof o == "object" || typeof o == "function")
    for (let r of x(o))
      !R.call(t, r) && r !== n && a(t, r, { get: () => o[r], enumerable: !(e = D(o, r)) || e.enumerable });
  return t;
};
var I = (t) => S(a({}, "__esModule", { value: !0 }), t);

// src/actions/index.ts
var $ = {};
j($, {
  ADDON_ID: () => l,
  CLEAR_ID: () => k,
  CYCLIC_KEY: () => C,
  EVENT_ID: () => m,
  PANEL_ID: () => T,
  PARAM_KEY: () => P,
  action: () => y,
  actions: () => Y,
  config: () => s,
  configureActions: () => F
});
module.exports = I($);

// src/actions/constants.ts
var P = "actions", l = "storybook/actions", T = `${l}/panel`, m = `${l}/action-event`, k = `${l}/action-clear`, C = "$___storybook.isCyclic";

// src/actions/runtime/action.ts
var O = require("storybook/internal/preview-errors"), f = require("@storybook/global"), h = require("storybook/preview-api");

// src/actions/runtime/configureActions.ts
var s = {
  depth: 10,
  clearOnStoryChange: !0,
  limit: 50
}, F = /* @__PURE__ */ i((t = {}) => {
  Object.assign(s, t);
}, "configureActions");

// src/actions/runtime/action.ts
var A = /* @__PURE__ */ i((t, o) => {
  let n = Object.getPrototypeOf(t);
  return !n || o(n) ? n : A(n, o);
}, "findProto"), V = /* @__PURE__ */ i((t) => !!(typeof t == "object" && t && A(t, (o) => /^Synthetic(?:Base)?Event$/.test(o.constructor.name)) &&
typeof t.persist == "function"), "isReactSyntheticEvent"), W = /* @__PURE__ */ i((t) => {
  if (V(t)) {
    let o = Object.create(
      t.constructor.prototype,
      Object.getOwnPropertyDescriptors(t)
    );
    o.persist();
    let n = Object.getOwnPropertyDescriptor(o, "view"), e = n?.value;
    return typeof e == "object" && e?.constructor.name === "Window" && Object.defineProperty(o, "view", {
      ...n,
      value: Object.create(e.constructor.prototype)
    }), o;
  }
  return t;
}, "serializeArg");
function y(t, o = {}) {
  let n = {
    ...s,
    ...o
  }, e = /* @__PURE__ */ i(function(...c) {
    if (o.implicit) {
      let u = ("__STORYBOOK_PREVIEW__" in f.global ? f.global.__STORYBOOK_PREVIEW__ : void 0)?.storyRenders.find(
        (p) => p.phase === "playing" || p.phase === "rendering"
      );
      if (u) {
        let p = !globalThis?.FEATURES?.disallowImplicitActionsInRenderV8, g = new O.ImplicitActionsDuringRendering({
          phase: u.phase,
          name: t,
          deprecated: p
        });
        if (p)
          console.warn(g);
        else
          throw g;
      }
    }
    let E = h.addons.getChannel(), b = Date.now().toString(36) + Math.random().toString(36).substring(2), w = 5, d = c.map(W), _ = c.length >
    1 ? d : d[0], v = {
      id: b,
      count: 0,
      data: { name: t, args: _ },
      options: {
        ...n,
        maxDepth: w + (n.depth || 3)
      }
    };
    E.emit(m, v);
  }, "actionHandler");
  return e.isAction = !0, e.implicit = o.implicit, e;
}
i(y, "action");

// src/actions/runtime/actions.ts
var Y = /* @__PURE__ */ i((...t) => {
  let o = s, n = t;
  n.length === 1 && Array.isArray(n[0]) && ([n] = n), n.length !== 1 && typeof n[n.length - 1] != "string" && (o = {
    ...s,
    ...n.pop()
  });
  let e = n[0];
  (n.length !== 1 || typeof e == "string") && (e = {}, n.forEach((c) => {
    e[c] = c;
  }));
  let r = {};
  return Object.keys(e).forEach((c) => {
    r[c] = y(e[c], o);
  }), r;
}, "actions");
