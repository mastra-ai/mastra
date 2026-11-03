import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import type { EmitAuditInput } from '../storage/domains/audit/domain.js';
import { StoredBoardsStorage } from '../storage/domains/boards/base.js';
import type { StoredPhaseInput } from '../storage/domains/boards/base.js';
import { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { BoardWriteError, BoardWrites } from './board-writes.js';
import type { BoardWriter } from './board-writes.js';
import { ProjectBoardCache } from './project-boards.js';
import { createBoardRegistry } from './registry.js';
import { boardDefinitionOf } from './stored-board.js';
import { workBoard } from './work.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

const bugs = {
  key: 'bugs',
  name: 'Bugs',
  phases: [
    { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixing'] },
    { key: 'fixing', name: 'Fixing', kind: 'working', runner: { context: 'work' }, nextPhases: ['fixed'] },
    { key: 'fixed', name: 'Fixed', kind: 'terminal' },
  ],
} satisfies { key: string; name: string; phases: StoredPhaseInput[] };

/** The error a write is refused with. */
async function refusal(write: () => Promise<unknown>): Promise<BoardWriteError> {
  try {
    await write();
  } catch (error) {
    if (error instanceof BoardWriteError) return error;
    throw error;
  }
  throw new Error('expected the write to be refused');
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('board writes on %s', backend => {
  async function setup() {
    let url = ':memory:';
    if (backend === 'libsql') {
      const dir = mkdtempSync(join(tmpdir(), 'factory-board-writes-'));
      onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
      url = `file:${join(dir, 'factory.db')}`;
    }
    const factoryStorage =
      backend === 'postgres'
        ? new PgFactoryStorage({ id: `board-writes-${randomUUID()}`, connectionString: postgresUrl! })
        : new LibSQLFactoryStorage({ id: `board-writes-${randomUUID()}`, url });
    const projects = factoryStorage.registerDomain(new FactoryProjectsStorage());
    const workItems = factoryStorage.registerDomain(new WorkItemsStorage());
    const storage = factoryStorage.registerDomain(new StoredBoardsStorage());
    await factoryStorage.init();
    onTestFinished(() => factoryStorage.close());

    const orgId = `org-${randomUUID()}`;
    const project = await projects.create({ orgId, userId: 'admin', input: { name: 'Acme' } });
    const scope = { orgId, factoryProjectId: project.id };
    const boards = new ProjectBoardCache({ codeRegistry: createBoardRegistry(), storage, projects, warn: () => {} });
    const audits: EmitAuditInput[] = [];
    const writer: BoardWriter = { id: 'admin', audit: async input => void audits.push(input) };
    const writes = new BoardWrites({ storage, boards, workItems });
    const served = async (key: string) => (await boards.describe(scope)).registry.get(key);
    return { storage, workItems, scope, boards, writes, writer, audits, served };
  }

  it('creates a board, serves it at once, and records who did it', async () => {
    const { writes, writer, scope, audits, served } = await setup();
    const row = await writes.create(scope, bugs, writer);
    expect(row).toMatchObject({ key: 'bugs', revision: 1, createdBy: 'admin' });
    expect((await served('bugs'))?.name).toBe('Bugs');
    expect(audits).toEqual([
      {
        action: 'factory.board.created',
        factoryProjectId: scope.factoryProjectId,
        targets: [{ type: 'board', id: 'bugs', name: 'Bugs' }],
      },
    ]);
  });

  it('replaces a board, and writes nothing when it is saved unchanged', async () => {
    const { writes, writer, scope, storage, audits, served } = await setup();
    await writes.create(scope, bugs, writer);
    const { key: _key, ...definition } = bugs;

    const renamed = await writes.replace(
      scope,
      'bugs',
      { ...definition, name: 'Bug fixes' },
      { expectedRevision: 1, writer },
    );
    expect(renamed).toMatchObject({ written: true, row: { revision: 2, name: 'Bug fixes' } });
    expect((await served('bugs'))?.name).toBe('Bug fixes');

    const version = await storage.readVersion(scope);
    const unchanged = await writes.replace(
      scope,
      'bugs',
      { ...definition, name: 'Bug fixes' },
      { expectedRevision: 2, writer },
    );
    expect(unchanged).toMatchObject({ written: false, row: { revision: 2 } });
    expect(await storage.readVersion(scope)).toBe(version);
    expect(audits.map(audit => audit.action)).toEqual(['factory.board.created', 'factory.board.updated']);

    const stale = await refusal(() => writes.replace(scope, 'bugs', definition, { expectedRevision: 1, writer }));
    expect(stale).toMatchObject({ status: 409, code: 'revision_mismatch' });
  });

  it("resets an edited Work board to its default, and refuses resetting a project's own board", async () => {
    const { writes, writer, scope, boards, storage, audits } = await setup();
    await boards.describe(scope);
    const { key: _key, ...work } = boardDefinitionOf(workBoard);
    await writes.replace(scope, 'work', { ...work, name: 'Our work' }, { expectedRevision: 1, writer });
    expect(await storage.get(scope, 'work')).toMatchObject({ name: 'Our work', revision: 2 });

    // Reset rewrites the row at the next revision, so a save made before it is stale afterwards.
    const reset = await writes.reset(scope, 'work', { expectedRevision: 2, writer });
    expect(reset).toMatchObject({ name: 'Work', revision: 3 });
    expect(await storage.get(scope, 'work')).toMatchObject({ name: 'Work', revision: 3 });
    const stale = await refusal(() =>
      writes.replace(scope, 'work', { ...work, name: 'Stale' }, { expectedRevision: 2, writer }),
    );
    expect(stale).toMatchObject({ status: 409, code: 'revision_mismatch' });
    expect(audits.at(-1)).toMatchObject({ action: 'factory.board.reset' });

    await writes.create(scope, bugs, writer);
    const own = await refusal(() => writes.reset(scope, 'bugs', { expectedRevision: 1, writer }));
    expect(own).toMatchObject({ status: 409, code: 'not_code_board' });
  });

  it('refuses each write the boards API refuses, with its error code, and stores nothing', async () => {
    const { writes, writer, scope, boards, storage, workItems, audits } = await setup();
    await boards.describe(scope);
    await writes.create(scope, bugs, writer);
    await workItems.upsert({ ...scope, userId: 'admin', input: { title: 'Crash', board: 'bugs', stages: ['fixing'] } });
    const { key: _key, ...definition } = bugs;
    const { key: _work, ...work } = boardDefinitionOf(workBoard);
    const version = await storage.readVersion(scope);

    const refusals = [
      await refusal(() => writes.create(scope, { ...bugs, phases: [] }, writer)),
      await refusal(() =>
        writes.create(
          scope,
          {
            ...bugs,
            key: 'hotfix',
            phases: bugs.phases.map(phase =>
              phase.key === 'fixing' ? { ...phase, runner: { context: 'work', skill: 'no-such-skill' } } : phase,
            ),
          },
          writer,
        ),
      ),
      await refusal(() =>
        writes.replace(
          scope,
          'work',
          {
            ...work,
            phases: work.phases.map(phase =>
              phase.key === 'triage' ? { ...phase, runner: { ...phase.runner, context: 'work' } } : phase,
            ),
          },
          { expectedRevision: 1, writer },
        ),
      ),
      await refusal(() => writes.create(scope, { ...bugs, key: 'work' }, writer)),
      await refusal(() => writes.replace(scope, 'review', definition, { expectedRevision: 1, writer })),
      await refusal(() => writes.reset(scope, 'bugs', { expectedRevision: 1, writer })),
      await refusal(() =>
        writes.replace(
          scope,
          'bugs',
          {
            ...definition,
            phases: definition.phases.map(phase =>
              phase.key === 'fixing'
                ? { key: 'fixing', name: 'Fixing', kind: 'resting', nextPhases: ['fixed'] }
                : phase,
            ),
          },
          { expectedRevision: 1, writer },
        ),
      ),
      await refusal(() => writes.remove(scope, 'bugs', { expectedRevision: 1, writer })),
      await refusal(() => writes.remove(scope, 'work', { expectedRevision: 1, writer })),
      await refusal(() => writes.replace(scope, 'missing', definition, { expectedRevision: 1, writer })),
      await refusal(() => writes.create(scope, bugs, writer)),
    ];
    expect(refusals.map(error => [error.status, error.code])).toEqual([
      [422, 'invalid_board'],
      [422, 'unknown_skill'],
      [422, 'code_behaviour'],
      [409, 'code_board'],
      [409, 'reserved_board'],
      [409, 'not_code_board'],
      [409, 'phase_in_use'],
      [409, 'board_in_use'],
      [409, 'code_board'],
      [404, 'board_not_found'],
      [409, 'board_exists'],
    ]);
    expect(refusals[2]!.body.conflicts).toEqual([
      'Phase "triage" runs its code handlers in the "triage" context; keep runner.context.',
    ]);
    expect(await storage.readVersion(scope)).toBe(version);
    expect(audits.map(audit => audit.action)).toEqual(['factory.board.created']);
  });

  it("refuses every write under the retired Review board's key, and stores nothing", async () => {
    const { writes, writer, scope, storage, audits, served } = await setup();
    await served('work');
    const version = await storage.readVersion(scope);
    const { key: _key, ...definition } = bugs;
    const review = { ...bugs, key: 'review' };

    const refusals = [
      await refusal(() => writes.create(scope, review, writer)),
      await refusal(() => writes.upsert(scope, review, writer)),
      await refusal(() => writes.replace(scope, 'review', definition, { expectedRevision: 1, writer })),
      await refusal(() => writes.reset(scope, 'review', { expectedRevision: 1, writer })),
      await refusal(() => writes.remove(scope, 'review', { expectedRevision: 1, writer })),
      await refusal(async () => writes.validate(review)),
    ];

    expect(refusals.map(error => error.body)).toEqual(
      Array(6).fill({
        error: 'reserved_board',
        message: 'Board "review" is reserved: the retired Review board\'s cards now live on Work.',
      }),
    );
    expect(await storage.get(scope, 'review')).toBeNull();
    expect(await storage.readVersion(scope)).toBe(version);
    expect(audits).toEqual([]);
  });

  it('deletes a board no card sits on', async () => {
    const { writes, writer, scope, audits, served } = await setup();
    await writes.create(scope, bugs, writer);
    await writes.remove(scope, 'bugs', { expectedRevision: 1, writer });
    expect(await served('bugs')).toBeUndefined();
    expect(audits.at(-1)).toMatchObject({ action: 'factory.board.deleted' });
  });
});
