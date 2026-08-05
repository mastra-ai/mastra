import type { GetAgentResponse, GetMemoryStatusResponse } from '@mastra/client-js';

/** Minimal v2 agent the Thread tree reads for model attribution and memory gating. */
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

/** Memory disabled — keeps the memory sidebar/status fan-out quiet. */
export const memoryDisabled: GetMemoryStatusResponse = {
  result: false,
};

export const memoryEnabled: GetMemoryStatusResponse = {
  result: true,
};
