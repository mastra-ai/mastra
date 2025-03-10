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
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input schema validation', () => {
    it('should make filter optional when enableFilter is false', () => {
      // Create tool with enableFilter set to false
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        enableFilter: false,
      });

      // Get the Zod schema
      const schema = tool.__inputSchema;

      // Test with no filter
      const validInput = {
        queryText: 'test query',
        topK: 5,
      };

      // This should not throw an error
      expect(() => schema.parse(validInput)).not.toThrow();

      // Test with filter (should still be valid)
      const inputWithFilter = {
        ...validInput,
        filter: '{"field": "value"}',
      };

      // This should also not throw an error
      expect(() => schema.parse(inputWithFilter)).not.toThrow();
    });

    it('should require filter when enableFilter is true', () => {
      // Create tool with enableFilter set to true
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        enableFilter: true,
      });

      // Get the Zod schema
      const schema = tool.__inputSchema;

      // Test with no filter (should throw)
      const invalidInput = {
        queryText: 'test query',
        topK: 5,
      };

      // This should throw a ZodError
      expect(() => schema.parse(invalidInput)).toThrow();

      // Test with filter (should be valid)
      const validInput = {
        ...invalidInput,
        filter: '{"field": "value"}',
      };

      // This should not throw an error
      expect(() => schema.parse(validInput)).not.toThrow();
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
      await tool.execute({
        context: {
          queryText: 'test query',
          topK: 5,
        },
        mastra: mockMastra,
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
      await tool.execute({
        context: {
          queryText: 'test query',
          topK: 5,
          filter: filterJson,
        },
        mastra: mockMastra,
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
      await tool.execute({
        context: {
          queryText: 'test query',
          topK: 5,
          filter: stringFilter,
        },
        mastra: mockMastra,
      });

      // Check that vectorQuerySearch was called with the string filter
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          queryFilter: 'string-filter',
        }),
      );
    });
  });
});
