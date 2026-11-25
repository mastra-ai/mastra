import { currentRunFenceScope, runInRunFenceScope } from '../agent/durable/run-fence-scope';
import { AGENT_LEASE_RENEW_INTERVAL_MS, AGENT_LEASE_TTL_MS } from '../agent/run-ownership';
import type { IMastraLogger } from '../logger';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import { currentRunGeneration, matchesRunFence, RUN_FENCE_CONFLICT_ERROR_ID } from '../storage/run-fencing';
import type { RunFence, RunFenceScope, RunOwnershipRecord } from '../storage/run-fencing';

export const WORKFLOW_RUN_LEASE_TTL_MS = AGENT_LEASE_TTL_MS;
export const WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS = AGENT_LEASE_RENEW_INTERVAL_MS;

/**
 * How many times a run's lease can double past its base length, one doubling per restart over a
 * lease that lapsed. Caps how much later a worker that really died is recovered.
 */
export const WORKFLOW_RUN_LEASE_MAX_DOUBLINGS = 3;

// The longest delay `setTimeout` honours.
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;
// The longest lease: renewed every third of it, it fits a timer delay.
const MAX_LEASE_MS = 3 * MAX_TIMER_DELAY_MS;
/** The longest `leaseTtlMs`, so that even after every doubling the lease stays within {@link MAX_LEASE_MS}. */
export const MAX_WORKFLOW_RUN_LEASE_TTL_MS = Math.floor(MAX_LEASE_MS / 2 ** WORKFLOW_RUN_LEASE_MAX_DOUBLINGS);
/**
 * The shortest `leaseTtlMs`. A run renews every third of its lease with one storage write, and
 * `createRun()` options can come from a request body, so a tiny value must not set that rate.
 */
export const MIN_WORKFLOW_RUN_LEASE_TTL_MS = 1_000;

/**
 * `leaseTtlMs` as configured, rounded up to whole milliseconds and kept between
 * {@link MIN_WORKFLOW_RUN_LEASE_TTL_MS} and {@link MAX_WORKFLOW_RUN_LEASE_TTL_MS}, or `fallback`
 * when it is not a positive finite number. `fallback` is used as is, so the default lease from
 * `MASTRA_AGENT_THREAD_LEASE_TTL_MS` can be shorter than the minimum.
 */
export function normalizeLeaseTtlMs(leaseTtlMs: unknown, fallback: number): number {
  if (typeof leaseTtlMs !== 'number' || !Number.isFinite(leaseTtlMs) || leaseTtlMs <= 0) {
    return fallback;
  }

  return Math.min(Math.max(Math.ceil(leaseTtlMs), MIN_WORKFLOW_RUN_LEASE_TTL_MS), MAX_WORKFLOW_RUN_LEASE_TTL_MS);
}

/** How often a lease of `leaseMs` is renewed: a third of it, or the configured interval for the default lease. */
function renewIntervalFor(leaseMs: number): number {
  if (leaseMs === WORKFLOW_RUN_LEASE_TTL_MS) return WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS;
  return Math.min(Math.max(1, Math.floor(leaseMs / 3)), MAX_TIMER_DELAY_MS);
}

/**
 * The lease a restart claims a run with. After a lease that lapsed without being released, its
 * last owner stopped renewing (it crashed, or blocked its event loop past the lease), so the
 * restart doubles that lease to give a step that blocks the same way room to finish. The previous
 * length is the owners row's `leaseExpiresAt - updatedAt`, which stores write in one statement.
 * Stores that read their clock twice there can come out a few milliseconds short; the result
 * never drops below `baseMs` or the previous length, so that only trims the doubling.
 */
export function leaseAfterTakeover(
  baseMs: number,
  previous: RunOwnershipRecord | null,
): { leaseMs: number; previousLeaseMs?: number } {
  if (!previous?.leaseExpiresAt || previous.live || !previous.updatedAt) return { leaseMs: baseMs };
  const previousLeaseMs = previous.leaseExpiresAt.getTime() - previous.updatedAt.getTime();
  if (!(previousLeaseMs > 0)) return { leaseMs: baseMs };
  const capMs = baseMs * 2 ** WORKFLOW_RUN_LEASE_MAX_DOUBLINGS;
  const leaseMs = Math.max(baseMs, previousLeaseMs, Math.min(previousLeaseMs * 2, capMs));
  return { leaseMs: Math.min(leaseMs, MAX_LEASE_MS), previousLeaseMs };
}

