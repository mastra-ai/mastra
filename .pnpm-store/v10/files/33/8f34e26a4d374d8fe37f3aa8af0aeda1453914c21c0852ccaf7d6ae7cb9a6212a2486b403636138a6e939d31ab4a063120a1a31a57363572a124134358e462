import path from "path";
import {
  ComponentDirectory,
  ComponentDefinitionPath,
  buildComponentDirectory,
  isComponentDirectory,
  qualifiedDefinitionPath,
  toComponentDefinitionPath,
} from "./directoryStructure.js";
import { Context } from "../../../../bundler/context.js";
import {
  logMessage,
  logWarning,
  showSpinner,
} from "../../../../bundler/log.js";
import esbuild, { BuildOptions, Metafile, OutputFile, Plugin } from "esbuild";
import chalk from "chalk";
import {
  AppDefinitionSpecWithoutImpls,
  ComponentDefinitionSpecWithoutImpls,
} from "../../config.js";
import {
  Bundle,
  bundle,
  bundleAuthConfig,
  bundleSchema,
  entryPointsByEnvironment,
} from "../../../../bundler/index.js";
import { NodeDependency } from "../../deployApi/modules.js";

const VIRTUAL_CONFIG_NAMESPACE = "convex-virtual-config";
const VIRTUAL_CONFIG_CONTENTS = `import { defineApp } from "convex/server";\nconst app = defineApp();\nexport default app;`;

/**
 * An esbuild plugin to insert a virtual `convex.config.js` file into the bundle
 * when Convex project doesn't have one explicitly defined.
 *
 * This allows us to use the components push path even when the Convex project doesn't
 * have a config file defined.
 *
 * When importComponentPath is provided, the virtual config will import and use the
 * component found at that path.
 */
function virtualConfig({
  rootComponentDirectory,
  importComponentPath,
}: {
  rootComponentDirectory: ComponentDirectory;
  importComponentPath?: string;
}): Plugin {
  // Empty config with no components
  let contents = VIRTUAL_CONFIG_CONTENTS;

  if (importComponentPath) {
    // Generate config that imports the specified component
    const relativeImport = path.relative(
      rootComponentDirectory.path,
      importComponentPath,
    );
    let normalizedImport = relativeImport
      .replace(/\\/g, "/")
      .replace(/\.ts$/, ".js");

    // We don't generate code for this synthetic root component so the name we
    // use for the component doesn't matter.
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
            resolveDir: rootComponentDirectory.path,
          };
        },
      );
    },
  };
}

