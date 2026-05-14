import { createTool } from '@mastra/core/tools';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { deepMerge, transformTools } from './utils';

describe('deepMerge', () => {
  it('composes nested plain-object fields', () => {
    expect(deepMerge({ audio: { output: { voice: 'Dennis' } } }, { audio: { output: { speed: 1.1 } } })).toEqual({
      audio: { output: { voice: 'Dennis', speed: 1.1 } },
    });
  });

  it('replaces arrays rather than merging them', () => {
    expect(deepMerge({ tools: [1, 2, 3] }, { tools: [9] })).toEqual({ tools: [9] });
  });

  it('lets source override scalars', () => {
    expect(deepMerge({ temperature: 0.2 }, { temperature: 0.9 })).toEqual({ temperature: 0.9 });
  });

  it('leaves target untouched when source omits the key', () => {
    const target = { audio: { output: { voice: 'Dennis' } }, model: 'foo' };
    expect(deepMerge(target, { temperature: 0.5 })).toEqual({ ...target, temperature: 0.5 });
  });
});

describe('transformTools', () => {
  describe('Basic Tool Transformation', () => {
    it('should transform a tool with Zod inputSchema to Inworld format', () => {
      const tool = createTool({
        id: 'zodTool',
        description: 'A tool with Zod schema',
        inputSchema: z.object({
          name: z.string(),
          age: z.number().optional(),
        }),
        outputSchema: z.string(),
        execute: async input => {
          return `Hello, ${input.name}`;
        },
      });

      const transformed = transformTools({ zodTool: tool });

      expect(transformed).toHaveLength(1);
      expect(transformed[0]).toMatchObject({
        type: 'function',
        name: 'zodTool',
        description: 'A tool with Zod schema',
        parameters: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            name: expect.objectContaining({ type: 'string' }),
            age: expect.objectContaining({ type: 'number' }),
          }),
          required: ['name'],
        }),
      });
    });

    it('should transform a tool with JSON schema parameters', () => {
      const tool = {
        id: 'jsonTool',
        description: 'A tool with JSON schema',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'integer' },
          },
          required: ['query'],
        },
        execute: async (args: { query: string; limit?: number }) => {
          return `Searched for: ${args.query}`;
        },
      };

      const transformed = transformTools({ jsonTool: tool });

      expect(transformed).toHaveLength(1);
      expect(transformed[0]).toMatchObject({
        type: 'function',
        name: 'jsonTool',
        description: 'A tool with JSON schema',
        parameters: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            query: expect.objectContaining({ type: 'string' }),
            limit: expect.objectContaining({ type: 'integer' }),
          }),
          required: ['query'],
        }),
      });
    });
  });

  describe('Tool filtering', () => {
    it('should skip tools without an execute function', () => {
      const tool = {
        id: 'inertTool',
        description: 'A tool with no execute',
        parameters: { type: 'object', properties: {} },
      } as any;

      expect(transformTools({ inertTool: tool })).toHaveLength(0);
    });
  });
});
