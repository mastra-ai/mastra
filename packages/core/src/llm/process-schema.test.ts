import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { processSchema } from './process-schema';

describe('processSchema.openai', () => {
  it('should convert optional fields to nullable', () => {
    const schema = z.object({
      temperature: z.number(),
      windSpeed: z.number().optional(),
    });

    const openaiSchema = processSchema.openai(schema);

    // Type test: verify the inferred type is correct
    type OpenAISchema = z.infer<typeof openaiSchema>;
    const data: OpenAISchema = {
      temperature: 20,
      // @ts-expect-error -- TODO: remove this when we have correct return types
      windSpeed: null, // Should be number | null, not number | undefined
    };

    // Verify runtime behavior: null should be accepted
    const withNull = openaiSchema.parse(data);
    expect(withNull).toEqual({
      temperature: 20,
      windSpeed: null,
    });

    // Verify that undefined is rejected
    const withUndefined = openaiSchema.safeParse({
      temperature: 20,
      windSpeed: undefined,
    });
    expect(withUndefined.success).toBe(false);
    expect(withUndefined.error).toBeInstanceOf(z.ZodError);
  });

  it('should handle multiple optional fields', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
      email: z.string().optional(),
      active: z.boolean(),
    });

    const openaiSchema = processSchema.openai(schema);

    type OpenAISchemaType = z.infer<typeof openaiSchema>;
    const data: OpenAISchemaType = {
      name: 'John',
      // @ts-expect-error -- TODO: remove this when we have correct return types
      age: null,
      // @ts-expect-error -- TODO: remove this when we have correct return types
      email: null,
      active: true,
    };

    // Verify runtime behavior: null should be accepted
    expect(openaiSchema.parse(data)).toEqual(data);

    // Verify that undefined is rejected
    const withUndefined = openaiSchema.safeParse({
      name: 'John',
      age: undefined,
      email: undefined,
      active: true,
    });
    expect(withUndefined.success).toBe(false);
    expect(withUndefined.error).toBeInstanceOf(z.ZodError);
  });

  it('should handle deep optional fields', () => {
    const schema = z.object({
      name: z.string(),
      address: z.object({
        street: z.string(),
        city: z.string(),
        zip: z.string().optional(),
      }),
      active: z.boolean(),
    });

    const openaiSchema = processSchema.openai(schema);

    type OpenAISchemaType = z.infer<typeof openaiSchema>;
    const data: OpenAISchemaType = {
      name: 'John',
      address: {
        street: '123 Main St',
        city: 'Anytown',
        // @ts-expect-error -- TODO: remove this when we have correct return types
        zip: null,
      },
      active: true,
    };
    const parsed = openaiSchema.parse(data);
    expect(parsed).toEqual(data);
  });

  it('should handle .optional().nullable()', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional().nullable(),
      active: z.boolean(),
    });

    const openaiSchema = processSchema.openai(schema);

    type OpenAISchemaType = z.infer<typeof openaiSchema>;
    const data: OpenAISchemaType = {
      name: 'John',
      age: null,
      active: true,
    };

    const parsed = openaiSchema.parse(data);
    expect(parsed).toEqual(data);

    // Verify that undefined is rejected
    const withUndefined = openaiSchema.safeParse({ name: 'John', age: undefined, active: true });
    expect(withUndefined.success).toBe(false);
    expect(withUndefined.error).toBeInstanceOf(z.ZodError);
    const withoutField = openaiSchema.safeParse({ name: 'John', active: true });
    expect(withoutField.success).toBe(false);
    expect(withoutField.error).toBeInstanceOf(z.ZodError);
  });
});
