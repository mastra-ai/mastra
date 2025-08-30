import { createVectorTestSuite } from '@internal/storage-test-utils';
import { vi, describe, it, expect, beforeAll, afterAll, test } from 'vitest';
import { S3Vectors } from './';

// ====== Vitest timeouts: keep generous but tests should run faster without manual waits ======
vi.setConfig({ testTimeout: 300000, hookTimeout: 300000 });

// ====== Runtime config (bucket & region) ======
const vectorBucketName = process.env.S3_VECTORS_BUCKET_NAME;
const region = process.env.AWS_REGION || process.env.S3_VECTORS_REGION;
const runIntegrationTests = !!vectorBucketName && vectorBucketName.trim() !== '' && !!region && region.trim() !== '';

// Helper to construct S3Vectors
function makeVector() {
  if (!vectorBucketName) {
    throw new Error('Set S3_VECTORS_BUCKET_NAME environment variable.');
  }
  return new S3Vectors({
    vectorBucketName,
    clientConfig: region ? { region } : undefined,
  });
}

// ====== Simplified helpers ======

// Create index (no polling)
async function createIndex(vectorDB: S3Vectors, indexName: string, dimension: number, metric: 'cosine' | 'euclidean') {
  await vectorDB.createIndex({ indexName, dimension, metric });
}

// Delete index (best-effort, no polling)
async function deleteIndex(vectorDB: S3Vectors, indexName: string) {
  try {
    await vectorDB.deleteIndex({ indexName });
  } catch {
    // already deleted is fine
  }
}

