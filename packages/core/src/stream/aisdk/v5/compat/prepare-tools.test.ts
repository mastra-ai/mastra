import { describe, it, expect } from 'vitest';
import { prepareToolsAndToolChoice } from './prepare-tools';

describe('prepareToolsAndToolChoice - plain JSON Schema handling', () => {
  it('should handle plain JSON Schema objects from client tools', () => {
    // Simulate a client tool with a plain JSON Schema (as sent by @mastra/client-js)
    const tools = {
      example: {
        type: 'function' as const,
        description: 'Example client tool.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        execute: async () => ({ result: 'ok' }),
      },
    };

    const result = prepareToolsAndToolChoice({
      tools,
      toolChoice: undefined,
      activeTools: undefined,
      targetVersion: 'v2',
    });

    expect(result.tools).toHaveLength(1);
    const tool = result.tools[0] as any;
    expect(tool.type).toBe('function');
    expect(tool.inputSchema.type).toBe('object');
    expect(tool.inputSchema.properties).toEqual({});
  });

  it('should handle plain JSON Schema with $schema from draft 2020-12', () => {
    const tools = {
      example: {
        type: 'function' as const,
        description: 'Example client tool.',
        inputSchema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        execute: async () => ({ result: 'ok' }),
      },
    };

    const result = prepareToolsAndToolChoice({
      tools,
      toolChoice: undefined,
      activeTools: undefined,
      targetVersion: 'v2',
    });

    expect(result.tools).toHaveLength(1);
    const tool = result.tools[0] as any;
    expect(tool.inputSchema.type).toBe('object');
  });

  it('should handle plain JSON Schema without $schema but with properties', () => {
    const tools = {
      example: {
        type: 'function' as const,
        description: 'Example tool.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
        execute: async () => ({ result: 'ok' }),
      },
    };

    const result = prepareToolsAndToolChoice({
      tools,
      toolChoice: undefined,
      activeTools: undefined,
      targetVersion: 'v2',
    });

    expect(result.tools).toHaveLength(1);
    const tool = result.tools[0] as any;
    expect(tool.inputSchema.type).toBe('object');
    expect(tool.inputSchema.properties?.name?.type).toBe('string');
  });
});
