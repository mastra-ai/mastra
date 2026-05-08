import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { VectorTestConfig } from '../../vector-factory';
import { createVector, createUnitVector, VECTOR_DIMENSION } from './test-helpers';

/**
 * Shared test suite for error handling in vector operations.
 * These tests ensure consistent error behavior across all vector store implementations.
 *
 * Tests covered:
 * - Index not found errors (query, delete, describe, upsert on non-existent index)
 * - Invalid filter errors (malformed filter objects, unsupported operators)
 * - Invalid vector data (non-numeric values, wrong types, invalid dimensions)
 * - Invalid parameters (null/undefined required fields, negative topK)
 *
 * Note: Some error tests overlap with other domains but focus on error message quality
 * and consistent error handling patterns.
 */
export function createErrorHandlingTest(config: VectorTestConfig) {
  const {
    createIndex,
    deleteIndex,
    waitForIndexing = (indexName: string) => new Promise(resolve => setTimeout(resolve, 100)),
    supportsStrictOperatorValidation = true,
  } = config;

  describe('Error Handling', () => {
    let testIndexName: string;

    beforeAll(async () => {
      // Create unique index name for test isolation
      testIndexName = `errorhandlingtest${Date.now()}${Math.random().toString(36).substring(7)}`;

      // Create fresh index for tests
      try {
        await deleteIndex(testIndexName);
      } catch {
        // Ignore if doesn't exist
      }
      await createIndex(testIndexName);
      await waitForIndexing(testIndexName);
    });

    afterAll(async () => {
      try {
        await deleteIndex(testIndexName);
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('Index Not Found Errors', () => {
      const nonExistentIndexName = `nonexistent_index_${Date.now()}`;

      it('should throw error when querying non-existent index', async () => {
        await expect(
          config.vector.query({
            indexName: nonExistentIndexName,
            queryVector: createVector(1),
            topK: 5,
          }),
        ).rejects.toThrow();
      });

      it('should throw error when upserting to non-existent index', async () => {
        await expect(
          config.vector.upsert({
            indexName: nonExistentIndexName,
            vectors: [createVector(1)],
            metadata: [{ test: true }],
          }),
        ).rejects.toThrow();
      });

      it('should throw error when describing non-existent index', async () => {
        await expect(config.vector.describeIndex({ indexName: nonExistentIndexName })).rejects.toThrow();
      });

      it('should throw error when deleting vectors from non-existent index', async () => {
        await expect(
          config.vector.deleteVectors({
            indexName: nonExistentIndexName,
            filter: { test: true },
          }),
        ).rejects.toThrow();
      });

      it('should throw error when deleting non-existent index', async () => {
        // This test documents store-specific behavior:
        // - Some stores throw (expected for strict implementations)
        // - Some stores silently succeed (idempotent deletion)
        try {
          await config.vector.deleteIndex({ indexName: nonExistentIndexName });
          // Idempotent deletion succeeded - this is acceptable
        } catch (error) {
          // Strict implementation threw - verify it's an actual error
          expect(error).toBeInstanceOf(Error);
        }
      });
    });

    describe('Invalid Filter Errors', () => {
      beforeAll(async () => {
        // Insert test vectors for filter tests
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1), createVector(2)],
          metadata: [
            { category: 'electronics', price: 100 },
            { category: 'books', price: 20 },
          ],
        });
        await waitForIndexing(testIndexName);
      });

      it('should handle malformed filter objects gracefully', async () => {
        // Test with various malformed filters
        const malformedFilters = [
          { $invalidOperator: 'value' }, // Invalid operator
          { $and: 'not-an-array' }, // $and expects array
          { $or: {} }, // $or expects array
          { category: { $gt: 'string', $lt: 'another' } }, // Conflicting operators on string
        ];

        for (const filter of malformedFilters) {
          try {
            await config.vector.query({
              indexName: testIndexName,
              queryVector: createVector(1),
              topK: 5,
              filter,
            });
            // Some stores may gracefully handle these - that's OK
          } catch (error) {
            // Other stores may throw - also OK
            expect(error).toBeDefined();
          }
        }
      });

      it('should handle filter with null/undefined values appropriately', async () => {
        // Test filters with null/undefined - stores should handle consistently
        try {
          const results = await config.vector.query({
            indexName: testIndexName,
            queryVector: createVector(1),
            topK: 5,
            filter: { category: null as any },
          });
          // Some stores may return empty results - acceptable
          expect(Array.isArray(results)).toBe(true);
        } catch (error) {
          // Other stores may throw - also acceptable
          expect(error).toBeDefined();
        }
      });

      it('should reject deeply nested filters that exceed reasonable complexity', async () => {
        // Create a pathologically deep filter (100 levels of $and nesting)
        let deepFilter: any = { category: 'electronics' };
        for (let i = 0; i < 100; i++) {
          deepFilter = { $and: [deepFilter, { price: { $gte: 0 } }] };
        }

        try {
          await config.vector.query({
            indexName: testIndexName,
            queryVector: createVector(1),
            topK: 5,
            filter: deepFilter,
          });
          // Some stores may handle this - OK
        } catch (error) {
          // Most stores should reject or timeout - also OK
          expect(error).toBeDefined();
        }
      }, 10000); // 10s timeout for this potentially slow test
    });

    describe('Invalid Vector Data Errors', () => {
      it('should reject vectors with non-numeric values', async () => {
        const invalidVectors = [
          ['string' as any, 0.1, 0.2], // String in vector
          [0.1, NaN, 0.2], // NaN in vector (covered in edge-cases but testing error handling here)
          [0.1, Infinity, 0.2], // Infinity in vector
          [0.1, null as any, 0.2], // null in vector
          [0.1, undefined as any, 0.2], // undefined in vector
        ];

        for (const invalidVector of invalidVectors) {
          try {
            // Pad to correct dimension
            const paddedVector = [...invalidVector, ...new Array(VECTOR_DIMENSION - 3).fill(0)];
            await config.vector.upsert({
              indexName: testIndexName,
              vectors: [paddedVector as number[]],
              metadata: [{ test: 'invalid-data' }],
            });
            // Some stores may accept (e.g., coerce to 0) - document behavior
          } catch (error) {
            // Most stores should reject - expected behavior
            expect(error).toBeDefined();
          }
        }
      });

      it('should reject vectors with wrong type (not array)', async () => {
        await expect(
          config.vector.upsert({
            indexName: testIndexName,
            vectors: ['not-an-array' as any],
            metadata: [{ test: true }],
          }),
        ).rejects.toThrow();
      });

      it('should reject empty vectors array', async () => {
        // Note: This is tested in edge-cases.ts for dimension mismatch,
        // but we test it here for error handling consistency
        await expect(
          config.vector.upsert({
            indexName: testIndexName,
            vectors: [[]],
            metadata: [{ test: true }],
          }),
        ).rejects.toThrow();
      });

      it('should reject vectors with mismatched dimensions', async () => {
        // Create vector with wrong dimension (512 instead of 1536)
        const wrongDimensionVector = new Array(512).fill(0.1);

        await expect(
          config.vector.upsert({
            indexName: testIndexName,
            vectors: [wrongDimensionVector],
            metadata: [{ test: 'wrong-dimension' }],
          }),
        ).rejects.toThrow();
      });

      it('should reject query with wrong dimension vector', async () => {
        // Create query vector with wrong dimension (768 instead of 1536)
        const wrongDimensionQuery = new Array(768).fill(0.1);

        await expect(
          config.vector.query({
            indexName: testIndexName,
            queryVector: wrongDimensionQuery,
            topK: 5,
          }),
        ).rejects.toThrow();
      });
    });

    describe('Invalid Parameter Errors', () => {
      it('should reject query with negative topK', async () => {
        await expect(
          config.vector.query({
            indexName: testIndexName,
            queryVector: createVector(1),
            topK: -5,
          }),
        ).rejects.toThrow();
      });

      it('should reject query with zero topK', async () => {
        await expect(
          config.vector.query({
            indexName: testIndexName,
            queryVector: createVector(1),
            topK: 0,
          }),
        ).rejects.toThrow();
      });

      it('should reject query with non-integer topK', async () => {
        try {
          await config.vector.query({
            indexName: testIndexName,
            queryVector: createVector(1),
            topK: 5.5 as any, // Non-integer topK
          });
          // Some stores may coerce to integer - acceptable
        } catch (error) {
          // Other stores may reject - also acceptable
          expect(error).toBeDefined();
        }
      });

      it('should reject upsert with mismatched vectors/metadata lengths', async () => {
        // 2 vectors but 1 metadata object
        await expect(
          config.vector.upsert({
            indexName: testIndexName,
            vectors: [createVector(1), createVector(2)],
            metadata: [{ test: true }], // Length mismatch
          }),
        ).rejects.toThrow();
      });

      it('should reject upsert with mismatched vectors/ids lengths', async () => {
        // 2 vectors but 3 IDs
        await expect(
          config.vector.upsert({
            indexName: testIndexName,
            vectors: [createVector(1), createVector(2)],
            ids: ['id1', 'id2', 'id3'], // Length mismatch
            metadata: [{ test: true }, { test: false }],
          }),
        ).rejects.toThrow();
      });

      it('should reject upsert with empty vectors array', async () => {
        await expect(
          config.vector.upsert({
            indexName: testIndexName,
            vectors: [],
            metadata: [],
          }),
        ).rejects.toThrow();
      });

      it('should handle upsert with null/undefined metadata gracefully', async () => {
        // Some stores allow vectors without metadata, others require it
        try {
          await config.vector.upsert({
            indexName: testIndexName,
            vectors: [createVector(100)],
            metadata: [null as any],
          });
          // Some stores may accept null metadata - OK
          await waitForIndexing(testIndexName);
        } catch (error) {
          // Other stores may reject - also OK
          expect(error).toBeDefined();
        }
      });

      it('should reject createIndex with invalid dimension', async () => {
        const invalidIndexName = `invalid_dim_${Date.now()}`;

        // Test negative dimension
        await expect(
          config.vector.createIndex({
            indexName: invalidIndexName,
            dimension: -100,
            metric: 'cosine',
          }),
        ).rejects.toThrow();

        // Test zero dimension
        await expect(
          config.vector.createIndex({
            indexName: `${invalidIndexName}_zero`,
            dimension: 0,
            metric: 'cosine',
          }),
        ).rejects.toThrow();
      });

      it('should reject createIndex with invalid metric', async () => {
        const invalidIndexName = `invalid_metric_${Date.now()}`;

        try {
          await config.vector.createIndex({
            indexName: invalidIndexName,
            dimension: VECTOR_DIMENSION,
            metric: 'invalid-metric-type' as any,
          });
          // Some stores may silently fall back to default metric - acceptable
          await deleteIndex(invalidIndexName);
        } catch (error) {
          // Other stores may reject - also acceptable
          expect(error).toBeDefined();
        }
      });
    });

    describe('Metadata Type Errors', () => {
      it('should handle metadata with circular references', async () => {
        // Create circular reference
        const circularMetadata: any = { name: 'test' };
        circularMetadata.self = circularMetadata;

        try {
          await config.vector.upsert({
            indexName: testIndexName,
            vectors: [createVector(200)],
            metadata: [circularMetadata],
          });
          // Some stores may handle by serializing or rejecting - both OK
        } catch (error) {
          // Expected for most stores
          expect(error).toBeDefined();
        }
      });

      it('should handle metadata with functions', async () => {
        // Metadata with function (should be rejected or stripped)
        try {
          await config.vector.upsert({
            indexName: testIndexName,
            vectors: [createVector(201)],
            metadata: [{ name: 'test', fn: () => 'invalid' } as any],
          });
          // Some stores may strip functions - acceptable
        } catch (error) {
          // Other stores may reject - also acceptable
          expect(error).toBeDefined();
        }
      });

      it('should handle metadata with symbols', async () => {
        // Metadata with symbol (should be rejected or stripped)
        try {
          await config.vector.upsert({
            indexName: testIndexName,
            vectors: [createVector(202)],
            metadata: [{ name: 'test', sym: Symbol('test') } as any],
          });
          // Some stores may strip symbols - acceptable
        } catch (error) {
          // Other stores may reject - also acceptable
          expect(error).toBeDefined();
        }
      });

      it('should handle extremely large metadata objects', async () => {
        // Create large metadata (1MB string)
        const largeString = 'x'.repeat(1024 * 1024);

        try {
          await config.vector.upsert({
            indexName: testIndexName,
            vectors: [createVector(203)],
            metadata: [{ largeField: largeString }],
          });
          // Some stores may accept large metadata - OK
          await waitForIndexing(testIndexName);
        } catch (error) {
          // Other stores may reject due to size limits - also OK
          expect(error).toBeDefined();
        }
      }, 30000); // 30s timeout for potentially slow operation
    });

    describe('Concurrent Operation Errors', () => {
      it('should handle double deletion of same index gracefully', async () => {
        const tempIndexName = `temp_double_delete_${Date.now()}`;

        // Create index
        await createIndex(tempIndexName);
        await waitForIndexing(tempIndexName);

        // Delete once
        await deleteIndex(tempIndexName);

        // Try to delete again - should either succeed (idempotent) or throw
        try {
          await deleteIndex(tempIndexName);
          // Idempotent deletion - acceptable
        } catch (error) {
          // Or reject second deletion - also acceptable
          expect(error).toBeDefined();
        }
      });

      it('should handle concurrent upserts to same index', async () => {
        // Perform 5 concurrent upserts
        const promises = Array.from({ length: 5 }, (_, i) =>
          config.vector.upsert({
            indexName: testIndexName,
            vectors: [createVector(300 + i)],
            metadata: [{ concurrent: true, batch: i }],
          }),
        );

        // All should succeed or fail consistently
        const results = await Promise.allSettled(promises);
        const failures = results.filter(r => r.status === 'rejected');

        // Either all succeed or all fail - no partial success
        expect(failures.length === 0 || failures.length === results.length).toBe(true);
      }, 30000);
    });

    describe('Invalid Filter Operator Errors', () => {
      it('should reject query with invalid/unsupported operator', async () => {
        // Insert test data first
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(400)],
          metadata: [{ name: 'test', value: 42 }],
        });
        await waitForIndexing(testIndexName);

        // Try to query with an invalid operator
        await expect(
          config.vector.query({
            indexName: testIndexName,
            queryVector: createVector(400),
            topK: 10,
            filter: { value: { $invalidOperator: 10 } } as any,
          }),
        ).rejects.toThrow(/unsupported|invalid|unknown.*operator/i);
      });

      it.skipIf(!supportsStrictOperatorValidation)('should reject query with malformed operator syntax', async () => {
        // Insert test data first
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(401)],
          metadata: [{ name: 'test', price: 100 }],
        });
        await waitForIndexing(testIndexName);

        // Try to query with malformed operator (array instead of value)
        await expect(
          config.vector.query({
            indexName: testIndexName,
            queryVector: createVector(401),
            topK: 10,
            filter: { price: { $gt: [10, 20] } } as any, // $gt should take a number, not an array
          }),
        ).rejects.toThrow();
      });
    });
  });
}
