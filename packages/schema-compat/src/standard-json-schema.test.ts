import { describe, expect, it } from 'vitest';
import type { JSONSchema7 } from 'json-schema';
import {
  convertStandardSchemaToAISDKSchema,
  convertAnySchemaToAISDKSchema,
  isStandardSchema,
  isStandardJSONSchema,
  type StandardSchemaV1,
  type StandardJSONSchemaV1,
} from './utils';

describe('Standard JSON Schema V1 Support', () => {
  // Create a mock that implements ONLY StandardJSONSchemaV1 (no validate)
  function createMockStandardJSONSchema<T>(
    jsonSchemaOutput: Record<string, unknown>,
    vendor = 'mock-json-lib',
  ): StandardJSONSchemaV1<unknown, T> {
    return {
      '~standard': {
        version: 1,
        vendor,
        jsonSchema: {
          input: (options: { target: string }) => jsonSchemaOutput,
          output: (options: { target: string }) => jsonSchemaOutput,
        },
      },
    };
  }

  // Create a mock that implements BOTH StandardSchemaV1 AND StandardJSONSchemaV1
  function createMockFullStandardSchema<T>(
    jsonSchemaOutput: Record<string, unknown>,
    validator: (value: unknown) => StandardSchemaV1.Result<T>,
    vendor = 'mock-full-lib',
  ): StandardSchemaV1<unknown, T> & StandardJSONSchemaV1<unknown, T> {
    return {
      '~standard': {
        version: 1,
        vendor,
        validate: validator,
        jsonSchema: {
          input: (options: { target: string }) => jsonSchemaOutput,
          output: (options: { target: string }) => jsonSchemaOutput,
        },
      },
    } as StandardSchemaV1<unknown, T> & StandardJSONSchemaV1<unknown, T>;
  }

  describe('isStandardJSONSchema', () => {
    it('should detect StandardJSONSchemaV1', () => {
      const schema = createMockStandardJSONSchema({ type: 'object' });
      expect(isStandardJSONSchema(schema)).toBe(true);
    });

    it('should return false for StandardSchemaV1 without jsonSchema', () => {
      const schema: StandardSchemaV1 = {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: () => ({ value: 'test' }),
        },
      };
      expect(isStandardJSONSchema(schema)).toBe(false);
      expect(isStandardSchema(schema)).toBe(true);
    });

    it('should detect schema with both validate and jsonSchema', () => {
      const schema = createMockFullStandardSchema({ type: 'string' }, () => ({ value: 'test' as any }));
      expect(isStandardJSONSchema(schema)).toBe(true);
      expect(isStandardSchema(schema)).toBe(true);
    });
  });

  describe('convertStandardSchemaToAISDKSchema', () => {
    it('should use jsonSchema.input() to generate JSON Schema', () => {
      const expectedJsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };

      const schema = createMockStandardJSONSchema(expectedJsonSchema);
      const result = convertStandardSchemaToAISDKSchema(schema);

      expect(result.jsonSchema).toEqual(expectedJsonSchema);
    });

    it('should pass target option to jsonSchema.input()', () => {
      let capturedTarget: string | undefined;

      const schema: StandardJSONSchemaV1 = {
        '~standard': {
          version: 1,
          vendor: 'test',
          jsonSchema: {
            input: (options: { target: string }) => {
              capturedTarget = options.target;
              return { type: 'object' };
            },
            output: () => ({ type: 'object' }),
          },
        },
      };

      convertStandardSchemaToAISDKSchema(schema, 'draft-2020-12');
      expect(capturedTarget).toBe('draft-2020-12');

      convertStandardSchemaToAISDKSchema(schema, 'draft-07');
      expect(capturedTarget).toBe('draft-07');
    });

    it('should include validation when StandardSchemaV1 is also implemented', () => {
      const schema = createMockFullStandardSchema(
        { type: 'number' },
        value => {
          if (typeof value === 'number') {
            return { value };
          }
          return { issues: [{ message: 'Expected number' }] };
        },
      );

      const result = convertStandardSchemaToAISDKSchema(schema);

      // Should have the JSON Schema
      expect(result.jsonSchema).toEqual({ type: 'number' });

      // Should validate successfully for numbers
      const validResult = result.validate!(42);
      expect(validResult.success).toBe(true);

      // Should fail for non-numbers
      const invalidResult = result.validate!('not a number');
      expect(invalidResult.success).toBe(false);
    });

    it('should work without validate method (JSON Schema only)', () => {
      const schema = createMockStandardJSONSchema({ type: 'string' });
      const result = convertStandardSchemaToAISDKSchema(schema);

      // Should have the JSON Schema
      expect(result.jsonSchema).toEqual({ type: 'string' });

      // Should still have validate that returns success (no validation available)
      const validResult = result.validate!('anything');
      expect(validResult.success).toBe(true);
    });
  });

  describe('convertAnySchemaToAISDKSchema', () => {
    it('should handle StandardJSONSchemaV1', () => {
      const schema = createMockStandardJSONSchema({
        type: 'object',
        properties: { query: { type: 'string' } },
      });

      const result = convertAnySchemaToAISDKSchema(schema);

      expect(result.jsonSchema).toEqual({
        type: 'object',
        properties: { query: { type: 'string' } },
      });
    });

    it('should prioritize StandardJSONSchemaV1 for JSON Schema generation', () => {
      // A schema with both StandardJSONSchemaV1 and validation
      const schema = createMockFullStandardSchema(
        { type: 'custom', description: 'From StandardJSONSchemaV1' },
        () => ({ value: 'validated' as any }),
      );

      const result = convertAnySchemaToAISDKSchema(schema);

      // Should use the JSON Schema from StandardJSONSchemaV1
      expect(result.jsonSchema).toEqual({
        type: 'custom',
        description: 'From StandardJSONSchemaV1',
      });
    });
  });

  describe('spec compliance', () => {
    it('should support draft-07 target', () => {
      const schema = createMockStandardJSONSchema({ type: 'object' });
      const result = convertStandardSchemaToAISDKSchema(schema, 'draft-07');
      expect(result.jsonSchema).toBeDefined();
    });

    it('should support draft-2020-12 target', () => {
      const schema = createMockStandardJSONSchema({ type: 'object' });
      const result = convertStandardSchemaToAISDKSchema(schema, 'draft-2020-12');
      expect(result.jsonSchema).toBeDefined();
    });

    it('should support openapi-3.0 target', () => {
      const schema = createMockStandardJSONSchema({ type: 'object' });
      const result = convertStandardSchemaToAISDKSchema(schema, 'openapi-3.0');
      expect(result.jsonSchema).toBeDefined();
    });
  });
});
