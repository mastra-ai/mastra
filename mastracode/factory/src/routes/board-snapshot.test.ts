import { describe, expect, it } from 'vitest';

import type { Card } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { boardSnapshot } from './board-snapshot.js';

async function board(cards: number) {
  const { workItems } = await createFactoryStorageForTests();
  const scope = { orgId: 'org', factoryProjectId: 'project', userId: 'user' };
  const created: Card[] = [];
  for (let n = 0; n < cards; n++) {
    const { item } = await workItems.upsert({ ...scope, input: { title: `Card ${n}`, board: 'work', stages: ['intake'] } });
    created.push(item);
  }
  const encoded: string[] = [];
  const toWire = (card: Card) => {
    encoded.push(card.id);
    return { id: card.id, title: card.workItem.title, sessions: card.sessions };
  };
  const list = () => workItems.listShared({ orgId: scope.orgId, factoryProjectId: scope.factoryProjectId });
  /** The body as it is built without reusing anything. */
  const whole = (items: readonly Card[], running: string[] = [], parked: string[] = []) =>
    JSON.stringify({
      workItems: items.map(card => ({ id: card.id, title: card.workItem.title, sessions: card.sessions })),
      runningSessionIds: running,
      parkedSessionIds: parked,
    });
  return { workItems, scope, created, encoded, toWire, list, whole };
}

describe('board snapshot', () => {
  it('encodes only the card a write changed when the board is built again', async () => {
    const { workItems, scope, created, encoded, toWire, list, whole } = await board(6);
    const before = await list();
    const first = boardSnapshot(before, toWire, ['running'], []);
    expect(first.json).toBe(whole(before, ['running']));
    expect(encoded).toHaveLength(6);

    encoded.length = 0;
    await workItems.update({ ...scope, id: created[2]!.id, patch: { title: 'Renamed' } });
    const after = await list();
    const second = boardSnapshot(after, toWire, ['running'], []);

    expect(encoded).toEqual([created[2]!.id]);
    expect(second.json).toBe(whole(after, ['running']));
    expect(second.json).toContain('Renamed');
    expect(second.etag).not.toBe(first.etag);
  });

  it('encodes a created card alone and leaves a deleted one out', async () => {
    const { workItems, scope, created, encoded, toWire, list, whole } = await board(4);
    boardSnapshot(await list(), toWire, [], []);

    encoded.length = 0;
    const { item: added } = await workItems.upsert({
      ...scope,
      input: { title: 'Added', board: 'work', stages: ['intake'] },
    });
    await workItems.delete({ orgId: scope.orgId, id: created[0]!.id });
    const after = await list();
    const snapshot = boardSnapshot(after, toWire, [], ['parked']);

    expect(encoded).toEqual([added.id]);
    expect(snapshot.json).toBe(whole(after, [], ['parked']));
    expect(JSON.parse(snapshot.json).workItems.map((card: { id: string }) => card.id)).not.toContain(created[0]!.id);
  });
});
