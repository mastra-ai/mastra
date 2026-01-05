/**
 * Standard Schema Integration Tests
 *
 * These tests verify that Mastra's tool system works correctly with:
 * - Zod (native support, priority)
 * - ArkType (via Standard Schema)
 * - Valibot (via Standard Schema)
 *
 * We test validation, type inference, error handling, and edge cases.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createTool } from './tool';
import {
  validateToolInput,
  validateToolOutput,
  validateToolSuspendData,
} from './validation';
import { isStandardSchema, isStandardJSONSchema } from '../types/standard-schema';
import type { StandardSchemaV1 } from '../types/standard-schema';

// ============================================================================
// MOCK STANDARD SCHEMA HELPERS
// These simulate how libraries like Valibot/ArkType implement Standard Schema
// ============================================================================

/**
 * Creates a mock Standard Schema for testing.
 * This simulates how Valibot, ArkType, etc. implement the interface.
 */
function createMockStandardSchema<T>(
  validator: (value: unknown) => StandardSchemaV1.Result<T>,
  vendor = 'test-lib',
): StandardSchemaV1<unknown, T> {
  return {
    '~standard': {
      version: 1,
      vendor,
      validate: validator,
      types: undefined, // Types are compile-time only
    },
  };
}

/**
 * Creates a mock object schema that validates object structure.
 */
function createMockObjectSchema<T extends Record<string, unknown>>(
  shape: { [K in keyof T]: (value: unknown) => boolean },
  vendor = 'test-lib',
): StandardSchemaV1<unknown, T> {
  return createMockStandardSchema<T>((value: unknown) => {
    if (typeof value !== 'object' || value === null) {
      return {
        issues: [{ message: 'Expected an object', path: [] }],
      };
    }

    const issues: StandardSchemaV1.Issue[] = [];
    const obj = value as Record<string, unknown>;

    for (const [key, validator] of Object.entries(shape)) {
      if (!validator(obj[key])) {
        issues.push({
          message: `Invalid value for ${key}`,
          path: [key],
        });
      }
    }

    if (issues.length > 0) {
      return { issues };
    }

    return { value: value as T };
  }, vendor);
}

// ============================================================================
// TOOL VALIDATION TESTS
// ============================================================================

describe('Standard Schema Tool Validation', () => {
  describe('validateToolInput', () => {
    describe('with Zod schemas (native priority)', () => {
      it('should validate valid input with Zod schema', () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        });

        const result = validateToolInput(schema, { name: 'John', age: 30 });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ name: 'John', age: 30 });
      });

      it('should return error for invalid input with Zod schema', () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        });

        const result = validateToolInput(schema, { name: 123, age: 'invalid' });

        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('validation failed');
      });

      it('should handle Zod transforms', () => {
        const schema = z.object({
          date: z.string().transform(s => new Date(s)),
        });

        const result = validateToolInput(schema, { date: '2024-01-01' });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ date: new Date('2024-01-01') });
      });

      it('should handle Zod defaults', () => {
        const schema = z.object({
          name: z.string(),
          count: z.number().default(10),
        });

        const result = validateToolInput(schema, { name: 'test' });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ name: 'test', count: 10 });
      });

      it('should normalize undefined input to empty object for Zod object schemas', () => {
        const schema = z.object({
          optional: z.string().optional(),
        });

        const result = validateToolInput(schema, undefined);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({});
      });
    });

    describe('with Standard Schema (fallback)', () => {
      it('should validate valid input with Standard Schema', () => {
        const schema = createMockObjectSchema({
          name: (v): v is string => typeof v === 'string',
          age: (v): v is number => typeof v === 'number',
        });

        const result = validateToolInput(schema, { name: 'John', age: 30 });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ name: 'John', age: 30 });
      });

      it('should return error for invalid input with Standard Schema', () => {
        const schema = createMockObjectSchema({
          name: (v): v is string => typeof v === 'string',
          age: (v): v is number => typeof v === 'number',
        });

        const result = validateToolInput(schema, { name: 123, age: 'invalid' });

        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('validation failed');
        expect(result.error?.validationErrors).toBeInstanceOf(Array);
      });

      it('should include path information in Standard Schema errors', () => {
        const schema = createMockObjectSchema({
          user: (v): v is object =>
            typeof v === 'object' && v !== null && typeof (v as any).name === 'string',
        });

        const result = validateToolInput(schema, { user: { name: 123 } });

        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('user');
      });

      it('should normalize undefined input to empty object for Standard Schema', () => {
        const schema = createMockStandardSchema<Record<string, unknown>>(value => {
          if (typeof value !== 'object' || value === null) {
            return { issues: [{ message: 'Expected object' }] };
          }
          return { value: value as Record<string, unknown> };
        });

        const result = validateToolInput(schema, undefined);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({});
      });
    });

    describe('priority: Zod over Standard Schema', () => {
      it('should use Zod safeParse when schema has both', () => {
        // Zod v3.25+ implements Standard Schema, but we should use safeParse
        const zodSchema = z.object({ value: z.string() });

        // Verify Zod implements Standard Schema
        expect('~standard' in zodSchema).toBe(true);

        // But validation should use safeParse (check via transform behavior)
        const schemaWithTransform = z.object({
          value: z.string().transform(s => s.toUpperCase()),
        });

        const result = validateToolInput(schemaWithTransform, { value: 'hello' });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ value: 'HELLO' }); // Transform applied = safeParse used
      });
    });
  });

  describe('validateToolOutput', () => {
    it('should validate output with Zod schema', () => {
      const schema = z.object({
        result: z.string(),
        count: z.number(),
      });

      const result = validateToolOutput(schema, { result: 'success', count: 42 });

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ result: 'success', count: 42 });
    });

    it('should validate output with Standard Schema', () => {
      const schema = createMockObjectSchema({
        result: (v): v is string => typeof v === 'string',
      });

      const result = validateToolOutput(schema, { result: 'success' });

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ result: 'success' });
    });

    it('should return error for invalid output', () => {
      const schema = z.object({
        result: z.string(),
      });

      const result = validateToolOutput(schema, { result: 123 });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('output validation failed');
    });

    it('should skip validation when suspend was called', () => {
      const schema = z.object({
        result: z.string(),
      });

      const result = validateToolOutput(schema, { invalid: 'data' }, 'tool-id', true);

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ invalid: 'data' });
    });
  });

  describe('validateToolSuspendData', () => {
    it('should validate suspend data with Zod schema', () => {
      const schema = z.object({
        reason: z.string(),
        resumeAt: z.string().optional(),
      });

      const result = validateToolSuspendData(schema, { reason: 'waiting' });

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ reason: 'waiting' });
    });

    it('should validate suspend data with Standard Schema', () => {
      const schema = createMockObjectSchema({
        reason: (v): v is string => typeof v === 'string',
      });

      const result = validateToolSuspendData(schema, { reason: 'waiting' });

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ reason: 'waiting' });
    });
  });
});

