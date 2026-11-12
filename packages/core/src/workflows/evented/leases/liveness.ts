/**
 * Per-process liveness of evented runs: the `::live` key a process keeps fresh
 * while it handles any event of a run or of a run nested under it. Separate
 * from step leases because one key covers all of that work.
 */
import type { IMastraLogger } from '../../../logger';
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import { runOutsideRunFenceScope } from '../../../storage/run-fencing';
import type { RunFence } from '../../../storage/run-fencing';
import {
  WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS,
  WORKFLOW_RUN_LEASE_TTL_MS,
  repeatAfterSettled,
} from '../../run-ownership';
import { forEachBounded } from './bounded';
import { runLivenessKey } from './keys';

/** The process a step runs in, as seen by the liveness bookkeeping. */
export interface LivenessScope {
  /** True once the process started shutting down; it stops waiting for other workers' leases then. */
  readonly __shuttingDown: boolean;
}

// Liveness writes one renewal tick sends at once, so a process driving many runs does not flood the store.
const LIVENESS_RENEW_CONCURRENCY = 8;
// A renew interval configured close to the TTL would leave no margin for a missed tick.
const LIVENESS_RENEW_INTERVAL_MS = Math.max(
  1,
  Math.min(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS, Math.floor(WORKFLOW_RUN_LEASE_TTL_MS / 3)),
);

/**
 * Keeps the liveness key of every run this process handles an event of fresh,
 * writing each key about once per renew interval however many of the run's
 * events the process handles. A single unref'd timer renews all of them.
 */
export class ProcessRunLiveness {
  readonly #ownerId = globalThis.crypto.randomUUID();
  /** Event handlers running in this process per run, and the store the run's handlers last used. */
  readonly #active = new Map<string, { count: number; store: WorkflowsStorage }>();
  /**
   * When each run's last successful write started; the key holds a full TTL
   * from about then. Kept for a renew interval after the run's last handler,
   * so the quick events that follow it do not write again.
   */
  readonly #lastWriteAt = new Map<string, number>();
  /** The claim of each run's last write, kept until it expires so {@link end} can expire it early. */
  readonly #claims = new Map<string, { store: WorkflowsStorage; fence: RunFence; expiresAt: number }>();
  readonly #writing = new Map<string, Promise<void>>();
  /** False once {@link end} ran: this process writes no liveness key after that. */
  #vouching = true;
  /** Stops the renewal timer; set while it runs. */
  #stopTimer?: () => void;

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

