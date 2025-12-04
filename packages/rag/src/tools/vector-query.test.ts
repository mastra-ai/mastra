import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { convertZodSchemaToAISDKSchema } from '@mastra/schema-compat';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { rerank } from '../rerank';
import { vectorQuerySearch } from '../utils';
import { createVectorQueryTool } from './vector-query';

// Helper to convert Zod schema to JSON schema (matches what the schema-compat package does internally)
function zodToJsonSchema(schema: z.ZodType): any {
  return convertZodSchemaToAISDKSchema(schema).jsonSchema;
}

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
      anotherStore: {
        // Mock vector store methods
      },
    },
    getVector: vi.fn(storeName => ({
      [storeName]: {
        // Mock vector store methods
      },
    })),
    logger: {
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    },
    getLogger: vi.fn(() => ({
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
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
      const requestContext = new RequestContext();

      // Create tool with enableFilter set to false
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        enableFilter: false,
      });

      // Execute with no filter
      await tool.execute?.(
        {
          queryText: 'test query',
          topK: 5,
        },
        {
          mastra: mockMastra as any,
          requestContext,
        },
      );

      // Check that vectorQuerySearch was called with undefined queryFilter
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          queryFilter: undefined,
        }),
      );
    });

    it('should process filter when enableFilter is true and filter is provided', async () => {
      const requestContext = new RequestContext();
      // Create tool with enableFilter set to true
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        enableFilter: true,
      });

      const filterJson = '{"field": "value"}';

      // Execute with filter
      await tool.execute?.(
        {
          queryText: 'test query',
          topK: 5,
          filter: filterJson,
        },
        {
          mastra: mockMastra as any,
          requestContext,
        },
      );

      // Check that vectorQuerySearch was called with the parsed filter
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          queryFilter: { field: 'value' },
        }),
      );
    });

    it('should handle string filters correctly', async () => {
      const requestContext = new RequestContext();
      // Create tool with enableFilter set to true
      const tool = createVectorQueryTool({
        vectorStoreName: 'testStore',
        indexName: 'testIndex',
        model: mockModel,
        enableFilter: true,
      });

      const stringFilter = 'string-filter';

      // Execute with string filter - should throw an error for invalid JSON
      const result = await tool.execute?.(
        {
          queryText: 'test query',
          topK: 5,
          filter: stringFilter,
        },
        {
          mastra: mockMastra as any,
          requestContext,
        },
      );

      // Since this is not a valid JSON filter, the error is caught and returns empty results
      expect(result).toEqual({ relevantContext: [], sources: [] });
      expect(vectorQuerySearch).not.toHaveBeenCalled();
    });

    it('Returns early when no Mastra server or vector store is provided', async () => {
      const tool = createVectorQueryTool({
        id: 'test',
        model: mockModel,
        indexName: 'testIndex',
        vectorStoreName: 'testStore',
      });

      const requestContext = new RequestContext();
      const result = await tool.execute(
        {
          queryText: 'foo',
          topK: 1,
        },
        {
          requestContext,
        },
      );

      expect(result).toEqual({ relevantContext: [], sources: [] });
      expect(vectorQuerySearch).not.toHaveBeenCalled();
    });

    it('works without a mastra server if a vector store is passed as an argument', async () => {
      const testStore = {
        testStore: {},
      };
      const tool = createVectorQueryTool({
        id: 'test',
        model: mockModel,
        indexName: 'testIndex',
        vectorStoreName: 'testStore',
        vectorStore: testStore as any,
      });

      const requestContext = new RequestContext();
      const result = await tool.execute(
        {
          queryText: 'foo',
          topK: 1,
        },
        {
          requestContext,
        },
      );

      expect(result.relevantContext[0]).toEqual({ text: 'foo' });
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseConfig: undefined,
          indexName: 'testIndex',
          vectorStore: {
            testStore: {},
          },
          queryText: 'foo',
          model: mockModel,
          queryFilter: undefined,
          topK: 1,
        }),
      );
    });

    it('prefers the passed vector store over one from a passed Mastra server', async () => {
      const thirdStore = {
        thirdStore: {},
      };
      const tool = createVectorQueryTool({
        id: 'test',
        model: mockModel,
        indexName: 'testIndex',
        vectorStoreName: 'thirdStore',
        vectorStore: thirdStore as any,
      });

      const requestContext = new RequestContext();
      const result = await tool.execute(
        {
          queryText: 'foo',
          topK: 1,
        },
        {
          mastra: mockMastra as any,
          requestContext,
        },
      );

      expect(result.relevantContext[0]).toEqual({ text: 'foo' });
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseConfig: undefined,
          indexName: 'testIndex',
          vectorStore: {
            thirdStore: {},
          },
          queryText: 'foo',
          model: mockModel,
          queryFilter: undefined,
          topK: 1,
        }),
      );
    });
  });

  describe('requestContext', () => {
    it('calls vectorQuerySearch with requestContext params', async () => {
      const tool = createVectorQueryTool({
        id: 'test',
        model: mockModel,
        indexName: 'testIndex',
        vectorStoreName: 'testStore',
      });
      const requestContext = new RequestContext();
      requestContext.set('indexName', 'anotherIndex');
      requestContext.set('vectorStoreName', 'anotherStore');
      requestContext.set('topK', 3);
      requestContext.set('filter', { foo: 'bar' });
      requestContext.set('includeVectors', true);
      requestContext.set('includeSources', false);
      const result = await tool.execute(
        {
          queryText: 'foo',
          topK: 6,
        },
        {
          mastra: mockMastra as any,
          requestContext,
        },
      );
      expect(result.relevantContext.length).toBeGreaterThan(0);
      expect(result.sources).toEqual([]); // includeSources false
      expect(vectorQuerySearch).toHaveBeenCalledWith(
        expect.objectContaining({
          indexName: 'anotherIndex',
          vectorStore: {
            anotherStore: {},
          },
          queryText: 'foo',
          model: mockModel,
          queryFilter: { foo: 'bar' },
          topK: 3,
          includeVectors: true,
        }),
      );
    });

    it('handles reranker from requestContext', async () => {
      const tool = createVectorQueryTool({
        id: 'test',
        model: mockModel,
        indexName: 'testIndex',
        vectorStoreName: 'testStore',
      });
      const requestContext = new RequestContext();
      requestContext.set('indexName', 'testIndex');
      requestContext.set('vectorStoreName', 'testStore');
      requestContext.set('reranker', { model: 'reranker-model', options: { topK: 1 } });
      // Mock rerank
      vi.mocked(rerank).mockResolvedValue([
        {
          result: { id: '1', metadata: { text: 'bar' }, score: 1 },
          score: 1,
          details: { semantic: 1, vector: 1, position: 1 },
        },
      ]);
      const result = await tool.execute(
        {
          queryText: 'foo',
          topK: 1,
        },
        {
          mastra: mockMastra as any,
          requestContext,
        },
      );
      expect(result.relevantContext[0]).toEqual({ text: 'bar' });
    });
  });

  describe('providerOptions', () => {
    it('should pass providerOptions to vectorQuerySearch', async () => {
      const tool = createVectorQueryTool({
        indexName: 'testIndex',
        model: mockModel,
        vectorStoreName: 'testStore',
        providerOptions: { google: { outputDimensionality: 1536 } },
      });

      await tool.execute(
        {
          queryText: 'foo',
          topK: 10,
        },
        {
          mastra: mockMastra as any,
          requestContext: new RequestContext(),
        },
      );

      expect(vectorQuerySearch).toHaveBeenCalledWith({
        indexName: 'testIndex',
        vectorStore: { testStore: {} },
        queryText: 'foo',
        model: mockModel,
        queryFilter: undefined,
        topK: 10,
        includeVectors: false,
        databaseConfig: undefined,
        providerOptions: { google: { outputDimensionality: 1536 } },
      });
    });

    it('should allow providerOptions override via requestContext', async () => {
      const tool = createVectorQueryTool({
        indexName: 'testIndex',
        model: mockModel,
        vectorStoreName: 'testStore',
        providerOptions: { google: { outputDimensionality: 1536 } },
      });

      const requestContext = new RequestContext();
      requestContext.set('providerOptions', { google: { outputDimensionality: 768 } });

      await tool.execute(
        {
          queryText: 'foo',
          topK: 10,
        },
        {
          mastra: mockMastra as any,
          requestContext,
        },
      );

      expect(vectorQuerySearch).toHaveBeenCalledWith({
        indexName: 'testIndex',
        vectorStore: { testStore: {} },
        queryText: 'foo',
        model: mockModel,
        queryFilter: undefined,
        topK: 10,
        includeVectors: false,
        databaseConfig: undefined,
        providerOptions: { google: { outputDimensionality: 768 } },
      });
    });
  });

  /**
   * Integration test for issue #9699:
   * Vector tool schema must be valid for LLM providers when used in nested agent scenarios.
   *
   * User scenario from the bug report:
   * - Supervisor agent has a tool that calls Agent B
   * - Agent B has a vectorTool created with createVectorQueryTool
   * - When Agent B is called directly, it works
   * - When Agent B is invoked through the supervisor, the LLM rejects the schema with:
   *   "Invalid schema for function 'vectorTool': In context=('additionalProperties',), schema must have a 'type' key."
   *
   * The root cause: createVectorQueryTool uses z.object(baseSchema).passthrough() when enableFilter=false.
   * Zod v4's toJSONSchema produces additionalProperties: {} for .passthrough(), which is invalid for LLM providers.
   *
   * @see https://github.com/mastra-ai/mastra/issues/9699
   */
  describe('Supervisor agent with sub-agent containing vector tool (issue #9699)', () => {
    /**
     * Helper function to recursively check if a JSON schema has any invalid
     * additionalProperties (empty objects without a 'type' key).
     * This validates what LLM providers check when receiving tool schemas.
     */
    function findInvalidAdditionalProperties(schema: any, path = ''): string[] {
      const issues: string[] = [];

      if (!schema || typeof schema !== 'object') return issues;

      // Check additionalProperties at current level
      if ('additionalProperties' in schema) {
        const addlProps = schema.additionalProperties;
        if (
          addlProps &&
          typeof addlProps === 'object' &&
          !Array.isArray(addlProps) &&
          Object.keys(addlProps).length === 0
        ) {
          issues.push(`${path || 'root'}.additionalProperties is an empty object {}`);
        }
      }

      // Recursively check nested schemas
      if (schema.properties) {
        for (const key of Object.keys(schema.properties)) {
          issues.push(...findInvalidAdditionalProperties(schema.properties[key], `${path}.properties.${key}`));
        }
      }

      if (schema.items) {
        if (Array.isArray(schema.items)) {
          schema.items.forEach((item: any, i: number) => {
            issues.push(...findInvalidAdditionalProperties(item, `${path}.items[${i}]`));
          });
        } else {
          issues.push(...findInvalidAdditionalProperties(schema.items, `${path}.items`));
        }
      }

      if (schema.anyOf) {
        schema.anyOf.forEach((s: any, i: number) => {
          issues.push(...findInvalidAdditionalProperties(s, `${path}.anyOf[${i}]`));
        });
      }

      if (schema.oneOf) {
        schema.oneOf.forEach((s: any, i: number) => {
          issues.push(...findInvalidAdditionalProperties(s, `${path}.oneOf[${i}]`));
        });
      }

      if (schema.allOf) {
        schema.allOf.forEach((s: any, i: number) => {
          issues.push(...findInvalidAdditionalProperties(s, `${path}.allOf[${i}]`));
        });
      }

      return issues;
    }

    /**
     * Simulates what LLM providers do when validating tool schemas.
     * They reject schemas where additionalProperties is an empty object without a 'type' key.
     */
    function validateForLLMProvider(schema: any, toolName: string): { valid: boolean; error?: string } {
      const issues = findInvalidAdditionalProperties(schema);
      if (issues.length > 0) {
        return {
          valid: false,
          error: `Invalid schema for function '${toolName}': In context=('additionalProperties',), schema must have a 'type' key.`,
        };
      }
      return { valid: true };
    }

    it('should reproduce the exact user scenario: supervisor → Agent B → vectorTool', () => {
      // Step 1: Create the vectorTool exactly as the user did
      // From the issue: createVectorQueryTool({ id: "get-sample-results-vector", ... })
      const vectorTool = createVectorQueryTool({
        id: 'get-sample-results-vector',
        description: 'Query the style guideline RAG.',
        vectorStoreName: 'ragStore',
        indexName: 'myrags',
        model: mockModel,
        // Note: enableFilter defaults to false, which uses .passthrough()
      });

      // Step 2: Create Agent B with the vectorTool (from the issue)
      // Note: We use a mock model since we're only testing schema conversion
      const mockLLM = {
        specificationVersion: 'v2',
        provider: 'openai',
        modelId: 'gpt-4o-mini',
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      } as any;

      const agentB = new Agent({
        id: 'agent-b',
        name: 'Agent B',
        instructions: 'You are Agent B with RAG capabilities',
        model: mockLLM,
        tools: { vectorTool },
      });

      // Step 3: Create supervisor agent with Agent B as a sub-agent
      const supervisorAgent = new Agent({
        id: 'supervisor',
        name: 'Supervisor',
        instructions: 'You are a supervisor agent that can call Agent B',
        model: mockLLM,
        agents: { agentB },
      });

      // Step 4: Simulate what happens when Agent B's tools are converted for the LLM
      // This is what happens internally when the supervisor calls Agent B
      // Agent B's tools (including vectorTool) are converted to JSON Schema
      const vectorToolSchema = zodToJsonSchema(vectorTool.inputSchema!);

      // Step 5: Validate the schema against LLM provider requirements
      // This is the exact validation that was failing in the bug report
      const validation = validateForLLMProvider(vectorToolSchema, 'vectorTool');

      // Assert: The schema should be valid for LLM providers
      expect(validation.valid, validation.error).toBe(true);

      // Additional assertions to verify schema structure
      expect(vectorToolSchema.type).toBe('object');
      expect(vectorToolSchema.properties).toHaveProperty('queryText');
      expect(vectorToolSchema.properties).toHaveProperty('topK');

      // The key fix: additionalProperties should be `true`, not `{}`
      if ('additionalProperties' in vectorToolSchema) {
        expect(
          vectorToolSchema.additionalProperties,
          'additionalProperties should be `true` (not empty object) for LLM compatibility',
        ).toBe(true);
      }
    });

    it('should handle nested agent tools with vector tool schemas', () => {
      // This tests a more complex scenario where multiple agents are chained
      const vectorTool = createVectorQueryTool({
        id: 'vectorTool',
        description: 'Query documents',
        vectorStoreName: 'ragStore',
        indexName: 'docs',
        model: mockModel,
      });

      // When Agent B is converted to a tool by the supervisor,
      // the supervisor creates a new tool with a fixed schema for calling Agent B.
      // However, when Agent B actually executes, it converts its own tools (vectorTool)
      // to JSON Schema for the LLM call.

      // This is the exact conversion that happens in Agent.convertTools()
      const toolSchemas: Record<string, { description: string; parameters: any }> = {
        vectorTool: {
          description: vectorTool.description!,
          parameters: zodToJsonSchema(vectorTool.inputSchema!),
        },
      };

      // Validate all tool schemas
      for (const [toolName, toolDef] of Object.entries(toolSchemas)) {
        const validation = validateForLLMProvider(toolDef.parameters, toolName);
        expect(validation.valid, validation.error).toBe(true);
      }
    });

    it('should work with enableFilter=true (different schema path)', () => {
      // When enableFilter is true, the schema uses z.object(filterSchema) without .passthrough()
      // This shouldn't have the additionalProperties issue, but let's verify
      const vectorToolWithFilter = createVectorQueryTool({
        id: 'vectorToolWithFilter',
        description: 'Query with filter',
        vectorStoreName: 'ragStore',
        indexName: 'docs',
        model: mockModel,
        enableFilter: true,
      });

      const schema = zodToJsonSchema(vectorToolWithFilter.inputSchema!);
      const validation = validateForLLMProvider(schema, 'vectorToolWithFilter');

      expect(validation.valid, validation.error).toBe(true);
      expect(schema.properties).toHaveProperty('filter');
    });

    it('should produce valid schema for the exact inputSchema pattern from createVectorQueryTool', () => {
      // This tests the exact schema pattern used in createVectorQueryTool:
      // z.object(baseSchema).passthrough()
      const baseSchema = {
        queryText: z.string().describe('The text to query against the vector store'),
        topK: z.coerce.number().describe('Number of results to return'),
      };

      // This is what createVectorQueryTool does when enableFilter=false
      const passthroughSchema = z.object(baseSchema).passthrough();

      const jsonSchema = zodToJsonSchema(passthroughSchema);

      // Validate for LLM provider compatibility
      const validation = validateForLLMProvider(jsonSchema, 'passthroughTest');
      expect(validation.valid, validation.error).toBe(true);

      // Verify the fix: additionalProperties should be `true`, not `{}`
      expect(jsonSchema.additionalProperties).toBe(true);
    });
  });
});
