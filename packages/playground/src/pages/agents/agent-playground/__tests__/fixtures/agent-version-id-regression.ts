import type {
  GetAgentResponse,
  StoredAgentResponse,
  ListAgentVersionsResponse,
  ListAgentVersionLabelsResponse,
} from '@mastra/client-js';
import type { AuthCapabilities } from '@/domains/auth/types';

export const AGENT_ID = 'version-regression-agent';
export const PUBLISHED_VERSION_ID = 'version-1-published';
export const LATEST_DRAFT_VERSION_ID = 'version-2-latest-draft';
export const PAGINATED_LATEST_VERSION_ID = 'version-25';
export const PAGINATED_PRODUCTION_VERSION_ID = 'version-5';
export const PAGINATED_OLDER_VERSION_ID = 'version-1';

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

const publishedVersion: ListAgentVersionsResponse['versions'][number] = {
  id: PUBLISHED_VERSION_ID,
  agentId: AGENT_ID,
  versionNumber: 1,
  name: 'Version Regression Agent',
  instructions: 'PUBLISHED-MARKER instructions.',
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  changeMessage: 'Initial version',
  createdAt: '2026-01-01T00:00:00.000Z',
  labels: ['production'],
};

const latestDraftVersion: ListAgentVersionsResponse['versions'][number] = {
  id: LATEST_DRAFT_VERSION_ID,
  agentId: AGENT_ID,
  versionNumber: 2,
  name: 'Version Regression Agent',
  instructions: 'REGRESSION-MARKER instructions.',
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  changeMessage: 'Unpublished draft',
  createdAt: '2026-01-02T00:00:00.000Z',
  labels: ['pr-101', 'latest'],
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

const createPaginatedVersion = (versionNumber: number): ListAgentVersionsResponse['versions'][number] => ({
  id: `version-${versionNumber}`,
  agentId: AGENT_ID,
  versionNumber,
  name: 'Version Regression Agent',
  instructions: `Instructions for version ${versionNumber}.`,
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  changeMessage: `Saved version ${versionNumber}`,
  createdAt: `2026-08-30T12:${String(versionNumber).padStart(2, '0')}:00.000Z`,
  labels: versionNumber === 25 ? ['latest'] : versionNumber === 5 ? ['production'] : [],
});

const paginatedVersions = Array.from({ length: 25 }, (_, index) => createPaginatedVersion(25 - index));

export const firstPlaygroundVersionPage: ListAgentVersionsResponse = {
  versions: paginatedVersions.slice(0, 20),
  total: 25,
  page: 0,
  perPage: 20,
  hasMore: true,
};

export const secondPlaygroundVersionPage: ListAgentVersionsResponse = {
  versions: paginatedVersions.slice(20),
  total: 25,
  page: 1,
  perPage: 20,
  hasMore: false,
};

export const paginatedVersionLabelsList: ListAgentVersionLabelsResponse = {
  labels: [
    {
      name: 'production',
      kind: 'production',
      versionId: PAGINATED_PRODUCTION_VERSION_ID,
      versionNumber: 5,
    },
    {
      name: 'latest',
      kind: 'latest',
      versionId: PAGINATED_LATEST_VERSION_ID,
      versionNumber: 25,
    },
  ],
  pagination: { total: 2, page: 0, perPage: 50, hasMore: false },
};

export const versionLabelsList: ListAgentVersionLabelsResponse = {
  labels: [
    {
      name: 'production',
      kind: 'production',
      versionId: PUBLISHED_VERSION_ID,
      versionNumber: 1,
    },
    {
      name: 'pr-101',
      kind: 'custom',
      versionId: LATEST_DRAFT_VERSION_ID,
      versionNumber: 2,
      revisionToken: 'revision-pr-101-v2',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
    {
      name: 'latest',
      kind: 'latest',
      versionId: LATEST_DRAFT_VERSION_ID,
      versionNumber: 2,
    },
  ],
  pagination: { total: 3, page: 0, perPage: 50, hasMore: false },
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

export const paginatedStoredAgentDraft: StoredAgentResponse = {
  ...storedAgentDraft,
  activeVersionId: PAGINATED_PRODUCTION_VERSION_ID,
  instructions: 'Instructions for version 25.',
};

export const agentExecutionCapabilities = (permissions: string[]): AuthCapabilities => ({
  enabled: true,
  login: null,
  user: { id: 'executor-1' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles: ['executor'], permissions },
});
