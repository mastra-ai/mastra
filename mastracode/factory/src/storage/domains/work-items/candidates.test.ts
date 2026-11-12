/**
 * Intake candidates over a real backend: open external records with no card. The Intake column
 * reads them from storage instead of asking each provider, so a candidate must never read as a
 * card, must become exactly one card when filed, and must not make open boards reload.
 */

import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  createFactoryStorageForTests,
  createIsolatedFactoryPostgresForTests,
  demoteCardsToLegacyForTests,
} from '../../test-utils.js';
import type { ExternalWorkItemSource } from './base.js';
import { readBoardVersion } from './board-version.js';
import { adoptCandidate, storeCandidate } from './candidates.js';
import type { WorkItemSourceDbRecord } from './work-item-schema.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const PROJECT = 'project';

const issue = (number: number): ExternalWorkItemSource => ({
  integrationId: 'github',
  type: 'issue',
  externalId: `github:10:issue:${number}`,
  url: `https://github.com/acme/app/issues/${number}`,
});
const pullRequest = (number: number): ExternalWorkItemSource => ({
  integrationId: 'github',
  type: 'pull-request',
  externalId: `github:10:pull-request:${number}`,
  url: `https://github.com/acme/app/pull/${number}`,
});

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('intake candidates on %s', backend => {
  async function setup() {
    const storage =
      backend === 'postgres'
        ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
        : new LibSQLFactoryStorage({ id: `candidates-${randomUUID()}`, url: ':memory:' });
    const { workItems } = await createFactoryStorageForTests(storage);
    const scope = { orgId: randomUUID(), factoryProjectId: PROJECT };

    const offer = (
      source: ExternalWorkItemSource,
      metadata: Record<string, unknown> = { state: 'open' },
      title?: string,
    ) =>
      workItems.storeIntakeCandidate({
        ...scope,
        source,
        title: title ?? `Record ${source.externalId}`,
        metadata,
        createdAt: typeof metadata.createdAt === 'string' ? new Date(metadata.createdAt) : null,
      });
    const file = async (source: ExternalWorkItemSource | undefined, metadata: Record<string, unknown> = {}) =>
      (
        await workItems.upsert({
          ...scope,
          userId: 'user',
          input: {
            title: source ? `Card ${source.externalId}` : 'Native card',
            board: 'work',
            stages: ['intake'],
            ...(source ? { externalSource: source } : {}),
            metadata,
          },
        })
      ).item;
    const candidates = async (filter: { kind?: 'issue' | 'pull-request'; integrationId?: string } = {}) =>
      (await workItems.listIntakeCandidates({ ...scope, ...filter, limit: 50 })).candidates;
    const cards = () => workItems.list(scope);
    const sourceRows = () =>
      storage.ops.findMany<WorkItemSourceDbRecord>('factory_work_item_sources', {
        org_id: scope.orgId,
        factory_project_id: PROJECT,
      });
    const boardVersion = () => readBoardVersion(storage.ops, scope.orgId, PROJECT);
    /** Projects whose boards and whose intake lists were told to reread. */
    const announcements = () => {
      const board = vi.fn();
      const intake = vi.fn();
      workItems.onBoardChanged(board);
      workItems.onIntakeChanged(intake);
      return { board, intake };
    };
    return { storage, workItems, scope, offer, file, candidates, cards, sourceRows, boardVersion, announcements };
  }

  it('keeps a candidate out of every card read', async () => {
    const { workItems, scope, offer, file, candidates, cards } = await setup();
    const card = await file(issue(1), { state: 'open' });

    expect(await offer(issue(2))).toBe('created');

    expect((await cards()).map(item => item.id)).toEqual([card.id]);
    expect((await workItems.listSharedSince(scope)).items.map(item => item.id)).toEqual([card.id]);
    expect(await workItems.getBySource(issue(2))).toBeNull();
    expect(await workItems.getByProjectSource({ ...scope, source: issue(2) })).toBeNull();
    expect(await workItems.listBySource({ orgId: scope.orgId, source: issue(2) })).toEqual([]);
    const [candidate] = await candidates();
    expect(candidate).toMatchObject({ title: `Record ${issue(2).externalId}`, externalSource: issue(2) });
    expect(await workItems.listByIds({ ...scope, ids: [candidate!.workItemId] })).toEqual([]);
    expect(await workItems.get({ orgId: scope.orgId, id: candidate!.workItemId })).toBeNull();
  });

  it('leaves a record that has a card alone', async () => {
    const { offer, file, candidates, cards } = await setup();
    const card = await file(issue(1), { state: 'open', labels: ['bug'] });

    expect(await offer(issue(1), { state: 'open', labels: ['other'] }, 'Renamed upstream')).toBe('carded');

    expect(await candidates()).toEqual([]);
    const [stored] = await cards();
    expect(stored).toMatchObject({ id: card.id, title: card.title, revision: card.revision });
    expect(stored!.workItem.sources[0]!.labels).toEqual(['bug']);
  });

  it('refreshes a stored candidate and reports whether anything moved', async () => {
    const { offer, candidates, sourceRows } = await setup();
    await offer(issue(1), { state: 'open', labels: ['bug'] }, 'Login fails');

    expect(await offer(issue(1), { state: 'open', labels: ['bug'] }, 'Login fails')).toBe('unchanged');
    expect(await offer(issue(1), { state: 'open', labels: ['bug', 'p1'] }, 'Login fails on Safari')).toBe('updated');

    const [candidate] = await candidates();
    expect(candidate).toMatchObject({ title: 'Login fails on Safari' });
    expect(candidate!.source.labels).toEqual(['bug', 'p1']);
    expect(await sourceRows()).toHaveLength(1);
  });

  it('moves no board version and wakes no board when candidates change', async () => {
    const { workItems, scope, offer, file, boardVersion, announcements } = await setup();
    await file(issue(1), { state: 'open' });
    const before = await boardVersion();
    const { board, intake } = announcements();

    await offer(issue(2), { state: 'open' }, 'First title');
    await offer(issue(2), { state: 'open' }, 'Second title');
    await workItems.syncWorkItemSource({
      ...scope,
      provider: 'github',
      externalId: 'issue:github:10:issue:2',
      patch: { labels: ['bug'] },
    });
    expect((await workItems.listIntakeCandidates({ ...scope, limit: 10 })).candidates[0]!.source.labels).toEqual([
      'bug',
    ]);
    await workItems.removeIntakeCandidate({ ...scope, source: issue(2) });

    expect(await boardVersion()).toBe(before);
    expect(board).not.toHaveBeenCalled();
    expect(intake.mock.calls).toEqual([[scope], [scope], [scope], [scope]]);
  });

  it('announces nothing when a refresh changes nothing', async () => {
    const { offer, announcements } = await setup();
    await offer(issue(1));
    const { board, intake } = announcements();

    expect(await offer(issue(1))).toBe('unchanged');

    expect(intake).not.toHaveBeenCalled();
    expect(board).not.toHaveBeenCalled();
  });

  it('files a candidate as a card on the same work item', async () => {
    const { offer, file, candidates, cards, sourceRows, boardVersion, announcements } = await setup();
    await offer(issue(1), { state: 'open', labels: ['bug'], author: 'reporter' });
    const [candidate] = await candidates();
    const before = await boardVersion();
    const { board, intake } = announcements();

    const card = await file(issue(1));

    expect(card.workItemId).toBe(candidate!.workItemId);
    expect(card.title).toBe(`Card ${issue(1).externalId}`);
    // The card is filed with no facts of its own; the ones the last sync stored stay.
    expect(card.workItem.sources).toHaveLength(1);
    expect(card.workItem.sources[0]).toMatchObject({ state: 'open', labels: ['bug'], author: 'reporter' });
    expect(await candidates()).toEqual([]);
    expect((await cards()).map(item => item.id)).toEqual([card.id]);
    expect(await sourceRows()).toHaveLength(1);
    expect(await boardVersion()).not.toBe(before);
    expect(board).toHaveBeenCalledWith(expect.objectContaining({ factoryProjectId: PROJECT }));
    expect(intake).toHaveBeenCalledWith(expect.objectContaining({ factoryProjectId: PROJECT }));
  });

  it('files one card when two requests file the same candidate at once', async () => {
    const { offer, file, candidates, cards, sourceRows } = await setup();
    await offer(issue(1));
    const [candidate] = await candidates();

    const filed = await Promise.all([file(issue(1)), file(issue(1))]);

    expect(new Set(filed.map(card => card.id)).size).toBe(1);
    expect(filed[0]!.workItemId).toBe(candidate!.workItemId);
    expect(await cards()).toHaveLength(1);
    expect(await sourceRows()).toHaveLength(1);
    expect(await candidates()).toEqual([]);
  });

  it('ends with one card when a record is offered and filed at once', async () => {
    const { offer, file, candidates, cards, sourceRows } = await setup();

    const [card] = await Promise.all([file(issue(1)), offer(issue(1))]);

    expect((await cards()).map(item => item.id)).toEqual([card.id]);
    expect(await candidates()).toEqual([]);
    expect(await sourceRows()).toHaveLength(1);
  });

  it('files a card when its candidate is removed at the same moment', async () => {
    const { workItems, scope, offer, file, candidates, cards, sourceRows } = await setup();
    await offer(issue(1));

    const [card] = await Promise.all([file(issue(1)), workItems.removeIntakeCandidate({ ...scope, source: issue(1) })]);

    expect((await cards()).map(item => item.id)).toEqual([card.id]);
    expect(await candidates()).toEqual([]);
    const rows = await sourceRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.candidate ?? null).toBeNull();
  });

  it.skipIf(backend !== 'postgres')(
    'leaves the source to its card when the candidate is filed while a refresh is running',
    async () => {
      const { storage, offer, file, candidates, cards } = await setup();
      await offer(issue(1), { state: 'open', labels: ['bug'] });
      const transaction = storage.withTransaction.bind(storage);
      let filing: ReturnType<typeof file> | undefined;
      vi.spyOn(storage, 'withTransaction').mockImplementation((fn, options) =>
        transaction(async ops => {
          const findOne = ops.findOne.bind(ops);
          vi.spyOn(ops, 'findOne').mockImplementation(async (collection, where) => {
            const row = await findOne(collection, where);
            // The refresh has read the candidate; the card is filed on another connection before it writes.
            if (collection === 'factory_work_item_sources' && !filing) await (filing = file(issue(1)));
            return row;
          });
          return fn(ops);
        }, options),
      );

      const refreshed = await offer(issue(1), { state: 'open', labels: ['late'] });

      expect(refreshed).toBe('carded');
      expect(await candidates()).toEqual([]);
      const filed = await cards();
      expect(filed.map(card => card.id)).toEqual([(await filing)!.id]);
      expect(filed[0]!.workItem.sources[0]!.labels).toEqual(['bug']);
    },
  );

  it('adopts nothing from a record that already has a card', async () => {
    const { storage, file, cards, sourceRows } = await setup();
    const card = await file(issue(1), { state: 'open' });
    const [source] = await sourceRows();

    const adopted = await adoptCandidate(storage.ops, source!, {
      title: 'Another card',
      description: null,
      updated_at: new Date(),
    });

    expect(adopted).toBeNull();
    expect(await sourceRows()).toEqual([source]);
    expect(await cards()).toMatchObject([{ id: card.id, title: card.title, revision: card.revision }]);
  });

  it('offers an open record again once its card is deleted', async () => {
    const { workItems, scope, file, candidates, cards, sourceRows, announcements } = await setup();
    const card = await file(issue(1), { state: 'open', createdAt: '2026-03-01T00:00:00.000Z' });
    await workItems.attachSource({
      orgId: scope.orgId,
      id: card.id,
      source: pullRequest(7),
      metadata: { state: 'open' },
    });
    const { intake } = announcements();

    await workItems.delete({ orgId: scope.orgId, id: card.id });

    expect(await cards()).toEqual([]);
    const [candidate] = await candidates();
    expect(candidate).toMatchObject({
      workItemId: card.workItemId,
      title: card.title,
      externalSource: issue(1),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    // The pull request was on the deleted card only; the next pass offers it by itself.
    expect((await sourceRows()).map(row => row.source_type)).toEqual(['issue']);
    expect(intake).toHaveBeenCalledWith(expect.objectContaining({ factoryProjectId: PROJECT }));

    const refiled = await file(issue(1));
    expect(refiled.id).not.toBe(card.id);
    expect(refiled.workItemId).toBe(card.workItemId);
    expect(await candidates()).toEqual([]);
  });

  it.each([
    ['a closed issue', issue(1), { state: 'closed' }],
    ['a merged pull request', pullRequest(2), { state: 'closed', merged: true }],
    [
      'a completed Linear issue',
      { integrationId: 'linear', type: 'issue', externalId: 'lin-1' },
      { linearStateType: 'completed' },
    ],
    ['a Slack thread', { integrationId: 'slack', type: 'thread', externalId: 'C1:1700000000.000100' }, {}],
    ['a card with no source', undefined, {}],
  ] as const)('keeps nothing of %s once its card is deleted', async (_name, source, metadata) => {
    const { workItems, scope, file, candidates, sourceRows } = await setup();
    const card = await file(source, metadata);

    await workItems.delete({ orgId: scope.orgId, id: card.id });

    expect(await candidates()).toEqual([]);
    expect(await sourceRows()).toEqual([]);
  });

  it('stops offering a record that is removed, and leaves a card that is not a candidate', async () => {
    const { workItems, scope, offer, file, candidates, cards } = await setup();
    await offer(issue(1));
    const card = await file(issue(2), { state: 'open' });

    expect(await workItems.removeIntakeCandidate({ ...scope, source: issue(1) })).toBe(true);
    expect(await workItems.removeIntakeCandidate({ ...scope, source: issue(1) })).toBe(false);
    expect(await workItems.removeIntakeCandidate({ ...scope, source: issue(2) })).toBe(false);

    expect(await candidates()).toEqual([]);
    expect((await cards()).map(item => item.id)).toEqual([card.id]);
  });

  it('puts a candidate pull request on the card of the issue it is attached to', async () => {
    const { workItems, scope, offer, file, candidates, sourceRows } = await setup();
    const card = await file(issue(1), { state: 'open' });
    await offer(pullRequest(7));

    const attached = await workItems.attachSource({
      orgId: scope.orgId,
      id: card.id,
      source: pullRequest(7),
      metadata: { state: 'open' },
    });

    expect(attached).toMatchObject({ attached: true });
    expect(attached!.item.workItem.sources.map(source => source.sourceType)).toEqual(['issue', 'pull-request']);
    expect(await candidates()).toEqual([]);
    expect(await sourceRows()).toHaveLength(2);
  });

  it('lists candidates newest first, by kind and provider, a page at a time', async () => {
    const { workItems, scope, offer, file, candidates } = await setup();
    await file(issue(100), { state: 'open' });
    for (const day of [3, 1, 5, 2, 4]) {
      await offer(issue(day), { state: 'open', createdAt: `2026-01-0${day}T00:00:00.000Z` });
    }
    await offer(pullRequest(50), { state: 'open', createdAt: '2026-02-01T00:00:00.000Z' });
    await offer(
      { integrationId: 'linear', type: 'issue', externalId: 'lin-1' },
      { linearStateType: 'started', createdAt: '2026-02-02T00:00:00.000Z' },
    );
    const other = { orgId: scope.orgId, factoryProjectId: 'other-project' };
    await workItems.storeIntakeCandidate({ ...other, source: issue(9), title: 'Elsewhere', metadata: null });

    const ids = (page: { candidates: { externalSource: ExternalWorkItemSource }[] }) =>
      page.candidates.map(candidate => candidate.externalSource.externalId);
    const first = await workItems.listIntakeCandidates({ ...scope, kind: 'issue', integrationId: 'github', limit: 2 });
    const second = await workItems.listIntakeCandidates({
      ...scope,
      kind: 'issue',
      integrationId: 'github',
      limit: 2,
      after: first.next!,
    });
    const third = await workItems.listIntakeCandidates({
      ...scope,
      kind: 'issue',
      integrationId: 'github',
      limit: 2,
      after: second.next!,
    });

    expect(ids(first)).toEqual([issue(5).externalId, issue(4).externalId]);
    expect(ids(second)).toEqual([issue(3).externalId, issue(2).externalId]);
    expect(ids(third)).toEqual([issue(1).externalId]);
    expect(third.next).toBeNull();
    expect((await candidates({ kind: 'pull-request' })).map(item => item.externalSource)).toEqual([pullRequest(50)]);
    expect((await candidates({ integrationId: 'linear' })).map(item => item.externalSource.externalId)).toEqual([
      'lin-1',
    ]);
    expect(await candidates()).toHaveLength(7);
  });

  it('reads the same rows for a page of candidates beside 50 cards and beside 2,000', async () => {
    const { storage, workItems, scope, offer, file } = await setup();
    for (let number = 1; number <= 4; number++) await offer(issue(number));
    const fileCards = async (from: number, to: number) => {
      for (let first = from; first < to; first += 50) {
        await Promise.all(Array.from({ length: 50 }, (_, index) => file(issue(first + index), { state: 'open' })));
      }
    };
    /** Each query the read made, with the number of rows it brought back. */
    const read = async () => {
      const findMany = vi.spyOn(storage.ops, 'findMany');
      const findOne = vi.spyOn(storage.ops, 'findOne');
      await workItems.listIntakeCandidates({ ...scope, limit: 3 });
      const reads = await Promise.all(
        findMany.mock.calls.map(async ([collection], index) => {
          const rows = (await findMany.mock.results[index]!.value) as unknown[];
          return [collection, rows.length];
        }),
      );
      expect(findOne).not.toHaveBeenCalled();
      findMany.mockRestore();
      findOne.mockRestore();
      return reads;
    };

    await fileCards(1_000, 1_050);
    const besideFewCards = await read();
    await fileCards(1_050, 3_000);

    expect(await workItems.list(scope)).toHaveLength(2_000);
    // `limit + 1` sources to learn whether a next page exists, then the page's work items.
    expect(besideFewCards).toEqual([
      ['factory_work_item_sources', 4],
      ['factory_work_items', 3],
    ]);
    expect(await read()).toEqual(besideFewCards);
  }, 180_000);

  it('gives the record to its legacy card when that card is copied', async () => {
    vi.stubEnv('MASTRA_FACTORY_WORK_ITEM_SPLIT', 'on');
    onTestFinished(() => vi.unstubAllEnvs());
    const { storage, workItems, scope, offer, file, candidates, cards, sourceRows } = await setup();
    const first = await file(issue(1), { state: 'open' });
    const second = await file(issue(2), { state: 'open' });
    await demoteCardsToLegacyForTests(storage, [first.id, second.id]);

    // The card is only in the legacy table: offering its record finds and copies it.
    expect(await offer(issue(1))).toBe('carded');
    // A candidate another writer stored before the copy gives way to the card.
    await storeCandidate(storage.ops, { ...scope, source: issue(2), title: 'Offered early', metadata: null });
    expect((await workItems.getByProjectSource({ ...scope, source: issue(2) }))?.id).toBe(second.id);

    expect(await candidates()).toEqual([]);
    expect((await cards()).map(item => item.id).sort()).toEqual([first.id, second.id].sort());
    expect(await sourceRows()).toHaveLength(2);
  });
});
