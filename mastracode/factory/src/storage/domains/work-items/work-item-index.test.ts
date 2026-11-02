/**
 * The work-item index over a real backend (libsql `:memory:`). Board columns, counts, lookups and
 * related cards read the index instead of every card, so each read must answer exactly what the
 * in-memory pager answers over the full list — before and after the cards are written again.
 */

import { describe, expect, it } from 'vitest';

import { decodeWorkItemCursor } from '../../../routes/work-item-cursor.js';
import type { WorkItemSort } from '../../../routes/work-item-cursor.js';
import {
  countWorkItems,
  pageWorkItems,
  withRelatedWorkItems,
  workItemSources,
} from '../../../routes/work-item-page.js';
import { createFactoryStorageForTests } from '../../test-utils.js';
import type { CreateWorkItemInput, WorkItemsStorage } from './base.js';
import type { IndexedPageCursor, IndexedSort } from './work-item-index.js';
import { workItemColumns } from './work-item-index.js';

const ORG = 'org-1';
const PROJECT = 'project-1';
const SCOPE = { orgId: ORG, factoryProjectId: PROJECT };
const SORTS: IndexedSort[] = ['recent', 'created-newest', 'created-oldest'];
const PAGE = 3;

const create = async (workItems: WorkItemsStorage, input: CreateWorkItemInput) =>
  (await workItems.upsert({ orgId: ORG, userId: 'user-alice', factoryProjectId: PROJECT, input })).item;

const move = (workItems: WorkItemsStorage, id: string, stages: string[]) =>
  workItems.update({ orgId: ORG, id, userId: 'user-alice', patch: { stages } });

/** A project with every shape a column holds: multi-stage, unstaged, moved, sourced, linked by branch. */
async function seedBoard(workItems: WorkItemsStorage) {
  const ids: string[] = [];
  for (let n = 0; n < 8; n++) ids.push((await create(workItems, { title: `Intake ${n}`, stages: ['intake'] })).id);
  ids.push((await create(workItems, { title: 'Unstaged', stages: [] })).id);
  ids.push((await create(workItems, { title: 'Two columns', stages: ['triage', 'execute'] })).id);
  const parent = await create(workItems, {
    title: 'Parent',
    stages: ['execute'],
    sessions: { work: { sessionId: 'session-parent', branch: 'feat/parent', threadId: 'thread-parent' } },
  });
  ids.push(parent.id);
  ids.push((await create(workItems, { title: 'Child', stages: ['planning'], parentWorkItemId: parent.id })).id);
  ids.push(
    (
      await create(workItems, {
        title: 'Parent PR',
        board: 'review',
        stages: ['intake'],
        externalSource: { integrationId: 'gh', type: 'pull-request', externalId: 'pr-1' },
        metadata: { headBranch: 'feat/parent', state: 'open' },
      })
    ).id,
  );
  ids.push(
    (
      await create(workItems, {
        title: 'Issue',
        stages: ['intake'],
        externalSource: { integrationId: 'gh', type: 'issue', externalId: 'issue-7', url: 'https://example.test/7' },
        metadata: { githubIssueNumber: 7 },
      })
    ).id,
  );
  for (let n = 0; n < 7; n++) {
    const card = await create(workItems, { title: `Shipped ${n}`, stages: ['triage'] });
    await move(workItems, card.id, ['done']);
    ids.push(card.id);
  }
  // Moving back re-enters a column, so "recent" differs from "created" order.
  await move(workItems, ids[0]!, ['triage']);
  await move(workItems, ids[0]!, ['intake']);
  return { ids, parent };
}

/** Walk a column page by page through the index. */
async function indexedColumn(workItems: WorkItemsStorage, board: string, stage: string, sort: IndexedSort) {
  const seen: string[] = [];
  let cursor: IndexedPageCursor | undefined;
  for (;;) {
    const page = await workItems.index.pageColumn(SCOPE, { board, stage, sort, limit: PAGE, cursor });
    if (!page) throw new Error('index not ready');
    seen.push(...page.items.map(item => item.id));
    if (!page.nextCursor) return seen;
    cursor = page.nextCursor;
  }
}

/** Walk the same column page by page with the in-memory pager over every card. */
async function pagedColumn(workItems: WorkItemsStorage, board: string, stage: string, sort: WorkItemSort) {
  const all = await workItems.list(SCOPE);
  const seen: string[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = pageWorkItems(all, {
      boards: [board],
      stages: [stage],
      sort,
      limit: PAGE,
      cursor: cursor ? decodeWorkItemCursor(cursor) : undefined,
    });
    seen.push(...page.items.map(item => item.id));
    if (!page.nextCursor) return seen;
    cursor = page.nextCursor;
  }
}

