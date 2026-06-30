import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { GoogleSchemaCompatLayer } from './provider-compats/google';
import type { ModelInformation } from './types';

const modelInfo: ModelInformation = {
  provider: 'google',
  modelId: 'gemini-1.5-pro',
  supportsStructuredOutputs: true,
};

describe('defaultZodNullableHandler inner-type gating', () => {
  const layer = new GoogleSchemaCompatLayer(modelInfo);

  it('passes a nullable wrapping an unsupported inner type through unchanged', () => {
    // ZodTuple is in UNSUPPORTED_ZOD_TYPES, so a nullable tuple should be left
    // alone (matching the v3 handler) rather than processed and rejected.
    const schema = z.tuple([z.string()]).nullable();

    let result: any;
    expect(() => {
      result = layer.defaultZodNullableHandler(schema as any);
    }).not.toThrow();

    expect(result.safeParse(['x']).success).toBe(true);
    expect(result.safeParse(null).success).toBe(true);
  });

  it('still processes a nullable wrapping a supported inner type', () => {
    const schema = z.string().nullable();

    const result = layer.defaultZodNullableHandler(schema as any);

    expect(result.safeParse('hello').success).toBe(true);
    expect(result.safeParse(null).success).toBe(true);
  });

  it('passes an optional wrapping an unsupported inner type through unchanged', () => {
    // Same inner-type gating defect affects the optional handler.
    const schema = z.tuple([z.string()]).optional();

    let result: any;
    expect(() => {
      result = layer.defaultZodOptionalHandler(schema as any);
    }).not.toThrow();

    // The original schema is returned untouched (pass-through, not re-wrapped).
    expect(result).toBe(schema);
    expect(result.safeParse(['x']).success).toBe(true);
    expect(result.safeParse(undefined).success).toBe(true);
  });

  it('still processes an optional wrapping a supported inner type', () => {
    const schema = z.string().optional();

    const result = layer.defaultZodOptionalHandler(schema as any);

    expect(result.safeParse('hello').success).toBe(true);
    expect(result.safeParse(undefined).success).toBe(true);
  });
});
