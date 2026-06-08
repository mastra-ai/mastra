import type { ListWorkflowRunsResponse } from '@mastra/client-js';
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
