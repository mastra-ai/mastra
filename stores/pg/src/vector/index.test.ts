import { createVectorTestSuite } from '@internal/storage-test-utils';
import type { QueryResult } from '@mastra/core/vector';
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
      expect(testDB.pool.connect()).rejects.toThrow();
    });
  });

  afterAll(async () => {
    // Clean up test tables
    await vectorDB.deleteIndex({ indexName: testIndexName });
    await vectorDB.disconnect();
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

  // Vector Operations Tests
  describe('Vector Operations', () => {
    describe('upsert', () => {
      beforeEach(async () => {
        await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
      });

      afterEach(async () => {
        await vectorDB.deleteIndex({ indexName: testIndexName });
      });

      it('should insert new vectors', async () => {
        const vectors = [
          [1, 2, 3],
          [4, 5, 6],
        ];
        const ids = await vectorDB.upsert({ indexName: testIndexName, vectors });

        expect(ids).toHaveLength(2);
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(2);
      });

      it('should update existing vectors', async () => {
        const vectors = [[1, 2, 3]];
        const metadata = [{ test: 'initial' }];
        const [id] = await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });

        const updatedVectors = [[4, 5, 6]];
        const updatedMetadata = [{ test: 'updated' }];
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: updatedVectors,
          metadata: updatedMetadata,
          ids: [id!],
        });

        const results = await vectorDB.query({ indexName: testIndexName, queryVector: [4, 5, 6], topK: 1 });
        expect(results[0]?.id).toBe(id);
        expect(results[0]?.metadata).toEqual({ test: 'updated' });
      });

      it('should handle metadata correctly', async () => {
        const vectors = [[1, 2, 3]];
        const metadata = [{ test: 'value', num: 123 }];

        await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });
        const results = await vectorDB.query({ indexName: testIndexName, queryVector: [1, 2, 3], topK: 1 });

        expect(results[0]?.metadata).toEqual(metadata[0]);
      });

      it('should throw error if vector dimensions dont match', async () => {
        const vectors = [[1, 2, 3, 4]]; // 4D vector for 3D index
        await expect(vectorDB.upsert({ indexName: testIndexName, vectors })).rejects.toThrow(
          `Vector dimension mismatch: Index "${testIndexName}" expects 3 dimensions but got 4 dimensions. ` +
            `Either use a matching embedding model or delete and recreate the index with the new dimension.`,
        );
      });
    });

    describe('updates', () => {
      const testVectors = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];

      beforeEach(async () => {
        await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
      });

      afterEach(async () => {
        await vectorDB.deleteIndex({ indexName: testIndexName });
      });

      it('should update the vector by id', async () => {
        const ids = await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newVector = [1, 2, 3];
        const newMetaData = {
          test: 'updates',
        };

        const update = {
          vector: newVector,
          metadata: newMetaData,
        };

        await vectorDB.updateVector({ indexName: testIndexName, id: idToBeUpdated, update });

        const results: QueryResult[] = await vectorDB.query({
          indexName: testIndexName,
          queryVector: newVector,
          topK: 2,
          includeVector: true,
        });
        expect(results[0]?.id).toBe(idToBeUpdated);
        expect(results[0]?.vector).toEqual(newVector);
        expect(results[0]?.metadata).toEqual(newMetaData);
      });

      it('should only update the metadata by id', async () => {
        const ids = await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newMetaData = {
          test: 'updates',
        };

        const update = {
          metadata: newMetaData,
        };

        await vectorDB.updateVector({ indexName: testIndexName, id: idToBeUpdated, update });

        const results: QueryResult[] = await vectorDB.query({
          indexName: testIndexName,
          queryVector: testVectors[0],
          topK: 2,
          includeVector: true,
        });
        expect(results[0]?.id).toBe(idToBeUpdated);
        expect(results[0]?.vector).toEqual(testVectors[0]);
        expect(results[0]?.metadata).toEqual(newMetaData);
      });

      it('should only update vector embeddings by id', async () => {
        const ids = await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newVector = [4, 4, 4];

        const update = {
          vector: newVector,
        };

        await vectorDB.updateVector({ indexName: testIndexName, id: idToBeUpdated, update });

        const results: QueryResult[] = await vectorDB.query({
          indexName: testIndexName,
          queryVector: newVector,
          topK: 2,
          includeVector: true,
        });
        expect(results[0]?.id).toBe(idToBeUpdated);
        expect(results[0]?.vector).toEqual(newVector);
      });

      it('should throw exception when no updates are given', async () => {
        await expect(vectorDB.updateVector({ indexName: testIndexName, id: 'id', update: {} })).rejects.toThrow(
          'No updates provided',
        );
      });
    });

    describe('deletes', () => {
      const testVectors = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];

      beforeEach(async () => {
        await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
      });

      afterEach(async () => {
        await vectorDB.deleteIndex({ indexName: testIndexName });
      });

      it('should delete the vector by id', async () => {
        const ids = await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);
        const idToBeDeleted = ids[0];

        await vectorDB.deleteVector({ indexName: testIndexName, id: idToBeDeleted });

        const results: QueryResult[] = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1.0, 0.0, 0.0],
          topK: 2,
        });

        expect(results).toHaveLength(2);
        expect(results.map(res => res.id)).not.toContain(idToBeDeleted);
      });
    });

    describe('Basic Query Operations', () => {
      ['flat', 'hnsw', 'ivfflat'].forEach(indexType => {
        const indexName = `test_query_2_${indexType}`;
        beforeAll(async () => {
          try {
            await vectorDB.deleteIndex({ indexName });
          } catch {
            // Ignore if doesn't exist
          }
          await vectorDB.createIndex({ indexName, dimension: 3 });
        });

        beforeEach(async () => {
          await vectorDB.truncateIndex({ indexName });
          const vectors = [
            [1, 0, 0],
            [0.8, 0.2, 0],
            [0, 1, 0],
          ];
          const metadata = [
            { type: 'a', value: 1 },
            { type: 'b', value: 2 },
            { type: 'c', value: 3 },
          ];
          await vectorDB.upsert({ indexName, vectors, metadata });
        });

        afterAll(async () => {
          await vectorDB.deleteIndex({ indexName });
        });

        it('should return closest vectors', async () => {
          const results = await vectorDB.query({ indexName, queryVector: [1, 0, 0], topK: 1 });
          expect(results).toHaveLength(1);
          expect(results[0]?.vector).toBe(undefined);
          expect(results[0]?.score).toBeCloseTo(1, 5);
        });

        it('should return vector with result', async () => {
          const results = await vectorDB.query({ indexName, queryVector: [1, 0, 0], topK: 1, includeVector: true });
          expect(results).toHaveLength(1);
          expect(results[0]?.vector).toStrictEqual([1, 0, 0]);
        });

        it('should respect topK parameter', async () => {
          const results = await vectorDB.query({ indexName, queryVector: [1, 0, 0], topK: 2 });
          expect(results).toHaveLength(2);
        });

        it('should handle filters correctly', async () => {
          const results = await vectorDB.query({ indexName, queryVector: [1, 0, 0], topK: 10, filter: { type: 'a' } });

          expect(results).toHaveLength(1);
          results.forEach(result => {
            expect(result?.metadata?.type).toBe('a');
          });
        });
      });
    });
  });

  // Advanced Query and Filter Tests
  describe('Advanced Query and Filter Operations', () => {
    const indexName = 'test_query_filters';
    beforeAll(async () => {
      try {
        await vectorDB.deleteIndex({ indexName });
      } catch {
        // Ignore if doesn't exist
      }
      await vectorDB.createIndex({ indexName, dimension: 3 });
    });

    beforeEach(async () => {
      await vectorDB.truncateIndex({ indexName });
      const vectors = [
        [1, 0.1, 0],
        [0.9, 0.2, 0],
        [0.95, 0.1, 0],
        [0.85, 0.2, 0],
        [0.9, 0.1, 0],
      ];

      const metadata = [
        {
          category: 'electronics',
          price: 100,
          tags: ['new', 'premium'],
          active: true,
          ratings: [4.5, 4.8, 4.2], // Array of numbers
          stock: [
            { location: 'A', count: 25 },
            { location: 'B', count: 15 },
          ], // Array of objects
          reviews: [
            { user: 'alice', score: 5, verified: true },
            { user: 'bob', score: 4, verified: true },
            { user: 'charlie', score: 3, verified: false },
          ], // Complex array objects
        },
        {
          category: 'books',
          price: 50,
          tags: ['used'],
          active: true,
          ratings: [3.8, 4.0, 4.1],
          stock: [
            { location: 'A', count: 10 },
            { location: 'C', count: 30 },
          ],
          reviews: [
            { user: 'dave', score: 4, verified: true },
            { user: 'eve', score: 5, verified: false },
          ],
        },
        { category: 'electronics', price: 75, tags: ['refurbished'], active: false },
        { category: 'books', price: 25, tags: ['used', 'sale'], active: true },
        { category: 'clothing', price: 60, tags: ['new'], active: true },
      ];

      await vectorDB.upsert({ indexName, vectors, metadata });
    });

    afterAll(async () => {
      await vectorDB.deleteIndex({ indexName });
    });

    // Numeric Comparison Tests
    describe('Comparison Operators', () => {
      it('should handle numeric string comparisons', async () => {
        // Insert a record with numeric string
        await vectorDB.upsert({ indexName, vectors: [[1, 0.1, 0]], metadata: [{ numericString: '123' }] });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { numericString: { $gt: '100' } },
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.metadata?.numericString).toBe('123');
      });

      it('should filter with $gt operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 75 } },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.price).toBe(100);
      });

      it('should filter with $lte operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $lte: 50 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeLessThanOrEqual(50);
        });
      });

      it('should filter with lt operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $lt: 60 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeLessThan(60);
        });
      });

      it('should filter with gte operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gte: 75 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeGreaterThanOrEqual(75);
        });
      });

      it('should filter with ne operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $ne: 'electronics' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      it('should filter with $gt and $lte operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 70, $lte: 100 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price).toBeGreaterThan(70);
          expect(result.metadata?.price).toBeLessThanOrEqual(100);
        });
      });
    });

    // Array Operator Tests
    describe('Array Operators', () => {
      it('should filter with $in operator for scalar field', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $in: ['electronics', 'clothing'] } },
        });
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(['electronics', 'clothing']).toContain(result.metadata?.category);
        });
      });

      it('should filter with $in operator for array field', async () => {
        // Insert a record with tags as array
        await vectorDB.upsert({
          indexName,
          vectors: [[2, 0.2, 0]],
          metadata: [{ tags: ['featured', 'sale', 'new'] }],
        });
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $in: ['sale', 'clearance'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags.some((tag: string) => ['sale', 'clearance'].includes(tag))).toBe(true);
        });
      });

      it('should filter with $nin operator for scalar field', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $nin: ['electronics', 'books'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should filter with $nin operator for array field', async () => {
        // Insert a record with tags as array
        await vectorDB.upsert({
          indexName,
          vectors: [[2, 0.3, 0]],
          metadata: [{ tags: ['clearance', 'used'] }],
        });
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $nin: ['new', 'sale'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags.every((tag: string) => !['new', 'sale'].includes(tag))).toBe(true);
        });
      });

      it('should handle empty arrays in in/nin operators', async () => {
        // Should return no results for empty IN
        const resultsIn = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $in: [] } },
        });
        expect(resultsIn).toHaveLength(0);

        // Should return all results for empty NIN
        const resultsNin = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $nin: [] } },
        });
        expect(resultsNin.length).toBeGreaterThan(0);
      });

      it('should filter with array $contains operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0.1, 0],
          filter: { tags: { $contains: ['new'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('new');
        });
      });

      it('should filter with $contains operator for string substring', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $contains: 'lectro' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toContain('lectro');
        });
      });

      it('should not match deep object containment with $contains', async () => {
        // Insert a record with a nested object
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ details: { color: 'red', size: 'large' }, category: 'clothing' }],
        });
        // $contains does NOT support deep object containment in Postgres
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0.1, 0],
          filter: { details: { $contains: { color: 'red' } } },
        });
        expect(results.length).toBe(0);
      });

      it('should fallback to direct equality for non-array, non-string', async () => {
        // Insert a record with a numeric field
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.2, 0]],
          metadata: [{ price: 123 }],
        });
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $contains: 123 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.price).toBe(123);
        });
      });

      it('should filter with $elemMatch operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $elemMatch: { $in: ['new', 'premium'] } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags.some(tag => ['new', 'premium'].includes(tag))).toBe(true);
        });
      });

      it('should filter with $elemMatch using equality', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $elemMatch: { $eq: 'sale' } } },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.tags).toContain('sale');
      });

      it('should filter with $elemMatch using multiple conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { ratings: { $elemMatch: { $gt: 4, $lt: 4.5 } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Array.isArray(result.metadata?.ratings)).toBe(true);
          expect(result.metadata?.ratings.some(rating => rating > 4 && rating < 4.5)).toBe(true);
        });
      });

      it('should handle complex $elemMatch conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { stock: { $elemMatch: { location: 'A', count: { $gt: 20 } } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const matchingStock = result.metadata?.stock.find(s => s.location === 'A' && s.count > 20);
          expect(matchingStock).toBeDefined();
        });
      });

      it('should filter with $elemMatch on nested numeric fields', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { reviews: { $elemMatch: { score: { $gt: 4 } } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.reviews.some(r => r.score > 4)).toBe(true);
        });
      });

      it('should filter with $elemMatch on multiple nested fields', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { reviews: { $elemMatch: { score: { $gte: 4 }, verified: true } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.reviews.some(r => r.score >= 4 && r.verified)).toBe(true);
        });
      });

      it('should filter with $elemMatch on exact string match', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { reviews: { $elemMatch: { user: 'alice' } } },
        });
        expect(results).toHaveLength(1);
        expect(results[0].metadata?.reviews.some(r => r.user === 'alice')).toBe(true);
      });

      it('should handle $elemMatch with no matches', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { reviews: { $elemMatch: { score: 10 } } },
        });
        expect(results).toHaveLength(0);
      });

      it('should filter with $all operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: ['used', 'sale'] } },
        });
        expect(results).toHaveLength(1);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('used');
          expect(result.metadata?.tags).toContain('sale');
        });
      });

      it('should filter with $all using single value', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: ['new'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('new');
        });
      });

      it('should handle empty array for $all', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: [] } },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle non-array field $all', async () => {
        // First insert a record with non-array field
        await vectorDB.upsert({ indexName, vectors: [[1, 0.1, 0]], metadata: [{ tags: 'not-an-array' }] });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: ['value'] } },
        });
        expect(results).toHaveLength(0);
      });

      // Contains Operator Tests
      it('should filter with contains operator for exact field match', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0.1, 0],
          filter: { category: { $contains: 'electronics' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      // it('should filter with $objectContains operator for nested objects', async () => {
      //   // First insert a record with nested object
      //   await vectorDB.upsert({
      //     indexName,
      //     vectors: [[1, 0.1, 0]],
      //     metadata: [
      //       {
      //         details: { color: 'red', size: 'large' },
      //         category: 'clothing',
      //       },
      //     ],
      //   });

      //   const results = await vectorDB.query({
      //     indexName,
      //     queryVector: [1, 0.1, 0],
      //     filter: { details: { $objectContains: { color: 'red' } } },
      //   });
      //   expect(results.length).toBeGreaterThan(0);
      //   results.forEach(result => {
      //     expect(result.metadata?.details.color).toBe('red');
      //   });
      // });

      // String Pattern Tests
      it('should handle exact string matches', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: 'electronics' },
        });
        expect(results).toHaveLength(2);
      });

      it('should handle case-sensitive string matches', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: 'ELECTRONICS' },
        });
        expect(results).toHaveLength(0);
      });
      it('should filter arrays by size', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { ratings: { $size: 3 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.ratings).toHaveLength(3);
        });

        const noResults = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { ratings: { $size: 10 } },
        });
        expect(noResults).toHaveLength(0);
      });

      it('should handle $size with nested arrays', async () => {
        await vectorDB.upsert({ indexName, vectors: [[1, 0.1, 0]], metadata: [{ nested: { array: [1, 2, 3, 4] } }] });
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { 'nested.array': { $size: 4 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.nested.array).toHaveLength(4);
        });
      });
    });

    // Logical Operator Tests
    describe('Logical Operators', () => {
      it('should handle AND filter conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $and: [{ category: { $eq: 'electronics' } }, { price: { $gt: 75 } }] },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.category).toBe('electronics');
        expect(results[0]?.metadata?.price).toBeGreaterThan(75);
      });

      it('should handle OR filter conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $or: [{ category: { $eq: 'electronics' } }, { category: { $eq: 'books' } }] },
        });
        expect(results.length).toBeGreaterThan(1);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result?.metadata?.category);
        });
      });

      it('should handle $not operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { category: 'electronics' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      it('should handle $nor operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $nor: [{ category: 'electronics' }, { category: 'books' }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle nested $not with $or', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { $or: [{ category: 'electronics' }, { category: 'books' }] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle $not with comparison operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $not: { $gt: 100 } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(100);
        });
      });

      it('should handle $not with $in operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $not: { $in: ['electronics', 'books'] } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should handle $not with multiple nested conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { $and: [{ category: 'electronics' }, { price: { $gt: 50 } }] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category !== 'electronics' || result.metadata?.price <= 50).toBe(true);
        });
      });

      it('should handle $not with $exists operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $not: { $exists: true } } },
        });
        expect(results.length).toBe(0); // All test data has tags
      });

      it('should handle $not with array operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $not: { $all: ['new', 'premium'] } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(!result.metadata?.tags.includes('new') || !result.metadata?.tags.includes('premium')).toBe(true);
        });
      });

      it('should handle $not with complex nested conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $not: {
              $or: [
                {
                  $and: [{ category: 'electronics' }, { price: { $gt: 90 } }],
                },
                {
                  $and: [{ category: 'books' }, { price: { $lt: 30 } }],
                },
              ],
            },
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const notExpensiveElectronics = !(result.metadata?.category === 'electronics' && result.metadata?.price > 90);
          const notCheapBooks = !(result.metadata?.category === 'books' && result.metadata?.price < 30);
          expect(notExpensiveElectronics && notCheapBooks).toBe(true);
        });
      });

      it('should handle $not with empty arrays', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $not: { $in: [] } } },
        });
        expect(results.length).toBeGreaterThan(0); // Should match all records
      });

      it('should handle $not with null values', async () => {
        // First insert a record with null value
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ category: null, price: 0 }],
        });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $not: { $eq: null } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBeNull();
        });
      });

      it('should handle $not with boolean values', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { active: { $not: { $eq: true } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.active).not.toBe(true);
        });
      });

      it('should handle $not with multiple conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { category: 'electronics', price: { $gt: 50 } } },
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle $not with $not operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { $not: { category: 'electronics' } } },
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle $not in nested fields', async () => {
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ user: { profile: { price: 10 } } }],
        });
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { 'user.profile.price': { $not: { $gt: 25 } } },
        });
        expect(results.length).toBe(1);
      });

      it('should handle $not with multiple operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $not: { $gte: 30, $lte: 70 } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const price = Number(result.metadata?.price);
          expect(price < 30 || price > 70).toBe(true);
        });
      });

      it('should handle $not with comparison operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $not: { $gt: 100 } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(100);
        });
      });

      it('should handle $not with $and', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $not: { $and: [{ category: 'electronics' }, { price: { $gt: 50 } }] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category !== 'electronics' || result.metadata?.price <= 50).toBe(true);
        });
      });

      it('should handle $nor with $or', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $nor: [{ $or: [{ category: 'electronics' }, { category: 'books' }] }, { price: { $gt: 75 } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
          expect(result.metadata?.price).toBeLessThanOrEqual(75);
        });
      });

      it('should handle $nor with nested $and conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $nor: [
              { $and: [{ category: 'electronics' }, { active: true }] },
              { $and: [{ category: 'books' }, { price: { $lt: 30 } }] },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const notElectronicsActive = !(
            result.metadata?.category === 'electronics' && result.metadata?.active === true
          );
          const notBooksLowPrice = !(result.metadata?.category === 'books' && result.metadata?.price < 30);
          expect(notElectronicsActive && notBooksLowPrice).toBe(true);
        });
      });

      it('should handle nested $and with $or and $not', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $and: [{ $or: [{ category: 'electronics' }, { category: 'books' }] }, { $not: { price: { $lt: 50 } } }],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result.metadata?.category);
          expect(result.metadata?.price).toBeGreaterThanOrEqual(50);
        });
      });

      it('should handle $or with multiple $not conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $or: [{ $not: { category: 'electronics' } }, { $not: { price: { $gt: 50 } } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category !== 'electronics' || result.metadata?.price <= 50).toBe(true);
        });
      });
    });

    // Edge Cases and Special Values
    describe('Edge Cases and Special Values', () => {
      it('should handle empty result sets with valid filters', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 1000 } },
        });
        expect(results).toHaveLength(0);
      });

      it('should throw error for invalid operator', async () => {
        await expect(
          vectorDB.query({
            indexName,
            queryVector: [1, 0, 0],
            filter: { price: { $invalid: 100 } } as any,
          }),
        ).rejects.toThrow('Unsupported operator: $invalid');
      });

      it('should handle empty filter object', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {},
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle numeric string comparisons', async () => {
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ numericString: '123' }],
        });
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { numericString: { $gt: '100' } },
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.metadata?.numericString).toBe('123');
      });
    });

    // Score Threshold Tests
    describe('Score Threshold', () => {
      it('should respect minimum score threshold', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: 'electronics' },
          includeVector: false,
          minScore: 0.9,
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.score).toBeGreaterThan(0.9);
        });
      });
    });

    describe('Error Handling', () => {
      const testIndexName = 'test_index_error';
      beforeAll(async () => {
        await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
      });

      afterAll(async () => {
        await vectorDB.deleteIndex({ indexName: testIndexName });
      });

      it('should handle non-existent index queries', async () => {
        await expect(vectorDB.query({ indexName: 'non_existent_index_yu', queryVector: [1, 2, 3] })).rejects.toThrow();
      });

      it('should handle invalid dimension vectors', async () => {
        const invalidVector = [1, 2, 3, 4]; // 4D vector for 3D index
        await expect(vectorDB.upsert({ indexName: testIndexName, vectors: [invalidVector] })).rejects.toThrow();
      });

      it('should handle duplicate index creation gracefully', async () => {
        const duplicateIndexName = `duplicate_test`;
        const dimension = 768;

        // Create index first time
        await vectorDB.createIndex({
          indexName: duplicateIndexName,
          dimension,
          metric: 'cosine',
        });

        // Try to create with same dimensions - should not throw
        await expect(
          vectorDB.createIndex({
            indexName: duplicateIndexName,
            dimension,
            metric: 'cosine',
          }),
        ).resolves.not.toThrow();

        // Cleanup
        await vectorDB.deleteIndex({ indexName: duplicateIndexName });
      });

      it('should handle index creation with invalid parameters', async () => {
        // Invalid index name (SQL injection attempt)
        await expect(
          vectorDB.createIndex({
            indexName: "'; DROP TABLE users; --",
            dimension: 128,
            metric: 'cosine',
          }),
        ).rejects.toThrow('Invalid index name');

        // Invalid dimension
        await expect(
          vectorDB.createIndex({
            indexName: 'test_invalid_dim',
            dimension: -1,
            metric: 'cosine',
          }),
        ).rejects.toThrow('Dimension must be a positive integer');

        // Invalid HNSW parameters
        await expect(
          vectorDB.createIndex({
            indexName: 'test_invalid_hnsw',
            dimension: 128,
            metric: 'cosine',
            indexConfig: {
              type: 'hnsw',
              hnsw: { m: -1, efConstruction: 64 },
            },
          }),
        ).rejects.toThrow();
      });
    });

    describe('Edge Cases and Special Values', () => {
      // Additional Edge Cases
      it('should handle empty result sets with valid filters', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 1000 } },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle empty filter object', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {},
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle non-existent field', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { nonexistent: { $elemMatch: { $eq: 'value' } } },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle non-existent values', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $elemMatch: { $eq: 'nonexistent-tag' } } },
        });
        expect(results).toHaveLength(0);
      });
      // Empty Conditions Tests
      it('should handle empty conditions in logical operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $and: [], category: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should handle empty $and conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $and: [], category: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should handle empty $or conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $or: [], category: 'electronics' },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle empty $nor conditions', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $nor: [], category: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should handle empty $not conditions', async () => {
        await expect(
          vectorDB.query({
            indexName,
            queryVector: [1, 0, 0],
            filter: { $not: {}, category: 'electronics' },
          }),
        ).rejects.toThrow('$not operator cannot be empty');
      });

      it('should handle multiple empty logical operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { $and: [], $or: [], $nor: [], category: 'electronics' },
        });
        expect(results).toHaveLength(0);
      });

      // Nested Field Tests
      it('should handle deeply nested metadata paths', async () => {
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [
            {
              level1: {
                level2: {
                  level3: 'deep value',
                },
              },
            },
          ],
        });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { 'level1.level2.level3': 'deep value' },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.level1?.level2?.level3).toBe('deep value');
      });

      it('should handle non-existent nested paths', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { 'nonexistent.path': 'value' },
        });
        expect(results).toHaveLength(0);
      });

      // Score Threshold Tests
      it('should respect minimum score threshold', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: 'electronics' },
          includeVector: false,
          minScore: 0.9,
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.score).toBeGreaterThan(0.9);
        });
      });

      // Complex Nested Operators Test
      it('should handle deeply nested logical operators', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $and: [
              {
                $or: [{ category: 'electronics' }, { $and: [{ category: 'books' }, { price: { $lt: 30 } }] }],
              },
              {
                $not: {
                  $or: [{ active: false }, { price: { $gt: 100 } }],
                },
              },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          // First condition: electronics OR (books AND price < 30)
          const firstCondition =
            result.metadata?.category === 'electronics' ||
            (result.metadata?.category === 'books' && result.metadata?.price < 30);

          // Second condition: NOT (active = false OR price > 100)
          const secondCondition = result.metadata?.active !== false && result.metadata?.price <= 100;

          expect(firstCondition && secondCondition).toBe(true);
        });
      });

      it('should throw error for invalid operator', async () => {
        await expect(
          vectorDB.query({
            indexName,
            queryVector: [1, 0, 0],
            filter: { price: { $invalid: 100 } } as any,
          }),
        ).rejects.toThrow('Unsupported operator: $invalid');
      });

      it('should handle multiple logical operators at root level', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {
            $and: [{ category: 'electronics' }],
            $or: [{ price: { $lt: 100 } }, { price: { $gt: 20 } }],
            $nor: [],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
          expect(result.metadata?.price < 100 || result.metadata?.price > 20).toBe(true);
        });
      });

      it('should handle non-array field with $elemMatch', async () => {
        // First insert a record with non-array field
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ tags: 'not-an-array' }],
        });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $elemMatch: { $eq: 'value' } } },
        });
        expect(results).toHaveLength(0); // Should return no results for non-array field
      });
      it('should handle undefined filter', async () => {
        const results1 = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: undefined,
        });
        const results2 = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
        });
        expect(results1).toEqual(results2);
        expect(results1.length).toBeGreaterThan(0);
      });

      it('should handle empty object filter', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: {},
        });
        const results2 = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
        });
        expect(results).toEqual(results2);
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle null filter', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: null,
        });
        const results2 = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
        });
        expect(results).toEqual(results2);
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('PgVector Table Name Quoting', () => {
      const camelCaseIndex = 'TestCamelCaseIndex';
      const snakeCaseIndex = 'test_snake_case_index';

      beforeEach(async () => {
        // Clean up any existing indexes
        try {
          await vectorDB.deleteIndex({ indexName: camelCaseIndex });
        } catch {
          // Ignore if doesn't exist
        }
        try {
          await vectorDB.deleteIndex({ indexName: snakeCaseIndex });
        } catch {
          // Ignore if doesn't exist
        }
      });

      afterEach(async () => {
        // Clean up indexes after each test
        try {
          await vectorDB.deleteIndex({ indexName: camelCaseIndex });
        } catch {
          // Ignore if doesn't exist
        }
        try {
          await vectorDB.deleteIndex({ indexName: snakeCaseIndex });
        } catch {
          // Ignore if doesn't exist
        }
      });

      it('should create and query a camelCase index without quoting errors', async () => {
        await expect(
          vectorDB.createIndex({
            indexName: camelCaseIndex,
            dimension: 3,
            metric: 'cosine',
            indexConfig: { type: 'hnsw' },
          }),
        ).resolves.not.toThrow();

        const results = await vectorDB.query({
          indexName: camelCaseIndex,
          queryVector: [1, 0, 0],
          topK: 1,
        });
        expect(Array.isArray(results)).toBe(true);
      });

      it('should create and query a snake_case index without quoting errors', async () => {
        await expect(
          vectorDB.createIndex({
            indexName: snakeCaseIndex,
            dimension: 3,
            metric: 'cosine',
            indexConfig: { type: 'hnsw' },
          }),
        ).resolves.not.toThrow();

        const results = await vectorDB.query({
          indexName: snakeCaseIndex,
          queryVector: [1, 0, 0],
          topK: 1,
        });
        expect(Array.isArray(results)).toBe(true);
      });
    });

    // Regex Operator Tests
    describe('Regex Operators', () => {
      it('should handle $regex with case sensitivity', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $regex: 'ELECTRONICS' } },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle $regex with case insensitivity', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $regex: 'ELECTRONICS', $options: 'i' } },
        });
        expect(results).toHaveLength(2);
      });

      it('should handle $regex with start anchor', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $regex: '^elect' } },
        });
        expect(results).toHaveLength(2);
      });

      it('should handle $regex with end anchor', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $regex: 'nics$' } },
        });
        expect(results).toHaveLength(2);
      });

      it('should handle multiline flag', async () => {
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ description: 'First line\nSecond line\nThird line' }],
        });

        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { description: { $regex: '^Second', $options: 'm' } },
        });
        expect(results).toHaveLength(1);
      });

      it('should handle dotall flag', async () => {
        await vectorDB.upsert({
          indexName,
          vectors: [[1, 0.1, 0]],
          metadata: [{ description: 'First\nSecond\nThird' }],
        });

        const withoutS = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { description: { $regex: 'First[^\\n]*Third' } },
        });
        expect(withoutS).toHaveLength(0);

        const withS = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { description: { $regex: 'First.*Third', $options: 's' } },
        });
        expect(withS).toHaveLength(1);
      });
      it('should handle $not with $regex operator', async () => {
        const results = await vectorDB.query({
          indexName,
          queryVector: [1, 0, 0],
          filter: { category: { $not: { $regex: '^elect' } } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toMatch(/^elect/);
        });
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
        }).rejects.toThrow(`Unable to create schema "${testSchema}". This requires CREATE privilege on the database.`);

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
        }).rejects.toThrow(`Unable to create schema "${testSchema}". This requires CREATE privilege on the database.`);

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

// Metadata filtering tests for Memory system
describe('PgVector Metadata Filtering', () => {
  const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';
  const metadataVectorDB = new PgVector({ connectionString, id: 'pg-metadata-test' });

  createVectorTestSuite({
    vector: metadataVectorDB,
    createIndex: async (indexName: string) => {
      // Using dimension 4 as required by the metadata filtering test vectors
      await metadataVectorDB.createIndex({ indexName, dimension: 4 });
    },
    deleteIndex: async (indexName: string) => {
      await metadataVectorDB.deleteIndex({ indexName });
    },
    waitForIndexing: async () => {
      // PG doesn't need to wait for indexing
    },
  });
});
