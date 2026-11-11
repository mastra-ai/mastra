/**
 * Leases on single step occurrences: the claim a worker takes before running a
 * leaf step, how a duplicate delivery waits for it, and how a retry hands it on.
 */
import type { IMastraLogger } from '../../../logger';
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import type { ClaimRunOwnershipResult, RunFence, RunOwnershipRecord } from '../../../storage/run-fencing';
import {
  WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS,
  WORKFLOW_RUN_LEASE_TTL_MS,
  renewWorkflowLease,
} from '../../run-ownership';
import type { LivenessScope } from './liveness';

/** The claim a same-key follow-up event carries so its receiver can take the lease over. */
export interface StepLeaseHandoff {
  key: string;
  generation: number;
}

/** A step occurrence lease held by this worker, renewed until it is released or handed off. */
export interface StepLease {
  /**
   * Stops renewing and returns the claim to attach to the follow-up event.
   * The lease stays this worker's until {@link StepLease.confirmHandOff}, so a
   * follow-up that is never published is released like any other lease.
   */
  handOff(): StepLeaseHandoff | undefined;
  /** The follow-up carrying the claim was published: release becomes a no-op. */
  confirmHandOff(): void;
  /** Stops renewing and releases the lease unless it was handed off or superseded. */
  release(): Promise<void>;
  /**
   * Whether another delivery took the lease over, so it runs the step again
   * and owns what follows it. Call it before handing the lease off: a
   * completed hand-off supersedes the lease too.
   */
  superseded(): Promise<boolean>;
}

/** Lease for steps that run without one (no run fencing, or the workflow opted out of recovery). */
export const UNLEASED_STEP: StepLease = {
  handOff: () => undefined,
  confirmHandOff: () => {},
  superseded: async () => false,
  release: async () => {},
};

/** Waits `ms` without keeping the process alive for it. */
const sleep = (ms: number) =>
  new Promise<void>(resolve => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });

/**
 * How long a delivery waits before checking a live holder again. Waking before
 * the holder's lease could expire notices an early release, and jitter spreads
 * the waiters of one occurrence apart.
 */
function holdDelay(holder: RunOwnershipRecord | null): number {
  const expiresIn = (holder?.leaseExpiresAt?.getTime() ?? Date.now()) - Date.now();
  const jitter = Math.random() * (WORKFLOW_RUN_LEASE_TTL_MS / 10);
  return Math.min(Math.max(0, expiresIn), WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS) + jitter;
}

/**
 * Outcome of {@link acquireStepLease}: the lease, `'drop'` when the delivery
 * must be acknowledged without running the step, or `'defer'` when the process
 * is shutting down and the broker should hand the delivery to another
 * instance.
 */
export type StepLeaseClaim = StepLease | 'drop' | 'defer';

/**
 * Claims the lease of one step occurrence for this worker.
 *
 * A delivery carrying `handoff` adopts the lease its publisher still holds.
 * Once another worker adopted it, the delivery is a duplicate: it is dropped
 * while that worker holds the lease or after it finished.
 *
 * Otherwise the claim is not forced. While another worker holds a live lease
 * the delivery waits (keeping the broker message in flight) and claims once
 * that lease expires, so a message redelivered after its worker crashed still
 * runs. If the holder releases instead, it ran the occurrence and the delivery
 * is dropped, unless `claimAfterRelease` marks it as a new attempt of the same
 * occurrence, such as a resume of the step the holder suspended. A process
 * shutting down stops waiting and defers the delivery. A delivery whose
 * occurrence `finished` reports as done and passed by the run is dropped
 * instead of waiting. `scope` is the process the delivery runs in.
 */
