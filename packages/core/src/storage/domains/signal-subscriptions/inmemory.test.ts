import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryStore } from '../../mock';
import type { SignalSubscriptionDocumentFence, SignalSubscriptionIdentity } from './base';
import { SignalSubscriptionFenceError } from './base';
import { InMemorySignalSubscriptionsStorage } from './inmemory';

const TTL = 1_000;
const CADENCE = 5_000;

function identity(overrides: Partial<SignalSubscriptionIdentity> = {}): SignalSubscriptionIdentity {
  return {
    agentId: 'agent-a',
    providerId: 'webhook-signals',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    externalResourceId: 'ext-1',
    ...overrides,
  };
}

describe('InMemorySignalSubscriptionsStorage', () => {
  let now: number;
  let store: InMemorySignalSubscriptionsStorage;

  beforeEach(() => {
    now = 1_000_000;
    store = new InMemorySignalSubscriptionsStorage({ now: () => now });
  });

  describe('durability', () => {
    it("defaults to 'process'", () => {
      expect(new InMemorySignalSubscriptionsStorage().durability).toBe('process');
    });

    it("reports 'persistent' when the test-double option is supplied", () => {
      expect(new InMemorySignalSubscriptionsStorage({ durability: 'persistent' }).durability).toBe('persistent');
    });

    it('is wired into the default InMemoryStore', async () => {
      const domain = await new InMemoryStore().getStore('signalSubscriptions');
      expect(domain).toBeInstanceOf(InMemorySignalSubscriptionsStorage);
      expect(domain?.durability).toBe('process');
    });
  });

  describe('identity and upsert', () => {
    it('scopes identity by all five parts', async () => {
      const base = await store.upsertSubscription(identity());
      const variants = [
        identity({ agentId: 'agent-b' }),
        identity({ providerId: 'other' }),
        identity({ resourceId: 'resource-2' }),
        identity({ threadId: 'thread-2' }),
        identity({ externalResourceId: 'ext-2' }),
      ];
      const ids = new Set([base.id]);
      for (const variant of variants) ids.add((await store.upsertSubscription(variant)).id);
      expect(ids.size).toBe(6);
      expect(await store.getSubscriptionByIdentity(identity({ agentId: 'agent-b' }))).toMatchObject({
        agentId: 'agent-b',
      });
      expect(await store.getSubscriptionById({ agentId: 'agent-b', id: base.id })).toBeNull();
      expect(await store.listSubscriptions({ agentId: 'agent-a' })).toMatchObject({ total: 5 });
    });

    it('merges metadata, replaces delivery options only when supplied, and honors explicit enabled', async () => {
      const created = await store.upsertSubscription({
        ...identity(),
        metadata: { a: 1, b: 1 },
        deliveryOptions: { ifIdle: true },
      });
      expect(created.enabled).toBe(true);
      await store.claimSubscription({ agentId: 'agent-a', id: created.id, owner: 'o', ttlMs: TTL, cadenceMs: CADENCE });
      await store.updateSubscription({ agentId: 'agent-a', id: created.id, patch: { cursor: { page: 2 } } });

      now += 10;
      const merged = await store.upsertSubscription({ ...identity(), id: 'ignored', metadata: { b: 2, c: 3 } });
      expect(merged).toMatchObject({
        id: created.id,
        metadata: { a: 1, b: 2, c: 3 },
        deliveryOptions: { ifIdle: true },
        enabled: true,
        claimOwner: 'o',
        cursor: { page: 2 },
        nextPollAt: new Date(1_000_000 + CADENCE),
      });
      expect(merged.createdAt).toEqual(created.createdAt);
      expect(merged.updatedAt.getTime()).toBe(now);

      const disabled = await store.upsertSubscription({ ...identity(), deliveryOptions: {}, enabled: false });
      expect(disabled).toMatchObject({ deliveryOptions: {}, enabled: false });
      expect((await store.upsertSubscription(identity())).enabled).toBe(false);
      expect((await store.upsertSubscription({ ...identity(), enabled: true })).enabled).toBe(true);
    });

    it('preserves a live membership operation across upsert', async () => {
      const row = await store.upsertSubscription(identity());
      await store.beginSubscriptionOperation({
        agentId: 'agent-a',
        id: row.id,
        kind: 'unsubscribe',
        owner: 'op',
        ttlMs: TTL,
      });
      const after = await store.upsertSubscription({ ...identity(), metadata: { x: 1 } });
      expect(after).toMatchObject({ operationKind: 'unsubscribe', operationOwner: 'op' });
    });

    it('returns clones that do not alias stored rows', async () => {
      const row = await store.upsertSubscription({ ...identity(), metadata: { a: 1 } });
      row.metadata.a = 2;
      expect((await store.getSubscriptionById({ agentId: 'agent-a', id: row.id }))?.metadata).toEqual({ a: 1 });
    });

    it('updates patches and enabled state, returning null for missing rows', async () => {
      const row = await store.upsertSubscription({ ...identity(), metadata: { a: 1 } });
      const patched = await store.updateSubscription({
        agentId: 'agent-a',
        id: row.id,
        patch: {
          metadata: { b: 1 },
          cursor: { c: 1 },
          lastPolledAt: new Date(5),
          lastDeliveredAt: new Date(6),
          deliveryOptions: { ifIdle: false },
        },
      });
      expect(patched).toMatchObject({
        metadata: { b: 1 },
        cursor: { c: 1 },
        lastPolledAt: new Date(5),
        lastDeliveredAt: new Date(6),
        deliveryOptions: { ifIdle: false },
      });
      const cleared = await store.updateSubscription({ agentId: 'agent-a', id: row.id, patch: { cursor: null } });
      expect(cleared?.cursor).toBeUndefined();
      expect((await store.setSubscriptionEnabled({ agentId: 'agent-a', id: row.id, enabled: false }))?.enabled).toBe(
        false,
      );
      expect(await store.updateSubscription({ agentId: 'agent-a', id: 'missing', patch: {} })).toBeNull();
      expect(await store.setSubscriptionEnabled({ agentId: 'agent-a', id: 'missing', enabled: true })).toBeNull();
    });
  });

  describe('listing', () => {
    async function seed(count: number) {
      const ids: string[] = [];
      for (let i = 0; i < count; i++) {
        // Pairs share a createdAt so ties are broken by id.
        now = 1_000_000 + Math.floor(i / 2);
        const row = await store.upsertSubscription({
          ...identity({ externalResourceId: `ext-${i}` }),
          id: `id-${String(count - i).padStart(3, '0')}`,
          enabled: i % 3 !== 0,
        });
        ids.push(row.id);
      }
      return ids;
    }

    it('orders by createdAt then id and reports the full total', async () => {
      await seed(6);
      const { subscriptions, total } = await store.listSubscriptions({ agentId: 'agent-a' });
      expect(total).toBe(6);
      expect(subscriptions.map(s => s.id)).toEqual(['id-005', 'id-006', 'id-003', 'id-004', 'id-001', 'id-002']);
    });

    it('returns every row when limit is omitted', async () => {
      await seed(250);
      const { subscriptions, total } = await store.listSubscriptions({ agentId: 'agent-a' });
      expect(total).toBe(250);
      expect(subscriptions).toHaveLength(250);
    });

    it('pages without duplicates and keeps totals consistent', async () => {
      await seed(7);
      const all = (await store.listSubscriptions({ agentId: 'agent-a' })).subscriptions.map(s => s.id);
      const seen: string[] = [];
      for (let offset = 0; offset < 7; offset += 3) {
        const pageResult = await store.listSubscriptions({ agentId: 'agent-a', limit: 3, offset });
        expect(pageResult.total).toBe(7);
        seen.push(...pageResult.subscriptions.map(s => s.id));
      }
      expect(seen).toEqual(all);
      expect(await store.listSubscriptions({ agentId: 'agent-a', offset: 5 })).toEqual({
        subscriptions: (await store.listSubscriptions({ agentId: 'agent-a' })).subscriptions.slice(5),
        total: 7,
      });
      expect(await store.listSubscriptions({ agentId: 'agent-a', limit: 2, offset: 7 })).toEqual({
        subscriptions: [],
        total: 7,
      });
      expect(await store.listSubscriptions({ agentId: 'agent-a', offset: 9 })).toEqual({ subscriptions: [], total: 7 });
      expect(await store.listSubscriptions({ agentId: 'nobody', limit: 5, offset: 0 })).toEqual({
        subscriptions: [],
        total: 0,
      });
    });

    it('filters by every field and counts', async () => {
      await seed(6);
      await store.upsertSubscription(identity({ threadId: 'thread-2', externalResourceId: 'ext-0' }));
      expect(await store.countSubscriptions({ agentId: 'agent-a' })).toBe(7);
      expect(await store.countSubscriptions({ agentId: 'agent-a', enabled: false })).toBe(2);
      expect(await store.countSubscriptions({ agentId: 'agent-a', threadId: 'thread-2' })).toBe(1);
      expect(await store.countSubscriptions({ agentId: 'agent-a', externalResourceId: 'ext-0' })).toBe(2);
      expect(await store.countSubscriptions({ agentId: 'agent-a', providerId: 'other' })).toBe(0);
      expect(await store.countSubscriptions({ agentId: 'agent-a', resourceId: 'resource-1' })).toBe(7);
      const forResource = await store.listSubscriptionsForResource({
        agentId: 'agent-a',
        providerId: 'webhook-signals',
        externalResourceId: 'ext-0',
      });
      // ext-0 on thread-1 is disabled (i % 3 === 0), so only the thread-2 row matches.
      expect(forResource.map(s => s.threadId)).toEqual(['thread-2']);
    });
  });

  describe('deletion', () => {
    it('deletes single and bulk rows and cascades deliveries', async () => {
      const a = await store.upsertSubscription(identity());
      const b = await store.upsertSubscription(identity({ externalResourceId: 'ext-2' }));
      await store.upsertSubscription(identity({ threadId: 'thread-2' }));
      await store.claimDelivery({ subscriptionId: a.id, deliveryId: 'd1', owner: 'o', ttlMs: TTL });
      await store.claimDelivery({ subscriptionId: b.id, deliveryId: 'd1', owner: 'o', ttlMs: TTL });
      await store.completeDelivery({ subscriptionId: b.id, deliveryId: 'd1', owner: 'o' });

      expect(await store.deleteSubscription({ agentId: 'agent-a', id: a.id })).toBe(true);
      expect(await store.deleteSubscription({ agentId: 'agent-a', id: a.id })).toBe(false);
      expect(await store.getDelivery({ subscriptionId: a.id, deliveryId: 'd1' })).toBeNull();

      expect(await store.deleteSubscriptions({ agentId: 'agent-a', threadId: 'thread-1' })).toBe(1);
      expect(await store.getDelivery({ subscriptionId: b.id, deliveryId: 'd1' })).toBeNull();
      expect(await store.countSubscriptions({ agentId: 'agent-a' })).toBe(1);
    });

    it('reports isEmpty across every table', async () => {
      expect(await store.isEmpty()).toBe(true);

      const row = await store.upsertSubscription(identity());
      expect(await store.isEmpty()).toBe(false);
      await store.dangerouslyClearAll();

      await store.claimDelivery({ subscriptionId: row.id, deliveryId: 'd', owner: 'o', ttlMs: TTL });
      expect(await store.isEmpty()).toBe(false);
      await store.dangerouslyClearAll();

      await store.claimCoordinationLock({ key: 'k', owner: 'o', ttlMs: TTL });
      expect(await store.isEmpty()).toBe(false);
      await store.dangerouslyClearAll();

      await store.claimDocumentOwner({ key: 'doc', ...identity() });
      expect(await store.isEmpty()).toBe(false);
      await store.dangerouslyClearAll();

      expect(await store.isEmpty()).toBe(true);
    });
  });

  describe('poll claims', () => {
    let id: string;
    const ref = () => ({ agentId: 'agent-a', id });
    const claim = (owner: string, extra: { force?: boolean } = {}) =>
      store.claimSubscription({ ...ref(), owner, ttlMs: TTL, cadenceMs: CADENCE, ...extra });

    beforeEach(async () => {
      id = (await store.upsertSubscription(identity())).id;
    });

    it('lets exactly one owner claim a due row and reserves the cadence', async () => {
      const results = await Promise.all([claim('r1'), claim('r2'), claim('r3')]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(results.find(Boolean)).toMatchObject({ claimOwner: 'r1', claimExpiresAt: now + TTL });
      expect(results.find(Boolean)?.nextPollAt).toEqual(new Date(now + CADENCE));
    });

    it('preserves nextPollAt on release so a staggered replica loses the same cadence', async () => {
      await claim('r1');
      expect(await store.releaseSubscriptionClaim({ ...ref(), owner: 'r1' })).toBe(true);
      now += 100;
      expect(await claim('r2')).toBeNull();
      expect((await store.getSubscriptionById(ref()))?.nextPollAt).toEqual(new Date(1_000_000 + CADENCE));
      now = 1_000_000 + CADENCE;
      expect(await claim('r2')).toMatchObject({ claimOwner: 'r2' });
    });

    it('takes over an expired claim despite a future nextPollAt and preserves the cadence', async () => {
      await claim('r1');
      now += TTL - 1;
      expect(await claim('r2')).toBeNull();
      now += 1;
      const takeover = await claim('r2');
      expect(takeover).toMatchObject({ claimOwner: 'r2', nextPollAt: new Date(1_000_000 + CADENCE) });
      expect(await store.validateSubscriptionClaimIfEnabled({ ...ref(), owner: 'r1' })).toBe(false);
    });

    it('force bypasses the cadence but never a live owner, and reserves the next cadence', async () => {
      await claim('r1');
      expect(await claim('r2', { force: true })).toBeNull();
      await store.releaseSubscriptionClaim({ ...ref(), owner: 'r1' });
      now += 100;
      const forced = await claim('r2', { force: true });
      expect(forced).toMatchObject({ claimOwner: 'r2', nextPollAt: new Date(now + CADENCE) });
      await store.releaseSubscriptionClaim({ ...ref(), owner: 'r2' });
      now += 100;
      expect(await claim('r3')).toBeNull();
    });

    it('renews, validates, and releases only for the live owner', async () => {
      await claim('r1');
      now += TTL - 10;
      expect(await store.renewSubscriptionClaimIfEnabled({ ...ref(), owner: 'r2', ttlMs: TTL })).toBe(false);
      expect(await store.renewSubscriptionClaimIfEnabled({ ...ref(), owner: 'r1', ttlMs: TTL })).toBe(true);
      now += TTL - 10;
      expect(await store.validateSubscriptionClaimIfEnabled({ ...ref(), owner: 'r1' })).toBe(true);
      expect(await claim('r2')).toBeNull();
      now += 10;
      expect(await store.validateSubscriptionClaimIfEnabled({ ...ref(), owner: 'r1' })).toBe(false);
      expect(await store.renewSubscriptionClaimIfEnabled({ ...ref(), owner: 'r1', ttlMs: TTL })).toBe(false);
      expect(await store.releaseSubscriptionClaim({ ...ref(), owner: 'r2' })).toBe(false);
    });

    it('rejects claims on disabled rows and rows with a live membership operation', async () => {
      await store.setSubscriptionEnabled({ ...ref(), enabled: false });
      expect(await claim('r1')).toBeNull();
      await store.setSubscriptionEnabled({ ...ref(), enabled: true });
      await store.beginSubscriptionOperation({ ...ref(), kind: 'unsubscribe', owner: 'op', ttlMs: TTL });
      expect(await claim('r1', { force: true })).toBeNull();
      now += TTL;
      expect(await claim('r1')).toMatchObject({ claimOwner: 'r1' });
    });

    it('fails renewal once the row is disabled or an operation is staged', async () => {
      await claim('r1');
      await store.setSubscriptionEnabled({ ...ref(), enabled: false });
      expect(await store.renewSubscriptionClaimIfEnabled({ ...ref(), owner: 'r1', ttlMs: TTL })).toBe(false);
      await store.setSubscriptionEnabled({ ...ref(), enabled: true });
      expect(await store.validateSubscriptionClaimIfEnabled({ ...ref(), owner: 'r1' })).toBe(true);
      await store.beginSubscriptionOperation({ ...ref(), kind: 'unsubscribe', owner: 'op', ttlMs: TTL });
      expect(await store.validateSubscriptionClaimIfEnabled({ ...ref(), owner: 'r1' })).toBe(false);
    });

    it('serializes disable-vs-renew and commit-vs-renew', async () => {
      await claim('r1');
      const [, renewed] = await Promise.all([
        store.setSubscriptionEnabled({ ...ref(), enabled: false }),
        store.renewSubscriptionClaimIfEnabled({ ...ref(), owner: 'r1', ttlMs: TTL }),
      ]);
      expect(renewed).toBe(false);

      await store.beginSubscriptionOperation({ ...ref(), kind: 'unsubscribe', owner: 'op', ttlMs: TTL * 10 });
      // The live claim blocks the unsubscribe commit until it expires or is released.
      expect(await store.commitUnsubscribe({ ...ref(), owner: 'op' })).toBe(false);
      await store.releaseSubscriptionClaim({ ...ref(), owner: 'r1' });
      const [committed, renewedAfter] = await Promise.all([
        store.commitUnsubscribe({ ...ref(), owner: 'op' }),
        store.renewSubscriptionClaimIfEnabled({ ...ref(), owner: 'r1', ttlMs: TTL }),
      ]);
      expect(committed).toBe(true);
      expect(renewedAfter).toBe(false);
    });
  });

  describe('membership operations', () => {
    it('inserts a disabled subscribing row and commits it', async () => {
      const row = await store.insertSubscribingSubscription({ ...identity(), owner: 'op', ttlMs: TTL });
      expect(row).toMatchObject({ enabled: false, operationKind: 'subscribe', operationOwner: 'op' });
      expect(await store.insertSubscribingSubscription({ ...identity(), owner: 'op2', ttlMs: TTL })).toBeNull();
      expect(await store.commitSubscribe({ agentId: 'agent-a', id: row!.id, owner: 'other' })).toBeNull();
      const committed = await store.commitSubscribe({ agentId: 'agent-a', id: row!.id, owner: 'op' });
      expect(committed).toMatchObject({ enabled: true });
      expect(committed?.operationOwner).toBeUndefined();
    });

    it('renews, rejects concurrent operations, and allows takeover only after expiry', async () => {
      const row = await store.upsertSubscription(identity());
      const ref = { agentId: 'agent-a', id: row.id };
      expect(
        await store.beginSubscriptionOperation({ ...ref, kind: 'unsubscribe', owner: 'a', ttlMs: TTL }),
      ).not.toBeNull();
      expect(await store.beginSubscriptionOperation({ ...ref, kind: 'subscribe', owner: 'b', ttlMs: TTL })).toBeNull();
      now += TTL - 1;
      expect(await store.renewSubscriptionOperation({ ...ref, owner: 'b', ttlMs: TTL })).toBe(false);
      expect(await store.renewSubscriptionOperation({ ...ref, owner: 'a', ttlMs: TTL })).toBe(true);
      now += TTL - 1;
      expect(await store.beginSubscriptionOperation({ ...ref, kind: 'subscribe', owner: 'b', ttlMs: TTL })).toBeNull();
      now += 1;
      expect(await store.renewSubscriptionOperation({ ...ref, owner: 'a', ttlMs: TTL })).toBe(false);
      expect(
        await store.beginSubscriptionOperation({ ...ref, kind: 'subscribe', owner: 'b', ttlMs: TTL }),
      ).toMatchObject({
        operationKind: 'subscribe',
        operationOwner: 'b',
      });
      // The stale owner can neither commit nor abort after takeover.
      expect(await store.abortSubscriptionOperation({ ...ref, owner: 'a' })).toBe(false);
      expect(await store.abortSubscriptionOperation({ ...ref, owner: 'b' })).toBe(true);
      expect((await store.getSubscriptionById(ref))?.operationOwner).toBeUndefined();
    });

    it('rejects a subscribe operation on an active row while a poll claim is live', async () => {
      const row = await store.upsertSubscription(identity());
      const ref = { agentId: 'agent-a', id: row.id };
      await store.claimSubscription({ ...ref, owner: 'poller', ttlMs: TTL, cadenceMs: CADENCE });
      expect(await store.beginSubscriptionOperation({ ...ref, kind: 'subscribe', owner: 'op', ttlMs: TTL })).toBeNull();
      await store.releaseSubscriptionClaim({ ...ref, owner: 'poller' });
      expect(
        await store.beginSubscriptionOperation({ ...ref, kind: 'subscribe', owner: 'op', ttlMs: TTL }),
      ).not.toBeNull();
    });

    it('commits unsubscribe only for a disabled row with a matching live operation', async () => {
      const row = await store.upsertSubscription(identity());
      const ref = { agentId: 'agent-a', id: row.id };
      await store.claimDelivery({ subscriptionId: row.id, deliveryId: 'd', owner: 'o', ttlMs: TTL });
      await store.beginSubscriptionOperation({ ...ref, kind: 'unsubscribe', owner: 'op', ttlMs: TTL });
      expect(await store.commitUnsubscribe({ ...ref, owner: 'op' })).toBe(false); // still enabled
      await store.setSubscriptionEnabled({ ...ref, enabled: false });
      expect(await store.commitUnsubscribe({ ...ref, owner: 'stale' })).toBe(false);
      now += TTL;
      expect(await store.commitUnsubscribe({ ...ref, owner: 'op' })).toBe(false); // operation expired
      await store.beginSubscriptionOperation({ ...ref, kind: 'unsubscribe', owner: 'op2', ttlMs: TTL });
      expect(await store.commitUnsubscribe({ ...ref, owner: 'op' })).toBe(false);
      expect(await store.commitUnsubscribe({ ...ref, owner: 'op2' })).toBe(true);
      expect(await store.getSubscriptionById(ref)).toBeNull();
      expect(await store.getDelivery({ subscriptionId: row.id, deliveryId: 'd' })).toBeNull();
    });
  });

  describe('document owners and fences', () => {
    const doc = {
      key: 'doc-1',
      agentId: 'agent-a',
      providerId: 'github',
      resourceId: 'resource-1',
      threadId: 'thread-1',
    };
    const owned = (overrides: Partial<SignalSubscriptionIdentity> = {}) =>
      identity({ providerId: 'github', ...overrides });

    it('claims first-writer ownership idempotently and rejects other identities', async () => {
      const first = await store.claimDocumentOwner(doc);
      expect(first?.fencingToken).toEqual(expect.any(String));
      expect((await store.claimDocumentOwner(doc))?.fencingToken).toBe(first?.fencingToken);
      expect(await store.claimDocumentOwner({ ...doc, agentId: 'agent-b' })).toBeNull();
      expect(await store.claimDocumentOwner({ ...doc, threadId: 'thread-2' })).toBeNull();
    });

    it('lists owners in stable order with filters and totals', async () => {
      await store.claimDocumentOwner({ ...doc, key: 'k-b' });
      await store.claimDocumentOwner({ ...doc, key: 'k-a', threadId: 'thread-2' });
      now += 1;
      await store.claimDocumentOwner({ ...doc, key: 'k-0', agentId: 'agent-b', threadId: 'thread-3' });
      const all = await store.listDocumentOwners({});
      expect(all.total).toBe(3);
      expect(all.owners.map(o => o.key)).toEqual(['k-a', 'k-b', 'k-0']);
      expect(await store.listDocumentOwners({ agentId: 'agent-a', limit: 1, offset: 1 })).toMatchObject({
        owners: [{ key: 'k-b' }],
        total: 2,
      });
      expect((await store.listDocumentOwners({ offset: 2 })).owners.map(o => o.key)).toEqual(['k-0']);
      expect(await store.listDocumentOwners({ offset: 3 })).toEqual({ owners: [], total: 3 });
      expect(await store.listDocumentOwners({ offset: 5, limit: 1 })).toEqual({ owners: [], total: 3 });
      expect(await store.listDocumentOwners({ threadId: 'missing' })).toEqual({ owners: [], total: 0 });
      expect((await store.listDocumentOwners({ providerId: 'github', resourceId: 'resource-1' })).total).toBe(3);
    });

    it('requires a valid fence for every mutation of an owned document', async () => {
      const owner = (await store.claimDocumentOwner(doc))!;
      const fence: SignalSubscriptionDocumentFence = { key: doc.key, fencingToken: owner.fencingToken };
      const other = (await store.claimDocumentOwner({ ...doc, key: 'doc-2', threadId: 'thread-2' }))!;
      const wrongDocument: SignalSubscriptionDocumentFence = { key: 'doc-2', fencingToken: other.fencingToken };
      const stale: SignalSubscriptionDocumentFence = { key: doc.key, fencingToken: 'stale' };

      const reject = (promise: Promise<unknown>) =>
        expect(promise).rejects.toBeInstanceOf(SignalSubscriptionFenceError);

      await reject(store.upsertSubscription(owned()));
      await reject(store.upsertSubscription(owned(), wrongDocument));
      await reject(store.upsertSubscription(owned(), stale));
      await reject(store.upsertSubscription(owned({ agentId: 'agent-b' }), fence));
      await reject(store.insertSubscribingSubscription({ ...owned(), owner: 'op', ttlMs: TTL }));

      const row = await store.upsertSubscription(owned(), fence);
      const ref = { agentId: 'agent-a', id: row.id };
      await reject(store.updateSubscription({ ...ref, patch: { metadata: {} } }));
      await reject(store.updateSubscription({ ...ref, patch: { metadata: {} } }, wrongDocument));
      await reject(store.setSubscriptionEnabled({ ...ref, enabled: false }, stale));
      await reject(store.beginSubscriptionOperation({ ...ref, kind: 'unsubscribe', owner: 'op', ttlMs: TTL }));
      await reject(store.deleteSubscription(ref));
      await reject(store.deleteSubscriptions({ agentId: 'agent-a' }));
      await reject(store.deleteSubscriptions({ agentId: 'agent-a' }, [wrongDocument]));
      expect(await store.countSubscriptions({ agentId: 'agent-a' })).toBe(1);

      expect(await store.updateSubscription({ ...ref, patch: { metadata: { ok: 1 } } }, fence)).not.toBeNull();
      expect(await store.setSubscriptionEnabled({ ...ref, enabled: false }, fence)).not.toBeNull();
      await store.beginSubscriptionOperation({ ...ref, kind: 'unsubscribe', owner: 'op', ttlMs: TTL }, fence);
      await reject(store.commitUnsubscribe({ ...ref, owner: 'op' }));
      await reject(store.abortSubscriptionOperation({ ...ref, owner: 'op' }, stale));
      expect(await store.commitUnsubscribe({ ...ref, owner: 'op' }, fence)).toBe(true);
    });

    it('lets unowned generic rows omit the fence and rejects a fence on them', async () => {
      const row = await store.upsertSubscription(identity());
      expect(await store.setSubscriptionEnabled({ agentId: 'agent-a', id: row.id, enabled: false })).not.toBeNull();
      const owner = (await store.claimDocumentOwner(doc))!;
      await expect(
        store.updateSubscription(
          { agentId: 'agent-a', id: row.id, patch: {} },
          { key: doc.key, fencingToken: owner.fencingToken },
        ),
      ).rejects.toBeInstanceOf(SignalSubscriptionFenceError);
    });

    it('bulk-deletes atomically only when every owned document has a fence', async () => {
      const ownerA = (await store.claimDocumentOwner(doc))!;
      const ownerB = (await store.claimDocumentOwner({ ...doc, key: 'doc-2', threadId: 'thread-2' }))!;
      const fenceA = { key: doc.key, fencingToken: ownerA.fencingToken };
      const fenceB = { key: 'doc-2', fencingToken: ownerB.fencingToken };
      await store.upsertSubscription(owned(), fenceA);
      await store.upsertSubscription(owned({ threadId: 'thread-2' }), fenceB);
      await store.upsertSubscription(identity({ threadId: 'thread-3' }));

      await expect(store.deleteSubscriptions({ agentId: 'agent-a' }, [fenceA])).rejects.toBeInstanceOf(
        SignalSubscriptionFenceError,
      );
      expect(await store.countSubscriptions({ agentId: 'agent-a' })).toBe(3);
      expect(await store.deleteSubscriptions({ agentId: 'agent-a' }, [fenceA, fenceB])).toBe(3);
    });

    it('releases only for the token owner once no document rows remain, and fences stale owners after reassignment', async () => {
      const first = (await store.claimDocumentOwner(doc))!;
      const staleFence = { key: doc.key, fencingToken: first.fencingToken };
      const row = await store.upsertSubscription(owned(), staleFence);

      expect(await store.releaseDocumentOwner({ ...doc, fencingToken: first.fencingToken })).toBe(false);
      await store.deleteSubscription({ agentId: 'agent-a', id: row.id }, staleFence);
      expect(await store.releaseDocumentOwner({ ...doc, fencingToken: 'wrong' })).toBe(false);
      expect(await store.releaseDocumentOwner({ ...doc, agentId: 'agent-b', fencingToken: first.fencingToken })).toBe(
        false,
      );
      expect(await store.releaseDocumentOwner({ ...doc, fencingToken: first.fencingToken })).toBe(true);

      // claim → pause → release → reassign → stale insert
      const reassigned = (await store.claimDocumentOwner(doc))!;
      expect(reassigned.fencingToken).not.toBe(first.fencingToken);
      await expect(store.upsertSubscription(owned(), staleFence)).rejects.toBeInstanceOf(SignalSubscriptionFenceError);
      await expect(
        store.insertSubscribingSubscription({ ...owned(), owner: 'op', ttlMs: TTL }, staleFence),
      ).rejects.toBeInstanceOf(SignalSubscriptionFenceError);
      expect(await store.countSubscriptions({ agentId: 'agent-a' })).toBe(0);
    });
  });

  describe('coordination locks', () => {
    it('grants one holder, expires, renews, and releases owner-conditionally', async () => {
      const lock = { key: 'doc', ttlMs: TTL };
      const results = await Promise.all([
        store.claimCoordinationLock({ ...lock, owner: 'a' }),
        store.claimCoordinationLock({ ...lock, owner: 'b' }),
      ]);
      expect(results).toEqual([true, false]);
      expect(await store.claimCoordinationLock({ ...lock, owner: 'a' })).toBe(false);
      now += TTL - 1;
      expect(await store.renewCoordinationLock({ ...lock, owner: 'b' })).toBe(false);
      expect(await store.renewCoordinationLock({ ...lock, owner: 'a' })).toBe(true);
      now += TTL;
      expect(await store.claimCoordinationLock({ ...lock, owner: 'b' })).toBe(true);
      expect(await store.renewCoordinationLock({ ...lock, owner: 'a' })).toBe(false);
      expect(await store.releaseCoordinationLock({ key: 'doc', owner: 'a' })).toBe(false);
      expect(await store.releaseCoordinationLock({ key: 'doc', owner: 'b' })).toBe(true);
      expect(await store.claimCoordinationLock({ ...lock, owner: 'a' })).toBe(true);
    });

    it('keeps lock and document-owner keys in separate namespaces', async () => {
      await store.claimDocumentOwner({ key: 'shared', ...identity() });
      expect(await store.claimCoordinationLock({ key: 'shared', owner: 'a', ttlMs: TTL })).toBe(true);
    });
  });

  describe('delivery ledger', () => {
    const ref = { subscriptionId: 'sub-1', deliveryId: 'delivery-1' };

    it('moves through claimed, in-progress, and delivered states', async () => {
      const results = await Promise.all([
        store.claimDelivery({ ...ref, owner: 'a', ttlMs: TTL }),
        store.claimDelivery({ ...ref, owner: 'b', ttlMs: TTL }),
      ]);
      expect(results).toEqual(['claimed', 'in-progress']);
      expect(await store.claimDelivery({ ...ref, owner: 'a', ttlMs: TTL })).toBe('in-progress');
      expect(await store.getDelivery(ref)).toMatchObject({ status: 'pending', owner: 'a', expiresAt: now + TTL });

      now += TTL - 1;
      expect(await store.renewDeliveryClaim({ ...ref, owner: 'b', ttlMs: TTL })).toBe(false);
      expect(await store.renewDeliveryClaim({ ...ref, owner: 'a', ttlMs: TTL })).toBe(true);
      expect(await store.completeDelivery({ ...ref, owner: 'b' })).toBe(false);
      expect(await store.releaseDelivery({ ...ref, owner: 'b' })).toBe(false);
      expect(await store.completeDelivery({ ...ref, owner: 'a' })).toBe(true);

      const delivered = await store.getDelivery(ref);
      expect(delivered).toMatchObject({ status: 'delivered', deliveredAt: new Date(now) });
      expect(delivered?.owner).toBeUndefined();
      expect(delivered?.expiresAt).toBeUndefined();

      expect(await store.completeDelivery({ ...ref, owner: 'a' })).toBe(false);
      expect(await store.renewDeliveryClaim({ ...ref, owner: 'a', ttlMs: TTL })).toBe(false);
      expect(await store.releaseDelivery({ ...ref, owner: 'a' })).toBe(false);
      now += 365 * 24 * 60 * 60 * 1000;
      expect(await store.claimDelivery({ ...ref, owner: 'c', ttlMs: TTL })).toBe('delivered');
    });

    it('lets exactly one claimant take over an expired pending delivery', async () => {
      await store.claimDelivery({ ...ref, owner: 'a', ttlMs: TTL });
      now += TTL;
      const results = await Promise.all([
        store.claimDelivery({ ...ref, owner: 'b', ttlMs: TTL }),
        store.claimDelivery({ ...ref, owner: 'c', ttlMs: TTL }),
      ]);
      expect(results).toEqual(['claimed', 'in-progress']);
      expect(await store.completeDelivery({ ...ref, owner: 'a' })).toBe(false);
      expect(await store.renewDeliveryClaim({ ...ref, owner: 'a', ttlMs: TTL })).toBe(false);
    });

    it('releases a pending delivery for retry', async () => {
      await store.claimDelivery({ ...ref, owner: 'a', ttlMs: TTL });
      expect(await store.releaseDelivery({ ...ref, owner: 'a' })).toBe(true);
      expect(await store.getDelivery(ref)).toBeNull();
      expect(await store.claimDelivery({ ...ref, owner: 'b', ttlMs: TTL })).toBe('claimed');
    });
  });
});
