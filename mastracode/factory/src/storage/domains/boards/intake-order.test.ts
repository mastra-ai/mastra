import { randomUUID } from 'node:crypto';

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
    const boards = await open(':memory:');
    const scope: StoredBoardScope = { orgId: `org-${randomUUID()}`, factoryProjectId: 'project-1' };
    for (const seeded of (await boards.listIntakeRoutes(scope)).reverse()) {
      await boards.deleteIntakeRoute(scope, seeded.id, { expectedRevision: seeded.revision });
    }
    for (const key of keys) await boards.create(scope, board(key), 'admin');
    return { boards, scope };
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

  it('re-derives a derived order on every rule write until someone sets the order', async () => {
    const { boards, scope } = await setup(['work', 'ship']);
    const ship = await boards.createIntakeRoute(scope, labelled('ship', 'ship'), 'admin');
    const work = await boards.createIntakeRoute(scope, catchAll('work'), 'admin');
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['ship', 'work']);

    // Moving work's rules first in the old list moves work first in a derived order.
    await boards.reorderIntakeRoutes(scope, [work.id, ship.id], 'admin');
    expect(await boards.readIntakeOrder(scope)).toEqual({ boardKeys: ['work', 'ship'], origin: 'derived' });

    // An update re-derives too: with its only rule off, ship has no placing rule and follows in sidebar order.
    await boards.reorderIntakeRoutes(scope, [ship.id, work.id], 'admin');
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['ship', 'work']);
    const [current] = await boards.listIntakeRoutes(scope, { boardKey: 'ship' });
    await boards.updateIntakeRoute(
      scope,
      current!.id,
      { enabled: false },
      { expectedRevision: current!.revision, actor: 'admin' },
    );
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['work', 'ship']);

    // Once set, the order is the admin's: rule writes leave it alone.
    expect(await boards.setIntakeOrder(scope, ['ship', 'work'])).toEqual({
      boardKeys: ['ship', 'work'],
      origin: 'explicit',
    });
    const routes = await boards.listIntakeRoutes(scope);
    await boards.reorderIntakeRoutes(
      scope,
      [...routes].reverse().map(route => route.id),
      'admin',
    );
    await boards.createIntakeRoute(scope, labelled('work', 'x'), 'admin');
    expect(await boards.readIntakeOrder(scope)).toEqual({ boardKeys: ['ship', 'work'], origin: 'explicit' });
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

  it('counts placed items per rule over a window, across pages, ignoring Not routed and other projects', async () => {
    const { boards, scope } = await setup(['work']);
    const now = new Date(Date.UTC(2026, 10, 30));
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
    const placed = (key: string, routeId: string | undefined, at: Date, where = scope) =>
      boards.recordIntakeDecision(
        where,
        { idempotencyKey: key, outcome: 'placed', evaluator: 'intake-order', title: key, boardKey: 'work', routeId },
        at,
      );
    for (let n = 0; n < 7; n++) await placed(`a${n}`, 'route-a', daysAgo(n));
    await placed('b1', 'route-b', daysAgo(29));
    await placed('b-old', 'route-b', daysAgo(31));
    await placed('manual', undefined, daysAgo(1));
    await boards.recordIntakeDecision(
      scope,
      { idempotencyKey: 'n1', outcome: 'not_routed', evaluator: 'intake-order', title: 'n1' },
      daysAgo(1),
    );
    await placed('other', 'route-a', daysAgo(1), { ...scope, factoryProjectId: 'project-2' });

    const since = daysAgo(30);
    expect(await boards.countPlacedByRoute(scope, since, { pageSize: 3 })).toEqual({ 'route-a': 7, 'route-b': 1 });
    expect(await boards.countPlacedByRoute(scope, since)).toEqual({ 'route-a': 7, 'route-b': 1 });
  });
});
