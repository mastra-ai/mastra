// To setup a Weaviate server, run:
// docker compose up -d
import { createVectorTestSuite } from '@internal/storage-test-utils';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { WeaviateVector } from './index';

const dimension = 3;

describe('WeaviateVector', () => {
  let weaviate: WeaviateVector;
  const testIndex = 'test_index_' + Date.now();

  beforeAll(async () => {
    weaviate = new WeaviateVector({ id: 'weaviate-test' });
    await weaviate.createIndex({ indexName: testIndex, dimension });
  }, 50000);

  afterAll(async () => {
    await weaviate.deleteIndex({ indexName: testIndex });
    await weaviate.disconnect();
  }, 50000);

  it('should upsert and query vectors with a metadata filter', async () => {
    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];

    const ids = await weaviate.upsert({ indexName: testIndex, vectors: testVectors, metadata: testMetadata });
    expect(ids).toHaveLength(3);

    const results = await weaviate.query({
      indexName: testIndex,
      queryVector: [0.0, 1.0, 0.0],
      topK: 1,
      filter: { label: 'y-axis' },
    });

    expect(results).toHaveLength(1);
    expect(results?.[0]?.metadata?.label).toBe('y-axis');
    expect(results?.[0]?.id).toBe(ids[1]);
  }, 50000);

  it('should list and describe the index', async () => {
    const indexes = await weaviate.listIndexes();
    expect(indexes).toContain(testIndex);

    const stats = await weaviate.describeIndex({ indexName: testIndex });
    expect(stats.dimension).toBe(dimension);
    expect(stats.metric).toBe('cosine');
    expect(typeof stats.count).toBe('number');
  }, 50000);

  it('round-trips a user metadata key that collides with the encoding prefix', async () => {
    const [id] = await weaviate.upsert({
      indexName: testIndex,
      vectors: [[0.5, 0.5, 0.0]],
      metadata: [{ mastraMeta_id: 'user-value', label: 'prefixed' }],
    });

    const results = await weaviate.query({
      indexName: testIndex,
      queryVector: [0.5, 0.5, 0.0],
      topK: 1,
      filter: { label: 'prefixed' },
    });

    expect(results?.[0]?.id).toBe(id);
    // The genuine user key must survive round-trip untouched, not be decoded to `id`.
    expect(results?.[0]?.metadata?.mastraMeta_id).toBe('user-value');
  }, 50000);

  it('does not mutate the schema when an update is rejected for an empty filter', async () => {
    await expect(
      weaviate.updateVector({
        indexName: testIndex,
        filter: {},
        update: { metadata: { brandNewRejectedProp: 'x' } },
      }),
    ).rejects.toThrow(/non-empty filter/i);

    const collection = await (weaviate as any).getCollection(testIndex);
    const config = await collection.config.get();
    const propNames = config.properties.map((p: { name: string }) => p.name);
    expect(propNames).not.toContain('brandNewRejectedProp');
  }, 50000);
});

// Shared vector store test suite
const weaviateVector = new WeaviateVector({ id: 'weaviate-shared-test' });

createVectorTestSuite({
  vector: weaviateVector,
  createIndex: async (indexName, options) => {
    await weaviateVector.createIndex({ indexName, dimension: 1536, metric: options?.metric });
  },
  deleteIndex: async (indexName: string) => {
    await weaviateVector.deleteIndex({ indexName });
  },
  waitForIndexing: async () => {
    // Weaviate indexes are near-realtime; allow objects to become searchable.
    await new Promise(resolve => setTimeout(resolve, 500));
  },
  disconnect: async () => {
    await weaviateVector.disconnect();
  },
  supportsRegex: false,
  supportsContains: false,
  supportsNorOperator: false,
  supportsElemMatch: false,
  supportsSize: false,
  supportsEmptyLogicalOperators: false,
  supportsAdvancedNotSyntax: false,
  // Weaviate omits null-valued properties from responses and cannot distinguish
  // an explicitly-stored null from an absent field, so null round-tripping is not supported.
  supportsNullValues: false,
});
