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
var bundle_exports = {};
__export(bundle_exports, {
  bundleDefinitions: () => bundleDefinitions,
  bundleImplementations: () => bundleImplementations,
  componentGraph: () => componentGraph,
  getDeps: () => getDeps
});
module.exports = __toCommonJS(bundle_exports);
var import_path = __toESM(require("path"), 1);
var import_directoryStructure = require("./directoryStructure.js");
var import_log = require("../../../../bundler/log.js");
var import_esbuild = __toESM(require("esbuild"), 1);
var import_chalk = __toESM(require("chalk"), 1);
var import_bundler = require("../../../../bundler/index.js");
const VIRTUAL_CONFIG_NAMESPACE = "convex-virtual-config";
const VIRTUAL_CONFIG_CONTENTS = `import { defineApp } from "convex/server";
const app = defineApp();
export default app;`;
function virtualConfig({
  rootComponentDirectory,
  importComponentPath
}) {
  let contents = VIRTUAL_CONFIG_CONTENTS;
  if (importComponentPath) {
    const relativeImport = import_path.default.relative(
      rootComponentDirectory.path,
      importComponentPath
    );
    let normalizedImport = relativeImport.replace(/\\/g, "/").replace(/\.ts$/, ".js");
    contents = `import { defineApp } from "convex/server";
import component from "${normalizedImport}";

const app = defineApp();
app.use(component, { name: "exampleComponentInstance" });
export default app;`;
  }
  return {
    name: `convex-virtual-config`,
    async setup(build) {
      const filter = pathToRegexFilter(rootComponentDirectory);
      build.onResolve({ filter }, async (args) => {
        return { path: args.path, namespace: VIRTUAL_CONFIG_NAMESPACE };
      });
      build.onLoad(
        { filter, namespace: VIRTUAL_CONFIG_NAMESPACE },
        async (_args) => {
          return {
            contents,
            resolveDir: rootComponentDirectory.path
          };
        }
      );
    }
  };
}
function pathToRegexFilter(root) {
  let path2 = (0, import_directoryStructure.qualifiedDefinitionPath)(root);
  const escaped = path2.replace(/\\/g, "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`);
}
function componentPlugin({
  mode = "bundle",
  rootComponentDirectory,
  verbose,
  ctx
}) {
  const components = /* @__PURE__ */ new Map();
  return {
    name: `convex-${mode === "discover" ? "discover-components" : "bundle-components"}`,
    async setup(build) {
      build.onResolve({ filter: /.*convex.config.*/ }, async (args) => {
        verbose && (0, import_log.logMessage)("esbuild resolving import:", args);
        if (args.namespace !== "file" && args.namespace !== VIRTUAL_CONFIG_NAMESPACE) {
          verbose && (0, import_log.logMessage)("  Not a file or virtual config.");
          return;
        }
        if (args.kind === "entry-point") {
          verbose && (0, import_log.logMessage)("  -> Top-level entry-point.");
          const componentDirectory = await (0, import_directoryStructure.buildComponentDirectory)(
            ctx,
            import_path.default.resolve(args.path)
          );
          if (components.get(args.path)) {
            throw new Error(
              `Entry point component "${args.path}" already registered.`
            );
          }
          components.set(args.path, componentDirectory);
          return;
        }
        const candidates = [args.path];
        const ext = import_path.default.extname(args.path);
        if (ext === ".js") {
          candidates.push(args.path.slice(0, -".js".length) + ".ts");
        }
        if (ext !== ".js" && ext !== ".ts") {
          candidates.push(args.path + ".js");
          candidates.push(args.path + ".ts");
        }
        let resolvedPath = void 0;
        for (const candidate of candidates) {
          const result = await build.resolve(candidate, {
            // We expect this to be "import-statement" but pass 'kind' through
            // to say honest to normal esbuild behavior.
            kind: args.kind,
            resolveDir: args.resolveDir
          });
          if (result.path) {
            resolvedPath = result.path;
            break;
          }
        }
        if (resolvedPath === void 0) {
          verbose && (0, import_log.logMessage)(`  -> ${args.path} not found.`);
          return;
        }
        const parentDir = import_path.default.dirname(resolvedPath);
        let imported = components.get(resolvedPath);
        if (!imported) {
          const isComponent = (0, import_directoryStructure.isComponentDirectory)(ctx, parentDir, false);
          if (isComponent.kind !== "ok") {
            verbose && (0, import_log.logMessage)("  -> Not a component:", isComponent);
            return;
          }
          imported = isComponent.component;
          components.set(resolvedPath, imported);
        }
        verbose && (0, import_log.logMessage)(
          "  -> Component import! Recording it.",
          args.path,
          resolvedPath
        );
        if (mode === "discover") {
          return {
            path: resolvedPath
          };
        } else {
          const componentPath = (0, import_directoryStructure.toComponentDefinitionPath)(
            rootComponentDirectory,
            imported
          );
          const importPath = definitionImportPath(componentPath);
          return {
            path: importPath,
            external: true
          };
        }
      });
    }
  };
}
function definitionImportPath(componentPath) {
  return `./_componentDeps/${Buffer.from(componentPath).toString("base64url")}`;
}
function sharedEsbuildOptions({
  liveComponentSources = false
}) {
  const options = {
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "esnext",
    conditions: ["convex", "module"],
    // `false` is the default for splitting. It's simpler to evaluate these on
    // the server as a single file.
    // Splitting could be enabled for speed once the server supports it.
    splitting: false,
    // place output files in memory at their source locations
    write: false,
    outdir: import_path.default.parse(process.cwd()).root,
    outbase: import_path.default.parse(process.cwd()).root,
    minify: true,
    // Note that this implies NODE_ENV="production".
    keepNames: true,
    metafile: true
  };
  if (liveComponentSources) {
    options.conditions.push("@convex-dev/component-source");
  }
  return options;
}
async function componentGraph(ctx, absWorkingDir, rootComponentDirectory, liveComponentSources, verbose = true) {
  if (rootComponentDirectory.isRootWithoutConfig && !rootComponentDirectory.syntheticComponentImport) {
    return {
      components: /* @__PURE__ */ new Map([
        [rootComponentDirectory.path, rootComponentDirectory]
      ]),
      dependencyGraph: []
    };
  }
  let result;
  try {
    result = await import_esbuild.default.build({
      absWorkingDir,
      // This is mostly useful for formatting error messages.
      entryPoints: [(0, import_directoryStructure.qualifiedDefinitionPath)(rootComponentDirectory)],
      plugins: [
        componentPlugin({
          ctx,
          mode: "discover",
          verbose,
          rootComponentDirectory
        }),
        ...rootComponentDirectory.syntheticComponentImport ? [
          virtualConfig({
            rootComponentDirectory,
            importComponentPath: rootComponentDirectory.syntheticComponentImport
          })
        ] : []
      ],
      sourcemap: "external",
      sourcesContent: false,
      ...sharedEsbuildOptions({ liveComponentSources })
    });
    await registerEsbuildReads(ctx, absWorkingDir, result.metafile);
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `esbuild failed: ${err}`
    });
  }
  if (result.errors.length) {
    const message = result.errors.map((error) => error.text).join("\n");
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: message
    });
  }
  for (const warning of result.warnings) {
    (0, import_log.logWarning)(import_chalk.default.yellow(`esbuild warning: ${warning.text}`));
  }
  if (rootComponentDirectory.syntheticComponentImport) {
    return await findComponentDependencies(ctx, result.metafile, {
      [`${VIRTUAL_CONFIG_NAMESPACE}:${(0, import_directoryStructure.qualifiedDefinitionPath)(rootComponentDirectory)}`]: rootComponentDirectory
    });
  }
  return await findComponentDependencies(ctx, result.metafile);
}
function getDeps(rootComponent, dependencyGraph, definitionPath) {
  return dependencyGraph.filter(
    ([importer, _imported]) => importer.definitionPath === definitionPath
  ).map(
    ([_importer, imported]) => (0, import_directoryStructure.toComponentDefinitionPath)(rootComponent, imported)
  );
}
async function findComponentDependencies(ctx, metafile, inputOverrides = {}) {
  const { inputs } = metafile;
  const componentsByKey = /* @__PURE__ */ new Map();
  for (const inputPath of Object.keys(inputs)) {
    if (!inputPath.includes(".config.")) continue;
    const override = inputOverrides[inputPath];
    if (override) {
      componentsByKey.set(inputPath, override);
    } else {
      const component = await (0, import_directoryStructure.buildComponentDirectory)(ctx, inputPath);
      componentsByKey.set(import_path.default.resolve(inputPath), component);
    }
  }
  const dependencyGraph = [];
  for (const inputPath of Object.keys(inputs)) {
    if (!inputPath.includes(".config.")) continue;
    const importerKey = inputPath in inputOverrides ? inputPath : import_path.default.resolve(inputPath);
    const importer = componentsByKey.get(importerKey);
    if (!importer) continue;
    const { imports } = inputs[inputPath];
    const componentImports = imports.filter(
      (imp) => imp.path.includes(".config.")
    );
    for (const imp of componentImports) {
      const imported = componentsByKey.get(import_path.default.resolve(imp.path));
      if (!imported) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: `Didn't find ${import_path.default.resolve(imp.path)} in ${[...componentsByKey.keys()].toString()}`
        });
      }
      if (imp.original) {
        const importSpecifier = imp.original;
        const relativeSpecifier = importSpecifier.replace(
          /\/convex\.config.*$/,
          ""
        );
        imported.importSpecifier = relativeSpecifier;
      }
      dependencyGraph.push([importer, imported]);
    }
  }
  const components = /* @__PURE__ */ new Map();
  for (const directory of componentsByKey.values()) {
    components.set(directory.path, directory);
  }
  return { components, dependencyGraph };
}
async function bundleDefinitions(ctx, absWorkingDir, dependencyGraph, rootComponentDirectory, componentDirectories, liveComponentSources, verbose = false) {
  let result;
  try {
    let plugins = [
      componentPlugin({
        ctx,
        mode: "bundle",
        verbose,
        rootComponentDirectory
      })
    ];
    if (rootComponentDirectory.syntheticComponentImport || rootComponentDirectory.isRootWithoutConfig) {
      plugins.push(
        virtualConfig(
          rootComponentDirectory.syntheticComponentImport ? {
            rootComponentDirectory,
            importComponentPath: rootComponentDirectory.syntheticComponentImport
          } : { rootComponentDirectory }
        )
      );
    }
    result = await import_esbuild.default.build({
      absWorkingDir,
      entryPoints: componentDirectories.map(
        (dir) => (0, import_directoryStructure.qualifiedDefinitionPath)(dir)
      ),
      plugins,
      sourcemap: true,
      ...sharedEsbuildOptions({ liveComponentSources })
    });
    await registerEsbuildReads(ctx, absWorkingDir, result.metafile);
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `esbuild failed: ${err}`
    });
  }
  if (result.errors.length) {
    const message = result.errors.map((error) => error.text).join("\n");
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: message
    });
  }
  for (const warning of result.warnings) {
    (0, import_log.logWarning)(import_chalk.default.yellow(`esbuild warning: ${warning.text}`));
  }
  const outputs = [];
  for (const directory of componentDirectories) {
    const absInput = import_path.default.resolve(absWorkingDir, directory.definitionPath);
    const expectedOutputJs = absInput.slice(0, absInput.lastIndexOf(".")) + ".js";
    const expectedOutputMap = absInput.slice(0, absInput.lastIndexOf(".")) + ".js.map";
    const outputJs = result.outputFiles.filter(
      (outputFile) => outputFile.path === expectedOutputJs
    )[0];
    if (!outputJs) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `no JS found matching ${expectedOutputJs} in ${result.outputFiles.map((x) => x.path).toString()}`
      });
    }
    const outputJsMap = result.outputFiles.filter(
      (outputFile) => outputFile.path === expectedOutputMap
    )[0];
    outputs.push({
      outputJs,
      outputJsMap,
      directory
    });
  }
  const appBundles = outputs.filter(
    (out) => out.directory.path === rootComponentDirectory.path
  );
  if (appBundles.length !== 1) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "found wrong number of app bundles"
    });
  }
  const appBundle = appBundles[0];
  const componentBundles = outputs.filter(
    (out) => out.directory.path !== rootComponentDirectory.path
  );
  const componentDefinitionSpecsWithoutImpls = componentBundles.map(({ directory, outputJs, outputJsMap }) => ({
    definitionPath: (0, import_directoryStructure.toComponentDefinitionPath)(
      rootComponentDirectory,
      directory
    ),
    definition: {
      path: import_path.default.relative(directory.path, outputJs.path),
      source: outputJs.text,
      sourceMap: outputJsMap?.text,
      environment: "isolate"
    },
    dependencies: getDeps(
      rootComponentDirectory,
      dependencyGraph,
      directory.definitionPath
    )
  }));
  const appDeps = getDeps(
    rootComponentDirectory,
    dependencyGraph,
    appBundle.directory.definitionPath
  );
  const appDefinitionSpecWithoutImpls = {
    definition: {
      path: import_path.default.relative(rootComponentDirectory.path, appBundle.outputJs.path),
      source: appBundle.outputJs.text,
      sourceMap: appBundle.outputJsMap?.text,
      environment: "isolate"
    },
    dependencies: appDeps
  };
  return {
    appDefinitionSpecWithoutImpls,
    componentDefinitionSpecsWithoutImpls
  };
}
async function bundleImplementations(ctx, rootComponentDirectory, componentDirectories, nodeExternalPackages, extraConditions, verbose = false) {
  let appImplementation;
  const componentImplementations = [];
  const directoriesToBundle = rootComponentDirectory.syntheticComponentImport ? componentDirectories : [rootComponentDirectory, ...componentDirectories];
  for (const directory of directoriesToBundle) {
    const isRoot = directory.path === rootComponentDirectory.path;
    const resolvedPath = import_path.default.resolve(
      rootComponentDirectory.path,
      directory.path
    );
    let schema;
    if (ctx.fs.exists(import_path.default.resolve(resolvedPath, "schema.ts"))) {
      schema = (await (0, import_bundler.bundleSchema)(ctx, resolvedPath, extraConditions))[0] || null;
    } else if (ctx.fs.exists(import_path.default.resolve(resolvedPath, "schema.js"))) {
      schema = (await (0, import_bundler.bundleSchema)(ctx, resolvedPath, extraConditions))[0] || null;
    } else {
      schema = null;
    }
    const entryPoints = await (0, import_bundler.entryPointsByEnvironment)(ctx, resolvedPath);
    const convexResult = await (0, import_bundler.bundle)(
      ctx,
      resolvedPath,
      entryPoints.isolate,
      true,
      "browser",
      void 0,
      void 0,
      extraConditions
    );
    if (convexResult.externalDependencies.size !== 0) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "external dependencies not supported"
      });
    }
    const functions = convexResult.modules;
    if (isRoot) {
      if (verbose) {
        (0, import_log.showSpinner)("Bundling modules for Node.js runtime...");
      }
      const nodeResult = await (0, import_bundler.bundle)(
        ctx,
        resolvedPath,
        entryPoints.node,
        true,
        "node",
        import_path.default.join("_deps", "node"),
        nodeExternalPackages,
        extraConditions
      );
      const externalNodeDependencies = [];
      for (const [
        moduleName,
        moduleVersion
      ] of nodeResult.externalDependencies) {
        externalNodeDependencies.push({
          name: moduleName,
          version: moduleVersion
        });
      }
      const authBundle = await (0, import_bundler.bundleAuthConfig)(ctx, resolvedPath);
      appImplementation = {
        schema,
        functions: functions.concat(nodeResult.modules).concat(authBundle),
        externalNodeDependencies
      };
    } else {
      if (directory.path !== rootComponentDirectory.path) {
        const nodeResult = await (0, import_bundler.bundle)(
          ctx,
          resolvedPath,
          entryPoints.node,
          true,
          "node",
          import_path.default.join("_deps", "node"),
          nodeExternalPackages,
          extraConditions
        );
        if (nodeResult.modules.length > 0) {
          await ctx.crash({
            exitCode: 1,
            errorType: "invalid filesystem data",
            printedMessage: `"use node" directive is not supported in components. Remove it from the component at: ${resolvedPath}.`
          });
        }
      }
      const definitionPath = (0, import_directoryStructure.toComponentDefinitionPath)(
        rootComponentDirectory,
        directory
      );
      componentImplementations.push({ definitionPath, schema, functions });
    }
  }
  if (!appImplementation) {
    if (rootComponentDirectory.syntheticComponentImport) {
      appImplementation = {
        schema: null,
        functions: [],
        externalNodeDependencies: []
      };
    } else {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "No app implementation found"
      });
    }
  }
  return { appImplementation, componentImplementations };
}
async function registerEsbuildReads(ctx, absWorkingDir, metafile) {
  for (const [relPath, input] of Object.entries(metafile.inputs)) {
    if (
      // We rewrite these files so this integrity check isn't useful.
      import_path.default.basename(relPath).includes("convex.config") || // TODO: esbuild outputs paths prefixed with "(disabled)" when bundling our internal
      // udf-system package. The files do actually exist locally, though.
      relPath.indexOf("(disabled):") !== -1 || relPath.startsWith("wasm-binary:") || relPath.startsWith("wasm-stub:")
    ) {
      continue;
    }
    const absPath = import_path.default.resolve(absWorkingDir, relPath);
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
}
//# sourceMappingURL=bundle.js.map
