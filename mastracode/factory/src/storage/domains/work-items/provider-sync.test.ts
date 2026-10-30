import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { MastraFactory } from '../../../factory.js';
import { createFactorySecretEncryption } from '../../../secret-encryption.js';
import { migrateWorkItemSplit } from '../../../work-items/split-migration.js';
import { createFactoryStorageForTests, createIsolatedFactoryPostgresForTests } from '../../test-utils.js';
import { externalSourceKey } from './base.js';
import { Cards } from './cards.js';
import { FACTORY_BOARD_ITEMS_SCHEMA } from './work-item-schema.js';
import type { WorkItemSourceDbRecord } from './work-item-schema.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('provider sync on %s', backend => {
  async function setup() {
    const storage =
      backend === 'postgres'
        ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
        : new LibSQLFactoryStorage({ id: 'sync-test', url: ':memory:' });
    const { workItems, comments } = await createFactoryStorageForTests(storage);
    const orgId = randomUUID();
    const scope = { orgId, factoryProjectId: 'project', userId: 'user' };
    const { item } = await workItems.upsert({
      ...scope,
      input: {
        title: 'Original issue',
        board: 'work',
        stages: ['intake'],
        externalSource: { integrationId: 'github', type: 'issue', externalId: orgId },
        metadata: { state: 'open', labels: ['bug'], author: 'reporter', authorTrusted: false },
      },
    });
    const sync = () =>
      workItems.update({
        ...scope,
        id: item.id,
        patch: {
          title: 'Updated issue',
          metadata: { state: 'closed', labels: ['fixed'], author: 'maintainer' },
        },
      });
    return { storage, workItems, comments, scope, item, sync };
  }

  async function separateReplica(storage: Awaited<ReturnType<typeof setup>>['storage']) {
    const database = storage.authDatabase?.();
    if (database?.dialect !== 'postgres') throw new Error('This regression requires independent Postgres connections.');
    const searchPath = await database.pool.query('SHOW search_path');
    const url = new URL(postgresUrl!);
    url.searchParams.set('options', `-c search_path=${searchPath.rows[0].search_path}`);
    // Separate only the domain module so replicas have independent project-lock
    // maps but share the storage error classes used by the rest of the suite.
    const replicaModule = './base.js?replica';
    const replicaBase: typeof import('./base.js') = await import(replicaModule);
    const { PgFactoryStorage } = await import('@mastra/pg');
    const replicaStorage = new PgFactoryStorage({ id: 'delete-replica', connectionString: url.toString() });
    const replica = {
      storage: replicaStorage,
      workItems: replicaStorage.registerDomain(new replicaBase.WorkItemsStorage()),
    };
    onTestFinished(() => replicaStorage.close());
    await replicaStorage.init();
    return replica;
  }

  it('refuses to boot Factory in dry-run mode over migrated cards even though domains initialize fail-soft', async () => {
    const storage =
      backend === 'postgres'
        ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
        : new LibSQLFactoryStorage({ id: 'startup-test', url: ':memory:' });
    onTestFinished(() => storage.close());
    await storage.init();
    await storage.ensureCollections([FACTORY_BOARD_ITEMS_SCHEMA]);
    const id = randomUUID();
    await storage.ops.insertOne(FACTORY_BOARD_ITEMS_SCHEMA.name, {
      id,
      org_id: randomUUID(),
      factory_project_id: randomUUID(),
      work_item_id: randomUUID(),
      board: 'work',
      parent_board_item_id: null,
      stages: ['intake'],
      stage_history: [],
      sessions: {},
      metadata: null,
      revision: 1,
      created_by: 'user',
      created_at: new Date(),
      updated_at: new Date(),
      migrated_from_updated_at: null,
      migrated_from_hash: null,
    });
    vi.stubEnv('MASTRA_FACTORY_WORK_ITEM_SPLIT', 'dry-run');
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    try {
      const factory = new MastraFactory({
        storage,
        auth: null,
        mcp: false,
        secretEncryption: createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } }),
      });
      await expect(factory.prepare()).rejects.toThrow('cannot serve a database with migrated board items');
      expect(await storage.ops.findOne(FACTORY_BOARD_ITEMS_SCHEMA.name, { id })).not.toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.skipIf(backend !== 'postgres')(
    'finishes a legacy child-to-parent claim handoff while another replica deletes the parent',
    async () => {
      const { storage, workItems, scope, item: parent } = await setup();
      const claimKey = 'child-to-parent';
      const { item: child } = await workItems.upsert({
        ...scope,
        input: { title: 'Child', parentWorkItemId: parent.id, claimKey },
      });
      for (const card of await new Cards(storage.ops).findMany({ org_id: scope.orgId })) {
        delete card.work_item;
        delete card.work_item_sources;
        await storage.ops.insertOne('work_items', card);
      }
      await storage.ops.deleteMany('factory_board_items', { org_id: scope.orgId });
      await storage.ops.deleteMany('factory_work_items', { org_id: scope.orgId });
      await storage.ops.deleteMany('factory_work_item_sources', { org_id: scope.orgId });
      await migrateWorkItemSplit(storage);
      const replica = await separateReplica(storage);
      await storage.ops.updateMany('work_items', { id: child.id }, { claim_key: null });
      await storage.ops.updateMany('work_items', { id: parent.id }, { claim_key: claimKey });
      let parentDeleted!: () => void;
      const afterParentDelete = new Promise<void>(resolve => {
        parentDeleted = resolve;
      });
      let childLocked!: () => void;
      const afterChildLock = new Promise<void>(resolve => {
        childLocked = resolve;
      });
      let detachAttempted!: () => void;
      const afterDetachAttempt = new Promise<void>(resolve => {
        detachAttempted = resolve;
      });
      const deletionTransaction = storage.withTransaction.bind(storage);
      vi.spyOn(storage, 'withTransaction').mockImplementation((fn, options) =>
        deletionTransaction(
          ops =>
            fn(
              new Proxy(ops, {
                get(target, property) {
                  if (property === 'upsertOne')
                    return async (...args: Parameters<typeof ops.upsertOne>) => {
                      const row = await target.upsertOne(...args);
                      if (args[0] === 'factory_board_item_tombstones' && args[2].id === parent.id) {
                        parentDeleted();
                        await afterChildLock;
                      }
                      return row;
                    };
                  if (property === 'updateAtomic')
                    return async (...args: Parameters<typeof ops.updateAtomic>) => {
                      if (args[0] === 'factory_board_items' && args[1].id === child.id) detachAttempted();
                      return target.updateAtomic(...args);
                    };
                  const value = Reflect.get(target, property);
                  return typeof value === 'function' ? value.bind(target) : value;
                },
              }),
            ),
          options,
        ),
      );
      const migrationTransaction = replica.storage.withTransaction.bind(replica.storage);
      vi.spyOn(replica.storage, 'withTransaction').mockImplementation((fn, options) =>
        migrationTransaction(
          ops =>
            fn(
              new Proxy(ops, {
                get(target, property) {
                  if (property === 'updateAtomic')
                    return async (...args: Parameters<typeof ops.updateAtomic>) => {
                      const row = await target.updateAtomic(...args);
                      if (args[0] === 'factory_board_items' && args[1].id === child.id) {
                        childLocked();
                        await afterDetachAttempt;
                      }
                      return row;
                    };
                  const value = Reflect.get(target, property);
                  return typeof value === 'function' ? value.bind(target) : value;
                },
              }),
            ),
          options,
        ),
      );
      const deletion = workItems.delete({ orgId: scope.orgId, id: parent.id });
      await afterParentDelete;
      const outcomes = await Promise.allSettled([deletion, migrateWorkItemSplit(replica.storage)]);
      expect(outcomes.filter(outcome => outcome.status === 'rejected')).toEqual([]);
      expect(await workItems.get({ orgId: scope.orgId, id: parent.id })).toBeNull();
      expect(await workItems.get({ orgId: scope.orgId, id: child.id })).toMatchObject({
        parentWorkItemId: null,
        claimKey: null,
      });
      expect(await workItems.getByClaimKey({ orgId: scope.orgId, claimKey })).toBeNull();
    },
  );

  it.skipIf(backend !== 'postgres')(
    'lets separate replicas delete a parent and child concurrently without deadlocks',
    async () => {
      const { storage, workItems, scope, item: parent } = await setup();
      const { item: child } = await workItems.upsert({
        ...scope,
        input: { title: 'Child', parentWorkItemId: parent.id },
      });
      const replica = await separateReplica(storage);
      let parentDeleted!: () => void;
      const afterParentDelete = new Promise<void>(resolve => {
        parentDeleted = resolve;
      });
      let childLocked!: () => void;
      const afterChildLock = new Promise<void>(resolve => {
        childLocked = resolve;
      });
      const parentTransaction = storage.withTransaction.bind(storage);
      vi.spyOn(storage, 'withTransaction').mockImplementation((fn, options) =>
        parentTransaction(
          ops =>
            fn(
              new Proxy(ops, {
                get(target, property) {
                  if (property === 'upsertOne')
                    return async (...args: Parameters<typeof ops.upsertOne>) => {
                      const row = await target.upsertOne(...args);
                      if (args[0] === 'factory_board_item_tombstones' && args[2].id === parent.id) {
                        parentDeleted();
                        await afterChildLock;
                      }
                      return row;
                    };
                  const value = Reflect.get(target, property);
                  return typeof value === 'function' ? value.bind(target) : value;
                },
              }),
            ),
          options,
        ),
      );
      const childTransaction = replica.storage.withTransaction.bind(replica.storage);
      vi.spyOn(replica.storage, 'withTransaction').mockImplementation((fn, options) =>
        childTransaction(
          ops =>
            fn(
              new Proxy(ops, {
                get(target, property) {
                  if (property === 'updateAtomic')
                    return async (...args: Parameters<typeof ops.updateAtomic>) => {
                      const row = await target.updateAtomic(...args);
                      if (args[0] === FACTORY_BOARD_ITEMS_SCHEMA.name && args[1].id === child.id) childLocked();
                      return row;
                    };
                  const value = Reflect.get(target, property);
                  return typeof value === 'function' ? value.bind(target) : value;
                },
              }),
            ),
          options,
        ),
      );
      const parentDeletion = workItems.delete({ orgId: scope.orgId, id: parent.id });
      await afterParentDelete;
      const outcomes = await Promise.allSettled([
        parentDeletion,
        replica.workItems.delete({ orgId: scope.orgId, id: child.id }),
      ]);
      expect(outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason)).toEqual([]);
      expect(await workItems.list(scope)).toEqual([]);
    },
  );

  it.each(['update', 'non-stage upsert'] as const)(
    'keeps a pending rule valid through a provider %s and refreshes cached facts',
    async path => {
      const { workItems, scope, item, sync } = await setup();
      expect((await workItems.list(scope))[0]!.title).toBe('Original issue');
      if (path === 'update') await sync();
      else
        await workItems.upsert({
          ...scope,
          reuseMode: 'non-stage',
          input: {
            title: 'Updated issue',
            externalSource: item.externalSource!,
            metadata: { state: 'closed', labels: ['fixed'], author: 'maintainer' },
          },
        });
      const commit = await workItems.commitRuleEvaluation({
        ...scope,
        workItemId: item.id,
        expectedRevision: item.revision,
        ingress: { identity: 'after-sync', triggerType: 'test' },
        configVersion: '1',
        actor: null,
        outcome: { status: 'accepted' },
        decisions: [],
        causalChain: [],
        now: new Date(),
      });
      expect(commit.status).toBe('committed');
      expect((await workItems.list(scope))[0]).toMatchObject({ title: 'Updated issue', revision: item.revision });
      const moved = await workItems.update({ ...scope, id: item.id, patch: { stages: ['planning'] } });
      expect(moved!.item).toMatchObject({
        title: 'Updated issue',
        stages: ['planning'],
        workItem: { title: 'Updated issue', state: 'closed', labels: ['fixed'], author: 'maintainer' },
      });
      await workItems.update({ ...scope, id: item.id, patch: { metadata: { reviewVerdict: 'approved' } } });
      expect((await workItems.get({ orgId: scope.orgId, id: item.id }))!.workItem).toMatchObject({
        state: 'closed',
        labels: ['fixed'],
        author: 'maintainer',
      });
    },
  );

  it('refreshes cached comment counts and advances the feed clock through edits and the last deletion', async () => {
    const { workItems, comments, scope, item } = await setup();
    const itemScope = { ...scope, workItemId: item.id };
    expect((await workItems.list(scope))[0]).toMatchObject({ commentCount: 0, feedActivityAt: null });
    const comment = await comments.create({
      ...itemScope,
      author: { kind: 'user', id: scope.userId },
      body: 'First comment',
    });
    await comments.refreshWorkItemFeedActivity(itemScope);
    expect((await workItems.list(scope))[0]).toMatchObject({
      commentCount: 1,
      feedActivityAt: comment.updatedAt,
      revision: item.revision,
    });
    const editedAt = new Date('2031-01-01T00:00:00Z');
    await comments.edit({ orgId: scope.orgId, commentId: comment.id, body: 'Edited comment', now: editedAt });
    await comments.refreshWorkItemFeedActivity(itemScope);
    expect((await workItems.list(scope))[0]).toMatchObject({
      commentCount: 1,
      feedActivityAt: editedAt,
      revision: item.revision,
    });
    const deletedAt = new Date('2032-01-01T00:00:00Z');
    await comments.softDelete({ orgId: scope.orgId, commentId: comment.id, deletedBy: scope.userId, now: deletedAt });
    await comments.refreshWorkItemFeedActivity(itemScope);
    expect((await workItems.list(scope))[0]).toMatchObject({
      commentCount: 0,
      feedActivityAt: deletedAt,
      revision: item.revision,
      updatedAt: item.updatedAt,
    });
  });

  it('deduplicates sources per project while preserving org-wide claim ownership on placements', async () => {
    const { storage, workItems, scope, item } = await setup();
    const input = { title: item.title, externalSource: item.externalSource!, claimKey: 'shared-claim' };
    const reused = await workItems.upsert({ ...scope, input });
    expect(reused).toMatchObject({ created: false, item: { id: item.id, claimKey: input.claimKey } });
    await expect(workItems.upsert({ ...scope, factoryProjectId: 'another-project', input })).rejects.toMatchObject({
      code: 'work_item_claim_conflict',
    });
    const second = await workItems.upsert({
      ...scope,
      factoryProjectId: 'another-project',
      input: { ...input, claimKey: null },
    });
    expect(second).toMatchObject({ created: true, item: { claimKey: null } });
    expect(second.item.id).not.toBe(item.id);
    expect(await workItems.getByClaimKey({ orgId: scope.orgId, claimKey: input.claimKey })).toMatchObject({
      id: item.id,
    });
    expect(await storage.ops.findOne('factory_board_items', { id: item.id })).toHaveProperty(
      'claim_key',
      input.claimKey,
    );
    for (const card of [item, reused.item, second.item]) {
      expect(card.workItem).not.toHaveProperty('kind');
      for (const source of card.workItem.sources) expect(source).not.toHaveProperty('kind');
    }
    for (const table of ['factory_work_items', 'factory_work_item_sources', 'factory_board_items']) {
      for (const row of await storage.ops.findMany(table, { org_id: scope.orgId })) {
        if (table !== 'factory_board_items') expect(row).not.toHaveProperty('claim_key');
        for (const column of [
          'kind',
          'triage_type',
          'accepted_at',
          'plans_preapproved_at',
          'comment_count',
          'feed_activity_at',
        ]) {
          expect(row).not.toHaveProperty(column);
        }
      }
    }
  });

  it('refreshes a secondary source without replacing the primary source identity or facts', async () => {
    const { storage, workItems, scope, item } = await setup();
    const primary = (
      await storage.ops.findMany<WorkItemSourceDbRecord>('factory_work_item_sources', {
        work_item_id: item.workItem.id,
      })
    )[0]!;
    const externalSource = { integrationId: 'github', type: 'issue', externalId: 'secondary' };
    const secondary = {
      ...primary,
      id: randomUUID(),
      external_id: 'issue:secondary',
      source_key: externalSourceKey(externalSource),
      metadata: { state: 'open', labels: ['secondary'] },
      labels: ['secondary'],
      created_at: new Date(primary.created_at.getTime() + 1000),
    };
    await storage.ops.insertOne('factory_work_item_sources', secondary);
    const refreshed = await workItems.upsert({
      ...scope,
      reuseMode: 'non-stage',
      input: { title: item.title, externalSource, metadata: { state: 'closed', labels: ['secondary-fixed'] } },
    });
    expect(refreshed.item.revision).toBe(item.revision);
    expect(await storage.ops.findOne('factory_work_item_sources', { id: primary.id })).toEqual(primary);
    expect(await storage.ops.findOne('factory_work_item_sources', { id: secondary.id })).toMatchObject({
      external_id: 'issue:secondary',
      state: 'closed',
      labels: ['secondary-fixed'],
      revision: secondary.revision + 1,
    });
    expect(refreshed.item.workItem.sources.map(source => source.id)).toEqual([primary.id, secondary.id]);
  });

  it('merges provider metadata against the locked source instead of overwriting a newer source refresh', async () => {
    const { storage, workItems, scope, item } = await setup();
    const id = item.workItem.sources[0]!.id;
    await storage.withTransaction(ops =>
      new Cards(ops).updateAtomic({ org_id: scope.orgId, id: item.id }, async snapshot => {
        // Schedule the competing persisted write after the compatibility snapshot is read.
        await ops.updateAtomic<WorkItemSourceDbRecord>('factory_work_item_sources', { id }, current => ({
          labels: ['fixed'],
          metadata: { ...current.metadata, labels: ['fixed'] },
          revision: current.revision + 1,
        }));
        return { metadata: { ...snapshot.metadata, state: 'closed' } };
      }),
    );
    expect(await workItems.get({ orgId: scope.orgId, id: item.id })).toMatchObject({
      revision: item.revision,
      metadata: { labels: ['fixed'], state: 'closed' },
      workItem: { labels: ['fixed'], state: 'closed', metadata: { labels: ['fixed'], state: 'closed' } },
    });
  });

  it.skipIf(backend !== 'postgres').each(['migration', 'deletion'] as const)(
    'lets both replicas finish %s when they first create the same migration guard concurrently',
    async mode => {
      const { storage, workItems, scope, item } = await setup();
      const replica = await separateReplica(storage);
      if (mode === 'migration') {
        const legacy = await new Cards(storage.ops).findOne({ id: item.id });
        delete legacy!.work_item;
        delete legacy!.work_item_sources;
        await storage.ops.insertOne('work_items', legacy!);
        await storage.ops.deleteMany('factory_board_items', { id: item.id });
        await storage.ops.deleteMany('factory_work_item_sources', { work_item_id: item.workItem.id });
        await storage.ops.deleteMany('factory_work_items', { id: item.workItem.id });
      }
      let inserts = 0;
      let release!: () => void;
      const bothObservedAbsence = new Promise<void>(resolve => {
        release = resolve;
      });
      for (const backendStorage of [storage, replica.storage]) {
        const transaction = backendStorage.withTransaction.bind(backendStorage);
        vi.spyOn(backendStorage, 'withTransaction').mockImplementation((fn, options) =>
          transaction(async ops => {
            const insert = ops.insertOne.bind(ops);
            vi.spyOn(ops, 'insertOne').mockImplementation(async (collection, row) => {
              if (collection === 'factory_work_item_split_locks' && row.id === item.id && inserts < 2) {
                inserts += 1;
                if (inserts === 2) release();
                await bothObservedAbsence;
              }
              return insert(collection, row);
            });
            return fn(ops);
          }, options),
        );
      }
      const results = await Promise.allSettled(
        mode === 'migration'
          ? [migrateWorkItemSplit(storage), migrateWorkItemSplit(replica.storage)]
          : [
              workItems.delete({ orgId: scope.orgId, id: item.id }),
              replica.workItems.delete({ orgId: scope.orgId, id: item.id }),
            ],
      );
      expect(inserts).toBe(2);
      expect(results.filter(result => result.status === 'rejected').map(result => result.reason)).toEqual([]);
      expect(await workItems.list(scope)).toMatchObject(
        mode === 'migration' ? [{ id: item.id, title: 'Original issue' }] : [],
      );
      expect(await storage.ops.findMany('factory_work_items', {})).toHaveLength(mode === 'migration' ? 1 : 0);
    },
  );

  it('does not resurrect a card deleted after an older replica planned its first migration', async () => {
    const { storage, workItems, scope, item } = await setup();
    const legacy = await new Cards(storage.ops).findOne({ id: item.id });
    delete legacy!.work_item;
    delete legacy!.work_item_sources;
    await storage.ops.insertOne('work_items', legacy!);
    await storage.ops.deleteMany('factory_board_items', { id: item.id });
    await storage.ops.deleteMany('factory_work_item_sources', { work_item_id: item.workItem.id });
    await storage.ops.deleteMany('factory_work_items', { id: item.workItem.id });
    let scheduled = false;
    const report = await migrateWorkItemSplit({
      ops: storage.ops,
      withTransaction: async callback => {
        if (!scheduled) {
          scheduled = true;
          await migrateWorkItemSplit(storage);
          await workItems.delete({ orgId: scope.orgId, id: item.id });
        }
        return storage.withTransaction(callback);
      },
    });
    expect(report).toMatchObject({ workItems: 0, boardItems: 0 });
    expect(await workItems.get({ orgId: scope.orgId, id: item.id })).toBeNull();
    expect(await storage.ops.findOne('factory_board_item_tombstones', { id: item.id })).not.toBeNull();
  });

  it('rejects dry-run startup after cutover rather than serving or deleting frozen legacy data', async () => {
    const { storage, workItems, item } = await setup();
    vi.stubEnv('MASTRA_FACTORY_WORK_ITEM_SPLIT', 'dry-run');
    try {
      await expect(workItems.init()).rejects.toThrow('cannot serve a database with migrated board items');
      expect(await storage.ops.findOne('factory_board_items', { id: item.id })).not.toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('preserves raw provider state separately from normalized merged state', async () => {
    const { workItems, scope } = await setup();
    const { item } = await workItems.upsert({
      ...scope,
      input: {
        title: 'Pull request',
        stages: ['review'],
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'pr-42' },
        metadata: { state: 'open', merged: false },
      },
    });
    await workItems.syncWorkItemSource({
      ...scope,
      provider: 'github',
      externalId: 'pull-request:pr-42',
      patch: { state: 'merged', metadata: { state: 'closed', merged: true } },
    });
    expect((await workItems.get({ ...scope, id: item.id }))?.workItem).toMatchObject({
      state: 'merged',
      metadata: { state: 'closed', merged: true },
      sources: [{ state: 'merged', metadata: { state: 'closed', merged: true } }],
    });
  });

  it('does not reintroduce stale provider metadata after direct source synchronization', async () => {
    const { workItems, scope, item } = await setup();
    await workItems.syncWorkItemSource({
      ...scope,
      provider: 'github',
      externalId: `issue:${scope.orgId}`,
      patch: { state: 'closed', labels: ['fixed'], author: 'maintainer', key: 'acme/app#42' },
    });
    await workItems.update({ ...scope, id: item.id, patch: { metadata: { reviewVerdict: 'approved' } } });
    const read = await workItems.get({ orgId: scope.orgId, id: item.id });
    expect(read).toMatchObject({
      revision: item.revision + 1,
      metadata: { state: 'closed', labels: ['fixed'], author: 'maintainer', identifier: 'acme/app#42' },
      workItem: { sources: [{ state: 'closed', labels: ['fixed'], author: 'maintainer', key: 'acme/app#42' }] },
    });
  });

  it('keeps serving legacy cards without copying them when the boot migration is a dry run', async () => {
    const { storage, workItems, scope, item } = await setup();
    const legacy = await new Cards(storage.ops).findOne({ id: item.id });
    delete legacy!.work_item;
    delete legacy!.work_item_sources;
    await storage.ops.insertOne('work_items', legacy!);
    const board = await storage.ops.findOne<{ work_item_id: string }>('factory_board_items', { id: item.id });
    await storage.ops.deleteMany('factory_board_items', { id: item.id });
    await storage.ops.deleteMany('factory_work_items', { id: board!.work_item_id });
    vi.stubEnv('MASTRA_FACTORY_WORK_ITEM_SPLIT', 'dry-run');
    try {
      await workItems.init();
      expect((await workItems.list(scope))[0]).toMatchObject({ id: item.id, title: 'Original issue' });
      expect(await storage.ops.findOne('factory_board_items', { id: item.id })).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('does not resurrect a deleted migrated card or write its frozen legacy row', async () => {
    const { storage, workItems, scope, item } = await setup();
    const legacy = await new Cards(storage.ops).findOne({ id: item.id });
    delete legacy!.work_item;
    delete legacy!.work_item_sources;
    await storage.ops.insertOne('work_items', legacy!);
    await workItems.delete({ orgId: scope.orgId, id: item.id });
    const before = await storage.ops.findOne('work_items', { id: item.id });
    await migrateWorkItemSplit(storage);
    expect(await workItems.get({ orgId: scope.orgId, id: item.id })).toBeNull();
    expect(await storage.ops.findOne('work_items', { id: item.id })).toEqual(before);
  });
});
