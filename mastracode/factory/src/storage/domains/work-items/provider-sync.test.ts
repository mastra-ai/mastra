import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, vi } from 'vitest';

import { migrateWorkItemSplit } from '../../../work-items/split-migration.js';
import { createFactoryStorageForTests, createIsolatedFactoryPostgresForTests } from '../../test-utils.js';
import { Cards } from './cards.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('provider sync on %s', backend => {
  async function setup() {
    const storage =
      backend === 'postgres'
        ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
        : new LibSQLFactoryStorage({ id: 'sync-test', url: ':memory:' });
    const { workItems } = await createFactoryStorageForTests(storage);
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
      workItems.syncWorkItem({
        ...scope,
        provider: 'github',
        externalId: `issue:${orgId}`,
        patch: { title: 'Updated issue', state: 'closed', labels: ['fixed'], author: 'maintainer' },
      });
    return { storage, workItems, scope, item, sync };
  }

  it('commits a rule read before a provider refresh, and shows fresh facts in a cached card list', async () => {
    const { workItems, scope, item, sync } = await setup();
    expect((await workItems.list(scope))[0]!.title).toBe('Original issue');
    await sync();
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
  });

  it('keeps serving legacy cards without copying them when the boot migration is a dry run', async () => {
    const { storage, workItems, scope, item } = await setup();
    const legacy = await new Cards(storage.ops).findOne({ id: item.id });
    delete legacy!.work_item;
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
    await storage.ops.insertOne('work_items', legacy!);
    await workItems.delete({ orgId: scope.orgId, id: item.id });
    const before = await storage.ops.findOne('work_items', { id: item.id });
    await migrateWorkItemSplit(storage);
    expect(await workItems.get({ orgId: scope.orgId, id: item.id })).toBeNull();
    expect(await storage.ops.findOne('work_items', { id: item.id })).toEqual(before);
  });
});
