import { registerApiRoute } from '@mastra/core/server';
import { roundToOneNumber } from '@inner/hello-world';

/**
 * `@inner/hello-world` exports raw TypeScript with extensionless relative imports and depends on
 * `round-to`, which this app does not declare. `mastra dev` must load it while extracting server options.
 */
export const rawTsWorkspaceRoute = registerApiRoute('/raw-ts-workspace', {
  method: 'GET',
  handler: async c => {
    return c.json({ value: roundToOneNumber(4.6) });
  },
});
