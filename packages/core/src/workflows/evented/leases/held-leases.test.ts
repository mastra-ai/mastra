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
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../../run-ownership';
import { holdRestartLease } from './held-leases';
import { restartLeaseKey } from './keys';

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
