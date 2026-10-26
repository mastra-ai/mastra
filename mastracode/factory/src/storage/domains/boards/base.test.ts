import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { defaultProjectBoardConfig, workBoardTemplate } from '../../../boards/templates/work.js';
import { BoardRevisionConflictError, BoardsStorage, UnknownBoardError } from './base.js';
import type { ProjectBoardConfigInput } from './validation.js';

// Set FACTORY_TEST_POSTGRES_URL to a disposable database to run every case on PostgreSQL too.
const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('BoardsStorage on %s', backend => {
  const libsqlFile = () => `file:${join(mkdtempSync(join(tmpdir(), 'factory-boards-')), 'factory.db')}`;

  async function open(url = backend === 'postgres' ? postgresUrl! : ':memory:') {
    const storage =
      backend === 'postgres'
        ? new PgFactoryStorage({ id: 'boards-test', connectionString: url })
        : new LibSQLFactoryStorage({ id: 'boards-test', url });
    const boards = storage.registerDomain(new BoardsStorage());
    await storage.init();
    onTestFinished(() => storage.close());
    return boards;
  }

  // The Postgres database is shared across runs, so every test gets its own org.
  const newScope = () => ({ orgId: `org-${randomUUID()}`, factoryProjectId: randomUUID() });

  const twoPhaseBoard = (key: string, name = 'Two phase') => ({
    key,
    name,
    phases: [
      { key: 'open', name: 'Open', kind: 'resting' as const },
      { key: 'closed', name: 'Closed', kind: 'terminal' as const },
    ],
  });

  it('round-trips the default config with phase order, runners, routes and conditions intact', async () => {
    const boards = await open();
    const scope = newScope();

    const saved = await boards.saveConfig({
      ...scope,
      userId: 'user-1',
      expectedRevision: 0,
      config: defaultProjectBoardConfig,
    });

    expect(saved.revision).toBe(1);
    expect(saved.updatedBy).toBe('user-1');
    expect(saved.boards).toHaveLength(1);
    const [work] = saved.boards;
    expect(work!.key).toBe('work');
    expect(work!.phases.map(phase => phase.key)).toEqual(workBoardTemplate.phases.map(phase => phase.key));
    expect(work!.phases.find(phase => phase.key === 'triage')!.runner).toEqual({
      type: 'agent',
      agentId: 'factory-triage',
      skill: 'factory-triage',
      context: 'triage',
    });
    // Null is kept: the phase runs in the card's main context.
    expect(work!.phases.find(phase => phase.key === 'review')!.runner).toMatchObject({ context: null });
    expect(work!.phases.every(phase => phase.nextPhases === null)).toBe(true);
    // Triage and Review start on their own; Planning only for cards its rule matches.
    expect(work!.phases.filter(phase => phase.autoStart).map(phase => phase.key)).toEqual([
      'triage',
      'planning',
      'review',
    ]);
    expect(work!.phases.map(phase => [phase.key, phase.autoStartWhen])).toContainEqual([
      'planning',
      { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'effort: low' }] },
    ]);
    expect(work!.phases.find(phase => phase.key === 'triage')!.autoStartWhen).toBeNull();
    expect(work!.phases.find(phase => phase.key === 'execute')!.autoStartWhen).toBeNull();
    expect(work!.eventRoutes.map(route => [route.event, route.toPhaseKey])).toEqual(
      workBoardTemplate.eventRoutes.map(route => [route.event, route.toPhaseKey]),
    );
    expect(work!.eventRoutes[1]!.when).toEqual({
      operator: 'AND',
      conditions: [{ field: 'item.hasOtherOpenPullRequest', operator: 'equals', value: false }],
    });
    expect(saved.intakeRoutes).toEqual([
      {
        when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'pull_request' }] },
        boardKey: 'work',
        phaseKey: 'triage',
        enabled: true,
      },
      { when: null, boardKey: 'work', phaseKey: 'triage', enabled: true },
    ]);
    expect(await boards.getConfig(scope)).toEqual(saved);
  });

  it('replaces the whole config on rewrite, keeps board ids by key and bumps the revision', async () => {
    const boards = await open();
    const scope = newScope();
    const first = await boards.saveConfig({
      ...scope,
      userId: 'user-1',
      expectedRevision: 0,
      config: { boards: [twoPhaseBoard('alpha'), twoPhaseBoard('beta')], intakeRoutes: [{ boardKey: 'alpha' }] },
    });
    const alphaId = first.boards[0]!.id;

    const second = await boards.saveConfig({
      ...scope,
      userId: 'user-2',
      expectedRevision: 1,
      config: {
        boards: [
          {
            key: 'alpha',
            name: 'Alpha renamed',
            phases: [
              { key: 'open', name: 'Open', kind: 'resting', nextPhases: ['closed'] },
              { key: 'closed', name: 'Closed', kind: 'terminal' },
            ],
          },
        ],
        intakeRoutes: [],
      },
    });

    expect(second.revision).toBe(2);
    expect(second.updatedBy).toBe('user-2');
    expect(second.boards.map(board => [board.key, board.name])).toEqual([['alpha', 'Alpha renamed']]);
    expect(second.boards[0]!.id).toBe(alphaId);
    expect(second.boards[0]!.phases[0]!.nextPhases).toEqual(['closed']);
    expect(second.intakeRoutes).toEqual([]);
    expect(await boards.getBoard({ ...scope, key: 'beta' })).toBeNull();
  });

  it('rejects a write made against a stale revision and leaves the stored config untouched', async () => {
    const boards = await open();
    const scope = newScope();
    await boards.saveConfig({
      ...scope,
      userId: 'u',
      expectedRevision: 0,
      config: { boards: [twoPhaseBoard('alpha')], intakeRoutes: [] },
    });

    const stale = boards.saveConfig({
      ...scope,
      userId: 'u',
      expectedRevision: 0,
      config: { boards: [twoPhaseBoard('other')], intakeRoutes: [] },
    });

    await expect(stale).rejects.toBeInstanceOf(BoardRevisionConflictError);
    const config = await boards.getConfig(scope);
    expect(config.revision).toBe(1);
    expect(config.boards.map(board => board.key)).toEqual(['alpha']);
  });

  it('lets exactly one of two concurrent first writes win', async () => {
    const boards = await open();
    const scope = newScope();
    const write = (key: string) =>
      boards.saveConfig({
        ...scope,
        userId: key,
        expectedRevision: 0,
        config: { boards: [twoPhaseBoard(key)], intakeRoutes: [] },
      });

    const results = await Promise.allSettled([write('left'), write('right')]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(BoardRevisionConflictError);
    const config = await boards.getConfig(scope);
    expect(config.revision).toBe(1);
    expect(config.boards).toHaveLength(1);
    expect(config.boards[0]!.phases.map(phase => phase.key)).toEqual(['open', 'closed']);
  });

  it('lets exactly one of two concurrent rewrites of the same revision win', async () => {
    const boards = await open();
    const scope = newScope();
    await boards.saveConfig({
      ...scope,
      userId: 'u',
      expectedRevision: 0,
      config: { boards: [twoPhaseBoard('base')], intakeRoutes: [] },
    });
    const write = (key: string) =>
      boards.saveConfig({
        ...scope,
        userId: key,
        expectedRevision: 1,
        config: { boards: [twoPhaseBoard(key)], intakeRoutes: [] },
      });

    const results = await Promise.allSettled([write('left'), write('right')]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const config = await boards.getConfig(scope);
    expect(config.revision).toBe(2);
    expect(config.boards).toHaveLength(1);
    expect(['left', 'right']).toContain(config.boards[0]!.key);
  });

  it('keeps projects and orgs apart', async () => {
    const boards = await open();
    const scope = newScope();
    const otherProject = { ...scope, factoryProjectId: randomUUID() };
    const otherOrg = { ...scope, orgId: `org-${randomUUID()}` };
    await boards.saveConfig({ ...scope, userId: 'u', expectedRevision: 0, config: defaultProjectBoardConfig });
    await boards.saveConfig({
      ...otherProject,
      userId: 'u',
      expectedRevision: 0,
      config: { boards: [twoPhaseBoard('ops')], intakeRoutes: [] },
    });

    expect((await boards.getConfig(scope)).boards[0]!.phases).toHaveLength(7);
    expect((await boards.getConfig(otherProject)).boards[0]!.phases).toHaveLength(2);
    expect(await boards.getConfig(otherOrg)).toEqual({
      revision: 0,
      boards: [],
      intakeRoutes: [],
      updatedBy: null,
      updatedAt: null,
    });
    expect(await boards.getRevision(otherOrg)).toBe(0);
  });

  it('accepts intake routes to code-installed boards only when the caller names them', async () => {
    const boards = await open();
    const scope = newScope();
    const config = { boards: [twoPhaseBoard('alpha')], intakeRoutes: [{ boardKey: 'release' }] };

    await expect(boards.saveConfig({ ...scope, userId: 'u', expectedRevision: 0, config })).rejects.toBeInstanceOf(
      UnknownBoardError,
    );
    expect(await boards.getRevision(scope)).toBe(0);

    const saved = await boards.saveConfig({
      ...scope,
      userId: 'u',
      expectedRevision: 0,
      config,
      externalBoardKeys: ['release'],
    });
    expect(saved.intakeRoutes.map(route => route.boardKey)).toEqual(['release']);
  });

  it('rejects an invalid config before writing anything', async () => {
    const boards = await open();
    const scope = newScope();
    const config: ProjectBoardConfigInput = {
      boards: [
        {
          key: 'alpha',
          name: 'Alpha',
          phases: [
            { key: 'open', name: 'Open', kind: 'resting', nextPhases: ['missing'] },
            { key: 'closed', name: 'Closed', kind: 'terminal' },
          ],
        },
      ],
      intakeRoutes: [],
    };

    await expect(boards.saveConfig({ ...scope, userId: 'u', expectedRevision: 0, config })).rejects.toThrow(
      "Phase 'missing' is not on this board.",
    );
    expect(await boards.getRevision(scope)).toBe(0);
  });

  it('keeps stored boards when the factory restarts over the same database', async () => {
    const url = backend === 'postgres' ? postgresUrl! : libsqlFile();
    const scope = newScope();
    const before = await open(url);
    const saved = await before.saveConfig({
      ...scope,
      userId: 'u',
      expectedRevision: 0,
      config: defaultProjectBoardConfig,
    });

    const after = await open(url);

    expect(await after.getConfig(scope)).toEqual(saved);
  });
});
