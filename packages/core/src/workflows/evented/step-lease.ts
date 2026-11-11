import type { IMastraLogger } from '../../logger';
import type { WorkflowsStorage } from '../../storage/domains/workflows/base';
import { runOutsideRunFenceScope } from '../../storage/run-fencing';
import type { ClaimRunOwnershipResult, RunFence, RunOwnershipRecord } from '../../storage/run-fencing';
import { WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS, WORKFLOW_RUN_LEASE_TTL_MS, renewWorkflowLease } from '../run-ownership';
import type { WorkflowRunOwnership } from '../run-ownership';
import type { WorkflowRunState } from '../types';
import { isQueuedForeachIteration } from './workflow-event-processor/loop';

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
  /** True once the process started shutting down; it stops renewing liveness and waiting for leases then. */
  readonly __shuttingDown: boolean;
}

// Liveness writes one renewal tick sends at once, so a process driving many runs does not flood the store.
const LIVENESS_RENEW_CONCURRENCY = 8;
// Reads one restart check sends at once while it walks a run's nested runs.
const NESTED_RUN_READ_CONCURRENCY = 8;
// A renew interval configured close to the TTL would leave no margin for a missed tick.
const LIVENESS_RENEW_INTERVAL_MS = Math.max(
  1,
  Math.min(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS, Math.floor(WORKFLOW_RUN_LEASE_TTL_MS / 3)),
);

/** Runs `task` over `items`, at most `concurrency` at a time. */
async function forEachBounded<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const next = async (): Promise<void> => {
    const item = queue.shift();
    if (item === undefined) return;
    await task(item);
    return next();
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, next));
}

/**
 * Keeps the liveness key of every run with a leaf step running in one process
 * fresh, writing each key about once per renew interval however many of the
 * run's steps the process runs. A single unref'd timer renews all of them.
 */
class ProcessRunLiveness {
  readonly #ownerId = globalThis.crypto.randomUUID();
  /** Leaf steps running in this process per run, and the store the run's leaves last used. */
  readonly #active = new Map<string, { count: number; store: WorkflowsStorage }>();
  /**
   * When each run's last successful write started; the key holds a full TTL
   * from about then. Kept for a renew interval after the run's last leaf, so
   * the quick steps that follow it do not write again.
   */
  readonly #lastWriteAt = new Map<string, number>();
  readonly #writing = new Map<string, Promise<void>>();
  #timer?: ReturnType<typeof setInterval>;

  constructor(
    readonly scope: LivenessScope,
    readonly logger?: IMastraLogger,
  ) {}

