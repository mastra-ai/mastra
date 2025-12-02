import type { Plugin } from 'rollup';

import { provideCJSSyntax } from './utils';

export function esmShim(): Plugin {
  return {
    name: 'esm-shim',
    renderChunk(code, _chunk, opts) {
      if (opts.format === 'es') {
        return provideCJSSyntax(code);
      }

      return null;
    }
  };
}