// ============================================================================
// TOOL CREATION TESTS
// ============================================================================

describe('createTool with Standard Schema', () => {
  describe('with Zod schemas', () => {
    it('should create tool with Zod input schema', () => {
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().optional(),
        }),
        execute: async input => {
          return { result: input.query };
        },
      });

      expect(tool.id).toBe('test-tool');
      expect(tool.inputSchema).toBeDefined();
    });

    it('should create tool with Zod input and output schemas', () => {
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async input => {
          return { output: input.input.toUpperCase() };
        },
      });

      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
    });

    it('should execute tool with valid Zod input', async () => {
      const tool = createTool({
        id: 'echo-tool',
        description: 'Echoes input',
        inputSchema: z.object({ message: z.string() }),
        execute: async input => {
          return { echo: input.message };
        },
      });

      const result = await tool.execute?.({ message: 'hello' }, undefined);

      expect(result).toEqual({ echo: 'hello' });
    });

    it('should return validation error for invalid Zod input', async () => {
      const tool = createTool({
        id: 'echo-tool',
        description: 'Echoes input',
        inputSchema: z.object({ message: z.string() }),
        execute: async input => {
          return { echo: input.message };
        },
      });

      const result = await tool.execute?.({ message: 123 } as any, undefined);

      expect(result).toHaveProperty('error', true);
      expect(result).toHaveProperty('message');
    });
  });

  describe('with Standard Schema', () => {
    it('should create tool with Standard Schema input', () => {
      const schema = createMockObjectSchema({
        query: (v): v is string => typeof v === 'string',
      });

      const tool = createTool({
        id: 'standard-tool',
        description: 'A tool with Standard Schema',
        inputSchema: schema,
        execute: async input => {
          return { result: 'success' };
        },
      });

      expect(tool.id).toBe('standard-tool');
      expect(tool.inputSchema).toBeDefined();
    });

    it('should execute tool with valid Standard Schema input', async () => {
      const schema = createMockObjectSchema({
        name: (v): v is string => typeof v === 'string',
      });

      const tool = createTool({
        id: 'greet-tool',
        description: 'Greets user',
        inputSchema: schema,
        execute: async input => {
          return { greeting: `Hello, ${(input as any).name}!` };
        },
      });

      const result = await tool.execute?.({ name: 'World' }, undefined);

      expect(result).toEqual({ greeting: 'Hello, World!' });
    });

    it('should return validation error for invalid Standard Schema input', async () => {
      const schema = createMockObjectSchema({
        name: (v): v is string => typeof v === 'string',
      });

      const tool = createTool({
        id: 'greet-tool',
        description: 'Greets user',
        inputSchema: schema,
        execute: async input => {
          return { greeting: `Hello!` };
        },
      });

      const result = await tool.execute?.({ name: 123 } as any, undefined);

      expect(result).toHaveProperty('error', true);
    });
  });
});

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

