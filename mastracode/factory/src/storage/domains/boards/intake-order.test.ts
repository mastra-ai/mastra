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

  it('counts a board as ending in a catch-all only once its unconditional rules take issues and pull requests', async () => {
    const { boards, scope } = await setup(['ship', 'work']);
    await boards.createIntakeRoute(scope, labelled('ship', 'ship'), 'admin');
    await boards.createIntakeRoute(scope, { ...catchAll('work'), on: ['work_item.opened'] }, 'admin');
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['ship', 'work']);
    // Pull requests still fall through Work, so a new board goes last.
    await boards.create(scope, board('docs'), 'admin');
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['ship', 'work', 'docs']);

    await boards.createIntakeRoute(
      scope,
      { name: 'work pull requests', target: { boardKey: 'work' }, when: null, on: ['pull_request.opened'] },
      'admin',
    );
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['ship', 'work', 'docs']);
    await boards.create(scope, board('ops'), 'admin');
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['ship', 'ops', 'work', 'docs']);
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
