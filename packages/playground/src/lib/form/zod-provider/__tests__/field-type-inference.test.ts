import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { inferFieldType } from '../field-type-inference';

describe('inferFieldType', () => {
  describe('when the field config names a type', () => {
    it('takes the author at their word instead of reading the schema', () => {
      expect(inferFieldType(z.string(), { fieldType: 'textarea' })).toBe('textarea');
    });

    it('falls back to the schema when the config names no type', () => {
      expect(inferFieldType(z.number(), {})).toBe('number');
    });
  });

  describe('when reading a scalar schema', () => {
    it.each([
      ['a string', z.string(), 'string'],
      ['a number', z.number(), 'number'],
      ['a boolean', z.boolean(), 'boolean'],
      ['an object', z.object({ a: z.string() }), 'object'],
      ['an array', z.array(z.string()), 'array'],
      ['a record', z.record(z.string(), z.string()), 'record'],
      ['an enum', z.enum(['a', 'b']), 'select'],
    ])('renders %s as %s', (_label, schema, expected) => {
      expect(inferFieldType(schema)).toBe(expected);
    });

    it('renders an intersection as an object, since both halves are merged into one form section', () => {
      expect(inferFieldType(z.intersection(z.object({ a: z.string() }), z.object({ b: z.string() })))).toBe('object');
    });
  });

  describe('when reading a string schema', () => {
    it('offers a date picker for an ISO datetime string', () => {
      expect(inferFieldType(z.string().datetime())).toBe('date');
    });

    it('keeps a plain text input for a string with other checks', () => {
      expect(inferFieldType(z.string().min(3).email())).toBe('string');
    });
  });

  describe('when reading a union', () => {
    it('renders a union of literal-bearing objects as a discriminated union', () => {
      const schema = z.union([
        z.object({ kind: z.literal('a'), a: z.string() }),
        z.object({ kind: z.literal('b'), b: z.string() }),
      ]);

      expect(inferFieldType(schema)).toBe('discriminated-union');
    });

    it('renders a union of scalars as a plain union', () => {
      expect(inferFieldType(z.union([z.string(), z.number()]))).toBe('union');
    });

    it('renders a union as plain when only some branches carry a literal', () => {
      const schema = z.union([
        z.object({ kind: z.literal('a'), a: z.string() }),
        z.object({ name: z.string(), b: z.string() }),
      ]);

      expect(inferFieldType(schema)).toBe('union');
    });

    it('renders a real discriminated union as a discriminated union', () => {
      const schema = z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('a'), a: z.string() }),
        z.object({ kind: z.literal('b'), b: z.string() }),
      ]);

      expect(inferFieldType(schema)).toBe('discriminated-union');
    });
  });

  describe('when reading a literal', () => {
    it.each([
      ['a text literal', z.literal('hello'), 'string'],
      ['a numeric literal', z.literal(42), 'number'],
      ['a boolean literal', z.literal(true), 'boolean'],
    ])('renders %s as %s', (_label, schema, expected) => {
      expect(inferFieldType(schema)).toBe(expected);
    });
  });

  describe('when the schema cannot be read', () => {
    it.each([
      ['nothing at all', undefined],
      ['null', null],
      ['a plain object', {}],
      ['an unsupported zod type', z.date()],
    ])('falls back to a text input for %s', (_label, schema) => {
      expect(inferFieldType(schema)).toBe('string');
    });
  });
});

/**
 * The inference walks whatever the caller built, so it has to read a node
 * whose internals only carry the *other* version's tags — and one with no
 * prototype at all, which has no `constructor` to sniff.
 */
describe('inferFieldType, on internals shaped like the other zod version', () => {
  const v4 = (def: Record<string, unknown>) => ({ _zod: { def } });

  it.each([
    ['an object', 'object', 'object'],
    ['a number', 'number', 'number'],
    ['a boolean', 'boolean', 'boolean'],
    ['a string', 'string', 'string'],
    ['an enum', 'enum', 'select'],
    ['an array', 'array', 'array'],
    ['a record', 'record', 'record'],
    ['an intersection', 'intersection', 'object'],
  ])('reads %s off a v4 type tag', (_label, type, expected) => {
    expect(inferFieldType(v4({ type }))).toBe(expected);
  });

  it('renders a v4 literal by the type of the value it lists', () => {
    expect(inferFieldType(v4({ type: 'literal', values: [7] }))).toBe('number');
    expect(inferFieldType(v4({ type: 'literal', values: [true] }))).toBe('boolean');
    expect(inferFieldType(v4({ type: 'literal', values: ['a'] }))).toBe('string');
  });

  it('renders a v4 discriminated union as one', () => {
    expect(inferFieldType(v4({ type: 'discriminatedUnion' }))).toBe('discriminated-union');
  });

  it('renders a v4 union of scalars as a plain union', () => {
    expect(inferFieldType(v4({ type: 'union', options: [v4({ type: 'string' })] }))).toBe('union');
  });

  it('falls back to a text input for a node with no prototype to sniff', () => {
    expect(inferFieldType(Object.create(null))).toBe('string');
  });

  it('falls back to a text input for a v4 tag it does not recognise', () => {
    expect(inferFieldType(v4({ type: 'promise' }))).toBe('string');
  });

  it('reads a native enum as a select, for schemas written against zod v3', () => {
    expect(inferFieldType({ _def: { typeName: 'ZodNativeEnum' } })).toBe('select');
  });

  it('does not treat a branch with no shape as a literal-bearing one', () => {
    expect(inferFieldType(v4({ type: 'union', options: [v4({ type: 'string' }), v4({ type: 'number' })] }))).toBe(
      'union',
    );
  });

  it('reads a union branch whose literal is tagged only by its constructor', () => {
    class _ZodLiteral {}
    const branch = { shape: { kind: new _ZodLiteral() } };

    expect(inferFieldType(v4({ type: 'union', options: [branch] }))).toBe('discriminated-union');
  });
});
