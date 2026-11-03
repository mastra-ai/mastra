import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { StoredBoardsStorage } from '../storage/domains/boards/base.js';
import type { StoredBoardInput, StoredBoardScope } from '../storage/domains/boards/base.js';
import { compileBoardDefinition } from './define-board.js';
import type { BoardPhaseDefinition } from './define-board.js';
import { ProjectBoardCache, toBoardSource } from './project-boards.js';
import type { ProjectBoardCacheOptions } from './project-boards.js';
import { createBoardRegistry } from './registry.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';
import { reviewBoard } from './review.js';
import { boardDefinitionOf } from './stored-board.js';
import { workBoard } from './work.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const RECHECK_MS = 1000;

const shipped = () => undefined;

/** An app board as `MastraFactory({ boards })` receives it; `names` changes its phase names between "releases". */
function appBoard(id: string, names: { queued?: string; shipping?: string } = {}): InstalledBoard {
  return compileBoardDefinition<string, Record<string, BoardPhaseDefinition<string>>>({
    id,
    name: `Board ${id}`,
    initialPhase: 'queued',
    phases: {
      queued: { name: names.queued ?? 'Queued', kind: 'resting', nextPhases: ['shipping'] },
      shipping: {
        name: names.shipping ?? 'Shipping',
        kind: 'working',
        runner: { context: 'work' },
        nextPhases: ['shipped'],
        onEnter: { manual: shipped },
      },
      shipped: { name: 'Shipped', kind: 'terminal' },
    },
  });
}

