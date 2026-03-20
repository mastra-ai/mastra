import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import type { Plugin } from 'rollup';
import { slash } from '../utils';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * Rollup plugin that resolves file extensions for relative imports.
 *
 * When nodeResolve is not used (e.g. during noBundling/dev mode), relative
 * imports like `./common` won't resolve to `./common.js` or `./common.ts`.
 * This plugin fills that gap by trying common extensions and index files.
 */
export function relativeExtensionResolver(): Plugin {
  return {
    name: 'relative-extension-resolver',
    resolveId(id, importer) {
      if (!importer || !(id.startsWith('./') || id.startsWith('../'))) {
        return null;
      }

      if (extname(id)) {
        return null;
      }

      const resolved = resolve(dirname(importer), id);

      for (const ext of EXTENSIONS) {
        const candidate = resolved + ext;
        if (existsSync(candidate)) {
          return slash(candidate);
        }
      }

      for (const ext of EXTENSIONS) {
        const candidate = join(resolved, `index${ext}`);
        if (existsSync(candidate)) {
          return slash(candidate);
        }
      }

      return null;
    },
  };
}
