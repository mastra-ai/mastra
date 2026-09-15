import type {
  GetMemoryConfigResponse,
  GetMemoryStatusResponse,
  GetObservationalMemoryResponse,
  ListMemoryThreadMessagesResponse,
} from '@mastra/client-js';

export const memoryEnabledStatus: GetMemoryStatusResponse = {
  result: true,
  memoryType: 'local',
};

export const memoryDisabledStatus: GetMemoryStatusResponse = {
  result: false,
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

// Two OM records at distinct timestamps so the timeline panel's zoom range can
// keep the early record (om-early at 10:01) while excluding the late one
// (om-late at 10:05). The observation bodies are distinct so the filtered
// observation list can be asserted by visible text.
export const observationalMemoryTwoRecords: GetObservationalMemoryResponse = {
  record: null,
  history: [
    {
      id: 'om-early',
      scope: 'thread',
      resourceId: 'chef-agent',
      threadId: 'real-thread',
      activeObservations: '## Recent\n🟡 [10:01] User asked about onboarding',
      originType: 'observation',
      generationCount: 1,
      lastObservedAt: '2026-06-01T10:01:00.000Z',
      totalTokensObserved: 1200,
      observationTokenCount: 320,
      pendingMessageTokens: 540,
      isObserving: false,
      isReflecting: false,
      config: { messageTokens: 2000, observationTokens: 1000 },
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-01T10:01:00.000Z',
    },
    {
      id: 'om-late',
      scope: 'thread',
      resourceId: 'chef-agent',
      threadId: 'real-thread',
      activeObservations: '## Recent\n🔴 [10:05] User reported a blocking bug',
      originType: 'observation',
      generationCount: 2,
      lastObservedAt: '2026-06-01T10:05:00.000Z',
      totalTokensObserved: 2400,
      observationTokenCount: 640,
      pendingMessageTokens: 880,
      isObserving: false,
      isReflecting: false,
      config: { messageTokens: 2000, observationTokens: 1000 },
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-01T10:05:00.000Z',
    },
  ],
};

// Messages spanning 10:00–10:05 so the FlameGraph time domain is wide enough
// to drag a zoom handle and collapse the range onto the early window.
export const threadMessagesSpan: ListMemoryThreadMessagesResponse = {
  messages: [
    {
      id: 'msg-start',
      role: 'user',
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      threadId: 'real-thread',
      resourceId: 'chef-agent',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'first message' }],
      },
    },
    {
      id: 'msg-end',
      role: 'assistant',
      createdAt: new Date('2026-06-01T10:05:00.000Z'),
      threadId: 'real-thread',
      resourceId: 'chef-agent',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'last message' }],
      },
    },
  ],
};
