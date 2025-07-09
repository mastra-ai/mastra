import { RuntimeContext } from '@mastra/core/runtime-context';
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

vi.mock('../graph-rag', async importOriginal => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    GraphRAG: vi.fn().mockImplementation(() => {
      return {
        createGraph: vi.fn(),
        query: vi.fn(() => [
          { content: 'foo', metadata: { text: 'foo' } },
          { content: 'bar', metadata: { text: 'bar' } },
        ]),
      };
    }),
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

  describe('runtimeContext', () => {
    it('calls vectorQuerySearch and GraphRAG with runtimeContext params', async () => {
      const tool = createGraphRAGTool({
        id: 'test',
        model: mockModel,
        indexName: 'testIndex',
        vectorStoreName: 'testStore',
      });
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('indexName', 'anotherIndex');
      runtimeContext.set('vectorStoreName', 'anotherStore');
      runtimeContext.set('topK', 5);
      runtimeContext.set('filter', { foo: 'bar' });
      runtimeContext.set('randomWalkSteps', 99);
      runtimeContext.set('restartProb', 0.42);
      const result = await tool.execute({
        context: { queryText: 'foo', topK: 2 },
        mastra: mockMastra as any,
        runtimeContext,
      });
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
      const instance = (GraphRAG as any).mock.results[0].value;
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

    it('handles dynamic arguments (function-based options) with runtimeContext', async () => {
      const dynamicModel = vi.fn().mockResolvedValue(mockModel);
      const dynamicIndexName = vi.fn().mockResolvedValue('dynamicIndex');
      const dynamicVectorStoreName = vi.fn().mockResolvedValue('dynamicStore');
      const dynamicIncludeSources = vi.fn().mockResolvedValue(false);
      const dynamicGraphOptions = vi.fn().mockResolvedValue({
        dimension: 768,
        randomWalkSteps: 50,
        restartProb: 0.1,
        threshold: 0.8,
      });
      const dynamicDatabaseConfig = vi.fn().mockResolvedValue({
        customConfig: 'value',
      });

      const tool = createGraphRAGTool({
        id: 'dynamic-test',
        model: dynamicModel as any,
        indexName: dynamicIndexName as any,
        vectorStoreName: dynamicVectorStoreName as any,
        includeSources: dynamicIncludeSources as any,
        graphOptions: dynamicGraphOptions as any,
        databaseConfig: dynamicDatabaseConfig as any,
      });

      const runtimeContext = new RuntimeContext();
      runtimeContext.set('customKey', 'customValue');

      const result = await tool.execute({
        context: { queryText: 'dynamic query', topK: 5 },
        mastra: mockMastra as any,
        runtimeContext,
      });

      // Verify that dynamic functions were called with runtimeContext
      expect(dynamicModel).toHaveBeenCalledWith({ runtimeContext });
      expect(dynamicIndexName).toHaveBeenCalledWith({ runtimeContext });
      expect(dynamicVectorStoreName).toHaveBeenCalledWith({ runtimeContext });
      expect(dynamicIncludeSources).toHaveBeenCalledWith({ runtimeContext });
      expect(dynamicGraphOptions).toHaveBeenCalledWith({ runtimeContext });
      expect(dynamicDatabaseConfig).toHaveBeenCalledWith({ runtimeContext });

      // Verify that vectorQuerySearch was called with dynamic values
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          indexName: 'dynamicIndex',
          vectorStore: {
            dynamicStore: {},
          },
          queryText: 'dynamic query',
          model: mockModel,
          topK: 5,
          includeVectors: true,
          databaseConfig: { customConfig: 'value' },
        }),
      );

      // Verify GraphRAG was initialized with dynamic graph options
      expect(GraphRAG).toHaveBeenCalledWith(768, 0.8);

      expect(result.relevantContext).toEqual(['foo', 'bar']);
      expect(result.sources).toEqual([]); // includeSources false
    });
  });
});
