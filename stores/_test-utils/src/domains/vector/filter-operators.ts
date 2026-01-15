import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { VectorTestConfig } from '../../vector-factory';
import { createVector, createUnitVector } from './test-helpers';

/**
 * Shared test suite for filter operators in vector stores.
 * This test ensures vector stores correctly handle various filter operators
 * for metadata-based queries, enabling rich semantic search capabilities.
 *
 * Operators tested:
 * - Comparison: $gt, $lt, $gte, $lte, $ne
 * - Logical: $in, $nin, $all (Note: $and, $or are tested in advanced-operations.ts)
 * - Pattern matching: $regex, $contains (OPTIONAL - not all stores support)
 * - Existence: $exists (check if field exists)
 * - Negation: $not (logical NOT)
 * - Null handling: filtering by null values
 *
 * @remarks
 * Some operators like $regex, $contains, and $like may not be supported by all vector stores.
 * Stores can skip these tests if needed by catching errors or checking capabilities.
 */
export function createFilterOperatorsTest(config: VectorTestConfig) {
  const {
    createIndex,
    deleteIndex,
    waitForIndexing = () => new Promise(resolve => setTimeout(resolve, 5000)),
    supportsArrayMetadata = true,
    supportsNullValues = true,
    supportsExistsOperator = true,
    supportsRegex = true,
    supportsContains = true,
    supportsNotOperator = true,
  } = config;

  describe('Filter Operators', () => {
    const testIndexName = `filter_ops_test_${Date.now()}`;

    beforeAll(async () => {
      // Create index for testing
      await createIndex(testIndexName);

      // Insert test vectors with diverse metadata for operator testing
      const vectors = [
        createVector(1), // Product A
        createVector(2), // Product B
        createVector(3), // Product C
        createVector(4), // Product D
        createVector(5), // Product E
        createVector(6), // Product F
        createVector(7), // Product G
        createVector(8), // Product H
      ];

      // Build metadata - conditionally include tags array if store supports array metadata
      const metadata = [
        {
          name: 'Product A',
          price: 10,
          rating: 4.5,
          category: 'electronics',
          ...(supportsArrayMetadata ? { tags: ['new', 'sale'] } : {}),
          available: true,
        },
        {
          name: 'Product B',
          price: 25,
          rating: 3.8,
          category: 'electronics',
          ...(supportsArrayMetadata ? { tags: ['featured'] } : {}),
          available: true,
        },
        {
          name: 'Product C',
          price: 50,
          rating: 4.9,
          category: 'home',
          ...(supportsArrayMetadata ? { tags: ['premium', 'sale'] } : {}),
          available: false,
        },
        {
          name: 'Product D',
          price: 100,
          rating: 4.2,
          category: 'home',
          ...(supportsArrayMetadata ? { tags: ['premium'] } : {}),
          available: true,
        },
        {
          name: 'Product E',
          price: 15,
          rating: 3.5,
          category: 'books',
          ...(supportsArrayMetadata ? { tags: ['new'] } : {}),
          available: true,
        },
        {
          name: 'Product F',
          price: 75,
          rating: 4.7,
          category: 'electronics',
          ...(supportsArrayMetadata ? { tags: ['featured', 'premium'] } : {}),
          available: true,
        },
        {
          name: 'Product G',
          price: 30,
          rating: 4.0,
          category: 'books',
          ...(supportsArrayMetadata ? { tags: ['sale'] } : {}),
          available: false,
          description: 'Classic novel',
        },
        {
          name: 'Product H',
          price: 200,
          rating: 5.0,
          category: 'home',
          ...(supportsArrayMetadata ? { tags: ['premium', 'luxury'] } : {}),
          available: true,
        },
      ];

      await config.vector.upsert({
        indexName: testIndexName,
        vectors,
        metadata,
      });

      // Wait for indexing to complete
      await waitForIndexing(testIndexName);
    });

    afterAll(async () => {
      await deleteIndex(testIndexName);
    });

    describe('Comparison Operators', () => {
      it('should filter by $gt (greater than) on numeric field', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: { price: { $gt: 50 } },
        });

        // Should return products with price > 50 (Product D: 100, Product F: 75, Product H: 200)
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => (r.metadata?.price as number) > 50)).toBe(true);
        expect(results.length).toBe(3);
      });

      it('should filter by $gte (greater than or equal) on numeric field', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: { price: { $gte: 50 } },
        });

        // Should return products with price >= 50 (Product C: 50, Product D: 100, Product F: 75, Product H: 200)
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => (r.metadata?.price as number) >= 50)).toBe(true);
        expect(results.length).toBe(4);
      });

      it('should filter by $lt (less than) on numeric field', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: { price: { $lt: 30 } },
        });

        // Should return products with price < 30 (Product A: 10, Product B: 25, Product E: 15)
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => (r.metadata?.price as number) < 30)).toBe(true);
        expect(results.length).toBe(3);
      });

      it('should filter by $lte (less than or equal) on numeric field', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: { price: { $lte: 30 } },
        });

        // Should return products with price <= 30 (Product A: 10, Product B: 25, Product E: 15, Product G: 30)
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => (r.metadata?.price as number) <= 30)).toBe(true);
        expect(results.length).toBe(4);
      });

      it('should filter by range using both $gte and $lte', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: { price: { $gte: 20, $lte: 80 } },
        });

        // Should return products with 20 <= price <= 80 (Product B: 25, Product C: 50, Product G: 30, Product F: 75)
        expect(results.length).toBeGreaterThan(0);
        expect(
          results.every(r => {
            const price = r.metadata?.price as number;
            return price >= 20 && price <= 80;
          }),
        ).toBe(true);
        expect(results.length).toBe(4);
      });

      it('should filter by comparison on rating field', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: { rating: { $gte: 4.5 } },
        });

        // Should return products with rating >= 4.5 (Product A: 4.5, Product C: 4.9, Product F: 4.7, Product H: 5.0)
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => (r.metadata?.rating as number) >= 4.5)).toBe(true);
        expect(results.length).toBe(4);
      });
    });

    describe('Negation Operators', () => {
      it('should filter by $ne (not equal) on string field', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: { category: { $ne: 'electronics' } },
        });

        // Should return products not in electronics category (home: 3, books: 2)
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.metadata?.category !== 'electronics')).toBe(true);
        expect(results.length).toBe(5);
      });

      it('should filter by $ne (not equal) on boolean field', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: { available: { $ne: true } },
        });

        // Should return unavailable products (Product C, Product G)
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.metadata?.available !== true)).toBe(true);
        expect(results.length).toBe(2);
      });

      it('should filter by $ne (not equal) on numeric field', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: { price: { $ne: 50 } },
        });

        // Should return products with price != 50 (all except Product C)
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.metadata?.price !== 50)).toBe(true);
        expect(results.length).toBe(7);
      });

      // $not operator test - only run if store supports it
      if (supportsNotOperator) {
        it('should filter by $not with comparison operator', async () => {
          const results = await config.vector.query({
            indexName: testIndexName,
            queryVector: createUnitVector(0),
            topK: 10,
            filter: { price: { $not: { $gt: 50 } } },
          });

          // Should return products with price <= 50 (Product A, B, C, E, G)
          expect(results.length).toBeGreaterThan(0);
          expect(results.every(r => !((r.metadata?.price as number) > 50))).toBe(true);
          expect(results.length).toBe(5);
        });
      }
    });

    describe('Array Operators', () => {
      it('should filter by $in on string field', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: { category: { $in: ['electronics', 'books'] } },
        });

        // Should return products in electronics or books categories (5 products)
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => ['electronics', 'books'].includes(r.metadata?.category as string))).toBe(true);
        expect(results.length).toBe(5);
      });

      it('should filter by $nin (not in) on string field', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: { category: { $nin: ['electronics', 'books'] } },
        });

        // Should return products not in electronics or books (home: 3 products)
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => !['electronics', 'books'].includes(r.metadata?.category as string))).toBe(true);
        expect(results.length).toBe(3);
      });

      it('should filter by $in on numeric field', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: { price: { $in: [10, 25, 50] } },
        });

        // Should return products with price in [10, 25, 50] (Product A, B, C)
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => [10, 25, 50].includes(r.metadata?.price as number))).toBe(true);
        expect(results.length).toBe(3);
      });

      // Array metadata tests - only run if store supports array values in metadata
      // Stores like Chroma that only support primitive types will skip these
      if (supportsArrayMetadata) {
        it('should filter by $all on array field', async () => {
          const results = await config.vector.query({
            indexName: testIndexName,
            queryVector: createUnitVector(0),
            topK: 10,
            filter: { tags: { $all: ['premium', 'sale'] } },
          });

          // Should return products with both 'premium' AND 'sale' tags (Product C)
          expect(results.length).toBeGreaterThan(0);
          expect(
            results.every(r => {
              const tags = r.metadata?.tags as string[];
              return tags?.includes('premium') && tags?.includes('sale');
            }),
          ).toBe(true);
          expect(results.length).toBe(1);
        });

        it('should filter by single tag using $in on array field', async () => {
          const results = await config.vector.query({
            indexName: testIndexName,
            queryVector: createUnitVector(0),
            topK: 10,
            filter: { tags: { $in: ['luxury'] } },
          });

          // Should return products with 'luxury' tag (Product H)
          expect(results.length).toBeGreaterThan(0);
          expect(
            results.every(r => {
              const tags = r.metadata?.tags as string[];
              return tags?.includes('luxury');
            }),
          ).toBe(true);
          expect(results.length).toBe(1);
        });
      }
    });

    // $exists operator tests - only run if store supports it
    if (supportsExistsOperator) {
      describe('Existence Operator', () => {
        it('should filter by $exists: true to find documents with field', async () => {
          const results = await config.vector.query({
            indexName: testIndexName,
            queryVector: createUnitVector(0),
            topK: 10,
            filter: { description: { $exists: true } },
          });

          // Should return only Product G which has a description field
          expect(results.length).toBeGreaterThan(0);
          expect(results.every(r => r.metadata?.description !== undefined)).toBe(true);
          expect(results.length).toBe(1);
          expect(results[0]?.metadata?.name).toBe('Product G');
        });

        it('should filter by $exists: false to find documents without field', async () => {
          const results = await config.vector.query({
            indexName: testIndexName,
            queryVector: createUnitVector(0),
            topK: 10,
            filter: { description: { $exists: false } },
          });

          // Should return all products except Product G (7 products)
          expect(results.length).toBeGreaterThan(0);
          expect(results.every(r => r.metadata?.description === undefined)).toBe(true);
          expect(results.length).toBe(7);
        });
      });
    }

    // Null value filtering tests - only run if store supports null values
    if (supportsNullValues) {
      describe('Null Handling', () => {
        beforeAll(async () => {
          // Add a vector with null metadata value
          await config.vector.upsert({
            indexName: testIndexName,
            vectors: [createVector(9)],
            metadata: [
              {
                name: 'Product I',
                price: null,
                category: 'test',
                ...(supportsArrayMetadata ? { tags: [] } : {}),
                available: true,
              },
            ],
          });
          await waitForIndexing(testIndexName);
        });

        it('should filter by field equal to null', async () => {
          const results = await config.vector.query({
            indexName: testIndexName,
            queryVector: createUnitVector(0),
            topK: 10,
            filter: { price: { $eq: null } },
          });

          // Should return Product I with null price
          expect(results.length).toBeGreaterThan(0);
          expect(results.every(r => r.metadata?.price === null)).toBe(true);
          expect(results[0]?.metadata?.name).toBe('Product I');
        });

        it('should filter by field not equal to null', async () => {
          const results = await config.vector.query({
            indexName: testIndexName,
            queryVector: createUnitVector(0),
            topK: 10,
            filter: { price: { $ne: null } },
          });

          // Should return all products except Product I (8 products with non-null price)
          expect(results.length).toBeGreaterThan(0);
          expect(results.every(r => r.metadata?.price !== null)).toBe(true);
          expect(results.length).toBe(8);
        });
      });
    }

    // Pattern matching tests - only run if store supports at least one pattern operator
    if (supportsRegex || supportsContains) {
      describe('Pattern Matching', () => {
        // $regex tests - only run if store supports regex
        if (supportsRegex) {
          it('should filter by $regex pattern matching', async () => {
            const results = await config.vector.query({
              indexName: testIndexName,
              queryVector: createUnitVector(0),
              topK: 10,
              filter: { name: { $regex: '^Product [A-C]' } },
            });

            // Should return Product A, B, C
            expect(results.length).toBeGreaterThan(0);
            expect(results.every(r => /^Product [A-C]/.test(r.metadata?.name as string))).toBe(true);
            expect(results.length).toBe(3);
          });

          it('should filter by $regex case-insensitive pattern', async () => {
            const results = await config.vector.query({
              indexName: testIndexName,
              queryVector: createUnitVector(0),
              topK: 10,
              filter: { category: { $regex: '(?i)ELECTRONICS' } },
            });

            // Should return electronics products
            expect(results.length).toBeGreaterThan(0);
            expect(results.every(r => (r.metadata?.category as string).toLowerCase() === 'electronics')).toBe(true);
          });
        }

        // $contains tests - only run if store supports substring matching
        if (supportsContains) {
          it('should filter by $contains substring matching', async () => {
            const results = await config.vector.query({
              indexName: testIndexName,
              queryVector: createUnitVector(0),
              topK: 10,
              filter: { description: { $contains: 'novel' } },
            });

            // Should return Product G with description containing "novel"
            expect(results.length).toBeGreaterThan(0);
            expect(results.every(r => (r.metadata?.description as string)?.includes('novel'))).toBe(true);
          });
        }
      });
    }

    describe('Combined Filters', () => {
      it('should combine multiple comparison operators', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: {
            price: { $gte: 20, $lte: 100 },
            rating: { $gte: 4.0 },
          },
        });

        // Should return products with 20 <= price <= 100 AND rating >= 4.0
        expect(results.length).toBeGreaterThan(0);
        expect(
          results.every(r => {
            const price = r.metadata?.price as number;
            const rating = r.metadata?.rating as number;
            return price >= 20 && price <= 100 && rating >= 4.0;
          }),
        ).toBe(true);
      });

      it('should combine $in with comparison operators', async () => {
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createUnitVector(0),
          topK: 10,
          filter: {
            category: { $in: ['electronics', 'home'] },
            price: { $lt: 100 },
          },
        });

        // Should return electronics or home products with price < 100
        expect(results.length).toBeGreaterThan(0);
        expect(
          results.every(r => {
            const category = r.metadata?.category as string;
            const price = r.metadata?.price as number;
            return ['electronics', 'home'].includes(category) && price < 100;
          }),
        ).toBe(true);
      });

      // Only run this test if $exists is supported
      if (supportsExistsOperator) {
        it('should combine $ne with $exists', async () => {
          const results = await config.vector.query({
            indexName: testIndexName,
            queryVector: createUnitVector(0),
            topK: 10,
            filter: {
              category: { $ne: 'books' },
              description: { $exists: false },
            },
          });

          // Should return non-books products without description field
          expect(results.length).toBeGreaterThan(0);
          expect(
            results.every(r => {
              return r.metadata?.category !== 'books' && r.metadata?.description === undefined;
            }),
          ).toBe(true);
        });
      }
    });
  });
}