function pathToRegexFilter(root: ComponentDirectory) {
  let path = qualifiedDefinitionPath(root);
  const escaped = path
    .replace(/\\/g, "/")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`);
}

/**
 * An esbuild plugin to mark component definitions external or return a list of
 * all component definitions.
 *
 * By default this plugin runs in "bundle" mode and marks all imported component
 * definition files as external, not traversing further.
 *
 * If "discover" mode is specified it traverses the entire tree.
 */
function componentPlugin({
  mode = "bundle",
  rootComponentDirectory,
  verbose,
  ctx,
}: {
  mode: "discover" | "bundle";
  rootComponentDirectory: ComponentDirectory;
  verbose?: boolean;
  ctx: Context;
}): Plugin {
  const components = new Map<string, ComponentDirectory>();
  return {
    name: `convex-${mode === "discover" ? "discover-components" : "bundle-components"}`,
    async setup(build) {
      // This regex can't be really precise since developers could import
      // "convex.config", "convex.config.js", "convex.config.ts", etc.
      build.onResolve({ filter: /.*convex.config.*/ }, async (args) => {
        verbose && logMessage("esbuild resolving import:", args);
        if (
          args.namespace !== "file" &&
          args.namespace !== VIRTUAL_CONFIG_NAMESPACE
        ) {
          verbose && logMessage("  Not a file or virtual config.");
          return;
        }
        if (args.kind === "entry-point") {
          verbose && logMessage("  -> Top-level entry-point.");
          const componentDirectory = await buildComponentDirectory(
            ctx,
            path.resolve(args.path),
          );

          // No attempt to resolve args.path is made for entry points so they
          // must be relative or absolute file paths, not npm packages.
          // Whether we're bundling or discovering, we're done.
          if (components.get(args.path)) {
            // We always invoke esbuild in a try/catch.
            // eslint-disable-next-line no-restricted-syntax
            throw new Error(
              `Entry point component "${args.path}" already registered.`,
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
        let resolvedPath = undefined;
        for (const candidate of candidates) {
          const result = await build.resolve(candidate, {
            // We expect this to be "import-statement" but pass 'kind' through
            // to say honest to normal esbuild behavior.
            kind: args.kind,
            resolveDir: args.resolveDir,
          });
          if (result.path) {
            resolvedPath = result.path;
            break;
          }
        }
        if (resolvedPath === undefined) {
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

        verbose &&
          logMessage(
            "  -> Component import! Recording it.",
            args.path,
            resolvedPath,
          );

        if (mode === "discover") {
          return {
            path: resolvedPath,
          };
        } else {
          // In bundle mode, transform external imports to use componentPaths:
          // import rateLimiter from "convex_ratelimiter";
          // => import rateLimiter from `_componentDeps/${base64('../node_modules/convex_ratelimiter')}`;

          // A componentPath is path from the root component to the directory
          // of the this component's definition file.
          const componentPath = toComponentDefinitionPath(
            rootComponentDirectory,
            imported,
          );
          const importPath = definitionImportPath(componentPath);
          return {
            path: importPath,
            external: true,
          };
        }
      });
    },
  };
}

/** The path on the deployment that identifier a component definition. */
function definitionImportPath(componentPath: ComponentDefinitionPath): string {
  return `./_componentDeps/${Buffer.from(componentPath).toString("base64url")}`;
}

// Share configuration between the component definition discovery and bundling passes.
function sharedEsbuildOptions({
  liveComponentSources = false,
}: {
  liveComponentSources?: boolean;
}) {
  const options = {
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "esnext",

    conditions: ["convex", "module"] as string[],

    // `false` is the default for splitting. It's simpler to evaluate these on
    // the server as a single file.
    // Splitting could be enabled for speed once the server supports it.
    splitting: false,

    // place output files in memory at their source locations
    write: false,
    outdir: path.parse(process.cwd()).root,
    outbase: path.parse(process.cwd()).root,

    minify: true, // Note that this implies NODE_ENV="production".
    keepNames: true,

    metafile: true,
  } as const satisfies BuildOptions;

  // Link directly to component sources (usually .ts) in order to
  // skip the build step. This also causes codegen to run for components
  // loaded from npm packages.
  if (liveComponentSources) {
    options.conditions.push("@convex-dev/component-source");
  }
  return options;
}

// Use the esbuild metafile to discover the dependency graph in which component
// definitions are nodes.
export async function componentGraph(
  ctx: Context,
  absWorkingDir: string,
  rootComponentDirectory: ComponentDirectory,
  liveComponentSources: boolean,
  verbose: boolean = true,
): Promise<{
  components: Map<string, ComponentDirectory>;
  dependencyGraph: [ComponentDirectory, ComponentDirectory][];
}> {
  if (
    rootComponentDirectory.isRootWithoutConfig &&
    !rootComponentDirectory.syntheticComponentImport
  ) {
    return {
      components: new Map([
        [rootComponentDirectory.path, rootComponentDirectory],
      ]),
      dependencyGraph: [],
    };
  }
  let result;
  try {
    result = await esbuild.build({
      absWorkingDir, // This is mostly useful for formatting error messages.
      entryPoints: [qualifiedDefinitionPath(rootComponentDirectory)],
      plugins: [
        componentPlugin({
          ctx,
          mode: "discover",
          verbose,
          rootComponentDirectory,
        }),
        ...(rootComponentDirectory.syntheticComponentImport
          ? [
              virtualConfig({
                rootComponentDirectory,
                importComponentPath:
                  rootComponentDirectory.syntheticComponentImport,
              }),
            ]
          : []),
      ],
      sourcemap: "external",
      sourcesContent: false,

      ...sharedEsbuildOptions({ liveComponentSources }),
    });
    await registerEsbuildReads(ctx, absWorkingDir, result.metafile);
  } catch (err: any) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `esbuild failed: ${err}`,
    });
  }

  if (result.errors.length) {
    const message = result.errors.map((error) => error.text).join("\n");
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: message,
    });
  }
  for (const warning of result.warnings) {
    logWarning(chalk.yellow(`esbuild warning: ${warning.text}`));
  }

  if (rootComponentDirectory.syntheticComponentImport) {
    // Virtual configs appear in the metafile with a namespace prefix
    // and can't have ComponentDirectory objects built by reading the filesystem
    // so swap in this rootComponentDirectory.
    return await findComponentDependencies(ctx, result.metafile, {
      [`${VIRTUAL_CONFIG_NAMESPACE}:${qualifiedDefinitionPath(rootComponentDirectory)}`]:
        rootComponentDirectory,
    });
  }

  return await findComponentDependencies(ctx, result.metafile);
}

/**
 * Get dependencies of a ComponenDirectory as ComponentPaths.
 *
 * Component paths are paths relative to the root component.
 */
export function getDeps(
  rootComponent: ComponentDirectory,
  dependencyGraph: [ComponentDirectory, ComponentDirectory][],
  definitionPath: string,
): ComponentDefinitionPath[] {
  return dependencyGraph
    .filter(
      ([importer, _imported]) => importer.definitionPath === definitionPath,
    )
    .map(([_importer, imported]) =>
      toComponentDefinitionPath(rootComponent, imported),
    );
}

/**
 * The returned dependency graph is an array of tuples of [importer, imported]
 *
 * This doesn't work on just any esbuild metafile because it assumes input
 * imports have not been transformed. We run it on the metafile produced by
 * the esbuild invocation that uses the component plugin in "discover" mode.
 *
 * @param inputOverrides - ComponentDirectory objects to be used for metafile.inputs
 * keys, in case they don't exist (namely virtual configs via esbuild plugin namespaces).
 */
async function findComponentDependencies(
  ctx: Context,
  metafile: Metafile,
  inputOverrides: Record<string, ComponentDirectory> = {},
): Promise<{
  components: Map<string, ComponentDirectory>;
  dependencyGraph: [ComponentDirectory, ComponentDirectory][];
}> {
  const { inputs } = metafile;

  const componentsByKey = new Map<string, ComponentDirectory>();
  for (const inputPath of Object.keys(inputs)) {
    if (!inputPath.includes(".config.")) continue;

    const override: ComponentDirectory | undefined = inputOverrides[inputPath];
    if (override) {
      componentsByKey.set(inputPath, override);
    } else {
      // Normal component - build from filesystem
      const component = await buildComponentDirectory(ctx, inputPath);
      componentsByKey.set(path.resolve(inputPath), component);
    }
  }

  const dependencyGraph: [ComponentDirectory, ComponentDirectory][] = [];

  for (const inputPath of Object.keys(inputs)) {
    if (!inputPath.includes(".config.")) continue;

    // For overridden inputs, use the original key; for normal components, use resolved path
    const importerKey =
      inputPath in inputOverrides ? inputPath : path.resolve(inputPath);

    const importer = componentsByKey.get(importerKey);
    if (!importer) continue;

    const { imports } = inputs[inputPath];
    const componentImports = imports.filter((imp) =>
      imp.path.includes(".config."),
    );

    for (const imp of componentImports) {
      const imported = componentsByKey.get(path.resolve(imp.path));
      if (!imported) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: `Didn't find ${path.resolve(imp.path)} in ${[...componentsByKey.keys()].toString()}`,
        });
      }

      // Grab the import specifier from the metafile (e.g. `@convex-dev/workpool/convex.config`) so
      // we can use it to import component APIs
      if (imp.original) {
        const importSpecifier = imp.original;
        const relativeSpecifier = importSpecifier.replace(
          /\/convex\.config.*$/,
          "",
        );

        imported.importSpecifier = relativeSpecifier;
      }

      dependencyGraph.push([importer, imported]);
    }
  }

  const components = new Map<string, ComponentDirectory>();
  for (const directory of componentsByKey.values()) {
    components.set(directory.path, directory);
  }

  return { components, dependencyGraph };
}

