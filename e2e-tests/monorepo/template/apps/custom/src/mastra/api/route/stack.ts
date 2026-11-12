import { registerApiRoute } from '@mastra/core/server';

export const stackRoute = registerApiRoute('/stack', {
  method: 'GET',
  handler: async c => c.json({ stack: new Error('stack probe').stack }),
});
