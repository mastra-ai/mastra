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
  });
});