export async function acquireStepLease({
  scope,
  store,
  key,
  handoff,
  claimAfterRelease,
  finished,
  logger,
}: {
  scope: LivenessScope;
  store: WorkflowsStorage;
  key: string;
  handoff?: StepLeaseHandoff;
  claimAfterRelease: boolean;
  finished?: () => Promise<boolean>;
  logger?: IMastraLogger;
}): Promise<StepLeaseClaim> {
  const ownerId = globalThis.crypto.randomUUID();
  const claim = (options: { force: boolean; expectedGeneration?: number }) =>
    store.claimRunOwnership({ runId: key, ownerId, leaseMs: WORKFLOW_RUN_LEASE_TTL_MS, ...options });

  if (handoff && handoff.key !== key) {
    // A hand-off for another occurrence must not take over this one; claim it like any delivery.
    logger?.warn('Ignoring a workflow step lease hand-off made for another step occurrence', {
      key,
      handoffKey: handoff.key,
    });
  } else if (handoff) {
    // Forced but fenced on the publisher's generation, so only the first receiver of the hand-off wins.
    const adopted = await claim({ force: true, expectedGeneration: handoff.generation });
    if (adopted.acquired) {
      return holdStepLease({ store, record: adopted.record, logger });
    }

    // A live or released lease means another receiver adopted it. An expired one means that
    // receiver crashed: claim it below like any redelivery.
    const adoptedElsewhere = adopted.record && (adopted.record.live || !adopted.record.leaseExpiresAt);
    if (adoptedElsewhere) {
      return 'drop';
    }
  }

  let result: ClaimRunOwnershipResult = await claim({ force: false });
  if (!result.acquired) {
    // Checked once, before the first wait: the live holder then owns what follows the occurrence.
    if (await finished?.()) {
      return 'drop';
    }

    logger?.debug('Waiting for another worker to finish or abandon a workflow step', {
      key,
      owner: result.record?.ownerId,
      leaseExpiresAt: result.record?.leaseExpiresAt,
    });
  }

  while (!result.acquired) {
    // Checked before and after the wait: a process shutting down hands the delivery back at once.
    if (scope.__shuttingDown) {
      return 'defer';
    }

    await sleep(holdDelay(result.record));
    if (scope.__shuttingDown) {
      return 'defer';
    }

    // A released lease (no expiry) means the holder ran the occurrence to the end.
    const current = await store.getRunOwnership({ runId: key });
    if (current && !current.leaseExpiresAt && !claimAfterRelease) {
      return 'drop';
    }

    // Racing waiters that read the same record resolve to one winner.
    result = await claim({ force: false, expectedGeneration: current?.generation ?? 0 });
  }

  return holdStepLease({ store, record: result.record, logger });
}

/** Renews the acquired step lease until it is released or handed off, and returns its handle. */
function holdStepLease({
  store,
  record,
  logger,
}: {
  store: WorkflowsStorage;
  record: RunOwnershipRecord;
  logger?: IMastraLogger;
}): StepLease {
  const fence: RunFence = { runId: record.runId, generation: record.generation, ownerId: record.ownerId };
  const stopRenewing = renewWorkflowLease({
    store,
    fence,
    onLost: owner =>
      logger?.warn('Lost the lease of a running workflow step; another worker may run it again', {
        key: fence.runId,
        owner: owner?.ownerId,
      }),
    onError: error => logger?.warn('Failed to renew workflow step lease', { key: fence.runId, error }),
  });

  let handedOff = false;
  let released = false;
  return {
    handOff() {
      // Renewal stops here, before the follow-up is published, so the receiver's claim can win.
      stopRenewing();
      return { key: fence.runId, generation: fence.generation };
    },
    confirmHandOff() {
      handedOff = true;
    },
    async release() {
      stopRenewing();

      // A handed-off lease belongs to the follow-up's receiver now.
      if (handedOff || released) {
        return;
      }

      released = true;
      try {
        await store.releaseRunOwnership(fence);
      } catch (error) {
        logger?.warn('Failed to release workflow step lease', { key: fence.runId, error });
      }
    },
    async superseded() {
      // Read rather than taken from a failed renewal: renewal notices a takeover only on its next
      // tick, and some stores refuse to renew an expired lease nobody else claimed.
      try {
        const current = await store.getRunOwnership({ runId: fence.runId });
        // A missing row (pruned) or an expired one still ours has no other holder to defer to.
        return current !== null && (current.ownerId !== fence.ownerId || current.generation !== fence.generation);
      } catch (error) {
        // When the store cannot answer, the step's result is published as it would be without a lease.
        logger?.warn('Failed to check the lease of a finished workflow step', { key: fence.runId, error });
        return false;
      }
    },
  };
}
