/**
 * Per-process liveness of evented runs: the `::live` key a process keeps fresh
 * while it runs any step of a run. Separate from step leases because one key
 * covers every step of a run that the process runs.
 */
import type { IMastraLogger } from '../../../logger';
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import { runOutsideRunFenceScope } from '../../../storage/run-fencing';
import {
  WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS,
  WORKFLOW_RUN_LEASE_TTL_MS,
  repeatAfterSettled,
} from '../../run-ownership';
import { forEachBounded } from './bounded';
import { runLivenessKey } from './keys';

/** The process a step runs in, as seen by the liveness bookkeeping. */
export interface LivenessScope {
  /** True once the process started shutting down; it stops renewing liveness and waiting for leases then. */
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
 * Keeps the liveness key of every run with a leaf step running in one process
 * fresh, writing each key about once per renew interval however many of the
 * run's steps the process runs. A single unref'd timer renews all of them.
 */
export class ProcessRunLiveness {
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
    if (inFlight) {
      // Another leaf of this run is writing: wait so this one does not start ahead of it.
      await inFlight;
    } else if (!this.#lastWriteAt.has(runId)) {
      // This process never vouched for the run: the step must not start before the key is written.
      await this.#write(runId, store);
    } else if (this.#age(runId) >= LIVENESS_RENEW_INTERVAL_MS) {
      // The key is still live from the last write, so the step need not wait for this one.
      // `#write` logs its own failure and never rejects.
      void this.#write(runId, store);
    }

    let left = false;
    return () => {
      // Leaving twice must not count out another leaf of the run.
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

  /** Milliseconds since this process last wrote the run's liveness key; infinite when it never did. */
  #age(runId: string): number {
    return Date.now() - (this.#lastWriteAt.get(runId) ?? -Infinity);
  }

  /** Starts the renewal timer unless it runs. */
  #ensureTimer() {
    if (this.#stopTimer) {
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
   * flight for it. Every process force-claims the key and nobody releases it,
   * so its generation only orders the writes: no write is fenced on it and
   * losing it to another process's write changes nothing.
   *
   * Never rejects: a failed write is logged here and leaves the last write
   * time alone, so the next leaf start or tick tries again. Skipped once the
   * process is shutting down: it stops vouching for its runs then, so they can
   * be recovered once their keys lapse.
   */
  #write(runId: string, store: WorkflowsStorage): Promise<void> {
    if (this.scope.__shuttingDown) {
      return Promise.resolve();
    }

    const inFlight = this.#writing.get(runId);
    if (inFlight) {
      return inFlight;
    }

    const startedAt = Date.now();
    const write = (async () => {
      try {
        await store.claimRunOwnership({
          runId: runLivenessKey(runId),
          ownerId: this.#ownerId,
          leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
          force: true,
        });
        this.#lastWriteAt.set(runId, startedAt);
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

    // A finished run's last write time is kept for one interval so its next quick step skips the write.
    for (const runId of this.#lastWriteAt.keys()) {
      const idle = !this.#active.has(runId);
      if (idle && this.#age(runId) >= LIVENESS_RENEW_INTERVAL_MS) {
        this.#lastWriteAt.delete(runId);
      }
    }

    if (this.#active.size === 0 && this.#lastWriteAt.size === 0) {
      // `#ensureTimer` starts a new chain if a leaf of any run starts later.
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
 * sees every leaf the process runs, whether the in-process push subscription
 * or an orchestration worker delivered it, while each of those has its own
 * event processor.
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
