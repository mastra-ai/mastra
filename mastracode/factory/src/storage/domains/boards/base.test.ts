import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { StoredBoardError, StoredBoardsStorage } from './base.js';
import type { StoredBoardInput, StoredBoardScope, StoredBoardSeed } from './base.js';

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

function seed(key: string, hash: string, input = board(key), source: 'builtin' | 'app' = 'app'): StoredBoardSeed {
  return { key, source, hash, input };
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
      seedSource: null,
      seedHash: null,
      driftHash: null,
      customized: false,
      deletedAt: null,
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
        customized: true,
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

  it('changes the version on every write and not on a no-op seed pass', async () => {
    const { boards, scope } = await setup();
    const versions = [await boards.readVersion(scope)];
    expect(versions[0]).toBeNull();

    await boards.applySeed(scope, [seed('work', 'h1', board('work'), 'builtin')]);
    versions.push(await boards.readVersion(scope));
    expect(await boards.applySeed(scope, [seed('work', 'h1', board('work'), 'builtin')])).toEqual({
      written: [],
      drifted: [],
    });
    expect(await boards.readVersion(scope)).toBe(versions.at(-1));

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
    await boards.delete(scope, 'release', { expectedRevision: 2 });
    versions.push(await boards.readVersion(scope));
    await boards.softDelete(scope, 'work', { expectedRevision: 1, actor: 'user-1' });
    versions.push(await boards.readVersion(scope));
    await boards.reset(scope, 'work', seed('work', 'h1', board('work'), 'builtin'), {
      expectedRevision: 2,
      actor: 'user-1',
    });
    versions.push(await boards.readVersion(scope));

    expect(new Set(versions).size).toBe(versions.length);
  });

  describe('seeding code boards', () => {
    it('inserts a code board that has no row', async () => {
      const { boards, scope } = await setup();

      const result = await boards.applySeed(scope, [
        seed('work', 'work-1', board('work'), 'builtin'),
        seed('release', 'release-1'),
      ]);

      expect(result).toEqual({ written: ['work', 'release'], drifted: [] });
      const stored = await boards.list(scope);
      expect(stored.map(row => [row.key, row.position, row.seedSource, row.seedHash, row.customized])).toEqual([
        ['work', 0, 'builtin', 'work-1', false],
        ['release', 1, 'app', 'release-1', false],
      ]);
      expect(stored[0]!.updatedBy).toBe('factory:seed');
      expect(stored[0]!.phases.map(phase => phase.key)).toEqual(['intake', 'build', 'done']);
    });

    it('writes nothing for an unedited board whose code did not change', async () => {
      const { boards, scope } = await setup();
      await boards.applySeed(scope, [seed('release', 'release-1')]);
      const before = await boards.get(scope, 'release');

      expect(await boards.applySeed(scope, [seed('release', 'release-1')])).toEqual({ written: [], drifted: [] });

      expect(await boards.get(scope, 'release')).toEqual(before);
    });

    it('overwrites an unedited board with the changed code definition and raises its revision', async () => {
      const { boards, scope } = await setup();
      await boards.applySeed(scope, [seed('release', 'release-1')]);
      const changed = board('release', { name: 'Release v2' });
      changed.phases = [...changed.phases.slice(0, 2), { key: 'shipped', name: 'Shipped', kind: 'terminal' }];

      const result = await boards.applySeed(scope, [seed('release', 'release-2', changed)]);

      expect(result).toEqual({ written: ['release'], drifted: [] });
      const stored = (await boards.get(scope, 'release'))!;
      expect(stored).toMatchObject({ name: 'Release v2', seedHash: 'release-2', revision: 2, customized: false });
      expect(stored.phases.map(phase => phase.key)).toEqual(['intake', 'build', 'shipped']);
    });

    it('keeps an edited board when the code changed, and records the newer code hash as drift', async () => {
      const { boards, scope } = await setup();
      await boards.applySeed(scope, [seed('release', 'release-1')]);
      await boards.replace(
        scope,
        'release',
        { name: 'Edited by a person', phases: board('x').phases },
        {
          expectedRevision: 1,
          actor: 'user-1',
          customized: true,
        },
      );

      const result = await boards.applySeed(scope, [seed('release', 'release-2', board('release', { name: 'v2' }))]);

      expect(result).toEqual({ written: ['release'], drifted: ['release'] });
      const stored = (await boards.get(scope, 'release'))!;
      expect(stored).toMatchObject({
        name: 'Edited by a person',
        customized: true,
        seedHash: 'release-1',
        driftHash: 'release-2',
      });
      // Seeding again reports nothing new.
      expect(await boards.applySeed(scope, [seed('release', 'release-2')])).toEqual({ written: [], drifted: [] });
    });

    it('writes nothing for an edited board whose code did not change', async () => {
      const { boards, scope } = await setup();
      await boards.applySeed(scope, [seed('release', 'release-1')]);
      const edited = await boards.replace(
        scope,
        'release',
        { name: 'Edited', phases: board('x').phases },
        {
          expectedRevision: 1,
          actor: 'user-1',
          customized: true,
        },
      );
      const version = await boards.readVersion(scope);

      expect(await boards.applySeed(scope, [seed('release', 'release-1')])).toEqual({ written: [], drifted: [] });

      expect(await boards.get(scope, 'release')).toEqual(edited);
      expect(await boards.readVersion(scope)).toBe(version);
    });

    it('never overwrites a board created through the API under a code board key', async () => {
      const { boards, scope } = await setup();
      await boards.create(scope, board('release', { name: 'Mine' }), 'user-1');

      const result = await boards.applySeed(scope, [seed('release', 'release-1')]);

      expect(result).toEqual({ written: ['release'], drifted: ['release'] });
      expect(await boards.get(scope, 'release')).toMatchObject({
        name: 'Mine',
        seedSource: 'app',
        customized: true,
        driftHash: 'release-1',
      });
    });

    it('turns a seeded board that left the code into an ordinary board', async () => {
      const { boards, scope } = await setup();
      await boards.applySeed(scope, [seed('release', 'release-1'), seed('work', 'work-1', board('work'), 'builtin')]);

      const result = await boards.applySeed(scope, [seed('work', 'work-1', board('work'), 'builtin')]);

      expect(result).toEqual({ written: ['release'], drifted: [] });
      expect(await boards.get(scope, 'release')).toMatchObject({ seedSource: null, driftHash: null });
      expect((await boards.get(scope, 'release'))!.phases).toHaveLength(3);
    });

    it('does not bring back a deleted seeded board, and reset restores it with the code definition', async () => {
      const { boards, scope } = await setup();
      await boards.applySeed(scope, [seed('release', 'release-1')]);
      await boards.softDelete(scope, 'release', { expectedRevision: 1, actor: 'user-1' });

      expect(await boards.applySeed(scope, [seed('release', 'release-2')])).toEqual({ written: [], drifted: [] });
      expect(await boards.get(scope, 'release')).toBeNull();
      expect(await boards.list(scope)).toEqual([]);
      const tombstone = (await boards.get(scope, 'release', { includeDeleted: true }))!;
      expect(tombstone.deletedAt).toBeInstanceOf(Date);

      const restored = await boards.reset(scope, 'release', seed('release', 'release-2'), {
        expectedRevision: tombstone.revision,
        actor: 'user-1',
      });

      expect(restored).toMatchObject({ deletedAt: null, seedHash: 'release-2', customized: false });
      expect(await boards.list(scope)).toHaveLength(1);
    });

    it('reset adopts the code definition and clears the edit and the drift', async () => {
      const { boards, scope } = await setup();
      await boards.applySeed(scope, [seed('release', 'release-1')]);
      await boards.replace(
        scope,
        'release',
        { name: 'Edited', phases: board('x').phases.slice(0, 1) },
        {
          expectedRevision: 1,
          actor: 'user-1',
          customized: true,
        },
      );
      await boards.applySeed(scope, [seed('release', 'release-2', board('release', { name: 'v2' }))]);
      const drifted = (await boards.get(scope, 'release'))!;

      const reset = await boards.reset(
        scope,
        'release',
        seed('release', 'release-2', board('release', { name: 'v2' })),
        {
          expectedRevision: drifted.revision,
          actor: 'user-1',
        },
      );

      expect(reset).toMatchObject({ name: 'v2', customized: false, driftHash: null, seedHash: 'release-2' });
      expect(reset.revision).toBe(drifted.revision + 1);
      expect(reset.phases.map(phase => phase.key)).toEqual(['intake', 'build', 'done']);
    });
  });

  it('lets a second client see a write through the version and the rows', async () => {
    const { boards, scope, secondClient } = await setup();
    const other = await secondClient();
    await boards.applySeed(scope, [seed('release', 'release-1')]);
    const seen = await other.snapshot(scope);

    await boards.replace(
      scope,
      'release',
      { name: 'Edited', phases: board('x').phases },
      {
        expectedRevision: 1,
        actor: 'user-1',
        customized: true,
      },
    );

    const after = await other.snapshot(scope);
    expect(after.version).not.toBe(seen.version);
    expect(after.boards[0]!.name).toBe('Edited');
  });

  it('seeds one row per board when two clients seed the same project at once', async () => {
    const { boards, scope, secondClient } = await setup();
    const other = await secondClient();
    const seeds = [seed('work', 'work-1', board('work'), 'builtin'), seed('release', 'release-1')];

    const results = await Promise.all([boards.applySeed(scope, seeds), other.applySeed(scope, seeds)]);

    const stored = await boards.list(scope, { includeDeleted: true });
    expect(stored.map(row => row.key).sort()).toEqual(['release', 'work']);
    expect(stored.every(row => row.revision === 1 && row.phases.length === 3)).toBe(true);
    expect(results.flatMap(result => result.written).sort()).toEqual(['release', 'work']);
  });
});
