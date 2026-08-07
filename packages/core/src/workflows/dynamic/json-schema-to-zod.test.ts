/**
 * Rehydrating dynamic workflows must not silently drop schema constraints.
 * Guard the MVP subset by asserting we hard-crash on keywords the converter
 * does not understand — otherwise unsupported schemas would degrade to
 * `z.any()` and let malformed data flow through execution.
 */
import { describe, it, expect } from 'vitest';
import type { z } from 'zod';

import { jsonSchemaToZod, validateStorableJsonSchema } from './json-schema-to-zod';

describe('jsonSchemaToZod', () => {
  it('round-trips supported primitive + object shapes', () => {
    const zod = jsonSchemaToZod({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['name'],
    });
    const parsed = (zod as z.ZodObject<any>).parse({ name: 'Tony', tags: ['a', 'b'] });
    expect(parsed).toEqual({ name: 'Tony', tags: ['a', 'b'] });
  });

  it('supports enum', () => {
    const zod = jsonSchemaToZod({ enum: ['red', 'blue'] });
    expect(zod.parse('red')).toBe('red');
    expect(() => zod.parse('green')).toThrow();
  });

  it('supports primitive const via z.literal', () => {
    expect(jsonSchemaToZod({ const: 'fixed' }).parse('fixed')).toBe('fixed');
    expect(() => jsonSchemaToZod({ const: 'fixed' }).parse('other')).toThrow();
    expect(jsonSchemaToZod({ const: 42 }).parse(42)).toBe(42);
    expect(jsonSchemaToZod({ const: false }).parse(false)).toBe(false);
    expect(jsonSchemaToZod({ const: null }).parse(null)).toBe(null);
  });

  it('rejects non-primitive const values instead of dropping the constraint', () => {
    expect(() => jsonSchemaToZod({ const: { nested: true } })).toThrow(/non-primitive "const"/);
    const messages: string[] = [];
    const zod = jsonSchemaToZod(
      { const: [1, 2] },
      { onUnsupportedSchema: 'warn', onUnsupported: m => messages.push(m) },
    );
    expect(zod.parse('anything')).toBe('anything'); // degraded to z.any()
    expect(messages[0]).toMatch(/non-primitive "const"/);
  });

  it('preserves non-string enum member types instead of coercing to string', () => {
    const numeric = jsonSchemaToZod({ enum: [1, 2, 3] });
    expect(numeric.parse(2)).toBe(2);
    expect(() => numeric.parse('2')).toThrow();

    const mixed = jsonSchemaToZod({ enum: ['a', 1, true, null] });
    expect(mixed.parse('a')).toBe('a');
    expect(mixed.parse(1)).toBe(1);
    expect(mixed.parse(true)).toBe(true);
    expect(mixed.parse(null)).toBe(null);
    expect(() => mixed.parse('1')).toThrow();
  });

  it('rejects enums with non-primitive members', () => {
    expect(() => jsonSchemaToZod({ enum: [{ bad: true }] })).toThrow(/non-primitive members/);
  });

  it('rejects tuple-form items instead of widening to z.array(z.any())', () => {
    expect(() => jsonSchemaToZod({ type: 'array', items: [{ type: 'string' }, { type: 'number' }] })).toThrow(
      /tuple-form "items"/,
    );
    const messages: string[] = [];
    const zod = jsonSchemaToZod(
      { type: 'array', items: [{ type: 'string' }] },
      { onUnsupportedSchema: 'warn', onUnsupported: m => messages.push(m) },
    );
    expect(zod.parse({ not: 'an array' })).toEqual({ not: 'an array' }); // degraded to z.any()
    expect(messages[0]).toMatch(/tuple-form "items"/);
  });

  it.each(['oneOf', 'anyOf', 'allOf', 'not', '$ref', 'patternProperties', 'discriminator'])(
    'throws on unsupported keyword %s (default mode)',
    keyword => {
      expect(() => jsonSchemaToZod({ [keyword]: [{ type: 'string' }] } as any)).toThrow(
        new RegExp(`unsupported JSON Schema keyword "${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
      );
    },
  );

  it('in warn mode, degrades unsupported keyword to z.any() and calls onUnsupported', () => {
    const messages: string[] = [];
    const zod = jsonSchemaToZod({ oneOf: [{ type: 'string' }, { type: 'number' }] } as any, {
      onUnsupportedSchema: 'warn',
      onUnsupported: m => messages.push(m),
    });
    // z.any() accepts anything.
    expect(zod.parse('hello')).toBe('hello');
    expect(zod.parse(42)).toBe(42);
    expect(zod.parse({ arbitrary: true })).toEqual({ arbitrary: true });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/oneOf/);
  });

  it('in warn mode, degrades a nested unsupported keyword under properties and keeps other fields typed', () => {
    const messages: string[] = [];
    const zod = jsonSchemaToZod(
      {
        type: 'object',
        properties: {
          name: { type: 'string' },
          payload: { anyOf: [{ type: 'string' }, { type: 'number' }] },
        },
        required: ['name'],
      } as any,
      { onUnsupportedSchema: 'warn', onUnsupported: m => messages.push(m) },
    );
    // `name` is still a required string; `payload` is z.any().
    const parsed = (zod as any).parse({ name: 'Tony', payload: { anything: true } });
    expect(parsed.name).toBe('Tony');
    // Required-string constraint is preserved.
    expect(() => (zod as any).parse({ name: 42, payload: 'ok' })).toThrow();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/anyOf/);
  });

  it('throws on unsupported type keyword', () => {
    expect(() => jsonSchemaToZod({ type: 'never' } as any)).toThrow(/unsupported JSON Schema type "never"/);
  });

  it('tolerates a bare schema with no type (annotation-only)', () => {
    const zod = jsonSchemaToZod({ description: 'freeform' } as any);
    expect(zod.parse(42)).toBe(42);
    expect(zod.parse('anything')).toBe('anything');
  });
});

describe('validateStorableJsonSchema', () => {
  it('returns ok for a schema with only supported keywords', () => {
    const result = validateStorableJsonSchema({
      type: 'object',
      properties: { name: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } },
      required: ['name'],
    });
    expect(result).toEqual({ ok: true });
  });

  it('returns ok for undefined / empty schema', () => {
    expect(validateStorableJsonSchema(undefined)).toEqual({ ok: true });
    expect(validateStorableJsonSchema({})).toEqual({ ok: true });
  });

  it('flags top-level oneOf without throwing', () => {
    const result = validateStorableJsonSchema({ oneOf: [{ type: 'string' }, { type: 'number' }] });
    expect(result).toEqual({ ok: false, unsupported: ['#: oneOf'] });
  });

  it('flags unsupported keywords nested inside properties with a JSON pointer', () => {
    const result = validateStorableJsonSchema({
      type: 'object',
      properties: {
        payload: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
    });
    expect(result).toEqual({ ok: false, unsupported: ['/properties/payload: anyOf'] });
  });

  it('flags unsupported keywords nested inside array items', () => {
    const result = validateStorableJsonSchema({
      type: 'array',
      items: { allOf: [{ type: 'string' }] },
    });
    expect(result).toEqual({ ok: false, unsupported: ['/items: allOf'] });
  });

  it('collects multiple offenses in one walk', () => {
    const result = validateStorableJsonSchema({
      oneOf: [{ type: 'string' }],
      properties: { x: { $ref: '#/definitions/foo' } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unsupported).toEqual(expect.arrayContaining(['#: oneOf', '/properties/x: $ref']));
    }
  });
});
