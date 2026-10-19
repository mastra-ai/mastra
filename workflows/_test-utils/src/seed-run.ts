import type { WorkflowsStorage } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';

/**
 * Stores a run the way the given storage version writes it, so tests can seed state
 * (e.g. an interrupted run) that the workflow then reads back.
 */
export async function seedWorkflowRun(
  workflowsStore: WorkflowsStorage,
  args: { workflowName: string; runId: string; snapshot: WorkflowRunState; storageVersion?: 1 | 2 },
) {
  const { storageVersion, ...run } = args;
  if (storageVersion !== 2) {
    await workflowsStore.persistWorkflowSnapshot(run);
    return;
  }
  const { context, value, ...header } = run.snapshot;
  await workflowsStore.writeWorkflowRunCheckpoint({
    workflowName: run.workflowName,
    runId: run.runId,
    header,
    steps: context,
    state: value,
  });
}
