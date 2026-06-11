import type { GetAgentResponse, GetScorerResponse, GetWorkflowResponse } from '@mastra/client-js';

/** Agent target with three tools — the suggestion source for the mocks editor. */
export const supportAgent: GetAgentResponse = {
  id: 'support-agent',
  name: 'Support Agent',
  instructions: 'You are a support agent.',
  tools: {
    weatherInfo: { id: 'weatherInfo', description: 'Get the weather', inputSchema: '{}', outputSchema: '{}' },
    sendEmail: { id: 'sendEmail', description: 'Send an email', inputSchema: '{}', outputSchema: '{}' },
    chargeCard: { id: 'chargeCard', description: 'Charge a card', inputSchema: '{}', outputSchema: '{}' },
  },
  workflows: {},
  agents: {},
  provider: 'openai',
  modelId: 'gpt-5-mini',
  modelVersion: 'v2',
  modelList: undefined,
  defaultOptions: {},
  defaultGenerateOptionsLegacy: {},
  defaultStreamOptionsLegacy: {},
};

export const agentsWithTools: Record<string, GetAgentResponse> = {
  'support-agent': supportAgent,
};

export const emptyWorkflows: Record<string, GetWorkflowResponse> = {};

export const emptyScorers: Record<string, GetScorerResponse> = {};
