import type { GetAgentResponse } from '@mastra/client-js';

export const supportAgent: GetAgentResponse = {
  id: 'support',
  name: 'Support Bot',
  instructions: 'Be helpful.',
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
export const agentCatalog: Record<string, GetAgentResponse> = {
  support: supportAgent,
  echo: { ...supportAgent, id: 'echo', name: 'Echo Bot' },
};
