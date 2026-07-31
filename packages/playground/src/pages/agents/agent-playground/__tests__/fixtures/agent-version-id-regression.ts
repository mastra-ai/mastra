import type {
  GetAgentResponse,
  StoredAgentResponse,
  ListAgentVersionsResponse,
  AgentVersionResponse,
} from '@mastra/client-js';

export const AGENT_ID = 'version-regression-agent';
export const PUBLISHED_VERSION_ID = 'version-1-published';
export const LATEST_DRAFT_VERSION_ID = 'version-2-latest-draft';

export const codeAgent: GetAgentResponse = {
  id: AGENT_ID,
  name: 'Version Regression Agent',
  instructions: 'Original code-defined instructions.',
  tools: {},
  workflows: {},
  agents: {},
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  modelVersion: 'v2',
  modelList: undefined,
  defaultOptions: {},
  defaultGenerateOptionsLegacy: {},
  defaultStreamOptionsLegacy: {},
  source: 'code',
  status: 'published',
  activeVersionId: PUBLISHED_VERSION_ID,
  hasDraft: true,
};

const publishedVersion: AgentVersionResponse = {
  id: PUBLISHED_VERSION_ID,
  agentId: AGENT_ID,
  versionNumber: 1,
  name: 'Version Regression Agent',
  instructions: 'PUBLISHED-MARKER instructions.',
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  changeMessage: 'Initial version',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const latestDraftVersion: AgentVersionResponse = {
  id: LATEST_DRAFT_VERSION_ID,
  agentId: AGENT_ID,
  versionNumber: 2,
  name: 'Version Regression Agent',
  instructions: 'REGRESSION-MARKER instructions.',
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  changeMessage: 'Unpublished draft',
  createdAt: '2026-01-02T00:00:00.000Z',
};

// Ordered DESC by createdAt, matching the real `orderBy: { direction: 'DESC' }` query
// the page issues, so `versions[0]` is the latest (unpublished) draft.
export const versionsList: ListAgentVersionsResponse = {
  versions: [latestDraftVersion, publishedVersion],
  total: 2,
  page: 1,
  perPage: 20,
  hasMore: false,
};

// GET /stored/agents/:id?status=draft resolves to the latest version's config.
export const storedAgentDraft: StoredAgentResponse = {
  id: AGENT_ID,
  status: 'published',
  activeVersionId: PUBLISHED_VERSION_ID,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  name: 'Version Regression Agent',
  instructions: 'REGRESSION-MARKER instructions.',
  model: { provider: 'openai', name: 'gpt-4o-mini' },
};
