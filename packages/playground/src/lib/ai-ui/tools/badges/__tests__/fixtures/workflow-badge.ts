import type { GetWorkflowResponse, ListWorkflowRunsResponse } from '@mastra/client-js';
import type { WorkflowRunState, WorkflowRunStatus } from '@mastra/core/workflows';

export const WORKFLOW_ID = 'badge-workflow';
const WORKFLOW_NAME = 'Badge Workflow';

/** A workflow whose stepGraph has one real step so the graph renders a node. */
export const badgeWorkflow = {
  name: WORKFLOW_NAME,
  stepGraph: [{ type: 'step', step: { id: 'step-a', description: '' } }],
} as unknown as GetWorkflowResponse;

const RUN_BASE = new Date(2026, 4, 29, 16, 19, 44);

function snapshot(runId: string, status: WorkflowRunStatus): WorkflowRunState {
  return {
    runId,
    status,
    value: {},
    context: {},
    serializedStepGraph: [{ type: 'step', step: { id: 'step-a', description: '' } }],
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    waitingPaths: {},
    timestamp: RUN_BASE.getTime(),
  } as unknown as WorkflowRunState;
}

export const RUN_ID = 'badge-run-1';

export const badgeWorkflowRuns: ListWorkflowRunsResponse = {
  runs: [
    {
      workflowName: WORKFLOW_NAME,
      runId: RUN_ID,
      snapshot: snapshot(RUN_ID, 'success'),
      createdAt: RUN_BASE,
      updatedAt: RUN_BASE,
    },
  ],
  total: 1,
};
