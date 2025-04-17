import type { Logger } from '@mastra/core';
import slugify from '@sindresorhus/slugify';
import { join } from 'node:path';
import { findWorkspacesRoot } from 'find-workspaces';
import { DepsService } from '../services';
import { ensureDir } from 'fs-extra';

/**
 * Resolves and packages workspace dependencies
 * Finds all transitive dependencies and creates TGZ packages for them
 * Adds workspace packages to dependenciesToInstall with file: references to the packaged TGZ files
 * Returns resolutions for workspace dependencies
 */
export const resolveAndPackWorkspaceDependencies = async ({
  workspaceMap,
  initialDependencies,
  dependenciesToInstall,
  bundleOutputDir,
  logger,
}: {
  workspaceMap: Map<
    string,
    { location: string; dependencies: Record<string, string> | undefined; version: string | undefined }
  >;
  initialDependencies: Set<string>;
  dependenciesToInstall: Map<string, string>;
  bundleOutputDir: string;
  logger: Logger;
}): Promise<Record<string, string> | undefined> => {
  const seen = new Set<string>();
  const queue: string[] = Array.from(initialDependencies);
  const resolutions: Record<string, string> = {};
  // find all transitive workspace dependencies
  while (queue.length > 0) {
    const len = queue.length;
    for (let i = 0; i < len; i += 1) {
      const pkgName = queue.shift();
      if (!pkgName || seen.has(pkgName)) {
        continue;
      }

      const dep = workspaceMap.get(pkgName);
      if (!dep) continue;

      const root = findWorkspacesRoot();
      if (!root) {
        logger.error('Could not find workspace root');
        return;
      }
      const depsService = new DepsService(root.location);
      depsService.__setLogger(logger);
      const sanitizedName = pkgName.replace(/^@/, '').replace(/\//, '-');

      const tgzPath = depsService.getWorkspaceDependencyPath({
        pkgName: sanitizedName,
        version: dep.version!,
      });
      dependenciesToInstall.set(pkgName, tgzPath);
      resolutions[pkgName] = tgzPath;
      seen.add(pkgName);

      for (const [depName, _depVersion] of Object.entries(dep?.dependencies ?? {})) {
        if (!seen.has(depName) && workspaceMap.has(depName)) {
          queue.push(depName);
        }
      }
    }
  }

  const root = findWorkspacesRoot();
  if (!root) {
    logger.error('Could not find workspace root');
    return;
  }

  const depsService = new DepsService(root.location);
  depsService.__setLogger(logger);

  // package all transitive workspace dependencies
  if (seen.size > 0) {
    const workspaceDirPath = join(bundleOutputDir, 'workspace-module');
    await ensureDir(workspaceDirPath);

    logger.info(`Packaging ${seen.size} workspace dependencies...`);

    const batchSize = 5;
    const packages = Array.from(seen.values());

    for (let i = 0; i < packages.length; i += batchSize) {
      const batch = packages.slice(i, i + batchSize);
      logger.info(
        `Packaging batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(packages.length / batchSize)}: ${batch.join(', ')}`,
      );
      await Promise.all(
        batch.map(async pkgName => {
          const dep = workspaceMap.get(pkgName);
          if (!dep) return;

          try {
            if (!dependenciesToInstall.has(pkgName)) {
              const sanitizedName = slugify(pkgName);
              const tgzPath = depsService.getWorkspaceDependencyPath({
                pkgName: sanitizedName,
                version: dep.version!,
              });
              dependenciesToInstall.set(pkgName, tgzPath);
            }

            await depsService.pack({ dir: dep.location, destination: workspaceDirPath });
          } catch (error) {
            logger.error(`Failed to package ${pkgName}: ${error}`);
          }
        }),
      );
    }

    logger.info(`Successfully packaged ${seen.size} workspace dependencies`);
  }

  return resolutions;
};
