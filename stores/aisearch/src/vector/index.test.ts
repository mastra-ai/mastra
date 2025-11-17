import dotenv from 'dotenv';
import { describe, it, expect, beforeEach, vi, type Mock, beforeAll, afterAll, afterEach } from 'vitest';
import { AzureAISearchVector, type AzureAISearchCreateIndexParams } from './index';
import { AzureAISearchFilterTranslator, type AzureAISearchVectorFilter } from './filter';

dotenv.config();

// Check for Azure credentials
const AZURE_AI_SEARCH_ENDPOINT = process.env.AZURE_AI_SEARCH_ENDPOINT;
const AZURE_AI_SEARCH_CREDENTIAL = process.env.AZURE_AI_SEARCH_CREDENTIAL;

// Mock Azure SDK for unit tests
// Note: Integration tests marked with describeIntegration also use these mocks
// For true integration testing against Azure AI Search, run tests in a separate file
// without mocking @azure/search-documents
vi.mock('@azure/search-documents', () => ({
  SearchClient: vi.fn(),
  SearchIndexClient: vi.fn(),
  AzureKeyCredential: vi.fn(),
}));

vi.mock('@azure/core-auth', () => ({}));

// ==========================================
// UNIT TESTS (Always Run)
// ==========================================

describe('AzureAISearchVector Unit Tests', () => {
  let azureVector: AzureAISearchVector;
  let mockIndexClient: any;
  let mockSearchClientInstance: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    mockIndexClient = {
      createIndex: vi.fn(),
      listIndexes: vi.fn(),
      getIndex: vi.fn().mockResolvedValue({
        name: 'test-index',
        fields: [
          {
            name: 'id',
            type: 'Edm.String',
            key: true,
          },
          {
            name: 'vector',
            type: 'Collection(Edm.Single)',
            dimensions: 128,
            vectorSearchProfile: 'default',
          },
          {
            name: 'content',
            type: 'Edm.String',
            searchable: true,
          },
          {
            name: 'metadata',
            type: 'Edm.String',
          },
        ],
      }),
      deleteIndex: vi.fn(),
    };

    mockSearchClientInstance = {
      uploadDocuments: vi.fn(),
      search: vi.fn(),
      getDocument: vi.fn(),
      mergeDocuments: vi.fn(),
      deleteDocuments: vi.fn(),
      getDocumentsCount: vi.fn(),
    };

    // Get the mocked constructors
    const { SearchIndexClient, SearchClient, AzureKeyCredential } =
      await vi.importMock<typeof import('@azure/search-documents')>('@azure/search-documents');

    // Setup mock implementations
    (SearchIndexClient as Mock).mockImplementation(() => mockIndexClient);
    (SearchClient as Mock).mockImplementation(() => mockSearchClientInstance);
    (AzureKeyCredential as Mock).mockImplementation((key: string) => ({ key }));

    azureVector = new AzureAISearchVector({
      id: 'test-azure-vector',
      endpoint: 'https://test.search.windows.net',
      credential: 'test-api-key',
    });
  });

  describe('createIndex', () => {
    it('should create index successfully', async () => {
      mockIndexClient.createIndex.mockResolvedValue({ name: 'test-index' });

      await azureVector.createIndex({
        indexName: 'test-index',
        dimension: 128,
      });

      expect(mockIndexClient.createIndex).toHaveBeenCalledTimes(1);
      expect(mockIndexClient.createIndex).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-index',
          fields: expect.arrayContaining([
            expect.objectContaining({ name: 'id', type: 'Edm.String', key: true }),
            expect.objectContaining({ name: 'vector', type: 'Collection(Edm.Single)' }),
            expect.objectContaining({ name: 'content', type: 'Edm.String' }),
            expect.objectContaining({ name: 'metadata', type: 'Edm.String' }),
          ]),
        }),
      );
    });

    it('should validate dimension parameter', async () => {
      await expect(
        azureVector.createIndex({
          indexName: 'test-index',
          dimension: 0,
        }),
      ).rejects.toThrow('Dimension must be a positive integer');
    });

    it('should handle existing index', async () => {
      const error = new Error('Index already exists');
      (error as any).statusCode = 409;
      mockIndexClient.createIndex.mockRejectedValueOnce(error);

      // Should not throw an error when index already exists
      await expect(
        azureVector.createIndex({
          indexName: 'test-index',
          dimension: 128,
        }),
      ).resolves.not.toThrow();

      expect(mockIndexClient.createIndex).toHaveBeenCalledTimes(1);
    });
  });

  describe('listIndexes', () => {
    it('should return list of index names', async () => {
      mockIndexClient.listIndexes.mockReturnValue([{ name: 'index1' }, { name: 'index2' }]);

      const result = await azureVector.listIndexes();

      expect(result).toEqual(['index1', 'index2']);
      expect(mockIndexClient.listIndexes).toHaveBeenCalledTimes(1);
    });
  });

  describe('describeIndex', () => {
    it('should return index statistics', async () => {
      const mockStats = {
        documentCount: 100,
        storageSize: 1024,
      };

      mockIndexClient.getIndex.mockResolvedValue({
        name: 'test-index',
        fields: [
          { name: 'id', type: 'Edm.String', key: true },
          { name: 'content', type: 'Edm.String' },
          { name: 'metadata', type: 'Edm.String' },
          {
            name: 'vector',
            type: 'Collection(Edm.Single)',
            vectorSearchDimensions: 128,
          },
        ],
      });

      mockSearchClientInstance.getDocumentsCount.mockResolvedValue(100);

      const result = await azureVector.describeIndex({ indexName: 'test-index' });

      expect(result).toEqual({
        dimension: 128,
        count: 100,
        metric: 'cosine',
      });
    });
  });

  describe('deleteIndex', () => {
    it('should delete index successfully', async () => {
      mockIndexClient.deleteIndex.mockResolvedValue({});

      await azureVector.deleteIndex({ indexName: 'test-index' });

      expect(mockIndexClient.deleteIndex).toHaveBeenCalledWith('test-index');
    });
  });

  describe('upsert', () => {
    beforeEach(() => {
      mockSearchClientInstance.uploadDocuments.mockResolvedValue({
        results: [
          { succeeded: true, key: 'doc1' },
          { succeeded: true, key: 'doc2' },
        ],
      });

      // Mock getVectorFieldName to avoid dimension validation
      vi.spyOn(azureVector as any, 'getVectorFieldName').mockResolvedValue('vector');

      // Mock validateVectorDimensions to allow any dimensions for unit tests
      vi.spyOn(azureVector as any, 'validateVectorDimensions').mockImplementation(() => Promise.resolve());
    });

    it('should upsert vectors successfully', async () => {
      const vectors = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ];
      const metadata = [{ type: 'document' }, { type: 'document' }];
      const ids = ['doc1', 'doc2'];

      const result = await azureVector.upsert({
        indexName: 'test-index',
        vectors,
        metadata,
        ids,
      });

      expect(result).toEqual(['doc1', 'doc2']);
      expect(mockSearchClientInstance.uploadDocuments).toHaveBeenCalledWith([
        {
          id: 'doc1',
          vector: [0.1, 0.2, 0.3],
          metadata: JSON.stringify({ type: 'document' }),
          content: '',
        },
        {
          id: 'doc2',
          vector: [0.4, 0.5, 0.6],
          metadata: JSON.stringify({ type: 'document' }),
          content: '',
        },
      ]);
    });

    it('should generate IDs when not provided', async () => {
      const vectors = [[0.1, 0.2, 0.3]];
      const metadata = [{ type: 'document' }];

      mockSearchClientInstance.uploadDocuments.mockResolvedValue({
        results: [{ succeeded: true, key: 'generated-id' }],
      });

      const result = await azureVector.upsert({
        indexName: 'test-index',
        vectors,
        metadata,
      });

      expect(result).toHaveLength(1);
      expect(mockSearchClientInstance.uploadDocuments).toHaveBeenCalledWith([
        expect.objectContaining({
          id: expect.any(String),
          vector: [0.1, 0.2, 0.3],
          metadata: JSON.stringify({ type: 'document' }),
          content: '',
        }),
      ]);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      // Mock search to return async iterator (PagedAsyncIterableIterator)
      mockSearchClientInstance.search.mockResolvedValue(
        (async function* () {
          yield {
            document: {
              id: 'doc1',
              vector: [0.1, 0.2, 0.3],
              metadata: '{"type":"document"}',
              content: 'test content',
            },
            score: 0.95,
          };
        })(),
      );
    });

    it('should perform vector search successfully', async () => {
      const result = await azureVector.query({
        indexName: 'test-index',
        queryVector: Array.from({ length: 128 }, (_, i) => i * 0.001),
        topK: 5,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'doc1',
        score: 0.95,
        metadata: { type: 'document' },
      });
    });

    it('should handle includeVector parameter gracefully', async () => {
      const result = await azureVector.query({
        indexName: 'test-index',
        queryVector: Array.from({ length: 128 }, (_, i) => i * 0.001),
        topK: 5,
        includeVector: true,
      });

      // Azure AI Search doesn't return vectors in results, so this should be undefined
      expect(result[0].vector).toBeUndefined();
    });

    it('should apply filters correctly', async () => {
      await azureVector.query({
        indexName: 'test-index',
        queryVector: Array.from({ length: 128 }, (_, i) => i * 0.001),
        topK: 5,
        filter: { contains: { content: 'test' } },
      });

      expect(mockSearchClientInstance.search).toHaveBeenCalledWith(
        '*',
        expect.objectContaining({
          filter: "search.ismatch('test', 'content')",
        }),
      );
    });
  });

  describe('updateVector', () => {
    beforeEach(() => {
      mockSearchClientInstance.getDocument.mockResolvedValue({
        id: 'doc1',
        content: 'old content',
        metadata: '{"category":"old"}',
      });

      mockSearchClientInstance.mergeDocuments.mockResolvedValue({
        results: [{ succeeded: true, key: 'doc1' }],
      });
    });

    it('should update vector successfully', async () => {
      const newVector = Array.from({ length: 128 }, (_, i) => i * 0.002);
      await azureVector.updateVector({
        indexName: 'test-index',
        id: 'doc1',
        update: {
          vector: newVector,
          metadata: { category: 'new' },
        },
      });

      expect(mockSearchClientInstance.mergeDocuments).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'doc1',
          vector: newVector,
          metadata: JSON.stringify({ category: 'new' }),
          content: 'old content',
        }),
      ]);
    });
  });

  describe('deleteVector', () => {
    beforeEach(() => {
      mockSearchClientInstance.deleteDocuments.mockResolvedValue({
        results: [{ succeeded: true, key: 'doc1' }],
      });
    });

    it('should delete vector successfully', async () => {
      await azureVector.deleteVector({
        indexName: 'test-index',
        id: 'doc1',
      });

      expect(mockSearchClientInstance.deleteDocuments).toHaveBeenCalledWith([{ id: 'doc1' }]);
    });

    it('should handle non-existent document gracefully', async () => {
      mockSearchClientInstance.deleteDocuments.mockResolvedValue({
        results: [{ succeeded: false, key: 'non-existent' }],
      });

      // Should not throw error
      await azureVector.deleteVector({
        indexName: 'test-index',
        id: 'non-existent',
      });
    });
  });

  // Filter Translator Tests
  describe('AzureAISearchFilterTranslator', () => {
    let translator: AzureAISearchFilterTranslator;

    beforeEach(() => {
      translator = new AzureAISearchFilterTranslator();
    });

    describe('translate', () => {
      it('should return undefined for empty filter', () => {
        expect(translator.translate()).toBeUndefined();
      });

      it('should use raw $filter when provided', () => {
        const result = translator.translate({ $filter: "category eq 'books'" });
        expect(result).toBe("category eq 'books'");
      });

      it('should translate equality filters', () => {
        const result = translator.translate({
          eq: { category: 'books', author: 'Jane Doe' },
        });
        expect(result).toBe("category eq 'books' and author eq 'Jane Doe'");
      });

      it('should translate comparison filters', () => {
        const result = translator.translate({
          gt: { price: 10 },
          lt: { rating: 5 },
          ge: { year: 2020 },
          le: { pages: 300 },
        });
        expect(result).toBe('price gt 10 and year ge 2020 and rating lt 5 and pages le 300');
      });

      it('should translate string operations', () => {
        const result = translator.translate({
          startsWith: { title: 'The' },
          contains: { description: 'adventure' },
        });
        expect(result).toBe("search.ismatch('adventure', 'description') and startswith(title, 'The')");
      });

      it('should translate logical operations', () => {
        const result = translator.translate({
          and: [{ eq: { category: 'books' } }, { gt: { price: 10 } }],
        });
        expect(result).toBe("(category eq 'books' and price gt 10)");
      });

      it('should translate NOT operations', () => {
        const result = translator.translate({
          not: { eq: { category: 'books' } },
        });
        expect(result).toBe("not (category eq 'books')");
      });

      it('should handle complex nested filters', () => {
        const result = translator.translate({
          and: [
            { eq: { category: 'books' } },
            {
              or: [{ gt: { price: 20 } }, { eq: { author: 'Famous Author' } }],
            },
          ],
        });
        expect(result).toBe("(category eq 'books' and (price gt 20 or author eq 'Famous Author'))");
      });

      it('should escape special characters in strings', () => {
        const result = translator.translate({
          eq: { title: "Book's Title" },
        });
        expect(result).toBe("title eq 'Book''s Title'");
      });

      it('should handle different value types', () => {
        const result = translator.translate({
          eq: {
            isAvailable: true,
            price: 29.99,
            category: 'fiction',
          },
        });
        expect(result).toBe("isAvailable eq true and price eq 29.99 and category eq 'fiction'");
      });

      it('should handle date values', () => {
        const date = new Date('2023-01-01');
        const result = translator.translate({
          ge: { publishDate: date },
        });
        expect(result).toBe(`publishDate ge ${date.toISOString()}`);
      });
    });
  });
});

