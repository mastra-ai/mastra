import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { IntegrationStorage } from '../../storage/domains/integrations/base.js';
import {
  listMergeRequestSubscriptions,
  listMergeRequestSubscriptionsForThread,
  listMergeRequestSubscriptionsForWebhook,
  mergeRequestTargetKey,
  mergeRequestUrl,
  retireMergeRequestSubscription,
  retireMergeRequestSubscriptions,
  subscribeToMergeRequest,
  unsubscribeFromMergeRequest,
} from './subscriptions.js';
import type { GitLabSubscriptionStorage, SubscribeToMergeRequestInput } from './subscriptions.js';

describe('GitLab merge-request subscription store', () => {
  let backend: LibSQLFactoryStorage;
  let storage: GitLabSubscriptionStorage;
  let baseInput: SubscribeToMergeRequestInput;

  beforeEach(async () => {
    backend = new LibSQLFactoryStorage({ id: 'gitlab-subscriptions-test', url: ':memory:' });
    const integrations = backend.registerDomain(new IntegrationStorage());
    await backend.init();
    storage = integrations.forIntegration('gitlab');
    baseInput = {
      orgId: 'org-a',
      host: 'GitLab.Example.com.',
      projectId: '101',
      projectPath: 'acme/app',
      projectRepositoryId: 'project-a',
      installationExternalId: 'direct',
      changeRequestId: '17',
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

  it('keys the target by normalized host, project id and IID and builds the browser URL', () => {
    expect(mergeRequestTargetKey(baseInput)).toBe('change-request:gitlab:gitlab.example.com:101:17');
    expect(mergeRequestUrl(baseInput.host, '/acme/app/', 17)).toBe(
      'https://gitlab.example.com/acme/app/-/merge_requests/17',
    );
  });

  it('creates a subscription with project metadata and a normalized host', async () => {
    const created = await subscribeToMergeRequest(baseInput, storage);

    expect(created.status).toBe('open');
    expect(created.data).toMatchObject({
      host: 'gitlab.example.com',
      projectId: '101',
      projectPath: 'acme/app',
      projectRepositoryId: 'project-a',
      installationExternalId: 'direct',
      changeRequestId: '17',
      source: 'explicit-tool',
      subscribedByUserId: 'user-a',
    });
    expect(await listMergeRequestSubscriptionsForThread(baseInput, storage)).toHaveLength(1);
  });

  it('answers a user session that addresses itself by its own id', async () => {
    await subscribeToMergeRequest(
      {
        ...baseInput,
        resourceId: 'factory-project',
        sessionId: 'session-u',
        threadId: 'session-u',
        sessionScope: undefined,
      },
      storage,
    );
    const rows = await listMergeRequestSubscriptionsForThread(
      { orgId: 'org-a', resourceId: 'session-u', threadId: 'session-u' },
      storage,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sessionId: 'session-u', resourceId: 'factory-project' });
    expect(
      await listMergeRequestSubscriptionsForThread(
        { orgId: 'org-b', resourceId: 'session-u', threadId: 'session-u' },
        storage,
      ),
    ).toEqual([]);
    expect(
      await listMergeRequestSubscriptionsForThread(
        { orgId: 'org-a', resourceId: 'session-u', threadId: 'session-u', sessionScope: '/x' },
        storage,
      ),
    ).toEqual([]);
  });

  it('returns the existing row for duplicate subscriptions and reactivates a retired one', async () => {
    const first = await subscribeToMergeRequest(baseInput, storage);
    const second = await subscribeToMergeRequest(baseInput, storage);
    expect(second.id).toBe(first.id);

    await retireMergeRequestSubscription(first.id, 'merged', storage);
    expect(await listMergeRequestSubscriptions(baseInput, storage)).toHaveLength(0);
    const third = await subscribeToMergeRequest(baseInput, storage);
    expect(third.id).toBe(first.id);
    expect(third.status).toBe('open');
    expect(await listMergeRequestSubscriptions(baseInput, storage)).toHaveLength(1);
  });

  it('separates sessions by scope and only removes the matching one', async () => {
    await subscribeToMergeRequest(baseInput, storage);
    await subscribeToMergeRequest({ ...baseInput, sessionScope: '/workspace/b' }, storage);
    expect(await listMergeRequestSubscriptions(baseInput, storage)).toHaveLength(2);

    await unsubscribeFromMergeRequest(baseInput, storage);
    const remaining = await listMergeRequestSubscriptions(baseInput, storage);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.sessionScope).toBe('/workspace/b');
    expect(await listMergeRequestSubscriptionsForThread(baseInput, storage)).toHaveLength(0);
  });

  it('lists only open rows for webhook fan-out unless terminal rows are requested', async () => {
    const open = await subscribeToMergeRequest(baseInput, storage);
    const closed = await subscribeToMergeRequest({ ...baseInput, sessionScope: '/workspace/b' }, storage);
    await retireMergeRequestSubscription(closed.id, 'closed', storage);

    const target = { host: 'gitlab.example.com', projectId: '101', changeRequestId: '17' };
    expect((await listMergeRequestSubscriptionsForWebhook(target, undefined, storage)).map(row => row.id)).toEqual([
      open.id,
    ]);
    expect(await listMergeRequestSubscriptionsForWebhook(target, { includeTerminal: true }, storage)).toHaveLength(2);
  });

  it('retires every open subscription for a merge request the sweep found merged', async () => {
    await subscribeToMergeRequest(baseInput, storage);
    await subscribeToMergeRequest({ ...baseInput, sessionScope: '/workspace/b' }, storage);
    await subscribeToMergeRequest({ ...baseInput, changeRequestId: '18' }, storage);

    await retireMergeRequestSubscriptions(
      { host: 'gitlab.example.com', projectId: '101', changeRequestId: '17', merged: true },
      storage,
    );

    const rows = await storage.subscriptions.listByTarget(mergeRequestTargetKey(baseInput));
    expect(rows.map(row => row.status)).toEqual(['merged', 'merged']);
    expect(await listMergeRequestSubscriptions({ ...baseInput, changeRequestId: '18' }, storage)).toHaveLength(1);
  });
});
