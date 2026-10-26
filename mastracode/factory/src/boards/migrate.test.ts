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
});
