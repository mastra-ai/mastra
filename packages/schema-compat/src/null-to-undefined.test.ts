import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { transformNullToUndefined, wrapSchemaWithNullTransform } from './null-to-undefined';
import { toStandardSchema } from './standard-schema/standard-schema';

describe('transformNullToUndefined', () => {
  it('converts null to undefined for non-required fields', () => {
    const jsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        detail: { type: 'string' },
      },
      required: ['name'],
    };

    const result = transformNullToUndefined({ name: 'hello', detail: null }, jsonSchema);
    expect(result).toEqual({ name: 'hello', detail: undefined });
  });

  it('preserves null for required fields', () => {
    const jsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    };

    const result = transformNullToUndefined({ name: null }, jsonSchema);
    expect(result).toEqual({ name: null });
  });

  it('handles nested objects', () => {
    const jsonSchema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            bio: { type: 'string' },
          },
          required: ['name'],
        },
      },
      required: ['user'],
    };

    const result = transformNullToUndefined({ user: { name: 'hi', bio: null } }, jsonSchema);
    expect(result).toEqual({ user: { name: 'hi', bio: undefined } });
  });

  it('handles arrays of objects', () => {
    const jsonSchema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              note: { type: 'string' },
            },
            required: ['id'],
          },
        },
      },
      required: ['items'],
    };

    const result = transformNullToUndefined(
      {
        items: [
          { id: 1, note: null },
          { id: 2, note: 'hello' },
        ],
      },
      jsonSchema,
    );
    expect(result).toEqual({
      items: [
        { id: 1, note: undefined },
        { id: 2, note: 'hello' },
      ],
    });
  });

  it('handles optional fields inside nullable objects', () => {
    const jsonSchema = {
      anyOf: [
        {
          type: 'object',
          properties: {
            street: { type: 'string' },
            unit: { type: 'string' },
          },
          required: ['street'],
        },
        { type: 'null' },
      ],
    };

    const result = transformNullToUndefined({ street: 'Main', unit: null }, jsonSchema);
    expect(result).toEqual({ street: 'Main', unit: undefined });
  });

  it('handles optional fields inside nullable arrays', () => {
    const jsonSchema = {
      anyOf: [
        {
          type: 'array',
          items: {
            anyOf: [
              {
                type: 'object',
                properties: { label: { type: 'string' } },
                required: [],
              },
              { type: 'null' },
            ],
          },
        },
        { type: 'null' },
      ],
    };

    const result = transformNullToUndefined([{ label: null }], jsonSchema);
    expect(result).toEqual([{ label: undefined }]);
  });

  it('passes through non-object values', () => {
    const jsonSchema = { type: 'string' };
    expect(transformNullToUndefined('hello', jsonSchema)).toBe('hello');
    expect(transformNullToUndefined(42, jsonSchema)).toBe(42);
    expect(transformNullToUndefined(null, jsonSchema)).toBe(null);
    expect(transformNullToUndefined(undefined, jsonSchema)).toBe(undefined);
  });

  it('handles objects without properties in schema', () => {
    const jsonSchema = { type: 'object' };
    const value = { foo: null };
    expect(transformNullToUndefined(value, jsonSchema)).toEqual({ foo: null });
  });
});

describe('wrapSchemaWithNullTransform', () => {
  it('wraps a Zod schema to accept null for optional fields', async () => {
    const schema = z.object({
      name: z.string(),
      detail: z.string().optional(),
    });

    const wrapped = wrapSchemaWithNullTransform(toStandardSchema(schema));

    // Without wrapping, null would fail
    const directResult = await schema['~standard'].validate({ name: 'hi', detail: null });
    expect(directResult.issues).toBeDefined();

    // With wrapping, null becomes undefined and passes
    const wrappedResult = await wrapped['~standard'].validate({ name: 'hi', detail: null });
    expect(wrappedResult.issues).toBeUndefined();
    expect((wrappedResult as { value: unknown }).value).toEqual({ name: 'hi' });
  });

  it('preserves null for nullable fields', async () => {
    const schema = z.object({
      name: z.string(),
      note: z.string().nullable(),
    });

    const wrapped = wrapSchemaWithNullTransform(toStandardSchema(schema));

    // nullable field with null should be preserved (it's required)
    const result = await wrapped['~standard'].validate({ name: 'hi', note: null });
    expect(result.issues).toBeUndefined();
    expect((result as { value: unknown }).value).toEqual({ name: 'hi', note: null });
  });

  it('transforms optional fields inside nullable nested objects and arrays', async () => {
    const schema = z.object({
      address: z.object({ street: z.string(), unit: z.string().optional() }).nullable(),
      contacts: z.array(z.object({ email: z.string().optional() })).nullable(),
    });

    const wrapped = wrapSchemaWithNullTransform(toStandardSchema(schema));
    const result = await wrapped['~standard'].validate({
      address: { street: 'Main', unit: null },
      contacts: [{ email: null }],
    });

    expect(result.issues).toBeUndefined();
    expect((result as { value: unknown }).value).toEqual({
      address: { street: 'Main' },
      contacts: [{}],
    });
  });

  it('delegates jsonSchema to inner schema', () => {
    const schema = z.object({
      name: z.string(),
      detail: z.string().optional(),
    });

    const wrapped = wrapSchemaWithNullTransform(toStandardSchema(schema));
    const jsonSchema = wrapped['~standard'].jsonSchema.input({ target: 'draft-07' });
    expect(jsonSchema).toHaveProperty('properties');
    expect(jsonSchema).toHaveProperty('type', 'object');
  });
});
