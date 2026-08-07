import type { WorkerDeps } from '@mastra/core/worker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GithubReconcileWorker } from './reconcile-worker.js';
import type { GithubReconcileRepositorySource } from './reconcile-worker.js';
import type { ReconcileRepository, ReconcileSweepSummary } from './rules.js';

const EMPTY_SUMMARY: ReconcileSweepSummary = {
  repositories: 1,
  checked: 1,
  merged: 0,
  closed: 0,
  issuesChecked: 0,
  issuesClosed: 0,
  failed: 0,
  errors: [],
};

function repositorySource(
  overrides: Partial<{
    keys: Array<{ installationExternalId: string; repositoryExternalId: string }>;
    slugByExternalId: Record<string, string>;
    orgIdByExternalId: Record<string, string | undefined>;
  }> = {},
): GithubReconcileRepositorySource {
  const keys = overrides.keys ?? [{ installationExternalId: '17', repositoryExternalId: '99' }];
  const slugByExternalId = overrides.slugByExternalId ?? { '99': 'octo/hello' };
  const orgIdByExternalId = overrides.orgIdByExternalId ?? { '99': 'org-a' };
  return {
    projectRepositories: {
      listConfiguredExternalKeys: async () => keys,
      listByExternalRepository: async ({ repositoryExternalId }) => {
        const orgId = orgIdByExternalId[repositoryExternalId];
        return orgId ? [{ orgId, factoryProjectId: 'project-a', projectRepository: {} as never }] : [];
      },
    },
    repositories: {
      findByExternalId: async ({ externalId }) => {
        const slug = slugByExternalId[externalId];
        return slug ? ({ id: `repo-${externalId}`, externalId, slug } as never) : null;
      },
    },
  };
}

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

describe('GithubReconcileWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves configured repositories to sweep targets', async () => {
    const reconcile = vi.fn(async () => EMPTY_SUMMARY);
    const worker = new GithubReconcileWorker({ reconcile, sourceControl: repositorySource(), intervalMs: 60_000 });
    await worker.init(workerDeps());

    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();

    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(reconcile.mock.calls[0]![0]).toEqual<ReconcileRepository[]>([
      { id: 99, fullName: 'octo/hello', installationId: 17 },
    ]);
  });

  it('skips a configured key whose repository row is gone', async () => {
    const reconcile = vi.fn(async () => EMPTY_SUMMARY);
    const worker = new GithubReconcileWorker({
      reconcile,
      sourceControl: repositorySource({ slugByExternalId: {} }),
      intervalMs: 60_000,
    });
    await worker.init(workerDeps());

    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();

    expect(reconcile).not.toHaveBeenCalled();
  });

  it('does not sweep while another replica holds the lease', async () => {
    const reconcile = vi.fn(async () => EMPTY_SUMMARY);
    const worker = new GithubReconcileWorker({ reconcile, sourceControl: repositorySource(), intervalMs: 60_000 });
    await worker.init(workerDeps({ acquireLease: vi.fn(async () => ({ acquired: false, owner: 'other' })) }));

    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();

    expect(reconcile).not.toHaveBeenCalled();
  });

  it('releases the lease when the sweep throws', async () => {
    const releaseLease = vi.fn(async () => undefined);
    const reconcile = vi.fn(async () => {
      throw new Error('github unreachable');
    });
    const worker = new GithubReconcileWorker({ reconcile, sourceControl: repositorySource(), intervalMs: 60_000 });
    await worker.init(workerDeps({ releaseLease }));

    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();

    expect(releaseLease).toHaveBeenCalledTimes(1);
  });

  it('keeps sweeping on the configured cadence until stopped', async () => {
    const reconcile = vi.fn(async () => EMPTY_SUMMARY);
    const worker = new GithubReconcileWorker({ reconcile, sourceControl: repositorySource(), intervalMs: 60_000 });
    await worker.init(workerDeps());

    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reconcile).toHaveBeenCalledTimes(2);

    await worker.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(worker.isRunning).toBe(false);
  });

  it('rejects a non-positive interval', () => {
    expect(
      () =>
        new GithubReconcileWorker({
          reconcile: async () => EMPTY_SUMMARY,
          sourceControl: repositorySource(),
          intervalMs: 0,
        }),
    ).toThrow(/positive number/);
  });
});
