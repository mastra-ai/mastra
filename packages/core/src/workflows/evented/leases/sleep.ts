/**
 * Leases and stored state of `sleep` and `sleepUntil` steps: the lease that
 * sets a sleep up once, the lease that wakes it once, and the wake time a
 * sleep stores.
 */
import type { IMastraLogger } from '../../../logger';
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import type { RunFence, RunOwnershipRecord } from '../../../storage/run-fencing';
import {
  WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS,
  WORKFLOW_RUN_LEASE_TTL_MS,
  repeatAfterSettled,
} from '../../run-ownership';
import type { LivenessScope } from './liveness';
import { holdDelay, sleep as wait } from './step-lease';

/** A sleep lease this process holds, renewed until it is released or abandoned. */
export interface SleepWakeLease {
  /** The work it guarded is done: releases the lease. On a wake lease this marks the occurrence woken. */
  release(): Promise<void>;
  /** Stops renewing and leaves the lease to lapse, so another process can claim it later. */
  abandon(): void;
  /**
   * Stops renewing and lets the lease run out now, without marking anything
   * done, once the work it guarded stopped before writing anything that lasts.
   */
  lapse(): Promise<void>;
  /**
   * Whether this process still holds the lease, checked by renewing it in the
   * store: `'lost'` once it was abandoned or another process took it over, and
   * `'unknown'` when the store failed the renewal, which leaves the lease as it
   * was, possibly still held.
   */
  check(): Promise<'held' | 'lost' | 'unknown'>;
}

/** Renews the lease `record` grants until it is released or abandoned. */
function holdSleepLease(
  store: WorkflowsStorage,
  record: RunOwnershipRecord,
  logger: IMastraLogger | undefined,
): SleepWakeLease {
  const fence: RunFence = { runId: record.runId, generation: record.generation, ownerId: record.ownerId };
  const key = record.runId;
  let abandoned = false;
  // The renewal in flight, if any. A store renews an unreleased lease even once it expired, so a
  // renewal that lands after lapse() would hold the lease for another TTL; lapse() waits for it.
  let renewing: Promise<void> = Promise.resolve();
  // renewWorkflowLease's chain, plus the renewal in flight. Not setInterval, for the same reason as
  // there: a slow store would get renewals piling up and landing out of order.
  const stopRenewing = repeatAfterSettled(() => {
    renewing = store.renewRunOwnership({ ...fence, leaseMs: WORKFLOW_RUN_LEASE_TTL_MS }).then(
      result => {
        if (!result.renewed) {
          // Another claim superseded this one; renewing again could only fail the same way.
          stopRenewing();
          logger?.warn('Lost the lease of a workflow sleep', { key });
        }
      },
      // A failed write may be transient, so the next tick tries again.
      error => logger?.warn('Failed to renew the lease of a workflow sleep', { key, error }),
    );
    return renewing;
  }, WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS);

  return {
    async release() {
      stopRenewing();
      await store
        .releaseRunOwnership(fence)
        .catch(error => logger?.warn('Failed to release the lease of a workflow sleep', { key, error }));
    },

    abandon() {
      abandoned = true;
      stopRenewing();
    },

    async lapse() {
      abandoned = true;
      stopRenewing();
      // `renewing` never rejects: its failure is logged where it is created.
      await renewing;
      // The fence fails once another process took the lease over, which leaves its lease alone.
      await store
        .renewRunOwnership({ ...fence, leaseMs: 1 })
        .catch(error => logger?.warn('Failed to let the lease of a workflow sleep lapse', { key, error }));
    },

    async check() {
      if (abandoned) {
        return 'lost';
      }

      let renewed: boolean;
      try {
        renewed = (await store.renewRunOwnership({ ...fence, leaseMs: WORKFLOW_RUN_LEASE_TTL_MS })).renewed;
      } catch (error) {
        logger?.warn('Failed to check the lease of a workflow sleep', { key, error });
        return abandoned ? 'lost' : 'unknown';
      }

      // An abandon() while the renewal was on its way counts too.
      return !abandoned && renewed ? 'held' : 'lost';
    },
  };
}

/**
 * Claims the lease that serializes starting and resuming one sleep (see
 * `sleepStartKey`). While another delivery of the sleep's event holds it, this
 * one waits as a step delivery waits for a live step lease (see
 * `acquireStepLease`): `'drop'` once the holder released it, since the holder
 * then set the occurrence up, and the lease once it expired unreleased, since
 * the holder's process stopped mid-setup and a broker that has already
 * redelivered the event may not deliver it again. `'defer'` when `scope` is
 * shutting down, so the broker hands the delivery to another instance.
 */
export async function claimSleepStart({
  scope,
  store,
  key,
  logger,
}: {
  scope: LivenessScope;
  store: WorkflowsStorage;
  key: string;
  logger?: IMastraLogger;
}): Promise<SleepWakeLease | 'drop' | 'defer'> {
  const ownerId = globalThis.crypto.randomUUID();
  let result = await store.claimRunOwnership({ runId: key, ownerId, leaseMs: WORKFLOW_RUN_LEASE_TTL_MS, force: false });

  while (!result.acquired) {
    // Checked before and after the wait: a process shutting down hands the delivery back at once.
    if (scope.__shuttingDown) {
      return 'defer';
    }

    await wait(holdDelay(result.record));
    if (scope.__shuttingDown) {
      return 'defer';
    }

    const current = await store.getRunOwnership({ runId: key });
    if (current && !current.leaseExpiresAt) {
      return 'drop';
    }

    // Racing waiters that read the same record resolve to one winner.
    result = await store.claimRunOwnership({
      runId: key,
      ownerId,
      leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
      force: false,
      expectedGeneration: current?.generation ?? 0,
    });
  }

  return holdSleepLease(store, result.record, logger);
}

/**
 * Claims the lease of a sleep occurrence (see `sleepOccurrenceKey`) to wake it,
 * without waiting. `'woken'` once the lease was released: only a wake that
 * published the next step releases it, so the marker survives a restart that
 * writes an older snapshot back over the run. `'busy'` while another process
 * holds it, since that process is waking the same sleep. A lease that lapsed
 * unreleased is claimed again.
 */
export async function claimSleepWake({
  store,
  key,
  logger,
}: {
  store: WorkflowsStorage;
  key: string;
  logger?: IMastraLogger;
}): Promise<SleepWakeLease | 'busy' | 'woken'> {
  const current = await store.getRunOwnership({ runId: key });
  // Released wins over live: a released lease has no expiry, and nothing claims it again.
  if (current && !current.leaseExpiresAt) {
    return 'woken';
  }

  if (current?.live) {
    return 'busy';
  }

  // The claim expects the generation just read, so of two wakes racing only one claims it, even
  // when the first already released it by the time the second claims.
  const claim = await store.claimRunOwnership({
    runId: key,
    ownerId: globalThis.crypto.randomUUID(),
    leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
    force: false,
    expectedGeneration: current?.generation ?? 0,
  });
  if (!claim.acquired) {
    return claim.record && !claim.record.leaseExpiresAt ? 'woken' : 'busy';
  }

  return holdSleepLease(store, claim.record, logger);
}

/**
 * The wake time, in epoch milliseconds, that a sleep's `waiting` result
 * stores in `metadata.wakeAt`. `undefined` for a result written before wake
 * times were stored.
 */
export function storedWakeAt(result: { metadata?: unknown } | undefined): number | undefined {
  const wakeAt = (result?.metadata as { wakeAt?: unknown } | undefined)?.wakeAt;
  return typeof wakeAt === 'number' && Number.isFinite(wakeAt) ? wakeAt : undefined;
}
