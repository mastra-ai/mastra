import type { AgentVersionResponse, ListAgentVersionsResponse } from '@mastra/client-js';

/** The only target agent whose versions the experiment dialog can load. */
export const agentIdWithVersions = 'agent-1';

// IDs are deliberately unlike the display numbers, so a request that reads `versionNumber`
// instead of `id` fails the assertion rather than passing by coincidence.
export const latestAgentVersionId = 'agent-1-version-2';
export const publishedAgentVersionId = 'agent-1-version-1';

const latestVersion: AgentVersionResponse = {
  id: latestAgentVersionId,
  agentId: agentIdWithVersions,
  versionNumber: 2,
  name: 'Agent One',
  instructions: 'Latest instructions.',
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  changeMessage: 'Unpublished draft',
  createdAt: '2026-11-02T10:00:00.000Z',
};

const publishedVersion: AgentVersionResponse = {
  id: publishedAgentVersionId,
  agentId: agentIdWithVersions,
  versionNumber: 1,
  name: 'Agent One',
  instructions: 'Published instructions.',
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  changeMessage: 'Initial version',
  createdAt: '2026-11-01T10:00:00.000Z',
};

/** Newest first, matching the `orderBy: { direction: 'DESC' }` the dialog asks for. */
export const agentVersionsResponse: ListAgentVersionsResponse = {
  versions: [latestVersion, publishedVersion],
  total: 2,
  page: 1,
  perPage: 20,
  hasMore: false,
};

export const emptyAgentVersionsResponse: ListAgentVersionsResponse = {
  versions: [],
  total: 0,
  page: 1,
  perPage: 20,
  hasMore: false,
};
