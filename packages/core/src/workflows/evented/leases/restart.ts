/**
 * The `restart()` side of evented leases: whether a run is still live, and the
 * short lease that lets one of several concurrent restarts publish.
 */
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import type { RunOwnershipRecord } from '../../../storage/run-fencing';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../../run-ownership';
import type { WorkflowRunOwnership } from '../../run-ownership';
import { holdRestartLease } from './held-leases';
import { restartLeaseKey, runLivenessKey } from './keys';
import type { LivenessScope } from './liveness';

/**
 * Claims an evented run for `restart()`. Returns the run's live liveness lease
 * instead while a worker handles an event of the run or of a run nested under
 * it, since nested runs keep their ancestors' keys fresh, so the restart is
 * refused until the run could be orphaned.
 *
 * Otherwise claims the short `restart()` lease, so that of several concurrent
 * restarts only one publishes. Liveness is read first so a refused restart
 * takes no lease that would block a later one. The lease is kept until a
 * worker marks the run live (see {@link holdRestartLease}); after that the
 * restarted steps hold their own leases and it is left to lapse.
 */
export async function claimEventedRestart({
  scope,
  store,
  runId,
}: {
  scope?: LivenessScope;
  store: WorkflowsStorage | undefined;
  runId: string;
}): Promise<WorkflowRunOwnership | { owner: RunOwnershipRecord | null }> {
  const unfenced: WorkflowRunOwnership = { release: async () => {} };
  if (!store || !(await store.supportsRunFencing())) {
    return unfenced;
  }

  const live = await store.getRunOwnership({ runId: runLivenessKey(runId) });
  if (live?.live) {
    return { owner: live };
  }

  const claim = await store.claimRunOwnership({
    runId: restartLeaseKey(runId),
    ownerId: globalThis.crypto.randomUUID(),
    leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
    force: false,
  });
  return claim.acquired ? holdRestartLease({ scope, store, runId, record: claim.record }) : { owner: claim.record };
}
