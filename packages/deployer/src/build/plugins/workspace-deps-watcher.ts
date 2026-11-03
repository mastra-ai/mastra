import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'rolldown';
import { glob } from 'tinyglobby';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { bundleExternals } from '../analyze/bundleExternals';
import { normalizeExternals } from '../analyze/externals';
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
 * `<pkg>/node_modules/.cache/*.mjs` and marked external in the main Rolldown
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
  let isDirty = false;

  const usedPackageRoots = collectUsedPackageRoots(depsToOptimize, workspaceMap);
  const cachePaths = collectAbsoluteCachePaths(optimizedDependencyFiles, workspaceRoot);
  const rootPrefixes = usedPackageRoots.map(root => `${root}/`);

  return {
    name: 'workspace-deps-watcher',
    watchChange(id) {
      const changed = slash(id);
      if (rootPrefixes.some(prefix => changed.startsWith(prefix))) {
        isDirty = true;
      }
    },
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

      if (!isDirty && !isCacheMissing(cachePaths)) {
        return;
      }

      // Reset before the async work so edits made while re-optimizing trigger another pass;
      // restored on failure so the next rebuild retries.
      isDirty = false;

      // bundleExternals may mutate the map when externalsPreset is true; copy first.
      const depsCopy = cloneDepsToOptimize(depsToOptimize);

      const { externalsPreset, mergedExternals } = normalizeExternals(bundlerOptions?.externals ?? true);

      try {
        await bundleExternals(depsCopy, outputDir, {
          bundlerOptions: {
            externalsPreset,
            mergedExternals,
            isDev: true,
          },
          projectRoot: workspaceRoot,
          workspaceRoot,
          workspaceMap,
          platform,
        });
      } catch (error) {
        isDirty = true;
        throw error;
      }
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

    const pkgName = getPackageName(dep);
    const location = metadata.rootPath || (pkgName ? workspaceMap.get(pkgName)?.location : undefined);
    if (location) {
      roots.add(slash(toRealPath(location)));
    }
  }

  return Array.from(roots);
}

/**
 * Rolldown's file watcher reports changes under the real path, so a root reached
 * through a symlink (e.g. macOS `/var` -> `/private/var`) would never match.
 */
function toRealPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
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

function isCacheMissing(cachePaths: string[]): boolean {
  return cachePaths.some(cachePath => !existsSync(cachePath));
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
