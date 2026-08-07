import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'rollup';
import { glob } from 'tinyglobby';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { bundleExternals } from '../analyze/bundleExternals';
import type { BundlerOptions, DependencyMetadata } from '../types';
import type { BundlerPlatform } from '../utils';
import { getCompiledDepCachePath, getPackageName, slash } from '../utils';

const SOURCE_GLOBS = ['**/*.{ts,tsx,js,jsx,mjs,cjs,json}'];
const SOURCE_IGNORE = ['**/node_modules/**', '**/.cache/**'];

export type WorkspaceDepsWatcherOptions = {
  depsToOptimize: Map<string, DependencyMetadata>;
  /**
   * Optimized dependency → relative cache file path (from analyzeBundle.dependencies).
   * Used to detect missing cache files that must be regenerated.
   */
  optimizedDependencyFiles: Map<string, string>;
  workspaceMap: Map<string, WorkspacePackageInfo>;
  workspaceRoot: string;
  outputDir: string;
  platform: BundlerPlatform;
  bundlerOptions?: Pick<BundlerOptions, 'externals' | 'enableSourcemap' | 'dynamicPackages'> | null;
};

/**
 * During `mastra dev`, workspace packages are pre-transpiled into
 * `<pkg>/node_modules/.cache/*.mjs` and marked external in the main Rollup
 * watch graph. This plugin:
 * 1. Watches the original workspace package sources so edits trigger rebuilds.
 * 2. Regenerates the optimized `.cache` outputs when those sources change (or
 *    when cache files are missing) before the rebuild finishes — so a later
 *    server restart loads fresh package code.
 */
export function workspaceDepsWatcher(options: WorkspaceDepsWatcherOptions): Plugin {
  const { depsToOptimize, optimizedDependencyFiles, workspaceMap, workspaceRoot, outputDir, platform, bundlerOptions } =
    options;

  let isFirstBuild = true;

  const usedPackageRoots = collectUsedPackageRoots(depsToOptimize, workspaceMap);
  const cachePaths = collectAbsoluteCachePaths(optimizedDependencyFiles, workspaceRoot);

  return {
    name: 'workspace-deps-watcher',
    async buildStart() {
      const sourceFiles = await discoverWorkspaceSourceFiles(usedPackageRoots);

      for (const file of sourceFiles) {
        this.addWatchFile(resolve(file));
      }

      // Initial optimize already ran in getWatcherInputOptions / analyzeBundle.
      if (isFirstBuild) {
        isFirstBuild = false;
        return;
      }

      const needsReoptimize = await isWorkspaceOutputStale(sourceFiles, cachePaths);

      if (!needsReoptimize) {
        return;
      }

      // bundleExternals may mutate the map when externalsPreset is true; copy first.
      const depsCopy = cloneDepsToOptimize(depsToOptimize);

      await bundleExternals(depsCopy, outputDir, {
        bundlerOptions: {
          ...bundlerOptions,
          externals: bundlerOptions?.externals ?? true,
          isDev: true,
        },
        projectRoot: workspaceRoot,
        workspaceRoot,
        workspaceMap,
        platform,
      });
    },
  };
}

function collectUsedPackageRoots(
  depsToOptimize: Map<string, DependencyMetadata>,
  workspaceMap: Map<string, WorkspacePackageInfo>,
): string[] {
  const roots = new Set<string>();

  for (const [dep, metadata] of depsToOptimize.entries()) {
    if (!metadata.isWorkspace) {
      continue;
    }

    if (metadata.rootPath) {
      roots.add(slash(metadata.rootPath));
      continue;
    }

    const pkgName = getPackageName(dep);
    const location = pkgName ? workspaceMap.get(pkgName)?.location : undefined;
    if (location) {
      roots.add(slash(location));
    }
  }

  return Array.from(roots);
}

function collectAbsoluteCachePaths(optimizedDependencyFiles: Map<string, string>, workspaceRoot: string): string[] {
  return Array.from(optimizedDependencyFiles.values()).map(relativePath => resolve(workspaceRoot, relativePath));
}

async function discoverWorkspaceSourceFiles(packageRoots: string[]): Promise<string[]> {
  if (packageRoots.length === 0) {
    return [];
  }

  const files = await Promise.all(
    packageRoots.map(root =>
      glob(SOURCE_GLOBS, {
        cwd: root,
        absolute: true,
        ignore: SOURCE_IGNORE,
        onlyFiles: true,
      }),
    ),
  );

  return files.flat();
}

async function isCacheMissing(cachePaths: string[]): Promise<boolean> {
  for (const cachePath of cachePaths) {
    if (!existsSync(cachePath)) {
      return true;
    }
  }
  return false;
}

async function isWorkspaceOutputStale(sourceFiles: string[], cachePaths: string[]): Promise<boolean> {
  if (await isCacheMissing(cachePaths)) {
    return true;
  }

  let cacheBaselineMs = 0;
  for (const cachePath of cachePaths) {
    try {
      const { mtimeMs } = await stat(cachePath);
      cacheBaselineMs = Math.max(cacheBaselineMs, mtimeMs);
    } catch {
      return true;
    }
  }

  for (const file of sourceFiles) {
    try {
      const { mtimeMs } = await stat(file);
      if (mtimeMs > cacheBaselineMs) {
        return true;
      }
    } catch {
      // File may have been deleted; treat as dirty so we re-optimize.
      return true;
    }
  }

  return false;
}

function cloneDepsToOptimize(deps: Map<string, DependencyMetadata>): Map<string, DependencyMetadata> {
  const copy = new Map<string, DependencyMetadata>();
  for (const [dep, metadata] of deps.entries()) {
    copy.set(dep, {
      ...metadata,
      exports: [...metadata.exports],
    });
  }
  return copy;
}

/**
 * On-disk cache entry path for a workspace dependency after optimization.
 * Naming matches createVirtualDependencies: dep.replaceAll('/', '__').
 */
export function getWorkspaceDepCacheEntryPath(rootPath: string, dep: string): string {
  const fileName = dep.replaceAll('/', '__');
  return `${getCompiledDepCachePath(rootPath, fileName)}.mjs`;
}
