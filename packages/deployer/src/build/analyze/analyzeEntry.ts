import { pathToFileURL } from 'node:url';
import { noopLogger } from '@mastra/core/logger';
import type { IMastraLogger } from '@mastra/core/logger';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import virtual from '@rollup/plugin-virtual';
import { resolveModule } from 'local-pkg';
import { rollup } from 'rollup';
import type { OutputChunk, Plugin, SourceMap } from 'rollup';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { mastraInternalAliasPlugin, mastraToolsAliasPlugin } from '../bundler';
import { getPackageMetadata, getPackageRootPath } from '../package-info';
import { esbuild } from '../plugins/esbuild';
import { protocolExternalResolver } from '../plugins/protocol-external-resolver';
import { removeDeployer } from '../plugins/remove-deployer';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import type { DependencyMetadata } from '../types';
import { getPackageName, isBareModuleSpecifier, slash } from '../utils';
import { DEPS_TO_IGNORE } from './constants';

/**
 * Configures and returns the Rollup plugins needed for analyzing entry files.
 * Sets up module resolution, transpilation, and custom alias handling for Mastra-specific imports.
 */
function getInputPlugins(
  { entry, isVirtualFile }: { entry: string; isVirtualFile: boolean },
  mastraEntry: string,
  { sourcemapEnabled }: { sourcemapEnabled: boolean },
): Plugin[] {
  let virtualPlugin = null;
  if (isVirtualFile) {
    virtualPlugin = virtual({
      '#entry': entry,
    });
    entry = '#entry';
  }

  const plugins = [];
  if (virtualPlugin) {
    plugins.push(virtualPlugin);
  }

  plugins.push(
    ...[
      protocolExternalResolver(),
      mastraInternalAliasPlugin(mastraEntry),
      mastraToolsAliasPlugin(),
      tsConfigPaths(),
      json(),
      esbuild(),
      commonjs({
        strictRequires: 'debug',
        ignoreTryCatch: false,
        transformMixedEsModules: true,
        extensions: ['.js', '.ts'],
      }),
      removeDeployer(mastraEntry, {
        sourcemap: sourcemapEnabled,
      }),
      esbuild(),
    ],
  );

  return plugins;
}

/**
 * Extracts and categorizes dependencies from Rollup output to determine which ones need optimization.
 * Analyzes both static imports and dynamic imports while filtering out Node.js built-ins and ignored dependencies.
 * Identifies workspace packages and resolves package root paths for proper bundling optimization.
 */
