import { beforeEach, describe, expect, it } from 'vitest';
import { GithubStorageInMemory } from './storage/inmemory';
import { GITHUB_DDL } from './storage/pg';

const baseInput = {
  orgId: 'org-a',
  installationId: 17,
  githubProjectId: '11111111-1111-1111-1111-111111111111',
  repoId: 99,
  pullRequestNumber: 42,
  sessionId: 'session-a',
  ownerId: 'user-a',
  resourceId: 'resource-a',
  threadId: 'thread-a',
  sessionScope: '/workspace/a',
  source: 'explicit-tool' as const,
  subscribedByUserId: 'user-a',
};

describe('GitHub signal subscription store', () => {
  let storage: GithubStorageInMemory;

  beforeEach(() => {
    storage = new GithubStorageInMemory();
    storage.projects.push({
      id: baseInput.githubProjectId,
      orgId: baseInput.orgId,
      userId: 'user-a',
      installationId: baseInput.installationId,
      repoId: baseInput.repoId,
      repoFullName: 'octo/hello',
      defaultBranch: 'main',
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace/a',
      setupCommand: null,
      createdAt: new Date('2026-07-13T00:00:00Z'),
    });
  });

  it('defines repeatable boot DDL for the table and indexes', () => {
    expect(GITHUB_DDL).toContain('CREATE TABLE IF NOT EXISTS github_signal_subscriptions');
    expect(GITHUB_DDL).toContain('CREATE UNIQUE INDEX IF NOT EXISTS github_signal_subscriptions_target_pr_unique');
    expect(GITHUB_DDL).toContain('CREATE INDEX IF NOT EXISTS github_signal_subscriptions_pr_lookup');
    expect(GITHUB_DDL).toContain('CREATE INDEX IF NOT EXISTS github_signal_subscriptions_thread_lookup');
  });

  it('creates a subscription with project-owned repository metadata', async () => {
    const { subscribeToPullRequest } = await import('./subscriptions');
    const created = await subscribeToPullRequest(baseInput, storage);

    expect(created).toMatchObject({
      ...baseInput,
      repoFullName: 'octo/hello',
    });
    expect(storage.subscriptions).toHaveLength(1);
  });

  it('returns the existing row for duplicate subscriptions', async () => {
    const { subscribeToPullRequest } = await import('./subscriptions');
    const first = await subscribeToPullRequest(baseInput, storage);
    const second = await subscribeToPullRequest(baseInput, storage);

    expect(second.id).toBe(first.id);
    expect(storage.subscriptions).toHaveLength(1);
  });

  it('reactivates a retained terminal subscription when subscribing again', async () => {
    const { retirePullRequestSubscription, subscribeToPullRequest } = await import('./subscriptions');
    const first = await subscribeToPullRequest(baseInput, storage);
    await retirePullRequestSubscription(first.id, 'closed', storage);

    const reactivated = await subscribeToPullRequest(baseInput, storage);

    expect(reactivated.id).toBe(first.id);
    expect(reactivated.status).toBe('open');
    expect(storage.subscriptions[0]?.status).toBe('open');
  });

  it('unsubscribes idempotently', async () => {
    const { subscribeToPullRequest, unsubscribeFromPullRequest } = await import('./subscriptions');
    await subscribeToPullRequest(baseInput, storage);
    await unsubscribeFromPullRequest(baseInput, storage);
    await unsubscribeFromPullRequest(baseInput, storage);

    expect(storage.subscriptions).toHaveLength(0);
  });

  it('supports reverse lookup by pull request and by scoped thread', async () => {
    const { listPullRequestSubscriptions, listPullRequestSubscriptionsForThread, subscribeToPullRequest } =
      await import('./subscriptions');
    await subscribeToPullRequest(baseInput, storage);
    await subscribeToPullRequest(
      { ...baseInput, sessionId: 'session-b', threadId: 'thread-b', sessionScope: '/workspace/b' },
      storage,
    );

    const forPullRequest = await listPullRequestSubscriptions(
      {
        orgId: baseInput.orgId,
        installationId: baseInput.installationId,
        repoId: baseInput.repoId,
        pullRequestNumber: baseInput.pullRequestNumber,
      },
      storage,
    );
    const forThread = await listPullRequestSubscriptionsForThread(
      {
        orgId: baseInput.orgId,
        resourceId: baseInput.resourceId,
        threadId: baseInput.threadId,
        sessionScope: baseInput.sessionScope,
      },
      storage,
    );

    expect(forPullRequest).toHaveLength(2);
    expect(forThread).toHaveLength(1);
    expect(forThread[0]?.sessionId).toBe('session-a');
  });

  it('supports installation-scoped webhook lookup and per-target retirement', async () => {
    const { listPullRequestSubscriptionsForWebhook, retirePullRequestSubscription, subscribeToPullRequest } =
      await import('./subscriptions');
    const first = await subscribeToPullRequest(baseInput, storage);
    const second = await subscribeToPullRequest(
      { ...baseInput, sessionId: 'session-c', threadId: 'thread-c' },
      storage,
    );

    const matches = await listPullRequestSubscriptionsForWebhook(
      {
        installationId: baseInput.installationId,
        repoId: baseInput.repoId,
        pullRequestNumber: baseInput.pullRequestNumber,
      },
      {},
      storage,
    );
    expect(matches.map(row => row.id)).toEqual([first.id, second.id]);

    await retirePullRequestSubscription(first.id, 'merged', storage);
    expect(storage.subscriptions).toHaveLength(2);
    expect(storage.subscriptions.find(row => row.id === first.id)?.status).toBe('merged');
    expect(
      (
        await listPullRequestSubscriptionsForWebhook(
          {
            installationId: baseInput.installationId,
            repoId: baseInput.repoId,
            pullRequestNumber: baseInput.pullRequestNumber,
          },
          {},
          storage,
        )
      ).map(row => row.id),
    ).toEqual([second.id]);
  });

  it('retires all subscriptions for one pull request', async () => {
    const { listPullRequestSubscriptions, retirePullRequestSubscriptions, subscribeToPullRequest } =
      await import('./subscriptions');
    await subscribeToPullRequest(baseInput, storage);
    await subscribeToPullRequest({ ...baseInput, pullRequestNumber: 43 }, storage);

    await retirePullRequestSubscriptions(
      {
        orgId: baseInput.orgId,
        installationId: baseInput.installationId,
        repoId: baseInput.repoId,
        pullRequestNumber: baseInput.pullRequestNumber,
      },
      storage,
    );

    expect(
      await listPullRequestSubscriptions(
        {
          orgId: baseInput.orgId,
          installationId: baseInput.installationId,
          repoId: baseInput.repoId,
          pullRequestNumber: baseInput.pullRequestNumber,
        },
        storage,
      ),
    ).toEqual([]);
    expect(storage.subscriptions).toHaveLength(1);
  });

  it('rejects cross-org project access and isolates reverse lookups', async () => {
    const { listPullRequestSubscriptions, subscribeToPullRequest } = await import('./subscriptions');
    await subscribeToPullRequest(baseInput, storage);

    await expect(subscribeToPullRequest({ ...baseInput, orgId: 'org-b' }, storage)).rejects.toThrow(
      'GitHub project not found',
    );
    expect(
      await listPullRequestSubscriptions(
        {
          orgId: 'org-b',
          installationId: baseInput.installationId,
          repoId: baseInput.repoId,
          pullRequestNumber: baseInput.pullRequestNumber,
        },
        storage,
      ),
    ).toEqual([]);
  });
});
