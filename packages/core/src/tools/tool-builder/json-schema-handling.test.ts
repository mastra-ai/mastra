import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod';
import { ModelFactory } from '../../llm/model-factory';
import type { ToolOptions } from '../../utils';
import { CoreToolBuilder } from './builder';

describe('CoreToolBuilder - JSON Schema Handling', () => {
  let mockToolOptions: ToolOptions;

  beforeEach(() => {
    const mockModel = ModelFactory.createOpenAIModel({
      modelId: 'gpt-4',
      apiKey: 'test-key',
    });

    mockToolOptions = {
      name: 'test-tool',
      runId: 'test-run',
      logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        trackException: () => {},
      } as any,
      requestContext: {} as any,
      model: mockModel,
    };
  });

  it('should handle plain JSON Schema for client tools', () => {
    const jsonSchema = {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const },
        age: { type: 'number' as const },
      },
      required: ['name'],
    };

    const tool = {
      id: 'test-tool',
      description: 'Test tool with JSON Schema',
      inputSchema: jsonSchema,
      execute: async (args: any) => {
        return { result: 'success', receivedName: args.name };
      },
    };

    const builder = new CoreToolBuilder({
      originalTool: tool,
      options: mockToolOptions,
      logType: 'client-tool',
    });

    const coreTool = builder.build();

    expect(coreTool).toBeDefined();
    expect(coreTool.parameters).toBeDefined();
    expect(coreTool.description).toBe('Test tool with JSON Schema');
    expect(coreTool.execute).toBeDefined();

    // The parameters should have jsonSchema property (AI SDK Schema format)
    expect((coreTool.parameters as any).jsonSchema).toBeDefined();
    expect((coreTool.parameters as any).jsonSchema.type).toBe('object');
    expect((coreTool.parameters as any).jsonSchema.properties).toBeDefined();
  });

  it('should handle Zod schemas for regular tools', () => {
    const zodSchema = z.object({
      query: z.string().describe('Search query'),
      limit: z.number().min(1).max(100).default(10),
    });

    const tool = {
      id: 'search-tool',
      description: 'Search tool with Zod Schema',
      inputSchema: zodSchema,
      execute: async (args: z.infer<typeof zodSchema>) => {
        return { results: [], query: args.query, limit: args.limit };
      },
    };

    const builder = new CoreToolBuilder({
      originalTool: tool,
      options: mockToolOptions,
      logType: 'tool',
    });

    const coreTool = builder.build();

    expect(coreTool).toBeDefined();
    expect(coreTool.parameters).toBeDefined();
    expect(coreTool.description).toBe('Search tool with Zod Schema');

    // Should be converted to AI SDK Schema
    expect((coreTool.parameters as any).jsonSchema).toBeDefined();
    expect((coreTool.parameters as any).jsonSchema.type).toBe('object');
  });

  it('should handle complex nested JSON Schema', () => {
    const complexJsonSchema = {
      type: 'object' as const,
      properties: {
        user: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const },
            email: { type: 'string' as const, format: 'email' },
            address: {
              type: 'object' as const,
              properties: {
                street: { type: 'string' as const },
                city: { type: 'string' as const },
                zipCode: { type: 'string' as const },
              },
              required: ['city'],
            },
          },
          required: ['name', 'email'],
        },
        tags: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
        metadata: {
          type: 'object' as const,
          additionalProperties: true,
        },
      },
      required: ['user'],
    };

    const tool = {
      id: 'complex-tool',
      description: 'Tool with complex nested JSON Schema',
      inputSchema: complexJsonSchema,
      execute: async (args: any) => {
        return { received: args };
      },
    };

    const builder = new CoreToolBuilder({
      originalTool: tool,
      options: mockToolOptions,
      logType: 'client-tool',
    });

    const coreTool = builder.build();

    expect(coreTool).toBeDefined();
    expect(coreTool.parameters).toBeDefined();

    const jsonSchema = (coreTool.parameters as any).jsonSchema;
    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties.user).toBeDefined();
    expect(jsonSchema.properties.user.type).toBe('object');
    expect(jsonSchema.properties.user.properties.address).toBeDefined();
  });

  it('should handle JSON Schema with various types', () => {
    const typesSchema = {
      type: 'object' as const,
      properties: {
        stringProp: { type: 'string' as const },
        numberProp: { type: 'number' as const },
        integerProp: { type: 'integer' as const },
        booleanProp: { type: 'boolean' as const },
        arrayProp: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
        nullProp: { type: 'null' as const },
      },
    };

    const tool = {
      id: 'types-tool',
      description: 'Tool testing various JSON Schema types',
      inputSchema: typesSchema,
      execute: async (args: any) => {
        return { success: true };
      },
    };

    const builder = new CoreToolBuilder({
      originalTool: tool,
      options: mockToolOptions,
      logType: 'client-tool',
    });

    const coreTool = builder.build();

    expect(coreTool).toBeDefined();
    const jsonSchema = (coreTool.parameters as any).jsonSchema;
    expect(jsonSchema.properties.stringProp.type).toBe('string');
    expect(jsonSchema.properties.numberProp.type).toBe('number');
    expect(jsonSchema.properties.integerProp.type).toBe('integer');
    expect(jsonSchema.properties.booleanProp.type).toBe('boolean');
    expect(jsonSchema.properties.arrayProp.type).toBe('array');
    expect(jsonSchema.properties.nullProp.type).toBe('null');
  });

  it('should handle tool without schema', () => {
    const tool = {
      id: 'no-schema-tool',
      description: 'Tool without input schema',
      execute: async () => {
        return { result: 'success' };
      },
    };

    const builder = new CoreToolBuilder({
      originalTool: tool,
      options: mockToolOptions,
      logType: 'tool',
    });

    const coreTool = builder.build();

    expect(coreTool).toBeDefined();
    expect(coreTool.description).toBe('Tool without input schema');
    expect(coreTool.execute).toBeDefined();
  });

  it('should handle output schema as JSON Schema', () => {
    const inputSchema = {
      type: 'object' as const,
      properties: {
        query: { type: 'string' as const },
      },
    };

    const outputSchema = {
      type: 'object' as const,
      properties: {
        results: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
        count: { type: 'number' as const },
      },
    };

    const tool = {
      id: 'output-schema-tool',
      description: 'Tool with output schema',
      inputSchema,
      outputSchema,
      execute: async (args: any) => {
        return { results: ['result1', 'result2'], count: 2 };
      },
    };

    const builder = new CoreToolBuilder({
      originalTool: tool,
      options: mockToolOptions,
      logType: 'client-tool',
    });

    const coreTool = builder.build();

    expect(coreTool).toBeDefined();
    expect(coreTool.outputSchema).toBeDefined();

    const outputJsonSchema = (coreTool.outputSchema as any).jsonSchema;
    expect(outputJsonSchema).toBeDefined();
    expect(outputJsonSchema.type).toBe('object');
    expect(outputJsonSchema.properties.results).toBeDefined();
    expect(outputJsonSchema.properties.count).toBeDefined();
  });
});
