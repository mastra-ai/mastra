/**
 * The `restart()` side of evented leases: whether a run, or a nested run it
 * drives, is still live, and the short lease that lets one concurrent restart
 * publish.
 */
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import type { RunOwnershipRecord } from '../../../storage/run-fencing';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../../run-ownership';
import type { WorkflowRunOwnership } from '../../run-ownership';
import type { WorkflowRunState } from '../../types';
import { isQueuedForeachIteration } from '../workflow-event-processor/loop';
import { forEachBounded } from './bounded';
import { restartLeaseKey, runLivenessKey } from './keys';

// Reads one restart check sends at once while it walks a run's nested runs.
const NESTED_RUN_READ_CONCURRENCY = 8;

// Nested workflows nest a few levels at most; the bound only stops a corrupt snapshot from looping.
const MAX_NESTED_RUN_DEPTH = 16;

/**
 * The nested runs a running step result still drives: its own nested run, or
 * the nested runs of the foreach items that have not finished.
 */
function runningNestedRunIds(result: { status?: unknown; metadata?: unknown; output?: unknown } | undefined): string[] {
  if (result?.status !== 'running') {
    return [];
  }

  const metadata = result.metadata as
    | { nestedRunId?: string; foreachNestedRunIds?: Record<string, string> }
    | undefined;
  const items = metadata?.foreachNestedRunIds;
  if (!items) {
    return metadata?.nestedRunId ? [metadata.nestedRunId] : [];
  }

  // A foreach item whose output slot is filled finished; an empty or queued slot still runs.
  const output = result.output;
  return Object.entries(items)
    .filter(([index]) => {
      const slot = Array.isArray(output) ? output[Number(index)] : undefined;
      return slot === null || slot === undefined || isQueuedForeachIteration(slot);
    })
    .map(([, nestedRunId]) => nestedRunId);
}

/**
 * The liveness lease of the run, or of a nested run one of its running steps
 * drives, that is live and expires first. `null` when none is live. Nested
 * runs keep their own liveness key, and a parent step that only dispatched a
 * nested run holds no step lease while the nested run works.
 */
async function findLiveRun(
  store: WorkflowsStorage,
  runId: string,
  context: WorkflowRunState['context'] | undefined,
): Promise<RunOwnershipRecord | null> {
  let earliest: RunOwnershipRecord | null = null;

  const visit = async (runId: string, context: WorkflowRunState['context'] | undefined, depth: number) => {
    // The earliest expiry is reported, so a refused restart is retried as soon as any key could lapse.
    const record = await store.getRunOwnership({ runId: runLivenessKey(runId) });
    if (record?.live && (!earliest || record.leaseExpiresAt! < earliest.leaseExpiresAt!)) {
      earliest = record;
    }

    if (depth >= MAX_NESTED_RUN_DEPTH) {
      return;
    }

    const nested = Object.entries(context ?? {}).flatMap(([stepId, result]) =>
      runningNestedRunIds(result).map(nestedRunId => ({ stepId, nestedRunId })),
    );
    // Nested runs are stored under the id of the step that runs them.
    await forEachBounded(nested, NESTED_RUN_READ_CONCURRENCY, async ({ stepId, nestedRunId }) => {
      const snapshot = await store.loadWorkflowSnapshot({ workflowName: stepId, runId: nestedRunId });
      await visit(nestedRunId, snapshot?.context, depth + 1);
    });
  };

  await visit(runId, context, 0);
  return earliest;
}

/**
 * Claims an evented run for `restart()`. Returns the live liveness lease
 * instead while a worker runs a step of the run or of a nested run it drives,
 * so the restart is refused until the run could be orphaned.
 *
 * Otherwise claims the short `restart()` lease, so that of several concurrent
 * restarts only one publishes. Liveness is read first so a refused restart
 * takes no lease that would block a later one. The lease is never renewed or
 * released: the restarted steps take their own leases on the workers, and the
 * lease only has to last until they do.
 */
export async function claimEventedRestart({
  store,
  runId,
  snapshot,
}: {
  store: WorkflowsStorage | undefined;
  runId: string;
  snapshot: WorkflowRunState;
}): Promise<WorkflowRunOwnership | { owner: RunOwnershipRecord | null }> {
  const unfenced: WorkflowRunOwnership = { release: async () => {} };
  if (!store || !(await store.supportsRunFencing())) {
    return unfenced;
  }

  const live = await findLiveRun(store, runId, snapshot.context);
  if (live) {
    return { owner: live };
  }

  const claim = await store.claimRunOwnership({
    runId: restartLeaseKey(runId),
    ownerId: globalThis.crypto.randomUUID(),
    leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
    force: false,
  });
  return claim.acquired ? unfenced : { owner: claim.record };
}
