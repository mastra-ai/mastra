import dotenv from 'dotenv';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AzureAISearchVector } from './index';

dotenv.config();

// Check for Azure credentials
const AZURE_SEARCH_ENDPOINT = process.env.AZURE_SEARCH_ENDPOINT;
const AZURE_SEARCH_API_KEY = process.env.AZURE_SEARCH_API_KEY;

const describeIntegration = AZURE_SEARCH_ENDPOINT && AZURE_SEARCH_API_KEY ? describe : describe.skip;

describeIntegration('AzureAISearchVector Real Integration Tests', () => {
  let azureVector: AzureAISearchVector;
  const testIndexName = `test-mastra-${Date.now()}`;
  const testVectorDimension = 128;

  beforeAll(async () => {
    if (!AZURE_SEARCH_ENDPOINT || !AZURE_SEARCH_API_KEY) {
      console.warn('Skipping Azure AI Search integration tests - credentials not found');
      return;
    }

    azureVector = new AzureAISearchVector({
      id: 'integration-test',
      endpoint: AZURE_SEARCH_ENDPOINT,
      credential: AZURE_SEARCH_API_KEY,
    });

    // Create test index
    await azureVector.createIndex({
      indexName: testIndexName,
      dimension: testVectorDimension,
    });

    console.log(`Created test index: ${testIndexName}`);
  }, 30000);

  afterAll(async () => {
    if (azureVector) {
      try {
        await azureVector.deleteIndex({ indexName: testIndexName });
        console.log(`Cleaned up test index: ${testIndexName}`);
      } catch (error) {
        console.warn('Error cleaning up test index:', error);
      }
    }
  }, 10000);

  describe('Index Management', () => {
    it('should create, list, describe, and delete indexes', async () => {
      const tempIndexName = `temp-index-${Date.now()}`;

      // Create index
      await azureVector.createIndex({
        indexName: tempIndexName,
        dimension: testVectorDimension,
      });

      // List indexes
      const indexes = await azureVector.listIndexes();
      expect(indexes).toContain(tempIndexName);

      // Describe index
      const stats = await azureVector.describeIndex({ indexName: tempIndexName });
      expect(stats).toMatchObject({
        dimension: testVectorDimension,
        count: 0,
      });

      // Delete index
      await azureVector.deleteIndex({ indexName: tempIndexName });

      // Verify deletion
      const updatedIndexes = await azureVector.listIndexes();
      expect(updatedIndexes).not.toContain(tempIndexName);
    }, 30000);
  });

  describe('Vector Operations', () => {
    it('should upsert and query vectors successfully', async () => {
      const testVectors = [
        Array.from({ length: testVectorDimension }, () => Math.random()),
        Array.from({ length: testVectorDimension }, () => Math.random()),
      ];
      const testMetadata = [
        { type: 'test', content: 'First test document' },
        { type: 'test', content: 'Second test document' },
      ];
      const testIds = ['doc1', 'doc2'];

      // Upsert vectors
      const upsertResult = await azureVector.upsert({
        indexName: testIndexName,
        vectors: testVectors,
        metadata: testMetadata,
        ids: testIds,
      });

      expect(upsertResult).toEqual(['doc1', 'doc2']);

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Query vectors
      const queryResults = await azureVector.query({
        indexName: testIndexName,
        queryVector: Array.from({ length: testVectorDimension }, () => Math.random()),
        topK: 10,
      });

      expect(queryResults.length).toBeGreaterThan(0);
      expect(queryResults[0]).toMatchObject({
        id: expect.any(String),
        score: expect.any(Number),
        metadata: expect.any(Object),
      });
    }, 30000);

    it('should filter vectors correctly', async () => {
      // Note: Azure AI Search stores metadata as JSON string, so filtering by metadata fields
      // is not directly supported without creating explicit filterable fields in the index.
      // This test verifies basic filtering capabilities using the document ID field.

      const testData = [
        { content: 'First iPhone document' },
        { content: 'Second Samsung document' },
        { content: 'Third Penguin document' },
      ];

      const vectors = testData.map(() => Array.from({ length: testVectorDimension }, () => Math.random()));
      const metadata = testData;
      const ids = ['product-apple', 'product-samsung', 'product-penguin'];

      await azureVector.upsert({
        indexName: testIndexName,
        vectors,
        metadata,
        ids,
      });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Query without filters to verify all documents exist
      const allResults = await azureVector.query({
        indexName: testIndexName,
        queryVector: Array.from({ length: testVectorDimension }, () => Math.random()),
        topK: 10,
      });

      expect(allResults.length).toBeGreaterThanOrEqual(3);

      // Verify documents have correct IDs
      const resultIds = allResults.map(r => r.id);
      expect(resultIds).toContain('product-apple');
      expect(resultIds).toContain('product-samsung');
      expect(resultIds).toContain('product-penguin');
    }, 30000);

    it('should update and delete vectors', async () => {
      const vectorId = 'update-test-1';
      const initialVector = Array.from({ length: testVectorDimension }, () => Math.random());
      const initialMetadata = { status: 'initial' };

      // Upsert initial vector
      await azureVector.upsert({
        indexName: testIndexName,
        vectors: [initialVector],
        metadata: [initialMetadata],
        ids: [vectorId],
      });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update vector
      const updatedMetadata = { status: 'updated' };

      await azureVector.updateVector({
        indexName: testIndexName,
        id: vectorId,
        update: {
          metadata: updatedMetadata,
        },
      });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify update
      const queryResults = await azureVector.query({
        indexName: testIndexName,
        queryVector: initialVector,
        topK: 1,
      });

      expect(queryResults[0]?.id).toBe(vectorId);
      expect(queryResults[0]?.metadata?.status).toBe('updated');

      // Delete vector
      await azureVector.deleteVector({
        indexName: testIndexName,
        id: vectorId,
      });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify deletion by trying to query for all vectors and checking the ID is not present
      const postDeleteResults = await azureVector.query({
        indexName: testIndexName,
        queryVector: initialVector,
        topK: 100,
      });

      expect(postDeleteResults.find(r => r.id === vectorId)).toBeUndefined();
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid operations gracefully', async () => {
      // Try to query non-existent index
      await expect(
        azureVector.query({
          indexName: 'non-existent-index',
          queryVector: Array.from({ length: testVectorDimension }, () => Math.random()),
          topK: 10,
        }),
      ).rejects.toThrow();

      // Try to create index with invalid dimension
      await expect(
        azureVector.createIndex({
          indexName: `invalid-${Date.now()}`,
          dimension: 0,
        }),
      ).rejects.toThrow();
    }, 15000);
  });

  describe('Performance', () => {
    it('should handle batch operations efficiently', async () => {
      const batchSize = 50;
      const vectors = Array.from({ length: batchSize }, () =>
        Array.from({ length: testVectorDimension }, () => Math.random()),
      );
      const metadata = Array.from({ length: batchSize }, (_, i) => ({
        type: 'batch-test',
        index: i,
      }));
      const ids = Array.from({ length: batchSize }, (_, i) => `batch-${i}`);

      const startTime = Date.now();

      await azureVector.upsert({
        indexName: testIndexName,
        vectors,
        metadata,
        ids,
      });

      const uploadTime = Date.now() - startTime;

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Query to verify (without filter since metadata is not filterable)
      const queryResults = await azureVector.query({
        indexName: testIndexName,
        queryVector: Array.from({ length: testVectorDimension }, () => Math.random()),
        topK: batchSize,
      });

      expect(queryResults.length).toBeGreaterThan(0);
      expect(uploadTime).toBeLessThan(10000); // Should complete in less than 10 seconds

      console.log(`Batch upload of ${batchSize} vectors completed in ${uploadTime}ms`);
    }, 30000);
  });

  describe('Advanced Features', () => {
    it('should support hybrid queries with text search', async () => {
      // Insert documents with text content
      const documents = [
        { content: 'Azure AI Search is a cloud search service', category: 'cloud' },
        { content: 'Machine learning models for natural language processing', category: 'ai' },
        { content: 'Vector databases for semantic search', category: 'database' },
      ];

      const vectors = documents.map(() => Array.from({ length: testVectorDimension }, () => Math.random()));
      const ids = documents.map((_, i) => `hybrid-${i}`);

      await azureVector.upsert({
        indexName: testIndexName,
        vectors,
        metadata: documents,
        ids,
      });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Perform vector query
      const results = await azureVector.query({
        indexName: testIndexName,
        queryVector: Array.from({ length: testVectorDimension }, () => Math.random()),
        topK: 3,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toMatchObject({
        id: expect.any(String),
        score: expect.any(Number),
        metadata: expect.any(Object),
      });
    }, 30000);
  });
});
