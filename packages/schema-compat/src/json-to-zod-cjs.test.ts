import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

const requireFromPackage = createRequire(import.meta.url);

describe('CommonJS build', () => {
  it('converts JSON Schema through jsonSchemaToZod', () => {
    const { jsonSchemaToZod } = requireFromPackage('../dist/json-to-zod.cjs') as {
      jsonSchemaToZod(schema: unknown): string;
    };

    const code = jsonSchemaToZod({
      type: 'object',
      properties: { name: { type: 'string' } },
      additionalProperties: { type: 'number' },
      required: ['name'],
    });

    const schema = Function('z', `"use strict";return (${code});`)(z) as z.ZodTypeAny;

    expect(schema.safeParse({ name: 'a', extra: 1 }).success).toBe(true);
    expect(schema.safeParse({ name: 'a', extra: 'nope' }).success).toBe(false);
  });
});
