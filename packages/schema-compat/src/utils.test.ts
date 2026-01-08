import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { isPlainJSONSchema, isZodType } from './utils';
import { jsonSchema } from './json-schema';

describe('isPlainJSONSchema', () => {
  it('should return true for plain JSON Schema objects', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    };

    expect(isPlainJSONSchema(schema)).toBe(true);
  });

  it('should return true for JSON Schema with $schema property', () => {
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    };

    expect(isPlainJSONSchema(schema)).toBe(true);
  });

  it('should return true for different JSON Schema types', () => {
    expect(isPlainJSONSchema({ type: 'string' })).toBe(true);
    expect(isPlainJSONSchema({ type: 'number' })).toBe(true);
    expect(isPlainJSONSchema({ type: 'boolean' })).toBe(true);
    expect(isPlainJSONSchema({ type: 'array', items: { type: 'string' } })).toBe(true);
    expect(isPlainJSONSchema({ type: 'null' })).toBe(true);
    expect(isPlainJSONSchema({ type: 'integer' })).toBe(true);
  });

  it('should return true for JSON Schema with union types', () => {
    const schema = {
      type: ['string', 'null'],
    };

    expect(isPlainJSONSchema(schema)).toBe(true);
  });

  it('should return false for Zod schemas', () => {
    const zodSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    expect(isPlainJSONSchema(zodSchema)).toBe(false);
    expect(isZodType(zodSchema)).toBe(true);
  });

  it('should return false for AI SDK Schema objects', () => {
    const aiSdkSchema = jsonSchema({
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    });

    expect(isPlainJSONSchema(aiSdkSchema)).toBe(false);
    expect('jsonSchema' in aiSdkSchema).toBe(true);
  });

  it('should return false for non-objects', () => {
    expect(isPlainJSONSchema(null)).toBe(false);
    expect(isPlainJSONSchema(undefined)).toBe(false);
    expect(isPlainJSONSchema('string')).toBe(false);
    expect(isPlainJSONSchema(123)).toBe(false);
    expect(isPlainJSONSchema([])).toBe(false);
  });

  it('should return false for objects without type or $schema', () => {
    expect(isPlainJSONSchema({})).toBe(false);
    expect(isPlainJSONSchema({ properties: {} })).toBe(false);
  });

  it('should return false for objects with invalid type values', () => {
    expect(isPlainJSONSchema({ type: 'invalid' })).toBe(false);
    expect(isPlainJSONSchema({ type: 123 })).toBe(false);
    expect(isPlainJSONSchema({ type: ['invalid'] })).toBe(false);
  });

  it('should handle edge case of object with parse/safeParse but still valid JSON Schema', () => {
    // This is an edge case where an object might have parse methods but is still a JSON Schema
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    };

    // Even if we add these properties, it should still detect as JSON Schema if _def is missing
    (schema as any).parse = () => {};
    (schema as any).safeParse = () => {};

    // Without _def, it's not a Zod schema, so it's still detected as JSON Schema
    expect(isZodType(schema)).toBe(false); // No _def, so not Zod
    expect(isPlainJSONSchema(schema)).toBe(true); // Has type, not Zod, so it's JSON Schema

    // Add _def to make it look like Zod
    (schema as any)._def = {};
    expect(isZodType(schema)).toBe(true);
    expect(isPlainJSONSchema(schema)).toBe(false); // Now detected as Zod, not JSON Schema
  });
});
