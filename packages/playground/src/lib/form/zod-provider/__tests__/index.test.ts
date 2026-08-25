import type { ParsedField } from '@autoform/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CustomZodProvider, parseSchema } from '../index';

const fieldsOf = (schema: unknown) => parseSchema(schema).fields;
const fieldNamed = (fields: ParsedField[], key: string) => fields.find(field => field.key === key)!;

describe('parseSchema', () => {
  it('turns each key of an object schema into a field', () => {
    const fields = fieldsOf(z.object({ name: z.string(), age: z.number() }));

    expect(fields.map(field => field.key)).toEqual(['name', 'age']);
    expect(fields.map(field => field.type)).toEqual(['string', 'number']);
  });

  it('reports no fields for a schema that is not an object', () => {
    expect(parseSchema(z.string())).toEqual({ fields: [] });
  });

  it('reports no fields for an object with no keys', () => {
    expect(parseSchema(z.object({}))).toEqual({ fields: [] });
  });
});

describe('the field it parses', () => {
  it('marks a bare field required and an optional one not', () => {
    const fields = fieldsOf(z.object({ needed: z.string(), spare: z.string().optional() }));

    expect(fieldNamed(fields, 'needed').required).toBe(true);
    expect(fieldNamed(fields, 'spare').required).toBe(false);
  });

  it('carries the default through the optional wrapper around it', () => {
    const fields = fieldsOf(z.object({ tone: z.string().default('friendly').optional() }));

    expect(fieldNamed(fields, 'tone').default).toBe('friendly');
  });

  it('leaves the default unset when the field has none', () => {
    expect(fieldNamed(fieldsOf(z.object({ name: z.string() })), 'name').default).toBeUndefined();
  });

  it('carries the description the form renders as help text', () => {
    const fields = fieldsOf(z.object({ name: z.string().describe('Your full name') }));

    expect(fieldNamed(fields, 'name').description).toBe('Your full name');
  });

  it('reads the description through a wrapper', () => {
    const fields = fieldsOf(z.object({ name: z.string().describe('Your full name').optional() }));

    expect(fieldNamed(fields, 'name').description).toBe('Your full name');
  });

  it('leaves fieldConfig unset for a plain field', () => {
    expect(fieldNamed(fieldsOf(z.object({ name: z.string() })), 'name').fieldConfig).toBeUndefined();
  });
});

describe('the options it offers', () => {
  it('lists each enum member as its own value and label', () => {
    const fields = fieldsOf(z.object({ tone: z.enum(['warm', 'cool']) }));

    expect(fieldNamed(fields, 'tone').options).toEqual([
      ['warm', 'warm'],
      ['cool', 'cool'],
    ]);
    expect(fieldNamed(fields, 'tone').type).toBe('select');
  });

  it('offers no options for a field that is not an enum', () => {
    expect(fieldNamed(fieldsOf(z.object({ name: z.string() })), 'name').options).toEqual([]);
  });

  it('reads the options through an optional wrapper', () => {
    const fields = fieldsOf(z.object({ tone: z.enum(['warm', 'cool']).optional() }));

    expect(fieldNamed(fields, 'tone').options).toHaveLength(2);
  });
});

describe('the nested fields it walks into', () => {
  it('parses an object field into its own sub-fields', () => {
    const fields = fieldsOf(z.object({ profile: z.object({ name: z.string(), age: z.number() }) }));
    const profile = fieldNamed(fields, 'profile');

    expect(profile.type).toBe('object');
    expect(profile.schema?.map(field => field.key)).toEqual(['name', 'age']);
  });

  it('parses an array field into a single element template keyed "0"', () => {
    const fields = fieldsOf(z.object({ tags: z.array(z.string()) }));
    const tags = fieldNamed(fields, 'tags');

    expect(tags.type).toBe('array');
    expect(tags.schema).toHaveLength(1);
    expect(tags.schema![0]).toMatchObject({ key: '0', type: 'string' });
  });

  it('parses an array of objects into a template with the object shape', () => {
    const fields = fieldsOf(z.object({ people: z.array(z.object({ name: z.string() })) }));

    expect(fieldNamed(fields, 'people').schema![0].schema?.map(f => f.key)).toEqual(['name']);
  });

  it('parses each union branch as a numbered sub-field', () => {
    const fields = fieldsOf(z.object({ value: z.union([z.string(), z.number()]) }));
    const value = fieldNamed(fields, 'value');

    expect(value.type).toBe('union');
    expect(value.schema?.map(field => field.key)).toEqual(['0', '1']);
    expect(value.schema?.map(field => field.type)).toEqual(['string', 'number']);
  });

  it('parses a discriminated union the same way', () => {
    const fields = fieldsOf(
      z.object({
        step: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('a'), a: z.string() }),
          z.object({ kind: z.literal('b'), b: z.number() }),
        ]),
      }),
    );
    const step = fieldNamed(fields, 'step');

    expect(step.type).toBe('discriminated-union');
    expect(step.schema).toHaveLength(2);
  });

  it('flattens both halves of an intersection into one field list', () => {
    const fields = fieldsOf(
      z.object({ merged: z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() })) }),
    );
    const merged = fieldNamed(fields, 'merged');

    expect(merged.type).toBe('object');
    expect(merged.schema?.map(field => field.key)).toEqual(['a', 'b']);
  });

  it('takes the field type from a non-object half of an intersection', () => {
    const fields = fieldsOf(z.object({ merged: z.intersection(z.string(), z.string()) }));

    expect(fieldNamed(fields, 'merged').type).toBe('string');
  });
});

