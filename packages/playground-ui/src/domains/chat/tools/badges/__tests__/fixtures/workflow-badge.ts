import type { GetWorkflowResponse, ListWorkflowRunsResponse } from '@mastra/client-js';

type WorkflowRunSnapshot = Exclude<ListWorkflowRunsResponse['runs'][number]['snapshot'], string>;
type WorkflowRunStatus = WorkflowRunSnapshot['status'];

export const WORKFLOW_ID = 'badge-workflow';
const WORKFLOW_NAME = 'Badge Workflow';

/** A workflow whose stepGraph has one real step so the graph renders a node. */
export const badgeWorkflow = {
  name: WORKFLOW_NAME,
  stepGraph: [{ type: 'step', step: { id: 'step-a', description: '' } }],
} satisfies Pick<GetWorkflowResponse, 'name' | 'stepGraph'>;

const RUN_BASE = new Date(2026, 4, 29, 16, 19, 44);

function snapshot(runId: string, status: WorkflowRunStatus): WorkflowRunSnapshot {
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
  } satisfies WorkflowRunSnapshot;
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
