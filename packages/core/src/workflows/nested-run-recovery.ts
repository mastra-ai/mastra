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
  // Running, waiting, pending, paused: the parent can still drive its step, and the sweeps do not
  // restart those parents themselves, so the child waits for the parent rather than racing it.
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
 * Reads parent statuses for one recovery sweep. A crashed `.foreach()` leaves one nested run per
 * item, all pointing at the same parent, so a sweep that reads per run pays the parent lookup once
 * per leftover item. The cache is per sweep on purpose: within one sweep the parent's status can
 * only change in the window the sweep already races, and each write it makes is guarded by its own
 * compare-and-set.
 *
 * A rejected lookup is cached too, so siblings under a parent whose read failed don't each retry a
 * store that is already failing. Each of them is handled by its own try/catch, which logs the
 * failure and leaves that run for the next sweep.
 */
export function createNestedRunParentStatusLookup({
  store,
}: {
  store?: WorkflowsStorage;
}): (parent: { workflowName: string; runId: string }) => Promise<WorkflowRunStatus | null> {
  const statuses = new Map<string, Promise<WorkflowRunStatus | null>>();
  return parent => {
    if (!store) return Promise.resolve(null);
    const key = `${parent.workflowName}\u0000${parent.runId}`;
    let status = statuses.get(key);
    if (!status) {
      status = store.loadWorkflowRunStatus(parent);
      statuses.set(key, status);
    }
    return status;
  };
}

/**
 * Marks a nested run `canceled` when its parent finished without it, so the sweep stops finding it
 * as an active run. Takes the run's ownership lease first: a live driver on another replica keeps
 * the run, and the write must not race it. The write is a compare-and-set on the status the sweep
 * listed, so a run that finished or suspended in between keeps its own result.
 *
 * Neither guard retries: a run another process is driving, or one whose status moved since the
 * sweep listed it, stays `running` or keeps its newer status and the next sweep decides again.
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
  if ('owner' in ownership) {
    logger?.debug('Left a nested workflow run whose parent finished, because another process is driving it', {
      workflowName,
      runId,
    });
    return;
  }
  try {
    const updated = await store.updateWorkflowState({
      workflowName,
      runId,
      opts: { status: 'canceled', ...(expectedStatus ? { expectedStatus } : {}) },
    });
    if (!updated) {
      logger?.debug('Left a nested workflow run as it is: it changed status since the sweep listed it', {
        workflowName,
        runId,
      });
    } else {
      logger?.debug('Canceled a nested workflow run whose parent finished without it', { workflowName, runId });
    }
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
