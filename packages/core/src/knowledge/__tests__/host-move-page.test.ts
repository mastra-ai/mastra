import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../storage';
import type { MastraStorage } from '../../storage';
import { MastraVector } from '../../vector';
import type { MastraEmbeddingModel, QueryResult } from '../../vector';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import type { KnowledgeChangeEvent } from '../index';

/** Records which ids are embedded; enough of a vector store for writes. */
class RecordingVector extends MastraVector {
  rows = new Set<string>();
  indexes = new Set<string>();
  constructor() {
    super({ id: 'recording' });
  }
  async upsert({ ids }: any): Promise<string[]> {
    ids.forEach((id: string) => this.rows.add(id));
    return ids;
  }
  async deleteVectors({ ids }: any): Promise<void> {
    for (const id of ids ?? []) this.rows.delete(id);
  }
  async createIndex({ indexName }: any): Promise<void> {
    this.indexes.add(indexName);
  }
  async listIndexes(): Promise<string[]> {
    return [...this.indexes];
  }
  async query(): Promise<QueryResult[]> {
    return [];
  }
  async describeIndex(): Promise<any> {
    return { dimension: 2, count: this.rows.size, metric: 'cosine' };
  }
  async deleteIndex(): Promise<void> {}
  async updateVector(): Promise<void> {}
  async deleteVector(): Promise<void> {}
}

const embedder = {
  specificationVersion: 'v2',
  provider: 'test',
  modelId: 'flat',
  maxEmbeddingsPerCall: 1,
  supportsParallelCalls: true,
  doEmbed: async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => [1, 0]) }),
} as unknown as MastraEmbeddingModel<string>;

const memory = knowledgeMemoryScopes();

function setup(storage: MastraStorage = new InMemoryStore()) {
  const vector = new RecordingVector();
  const knowledge = new Knowledge({
    storage,
    vector,
    embedder,
    scopes: {
      ...memory,
      'org:$orgId': { ...memory['org:$orgId'], access: [{ principal: 'self', role: 'owner' }] },
      'docs:$orgId': {
        belongsTo: 'org:$orgId',
        access: [{ principal: 'org:$orgId', role: 'viewer' }],
        pages: [{ key: 'start', name: 'Start here' }],
      },
    },
  });
  const store = async () => (await storage.getStore('knowledge'))!;
  const at = async (scope: string, path: string) => {
    const s = await store();
    const [scopePage] = await s.getScopesByAddress([scope]);
    return scopePage ? s.getPageByPath({ scopeId: scopePage.id, path: path.split('/'), read: 'all' }) : null;
  };
  return { knowledge, storage, vector, store, at };
}