  /**
   * Marks `runId` live and waits for the write, unless this process wrote it
   * within a renew interval. The run's first step event is published after
   * this, so a run is never `running` in storage without a live key.
   */
  async markLive(runId: string, store: WorkflowsStorage): Promise<void> {
    this.#ensureTimer();
    if (this.#age(runId) >= LIVENESS_RENEW_INTERVAL_MS) await this.#writeOrWarn(runId, store);
  }

  /**
   * Counts a leaf step of `runId` as running here and returns the function
   * that counts it out again. Writes the run's liveness key unless this
   * process wrote it within a renew interval.
   *
   * The leaf waits only for this process's first write of the run, or for a
   * write already in flight. A leaf that found the key fresh would otherwise
   * overtake one waiting on a later write, changing the order in which
   * concurrent steps (foreach items, parallel branches) start. Later writes
   * need no wait: the key is still live, and the step lease keeps a second
   * delivery of the step from running.
   */
  async enter(runId: string, store: WorkflowsStorage): Promise<() => void> {
    const active = this.#active.get(runId);
    this.#active.set(runId, { count: (active?.count ?? 0) + 1, store });
    this.#ensureTimer();
    const inFlight = this.#writing.get(runId);
    if (inFlight) await inFlight.catch(() => {});
    else if (!this.#lastWriteAt.has(runId)) await this.#writeOrWarn(runId, store);
    else if (this.#age(runId) >= LIVENESS_RENEW_INTERVAL_MS) void this.#writeOrWarn(runId, store);
    let left = false;
    return () => {
      if (left) return;
      left = true;
      const current = this.#active.get(runId);
      if (current && current.count > 1) current.count--;
      else this.#active.delete(runId);
    };
  }

  /** Writes the run's liveness key, logging instead of rejecting when the write fails. */
  #writeOrWarn(runId: string, store: WorkflowsStorage): Promise<void> {
    return this.#write(runId, store).catch(error =>
      this.logger?.warn('Failed to mark a workflow run live', { runId, error }),
    );
  }

  /** Milliseconds since this process last wrote the run's liveness key; infinite when it never did. */
  #age(runId: string): number {
    return Date.now() - (this.#lastWriteAt.get(runId) ?? -Infinity);
  }

  /** Starts the renewal timer unless it runs. */
  #ensureTimer() {
    if (this.#timer) return;
    // Created outside the triggering step's fence scope, which the timer would otherwise carry into every tick.
    this.#timer = runOutsideRunFenceScope(() => setInterval(() => void this.#renew(), LIVENESS_RENEW_INTERVAL_MS));
    this.#timer.unref?.();
  }

  /**
   * Marks the run live for one more lease TTL. Every process force-claims the
   * key and nobody releases it, so its generation only orders the writes: no
   * write is fenced on it and losing it to another process's write changes
   * nothing. A failed write leaves the last write time alone, so the next
   * leaf start or tick tries again.
   */
  #write(runId: string, store: WorkflowsStorage): Promise<void> {
    const inFlight = this.#writing.get(runId);
    if (inFlight) return inFlight;
    const startedAt = Date.now();
    const write = store
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

  /**
   * One renewal tick: forgets runs with no running leaf whose last write is a
   * renew interval old, rewrites the key of every active run that is half an
   * interval old, and stops the timer once nothing is left to track.
   */
  async #renew() {
    // A process shutting down stops vouching for its runs, so they can be recovered once the keys lapse.
    if (this.scope.__shuttingDown) {
      this.#active.clear();
      this.#lastWriteAt.clear();
    }
    for (const runId of this.#lastWriteAt.keys()) {
      if (!this.#active.has(runId) && this.#age(runId) >= LIVENESS_RENEW_INTERVAL_MS) this.#lastWriteAt.delete(runId);
    }
    if (this.#active.size === 0 && this.#lastWriteAt.size === 0) {
      clearInterval(this.#timer);
      this.#timer = undefined;
      return;
    }
    const due = [...this.#active].filter(([runId]) => this.#age(runId) >= LIVENESS_RENEW_INTERVAL_MS / 2);
    await forEachBounded(due, LIVENESS_RENEW_CONCURRENCY, ([runId, { store }]) => this.#writeOrWarn(runId, store));
  }
}

/**
 * Liveness bookkeeping per Mastra instance, which stands for one process: it
 * sees every leaf the process runs, whether the in-process push subscription
 * or an orchestration worker delivered it, while each of those has its own
 * event processor.
 */
const livenessByProcess = new WeakMap<LivenessScope, ProcessRunLiveness>();

/** The liveness bookkeeping of the process `scope` stands for. */
function processLiveness(scope: LivenessScope, logger?: IMastraLogger): ProcessRunLiveness {
  let liveness = livenessByProcess.get(scope);
  if (!liveness) livenessByProcess.set(scope, (liveness = new ProcessRunLiveness(scope, logger)));
  return liveness;
}

/**
 * Marks `runId` live before its first step event is published, so a booting
 * instance does not restart a run that is just starting. See
 * {@link ProcessRunLiveness.markLive}.
 */
export function markRunLive({
  scope,
  store,
  runId,
  logger,
}: {
  scope: LivenessScope;
  store: WorkflowsStorage;
  runId: string;
  logger?: IMastraLogger;
}): Promise<void> {
  return processLiveness(scope, logger).markLive(runId, store);
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
   * The lease stays this worker's until {@link StepLease.confirmHandOff}, so a
   * follow-up that is never published is released like any other lease.
   */
  handOff(): StepLeaseHandoff | undefined;
  /** The follow-up carrying the claim was published: release becomes a no-op. */
  confirmHandOff(): void;
  /** Stops renewing and releases the lease unless it was handed off or superseded. */
  release(): Promise<void>;
}

/** Lease for steps that run without one (no run fencing, or the workflow opted out of recovery). */
export const UNLEASED_STEP: StepLease = {
  handOff: () => undefined,
  confirmHandOff: () => {},
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
 * shutting down stops waiting and defers the delivery.
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
}): Promise<StepLeaseClaim> {
  const ownerId = globalThis.crypto.randomUUID();
  const claim = (options: { force: boolean; expectedGeneration?: number }) =>
    store.claimRunOwnership({ runId: key, ownerId, leaseMs: WORKFLOW_RUN_LEASE_TTL_MS, ...options });

  if (handoff && handoff.key !== key) {
    logger?.warn('Ignoring a workflow step lease hand-off made for another step occurrence', {
      key,
      handoffKey: handoff.key,
    });
  } else if (handoff) {
    const adopted = await claim({ force: true, expectedGeneration: handoff.generation });
    if (adopted.acquired) return holdStepLease({ scope, store, runId, record: adopted.record, logger });
    // An expired lease means the worker that adopted it crashed: claim it below like any redelivery.
    if (adopted.record && (adopted.record.live || !adopted.record.leaseExpiresAt)) return 'drop';
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
    if (scope.__shuttingDown) return 'defer';
    const current = await store.getRunOwnership({ runId: key });
    if (current && !current.leaseExpiresAt && !claimAfterRelease) return 'drop';
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
  const leaveRun = await processLiveness(scope, logger).enter(runId, store);
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
      stopRenewing();
      return { key: fence.runId, generation: fence.generation };
    },
    confirmHandOff() {
      handedOff = true;
    },
    async release() {
      stopRenewing();
      leaveRun();
      if (handedOff || released) return;
      released = true;
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
 * The nested runs a running step result still drives: its own nested run, or
 * the nested runs of the foreach items that have not finished.
 */
function runningNestedRunIds(result: { status?: unknown; metadata?: unknown; output?: unknown } | undefined): string[] {
  if (result?.status !== 'running') return [];
  const metadata = result.metadata as
    | { nestedRunId?: string; foreachNestedRunIds?: Record<string, string> }
    | undefined;
  const items = metadata?.foreachNestedRunIds;
  if (!items) return metadata?.nestedRunId ? [metadata.nestedRunId] : [];
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
    const record = await store.getRunOwnership({ runId: runLivenessKey(runId) });
    if (record?.live && (!earliest || record.leaseExpiresAt! < earliest.leaseExpiresAt!)) earliest = record;
    if (depth >= MAX_NESTED_RUN_DEPTH) return;
    const nested = Object.entries(context ?? {}).flatMap(([stepId, result]) =>
      runningNestedRunIds(result).map(nestedRunId => ({ stepId, nestedRunId })),
    );
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
