import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { IntakeOrderMigration, StoredBoardScope, StoredIntakeRouteInput } from '../storage/domains/boards/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { defineBoard } from './define-board.js';
import { IntakeOrderMeasure } from './intake-order-migration.js';
import { boardRegistryOf } from './registry.js';

const simple = (id: string) =>
  defineBoard({
    id,
    name: id.toUpperCase(),
    initialPhase: 'inbox',
    phases: { inbox: { name: 'Inbox', kind: 'resting' }, done: { name: 'Done', kind: 'terminal' } },
  });
const registry = boardRegistryOf([simple('work'), simple('ship')]);

const labelled = (boardKey: string, label: string): StoredIntakeRouteInput => ({
  name: `${boardKey} ${label}`,
  target: { boardKey },
  when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: label }] },
});
const everything = (boardKey: string): StoredIntakeRouteInput => ({ name: `${boardKey} all`, target: { boardKey } });

/** The facts intake reads of a card: its title, labels and source. */
const card = (labels: string[]) =>
  ({
    title: 'Card',
    metadata: { labels },
    externalSource: { integrationId: 'github', type: 'issue', externalId: randomUUID() },
  }) as unknown as Card;

async function project(routes: StoredIntakeRouteInput[]) {
  const { boards } = await createFactoryStorageForTests();
  const scope: StoredBoardScope = { orgId: `org-${randomUUID()}`, factoryProjectId: 'project-1' };
  for (const seeded of (await boards.listIntakeRoutes(scope)).reverse()) {
    await boards.deleteIntakeRoute(scope, seeded.id, { expectedRevision: seeded.revision });
  }
  for (const key of ['work', 'ship']) {
    await boards.create(scope, { key, name: key, phases: [{ key: 'inbox', name: 'Inbox', kind: 'resting' }] }, 'a');
  }
  for (const route of routes) await boards.createIntakeRoute(scope, route, 'admin');
  return { boards, scope };
}

function measureWith(
  boards: Awaited<ReturnType<typeof project>>['boards'],
  cards: Card[],
  beforeCompare: () => Promise<void> = async () => {},
) {
  const audited: IntakeOrderMigration[] = [];
  const measure = new IntakeOrderMeasure({
    storage: boards,
    cards: async () => {
      await beforeCompare();
      return cards;
    },
    boards: async () => registry,
    // Like the audit domain, one entry per measured order however often it is asked.
    audit: async (_scope, migration) => {
      if (!audited.some(entry => entry.startedAt === migration.startedAt)) audited.push(migration);
    },
  });
  return { measure, audited };
}