async function expectColumnsMatch(workItems: WorkItemsStorage) {
  const all = await workItems.list(SCOPE);
  const columns = countWorkItems(all).boards;
  const stages = Object.fromEntries(Object.entries(columns).map(([board, counts]) => [board, Object.keys(counts)]));
  expect(Object.keys(stages).length).toBeGreaterThan(0);
  for (const [board, list] of Object.entries(stages)) {
    for (const stage of list) {
      for (const sort of SORTS) {
        const expected = await pagedColumn(workItems, board, stage, sort);
        expect(expected.length).toBe(columns[board]![stage]);
        expect({ board, stage, sort, ids: await indexedColumn(workItems, board, stage, sort) }).toEqual({
          board,
          stage,
          sort,
          ids: expected,
        });
      }
    }
  }
  expect(await workItems.index.counts(SCOPE, stages)).toEqual(countWorkItems(all));
}

describe('work-item index', () => {
  it('answers nothing until built, then pages every column like the in-memory pager', async () => {
    const { workItems } = await createFactoryStorageForTests();
    await seedBoard(workItems);

    expect(
      await workItems.index.pageColumn(SCOPE, { board: 'work', stage: 'intake', sort: 'recent', limit: PAGE }),
    ).toBeUndefined();
    await workItems.index.build(SCOPE);

    await expectColumnsMatch(workItems);
  });

  it('keeps columns and counts current as cards move, gain sessions and are deleted', async () => {
    const { workItems } = await createFactoryStorageForTests();
    const { ids } = await seedBoard(workItems);
    await workItems.index.build(SCOPE);

    await move(workItems, ids[1]!, ['execute', 'review']);
    await move(workItems, ids[2]!, []);
    await workItems.update({
      orgId: ORG,
      id: ids[3]!,
      userId: 'user-alice',
      patch: { sessions: { work: { sessionId: 'session-new', branch: 'feat/new', threadId: 'thread-new' } } },
    });
    await workItems.delete({ orgId: ORG, id: ids[4]! });
    await create(workItems, { title: 'Late arrival', stages: ['intake'] });

    await expectColumnsMatch(workItems);
    expect(await workItems.index.idsByRef(SCOPE, 'session', ['session-new'])).toEqual([ids[3]]);
    expect(await workItems.index.heldRefs(SCOPE, 'session', ['session-new', 'session-gone'])).toEqual(['session-new']);
  });

  it('rebuilds over a live index without changing or duplicating a row', async () => {
    const { workItems } = await createFactoryStorageForTests();
    const { ids } = await seedBoard(workItems);
    await workItems.index.build(SCOPE);
    // A second build after writes repairs nothing and duplicates nothing.
    await move(workItems, ids[5]!, ['review']);
    await workItems.index.build(SCOPE);

    await expectColumnsMatch(workItems);
    const all = await workItems.list(SCOPE);
    const rows = all.reduce((sum, item) => sum + new Set(workItemColumns(item)).size, 0);
    const counted = await workItems.index.counts(SCOPE, {
      work: ['intake', 'triage', 'planning', 'execute', 'review', 'done'],
      review: ['intake'],
    });
    expect(
      Object.values(counted!.boards)
        .flatMap(Object.values)
        .reduce((a, b) => a + b, 0),
    ).toBe(rows);
  });

  it('relates cards, looks up sessions and threads, and lists sources like the full list does', async () => {
    const { workItems } = await createFactoryStorageForTests();
    const { parent } = await seedBoard(workItems);
    await workItems.index.build(SCOPE);
    const all = await workItems.list(SCOPE);
    const byTitle = (title: string) => all.find(item => item.title === title)!;
    const sorted = (items: readonly { id: string }[]) => items.map(item => item.id).sort();

    for (const title of ['Parent', 'Child', 'Parent PR', 'Issue']) {
      const matched = [byTitle(title)];
      expect(sorted((await workItems.index.related(SCOPE, matched))!)).toEqual(
        sorted(withRelatedWorkItems(all, matched)),
      );
    }
    expect(sorted((await workItems.index.related(SCOPE, [byTitle('Parent')]))!)).toEqual(
      sorted([parent, byTitle('Child'), byTitle('Parent PR')]),
    );
    expect(await workItems.index.idsByRef(SCOPE, 'session', ['session-parent'])).toEqual([parent.id]);
    expect(await workItems.index.idsByRef(SCOPE, 'thread', ['thread-parent'])).toEqual([parent.id]);
    const key = (entry: { externalSource: { externalId: string } }) => entry.externalSource.externalId;
    expect((await workItems.index.sources(SCOPE))!.sort((a, b) => key(a).localeCompare(key(b)))).toEqual(
      workItemSources(all).sort((a, b) => key(a).localeCompare(key(b))),
    );
  });
});
