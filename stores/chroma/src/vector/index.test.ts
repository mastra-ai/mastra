import { createVectorTestSuite } from '@internal/storage-test-utils';
import { describe, expect, beforeEach, afterEach, it, beforeAll, afterAll, vi } from 'vitest';

import { ChromaVector } from './';

describe('ChromaVector Integration Tests', () => {
  let vectorDB = new ChromaVector({ id: 'chroma-test-vector' });

  const testIndexName = 'test-index';
  const testIndexName2 = 'test-index-2';
  const testIndexName3 = 'test-index-3';
  const dimension = 3;

  beforeEach(async () => {
    // Clean up any existing test index
    try {
      await vectorDB.deleteIndex({ indexName: testIndexName });
    } catch {
      // Ignore errors if index doesn't exist
    }
    await vectorDB.createIndex({ indexName: testIndexName, dimension });
  }, 5000);

  afterEach(async () => {
    // Cleanup after tests
    try {
      await vectorDB.deleteIndex({ indexName: testIndexName });
    } catch {
      // Ignore cleanup errors
    }
  }, 5000);

  describe('Error Handling', () => {
    it('should handle duplicate index creation gracefully', async () => {
      const infoSpy = vi.spyOn(vectorDB['logger'], 'info');
      const warnSpy = vi.spyOn(vectorDB['logger'], 'warn');

      const duplicateIndexName = `duplicate-test`;
      const dimension = 768;

      try {
        // Create index first time
        await vectorDB.createIndex({
          indexName: duplicateIndexName,
          dimension,
          metric: 'cosine',
        });

        // Try to create with same dimensions - should not throw
        await expect(
          vectorDB.createIndex({
            indexName: duplicateIndexName,
            dimension,
            metric: 'cosine',
          }),
        ).resolves.not.toThrow();

        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('already exists with'));

        // Try to create with same dimensions and different metric - should not throw
        await expect(
          vectorDB.createIndex({
            indexName: duplicateIndexName,
            dimension,
            metric: 'euclidean',
          }),
        ).resolves.not.toThrow();

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Attempted to create index with metric'));

        // Try to create with different dimensions - should throw
        await expect(
          vectorDB.createIndex({
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
        await vectorDB.deleteIndex({ indexName: duplicateIndexName });
      }
    });
  });

  describe('Metadata Filter Tests', () => {
    // Set up test vectors and metadata
    beforeAll(async () => {
      try {
        await vectorDB.deleteIndex({ indexName: testIndexName2 });
      } catch {
        // Ignore errors if index doesn't exist
      }
      await vectorDB.createIndex({ indexName: testIndexName2, dimension });

      const vectors = [
        [1, 0, 0], // Electronics
        [0, 1, 0], // Books
        [0, 0, 1], // Electronics
        [0, 0, 0.1], // Books
      ];

      const metadata = [
        {
          category: 'electronics',
          price: 1000,
          rating: 4.8,
          inStock: true,
        },
        {
          category: 'books',
          price: 25,
          rating: 4.2,
          inStock: true,
        },
        {
          category: 'electronics',
          price: 500,
          rating: 4.5,
          inStock: false,
        },
        {
          category: 'books',
          price: 15,
          rating: 4.9,
          inStock: true,
        },
      ];

      await vectorDB.upsert({ indexName: testIndexName2, vectors, metadata });
      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
      // Cleanup after tests
      try {
        await vectorDB.deleteIndex({ indexName: testIndexName2 });
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('Additional Validation Tests', () => {
      it('should throw error as date is not supported', async () => {
        await expect(
          vectorDB.query({
            indexName: testIndexName2,
            queryVector: [1, 0, 0],
            filter: {
              $and: [
                { currentDate: { $lte: new Date().toISOString() } },
                { currentDate: { $gt: new Date(0).toISOString() } },
              ],
            },
          }),
        ).rejects.toThrow();
      });
    });

    describe('Performance Edge Cases', () => {
      it('should handle filters with many conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName2,
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
          indexName: testIndexName2,
          queryVector: [1, 0, 0],
          filter: {
            $or: Array(5)
              .fill(null)
              .map(() => ({
                $and: [
                  { category: { $in: ['electronics', 'books'] } },
                  { price: { $gt: 50 } },
                  { rating: { $gt: 4.0 } },
                ],
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
          indexName: testIndexName2,
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
  });

  describe('Document Operations and Filtering', () => {
    const testDocuments = [
      'The quick brown fox jumps over the lazy dog',
      'Pack my box with five dozen liquor jugs',
      'How vexingly quick daft zebras JUMP',
    ];

    beforeAll(async () => {
      try {
        await vectorDB.deleteIndex({ indexName: testIndexName3 });
      } catch {
        // Ignore errors if index doesn't exist
      }
      await vectorDB.createIndex({ indexName: testIndexName3, dimension });

      const testVectors = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
      ];

      const testMetadata = [
        { source: 'pangram1', length: 43 },
        { source: 'pangram2', length: 32 },
        { source: 'pangram3', length: 30 },
      ];
      const testIds = ['doc1', 'doc2', 'doc3'];

      await vectorDB.upsert({
        indexName: testIndexName3,
        vectors: testVectors,
        documents: testDocuments,
        metadata: testMetadata,
        ids: testIds,
      });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
      // Cleanup after tests
      try {
        await vectorDB.deleteIndex({ indexName: testIndexName3 });
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('Basic Document Operations', () => {
      it('should store and retrieve documents', async () => {
        const results = await vectorDB.query({ indexName: testIndexName3, queryVector: [1.0, 0.0, 0.0], topK: 3 });
        expect(results).toHaveLength(3);
        // Verify documents are returned

        expect(results[0]!.document).toBe(testDocuments[0]);
      });

      it('should filter documents using $contains', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $contains: 'quick' },
        });
        expect(results).toHaveLength(2);
      });

      it('should filter with $not_contains', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $not_contains: 'fox' },
        });
        expect(results.every(r => !r.document?.includes('fox'))).toBe(true);
      });

      it('should combine metadata and document filters', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          filter: { source: 'pangram1' },
          documentFilter: { $contains: 'fox' },
        });
        expect(results).toHaveLength(1);
        expect(results[0]!.metadata?.source).toBe('pangram1');
        expect(results[0]!.document).toContain('fox');
      });

      it('should get records with metadata and document filters', async () => {
        const results = await vectorDB.get({
          indexName: testIndexName3,
          filter: { source: 'pangram1' },
          documentFilter: { $contains: 'fox' },
        });
        expect(results).toHaveLength(1);
        expect(results[0]!.metadata?.source).toBe('pangram1');
        expect(results[0]!.document).toContain('fox');
      });
    });

    describe('Complex Document Filtering', () => {
      it('should handle $and conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $and: [{ $contains: 'quick' }, { $not_contains: 'fox' }] },
        });
        expect(results).toHaveLength(1);
        expect(results[0]!.document).toContain('quick');
        expect(results[0]!.document).not.toContain('fox');
      });

      it('should handle $or conditions', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $or: [{ $contains: 'fox' }, { $contains: 'zebras' }] },
        });
        expect(results).toHaveLength(2);
        expect(results[0]!.document).toContain('fox');
        expect(results[1]!.document).toContain('zebras');
      });
    });

    describe('Edge Cases and Validation', () => {
      it('allows empty string in $contains', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $contains: '' },
        });
        expect(results).toHaveLength(3);
      });

      it('should be case sensitive', async () => {
        // First verify lowercase works
        const lowerResults = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $contains: 'quick' },
        });
        expect(lowerResults.length).toBe(2);

        // Then verify uppercase doesn't match
        const upperResults = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $contains: 'QUICK' },
        });
        expect(upperResults.length).toBe(0);

        const upperResults2 = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $contains: 'JUMP' },
        });
        expect(upperResults2.length).toBe(1);
      });

      it('should handle exact string matches', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: { $contains: 'quick brown' }, // Test multi-word match
        });
        expect(results.length).toBe(1);
        expect(results[0]!.document).toContain('quick brown');
      });

      it('should handle deeply nested logical operators', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1.0, 0.0, 0.0],
          topK: 3,
          documentFilter: {
            $or: [
              {
                $and: [{ $contains: 'quick' }, { $not_contains: 'fox' }],
              },
              {
                $and: [{ $contains: 'box' }, { $not_contains: 'quick' }],
              },
            ],
          },
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          if (result.document?.includes('quick')) {
            expect(result.document).not.toContain('fox');
          } else if (result.document?.includes('box')) {
            expect(result.document).not.toContain('quick');
          }
        });
      });
      it('should handle undefined document filter', async () => {
        const results1 = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1, 0, 0],
          documentFilter: undefined,
        });
        const results2 = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1, 0, 0],
        });
        expect(results1).toEqual(results2);
        expect(results1.length).toBeGreaterThan(0);
      });

      it('should handle empty object document filter', async () => {
        await expect(
          vectorDB.query({
            indexName: testIndexName3,
            queryVector: [1, 0, 0],
            // @ts-ignore
            documentFilter: {},
          }),
        ).rejects.toThrow();
      });

      it('should handle null filter', async () => {
        const results = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1, 0, 0],
          documentFilter: null,
        });
        const results2 = await vectorDB.query({
          indexName: testIndexName3,
          queryVector: [1, 0, 0],
        });
        expect(results).toEqual(results2);
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance and Concurrency', () => {
    const perfTestIndex = 'perf-test-index';

    beforeEach(async () => {
      try {
        await vectorDB.deleteIndex({ indexName: perfTestIndex });
      } catch {
        // Ignore errors if index doesn't exist
      }
      await vectorDB.createIndex({ indexName: perfTestIndex, dimension });
    }, 10000);

    afterEach(async () => {
      try {
        await vectorDB.deleteIndex({ indexName: perfTestIndex });
      } catch {
        // Ignore cleanup errors
      }
    }, 10000);

    it('handles concurrent operations correctly', async () => {
      const promises = Array(10)
        .fill(0)
        .map((_, i) =>
          vectorDB.upsert({
            indexName: perfTestIndex,
            vectors: [[1, 0, 0]],
            metadata: [{ test: 'concurrent', id: i }],
            ids: [`concurrent-${i}`],
          }),
        );
      await Promise.all(promises);

      const results = await vectorDB.query({
        indexName: perfTestIndex,
        queryVector: [1, 0, 0],
        filter: { test: 'concurrent' },
      });
      expect(results).toHaveLength(10);
    }, 15000);

    it('handles large batch operations', async () => {
      const batchSize = 100; // Using 100 instead of 1000 to keep tests fast
      const vectors = Array(batchSize)
        .fill(0)
        .map(() => [1, 0, 0]);
      const metadata = vectors.map((_, i) => ({ index: i, test: 'batch' }));
      const ids = vectors.map((_, i) => `batch-${i}`);

      await vectorDB.upsert({
        indexName: perfTestIndex,
        vectors,
        metadata,
        ids,
      });

      // Verify all vectors were inserted
      const stats = await vectorDB.describeIndex({ indexName: perfTestIndex });
      expect(stats.count).toBe(batchSize);

      const results = await vectorDB.query({
        indexName: perfTestIndex,
        queryVector: [1, 0, 0],
        filter: { test: 'batch' },
        topK: batchSize,
      });
      expect(results).toHaveLength(batchSize);

      // Test querying with pagination
      const pageSize = 20;
      const pages = [];
      for (let i = 0; i < batchSize; i += pageSize) {
        const page = await vectorDB.query({
          indexName: perfTestIndex,
          queryVector: [1, 0, 0],
          filter: { test: 'batch' },
          topK: pageSize,
        });
        pages.push(page);
        expect(page).toHaveLength(Math.min(pageSize, batchSize - i));
      }
      expect(pages).toHaveLength(Math.ceil(batchSize / pageSize));
    }, 30000);
  });
});

