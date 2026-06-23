import type {
  ActivateAgentVersionResponse,
  AgentVersionResponse,
  DeleteAgentVersionResponse,
  FavoriteToggleResponse,
  ListAgentVersionsResponse,
  ListStoredAgentsResponse,
  StoredAgentResponse,
} from '@mastra/client-js';

export const makeStoredAgent = (overrides: Partial<StoredAgentResponse> = {}): StoredAgentResponse => ({
  id: overrides.id ?? 'agent-1',
  status: overrides.status ?? 'draft',
  activeVersionId: overrides.activeVersionId,
  authorId: overrides.authorId ?? 'user-1',
  visibility: overrides.visibility ?? 'private',
  metadata: overrides.metadata,
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  name: overrides.name ?? 'Support Agent',
  description: overrides.description ?? 'Handles support requests',
  instructions: overrides.instructions ?? 'Help customers quickly.',
  model: overrides.model ?? { provider: 'openai', name: 'gpt-4o-mini' },
  tools: overrides.tools,
  workflows: overrides.workflows,
  agents: overrides.agents,
  integrationTools: overrides.integrationTools,
  toolProviders: overrides.toolProviders,
  mcpClients: overrides.mcpClients,
  inputProcessors: overrides.inputProcessors,
  outputProcessors: overrides.outputProcessors,
  memory: overrides.memory,
  scorers: overrides.scorers,
  skills: overrides.skills,
  workspace: overrides.workspace,
  browser: overrides.browser,
  requestContextSchema: overrides.requestContextSchema,
  isFavorited: overrides.isFavorited,
  favoriteCount: overrides.favoriteCount,
});

export const makeStoredAgentsList = (agents: StoredAgentResponse[]): ListStoredAgentsResponse => ({
  agents,
  total: agents.length,
  page: 1,
  perPage: 50,
  hasMore: false,
});

export const makeAgentVersion = (overrides: Partial<AgentVersionResponse> = {}): AgentVersionResponse => ({
  id: overrides.id ?? 'version-1',
  agentId: overrides.agentId ?? 'agent-1',
  versionNumber: overrides.versionNumber ?? 1,
  name: overrides.name ?? 'Support Agent',
  description: overrides.description ?? 'Handles support requests',
  instructions: overrides.instructions ?? 'Help customers quickly.',
  model: overrides.model ?? { provider: 'openai', name: 'gpt-4o-mini' },
  tools: overrides.tools,
  defaultOptions: overrides.defaultOptions,
  workflows: overrides.workflows,
  agents: overrides.agents,
  integrationTools: overrides.integrationTools,
  toolProviders: overrides.toolProviders,
  mcpClients: overrides.mcpClients,
  inputProcessors: overrides.inputProcessors,
  outputProcessors: overrides.outputProcessors,
  memory: overrides.memory,
  scorers: overrides.scorers,
  requestContextSchema: overrides.requestContextSchema,
  changedFields: overrides.changedFields,
  changeMessage: overrides.changeMessage,
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
});

export const makeAgentVersionsList = (versions: AgentVersionResponse[]): ListAgentVersionsResponse => ({
  versions,
  total: versions.length,
  page: 1,
  perPage: 50,
  hasMore: false,
});

export const activatedVersion: ActivateAgentVersionResponse = {
  success: true,
  message: 'Version 2 activated',
  activeVersionId: 'version-2',
};

export const deletedVersion: DeleteAgentVersionResponse = {
  success: true,
  message: 'Version 1 deleted',
};

export const favoritedAgent: FavoriteToggleResponse = {
  favorited: true,
  favoriteCount: 2,
};

export const unfavoritedAgent: FavoriteToggleResponse = {
  favorited: false,
  favoriteCount: 1,
};
