/**
 * The `restart()` leases this process keeps after publishing a restart, until
 * a worker takes the run over.
 */
import type { IMastraLogger } from '../../../logger';
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import { runOutsideRunFenceScope } from '../../../storage/run-fencing';
import type { RunFence, RunOwnershipRecord } from '../../../storage/run-fencing';
import { WORKFLOW_RUN_LEASE_TTL_MS, repeatAfterSettled } from '../../run-ownership';
import type { WorkflowRunOwnership } from '../../run-ownership';
import { forEachBounded } from './bounded';
import { runLivenessKey } from './keys';
import { LIVENESS_RENEW_CONCURRENCY, LIVENESS_RENEW_INTERVAL_MS } from './liveness';
import type { LivenessScope } from './liveness';

// Often enough that the recovery sweep frees its slot soon after a worker starts the run.
const HANDOFF_CHECK_INTERVAL_MS = Math.max(1, Math.min(250, Math.floor(WORKFLOW_RUN_LEASE_TTL_MS / 10)));

/**
 * How long a restart lease is renewed while no worker marks the run live. Past
 * it the worker that got the restart is presumed lost (it crashed before its
 * first step on a pubsub that does not redeliver, or its liveness writes keep
 * failing), and the lease lapses one TTL later so another restart can run.
 */
const RESTART_LEASE_MAX_HOLD_MS = WORKFLOW_RUN_LEASE_TTL_MS * 4;

/** A `restart()` lease this process keeps until its run is handed to a worker. */
interface HeldRestart {
  runId: string;
  fence: RunFence;
  scope?: LivenessScope;
  logger?: IMastraLogger;
  heldSince: number;
  renewedAt: number;
  /** Stops holding; `handedOff` tells whether a worker took the run over. */
  end(handedOff: boolean): void;
}

/**
 * Checks every restart lease held against one store on one timer: one batched
 * liveness read per tick for all of them, then the renewals that are due,
 * which run even when the read failed. The next tick starts one interval after
 * the previous one settles, and the ticks stop once nothing is held.
 */
class RestartLeasePoller {
  readonly #held = new Set<HeldRestart>();
  /** Stops the tick chain; set while it runs. */
  #stopTicks?: () => void;
  /** Whether the last liveness read failed, so a streak of failures is logged once. */
  #readFailing = false;

  constructor(readonly store: WorkflowsStorage) {}

  /** Starts checking `held` on the next tick. */
  add(held: HeldRestart): void {
    this.#held.add(held);
    if (this.#stopTicks) {
      return;
    }

    // Not setInterval: it fires on schedule while the previous tick's read and renewals are still
    // pending, so a slow store would get overlapping ticks that renew the same leases out of order.
    // Created outside the claimer's fence scope, which the timer would otherwise carry into every tick.
    this.#stopTicks = runOutsideRunFenceScope(() => repeatAfterSettled(() => this.#tick(), HANDOFF_CHECK_INTERVAL_MS));
  }

  /** Stops checking `held`, and stops the ticks once nothing is held. */
  delete(held: HeldRestart): void {
    this.#held.delete(held);
    if (this.#held.size > 0) {
      return;
    }

    // A tick of this chain that is still running may overlap the first tick of the next chain.
    // Both only read liveness and renew the same fences, so the overlap is harmless.
    this.#stopTicks?.();
    this.#stopTicks = undefined;
  }

