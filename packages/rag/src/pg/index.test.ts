import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

import { PgVector } from './';

describe('PgVector', () => {
  let pgVector: PgVector;
  const testIndexName = 'test_vectors';
  const testIndexName2 = 'test_vectors1';
  const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5433/mastra';

  beforeAll(async () => {
    // Initialize PgVector
    pgVector = new PgVector(connectionString);
  });

  afterAll(async () => {
    // Clean up test tables

    await pgVector.deleteIndex(testIndexName);

    await pgVector.disconnect();
  });

  describe('createIndex', () => {
    afterAll(async () => {
      await pgVector.deleteIndex(testIndexName2);
    });

    it('should create a new vector table with specified dimensions', async () => {
      await pgVector.createIndex(testIndexName, 3);

      const stats = await pgVector.describeIndex(testIndexName);
      expect(stats.dimension).toBe(3);
      expect(stats.count).toBe(0);
    });

    it('should create index with specified metric', async () => {
      await pgVector.createIndex(testIndexName2, 3, 'euclidean');

      const stats = await pgVector.describeIndex(testIndexName2);

      expect(stats.metric).toBe('euclidean');
    });

    it('should throw error if dimension is invalid', async () => {
      await expect(pgVector.createIndex(`testIndexNameFail`, 0)).rejects.toThrow();
    });
  });

  describe('upsert', () => {
    beforeEach(async () => {
      await pgVector.createIndex(testIndexName, 3);
    });

    afterEach(async () => {
      await pgVector.deleteIndex(testIndexName);
    });

    it('should insert new vectors', async () => {
      const vectors = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      const ids = await pgVector.upsert(testIndexName, vectors);

      expect(ids).toHaveLength(2);
      const stats = await pgVector.describeIndex(testIndexName);
      expect(stats.count).toBe(2);
    });

    it('should update existing vectors', async () => {
      const vectors = [[1, 2, 3]];
      const metadata = [{ test: 'initial' }];
      const [id] = await pgVector.upsert(testIndexName, vectors, metadata);

      // Update the same vector
      const updatedVectors = [[4, 5, 6]];
      const updatedMetadata = [{ test: 'updated' }];
      await pgVector.upsert(testIndexName, updatedVectors, updatedMetadata, [id]);

      const results = await pgVector.query(testIndexName, [4, 5, 6], 1);
      expect(results[0].id).toBe(id);
      expect(results[0].metadata).toEqual({ test: 'updated' });
    });

    it('should handle metadata correctly', async () => {
      const vectors = [[1, 2, 3]];
      const metadata = [{ test: 'value', num: 123 }];

      const [id] = await pgVector.upsert(testIndexName, vectors, metadata);
      const results = await pgVector.query(testIndexName, [1, 2, 3], 1);

      expect(results[0].metadata).toEqual(metadata[0]);
    });

    it('should throw error if vector dimensions dont match', async () => {
      const vectors = [[1, 2, 3, 4]]; // 4D vector for 3D index
      await expect(pgVector.upsert(testIndexName, vectors)).rejects.toThrow();
    });
  });

  describe('query', () => {
    const indexName = 'test_query_2';
    beforeAll(async () => {
      // Drop if exists first
      try {
        await pgVector.deleteIndex(indexName);
      } catch (e) {
        // Ignore if doesn't exist
      }

      // Create fresh
      await pgVector.createIndex(indexName, 3);
    });

    beforeEach(async () => {
      // Clear the table first
      await pgVector.truncateIndex(indexName);

      const vectors = [
        [1, 0, 0],
        [0.8, 0.2, 0],
        [0, 1, 0],
      ];
      const metadata = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      await pgVector.upsert(indexName, vectors, metadata);
    });

    afterAll(async () => {
      console.log('deleting index');
      console.log(await pgVector.listIndexes());
      await pgVector.deleteIndex(indexName);
      console.log(await pgVector.listIndexes());
    });

    it('should return closest vectors', async () => {
      const results = await pgVector.query(indexName, [1, 0, 0], 1);
      expect(results).toHaveLength(1);
      expect(results[0].score).toBeCloseTo(1, 5);
    });

    it('should respect topK parameter', async () => {
      const results = await pgVector.query(indexName, [1, 0, 0], 2);
      expect(results).toHaveLength(2);
    });

    it('should handle filters correctly', async () => {
      const results = await pgVector.query(indexName, [1, 0, 0], 10, { type: 'a' });

      expect(results).toHaveLength(1);
      results.forEach(result => {
        expect(result?.metadata?.type).toBe('a');
      });
    });
  });

  describe('listIndexes', () => {
    const indexName = 'test_query_3';
    beforeAll(async () => {
      await pgVector.createIndex(indexName, 3);
    });

    afterAll(async () => {
      await pgVector.deleteIndex(indexName);
    });

    it('should list all vector tables', async () => {
      const indexes = await pgVector.listIndexes();
      expect(indexes).toContain(indexName);
    });

    it('should return empty array when no indexes exist', async () => {
      await pgVector.deleteIndex(indexName);
      const indexes = await pgVector.listIndexes();
      expect(indexes).toEqual([]);
    });
  });

  describe('describeIndex', () => {
    const indexName = 'test_query_4';
    beforeAll(async () => {
      await pgVector.createIndex(indexName, 3);
    });

    afterAll(async () => {
      await pgVector.deleteIndex(indexName);
    });
    it('should return correct index stats', async () => {
      await pgVector.createIndex(indexName, 3, 'cosine');
      const vectors = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      await pgVector.upsert(indexName, vectors);

      const stats = await pgVector.describeIndex(indexName);
      expect(stats).toEqual({
        dimension: 3,
        count: 2,
        metric: 'cosine',
      });
    });

    it('should throw error for non-existent index', async () => {
      await expect(pgVector.describeIndex('non_existent')).rejects.toThrow();
    });
  });
});
