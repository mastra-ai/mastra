import type { GetAgentResponse, ListAgentVersionsResponse, AgentVersionResponse } from '@mastra/client-js';
import type { AgentEditorConfig } from '@mastra/core/agent';

export const AGENT_ID = 'editor-lock-agent';
export const VERSION_ID = 'editor-lock-version-1';

export const makeCodeAgent = (editor: AgentEditorConfig | undefined): GetAgentResponse => ({
  id: AGENT_ID,
  name: 'Editor Lock Agent',
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
  activeVersionId: VERSION_ID,
  hasDraft: false,
  editor,
});

const publishedVersion: AgentVersionResponse = {
  id: VERSION_ID,
  agentId: AGENT_ID,
  versionNumber: 1,
  name: 'Editor Lock Agent',
  instructions: 'Code-defined instructions.',
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  changeMessage: 'Initial version',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const versionsList: ListAgentVersionsResponse = {
  versions: [publishedVersion],
  total: 1,
  page: 1,
  perPage: 20,
  hasMore: false,
};
