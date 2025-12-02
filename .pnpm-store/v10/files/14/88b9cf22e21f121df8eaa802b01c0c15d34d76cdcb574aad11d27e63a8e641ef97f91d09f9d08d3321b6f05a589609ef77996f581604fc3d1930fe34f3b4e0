import ESM_COMPAT_Module from "node:module";
import { fileURLToPath as ESM_COMPAT_fileURLToPath } from 'node:url';
import { dirname as ESM_COMPAT_dirname } from 'node:path';
const __filename = ESM_COMPAT_fileURLToPath(import.meta.url);
const __dirname = ESM_COMPAT_dirname(__filename);
const require = ESM_COMPAT_Module.createRequire(import.meta.url);
var v = Object.defineProperty;
var r = (i, e) => v(i, "name", { value: e, configurable: !0 });

// src/core-server/presets/webpack/loaders/storybook-mock-transform-loader.ts
import { logger as C } from "storybook/internal/node-logger";

// src/core-server/mocking-utils/extract.ts
import { readFileSync as N } from "node:fs";
import { generate as _, parser as k, types as d } from "storybook/internal/babel";
import { logger as z } from "storybook/internal/node-logger";
import { telemetry as q } from "storybook/internal/telemetry";
import { transformSync as H } from "esbuild";

// ../node_modules/estree-walker/src/walker.js
var h = class {
  static {
    r(this, "WalkerBase");
  }
  constructor() {
    this.should_skip = !1, this.should_remove = !1, this.replacement = null, this.context = {
      skip: /* @__PURE__ */ r(() => this.should_skip = !0, "skip"),
      remove: /* @__PURE__ */ r(() => this.should_remove = !0, "remove"),
      replace: /* @__PURE__ */ r((e) => this.replacement = e, "replace")
    };
  }
  /**
   * @template {Node} Parent
   * @param {Parent | null | undefined} parent
   * @param {keyof Parent | null | undefined} prop
   * @param {number | null | undefined} index
   * @param {Node} node
   */
  replace(e, t, s, l) {
    e && t && (s != null ? e[t][s] = l : e[t] = l);
  }
  /**
   * @template {Node} Parent
   * @param {Parent | null | undefined} parent
   * @param {keyof Parent | null | undefined} prop
   * @param {number | null | undefined} index
   */
  remove(e, t, s) {
    e && t && (s != null ? e[t].splice(s, 1) : delete e[t]);
  }
};

// ../node_modules/estree-walker/src/sync.js
var u = class extends h {
  static {
    r(this, "SyncWalker");
  }
  /**
   *
   * @param {SyncHandler} [enter]
   * @param {SyncHandler} [leave]
   */
  constructor(e, t) {
    super(), this.should_skip = !1, this.should_remove = !1, this.replacement = null, this.context = {
      skip: /* @__PURE__ */ r(() => this.should_skip = !0, "skip"),
      remove: /* @__PURE__ */ r(() => this.should_remove = !0, "remove"),
      replace: /* @__PURE__ */ r((s) => this.replacement = s, "replace")
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
  visit(e, t, s, l) {
    if (e) {
      if (this.enter) {
        let o = this.should_skip, c = this.should_remove, a = this.replacement;
        this.should_skip = !1, this.should_remove = !1, this.replacement = null, this.enter.call(this.context, e, t, s, l), this.replacement &&
        (e = this.replacement, this.replace(t, s, l, e)), this.should_remove && this.remove(t, s, l);
        let m = this.should_skip, g = this.should_remove;
        if (this.should_skip = o, this.should_remove = c, this.replacement = a, m) return e;
        if (g) return null;
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
              let m = c[a];
              p(m) && (this.visit(m, e, n, a) || a--);
            }
          } else p(o) && this.visit(o, e, n, null);
      }
      if (this.leave) {
        let o = this.replacement, c = this.should_remove;
        this.replacement = null, this.should_remove = !1, this.leave.call(this.context, e, t, s, l), this.replacement && (e = this.replacement,
        this.replace(t, s, l, e)), this.should_remove && this.remove(t, s, l);
        let a = this.should_remove;
        if (this.replacement = o, this.should_remove = c, a) return null;
      }
    }
    return e;
  }
};
function p(i) {
  return i !== null && typeof i == "object" && "type" in i && typeof i.type == "string";
}
r(p, "isNode");

// ../node_modules/estree-walker/src/index.js
function f(i, { enter: e, leave: t }) {
  return new u(e, t).visit(i, null);
}
r(f, "walk");

// src/core-server/mocking-utils/extract.ts
var b = /* @__PURE__ */ r((i) => k.parse(i, {
  sourceType: "module",
  // Enable plugins to handle modern JavaScript features, including TSX.
  plugins: ["typescript", "jsx", "classProperties", "objectRestSpread"],
  errorRecovery: !0
}).program, "babelParser");
function y(i) {
  let e = b(i);
  return f(e, {
    enter(t) {
      t.type === "CallExpression" && t.callee.type === "MemberExpression" && t.callee.object.type === "Identifier" && t.callee.object.name ===
      "sb" && t.callee.property.type === "Identifier" && t.callee.property.name === "mock" && t.arguments.length > 0 && t.arguments[0].type ===
      "CallExpression" && t.arguments[0].callee.type === "Import" && t.arguments[0].arguments.length === 1 && t.arguments[0].arguments[0].type ===
      "StringLiteral" && (t.arguments[0] = d.stringLiteral(t.arguments[0].arguments[0].value));
    }
  }), _(e, {}, i);
}
r(y, "rewriteSbMockImportCalls");

// src/core-server/presets/webpack/loaders/storybook-mock-transform-loader.ts
var x = /* @__PURE__ */ r(function(e, t, s) {
  let l = this.async();
  try {
    let n = y(e);
    l(null, n.code, n.map || void 0, s);
  } catch (n) {
    let o = this.resourcePath;
    C.debug(`Could not transform sb.mock(import(...)) calls in ${o}: ${n}`), l(null, e, t, s);
  }
}, "mockTransformLoaderFn"), Y = x;
export {
  Y as default
};
