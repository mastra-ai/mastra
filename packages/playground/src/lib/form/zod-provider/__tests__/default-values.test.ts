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

/**
 * Zod v4 names its classes with a leading underscore, which is what the
 * constructor sniff strips. A real v3 schema never reaches that last resort,
 * because v3 always records a `typeName`.
 */
class _ZodLiteral {
  _def = { value: 'fixed' };
}

const withDefault = (value: unknown) => ({ _def: { defaultValue: () => value } });
const literal = (value: unknown) => ({ _def: { typeName: 'ZodLiteral', value } });

describe('getDefaultValueInZodStack — recognising a literal', () => {
  it('recognises one by constructor name when the internals name nothing', () => {
    expect(getDefaultValueInZodStack(new _ZodLiteral())).toBe('fixed');
  });

  it('does not hand back the first value of an enum as its default', () => {
    // A v3 enum keeps its members in `values`, the same key a v4 literal uses.
    expect(getDefaultValueInZodStack({ _def: { typeName: 'ZodEnum', values: ['a', 'b'] } })).toBeUndefined();
  });

  it('keeps unwrapping when a literal names no value', () => {
    const schema = { _def: { typeName: 'ZodLiteral', innerType: withDefault(7) } };

    expect(getDefaultValueInZodStack(schema)).toBe(7);
  });

  it.each([
    ['a node whose constructor carries no name', { _def: { value: 'x' }, constructor: {} }],
    ['a node with no prototype', Object.assign(Object.create(null), { _def: { value: 'x' } })],
  ])('reports no default rather than throwing on %s', (_label, schema) => {
    expect(getDefaultValueInZodStack(schema)).toBeUndefined();
  });
});

describe('getDefaultValueInZodStack — walking the wrappers', () => {
  it('unwraps an effects wrapper to reach the default underneath', () => {
    expect(getDefaultValueInZodStack({ _def: { schema: withDefault('inner') } })).toBe('inner');
  });

  it('merges the halves of an intersection that also exposes a shape', () => {
    // Both roads are open here; the intersection is the one that must win, or
    // the halves never contribute their defaults.
    const schema = {
      _def: {
        shape: { fromShape: literal('shape') },
        left: { _def: { shape: { a: literal('L') } } },
        right: { _def: { shape: { b: literal('R') } } },
      },
    };

    expect(getDefaultValueInZodStack(schema)).toEqual({ a: 'L', b: 'R' });
  });

  it('ignores a node that names only one half of an intersection', () => {
    expect(getDefaultValueInZodStack({ _def: { left: { _def: { shape: {} } } } })).toBeUndefined();
  });
});
