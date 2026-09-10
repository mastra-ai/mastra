import type { GetWorkflowResponse } from '@mastra/client-js';

export const chatWorkflow: GetWorkflowResponse = {
  name: 'Research workflow',
  steps: {},
  allSteps: {},
  inputSchema: '{}',
  outputSchema: '{}',
  stateSchema: '{}',
  stepGraph: [{ type: 'step', step: { id: 'research', description: 'Research the topic' } }],
};
