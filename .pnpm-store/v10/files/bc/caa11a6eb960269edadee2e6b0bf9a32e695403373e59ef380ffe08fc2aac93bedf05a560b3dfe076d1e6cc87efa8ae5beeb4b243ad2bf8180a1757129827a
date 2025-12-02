"use strict";
import * as path from "path";
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
export default createImportTracerPlugin;
//# sourceMappingURL=depgraph.js.map
