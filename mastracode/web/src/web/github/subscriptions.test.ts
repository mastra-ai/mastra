import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { IntegrationStorage } from '../storage/domains/integrations/base';
import type { GithubSubscriptionStorage, SubscribeToPullRequestInput } from './subscriptions';

describe('GitHub signal subscription store', () => {
  let backend: LibSQLFactoryStorage;
  let storage: GithubSubscriptionStorage;
  let baseInput: SubscribeToPullRequestInput;

  beforeEach(async () => {
    backend = new LibSQLFactoryStorage({ id: 'github-subscriptions-test', url: ':memory:' });
    const integrations = backend.registerDomain(new IntegrationStorage());
    await backend.init();
    storage = integrations.forIntegration('github');
    baseInput = {
      orgId: 'org-a',
      installationExternalId: '17',
      projectId: 'project-a',
      repositoryExternalId: '99',
      repositorySlug: 'octo/hello',
      changeRequestId: '42',
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

  it('creates a subscription with repository metadata', async () => {
    const { listPullRequestSubscriptionsForThread, subscribeToPullRequest } = await import('./subscriptions');
    const created = await subscribeToPullRequest(baseInput, storage);

    expect(created.data).toMatchObject({
      projectId: 'project-a',
      repositorySlug: 'octo/hello',
      changeRequestId: '42',
    });
    expect(await listPullRequestSubscriptionsForThread(baseInput, storage)).toHaveLength(1);
  });

  it('returns the existing row for duplicate subscriptions', async () => {
    const { listPullRequestSubscriptionsForThread, subscribeToPullRequest } = await import('./subscriptions');
    const first = await subscribeToPullRequest(baseInput, storage);
    const second = await subscribeToPullRequest(baseInput, storage);

    expect(second.id).toBe(first.id);
    expect(await listPullRequestSubscriptionsForThread(baseInput, storage)).toHaveLength(1);
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
    const { listPullRequestSubscriptionsForThread, subscribeToPullRequest, unsubscribeFromPullRequest } =
      await import('./subscriptions');
    await subscribeToPullRequest(baseInput, storage);
    await unsubscribeFromPullRequest(baseInput, storage);
    await unsubscribeFromPullRequest(baseInput, storage);

    expect(await listPullRequestSubscriptionsForThread(baseInput, storage)).toEqual([]);
  });

  it('supports reverse lookup by change request and by scoped thread', async () => {
    const { listPullRequestSubscriptions, listPullRequestSubscriptionsForThread, subscribeToPullRequest } =
      await import('./subscriptions');
    await subscribeToPullRequest(baseInput, storage);
    await subscribeToPullRequest(
      { ...baseInput, sessionId: 'session-b', threadId: 'thread-b', sessionScope: '/workspace/b' },
      storage,
    );

    const forChangeRequest = await listPullRequestSubscriptions(baseInput, storage);
    const forThread = await listPullRequestSubscriptionsForThread(baseInput, storage);

    expect(forChangeRequest).toHaveLength(2);
    expect(forThread).toHaveLength(1);
    expect(forThread[0]?.sessionId).toBe('session-a');
  });

  it('supports webhook lookup and per-target retirement', async () => {
    const { listPullRequestSubscriptionsForWebhook, retirePullRequestSubscription, subscribeToPullRequest } =
      await import('./subscriptions');
    const first = await subscribeToPullRequest(baseInput, storage);
    const second = await subscribeToPullRequest(
      { ...baseInput, sessionId: 'session-c', threadId: 'thread-c' },
      storage,
    );

    expect((await listPullRequestSubscriptionsForWebhook(baseInput, {}, storage)).map(row => row.id)).toEqual([
      first.id,
      second.id,
    ]);

    await retirePullRequestSubscription(first.id, 'merged', storage);
    expect((await listPullRequestSubscriptionsForWebhook(baseInput, {}, storage)).map(row => row.id)).toEqual([
      second.id,
    ]);
    expect(await listPullRequestSubscriptionsForWebhook(baseInput, { includeTerminal: true }, storage)).toHaveLength(2);
  });

  it('retires all subscriptions for one change request', async () => {
    const { listPullRequestSubscriptions, retirePullRequestSubscriptions, subscribeToPullRequest } =
      await import('./subscriptions');
    await subscribeToPullRequest(baseInput, storage);
    await subscribeToPullRequest({ ...baseInput, changeRequestId: '43' }, storage);

    await retirePullRequestSubscriptions(baseInput, storage);

    expect(await listPullRequestSubscriptions(baseInput, storage)).toEqual([]);
    expect(await listPullRequestSubscriptions({ ...baseInput, changeRequestId: '43' }, storage)).toHaveLength(1);
  });

  it('isolates reverse lookups by organization', async () => {
    const { listPullRequestSubscriptions, subscribeToPullRequest } = await import('./subscriptions');
    await subscribeToPullRequest(baseInput, storage);

    expect(await listPullRequestSubscriptions({ ...baseInput, orgId: 'org-b' }, storage)).toEqual([]);
  });
});
