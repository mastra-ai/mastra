import type { QueryResult } from '@mastra/core/vector';
import dotenv from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest';

import { PineconeVector } from './';

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;

// if (!PINECONE_API_KEY) {
//   throw new Error('Please set PINECONE_API_KEY and PINECONE_ENVIRONMENT in .env file');
// }
// TODO: skip until we the secrets on Github

vi.setConfig({ testTimeout: 80_000, hookTimeout: 80_000 });

// Helper function to create sparse vectors for testing
function createSparseVector(text: string) {
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  const uniqueWords = Array.from(new Set(words));
  const indices: number[] = [];
  const values: number[] = [];

  // Create a simple term frequency vector
  uniqueWords.forEach((word, i) => {
    const frequency = words.filter(w => w === word).length;
    indices.push(i);
    values.push(frequency);
  });

  return { indices, values };
}

function waitUntilReady(vectorDB: PineconeVector, indexName: string) {
  return new Promise(resolve => {
    const interval = setInterval(async () => {
      try {
        const stats = await vectorDB.describeIndex(indexName);
        if (!!stats) {
          clearInterval(interval);
          resolve(true);
        }
      } catch (error) {
        console.log(error);
      }
    }, 5000);
  });
}

function waitUntilIndexDeleted(vectorDB: PineconeVector, indexName: string) {
  return new Promise((resolve, reject) => {
    const maxAttempts = 60;
    let attempts = 0;

    const interval = setInterval(async () => {
      try {
        const indexes = await vectorDB.listIndexes();
        if (!indexes.includes(indexName)) {
          clearInterval(interval);
          resolve(true);
        }
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Timeout waiting for index to be deleted'));
        }
      } catch (error) {
        console.log(error);
      }
    }, 5000);
  });
}

