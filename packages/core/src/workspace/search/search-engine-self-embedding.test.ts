import { describe, it, expect, vi } from 'vitest';

import { SearchEngine } from './search-engine';

function createSelfEmbeddingStore(queryResults: any[] = []) {
  return {
    isSelfEmbedding: true,
    createIndex: vi.fn(async () => {}),
    upsert: vi.fn(async () => {}),
    query: vi.fn(async () => queryResults),
    deleteVector: vi.fn(async () => {}),
  };
}

describe('SearchEngine with a self-embedding vector store', () => {
  it('rejects a vector store that cannot embed without an embedder', () => {
    const store: any = { upsert: vi.fn(), query: vi.fn(), deleteVector: vi.fn() };
    expect(() => new SearchEngine({ vector: { vectorStore: store, indexName: 'idx' } })).toThrow(
      /requires an embedder, or a vector store that generates embeddings itself/,
    );
  });

  it('indexes a document by sending its text, creating the index without a dimension', async () => {
    const store = createSelfEmbeddingStore();
    const engine = new SearchEngine({ vector: { vectorStore: store as any, indexName: 'idx' } });

    await engine.index({ id: 'doc1', content: 'Hello world', metadata: { path: 'a.md' } });
    await engine.index({ id: 'doc2', content: 'Second' });

    expect(store.createIndex).toHaveBeenCalledTimes(1);
    expect(store.createIndex).toHaveBeenCalledWith({ indexName: 'idx' });
    expect(store.upsert).toHaveBeenNthCalledWith(1, {
      indexName: 'idx',
      documents: ['Hello world'],
      metadata: [{ id: 'doc1', text: 'Hello world', path: 'a.md' }],
      ids: ['doc1'],
    });
    expect(store.upsert.mock.calls[0]![0]).not.toHaveProperty('vectors');
  });

  it('groups indexMany writes into upserts of at most 100 documents', async () => {
    const store = createSelfEmbeddingStore();
    const engine = new SearchEngine({ vector: { vectorStore: store as any, indexName: 'idx' } });
    const docs = Array.from({ length: 250 }, (_, i) => ({ id: `d${i}`, content: `content ${i}` }));

    await engine.indexMany([...docs, { id: 'd0', content: 'updated' }]);

    const calls = store.upsert.mock.calls.map(([args]: any) => args);
    expect(calls.map((c: any) => c.documents.length)).toEqual([100, 100, 50]);
    const allIds = calls.flatMap((c: any) => c.ids);
    expect(new Set(allIds).size).toBe(250);
    for (const call of calls) {
      expect(call.documents).toEqual(call.metadata.map((m: any) => m.text));
    }
    expect(calls.flatMap((c: any) => c.documents)).toContain('updated');
    expect(store.createIndex).toHaveBeenCalledTimes(1);
  });

  it('flushes lazily indexed documents as text', async () => {
    const store = createSelfEmbeddingStore();
    const engine = new SearchEngine({
      vector: { vectorStore: store as any, indexName: 'idx' },
      lazyVectorIndex: true,
    });

    await engine.index({ id: 'a', content: 'alpha' });
    await engine.index({ id: 'b', content: 'beta' });
    expect(store.upsert).not.toHaveBeenCalled();

    await engine.search('alpha', { mode: 'vector' });

    expect(store.upsert).toHaveBeenCalledTimes(1);
    expect(store.upsert.mock.calls[0]![0]).toMatchObject({ documents: ['alpha', 'beta'], ids: ['a', 'b'] });
  });

  it('sends the query as text in vector mode', async () => {
    const store = createSelfEmbeddingStore([
      { id: 'doc1', score: 0.9, metadata: { id: 'doc1', text: 'reset your password here' } },
    ]);
    const engine = new SearchEngine({ vector: { vectorStore: store as any, indexName: 'idx' } });

    const results = await engine.search('reset password', { mode: 'vector', topK: 3, filter: { path: 'a' } });

    expect(store.query).toHaveBeenCalledWith({
      indexName: 'idx',
      queryText: 'reset password',
      topK: 3,
      filter: { path: 'a' },
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: 'doc1', content: 'reset your password here', score: 0.9 });
  });

  it('merges BM25 and self-embedded vector results in hybrid mode', async () => {
    const store = createSelfEmbeddingStore([{ id: 'v1', score: 0.8, metadata: { id: 'v1', text: 'semantic match' } }]);
    const engine = new SearchEngine({
      bm25: {},
      vector: { vectorStore: store as any, indexName: 'idx' },
    });

    await engine.index({ id: 'k1', content: 'keyword match' });
    const results = await engine.search('keyword match', { mode: 'hybrid' });

    expect(store.query.mock.calls[0]![0]).toMatchObject({ queryText: 'keyword match' });
    expect(results.map(r => r.id).sort()).toEqual(['k1', 'v1']);
  });

  it('uses the configured embedder even when the store can embed itself', async () => {
    const store = createSelfEmbeddingStore();
    const embedder = vi.fn(async () => [1, 2, 3]);
    const engine = new SearchEngine({ vector: { vectorStore: store as any, embedder, indexName: 'idx' } });

    await engine.index({ id: 'doc1', content: 'Hello' });
    await engine.search('Hello', { mode: 'vector' });

    expect(embedder).toHaveBeenCalledTimes(2);
    expect(store.createIndex).toHaveBeenCalledWith({ indexName: 'idx', dimension: 3 });
    expect(store.upsert.mock.calls[0]![0]).toHaveProperty('vectors', [[1, 2, 3]]);
    expect(store.query.mock.calls[0]![0]).toHaveProperty('queryVector', [1, 2, 3]);
  });
});
