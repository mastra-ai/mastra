import type { WorkerDeps } from '@mastra/core/worker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IssueReconcileWorker } from './issue-reconcile-worker.js';
import type { IssueReconcileSummary } from './issue-reconciler.js';

const EMPTY_SUMMARY: IssueReconcileSummary = {
  projects: 0,
  checked: 0,
  updated: 0,
  missing: 0,
  failed: 0,
  errors: [],
};

function workerDeps(leaseProvider?: Partial<{ acquireLease: unknown; releaseLease: unknown }>): WorkerDeps {
  const pubsub = {
    acquireLease: leaseProvider?.acquireLease ?? vi.fn(async () => ({ acquired: true })),
    releaseLease: leaseProvider?.releaseLease ?? vi.fn(async () => undefined),
    renewLease: vi.fn(async () => true),
    getLeaseOwner: vi.fn(async () => undefined),
    transferLease: vi.fn(async () => true),
  };
  return {
    pubsub: pubsub as unknown as WorkerDeps['pubsub'],
    storage: {} as WorkerDeps['storage'],
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() } as unknown as WorkerDeps['logger'],
  };
}

describe('IssueReconcileWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sweeps on boot and the configured cadence', async () => {
    const reconcile = vi.fn(async () => EMPTY_SUMMARY);
    const worker = new IssueReconcileWorker({ integrationId: 'linear', reconcile, intervalMs: 60_000 });
    await worker.init(workerDeps());

    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reconcile).toHaveBeenCalledTimes(2);

    await worker.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it('shares a provider-specific lease across replicas', async () => {
    const acquireLease = vi.fn(async () => ({ acquired: false, owner: 'other' }));
    const reconcile = vi.fn(async () => EMPTY_SUMMARY);
    const worker = new IssueReconcileWorker({ integrationId: 'github', reconcile, intervalMs: 60_000 });
    await worker.init(workerDeps({ acquireLease }));

    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();

    expect(acquireLease).toHaveBeenCalledWith('github:issue-reconcile', expect.any(String), 180_000);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('releases the lease after a failed sweep', async () => {
    const releaseLease = vi.fn(async () => undefined);
    const worker = new IssueReconcileWorker({
      integrationId: 'linear',
      reconcile: vi.fn(async () => {
        throw new Error('provider unavailable');
      }),
      intervalMs: 60_000,
    });
    await worker.init(workerDeps({ releaseLease }));

    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();

    expect(releaseLease).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-positive interval', () => {
    expect(
      () => new IssueReconcileWorker({ integrationId: 'github', reconcile: async () => EMPTY_SUMMARY, intervalMs: 0 }),
    ).toThrow(/positive number/);
  });
});
