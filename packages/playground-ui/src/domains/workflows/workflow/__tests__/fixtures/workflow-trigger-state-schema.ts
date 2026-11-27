import type { GetWorkflowResponse } from '@mastra/client-js';
import { stringify } from 'superjson';
import { twoStepWorkflow } from './workflow-debug-step-controls';

// `z.object({ section: z.object({ status: z.string() }).nullable().default(null) })`, as the server sends it.
export const nullObjectStateWorkflow: GetWorkflowResponse = {
  ...twoStepWorkflow,
  inputSchema: undefined,
  stateSchema: stringify({
    type: 'object',
    properties: {
      section: {
        default: null,
        anyOf: [{ type: 'object', properties: { status: { type: 'string' } }, required: ['status'] }, { type: 'null' }],
      },
    },
    required: ['section'],
  }),
};
