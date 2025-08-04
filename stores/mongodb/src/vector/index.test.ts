import { vi, describe, it, expect, beforeAll, afterAll, test } from 'vitest';
import { MongoDBVector } from './';

// Give tests enough time to complete database operations
vi.setConfig({ testTimeout: 300000, hookTimeout: 300000 });

// Concrete MongoDB configuration values – adjust these for your environment
const uri =
  'mongodb://mongodb:mongodb@localhost:27018/?authSource=admin&directConnection=true&serverSelectionTimeoutMS=2000';
const dbName = 'vector_db';

async function waitForAtlasSearchReady(
  vectorDB: MongoDBVector,
  indexName: string = 'dummy_vector_index',
  dimension: number = 1,
  metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine',
  timeout: number = 300000,
  interval: number = 5000,
) {
  const start = Date.now();
  let lastError: any = null;
  let attempt = 0;
  while (Date.now() - start < timeout) {
    attempt++;
    try {
      await vectorDB.createIndex({ indexName, dimension, metric });
      // If it succeeds, we're ready
      console.log(`[waitForAtlasSearchReady] Atlas Search is ready! (attempt ${attempt})`);
      return;
    } catch (e: any) {
      lastError = e;
      console.log(`[waitForAtlasSearchReady] Not ready yet (attempt ${attempt}): ${e.message}`);
      await new Promise(res => setTimeout(res, interval));
    }
  }
  throw new Error(
    'Atlas Search did not become ready in time. Last error: ' + (lastError ? lastError.message : 'unknown'),
  );
}
// Helper function to wait for a condition with timeout (similar to mdb_toolkit)
async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 1000,
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) return true;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

// Create index and wait until the search index (named `${indexName}_vector_index`) is READY
async function createIndexAndWait(
  vectorDB: MongoDBVector,
  indexName: string,
  dimension: number,
  metric: 'cosine' | 'euclidean' | 'dotproduct',
) {
  await vectorDB.createIndex({ indexName, dimension, metric });
  await vectorDB.waitForIndexReady({ indexName });
  const created = await waitForCondition(
    async () => {
      const cols = await vectorDB.listIndexes();
      return cols.includes(indexName);
    },
    30000,
    2000,
  );
  if (!created) throw new Error('Timed out waiting for collection to be created');
}

// Delete index (collection) and wait until it is removed
async function deleteIndexAndWait(vectorDB: MongoDBVector, indexName: string) {
  try {
    await vectorDB.deleteIndex({ indexName });
    const deleted = await waitForCondition(
      async () => {
        const cols = await vectorDB.listIndexes();
        return !cols.includes(indexName);
      },
      30000,
      2000,
    );
    if (!deleted) throw new Error('Timed out waiting for collection to be deleted');
  } catch (error) {
    console.error(`Error deleting index ${indexName}:`, error);
  }
}

