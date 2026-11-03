import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';
import type { ImportKind, Plugin } from 'rolldown';
import { RolldownMagicString } from 'rolldown';
import { withFilter } from 'rolldown/filter';
import { isBareModuleSpecifier } from '../utils';
import { BARE_SPECIFIER_FILTER, escapeRegExp, NON_USER_CODE_IDS } from './filters';

/**
 * Applies `define` replacements to user and workspace code only, like esbuild did when it only transformed files
 * outside `node_modules`. Rolldown's `transform.define` would also rewrite dependencies, e.g. freezing
 * `process.env.NODE_ENV` inside a bundled `@mastra/core`.
 */
export function scopedDefine(define: Record<string, string>): Plugin | null {
  const keys = Object.keys(define);
  if (!keys.length) {
    return null;
  }

  // Skip member access (`a.process.env.X`), longer identifiers and assignments, like @rollup/plugin-replace's
  // `preventAssignment`.
  const pattern = new RegExp(`(?<![\\w$.])(?:${keys.map(escapeRegExp).join('|')})(?![\\w$])(?!\\s*=(?!=))`, 'g');

  return {
    name: 'mastra-scoped-define',
    transform: {
      filter: {
        id: { exclude: NON_USER_CODE_IDS },
        code: { include: keys },
      },
      handler(code) {
        const s = new RolldownMagicString(code);
        let changed = false;
        for (const match of code.matchAll(pattern)) {
          s.overwrite(match.index, match.index + match[0].length, define[match[0]]!);
          changed = true;
        }
        return changed ? { code: s } : null;
      },
    },
  };
}

/**
 * Rewrites `import { x } from 'lodash'` to per-method imports. The code filter keeps Rolldown from calling into JS
 * (and re-parsing) every module, and modules now reach the plugin as raw TypeScript, so the parser needs `lang`.
 */
export function lodashImports(): Plugin {
  const plugin = optimizeLodashImports({
    include: '**/*.{js,ts,mjs,cjs,mts,cts}',
    parseOptions: (id: string) => ({ lang: /\.[cm]?ts$/.test(id) ? 'ts' : 'js' }),
  }) as unknown as Plugin;

  return withFilter(plugin, { transform: { code: /["']lodash(?:\/fp)?["']/ } });
}

export type BareExternalsOptions = {
  /** Return `true` to let the specifier resolve normally (bundled) instead of being externalized. */
  shouldBundle?: (id: string, importer: string) => boolean;
  /** Called for every externalized specifier, e.g. to record `require()` calls. */
  onExternal?: (id: string, kind: ImportKind) => void;
};

/**
 * Rollup left bare imports nobody resolved as externals, and several passes relied on that. Rolldown always resolves
 * them from `node_modules`, so these passes make the old behavior explicit. Runs last (`post`) so alias, tsconfig
 * paths and workspace plugins get the first chance.
 */
export function bareExternals({ shouldBundle, onExternal }: BareExternalsOptions = {}): Plugin {
  return {
    name: 'mastra-bare-externals',
    resolveId: {
      order: 'post',
      filter: { id: BARE_SPECIFIER_FILTER },
      handler(id, importer, { kind, isEntry }) {
        if (isEntry || !importer || !isBareModuleSpecifier(id)) {
          return null;
        }

        if (shouldBundle?.(id, importer)) {
          return null;
        }

        onExternal?.(id, kind);
        return { id, external: true };
      },
    },
  };
}
