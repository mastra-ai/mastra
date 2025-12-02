"use strict";
import path from "path";
import fs from "fs";
export const wasmPlugin = {
  name: "convex-wasm",
  setup(build) {
    build.onResolve({ filter: /\.wasm$/ }, (args) => {
      if (args.namespace === "wasm-stub") {
        return {
          path: args.path,
          namespace: "wasm-binary"
        };
      }
      if (args.resolveDir === "") {
        return;
      }
      return {
        path: path.isAbsolute(args.path) ? args.path : path.join(args.resolveDir, args.path),
        namespace: "wasm-stub"
      };
    });
    build.onLoad({ filter: /.*/, namespace: "wasm-stub" }, async (args) => ({
      contents: `import wasm from ${JSON.stringify(args.path)}
          export default new WebAssembly.Module(wasm)`
    }));
    build.onLoad({ filter: /.*/, namespace: "wasm-binary" }, async (args) => ({
      contents: await fs.promises.readFile(args.path),
      loader: "binary"
    }));
  }
};
//# sourceMappingURL=wasm.js.map
