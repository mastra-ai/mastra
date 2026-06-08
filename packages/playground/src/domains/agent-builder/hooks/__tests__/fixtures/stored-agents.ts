import type { ListStoredAgentsResponse } from '@mastra/client-js';

type StoredAgent = ListStoredAgentsResponse['agents'][number];

const makeAgent = (id: string, status: string): StoredAgent => ({
  id,
  status,
  name: id,
  instructions: '',
  model: { provider: 'google', name: 'gemini-2.5-flash' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

export const emptyStoredAgents: ListStoredAgentsResponse = {
  agents: [],
  total: 0,
  page: 1,
  perPage: 50,
  hasMore: false,
};

export const oneDraftAgent: ListStoredAgentsResponse = {
  agents: [makeAgent('a1', 'draft')],
  total: 1,
  page: 1,
  perPage: 50,
  hasMore: false,
};

export const onePublishedAgent: ListStoredAgentsResponse = {
  agents: [makeAgent('p1', 'published')],
  total: 1,
  page: 1,
  perPage: 50,
  hasMore: false,
};

export const twoPublishedAgents: ListStoredAgentsResponse = {
  agents: [makeAgent('p1', 'published'), makeAgent('p2', 'published')],
  total: 2,
  page: 1,
  perPage: 50,
  hasMore: false,
};
