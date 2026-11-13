import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createFactoryStorageForTests, createIsolatedFactoryPostgresForTests } from '../../test-utils.js';
import { WorkItemAlreadyOnBoardError } from './base.js';
import type { ExternalWorkItemSource } from './base.js';
import { backfillSourceLinks } from './source-links.js';
import {
  FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
} from './work-item-schema.js';
import type { WorkItemDbRecord, WorkItemSourceDbRecord, WorkItemSourceLinkDbRecord } from './work-item-schema.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

const issue12: ExternalWorkItemSource = {
  integrationId: 'github',
  type: 'issue',
  externalId: 'github:10:issue:12',
  url: 'https://github.com/acme/app/issues/12',
};
const pullRequest34: ExternalWorkItemSource = {
  integrationId: 'github',
  type: 'pull-request',
  externalId: 'github:10:pull-request:34',
  url: 'https://github.com/acme/app/pull/34',
};

// One external issue can sit on several boards at once: each board gets its own work item and
// card, all linked to the one source row, and provider facts reach every one of them together.
describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('an issue on several boards on %s', backend => {
  async function setup() {
    const storage =
      backend === 'postgres'
        ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
        : new LibSQLFactoryStorage({ id: 'linked-work-items-test', url: ':memory:' });
    if (backend === 'libsql') onTestFinished(() => storage.close());
    const { workItems } = await createFactoryStorageForTests(storage);
    const scope = { orgId: randomUUID(), factoryProjectId: 'project', userId: 'user' };
    const file = async (externalSource: ExternalWorkItemSource, metadata: Record<string, unknown>, board = 'work') =>
      (
        await workItems.upsert({
          ...scope,
          input: { title: 'Login fails', board, stages: ['intake'], externalSource, metadata },
        })
      ).item;
    const addTo = async (id: string, board: string, stage = 'triage') =>
      (await workItems.linkWorkItemToBoard({ orgId: scope.orgId, id, board, stage, userId: scope.userId }))!;
    const workRow = async (workItemId: string) =>
      (await storage.ops.findOne<WorkItemDbRecord>(FACTORY_WORK_ITEMS_SCHEMA.name, { id: workItemId }))!;
    const sourceRows = () =>
      storage.ops.findMany<WorkItemSourceDbRecord>(FACTORY_WORK_ITEM_SOURCES_SCHEMA.name, { org_id: scope.orgId });
    const linkRow = async (workItemId: string, sourceId: string) =>
      (await storage.ops.findOne<WorkItemSourceLinkDbRecord>(FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA.name, {
        work_item_id: workItemId,
        source_id: sourceId,
      }))!;
    return { storage, workItems, scope, file, addTo, workRow, sourceRows, linkRow };
  }

  it('puts a second card for the same issue on another board, with its own id and placement', async () => {
    const { workItems, scope, file, addTo, sourceRows } = await setup();
    const first = await file(issue12, { state: 'open', labels: ['bug'], author: 'reporter' });

    const second = await addTo(first.id, 'security');

    expect(second.id).not.toBe(first.id);
    expect(second.workItemId).not.toBe(first.workItemId);
    expect(second).toMatchObject({ board: 'security', stages: ['triage'], title: 'Login fails' });
    expect(second.externalSource).toEqual(first.externalSource);
    expect(second.workItem).toMatchObject({ state: 'open', labels: ['bug'], author: 'reporter' });
    // Still one source row: the issue is one external record.
    expect(await sourceRows()).toHaveLength(1);

    const both = await workItems.listByProjectSource({ ...scope, source: issue12 });
    expect(both.map(card => card.id)).toEqual([first.id, second.id]);
    // "The" card for a source is the one intake filed first.
    expect((await workItems.getByProjectSource({ ...scope, source: issue12 }))?.id).toBe(first.id);
    expect((await workItems.list(scope)).map(card => card.board).sort()).toEqual(['security', 'work']);
  });

  it('refuses a second card for the issue on a board that already holds one', async () => {
    const { file, addTo } = await setup();
    const first = await file(issue12, { state: 'open' });
    const second = await addTo(first.id, 'security');

    await expect(addTo(first.id, 'work')).rejects.toBeInstanceOf(WorkItemAlreadyOnBoardError);
    await expect(addTo(second.id, 'security')).rejects.toBeInstanceOf(WorkItemAlreadyOnBoardError);
  });

  it('lets only one of two concurrent adds for one issue land on the same board', async () => {
    const { workItems, scope, file, addTo } = await setup();
    const first = await file(issue12, { state: 'open' });

    const results = await Promise.allSettled([addTo(first.id, 'security'), addTo(first.id, 'security')]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(WorkItemAlreadyOnBoardError);
    expect((await workItems.listByProjectSource({ ...scope, source: issue12 })).map(card => card.board)).toEqual([
      'work',
      'security',
    ]);
  });

  it("writes a provider sync to every card of the issue in one go, on each card's link to it", async () => {
    const { workItems, scope, file, addTo, workRow, linkRow } = await setup();
    const first = await file(issue12, { state: 'open', labels: ['bug'], author: 'reporter' });
    const second = await addTo(first.id, 'security');

    await workItems.syncWorkItemSource({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      provider: 'github',
      externalId: first.workItem.sources[0]!.externalId,
      patch: { state: 'closed', labels: ['bug', 'p1'] },
    });

    for (const card of [first, second]) {
      const stored = (await workItems.get({ orgId: scope.orgId, id: card.id }))!;
      expect(stored.workItem).toMatchObject({ state: 'closed', labels: ['bug', 'p1'], author: 'reporter' });
      expect(stored.changedAt!.getTime()).toBeGreaterThan(card.changedAt!.getTime());
      // The facts live on the card's own link to the issue, as columns.
      const link = await linkRow(card.workItemId, first.workItem.sources[0]!.id);
      expect(link).toMatchObject({ state: 'closed', labels: ['bug', 'p1'], author: 'reporter' });
      expect(link.facts_synced_at).toBeInstanceOf(Date);
      expect(await workRow(card.workItemId)).not.toHaveProperty('source_facts');
    }
  });

  it("fans a provider title and facts out to every card, while a person's title edit stays on its card", async () => {
    const { workItems, scope, file, addTo } = await setup();
    const first = await file(issue12, { state: 'open', author: 'reporter' });
    const second = await addTo(first.id, 'security');

    await workItems.syncCard({
      orgId: scope.orgId,
      id: second.id,
      userId: 'github-sync',
      patch: { title: 'Login fails on Safari', metadata: { state: 'closed' } },
    });

    for (const card of [first, second]) {
      const stored = (await workItems.get({ orgId: scope.orgId, id: card.id }))!;
      expect(stored).toMatchObject({ title: 'Login fails on Safari' });
      expect(stored.workItem.state).toBe('closed');
    }

    await workItems.update({ ...scope, id: first.id, patch: { title: 'Safari login (triaged)' } });
    expect((await workItems.get({ orgId: scope.orgId, id: first.id }))!.title).toBe('Safari login (triaged)');
    expect((await workItems.get({ orgId: scope.orgId, id: second.id }))!.title).toBe('Login fails on Safari');
  });

  it('shows a pull request joined to the issue on every card of the issue, and syncs it to all of them', async () => {
    const { workItems, scope, file, addTo, sourceRows, linkRow } = await setup();
    const first = await file(issue12, { state: 'open' });
    const second = await addTo(first.id, 'security');

    const attached = await workItems.attachSource({
      orgId: scope.orgId,
      id: first.id,
      source: pullRequest34,
      metadata: { state: 'open', author: 'maintainer' },
    });
    expect(attached).toMatchObject({ attached: true });
    // Attaching the same PR from the sibling is "already filed", not a conflict.
    expect(
      await workItems.attachSource({ orgId: scope.orgId, id: second.id, source: pullRequest34, metadata: null }),
    ).toMatchObject({ attached: false });

    const pr = (await sourceRows()).find(source => source.source_type === 'pull-request')!;
    await workItems.syncWorkItemSource({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      provider: pr.provider,
      externalId: pr.external_id,
      patch: { state: 'merged' },
    });

    for (const card of [first, second]) {
      const stored = (await workItems.get({ orgId: scope.orgId, id: card.id }))!;
      expect(stored.workItem.sources.map(source => [source.sourceType, source.state])).toEqual([
        ['issue', 'open'],
        ['pull-request', 'merged'],
      ]);
      expect(stored.externalSource).toMatchObject({ type: 'issue' });
      expect(await linkRow(card.workItemId, pr.id)).toMatchObject({
        role: 'attached',
        state: 'merged',
        author: 'maintainer',
      });
      expect((await workItems.getByProjectSource({ ...scope, source: pullRequest34 }))?.id).toBe(first.id);
    }
  });

  it('gives a card added after the PR joined the PR too', async () => {
    const { workItems, scope, file, addTo } = await setup();
    const first = await file(issue12, { state: 'open' });
    await workItems.attachSource({
      orgId: scope.orgId,
      id: first.id,
      source: pullRequest34,
      metadata: { state: 'open' },
    });

    const second = await addTo(first.id, 'security');

    expect(second.workItem.sources.map(source => source.sourceType)).toEqual(['issue', 'pull-request']);
  });

  it('gives a card added while the PR joins the PR too', async () => {
    const { workItems, scope, file, addTo } = await setup();
    for (let round = 0; round < 10; round++) {
      const first = await file({ ...issue12, externalId: `${issue12.externalId}:${round}` }, { state: 'open' });
      const [, second] = await Promise.all([
        workItems.attachSource({
          orgId: scope.orgId,
          id: first.id,
          source: { ...pullRequest34, externalId: `${pullRequest34.externalId}:${round}` },
          metadata: { state: 'open' },
        }),
        addTo(first.id, 'security'),
      ]);

      const stored = (await workItems.get({ orgId: scope.orgId, id: second.id }))!;
      expect(stored.workItem.sources.map(source => source.sourceType)).toEqual(['issue', 'pull-request']);
    }
  });

  it('deletes one card of an issue without taking the issue or its other cards with it', async () => {
    const { workItems, scope, file, addTo, sourceRows, storage } = await setup();
    const first = await file(issue12, { state: 'open' });
    const second = await addTo(first.id, 'security');
    const third = await addTo(first.id, 'docs');

    await workItems.delete({ orgId: scope.orgId, id: second.id });
    expect(await workItems.get({ orgId: scope.orgId, id: second.id })).toBeNull();
    expect((await workItems.listByProjectSource({ ...scope, source: issue12 })).map(card => card.id)).toEqual([
      first.id,
      third.id,
    ]);
    expect(await sourceRows()).toHaveLength(1);

    // Deleting the card intake filed first hands the issue to the oldest remaining one.
    await workItems.delete({ orgId: scope.orgId, id: first.id });
    expect((await sourceRows())[0]!.work_item_id).toBe(third.workItemId);
    expect((await workItems.getByProjectSource({ ...scope, source: issue12 }))?.id).toBe(third.id);
    expect((await workItems.get({ orgId: scope.orgId, id: third.id }))!.workItem.state).toBe('open');

    await workItems.delete({ orgId: scope.orgId, id: third.id });
    expect(await sourceRows()).toHaveLength(0);
    expect(
      await storage.ops.findMany(FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA.name, { org_id: scope.orgId }),
    ).toHaveLength(0);
  });

  it('refiles an issue onto the card on the board intake names, not onto its sibling', async () => {
    const { workItems, scope, file, addTo } = await setup();
    const first = await file(issue12, { state: 'open' });
    const second = await addTo(first.id, 'security');

    const onSecurity = await workItems.upsert({
      ...scope,
      input: { title: 'Login fails', board: 'security', externalSource: issue12, metadata: { state: 'open' } },
    });
    expect(onSecurity).toMatchObject({ created: false, item: { id: second.id, board: 'security' } });

    // With no board named, a refile lands on the card intake filed first, and never drags it
    // onto a board its sibling already holds.
    const unnamed = await workItems.upsert({ ...scope, input: { title: 'Login fails', externalSource: issue12 } });
    expect(unnamed.item).toMatchObject({ id: first.id, board: 'work' });
    const refiled = await workItems.upsert({
      ...scope,
      input: { title: 'Login fails', board: 'docs', externalSource: issue12 },
    });
    expect(refiled.item).toMatchObject({ id: first.id, board: 'docs' });
    expect((await workItems.listByProjectSource({ ...scope, source: issue12 })).map(card => card.board)).toEqual([
      'docs',
      'security',
    ]);
  });

  it('reads cards filed before links existed, and backfills their links with facts once', async () => {
    const { workItems, scope, file, storage, linkRow } = await setup();
    const first = await file(issue12, { state: 'open', labels: ['bug'], author: 'reporter' });
    // Rows an older release wrote: a source and no link.
    await storage.ops.deleteMany(FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA.name, { org_id: scope.orgId });

    const before = (await workItems.get({ orgId: scope.orgId, id: first.id }))!;
    expect(before.workItem).toMatchObject({ state: 'open', labels: ['bug'], author: 'reporter' });
    expect((await workItems.getByProjectSource({ ...scope, source: issue12 }))?.id).toBe(first.id);

    expect(await workItems.backfillSourceLinks()).toMatchObject({ links: 1 });
    // Done once: later boots skip it.
    expect(workItems.sourceLinkBackfillPending).toBe(false);
    expect(await workItems.backfillSourceLinks()).toBeNull();
    const links = await storage.ops.findMany<Record<string, unknown>>(FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA.name, {
      org_id: scope.orgId,
    });
    expect(links).toMatchObject([{ work_item_id: first.workItemId, role: 'origin' }]);
    const link = await linkRow(first.workItemId, first.workItem.sources[0]!.id);
    expect(link).toMatchObject({ state: 'open', labels: ['bug'], author: 'reporter' });
    expect(link.facts_synced_at).toBeInstanceOf(Date);

    // A card added from a not-yet-backfilled issue still reaches the original card's facts.
    await storage.ops.deleteMany(FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA.name, { org_id: scope.orgId });
    const second = (await workItems.linkWorkItemToBoard({
      orgId: scope.orgId,
      id: first.id,
      board: 'security',
      stage: 'triage',
      userId: scope.userId,
    }))!;
    expect((await workItems.listByProjectSource({ ...scope, source: issue12 })).map(card => card.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('deletes a card while its issue syncs, when a card of the same issue is its child', async () => {
    const { workItems, scope, file, addTo } = await setup();
    for (let round = 0; round < 12; round++) {
      const first = await file({ ...issue12, externalId: `${issue12.externalId}:${round}` }, { state: 'open' });
      const second = await addTo(first.id, 'security');
      // The child's card sorts before its parent's, so a sync locks it first.
      const [child, parent] = [first, second].sort((a, b) => a.id.localeCompare(b.id));
      await workItems.update({ ...scope, id: child!.id, patch: { parentWorkItemId: parent!.id } });

      // Stagger the two so some rounds interleave their locks.
      const pause = new Promise(resolve => setTimeout(resolve, round % 6));
      await Promise.all([
        pause.then(() => workItems.delete({ orgId: scope.orgId, id: parent!.id })),
        workItems.syncWorkItemSource({
          orgId: scope.orgId,
          factoryProjectId: scope.factoryProjectId,
          provider: 'github',
          externalId: first.workItem.sources[0]!.externalId,
          patch: { state: 'closed' },
        }),
      ]);
      expect(await workItems.get({ orgId: scope.orgId, id: child!.id })).toMatchObject({ parentWorkItemId: null });
    }
  });

  it('joins a pull request to a single-card issue while the issue syncs', async () => {
    const { workItems, scope, file } = await setup();
    for (let round = 0; round < 12; round++) {
      const card = await file({ ...issue12, externalId: `${issue12.externalId}:${round}` }, { state: 'open' });
      const pause = new Promise(resolve => setTimeout(resolve, round % 6));
      await Promise.all([
        pause.then(() =>
          workItems.attachSource({
            orgId: scope.orgId,
            id: card.id,
            source: { ...pullRequest34, externalId: `${pullRequest34.externalId}:${round}` },
            metadata: { state: 'open' },
          }),
        ),
        workItems.syncWorkItemSource({
          orgId: scope.orgId,
          factoryProjectId: scope.factoryProjectId,
          provider: 'github',
          externalId: card.workItem.sources[0]!.externalId,
          patch: { state: 'closed' },
        }),
      ]);
      const stored = (await workItems.get({ orgId: scope.orgId, id: card.id }))!;
      expect(stored.workItem.sources.map(source => source.sourceType)).toEqual(['issue', 'pull-request']);
    }
  });

  it('lets two backfills run at once without either failing on a link the other wrote', async () => {
    const { workItems, scope, file, storage } = await setup();
    for (let index = 0; index < 20; index++) {
      await file({ ...issue12, externalId: `${issue12.externalId}:${index}` }, { state: 'open' });
    }
    await storage.ops.deleteMany(FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA.name, { org_id: scope.orgId });

    const reports = await Promise.all([backfillSourceLinks(storage), backfillSourceLinks(storage)]);

    expect(reports[0]!.links + reports[1]!.links).toBe(20);
    expect(
      await storage.ops.findMany(FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA.name, { org_id: scope.orgId }),
    ).toHaveLength(20);
  });

  it('stops a backfill page as soon as it is aborted', async () => {
    const { scope, file, storage } = await setup();
    for (let index = 0; index < 5; index++) {
      await file({ ...issue12, externalId: `${issue12.externalId}:${index}` }, { state: 'open' });
    }
    await storage.ops.deleteMany(FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA.name, { org_id: scope.orgId });
    const controller = new AbortController();
    const linksTable = FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA.name;
    const abortOnFirstLink = (ops: typeof storage.ops): typeof storage.ops =>
      new Proxy(ops, {
        get(target, key, receiver) {
          const value = Reflect.get(target, key, receiver);
          if (key !== 'insertOne' && key !== 'upsertOne') {
            return typeof value === 'function' ? value.bind(target) : value;
          }
          return async (collection: string, ...args: unknown[]) => {
            const written = await (value as (...a: unknown[]) => Promise<unknown>).call(target, collection, ...args);
            if (collection === linksTable) controller.abort();
            return written;
          };
        },
      });

    const report = await backfillSourceLinks(
      {
        ops: abortOnFirstLink(storage.ops),
        withTransaction: fn => storage.withTransaction(ops => fn(abortOnFirstLink(ops))),
      },
      { signal: controller.signal },
    );

    expect(report).toEqual({ links: 1, aborted: true });
    expect(await storage.ops.findMany(linksTable, { org_id: scope.orgId })).toHaveLength(1);
  });

  it("does not relink a card deleted while the backfill read its issue's page", async () => {
    const { workItems, scope, file, addTo, storage, sourceRows } = await setup();
    const first = await file(issue12, { state: 'open' });
    const second = await addTo(first.id, 'security');
    const linksTable = FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA.name;
    // The first card's link predates links; the second card's was written when it was added.
    await storage.ops.deleteMany(linksTable, { work_item_id: first.workItemId });
    let deleted = false;
    const ops = new Proxy(storage.ops, {
      get(target, key, receiver) {
        const value = Reflect.get(target, key, receiver);
        if (key !== 'findMany') return typeof value === 'function' ? value.bind(target) : value;
        return async (collection: string, ...rest: unknown[]) => {
          const rows = await (target.findMany as (...args: unknown[]) => Promise<unknown[]>)(collection, ...rest);
          if (collection === FACTORY_WORK_ITEM_SOURCES_SCHEMA.name && !deleted) {
            deleted = true;
            // The page now names a card that is gone; the issue has passed to the second card.
            await workItems.delete({ orgId: scope.orgId, id: first.id });
          }
          return rows;
        };
      },
    });

    await backfillSourceLinks({ ops, withTransaction: fn => storage.withTransaction(fn) });

    expect(
      (await storage.ops.findMany<Record<string, unknown>>(linksTable, { org_id: scope.orgId })).map(
        link => link.work_item_id,
      ),
    ).toEqual([second.workItemId]);
    await workItems.delete({ orgId: scope.orgId, id: second.id });
    expect(await sourceRows()).toHaveLength(0);
  });

  it('reads a sync an older release wrote to the source row only, until a link catches up', async () => {
    const { workItems, scope, file, addTo, storage } = await setup();
    const first = await file(issue12, { state: 'open', labels: ['bug'] });
    const second = await addTo(first.id, 'security');
    // After a rollback, an older release syncs the source row and leaves the links behind.
    await storage.ops.updateMany(
      FACTORY_WORK_ITEM_SOURCES_SCHEMA.name,
      { id: first.workItem.sources[0]!.id },
      { state: 'closed', synced_at: new Date(Date.now() + 60_000) },
    );

    for (const card of [first, second]) {
      expect((await workItems.get({ orgId: scope.orgId, id: card.id }))!.workItem.state).toBe('closed');
    }
  });
});
