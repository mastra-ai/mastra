import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { processClientTools } from './process-client-tools';

/**
 * NOTE: These tests currently PASS even though isVercelTool has a bug.
 *
 * REASON: v5 tools fail the isVercelTool check and go to the ELSE branch,
 * which happens to convert inputSchema correctly. So the bug doesn't
 * cause failures here, but it's semantically wrong - v5 tools ARE Vercel
 * tools and should go through the IF branch, not the ELSE branch.
 *
 * The else branch is meant for Mastra tools, not v5 Vercel tools.
 */
describe('processClientTools - isVercelTool bug impact', () => {
  describe('v4 tool processing', () => {
    it('should convert v4 tool parameters from Zod to JSON schema', () => {
      const v4Tool = {
        description: 'V4 test tool',
        parameters: z.object({
          input: z.string(),
          count: z.number().optional(),
        }),
        execute: async (_args: any) => ({ result: 'test' }),
      };

      const tools = { testTool: v4Tool };
      const result = processClientTools(tools);

      expect(result).toBeDefined();
      expect(result!.testTool).toBeDefined();

      // Parameters should be converted to JSON schema (plain object, not Zod)
      const resultTool = result!.testTool;
      expect(resultTool.parameters).toBeDefined();
      expect(resultTool.parameters).not.toHaveProperty('_def'); // Not a Zod object
      expect(typeof resultTool.parameters).toBe('object');

      // Should have JSON schema properties
      expect(resultTool.parameters.type).toBe('object');
      expect(resultTool.parameters.properties).toBeDefined();
    });
  });

  describe('v5 tool processing - BUG TESTS', () => {
    it('should convert v5 tool inputSchema from Zod to JSON schema', () => {
      const v5Tool = {
        description: 'V5 test tool',
        inputSchema: z.object({
          query: z.string(),
          maxResults: z.number().optional(),
        }),
        execute: async (_args: any) => ({ results: [] }),
      };

      const tools = { testTool: v5Tool };
      const result = processClientTools(tools);

      expect(result).toBeDefined();
      expect(result!.testTool).toBeDefined();

      const resultTool = result!.testTool;

      // THIS WILL FAIL - v5 tools skip isVercelTool check
      // so they go to else branch which converts inputSchema
      // Expected: inputSchema should be JSON schema
      // Actual: inputSchema might still be Zod OR undefined
      expect(resultTool.inputSchema).toBeDefined();
      expect(resultTool.inputSchema).not.toHaveProperty('_def'); // Not a Zod object
      expect(typeof resultTool.inputSchema).toBe('object');

      // Should have JSON schema properties
      expect(resultTool.inputSchema.type).toBe('object');
      expect(resultTool.inputSchema.properties).toBeDefined();
    });

    it('should handle provider-defined v5 tools correctly', () => {
      const googleSearchTool = {
        type: 'provider-defined' as const,
        id: 'google.googleSearch' as `${string}.${string}`,
        description: 'Search Google',
        inputSchema: z.object({
          query: z.string(),
          maxResults: z.number().optional(),
        }),
        execute: async (_args: any) => ({ results: [] }),
      };

      const tools = { googleSearch: googleSearchTool };
      const result = processClientTools(tools);

      expect(result).toBeDefined();
      expect(result!.googleSearch).toBeDefined();

      const resultTool = result!.googleSearch;

      // THIS WILL FAIL - provider v5 tools also skip isVercelTool
      expect(resultTool.inputSchema).toBeDefined();
      expect(resultTool.inputSchema).not.toHaveProperty('_def');
      expect(typeof resultTool.inputSchema).toBe('object');
      expect(resultTool.inputSchema.type).toBe('object');
    });
  });

  describe('Edge cases', () => {
    it('should return undefined for undefined tools', () => {
      const result = processClientTools(undefined);
      expect(result).toBeUndefined();
    });

    it('should handle empty tools object', () => {
      const result = processClientTools({});
      expect(result).toEqual({});
    });

    it('should handle Mastra tools', () => {
      // Mastra tools would go through else branch and get inputSchema converted
      const mastraTool = {
        id: 'test.tool',
        description: 'Mastra tool',
        inputSchema: z.object({ data: z.string() }),
        execute: async (_context: any) => ({ result: 'test' }),
      };

      const tools = { mastraTool: mastraTool };
      const result = processClientTools(tools);

      expect(result).toBeDefined();
      expect(result!.mastraTool).toBeDefined();

      const resultTool = result!.mastraTool;
      // Mastra tools go through else branch, so inputSchema gets converted
      expect(resultTool.inputSchema).toBeDefined();
    });
  });
});
