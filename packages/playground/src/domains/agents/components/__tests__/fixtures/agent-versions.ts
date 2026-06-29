import type { ListAgentVersionsResponse } from '@mastra/client-js';

export const agentVersionsResponse: ListAgentVersionsResponse = {
  versions: [
    {
      id: 'version-2',
      agentId: 'agent-1',
      versionNumber: 2,
      name: 'Test Agent',
      instructions: 'You are a test agent.',
      model: { provider: 'openai', name: 'gpt-4o-mini' },
      tools: {},
      workflows: {},
      agents: {},
      changeMessage: 'Tighten instructions',
      createdAt: '2026-06-22T10:00:00.000Z',
    },
    {
      id: 'version-1',
      agentId: 'agent-1',
      versionNumber: 1,
      name: 'Test Agent',
      instructions: 'You are a test agent.',
      model: { provider: 'openai', name: 'gpt-4o-mini' },
      tools: {},
      workflows: {},
      agents: {},
      changeMessage: 'Initial version',
      createdAt: '2026-06-21T10:00:00.000Z',
    },
  ],
  total: 2,
  page: 1,
  perPage: 20,
  hasMore: false,
};
