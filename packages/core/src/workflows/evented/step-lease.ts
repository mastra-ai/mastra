import type { IMastraLogger } from '../../logger';
import type { WorkflowsStorage } from '../../storage/domains/workflows/base';
import type { ClaimRunOwnershipResult, RunFence, RunOwnershipRecord } from '../../storage/run-fencing';
import { WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS, WORKFLOW_RUN_LEASE_TTL_MS, renewWorkflowLease } from '../run-ownership';
import type { WorkflowRunOwnership } from '../run-ownership';
import type { WorkflowRunState } from '../types';

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

/**
 * Lease key that stays live while any worker runs a step of the run, and for
 * one lease TTL after the last one stopped. `restart()` reads it to tell a run
 * in progress from an orphaned one, including the gap between one step's
 * release and the next step's claim.
 */
export function runLivenessKey(runId: string): string {
  return `${runId}::live`;
}

/** The process a step runs in, as seen by the liveness bookkeeping. */
export interface LivenessScope {
  /** True once the process started shutting down; it stops renewing liveness then. */
  readonly __shuttingDown: boolean;
}

// Liveness writes one renewal tick sends at once, so a process driving many runs does not flood the store.
const LIVENESS_RENEW_CONCURRENCY = 8;

/**
 * Keeps the liveness key of every run with a leaf step running in one process
 * fresh, writing each key about once per renew interval however many of the
 * run's steps the process runs. A single unref'd timer renews all of them.
 */
class ProcessRunLiveness {
  readonly #ownerId = globalThis.crypto.randomUUID();
  /** Leaf steps running in this process, per run. */
  readonly #active = new Map<string, number>();
  /**
   * When each run's last successful write started; the key holds a full TTL
   * from about then. Outlives the run's last leaf until the next renewal tick,
   * so the quick steps that follow it do not write again.
   */
  readonly #lastWriteAt = new Map<string, number>();
  readonly #writing = new Map<string, Promise<void>>();
  #timer?: ReturnType<typeof setInterval>;

  constructor(
    readonly scope: LivenessScope,
    readonly store: WorkflowsStorage,
    readonly logger?: IMastraLogger,
  ) {}

