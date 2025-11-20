import { describe, it, expect, expectTypeOf } from 'vitest';
import { z } from 'zod';
import { createTool } from './tool';

describe('createTool type improvements', () => {
  it('should have execute function when provided', () => {
    const tool = createTool({
      id: 'test-tool',
      description: 'Test tool',
      inputSchema: z.object({
        name: z.string(),
        age: z.number(),
      }),
      execute: async input => {
        return { message: `Hello ${input.name}` };
      },
    });

    // The execute function should exist (not be undefined)
    expect(tool.execute).toBeDefined();
    expect(typeof tool.execute).toBe('function');
  });

  it('should have properly typed return value based on output schema', async () => {
    const tool = createTool({
      id: 'typed-tool',
      description: 'Tool with typed output',
      inputSchema: z.object({
        name: z.string(),
      }),
      outputSchema: z.object({
        greeting: z.string(),
        timestamp: z.number(),
      }),
      execute: async input => {
        return {
          greeting: `Hello ${input.name}`,
          timestamp: Date.now(),
        };
      },
    });

    const result = await tool.execute({ name: 'Alice' });

    // TypeScript should know the shape of the result
    expectTypeOf(result).toMatchTypeOf<{
      greeting: string;
      timestamp: number;
    }>();

    expect(result.greeting).toBe('Hello Alice');
    expect(typeof result.timestamp).toBe('number');
  });

  it('should have typed input parameter based on input schema', async () => {
    const tool = createTool({
      id: 'input-typed-tool',
      description: 'Tool with typed input',
      inputSchema: z.object({
        name: z.string(),
        age: z.number().min(0),
        email: z.string().email().optional(),
      }),
      execute: async input => {
        // TypeScript should know input.name is a string
        // input.age is a number, and input.email is optional
        expectTypeOf(input).toMatchTypeOf<{
          name: string;
          age: number;
          email?: string | undefined;
        }>();

        return {
          message: `${input.name} is ${input.age} years old`,
          hasEmail: !!input.email,
        };
      },
    });

    const result = await tool.execute({
      name: 'Bob',
      age: 30,
    });

    expect(result.message).toBe('Bob is 30 years old');
    expect(result.hasEmail).toBe(false);
  });

  it('should return unknown when no output schema is provided', async () => {
    const tool = createTool({
      id: 'no-output-schema',
      description: 'Tool without output schema',
      execute: async () => {
        return { anything: 'goes', nested: { value: 42 } };
      },
    });

    const result = await tool.execute();

    // Result type should be unknown (not any) when no output schema
    expectTypeOf(result).toBeUnknown();

    // But at runtime we can still access the values
    expect((result as any).anything).toBe('goes');
  });

  it('should handle tools without execute function', () => {
    const tool = createTool({
      id: 'no-execute',
      description: 'Tool without execute',
      inputSchema: z.object({ value: z.string() }),
    });

    // execute should be optional/undefined for tools without it
    expect(tool.execute).toBeUndefined();
  });

  it('should properly type execute with both input and output schemas', async () => {
    const tool = createTool({
      id: 'fully-typed',
      description: 'Fully typed tool',
      inputSchema: z.object({
        operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
        a: z.number(),
        b: z.number(),
      }),
      outputSchema: z.object({
        result: z.number(),
        operation: z.string(),
      }),
      execute: async input => {
        let result: number;
        switch (input.operation) {
          case 'add':
            result = input.a + input.b;
            break;
          case 'subtract':
            result = input.a - input.b;
            break;
          case 'multiply':
            result = input.a * input.b;
            break;
          case 'divide':
            result = input.a / input.b;
            break;
        }

        return {
          result,
          operation: input.operation,
        };
      },
    });

    const output = await tool.execute({
      operation: 'add',
      a: 5,
      b: 3,
    });

    // TypeScript should know the exact shape
    expectTypeOf(output).toMatchTypeOf<{
      result: number;
      operation: string;
    }>();

    expect(output.result).toBe(8);
    expect(output.operation).toBe('add');
  });
});
