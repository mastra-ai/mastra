import type { ListMemoryThreadsResponse } from '@mastra/client-js';

type MemoryThread = ListMemoryThreadsResponse['threads'][number];

export const makeThread = (overrides: Partial<MemoryThread> = {}): MemoryThread => ({
  id: 'thread-1',
  title: 'Original title',
  resourceId: 'agent-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  metadata: {},
  ...overrides,
});

export const makeThreadsResponse = (threads: MemoryThread[]): ListMemoryThreadsResponse => ({
  threads,
  total: threads.length,
  page: 0,
  perPage: 100,
  hasMore: false,
});