describe('the literal metadata it attaches for the renderer', () => {
  it('flags a literal field and lists the value it accepts', () => {
    const fields = fieldsOf(z.object({ kind: z.literal('agent') }));
    const kind = fieldNamed(fields, 'kind');

    expect(kind.fieldConfig?.customData).toMatchObject({ isLiteral: true });
    expect(kind.fieldConfig?.customData?.literalValues).toEqual(expect.anything());
  });

  it('renders a literal as the type of the value behind it', () => {
    expect(fieldNamed(fieldsOf(z.object({ n: z.literal(42) })), 'n').type).toBe('number');
    expect(fieldNamed(fieldsOf(z.object({ b: z.literal(true) })), 'b').type).toBe('boolean');
  });
});

describe('CustomZodProvider', () => {
  it('refuses to be built without a schema', () => {
    expect(() => new CustomZodProvider(undefined as never)).toThrow('CustomZodProvider: schema is required');
  });

  it('parses the schema it was handed', () => {
    const provider = new CustomZodProvider(z.object({ name: z.string() }));

    expect(provider.parseSchema().fields.map(field => field.key)).toEqual(['name']);
  });

  it('hands back the defaults declared on the schema', () => {
    const provider = new CustomZodProvider(z.object({ tone: z.string().default('friendly') }));

    expect(provider.getDefaultValues()).toMatchObject({ tone: 'friendly' });
  });

  describe('validateSchema', () => {
    const provider = new CustomZodProvider(
      z.object({ name: z.string().min(1), age: z.number().optional(), nested: z.object({ a: z.string() }).optional() }),
    );

    it('reports the parsed data when the values are valid', () => {
      expect(provider.validateSchema({ name: 'Ada' })).toEqual({ success: true, data: { name: 'Ada' } });
    });

    it('drops the empty values the form leaves behind before validating', () => {
      // An untouched optional input submits `''`, which would otherwise fail
      // the number check rather than being treated as "not provided".
      expect(provider.validateSchema({ name: 'Ada', age: '' })).toEqual({ success: true, data: { name: 'Ada' } });
    });

    it('reports each failure with the path the form can highlight', () => {
      const result = provider.validateSchema({ name: '' });

      expect(result.success).toBe(false);
      expect(result.success === false && result.errors).toEqual([
        expect.objectContaining({ path: ['name'], message: expect.any(String) }),
      ]);
    });

    it('reports a nested failure with its full path', () => {
      const result = provider.validateSchema({ name: 'Ada', nested: { a: 5 } });

      expect(result.success === false && result.errors[0].path).toEqual(['nested', 'a']);
    });

    it('reports every failure, not just the first', () => {
      const strict = new CustomZodProvider(z.object({ a: z.string(), b: z.string() }));
      const result = strict.validateSchema({ a: 1, b: 2 });

      expect(result.success === false && result.errors).toHaveLength(2);
    });

    it('lets a schema error out of safeParse reach the caller', () => {
      const exploding = new CustomZodProvider({
        safeParse: () => {
          throw new Error('schema blew up');
        },
      } as never);

      expect(() => exploding.validateSchema({})).toThrow('schema blew up');
    });
  });
});

/**
 * The parser is written against both zod versions and reads whatever the
 * caller built, so these drive the branches a v3-only schema never reaches:
 * v4-shaped internals, the ZodEffects field-config stack, and intersection
 * halves that are not objects.
 */
