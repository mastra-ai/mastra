"use strict";
var p = Object.defineProperty;
var d = Object.getOwnPropertyDescriptor;
var b = Object.getOwnPropertyNames;
var C = Object.prototype.hasOwnProperty;
var i = (s, e) => p(s, "name", { value: e, configurable: !0 });
var x = (s, e) => {
  for (var t in e)
    p(s, t, { get: e[t], enumerable: !0 });
}, w = (s, e, t, r) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let l of b(e))
      !C.call(s, l) && l !== t && p(s, l, { get: () => e[l], enumerable: !(r = d(e, l)) || r.enumerable });
  return s;
};
var M = (s) => w(p({}, "__esModule", { value: !0 }), s);

// src/core-server/presets/webpack/loaders/storybook-mock-transform-loader.ts
var O = {};
x(O, {
  default: () => D
});
module.exports = M(O);
var _ = require("storybook/internal/node-logger");

// src/core-server/mocking-utils/extract.ts
var P = require("node:fs"), h = require("storybook/internal/babel"), E = require("storybook/internal/node-logger"), j = require("storybook/internal/telemetry"),
L = require("esbuild");

// ../node_modules/estree-walker/src/walker.js
var m = class {
  static {
    i(this, "WalkerBase");
  }
  constructor() {
    this.should_skip = !1, this.should_remove = !1, this.replacement = null, this.context = {
      skip: /* @__PURE__ */ i(() => this.should_skip = !0, "skip"),
      remove: /* @__PURE__ */ i(() => this.should_remove = !0, "remove"),
      replace: /* @__PURE__ */ i((e) => this.replacement = e, "replace")
    };
  }
  /**
   * @template {Node} Parent
   * @param {Parent | null | undefined} parent
   * @param {keyof Parent | null | undefined} prop
   * @param {number | null | undefined} index
   * @param {Node} node
   */
  replace(e, t, r, l) {
    e && t && (r != null ? e[t][r] = l : e[t] = l);
  }
  /**
   * @template {Node} Parent
   * @param {Parent | null | undefined} parent
   * @param {keyof Parent | null | undefined} prop
   * @param {number | null | undefined} index
   */
  remove(e, t, r) {
    e && t && (r != null ? e[t].splice(r, 1) : delete e[t]);
  }
};

// ../node_modules/estree-walker/src/sync.js
var f = class extends m {
  static {
    i(this, "SyncWalker");
  }
  /**
   *
   * @param {SyncHandler} [enter]
   * @param {SyncHandler} [leave]
   */
  constructor(e, t) {
    super(), this.should_skip = !1, this.should_remove = !1, this.replacement = null, this.context = {
      skip: /* @__PURE__ */ i(() => this.should_skip = !0, "skip"),
      remove: /* @__PURE__ */ i(() => this.should_remove = !0, "remove"),
      replace: /* @__PURE__ */ i((r) => this.replacement = r, "replace")
    }, this.enter = e, this.leave = t;
  }
  /**
   * @template {Node} Parent
   * @param {Node} node
   * @param {Parent | null} parent
   * @param {keyof Parent} [prop]
   * @param {number | null} [index]
   * @returns {Node | null}
   */
  visit(e, t, r, l) {
    if (e) {
      if (this.enter) {
        let o = this.should_skip, c = this.should_remove, a = this.replacement;
        this.should_skip = !1, this.should_remove = !1, this.replacement = null, this.enter.call(this.context, e, t, r, l), this.replacement &&
        (e = this.replacement, this.replace(t, r, l, e)), this.should_remove && this.remove(t, r, l);
        let u = this.should_skip, k = this.should_remove;
        if (this.should_skip = o, this.should_remove = c, this.replacement = a, u) return e;
        if (k) return null;
      }
      let n;
      for (n in e) {
        let o = e[n];
        if (o && typeof o == "object")
          if (Array.isArray(o)) {
            let c = (
              /** @type {Array<unknown>} */
              o
            );
            for (let a = 0; a < c.length; a += 1) {
              let u = c[a];
              y(u) && (this.visit(u, e, n, a) || a--);
            }
          } else y(o) && this.visit(o, e, n, null);
      }
      if (this.leave) {
        let o = this.replacement, c = this.should_remove;
        this.replacement = null, this.should_remove = !1, this.leave.call(this.context, e, t, r, l), this.replacement && (e = this.replacement,
        this.replace(t, r, l, e)), this.should_remove && this.remove(t, r, l);
        let a = this.should_remove;
        if (this.replacement = o, this.should_remove = c, a) return null;
      }
    }
    return e;
  }
};
function y(s) {
  return s !== null && typeof s == "object" && "type" in s && typeof s.type == "string";
}
i(y, "isNode");

// ../node_modules/estree-walker/src/index.js
function g(s, { enter: e, leave: t }) {
  return new f(e, t).visit(s, null);
}
i(g, "walk");

// src/core-server/mocking-utils/extract.ts
var I = /* @__PURE__ */ i((s) => h.parser.parse(s, {
  sourceType: "module",
  // Enable plugins to handle modern JavaScript features, including TSX.
  plugins: ["typescript", "jsx", "classProperties", "objectRestSpread"],
  errorRecovery: !0
}).program, "babelParser");
function v(s) {
  let e = I(s);
  return g(e, {
    enter(t) {
      t.type === "CallExpression" && t.callee.type === "MemberExpression" && t.callee.object.type === "Identifier" && t.callee.object.name ===
      "sb" && t.callee.property.type === "Identifier" && t.callee.property.name === "mock" && t.arguments.length > 0 && t.arguments[0].type ===
      "CallExpression" && t.arguments[0].callee.type === "Import" && t.arguments[0].arguments.length === 1 && t.arguments[0].arguments[0].type ===
      "StringLiteral" && (t.arguments[0] = h.types.stringLiteral(t.arguments[0].arguments[0].value));
    }
  }), (0, h.generate)(e, {}, s);
}
i(v, "rewriteSbMockImportCalls");

// src/core-server/presets/webpack/loaders/storybook-mock-transform-loader.ts
var S = /* @__PURE__ */ i(function(e, t, r) {
  let l = this.async();
  try {
    let n = v(e);
    l(null, n.code, n.map || void 0, r);
  } catch (n) {
    let o = this.resourcePath;
    _.logger.debug(`Could not transform sb.mock(import(...)) calls in ${o}: ${n}`), l(null, e, t, r);
  }
}, "mockTransformLoaderFn"), D = S;
