import { fileURLToPath } from 'node:url';
import type { Plugin } from 'rolldown';

/**
 * hono is imported from deployer, so it must resolve from here when the project can't resolve it.
 *
 * With `preferProject`, the project's own copy wins (Rollup ran node-resolve before this plugin in bundling mode).
 * Rolldown's native resolver runs after every JS hook, so that order has to be made explicit.
 */
export function aliasHono({ preferProject = false }: { preferProject?: boolean } = {}): Plugin {
  return {
    name: 'hono-alias',
    resolveId: {
      filter: { id: /^(?:hono(?:\/|$)|@hono\/|hono-openapi$)/ },
      async handler(id, importer, options) {
        if (preferProject && importer) {
          const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
          if (resolved && !resolved.external) {
            return resolved;
          }
        }

        return fileURLToPath(import.meta.resolve(id));
      },
    },
  };
}
