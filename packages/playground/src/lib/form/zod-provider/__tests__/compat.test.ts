import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  getArrayElement,
  getBaseSchema,
  getDef,
  getDefaultValue,
  getEnumValues,
  getIntersection,
  getLiteralValue,
  getLiteralValues,
  getShape,
  getStringChecks,
  getUnionOptions,
  hasDateTimeCheck,
  isDefaultSchema,
  isIntersectionSchema,
  isLiteralSchema,
  isObjectSchema,
  isOptional,
  isV4,
} from '../compat';

/**
 * The package ships Zod v3, so every v4 branch in this module is exercised with
 * a hand-built stand-in that carries the `_zod.def` internals v4 exposes. These
 * are inputs to a shape sniffer, not stubs of our own code.
 */
const v4 = (def: Record<string, unknown>) => ({ _zod: { def } });

describe('isV4', () => {
  it('recognises a schema that carries v4 internals', () => {
    expect(isV4(v4({ type: 'string' }))).toBe(true);
  });

  it('does not mistake a v3 schema for a v4 one', () => {
    expect(isV4(z.string())).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'nope'],
    ['a number', 3],
  ])('does not mistake %s for a schema', (_label, value) => {
    expect(isV4(value)).toBe(false);
  });
});

describe('getDef', () => {
  it('reads v3 internals off _def', () => {
    const schema = z.string();

    expect(getDef(schema)).toBe((schema as unknown as { _def: unknown })._def);
  });

  it('does not read v3 internals off _zod.def', () => {
    expect(getDef({ _def: 'v3', _zod: { def: 'v4' } })).toBe('v4');
  });

  it('reads v4 internals off _zod.def', () => {
    expect(getDef(v4({ type: 'string' }))).toEqual({ type: 'string' });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a primitive', 42],
  ])('reads nothing off %s', (_label, value) => {
    expect(getDef(value)).toBeUndefined();
  });
});

describe('isOptional', () => {
  it('asks the schema itself when it can answer', () => {
    expect(isOptional(z.string().optional())).toBe(true);
    expect(isOptional(z.string())).toBe(false);
  });

  it('falls back to parsing undefined when the schema has no isOptional', () => {
    expect(isOptional({ safeParse: (value: unknown) => ({ success: value === undefined }) })).toBe(true);
    expect(isOptional({ safeParse: () => ({ success: false }) })).toBe(false);
  });

  it('treats something that is neither as required', () => {
    expect(isOptional({})).toBe(false);
  });
});

describe('getShape', () => {
  it('reads the shape a v3 object schema exposes', () => {
    expect(Object.keys(getShape(z.object({ a: z.string(), b: z.number() }))!)).toEqual(['a', 'b']);
  });

  it('calls the shape thunk when the internals hold a function', () => {
    expect(getShape({ _def: { shape: () => ({ a: 1 }) } })).toEqual({ a: 1 });
  });

  it('reads a plain shape object off the internals', () => {
    expect(getShape(v4({ shape: { a: 1 } }))).toEqual({ a: 1 });
  });

  it('reads nothing off a schema with no shape', () => {
    expect(getShape(z.string())).toBeUndefined();
  });

  it('ignores a non-object shape property', () => {
    expect(getShape({ shape: 'not-a-shape' })).toBeUndefined();
  });
});

describe('getBaseSchema', () => {
  it('leaves a bare schema alone', () => {
    const schema = z.string();
    expect(getBaseSchema(schema)).toBe(schema);
  });

  it.each([
    ['optional', (inner: z.ZodString) => inner.optional()],
    ['nullable', (inner: z.ZodString) => inner.nullable()],
    ['defaulted', (inner: z.ZodString) => inner.default('x')],
  ])('unwraps a %s schema back to what it wraps', (_label, wrap) => {
    const inner = z.string();
    expect(getBaseSchema(wrap(inner))).toBe(inner);
  });

  it('unwraps every layer of a stacked wrapper', () => {
    const inner = z.string();
    expect(getBaseSchema(inner.default('x').optional())).toBe(inner);
  });

  it('unwraps an effect back to the schema it refines', () => {
    const inner = z.string();
    expect(getBaseSchema({ _def: { schema: inner } })).toBe(inner);
  });

  it('leaves something with no internals alone', () => {
    const value = { not: 'a schema' };
    expect(getBaseSchema(value)).toBe(value);
  });
});

