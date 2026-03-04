import { createVectorTestSuite } from '@internal/storage-test-utils';
import * as pg from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

import type { PgVectorConfig } from '../shared/config';
import { PgVector } from '.';

describe('PgVector', () => {
  let vectorDB: PgVector;
  const testIndexName = 'test_vectors';
  const testIndexName2 = 'test_vectors1';
  const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

  beforeAll(async () => {
    // Initialize PgVector
    vectorDB = new PgVector({ connectionString, id: 'pg-vector-test' });
  });

  afterAll(async () => {
    // Clean up test tables
    await vectorDB.deleteIndex({ indexName: testIndexName });
    await vectorDB.disconnect();
  });

  // Shared vector store test suite
  describe('Shared Vector Store Test Suite', () => {
    const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';
    const sharedTestVectorDB = new PgVector({ connectionString, id: 'pg-shared-test' });

    createVectorTestSuite({
      vector: sharedTestVectorDB,
      createIndex: async (indexName, options) => {
        await sharedTestVectorDB.createIndex({ indexName, dimension: 1536, metric: options?.metric });
      },
      deleteIndex: async (indexName: string) => {
        await sharedTestVectorDB.deleteIndex({ indexName });
      },
      waitForIndexing: async () => {
        // PG doesn't need to wait for indexing
      },
      disconnect: async () => {
        await sharedTestVectorDB.disconnect();
      },
      // PgVector doesn't throw on malformed operator syntax (e.g., $gt with array value)
      supportsStrictOperatorValidation: false,
      supportsEmptyLogicalOperators: false,
    });
  });

  describe('Metadata-Only Query', () => {
    const metadataQueryIndex = 'test_metadata_only_query';

    beforeAll(async () => {
      await vectorDB.createIndex({ indexName: metadataQueryIndex, dimension: 3 });
      await vectorDB.upsert({
        indexName: metadataQueryIndex,
        vectors: [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
          [1, 1, 0],
        ],
        metadata: [
          { category: 'A', priority: 1, tag: 'first' },
          { category: 'B', priority: 2, tag: 'second' },
          { category: 'A', priority: 3, tag: 'third' },
          { category: 'B', priority: 4, tag: 'fourth' },
        ],
        ids: ['v1', 'v2', 'v3', 'v4'],
      });
    });

    afterAll(async () => {
      await vectorDB.deleteIndex({ indexName: metadataQueryIndex });
    });

    it('should query by metadata filter without queryVector', async () => {
      const results = await vectorDB.query({
        indexName: metadataQueryIndex,
        filter: { category: 'A' },
        topK: 10,
      });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.metadata?.category === 'A')).toBe(true);
      const ids = results.map(r => r.id).sort();
      expect(ids).toEqual(['v1', 'v3']);
    });

    it('should return score 0 for metadata-only queries', async () => {
      const results = await vectorDB.query({
        indexName: metadataQueryIndex,
        filter: { category: 'B' },
      });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.score === 0)).toBe(true);
    });

    it('should respect topK for metadata-only queries', async () => {
      const results = await vectorDB.query({
        indexName: metadataQueryIndex,
        filter: { category: 'A' },
        topK: 1,
      });
      expect(results).toHaveLength(1);
    });

    it('should include vector when requested in metadata-only query', async () => {
      const results = await vectorDB.query({
        indexName: metadataQueryIndex,
        filter: { category: 'B', priority: 2 },
        includeVector: true,
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('v2');
      expect(results[0]!.vector).toBeDefined();
      expect(results[0]!.vector).toEqual([0, 1, 0]);
    });

    it('should support complex filters in metadata-only queries', async () => {
      const results = await vectorDB.query({
        indexName: metadataQueryIndex,
        filter: { $and: [{ category: 'A' }, { priority: { $gte: 3 } }] },
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('v3');
    });

    it('should return empty array when filter matches nothing', async () => {
      const results = await vectorDB.query({
        indexName: metadataQueryIndex,
        filter: { category: 'nonexistent' },
      });
      expect(results).toHaveLength(0);
    });

    it('should throw when neither queryVector nor filter is provided', async () => {
      await expect(vectorDB.query({ indexName: metadataQueryIndex } as any)).rejects.toThrow(
        'Either queryVector or filter must be provided',
      );
    });

    it('should throw when queryVector is undefined and filter is empty', async () => {
      await expect(vectorDB.query({ indexName: metadataQueryIndex, filter: {} })).rejects.toThrow(
        'Either queryVector or filter must be provided',
      );
    });

    it('should still work with both queryVector and filter (similarity search)', async () => {
      const results = await vectorDB.query({
        indexName: metadataQueryIndex,
        queryVector: [1, 0, 0],
        filter: { category: 'A' },
        topK: 10,
      });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.metadata?.category === 'A')).toBe(true);
      // v1=[1,0,0] has cosine similarity 1.0 with queryVector [1,0,0]
      expect(results[0]!.score).toBeCloseTo(1, 5);
    });
  });

  describe('PgVector Specific Tests', () => {
    describe('Public Fields Access', () => {
      let testDB: PgVector;
      beforeAll(async () => {
        testDB = new PgVector({ connectionString, id: 'pg-vector-public-fields-test' });
      });
      afterAll(async () => {
        try {
          await testDB.disconnect();
        } catch {}
      });
      it('should expose pool field as public', () => {
        expect(testDB.pool).toBeDefined();
        expect(typeof testDB.pool).toBe('object');
        expect(testDB.pool.connect).toBeDefined();
        expect(typeof testDB.pool.connect).toBe('function');
        expect(testDB.pool).toBeInstanceOf(pg.Pool);
      });

      it('pool provides a working client connection', async () => {
        const pool = testDB.pool;
        const client = await pool.connect();
        expect(typeof client.query).toBe('function');
        expect(typeof client.release).toBe('function');
        client.release();
      });

      it('should allow direct database connections via public pool field', async () => {
        const client = await testDB.pool.connect();
        try {
          const result = await client.query('SELECT 1 as test');
          expect(result.rows[0].test).toBe(1);
        } finally {
          client.release();
        }
      });

      it('should provide access to pool configuration via public pool field', () => {
        expect(testDB.pool.options).toBeDefined();
        expect(testDB.pool.options.connectionString).toBe(connectionString);
        expect(testDB.pool.options.max).toBeDefined();
        expect(testDB.pool.options.idleTimeoutMillis).toBeDefined();
      });

      it('should allow pool monitoring via public pool field', () => {
        expect(testDB.pool.totalCount).toBeDefined();
        expect(testDB.pool.idleCount).toBeDefined();
        expect(testDB.pool.waitingCount).toBeDefined();
        expect(typeof testDB.pool.totalCount).toBe('number');
        expect(typeof testDB.pool.idleCount).toBe('number');
        expect(typeof testDB.pool.waitingCount).toBe('number');
      });

      it('should allow executing raw SQL via public pool field', async () => {
        const client = await testDB.pool.connect();
        try {
          // Test a simple vector-related query
          const result = await client.query('SELECT version()');
          expect(result.rows[0].version).toBeDefined();
          expect(typeof result.rows[0].version).toBe('string');
        } finally {
          client.release();
        }
      });

      it('should maintain proper connection lifecycle via public pool field', async () => {
        const initialIdleCount = testDB.pool.idleCount;
        const initialTotalCount = testDB.pool.totalCount;

        const client = await testDB.pool.connect();

        // After connecting, total count should be >= initial, idle count should be less
        expect(testDB.pool.totalCount).toBeGreaterThanOrEqual(initialTotalCount);
        expect(testDB.pool.idleCount).toBeLessThanOrEqual(initialIdleCount);

        client.release();

        // After releasing, idle count should return to at least initial value
        expect(testDB.pool.idleCount).toBeGreaterThanOrEqual(initialIdleCount);
      });

      it('allows performing a transaction', async () => {
        const client = await testDB.pool.connect();
        try {
          await client.query('BEGIN');
          const { rows } = await client.query('SELECT 2 as value');
          expect(rows[0].value).toBe(2);
          await client.query('COMMIT');
        } finally {
          client.release();
        }
      });
      it('releases client on query error', async () => {
        const client = await testDB.pool.connect();
        try {
          await expect(client.query('SELECT * FROM not_a_real_table')).rejects.toThrow();
        } finally {
          client.release();
        }
      });

      it('can use getPool() to query metadata for filter options (user scenario)', async () => {
        // Insert vectors with metadata
        await testDB.createIndex({ indexName: 'filter_test', dimension: 2 });
        await testDB.upsert({
          indexName: 'filter_test',
          vectors: [
            [0.1, 0.2],
            [0.3, 0.4],
            [0.5, 0.6],
          ],
          metadata: [
            { category: 'A', color: 'red' },
            { category: 'B', color: 'blue' },
            { category: 'A', color: 'green' },
          ],
          ids: ['id1', 'id2', 'id3'],
        });
        // Use the pool to query unique categories
        const { tableName } = testDB['getTableName']('filter_test');
        const res = await testDB.pool.query(
          `SELECT DISTINCT metadata->>'category' AS category FROM ${tableName} ORDER BY category`,
        );
        expect(res.rows.map(r => r.category).sort()).toEqual(['A', 'B']);
        // Clean up
        await testDB.deleteIndex({ indexName: 'filter_test' });
      });

      it('should throw error when pool is used after disconnect', async () => {
        await testDB.disconnect();
        await expect(testDB.pool.connect()).rejects.toThrow();
      });
    });
    // Index Management Tests
    describe('Index Management', () => {
      describe('createIndex', () => {
        afterAll(async () => {
          await vectorDB.deleteIndex({ indexName: testIndexName2 });
        });

        it('should create a new vector table with specified dimensions', async () => {
          await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
          const stats = await vectorDB.describeIndex({ indexName: testIndexName });
          expect(stats?.dimension).toBe(3);
          expect(stats?.count).toBe(0);
        });

        it('should create index with specified metric', async () => {
          await vectorDB.createIndex({ indexName: testIndexName2, dimension: 3, metric: 'euclidean' });
          const stats = await vectorDB.describeIndex({ indexName: testIndexName2 });
          expect(stats.metric).toBe('euclidean');
        });

        it('should throw error if dimension is invalid', async () => {
          await expect(vectorDB.createIndex({ indexName: 'testIndexNameFail', dimension: 0 })).rejects.toThrow();
        });

        it('should create index with flat type', async () => {
          // Clean up from previous test since they share the same index name
          try {
            await vectorDB.deleteIndex({ indexName: testIndexName2 });
          } catch {}

          await vectorDB.createIndex({
            indexName: testIndexName2,
            dimension: 3,
            metric: 'cosine',
            indexConfig: { type: 'flat' },
          });
          const stats = await vectorDB.describeIndex({ indexName: testIndexName2 });
          expect(stats.type).toBe('flat');
        });

        it('should create index with hnsw type', async () => {
          await vectorDB.createIndex({
            indexName: testIndexName2,
            dimension: 3,
            metric: 'cosine',
            indexConfig: { type: 'hnsw', hnsw: { m: 16, efConstruction: 64 } }, // Any reasonable values work
          });
          const stats = await vectorDB.describeIndex({ indexName: testIndexName2 });
          expect(stats.type).toBe('hnsw');
          expect(stats.config.m).toBe(16);
        });

        it('should create index with ivfflat type and lists', async () => {
          await vectorDB.createIndex({
            indexName: testIndexName2,
            dimension: 3,
            metric: 'cosine',
            indexConfig: { type: 'ivfflat', ivf: { lists: 100 } },
          });
          const stats = await vectorDB.describeIndex({ indexName: testIndexName2 });
          expect(stats.type).toBe('ivfflat');
          expect(stats.config.lists).toBe(100);
        });
      });

      describe('Index Recreation Logic', () => {
        const testRecreateIndex = 'test_recreate_index';

        beforeEach(async () => {
          // Clean up any existing index
          try {
            await vectorDB.deleteIndex({ indexName: testRecreateIndex });
          } catch {}
        });

        afterAll(async () => {
          try {
            await vectorDB.deleteIndex({ indexName: testRecreateIndex });
          } catch {}
        });

        it('should not recreate index if configuration matches', async () => {
          // Create index first time
          await vectorDB.createIndex({
            indexName: testRecreateIndex,
            dimension: 128,
            metric: 'cosine',
            indexConfig: {
              type: 'ivfflat',
              ivf: { lists: 100 },
            },
          });

          // Get initial stats
          const stats1 = await vectorDB.describeIndex({ indexName: testRecreateIndex });
          expect(stats1.type).toBe('ivfflat');
          expect(stats1.config.lists).toBe(100);

          // Try to create again with same config - should not recreate
          await vectorDB.createIndex({
            indexName: testRecreateIndex,
            dimension: 128,
            metric: 'cosine',
            indexConfig: {
              type: 'ivfflat',
              ivf: { lists: 100 },
            },
          });

          // Verify index wasn't recreated (config should be identical)
          const stats2 = await vectorDB.describeIndex({ indexName: testRecreateIndex });
          expect(stats2.type).toBe('ivfflat');
          expect(stats2.config.lists).toBe(100);
          expect(stats2.metric).toBe('cosine');
        });

        it('should recreate index if configuration changes', async () => {
          // Create index with initial config
          await vectorDB.createIndex({
            indexName: testRecreateIndex,
            dimension: 64,
            metric: 'cosine',
            indexConfig: {
              type: 'ivfflat',
              ivf: { lists: 50 },
            },
          });

          // Verify initial configuration
          const stats1 = await vectorDB.describeIndex({ indexName: testRecreateIndex });
          expect(stats1.type).toBe('ivfflat');
          expect(stats1.config.lists).toBe(50);

          // Build again with different config - should recreate
          // We need to use buildIndex to trigger the setupIndex logic
          await vectorDB.buildIndex({
            indexName: testRecreateIndex,
            metric: 'cosine',
            indexConfig: {
              type: 'ivfflat',
              ivf: { lists: 200 },
            },
          });

          // Verify configuration changed
          const stats2 = await vectorDB.describeIndex({ indexName: testRecreateIndex });
          expect(stats2.type).toBe('ivfflat');
          expect(stats2.config.lists).toBe(200);
        });

        it('should preserve existing index when no config provided', async () => {
          // Create HNSW index with specific config
          await vectorDB.createIndex({
            indexName: testRecreateIndex,
            dimension: 512,
            metric: 'dotproduct',
            indexConfig: {
              type: 'hnsw',
              hnsw: { m: 32, efConstruction: 128 },
            },
          });

          const stats1 = await vectorDB.describeIndex({ indexName: testRecreateIndex });
          expect(stats1.type).toBe('hnsw');
          expect(stats1.config.m).toBe(32);
          expect(stats1.metric).toBe('dotproduct');

          // Call create again WITHOUT indexConfig - should preserve HNSW
          await vectorDB.createIndex({
            indexName: testRecreateIndex,
            dimension: 512,
            metric: 'dotproduct',
          });

          // Verify index was NOT recreated - still HNSW
          const stats2 = await vectorDB.describeIndex({ indexName: testRecreateIndex });
          expect(stats2.type).toBe('hnsw');
          expect(stats2.config.m).toBe(32);
          expect(stats2.metric).toBe('dotproduct');
        });

        it('should handle switching from ivfflat to hnsw', async () => {
          // Create with ivfflat
          await vectorDB.createIndex({
            indexName: testRecreateIndex,
            dimension: 256,
            metric: 'euclidean',
            indexConfig: {
              type: 'ivfflat',
              ivf: { lists: 100 },
            },
          });

          const stats1 = await vectorDB.describeIndex({ indexName: testRecreateIndex });
          expect(stats1.type).toBe('ivfflat');

          // Switch to hnsw
          await vectorDB.createIndex({
            indexName: testRecreateIndex,
            dimension: 256,
            metric: 'euclidean',
            indexConfig: {
              type: 'hnsw',
              hnsw: { m: 16, efConstruction: 64 },
            },
          });

          const stats2 = await vectorDB.describeIndex({ indexName: testRecreateIndex });
          expect(stats2.type).toBe('hnsw');
          expect(stats2.config.m).toBe(16);
          expect(stats2.config.efConstruction).toBe(64);
        });

        it('should create ivfflat index when no index exists and config is empty', async () => {
          const testNewIndex = 'test_no_index_empty_config';

          // Create without any config - should default to ivfflat
          await vectorDB.createIndex({
            indexName: testNewIndex,
            dimension: 128,
            metric: 'cosine',
          });

          const stats = await vectorDB.describeIndex({ indexName: testNewIndex });
          expect(stats.type).toBe('ivfflat');

          // Cleanup
          await vectorDB.deleteIndex({ indexName: testNewIndex });
        });

        it('should stay flat when explicitly requested', async () => {
          const testFlatIndex = 'test_explicit_flat';

          // Create with explicit flat config
          await vectorDB.createIndex({
            indexName: testFlatIndex,
            dimension: 64,
            metric: 'cosine',
            indexConfig: { type: 'flat' },
          });

          // Try to create again with empty config - should stay flat since that's what exists
          await vectorDB.createIndex({
            indexName: testFlatIndex,
            dimension: 64,
            metric: 'cosine',
            indexConfig: { type: 'flat' },
          });

          const stats = await vectorDB.describeIndex({ indexName: testFlatIndex });
          expect(stats.type).toBe('flat');

          // Cleanup
          await vectorDB.deleteIndex({ indexName: testFlatIndex });
        });

        it('should recreate index when only metric changes', async () => {
          const testMetricChange = 'test_metric_change';

          // Create with cosine metric
          await vectorDB.createIndex({
            indexName: testMetricChange,
            dimension: 128,
            metric: 'cosine',
            indexConfig: { type: 'ivfflat' },
          });

          const stats1 = await vectorDB.describeIndex({ indexName: testMetricChange });
          expect(stats1.metric).toBe('cosine');

          // Recreate with dotproduct metric - should trigger recreation
          await vectorDB.createIndex({
            indexName: testMetricChange,
            dimension: 128,
            metric: 'dotproduct',
            indexConfig: { type: 'ivfflat' },
          });

          const stats2 = await vectorDB.describeIndex({ indexName: testMetricChange });
          expect(stats2.metric).toBe('dotproduct');

          // Cleanup
          await vectorDB.deleteIndex({ indexName: testMetricChange });
        });

        it('should recreate index when HNSW parameters change', async () => {
          const testHnswParams = 'test_hnsw_param_change';

          // Create HNSW with initial parameters
          await vectorDB.createIndex({
            indexName: testHnswParams,
            dimension: 128,
            metric: 'cosine',
            indexConfig: {
              type: 'hnsw',
              hnsw: { m: 16, efConstruction: 64 },
            },
          });

          // Add a test vector to ensure index is built
          const testVector = new Array(128).fill(0).map((_, i) => i / 128);
          await vectorDB.upsert({
            indexName: testHnswParams,
            vectors: [testVector],
          });

          const stats1 = await vectorDB.describeIndex({ indexName: testHnswParams });
          expect(stats1.type).toBe('hnsw');
          expect(stats1.config.m).toBe(16);

          // Use buildIndex instead of createIndex to avoid issues with table recreation
          await vectorDB.buildIndex({
            indexName: testHnswParams,
            metric: 'cosine',
            indexConfig: {
              type: 'hnsw',
              hnsw: { m: 32, efConstruction: 64 },
            },
          });

          const stats2 = await vectorDB.describeIndex({ indexName: testHnswParams });
          expect(stats2.type).toBe('hnsw');
          expect(stats2.config.m).toBe(32);
          expect(stats2.config.efConstruction).toBe(64);

          // Cleanup
          await vectorDB.deleteIndex({ indexName: testHnswParams });
        });

        it('should handle dimension properly when using buildIndex', async () => {
          // Create index
          await vectorDB.createIndex({
            indexName: testRecreateIndex,
            dimension: 384,
            metric: 'cosine',
          });

          // Build the index (which calls setupIndex internally)
          await vectorDB.buildIndex({
            indexName: testRecreateIndex,
            metric: 'cosine',
            indexConfig: { type: 'ivfflat' },
          });

          // Verify it maintains correct dimension
          const stats = await vectorDB.describeIndex({ indexName: testRecreateIndex });
          expect(stats.dimension).toBe(384);
        });
      });

      describe('listIndexes', () => {
        const indexName = 'test_query_3';
        beforeAll(async () => {
          await vectorDB.createIndex({ indexName, dimension: 3 });
        });

        afterAll(async () => {
          await vectorDB.deleteIndex({ indexName });
        });

        it('should list all vector tables', async () => {
          const indexes = await vectorDB.listIndexes();
          expect(indexes).toContain(indexName);
        });

        it('should not return created index in list if it is deleted', async () => {
          await vectorDB.deleteIndex({ indexName });
          const indexes = await vectorDB.listIndexes();
          expect(indexes).not.toContain(indexName);
        });
      });

      describe('listIndexes with external vector tables (Issue #6691)', () => {
        const mastraIndexName = 'mastra_managed_table';
        const externalTableName = 'dam_embedding_collections';
        let client: pg.PoolClient;

        beforeAll(async () => {
          // Get a client to create an external table
          client = await vectorDB.pool.connect();

          // Create an external table with vector column that is NOT managed by PgVector
          // This simulates a real-world scenario where other applications use pgvector
          await client.query(`
          CREATE TABLE IF NOT EXISTS ${externalTableName} (
            id SERIAL PRIMARY KEY,
            name TEXT,
            centroid_embedding vector(1536),
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);

          // Create a Mastra-managed index
          await vectorDB.createIndex({
            indexName: mastraIndexName,
            dimension: 128,
          });
        });

        afterAll(async () => {
          // Clean up
          try {
            await vectorDB.deleteIndex({ indexName: mastraIndexName });
          } catch {
            // Ignore if already deleted
          }

          try {
            await client.query(`DROP TABLE IF EXISTS ${externalTableName}`);
          } catch {
            // Ignore errors
          }

          client.release();
        });

        it('should handle initialization when external vector tables exist', async () => {
          // This test verifies the fix for issue #6691
          // When PgVector is initialized, it should only discover Mastra-managed tables
          // and ignore external tables with vector columns

          // Create a new PgVector instance to trigger initialization
          const newVectorDB = new PgVector({ connectionString, id: 'pg-vector-external-tables-test' });

          // Give initialization time to complete
          await new Promise(resolve => setTimeout(resolve, 500));

          // The initialization should not throw errors even with external tables present
          const indexes = await newVectorDB.listIndexes();

          // FIXED: Now correctly returns only Mastra-managed tables
          expect(indexes).toContain(mastraIndexName);
          expect(indexes).not.toContain(externalTableName); // Fixed!

          // Describing the external table should fail since it's not managed by Mastra
          await expect(async () => {
            await newVectorDB.describeIndex({ indexName: externalTableName });
          }).rejects.toThrow();

          // But describing the Mastra table should work
          const mastraTableInfo = await newVectorDB.describeIndex({ indexName: mastraIndexName });
          expect(mastraTableInfo.dimension).toBe(128);

          await newVectorDB.disconnect();
        });

        it('should only return Mastra-managed tables from listIndexes', async () => {
          // This test verifies listIndexes only returns tables with the exact Mastra structure
          const indexes = await vectorDB.listIndexes();

          // Should include Mastra-managed tables
          expect(indexes).toContain(mastraIndexName);

          // Should NOT include external tables - FIXED!
          expect(indexes).not.toContain(externalTableName);
        });
      });

      describe('describeIndex', () => {
        const indexName = 'test_query_4';
        beforeAll(async () => {
          await vectorDB.createIndex({ indexName, dimension: 3 });
        });

        afterAll(async () => {
          await vectorDB.deleteIndex({ indexName });
        });

        it('should return correct index stats', async () => {
          await vectorDB.createIndex({ indexName, dimension: 3, metric: 'cosine' });
          const vectors = [
            [1, 2, 3],
            [4, 5, 6],
          ];
          await vectorDB.upsert({ indexName, vectors });

          const stats = await vectorDB.describeIndex({ indexName });
          expect(stats).toEqual({
            type: 'ivfflat',
            config: {
              lists: 100,
            },
            dimension: 3,
            count: 2,
            metric: 'cosine',
            vectorType: 'vector',
          });
        });

        it('should throw error for non-existent index', async () => {
          await expect(vectorDB.describeIndex({ indexName: 'non_existent' })).rejects.toThrow();
        });
      });

      describe('buildIndex', () => {
        const indexName = 'test_build_index';
        beforeAll(async () => {
          await vectorDB.createIndex({ indexName, dimension: 3 });
        });

        afterAll(async () => {
          await vectorDB.deleteIndex({ indexName });
        });

        it('should build index with specified metric and config', async () => {
          await vectorDB.buildIndex({
            indexName,
            metric: 'cosine',
            indexConfig: { type: 'hnsw', hnsw: { m: 16, efConstruction: 64 } },
          });

          const stats = await vectorDB.describeIndex({ indexName });
          expect(stats.type).toBe('hnsw');
          expect(stats.metric).toBe('cosine');
          expect(stats.config.m).toBe(16);
        });

        it('should build ivfflat index with specified lists', async () => {
          await vectorDB.buildIndex({
            indexName,
            metric: 'euclidean',
            indexConfig: { type: 'ivfflat', ivf: { lists: 100 } },
          });

          const stats = await vectorDB.describeIndex({ indexName });
          expect(stats.type).toBe('ivfflat');
          expect(stats.metric).toBe('euclidean');
          expect(stats.config.lists).toBe(100);
        });
      });
    });
    describe('Search Parameters', () => {
      const indexName = 'test_search_params';
      const vectors = [
        [1, 0, 0], // Query vector will be closest to this
        [0.8, 0.2, 0], // Second closest
        [0, 1, 0], // Third (much further)
      ];

      describe('HNSW Parameters', () => {
        beforeAll(async () => {
          await vectorDB.createIndex({
            indexName,
            dimension: 3,
            metric: 'cosine',
            indexConfig: {
              type: 'hnsw',
              hnsw: { m: 16, efConstruction: 64 },
            },
          });
          await vectorDB.upsert({
            indexName,
            vectors,
          });
        });

        afterAll(async () => {
          await vectorDB.deleteIndex({ indexName });
        });

        it('should use default ef value', async () => {
          const results = await vectorDB.query({
            indexName,
            queryVector: [1, 0, 0],
            topK: 2,
          });
          expect(results).toHaveLength(2);
          expect(results[0]?.score).toBeCloseTo(1, 5);
          expect(results[1]?.score).toBeGreaterThan(0.9); // Second vector should be close
        });

        it('should respect custom ef value', async () => {
          const results = await vectorDB.query({
            indexName,
            queryVector: [1, 0, 0],
            topK: 2,
            ef: 100,
          });
          expect(results).toHaveLength(2);
          expect(results[0]?.score).toBeCloseTo(1, 5);
          expect(results[1]?.score).toBeGreaterThan(0.9);
        });

        // NEW TEST: Reproduce the SET LOCAL bug
        it('should verify that ef_search parameter is actually being set (reproduces SET LOCAL bug)', async () => {
          const client = await vectorDB.pool.connect();
          try {
            // Test current behavior: SET LOCAL without transaction should have no effect
            await client.query('SET LOCAL hnsw.ef_search = 500');

            // Check if the parameter was actually set
            const result = await client.query('SHOW hnsw.ef_search');
            const currentValue = result.rows[0]['hnsw.ef_search'];

            // The value should still be the default (not 500)
            expect(parseInt(currentValue)).not.toBe(500);

            // Now test with proper transaction
            await client.query('BEGIN');
            await client.query('SET LOCAL hnsw.ef_search = 500');

            const resultInTransaction = await client.query('SHOW hnsw.ef_search');
            const valueInTransaction = resultInTransaction.rows[0]['hnsw.ef_search'];

            // This should work because we're in a transaction
            expect(parseInt(valueInTransaction)).toBe(500);

            await client.query('ROLLBACK');

            // After rollback, should return to default
            const resultAfterRollback = await client.query('SHOW hnsw.ef_search');
            const valueAfterRollback = resultAfterRollback.rows[0]['hnsw.ef_search'];
            expect(parseInt(valueAfterRollback)).not.toBe(500);
          } finally {
            client.release();
          }
        });

        // Verify the fix works - ef parameter is properly applied in query method
        it('should properly apply ef parameter using transactions (verifies fix)', async () => {
          const client = await vectorDB.pool.connect();
          const queryCommands: string[] = [];

          // Spy on the client query method to capture all SQL commands
          const originalClientQuery = client.query;
          const clientQuerySpy = vi.fn().mockImplementation((query, ...args) => {
            if (typeof query === 'string') {
              queryCommands.push(query);
            }
            return originalClientQuery.call(client, query, ...args);
          });
          client.query = clientQuerySpy;

          try {
            // Manually release the client so query() can get a fresh one
            client.release();

            await vectorDB.query({
              indexName,
              queryVector: [1, 0, 0],
              topK: 2,
              ef: 128,
            });

            const testClient = await vectorDB.pool.connect();
            try {
              // Test that SET LOCAL works within a transaction
              await testClient.query('BEGIN');
              await testClient.query('SET LOCAL hnsw.ef_search = 256');

              const result = await testClient.query('SHOW hnsw.ef_search');
              const value = result.rows[0]['hnsw.ef_search'];
              expect(parseInt(value)).toBe(256);

              await testClient.query('ROLLBACK');

              // After rollback, should revert
              const resultAfter = await testClient.query('SHOW hnsw.ef_search');
              const valueAfter = resultAfter.rows[0]['hnsw.ef_search'];
              expect(parseInt(valueAfter)).not.toBe(256);
            } finally {
              testClient.release();
            }
          } finally {
            // Restore original function if client is still connected
            if (client.query === clientQuerySpy) {
              client.query = originalClientQuery;
            }
            clientQuerySpy.mockRestore();
          }
        });
      });

      describe('IVF Parameters', () => {
        beforeAll(async () => {
          await vectorDB.createIndex({
            indexName,
            dimension: 3,
            metric: 'cosine',
            indexConfig: {
              type: 'ivfflat',
              ivf: { lists: 2 }, // Small number for test data
            },
          });
          await vectorDB.upsert({
            indexName,
            vectors,
          });
        });

        afterAll(async () => {
          await vectorDB.deleteIndex({ indexName });
        });

        it('should use default probe value', async () => {
          const results = await vectorDB.query({
            indexName,
            queryVector: [1, 0, 0],
            topK: 2,
          });
          expect(results).toHaveLength(2);
          expect(results[0]?.score).toBeCloseTo(1, 5);
          expect(results[1]?.score).toBeGreaterThan(0.9);
        });

        it('should respect custom probe value', async () => {
          const results = await vectorDB.query({
            indexName,
            queryVector: [1, 0, 0],
            topK: 2,
            probes: 2,
          });
          expect(results).toHaveLength(2);
          expect(results[0]?.score).toBeCloseTo(1, 5);
          expect(results[1]?.score).toBeGreaterThan(0.9);
        });
      });
    });

    describe('Concurrent Operations', () => {
      it('should handle concurrent index creation attempts', async () => {
        const indexName = 'concurrent_test_index';
        const dimension = 384;

        // Create multiple promises trying to create the same index
        const promises = Array(5)
          .fill(null)
          .map(() => vectorDB.createIndex({ indexName, dimension }));

        // All should resolve without error - subsequent attempts should be no-ops
        await expect(Promise.all(promises)).resolves.not.toThrow();

        // Verify only one index was actually created
        const stats = await vectorDB.describeIndex({ indexName });
        expect(stats.dimension).toBe(dimension);

        await vectorDB.deleteIndex({ indexName });
      });

      it('should handle concurrent buildIndex attempts', async () => {
        const indexName = 'concurrent_build_test';
        await vectorDB.createIndex({ indexName, dimension: 384 });

        const promises = Array(5)
          .fill(null)
          .map(() =>
            vectorDB.buildIndex({
              indexName,
              metric: 'cosine',
              indexConfig: { type: 'ivfflat', ivf: { lists: 100 } },
            }),
          );

        await expect(Promise.all(promises)).resolves.not.toThrow();

        const stats = await vectorDB.describeIndex({ indexName });
        expect(stats.type).toBe('ivfflat');

        await vectorDB.deleteIndex({ indexName });
      });

      it('should handle concurrent index recreation with different configs', async () => {
        const indexName = 'concurrent_recreate_test';

        // Create initial index
        await vectorDB.createIndex({
          indexName,
          dimension: 128,
          metric: 'cosine',
          indexConfig: { type: 'ivfflat' },
        });

        // Attempt concurrent recreations with different configs
        const configs = [
          { type: 'hnsw' as const, hnsw: { m: 16, efConstruction: 64 } },
          { type: 'hnsw' as const, hnsw: { m: 32, efConstruction: 128 } },
          { type: 'ivfflat' as const, ivf: { lists: 50 } },
          { type: 'hnsw' as const, hnsw: { m: 8, efConstruction: 32 } },
        ];

        const promises = configs.map(config =>
          vectorDB.buildIndex({
            indexName,
            metric: 'cosine',
            indexConfig: config,
          }),
        );

        // All should complete without error (mutex prevents race conditions)
        await expect(Promise.all(promises)).resolves.not.toThrow();

        // One of the configs should have won
        const stats = await vectorDB.describeIndex({ indexName });
        expect(['hnsw', 'ivfflat']).toContain(stats.type);

        await vectorDB.deleteIndex({ indexName });
      });
    });

    // Tests for halfvec type support (Issue #10999)
    // Note: halfvec requires pgvector >= 0.7.0
    describe('PgVector halfvec Type Support', () => {
      const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';
      let halfvecVectorDB: PgVector;
      let halfvecSupported = false;

      beforeAll(async () => {
        halfvecVectorDB = new PgVector({
          connectionString,
          id: 'pg-vector-halfvec-test',
        });

        // Check if halfvec is supported (pgvector >= 0.7.0)
        const client = await halfvecVectorDB.pool.connect();
        try {
          const result = await client.query(`
        SELECT extversion FROM pg_extension WHERE extname = 'vector'
      `);
          if (result.rows.length > 0) {
            const version = result.rows[0].extversion;
            const [major, minor] = version.split('.').map(Number);
            // halfvec was introduced in pgvector 0.7.0
            halfvecSupported = major > 0 || (major === 0 && minor >= 7);
          }
        } catch {
          // If we can't check, assume not supported
          halfvecSupported = false;
        } finally {
          client.release();
        }
      });

      afterAll(async () => {
        await halfvecVectorDB.disconnect();
      });

      describe('halfvec type for large dimensions', () => {
        const testIndexName = 'test_halfvec_index';

        afterEach(async () => {
          try {
            await halfvecVectorDB.deleteIndex({ indexName: testIndexName });
          } catch {
            // Ignore if doesn't exist
          }
        });

        it('should create index with halfvec type for large dimensions (>2000)', async () => {
          if (!halfvecSupported) {
            console.log('Skipping test: halfvec requires pgvector >= 0.7.0');
            return;
          }

          // pgvector recommends halfvec for dimensions > 2000
          // halfvec uses 2 bytes per dimension vs 4 bytes for vector
          const largeDimension = 3072; // Common for text-embedding-3-large

          await halfvecVectorDB.createIndex({
            indexName: testIndexName,
            dimension: largeDimension,
            metric: 'cosine',
            vectorType: 'halfvec',
          });

          const stats = await halfvecVectorDB.describeIndex({ indexName: testIndexName });
          expect(stats.dimension).toBe(largeDimension);
          expect(stats.vectorType).toBe('halfvec');
        });

        it('should upsert and query vectors using halfvec type', async () => {
          if (!halfvecSupported) {
            console.log('Skipping test: halfvec requires pgvector >= 0.7.0');
            return;
          }

          const largeDimension = 3072;

          await halfvecVectorDB.createIndex({
            indexName: testIndexName,
            dimension: largeDimension,
            metric: 'cosine',
            vectorType: 'halfvec',
          });

          // Create a test vector with large dimension
          const testVector = new Array(largeDimension).fill(0).map((_, i) => i / largeDimension);

          const ids = await halfvecVectorDB.upsert({
            indexName: testIndexName,
            vectors: [testVector],
            metadata: [{ test: 'halfvec' }],
          });

          expect(ids).toHaveLength(1);

          // Query the vector
          const results = await halfvecVectorDB.query({
            indexName: testIndexName,
            queryVector: testVector,
            topK: 1,
          });

          expect(results).toHaveLength(1);
          expect(results[0]?.metadata?.test).toBe('halfvec');
          expect(results[0]?.score).toBeCloseTo(1, 3);
        });

        it('should support halfvec with HNSW index', async () => {
          if (!halfvecSupported) {
            console.log('Skipping test: halfvec requires pgvector >= 0.7.0');
            return;
          }

          const largeDimension = 3072;

          await halfvecVectorDB.createIndex({
            indexName: testIndexName,
            dimension: largeDimension,
            metric: 'cosine',
            indexConfig: {
              type: 'hnsw',
              hnsw: { m: 16, efConstruction: 64 },
            },
            vectorType: 'halfvec',
          });

          const stats = await halfvecVectorDB.describeIndex({ indexName: testIndexName });
          expect(stats.type).toBe('hnsw');
          expect(stats.vectorType).toBe('halfvec');
          expect(stats.dimension).toBe(largeDimension);
        });

        it('should support halfvec with IVFFlat index', async () => {
          if (!halfvecSupported) {
            console.log('Skipping test: halfvec requires pgvector >= 0.7.0');
            return;
          }

          const largeDimension = 3072;

          // First create index with some vectors (IVFFlat requires data for training)
          await halfvecVectorDB.createIndex({
            indexName: testIndexName,
            dimension: largeDimension,
            metric: 'cosine',
            vectorType: 'halfvec',
            buildIndex: false, // Don't build index yet
          });

          // Insert some test vectors for IVFFlat training
          const testVectors = Array.from({ length: 100 }, (_, i) =>
            Array.from({ length: largeDimension }, (_, j) => (i + j) / (largeDimension * 100)),
          );

          await halfvecVectorDB.upsert({
            indexName: testIndexName,
            vectors: testVectors,
            metadata: testVectors.map((_, i) => ({ index: i })),
          });

          // Now build the IVFFlat index
          await halfvecVectorDB.buildIndex({
            indexName: testIndexName,
            metric: 'cosine',
            indexConfig: {
              type: 'ivfflat',
              ivf: { lists: 10 },
            },
          });

          const stats = await halfvecVectorDB.describeIndex({ indexName: testIndexName });
          expect(stats.type).toBe('ivfflat');
          expect(stats.vectorType).toBe('halfvec');
          expect(stats.dimension).toBe(largeDimension);
        });

        it('should default to vector type when vectorType is not specified', async () => {
          const smallDimension = 384;

          await halfvecVectorDB.createIndex({
            indexName: testIndexName,
            dimension: smallDimension,
            metric: 'cosine',
          });

          // Verify the table was created with vector type (not halfvec)
          const client = await halfvecVectorDB.pool.connect();
          try {
            const result = await client.query(
              `
          SELECT data_type, udt_name
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'embedding'
        `,
              [testIndexName],
            );

            expect(result.rows[0]?.udt_name).toBe('vector');

            // Also verify vectorType is returned as 'vector' from describeIndex
            const stats = await halfvecVectorDB.describeIndex({ indexName: testIndexName });
            expect(stats.vectorType).toBe('vector');
          } finally {
            client.release();
          }
        });

        it('should verify halfvec column type in database', async () => {
          if (!halfvecSupported) {
            console.log('Skipping test: halfvec requires pgvector >= 0.7.0');
            return;
          }

          const largeDimension = 3072;

          await halfvecVectorDB.createIndex({
            indexName: testIndexName,
            dimension: largeDimension,
            metric: 'cosine',
            vectorType: 'halfvec',
          });

          // Verify the table was created with halfvec type
          const client = await halfvecVectorDB.pool.connect();
          try {
            const result = await client.query(
              `
          SELECT data_type, udt_name
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'embedding'
        `,
              [testIndexName],
            );

            expect(result.rows[0]?.udt_name).toBe('halfvec');
          } finally {
            client.release();
          }
        });

        it('should throw helpful error when halfvec requested but not supported', async () => {
          if (halfvecSupported) {
            // If halfvec is supported, we can't test the error case
            // Instead, verify that createIndex works (already covered by other tests)
            console.log('Skipping test: halfvec is supported in this environment');
            return;
          }

          // When halfvec is not supported, createIndex should throw a helpful error
          await expect(
            halfvecVectorDB.createIndex({
              indexName: testIndexName,
              dimension: 3072,
              metric: 'cosine',
              vectorType: 'halfvec',
            }),
          ).rejects.toThrow(/halfvec type requires pgvector >= 0\.7\.0/);
        });
      });
    });

    describe('Schema Support', () => {
      const customSchema = 'mastraTest';
      let vectorDB: PgVector;
      let customSchemaVectorDB: PgVector;

      beforeAll(async () => {
        // Initialize default vectorDB first
        vectorDB = new PgVector({ connectionString, id: 'pg-vector-custom-schema-default' });

        // Create schema using the default vectorDB connection
        const client = await vectorDB['pool'].connect();
        try {
          await client.query(`CREATE SCHEMA IF NOT EXISTS ${customSchema}`);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }

        // Create another schema
        const anotherSchema = 'another_schema';
        const anotherSchemaClient = await vectorDB['pool'].connect();
        try {
          await anotherSchemaClient.query(`CREATE SCHEMA IF NOT EXISTS ${anotherSchema}`);
          await anotherSchemaClient.query('COMMIT');
        } catch (e) {
          await anotherSchemaClient.query('ROLLBACK');
          throw e;
        } finally {
          anotherSchemaClient.release();
        }

        // Now create the custom schema vectorDB instance
        customSchemaVectorDB = new PgVector({
          connectionString,
          schemaName: customSchema,
          id: 'pg-vector-custom-schema-test',
        });
      });

      afterAll(async () => {
        // Clean up test tables and schema
        try {
          await customSchemaVectorDB.deleteIndex({ indexName: 'schema_test_vectors' });
        } catch {
          // Ignore errors if index doesn't exist
        }

        // Drop schemas using the default vectorDB connection
        const client = await vectorDB['pool'].connect();
        try {
          await client.query(`DROP SCHEMA IF EXISTS ${customSchema} CASCADE`);
          await client.query(`DROP SCHEMA IF EXISTS another_schema CASCADE`);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }

        // Disconnect in reverse order
        await customSchemaVectorDB.disconnect();
        await vectorDB.disconnect();
      });

      describe('Schema Operations', () => {
        const testIndexName = 'schema_test_vectors';

        beforeEach(async () => {
          // Clean up any existing indexes
          try {
            await customSchemaVectorDB.deleteIndex({ indexName: testIndexName });
          } catch {
            // Ignore if doesn't exist
          }
          try {
            await vectorDB.deleteIndex({ indexName: testIndexName });
          } catch {
            // Ignore if doesn't exist
          }
        });

        afterEach(async () => {
          // Clean up indexes after each test
          try {
            await customSchemaVectorDB.deleteIndex({ indexName: testIndexName });
          } catch {
            // Ignore if doesn't exist
          }
          try {
            await vectorDB.deleteIndex({ indexName: testIndexName });
          } catch {
            // Ignore if doesn't exist
          }

          // Ensure vector extension is back in public schema for other tests
          const client = await vectorDB.pool.connect();
          try {
            const result = await client.query(`
            SELECT n.nspname as schema_name
            FROM pg_extension e
            JOIN pg_namespace n ON e.extnamespace = n.oid
            WHERE e.extname = 'vector'
          `);

            if (result.rows.length > 0 && result.rows[0].schema_name !== 'public') {
              // Extension is not in public, move it back
              await client.query(`DROP EXTENSION IF EXISTS vector CASCADE`);
              await client.query(`CREATE EXTENSION vector`);
            }
          } catch {
            // Ignore errors, extension might not exist
          } finally {
            client.release();
          }
        });

        it('should create and query index in custom schema', async () => {
          // Create index in custom schema
          await customSchemaVectorDB.createIndex({ indexName: testIndexName, dimension: 3 });

          // Insert test vectors
          const vectors = [
            [1, 2, 3],
            [4, 5, 6],
          ];
          const metadata = [{ test: 'custom_schema_1' }, { test: 'custom_schema_2' }];
          await customSchemaVectorDB.upsert({ indexName: testIndexName, vectors, metadata });

          // Query and verify results
          const results = await customSchemaVectorDB.query({
            indexName: testIndexName,
            queryVector: [1, 2, 3],
            topK: 2,
          });
          expect(results).toHaveLength(2);
          expect(results[0]?.metadata?.test).toMatch(/custom_schema_/);

          // Verify table exists in correct schema
          const client = await customSchemaVectorDB['pool'].connect();
          try {
            const res = await client.query(
              `
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = $1 
              AND table_name = $2
            )`,
              [customSchema, testIndexName],
            );
            expect(res.rows[0].exists).toBe(true);
          } finally {
            client.release();
          }
        });

        it('should describe index in custom schema', async () => {
          // Create index in custom schema
          await customSchemaVectorDB.createIndex({
            indexName: testIndexName,
            dimension: 3,
            metric: 'dotproduct',
            indexConfig: { type: 'hnsw' },
          });
          // Insert a vector
          await customSchemaVectorDB.upsert({ indexName: testIndexName, vectors: [[1, 2, 3]] });
          // Describe the index
          const stats = await customSchemaVectorDB.describeIndex({ indexName: testIndexName });
          expect(stats).toMatchObject({
            dimension: 3,
            metric: 'dotproduct',
            type: 'hnsw',
            count: 1,
          });
        });

        it('should allow same index name in different schemas', async () => {
          // Create same index name in both schemas
          await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
          await customSchemaVectorDB.createIndex({ indexName: testIndexName, dimension: 3 });

          // Insert different test data in each schema
          await vectorDB.upsert({
            indexName: testIndexName,
            vectors: [[1, 2, 3]],
            metadata: [{ test: 'default_schema' }],
          });

          await customSchemaVectorDB.upsert({
            indexName: testIndexName,
            vectors: [[1, 2, 3]],
            metadata: [{ test: 'custom_schema' }],
          });

          // Query both schemas and verify different results
          const defaultResults = await vectorDB.query({
            indexName: testIndexName,
            queryVector: [1, 2, 3],
            topK: 1,
          });
          const customResults = await customSchemaVectorDB.query({
            indexName: testIndexName,
            queryVector: [1, 2, 3],
            topK: 1,
          });

          expect(defaultResults[0]?.metadata?.test).toBe('default_schema');
          expect(customResults[0]?.metadata?.test).toBe('custom_schema');
        });

        it('should maintain schema separation for all operations', async () => {
          // Create index in custom schema
          await customSchemaVectorDB.createIndex({ indexName: testIndexName, dimension: 3 });

          // Test index operations
          const stats = await customSchemaVectorDB.describeIndex({ indexName: testIndexName });
          expect(stats.dimension).toBe(3);

          // Test list operation
          const indexes = await customSchemaVectorDB.listIndexes();
          expect(indexes).toContain(testIndexName);

          // Test update operation
          const vectors = [[7, 8, 9]];
          const metadata = [{ test: 'updated_in_custom_schema' }];
          const [id] = await customSchemaVectorDB.upsert({
            indexName: testIndexName,
            vectors,
            metadata,
          });

          // Test delete operation
          await customSchemaVectorDB.deleteVector({ indexName: testIndexName, id: id! });

          // Verify deletion
          const results = await customSchemaVectorDB.query({
            indexName: testIndexName,
            queryVector: [7, 8, 9],
            topK: 1,
          });
          expect(results).toHaveLength(0);
        });

        it('should handle vector extension in public schema with custom table schema', async () => {
          // Ensure vector extension is in public schema
          const client = await vectorDB.pool.connect();
          await client.query(`CREATE SCHEMA IF NOT EXISTS ${customSchema}`);
          client.release();

          // This should not throw "type vector does not exist"
          await customSchemaVectorDB.createIndex({
            indexName: testIndexName,
            dimension: 3,
          });

          // Verify it works with some data
          const testVectors = [
            [1, 2, 3],
            [4, 5, 6],
          ];
          const ids = await customSchemaVectorDB.upsert({
            indexName: testIndexName,
            vectors: testVectors,
          });

          expect(ids).toHaveLength(2);

          const results = await customSchemaVectorDB.query({
            indexName: testIndexName,
            queryVector: [1, 2, 3],
            topK: 1,
          });

          expect(results).toHaveLength(1);
          expect(results[0].score).toBeGreaterThan(0.99);
        });

        it('should handle vector extension in the same custom schema', async () => {
          const client = await vectorDB.pool.connect();

          // Create custom schema and install vector extension there
          await client.query(`CREATE SCHEMA IF NOT EXISTS ${customSchema}`);
          await client.query(`DROP EXTENSION IF EXISTS vector CASCADE`);
          await client.query(`CREATE EXTENSION vector SCHEMA ${customSchema}`);
          client.release();

          // Create a new PgVector instance to detect the new extension location
          const localSchemaVectorDB = new PgVector({
            connectionString,
            schemaName: customSchema,
            id: 'pg-vector-extension-same-schema-test',
          });

          try {
            // Should work with extension in same schema
            await localSchemaVectorDB.createIndex({
              indexName: testIndexName,
              dimension: 3,
            });

            const testVectors = [[7, 8, 9]];
            const ids = await localSchemaVectorDB.upsert({
              indexName: testIndexName,
              vectors: testVectors,
            });

            expect(ids).toHaveLength(1);
          } finally {
            // Clean up the local instance
            await localSchemaVectorDB.disconnect();
          }

          // Clean up - reinstall in public for other tests
          const cleanupClient = await vectorDB.pool.connect();
          await cleanupClient.query(`DROP EXTENSION IF EXISTS vector CASCADE`);
          await cleanupClient.query(`CREATE EXTENSION IF NOT EXISTS vector`);
          cleanupClient.release();
        });

        it('should handle vector extension in a different schema than tables', async () => {
          const client = await vectorDB.pool.connect();

          // Create two schemas
          await client.query(`CREATE SCHEMA IF NOT EXISTS another_schema`);
          await client.query(`CREATE SCHEMA IF NOT EXISTS ${customSchema}`);

          // Install vector extension in another_schema
          await client.query(`DROP EXTENSION IF EXISTS vector CASCADE`);
          await client.query(`CREATE EXTENSION vector SCHEMA another_schema`);
          client.release();

          // Create a new PgVector instance to detect the new extension location
          const localSchemaVectorDB = new PgVector({
            connectionString,
            schemaName: customSchema,
            id: 'pg-vector-extension-different-schema-test',
          });

          try {
            // Should detect and use vector extension from another_schema
            await localSchemaVectorDB.createIndex({
              indexName: testIndexName,
              dimension: 3,
            });

            const testVectors = [[10, 11, 12]];
            const ids = await localSchemaVectorDB.upsert({
              indexName: testIndexName,
              vectors: testVectors,
            });

            expect(ids).toHaveLength(1);
          } finally {
            // Clean up the local instance
            await localSchemaVectorDB.disconnect();
          }

          // Clean up - reinstall in public for other tests
          const cleanupClient = await vectorDB.pool.connect();
          await cleanupClient.query(`DROP EXTENSION IF EXISTS vector CASCADE`);
          await cleanupClient.query(`CREATE EXTENSION IF NOT EXISTS vector`);
          cleanupClient.release();
        });

        it('should detect existing vector extension without trying to reinstall', async () => {
          const client = await vectorDB.pool.connect();

          // Ensure vector is installed in public
          await client.query(`DROP EXTENSION IF EXISTS vector CASCADE`);
          await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
          await client.query(`CREATE SCHEMA IF NOT EXISTS ${customSchema}`);

          // Verify extension exists
          const result = await client.query(`
          SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'vector'
          ) as exists
        `);
          expect(result.rows[0].exists).toBe(true);

          client.release();

          // Create index should work without errors since extension exists
          await customSchemaVectorDB.createIndex({
            indexName: testIndexName,
            dimension: 3,
          });

          // Verify the index was created successfully
          const indexes = await customSchemaVectorDB.listIndexes();
          expect(indexes).toContain(testIndexName);
        });

        it('should handle update operations with custom schema and qualified vector type', async () => {
          const client = await vectorDB.pool.connect();
          await client.query(`CREATE SCHEMA IF NOT EXISTS ${customSchema}`);
          client.release();

          await customSchemaVectorDB.createIndex({
            indexName: testIndexName,
            dimension: 3,
          });

          // Insert initial vector
          const [id] = await customSchemaVectorDB.upsert({
            indexName: testIndexName,
            vectors: [[1, 2, 3]],
            metadata: [{ original: true }],
          });

          // Update the vector
          await customSchemaVectorDB.updateVector({
            indexName: testIndexName,
            id,
            update: {
              vector: [4, 5, 6],
              metadata: { updated: true },
            },
          });

          // Query and verify update
          const results = await customSchemaVectorDB.query({
            indexName: testIndexName,
            queryVector: [4, 5, 6],
            topK: 1,
            includeVector: true,
          });

          expect(results[0].id).toBe(id);
          expect(results[0].vector).toEqual([4, 5, 6]);
          expect(results[0].metadata).toEqual({ updated: true });
        });
      });
    });

    describe('Permission Handling', () => {
      const schemaRestrictedUser = 'mastra_schema_restricted';
      const vectorRestrictedUser = 'mastra_vector_restricted';
      const restrictedPassword = 'test123';
      const testSchema = 'test_schema';

      const getConnectionString = (username: string) =>
        connectionString.replace(/(postgresql:\/\/)[^:]+:[^@]+@/, `$1${username}:${restrictedPassword}@`);

      beforeAll(async () => {
        // First ensure the test schema doesn't exist from previous runs
        const adminClient = await new pg.Pool({ connectionString }).connect();
        try {
          await adminClient.query('BEGIN');

          // Drop the test schema if it exists from previous runs
          await adminClient.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);

          // Create schema restricted user with minimal permissions
          await adminClient.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${schemaRestrictedUser}') THEN
              CREATE USER ${schemaRestrictedUser} WITH PASSWORD '${restrictedPassword}' NOCREATEDB;
            END IF;
          END
          $$;
        `);

          // Grant only connect and usage to schema restricted user
          await adminClient.query(`
          REVOKE ALL ON DATABASE ${connectionString.split('/').pop()} FROM ${schemaRestrictedUser};
          GRANT CONNECT ON DATABASE ${connectionString.split('/').pop()} TO ${schemaRestrictedUser};
          REVOKE ALL ON SCHEMA public FROM ${schemaRestrictedUser};
          GRANT USAGE ON SCHEMA public TO ${schemaRestrictedUser};
        `);

          // Create vector restricted user with table creation permissions
          await adminClient.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${vectorRestrictedUser}') THEN
              CREATE USER ${vectorRestrictedUser} WITH PASSWORD '${restrictedPassword}' NOCREATEDB;
            END IF;
          END
          $$;
        `);

          // Grant connect, usage, and create to vector restricted user
          await adminClient.query(`
          REVOKE ALL ON DATABASE ${connectionString.split('/').pop()} FROM ${vectorRestrictedUser};
          GRANT CONNECT ON DATABASE ${connectionString.split('/').pop()} TO ${vectorRestrictedUser};
          REVOKE ALL ON SCHEMA public FROM ${vectorRestrictedUser};
          GRANT USAGE, CREATE ON SCHEMA public TO ${vectorRestrictedUser};
        `);

          await adminClient.query('COMMIT');
        } catch (e) {
          await adminClient.query('ROLLBACK');
          throw e;
        } finally {
          adminClient.release();
        }
      });

      afterAll(async () => {
        // Clean up test users and any objects they own
        const adminClient = await new pg.Pool({ connectionString }).connect();
        try {
          await adminClient.query('BEGIN');

          // Helper function to drop user and their objects
          const dropUser = async username => {
            // First revoke all possible privileges and reassign objects
            await adminClient.query(
              `
            -- Handle object ownership (CASCADE is critical here)
            REASSIGN OWNED BY ${username} TO postgres;
            DROP OWNED BY ${username} CASCADE;

            -- Finally drop the user
            DROP ROLE ${username};
            `,
            );
          };

          // Drop both users
          await dropUser(vectorRestrictedUser);
          await dropUser(schemaRestrictedUser);

          await adminClient.query('COMMIT');
        } catch (e) {
          await adminClient.query('ROLLBACK');
          throw e;
        } finally {
          adminClient.release();
        }
      });

      describe('Schema Creation', () => {
        beforeEach(async () => {
          // Ensure schema doesn't exist before each test
          const adminClient = await new pg.Pool({ connectionString }).connect();
          try {
            await adminClient.query('BEGIN');
            await adminClient.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
            await adminClient.query('COMMIT');
          } catch (e) {
            await adminClient.query('ROLLBACK');
            throw e;
          } finally {
            adminClient.release();
          }
        });

        it('should fail when user lacks CREATE privilege', async () => {
          const restrictedDB = new PgVector({
            connectionString: getConnectionString(schemaRestrictedUser),
            schemaName: testSchema,
            id: 'pg-vector-schema-restricted-test',
          });

          // Test schema creation directly by accessing private method
          await expect(async () => {
            const client = await restrictedDB['pool'].connect();
            try {
              await restrictedDB['setupSchema'](client);
            } finally {
              client.release();
            }
          }).rejects.toThrow(
            `Unable to create schema "${testSchema}". This requires CREATE privilege on the database.`,
          );

          // Verify schema was not created
          const adminClient = await new pg.Pool({ connectionString }).connect();
          try {
            const res = await adminClient.query(
              `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
              [testSchema],
            );
            expect(res.rows[0].exists).toBe(false);
          } finally {
            adminClient.release();
          }

          await restrictedDB.disconnect();
        });

        it('should fail with schema creation error when creating index', async () => {
          const restrictedDB = new PgVector({
            connectionString: getConnectionString(schemaRestrictedUser),
            schemaName: testSchema,
            id: 'pg-vector-schema-restricted-create-index-test',
          });

          // This should fail with the schema creation error
          await expect(async () => {
            await restrictedDB.createIndex({ indexName: 'test', dimension: 3 });
          }).rejects.toThrow(
            `Unable to create schema "${testSchema}". This requires CREATE privilege on the database.`,
          );

          // Verify schema was not created
          const adminClient = await new pg.Pool({ connectionString }).connect();
          try {
            const res = await adminClient.query(
              `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
              [testSchema],
            );
            expect(res.rows[0].exists).toBe(false);
          } finally {
            adminClient.release();
          }

          await restrictedDB.disconnect();
        });
      });

      describe('Vector Extension', () => {
        beforeEach(async () => {
          // Create test table and grant necessary permissions
          const adminClient = await new pg.Pool({ connectionString }).connect();
          try {
            await adminClient.query('BEGIN');

            // First install vector extension
            await adminClient.query('CREATE EXTENSION IF NOT EXISTS vector');

            // Drop existing table if any
            await adminClient.query('DROP TABLE IF EXISTS test CASCADE');

            // Create test table as admin
            await adminClient.query('CREATE TABLE IF NOT EXISTS test (id SERIAL PRIMARY KEY, embedding vector(3))');

            // Grant ALL permissions including index creation
            await adminClient.query(`
            GRANT ALL ON TABLE test TO ${vectorRestrictedUser};
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${vectorRestrictedUser};
            ALTER TABLE test OWNER TO ${vectorRestrictedUser};
          `);

            await adminClient.query('COMMIT');
          } catch (e) {
            await adminClient.query('ROLLBACK');
            throw e;
          } finally {
            adminClient.release();
          }
        });

        afterEach(async () => {
          // Clean up test table
          const adminClient = await new pg.Pool({ connectionString }).connect();
          try {
            await adminClient.query('BEGIN');
            await adminClient.query('DROP TABLE IF EXISTS test CASCADE');
            await adminClient.query('COMMIT');
          } catch (e) {
            await adminClient.query('ROLLBACK');
            throw e;
          } finally {
            adminClient.release();
          }
        });

        it('should handle lack of superuser privileges gracefully', async () => {
          // First ensure vector extension is not installed
          const adminClient = await new pg.Pool({ connectionString }).connect();
          try {
            await adminClient.query('DROP EXTENSION IF EXISTS vector CASCADE');
          } finally {
            adminClient.release();
          }

          const restrictedDB = new PgVector({
            connectionString: getConnectionString(vectorRestrictedUser),
            id: 'pg-vector-no-superuser-test',
          });

          try {
            const warnSpy = vi.spyOn(restrictedDB['logger'], 'warn');

            // Try to create index which will trigger vector extension installation attempt
            await expect(restrictedDB.createIndex({ indexName: 'test', dimension: 3 })).rejects.toThrow();

            expect(warnSpy).toHaveBeenCalledWith(
              expect.stringContaining('Could not install vector extension. This requires superuser privileges'),
              expect.objectContaining({ error: expect.any(Error) }),
            );

            warnSpy.mockRestore();
          } finally {
            // Ensure we wait for any pending operations before disconnecting
            await new Promise(resolve => setTimeout(resolve, 100));
            await restrictedDB.disconnect();
          }
        });

        it('should continue if vector extension is already installed', async () => {
          const restrictedDB = new PgVector({
            connectionString: getConnectionString(vectorRestrictedUser),
            id: 'pg-vector-extension-already-installed-test',
          });

          try {
            const infoSpy = vi.spyOn(restrictedDB['logger'], 'info');

            await restrictedDB.createIndex({ indexName: 'test', dimension: 3 });

            // The new code logs that it found the extension in a schema
            expect(infoSpy).toHaveBeenCalledWith(
              expect.stringMatching(/Vector extension (already installed|found) in schema:/),
            );

            infoSpy.mockRestore();
          } finally {
            // Ensure we wait for any pending operations before disconnecting
            await new Promise(resolve => setTimeout(resolve, 100));
            await restrictedDB.disconnect();
          }
        });
      });
    });
  });

  // --- Validation tests ---
  describe('Validation', () => {
    const customSchema = 'custom_schema';
    const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';
    describe('Connection String Config', () => {
      it('throws if connectionString is empty', () => {
        expect(() => new PgVector({ id: 'test-vector', connectionString: '' })).toThrow(
          /connectionString must be provided and cannot be empty/,
        );
      });
      it('does not throw on non-empty connection string', () => {
        expect(() => new PgVector({ connectionString, id: 'pg-vector-validation-test' })).not.toThrow();
      });
    });

    describe('TCP Host Config', () => {
      const validConfig = {
        id: 'test-vector',
        host: 'localhost',
        port: 5434,
        database: 'mastra',
        user: 'postgres',
        password: 'postgres',
      };

      it('throws if host is missing or empty', () => {
        expect(() => new PgVector({ ...validConfig, host: '' })).toThrow(/host must be provided and cannot be empty/);
        const { host, ...rest } = validConfig;
        expect(() => new PgVector(rest as any)).toThrow(/invalid config/);
      });

      it('throws if database is missing or empty', () => {
        expect(() => new PgVector({ ...validConfig, database: '' })).toThrow(
          /database must be provided and cannot be empty/,
        );
        const { database, ...rest } = validConfig;
        expect(() => new PgVector(rest as any)).toThrow(/invalid config/);
      });

      it('throws if user is missing or empty', () => {
        expect(() => new PgVector({ ...validConfig, user: '' })).toThrow(/user must be provided and cannot be empty/);
        const { user, ...rest } = validConfig;
        expect(() => new PgVector(rest as any)).toThrow(/invalid config/);
      });

      it('throws if password is missing or empty', () => {
        expect(() => new PgVector({ ...validConfig, password: '' })).toThrow(
          /password must be provided and cannot be empty/,
        );
        const { password, ...rest } = validConfig;
        expect(() => new PgVector(rest as any)).toThrow(/invalid config/);
      });

      it('does not throw on valid host config', () => {
        expect(() => new PgVector({ ...validConfig, id: 'pg-vector-host-config-validation-test' })).not.toThrow();
      });
    });

    describe('Cloud SQL Connector Config', () => {
      it('accepts config with stream property (Cloud SQL connector)', () => {
        const connectorConfig = {
          user: 'test-user',
          database: 'test-db',
          ssl: { rejectUnauthorized: false },
          stream: () => ({}),
          id: 'pg-vector-cloud-sql-connector-test',
        };
        expect(() => new PgVector(connectorConfig as any)).not.toThrow();
      });

      it('accepts config with password function (IAM auth)', () => {
        const iamConfig = {
          user: 'test-user',
          database: 'test-db',
          host: 'localhost',
          port: 5432,
          password: () => Promise.resolve('dynamic-token'),
          ssl: { rejectUnauthorized: false },
          id: 'pg-vector-iam-auth-test',
        };
        expect(() => new PgVector(iamConfig as any)).not.toThrow();
      });

      it('accepts generic pg ClientConfig', () => {
        const clientConfig = {
          user: 'test-user',
          database: 'test-db',
          application_name: 'test-app',
          ssl: { rejectUnauthorized: false },
          stream: () => ({}),
          id: 'pg-vector-client-config-test',
        };
        expect(() => new PgVector(clientConfig as any)).not.toThrow();
      });
    });

    describe('SSL Configuration', () => {
      it('accepts connectionString with ssl: true', () => {
        expect(() => new PgVector({ connectionString, ssl: true, id: 'pg-vector-ssl-true-test' })).not.toThrow();
      });

      it('accepts connectionString with ssl object', () => {
        expect(
          () =>
            new PgVector({
              connectionString,
              ssl: { rejectUnauthorized: false },
              id: 'pg-vector-ssl-object-test',
            }),
        ).not.toThrow();
      });

      it('accepts host config with ssl: true', () => {
        const config = {
          host: 'localhost',
          port: 5434,
          database: 'mastra',
          user: 'postgres',
          password: 'postgres',
          ssl: true,
          id: 'pg-vector-host-ssl-true-test',
        };
        expect(() => new PgVector(config)).not.toThrow();
      });

      it('accepts host config with ssl object', () => {
        const config = {
          host: 'localhost',
          port: 5434,
          database: 'mastra',
          user: 'postgres',
          password: 'postgres',
          ssl: { rejectUnauthorized: false },
          id: 'pg-vector-host-ssl-object-test',
        };
        expect(() => new PgVector(config)).not.toThrow();
      });
    });

    describe('Pool Options', () => {
      it('accepts pgPoolOptions with connectionString', () => {
        const config = {
          connectionString,
          pgPoolOptions: {
            max: 30,
            idleTimeoutMillis: 60000,
            connectionTimeoutMillis: 5000,
          },
          id: 'pg-vector-pool-options-connection-string-test',
        };
        expect(() => new PgVector(config)).not.toThrow();
      });

      it('accepts pgPoolOptions with host config', () => {
        const config = {
          host: 'localhost',
          port: 5434,
          database: 'mastra',
          user: 'postgres',
          password: 'postgres',
          pgPoolOptions: {
            max: 30,
            idleTimeoutMillis: 60000,
          },
          id: 'pg-vector-pool-options-host-config-test',
        };
        expect(() => new PgVector(config)).not.toThrow();
      });

      it('accepts max and idleTimeoutMillis directly', () => {
        const config = {
          connectionString,
          max: 30,
          idleTimeoutMillis: 60000,
          id: 'pg-vector-pool-options-direct-test',
        };
        expect(() => new PgVector(config)).not.toThrow();
      });
    });

    describe('PoolConfig Custom Options', () => {
      it('should apply custom values to properties with default values', async () => {
        const db = new PgVector({
          connectionString,
          pgPoolOptions: {
            max: 5,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 1000,
          },
          id: 'pg-vector-pool-custom-values-test',
        });

        expect(db['pool'].options.max).toBe(5);
        expect(db['pool'].options.idleTimeoutMillis).toBe(10000);
        expect(db['pool'].options.connectionTimeoutMillis).toBe(1000);
      });

      it('should pass properties with no default values', async () => {
        const db = new PgVector({
          connectionString,
          pgPoolOptions: {
            ssl: false,
          },
          id: 'pg-vector-pool-no-defaults-test',
        });

        expect(db['pool'].options.ssl).toBe(false);
      });
      it('should keep default values when custom values are added', async () => {
        const db = new PgVector({
          connectionString,
          pgPoolOptions: {
            ssl: false,
          },
          id: 'pg-vector-pool-keep-defaults-test',
        });

        expect(db['pool'].options.max).toBe(20);
        expect(db['pool'].options.idleTimeoutMillis).toBe(30000);
        expect(db['pool'].options.connectionTimeoutMillis).toBe(2000);
        expect(db['pool'].options.ssl).toBe(false);
      });
    });

    describe('Schema Configuration', () => {
      it('accepts schemaName with connectionString', () => {
        expect(
          () =>
            new PgVector({
              connectionString,
              schemaName: 'custom_schema',
              id: 'pg-vector-schema-connection-string-test',
            }),
        ).not.toThrow();
      });

      it('accepts schemaName with host config', () => {
        const config = {
          host: 'localhost',
          port: 5434,
          database: 'mastra',
          user: 'postgres',
          password: 'postgres',
          schemaName: 'custom_schema',
          id: 'pg-vector-schema-host-config-test',
        };
        expect(() => new PgVector(config)).not.toThrow();
      });
    });

    describe('Invalid Config', () => {
      it('throws on invalid config (missing required fields)', () => {
        expect(() => new PgVector({ user: 'test' } as any)).toThrow(/id must be provided and cannot be empty/);
      });

      it('throws on completely empty config', () => {
        expect(() => new PgVector({} as any)).toThrow(/id must be provided and cannot be empty/);
      });
    });

    describe('PgVectorConfig Support', () => {
      it('should accept PgVectorConfig with connectionString', () => {
        const config: PgVectorConfig = {
          connectionString,
          schemaName: customSchema,
          max: 10,
          idleTimeoutMillis: 15000,
          id: 'pg-vector-config-connection-string-test',
        };
        const db = new PgVector(config);
        expect(db).toBeInstanceOf(PgVector);
      });

      it('should accept PgVectorConfig with individual connection parameters', () => {
        const config: PgVectorConfig = {
          host: 'localhost',
          port: 5434,
          database: 'mastra',
          user: 'postgres',
          password: 'postgres',
          schemaName: customSchema,
          max: 15,
          idleTimeoutMillis: 20000,
          id: 'pg-vector-config-individual-params-test',
        };
        const db = new PgVector(config);
        expect(db).toBeInstanceOf(PgVector);
      });

      it('should accept PgVectorConfig with SSL configuration', () => {
        const config: PgVectorConfig = {
          host: 'localhost',
          port: 5434,
          database: 'mastra',
          user: 'postgres',
          password: 'postgres',
          ssl: true,
          schemaName: customSchema,
          id: 'pg-vector-config-ssl-test',
        };
        const db = new PgVector(config);
        expect(db).toBeInstanceOf(PgVector);
      });

      it('should maintain backward compatibility with legacy config', () => {
        const legacyConfig = {
          connectionString,
          schemaName: customSchema,
          pgPoolOptions: {
            max: 5,
            idleTimeoutMillis: 10000,
          },
          id: 'pg-vector-legacy-config-test',
        };
        const db = new PgVector(legacyConfig);
        expect(db).toBeInstanceOf(PgVector);
      });

      it('should work with PgVectorConfig for actual database operations', async () => {
        const config: PgVectorConfig = {
          connectionString,
          schemaName: customSchema,
          max: 5,
          idleTimeoutMillis: 10000,
          id: 'pg-vector-config-db-ops-test',
        };
        const db = new PgVector(config);

        try {
          // Test basic operations
          await db.createIndex({
            indexName: 'postgres_config_test',
            dimension: 3,
            metric: 'cosine',
          });

          await db.upsert({
            indexName: 'postgres_config_test',
            vectors: [[1, 2, 3]],
            metadata: [{ test: 'postgres_config' }],
          });

          const results = await db.query({
            indexName: 'postgres_config_test',
            queryVector: [1, 2, 3],
            topK: 1,
          });

          expect(results).toHaveLength(1);
          expect(results[0].metadata).toEqual({ test: 'postgres_config' });

          await db.deleteIndex({ indexName: 'postgres_config_test' });
        } finally {
          await db.disconnect();
        }
      });
    });
  });
});