    if (this.#age(runId) >= LIVENESS_RENEW_INTERVAL_MS) {
      await this.#write(runId, store);
    }
  }

  /**
   * Counts an event handler of `runId` as running here and returns the
   * function that counts it out again. Writes the run's liveness key unless
   * this process wrote it within a renew interval.
   *
   * The handler waits only for this process's first write of the run, or for
   * a write already in flight. A handler that found the key fresh would
   * otherwise overtake one waiting on a later write, changing the order in
   * which concurrent steps (foreach items, parallel branches) start. Later
   * writes need no wait: the key is still live, and the step lease keeps a
   * second delivery of a step from running.
   */
  async enter(runId: string, store: WorkflowsStorage): Promise<() => void> {
    // Nothing is written once this process stopped vouching, so there is nothing to count.
    if (!this.#vouching) {
      return () => {};
    }

    const active = this.#active.get(runId);
    this.#active.set(runId, { count: (active?.count ?? 0) + 1, store });
    this.#ensureTimer();

    const inFlight = this.#writing.get(runId);
    if (inFlight) {
      // Another handler of this run is writing: wait so this one does not start ahead of it.
      await inFlight;
    } else if (!this.#lastWriteAt.has(runId)) {
      // This process never vouched for the run: the handler must not start before the key is written.
      await this.#write(runId, store);
    } else if (this.#age(runId) >= LIVENESS_RENEW_INTERVAL_MS) {
      // The key is still live from the last write, so the handler need not wait for this one.
      // `#write` logs its own failure and never rejects.
      void this.#write(runId, store);
    }

    let left = false;
    return () => {
      // Leaving twice must not count out another handler of the run.
      if (left) {
        return;
      }

      left = true;
      const current = this.#active.get(runId);
      if (current && current.count > 1) {
        current.count--;
      } else {
        this.#active.delete(runId);
      }
    };
  }

  /**
   * Stops vouching for this process's runs once its shutdown drained them, and
   * expires every liveness key it still holds. Until then the keys stay fresh,
   * so no instance restarts a run this process still drives. Expiring them,
   * instead of releasing them, dates the moment this process stopped, so
   * recovery can tell how long a run has been left alone.
   *
   * Each key is expired by its fence, so a key another process wrote since
   * stays live. Waits at most one renew interval, so a slow store cannot hold
   * up the rest of shutdown; a key not expired by then lapses one lease TTL
   * after its last write, as it would have without this. Runs once; later
   * calls do nothing.
   */
  async end(): Promise<void> {
    if (!this.#vouching) {
      return;
    }

    this.#vouching = false;
    this.#stopTimer?.();
    this.#stopTimer = undefined;
    this.#active.clear();
    this.#lastWriteAt.clear();

    // Never rejects: each expiry logs its own failure.
    const expiring = (async () => {
      // A write in flight lands after this, so its claim must be known before expiring.
      await Promise.allSettled([...this.#writing.values()]);

      const claims = [...this.#claims.values()].filter(claim => claim.expiresAt > Date.now());
      this.#claims.clear();
      await forEachBounded(claims, LIVENESS_RENEW_CONCURRENCY, async ({ store, fence }) => {
        try {
          await store.renewRunOwnership({ ...fence, leaseMs: 1 });
        } catch (error) {
          this.logger?.warn('Failed to expire the liveness of a workflow run during shutdown', {
            runId: fence.runId,
            error,
          });
        }
      });

      return false;
    })();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<boolean>(resolve => {
      timer = setTimeout(() => resolve(true), LIVENESS_RENEW_INTERVAL_MS);
      timer.unref?.();
    });

    try {
      if (await Promise.race([expiring, timedOut])) {
        this.logger?.warn('Stopped waiting for the liveness of workflow runs to expire during shutdown', {
          timeoutMs: LIVENESS_RENEW_INTERVAL_MS,
        });
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** Milliseconds since this process last wrote the run's liveness key; infinite when it never did. */
  #age(runId: string): number {
    return Date.now() - (this.#lastWriteAt.get(runId) ?? -Infinity);
  }

  /** Starts the renewal timer unless it runs or this process stopped vouching for its runs. */
  #ensureTimer() {
    if (this.#stopTimer || !this.#vouching) {
      return;
    }

    // Not setInterval: it fires on schedule while the previous tick's writes are still pending, so a
    // slow store would get a new round of writes on top of the old ones. The next tick starts one
    // interval after this one settles.
    // Created outside the triggering step's fence scope, which the timer would otherwise carry into every tick.
    this.#stopTimer = runOutsideRunFenceScope(() =>
      repeatAfterSettled(() => this.#renew(), LIVENESS_RENEW_INTERVAL_MS),
    );
  }

  /**
   * Marks the run live for one more lease TTL, or joins the write already in
   * flight for it. Every process force-claims the key, and only a process that
   * shut down expires it early, by its fence. Losing the key to another
   * process's write changes nothing: that process vouches for the run now.
   *
   * Never rejects: a failed write is logged here and leaves the last write
   * time alone, so the next handler or tick tries again. Skipped once the
   * process stopped vouching for its runs (see {@link end}).
   */
  #write(runId: string, store: WorkflowsStorage): Promise<void> {
    if (!this.#vouching) {
      return Promise.resolve();
    }

    const inFlight = this.#writing.get(runId);
    if (inFlight) {
      return inFlight;
    }

    const startedAt = Date.now();
    const write = (async () => {
      try {
        const { record } = await store.claimRunOwnership({
          runId: runLivenessKey(runId),
          ownerId: this.#ownerId,
          leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
          force: true,
        });
        this.#lastWriteAt.set(runId, startedAt);

        if (record) {
          const fence = { runId: record.runId, ownerId: record.ownerId, generation: record.generation };
          // Counted from when the write returned when the store reports no expiry: a slow write
          // still holds a full TTL from about then, which end() must not skip.
          const expiresAt = record.leaseExpiresAt?.getTime() ?? Date.now() + WORKFLOW_RUN_LEASE_TTL_MS;
          this.#claims.set(runId, { store, fence, expiresAt });
        }
      } catch (error) {
        this.logger?.warn('Failed to mark a workflow run live', { runId, error });
      } finally {
        this.#writing.delete(runId);
      }
    })();

    this.#writing.set(runId, write);
    return write;
  }

  /**
   * One renewal tick: forgets runs with no running handler whose last write is
   * a renew interval old and claims that expired, rewrites the key of every
   * active run that is half an interval old, and stops the timer once nothing
   * is left to track.
   */
  async #renew() {
    // A finished run's last write time is kept for one interval so its next quick event skips the write.
    for (const runId of this.#lastWriteAt.keys()) {
      const idle = !this.#active.has(runId);
      if (idle && this.#age(runId) >= LIVENESS_RENEW_INTERVAL_MS) {
        this.#lastWriteAt.delete(runId);
      }
    }

    // An expired claim leaves nothing for end() to expire.
    for (const [runId, claim] of this.#claims) {
      if (claim.expiresAt <= Date.now()) {
        this.#claims.delete(runId);
      }
    }

    // The timer keeps ticking while a claim is unexpired, which keeps pruning #claims.
    if (this.#active.size === 0 && this.#lastWriteAt.size === 0 && this.#claims.size === 0) {
      // `#ensureTimer` starts a new chain if a handler of any run starts later.
      this.#stopTimer?.();
      this.#stopTimer = undefined;
      return;
    }

    // Half an interval old is due: waiting a full interval could let the key lapse between ticks.
    const due = [...this.#active].filter(([runId]) => this.#age(runId) >= LIVENESS_RENEW_INTERVAL_MS / 2);
    await forEachBounded(due, LIVENESS_RENEW_CONCURRENCY, ([runId, { store }]) => this.#write(runId, store));
  }
}

/**
 * Liveness bookkeeping per Mastra instance, which stands for one process: it
 * sees every event the process handles, whether the in-process push
 * subscription or an orchestration worker delivered it, while each of those
 * has its own event processor.
 */
const livenessByProcess = new WeakMap<LivenessScope, ProcessRunLiveness>();

/** The liveness bookkeeping of the process `scope` stands for. */
export function processLiveness(scope: LivenessScope, logger?: IMastraLogger): ProcessRunLiveness {
  let liveness = livenessByProcess.get(scope);
  if (!liveness) {
    liveness = new ProcessRunLiveness(scope, logger);
    livenessByProcess.set(scope, liveness);
  }

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

/**
 * Counts an event handler of `runId` in the process `scope` stands for toward
 * the run's liveness, and returns the function that counts it out again. See
 * {@link ProcessRunLiveness.enter}.
 */
export function enterRunLiveness({
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
  return processLiveness(scope, logger).enter(runId, store);
}

/**
 * Stops the process `scope` stands for from vouching for its runs once its
 * shutdown drained them, and expires the liveness keys it holds. See
 * {@link ProcessRunLiveness.end}.
 */
export async function endRunLiveness(scope: LivenessScope): Promise<void> {
  await livenessByProcess.get(scope)?.end();
}
