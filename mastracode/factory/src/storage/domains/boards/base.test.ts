import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage, PostgresStore } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { StoredBoardError, StoredBoardsStorage } from './base.js';
import type { StoredBoardInput, StoredBoardScope } from './base.js';
import {
  FACTORY_BOARD_DEFINITION_VERSIONS_SCHEMA,
  FACTORY_BOARD_PHASES_SCHEMA,
  FACTORY_BOARDS_SCHEMA,
} from './schemas.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

function board(key: string, overrides: Partial<StoredBoardInput> = {}): StoredBoardInput {
  return {
    key,
    name: `Board ${key}`,
    phases: [
      { key: 'intake', name: 'Intake', kind: 'resting', nextPhases: ['build'] },
      {
        key: 'build',
        name: 'Build',
        description: 'Builds it.',
        kind: 'working',
        runner: { skill: 'ship-it', context: 'work', instructions: 'Be careful.' },
        nextPhases: ['intake', 'done'],
        autoStart: true,
        autoStartWhen: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'go' }] },
        exitTool: {
          id: 'submit_release',
          autoApprove: true,
          autoApproveWhen: {
            operator: 'OR',
            conditions: [{ field: 'item.labels', operator: 'contains', value: 'auto' }],
          },
        },
      },
      { key: 'done', name: 'Done', kind: 'terminal' },
    ],
    ...overrides,
  };
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('StoredBoardsStorage on %s', backend => {
  /** One storage client; on libsql a shared `file:` database lets a second client act as another replica. */
  async function client(url: string) {
    const storage =
      backend === 'postgres'
        ? new PgFactoryStorage({ id: `boards-${randomUUID()}`, connectionString: postgresUrl! })
        : new LibSQLFactoryStorage({ id: `boards-${randomUUID()}`, url });
    const boards = storage.registerDomain(new StoredBoardsStorage());
    await storage.init();
    onTestFinished(() => storage.close());
    return boards;
  }

  async function setup() {
    let url = ':memory:';
    if (backend === 'libsql') {
      const dir = mkdtempSync(join(tmpdir(), 'factory-boards-'));
      onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
      url = `file:${join(dir, 'boards.db')}`;
    }
    const boards = await client(url);
    // The Postgres database is shared across runs, so every test gets its own org.
    const scope: StoredBoardScope = { orgId: `org-${randomUUID()}`, factoryProjectId: 'project-1' };
    return { boards, scope, secondClient: () => client(url) };
  }

  it('reads back every field of a board, with phases in the order they were written', async () => {
    const { boards, scope } = await setup();
    const input = board('release', { description: 'Ships releases.' });
    input.phases = [input.phases[0]!, input.phases[2]!, input.phases[1]!];

    const created = await boards.create(scope, input, 'user-1');

    expect(created).toMatchObject({
      key: 'release',
      name: 'Board release',
      description: 'Ships releases.',
      revision: 1,
      createdBy: 'user-1',
      updatedBy: 'user-1',
    });
    expect(created.phases.map(phase => phase.key)).toEqual(['intake', 'done', 'build']);
    expect(created.phases[2]).toEqual({
      key: 'build',
      position: 2,
      name: 'Build',
      description: 'Builds it.',
      kind: 'working',
      runner: { skill: 'ship-it', context: 'work', instructions: 'Be careful.' },
      nextPhases: ['intake', 'done'],
      autoStart: true,
      autoStartWhen: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'go' }] },
      exitTool: {
        id: 'submit_release',
        autoApprove: true,
        autoApproveWhen: {
          operator: 'OR',
          conditions: [{ field: 'item.labels', operator: 'contains', value: 'auto' }],
        },
      },
    });
    expect(created.phases[1]).toMatchObject({
      description: null,
      runner: null,
      nextPhases: null,
      autoStart: false,
      autoStartWhen: null,
      exitTool: null,
    });
    expect(await boards.list(scope)).toEqual([created]);
  });

  it('keeps two projects with the same board key apart', async () => {
    const { boards, scope } = await setup();
    const other = { ...scope, factoryProjectId: 'project-2' };

    await boards.create(scope, board('release'), 'user-1');
    await boards.create(other, board('release', { name: 'Other release' }), 'user-1');
    await boards.replace(
      other,
      'release',
      { name: 'Renamed', phases: board('x').phases },
      {
        expectedRevision: 1,
        actor: 'user-1',
      },
    );

    expect((await boards.get(scope, 'release'))!.name).toBe('Board release');
    expect((await boards.get(other, 'release'))!.name).toBe('Renamed');
    expect(await boards.list({ ...scope, factoryProjectId: 'project-3' })).toEqual([]);
  });

  it('refuses to create a board whose key exists, and leaves the version unchanged', async () => {
    const { boards, scope } = await setup();
    await boards.create(scope, board('release'), 'user-1');
    const version = await boards.readVersion(scope);

    await expect(boards.create(scope, board('release', { name: 'Again' }), 'user-2')).rejects.toMatchObject({
      code: 'board_exists',
    });

    expect(await boards.readVersion(scope)).toBe(version);
    expect((await boards.get(scope, 'release'))!.name).toBe('Board release');
  });

  it('refuses a stale revision and leaves the board and the version unchanged', async () => {
    const { boards, scope } = await setup();
    await boards.create(scope, board('release'), 'user-1');
    const edited = await boards.replace(
      scope,
      'release',
      { name: 'First edit', phases: board('x').phases },
      {
        expectedRevision: 1,
        actor: 'user-1',
      },
    );
    expect(edited.revision).toBe(2);
    const version = await boards.readVersion(scope);

    const stale = boards.replace(
      scope,
      'release',
      { name: 'Second edit', phases: [] },
      {
        expectedRevision: 1,
        actor: 'user-2',
      },
    );

    await expect(stale).rejects.toBeInstanceOf(StoredBoardError);
    await expect(stale).rejects.toMatchObject({ code: 'revision_mismatch' });
    expect(await boards.get(scope, 'release')).toEqual(edited);
    expect(await boards.readVersion(scope)).toBe(version);
  });

  it('changes the version on every write and not on a refused one', async () => {
    const { boards, scope } = await setup();
    const versions = [await boards.readVersion(scope)];
    expect(versions[0]).toBeNull();

    await boards.create(scope, board('release'), 'user-1');
    versions.push(await boards.readVersion(scope));
    await boards.replace(
      scope,
      'release',
      { name: 'Renamed', phases: board('x').phases },
      {
        expectedRevision: 1,
        actor: 'user-1',
      },
    );
    versions.push(await boards.readVersion(scope));
    await expect(boards.delete(scope, 'release', { expectedRevision: 1 })).rejects.toMatchObject({
      code: 'revision_mismatch',
    });
    expect(await boards.readVersion(scope)).toBe(versions.at(-1));
    await boards.delete(scope, 'release', { expectedRevision: 2 });
    versions.push(await boards.readVersion(scope));

    expect(new Set(versions).size).toBe(versions.length);
    expect(await boards.list(scope)).toEqual([]);
  });

  it('refuses a stale delete and keeps the board and its phases', async () => {
    const { boards, scope, secondClient } = await setup();
    const other = await secondClient();
    await boards.create(scope, board('release'), 'user-1');
    const edited = await other.replace(
      scope,
      'release',
      { name: 'Edited elsewhere', phases: board('x').phases },
      { expectedRevision: 1, actor: 'user-2' },
    );

    await expect(boards.delete(scope, 'release', { expectedRevision: 1 })).rejects.toMatchObject({
      code: 'revision_mismatch',
    });

    expect(await boards.get(scope, 'release')).toEqual(edited);
    expect(edited.phases).toHaveLength(3);
  });

  it('refuses to delete or replace a board that does not exist', async () => {
    const { boards, scope } = await setup();

    await expect(boards.delete(scope, 'missing', { expectedRevision: 1 })).rejects.toMatchObject({
      code: 'board_not_found',
    });
    await expect(
      boards.replace(scope, 'missing', { name: 'x', phases: board('x').phases }, { expectedRevision: 1, actor: 'u' }),
    ).rejects.toMatchObject({ code: 'board_not_found' });
    expect(await boards.readVersion(scope)).toBeNull();
  });

  it('lets a second client see a write through the version and the rows', async () => {
    const { boards, scope, secondClient } = await setup();
    const other = await secondClient();
    await boards.create(scope, board('release'), 'user-1');
    const seen = await other.snapshot(scope);

    await boards.replace(
      scope,
      'release',
      { name: 'Edited', phases: board('x').phases },
      {
        expectedRevision: 1,
        actor: 'user-1',
      },
    );

    const after = await other.snapshot(scope);
    expect(after.version).not.toBe(seen.version);
    expect(after.boards[0]!.name).toBe('Edited');
  });

  it('keeps one board when two clients create the same key at once', async () => {
    const { boards, scope, secondClient } = await setup();
    const other = await secondClient();

    const results = await Promise.allSettled([
      boards.create(scope, board('release'), 'user-1'),
      other.create(scope, board('release', { name: 'Other release' }), 'user-2'),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const [refused] = results.filter(result => result.status === 'rejected');
    expect((refused as PromiseRejectedResult).reason).toMatchObject({ code: 'board_exists' });
    const stored = await boards.list(scope);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.phases).toHaveLength(3);
  });

  it('creates boards in many projects at once from two clients, as replicas do side by side', async () => {
    const { boards, scope, secondClient } = await setup();
    const other = await secondClient();
    const projects = Array.from({ length: 8 }, (_, index) => ({ ...scope, factoryProjectId: `project-${index}` }));

    await Promise.all(
      projects.flatMap(project => [
        boards.create(project, board('bugs'), 'user-1'),
        other.create(project, board('release'), 'user-2'),
      ]),
    );

    for (const project of projects) {
      const stored = await boards.list(project);
      expect(stored.map(row => row.key).sort()).toEqual(['bugs', 'release']);
      expect(stored.every(row => row.revision === 1 && row.phases.length === 3)).toBe(true);
      expect(await boards.readVersion(project)).not.toBeNull();
    }
  });

  describe("storing Factory's boards in a project", () => {
    const stored = async (boards: StoredBoardsStorage, scope: StoredBoardScope) =>
      (await boards.list(scope)).map(row => [row.key, row.name, row.revision]);

    it('stores each board once, then only reads', async () => {
      const { boards, scope } = await setup();
      const seeds = [board('work'), board('release')];

      expect(await boards.seedBoards(scope, seeds)).toEqual(['work', 'release']);
      const version = await boards.readVersion(scope);
      const first = await boards.list(scope);
      expect(await boards.seedBoards(scope, seeds)).toEqual([]);

      expect(version).not.toBeNull();
      expect(first.map(row => [row.key, row.revision, row.createdBy])).toEqual([
        ['work', 1, 'factory'],
        ['release', 1, 'factory'],
      ]);
      expect(first[0]!.phases.map(phase => phase.key)).toEqual(['intake', 'build', 'done']);
      expect(await boards.readVersion(scope)).toBe(version);
      expect(await boards.list(scope)).toEqual(first);
    });

    it('does not store a board again after the project deletes it', async () => {
      const { boards, scope } = await setup();
      await boards.seedBoards(scope, [board('work'), board('release')]);
      await boards.delete(scope, 'release', { expectedRevision: 1 });
      const version = await boards.readVersion(scope);

      expect(await boards.seedBoards(scope, [board('work'), board('release')])).toEqual([]);

      expect(await stored(boards, scope)).toEqual([['work', 'Board work', 1]]);
      expect(await boards.readVersion(scope)).toBe(version);
    });

    it('never rewrites a stored board when Factory changes its definition, edited or not', async () => {
      const { boards, scope } = await setup();
      await boards.seedBoards(scope, [board('work'), board('release')]);
      await boards.replace(
        scope,
        'release',
        { name: 'Ours', phases: board('x').phases },
        { expectedRevision: 1, actor: 'u' },
      );
      const version = await boards.readVersion(scope);
      const changed = { name: 'New default', phases: board('x').phases.slice(0, 1) };

      expect(await boards.seedBoards(scope, [board('work', changed), board('release', changed)])).toEqual([]);

      expect(await stored(boards, scope)).toEqual([
        ['work', 'Board work', 1],
        ['release', 'Ours', 2],
      ]);
      expect(await boards.readVersion(scope)).toBe(version);
    });

    it('stores a board added to the list later, once, at the end', async () => {
      const { boards, scope } = await setup();
      await boards.seedBoards(scope, [board('work')]);

      expect(await boards.seedBoards(scope, [board('work'), board('bugs')])).toEqual(['bugs']);
      await boards.delete(scope, 'bugs', { expectedRevision: 1 });
      expect(await boards.seedBoards(scope, [board('work'), board('bugs')])).toEqual([]);

      expect(await stored(boards, scope)).toEqual([['work', 'Board work', 1]]);
    });

    it('changes the version once when replicas on two releases keep storing different Work boards', async () => {
      const { boards, scope, secondClient } = await setup();
      const newer = await secondClient();
      const versions: (string | null)[] = [];

      for (let round = 0; round < 5; round++) {
        await boards.seedBoards(scope, [board('work', { name: 'Work v1' })]);
        versions.push(await boards.readVersion(scope));
        await newer.seedBoards(scope, [board('work', { name: 'Work v2' })]);
        versions.push(await boards.readVersion(scope));
      }

      expect(await boards.get(scope, 'work')).toMatchObject({ name: 'Work v1', revision: 1 });
      expect(new Set(versions).size).toBe(1);
    });

    it('records every key when two replicas store different boards in the same projects at once', async () => {
      const { boards, scope, secondClient } = await setup();
      const other = await secondClient();
      const projects = Array.from({ length: 6 }, (_, index) => ({ ...scope, factoryProjectId: `project-${index}` }));

      await Promise.all(
        projects.flatMap(project => [
          boards.seedBoards(project, [board('work'), board('release')]),
          other.seedBoards(project, [board('work'), board('bugs')]),
        ]),
      );

      for (const project of projects) {
        expect((await boards.list(project)).map(row => [row.key, row.revision, row.phases.length]).sort()).toEqual([
          ['bugs', 1, 3],
          ['release', 1, 3],
          ['work', 1, 3],
        ]);
        await boards.delete(project, 'bugs', { expectedRevision: 1 });
        await boards.delete(project, 'release', { expectedRevision: 1 });
        await boards.seedBoards(project, [board('work'), board('release'), board('bugs')]);
        expect((await boards.list(project)).map(row => row.key)).toEqual(['work']);
      }
    });

    it('inserts a board where its key is missing, even one the project deleted, and never overwrites one', async () => {
      const { boards, scope } = await setup();
      await boards.seedBoards(scope, [board('work'), board('release')]);
      await boards.replace(
        scope,
        'work',
        { name: 'Ours', phases: board('x').phases },
        { expectedRevision: 1, actor: 'u' },
      );
      await boards.delete(scope, 'release', { expectedRevision: 1 });

      expect(await boards.insertIfMissing(scope, board('work', { name: 'Theirs' }), 'factory')).toBe(false);
      expect(await boards.insertIfMissing(scope, board('release', { name: 'Back' }), 'factory')).toBe(true);
      expect(await boards.insertIfMissing(scope, board('bugs'), 'factory')).toBe(true);
      await boards.delete(scope, 'bugs', { expectedRevision: 1 });
      await boards.seedBoards(scope, [board('bugs')]);

      expect(await stored(boards, scope)).toEqual([
        ['work', 'Ours', 2],
        ['release', 'Back', 1],
      ]);
    });

    it('resets a board to a definition at a higher revision and refuses a stale one', async () => {
      const { boards, scope } = await setup();
      await boards.seedBoards(scope, [board('work')]);
      await boards.replace(
        scope,
        'work',
        { name: 'Edited', phases: board('x').phases.slice(0, 1) },
        { expectedRevision: 1, actor: 'u' },
      );
      const version = await boards.readVersion(scope);

      await expect(
        boards.resetTo(scope, 'work', board('work'), { expectedRevision: 1, actor: 'user-2' }),
      ).rejects.toMatchObject({ code: 'revision_mismatch' });
      expect(await boards.readVersion(scope)).toBe(version);

      const reset = await boards.resetTo(scope, 'work', board('work'), { expectedRevision: 2, actor: 'user-2' });
      expect(reset).toMatchObject({ name: 'Board work', revision: 3, updatedBy: 'user-2' });
      expect(reset.phases.map(phase => phase.key)).toEqual(['intake', 'build', 'done']);
      expect(await boards.readVersion(scope)).not.toBe(version);
    });

    it('records every key when two replicas only record boards the projects already have, at once', async () => {
      const { boards, scope, secondClient } = await setup();
      const other = await secondClient();
      const projects = Array.from({ length: 6 }, (_, index) => ({ ...scope, factoryProjectId: `project-${index}` }));
      for (const project of projects) {
        await boards.seedBoards(project, [board('work')]);
        // The project made these itself, before either release seeded them.
        await boards.create(project, board('release'), 'admin');
        await boards.create(project, board('bugs'), 'admin');
      }

      await Promise.all(
        projects.flatMap(project => [
          boards.seedBoards(project, [board('work'), board('release')]),
          other.seedBoards(project, [board('work'), board('bugs')]),
        ]),
      );

      for (const project of projects) {
        await boards.delete(project, 'bugs', { expectedRevision: 1 });
        await boards.delete(project, 'release', { expectedRevision: 1 });
        await boards.seedBoards(project, [board('work'), board('release'), board('bugs')]);
        expect((await boards.list(project)).map(row => row.key)).toEqual(['work']);
      }
    });

    it('reads a board stored before Factory stored its boards, and stores the missing ones in a project from then', async () => {
      const { scope } = await setup();
      const { url, drop } = await emptyDatabase();
      onTestFinished(drop);
      const old =
        backend === 'postgres'
          ? new PgFactoryStorage({ connectionString: url })
          : new LibSQLFactoryStorage({ id: 'old', url });
      const { seeded_boards: _seeded, ...oldVersionColumns } = FACTORY_BOARD_DEFINITION_VERSIONS_SCHEMA.columns;
      await old.ensureCollections([
        FACTORY_BOARDS_SCHEMA,
        FACTORY_BOARD_PHASES_SCHEMA,
        { ...FACTORY_BOARD_DEFINITION_VERSIONS_SCHEMA, columns: oldVersionColumns },
      ]);
      const now = new Date();
      await old.ops.insertOne('factory_boards', {
        org_id: scope.orgId,
        factory_project_id: scope.factoryProjectId,
        board_key: 'work',
        name: 'Our work',
        description: null,
        position: 0,
        revision: 4,
        created_by: 'user-1',
        created_at: now,
        updated_by: 'user-1',
        updated_at: now,
      });
      await old.ops.insertOne('factory_board_definition_versions', {
        org_id: scope.orgId,
        factory_project_id: scope.factoryProjectId,
        version: 'old',
        updated_at: now,
      });
      await old.close();

      const storage =
        backend === 'postgres'
          ? new PgFactoryStorage({ connectionString: url })
          : new LibSQLFactoryStorage({ id: 'new', url });
      const boards = storage.registerDomain(new StoredBoardsStorage());
      await storage.init();
      onTestFinished(() => storage.close());

      expect(await boards.get(scope, 'work')).toMatchObject({ name: 'Our work', revision: 4 });
      expect(await boards.seedBoards(scope, [board('work'), board('release')])).toEqual(['release']);
      await boards.delete(scope, 'release', { expectedRevision: 1 });
      expect(await boards.seedBoards(scope, [board('work'), board('release')])).toEqual([]);
      expect(await stored(boards, scope)).toEqual([['work', 'Our work', 4]]);
    });

    /** A database with none of the boards tables: a fresh file on libsql, a fresh schema on Postgres. */
    async function emptyDatabase(): Promise<{ url: string; drop: () => Promise<void> }> {
      if (backend === 'libsql') {
        const dir = mkdtempSync(join(tmpdir(), 'factory-boards-old-'));
        return {
          url: `file:${join(dir, 'boards.db')}`,
          drop: async () => rmSync(dir, { recursive: true, force: true }),
        };
      }
      const admin = new PostgresStore({ id: `boards-admin-${randomUUID()}`, connectionString: postgresUrl! });
      const schema = `boards_old_${randomUUID().replaceAll('-', '')}`;
      await admin.pool.query(`CREATE SCHEMA "${schema}"`);
      const url = new URL(postgresUrl!);
      url.searchParams.set('options', `-c search_path=${schema}`);
      return {
        url: url.toString(),
        drop: async () => {
          await admin.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
          await admin.close();
        },
      };
    }
  });
});
