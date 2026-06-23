import type {
  GetMemoryConfigResponse,
  GetMemoryStatusResponse,
  GetObservationalMemoryResponse,
} from '@mastra/client-js';

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

export const observationalMemoryConfig: GetMemoryConfigResponse = {
  memoryType: 'local',
  config: {
    lastMessages: 10,
    semanticRecall: true,
    workingMemory: { enabled: true },
    observationalMemory: { enabled: true },
  },
};

// OM config carrying explicit window thresholds, used to assert the timeline
// panel renders thresholds from the agent config when the record omits them.
export const observationalMemoryConfigWithThresholds: GetMemoryConfigResponse = {
  memoryType: 'local',
  config: {
    lastMessages: 10,
    semanticRecall: true,
    workingMemory: { enabled: true },
    observationalMemory: { enabled: true, messageTokens: 30000, observationTokens: 6000 },
  },
};

// An active OM record with distinct token counts so the timeline panel's
// MESSAGES/OBSERVATIONS readout can be asserted as record-derived (the
// source-of-truth values), not re-derived from message markers.
export const observationalMemoryWithRecord: GetObservationalMemoryResponse = {
  record: {
    id: 'om-active',
    scope: 'thread',
    resourceId: 'chef-agent',
    threadId: 'real-thread',
    activeObservations: '## Recent\n🟡 [10:01] User asked about onboarding',
    originType: 'observation',
    generationCount: 2,
    lastObservedAt: '2026-06-01T10:05:00.000Z',
    totalTokensObserved: 18700,
    observationTokenCount: 4500,
    pendingMessageTokens: 14200,
    isObserving: false,
    isReflecting: false,
    config: { messageTokens: 30000, observationTokens: 6000 },
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:05:00.000Z',
  },
  history: [
    {
      id: 'om-active',
      scope: 'thread',
      resourceId: 'chef-agent',
      threadId: 'real-thread',
      activeObservations: '## Recent\n🟡 [10:01] User asked about onboarding',
      originType: 'observation',
      generationCount: 2,
      lastObservedAt: '2026-06-01T10:05:00.000Z',
      totalTokensObserved: 18700,
      observationTokenCount: 4500,
      pendingMessageTokens: 14200,
      isObserving: false,
      isReflecting: false,
      config: { messageTokens: 30000, observationTokens: 6000 },
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-01T10:05:00.000Z',
    },
  ],
};