  /**
   * Counts a leaf step of `runId` as running here. Resolves once the run's
   * liveness key is fresh, writing it unless this process wrote it within a
   * renew interval, to the function that counts the leaf out again.
   */
  async enter(runId: string): Promise<() => void> {
    this.#active.set(runId, (this.#active.get(runId) ?? 0) + 1);
    if (!this.#timer) {
      this.#timer = setInterval(() => void this.#renew(), WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS);
      this.#timer.unref?.();
    }
    let left = false;
    const leave = () => {
      if (left) return;
      left = true;
      const remaining = (this.#active.get(runId) ?? 1) - 1;
      if (remaining > 0) this.#active.set(runId, remaining);
      else this.#active.delete(runId);
      if (this.#active.size === 0) this.#stopTimer();
    };
    try {
      if (this.#age(runId) >= WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS) await this.#write(runId);
    } catch (error) {
      leave();
      throw error;
    }
    return leave;
  }

  #age(runId: string): number {
    return Date.now() - (this.#lastWriteAt.get(runId) ?? -Infinity);
  }

  #stopTimer() {
    clearInterval(this.#timer);
    this.#timer = undefined;
  }

  /**
   * Marks the run live for one more lease TTL. Every process force-claims the
   * key and nobody releases it, so its generation only orders the writes: no
   * write is fenced on it and losing it to another process's write changes
   * nothing. A failed write leaves the last write time alone, so the next
   * leaf start or tick tries again.
   */
  #write(runId: string): Promise<void> {
    const inFlight = this.#writing.get(runId);
    if (inFlight) return inFlight;
    const startedAt = Date.now();
    const write = this.store
      .claimRunOwnership({
        runId: runLivenessKey(runId),
        ownerId: this.#ownerId,
        leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
        force: true,
      })
      .then(() => void this.#lastWriteAt.set(runId, startedAt))
      .finally(() => this.#writing.delete(runId));
    this.#writing.set(runId, write);
    return write;
  }

  /** One renewal tick: rewrites every active run's key that is half a renew interval old or more. */
  async #renew() {
    // A process shutting down stops vouching for its runs, so they can be recovered once the keys lapse.
    if (this.scope.__shuttingDown) {
      this.#stopTimer();
      this.#active.clear();
      this.#lastWriteAt.clear();
      return;
    }
    for (const runId of this.#lastWriteAt.keys()) {
      if (!this.#active.has(runId) && this.#age(runId) >= WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS) {
        this.#lastWriteAt.delete(runId);
      }
    }
    const due = [...this.#active.keys()].filter(runId => this.#age(runId) >= WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS / 2);
    const renewNext = async (): Promise<void> => {
      const runId = due.shift();
      if (runId === undefined) return;
      await this.#write(runId).catch(error =>
        this.logger?.warn('Failed to mark a workflow run live', { runId, error }),
      );
      return renewNext();
    };
    await Promise.all(Array.from({ length: Math.min(LIVENESS_RENEW_CONCURRENCY, due.length) }, renewNext));
  }
}

/**
 * Liveness bookkeeping per Mastra instance, which stands for one process: it
 * sees every leaf the process runs, whether the in-process push subscription
 * or an orchestration worker delivered it, while each of those has its own
 * event processor.
 */
const livenessByProcess = new WeakMap<LivenessScope, ProcessRunLiveness>();

/** Counts a leaf step of `runId` toward the liveness the process `scope` keeps fresh. See {@link ProcessRunLiveness.enter}. */
function trackRunLiveness({
  scope,
  store,
  runId,
  logger,
}: {
  scope: LivenessScope;
  store: WorkflowsStorage;
  runId: string;
  logger?: IMastraLogger;
}): Promise<() => void> {
  let liveness = livenessByProcess.get(scope);
  if (!liveness) livenessByProcess.set(scope, (liveness = new ProcessRunLiveness(scope, store, logger)));
  return liveness.enter(runId);
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
 *
 * While the lease is held the step counts toward the run's liveness key (see
 * {@link runLivenessKey}), which `scope`, the process running the step, keeps
 * fresh.
 */
export async function acquireStepLease({
  scope,
  store,
  runId,
  key,
  handoff,
  claimAfterRelease,
  logger,
}: {
  scope: LivenessScope;
  store: WorkflowsStorage;
  runId: string;
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
    if (adopted.acquired) return holdStepLease({ scope, store, runId, record: adopted.record, logger });
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
  return holdStepLease({ scope, store, runId, record: result.record, logger });
}

/**
 * Counts the step toward the run's liveness, then renews the acquired step
 * lease and returns its handle. The step stops counting when the handle is
 * released, even after a hand-off: the handler that holds it ran until then.
 */
async function holdStepLease({
  scope,
  store,
  runId,
  record,
  logger,
}: {
  scope: LivenessScope;
  store: WorkflowsStorage;
  runId: string;
  record: RunOwnershipRecord;
  logger?: IMastraLogger;
}): Promise<StepLease> {
  const fence: RunFence = { runId: record.runId, generation: record.generation, ownerId: record.ownerId };
  let leaveRun: () => void;
  try {
    leaveRun = await trackRunLiveness({ scope, store, runId, logger });
  } catch (error) {
    // The delivery fails and is redelivered; a kept lease would make that redelivery wait a full TTL.
    await store.releaseRunOwnership(fence).catch(() => {});
    throw error;
  }
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
      leaveRun();
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

// Nested workflows nest a few levels at most; the bound only stops a corrupt snapshot from looping.
const MAX_NESTED_RUN_DEPTH = 16;

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
    const record = await store.getRunOwnership({ runId: runLivenessKey(runId) });
    if (record?.live && (!earliest || record.leaseExpiresAt! < earliest.leaseExpiresAt!)) earliest = record;
    if (depth >= MAX_NESTED_RUN_DEPTH) return;
    for (const [stepId, result] of Object.entries(context ?? {})) {
      if (result?.status !== 'running') continue;
      const metadata = result.metadata as
        | { nestedRunId?: string; foreachNestedRunIds?: Record<string, string> }
        | undefined;
      const nestedRunIds = new Set([metadata?.nestedRunId, ...Object.values(metadata?.foreachNestedRunIds ?? {})]);
      for (const nestedRunId of nestedRunIds) {
        if (!nestedRunId) continue;
        const nested = await store.loadWorkflowSnapshot({ workflowName: stepId, runId: nestedRunId });
        await visit(nestedRunId, nested?.context, depth + 1);
      }
    }
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
  if (!store || !(await store.supportsRunFencing())) return unfenced;
  const live = await findLiveRun(store, runId, snapshot.context);
  if (live) return { owner: live };
  const claim = await store.claimRunOwnership({
    runId: restartLeaseKey(runId),
    ownerId: globalThis.crypto.randomUUID(),
    leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
    force: false,
  });
  return claim.acquired ? unfenced : { owner: claim.record };
}
