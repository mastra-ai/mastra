import { describe, it, expect, expectTypeOf } from 'vitest';
import { z } from 'zod';
import { z as zv4 } from 'zod/v4';

import type { ZodLikeSchema } from '../types/zod-compat';
import { createTool } from './tool';

describe('Zod v3 and v4 Compatibility', () => {
  describe('Type Compatibility', () => {
    it('should accept Zod v3 schemas', () => {
      // This should compile without type errors
      const tool = createTool({
        id: 'v3-tool',
        description: 'Tool with Zod v3 schemas',
        inputSchema: z.object({
          name: z.string(),
          age: z.number(),
        }),
        outputSchema: z.object({
          message: z.string(),
        }),
        execute: async input => {
          // Type checking: input should have name and age
          expectTypeOf(input).toHaveProperty('name');
          expectTypeOf(input).toHaveProperty('age');
          return {
            message: `Hello ${input.name}, you are ${input.age} years old`,
          };
        },
      });

      expect(tool).toBeDefined();
      expect(tool.id).toBe('v3-tool');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
    });

    it('should accept Zod v4 schemas', () => {
      // This test reproduces the fix for issue #8060
      // Previously, this would cause type errors with Zod v4
      const tool = createTool({
        id: 'v4-tool',
        description: 'Tool with Zod v4 schemas',
        inputSchema: zv4.object({
          input: zv4.string(),
        }),
        outputSchema: zv4.object({
          output: zv4.string(),
        }),
        execute: async input => {
          const { input: inputStr } = input;
          const reversed = inputStr.split('').reverse().join('');
          return {
            output: reversed,
          };
        },
      });

      expect(tool).toBeDefined();
      expect(tool.id).toBe('v4-tool');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
    });

    it('should validate that both v3 and v4 schemas match ZodLikeSchema interface', () => {
      // Zod v3 schema
      const v3Schema = z.object({ test: z.string() });

      // Zod v4 schema
      const v4Schema = zv4.object({ test: zv4.string() });

      // Both should have the required methods
      expect(v3Schema).toHaveProperty('parse');
      expect(v3Schema).toHaveProperty('safeParse');
      expect(typeof v3Schema.parse).toBe('function');
      expect(typeof v3Schema.safeParse).toBe('function');

      expect(v4Schema).toHaveProperty('parse');
      expect(v4Schema).toHaveProperty('safeParse');
      expect(typeof v4Schema.parse).toBe('function');
      expect(typeof v4Schema.safeParse).toBe('function');

      // Type assertion to ensure they match our interface
      const testV3: ZodLikeSchema = v3Schema;
      const testV4: ZodLikeSchema = v4Schema;

      expect(testV3).toBeDefined();
      expect(testV4).toBeDefined();
    });
  });

  describe('Runtime Behavior', () => {
    it('should execute tools with Zod v3 schemas correctly', async () => {
      const tool = createTool({
        id: 'runtime-v3',
        description: 'Runtime test with v3',
        inputSchema: z.object({
          x: z.number(),
          y: z.number(),
        }),
        outputSchema: z.object({
          sum: z.number(),
        }),
        execute: async input => {
          return {
            sum: input.x + input.y,
          };
        },
      });

      const result = await tool.execute?.({ x: 5, y: 3 });

      expect(result).toEqual({ sum: 8 });
    });

    it('should execute tools with Zod v4 schemas correctly', async () => {
      const tool = createTool({
        id: 'runtime-v4',
        description: 'Runtime test with v4',
        inputSchema: zv4.object({
          text: zv4.string(),
        }),
        outputSchema: zv4.object({
          length: zv4.number(),
        }),
        execute: async input => {
          return {
            length: input.text.length,
          };
        },
      });

      const result = await tool.execute?.({ text: 'hello' });

      expect(result).toEqual({ length: 5 });
    });

    it('should handle validation with both v3 and v4 schemas', async () => {
      const v3Tool = createTool({
        id: 'validation-v3',
        description: 'Validation test with v3',
        inputSchema: z.object({
          email: z.string().email(),
        }),
        execute: async () => {
          return { validated: true };
        },
      });

      const v4Tool = createTool({
        id: 'validation-v4',
        description: 'Validation test with v4',
        inputSchema: zv4.object({
          email: zv4.string().email(),
        }),
        execute: async () => {
          return { validated: true };
        },
      });

      // Both tools should have validation working
      expect(v3Tool.inputSchema).toBeDefined();
      expect(v4Tool.inputSchema).toBeDefined();

      // Test that the schemas can parse valid input
      const validEmail = { email: 'test@example.com' };
      expect(() => v3Tool.inputSchema?.parse(validEmail)).not.toThrow();
      expect(() => v4Tool.inputSchema?.parse(validEmail)).not.toThrow();

      // Test that the schemas reject invalid input
      const invalidEmail = { email: 'not-an-email' };
      expect(() => v3Tool.inputSchema?.parse(invalidEmail)).toThrow();
      expect(() => v4Tool.inputSchema?.parse(invalidEmail)).toThrow();
    });
  });

  describe('Regression Tests for Issue #8060', () => {
    it('should compile without type errors when using Zod v4 object schemas', () => {
      // This is the exact code from the issue report
      // It should compile without type errors
      const tool = createTool({
        id: 'test-tool',
        description: 'Reverse the input string',
        inputSchema: zv4.object({
          input: zv4.string(),
        }),
        outputSchema: zv4.object({
          output: zv4.string(),
        }),
        execute: async input => {
          const { input: inputStr } = input;
          const reversed = inputStr.split('').reverse().join('');
          return {
            output: reversed,
          };
        },
      });

      expect(tool).toBeDefined();
      expect(tool.id).toBe('test-tool');
      expect(tool.description).toBe('Reverse the input string');
    });

    it('should handle mixed v3 and v4 schemas in the same codebase', () => {
      // Some tools might use v3
      const v3Tool = createTool({
        id: 'mixed-v3',
        description: 'Uses v3',
        inputSchema: z.object({ v3Input: z.string() }),
        execute: async input => ({ result: input.v3Input }),
      });

      // Others might use v4
      const v4Tool = createTool({
        id: 'mixed-v4',
        description: 'Uses v4',
        inputSchema: zv4.object({ v4Input: zv4.string() }),
        execute: async input => ({ result: input.v4Input }),
      });

      // Both should work
      expect(v3Tool).toBeDefined();
      expect(v4Tool).toBeDefined();
      expect(v3Tool.id).toBe('mixed-v3');
      expect(v4Tool.id).toBe('mixed-v4');
    });

    it('should maintain type inference with both Zod versions', () => {
      const v3Tool = createTool({
        id: 'inference-v3',
        description: 'Type inference with v3',
        inputSchema: z.object({
          str: z.string(),
          num: z.number(),
          bool: z.boolean(),
        }),
        execute: async input => {
          // These type checks ensure inference is working
          expectTypeOf(input.str).toBeString();
          expectTypeOf(input.num).toBeNumber();
          expectTypeOf(input.bool).toBeBoolean();
          return { success: true };
        },
      });

      const v4Tool = createTool({
        id: 'inference-v4',
        description: 'Type inference with v4',
        inputSchema: zv4.object({
          str: zv4.string(),
          num: zv4.number(),
          bool: zv4.boolean(),
        }),
        execute: async input => {
          // These type checks ensure inference is working
          expectTypeOf(input.str).toBeString();
          expectTypeOf(input.num).toBeNumber();
          expectTypeOf(input.bool).toBeBoolean();
          return { success: true };
        },
      });

      expect(v3Tool).toBeDefined();
      expect(v4Tool).toBeDefined();
    });
  });
});
