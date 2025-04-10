import type { QueryResult, IndexStats } from '@mastra/core/vector';
import { describe, expect, beforeEach, afterEach, it, beforeAll, afterAll, vi } from 'vitest';

import { MongoDBVector } from '@mastra/mongodb';
import type { MongoDBQueryVectorParams, MongoDBUpsertVectorParams } from '@mastra/mongodb';

describe('ChromaVector Integration Tests', () => {
  const mongoUri = 'mongodb://localhost:27017/?directConnection=true&serverSelectionTimeoutMS=2000';  
  const dbName = 'mastra_vector_db';  
  
  const vectorDB = new MongoDBVector({ uri: mongoUri, dbName });  
  

  const testIndexName = 'test-index';
  const dimension = 3;

  beforeEach(async () => {
    // Clean up any existing test index
    try {
      await vectorDB.deleteIndex(testIndexName);
    } catch {
      // Ignore errors if index doesn't exist
    }
    await vectorDB.createIndex({ indexName: testIndexName, dimension });
  }, 5000);

  afterEach(async () => {
    // Cleanup after tests
    try {
      await vectorDB.deleteIndex(testIndexName);
    } catch {
      // Ignore cleanup errors
    }
  }, 5000);

  describe('Index Management', () => {
    it('should create and list indexes', async () => {
      const indexes = await vectorDB.listIndexes();
      expect(indexes).toContain(testIndexName);
    });

    it('should describe index correctly', async () => {
      const stats: IndexStats = await vectorDB.describeIndex(testIndexName);
      expect(stats.dimension).toBe(dimension);
      expect(stats.count).toBe(0);
      expect(stats.metric).toBe('cosine');
    });

    it('should delete index', async () => {
      await vectorDB.deleteIndex(testIndexName);
      const indexes = await vectorDB.listIndexes();
      expect(indexes).not.toContain(testIndexName);
    });

    it('should create index with different metrics', async () => {
      const metricsToTest: Array<'cosine' | 'euclidean' | 'dotproduct'> = ['euclidean', 'dotproduct'];

      for (const metric of metricsToTest) {
        const testIndex = `test-index-${metric}`;
        await vectorDB.createIndex({ indexName: testIndex, dimension, metric });

        const stats = await vectorDB.describeIndex(testIndex);
        expect(stats.metric).toBe(metric);

        await vectorDB.deleteIndex(testIndex);
      }
    });
  });
});
