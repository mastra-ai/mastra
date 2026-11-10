import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { StoredBoardsStorage } from '../storage/domains/boards/base.js';
import type { StoredBoardInput, StoredBoardScope, StoredPhaseInput } from '../storage/domains/boards/base.js';
import { defineBoard } from './define-board.js';
import { ProjectBoardCache } from './project-boards.js';
import { createBoardRegistry } from './registry.js';
import { WORK_PHASE_RUNNERS_MIGRATION, workSeedWithSelfReview } from './work-migrations.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

/** The Work board Factory stored in projects before phases had runners (#29317). */
const OLD_WORK: StoredBoardInput = {
  key: 'work',
  name: 'Work',
  phases: [
    {
      key: 'intake',
      name: 'Intake',
      kind: 'resting',
      nextPhases: ['triage', 'planning', 'pr-review', 'done', 'canceled'],
    },
    {
      key: 'triage',
      name: 'Triage',
      kind: 'working',
      nextPhases: ['intake', 'planning', 'done', 'canceled'],
      runner: { context: 'triage' },
    },
    {
      key: 'planning',
      name: 'Planning',
      kind: 'working',
      nextPhases: ['execute', 'triage', 'intake', 'done', 'canceled'],
      runner: { context: 'work' },
      exitTool: { id: 'submit_plan', autoApprove: false },
    },
    {
      key: 'execute',
      name: 'Building',
      kind: 'working',
      nextPhases: ['review', 'planning', 'done', 'canceled'],
      runner: { context: 'work' },
    },
    {
      key: 'review',
      name: 'Review',
      kind: 'working',
      nextPhases: ['execute', 'intake', 'done', 'canceled'],
      runner: { context: 'work' },
    },
    {
      key: 'pr-review',
      name: 'PR review',
      kind: 'working',
      nextPhases: ['intake', 'done', 'canceled'],
      runner: { context: 'work' },
    },
    { key: 'done', name: 'Done', kind: 'terminal', nextPhases: ['pr-review'] },
    { key: 'canceled', name: 'Canceled', kind: 'terminal', nextPhases: ['intake', 'pr-review'] },
  ],
};

/**
 * What the migration fills from: Work as it was while it had its self-review phase, which every
 * row holding the old seed still has. Today's seed dropped that phase.
 */
const SEED = workSeedWithSelfReview();

function seedPhase(key: string): StoredPhaseInput {
  return SEED.phases.find(phase => phase.key === key)!;
}

/** The fields the migration fills, as a stored phase reads them back. */
function fieldsOf(phase: Partial<StoredPhaseInput>) {
  return {
    runner: phase.runner ?? null,
    exitTool: phase.exitTool ?? null,
    tools: phase.tools?.length ? phase.tools : null,
    autoStart: phase.autoStart ?? false,
    autoStartWhen: phase.autoStartWhen ?? null,
    nextPhases: phase.nextPhases ?? null,
  };
}

