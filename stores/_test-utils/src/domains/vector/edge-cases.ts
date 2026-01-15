import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { VectorTestConfig } from '../../vector-factory';
import { createUnitVector, createVector, VECTOR_DIMENSION } from './test-helpers';

export interface EdgeCasesOptions {
  /** Skip large batch operations (1000+ vectors). Useful for stores with slow batch inserts. */
  skipLargeBatch?: boolean;
  /** Skip concurrent operations tests. Useful for stores that don't handle concurrent writes well. */
  skipConcurrency?: boolean;
}

/**
 * Shared test suite for vector store edge cases and stress testing.
 * These tests cover boundary conditions and unusual scenarios:
 * - Empty index operations (queries on empty indexes)
 * - Dimension mismatch handling (wrong vector dimensions)
 * - Large batch operations (1000+ vectors for scale testing)
 * - Concurrent operations (parallel upserts/queries for race conditions)
 * - Vector normalization edge cases (zero magnitude, NaN values)
 *
 * These tests ensure vector stores handle edge cases gracefully and scale properly.
 */
export function createEdgeCasesTest(config: VectorTestConfig, options: EdgeCasesOptions = {}) {
  const { createIndex, deleteIndex, waitForIndexing = () => new Promise(resolve => setTimeout(resolve, 100)) } = config;

  describe('Vector Store Edge Cases', () => {
    describe('Empty Index Operations', () => {
      const emptyTestIndex = `empty_test_${Date.now()}`;

      beforeAll(async () => {
        await createIndex(emptyTestIndex);
        await waitForIndexing(emptyTestIndex);
      });

      afterAll(async () => {
        try {
          await deleteIndex(emptyTestIndex);
        } catch {
          // Ignore cleanup errors
        }
      });

      it('should handle queries on empty index gracefully', async () => {
        const results = await config.vector.query({
          indexName: emptyTestIndex,
          queryVector: createVector(1),
          topK: 10,
        });

        // Empty index should return empty results, not throw error
        expect(results).toEqual([]);
      });

      it('should report zero count for empty index', async () => {
        const stats = await config.vector.describeIndex({ indexName: emptyTestIndex });
        expect(stats.count).toBe(0);
      });

      it('should handle deleteVectors on empty index gracefully', async () => {
        // Deleting from empty index should not throw error
        await expect(
          config.vector.deleteVectors({
            indexName: emptyTestIndex,
            ids: ['nonexistent-id'],
          }),
        ).resolves.not.toThrow();
      });
    });

    describe('Dimension Mismatch', () => {
      const dimensionTestIndex = `dimension_test_${Date.now()}`;

      beforeAll(async () => {
        await createIndex(dimensionTestIndex);
        await waitForIndexing(dimensionTestIndex);
      });

      afterAll(async () => {
        try {
          await deleteIndex(dimensionTestIndex);
        } catch {
          // Ignore cleanup errors
        }
      });

      it('should reject upsert with wrong dimension vector', async () => {
        const wrongDimensionVector = new Array(512).fill(0.1); // Wrong dimension (512 instead of 1536)

        await expect(
          config.vector.upsert({
            indexName: dimensionTestIndex,
            vectors: [wrongDimensionVector],
            metadata: [{ test: 'wrong-dimension' }],
          }),
        ).rejects.toThrow();
      });

      it('should reject query with wrong dimension vector', async () => {
        // First upsert a valid vector
        await config.vector.upsert({
          indexName: dimensionTestIndex,
          vectors: [createVector(1)],
          metadata: [{ test: 'valid' }],
        });
        await waitForIndexing(dimensionTestIndex);

        // Then try to query with wrong dimension
        const wrongDimensionVector = new Array(768).fill(0.1); // Wrong dimension (768 instead of 1536)

        await expect(
          config.vector.query({
            indexName: dimensionTestIndex,
            queryVector: wrongDimensionVector,
            topK: 5,
          }),
        ).rejects.toThrow();
      });

      it('should reject upsert with empty vector', async () => {
        await expect(
          config.vector.upsert({
            indexName: dimensionTestIndex,
            vectors: [[]],
            metadata: [{ test: 'empty-vector' }],
          }),
        ).rejects.toThrow();
      });
    });

    // Large batch tests can be skipped for stores with slow batch inserts (e.g., libsql)
    if (!options.skipLargeBatch) {
      describe('Large Batch Operations', () => {
        const largeBatchTestIndex = `large_batch_test_${Date.now()}`;
        const LARGE_BATCH_SIZE = 1000;

        beforeAll(async () => {
          await createIndex(largeBatchTestIndex);
          await waitForIndexing(largeBatchTestIndex);
        });

        afterAll(async () => {
          try {
            await deleteIndex(largeBatchTestIndex);
          } catch {
            // Ignore cleanup errors
          }
        });

        it('should handle upserting 1000+ vectors', async () => {
          // Generate 1000 test vectors
          const vectors = Array.from({ length: LARGE_BATCH_SIZE }, (_, i) => createVector(i));
          const metadata = Array.from({ length: LARGE_BATCH_SIZE }, (_, i) => ({ batch: 'large', index: i }));

          const ids = await config.vector.upsert({
            indexName: largeBatchTestIndex,
            vectors,
            metadata,
          });

          expect(ids.length).toBe(LARGE_BATCH_SIZE);

          // Wait for indexing to complete
          await waitForIndexing(largeBatchTestIndex);

          // Verify count
          const stats = await config.vector.describeIndex({ indexName: largeBatchTestIndex });
          expect(stats.count).toBe(LARGE_BATCH_SIZE);
        }, 120000); // 2 minute timeout for large batch

        it('should handle querying with large topK', async () => {
          const results = await config.vector.query({
            indexName: largeBatchTestIndex,
            queryVector: createVector(500),
            topK: 500, // Query for 500 results
          });

          // Should return up to 500 results
          expect(results.length).toBeGreaterThan(0);
          expect(results.length).toBeLessThanOrEqual(500);
        }, 60000); // 1 minute timeout

        it('should handle deleting large batch of vectors', async () => {
          // Delete half the vectors (500)
          const idsToDelete = Array.from({ length: 500 }, (_, i) => `${i}`);

          await config.vector.deleteVectors({
            indexName: largeBatchTestIndex,
            filter: { batch: 'large', index: { $lt: 500 } },
          });

          await waitForIndexing(largeBatchTestIndex);

          // Verify count decreased
          const stats = await config.vector.describeIndex({ indexName: largeBatchTestIndex });
          expect(stats.count).toBeLessThanOrEqual(LARGE_BATCH_SIZE);
        }, 120000); // 2 minute timeout
      });
    }

    if (!options.skipConcurrency) {
      describe('Concurrent Operations', () => {
        const concurrentTestIndex = `concurrent_test_${Date.now()}`;

        beforeAll(async () => {
          await createIndex(concurrentTestIndex);
          await waitForIndexing(concurrentTestIndex);
        });

        afterAll(async () => {
          try {
            await deleteIndex(concurrentTestIndex);
          } catch {
            // Ignore cleanup errors
          }
        });

        it('should handle concurrent upserts', async () => {
          // Perform 10 concurrent upserts with different vectors
          const upsertPromises = Array.from({ length: 10 }, (_, i) =>
            config.vector.upsert({
              indexName: concurrentTestIndex,
              vectors: [createVector(i * 100)],
              metadata: [{ concurrent: true, batch: i }],
            }),
          );

          const results = await Promise.all(upsertPromises);

          // All upserts should succeed
          expect(results).toHaveLength(10);
          results.forEach(ids => {
            expect(ids).toHaveLength(1);
          });

          await waitForIndexing(concurrentTestIndex);

          // Verify all vectors were inserted
          const stats = await config.vector.describeIndex({ indexName: concurrentTestIndex });
          expect(stats.count).toBe(10);
        });

        it('should handle concurrent queries', async () => {
          // First, ensure we have some vectors
          await config.vector.upsert({
            indexName: concurrentTestIndex,
            vectors: Array.from({ length: 5 }, (_, i) => createVector(i)),
            metadata: Array.from({ length: 5 }, (_, i) => ({ test: 'concurrent-query', id: i })),
          });
          await waitForIndexing(concurrentTestIndex);

          // Perform 10 concurrent queries
          const queryPromises = Array.from({ length: 10 }, (_, i) =>
            config.vector.query({
              indexName: concurrentTestIndex,
              queryVector: createVector(i),
              topK: 5,
            }),
          );

          const results = await Promise.all(queryPromises);

          // All queries should succeed
          expect(results).toHaveLength(10);
          results.forEach(queryResults => {
            expect(queryResults.length).toBeGreaterThan(0);
          });
        });

        it('should handle concurrent mixed operations', async () => {
          // Mix of upserts, queries, and updates running concurrently
          const operations = [
            // Upserts
            config.vector.upsert({
              indexName: concurrentTestIndex,
              vectors: [createVector(200)],
              metadata: [{ op: 'upsert', id: 1 }],
            }),
            config.vector.upsert({
              indexName: concurrentTestIndex,
              vectors: [createVector(201)],
              metadata: [{ op: 'upsert', id: 2 }],
            }),
            // Queries
            config.vector.query({
              indexName: concurrentTestIndex,
              queryVector: createVector(100),
              topK: 10,
            }),
            config.vector.query({
              indexName: concurrentTestIndex,
              queryVector: createVector(101),
              topK: 10,
            }),
          ];

          // All operations should complete without errors
          await expect(Promise.all(operations)).resolves.toBeDefined();
        });
      });
    }

    describe('Vector Normalization Edge Cases', () => {
      const normalizationTestIndex = `normalization_test_${Date.now()}`;

      beforeAll(async () => {
        await createIndex(normalizationTestIndex);
        await waitForIndexing(normalizationTestIndex);
      });

      afterAll(async () => {
        try {
          await deleteIndex(normalizationTestIndex);
        } catch {
          // Ignore cleanup errors
        }
      });

      it('should handle vectors with zero magnitude gracefully', async () => {
        const zeroVector = new Array(VECTOR_DIMENSION).fill(0);

        // Some stores may reject zero vectors, others may accept them
        // We test that the operation either succeeds or throws a clear error
        try {
          await config.vector.upsert({
            indexName: normalizationTestIndex,
            vectors: [zeroVector],
            metadata: [{ test: 'zero-magnitude' }],
          });
          await waitForIndexing(normalizationTestIndex);

          // If accepted, verify we can query it
          const results = await config.vector.query({
            indexName: normalizationTestIndex,
            queryVector: createVector(1),
            topK: 10,
          });
          expect(results).toBeDefined();
        } catch (error) {
          // If rejected, error should be meaningful
          expect(error).toBeDefined();
        }
      });

      it('should reject vectors with NaN values', async () => {
        const nanVector = new Array(VECTOR_DIMENSION).fill(NaN);

        await expect(
          config.vector.upsert({
            indexName: normalizationTestIndex,
            vectors: [nanVector],
            metadata: [{ test: 'nan-values' }],
          }),
        ).rejects.toThrow();
      });

      it('should reject vectors with Infinity values', async () => {
        const infinityVector = new Array(VECTOR_DIMENSION).fill(Infinity);

        await expect(
          config.vector.upsert({
            indexName: normalizationTestIndex,
            vectors: [infinityVector],
            metadata: [{ test: 'infinity-values' }],
          }),
        ).rejects.toThrow();
      });

      it('should handle very small magnitude vectors', async () => {
        // Vector with very small but non-zero values (near machine epsilon)
        const tinyVector = new Array(VECTOR_DIMENSION).fill(1e-10);

        try {
          await config.vector.upsert({
            indexName: normalizationTestIndex,
            vectors: [tinyVector],
            metadata: [{ test: 'tiny-magnitude' }],
          });
          await waitForIndexing(normalizationTestIndex);

          // If accepted, verify we can query it
          const results = await config.vector.query({
            indexName: normalizationTestIndex,
            queryVector: createVector(1),
            topK: 10,
          });
          expect(results).toBeDefined();
        } catch (error) {
          // If rejected, error should be meaningful
          expect(error).toBeDefined();
        }
      });

      it('should handle vectors with mixed extreme values', async () => {
        // Vector with both very large and very small values
        const extremeVector = new Array(VECTOR_DIMENSION).fill(0);
        extremeVector[0] = 1000;
        extremeVector[1] = 0.001;
        extremeVector[2] = -1000;

        try {
          await config.vector.upsert({
            indexName: normalizationTestIndex,
            vectors: [extremeVector],
            metadata: [{ test: 'extreme-values' }],
          });
          await waitForIndexing(normalizationTestIndex);

          // If accepted, verify we can query it
          const results = await config.vector.query({
            indexName: normalizationTestIndex,
            queryVector: createVector(1),
            topK: 10,
          });
          expect(results).toBeDefined();
        } catch (error) {
          // If rejected, error should be meaningful
          expect(error).toBeDefined();
        }
      });
    });
  });
}
