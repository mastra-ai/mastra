import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { StoredBoardError, StoredBoardsStorage } from './base.js';
import type { StoredBoardInput, StoredBoardScope } from './base.js';

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
});
