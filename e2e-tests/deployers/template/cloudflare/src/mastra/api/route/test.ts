import { registerApiRoute } from '@mastra/core/server';

export const testRoute = registerApiRoute('/test', {
  method: 'GET',
  handler: async c => {
    const obj = {
      a: 'b',
    };

    return c.json({ message: 'Hello, world!' });
  },
});