async function captureDependenciesToOptimize(
  output: OutputChunk,
  workspaceMap: Map<string, WorkspacePackageInfo>,
  projectRoot: string,
  initialDepsToOptimize: Map<string, DependencyMetadata>,
  {
    logger,
    shouldCheckTransitiveDependencies,
    analyzeCache,
  }: {
    logger: IMastraLogger;
    shouldCheckTransitiveDependencies: boolean;
    analyzeCache?: Map<string, AnalyzeEntryResult>;
  },
): Promise<Map<string, DependencyMetadata>> {
  const depsToOptimize = new Map<string, DependencyMetadata>();
  // Tracks, for each transitively-discovered workspace dependency, the file that imports it.
  // Transitive workspace packages must be resolved relative to their actual importer (e.g. `b`
  // resolves `c` from within `b`), not the top-level entry — in strict pnpm layouts the entry
  // package can't see a dependency-of-a-dependency.
  const importerResolvedPaths = new Map<string, string>();

  if (!output.facadeModuleId) {
    throw new Error(
      'Something went wrong, we could not find the package name of the entry file. Please open an issue.',
    );
  }

  let entryRootPath = projectRoot;
  if (!output.facadeModuleId.startsWith('\x00virtual:')) {
    entryRootPath = (await getPackageRootPath(output.facadeModuleId)) || projectRoot;
  }

  for (const [dependency, bindings] of Object.entries(output.importedBindings)) {
    if (!isBareModuleSpecifier(dependency)) {
      continue;
    }

    // The `getPackageName` helper also handles subpaths so we only get the proper package name
    const pkgName = getPackageName(dependency);
    let rootPath: string | null = null;
    let isWorkspace = false;
    let version: string | undefined;
    let packageSpec: string | undefined;

    if (pkgName) {
      const metadata = await getPackageMetadata(dependency, entryRootPath);
      rootPath = metadata.rootPath;
      version = metadata.version;
      packageSpec = metadata.packageSpec;
      isWorkspace = workspaceMap.has(pkgName);
    }

    const normalizedRootPath = rootPath ? slash(rootPath) : null;

    depsToOptimize.set(dependency, {
      exports: bindings,
      rootPath: normalizedRootPath,
      isWorkspace,
      version,
      packageSpec,
    });
  }

  /**
   * Recursively discovers and analyzes transitive workspace dependencies
   */
  async function checkTransitiveDependencies(
    internalMap: Map<string, DependencyMetadata>,
    maxDepth = 10,
    currentDepth = 0,
  ) {
    // Could be a circular dependency...
    if (currentDepth >= maxDepth) {
      logger.warn('Maximum dependency depth reached while checking transitive dependencies.');
      return;
    }

    // Make a copy so that we can safely iterate over it
    const depsSnapshot = new Map(depsToOptimize);
    let hasAddedDeps = false;

    for (const [dep, meta] of depsSnapshot) {
      // We only care about workspace deps that we haven't already processed
      if (!meta.isWorkspace || internalMap.has(dep)) {
        continue;
      }

      // Mark as processed now that we're analyzing it. This must happen when the dependency is
      // analyzed, not when it is first discovered — otherwise a transitively-discovered package
      // would be marked processed before we ever inspect its own dependencies, capping discovery
      // at a single hop.
      internalMap.set(dep, meta);

      try {
        // Resolve the dependency relative to the file that imports it. For directly-imported
        // workspace packages that's the entry; for transitive ones it's the package we found them in.
        const importerPath =
          importerResolvedPaths.get(dep) ??
          (output.facadeModuleId ? pathToFileURL(output.facadeModuleId).href : pathToFileURL(projectRoot).href);
        // Absolute path to the dependency using ESM-compatible resolution
        const resolvedPath = resolveModule(dep, {
          paths: [importerPath],
        });
        if (!resolvedPath) {
          logger.warn('Could not resolve path for workspace dependency', { dep });
          continue;
        }

        const analysis = await analyzeEntry({ entry: resolvedPath, isVirtualFile: false }, '', {
          workspaceMap,
          projectRoot,
          logger: noopLogger,
          sourcemapEnabled: false,
          initialDepsToOptimize: depsToOptimize,
          analyzeCache,
        });

        if (!analysis?.dependencies) {
          continue;
        }

        for (const [innerDep, innerMeta] of analysis.dependencies) {
          if (!innerMeta.isWorkspace) {
            continue;
          }

          const existingMeta = depsToOptimize.get(innerDep);
          if (existingMeta) {
            depsToOptimize.set(innerDep, {
              ...existingMeta,
              exports: [...new Set([...existingMeta.exports, ...innerMeta.exports])],
            });
            continue;
          }

          if (internalMap.has(innerDep)) {
            continue;
          }

          depsToOptimize.set(innerDep, innerMeta);
          // Remember which file imported this transitive dependency so it can be resolved
          // from the correct location when it is analyzed on the next pass. Note we intentionally
          // do NOT add it to internalMap here — that happens when the dependency is analyzed, so
          // discovery doesn't stop after a single hop.
          importerResolvedPaths.set(innerDep, pathToFileURL(resolvedPath).href);
          hasAddedDeps = true;
        }
      } catch (err) {
        logger.error('Failed to resolve or analyze dependency', { dep, error: (err as Error).message });
      }
    }

    // Continue until no new deps are found
    if (hasAddedDeps) {
      await checkTransitiveDependencies(internalMap, maxDepth, currentDepth + 1);
    }
  }

  if (shouldCheckTransitiveDependencies) {
    await checkTransitiveDependencies(initialDepsToOptimize);
  }

  // #tools is a generated dependency, we don't want our analyzer to handle it
  const dynamicImports = output.dynamicImports.filter(d => !DEPS_TO_IGNORE.includes(d));
  if (dynamicImports.length) {
    for (const dynamicImport of dynamicImports) {
      if (!depsToOptimize.has(dynamicImport) && isBareModuleSpecifier(dynamicImport)) {
        // Try to resolve version for dynamic imports as well
        const pkgName = getPackageName(dynamicImport);
        let version: string | undefined;
        let packageSpec: string | undefined;
        let rootPath: string | null = null;

        if (pkgName) {
          const metadata = await getPackageMetadata(dynamicImport, entryRootPath);
          rootPath = metadata.rootPath;
          version = metadata.version;
          packageSpec = metadata.packageSpec;
        }

        depsToOptimize.set(dynamicImport, {
          exports: ['*'],
          rootPath: rootPath ? slash(rootPath) : null,
          isWorkspace: false,
          version,
          packageSpec,
        });
      }
    }
  }

  return depsToOptimize;
}

