import type { GetWorkflowResponse } from '@mastra/client-js';

/**
 * Minimal `GET /workflows/:id` payload. `useWorkflowSchema` only reads
 * `inputSchema`/`outputSchema`, which the server sends as JSON strings.
 */
export const makeWorkflowDetails = (overrides: Partial<GetWorkflowResponse> = {}): GetWorkflowResponse => ({
  name: 'summarize',
  steps: {},
  allSteps: {},
  stepGraph: [],
  inputSchema: JSON.stringify({ type: 'object', properties: { text: { type: 'string' } } }),
  outputSchema: JSON.stringify({ type: 'object', properties: { summary: { type: 'string' } } }),
  stateSchema: '',
  ...overrides,
});
