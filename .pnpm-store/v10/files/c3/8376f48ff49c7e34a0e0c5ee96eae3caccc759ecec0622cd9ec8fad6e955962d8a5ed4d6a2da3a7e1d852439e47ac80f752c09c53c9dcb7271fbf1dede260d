"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var depgraph_exports = {};
__export(depgraph_exports, {
  default: () => depgraph_default
});
module.exports = __toCommonJS(depgraph_exports);
var path = __toESM(require("path"), 1);
function createImportTracerPlugin() {
  const dependencyGraph = /* @__PURE__ */ new Map();
  const entryPoints = /* @__PURE__ */ new Set();
  const processingImports = /* @__PURE__ */ new Set();
  const plugin = {
    name: "import-tracer",
    setup(build) {
      build.onStart(() => {
        dependencyGraph.clear();
        entryPoints.clear();
        processingImports.clear();
      });
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === "entry-point") {
          entryPoints.add(args.path);
        }
        return null;
      });
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (args.importer && (args.kind === "import-statement" || args.kind === "require-call" || args.kind === "dynamic-import" || args.kind === "require-resolve")) {
          const importKey = `${args.importer}:${args.path}`;
          if (processingImports.has(importKey)) {
            return null;
          }
          try {
            processingImports.add(importKey);
            const result = await build.resolve(args.path, {
              // Does it work to pretendit's always an import???
              kind: "import-statement",
              resolveDir: args.resolveDir
            });
            if (result.errors.length === 0) {
              if (!dependencyGraph.has(args.importer)) {
                dependencyGraph.set(args.importer, /* @__PURE__ */ new Set());
              }
              dependencyGraph.get(args.importer).add(result.path);
            }
          } finally {
            processingImports.delete(importKey);
          }
        }
        return null;
      });
    }
  };
  const tracer = {
    traceImportChains(entryPoint, filename) {
      const resolvedEntryPoint = path.resolve(entryPoint);
      const findShortestPath = (start, target) => {
        const queue = [
          { node: start, path: [start] }
        ];
        const visited = /* @__PURE__ */ new Set([start]);
        while (queue.length > 0) {
          const { node, path: path2 } = queue.shift();
          if (node === target) {
            return path2;
          }
          const imports = dependencyGraph.get(node) || /* @__PURE__ */ new Set();
          for (const imp of imports) {
            if (!visited.has(imp)) {
              visited.add(imp);
              queue.push({ node: imp, path: [...path2, imp] });
            }
          }
        }
        return null;
      };
      const result = findShortestPath(resolvedEntryPoint, filename);
      return result ? [result] : [];
    },
    getDependencyGraph() {
      const copy = /* @__PURE__ */ new Map();
      for (const [key, value] of dependencyGraph.entries()) {
        copy.set(key, new Set(value));
      }
      return copy;
    }
  };
  return { plugin, tracer };
}
var depgraph_default = createImportTracerPlugin;
//# sourceMappingURL=depgraph.js.map
