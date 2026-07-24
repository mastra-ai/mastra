import { createVectorTestSuite } from '@internal/storage-test-utils';
import { MongoClient, ObjectId } from 'mongodb';
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

// Tests for GitHub issue #18587 - filterFields index-level filter hints
// https://github.com/mastra-ai/mastra/issues/18587
// These run without a live MongoDB by mocking the collection handle, mirroring
// the constructor unit tests above.
describe('MongoDBVector filterFields (#18587)', () => {
  const makeVector = () => new MongoDBVector({ id: 'test', uri: 'mongodb://localhost:27017', dbName: 'test_db' });

  describe('createIndex', () => {
    const stubCreateIndex = (v: MongoDBVector) => {
      const createSearchIndex = vi.fn().mockResolvedValue(undefined);
      // Collection already exists so createIndex skips db.createCollection.
      (v as any).db = { listCollections: () => ({ hasNext: async () => true }) };
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ createSearchIndex });
      // createIndex now persists to the durable registry collection; stub the registry
      // helpers so these mocked, unconnected instances don't hit a real MongoDB.
      vi.spyOn(v as any, 'readRegistryEntry').mockResolvedValue(null);
      vi.spyOn(v as any, 'writeRegistryEntry').mockResolvedValue(undefined);
      return createSearchIndex;
    };
    const filterPathsOf = (createSearchIndex: ReturnType<typeof vi.fn>) =>
      createSearchIndex.mock.calls[0][0].definition.fields
        .filter((f: any) => f.type === 'filter')
        .map((f: any) => f.path);

    it('registers each filterFields entry as a metadata.<field> filter field', async () => {
      const v = makeVector();
      const createSearchIndex = stubCreateIndex(v);

      await v.createIndex({ indexName: 'idx', dimension: 4, filterFields: ['category', 'tenant_id'] });

      const filterPaths = filterPathsOf(createSearchIndex);
      expect(filterPaths).toEqual(['_id', 'document', 'metadata.category', 'metadata.tenant_id']);
      expect((v as any).declaredFilterPaths.get('idx')).toEqual(
        new Set(['document', 'metadata.category', 'metadata.tenant_id']),
      );
    });

    it('declares only _id and document when filterFields is omitted', async () => {
      const v = makeVector();
      const createSearchIndex = stubCreateIndex(v);

      await v.createIndex({ indexName: 'idx', dimension: 4 });

      expect(filterPathsOf(createSearchIndex)).toEqual(['_id', 'document']);
      expect((v as any).declaredFilterPaths.get('idx')).toEqual(new Set(['document']));
    });

    it('still creates the full-text index when the vector index already exists, without caching paths', async () => {
      const v = makeVector();
      const indexExists = Object.assign(new Error('index already exists'), { codeName: 'IndexAlreadyExists' });
      const createSearchIndex = vi
        .fn()
        .mockRejectedValueOnce(indexExists) // vector index creation
        .mockResolvedValueOnce(undefined); // full-text index creation
      (v as any).db = { listCollections: () => ({ hasNext: async () => true }) };
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ createSearchIndex });
      vi.spyOn(v as any, 'readRegistryEntry').mockResolvedValue(null);
      vi.spyOn(v as any, 'writeRegistryEntry').mockResolvedValue(undefined);

      await v.createIndex({ indexName: 'idx', dimension: 4, filterFields: ['category'] });

      // The shared catch used to swallow IndexAlreadyExists from the first
      // call and skip the second, leaving the full-text index missing.
      expect(createSearchIndex).toHaveBeenCalledTimes(2);
      expect(createSearchIndex.mock.calls[1][0].name).toBe('idx_search_index');
      // The existing index may declare different paths — nothing is cached.
      expect((v as any).declaredFilterPaths.has('idx')).toBe(false);
    });

    it('does NOT auto-create a full-text index for a BYO collection (opt-in) (#round3-fix3)', async () => {
      const v = makeVector();
      const createSearchIndex = stubCreateIndex(v);

      // BYO: collectionName provided. Only the vector index should be created — no companion
      // `${collection}_search_index`.
      await v.createIndex({ indexName: 'idx', dimension: 4, collectionName: 'ops_col' });

      expect(createSearchIndex).toHaveBeenCalledTimes(1);
      expect(createSearchIndex.mock.calls[0][0].type).toBe('vectorSearch');
      // Registry entry must leave textSearchIndexName UNSET until createSearchIndex opts in.
      const writeRegistryEntry = (v as any).writeRegistryEntry as ReturnType<typeof vi.spyOn>;
      const persisted = writeRegistryEntry.mock.calls[0][1];
      expect(persisted.isByo).toBe(true);
      expect(persisted.textSearchIndexName).toBeUndefined();
    });

    it('DOES auto-create the companion full-text index for a MANAGED collection (back-compat) (#round3-fix3)', async () => {
      const v = makeVector();
      const createSearchIndex = stubCreateIndex(v);

      // Managed: no collectionName. Vector index + companion dynamic full-text index.
      await v.createIndex({ indexName: 'idx', dimension: 4 });

      expect(createSearchIndex).toHaveBeenCalledTimes(2);
      expect(createSearchIndex.mock.calls[1][0].name).toBe('idx_search_index');
      expect(createSearchIndex.mock.calls[1][0].type).toBe('search');
    });

    it('throws a USER MastraError when retargeting an index to a different collection (#round3-fix4)', async () => {
      const v = makeVector();
      const createSearchIndex = vi.fn().mockResolvedValue(undefined);
      (v as any).db = { listCollections: () => ({ hasNext: async () => true }) };
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ createSearchIndex });
      vi.spyOn(v as any, 'writeRegistryEntry').mockResolvedValue(undefined);
      // An entry already exists pointing at a DIFFERENT collection.
      vi.spyOn(v as any, 'readRegistryEntry').mockResolvedValue({
        _id: 'idx',
        indexName: 'idx',
        collectionName: 'old_col',
        searchIndexName: 'idx_vector_index',
        isByo: true,
      });

      // Capture the thrown error so we can assert its CLASSIFICATION survives, not just its
      // message: the catch in createIndex must re-throw the pre-classified MastraError as-is
      // rather than re-wrapping it as a generic THIRD_PARTY CREATE_INDEX/FAILED.
      let caught: any;
      try {
        await v.createIndex({ indexName: 'idx', dimension: 4, collectionName: 'new_col' });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeDefined();
      expect(caught.message).toMatch(/already registered against collection "old_col"/);
      // USER category and the CONFLICT id must be preserved for callers/telemetry.
      expect(caught.category).toBe('USER');
      expect(caught.id).toMatch(/CONFLICT/);
      expect(caught.id).not.toMatch(/FAILED/);
      // The conflicting call must not have provisioned any index.
      expect(createSearchIndex).not.toHaveBeenCalled();
    });

    it('allows idempotent re-createIndex against the SAME collection (#round3-fix4)', async () => {
      const v = makeVector();
      const createSearchIndex = vi.fn().mockResolvedValue(undefined);
      (v as any).db = { listCollections: () => ({ hasNext: async () => true }) };
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ createSearchIndex });
      vi.spyOn(v as any, 'writeRegistryEntry').mockResolvedValue(undefined);
      // Existing entry points at the SAME collection this call resolves to.
      vi.spyOn(v as any, 'readRegistryEntry').mockResolvedValue({
        _id: 'idx',
        indexName: 'idx',
        collectionName: 'same_col',
        searchIndexName: 'idx_vector_index',
        isByo: true,
      });

      await expect(
        v.createIndex({ indexName: 'idx', dimension: 4, collectionName: 'same_col' }),
      ).resolves.toBeUndefined();
    });

    it('tolerates the full-text index already existing', async () => {
      const v = makeVector();
      const indexExists = Object.assign(new Error('index already exists'), { codeName: 'IndexAlreadyExists' });
      const createSearchIndex = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(indexExists);
      (v as any).db = { listCollections: () => ({ hasNext: async () => true }) };
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ createSearchIndex });
      vi.spyOn(v as any, 'readRegistryEntry').mockResolvedValue(null);
      vi.spyOn(v as any, 'writeRegistryEntry').mockResolvedValue(undefined);

      await expect(
        v.createIndex({ indexName: 'idx', dimension: 4, filterFields: ['category'] }),
      ).resolves.toBeUndefined();

      // The vector index was created by this call, so its declaration is cached.
      expect((v as any).declaredFilterPaths.get('idx')).toEqual(new Set(['document', 'metadata.category']));
    });
  });

  describe('buildDeclaredMetadataPaths', () => {
    it('prefixes bare names, dedupes, drops blanks, and preserves an existing metadata. prefix', () => {
      const v = makeVector();
      expect(
        (v as any).buildDeclaredMetadataPaths(['category', 'category', 'metadata.tenant', '', '  spaced  ']),
      ).toEqual(['metadata.category', 'metadata.tenant', 'metadata.spaced']);
    });

    it('returns an empty array for undefined or empty input', () => {
      const v = makeVector();
      expect((v as any).buildDeclaredMetadataPaths(undefined)).toEqual([]);
      expect((v as any).buildDeclaredMetadataPaths([])).toEqual([]);
    });
  });

  describe('canPushDownFilter', () => {
    const v = makeVector();
    const declared = new Set(['metadata.category', 'document']);
    const can = (f: any) => (v as any).canPushDownFilter(f, declared);

    it('allows declared fields combined with supported operators', () => {
      expect(can({ 'metadata.category': 'x' })).toBe(true);
      expect(can({ 'metadata.category': { $in: ['a', 'b'] } })).toBe(true);
      expect(can({ 'metadata.category': { $gte: 1, $lt: 10 } })).toBe(true);
      expect(can({ $and: [{ 'metadata.category': 'a' }, { document: 'd' }] })).toBe(true);
    });

    it('rejects filters that reference an undeclared field', () => {
      expect(can({ 'metadata.other': 'x' })).toBe(false);
      expect(can({ $or: [{ 'metadata.category': 'a' }, { 'metadata.other': 'b' }] })).toBe(false);
    });

    it('rejects operators that $vectorSearch.filter does not support', () => {
      expect(can({ 'metadata.category': { $regex: 'x' } })).toBe(false);
      expect(can({ 'metadata.category': { $exists: true } })).toBe(false);
      expect(can({ 'metadata.category': { $size: 2 } })).toBe(false);
    });
  });

  describe('buildProjection document-mode embedding exclusion (#round3-fix2)', () => {
    it('appends a $unset to strip the embedding from metadata in document mode by default', () => {
      const v = makeVector();
      const stages = (v as any).buildProjection('document', false, 'vectorSearchScore');
      // [ {$project: {metadata:'$$ROOT', ...}}, {$unset: 'metadata.embedding'} ]
      expect(stages).toHaveLength(2);
      expect(stages[0].$project.metadata).toBe('$$ROOT');
      expect(stages[0].$project.vector).toBeUndefined();
      expect(stages[1]).toEqual({ $unset: 'metadata.embedding' });
    });

    it('keeps the embedding in metadata AND exposes vector when includeVector is true', () => {
      const v = makeVector();
      const stages = (v as any).buildProjection('document', true, 'vectorSearchScore');
      // No $unset: embedding stays inside metadata; a top-level `vector` is also projected.
      expect(stages).toHaveLength(1);
      expect(stages[0].$project.metadata).toBe('$$ROOT');
      expect(stages[0].$project.vector).toBe('$embedding');
    });

    it('honors a dot-path embeddingFieldName in the $unset', () => {
      const v = new MongoDBVector({
        id: 'test',
        uri: 'mongodb://localhost:27017',
        dbName: 'test_db',
        embeddingFieldPath: 'text.contentEmbedding',
      });
      const stages = (v as any).buildProjection('document', false, 'vectorSearchScore');
      expect(stages[1]).toEqual({ $unset: 'metadata.text.contentEmbedding' });
    });

    it('field mode never $unsets (managed metadata subdocument has no embedding)', () => {
      const v = makeVector();
      const stages = (v as any).buildProjection('field', false, 'vectorSearchScore');
      expect(stages).toHaveLength(1);
      expect(stages[0].$project.metadata).toBe('$metadata');
      expect(stages[0].$project.document).toBe('$document');
    });
  });

  describe('getDeclaredFilterPaths', () => {
    const declaration = (extraFields: any[] = []) => ({
      fields: [
        { type: 'vector', path: 'embedding' },
        { type: 'filter', path: '_id' },
        { type: 'filter', path: 'document' },
        ...extraFields,
      ],
    });

    it('does not cache when the index definition is missing, then hydrates once it is READY', async () => {
      const v = makeVector();
      let indexes: any[] = []; // index not found yet
      const listSearchIndexes = vi.fn(() => ({ toArray: async () => indexes }));
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ listSearchIndexes });

      // Miss: returns an empty set and leaves nothing cached, so a later call retries.
      expect(await (v as any).getDeclaredFilterPaths('idx')).toEqual(new Set());
      expect((v as any).declaredFilterPaths.has('idx')).toBe(false);

      // The index definition becomes available and READY.
      indexes = [
        {
          name: 'idx_vector_index',
          status: 'READY',
          latestDefinition: declaration([{ type: 'filter', path: 'metadata.category' }]),
        },
      ];

      // Now it reads the real declaration (excluding `_id`) and caches it.
      const paths = await (v as any).getDeclaredFilterPaths('idx');
      expect(paths).toEqual(new Set(['document', 'metadata.category']));
      expect((v as any).declaredFilterPaths.get('idx')).toEqual(new Set(['document', 'metadata.category']));
    });

    it('ignores a building latestDefinition until the index is READY (staged-definition race)', async () => {
      const v = makeVector();
      // An index update added metadata.category to the *requested* definition,
      // but the rebuild is still in progress: queries are still served by the
      // previous definition, which does not declare the field.
      let indexes: any[] = [
        {
          name: 'idx_vector_index',
          status: 'BUILDING',
          latestDefinition: declaration([{ type: 'filter', path: 'metadata.category' }]),
        },
      ];
      const listSearchIndexes = vi.fn(() => ({ toArray: async () => indexes }));
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ listSearchIndexes });

      // The staged definition must not be trusted or cached — otherwise
      // pushdown would target a field the active index can't filter on.
      expect(await (v as any).getDeclaredFilterPaths('idx')).toEqual(new Set());
      expect((v as any).declaredFilterPaths.has('idx')).toBe(false);

      // Once the rebuild finishes, the same definition is trusted and cached.
      indexes = [{ ...indexes[0], status: 'READY' }];
      expect(await (v as any).getDeclaredFilterPaths('idx')).toEqual(new Set(['document', 'metadata.category']));
      expect((v as any).declaredFilterPaths.get('idx')).toEqual(new Set(['document', 'metadata.category']));
    });
  });

  describe('query push-down', () => {
    const makeCursor = (docs: any[]) => ({
      toArray: async () => docs,
      map: (cb: (d: any) => any) => ({ toArray: async () => docs.map(cb) }),
    });

    it('passes the metadata filter straight to $vectorSearch when every field is declared', async () => {
      const v = makeVector();
      const aggregate = vi.fn().mockReturnValue(makeCursor([]));
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ aggregate });
      vi.spyOn(v as any, 'getDeclaredFilterPaths').mockResolvedValue(new Set(['metadata.category', 'document']));

      await v.query({ indexName: 'idx', queryVector: [0.1, 0.2], filter: { category: 'news' } });

      // Only the final search pipeline runs — no $match materialisation.
      expect(aggregate).toHaveBeenCalledTimes(1);
      expect(aggregate.mock.calls[0][0][0].$vectorSearch.filter).toEqual({ 'metadata.category': 'news' });
    });

    it('materialises candidate _ids via $match when a field is not declared', async () => {
      const v = makeVector();
      const aggregate = vi.fn().mockReturnValue(makeCursor([{ _id: 'a' }]));
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ aggregate });
      vi.spyOn(v as any, 'getDeclaredFilterPaths').mockResolvedValue(new Set(['document']));

      await v.query({ indexName: 'idx', queryVector: [0.1, 0.2], filter: { category: 'news' } });

      // First aggregate materialises _ids via $match, second runs the search.
      expect(aggregate).toHaveBeenCalledTimes(2);
      expect(aggregate.mock.calls[0][0]).toEqual([
        { $match: { 'metadata.category': 'news' } },
        { $project: { _id: 1 } },
      ]);
      expect(aggregate.mock.calls[1][0][0].$vectorSearch.filter).toEqual({ _id: { $in: ['a'] } });
    });

    it('uses the fallback while an index update declaring the filtered field is still building', async () => {
      const v = makeVector();
      // The *requested* definition declares metadata.category, but the rebuild
      // has not finished — the active index still serves the old definition.
      const listSearchIndexes = vi.fn(() => ({
        toArray: async () => [
          {
            name: 'idx_vector_index',
            status: 'BUILDING',
            latestDefinition: {
              fields: [
                { type: 'vector', path: 'embedding' },
                { type: 'filter', path: '_id' },
                { type: 'filter', path: 'document' },
                { type: 'filter', path: 'metadata.category' },
              ],
            },
          },
        ],
      }));
      const aggregate = vi.fn().mockReturnValue(makeCursor([{ _id: 'a' }]));
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ aggregate, listSearchIndexes });

      await v.query({ indexName: 'idx', queryVector: [0.1, 0.2], filter: { category: 'news' } });

      // Pushing { metadata.category } into $vectorSearch.filter could fail on
      // the active index — the query must take the candidate-ID fallback.
      expect(aggregate).toHaveBeenCalledTimes(2);
      expect(aggregate.mock.calls[0][0]).toEqual([
        { $match: { 'metadata.category': 'news' } },
        { $project: { _id: 1 } },
      ]);
      expect(aggregate.mock.calls[1][0][0].$vectorSearch.filter).toEqual({ _id: { $in: ['a'] } });
    });
  });

  describe('bring-your-own collection', () => {
    const opsCol = 'ops_txns';
    const idxName = 'txn_precedent';
    const searchIdx = 'txn_vec_idx';
    // This block needs a live, connected store. The enclosing filterFields suite
    // only builds mocked, unconnected instances, so own the lifecycle here.
    let byoVector: MongoDBVector;

    beforeAll(async () => {
      byoVector = new MongoDBVector({ uri, dbName, id: 'mongodb-byo-test' });
      await byoVector.connect();
      const col = byoVector['db'].collection(opsCol);
      await col.deleteMany({});
      // Non-collinear vectors: under cosine similarity, collinear vectors (e.g. all-0.1 vs
      // all-0.9) score identically, so 'a' and 'b' must point in different directions for the
      // query to rank 'b' unambiguously first.
      await col.insertMany([
        { _id: 'a', embedding: [1, 0, 0, 0], amount: 100, lane: 'clean' },
        { _id: 'b', embedding: [0, 1, 0, 0], amount: 5000, lane: 'fraud' },
      ]);
      await byoVector.createIndex({
        indexName: idxName,
        dimension: 4,
        collectionName: opsCol,
        searchIndexName: searchIdx,
      });
      await byoVector.waitForIndexReady({ indexName: idxName, timeoutMs: 60000 });
    });

    afterAll(async () => {
      // Drop the operational collection we created, then disconnect.
      await byoVector['db']
        .collection(opsCol)
        .drop()
        .catch(() => {});
      await byoVector.disconnect();
    });

    it('creates the vector index on the operational collection, not a managed one', async () => {
      const idxs = await byoVector['db'].collection(opsCol).listSearchIndexes().toArray();
      expect(idxs.some((i: any) => i.name === searchIdx)).toBe(true);
      const managedExists = await byoVector['db'].listCollections({ name: idxName }).hasNext();
      expect(managedExists).toBe(false);
    });

    it('queries the operational collection and returns full docs as metadata in document mode', async () => {
      // $vectorSearch becomes queryable slightly after the index reports READY, so poll
      // until the just-inserted docs are indexed and 'b' (the exact-match vector) ranks first.
      const queryDocMode = () =>
        byoVector.query({ indexName: idxName, queryVector: [0, 1, 0, 0], topK: 1, metadataMode: 'document' });
      await waitForSync(byoVector, idxName, async () => {
        const r = await queryDocMode();
        return r.length === 1 && r[0].id === 'b';
      });

      const res = await queryDocMode();
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('b');
      expect(res[0].metadata).toMatchObject({ amount: 5000, lane: 'fraud' });
    });

    it('describeIndex reports dimension/metric for a BYO index', async () => {
      const stats = await byoVector.describeIndex({ indexName: idxName });
      expect(stats.dimension).toBe(4);
    });

    it('deleteIndex drops only the search index, not the BYO collection or its documents', async () => {
      // Verify collection and documents exist before deletion
      const col = byoVector['db'].collection(opsCol);
      const docCountBefore = await col.countDocuments();
      expect(docCountBefore).toBe(2);

      // Verify the search index exists
      const idxsBefore = await col.listSearchIndexes().toArray();
      expect(idxsBefore.some((i: any) => i.name === searchIdx)).toBe(true);

      // Delete the index
      await byoVector.deleteIndex({ indexName: idxName });

      // CRITICAL: The BYO collection must still exist with all its documents
      const docCountAfter = await col.countDocuments();
      expect(docCountAfter).toBe(2);

      // Verify the documents are intact
      const docs = await col.find().toArray();
      expect(docs).toHaveLength(2);
      expect(docs.some((d: any) => d._id === 'a' && d.amount === 100)).toBe(true);
      expect(docs.some((d: any) => d._id === 'b' && d.amount === 5000)).toBe(true);

      // Wait for the search index to be dropped (async operation)
      // Poll until the index is gone or timeout
      const maxWait = 30000;
      const pollInterval = 500;
      const startTime = Date.now();
      let indexGone = false;

      while (Date.now() - startTime < maxWait) {
        const idxsAfter = await col.listSearchIndexes().toArray();
        if (!idxsAfter.some((i: any) => i.name === searchIdx)) {
          indexGone = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      expect(indexGone).toBe(true);
    });
  });

  describe('text and hybrid search', () => {
    const searchCol = 'fraud_reports';
    const idxName = 'fraud_precedents';
    const searchIdx = 'fraud_vec_idx';
    let searchVector: MongoDBVector;

    beforeAll(async () => {
      searchVector = new MongoDBVector({ uri, dbName, id: 'mongodb-search-test' });
      await searchVector.connect();
      // Clear any stale registry entry from a previous run: createIndex preserves an existing
      // textSearchIndexName (by design), which would defeat the opt-in assertion below.
      await searchVector['db']
        .collection('__mastra_vector_indexes__')
        .deleteOne({ _id: idxName as any })
        .catch(() => {});
      const col = searchVector['db'].collection(searchCol);
      await col.deleteMany({});
      // Non-collinear vectors: avoid ties under cosine similarity
      await col.insertMany([
        { _id: 'a', embedding: [1, 0, 0, 0], amount: 100, note: 'wire transfer to shell company' },
        { _id: 'b', embedding: [0, 1, 0, 0], amount: 5000, note: 'invoice from offshore entity shell company' },
        { _id: 'c', embedding: [0, 0, 1, 0], amount: 200, note: 'legitimate payment to vendor' },
      ]);
      await searchVector.createIndex({
        indexName: idxName,
        dimension: 4,
        collectionName: searchCol,
        searchIndexName: searchIdx,
      });
      await searchVector.waitForIndexReady({ indexName: idxName, timeoutMs: 60000 });
    });

    afterAll(async () => {
      await searchVector['db']
        .collection(searchCol)
        .drop()
        .catch(() => {});
      await searchVector['db']
        .collection('__mastra_vector_indexes__')
        .deleteOne({ _id: idxName as any })
        .catch(() => {});
      await searchVector.disconnect();
    });

    it('createIndex on a BYO collection does NOT auto-create a dynamic full-text index (opt-in) (#round3-fix3)', async () => {
      // For a BYO collection, createIndex provisions ONLY the vector index. The billable
      // dynamic `${searchCol}_search_index` must NOT appear until the caller opts in via
      // createSearchIndex. This test runs first (before the createSearchIndex test below).
      const col = searchVector['db'].collection(searchCol);
      const idxs = await col.listSearchIndexes().toArray();
      expect(idxs.some((i: any) => i.name === searchIdx)).toBe(true); // vector index present
      expect(idxs.some((i: any) => i.name === `${searchCol}_search_index`)).toBe(false); // no auto text index
      // textQuery without an opted-in text index errors clearly instead of hitting a missing index.
      await expect(
        searchVector.textQuery({ indexName: idxName, query: 'shell company', paths: ['note'], topK: 5 }),
      ).rejects.toThrow(/createSearchIndex|full-text search index/i);
    });

    it('createSearchIndex with fields provisions a DISTINCT field-mapped Atlas Search index', async () => {
      await searchVector.createSearchIndex({ indexName: idxName, fields: ['note'] });
      // With `fields` (and no explicit searchIndexName), the field-mapped index is created under a
      // DISTINCT name that is unique per LOGICAL index (`${searchCol}_${idxName}_search_fields_index`,
      // FIX 6) so two logical indexes on one collection don't collide. textQuery/hybridQuery
      // resolve this persisted name.
      const fieldIndexName = `${searchCol}_${idxName}_search_fields_index`;
      const col = searchVector['db'].collection(searchCol);
      const maxWait = 60000;
      const pollInterval = 1000;
      const startTime = Date.now();
      let indexCreated = false;

      while (Date.now() - startTime < maxWait) {
        const idxs = await col.listSearchIndexes().toArray();
        const searchIndex = idxs.find((i: any) => i.name === fieldIndexName);
        if (searchIndex && searchIndex.status === 'READY') {
          indexCreated = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      expect(indexCreated).toBe(true);
    });

    it('textQuery returns BM25 matches from the search index', async () => {
      // Poll until the search index has indexed the documents
      const queryText = () =>
        searchVector.textQuery({
          indexName: idxName,
          query: 'shell company',
          paths: ['note'],
          topK: 5,
          metadataMode: 'document',
        });

      await waitForSync(searchVector, idxName, async () => {
        const r = await queryText();
        return r.length > 0;
      });

      const res = await queryText();
      expect(res.length).toBeGreaterThan(0);
      // Both 'a' and 'b' contain "shell company" in their notes
      expect(res.some(h => h.metadata?.note?.includes('shell company'))).toBe(true);
    });

    it('hybridQuery fuses vector and text results via $rankFusion', async () => {
      // Query vector closest to 'b' [0,1,0,0], text query matches 'a' and 'b'
      const queryHybrid = () =>
        searchVector.hybridQuery({
          indexName: idxName,
          queryVector: [0, 1, 0, 0],
          query: 'offshore entity',
          paths: ['note'],
          topK: 2,
          metadataMode: 'document',
        });

      await waitForSync(searchVector, idxName, async () => {
        const r = await queryHybrid();
        return r.length > 0;
      });

      const res = await queryHybrid();
      expect(res.length).toBeGreaterThan(0);
      // 'b' matches both vector (exact match to [0,1,0,0]) and text (contains "offshore entity")
      expect(res[0].id).toBe('b');
      // Every fused hit must carry a positive RRF score. This guards the $rankFusion score
      // source: using $meta:'searchScore' (the text-branch score) leaves vector-only hits
      // with no score, which this assertion would catch; $meta:'score' scores every hit.
      expect(res.every(r => typeof r.score === 'number' && r.score > 0)).toBe(true);
      // RRF scores are rank-based reciprocals, so distinct-rank hits get distinct scores.
      if (res.length > 1) expect(res[0].score).toBeGreaterThan(res[1].score);
    });
  });

  describe('deleteIndex BYO classification (unit)', () => {
    const makeVector = () => new MongoDBVector({ id: 'test', uri: 'mongodb://localhost:27017', dbName: 'test_db' });

    it('drops only the search index for a BYO index even when collectionName === indexName', async () => {
      const v = makeVector();
      const drop = vi.fn().mockResolvedValue(undefined);
      const dropSearchIndex = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ drop, dropSearchIndex });
      const deleteRegistryEntry = vi.spyOn(v as any, 'deleteRegistryEntry').mockResolvedValue(undefined);
      // BYO index whose collectionName matches its indexName — name equality cannot
      // distinguish it from a managed index, so the registry flag must govern.
      (v as any).indexTargets.set('docs', { collectionName: 'docs', searchIndexName: 'docs_vec', isByo: true });

      await v.deleteIndex({ indexName: 'docs' });

      expect(dropSearchIndex).toHaveBeenCalledWith('docs_vec');
      expect(drop).not.toHaveBeenCalled();
      expect(deleteRegistryEntry).toHaveBeenCalledWith('docs');
    });

    it('also drops the companion text search index for a BYO index when present (#round3-fix1)', async () => {
      const v = makeVector();
      const drop = vi.fn().mockResolvedValue(undefined);
      const dropSearchIndex = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ drop, dropSearchIndex });
      vi.spyOn(v as any, 'deleteRegistryEntry').mockResolvedValue(undefined);
      // BYO index that has opted into a full-text index via createSearchIndex.
      (v as any).indexTargets.set('docs', {
        collectionName: 'ops',
        searchIndexName: 'docs_vec',
        isByo: true,
        textSearchIndexName: 'ops_search_index',
      });

      await v.deleteIndex({ indexName: 'docs' });

      // Both the vector index AND the persisted text index are dropped; the collection is not.
      expect(dropSearchIndex).toHaveBeenCalledWith('docs_vec');
      expect(dropSearchIndex).toHaveBeenCalledWith('ops_search_index');
      expect(drop).not.toHaveBeenCalled();
    });

    it('does not attempt to drop a text index for a BYO index that never opted in (#round3-fix1)', async () => {
      const v = makeVector();
      const drop = vi.fn().mockResolvedValue(undefined);
      const dropSearchIndex = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ drop, dropSearchIndex });
      vi.spyOn(v as any, 'deleteRegistryEntry').mockResolvedValue(undefined);
      // BYO index with no text index provisioned (textSearchIndexName unset).
      (v as any).indexTargets.set('docs', { collectionName: 'ops', searchIndexName: 'docs_vec', isByo: true });

      await v.deleteIndex({ indexName: 'docs' });

      // Only the vector index is dropped — no phantom text-index drop.
      expect(dropSearchIndex).toHaveBeenCalledTimes(1);
      expect(dropSearchIndex).toHaveBeenCalledWith('docs_vec');
    });

    it('ignores "index not found" when dropping the companion text index (#round3-fix1)', async () => {
      const v = makeVector();
      const drop = vi.fn().mockResolvedValue(undefined);
      const notFound = Object.assign(new Error('index not found'), { codeName: 'IndexNotFound' });
      const dropSearchIndex = vi
        .fn()
        .mockResolvedValueOnce(undefined) // vector index drops fine
        .mockRejectedValueOnce(notFound); // text index already gone
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ drop, dropSearchIndex });
      vi.spyOn(v as any, 'deleteRegistryEntry').mockResolvedValue(undefined);
      (v as any).indexTargets.set('docs', {
        collectionName: 'ops',
        searchIndexName: 'docs_vec',
        isByo: true,
        textSearchIndexName: 'ops_search_index',
      });

      await expect(v.deleteIndex({ indexName: 'docs' })).resolves.toBeUndefined();
      expect(dropSearchIndex).toHaveBeenCalledTimes(2);
    });

    it('drops the collection for a managed index (no registered target)', async () => {
      const v = makeVector();
      const drop = vi.fn().mockResolvedValue(undefined);
      const dropSearchIndex = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ drop, dropSearchIndex });
      // No in-memory target and no durable registry entry → resolves to the managed default.
      vi.spyOn(v as any, 'readRegistryEntry').mockResolvedValue(null);
      vi.spyOn(v as any, 'deleteRegistryEntry').mockResolvedValue(undefined);

      await v.deleteIndex({ indexName: 'managed_idx' });

      expect(drop).toHaveBeenCalledTimes(1);
      expect(dropSearchIndex).not.toHaveBeenCalled();
    });

    it('resolves a BYO target from the durable registry when the in-memory map is empty (restart durability)', async () => {
      const v = makeVector();
      const drop = vi.fn().mockResolvedValue(undefined);
      const dropSearchIndex = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ drop, dropSearchIndex });
      const deleteRegistryEntry = vi.spyOn(v as any, 'deleteRegistryEntry').mockResolvedValue(undefined);
      // Simulate a fresh process: nothing in the in-memory map, but the durable registry
      // still records this index as BYO. resolveIndexTarget must hydrate from it so
      // deleteIndex does NOT drop the caller's operational collection.
      vi.spyOn(v as any, 'readRegistryEntry').mockResolvedValue({
        _id: 'precedents',
        indexName: 'precedents',
        collectionName: 'transactions',
        searchIndexName: 'txn_vec_idx',
        isByo: true,
      });

      await v.deleteIndex({ indexName: 'precedents' });

      expect(dropSearchIndex).toHaveBeenCalledWith('txn_vec_idx');
      expect(drop).not.toHaveBeenCalled();
      expect(deleteRegistryEntry).toHaveBeenCalledWith('precedents');
    });
  });

  // ─── Round 4 external-review fixes (unit) ────────────────────────────────────────────
  describe('round4 fixes (unit)', () => {
    const makeVector = () => new MongoDBVector({ id: 'test', uri: 'mongodb://localhost:27017', dbName: 'test_db' });

    // FIX 1: createSearchIndex must persist a COMPLETE target, and resolveIndexTarget must
    // defensively hydrate missing collectionName/searchIndexName from the managed default.
    it('FIX1: createSearchIndex persists a COMPLETE registry target (never partial)', async () => {
      const v = makeVector();
      const createSearchIndex = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ createSearchIndex });
      // Managed index with a full in-memory target (as createIndex would have set).
      (v as any).indexTargets.set('idx', {
        collectionName: 'idx',
        searchIndexName: 'idx_vector_index',
        isByo: false,
      });
      const writeRegistryEntry = vi.spyOn(v as any, 'writeRegistryEntry').mockResolvedValue(undefined);

      await v.createSearchIndex({ indexName: 'idx', fields: ['note'] });

      const persisted = writeRegistryEntry.mock.calls[0][1];
      // The persisted doc must carry collectionName + searchIndexName + isByo, NOT just
      // textSearchIndexName (which would strand a later resolveIndexTarget with undefined fields).
      expect(persisted.collectionName).toBe('idx');
      expect(persisted.searchIndexName).toBe('idx_vector_index');
      expect(persisted.isByo).toBe(false);
      expect(persisted.textSearchIndexName).toBeDefined();
    });

    it('FIX1: resolveIndexTarget falls back to managed defaults for a partial registry entry', async () => {
      const v = makeVector();
      // A partial/legacy entry that only recorded a textSearchIndexName (the pre-fix bug shape).
      vi.spyOn(v as any, 'readRegistryEntry').mockResolvedValue({
        _id: 'legacy',
        indexName: 'legacy',
        textSearchIndexName: 'legacy_search_index',
      });

      const target = await (v as any).resolveIndexTarget('legacy');
      // Must NOT return undefined — hydrate the managed defaults so downstream ops work.
      expect(target.collectionName).toBe('legacy');
      expect(target.searchIndexName).toBe('legacy_vector_index');
      expect(target.isByo).toBe(false);
      expect(target.textSearchIndexName).toBe('legacy_search_index');
    });

    // FIX 6: field-mapped default name includes the logical indexName so two logical indexes
    // on the same collection get distinct text indexes.
    it('FIX6: field-mapped search index name is unique per logical index', async () => {
      const v = makeVector();
      const createSearchIndex = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ createSearchIndex });
      vi.spyOn(v as any, 'writeRegistryEntry').mockResolvedValue(undefined);
      const target = { collectionName: 'shared_col', searchIndexName: 'a_vec', isByo: true };
      (v as any).indexTargets.set('logical_a', { ...target });
      (v as any).indexTargets.set('logical_b', { ...target, searchIndexName: 'b_vec' });

      await v.createSearchIndex({ indexName: 'logical_a', fields: ['note'] });
      await v.createSearchIndex({ indexName: 'logical_b', fields: ['note'] });

      expect(createSearchIndex.mock.calls[0][0].name).toBe('shared_col_logical_a_search_fields_index');
      expect(createSearchIndex.mock.calls[1][0].name).toBe('shared_col_logical_b_search_fields_index');
      expect(createSearchIndex.mock.calls[0][0].name).not.toBe(createSearchIndex.mock.calls[1][0].name);
    });

    // FIX 4: deleteIndex is retry-safe — a stranded registry entry whose physical index is
    // already gone must still be cleared (and listIndexes stops showing it).
    it('FIX4: deleteIndex clears a stranded registry entry when the physical index is already gone', async () => {
      const v = makeVector();
      const notFound = Object.assign(new Error('index not found'), { codeName: 'IndexNotFound' });
      const drop = vi.fn().mockResolvedValue(undefined);
      const dropSearchIndex = vi.fn().mockRejectedValue(notFound); // physical index already gone
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ drop, dropSearchIndex });
      const deleteRegistryEntry = vi.spyOn(v as any, 'deleteRegistryEntry').mockResolvedValue(undefined);
      vi.spyOn(v as any, 'readRegistryEntry').mockResolvedValue({
        _id: 'stranded',
        indexName: 'stranded',
        collectionName: 'ops',
        searchIndexName: 'stranded_vec',
        isByo: true,
      });

      // Must NOT throw despite the physical drop failing with "not found".
      await expect(v.deleteIndex({ indexName: 'stranded' })).resolves.toBeUndefined();
      // The stranded registry entry is still cleared so listIndexes stops showing it.
      expect(deleteRegistryEntry).toHaveBeenCalledWith('stranded');
    });

    it('FIX4: deleteIndex on a managed index whose collection is already dropped still clears the registry', async () => {
      const v = makeVector();
      const nsNotFound = Object.assign(new Error('ns not found'), { codeName: 'NamespaceNotFound' });
      const drop = vi.fn().mockRejectedValue(nsNotFound);
      const dropSearchIndex = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ drop, dropSearchIndex });
      const deleteRegistryEntry = vi.spyOn(v as any, 'deleteRegistryEntry').mockResolvedValue(undefined);
      vi.spyOn(v as any, 'readRegistryEntry').mockResolvedValue(null); // managed default

      await expect(v.deleteIndex({ indexName: 'managed_gone' })).resolves.toBeUndefined();
      expect(deleteRegistryEntry).toHaveBeenCalledWith('managed_gone');
    });

    // FIX 3: hybridQuery must floor numCandidates at the branch limit (perBranch), not topK,
    // so numCandidates < limit never reaches the server.
    it('FIX3: hybridQuery floors numCandidates at the branch limit (topK:10, numCandidates:10)', async () => {
      const v = makeVector();
      const makeCursor = (docs: any[]) => ({ toArray: async () => docs });
      const aggregate = vi.fn().mockReturnValue(makeCursor([]));
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ aggregate });
      vi.spyOn(v as any, 'assertRankFusionSupported').mockResolvedValue(undefined);
      vi.spyOn(v as any, 'resolveIndexTarget').mockResolvedValue({
        collectionName: 'c',
        searchIndexName: 'c_vec',
        isByo: false,
        textSearchIndexName: 'c_search',
      });

      await v.hybridQuery({
        indexName: 'idx',
        queryVector: [0.1, 0.2],
        query: 'q',
        paths: ['note'],
        topK: 10,
        numCandidates: 10,
      });

      const rankFusion = aggregate.mock.calls[0][0][0].$rankFusion;
      const vectorSearch = rankFusion.input.pipelines.vector[0].$vectorSearch;
      // perBranch = max(topK*4, 20) = 40; candidates must be floored at 40 (>= limit 40).
      expect(vectorSearch.limit).toBe(40);
      expect(vectorSearch.numCandidates).toBeGreaterThanOrEqual(vectorSearch.limit);
      expect(vectorSearch.numCandidates).toBe(40);
    });

    // FIX (round5-1): a large topK (topK*4 > 10000) must not make the branch limit exceed the
    // 10000-capped numCandidates. Cap perBranch at 10000 so numCandidates >= limit still holds.
    it('round5: hybridQuery caps the branch limit at 10000 for large topK (topK:3000)', async () => {
      const v = makeVector();
      const makeCursor = (docs: any[]) => ({ toArray: async () => docs });
      const aggregate = vi.fn().mockReturnValue(makeCursor([]));
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ aggregate });
      vi.spyOn(v as any, 'assertRankFusionSupported').mockResolvedValue(undefined);
      vi.spyOn(v as any, 'resolveIndexTarget').mockResolvedValue({
        collectionName: 'c',
        searchIndexName: 'c_vec',
        isByo: false,
        textSearchIndexName: 'c_search',
      });

      await v.hybridQuery({ indexName: 'idx', queryVector: [0.1, 0.2], query: 'q', paths: ['note'], topK: 3000 });

      const vectorSearch = aggregate.mock.calls[0][0][0].$rankFusion.input.pipelines.vector[0].$vectorSearch;
      // topK*4 = 12000 would exceed the 10000 numCandidates cap; both are clamped to 10000.
      expect(vectorSearch.limit).toBe(10000);
      expect(vectorSearch.numCandidates).toBe(10000);
      expect(vectorSearch.numCandidates).toBeGreaterThanOrEqual(vectorSearch.limit);
    });

    // FIX (round5-2): recreating createSearchIndex for the SAME logical index with different
    // fields must actually change the mapping. createSearchIndex is a no-op on IndexAlreadyExists,
    // so the code must updateSearchIndex in place when the index already exists.
    it('round5: createSearchIndex updates the mapping in place when the index already exists', async () => {
      const v = makeVector();
      // First create succeeds; second call hits IndexAlreadyExists (returns false internally).
      const createSearchIndex = vi.fn().mockRejectedValue({ codeName: 'IndexAlreadyExists' });
      const updateSearchIndex = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ createSearchIndex, updateSearchIndex });
      vi.spyOn(v as any, 'resolveIndexTarget').mockResolvedValue({
        collectionName: 'ops',
        searchIndexName: 'ops_vec',
        isByo: true,
      });
      vi.spyOn(v as any, 'writeRegistryEntry').mockResolvedValue(undefined);

      await v.createSearchIndex({ indexName: 'idx', fields: ['note', 'title'] });

      // Since the index already existed, the mapping is updated in place (not silently skipped).
      const expectedName = 'ops_idx_search_fields_index';
      expect(updateSearchIndex).toHaveBeenCalledTimes(1);
      expect(updateSearchIndex.mock.calls[0][0]).toBe(expectedName);
      const def = updateSearchIndex.mock.calls[0][1];
      expect(def.mappings.dynamic).toBe(false);
      expect(Object.keys(def.mappings.fields).sort()).toEqual(['note', 'title']);
    });

    // Live end-to-end validation showed $rankFusion runs on real Atlas 8.0.x, so the guard admits
    // >= 8.0 (was >= 8.1) and rejects only clearly-unsupported older servers.
    it('round6: assertRankFusionSupported admits MongoDB 8.0.x and rejects 7.x', async () => {
      const okCases = ['8.0.27', '8.0.0', '8.1.0', '9.0.0'];
      for (const version of okCases) {
        const v = makeVector();
        (v as any).db = { admin: () => ({ buildInfo: async () => ({ version }) }) };
        await expect((v as any).assertRankFusionSupported()).resolves.toBeUndefined();
      }
      const badCases = ['7.0.14', '6.0.0'];
      for (const version of badCases) {
        const v = makeVector();
        (v as any).db = { admin: () => ({ buildInfo: async () => ({ version }) }) };
        await expect((v as any).assertRankFusionSupported()).rejects.toThrow(/requires MongoDB >= 8\.0/);
      }
    });

    // FIX 7: document-mode filters operate on ROOT fields (no metadata. prefix); field mode
    // keeps prefixing for back-compat.
    it('FIX7: transformMetadataFilter does NOT prefix bare fields in document mode', () => {
      const v = makeVector();
      expect((v as any).transformMetadataFilter({ lane: 'fraud' }, 'document')).toEqual({ lane: 'fraud' });
      expect((v as any).transformMetadataFilter({ $and: [{ amount: { $gt: 100 } }] }, 'document')).toEqual({
        $and: [{ amount: { $gt: 100 } }],
      });
      // Field (managed) mode still prefixes for back-compat.
      expect((v as any).transformMetadataFilter({ lane: 'fraud' }, 'field')).toEqual({ 'metadata.lane': 'fraud' });
      // Default (no arg) is field mode.
      expect((v as any).transformMetadataFilter({ lane: 'fraud' })).toEqual({ 'metadata.lane': 'fraud' });
    });

    it('FIX7: query threads document metadataMode into the root-field filter', async () => {
      const v = makeVector();
      const makeCursor = (docs: any[]) => ({
        toArray: async () => docs,
        map: (cb: (d: any) => any) => ({ toArray: async () => docs.map(cb) }),
      });
      const aggregate = vi.fn().mockReturnValue(makeCursor([{ _id: 'b' }]));
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ aggregate });
      // No fields declared → fallback materialisation path, which reveals the $match filter.
      vi.spyOn(v as any, 'getDeclaredFilterPaths').mockResolvedValue(new Set());

      await v.query({
        indexName: 'idx',
        queryVector: [0.1, 0.2],
        filter: { lane: 'fraud' },
        metadataMode: 'document',
      });

      // The $match uses the ROOT field, not metadata.lane.
      expect(aggregate.mock.calls[0][0]).toEqual([{ $match: { lane: 'fraud' } }, { $project: { _id: 1 } }]);
    });

    // FIX 2: idToString + buildIdMatch behavior.
    it('FIX2: idToString coerces ObjectId to its hex string', () => {
      const v = makeVector();
      const oid = new ObjectId('507f1f77bcf86cd799439011');
      expect((v as any).idToString(oid)).toBe('507f1f77bcf86cd799439011');
      expect((v as any).idToString('plain-string')).toBe('plain-string');
    });

    it('FIX2: buildIdMatch matches both string and ObjectId for a 24-hex id, string-only otherwise', () => {
      const v = makeVector();
      const hex = '507f1f77bcf86cd799439011';
      const match = (v as any).buildIdMatch(hex);
      expect(match.$in).toBeDefined();
      expect(match.$in[0]).toBe(hex);
      expect(match.$in[1]).toBeInstanceOf(ObjectId);
      // A non-hex (managed UUID/string) id matches as-is, preserving managed string behavior.
      expect((v as any).buildIdMatch('managed-uuid-123')).toBe('managed-uuid-123');
    });

    // FIX 5: text-index readiness waiter polls listSearchIndexes for the resolved text index
    // status === READY.
    it('FIX5: waitForSearchIndexReady resolves once the text index reports READY', async () => {
      const v = makeVector();
      vi.spyOn(v as any, 'resolveIndexTarget').mockResolvedValue({
        collectionName: 'c',
        searchIndexName: 'c_vec',
        isByo: true,
        textSearchIndexName: 'c_text_idx',
      });
      let status = 'BUILDING';
      const listSearchIndexes = vi.fn(() => ({ toArray: async () => [{ name: 'c_text_idx', status }] }));
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ listSearchIndexes });

      // Flip to READY on the second poll.
      setTimeout(() => {
        status = 'READY';
      }, 10);

      await expect(
        v.waitForSearchIndexReady({ indexName: 'idx', timeoutMs: 5000, checkIntervalMs: 5 }),
      ).resolves.toBeUndefined();
      expect(listSearchIndexes).toHaveBeenCalled();
    });

    it('FIX5: waitForSearchIndexReady throws when the text index never becomes ready', async () => {
      const v = makeVector();
      vi.spyOn(v as any, 'resolveIndexTarget').mockResolvedValue({
        collectionName: 'c',
        searchIndexName: 'c_vec',
        isByo: false,
        textSearchIndexName: 'c_text_idx',
      });
      const listSearchIndexes = vi.fn(() => ({ toArray: async () => [{ name: 'c_text_idx', status: 'BUILDING' }] }));
      vi.spyOn(v as any, 'getCollection').mockResolvedValue({ listSearchIndexes });

      await expect(v.waitForSearchIndexReady({ indexName: 'idx', timeoutMs: 30, checkIntervalMs: 5 })).rejects.toThrow(
        /did not become ready/,
      );
    });
  });
});

