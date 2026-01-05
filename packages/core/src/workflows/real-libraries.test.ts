/**
 * Workflow integration tests using REAL schema libraries.
 *
 * These tests prove that workflows work with actual validation libraries
 * that users would use in production.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { type } from 'arktype';
import * as v from 'valibot';

import {
  validateStepInput,
  validateStepResumeData,
  validateStepSuspendData,
  validateStepStateData,
} from './utils';
import type { Step } from './step';

describe('Workflow Validation with Real Libraries', () => {
  describe('Zod', () => {
    it('should validate step input with Zod', async () => {
      const zodSchema = z.object({
        query: z.string().min(1),
        limit: z.number().int().positive(),
      });

      const mockStep = {
        inputSchema: zodSchema,
      } as Step<string, any, any>;

      const validResult = await validateStepInput({
        prevOutput: { query: 'search term', limit: 10 },
        step: mockStep,
        validateInputs: true,
      });

      expect(validResult.validationError).toBeUndefined();
      expect(validResult.inputData).toEqual({ query: 'search term', limit: 10 });

      const invalidResult = await validateStepInput({
        prevOutput: { query: '', limit: -5 },
        step: mockStep,
        validateInputs: true,
      });

      expect(invalidResult.validationError).toBeDefined();
    });

    it('should apply Zod transforms in workflow', async () => {
      const zodSchema = z.object({
        email: z.string().email().transform(e => e.toLowerCase()),
      });

      const mockStep = {
        inputSchema: zodSchema,
      } as Step<string, any, any>;

      const result = await validateStepInput({
        prevOutput: { email: 'JOHN@EXAMPLE.COM' },
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.inputData).toEqual({ email: 'john@example.com' });
    });

    it('should apply Zod defaults in workflow', async () => {
      const zodSchema = z.object({
        name: z.string(),
        pageSize: z.number().default(20),
      });

      const mockStep = {
        inputSchema: zodSchema,
      } as Step<string, any, any>;

      const result = await validateStepInput({
        prevOutput: { name: 'test' },
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.inputData).toEqual({ name: 'test', pageSize: 20 });
    });

    it('should validate resume data with Zod', async () => {
      const zodSchema = z.object({
        approved: z.boolean(),
        comment: z.string().optional(),
      });

      const mockStep = {
        resumeSchema: zodSchema,
      } as Step<string, any, any>;

      const result = await validateStepResumeData({
        resumeData: { approved: true, comment: 'Looks good' },
        step: mockStep,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.resumeData).toEqual({ approved: true, comment: 'Looks good' });
    });

    it('should validate suspend data with Zod', async () => {
      const zodSchema = z.object({
        reason: z.string(),
        waitingFor: z.array(z.string()),
      });

      const mockStep = {
        suspendSchema: zodSchema,
      } as Step<string, any, any>;

      const result = await validateStepSuspendData({
        suspendData: { reason: 'Waiting for approval', waitingFor: ['manager', 'admin'] },
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.suspendData).toEqual({ reason: 'Waiting for approval', waitingFor: ['manager', 'admin'] });
    });
  });

  describe('ArkType', () => {
    it('should validate step input with ArkType', async () => {
      const arkSchema = type({
        productId: 'string',
        quantity: 'number',
      });

      const mockStep = {
        inputSchema: arkSchema as any,
      } as Step<string, any, any>;

      const validResult = await validateStepInput({
        prevOutput: { productId: 'SKU-123', quantity: 5 },
        step: mockStep,
        validateInputs: true,
      });

      expect(validResult.validationError).toBeUndefined();
      expect(validResult.inputData).toEqual({ productId: 'SKU-123', quantity: 5 });

      const invalidResult = await validateStepInput({
        prevOutput: { productId: 123, quantity: 'five' },
        step: mockStep,
        validateInputs: true,
      });

      expect(invalidResult.validationError).toBeDefined();
    });

    it('should validate resume data with ArkType', async () => {
      const arkSchema = type({
        decision: "'approve' | 'reject'",
        notes: 'string',
      });

      const mockStep = {
        resumeSchema: arkSchema as any,
      } as Step<string, any, any>;

      const result = await validateStepResumeData({
        resumeData: { decision: 'approve', notes: 'All checks passed' },
        step: mockStep,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.resumeData).toEqual({ decision: 'approve', notes: 'All checks passed' });
    });

    it('should handle nested ArkType schemas', async () => {
      const itemType = type({
        name: 'string',
        price: 'number',
      });

      const arkSchema = type({
        order: {
          id: 'string',
          items: itemType.array(),
        },
      });

      const mockStep = {
        inputSchema: arkSchema as any,
      } as Step<string, any, any>;

      const result = await validateStepInput({
        prevOutput: {
          order: {
            id: 'ORD-001',
            items: [
              { name: 'Widget', price: 9.99 },
              { name: 'Gadget', price: 19.99 },
            ],
          },
        },
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeUndefined();
    });
  });

  describe('Valibot', () => {
    it('should validate step input with Valibot', async () => {
      const valibotSchema = v.object({
        userId: v.string(),
        action: v.picklist(['create', 'update', 'delete']),
      });

      const mockStep = {
        inputSchema: valibotSchema as any,
      } as Step<string, any, any>;

      const validResult = await validateStepInput({
        prevOutput: { userId: 'user-123', action: 'create' },
        step: mockStep,
        validateInputs: true,
      });

      expect(validResult.validationError).toBeUndefined();
      expect(validResult.inputData).toEqual({ userId: 'user-123', action: 'create' });

      const invalidResult = await validateStepInput({
        prevOutput: { userId: 'user-123', action: 'invalid-action' },
        step: mockStep,
        validateInputs: true,
      });

      expect(invalidResult.validationError).toBeDefined();
    });

    it('should validate with Valibot pipe constraints', async () => {
      const valibotSchema = v.object({
        email: v.pipe(v.string(), v.email()),
        age: v.pipe(v.number(), v.minValue(18), v.maxValue(100)),
      });

      const mockStep = {
        inputSchema: valibotSchema as any,
      } as Step<string, any, any>;

      const validResult = await validateStepInput({
        prevOutput: { email: 'test@example.com', age: 25 },
        step: mockStep,
        validateInputs: true,
      });

      expect(validResult.validationError).toBeUndefined();

      const invalidResult = await validateStepInput({
        prevOutput: { email: 'not-an-email', age: 15 },
        step: mockStep,
        validateInputs: true,
      });

      expect(invalidResult.validationError).toBeDefined();
    });

    it('should validate resume data with Valibot', async () => {
      const valibotSchema = v.object({
        confirmed: v.boolean(),
        timestamp: v.number(),
      });

      const mockStep = {
        resumeSchema: valibotSchema as any,
      } as Step<string, any, any>;

      const result = await validateStepResumeData({
        resumeData: { confirmed: true, timestamp: Date.now() },
        step: mockStep,
      });

      expect(result.validationError).toBeUndefined();
    });

    it('should validate state data with Valibot', async () => {
      const valibotSchema = v.object({
        progress: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
        status: v.string(),
      });

      const mockStep = {
        stateSchema: valibotSchema as any,
      } as Step<string, any, any>;

      const result = await validateStepStateData({
        stateData: { progress: 50, status: 'processing' },
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.stateData).toEqual({ progress: 50, status: 'processing' });
    });
  });

  describe('Mixed Library Scenarios', () => {
    it('should handle different libraries for different validation steps', async () => {
      // Simulate a workflow where different steps use different libraries

      // Step 1: Zod for input
      const zodInputSchema = z.object({
        orderId: z.string().uuid(),
      });

      // Step 2: ArkType for processing
      const arkProcessSchema = type({
        orderId: 'string',
        status: "'pending' | 'processing' | 'complete'",
      });

      // Step 3: Valibot for resume
      const valibotResumeSchema = v.object({
        approved: v.boolean(),
      });

      const step1 = { inputSchema: zodInputSchema } as Step<string, any, any>;
      const step2 = { inputSchema: arkProcessSchema as any } as Step<string, any, any>;
      const step3 = { resumeSchema: valibotResumeSchema as any } as Step<string, any, any>;

      // All validations should work
      const result1 = await validateStepInput({
        prevOutput: { orderId: '550e8400-e29b-41d4-a716-446655440000' },
        step: step1,
        validateInputs: true,
      });
      expect(result1.validationError).toBeUndefined();

      const result2 = await validateStepInput({
        prevOutput: { orderId: 'ORD-001', status: 'processing' },
        step: step2,
        validateInputs: true,
      });
      expect(result2.validationError).toBeUndefined();

      const result3 = await validateStepResumeData({
        resumeData: { approved: true },
        step: step3,
      });
      expect(result3.validationError).toBeUndefined();
    });
  });
});