/** A board a project created through the boards API. */
function bugsBoard(name = 'Bugs'): StoredBoardInput {
  return {
    key: 'bugs',
    name,
    phases: [
      { key: 'reported', name: 'Reported', kind: 'resting' },
      { key: 'fixing', name: 'Fixing', kind: 'working', runner: { context: 'work' } },
      { key: 'fixed', name: 'Fixed', kind: 'terminal' },
    ],
  };
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('ProjectBoardCache on %s', backend => {
  async function client(url: string) {
    const storage =
      backend === 'postgres'
        ? new PgFactoryStorage({ id: `project-boards-${randomUUID()}`, connectionString: postgresUrl! })
        : new LibSQLFactoryStorage({ id: `project-boards-${randomUUID()}`, url });
    const boards = storage.registerDomain(new StoredBoardsStorage());
    await storage.init();
    onTestFinished(() => storage.close());
    return { storage, boards };
  }

  /** Two storage clients on one database stand in for two replicas. */
  async function setup() {
    let url = ':memory:';
    if (backend === 'libsql') {
      const dir = mkdtempSync(join(tmpdir(), 'factory-project-boards-'));
      onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
      url = `file:${join(dir, 'boards.db')}`;
    }
    const a = await client(url);
    const b = await client(url);
    const orgId = `org-${randomUUID()}`;
    const scope: StoredBoardScope = { orgId, factoryProjectId: 'project-1' };
    return { a, b, scope, orgId };
  }

  function cache(
    storage: StoredBoardsStorage,
    codeRegistry: BoardRegistry = createBoardRegistry({ boards: [appBoard('release')] }),
    options: Pick<ProjectBoardCacheOptions, 'now' | 'warn' | 'projects'> = {},
  ) {
    return new ProjectBoardCache({ codeRegistry, storage, recheckMs: RECHECK_MS, ...options });
  }

  it('serves the code boards as code built them, read-only, without writing anything', async () => {
    const { a, scope } = await setup();
    const release = appBoard('release');
    const boards = cache(a.boards, createBoardRegistry({ boards: [release] }));

    const described = await boards.describe(scope);

    expect(await a.boards.list(scope)).toEqual([]);
    expect(await a.boards.readVersion(scope)).toBeNull();
    expect([...described.registry.keys()]).toEqual(['work', 'review', 'release']);
    expect(described.registry.get('work')).toBe(workBoard);
    expect(described.registry.get('review')).toBe(reviewBoard);
    expect(described.registry.get('release')).toBe(release);
    expect(described.details.get('work')).toEqual({ source: 'builtin', editable: false, problems: [] });
    expect(described.details.get('review')).toEqual({ source: 'builtin', editable: false, problems: [] });
    expect(described.details.get('release')).toEqual({ source: 'app', editable: false, problems: [] });
    expect(described.problems).toEqual([]);
  });

  it('serves a changed code board after a restart, with no database write', async () => {
    const { a, scope } = await setup();
    await a.boards.create(scope, bugsBoard(), 'user-1');
    await cache(a.boards).load(scope);
    const version = await a.boards.readVersion(scope);

    const restarted = cache(
      a.boards,
      createBoardRegistry({ boards: [appBoard('release', { shipping: 'Publishing' })] }),
    );
    const registry = await restarted.load(scope);

    expect(registry.get('release')!.phases.shipping!.name).toBe('Publishing');
    expect(registry.get('release')!.rules.shipping?.manual?.onEnter).toBe(shipped);
    expect((await a.boards.list(scope)).map(row => [row.key, row.revision])).toEqual([['bugs', 1]]);
    expect(await a.boards.readVersion(scope)).toBe(version);
  });

  it('adds a board the project stored after the code boards: at once where it was written, after the recheck window elsewhere', async () => {
    const { a, b, scope } = await setup();
    let now = 0;
    const replicaA = cache(a.boards, undefined, { now: () => now });
    const replicaB = cache(b.boards, undefined, { now: () => now });
    await replicaA.load(scope);
    await replicaB.load(scope);

    await a.boards.create(scope, bugsBoard(), 'user-1');
    replicaA.invalidate(scope);

    const described = await replicaA.describe(scope);
    expect([...described.registry.keys()]).toEqual(['work', 'review', 'release', 'bugs']);
    expect(described.registry.get('bugs')!.initialPhase).toBe('reported');
    expect(described.details.get('bugs')).toEqual({ source: 'stored', editable: true, problems: [] });
    now = RECHECK_MS - 1;
    expect((await replicaB.load(scope)).has('bugs')).toBe(false);
    expect(replicaB.forProject(scope).has('bugs')).toBe(false);
    now = RECHECK_MS;
    expect((await replicaB.load(scope)).has('bugs')).toBe(true);
    expect(replicaB.forProject(scope).get('bugs')!.name).toBe('Bugs');
  });

  it('hides a stored board under a code board key and reports it', async () => {
    const { a, scope } = await setup();
    const release = appBoard('release');
    await a.boards.create(scope, { ...boardDefinitionOf(release), name: 'Stored release' }, 'user-1');
    await a.boards.create(scope, bugsBoard(), 'user-1');

    const described = await cache(a.boards, createBoardRegistry({ boards: [release] })).describe(scope);

    expect(described.registry.get('release')).toBe(release);
    expect(described.details.get('release')).toEqual({ source: 'app', editable: false, problems: [] });
    expect(described.registry.has('bugs')).toBe(true);
    expect(described.problems).toEqual(['Stored board "release" is hidden by the code board with the same key.']);
  });

  it('skips a stored board that no longer compiles and still loads the code boards and the other stored boards', async () => {
    const { a, scope } = await setup();
    await a.boards.create(scope, bugsBoard(), 'user-1');
    await a.boards.create(scope, { ...bugsBoard('Chores'), key: 'chores' }, 'user-1');
    // A row written outside the boards API: a terminal phase cannot be where cards start.
    await a.storage.ops.updateMany(
      'factory_board_phases',
      { org_id: scope.orgId, factory_project_id: scope.factoryProjectId, board_key: 'bugs', phase_key: 'reported' },
      { kind: 'terminal' },
    );

    const warnings: string[] = [];
    const described = await cache(a.boards, undefined, { warn: message => warnings.push(message) }).describe(scope);

    expect([...described.registry.keys()]).toEqual(['work', 'review', 'release', 'chores']);
    expect(described.problems).toEqual([expect.stringMatching(/^Board 'bugs' could not be loaded: .*resting/)]);
    expect(warnings).toEqual([expect.stringContaining("Board 'bugs' could not be loaded")]);
  });

  it("keeps one project's stored boards out of another project", async () => {
    const { a, orgId } = await setup();
    const first = { orgId, factoryProjectId: 'project-1' };
    const second = { orgId, factoryProjectId: 'project-2' };
    const boards = cache(a.boards);
    await a.boards.create(first, bugsBoard(), 'user-1');

    expect((await boards.load(first)).has('bugs')).toBe(true);
    expect([...(await boards.load(second)).keys()]).toEqual(['work', 'review', 'release']);
  });

  it('serves no built-in boards when the app turns them off', async () => {
    const { a, scope } = await setup();
    const registry = await cache(
      a.boards,
      createBoardRegistry({ boards: [appBoard('release')], includeDefaultBoards: false }),
    ).load(scope);

    expect([...registry.keys()]).toEqual(['release']);
    expect(await a.boards.list(scope)).toEqual([]);
  });

  it('serves the code boards to a sync read of a project that has not been loaded yet', async () => {
    const { a, scope } = await setup();
    await a.boards.create(scope, bugsBoard(), 'user-1');
    const codeRegistry = createBoardRegistry({ boards: [appBoard('release')] });
    const boards = cache(a.boards, codeRegistry);

    expect(boards.forProject(scope)).toBe(codeRegistry);
    const loaded = await boards.load(scope);
    expect(boards.forProject(scope)).toBe(loaded);
    expect(loaded.has('bugs')).toBe(true);
  });

  it('warms every project at startup by reading only', async () => {
    const { a, orgId } = await setup();
    const first = { orgId, factoryProjectId: 'project-1' };
    const second = { orgId, factoryProjectId: 'project-2' };
    await a.boards.create(first, bugsBoard(), 'user-1');
    const boards = cache(a.boards, undefined, {
      projects: {
        listAll: async () => [
          { orgId, id: first.factoryProjectId },
          { orgId, id: second.factoryProjectId },
        ],
      },
    });

    await boards.preload();

    expect(boards.forProject(first).has('bugs')).toBe(true);
    expect([...boards.forProject(second).keys()]).toEqual(['work', 'review', 'release']);
    expect(await a.boards.list(second)).toEqual([]);
    expect(await a.boards.readVersion(second)).toBeNull();
  });

  it('loads a project once when several callers ask for it at the same time', async () => {
    const { a, scope } = await setup();
    const boards = cache(a.boards);

    const [first, second, third] = await Promise.all([boards.load(scope), boards.load(scope), boards.load(scope)]);

    expect(second).toBe(first);
    expect(third).toBe(first);
  });
});

describe('toBoardSource', () => {
  it('treats only a project board cache as a per-project source, not any object with a forProject function', () => {
    const registry = createBoardRegistry();
    const lookalike = Object.assign(new Map<string, InstalledBoard>(), { forProject: () => registry });
    const storage = new StoredBoardsStorage();
    const projectCache = new ProjectBoardCache({ codeRegistry: registry, storage });

    expect(toBoardSource(lookalike)).not.toBe(lookalike);
    expect(toBoardSource(lookalike).codeRegistry).toBe(lookalike);
    expect(toBoardSource(lookalike).forProject({ orgId: 'org', factoryProjectId: 'p' })).toBe(lookalike);
    expect(toBoardSource(projectCache)).toBe(projectCache);
    const wrapped = toBoardSource(registry);
    expect(toBoardSource(wrapped)).toBe(wrapped);
  });
});
