import type { GetWorkflowRunByIdResponse, ListWorkflowRunsResponse } from '@mastra/client-js';
import type { WorkflowRunState, WorkflowRunStatus } from '@mastra/core/workflows';

const WORKFLOW_NAME = 'demo-workflow';

function snapshot(runId: string, status: WorkflowRunStatus): WorkflowRunState {
  return {
    runId,
    status,
    value: {},
    context: {},
    serializedStepGraph: [],
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    waitingPaths: {},
    timestamp: new Date(2026, 4, 29, 16, 19, 44).getTime(),
  };
}

export function workflowRun(runId: string, status: WorkflowRunStatus) {
  const createdAt = new Date(2026, 4, 29, 16, 19, 44);
  return {
    workflowName: WORKFLOW_NAME,
    runId,
    snapshot: snapshot(runId, status),
    createdAt,
    updatedAt: createdAt,
  };
}

export const emptyWorkflowRuns: ListWorkflowRunsResponse = {
  runs: [],
  total: 0,
};

export const oneSuccessfulRun: ListWorkflowRunsResponse = {
  runs: [workflowRun('run-success-1', 'success')],
  total: 1,
};

const RUN_BASE = new Date(2026, 4, 29, 16, 19, 44);

/**
 * A run-by-id response with two completed steps and one running step, used to
 * drive the workflow timeline through the real WorkflowRunProvider.
 *
 * step-a:  starts at +0ms,    ends at +1000ms  (success)
 * step-b:  starts at +1000ms, ends at +3000ms  (success)
 * step-c:  starts at +3000ms, no endedAt       (running)
 */
export const runWithTimedSteps: GetWorkflowRunByIdResponse = {
  runId: 'run-timeline-1',
  workflowName: WORKFLOW_NAME,
  status: 'running',
  createdAt: RUN_BASE,
  updatedAt: RUN_BASE,
  serializedStepGraph: [],
  steps: {
    'step-a': {
      status: 'success',
      startedAt: RUN_BASE.getTime(),
      endedAt: RUN_BASE.getTime() + 1000,
    },
    'step-b': {
      status: 'success',
      startedAt: RUN_BASE.getTime() + 1000,
      endedAt: RUN_BASE.getTime() + 3000,
    },
    'step-c': {
      status: 'running',
      startedAt: RUN_BASE.getTime() + 3000,
    },
  },
};

/**
 * A run-by-id response whose only step entry is `input`, used to assert the
 * timeline stays hidden until real steps exist.
 */
export const runWithOnlyInput: GetWorkflowRunByIdResponse = {
  runId: 'run-timeline-empty',
  workflowName: WORKFLOW_NAME,
  status: 'success',
  createdAt: RUN_BASE,
  updatedAt: RUN_BASE,
  serializedStepGraph: [],
  steps: {},
};
