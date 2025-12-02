"use strict";
import path from "path";
import {
  buildComponentDirectory,
  isComponentDirectory,
  qualifiedDefinitionPath,
  toComponentDefinitionPath
} from "./directoryStructure.js";
import {
  logMessage,
  logWarning,
  showSpinner
} from "../../../../bundler/log.js";
import esbuild from "esbuild";
import chalk from "chalk";
import {
  bundle,
  bundleAuthConfig,
  bundleSchema,
  entryPointsByEnvironment
} from "../../../../bundler/index.js";
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
    const relativeImport = path.relative(
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
  let path2 = qualifiedDefinitionPath(root);
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
        verbose && logMessage("esbuild resolving import:", args);
        if (args.namespace !== "file" && args.namespace !== VIRTUAL_CONFIG_NAMESPACE) {
          verbose && logMessage("  Not a file or virtual config.");
          return;
        }
        if (args.kind === "entry-point") {
          verbose && logMessage("  -> Top-level entry-point.");
          const componentDirectory = await buildComponentDirectory(
            ctx,
            path.resolve(args.path)
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
        const ext = path.extname(args.path);
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
          verbose && logMessage(`  -> ${args.path} not found.`);
          return;
        }
        const parentDir = path.dirname(resolvedPath);
        let imported = components.get(resolvedPath);
        if (!imported) {
          const isComponent = isComponentDirectory(ctx, parentDir, false);
          if (isComponent.kind !== "ok") {
            verbose && logMessage("  -> Not a component:", isComponent);
            return;
          }
          imported = isComponent.component;
          components.set(resolvedPath, imported);
        }
        verbose && logMessage(
          "  -> Component import! Recording it.",
          args.path,
          resolvedPath
        );
        if (mode === "discover") {
          return {
            path: resolvedPath
          };
        } else {
          const componentPath = toComponentDefinitionPath(
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
    outdir: path.parse(process.cwd()).root,
    outbase: path.parse(process.cwd()).root,
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
export async function componentGraph(ctx, absWorkingDir, rootComponentDirectory, liveComponentSources, verbose = true) {
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
    result = await esbuild.build({
      absWorkingDir,
      // This is mostly useful for formatting error messages.
      entryPoints: [qualifiedDefinitionPath(rootComponentDirectory)],
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
    logWarning(chalk.yellow(`esbuild warning: ${warning.text}`));
  }
  if (rootComponentDirectory.syntheticComponentImport) {
    return await findComponentDependencies(ctx, result.metafile, {
      [`${VIRTUAL_CONFIG_NAMESPACE}:${qualifiedDefinitionPath(rootComponentDirectory)}`]: rootComponentDirectory
    });
  }
  return await findComponentDependencies(ctx, result.metafile);
}
export function getDeps(rootComponent, dependencyGraph, definitionPath) {
  return dependencyGraph.filter(
    ([importer, _imported]) => importer.definitionPath === definitionPath
  ).map(
    ([_importer, imported]) => toComponentDefinitionPath(rootComponent, imported)
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
      const component = await buildComponentDirectory(ctx, inputPath);
      componentsByKey.set(path.resolve(inputPath), component);
    }
  }
  const dependencyGraph = [];
  for (const inputPath of Object.keys(inputs)) {
    if (!inputPath.includes(".config.")) continue;
    const importerKey = inputPath in inputOverrides ? inputPath : path.resolve(inputPath);
    const importer = componentsByKey.get(importerKey);
    if (!importer) continue;
    const { imports } = inputs[inputPath];
    const componentImports = imports.filter(
      (imp) => imp.path.includes(".config.")
    );
    for (const imp of componentImports) {
      const imported = componentsByKey.get(path.resolve(imp.path));
      if (!imported) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: `Didn't find ${path.resolve(imp.path)} in ${[...componentsByKey.keys()].toString()}`
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
export async function bundleDefinitions(ctx, absWorkingDir, dependencyGraph, rootComponentDirectory, componentDirectories, liveComponentSources, verbose = false) {
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
    result = await esbuild.build({
      absWorkingDir,
      entryPoints: componentDirectories.map(
        (dir) => qualifiedDefinitionPath(dir)
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
    logWarning(chalk.yellow(`esbuild warning: ${warning.text}`));
  }
  const outputs = [];
  for (const directory of componentDirectories) {
    const absInput = path.resolve(absWorkingDir, directory.definitionPath);
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
    definitionPath: toComponentDefinitionPath(
      rootComponentDirectory,
      directory
    ),
    definition: {
      path: path.relative(directory.path, outputJs.path),
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
      path: path.relative(rootComponentDirectory.path, appBundle.outputJs.path),
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
export async function bundleImplementations(ctx, rootComponentDirectory, componentDirectories, nodeExternalPackages, extraConditions, verbose = false) {
  let appImplementation;
  const componentImplementations = [];
  const directoriesToBundle = rootComponentDirectory.syntheticComponentImport ? componentDirectories : [rootComponentDirectory, ...componentDirectories];
  for (const directory of directoriesToBundle) {
    const isRoot = directory.path === rootComponentDirectory.path;
    const resolvedPath = path.resolve(
      rootComponentDirectory.path,
      directory.path
    );
    let schema;
    if (ctx.fs.exists(path.resolve(resolvedPath, "schema.ts"))) {
      schema = (await bundleSchema(ctx, resolvedPath, extraConditions))[0] || null;
    } else if (ctx.fs.exists(path.resolve(resolvedPath, "schema.js"))) {
      schema = (await bundleSchema(ctx, resolvedPath, extraConditions))[0] || null;
    } else {
      schema = null;
    }
    const entryPoints = await entryPointsByEnvironment(ctx, resolvedPath);
    const convexResult = await bundle(
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
        showSpinner("Bundling modules for Node.js runtime...");
      }
      const nodeResult = await bundle(
        ctx,
        resolvedPath,
        entryPoints.node,
        true,
        "node",
        path.join("_deps", "node"),
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
      const authBundle = await bundleAuthConfig(ctx, resolvedPath);
      appImplementation = {
        schema,
        functions: functions.concat(nodeResult.modules).concat(authBundle),
        externalNodeDependencies
      };
    } else {
      if (directory.path !== rootComponentDirectory.path) {
        const nodeResult = await bundle(
          ctx,
          resolvedPath,
          entryPoints.node,
          true,
          "node",
          path.join("_deps", "node"),
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
      const definitionPath = toComponentDefinitionPath(
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
      path.basename(relPath).includes("convex.config") || // TODO: esbuild outputs paths prefixed with "(disabled)" when bundling our internal
      // udf-system package. The files do actually exist locally, though.
      relPath.indexOf("(disabled):") !== -1 || relPath.startsWith("wasm-binary:") || relPath.startsWith("wasm-stub:")
    ) {
      continue;
    }
    const absPath = path.resolve(absWorkingDir, relPath);
    const st = ctx.fs.stat(absPath);
    if (st.size !== input.bytes) {
      logWarning(
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
