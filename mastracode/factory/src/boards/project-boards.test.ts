import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { StoredBoardsStorage } from '../storage/domains/boards/base.js';
import type { StoredBoardScope } from '../storage/domains/boards/base.js';
import { compileBoardDefinition } from './define-board.js';
import type { BoardPhaseDefinition } from './define-board.js';
import { DRIFT_PROBLEM, ProjectBoardCache } from './project-boards.js';
import { createBoardRegistry } from './registry.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';
import { reviewBoard } from './review.js';
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

function phaseShape(board: InstalledBoard) {
  return Object.fromEntries(
    Object.entries(board.phases).map(([key, phase]) => [
      key,
      { name: phase.name, kind: phase.kind, nextPhases: [...phase.nextPhases].sort() },
    ]),
  );
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
    seedRegistry: BoardRegistry = createBoardRegistry({ boards: [appBoard('release')] }),
    options: { now?: () => number; warn?: (message: string) => void } = {},
  ) {
    return new ProjectBoardCache({ seedRegistry, storage, recheckMs: RECHECK_MS, ...options });
  }

  it('writes the code boards into a project on its first load, and serves them as the code defined them', async () => {
    const { a, scope } = await setup();
    const release = appBoard('release');
    const boards = cache(a.boards, createBoardRegistry({ boards: [release] }));

    const registry = await boards.load(scope);

    expect((await a.boards.list(scope)).map(row => [row.key, row.seedSource])).toEqual([
      ['work', 'builtin'],
      ['review', 'builtin'],
      ['release', 'app'],
    ]);
    for (const code of [workBoard, reviewBoard, release] as InstalledBoard[]) {
      const stored = registry.get(code.id)!;
      expect(stored.initialPhase).toBe(code.initialPhase);
      expect(phaseShape(stored)).toEqual(phaseShape(code));
      expect(stored.transitionPolicy).toBe(code.transitionPolicy);
      expect(stored.sourceClosed).toEqual(code.sourceClosed);
    }
    expect(registry.get('release')!.rules.shipping?.manual?.onEnter).toBe(shipped);
    const described = await boards.describe(scope);
    expect(described.details.get('work')).toEqual({ source: 'builtin', customized: false, problems: [] });
    expect(described.details.get('release')).toEqual({ source: 'app', customized: false, problems: [] });
  });

  it('shows an edit made on another replica only after the recheck window, and at once on the replica that invalidated', async () => {
    const { a, b, scope } = await setup();
    let now = 0;
    const replicaA = cache(a.boards, undefined, { now: () => now });
    const replicaB = cache(b.boards, undefined, { now: () => now });
    await replicaA.load(scope);
    await replicaB.load(scope);

    const work = (await a.boards.get(scope, 'work'))!;
    await a.boards.replace(
      scope,
      'work',
      { ...work, phases: work.phases.map(phase => (phase.key === 'execute' ? { ...phase, name: 'Shipping' } : phase)) },
      { expectedRevision: work.revision, actor: 'user-1', customized: true },
    );
    replicaA.invalidate(scope);

    expect((await replicaA.load(scope)).get('work')!.phases.execute!.name).toBe('Shipping');
    now = RECHECK_MS - 1;
    expect((await replicaB.load(scope)).get('work')!.phases.execute!.name).toBe('Building');
    expect(replicaB.forProject(scope).get('work')!.phases.execute!.name).toBe('Building');
    now = RECHECK_MS;
    expect((await replicaB.load(scope)).get('work')!.phases.execute!.name).toBe('Shipping');
    expect(replicaB.forProject(scope).get('work')!.phases.execute!.name).toBe('Shipping');
  });

  it('keeps an edited board when its code changes and reports the drift, but upgrades an unedited one', async () => {
    const { a, scope } = await setup();
    await cache(a.boards, createBoardRegistry({ boards: [appBoard('release'), appBoard('deploy')] })).load(scope);
    const release = (await a.boards.get(scope, 'release'))!;
    await a.boards.replace(
      scope,
      'release',
      { ...release, name: 'Our releases' },
      { expectedRevision: release.revision, actor: 'user-1', customized: true },
    );

    const warnings: string[] = [];
    const redeployed = cache(
      a.boards,
      createBoardRegistry({
        boards: [appBoard('release', { shipping: 'Publishing' }), appBoard('deploy', { shipping: 'Rolling out' })],
      }),
      { warn: message => warnings.push(message) },
    );
    const described = await redeployed.describe(scope);

    expect(described.registry.get('release')!.name).toBe('Our releases');
    expect(described.registry.get('release')!.phases.shipping!.name).toBe('Shipping');
    expect(described.details.get('release')).toEqual({ source: 'app', customized: true, problems: [DRIFT_PROBLEM] });
    expect(described.registry.get('deploy')!.phases.shipping!.name).toBe('Rolling out');
    expect(described.details.get('deploy')).toEqual({ source: 'app', customized: false, problems: [] });
    expect(warnings).toEqual([expect.stringContaining("Board 'release' in project project-1 was edited")]);
  });

  it('skips a stored board that no longer compiles and still loads the rest of the project', async () => {
    const { a, scope } = await setup();
    await cache(a.boards).load(scope);
    // A row written outside the boards API: a terminal phase cannot be where cards start.
    await a.storage.ops.updateMany(
      'factory_board_phases',
      { org_id: scope.orgId, factory_project_id: scope.factoryProjectId, board_key: 'release', phase_key: 'queued' },
      { kind: 'terminal' },
    );

    const warnings: string[] = [];
    const described = await cache(a.boards, undefined, { warn: message => warnings.push(message) }).describe(scope);

    expect([...described.registry.keys()]).toEqual(['work', 'review']);
    expect(described.problems).toEqual([expect.stringMatching(/^Board 'release' could not be loaded: .*resting/)]);
    expect(warnings).toEqual([expect.stringContaining("Board 'release' could not be loaded")]);
  });

  it("keeps one project's edits out of another project's boards", async () => {
    const { a, orgId } = await setup();
    const first = { orgId, factoryProjectId: 'project-1' };
    const second = { orgId, factoryProjectId: 'project-2' };
    const boards = cache(a.boards);
    await boards.load(first);
    await boards.load(second);
    const work = (await a.boards.get(first, 'work'))!;
    await a.boards.replace(
      first,
      'work',
      { ...work, name: 'Project one work' },
      { expectedRevision: work.revision, actor: 'user-1', customized: true },
    );
    boards.invalidate(first);

    expect((await boards.load(first)).get('work')!.name).toBe('Project one work');
    expect((await boards.load(second)).get('work')!.name).toBe('Work');
  });

  it('seeds no built-in boards when the app turns them off', async () => {
    const { a, scope } = await setup();
    const registry = await cache(
      a.boards,
      createBoardRegistry({ boards: [appBoard('release')], includeDefaultBoards: false }),
    ).load(scope);

    expect([...registry.keys()]).toEqual(['release']);
    expect((await a.boards.list(scope, { includeDeleted: true })).map(row => row.key)).toEqual(['release']);
  });

  it('serves the code boards to a sync read of a project that has not been loaded yet', async () => {
    const { a, scope } = await setup();
    const seedRegistry = createBoardRegistry({ boards: [appBoard('release')] });
    const boards = cache(a.boards, seedRegistry);

    expect(boards.forProject(scope)).toBe(seedRegistry);
    const loaded = await boards.load(scope);
    expect(boards.forProject(scope)).toBe(loaded);
    expect(loaded).not.toBe(seedRegistry);
  });

  it('loads a project once when several callers ask for it at the same time', async () => {
    const { a, scope } = await setup();
    const boards = cache(a.boards);

    const [first, second, third] = await Promise.all([boards.load(scope), boards.load(scope), boards.load(scope)]);

    expect(second).toBe(first);
    expect(third).toBe(first);
  });
});
