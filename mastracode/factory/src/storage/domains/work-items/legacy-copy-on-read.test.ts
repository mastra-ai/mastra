import { randomUUID } from 'node:crypto';

import type { FactoryStorage } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createIsolatedFactoryPostgresForTests } from '../../test-utils.js';
import { WorkItemsStorage } from './base.js';
import type { Card, ExternalWorkItemSource } from './base.js';
import { Cards } from './cards.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const PROJECT = 'project-legacy';
const USER = 'user-legacy';

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('legacy cards copied on demand on %s', backend => {
  async function setup() {
    vi.stubEnv('MASTRA_FACTORY_WORK_ITEM_SPLIT', 'on');
    onTestFinished(() => vi.unstubAllEnvs());
    const storage: FactoryStorage =
      backend === 'postgres'
        ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
        : new LibSQLFactoryStorage({ id: `legacy-${randomUUID()}`, url: ':memory:' });
    const workItems = storage.registerDomain(new WorkItemsStorage());
    await storage.init();
    onTestFinished(() => storage.close());
    const orgId = `org-${randomUUID()}`;
    let next = 0;

    async function file(overrides: { stages?: string[]; parentWorkItemId?: string } = {}): Promise<Card> {
      next += 1;
      const { item } = await workItems.upsert({
        orgId,
        userId: USER,
        factoryProjectId: PROJECT,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: `${orgId}-${next}` },
          title: `Card ${next}`,
          stages: overrides.stages ?? ['done'],
          sessions: {
            execute: { sessionId: `session-${next}`, branch: `factory/${next}`, threadId: `thread-${next}` },
          },
          metadata: {},
          ...(overrides.parentWorkItemId ? { parentWorkItemId: overrides.parentWorkItemId } : {}),
        },
      });
      return item;
    }

    /** Leave a card only where a 0.26 Factory wrote it: the legacy table. */
    async function demote(...cards: Card[]) {
      for (const card of cards) {
        const legacy = await new Cards(storage.ops).findOne({ id: card.id });
        delete legacy!.work_item;
        delete legacy!.work_item_sources;
        await storage.ops.insertOne('work_items', legacy!);
        await storage.ops.deleteMany('factory_board_items', { id: card.id });
        await storage.ops.deleteMany('factory_work_item_sources', { work_item_id: card.workItemId });
        await storage.ops.deleteMany('factory_work_items', { id: card.workItemId });
      }
    }

    /** Re-read the split state at boot, without the boot copy, so legacy cards stay uncopied. */
    async function restart() {
      const open = vi.spyOn(workItems, 'migrateOpenLegacyCards').mockResolvedValue(null);
      const backfill = vi.spyOn(workItems, 'backfillLegacyCards').mockResolvedValue(null);
      try {
        await workItems.init();
      } finally {
        open.mockRestore();
        backfill.mockRestore();
      }
    }

    const copied = async (id: string) => storage.ops.findOne('factory_board_items', { id });
    const legacyQueries = () => {
      const findMany = vi.spyOn(storage.ops, 'findMany');
      const findOne = vi.spyOn(storage.ops, 'findOne');
      return () =>
        [...findMany.mock.calls, ...findOne.mock.calls].filter(([collection]) => collection === 'work_items').length;
    };

    return { storage, workItems, orgId, file, demote, restart, copied, legacyQueries };
  }

  const source = (card: Card) => card.externalSource as ExternalWorkItemSource;

  it.each([
    ['get', (w: WorkItemsStorage, c: Card) => w.get({ orgId: c.orgId, id: c.id })],
    ['getForProject', (w: WorkItemsStorage, c: Card) => w.getForProject(c.orgId, PROJECT, c.id)],
    ['getBySource', (w: WorkItemsStorage, c: Card) => w.getBySource(source(c))],
    [
      'getByProjectSource',
      (w: WorkItemsStorage, c: Card) =>
        w.getByProjectSource({ orgId: c.orgId, factoryProjectId: PROJECT, source: source(c) }),
    ],
    [
      'listBySource',
      async (w: WorkItemsStorage, c: Card) => (await w.listBySource({ orgId: c.orgId, source: source(c) }))[0],
    ],
    [
      'listByIds',
      async (w: WorkItemsStorage, c: Card) =>
        (await w.listByIds({ orgId: c.orgId, factoryProjectId: PROJECT, ids: [c.id] }))[0],
    ],
  ] as const)('%s returns a card that is still only in the legacy table', async (_name, lookup) => {
    const { workItems, file, demote, restart, copied } = await setup();
    const card = await file();
    await demote(card);
    await restart();
    expect(workItems.legacyBackfillPending).toBe(true);
    expect(await copied(card.id)).toBeNull();

    expect(await lookup(workItems, card)).toMatchObject({
      id: card.id,
      stages: ['done'],
      stageHistory: card.stageHistory,
      sessions: card.sessions,
      externalSource: card.externalSource,
    });
    expect(await copied(card.id)).not.toBeNull();
  });

  it('updates and moves a card that is still only in the legacy table', async () => {
    const { workItems, orgId, file, demote, restart } = await setup();
    const card = await file();
    await demote(card);
    await restart();

    const updated = await workItems.update({ orgId, id: card.id, userId: USER, patch: { title: 'Renamed' } });
    expect(updated?.item).toMatchObject({ id: card.id, title: 'Renamed' });
    const moved = await workItems.commitTransition({
      orgId,
      factoryProjectId: PROJECT,
      workItemId: card.id,
      expectedRevision: updated!.item.revision,
      destinationStage: 'planning',
      actorId: USER,
      ingress: { identity: `reopen-${card.id}`, triggerType: 'manual', transitionId: `reopen-${card.id}` },
      configVersion: 'legacy',
      causalChain: [],
      evaluation: { outcome: 'accepted', decisions: [] },
    });
    expect(moved).toMatchObject({ status: 'committed', item: { id: card.id, stages: ['planning'] } });
  });

  it('deletes a legacy card for good: the background copy does not bring it back', async () => {
    const { workItems, orgId, file, demote, restart, copied, storage } = await setup();
    const card = await file();
    await demote(card);
    await restart();

    expect(await workItems.delete({ orgId, id: card.id })).toMatchObject({ id: card.id });
    expect(await storage.ops.findOne('factory_board_item_tombstones', { id: card.id })).not.toBeNull();
    expect(await workItems.backfillLegacyCards()).toMatchObject({ skipped: [] });
    expect(await copied(card.id)).toBeNull();
    expect(await workItems.get({ orgId, id: card.id })).toBeNull();
  });

  it('never copies a tombstoned legacy card', async () => {
    const { workItems, orgId, file, demote, restart, copied, storage } = await setup();
    const card = await file();
    await demote(card);
    await storage.ops.insertOne('factory_board_item_tombstones', {
      id: card.id,
      org_id: orgId,
      factory_project_id: PROJECT,
    });
    await restart();

    expect(await workItems.get({ orgId, id: card.id })).toBeNull();
    expect(await workItems.getBySource(source(card))).toBeNull();
    expect(await workItems.backfillLegacyCards()).toMatchObject({ skipped: [] });
    expect(await copied(card.id)).toBeNull();
  });

  it.skipIf(backend !== 'postgres')('copies a card once when a lookup races the background copy', async () => {
    const { storage, workItems, orgId, file, demote, restart } = await setup();
    const card = await file();
    await demote(card);
    await restart();
    let inserts = 0;
    let release!: () => void;
    const bothObservedAbsence = new Promise<void>(resolve => {
      release = resolve;
    });
    const transaction = storage.withTransaction.bind(storage);
    vi.spyOn(storage, 'withTransaction').mockImplementation((fn, options) =>
      transaction(async ops => {
        const insert = ops.insertOne.bind(ops);
        vi.spyOn(ops, 'insertOne').mockImplementation(async (collection, row) => {
          if (collection === 'factory_work_item_split_locks' && row.id === card.id && inserts < 2) {
            inserts += 1;
            if (inserts === 2) release();
            await bothObservedAbsence;
          }
          return insert(collection, row);
        });
        return fn(ops);
      }, options),
    );

    const [found, report] = await Promise.all([workItems.get({ orgId, id: card.id }), workItems.backfillLegacyCards()]);

    expect(inserts).toBe(2);
    expect(found).toMatchObject({ id: card.id });
    expect(report).toMatchObject({ skipped: [] });
    expect(report!.workItems + report!.unchanged).toBe(1);
    expect(await storage.ops.findMany('factory_board_items', { id: card.id })).toHaveLength(1);
    expect(workItems.legacyBackfillPending).toBe(false);
  });

  it.each(['lookup first', 'background first'] as const)(
    'copies a card once when the lookup and the background copy run one after the other (%s)',
    async order => {
      const { storage, workItems, orgId, file, demote, restart } = await setup();
      const card = await file();
      await demote(card);
      await restart();

      if (order === 'lookup first') {
        expect(await workItems.get({ orgId, id: card.id })).toMatchObject({ id: card.id });
        expect(await workItems.backfillLegacyCards()).toMatchObject({ workItems: 0, unchanged: 1, skipped: [] });
      } else {
        expect(await workItems.backfillLegacyCards()).toMatchObject({ workItems: 1, skipped: [] });
        expect(await workItems.get({ orgId, id: card.id })).toMatchObject({ id: card.id });
      }
      expect(await storage.ops.findMany('factory_board_items', { id: card.id })).toHaveLength(1);
    },
  );

  it('stays finished across restarts once the background copy completed', async () => {
    const { workItems, file, demote, restart } = await setup();
    await demote(await file());
    await restart();
    expect(await workItems.backfillLegacyCards()).toMatchObject({ workItems: 1, skipped: [] });
    expect(workItems.legacyBackfillPending).toBe(false);

    await restart();
    expect(workItems.legacyBackfillPending).toBe(false);
  });

  it('finishes even when cards are skipped, so skips do not keep the scan alive', async () => {
    const { storage, workItems, orgId, file, demote, restart } = await setup();
    const card = await file({ stages: ['planning'] });
    await demote(card);
    await restart();
    await workItems.backfillLegacyCards();
    // Edited here after the copy, and by an older replica in legacy afterwards: a conflict.
    await workItems.update({ orgId, id: card.id, userId: USER, patch: { stages: ['review'] } });
    await storage.ops.updateMany(
      'work_items',
      { id: card.id },
      { stages: ['done'], updated_at: new Date(Date.now() + 60_000) },
    );
    await restart();
    expect(workItems.legacyBackfillPending).toBe(true);

    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const report = await workItems.backfillLegacyCards();
    const lines = info.mock.calls.map(call => call.map(String));
    info.mockRestore();
    expect(report?.skipped).toEqual([{ id: card.id, reason: 'Split board item changed after migration' }]);
    // One line per pass: a count and sample ids, not the whole skip list as an object.
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveLength(1);
    expect(lines[0]![0]).toMatch(
      new RegExp(
        `^\\[factory\\] work item split \\(background pass\\): .*1 skipped — ${card.id} \\(Split board item changed after migration\\)$`,
      ),
    );
    expect(lines[0]![0]).not.toContain('\n');
    expect(workItems.legacyBackfillPending).toBe(false);
    await restart();
    expect(workItems.legacyBackfillPending).toBe(false);
    expect((await workItems.get({ orgId, id: card.id }))?.stages).toEqual(['review']);
  });

  it('rescans only the rows an older replica wrote after the split finished', async () => {
    const { storage, workItems, file, demote, restart } = await setup();
    const cards = [];
    for (let index = 0; index < 6; index += 1) cards.push(await file({ stages: ['planning'] }));
    await demote(...cards);
    await restart();
    await workItems.backfillLegacyCards();
    const later = new Date(Date.now() + 60_000);
    for (const card of cards.slice(0, 2)) {
      await storage.ops.updateMany('work_items', { id: card.id }, { title: `${card.title}!`, updated_at: later });
    }
    await restart();

    expect(await workItems.migrateOpenLegacyCards(() => false)).toMatchObject({
      cards: 2,
      recopied: 2,
      skipped: [],
    });
    expect(await workItems.backfillLegacyCards()).toMatchObject({ cards: 2, unchanged: 2, skipped: [] });
    expect(workItems.legacyBackfillPending).toBe(false);
  });

  it('a finished split costs no legacy query on a missed lookup', async () => {
    const { workItems, orgId, file, demote, restart, legacyQueries } = await setup();
    await demote(await file());
    await restart();
    await workItems.backfillLegacyCards();
    const count = legacyQueries();

    expect(await workItems.get({ orgId, id: randomUUID() })).toBeNull();
    expect(
      await workItems.getBySource({ integrationId: 'github', type: 'issue', externalId: `${orgId}-missing` }),
    ).toBeNull();
    expect(count()).toBe(0);
  });

  it('starts complete over an empty legacy table', async () => {
    const { workItems } = await setup();
    expect(workItems.legacyBackfillPending).toBe(false);
  });

  it('links a new card under a parent that is still only in the legacy table', async () => {
    const { workItems, file, demote, restart } = await setup();
    const parent = await file();
    await demote(parent);
    await restart();

    const child = await file({ stages: ['intake'], parentWorkItemId: parent.id });
    expect(child.parentWorkItemId).toBe(parent.id);
  });

  it('copies only open cards in the open pass; done cards wait for the background copy', async () => {
    const { workItems, orgId, file, demote, restart, copied } = await setup();
    const open = await file({ stages: ['planning'] });
    const done = await file({ stages: ['done'] });
    await demote(open, done);
    await restart();

    expect(
      await workItems.migrateOpenLegacyCards(card => card.stages.length === 1 && card.stages[0] === 'done'),
    ).toMatchObject({ workItems: 1, deferred: 1, skipped: [] });
    expect((await workItems.list({ orgId, factoryProjectId: PROJECT })).map(card => card.id)).toEqual([open.id]);
    expect(await copied(done.id)).toBeNull();
    expect(workItems.legacyBackfillPending).toBe(true);

    expect(await workItems.backfillLegacyCards()).toMatchObject({ workItems: 1, unchanged: 1, skipped: [] });
    expect((await workItems.list({ orgId, factoryProjectId: PROJECT })).map(card => card.id).sort()).toEqual(
      [open.id, done.id].sort(),
    );
  });

  it('clears a retired session from a card that is still only in the legacy table', async () => {
    const { workItems, orgId, file, demote, restart } = await setup();
    const card = await file();
    await demote(card);
    await restart();

    expect(await workItems.clearSessionReferences({ orgId, sessionId: card.sessions.execute!.sessionId })).toBe(1);
    expect((await workItems.get({ orgId, id: card.id }))?.sessions).toEqual({});
  });
});
