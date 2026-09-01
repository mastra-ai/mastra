import type { GetAgentResponse, GetSystemPackagesResponse, ListAgentVersionsResponse } from '@mastra/client-js';
import type { AuthCapabilities } from '@/domains/auth/types';

export const AGENT_ID = 'code-agent-with-unavailable-production-state';
export const LATEST_VERSION_ID = 'version-2';
export const PRODUCTION_VERSION_ID = 'version-1';

export const codeAgent: GetAgentResponse = {
  id: AGENT_ID,
  name: 'Code agent with stored versions',
  instructions: 'Code-defined instructions.',
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
  activeVersionId: PRODUCTION_VERSION_ID,
  hasDraft: true,
};

export const versionsList: ListAgentVersionsResponse = {
  versions: [
    {
      id: LATEST_VERSION_ID,
      agentId: AGENT_ID,
      versionNumber: 2,
      name: 'Code agent with stored versions',
      instructions: 'Latest stored instructions.',
      model: { provider: 'openai', name: 'gpt-4o-mini' },
      changeMessage: 'Latest draft',
      createdAt: '2026-08-31T12:00:00.000Z',
      labels: ['latest'],
    },
    {
      id: PRODUCTION_VERSION_ID,
      agentId: AGENT_ID,
      versionNumber: 1,
      name: 'Code agent with stored versions',
      instructions: 'Published stored instructions.',
      model: { provider: 'openai', name: 'gpt-4o-mini' },
      changeMessage: 'Published version',
      createdAt: '2026-08-30T12:00:00.000Z',
      labels: ['production'],
    },
  ],
  total: 2,
  page: 0,
  perPage: 20,
  hasMore: false,
};

export const systemPackages: GetSystemPackagesResponse = {
  packages: [],
  isDev: true,
  cmsEnabled: true,
  observabilityEnabled: true,
  editorSource: 'db',
  editorSourceCapabilities: {
    source: 'db',
    storage: 'database',
    canSave: true,
    canOpenChangeRequest: false,
  },
};

export const versionAccess: AuthCapabilities = {
  enabled: true,
  login: null,
  user: { id: 'publisher-1' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: {
    roles: ['publisher'],
    permissions: [`stored-agents:read:${AGENT_ID}`, `stored-agents:publish:${AGENT_ID}`],
  },
};
