import type { AgentVersionResponse, ListAgentVersionsResponse } from '@mastra/client-js';

const version = (versionNumber: number): AgentVersionResponse => ({
  id: `version-${versionNumber}`,
  agentId: 'support-agent',
  versionNumber,
  name: 'Support agent',
  instructions: `Instructions for version ${versionNumber}`,
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  createdAt: `2026-11-0${versionNumber}T10:00:00.000Z`,
});

/** Newest first, as the version panel requests them. */
export const threeAgentVersions: ListAgentVersionsResponse = {
  versions: [version(3), version(2), version(1)],
  total: 3,
  page: 0,
  perPage: 20,
  hasMore: false,
};
