import * as resolve from 'resolve.exports';
import type { Plugin } from 'rollup';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { getPackageName, isDependencyPartOfPackage } from '../utils';

export function subpathExternalsResolver(
  externals: string[],
  workspaceMap: Map<string, WorkspacePackageInfo> = new Map(),
): Plugin {
  return {
    name: 'subpath-externals-resolver',
    resolveId(id) {
      if (id.startsWith('.') || id.startsWith('/')) {
        return null;
      }

      const isPartOfExternals = externals.some(external => isDependencyPartOfPackage(id, external));
      if (!isPartOfExternals) {
        return null;
      }

      const packageName = getPackageName(id);
      const workspacePackage = packageName ? workspaceMap.get(packageName) : undefined;
      if (packageName && workspacePackage?.exports !== undefined && id !== packageName) {
        const subpath = `.${id.slice(packageName.length)}`;
        try {
          resolve.exports({ name: packageName, exports: workspacePackage.exports }, subpath);
        } catch {
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
