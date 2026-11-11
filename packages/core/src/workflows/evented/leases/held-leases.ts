/**
 * Leases this process keeps renewing on behalf of a run it handed to the
 * workers, until a worker takes the run over.
 */
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import { runOutsideRunFenceScope } from '../../../storage/run-fencing';
import type { RunFence, RunOwnershipRecord } from '../../../storage/run-fencing';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../../run-ownership';
import type { WorkflowRunOwnership } from '../../run-ownership';
import { forEachBounded } from './bounded';
import { runLivenessKey } from './keys';
import { LIVENESS_RENEW_CONCURRENCY, LIVENESS_RENEW_INTERVAL_MS } from './liveness';
import type { LivenessScope } from './liveness';

// How often held restart leases look for their runs' liveness keys: often enough that the
// recovery sweep frees its slot soon after a worker starts the run.
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
  heldSince: number;
  renewedAt: number;
  /** Stops holding; `handedOff` tells whether a worker took the run over. */
  end(handedOff: boolean): void;
}

/**
 * Checks every restart lease held against one store with a single timer: one
 * batched liveness read per tick for all of them, then the renewals that are
 * due. A tick does not start while the previous one runs, and the timer stops
 * once nothing is held.
 */
class RestartLeasePoller {
  readonly #held = new Set<HeldRestart>();
  #timer?: ReturnType<typeof setInterval>;
  #ticking = false;

  constructor(readonly store: WorkflowsStorage) {}

  /** Starts checking `held` on the next tick. */
  add(held: HeldRestart): void {
    this.#held.add(held);
    // Created outside the claimer's fence scope, which the timer would otherwise carry into every tick.
    this.#timer ??= runOutsideRunFenceScope(() => setInterval(() => void this.#tick(), HANDOFF_CHECK_INTERVAL_MS));
    this.#timer.unref?.();
  }

  /** Stops checking `held`. */
  delete(held: HeldRestart): void {
    this.#held.delete(held);
    if (this.#held.size > 0) return;
    clearInterval(this.#timer);
    this.#timer = undefined;
  }

  /** Ends the holds whose run went live, gave up, or ran out of time, and renews the rest that are due. */
  async #tick(): Promise<void> {
    if (this.#ticking) return;
    this.#ticking = true;
    try {
      const now = Date.now();
      const checked = [...this.#held].filter(held => {
        if (held.scope?.__shuttingDown || now - held.heldSince >= RESTART_LEASE_MAX_HOLD_MS) held.end(false);
        return this.#held.has(held);
      });
      if (checked.length === 0) return;
      const live = await this.store.getRunOwnerships({ runIds: checked.map(held => runLivenessKey(held.runId)) });
      const due = checked.filter(held => {
        if (live.get(runLivenessKey(held.runId))?.live) held.end(true);
        return this.#held.has(held) && Date.now() - held.renewedAt >= LIVENESS_RENEW_INTERVAL_MS;
      });
      await forEachBounded(due, LIVENESS_RENEW_CONCURRENCY, async held => {
        const renewal = await this.store
          .renewRunOwnership({ ...held.fence, leaseMs: WORKFLOW_RUN_LEASE_TTL_MS })
          .catch(() => undefined);
        if (renewal?.renewed) held.renewedAt = Date.now();
        else if (renewal) held.end(false);
      });
    } catch {
      // A failed read is retried on the next tick, well before any held lease lapses.
    } finally {
      this.#ticking = false;
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
}: {
  scope?: LivenessScope;
  store: WorkflowsStorage;
  runId: string;
  record: RunOwnershipRecord;
}): WorkflowRunOwnership {
  let poller = restartLeasePollers.get(store);
  if (!poller) restartLeasePollers.set(store, (poller = new RestartLeasePoller(store)));
  let markHandedOff!: () => void;
  const handedOff = new Promise<void>(resolve => (markHandedOff = resolve));
  let wasHandedOff = false;
  const now = Date.now();
  const held: HeldRestart = {
    runId,
    fence: { runId: record.runId, generation: record.generation, ownerId: record.ownerId },
    scope,
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
      const handedOffBefore = wasHandedOff;
      held.end(false);
      if (!handedOffBefore) await store.releaseRunOwnership(held.fence).catch(() => {});
    },
  };
}
