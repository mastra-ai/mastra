import { join } from 'node:path';
import type { IMastraLogger } from '@mastra/core/logger';
import slugify from '@sindresorhus/slugify';
import { findWorkspaces, findWorkspacesRoot } from 'find-workspaces';
import { ensureDir } from 'fs-extra';
import { DepsService } from '../services';

export type WorkspacePackageInfo = {
  location: string;
  dependencies: Record<string, string> | undefined;
  version: string | undefined;
};

type TransitiveDependencyResult = {
  resolutions: Record<string, string>;
  usedWorkspacePackages: Set<string>;
};

/**
 * Creates a map of workspace packages with their metadata for dependency resolution
 * @returns Map of package names to their location, dependencies and version
 */
export const createWorkspacePackageMap = async () => {
  // TODO move to our own implementation - pkg is 4 years old
  const workspaces = await findWorkspaces();
  const workspaceMap = new Map(
    workspaces?.map(workspace => [
      workspace.package.name,
      {
        location: workspace.location,
        dependencies: workspace.package.dependencies,
        version: workspace.package.version,
      },
    ]) ?? [],
  );

  return workspaceMap;
};

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

    logger.info(`Packaging ${usedWorkspacePackages.size} workspace dependencies...`);

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
          if (!dep) return;

          await depsService.pack({ dir: dep.location, destination: workspaceDirPath });
        }),
      );
    }

    logger.info(`Successfully packaged ${usedWorkspacePackages.size} workspace dependencies`);
  }
};
