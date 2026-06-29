import { createVectorTestSuite } from '@internal/storage-test-utils';
import { MongoClient } from 'mongodb';
import { vi, describe, it, expect, beforeAll, afterAll, test } from 'vitest';
import { MongoDBVector } from './';

// Tests for GitHub issue #6563 - Configurable embedding field path
// https://github.com/mastra-ai/mastra/issues/6563
describe('MongoDBVector embedding field path configuration (#6563)', () => {
  it('should accept an optional embeddingFieldPath parameter', () => {
    // User wants to store embeddings in a nested field like text.contentEmbedding
    expect(() => {
      new MongoDBVector({
        id: 'test',
        uri: 'mongodb://localhost:27017',
        dbName: 'test_db',
        embeddingFieldPath: 'text.contentEmbedding',
      });
    }).not.toThrow();
  });

  it('should default to "embedding" when embeddingFieldPath is not provided', () => {
    const vectorDB = new MongoDBVector({
      id: 'test',
      uri: 'mongodb://localhost:27017',
      dbName: 'test_db',
    });

    // Access the private property via type assertion for testing
    // @ts-expect-error - accessing private property for test validation
    expect(vectorDB.embeddingFieldName).toBe('embedding');
  });

  it('should use custom embedding field path when provided', () => {
    const vectorDB = new MongoDBVector({
      id: 'test',
      uri: 'mongodb://localhost:27017',
      dbName: 'test_db',
      embeddingFieldPath: 'nested.embedding.vector',
    });

    // Access the private property via type assertion for testing
    // @ts-expect-error - accessing private property for test validation
    expect(vectorDB.embeddingFieldName).toBe('nested.embedding.vector');
  });
});

// Tests for GitHub issue #11697 - MongoDBVector constructor
// https://github.com/mastra-ai/mastra/issues/11697
describe('MongoDBVector constructor (#11697)', () => {
  it('should accept "uri" parameter', () => {
    expect(() => {
      new MongoDBVector({
        id: 'test',
        uri: 'mongodb://localhost:27017',
        dbName: 'test_db',
      });
    }).not.toThrow();
  });

  it('should work with MongoDB Atlas connection strings', () => {
    expect(() => {
      new MongoDBVector({
        id: 'test',
        uri: 'mongodb+srv://user:pass@cluster.mongodb.net',
        dbName: 'test_db',
      });
    }).not.toThrow();
  });

  it('should throw clear error when uri is not provided', () => {
    expect(() => {
      new MongoDBVector({
        id: 'test',
        dbName: 'test_db',
      } as any);
    }).toThrow(/uri|connection/i);
  });
});

// Give tests enough time to complete database operations
vi.setConfig({ testTimeout: 300000, hookTimeout: 300000 });

// Concrete MongoDB configuration values – adjust these for your environment
const uri =
  'mongodb://mongodb:mongodb@localhost:27018/?authSource=admin&directConnection=true&serverSelectionTimeoutMS=2000';
const dbName = 'vector_db';

// Track whether Atlas Search readiness has been verified (shared across suites)
let atlasSearchReady = false;

