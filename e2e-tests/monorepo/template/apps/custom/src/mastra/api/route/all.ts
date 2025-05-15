import { registerApiRoute } from '@mastra/core/server';

export const allRoute = registerApiRoute('/all', {
  method: 'ALL',
  handler: async c => {
    return c.json({ message: `Hello, ${c.req.method}!` });
  },
});
