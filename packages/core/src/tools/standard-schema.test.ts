import { describe, expect, it } from 'vitest';
import { isStandardSchema, StandardSchemaV1 } from '../types/standard-schema';
import { validateToolInput, validateToolOutput, validateToolSuspendData } from './validation';

describe('Standard Schema Support', () => {
  // Create a mock Standard Schema implementation (simulating a non-Zod library like Valibot)
  function createMockStandardSchema<T>(
    validator: (value: unknown) => StandardSchemaV1.Result<T>,
    vendor = 'mock-lib',
  ): StandardSchemaV1<unknown, T> {
    return {
      '~standard': {
        version: 1,
        vendor,
        validate: validator,
        types: undefined,
      },
    };
  }

  describe('isStandardSchema', () => {
    it('should detect a valid Standard Schema', () => {
      const schema = createMockStandardSchema(() => ({ value: 'test' }));
      expect(isStandardSchema(schema)).toBe(true);
    });

    it('should return false for non-Standard Schema objects', () => {
      expect(isStandardSchema({})).toBe(false);
      expect(isStandardSchema(null)).toBe(false);
      expect(isStandardSchema(undefined)).toBe(false);
      expect(isStandardSchema({ '~standard': {} })).toBe(false);
      expect(isStandardSchema({ '~standard': { version: 1 } })).toBe(false);
      expect(isStandardSchema({ '~standard': { version: 1, vendor: 'test' } })).toBe(false);
    });

    it('should return false for plain objects with similar structure but wrong types', () => {
      expect(
        isStandardSchema({
          '~standard': {
            version: '1', // should be number
            vendor: 'test',
            validate: () => ({ value: 'test' }),
          },
        }),
      ).toBe(false);
    });
  });

  describe('validateToolInput with Standard Schema', () => {
    it('should validate successfully with a passing Standard Schema', () => {
      const schema = createMockStandardSchema<string>(value => {
        if (typeof value === 'string') {
          return { value };
        }
        return { issues: [{ message: 'Expected string' }] };
      });

      const result = validateToolInput(schema, 'hello');
      expect(result.error).toBeUndefined();
      expect(result.data).toBe('hello');
    });

    it('should return validation error for failing Standard Schema', () => {
      const schema = createMockStandardSchema<string>(value => {
        if (typeof value === 'string') {
          return { value };
        }
        return { issues: [{ message: 'Expected string', path: ['input'] }] };
      });

      const result = validateToolInput(schema, 123, 'test-tool');
      expect(result.error).toBeDefined();
      expect(result.error?.error).toBe(true);
      expect(result.error?.message).toContain('Tool input validation failed for test-tool');
      expect(result.error?.message).toContain('Expected string');
    });

    it('should normalize undefined input to empty object for Standard Schema', () => {
      const schema = createMockStandardSchema<object>(value => {
        if (typeof value === 'object' && value !== null) {
          return { value };
        }
        return { issues: [{ message: 'Expected object' }] };
      });

      const result = validateToolInput(schema, undefined);
      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({});
    });

    it('should handle Standard Schema with path segments', () => {
      const schema = createMockStandardSchema<object>(() => ({
        issues: [
          { message: 'Invalid field', path: ['user', { key: 'name' }] },
          { message: 'Required', path: ['data', 0, 'value'] },
        ],
      }));

      const result = validateToolInput(schema, { user: {} });
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('user.name: Invalid field');
      expect(result.error?.message).toContain('data.0.value: Required');
    });
  });

  describe('validateToolOutput with Standard Schema', () => {
    it('should validate output successfully', () => {
      const schema = createMockStandardSchema<{ result: number }>(value => {
        if (typeof value === 'object' && value && 'result' in value) {
          return { value: value as { result: number } };
        }
        return { issues: [{ message: 'Expected object with result' }] };
      });

      const result = validateToolOutput(schema, { result: 42 });
      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ result: 42 });
    });

    it('should return validation error for invalid output', () => {
      const schema = createMockStandardSchema<{ result: number }>(() => ({
        issues: [{ message: 'Invalid output format' }],
      }));

      const result = validateToolOutput(schema, 'invalid', 'test-tool');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Tool output validation failed');
    });

    it('should skip validation when suspendCalled is true', () => {
      const schema = createMockStandardSchema<object>(() => ({
        issues: [{ message: 'This should not be checked' }],
      }));

      const result = validateToolOutput(schema, 'any-value', 'test-tool', true);
      expect(result.error).toBeUndefined();
      expect(result.data).toBe('any-value');
    });
  });

  describe('validateToolSuspendData with Standard Schema', () => {
    it('should validate suspend data successfully', () => {
      const schema = createMockStandardSchema<{ reason: string }>(value => {
        if (typeof value === 'object' && value && 'reason' in value) {
          return { value: value as { reason: string } };
        }
        return { issues: [{ message: 'Expected object with reason' }] };
      });

      const result = validateToolSuspendData(schema, { reason: 'waiting for approval' });
      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ reason: 'waiting for approval' });
    });

    it('should return validation error for invalid suspend data', () => {
      const schema = createMockStandardSchema<object>(() => ({
        issues: [{ message: 'Invalid suspend data' }],
      }));

      const result = validateToolSuspendData(schema, null, 'test-tool');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Tool suspension data validation failed');
    });
  });

  describe('vendor information', () => {
    it('should identify the vendor from Standard Schema', () => {
      const vailibotSchema = createMockStandardSchema(() => ({ value: 'test' }), 'valibot');
      const arktypeSchema = createMockStandardSchema(() => ({ value: 'test' }), 'arktype');

      expect(vailibotSchema['~standard'].vendor).toBe('valibot');
      expect(arktypeSchema['~standard'].vendor).toBe('arktype');
    });
  });

  describe('async validation handling', () => {
    it('should handle async validation gracefully by skipping validation', () => {
      // Create a schema that returns a Promise
      const asyncSchema: StandardSchemaV1 = {
        '~standard': {
          version: 1,
          vendor: 'async-lib',
          validate: async (value: unknown) => ({ value }),
        },
      };

      // The sync validation should return the normalized data with a warning
      // Since the input is a string (not undefined/null), it gets passed through after null conversion
      const result = validateToolInput(asyncSchema, 'test-value');
      // Since async is not supported in sync context, it should return the normalized input
      // 'test-value' is not undefined/null, so it stays as-is after normalization
      expect(result.data).toBe('test-value');
      expect(result.error).toBeUndefined();
    });

    it('should normalize undefined to empty object for async validation', () => {
      // Create a schema that returns a Promise
      const asyncSchema: StandardSchemaV1 = {
        '~standard': {
          version: 1,
          vendor: 'async-lib',
          validate: async (value: unknown) => ({ value }),
        },
      };

      // When input is undefined, it gets normalized to {}
      const result = validateToolInput(asyncSchema, undefined);
      expect(result.data).toEqual({});
      expect(result.error).toBeUndefined();
    });
  });
});
