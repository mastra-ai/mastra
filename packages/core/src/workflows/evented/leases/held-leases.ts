/**
 * Leases this process keeps renewing on behalf of a run it handed to the
 * workers, until a worker takes the run over.
 */
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import { runOutsideRunFenceScope } from '../../../storage/run-fencing';
import type { RunFence, RunOwnershipRecord } from '../../../storage/run-fencing';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../../run-ownership';
import type { WorkflowRunOwnership } from '../../run-ownership';
import { runLivenessKey } from './keys';
import { LIVENESS_RENEW_INTERVAL_MS } from './liveness';
import type { LivenessScope } from './liveness';

// How often a held restart lease looks for the run's liveness key: often enough that the
// recovery sweep frees its slot soon after a worker starts the run.
const HANDOFF_CHECK_INTERVAL_MS = Math.max(1, Math.min(250, Math.floor(WORKFLOW_RUN_LEASE_TTL_MS / 10)));

/**
 * Keeps the `restart()` lease of `runId` until the run's liveness key is live,
 * then resolves `handedOff` and lets the lease lapse. Without it, a worker
 * backlog longer than one lease TTL would let another instance restart the run
 * again before any worker started it. Only the run's own key counts: a restart
 * whose first step runs in a nested run keeps the lease until `release()`.
 *
 * Renewal stops once the process shuts down, or the lease was taken over.
 * `release()` stops it too, and releases the lease when the run was never
 * handed off (its restart failed), so the next restart need not wait for it.
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
  const fence: RunFence = { runId: record.runId, generation: record.generation, ownerId: record.ownerId };
  let markHandedOff!: () => void;
  const handedOff = new Promise<void>(resolve => (markHandedOff = resolve));
  let done = false;
  let wasHandedOff = false;
  let renewedAt = Date.now();
  const stop = () => {
    done = true;
    clearInterval(timer);
  };
  const check = async () => {
    if (done) return;
    if (scope?.__shuttingDown) return stop();
    try {
      if ((await store.getRunOwnership({ runId: runLivenessKey(runId) }))?.live) {
        wasHandedOff = true;
        markHandedOff();
        return stop();
      }
      if (done || Date.now() - renewedAt < LIVENESS_RENEW_INTERVAL_MS) return;
      const renewal = await store.renewRunOwnership({ ...fence, leaseMs: WORKFLOW_RUN_LEASE_TTL_MS });
      if (renewal.renewed) renewedAt = Date.now();
      else stop();
    } catch {
      // A failed read or renewal is retried on the next check, well before the lease lapses.
    }
  };
  // Created outside the caller's fence scope, which the timer would otherwise carry into every check.
  const timer = runOutsideRunFenceScope(() => setInterval(() => void check(), HANDOFF_CHECK_INTERVAL_MS));
  timer.unref?.();
  return {
    handedOff,
    async release() {
      stop();
      if (!wasHandedOff) await store.releaseRunOwnership(fence).catch(() => {});
    },
  };
}
