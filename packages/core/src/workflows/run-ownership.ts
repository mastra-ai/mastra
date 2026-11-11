import { AGENT_LEASE_RENEW_INTERVAL_MS, AGENT_LEASE_TTL_MS } from '../agent/run-ownership';
import type { IMastraLogger } from '../logger';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import type { RunFence, RunOwnershipRecord } from '../storage/run-fencing';

export const WORKFLOW_RUN_LEASE_TTL_MS = AGENT_LEASE_TTL_MS;
export const WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS = AGENT_LEASE_RENEW_INTERVAL_MS;

export interface WorkflowRunOwnership {
  release(): Promise<void>;
}

const UNFENCED: WorkflowRunOwnership = { release: async () => {} };

/**
 * Runs `tick` `intervalMs` after it starts, then again `intervalMs` after
 * each run of it settles, until the returned function is called. A tick that
 * is running when the chain is stopped finishes, and nothing runs after it.
 * The timer is unref'd and stays the one created here, so every tick runs in
 * the async context this function was called in. `tick` reports its own
 * failures and must not reject.
 */
export function repeatAfterSettled(tick: () => Promise<void>, intervalMs: number): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;

  const arm = () => {
    // `run` never rejects: `tick` handles its own errors.
    timer = setTimeout(() => void run(), intervalMs);
    timer.unref?.();
  };

  const run = async () => {
    try {
      await tick();
    } finally {
      // Checked after the tick: stopping while a tick runs must keep it from re-arming.
      if (!stopped) {
        // Runtimes whose timers are plain numbers (Workers, browsers) have no refresh(); a new
        // timer created here inherits this callback's context, which is the first timer's.
        const { refresh } = timer as { refresh?: () => unknown };
        if (refresh) {
          refresh.call(timer);
        } else {
          arm();
        }
      }
    }
  };

  arm();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

/**
 * Renews the lease `fence` holds every {@link WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS}
 * until the returned function is called, counting each interval from the end
 * of the previous renewal. Stops by itself after the first renewal that finds
 * the claim superseded, reporting it through `onLost`.
 */
export function renewWorkflowLease({
  store,
  fence,
  onLost,
  onError,
}: {
  store: WorkflowsStorage;
  fence: RunFence;
  onLost: (owner: RunOwnershipRecord | null) => void;
  onError: (error: unknown) => void;
}): () => void {
  // Not setInterval: it fires on schedule while the previous renewal is still pending, so a slow
  // store would get concurrent renewals piling up, and an older one could land after a newer one.
  // Waiting for each renewal stretches the gap to the interval plus one write, still well inside
  // the TTL (the interval defaults to a third of it).
  const stop = repeatAfterSettled(async () => {
    try {
      const result = await store.renewRunOwnership({ ...fence, leaseMs: WORKFLOW_RUN_LEASE_TTL_MS });
      if (result.renewed) {
        return;
      }

      // Another claim superseded this one; renewing again could only fail the same way.
      stop();
      onLost(result.record);
    } catch (error) {
      // A failed write may be transient, so the next tick tries again.
      onError(error);
    }
  }, WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS);

  return stop;
}

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
  const stopRenewing = renewWorkflowLease({
    store,
    fence,
    onLost: owner =>
      logger?.warn('Lost the ownership lease of a running workflow run; another process may now recover it', {
        runId,
        owner: owner?.ownerId,
      }),
    onError: error => logger?.warn('Failed to renew workflow run ownership lease', { runId, error }),
  });

  return {
    release: async () => {
      stopRenewing();
      try {
        await store.releaseRunOwnership(fence);
      } catch (error) {
        logger?.warn('Failed to release workflow run ownership lease', { runId, error });
      }
    },
  };
}
