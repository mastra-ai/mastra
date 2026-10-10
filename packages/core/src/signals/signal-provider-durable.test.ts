import { describe, expect, it, vi } from 'vitest';

import { MastraError } from '../error';
import { InMemorySignalSubscriptionsStorage } from '../storage/domains/signal-subscriptions';
import type { SignalSubscriptionsStorage } from '../storage/domains/signal-subscriptions';
import { InMemoryStore } from '../storage/mock';
import type { DurableSubscriptionScope } from './durable-subscription-scope';
import { SignalProvider } from './signal-provider';
import type { SignalProviderTarget } from './signal-provider';

class DurableProvider extends SignalProvider {
  readonly id: string;

  constructor(id = 'durable-test') {
    super();
    this.id = id;
  }

  subscribeD(target: SignalProviderTarget, externalResourceId: string, metadata?: Record<string, unknown>) {
    return this.subscribeDurable(target, externalResourceId, metadata);
  }
  subscribeWithOptions(target: SignalProviderTarget, externalResourceId: string, options: Record<string, unknown>) {
    return this.subscribeDurable(target, externalResourceId, {}, options);
  }
  unsubscribeD(target: SignalProviderTarget, externalResourceId: string) {
    return this.unsubscribeDurable(target, externalResourceId);
  }
  listD() {
    return this.getDurableSubscriptions();
  }
  forResourceD(externalResourceId: string) {
    return this.getDurableSubscriptionsForResource(externalResourceId);
  }
  hasD(target: SignalProviderTarget, externalResourceId: string) {
    return this.hasDurableSubscription(target, externalResourceId);
  }
  unsubscribeAllD(target?: SignalProviderTarget) {
    return this.unsubscribeAllDurable(target);
  }
  setEnabledD(id: string, enabled: boolean, fence?: { key: string; fencingToken: string }) {
    return this.setDurableSubscriptionEnabled(id, enabled, fence);
  }
  withStore<T>(callback: (scope: DurableSubscriptionScope) => Promise<T>) {
    return this.withDurableSubscriptionStore(callback);
  }
  withOptionalStore<T>(callback: (scope: DurableSubscriptionScope) => Promise<T>) {
    return this.withConfiguredDurableSubscriptionStore(callback);
  }

  // Sync API passthroughs for the "sync unaffected" check.
  subscribeSync(target: SignalProviderTarget, externalResourceId: string) {
    return this.subscribe(target, externalResourceId);
  }
  get syncCount() {
    return this.subscriptionCount;
  }
}

const target: SignalProviderTarget = { resourceId: 'resource-1', threadId: 'thread-1' };

function connected(agentId = 'agent-a', providerId?: string) {
  const provider = new DurableProvider(providerId);
  provider.connect({ id: agentId } as any);
  return provider;
}

function mastraWith(storage: object) {
  return { getStorage: () => storage } as any;
}

function mastraWithDomain(domain: SignalSubscriptionsStorage) {
  const getStore = vi.fn(async (name: string) => (name === 'signalSubscriptions' ? domain : undefined));
  return { mastra: mastraWith({ getStore }), getStore };
}

