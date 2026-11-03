import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type { RuleGroup } from '../rules/rule-group.js';
import { StoredBoardsStorage } from '../storage/domains/boards/base.js';
import type { StoredBoardInput, StoredBoardScope } from '../storage/domains/boards/base.js';
import { codeBoardOf, compileBoardDefinition } from './define-board.js';
import type { BoardPhaseDefinition } from './define-board.js';
import { ProjectBoardCache, toBoardSource } from './project-boards.js';
import type { ProjectBoardCacheOptions } from './project-boards.js';
import { createBoardRegistry } from './registry.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';
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

/** The app board of a later release that declares one more phase with code behaviour. */
function appBoardWithTesting(id: string): InstalledBoard {
  return compileBoardDefinition<string, Record<string, BoardPhaseDefinition<string>>>({
    id,
    name: `Board ${id}`,
    initialPhase: 'queued',
    phases: {
      queued: { name: 'Queued', kind: 'resting', nextPhases: ['shipping'] },
      shipping: {
        name: 'Shipping',
        kind: 'working',
        runner: { context: 'work' },
        nextPhases: ['testing'],
        onEnter: { manual: shipped },
      },
      testing: {
        name: 'Testing',
        kind: 'working',
        runner: { context: 'work' },
        nextPhases: ['shipped'],
        onEnter: { manual: shipped },
      },
      shipped: { name: 'Shipped', kind: 'terminal' },
    },
  });
}