// ====== Tests ======
(runIntegrationTests ? describe : describe.skip)('S3Vectors Integration Tests', () => {
  let vectorDB: S3Vectors;
  const testIndexName = 'my-vectors';
  const testIndexName2 = 'my-vectors-2';
  const emptyIndexName = 'empty-index';

  beforeAll(async () => {
    vectorDB = makeVector();
    await vectorDB.connect();

    // Cleanup if same-named indexes exist
    await deleteIndex(vectorDB, testIndexName);
    await deleteIndex(vectorDB, testIndexName2);
    await deleteIndex(vectorDB, emptyIndexName);

    // Create indexes (strongly consistent; no waits)
    await createIndex(vectorDB, testIndexName, 4, 'cosine');
    await createIndex(vectorDB, testIndexName2, 4, 'cosine');
    await createIndex(vectorDB, emptyIndexName, 4, 'cosine');
  }, 500000);

  afterAll(async () => {
    await deleteIndex(vectorDB, testIndexName).catch(err => console.error('Failed to delete index:', err));
    await deleteIndex(vectorDB, testIndexName2).catch(err => console.error('Failed to delete index:', err));
    await deleteIndex(vectorDB, emptyIndexName).catch(err => console.error('Failed to delete index:', err));
    await vectorDB.disconnect();
  });

  describe('Index operations (S3 specific)', () => {
    it('normalizes index names: "_" -> "-" and lowercases', async () => {
      const raw = 'My_Index';
      const normalized = 'my-index';
      try {
        await createIndex(vectorDB, raw, 4, 'cosine');
        const names = await vectorDB.listIndexes();
        expect(names).toContain(normalized);
      } finally {
        await deleteIndex(vectorDB, raw); // delete accepts raw; impl normalizes internally
        await deleteIndex(vectorDB, normalized); // in case caller normalizes first
      }
    });

    it('duplicate createIndex: same dimension is a no-op; different metric call is ignored and does not mutate the existing index', async () => {
      const idx = `dup-${Date.now()}`;
      try {
        // 1) Initial creation (cosine)
        await createIndex(vectorDB, idx, 4, 'cosine');

        // 2) Same parameters -> should not throw (no-op)
        await expect(createIndex(vectorDB, idx, 4, 'cosine')).resolves.not.toThrow();

        // 3) Different metric -> should not throw (treated as no-op); existing index must remain unchanged
        await expect(createIndex(vectorDB, idx, 4, 'euclidean')).resolves.not.toThrow();

        // Verify the existing index preserves the original metric
        const stats = await vectorDB.describeIndex({ indexName: idx });
        expect(stats.dimension).toBe(4);
        expect(stats.metric).toBe('cosine'); // unchanged
      } finally {
        await deleteIndex(vectorDB, idx);
      }
    });
  });

  test('full vector database workflow', async () => {
    // Verify index exists
    const names = await vectorDB.listIndexes();
    expect(names).toContain(testIndexName);

    // Stats initially
    const initialStats = await vectorDB.describeIndex({ indexName: testIndexName });
    expect(initialStats).toEqual({ dimension: 4, metric: 'cosine', count: 0 });

    // Upsert 4 vectors with metadata
    const vectors = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    const metadata = [{ label: 'vector1' }, { label: 'vector2' }, { label: 'vector3' }, { label: 'vector4' }];
    const ids = await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });
    expect(ids).toHaveLength(4);

    // Count should reflect immediately
    const updatedStats = await vectorDB.describeIndex({ indexName: testIndexName });
    expect(updatedStats.count).toEqual(4);

    // Query
    const queryVector = [1, 0, 0, 0];
    const results = await vectorDB.query({ indexName: testIndexName, queryVector, topK: 2 });
    expect(results).toHaveLength(2);
    expect(results[0]?.metadata).toEqual({ label: 'vector1' });
    expect(results[0]?.score).toBeCloseTo(1, 4);

    // Filter via translator
    const filteredResults = await vectorDB.query({
      indexName: testIndexName,
      queryVector,
      topK: 4,
      filter: { label: 'vector2' },
    });
    expect(filteredResults).toHaveLength(1);
    expect(filteredResults[0]?.metadata).toEqual({ label: 'vector2' });

    const finalStats = await vectorDB.describeIndex({ indexName: testIndexName });
    expect(finalStats.count).toBeGreaterThan(0);
  });

  test('gets vector results back from query with vector included', async () => {
    const queryVector = [1, 0, 0, 0];
    const results = await vectorDB.query({
      indexName: testIndexName,
      queryVector,
      topK: 2,
      includeVector: true,
    });
    expect(results).toHaveLength(2);
    expect(results[0]?.metadata).toEqual({ label: 'vector1' });
    expect(results[0]?.score).toBeCloseTo(1, 4);
    expect(results[0]?.vector).toBeDefined();
  });

  test('handles different vector dimensions', async () => {
    const highDimIndexName = 'high-dim-test-' + Date.now();
    try {
      await createIndex(vectorDB, highDimIndexName, 1536, 'cosine');
      const vectors = [
        Array(1536)
          .fill(0)
          .map((_, i) => (i % 2 ? 1 : 0)),
        Array(1536)
          .fill(0)
          .map((_, i) => ((i + 1) % 2 ? 1 : 0)),
      ];
      const metadata = [{ label: 'even' }, { label: 'odd' }];
      const ids = await vectorDB.upsert({ indexName: highDimIndexName, vectors, metadata });
      expect(ids).toHaveLength(2);
      const queryVector = Array(1536)
        .fill(0)
        .map((_, i) => (i % 2 ? 1 : 0));
      const results = await vectorDB.query({ indexName: highDimIndexName, queryVector, topK: 2 });
      expect(results).toHaveLength(2);
      expect(results[0]?.metadata).toEqual({ label: 'even' });
      expect(results[0]?.score).toBeCloseTo(1, 4);
    } finally {
      await deleteIndex(vectorDB, highDimIndexName);
    }
  });

  test('handles different distance metrics (cosine & euclidean)', async () => {
    const metrics: Array<'cosine' | 'euclidean'> = ['cosine', 'euclidean'];
    for (const metric of metrics) {
      const metricIndexName = `metrictest-${metric}-${Date.now()}`;
      try {
        await createIndex(vectorDB, metricIndexName, 4, metric);
        const vectors = [
          [1, 0, 0, 0],
          [0.7071, 0.7071, 0, 0],
        ];
        await vectorDB.upsert({ indexName: metricIndexName, vectors });
        const results = await vectorDB.query({ indexName: metricIndexName, queryVector: [1, 0, 0, 0], topK: 2 });
        expect(results).toHaveLength(2);
        expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
      } finally {
        await deleteIndex(vectorDB, metricIndexName);
      }
    }
  }, 500000);

  describe('Filter Validation in Queries', () => {
    beforeAll(async () => {
      // Ensure testIndexName2 has at least one document
      const testVector = [1, 0, 0, 0];
      const testMetadata = {
        label: 'test_filter_validation',
        timestamp: new Date('2024-01-01T00:00:00Z'),
      };

      const existingResults = await vectorDB.query({
        indexName: testIndexName2,
        queryVector: testVector,
        topK: 1,
      });

      if (existingResults.length === 0) {
        await vectorDB.upsert({
          indexName: testIndexName2,
          vectors: [testVector],
          metadata: [testMetadata],
        });
      }
    }, 30000);

    it('handles undefined filter', async () => {
      const results1 = await vectorDB.query({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
        filter: undefined,
      });
      const results2 = await vectorDB.query({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
      });
      expect(results1).toEqual(results2);
      expect(results1.length).toBeGreaterThan(0);
    });

    it('handles empty object filter', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
        filter: {},
      });
      const results2 = await vectorDB.query({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
      });
      expect(results).toEqual(results2);
      expect(results.length).toBeGreaterThan(0);
    });

    it('handles null filter', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
        filter: null,
      });
      const results2 = await vectorDB.query({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
      });
      expect(results).toEqual(results2);
      expect(results.length).toBeGreaterThan(0);
    });

    it('handles filters with multiple properties', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
        filter: {
          label: 'test_filter_validation',
          timestamp: { $gt: new Date('2023-01-01T00:00:00Z') },
        },
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('normalizes date values in filter using filter.ts', async () => {
      const vector = [1, 0, 0, 0];
      const timestampDate = new Date('2024-01-01T00:00:00Z');
      await vectorDB.upsert({
        indexName: testIndexName2,
        vectors: [vector],
        metadata: [{ timestamp: timestampDate }],
      });
      const results = await vectorDB.query({
        indexName: testIndexName2,
        queryVector: vector,
        filter: { timestamp: { $gt: new Date('2023-01-01T00:00:00Z') } },
      });
      expect(results.length).toBeGreaterThan(0);
      expect(new Date(results[0]?.metadata?.timestamp).toISOString()).toEqual(timestampDate.toISOString());
    });
  });

  describe('Basic vector operations', () => {
    const indexName = 'test-basic-vector-ops-' + Date.now();
    beforeAll(async () => {
      await createIndex(vectorDB, indexName, 4, 'cosine');
    });
    afterAll(async () => {
      await deleteIndex(vectorDB, indexName);
    });
    const testVectors = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    it('should update the vector by id', async () => {
      const ids = await vectorDB.upsert({ indexName, vectors: testVectors });
      expect(ids).toHaveLength(4);
      const idToBeUpdated = ids[0];
      const newVector = [1, 2, 3, 4];
      const newMetaData = { test: 'updates' };
      await vectorDB.updateVector({
        indexName,
        id: idToBeUpdated,
        update: { vector: newVector, metadata: newMetaData },
      });
      const results = await vectorDB.query({
        indexName,
        queryVector: newVector,
        topK: 2,
        includeVector: true,
      });
      expect(results).toHaveLength(2);
      const updatedResult = results.find(result => result.id === idToBeUpdated);
      expect(updatedResult).toBeDefined();
      expect(updatedResult?.id).toEqual(idToBeUpdated);
      expect(updatedResult?.vector).toEqual(newVector);
      expect(updatedResult?.metadata).toEqual(newMetaData);
    });
    it('should only update the metadata by id', async () => {
      const ids = await vectorDB.upsert({ indexName, vectors: testVectors });
      expect(ids).toHaveLength(4);
      const idToBeUpdated = ids[0];
      const newMetaData = { test: 'metadata only update' };
      await vectorDB.updateVector({ indexName, id: idToBeUpdated, update: { metadata: newMetaData } });
      const results = await vectorDB.query({
        indexName,
        queryVector: testVectors[0],
        topK: 10,
        includeVector: true,
        filter: { test: 'metadata only update' },
      });
      expect(results.length).toBe(1);
      const updatedResult = results.find(result => result.id === idToBeUpdated);
      expect(updatedResult).toBeDefined();
      expect(updatedResult?.id).toEqual(idToBeUpdated);
      expect(updatedResult?.vector).toEqual(testVectors[0]);
      expect(updatedResult?.metadata).toEqual(newMetaData);
    });
    it('should only update vector embeddings by id', async () => {
      const ids = await vectorDB.upsert({ indexName, vectors: testVectors });
      expect(ids).toHaveLength(4);
      const idToBeUpdated = ids[0];
      const newVector = [1, 2, 3, 4];
      await vectorDB.updateVector({ indexName, id: idToBeUpdated, update: { vector: newVector } });
      const results = await vectorDB.query({
        indexName,
        queryVector: newVector,
        topK: 2,
        includeVector: true,
      });
      expect(results).toHaveLength(2);
      const updatedResult = results.find(result => result.id === idToBeUpdated);
      expect(updatedResult).toBeDefined();
      expect(updatedResult?.id).toEqual(idToBeUpdated);
      expect(updatedResult?.vector).toEqual(newVector);
    });
    it('should throw exception when no updates are given', async () => {
      await expect(vectorDB.updateVector({ indexName, id: 'nonexistent-id', update: {} })).rejects.toThrow(
        'No updates provided',
      );
    });
    it('should delete the vector by id', async () => {
      const ids = await vectorDB.upsert({ indexName, vectors: testVectors });
      expect(ids).toHaveLength(4);
      const idToBeDeleted = ids[0];

      const initialStats = await vectorDB.describeIndex({ indexName });

      await vectorDB.deleteVector({ indexName, id: idToBeDeleted });
      const results = await vectorDB.query({ indexName, queryVector: [1, 0, 0, 0], topK: 2 });
      expect(results.map(res => res.id)).not.toContain(idToBeDeleted);

      const finalStats = await vectorDB.describeIndex({ indexName });
      expect(finalStats.count).toBe(initialStats.count - 1);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent index queries', async () => {
      await expect(vectorDB.query({ indexName: 'non-existent-index', queryVector: [1, 2, 3] })).rejects.toThrow();
    });

    it('should handle invalid dimension vectors', async () => {
      const invalidVector = [1, 2, 3]; // 3D vector for 4D index
      await expect(vectorDB.upsert({ indexName: testIndexName, vectors: [invalidVector] })).rejects.toThrow();
    });

    it('should reject unsupported metric dotproduct on createIndex', async () => {
      await expect(createIndex(vectorDB, `dotproduct-${Date.now()}`, 4, 'dotproduct' as any)).rejects.toThrow(
        /Invalid metric/i,
      );
    });

    it('should return empty results and not throw when semantic search filter matches zero documents', async () => {
      const testEmbedding = [0.1, 0.2, 0.3, 0.4];
      let error: unknown = null;
      let results: any[] = [];
      try {
        results = await vectorDB.query({
          indexName: emptyIndexName,
          queryVector: testEmbedding,
          topK: 2,
          filter: {
            label: 'test_filter_validation',
          },
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeNull();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });
});

// ====== Shared test suite (factory pattern) ======
// Run only when integration env is present; otherwise register a skipped suite for visibility.
if (runIntegrationTests) {
  const s3Vector = makeVector();

  createVectorTestSuite({
    vector: s3Vector,
    connect: async () => {
      await s3Vector.connect();
    },
    disconnect: async () => {
      await s3Vector.disconnect();
    },
    createIndex: async (indexName: string) => {
      await s3Vector.createIndex({ indexName, dimension: 4, metric: 'cosine' });
    },
    deleteIndex: async (indexName: string) => {
      try {
        await s3Vector.deleteIndex({ indexName });
      } catch (error) {
        console.error(`Error deleting index ${indexName}:`, error);
      }
    },
    // Strong consistency: no indexing wait needed
    waitForIndexing: async () => {},
  });
} else {
  // Register a skipped suite so test reporters show *why* this part didn’t run.
  describe.skip('S3Vectors – Shared vector test suite', () => {
    it('skipped: integration env vars not set (S3_VECTORS_BUCKET_NAME / AWS_REGION)', () => {
      // no-op
    });
  });
}
