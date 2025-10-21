import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Tool } from './tool';
import { isVercelTool } from './toolchecks';

describe('isVercelTool - Type Guard Tests', () => {
  describe('v4 tool detection (with parameters)', () => {
    it('should detect v4 tools with parameters property', () => {
      const v4Tool = {
        parameters: z.object({ name: z.string() }),
        execute: async (_args: any) => ({ result: 'test' }),
      };

      expect(isVercelTool(v4Tool)).toBe(true);
    });

    it('should detect v4 tools with parameters and other properties', () => {
      const v4Tool = {
        description: 'A test tool',
        parameters: z.object({ name: z.string() }),
        execute: async (_args: any) => ({ result: 'test' }),
      };

      expect(isVercelTool(v4Tool)).toBe(true);
    });
  });

  describe('v5 tool detection (with inputSchema) - BUG TESTS', () => {
    it('should detect v5 tools with inputSchema property', () => {
      const v5Tool = {
        inputSchema: z.object({ name: z.string() }),
        execute: async (_args: any) => ({ result: 'test' }),
      };

      // THIS WILL FAIL - demonstrates the bug
      // Current implementation only checks for 'parameters', not 'inputSchema'
      expect(isVercelTool(v5Tool)).toBe(true);
    });

    it('should detect v5 tools with inputSchema and description', () => {
      const v5Tool = {
        description: 'A v5 test tool',
        inputSchema: z.object({ query: z.string() }),
        execute: async (_args: any) => ({ results: [] }),
      };

      // THIS WILL FAIL - demonstrates the bug
      expect(isVercelTool(v5Tool)).toBe(true);
    });

    it('should detect v5 tools with function inputSchema', () => {
      const v5Tool = {
        inputSchema: z.object({ dynamic: z.string() }),
        execute: async (_args: any) => ({ result: 'test' }),
      };

      // THIS WILL FAIL - demonstrates the bug
      expect(isVercelTool(v5Tool)).toBe(true);
    });

    it('should detect provider-defined v5 tools (like google.tools.googleSearch)', () => {
      const googleSearchTool = {
        type: 'provider-defined' as const,
        id: 'google.googleSearch' as `${string}.${string}`,
        name: 'googleSearch',
        args: {},
        inputSchema: z.object({
          query: z.string(),
          maxResults: z.number().optional(),
        }),
        execute: async (_args: { query: string; maxResults?: number }) => ({
          results: [],
        }),
      };

      // THIS WILL FAIL - demonstrates the bug
      // This is the real-world case from issue #8455
      expect(isVercelTool(googleSearchTool)).toBe(true);
    });
  });

  describe('Mastra tool exclusion', () => {
    it('should return false for Mastra Tool instances', () => {
      const mastraTool = new Tool({
        id: 'test.tool',
        description: 'A test tool',
        inputSchema: z.object({ name: z.string() }),
        execute: async ({ context }: any) => ({ result: 'test' }),
      });

      expect(isVercelTool(mastraTool)).toBe(false);
    });

    it('should return false for Mastra Tool instances even with inputSchema', () => {
      const mastraTool = new Tool({
        id: 'mastra.custom',
        description: 'Custom Mastra tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async ({ context }: any) => ({ processed: context.data }),
      });

      // Should be false because it's a Mastra Tool instance
      expect(isVercelTool(mastraTool)).toBe(false);
    });
  });

  describe('Hybrid tools (both parameters and inputSchema)', () => {
    it('should detect tools with both parameters and inputSchema', () => {
      // Some tools might have both during migration from v4 to v5
      const hybridTool = {
        parameters: z.object({ old: z.string() }),
        inputSchema: z.object({ new: z.string() }),
        execute: async (_args: any) => ({ result: _args }),
      };

      // Should be detected as Vercel tool (has parameters)
      expect(isVercelTool(hybridTool)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should return false for undefined', () => {
      expect(isVercelTool(undefined)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isVercelTool(null as any)).toBe(false);
    });

    it('should return false for plain objects without parameters or inputSchema', () => {
      const plainObject = {
        name: 'test',
        execute: async () => ({ result: 'test' }),
      };

      expect(isVercelTool(plainObject as any)).toBe(false);
    });

    it('should return false for objects with only execute function', () => {
      const executeOnly = {
        execute: async (_args: any) => _args,
      };

      expect(isVercelTool(executeOnly as any)).toBe(false);
    });

    it('should return false for objects with only description', () => {
      const descriptionOnly = {
        description: 'A tool',
      };

      expect(isVercelTool(descriptionOnly as any)).toBe(false);
    });
  });
});
