import { noopLogger, type IMastraLogger } from '@mastra/core/logger';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import virtual from '@rollup/plugin-virtual';
import { fileURLToPath } from 'node:url';
import { rollup, type OutputChunk, type Plugin, type SourceMap } from 'rollup';
import resolveFrom from 'resolve-from';
import { esbuild } from '../plugins/esbuild';
import { isNodeBuiltin } from '../isNodeBuiltin';
import { removeDeployer } from '../plugins/remove-deployer';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import { getPackageName, getPackageRootPath } from '../utils';
import { type WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import type { DependencyMetadata } from '../types';
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
  const normalizedMastraEntry = mastraEntry.replaceAll('\\', '/');
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
      tsConfigPaths(),
      {
        name: 'custom-alias-resolver',
        resolveId(id: string) {
          if (id === '#server') {
            return fileURLToPath(import.meta.resolve('@mastra/deployer/server')).replaceAll('\\', '/');
          }
          if (id === '#mastra') {
            return normalizedMastraEntry;
          }
          if (id.startsWith('@mastra/server')) {
            return fileURLToPath(import.meta.resolve(id));
          }
        },
      } satisfies Plugin,
      json(),
      esbuild(),
      commonjs({
        strictRequires: 'debug',
        ignoreTryCatch: false,
        transformMixedEsModules: true,
        extensions: ['.js', '.ts'],
      }),
      removeDeployer(mastraEntry, { sourcemap: sourcemapEnabled }),
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
  }: {
    logger: IMastraLogger;
  },
): Promise<Map<string, DependencyMetadata>> {
  const depsToOptimize = new Map<string, DependencyMetadata>();

  for (const [dependency, bindings] of Object.entries(output.importedBindings)) {
    if (isNodeBuiltin(dependency) || DEPS_TO_IGNORE.includes(dependency)) {
      continue;
    }

    // The `getPackageName` helper also handles subpaths so we only get the proper package name
    const pkgName = getPackageName(dependency);
    let rootPath: string | null = null;
    let isWorkspace = false;

    if (pkgName) {
      rootPath = await getPackageRootPath(pkgName);
      isWorkspace = workspaceMap.has(pkgName);
    }

    depsToOptimize.set(dependency, { exports: bindings, rootPath, isWorkspace });
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

      try {
        // Absolute path to the dependency
        const resolvedPath = resolveFrom(projectRoot, dep);

        if (!resolvedPath) {
          logger.warn(`Could not resolve path for workspace dependency ${dep}`);
          continue;
        }

        const analysis = await analyzeEntry({ entry: resolvedPath, isVirtualFile: false }, '', {
          workspaceMap,
          projectRoot,
          logger: noopLogger,
          sourcemapEnabled: false,
        });

        if (!analysis?.dependencies) {
          continue;
        }

        for (const [innerDep, innerMeta] of analysis.dependencies) {
          /**
           * Only add to depsToOptimize if:
           * - It's a workspace package
           * - We haven't already processed it
           * - We haven't already discovered it at the beginning
           */
          if (innerMeta.isWorkspace && !internalMap.has(innerDep) && !depsToOptimize.has(innerDep)) {
            depsToOptimize.set(innerDep, innerMeta);
            internalMap.set(innerDep, innerMeta);
            hasAddedDeps = true;
          }
        }
      } catch (err) {
        logger.error(`Failed to resolve or analyze dependency ${dep}: ${(err as Error).message}`);
      }
    }

    // Continue until no new deps are found
    if (hasAddedDeps) {
      await checkTransitiveDependencies(internalMap, maxDepth, currentDepth + 1);
    }
  }

  await checkTransitiveDependencies(new Map());

  // #tools is a generated dependency, we don't want our analyzer to handle it
  const dynamicImports = output.dynamicImports.filter(d => !DEPS_TO_IGNORE.includes(d));
  if (dynamicImports.length) {
    for (const dynamicImport of dynamicImports) {
      if (!depsToOptimize.has(dynamicImport) && !isNodeBuiltin(dynamicImport)) {
        depsToOptimize.set(dynamicImport, { exports: ['*'], rootPath: null, isWorkspace: false });
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
 * @returns A promise that resolves to an object containing the analyzed dependencies and generated output
 */
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
  }: {
    logger: IMastraLogger;
    sourcemapEnabled: boolean;
    workspaceMap: Map<string, WorkspacePackageInfo>;
    projectRoot: string;
  },
): Promise<{
  dependencies: Map<string, DependencyMetadata>;
  output: {
    code: string;
    map: SourceMap | null;
  };
}> {
  const optimizerBundler = await rollup({
    logLevel: process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent',
    input: isVirtualFile ? '#entry' : entry,
    treeshake: 'smallest',
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
  });

  return {
    dependencies: depsToOptimize,
    output: {
      code: output[0].code,
      map: output[0].map as SourceMap,
    },
  };
}