// NB: If a directory linked to is not a member of the passed
// componentDirectories array then there will be external links
// with no corresponding definition bundle.
// That could be made to throw an error but maybe those are already available
// on the Convex definition filesystem somehow, e.g. builtin components.
/** Bundle the component definitions listed. */
export async function bundleDefinitions(
  ctx: Context,
  absWorkingDir: string,
  dependencyGraph: [ComponentDirectory, ComponentDirectory][],
  rootComponentDirectory: ComponentDirectory,
  componentDirectories: ComponentDirectory[],
  liveComponentSources: boolean,
  verbose: boolean = false,
): Promise<{
  appDefinitionSpecWithoutImpls: AppDefinitionSpecWithoutImpls;
  componentDefinitionSpecsWithoutImpls: ComponentDefinitionSpecWithoutImpls[];
}> {
  let result;
  try {
    let plugins = [
      componentPlugin({
        ctx,
        mode: "bundle",
        verbose,
        rootComponentDirectory,
      }),
    ];
    if (
      rootComponentDirectory.syntheticComponentImport ||
      rootComponentDirectory.isRootWithoutConfig
    ) {
      // Use virtual config (either with a component import or empty)
      plugins.push(
        virtualConfig(
          rootComponentDirectory.syntheticComponentImport
            ? {
                rootComponentDirectory,
                importComponentPath:
                  rootComponentDirectory.syntheticComponentImport,
              }
            : { rootComponentDirectory },
        ),
      );
    }
    result = await esbuild.build({
      absWorkingDir,
      entryPoints: componentDirectories.map((dir) =>
        qualifiedDefinitionPath(dir),
      ),
      plugins,
      sourcemap: true,
      ...sharedEsbuildOptions({ liveComponentSources }),
    });
    await registerEsbuildReads(ctx, absWorkingDir, result.metafile);
  } catch (err: any) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `esbuild failed: ${err}`,
    });
  }

  if (result.errors.length) {
    const message = result.errors.map((error) => error.text).join("\n");
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: message,
    });
  }
  for (const warning of result.warnings) {
    logWarning(chalk.yellow(`esbuild warning: ${warning.text}`));
  }

  const outputs: {
    outputJs: OutputFile;
    outputJsMap?: OutputFile;
    directory: ComponentDirectory;
  }[] = [];
  for (const directory of componentDirectories) {
    const absInput = path.resolve(absWorkingDir, directory.definitionPath);
    const expectedOutputJs =
      absInput.slice(0, absInput.lastIndexOf(".")) + ".js";
    const expectedOutputMap =
      absInput.slice(0, absInput.lastIndexOf(".")) + ".js.map";
    const outputJs = result.outputFiles.filter(
      (outputFile) => outputFile.path === expectedOutputJs,
    )[0];
    if (!outputJs) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `no JS found matching ${expectedOutputJs} in ${result.outputFiles.map((x) => x.path).toString()}`,
      });
    }
    const outputJsMap = result.outputFiles.filter(
      (outputFile) => outputFile.path === expectedOutputMap,
    )[0];
    outputs.push({
      outputJs,
      outputJsMap,
      directory,
    });
  }

  const appBundles = outputs.filter(
    (out) => out.directory.path === rootComponentDirectory.path,
  );
  if (appBundles.length !== 1) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "found wrong number of app bundles",
    });
  }
  const appBundle = appBundles[0];
  const componentBundles = outputs.filter(
    (out) => out.directory.path !== rootComponentDirectory.path,
  );

  const componentDefinitionSpecsWithoutImpls: ComponentDefinitionSpecWithoutImpls[] =
    componentBundles.map(({ directory, outputJs, outputJsMap }) => ({
      definitionPath: toComponentDefinitionPath(
        rootComponentDirectory,
        directory,
      ),
      definition: {
        path: path.relative(directory.path, outputJs.path),
        source: outputJs.text,
        sourceMap: outputJsMap?.text,
        environment: "isolate" as const,
      },
      dependencies: getDeps(
        rootComponentDirectory,
        dependencyGraph,
        directory.definitionPath,
      ),
    }));
  const appDeps = getDeps(
    rootComponentDirectory,
    dependencyGraph,
    appBundle.directory.definitionPath,
  );
  const appDefinitionSpecWithoutImpls: AppDefinitionSpecWithoutImpls = {
    definition: {
      path: path.relative(rootComponentDirectory.path, appBundle.outputJs.path),
      source: appBundle.outputJs.text,
      sourceMap: appBundle.outputJsMap?.text,
      environment: "isolate" as const,
    },
    dependencies: appDeps,
  };
  return {
    appDefinitionSpecWithoutImpls,
    componentDefinitionSpecsWithoutImpls,
  };
}

