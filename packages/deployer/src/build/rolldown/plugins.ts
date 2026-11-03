import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';
import type { ImportKind, Plugin } from 'rolldown';
import { RolldownMagicString } from 'rolldown';
import { withFilter } from 'rolldown/filter';
import { parseSync } from 'rolldown/utils';
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

const VITE_IGNORE_COMMENT = /\/\*\s*@vite-ignore\b[^]*?\*\//g;
const SCRIPT_LANGS = new Set(['js', 'jsx', 'ts', 'tsx']);

/**
 * Removes `/* @vite-ignore *\/` from `import(...)` calls with a string literal specifier, so Rolldown resolves and
 * bundles them like Rollup did. Rolldown skips every dynamic import that carries the comment (there is no option to
 * turn that off), which left e.g. `import('chat')` in `@mastra/core` unbundled and missing from the output
 * package.json. Core adds the comment for Vite and webpack, and relies on production bundlers to bundle `chat` (#19254).
 */
export function stripViteIgnore(): Plugin {
  return {
    name: 'mastra-strip-vite-ignore',
    transform: {
      filter: {
        moduleType: [...SCRIPT_LANGS],
        code: '@vite-ignore',
      },
      handler(code, id, meta) {
        const lang = meta.moduleType as 'js' | 'jsx' | 'ts' | 'tsx';
        if (!SCRIPT_LANGS.has(lang)) {
          return null;
        }

        // Parsed so that comments inside strings, templates or other comments are never touched. Only `module` is
        // read, which skips serializing the ESTree.
        const { module, errors } = parseSync(id, code, { lang, sourceType: 'unambiguous' });
        if (errors.length) {
          return null;
        }

        const s = new RolldownMagicString(code);
        let changed = false;
        for (const { start, moduleRequest } of module.dynamicImports) {
          const quote = code[moduleRequest.start];
          if (quote !== '"' && quote !== "'") {
            continue;
          }

          // Between `import` and the specifier there is only `(` and trivia.
          const prefix = code.slice(start, moduleRequest.start);
          for (const match of prefix.matchAll(VITE_IGNORE_COMMENT)) {
            s.remove(start + match.index, start + match.index + match[0].length);
            changed = true;
          }
        }
        return changed ? { code: s } : null;
      },
    },
  };
}

/**
 * Drops chunks that no entry can load through static or dynamic imports. Rolldown 1.2.16 still emits the dynamic
 * import targets of modules it tree-shook away, e.g. the schema vendor loaders of `@standard-community/standard-json`
 * when only a side-effect-free import of it is left. Nothing references those files.
 *
 * Workaround for https://github.com/rolldown/rolldown/issues/11213 (our repro:
 * https://github.com/rolldown/rolldown/issues/11213#issuecomment-6605866851). Remove this plugin once that is fixed in
 * the Rolldown version we depend on.
 */
export function pruneUnreachableChunks(): Plugin {
  return {
    name: 'mastra-prune-unreachable-chunks',
    generateBundle(_options, bundle) {
      const reachable = new Set<string>();
      const pending = Object.values(bundle)
        .filter(file => file.type === 'chunk' && file.isEntry)
        .map(file => file.fileName);

      while (pending.length) {
        const fileName = pending.pop()!;
        if (reachable.has(fileName)) {
          continue;
        }
        reachable.add(fileName);

        const chunk = bundle[fileName];
        if (chunk?.type === 'chunk') {
          pending.push(...chunk.imports, ...chunk.dynamicImports);
        }
      }

      for (const [fileName, file] of Object.entries(bundle)) {
        if (file.type !== 'chunk' || reachable.has(fileName)) {
          continue;
        }

        delete bundle[fileName];
        if (file.sourcemapFileName) {
          delete bundle[file.sourcemapFileName];
        }
      }
    },
  };
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