// When the last stall warning was logged. Every run a stall delayed last renewed before that
// warning, so one stall logs once per process; a later stall follows a renewal made after it.
let lastStallWarningAt = -Infinity;

export interface WorkflowRunOwnership {
  release(): Promise<void>;
  /**
   * Runs `fn` with every workflows save it makes to `runId` (the claimed run, or a nested run the
   * claim covers from then on) carrying this claim, so storage refuses it once another execution
   * claimed the run.
   */
  run<T>(runId: string, fn: () => T): T;
}

/** The handle of a run that holds no claim: saves stay unfenced and nothing is released. */
export const UNCLAIMED_WORKFLOW_RUN: WorkflowRunOwnership = { release: async () => {}, run: (_runId, fn) => fn() };

/**
 * Runs `tick` `intervalMs` after it starts, then again `intervalMs` after
 * each run of it settles, until the returned function is called. A tick that
 * is running when the chain is stopped finishes, and nothing runs after it.
 * Every tick runs in the async context this function was called in, and the
 * timer is unref'd. `tick` reports its own failures and must not reject.
 *
 * `intervalMs` can be a function, read before each wait, for a delay that
 * follows what the last tick saw. With `immediately`, the first tick runs at
 * once instead of after the first wait.
 */
export function repeatAfterSettled(
  tick: () => Promise<void>,
  intervalMs: number | (() => number),
  { immediately = false }: { immediately?: boolean } = {},
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const arm = () => {
    // `run` never rejects: `tick` handles its own errors.
    timer = setTimeout(() => void run(), typeof intervalMs === 'number' ? intervalMs : intervalMs());
    timer.unref?.();
  };

  const run = async () => {
    try {
      await tick();
    } finally {
      // Checked after the tick: stopping while a tick runs must keep it from re-arming.
      if (!stopped) {
        // A fixed delay reuses the timer. A changing delay, and runtimes whose timers are plain
        // numbers (Workers, browsers), need a new one, which inherits this callback's context: the
        // first timer's, or the caller's for an immediate first tick.
        const { refresh } = (timer ?? {}) as { refresh?: () => unknown };
        if (refresh && typeof intervalMs === 'number') {
          refresh.call(timer);
        } else {
          arm();
        }
      }
    }
  };

  if (immediately) {
    void run();
  } else {
    arm();
  }

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

/**
 * Renews the lease `fence` holds, `leaseMs` long, every third of it (every
 * {@link WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS} for the default lease) until
 * the returned function is called, counting each interval from the end of the
 * previous renewal. Stops by itself after the first renewal that finds the
 * claim superseded, reporting it through `onLost`.
 *
 * When a renewal, or the returned function, finds that a lease length passed
 * since the last renewal (or the claim, sent at `since`) that succeeded, the
 * lease may have lapsed meanwhile: that is reported through `onStall`, once
 * per stall in this process. Gaps after a failed renewal are left to `onError`.
 */
export function renewWorkflowLease({
  store,
  fence,
  leaseMs = WORKFLOW_RUN_LEASE_TTL_MS,
  since = Date.now(),
  onLost,
  onError,
  onStall,
}: {
  store: WorkflowsStorage;
  fence: RunFence;
  leaseMs?: number;
  since?: number;
  onLost: (owner: RunOwnershipRecord | null) => void;
  onError: (error: unknown) => void;
  onStall?: (sinceRenewalMs: number) => void;
}): () => void {
  const intervalMs = renewIntervalFor(leaseMs);
  // When the renewal that set the current lease was sent: the store counts the lease from there.
  let renewedAt = since;
  let inFlightSince: number | undefined;
  let failing = false;
  let lost = false;

  const checkStall = (sentAt: number) => {
    const now = Date.now();
    if (!onStall || failing || lost || now - sentAt < leaseMs || sentAt < lastStallWarningAt) return;
    lastStallWarningAt = now;
    onStall(now - sentAt);
  };

  // Not setInterval: it fires on schedule while the previous renewal is still pending, so a slow
  // store would get concurrent renewals piling up, and an older one could land after a newer one.
  // Waiting for each renewal stretches the gap to the interval plus one write, still well inside
  // the TTL (the interval defaults to a third of it).
  const stop = repeatAfterSettled(async () => {
    checkStall(renewedAt);
    const sentAt = (inFlightSince = Date.now());
    try {
      const result = await store.renewRunOwnership({ ...fence, leaseMs });
      failing = false;
      if (result.renewed) {
        renewedAt = sentAt;
        return;
      }

      // Another claim superseded this one; renewing again could only fail the same way.
      lost = true;
      stop();
      onLost(result.record);
    } catch (error) {
      // A failed write may be transient, so the next tick tries again.
      failing = true;
      onError(error);
    } finally {
      inFlightSince = undefined;
    }
  }, intervalMs);

  return () => {
    // A run that blocks and then settles releases before any late renewal could notice the gap.
    checkStall(inFlightSince ?? renewedAt);
    stop();
  };
}

/**
 * Marks this process as the live driver of a workflow run through the storage
 * run-ownership lease (the one durable agents use), renewing it while the run
 * executes. The lease tells the recovery sweep on other replicas that the run
 * is not orphaned, and saves made inside {@link WorkflowRunOwnership.run} carry
 * it, so a process that lost the run can't overwrite the new owner's saves.
 *
 * Returns the current owner record instead of a handle when `force` is off and
 * another execution holds a live lease. Stores without run fencing get a no-op
 * handle, keeping their previous behaviour.
 *
 * The lease is `leaseMs` long. With `backOff`, a claim over a lease that lapsed
 * takes a longer one (see {@link leaseAfterTakeover}).
 */
export async function claimWorkflowRunOwnership({
  store,
  runId,
  force,
  logger,
  leaseMs: baseLeaseMs = WORKFLOW_RUN_LEASE_TTL_MS,
  backOff = false,
}: {
  store: WorkflowsStorage | undefined;
  runId: string;
  force: boolean;
  logger?: IMastraLogger;
  leaseMs?: number;
  backOff?: boolean;
}): Promise<WorkflowRunOwnership | { owner: RunOwnershipRecord | null }> {
  if (!store || !(await store.supportsRunFencing())) return UNCLAIMED_WORKFLOW_RUN;

  let previous: RunOwnershipRecord | null = null;
  if (backOff) {
    try {
      previous = await store.getRunOwnership({ runId });
    } catch (error) {
      // Only the lease length depends on this read, so the claim goes ahead with the base length.
      logger?.debug('Failed to read the previous workflow run ownership lease', { runId, error });
    }
  }
  const { leaseMs, previousLeaseMs } = leaseAfterTakeover(baseLeaseMs, previous);

  const claimedAt = Date.now();
  const claim = await store.claimRunOwnership({ runId, ownerId: crypto.randomUUID(), leaseMs, force });
  if (!claim.acquired) return { owner: claim.record };

  if (previous?.leaseExpiresAt && !previous.live) {
    logger?.warn(
      'Took over a workflow run whose previous owner stopped renewing its ownership lease: it crashed or blocked ' +
        'its event loop for longer than the lease. If a step blocks the event loop, move that work off it or raise ' +
        'the workflow leaseTtlMs option.',
      { runId, previousLeaseMs, leaseMs },
    );
  }

  const fence: RunFence = { runId, generation: claim.record.generation, ownerId: claim.record.ownerId };
  const stopRenewing = renewWorkflowLease({
    store,
    fence,
    leaseMs,
    since: claimedAt,
    onStall: sinceRenewalMs =>
      logger?.warn(
        `This process went ${sinceRenewalMs} ms without renewing the ${leaseMs} ms ownership lease of a workflow ` +
          'run, so other processes may take over the runs it drives. Its event loop was most likely blocked: move ' +
          'blocking work off the event loop, or raise the workflow leaseTtlMs option.',
        { runId, sinceRenewalMs, leaseMs },
      ),
    onLost: owner => {
      // A renewal in flight when the claim was released finds that release.
      if (matchesRunFence(owner, fence) && owner?.leaseExpiresAt === null) return;
      logger?.warn('Lost the ownership lease of a running workflow run; another process may now recover it', {
        runId,
        owner: owner?.ownerId,
      });
    },
    onError: error => logger?.warn('Failed to renew workflow run ownership lease', { runId, error }),
  });

  const claimState: WorkflowRunClaim = { store, fence, logger, nestedRunIds: new Set(), refused: false };
  return {
    release: async () => {
      stopRenewing();
      try {
        await store.releaseRunOwnership(fence);
      } catch (error) {
        logger?.warn('Failed to release workflow run ownership lease', { runId, error });
      }
    },
    run: (target, fn) => {
      if (target !== runId) claimState.nestedRunIds.add(target);
      return runInRunFenceScope(new WorkflowRunClaimScope(claimState, currentRunFenceScope()), fn);
    },
  };
}

interface WorkflowRunClaim {
  store: WorkflowsStorage;
  fence: RunFence;
  logger?: IMastraLogger;
  nestedRunIds: Set<string>;
  /** Set once storage refused a save of this claim, so the loss is logged once. */
  refused: boolean;
}

/**
 * The fence scope of a workflow run claim. Saves to the claimed run and the nested runs it covers
 * carry the claim; everything else (other runs, memory) goes to the scope it was installed in,
 * such as a durable agent running the workflow or an enclosing workflow run.
 */
class WorkflowRunClaimScope implements RunFenceScope {
  constructor(
    readonly claim: WorkflowRunClaim,
    readonly outer: RunFenceScope | undefined,
  ) {}

  covers(runId: string): boolean {
    return runId === this.claim.fence.runId || this.claim.nestedRunIds.has(runId);
  }

  fenceFor(store: object, runId?: string): RunFence | undefined {
    if (runId === undefined || !this.covers(runId)) return this.outer?.fenceFor(store, runId);
    if (store !== this.claim.store) {
      // Still fenced: a fencing store that doesn't hold this claim refuses the save.
      this.claim.logger?.error('A workflow run saved to a different store than the one holding its lease', {
        runId,
      });
    }
    return this.claim.fence;
  }

  onConflict(fence: RunFence): void {
    if (!matchesRunFence(this.claim.fence, fence)) return this.outer?.onConflict?.(fence);
    if (this.claim.refused) return;
    this.claim.refused = true;
    this.claim.logger?.warn('Stopped driving a workflow run that another process took over; its saves are refused', {
      runId: fence.runId,
      generation: fence.generation,
    });
  }

  coverNestedRun(parentRunId: string, nestedRunId: string): void {
    if (this.covers(parentRunId)) this.claim.nestedRunIds.add(nestedRunId);
    else this.outer?.coverNestedRun?.(parentRunId, nestedRunId);
  }

  generationFor(runId: string): number | undefined {
    return this.covers(runId) ? this.claim.fence.generation : this.outer?.generationFor?.(runId);
  }
}

/** The fence of the `RunFenceConflictError` in `error` or its cause chain, if there is one. */
export function runFenceConflictOf(error: unknown): RunFence | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth++) {
    const { id, code, details } = current as { id?: unknown; code?: unknown; details?: Partial<RunFence> };
    const matches = id === RUN_FENCE_CONFLICT_ERROR_ID || code === RUN_FENCE_CONFLICT_ERROR_ID;
    if (matches && details?.runId !== undefined) return details as RunFence;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Whether storage refused `error`'s save because the claim the current fence scope holds was
 * replaced, so this execution lost its run. A conflict on another run (one a step started) is not.
 */
export function isOwnRunFenceConflict(error: unknown): boolean {
  const fence = runFenceConflictOf(error);
  return !!fence && currentRunGeneration(fence.runId) === fence.generation;
}

/**
 * Makes the saves of `nestedRunId` carry the claim of the workflow run execution this runs in, when
 * that claim covers `parentRunId`. Unlike `coverNestedRun`, it leaves a durable agent's fence alone.
 */
export function coverNestedWorkflowRun(parentRunId: string, nestedRunId: string): void {
  const scope = currentRunFenceScope();
  if (scope instanceof WorkflowRunClaimScope && scope.covers(parentRunId)) scope.claim.nestedRunIds.add(nestedRunId);
}
