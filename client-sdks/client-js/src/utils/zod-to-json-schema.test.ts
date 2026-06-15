import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { zodToJsonSchema } from './zod-to-json-schema';

describe('zodToJsonSchema', () => {
  it('should convert a simple Zod schema to JSON schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const result = zodToJsonSchema(schema);

    expect(result).toMatchObject({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
    });
  });

  it('should pass through non-Zod values unchanged', () => {
    const plainObject = { type: 'object', properties: { foo: { type: 'string' } } };
    const result = zodToJsonSchema(plainObject);

    expect(result).toBe(plainObject);
  });

  it('should pass through primitive values unchanged', () => {
    expect(zodToJsonSchema('string')).toBe('string');
    expect(zodToJsonSchema(42)).toBe(42);
    expect(zodToJsonSchema(null)).toBe(null);
    expect(zodToJsonSchema(undefined)).toBe(undefined);
  });

  it('should handle complex Zod schemas with nested types', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
      tags: z.array(z.string()),
    });

    const result = zodToJsonSchema(schema);

    expect(result).toMatchObject({
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    });
  });

  it('should handle optional fields', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    const result = zodToJsonSchema(schema);

    expect(result).toMatchObject({
      type: 'object',
      properties: {
        required: { type: 'string' },
        optional: { type: 'string' },
      },
      required: ['required'],
    });
  });
});
