import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { BoardsStorage } from '../storage/domains/boards/base.js';
import { defineBoard } from './define-board.js';
import { createBoardRegistry } from './registry.js';
import { BoardResolver } from './resolver.js';
import { defaultProjectBoardConfig, workBoardTemplate } from './templates/work.js';
import { workBoard } from './work.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const engines = ['libsql', ...(postgresUrl ? ['postgres'] : [])];

const customBoard = defineBoard({
  id: 'ops',
  title: 'Ops',
  initialPhase: 'open',
  phases: { open: { kind: 'resting', next: 'closed' }, closed: { kind: 'terminal' } },
});

function newScope() {
  return { orgId: `org-${randomUUID()}`, factoryProjectId: randomUUID(), userId: 'user-1' };
}

async function storageFor(engine: string) {
  const storage =
    engine === 'postgres'
      ? new PgFactoryStorage({ id: 'resolver-test', connectionString: postgresUrl! })
      : new LibSQLFactoryStorage({ id: 'resolver-test', url: ':memory:' });
  const boardDefinitions = storage.registerDomain(new BoardsStorage());
  await storage.init();
  onTestFinished(() => storage.close());
  return { boardDefinitions };
}

describe.each(engines)('BoardResolver (%s)', engine => {
  it('runs the code boards until the project stores some, then the stored ones', async () => {
    const { boardDefinitions } = await storageFor(engine);
    const scope = newScope();
    const resolver = new BoardResolver({ codeBoards: createBoardRegistry(), storage: boardDefinitions, recheckMs: 0 });

    const before = await resolver.forProject(scope);
    expect(before.get('work')).toBe(workBoard);
    expect(await resolver.intakeRoutes(scope)).toEqual([]);

    await boardDefinitions.seedDefaults(scope);
    const after = await resolver.forProject(scope);
    const stored = after.get('work')!;
    expect(stored).not.toBe(workBoard);
    expect(stored.transitions).toEqual(workBoard.transitions);
    expect(stored.rules.triage?.issue?.onEnter).toBe(workBoard.rules.triage?.issue?.onEnter);
    // Pull requests live on Work; there is no Review board.
    expect(after.get('review')).toBeUndefined();
    expect((await resolver.intakeRoutes(scope)).map(route => route.boardKey)).toEqual(['work', 'work']);
  });

  it('sees a write from another process once the recheck window passes', async () => {
    const { boardDefinitions } = await storageFor(engine);
    const scope = newScope();
    await boardDefinitions.seedDefaults(scope);
    let now = 0;
    const resolver = new BoardResolver({
      codeBoards: createBoardRegistry(),
      storage: boardDefinitions,
      recheckMs: 1_000,
      now: () => now,
    });
    expect((await resolver.forProject(scope)).get('work')!.allowsTransition('planning', 'done')).toBe(true);

    // Another writer narrows Planning to Building only.
    await boardDefinitions.saveConfig({
      ...scope,
      userId: 'user-2',
      expectedRevision: 1,
      config: {
        ...defaultProjectBoardConfig,
        boards: [
          {
            ...workBoardTemplate,
            phases: workBoardTemplate.phases.map(phase =>
              phase.key === 'planning' ? { ...phase, nextPhases: ['execute'] } : phase,
            ),
          },
        ],
      },
    });

    now = 999;
    expect((await resolver.forProject(scope)).get('work')!.allowsTransition('planning', 'done')).toBe(true);
    now = 1_000;
    const fresh = (await resolver.forProject(scope)).get('work')!;
    expect(fresh.allowsTransition('planning', 'done')).toBe(false);
    expect(fresh.allowsTransition('planning', 'execute')).toBe(true);
    expect(resolver.peek(scope).get('work')).toBe(fresh);
  });

  it('ignores a stored board whose key a deployment board already uses', async () => {
    const { boardDefinitions } = await storageFor(engine);
    const scope = newScope();
    await boardDefinitions.saveConfig({
      ...scope,
      expectedRevision: 0,
      config: {
        boards: [
          {
            key: 'ops',
            name: 'Stored ops',
            phases: [
              { key: 'a', name: 'A', kind: 'resting' },
              { key: 'z', name: 'Z', kind: 'terminal' },
            ],
          },
        ],
        intakeRoutes: [],
      },
    });
    const warnings: string[] = [];
    const resolver = new BoardResolver({
      codeBoards: createBoardRegistry({ boards: [customBoard] }),
      installedBoardIds: new Set(['ops']),
      storage: boardDefinitions,
      warn: message => warnings.push(message),
    });
    expect((await resolver.forProject(scope)).get('ops')).toBe(customBoard);
    expect(warnings).toEqual([
      `Stored board 'ops' in project ${scope.factoryProjectId} is ignored: a code board uses that id.`,
    ]);
  });

  it('keeps projects apart', async () => {
    const { boardDefinitions } = await storageFor(engine);
    const seeded = newScope();
    const other = { ...newScope(), orgId: seeded.orgId };
    await boardDefinitions.seedDefaults(seeded);
    const resolver = new BoardResolver({ codeBoards: createBoardRegistry(), storage: boardDefinitions, recheckMs: 0 });
    expect((await resolver.forProject(seeded)).get('work')).not.toBe(workBoard);
    expect((await resolver.forProject(other)).get('work')).toBe(workBoard);
  });

  it('runs the code boards while the boards domain is unavailable', async () => {
    const { boardDefinitions } = await storageFor(engine);
    const scope = newScope();
    await boardDefinitions.seedDefaults(scope);
    const resolver = new BoardResolver({
      codeBoards: createBoardRegistry(),
      storage: boardDefinitions,
      storageReady: () => false,
    });
    expect((await resolver.forProject(scope)).get('work')).toBe(workBoard);
  });

  it('seeds a project once, even when two seeds race', async () => {
    const { boardDefinitions } = await storageFor(engine);
    const scope = newScope();
    const results = await Promise.all([boardDefinitions.seedDefaults(scope), boardDefinitions.seedDefaults(scope)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await boardDefinitions.getRevision(scope)).toBe(1);
    expect(await boardDefinitions.seedDefaults(scope)).toBe(false);
  });
});
