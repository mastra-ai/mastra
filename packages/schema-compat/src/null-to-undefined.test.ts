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

describe('null transform with nullable parents (#25112)', () => {
  const validate = async (schema: z.ZodTypeAny, input: unknown) =>
    wrapSchemaWithNullTransform(toStandardSchema(schema))['~standard'].validate(input);

  const address = z.object({ street: z.string(), unit: z.string().optional() });

  it('drops optional nulls inside a nullable object', async () => {
    const result = await validate(z.object({ address: address.nullable() }), {
      address: { street: 'Main', unit: null },
    });
    expect(result.issues).toBeUndefined();
    expect((result as { value: unknown }).value).toEqual({ address: { street: 'Main' } });
  });

  it('drops optional nulls inside a nullish object', async () => {
    const result = await validate(z.object({ address: address.nullish() }), {
      address: { street: 'Main', unit: null },
    });
    expect(result.issues).toBeUndefined();
    expect((result as { value: unknown }).value).toEqual({ address: { street: 'Main' } });
  });

  it('drops optional nulls inside a nullable array of objects', async () => {
    const result = await validate(z.object({ list: z.array(address).nullable() }), {
      list: [{ street: 'A', unit: null }],
    });
    expect(result.issues).toBeUndefined();
    expect((result as { value: unknown }).value).toEqual({ list: [{ street: 'A' }] });
  });

  it('preserves a null nullable parent and required nullable children', async () => {
    const schema = z.object({ address: z.object({ street: z.string(), note: z.string().nullable() }).nullable() });
    expect(((await validate(schema, { address: null })) as { value: unknown }).value).toEqual({ address: null });
    const result = await validate(schema, { address: { street: 'Main', note: null } });
    expect((result as { value: unknown }).value).toEqual({ address: { street: 'Main', note: null } });
  });

  it('resolves raw anyOf, oneOf and type arrays', () => {
    const obj = { type: 'object', properties: { a: { type: 'string' } }, required: [] };
    for (const key of ['anyOf', 'oneOf']) {
      expect(transformNullToUndefined({ a: null }, { [key]: [{ type: 'null' }, obj] })).toEqual({ a: undefined });
    }
    expect(transformNullToUndefined({ a: null }, { ...obj, type: ['object', 'null'] })).toEqual({ a: undefined });
  });

  it('applies parent properties alongside anyOf', () => {
    const schema = {
      type: 'object',
      properties: { a: { type: 'string' } },
      anyOf: [{ type: 'object' }, { type: 'null' }],
    };
    expect(transformNullToUndefined({ a: null }, schema)).toEqual({ a: undefined });
  });

  it('selects the discriminated branch matching the value', () => {
    const schema = {
      oneOf: [
        { type: 'object', properties: { kind: { const: 'a' }, note: { type: 'string' } }, required: ['kind'] },
        {
          type: 'object',
          properties: { kind: { const: 'b' }, note: { type: ['string', 'null'] } },
          required: ['kind', 'note'],
        },
      ],
    };
    expect(transformNullToUndefined({ kind: 'b', note: null }, schema)).toEqual({ kind: 'b', note: null });
    expect(transformNullToUndefined({ kind: 'a', note: null }, schema)).toEqual({ kind: 'a', note: undefined });
  });

  it('keeps nulls in discriminated unions of zod objects', async () => {
    const schema = z.object({
      item: z
        .discriminatedUnion('kind', [
          z.object({ kind: z.literal('a'), note: z.string().optional() }),
          z.object({ kind: z.literal('b'), note: z.string().nullable() }),
        ])
        .nullable(),
    });
    const result = await validate(schema, { item: { kind: 'b', note: null } });
    expect(result.issues).toBeUndefined();
    expect((result as { value: unknown }).value).toEqual({ item: { kind: 'b', note: null } });
  });

  it('applies parent items alongside anyOf', () => {
    const schema = {
      items: { type: 'object', properties: { note: { type: 'string' } }, required: [] },
      anyOf: [{ type: 'array' }, { type: 'null' }],
    };
    expect(transformNullToUndefined([{ note: null }], schema)).toEqual([{ note: undefined }]);
  });

  it('selects the array branch whose items match the elements', () => {
    const item = (kind: string, required: string[]) => ({
      type: 'object',
      properties: { kind: { const: kind }, note: { type: ['string', 'null'] } },
      required,
    });
    const schema = {
      oneOf: [
        { type: 'array', items: item('a', ['kind']) },
        { type: 'array', items: item('b', ['kind', 'note']) },
      ],
    };
    expect(transformNullToUndefined([{ kind: 'b', note: null }], schema)).toEqual([{ kind: 'b', note: null }]);
    expect(transformNullToUndefined([{ kind: 'a', note: null }], schema)).toEqual([{ kind: 'a', note: undefined }]);
  });
});
