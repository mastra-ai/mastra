import type { GetMemoryStatusResponse } from '@mastra/client-js';

export const omEnabledStatus: GetMemoryStatusResponse = {
  result: true,
  memoryType: 'local',
  observationalMemory: {
    enabled: true,
    hasRecord: true,
    isObserving: false,
    isReflecting: false,
  },
};
