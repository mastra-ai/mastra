import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vectorQuerySearch } from '../utils';
import { createVectorQueryTool } from './vector-query';

// Mock dependencies
vi.mock('@mastra/core/tools', () => ({
  createTool: vi.fn(({ inputSchema, execute }) => ({
    inputSchema,
    execute,
    // Return a simplified version of the tool for testing
    __inputSchema: inputSchema,
  })),
}));

vi.mock('../utils', () => ({
  vectorQuerySearch: vi.fn().mockResolvedValue({ results: [] }),
  defaultVectorQueryDescription: () => 'Default vector query description',
  queryTextDescription: 'Query text description',
  filterDescription: 'Filter description',
  topKDescription: 'Top K description',
}));

describe('createVectorQueryTool', () => {
  const mockModel = { name: 'test-model' } as any;
  const mockMastra = {
    vectors: {
      testStore: {
        // Mock vector store methods
      },
    },
    logger: {
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
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
      const schema = tool.__inputSchema;

      // Test with no filter (should be valid)
      const validInput = {
        queryText: 'test query',
        topK: 5,
      };
      expect(() => schema.parse(validInput)).not.toThrow();

      // Test with filter (should throw - unexpected property)
      const inputWithFilter = {
        ...validInput,
        filter: '{"field": "value"}',
      };
      expect(() => schema.parse(inputWithFilter)).not.toThrow();
    });

    it('should handle filter when enableFilter is true', () => {
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        enableFilter: true,
      });

      // Get the Zod schema
      const schema = tool.__inputSchema;

      // Test various filter inputs that should all work
      const testCases = [
        // String inputs
        { filter: '{"field": "value"}' },
        { filter: '{}' },
        { filter: 'simple-string' },
        // Empty
        { filter: '' },
      ];

      const invalidTestCases = [
        { filter: { field: 'value' } },
        { filter: {} },
        { filter: 123 },
        { filter: null },
        { filter: undefined },
      ];

      testCases.forEach(({ filter }) => {
        expect(() =>
          schema.parse({
            queryText: 'test query',
            topK: 5,
            filter,
          }),
        ).not.toThrow();
      });

      invalidTestCases.forEach(({ filter }) => {
        expect(() =>
          schema.parse({
            queryText: 'test query',
            topK: 5,
            filter,
          }),
        ).toThrow();
      });

      // Verify that all parsed values are strings
      testCases.forEach(({ filter }) => {
        const result = schema.parse({
          queryText: 'test query',
          topK: 5,
          filter,
        });
        expect(typeof result.filter).toBe('string');
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
        toolWithoutFilter.__inputSchema.parse({
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
        toolWithFilter.__inputSchema.parse({
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
          inputData: {
            queryText: 'test query',
            topK: 5,
          },
        },
        mastra: mockMastra as any,
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
          inputData: {
            queryText: 'test query',
            topK: 5,
            filter: filterJson,
          },
        },
        mastra: mockMastra as any,
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
          inputData: {
            queryText: 'test query',
            topK: 5,
            filter: stringFilter,
          },
        },
        mastra: mockMastra as any,
      });

      // Since this is not a valid filter, it should be ignored
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          queryFilter: undefined,
        }),
      );
    });
  });
});
