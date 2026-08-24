import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { z as z4 } from 'zod-v4';

import { getDefaultValueInZodStack, getDefaultValues } from '../default-values';

/**
 * Seeds the dynamic form's initial values from a Zod schema. Schemas reach it
 * as either Zod v3 or v4, which is the point of the compat layer underneath, so
 * both versions run every case.
 */
describe.each([
  ['zod v3', z],
  ['zod v4', z4],
] as const)('default values with %s', (_label, lib) => {
  describe('getDefaultValueInZodStack', () => {
    describe('when the field declares a default', () => {
      it('uses it', () => {
        expect(getDefaultValueInZodStack(lib.string().default('hello'))).toBe('hello');
      });

      it('uses a falsy default', () => {
        expect(getDefaultValueInZodStack(lib.number().default(0))).toBe(0);
        expect(getDefaultValueInZodStack(lib.boolean().default(false))).toBe(false);
      });

      it('finds a default wrapped in optional', () => {
        expect(getDefaultValueInZodStack(lib.string().default('hello').optional())).toBe('hello');
      });

      it('finds a default wrapped in nullable', () => {
        expect(getDefaultValueInZodStack(lib.string().default('hello').nullable())).toBe('hello');
      });
    });

    describe('when the field is a literal', () => {
      it('uses the literal, because it is the only valid value', () => {
        expect(getDefaultValueInZodStack(lib.literal('author'))).toBe('author');
      });

      it('uses a literal nested under optional', () => {
        expect(getDefaultValueInZodStack(lib.literal('author').optional())).toBe('author');
      });
    });

    describe('when the field declares nothing', () => {
      it('reports no default for a bare string', () => {
        expect(getDefaultValueInZodStack(lib.string())).toBeUndefined();
      });

      it('reports no default for an optional string', () => {
        expect(getDefaultValueInZodStack(lib.string().optional())).toBeUndefined();
      });

      it('reports no default for a value that is not a schema', () => {
        expect(getDefaultValueInZodStack(undefined)).toBeUndefined();
        expect(getDefaultValueInZodStack('not-a-schema')).toBeUndefined();
      });
    });

    describe('when the field is an object', () => {
      it('recurses into its shape', () => {
        const schema = lib.object({ name: lib.string().default('anon'), age: lib.number() });

        expect(getDefaultValueInZodStack(schema)).toEqual({ name: 'anon' });
      });

      it('recurses into a nested object', () => {
        const schema = lib.object({ inner: lib.object({ flag: lib.boolean().default(true) }) });

        expect(getDefaultValueInZodStack(schema)).toEqual({ inner: { flag: true } });
      });
    });

    describe('when the field is an intersection', () => {
      it('merges defaults from both sides', () => {
        const schema = lib.intersection(
          lib.object({ a: lib.string().default('left') }),
          lib.object({ b: lib.string().default('right') }),
        );

        expect(getDefaultValueInZodStack(schema)).toEqual({ a: 'left', b: 'right' });
      });

      it('lets the right side win on a shared key', () => {
        const schema = lib.intersection(
          lib.object({ a: lib.string().default('left') }),
          lib.object({ a: lib.string().default('right') }),
        );

        expect(getDefaultValueInZodStack(schema)).toEqual({ a: 'right' });
      });

      it('merges when only one side contributes', () => {
        const schema = lib.intersection(
          lib.object({ a: lib.string().default('left') }),
          lib.object({ b: lib.string() }),
        );

        expect(getDefaultValueInZodStack(schema)).toEqual({ a: 'left' });
      });
    });
  });

  describe('getDefaultValues', () => {
    it('collects every field that declares a default', () => {
      const schema = lib.object({
        name: lib.string().default('anon'),
        age: lib.number().default(0),
        bio: lib.string(),
      });

      expect(getDefaultValues(schema)).toEqual({ name: 'anon', age: 0 });
    });

    it('omits fields with no default rather than seeding them undefined', () => {
      const schema = lib.object({ bio: lib.string() });

      expect(getDefaultValues(schema)).toEqual({});
      expect(Object.keys(getDefaultValues(schema))).toEqual([]);
    });

    it('reports nothing for a schema that is not an object', () => {
      expect(getDefaultValues(lib.string().default('x'))).toEqual({});
    });
  });
});
