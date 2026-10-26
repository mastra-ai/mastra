import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { BoardsStorage } from '../storage/domains/boards/base.js';
import { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { migrateBoards } from './migrate.js';
import { defaultProjectBoardConfig } from './templates/work.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const engines = ['libsql', ...(postgresUrl ? ['postgres'] : [])];

async function setup(engine: string) {
  const storage =
    engine === 'postgres'
      ? new PgFactoryStorage({ id: 'migrate-test', connectionString: postgresUrl! })
      : new LibSQLFactoryStorage({ id: 'migrate-test', url: ':memory:' });
  const boards = storage.registerDomain(new BoardsStorage());
  const projects = storage.registerDomain(new FactoryProjectsStorage());
  const workItems = storage.registerDomain(new WorkItemsStorage());
  await storage.init();
  onTestFinished(() => storage.close());
  const orgId = `org-${randomUUID()}`;
  const project = (name: string) => projects.create({ orgId, userId: 'user-1', input: { name } });
  return { boards, workItems, orgId, project };
}

describe.each(engines)('boards migration (%s)', engine => {
  it('keeps going past a card it cannot migrate, so later projects still get their board', async () => {
    const { boards, workItems, orgId, project } = await setup(engine);
    const first = await project('First');
    const second = await project('Second');
    // A Review card written by an older build: its recorded review time is not a date.
    const legacy = await workItems.upsert({
      orgId,
      factoryProjectId: first.id,
      userId: 'user-1',
      input: {
        title: 'Old review',
        board: 'review',
        stages: ['review'],
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: '7' },
        metadata: { reviewVerdict: 'approve', reviewedAt: 'yesterday' },
      },
    });

    const report = await migrateBoards({
      mode: 'apply',
      projects: [first, second],
      boards,
      workItems,
      seedConfig: defaultProjectBoardConfig,
    });

    expect(report).toMatchObject({ projects: 2, boardsSeeded: 2, cardsMoved: 1, skipped: [] });
    for (const scope of [first, second]) {
      expect((await boards.getConfig({ orgId, factoryProjectId: scope.id })).boards.map(b => b.key)).toEqual(['work']);
    }
    expect((await workItems.get({ orgId, id: legacy.item.id }))?.board).toBe('work');
    const link = await workItems.findBySourceKey({
      orgId,
      factoryProjectId: first.id,
      sourceKey: 'github:pull-request:7',
    });
    expect(link).toMatchObject({ workItemId: legacy.item.id, reviewVerdict: 'approve' });

    const again = await migrateBoards({
      mode: 'apply',
      projects: [first, second],
      boards,
      workItems,
      seedConfig: defaultProjectBoardConfig,
    });
    expect(again).toMatchObject({ boardsSeeded: 0, linksBackfilled: 0, cardsMoved: 0, skipped: [] });
  });

  it('leaves Review cards in place when this Factory installs no Work board', async () => {
    const { boards, workItems, orgId, project } = await setup(engine);
    const only = await project('Only');
    const legacy = await workItems.upsert({
      orgId,
      factoryProjectId: only.id,
      userId: 'user-1',
      input: {
        title: 'Old review',
        board: 'review',
        stages: ['review'],
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: '8' },
      },
    });

    const report = await migrateBoards({ mode: 'apply', projects: [only], boards, workItems, moveToWork: false });

    expect(report).toMatchObject({ boardsSeeded: 0, cardsMoved: 0, skipped: [] });
    expect((await workItems.get({ orgId, id: legacy.item.id }))?.board).toBe('review');
  });

  it("folds Factory's pull request card into the card that opened it, handing over its review seat", async () => {
    const { boards, workItems, orgId, project } = await setup(engine);
    const only = await project('Only');
    const scope = { orgId, factoryProjectId: only.id, userId: 'user-1' };
    const issue = await workItems.upsert({
      ...scope,
      input: {
        title: 'Issue 42',
        board: 'work',
        stages: ['review'],
        externalSource: { integrationId: 'github', type: 'issue', externalId: 'github:10:issue:42' },
        sessions: { work: { sessionId: 'builder', branch: 'factory/issue-42', threadId: 'thread-work' } },
        metadata: { openPullRequestNumber: 17 },
      },
    });
    const companion = await workItems.upsert({
      ...scope,
      input: {
        title: 'PR 17',
        board: 'review',
        stages: ['review'],
        parentWorkItemId: issue.item.id,
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:17',
          url: 'https://github.com/acme/repo/pull/17',
        },
        sessions: { review: { sessionId: 'reviewer', branch: 'factory/pr-17', threadId: 'thread-review' } },
        metadata: { factoryAuthored: true, githubRepositoryId: 10, githubPullRequestNumber: 17 },
      },
    });

    const report = await migrateBoards({ mode: 'apply', projects: [only], boards, workItems });

    expect(report).toMatchObject({ cardsFolded: 1, cardsMoved: 0, skipped: [] });
    expect(await workItems.get({ orgId, id: companion.item.id })).toMatchObject({
      board: 'work',
      stages: ['canceled'],
      metadata: { foldedInto: issue.item.id },
    });
    const parent = await workItems.get({ orgId, id: issue.item.id });
    // The independent reviewer keeps reviewing; the builder's seat is untouched.
    expect(parent?.sessions).toMatchObject({
      work: { sessionId: 'builder' },
      review: { sessionId: 'reviewer', threadId: 'thread-review' },
    });
    expect(parent?.metadata).toMatchObject({ openPullRequestUrl: 'https://github.com/acme/repo/pull/17' });
    expect(
      await workItems.findBySourceKey({
        orgId,
        factoryProjectId: only.id,
        sourceKey: 'github:pull-request:github:10:pull-request:17',
      }),
    ).toMatchObject({ workItemId: issue.item.id, factoryAuthored: true });

    expect(await migrateBoards({ mode: 'apply', projects: [only], boards, workItems })).toMatchObject({
      cardsFolded: 0,
      pullRequestLinksMoved: 0,
      skipped: [],
    });
  });
});