function waitUntilVectorsIndexed(
  vectorDB: PineconeVector,
  indexName: string,
  expectedCount: number,
  exactCount = false,
) {
  return new Promise((resolve, reject) => {
    const maxAttempts = 60;
    let attempts = 0;
    let lastCount = 0;
    let stableCount = 0;

    const interval = setInterval(async () => {
      try {
        const stats = await vectorDB.describeIndex(indexName);
        const check = exactCount ? stats?.count === expectedCount : stats?.count >= expectedCount;
        if (stats && check) {
          if (stats.count === lastCount) {
            stableCount++;
            if (stableCount >= 2) {
              clearInterval(interval);
              resolve(true);
            }
          } else {
            stableCount = 1;
          }
          lastCount = stats.count;
        }
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Timeout waiting for vectors to be indexed'));
        }
      } catch (error) {
        console.log(error);
      }
    }, 10000);
  });
}
// TODO: our pinecone account is over the limit, tests don't work in CI
describe.skip('PineconeVector Integration Tests', () => {
  let vectorDB: PineconeVector;
  const testIndexName = 'test-index'; // Unique index name for each test run
  const indexNameUpdate = 'test-index-update';
  const indexNameDelete = 'test-index-delete';
  const indexNameNamespace = 'test-index-namespace';
  const indexNameHybrid = 'test-index-hybrid';
  const dimension = 3;

  beforeAll(async () => {
    vectorDB = new PineconeVector(PINECONE_API_KEY);
    // Delete test index
    try {
      await vectorDB.deleteIndex(testIndexName);
      await waitUntilIndexDeleted(vectorDB, testIndexName);
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex(indexNameUpdate);
      await waitUntilIndexDeleted(vectorDB, indexNameUpdate);
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex(indexNameDelete);
      await waitUntilIndexDeleted(vectorDB, indexNameDelete);
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex(indexNameNamespace);
      await waitUntilIndexDeleted(vectorDB, indexNameNamespace);
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex(indexNameHybrid);
      await waitUntilIndexDeleted(vectorDB, indexNameHybrid);
    } catch {
      // Ignore errors if index doesn't exist
    }
    // Create test index
    await vectorDB.createIndex({ indexName: testIndexName, dimension });
    await waitUntilReady(vectorDB, testIndexName);
  }, 500000);

  afterAll(async () => {
    // Cleanup: delete test index
    try {
      await vectorDB.deleteIndex(testIndexName);
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex(indexNameUpdate);
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex(indexNameDelete);
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex(indexNameNamespace);
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await vectorDB.deleteIndex(indexNameHybrid);
    } catch {
      // Ignore errors if index doesn't exist
    }
  }, 500000);

  describe('Index Operations', () => {
    it('should list indexes including our test index', async () => {
      const indexes = await vectorDB.listIndexes();
      expect(indexes).toContain(testIndexName);
    }, 500000);

    it('should describe index with correct properties', async () => {
      const stats = await vectorDB.describeIndex(testIndexName);
      expect(stats.dimension).toBe(dimension);
      expect(stats.metric).toBe('cosine');
      expect(typeof stats.count).toBe('number');
    }, 500000);
  });

  describe('Vector Operations', () => {
    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];
    let vectorIds: string[];

    it('should upsert vectors with metadata', async () => {
      vectorIds = await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata });
      expect(vectorIds).toHaveLength(3);
      // Wait for vectors to be indexed
      await waitUntilVectorsIndexed(vectorDB, testIndexName, 3);
    }, 500000);

    it.skip('should query vectors and return nearest neighbors', async () => {
      const queryVector = [1.0, 0.1, 0.1];
      const results = await vectorDB.query({ indexName: testIndexName, queryVector, topK: 3 });

      expect(results).toHaveLength(3);
      expect(results[0]!.score).toBeGreaterThan(0);
      expect(results[0]!.metadata).toBeDefined();
    }, 500000);

    it('should query vectors with metadata filter', async () => {
      const queryVector = [0.0, 1.0, 0.0];
      const filter = { label: 'y-axis' };

      const results = await vectorDB.query({ indexName: testIndexName, queryVector, topK: 1, filter });

      expect(results).toHaveLength(1);
      expect(results?.[0]?.metadata?.label).toBe('y-axis');
    }, 500000);

    it('should query vectors and return vectors in results', async () => {
      const queryVector = [0.0, 1.0, 0.0];
      const results = await vectorDB.query({ indexName: testIndexName, queryVector, topK: 1, includeVector: true });

      expect(results).toHaveLength(1);
      expect(results?.[0]?.vector).toBeDefined();
      expect(results?.[0]?.vector).toHaveLength(dimension);
    }, 500000);

    describe('vector update operations', () => {
      const testVectors = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];

      beforeEach(async () => {
        await vectorDB.createIndex({ indexName: indexNameUpdate, dimension, metric: 'cosine' });
        await waitUntilReady(vectorDB, indexNameUpdate);
      });

      afterEach(async () => {
        try {
          await vectorDB.deleteIndex(indexNameUpdate);
          await waitUntilIndexDeleted(vectorDB, indexNameUpdate);
        } catch {
          // Ignore errors if index doesn't exist
        }
      });

      it('should update the vector by id', async () => {
        const ids = await vectorDB.upsert({ indexName: indexNameUpdate, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newVector = [1, 2, 4];
        const newMetaData = {
          test: 'updates',
        };

        const update = {
          vector: newVector,
          metadata: newMetaData,
        };

        await vectorDB.updateIndexById(indexNameUpdate, idToBeUpdated, update);

        await waitUntilVectorsIndexed(vectorDB, indexNameUpdate, 3);

        const results: QueryResult[] = await vectorDB.query({
          indexName: indexNameUpdate,
          queryVector: newVector,
          topK: 10,
          includeVector: true,
        });

        expect(results[0]?.id).toBe(idToBeUpdated);
        expect(results[0]?.vector).toEqual(newVector);
        expect(results[0]?.metadata).toEqual(newMetaData);
      }, 500000);

      it('should only update the metadata by id', async () => {
        const ids = await vectorDB.upsert({ indexName: indexNameUpdate, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newMetaData = {
          test: 'updates',
        };

        const update = {
          metadata: newMetaData,
        };

        await vectorDB.updateIndexById(indexNameUpdate, idToBeUpdated, update);

        await waitUntilVectorsIndexed(vectorDB, indexNameUpdate, 3);

        const results: QueryResult[] = await vectorDB.query({
          indexName: indexNameUpdate,
          queryVector: testVectors[0],
          topK: 2,
          includeVector: true,
        });

        expect(results[0]?.id).toBe(idToBeUpdated);
        expect(results[0]?.vector).toEqual(testVectors[0]);
        expect(results[0]?.metadata).toEqual(newMetaData);
      }, 500000);

      it('should only update vector embeddings by id', async () => {
        const ids = await vectorDB.upsert({ indexName: indexNameUpdate, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newVector = [4, 4, 4];

        const update = {
          vector: newVector,
        };

        await vectorDB.updateIndexById(indexNameUpdate, idToBeUpdated, update);

        await waitUntilVectorsIndexed(vectorDB, indexNameUpdate, 3);

        const results: QueryResult[] = await vectorDB.query({
          indexName: indexNameUpdate,
          queryVector: newVector,
          topK: 10,
          includeVector: true,
        });

        const updatedResult = results.find(r => r.id === idToBeUpdated);
        expect(updatedResult).toBeDefined();
        expect(updatedResult?.vector).toEqual(newVector);
      }, 500000);

      it('should throw exception when no updates are given', async () => {
        await expect(vectorDB.updateIndexById(indexNameUpdate, 'id', {})).rejects.toThrow('No updates provided');
      });

      it('should throw error for non-existent index', async () => {
        const nonExistentIndex = 'non-existent-index';
        await expect(vectorDB.updateIndexById(nonExistentIndex, 'test-id', { vector: [1, 2, 3] })).rejects.toThrow();
      });

      it('should throw error for invalid vector dimension', async () => {
        const [id] = await vectorDB.upsert({
          indexName: indexNameUpdate,
          vectors: [[1, 2, 3]],
          metadata: [{ test: 'initial' }],
        });

        await expect(
          vectorDB.updateIndexById(indexNameUpdate, id, { vector: [1, 2] }), // Wrong dimension
        ).rejects.toThrow();
      }, 500000);
    });

    describe('vector delete operations', () => {
      const testVectors = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];

      beforeEach(async () => {
        await vectorDB.createIndex({ indexName: indexNameDelete, dimension, metric: 'cosine' });
        await waitUntilReady(vectorDB, indexNameDelete);
      });

      afterEach(async () => {
        try {
          await vectorDB.deleteIndex(indexNameDelete);
          await waitUntilIndexDeleted(vectorDB, indexNameDelete);
        } catch {
          // Ignore errors if index doesn't exist
        }
      });

      it('should delete the vector by id', async () => {
        const ids = await vectorDB.upsert({ indexName: indexNameDelete, vectors: testVectors });
        expect(ids).toHaveLength(3);
        const idToBeDeleted = ids[0];

        await vectorDB.deleteIndexById(indexNameDelete, idToBeDeleted);
        await waitUntilVectorsIndexed(vectorDB, indexNameDelete, 2, true);

        // Query all vectors similar to the deleted one
        const results: QueryResult[] = await vectorDB.query({
          indexName: indexNameDelete,
          queryVector: testVectors[0],
          topK: 3,
          includeVector: true,
        });

        const resultIds = results.map(r => r.id);
        expect(resultIds).not.toContain(idToBeDeleted);
      }, 500000);
    });
  });

  describe('Namespace Operations', () => {
    const namespace1 = 'test-namespace-1';
    const namespace2 = 'test-namespace-2';
    const testVector = [1.0, 0.0, 0.0];
    const testMetadata = { label: 'test' };

    beforeEach(async () => {
      await vectorDB.createIndex({ indexName: indexNameNamespace, dimension, metric: 'cosine' });
      await waitUntilReady(vectorDB, indexNameNamespace);
    });

    afterEach(async () => {
      try {
        await vectorDB.deleteIndex(indexNameNamespace);
        await waitUntilIndexDeleted(vectorDB, indexNameNamespace);
      } catch {
        // Ignore errors if index doesn't exist
      }
    });

    it('should isolate vectors in different namespaces', async () => {
      // Insert same vector in two namespaces
      const [id1] = await vectorDB.upsert({
        indexName: indexNameNamespace,
        vectors: [testVector],
        metadata: [testMetadata],
        namespace: namespace1,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 1);

      const [id2] = await vectorDB.upsert({
        indexName: indexNameNamespace,
        vectors: [testVector],
        metadata: [{ ...testMetadata, label: 'test2' }],
        namespace: namespace2,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 2);

      // Query namespace1
      const results1 = await vectorDB.query({
        indexName: indexNameNamespace,
        queryVector: testVector,
        namespace: namespace1,
      });

      // Query namespace2
      const results2 = await vectorDB.query({
        indexName: indexNameNamespace,
        queryVector: testVector,
        namespace: namespace2,
      });

      // Verify isolation
      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results1[0]?.id).toBe(id1);
      expect(results1[0]?.metadata?.label).toBe('test');
      expect(results2[0]?.id).toBe(id2);
      expect(results2[0]?.metadata?.label).toBe('test2');
    }, 500000);

    it('should update vectors within specific namespace', async () => {
      const [id] = await vectorDB.upsert({
        indexName: indexNameNamespace,
        vectors: [testVector],
        metadata: [testMetadata],
        namespace: namespace1,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 1);

      // Update in namespace1
      await vectorDB.updateIndexById(indexNameNamespace, id, { metadata: { label: 'updated' } }, namespace1);

      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 1);

      // Query to verify update
      const results = await vectorDB.query({
        indexName: indexNameNamespace,
        queryVector: testVector,
        namespace: namespace1,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.metadata?.label).toBe('updated');
    }, 500000);

    it('should delete vectors from specific namespace', async () => {
      const [id] = await vectorDB.upsert({
        indexName: indexNameNamespace,
        vectors: [testVector],
        metadata: [testMetadata],
        namespace: namespace1,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 1);

      // Delete from namespace1
      await vectorDB.deleteIndexById(indexNameNamespace, id, namespace1);

      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 0, true);

      // Query to verify deletion
      const results = await vectorDB.query({
        indexName: indexNameNamespace,
        queryVector: testVector,
        namespace: namespace1,
      });

      expect(results.length).toBe(0);
    }, 500000);

    it('should show namespace stats in describeIndex', async () => {
      await vectorDB.upsert({
        indexName: indexNameNamespace,
        vectors: [testVector],
        metadata: [testMetadata],
        namespace: namespace1,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 1);
      await vectorDB.upsert({
        indexName: indexNameNamespace,
        vectors: [testVector],
        metadata: [{ ...testMetadata, label: 'test2' }],
        namespace: namespace2,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameNamespace, 2);

      const stats = await vectorDB.describeIndex(indexNameNamespace);
      expect(stats.namespaces).toBeDefined();
      expect(stats.namespaces?.[namespace1]).toBeDefined();
      expect(stats.namespaces?.[namespace2]).toBeDefined();
      expect(stats.namespaces?.[namespace1].recordCount).toBe(1);
      expect(stats.namespaces?.[namespace2].recordCount).toBe(1);
    }, 500000);
  });

  describe('Error Handling', () => {
    it('should handle non-existent index query gracefully', async () => {
      const nonExistentIndex = 'non-existent-index';
      await expect(vectorDB.query({ indexName: nonExistentIndex, queryVector: [1, 0, 0] })).rejects.toThrow();
    }, 500000);

    it('should handle incorrect dimension vectors', async () => {
      const wrongDimVector = [[1, 0]]; // 2D vector for 3D index
      await expect(vectorDB.upsert({ indexName: testIndexName, vectors: wrongDimVector })).rejects.toThrow();
    }, 500000);
  });

  describe('Performance Tests', () => {
    it('should handle batch upsert of 1000 vectors', async () => {
      const batchSize = 1000;
      const vectors = Array(batchSize)
        .fill(null)
        .map(() =>
          Array(dimension)
            .fill(null)
            .map(() => Math.random()),
        );
      const metadata = vectors.map((_, i) => ({ id: i }));

      const start = Date.now();
      const ids = await vectorDB.upsert({ indexName: testIndexName, vectors, metadata });
      const duration = Date.now() - start;

      expect(ids).toHaveLength(batchSize);
      console.log(`Batch upsert of ${batchSize} vectors took ${duration}ms`);
    }, 300000); // 5 minute timeout

    it('should perform multiple concurrent queries', async () => {
      const queryVector = [1, 0, 0];
      const numQueries = 10;

      const start = Date.now();
      const promises = Array(numQueries)
        .fill(null)
        .map(() => vectorDB.query({ indexName: testIndexName, queryVector }));

      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      expect(results).toHaveLength(numQueries);
      console.log(`${numQueries} concurrent queries took ${duration}ms`);
    }, 500000);
  });

  describe('Filter Validation in Queries', () => {
    it('rejects queries with null values', async () => {
      await expect(
        vectorDB.query({ indexName: testIndexName, queryVector: [1, 0, 0], topK: 10, filter: { field: null } }),
      ).rejects.toThrow();

      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { other: { $eq: null } },
        }),
      ).rejects.toThrow('the $eq operator must be followed by a string, boolean or a number, got null instead');
    });

    it('rejects invalid array operator values', async () => {
      // Test non-undefined values
      const invalidValues = [123, 'string', true, { key: 'value' }, null];
      for (const op of ['$in', '$nin']) {
        for (const val of invalidValues) {
          await expect(
            vectorDB.query({
              indexName: testIndexName,
              queryVector: [1, 0, 0],
              filter: { field: { [op]: val } },
            }),
          ).rejects.toThrow(`the ${op} operator must be followed by a list of strings or a list of numbers`);
        }
      }
    });

    it('validates comparison operators', async () => {
      const numOps = ['$gt', '$gte', '$lt', '$lte'];
      const invalidNumericValues = ['not-a-number', true, [], {}, null]; // Removed undefined
      for (const op of numOps) {
        for (const val of invalidNumericValues) {
          await expect(
            vectorDB.query({
              indexName: testIndexName,
              queryVector: [1, 0, 0],
              filter: { field: { [op]: val } },
            }),
          ).rejects.toThrow(`the ${op} operator must be followed by a number`);
        }
      }
    });

    it('rejects multiple invalid values', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { field1: { $in: 'not-array' }, field2: { $exists: 'not-boolean' }, field3: { $gt: 'not-number' } },
        }),
      ).rejects.toThrow();
    });

    it('rejects invalid array values', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { field: { $in: [null] } },
        }),
      ).rejects.toThrow('the $in operator must be followed by a list of strings or a list of numbers');

      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { field: { $in: [undefined] } },
        }),
      ).rejects.toThrow('the $in operator must be followed by a list of strings or a list of numbers');

      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { field: { $all: 'not-an-array' } },
        }),
      ).rejects.toThrow('A non-empty array is required for the $all operator');
    });

    it('handles empty object filters', async () => {
      // Test empty object at top level
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { field: { $eq: {} } },
        }),
      ).rejects.toThrow('the $eq operator must be followed by a string, boolean or a number, got {} instead');
    });

    it('handles empty/undefined filters by returning all results', async () => {
      // Empty objects and undefined are ignored by Pinecone
      // and will return all results without filtering
      const noFilterCases = [{ field: {} }, { field: undefined }, { field: { $in: undefined } }];

      for (const filter of noFilterCases) {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter,
        });
        expect(results.length).toBeGreaterThan(0);
      }
    });
    it('handles empty object filters', async () => {
      // Test empty object at top level
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: {},
        }),
      ).rejects.toThrow('You must enter a `filter` object with at least one key-value pair.');
    });
  });

  describe('Metadata Filter Tests', () => {
    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
      [0.5, 0.5, 0.0],
      [0.3, 0.3, 0.3],
      [0.8, 0.1, 0.1],
      [0.1, 0.8, 0.1],
      [0.1, 0.1, 0.8],
    ];

    const testMetadata = [
      { category: 'electronics', price: 1000, tags: ['premium', 'new'], inStock: true, rating: 4.5 },
      { category: 'books', price: 50, tags: ['bestseller'], inStock: true, rating: 4.8 },
      { category: 'electronics', price: 500, tags: ['refurbished'], inStock: false, rating: 4.0 },
      { category: 'clothing', price: 75, tags: ['summer', 'sale'], inStock: true, rating: 4.2 },
      { category: 'books', price: 30, tags: ['paperback', 'sale'], inStock: true, rating: 4.1 },
      { category: 'electronics', price: 800, tags: ['premium'], inStock: true, rating: 4.7 },
      { category: 'clothing', price: 150, tags: ['premium', 'new'], inStock: false, rating: 4.4 },
      { category: 'books', price: 25, tags: ['paperback', 'bestseller'], inStock: true, rating: 4.3 },
    ];

    beforeAll(async () => {
      await vectorDB.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata });
      // Wait for vectors to be indexed
      await waitUntilVectorsIndexed(vectorDB, testIndexName, testVectors.length);
    }, 500000);

    describe('Comparison Operators', () => {
      it('should filter with implict $eq', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { category: 'electronics' },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });
      it('should filter with $eq operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { category: { $eq: 'electronics' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
        });
      });

      it('should filter with $gt operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: 500 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThan(500);
        });
      });

      it('should filter with $gte operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gte: 500 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThanOrEqual(500);
        });
      });

      it('should filter with $lt operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $lt: 100 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThan(100);
        });
      });

      it('should filter with $lte operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $lte: 50 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(50);
        });
      });

      it('should filter with $ne operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { category: { $ne: 'electronics' } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).not.toBe('electronics');
        });
      });

      it('filters with $gte, $lt, $lte operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gte: 25, $lte: 30 } },
        });
        expect(results.length).toBe(2);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeLessThanOrEqual(30);
          expect(Number(result.metadata?.price)).toBeGreaterThanOrEqual(25);
        });
      });
    });

    describe('Array Operators', () => {
      it('should filter with $in operator for strings', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { category: { $in: ['electronics', 'books'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result.metadata?.category);
        });
      });

      it('should filter with $in operator for numbers', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $in: [50, 75, 1000] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect([50, 75, 1000]).toContain(result.metadata?.price);
        });
      });

      it('should filter with $nin operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { category: { $nin: ['electronics', 'books'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).not.toContain(result.metadata?.category);
        });
      });

      it('should filter with $all operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: ['premium', 'new'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('premium');
          expect(result.metadata?.tags).toContain('new');
        });
      });
    });

    describe('Logical Operators', () => {
      it('should filter with implict $and', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { category: 'electronics', price: { $gt: 700 }, inStock: true },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
          expect(Number(result.metadata?.price)).toBeGreaterThan(700);
          expect(result.metadata?.inStock).toBe(true);
        });
      });
      it('should filter with $and operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { $and: [{ category: 'electronics' }, { price: { $gt: 700 } }, { inStock: true }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.category).toBe('electronics');
          expect(Number(result.metadata?.price)).toBeGreaterThan(700);
          expect(result.metadata?.inStock).toBe(true);
        });
      });

      it('should filter with $or operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { $or: [{ price: { $gt: 900 } }, { tags: { $all: ['bestseller'] } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const condition1 = Number(result.metadata?.price) > 900;
          const condition2 = result.metadata?.tags?.includes('bestseller');
          expect(condition1 || condition2).toBe(true);
        });
      });

      it('should handle nested logical operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: {
            $and: [
              {
                $or: [{ category: 'electronics' }, { category: 'books' }],
              },
              { price: { $lt: 100 } },
              { inStock: true },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(['electronics', 'books']).toContain(result.metadata?.category);
          expect(Number(result.metadata?.price)).toBeLessThan(100);
          expect(result.metadata?.inStock).toBe(true);
        });
      });
    });

    describe('Complex Filter Combinations', () => {
      it('should combine comparison and array operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { $and: [{ price: { $gte: 500 } }, { tags: { $in: ['premium', 'refurbished'] } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.price)).toBeGreaterThanOrEqual(500);
          expect(result.metadata?.tags?.some(tag => ['premium', 'refurbished'].includes(tag))).toBe(true);
        });
      });

      it('should handle multiple conditions on same field', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { $and: [{ price: { $gte: 30 } }, { price: { $lte: 800 } }] },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const price = Number(result.metadata?.price);
          expect(price).toBeGreaterThanOrEqual(30);
          expect(price).toBeLessThanOrEqual(800);
        });
      });

      it('should handle complex nested conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: {
            $or: [
              {
                $and: [{ category: 'electronics' }, { price: { $gt: 700 } }, { tags: { $all: ['premium'] } }],
              },
              {
                $and: [{ category: 'books' }, { price: { $lt: 50 } }, { tags: { $in: ['paperback'] } }],
              },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const isExpensiveElectronics =
            result.metadata?.category === 'electronics' &&
            Number(result.metadata?.price) > 700 &&
            result.metadata?.tags?.includes('premium');

          const isCheapBook =
            result.metadata?.category === 'books' &&
            Number(result.metadata?.price) < 50 &&
            result.metadata?.tags?.includes('paperback');

          expect(isExpensiveElectronics || isCheapBook).toBe(true);
        });
      });

      it('combines existence checks with other operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { $and: [{ category: 'clothing' }, { optionalField: { $exists: false } }] },
        });
        expect(results.length).toBe(2);
        expect(results[0]!.metadata!.category).toBe('clothing');
        expect('optionalField' in results[0]!.metadata!).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle numeric comparisons with decimals', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { rating: { $gt: 4.5 } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(Number(result.metadata?.rating)).toBeGreaterThan(4.5);
        });
      });

      it('should handle boolean values', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { inStock: { $eq: false } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.inStock).toBe(false);
        });
      });

      it('should handle empty array in $in operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { category: { $in: [] } },
        });
        expect(results).toHaveLength(0);
      });

      it('should handle single value in $all operator', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { tags: { $all: ['premium'] } },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('premium');
        });
      });
    });
  });

  describe('Additional Validation Tests', () => {
    it('should reject non-numeric values in numeric comparisons', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $gt: '500' } }, // string instead of number
        }),
      ).rejects.toThrow('the $gt operator must be followed by a number');
    });

    it('should reject invalid types in $in operator', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { price: { $in: [true, false] } }, // booleans instead of numbers
        }),
      ).rejects.toThrow('the $in operator must be followed by a list of strings or a list of numbers');
    });

    it('should reject mixed types in $in operator', async () => {
      await expect(
        vectorDB.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0],
          filter: { field: { $in: ['string', 123] } }, // mixed string and number
        }),
      ).rejects.toThrow();
    });
    it('should handle undefined filter', async () => {
      const results1 = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: undefined,
      });
      const results2 = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
      });
      expect(results1).toEqual(results2);
      expect(results1.length).toBeGreaterThan(0);
    });

    it('should handle null filter', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: null,
      });
      const results2 = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
      });
      expect(results).toEqual(results2);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Additional Edge Cases', () => {
    it('should handle exact boundary conditions', async () => {
      // Test exact boundary values from our test data
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { $and: [{ price: { $gte: 25 } }, { price: { $lte: 1000 } }] },
      });
      expect(results.length).toBeGreaterThan(0);
      // Should include both boundary values
      expect(results.some(r => r.metadata?.price === 25)).toBe(true);
      expect(results.some(r => r.metadata?.price === 1000)).toBe(true);
    });

    it('should handle multiple $all conditions on same array field', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { $and: [{ tags: { $all: ['premium'] } }, { tags: { $all: ['new'] } }] },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.metadata?.tags).toContain('premium');
        expect(result.metadata?.tags).toContain('new');
      });
    });

    it('should handle multiple array operator combinations', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { $and: [{ tags: { $all: ['premium'] } }, { tags: { $in: ['new', 'refurbished'] } }] },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.metadata?.tags).toContain('premium');
        expect(result.metadata?.tags?.some(tag => ['new', 'refurbished'].includes(tag))).toBe(true);
      });
    });
  });

  describe('Additional Complex Logical Combinations', () => {
    it('should handle deeply nested $or conditions', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: {
          $or: [
            {
              $and: [{ category: 'electronics' }, { $or: [{ price: { $gt: 900 } }, { tags: { $all: ['premium'] } }] }],
            },
            {
              $and: [{ category: 'books' }, { $or: [{ price: { $lt: 30 } }, { tags: { $all: ['bestseller'] } }] }],
            },
          ],
        },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        if (result.metadata?.category === 'electronics') {
          expect(Number(result.metadata?.price) > 900 || result.metadata?.tags?.includes('premium')).toBe(true);
        } else if (result.metadata?.category === 'books') {
          expect(Number(result.metadata?.price) < 30 || result.metadata?.tags?.includes('bestseller')).toBe(true);
        }
      });
    });

    it('should handle multiple field comparisons with same value', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: { $or: [{ price: { $gt: 500 } }, { rating: { $gt: 4.5 } }] },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(Number(result.metadata?.price) > 500 || Number(result.metadata?.rating) > 4.5).toBe(true);
      });
    });

    it('should handle combination of array and numeric comparisons', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: {
          $and: [
            { tags: { $in: ['premium', 'bestseller'] } },
            { $or: [{ price: { $gt: 500 } }, { rating: { $gt: 4.5 } }] },
          ],
        },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(['premium', 'bestseller'].some(tag => result.metadata?.tags?.includes(tag))).toBe(true);
        expect(Number(result.metadata?.price) > 500 || Number(result.metadata?.rating) > 4.5).toBe(true);
      });
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle filters with many conditions', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: {
          $and: Array(10)
            .fill(null)
            .map(() => ({
              $or: [{ price: { $gt: 100 } }, { rating: { $gt: 4.0 } }],
            })),
        },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(Number(result.metadata?.price) > 100 || Number(result.metadata?.rating) > 4.0).toBe(true);
      });
    });

    it('should handle deeply nested conditions efficiently', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: {
          $or: Array(5)
            .fill(null)
            .map(() => ({
              $and: [{ category: { $in: ['electronics', 'books'] } }, { price: { $gt: 50 } }, { rating: { $gt: 4.0 } }],
            })),
        },
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(['electronics', 'books']).toContain(result.metadata?.category);
        expect(Number(result.metadata?.price)).toBeGreaterThan(50);
        expect(Number(result.metadata?.rating)).toBeGreaterThan(4.0);
      });
    });

    it('should handle large number of $or conditions', async () => {
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0],
        filter: {
          $or: [
            ...Array(5)
              .fill(null)
              .map((_, i) => ({
                price: { $gt: i * 100 },
              })),
            ...Array(5)
              .fill(null)
              .map((_, i) => ({
                rating: { $gt: 4.0 + i * 0.1 },
              })),
          ],
        },
      });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Hybrid Search Operations', () => {
    const testVectors = [
      [0.9, 0.1, 0.0], // cats (very distinct)
      [0.1, 0.9, 0.0], // dogs (very distinct)
      [0.0, 0.0, 0.9], // birds (completely different)
    ];

    const testMetadata = [
      { text: 'cats purr and meow', animal: 'cat' },
      { text: 'dogs bark and fetch', animal: 'dog' },
      { text: 'birds fly and nest', animal: 'bird' },
    ];

    // Create sparse vectors with fixed vocabulary indices
    const testSparseVectors = [
      { indices: [0], values: [1.0] }, // cat terms only
      { indices: [1], values: [1.0] }, // dog terms only
      { indices: [2], values: [1.0] }, // bird terms only
    ];

    beforeEach(async () => {
      await vectorDB.createIndex({ indexName: indexNameHybrid, dimension: 3, metric: 'dotproduct' });
      await waitUntilReady(vectorDB, indexNameHybrid);

      // Upsert with both dense and sparse vectors
      await vectorDB.upsert({
        indexName: indexNameHybrid,
        vectors: testVectors,
        sparseVectors: testSparseVectors,
        metadata: testMetadata,
      });
      await waitUntilVectorsIndexed(vectorDB, indexNameHybrid, 3);
    });

    afterEach(async () => {
      try {
        await vectorDB.deleteIndex(indexNameHybrid);
        await waitUntilIndexDeleted(vectorDB, indexNameHybrid);
      } catch {
        // Ignore errors if index doesn't exist
      }
    });

    it('should combine dense and sparse signals in hybrid search', async () => {
      // Query vector strongly favors cats
      const queryVector = [1.0, 0.0, 0.0];
      // But sparse vector strongly favors dogs
      const sparseVector = {
        indices: [1], // Index 1 corresponds to dog-related terms
        values: [1.0], // Maximum weight for dog terms
      };

      const results = await vectorDB.query({
        indexName: indexNameHybrid,
        queryVector,
        sparseVector,
        topK: 2,
      });

      expect(results).toHaveLength(2);

      // Get results with just vector similarity
      const vectorResults = await vectorDB.query({
        indexName: indexNameHybrid,
        queryVector,
        topK: 2,
      });

      // Results should be different when using hybrid search vs just vector
      expect(results[0].id).not.toBe(vectorResults[0].id);

      // First result should be dog due to sparse vector influence
      expect(results[0].metadata?.animal).toBe('dog');
    });

    it('should support sparse vectors as optional parameters', async () => {
      // Should work with just dense vectors in upsert
      await vectorDB.upsert({
        indexName: indexNameHybrid,
        vectors: [[0.1, 0.2, 0.3]],
        metadata: [{ test: 'dense only' }],
      });

      // Should work with just dense vector in query
      const denseOnlyResults = await vectorDB.query({
        indexName: indexNameHybrid,
        queryVector: [0.1, 0.2, 0.3],
        topK: 1,
      });
      expect(denseOnlyResults).toHaveLength(1);

      // Should work with both dense and sparse in query
      const hybridResults = await vectorDB.query({
        indexName: indexNameHybrid,
        queryVector: [0.1, 0.2, 0.3],
        sparseVector: createSparseVector('test query'),
        topK: 1,
      });
      expect(hybridResults).toHaveLength(1);
    });
  });

  describe('Deprecation Warnings', () => {
    const indexName = 'testdeprecationwarnings';

    const indexName2 = 'testdeprecationwarnings2';

    const indexName3 = 'testdeprecationwarnings3';

    const indexName4 = 'testdeprecationwarnings4';

    let warnSpy;

    beforeAll(async () => {
      try {
        await vectorDB.deleteIndex(indexName);
      } catch {
        // Ignore errors if index doesn't exist
      }
      try {
        await vectorDB.deleteIndex(indexName2);
      } catch {
        // Ignore errors if index doesn't exist
      }
      try {
        await vectorDB.deleteIndex(indexName3);
      } catch {
        // Ignore errors if index doesn't exist
      }
      try {
        await vectorDB.deleteIndex(indexName4);
      } catch {
        // Ignore errors if index doesn't exist
      }
      await vectorDB.createIndex({ indexName: indexName, dimension: 3 });
      await waitUntilReady(vectorDB, indexName);
    });

    afterAll(async () => {
      try {
        await vectorDB.deleteIndex(indexName);
      } catch {
        // Ignore errors if index doesn't exist
      }
      try {
        await vectorDB.deleteIndex(indexName2);
      } catch {
        // Ignore errors if index doesn't exist
      }
      try {
        await vectorDB.deleteIndex(indexName3);
      } catch {
        // Ignore errors if index doesn't exist
      }
      try {
        await vectorDB.deleteIndex(indexName4);
      } catch {
        // Ignore errors if index doesn't exist
      }
    });

    beforeEach(async () => {
      warnSpy = vi.spyOn(vectorDB['logger'], 'warn');
    });

    afterEach(async () => {
      warnSpy.mockRestore();
    });

    it('should show deprecation warning when using individual args for createIndex', async () => {
      await vectorDB.createIndex(indexName2, 3, 'cosine');
      await waitUntilReady(vectorDB, indexName2);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deprecation Warning: Passing individual arguments to createIndex() is deprecated'),
      );
    });

    it('should show deprecation warning when using individual args for upsert', async () => {
      await vectorDB.upsert(indexName, [[1, 2, 3]], [{ test: 'data' }]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deprecation Warning: Passing individual arguments to upsert() is deprecated'),
      );
    });

    it('should show deprecation warning when using individual args for query', async () => {
      await vectorDB.query(indexName, [1, 2, 3], 5);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deprecation Warning: Passing individual arguments to query() is deprecated'),
      );
    });

    it('should not show deprecation warning when using object param for query', async () => {
      await vectorDB.query({
        indexName,
        queryVector: [1, 2, 3],
        topK: 5,
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should not show deprecation warning when using object param for createIndex', async () => {
      await vectorDB.createIndex({
        indexName: indexName3,
        dimension: 3,
        metric: 'cosine',
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should not show deprecation warning when using object param for upsert', async () => {
      await vectorDB.upsert({
        indexName,
        vectors: [[1, 2, 3]],
        metadata: [{ test: 'data' }],
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should maintain backward compatibility with individual args', async () => {
      // Query
      const queryResults = await vectorDB.query(indexName, [1, 2, 3], 5);
      expect(Array.isArray(queryResults)).toBe(true);

      // CreateIndex
      await expect(vectorDB.createIndex(indexName4, 3, 'cosine')).resolves.not.toThrow();
      await waitUntilReady(vectorDB, indexName4);
      // Upsert
      const upsertResults = await vectorDB.upsert({
        indexName,
        vectors: [[1, 2, 3]],
        metadata: [{ test: 'data' }],
      });
      expect(Array.isArray(upsertResults)).toBe(true);
      expect(upsertResults).toHaveLength(1);
    });
  });
});
