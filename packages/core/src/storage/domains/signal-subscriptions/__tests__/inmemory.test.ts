import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryDB } from '../../inmemory-db';
import type { StoredSignalSubscription } from '../base';
import { InMemorySignalSubscriptionsStorage } from '../inmemory';

function makeSubscription(overrides: Partial<StoredSignalSubscription> = {}): StoredSignalSubscription {
  return {
    id: overrides.id ?? 'provider:resource:thread:external',
    providerId: overrides.providerId ?? 'provider',
    threadId: overrides.threadId ?? 'thread',
    resourceId: overrides.resourceId ?? 'resource',
    externalResourceId: overrides.externalResourceId ?? 'external',
    subscribedAt: overrides.subscribedAt ?? 1,
    metadata: overrides.metadata,
  };
}

describe('InMemorySignalSubscriptionsStorage', () => {
  let storage: InMemorySignalSubscriptionsStorage;

  beforeEach(() => {
    storage = new InMemorySignalSubscriptionsStorage({ db: new InMemoryDB() });
  });

  it('upserts and isolates stored subscriptions', async () => {
    const subscription = makeSubscription({ metadata: { source: 'test' } });
    await storage.upsertSubscription(subscription);
    subscription.metadata!.source = 'mutated';

    expect(await storage.listSubscriptions({ providerId: 'provider' })).toEqual([
      makeSubscription({ metadata: { source: 'test' } }),
    ]);
  });

  it('filters subscriptions by provider, thread, resource, and external resource', async () => {
    await storage.upsertSubscription(makeSubscription({ id: 'one' }));
    await storage.upsertSubscription(
      makeSubscription({ id: 'two', threadId: 'other-thread', resourceId: 'other-resource' }),
    );
    await storage.upsertSubscription(makeSubscription({ id: 'three', providerId: 'other-provider' }));

    expect(await storage.listSubscriptions({ providerId: 'provider', resourceId: 'resource' })).toEqual([
      makeSubscription({ id: 'one' }),
    ]);
    expect(await storage.listSubscriptions({ providerId: 'provider', threadId: 'other-thread' })).toEqual([
      makeSubscription({ id: 'two', threadId: 'other-thread', resourceId: 'other-resource' }),
    ]);
  });

  it('deletes one or all matching subscriptions', async () => {
    await storage.upsertSubscription(makeSubscription({ id: 'one' }));
    await storage.upsertSubscription(makeSubscription({ id: 'two', threadId: 'other-thread' }));

    await storage.deleteSubscription('one');
    expect(await storage.listSubscriptions({ providerId: 'provider' })).toHaveLength(1);

    await storage.deleteSubscriptions({ providerId: 'provider', threadId: 'other-thread' });
    expect(await storage.listSubscriptions({ providerId: 'provider' })).toEqual([]);
  });
});
