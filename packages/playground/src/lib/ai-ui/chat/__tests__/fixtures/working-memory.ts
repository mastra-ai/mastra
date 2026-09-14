import type { RouteResponse } from '@mastra/client-js';

export const workingMemoryFixture = (
  workingMemory: string,
): RouteResponse<'GET /memory/threads/:threadId/working-memory'> => ({
  workingMemory,
  source: 'resource',
  workingMemoryTemplate: null,
  threadExists: true,
});
