import { registerApiRoute } from '@mastra/core/server';

export const testRoute = registerApiRoute('/test', {
  method: 'GET',
  handler: async c => {
    const workerState = globalThis as typeof globalThis & {
      __mastraInitializationCount?: number;
      __mastraInstanceId?: string;
    };

    return c.json({
      message: 'Hello, world!',
      initializationCount: workerState.__mastraInitializationCount,
      instanceId: workerState.__mastraInstanceId,
    });
  },
});
