import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { MAX_INTAKE_ROUTES, StoredBoardsStorage } from './base.js';
import type { StoredBoardScope, StoredIntakeRouteInput } from './base.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

const TRUSTED = {
  operator: 'AND' as const,
  conditions: [{ field: 'author.trusted', operator: 'equals' as const, value: true }],
};

function route(name: string, overrides: Partial<StoredIntakeRouteInput> = {}): StoredIntakeRouteInput {
  return { name, ...overrides };
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('intake routes on %s', backend => {
  /** One storage client; on libsql a shared `file:` database lets a second client act as another replica. */
  async function client(url: string) {
    const storage =
      backend === 'postgres'
        ? new PgFactoryStorage({ id: `intake-routes-${randomUUID()}`, connectionString: postgresUrl! })
        : new LibSQLFactoryStorage({ id: `intake-routes-${randomUUID()}`, url });
    const boards = storage.registerDomain(new StoredBoardsStorage());
    await storage.init();
    onTestFinished(() => storage.close());
    return boards;
  }

  async function setup() {
    let url = ':memory:';
    if (backend === 'libsql') {
      const dir = mkdtempSync(join(tmpdir(), 'factory-intake-routes-'));
      onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
      url = `file:${join(dir, 'routes.db')}`;
    }
    const boards = await client(url);
    // The Postgres database is shared across runs, so every test gets its own org.
    const scope: StoredBoardScope = { orgId: `org-${randomUUID()}`, factoryProjectId: 'project-1' };
    return { boards, scope, secondClient: () => client(url) };
  }

  async function names(boards: StoredBoardsStorage, scope: StoredBoardScope) {
    const routes = await boards.listIntakeRoutes(scope);
    expect(routes.map(row => row.position)).toEqual(routes.map((_, index) => index));
    return routes.map(row => row.name);
  }

  it('reads back every field of a route, and fills the defaults', async () => {
    const { boards, scope } = await setup();

    const full = await boards.createIntakeRoute(
      scope,
      route('Trusted to triage', {
        enabled: false,
        when: TRUSTED,
        target: { boardKey: 'work', phaseKey: 'triage' },
        hold: 'never',
      }),
      'user-1',
    );
    const bare = await boards.createIntakeRoute(scope, route('Everything'), 'user-2');

    expect(full).toMatchObject({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      name: 'Trusted to triage',
      enabled: false,
      position: 0,
      when: TRUSTED,
      target: { boardKey: 'work', phaseKey: 'triage' },
      hold: 'never',
      revision: 1,
      createdBy: 'user-1',
      updatedBy: 'user-1',
    });
    expect(full.createdAt).toBeInstanceOf(Date);
    expect(bare).toMatchObject({ enabled: true, position: 1, when: null, target: null, hold: 'untrusted' });
    expect(await boards.getIntakeRoute(scope, full.id)).toEqual(full);
    expect(await boards.listIntakeRoutes(scope)).toEqual([full, bare]);
  });

  it('refuses a route past the most a project may have', async () => {
    const { boards, scope } = await setup();
    for (let i = 0; i < MAX_INTAKE_ROUTES; i += 1) await boards.createIntakeRoute(scope, { name: `r${i}` }, 'admin');
    await expect(boards.createIntakeRoute(scope, { name: 'one more' }, 'admin')).rejects.toMatchObject({
      code: 'intake_route_limit',
    });
    expect(await boards.listIntakeRoutes(scope)).toHaveLength(MAX_INTAKE_ROUTES);
  });

  it('keeps a board-only target without a phase', async () => {
    const { boards, scope } = await setup();
    const created = await boards.createIntakeRoute(scope, route('Docs', { target: { boardKey: 'docs' } }), 'u');
    expect(created.target).toEqual({ boardKey: 'docs', phaseKey: null });
  });

  it('keeps two projects apart', async () => {
    const { boards, scope } = await setup();
    const other = { ...scope, factoryProjectId: 'project-2' };
    const mine = await boards.createIntakeRoute(scope, route('Mine'), 'u');
    await boards.createIntakeRoute(other, route('Theirs'), 'u');

    expect(await names(boards, scope)).toEqual(['Mine']);
    expect(await names(boards, other)).toEqual(['Theirs']);
    expect(await boards.getIntakeRoute(other, mine.id)).toBeNull();
    await expect(boards.deleteIntakeRoute(other, mine.id, { expectedRevision: 1 })).rejects.toMatchObject({
      code: 'intake_route_not_found',
    });
  });

  it('changes only the fields a patch names and raises the revision', async () => {
    const { boards, scope } = await setup();
    const created = await boards.createIntakeRoute(
      scope,
      route('Trusted', { when: TRUSTED, target: { boardKey: 'work', phaseKey: 'triage' } }),
      'user-1',
    );

    const renamed = await boards.updateIntakeRoute(
      scope,
      created.id,
      { name: 'Renamed', hold: 'always' },
      { expectedRevision: 1, actor: 'user-2' },
    );
    expect(renamed).toMatchObject({
      name: 'Renamed',
      hold: 'always',
      when: TRUSTED,
      target: { boardKey: 'work', phaseKey: 'triage' },
      revision: 2,
      createdBy: 'user-1',
      updatedBy: 'user-2',
    });

    const cleared = await boards.updateIntakeRoute(
      scope,
      created.id,
      { when: null, target: null, enabled: false },
      { expectedRevision: 2, actor: 'user-2' },
    );
    expect(cleared).toMatchObject({ name: 'Renamed', when: null, target: null, enabled: false, revision: 3 });
  });

  it('refuses a stale update or delete from another client and changes nothing', async () => {
    const { boards, scope, secondClient } = await setup();
    const other = await secondClient();
    const created = await boards.createIntakeRoute(scope, route('Trusted', { when: TRUSTED }), 'user-1');
    const edited = await other.updateIntakeRoute(
      scope,
      created.id,
      { name: 'Edited elsewhere' },
      { expectedRevision: 1, actor: 'user-2' },
    );

    await expect(
      boards.updateIntakeRoute(scope, created.id, { hold: 'never' }, { expectedRevision: 1, actor: 'user-1' }),
    ).rejects.toMatchObject({ code: 'revision_mismatch' });
    await expect(boards.deleteIntakeRoute(scope, created.id, { expectedRevision: 1 })).rejects.toMatchObject({
      code: 'revision_mismatch',
    });

    expect(await boards.getIntakeRoute(scope, created.id)).toEqual(edited);
    expect(edited.hold).toBe('untrusted');
  });

  it('refuses to change a route that does not exist', async () => {
    const { boards, scope } = await setup();
    await expect(
      boards.updateIntakeRoute(scope, randomUUID(), { name: 'x' }, { expectedRevision: 1, actor: 'u' }),
    ).rejects.toMatchObject({ code: 'intake_route_not_found' });
    await expect(boards.deleteIntakeRoute(scope, randomUUID(), { expectedRevision: 1 })).rejects.toMatchObject({
      code: 'intake_route_not_found',
    });
  });

  it('appends new routes, closes the gap a delete leaves, and reorders', async () => {
    const { boards, scope } = await setup();
    const created = [];
    for (const name of ['a', 'b', 'c', 'd']) created.push(await boards.createIntakeRoute(scope, route(name), 'u'));
    expect(await names(boards, scope)).toEqual(['a', 'b', 'c', 'd']);

    await boards.deleteIntakeRoute(scope, created[1]!.id, { expectedRevision: 1 });
    expect(await names(boards, scope)).toEqual(['a', 'c', 'd']);

    await boards.createIntakeRoute(scope, route('e'), 'u');
    const current = await boards.listIntakeRoutes(scope);
    const reordered = await boards.reorderIntakeRoutes(
      scope,
      [current[3]!.id, current[0]!.id, current[2]!.id, current[1]!.id],
      'admin',
    );

    expect(reordered.map(row => row.name)).toEqual(['e', 'a', 'd', 'c']);
    expect(await names(boards, scope)).toEqual(['e', 'a', 'd', 'c']);
    // Only routes that moved were written: d moved up once when b was deleted and kept its place here.
    const byName = Object.fromEntries(reordered.map(row => [row.name, row]));
    expect(byName.d).toMatchObject({ revision: 2, updatedBy: 'u' });
    expect(byName.a).toMatchObject({ updatedBy: 'admin' });
    expect(byName.e).toMatchObject({ updatedBy: 'admin' });
    expect(byName.e!.revision).toBeGreaterThan(1);
  });

  it('refuses an order that misses, repeats or invents a route, and changes nothing', async () => {
    const { boards, scope } = await setup();
    for (const name of ['a', 'b', 'c']) await boards.createIntakeRoute(scope, route(name), 'u');
    const before = await boards.listIntakeRoutes(scope);
    const [a, b, c] = before.map(row => row.id) as [string, string, string];

    for (const ids of [[c, a], [c, a, b, b], [c, a, a], [c, a, randomUUID()], []]) {
      await expect(boards.reorderIntakeRoutes(scope, ids, 'admin')).rejects.toMatchObject({
        code: 'intake_route_set_mismatch',
      });
    }
    expect(await boards.listIntakeRoutes(scope)).toEqual(before);
  });

  it('gives routes created at once by two clients distinct positions', async () => {
    const { boards, scope, secondClient } = await setup();
    const other = await secondClient();

    await Promise.all([
      boards.createIntakeRoute(scope, route('one'), 'user-1'),
      other.createIntakeRoute(scope, route('two'), 'user-2'),
    ]);
    await Promise.all([
      boards.createIntakeRoute(scope, route('three'), 'user-1'),
      other.createIntakeRoute(scope, route('four'), 'user-2'),
    ]);

    expect((await names(boards, scope)).sort()).toEqual(['four', 'one', 'three', 'two']);
  });

  it('ends in one of the two orders when two clients reorder at once', async () => {
    const { boards, scope, secondClient } = await setup();
    const other = await secondClient();
    for (const name of ['a', 'b', 'c', 'd']) await boards.createIntakeRoute(scope, route(name), 'u');
    const ids = (await boards.listIntakeRoutes(scope)).map(row => row.id);
    const reversed = [...ids].reverse();
    const rotated = [...ids.slice(1), ids[0]!];

    await Promise.all([
      boards.reorderIntakeRoutes(scope, reversed, 'user-1'),
      other.reorderIntakeRoutes(scope, rotated, 'user-2'),
    ]);

    const final = await names(boards, scope);
    expect([
      ['d', 'c', 'b', 'a'],
      ['b', 'c', 'd', 'a'],
    ]).toContainEqual(final);
  });

  it('keeps positions whole when clients add, delete and reorder routes at once', async () => {
    const { boards, scope, secondClient } = await setup();
    const other = await secondClient();
    for (const name of ['a', 'b', 'c']) await boards.createIntakeRoute(scope, route(name), 'u');
    const [a, b] = await boards.listIntakeRoutes(scope);

    await Promise.all([
      ...['x', 'y', 'z', 'w'].map((name, index) =>
        (index % 2 ? other : boards).createIntakeRoute(scope, route(name), 'u'),
      ),
      other.deleteIntakeRoute(scope, b!.id, { expectedRevision: 1 }),
      boards.updateIntakeRoute(scope, a!.id, { name: 'a2' }, { expectedRevision: 1, actor: 'u' }),
    ]);

    // `names` checks the positions run 0..n-1.
    expect((await names(boards, scope)).sort()).toEqual(['a2', 'c', 'w', 'x', 'y', 'z']);
  });

  it('leaves the board definition version alone', async () => {
    const { boards, scope } = await setup();
    const created = await boards.createIntakeRoute(scope, route('a'), 'u');
    await boards.updateIntakeRoute(scope, created.id, { name: 'b' }, { expectedRevision: 1, actor: 'u' });
    await boards.reorderIntakeRoutes(scope, [created.id], 'u');
    await boards.deleteIntakeRoute(scope, created.id, { expectedRevision: 2 });

    expect(await boards.readVersion(scope)).toBeNull();
  });
});
