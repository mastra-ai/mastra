import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { StoredBoardsStorage } from './base.js';
import type { StoredBoardInput, StoredBoardScope, StoredIntakeRouteInput } from './base.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

function board(key: string): StoredBoardInput {
  return {
    key,
    name: key.toUpperCase(),
    phases: [
      { key: 'intake', name: 'Intake', kind: 'resting' },
      { key: 'done', name: 'Done', kind: 'terminal' },
    ],
  };
}

function labelled(boardKey: string, label: string): StoredIntakeRouteInput {
  return {
    name: `${boardKey} ${label}`,
    target: { boardKey },
    when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: label }] },
  };
}

function catchAll(boardKey: string): StoredIntakeRouteInput {
  return { name: `${boardKey} everything`, target: { boardKey }, when: null };
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('intake order on %s', backend => {
  async function open(url: string) {
    const storage =
      backend === 'postgres'
        ? new PgFactoryStorage({ id: `intake-order-${randomUUID()}`, connectionString: postgresUrl! })
        : new LibSQLFactoryStorage({ id: `intake-order-${randomUUID()}`, url });
    const boards = storage.registerDomain(new StoredBoardsStorage());
    await storage.init();
    onTestFinished(() => storage.close());
    return boards;
  }

  /** A project with boards `keys` (sidebar order) and no routes. */
  async function setup(keys: string[]) {
    let url = ':memory:';
    if (backend === 'libsql') {
      const dir = mkdtempSync(join(tmpdir(), 'factory-intake-order-'));
      onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
      url = `file:${join(dir, 'order.db')}`;
    }
    const boards = await open(url);
    const scope: StoredBoardScope = { orgId: `org-${randomUUID()}`, factoryProjectId: 'project-1' };
    for (const seeded of (await boards.listIntakeRoutes(scope)).reverse()) {
      await boards.deleteIntakeRoute(scope, seeded.id, { expectedRevision: seeded.revision });
    }
    for (const key of keys) await boards.create(scope, board(key), 'admin');
    return { boards, scope, secondClient: () => open(url) };
  }

  it('derives the order once from each board’s first placing route, then boards with none in sidebar order', async () => {
    const { boards, scope } = await setup(['work', 'ship', 'docs', 'ops']);
    await boards.createIntakeRoute(scope, labelled('ship', 'ship'), 'admin');
    await boards.createIntakeRoute(scope, { ...labelled('ops', 'off'), enabled: false }, 'admin');
    await boards.createIntakeRoute(scope, labelled('work', 'bug'), 'admin');
    await boards.createIntakeRoute(scope, catchAll('work'), 'admin');

    expect(await boards.readIntakeOrder(scope)).toMatchObject({
      boardKeys: ['ship', 'work', 'docs', 'ops'],
      origin: 'derived',
    });
  });

  it('re-derives a derived order, and drops its measure, on every rule write until someone sets the order', async () => {
    const { boards, scope } = await setup(['work', 'ship']);
    const ship = await boards.createIntakeRoute(scope, labelled('ship', 'ship'), 'admin');
    const work = await boards.createIntakeRoute(scope, catchAll('work'), 'admin');
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['ship', 'work']);
    expect(await boards.claimIntakeOrderMigration(scope)).not.toBeNull();
    await boards.recordIntakeOrderMigration(scope, { compared: 5, differing: 0, notRouted: 0 });

    // Moving work's rules first in the old list moves work first in a derived order.
    await boards.reorderIntakeRoutes(scope, [work.id, ship.id], 'admin');
    expect(await boards.readIntakeOrder(scope)).toEqual({
      boardKeys: ['work', 'ship'],
      origin: 'derived',
      migration: null,
    });

    // Create, update and delete re-derive too.
    await boards.recordIntakeOrderMigration(scope, { compared: 5, differing: 1, notRouted: 0 });
    const [, current] = await boards.listIntakeRoutes(scope);
    await boards.updateIntakeRoute(
      scope,
      current!.id,
      { name: 'ship it' },
      { expectedRevision: current!.revision, actor: 'admin' },
    );
    expect((await boards.readIntakeOrder(scope)).migration).toBeNull();
    await boards.recordIntakeOrderMigration(scope, { compared: 5, differing: 1, notRouted: 0 });
    const extra = await boards.createIntakeRoute(scope, labelled('ship', 'x'), 'admin');
    expect((await boards.readIntakeOrder(scope)).migration).toBeNull();
    await boards.recordIntakeOrderMigration(scope, { compared: 5, differing: 1, notRouted: 0 });
    await boards.deleteIntakeRoute(scope, extra.id, { expectedRevision: extra.revision });
    expect((await boards.readIntakeOrder(scope)).migration).toBeNull();

    // Once set, the order is the admin's: rule writes leave it and its measure alone.
    expect(await boards.setIntakeOrder(scope, ['ship', 'work'])).toMatchObject({ origin: 'explicit' });
    await boards.recordIntakeOrderMigration(scope, { compared: 5, differing: 1, notRouted: 0 });
    const routes = await boards.listIntakeRoutes(scope);
    await boards.reorderIntakeRoutes(
      scope,
      [...routes].reverse().map(route => route.id),
      'admin',
    );
    expect(await boards.readIntakeOrder(scope)).toMatchObject({
      boardKeys: ['ship', 'work'],
      origin: 'explicit',
      migration: { compared: 5, differing: 1 },
    });
  });

  it('drops the result of a measure whose order was re-derived while it ran', async () => {
    const { boards, scope } = await setup(['work']);
    await boards.createIntakeRoute(scope, catchAll('work'), 'admin');
    const claimed = await boards.claimIntakeOrderMigration(scope);
    expect(claimed).toEqual(expect.any(String));
    await boards.createIntakeRoute(scope, labelled('work', 'bug'), 'admin');

    expect(
      await boards.recordIntakeOrderMigration(
        scope,
        { compared: 1, differing: 0, notRouted: 0 },
        { claimed: claimed! },
      ),
    ).toBeNull();
    expect((await boards.readIntakeOrder(scope)).migration).toBeNull();
  });

  it('puts a new board just above the first board ending in a catch-all, and last when none does', async () => {
    const { boards, scope } = await setup(['ship', 'work']);
    await boards.createIntakeRoute(scope, labelled('ship', 'ship'), 'admin');
    await boards.createIntakeRoute(scope, catchAll('work'), 'admin');
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['ship', 'work']);

    await boards.create(scope, board('docs'), 'admin');
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['ship', 'docs', 'work']);

    // Chosen, so disabling the catch-all leaves the order as it is.
    await boards.setIntakeOrder(scope, ['ship', 'docs', 'work']);
    const [workCatchAll] = await boards.listIntakeRoutes(scope, { boardKey: 'work' });
    await boards.updateIntakeRoute(
      scope,
      workCatchAll!.id,
      { enabled: false },
      {
        expectedRevision: workCatchAll!.revision,
        actor: 'admin',
      },
    );
    await boards.create(scope, board('ops'), 'admin');
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['ship', 'docs', 'work', 'ops']);
  });

  it('sets an order naming every board once, and refuses any other', async () => {
    const { boards, scope } = await setup(['work', 'ship']);
    expect((await boards.setIntakeOrder(scope, ['ship', 'work'])).boardKeys).toEqual(['ship', 'work']);
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['ship', 'work']);
    for (const keys of [['ship'], ['ship', 'work', 'work'], ['ship', 'nope']]) {
      await expect(boards.setIntakeOrder(scope, keys)).rejects.toMatchObject({ code: 'intake_order_set_mismatch' });
    }
  });

  it('keeps a code board where the order put it when the caller names it', async () => {
    const { boards, scope } = await setup(['work', 'ship']);
    const registry = ['work', 'ship', 'desk'];
    await boards.setIntakeOrder(scope, ['desk', 'work', 'ship'], { boards: registry });
    expect((await boards.readIntakeOrder(scope, { boards: registry })).boardKeys).toEqual(['desk', 'work', 'ship']);
    expect((await boards.readIntakeOrder(scope, { boards: registry })).boardKeys).toEqual(['desk', 'work', 'ship']);
  });

  it('deletes a board’s rules with it, closes the gaps, and takes it out of the order', async () => {
    const { boards, scope } = await setup(['work', 'ship']);
    await boards.createIntakeRoute(scope, labelled('work', 'a'), 'admin');
    const shipRoute = await boards.createIntakeRoute(scope, labelled('ship', 'b'), 'admin');
    await boards.createIntakeRoute(scope, catchAll('work'), 'admin');
    await boards.setIntakeOrder(scope, ['ship', 'work']);

    const ship = (await boards.get(scope, 'ship'))!;
    const { intakeRoutes } = await boards.delete(scope, 'ship', { expectedRevision: ship.revision });

    expect(intakeRoutes.map(route => route.id)).toEqual([shipRoute.id]);
    const left = await boards.listIntakeRoutes(scope);
    expect(left.map(route => [route.name, route.position])).toEqual([
      ['work a', 0],
      ['work everything', 1],
    ]);
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['work']);
  });

  it('reorders one board’s rules within the places they hold, leaving other boards’ rules where they are', async () => {
    const { boards, scope } = await setup(['work', 'ship']);
    const a = await boards.createIntakeRoute(scope, labelled('work', 'a'), 'admin');
    const s = await boards.createIntakeRoute(scope, labelled('ship', 's'), 'admin');
    const b = await boards.createIntakeRoute(scope, labelled('work', 'b'), 'admin');

    const work = await boards.reorderIntakeRoutes(scope, [b.id, a.id], 'admin', { boardKey: 'work' });
    expect(work.map(route => route.id)).toEqual([b.id, a.id]);
    expect((await boards.listIntakeRoutes(scope)).map(route => route.id)).toEqual([b.id, s.id, a.id]);

    await expect(
      boards.reorderIntakeRoutes(scope, [b.id, a.id, s.id], 'admin', { boardKey: 'work' }),
    ).rejects.toMatchObject({ code: 'intake_route_set_mismatch' });
  });

  it('lets exactly one replica claim the migration measure, and keeps what it found', async () => {
    const { boards, scope, secondClient } = await setup(['work']);
    const other = await secondClient();
    const claims = await Promise.all([boards.claimIntakeOrderMigration(scope), other.claimIntakeOrderMigration(scope)]);
    expect(claims.filter(claim => claim !== null)).toHaveLength(1);

    await boards.recordIntakeOrderMigration(scope, { compared: 200, differing: 3, notRouted: 1 });
    expect(await other.claimIntakeOrderMigration(scope)).toBeNull();
    expect((await other.readIntakeOrder(scope)).migration).toMatchObject({ compared: 200, differing: 3, notRouted: 1 });
  });

  it('takes over a claim whose holder never finished', async () => {
    const { boards, scope } = await setup(['work']);
    const start = new Date('2026-11-01T00:00:00Z');
    expect(await boards.claimIntakeOrderMigration(scope, start)).toBe(start.toISOString());
    expect(await boards.claimIntakeOrderMigration(scope, new Date(start.getTime() + 60_000))).toBeNull();
    const later = new Date(start.getTime() + 11 * 60_000);
    expect(await boards.claimIntakeOrderMigration(scope, later)).toBe(later.toISOString());
  });

  it('logs one decision per arrival, lists unresolved Not routed items, and resolves them when a card is filed', async () => {
    const { boards, scope } = await setup(['work']);
    const notRouted = {
      outcome: 'not_routed' as const,
      evaluator: 'intake-order' as const,
      title: 'Bug',
      sourceKey: 'gh:1',
    };
    await boards.recordIntakeDecision(scope, { ...notRouted, idempotencyKey: 'k1', arrival: { title: 'Bug' } });
    // A redelivery replaces the row instead of adding one.
    await boards.recordIntakeDecision(scope, { ...notRouted, idempotencyKey: 'k1', reason: 'again' });
    await boards.recordIntakeDecision(scope, {
      idempotencyKey: 'k2',
      outcome: 'placed',
      evaluator: 'intake-order',
      title: 'Feature',
      boardKey: 'work',
    });

    const { notRouted: listed, nextCursor } = await boards.listNotRouted(scope);
    expect(nextCursor).toBeNull();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ idempotencyKey: 'k1', reason: 'again', sourceKey: 'gh:1', resolvedAt: null });
    expect(await boards.getIntakeDecision(scope, listed[0]!.id)).toEqual(listed[0]);

    expect(await boards.resolveNotRouted(scope, 'gh:1', 'factory')).toBe(1);
    expect((await boards.listNotRouted(scope)).notRouted).toEqual([]);
    expect((await boards.getIntakeDecision(scope, listed[0]!.id))?.resolvedBy).toBe('factory');
  });

  it('pages Not routed items oldest first with a cursor', async () => {
    const { boards, scope } = await setup(['work']);
    const day = (n: number) => new Date(Date.UTC(2026, 10, n));
    for (const n of [3, 1, 2, 4, 5]) {
      await boards.recordIntakeDecision(
        scope,
        { idempotencyKey: `k${n}`, outcome: 'not_routed', evaluator: 'intake-order', title: `item ${n}` },
        day(n),
      );
    }
    const titles: string[][] = [];
    let cursor: string | undefined;
    do {
      const page = await boards.listNotRouted(scope, { limit: 2, ...(cursor ? { cursor } : {}) });
      titles.push(page.notRouted.map(item => item.title));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(titles).toEqual([['item 1', 'item 2'], ['item 3', 'item 4'], ['item 5']]);
    await expect(boards.listNotRouted(scope, { cursor: 'nonsense' })).rejects.toMatchObject({
      code: 'invalid_intake_cursor',
    });
  });
});
