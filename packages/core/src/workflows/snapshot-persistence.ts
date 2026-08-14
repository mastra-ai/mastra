import type { WorkflowRunSnapshot, WorkflowRunState, WorkflowRunStatus } from './types';

export interface SnapshotPersistenceOptions {
  pruneSnapshot?: (params: { snapshot: WorkflowRunState; workflowStatus: WorkflowRunStatus }) => WorkflowRunState;
  prepareSnapshotForPersistence?: (params: {
    snapshot: WorkflowRunState;
    workflowStatus: WorkflowRunStatus;
  }) => WorkflowRunSnapshot;
}

/** Applies full-snapshot pruning first, then selects the persisted representation. */
export function prepareWorkflowSnapshotForPersistence(params: {
  snapshot: WorkflowRunState;
  workflowStatus: WorkflowRunStatus;
  options?: SnapshotPersistenceOptions;
}): WorkflowRunSnapshot {
  const fullSnapshot = params.options?.pruneSnapshot
    ? params.options.pruneSnapshot({ snapshot: params.snapshot, workflowStatus: params.workflowStatus })
    : params.snapshot;

  return params.options?.prepareSnapshotForPersistence
    ? params.options.prepareSnapshotForPersistence({ snapshot: fullSnapshot, workflowStatus: params.workflowStatus })
    : fullSnapshot;
}
