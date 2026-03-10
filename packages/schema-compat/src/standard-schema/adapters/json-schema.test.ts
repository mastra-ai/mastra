import type { JSONSchema7 } from 'json-schema';
import { describe, it, expect } from 'vitest';
import { isStandardSchemaWithJSON } from '../standard-schema';
import { toStandardSchema } from './json-schema';

describe('json-schema standard-schema adapter', () => {
  describe('toStandardSchema', () => {
    it('should wrap a JSON Schema with StandardSchemaV1 interface', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };

      const standardSchema = toStandardSchema(jsonSchema);

      // Should have ~standard property
      expect('~standard' in standardSchema).toBe(true);
      expect(standardSchema['~standard'].version).toBe(1);
      expect(standardSchema['~standard'].vendor).toBe('json-schema');
    });

    it('should validate data correctly', async () => {
      const jsonSchema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 },
        },
        required: ['name', 'age'],
      };

      const standardSchema = toStandardSchema<{ name: string; age: number }>(jsonSchema);

      // Test valid data
      const validResult = await standardSchema['~standard'].validate({ name: 'John', age: 30 });
      expect(validResult).toEqual({ value: { name: 'John', age: 30 } });

      // Test invalid data - missing required field
      const invalidResult = await standardSchema['~standard'].validate({ name: 'John' });
      expect('issues' in invalidResult).toBe(true);
      if ('issues' in invalidResult && invalidResult.issues) {
        expect(invalidResult.issues.length).toBeGreaterThan(0);
      }
    });

    it('should have jsonSchema converter', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const standardSchema = toStandardSchema(jsonSchema);

      // Should have jsonSchema property
      expect('jsonSchema' in standardSchema['~standard']).toBe(true);
      expect(typeof standardSchema['~standard'].jsonSchema.input).toBe('function');
      expect(typeof standardSchema['~standard'].jsonSchema.output).toBe('function');
    });

    it('should return JSON Schema with draft-07 target', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.type).toBe('object');
      expect(outputSchema.properties).toBeDefined();
      expect(outputSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(outputSchema).toMatchSnapshot();
    });

    it('should return JSON Schema with draft-2020-12 target', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'string',
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-2020-12' });

      expect(outputSchema.type).toBe('string');
      expect(outputSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(outputSchema).toMatchSnapshot();
    });

    it('should return JSON Schema with openapi-3.0 target (no $schema)', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'string',
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'openapi-3.0' });

      expect(outputSchema.type).toBe('string');
      // OpenAPI 3.0 doesn't use $schema
      expect(outputSchema.$schema).toBeUndefined();
      expect(outputSchema).toMatchSnapshot();
    });

    it('should not overwrite existing $schema', () => {
      const jsonSchema: JSONSchema7 = {
        $schema: 'http://custom-schema.org/schema#',
        type: 'string',
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.$schema).toBe('http://custom-schema.org/schema#');
      expect(outputSchema).toMatchSnapshot();
    });

    it('should handle nested object schemas', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
            },
            required: ['name'],
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['user'],
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.type).toBe('object');
      expect((outputSchema.properties as any).user.type).toBe('object');
      expect((outputSchema.properties as any).tags.type).toBe('array');
      expect(outputSchema).toMatchSnapshot();
    });

    it('should handle array schemas', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
        minItems: 1,
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.type).toBe('array');
      expect(outputSchema.minItems).toBe(1);
    });

    it('should handle enum schemas', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'string',
        enum: ['red', 'green', 'blue'],
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.type).toBe('string');
      expect(outputSchema.enum).toEqual(['red', 'green', 'blue']);
    });

    it('should validate enum values correctly', async () => {
      const jsonSchema: JSONSchema7 = {
        type: 'string',
        enum: ['red', 'green', 'blue'],
      };

      const standardSchema = toStandardSchema<'red' | 'green' | 'blue'>(jsonSchema);

      const validResult = await standardSchema['~standard'].validate('red');
      expect(validResult).toEqual({ value: 'red' });

      const invalidResult = await standardSchema['~standard'].validate('yellow');
      expect('issues' in invalidResult).toBe(true);
    });

    it('should expose getSchema method', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'string',
      };

      const standardSchema = toStandardSchema(jsonSchema);

      expect(standardSchema.getSchema()).toEqual(jsonSchema);
    });
  });

  describe('isStandardSchemaWithJSON', () => {
    it('should return true for JSON Schema wrapped schemas', () => {
      const jsonSchema: JSONSchema7 = { type: 'string' };
      const wrapper = toStandardSchema(jsonSchema);

      expect(isStandardSchemaWithJSON(wrapper)).toBe(true);
    });

    it('should return false for non-json-schema vendors', () => {
      // Mock a standard schema with different vendor
      const mockSchema = {
        '~standard': {
          version: 1,
          vendor: 'other-vendor',
        },
      };

      expect(isStandardSchemaWithJSON(mockSchema)).toBe(false);
    });

    it('should return false for non-schema values', () => {
      expect(isStandardSchemaWithJSON(null)).toBe(false);
      expect(isStandardSchemaWithJSON(undefined)).toBe(false);
      expect(isStandardSchemaWithJSON({})).toBe(false);
    });
  });
});
