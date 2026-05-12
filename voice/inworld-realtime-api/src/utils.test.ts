import { createTool } from '@mastra/core/tools';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { transformTools } from './utils';

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
      const { inworldTool } = transformed[0];
      expect(inworldTool).toMatchObject({
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
      const { inworldTool } = transformed[0];
      expect(inworldTool).toMatchObject({
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

  describe('Tool Execution Tests', () => {
    it('should create an adapter function for tool execution', async () => {
      const tool = createTool({
        id: 'messageTool',
        description: 'A tool that processes a message',
        inputSchema: z.object({ message: z.string() }),
        outputSchema: z.string(),
        execute: async input => `Processed: ${input.message}`,
      });

      const transformed = transformTools({ messageTool: tool });
      const result = await transformed[0].execute({ message: 'Hello' });
      expect(result).toBe('Processed: Hello');
    });
  });
});