describe('parseField, on internals shaped like the other zod version', () => {
  const v4 = (def: Record<string, unknown>) => ({ _zod: { def } });

  it('reads a v4 object into its own sub-fields', () => {
    const fields = fieldsOf(v4({ type: 'object', shape: { a: v4({ type: 'string' }) } }));

    expect(fields.map(field => [field.key, field.type])).toEqual([['a', 'string']]);
  });

  it('reads a v4 union into numbered branches', () => {
    const fields = fieldsOf(
      v4({
        type: 'object',
        shape: { choice: v4({ type: 'union', options: [v4({ type: 'string' }), v4({ type: 'number' })] }) },
      }),
    );

    expect(fieldNamed(fields, 'choice').schema?.map(field => field.type)).toEqual(['string', 'number']);
  });

  it('reads a v4 array into its element template', () => {
    const fields = fieldsOf(
      v4({ type: 'object', shape: { tags: v4({ type: 'array', element: v4({ type: 'string' }) }) } }),
    );

    expect(fieldNamed(fields, 'tags').schema?.map(field => field.key)).toEqual(['0']);
  });

  it('flattens a v4 intersection of two objects', () => {
    const fields = fieldsOf(
      v4({
        type: 'object',
        shape: {
          merged: v4({
            type: 'intersection',
            left: v4({ type: 'object', shape: { a: v4({ type: 'string' }) } }),
            right: v4({ type: 'object', shape: { b: v4({ type: 'number' }) } }),
          }),
        },
      }),
    );

    expect(fieldNamed(fields, 'merged').schema?.map(field => field.key)).toEqual(['a', 'b']);
  });

  it('takes the field type from a scalar half of an intersection', () => {
    const fields = fieldsOf(
      v4({
        type: 'object',
        shape: {
          merged: v4({ type: 'intersection', left: v4({ type: 'number' }), right: v4({ type: 'number' }) }),
        },
      }),
    );
    const merged = fieldNamed(fields, 'merged');

    expect(merged.type).toBe('number');
    // A scalar half has an empty (not absent) sub-field list, so that is what
    // is spread in — the halves contribute nothing to flatten.
    expect(merged.schema).toEqual([]);
  });
});

describe('the field config a refinement can carry', () => {
  const FIELD_CONFIG = Symbol('fieldConfig');

  /** A ZodEffects stack shaped the way @autoform/zod stores its field config. */
  const withFieldConfig = (config: unknown) => {
    const refinement = () => {};
    Object.defineProperty(refinement, FIELD_CONFIG, { value: config, enumerable: false });
    return { _def: { typeName: 'ZodEffects', effect: { type: 'refinement', refinement }, schema: { _def: {} } } };
  };

  it('reads the config off the refinement and merges it into the field', () => {
    const fields = parseSchema({ shape: { a: withFieldConfig({ fieldType: 'textarea' }) } }).fields;

    expect(fieldNamed(fields, 'a').fieldConfig).toMatchObject({ fieldType: 'textarea' });
    expect(fieldNamed(fields, 'a').type).toBe('textarea');
  });

  it('ignores a refinement whose symbol holds something that is not config', () => {
    const fields = parseSchema({ shape: { a: withFieldConfig('not-config') } }).fields;

    expect(fieldNamed(fields, 'a').fieldConfig).toBeUndefined();
  });

  it('ignores an effect that is not a refinement', () => {
    const schema = { _def: { typeName: 'ZodEffects', effect: { type: 'transform' }, schema: { _def: {} } } };
    const fields = parseSchema({ shape: { a: schema } }).fields;

    expect(fieldNamed(fields, 'a').fieldConfig).toBeUndefined();
  });

  it('looks through a wrapper to find the config beneath it', () => {
    const wrapped = { _def: { innerType: withFieldConfig({ fieldType: 'textarea' }) } };
    const fields = parseSchema({ shape: { a: wrapped } }).fields;

    expect(fieldNamed(fields, 'a').fieldConfig).toMatchObject({ fieldType: 'textarea' });
  });
});

describe('validateSchema, against a schema that reports issues the other way round', () => {
  it('reads the v3 `errors` list when there is no `issues` list', () => {
    const provider = new CustomZodProvider({
      safeParse: () => ({
        success: false,
        error: { errors: [{ path: ['a'], message: 'too short' }] },
      }),
    } as never);

    const result = provider.validateSchema({});

    expect(result.success).toBe(false);
    expect(result.success === false && result.errors).toEqual([{ path: ['a'], message: 'too short' }]);
  });

  it('reports no errors when the schema names neither list', () => {
    const provider = new CustomZodProvider({
      safeParse: () => ({ success: false, error: {} }),
    } as never);

    const result = provider.validateSchema({});

    expect(result.success === false && result.errors).toEqual([]);
  });
});