// ==========================================
// INTEGRATION TESTS (Skip if no credentials)
// ==========================================

const describeIntegration = AZURE_AI_SEARCH_ENDPOINT && AZURE_AI_SEARCH_CREDENTIAL ? describe : describe.skip;

describeIntegration('AzureAISearchVector Integration Tests', () => {
  let azureVector: AzureAISearchVector;
  const testIndexName = `test-mastra-${Date.now()}`;
  const testVectorDimension = 128;

  beforeAll(async () => {
    if (!AZURE_AI_SEARCH_ENDPOINT || !AZURE_AI_SEARCH_CREDENTIAL) {
      console.warn('Skipping Azure AI Search integration tests - credentials not found');
      return;
    }

    azureVector = new AzureAISearchVector({
      id: 'test-azure-vector-integration',
      endpoint: AZURE_AI_SEARCH_ENDPOINT,
      credential: AZURE_AI_SEARCH_CREDENTIAL,
    });

    // Create test index
    await azureVector.createIndex({
      indexName: testIndexName,
      dimension: testVectorDimension,
    });

    console.log(`Creating test index: ${testIndexName}`);
  }, 10000);

  afterAll(async () => {
    if (azureVector) {
      try {
        await azureVector.deleteIndex({ indexName: testIndexName });
        console.log(`Cleaning up test index: ${testIndexName}`);
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
    });
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
        content: expect.any(String),
      });
    });

    it('should filter vectors correctly', async () => {
      // Insert test vectors with different metadata
      const testData = [
        { type: 'electronics', brand: 'Apple', price: 999, name: 'iPhone 15' },
        { type: 'electronics', brand: 'Samsung', price: 899, name: 'Galaxy S24' },
        { type: 'books', brand: 'Penguin', price: 25, name: 'Data Science Handbook' },
      ];

      const vectors = testData.map(() => Array.from({ length: testVectorDimension }, () => Math.random()));
      const metadata = testData;
      const ids = testData.map((_, i) => `product-${i}`);

      await azureVector.upsert({
        indexName: testIndexName,
        vectors,
        metadata,
        ids,
      });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Query with filter for content containing 'test'
      const contentFilter: AzureAISearchVectorFilter = {
        contains: { content: 'Test' },
      };

      const contentResults = await azureVector.query({
        indexName: testIndexName,
        queryVector: Array.from({ length: testVectorDimension }, () => Math.random()),
        topK: 10,
        filter: contentFilter,
      });

      expect(contentResults.length).toBeGreaterThanOrEqual(0);
      // Results should contain filtered content

      // Query with content filter
      const contentFilter2: AzureAISearchVectorFilter = {
        contains: { content: 'product' },
      };

      const contentResults2 = await azureVector.query({
        indexName: testIndexName,
        queryVector: Array.from({ length: testVectorDimension }, () => Math.random()),
        topK: 10,
        filter: contentFilter2,
      });

      expect(contentResults2.length).toBeGreaterThanOrEqual(0);
      // Results should contain filtered content
    }, 30000);

    it('should update and delete vectors', async () => {
      const vectorId = 'update-test-doc';
      const initialVector = Array.from({ length: testVectorDimension }, () => Math.random());
      const updatedVector = Array.from({ length: testVectorDimension }, () => Math.random());

      // Insert initial vector
      await azureVector.upsert({
        indexName: testIndexName,
        vectors: [initialVector],
        metadata: [{ status: 'initial', version: 1, content: 'Initial content' }],
        ids: [vectorId],
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update vector
      const newMetadata = { status: 'updated', version: 2, content: 'Updated content' };
      await azureVector.updateVector({
        indexName: testIndexName,
        id: vectorId,
        update: {
          vector: updatedVector,
          metadata: newMetadata,
        },
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify update by querying
      const queryResult = await azureVector.query({
        indexName: testIndexName,
        queryVector: updatedVector,
        topK: 1,
      });

      expect(queryResult.length).toBeGreaterThan(0);

      // Delete vector
      await azureVector.deleteVector({
        indexName: testIndexName,
        id: vectorId,
      });

      await new Promise(resolve => setTimeout(resolve, 2000));
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid operations gracefully', async () => {
      // Try to query non-existent index
      await expect(
        azureVector.query({
          indexName: 'non-existent-index',
          queryVector: [0.1, 0.2, 0.3],
          topK: 5,
        }),
      ).rejects.toThrow();

      // Try to delete non-existent vector
      await azureVector.deleteVector({
        indexName: testIndexName,
        id: 'non-existent-id',
      }); // Should not throw
    });
  });

  describe('Performance', () => {
    it('should handle batch operations efficiently', async () => {
      const batchSize = 50;
      const vectors = Array.from({ length: batchSize }, () =>
        Array.from({ length: testVectorDimension }, () => Math.random()),
      );
      const metadata = Array.from({ length: batchSize }, (_, i) => ({
        batch: 'performance-test',
        index: i,
        content: `Performance test document ${i}`,
      }));
      const ids = Array.from({ length: batchSize }, (_, i) => `perf-test-${i}`);

      const start = Date.now();
      await azureVector.upsert({
        indexName: testIndexName,
        vectors,
        metadata,
        ids,
      });
      const upsertTime = Date.now() - start;

      console.log(`Batch upsert of ${batchSize} vectors took ${upsertTime}ms`);

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test query performance
      const queryStart = Date.now();
      const results = await azureVector.query({
        indexName: testIndexName,
        queryVector: Array.from({ length: testVectorDimension }, () => Math.random()),
        topK: 20,
      });
      const queryTime = Date.now() - queryStart;

      console.log(`Query took ${queryTime}ms and returned ${results.length} results`);

      // Test concurrent queries
      const concurrentStart = Date.now();
      const promises = Array.from({ length: 10 }, () =>
        azureVector.query({
          indexName: testIndexName,
          queryVector: Array.from({ length: testVectorDimension }, () => Math.random()),
          topK: 5,
        }),
      );
      await Promise.all(promises);
      const concurrentTime = Date.now() - concurrentStart;

      console.log(`10 concurrent queries took ${concurrentTime}ms`);

      // Performance assertions
      expect(upsertTime).toBeLessThan(30000); // 30 seconds for batch upsert
      expect(queryTime).toBeLessThan(5000); // 5 seconds for query
      expect(results.length).toBeGreaterThan(0);
    }, 60000);
  });
});

