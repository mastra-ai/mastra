import type { ListMemoryThreadsResponse } from '@mastra/client-js';

type MemoryThread = ListMemoryThreadsResponse['threads'][number];

export const namedThread: MemoryThread = {
  id: 'thread-1',
  title: 'Trip planning',
  resourceId: 'agent-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  metadata: {},
};
