var D = Object.defineProperty;
var r = (e, n) => D(e, "name", { value: n, configurable: !0 });

// src/actions/decorator.ts
import { makeDecorator as P, useEffect as x } from "storybook/preview-api";

// src/actions/constants.ts
var h = "actions", y = "storybook/actions", $ = `${y}/panel`, g = `${y}/action-event`, B = `${y}/action-clear`;

// src/actions/runtime/action.ts
import { ImplicitActionsDuringRendering as R } from "storybook/internal/preview-errors";
import { global as E } from "@storybook/global";
import { addons as S } from "storybook/preview-api";

// src/actions/runtime/configureActions.ts
var a = {
  depth: 10,
  clearOnStoryChange: !0,
  limit: 50
};

// src/actions/runtime/action.ts
var A = /* @__PURE__ */ r((e, n) => {
  let t = Object.getPrototypeOf(e);
  return !t || n(t) ? t : A(t, n);
}, "findProto"), j = /* @__PURE__ */ r((e) => !!(typeof e == "object" && e && A(e, (n) => /^Synthetic(?:Base)?Event$/.test(n.constructor.name)) &&
typeof e.persist == "function"), "isReactSyntheticEvent"), I = /* @__PURE__ */ r((e) => {
  if (j(e)) {
    let n = Object.create(
      e.constructor.prototype,
      Object.getOwnPropertyDescriptors(e)
    );
    n.persist();
    let t = Object.getOwnPropertyDescriptor(n, "view"), o = t?.value;
    return typeof o == "object" && o?.constructor.name === "Window" && Object.defineProperty(n, "view", {
      ...t,
      value: Object.create(o.constructor.prototype)
    }), n;
  }
  return e;
}, "serializeArg");
function O(e, n = {}) {
  let t = {
    ...a,
    ...n
  }, o = /* @__PURE__ */ r(function(...i) {
    if (n.implicit) {
      let d = ("__STORYBOOK_PREVIEW__" in E ? E.__STORYBOOK_PREVIEW__ : void 0)?.storyRenders.find(
        (c) => c.phase === "playing" || c.phase === "rendering"
      );
      if (d) {
        let c = !globalThis?.FEATURES?.disallowImplicitActionsInRenderV8, u = new R({
          phase: d.phase,
          name: e,
          deprecated: c
        });
        if (c)
          console.warn(u);
        else
          throw u;
      }
    }
    let m = S.getChannel(), p = Date.now().toString(36) + Math.random().toString(36).substring(2), l = 5, f = i.map(I), w = i.length > 1 ? f :
    f[0], _ = {
      id: p,
      count: 0,
      data: { name: e, args: w },
      options: {
        ...t,
        maxDepth: l + (t.depth || 3)
      }
    };
    m.emit(g, _);
  }, "actionHandler");
  return o.isAction = !0, o.implicit = n.implicit, o;
}
r(O, "action");

// src/actions/runtime/actions.ts
var b = /* @__PURE__ */ r((...e) => {
  let n = a, t = e;
  t.length === 1 && Array.isArray(t[0]) && ([t] = t), t.length !== 1 && typeof t[t.length - 1] != "string" && (n = {
    ...a,
    ...t.pop()
  });
  let o = t[0];
  (t.length !== 1 || typeof o == "string") && (o = {}, t.forEach((i) => {
    o[i] = i;
  }));
  let s = {};
  return Object.keys(o).forEach((i) => {
    s[i] = O(o[i], n);
  }), s;
}, "actions");

// src/actions/decorator.ts
var T = /^(\S+)\s*(.*)$/, k = Element != null && !Element.prototype.matches, F = k ? "msMatchesSelector" : "matches", v = /* @__PURE__ */ r(
(e, n) => {
  if (e[F](n))
    return !0;
  let t = e.parentElement;
  return t ? v(t, n) : !1;
}, "hasMatchInAncestry"), M = /* @__PURE__ */ r((e, ...n) => {
  let t = e(...n);
  return Object.entries(t).map(([o, s]) => {
    let [i, m, p] = o.match(T) || [];
    return {
      eventName: m,
      handler: /* @__PURE__ */ r((l) => {
        (!p || v(l.target, p)) && s(l);
      }, "handler")
    };
  });
}, "createHandlers"), C = /* @__PURE__ */ r((e, ...n) => {
  let t = typeof globalThis.document < "u" && globalThis.document.getElementById("storybook-root");
  x(() => {
    if (t) {
      let o = M(e, ...n);
      return o.forEach(({ eventName: s, handler: i }) => t.addEventListener(s, i)), () => o.forEach(({ eventName: s, handler: i }) => t.removeEventListener(
      s, i));
    }
  }, [t, e, n]);
}, "applyEventHandlers"), rt = P({
  name: "withActions",
  parameterName: h,
  skipIfNoParametersOrOptions: !0,
  wrapper: /* @__PURE__ */ r((e, n, { parameters: t }) => (t?.handles && C(b, ...t.handles), e(n)), "wrapper")
});
export {
  rt as withActions
};
