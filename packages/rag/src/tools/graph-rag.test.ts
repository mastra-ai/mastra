import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphRAG } from '../graph-rag';
import { vectorQuerySearch } from '../utils';
import { createGraphRAGTool } from './graph-rag';

vi.mock('../utils', async importOriginal => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    vectorQuerySearch: vi.fn().mockResolvedValue({
      results: [
        { metadata: { text: 'foo' }, vector: [1, 2, 3] },
        { metadata: { text: 'bar' }, vector: [4, 5, 6] },
      ],
      queryEmbedding: [1, 2, 3],
    }),
  };
});

// Create a mock instance tracker
const mockGraphRAGInstances: any[] = [];

vi.mock('../graph-rag', async importOriginal => {
  const actual: any = await importOriginal();

  // Use a class for constructor (Vitest v4 requirement)
  class MockGraphRAG {
    createGraph = vi.fn();
    query = vi.fn(() => [
      { content: 'foo', metadata: { text: 'foo' } },
      { content: 'bar', metadata: { text: 'bar' } },
    ]);

    constructor() {
      mockGraphRAGInstances.push(this);
    }
  }

  // Create a spy on the class
  const GraphRAGSpy = vi.fn(MockGraphRAG as any);

  return {
    ...actual,
    GraphRAG: GraphRAGSpy,
  };
});

const mockModel = { name: 'test-model' } as any;
const mockMastra = {
  getVector: vi.fn(storeName => ({
    [storeName]: {},
  })),
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  })),
};

describe('createGraphRAGTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGraphRAGInstances.length = 0; // Clear instances
  });

  it('validates input schema', () => {
    const tool = createGraphRAGTool({
      id: 'test',
      model: mockModel,
      vectorStoreName: 'testStore',
      indexName: 'testIndex',
    });
    expect(() => tool.inputSchema?.parse({ queryText: 'foo', topK: 10 })).not.toThrow();
    expect(() => tool.inputSchema?.parse({})).toThrow();
  });

  describe('requestContext', () => {
    it('calls vectorQuerySearch and GraphRAG with requestContext params', async () => {
      const tool = createGraphRAGTool({
        id: 'test',
        model: mockModel,
        indexName: 'testIndex',
        vectorStoreName: 'testStore',
      });
      const requestContext = new RequestContext();
      requestContext.set('indexName', 'anotherIndex');
      requestContext.set('vectorStoreName', 'anotherStore');
      requestContext.set('topK', 5);
      requestContext.set('filter', { foo: 'bar' });
      requestContext.set('randomWalkSteps', 99);
      requestContext.set('restartProb', 0.42);
      const result = await tool.execute(
        {
          queryText: 'foo',
          topK: 2,
        },
        {
          mastra: mockMastra as any,
          requestContext,
        },
      );
      expect(result.relevantContext).toEqual(['foo', 'bar']);
      expect(result.sources.length).toBe(2);
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          indexName: 'anotherIndex',
          vectorStore: {
            anotherStore: {},
          },
          queryText: 'foo',
          model: mockModel,
          queryFilter: { foo: 'bar' },
          topK: 5,
          includeVectors: true,
        }),
      );
      // GraphRAG createGraph and query should be called
      expect(GraphRAG).toHaveBeenCalled();
      const instance = mockGraphRAGInstances[0];
      expect(instance.createGraph).toHaveBeenCalled();
      expect(instance.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query: [1, 2, 3],
          topK: 5,
          randomWalkSteps: 99,
          restartProb: 0.42,
        }),
      );
    });
  });

  describe('dynamic vectorStore (multi-tenant schema support)', () => {
    it('should support vectorStore as a function that receives requestContext', async () => {
      // Simulate multi-tenant setup where each tenant has a different schema
      const tenantAVectorStore = { id: 'tenant-a-store' } as any;
      const tenantBVectorStore = { id: 'tenant-b-store' } as any;

      const vectorStoreResolver = vi.fn(({ requestContext }: { requestContext?: RequestContext }) => {
        const schemaId = requestContext?.get('schemaId');
        return schemaId === 'tenant-a' ? tenantAVectorStore : tenantBVectorStore;
      });

      const tool = createGraphRAGTool({
        indexName: 'tenant_embeddings',
        model: mockModel,
        vectorStore: vectorStoreResolver,
      });

      // Test with tenant A context
      const tenantAContext = new RequestContext();
      tenantAContext.set('schemaId', 'tenant-a');

      await tool.execute({ queryText: 'test query', topK: 5 }, { requestContext: tenantAContext });

      expect(vectorStoreResolver).toHaveBeenCalledWith(expect.objectContaining({ requestContext: tenantAContext }));
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorStore: tenantAVectorStore,
        }),
      );

      vi.clearAllMocks();
      mockGraphRAGInstances.length = 0;

      // Test with tenant B context
      const tenantBContext = new RequestContext();
      tenantBContext.set('schemaId', 'tenant-b');

      await tool.execute({ queryText: 'test query', topK: 5 }, { requestContext: tenantBContext });

      expect(vectorStoreResolver).toHaveBeenCalledWith(expect.objectContaining({ requestContext: tenantBContext }));
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorStore: tenantBVectorStore,
        }),
      );
    });

    it('should support async vectorStore resolver function', async () => {
      const asyncVectorStore = { id: 'async-resolved-store' } as any;

      const asyncVectorStoreResolver = vi.fn(async ({ requestContext }: { requestContext?: RequestContext }) => {
        // Simulate async operation (e.g., fetching from DB or initializing per-tenant store)
        await new Promise(resolve => setTimeout(resolve, 10));
        return asyncVectorStore;
      });

      const tool = createGraphRAGTool({
        indexName: 'testIndex',
        model: mockModel,
        vectorStore: asyncVectorStoreResolver,
      });

      const requestContext = new RequestContext();

      await tool.execute({ queryText: 'test query', topK: 5 }, { requestContext });

      expect(asyncVectorStoreResolver).toHaveBeenCalled();
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorStore: asyncVectorStore,
        }),
      );
    });

    it('should pass mastra instance to vectorStore resolver function', async () => {
      const vectorStoreResolver = vi.fn(({ mastra }: { mastra?: any }) => {
        // Use mastra to get a custom vector store
        return { id: 'mastra-resolved-store' } as any;
      });

      const tool = createGraphRAGTool({
        indexName: 'testIndex',
        model: mockModel,
        vectorStore: vectorStoreResolver,
      });

      const requestContext = new RequestContext();

      await tool.execute({ queryText: 'test query', topK: 5 }, { mastra: mockMastra as any, requestContext });

      expect(vectorStoreResolver).toHaveBeenCalledWith(expect.objectContaining({ mastra: mockMastra }));
    });

    it('should still support static vectorStore (existing behavior)', async () => {
      const staticVectorStore = { id: 'static-store' } as any;

      const tool = createGraphRAGTool({
        indexName: 'testIndex',
        model: mockModel,
        vectorStore: staticVectorStore,
      });

      await tool.execute({ queryText: 'test query', topK: 5 }, { requestContext: new RequestContext() });

      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          vectorStore: staticVectorStore,
        }),
      );
    });
  });
});
