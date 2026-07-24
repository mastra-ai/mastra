import { join, dirname } from 'node:path';
import type { IMastraLogger } from '@mastra/core/logger';
import slugify from '@sindresorhus/slugify';
import * as pkg from 'empathic/package';
import { findWorkspaces, findWorkspacesRoot, createWorkspacesCache } from 'find-workspaces';
import { ensureDir } from 'fs-extra';
import { slash } from '../build/utils';
import { DepsService } from '../services';

export type WorkspacePackageInfo = {
  location: string;
  dependencies: Record<string, string> | undefined;
  version: string | undefined;
  exports?: unknown;
};

const isExportTargetImportable = (target: unknown): boolean => {
  if (!target) return false;
  if (typeof target === 'string') return true;
  if (Array.isArray(target)) return target.some(isExportTargetImportable);
  if (typeof target !== 'object') return false;

  return Object.values(target).some(isExportTargetImportable);
};

export const hasRootExport = (exportsField: unknown): boolean => {
  if (exportsField === undefined) return true;
  if (typeof exportsField === 'string' || Array.isArray(exportsField)) return isExportTargetImportable(exportsField);
  if (!exportsField || typeof exportsField !== 'object') return false;

  const exportMap = exportsField as Record<string, unknown>;
  const exportKeys = Object.keys(exportMap);
  if (exportKeys.length === 0) return false;
  if (Object.prototype.hasOwnProperty.call(exportMap, '.')) return isExportTargetImportable(exportMap['.']);
  if (exportKeys.some(key => key.startsWith('./'))) return false;

  return isExportTargetImportable(exportMap);
};

type TransitiveDependencyResult = {
  resolutions: Record<string, string>;
  usedWorkspacePackages: Set<string>;
};

/**
 * Create a shared cache for find-workspaces
 */
const workspacesCache = createWorkspacesCache();

/**
 * A utility function around find-workspaces to get information about:
 * - Which workspace packages are available in the project
 * - What is the workspace root location
 * - Is the current package a workspace package
 *
 * Because `findWorkspacesRoot` only traverses up until it finds workspace information, but doesn't check if the current package is even part of the workspace. We rather want to return `null` for these cases because in other code paths we use `workspaceRoot || projectRoot` to determine the root of the project.
 *
 * @params dir - The directory to start searching from (default: `process.cwd()`)
 * @params location - The location of the current package (usually the directory containing the package.json)
 */
export async function getWorkspaceInformation({
  dir = process.cwd(),
  mastraEntryFile,
}: {
  dir?: string;
  mastraEntryFile: string;
}) {
  // 1) Get the location of the current package and its package.json
  const closestPkgJson = pkg.up({ cwd: dirname(mastraEntryFile) });
  const location = closestPkgJson ? dirname(slash(closestPkgJson)) : slash(process.cwd());

  // 2) Get all workspaces
  const workspaces = await findWorkspaces(dir, { cache: workspacesCache });
  const _workspaceMap = new Map(
    workspaces?.map(workspace => [
      workspace.package.name,
      {
        location: workspace.location,
        dependencies: workspace.package.dependencies,
        version: workspace.package.version,
        exports: workspace.package.exports,
      },
    ]) ?? [],
  );

  // 3) Check if the current package is part of the workspace
  const isWorkspacePackage = (workspaces ?? []).some(ws => ws.location === location);

  // 4) Get the workspace root only if the current package is part of the workspace
  const workspaceRoot = isWorkspacePackage ? findWorkspacesRoot(dir, { cache: workspacesCache })?.location : undefined;

  return {
    // If the current package is not part of the workspace, the bundling down the line shouldn't look at any workspace packages
    workspaceMap: isWorkspacePackage ? _workspaceMap : new Map<string, WorkspacePackageInfo>(),
    workspaceRoot,
    isWorkspacePackage,
  };
}

/**
 * Collects all transitive workspace dependencies and their TGZ paths
 */
export const collectTransitiveWorkspaceDependencies = ({
  workspaceMap,
  initialDependencies,
  logger,
}: {
  workspaceMap: Map<string, WorkspacePackageInfo>;
  initialDependencies: Set<string>;
  logger: IMastraLogger;
}): TransitiveDependencyResult => {
  const usedWorkspacePackages = new Set<string>();
  const queue: string[] = Array.from(initialDependencies);
  const resolutions: Record<string, string> = {};

  while (queue.length > 0) {
    const len = queue.length;
    for (let i = 0; i < len; i += 1) {
      const pkgName = queue.shift();
      if (!pkgName || usedWorkspacePackages.has(pkgName)) {
        continue;
      }

      const dep = workspaceMap.get(pkgName);
      if (!dep) continue;

      const root = findWorkspacesRoot();
      if (!root) {
        throw new Error('Could not find workspace root');
      }

      const depsService = new DepsService(root.location);
      depsService.__setLogger(logger);
      const sanitizedName = slugify(pkgName);

      const tgzPath = depsService.getWorkspaceDependencyPath({
        pkgName: sanitizedName,
        version: dep.version!,
      });
      resolutions[pkgName] = tgzPath;
      usedWorkspacePackages.add(pkgName);

      for (const [depName, _depVersion] of Object.entries(dep?.dependencies ?? {})) {
        if (!usedWorkspacePackages.has(depName) && workspaceMap.has(depName)) {
          queue.push(depName);
        }
      }
    }
  }

  return { resolutions, usedWorkspacePackages };
};

/**
 * Creates TGZ packages for workspace dependencies in the workspace-module directory
 */
export const packWorkspaceDependencies = async ({
  workspaceMap,
  usedWorkspacePackages,
  bundleOutputDir,
  logger,
}: {
  workspaceMap: Map<string, WorkspacePackageInfo>;
  bundleOutputDir: string;
  logger: IMastraLogger;
  usedWorkspacePackages: Set<string>;
}): Promise<void> => {
  const root = findWorkspacesRoot();
  if (!root) {
    throw new Error('Could not find workspace root');
  }

  const depsService = new DepsService(root.location);
  depsService.__setLogger(logger);

  // package all workspace dependencies
  if (usedWorkspacePackages.size > 0) {
    const workspaceDirPath = join(bundleOutputDir, 'workspace-module');
    await ensureDir(workspaceDirPath);

    logger.info('Packaging workspace dependencies', { count: usedWorkspacePackages.size });

    const batchSize = 5;
    const packages = Array.from(usedWorkspacePackages.values());

    for (let i = 0; i < packages.length; i += batchSize) {
      const batch = packages.slice(i, i + batchSize);
      logger.info(
        `Packaging batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(packages.length / batchSize)}: ${batch.join(', ')}`,
      );
      await Promise.all(
        batch.map(async pkgName => {
          const dep = workspaceMap.get(pkgName);
          const sanitizedName = slugify(pkgName);
          if (!dep) return;

          await depsService.pack({ dir: dep.location, destination: workspaceDirPath, sanitizedName: sanitizedName });
        }),
      );
    }

    logger.info('Successfully packaged workspace dependencies', { count: usedWorkspacePackages.size });
  }
};
