import { registerApiRoute } from '@mastra/core/server';

export const testRoute = registerApiRoute('/test', {
  method: 'GET',
  handler: async c => {
    return c.json({ message: 'Hello, world!' });
  },
});
