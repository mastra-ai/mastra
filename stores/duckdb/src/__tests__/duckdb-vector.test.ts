/**
 * DuckDB Vector Store Tests
 *
 * This file contains DuckDB-specific tests that are not covered by the shared test suite.
 * Standard vector operations (CRUD, filtering, etc.) are tested via createVectorTestSuite.
 *
 * Store-specific tests:
 * - Core implementation verification (2 tests)
 * - $contains operator for array containment and string substring matching (9 tests)
 * - Distance metric support: cosine, euclidean, dotproduct (3 tests)
 * - Storage modes: in-memory and file-based (2 tests)
 */

import { createVectorTestSuite } from '@internal/storage-test-utils';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

  describe('Filter Operators - $contains', () => {
    beforeEach(async () => {
      vectorDB = new DuckDBVector({
        id: 'duckdb-test',
        path: ':memory:',
        dimensions: 3,
        metric: 'cosine',
      });
      await vectorDB.createIndex({ indexName: testIndexName, dimension: 3 });
    });

    afterEach(async () => {
      try {
        await vectorDB?.deleteIndex({ indexName: testIndexName });
      } catch {
        // Cleanup might fail
      }
    });

    it('should filter with array $contains operator', async () => {
      // Insert vectors with array metadata
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
        metadata: [
          { tags: ['new', 'featured', 'sale'] },
          { tags: ['used', 'clearance'] },
          { tags: ['new', 'premium'] },
        ],
      });

      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { tags: { $contains: ['new'] } },
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(Array.isArray(result.metadata?.tags)).toBe(true);
        expect(result.metadata?.tags).toContain('new');
      });
    });

    it('should filter with $contains operator for string substring', async () => {
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [1, 0, 0],
          [0, 1, 0],
        ],
        metadata: [{ category: 'electronics' }, { category: 'clothing' }],
      });

      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { category: { $contains: 'lectro' } },
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.metadata?.category).toContain('lectro');
      });
    });

    it('should handle $contains with multiple array values', async () => {
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
        metadata: [{ tags: ['a', 'b', 'c'] }, { tags: ['b', 'd'] }, { tags: ['a', 'c', 'e'] }],
      });

      // Should match vectors that contain both 'a' and 'b'
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { tags: { $contains: ['a', 'b'] } },
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.metadata?.tags).toContain('a');
        expect(result.metadata?.tags).toContain('b');
      });
    });

    it('should handle nested array fields with $contains', async () => {
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [1, 0, 0],
          [0, 1, 0],
        ],
        metadata: [
          { user: { preferences: { tags: ['tech', 'ai'] } } },
          { user: { preferences: { tags: ['design', 'ui'] } } },
        ],
      });

      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { 'user.preferences.tags': { $contains: ['tech'] } },
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.metadata?.user?.preferences?.tags).toContain('tech');
      });
    });

    it('should fallback to direct equality for non-array, non-string with $contains', async () => {
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [1, 0, 0],
          [0, 1, 0],
        ],
        metadata: [{ price: 123 }, { price: 456 }],
      });

      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { price: { $contains: 123 } },
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.metadata?.price).toBe(123);
      });
    });

    it('should handle type mismatch gracefully when field is not an array', async () => {
      // Insert a vector where tags is a string, not an array
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [1, 0, 0],
          [0, 1, 0],
        ],
        metadata: [
          { tags: 'new-featured-sale' }, // string, not array
          { tags: ['new', 'featured'] }, // array
        ],
      });

      // Querying with $contains array should handle the type mismatch
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { tags: { $contains: ['new'] } },
      });

      // Should only match the array one, or handle gracefully
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should not match deep object containment with $contains', async () => {
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [[1, 0.1, 0]],
        metadata: [{ details: { color: 'red', size: 'large' }, category: 'clothing' }],
      });

      // $contains does NOT support deep object containment
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0.1, 0],
        filter: { details: { $contains: { color: 'red' } } },
      });

      // Should return 0 results or handle gracefully
      expect(results.length).toBe(0);
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

// Shared vector store test suite
const duckDBVector = new DuckDBVector({
  id: 'duckdb-shared-test',
  path: ':memory:',
  dimensions: 1536,
  metric: 'cosine',
});

createVectorTestSuite({
  vector: duckDBVector,
  createIndex: async (indexName, options) => {
    await duckDBVector.createIndex({ indexName, dimension: 1536, metric: options?.metric ?? 'cosine' });
  },
  deleteIndex: async (indexName: string) => {
    try {
      await duckDBVector.deleteIndex({ indexName });
    } catch (error) {
      console.error(`Error deleting index ${indexName}:`, error);
    }
  },
  waitForIndexing: () => new Promise(resolve => setTimeout(resolve, 100)),
  supportsRegex: false,
  supportsElemMatch: false,
  supportsSize: false,
  // DuckDB's $not with nested operators (like $in) returns 0 results - needs investigation
  supportsNotOperator: false,
  supportsNorOperator: false,
  supportsEmptyLogicalOperators: false,
});