async function waitForAtlasSearchReady(
  vectorDB: MongoDBVector,
  indexName: string = 'dummy_vector_index',
  dimension: number = 1,
  metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine',
  timeout: number = 300000,
  interval: number = 1000,
) {
  if (atlasSearchReady) return;
  const start = Date.now();
  let lastError: any = null;
  let attempt = 0;
  while (Date.now() - start < timeout) {
    attempt++;
    try {
      await vectorDB.createIndex({ indexName, dimension, metric });
      // If it succeeds, we're ready
      console.log(`[waitForAtlasSearchReady] Atlas Search is ready! (attempt ${attempt})`);
      atlasSearchReady = true;
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

// Helper function to wait for a condition with timeout
async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 500,
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) return true;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

// Poll until upserted/updated data is visible to vector search queries
async function waitForSync(
  vectorDB: MongoDBVector,
  indexName: string,
  check: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 200,
): Promise<void> {
  const ok = await waitForCondition(check, timeout, interval);
  if (!ok) throw new Error(`waitForSync timed out for index "${indexName}"`);
}

// Create index and wait until the search index (named `${indexName}_vector_index`) is READY
async function createIndexAndWait(
  vectorDB: MongoDBVector,
  indexName: string,
  dimension: number,
  metric: 'cosine' | 'euclidean' | 'dotproduct',
) {
  await vectorDB.createIndex({ indexName, dimension, metric });
  await vectorDB.waitForIndexReady({ indexName, checkIntervalMs: 500 });
  const created = await waitForCondition(
    async () => {
      const cols = await vectorDB.listIndexes();
      return cols.includes(indexName);
    },
    30000,
    500,
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
      500,
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
    vectorDB = new MongoDBVector({ uri, dbName, id: 'mongodb-test' });
    await vectorDB.connect();

    // Wait for Atlas Search to be ready
    await waitForAtlasSearchReady(vectorDB);

    // Cleanup any existing collections
    try {
      const cols = await vectorDB.listIndexes();
      await Promise.all(cols.map(c => vectorDB.deleteIndex({ indexName: c })));
      const deleted = await waitForCondition(async () => (await vectorDB.listIndexes()).length === 0, 30000, 500);
      if (!deleted) throw new Error('Timed out waiting for collections to be deleted');
    } catch (error) {
      console.error('Failed to delete test collections:', error);
      throw error;
    }

    await Promise.all([
      createIndexAndWait(vectorDB, testIndexName, 4, 'cosine'),
      createIndexAndWait(vectorDB, testIndexName2, 4, 'cosine'),
      createIndexAndWait(vectorDB, emptyIndexName, 4, 'cosine'),
    ]);
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

  describe('Metadata Field Filtering Bug Reproduction', () => {
    const bugTestIndexName = 'metadata_filter_bug_test_' + Date.now();

    beforeAll(async () => {
      // Create index for bug reproduction
      await createIndexAndWait(vectorDB, bugTestIndexName, 4, 'cosine');

      // Insert vectors with thread_id and resource_id in metadata
      // Simulating what the Memory system does
      const vectors = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ];

      const metadata = [
        { thread_id: 'thread-123', resource_id: 'resource-123', message: 'first' },
        { thread_id: 'thread-123', resource_id: 'resource-123', message: 'second' },
        { thread_id: 'thread-456', resource_id: 'resource-456', message: 'third' },
        { thread_id: 'thread-456', resource_id: 'resource-456', message: 'fourth' },
      ];

      await vectorDB.upsert({
        indexName: bugTestIndexName,
        vectors,
        metadata,
      });

      // Wait for indexing
      await waitForSync(vectorDB, bugTestIndexName, async () => {
        const r = await vectorDB.query({ indexName: bugTestIndexName, queryVector: [0.5, 0.5, 0.5, 0.5], topK: 10 });
        return r.length === 4;
      });
    });

    afterAll(async () => {
      await deleteIndexAndWait(vectorDB, bugTestIndexName);
    });

    test('filtering by thread_id WITHOUT metadata prefix works correctly', async () => {
      const results = await vectorDB.query({
        indexName: bugTestIndexName,
        queryVector: [1, 0, 0, 0],
        topK: 10,
        filter: { thread_id: 'thread-123' }, // Now correctly filters by thread_id
      });

      // Verify the fix works - should return only documents from thread-123
      expect(results).toHaveLength(2);
      expect(results.every(r => r.metadata?.thread_id === 'thread-123')).toBe(true);

      // Should NOT contain documents from other threads
      const threadIds = results.map(r => r.metadata?.thread_id);
      expect(threadIds).not.toContain('thread-456');
    });

    test('filtering by resource_id WITHOUT metadata prefix works correctly', async () => {
      const results = await vectorDB.query({
        indexName: bugTestIndexName,
        queryVector: [0, 1, 0, 0],
        topK: 10,
        filter: { resource_id: 'resource-123' }, // Now correctly filters by resource_id
      });

      // Verify the fix works - should return only documents from resource-123
      expect(results).toHaveLength(2);
      expect(results.every(r => r.metadata?.resource_id === 'resource-123')).toBe(true);

      // Should NOT contain documents from other resources
      const resourceIds = results.map(r => r.metadata?.resource_id);
      expect(resourceIds).not.toContain('resource-456');
    });

    test('filtering WITH metadata. prefix works correctly (workaround)', async () => {
      // This is the workaround - using metadata.thread_id
      const results = await vectorDB.query({
        indexName: bugTestIndexName,
        queryVector: [1, 0, 0, 0],
        topK: 10,
        filter: { 'metadata.thread_id': 'thread-123' },
      });

      // This works correctly
      expect(results).toHaveLength(2);
      expect(results[0]?.metadata?.thread_id).toBe('thread-123');
      expect(results[1]?.metadata?.thread_id).toBe('thread-123');
    });

    test('semantic search without filter returns all vectors (shows data exists)', async () => {
      // Verify that the data exists and can be retrieved without filters
      const results = await vectorDB.query({
        indexName: bugTestIndexName,
        queryVector: [0.5, 0.5, 0.5, 0.5],
        topK: 10,
      });

      // Should return all 4 vectors
      expect(results).toHaveLength(4);

      // Verify metadata is stored correctly
      const threadIds = results.map(r => r.metadata?.thread_id);
      expect(threadIds).toContain('thread-123');
      expect(threadIds).toContain('thread-456');
    });
  });

  // ─── Hardening: NODE-7556 ───────────────────────────────────────────────────
  describe('Hardening: NODE-7556', () => {
    test('F2: updateVector with a vector must not throw when collectionForValidation was never set', async () => {
      const indexName = `f2-npe-${Date.now()}`;

      // Create the index and upsert a document via the shared vectorDB instance.
      // createIndex writes the sentinel (__index_metadata__); upsert writes the doc.
      await createIndexAndWait(vectorDB, indexName, 4, 'cosine');
      await vectorDB.upsert({ indexName, vectors: [[1, 0, 0, 0]], ids: ['f2-doc'] });

      // Reproduce the edge case where the Atlas Search index has been modified outside
      // Mastra (e.g. via the Atlas UI or mongosh) but the __index_metadata__ document
      // was not updated alongside it — or was dropped entirely during that operation.
      const rawClient = new MongoClient(uri);
      await rawClient.connect();
      try {
        await rawClient
          .db(dbName)
          .collection(indexName)
          .deleteOne({ _id: '__index_metadata__' as any });
      } finally {
        await rawClient.close();
      }

      // Fresh instance — collectionForValidation is null (upsert was never called on it).
      // describeIndex now returns dimension=0 (no sentinel) → validateVectorDimensions
      // calls setIndexDimension → this.collectionForValidation! is null → TypeError.
      const vectorDB2 = new MongoDBVector({ uri, dbName, id: 'f2-fresh' });
      await vectorDB2.connect();
      try {
        // Currently throws: TypeError: Cannot read properties of null (reading 'updateOne')
        // After fix: resolves without error
        await expect(
          vectorDB2.updateVector({ indexName, id: 'f2-doc', update: { vector: [0.5, 0.5, 0.5, 0.5] } }),
        ).resolves.not.toThrow();
      } finally {
        await vectorDB2.disconnect();
        await deleteIndexAndWait(vectorDB, indexName);
      }
    });

    test.todo(
      'F1: concurrent upserts to the same index must not write dimension metadata to the wrong collection ' +
        '(non-deterministic timing: requires a controlled async yield between upsert calls)',
    );

    test.todo(
      'F6: query with a pre-filter matching >370 000 documents must not hit the 16 MB BSON limit ' +
        '(requires seeding ~400 000 documents — impractical in CI; fix is to pass combinedFilter directly to $vectorSearch)',
    );

    test.todo(
      'F12: upsert immediately after createIndex must not fail with index-not-ready ' +
        '(non-deterministic in atlas-local where indexes become READY within milliseconds; ' +
        'fix: callers must call waitForIndexReady after createIndex before querying — ' +
        'see createIndex JSDoc and the createIndexAndWait helper in this test file)',
    );

    test.todo(
      'F15: getCollection with throwIfNotExists=true must throw after the collection is dropped externally ' +
        '(failure mode is a wrong error message not silence, making a clear red/green assertion impractical; ' +
        'fix: phantom handles are no longer cached when collectionExists=false)',
    );
  });
  // ─────────────────────────────────────────────────────────────────────────────
});

// Shared vector store test suite
const mongodbVector = new MongoDBVector({ uri, dbName, id: 'mongodb-shared-test' });

createVectorTestSuite({
  vector: mongodbVector,
  connect: async () => {
    await mongodbVector.connect();
    await waitForAtlasSearchReady(mongodbVector);
  },
  disconnect: async () => {
    await mongodbVector.disconnect();
  },
  createIndex: async (indexName, options) => {
    await createIndexAndWait(mongodbVector, indexName, 1536, options?.metric ?? 'cosine');
  },
  deleteIndex: async (indexName: string) => {
    await deleteIndexAndWait(mongodbVector, indexName);
  },
  waitForIndexing: async (indexName: string) => {
    // Poll until mongot's $vectorSearch result count matches countDocuments (immediate).
    // Uses a large topK and exact-match check so this works for upserts and deletes:
    //   - Upsert (count goes up):  stale mongot returns fewer  → keeps polling
    //   - Delete (count goes down): stale mongot returns more   → keeps polling
    // For updates (count unchanged), count matches on the first poll so we can't
    // detect the change. A minimum sleep of 1000ms covers this case — mongot on
    // atlas-local CI typically indexes within 200-500ms, so 1000ms is a 2-5× buffer.
    // This is still half the original 2000ms fixed sleep.
    const interval = 200;
    const timeout = 10000;
    const largeTopK = 10000;
    const minSleep = 1000;
    const start = Date.now();
    let firstPoll = true;
    while (Date.now() - start < timeout) {
      try {
        const stats = await mongodbVector.describeIndex({ indexName });
        const docCount = stats?.count ?? 0;
        if (docCount === 0) {
          await mongodbVector.query({ indexName, queryVector: new Array(1536).fill(0.1), topK: 1 });
          return;
        }
        const results = await mongodbVector.query({
          indexName,
          queryVector: new Array(1536).fill(0.1),
          topK: largeTopK,
        });
        if (results.length === docCount) {
          if (firstPoll) {
            // Count matched immediately — likely an update (count didn't change).
            // Sleep to give mongot time to re-index the updated data.
            await new Promise(resolve => setTimeout(resolve, minSleep));
          }
          return;
        }
      } catch {
        // Index not queryable yet — keep polling.
      }
      firstPoll = false;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    // Timeout — don't throw. Let the test assertion surface the real failure.
  },
  supportsContains: false,
  // MongoDB limitations:
  // - $not at top level doesn't work (MongoDB requires $not inside a field filter)
  // - Empty logical operator arrays ($and: [], $or: [], $nor: []) are rejected
  // - Malformed operator syntax returns empty array instead of throwing
  supportsNotOperator: false,
  supportsEmptyLogicalOperators: false,
  supportsStrictOperatorValidation: false,
});
