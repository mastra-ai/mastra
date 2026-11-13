import type { FactoryStorage, FactoryStorageOps } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it } from 'vitest';

import type { WorkItemsStorage, CreateWorkItemInput, WorkItemDbRow } from '../storage/domains/work-items/base.js';
import { readBoardVersion } from '../storage/domains/work-items/board-version.js';
import { Cards } from '../storage/domains/work-items/cards.js';
import { backfillSourceLinks } from '../storage/domains/work-items/source-links.js';
import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_BOARD_ITEM_TOMBSTONES_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
  FACTORY_WORK_ITEM_SPLIT_STATE_SCHEMA,
} from '../storage/domains/work-items/work-item-schema.js';
import type {
  BoardItemDbRecord,
  WorkItemDbRecord,
  WorkItemSourceDbRecord,
} from '../storage/domains/work-items/work-item-schema.js';
import { createFactoryStorageForTests, createIsolatedFactoryPostgresForTests } from '../storage/test-utils.js';
import {
  copyLegacyRows,
  migrateWorkItemSplit,
  readLegacyWatermark,
  readWorkItemSplitMarker,
  recordWorkItemSplitComplete,
} from './split-migration.js';

const ORG = 'org-split';
const PROJECT = 'project-split';
const USER = 'user-split';

interface Fixture {
  name: string;
  input: CreateWorkItemInput;
  expected: Partial<WorkItemSourceDbRecord>;
  /** Keys the work item must carry, and the board item must not. */
  providerKeys: string[];
  /** Keys the board item must carry, and the work item must not. */
  boardKeys: string[];
}

