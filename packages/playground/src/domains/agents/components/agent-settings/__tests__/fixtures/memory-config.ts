import type { GetMemoryConfigResponse, GetMemoryConfigResponseExtended } from '@mastra/client-js';

const titleGeneration: Pick<GetMemoryConfigResponseExtended['config'], 'generateTitle'> = { generateTitle: true };

export const memoryConfigWithThresholds: GetMemoryConfigResponse = {
  config: {
    ...titleGeneration,
    lastMessages: 0,
    semanticRecall: { topK: 4, messageRange: { before: 0, after: 2 }, scope: 'resource' },
    observationalMemory: {
      enabled: true,
      scope: 'thread',
      messageTokens: 30000,
      observationTokens: { min: 4000, max: 8000 },
      observationModel: 'openai/gpt-4o-mini',
      reflectionModel: 'openai/gpt-4o',
    },
  },
};

export const memoryConfigWithDefaults: GetMemoryConfigResponse = {
  config: { semanticRecall: true, observationalMemory: { enabled: true } },
};

export const memoryConfigWithDisabledFeatures: GetMemoryConfigResponse = {
  config: { lastMessages: false, semanticRecall: false, observationalMemory: { enabled: false } },
};

export const memoryConfigWithNumericRange: GetMemoryConfigResponse = {
  config: { lastMessages: 20, semanticRecall: { scope: 'thread', topK: 8, messageRange: 0 } },
};

export const memoryConfigWithUnsupportedRecall: GetMemoryConfigResponse = {
  config: {
    ...memoryConfigWithThresholds.config,
    semanticRecall: [],
  },
};

export const memoryConfigWithReadableRecall: GetMemoryConfigResponse = {
  config: {
    ...memoryConfigWithThresholds.config,
    semanticRecall: { scope: 'thread', topK: 'automatic', messageRange: { before: 0, after: 2 } },
  },
};

export const memoryConfigWithPartialRecall: GetMemoryConfigResponse = {
  config: {
    ...memoryConfigWithThresholds.config,
    semanticRecall: { scope: 'thread', topK: { strategy: 'automatic' }, messageRange: { before: 0, after: {} } },
  },
};

export const memoryNotConfigured: GetMemoryConfigResponse = { config: null };
