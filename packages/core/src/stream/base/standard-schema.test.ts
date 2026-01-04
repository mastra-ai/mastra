import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { asJsonSchema, getTransformedSchema, getResponseFormat } from './schema';
import type { StandardJSONSchemaV1 } from '../../types/standard-schema';

/**
 * Creates a mock Standard JSON Schema for testing.
 * This simulates libraries like ArkType that implement StandardJSONSchemaV1.
 */
function createMockStandardJSONSchema<T>(jsonSchema: Record<string, unknown>): StandardJSONSchemaV1<T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      jsonSchema: {
        input: () => jsonSchema,
        output: () => jsonSchema,
      },
    },
  };
}

describe('Structured Output with Standard Schema', () => {
  describe('asJsonSchema', () => {
    it('should convert Zod schema to JSON Schema', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const jsonSchema = asJsonSchema(zodSchema);

      expect(jsonSchema).toBeDefined();
      expect(jsonSchema?.type).toBe('object');
      expect(jsonSchema?.properties).toHaveProperty('name');
      expect(jsonSchema?.properties).toHaveProperty('age');
    });

    it('should convert Standard JSON Schema to JSON Schema', () => {
      const mockSchema = createMockStandardJSONSchema({
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          verified: { type: 'boolean' },
        },
        required: ['email'],
      });

      const jsonSchema = asJsonSchema(mockSchema);

      expect(jsonSchema).toBeDefined();
      expect(jsonSchema?.type).toBe('object');
      expect(jsonSchema?.properties).toHaveProperty('email');
      expect(jsonSchema?.properties).toHaveProperty('verified');
      expect(jsonSchema?.required).toEqual(['email']);
    });

    it('should return undefined for undefined schema', () => {
      const result = asJsonSchema(undefined);
      expect(result).toBeUndefined();
    });

    it('should handle plain JSONSchema7 directly', () => {
      const plainJsonSchema = {
        type: 'object' as const,
        properties: {
          id: { type: 'number' as const },
        },
      };

      const result = asJsonSchema(plainJsonSchema as any);
      expect(result).toEqual(plainJsonSchema);
    });
  });

  describe('getTransformedSchema', () => {
    it('should transform Zod object schema', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const result = getTransformedSchema(zodSchema);

      expect(result).toBeDefined();
      expect(result?.jsonSchema).toBeDefined();
      expect(result?.outputFormat).toBe('object');
    });

    it('should transform Zod array schema', () => {
      const zodSchema = z.array(z.string());

      const result = getTransformedSchema(zodSchema);

      expect(result).toBeDefined();
      expect(result?.outputFormat).toBe('array');
      // Arrays should be wrapped in { elements: [...] }
      expect(result?.jsonSchema?.properties).toHaveProperty('elements');
    });

    it('should transform Standard JSON Schema', () => {
      const mockSchema = createMockStandardJSONSchema({
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
      });

      const result = getTransformedSchema(mockSchema);

      expect(result).toBeDefined();
      expect(result?.jsonSchema).toBeDefined();
      expect(result?.outputFormat).toBe('object');
    });
  });

  describe('getResponseFormat', () => {
    it('should return JSON format for Zod schema', () => {
      const zodSchema = z.object({ name: z.string() });

      const result = getResponseFormat(zodSchema);

      expect(result.type).toBe('json');
      if (result.type === 'json') {
        expect(result.schema).toBeDefined();
      }
    });

    it('should return JSON format for Standard JSON Schema', () => {
      const mockSchema = createMockStandardJSONSchema({
        type: 'object',
        properties: {
          data: { type: 'string' },
        },
      });

      const result = getResponseFormat(mockSchema);

      expect(result.type).toBe('json');
      if (result.type === 'json') {
        expect(result.schema).toBeDefined();
      }
    });

    it('should return text format for undefined schema', () => {
      const result = getResponseFormat(undefined);

      expect(result.type).toBe('text');
    });
  });

  describe('Zod features', () => {
    it('should handle Zod enums', () => {
      const zodSchema = z.enum(['draft', 'published', 'archived']);

      const result = getTransformedSchema(zodSchema);

      expect(result).toBeDefined();
      expect(result?.outputFormat).toBe('enum');
    });

    it('should handle Zod with descriptions', () => {
      const zodSchema = z.object({
        name: z.string().describe('The user name'),
        email: z.string().email().describe('User email address'),
      });

      const jsonSchema = asJsonSchema(zodSchema);

      expect(jsonSchema?.properties?.name).toHaveProperty('description', 'The user name');
      expect(jsonSchema?.properties?.email).toHaveProperty('description', 'User email address');
    });

    it('should handle nested Zod objects', () => {
      const zodSchema = z.object({
        user: z.object({
          name: z.string(),
          address: z.object({
            city: z.string(),
            country: z.string(),
          }),
        }),
      });

      const jsonSchema = asJsonSchema(zodSchema);

      expect(jsonSchema?.type).toBe('object');
      expect(jsonSchema?.properties?.user).toBeDefined();
      expect((jsonSchema?.properties?.user as any)?.properties?.address).toBeDefined();
    });
  });

  describe('Type compatibility', () => {
    it('should accept Standard JSON Schema in OutputSchema type', () => {
      // This is a compile-time check - if it compiles, the type is compatible
      const mockSchema = createMockStandardJSONSchema<{ name: string }>({
        type: 'object',
        properties: { name: { type: 'string' } },
      });

      // This should compile and work
      const result = asJsonSchema(mockSchema);
      expect(result).toBeDefined();
    });
  });
});
