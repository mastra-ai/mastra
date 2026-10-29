import type { FactoryStorage } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it } from 'vitest';

import type { WorkItemsStorage, CreateWorkItemInput } from '../storage/domains/work-items/base.js';
import { readBoardVersion } from '../storage/domains/work-items/board-version.js';
import { Cards } from '../storage/domains/work-items/cards.js';
import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
} from '../storage/domains/work-items/work-item-schema.js';
import type {
  BoardItemDbRecord,
  WorkItemDbRecord,
  WorkItemSourceDbRecord,
} from '../storage/domains/work-items/work-item-schema.js';
import { createFactoryStorageForTests, createIsolatedFactoryPostgresForTests } from '../storage/test-utils.js';
import { migrateWorkItemSplit } from './split-migration.js';

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
      claimKey: 'github:issue:10:42',
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
    await storage.ops.upsertOne('work_items', ['id'], card);
  }
  await storage.ops.deleteMany(FACTORY_BOARD_ITEMS_SCHEMA.name, {});
  await storage.ops.deleteMany(FACTORY_WORK_ITEMS_SCHEMA.name, {});
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
        claim_key: card.claimKey,
        triage_type: card.triageType,
        accepted_at: card.acceptedAt,
        autonomy_armed_at: card.autonomyArmedAt,
        plans_preapproved_at: card.plansPreapprovedAt,
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
        expect(source!.metadata?.[key], `${fixture.name}: source ${key}`).toEqual(card.metadata![key]);
        expect(boardItem!.metadata ?? {}, `${fixture.name}: board item ${key}`).not.toHaveProperty(key);
      }
      for (const key of fixture.boardKeys) {
        expect(boardItem!.metadata?.[key], `${fixture.name}: board item ${key}`).toEqual(card.metadata![key]);
        expect(source?.metadata ?? {}, `${fixture.name}: source ${key}`).not.toHaveProperty(key);
      }
      for (const row of [workItem, boardItem, source].filter(Boolean)) {
        for (const column of ['kind', 'comment_count', 'feed_activity_at']) {
          expect(row, `${fixture.name}: retired ${column}`).not.toHaveProperty(column);
        }
      }
    }
    expect(split.boardItems.get(githubIssue)).toMatchObject({ stages: ['planning'], parent_board_item_id: parent });
  });

  it('preserves classification, acceptance, autonomy and plan grants on the board placement', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
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

  it('copies an old replica claim handoff even when the new owner is migrated first', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
    await migrateWorkItemSplit(storage);
    const oldId = cards.get('github issue')!;
    await workItems.update({ orgId: ORG, id: oldId, userId: USER, patch: { stages: ['done'] } });
    const { item: newOwner } = await workItems.upsert({
      orgId: ORG,
      userId: USER,
      factoryProjectId: 'aaa-project',
      input: { title: 'New owner', claimKey: 'github:issue:10:42' },
    });

    expect(await migrateWorkItemSplit(storage)).toMatchObject({ workItems: 2, recopied: 1, skipped: [] });
    const split = await readSplit(storage);
    expect(split.boardItems.get(oldId)).toMatchObject({ claim_key: null, stages: ['done'] });
    expect(split.boardItems.get(newOwner.id)).toMatchObject({ claim_key: 'github:issue:10:42' });
    expect(await migrateWorkItemSplit(storage)).toMatchObject({ workItems: 0, skipped: [] });
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

  it('reports conflicting legacy recopies without reverting newer board state', async () => {
    const { storage, workItems } = await createStorage(backend);
    const cards = await seed(workItems);
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
});
