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

export const memoryDisabled: GetMemoryStatusResponse = {
  result: false,
};
