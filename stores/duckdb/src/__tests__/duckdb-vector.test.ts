/**
 * DuckDB Vector Store Tests
 *
 * These tests verify the DuckDB vector store implementation.
 * They are designed to fail until the implementation is complete.
 *
 * @see https://github.com/mastra-ai/mastra/issues/8140
 * @see https://github.com/mastra-ai/mastra/pull/8095
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DuckDBVector } from '../vector/index.js';

describe('DuckDBVector', () => {
  let vectorDB: DuckDBVector;
  const testIndexName = 'test_vectors';

  // This test should fail until the implementation is complete
  describe('Core Implementation', () => {
    it('should be able to instantiate DuckDBVector', () => {
      // This test will fail with "DuckDBVector is not yet implemented"
      // Once implemented, it should not throw
      expect(() => {
        vectorDB = new DuckDBVector({
          id: 'duckdb-test',
          path: ':memory:',
          dimensions: 1536,
          metric: 'cosine',
        });
      }).not.toThrow();
    });

    it('should implement MastraVector interface', () => {
      // Verify the class extends MastraVector
      expect(DuckDBVector.prototype).toBeDefined();
      expect(typeof DuckDBVector.prototype.query).toBe('function');
      expect(typeof DuckDBVector.prototype.upsert).toBe('function');
      expect(typeof DuckDBVector.prototype.createIndex).toBe('function');
      expect(typeof DuckDBVector.prototype.listIndexes).toBe('function');
      expect(typeof DuckDBVector.prototype.describeIndex).toBe('function');
      expect(typeof DuckDBVector.prototype.deleteIndex).toBe('function');
      expect(typeof DuckDBVector.prototype.updateVector).toBe('function');
      expect(typeof DuckDBVector.prototype.deleteVector).toBe('function');
      expect(typeof DuckDBVector.prototype.deleteVectors).toBe('function');
    });
  });

  describe('Index Management', () => {
    beforeAll(() => {
      // This will throw until implementation is complete
      try {
        vectorDB = new DuckDBVector({
          id: 'duckdb-test',
          path: ':memory:',
          dimensions: 3,
          metric: 'cosine',
        });
      } catch {
        // Expected to fail until implemented
      }
    });

    afterAll(async () => {
      try {
        await vectorDB?.deleteIndex({ indexName: testIndexName });
      } catch {
        // Cleanup might fail if not implemented
      }
    });

    it('should create a new vector index with specified dimensions', async () => {
      await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });

      const stats = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats?.dimension).toBe(3);
      expect(stats?.count).toBe(0);
    });

    it('should list all vector indexes', async () => {
      await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
      const indexes = await vectorDB.listIndexes();
      expect(indexes).toContain(testIndexName);
    });

    it('should delete an index', async () => {
      await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
      await vectorDB.deleteIndex({ indexName: testIndexName });
      const indexes = await vectorDB.listIndexes();
      expect(indexes).not.toContain(testIndexName);
    });
  });

  describe('Vector Operations', () => {
    beforeEach(async () => {
      try {
        vectorDB = new DuckDBVector({
          id: 'duckdb-test',
          path: ':memory:',
          dimensions: 3,
          metric: 'cosine',
        });
        await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
      } catch {
        // Expected to fail until implemented
      }
    });

    afterEach(async () => {
      try {
        await vectorDB?.deleteIndex({ indexName: testIndexName });
      } catch {
        // Cleanup might fail if not implemented
      }
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

    it('should query similar vectors', async () => {
      const vectors = [
        [1, 0, 0],
        [0.8, 0.2, 0],
        [0, 1, 0],
      ];
      await vectorDB.upsert({ indexName: testIndexName, vectors });

      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        topK: 1,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.score).toBeCloseTo(1, 5);
    });

    it('should handle metadata correctly', async () => {
      const vectors = [[1, 2, 3]];
      const metadata = [{ text: 'test document', category: 'test' }];

      await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 2, 3],
        topK: 1,
      });

      expect(results[0]?.metadata).toEqual(metadata[0]);
    });

    it('should filter by metadata', async () => {
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
      ];
      const metadata = [{ category: 'a' }, { category: 'b' }];

      await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        topK: 10,
        filter: { category: 'a' },
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.metadata?.category).toBe('a');
    });

    it('should update a vector by ID', async () => {
      const vectors = [[1, 2, 3]];
      const metadata = [{ test: 'initial' }];
      const [id] = await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });

      await vectorDB.updateVector({
        indexName: testIndexName,
        id,
        update: {
          vector: [4, 5, 6],
          metadata: { test: 'updated' },
        },
      });

      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [4, 5, 6],
        topK: 1,
        includeVector: true,
      });
      expect(results[0]?.id).toBe(id);
      expect(results[0]?.metadata).toEqual({ test: 'updated' });
    });

    it('should delete a vector by ID', async () => {
      const vectors = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      const ids = await vectorDB.upsert({ indexName: testIndexName, vectors });

      await vectorDB.deleteVector({ indexName: testIndexName, id: ids[0] });

      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 2, 3],
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(ids[1]);
    });

    it('should delete multiple vectors by IDs', async () => {
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      const ids = await vectorDB.upsert({ indexName: testIndexName, vectors });

      await vectorDB.deleteVectors({
        indexName: testIndexName,
        ids: [ids[0], ids[1]],
      });

      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [0, 0, 1],
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(ids[2]);
    });

    it('should delete vectors by metadata filter', async () => {
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
      ];
      const metadata = [{ source: 'doc1' }, { source: 'doc2' }];

      const ids = await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });

      await vectorDB.deleteVectors({
        indexName: testIndexName,
        filter: { source: 'doc1' },
      });

      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [0, 1, 0],
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(ids[1]);
    });
  });

  describe('DuckDB-Specific Features', () => {
    beforeEach(async () => {
      try {
        vectorDB = new DuckDBVector({
          id: 'duckdb-test',
          path: ':memory:',
          dimensions: 3,
          metric: 'cosine',
        });
        await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
      } catch {
        // Expected to fail until implemented
      }
    });

    afterEach(async () => {
      try {
        await vectorDB?.deleteIndex({ indexName: testIndexName });
      } catch {
        // Cleanup might fail if not implemented
      }
    });

    it('should support cosine distance metric', async () => {
      const db = new DuckDBVector({
        id: 'duckdb-cosine',
        path: ':memory:',
        metric: 'cosine',
      });
      expect(db).toBeDefined();
    });

    it('should support euclidean distance metric', async () => {
      const db = new DuckDBVector({
        id: 'duckdb-euclidean',
        path: ':memory:',
        metric: 'euclidean',
      });
      expect(db).toBeDefined();
    });

    it('should support dot product distance metric', async () => {
      const db = new DuckDBVector({
        id: 'duckdb-dotproduct',
        path: ':memory:',
        metric: 'dotproduct',
      });
      expect(db).toBeDefined();
    });

    it('should support in-memory database', async () => {
      const db = new DuckDBVector({
        id: 'duckdb-memory',
        path: ':memory:',
      });
      expect(db).toBeDefined();
    });

    it('should support file-based persistence', async () => {
      const db = new DuckDBVector({
        id: 'duckdb-file',
        path: './test.duckdb',
      });
      expect(db).toBeDefined();
    });
  });
});

// Use the shared test suite with factory pattern
import { createVectorTestSuite } from '@internal/storage-test-utils';

const duckDBVectorDB = new DuckDBVector({
  id: 'duckdb-shared-test',
  path: ':memory:',
  dimensions: 1536,
  metric: 'cosine',
});

createVectorTestSuite({
  vector: duckDBVectorDB,
  createIndex: async (indexName: string) => {
    await duckDBVectorDB.createIndex({ indexName, dimension: 1536, metric: 'cosine' });
  },
  deleteIndex: async (indexName: string) => {
    try {
      await duckDBVectorDB.deleteIndex({ indexName });
    } catch (error) {
      console.error(`Error deleting index ${indexName}:`, error);
    }
  },
  waitForIndexing: () => new Promise(resolve => setTimeout(resolve, 100)),
});
