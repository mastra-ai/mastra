import { describe, it, expect, expectTypeOf } from 'vitest';
import { z } from 'zod';

import { createStep } from '../workflows';
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

    // Use inline narrowing to access properties
    if ('error' in result && result.error) {
      throw new Error('Unexpected validation error');
    }

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
      outputSchema: z.object({
        message: z.string(),
        hasEmail: z.boolean(),
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

    // Use inline narrowing to access properties
    if ('error' in result && result.error) {
      throw new Error('Unexpected validation error');
    }

    expect(result.message).toBe('Bob is 30 years old');
    expect(result.hasEmail).toBe(false);
  });

  it('should return any when no output schema is provided', async () => {
    const tool = createTool({
      id: 'no-output-schema',
      description: 'Tool without output schema',
      inputSchema: z.object({}),
      execute: async () => {
        return { anything: 'goes', nested: { value: 42 } };
      },
    });

    const result = await tool.execute!({});

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

    // Use inline narrowing to access properties
    if ('error' in output && output.error) {
      throw new Error('Unexpected validation error');
    }

    expect(output.result).toBe(8);
    expect(output.operation).toBe('add');
  });
});

/**
 * Tests for GitHub Issue #11381
 * https://github.com/mastra-ai/mastra/issues/11381
 *
 * The issue was that tool.execute return type was incorrectly typed as
 * `ValidationError<any> | OutputType`, and TypeScript couldn't narrow
 * the type properly after checking `'error' in result && result.error`.
 *
 * The fix adds `{ error?: never }` to the success type, enabling proper
 * inline type narrowing.
 */
describe('Issue #11381 - Tool execute return type narrowing', () => {
  const fullNameOutputSchema = z.object({
    fullName: z.string(),
  });

  const fullNameFinderTool = createTool({
    id: 'full-name-finder',
    description: 'Finds a full name',
    inputSchema: z.object({
      firstName: z.string(),
    }),
    outputSchema: fullNameOutputSchema,
    execute: async inputData => {
      return {
        fullName: `${inputData.firstName} von der Burg`,
      };
    },
  });

  const testStep = createStep({
    id: 'test-step',
    description: 'description',
    inputSchema: z.object({
      firstName: z.string(),
    }),
    outputSchema: fullNameOutputSchema,
    execute: async ({ inputData }) => {
      const result = await fullNameFinderTool.execute({ firstName: inputData.firstName });

      if ('error' in result && result.error) {
        console.error('Validation failed:', result.message);
        console.error('Details:', result.validationErrors);
        return { fullName: 'Error occurred' };
      }

      return {
        fullName: result.fullName,
      };
    },
  });

  it('should allow inline narrowing with "error" in result check', async () => {
    const result = await fullNameFinderTool.execute({ firstName: 'Hans' });

    // INLINE NARROWING: This should work with 'error' in result check
    if ('error' in result && result.error) {
      console.error('Validation failed:', result.message);
      return;
    }

    // TypeScript narrows result to { fullName: string } after the if block
    expect(result.fullName).toBe('Hans von der Burg');
  });

  it('should have testStep defined correctly', () => {
    expect(testStep).toBeDefined();
    expect(testStep.id).toBe('test-step');
  });

  it('should correctly detect validation errors with inline check', async () => {
    const tool = createTool({
      id: 'test-tool',
      description: 'Test tool',
      inputSchema: z.object({
        name: z.string().min(5),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
      execute: async inputData => {
        return { result: inputData.name };
      },
    });

    // Pass invalid input (too short)
    const result = await tool.execute({ name: 'ab' });

    // INLINE NARROWING: Check for validation error
    if ('error' in result && result.error) {
      expect(result.error).toBe(true);
      expect(result.message).toContain('Tool input validation failed');
      return;
    }

    // Should not reach here
    throw new Error('Expected validation error');
  });
});
