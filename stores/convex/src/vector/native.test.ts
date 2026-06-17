import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConvexNativeVector } from './native';

const createVector = () =>
  new ConvexNativeVector({
    id: 'native-vector',
    deploymentUrl: 'https://test.convex.cloud',
    adminAuthToken: 'test-token',
    indexes: {
      docs: {
        tableName: 'mastra_doc_vectors',
        vectorIndexName: 'by_embedding',
        dimension: 3,
        filterFields: ['tenantId'],
      },
    },
  });

describe('ConvexNativeVector', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the native vector action and loads matching documents', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success', value: [{ id: 'convex-doc-id', score: 0.91 }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          value: [
            {
              _id: 'convex-doc-id',
              id: 'vec-1',
              embedding: [0.1, 0.2, 0.3],
              metadata: { text: 'hello' },
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const results = await createVector().query({
      indexName: 'docs',
      queryVector: [0.1, 0.2, 0.3],
      topK: 1,
      includeVector: true,
      filter: { tenantId: 'acme' },
    });

    expect(results).toEqual([
      {
        id: 'vec-1',
        score: 0.91,
        metadata: { text: 'hello' },
        vector: [0.1, 0.2, 0.3],
      },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://test.convex.cloud/api/action',
      expect.objectContaining({
        body: JSON.stringify({
          path: 'mastra/nativeVector:query',
          args: {
            config: {
              tableName: 'mastra_doc_vectors',
              vectorIndexName: 'by_embedding',
              dimension: 3,
              idField: 'id',
              idIndexName: 'by_record_id',
              vectorField: 'embedding',
              metadataField: 'metadata',
              filterFields: ['tenantId'],
            },
            vector: [0.1, 0.2, 0.3],
            limit: 1,
            filter: { field: 'tenantId', value: 'acme' },
          },
          format: 'json',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://test.convex.cloud/api/query',
      expect.objectContaining({
        body: expect.stringContaining('"includeVector":true'),
      }),
    );
  });

  it('omits vectors from native result reads by default', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success', value: [{ id: 'convex-doc-id', score: 0.91 }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          value: [
            {
              _id: 'convex-doc-id',
              id: 'vec-1',
              metadata: { text: 'hello' },
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const results = await createVector().query({
      indexName: 'docs',
      queryVector: [0.1, 0.2, 0.3],
    });

    expect(results).toEqual([
      {
        id: 'vec-1',
        score: 0.91,
        metadata: { text: 'hello' },
      },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://test.convex.cloud/api/query',
      expect.objectContaining({
        body: expect.stringContaining('"includeVector":false'),
      }),
    );
  });

  it('writes vectors through the native vector mutation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', value: { ok: true } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const ids = await createVector().upsert({
      indexName: 'docs',
      ids: ['vec-1'],
      vectors: [[0.1, 0.2, 0.3]],
      metadata: [{ tenantId: 'acme', text: 'hello' }],
    });

    expect(ids).toEqual(['vec-1']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://test.convex.cloud/api/mutation',
      expect.objectContaining({
        body: expect.stringContaining('"op":"upsert"'),
      }),
    );
  });

  it('rejects upserts with mismatched array lengths', async () => {
    await expect(
      createVector().upsert({
        indexName: 'docs',
        ids: ['vec-1'],
        vectors: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      }),
    ).rejects.toThrow('ids length (1) must match vectors length (2)');
  });

  it('rejects duplicate upsert ids', async () => {
    await expect(
      createVector().upsert({
        indexName: 'docs',
        ids: ['vec-1', 'vec-1'],
        vectors: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      }),
    ).rejects.toThrow('ids must be unique');
  });

  it('rejects non-object upsert metadata', async () => {
    await expect(
      createVector().upsert({
        indexName: 'docs',
        ids: ['vec-1'],
        vectors: [[0.1, 0.2, 0.3]],
        metadata: ['not-object'] as any,
      }),
    ).rejects.toThrow('metadata entries must be objects');
  });

  it('rejects non-object update metadata', async () => {
    await expect(
      createVector().updateVector({
        indexName: 'docs',
        id: 'vec-1',
        update: { metadata: ['not-object'] as any },
      }),
    ).rejects.toThrow('metadata must be an object');
  });

  it('throws when a Convex function returns no value', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createVector().query({
        indexName: 'docs',
        queryVector: [0.1, 0.2, 0.3],
      }),
    ).rejects.toThrow('returned no value');
  });

  it('validates deployed index dimensions in createIndex', async () => {
    await expect(createVector().createIndex({ indexName: 'docs', dimension: 4 })).rejects.toThrow('has 3 dimensions');
  });

  it('rejects unsupported native filter shapes', async () => {
    await expect(
      createVector().query({
        indexName: 'docs',
        queryVector: [0.1, 0.2, 0.3],
        filter: { tenantId: 'acme', source: 'guide' },
      }),
    ).rejects.toThrow('one equality field');
  });

  it('serializes native OR filters', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', value: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await createVector().query({
      indexName: 'docs',
      queryVector: [0.1, 0.2, 0.3],
      filter: { $or: [{ tenantId: 'acme' }, { tenantId: 'mastra' }] },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://test.convex.cloud/api/action',
      expect.objectContaining({
        body: expect.stringContaining(
          '"$or":[{"field":"tenantId","value":"acme"},{"field":"tenantId","value":"mastra"}]',
        ),
      }),
    );
  });

  it('rejects filters when the field is not configured for the native vector index', async () => {
    await expect(
      createVector().query({
        indexName: 'docs',
        queryVector: [0.1, 0.2, 0.3],
        filter: { source: 'guide' },
      }),
    ).rejects.toThrow('field "source" is not configured');
  });

  it('caps topK at the Convex native vector search limit', async () => {
    await expect(
      createVector().query({
        indexName: 'docs',
        queryVector: [0.1, 0.2, 0.3],
        topK: 257,
      }),
    ).rejects.toThrow('topK must be an integer between 1 and 256');
  });

  it('rejects topK below the Convex native vector search limit', async () => {
    await expect(
      createVector().query({
        indexName: 'docs',
        queryVector: [0.1, 0.2, 0.3],
        topK: 0,
      }),
    ).rejects.toThrow('topK must be an integer between 1 and 256');
  });

  it('rejects fractional topK values', async () => {
    await expect(
      createVector().query({
        indexName: 'docs',
        queryVector: [0.1, 0.2, 0.3],
        topK: 1.5,
      }),
    ).rejects.toThrow('topK must be an integer between 1 and 256');
  });

  it('rejects NaN topK values', async () => {
    await expect(
      createVector().query({
        indexName: 'docs',
        queryVector: [0.1, 0.2, 0.3],
        topK: Number.NaN,
      }),
    ).rejects.toThrow('topK must be an integer between 1 and 256');
  });
});
