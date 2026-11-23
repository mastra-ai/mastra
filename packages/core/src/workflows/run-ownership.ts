import { currentRunFenceScope, runInRunFenceScope } from '../agent/durable/run-fence-scope';
import { AGENT_LEASE_RENEW_INTERVAL_MS, AGENT_LEASE_TTL_MS } from '../agent/run-ownership';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { IMastraLogger } from '../logger';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import { matchesRunFence } from '../storage/run-fencing';
import type { RunFence, RunFenceScope, RunOwnershipRecord } from '../storage/run-fencing';

export const WORKFLOW_RUN_LEASE_TTL_MS = AGENT_LEASE_TTL_MS;
export const WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS = AGENT_LEASE_RENEW_INTERVAL_MS;

export const WORKFLOW_RUN_OWNERSHIP_LOST_ERROR_ID = 'WORKFLOW_RUN_OWNERSHIP_LOST';

/**
 * @internal Thrown inside an execution of a default-engine run once another execution claimed the
 * run: a write of this execution was refused by storage, or the lease could not be renewed. The
 * engine turns it into a `waiting` result, so it never reaches a caller; nothing catches it to retry.
 */
export class WorkflowRunOwnershipLostError extends MastraError {
  constructor(fence: RunFence, cause?: unknown) {
    super(
      {
        id: WORKFLOW_RUN_OWNERSHIP_LOST_ERROR_ID,
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.SYSTEM,
        text: `Stopped driving workflow run ${fence.runId}: another process took it over (claim generation ${fence.generation} is no longer current).`,
        details: { runId: fence.runId, generation: fence.generation, ownerId: fence.ownerId },
      },
      cause,
    );
    this.name = 'WorkflowRunOwnershipLostError';
  }
}

