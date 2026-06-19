import type { GetWorkflowResponse } from '@mastra/client-js';

const emptySchema = '{"type":"object"}';

const stepDef = (id: string) => ({
  id,
  description: '',
  inputSchema: emptySchema,
  outputSchema: emptySchema,
  resumeSchema: emptySchema,
  suspendSchema: emptySchema,
  stateSchema: emptySchema,
});

const allStepDef = (id: string) => ({
  ...stepDef(id),
  isWorkflow: false,
});

export const twoStepWorkflow: GetWorkflowResponse = {
  name: 'two-step-workflow',
  steps: {
    extract: stepDef('extract'),
    transform: stepDef('transform'),
  },
  allSteps: {
    extract: allStepDef('extract'),
    transform: allStepDef('transform'),
  },
  stepGraph: [
    { type: 'step', step: { id: 'extract', description: '' } },
    { type: 'step', step: { id: 'transform', description: '' } },
  ],
  inputSchema: emptySchema,
  outputSchema: emptySchema,
  stateSchema: emptySchema,
};