// Each card is the richest one the factory suite stores for its provider.
const FIXTURES: Fixture[] = [
  {
    name: 'github issue',
    input: {
      board: 'work',
      title: 'Issue 42',
      externalSource: {
        integrationId: 'github',
        type: 'issue',
        externalId: 'github:10:issue:42',
        url: 'https://github.com/acme/repo/issues/42',
      },
      metadata: {
        githubRepositoryId: 10,
        githubIssueNumber: 42,
        sourceCreatedAt: '2030-01-01T00:00:00Z',
        author: 'maintainer',
        authorTrusted: false,
        autoStartCandidate: false,
        assignees: [],
        labels: [{ name: 'bug' }],
        factoryRuleMaterializationKey: '7:noncandidate:issue-intake',
        openPullRequestNumber: 43,
        repository: 'acme/repo',
      },
    },
    expected: {
      provider: 'github',
      key: 'acme/repo#42',
      state: null,
      author: 'maintainer',
      labels: ['bug'],
      url: 'https://github.com/acme/repo/issues/42',
      source_key: 'github:issue:github:10:issue:42',
    },
    providerKeys: ['githubRepositoryId', 'githubIssueNumber', 'author', 'labels', 'sourceCreatedAt'],
    boardKeys: [
      'authorTrusted',
      'autoStartCandidate',
      'factoryRuleMaterializationKey',
      'openPullRequestNumber',
      'repository',
    ],
  },
  {
    name: 'github pull request',
    input: {
      board: 'review',
      title: 'PR 17',
      externalSource: {
        integrationId: 'github',
        type: 'pull-request',
        externalId: 'github:10:pull-request:17',
        url: 'https://github.com/acme/repo/pull/17',
      },
      metadata: {
        githubRepositoryId: 10,
        githubPullRequestNumber: 17,
        factoryAuthored: false,
        authorTrusted: true,
        autoStartCandidate: true,
        state: 'closed',
        draft: false,
        merged: true,
        requestedReviewers: ['reviewer'],
        labels: [],
        headBranch: 'feature',
        baseBranch: 'main',
        author: 'pr-author',
        reviewVerdict: 'approve',
        reviewedHeadSha: 'abc1234',
      },
    },
    expected: { provider: 'github', key: 'acme/repo#17', state: 'merged', author: 'pr-author' },
    providerKeys: ['githubPullRequestNumber', 'draft', 'merged', 'headBranch', 'baseBranch', 'requestedReviewers'],
    boardKeys: ['factoryAuthored', 'authorTrusted', 'autoStartCandidate', 'reviewVerdict', 'reviewedHeadSha'],
  },
  {
    name: 'gitlab issue',
    input: {
      title: 'Issue 42',
      externalSource: {
        integrationId: 'gitlab',
        type: 'issue',
        externalId: 'gitlab-issue:42',
        url: 'https://gitlab.example.com/acme/app/-/issues/42',
      },
      metadata: {
        gitlabHost: 'gitlab.example.com',
        gitlabProjectId: 101,
        gitlabIssueIid: 42,
        identifier: 'acme/app#42',
        state: 'closed',
        stateType: 'completed',
        author: 'Maintainer Person',
        authorTrusted: true,
        labels: ['bug'],
        labelColors: { bug: '#428BCA' },
      },
    },
    expected: { provider: 'gitlab', key: 'acme/app#42', state: 'closed', labels: ['bug'] },
    providerKeys: ['gitlabHost', 'gitlabProjectId', 'gitlabIssueIid', 'identifier', 'labelColors', 'stateType'],
    boardKeys: ['authorTrusted'],
  },
  {
    name: 'gitlab merge request',
    input: {
      title: 'MR 17',
      externalSource: {
        integrationId: 'gitlab',
        type: 'pull-request',
        externalId: 'gitlab-pr:17',
        url: 'https://gitlab.example.com/acme/app/-/merge_requests/17',
      },
      metadata: {
        gitlabHost: 'gitlab.example.com',
        gitlabProjectId: 101,
        gitlabMergeRequestIid: 17,
        state: 'opened',
        merged: false,
        author: 'maintainer',
        authorTrusted: true,
        factoryPullRequestReconciliation: 'merged',
      },
    },
    expected: { provider: 'gitlab', key: 'acme/app!17', state: 'opened' },
    providerKeys: ['gitlabMergeRequestIid', 'merged'],
    boardKeys: ['authorTrusted', 'factoryPullRequestReconciliation'],
  },
  {
    name: 'jira issue',
    input: {
      title: 'Jira issue',
      externalSource: {
        integrationId: 'jira',
        type: 'issue',
        externalId: 'jira-issue:conn-1:ENG-42:10001',
        url: 'https://acme.atlassian.net/browse/ENG-42',
      },
      metadata: {
        identifier: 'ENG-42',
        issueRef: 'jira-issue:conn-1:ENG-42:10001',
        autoStartCandidate: true,
        state: 'To Do',
        stateType: 'unstarted',
        priority: 'High',
        project: 'ENG',
        assignee: 'Ada',
        creator: 'Grace',
        labels: ['bug'],
      },
    },
    expected: { provider: 'jira', key: 'ENG-42', state: 'To Do', author: 'Grace' },
    providerKeys: ['identifier', 'issueRef', 'priority', 'project', 'assignee', 'creator'],
    boardKeys: ['autoStartCandidate'],
  },
  {
    name: 'linear issue',
    input: {
      title: 'Fix intake',
      externalSource: {
        integrationId: 'linear',
        type: 'issue',
        externalId: 'linear:ENG-7',
        url: 'https://linear.app/acme/issue/ENG-7',
      },
      metadata: {
        linearIssueId: 'issue-1',
        linearProjectId: 'linear-project:1',
        identifier: 'ENG-7',
        linearState: 'Todo',
        linearStateType: 'unstarted',
        linearCreator: 'Ada',
        linearTeam: 'ENG',
        labels: ['bug'],
      },
    },
    expected: { provider: 'linear', key: 'ENG-7', state: 'Todo', author: 'Ada' },
    providerKeys: ['linearIssueId', 'linearProjectId', 'linearState', 'linearTeam'],
    boardKeys: [],
  },
  {
    name: 'incident.io incident',
    input: {
      title: 'Requests failing',
      externalSource: {
        integrationId: 'incidentio',
        type: 'issue',
        externalId: 'incidentio:incident:incident-1',
        url: 'https://app.incident.io/acme/incidents/incident-1',
      },
      metadata: {
        identifier: 'INC-42',
        incidentioItemType: 'incident',
        incidentioState: 'Learning',
        incidentioDescription: 'Requests are failing.',
        source: 'Incident',
        autoStartCandidate: true,
        author: 'Ada Lovelace',
        labels: ['Major'],
      },
    },
    expected: { provider: 'incidentio', key: 'INC-42', state: 'Learning' },
    providerKeys: ['incidentioItemType', 'incidentioDescription', 'source'],
    boardKeys: ['autoStartCandidate'],
  },
  {
    name: 'incident.io follow-up',
    input: {
      title: 'Add a retry',
      externalSource: {
        integrationId: 'incidentio',
        type: 'issue',
        externalId: 'incidentio:follow-up:01HFOLLOWUP',
      },
      metadata: { identifier: 'INC-42-1', incidentioItemType: 'follow-up', state: 'Open' },
    },
    expected: { provider: 'incidentio', key: 'INC-42-1', state: 'Open' },
    providerKeys: ['incidentioItemType'],
    boardKeys: [],
  },
  {
    name: 'slack thread',
    input: {
      title: 'Fix the bug',
      externalSource: { integrationId: 'slack', type: 'slack-thread', workspaceId: 'T0ABC', externalId: 'C1:1.000' },
      metadata: { autoStartCandidate: true },
    },
    expected: { provider: 'slack', key: null, external_id: 'slack-thread:T0ABC:C1:1.000' },
    providerKeys: [],
    boardKeys: ['autoStartCandidate'],
  },
  {
    name: 'factory card',
    input: { title: 'Authoring work', metadata: { reviewVerdict: 'request changes', customStep: 'drafted' } },
    expected: {},
    providerKeys: [],
    boardKeys: ['reviewVerdict', 'customStep'],
  },
];

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

async function createStorage(backend: string): Promise<{ storage: FactoryStorage; workItems: WorkItemsStorage }> {
  const storage =
    backend === 'postgres'
      ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
      : new LibSQLFactoryStorage({ id: 'split-test', url: ':memory:' });
  const { workItems } = await createFactoryStorageForTests(storage);
  // The Postgres database is shared between runs; start every test from empty tables.
  await storage.ops.deleteMany(FACTORY_WORK_ITEM_SPLIT_STATE_SCHEMA.name, {});
  await storage.ops.deleteMany('work_items', {});
  await workItems.dangerouslyClearAll();
  await storage.ops.deleteMany(FACTORY_BOARD_ITEMS_SCHEMA.name, {});
  await storage.ops.deleteMany(FACTORY_WORK_ITEMS_SCHEMA.name, {});
  await storage.ops.deleteMany(FACTORY_WORK_ITEM_SOURCES_SCHEMA.name, {});
  return { storage, workItems };
}

