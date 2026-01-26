import { noopLogger, type IMastraLogger } from '@mastra/core/logger';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import virtual from '@rollup/plugin-virtual';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rollup, type OutputChunk, type Plugin, type SourceMap } from 'rollup';
import { resolveModule } from 'local-pkg';
import { readJSON } from 'fs-extra/esm';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as resolve from 'resolve.exports';
import { esbuild } from '../plugins/esbuild';
import { isNodeBuiltin } from '../isNodeBuiltin';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import { getPackageName, slash } from '../utils';
import { getPackageRootPath } from '../package-info';
import { type WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import type { DependencyMetadata } from '../types';
import { DEPS_TO_IGNORE } from './constants';
import { removeDeployer } from '../plugins/remove-deployer';

/**
 * Configures and returns the Rollup plugins needed for analyzing entry files.
 * Sets up module resolution, transpilation, and custom alias handling for Mastra-specific imports.
 */
function getInputPlugins(
  { entry, isVirtualFile }: { entry: string; isVirtualFile: boolean },
  mastraEntry: string,
  { sourcemapEnabled }: { sourcemapEnabled: boolean },
): Plugin[] {
  const normalizedMastraEntry = slash(mastraEntry);
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
            return slash(fileURLToPath(import.meta.resolve('@mastra/deployer/server')));
          }
          if (id === '#mastra') {
            return normalizedMastraEntry;
          }
          if (id.startsWith('@mastra/server')) {
            return fileURLToPath(import.meta.resolve(id));
          }
        },
      } satisfies Plugin,
      // Resolve dependencies when importing from workspace @mastra/* packages
      {
        name: 'workspace-deps-resolver',
        async resolveId(id: string, importer: string | undefined) {
          // Skip if no importer or if it's already resolved
          if (!importer || id.startsWith('/') || id.startsWith('.')) {
            return null;
          }

          // Check if the importer is from a workspace @mastra/* package
          const monorepoRoot = path.resolve(import.meta.dirname, '../../..');
          const workspaceDirs = ['packages', 'stores', 'observability', 'deployers', 'voice', 'client-sdks', 'sources', 'routers', 'runners'];

          const isFromWorkspace = workspaceDirs.some(dir =>
            importer.startsWith(path.join(monorepoRoot, dir) + path.sep)
          );

          if (!isFromWorkspace) {
            return null;
          }

          // Try to resolve the dependency from the workspace context
          try {
            const resolved = await getPackageRootPath(id, importer);
            if (resolved) {
              // Return the resolved path for the main entry
              const pkgJsonContent = await readFile(path.join(resolved, 'package.json'), 'utf-8');
              const pkgJson = JSON.parse(pkgJsonContent);
              const mainEntry = pkgJson.main || pkgJson.module || 'index.js';
              return { id: path.join(resolved, mainEntry), external: false };
            }
          } catch {
            // Try resolving from monorepo root's node_modules
            try {
              const resolved = await getPackageRootPath(id, monorepoRoot);
              if (resolved) {
                const pkgJsonContent = await readFile(path.join(resolved, 'package.json'), 'utf-8');
                const pkgJson = JSON.parse(pkgJsonContent);
                const mainEntry = pkgJson.main || pkgJson.module || 'index.js';
                return { id: path.join(resolved, mainEntry), external: false };
              }
            } catch {
              // Let other resolvers handle it
            }
          }

          return null;
        },
      } satisfies Plugin,
      // Resolve @mastra/* packages from workspace directories to ensure consistent versions
      {
        name: 'mastra-package-resolver',
        async resolveId(id: string) {
          // Only handle @mastra/* imports that aren't already resolved
          if (!id.startsWith('@mastra/') || id.startsWith('/') || id.startsWith('.')) {
            return null;
          }

          try {
            // Get the base package name (e.g., @mastra/core from @mastra/core/evals)
            const parts = id.split('/');
            const pkgName = parts[0]!.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]!;
            const subpath = parts.slice(pkgName.split('/').length).join('/');

            // Try to resolve from bundler's context first
            let pkgRoot = await getPackageRootPath(pkgName, import.meta.dirname);

            // If not found, check workspace directories
            // The bundler runs from packages/deployer/dist, so go up 3 levels to reach monorepo root
            if (!pkgRoot) {
              const monorepoRoot = path.resolve(import.meta.dirname, '../../..');
              const shortName = pkgName.replace('@mastra/', '');

              const possibleLocations = [
                path.join(monorepoRoot, 'packages', shortName),
                path.join(monorepoRoot, 'stores', shortName),
                path.join(monorepoRoot, 'observability', shortName),
                path.join(monorepoRoot, 'deployers', shortName),
                path.join(monorepoRoot, 'voice', shortName),
                path.join(monorepoRoot, 'client-sdks', shortName),
                path.join(monorepoRoot, 'sources', shortName),
                path.join(monorepoRoot, 'routers', shortName),
                path.join(monorepoRoot, 'runners', shortName),
                path.join(monorepoRoot, 'observability', 'mastra'),
              ];

              for (const loc of possibleLocations) {
                const pkgJsonPath = path.join(loc, 'package.json');
                if (existsSync(pkgJsonPath)) {
                  try {
                    const pkgJsonContent = await readFile(pkgJsonPath, 'utf-8');
                    const pkg = JSON.parse(pkgJsonContent);
                    if (pkg.name === pkgName) {
                      pkgRoot = loc;
                      break;
                    }
                  } catch {
                    // Ignore read errors
                  }
                }
              }
            }

            if (!pkgRoot) {
              return null;
            }

            // Read package.json to resolve exports
            const pkgJsonBuffer = await readFile(path.join(pkgRoot, 'package.json'), 'utf-8');
            const pkgJson = JSON.parse(pkgJsonBuffer);

            // Resolve the subpath export
            const exportPath = subpath ? `./${subpath}` : '.';
            let resolvedPath: string | undefined;

            if (exportPath === '.') {
              resolvedPath = resolve.exports(pkgJson, '.')?.[0] || pkgJson.main || 'index.js';
            } else {
              resolvedPath = resolve.exports(pkgJson, exportPath)?.[0];
              if (!resolvedPath) {
                resolvedPath = `dist/${subpath}/index.js`;
              }
            }

            if (resolvedPath) {
              const fullPath = path.join(pkgRoot, resolvedPath);
              return { id: fullPath, external: false };
            }
          } catch {
            // Resolution failed, let other resolvers try
          }

          return null;
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
    if (isNodeBuiltin(dependency) || dependency.startsWith('#')) {
      continue;
    }

    // The `getPackageName` helper also handles subpaths so we only get the proper package name
    const pkgName = getPackageName(dependency);
    let rootPath: string | null = null;
    let isWorkspace = false;
    let version: string | undefined;

    if (pkgName) {
      rootPath = await getPackageRootPath(dependency, entryRootPath);
      isWorkspace = workspaceMap.has(pkgName);

      // Read version from package.json when we have a valid rootPath
      if (rootPath) {
        try {
          const pkgJson = await readJSON(`${rootPath}/package.json`);
          version = pkgJson.version;
        } catch {
          // Failed to read package.json, version will remain undefined
        }
      }
    }

    const normalizedRootPath = rootPath ? slash(rootPath) : null;

    depsToOptimize.set(dependency, {
      exports: bindings,
      rootPath: normalizedRootPath,
      isWorkspace,
      version,
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

      try {
        // Absolute path to the dependency using ESM-compatible resolution
        const resolvedPath = resolveModule(dep, {
          paths: [pathToFileURL(projectRoot).href],
        });
        if (!resolvedPath) {
          logger.warn(`Could not resolve path for workspace dependency ${dep}`);
          continue;
        }

        const analysis = await analyzeEntry({ entry: resolvedPath, isVirtualFile: false }, '', {
          workspaceMap,
          projectRoot,
          logger: noopLogger,
          sourcemapEnabled: false,
          initialDepsToOptimize: depsToOptimize,
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

  if (shouldCheckTransitiveDependencies) {
    await checkTransitiveDependencies(initialDepsToOptimize);
  }

  // #tools is a generated dependency, we don't want our analyzer to handle it
  const dynamicImports = output.dynamicImports.filter(d => !DEPS_TO_IGNORE.includes(d));
  if (dynamicImports.length) {
    for (const dynamicImport of dynamicImports) {
      if (!depsToOptimize.has(dynamicImport) && !isNodeBuiltin(dynamicImport)) {
        // Try to resolve version for dynamic imports as well
        const pkgName = getPackageName(dynamicImport);
        let version: string | undefined;
        let rootPath: string | null = null;

        if (pkgName) {
          rootPath = await getPackageRootPath(dynamicImport, entryRootPath);
          if (rootPath) {
            try {
              const pkgJson = await readJSON(`${rootPath}/package.json`);
              version = pkgJson.version;
            } catch {
              // Failed to read package.json
            }
          }
        }

        depsToOptimize.set(dynamicImport, {
          exports: ['*'],
          rootPath: rootPath ? slash(rootPath) : null,
          isWorkspace: false,
          version,
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
  }: {
    logger: IMastraLogger;
    sourcemapEnabled: boolean;
    workspaceMap: Map<string, WorkspacePackageInfo>;
    projectRoot: string;
    initialDepsToOptimize?: Map<string, DependencyMetadata>;
    shouldCheckTransitiveDependencies?: boolean;
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
    },
  );

  return {
    dependencies: depsToOptimize,
    output: {
      code: output[0].code,
      map: output[0].map as SourceMap,
    },
  };
}
