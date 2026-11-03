import type { ModuleType, Plugin } from 'rolldown';
import { escapeRegExp, exactIdsRegex } from './filters';

export const VIRTUAL_PREFIX = '\0virtual:';

/**
 * Serves in-memory modules. Ids keep the `\0virtual:` prefix that `@rollup/plugin-virtual` used,
 * because the analyzer recognizes virtual entries by it.
 */
export function virtualModules(
  modules: Record<string, string>,
  { name = 'virtual', moduleType = 'js' }: { name?: string; moduleType?: ModuleType } = {},
): Plugin {
  const ids = exactIdsRegex(Object.keys(modules));

  return {
    name,
    resolveId: {
      // Matches nothing when there are no modules
      filter: { id: ids ?? /(?!)/ },
      handler(id) {
        return VIRTUAL_PREFIX + id;
      },
    },
    load: {
      filter: { id: new RegExp(`^${escapeRegExp(VIRTUAL_PREFIX)}`) },
      handler(id) {
        const source = modules[id.slice(VIRTUAL_PREFIX.length)];
        if (source === undefined) {
          return null;
        }
        // Entries may be TypeScript (e.g. the generated server entry), which oxc handles natively.
        return { code: source, moduleType };
      },
    },
  };
}
