import type { GetAgentResponse, GetMemoryStatusResponse } from '@mastra/client-js';

export const v2Agent: GetAgentResponse = {
  id: 'agent-1',
  name: 'Test Agent',
  instructions: 'You are a test agent.',
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
};

export const dynamicFallbackAgent: GetAgentResponse = {
  ...v2Agent,
  modelList: [
    {
      id: 'primary',
      model: { provider: 'openai', modelId: 'gpt-5.4-mini', modelVersion: 'v2' },
      enabled: true,
      maxRetries: 0,
    },
    {
      id: 'fallback',
      model: { provider: 'openai', modelId: 'gpt-5.5', modelVersion: 'v2' },
      enabled: true,
      maxRetries: 2,
    },
  ],
};

export const agentsResponse: Record<string, GetAgentResponse> = { 'agent-1': v2Agent };

export const memoryDisabled: GetMemoryStatusResponse = {
  result: false,
};
