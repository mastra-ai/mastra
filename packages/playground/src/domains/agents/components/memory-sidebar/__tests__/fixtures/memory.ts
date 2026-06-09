import type { GetMemoryConfigResponse, GetMemoryStatusResponse } from '@mastra/client-js';

export const memoryEnabledStatus: GetMemoryStatusResponse = {
  result: true,
  memoryType: 'local',
};

export const semanticRecallConfig: GetMemoryConfigResponse = {
  memoryType: 'local',
  config: {
    lastMessages: 10,
    semanticRecall: true,
    workingMemory: { enabled: true },
  },
};
