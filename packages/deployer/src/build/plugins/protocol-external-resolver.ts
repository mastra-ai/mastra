import type { Plugin } from 'rollup';
import { isExternalProtocolImport } from '../utils';

export function protocolExternalResolver({ exclude = ['node:'] }: { exclude?: readonly string[] } = {}): Plugin {
  return {
    name: 'protocol-external-resolver',
    resolveId(id) {
      if (!isExternalProtocolImport(id, exclude)) {
        return null;
      }

      return {
        id,
        external: true,
      };
    },
  } satisfies Plugin;
}
