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
var wasm_exports = {};
__export(wasm_exports, {
  wasmPlugin: () => wasmPlugin
});
module.exports = __toCommonJS(wasm_exports);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
const wasmPlugin = {
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
        path: import_path.default.isAbsolute(args.path) ? args.path : import_path.default.join(args.resolveDir, args.path),
        namespace: "wasm-stub"
      };
    });
    build.onLoad({ filter: /.*/, namespace: "wasm-stub" }, async (args) => ({
      contents: `import wasm from ${JSON.stringify(args.path)}
          export default new WebAssembly.Module(wasm)`
    }));
    build.onLoad({ filter: /.*/, namespace: "wasm-binary" }, async (args) => ({
      contents: await import_fs.default.promises.readFile(args.path),
      loader: "binary"
    }));
  }
};
//# sourceMappingURL=wasm.js.map
