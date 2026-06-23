import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';

const AT = new Date(2026, 4, 29, 16, 19, 44).getTime();

function runState(
  runId: string,
  workflowName: string,
  overrides: Partial<GetWorkflowRunByIdResponse>,
): GetWorkflowRunByIdResponse {
  return {
    runId,
    workflowName,
    createdAt: new Date(AT),
    updatedAt: new Date(AT),
    status: 'running',
    steps: {},
    ...overrides,
  };
}

// A run that suspended on its second step (transform). The provider converts this
// into a stream result with `result.steps.transform.status === 'suspended'`, which is
// what `useSuspendedSteps` reads.
export const suspendedRunState: GetWorkflowRunByIdResponse = runState('run-suspended', 'two-step-workflow', {
  status: 'suspended',
  payload: { request: true },
  steps: {
    extract: {
      status: 'success',
      payload: { request: true },
      output: { customerId: 'cus_123' },
      startedAt: AT,
      endedAt: AT,
    },
    transform: {
      status: 'suspended',
      payload: { request: true },
      suspendPayload: { question: 'continue?' },
      startedAt: AT,
      suspendedAt: AT,
    },
  },
});

// A fully successful run: nothing is suspended.
export const successfulRunState: GetWorkflowRunByIdResponse = runState('run-success', 'two-step-workflow', {
  status: 'success',
  result: {},
  payload: {},
  steps: {
    extract: { status: 'success', payload: {}, output: {}, startedAt: AT, endedAt: AT },
    transform: { status: 'success', payload: {}, output: {}, startedAt: AT, endedAt: AT },
  },
});

// A paused (per-step/debug) run with no completed steps yet.
export const pausedRunNoStepsState: GetWorkflowRunByIdResponse = runState('run-paused-empty', 'two-step-workflow', {
  status: 'paused',
  payload: {},
  steps: {},
});

// A paused run that completed the first step and is waiting on the next.
export const pausedRunAfterFirstStepState: GetWorkflowRunByIdResponse = runState(
  'run-paused-first',
  'two-step-workflow',
  {
    status: 'paused',
    payload: {},
    steps: {
      extract: { status: 'success', payload: {}, output: {}, startedAt: AT, endedAt: AT },
    },
  },
);

// A paused run on the branch workflow that resolved the `long-text` arm, leaving the
// never-taken `short-text` arm without a result. The waited step must skip past it.
export const pausedRunBranchResolvedState: GetWorkflowRunByIdResponse = runState(
  'run-paused-branch',
  'branch-workflow',
  {
    status: 'paused',
    payload: {},
    steps: {
      start: { status: 'success', payload: {}, output: {}, startedAt: AT, endedAt: AT },
      'long-text': { status: 'success', payload: {}, output: {}, startedAt: AT, endedAt: AT },
    },
  },
);