// Shared vector store test suite
const chromaVector = new ChromaVector({ id: 'chroma-shared-test' });

createVectorTestSuite({
  vector: chromaVector,
  createIndex: async (indexName: string) => {
    await chromaVector.createIndex({ indexName, dimension: 1536 });
  },
  deleteIndex: async (indexName: string) => {
    await chromaVector.deleteIndex({ indexName });
  },
  waitForIndexing: async () => {
    // Chroma may need a short wait for indexing
    await new Promise(resolve => setTimeout(resolve, 2000));
  },
});

// ChromaCloudVector fork functionality tests (requires CHROMA_API_KEY)
describe.skipIf(!process.env.CHROMA_API_KEY)('ChromaCloudVector Fork Tests', () => {
  let cloudVector: ChromaVector;
  const testIndexName = 'fork-test-index';
  const forkedIndexName = 'forked-test-index';
  const dimension = 3;

  beforeEach(async () => {
    cloudVector = new ChromaVector({
      id: 'chroma-cloud-vector-fork-test',
      apiKey: process.env.CHROMA_API_KEY,
    });

    // Clean up any existing test indexes
    try {
      await cloudVector.deleteIndex({ indexName: testIndexName });
    } catch {
      // Ignore errors if index doesn't exist
    }
    try {
      await cloudVector.deleteIndex({ indexName: forkedIndexName });
    } catch {
      // Ignore errors if index doesn't exist
    }
  });

  afterEach(async () => {
    // Cleanup after tests
    try {
      await cloudVector.deleteIndex({ indexName: testIndexName });
    } catch {
      // Ignore cleanup errors
    }
    try {
      await cloudVector.deleteIndex({ indexName: forkedIndexName });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('fork', () => {
    it('should fork an index successfully', async () => {
      // Create source index with data
      await cloudVector.createIndex({
        indexName: testIndexName,
        dimension,
      });

      const vectors = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
      ];
      const metadata = [{ type: 'test1' }, { type: 'test2' }, { type: 'test3' }];

      await cloudVector.upsert({
        indexName: testIndexName,
        vectors,
        metadata,
      });

      // Wait for data to be indexed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fork the index
      await cloudVector.forkIndex({
        sourceIndexName: testIndexName,
        destinationIndexName: forkedIndexName,
      });

      // Verify forked index exists
      const indexes = await cloudVector.listIndexes();
      expect(indexes).toContain(forkedIndexName);

      // Query forked index to verify data
      const results = await cloudVector.query({
        indexName: forkedIndexName,
        queryVector: [1.0, 0.0, 0.0],
        topK: 1,
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.metadata?.type).toBe('test1');
    }, 10000);

    it('should throw error when forking non-existent index', async () => {
      await expect(
        cloudVector.forkIndex({
          sourceIndexName: 'non-existent-index',
          destinationIndexName: forkedIndexName,
        }),
      ).rejects.toThrow();
    });
  });
});

// ChromaCloudVector search API tests (requires CHROMA_API_KEY)
describe.skipIf(!process.env.CHROMA_API_KEY)('ChromaCloudVector Search API Tests', () => {
  let cloudVector: ChromaVector;
  const testIndexName = 'search-test-index';
  const dimension = 3;

  beforeEach(async () => {
    cloudVector = new ChromaVector({
      id: 'chroma-cloud-vector-search-test',
      apiKey: process.env.CHROMA_API_KEY,
    });

    // Clean up any existing test index
    try {
      await cloudVector.deleteIndex({ indexName: testIndexName });
    } catch {
      // Ignore errors if index doesn't exist
    }

    // Create test index with data
    await cloudVector.createIndex({
      indexName: testIndexName,
      dimension,
    });

    const vectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    const metadata = [{ category: 'x' }, { category: 'y' }, { category: 'z' }];

    await cloudVector.upsert({
      indexName: testIndexName,
      vectors,
      metadata,
    });

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 15000);

  afterEach(async () => {
    // Cleanup after tests
    try {
      await cloudVector.deleteIndex({ indexName: testIndexName });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should search an index successfully', async () => {
    const results = await cloudVector.hybridSearch({
      indexName: testIndexName,
      queryVector: [1.0, 0.0, 0.0],
      topK: 2,
    });

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(2);
    // Verify structure of results
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('score');
    expect(results[0]).toHaveProperty('metadata');
  }, 10000);
});
