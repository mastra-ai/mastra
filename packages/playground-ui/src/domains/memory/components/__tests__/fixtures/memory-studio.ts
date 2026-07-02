import type { MemoryMessage, OMHistoryRecord } from '../../../types';

export const omHistoryRecords: OMHistoryRecord[] = [
  {
    id: 'om-1',
    scope: 'thread',
    resourceId: 'resource-1',
    threadId: 'thread-1',
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
    id: 'om-2',
    scope: 'thread',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    activeObservations: '## Recent\n🔴 [10:05] User reported a blocking bug',
    originType: 'observation',
    generationCount: 2,
    lastObservedAt: '2026-06-01T10:05:00.000Z',
    totalTokensObserved: 2100,
    observationTokenCount: 640,
    pendingMessageTokens: 880,
    isObserving: false,
    isReflecting: false,
    config: { messageTokens: 2000, observationTokens: 1000 },
    createdAt: '2026-06-01T10:04:00.000Z',
    updatedAt: '2026-06-01T10:05:00.000Z',
  },
];

export const memoryMessages: MemoryMessage[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: {
      format: 2,
      parts: [
        {
          type: 'data-om-status',
          data: {
            windows: {
              active: {
                messages: { tokens: 540, threshold: 2000 },
                observations: { tokens: 320, threshold: 1000 },
              },
            },
          },
        },
      ],
    },
  },
  {
    id: 'msg-2',
    role: 'assistant',
    createdAt: new Date('2026-06-01T10:05:00.000Z'),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: {
      format: 2,
      parts: [{ type: 'text', text: 'hello' }],
    },
  },
];