describe('Knowledge.movePage (host)', () => {
  it('re-parents a page keeping its id, notes, pins and vectors, and moves its subtree paths', async () => {
    const { knowledge, vector, store, at } = setup();
    const page = (await knowledge.upsertPage({ scope: 'org:acme', path: 'inbox/plan', name: 'Plan', body: 'p' })).page;
    const child = (await knowledge.upsertPage({ scope: 'org:acme', path: 'inbox/plan/step', name: 'Step', body: 's' }))
      .page;
    await knowledge.upsertPage({ scope: 'org:acme', path: 'projects/q4', name: 'Q4' });
    const note = await knowledge.addNote({ scope: 'org:acme', path: 'inbox/plan', text: 'Owned by Ada.' });
    await (await store()).addPinAudience({ pageId: page.id, audience: ['org:acme'], createdBy: 'host' });
    const events: KnowledgeChangeEvent[] = [];
    knowledge.onChange(event => void events.push(event));

    const moved = await knowledge.movePage({ scope: 'org:acme', path: 'inbox/plan', parent: 'projects/q4' });

    expect(moved.id).toBe(page.id);
    expect(moved.version).toBe(page.version + 1);
    expect((await at('org:acme', 'projects/q4/plan'))?.id).toBe(page.id);
    expect((await at('org:acme', 'projects/q4/plan/step'))?.id).toBe(child.id);
    expect(await at('org:acme', 'inbox/plan')).toBeNull();
    const s = await store();
    expect((await s.listNotes({ pageId: page.id, read: 'all' })).notes.map(n => n.id)).toEqual([note.id]);
    expect((await s.listPins({ audience: 'all', read: 'all' })).pins.map(pin => pin.pageId)).toEqual([page.id]);
    expect([...vector.rows]).toEqual(
      expect.arrayContaining([`page:${page.id}`, `page:${child.id}`, `note:${note.id}`]),
    );
    expect(events).toEqual([expect.objectContaining({ kind: 'page', op: 'move', pageId: page.id })]);
  });

  it('moves to the top of the scope when parent is left out, and checks expectedVersion', async () => {
    const { knowledge, at } = setup();
    const page = (await knowledge.upsertPage({ scope: 'org:acme', path: 'a/b', name: 'B' })).page;
    await expect(
      knowledge.movePage({ scope: 'org:acme', path: 'a/b', expectedVersion: page.version + 5 }),
    ).rejects.toThrow();
    const moved = await knowledge.movePage({ scope: 'org:acme', path: 'a/b', expectedVersion: page.version });
    expect(moved.id).toBe(page.id);
    expect((await at('org:acme', 'b'))?.id).toBe(page.id);
  });

  it('moves a page and its subtree to another scope', async () => {
    const { knowledge, at } = setup();
    const page = (await knowledge.upsertPage({ scope: 'org:acme', path: 'draft', name: 'Draft' })).page;
    const child = (await knowledge.upsertPage({ scope: 'org:acme', path: 'draft/part', name: 'Part' })).page;
    const moved = await knowledge.movePage({ scope: 'org:acme', path: 'draft', toScope: 'docs:acme' });
    expect(moved.id).toBe(page.id);
    expect((await at('docs:acme', 'draft/part'))?.id).toBe(child.id);
    expect(await at('org:acme', 'draft')).toBeNull();
  });

  it('refreshes links by path for the moved subtree', async () => {
    const { knowledge, store } = setup();
    const hub = (
      await knowledge.upsertPage({
        scope: 'org:acme',
        path: 'hub',
        name: 'Hub',
        body: 'See [[org:acme#new/doc/part]].',
      })
    ).page;
    await knowledge.upsertPage({ scope: 'org:acme', path: 'old/doc', name: 'Doc' });
    const part = (await knowledge.upsertPage({ scope: 'org:acme', path: 'old/doc/part', name: 'Part' })).page;
    await knowledge.upsertPage({ scope: 'org:acme', path: 'new', name: 'New' });
    const out = async () =>
      (await (await store()).listPageLinks({ pageIds: [hub.id], read: 'all', direction: 'out' })).map(l => l.toPageId);
    expect(await out()).toEqual([]);
    await knowledge.movePage({ scope: 'org:acme', path: 'old/doc', parent: 'new' });
    expect(await out()).toEqual([part.id]);
  });

  it('re-resolves name links held by every page the move carries to another scope', async () => {
    const { knowledge, store } = setup();
    await knowledge.upsertPage({ scope: 'org:acme', path: 'target', name: 'Target' });
    const there = (await knowledge.upsertPage({ scope: 'docs:acme', path: 'target', name: 'Target' })).page;
    await knowledge.upsertPage({ scope: 'org:acme', path: 'doc', name: 'Doc' });
    const child = (
      await knowledge.upsertPage({ scope: 'org:acme', path: 'doc/child', name: 'Child', body: 'See [[Target]].' })
    ).page;
    await knowledge.movePage({ scope: 'org:acme', path: 'doc', toScope: 'docs:acme' });
    const out = (await (await store()).listPageLinks({ pageIds: [child.id], read: 'all', direction: 'out' })).map(
      l => l.toPageId,
    );
    expect(out).toEqual([there.id]);
  });

  it('drops a name link the move makes ambiguous, even when it pointed at a page that stayed', async () => {
    const { knowledge, store } = setup();
    await knowledge.upsertPage({ scope: 'org:acme', path: 'target', name: 'Target' });
    const hub = (await knowledge.upsertPage({ scope: 'org:acme', path: 'hub', name: 'Hub', body: 'See [[Target]].' }))
      .page;
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'target', name: 'Target' });
    const out = async () =>
      (await (await store()).listPageLinks({ pageIds: [hub.id], read: 'all', direction: 'out' })).map(l => l.toPageId);
    expect(await out()).toHaveLength(1);
    await knowledge.movePage({ scope: 'docs:acme', path: 'target', toScope: 'org:acme', parent: 'hub' });
    expect(await out()).toEqual([]);
  });

  it('throws clear errors for a missing page, a missing parent, a declared page and its own subtree', async () => {
    const { knowledge } = setup();
    await knowledge.upsertPage({ scope: 'org:acme', path: 'a/b', name: 'B' });
    await expect(knowledge.movePage({ scope: 'org:acme', path: 'nope' })).rejects.toThrow(
      'Knowledge page not found: org:acme#nope',
    );
    await expect(knowledge.movePage({ scope: 'org:acme', path: 'a', parent: 'missing/x' })).rejects.toThrow(
      'Knowledge page not found: org:acme#missing/x',
    );
    await expect(knowledge.movePage({ scope: 'org:acme', path: 'a', parent: 'a/b' })).rejects.toThrow(
      `"org:acme#a" can't move under itself or its own subtree.`,
    );
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'start', name: 'Start here' });
    await expect(knowledge.movePage({ scope: 'docs:acme', path: 'start', parent: '' })).rejects.toThrow(
      '"docs:acme#start" is declared in config; change the scope\'s pages to move it.',
    );
  });

  it('refuses a key the new parent already has', async () => {
    const { knowledge } = setup();
    await knowledge.upsertPage({ scope: 'org:acme', path: 'a/plan', name: 'Plan A' });
    await knowledge.upsertPage({ scope: 'org:acme', path: 'b/plan', name: 'Plan B' });
    await expect(knowledge.movePage({ scope: 'org:acme', path: 'a/plan', parent: 'b' })).rejects.toThrow(
      '"org:acme#b" already has a page with key "plan"; move or rename that one first.',
    );
  });

  it('refuses a move past the depth limit', async () => {
    const { knowledge } = setup();
    const deep = Array.from({ length: 9 }, (_, i) => `k${i}`).join('/');
    await knowledge.upsertPage({ scope: 'org:acme', path: deep, name: 'Deep' });
    await knowledge.upsertPage({ scope: 'org:acme', path: 'x/y', name: 'Y' });
    await expect(knowledge.movePage({ scope: 'org:acme', path: 'x', parent: deep })).rejects.toThrow(
      /more than 10 levels/,
    );
  });
});
