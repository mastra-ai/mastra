import type { StoredAgentResponse } from '@mastra/client-js';

export const cmsAgentWithInstructionBlocks: StoredAgentResponse = {
  id: 'stored-agent',
  status: 'published',
  name: 'Support agent',
  instructions: [{ type: 'prompt_block', content: 'Help customers with their orders.' }],
  model: { provider: 'openai', name: 'gpt-5-mini' },
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
};

export const cmsAgentWithConditionalTool: StoredAgentResponse = {
  ...cmsAgentWithInstructionBlocks,
  instructions: 'Help customers with their orders.',
  tools: {
    refund: {
      description: 'Refund an approved order',
      rules: {
        operator: 'AND',
        conditions: [{ field: 'role', operator: 'equals', value: 'manager' }],
      },
    },
  },
};

export const emptyStoredAgent: StoredAgentResponse = {
  ...cmsAgentWithInstructionBlocks,
  instructions: 'Original instructions',
  model: { provider: 'openai', name: 'gpt-5-mini' },
  tools: {},
  agents: {},
  workflows: {},
  skills: {},
};

export const agentWithConditionalTools: StoredAgentResponse = {
  ...emptyStoredAgent,
  tools: [
    {
      value: { refund: {}, search: {} },
      rules: { operator: 'AND', conditions: [{ field: 'role', operator: 'equals', value: 'manager' }] },
    },
  ],
};

export const agentWithAdvancedConfiguration: StoredAgentResponse = {
  ...cmsAgentWithInstructionBlocks,
  visibility: 'public',
  model: { provider: 'openai', name: 'gpt-5-mini', temperature: 0.5 },
  browser: { type: 'inline', config: { provider: 'playwright', timeout: 15000 } },
  workspace: { type: 'provider', provider: 'custom', config: { root: '/data' } },
  memory: { type: 'id', memoryId: 'support-memory' },
  scorers: { quality: { sampling: { type: 'ratio', rate: 0.5 } } },
  requestContextSchema: { type: 'object', properties: { role: { type: 'string' } } },
};
