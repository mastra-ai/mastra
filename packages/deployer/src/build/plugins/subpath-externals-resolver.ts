import type { Plugin } from 'rollup';
import { isDependencyPartOfPackage } from '../utils';

export function subpathExternalsResolver(externals: string[]): Plugin {
  return {
    name: 'subpath-externals-resolver',
    resolveId(id) {
      if (id.startsWith('.') || id.startsWith('/')) {
        return null;
      }

      const isPartOfExternals = externals.some(external => isDependencyPartOfPackage(id, external));
      if (isPartOfExternals) {
        return {
          id,
          external: true,
        };
      }
    },
  } satisfies Plugin;
}
