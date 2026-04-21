import { describe, it, expect, expectTypeOf } from 'vitest';
import { z } from 'zod/v4';

import { createTool } from './tool';

describe('Zod v4 Tool Support', () => {
  it('should accept Zod v4 schemas', () => {
    const tool = createTool({
      id: 'v4-tool',
      description: 'Tool with Zod v4 schemas',
      inputSchema: z.object({
        input: z.string(),
      }),
      outputSchema: z.object({
        output: z.string(),
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

  it('should expose the expected Zod v4 schema methods', () => {
    const schema = z.object({ test: z.string() });

    expect(schema).toHaveProperty('parse');
    expect(schema).toHaveProperty('safeParse');
    expect(typeof schema.parse).toBe('function');
    expect(typeof schema.safeParse).toBe('function');
  });

  it('should execute tools with Zod v4 schemas correctly', async () => {
    const tool = createTool({
      id: 'runtime-v4',
      description: 'Runtime test with v4',
      inputSchema: z.object({
        text: z.string(),
      }),
      outputSchema: z.object({
        length: z.number(),
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

  it('should validate Zod v4 input schemas', () => {
    const tool = createTool({
      id: 'validation-v4',
      description: 'Validation test with v4',
      inputSchema: z.object({
        email: z.string().email(),
      }),
      execute: async () => {
        return { validated: true };
      },
    });

    expect(tool.inputSchema).toBeDefined();

    const validEmail = { email: 'test@example.com' };
    expect(() => tool.inputSchema?.parse(validEmail)).not.toThrow();

    const invalidEmail = { email: 'not-an-email' };
    expect(() => tool.inputSchema?.parse(invalidEmail)).toThrow();
  });

  it('should compile without type errors when using Zod v4 object schemas', () => {
    const tool = createTool({
      id: 'test-tool',
      description: 'Reverse the input string',
      inputSchema: z.object({
        input: z.string(),
      }),
      outputSchema: z.object({
        output: z.string(),
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

  it('should maintain type inference for Zod v4 schemas', () => {
    const tool = createTool({
      id: 'inference-v4',
      description: 'Type inference with v4',
      inputSchema: z.object({
        str: z.string(),
        num: z.number(),
        bool: z.boolean(),
      }),
      execute: async input => {
        expectTypeOf(input.str).toBeString();
        expectTypeOf(input.num).toBeNumber();
        expectTypeOf(input.bool).toBeBoolean();
        return { success: true };
      },
    });

    expect(tool).toBeDefined();
  });
});
