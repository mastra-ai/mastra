import type { ListAgentVersionsResponse } from '@mastra/client-js';

export const PAGINATED_AGENT_VERSION_ID = 'paginated-agent';

type AgentVersionListItem = ListAgentVersionsResponse['versions'][number];

const createVersion = (versionNumber: number, labels: string[] = []): AgentVersionListItem => ({
  id: `version-${versionNumber}`,
  agentId: PAGINATED_AGENT_VERSION_ID,
  versionNumber,
  name: 'Paginated agent',
  instructions: `Instructions for version ${versionNumber}`,
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  changeMessage: `Saved version ${versionNumber}`,
  createdAt: `2026-08-${String(versionNumber).padStart(2, '0')}T12:00:00.000Z`,
  labels,
});

const descendingVersions = Array.from({ length: 25 }, (_, index) => {
  const versionNumber = 25 - index;
  return createVersion(versionNumber, versionNumber === 5 ? ['production'] : []);
});

export const firstAgentVersionPage: ListAgentVersionsResponse = {
  versions: descendingVersions.slice(0, 20),
  total: 25,
  page: 0,
  perPage: 20,
  hasMore: true,
};

export const secondAgentVersionPageWithDuplicate: ListAgentVersionsResponse = {
  versions: [descendingVersions[19], ...descendingVersions.slice(20)],
  total: 25,
  page: 1,
  perPage: 20,
  hasMore: false,
};
