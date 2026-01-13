import { registerApiRoute } from '@mastra/core/server';
// Test path alias - importing from utils using @/ alias
import { formatMessage } from '@/utils';

export const pathAliasRoute = registerApiRoute('/path-alias', {
  method: 'GET',
  handler: async c => {
    return c.json({
      message: formatMessage('Hello from path alias'),
    });
  },
});
