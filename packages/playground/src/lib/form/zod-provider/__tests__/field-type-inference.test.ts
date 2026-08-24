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
