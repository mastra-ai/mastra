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
 * with Mastra's tool system.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import * as v from 'valibot';
import { type } from 'arktype';
import {
  convertAnySchemaToAISDKSchema,
  convertStandardSchemaToAISDKSchema,
  isStandardSchema,
  isStandardJSONSchema,
} from './utils';

describe('Multi-Library Schema Support', () => {
  // ============================================================================
  // ZOD EXAMPLES
  // ============================================================================
  describe('Zod', () => {
    it('should work with basic Zod schemas', () => {
      const userSchema = z.object({
        name: z.string().min(1).describe('The user name'),
        email: z.string().email().describe('User email address'),
        age: z.number().int().positive().optional(),
      });

      const result = convertAnySchemaToAISDKSchema(userSchema);

      expect(result.jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, description: 'The user name' },
          email: { type: 'string', format: 'email', description: 'User email address' },
          age: { type: 'integer' },
        },
        required: ['name', 'email'],
      });
    });

    it('should work with Zod enums and unions', () => {
      const statusSchema = z.object({
        status: z.enum(['pending', 'approved', 'rejected']),
        priority: z.union([z.literal('low'), z.literal('medium'), z.literal('high')]),
      });

      const result = convertAnySchemaToAISDKSchema(statusSchema);

      expect(result.jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
        },
      });
    });

    it('should work with nested Zod schemas', () => {
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

      const result = convertAnySchemaToAISDKSchema(personSchema);

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

    it('should validate data with Zod schemas', () => {
      const schema = z.object({
        count: z.number().min(0).max(100),
      });

      const result = convertAnySchemaToAISDKSchema(schema);

      // Valid data
      expect(result.validate!({ count: 50 })).toEqual({
        success: true,
        value: { count: 50 },
      });

      // Invalid data
      const invalid = result.validate!({ count: 150 });
      expect(invalid.success).toBe(false);
    });
  });

  // ============================================================================
  // VALIBOT EXAMPLES
  // ============================================================================
  describe('Valibot', () => {
    it('should detect Valibot as Standard Schema', () => {
      const schema = v.object({
        name: v.string(),
      });

      expect(isStandardSchema(schema)).toBe(true);
    });

    it('should work with basic Valibot schemas', () => {
      const userSchema = v.object({
        name: v.pipe(v.string(), v.minLength(1)),
        email: v.pipe(v.string(), v.email()),
        age: v.optional(v.pipe(v.number(), v.integer())),
      });

      const result = convertStandardSchemaToAISDKSchema(userSchema);

      // Valibot implements StandardSchemaV1, so we get validation
      expect(result.validate).toBeDefined();

      // Valid data should pass
      const valid = result.validate!({ name: 'John', email: 'john@example.com' });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.value).toEqual({ name: 'John', email: 'john@example.com' });
      }
    });

    it('should validate with Valibot schemas', () => {
      const schema = v.object({
        count: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
      });

      const result = convertStandardSchemaToAISDKSchema(schema);

      // Valid data
      const valid = result.validate!({ count: 50 });
      expect(valid.success).toBe(true);

      // Invalid data
      const invalid = result.validate!({ count: 150 });
      expect(invalid.success).toBe(false);
    });

    it('should work with Valibot enums', () => {
      const statusSchema = v.object({
        status: v.picklist(['pending', 'approved', 'rejected']),
      });

      const result = convertStandardSchemaToAISDKSchema(statusSchema);

      // Valid
      expect(result.validate!({ status: 'pending' }).success).toBe(true);

      // Invalid
      expect(result.validate!({ status: 'invalid' }).success).toBe(false);
    });

    it('should work with nested Valibot schemas', () => {
      const addressSchema = v.object({
        street: v.string(),
        city: v.string(),
      });

      const personSchema = v.object({
        name: v.string(),
        address: addressSchema,
        hobbies: v.array(v.string()),
      });

      const result = convertStandardSchemaToAISDKSchema(personSchema);

      const valid = result.validate!({
        name: 'Alice',
        address: { street: '123 Main St', city: 'NYC' },
        hobbies: ['reading', 'coding'],
      });
      expect(valid.success).toBe(true);
    });

    it('should work with Valibot transforms', () => {
      const schema = v.pipe(
        v.object({
          date: v.string(),
        }),
        v.transform(input => ({
          ...input,
          parsed: true,
        })),
      );

      const result = convertStandardSchemaToAISDKSchema(schema);

      const valid = result.validate!({ date: '2024-01-01' });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.value).toEqual({ date: '2024-01-01', parsed: true });
      }
    });
  });

  // ============================================================================
  // ARKTYPE EXAMPLES
  // ============================================================================
  describe('ArkType', () => {
    it('should detect ArkType as Standard Schema', () => {
      const schema = type({
        name: 'string',
      });

      expect(isStandardSchema(schema)).toBe(true);
    });

    it('should work with basic ArkType schemas', () => {
      const userSchema = type({
        name: 'string',
        email: 'string',
        age: 'number?',
      });

      const result = convertStandardSchemaToAISDKSchema(userSchema);

      // ArkType implements StandardSchemaV1
      expect(result.validate).toBeDefined();

      // Valid data
      const valid = result.validate!({ name: 'John', email: 'john@example.com' });
      expect(valid.success).toBe(true);
    });

    it('should validate with ArkType schemas', () => {
      const schema = type({
        count: 'number',
      });

      const result = convertStandardSchemaToAISDKSchema(schema);

      // Valid
      expect(result.validate!({ count: 42 }).success).toBe(true);

      // Invalid
      expect(result.validate!({ count: 'not a number' }).success).toBe(false);
    });

    it('should work with ArkType unions', () => {
      const schema = type({
        status: "'pending' | 'approved' | 'rejected'",
      });

      const result = convertStandardSchemaToAISDKSchema(schema);

      expect(result.validate!({ status: 'pending' }).success).toBe(true);
      expect(result.validate!({ status: 'invalid' }).success).toBe(false);
    });

    it('should work with nested ArkType schemas', () => {
      const addressType = type({
        street: 'string',
        city: 'string',
      });

      const personType = type({
        name: 'string',
        address: addressType,
      });

      const result = convertStandardSchemaToAISDKSchema(personType);

      const valid = result.validate!({
        name: 'Bob',
        address: { street: '456 Oak Ave', city: 'LA' },
      });
      expect(valid.success).toBe(true);
    });

    it('should work with ArkType arrays', () => {
      const schema = type({
        tags: 'string[]',
        scores: 'number[]',
      });

      const result = convertStandardSchemaToAISDKSchema(schema);

      expect(
        result.validate!({
          tags: ['a', 'b', 'c'],
          scores: [1, 2, 3],
        }).success,
      ).toBe(true);

      expect(
        result.validate!({
          tags: ['a', 'b', 'c'],
          scores: ['not', 'numbers'],
        }).success,
      ).toBe(false);
    });

    it('should work with ArkType constraints', () => {
      const schema = type({
        age: 'number >= 0',
        name: 'string >= 1', // at least 1 character
      });

      const result = convertStandardSchemaToAISDKSchema(schema);

      expect(result.validate!({ age: 25, name: 'Alice' }).success).toBe(true);
      expect(result.validate!({ age: -1, name: 'Bob' }).success).toBe(false);
    });
  });

  // ============================================================================
  // CROSS-LIBRARY COMPARISON
  // ============================================================================
  describe('Cross-Library Comparison', () => {
    it('should handle equivalent schemas from all libraries', () => {
      // Define the same schema in each library
      const zodSchema = z.object({
        id: z.string(),
        value: z.number(),
        active: z.boolean(),
      });

      const valibotSchema = v.object({
        id: v.string(),
        value: v.number(),
        active: v.boolean(),
      });

      const arktypeSchema = type({
        id: 'string',
        value: 'number',
        active: 'boolean',
      });

      // Convert all to AI SDK Schema
      const zodResult = convertAnySchemaToAISDKSchema(zodSchema);
      const valibotResult = convertStandardSchemaToAISDKSchema(valibotSchema);
      const arktypeResult = convertStandardSchemaToAISDKSchema(arktypeSchema);

      // All should validate the same data
      const testData = { id: 'test-123', value: 42, active: true };

      expect(zodResult.validate!(testData).success).toBe(true);
      expect(valibotResult.validate!(testData).success).toBe(true);
      expect(arktypeResult.validate!(testData).success).toBe(true);

      // All should reject invalid data
      const invalidData = { id: 123, value: 'not a number', active: 'yes' };

      expect(zodResult.validate!(invalidData).success).toBe(false);
      expect(valibotResult.validate!(invalidData).success).toBe(false);
      expect(arktypeResult.validate!(invalidData).success).toBe(false);
    });

    it('should handle optional fields consistently', () => {
      const zodSchema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const valibotSchema = v.object({
        required: v.string(),
        optional: v.optional(v.string()),
      });

      const arktypeSchema = type({
        required: 'string',
        optional: 'string?',
      });

      // All should accept data with optional field missing
      const dataWithoutOptional = { required: 'hello' };

      expect(convertAnySchemaToAISDKSchema(zodSchema).validate!(dataWithoutOptional).success).toBe(true);
      expect(convertStandardSchemaToAISDKSchema(valibotSchema).validate!(dataWithoutOptional).success).toBe(true);
      expect(convertStandardSchemaToAISDKSchema(arktypeSchema).validate!(dataWithoutOptional).success).toBe(true);

      // All should accept data with optional field present
      const dataWithOptional = { required: 'hello', optional: 'world' };

      expect(convertAnySchemaToAISDKSchema(zodSchema).validate!(dataWithOptional).success).toBe(true);
      expect(convertStandardSchemaToAISDKSchema(valibotSchema).validate!(dataWithOptional).success).toBe(true);
      expect(convertStandardSchemaToAISDKSchema(arktypeSchema).validate!(dataWithOptional).success).toBe(true);
    });
  });

  // ============================================================================
  // REAL-WORLD TOOL EXAMPLES
  // ============================================================================
  describe('Real-World Tool Examples', () => {
    it('should work for a weather tool schema (Zod)', () => {
      const weatherToolSchema = z.object({
        location: z.string().describe('City name or coordinates'),
        units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
        days: z.number().int().min(1).max(14).default(7).describe('Forecast days'),
      });

      const result = convertAnySchemaToAISDKSchema(weatherToolSchema);

      expect(result.jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name or coordinates' },
          units: { type: 'string', enum: ['celsius', 'fahrenheit'] },
          days: { type: 'integer', minimum: 1, maximum: 14, description: 'Forecast days' },
        },
      });
    });

    it('should work for a search tool schema (Valibot)', () => {
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

      const result = convertStandardSchemaToAISDKSchema(searchToolSchema);

      // Should validate correctly
      expect(
        result.validate!({
          query: 'mastra ai',
          maxResults: 10,
          filters: { type: 'article' },
        }).success,
      ).toBe(true);
    });

    it('should work for a database query tool schema (ArkType)', () => {
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

      const result = convertStandardSchemaToAISDKSchema(queryToolSchema);

      expect(
        result.validate!({
          table: 'users',
          select: ['id', 'name', 'email'],
          where: { field: 'age', operator: '>=', value: 18 },
          limit: 50,
        }).success,
      ).toBe(true);
    });
  });
});