async function seed(workItems: WorkItemsStorage) {
  const cards = new Map<string, string>();
  for (const fixture of FIXTURES) {
    const { item } = await workItems.upsert({
      orgId: ORG,
      userId: USER,
      factoryProjectId: PROJECT,
      input: fixture.input,
    });
    cards.set(fixture.name, item.id);
  }
  return cards;
}

// Capture the actual ingest output as the table an older Factory would have written.
async function seedLegacy(storage: FactoryStorage) {
  const cards = await new Cards(storage.ops).findMany({});
  for (const card of cards) {
    delete card.work_item;
    delete card.work_item_sources;
    delete card.changed_at;
    await storage.ops.upsertOne('work_items', ['id'], card);
  }
  await storage.ops.deleteMany(FACTORY_BOARD_ITEMS_SCHEMA.name, {});
  await storage.ops.deleteMany(FACTORY_WORK_ITEMS_SCHEMA.name, {});
  await storage.ops.deleteMany(FACTORY_WORK_ITEM_SOURCES_SCHEMA.name, {});
}

async function readSplit(storage: FactoryStorage) {
  const workItems = await storage.ops.findMany<WorkItemDbRecord>(FACTORY_WORK_ITEMS_SCHEMA.name, {});
  const boardItems = await storage.ops.findMany<BoardItemDbRecord>(FACTORY_BOARD_ITEMS_SCHEMA.name, {});
  const sources = await storage.ops.findMany<WorkItemSourceDbRecord>(FACTORY_WORK_ITEM_SOURCES_SCHEMA.name, {});
  return {
    sources,
    workItems: new Map(workItems.map(row => [row.id, row])),
    boardItems: new Map(boardItems.map(row => [row.id, row])),
  };
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('work item split on %s', backend => {
  it('moves every provider fact onto a work item and leaves each card where it sits on the board', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    const githubIssue = cards.get('github issue')!;
    const parent = cards.get('factory card')!;
    await workItems.update({
      orgId: ORG,
      id: githubIssue,
      userId: USER,
      patch: { stages: ['planning'], parentWorkItemId: parent },
    });
    const legacy = new Map(
      (await workItems.list({ orgId: ORG, factoryProjectId: PROJECT })).map(item => [item.id, item]),
    );

    await seedLegacy(storage);
    const report = await migrateWorkItemSplit(storage);

    expect(report).toMatchObject({
      dryRun: false,
      projects: 1,
      cards: FIXTURES.length,
      workItems: FIXTURES.length,
      boardItems: FIXTURES.length,
      skipped: [],
    });
    const split = await readSplit(storage);
    expect(split.boardItems.size).toBe(FIXTURES.length);
    for (const fixture of FIXTURES) {
      const id = cards.get(fixture.name)!;
      const card = legacy.get(id)!;
      const boardItem = split.boardItems.get(id);
      expect(boardItem, fixture.name).toBeDefined();
      expect(boardItem, fixture.name).toMatchObject({
        org_id: ORG,
        factory_project_id: PROJECT,
        board: card.board,
        triage_type: card.triageType,
        accepted_at: card.acceptedAt,
        autonomy_armed_at: card.autonomyArmedAt,
        plans_preapproved_at: null,
        parent_board_item_id: card.parentWorkItemId,
        stages: card.stages,
        revision: card.revision,
        created_by: USER,
      });
      expect(boardItem!.stage_history, fixture.name).toEqual(JSON.parse(JSON.stringify(card.stageHistory)));
      const workItem = split.workItems.get(boardItem!.work_item_id);
      expect(workItem, fixture.name).toMatchObject({ title: card.title });
      expect(workItem!.id, fixture.name).not.toBe(id);
      const sources = split.sources.filter(source => source.work_item_id === workItem!.id);
      expect(sources, fixture.name).toHaveLength(card.externalSource ? 1 : 0);
      const source = sources[0];
      expect(workItem, fixture.name).not.toHaveProperty('claim_key');
      if (source) expect(source, fixture.name).not.toHaveProperty('claim_key');
      if (card.externalSource) expect(source, fixture.name).toMatchObject(fixture.expected);
      for (const key of fixture.providerKeys) {
        expect(source!.metadata?.[key], `${fixture.name}: source ${key}`).toEqual(fixture.input.metadata[key]);
        expect(boardItem!.metadata ?? {}, `${fixture.name}: board item ${key}`).not.toHaveProperty(key);
      }
      for (const key of fixture.boardKeys) {
        expect(boardItem!.metadata?.[key], `${fixture.name}: board item ${key}`).toEqual(card.metadata![key]);
        expect(source?.metadata ?? {}, `${fixture.name}: source ${key}`).not.toHaveProperty(key);
      }
      for (const row of [workItem, boardItem, source].filter(Boolean)) {
        for (const column of ['kind', 'claim_key', 'comment_count', 'feed_activity_at']) {
          expect(row, `${fixture.name}: retired ${column}`).not.toHaveProperty(column);
        }
      }
    }
    expect(split.boardItems.get(githubIssue)).toMatchObject({ stages: ['planning'], parent_board_item_id: parent });
  });

  it('carries the description onto the work item and leaves an old comment count behind', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    const id = cards.get('github issue')!;
    await storage.ops.updateMany(
      'work_items',
      { id },
      {
        description: 'Fix the flaky login test',
        comment_count: 9,
        feed_activity_at: new Date('2099-01-01T00:00:00Z'),
      },
    );
    await migrateWorkItemSplit(storage);

    const split = await readSplit(storage);
    const boardItem = split.boardItems.get(id)!;
    expect(split.workItems.get(boardItem.work_item_id)).toMatchObject({ description: 'Fix the flaky login test' });
    expect(boardItem).not.toHaveProperty('comment_count');
    expect(boardItem).not.toHaveProperty('feed_activity_at');
    const card = await workItems.get({ orgId: ORG, id });
    expect(card).toMatchObject({ description: 'Fix the flaky login test' });
    expect(card).not.toHaveProperty('commentCount');
  });

  it('preserves classification, acceptance, autonomy and plan grants on the board placement', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    const id = cards.get('github issue')!;
    const process = {
      triage_type: 'feature request',
      accepted_at: new Date('2030-01-01T00:00:00Z'),
      autonomy_armed_at: new Date('2030-01-02T00:00:00Z'),
      plans_preapproved_at: new Date('2030-01-03T00:00:00Z'),
    };
    await storage.ops.updateMany('work_items', { id }, process);

    await migrateWorkItemSplit(storage);

    const split = await readSplit(storage);
    const board = split.boardItems.get(id)!;
    expect(board).toMatchObject(process);
    for (const column of Object.keys(process)) {
      expect(split.workItems.get(board.work_item_id)).not.toHaveProperty(column);
      for (const source of split.sources) expect(source).not.toHaveProperty(column);
    }
    expect(board.metadata ?? {}).not.toHaveProperty('autonomyArmedAt');
    expect(await migrateWorkItemSplit(storage)).toMatchObject({ workItems: 0, skipped: [] });
  });

  it('writes nothing on later boots once every card is copied', async () => {
    const { storage, workItems } = await createStorage(backend);
    await seed(workItems);
    await seedLegacy(storage);
    await migrateWorkItemSplit(storage);
    const before = await readSplit(storage);

    const report = await migrateWorkItemSplit(storage);

    expect(report).toMatchObject({ workItems: 0, boardItems: 0, unchanged: FIXTURES.length, recopied: 0 });
    expect(await readSplit(storage)).toEqual(before);
  });

  it('does not recopy cards when an older replica refreshes only retired comment columns or inert claims', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    await migrateWorkItemSplit(storage);
    const before = await readSplit(storage);

    await storage.ops.updateMany(
      'work_items',
      { id: cards.get('github issue')! },
      {
        comment_count: 3,
        feed_activity_at: new Date('2031-01-01T00:00:00Z'),
        claim_key: 'legacy:unused',
        source_key: 'legacy:unused-source-shadow',
      },
    );

    expect(await migrateWorkItemSplit(storage)).toMatchObject({
      workItems: 0,
      recopied: 0,
      unchanged: FIXTURES.length,
      skipped: [],
    });
    expect(await readSplit(storage)).toEqual(before);
  });

  it('picks up a card an older replica moved after the first pass, without reusing a revision', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    await migrateWorkItemSplit(storage);
    const id = cards.get('jira issue')!;
    const copied = (await readSplit(storage)).boardItems.get(id)!;

    // An old replica still serving the legacy table moves the card.
    const moved = await storage.ops.updateAtomic<Record<string, unknown>>('work_items', { id }, row => ({
      stages: ['planning'],
      revision: Number(row.revision) + 1,
      updated_at: new Date(Date.now() + 1000),
    }));
    const created = await workItems.upsert({
      orgId: ORG,
      userId: USER,
      factoryProjectId: PROJECT,
      input: { title: 'Filed during the deploy' },
    });

    const createdRow = await new Cards(storage.ops).findOne({ id: created.item.id });
    delete createdRow!.work_item;
    delete createdRow!.work_item_sources;
    delete createdRow!.changed_at;
    await storage.ops.insertOne('work_items', createdRow!);
    const createdBoard = (await readSplit(storage)).boardItems.get(created.item.id)!;
    await storage.ops.deleteMany(FACTORY_BOARD_ITEMS_SCHEMA.name, { id: created.item.id });
    await storage.ops.deleteMany(FACTORY_WORK_ITEMS_SCHEMA.name, { id: createdBoard.work_item_id });
    const report = await migrateWorkItemSplit(storage);

    expect(report).toMatchObject({ workItems: 2, recopied: 1, unchanged: FIXTURES.length - 1 });
    const split = await readSplit(storage);
    const recopied = split.boardItems.get(id)!;
    expect(recopied.stages).toEqual(['planning']);
    expect(recopied.work_item_id).toBe(copied.work_item_id);
    expect(recopied.revision).toBeGreaterThan(Math.max(copied.revision, Number(moved!.revision)));
    expect(split.boardItems.get(created.item.id)).toMatchObject({ stages: created.item.stages });
    expect(split.workItems.size).toBe(FIXTURES.length + 1);
  });

  it('leaves inert claims in legacy storage without copying them into split records', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    const id = cards.get('github issue')!;
    await storage.ops.updateMany('work_items', { id }, { claim_key: 'github:issue:10:42' });

    expect(await migrateWorkItemSplit(storage)).toMatchObject({ workItems: FIXTURES.length, skipped: [] });
    const split = await readSplit(storage);
    for (const row of [...split.boardItems.values(), ...split.workItems.values(), ...split.sources]) {
      expect(row).not.toHaveProperty('claim_key');
    }
    expect(await storage.ops.findOne('work_items', { id })).toHaveProperty('claim_key', 'github:issue:10:42');
    expect(await migrateWorkItemSplit(storage)).toMatchObject({ workItems: 0, skipped: [] });
  });

  it('keeps booting when an old replica creates a conflicting source under another id', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    const originalId = cards.get('github issue')!;
    const { item: existing } = await workItems.upsert({
      orgId: ORG,
      userId: USER,
      factoryProjectId: PROJECT,
      input: FIXTURES[0]!.input,
    });

    const report = await migrateWorkItemSplit(storage);

    expect(report).toMatchObject({
      workItems: FIXTURES.length - 1,
      skipped: [{ id: originalId, reason: expect.stringMatching(/source/) }],
    });
    const split = await readSplit(storage);
    expect(split.boardItems.has(originalId)).toBe(false);
    expect(split.boardItems.size).toBe(FIXTURES.length);
    expect(split.workItems.size).toBe(FIXTURES.length);
    expect(await workItems.get({ orgId: ORG, id: existing.id })).toEqual(existing);
    await workItems.init();
    expect(await readSplit(storage)).toEqual(split);
  });

  it('does not overwrite either card when an old replica recopies a conflicting source', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    await migrateWorkItemSplit(storage);
    const { item: existing } = await workItems.upsert({
      orgId: ORG,
      userId: USER,
      factoryProjectId: PROJECT,
      input: {
        ...FIXTURES[0]!.input,
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'new-source',
        },
      },
    });
    const existingRow = await new Cards(storage.ops).findOne({ id: existing.id });
    const originalId = cards.get('github issue')!;
    await storage.ops.updateMany(
      'work_items',
      { id: originalId },
      {
        external_source: existingRow!.external_source,
        source_key: existingRow!.source_key,
        updated_at: new Date(Date.now() + 1000),
      },
    );
    const before = await readSplit(storage);

    const report = await migrateWorkItemSplit(storage);

    expect(report).toMatchObject({
      workItems: 0,
      recopied: 0,
      skipped: [{ id: originalId, reason: expect.stringMatching(/source/) }],
    });
    expect(await readSplit(storage)).toEqual(before);
    await workItems.init();
    expect(await readSplit(storage)).toEqual(before);
  });

  it('copies each card once when two replicas boot at the same time', async () => {
    const { storage, workItems } = await createStorage(backend);
    await seed(workItems);
    await seedLegacy(storage);

    const reports = await Promise.all([migrateWorkItemSplit(storage), migrateWorkItemSplit(storage)]);

    expect(reports[0]!.boardItems + reports[1]!.boardItems).toBe(FIXTURES.length);
    const split = await readSplit(storage);
    expect(split.boardItems.size).toBe(FIXTURES.length);
    expect(split.workItems.size).toBe(FIXTURES.length);
  });

  it('invalidates cached card lists for the boards it wrote', async () => {
    const { storage, workItems } = await createStorage(backend);
    await seed(workItems);
    await seedLegacy(storage);
    const before = await readBoardVersion(storage.ops, ORG, PROJECT);

    await migrateWorkItemSplit(storage);

    expect(await readBoardVersion(storage.ops, ORG, PROJECT)).not.toBe(before);
  });

  it('detects copied changes that an old replica writes without touching updated_at', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    await migrateWorkItemSplit(storage);
    const id = cards.get('github issue')!;
    const armed = new Date('2031-01-01T00:00:00Z');
    await storage.ops.updateMany('work_items', { id }, { autonomy_armed_at: armed });
    const report = await migrateWorkItemSplit(storage);
    expect(report).toMatchObject({ recopied: 1, skipped: [] });
    expect((await readSplit(storage)).boardItems.get(id)?.autonomy_armed_at).toEqual(armed);
    expect(await migrateWorkItemSplit(storage)).toMatchObject({ recopied: 0, unchanged: FIXTURES.length });
    // A timestamp-only fingerprint would miss this second Date-only change too.
    const later = new Date('2032-01-01T00:00:00Z');
    await storage.ops.updateMany('work_items', { id }, { autonomy_armed_at: later });
    expect(await migrateWorkItemSplit(storage)).toMatchObject({ recopied: 1 });
    expect((await readSplit(storage)).boardItems.get(id)?.autonomy_armed_at).toEqual(later);
  });

  it("shows an old replica's rewrite on every card of the issue once it is recopied, after links were backfilled", async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    await migrateWorkItemSplit(storage);
    const id = cards.get('github issue')!;
    const second = (await workItems.linkWorkItemToBoard({
      orgId: ORG,
      id,
      board: 'security',
      stage: 'triage',
      userId: USER,
    }))!;
    await backfillSourceLinks(storage);
    const legacy = (await storage.ops.findOne<WorkItemDbRow>('work_items', { id }))!;
    await storage.ops.updateMany(
      'work_items',
      { id },
      { metadata: { ...legacy.metadata, labels: [{ name: 'bug' }, { name: 'p1' }] } },
    );

    expect(await migrateWorkItemSplit(storage)).toMatchObject({ recopied: 1 });

    for (const card of [id, second.id]) {
      expect((await workItems.get({ orgId: ORG, id: card }))?.workItem.labels).toEqual(['bug', 'p1']);
    }
  });

  // Production: rows an old replica rewrote during the first rollout. Edited on the board too, they
  // skip; untouched there, they recopy once. Later passes must not repeat the recopies.
  it("recopies an old replica's rewrites once and then reports the same skips on every pass", async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    await migrateWorkItemSplit(storage);
    const recopy = cards.get('github issue')!;
    const skip = cards.get('jira issue')!;
    const copied = (await readSplit(storage)).boardItems.get(skip)!;
    const edited = new Date(copied.updated_at.getTime() + 1_000);
    await storage.ops.updateMany(
      FACTORY_BOARD_ITEMS_SCHEMA.name,
      { id: skip },
      { stages: ['review'], updated_at: edited, revision: copied.revision + 1 },
    );
    for (const id of [recopy, skip]) {
      await storage.ops.updateMany(
        'work_items',
        { id },
        { title: 'Changed by an old replica', updated_at: new Date(edited.getTime() + 1_000) },
      );
    }

    const second = await migrateWorkItemSplit(storage);
    expect(second).toMatchObject({ recopied: 1, workItems: 1, skipped: [{ id: skip }] });

    for (const pass of [await migrateWorkItemSplit(storage), await migrateWorkItemSplit(storage)]) {
      expect(pass).toMatchObject({ recopied: 0, workItems: 0, unchanged: FIXTURES.length - 1 });
      expect(pass.skipped).toEqual(second.skipped);
    }
  });

  it('reports conflicting legacy recopies without reverting newer board state', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    await migrateWorkItemSplit(storage);
    const id = cards.get('github issue')!;
    const copied = (await readSplit(storage)).boardItems.get(id)!;
    const updated = new Date(copied.updated_at.getTime() + 1_000);
    await storage.ops.updateMany(
      FACTORY_BOARD_ITEMS_SCHEMA.name,
      { id },
      {
        stages: ['done'],
        sessions: { build: 'new-session' },
        updated_at: updated,
        revision: copied.revision + 1,
      },
    );
    await storage.ops.updateMany(
      'work_items',
      { id },
      {
        title: 'Changed by an old replica',
        updated_at: new Date(updated.getTime() + 1_000),
      },
    );
    const report = await migrateWorkItemSplit(storage);
    expect(report).toMatchObject({
      recopied: 0,
      skipped: [{ id, reason: expect.stringContaining('changed after migration') }],
    });
    expect((await readSplit(storage)).boardItems.get(id)).toMatchObject({
      stages: ['done'],
      sessions: { build: 'new-session' },
    });
  });

  it.each(['newer migration', 'board edit'] as const)(
    'does not overwrite a %s that lands after recopy planning',
    async competingWrite => {
      const { storage, workItems } = await createStorage(backend);
      const { item } = await workItems.upsert({
        orgId: ORG,
        factoryProjectId: PROJECT,
        userId: USER,
        input: FIXTURES[0]!.input,
      });
      await seedLegacy(storage);
      await migrateWorkItemSplit(storage);
      await storage.ops.updateMany(
        'work_items',
        { id: item.id },
        { title: 'Stale snapshot', updated_at: new Date('2031-01-01') },
      );
      let scheduled = false;
      // Only schedule the competing real write; every transaction still uses the real backend.
      const withTransaction: FactoryStorage['withTransaction'] = async callback => {
        if (!scheduled) {
          scheduled = true;
          if (competingWrite === 'newer migration') {
            await storage.ops.updateMany(
              'work_items',
              { id: item.id },
              { title: 'Newest legacy snapshot', updated_at: new Date('2032-01-01') },
            );
            expect(await migrateWorkItemSplit(storage)).toMatchObject({ recopied: 1 });
          } else {
            await storage.ops.updateMany(
              FACTORY_BOARD_ITEMS_SCHEMA.name,
              { id: item.id },
              {
                stages: ['done'],
                updated_at: new Date('2033-01-01'),
              },
            );
          }
        }
        return storage.withTransaction(callback);
      };
      const report = await migrateWorkItemSplit({ ops: storage.ops, withTransaction });
      expect(report).toMatchObject({
        recopied: 0,
        skipped: [
          {
            id: item.id,
            reason: expect.stringContaining(
              competingWrite === 'newer migration' ? 'baseline changed' : 'changed after migration',
            ),
          },
        ],
      });
      const split = await readSplit(storage);
      const board = split.boardItems.get(item.id)!;
      if (competingWrite === 'newer migration') {
        expect(split.workItems.get(board.work_item_id)?.title).toBe('Newest legacy snapshot');
        expect(board.migrated_from_updated_at).toEqual(new Date('2032-01-01'));
      } else {
        expect(board.stages).toEqual(['done']);
      }
    },
  );

  it('supports several sources per work item and scopes duplicate sources to a project', async () => {
    const { storage, workItems } = await createStorage(backend);
    await seed(workItems);
    await migrateWorkItemSplit(storage);
    const [source] = (await readSplit(storage)).sources;
    await storage.ops.insertOne(FACTORY_WORK_ITEM_SOURCES_SCHEMA.name, {
      ...source!,
      id: crypto.randomUUID(),
      external_id: 'another-source',
      source_key: 'another-source',
    });
    expect(
      await storage.ops.findMany(FACTORY_WORK_ITEM_SOURCES_SCHEMA.name, { work_item_id: source!.work_item_id }),
    ).toHaveLength(2);
    await expect(
      storage.ops.insertOne(FACTORY_WORK_ITEM_SOURCES_SCHEMA.name, {
        ...source!,
        id: crypto.randomUUID(),
      }),
    ).rejects.toThrow();
    await storage.ops.insertOne(FACTORY_WORK_ITEM_SOURCES_SCHEMA.name, {
      ...source!,
      id: crypto.randomUUID(),
      factory_project_id: 'another-project',
    });
    expect(
      await storage.ops.findMany(FACTORY_WORK_ITEM_SOURCES_SCHEMA.name, {
        provider: source!.provider,
        external_id: source!.external_id,
      }),
    ).toHaveLength(2);
  });

  it('reports without writing on a dry run', async () => {
    const { storage, workItems } = await createStorage(backend);
    await seed(workItems);
    await seedLegacy(storage);

    const report = await migrateWorkItemSplit(storage, { dryRun: true });

    expect(report).toMatchObject({ dryRun: true, cards: FIXTURES.length, workItems: FIXTURES.length });
    const split = await readSplit(storage);
    expect(split.boardItems.size).toBe(0);
    expect(split.workItems.size).toBe(0);
  });

  it('defers excluded cards without looking them up, and a later pass copies them', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    const later = new Set([cards.get('jira issue')!, cards.get('linear issue')!]);

    const first = await migrateWorkItemSplit(storage, { include: row => !later.has(row.id) });

    expect(first).toMatchObject({
      cards: FIXTURES.length,
      deferred: 2,
      workItems: FIXTURES.length - 2,
      skipped: [],
      aborted: false,
    });
    const split = await readSplit(storage);
    expect([...later].filter(id => split.boardItems.has(id))).toEqual([]);

    expect(await migrateWorkItemSplit(storage)).toMatchObject({
      deferred: 0,
      workItems: 2,
      unchanged: FIXTURES.length - 2,
      skipped: [],
    });
    expect((await readSplit(storage)).boardItems.size).toBe(FIXTURES.length);
  });

  it('invalidates cached boards after every page, not only at the end of the pass', async () => {
    const { storage, workItems } = await createStorage(backend);
    await seed(workItems);
    await seedLegacy(storage);
    const before = await readBoardVersion(storage.ops, ORG, PROJECT);
    const seen: Array<number | string | null> = [];
    let transactions = 0;
    const withTransaction: FactoryStorage['withTransaction'] = async callback => {
      transactions += 1;
      // Page one (two cards) committed; page two starts here.
      if (transactions === 3) seen.push(await readBoardVersion(storage.ops, ORG, PROJECT));
      return storage.withTransaction(callback);
    };

    await migrateWorkItemSplit({ ops: storage.ops, withTransaction }, { pageSize: 2 });

    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toEqual(before);
  });

  it('records the newest legacy row as the completion watermark and rescans nothing after it', async () => {
    const { storage, workItems } = await createStorage(backend);
    await seed(workItems);
    await seedLegacy(storage);
    const legacy = await storage.ops.findMany<{ id: string; updated_at: Date }>('work_items', {});
    const newest = legacy.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime() || (a.id < b.id ? 1 : -1))[0]!;

    const watermark = await readLegacyWatermark(storage.ops);
    expect(watermark).toEqual({ updatedAt: newest.updated_at, id: newest.id });
    expect(await readWorkItemSplitMarker(storage.ops)).toBeNull();
    await migrateWorkItemSplit(storage);
    await recordWorkItemSplitComplete(storage.ops, watermark);
    expect(await readWorkItemSplitMarker(storage.ops)).toMatchObject({ watermark });

    const counted = countingOps(storage.ops);
    const report = await migrateWorkItemSplit(storage, { ops: counted.ops, since: watermark });

    expect(report).toMatchObject({ cards: 0, workItems: 0, skipped: [] });
    expect(counted.legacyQueries()).toBe(1);
  });

  it('recopies exactly the rows an older replica wrote after the watermark', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    await migrateWorkItemSplit(storage);
    const watermark = await readLegacyWatermark(storage.ops);
    await recordWorkItemSplitComplete(storage.ops, watermark);
    const id = cards.get('jira issue')!;
    await storage.ops.updateMany(
      'work_items',
      { id },
      { stages: ['planning'], updated_at: new Date(watermark!.updatedAt.getTime() + 1_000) },
    );

    const report = await migrateWorkItemSplit(storage, { since: watermark });

    expect(report).toMatchObject({ cards: 1, recopied: 1, skipped: [] });
    expect((await readSplit(storage)).boardItems.get(id)?.stages).toEqual(['planning']);
    expect(await readLegacyWatermark(storage.ops)).toMatchObject({ id });
  });

  it('copies nothing again over a database an earlier release already migrated', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    await migrateWorkItemSplit(storage);
    const before = await readSplit(storage);
    const open = new Set([cards.get('github issue')!]);

    expect(await migrateWorkItemSplit(storage, { include: row => open.has(row.id) })).toMatchObject({
      workItems: 0,
      deferred: FIXTURES.length - 1,
      skipped: [],
    });
    expect(await migrateWorkItemSplit(storage)).toMatchObject({ workItems: 0, skipped: [] });
    expect(await readSplit(storage)).toEqual(before);
  });

  it('summarizes skipped cards on one line with at most ten sample ids', async () => {
    const { storage, workItems } = await createStorage(backend);
    const ids: string[] = [];
    for (let index = 0; index < 12; index += 1) {
      const { item } = await workItems.upsert({
        orgId: ORG,
        userId: USER,
        factoryProjectId: PROJECT,
        input: { title: `Native ${index}`, stages: ['planning'], sessions: {}, metadata: {} },
      });
      ids.push(item.id);
    }
    await seedLegacy(storage);
    await migrateWorkItemSplit(storage);
    const later = new Date(Date.now() + 60_000);
    for (const id of ids) {
      await workItems.update({ orgId: ORG, id, userId: USER, patch: { stages: ['review'] } });
      await storage.ops.updateMany('work_items', { id }, { stages: ['done'], updated_at: later });
    }
    const logged: string[] = [];

    const report = await migrateWorkItemSplit(storage, { label: 'background pass', log: line => logged.push(line) });

    expect(report.skipped).toHaveLength(12);
    expect(logged).toHaveLength(1);
    const [line] = logged as [string];
    expect(line).not.toContain('\n');
    expect(line).toMatch(
      /^work item split \(background pass\): 12 cards checked, 0 copied, 0 recopied, 0 unchanged, 0 deferred, 12 skipped — /,
    );
    for (const skip of report.skipped.slice(0, 10)) expect(line).toContain(`${skip.id} (${skip.reason})`);
    for (const skip of report.skipped.slice(10)) expect(line).not.toContain(skip.id);
    expect(line).toMatch(/; and 2 more$/);
  });

  it('logs progress only once a pass outlasts the progress interval', async () => {
    const { storage, workItems } = await createStorage(backend);
    await seed(workItems);
    await seedLegacy(storage);
    const fast: string[] = [];
    await migrateWorkItemSplit(storage, { pageSize: 2, label: 'boot pass', log: line => fast.push(line) });
    // A fast pass: only the summary.
    expect(fast).toHaveLength(1);
    expect(fast[0]).toMatch(/^work item split \(boot pass\): \d+ cards checked, /);

    await storage.ops.updateMany('work_items', {}, { updated_at: new Date(Date.now() + 60_000), stages: ['review'] });
    const slow: string[] = [];
    let clock = 0;
    await migrateWorkItemSplit(storage, {
      pageSize: 2,
      label: 'boot pass',
      log: line => slow.push(line),
      progressIntervalMs: 10_000,
      now: () => (clock += 4_000),
    });
    const progress = slow.slice(0, -1);
    expect(progress.length).toBeGreaterThan(0);
    // Throttled: fewer lines than cards, each a single progress line naming the pass and total.
    expect(progress.length).toBeLessThan(FIXTURES.length);
    for (const line of progress)
      expect(line).toMatch(
        new RegExp(
          `^work item split \\(boot pass\\): \\d+/${FIXTURES.length} cards checked, \\d+ copied, \\d+ skipped$`,
        ),
      );
    expect(slow.at(-1)).toMatch(/cards checked, .* recopied, /);
  });

  it('issues only the page query for a page whose rows are all deferred', async () => {
    const { storage, workItems } = await createStorage(backend);
    await seed(workItems);
    await seedLegacy(storage);
    const counted = countingOps(storage.ops);

    const report = await migrateWorkItemSplit(storage, { ops: counted.ops, include: () => false });

    expect(report).toMatchObject({ deferred: FIXTURES.length, workItems: 0 });
    expect(counted.queries()).toBe(1);
  });

  it('stops before copying anything when the pass is aborted', async () => {
    const { storage, workItems } = await createStorage(backend);
    await seed(workItems);
    await seedLegacy(storage);
    const controller = new AbortController();
    controller.abort();

    const report = await migrateWorkItemSplit(storage, { signal: controller.signal });

    expect(report).toMatchObject({ aborted: true, workItems: 0 });
    expect((await readSplit(storage)).boardItems.size).toBe(0);
  });

  it('copies a legacy card inside a caller transaction, skipping tombstones and held sources', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await seedLegacy(storage);
    const plain = cards.get('factory card')!;
    const deleted = cards.get('jira issue')!;
    const held = cards.get('github issue')!;
    await storage.ops.insertOne(FACTORY_BOARD_ITEM_TOMBSTONES_SCHEMA.name, {
      id: deleted,
      org_id: ORG,
      factory_project_id: PROJECT,
    });
    // A newer card already owns the GitHub issue under another id.
    const { item: holder } = await workItems.upsert({
      orgId: ORG,
      userId: USER,
      factoryProjectId: PROJECT,
      input: FIXTURES[0]!.input,
    });
    const rows = await storage.ops.findMany<WorkItemDbRow>('work_items', { id: { in: [plain, deleted, held] } });

    const copied = await storage.withTransaction(async tx => {
      const ids = await copyLegacyRows(tx, rows);
      // The caller's transaction must still be usable afterwards (Postgres aborts on a unique violation).
      await tx.findOne(FACTORY_BOARD_ITEMS_SCHEMA.name, { id: plain });
      return ids;
    });

    expect(copied).toEqual([plain]);
    const split = await readSplit(storage);
    expect(split.boardItems.has(plain)).toBe(true);
    expect(split.boardItems.has(deleted)).toBe(false);
    expect(split.boardItems.has(held)).toBe(false);
    expect(split.boardItems.has(holder.id)).toBe(true);
  });
});

function countingOps(ops: FactoryStorageOps) {
  let legacy = 0;
  let all = 0;
  const counted = new Proxy(ops, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      if (property !== 'findMany' && property !== 'findOne') return value.bind(target);
      return (collection: string, ...rest: unknown[]) => {
        all += 1;
        if (collection === 'work_items') legacy += 1;
        return value.call(target, collection, ...rest);
      };
    },
  });
  return { ops: counted, legacyQueries: () => legacy, queries: () => all };
}