/**
 * Analyzes the entry file to identify external dependencies and their imports. This allows us to treeshake all code that is not used.
 *
 * @param entryConfig - Configuration object for the entry file
 * @param entryConfig.entry - The entry file path or content
 * @param entryConfig.isVirtualFile - Whether the entry is a virtual file (content string) or a file path
 * @param mastraEntry - The mastra entry point
 * @param options - Configuration options for the analysis
 * @param options.logger - Logger instance for debugging
 * @param options.sourcemapEnabled - Whether sourcemaps are enabled
 * @param options.workspaceMap - Map of workspace packages
 * @param options.shouldCheckTransitiveDependencies - Whether to recursively analyze transitive workspace dependencies (default: false)
 * @returns A promise that resolves to an object containing the analyzed dependencies and generated output
 */
/** Return type of {@link analyzeEntry} */
export type AnalyzeEntryResult = {
  dependencies: Map<string, DependencyMetadata>;
  output: {
    code: string;
    map: SourceMap | null;
  };
};

export async function analyzeEntry(
  {
    entry,
    isVirtualFile,
  }: {
    entry: string;
    isVirtualFile: boolean;
  },
  mastraEntry: string,
  {
    logger,
    sourcemapEnabled,
    workspaceMap,
    projectRoot,
    initialDepsToOptimize = new Map(), // used to avoid infinite recursion
    shouldCheckTransitiveDependencies = false,
    analyzeCache,
  }: {
    logger: IMastraLogger;
    sourcemapEnabled: boolean;
    workspaceMap: Map<string, WorkspacePackageInfo>;
    projectRoot: string;
    initialDepsToOptimize?: Map<string, DependencyMetadata>;
    shouldCheckTransitiveDependencies?: boolean;
    /** Shared cache to avoid re-analyzing the same entry across recursive calls */
    analyzeCache?: Map<string, AnalyzeEntryResult>;
  },
): Promise<AnalyzeEntryResult> {
  // Deduplicate: if this entry was already analyzed, return cached result
  const cacheKey = isVirtualFile ? undefined : slash(entry);
  if (cacheKey && analyzeCache?.has(cacheKey)) {
    return analyzeCache.get(cacheKey)!;
  }

  const optimizerBundler = await rollup({
    logLevel: process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent',
    input: isVirtualFile ? '#entry' : entry,
    treeshake: false,
    preserveSymlinks: true,
    plugins: getInputPlugins({ entry, isVirtualFile }, mastraEntry, { sourcemapEnabled }),
    external: DEPS_TO_IGNORE,
  });

  const { output } = await optimizerBundler.generate({
    format: 'esm',
    inlineDynamicImports: true,
  });

  await optimizerBundler.close();

  const depsToOptimize = await captureDependenciesToOptimize(
    output[0] as OutputChunk,
    workspaceMap,
    projectRoot,
    initialDepsToOptimize,
    {
      logger,
      shouldCheckTransitiveDependencies,
      analyzeCache,
    },
  );

  const result: AnalyzeEntryResult = {
    dependencies: depsToOptimize,
    output: {
      code: output[0].code,
      map: output[0].map as SourceMap,
    },
  };

  // Cache the result so recursive calls for the same entry are instant
  if (cacheKey && analyzeCache) {
    analyzeCache.set(cacheKey, result);
  }

  return result;
}
