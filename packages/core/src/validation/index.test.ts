import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateSync,
  validateAsync,
  hasZodSafeParse,
  hasZodSafeParseAsync,
  formatValidationIssues,
  createValidationErrorMessage,
  type ValidationIssue,
} from './index';
import type { StandardSchemaV1 } from '../types/standard-schema';

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

describe('Validation Module', () => {
  describe('hasZodSafeParse', () => {
    it('should return true for Zod schemas', () => {
      const schema = z.string();
      expect(hasZodSafeParse(schema)).toBe(true);
    });

    it('should return false for non-Zod objects', () => {
      expect(hasZodSafeParse({})).toBe(false);
      expect(hasZodSafeParse(null)).toBe(false);
      expect(hasZodSafeParse(undefined)).toBe(false);
      expect(hasZodSafeParse('string')).toBe(false);
    });

    it('should return false for Standard Schema objects', () => {
      const schema = createMockStandardSchema(data => ({ value: data }));
      expect(hasZodSafeParse(schema)).toBe(false);
    });
  });

  describe('hasZodSafeParseAsync', () => {
    it('should return true for Zod schemas', () => {
      const schema = z.string();
      expect(hasZodSafeParseAsync(schema)).toBe(true);
    });

    it('should return false for non-Zod objects', () => {
      expect(hasZodSafeParseAsync({})).toBe(false);
      expect(hasZodSafeParseAsync(null)).toBe(false);
    });
  });

  describe('formatValidationIssues', () => {
    it('should format issues correctly', () => {
      const issues: ValidationIssue[] = [
        { path: 'name', message: 'Required' },
        { path: 'age', message: 'Must be a number' },
      ];

      const result = formatValidationIssues(issues);
      expect(result).toBe('- name: Required\n- age: Must be a number');
    });

    it('should handle empty issues array', () => {
      expect(formatValidationIssues([])).toBe('');
    });
  });

  describe('createValidationErrorMessage', () => {
    it('should create error message with context', () => {
      const issues: ValidationIssue[] = [{ path: 'email', message: 'Invalid email' }];

      const result = createValidationErrorMessage('Validation failed', issues);
      expect(result).toContain('Validation failed');
      expect(result).toContain('email: Invalid email');
    });

    it('should include data when provided', () => {
      const issues: ValidationIssue[] = [{ path: 'email', message: 'Invalid email' }];

      const result = createValidationErrorMessage('Validation failed', issues, { email: 'bad' });
      expect(result).toContain('Provided data:');
      expect(result).toContain('"email": "bad"');
    });
  });

  describe('validateSync', () => {
    describe('with Zod schemas', () => {
      it('should validate valid data successfully', () => {
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

      it('should return error for invalid data', () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        });

        const result = validateSync(schema, { name: 'John', age: 'not-a-number' });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.issues.length).toBeGreaterThan(0);
          expect(result.issues[0].path).toBe('age');
          expect(result.cause).toBeDefined(); // Should preserve ZodError
        }
      });

      it('should apply Zod transforms', () => {
        const schema = z.object({
          name: z.string().transform(s => s.toUpperCase()),
        });

        const result = validateSync(schema, { name: 'john' });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ name: 'JOHN' });
        }
      });

      it('should apply Zod defaults', () => {
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
    });

    describe('with Standard Schema', () => {
      it('should validate valid data successfully', () => {
        const schema = createMockStandardSchema<{ name: string }>((data: any) => {
          if (data && typeof data.name === 'string') {
            return { value: data };
          }
          return { issues: [{ message: 'Invalid name' }] };
        });

        const result = validateSync(schema, { name: 'John' });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ name: 'John' });
        }
      });

      it('should return error for invalid data', () => {
        const schema = createMockStandardSchema<{ name: string }>((data: any) => {
          if (data && typeof data.name === 'string') {
            return { value: data };
          }
          return { issues: [{ message: 'Name is required', path: ['name'] }] };
        });

        const result = validateSync(schema, {});

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.issues.length).toBe(1);
          expect(result.issues[0].message).toBe('Name is required');
          expect(result.cause).toBeDefined(); // Should preserve original issues
        }
      });
    });
  });

  describe('validateAsync', () => {
    describe('with Zod schemas', () => {
      it('should validate valid data successfully', async () => {
        const schema = z.object({
          email: z.string().email(),
        });

        const result = await validateAsync(schema, { email: 'test@example.com' });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ email: 'test@example.com' });
        }
      });

      it('should return error for invalid data', async () => {
        const schema = z.object({
          email: z.string().email(),
        });

        const result = await validateAsync(schema, { email: 'not-an-email' });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.issues.length).toBeGreaterThan(0);
          expect(result.cause).toBeDefined(); // Should preserve ZodError
        }
      });

      it('should handle async Zod refines', async () => {
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

    describe('with Standard Schema', () => {
      it('should validate valid data successfully', async () => {
        const schema = createAsyncMockStandardSchema<{ id: number }>(async (data: any) => {
          await new Promise(r => setTimeout(r, 1));
          if (data && typeof data.id === 'number') {
            return { value: data };
          }
          return { issues: [{ message: 'Invalid id' }] };
        });

        const result = await validateAsync(schema, { id: 123 });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ id: 123 });
        }
      });

      it('should return error for invalid data', async () => {
        const schema = createAsyncMockStandardSchema<{ id: number }>(async (data: any) => {
          await new Promise(r => setTimeout(r, 1));
          if (data && typeof data.id === 'number') {
            return { value: data };
          }
          return { issues: [{ message: 'ID must be a number', path: ['id'] }] };
        });

        const result = await validateAsync(schema, { id: 'not-a-number' });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.issues.length).toBe(1);
          expect(result.issues[0].message).toBe('ID must be a number');
          expect(result.cause).toBeDefined();
        }
      });
    });

    describe('priority', () => {
      it('should prefer Zod over Standard Schema when both are present', async () => {
        // Create a schema that has both Zod's safeParseAsync AND Standard Schema's validate
        // Zod schemas naturally have both
        const zodSchema = z.object({ name: z.string() });

        // Verify it has both interfaces
        expect(hasZodSafeParseAsync(zodSchema)).toBe(true);
        expect('~standard' in zodSchema).toBe(true);

        // Should use Zod's validation (which applies transforms, defaults, etc.)
        const schemaWithTransform = z.object({
          name: z.string().transform(s => s.toUpperCase()),
        });

        const result = await validateAsync(schemaWithTransform, { name: 'john' });

        expect(result.success).toBe(true);
        if (result.success) {
          // If Zod was used, the transform should have been applied
          expect(result.data).toEqual({ name: 'JOHN' });
        }
      });
    });
  });
});
