import type { ListMemoryThreadsResponse, GetMemoryStatusResponse } from '@mastra/client-js';
export const chatMemory: GetMemoryStatusResponse = { result: true };
export const chatThreads: ListMemoryThreadsResponse = {
  threads: [
    {
      id: 'last-chat',
      resourceId: 'researcher',
      title: 'Research notes',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
      metadata: {},
    },
  ],
  total: 1,
  page: 0,
  perPage: 100,
  hasMore: false,
};
