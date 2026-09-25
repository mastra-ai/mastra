import { SignalSubscriptionFenceError } from '@mastra/core/storage';
import type {
  SignalSubscriptionDocumentFence,
  SignalSubscriptionDocumentOwner,
  SignalSubscriptionRecord,
  SignalSubscriptionsStorage,
} from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  SIGNAL_AGENT,
  SIGNAL_PROVIDER,
  createSampleDocumentOwner,
  createSampleSignalIdentity,
  createSampleSignalSubscriptions,
} from './data';

export * from './data';

export interface SignalSubscriptionsConformanceOptions {
  /** Label used in the suite name. */
  storeName: string;
  /**
   * Create an initialized domain store. Every call must return an independent
   * instance (its own client/connection) backed by the same database, so the
   * suite can race two replicas against each other.
   */
  createStore: () => Promise<SignalSubscriptionsStorage>;
  /** Release anything `createStore` opened. */
  closeStore?: (store: SignalSubscriptionsStorage) => Promise<void>;
  /** Short lease used to exercise database-time expiry. Defaults to 300ms. */
  ttlMs?: number;
}

const CADENCE = 60_000;
const LONG = 60_000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function byCreatedAtThenId(a: SignalSubscriptionRecord, b: SignalSubscriptionRecord) {
  return a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function byCreatedAtThenKey(a: SignalSubscriptionDocumentOwner, b: SignalSubscriptionDocumentOwner) {
  return a.createdAt.getTime() - b.createdAt.getTime() || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

/**
 * Contract suite every `signalSubscriptions` adapter must pass. Both replicas
 * share one database, and every expiry is decided by database time.
 */
export function createSignalSubscriptionsConformanceTests({
  storeName,
  createStore,
  closeStore,
  ttlMs = 300,
}: SignalSubscriptionsConformanceOptions) {
  const TTL = ttlMs;
  const expire = () => sleep(TTL + 150);

  describe(`${storeName} signal-subscriptions conformance`, () => {
    let store: SignalSubscriptionsStorage;
    let replica: SignalSubscriptionsStorage;
    const ref = (id: string) => ({ agentId: SIGNAL_AGENT, id });

    beforeAll(async () => {
      store = await createStore();
      replica = await createStore();
    });

    afterAll(async () => {
      await closeStore?.(store);
      await closeStore?.(replica);
    });

    beforeEach(async () => {
      await store.dangerouslyClearAll();
    });

    describe('scoping and upsert', () => {
      it('keys rows by the five-part identity', async () => {
        const base = await store.upsertSubscription(createSampleSignalIdentity());
        const variants = [
          createSampleSignalIdentity({ agentId: 'agent-b' }),
          createSampleSignalIdentity({ providerId: 'other-provider' }),
          createSampleSignalIdentity({ resourceId: 'resource-2' }),
          createSampleSignalIdentity({ threadId: 'thread-2' }),
          createSampleSignalIdentity({ externalResourceId: 'ext-2' }),
        ];
        const ids = new Set([base.id]);
        for (const variant of variants) ids.add((await replica.upsertSubscription(variant)).id);
        expect(ids.size).toBe(6);
        expect((await replica.upsertSubscription(createSampleSignalIdentity())).id).toBe(base.id);
        expect(await store.getSubscriptionById({ agentId: 'agent-b', id: base.id })).toBeNull();
        expect((await replica.getSubscriptionByIdentity(createSampleSignalIdentity()))?.id).toBe(base.id);
        expect(await store.countSubscriptions({ agentId: SIGNAL_AGENT })).toBe(5);
        expect(await store.countSubscriptions({ agentId: 'agent-b' })).toBe(1);
      });

      it('inserts enabled by default and merges on conflict', async () => {
        const created = await store.upsertSubscription({
          ...createSampleSignalIdentity(),
          metadata: { a: 1, nested: { x: 1 }, keep: 'yes' },
          deliveryOptions: { ifIdle: true },
        });
        expect(created).toMatchObject({ enabled: true, metadata: { a: 1, nested: { x: 1 }, keep: 'yes' } });
        await store.claimSubscription({ ...ref(created.id), owner: 'poller', ttlMs: LONG, cadenceMs: CADENCE });
        await store.updateSubscription({ ...ref(created.id), patch: { cursor: { page: 2 } } });

        const merged = await replica.upsertSubscription({
          ...createSampleSignalIdentity(),
          metadata: { nested: { y: 2 }, a: false },
        });
        expect(merged).toMatchObject({
          id: created.id,
          metadata: { a: false, nested: { y: 2 }, keep: 'yes' },
          deliveryOptions: { ifIdle: true },
          enabled: true,
          claimOwner: 'poller',
          cursor: { page: 2 },
        });
        expect(merged.createdAt.getTime()).toBe(created.createdAt.getTime());

        const replaced = await store.upsertSubscription({
          ...createSampleSignalIdentity(),
          deliveryOptions: {},
          enabled: false,
        });
        expect(replaced).toMatchObject({ deliveryOptions: {}, enabled: false });
        expect((await replica.upsertSubscription(createSampleSignalIdentity())).enabled).toBe(false);
        expect((await replica.upsertSubscription({ ...createSampleSignalIdentity(), enabled: true })).enabled).toBe(
          true,
        );
      });

      it('preserves a live membership operation across upsert', async () => {
        const inserted = await store.insertSubscribingSubscription({
          ...createSampleSignalIdentity(),
          owner: 'op',
          ttlMs: LONG,
        });
        const upserted = await replica.upsertSubscription({ ...createSampleSignalIdentity(), metadata: { m: 1 } });
        expect(upserted).toMatchObject({
          id: inserted!.id,
          operationKind: 'subscribe',
          operationOwner: 'op',
          enabled: false,
        });
      });

      it('updates, replaces metadata, clears cursor, and returns null for missing rows', async () => {
        const { id } = await store.upsertSubscription({ ...createSampleSignalIdentity(), metadata: { a: 1, b: 2 } });
        const polledAt = new Date(1_700_000_000_000);
        const updated = await replica.updateSubscription({
          ...ref(id),
          patch: { metadata: { c: 3 }, cursor: { at: 1 }, lastPolledAt: polledAt, lastDeliveredAt: polledAt },
        });
        expect(updated).toMatchObject({ metadata: { c: 3 }, cursor: { at: 1 } });
        expect(updated?.lastPolledAt?.getTime()).toBe(polledAt.getTime());
        expect(updated?.lastDeliveredAt?.getTime()).toBe(polledAt.getTime());
        expect((await store.updateSubscription({ ...ref(id), patch: { cursor: null } }))?.cursor).toBeUndefined();
        expect(await store.updateSubscription({ ...ref('missing'), patch: {} })).toBeNull();
        expect(await store.updateSubscription({ agentId: 'agent-b', id, patch: {} })).toBeNull();
      });

      it('enables and disables rows and hides disabled rows from resource lookup', async () => {
        const { id } = await store.upsertSubscription(createSampleSignalIdentity());
        const lookup = { agentId: SIGNAL_AGENT, providerId: SIGNAL_PROVIDER, externalResourceId: 'ext-1' };
        expect(await replica.listSubscriptionsForResource(lookup)).toHaveLength(1);
        expect((await replica.setSubscriptionEnabled({ ...ref(id), enabled: false }))?.enabled).toBe(false);
        expect(await store.listSubscriptionsForResource(lookup)).toHaveLength(0);
        expect((await store.getSubscriptionById(ref(id)))?.enabled).toBe(false);
        expect((await store.setSubscriptionEnabled({ ...ref(id), enabled: true }))?.enabled).toBe(true);
        expect(await store.setSubscriptionEnabled({ ...ref('missing'), enabled: true })).toBeNull();
      });
    });

    describe('listing', () => {
      const seed = async (count: number) => {
        for (const input of createSampleSignalSubscriptions(count)) await store.upsertSubscription(input);
      };

      it('filters every identity field and enabled state', async () => {
        await seed(3);
        await store.upsertSubscription(createSampleSignalIdentity({ providerId: 'p2', externalResourceId: 'x' }));
        await store.upsertSubscription(createSampleSignalIdentity({ resourceId: 'r2', externalResourceId: 'x' }));
        await store.upsertSubscription(createSampleSignalIdentity({ threadId: 't2', externalResourceId: 'x' }));
        await store.setSubscriptionEnabled({ ...ref('sub0000'), enabled: false });

        const count = async (filters: Record<string, unknown>) =>
          (await replica.listSubscriptions({ agentId: SIGNAL_AGENT, ...filters })).total;
        expect(await count({})).toBe(6);
        expect(await count({ providerId: 'p2' })).toBe(1);
        expect(await count({ resourceId: 'r2' })).toBe(1);
        expect(await count({ threadId: 't2' })).toBe(1);
        expect(await count({ externalResourceId: 'x' })).toBe(3);
        expect(await count({ enabled: false })).toBe(1);
        expect(await count({ enabled: true, providerId: SIGNAL_PROVIDER })).toBe(4);
        expect(await replica.countSubscriptions({ agentId: SIGNAL_AGENT, externalResourceId: 'x' })).toBe(3);
      });

      it('orders by (createdAt, id) and returns every row when limit is omitted', async () => {
        await seed(120);
        const all = await replica.listSubscriptions({ agentId: SIGNAL_AGENT });
        expect(all.total).toBe(120);
        expect(all.subscriptions).toHaveLength(120);
        expect(all.subscriptions.map(row => row.id)).toEqual(
          [...all.subscriptions].sort(byCreatedAtThenId).map(r => r.id),
        );
      });

      it('pages without duplicates and keeps totals consistent at every boundary', async () => {
        await seed(7);
        const all = (await store.listSubscriptions({ agentId: SIGNAL_AGENT })).subscriptions.map(row => row.id);
        const pages: string[] = [];
        for (let offset = 0; offset < 7; offset += 3) {
          const page = await replica.listSubscriptions({ agentId: SIGNAL_AGENT, limit: 3, offset });
          expect(page.total).toBe(7);
          expect(page.subscriptions.length).toBe(Math.min(3, 7 - offset));
          pages.push(...page.subscriptions.map(row => row.id));
        }
        expect(pages).toEqual(all);
        expect(new Set(pages).size).toBe(7);
        expect(
          (await store.listSubscriptions({ agentId: SIGNAL_AGENT, offset: 4 })).subscriptions.map(r => r.id),
        ).toEqual(all.slice(4));
        expect(await store.listSubscriptions({ agentId: SIGNAL_AGENT, offset: 7 })).toEqual({
          subscriptions: [],
          total: 7,
        });
        expect(await store.listSubscriptions({ agentId: SIGNAL_AGENT, limit: 3, offset: 9 })).toEqual({
          subscriptions: [],
          total: 7,
        });
        expect(await store.listSubscriptions({ agentId: 'nobody', limit: 5 })).toEqual({ subscriptions: [], total: 0 });
        expect(await store.listSubscriptions({ agentId: SIGNAL_AGENT, enabled: false })).toEqual({
          subscriptions: [],
          total: 0,
        });
      });

      it('lists document owners with filters, stable order, and consistent totals', async () => {
        for (let index = 0; index < 5; index++) {
          await store.claimDocumentOwner(createSampleDocumentOwner(`doc${index}`));
        }
        await store.claimDocumentOwner(createSampleDocumentOwner('other', { agentId: 'agent-b', providerId: 'p2' }));

        const all = await replica.listDocumentOwners({ agentId: SIGNAL_AGENT });
        expect(all.total).toBe(5);
        expect(all.owners.map(owner => owner.key)).toEqual([...all.owners].sort(byCreatedAtThenKey).map(o => o.key));
        const pages: string[] = [];
        for (let offset = 0; offset < 5; offset += 2) {
          const page = await replica.listDocumentOwners({ agentId: SIGNAL_AGENT, limit: 2, offset });
          expect(page.total).toBe(5);
          pages.push(...page.owners.map(owner => owner.key));
        }
        expect(pages).toEqual(all.owners.map(owner => owner.key));
        expect((await store.listDocumentOwners({ agentId: SIGNAL_AGENT, offset: 3 })).owners.map(o => o.key)).toEqual(
          all.owners.slice(3).map(o => o.key),
        );
        expect(await store.listDocumentOwners({ agentId: SIGNAL_AGENT, offset: 5 })).toEqual({ owners: [], total: 5 });
        expect(await store.listDocumentOwners({ agentId: SIGNAL_AGENT, limit: 2, offset: 8 })).toEqual({
          owners: [],
          total: 5,
        });
        expect(await store.listDocumentOwners({ agentId: 'nobody' })).toEqual({ owners: [], total: 0 });
        expect((await store.listDocumentOwners({})).total).toBe(6);
        expect((await store.listDocumentOwners({ providerId: 'p2' })).owners.map(o => o.key)).toEqual(['other']);
        expect((await store.listDocumentOwners({ threadId: 'doc2' })).owners.map(o => o.key)).toEqual(['doc2']);
        expect((await store.listDocumentOwners({ resourceId: 'resource-1' })).total).toBe(6);
      });
    });

    describe('isEmpty and clearing', () => {
      it('reports non-empty for each kind of state and empty after clearing', async () => {
        expect(await store.isEmpty()).toBe(true);
        const states = [
          () => store.upsertSubscription(createSampleSignalIdentity()),
          () => store.claimDelivery({ subscriptionId: 's', deliveryId: 'd', owner: 'o', ttlMs: TTL }),
          () => store.claimCoordinationLock({ key: 'lock', owner: 'o', ttlMs: TTL }),
          () => store.claimDocumentOwner(createSampleDocumentOwner('doc')),
        ];
        for (const create of states) {
          await create();
          expect(await replica.isEmpty()).toBe(false);
          await store.dangerouslyClearAll();
          expect(await replica.isEmpty()).toBe(true);
        }
      });
    });

    describe('deletion', () => {
      it('deletes one row or a filtered set and cascades their deliveries', async () => {
        const rows = await Promise.all(
          createSampleSignalSubscriptions(4).map(input => store.upsertSubscription(input)),
        );
        for (const row of rows) {
          await store.claimDelivery({ subscriptionId: row.id, deliveryId: 'd1', owner: 'o', ttlMs: LONG });
        }
        expect(await replica.deleteSubscription(ref(rows[0]!.id))).toBe(true);
        expect(await replica.deleteSubscription(ref(rows[0]!.id))).toBe(false);
        expect(await store.getDelivery({ subscriptionId: rows[0]!.id, deliveryId: 'd1' })).toBeNull();

        await store.upsertSubscription(createSampleSignalIdentity({ agentId: 'agent-b' }));
        expect(await replica.deleteSubscriptions({ agentId: SIGNAL_AGENT, externalResourceId: 'ext0001' })).toBe(1);
        expect(await replica.deleteSubscriptions({ agentId: SIGNAL_AGENT })).toBe(2);
        expect(await replica.deleteSubscriptions({ agentId: SIGNAL_AGENT })).toBe(0);
        for (const row of rows) {
          expect(await store.getDelivery({ subscriptionId: row.id, deliveryId: 'd1' })).toBeNull();
        }
        expect(await store.countSubscriptions({ agentId: 'agent-b' })).toBe(1);
      });
    });

    describe('poll claims', () => {
      it('grants a due row to exactly one of many concurrent claimants', async () => {
        const { id } = await store.upsertSubscription(createSampleSignalIdentity());
        const results = await Promise.all(
          Array.from({ length: 8 }, (_, index) =>
            (index % 2 ? replica : store).claimSubscription({
              ...ref(id),
              owner: `owner-${index}`,
              ttlMs: LONG,
              cadenceMs: CADENCE,
            }),
          ),
        );
        expect(results.filter(Boolean)).toHaveLength(1);
      });

      it('reserves the cadence so a staggered tick after release loses', async () => {
        const { id } = await store.upsertSubscription(createSampleSignalIdentity());
        const before = Date.now();
        const won = await store.claimSubscription({ ...ref(id), owner: 'a', ttlMs: LONG, cadenceMs: CADENCE });
        expect(won?.nextPollAt!.getTime()).toBeGreaterThanOrEqual(before + CADENCE - 1_000);
        expect(await store.releaseSubscriptionClaim({ ...ref(id), owner: 'b' })).toBe(false);
        expect(await store.releaseSubscriptionClaim({ ...ref(id), owner: 'a' })).toBe(true);
        expect(await replica.claimSubscription({ ...ref(id), owner: 'b', ttlMs: LONG, cadenceMs: CADENCE })).toBeNull();
        const row = await replica.getSubscriptionById(ref(id));
        expect(row?.nextPollAt?.getTime()).toBe(won?.nextPollAt?.getTime());
        expect(row?.claimOwner).toBeUndefined();
      });

      it('forces past the cadence but never steals a live claim', async () => {
        const { id } = await store.upsertSubscription(createSampleSignalIdentity());
        const first = await store.claimSubscription({ ...ref(id), owner: 'a', ttlMs: LONG, cadenceMs: CADENCE });
        expect(
          await replica.claimSubscription({ ...ref(id), owner: 'b', ttlMs: LONG, cadenceMs: CADENCE, force: true }),
        ).toBeNull();
        await store.releaseSubscriptionClaim({ ...ref(id), owner: 'a' });
        const forced = await replica.claimSubscription({
          ...ref(id),
          owner: 'b',
          ttlMs: LONG,
          cadenceMs: 2 * CADENCE,
          force: true,
        });
        expect(forced?.claimOwner).toBe('b');
        expect(forced!.nextPollAt!.getTime()).toBeGreaterThan(first!.nextPollAt!.getTime());
      });

      it('refuses disabled rows and rows with a live membership operation', async () => {
        const { id } = await store.upsertSubscription({ ...createSampleSignalIdentity(), enabled: false });
        expect(await store.claimSubscription({ ...ref(id), owner: 'a', ttlMs: LONG, cadenceMs: CADENCE })).toBeNull();
        await store.setSubscriptionEnabled({ ...ref(id), enabled: true });
        await store.beginSubscriptionOperation({ ...ref(id), kind: 'unsubscribe', owner: 'op', ttlMs: LONG });
        expect(
          await store.claimSubscription({ ...ref(id), owner: 'a', ttlMs: LONG, cadenceMs: CADENCE, force: true }),
        ).toBeNull();
      });

      it('takes over an expired claim by database time, preserving nextPollAt, and exactly one racer wins', async () => {
        const { id } = await store.upsertSubscription(createSampleSignalIdentity());
        const first = await store.claimSubscription({ ...ref(id), owner: 'a', ttlMs: TTL, cadenceMs: CADENCE });
        expect(await replica.claimSubscription({ ...ref(id), owner: 'b', ttlMs: TTL, cadenceMs: CADENCE })).toBeNull();
        await expire();
        expect(await store.validateSubscriptionClaimIfEnabled({ ...ref(id), owner: 'a' })).toBe(false);
        const racers = await Promise.all(
          ['b', 'c', 'd', 'e'].map((owner, index) =>
            (index % 2 ? replica : store).claimSubscription({ ...ref(id), owner, ttlMs: LONG, cadenceMs: CADENCE }),
          ),
        );
        const winners = racers.filter(Boolean);
        expect(winners).toHaveLength(1);
        expect(winners[0]!.nextPollAt!.getTime()).toBe(first!.nextPollAt!.getTime());
        expect(await store.renewSubscriptionClaimIfEnabled({ ...ref(id), owner: 'a', ttlMs: LONG })).toBe(false);
        expect(await store.releaseSubscriptionClaim({ ...ref(id), owner: 'a' })).toBe(false);
      });

      it('keeps a heartbeating claim exclusive and validates only the live owner', async () => {
        const { id } = await store.upsertSubscription(createSampleSignalIdentity());
        await store.claimSubscription({ ...ref(id), owner: 'a', ttlMs: TTL, cadenceMs: CADENCE });
        for (let beat = 0; beat < 3; beat++) {
          await sleep(TTL / 2);
          expect(await store.renewSubscriptionClaimIfEnabled({ ...ref(id), owner: 'a', ttlMs: TTL })).toBe(true);
          expect(
            await replica.claimSubscription({ ...ref(id), owner: 'b', ttlMs: TTL, cadenceMs: CADENCE, force: true }),
          ).toBeNull();
        }
        expect(await replica.validateSubscriptionClaimIfEnabled({ ...ref(id), owner: 'a' })).toBe(true);
        expect(await replica.validateSubscriptionClaimIfEnabled({ ...ref(id), owner: 'b' })).toBe(false);
        expect(await replica.renewSubscriptionClaimIfEnabled({ ...ref(id), owner: 'b', ttlMs: TTL })).toBe(false);
      });

      it('fails renewal and validation once the row is disabled', async () => {
        const { id } = await store.upsertSubscription(createSampleSignalIdentity());
        await store.claimSubscription({ ...ref(id), owner: 'a', ttlMs: LONG, cadenceMs: CADENCE });
        await Promise.all([
          replica.setSubscriptionEnabled({ ...ref(id), enabled: false }),
          store.renewSubscriptionClaimIfEnabled({ ...ref(id), owner: 'a', ttlMs: LONG }),
        ]);
        expect(await store.renewSubscriptionClaimIfEnabled({ ...ref(id), owner: 'a', ttlMs: LONG })).toBe(false);
        expect(await store.validateSubscriptionClaimIfEnabled({ ...ref(id), owner: 'a' })).toBe(false);
      });

      it('fails renewal once an unsubscribe operation is staged, and succeeds again after abort', async () => {
        const { id } = await store.upsertSubscription(createSampleSignalIdentity());
        await store.claimSubscription({ ...ref(id), owner: 'a', ttlMs: LONG, cadenceMs: CADENCE });
        await replica.beginSubscriptionOperation({ ...ref(id), kind: 'unsubscribe', owner: 'op', ttlMs: LONG });
        expect(await store.renewSubscriptionClaimIfEnabled({ ...ref(id), owner: 'a', ttlMs: LONG })).toBe(false);
        expect(await store.validateSubscriptionClaimIfEnabled({ ...ref(id), owner: 'a' })).toBe(false);
        expect(await replica.abortSubscriptionOperation({ ...ref(id), owner: 'op' })).toBe(true);
        expect(await store.renewSubscriptionClaimIfEnabled({ ...ref(id), owner: 'a', ttlMs: LONG })).toBe(true);
      });
    });

    describe('membership operations', () => {
      it('stages a subscribe and commits it only for the live operation owner', async () => {
        const inserted = await store.insertSubscribingSubscription({
          ...createSampleSignalIdentity(),
          owner: 'op',
          ttlMs: LONG,
        });
        expect(inserted).toMatchObject({ enabled: false, operationKind: 'subscribe', operationOwner: 'op' });
        expect(
          await replica.insertSubscribingSubscription({ ...createSampleSignalIdentity(), owner: 'op2', ttlMs: LONG }),
        ).toBeNull();
        expect(await replica.commitSubscribe({ ...ref(inserted!.id), owner: 'op2' })).toBeNull();
        expect(await replica.renewSubscriptionOperation({ ...ref(inserted!.id), owner: 'op2', ttlMs: LONG })).toBe(
          false,
        );
        expect(await store.renewSubscriptionOperation({ ...ref(inserted!.id), owner: 'op', ttlMs: LONG })).toBe(true);
        const committed = await store.commitSubscribe({ ...ref(inserted!.id), owner: 'op' });
        expect(committed).toMatchObject({ enabled: true });
        expect(committed?.operationOwner).toBeUndefined();
        expect(await store.commitSubscribe({ ...ref(inserted!.id), owner: 'op' })).toBeNull();
      });

      it('lets exactly one of concurrent subscribe and unsubscribe operations begin', async () => {
        const { id } = await store.upsertSubscription(createSampleSignalIdentity());
        const results = await Promise.all([
          store.beginSubscriptionOperation({ ...ref(id), kind: 'subscribe', owner: 'sub', ttlMs: LONG }),
          replica.beginSubscriptionOperation({ ...ref(id), kind: 'unsubscribe', owner: 'unsub', ttlMs: LONG }),
          store.beginSubscriptionOperation({ ...ref(id), kind: 'unsubscribe', owner: 'unsub2', ttlMs: LONG }),
        ]);
        expect(results.filter(Boolean)).toHaveLength(1);
      });

      it('refuses to begin a subscribe on an enabled row with a live poll claim', async () => {
        const { id } = await store.upsertSubscription(createSampleSignalIdentity());
        await store.claimSubscription({ ...ref(id), owner: 'poller', ttlMs: LONG, cadenceMs: CADENCE });
        expect(
          await replica.beginSubscriptionOperation({ ...ref(id), kind: 'subscribe', owner: 'op', ttlMs: LONG }),
        ).toBeNull();
        expect(
          await replica.beginSubscriptionOperation({ ...ref(id), kind: 'unsubscribe', owner: 'op', ttlMs: LONG }),
        ).not.toBeNull();
      });

      it('commits an unsubscribe only when disabled, owned, live, and unclaimed', async () => {
        const { id } = await store.upsertSubscription(createSampleSignalIdentity());
        await store.claimDelivery({ subscriptionId: id, deliveryId: 'd', owner: 'o', ttlMs: LONG });
        await store.claimSubscription({ ...ref(id), owner: 'poller', ttlMs: LONG, cadenceMs: CADENCE });
        await store.beginSubscriptionOperation({ ...ref(id), kind: 'unsubscribe', owner: 'op', ttlMs: LONG });
        expect(await store.commitUnsubscribe({ ...ref(id), owner: 'op' })).toBe(false);
        await store.setSubscriptionEnabled({ ...ref(id), enabled: false });
        expect(await store.commitUnsubscribe({ ...ref(id), owner: 'op' })).toBe(false);
        await store.releaseSubscriptionClaim({ ...ref(id), owner: 'poller' });
        expect(await replica.commitUnsubscribe({ ...ref(id), owner: 'other' })).toBe(false);
        expect(await replica.commitUnsubscribe({ ...ref(id), owner: 'op' })).toBe(true);
        expect(await store.getSubscriptionById(ref(id))).toBeNull();
        expect(await store.getDelivery({ subscriptionId: id, deliveryId: 'd' })).toBeNull();
        expect(await store.commitUnsubscribe({ ...ref(id), owner: 'op' })).toBe(false);
      });

      it('rejects a stale operation owner after an expired operation is taken over', async () => {
        const { id } = await store.upsertSubscription({ ...createSampleSignalIdentity(), enabled: false });
        await store.beginSubscriptionOperation({ ...ref(id), kind: 'unsubscribe', owner: 'stale', ttlMs: TTL });
        expect(
          await replica.beginSubscriptionOperation({ ...ref(id), kind: 'unsubscribe', owner: 'fresh', ttlMs: LONG }),
        ).toBeNull();
        await expire();
        expect(await store.renewSubscriptionOperation({ ...ref(id), owner: 'stale', ttlMs: LONG })).toBe(false);
        expect(await store.commitUnsubscribe({ ...ref(id), owner: 'stale' })).toBe(false);
        expect(
          await replica.beginSubscriptionOperation({ ...ref(id), kind: 'unsubscribe', owner: 'fresh', ttlMs: LONG }),
        ).toMatchObject({ operationOwner: 'fresh' });
        expect(await store.abortSubscriptionOperation({ ...ref(id), owner: 'stale' })).toBe(false);
        expect(await store.commitUnsubscribe({ ...ref(id), owner: 'stale' })).toBe(false);
        expect(await replica.commitUnsubscribe({ ...ref(id), owner: 'fresh' })).toBe(true);
      });

      it('lets an expired subscribe operation be taken over before commit', async () => {
        const inserted = await store.insertSubscribingSubscription({
          ...createSampleSignalIdentity(),
          owner: 'stale',
          ttlMs: TTL,
        });
        await expire();
        expect(await store.commitSubscribe({ ...ref(inserted!.id), owner: 'stale' })).toBeNull();
        expect(
          await replica.beginSubscriptionOperation({
            ...ref(inserted!.id),
            kind: 'subscribe',
            owner: 'fresh',
            ttlMs: LONG,
          }),
        ).not.toBeNull();
        expect(await replica.commitSubscribe({ ...ref(inserted!.id), owner: 'fresh' })).toMatchObject({
          enabled: true,
        });
      });
    });

    describe('document owners and fences', () => {
      const ownedIdentity = createSampleSignalIdentity({ providerId: 'github' });
      const doc = createSampleDocumentOwner('doc-1', { providerId: 'github', threadId: ownedIdentity.threadId });

      it('claims once per key, returns the same token to its owner, and rejects other agents', async () => {
        const [a, b] = await Promise.all([store.claimDocumentOwner(doc), replica.claimDocumentOwner(doc)]);
        expect(a?.fencingToken).toBeTruthy();
        expect(a?.fencingToken).toBe(b?.fencingToken);
        expect(await replica.claimDocumentOwner({ ...doc, agentId: 'agent-b' })).toBeNull();
        expect(await replica.claimDocumentOwner({ ...doc, threadId: 'elsewhere' })).toBeNull();
      });

      it('rejects every mutation of an owned document without the matching fence', async () => {
        const owner = (await store.claimDocumentOwner(doc))!;
        const fence: SignalSubscriptionDocumentFence = { key: doc.key, fencingToken: owner.fencingToken };
        const row = await store.upsertSubscription(ownedIdentity, fence);
        const otherDoc = (await store.claimDocumentOwner(
          createSampleDocumentOwner('doc-2', { providerId: 'github', threadId: 'thread-2' }),
        ))!;
        const bad: Array<SignalSubscriptionDocumentFence | undefined> = [
          undefined,
          { key: doc.key, fencingToken: 'stale-token' },
          { key: otherDoc.key, fencingToken: otherDoc.fencingToken },
        ];
        const r = ref(row.id);
        for (const candidate of bad) {
          const reject = (promise: Promise<unknown>) =>
            expect(promise).rejects.toBeInstanceOf(SignalSubscriptionFenceError);
          await reject(replica.upsertSubscription(ownedIdentity, candidate));
          await reject(
            replica.insertSubscribingSubscription(
              { ...ownedIdentity, externalResourceId: 'new', owner: 'op', ttlMs: LONG },
              candidate,
            ),
          );
          await reject(replica.updateSubscription({ ...r, patch: { metadata: {} } }, candidate));
          await reject(replica.setSubscriptionEnabled({ ...r, enabled: false }, candidate));
          await reject(
            replica.beginSubscriptionOperation({ ...r, kind: 'unsubscribe', owner: 'op', ttlMs: LONG }, candidate),
          );
          await reject(replica.commitSubscribe({ ...r, owner: 'op' }, candidate));
          await reject(replica.commitUnsubscribe({ ...r, owner: 'op' }, candidate));
          await reject(replica.abortSubscriptionOperation({ ...r, owner: 'op' }, candidate));
          await reject(replica.deleteSubscription(r, candidate));
          await reject(replica.deleteSubscriptions({ agentId: SIGNAL_AGENT }, candidate ? [candidate] : []));
        }
        // Cross-agent: a fence proves ownership only for its own agent's rows.
        await expect(
          replica.upsertSubscription({ ...ownedIdentity, agentId: 'agent-b' }, fence),
        ).rejects.toBeInstanceOf(SignalSubscriptionFenceError);
        expect(await store.getSubscriptionById(r)).toMatchObject({ enabled: true, metadata: {} });
        expect(await store.countSubscriptions({ agentId: SIGNAL_AGENT })).toBe(1);

        expect(
          (await replica.updateSubscription({ ...r, patch: { metadata: { ok: true } } }, fence))?.metadata,
        ).toEqual({ ok: true });
        expect((await replica.setSubscriptionEnabled({ ...r, enabled: false }, fence))?.enabled).toBe(false);
        expect(
          await replica.beginSubscriptionOperation({ ...r, kind: 'unsubscribe', owner: 'op', ttlMs: LONG }, fence),
        ).not.toBeNull();
        expect(await replica.abortSubscriptionOperation({ ...r, owner: 'op' }, fence)).toBe(true);
        expect(await replica.deleteSubscription(r, fence)).toBe(true);
      });

      it('rejects a fence on an unowned document', async () => {
        const unowned = await store.upsertSubscription(createSampleSignalIdentity());
        const owner = (await store.claimDocumentOwner(doc))!;
        const fence = { key: doc.key, fencingToken: owner.fencingToken };
        await expect(
          replica.updateSubscription({ ...ref(unowned.id), patch: { metadata: {} } }, fence),
        ).rejects.toBeInstanceOf(SignalSubscriptionFenceError);
        await expect(replica.upsertSubscription(createSampleSignalIdentity(), fence)).rejects.toBeInstanceOf(
          SignalSubscriptionFenceError,
        );
        expect(
          (await replica.updateSubscription({ ...ref(unowned.id), patch: { metadata: { a: 1 } } }))?.metadata,
        ).toEqual({ a: 1 });
      });

      it('deletes a mixed set atomically: all authorized rows or nothing', async () => {
        const owner = (await store.claimDocumentOwner(doc))!;
        const fence = { key: doc.key, fencingToken: owner.fencingToken };
        await store.upsertSubscription(ownedIdentity, fence);
        await store.upsertSubscription(createSampleSignalIdentity());
        await expect(replica.deleteSubscriptions({ agentId: SIGNAL_AGENT })).rejects.toBeInstanceOf(
          SignalSubscriptionFenceError,
        );
        expect(await store.countSubscriptions({ agentId: SIGNAL_AGENT })).toBe(2);
        expect(await replica.deleteSubscriptions({ agentId: SIGNAL_AGENT }, [fence])).toBe(2);
      });

      it('releases ownership only for the matching token once no rows remain, then reassigns a new token', async () => {
        const owner = (await store.claimDocumentOwner(doc))!;
        const fence = { key: doc.key, fencingToken: owner.fencingToken };
        const row = await store.upsertSubscription(ownedIdentity, fence);
        const release = { key: doc.key, agentId: doc.agentId, providerId: doc.providerId };
        expect(await replica.releaseDocumentOwner({ ...release, fencingToken: owner.fencingToken })).toBe(false);
        await store.deleteSubscription(ref(row.id), fence);
        expect(await replica.releaseDocumentOwner({ ...release, fencingToken: 'stale' })).toBe(false);
        expect(
          await replica.releaseDocumentOwner({ ...release, agentId: 'agent-b', fencingToken: owner.fencingToken }),
        ).toBe(false);
        expect(await replica.releaseDocumentOwner({ ...release, fencingToken: owner.fencingToken })).toBe(true);
        expect(await replica.releaseDocumentOwner({ ...release, fencingToken: owner.fencingToken })).toBe(false);

        const next = (await replica.claimDocumentOwner({ ...doc, agentId: 'agent-b' }))!;
        expect(next.fencingToken).not.toBe(owner.fencingToken);
        await expect(store.upsertSubscription(ownedIdentity, fence)).rejects.toBeInstanceOf(
          SignalSubscriptionFenceError,
        );
      });
    });

    describe('coordination locks', () => {
      it('grants one holder, renews only for the live owner, and hands over after expiry', async () => {
        const results = await Promise.all([
          store.claimCoordinationLock({ key: 'k', owner: 'a', ttlMs: TTL }),
          replica.claimCoordinationLock({ key: 'k', owner: 'b', ttlMs: TTL }),
          store.claimCoordinationLock({ key: 'k', owner: 'c', ttlMs: TTL }),
        ]);
        expect(results.filter(Boolean)).toHaveLength(1);
        const holder = ['a', 'b', 'c'][results.indexOf(true)]!;
        expect(await store.claimCoordinationLock({ key: 'k', owner: holder, ttlMs: TTL })).toBe(false);
        expect(await replica.renewCoordinationLock({ key: 'k', owner: 'z', ttlMs: TTL })).toBe(false);
        for (let beat = 0; beat < 2; beat++) {
          await sleep(TTL / 2);
          expect(await replica.renewCoordinationLock({ key: 'k', owner: holder, ttlMs: TTL })).toBe(true);
          expect(await store.claimCoordinationLock({ key: 'k', owner: 'z', ttlMs: TTL })).toBe(false);
        }
        await expire();
        expect(await store.claimCoordinationLock({ key: 'k', owner: 'z', ttlMs: TTL })).toBe(true);
        expect(await replica.renewCoordinationLock({ key: 'k', owner: holder, ttlMs: TTL })).toBe(false);
        expect(await replica.releaseCoordinationLock({ key: 'k', owner: holder })).toBe(false);
        expect(await replica.releaseCoordinationLock({ key: 'k', owner: 'z' })).toBe(true);
        expect(await store.claimCoordinationLock({ key: 'k', owner: 'y', ttlMs: TTL })).toBe(true);
      });
    });

    describe('delivery ledger', () => {
      it('walks new, live, expired, and delivered states with owner-conditional transitions', async () => {
        const { id } = await store.upsertSubscription(createSampleSignalIdentity());
        const delivery = { subscriptionId: id, deliveryId: 'delivery-1' };
        const results = await Promise.all([
          store.claimDelivery({ ...delivery, owner: 'a', ttlMs: TTL }),
          replica.claimDelivery({ ...delivery, owner: 'b', ttlMs: TTL }),
          store.claimDelivery({ ...delivery, owner: 'c', ttlMs: TTL }),
        ]);
        expect(results.filter(result => result === 'claimed')).toHaveLength(1);
        expect(results.filter(result => result === 'in-progress')).toHaveLength(2);
        const holder = ['a', 'b', 'c'][results.indexOf('claimed')]!;

        const pending = await replica.getDelivery(delivery);
        expect(pending).toMatchObject({ status: 'pending', owner: holder });
        expect(pending?.status === 'pending' && typeof pending.expiresAt).toBe('number');
        expect(await store.claimDelivery({ ...delivery, owner: holder, ttlMs: TTL })).toBe('in-progress');
        expect(await store.claimDelivery({ ...delivery, owner: 'z', ttlMs: TTL })).toBe('in-progress');
        expect(await replica.renewDeliveryClaim({ ...delivery, owner: 'z', ttlMs: TTL })).toBe(false);
        expect(await replica.renewDeliveryClaim({ ...delivery, owner: holder, ttlMs: TTL })).toBe(true);

        await expire();
        expect(await replica.renewDeliveryClaim({ ...delivery, owner: holder, ttlMs: TTL })).toBe(false);
        const takeovers = await Promise.all([
          store.claimDelivery({ ...delivery, owner: 'x', ttlMs: LONG }),
          replica.claimDelivery({ ...delivery, owner: 'y', ttlMs: LONG }),
        ]);
        expect([...takeovers].sort()).toEqual(['claimed', 'in-progress']);
        const taker = takeovers[0] === 'claimed' ? 'x' : 'y';
        expect(await store.completeDelivery({ ...delivery, owner: holder })).toBe(false);
        expect(await store.releaseDelivery({ ...delivery, owner: holder })).toBe(false);
        expect(await replica.completeDelivery({ ...delivery, owner: taker })).toBe(true);
        expect(await replica.completeDelivery({ ...delivery, owner: taker })).toBe(false);

        const delivered = await store.getDelivery(delivery);
        expect(delivered).toMatchObject({ status: 'delivered' });
        expect(delivered).not.toHaveProperty('owner');
        expect(delivered).not.toHaveProperty('expiresAt');
        expect(await replica.renewDeliveryClaim({ ...delivery, owner: taker, ttlMs: TTL })).toBe(false);
        expect(await replica.releaseDelivery({ ...delivery, owner: taker })).toBe(false);
        expect(await store.claimDelivery({ ...delivery, owner: 'late', ttlMs: TTL })).toBe('delivered');
      });

      it('releases a pending claim for retry and keeps delivered ids for the subscription lifetime', async () => {
        const { id } = await store.upsertSubscription(createSampleSignalIdentity());
        const retry = { subscriptionId: id, deliveryId: 'retry' };
        await store.claimDelivery({ ...retry, owner: 'a', ttlMs: LONG });
        expect(await replica.releaseDelivery({ ...retry, owner: 'b' })).toBe(false);
        expect(await replica.releaseDelivery({ ...retry, owner: 'a' })).toBe(true);
        expect(await replica.getDelivery(retry)).toBeNull();
        expect(await replica.claimDelivery({ ...retry, owner: 'b', ttlMs: TTL })).toBe('claimed');

        const done = { subscriptionId: id, deliveryId: 'done' };
        await store.claimDelivery({ ...done, owner: 'a', ttlMs: TTL });
        await store.completeDelivery({ ...done, owner: 'a' });
        await expire();
        expect(await replica.claimDelivery({ ...done, owner: 'b', ttlMs: TTL })).toBe('delivered');
        expect((await replica.getDelivery(done))?.status).toBe('delivered');

        await store.deleteSubscription(ref(id));
        expect(await replica.getDelivery(done)).toBeNull();
        expect(await replica.getDelivery(retry)).toBeNull();
      });
    });
  });
}
