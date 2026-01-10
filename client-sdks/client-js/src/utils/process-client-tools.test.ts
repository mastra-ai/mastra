import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ToolsInput } from '@mastra/core/agent';
import { processClientTools } from './process-client-tools';

describe('processClientTools', () => {
  it('should return undefined for undefined input', () => {
    expect(processClientTools(undefined)).toBeUndefined();
  });

  it('should pass through plain JSON Schema unchanged for Mastra tools', () => {
    const jsonSchema = {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const },
        age: { type: 'number' as const },
      },
      required: ['name'],
    };

    const clientTools: ToolsInput = {
      testTool: {
        id: 'testTool',
        description: 'A test tool',
        inputSchema: jsonSchema,
        outputSchema: jsonSchema,
      },
    };

    const result = processClientTools(clientTools);

    expect(result).toBeDefined();
    expect(result!.testTool.inputSchema).toEqual(jsonSchema);
    expect(result!.testTool.outputSchema).toEqual(jsonSchema);
  });

  it('should convert Zod schemas to JSON Schema for Mastra tools', () => {
    const zodSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const clientTools: ToolsInput = {
      testTool: {
        id: 'testTool',
        description: 'A test tool',
        inputSchema: zodSchema,
        outputSchema: zodSchema,
      },
    };

    const result = processClientTools(clientTools);

    expect(result).toBeDefined();
    // Zod schema should be converted to JSON Schema
    expect(result!.testTool.inputSchema).not.toBe(zodSchema);
    expect(result!.testTool.inputSchema).toHaveProperty('type', 'object');
    expect(result!.testTool.inputSchema).toHaveProperty('properties');
    expect(result!.testTool.outputSchema).toHaveProperty('type', 'object');
  });

  it('should handle mixed Zod and JSON Schema tools', () => {
    const zodSchema = z.object({
      query: z.string(),
    });

    const jsonSchema = {
      type: 'object' as const,
      properties: {
        color: { type: 'string' as const },
      },
    };

    const clientTools: ToolsInput = {
      zodTool: {
        id: 'zodTool',
        description: 'Uses Zod',
        inputSchema: zodSchema,
      },
      jsonTool: {
        id: 'jsonTool',
        description: 'Uses JSON Schema',
        inputSchema: jsonSchema,
      },
    };

    const result = processClientTools(clientTools);

    expect(result).toBeDefined();
    // Zod schema should be converted
    expect(result!.zodTool.inputSchema).toHaveProperty('type', 'object');
    // JSON Schema should pass through unchanged
    expect(result!.jsonTool.inputSchema).toEqual(jsonSchema);
  });

  it('should handle tools without schemas', () => {
    const clientTools: ToolsInput = {
      testTool: {
        id: 'testTool',
        description: 'A test tool',
      },
    };

    const result = processClientTools(clientTools);

    expect(result).toBeDefined();
    expect(result!.testTool.inputSchema).toBeUndefined();
    expect(result!.testTool.outputSchema).toBeUndefined();
  });

  it('should preserve other tool properties', () => {
    const clientTools: ToolsInput = {
      testTool: {
        id: 'testTool',
        description: 'A test tool',
        inputSchema: z.object({ name: z.string() }),
        // @ts-expect-error - adding custom property for testing
        customProp: 'custom value',
      },
    };

    const result = processClientTools(clientTools);

    expect(result).toBeDefined();
    expect(result!.testTool.id).toBe('testTool');
    expect(result!.testTool.description).toBe('A test tool');
    // @ts-expect-error - accessing custom property
    expect(result!.testTool.customProp).toBe('custom value');
  });

  it('should handle complex nested JSON Schemas', () => {
    const complexSchema = {
      type: 'object' as const,
      properties: {
        user: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const },
            address: {
              type: 'object' as const,
              properties: {
                street: { type: 'string' as const },
                city: { type: 'string' as const },
              },
            },
          },
        },
        tags: {
          type: 'array' as const,
          items: { type: 'string' as const },
        },
      },
    };

    const clientTools: ToolsInput = {
      testTool: {
        id: 'testTool',
        description: 'A test tool',
        inputSchema: complexSchema,
      },
    };

    const result = processClientTools(clientTools);

    expect(result).toBeDefined();
    expect(result!.testTool.inputSchema).toEqual(complexSchema);
  });

  describe('Vercel AI SDK tools', () => {
    it('should convert Zod schemas for Vercel AI SDK tools with parameters field', () => {
      const zodSchema = z.object({
        query: z.string().describe('The search query'),
        limit: z.number().optional().describe('Maximum results'),
      });

      const clientTools: ToolsInput = {
        searchTool: {
          id: 'searchTool',
          description: 'A search tool',
          parameters: zodSchema,
        },
      };

      const result = processClientTools(clientTools);

      expect(result).toBeDefined();
      expect(result!.searchTool.parameters).toBeDefined();
      expect(result!.searchTool.parameters).not.toBe(zodSchema);
      expect(result!.searchTool.parameters).toHaveProperty('type', 'object');
      expect(result!.searchTool.parameters).toHaveProperty('properties');
      // Verify it doesn't have Zod internal structure
      expect(result!.searchTool.parameters).not.toHaveProperty('_def');
      expect(result!.searchTool.parameters).not.toHaveProperty('shape');
    });

    it('should pass through JSON Schema for Vercel AI SDK tools', () => {
      const jsonSchema = {
        type: 'object' as const,
        properties: {
          city: { type: 'string' as const },
        },
        required: ['city'],
      };

      const clientTools: ToolsInput = {
        weatherTool: {
          id: 'weatherTool',
          description: 'Get weather',
          parameters: jsonSchema,
        },
      };

      const result = processClientTools(clientTools);

      expect(result).toBeDefined();
      expect(result!.weatherTool.parameters).toEqual(jsonSchema);
    });

    it('should handle Vercel AI SDK tools without parameters', () => {
      const clientTools: ToolsInput = {
        noParamTool: {
          id: 'noParamTool',
          description: 'No parameters',
        },
      };

      const result = processClientTools(clientTools);

      expect(result).toBeDefined();
      expect(result!.noParamTool.parameters).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should treat tools with both parameters and inputSchema as Mastra tools', () => {
      // This is an edge case - if a tool somehow has both fields,
      // we treat it as a Mastra tool (inputSchema takes precedence)
      const zodSchema = z.object({
        name: z.string(),
      });

      const clientTools: ToolsInput = {
        edgeCaseTool: {
          id: 'edgeCaseTool',
          description: 'Has both fields',
          parameters: zodSchema,
          inputSchema: zodSchema,
        },
      };

      const result = processClientTools(clientTools);

      expect(result).toBeDefined();
      // Should process as Mastra tool (inputSchema is processed, parameters is left alone)
      expect(result!.edgeCaseTool.inputSchema).toBeDefined();
      expect(result!.edgeCaseTool.inputSchema).toHaveProperty('type', 'object');
      // parameters should be passed through unchanged
      expect(result!.edgeCaseTool.parameters).toBe(zodSchema);
    });

    it('should not expose Zod internal structure in converted schemas', () => {
      const zodSchema = z.object({
        location: z.string(),
        unit: z.enum(['celsius', 'fahrenheit']),
      });

      const clientTools: ToolsInput = {
        weatherTool: {
          id: 'weatherTool',
          description: 'Get weather',
          inputSchema: zodSchema,
        },
      };

      const result = processClientTools(clientTools);

      expect(result).toBeDefined();
      const schema = result!.weatherTool.inputSchema;

      // Verify JSON Schema structure
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');

      // Verify no Zod internal structure
      expect(schema).not.toHaveProperty('_def');
      expect(schema).not.toHaveProperty('shape');
      expect(schema).not.toHaveProperty('_cached');
      expect(schema).not.toHaveProperty('parse');
      expect(schema).not.toHaveProperty('safeParse');
    });

    it('should handle complex Zod schemas with various types', () => {
      const complexZodSchema = z.object({
        stringField: z.string().describe('A string'),
        numberField: z.number().min(0).max(100),
        booleanField: z.boolean(),
        optionalField: z.string().optional(),
        arrayField: z.array(z.string()),
        enumField: z.enum(['option1', 'option2', 'option3']),
        nestedObject: z.object({
          nestedString: z.string(),
          nestedNumber: z.number(),
        }),
        union: z.union([z.string(), z.number()]),
      });

      const clientTools: ToolsInput = {
        complexTool: {
          id: 'complexTool',
          description: 'Complex schema test',
          inputSchema: complexZodSchema,
        },
      };

      const result = processClientTools(clientTools);

      expect(result).toBeDefined();
      const schema = result!.complexTool.inputSchema;

      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
      expect(schema.properties).toHaveProperty('stringField');
      expect(schema.properties).toHaveProperty('numberField');
      expect(schema.properties).toHaveProperty('booleanField');
      expect(schema.properties).toHaveProperty('arrayField');
      expect(schema.properties).toHaveProperty('enumField');
      expect(schema.properties).toHaveProperty('nestedObject');

      // Verify no Zod internals
      expect(schema).not.toHaveProperty('_def');
    });

    it('should handle both inputSchema and outputSchema for Mastra tools', () => {
      const inputSchema = z.object({
        query: z.string(),
      });

      const outputSchema = z.object({
        result: z.string(),
        count: z.number(),
      });

      const clientTools: ToolsInput = {
        searchTool: {
          id: 'searchTool',
          description: 'Search tool',
          inputSchema,
          outputSchema,
        },
      };

      const result = processClientTools(clientTools);

      expect(result).toBeDefined();
      expect(result!.searchTool.inputSchema).toBeDefined();
      expect(result!.searchTool.outputSchema).toBeDefined();
      expect(result!.searchTool.inputSchema).toHaveProperty('type', 'object');
      expect(result!.searchTool.outputSchema).toHaveProperty('type', 'object');
      expect(result!.searchTool.inputSchema.properties).toHaveProperty('query');
      expect(result!.searchTool.outputSchema.properties).toHaveProperty('result');
      expect(result!.searchTool.outputSchema.properties).toHaveProperty('count');
    });

    it('should handle empty object schemas', () => {
      const emptySchema = z.object({});

      const clientTools: ToolsInput = {
        emptyTool: {
          id: 'emptyTool',
          description: 'Empty schema',
          inputSchema: emptySchema,
        },
      };

      const result = processClientTools(clientTools);

      expect(result).toBeDefined();
      expect(result!.emptyTool.inputSchema).toHaveProperty('type', 'object');
    });
  });

  describe('Regression test for issue #11668', () => {
    it('should correctly convert the weather tool schema that originally caused the bug', () => {
      // This is the exact schema from the bug report
      const weatherToolSchema = z.object({
        location: z.string().describe('The city and state, e.g. San Francisco, CA'),
        unit: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature unit'),
      });

      const clientTools: ToolsInput = {
        weatherTool: {
          id: 'weatherTool',
          description: 'Get the current weather in a given location',
          inputSchema: weatherToolSchema,
          outputSchema: z.object({
            temperature: z.number(),
            condition: z.string(),
          }),
        },
      };

      const result = processClientTools(clientTools);

      expect(result).toBeDefined();
      const inputSchema = result!.weatherTool.inputSchema;

      // Verify proper JSON Schema structure (not Zod internal structure)
      expect(inputSchema).toHaveProperty('type', 'object');
      expect(inputSchema).toHaveProperty('properties');
      expect(inputSchema.properties).toHaveProperty('location');
      expect(inputSchema.properties).toHaveProperty('unit');
      expect(inputSchema).toHaveProperty('required');

      // Verify no Zod internal structure that caused OpenAI "Invalid schema" error
      expect(inputSchema).not.toHaveProperty('_def');
      expect(inputSchema).not.toHaveProperty('shape');

      // Verify descriptions are preserved
      expect(inputSchema.properties.location).toHaveProperty('description');
      expect(inputSchema.properties.unit).toHaveProperty('description');

      // Verify the output schema is also converted properly
      const outputSchema = result!.weatherTool.outputSchema;
      expect(outputSchema).toHaveProperty('type', 'object');
      expect(outputSchema.properties).toHaveProperty('temperature');
      expect(outputSchema.properties).toHaveProperty('condition');
    });
  });
});
