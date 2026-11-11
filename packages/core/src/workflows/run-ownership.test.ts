import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStore } from '../storage/mock';
import { WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS, WORKFLOW_RUN_LEASE_TTL_MS, renewWorkflowLease } from './run-ownership';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('renewWorkflowLease', () => {
  it('waits for a slow renewal to settle before starting the next one', async () => {
    vi.useFakeTimers();
    const store = (await new InMemoryStore().getStore('workflows'))!;
    const { record } = await store.claimRunOwnership({
      runId: 'run',
      ownerId: 'owner',
      leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
      force: false,
    });
    const renew = store.renewRunOwnership.bind(store);
    const slow = Promise.withResolvers<void>();
    // The store stalls on the first renewal for several intervals.
    const renewals = vi.spyOn(store, 'renewRunOwnership').mockImplementation(async args => {
      if (renewals.mock.calls.length === 1) await slow.promise;
      return renew(args);
    });
    const onError = vi.fn();
    const stop = renewWorkflowLease({
      store,
      fence: { runId: 'run', generation: record!.generation, ownerId: 'owner' },
      onLost: () => {},
      onError,
    });

    await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS * 4);
    expect(renewals).toHaveBeenCalledTimes(1);

    slow.resolve();
    await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS);
    expect(renewals).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();

    stop();
    await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS * 2);
    expect(renewals).toHaveBeenCalledTimes(2);
  });
});
