import { describe, expect, it } from 'vitest';
import { KnowledgeStorage } from './base';
import { InMemoryKnowledgeStorage } from './inmemory';
import { MAX_KNOWLEDGE_PAGE_DEPTH } from './pages';
import type { KnowledgeReadScope } from './pages';

/** The base class's `getPageParents`, as MySQL, MongoDB and the hosted store run it: one `getPage` per level. */
class LevelByLevel extends InMemoryKnowledgeStorage {
  override getPageParents(input: Parameters<KnowledgeStorage['getPageParents']>[0]) {
    return KnowledgeStorage.prototype.getPageParents.call(this, input);
  }
}

describe('KnowledgeStorage.getPageParents default', () => {
  it('returns what the in-memory store returns for a full-depth chain, a deleted row and each read filter', async () => {
    const store = new LevelByLevel();
    const provenance = { author: 'host' };
    const { scope } = await store.materializeScope({
      address: 'org:acme',
      declaration: 'org:$orgId',
      name: 'Acme',
      provenance,
    });
    let parentId = scope.id;
    const chain: string[] = [];
    for (let level = 1; level <= MAX_KNOWLEDGE_PAGE_DEPTH; level++) {
      const page = await store.createPage({ parentId, name: `Level ${level}`, key: `l${level}`, provenance });
      chain.unshift(page.id);
      parentId = page.id;
    }
    const deleted = await store.createPage({ parentId: chain[1]!, name: 'Gone', key: 'gone', provenance });
    await store.deletePage({ id: deleted.id, expectedVersion: 1, deletedBy: 'host' });

    const reads: KnowledgeReadScope[] = [
      'all',
      { addresses: ['org:acme'], prefixes: [], children: [] },
      { addresses: ['org:globex'], prefixes: [], children: [] },
    ];
    for (const read of reads) {
      for (const id of [chain[0]!, deleted.id, scope.id, 'missing']) {
        const expected = await InMemoryKnowledgeStorage.prototype.getPageParents.call(store, { parentId: id, read });
        expect(await store.getPageParents({ parentId: id, read })).toEqual(expected);
      }
    }
    const full = await store.getPageParents({ parentId: chain[0]!, read: 'all' });
    expect(full.map(page => page.id)).toEqual([...chain, scope.id]);
    expect((await store.getPageParents({ parentId: deleted.id, read: 'all' }))[0]?.deletedAt).toBeTruthy();
  });
});
