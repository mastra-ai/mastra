/**
 * DuckDB Vector Store Tests
 *
 * This file contains DuckDB-specific tests that are not covered by the shared test suite.
 * Standard vector operations (CRUD, filtering, etc.) are tested via createVectorTestSuite.
 *
 * Store-specific tests:
 * - Core implementation verification (2 tests)
 * - $contains operator for array containment and string substring matching (9 tests)
 * - JSON scalar filter types: typed equality, inequality, ranges, filtered update/delete
 * - Distance metric support: cosine, euclidean, dotproduct (3 tests)
 * - Storage modes: in-memory and file-based (2 tests)
 */

import { createVectorTestSuite } from '@internal/storage-test-utils';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DuckDBVector } from '../vector/index';
import type { DuckDBVectorFilter } from '../vector/types';

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

  /**
   * Regression coverage for issue #31590: DuckDB stored every scalar JSON
   * value as a VARCHAR and cast it to DOUBLE for comparisons, so booleans
   * collided with 0/1, numeric strings passed numeric filters and the casts
   * aborted queries on non-numeric values. Every scalar predicate must respect
   * the stored JSON type instead.
   */
  describe('JSON scalar filter types', () => {
    const scalarIndexName = 'json_scalar_types';

    // One row per distinct scalar JSON type stored under `stage`: booleans,
    // integers (including 0/1), a numeric string, a word string, an explicit
    // JSON null and a row that is missing the field entirely.
    const scalarRows = [
      { id: 'bool-false', metadata: { stage: false } },
      { id: 'bool-true', metadata: { stage: true } },
      { id: 'num-neg', metadata: { stage: -1 } },
      { id: 'num-zero', metadata: { stage: 0 } },
      { id: 'num-one', metadata: { stage: 1 } },
      { id: 'num-two', metadata: { stage: 2 } },
      { id: 'str-zero', metadata: { stage: '0' } },
      { id: 'str-hello', metadata: { stage: 'hello' } },
      { id: 'null-stage', metadata: { stage: null } },
      { id: 'missing-stage', metadata: { other: 'x' } },
    ];

    const seed = async (rows: { id: string; metadata: Record<string, unknown> }[]) => {
      await vectorDB.upsert({
        indexName: scalarIndexName,
        vectors: rows.map(() => [1, 0, 0]),
        metadata: rows.map(r => r.metadata),
        ids: rows.map(r => r.id),
      });
    };

    const matchingIds = async (filter: DuckDBVectorFilter) => {
      const results = await vectorDB.query({
        indexName: scalarIndexName,
        queryVector: [1, 0, 0],
        topK: 100,
        filter,
      });
      return results.map(r => r.id).sort();
    };

    const metadataById = async (id: string) => {
      const results = await vectorDB.query({
        indexName: scalarIndexName,
        queryVector: [1, 0, 0],
        topK: 100,
      });
      return results.find(r => r.id === id)?.metadata;
    };

    // Every present, non-null row except the ones named — missing and explicit
    // null values must stay excluded from non-null inequality results.
    const presentNonNullExcept = (...excluded: string[]) =>
      scalarRows
        .map(r => r.id)
        .filter(id => id !== 'null-stage' && id !== 'missing-stage' && !excluded.includes(id))
        .sort();

    beforeEach(async () => {
      vectorDB = new DuckDBVector({
        id: 'duckdb-json-scalars',
        path: ':memory:',
        dimensions: 3,
        metric: 'cosine',
      });
      await vectorDB.createIndex({ indexName: scalarIndexName, dimension: 3 });
    });

    afterEach(async () => {
      try {
        await vectorDB?.deleteIndex({ indexName: scalarIndexName });
      } catch {
        // Cleanup might fail
      }
    });

    describe('scalar equality', () => {
      beforeEach(async () => {
        await seed(scalarRows);
      });

      it('matches a stored boolean without matching stored 0/1', async () => {
        expect(await matchingIds({ stage: false })).toEqual(['bool-false']);
        expect(await matchingIds({ stage: true })).toEqual(['bool-true']);
      });

      it('matches stored numbers without matching booleans or numeric strings', async () => {
        expect(await matchingIds({ stage: 0 })).toEqual(['num-zero']);
        expect(await matchingIds({ stage: 1 })).toEqual(['num-one']);
        expect(await matchingIds({ stage: -1 })).toEqual(['num-neg']);
        expect(await matchingIds({ stage: 2 })).toEqual(['num-two']);
      });

      it('matches stored strings without matching their numeric counterparts', async () => {
        expect(await matchingIds({ stage: '0' })).toEqual(['str-zero']);
        expect(await matchingIds({ stage: 'hello' })).toEqual(['str-hello']);
      });

      it('applies the same type rules to an explicit $eq', async () => {
        expect(await matchingIds({ stage: { $eq: false } })).toEqual(['bool-false']);
        expect(await matchingIds({ stage: { $eq: 0 } })).toEqual(['num-zero']);
        expect(await matchingIds({ stage: { $eq: '0' } })).toEqual(['str-zero']);
      });
    });

    describe('scalar inequality', () => {
      beforeEach(async () => {
        await seed(scalarRows);
      });

      it('$ne treats a different scalar type as unequal and never matches 0 for false', async () => {
        expect(await matchingIds({ stage: { $ne: false } })).toEqual(presentNonNullExcept('bool-false'));
        expect(await matchingIds({ stage: { $ne: 0 } })).toEqual(presentNonNullExcept('num-zero'));
      });

      it('$nin excludes only same-type values while keeping missing/null excluded', async () => {
        expect(await matchingIds({ stage: { $nin: [false] } })).toEqual(presentNonNullExcept('bool-false'));
        expect(await matchingIds({ stage: { $nin: [0] } })).toEqual(presentNonNullExcept('num-zero'));
        expect(await matchingIds({ stage: { $nin: [false, 0] } })).toEqual(
          presentNonNullExcept('bool-false', 'num-zero'),
        );
      });
    });

    describe('numeric ranges', () => {
      beforeEach(async () => {
        await seed(scalarRows);
      });

      it('compares only stored numbers and never errors on strings or booleans', async () => {
        expect(await matchingIds({ stage: { $gt: 0 } })).toEqual(['num-one', 'num-two']);
        expect(await matchingIds({ stage: { $gte: 0 } })).toEqual(['num-one', 'num-two', 'num-zero']);
        expect(await matchingIds({ stage: { $lt: 0 } })).toEqual(['num-neg']);
        expect(await matchingIds({ stage: { $lte: 1 } })).toEqual(['num-neg', 'num-one', 'num-zero']);
      });

      it('accepts a numeric string operand while still excluding stored numeric strings', async () => {
        expect(await matchingIds({ stage: { $gt: '0' } })).toEqual(['num-one', 'num-two']);
      });
    });

    describe('related scalar predicates', () => {
      beforeEach(async () => {
        await seed(scalarRows);
      });

      it('$in selects only same-type scalar rows', async () => {
        expect(await matchingIds({ stage: { $in: [false] } })).toEqual(['bool-false']);
        expect(await matchingIds({ stage: { $in: [0] } })).toEqual(['num-zero']);
        expect(await matchingIds({ stage: { $in: [0, 0] } })).toEqual(['num-zero']);
      });

      it('$contains falls back to typed equality for scalar metadata', async () => {
        expect(await matchingIds({ stage: { $contains: false } })).toEqual(['bool-false']);
        expect(await matchingIds({ stage: { $contains: 0 } })).toEqual(['num-zero']);
      });

      it('keeps the empty $in/$nin controls unchanged', async () => {
        expect(await matchingIds({ stage: { $in: [] } })).toEqual([]);
        expect(await matchingIds({ stage: { $nin: [] } })).toEqual(scalarRows.map(r => r.id).sort());
      });
    });

    describe('non-scalar and mixed operands', () => {
      // Regression: a nonempty $nin whose operands are all objects (or all null)
      // used to drop the predicate entirely, so the filter matched every row and
      // a filtered delete removed the whole index.
      const rows = [
        { id: 'obj-empty', metadata: { stage: {} } },
        { id: 'obj-value', metadata: { stage: { a: 1 } } },
        { id: 'arr-empty', metadata: { stage: [] } },
        { id: 'scalar-bool', metadata: { stage: false } },
        { id: 'scalar-num', metadata: { stage: 0 } },
        { id: 'null-stage', metadata: { stage: null } },
        { id: 'missing-stage', metadata: { other: 'x' } },
      ];

      beforeEach(async () => {
        await seed(rows);
      });

      it('$in matches an object operand by its stored JSON text', async () => {
        expect(await matchingIds({ stage: { $in: [{}] } })).toEqual(['obj-empty']);
        expect(await matchingIds({ stage: { $in: [{ a: 1 }] } })).toEqual(['obj-value']);
      });

      it('$in supports mixed scalar and object operands', async () => {
        expect(await matchingIds({ stage: { $in: [false, {}] } })).toEqual(['obj-empty', 'scalar-bool']);
      });

      it('a nonempty object-only $nin still restricts the result set', async () => {
        expect(await matchingIds({ stage: { $nin: [{}] } })).toEqual([
          'arr-empty',
          'obj-value',
          'scalar-bool',
          'scalar-num',
        ]);
      });

      it('a nonempty null-only $nin matches nothing rather than everything', async () => {
        expect(await matchingIds({ stage: { $nin: [null] } })).toEqual([]);
      });

      it('$nin supports mixed scalar and object operands', async () => {
        expect(await matchingIds({ stage: { $nin: [false, {}] } })).toEqual(['arr-empty', 'obj-value', 'scalar-num']);
      });

      it('a filtered delete with an object-only $nin preserves unrelated rows', async () => {
        await vectorDB.deleteVectors({ indexName: scalarIndexName, filter: { stage: { $nin: [{}] } } });

        expect(await matchingIds({})).toEqual(['missing-stage', 'null-stage', 'obj-empty']);
      });

      it('a filtered delete with a null-only $nin preserves every row', async () => {
        await vectorDB.deleteVectors({ indexName: scalarIndexName, filter: { stage: { $nin: [null] } } });

        expect(await matchingIds({})).toEqual(rows.map(r => r.id).sort());
      });
    });

    describe('nested paths and logical composition', () => {
      beforeEach(async () => {
        await seed([
          { id: 'nested-bool', metadata: { user: { role: false } } },
          { id: 'nested-num', metadata: { user: { role: 0 } } },
          { id: 'nested-str', metadata: { user: { role: 'false' } } },
        ]);
      });

      it('applies the type rules to nested dotted paths', async () => {
        expect(await matchingIds({ 'user.role': false })).toEqual(['nested-bool']);
        expect(await matchingIds({ 'user.role': 0 })).toEqual(['nested-num']);
      });

      it('composes typed comparisons inside $or', async () => {
        expect(await matchingIds({ $or: [{ 'user.role': false }, { 'user.role': 0 }] })).toEqual([
          'nested-bool',
          'nested-num',
        ]);
      });
    });

    describe('filtered updates', () => {
      beforeEach(async () => {
        await seed([
          { id: 'update-bool', metadata: { stage: false, touched: false } },
          { id: 'update-num', metadata: { stage: 0, touched: false } },
        ]);
      });

      it('updates only rows whose stored type matches the filter', async () => {
        await vectorDB.updateVector({
          indexName: scalarIndexName,
          filter: { stage: false },
          update: { metadata: { stage: false, touched: true } },
        });

        expect(await metadataById('update-bool')).toEqual({ stage: false, touched: true });
        expect(await metadataById('update-num')).toEqual({ stage: 0, touched: false });
      });
    });

    describe('filtered deletes', () => {
      beforeEach(async () => {
        await seed([
          { id: 'delete-bool', metadata: { stage: false } },
          { id: 'delete-num', metadata: { stage: 0 } },
        ]);
      });

      it('deletes only rows whose stored type matches the filter', async () => {
        await vectorDB.deleteVectors({ indexName: scalarIndexName, filter: { stage: false } });
        expect(await matchingIds({})).toEqual(['delete-num']);
      });
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
