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

// Mirrors the branch -> map join in the kitchen-sink complexWorkflow: a starting step,
// a conditional with two arms (short-text / long-text), a mapping step that joins both
// arms, then a final step. Only one arm runs at a time, so the per-step "next step"
// resolution must skip the arm that was never taken.
export const branchWorkflow: GetWorkflowResponse = {
  name: 'branch-workflow',
  steps: {
    start: stepDef('start'),
    'short-text': stepDef('short-text'),
    'long-text': stepDef('long-text'),
    mapping_join: stepDef('mapping_join'),
    final: stepDef('final'),
  },
  allSteps: {
    start: allStepDef('start'),
    'short-text': allStepDef('short-text'),
    'long-text': allStepDef('long-text'),
    mapping_join: allStepDef('mapping_join'),
    final: allStepDef('final'),
  },
  stepGraph: [
    { type: 'step', step: { id: 'start', description: '' } },
    {
      type: 'conditional',
      steps: [
        { type: 'step', step: { id: 'short-text', description: '' } },
        { type: 'step', step: { id: 'long-text', description: '' } },
      ],
      serializedConditions: [
        { id: 'cond-short', fn: 'short' },
        { id: 'cond-long', fn: 'long' },
      ],
    },
    { type: 'step', step: { id: 'mapping_join', mapConfig: '() => {}' } },
    { type: 'step', step: { id: 'final', description: '' } },
  ],
  inputSchema: emptySchema,
  outputSchema: emptySchema,
  stateSchema: emptySchema,
};

// Mirrors the parallel -> map join in the kitchen-sink complexWorkflow: a starting step,
// a parallel entry with two arms (add-letter-b / add-letter-c), a mapping step that joins
// both arms, then a final step. Unlike a conditional, EVERY parallel arm must run, so the
// per-step "next step" resolution must NOT skip a still-idle sibling once the first arm
// has succeeded.
export const parallelWorkflow: GetWorkflowResponse = {
  name: 'parallel-workflow',
  steps: {
    start: stepDef('start'),
    'add-letter-b': stepDef('add-letter-b'),
    'add-letter-c': stepDef('add-letter-c'),
    mapping_join: stepDef('mapping_join'),
    final: stepDef('final'),
  },
  allSteps: {
    start: allStepDef('start'),
    'add-letter-b': allStepDef('add-letter-b'),
    'add-letter-c': allStepDef('add-letter-c'),
    mapping_join: allStepDef('mapping_join'),
    final: allStepDef('final'),
  },
  stepGraph: [
    { type: 'step', step: { id: 'start', description: '' } },
    {
      type: 'parallel',
      steps: [
        { type: 'step', step: { id: 'add-letter-b', description: '' } },
        { type: 'step', step: { id: 'add-letter-c', description: '' } },
      ],
    },
    { type: 'step', step: { id: 'mapping_join', mapConfig: '() => {}' } },
    { type: 'step', step: { id: 'final', description: '' } },
  ],
  inputSchema: emptySchema,
  outputSchema: emptySchema,
  stateSchema: emptySchema,
};

// Mirrors the nested workflow in the kitchen-sink complexWorkflow: a starting step,
// a nested workflow step (component: 'WORKFLOW'), then a final step. A nested workflow is
// atomic from the parent's perspective, so advancing to it via "Run next step" must run it
// to completion (perStep disabled) instead of pausing after its first inner step.
export const nestedWorkflow: GetWorkflowResponse = {
  name: 'nested-workflow',
  steps: {
    start: stepDef('start'),
    'nested-text-processor': stepDef('nested-text-processor'),
    final: stepDef('final'),
  },
  allSteps: {
    start: allStepDef('start'),
    'nested-text-processor': { ...stepDef('nested-text-processor'), isWorkflow: true },
    final: allStepDef('final'),
  },
  stepGraph: [
    { type: 'step', step: { id: 'start', description: '' } },
    {
      type: 'step',
      step: { id: 'nested-text-processor', description: '', component: 'WORKFLOW', serializedStepFlow: [] },
    },
    { type: 'step', step: { id: 'final', description: '' } },
  ],
  inputSchema: emptySchema,
  outputSchema: emptySchema,
  stateSchema: emptySchema,
};