export async function bundleImplementations(
  ctx: Context,
  rootComponentDirectory: ComponentDirectory,
  componentDirectories: ComponentDirectory[],
  nodeExternalPackages: string[],
  extraConditions: string[],
  verbose: boolean = false,
): Promise<{
  appImplementation: {
    schema: Bundle | null;
    functions: Bundle[];
    externalNodeDependencies: NodeDependency[];
  };
  componentImplementations: {
    schema: Bundle | null;
    functions: Bundle[];
    definitionPath: ComponentDefinitionPath;
  }[];
}> {
  let appImplementation;
  const componentImplementations = [];

  // For --component-dir flag, skip bundling root implementations (no real code to bundle)
  const directoriesToBundle = rootComponentDirectory.syntheticComponentImport
    ? componentDirectories
    : [rootComponentDirectory, ...componentDirectories];

  for (const directory of directoriesToBundle) {
    const isRoot = directory.path === rootComponentDirectory.path;
    const resolvedPath = path.resolve(
      rootComponentDirectory.path,
      directory.path,
    );
    let schema;
    if (ctx.fs.exists(path.resolve(resolvedPath, "schema.ts"))) {
      schema =
        (await bundleSchema(ctx, resolvedPath, extraConditions))[0] || null;
    } else if (ctx.fs.exists(path.resolve(resolvedPath, "schema.js"))) {
      schema =
        (await bundleSchema(ctx, resolvedPath, extraConditions))[0] || null;
    } else {
      schema = null;
    }

    const entryPoints = await entryPointsByEnvironment(ctx, resolvedPath);
    const convexResult: {
      modules: Bundle[];
      externalDependencies: Map<string, string>;
      bundledModuleNames: Set<string>;
    } = await bundle(
      ctx,
      resolvedPath,
      entryPoints.isolate,
      true,
      "browser",
      undefined,
      undefined,
      extraConditions,
    );

    if (convexResult.externalDependencies.size !== 0) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "external dependencies not supported",
      });
    }
    const functions = convexResult.modules;
    if (isRoot) {
      if (verbose) {
        showSpinner("Bundling modules for Node.js runtime...");
      }
      const nodeResult: {
        modules: Bundle[];
        externalDependencies: Map<string, string>;
        bundledModuleNames: Set<string>;
      } = await bundle(
        ctx,
        resolvedPath,
        entryPoints.node,
        true,
        "node",
        path.join("_deps", "node"),
        nodeExternalPackages,
        extraConditions,
      );

      const externalNodeDependencies: NodeDependency[] = [];
      for (const [
        moduleName,
        moduleVersion,
      ] of nodeResult.externalDependencies) {
        externalNodeDependencies.push({
          name: moduleName,
          version: moduleVersion,
        });
      }
      const authBundle = await bundleAuthConfig(ctx, resolvedPath);
      appImplementation = {
        schema,
        functions: functions.concat(nodeResult.modules).concat(authBundle),
        externalNodeDependencies,
      };
    } else {
      // Reject push if components have node bundles in non-root directories.
      if (directory.path !== rootComponentDirectory.path) {
        const nodeResult: {
          modules: Bundle[];
          externalDependencies: Map<string, string>;
          bundledModuleNames: Set<string>;
        } = await bundle(
          ctx,
          resolvedPath,
          entryPoints.node,
          true,
          "node",
          path.join("_deps", "node"),
          nodeExternalPackages,
          extraConditions,
        );
        if (nodeResult.modules.length > 0) {
          // TODO(ENG-7116) Remove error and bundle the component node actions when we are ready to support them.
          await ctx.crash({
            exitCode: 1,
            errorType: "invalid filesystem data",
            printedMessage: `"use node" directive is not supported in components. Remove it from the component at: ${resolvedPath}.`,
          });
        }
      }
      // definitionPath is the canonical form
      const definitionPath = toComponentDefinitionPath(
        rootComponentDirectory,
        directory,
      );
      componentImplementations.push({ definitionPath, schema, functions });
    }
  }

  if (!appImplementation) {
    // For --component-dir flag, we don't bundle root implementations so provide an empty one
    if (rootComponentDirectory.syntheticComponentImport) {
      appImplementation = {
        schema: null,
        functions: [],
        externalNodeDependencies: [],
      };
    } else {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "No app implementation found",
      });
    }
  }

  return { appImplementation, componentImplementations };
}

async function registerEsbuildReads(
  ctx: Context,
  absWorkingDir: string,
  metafile: Metafile,
) {
  for (const [relPath, input] of Object.entries(metafile.inputs)) {
    if (
      // We rewrite these files so this integrity check isn't useful.
      path.basename(relPath).includes("convex.config") ||
      // TODO: esbuild outputs paths prefixed with "(disabled)" when bundling our internal
      // udf-system package. The files do actually exist locally, though.
      relPath.indexOf("(disabled):") !== -1 ||
      relPath.startsWith("wasm-binary:") ||
      relPath.startsWith("wasm-stub:")
    ) {
      continue;
    }
    const absPath = path.resolve(absWorkingDir, relPath);
    const st = ctx.fs.stat(absPath);
    if (st.size !== input.bytes) {
      // Consider this a transient error so we'll try again and hopefully
      // no files change right after esbuild next time.
      logWarning(
        `Bundled file ${absPath} changed right after esbuild invocation`,
      );
      return await ctx.crash({
        exitCode: 1,
        errorType: "transient",
        printedMessage: null,
      });
    }
    ctx.fs.registerPath(absPath, st);
  }
}
