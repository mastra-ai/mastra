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
var debugBundle_exports = {};
__export(debugBundle_exports, {
  debugIsolateBundlesSerially: () => debugIsolateBundlesSerially,
  innerEsbuild: () => innerEsbuild,
  isEsbuildBuildError: () => isEsbuildBuildError
});
module.exports = __toCommonJS(debugBundle_exports);
var import_path = __toESM(require("path"), 1);
var import_esbuild = __toESM(require("esbuild"), 1);
var import_log = require("./log.js");
var import_wasm = require("./wasm.js");
var import_depgraph = __toESM(require("./depgraph.js"), 1);
async function innerEsbuild({
  entryPoints,
  platform,
  dir,
  extraConditions,
  generateSourceMaps,
  plugins,
  chunksFolder,
  logLevel
}) {
  const result = await import_esbuild.default.build({
    entryPoints,
    bundle: true,
    platform,
    format: "esm",
    target: "esnext",
    jsx: "automatic",
    outdir: "out",
    outbase: dir,
    conditions: ["convex", "module", ...extraConditions],
    plugins,
    write: false,
    sourcemap: generateSourceMaps,
    splitting: true,
    chunkNames: import_path.default.join(chunksFolder, "[hash]"),
    treeShaking: true,
    minifySyntax: true,
    minifyIdentifiers: true,
    // Enabling minifyWhitespace breaks sourcemaps on convex backends.
    // The sourcemaps produced are valid on https://evanw.github.io/source-map-visualization
    // but something we're doing (perhaps involving https://github.com/getsentry/rust-sourcemap)
    // makes everything map to the same line.
    minifyWhitespace: false,
    // false is the default, just showing for clarify.
    keepNames: true,
    define: {
      "process.env.NODE_ENV": '"production"'
    },
    metafile: true,
    logLevel: logLevel || "warning"
  });
  return result;
}
function isEsbuildBuildError(e) {
  return "errors" in e && "warnings" in e && Array.isArray(e.errors) && Array.isArray(e.warnings);
}
async function debugIsolateBundlesSerially(ctx, {
  entryPoints,
  extraConditions,
  dir
}) {
  (0, import_log.logMessage)(
    `Bundling convex entry points one at a time to track down things that can't be bundled for the Convex JS runtime.`
  );
  let i = 1;
  for (const entryPoint of entryPoints) {
    (0, import_log.changeSpinner)(
      `bundling entry point ${entryPoint} (${i++}/${entryPoints.length})...`
    );
    const { plugin, tracer } = (0, import_depgraph.default)();
    try {
      await innerEsbuild({
        entryPoints: [entryPoint],
        platform: "browser",
        generateSourceMaps: true,
        chunksFolder: "_deps",
        extraConditions,
        dir,
        plugins: [plugin, import_wasm.wasmPlugin],
        logLevel: "silent"
      });
    } catch (error) {
      if (!isEsbuildBuildError(error) || !error.errors[0]) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: null
        });
      }
      const buildError = error.errors[0];
      const errorFile = buildError.location?.file;
      if (!errorFile) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: null
        });
      }
      const importedPath = buildError.text.match(/"([^"]+)"/)?.[1];
      if (!importedPath) continue;
      const full = import_path.default.resolve(errorFile);
      (0, import_log.logError)("");
      (0, import_log.logError)(
        `Bundling ${entryPoint} resulted in ${error.errors.length} esbuild errors.`
      );
      (0, import_log.logError)(`One of the bundling errors occurred while bundling ${full}:
`);
      (0, import_log.logError)(
        import_esbuild.default.formatMessagesSync([buildError], {
          kind: "error",
          color: true
        }).join("\n")
      );
      (0, import_log.logError)("It would help to avoid importing this file.");
      const chains = tracer.traceImportChains(entryPoint, full);
      const chain = chains[0];
      chain.reverse();
      (0, import_log.logError)(``);
      if (chain.length > 0) {
        const problematicFileRelative = formatFilePath(dir, chain[0]);
        if (chain.length === 1) {
          (0, import_log.logError)(`  ${problematicFileRelative}`);
        } else {
          (0, import_log.logError)(`  ${problematicFileRelative} is imported by`);
          for (let i2 = 1; i2 < chain.length - 1; i2++) {
            const fileRelative = formatFilePath(dir, chain[i2]);
            (0, import_log.logError)(`  ${fileRelative}, which is imported by`);
          }
          const entryPointFile = chain[chain.length - 1];
          const entryPointRelative = formatFilePath(dir, entryPointFile);
          (0, import_log.logError)(`  ${entryPointRelative}, which doesn't use "use node"
`);
          (0, import_log.logError)(
            `  For registered action functions to use Node.js APIs in any code they run they must be defined
  in a file with 'use node' at the top. See https://docs.convex.dev/functions/runtimes#nodejs-runtime
`
          );
        }
      }
      (0, import_log.logFailure)("Bundling failed");
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage: "Bundling failed."
      });
    }
    (0, import_log.logVerbose)(`${entryPoint} bundled`);
  }
}
function formatFilePath(baseDir, filePath) {
  if (!import_path.default.isAbsolute(filePath)) {
    if (!filePath.startsWith("convex/")) {
      const cleanPath2 = filePath.replace(/^\.\//, "");
      return `convex/${cleanPath2}`;
    }
    return filePath;
  }
  const relativePath = import_path.default.relative(baseDir, filePath);
  const cleanPath = relativePath.replace(/^\.\//, "");
  const isConvexPath = cleanPath.startsWith("convex/") || cleanPath.includes("/convex/") || import_path.default.dirname(cleanPath) === "convex";
  if (isConvexPath) {
    if (cleanPath.startsWith("convex/")) {
      return cleanPath;
    }
    if (import_path.default.dirname(cleanPath) === "convex") {
      const filename = import_path.default.basename(cleanPath);
      return `convex/${filename}`;
    }
    const convexIndex = cleanPath.indexOf("convex/");
    if (convexIndex >= 0) {
      return cleanPath.substring(convexIndex);
    }
  }
  return `convex/${cleanPath}`;
}
//# sourceMappingURL=debugBundle.js.map
