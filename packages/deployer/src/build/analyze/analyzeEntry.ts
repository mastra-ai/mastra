import { pathToFileURL } from 'node:url';
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
  { sourcemapEnabled, env }: { sourcemapEnabled: boolean; env: Record<string, string> },
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
      esbuild({ define: env }),
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
    mastraEntry,
    shouldCheckTransitiveDependencies,
    env,
    analyzeCache,
    activeEntries,
  }: {
    logger: IMastraLogger;
    mastraEntry: string;
    shouldCheckTransitiveDependencies: boolean;
    env: Record<string, string>;
    /** Shared cache to avoid re-analyzing the same entry across recursive calls */
    analyzeCache?: Map<string, AnalyzeEntryResult>;
    /** Resolved entries currently being analyzed in this recursion path */
    activeEntries: Set<string>;
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

  const processedWorkspaceEntries = new Set<string>();

  /**
   * Recursively discovers transitive workspace dependencies from package manifests.
   */
  async function checkTransitiveDependencies() {
    // Make a copy so that we can safely iterate over it
    const depsSnapshot = new Map(depsToOptimize);

    for (const [dep, meta] of depsSnapshot) {
      const pkgName = getPackageName(dep);
      if (!pkgName || !meta.isWorkspace) {
        continue;
      }

      const importerFile = output.facadeModuleId!.startsWith('\x00virtual:')
        ? mastraEntry || projectRoot
        : output.facadeModuleId!;
      const importerPath = pathToFileURL(importerFile).href;
      // Absolute path to the dependency using ESM-compatible resolution
      const resolvedPath = resolveModule(dep, {
        paths: [importerPath],
      });

      if (!resolvedPath) {
        logger.warn('Could not resolve path for workspace dependency', { dep });
        continue;
      }

      const resolvedEntry = slash(resolvedPath);
      if (processedWorkspaceEntries.has(resolvedEntry) || activeEntries.has(resolvedEntry)) {
        continue;
      }

      processedWorkspaceEntries.add(resolvedEntry);

      const analysis = await analyzeEntry({ entry: resolvedPath, isVirtualFile: false }, mastraEntry, {
        workspaceMap,
        projectRoot,
        logger,
        sourcemapEnabled: false,
        env,
        shouldCheckTransitiveDependencies: true,
        analyzeCache,
        activeEntries,
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
        } else {
          depsToOptimize.set(innerDep, {
            exports: innerMeta.exports,
            rootPath: slash(innerMeta.rootPath || ''),
            isWorkspace: true,
            version: innerMeta.version,
          });
        }
      }
    }
  }

  if (shouldCheckTransitiveDependencies) {
    await checkTransitiveDependencies();
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
    env = { 'process.env.NODE_ENV': JSON.stringify('production') },
    shouldCheckTransitiveDependencies = false,
    analyzeCache,
    activeEntries: providedActiveEntries,
  }: {
    logger: IMastraLogger;
    sourcemapEnabled: boolean;
    workspaceMap: Map<string, WorkspacePackageInfo>;
    projectRoot: string;
    env?: Record<string, string>;
    shouldCheckTransitiveDependencies?: boolean;
    /** Shared cache to avoid re-analyzing the same entry across recursive calls */
    analyzeCache?: Map<string, AnalyzeEntryResult>;
    /** Resolved entries currently being analyzed in this recursion path */
    activeEntries?: Set<string>;
  },
): Promise<AnalyzeEntryResult> {
  const resolvedEntry = isVirtualFile ? undefined : slash(entry);
  const effectiveAnalyzeCache = analyzeCache ?? new Map<string, AnalyzeEntryResult>();
  // Transitive analysis produces a different result from direct analysis, so cache them separately.
  const cacheKey = resolvedEntry
    ? `${resolvedEntry}:${shouldCheckTransitiveDependencies ? 'transitive' : 'direct'}`
    : undefined;
  if (cacheKey && effectiveAnalyzeCache.has(cacheKey)) {
    return effectiveAnalyzeCache.get(cacheKey)!;
  }

  const activeEntries = providedActiveEntries ?? new Set<string>();
  const shouldTrackEntry = Boolean(resolvedEntry && !activeEntries.has(resolvedEntry));
  if (resolvedEntry && shouldTrackEntry) {
    activeEntries.add(resolvedEntry);
  }

  try {
    const optimizerBundler = await rollup({
      logLevel: process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent',
      input: isVirtualFile ? '#entry' : entry,
      treeshake: false,
      preserveSymlinks: true,
      plugins: getInputPlugins({ entry, isVirtualFile }, mastraEntry, { sourcemapEnabled, env }),
      external: DEPS_TO_IGNORE,
    });

    const { output } = await (async () => {
      try {
        return await optimizerBundler.generate({
          format: 'esm',
          inlineDynamicImports: true,
        });
      } finally {
        await optimizerBundler.close();
      }
    })();

    const depsToOptimize = await captureDependenciesToOptimize(output[0] as OutputChunk, workspaceMap, projectRoot, {
      logger,
      mastraEntry,
      shouldCheckTransitiveDependencies,
      env,
      analyzeCache: effectiveAnalyzeCache,
      activeEntries,
    });

    const result: AnalyzeEntryResult = {
      dependencies: depsToOptimize,
      output: {
        code: output[0].code,
        map: output[0].map as SourceMap,
      },
    };

    // Cache the result so recursive calls for the same entry are instant
    if (cacheKey) {
      effectiveAnalyzeCache.set(cacheKey, result);
    }

    return result;
  } finally {
    if (resolvedEntry && shouldTrackEntry) {
      activeEntries.delete(resolvedEntry);
    }
  }
}
