// To setup a Qdrant server, run:
// docker run -p 6333:6333 qdrant/qdrant
import { createVectorTestSuite } from '@internal/storage-test-utils';
import type { QueryResult } from '@mastra/core/vector';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';

import type { QdrantVectorFilter } from './filter';
import { QdrantVector } from './index';

const dimension = 3;

describe('QdrantVector', () => {
  let qdrant: QdrantVector;
  const testCollectionName = 'test-collection-' + Date.now();

  describe('Vector Operations', () => {
    beforeAll(async () => {
      qdrant = new QdrantVector({ url: 'http://localhost:6333/', id: 'qdrant-test' });
      await qdrant.createIndex({ indexName: testCollectionName, dimension });
    });

    afterAll(async () => {
      await qdrant.deleteIndex({ indexName: testCollectionName });
    }, 50000);

    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];

    it('should query vectors with metadata filter', async () => {
      await qdrant.upsert({ indexName: testCollectionName, vectors: testVectors, metadata: testMetadata });

      const queryVector = [0.0, 1.0, 0.0];
      const filter: QdrantVectorFilter = {
        label: 'y-axis',
      };

      const results = await qdrant.query({ indexName: testCollectionName, queryVector, topK: 1, filter });

      expect(results).toHaveLength(1);
      expect(results?.[0]?.metadata?.label).toBe('y-axis');
    }, 50000);
  });

  describe('Vector update operations', () => {
    const testVectors = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];

    beforeEach(async () => {
      await qdrant.createIndex({ indexName: testCollectionName, dimension: 3 });
    });

    afterEach(async () => {
      await qdrant.deleteIndex({ indexName: testCollectionName });
    });

    it('should update the vector by id', async () => {
      const ids = await qdrant.upsert({ indexName: testCollectionName, vectors: testVectors });
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

      await qdrant.updateVector({ indexName: testCollectionName, id: idToBeUpdated, update });

      const results: QueryResult[] = await qdrant.query({
        indexName: testCollectionName,
        queryVector: newVector,
        topK: 2,
        includeVector: true,
      });
      console.log(results);
      expect(results[0]?.id).toBe(idToBeUpdated);
      // not matching the vector in results list because, the stored vector is stored in a normalized form inside qdrant
      // expect(results[0]?.vector).toEqual(newVector);
      expect(results[0]?.metadata).toEqual(newMetaData);
    });

    it('should only update the metadata by id', async () => {
      const ids = await qdrant.upsert({ indexName: testCollectionName, vectors: testVectors });
      expect(ids).toHaveLength(3);

      const idToBeUpdated = ids[0];
      const newMetaData = {
        test: 'updates',
      };

      const update = {
        metadata: newMetaData,
      };

      await qdrant.updateVector({ indexName: testCollectionName, id: idToBeUpdated, update });

      const results: QueryResult[] = await qdrant.query({
        indexName: testCollectionName,
        queryVector: testVectors[0],
        topK: 2,
        includeVector: true,
      });
      expect(results[0]?.id).toBe(idToBeUpdated);
      // not matching the vector in results list because, the stored vector is stored in a normalized form inside qdrant
      // expect(results[0]?.vector).toEqual(testVectors[0]);
      expect(results[0]?.metadata).toEqual(newMetaData);
    });

    it('should only update vector embeddings by id', async () => {
      const ids = await qdrant.upsert({ indexName: testCollectionName, vectors: testVectors });
      expect(ids).toHaveLength(3);

      const idToBeUpdated = ids[0];
      const newVector = [4, 4, 4];

      const update = {
        vector: newVector,
      };

      await qdrant.updateVector({ indexName: testCollectionName, id: idToBeUpdated, update });

      const results: QueryResult[] = await qdrant.query({
        indexName: testCollectionName,
        queryVector: newVector,
        topK: 2,
        includeVector: true,
      });
      expect(results[0]?.id).toBe(idToBeUpdated);
      // not matching the vector in results list because, the stored vector is stored in a normalized form inside qdrant
      // expect(results[0]?.vector).toEqual(newVector);
    });

    it('should throw exception when no updates are given', async () => {
      await expect(qdrant.updateVector({ indexName: testCollectionName, id: 'id', update: {} })).rejects.toThrow(
        'No updates provided',
      );
    });

    it('should throw error for non-existent index', async () => {
      const nonExistentIndex = 'non-existent-index';
      await expect(
        qdrant.updateVector({ indexName: nonExistentIndex, id: 'test-id', update: { vector: [1, 2, 3] } }),
      ).rejects.toThrow();
    });

    it('should throw error for invalid vector dimension', async () => {
      const [id] = await qdrant.upsert({
        indexName: testCollectionName,
        vectors: [[1, 2, 3]],
        metadata: [{ test: 'initial' }],
      });

      await expect(
        qdrant.updateVector({ indexName: testCollectionName, id, update: { vector: [1, 2] } }), // Wrong dimension
      ).rejects.toThrow();
    });
  });

  describe('Vector delete operations', () => {
    const testVectors = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];

    beforeEach(async () => {
      await qdrant.createIndex({ indexName: testCollectionName, dimension: 3 });
    });

    afterEach(async () => {
      await qdrant.deleteIndex({ indexName: testCollectionName });
    });

    it('should delete the vector by id', async () => {
      const ids = await qdrant.upsert({ indexName: testCollectionName, vectors: testVectors });
      expect(ids).toHaveLength(3);
      const idToBeDeleted = ids[0];

      await qdrant.deleteVector({ indexName: testCollectionName, id: idToBeDeleted });

      const results: QueryResult[] = await qdrant.query({
        indexName: testCollectionName,
        queryVector: [1.0, 0.0, 0.0],
        topK: 2,
      });

      expect(results).toHaveLength(2);
      expect(results.map(res => res.id)).not.toContain(idToBeDeleted);
    });
  });

  describe('Filter Queries', () => {
    const filterTestMetadata = [
      {
        name: 'item1',
        tags: ['electronics', 'premium'],
        price: 1000,
        inStock: true,
        details: {
          color: 'red',
          sizes: ['S', 'M', 'L'],
          weight: 2.5,
        },
        location: {
          lat: 52.5,
          lon: 13.4,
        },
        stock: {
          quantity: 50,
          locations: [
            { warehouse: 'A', count: 30 },
            { warehouse: 'B', count: 20 },
          ],
        },
        ratings: [4.5, 4.8, 4.2],
      },
      {
        name: 'item2',
        tags: ['electronics', 'basic'],
        price: 500,
        inStock: false,
        details: {
          color: 'blue',
          sizes: ['M', 'L'],
          weight: 1.8,
        },
        location: {
          lat: 48.2,
          lon: 16.3,
        },
        stock: {
          quantity: 0,
          locations: [],
        },
        ratings: [4.0, 3.8],
      },
      {
        name: 'item3',
        tags: ['books', 'bestseller'],
        price: 25,
        inStock: true,
        details: {
          color: 'green',
          sizes: ['standard'],
          weight: 0.5,
        },
        location: {
          lat: 40.7,
          lon: -74.0,
        },
        stock: {
          quantity: 100,
          locations: [
            { warehouse: 'A', count: 50 },
            { warehouse: 'C', count: 50 },
          ],
        },
        ratings: [4.9],
      },
      {
        name: 'item4',
        tags: [],
        price: null,
        inStock: null,
        details: {
          color: null,
          sizes: [],
          weight: null,
        },
        location: null,
        stock: {
          quantity: null,
          locations: null,
        },
        ratings: null,
      },
    ];

    const filterTestVectors = filterTestMetadata.map(() =>
      Array(dimension)
        .fill(null)
        .map(() => Math.random()),
    );

    beforeAll(async () => {
      qdrant = new QdrantVector({ url: 'http://localhost:6333/', id: 'qdrant-test' });
      await qdrant.createIndex({ indexName: testCollectionName, dimension });
      await qdrant.upsert({ indexName: testCollectionName, vectors: filterTestVectors, metadata: filterTestMetadata });
    });

    afterAll(async () => {
      await qdrant.deleteIndex({ indexName: testCollectionName });
    }, 50000);

    describe('Basic Operators', () => {
      it('should handle empty arrays', async () => {
        const filter: QdrantVectorFilter = {
          tags: [],
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        const resultsWithMetadata = results.filter(r => Object.keys(r?.metadata || {}).length > 0);
        expect(resultsWithMetadata).toHaveLength(1);
        expect(resultsWithMetadata[0]?.metadata?.tags).toHaveLength(0);
      });
    });

    describe('Logical Operators', () => {
      it('should handle $not operator', async () => {
        const filter: QdrantVectorFilter = {
          $not: { tags: { $in: ['electronics'] } },
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        const resultsWithMetadata = results.filter(r => Object.keys(r?.metadata || {}).length > 0);
        expect(resultsWithMetadata).toHaveLength(2);
        resultsWithMetadata.forEach(result => {
          expect(result.metadata?.tags).not.toContain('electronics');
        });
      });

      it('should handle empty logical operators', async () => {
        const filter: QdrantVectorFilter = { $and: [] };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('Custom Operators', () => {
      it('should filter using $count operator', async () => {
        const filter: QdrantVectorFilter = { 'stock.locations': { $count: { $gt: 1 } } };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.stock?.locations?.length).toBeGreaterThan(1);
        });
      });

      it('should filter using $geo radius operator', async () => {
        const filter: QdrantVectorFilter = {
          location: {
            $geo: {
              type: 'radius',
              center: { lat: 52.5, lon: 13.4 },
              radius: 10000,
            },
          },
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.location?.lat).toBe(52.5);
        expect(results[0]?.metadata?.location?.lon).toBe(13.4);
      });

      it('should filter using $geo box operator', async () => {
        const filter: QdrantVectorFilter = {
          location: {
            $geo: {
              type: 'box',
              top_left: { lat: 53.0, lon: 13.0 },
              bottom_right: { lat: 52.0, lon: 14.0 },
            },
          },
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.location?.lat).toBe(52.5);
        expect(results[0]?.metadata?.location?.lon).toBe(13.4);
      });

      it('should filter using $geo polygon operator', async () => {
        const filter: QdrantVectorFilter = {
          location: {
            $geo: {
              type: 'polygon',
              exterior: {
                points: [
                  { lat: 53.0, lon: 13.0 },
                  { lat: 53.0, lon: 14.0 },
                  { lat: 52.0, lon: 14.0 },
                  { lat: 52.0, lon: 13.0 },
                  { lat: 53.0, lon: 13.0 }, // Close the polygon by repeating first point
                ],
              },
            },
          },
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.location?.lat).toBe(52.5);
        expect(results[0]?.metadata?.location?.lon).toBe(13.4);
      });

      it('should filter using $hasId operator', async () => {
        // First get some IDs from a regular query
        const allResults = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], topK: 2 });
        const targetIds = allResults.map(r => r.id);

        const filter: QdrantVectorFilter = { $hasId: targetIds };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(targetIds).toContain(result.id);
        });
      });

      it('should filter using $hasVector operator', async () => {
        const filter: QdrantVectorFilter = { $hasVector: '' };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should filter using $datetime operator', async () => {
        // First upsert a record with a datetime
        const now = new Date();
        const vector = Array(dimension)
          .fill(null)
          .map(() => Math.random());
        const metadata = {
          created_at: now.toISOString(),
        };
        await qdrant.upsert({ indexName: testCollectionName, vectors: [vector], metadata: [metadata] });

        const filter: QdrantVectorFilter = {
          created_at: {
            $datetime: {
              range: {
                gt: new Date(now.getTime() - 1000), // 1 second before
                lt: new Date(now.getTime() + 1000), // 1 second after
              },
            },
          },
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(new Date(result.metadata?.created_at).getTime()).toBeGreaterThan(now.getTime() - 1000);
          expect(new Date(result.metadata?.created_at).getTime()).toBeLessThan(now.getTime() + 1000);
        });
      });
    });

    describe('Special Cases', () => {
      it('handles regex patterns in queries', async () => {
        const results = await qdrant.query({
          indexName: testCollectionName,
          queryVector: [1, 0, 0],
          filter: { name: { $regex: 'item' } },
        });
        expect(results.length).toBe(4);
      });

      it('handles array operators in queries', async () => {
        const results = await qdrant.query({
          indexName: testCollectionName,
          queryVector: [1, 0, 0],
          filter: { tags: { $in: ['electronics', 'books'] } },
        });
        expect(results.length).toBe(3);
      });

      it('handles nested array queries', async () => {
        const results = await qdrant.query({
          indexName: testCollectionName,
          queryVector: [1, 0, 0],
          filter: { 'stock.locations[]': { $nested: { warehouse: 'A', count: { $gt: 20 } } } },
        });
        expect(results.length).toBe(2);
      });

      it('handles collection-wide operators', async () => {
        // First get some actual IDs from our collection
        const searchResults = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], topK: 2 });
        const ids = searchResults.map(r => r.id);

        const results = await qdrant.query({
          indexName: testCollectionName,
          queryVector: [1, 0, 0],
          filter: { $hasId: ids, $hasVector: '' },
        });
        expect(results.length).toBe(2);
      });

      it('should handle complex combinations with custom operators', async () => {
        const filter: QdrantVectorFilter = {
          $and: [
            { 'stock.locations': { $count: { $gt: 0 } } },
            {
              $or: [
                {
                  location: {
                    $geo: {
                      type: 'radius',
                      center: { lat: 52.5, lon: 13.4 },
                      radius: 10000,
                    },
                  },
                },
                { tags: { $in: ['bestseller'] } },
              ],
            },
          ],
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const metadata = result.metadata || {};
          expect(metadata.stock?.locations?.length).toBeGreaterThan(0);
          const location = metadata.location;
          const isNearLocation = location?.lat === 52.5 && location?.lon === 13.4;
          const isBestseller = metadata.tags?.includes('bestseller');
          expect(isNearLocation || isBestseller).toBe(true);
        });
      });
    });

    describe('Performance Cases', () => {
      it('should handle deep nesting efficiently', async () => {
        const start = Date.now();
        const filter: QdrantVectorFilter = {
          $and: Array(5)
            .fill(null)
            .map(() => ({
              $or: [{ 'details.weight': { $lt: 2.0 } }, { 'stock.quantity': { $gt: 0 } }],
            })),
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(1000); // Should complete within 1 second
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle multiple concurrent filtered queries', async () => {
        const filters: QdrantVectorFilter[] = [
          { price: { $gt: 500 } },
          { tags: { $in: ['electronics'] } },
          { 'stock.quantity': { $gt: 0 } },
        ];
        const start = Date.now();
        const results = await Promise.all(
          filters.map(filter => qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter })),
        );
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
        results.forEach(result => {
          expect(result.length).toBeGreaterThan(0);
        });
      });
    });
  });
  describe('Error Handling', () => {
    const testIndexName = 'test_index_error';
    beforeAll(async () => {
      await qdrant.createIndex({ indexName: testIndexName, dimension: 3 });
    });

    afterAll(async () => {
      await qdrant.deleteIndex({ indexName: testIndexName });
    });

    it('should handle mismatched metadata and vectors length', async () => {
      const vectors = [[1, 2, 3]];
      const metadata = [{}, {}];
      await expect(qdrant.upsert({ indexName: testCollectionName, vectors, metadata })).rejects.toThrow();
    });

    it('should handle duplicate index creation gracefully', async () => {
      const duplicateIndexName = `duplicate_test`;
      const dimension = 768;
      const infoSpy = vi.spyOn(qdrant['logger'], 'info');
      const warnSpy = vi.spyOn(qdrant['logger'], 'warn');
      try {
        // Create index first time
        await qdrant.createIndex({
          indexName: duplicateIndexName,
          dimension,
          metric: 'cosine',
        });

        // Try to create with same dimensions - should not throw
        await expect(
          qdrant.createIndex({
            indexName: duplicateIndexName,
            dimension,
            metric: 'cosine',
          }),
        ).resolves.not.toThrow();

        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('already exists with'));

        // Try to create with same dimensions and different metric - should not throw
        await expect(
          qdrant.createIndex({
            indexName: duplicateIndexName,
            dimension,
            metric: 'euclidean',
          }),
        ).resolves.not.toThrow();

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Attempted to create index with metric'));

        // Try to create with different dimensions - should throw
        await expect(
          qdrant.createIndex({
            indexName: duplicateIndexName,
            dimension: dimension + 1,
            metric: 'cosine',
          }),
        ).rejects.toThrow(
          `Index "${duplicateIndexName}" already exists with ${dimension} dimensions, but ${dimension + 1} dimensions were requested`,
        );
      } finally {
        infoSpy.mockRestore();
        warnSpy.mockRestore();
        // Cleanup
        await qdrant.deleteIndex({ indexName: duplicateIndexName });
      }
    });
  });
});

// Shared vector store test suite
const qdrantVector = new QdrantVector({ url: 'http://localhost:6333/', id: 'qdrant-shared-test' });

createVectorTestSuite({
  vector: qdrantVector,
  createIndex: async (indexName, options) => {
    await qdrantVector.createIndex({ indexName, dimension: 1536, metric: options?.metric });
  },
  deleteIndex: async (indexName: string) => {
    await qdrantVector.deleteIndex({ indexName });
  },
  waitForIndexing: async () => {
    // Qdrant indexes immediately
    await new Promise(resolve => setTimeout(resolve, 100));
  },
  supportsRegex: false,
  supportsContains: false,
  supportsNorOperator: false,
  supportsElemMatch: false,
  supportsSize: false,
  supportsEmptyLogicalOperators: false,
  // Qdrant doesn't support advanced $not patterns like field-level $not or mixed root operators
  supportsAdvancedNotSyntax: false,
});
