/**
 * Tests for packages/core/src/utils/zod-utils.ts
 *
 * All eight exported helpers are pure type-inspection utilities with no I/O.
 * The helpers are designed to work across both Zod 3 and Zod 4 by inspecting
 * the raw `_def` / `_zod.def` structure, so the test suite exercises every
 * branch of the dual-version logic.
 *
 * The project ships `zod/v4` as the canonical import, so all schemas in these
 * tests are created with Zod 4. Where Zod 3 normalisation is tested (e.g.
 * `getZodTypeName` returning "ZodString" from a v4 lowercase type string) the
 * Zod 3 structure is simulated by constructing minimal plain objects that match
 * the expected shape.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import {
  getZodDef,
  getZodInnerType,
  getZodTypeName,
  isZodArray,
  isZodObject,
  isZodType,
  safeExtendZodObject,
  unwrapZodType,
} from './zod-utils';

// ---------------------------------------------------------------------------
// isZodType
// ---------------------------------------------------------------------------

describe('isZodType', () => {
  it('returns true for a z.string() schema', () => {
    expect(isZodType(z.string())).toBe(true);
  });

  it('returns true for a z.number() schema', () => {
    expect(isZodType(z.number())).toBe(true);
  });

  it('returns true for a z.object() schema', () => {
    expect(isZodType(z.object({ a: z.string() }))).toBe(true);
  });

  it('returns true for a z.array() schema', () => {
    expect(isZodType(z.array(z.string()))).toBe(true);
  });

  it('returns true for a z.optional() schema', () => {
    expect(isZodType(z.string().optional())).toBe(true);
  });

  it('returns false for null', () => {
    expect(isZodType(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isZodType(undefined)).toBe(false);
  });

  it('returns false for a plain number', () => {
    expect(isZodType(42)).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isZodType('hello')).toBe(false);
  });

  it('returns true for a plain object that duck-types Zod internals', () => {
    expect(isZodType({ _def: {}, parse: () => {}, safeParse: () => {} })).toBe(true);
  });

  it('returns false for an object missing the parse method', () => {
    expect(isZodType({ _def: {}, safeParse: () => {} })).toBe(false);
  });

  it('returns false for an object missing safeParse', () => {
    expect(isZodType({ _def: {}, parse: () => {} })).toBe(false);
  });

  it('returns false for a function', () => {
    expect(isZodType(() => {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getZodTypeName
// ---------------------------------------------------------------------------

describe('getZodTypeName', () => {
  it('returns "ZodString" for z.string()', () => {
    const name = getZodTypeName(z.string());
    expect(name).toBe('ZodString');
  });

  it('returns "ZodNumber" for z.number()', () => {
    expect(getZodTypeName(z.number())).toBe('ZodNumber');
  });

  it('returns "ZodBoolean" for z.boolean()', () => {
    expect(getZodTypeName(z.boolean())).toBe('ZodBoolean');
  });

  it('returns "ZodObject" for z.object()', () => {
    expect(getZodTypeName(z.object({}))).toBe('ZodObject');
  });

  it('returns "ZodArray" for z.array()', () => {
    expect(getZodTypeName(z.array(z.string()))).toBe('ZodArray');
  });

  it('returns "ZodOptional" for z.string().optional()', () => {
    expect(getZodTypeName(z.string().optional())).toBe('ZodOptional');
  });

  it('returns "ZodNullable" for z.string().nullable()', () => {
    expect(getZodTypeName(z.string().nullable())).toBe('ZodNullable');
  });

  it('returns "ZodDefault" for z.string().default("x")', () => {
    expect(getZodTypeName(z.string().default('x'))).toBe('ZodDefault');
  });

  it('normalises a Zod 3-style _def.typeName to the same string', () => {
    // Simulate a Zod 3 schema object
    const zod3Schema = { _def: { typeName: 'ZodString' }, parse: () => {}, safeParse: () => {} } as any;
    expect(getZodTypeName(zod3Schema)).toBe('ZodString');
  });

  it('returns undefined for a schema with no recognisable type info', () => {
    const bare = { _def: {}, parse: () => {}, safeParse: () => {} } as any;
    expect(getZodTypeName(bare)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// isZodArray
// ---------------------------------------------------------------------------

describe('isZodArray', () => {
  it('returns true for z.array(z.string())', () => {
    expect(isZodArray(z.array(z.string()))).toBe(true);
  });

  it('returns true for z.array(z.number())', () => {
    expect(isZodArray(z.array(z.number()))).toBe(true);
  });

  it('returns false for z.string()', () => {
    expect(isZodArray(z.string())).toBe(false);
  });

  it('returns false for z.object()', () => {
    expect(isZodArray(z.object({ items: z.array(z.string()) }))).toBe(false);
  });

  it('returns false for a non-Zod value', () => {
    expect(isZodArray([])).toBe(false);
    expect(isZodArray(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isZodObject
// ---------------------------------------------------------------------------

describe('isZodObject', () => {
  it('returns true for z.object({})', () => {
    expect(isZodObject(z.object({}))).toBe(true);
  });

  it('returns true for a z.object() with nested fields', () => {
    expect(isZodObject(z.object({ name: z.string(), age: z.number() }))).toBe(true);
  });

  it('returns false for z.array()', () => {
    expect(isZodObject(z.array(z.string()))).toBe(false);
  });

  it('returns false for z.string()', () => {
    expect(isZodObject(z.string())).toBe(false);
  });

  it('returns false for a plain JS object', () => {
    expect(isZodObject({ a: 1 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// safeExtendZodObject
// ---------------------------------------------------------------------------

describe('safeExtendZodObject', () => {
  it('adds a new field to a plain ZodObject', () => {
    const base = z.object({ name: z.string() });
    const extended = safeExtendZodObject(base, { age: z.number() });

    expect(isZodObject(extended)).toBe(true);
    // The extended schema should accept an object with both fields
    const result = extended.safeParse({ name: 'Alice', age: 30 });
    expect(result.success).toBe(true);
  });

  it('the base schema is not mutated', () => {
    const base = z.object({ name: z.string() });
    safeExtendZodObject(base, { age: z.number() });

    // Original schema should reject the extra field in strict mode
    const result = base.safeParse({ name: 'Alice' });
    expect(result.success).toBe(true);
  });

  it('can override an existing field type', () => {
    const base = z.object({ value: z.string() });
    const extended = safeExtendZodObject(base, { value: z.number() });

    expect(extended.safeParse({ value: 42 }).success).toBe(true);
    expect(extended.safeParse({ value: 'hello' }).success).toBe(false);
  });

  it('adds multiple fields at once', () => {
    const base = z.object({ id: z.string() });
    const extended = safeExtendZodObject(base, {
      name: z.string(),
      active: z.boolean(),
    });

    expect(extended.safeParse({ id: '1', name: 'Bob', active: true }).success).toBe(true);
  });

  it('uses safeExtend when available (Zod 4 path)', () => {
    const base = z.object({ name: z.string() });
    let safeExtendCalled = false;
    const patchedBase = Object.create(base);
    patchedBase.safeExtend = function (...args: any[]) {
      safeExtendCalled = true;
      return (base.extend as any)(...args);
    };

    safeExtendZodObject(patchedBase, { age: z.number() });
    expect(safeExtendCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getZodDef
// ---------------------------------------------------------------------------

describe('getZodDef', () => {
  it('returns the _def object for a z.string() schema', () => {
    const def = getZodDef(z.string());
    expect(def).toBeDefined();
    expect(typeof def).toBe('object');
  });

  it('returns a def with type info for z.number()', () => {
    const def = getZodDef(z.number());
    expect(def).toBeDefined();
  });

  it('returns the _def for a z.object() schema', () => {
    const schema = z.object({ a: z.string() });
    const def = getZodDef(schema);
    expect(def).toBeDefined();
  });

  it('prefers _zod.def over _def when both exist (Zod 4 internal path)', () => {
    const zod4Style = {
      _zod: { def: { type: 'string', marker: 'zod4' } },
      _def: { typeName: 'ZodString', marker: 'zod3' },
      parse: () => {},
      safeParse: () => {},
    } as any;
    const def = getZodDef(zod4Style);
    expect(def.marker).toBe('zod4');
  });

  it('falls back to _def when _zod.def is absent', () => {
    const zod3Style = {
      _def: { typeName: 'ZodString', marker: 'zod3' },
      parse: () => {},
      safeParse: () => {},
    } as any;
    const def = getZodDef(zod3Style);
    expect(def.marker).toBe('zod3');
  });
});

// ---------------------------------------------------------------------------
// getZodInnerType
// ---------------------------------------------------------------------------

describe('getZodInnerType', () => {
  it('returns the inner type for ZodOptional', () => {
    const schema = z.string().optional();
    const inner = getZodInnerType(schema, 'ZodOptional');
    expect(inner).toBeDefined();
    expect(getZodTypeName(inner!)).toBe('ZodString');
  });

  it('returns the inner type for ZodNullable', () => {
    const schema = z.number().nullable();
    const inner = getZodInnerType(schema, 'ZodNullable');
    expect(inner).toBeDefined();
    expect(getZodTypeName(inner!)).toBe('ZodNumber');
  });

  it('returns the inner type for ZodDefault', () => {
    const schema = z.string().default('hello');
    const inner = getZodInnerType(schema, 'ZodDefault');
    expect(inner).toBeDefined();
    expect(getZodTypeName(inner!)).toBe('ZodString');
  });

  it('returns undefined for an unrecognised typeName', () => {
    const schema = z.string();
    expect(getZodInnerType(schema, 'ZodUnknownWrapper')).toBeUndefined();
  });

  it('returns undefined when called on a non-wrapper type', () => {
    // z.string() has no innerType
    const schema = z.string();
    expect(getZodInnerType(schema, 'ZodString')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// unwrapZodType
// ---------------------------------------------------------------------------

describe('unwrapZodType', () => {
  it('returns the schema unchanged when it has no wrapper', () => {
    const schema = z.string();
    expect(unwrapZodType(schema)).toBe(schema);
  });

  it('unwraps a single ZodOptional to the base ZodString', () => {
    const schema = z.string().optional();
    const unwrapped = unwrapZodType(schema);
    expect(getZodTypeName(unwrapped)).toBe('ZodString');
  });

  it('unwraps a single ZodNullable to the base ZodNumber', () => {
    const schema = z.number().nullable();
    const unwrapped = unwrapZodType(schema);
    expect(getZodTypeName(unwrapped)).toBe('ZodNumber');
  });

  it('unwraps ZodDefault wrapping ZodBoolean', () => {
    const schema = z.boolean().default(false);
    const unwrapped = unwrapZodType(schema);
    expect(getZodTypeName(unwrapped)).toBe('ZodBoolean');
  });

  it('unwraps multiple layers: optional(nullable(string)) → ZodString', () => {
    const schema = z.string().nullable().optional();
    const unwrapped = unwrapZodType(schema);
    expect(getZodTypeName(unwrapped)).toBe('ZodString');
  });

  it('unwraps deeply: default(optional(nullable(array(string)))) → ZodArray', () => {
    const schema = z.array(z.string()).nullable().optional().default([]);
    const unwrapped = unwrapZodType(schema);
    expect(getZodTypeName(unwrapped)).toBe('ZodArray');
  });

  it('stops at a ZodObject (non-wrapper type)', () => {
    const schema = z.object({ name: z.string() }).optional();
    const unwrapped = unwrapZodType(schema);
    expect(getZodTypeName(unwrapped)).toBe('ZodObject');
  });

  it('stops at a ZodArray (non-wrapper type)', () => {
    const schema = z.array(z.number()).nullable();
    const unwrapped = unwrapZodType(schema);
    expect(getZodTypeName(unwrapped)).toBe('ZodArray');
  });
});
