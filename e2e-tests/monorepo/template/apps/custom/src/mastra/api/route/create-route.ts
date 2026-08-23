import { createRoute } from '@mastra/server/server-adapter';

export const createRouteRoute = createRoute({
  method: 'GET',
  path: '/create-route',
  responseType: 'json',
  handler: async () => ({ message: 'Hello from createRoute!' }),
});