const EFFORT_LOW: RuleGroup = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'effort:low' }],
};

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

  /** Changes a stored row outside the boards API, so it stays unedited, and announces the change. */
  async function writeOutsideApi(
    storage: LibSQLFactoryStorage | PgFactoryStorage,
    scope: StoredBoardScope,
    table: 'factory_boards' | 'factory_board_phases',
    where: Record<string, unknown>,
    set: Record<string, unknown>,
  ) {
    const project = { org_id: scope.orgId, factory_project_id: scope.factoryProjectId };
    await storage.ops.updateMany(table, { ...project, ...where }, set);
    await storage.ops.updateMany('factory_board_definition_versions', project, { version: randomUUID() });
  }

  it("stores a project's Work and app boards on its first load and serves each from its row", async () => {
    const { a, scope } = await setup();
    let now = 0;
    const release = appBoard('release');
    const boards = cache(a.boards, createBoardRegistry({ boards: [release] }), { now: () => now });

    const first = await boards.describe(scope);

    expect((await a.boards.list(scope)).map(row => [row.key, row.revision, row.createdBy])).toEqual([
      ['work', 1, 'factory'],
      ['release', 1, 'factory'],
    ]);
    expect(await a.boards.readVersion(scope)).not.toBeNull();
    expect([...first.registry.keys()]).toEqual(['work', 'release']);
    expect(codeBoardOf(first.registry.get('work')!)).toBe(workBoard);
    expect(codeBoardOf(first.registry.get('release')!)).toBe(release);
    expect(first.details.get('work')).toEqual({ source: 'builtin', editable: true, problems: [] });
    expect(first.details.get('release')).toEqual({ source: 'app', editable: true, problems: [] });
    expect(first.problems).toEqual([]);
    expect(boards.seeds().map(seed => seed.key)).toEqual(['work', 'release']);
    expect(boards.seedFor('review')).toBeUndefined();
    expect(first.details.has('review')).toBe(false);

    // The row is the board: an unedited copy changed in the database is what the project runs.
    await writeOutsideApi(a.storage, scope, 'factory_boards', { board_key: 'work' }, { name: 'Our work' });
    now = RECHECK_MS;
    const described = await boards.describe(scope);
    const work = described.registry.get('work')!;
    expect(work.name).toBe('Our work');
    expect(work.rules.planning?.issue?.onEnter).toBeTypeOf('function');
    expect(work.rules.triage?.issue?.onEnter).toBeTypeOf('function');
    expect(work.tools.submit_plan?.onResult).toBe(workBoard.tools.submit_plan!.onResult);
    expect(described.details.get('work')).toMatchObject({ problems: [] });
  });

  it('serves an edited Work board with its code behaviour: at once where it was written, after the recheck window elsewhere', async () => {
    const { a, b, scope } = await setup();
    let now = 0;
    const replicaA = cache(a.boards, undefined, { now: () => now });
    const replicaB = cache(b.boards, undefined, { now: () => now });
    await a.boards.seedBoards(scope, replicaA.seeds());
    expect((await replicaB.load(scope)).get('work')!.phases.planning!.autoStartWhen).toBeUndefined();

    const row = (await a.boards.get(scope, 'work'))!;
    await a.boards.replace(
      scope,
      'work',
      {
        name: row.name,
        phases: row.phases.map(phase =>
          phase.key === 'planning' ? { ...phase, autoStart: true, autoStartWhen: EFFORT_LOW } : phase,
        ),
      },
      { expectedRevision: row.revision, actor: 'user-1' },
    );
    replicaA.invalidate(scope);

    const described = await replicaA.describe(scope);
    const work = described.registry.get('work')!;
    expect(work).not.toBe(workBoard);
    expect(codeBoardOf(work)).toBe(workBoard);
    expect(work.phases.planning!.autoStartWhen).toEqual(EFFORT_LOW);
    expect(work.rules.planning?.issue?.onEnter).toBeTypeOf('function');
    expect(work.rules.triage?.issue?.onEnter).toBeTypeOf('function');
    expect(work.tools.submit_plan?.onResult).toBe(workBoard.tools.submit_plan!.onResult);
    expect(described.details.get('work')).toEqual({ source: 'builtin', editable: true, problems: [] });

    now = RECHECK_MS - 1;
    expect((await replicaB.load(scope)).get('work')!.phases.planning!.autoStartWhen).toBeUndefined();
    now = RECHECK_MS;
    expect((await replicaB.load(scope)).get('work')!.phases.planning!.autoStartWhen).toEqual(EFFORT_LOW);
    expect(replicaB.forProject(scope).get('work')!.phases.planning!.autoStartWhen).toEqual(EFFORT_LOW);
  });

  it("never rewrites a project's boards when a release changes their code defaults", async () => {
    const { a, scope } = await setup();
    const boards = cache(a.boards);
    // Boards an older release stored, under different names than this release's defaults.
    await a.boards.seedBoards(
      scope,
      boards.seeds().map(seed => ({ ...seed, name: 'Older default' })),
    );
    const version = await a.boards.readVersion(scope);

    const described = await boards.describe(scope);

    expect(described.registry.get('work')!.name).toBe('Older default');
    expect(codeBoardOf(described.registry.get('work')!)).toBe(workBoard);
    expect(described.registry.get('work')!.rules.triage?.issue?.onEnter).toBeTypeOf('function');
    expect(described.registry.get('release')!.name).toBe('Older default');
    expect(described.registry.get('release')!.rules.shipping?.manual?.onEnter).toBe(shipped);
    expect(described.details.get('release')).toEqual({ source: 'app', editable: true, problems: [] });
    expect((await a.boards.list(scope)).map(row => [row.key, row.revision, row.name])).toEqual([
      ['work', 1, 'Older default'],
      ['release', 1, 'Older default'],
    ]);
    expect(await a.boards.readVersion(scope)).toBe(version);
    expect(described.problems).toEqual([]);
  });

  it('serves an edited copy that no longer fits a newer code default, with the code behaviour that still fits', async () => {
    const { a, scope } = await setup();
    const before = cache(a.boards);
    await a.boards.seedBoards(scope, before.seeds());
    const row = (await a.boards.get(scope, 'release'))!;
    await a.boards.replace(
      scope,
      'release',
      { name: 'Our releases', phases: row.phases },
      {
        expectedRevision: row.revision,
        actor: 'user-1',
      },
    );

    const newer = appBoardWithTesting('release');
    const warnings: string[] = [];
    const described = await cache(a.boards, createBoardRegistry({ boards: [newer] }), {
      warn: message => warnings.push(message),
    }).describe(scope);

    const release = described.registry.get('release')!;
    expect(release.name).toBe('Our releases');
    expect(codeBoardOf(release)).toBe(newer);
    expect(Object.keys(release.phases)).toEqual(['queued', 'shipping', 'shipped']);
    expect(release.rules.shipping?.manual?.onEnter).toBe(shipped);
    const problem = 'Phase "testing" isn\'t on stored board "release", so its code behaviour doesn\'t run.';
    expect(described.details.get('release')).toEqual({ source: 'app', editable: true, problems: [problem] });
    expect(described.problems).toEqual([problem]);
    expect(warnings).toEqual([expect.stringContaining(problem)]);
  });

  it('serves an edited board whose code default changed, with its code behaviour', async () => {
    const { a, scope } = await setup();
    await a.boards.seedBoards(scope, cache(a.boards).seeds());
    const row = (await a.boards.get(scope, 'release'))!;
    await a.boards.replace(
      scope,
      'release',
      { name: 'Our releases', phases: row.phases },
      {
        expectedRevision: row.revision,
        actor: 'user-1',
      },
    );

    const described = await cache(
      a.boards,
      createBoardRegistry({ boards: [appBoard('release', { shipping: 'Publishing' })] }),
    ).describe(scope);

    const release = described.registry.get('release')!;
    expect(release.name).toBe('Our releases');
    expect(release.phases.shipping!.name).toBe('Shipping');
    expect(release.rules.shipping?.manual?.onEnter).toBe(shipped);
    expect(described.details.get('release')).toMatchObject({ problems: [] });
  });

  it("serves the stored board of an app board the app no longer defines as one of the project's own", async () => {
    const { a, scope } = await setup();
    await a.boards.seedBoards(scope, cache(a.boards).seeds());

    const described = await cache(a.boards, createBoardRegistry({ boards: [] })).describe(scope);

    expect([...described.registry.keys()]).toEqual(['work', 'release']);
    const release = described.registry.get('release')!;
    expect(release.phases.shipping!.name).toBe('Shipping');
    expect(codeBoardOf(release)).toBe(release);
    expect(release.rules.shipping?.manual?.onEnter).toBeUndefined();
    expect(described.details.get('release')).toEqual({ source: 'stored', editable: true, problems: [] });
    expect(described.problems).toEqual([]);
  });

  it("keeps serving an app board's stored copy after its code changes on restart, with no database write", async () => {
    const { a, scope } = await setup();
    await a.boards.create(scope, bugsBoard(), 'user-1');
    await cache(a.boards).load(scope);
    const version = await a.boards.readVersion(scope);
    const revisions = (await a.boards.list(scope)).map(row => [row.key, row.revision]);

    const restarted = cache(
      a.boards,
      createBoardRegistry({ boards: [appBoard('release', { shipping: 'Publishing' })] }),
    );
    const described = await restarted.describe(scope);

    expect(described.registry.get('release')!.phases.shipping!.name).toBe('Shipping');
    expect(described.registry.get('release')!.rules.shipping?.manual?.onEnter).toBe(shipped);
    expect(described.details.get('release')).toMatchObject({ problems: [] });
    expect((await a.boards.list(scope)).map(row => [row.key, row.revision])).toEqual(revisions);
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
    expect([...described.registry.keys()]).toEqual(['work', 'release', 'bugs']);
    expect(described.registry.get('bugs')!.initialPhase).toBe('reported');
    expect(described.details.get('bugs')).toEqual({ source: 'stored', editable: true, problems: [] });
    now = RECHECK_MS - 1;
    expect((await replicaB.load(scope)).has('bugs')).toBe(false);
    expect(replicaB.forProject(scope).has('bugs')).toBe(false);
    now = RECHECK_MS;
    expect((await replicaB.load(scope)).has('bugs')).toBe(true);
    expect(replicaB.forProject(scope).get('bugs')!.name).toBe('Bugs');
  });

  it("serves a stored board created under a code key before it could be edited as the project's own edit, and leaves it alone", async () => {
    const { a, scope } = await setup();
    const release = appBoard('release');
    await a.boards.create(scope, { ...boardDefinitionOf(release), name: 'Stored release' }, 'user-1');
    await a.boards.create(scope, { ...bugsBoard(), key: 'review', name: 'Stored review' }, 'user-1');
    await a.boards.create(scope, bugsBoard(), 'user-1');

    const described = await cache(a.boards, createBoardRegistry({ boards: [release] })).describe(scope);

    const served = described.registry.get('release')!;
    expect(served.name).toBe('Stored release');
    expect(codeBoardOf(served)).toBe(release);
    expect(served.rules.shipping?.manual?.onEnter).toBe(shipped);
    expect(described.registry.has('review')).toBe(false);
    expect(described.details.get('release')).toEqual({ source: 'app', editable: true, problems: [] });
    expect(described.registry.has('bugs')).toBe(true);
    expect(described.problems).toEqual([
      'Stored board "review" isn\'t served: the key is reserved for the retired Review board, whose cards now live on Work.',
    ]);
    expect((await a.boards.get(scope, 'release'))!).toMatchObject({ name: 'Stored release', revision: 1 });
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

    expect([...described.registry.keys()]).toEqual(['work', 'release', 'chores']);
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
    expect([...(await boards.load(second)).keys()]).toEqual(['work', 'release']);
  });

  it('serves no built-in boards when the app turns them off', async () => {
    const { a, scope } = await setup();
    const registry = await cache(
      a.boards,
      createBoardRegistry({ boards: [appBoard('release')], includeDefaultBoards: false }),
    ).load(scope);

    expect([...registry.keys()]).toEqual(['release']);
    expect((await a.boards.list(scope)).map(row => row.key)).toEqual(['release']);
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

  it('warms every project at startup, storing the boards of a project that had none and leaving stored ones alone', async () => {
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

    await a.boards.seedBoards(first, boards.seeds());
    const work = (await a.boards.get(first, 'work'))!;
    await a.boards.replace(
      first,
      'work',
      { name: 'Our work', phases: work.phases },
      {
        expectedRevision: work.revision,
        actor: 'user-1',
      },
    );
    const version = await a.boards.readVersion(first);
    const revisions = (await a.boards.list(first)).map(row => [row.key, row.revision]);

    await boards.preload();

    expect(boards.forProject(first).get('work')!.name).toBe('Our work');
    expect(await a.boards.readVersion(first)).toBe(version);
    expect((await a.boards.list(first)).map(row => [row.key, row.revision])).toEqual(revisions);
    expect(boards.forProject(first).has('bugs')).toBe(true);
    expect([...boards.forProject(second).keys()]).toEqual(['work', 'release']);
    expect((await a.boards.list(second)).map(row => [row.key, row.revision])).toEqual([
      ['work', 1],
      ['release', 1],
    ]);
    expect(await a.boards.readVersion(second)).not.toBeNull();
    expect(codeBoardOf(boards.forProject(second).get('work')!)).toBe(workBoard);
  });

  it("stores a project's boards once per process, not on later loads", async () => {
    const { a, scope } = await setup();
    let now = 0;
    const seeding = vi.spyOn(a.boards, 'seedBoards');
    const boards = cache(a.boards, undefined, { now: () => now });

    await boards.load(scope);
    now = RECHECK_MS;
    await boards.load(scope);
    boards.invalidate(scope);
    await boards.load(scope);

    expect(seeding).toHaveBeenCalledTimes(1);
    expect((await a.boards.list(scope)).map(row => row.key)).toEqual(['work', 'release']);
  });

  it('keeps a board the project deleted deleted, on later loads and after a restart', async () => {
    const { a, scope } = await setup();
    await cache(a.boards).load(scope);
    const release = (await a.boards.get(scope, 'release'))!;
    await a.boards.delete(scope, 'release', { expectedRevision: release.revision });

    const restarted = await cache(a.boards).describe(scope);

    expect([...restarted.registry.keys()]).toEqual(['work']);
    expect(restarted.details.has('release')).toBe(false);
    expect(restarted.problems).toEqual([]);
    expect((await a.boards.list(scope)).map(row => row.key)).toEqual(['work']);
  });

  it("serves none of Factory's boards while a project's boards could not be stored, and stores them on the next load", async () => {
    const { a, scope } = await setup();
    let now = 0;
    const seeding = vi.spyOn(a.boards, 'seedBoards').mockRejectedValueOnce(new Error('disk full'));
    const warnings: string[] = [];
    const boards = cache(a.boards, undefined, { now: () => now, warn: message => warnings.push(message) });

    const failed = await boards.describe(scope);

    expect(await a.boards.list(scope)).toEqual([]);
    expect([...failed.registry.keys()]).toEqual([]);
    const missing = (key: string) =>
      `Board "${key}" isn't stored in this project yet; Factory stores it on the next load.`;
    expect(failed.problems).toEqual([missing('work'), missing('release')]);
    expect(failed.details.has('work')).toBe(false);
    expect(warnings).toEqual([
      expect.stringContaining('could not be stored; Factory stores them on the next load: disk full'),
    ]);

    now = RECHECK_MS;
    const stored = await boards.describe(scope);

    expect(seeding).toHaveBeenCalledTimes(2);
    expect((await a.boards.list(scope)).map(row => row.key)).toEqual(['work', 'release']);
    expect(stored.registry.get('work')).not.toBe(workBoard);
    expect(codeBoardOf(stored.registry.get('work')!)).toBe(workBoard);
    expect(stored.problems).toEqual([]);
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