// ─── Durability: BYO target survives a process restart (registry-backed) ─────────────
// Self-contained live suite: owns its connected instances and cleans up its scratch
// collection. Proves the CRITICAL fix — a BYO index created by one MongoDBVector instance
// is correctly classified as BYO by a SECOND fresh instance (no shared in-memory Map), so
// deleteIndex drops ONLY the search index and preserves the caller's operational collection.
describe('MongoDBVector BYO durability across instances', () => {
  const opsCol = 'durable_ops_txns';
  const idxName = 'durable_precedents';
  const searchIdx = 'durable_txn_vec_idx';

  let creator: MongoDBVector;

  beforeAll(async () => {
    creator = new MongoDBVector({ uri, dbName, id: 'mongodb-durable-creator' });
    await creator.connect();
    await waitForAtlasSearchReady(creator);
    const col = creator['db'].collection(opsCol);
    await col.deleteMany({});
    await col.insertMany([
      { _id: 'a', embedding: [1, 0, 0, 0], amount: 100, lane: 'clean' },
      { _id: 'b', embedding: [0, 1, 0, 0], amount: 5000, lane: 'fraud' },
    ]);
    await creator.createIndex({ indexName: idxName, dimension: 4, collectionName: opsCol, searchIndexName: searchIdx });
    await creator.waitForIndexReady({ indexName: idxName, timeoutMs: 60000 });
  }, 500000);

  afterAll(async () => {
    await creator['db']
      .collection(opsCol)
      .drop()
      .catch(() => {});
    // Clean up the registry entry in case a test path left one behind.
    await creator['db']
      .collection('__mastra_vector_indexes__')
      .deleteOne({ _id: idxName as any })
      .catch(() => {});
    await creator.disconnect();
  });

  it('a fresh instance deleteIndex drops only the search index; the BYO collection + docs SURVIVE', async () => {
    const col = creator['db'].collection(opsCol);
    expect(await col.countDocuments()).toBe(2);

    // Second, fully independent instance — its in-memory indexTargets Map is empty, so it
    // MUST hydrate isByo/collectionName from the durable registry written by `creator`.
    const fresh = new MongoDBVector({ uri, dbName, id: 'mongodb-durable-fresh' });
    await fresh.connect();
    try {
      await fresh.deleteIndex({ indexName: idxName });
    } finally {
      await fresh.disconnect();
    }

    // The operational collection and all documents must be intact.
    expect(await col.countDocuments()).toBe(2);
    const docs = await col.find().toArray();
    expect(docs.some((d: any) => d._id === 'a' && d.amount === 100)).toBe(true);
    expect(docs.some((d: any) => d._id === 'b' && d.amount === 5000)).toBe(true);

    // Only the search index is dropped (async) — poll until gone.
    const start = Date.now();
    let gone = false;
    while (Date.now() - start < 30000) {
      const idxs = await col.listSearchIndexes().toArray();
      if (!idxs.some((i: any) => i.name === searchIdx)) {
        gone = true;
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    expect(gone).toBe(true);
  });
});

// ─── listIndexes returns LOGICAL index names ─────────────────────────────────────────
describe('MongoDBVector listIndexes logical names', () => {
  const opsCol = 'listidx_ops';
  const byoIdx = 'listidx_precedents';
  const byoSearchIdx = 'listidx_vec_idx';
  const managedIdx = 'listidx_managed';

  let store: MongoDBVector;

  beforeAll(async () => {
    store = new MongoDBVector({ uri, dbName, id: 'mongodb-listidx' });
    await store.connect();
    await waitForAtlasSearchReady(store);
    const col = store['db'].collection(opsCol);
    await col.deleteMany({});
    await col.insertOne({ _id: 'a', embedding: [1, 0, 0, 0], lane: 'clean' });
    await store.createIndex({
      indexName: byoIdx,
      dimension: 4,
      collectionName: opsCol,
      searchIndexName: byoSearchIdx,
    });
    await store.waitForIndexReady({ indexName: byoIdx, timeoutMs: 60000 });
    await createIndexAndWait(store, managedIdx, 4, 'cosine');
  }, 500000);

  afterAll(async () => {
    await store.deleteIndex({ indexName: managedIdx }).catch(() => {});
    await store.deleteIndex({ indexName: byoIdx }).catch(() => {});
    await store['db']
      .collection(opsCol)
      .drop()
      .catch(() => {});
    await store.disconnect();
  });

  it('lists the LOGICAL index name for BYO (not the physical collection), and the managed index', async () => {
    const names = await store.listIndexes();
    // BYO index appears under its logical name, NOT its physical collection name.
    expect(names).toContain(byoIdx);
    expect(names).not.toContain(opsCol);
    // Managed index appears (registry-backed).
    expect(names).toContain(managedIdx);
    // The registry collection itself is never listed.
    expect(names).not.toContain('__mastra_vector_indexes__');
  });
});

// ─── metadataMode: 'document' returns a clean source doc (no synthetic score pollution) ──
describe('MongoDBVector document-mode clean projection', () => {
  const opsCol = 'docmode_ops';
  const idxName = 'docmode_idx';
  const searchIdx = 'docmode_vec_idx';

  let store: MongoDBVector;

  beforeAll(async () => {
    store = new MongoDBVector({ uri, dbName, id: 'mongodb-docmode' });
    await store.connect();
    await waitForAtlasSearchReady(store);
    const col = store['db'].collection(opsCol);
    await col.deleteMany({});
    // Note: a real source field literally named `score` must be preserved, NOT clobbered
    // by the synthetic relevance score.
    await col.insertMany([
      { _id: 'a', embedding: [1, 0, 0, 0], amount: 100, score: 42 },
      { _id: 'b', embedding: [0, 1, 0, 0], amount: 5000, score: 99 },
    ]);
    await store.createIndex({ indexName: idxName, dimension: 4, collectionName: opsCol, searchIndexName: searchIdx });
    await store.waitForIndexReady({ indexName: idxName, timeoutMs: 60000 });
  }, 500000);

  afterAll(async () => {
    await store.deleteIndex({ indexName: idxName }).catch(() => {});
    await store['db']
      .collection(opsCol)
      .drop()
      .catch(() => {});
    await store.disconnect();
  });

  it('metadata is the clean source doc: preserves a real `score` field and is not the synthetic relevance score', async () => {
    const runQuery = () =>
      store.query({ indexName: idxName, queryVector: [0, 1, 0, 0], topK: 1, metadataMode: 'document' });
    await waitForSync(store, idxName, async () => {
      const r = await runQuery();
      return r.length === 1 && r[0].id === 'b';
    });

    const res = await runQuery();
    expect(res).toHaveLength(1);
    const hit = res[0];
    // Top-level relevance score is populated by the search stage.
    expect(typeof hit.score).toBe('number');
    // metadata carries the CLEAN source doc: the real `score:99` field survives and was not
    // overwritten by the synthetic relevance score.
    expect(hit.metadata?.score).toBe(99);
    expect(hit.metadata?.amount).toBe(5000);
    // And the synthetic relevance score did not leak in equal to metadata.score.
    expect(hit.metadata?.score).not.toBe(hit.score);
  });

  it('document mode omits the embedding from metadata by default, but retains other source fields (#round3-fix2)', async () => {
    const runQuery = () =>
      store.query({ indexName: idxName, queryVector: [0, 1, 0, 0], topK: 1, metadataMode: 'document' });
    await waitForSync(store, idxName, async () => {
      const r = await runQuery();
      return r.length === 1 && r[0].id === 'b';
    });

    const res = await runQuery();
    const hit = res[0];
    // The large embedding field is stripped from metadata by default (payload bloat fix)...
    expect(hit.metadata?.embedding).toBeUndefined();
    // ...but the rest of the source document is preserved.
    expect(hit.metadata?.amount).toBe(5000);
    expect(hit.metadata?.score).toBe(99);
    // And no top-level vector is returned unless requested.
    expect(hit.vector).toBeUndefined();
  });

  it('document mode includes the embedding in metadata AND exposes vector when includeVector is true (#round3-fix2)', async () => {
    const runQuery = () =>
      store.query({
        indexName: idxName,
        queryVector: [0, 1, 0, 0],
        topK: 1,
        metadataMode: 'document',
        includeVector: true,
      });
    await waitForSync(store, idxName, async () => {
      const r = await runQuery();
      return r.length === 1 && r[0].id === 'b';
    });

    const res = await runQuery();
    const hit = res[0];
    // With includeVector, the embedding is retained inside metadata...
    expect(hit.metadata?.embedding).toEqual([0, 1, 0, 0]);
    // ...and also exposed at the top level via `vector`.
    expect(hit.vector).toEqual([0, 1, 0, 0]);
    expect(hit.metadata?.amount).toBe(5000);
  });
});

// ─── FIX 2: BYO collections with native ObjectId _ids (string-id contract) ───────────────
// Self-contained live suite: owns its connected instance + scratch collection + registry entry.
describe('MongoDBVector BYO ObjectId _ids (round4-fix2)', () => {
  const opsCol = 'objectid_ops_txns';
  const idxName = 'objectid_precedents';
  const searchIdx = 'objectid_vec_idx';

  let store: MongoDBVector;
  const oidA = new ObjectId();
  const oidB = new ObjectId();

  beforeAll(async () => {
    store = new MongoDBVector({ uri, dbName, id: 'mongodb-objectid' });
    await store.connect();
    await waitForAtlasSearchReady(store);
    const col = store['db'].collection(opsCol);
    await col.deleteMany({});
    // Seed with native ObjectId _ids (typical of a BYO operational collection).
    await col.insertMany([
      { _id: oidA, embedding: [1, 0, 0, 0], amount: 100, lane: 'clean' },
      { _id: oidB, embedding: [0, 1, 0, 0], amount: 5000, lane: 'fraud' },
    ] as any);
    await store.createIndex({ indexName: idxName, dimension: 4, collectionName: opsCol, searchIndexName: searchIdx });
    await store.waitForIndexReady({ indexName: idxName, timeoutMs: 60000 });
  }, 500000);

  afterAll(async () => {
    await store['db']
      .collection(opsCol)
      .drop()
      .catch(() => {});
    await store['db']
      .collection('__mastra_vector_indexes__')
      .deleteOne({ _id: idxName as any })
      .catch(() => {});
    await store.disconnect();
  });

  it('query returns ObjectId _ids coerced to string', async () => {
    const runQuery = () =>
      store.query({ indexName: idxName, queryVector: [0, 1, 0, 0], topK: 1, metadataMode: 'document' });
    await waitForSync(store, idxName, async () => {
      const r = await runQuery();
      return r.length === 1 && r[0].id === oidB.toString();
    });

    const res = await runQuery();
    expect(res).toHaveLength(1);
    expect(typeof res[0].id).toBe('string');
    expect(res[0].id).toBe(oidB.toString());
  });

  it('deleteVector by the string id actually removes the ObjectId-keyed doc', async () => {
    const col = store['db'].collection(opsCol);
    expect(await col.countDocuments({ _id: oidA } as any)).toBe(1);

    await store.deleteVector({ indexName: idxName, id: oidA.toString() });

    expect(await col.countDocuments({ _id: oidA } as any)).toBe(0);
    // The other doc is untouched.
    expect(await col.countDocuments({ _id: oidB } as any)).toBe(1);
  });

  it('updateVector by the string id updates the ObjectId-keyed doc', async () => {
    await store.updateVector({
      indexName: idxName,
      id: oidB.toString(),
      update: { metadata: { lane: 'flagged' } },
    });
    const col = store['db'].collection(opsCol);
    const doc = await col.findOne({ _id: oidB } as any);
    expect(doc?.metadata?.lane).toBe('flagged');
  });
});

// ─── FIX 8: describeIndex counts only documents with the embedding field ─────────────────
describe('MongoDBVector describeIndex embedded-only count (round4-fix8)', () => {
  const opsCol = 'count_ops_txns';
  const idxName = 'count_precedents';
  const searchIdx = 'count_vec_idx';

  let store: MongoDBVector;

  beforeAll(async () => {
    store = new MongoDBVector({ uri, dbName, id: 'mongodb-count' });
    await store.connect();
    await waitForAtlasSearchReady(store);
    const col = store['db'].collection(opsCol);
    await col.deleteMany({});
    // Two embedded docs and one NON-embedded operational doc (no embedding field).
    await col.insertMany([
      { _id: 'e1', embedding: [1, 0, 0, 0], amount: 100 },
      { _id: 'e2', embedding: [0, 1, 0, 0], amount: 200 },
      { _id: 'no-embed', amount: 300 },
    ] as any);
    await store.createIndex({ indexName: idxName, dimension: 4, collectionName: opsCol, searchIndexName: searchIdx });
    await store.waitForIndexReady({ indexName: idxName, timeoutMs: 60000 });
  }, 500000);

  afterAll(async () => {
    await store['db']
      .collection(opsCol)
      .drop()
      .catch(() => {});
    await store['db']
      .collection('__mastra_vector_indexes__')
      .deleteOne({ _id: idxName as any })
      .catch(() => {});
    await store.disconnect();
  });

  it('count excludes documents without the embedding field', async () => {
    const stats = await store.describeIndex({ indexName: idxName });
    // 3 docs in the collection, but only 2 carry an embedding.
    expect(stats.count).toBe(2);
    expect(stats.dimension).toBe(4);
  });
});
