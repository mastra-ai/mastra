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
  /** Set while a renewal of this lease is in flight, so no later or overlapping tick starts a second one. */
  renewing?: boolean;
  /** Stops holding; `handedOff` tells whether a worker took the run over. */
  end(handedOff: boolean): void;
}

/**
 * Checks every restart lease held against one store on one timer: one batched
 * liveness read for all of them, then the renewals that are due, which run
 * even when the read failed or has not answered within one check interval.
 * A tick waits for each renewal at most one check interval too.
 * The next tick starts one interval after the previous one settles, and the
 * ticks stop once nothing is held.
 */
class RestartLeasePoller {
  readonly #held = new Set<HeldRestart>();
  /** Stops the tick chain; set while it runs. */
  #stopTicks?: () => void;
  /** Whether the last liveness read failed, so a streak of failures is logged once. */
  #readFailing = false;
  /** The batched liveness read in flight, shared by the ticks that run until it settles. */
  #reading?: Promise<Map<string, RunOwnershipRecord>>;

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
    // They share the liveness read in flight and skip leases the other is renewing.
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

    const live = await this.#readLivenessWithinInterval(checked);
    const due = checked.filter(held => {
      if (live.get(runLivenessKey(held.runId))?.live) {
        held.end(true);
      }

      return this.#held.has(held) && !held.renewing && Date.now() - held.renewedAt >= LIVENESS_RENEW_INTERVAL_MS;
    });

    await forEachBounded(due, LIVENESS_RENEW_CONCURRENCY, held => this.#renewWithinInterval(held));
  }

  /**
   * Renews one held lease, waiting for it at most one check interval, so a
   * stalled renewal cannot hold back the ticks that renew the other leases. A
   * renewal still pending by then stays in flight with `renewing` set, and its
   * lease gets no second renewal until it settles.
   */
  async #renewWithinInterval(held: HeldRestart): Promise<void> {
    // `#renew` never rejects, so the renewal left in flight needs no handler.
    const settled = await this.#withinInterval(this.#renew(held).then(() => true));
    if (!settled) {
      // Debug only: a renewal that is merely slow settles later, and one that fails logs there.
      held.logger?.debug('Renewing other held restart leases without waiting for a slow renewal', {
        runId: held.runId,
      });
    }
  }

  /** What `promise` resolves to, or `undefined` when it has not settled within one check interval. */
  async #withinInterval<T>(promise: Promise<T>): Promise<T | undefined> {
    let expire!: () => void;
    const deadline = new Promise<undefined>(resolve => {
      expire = () => resolve(undefined);
    });
    const timer = setTimeout(expire, HANDOFF_CHECK_INTERVAL_MS);
    timer.unref?.();

    try {
      return await Promise.race([promise, deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * The liveness records the batched read returns within one check interval,
   * or none when it has not answered by then. The due leases are renewed
   * either way: a read that never settles must not let them lapse while the
   * restarted runs wait in a worker backlog.
   *
   * At most one read is in flight. A tick that finds the previous read still
   * pending waits on it again instead of starting another, so a slow store
   * gets no pile of reads, and its answer reaches the first tick after it
   * arrives. That answer covers the holds of the tick that started the read;
   * a hold added since is checked by the next read.
   */
  async #readLivenessWithinInterval(checked: HeldRestart[]): Promise<Map<string, RunOwnershipRecord>> {
    // `#readLiveness` never rejects, so the chain needs no handler.
    this.#reading ??= this.#readLiveness(checked).finally(() => {
      this.#reading = undefined;
    });

    const records = await this.#withinInterval(this.#reading);
    if (records) {
      return records;
    }

    // Debug only: a read that is merely slow answers on a later tick, and one that fails warns there.
    checked
      .find(held => held.logger)
      ?.logger?.debug('Renewing held restart leases without waiting for a slow liveness read', {
        runs: checked.length,
      });
    return new Map();
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
    held.renewing = true;
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
    } finally {
      held.renewing = false;
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