describe('MongoDBVector Integration Tests', () => {
  let vectorDB: MongoDBVector;
  const testIndexName = 'my_vectors';
  const testIndexName2 = 'my_vectors_2';
  const emptyIndexName = 'empty-index';

  beforeAll(async () => {
    vectorDB = new MongoDBVector({ uri, dbName });
    await vectorDB.connect();

    // Wait for Atlas Search to be ready
    await waitForAtlasSearchReady(vectorDB);

    // Cleanup any existing collections
    try {
      const cols = await vectorDB.listIndexes();
      await Promise.all(cols.map(c => vectorDB.deleteIndex({ indexName: c })));
      const deleted = await waitForCondition(async () => (await vectorDB.listIndexes()).length === 0, 30000, 2000);
      if (!deleted) throw new Error('Timed out waiting for collections to be deleted');
    } catch (error) {
      console.error('Failed to delete test collections:', error);
      throw error;
    }

    await createIndexAndWait(vectorDB, testIndexName, 4, 'cosine');
    await createIndexAndWait(vectorDB, testIndexName2, 4, 'cosine');
    await createIndexAndWait(vectorDB, emptyIndexName, 4, 'cosine');
  }, 500000);

  afterAll(async () => {
    try {
      await vectorDB.deleteIndex({ indexName: testIndexName });
    } catch (error) {
      console.error('Failed to delete test collection:', error);
    }
    try {
      await vectorDB.deleteIndex({ indexName: testIndexName2 });
    } catch (error) {
      console.error('Failed to delete test collection:', error);
    }
    try {
      await vectorDB.deleteIndex({ indexName: emptyIndexName });
    } catch (error) {
      console.error('Failed to delete test collection:', error);
    }
    await vectorDB.disconnect();
  });

  test('full vector database workflow', async () => {
    // Verify collection exists
    const cols = await vectorDB.listIndexes();
    expect(cols).toContain(testIndexName);

    // Check stats (should be zero docs initially)
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

    // Wait for the document count to update (increased delay to 5000ms)
    await new Promise(resolve => setTimeout(resolve, 5000));
    const updatedStats = await vectorDB.describeIndex({ indexName: testIndexName });
    expect(updatedStats.count).toEqual(4);

    // Query for similar vectors (delay again to allow for index update)
    await new Promise(resolve => setTimeout(resolve, 5000));
    const queryVector = [1, 0, 0, 0];
    const results = await vectorDB.query({ indexName: testIndexName, queryVector, topK: 2 });
    expect(results).toHaveLength(2);
    expect(results[0]?.metadata).toEqual({ label: 'vector1' });
    expect(results[0]?.score).toBeCloseTo(1, 4);

    // Query using a filter via filter.ts translator
    const filteredResults = await vectorDB.query({
      indexName: testIndexName,
      queryVector,
      topK: 4, // Increased from 2 to 4 to ensure all vectors are considered before filtering
      filter: { 'metadata.label': 'vector2' },
    });
    expect(filteredResults).toHaveLength(1);
    expect(filteredResults[0]?.metadata).toEqual({ label: 'vector2' });

    // Final stats should show > 0 documents
    const finalStats = await vectorDB.describeIndex({ indexName: testIndexName });
    expect(finalStats.count).toBeGreaterThan(0);
  });

  test('gets vector results back from query with vector included', async () => {
    // Delay to allow index update after any writes
    await new Promise(resolve => setTimeout(resolve, 5000));
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
    const highDimIndexName = 'high_dim_test_' + Date.now();
    try {
      await createIndexAndWait(vectorDB, highDimIndexName, 1536, 'cosine');
      const vectors = [
        Array(1536)
          .fill(0)
          .map((_, i) => i % 2),
        Array(1536)
          .fill(0)
          .map((_, i) => (i + 1) % 2),
      ];
      const metadata = [{ label: 'even' }, { label: 'odd' }];
      const ids = await vectorDB.upsert({ indexName: highDimIndexName, vectors, metadata });
      expect(ids).toHaveLength(2);
      await new Promise(resolve => setTimeout(resolve, 5000));
      const queryVector = Array(1536)
        .fill(0)
        .map((_, i) => i % 2);
      const results = await vectorDB.query({ indexName: highDimIndexName, queryVector, topK: 2 });
      expect(results).toHaveLength(2);
      expect(results[0]?.metadata).toEqual({ label: 'even' });
      expect(results[0]?.score).toBeCloseTo(1, 4);
    } finally {
      await deleteIndexAndWait(vectorDB, highDimIndexName);
    }
  });

  test('handles different distance metrics', async () => {
    const metrics: Array<'cosine' | 'euclidean' | 'dotproduct'> = ['cosine', 'euclidean', 'dotproduct'];
    for (const metric of metrics) {
      const metricIndexName = `metrictest_${metric}_${Date.now()}`;
      try {
        await createIndexAndWait(vectorDB, metricIndexName, 4, metric);
        const vectors = [
          [1, 0, 0, 0],
          [0.7071, 0.7071, 0, 0],
        ];
        await vectorDB.upsert({ indexName: metricIndexName, vectors });
        await new Promise(resolve => setTimeout(resolve, 5000));
        const results = await vectorDB.query({ indexName: metricIndexName, queryVector: [1, 0, 0, 0], topK: 2 });
        expect(results).toHaveLength(2);
        expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
      } finally {
        await deleteIndexAndWait(vectorDB, metricIndexName);
      }
    }
  }, 500000);

  describe('Filter Validation in Queries', () => {
    // Helper function to retry queries with delay
    async function retryQuery(params: any, maxRetries = 2) {
      let results = await vectorDB.query(params);
      let retryCount = 0;

      // If no results, retry a few times with delay
      while (results.length === 0 && retryCount < maxRetries) {
        console.log(`No results found, retrying (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        results = await vectorDB.query(params);
        retryCount++;
      }

      return results;
    }

    beforeAll(async () => {
      // Ensure testIndexName2 has at least one document
      const testVector = [1, 0, 0, 0];
      const testMetadata = {
        label: 'test_filter_validation',
        timestamp: new Date('2024-01-01T00:00:00Z'),
      };

      // First check if there are already documents
      const existingResults = await vectorDB.query({
        indexName: testIndexName2,
        queryVector: testVector,
        topK: 1,
      });

      // If no documents exist, insert one
      if (existingResults.length === 0) {
        await vectorDB.upsert({
          indexName: testIndexName2,
          vectors: [testVector],
          metadata: [testMetadata],
        });

        // Wait for the document to be indexed
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify the document is indexed
        const verifyResults = await retryQuery({
          indexName: testIndexName2,
          queryVector: testVector,
          topK: 1,
        });

        if (verifyResults.length === 0) {
          console.warn('Warning: Could not verify document was indexed in testIndexName2');
        }
      }
    }, 30000);

    it('handles undefined filter', async () => {
      const results1 = await retryQuery({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
        filter: undefined,
      });
      const results2 = await retryQuery({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
      });
      expect(results1).toEqual(results2);
      expect(results1.length).toBeGreaterThan(0);
    });

    it('handles empty object filter', async () => {
      const results = await retryQuery({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
        filter: {},
      });
      const results2 = await retryQuery({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
      });
      expect(results).toEqual(results2);
      expect(results.length).toBeGreaterThan(0);
    });

    it('handles null filter', async () => {
      const results = await retryQuery({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
        filter: null,
      });
      const results2 = await retryQuery({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
      });
      expect(results).toEqual(results2);
      expect(results.length).toBeGreaterThan(0);
    });

    it('handles filters with multiple properties', async () => {
      const results = await retryQuery({
        indexName: testIndexName2,
        queryVector: [1, 0, 0, 0],
        filter: {
          'metadata.label': 'test_filter_validation',
          'metadata.timestamp': { $gt: new Date('2023-01-01T00:00:00Z') },
        },
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('normalizes date values in filter using filter.ts', async () => {
      const vector = [1, 0, 0, 0];
      const timestampDate = new Date('2024-01-01T00:00:00Z');
      // Upsert a document with a timestamp in metadata
      await vectorDB.upsert({
        indexName: testIndexName2,
        vectors: [vector],
        metadata: [{ timestamp: timestampDate }],
      });
      await new Promise(r => setTimeout(r, 5000));
      const results = await retryQuery({
        indexName: testIndexName2,
        queryVector: vector,
        filter: { 'metadata.timestamp': { $gt: new Date('2023-01-01T00:00:00Z') } },
      });
      expect(results.length).toBeGreaterThan(0);
      expect(new Date(results[0]?.metadata?.timestamp).toISOString()).toEqual(timestampDate.toISOString());
    });
  });

  describe('Basic vector operations', () => {
    const indexName = 'test_basic_vector_ops_' + Date.now();
    beforeAll(async () => {
      await createIndexAndWait(vectorDB, indexName, 4, 'cosine');
    });
    afterAll(async () => {
      await deleteIndexAndWait(vectorDB, indexName);
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
      await new Promise(resolve => setTimeout(resolve, 5000));
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
      await new Promise(resolve => setTimeout(resolve, 5000));
      const results = await vectorDB.query({
        indexName,
        queryVector: testVectors[0],
        topK: 2,
        includeVector: true,
      });
      expect(results).toHaveLength(2);
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
      await new Promise(resolve => setTimeout(resolve, 5000));
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

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for count to update
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
    it('should return empty results and not throw when semantic search filter matches zero documents', async () => {
      // Use a valid embedding vector matching your test index dimension
      const testEmbedding = [0.1, 0.2, 0.3, 0.4]; // Adjust dimension as needed

      // Should not throw, should return an empty array
      let error: unknown = null;
      let results: any[] = [];
      try {
        results = await vectorDB.query({
          indexName: emptyIndexName,
          queryVector: testEmbedding,
          topK: 2,
          filter: {
            'metadata.label': 'test_filter_validation',
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
