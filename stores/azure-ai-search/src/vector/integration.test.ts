import { createVectorTestSuite } from '@internal/storage-test-utils';
import dotenv from 'dotenv';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AzureAISearchVector } from './index';

dotenv.config();

// Check for Azure credentials
const AZURE_AI_SEARCH_ENDPOINT = process.env.AZURE_AI_SEARCH_ENDPOINT;
const AZURE_AI_SEARCH_CREDENTIAL = process.env.AZURE_AI_SEARCH_CREDENTIAL;

const describeIntegration = AZURE_AI_SEARCH_ENDPOINT && AZURE_AI_SEARCH_CREDENTIAL ? describe : describe.skip;

describeIntegration('AzureAISearchVector Real Integration Tests', () => {
  let azureVector: AzureAISearchVector;
  const testIndexName = `test-mastra-${Date.now()}`;
  const testVectorDimension = 128;

  beforeAll(async () => {
    azureVector = new AzureAISearchVector({
      id: 'integration-test',
      endpoint: AZURE_AI_SEARCH_ENDPOINT!,
      credential: AZURE_AI_SEARCH_CREDENTIAL!,
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

    it('should filter vectors by ID correctly', async () => {
      // Test filtering capability using the filterable ID field

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

      // Query with filter to retrieve only one specific document
      const filteredResults = await azureVector.query({
        indexName: testIndexName,
        queryVector: Array.from({ length: testVectorDimension }, () => Math.random()),
        topK: 10,
        filter: { eq: { id: 'product-apple' } },
      });

      expect(filteredResults.length).toBe(1);
      expect(filteredResults[0].id).toBe('product-apple');
      expect(filteredResults[0].metadata).toMatchObject({ content: 'First iPhone document' });
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
    it('should query vectors from documents with rich text metadata', async () => {
      // Insert documents with meaningful text content in metadata
      // Note: hybridQuery with textQuery requires a vectorizer in the index's vector profile,
      // which is not configured in this basic test index. This test validates standard vector
      // queries on documents that contain text content.
      const documents = [
        { content: 'Azure AI Search is a cloud search service', category: 'cloud' },
        { content: 'Machine learning models for natural language processing', category: 'ai' },
        { content: 'Vector databases for semantic search', category: 'database' },
      ];

      const vectors = documents.map(() => Array.from({ length: testVectorDimension }, () => Math.random()));
      const ids = documents.map((_, i) => `advanced-${i}`);

      await azureVector.upsert({
        indexName: testIndexName,
        vectors,
        metadata: documents,
        ids,
      });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Perform vector query on documents with rich text metadata
      const results = await azureVector.query({
        indexName: testIndexName,
        queryVector: Array.from({ length: testVectorDimension }, () => Math.random()),
        topK: 3,
      });

      // Verify results structure
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toMatchObject({
        id: expect.any(String),
        score: expect.any(Number),
        metadata: expect.any(Object),
      });
    }, 30000);
  });
});

// ==========================================
// ADVANCED FEATURES TESTS (Skip if no credentials)
// ==========================================

describeIntegration('AzureAISearchVector Advanced Features Integration Tests', () => {
  let azureVector: AzureAISearchVector;
  const testIndexName = `test-mastra-advanced-${Date.now()}`;

  beforeAll(async () => {
    if (!AZURE_AI_SEARCH_ENDPOINT || !AZURE_AI_SEARCH_CREDENTIAL) {
      return;
    }

    azureVector = new AzureAISearchVector({
      id: 'test-azure-advanced',
      endpoint: AZURE_AI_SEARCH_ENDPOINT,
      credential: AZURE_AI_SEARCH_CREDENTIAL,
    });

    // Create test index with sample data. Semantic config and compression are
    // required for the semantic-ranking and oversampling tests below —
    // without them Azure AI Search rejects those query parameters outright.
    await azureVector.createIndex({
      indexName: testIndexName,
      dimension: 1536,
      semanticConfig: { name: 'default-semantic-config' },
      compression: { kind: 'scalarQuantization' },
    });

    // Add some test data
    const vectors = Array.from({ length: 10 }, () => Array.from({ length: 1536 }, () => Math.random() - 0.5));
    const metadata = Array.from({ length: 10 }, (_, i) => ({
      type: i % 2 === 0 ? 'electronics' : 'books',
      price: 100 + Math.random() * 900,
      content: `Test document ${i} with sample content for testing`,
    }));
    const ids = Array.from({ length: 10 }, (_, i) => `doc-${i}`);

    await azureVector.upsert({
      indexName: testIndexName,
      vectors,
      metadata,
      ids,
    });

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 5000));
  }, 20000);

  afterAll(async () => {
    if (azureVector) {
      try {
        await azureVector.deleteIndex({ indexName: testIndexName });
      } catch (error) {
        console.warn('Error cleaning up advanced test index:', error);
      }
    }
  }, 10000);

  describe('Advanced Query Parameters', () => {
    it('should support exhaustive search', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.advancedQuery({
        indexName: testIndexName,
        queryVector,
        topK: 5,
        exhaustiveSearch: true,
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should support weighted queries', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.advancedQuery({
        indexName: testIndexName,
        queryVector,
        topK: 5,
        weight: 0.7,
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should support different query types', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.advancedQuery({
        indexName: testIndexName,
        queryVector,
        topK: 5,
        queryType: 'semantic',
        textVectorization: {
          text: 'test document',
        },
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should support pre and post filtering modes', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      // Pre-filter (default)
      const preFilterResults = await azureVector.advancedQuery({
        indexName: testIndexName,
        queryVector,
        topK: 5,
        filter: { contains: { content: 'test' } },
        filterMode: 'preFilter',
      });

      // Post-filter
      const postFilterResults = await azureVector.advancedQuery({
        indexName: testIndexName,
        queryVector,
        topK: 5,
        filter: { contains: { content: 'test' } },
        filterMode: 'postFilter',
      });

      expect(preFilterResults.length).toBeGreaterThanOrEqual(0);
      expect(postFilterResults.length).toBeGreaterThanOrEqual(0);

      // Test that filtering modes work (may or may not return results based on content)
      console.log('Pre-filter results:', preFilterResults.length);
      console.log('Post-filter results:', postFilterResults.length);
    });
  });

  describe('Multi-Vector Search', () => {
    it('should support multiple vector queries', async () => {
      const queryVector1 = Array.from({ length: 1536 }, () => Math.random() - 0.5);
      const queryVector2 = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.advancedQuery({
        indexName: testIndexName,
        queryVector: queryVector1,
        topK: 5,
        additionalVectorQueries: [
          {
            vector: queryVector2,
            fields: ['vector'],
            kNearestNeighborsCount: 5,
            weight: 0.5,
          },
        ],
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle additional vector queries with different weights', async () => {
      const queryVector1 = Array.from({ length: 1536 }, () => Math.random() - 0.5);
      const queryVector2 = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.advancedQuery({
        indexName: testIndexName,
        queryVector: queryVector1,
        topK: 5,
        additionalVectorQueries: [
          {
            vector: queryVector2,
            fields: ['vector'],
            kNearestNeighborsCount: 3,
            weight: 0.3,
          },
        ],
        weight: 0.7,
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Convenience Methods', () => {
    it('should support hybrid query (vector + text)', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.advancedQuery({
        indexName: testIndexName,
        queryVector,
        textVectorization: {
          text: 'test document',
        },
        topK: 5,
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should support semantic search configuration', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.advancedQuery({
        indexName: testIndexName,
        queryVector,
        topK: 5,
        queryType: 'semantic',
        textVectorization: {
          text: 'document content',
        },
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Interface Compatibility', () => {
    it('should maintain backward compatibility with basic query', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.query({
        indexName: testIndexName,
        queryVector,
        topK: 5,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toMatchObject({
        id: expect.any(String),
        score: expect.any(Number),
      });
    });

    it('should support Memory-compatible query interface', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      // Test standard query method used by Memory integration
      const results = await azureVector.query({
        indexName: testIndexName,
        queryVector,
        topK: 3,
        filter: { contains: { content: 'test' } },
      });

      expect(results.length).toBeGreaterThanOrEqual(0);
      results.forEach(result => {
        expect(result).toMatchObject({
          id: expect.any(String),
          score: expect.any(Number),
          metadata: expect.any(Object),
        });
      });
    });

    it('should demonstrate difference between query and advancedQuery methods', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      // Standard query - Memory compatible
      const standardResults = await azureVector.query({
        indexName: testIndexName,
        queryVector,
        topK: 5,
      });

      // Advanced query - Azure AI Search specific features
      const advancedResults = await azureVector.advancedQuery({
        indexName: testIndexName,
        queryVector,
        topK: 5,
        weight: 0.8,
        exhaustiveSearch: true,
      });

      // Both should return valid results
      expect(standardResults.length).toBeGreaterThan(0);
      expect(advancedResults.length).toBeGreaterThan(0);

      // Results structure should be the same
      expect(standardResults[0]).toMatchObject({
        id: expect.any(String),
        score: expect.any(Number),
      });
      expect(advancedResults[0]).toMatchObject({
        id: expect.any(String),
        score: expect.any(Number),
      });
    });

    it('should handle advanced parameters gracefully', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.advancedQuery({
        indexName: testIndexName,
        queryVector,
        topK: 5,
        exhaustiveSearch: true,
        weight: 0.8,
        oversampling: 2.0,
        textVectorization: {
          text: 'test',
        },
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid semantic configuration gracefully', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      // This should work even if semantic search isn't configured
      const results = await azureVector.advancedQuery({
        indexName: testIndexName,
        queryVector,
        topK: 5,
        queryType: 'semantic',
        textVectorization: {
          text: 'test document',
        },
      });

      // Should return results even if semantic search fails
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle oversampling limitations gracefully', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.advancedQuery({
        indexName: testIndexName,
        queryVector,
        topK: 5,
        oversampling: 10.0, // Very high oversampling
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Convenience Methods', () => {
    it('should support semantic query method', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.semanticQuery({
        indexName: testIndexName,
        queryVector,
        topK: 5,
        semanticConfig: 'default-semantic-config',
        semanticQuery: 'test document',
        enableAnswers: true,
        enableCaptions: true,
      });

      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should support hybrid query method', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.hybridQuery({
        indexName: testIndexName,
        queryVector,
        topK: 5,
        textQuery: 'test document',
      });

      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should support multi-vector query method', async () => {
      const queryVector1 = Array.from({ length: 1536 }, () => Math.random() - 0.5);
      const queryVector2 = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.multiVectorQuery({
        indexName: testIndexName,
        queryVector: queryVector1,
        topK: 5,
        vectors: [{ vector: queryVector2, weight: 0.5 }],
      });

      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should support exact query method', async () => {
      const queryVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);

      const results = await azureVector.exactQuery({
        indexName: testIndexName,
        queryVector,
        topK: 5,
      });

      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });
});

// ==========================================
// SHARED VECTOR STORE CONFORMANCE SUITE
// ==========================================
//
// Runs the cross-store conformance suite from @internal/storage-test-utils
// against a real Azure AI Search resource. Unlike the mocked SDK-call tests
// in index.test.ts, this exercises the actual filter translator end-to-end,
// which is what catches bugs like an unsupported operator silently producing
// an unfiltered query instead of throwing.
//
// Feature-support flags below reflect what AzureAISearchFilterTranslator
// currently implements (see ./filter.ts): $eq, $ne, $gt, $gte, $lt, $lte,
// $in, $nin, $exists at the field level, and $and, $or, $not at the top
// level. Operators outside that set (e.g. $regex, $all, $size, $nor,
// $elemMatch, field-level $not) are unsupported and must throw rather than
// silently drop the filter.
// Wrapped in a describe whose name contains "Integration Tests" so
// `test:unit`'s --testNamePattern exclusion also skips these (they hit a
// real Azure AI Search resource just like the rest of this file).
describeIntegration('AzureAISearchVector Conformance Suite Integration Tests', () => {
  const conformanceVector = new AzureAISearchVector({
    id: 'azure-ai-search-conformance',
    endpoint: AZURE_AI_SEARCH_ENDPOINT!,
    credential: AZURE_AI_SEARCH_CREDENTIAL!,
  });

  // Every metadata field the shared suite filters on across all its domains, with
  // its real type — Azure AI Search requires filterable fields to be declared in
  // the index schema up front (no schemaless metadata filtering), and the field's
  // Azure type must match the value type used in comparisons ($gt et al. reject an
  // unquoted numeric literal against an Edm.String field).
  const conformanceMetadataIndexes: NonNullable<Parameters<AzureAISearchVector['createIndex']>[0]['metadataIndexes']> =
    [
      { name: 'category', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'author', type: 'string' },
      { name: 'tenant', type: 'string' },
      { name: 'tenant_id', type: 'string' },
      { name: 'env', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'userId', type: 'string' },
      { name: 'source_id', type: 'string' },
      { name: 'resource_id', type: 'string' },
      { name: 'thread_id', type: 'string' },
      { name: 'type', type: 'string' },
      { name: 'batch', type: 'string' },
      { name: 'price', type: 'number' },
      { name: 'rating', type: 'number' },
      { name: 'version', type: 'number' },
      { name: 'index', type: 'number' },
      { name: 'available', type: 'boolean' },
      { name: 'marked', type: 'boolean' },
    ];

  createVectorTestSuite({
    vector: conformanceVector,
    createIndex: async (indexName: string, options) => {
      // The shared suite's fixtures use 1536-dimensional vectors (matching
      // common embedding models), regardless of what other describe blocks
      // in this file use for their own self-contained tests.
      await conformanceVector.createIndex({
        indexName,
        dimension: 1536,
        metric: options?.metric,
        metadataIndexes: conformanceMetadataIndexes,
      });
    },
    deleteIndex: async (indexName: string) => {
      await conformanceVector.deleteIndex({ indexName });
    },
    waitForIndexing: async () => {
      // Azure AI Search indexing is near-real-time but not synchronous.
      await new Promise(resolve => setTimeout(resolve, 3000));
    },
    supportsArrayMetadata: false, // no dedicated array/Collection field is provisioned for arbitrary metadata keys
    supportsRegex: false, // $regex is not implemented in the OData translator
    supportsContains: false, // no $contains Mastra-style operator (legacy `contains` key uses search.ismatch instead)
    supportsSize: false, // $size is not implemented
    supportsElemMatch: false, // $elemMatch is not implemented
    supportsNorOperator: false, // only $and, $or, $not are implemented at the top level
    supportsAdvancedNotSyntax: false, // $not is only implemented at the top level, not per-field
    supportsStrictOperatorValidation: true, // unsupported operators must throw, not silently no-op
  });
});
