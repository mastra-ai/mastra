import type * as AzureSearchDocuments from '@azure/search-documents';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AzureAISearchVector } from './index';

vi.mock('@azure/search-documents', () => ({
  SearchClient: vi.fn(function SearchClient() {}),
  SearchIndexClient: vi.fn(function SearchIndexClient() {}),
  AzureKeyCredential: vi.fn(function AzureKeyCredential() {}),
}));
vi.mock('@azure/core-auth', () => ({}));

/**
 * Drives the store the way @mastra/memory does:
 *   createIndex({ indexName, dimension })   with no metadataIndexes
 *   upsert with metadata { thread_id, resource_id }
 *   query / deleteVectors with filter { thread_id }
 * Azure can only filter on declared fields, so the store must declare them itself.
 */
function makeMocks() {
  let indexFields: Array<{ name: string; type: string }> = [];
  const mockIndexClient: any = {
    createIndex: vi.fn(async (def: any) => {
      indexFields = def.fields.map((f: any) => ({ name: f.name, type: f.type, ...f }));
    }),
    createOrUpdateIndex: vi.fn(async (def: any) => {
      indexFields = def.fields.map((f: any) => ({ name: f.name, type: f.type, ...f }));
    }),
    getIndex: vi.fn(async () => ({ name: 'idx', fields: indexFields })),
  };
  const search = vi.fn(async () => ({ results: (async function* () {})() }));
  const mockSearchClient: any = {
    uploadDocuments: vi.fn(async (docs: any[]) => ({ results: docs.map(d => ({ key: d.id, succeeded: true })) })),
    mergeDocuments: vi.fn(async (docs: any[]) => ({ results: docs.map(d => ({ key: d.id, succeeded: true })) })),
    search,
    deleteDocuments: vi.fn(async (docs: any[]) => ({ results: docs.map(d => ({ key: d.id, succeeded: true })) })),
    getDocumentsCount: vi.fn(async () => 0),
  };
  return {
    mockIndexClient,
    mockSearchClient,
    search,
    fieldNames: () => indexFields.map(f => f.name),
    fields: () => indexFields,
  };
}

describe('Memory contract: undeclared metadata keys become filterable fields', () => {
  let m: ReturnType<typeof makeMocks>;
  let store: AzureAISearchVector;

  beforeEach(async () => {
    m = makeMocks();
    const { SearchIndexClient, SearchClient, AzureKeyCredential } =
      await vi.importMock<typeof AzureSearchDocuments>('@azure/search-documents');
    (SearchIndexClient as any).mockImplementation(function () {
      return m.mockIndexClient;
    });
    (SearchClient as any).mockImplementation(function () {
      return m.mockSearchClient;
    });
    (AzureKeyCredential as any).mockImplementation(function (key: string) {
      return { key };
    });
    store = new AzureAISearchVector({ id: 'x', endpoint: 'https://t.search.windows.net', credential: 'k' });
    await store.createIndex({ indexName: 'memory_messages_1536', dimension: 1536 });
    expect(m.fieldNames()).toEqual(['id', 'vector', 'metadata', 'content']);
  });

  it('upsert auto-declares thread_id/resource_id so Memory filters resolve', async () => {
    await store.upsert({
      indexName: 'memory_messages_1536',
      vectors: [new Array(1536).fill(0.1)],
      metadata: [{ thread_id: 't1', resource_id: 'r1', message_id: 'm1', score: 0.5, flagged: true }],
    });

    expect(m.mockIndexClient.createOrUpdateIndex).toHaveBeenCalledTimes(1);
    const byName = Object.fromEntries(m.fields().map(f => [f.name, f]));
    expect(byName.thread_id).toMatchObject({ type: 'Edm.String', filterable: true });
    expect(byName.resource_id).toMatchObject({ type: 'Edm.String', filterable: true });
    expect(byName.score).toMatchObject({ type: 'Edm.Double', filterable: true });
    expect(byName.flagged).toMatchObject({ type: 'Edm.Boolean', filterable: true });

    const uploaded = m.mockSearchClient.uploadDocuments.mock.calls[0][0][0];
    expect(uploaded).toMatchObject({ thread_id: 't1', resource_id: 'r1', score: 0.5, flagged: true });

    await store.query({
      indexName: 'memory_messages_1536',
      queryVector: new Array(1536).fill(0.1),
      filter: { thread_id: 't1' },
    });
    await store.deleteVectors({ indexName: 'memory_messages_1536', filter: { thread_id: 't1' } });
    for (const call of m.search.mock.calls) {
      const f: string = (call as any)[1].filter;
      const referenced = [...f.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s+(eq|ne|gt|ge|lt|le)\b/g)].map(x => x[1]);
      for (const field of referenced) {
        expect(m.fieldNames(), `filter "${f}" references undeclared field "${field}"`).toContain(field);
      }
    }
  });

  it('does not add a field twice, and skips non-scalar / invalid-name keys', async () => {
    const md = { thread_id: 't1', 'dotted.key': 'x', nested: { a: 1 }, list: [1, 2], nothing: null, azureSearchX: 'y' };
    await store.upsert({ indexName: 'memory_messages_1536', vectors: [new Array(1536).fill(0.1)], metadata: [md] });
    await store.upsert({ indexName: 'memory_messages_1536', vectors: [new Array(1536).fill(0.1)], metadata: [md] });
    expect(m.mockIndexClient.createOrUpdateIndex).toHaveBeenCalledTimes(1);
    expect(m.fieldNames()).toEqual(['id', 'vector', 'metadata', 'content', 'thread_id']);
  });

  it('writes null instead of a mismatched value into a typed column', async () => {
    await store.createIndex({ indexName: 'memory_messages_1536', dimension: 1536, metadataIndexes: ['batch'] } as any);
    await store.upsert({
      indexName: 'memory_messages_1536',
      vectors: [new Array(1536).fill(0.1)],
      metadata: [{ batch: 0 }],
    });
    const uploaded = m.mockSearchClient.uploadDocuments.mock.calls[0][0][0];
    expect(uploaded.batch).toBeNull();
    expect(JSON.parse(uploaded.metadata)).toEqual({ batch: 0 });
  });

  it('honors autoIndexMetadata: false', async () => {
    const strict = new AzureAISearchVector({
      id: 'y',
      endpoint: 'https://t.search.windows.net',
      credential: 'k',
      autoIndexMetadata: false,
    });
    await strict.upsert({
      indexName: 'memory_messages_1536',
      vectors: [new Array(1536).fill(0.1)],
      metadata: [{ thread_id: 't1' }],
    });
    expect(m.mockIndexClient.createOrUpdateIndex).not.toHaveBeenCalled();
  });

  it('serializes concurrent schema updates so no field is lost', async () => {
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        store.upsert({
          indexName: 'memory_messages_1536',
          vectors: [new Array(1536).fill(0.1)],
          metadata: [{ [`k${i}`]: i }],
        }),
      ),
    );
    expect(m.fieldNames()).toEqual(expect.arrayContaining(['k0', 'k1', 'k2', 'k3', 'k4']));
  });

  it('rewrites Azure "Could not find a property" into an actionable error', async () => {
    m.search.mockRejectedValueOnce(
      Object.assign(
        new Error("Invalid expression: Could not find a property named 'ghost' on type 'search.document'."),
        {
          statusCode: 400,
        },
      ),
    );
    await expect(
      store.query({ indexName: 'memory_messages_1536', queryVector: new Array(1536).fill(0.1), filter: { ghost: 1 } }),
    ).rejects.toMatchObject({ id: 'STORAGE_AZURE_AI_SEARCH_FILTER_UNKNOWN_FIELD', details: { field: 'ghost' } });
  });
});

