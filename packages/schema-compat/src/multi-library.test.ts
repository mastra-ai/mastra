/**
 * Multi-Library Schema Support Tests
 *
 * This file demonstrates how Mastra's Standard Schema support enables
 * users to bring their own validation library. We test with:
 *
 * - Zod (the default, most popular)
 * - Valibot (lightweight alternative)
 * - ArkType (TypeScript-first with great inference)
 *
 * All three libraries implement Standard Schema, making them compatible
 * with Mastra's tool system via AI SDK's `asSchema` function.
 *
 * Key requirement: Libraries must implement BOTH:
 * - StandardSchemaV1 (for validation via ~standard.validate)
 * - StandardJSONSchemaV1 (for JSON Schema generation via ~standard.jsonSchema)
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import * as v from 'valibot';
import { type } from 'arktype';
import { asSchema } from '@ai-sdk/provider-utils';
import { isStandardSchema, isStandardJSONSchema } from './utils';

describe('Multi-Library Schema Support', () => {
  // ============================================================================
  // ZOD EXAMPLES
  // ============================================================================
  describe('Zod (via asSchema)', () => {
    it('should work with basic Zod schemas', async () => {
      const userSchema = z.object({
        name: z.string().min(1).describe('The user name'),
        email: z.string().email().describe('User email address'),
        age: z.number().int().positive().optional(),
      });

      const result = asSchema(userSchema);

      // JSON Schema is generated correctly
      expect(result.jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, description: 'The user name' },
          email: { type: 'string', format: 'email', description: 'User email address' },
          age: { type: 'integer' },
        },
        required: ['name', 'email'],
      });

      // Validation works
      const valid = await result.validate!({ name: 'John', email: 'john@example.com' });
      expect(valid.success).toBe(true);
    });

    it('should work with Zod enums and unions', async () => {
      const statusSchema = z.object({
        status: z.enum(['pending', 'approved', 'rejected']),
        priority: z.union([z.literal('low'), z.literal('medium'), z.literal('high')]),
      });

      const result = asSchema(statusSchema);

      expect(result.jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
        },
      });

      // Valid data
      const valid = await result.validate!({ status: 'pending', priority: 'high' });
      expect(valid.success).toBe(true);
    });

    it('should work with nested Zod schemas', async () => {
      const addressSchema = z.object({
        street: z.string(),
        city: z.string(),
        country: z.string(),
      });

      const personSchema = z.object({
        name: z.string(),
        address: addressSchema,
        tags: z.array(z.string()),
      });

      const result = asSchema(personSchema);

      expect(result.jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' },
            },
          },
          tags: { type: 'array', items: { type: 'string' } },
        },
      });
    });

    it('should validate data with Zod schemas', async () => {
      const schema = z.object({
        count: z.number().min(0).max(100),
      });

      const result = asSchema(schema);

      // Valid data
      const valid = await result.validate!({ count: 50 });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.value).toEqual({ count: 50 });
      }

      // Invalid data
      const invalid = await result.validate!({ count: 150 });
      expect(invalid.success).toBe(false);
    });
  });

  // ============================================================================
  // ARKTYPE EXAMPLES (implements both StandardSchemaV1 and StandardJSONSchemaV1)
  // ============================================================================
  describe('ArkType (via asSchema)', () => {
    it('should detect ArkType as Standard Schema', () => {
      const schema = type({
        name: 'string',
      });

      // ArkType implements both interfaces
      expect(isStandardSchema(schema)).toBe(true);
      expect(isStandardJSONSchema(schema)).toBe(true);
    });

    it('should work with basic ArkType schemas', async () => {
      const userSchema = type({
        name: 'string',
        email: 'string',
        age: 'number?',
      });

      const result = asSchema(userSchema);

      // JSON Schema is generated
      expect(result.jsonSchema).toBeDefined();
      expect(result.jsonSchema.type).toBe('object');

      // Validation works
      const valid = await result.validate!({ name: 'John', email: 'john@example.com' });
      expect(valid.success).toBe(true);
    });

    it('should validate with ArkType schemas', async () => {
      const schema = type({
        count: 'number',
      });

      const result = asSchema(schema);

      // Valid
      const valid = await result.validate!({ count: 42 });
      expect(valid.success).toBe(true);

      // Invalid
      const invalid = await result.validate!({ count: 'not a number' });
      expect(invalid.success).toBe(false);
    });

    it('should work with ArkType unions', async () => {
      const schema = type({
        status: "'pending' | 'approved' | 'rejected'",
      });

      const result = asSchema(schema);

      const valid = await result.validate!({ status: 'pending' });
      expect(valid.success).toBe(true);

      const invalid = await result.validate!({ status: 'invalid' });
      expect(invalid.success).toBe(false);
    });

    it('should work with nested ArkType schemas', async () => {
      const addressType = type({
        street: 'string',
        city: 'string',
      });

      const personType = type({
        name: 'string',
        address: addressType,
      });

      const result = asSchema(personType);

      const valid = await result.validate!({
        name: 'Bob',
        address: { street: '456 Oak Ave', city: 'LA' },
      });
      expect(valid.success).toBe(true);
    });

    it('should work with ArkType arrays', async () => {
      const schema = type({
        tags: 'string[]',
        scores: 'number[]',
      });

      const result = asSchema(schema);

      const valid = await result.validate!({
        tags: ['a', 'b', 'c'],
        scores: [1, 2, 3],
      });
      expect(valid.success).toBe(true);

      const invalid = await result.validate!({
        tags: ['a', 'b', 'c'],
        scores: ['not', 'numbers'],
      });
      expect(invalid.success).toBe(false);
    });

    it('should generate JSON Schema from ArkType', async () => {
      const schema = type({
        id: 'string',
        count: 'number',
        active: 'boolean',
      });

      const result = asSchema(schema);

      expect(result.jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          id: { type: 'string' },
          count: { type: 'number' },
          active: { type: 'boolean' },
        },
      });
    });
  });

  // ============================================================================
  // VALIBOT EXAMPLES
  // Note: Valibot v1.x implements StandardSchemaV1 but NOT StandardJSONSchemaV1
  // This means it can validate but cannot generate JSON Schema directly
  // ============================================================================
  describe('Valibot (validation only - no JSON Schema generation)', () => {
    it('should detect Valibot capabilities', () => {
      const schema = v.object({
        name: v.string(),
      });

      // Valibot implements StandardSchemaV1 (validation)
      expect(isStandardSchema(schema)).toBe(true);

      // But NOT StandardJSONSchemaV1 (no jsonSchema.input method)
      expect(isStandardJSONSchema(schema)).toBe(false);
    });

    it('should validate with Valibot schemas directly', async () => {
      const schema = v.object({
        name: v.pipe(v.string(), v.minLength(1)),
        email: v.pipe(v.string(), v.email()),
        age: v.optional(v.pipe(v.number(), v.integer())),
      });

      // Use Valibot's native validation via Standard Schema interface
      const std = schema['~standard'];

      // Valid data
      const valid = await std.validate({ name: 'John', email: 'john@example.com' });
      expect('value' in valid).toBe(true);

      // Invalid data
      const invalid = await std.validate({ name: '', email: 'not-an-email' });
      expect('issues' in invalid).toBe(true);
    });

    it('should work with Valibot enums', async () => {
      const statusSchema = v.object({
        status: v.picklist(['pending', 'approved', 'rejected']),
      });

      const std = statusSchema['~standard'];

      // Valid
      const valid = await std.validate({ status: 'pending' });
      expect('value' in valid).toBe(true);

      // Invalid
      const invalid = await std.validate({ status: 'invalid' });
      expect('issues' in invalid).toBe(true);
    });

    it('should work with nested Valibot schemas', async () => {
      const addressSchema = v.object({
        street: v.string(),
        city: v.string(),
      });

      const personSchema = v.object({
        name: v.string(),
        address: addressSchema,
        hobbies: v.array(v.string()),
      });

      const std = personSchema['~standard'];

      const valid = await std.validate({
        name: 'Alice',
        address: { street: '123 Main St', city: 'NYC' },
        hobbies: ['reading', 'coding'],
      });
      expect('value' in valid).toBe(true);
    });

    it('should work with Valibot transforms', async () => {
      const schema = v.pipe(
        v.object({
          date: v.string(),
        }),
        v.transform(input => ({
          ...input,
          parsed: true,
        })),
      );

      const std = schema['~standard'];

      const valid = await std.validate({ date: '2024-01-01' });
      expect('value' in valid).toBe(true);
      if ('value' in valid) {
        expect(valid.value).toEqual({ date: '2024-01-01', parsed: true });
      }
    });
  });

  // ============================================================================
  // CROSS-LIBRARY COMPARISON
  // ============================================================================
  describe('Cross-Library Comparison', () => {
    it('should handle equivalent schemas from Zod and ArkType', async () => {
      // Define the same schema in each library
      const zodSchema = z.object({
        id: z.string(),
        value: z.number(),
        active: z.boolean(),
      });

      const arktypeSchema = type({
        id: 'string',
        value: 'number',
        active: 'boolean',
      });

      // Convert both to AI SDK Schema via asSchema
      const zodResult = asSchema(zodSchema);
      const arktypeResult = asSchema(arktypeSchema);

      // Both should validate the same data
      const testData = { id: 'test-123', value: 42, active: true };

      const zodValid = await zodResult.validate!(testData);
      const arktypeValid = await arktypeResult.validate!(testData);

      expect(zodValid.success).toBe(true);
      expect(arktypeValid.success).toBe(true);

      // Both should reject invalid data
      const invalidData = { id: 123, value: 'not a number', active: 'yes' };

      const zodInvalid = await zodResult.validate!(invalidData);
      const arktypeInvalid = await arktypeResult.validate!(invalidData);

      expect(zodInvalid.success).toBe(false);
      expect(arktypeInvalid.success).toBe(false);
    });

    it('should handle optional fields consistently', async () => {
      const zodSchema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const arktypeSchema = type({
        required: 'string',
        optional: 'string?',
      });

      const zodResult = asSchema(zodSchema);
      const arktypeResult = asSchema(arktypeSchema);

      // Both should accept data with optional field missing
      const dataWithoutOptional = { required: 'hello' };

      const zodValid = await zodResult.validate!(dataWithoutOptional);
      const arktypeValid = await arktypeResult.validate!(dataWithoutOptional);

      expect(zodValid.success).toBe(true);
      expect(arktypeValid.success).toBe(true);
    });
  });

  // ============================================================================
  // REAL-WORLD TOOL EXAMPLES
  // ============================================================================
  describe('Real-World Tool Examples', () => {
    it('should work for a weather tool schema (Zod)', async () => {
      const weatherToolSchema = z.object({
        location: z.string().describe('City name or coordinates'),
        units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
        days: z.number().int().min(1).max(14).default(7).describe('Forecast days'),
      });

      const result = asSchema(weatherToolSchema);

      expect(result.jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name or coordinates' },
          units: { type: 'string', enum: ['celsius', 'fahrenheit'] },
          days: { type: 'integer', minimum: 1, maximum: 14, description: 'Forecast days' },
        },
      });

      // Validate tool input
      const valid = await result.validate!({ location: 'New York', units: 'fahrenheit', days: 7 });
      expect(valid.success).toBe(true);
    });

    it('should work for a database query tool schema (ArkType)', async () => {
      const queryToolSchema = type({
        table: "'users' | 'orders' | 'products'",
        select: 'string[]',
        where: {
          field: 'string',
          operator: "'=' | '!=' | '>' | '<' | '>=' | '<='",
          value: 'string | number',
        },
        limit: 'number?',
      });

      const result = asSchema(queryToolSchema);

      // JSON Schema is generated
      expect(result.jsonSchema).toBeDefined();
      expect(result.jsonSchema.type).toBe('object');

      // Validate tool input
      const valid = await result.validate!({
        table: 'users',
        select: ['id', 'name', 'email'],
        where: { field: 'age', operator: '>=', value: 18 },
        limit: 50,
      });
      expect(valid.success).toBe(true);
    });

    it('should work for a Valibot search schema (validation only)', async () => {
      const searchToolSchema = v.object({
        query: v.pipe(v.string(), v.minLength(1)),
        maxResults: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100))),
        filters: v.optional(
          v.object({
            dateFrom: v.optional(v.string()),
            dateTo: v.optional(v.string()),
            type: v.optional(v.picklist(['article', 'video', 'image'])),
          }),
        ),
      });

      // Use Valibot's native Standard Schema validation
      const std = searchToolSchema['~standard'];

      const valid = await std.validate({
        query: 'mastra ai',
        maxResults: 10,
        filters: { type: 'article' },
      });
      expect('value' in valid).toBe(true);
    });
  });
});
