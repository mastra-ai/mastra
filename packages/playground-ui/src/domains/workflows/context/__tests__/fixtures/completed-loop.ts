import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import type { WorkflowRunState } from '@mastra/core/workflows';

export const completedLoop = {
  runId: 'completed-loop',
  workflowName: 'two-step-workflow',
  status: 'success',
  createdAt: new Date('2026-09-15T09:00:00Z'),
  updatedAt: new Date('2026-09-15T09:00:01Z'),
  steps: {
    'analyze-document[0].count-words': {
      status: 'success',
      payload: { text: 'A document' },
      output: { words: 2 },
      startedAt: 100,
      endedAt: 110,
    },
  },
} satisfies GetWorkflowRunByIdResponse;

export const suspendedLoop: GetWorkflowRunByIdResponse = {
  ...completedLoop,
  status: 'suspended',
  steps: {},
};

export const partialCompletedLoop: GetWorkflowRunByIdResponse = {
  ...completedLoop,
  runId: 'live-run',
  steps: {
    'analyze-document[0].count-words': { status: 'success', startedAt: 100, endedAt: 110 },
    persisted: { status: 'success', startedAt: 100, endedAt: 110 },
    ['__proto__']: { status: 'success', output: false },
  },
};

export const pausedLoop: GetWorkflowRunByIdResponse = { ...suspendedLoop, status: 'paused' };

export const resumedApprovalRun: GetWorkflowRunByIdResponse = {
  ...completedLoop,
  status: 'running',
  steps: {
    approval: { status: 'success', payload: {}, output: {}, startedAt: 100, endedAt: 110 },
    slow: { status: 'running', payload: {}, startedAt: 120 },
  },
};

export const runningApprovalRun: GetWorkflowRunByIdResponse = {
  ...completedLoop,
  status: 'running',
  steps: { approval: { status: 'running', payload: {}, startedAt: 100 } },
};

export const secondApprovalRun: GetWorkflowRunByIdResponse = {
  ...completedLoop,
  status: 'suspended',
  steps: {
    approval: { status: 'success', payload: {}, output: {}, startedAt: 100, endedAt: 110 },
    'second-approval': { status: 'suspended', payload: {}, suspendPayload: {}, startedAt: 120, suspendedAt: 130 },
  },
};

export const completedIterationArray: GetWorkflowRunByIdResponse = {
  ...completedLoop,
  steps: {
    transform: [
      { status: 'success', payload: false, output: 0, metadata: { application: { untouched: [null, false] } } },
      { status: 'success', payload: 0, output: false },
      { status: 'success', payload: '', output: null },
      { status: 'success', payload: null, output: '' },
    ],
  },
};

export const rawCompletedRun: WorkflowRunState = {
  runId: 'raw-completed',
  status: 'success',
  result: { accepted: false },
  value: {},
  context: {
    transform: { status: 'success', payload: 0, output: false, startedAt: 100, endedAt: 110 },
  },
  serializedStepGraph: [],
  activePaths: [],
  activeStepsPath: {},
  suspendedPaths: {},
  resumeLabels: {},
  waitingPaths: {},
  timestamp: 110,
};