describe('IntakeOrderMeasure', () => {
  it('finds no difference on a project whose boards’ routes sit together', async () => {
    const { boards, scope } = await project([labelled('ship', 'ship'), labelled('work', 'bug'), everything('work')]);
    const { measure, audited } = measureWith(boards, [card(['ship']), card(['bug']), card([])]);

    expect(await measure.measure(scope)).toMatchObject({ compared: 3, differing: 0, notRouted: 0 });
    expect(audited).toHaveLength(1);
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['ship', 'work']);
  });

  it('counts exactly the cards an interleaved project would now place elsewhere, and those no board takes', async () => {
    // Work's `bug` route comes first, so Work is checked first, and its catch-all takes `ship` cards.
    const { boards, scope } = await project([labelled('work', 'bug'), labelled('ship', 'ship'), everything('work')]);
    const cards = [card(['ship']), card(['ship', 'x']), card(['bug']), card([])];
    const { measure } = measureWith(boards, cards);
    expect(await measure.measure(scope)).toMatchObject({ compared: 4, differing: 2, notRouted: 0 });

    const { boards: other, scope: otherScope } = await project([labelled('ship', 'ship')]);
    // The old evaluator filed both on Work; now neither is routed.
    const { measure: second } = measureWith(other, [card(['ship']), card(['docs']), card([])]);
    expect(await second.measure(otherScope)).toMatchObject({ compared: 3, differing: 2, notRouted: 2 });
  });

  it('runs once per project, across replicas and restarts', async () => {
    const { boards, scope } = await project([everything('work')]);
    const first = measureWith(boards, [card([])]);
    const second = measureWith(boards, [card([])]);

    const results = await Promise.all([first.measure.measure(scope), second.measure.measure(scope)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await measureWith(boards, [card([])]).measure.measure(scope)).toBeNull();
    expect([...first.audited, ...second.audited]).toHaveLength(1);
  });

  it('writes the audit entry on a later start when writing it failed', async () => {
    const { boards, scope } = await project([labelled('work', 'bug')]);
    const audited: IntakeOrderMigration[] = [];
    let failing = true;
    const measure = () =>
      new IntakeOrderMeasure({
        storage: boards,
        cards: async () => [card(['bug'])],
        boards: async () => registry,
        audit: async (_scope, migration) => {
          if (failing) throw new Error('audit storage unavailable');
          if (!audited.some(entry => entry.startedAt === migration.startedAt)) audited.push(migration);
        },
        warn: () => {},
      });
    const first = measure();
    await expect(first.measure(scope)).rejects.toThrow('audit storage unavailable');
    expect((await boards.readIntakeOrder(scope)).migration).toMatchObject({ compared: 1 });

    failing = false;
    // Still not done on the replica that failed, nor on a fresh one; the entry is written once.
    expect(await first.measure(scope)).toBeNull();
    expect(await measure().measure(scope)).toBeNull();
    expect(audited).toMatchObject([{ compared: 1, differing: 0 }]);
  });

  it('compares only the newest 200 cards', async () => {
    const { boards, scope } = await project([everything('work')]);
    const { measure } = measureWith(
      boards,
      Array.from({ length: 250 }, () => card([])),
    );
    expect(await measure.measure(scope)).toMatchObject({ compared: 200 });
  });

  it('follows the route list while the order is derived, and stops once someone sets it', async () => {
    const { boards, scope } = await project([labelled('ship', 'ship'), labelled('work', 'bug'), everything('work')]);
    const { measure, audited } = measureWith(boards, [card(['ship']), card(['ship', 'x']), card(['bug'])]);
    expect(await measure.measure(scope)).toMatchObject({ differing: 0 });

    // Work's `bug` rule moves ahead of Ship's in the old list: Work is now asked first, and its
    // catch-all takes the `ship` cards. The derived order and the count follow.
    const [ship, bug, all] = await boards.listIntakeRoutes(scope);
    await boards.reorderIntakeRoutes(scope, [bug!.id, ship!.id, all!.id], 'admin');
    expect(await measure.restart(scope)).toMatchObject({ compared: 3, differing: 2 });
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['work', 'ship']);
    expect(audited.map(entry => entry.differing)).toEqual([0, 2]);

    // Set: rule writes no longer move the order or measure it again.
    await boards.setIntakeOrder(scope, ['ship', 'work']);
    await boards.reorderIntakeRoutes(scope, [ship!.id, bug!.id, all!.id], 'admin');
    expect(await measure.restart(scope)).toBeNull();
    expect(await boards.readIntakeOrder(scope)).toMatchObject({
      boardKeys: ['ship', 'work'],
      origin: 'explicit',
      migration: { differing: 2 },
    });
    expect(audited).toHaveLength(2);
  });

  it('compares with the order as it stands once claimed, when a rule write lands just before the claim', async () => {
    const { boards, scope } = await project([labelled('ship', 'ship'), labelled('work', 'bug'), everything('work')]);
    const [ship, bug, all] = await boards.listIntakeRoutes(scope);
    let moved = false;
    const storage = {
      readIntakeOrder: boards.readIntakeOrder.bind(boards),
      listIntakeRoutes: boards.listIntakeRoutes.bind(boards),
      recordIntakeOrderMigration: boards.recordIntakeOrderMigration.bind(boards),
      // Work's `bug` rule moves ahead of Ship's after the order was read, before the claim.
      claimIntakeOrderMigration: async (claimScope: StoredBoardScope) => {
        if (!moved) {
          moved = true;
          await boards.reorderIntakeRoutes(scope, [bug!.id, ship!.id, all!.id], 'admin');
        }
        return boards.claimIntakeOrderMigration(claimScope);
      },
    };
    const measure = new IntakeOrderMeasure({
      storage,
      cards: async () => [card(['ship']), card(['ship', 'x']), card(['bug'])],
      boards: async () => registry,
      audit: async () => {},
    });

    expect(await measure.measure(scope)).toMatchObject({ compared: 3, differing: 2 });
    expect((await boards.readIntakeOrder(scope)).boardKeys).toEqual(['work', 'ship']);
  });

  it('measures again when a rule write lands while it compares, keeping only the fresh result', async () => {
    const { boards, scope } = await project([labelled('ship', 'ship'), labelled('work', 'bug'), everything('work')]);
    let writes = 0;
    const { measure, audited } = measureWith(boards, [card(['ship'])], async () => {
      if (writes++ > 0) return;
      const [ship, bug, all] = await boards.listIntakeRoutes(scope);
      await boards.reorderIntakeRoutes(scope, [bug!.id, ship!.id, all!.id], 'admin');
    });

    expect(await measure.measure(scope)).toMatchObject({ compared: 1, differing: 1 });
    expect(audited).toEqual([expect.objectContaining({ differing: 1 })]);
    expect((await boards.readIntakeOrder(scope)).migration).toMatchObject({ differing: 1 });
  });
});
