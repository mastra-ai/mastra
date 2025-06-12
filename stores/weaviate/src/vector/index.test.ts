import type { QueryResult } from '@mastra/core';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import { generateUuid5 } from 'weaviate-client';
import { WeaviateVector } from './index';

const unsetDim = -1;
// weaviate doesn't require dimension to be set explicitly, it is inferred by the first object inserted
// if no objects have been inserted yet then `describeIndex` returns -1 for the dimension prop
const dimension = 3;

describe('WeaviateVector', () => {
  let weaviate: WeaviateVector;
  const testCollectionName = 'TestCollection_' + Date.now();

  describe('Simple Index Operations', () => {
    beforeAll(async () => {
      weaviate = await WeaviateVector.use();
      await weaviate.createIndex({ indexName: testCollectionName, dimension });
    });

    afterAll(async () => {
      await weaviate.deleteIndex({ indexName: testCollectionName });
    }, 50000);

    it('should list collections including ours', async () => {
      const indexes = await weaviate.listIndexes();
      expect(indexes).toContain(testCollectionName);
    }, 50000);

    it('should describe index with correct properties', async () => {
      const stats = await weaviate.describeIndex({ indexName: testCollectionName });
      expect(stats.dimension).toBe(unsetDim);
      expect(stats.metric).toBe('cosine');
      expect(typeof stats.count).toBe('number');
    }, 50000);
  });

  describe('Weaviate-specific index Operations', () => {
    beforeAll(async () => {
      weaviate = await WeaviateVector.use();
      await weaviate.createIndex({ indexName: testCollectionName, dimension, metric: 'cosine' });
      const vectors = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      await weaviate.upsert({ indexName: testCollectionName, vectors });
    });

    afterAll(async () => {
      await weaviate.deleteIndex({ indexName: testCollectionName });
    }, 50000);

    it('should return dimensions after inserting vectors', async () => {
      const stats = await weaviate.describeIndex({ indexName: testCollectionName });
      expect(stats.dimension).toBe(dimension);
    }, 50000);

    it('should return score greater than 0 for dotproduct metric', async () => {
      const queryVector = [1, 2, 3];
      const results: QueryResult[] = await weaviate.query({ indexName: testCollectionName, queryVector, topK: 1 });
      expect(results[0]?.score).toBeGreaterThan(0);
    }, 50000);
  });

  describe('Vector Operations', () => {
    beforeAll(async () => {
      weaviate = await WeaviateVector.use();
      await weaviate.createIndex({
        indexName: testCollectionName,
        dimension,
      });
    });

    afterAll(async () => {
      await weaviate.deleteIndex({ indexName: testCollectionName });
    }, 50000);

    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    const testMetadata = [{ label: 'x' }, { label: 'y' }, { label: 'z' }];
    let vectorIds: string[];

    it('should upsert vectors with metadata', async () => {
      vectorIds = await weaviate.upsert({
        indexName: testCollectionName,
        vectors: testVectors,
        metadata: testMetadata,
      });
      expect(vectorIds).toHaveLength(3);
    }, 50000);

    it('should query vectors and return nearest neighbors', async () => {
      const queryVector = [1.0, 0.1, 0.1];
      const results = await weaviate.query({ indexName: testCollectionName, queryVector, topK: 3 });

      expect(results).toHaveLength(3);
      expect(results?.[0]?.score).toBeGreaterThan(0);
      expect(results?.[0]?.metadata).toBeDefined();
    }, 50000);

    it('should query vectors and return vector in results', async () => {
      const queryVector = [1.0, 0.1, 0.1];
      const results = await weaviate.query({
        indexName: testCollectionName,
        queryVector,
        topK: 3,
        includeVector: true,
      });

      expect(results).toHaveLength(3);
      expect(results?.[0]?.vector).toBeDefined();
      expect(results?.[0]?.vector).toHaveLength(dimension);
    });

    it('should query vectors with metadata filter', async () => {
      const queryVector = [0.0, 1.0, 0.0];
      const filter = {
        label: 'y',
      };

      const results = await weaviate.query({ indexName: testCollectionName, queryVector, topK: 1, filter });

      expect(results).toHaveLength(1);
      expect(results?.[0]?.metadata?.label).toBe('y');
    }, 50000);
  });

  describe('Vector update operations', () => {
    const testVectors = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];

    beforeEach(async () => {
      await weaviate.createIndex({ indexName: testCollectionName, dimension });
    });

    afterEach(async () => {
      await weaviate.deleteIndex({ indexName: testCollectionName });
    });

    it('should update the vector by id', async () => {
      const ids = await weaviate.upsert({ indexName: testCollectionName, vectors: testVectors });
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

      await weaviate.updateVector({ indexName: testCollectionName, id: idToBeUpdated, update });

      const results = await weaviate.query({
        indexName: testCollectionName,
        queryVector: newVector,
        topK: 2,
        includeVector: true,
      });

      expect(results[0]?.id).toBe(idToBeUpdated);
      expect(results[0]?.vector).toEqual(newVector);
      expect(results[0]?.metadata).toEqual(newMetaData);
    });

    it('should only update the metadata by id', async () => {
      const ids = await weaviate.upsert({ indexName: testCollectionName, vectors: testVectors });
      expect(ids).toHaveLength(3);

      const idToBeUpdated = ids[0];
      const newMetaData = {
        test: 'updates',
      };

      const update = {
        metadata: newMetaData,
      };

      await weaviate.updateVector({ indexName: testCollectionName, id: idToBeUpdated, update });

      const results = await weaviate.query({
        indexName: testCollectionName,
        queryVector: testVectors[0],
        topK: 2,
        includeVector: true,
      });
      expect(results[0]?.id).toBe(idToBeUpdated);
      expect(results[0]?.vector).toEqual(testVectors[0]);
      expect(results[0]?.metadata).toEqual(newMetaData);
    });

    it('should only update vector embeddings by id', async () => {
      const ids = await weaviate.upsert({ indexName: testCollectionName, vectors: testVectors });
      expect(ids).toHaveLength(3);

      const idToBeUpdated = ids[0];
      const newVector = [1, 2, 3];

      const update = {
        vector: newVector,
      };

      await weaviate.updateVector({ indexName: testCollectionName, id: idToBeUpdated, update });

      const results = await weaviate.query({
        indexName: testCollectionName,
        queryVector: newVector,
        topK: 2,
        includeVector: true,
      });
      expect(results[0]?.id).toBe(idToBeUpdated);
      expect(results[0]?.vector).toEqual(newVector);
    });

    it('should throw exception when no updates are given', () => {
      expect(weaviate.updateVector({ indexName: testCollectionName, id: 'id', update: {} })).rejects.toThrow(
        'No updates provided',
      );
    });

    it('should throw error for non-existent index', async () => {
      const nonExistentIndex = 'non-existent-index';
      await expect(
        weaviate.updateVector({
          indexName: nonExistentIndex,
          id: generateUuid5('test-id'),
          update: { vector: [1, 2, 3] },
        }),
      ).rejects.toThrow();
    });

    it('should throw error for invalid vector dimension', async () => {
      const [id] = await weaviate.upsert({
        indexName: testCollectionName,
        vectors: [[1, 2, 3]],
        metadata: [{ test: 'initial' }],
      });

      await expect(
        weaviate.updateVector({ indexName: testCollectionName, id, update: { vector: [1, 2] } }), // Wrong dimension
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
      await weaviate.createIndex({ indexName: testCollectionName, dimension });
    });

    afterEach(async () => {
      await weaviate.deleteIndex({ indexName: testCollectionName });
    });

    it('should delete the vector by id', async () => {
      const ids = await weaviate.upsert({ indexName: testCollectionName, vectors: testVectors });
      expect(ids).toHaveLength(3);
      const idToBeDeleted = ids[0];

      await weaviate.deleteVector({ indexName: testCollectionName, id: idToBeDeleted });

      const results = await weaviate.query({
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
    const filterTestVectors = Array(filterTestMetadata.length)
      .fill(null)
      .map(() =>
        Array(dimension)
          .fill(null)
          .map(() => Math.random()),
      );

    beforeAll(async () => {
      weaviate = await WeaviateVector.use();
      await weaviate.createIndex({ indexName: testCollectionName, dimension });
      await weaviate.upsert({
        indexName: testCollectionName,
        vectors: filterTestVectors,
        metadata: filterTestMetadata,
      });
    });

    afterAll(async () => {
      await weaviate.deleteIndex({ indexName: testCollectionName });
    }, 50000);

    describe('Basic Operators', () => {
      it('should filter by exact value match', async () => {
        const filter = { name: 'item1' };
        const results = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.name).toBe('item1');
      });

      it('should filter using comparison operators', async () => {
        const filter = { price: { $gt: 100, $lt: 600 } };
        const results = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.price).toBe(500);
      });

      it('should filter using array operators', async () => {
        const filter = { tags: { $in: ['premium', 'bestseller'] } };
        const results = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(2);
        const tags = results.flatMap(r => r.metadata?.tags || []);
        expect(tags).toContain('bestseller');
        expect(tags).toContain('premium');
      });

      it('should handle null values', async () => {
        const filter = { price: null };
        const results = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.price).toBeUndefined();
      });

      it('should handle empty arrays', async () => {
        const filter = {
          tags: [],
        };
        const results = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        const resultsWithMetadata = results.filter(r => Object.keys(r?.metadata || {}).length > 0);
        expect(resultsWithMetadata).toHaveLength(1);
        expect(resultsWithMetadata[0]?.metadata?.tags).toHaveLength(0);
      });
    });

    describe('Logical Operators', () => {
      it('should combine conditions with $and', async () => {
        const filter = {
          $and: [{ tags: { $in: ['electronics'] } }, { price: { $gt: 700 } }],
        };
        const results = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.price).toBeGreaterThan(700);
        expect(results[0]?.metadata?.tags).toContain('electronics');
      });

      it('should combine conditions with $or', async () => {
        const filter = {
          $or: [{ price: { $gt: 900 } }, { tags: { $in: ['bestseller'] } }],
        };
        const results = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price > 900 || result.metadata?.tags?.includes('bestseller')).toBe(true);
        });
      });

      it('should handle empty logical operators', async () => {
        const filter = { $and: [] };
        const results = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('Custom Operators', () => {
      it('should filter using $length operator', async () => {
        const filter = { tags: { $length: { $gt: 0 } } };
        const results = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(result.metadata?.tags?.length).toEqual(2);
        });
      });

      // bug in weaviate?
      // it('should filter using $geo radius operator', async () => {
      //   const filter = {
      //     location: {
      //       $geo: {
      //         lat: 52.5,
      //         lon: 13.4,
      //         radius: 10000,
      //       },
      //     },
      //   };
      //   const results = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
      //   expect(results).toHaveLength(1);
      //   expect(results[0]?.metadata?.location?.lat).toBe(52.5);
      //   expect(results[0]?.metadata?.location?.lon).toBe(13.4);
      // });
    });

    describe('Special Cases', () => {
      // bug in weaviate?
      // it('handles regex patterns in queries', async () => {
      //   const results = await weaviate.query({
      //     indexName: testCollectionName,
      //     queryVector: [1, 0, 0],
      //     filter: { name: { $regex: 'item' } },
      //   });
      //   expect(results.length).toBe(4);
      // });

      it('handles array operators in queries', async () => {
        const results = await weaviate.query({
          indexName: testCollectionName,
          queryVector: [1, 0, 0],
          filter: { tags: { $in: ['electronics', 'books'] } },
        });
        expect(results.length).toBe(3);
      });

      it('should handle multiple conditions on same field', async () => {
        const filter = {
          price: { $gt: 20, $lt: 30 },
        };
        const results = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.price).toBe(25);
      });
    });

    describe('Performance Cases', () => {
      it('should handle multiple concurrent filtered queries', async () => {
        const filters = [{ price: { $gt: 500 } }, { tags: { $in: ['electronics'] } }, { inStock: { $eq: true } }];
        const start = Date.now();
        const results = await Promise.all(
          filters.map(filter => weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter })),
        );
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(1000); // Should complete within 1 seconds
        results.forEach(result => {
          expect(result.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Error Handling', async () => {
    const weaviate = await WeaviateVector.use();
    it('should handle querying non-existent index gracefully', async () => {
      const nonExistentIndex = 'NoneExistentIndex';
      await expect(weaviate.query({ indexName: nonExistentIndex, queryVector: [1, 0, 0] })).rejects.toThrow();
    }, 50000);

    it('should handle inserting incorrect dimension vectors', async () => {
      await weaviate.createIndex({ indexName: testCollectionName, dimension });
      await weaviate.upsert({ indexName: testCollectionName, vectors: [[1, 0, 0]] });
      await expect(weaviate.upsert({ indexName: testCollectionName, vectors: [[1, 0]] })).rejects.toThrow();
      await weaviate.deleteIndex({ indexName: testCollectionName });
    }, 50000);
  });

  describe('Empty/Undefined Filters', () => {
    const filterTestVectors = Array(10)
      .fill(null)
      .map(() =>
        Array(dimension)
          .fill(null)
          .map(() => Math.random()),
      );

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
    ];

    beforeAll(async () => {
      weaviate = await WeaviateVector.use();
      await weaviate.createIndex({ indexName: testCollectionName, dimension });
      await weaviate.upsert({
        indexName: testCollectionName,
        vectors: filterTestVectors,
        metadata: filterTestMetadata,
      });
    });

    afterAll(async () => {
      await weaviate.deleteIndex({ indexName: testCollectionName });
    }, 50000);

    it('should handle undefined filter', async () => {
      const results1 = await weaviate.query({
        indexName: testCollectionName,
        queryVector: [1, 0, 0],
        filter: undefined,
      });
      const results2 = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0] });
      expect(results1).toEqual(results2);
      expect(results1.length).toBeGreaterThan(0);
    });

    it('should handle empty object filter', async () => {
      const results = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter: {} });
      const results2 = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0] });
      expect(results).toEqual(results2);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle null filter', async () => {
      const results = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter: null });
      const results2 = await weaviate.query({ indexName: testCollectionName, queryVector: [1, 0, 0] });
      expect(results).toEqual(results2);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    beforeAll(async () => {
      weaviate = await WeaviateVector.use();
      await weaviate.createIndex({ indexName: testCollectionName, dimension });
    });

    afterAll(async () => {
      await weaviate.deleteIndex({ indexName: testCollectionName });
    }, 50000);

    it('should handle batch upsert of 1000 vectors', async () => {
      const batchSize = 1000;
      const vectors = Array(batchSize)
        .fill(null)
        .map(() =>
          Array(dimension)
            .fill(null)
            .map(() => Math.random()),
        );
      const metadata = vectors.map((_, i) => ({ id_: i }));

      const start = Date.now();
      const ids = await weaviate.upsert({ indexName: testCollectionName, vectors, metadata });
      const duration = Date.now() - start;

      expect(ids).toHaveLength(batchSize);
      console.log(`Batch upsert of ${batchSize} vectors took ${duration}ms`);
    }, 300000);

    it('should perform multiple concurrent queries', async () => {
      const queryVector = [1, 0, 0];
      const numQueries = 10;

      const start = Date.now();
      const promises = Array(numQueries)
        .fill(null)
        .map(() => weaviate.query({ indexName: testCollectionName, queryVector }));

      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      expect(results).toHaveLength(numQueries);
      console.log(`${numQueries} concurrent queries took ${duration}ms`);
    }, 50000);
  });
});