describe('SignalProvider durable subscriptions', () => {
  describe('without Mastra', () => {
    it('uses a provider-local store and leaves the sync registry untouched', async () => {
      const provider = connected();
      const created = await provider.subscribeD(target, 'ext-1', { a: 1 });
      expect(created).toMatchObject({
        agentId: 'agent-a',
        providerId: 'durable-test',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        externalResourceId: 'ext-1',
        metadata: { a: 1 },
        enabled: true,
      });
      const merged = await provider.subscribeD(target, 'ext-1', { b: 2 });
      expect(merged.id).toBe(created.id);
      expect(merged.metadata).toEqual({ a: 1, b: 2 });

      expect(await provider.hasD(target, 'ext-1')).toBe(true);
      expect((await provider.listD()).map(row => row.id)).toEqual([created.id]);
      expect((await provider.forResourceD('ext-1')).map(row => row.id)).toEqual([created.id]);
      expect(await provider.withStore(async scope => scope.durability)).toBe('process');
      expect(provider.syncCount).toBe(0);

      provider.subscribeSync(target, 'sync-only');
      expect(provider.syncCount).toBe(1);
      expect((await provider.listD()).map(row => row.externalResourceId)).toEqual(['ext-1']);

      expect(await provider.unsubscribeD(target, 'ext-1')).toBe(true);
      expect(await provider.unsubscribeD(target, 'ext-1')).toBe(false);
      expect(await provider.hasD(target, 'ext-1')).toBe(false);
      expect(provider.syncCount).toBe(1);
    });

    it('stores delivery options and treats disabled rows as inactive', async () => {
      const provider = connected();
      const row = await provider.subscribeWithOptions(target, 'ext-1', { ifIdle: true });
      expect(row.deliveryOptions).toEqual({ ifIdle: true });

      expect((await provider.setEnabledD(row.id, false))?.enabled).toBe(false);
      expect(await provider.hasD(target, 'ext-1')).toBe(false);
      expect(await provider.listD()).toEqual([]);
      expect(await provider.forResourceD('ext-1')).toEqual([]);
      expect((await provider.setEnabledD(row.id, true))?.enabled).toBe(true);
      expect(await provider.setEnabledD('missing', true)).toBeNull();
    });

    it('removes one thread or every thread with unsubscribeAllDurable', async () => {
      const provider = connected();
      const other = { resourceId: 'resource-1', threadId: 'thread-2' };
      await provider.subscribeD(target, 'ext-1');
      await provider.subscribeD(target, 'ext-2');
      await provider.subscribeD(other, 'ext-1');
      expect(await provider.unsubscribeAllD(target)).toBe(2);
      expect((await provider.listD()).map(row => row.threadId)).toEqual(['thread-2']);
      expect(await provider.unsubscribeAllD()).toBe(1);
      expect(await provider.listD()).toEqual([]);
    });

    it('does not change stop(): it stays synchronous and keeps durable rows', async () => {
      const provider = connected();
      await provider.subscribeD(target, 'ext-1');
      provider.subscribeSync(target, 'sync');
      expect(provider.stop()).toBeUndefined();
      expect(provider.syncCount).toBe(0);
      expect(await provider.hasD(target, 'ext-1')).toBe(true);
    });
  });

  describe('subscription ids', () => {
    it('always generates subscription ids, even if a caller passes one', async () => {
      const provider = connected();
      const [upserted, staged] = await provider.withStore(async scope => [
        // @ts-expect-error -- the scope does not accept caller-chosen ids
        await scope.upsertSubscription({ ...target, externalResourceId: 'ext-1', id: 'chosen-1' }),
        await scope.insertSubscribingSubscription({
          ...target,
          externalResourceId: 'ext-2',
          // @ts-expect-error -- the scope does not accept caller-chosen ids
          id: 'chosen-2',
          owner: 'op',
          ttlMs: 60_000,
        }),
      ]);
      expect(upserted.id).not.toBe('chosen-1');
      expect(staged!.id).not.toBe('chosen-2');
      expect(await provider.withStore(scope => scope.getSubscriptionById({ id: 'chosen-1' }))).toBeNull();
    });
  });

  describe('scope lifetime', () => {
    it('rejects a scope used after its callback settled', async () => {
      const provider = connected();
      let retained: DurableSubscriptionScope | undefined;
      await provider.withStore(async scope => {
        retained = scope;
        await scope.countSubscriptions();
      });
      await expect(async () => retained!.countSubscriptions()).rejects.toMatchObject({
        id: 'SIGNAL_PROVIDER_DURABLE_SCOPE_EXPIRED',
      });
      await expect(retained!.claimCoordinationLock({ key: 'k', owner: 'o', ttlMs: 1_000 })).rejects.toThrow(
        MastraError,
      );
    });

    it('invalidates the scope when the callback throws', async () => {
      const provider = connected();
      let retained: DurableSubscriptionScope | undefined;
      await expect(
        provider.withStore(async scope => {
          retained = scope;
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      await expect(async () => retained!.listSubscriptions()).rejects.toMatchObject({
        id: 'SIGNAL_PROVIDER_DURABLE_SCOPE_EXPIRED',
      });
    });

    it('resolves the store once per callback, however many scope calls run inside it', async () => {
      const domain = new InMemorySignalSubscriptionsStorage();
      const { mastra, getStore } = mastraWithDomain(domain);
      const provider = connected();
      provider.__registerMastra(mastra);
      expect(getStore).not.toHaveBeenCalled();

      await provider.withStore(async scope => {
        const row = await scope.upsertSubscription({ resourceId: 'r', threadId: 't', externalResourceId: 'x' });
        await scope.updateSubscription({ id: row.id, patch: { cursor: { at: 1 } } });
        await scope.listSubscriptions();
        await scope.claimSubscription({ id: row.id, owner: 'o', ttlMs: 1_000, cadenceMs: 1_000 });
      });
      expect(getStore).toHaveBeenCalledTimes(1);
      expect(getStore).toHaveBeenCalledWith('signalSubscriptions');
    });
  });

  describe('with Mastra storage', () => {
    it('reads and writes the attached domain, visible to a second provider on the same store', async () => {
      const storage = new InMemoryStore();
      const first = connected();
      const second = connected();
      first.__registerMastra(mastraWith(storage));
      second.__registerMastra(mastraWith(storage));

      const created = await first.subscribeD(target, 'ext-1', { from: 'first' });
      expect(await second.hasD(target, 'ext-1')).toBe(true);
      expect((await second.forResourceD('ext-1')).map(row => row.id)).toEqual([created.id]);
      const domain = await storage.getStore('signalSubscriptions');
      expect(
        await domain!.getSubscriptionById({ agentId: 'agent-a', providerId: created.providerId, id: created.id }),
      ).toMatchObject({
        metadata: { from: 'first' },
      });

      expect(await second.unsubscribeD(target, 'ext-1')).toBe(true);
      expect(await first.listD()).toEqual([]);
    });

    it('resolves the store lazily on every call instead of caching it', async () => {
      const provider = connected();
      const before = new InMemorySignalSubscriptionsStorage();
      const after = new InMemorySignalSubscriptionsStorage();
      let current: SignalSubscriptionsStorage = before;
      provider.__registerMastra(mastraWith({ getStore: async () => current }));
      await provider.subscribeD(target, 'ext-1');
      current = after;
      expect(await provider.hasD(target, 'ext-1')).toBe(false);
      expect(await before.countSubscriptions({ agentId: 'agent-a' })).toBe(1);
    });

    it('fails loudly on attached storage without the domain and never falls back to process memory', async () => {
      const provider = connected();
      provider.__registerMastra(mastraWith({ getStore: async () => undefined }));
      const localWrites = vi.spyOn(InMemorySignalSubscriptionsStorage.prototype, 'upsertSubscription');
      const localReads = vi.spyOn(InMemorySignalSubscriptionsStorage.prototype, 'listSubscriptions');

      const callback = vi.fn(async () => 'ran');
      expect(await provider.withOptionalStore(callback)).toBeUndefined();
      expect(callback).not.toHaveBeenCalled();

      const unsupported = { id: 'SIGNAL_PROVIDER_DURABLE_STORAGE_UNSUPPORTED' };
      await expect(provider.subscribeD(target, 'ext-1')).rejects.toMatchObject(unsupported);
      await expect(provider.unsubscribeD(target, 'ext-1')).rejects.toMatchObject(unsupported);
      await expect(provider.listD()).rejects.toMatchObject(unsupported);
      await expect(provider.forResourceD('ext-1')).rejects.toMatchObject(unsupported);
      await expect(provider.hasD(target, 'ext-1')).rejects.toMatchObject(unsupported);
      await expect(provider.unsubscribeAllD()).rejects.toMatchObject(unsupported);
      await expect(provider.setEnabledD('id', true)).rejects.toMatchObject(unsupported);
      await expect(provider.withStore(callback)).rejects.toBeInstanceOf(MastraError);
      expect(callback).not.toHaveBeenCalled();

      // Nothing fell back to a provider-local store.
      expect(localWrites).not.toHaveBeenCalled();
      expect(localReads).not.toHaveBeenCalled();
      localWrites.mockRestore();
      localReads.mockRestore();
    });

    it('fails when Mastra has no storage at all', async () => {
      const provider = connected();
      provider.__registerMastra({ getStorage: () => undefined } as any);
      await expect(provider.subscribeD(target, 'ext-1')).rejects.toMatchObject({
        id: 'SIGNAL_PROVIDER_DURABLE_STORAGE_UNSUPPORTED',
      });
    });
  });

  describe('agent scoping', () => {
    it('throws before connect() instead of writing under a placeholder agent id', async () => {
      const provider = new DurableProvider();
      const notConnected = { id: 'SIGNAL_PROVIDER_NOT_CONNECTED' };
      await expect(provider.subscribeD(target, 'ext-1')).rejects.toMatchObject(notConnected);
      await expect(provider.listD()).rejects.toMatchObject(notConnected);
      await expect(provider.withStore(scope => scope.countSubscriptions())).rejects.toMatchObject(notConnected);
      provider.connect({ id: 'agent-a' } as any);
      expect(await provider.listD()).toEqual([]);
    });

    it('isolates agents, providers, and resources sharing one store', async () => {
      const storage = new InMemoryStore();
      const agentA = connected('agent-a');
      const agentB = connected('agent-b');
      const otherProvider = connected('agent-a', 'other-provider');
      for (const provider of [agentA, agentB, otherProvider]) provider.__registerMastra(mastraWith(storage));

      const a1 = await agentA.subscribeD(target, 'shared');
      const a2 = await agentA.subscribeD({ resourceId: 'resource-2', threadId: 'thread-1' }, 'shared');
      const b1 = await agentB.subscribeD(target, 'shared');
      await otherProvider.subscribeD(target, 'shared');

      expect(new Set([a1.id, a2.id, b1.id]).size).toBe(3);
      expect((await agentA.forResourceD('shared')).map(row => row.id).sort()).toEqual([a1.id, a2.id].sort());
      expect((await agentB.forResourceD('shared')).map(row => row.id)).toEqual([b1.id]);
      expect((await otherProvider.listD()).map(row => row.providerId)).toEqual(['other-provider']);
      expect(await agentA.hasD({ resourceId: 'resource-2', threadId: 'thread-1' }, 'shared')).toBe(true);
      expect(await agentB.hasD({ resourceId: 'resource-2', threadId: 'thread-1' }, 'shared')).toBe(false);

      // Row-id operations cannot reach another agent's or provider's rows.
      expect(await agentB.setEnabledD(a1.id, false)).toBeNull();
      expect(await otherProvider.setEnabledD(a1.id, false)).toBeNull();
      expect(await otherProvider.withStore(scope => scope.deleteSubscription({ id: a1.id }))).toBe(false);
      expect(
        await otherProvider.withStore(scope =>
          scope.claimSubscription({ id: a1.id, owner: 'o', ttlMs: 1_000, cadenceMs: 1_000 }),
        ),
      ).toBeNull();
      expect(await agentB.withStore(scope => scope.getSubscriptionById({ id: a1.id }))).toBeNull();
      expect(await otherProvider.withStore(scope => scope.getSubscriptionById({ id: a1.id }))).toBeNull();
      expect(await agentA.withStore(scope => scope.getSubscriptionById({ id: a1.id }))).toMatchObject({
        enabled: true,
      });

      expect(await agentA.unsubscribeAllD(target)).toBe(1);
      expect(await agentB.hasD(target, 'shared')).toBe(true);
      expect(await otherProvider.hasD(target, 'shared')).toBe(true);
      expect(await agentA.unsubscribeAllD()).toBe(1);
      expect(await agentB.listD()).toHaveLength(1);
      expect(await otherProvider.listD()).toHaveLength(1);
    });
  });

  describe('owner-sensitive helpers', () => {
    it('enforce the explicit owner on claims, leases, operations, and deliveries', async () => {
      const provider = connected();
      await provider.withStore(async scope => {
        const row = await scope.upsertSubscription({ resourceId: 'r', threadId: 't', externalResourceId: 'x' });
        const ref = { id: row.id };

        expect(await scope.claimSubscription({ ...ref, owner: 'a', ttlMs: 60_000, cadenceMs: 60_000 })).not.toBeNull();
        expect(await scope.renewSubscriptionClaimIfEnabled({ ...ref, owner: 'b', ttlMs: 60_000 })).toBe(false);
        expect(await scope.validateSubscriptionClaimIfEnabled({ ...ref, owner: 'b' })).toBe(false);
        expect(await scope.releaseSubscriptionClaim({ ...ref, owner: 'b' })).toBe(false);
        expect(await scope.renewSubscriptionClaimIfEnabled({ ...ref, owner: 'a', ttlMs: 60_000 })).toBe(true);
        expect(await scope.releaseSubscriptionClaim({ ...ref, owner: 'a' })).toBe(true);

        await scope.beginSubscriptionOperation({ ...ref, kind: 'unsubscribe', owner: 'op', ttlMs: 60_000 });
        expect(await scope.renewSubscriptionOperation({ ...ref, owner: 'other', ttlMs: 60_000 })).toBe(false);
        expect(await scope.abortSubscriptionOperation({ ...ref, owner: 'other' })).toBe(false);
        expect(await scope.commitUnsubscribe({ ...ref, owner: 'other' })).toBe(false);
        expect(await scope.abortSubscriptionOperation({ ...ref, owner: 'op' })).toBe(true);

        const delivery = { subscriptionId: row.id, deliveryId: 'd' };
        expect(await scope.claimDelivery({ ...delivery, owner: 'a', ttlMs: 60_000 })).toBe('claimed');
        expect(await scope.claimDelivery({ ...delivery, owner: 'b', ttlMs: 60_000 })).toBe('in-progress');
        expect(await scope.renewDeliveryClaim({ ...delivery, owner: 'b', ttlMs: 60_000 })).toBe(false);
        expect(await scope.completeDelivery({ ...delivery, owner: 'b' })).toBe(false);
        expect(await scope.releaseDelivery({ ...delivery, owner: 'b' })).toBe(false);
        expect(await scope.completeDelivery({ ...delivery, owner: 'a' })).toBe(true);
        expect(await scope.claimDelivery({ ...delivery, owner: 'b', ttlMs: 60_000 })).toBe('delivered');

        expect(await scope.claimCoordinationLock({ key: 'k', owner: 'a', ttlMs: 60_000 })).toBe(true);
        expect(await scope.renewCoordinationLock({ key: 'k', owner: 'b', ttlMs: 60_000 })).toBe(false);
        expect(await scope.releaseCoordinationLock({ key: 'k', owner: 'b' })).toBe(false);
        expect(await scope.releaseCoordinationLock({ key: 'k', owner: 'a' })).toBe(true);
      });
    });

    it('rejects enabling an owned document row without its fence', async () => {
      const provider = connected();
      const { row, fence } = await provider.withStore(async scope => {
        const owner = (await scope.claimDocumentOwner({ key: 'doc', resourceId: 'r', threadId: 't' }))!;
        const fence = { key: 'doc', fencingToken: owner.fencingToken };
        const row = await scope.upsertSubscription({ resourceId: 'r', threadId: 't', externalResourceId: 'x' }, fence);
        expect((await scope.listDocumentOwners()).owners.map(o => o.key)).toEqual(['doc']);
        return { row, fence };
      });
      await expect(provider.setEnabledD(row.id, false)).rejects.toMatchObject({
        id: 'STORAGE_SIGNAL_SUBSCRIPTIONS_FENCE_REJECTED',
      });
      await expect(provider.setEnabledD(row.id, false, { key: 'doc', fencingToken: 'stale' })).rejects.toMatchObject({
        id: 'STORAGE_SIGNAL_SUBSCRIPTIONS_FENCE_REJECTED',
      });
      expect((await provider.setEnabledD(row.id, false, fence))?.enabled).toBe(false);
    });
  });
});