describe('Standard Schema Type Guards', () => {
  describe('isStandardSchema', () => {
    it('should return true for valid Standard Schema', () => {
      const schema = createMockStandardSchema(() => ({ value: 'test' }));
      expect(isStandardSchema(schema)).toBe(true);
    });

    it('should return true for Zod schemas (they implement Standard Schema)', () => {
      const schema = z.object({ name: z.string() });
      expect(isStandardSchema(schema)).toBe(true);
    });

    it('should return false for plain objects', () => {
      expect(isStandardSchema({})).toBe(false);
      expect(isStandardSchema({ name: 'test' })).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isStandardSchema(null)).toBe(false);
      expect(isStandardSchema(undefined)).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isStandardSchema('string')).toBe(false);
      expect(isStandardSchema(123)).toBe(false);
      expect(isStandardSchema(true)).toBe(false);
    });

    it('should return false for objects with invalid ~standard', () => {
      expect(isStandardSchema({ '~standard': null })).toBe(false);
      expect(isStandardSchema({ '~standard': {} })).toBe(false);
      expect(isStandardSchema({ '~standard': { version: 1 } })).toBe(false);
    });

    it('should accept functions with ~standard property (like ArkType)', () => {
      const functionSchema = Object.assign(
        function validate() {},
        {
          '~standard': {
            version: 1,
            vendor: 'arktype',
            validate: () => ({ value: 'test' }),
          },
        },
      );

      expect(isStandardSchema(functionSchema)).toBe(true);
    });
  });

  describe('isStandardJSONSchema', () => {
    it('should return true for schemas with jsonSchema method', () => {
      const schema = {
        '~standard': {
          version: 1,
          vendor: 'test',
          jsonSchema: {
            input: () => ({ type: 'object' }),
            output: () => ({ type: 'object' }),
          },
        },
      };

      expect(isStandardJSONSchema(schema)).toBe(true);
    });

    it('should return false for Standard Schema without jsonSchema', () => {
      const schema = createMockStandardSchema(() => ({ value: 'test' }));
      expect(isStandardJSONSchema(schema)).toBe(false);
    });

    it('should accept functions with jsonSchema (like ArkType)', () => {
      const functionSchema = Object.assign(
        function validate() {},
        {
          '~standard': {
            version: 1,
            vendor: 'arktype',
            validate: () => ({ value: 'test' }),
            jsonSchema: {
              input: () => ({ type: 'object' }),
              output: () => ({ type: 'object' }),
            },
          },
        },
      );

      expect(isStandardJSONSchema(functionSchema)).toBe(true);
    });
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle schemas with async validation gracefully', async () => {
    const asyncSchema: StandardSchemaV1 = {
      '~standard': {
        version: 1,
        vendor: 'async-lib',
        validate: async value => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { value };
        },
      },
    };

    // Sync validation should skip async schemas with a warning
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = validateToolInput(asyncSchema, { test: 'data' });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('async validation not supported'),
    );
    expect(result.data).toEqual({ test: 'data' });

    consoleSpy.mockRestore();
  });

  it('should handle empty schemas', () => {
    const result = validateToolInput(undefined, { any: 'data' });

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ any: 'data' });
  });

  it('should handle nested object validation', () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string(),
          settings: z.object({
            theme: z.enum(['light', 'dark']),
          }),
        }),
      }),
    });

    const validData = {
      user: {
        profile: {
          name: 'John',
          settings: { theme: 'dark' },
        },
      },
    };

    const result = validateToolInput(schema, validData);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(validData);
  });

  it('should handle array schemas', () => {
    const schema = z.array(z.object({ id: z.string() }));

    const result = validateToolInput(schema, [{ id: '1' }, { id: '2' }]);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('should handle union schemas', () => {
    const schema = z.union([
      z.object({ type: z.literal('a'), value: z.string() }),
      z.object({ type: z.literal('b'), value: z.number() }),
    ]);

    const resultA = validateToolInput(schema, { type: 'a', value: 'hello' });
    expect(resultA.error).toBeUndefined();

    const resultB = validateToolInput(schema, { type: 'b', value: 42 });
    expect(resultB.error).toBeUndefined();
  });

  it('should provide helpful error messages', () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(0).max(120),
    });

    const result = validateToolInput(schema, { email: 'invalid', age: 200 });

    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('email');
    expect(result.error?.message).toContain('age');
  });
});
