import { pathToFileURL } from 'node:url';
import type { IMastraLogger } from '@mastra/core/logger';
import { resolveModule } from 'local-pkg';
import type { Plugin } from 'rollup';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { getPackageName, isBareModuleSpecifier, slash } from '../utils';

const TYPESCRIPT_EXTENSIONS = /\.(?:ts|tsx|mts|cts)$/;

/**
 * Inlines workspace packages that resolve to raw TypeScript sources so they get transpiled
 * instead of being left as bare imports that Node cannot load.
 *
 * Bare imports coming from inside an inlined workspace package are resolved from that package
 * and kept external through their absolute path, because the importing app does not necessarily
 * declare them (e.g. pnpm's isolated node_modules layout).
 */
export function workspacePackageResolver({
  workspaceMap,
  projectRoot,
  logger,
}: {
  workspaceMap: Map<string, WorkspacePackageInfo>;
  projectRoot: string;
  logger?: IMastraLogger;
}): Plugin {
  const workspaceLocations = Array.from(workspaceMap.values(), ({ location }) => slash(location))
    // Longest first so nested workspace packages win over their parents
    .sort((a, b) => b.length - a.length);
  const appLocation = slash(projectRoot);

  /**
   * Returns the location of the workspace package that contains `file`, if any.
   */
  const findOwningWorkspace = (file: string) => {
    const normalizedFile = slash(file);

    return workspaceLocations.find(location => normalizedFile.startsWith(`${location}/`));
  };

  return {
    name: 'workspace-package-resolver',
    /**
     * Inlines TypeScript workspace packages and externalizes bare imports made from inside them by absolute path.
     * Returns `null` to fall back to the default resolution.
     */
    resolveId(id, importer) {
      if (!importer || !workspaceMap.size || !isBareModuleSpecifier(id)) {
        return null;
      }

      const packageName = getPackageName(id);
      const isWorkspaceImport = packageName !== undefined && workspaceMap.has(packageName);
      const owningWorkspace = findOwningWorkspace(importer);
      const isImportedFromWorkspacePackage = owningWorkspace !== undefined && owningWorkspace !== appLocation;

      // Keep the current behaviour for third-party imports made by the app itself
      if (!isWorkspaceImport && !isImportedFromWorkspacePackage) {
        return null;
      }

      const resolvedPath = resolveModule(id, { paths: [pathToFileURL(importer).href] });
      if (!resolvedPath) {
        logger?.warn('Could not resolve import while extracting Mastra options', { id, importer });
        return null;
      }

      if (isWorkspaceImport && TYPESCRIPT_EXTENSIONS.test(resolvedPath)) {
        return resolvedPath;
      }

      // Already loadable by Node, keep the bare import when the app is the importer
      if (!isImportedFromWorkspacePackage) {
        return null;
      }

      return {
        id: process.platform === 'win32' ? pathToFileURL(resolvedPath).href : resolvedPath,
        external: true,
      };
    },
  } satisfies Plugin;
}