describe('document key encoding', () => {
  let m: ReturnType<typeof makeMocks>;
  let store: AzureAISearchVector;

  beforeEach(async () => {
    m = makeMocks();
    const { SearchIndexClient, SearchClient } =
      await vi.importMock<typeof AzureSearchDocuments>('@azure/search-documents');
    (SearchIndexClient as any).mockImplementation(function () {
      return m.mockIndexClient;
    });
    (SearchClient as any).mockImplementation(function () {
      return m.mockSearchClient;
    });
    store = new AzureAISearchVector({ id: 'x', endpoint: 'https://t.search.windows.net', credential: 'k' });
    await store.createIndex({ indexName: 'idx', dimension: 2 });
  });

  it('round-trips ids Azure would reject as keys', async () => {
    const ids = [
      'urn:uuid:F9168C5E-CEB2-4faa-B6BF-329BF39FA1E4',
      'user@example.com',
      'a/b c',
      'plain-ok_1=',
      'b64-raw',
    ];
    await store.upsert({ indexName: 'idx', vectors: ids.map(() => [0, 1]), ids });
    const stored: string[] = m.mockSearchClient.uploadDocuments.mock.calls[0][0].map((d: any) => d.id);
    for (const key of stored) expect(key).toMatch(/^[A-Za-z0-9_\-=]+$/);
    expect(stored[3]).toBe('plain-ok_1=');
    expect(stored[4]).not.toBe('b64-raw');

    m.search.mockResolvedValueOnce({
      results: (async function* () {
        for (const id of stored) yield { document: { id, metadata: '{}', content: '' }, score: 1 };
      })(),
    } as any);
    const results = await store.query({ indexName: 'idx', queryVector: [0, 1] });
    expect(results.map(r => r.id)).toEqual(ids);

    await store.deleteVectors({ indexName: 'idx', ids });
    expect(m.mockSearchClient.deleteDocuments.mock.calls[0][0].map((d: any) => d.id)).toEqual(stored);

    await store.updateVector({ indexName: 'idx', id: ids[0]!, update: { metadata: { a: 1 } } });
    expect(m.mockSearchClient.mergeDocuments.mock.calls[0][0][0].id).toBe(stored[0]);
  });
});