  /**
   * Ends the holds whose run went live, gave up, or ran out of time, and
   * renews the rest that are due. Never rejects, as `repeatAfterSettled`
   * requires: the read and each renewal handle their own failures.
   */
  async #tick(): Promise<void> {
    const now = Date.now();
    const checked = [...this.#held].filter(held => {
      if (held.scope?.__shuttingDown || now - held.heldSince >= RESTART_LEASE_MAX_HOLD_MS) {
        held.end(false);
      }

      return this.#held.has(held);
    });
    if (checked.length === 0) {
      return;
    }

    const live = await this.#readLiveness(checked);
    const due = checked.filter(held => {
      if (live.get(runLivenessKey(held.runId))?.live) {
        held.end(true);
      }

      return this.#held.has(held) && Date.now() - held.renewedAt >= LIVENESS_RENEW_INTERVAL_MS;
    });

    await forEachBounded(due, LIVENESS_RENEW_CONCURRENCY, held => this.#renew(held));
  }

  /**
   * The liveness records of the runs `checked` holds, read in one batch. A
   * failed read returns no records, so no hand-off is seen this tick and the
   * due leases are still renewed: skipping them could let another instance
   * take one over and restart its run again.
   */
  async #readLiveness(checked: HeldRestart[]): Promise<Map<string, RunOwnershipRecord>> {
    const logger = checked.find(held => held.logger)?.logger;

    try {
      const records = await this.store.getRunOwnerships({ runIds: checked.map(held => runLivenessKey(held.runId)) });
      if (this.#readFailing) {
        logger?.info('Reading whether restarted workflow runs were handed to a worker works again');
      }

      this.#readFailing = false;
      return records;
    } catch (error) {
      // Once per failure streak: a store that is down would otherwise log on every tick.
      if (!this.#readFailing) {
        logger?.warn('Failed to read whether restarted workflow runs were handed to a worker', {
          runs: checked.length,
          error,
        });
      }

      this.#readFailing = true;
      return new Map();
    }
  }

  /** Renews one held lease, and ends the hold when the lease was taken over. Never rejects. */
  async #renew(held: HeldRestart): Promise<void> {
    try {
      const renewal = await this.store.renewRunOwnership({ ...held.fence, leaseMs: WORKFLOW_RUN_LEASE_TTL_MS });
      if (renewal.renewed) {
        held.renewedAt = Date.now();
      } else {
        held.end(false);
      }
    } catch (error) {
      // Retried on the next tick, well before the lease lapses. Debug only: a store that is down
      // fails every renewal, and the liveness read already warns about it.
      held.logger?.debug('Failed to renew a restarted workflow run lease', { runId: held.runId, error });
    }
  }
}

const restartLeasePollers = new WeakMap<WorkflowsStorage, RestartLeasePoller>();

/**
 * Keeps the `restart()` lease of `runId` until the run's liveness key is live.
 * Without it, a worker backlog longer than one lease TTL would let another
 * instance restart the run again before any worker started it. Only the run's
 * own key counts: a restart whose first step runs in a nested run is held
 * until `release()` or the hold limit.
 *
 * Renewal stops on hand-off, once the process shuts down, when the lease was
 * taken over, and after {@link RESTART_LEASE_MAX_HOLD_MS}; the lease then
 * lapses on its own. `handedOff` resolves whenever the hold ends. `release()`
 * ends it too, and releases the lease when no worker took the run over (its
 * restart failed), so the next restart need not wait for it.
 */
export function holdRestartLease({
  scope,
  store,
  runId,
  record,
  logger,
}: {
  scope?: LivenessScope;
  store: WorkflowsStorage;
  runId: string;
  record: RunOwnershipRecord;
  logger?: IMastraLogger;
}): WorkflowRunOwnership {
  let poller = restartLeasePollers.get(store);
  if (!poller) {
    poller = new RestartLeasePoller(store);
    restartLeasePollers.set(store, poller);
  }

  let markHandedOff!: () => void;
  const handedOff = new Promise<void>(resolve => (markHandedOff = resolve));
  let wasHandedOff = false;
  const now = Date.now();
  const held: HeldRestart = {
    runId,
    fence: { runId: record.runId, generation: record.generation, ownerId: record.ownerId },
    scope,
    logger,
    heldSince: now,
    renewedAt: now,
    end(handedOffToWorker) {
      wasHandedOff ||= handedOffToWorker;
      poller.delete(held);
      markHandedOff();
    },
  };
  poller.add(held);

  return {
    handedOff,
    async release() {
      held.end(false);
      // A worker that took the run over relies on it no longer; it lapses on its own.
      if (wasHandedOff) {
        return;
      }

      try {
        await store.releaseRunOwnership(held.fence);
      } catch (error) {
        // The lease lapses one TTL later anyway; releasing only lets the next restart run sooner.
        logger?.debug('Failed to release a restarted workflow run lease', { runId, error });
      }
    },
  };
}
