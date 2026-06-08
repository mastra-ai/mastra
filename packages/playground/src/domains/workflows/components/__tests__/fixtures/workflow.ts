import type { GetWorkflowResponse } from '@mastra/client-js';
import { stringify } from 'superjson';

const inputSchema = stringify({
  type: 'object',
  properties: {
    value: { type: 'string' },
  },
  required: ['value'],
});

const emptyObjectSchema = stringify({ type: 'object', properties: {} });

const requestContextSchema = stringify({
  type: 'object',
  properties: {
    tenantId: { type: 'string' },
  },
  required: ['tenantId'],
});

export const baseWorkflow: GetWorkflowResponse = {
  name: 'Demo Workflow',
  steps: {
    'step-1': {
      id: 'step-1',
      description: 'First step',
      inputSchema,
      outputSchema: emptyObjectSchema,
      resumeSchema: emptyObjectSchema,
      suspendSchema: emptyObjectSchema,
      stateSchema: emptyObjectSchema,
    },
  },
  allSteps: {
    'step-1': {
      id: 'step-1',
      description: 'First step',
      inputSchema,
      outputSchema: emptyObjectSchema,
      resumeSchema: emptyObjectSchema,
      suspendSchema: emptyObjectSchema,
      stateSchema: emptyObjectSchema,
      isWorkflow: false,
    },
  },
  stepGraph: [],
  inputSchema,
  outputSchema: emptyObjectSchema,
  stateSchema: emptyObjectSchema,
};

export const workflowWithRequestContext: GetWorkflowResponse = {
  ...baseWorkflow,
  requestContextSchema,
};
