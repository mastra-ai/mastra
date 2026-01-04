import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createWorkflow, createStep } from './index';
import type { StandardSchemaV1 } from '../types/standard-schema';
import {
  validateStepInput,
  validateStepResumeData,
  validateStepSuspendData,
  validateStepStateData,
} from './utils';
import type { Step } from './step';

/**
 * Creates a mock Standard Schema for testing.
 */
function createMockStandardSchema<T>(
  validateFn: (data: unknown) => { value?: T; issues?: StandardSchemaV1.Issue[] },
): StandardSchemaV1<T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: validateFn,
    },
  };
}

/**
 * Creates an async mock Standard Schema for testing.
 */
function createAsyncMockStandardSchema<T>(
  validateFn: (data: unknown) => Promise<{ value?: T; issues?: StandardSchemaV1.Issue[] }>,
): StandardSchemaV1<T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: validateFn,
    },
  };
}

describe('Workflows with Standard Schema', () => {
  describe('validateStepInput', () => {
    it('should validate with Zod schema', async () => {
      const zodSchema = z.object({ name: z.string() });

      const mockStep = {
        inputSchema: zodSchema,
      } as Step<string, any, any>;

      const result = await validateStepInput({
        prevOutput: { name: 'John' },
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.inputData).toEqual({ name: 'John' });
    });

    it('should return error for invalid Zod data', async () => {
      const zodSchema = z.object({ name: z.string() });

      const mockStep = {
        inputSchema: zodSchema,
      } as Step<string, any, any>;

      const result = await validateStepInput({
        prevOutput: { name: 123 }, // Invalid - should be string
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeDefined();
      expect(result.validationError?.message).toContain('Step input validation failed');
    });

    it('should validate with Standard Schema', async () => {
      const standardSchema = createMockStandardSchema<{ id: number }>((data: any) => {
        if (data && typeof data.id === 'number') {
          return { value: data };
        }
        return { issues: [{ message: 'ID must be a number', path: ['id'] }] };
      });

      const mockStep = {
        inputSchema: standardSchema as any,
      } as Step<string, any, any>;

      const result = await validateStepInput({
        prevOutput: { id: 123 },
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.inputData).toEqual({ id: 123 });
    });

    it('should return error for invalid Standard Schema data', async () => {
      const standardSchema = createMockStandardSchema<{ id: number }>((data: any) => {
        if (data && typeof data.id === 'number') {
          return { value: data };
        }
        return { issues: [{ message: 'ID must be a number', path: ['id'] }] };
      });

      const mockStep = {
        inputSchema: standardSchema as any,
      } as Step<string, any, any>;

      const result = await validateStepInput({
        prevOutput: { id: 'not-a-number' },
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeDefined();
      expect(result.validationError?.message).toContain('Step input validation failed');
    });

    it('should handle async Standard Schema validation', async () => {
      const asyncSchema = createAsyncMockStandardSchema<{ email: string }>(async (data: any) => {
        await new Promise(r => setTimeout(r, 1));
        if (data && typeof data.email === 'string' && data.email.includes('@')) {
          return { value: data };
        }
        return { issues: [{ message: 'Invalid email', path: ['email'] }] };
      });

      const mockStep = {
        inputSchema: asyncSchema as any,
      } as Step<string, any, any>;

      const successResult = await validateStepInput({
        prevOutput: { email: 'test@example.com' },
        step: mockStep,
        validateInputs: true,
      });

      expect(successResult.validationError).toBeUndefined();
      expect(successResult.inputData).toEqual({ email: 'test@example.com' });

      const failResult = await validateStepInput({
        prevOutput: { email: 'invalid' },
        step: mockStep,
        validateInputs: true,
      });

      expect(failResult.validationError).toBeDefined();
    });

    it('should skip validation when validateInputs is false', async () => {
      const zodSchema = z.object({ name: z.string() });

      const mockStep = {
        inputSchema: zodSchema,
      } as Step<string, any, any>;

      const result = await validateStepInput({
        prevOutput: { name: 123 }, // Invalid but should be ignored
        step: mockStep,
        validateInputs: false,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.inputData).toEqual({ name: 123 });
    });
  });

  describe('validateStepResumeData', () => {
    it('should validate resume data with Zod', async () => {
      const zodSchema = z.object({ approved: z.boolean() });

      const mockStep = {
        resumeSchema: zodSchema,
      } as Step<string, any, any>;

      const result = await validateStepResumeData({
        resumeData: { approved: true },
        step: mockStep,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.resumeData).toEqual({ approved: true });
    });

    it('should validate resume data with Standard Schema', async () => {
      const standardSchema = createMockStandardSchema<{ approved: boolean }>((data: any) => {
        if (data && typeof data.approved === 'boolean') {
          return { value: data };
        }
        return { issues: [{ message: 'Approved must be a boolean' }] };
      });

      const mockStep = {
        resumeSchema: standardSchema as any,
      } as Step<string, any, any>;

      const result = await validateStepResumeData({
        resumeData: { approved: true },
        step: mockStep,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.resumeData).toEqual({ approved: true });
    });

    it('should return error for invalid resume data', async () => {
      const standardSchema = createMockStandardSchema<{ approved: boolean }>((data: any) => {
        if (data && typeof data.approved === 'boolean') {
          return { value: data };
        }
        return { issues: [{ message: 'Approved must be a boolean' }] };
      });

      const mockStep = {
        resumeSchema: standardSchema as any,
      } as Step<string, any, any>;

      const result = await validateStepResumeData({
        resumeData: { approved: 'yes' }, // Invalid
        step: mockStep,
      });

      expect(result.validationError).toBeDefined();
      expect(result.validationError?.message).toContain('Step resume data validation failed');
    });
  });

  describe('validateStepSuspendData', () => {
    it('should validate suspend data with Zod', async () => {
      const zodSchema = z.object({ reason: z.string() });

      const mockStep = {
        suspendSchema: zodSchema,
      } as Step<string, any, any>;

      const result = await validateStepSuspendData({
        suspendData: { reason: 'waiting for approval' },
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.suspendData).toEqual({ reason: 'waiting for approval' });
    });

    it('should validate suspend data with Standard Schema', async () => {
      const standardSchema = createMockStandardSchema<{ reason: string }>((data: any) => {
        if (data && typeof data.reason === 'string') {
          return { value: data };
        }
        return { issues: [{ message: 'Reason must be a string' }] };
      });

      const mockStep = {
        suspendSchema: standardSchema as any,
      } as Step<string, any, any>;

      const result = await validateStepSuspendData({
        suspendData: { reason: 'waiting' },
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.suspendData).toEqual({ reason: 'waiting' });
    });
  });

  describe('validateStepStateData', () => {
    it('should validate state data with Zod', async () => {
      const zodSchema = z.object({ count: z.number() });

      const mockStep = {
        stateSchema: zodSchema,
      } as Step<string, any, any>;

      const result = await validateStepStateData({
        stateData: { count: 5 },
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.stateData).toEqual({ count: 5 });
    });

    it('should validate state data with Standard Schema', async () => {
      const standardSchema = createMockStandardSchema<{ count: number }>((data: any) => {
        if (data && typeof data.count === 'number') {
          return { value: data };
        }
        return { issues: [{ message: 'Count must be a number' }] };
      });

      const mockStep = {
        stateSchema: standardSchema as any,
      } as Step<string, any, any>;

      const result = await validateStepStateData({
        stateData: { count: 10 },
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.stateData).toEqual({ count: 10 });
    });
  });

  describe('ZodError preservation', () => {
    it('should preserve ZodError issues in validation failure', async () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const mockStep = {
        inputSchema: zodSchema,
      } as Step<string, any, any>;

      const result = await validateStepInput({
        prevOutput: { name: 123, age: 'invalid' }, // Both fields invalid
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeDefined();
      // The cause should contain the original ZodError with issues
      const cause = (result.validationError as any)?.cause;
      expect(cause).toBeDefined();
      expect(cause.issues).toBeDefined();
      expect(Array.isArray(cause.issues)).toBe(true);
      expect(cause.issues.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Zod transforms and defaults', () => {
    it('should apply Zod transforms during validation', async () => {
      const zodSchema = z.object({
        name: z.string().transform(s => s.toUpperCase()),
      });

      const mockStep = {
        inputSchema: zodSchema,
      } as Step<string, any, any>;

      const result = await validateStepInput({
        prevOutput: { name: 'john' },
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.inputData).toEqual({ name: 'JOHN' }); // Transformed
    });

    it('should apply Zod defaults during validation', async () => {
      const zodSchema = z.object({
        name: z.string(),
        role: z.string().default('user'),
      });

      const mockStep = {
        inputSchema: zodSchema,
      } as Step<string, any, any>;

      const result = await validateStepInput({
        prevOutput: { name: 'john' }, // Missing 'role'
        step: mockStep,
        validateInputs: true,
      });

      expect(result.validationError).toBeUndefined();
      expect(result.inputData).toEqual({ name: 'john', role: 'user' }); // Default applied
    });
  });
});
