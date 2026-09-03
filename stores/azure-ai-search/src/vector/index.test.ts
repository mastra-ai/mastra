import type * as AzureSearchDocuments from '@azure/search-documents';
import type { Mock } from 'vitest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AzureAISearchFilterTranslator } from './filter';
import { AzureAISearchVector } from './index';

// Mock Azure SDK for unit tests.
// Real integration tests against a live Azure AI Search resource live in
// integration.test.ts, which does not mock @azure/search-documents.
vi.mock('@azure/search-documents', () => ({
  SearchClient: vi.fn(function SearchClient() {}),
  SearchIndexClient: vi.fn(function SearchIndexClient() {}),
  AzureKeyCredential: vi.fn(function AzureKeyCredential() {}),
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
      createOrUpdateIndex: vi.fn(),
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
          { name: 'category', type: 'Edm.String', filterable: true },
          { name: 'price', type: 'Edm.Double', filterable: true },
          { name: 'thread_id', type: 'Edm.String', filterable: true },
          { name: 'resource_id', type: 'Edm.String', filterable: true },
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
      await vi.importMock<typeof AzureSearchDocuments>('@azure/search-documents');

    // Setup mock implementations
    (SearchIndexClient as Mock).mockImplementation(function () {
      return mockIndexClient;
    });
    (SearchClient as Mock).mockImplementation(function () {
      return mockSearchClientInstance;
    });
    (AzureKeyCredential as Mock).mockImplementation(function (key: string) {
      return { key };
    });

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

    it('should create metadata index fields as explicit filterable Azure fields', async () => {
      mockIndexClient.createIndex.mockResolvedValue({ name: 'memory-messages' });

      await azureVector.createIndex({
        indexName: 'memory-messages',
        dimension: 128,
        metadataIndexes: ['thread_id', 'resource_id'],
      });

      expect(mockIndexClient.createIndex).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({ name: 'thread_id', type: 'Edm.String', filterable: true }),
            expect.objectContaining({ name: 'resource_id', type: 'Edm.String', filterable: true }),
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

    it('should add missing metadata index fields when an index already exists', async () => {
      const error = new Error('Index already exists');
      (error as any).statusCode = 409;
      mockIndexClient.createIndex.mockRejectedValueOnce(error);
      mockIndexClient.createOrUpdateIndex.mockResolvedValue({ name: 'test-index' });
      mockIndexClient.getIndex.mockResolvedValue({
        name: 'test-index',
        fields: [
          { name: 'id', type: 'Edm.String', key: true, filterable: true },
          { name: 'vector', type: 'Collection(Edm.Single)', dimensions: 128 },
          { name: 'metadata', type: 'Edm.String' },
        ],
      });

      await azureVector.createIndex({
        indexName: 'test-index',
        dimension: 128,
        metadataIndexes: ['thread_id', 'resource_id'],
      });

      expect(mockIndexClient.createOrUpdateIndex).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({ name: 'thread_id', type: 'Edm.String', filterable: true }),
            expect.objectContaining({ name: 'resource_id', type: 'Edm.String', filterable: true }),
          ]),
        }),
      );
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
      const metadata = [{ type: 'document', category: 'docs' }, { type: 'document', price: 99.99 }];
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
          metadata: JSON.stringify({ type: 'document', category: 'docs' }),
          content: '',
          category: 'docs',
        },
        {
          id: 'doc2',
          vector: [0.4, 0.5, 0.6],
          metadata: JSON.stringify({ type: 'document', price: 99.99 }),
          content: '',
          price: 99.99,
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

    it('should apply deleteFilter before upsert', async () => {
      const deleteVectorsSpy = vi.spyOn(azureVector, 'deleteVectors').mockResolvedValue();

      await azureVector.upsert({
        indexName: 'test-index',
        vectors: [[0.1, 0.2, 0.3]],
        metadata: [{ type: 'document' }],
        deleteFilter: { eq: { type: 'document' } },
      });

      expect(deleteVectorsSpy).toHaveBeenCalledWith({
        indexName: 'test-index',
        filter: { eq: { type: 'document' } },
      });
    });
  });

  describe('query', () => {
    beforeEach(() => {
      // Mock search to return object with results property (async iterator)
      const mockResults = (async function* () {
        yield {
          document: {
            id: 'doc1',
            vector: [0.1, 0.2, 0.3],
            metadata: '{"type":"document"}',
            content: 'test content',
          },
          score: 0.95,
        };
      })();

      mockSearchClientInstance.search.mockResolvedValue({
        results: mockResults,
      });
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

    it('should include the vector in results when includeVector is true', async () => {
      const result = await azureVector.query({
        indexName: 'test-index',
        queryVector: Array.from({ length: 128 }, (_, i) => i * 0.001),
        topK: 5,
        includeVector: true,
      });

      expect(result[0].vector).toEqual([0.1, 0.2, 0.3]);
    });

    it('should omit the vector from results when includeVector is false', async () => {
      const result = await azureVector.query({
        indexName: 'test-index',
        queryVector: Array.from({ length: 128 }, (_, i) => i * 0.001),
        topK: 5,
      });

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

    it('should query with flat metadata filters used by Memory semantic recall', async () => {
      await azureVector.query({
        indexName: 'test-index',
        queryVector: Array.from({ length: 128 }, (_, i) => i * 0.001),
        topK: 5,
        filter: { resource_id: 'resource-123' },
      });

      expect(mockSearchClientInstance.search).toHaveBeenCalledWith(
        '*',
        expect.objectContaining({
          filter: "resource_id eq 'resource-123'",
        }),
      );
    });
  });

  describe('updateVector', () => {
    beforeEach(() => {
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
          category: 'new',
        }),
      ]);
    });

    it('should update explicit index fields from metadata', async () => {
      await azureVector.updateVector({
        indexName: 'test-index',
        id: 'doc1',
        update: { metadata: { status: 'updated', category: 'docs' } },
      });

      expect(mockSearchClientInstance.mergeDocuments).toHaveBeenCalledWith([
        { id: 'doc1', metadata: JSON.stringify({ status: 'updated', category: 'docs' }), category: 'docs' },
      ]);
    });

    it('should update vectors by filter', async () => {
      const mockResults = (async function* () {
        yield { document: { id: 'doc1' }, score: 1 };
        yield { document: { id: 'doc2' }, score: 1 };
      })();

      mockSearchClientInstance.search.mockResolvedValue({ results: mockResults });

      await azureVector.updateVector({
        indexName: 'test-index',
        filter: { eq: { category: 'old' } },
        update: { metadata: { category: 'new' } },
      });

      expect(mockSearchClientInstance.mergeDocuments).toHaveBeenCalledWith([
        { id: 'doc1', metadata: JSON.stringify({ category: 'new' }), category: 'new' },
        { id: 'doc2', metadata: JSON.stringify({ category: 'new' }), category: 'new' },
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

    it('should handle 404 for non-existent document gracefully', async () => {
      const error = new Error('Document not found') as Error & { statusCode: number };
      error.statusCode = 404;
      mockSearchClientInstance.deleteDocuments.mockRejectedValue(error);

      await azureVector.deleteVector({
        indexName: 'test-index',
        id: 'non-existent',
      });
    });

    it('should throw when Azure reports a per-document delete failure', async () => {
      mockSearchClientInstance.deleteDocuments.mockResolvedValue({
        results: [{ succeeded: false, key: 'doc1', errorMessage: 'Delete failed' }],
      });

      await expect(
        azureVector.deleteVector({
          indexName: 'test-index',
          id: 'doc1',
        }),
      ).rejects.toThrow('Document doc1 failed to delete');
    });

    it('should wrap delete errors', async () => {
      mockSearchClientInstance.deleteDocuments.mockRejectedValue(new Error('Delete failed'));

      await expect(
        azureVector.deleteVector({
          indexName: 'test-index',
          id: 'doc1',
        }),
      ).rejects.toThrow('Delete failed');
    });

    it('should wrap per-document delete failures with MastraError details', async () => {
      mockSearchClientInstance.deleteDocuments.mockResolvedValue({
        results: [{ succeeded: false, key: 'doc1', errorMessage: 'Rejected by Azure' }],
      });

      await expect(
        azureVector.deleteVector({
          indexName: 'test-index',
          id: 'doc1',
        }),
      ).rejects.toMatchObject({
        id: 'STORAGE_AZURE_AI_SEARCH_DELETE_VECTOR_PARTIAL_FAILURE',
        details: {
          indexName: 'test-index',
          id: 'doc1',
          failedKey: 'doc1',
          error: 'Rejected by Azure',
        },
      });
    });

    it('should fall back to requested id when delete failure has no key', async () => {
      mockSearchClientInstance.deleteDocuments.mockResolvedValue({
        results: [{ succeeded: false }],
      });

      await expect(
        azureVector.deleteVector({
          indexName: 'test-index',
          id: 'doc1',
        }),
      ).rejects.toThrow('Document doc1 failed to delete');
    });

    it('should not throw when Azure confirms a missing document delete', async () => {
      mockSearchClientInstance.deleteDocuments.mockResolvedValue({
        results: [{ succeeded: true, key: 'non-existent' }],
      });

      await azureVector.deleteVector({
        indexName: 'test-index',
        id: 'non-existent',
      });
    });
  });

  describe('deleteVectors', () => {
    beforeEach(() => {
      mockSearchClientInstance.deleteDocuments.mockResolvedValue({
        results: [{ succeeded: true, key: 'doc1' }],
      });
    });

    it('should delete vectors by ids', async () => {
      await azureVector.deleteVectors({
        indexName: 'test-index',
        ids: ['doc1', 'doc2'],
      });

      expect(mockSearchClientInstance.deleteDocuments).toHaveBeenCalledWith([{ id: 'doc1' }, { id: 'doc2' }]);
    });

    it('should delete vectors by filter', async () => {
      const mockResults = (async function* () {
        yield { document: { id: 'doc1' }, score: 1 };
        yield { document: { id: 'doc2' }, score: 1 };
      })();

      mockSearchClientInstance.search.mockResolvedValue({ results: mockResults });

      await azureVector.deleteVectors({
        indexName: 'test-index',
        filter: { eq: { category: 'books' } },
      });

      expect(mockSearchClientInstance.deleteDocuments).toHaveBeenCalledWith([{ id: 'doc1' }, { id: 'doc2' }]);
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

      it('should translate Mastra-style operators', () => {
        const result = translator.translate({
          $and: [{ category: { $eq: 'books' } }, { price: { $gt: 10 } }],
        });
        expect(result).toBe("(category eq 'books' and price gt 10)");
      });

      it('should translate flat Mastra metadata filters to equality comparisons', () => {
        expect(translator.translate({ resource_id: 'resource-123' })).toBe("resource_id eq 'resource-123'");
        expect(translator.translate({ thread_id: 'thread-123', resource_id: 'resource-123' })).toBe(
          "thread_id eq 'thread-123' and resource_id eq 'resource-123'",
        );
      });
    });
  });
});
