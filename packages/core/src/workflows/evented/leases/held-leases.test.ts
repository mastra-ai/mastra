/**
 * The `restart()` lease a process keeps after publishing an evented restart,
 * until a worker takes the run over (#28712). Leases use a short TTL here,
 * read when core loads.
 */
vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { describe, expect, it, vi } from 'vitest';
import { InMemoryStore } from '../../../storage/mock';
import type { RunOwnershipRecord } from '../../../storage/run-fencing';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../../run-ownership';
import { holdRestartLease } from './held-leases';
import { restartLeaseKey, runLivenessKey } from './keys';

describe('held restart leases (#28712)', () => {
  it('starts no new liveness check while the previous one is still pending', async () => {
    vi.useFakeTimers();
    try {
      const store = (await new InMemoryStore().getStore('workflows'))!;
      const claim = await store.claimRunOwnership({
        runId: restartLeaseKey('restarted'),
        ownerId: 'restarter',
        leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
      });
      // The store stalls on the first liveness read.
      const stalled = Promise.withResolvers<void>();
      const read = store.getRunOwnerships.bind(store);
      const reads = vi.spyOn(store, 'getRunOwnerships').mockImplementation(async args => {
        await stalled.promise;
        return read(args);
      });
      const hold = holdRestartLease({ store, runId: 'restarted', record: claim.record! });

      // Several check intervals pass while the first read is pending.
      await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_TTL_MS);
      expect(reads).toHaveBeenCalledTimes(1);

      stalled.resolve();
      await hold.release();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not end a newer hold of the run with a liveness read started for an earlier hold', async () => {
    vi.useFakeTimers();
    try {
      const store = (await new InMemoryStore().getStore('workflows'))!;
      const hold = async () => {
        const claim = await store.claimRunOwnership({
          runId: restartLeaseKey('restarted'),
          ownerId: 'restarter',
          leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
        });
        return holdRestartLease({ store, runId: 'restarted', record: claim.record! });
      };
      // The first liveness read stalls and then answers with the record a worker that has since
      // died left behind; later reads go to the store.
      const stale = Promise.withResolvers<Map<string, RunOwnershipRecord>>();
      const read = store.getRunOwnerships.bind(store);
      vi.spyOn(store, 'getRunOwnerships')
        .mockImplementationOnce(() => stale.promise)
        .mockImplementation(args => read(args));
      const first = await hold();
      await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_TTL_MS / 4);

      // The first restart fails and releases its lease while that read is pending, and a second
      // restart of the run takes a new one.
      await first.release();
      const second = await hold();
      let handedOff = false;
      void second.handedOff!.then(() => (handedOff = true));
      // Halfway through the second hold's first check (checks run every TTL / 10 and wait for a
      // pending read at most that long), so the stale answer reaches a check that is waiting on it.
      await vi.advanceTimersByTimeAsync((WORKFLOW_RUN_LEASE_TTL_MS / 10) * 1.5);
      const leaseExpiresAt = new Date(Date.now() + WORKFLOW_RUN_LEASE_TTL_MS);
      stale.resolve(
        new Map([
          [
            runLivenessKey('restarted'),
            { runId: runLivenessKey('restarted'), generation: 1, ownerId: 'dead-worker', leaseExpiresAt, live: true },
          ],
        ]),
      );
      await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_TTL_MS * 2);

      expect(handedOff).toBe(false);
      expect((await store.getRunOwnership({ runId: restartLeaseKey('restarted') }))?.live).toBe(true);
      await second.release();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps renewing the other held leases while one renewal never answers', async () => {
    vi.useFakeTimers();
    try {
      const store = (await new InMemoryStore().getStore('workflows'))!;
      const hold = async (runId: string) => {
        const claim = await store.claimRunOwnership({
          runId: restartLeaseKey(runId),
          ownerId: 'restarter',
          leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
        });
        return holdRestartLease({ store, runId, record: claim.record! });
      };
      // The store hangs on every renewal of the `stalled` run's lease.
      const renew = store.renewRunOwnership.bind(store);
      const renewals = vi.spyOn(store, 'renewRunOwnership').mockImplementation(args => {
        if (args.runId === restartLeaseKey('stalled')) {
          return new Promise(() => {});
        }

        return renew(args);
      });
      const holds = [await hold('stalled'), await hold('renewed')];

      await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_TTL_MS * 2);

      expect((await store.getRunOwnership({ runId: restartLeaseKey('renewed') }))?.live).toBe(true);
      // The stalled lease never gets a second renewal on top of the one in flight.
      const stalledRenewals = renewals.mock.calls.filter(([args]) => args.runId === restartLeaseKey('stalled'));
      expect(stalledRenewals).toHaveLength(1);
      await Promise.all(holds.map(held => held.release()));
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps renewing the lease while a liveness read never answers', async () => {
    vi.useFakeTimers();
    try {
      const store = (await new InMemoryStore().getStore('workflows'))!;
      const claim = await store.claimRunOwnership({
        runId: restartLeaseKey('restarted'),
        ownerId: 'restarter',
        leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
      });
      // The store hangs on every liveness read.
      vi.spyOn(store, 'getRunOwnerships').mockReturnValue(new Promise(() => {}));
      const hold = holdRestartLease({ store, runId: 'restarted', record: claim.record! });

      await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_TTL_MS * 2);

      expect((await store.getRunOwnership({ runId: restartLeaseKey('restarted') }))?.live).toBe(true);
      await hold.release();
    } finally {
      vi.useRealTimers();
    }
  });
});
