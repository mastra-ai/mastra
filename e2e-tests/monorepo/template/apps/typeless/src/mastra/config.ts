import { registerApiRoute } from '@mastra/core/server';
import { ROUTE_MESSAGE, SOURCEMAP } from './shared';

// The dynamic import makes Rollup split `shared.ts` into its own chunk when the `server` and `bundler` options are
// extracted from this file (#28491).
const optional = process.env.LOAD_OPTIONAL === 'true' ? await import('./optional') : undefined;

export const apiRoutes = [
  registerApiRoute('/typeless', {
    method: 'GET',
    handler: async c => c.json({ message: optional?.optionalMessage() ?? ROUTE_MESSAGE }),
  }),
];

export const bundlerOptions = { sourcemap: optional?.optionalSourcemap ?? SOURCEMAP };
