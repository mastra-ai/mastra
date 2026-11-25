import { describe, expect, it } from 'vitest';

import { InMemoryKnowledgePageStore } from '../pages-inmemory';

const provenance = { author: 'host' };

async function seeded() {
  const store = new InMemoryKnowledgePageStore();
  const { scope } = await store.materializeScope({
    address: 'org:acme',
    declaration: 'org:acme',
    name: 'acme',
    parentId: null,
    provenance,
  });
  const one = await store.createPage({ parentId: scope.id, name: 'one', provenance });
  const two = await store.createPage({ parentId: scope.id, name: 'two', provenance });
  return { store, scope, one, two };
}

describe('InMemoryKnowledgePageStore oldest-first positions', () => {
  it('numbers restored events that have no position, in stored order, after the ones that do', async () => {
    const { store, scope, one, two } = await seeded();
    const snapshot = store.snapshot();
    // A snapshot from before positions existed.
    for (const event of snapshot.activity) delete event.position;
    const restored = new InMemoryKnowledgePageStore();
    restored.restore(snapshot);

    const all = await restored.listPageActivity({ read: 'all', order: 'asc' });
    expect(all.events.map(event => event.pageId)).toEqual([scope.id, one.id, two.id]);
    for (const event of all.events) expect(Number.isSafeInteger(Number(event.position))).toBe(true);

    const first = await restored.listPageActivity({ read: 'all', order: 'asc', limit: 1 });
    const rest = await restored.listPageActivity({ read: 'all', order: 'asc', after: first.nextCursor });
    expect(rest.events.map(event => event.pageId)).toEqual([one.id, two.id]);

    const three = await restored.createPage({ parentId: scope.id, name: 'three', provenance });
    const later = await restored.listPageActivity({ read: 'all', order: 'asc', after: rest.events.at(-1)!.position });
    expect(later.events.map(event => event.pageId)).toEqual([three.id]);
  });

  it('pages a restored snapshot that mixes events with and without a position in position order', async () => {
    const { store, scope, one, two } = await seeded();
    const snapshot = store.snapshot();
    // The scope event lost its position; the two page events kept theirs.
    delete snapshot.activity[0]!.position;
    const restored = new InMemoryKnowledgePageStore();
    restored.restore(snapshot);

    const seen: string[] = [];
    let after: string | undefined;
    for (let page = 0; page < 5; page++) {
      const { events, nextCursor } = await restored.listPageActivity({ read: 'all', order: 'asc', limit: 1, after });
      seen.push(...events.map(event => event.position!));
      if (!nextCursor) break;
      after = nextCursor;
    }
    expect(seen).toHaveLength(3);
    expect(seen.map(Number)).toEqual([...seen.map(Number)].sort((a, b) => a - b));
    const all = await restored.listPageActivity({ read: 'all', order: 'asc' });
    expect(all.events.map(event => event.pageId)).toEqual([scope.id, one.id, two.id]);
    // Every position is past what the snapshot held, so a reader holding an old one rereads rather than skips.
    expect(Number(all.events[0]!.position)).toBeGreaterThan(3);
  });

  it('refuses a position ahead of the feed', async () => {
    const { store } = await seeded();
    await expect(store.listPageActivity({ read: 'all', order: 'asc', after: '100' })).rejects.toThrow(
      /ahead of this feed/,
    );
    const { events } = await store.listPageActivity({ read: 'all', order: 'asc' });
    await expect(
      store.listPageActivity({ read: 'all', order: 'asc', after: events.at(-1)!.position }),
    ).resolves.toEqual({ events: [] });
  });
});
