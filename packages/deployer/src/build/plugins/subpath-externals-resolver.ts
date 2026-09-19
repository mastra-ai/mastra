import type { Plugin } from 'rollup';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { getPackageName, isDependencyPartOfPackage } from '../utils';

export function subpathExternalsResolver(
  externals: string[],
  workspaceMap: Map<string, WorkspacePackageInfo> = new Map(),
): Plugin {
  return {
    name: 'subpath-externals-resolver',
    async resolveId(id, importer) {
      if (id.startsWith('.') || id.startsWith('/')) {
        return null;
      }

      const isPartOfExternals = externals.some(external => isDependencyPartOfPackage(id, external));
      if (!isPartOfExternals) {
        return null;
      }

      const packageName = getPackageName(id);
      if (packageName && workspaceMap.has(packageName) && id !== packageName) {
        const resolved = await this.resolve(id, importer, { skipSelf: true });
        if (!resolved) {
          this.error(`Could not resolve workspace package subpath "${id}".`);
        }
      }

      return {
        id,
        external: true,
      };
    },
  } satisfies Plugin;
}
