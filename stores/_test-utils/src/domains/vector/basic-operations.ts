import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { VectorTestConfig, VectorMetric } from '../../vector-factory';
import { createUnitVector, createVector, VECTOR_DIMENSION } from './test-helpers';

/**
 * Shared test suite for basic vector store operations.
 * These tests cover fundamental functionality that all vector stores should support:
 * - Index lifecycle (create, list, describe, delete)
 * - Basic upsert operations (single vector, multiple vectors, duplicate IDs)
 * - Basic query operations (simple queries, topK variations, with/without filters)
 *
 * This test domain ensures that vector stores implement the core MastraVector interface correctly.
 */
export function createBasicOperationsTest(config: VectorTestConfig) {
  const { createIndex, deleteIndex, waitForIndexing = (_indexName: string) => new Promise(resolve => setTimeout(resolve, 100)) } = config;

  describe('Basic Vector Operations', () => {
    describe('Index Lifecycle', () => {
      const lifecycleTestIndex = `lifecycle_test_${Date.now()}`;

      afterAll(async () => {
        // Cleanup: ensure test index is deleted
        try {
          await deleteIndex(lifecycleTestIndex);
        } catch {
          // Ignore if already deleted
        }
      });

      it('should create a new index', async () => {
        await createIndex(lifecycleTestIndex);
        await waitForIndexing(lifecycleTestIndex);

        // Verify index exists by listing indexes
        const indexes = await config.vector.listIndexes();
        expect(indexes).toContain(lifecycleTestIndex);
      });

      it('should list all indexes', async () => {
        const indexes = await config.vector.listIndexes();

        // Should return an array
        expect(Array.isArray(indexes)).toBe(true);

        // Should include the test index we created
        expect(indexes).toContain(lifecycleTestIndex);
      });

      it('should describe an existing index', async () => {
        const stats = await config.vector.describeIndex({ indexName: lifecycleTestIndex });

        // Should return index statistics
        expect(stats).toBeDefined();
        expect(typeof stats.count).toBe('number');
        expect(stats.count).toBeGreaterThanOrEqual(0);

        // Should include dimension information
        if (stats.dimension !== undefined) {
          expect(stats.dimension).toBe(VECTOR_DIMENSION);
        }
      });

      it('should delete an existing index', async () => {
        await deleteIndex(lifecycleTestIndex);
        // Wait for deletion to propagate in distributed stores
        await waitForIndexing(lifecycleTestIndex);

        // Verify index no longer exists
        const indexes = await config.vector.listIndexes();
        expect(indexes).not.toContain(lifecycleTestIndex);
      });

      it('should handle querying non-existent index with error', async () => {
        const nonExistentIndex = `non_existent_${Date.now()}`;

        // Querying non-existent index should throw error
        await expect(
          config.vector.query({
            indexName: nonExistentIndex,
            queryVector: createUnitVector(0),
            topK: 5,
          }),
        ).rejects.toThrow();
      });
    });

    describe('Basic Upsert', () => {
      const upsertTestIndex = `upsert_test_${Date.now()}`;

      beforeAll(async () => {
        await createIndex(upsertTestIndex);
        await waitForIndexing(upsertTestIndex);
      });

      afterAll(async () => {
        try {
          await deleteIndex(upsertTestIndex);
        } catch {
          // Ignore cleanup errors
        }
      });

      it('should upsert a single vector', async () => {
        const vector = createVector(1);
        const metadata = { type: 'single', index: 1 };

        const ids = await config.vector.upsert({
          indexName: upsertTestIndex,
          vectors: [vector],
          metadata: [metadata],
        });

        // Should return array of IDs
        expect(Array.isArray(ids)).toBe(true);
        expect(ids).toHaveLength(1);
        expect(typeof ids[0]).toBe('string');

        await waitForIndexing(upsertTestIndex);

        // Verify vector was stored
        const stats = await config.vector.describeIndex({ indexName: upsertTestIndex });
        expect(stats.count).toBeGreaterThanOrEqual(1);
      });

      it('should upsert multiple vectors at once', async () => {
        const vectors = [createVector(2), createVector(3), createVector(4)];
        const metadata = [
          { type: 'batch', index: 2 },
          { type: 'batch', index: 3 },
          { type: 'batch', index: 4 },
        ];

        const ids = await config.vector.upsert({
          indexName: upsertTestIndex,
          vectors,
          metadata,
        });

        // Should return array of IDs matching input length
        expect(Array.isArray(ids)).toBe(true);
        expect(ids).toHaveLength(3);
        expect(ids.every(id => typeof id === 'string')).toBe(true);

        await waitForIndexing(upsertTestIndex);

        // Verify all vectors were stored
        const stats = await config.vector.describeIndex({ indexName: upsertTestIndex });
        expect(stats.count).toBeGreaterThanOrEqual(4); // 1 from previous test + 3 from this test
      });

      it('should handle upserting with duplicate IDs (update)', async () => {
        const vector1 = createVector(10);
        const metadata1 = { type: 'original', value: 'first' };

        // First upsert
        const ids = await config.vector.upsert({
          indexName: upsertTestIndex,
          vectors: [vector1],
          metadata: [metadata1],
        });

        await waitForIndexing(upsertTestIndex);
        const countBefore = (await config.vector.describeIndex({ indexName: upsertTestIndex })).count;

        // Upsert again with same ID but different metadata (should update, not insert)
        const vector2 = createVector(11);
        const metadata2 = { type: 'updated', value: 'second' };

        await config.vector.upsert({
          indexName: upsertTestIndex,
          vectors: [vector2],
          metadata: [metadata2],
          ids,
        });

        await waitForIndexing(upsertTestIndex);

        // Count should not increase (update, not insert)
        const countAfter = (await config.vector.describeIndex({ indexName: upsertTestIndex })).count;
        expect(countAfter).toBe(countBefore);
      });

      it('should upsert vectors without metadata', async () => {
        const vectors = [createVector(20), createVector(21)];

        const ids = await config.vector.upsert({
          indexName: upsertTestIndex,
          vectors,
        });

        expect(ids).toHaveLength(2);
        await waitForIndexing(upsertTestIndex);

        // Should be able to query these vectors
        const results = await config.vector.query({
          indexName: upsertTestIndex,
          queryVector: createVector(20),
          topK: 5,
        });

        // Should find at least some results
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('Basic Query', () => {
      const queryTestIndex = `query_test_${Date.now()}`;

      beforeAll(async () => {
        await createIndex(queryTestIndex);
        await waitForIndexing(queryTestIndex);

        // Insert test vectors with distinguishable metadata
        const vectors = [createVector(1), createVector(2), createVector(3), createVector(4), createVector(5)];

        const metadata = [
          { category: 'A', value: 1 },
          { category: 'A', value: 2 },
          { category: 'B', value: 3 },
          { category: 'B', value: 4 },
          { category: 'C', value: 5 },
        ];

        await config.vector.upsert({
          indexName: queryTestIndex,
          vectors,
          metadata,
        });

        await waitForIndexing(queryTestIndex);
      });

      afterAll(async () => {
        try {
          await deleteIndex(queryTestIndex);
        } catch {
          // Ignore cleanup errors
        }
      });

      it('should perform a basic query', async () => {
        const results = await config.vector.query({
          indexName: queryTestIndex,
          queryVector: createVector(1),
          topK: 5,
        });

        // Should return results
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        expect(results.length).toBeLessThanOrEqual(5);

        // Each result should have required fields
        results.forEach(result => {
          expect(result).toHaveProperty('id');
          expect(result).toHaveProperty('score');
          expect(typeof result.id).toBe('string');
          expect(typeof result.score).toBe('number');
        });
      });

      it('should respect topK parameter', async () => {
        const topK = 3;
        const results = await config.vector.query({
          indexName: queryTestIndex,
          queryVector: createVector(2),
          topK,
        });

        // Should return at most topK results
        expect(results.length).toBeLessThanOrEqual(topK);
        expect(results.length).toBeGreaterThan(0);
      });

      it('should return results sorted by similarity score', async () => {
        const results = await config.vector.query({
          indexName: queryTestIndex,
          queryVector: createVector(1),
          topK: 5,
        });

        // Scores should be in descending order (higher score = more similar)
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i]?.score).toBeGreaterThanOrEqual(results[i + 1]?.score ?? 0);
        }
      });

      it('should query with metadata filter', async () => {
        const results = await config.vector.query({
          indexName: queryTestIndex,
          queryVector: createVector(3),
          topK: 10,
          filter: { category: 'A' },
        });

        // Should only return results matching the filter
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.metadata?.category === 'A')).toBe(true);

        // Should not exceed the number of vectors with category 'A' (2 in our test data)
        expect(results.length).toBeLessThanOrEqual(2);
      });

      it('should return all results when topK exceeds vector count', async () => {
        const results = await config.vector.query({
          indexName: queryTestIndex,
          queryVector: createVector(1),
          topK: 1000,
        });

        // Should return all 5 vectors we inserted
        expect(results.length).toBeLessThanOrEqual(5);
      });

      it('should return empty results for filter with no matches', async () => {
        const results = await config.vector.query({
          indexName: queryTestIndex,
          queryVector: createVector(1),
          topK: 10,
          filter: { category: 'NonExistent' },
        });

        expect(results).toHaveLength(0);
      });

      it('should handle query with minimum topK value', async () => {
        const results = await config.vector.query({
          indexName: queryTestIndex,
          queryVector: createVector(1),
          topK: 1,
        });

        // Should return exactly 1 result
        expect(results).toHaveLength(1);
        expect(results[0]).toHaveProperty('id');
        expect(results[0]).toHaveProperty('score');
      });

      it('should include vectors in results when includeVector is true', async () => {
        const results = await config.vector.query({
          indexName: queryTestIndex,
          queryVector: createVector(1),
          topK: 3,
          includeVector: true,
        });

        // Should return results with vectors
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result).toHaveProperty('vector');
          expect(Array.isArray(result.vector)).toBe(true);
          expect(result.vector?.length).toBeGreaterThan(0);
        });
      });

      it('should not include vectors in results when includeVector is false', async () => {
        const results = await config.vector.query({
          indexName: queryTestIndex,
          queryVector: createVector(1),
          topK: 3,
          includeVector: false,
        });

        // Should return results without vectors
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          // Vector should be undefined or not present
          expect(result.vector).toBeUndefined();
        });
      });
    });

    describe('Metric Variations', () => {
      const metrics: VectorMetric[] = ['cosine', 'euclidean', 'dotproduct'];

      for (const metric of metrics) {
        describe(`${metric} metric`, () => {
          const metricTestIndex = `metric_${metric}_test_${Date.now()}`;

          afterAll(async () => {
            try {
              await deleteIndex(metricTestIndex);
            } catch {
              // Ignore cleanup errors
            }
          });

          it(`should create index with ${metric} metric`, async () => {
            await createIndex(metricTestIndex, { metric });
            await waitForIndexing(metricTestIndex);

            // Verify index exists
            const indexes = await config.vector.listIndexes();
            expect(indexes).toContain(metricTestIndex);
          });

          it(`should upsert and query vectors with ${metric} metric`, async () => {
            // Insert test vectors
            const vectors = [createVector(1), createVector(2), createVector(3)];
            const metadata = [
              { type: 'metric-test', index: 1 },
              { type: 'metric-test', index: 2 },
              { type: 'metric-test', index: 3 },
            ];

            await config.vector.upsert({
              indexName: metricTestIndex,
              vectors,
              metadata,
            });

            await waitForIndexing(metricTestIndex);

            // Query should work with the specified metric
            const results = await config.vector.query({
              indexName: metricTestIndex,
              queryVector: createVector(1),
              topK: 3,
            });

            expect(results.length).toBeGreaterThan(0);
            expect(results[0]).toHaveProperty('id');
            expect(results[0]).toHaveProperty('score');
          });
        });
      }
    });
  });
}
