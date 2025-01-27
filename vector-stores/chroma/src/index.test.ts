import { QueryResult, IndexStats } from '@mastra/core';

import { ChromaVector } from './';

describe('ChromaVector Integration Tests', () => {
  let vectorDB: ChromaVector;
  const testIndexName = 'test-index';
  const dimension = 3;

  beforeEach(async () => {
    vectorDB = new ChromaVector({
      path: 'http://localhost:8000',
    });
    // Clean up any existing test index
    try {
      await vectorDB.deleteIndex(testIndexName);
    } catch (error) {
      // Ignore errors if index doesn't exist
    }
    await vectorDB.createIndex(testIndexName, dimension);
  }, 5000);

  afterEach(async () => {
    // Cleanup after tests
    try {
      await vectorDB.deleteIndex(testIndexName);
    } catch (error) {
      // Ignore cleanup errors
    }
  }, 5000);

  describe('Index Management', () => {
    test('should create and list indexes', async () => {
      const indexes = await vectorDB.listIndexes();
      expect(indexes).toContain(testIndexName);
    });

    test('should describe index correctly', async () => {
      const stats: IndexStats = await vectorDB.describeIndex(testIndexName);
      expect(stats.dimension).toBe(dimension);
      expect(stats.count).toBe(0);
      expect(stats.metric).toBe('cosine');
    });

    test('should delete index', async () => {
      await vectorDB.deleteIndex(testIndexName);
      const indexes = await vectorDB.listIndexes();
      expect(indexes).not.toContain(testIndexName);
    });

    test('should create index with different metrics', async () => {
      const metricsToTest: Array<'cosine' | 'euclidean' | 'dotproduct'> = ['euclidean', 'dotproduct'];

      for (const metric of metricsToTest) {
        const testIndex = `test-index-${metric}`;
        await vectorDB.createIndex(testIndex, dimension, metric);

        const stats = await vectorDB.describeIndex(testIndex);
        expect(stats.metric).toBe(metric);

        await vectorDB.deleteIndex(testIndex);
      }
    });
  });

  describe('Vector Operations', () => {
    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];
    const testIds = ['vec1', 'vec2', 'vec3'];

    test('should upsert vectors with generated ids', async () => {
      const ids = await vectorDB.upsert(testIndexName, testVectors);
      expect(ids).toHaveLength(testVectors.length);
      ids.forEach(id => expect(typeof id).toBe('string'));

      const stats = await vectorDB.describeIndex(testIndexName);
      expect(stats.count).toBe(testVectors.length);
    });

    test('should upsert vectors with provided ids and metadata', async () => {
      await vectorDB.upsert(testIndexName, testVectors, testMetadata, testIds);

      const stats = await vectorDB.describeIndex(testIndexName);
      expect(stats.count).toBe(testVectors.length);

      // Query each vector to verify metadata
      for (let i = 0; i < testVectors.length; i++) {
        const results = await vectorDB.query(testIndexName, testVectors?.[i]!, 1);
        expect(results?.[0]?.id).toBe(testIds[i]);
        expect(results?.[0]?.metadata).toEqual(testMetadata[i]);
      }
    });

    test('should perform vector search with topK', async () => {
      await vectorDB.upsert(testIndexName, testVectors, testMetadata, testIds);

      const queryVector = [1.0, 0.1, 0.1];
      const topK = 2;

      const results: QueryResult[] = await vectorDB.query(testIndexName, queryVector, topK);

      expect(results).toHaveLength(topK);
      expect(results?.[0]?.id).toBe(testIds[0]); // Should match x-axis vector most closely
    });

    test('should filter query results', async () => {
      await vectorDB.upsert(testIndexName, testVectors, testMetadata, testIds);

      const queryVector = [1.0, 1.0, 1.0];
      const filter = { label: 'x-axis' };

      const results = await vectorDB.query(testIndexName, queryVector, 3, filter);

      expect(results).toHaveLength(1);
      expect(results?.[0]?.metadata?.label).toBe('x-axis');
    });

    test('should include vector in query results', async () => {
      await vectorDB.upsert(testIndexName, testVectors, testMetadata, testIds);

      const queryVector = [1.0, 0.1, 0.1];
      const topK = 1;

      const results = await vectorDB.query(testIndexName, queryVector, topK, undefined, true);

      expect(results).toHaveLength(topK);
      expect(results?.[0]?.vector).toEqual(testVectors[0]);
    });

    test('should update existing vectors', async () => {
      // Initial upsert
      await vectorDB.upsert(testIndexName, testVectors, testMetadata, testIds);

      // Update first vector
      const updatedVector = [[0.5, 0.5, 0.0]];
      const updatedMetadata = [{ label: 'updated-x-axis' }];
      await vectorDB.upsert(testIndexName, updatedVector, updatedMetadata, [testIds?.[0]!]);

      // Verify update
      const results = await vectorDB.query(testIndexName, updatedVector?.[0]!, 1);
      expect(results?.[0]?.id).toBe(testIds[0]);
      expect(results?.[0]?.metadata).toEqual(updatedMetadata[0]);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent index queries', async () => {
      await expect(vectorDB.query('non-existent-index-yu', [1, 2, 3])).rejects.toThrow();
    });

    test('should handle invalid dimension vectors', async () => {
      const invalidVector = [1, 2, 3, 4]; // 4D vector for 3D index
      await expect(vectorDB.upsert(testIndexName, [invalidVector])).rejects.toThrow();
    });

    test('should handle mismatched metadata and vectors length', async () => {
      const vectors = [[1, 2, 3]];
      const metadata = [{}, {}]; // More metadata than vectors
      await expect(vectorDB.upsert(testIndexName, vectors, metadata)).rejects.toThrow();
    });
  });
});
