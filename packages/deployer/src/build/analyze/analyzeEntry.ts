import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IMastraLogger } from '@mastra/core/logger';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import virtual from '@rollup/plugin-virtual';
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

const workspaceRootEntryCache = new Map<string, boolean>();

/**
 * True if a workspace package can be imported at its root (`import '<pkg>'`).
 * A package with an `exports` map that declares only subpaths (no ".") cannot be imported at
 * its root, so fabricating a synthetic `export * from '<pkg>'` for it makes the deployer's
 * alias-optimized-deps resolver throw `Missing "." specifier`. Permissive by default: only
 * returns false when we are certain there is no root entry.
 */
function workspacePackageHasRootEntry(location: string): boolean {
  const cached = workspaceRootEntryCache.get(location);
  if (cached !== undefined) {
    return cached;
  }

  let hasRoot = true;
  try {
    const pkgJson = JSON.parse(readFileSync(join(location, 'package.json'), 'utf-8'));
    const exp = pkgJson.exports;
    // exp == null   -> no map, main/index fallback applies -> has root
    // typeof string -> string sugar IS the root            -> has root
    if (exp != null && typeof exp === 'object' && !Array.isArray(exp)) {
      const keys = Object.keys(exp);
      const hasSubpathKeys = keys.some(k => k.startsWith('./'));
      // A conditions-only object (no "./..." keys) represents the root itself.
      // Once there are subpath keys, the root resolves only if "." is present.
      hasRoot = hasSubpathKeys ? keys.includes('.') : true;
    }
  } catch {
    hasRoot = true;
  }

  workspaceRootEntryCache.set(location, hasRoot);
  return hasRoot;
}

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
  {
    logger,
    shouldCheckTransitiveDependencies,
  }: {
    logger: IMastraLogger;
    shouldCheckTransitiveDependencies: boolean;
  },
): Promise<Map<string, DependencyMetadata>> {
  const depsToOptimize = new Map<string, DependencyMetadata>();

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

  const processedWorkspaceDeps = new Set<string>();

  /**
   * Recursively discovers transitive workspace dependencies from package manifests.
   */
  function checkTransitiveDependencies(maxDepth = 10, currentDepth = 0) {
    // Could be a circular dependency...
    if (currentDepth >= maxDepth) {
      logger.warn('Maximum dependency depth reached while checking transitive dependencies.');
      return;
    }

    // Make a copy so that we can safely iterate over it
    const depsSnapshot = new Map(depsToOptimize);
    let hasAddedDeps = false;

    for (const [dep, meta] of depsSnapshot) {
      const pkgName = getPackageName(dep);
      // We only care about workspace deps that we haven't already processed
      if (!pkgName || !meta.isWorkspace || processedWorkspaceDeps.has(pkgName)) {
        continue;
      }

      processedWorkspaceDeps.add(pkgName);

      const workspaceInfo = workspaceMap.get(pkgName);
      if (!workspaceInfo?.dependencies) {
        continue;
      }

      for (const [innerDep, _innerDepVersion] of Object.entries(workspaceInfo.dependencies)) {
        const innerWorkspaceInfo = workspaceMap.get(innerDep);
        if (!innerWorkspaceInfo) {
          continue;
        }

        const existingMeta = depsToOptimize.get(innerDep);
        if (existingMeta) {
          depsToOptimize.set(innerDep, {
            ...existingMeta,
            exports: existingMeta.exports.includes('*') ? existingMeta.exports : [...existingMeta.exports, '*'],
          });
          continue;
        }

        if (!workspacePackageHasRootEntry(innerWorkspaceInfo.location)) {
          // Subpath-only workspace package: it cannot be imported at its root, so a synthetic
          // `export * from '<pkg>'` would make the resolver throw under `externals: true` / dev.
          // The subpaths that ARE imported are captured independently from `output.importedBindings`,
          // so skipping the fabricated root drops nothing.
          logger.debug(
            `Skipping synthetic root export for workspace package "${innerDep}" - it declares only subpath exports.`,
          );
          continue;
        }

        depsToOptimize.set(innerDep, {
          exports: ['*'],
          rootPath: slash(innerWorkspaceInfo.location),
          isWorkspace: true,
          version: innerWorkspaceInfo.version,
        });
        hasAddedDeps = true;
      }
    }

    // Continue until no new deps are found
    if (hasAddedDeps) {
      checkTransitiveDependencies(maxDepth, currentDepth + 1);
    }
  }

  if (shouldCheckTransitiveDependencies) {
    checkTransitiveDependencies();
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
    shouldCheckTransitiveDependencies = false,
    analyzeCache,
  }: {
    logger: IMastraLogger;
    sourcemapEnabled: boolean;
    workspaceMap: Map<string, WorkspacePackageInfo>;
    projectRoot: string;
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

  const depsToOptimize = await captureDependenciesToOptimize(output[0] as OutputChunk, workspaceMap, projectRoot, {
    logger,
    shouldCheckTransitiveDependencies,
  });

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
