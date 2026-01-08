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
});
