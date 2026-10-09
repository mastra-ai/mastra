import type { GetAgentResponse, GetToolResponse } from '@mastra/client-js';

const refundUserTool: GetToolResponse = {
  id: 'refundUser',
  description: 'Refund a user a dollar amount.',
};

const baseAgent: GetAgentResponse = {
  id: 'base',
  name: 'Base',
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

/** Two agents share `refundUser`; a third doesn't have it. */
export const agentsWithRefundUser: Record<string, GetAgentResponse> = {
  'billing-agent': { ...baseAgent, id: 'billing-agent', name: 'Billing Agent', tools: { refundUser: refundUserTool } },
  'support-agent': { ...baseAgent, id: 'support-agent', name: 'Support Agent', tools: { refundUser: refundUserTool } },
  'chef-agent': { ...baseAgent, id: 'chef-agent', name: 'Chef Agent' },
};

export const agentsWithoutTools: Record<string, GetAgentResponse> = {
  'chef-agent': { ...baseAgent, id: 'chef-agent', name: 'Chef Agent' },
};
