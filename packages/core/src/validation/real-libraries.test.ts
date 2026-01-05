/**
 * Integration tests using REAL schema libraries (not mocks).
 *
 * These tests prove that Standard Schema support works with actual
 * validation libraries that users would use in production.
 *
 * Libraries tested:
 * - Zod (v3.25+) - Primary, native support
 * - ArkType - Implements StandardSchemaV1 and StandardJSONSchemaV1
 * - Valibot - Implements StandardSchemaV1 (validation only, no JSON Schema)
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { type } from 'arktype';
import * as v from 'valibot';

import { validateSync, validateAsync } from './index';
import { isStandardSchema, isStandardJSONSchema } from '../types/standard-schema';

describe('Real Library Integration Tests', () => {
  describe('Zod', () => {
    describe('Type Detection', () => {
      it('should detect Zod schemas as Standard Schema', () => {
        const schema = z.object({ name: z.string() });

        expect(isStandardSchema(schema)).toBe(true);
        // Note: Zod v4 implements StandardSchemaV1 but may not implement StandardJSONSchemaV1
        // JSON Schema generation is still available via zodToJsonSchema utility
      });
    });

    describe('Sync Validation', () => {
      it('should validate simple object', () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        });

        const result = validateSync(schema, { name: 'John', age: 30 });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ name: 'John', age: 30 });
        }
      });

      it('should reject invalid data', () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        });

        const result = validateSync(schema, { name: 123, age: 'not-a-number' });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.issues.length).toBeGreaterThan(0);
        }
      });

      it('should apply transforms', () => {
        const schema = z.object({
          name: z.string().transform(s => s.toUpperCase()),
        });

        const result = validateSync(schema, { name: 'john' });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ name: 'JOHN' });
        }
      });

      it('should apply defaults', () => {
        const schema = z.object({
          name: z.string(),
          role: z.string().default('user'),
        });

        const result = validateSync(schema, { name: 'john' });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ name: 'john', role: 'user' });
        }
      });

      it('should preserve ZodError as cause', () => {
        const schema = z.object({ name: z.string() });

        const result = validateSync(schema, { name: 123 });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.cause).toBeDefined();
          expect((result.cause as any).issues).toBeDefined();
        }
      });
    });

    describe('Async Validation', () => {
      it('should validate with async refinements', async () => {
        const schema = z.object({
          username: z.string().refine(
            async name => {
              // Simulate async check
              await new Promise(r => setTimeout(r, 1));
              return name.length >= 3;
            },
            { message: 'Username too short' },
          ),
        });

        const successResult = await validateAsync(schema, { username: 'john' });
        expect(successResult.success).toBe(true);

        const failResult = await validateAsync(schema, { username: 'ab' });
        expect(failResult.success).toBe(false);
      });
    });

    describe('Complex Schemas', () => {
      it('should handle nested objects', () => {
        const schema = z.object({
          user: z.object({
            profile: z.object({
              name: z.string(),
              email: z.string().email(),
            }),
          }),
        });

        const result = validateSync(schema, {
          user: { profile: { name: 'John', email: 'john@example.com' } },
        });

        expect(result.success).toBe(true);
      });

      it('should handle arrays', () => {
        const schema = z.object({
          tags: z.array(z.string()),
        });

        const result = validateSync(schema, { tags: ['a', 'b', 'c'] });

        expect(result.success).toBe(true);
      });

      it('should handle unions', () => {
        const schema = z.union([z.string(), z.number()]);

        expect(validateSync(schema, 'hello').success).toBe(true);
        expect(validateSync(schema, 42).success).toBe(true);
        expect(validateSync(schema, true).success).toBe(false);
      });

      it('should handle optional fields', () => {
        const schema = z.object({
          required: z.string(),
          optional: z.string().optional(),
        });

        const result = validateSync(schema, { required: 'value' });

        expect(result.success).toBe(true);
      });
    });
  });

  describe('ArkType', () => {
    describe('Type Detection', () => {
      it('should detect ArkType schemas as Standard Schema', () => {
        const schema = type({ name: 'string' });

        expect(isStandardSchema(schema)).toBe(true);
        expect(isStandardJSONSchema(schema)).toBe(true);
      });

      it('should detect ArkType function-based schemas correctly', () => {
        // ArkType schemas are functions, which is unusual
        const schema = type({ id: 'number' });

        expect(typeof schema).toBe('function');
        expect(isStandardSchema(schema)).toBe(true);
      });
    });

    describe('Sync Validation', () => {
      it('should validate simple object', () => {
        const schema = type({
          name: 'string',
          age: 'number',
        });

        const result = validateSync(schema as any, { name: 'John', age: 30 });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ name: 'John', age: 30 });
        }
      });

      it('should reject invalid data', () => {
        const schema = type({
          name: 'string',
          age: 'number',
        });

        const result = validateSync(schema as any, { name: 123, age: 'not-a-number' });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.issues.length).toBeGreaterThan(0);
        }
      });

      it('should validate primitive types', () => {
        const stringSchema = type('string');
        const numberSchema = type('number');
        const booleanSchema = type('boolean');

        expect(validateSync(stringSchema as any, 'hello').success).toBe(true);
        expect(validateSync(numberSchema as any, 42).success).toBe(true);
        expect(validateSync(booleanSchema as any, true).success).toBe(true);

        expect(validateSync(stringSchema as any, 123).success).toBe(false);
      });
    });

    describe('Async Validation', () => {
      it('should validate asynchronously', async () => {
        const schema = type({
          email: 'string',
        });

        const result = await validateAsync(schema as any, { email: 'test@example.com' });

        expect(result.success).toBe(true);
      });
    });

    describe('Complex Schemas', () => {
      it('should handle nested objects', () => {
        const schema = type({
          user: {
            name: 'string',
            age: 'number',
          },
        });

        const result = validateSync(schema as any, {
          user: { name: 'John', age: 30 },
        });

        expect(result.success).toBe(true);
      });

      it('should handle arrays', () => {
        const schema = type({
          items: 'string[]',
        });

        const result = validateSync(schema as any, { items: ['a', 'b', 'c'] });

        expect(result.success).toBe(true);
      });

      it('should handle optional properties', () => {
        const schema = type({
          required: 'string',
          'optional?': 'string',
        });

        const result = validateSync(schema as any, { required: 'value' });

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Valibot', () => {
    describe('Type Detection', () => {
      it('should detect Valibot schemas as Standard Schema', () => {
        const schema = v.object({ name: v.string() });

        expect(isStandardSchema(schema)).toBe(true);
      });

      it('should NOT detect Valibot as Standard JSON Schema (Valibot v1.x does not implement it)', () => {
        const schema = v.object({ name: v.string() });

        // Valibot implements StandardSchemaV1 but NOT StandardJSONSchemaV1
        expect(isStandardJSONSchema(schema)).toBe(false);
      });
    });

    describe('Sync Validation', () => {
      it('should validate simple object', () => {
        const schema = v.object({
          name: v.string(),
          age: v.number(),
        });

        const result = validateSync(schema as any, { name: 'John', age: 30 });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ name: 'John', age: 30 });
        }
      });

      it('should reject invalid data', () => {
        const schema = v.object({
          name: v.string(),
          age: v.number(),
        });

        const result = validateSync(schema as any, { name: 123, age: 'not-a-number' });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.issues.length).toBeGreaterThan(0);
        }
      });

      it('should validate with pipe constraints', () => {
        const schema = v.object({
          email: v.pipe(v.string(), v.email()),
          age: v.pipe(v.number(), v.minValue(0), v.maxValue(120)),
        });

        const validResult = validateSync(schema as any, { email: 'test@example.com', age: 25 });
        expect(validResult.success).toBe(true);

        const invalidResult = validateSync(schema as any, { email: 'not-an-email', age: 25 });
        expect(invalidResult.success).toBe(false);
      });
    });

    describe('Async Validation', () => {
      it('should validate asynchronously', async () => {
        const schema = v.object({
          username: v.string(),
        });

        const result = await validateAsync(schema as any, { username: 'john' });

        expect(result.success).toBe(true);
      });
    });

    describe('Complex Schemas', () => {
      it('should handle nested objects', () => {
        const schema = v.object({
          user: v.object({
            name: v.string(),
            settings: v.object({
              theme: v.string(),
            }),
          }),
        });

        const result = validateSync(schema as any, {
          user: { name: 'John', settings: { theme: 'dark' } },
        });

        expect(result.success).toBe(true);
      });

      it('should handle arrays', () => {
        const schema = v.object({
          tags: v.array(v.string()),
        });

        const result = validateSync(schema as any, { tags: ['a', 'b', 'c'] });

        expect(result.success).toBe(true);
      });

      it('should handle optional fields', () => {
        const schema = v.object({
          required: v.string(),
          optional: v.optional(v.string()),
        });

        const result = validateSync(schema as any, { required: 'value' });

        expect(result.success).toBe(true);
      });

      it('should handle unions', () => {
        const schema = v.union([v.string(), v.number()]);

        expect(validateSync(schema as any, 'hello').success).toBe(true);
        expect(validateSync(schema as any, 42).success).toBe(true);
        expect(validateSync(schema as any, true).success).toBe(false);
      });
    });
  });

  describe('Cross-Library Compatibility', () => {
    it('should validate the same data structure with all libraries', () => {
      const testData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      };

      // Zod
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string(),
      });

      // ArkType
      const arkSchema = type({
        name: 'string',
        age: 'number',
        email: 'string',
      });

      // Valibot
      const valibotSchema = v.object({
        name: v.string(),
        age: v.number(),
        email: v.string(),
      });

      // All should validate successfully
      expect(validateSync(zodSchema, testData).success).toBe(true);
      expect(validateSync(arkSchema as any, testData).success).toBe(true);
      expect(validateSync(valibotSchema as any, testData).success).toBe(true);
    });

    it('should reject invalid data with all libraries', () => {
      const invalidData = {
        name: 123, // Should be string
        age: 'thirty', // Should be number
      };

      // Zod
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      // ArkType
      const arkSchema = type({
        name: 'string',
        age: 'number',
      });

      // Valibot
      const valibotSchema = v.object({
        name: v.string(),
        age: v.number(),
      });

      // All should reject
      expect(validateSync(zodSchema, invalidData).success).toBe(false);
      expect(validateSync(arkSchema as any, invalidData).success).toBe(false);
      expect(validateSync(valibotSchema as any, invalidData).success).toBe(false);
    });
  });
});
