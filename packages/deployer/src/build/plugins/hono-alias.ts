import { fileURLToPath } from 'node:url';
import type { Plugin } from 'rollup';

// hono is imported from deployer, so we need to resolve from here instead of the project root
export function aliasHono(): Plugin {
  return {
    name: 'hono-alias',
    resolveId(id: string) {
      if (!id.startsWith('@hono/') && !id.startsWith('hono/') && id !== 'hono' && id !== 'hono-openapi') {
        return;
      }

      const path = import.meta.resolve(id);
      return fileURLToPath(path);
    },
  } satisfies Plugin;
}