function editPhase(board: StoredBoardInput, key: string, edit: Partial<StoredPhaseInput>): StoredBoardInput {
  return { ...board, phases: board.phases.map(phase => (phase.key === key ? { ...phase, ...edit } : phase)) };
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('Work phase runners migration on %s', backend => {
  async function client(url: string) {
    const storage =
      backend === 'postgres'
        ? new PgFactoryStorage({ id: `work-migrations-${randomUUID()}`, connectionString: postgresUrl! })
        : new LibSQLFactoryStorage({ id: `work-migrations-${randomUUID()}`, url });
    const boards = storage.registerDomain(new StoredBoardsStorage());
    await storage.init();
    onTestFinished(() => storage.close());
    return boards;
  }

  /** A project whose Work row Factory stored before phases had runners; `edit` is what a person changed since. */
  async function setup(edit?: (board: StoredBoardInput) => StoredBoardInput) {
    let url = ':memory:';
    if (backend === 'libsql') {
      const dir = mkdtempSync(join(tmpdir(), 'factory-work-migrations-'));
      onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
      url = `file:${join(dir, 'boards.db')}`;
    }
    const boards = await client(url);
    // The Postgres database is shared across runs, so every test gets its own org.
    const scope: StoredBoardScope = { orgId: `org-${randomUUID()}`, factoryProjectId: 'project-1' };
    await boards.seedBoards(scope, [OLD_WORK]);
    if (edit) {
      const { key: _key, ...edited } = edit(OLD_WORK);
      await boards.replace(scope, 'work', edited, { expectedRevision: 1, actor: 'user-1' });
    }
    return { boards, scope, secondClient: () => client(url) };
  }

  /** What a release with phase runners does on a project's first load: seed, then migrate. */
  async function firstLoad(boards: StoredBoardsStorage, scope: StoredBoardScope) {
    const cache = new ProjectBoardCache({ codeRegistry: createBoardRegistry(), storage: boards, warn: () => {} });
    return cache.load(scope);
  }

  async function phase(boards: StoredBoardsStorage, scope: StoredBoardScope, key: string) {
    return (await boards.get(scope, 'work'))!.phases.find(candidate => candidate.key === key)!;
  }

  it("gives a Work row still holding the old seed the new seed's runners, exit tool, tools and automatic start", async () => {
    const { boards, scope } = await setup();
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    onTestFinished(() => info.mockRestore());

    const registry = await firstLoad(boards, scope);

    const row = (await boards.get(scope, 'work'))!;
    expect(row).toMatchObject({ revision: 2, updatedBy: 'factory' });
    for (const stored of row.phases) {
      expect({ key: stored.key, ...fieldsOf(stored) }).toEqual({ key: stored.key, ...fieldsOf(seedPhase(stored.key)) });
    }
    expect(registry.get('work')!.phases.execute).toMatchObject({
      runner: { skill: 'factory-build', context: 'work', goal: { maxRuns: 20 } },
    });
    // Work's seed has no self-review phase any more; a row stored before still has one, and runs it.
    expect(registry.get('work')!.phases.execute!.nextPhases).toContain('review');
    expect(registry.get('work')!.phases.review).toMatchObject({
      kind: 'working',
      runner: { skill: 'factory-self-review', context: 'review' },
      tools: ['factory_record_review_verdict'],
    });
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]![0]).toContain('triage.runner');
  });

  it('keeps the Triage instructions and Planning name a person edited, and fills the fields they did not', async () => {
    const { boards, scope } = await setup(board =>
      editPhase(
        editPhase(board, 'triage', { runner: { context: 'triage', instructions: 'Label it first.' } }),
        'planning',
        {
          name: 'Plan it',
        },
      ),
    );

    await firstLoad(boards, scope);

    expect((await boards.get(scope, 'work'))!.revision).toBe(3);
    const triage = await phase(boards, scope, 'triage');
    // The instructions stay; the skill the phase needs to start anything is still filled.
    expect(triage.runner).toEqual({ skill: 'factory-triage', context: 'triage', instructions: 'Label it first.' });
    const planning = await phase(boards, scope, 'planning');
    expect(planning.name).toBe('Plan it');
    expect(fieldsOf(planning)).toEqual(fieldsOf(seedPhase('planning')));
    expect(planning.exitTool).toEqual({ id: 'submit_plan', autoApprove: false });
  });

  it("keeps a Review runner context a person changed, and leaves the tools and automatic start that serve the seed's skill", async () => {
    const { boards, scope } = await setup(board => editPhase(board, 'review', { runner: { context: 'qa' } }));

    await firstLoad(boards, scope);

    const review = await phase(boards, scope, 'review');
    // The context a person chose stays; the skill the phase needs to start anything is filled.
    expect(review.runner).toEqual({ skill: 'factory-self-review', context: 'qa' });
    // No verdict tool or automatic start for a runner that is not the self-review skill.
    expect(fieldsOf(review)).toMatchObject({ tools: null, autoStart: false, autoStartWhen: null });
    expect(fieldsOf(review).nextPhases).toEqual(fieldsOf(seedPhase('review')).nextPhases);
  });

  it('gives a Building runner a person only wrote instructions for the skill and goal, keeping the instructions', async () => {
    const { boards, scope } = await setup(board =>
      editPhase(board, 'execute', { runner: { context: 'work', instructions: 'Run the e2e suite too.' } }),
    );

    await firstLoad(boards, scope);

    const building = await phase(boards, scope, 'execute');
    expect(building.runner).toEqual({ ...seedPhase('execute').runner, instructions: 'Run the e2e suite too.' });
    expect(building.runner?.goal?.maxRuns).toBe(20);
  });

  it('starts the Building skill without its goal when a person narrowed its moves, so no goal is judged that cannot be met', async () => {
    const { boards, scope } = await setup(board =>
      editPhase(board, 'execute', { nextPhases: ['review', 'done', 'canceled'] }),
    );

    await firstLoad(boards, scope);

    const building = await phase(boards, scope, 'execute');
    expect(building.runner).toEqual({ skill: 'factory-build', context: 'work' });
    expect(building.nextPhases).toEqual(['review', 'done', 'canceled']);
    expect((await phase(boards, scope, 'planning')).runner).toEqual(seedPhase('planning').runner);
  });

  it("leaves an app's own board under Work's key alone, even where it holds Work's old values", async () => {
    const { boards, scope } = await setup();
    const appWork = defineBoard({
      id: 'work',
      name: 'Work',
      initialPhase: 'intake',
      phases: {
        intake: { name: 'Intake', kind: 'resting', nextPhases: ['done'] },
        done: { name: 'Done', kind: 'terminal', nextPhases: ['intake'] },
      },
    });
    const cache = new ProjectBoardCache({
      codeRegistry: createBoardRegistry({ includeDefaultBoards: false, boards: [appWork] }),
      storage: boards,
      warn: () => {},
    });

    await cache.load(scope);

    expect((await boards.get(scope, 'work'))!.revision).toBe(1);
    expect((await phase(boards, scope, 'triage')).runner).toEqual({ context: 'triage' });
  });

  it('changes nothing the second time, neither the row nor its revision nor the version', async () => {
    const { boards, scope } = await setup();
    await boards.applyBoardMigrations(scope, [WORK_PHASE_RUNNERS_MIGRATION]);
    const row = await boards.get(scope, 'work');
    const version = await boards.readVersion(scope);

    expect(await boards.applyBoardMigrations(scope, [WORK_PHASE_RUNNERS_MIGRATION])).toEqual([]);
    await firstLoad(boards, scope);

    expect(await boards.get(scope, 'work')).toEqual(row);
    expect(row!.revision).toBe(2);
    expect(await boards.readVersion(scope)).toBe(version);
  });

  it('never touches a row a person set back to the old values after the migration ran', async () => {
    const { boards, scope } = await setup();
    await boards.applyBoardMigrations(scope, [WORK_PHASE_RUNNERS_MIGRATION]);
    const { key: _key, ...reverted } = OLD_WORK;
    await boards.replace(scope, 'work', reverted, { expectedRevision: 2, actor: 'user-1' });

    expect(await boards.applyBoardMigrations(scope, [WORK_PHASE_RUNNERS_MIGRATION])).toEqual([]);
    await firstLoad(boards, scope);

    const row = (await boards.get(scope, 'work'))!;
    expect(row).toMatchObject({ revision: 3, updatedBy: 'user-1' });
    expect((await phase(boards, scope, 'triage')).runner).toEqual({ context: 'triage' });
  });

  it('is a no-op for a project without a Work row, and records itself so a later Work row is left alone', async () => {
    const { boards, scope } = await setup();
    await boards.delete(scope, 'work', { expectedRevision: 1 });

    expect(await boards.applyBoardMigrations(scope, [WORK_PHASE_RUNNERS_MIGRATION])).toEqual([]);
    expect(await boards.list(scope)).toEqual([]);

    await boards.insertIfMissing(scope, OLD_WORK, 'user-1');
    expect(await boards.applyBoardMigrations(scope, [WORK_PHASE_RUNNERS_MIGRATION])).toEqual([]);
    expect((await phase(boards, scope, 'triage')).runner).toEqual({ context: 'triage' });
  });

  it('applies once when replicas load the project for the first time at once', async () => {
    const { boards, scope, secondClient } = await setup();
    const other = await secondClient();

    const results = await Promise.all([
      boards.applyBoardMigrations(scope, [WORK_PHASE_RUNNERS_MIGRATION]),
      other.applyBoardMigrations(scope, [WORK_PHASE_RUNNERS_MIGRATION]),
      boards.applyBoardMigrations(scope, [WORK_PHASE_RUNNERS_MIGRATION]),
      other.applyBoardMigrations(scope, [WORK_PHASE_RUNNERS_MIGRATION]),
    ]);

    expect(results.filter(changed => changed.length > 0)).toHaveLength(1);
    expect((await boards.get(scope, 'work'))!.revision).toBe(2);
  });

  it("keeps Planning's moves a person narrowed, and still starts the planning skill", async () => {
    const { boards, scope } = await setup(board =>
      editPhase(board, 'planning', { nextPhases: ['triage', 'intake', 'done', 'canceled'] }),
    );

    await boards.applyBoardMigrations(scope, [WORK_PHASE_RUNNERS_MIGRATION]);

    const planning = await phase(boards, scope, 'planning');
    expect(planning.nextPhases).toEqual(['triage', 'intake', 'done', 'canceled']);
    expect(planning.exitTool).toEqual({ id: 'submit_plan', autoApprove: false });
    expect(planning.runner).toEqual(seedPhase('planning').runner);
  });

  it('records itself on a fresh project seeded with the new Work board without rewriting it', async () => {
    const { boards } = await setup();
    const scope: StoredBoardScope = { orgId: `org-${randomUUID()}`, factoryProjectId: 'fresh' };

    await firstLoad(boards, scope);

    const fresh = (await boards.get(scope, 'work'))!;
    expect(fresh.revision).toBe(1);
    // A new project's Work has no self-review phase: Building hands its change request to Review.
    expect(fresh.phases.map(stored => stored.key)).toEqual([
      'intake',
      'triage',
      'planning',
      'execute',
      'pr-review',
      'done',
      'canceled',
    ]);
    expect(fresh.phases.find(stored => stored.key === 'execute')!.nextPhases).toEqual([
      'pr-review',
      'planning',
      'done',
      'canceled',
    ]);
    expect(fresh.phases.find(stored => stored.key === 'pr-review')!.name).toBe('Review');
    // Recorded: old values written now stay, as on any project the migration already ran on.
    const { key: _key, ...old } = OLD_WORK;
    await boards.replace(scope, 'work', old, { expectedRevision: 1, actor: 'user-1' });
    expect(await boards.applyBoardMigrations(scope, [WORK_PHASE_RUNNERS_MIGRATION])).toEqual([]);
    expect((await phase(boards, scope, 'triage')).runner).toEqual({ context: 'triage' });
  });
});
