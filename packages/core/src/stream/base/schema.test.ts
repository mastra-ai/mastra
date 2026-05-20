/**
 * Test for Zod v4 JSON Schema compatibility issue
 *
 * This test reproduces the bug where:
 * 1. OpenAISchemaCompatLayer.processZodType() adds .transform() to handle .optional(), .nullable(), .default()
 * 2. When the processed schema is converted to JSON Schema via asJsonSchema()
 * 3. It throws "Transforms cannot be represented in JSON Schema"
 *
 * Bug Report Pattern:
 * ```typescript
 * const schema = z.object({
 *   rate: z.string().nullish().default(""),
 * });
 * const result = await agent.generate(prompt, { structuredOutput: { schema } });
 * // Error: Transforms cannot be represented in JSON Schema
 * ```
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { asJsonSchema, getResponseFormat } from './schema';

describe('getResponseFormat', () => {
  it('applies Anthropic schema compatibility without removing local validation', async () => {
    const schema = z.object({
      score: z.number().min(0).max(1),
    });

    const responseFormat = getResponseFormat(schema, {
      model: {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet',
        supportsStructuredOutputs: true,
      },
    });

    expect(responseFormat.type).toBe('json');
    const schemaJson = JSON.stringify(responseFormat.type === 'json' ? responseFormat.schema : undefined);
    expect(schemaJson).toContain('score');
    expect(schemaJson).not.toContain('minimum');
    expect(schemaJson).not.toContain('maximum');

    const validResult = await schema['~standard'].validate({ score: 0.5 });
    expect(validResult).toEqual({ value: { score: 0.5 } });

    const invalidResult = await schema['~standard'].validate({ score: 1.2 });
    expect('issues' in invalidResult).toBe(true);
  });
});

describe('asJsonSchema - Zod v4 transform compatibility', () => {
  describe('should handle schemas with transforms', () => {
    it('should convert schema with .transform() to JSON Schema without error', () => {
      // This simulates what OpenAISchemaCompatLayer does:
      // It converts .optional() to .nullable().transform(v => v === null ? undefined : v)
      const schemaWithTransform = z.object({
        name: z.string(),
        // This is what OpenAISchemaCompatLayer produces for .optional() fields
        age: z
          .number()
          .nullable()
          .transform(v => (v === null ? undefined : v)),
      });

      // This should NOT throw "Transforms cannot be represented in JSON Schema"
      // Currently it DOES throw, which is the bug we're fixing
      expect(() => {
        asJsonSchema(schemaWithTransform);
      }).not.toThrow();

      const result = asJsonSchema(schemaWithTransform);
      expect(result).toBeDefined();
      expect(result?.type).toBe('object');
    });

    it('should convert schema with default transform to JSON Schema without error', () => {
      // This simulates what OpenAISchemaCompatLayer does for .default() fields:
      // It converts .default(value) to .nullable().transform(v => v === null ? defaultValue : v)
      const schemaWithDefaultTransform = z.object({
        name: z.string(),
        score: z
          .number()
          .nullable()
          .transform(v => (v === null ? 100 : v)),
      });

      expect(() => {
        asJsonSchema(schemaWithDefaultTransform);
      }).not.toThrow();

      const result = asJsonSchema(schemaWithDefaultTransform);
      expect(result).toBeDefined();
    });

    it('should convert complex nested schema with transforms to JSON Schema', () => {
      // Mimics the user's EpidemiologySchema pattern
      const schemaWithNestedTransforms = z.object({
        prevalence: z.object({
          global: z
            .object({
              rate: z
                .string()
                .nullable()
                .transform(v => (v === null ? '' : v)),
              context: z
                .string()
                .nullable()
                .transform(v => (v === null ? '' : v)),
            })
            .nullable(),
          regional: z
            .array(
              z.object({
                region: z
                  .string()
                  .nullable()
                  .transform(v => (v === null ? '' : v)),
                rate: z
                  .string()
                  .nullable()
                  .transform(v => (v === null ? '' : v)),
              }),
            )
            .nullable()
            .transform(v => (v === null ? [] : v)),
        }),
        totalPatients: z.object({
          estimated: z
            .string()
            .nullable()
            .transform(v => (v === null ? '' : v)),
          year: z.number().nullable(),
        }),
      });

      // This currently fails with "Transforms cannot be represented in JSON Schema"
      expect(() => {
        asJsonSchema(schemaWithNestedTransforms);
      }).not.toThrow();

      const result = asJsonSchema(schemaWithNestedTransforms);
      expect(result).toBeDefined();
      expect(result?.type).toBe('object');
    });
  });

  describe('schemas without transforms should still work', () => {
    it('should convert simple schema to JSON Schema', () => {
      const simpleSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      expect(() => {
        asJsonSchema(simpleSchema);
      }).not.toThrow();

      const result = asJsonSchema(simpleSchema);
      expect(result).toBeDefined();
      expect(result?.type).toBe('object');
    });

    it('should convert schema with nullable (no transform) to JSON Schema', () => {
      const nullableSchema = z.object({
        name: z.string(),
        deletedAt: z.string().nullable(),
      });

      expect(() => {
        asJsonSchema(nullableSchema);
      }).not.toThrow();

      const result = asJsonSchema(nullableSchema);
      expect(result).toBeDefined();
    });
  });

  describe('validation should work after JSON Schema conversion', () => {
    it('should parse correctly with transform after getting JSON Schema', () => {
      const schemaWithTransform = z.object({
        name: z.string(),
        age: z
          .number()
          .nullable()
          .transform(v => (v === null ? undefined : v)),
      });

      // First, should be able to get JSON Schema without error
      expect(() => {
        asJsonSchema(schemaWithTransform);
      }).not.toThrow();

      // Then, the schema should still parse and transform correctly
      const result = schemaWithTransform.parse({ name: 'John', age: null });
      expect(result).toEqual({ name: 'John', age: undefined });
    });
  });
});
