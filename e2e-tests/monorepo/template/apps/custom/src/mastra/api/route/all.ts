import { registerApiRoute } from '@mastra/core/server';

export const testRoute = registerApiRoute('/all', {
  method: 'ALL',
  handler: async c => {
    return c.json({ message: `Hello, ${c.req.method}!` });
  },
});
