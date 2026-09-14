import type { GetMemoryConfigResponse } from '@mastra/client-js';

export const memoryConfigWithThresholds: GetMemoryConfigResponse = {
  config: {
    lastMessages: 0,
    semanticRecall: { topK: 4, messageRange: { before: 0, after: 2 }, scope: 'resource' },
    observationalMemory: {
      enabled: true,
      scope: 'thread',
      messageTokens: 30000,
      observationTokens: { min: 4000, max: 8000 },
      observationModel: 'openai/gpt-4o-mini',
    },
  },
};
