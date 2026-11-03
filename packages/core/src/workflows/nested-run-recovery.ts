import type { IMastraLogger } from '../logger';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import { claimWorkflowRunOwnership } from './run-ownership';
import type { WorkflowRunStatus } from './types';

/**
 * A nested run is stored under its own id (one per `.foreach()` item), so its parent is the only
 * thing that can collect its result. The recovery sweeps find it through the run itself and have
 * to decide from the parent's stored status whether that is still possible.
 *
 * - `restart`: the parent can't re-drive it, so restarting it standalone is the only way forward.
 * - `skip`: the parent is being driven (or will be), and its step restarts the nested run itself.
 * - `cancel`: the parent is finished, so nothing will ever collect a restart of this run.
 */
export type NestedRunRecovery = 'restart' | 'skip' | 'cancel';

const FINISHED_STATUSES: ReadonlySet<WorkflowRunStatus> = new Set<WorkflowRunStatus>([
  'success',
  'failed',
  'tripwire',
  'canceled',
  'bailed',
  'skipped',
]);

export function nestedRunRecoveryAction(parentStatus: WorkflowRunStatus | null): NestedRunRecovery {
  // No parent row: the parent is gone, so nothing else can pick the nested run up.
  if (parentStatus === null) return 'restart';
  // A suspended parent waits for its child and resumes it when the child finishes (#25979).
  if (parentStatus === 'suspended') return 'restart';
  if (FINISHED_STATUSES.has(parentStatus)) return 'cancel';
  return 'skip';
}

/**
 * The parent a stored run was started from, or `undefined` for a top-level run.
 */
export function nestedRunParentOf(snapshot: unknown): { workflowName: string; runId: string } | undefined {
  let parsed: any = snapshot;
  if (typeof snapshot === 'string') {
    try {
      parsed = JSON.parse(snapshot);
    } catch {
      return undefined;
    }
  }
  const parent = parsed?.parentWorkflow;
  if (!parent?.workflowId || !parent?.runId) return undefined;
  return { workflowName: parent.workflowId, runId: parent.runId };
}

/**
 * The status a stored run was listed with, so a later write can compare-and-set on it.
 */
export function nestedRunStatusOf(snapshot: unknown): WorkflowRunStatus | undefined {
  let parsed: any = snapshot;
  if (typeof snapshot === 'string') {
    try {
      parsed = JSON.parse(snapshot);
    } catch {
      return undefined;
    }
  }
  return parsed?.status;
}

/**
 * Marks a nested run `canceled` when its parent finished without it, so the sweep stops finding it
 * as an active run. Takes the run's ownership lease first: a live driver on another replica keeps
 * the run, and the write must not race it. The write is a compare-and-set on the status the sweep
 * listed, so a run that finished or suspended in between keeps its own result.
 */
export async function cancelNestedRun({
  store,
  workflowName,
  runId,
  expectedStatus,
  logger,
}: {
  store: WorkflowsStorage;
  workflowName: string;
  runId: string;
  expectedStatus?: WorkflowRunStatus;
  logger?: IMastraLogger;
}): Promise<void> {
  const ownership = await claimWorkflowRunOwnership({ store, runId, force: false, logger });
  if ('owner' in ownership) return;
  try {
    await store.updateWorkflowState({
      workflowName,
      runId,
      opts: { status: 'canceled', ...(expectedStatus ? { expectedStatus } : {}) },
    });
    logger?.debug('Canceled a nested workflow run whose parent finished without it', { workflowName, runId });
  } catch (error) {
    logger?.warn('Failed to cancel a nested workflow run whose parent finished without it', {
      workflowName,
      runId,
      error,
    });
  } finally {
    await ownership.release();
  }
}
