import { RuntimeContext } from '@mastra/core/runtime-context';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rerank } from '../rerank';
import { vectorQuerySearch } from '../utils';
import { createVectorQueryTool } from './vector-query';

vi.mock('../utils', async importOriginal => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    vectorQuerySearch: vi.fn().mockResolvedValue({ results: [{ metadata: { text: 'foo' }, vector: [1, 2, 3] }] }),
  };
});

vi.mock('../rerank', async importOriginal => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    rerank: vi
      .fn()
      .mockResolvedValue([
        { result: { id: '1', metadata: { text: 'bar' }, score: 1, details: { semantic: 1, vector: 1, position: 1 } } },
      ]),
  };
});

describe('createVectorQueryTool', () => {
  const mockModel = { name: 'test-model' } as any;
  const mockMastra = {
    vectors: {
      testStore: {
        // Mock vector store methods
      },
    },
    getVector: vi.fn(() => ({
      testStore: {
        // Mock vector store methods
      },
    })),
    logger: {
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
    getLogger: vi.fn(() => ({
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input schema validation', () => {
    it('should handle filter permissively when enableFilter is false', () => {
      // Create tool with enableFilter set to false
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        enableFilter: false,
      });

      // Get the Zod schema
      const schema = tool.inputSchema;

      // Test with no filter (should be valid)
      const validInput = {
        queryText: 'test query',
        topK: 5,
      };
      expect(() => schema?.parse(validInput)).not.toThrow();

      // Test with filter (should throw - unexpected property)
      const inputWithFilter = {
        ...validInput,
        filter: '{"field": "value"}',
      };
      expect(() => schema?.parse(inputWithFilter)).not.toThrow();
    });

    it('should handle filter when enableFilter is true', () => {
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        enableFilter: true,
      });

      // Get the Zod schema
      const schema = tool.inputSchema;

      // Test various filter inputs that should coerce to string
      const testCases = [
        // String inputs
        { filter: '{"field": "value"}' },
        { filter: '{}' },
        { filter: 'simple-string' },
        // Empty
        { filter: '' },
        { filter: { field: 'value' } },
        { filter: {} },
        { filter: 123 },
        { filter: null },
        { filter: undefined },
      ];

      testCases.forEach(({ filter }) => {
        expect(() =>
          schema?.parse({
            queryText: 'test query',
            topK: 5,
            filter,
          }),
        ).not.toThrow();
      });

      // Verify that all parsed values are strings
      testCases.forEach(({ filter }) => {
        const result = schema?.parse({
          queryText: 'test query',
          topK: 5,
          filter,
        });
        expect(typeof result?.filter).toBe('string');
      });
    });

    it('should not reject unexpected properties in both modes', () => {
      // Test with enableFilter false
      const toolWithoutFilter = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        enableFilter: false,
      });

      // Should reject unexpected property
      expect(() =>
        toolWithoutFilter.inputSchema?.parse({
          queryText: 'test query',
          topK: 5,
          unexpectedProp: 'value',
        }),
      ).not.toThrow();

      // Test with enableFilter true
      const toolWithFilter = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        enableFilter: true,
      });

      // Should reject unexpected property even with valid filter
      expect(() =>
        toolWithFilter.inputSchema?.parse({
          queryText: 'test query',
          topK: 5,
          filter: '{}',
          unexpectedProp: 'value',
        }),
      ).not.toThrow();
    });
  });

  describe('execute function', () => {
    it('should not process filter when enableFilter is false', async () => {
      // Create tool with enableFilter set to false
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        enableFilter: false,
      });

      // Execute with no filter
      await tool.execute?.({
        context: {
          queryText: 'test query',
          topK: 5,
        },
        mastra: mockMastra as any,
        runtimeContext: {} as any,
      });

      // Check that vectorQuerySearch was called with undefined queryFilter
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          queryFilter: undefined,
        }),
      );
    });

    it('should process filter when enableFilter is true and filter is provided', async () => {
      // Create tool with enableFilter set to true
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        enableFilter: true,
      });

      const filterJson = '{"field": "value"}';

      // Execute with filter
      await tool.execute?.({
        context: {
          queryText: 'test query',
          topK: 5,
          filter: filterJson,
        },
        mastra: mockMastra as any,
        runtimeContext: {} as any,
      });

      // Check that vectorQuerySearch was called with the parsed filter
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          queryFilter: { field: 'value' },
        }),
      );
    });

    it('should handle string filters correctly', async () => {
      // Create tool with enableFilter set to true
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        enableFilter: true,
      });

      const stringFilter = 'string-filter';

      // Execute with string filter
      await tool.execute?.({
        context: {
          queryText: 'test query',
          topK: 5,
          filter: stringFilter,
        },
        mastra: mockMastra as any,
        runtimeContext: {} as any,
      });

      // Since this is not a valid filter, it should be ignored
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          queryFilter: undefined,
        }),
      );
    });
  });

  describe('runtimeContext', () => {
    it('throws if indexName or vectorStoreName missing', async () => {
      const tool = createVectorQueryTool({ id: 'test', model: mockModel, useRuntimeContext: true });
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('vectorStoreName', 'testStore');
      await expect(
        tool.execute({
          context: { queryText: 'foo' },
          mastra: mockMastra as any,
          runtimeContext,
        }),
      ).rejects.toThrow('indexName is required');
      const runtimeContext2 = new RuntimeContext();
      runtimeContext2.set('indexName', 'testIndex');
      await expect(
        tool.execute({
          context: { queryText: 'foo' },
          mastra: mockMastra as any,
          runtimeContext: runtimeContext2,
        }),
      ).rejects.toThrow('vectorStoreName is required');
    });

    it('calls vectorQuerySearch with runtimeContext params', async () => {
      const tool = createVectorQueryTool({ id: 'test', model: mockModel, useRuntimeContext: true });
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('indexName', 'testIndex');
      runtimeContext.set('vectorStoreName', 'testStore');
      runtimeContext.set('topK', 3);
      runtimeContext.set('filter', { foo: 'bar' });
      runtimeContext.set('includeVectors', true);
      runtimeContext.set('includeSources', false);
      const result = await tool.execute({
        context: { queryText: 'foo' },
        mastra: mockMastra as any,
        runtimeContext,
      });
      expect(result.relevantContext.length).toBeGreaterThan(0);
      expect(result.sources).toEqual([]); // includeSources false
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          indexName: 'testIndex',
          vectorStore: expect.anything(),
          queryText: 'foo',
          model: mockModel,
          queryFilter: { foo: 'bar' },
          topK: 3,
          includeVectors: true,
        }),
      );
    });

    it('handles reranker from runtimeContext', async () => {
      const tool = createVectorQueryTool({ id: 'test', model: mockModel, useRuntimeContext: true });
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('indexName', 'testIndex');
      runtimeContext.set('vectorStoreName', 'testStore');
      runtimeContext.set('reranker', { model: 'reranker-model', options: { topK: 1 } });
      // Mock rerank
      vi.mocked(rerank).mockResolvedValue([
        {
          result: { id: '1', metadata: { text: 'bar' }, score: 1 },
          score: 1,
          details: { semantic: 1, vector: 1, position: 1 },
        },
      ]);
      const result = await tool.execute({
        context: { queryText: 'foo' },
        mastra: mockMastra as any,
        runtimeContext,
      });
      expect(result.relevantContext[0]).toEqual({ text: 'bar' });
    });
  });
});
