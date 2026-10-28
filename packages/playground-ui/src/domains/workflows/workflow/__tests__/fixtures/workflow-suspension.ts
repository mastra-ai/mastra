import type { GetWorkflowResponse, GetWorkflowRunByIdResponse, StreamVNextChunkType } from '@mastra/client-js';
import { twoStepWorkflow } from './workflow-debug-step-controls';
import { suspendedRunState } from './workflow-run-states';
export const falsySuspension: GetWorkflowRunByIdResponse = {
  ...suspendedRunState,
  steps: {
    transform: {
      status: 'suspended',
      payload: {},
      suspendPayload: false,
      startedAt: 100,
      suspendedAt: 110,
    },
  },
};

export const suspendedIterationArray: GetWorkflowRunByIdResponse = {
  ...suspendedRunState,
  steps: {
    transform: [
      { status: 'success', payload: false, output: 0 },
      {
        status: 'suspended',
        payload: { document: 'second' },
        suspendPayload: {
          question: 'Review the second document',
          __workflow_meta: { path: ['transform', 'review'], application: { untouched: null } },
          application: { constructor: 'opaque', values: [0, false, ''] },
        },
        suspendOutput: false,
        metadata: { application: { iteration: 1 } },
      },
    ],
  },
  suspendedPaths: { transform: [1] },
};

export const nestedIterationWorkflow: GetWorkflowResponse = {
  ...twoStepWorkflow,
  allSteps: {
    ...twoStepWorkflow.allSteps,
    'nested.transform': { ...twoStepWorkflow.allSteps.transform, id: 'nested.transform' },
  },
};

export const nestedIterationSuspension: GetWorkflowRunByIdResponse = {
  ...suspendedRunState,
  steps: {
    nested: { status: 'running' },
    'nested.transform': [
      { status: 'success', payload: false, output: 0 },
      { status: 'suspended', payload: { document: 'second' }, suspendPayload: false },
    ],
  },
};

export const suspendedChunk: StreamVNextChunkType = {
  type: 'workflow-step-suspended',
  runId: suspendedRunState.runId,
  from: 'WORKFLOW',
  payload: {
    id: 'transform',
    stepCallId: 'transform-call',
    status: 'suspended',
    payload: {},
    suspendPayload: { question: 'continue?' },
    startedAt: 100,
    suspendedAt: 110,
  },
};