/** @internal Whether `error`, or anything in its cause chain, is a {@link WorkflowRunOwnershipLostError}. */
export function isWorkflowRunOwnershipLostError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth++) {
    if ((current as { id?: unknown }).id === WORKFLOW_RUN_OWNERSHIP_LOST_ERROR_ID) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export interface WorkflowRunOwnership {
  release(): Promise<void>;
  /**
   * Runs `fn` with this claim fencing every workflows write it makes to `runId`, which is the
   * claimed run or a nested run the claim covers. A no-op wrapper for stores without run fencing.
   */
  run<T>(runId: string, fn: () => T): T;
  /** Set once another execution took the run over. Always false for stores without run fencing. */
  readonly lost: boolean;
}

/** The handle for a run that takes no claim: writes stay as they are and nothing is released. */
export const UNCLAIMED_WORKFLOW_RUN: WorkflowRunOwnership = {
  release: async () => {},
  run: (_runId, fn) => fn(),
  lost: false,
};

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
 * Renews the lease `fence` holds every {@link WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS}
 * until the returned function is called, counting each interval from the end
 * of the previous renewal. Stops by itself after the first renewal that finds
 * the claim superseded, reporting it through `onLost`. `onRenewed` gets the
 * local time each successful renewal was sent at.
 */
export function renewWorkflowLease({
  store,
  fence,
  onLost,
  onError,
  onRenewed,
}: {
  store: WorkflowsStorage;
  fence: RunFence;
  onLost: (owner: RunOwnershipRecord | null) => void;
  onError: (error: unknown) => void;
  onRenewed?: (sentAt: number) => void;
}): () => void {
  // Not setInterval: it fires on schedule while the previous renewal is still pending, so a slow
  // store would get concurrent renewals piling up, and an older one could land after a newer one.
  // Waiting for each renewal stretches the gap to the interval plus one write, still well inside
  // the TTL (the interval defaults to a third of it).
  const stop = repeatAfterSettled(async () => {
    try {
      const sentAt = Date.now();
      const result = await store.renewRunOwnership({ ...fence, leaseMs: WORKFLOW_RUN_LEASE_TTL_MS });
      if (result.renewed) {
        onRenewed?.(sentAt);
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
 * executes. Writes made inside {@link WorkflowRunOwnership.run} carry the
 * claim, so storage refuses them once another execution claimed the run, and
 * the execution then stops (see {@link WorkflowRunClaim}).
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
  if (!store || !(await store.supportsRunFencing())) return UNCLAIMED_WORKFLOW_RUN;

  const sentAt = Date.now();
  const claim = await store.claimRunOwnership({
    runId,
    ownerId: crypto.randomUUID(),
    leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
    force,
  });
  if (!claim.acquired) return { owner: claim.record };

  return new WorkflowRunClaim({
    store,
    fence: { runId, generation: claim.record.generation, ownerId: claim.record.ownerId },
    leaseConfirmedAt: sentAt,
    logger,
  });
}

/** Whether a failed renewal found this claim released (by its holder), rather than replaced. */
function isOwnRelease(record: RunOwnershipRecord | null, fence: RunFence): boolean {
  return !!record && matchesRunFence(record, fence) && record.leaseExpiresAt === null;
}

/**
 * A default-engine execution's claim on its run, and the fence scope its writes carry.
 *
 * The execution counts as lost once storage refuses one of its writes (even one the writer
 * swallowed), or a renewal finds that another claim replaced it. From then on it writes nothing:
 * {@link throwIfLost} and {@link ensureOwned} throw {@link WorkflowRunOwnershipLostError}, which
 * the engine turns into a `waiting` result. Nothing is aborted, so no abort listener (a nested
 * run's `cancel()`, a background task) acts on a run the new owner is driving. A step body that
 * is already running finishes; its result write is refused.
 */
export class WorkflowRunClaim implements WorkflowRunOwnership {
  readonly runId: string;
  readonly fence: RunFence;
  readonly #store: WorkflowsStorage;
  readonly #logger?: IMastraLogger;
  readonly #nestedRunIds = new Set<string>();
  readonly #stopRenewing: () => void;
  #lost = false;
  #released = false;
  #leaseConfirmedAt: number;
  #warnedStoreMismatch = false;
  /** Storage confirmed the claim (an accepted write, or a renewal) since the last step body started. */
  #confirmedSinceStepBody = true;
  #inlineRenewal?: Promise<void>;

  constructor({
    store,
    fence,
    leaseConfirmedAt,
    logger,
  }: {
    store: WorkflowsStorage;
    fence: RunFence;
    leaseConfirmedAt: number;
    logger?: IMastraLogger;
  }) {
    this.runId = fence.runId;
    this.fence = fence;
    this.#store = store;
    this.#logger = logger;
    this.#leaseConfirmedAt = leaseConfirmedAt;
    this.#stopRenewing = renewWorkflowLease({
      store,
      fence,
      onLost: owner => {
        // A tick in flight when the claim was released finds the claim's own release.
        if (isOwnRelease(owner, fence)) return;
        this.markLost(owner);
      },
      onError: error => logger?.warn('Failed to renew workflow run ownership lease', { runId: fence.runId, error }),
      onRenewed: renewedAt => {
        this.#leaseConfirmedAt = Math.max(this.#leaseConfirmedAt, renewedAt);
        this.#confirmedSinceStepBody = true;
      },
    });
  }

  get lost(): boolean {
    return this.#lost;
  }

  /** Whether writes to `runId` carry this claim: the claimed run, or a nested run it covers. */
  covers(runId: string): boolean {
    return runId === this.runId || this.#nestedRunIds.has(runId);
  }

  run<T>(runId: string, fn: () => T): T {
    const outer = currentRunFenceScope();
    if (runId !== this.runId) {
      this.#nestedRunIds.add(runId);
    }
    return runInRunFenceScope(new WorkflowRunClaimScope(this, outer), fn);
  }

  async release(): Promise<void> {
    this.#released = true;
    this.#stopRenewing();
    try {
      await this.#store.releaseRunOwnership(this.fence);
    } catch (error) {
      this.#logger?.warn('Failed to release workflow run ownership lease', { runId: this.runId, error });
    }
  }

  /** Stop driving the run. Logs once, unless the claim was already released. */
  markLost(current?: RunOwnershipRecord | null): void {
    if (this.#lost) return;
    this.#lost = true;
    this.#stopRenewing();
    if (this.#released) return;
    this.#logger?.warn('Stopped driving a workflow run that another process took over', {
      runId: this.runId,
      generation: this.fence.generation,
      ownerId: this.fence.ownerId,
      ...(current ? { currentGeneration: current.generation, currentOwnerId: current.ownerId } : {}),
    });
  }

  lostError(cause?: unknown): WorkflowRunOwnershipLostError {
    return new WorkflowRunOwnershipLostError(this.fence, cause);
  }

  throwIfLost(): void {
    if (this.#lost) throw this.lostError();
  }

  /**
   * Before a step body: throws when the run is lost, and renews inline when the lease may have
   * lapsed since the last confirmed renewal (a frozen event loop, a renewal stuck on a slow store),
   * so the body never starts on a claim another process may have replaced. A failed renewal is
   * retried rather than taken as a loss, so a storage blip delays the body instead of ending the run.
   *
   * With `renew`, renews once even while the lease looks fresh: a forced takeover (a second
   * `start()` elsewhere) replaces the claim without waiting for the lease to lapse. A failed
   * renewal then only blocks the body once the lease may have lapsed.
   */
  async ensureOwned({ renew = false }: { renew?: boolean } = {}): Promise<void> {
    this.throwIfLost();
    let renewNow = renew;
    while (renewNow || this.#leaseMayHaveLapsed()) {
      renewNow = false;
      const sentAt = Date.now();
      try {
        const result = await this.#store.renewRunOwnership({ ...this.fence, leaseMs: WORKFLOW_RUN_LEASE_TTL_MS });
        if (result.renewed) {
          this.#leaseConfirmedAt = Math.max(this.#leaseConfirmedAt, sentAt);
          this.#confirmedSinceStepBody = true;
          break;
        }
        if (isOwnRelease(result.record, this.fence)) break;
        this.markLost(result.record);
      } catch (error) {
        this.#logger?.warn('Failed to renew workflow run ownership lease before a step', { runId: this.runId, error });
        if (!this.#leaseMayHaveLapsed()) break;
        await new Promise(resolve => setTimeout(resolve, WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS));
      }
      this.throwIfLost();
    }
    this.throwIfLost();
  }

  /**
   * Before a step starts. A forced takeover leaves the local lease looking fresh, so unless storage
   * confirmed the claim since the previous step body started (its result write, or a renewal), this
   * asks storage once. With writes at every step (the default) that confirmation is always there; a
   * run whose `shouldPersistSnapshot` skips them, and foreach items, pay one renewal, shared by
   * steps that start together.
   */
  async ensureOwnedBeforeStep(): Promise<void> {
    if (this.#confirmedSinceStepBody) return this.ensureOwned();
    this.#inlineRenewal ??= this.ensureOwned({ renew: true }).finally(() => {
      this.#inlineRenewal = undefined;
    });
    await this.#inlineRenewal;
    this.throwIfLost();
  }

  /** A step body is about to run: confirmations before this point don't cover what it does. */
  stepBodyStarting(): void {
    this.#confirmedSinceStepBody = false;
  }

  /** Storage accepted a write carrying this claim. */
  noteWriteAccepted(): void {
    if (!this.#lost) this.#confirmedSinceStepBody = true;
  }

  #leaseMayHaveLapsed(): boolean {
    return Date.now() >= this.#leaseConfirmedAt + WORKFLOW_RUN_LEASE_TTL_MS - WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS;
  }

  /** @internal */
  fenceForWrite(store: object): RunFence {
    if (store !== this.#store && !this.#warnedStoreMismatch) {
      // The claim and the run's writes resolve the same store, so this is a misconfiguration. The
      // write still carries the claim: a fencing store without this run's owner row refuses it.
      this.#warnedStoreMismatch = true;
      this.#logger?.error('A workflow run wrote to a different store than the one holding its ownership claim', {
        runId: this.runId,
      });
    }
    return this.fence;
  }

  /** @internal */
  coverNestedRun(parentRunId: string, nestedRunId: string): boolean {
    if (!this.covers(parentRunId)) return false;
    this.#nestedRunIds.add(nestedRunId);
    return true;
  }
}

/**
 * The fence scope a {@link WorkflowRunClaim} installs. Writes to runs the claim covers carry it;
 * everything else, memory writes included, goes to the scope it was installed in (a durable agent
 * running the workflow, or an enclosing workflow run).
 */
class WorkflowRunClaimScope implements RunFenceScope {
  constructor(
    readonly claim: WorkflowRunClaim,
    readonly outer: RunFenceScope | undefined,
  ) {}

  fenceFor(store: object, runId?: string): RunFence | undefined {
    if (runId !== undefined && this.claim.covers(runId)) return this.claim.fenceForWrite(store);
    return this.outer?.fenceFor(store, runId);
  }

  onConflict(fence: RunFence): void {
    if (matchesRunFence(this.claim.fence, fence)) this.claim.markLost();
    else this.outer?.onConflict?.(fence);
  }

  coverNestedRun(parentRunId: string, nestedRunId: string): void {
    if (!this.claim.coverNestedRun(parentRunId, nestedRunId)) this.outer?.coverNestedRun?.(parentRunId, nestedRunId);
  }

  generationFor(runId: string): number | undefined {
    return this.claim.covers(runId) ? this.claim.fence.generation : this.outer?.generationFor?.(runId);
  }
}

/**
 * @internal The claim of the default-engine execution the caller runs in when it covers `runId`,
 * looking through enclosing workflow claims. Undefined outside such an execution, on stores without
 * run fencing, and on engines that don't claim (Inngest, evented).
 */
export function currentWorkflowRunClaim(runId: string): WorkflowRunClaim | undefined {
  let scope = currentRunFenceScope();
  while (scope instanceof WorkflowRunClaimScope) {
    if (scope.claim.covers(runId)) return scope.claim;
    scope = scope.outer;
  }
  return undefined;
}
