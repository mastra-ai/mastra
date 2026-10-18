import { AGENT_LEASE_RENEW_INTERVAL_MS, AGENT_LEASE_TTL_MS } from '../agent/run-ownership';
import type { IMastraLogger } from '../logger';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import type { RunFence, RunOwnershipRecord } from '../storage/run-fencing';

export const WORKFLOW_RUN_LEASE_TTL_MS = AGENT_LEASE_TTL_MS;

export interface WorkflowRunOwnership {
  release(): Promise<void>;
}

const UNFENCED: WorkflowRunOwnership = { release: async () => {} };

/**
 * Marks this process as the live driver of a workflow run through the storage
 * run-ownership lease (the one durable agents use), renewing it while the run
 * executes. Writes stay unfenced: the lease only tells the boot-time recovery
 * sweep on other replicas that the run is not orphaned.
 *
 * Returns the current owner record instead of a handle when `force` is off and
 * another execution holds a live lease. Stores without run fencing get a no-op
 * handle, keeping their previous behaviour.
 */
export async function claimWorkflowRunOwnership({
  store,
  runId,
  force,
  logger,
}: {
  store: WorkflowsStorage | undefined;
  runId: string;
  force: boolean;
  logger?: IMastraLogger;
}): Promise<WorkflowRunOwnership | { owner: RunOwnershipRecord | null }> {
  if (!store || !(await store.supportsRunFencing())) return UNFENCED;

  const claim = await store.claimRunOwnership({
    runId,
    ownerId: crypto.randomUUID(),
    leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
    force,
  });
  if (!claim.acquired) return { owner: claim.record };

  const fence: RunFence = { runId, generation: claim.record.generation, ownerId: claim.record.ownerId };
  const heartbeat = setInterval(() => {
    store
      .renewRunOwnership({ ...fence, leaseMs: WORKFLOW_RUN_LEASE_TTL_MS })
      .then(result => {
        if (result.renewed) return;
        clearInterval(heartbeat);
        logger?.warn('Lost the ownership lease of a running workflow run; another process may now recover it', {
          runId,
          owner: result.record?.ownerId,
        });
      })
      .catch(error => logger?.warn('Failed to renew workflow run ownership lease', { runId, error }));
  }, AGENT_LEASE_RENEW_INTERVAL_MS);
  heartbeat.unref?.();

  return {
    release: async () => {
      clearInterval(heartbeat);
      try {
        await store.releaseRunOwnership(fence);
      } catch (error) {
        logger?.warn('Failed to release workflow run ownership lease', { runId, error });
      }
    },
  };
}
