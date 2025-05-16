import { createTool } from '@mastra/core/tools';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { transformTools } from './utils';

// Vitest provides these globals automatically, but we can import them explicitly for clarity

describe('transformTools', () => {
  describe('Basic Tool Transformation', () => {
    it('should transform a tool with Zod inputSchema to OpenAI format', () => {
      // Create a test tool with Zod schema
      const tool = createTool({
        id: 'zodTool',
        description: 'A tool with Zod schema',
        inputSchema: z.object({
          name: z.string(),
          age: z.number().optional(),
        }),
        outputSchema: z.string(),
        execute: async ({ context }) => {
          return `Hello, ${context.name}`;
        },
      });

      // Transform the tool
      const transformedTools = transformTools({
        zodTool: tool,
      });

      // Assert the transformation results
      expect(transformedTools).toHaveLength(1);
      const { openaiTool } = transformedTools[0];

      expect(openaiTool).toMatchObject({
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

    it('should transform a tool with JSON schema parameters to OpenAI format', () => {
      // Create a test tool with direct JSON schema
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

      // Transform the tool
      const transformedTools = transformTools({
        jsonTool: tool,
      });

      // Assert the transformation results
      expect(transformedTools).toHaveLength(1);
      const { openaiTool } = transformedTools[0];

      expect(openaiTool).toMatchObject({
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
      // Create a tool that expects context
      const tool = createTool({
        id: 'messageTool',
        description: 'A tool that processes a message',
        inputSchema: z.object({
          message: z.string(),
        }),
        outputSchema: z.string(),
        execute: async ({ context }) => {
          return `Processed: ${context.message}`;
        },
      });

      // Transform the tool
      const transformedTools = transformTools({
        messageTool: tool,
      });

      // Execute the transformed tool
      const result = await transformedTools[0].execute({ message: 'Hello' });

      // Verify the adapter correctly passes the context
      expect(result).toBe('Processed: Hello');
    });
  });
});
