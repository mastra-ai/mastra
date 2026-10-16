import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { IntegrationStorage } from '../../storage/domains/integrations/base.js';
import type { GithubSubscriptionStorage, SubscribeToPullRequestInput } from './subscriptions.js';

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
      projectRepositoryId: 'project-a',
      repositoryExternalId: '99',
      repositorySlug: 'octo/hello',
      changeRequestId: '42',
      sessionId: 'session-a',
      ownerId: 'user-a',
      resourceId: 'resource-a',
      threadId: 'thread-a',
      source: 'explicit-tool',
      subscribedByUserId: 'user-a',
    };
  });

  afterEach(async () => {
    await backend.close();
  });

  it('creates a subscription with repository metadata', async () => {
    const { listPullRequestSubscriptionsForThread, subscribeToPullRequest } = await import('./subscriptions.js');
    const created = await subscribeToPullRequest(baseInput, storage);

    expect(created.data).toMatchObject({
      projectRepositoryId: 'project-a',
      repositorySlug: 'octo/hello',
      changeRequestId: '42',
    });
    expect(await listPullRequestSubscriptionsForThread(baseInput, storage)).toHaveLength(1);
  });

  it('answers a user session that addresses itself by its own id', async () => {
    const { listPullRequestSubscriptionsForThread, subscribeToPullRequest } = await import('./subscriptions.js');
    // User sessions record the Factory project as resourceId, but the chat
    // surface addresses them as (sessionId, sessionId).
    await subscribeToPullRequest(
      { ...baseInput, resourceId: 'factory-project', sessionId: 'session-u', threadId: 'session-u' },
      storage,
    );
    const rows = await listPullRequestSubscriptionsForThread(
      { orgId: 'org-a', resourceId: 'session-u', threadId: 'session-u' },
      storage,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sessionId: 'session-u', resourceId: 'factory-project' });
    // A different org or thread never reaches the fallback.
    expect(
      await listPullRequestSubscriptionsForThread(
        { orgId: 'org-b', resourceId: 'session-u', threadId: 'session-u' },
        storage,
      ),
    ).toEqual([]);
    expect(
      await listPullRequestSubscriptionsForThread(
        { orgId: 'org-a', resourceId: 'session-u', threadId: 'other' },
        storage,
      ),
    ).toEqual([]);
  });

  it('ignores the scope stored on rows written before sessions dropped scopes', async () => {
    const { listPullRequestSubscriptionsForThread, subscribeToPullRequest, unsubscribeFromPullRequest } =
      await import('./subscriptions.js');
    const legacy = await subscribeToPullRequest(baseInput, storage);
    await storage.subscriptions.delete(legacy.id);
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...row } = legacy;
    const stored = await storage.subscriptions.create({ ...row, sessionScope: '/workspace/a' });
    expect(stored.sessionScope).toBe('/workspace/a');

    expect((await listPullRequestSubscriptionsForThread(baseInput, storage)).map(r => r.id)).toEqual([stored.id]);
    // Subscribing again resolves to the legacy row instead of adding a second one.
    expect((await subscribeToPullRequest(baseInput, storage)).id).toBe(stored.id);
    await unsubscribeFromPullRequest(baseInput, storage);
    expect(await listPullRequestSubscriptionsForThread(baseInput, storage)).toEqual([]);
  });

  it('returns the existing row for duplicate subscriptions', async () => {
    const { listPullRequestSubscriptionsForThread, subscribeToPullRequest } = await import('./subscriptions.js');
    const first = await subscribeToPullRequest(baseInput, storage);
    const second = await subscribeToPullRequest(baseInput, storage);

    expect(second.id).toBe(first.id);
    expect(await listPullRequestSubscriptionsForThread(baseInput, storage)).toHaveLength(1);
  });

  it('reactivates a retained terminal subscription when subscribing again', async () => {
    const { retirePullRequestSubscription, subscribeToPullRequest } = await import('./subscriptions.js');
    const first = await subscribeToPullRequest(baseInput, storage);
    await retirePullRequestSubscription(first.id, 'closed', storage);

    const reactivated = await subscribeToPullRequest(baseInput, storage);

    expect(reactivated.id).toBe(first.id);
    expect(reactivated.status).toBe('open');
  });

  it('unsubscribes idempotently', async () => {
    const { listPullRequestSubscriptionsForThread, subscribeToPullRequest, unsubscribeFromPullRequest } =
      await import('./subscriptions.js');
    await subscribeToPullRequest(baseInput, storage);
    await unsubscribeFromPullRequest(baseInput, storage);
    await unsubscribeFromPullRequest(baseInput, storage);

    expect(await listPullRequestSubscriptionsForThread(baseInput, storage)).toEqual([]);
  });

  it('supports reverse lookup by change request and by thread', async () => {
    const { listPullRequestSubscriptions, listPullRequestSubscriptionsForThread, subscribeToPullRequest } =
      await import('./subscriptions.js');
    await subscribeToPullRequest(baseInput, storage);
    await subscribeToPullRequest(
      { ...baseInput, sessionId: 'session-b', threadId: 'thread-b' },
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
      await import('./subscriptions.js');
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
      await import('./subscriptions.js');
    await subscribeToPullRequest(baseInput, storage);
    await subscribeToPullRequest({ ...baseInput, changeRequestId: '43' }, storage);

    await retirePullRequestSubscriptions(baseInput, storage);

    expect(await listPullRequestSubscriptions(baseInput, storage)).toEqual([]);
    expect(await listPullRequestSubscriptions({ ...baseInput, changeRequestId: '43' }, storage)).toHaveLength(1);
  });

  it('isolates reverse lookups by organization', async () => {
    const { listPullRequestSubscriptions, subscribeToPullRequest } = await import('./subscriptions.js');
    await subscribeToPullRequest(baseInput, storage);

    expect(await listPullRequestSubscriptions({ ...baseInput, orgId: 'org-b' }, storage)).toEqual([]);
  });
});
