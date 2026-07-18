import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GithubStorageOps } from './storage/ops';
import type { SubscribeToPullRequestInput } from './storage/base';

const projectInput = {
  orgId: 'org-a',
  userId: 'user-a',
  installationId: 17,
  repoFullName: 'octo/hello',
  repoId: 99,
  defaultBranch: 'main',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/a',
};

describe('GitHub signal subscription store', () => {
  let backend: LibSQLFactoryStorage;
  let storage: GithubStorageOps;
  let baseInput: SubscribeToPullRequestInput;

  beforeEach(async () => {
    backend = new LibSQLFactoryStorage({ id: 'github-subscriptions-test', url: ':memory:' });
    await backend.init();
    storage = new GithubStorageOps();
    await storage.init({ storage: backend });
    const project = await storage.upsertProject(projectInput);
    baseInput = {
      orgId: 'org-a',
      installationId: 17,
      githubProjectId: project.id,
      repoId: 99,
      pullRequestNumber: 42,
      sessionId: 'session-a',
      ownerId: 'user-a',
      resourceId: 'resource-a',
      threadId: 'thread-a',
      sessionScope: '/workspace/a',
      source: 'explicit-tool',
      subscribedByUserId: 'user-a',
    };
  });

  afterEach(async () => {
    await backend.close();
  });

  it('creates a subscription with project-owned repository metadata', async () => {
    const { subscribeToPullRequest } = await import('./subscriptions');
    const created = await subscribeToPullRequest(baseInput, storage);

    expect(created).toMatchObject({ ...baseInput, repoFullName: 'octo/hello' });
    expect(await storage.listPullRequestSubscriptionsForThread(baseInput)).toHaveLength(1);
  });

  it('returns the existing row for duplicate subscriptions', async () => {
    const { subscribeToPullRequest } = await import('./subscriptions');
    const first = await subscribeToPullRequest(baseInput, storage);
    const second = await subscribeToPullRequest(baseInput, storage);

    expect(second.id).toBe(first.id);
    expect(await storage.listPullRequestSubscriptionsForThread(baseInput)).toHaveLength(1);
  });

  it('reactivates a retained terminal subscription when subscribing again', async () => {
    const { retirePullRequestSubscription, subscribeToPullRequest } = await import('./subscriptions');
    const first = await subscribeToPullRequest(baseInput, storage);
    await retirePullRequestSubscription(first.id, 'closed', storage);

    const reactivated = await subscribeToPullRequest(baseInput, storage);

    expect(reactivated.id).toBe(first.id);
    expect(reactivated.status).toBe('open');
  });

  it('unsubscribes idempotently', async () => {
    const { subscribeToPullRequest, unsubscribeFromPullRequest } = await import('./subscriptions');
    await subscribeToPullRequest(baseInput, storage);
    await unsubscribeFromPullRequest(baseInput, storage);
    await unsubscribeFromPullRequest(baseInput, storage);

    expect(await storage.listPullRequestSubscriptionsForThread(baseInput)).toEqual([]);
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

    const target = {
      installationId: baseInput.installationId,
      repoId: baseInput.repoId,
      pullRequestNumber: baseInput.pullRequestNumber,
    };
    expect((await listPullRequestSubscriptionsForWebhook(target, {}, storage)).map(row => row.id)).toEqual([
      first.id,
      second.id,
    ]);

    await retirePullRequestSubscription(first.id, 'merged', storage);
    expect((await listPullRequestSubscriptionsForWebhook(target, {}, storage)).map(row => row.id)).toEqual([second.id]);
    expect(await listPullRequestSubscriptionsForWebhook(target, { includeTerminal: true }, storage)).toHaveLength(2);
  });

  it('retires all subscriptions for one pull request', async () => {
    const { listPullRequestSubscriptions, retirePullRequestSubscriptions, subscribeToPullRequest } =
      await import('./subscriptions');
    await subscribeToPullRequest(baseInput, storage);
    await subscribeToPullRequest({ ...baseInput, pullRequestNumber: 43 }, storage);

    const target = {
      orgId: baseInput.orgId,
      installationId: baseInput.installationId,
      repoId: baseInput.repoId,
      pullRequestNumber: baseInput.pullRequestNumber,
    };
    await retirePullRequestSubscriptions(target, storage);

    expect(await listPullRequestSubscriptions(target, storage)).toEqual([]);
    expect(await listPullRequestSubscriptions({ ...target, pullRequestNumber: 43 }, storage)).toHaveLength(1);
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