describe('getEnumValues', () => {
  it('reads the values a v3 enum lists', () => {
    expect(getEnumValues(z.enum(['a', 'b']))).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('prefers v4 entries over v3 values when both are present', () => {
    expect(getEnumValues(v4({ entries: ['x'], values: ['y'] }))).toEqual(['x']);
  });

  it('reads nothing off a schema that is not an enum', () => {
    expect(getEnumValues(z.string())).toBeUndefined();
  });
});

describe('getArrayElement', () => {
  it('reads the element schema of an array', () => {
    const element = z.string();
    expect(getArrayElement(z.array(element))).toBe(element);
  });

  it('prefers the v4 element key over the v3 type key', () => {
    expect(getArrayElement(v4({ element: 'v4', type: 'v3' }))).toBe('v4');
  });

  it('falls back to the v3 type key', () => {
    expect(getArrayElement({ _def: { type: 'v3' } })).toBe('v3');
  });

  it('reads nothing off a schema with neither', () => {
    expect(getArrayElement({ _def: {} })).toBeUndefined();
  });
});

describe('getLiteralValue', () => {
  it('reads the single value a v3 literal holds', () => {
    expect(getLiteralValue(z.literal('hello'))).toBe('hello');
  });

  it('takes the first of the values a v4 literal lists', () => {
    expect(getLiteralValue(v4({ values: ['first', 'second'] }))).toBe('first');
  });

  it('accepts a bare v4 value that is not wrapped in an array', () => {
    expect(getLiteralValue(v4({ values: 'only' }))).toBe('only');
  });

  it('reads a falsy literal rather than skipping it', () => {
    expect(getLiteralValue(z.literal(false))).toBe(false);
    expect(getLiteralValue(z.literal(0))).toBe(0);
  });

  it('reads nothing off a schema that is not a literal', () => {
    expect(getLiteralValue(z.string())).toBeUndefined();
  });
});

describe('getLiteralValues', () => {
  it('wraps a v3 single value in an array so callers see one list either way', () => {
    expect(getLiteralValues(z.literal('hello'))).toEqual(['hello']);
  });

  it('passes a v4 values list straight through', () => {
    expect(getLiteralValues(v4({ values: ['a', 'b'] }))).toEqual(['a', 'b']);
  });

  it('reads nothing off a schema that is not a literal', () => {
    expect(getLiteralValues(z.string())).toBeUndefined();
  });
});

describe('getDefaultValue', () => {
  it('calls the thunk a v3 default holds', () => {
    expect(getDefaultValue(z.string().default('fallback'))).toBe('fallback');
  });

  it('reads a v4 default straight off the internals', () => {
    expect(getDefaultValue(v4({ defaultValue: 'fallback' }))).toBe('fallback');
  });

  it('reads nothing off a schema with no default', () => {
    expect(getDefaultValue(z.string())).toBeUndefined();
  });
});

describe('getUnionOptions', () => {
  it('lists the branches of a union', () => {
    expect(getUnionOptions(z.union([z.string(), z.number()]))).toHaveLength(2);
  });

  it('lists nothing for a schema that is not a union', () => {
    expect(getUnionOptions(z.string())).toBeUndefined();
  });
});

describe('getIntersection', () => {
  it('reads both halves of an intersection', () => {
    const left = z.object({ a: z.string() });
    const right = z.object({ b: z.string() });

    expect(getIntersection(z.intersection(left, right))).toEqual({ left, right });
  });

  it('falls back to the public def a v4 schema exposes', () => {
    expect(getIntersection({ def: { left: 'l', right: 'r' } })).toEqual({ left: 'l', right: 'r' });
  });

  it('reads nothing when only one half is present', () => {
    expect(getIntersection({ _def: { left: 'l' } })).toBeUndefined();
  });

  it('reads nothing off a schema that is not an intersection', () => {
    expect(getIntersection(z.string())).toBeUndefined();
  });
});

describe('getStringChecks', () => {
  it('lists the checks a constrained string carries', () => {
    expect(getStringChecks(z.string().min(1).email()).length).toBeGreaterThan(0);
  });

  it('lists nothing for an unconstrained string', () => {
    expect(getStringChecks(z.string())).toEqual([]);
  });

  it('lists nothing for something that is not a schema', () => {
    expect(getStringChecks(null)).toEqual([]);
  });
});

describe('hasDateTimeCheck', () => {
  it('spots the datetime check on a v3 string', () => {
    expect(hasDateTimeCheck(getStringChecks(z.string().datetime()))).toBe(true);
  });

  it('does not mistake another v3 check for a datetime', () => {
    expect(hasDateTimeCheck(getStringChecks(z.string().email()))).toBe(false);
  });

  it('spots the datetime format on a v4 check', () => {
    expect(hasDateTimeCheck([v4({ check: 'string_format', format: 'datetime' })])).toBe(true);
  });

  it('does not mistake another v4 string format for a datetime', () => {
    expect(hasDateTimeCheck([v4({ check: 'string_format', format: 'email' })])).toBe(false);
  });

  it('does not mistake a v4 check of another kind for a datetime', () => {
    expect(hasDateTimeCheck([v4({ check: 'min_length', format: 'datetime' })])).toBe(false);
  });

  it('finds nothing in an empty list', () => {
    expect(hasDateTimeCheck([])).toBe(false);
  });
});

describe('isObjectSchema', () => {
  it('recognises an object schema', () => {
    expect(isObjectSchema(z.object({ a: z.string() }))).toBe(true);
  });

  it('does not treat an intersection as a plain object, since it has no shape of its own', () => {
    expect(isObjectSchema(z.intersection(z.object({ a: z.string() }), z.object({ b: z.string() })))).toBe(false);
  });

  it('does not treat a scalar as an object', () => {
    expect(isObjectSchema(z.string())).toBe(false);
  });
});

describe('isDefaultSchema', () => {
  it('recognises a v3 defaulted schema', () => {
    expect(isDefaultSchema(z.string().default('x'))).toBe(true);
  });

  it('recognises a v4 defaulted schema by its type tag', () => {
    expect(isDefaultSchema(v4({ type: 'default' }))).toBe(true);
  });

  it('recognises a schema that merely carries a default value', () => {
    expect(isDefaultSchema(v4({ defaultValue: 'x' }))).toBe(true);
  });

  it('does not treat a plain schema as defaulted', () => {
    expect(isDefaultSchema(z.string())).toBe(false);
  });
});

describe('isLiteralSchema', () => {
  it('recognises a v3 literal', () => {
    expect(isLiteralSchema(z.literal('a'))).toBe(true);
  });

  it('recognises a v4 literal by its type tag', () => {
    expect(isLiteralSchema(v4({ type: 'literal' }))).toBe(true);
  });

  it('recognises a literal by its constructor name alone', () => {
    class _ZodLiteral {}
    expect(isLiteralSchema(new _ZodLiteral())).toBe(true);
  });

  it('does not treat a plain string schema as a literal', () => {
    expect(isLiteralSchema(z.string())).toBe(false);
  });
});

describe('isIntersectionSchema', () => {
  it('recognises a v3 intersection', () => {
    expect(isIntersectionSchema(z.intersection(z.object({ a: z.string() }), z.object({ b: z.string() })))).toBe(true);
  });

  it('recognises a v4 intersection by its type tag', () => {
    expect(isIntersectionSchema(v4({ type: 'intersection', left: 'l', right: 'r' }))).toBe(true);
  });

  it('does not treat an unrelated schema that happens to carry left and right as an intersection', () => {
    expect(isIntersectionSchema(v4({ type: 'object', left: 'l', right: 'r' }))).toBe(false);
  });

  it('does not treat a scalar as an intersection', () => {
    expect(isIntersectionSchema(z.string())).toBe(false);
  });
});