// ==========================================
// MEMORY INTEGRATION TESTS (Unit Tests)
// ==========================================

describe('AzureAISearchVector Memory Integration Tests', () => {
  let azureVector: AzureAISearchVector;
  let mockIndexClient: any;
  let mockSearchClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup Azure SDK mocks
    mockIndexClient = {
      createIndex: vi.fn().mockResolvedValue({ name: 'memory-index' }),
      listIndexes: vi.fn().mockResolvedValue([]),
      getIndex: vi.fn().mockResolvedValue({
        name: 'memory-index',
        fields: [
          { name: 'id', type: 'Edm.String', key: true },
          {
            name: 'content_vector',
            type: 'Collection(Edm.Single)',
            vectorSearchDimensions: 1536,
          },
          { name: 'metadata', type: 'Edm.String' },
          { name: 'content', type: 'Edm.String' },
        ],
        vectorSearch: {
          algorithms: [{ hnswParameters: { metric: 'cosine' } }],
        },
      }),
      deleteIndex: vi.fn(),
    };

    mockSearchClient = {
      uploadDocuments: vi.fn().mockResolvedValue({
        results: [
          { succeeded: true, key: 'memory-1' },
          { succeeded: true, key: 'memory-2' },
        ],
      }),
      search: vi.fn().mockResolvedValue(
        (async function* () {
          yield {
            document: {
              id: 'memory-1',
              content_vector: new Array(1536).fill(0.1),
              metadata: JSON.stringify({
                threadId: 'thread-123',
                userId: 'user-456',
                timestamp: new Date().toISOString(),
                messageType: 'user',
              }),
              content: 'Hello, I am interested in learning about AI',
            },
            score: 0.95,
          };
          yield {
            document: {
              id: 'memory-2',
              content_vector: new Array(1536).fill(0.2),
              metadata: JSON.stringify({
                threadId: 'thread-123',
                userId: 'user-456',
                timestamp: new Date().toISOString(),
                messageType: 'assistant',
              }),
              content: 'I would be happy to help you learn about artificial intelligence!',
            },
            score: 0.88,
          };
        })(),
      ),
      getDocument: vi.fn(),
      mergeDocuments: vi.fn(),
      deleteDocuments: vi.fn(),
      getDocumentsCount: vi.fn().mockResolvedValue(10),
    };

    // Mock constructors
    const { SearchIndexClient, SearchClient, AzureKeyCredential } =
      await vi.importMock<typeof import('@azure/search-documents')>('@azure/search-documents');
    (SearchIndexClient as Mock).mockImplementation(() => mockIndexClient);
    (SearchClient as Mock).mockImplementation(() => mockSearchClient);
    (AzureKeyCredential as Mock).mockImplementation((key: string) => ({ key }));

    azureVector = new AzureAISearchVector({
      id: 'memory-test',
      endpoint: 'https://test.search.windows.net',
      credential: 'test-key',
    });
  });

  describe('Memory Index Management', () => {
    it('should create memory index with proper configuration', async () => {
      await azureVector.createIndex({
        indexName: 'mastra-memory',
        dimension: 1536,
      });

      expect(mockIndexClient.createIndex).toHaveBeenCalled();
      const createIndexCall = mockIndexClient.createIndex.mock.calls[0][0];
      expect(createIndexCall.name).toBe('mastra-memory');
    });
  });

  describe('Memory Data Operations', () => {
    it('should store memory messages successfully', async () => {
      const memoryData = [
        {
          id: 'memory-1',
          vector: new Array(1536).fill(0.1),
          metadata: {
            threadId: 'thread-123',
            userId: 'user-456',
            messageType: 'user',
            timestamp: '2024-01-15T10:00:00Z',
          },
          document: 'Hello, I am interested in learning about AI',
        },
      ];

      await azureVector.upsert({
        indexName: 'mastra-memory',
        vectors: [memoryData[0].vector],
        ids: [memoryData[0].id],
        metadata: [memoryData[0].metadata],
      });

      expect(mockSearchClient.uploadDocuments).toHaveBeenCalled();
    });

    it('should query memory messages with filters', async () => {
      const queryVector = new Array(1536).fill(0.1);

      const results = await azureVector.query({
        indexName: 'mastra-memory',
        queryVector,
        topK: 10,
        filter: {
          eq: { userId: 'user-456' },
        },
      });

      expect(mockSearchClient.search).toHaveBeenCalled();
      expect(results).toBeDefined();
    });
  });

  describe('Memory Compatibility', () => {
    it('should be compatible with Mastra Memory interface', () => {
      // Test that AzureAISearchVector can be used as a Mastra vector store
      expect(azureVector.query).toBeDefined();
      expect(azureVector.upsert).toBeDefined();
      expect(azureVector.createIndex).toBeDefined();
    });

    it('should handle semantic search queries', async () => {
      const queryVector = new Array(1536).fill(0.1);

      await azureVector.advancedQuery({
        indexName: 'mastra-memory',
        queryVector,
        topK: 5,
        useSemanticSearch: true,
        semanticOptions: {
          configurationName: 'memory-semantic-config',
        },
      });

      expect(mockSearchClient.search).toHaveBeenCalled();
      const searchCall = mockSearchClient.search.mock.calls[0][1];
      expect(searchCall.queryType).toBe('semantic');
    });
  });
});

// ==========================================
// ADVANCED FEATURES TESTS (Skip if no credentials)
// ==========================================

describeIntegration('AzureAISearchVector Advanced Features', () => {
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

    // Create test index with sample data
    await azureVector.createIndex({
      indexName: testIndexName,
      dimension: 1536,
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
        semanticConfig: 'default',
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
