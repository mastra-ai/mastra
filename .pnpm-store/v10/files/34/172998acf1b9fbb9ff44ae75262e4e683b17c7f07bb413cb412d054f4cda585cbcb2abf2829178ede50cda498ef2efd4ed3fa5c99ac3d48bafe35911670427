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
var bundler_exports = {};
__export(bundler_exports, {
  RecordingFs: () => import_fs2.RecordingFs,
  actionsDir: () => actionsDir,
  bundle: () => bundle,
  bundleAuthConfig: () => bundleAuthConfig,
  bundleSchema: () => bundleSchema,
  doesImportConvexHttpRouter: () => doesImportConvexHttpRouter,
  entryPoints: () => entryPoints,
  entryPointsByEnvironment: () => entryPointsByEnvironment,
  mustBeIsolate: () => mustBeIsolate,
  nodeFs: () => import_fs2.nodeFs,
  useNodeDirectiveRegex: () => useNodeDirectiveRegex,
  walkDir: () => walkDir
});
module.exports = __toCommonJS(bundler_exports);
var import_path = __toESM(require("path"), 1);
var import_chalk = __toESM(require("chalk"), 1);
var import_parser = require("@babel/parser");
var Sentry = __toESM(require("@sentry/node"), 1);
var import_fs = require("./fs.js");
var import_log = require("./log.js");
var import_wasm = require("./wasm.js");
var import_external = require("./external.js");
var import_debugBundle = require("./debugBundle.js");
var import_fs2 = require("./fs.js");
const actionsDir = "actions";
function* walkDir(fs, dirPath, shouldSkipDir, depth) {
  depth = depth ?? 0;
  for (const dirEntry of fs.listDir(dirPath).sort(import_fs.consistentPathSort)) {
    const childPath = import_path.default.join(dirPath, dirEntry.name);
    if (dirEntry.isDirectory()) {
      if (shouldSkipDir && shouldSkipDir(childPath)) {
        continue;
      }
      yield { isDir: true, path: childPath, depth };
      yield* walkDir(fs, childPath, shouldSkipDir, depth + 1);
    } else if (dirEntry.isFile()) {
      yield { isDir: false, path: childPath, depth };
    }
  }
}
async function doEsbuild(ctx, dir, entryPoints2, generateSourceMaps, platform, chunksFolder, externalPackages, extraConditions) {
  const external = (0, import_external.createExternalPlugin)(ctx, externalPackages);
  try {
    const result = await (0, import_debugBundle.innerEsbuild)({
      entryPoints: entryPoints2,
      platform,
      generateSourceMaps,
      chunksFolder,
      extraConditions,
      dir,
      // The wasmPlugin should be last so it doesn't run on external modules.
      plugins: [external.plugin, import_wasm.wasmPlugin]
    });
    for (const [relPath, input] of Object.entries(result.metafile.inputs)) {
      if (relPath.indexOf("(disabled):") !== -1 || relPath.startsWith("wasm-binary:") || relPath.startsWith("wasm-stub:")) {
        continue;
      }
      const absPath = import_path.default.resolve(relPath);
      const st = ctx.fs.stat(absPath);
      if (st.size !== input.bytes) {
        (0, import_log.logWarning)(
          `Bundled file ${absPath} changed right after esbuild invocation`
        );
        return await ctx.crash({
          exitCode: 1,
          errorType: "transient",
          printedMessage: null
        });
      }
      ctx.fs.registerPath(absPath, st);
    }
    return {
      ...result,
      externalModuleNames: external.externalModuleNames,
      bundledModuleNames: external.bundledModuleNames
    };
  } catch (e) {
    let recommendUseNode = false;
    if ((0, import_debugBundle.isEsbuildBuildError)(e)) {
      for (const error of e.errors) {
        if (error.location) {
          const absPath = import_path.default.resolve(error.location.file);
          const st = ctx.fs.stat(absPath);
          ctx.fs.registerPath(absPath, st);
        }
        if (platform !== "node" && !recommendUseNode && error.notes.some(
          (note) => note.text.includes("Are you trying to bundle for node?")
        )) {
          recommendUseNode = true;
        }
      }
    }
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      // We don't print any error because esbuild already printed
      // all the relevant information.
      printedMessage: recommendUseNode ? `
It looks like you are using Node APIs from a file without the "use node" directive.
Split out actions using Node.js APIs like this into a new file only containing actions that uses "use node" so these actions will run in a Node.js environment.
For more information see https://docs.convex.dev/functions/runtimes#nodejs-runtime
` : null
    });
  }
}
async function bundle(ctx, dir, entryPoints2, generateSourceMaps, platform, chunksFolder = "_deps", externalPackagesAllowList = [], extraConditions = []) {
  const availableExternalPackages = await (0, import_external.computeExternalPackages)(
    ctx,
    externalPackagesAllowList
  );
  const result = await doEsbuild(
    ctx,
    dir,
    entryPoints2,
    generateSourceMaps,
    platform,
    chunksFolder,
    availableExternalPackages,
    extraConditions
  );
  if (result.errors.length) {
    const errorMessage = result.errors.map((e) => `esbuild error: ${e.text}`).join("\n");
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: errorMessage
    });
  }
  for (const warning of result.warnings) {
    (0, import_log.logWarning)(import_chalk.default.yellow(`esbuild warning: ${warning.text}`));
  }
  const sourceMaps = /* @__PURE__ */ new Map();
  const modules = [];
  const environment = platform === "node" ? "node" : "isolate";
  for (const outputFile of result.outputFiles) {
    const relPath = import_path.default.relative(import_path.default.normalize("out"), outputFile.path);
    if (import_path.default.extname(relPath) === ".map") {
      sourceMaps.set(relPath, outputFile.text);
      continue;
    }
    const posixRelPath = relPath.split(import_path.default.sep).join(import_path.default.posix.sep);
    modules.push({ path: posixRelPath, source: outputFile.text, environment });
  }
  for (const module2 of modules) {
    const sourceMapPath = module2.path + ".map";
    const sourceMap = sourceMaps.get(sourceMapPath);
    if (sourceMap) {
      module2.sourceMap = sourceMap;
    }
  }
  return {
    modules,
    externalDependencies: await externalPackageVersions(
      ctx,
      availableExternalPackages,
      result.externalModuleNames
    ),
    bundledModuleNames: result.bundledModuleNames
  };
}
async function externalPackageVersions(ctx, availableExternalPackages, referencedPackages) {
  const versions = /* @__PURE__ */ new Map();
  const referencedPackagesQueue = Array.from(referencedPackages.keys());
  for (let i = 0; i < referencedPackagesQueue.length; i++) {
    const moduleName = referencedPackagesQueue[i];
    const modulePath = availableExternalPackages.get(moduleName).path;
    const { version, peerAndOptionalDependencies } = await (0, import_external.findExactVersionAndDependencies)(ctx, moduleName, modulePath);
    versions.set(moduleName, version);
    for (const dependency of peerAndOptionalDependencies) {
      if (availableExternalPackages.has(dependency) && !referencedPackages.has(dependency)) {
        referencedPackagesQueue.push(dependency);
        referencedPackages.add(dependency);
      }
    }
  }
  return versions;
}
async function bundleSchema(ctx, dir, extraConditions) {
  let target = import_path.default.resolve(dir, "schema.ts");
  if (!ctx.fs.exists(target)) {
    target = import_path.default.resolve(dir, "schema.js");
  }
  const result = await bundle(
    ctx,
    dir,
    [target],
    true,
    "browser",
    void 0,
    extraConditions
  );
  return result.modules;
}
async function bundleAuthConfig(ctx, dir) {
  const authConfigPath = import_path.default.resolve(dir, "auth.config.js");
  const authConfigTsPath = import_path.default.resolve(dir, "auth.config.ts");
  if (ctx.fs.exists(authConfigPath) && ctx.fs.exists(authConfigTsPath)) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Found both ${authConfigPath} and ${authConfigTsPath}, choose one.`
    });
  }
  const chosenPath = ctx.fs.exists(authConfigTsPath) ? authConfigTsPath : authConfigPath;
  if (!ctx.fs.exists(chosenPath)) {
    (0, import_log.logVerbose)(
      import_chalk.default.yellow(
        `Found no auth config file at ${authConfigTsPath} or ${authConfigPath} so there are no configured auth providers`
      )
    );
    return [];
  }
  (0, import_log.logVerbose)(import_chalk.default.yellow(`Bundling auth config found at ${chosenPath}`));
  const result = await bundle(ctx, dir, [chosenPath], true, "browser");
  return result.modules;
}
async function doesImportConvexHttpRouter(source) {
  try {
    const ast = (0, import_parser.parse)(source, {
      sourceType: "module",
      plugins: ["typescript"]
    });
    return ast.program.body.some((node) => {
      if (node.type !== "ImportDeclaration") return false;
      return node.specifiers.some((s) => {
        const specifier = s;
        const imported = specifier.imported;
        return imported.name === "httpRouter";
      });
    });
  } catch {
    return source.match(
      /import\s*\{\s*httpRouter.*\}\s*from\s*"\s*convex\/server\s*"/
    ) !== null;
  }
}
const ENTRY_POINT_EXTENSIONS = [
  // ESBuild js loader
  ".js",
  ".mjs",
  ".cjs",
  // ESBuild ts loader
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  // ESBuild jsx loader
  ".jsx"
  // ESBuild supports css, text, json, and more but these file types are not
  // allowed to define entry points.
];
async function entryPoints(ctx, dir) {
  const entryPoints2 = [];
  const looksLikeNestedComponent = (dirPath) => {
    const config = import_path.default.join(dirPath, "convex.config.ts");
    const isComponentDefinition = ctx.fs.exists(config);
    if (isComponentDefinition) {
      (0, import_log.logVerbose)(import_chalk.default.yellow(`Skipping component directory ${dirPath}`));
    }
    return isComponentDefinition;
  };
  for (const { isDir, path: fpath, depth } of walkDir(
    ctx.fs,
    dir,
    looksLikeNestedComponent
  )) {
    if (isDir) {
      continue;
    }
    const relPath = import_path.default.relative(dir, fpath);
    const parsedPath = import_path.default.parse(fpath);
    const base = parsedPath.base;
    const extension = parsedPath.ext.toLowerCase();
    if (relPath.startsWith("_deps" + import_path.default.sep)) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage: `The path "${fpath}" is within the "_deps" directory, which is reserved for dependencies. Please move your code to another directory.`
      });
    }
    if (depth === 0 && base.toLowerCase().startsWith("https.")) {
      const source = ctx.fs.readUtf8File(fpath);
      if (await doesImportConvexHttpRouter(source))
        (0, import_log.logWarning)(
          import_chalk.default.yellow(
            `Found ${fpath}. HTTP action routes will not be imported from this file. Did you mean to include http${extension}?`
          )
        );
      Sentry.captureMessage(
        `User code top level directory contains file ${base} which imports httpRouter.`,
        "warning"
      );
    }
    if (!ENTRY_POINT_EXTENSIONS.some((ext) => relPath.endsWith(ext))) {
      (0, import_log.logVerbose)(import_chalk.default.yellow(`Skipping non-JS file ${fpath}`));
    } else if (relPath.startsWith("_generated" + import_path.default.sep)) {
      (0, import_log.logVerbose)(import_chalk.default.yellow(`Skipping ${fpath}`));
    } else if (base.startsWith(".")) {
      (0, import_log.logVerbose)(import_chalk.default.yellow(`Skipping dotfile ${fpath}`));
    } else if (base.startsWith("#")) {
      (0, import_log.logVerbose)(import_chalk.default.yellow(`Skipping likely emacs tempfile ${fpath}`));
    } else if (base === "schema.ts" || base === "schema.js") {
      (0, import_log.logVerbose)(import_chalk.default.yellow(`Skipping ${fpath}`));
    } else if ((base.match(/\./g) || []).length > 1) {
      (0, import_log.logVerbose)(import_chalk.default.yellow(`Skipping ${fpath} that contains multiple dots`));
    } else if (relPath.includes(" ")) {
      (0, import_log.logVerbose)(
        import_chalk.default.yellow(`Skipping ${relPath} because it contains a space`)
      );
    } else {
      (0, import_log.logVerbose)(import_chalk.default.green(`Preparing ${fpath}`));
      entryPoints2.push(fpath);
    }
  }
  const nonEmptyEntryPoints = entryPoints2.filter((fpath) => {
    if (!fpath.endsWith(".ts") && !fpath.endsWith(".tsx")) {
      return true;
    }
    const contents = ctx.fs.readUtf8File(fpath);
    if (/^\s{0,100}(import|export)/m.test(contents)) {
      return true;
    }
    (0, import_log.logVerbose)(
      import_chalk.default.yellow(
        `Skipping ${fpath} because it has no export or import to make it a valid TypeScript module`
      )
    );
  });
  return nonEmptyEntryPoints;
}
const useNodeDirectiveRegex = /^\s*("|')use node("|');?\s*$/;
function hasUseNodeDirective(ctx, fpath) {
  const source = ctx.fs.readUtf8File(fpath);
  if (source.indexOf("use node") === -1) {
    return false;
  }
  try {
    const ast = (0, import_parser.parse)(source, {
      // parse in strict mode and allow module declarations
      sourceType: "module",
      // esbuild supports jsx and typescript by default. Allow the same plugins
      // here too.
      plugins: ["jsx", "typescript"]
    });
    return ast.program.directives.map((d) => d.value.value).includes("use node");
  } catch (error) {
    let lineMatches = false;
    for (const line of source.split("\n")) {
      if (line.match(useNodeDirectiveRegex)) {
        lineMatches = true;
        break;
      }
    }
    (0, import_log.logVerbose)(
      `Failed to parse ${fpath}. Use node is set to ${lineMatches} based on regex. Parse error: ${error.toString()}.`
    );
    return lineMatches;
  }
}
function mustBeIsolate(relPath) {
  return ["http", "crons", "schema", "auth.config"].includes(
    relPath.replace(/\.[^/.]+$/, "")
  );
}
async function determineEnvironment(ctx, dir, fpath) {
  const relPath = import_path.default.relative(dir, fpath);
  const useNodeDirectiveFound = hasUseNodeDirective(ctx, fpath);
  if (useNodeDirectiveFound) {
    if (mustBeIsolate(relPath)) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage: `"use node" directive is not allowed for ${relPath}.`
      });
    }
    return "node";
  }
  const actionsPrefix = actionsDir + import_path.default.sep;
  if (relPath.startsWith(actionsPrefix)) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `${relPath} is in /actions subfolder but has no "use node"; directive. You can now define actions in any folder and indicate they should run in node by adding "use node" directive. /actions is a deprecated way to choose Node.js environment, and we require "use node" for all files within that folder to avoid unexpected errors during the migration. See https://docs.convex.dev/functions/actions for more details`
    });
  }
  return "isolate";
}
async function entryPointsByEnvironment(ctx, dir) {
  const isolate = [];
  const node = [];
  for (const entryPoint of await entryPoints(ctx, dir)) {
    const environment = await determineEnvironment(ctx, dir, entryPoint);
    if (environment === "node") {
      node.push(entryPoint);
    } else {
      isolate.push(entryPoint);
    }
  }
  return { isolate, node };
}
//# sourceMappingURL=index.js.map
