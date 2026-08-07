import type { WorkerDeps } from '@mastra/core/worker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IssueReconcileSummary } from '../issue-reconciler.js';
import { GithubReconcileWorker } from './reconcile-worker.js';
import type { GithubReconcileRepositorySource } from './reconcile-worker.js';
import type { ReconcileRepository, ReconcileSweepSummary } from './rules.js';

const EMPTY_ISSUE_SUMMARY: IssueReconcileSummary = {
  projects: 0,
  checked: 0,
  updated: 0,
  missing: 0,
  failed: 0,
  errors: [],
};

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

function workerDeps(
  leaseProvider?: Partial<{ acquireLease: unknown; releaseLease: unknown; renewLease: unknown }>,
): WorkerDeps {
  const pubsub = {
    acquireLease: leaseProvider?.acquireLease ?? vi.fn(async () => ({ acquired: true })),
    releaseLease: leaseProvider?.releaseLease ?? vi.fn(async () => undefined),
    renewLease: leaseProvider?.renewLease ?? vi.fn(async () => true),
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

  it('folds the issue reconcile into the same tick and passes the same targets', async () => {
    const reconcile = vi.fn(async () => EMPTY_SUMMARY);
    const reconcileIssues = vi.fn(async () => EMPTY_ISSUE_SUMMARY);
    const releaseLease = vi.fn(async () => undefined);
    const worker = new GithubReconcileWorker({
      reconcile,
      reconcileIssues,
      sourceControl: repositorySource(),
      intervalMs: 60_000,
    });
    await worker.init(workerDeps({ releaseLease }));

    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();

    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(reconcileIssues).toHaveBeenCalledTimes(1);
    const targets = reconcile.mock.calls[0]![0];
    const scope = reconcileIssues.mock.calls[0]![0];
    expect(scope.scopes).toBe(targets);
    // Same lease covers both writers of card state.
    expect(releaseLease).toHaveBeenCalledTimes(1);
  });

  it('renews the lease during a sweep longer than the lease TTL', async () => {
    // 60s interval → 180s lease TTL → 60s renewal cadence.
    const intervalMs = 60_000;
    const leaseTtlMs = intervalMs * 3;
    const renewLease = vi.fn(async () => true);
    const releaseLease = vi.fn(async () => undefined);

    // A slow PR sweep pushes the tick past the lease TTL; folding the issue
    // sweep in on top of that made renewal necessary to avoid handoff.
    const reconcile = vi.fn(async () => {
      await vi.advanceTimersByTimeAsync(leaseTtlMs + intervalMs);
      return EMPTY_SUMMARY;
    });
    const reconcileIssues = vi.fn(async () => EMPTY_ISSUE_SUMMARY);

    const worker = new GithubReconcileWorker({
      reconcile,
      reconcileIssues,
      sourceControl: repositorySource(),
      intervalMs,
    });
    await worker.init(workerDeps({ renewLease, releaseLease }));

    await worker.start();
    // The initial tick starts at t=0; #reconcile advances fake time by
    // (leaseTtlMs + intervalMs) internally, so the sweep completes inside
    // this single advance. Stop the worker before any further advance so
    // the next scheduled sweep does not run and add a second releaseLease.
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();

    expect(renewLease.mock.calls.length).toBeGreaterThanOrEqual(2);
    for (const call of renewLease.mock.calls) {
      expect(call).toEqual(['github:pull-request-reconcile', expect.any(String), leaseTtlMs]);
    }
    expect(releaseLease).toHaveBeenCalledTimes(1);
  });

  it('skips the folded issue reconcile and releaseLease when the lease is lost mid-sweep', async () => {
    // Regression: renewLease returning `false` means another replica already
    // holds the lease. The issue sweep must not run — it would race the new
    // owner's writes. releaseLease is also skipped so we don't stomp the new
    // owner's TTL.
    const intervalMs = 60_000;
    const leaseTtlMs = intervalMs * 3;
    const releaseLease = vi.fn(async () => undefined);
    // First renewal returns false: this owner has lost the lease.
    const renewLease = vi.fn(async () => false);

    const reconcile = vi.fn(async () => {
      // Advance past one renewal cadence so the lease-loss result is
      // observed while the PR sweep is still in flight.
      await vi.advanceTimersByTimeAsync(leaseTtlMs + intervalMs);
      return EMPTY_SUMMARY;
    });
    const reconcileIssues = vi.fn(async () => EMPTY_ISSUE_SUMMARY);

    const worker = new GithubReconcileWorker({
      reconcile,
      reconcileIssues,
      sourceControl: repositorySource(),
      intervalMs,
    });
    await worker.init(workerDeps({ renewLease, releaseLease }));

    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();

    expect(renewLease).toHaveBeenCalled();
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(reconcileIssues).not.toHaveBeenCalled();
    expect(releaseLease).not.toHaveBeenCalled();
  });

  it('skips the folded issue reconcile when renewal throws (treats it as lease loss)', async () => {
    const intervalMs = 60_000;
    const leaseTtlMs = intervalMs * 3;
    const releaseLease = vi.fn(async () => undefined);
    const renewLease = vi.fn(async () => {
      throw new Error('lease provider offline');
    });

    const reconcile = vi.fn(async () => {
      await vi.advanceTimersByTimeAsync(leaseTtlMs + intervalMs);
      return EMPTY_SUMMARY;
    });
    const reconcileIssues = vi.fn(async () => EMPTY_ISSUE_SUMMARY);

    const worker = new GithubReconcileWorker({
      reconcile,
      reconcileIssues,
      sourceControl: repositorySource(),
      intervalMs,
    });
    await worker.init(workerDeps({ renewLease, releaseLease }));

    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();

    expect(renewLease).toHaveBeenCalled();
    expect(reconcileIssues).not.toHaveBeenCalled();
    expect(releaseLease).not.toHaveBeenCalled();
  });

  it('stops renewing the lease between sweeps', async () => {
    const renewLease = vi.fn(async () => true);
    const reconcile = vi.fn(async () => EMPTY_SUMMARY);
    const worker = new GithubReconcileWorker({ reconcile, sourceControl: repositorySource(), intervalMs: 60_000 });
    await worker.init(workerDeps({ renewLease }));

    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);

    const renewalsAfterFirstSweep = renewLease.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    await worker.stop();

    // Idle windows must not accumulate renewals — the timer is cleared before
    // release, so at most one renewal per sweep can leak in.
    expect(renewLease.mock.calls.length - renewalsAfterFirstSweep).toBeLessThanOrEqual(reconcile.mock.calls.length);
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
