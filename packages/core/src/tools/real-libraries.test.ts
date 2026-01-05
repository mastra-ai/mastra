/**
 * Tool integration tests using REAL schema libraries.
 *
 * These tests prove that tool validation works with actual validation libraries
 * that users would use in production.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { type } from 'arktype';
import * as v from 'valibot';

import { validateToolInput, validateToolOutput, validateToolSuspendData } from './validation';

// Helper to call validateToolInput with named parameters for clarity
function validateInput(params: { schema: any; name: string; input: any }) {
  return validateToolInput(params.schema, params.input, params.name);
}

// Helper to call validateToolOutput with named parameters for clarity
function validateOutput(params: { schema: any; name: string; output: any }) {
  return validateToolOutput(params.schema, params.output, params.name);
}

// Helper to call validateToolSuspendData with named parameters for clarity
function validateSuspend(params: { schema: any; name: string; suspendData: any }) {
  return validateToolSuspendData(params.schema, params.suspendData, params.name);
}

describe('Tool Validation with Real Libraries', () => {
  describe('Zod', () => {
    describe('Input Validation', () => {
      it('should validate tool input with Zod', () => {
        const schema = z.object({
          query: z.string().min(1),
          maxResults: z.number().int().positive().default(10),
        });

        const result = validateInput({
          schema,
          name: 'searchTool',
          input: { query: 'hello world' },
        });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ query: 'hello world', maxResults: 10 });
      });

      it('should return error for invalid Zod input', () => {
        const schema = z.object({
          query: z.string().min(1),
        });

        const result = validateInput({
          schema,
          name: 'searchTool',
          input: { query: '' },
        });

        expect(result.error).toBeDefined();
        expect(result.error?.message).toBeDefined();
      });

      it('should apply Zod transforms', () => {
        const schema = z.object({
          email: z.string().email().transform(e => e.toLowerCase()),
        });

        const result = validateInput({
          schema,
          name: 'emailTool',
          input: { email: 'JOHN@EXAMPLE.COM' },
        });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ email: 'john@example.com' });
      });
    });

    describe('Output Validation', () => {
      it('should validate tool output with Zod', () => {
        const schema = z.object({
          results: z.array(z.string()),
          count: z.number(),
        });

        const result = validateOutput({
          schema,
          name: 'searchTool',
          output: { results: ['a', 'b', 'c'], count: 3 },
        });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ results: ['a', 'b', 'c'], count: 3 });
      });

      it('should return error for invalid Zod output', () => {
        const schema = z.object({
          success: z.boolean(),
        });

        const result = validateOutput({
          schema,
          name: 'actionTool',
          output: { success: 'yes' }, // Should be boolean
        });

        expect(result.error).toBeDefined();
      });
    });

    describe('Suspend Data Validation', () => {
      it('should validate suspend data with Zod', () => {
        const schema = z.object({
          waitingFor: z.string(),
          timeout: z.number().optional(),
        });

        const result = validateSuspend({
          schema,
          name: 'awaitTool',
          suspendData: { waitingFor: 'user_approval' },
        });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ waitingFor: 'user_approval' });
      });
    });
  });

  describe('ArkType', () => {
    describe('Input Validation', () => {
      it('should validate tool input with ArkType', () => {
        const schema = type({
          productId: 'string',
          quantity: 'number > 0',
        });

        const result = validateInput({
          schema: schema as any,
          name: 'orderTool',
          input: { productId: 'SKU-123', quantity: 5 },
        });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ productId: 'SKU-123', quantity: 5 });
      });

      it('should return error for invalid ArkType input', () => {
        const schema = type({
          id: 'number',
        });

        const result = validateInput({
          schema: schema as any,
          name: 'idTool',
          input: { id: 'not-a-number' },
        });

        expect(result.error).toBeDefined();
      });

      it('should handle ArkType unions', () => {
        const schema = type({
          value: 'string | number',
        });

        const stringResult = validateInput({
          schema: schema as any,
          name: 'valueTool',
          input: { value: 'hello' },
        });
        expect(stringResult.error).toBeUndefined();

        const numberResult = validateInput({
          schema: schema as any,
          name: 'valueTool',
          input: { value: 42 },
        });
        expect(numberResult.error).toBeUndefined();
      });
    });

    describe('Output Validation', () => {
      it('should validate tool output with ArkType', () => {
        const schema = type({
          status: "'success' | 'error'",
          data: 'string',
        });

        const result = validateOutput({
          schema: schema as any,
          name: 'apiTool',
          output: { status: 'success', data: 'done' },
        });

        expect(result.error).toBeUndefined();
      });
    });
  });

  describe('Valibot', () => {
    describe('Input Validation', () => {
      it('should validate tool input with Valibot', () => {
        const schema = v.object({
          username: v.pipe(v.string(), v.minLength(3)),
          role: v.picklist(['admin', 'user', 'guest']),
        });

        const result = validateInput({
          schema: schema as any,
          name: 'userTool',
          input: { username: 'john', role: 'admin' },
        });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ username: 'john', role: 'admin' });
      });

      it('should return error for invalid Valibot input', () => {
        const schema = v.object({
          email: v.pipe(v.string(), v.email()),
        });

        const result = validateInput({
          schema: schema as any,
          name: 'emailTool',
          input: { email: 'not-an-email' },
        });

        expect(result.error).toBeDefined();
      });

      it('should handle Valibot optional fields', () => {
        const schema = v.object({
          required: v.string(),
          optional: v.optional(v.number()),
        });

        const result = validateInput({
          schema: schema as any,
          name: 'optionalTool',
          input: { required: 'value' },
        });

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ required: 'value' });
      });
    });

    describe('Output Validation', () => {
      it('should validate tool output with Valibot', () => {
        const schema = v.object({
          items: v.array(v.string()),
          total: v.number(),
        });

        const result = validateOutput({
          schema: schema as any,
          name: 'listTool',
          output: { items: ['a', 'b'], total: 2 },
        });

        expect(result.error).toBeUndefined();
      });
    });

    describe('Suspend Data Validation', () => {
      it('should validate suspend data with Valibot', () => {
        const schema = v.object({
          reason: v.string(),
          resumeAt: v.optional(v.number()),
        });

        const result = validateSuspend({
          schema: schema as any,
          name: 'pauseTool',
          suspendData: { reason: 'waiting for input' },
        });

        expect(result.error).toBeUndefined();
      });
    });
  });

  describe('Cross-Library Compatibility', () => {
    it('should validate the same input with all three libraries', () => {
      const testInput = {
        name: 'Test',
        count: 42,
        active: true,
      };

      // Zod
      const zodSchema = z.object({
        name: z.string(),
        count: z.number(),
        active: z.boolean(),
      });

      // ArkType
      const arkSchema = type({
        name: 'string',
        count: 'number',
        active: 'boolean',
      });

      // Valibot
      const valibotSchema = v.object({
        name: v.string(),
        count: v.number(),
        active: v.boolean(),
      });

      const zodResult = validateInput({
        schema: zodSchema,
        name: 'testTool',
        input: testInput,
      });

      const arkResult = validateInput({
        schema: arkSchema as any,
        name: 'testTool',
        input: testInput,
      });

      const valibotResult = validateInput({
        schema: valibotSchema as any,
        name: 'testTool',
        input: testInput,
      });

      // All should succeed
      expect(zodResult.error).toBeUndefined();
      expect(arkResult.error).toBeUndefined();
      expect(valibotResult.error).toBeUndefined();

      // All should return the same data
      expect(zodResult.data).toEqual(testInput);
      expect(arkResult.data).toEqual(testInput);
      expect(valibotResult.data).toEqual(testInput);
    });

    it('should reject invalid data with all three libraries', () => {
      const invalidInput = {
        name: 123, // Should be string
        count: 'not-a-number', // Should be number
      };

      // Zod - test directly first
      const zodSchema = z.object({
        name: z.string(),
        count: z.number(),
      });

      // Verify Zod rejects this directly
      const directZodResult = zodSchema.safeParse(invalidInput);
      expect(directZodResult.success).toBe(false);

      // ArkType
      const arkSchema = type({
        name: 'string',
        count: 'number',
      });

      // Valibot
      const valibotSchema = v.object({
        name: v.string(),
        count: v.number(),
      });

      const zodResult = validateInput({
        schema: zodSchema,
        name: 'testTool',
        input: invalidInput,
      });

      const arkResult = validateInput({
        schema: arkSchema as any,
        name: 'testTool',
        input: invalidInput,
      });

      const valibotResult = validateInput({
        schema: valibotSchema as any,
        name: 'testTool',
        input: invalidInput,
      });

      // All should fail
      expect(zodResult.error).toBeDefined();
      expect(arkResult.error).toBeDefined();
      expect(valibotResult.error).toBeDefined();
    });
  });
});
