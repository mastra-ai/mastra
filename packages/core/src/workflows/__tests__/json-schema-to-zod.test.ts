/**
 * Rehydrating stored workflows must not silently drop schema constraints.
 * Guard the MVP subset by asserting we hard-crash on keywords the converter
 * does not understand — otherwise unsupported schemas would degrade to
 * `z.any()` and let malformed data flow through execution.
 */
import { describe, it, expect } from 'vitest';
import type { z } from 'zod';

import { jsonSchemaToZod } from '../load-from-storage';

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

  it.each(['oneOf', 'anyOf', 'allOf', 'not', '$ref', 'patternProperties', 'discriminator'])(
    'throws on unsupported keyword %s',
    keyword => {
      expect(() => jsonSchemaToZod({ [keyword]: [{ type: 'string' }] } as any)).toThrow(
        new RegExp(`unsupported JSON Schema keyword "${keyword.replace('$', '\\$')}"`),
      );
    },
  );

  it('throws on unsupported type keyword', () => {
    expect(() => jsonSchemaToZod({ type: 'never' } as any)).toThrow(/unsupported JSON Schema type "never"/);
  });

  it('tolerates a bare schema with no type (annotation-only)', () => {
    const zod = jsonSchemaToZod({ description: 'freeform' } as any);
    expect(zod.parse(42)).toBe(42);
    expect(zod.parse('anything')).toBe('anything');
  });
});
