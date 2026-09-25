import { SignalSubscriptionFenceError } from '@mastra/core/storage';
import type { SignalSubscriptionIdentity } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PostgresStore } from '../..';
import { connectionString, TEST_CONFIG } from '../../test-utils';
import { SignalSubscriptionsPG } from './index';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const TTL = 300;
const CADENCE = 60_000;

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

describe('SignalSubscriptionsPG', () => {
  let pools: Pool[];
  let store: SignalSubscriptionsPG;
  let replica: SignalSubscriptionsPG;

  beforeAll(async () => {
    pools = [new Pool({ connectionString }), new Pool({ connectionString })];
    store = new SignalSubscriptionsPG({ pool: pools[0]! });
    replica = new SignalSubscriptionsPG({ pool: pools[1]! });
    await store.init();
    await replica.init();
  });

  afterAll(async () => {
    await Promise.all(pools.map(pool => pool.end()));
  });

  beforeEach(async () => {
    await store.dangerouslyClearAll();
  });

  it('reports persistent durability and is registered on PostgresStore', async () => {
    expect(store.durability).toBe('persistent');
    const pg = new PostgresStore(TEST_CONFIG);
    try {
      await pg.init();
      expect(await pg.getStore('signalSubscriptions')).toBeInstanceOf(SignalSubscriptionsPG);
    } finally {
      await pg.close();
    }
  });

  it('creates the identity, webhook, due-scan, delivery, and coordination indexes', async () => {
    const indexes = await pools[0]!.query<{ name: string; unique: boolean; columns: string[] }>(
      `SELECT i.relname AS name, ix.indisunique AS unique,
              array_agg(a.attname::text ORDER BY k.ord) AS columns
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_namespace n ON n.oid = i.relnamespace
       CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
       JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k.attnum
       WHERE n.nspname = 'public' AND NOT ix.indisprimary AND i.relname LIKE 'mastra_signal_subscription%'
       GROUP BY i.relname, ix.indisunique
       ORDER BY i.relname`,
    );
    expect(indexes.rows).toEqual([
      { name: 'mastra_signal_subscription_coordination_key_uq', unique: true, columns: ['kind', 'key'] },
      {
        name: 'mastra_signal_subscription_deliveries_uq',
        unique: true,
        columns: ['subscriptionId', 'deliveryId'],
      },
      {
        name: 'mastra_signal_subscriptions_due_idx',
        unique: false,
        columns: ['agentId', 'providerId', 'enabled', 'nextPollAt'],
      },
      {
        name: 'mastra_signal_subscriptions_identity_uq',
        unique: true,
        columns: ['agentId', 'providerId', 'resourceId', 'threadId', 'externalResourceId'],
      },
      {
        name: 'mastra_signal_subscriptions_webhook_idx',
        unique: false,
        columns: ['agentId', 'providerId', 'externalResourceId'],
      },
    ]);
  });

  it('exports table and index DDL matching init', () => {
    const ddl = SignalSubscriptionsPG.getExportDDL().join('\n');
    for (const table of [
      'mastra_signal_subscriptions',
      'mastra_signal_subscription_deliveries',
      'mastra_signal_subscription_coordination',
    ]) {
      expect(ddl).toContain(`CREATE TABLE IF NOT EXISTS "public"."${table}"`);
    }
    expect(ddl).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "mastra_signal_subscriptions_identity_uq" ON "public"."mastra_signal_subscriptions" ("agentId", "providerId", "resourceId", "threadId", "externalResourceId");',
    );
    expect(ddl).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "mastra_signal_subscription_deliveries_uq" ON "public"."mastra_signal_subscription_deliveries" ("subscriptionId", "deliveryId");',
    );
    expect(ddl).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "mastra_signal_subscription_coordination_key_uq" ON "public"."mastra_signal_subscription_coordination" ("kind", "key");',
    );
    expect(ddl).toContain(
      'CREATE INDEX IF NOT EXISTS "mastra_signal_subscriptions_webhook_idx" ON "public"."mastra_signal_subscriptions" ("agentId", "providerId", "externalResourceId");',
    );
    expect(ddl).toContain(
      'CREATE INDEX IF NOT EXISTS "mastra_signal_subscriptions_due_idx" ON "public"."mastra_signal_subscriptions" ("agentId", "providerId", "enabled", "nextPollAt");',
    );
  });

  it('keeps index names distinct and within the identifier limit under long schema names', () => {
    const { unique, lookup } = SignalSubscriptionsPG.getIndexDefs('tenant_' + 'x'.repeat(50));
    const names = [...unique, ...lookup].map(index => index.name);
    expect(new Set(names).size).toBe(5);
    for (const name of names) expect(Buffer.byteLength(name)).toBeLessThanOrEqual(63);
    expect(unique.every(index => index.unique)).toBe(true);
  });

  it('round-trips camelCase columns', async () => {
    const columns = await pools[0]!.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mastra_signal_subscriptions'`,
    );
    expect(columns.rows.map(row => row.column_name)).toEqual(
      expect.arrayContaining(['agentId', 'externalResourceId', 'claimExpiresAt', 'nextPollAt', 'operationOwner']),
    );
    const created = await store.upsertSubscription({ ...identity(), metadata: { k: 'v' } });
    await store.claimSubscription({ agentId: 'agent-a', id: created.id, owner: 'o', ttlMs: TTL, cadenceMs: CADENCE });
    const read = await replica.getSubscriptionById({ agentId: 'agent-a', id: created.id });
    expect(read).toMatchObject({ ...identity(), metadata: { k: 'v' }, enabled: true, claimOwner: 'o' });
    expect(typeof read?.claimExpiresAt).toBe('number');
    expect(read?.nextPollAt).toBeInstanceOf(Date);
  });

  it('upserts by five-part identity and merges on conflict', async () => {
    const created = await store.upsertSubscription({
      ...identity(),
      metadata: { a: 1, nested: { x: 1 } },
      deliveryOptions: { ifIdle: true },
    });
    await store.claimSubscription({ agentId: 'agent-a', id: created.id, owner: 'o', ttlMs: 60_000, cadenceMs: CADENCE });
    await store.updateSubscription({ agentId: 'agent-a', id: created.id, patch: { cursor: { page: 2 } } });

    const merged = await replica.upsertSubscription({ ...identity(), metadata: { nested: { y: 2 }, b: true } });
    expect(merged).toMatchObject({
      id: created.id,
      metadata: { a: 1, nested: { y: 2 }, b: true },
      deliveryOptions: { ifIdle: true },
      enabled: true,
      claimOwner: 'o',
      cursor: { page: 2 },
    });
    expect(merged.createdAt).toEqual(created.createdAt);
    expect(merged.nextPollAt).toBeInstanceOf(Date);
    expect((await store.upsertSubscription({ ...identity(), enabled: false, deliveryOptions: {} })).enabled).toBe(false);
    expect((await store.upsertSubscription(identity())).enabled).toBe(false);

    for (const variant of [
      identity({ agentId: 'agent-b' }),
      identity({ providerId: 'p2' }),
      identity({ resourceId: 'r2' }),
      identity({ threadId: 't2' }),
      identity({ externalResourceId: 'e2' }),
    ]) {
      expect((await store.upsertSubscription(variant)).id).not.toBe(created.id);
    }
    expect(await store.getSubscriptionById({ agentId: 'agent-b', id: created.id })).toBeNull();
    expect(await store.countSubscriptions({ agentId: 'agent-a' })).toBe(5);
  });

  it('lists in one statement snapshot with stable order, consistent totals, and offset-only pages', async () => {
    for (let i = 0; i < 7; i++) {
      await store.upsertSubscription({ ...identity({ externalResourceId: `ext-${i}` }), id: `id-${i}` });
    }
    const all = await store.listSubscriptions({ agentId: 'agent-a' });
    expect(all.total).toBe(7);
    const sorted = [...all.subscriptions].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    expect(all.subscriptions.map(s => s.id)).toEqual(sorted.map(s => s.id));

    const pages: string[] = [];
    for (let offset = 0; offset < 7; offset += 3) {
      const page = await replica.listSubscriptions({ agentId: 'agent-a', limit: 3, offset });
      expect(page.total).toBe(7);
      pages.push(...page.subscriptions.map(s => s.id));
    }
    expect(pages).toEqual(all.subscriptions.map(s => s.id));
    expect((await store.listSubscriptions({ agentId: 'agent-a', offset: 5 })).subscriptions.map(s => s.id)).toEqual(
      all.subscriptions.slice(5).map(s => s.id),
    );
    expect(await store.listSubscriptions({ agentId: 'agent-a', offset: 7 })).toEqual({ subscriptions: [], total: 7 });
    expect(await store.listSubscriptions({ agentId: 'agent-a', limit: 2, offset: 9 })).toEqual({
      subscriptions: [],
      total: 7,
    });
    expect(await store.listSubscriptions({ agentId: 'nobody' })).toEqual({ subscriptions: [], total: 0 });
    expect(await store.listSubscriptions({ agentId: 'agent-a', enabled: false, limit: 1 })).toEqual({
      subscriptions: [],
      total: 0,
    });
    expect(
      await store.listSubscriptionsForResource({
        agentId: 'agent-a',
        providerId: 'webhook-signals',
        externalResourceId: 'ext-3',
      }),
    ).toHaveLength(1);
  });

  it('lets exactly one replica claim a due row and preserves the reserved cadence after release', async () => {
    const { id } = await store.upsertSubscription(identity());
    const ref = { agentId: 'agent-a', id };
    const results = await Promise.all(
      [store, replica, store, replica].map((s, i) =>
        s.claimSubscription({ ...ref, owner: `r${i}`, ttlMs: TTL, cadenceMs: CADENCE }),
      ),
    );
    const winners = results.filter(Boolean);
    expect(winners).toHaveLength(1);
    const reserved = winners[0]!.nextPollAt!;
    const winner = winners[0]!.claimOwner!;

    expect(await store.releaseSubscriptionClaim({ ...ref, owner: winner })).toBe(true);
    expect(await replica.claimSubscription({ ...ref, owner: 'late', ttlMs: TTL, cadenceMs: CADENCE })).toBeNull();
    expect((await replica.getSubscriptionById(ref))?.nextPollAt).toEqual(reserved);
  });

  it('forces past the cadence but never a live owner, and reserves the next cadence', async () => {
    const { id } = await store.upsertSubscription(identity());
    const ref = { agentId: 'agent-a', id };
    await store.claimSubscription({ ...ref, owner: 'a', ttlMs: 60_000, cadenceMs: CADENCE });
    expect(await replica.claimSubscription({ ...ref, owner: 'b', ttlMs: TTL, cadenceMs: CADENCE, force: true })).toBeNull();
    await store.releaseSubscriptionClaim({ ...ref, owner: 'a' });
    const before = Date.now();
    const forced = await replica.claimSubscription({ ...ref, owner: 'b', ttlMs: TTL, cadenceMs: 5_000, force: true });
    expect(forced?.claimOwner).toBe('b');
    expect(forced!.nextPollAt!.getTime()).toBeGreaterThanOrEqual(before + 5_000 - 50);
    await replica.releaseSubscriptionClaim({ ...ref, owner: 'b' });
    expect(await store.claimSubscription({ ...ref, owner: 'c', ttlMs: TTL, cadenceMs: CADENCE })).toBeNull();
  });

  it('takes over an expired claim using database time and preserves nextPollAt', async () => {
    const { id } = await store.upsertSubscription(identity());
    const ref = { agentId: 'agent-a', id };
    const first = await store.claimSubscription({ ...ref, owner: 'a', ttlMs: TTL, cadenceMs: CADENCE });
    expect(await replica.claimSubscription({ ...ref, owner: 'b', ttlMs: TTL, cadenceMs: CADENCE })).toBeNull();
    await sleep(TTL + 50);
    const takeover = await replica.claimSubscription({ ...ref, owner: 'b', ttlMs: TTL, cadenceMs: CADENCE });
    expect(takeover).toMatchObject({ claimOwner: 'b' });
    expect(takeover?.nextPollAt).toEqual(first?.nextPollAt);
    expect(await store.validateSubscriptionClaimIfEnabled({ ...ref, owner: 'a' })).toBe(false);
    expect(await store.renewSubscriptionClaimIfEnabled({ ...ref, owner: 'a', ttlMs: TTL })).toBe(false);
  });

  it('keeps work exclusive across heartbeats and fails renewal once disabled or operation-staged', async () => {
    const { id } = await store.upsertSubscription(identity());
    const ref = { agentId: 'agent-a', id };
    await store.claimSubscription({ ...ref, owner: 'a', ttlMs: TTL, cadenceMs: CADENCE });
    for (let beat = 0; beat < 3; beat++) {
      await sleep(TTL / 2);
      expect(await store.renewSubscriptionClaimIfEnabled({ ...ref, owner: 'a', ttlMs: TTL })).toBe(true);
      expect(await replica.claimSubscription({ ...ref, owner: 'b', ttlMs: TTL, cadenceMs: CADENCE })).toBeNull();
    }
    expect(await store.validateSubscriptionClaimIfEnabled({ ...ref, owner: 'a' })).toBe(true);

    await replica.setSubscriptionEnabled({ ...ref, enabled: false });
    expect(await store.renewSubscriptionClaimIfEnabled({ ...ref, owner: 'a', ttlMs: TTL })).toBe(false);
    expect(await store.validateSubscriptionClaimIfEnabled({ ...ref, owner: 'a' })).toBe(false);

    await store.setSubscriptionEnabled({ ...ref, enabled: true });
    expect(await store.validateSubscriptionClaimIfEnabled({ ...ref, owner: 'a' })).toBe(true);
    await replica.beginSubscriptionOperation({ ...ref, kind: 'unsubscribe', owner: 'op', ttlMs: 60_000 });
    expect(await store.validateSubscriptionClaimIfEnabled({ ...ref, owner: 'a' })).toBe(false);
  });

  it('stages membership operations with owner-conditional commit, renewal, and expired takeover', async () => {
    const inserted = await store.insertSubscribingSubscription({ ...identity(), owner: 'op', ttlMs: 60_000 });
    expect(inserted).toMatchObject({ enabled: false, operationKind: 'subscribe', operationOwner: 'op' });
    expect(await replica.insertSubscribingSubscription({ ...identity(), owner: 'op2', ttlMs: TTL })).toBeNull();
    const ref = { agentId: 'agent-a', id: inserted!.id };
    expect(await replica.claimSubscription({ ...ref, owner: 'p', ttlMs: TTL, cadenceMs: CADENCE })).toBeNull();
    expect(await replica.commitSubscribe({ ...ref, owner: 'op2' })).toBeNull();
    expect((await store.commitSubscribe({ ...ref, owner: 'op' }))?.enabled).toBe(true);

    await store.claimSubscription({ ...ref, owner: 'p', ttlMs: 60_000, cadenceMs: CADENCE });
    expect(await store.beginSubscriptionOperation({ ...ref, kind: 'subscribe', owner: 'x', ttlMs: TTL })).toBeNull();
    expect(
      await store.beginSubscriptionOperation({ ...ref, kind: 'unsubscribe', owner: 'u1', ttlMs: TTL }),
    ).toMatchObject({ operationKind: 'unsubscribe', operationOwner: 'u1' });
    expect(await replica.beginSubscriptionOperation({ ...ref, kind: 'unsubscribe', owner: 'u2', ttlMs: TTL })).toBeNull();
    expect(await store.renewSubscriptionOperation({ ...ref, owner: 'u2', ttlMs: TTL })).toBe(false);
    expect(await store.renewSubscriptionOperation({ ...ref, owner: 'u1', ttlMs: TTL })).toBe(true);
    await store.setSubscriptionEnabled({ ...ref, enabled: false });
    // A live poll claim blocks the delete.
    expect(await store.commitUnsubscribe({ ...ref, owner: 'u1' })).toBe(false);
    await store.releaseSubscriptionClaim({ ...ref, owner: 'p' });

    await sleep(TTL + 50);
    expect(await store.commitUnsubscribe({ ...ref, owner: 'u1' })).toBe(false);
    expect(
      await replica.beginSubscriptionOperation({ ...ref, kind: 'unsubscribe', owner: 'u2', ttlMs: 60_000 }),
    ).not.toBeNull();
    expect(await store.abortSubscriptionOperation({ ...ref, owner: 'u1' })).toBe(false);
    await store.claimDelivery({ subscriptionId: ref.id, deliveryId: 'd', owner: 'o', ttlMs: TTL });
    expect(await replica.commitUnsubscribe({ ...ref, owner: 'u2' })).toBe(true);
    expect(await store.getSubscriptionById(ref)).toBeNull();
    expect(await store.getDelivery({ subscriptionId: ref.id, deliveryId: 'd' })).toBeNull();
  });

  it('fences owned documents and releases ownership only when no rows remain', async () => {
    const doc = { key: 'doc-1', agentId: 'agent-a', providerId: 'github', resourceId: 'resource-1', threadId: 'thread-1' };
    const owner = (await store.claimDocumentOwner(doc))!;
    expect((await replica.claimDocumentOwner(doc))?.fencingToken).toBe(owner.fencingToken);
    expect(await replica.claimDocumentOwner({ ...doc, agentId: 'agent-b' })).toBeNull();
    const fence = { key: doc.key, fencingToken: owner.fencingToken };
    const ownedIdentity = identity({ providerId: 'github' });

    await expect(store.upsertSubscription(ownedIdentity)).rejects.toBeInstanceOf(SignalSubscriptionFenceError);
    await expect(store.upsertSubscription(ownedIdentity, { ...fence, fencingToken: 'stale' })).rejects.toBeInstanceOf(
      SignalSubscriptionFenceError,
    );
    await expect(store.upsertSubscription({ ...ownedIdentity, agentId: 'agent-b' }, fence)).rejects.toBeInstanceOf(
      SignalSubscriptionFenceError,
    );
    const row = await store.upsertSubscription(ownedIdentity, fence);
    const generic = await store.upsertSubscription(identity());
    const ref = { agentId: 'agent-a', id: row.id };
    await expect(store.updateSubscription({ ...ref, patch: {} })).rejects.toBeInstanceOf(SignalSubscriptionFenceError);
    await expect(store.setSubscriptionEnabled({ ...ref, enabled: false })).rejects.toBeInstanceOf(
      SignalSubscriptionFenceError,
    );
    await expect(store.deleteSubscription(ref)).rejects.toBeInstanceOf(SignalSubscriptionFenceError);
    await expect(store.deleteSubscriptions({ agentId: 'agent-a' })).rejects.toBeInstanceOf(
      SignalSubscriptionFenceError,
    );
    await expect(
      store.updateSubscription({ agentId: 'agent-a', id: generic.id, patch: {} }, fence),
    ).rejects.toBeInstanceOf(SignalSubscriptionFenceError);
    expect(await store.countSubscriptions({ agentId: 'agent-a' })).toBe(2);

    expect(await store.releaseDocumentOwner({ ...doc, fencingToken: owner.fencingToken })).toBe(false);
    expect(await store.deleteSubscriptions({ agentId: 'agent-a' }, [fence])).toBe(2);
    expect(await store.releaseDocumentOwner({ ...doc, fencingToken: 'wrong' })).toBe(false);
    expect(await store.releaseDocumentOwner({ ...doc, fencingToken: owner.fencingToken })).toBe(true);

    const reassigned = (await replica.claimDocumentOwner(doc))!;
    expect(reassigned.fencingToken).not.toBe(owner.fencingToken);
    await expect(store.upsertSubscription(ownedIdentity, fence)).rejects.toBeInstanceOf(SignalSubscriptionFenceError);
  });

  it('lists document owners with stable order, filters, and consistent totals', async () => {
    for (const key of ['k-c', 'k-a', 'k-b']) {
      await store.claimDocumentOwner({ key, agentId: 'agent-a', providerId: 'github', resourceId: 'r', threadId: key });
    }
    const all = await replica.listDocumentOwners({});
    expect(all.total).toBe(3);
    const sorted = [...all.owners].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    );
    expect(all.owners.map(o => o.key)).toEqual(sorted.map(o => o.key));
    expect((await store.listDocumentOwners({ offset: 1 })).owners.map(o => o.key)).toEqual(
      all.owners.slice(1).map(o => o.key),
    );
    expect(await store.listDocumentOwners({ offset: 3 })).toEqual({ owners: [], total: 3 });
    expect(await store.listDocumentOwners({ limit: 1, offset: 4 })).toEqual({ owners: [], total: 3 });
    expect(await store.listDocumentOwners({ agentId: 'nobody' })).toEqual({ owners: [], total: 0 });
    expect((await store.listDocumentOwners({ threadId: 'k-b', limit: 5 })).owners.map(o => o.key)).toEqual(['k-b']);
  });

  it('grants a coordination lock to one replica with expiry takeover and owner renewal', async () => {
    const results = await Promise.all([
      store.claimCoordinationLock({ key: 'doc', owner: 'a', ttlMs: TTL }),
      replica.claimCoordinationLock({ key: 'doc', owner: 'b', ttlMs: TTL }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const holder = results[0] ? 'a' : 'b';
    const other = holder === 'a' ? 'b' : 'a';
    expect(await store.renewCoordinationLock({ key: 'doc', owner: other, ttlMs: TTL })).toBe(false);
    expect(await store.renewCoordinationLock({ key: 'doc', owner: holder, ttlMs: TTL })).toBe(true);
    await sleep(TTL + 50);
    expect(await replica.claimCoordinationLock({ key: 'doc', owner: other, ttlMs: TTL })).toBe(true);
    expect(await store.renewCoordinationLock({ key: 'doc', owner: holder, ttlMs: TTL })).toBe(false);
    expect(await store.releaseCoordinationLock({ key: 'doc', owner: holder })).toBe(false);
    expect(await store.releaseCoordinationLock({ key: 'doc', owner: other })).toBe(true);
    await store.claimDocumentOwner({ key: 'doc', ...identity() });
    expect(await store.claimCoordinationLock({ key: 'doc', owner: 'a', ttlMs: TTL })).toBe(true);
  });

  it('runs the delivery ledger with one claimant, renewal, expiry takeover, and lifetime retention', async () => {
    const { id } = await store.upsertSubscription(identity());
    const ref = { subscriptionId: id, deliveryId: 'delivery-1' };
    const results = await Promise.all([
      store.claimDelivery({ ...ref, owner: 'a', ttlMs: TTL }),
      replica.claimDelivery({ ...ref, owner: 'b', ttlMs: TTL }),
    ]);
    expect([...results].sort()).toEqual(['claimed', 'in-progress']);
    const holder = results[0] === 'claimed' ? 'a' : 'b';
    const other = holder === 'a' ? 'b' : 'a';
    expect(await store.claimDelivery({ ...ref, owner: holder, ttlMs: TTL })).toBe('in-progress');
    expect(await store.renewDeliveryClaim({ ...ref, owner: other, ttlMs: TTL })).toBe(false);
    expect(await store.renewDeliveryClaim({ ...ref, owner: holder, ttlMs: TTL })).toBe(true);

    await sleep(TTL + 50);
    expect(await replica.claimDelivery({ ...ref, owner: other, ttlMs: 60_000 })).toBe('claimed');
    expect(await store.completeDelivery({ ...ref, owner: holder })).toBe(false);
    expect(await store.releaseDelivery({ ...ref, owner: holder })).toBe(false);
    expect(await replica.completeDelivery({ ...ref, owner: other })).toBe(true);
    const delivered = await store.getDelivery(ref);
    expect(delivered).toMatchObject({ status: 'delivered' });
    expect(delivered?.owner).toBeUndefined();
    expect(delivered?.expiresAt).toBeUndefined();
    expect(await store.releaseDelivery({ ...ref, owner: other })).toBe(false);
    expect(await store.claimDelivery({ ...ref, owner: 'c', ttlMs: TTL })).toBe('delivered');

    await store.claimDelivery({ subscriptionId: id, deliveryId: 'delivery-2', owner: 'a', ttlMs: TTL });
    expect(await store.releaseDelivery({ subscriptionId: id, deliveryId: 'delivery-2', owner: 'a' })).toBe(true);
    expect(await store.claimDelivery({ subscriptionId: id, deliveryId: 'delivery-2', owner: 'b', ttlMs: TTL })).toBe(
      'claimed',
    );

    expect(await store.deleteSubscription({ agentId: 'agent-a', id })).toBe(true);
    expect(await store.getDelivery(ref)).toBeNull();
    expect(await store.isEmpty()).toBe(true);
  });

  it('reports isEmpty across subscriptions, deliveries, locks, and owners', async () => {
    expect(await store.isEmpty()).toBe(true);
    await store.claimDelivery({ subscriptionId: 's', deliveryId: 'd', owner: 'o', ttlMs: TTL });
    expect(await store.isEmpty()).toBe(false);
    await store.dangerouslyClearAll();
    await store.claimCoordinationLock({ key: 'k', owner: 'o', ttlMs: TTL });
    expect(await store.isEmpty()).toBe(false);
    await store.dangerouslyClearAll();
    await store.claimDocumentOwner({ key: 'k', ...identity() });
    expect(await replica.isEmpty()).toBe(false);
    await store.dangerouslyClearAll();
    await store.upsertSubscription(identity());
    expect(await store.isEmpty()).toBe(false);
    await store.dangerouslyClearAll();
    expect(await store.isEmpty()).toBe(true);
  });
});
