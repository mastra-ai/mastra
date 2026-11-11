import type { IMastraLogger } from '../../logger';
import type { WorkflowsStorage } from '../../storage/domains/workflows/base';
import type { ClaimRunOwnershipResult, RunFence, RunOwnershipRecord } from '../../storage/run-fencing';
import { WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS, WORKFLOW_RUN_LEASE_TTL_MS, renewWorkflowLease } from '../run-ownership';
import type { WorkflowRunOwnership } from '../run-ownership';

/**
 * Lease key of one step occurrence: the run, the step's execution path (which
 * includes the foreach item index) and, for a loop body, the iteration.
 * Retries of an occurrence share its key.
 */
export function stepOccurrenceKey(runId: string, executionPath: number[], iterationCount?: number): string {
  const iteration = iterationCount === undefined ? '' : `:i${iterationCount}`;
  return `${runId}::step:${executionPath.join('.')}${iteration}`;
}

/** Lease key `restart()` claims so concurrent restarts of one run publish once. */
export function restartLeaseKey(runId: string): string {
  return `${runId}::restart`;
}

/** The claim a same-key follow-up event carries so its receiver can take the lease over. */
export interface StepLeaseHandoff {
  key: string;
  generation: number;
}

/** A step occurrence lease held by this worker, renewed until it is released or handed off. */
export interface StepLease {
  /**
   * Stops renewing and returns the claim to attach to the follow-up event.
   * Release becomes a no-op: the receiver takes the lease over instead.
   */
  handOff(): StepLeaseHandoff | undefined;
  /** Stops renewing and releases the lease unless it was handed off or superseded. */
  release(): Promise<void>;
}

/** Lease for steps that run without one (no run fencing, or the workflow opted out of recovery). */
export const UNLEASED_STEP: StepLease = { handOff: () => undefined, release: async () => {} };

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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
 * Claims the lease of one step occurrence for this worker. Resolves to
 * `undefined` when the delivery must be acknowledged without running the step.
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
 * occurrence, such as a resume of the step the holder suspended.
 */
export async function acquireStepLease({
  store,
  key,
  handoff,
  claimAfterRelease,
  logger,
}: {
  store: WorkflowsStorage;
  key: string;
  handoff?: StepLeaseHandoff;
  claimAfterRelease: boolean;
  logger?: IMastraLogger;
}): Promise<StepLease | undefined> {
  const ownerId = globalThis.crypto.randomUUID();
  const claim = (options: { force: boolean; expectedGeneration?: number }) =>
    store.claimRunOwnership({ runId: key, ownerId, leaseMs: WORKFLOW_RUN_LEASE_TTL_MS, ...options });

  if (handoff?.key === key) {
    const adopted = await claim({ force: true, expectedGeneration: handoff.generation });
    if (adopted.acquired) return holdStepLease({ store, record: adopted.record, logger });
    // An expired lease means the worker that adopted it crashed: claim it below like any redelivery.
    if (adopted.record && (adopted.record.live || !adopted.record.leaseExpiresAt)) return undefined;
  }

  let result: ClaimRunOwnershipResult = await claim({ force: false });
  if (!result.acquired) {
    logger?.debug('Waiting for another worker to finish or abandon a workflow step', {
      key,
      owner: result.record?.ownerId,
      leaseExpiresAt: result.record?.leaseExpiresAt,
    });
  }
  while (!result.acquired) {
    await sleep(holdDelay(result.record));
    const current = await store.getRunOwnership({ runId: key });
    if (current && !current.leaseExpiresAt && !claimAfterRelease) return undefined;
    // Racing waiters that read the same record resolve to one winner.
    result = await claim({ force: false, expectedGeneration: current?.generation ?? 0 });
  }
  return holdStepLease({ store, record: result.record, logger });
}

/** Starts renewing an acquired step lease and returns its handle. */
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
  let settled = false;
  return {
    handOff() {
      stopRenewing();
      settled = true;
      return { key: fence.runId, generation: fence.generation };
    },
    async release() {
      stopRenewing();
      if (settled) return;
      settled = true;
      try {
        await store.releaseRunOwnership(fence);
      } catch (error) {
        logger?.warn('Failed to release workflow step lease', { key: fence.runId, error });
      }
    },
  };
}

/**
 * Claims the short `restart()` lease of an evented run, so that of several
 * concurrent restarts only one publishes. The lease is never renewed or
 * released: the restarted steps take their own leases on the workers, and
 * the lease only has to outlast the publish.
 */
export async function claimEventedRestart({
  store,
  runId,
}: {
  store: WorkflowsStorage | undefined;
  runId: string;
}): Promise<WorkflowRunOwnership | { owner: RunOwnershipRecord | null }> {
  const unfenced: WorkflowRunOwnership = { release: async () => {} };
  if (!store || !(await store.supportsRunFencing())) return unfenced;
  const claim = await store.claimRunOwnership({
    runId: restartLeaseKey(runId),
    ownerId: globalThis.crypto.randomUUID(),
    leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
    force: false,
  });
  return claim.acquired ? unfenced : { owner: claim.record };
}
