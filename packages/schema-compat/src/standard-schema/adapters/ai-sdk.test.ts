import { jsonSchema } from '@internal/ai-v6';
import { describe, it, expect } from 'vitest';
import { isStandardSchemaWithJSON } from '../standard-schema';
import { toStandardSchema } from './ai-sdk';

describe('ai-sdk standard-schema adapter', () => {
  describe('toStandardSchema', () => {
    it('should wrap an AI SDK Schema with StandardSchemaV1 interface', () => {
      const aiSdkSchema = jsonSchema<{ name: string; age: number }>({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      });

      const standardSchema = toStandardSchema(aiSdkSchema);

      // Should have ~standard property
      expect('~standard' in standardSchema).toBe(true);
      expect(standardSchema['~standard'].version).toBe(1);
      expect(standardSchema['~standard'].vendor).toBe('ai-sdk');
    });

    it('should validate data correctly when schema has validate method', async () => {
      // Create schema with custom validation
      const aiSdkSchema = jsonSchema<{ name: string; age: number }>(
        {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number', minimum: 0 },
          },
          required: ['name', 'age'],
        },
        {
          validate: value => {
            const obj = value as { name?: unknown; age?: unknown };
            if (typeof obj.name !== 'string' || typeof obj.age !== 'number') {
              return { success: false, error: new Error('Invalid type') };
            }
            if (obj.age < 0) {
              return { success: false, error: new Error('Age must be non-negative') };
            }
            return { success: true, value: obj as { name: string; age: number } };
          },
        },
      );

      const standardSchema = toStandardSchema(aiSdkSchema);

      // Test valid data
      const validResult = await standardSchema['~standard'].validate({ name: 'John', age: 30 });
      expect(validResult).toEqual({ value: { name: 'John', age: 30 } });

      // Test invalid data - negative age
      const invalidResult = await standardSchema['~standard'].validate({ name: 'John', age: -5 });
      expect('issues' in invalidResult).toBe(true);
      expect(invalidResult.issues).toBeDefined();
      expect(invalidResult.issues?.length).toBeGreaterThan(0);
      expect(invalidResult.issues?.[0].message).toContain('non-negative');
    });

    it('should pass through values when schema has no validate method', async () => {
      // Create a schema without validate method
      const aiSdkSchema = jsonSchema<{ name: string }>({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });

      const standardSchema = toStandardSchema(aiSdkSchema);

      // Should pass through any value
      const result = await standardSchema['~standard'].validate({ name: 'John' });
      expect(result).toEqual({ value: { name: 'John' } });

      // Even invalid data should pass through
      const result2 = await standardSchema['~standard'].validate({ invalid: true });
      expect(result2).toEqual({ value: { invalid: true } });
    });

    it('should have jsonSchema converter', () => {
      const aiSdkSchema = jsonSchema({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });

      const standardSchema = toStandardSchema(aiSdkSchema);

      // Should have jsonSchema property
      expect('jsonSchema' in standardSchema['~standard']).toBe(true);
      expect(typeof standardSchema['~standard'].jsonSchema.input).toBe('function');
      expect(typeof standardSchema['~standard'].jsonSchema.output).toBe('function');
    });

    it('should return JSON Schema with draft-07 target', () => {
      const aiSdkSchema = jsonSchema({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      });

      const standardSchema = toStandardSchema(aiSdkSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.type).toBe('object');
      expect(outputSchema.properties).toBeDefined();
      expect(outputSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(outputSchema).toMatchSnapshot();
    });

    it('should return JSON Schema with draft-2020-12 target', () => {
      const aiSdkSchema = jsonSchema({
        type: 'string',
      });

      const standardSchema = toStandardSchema(aiSdkSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-2020-12' });

      expect(outputSchema.type).toBe('string');
      expect(outputSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(outputSchema).toMatchSnapshot();
    });

    it('should return JSON Schema with openapi-3.0 target (no $schema)', () => {
      const aiSdkSchema = jsonSchema({
        type: 'string',
      });

      const standardSchema = toStandardSchema(aiSdkSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'openapi-3.0' });

      expect(outputSchema.type).toBe('string');
      // OpenAPI 3.0 doesn't use $schema
      expect(outputSchema.$schema).toBeUndefined();
      expect(outputSchema).toMatchSnapshot();
    });

    it('should handle nested object schemas', () => {
      const aiSdkSchema = jsonSchema({
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
      });

      const standardSchema = toStandardSchema(aiSdkSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.type).toBe('object');
      expect((outputSchema.properties as any).user.type).toBe('object');
      expect((outputSchema.properties as any).tags.type).toBe('array');
      expect(outputSchema).toMatchSnapshot();
    });

    it('should handle array schemas', () => {
      const aiSdkSchema = jsonSchema({
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
        minItems: 1,
      });

      const standardSchema = toStandardSchema(aiSdkSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.type).toBe('array');
      expect(outputSchema.minItems).toBe(1);
      expect(outputSchema).toMatchSnapshot();
    });

    it('should handle enum schemas', () => {
      const aiSdkSchema = jsonSchema({
        type: 'string',
        enum: ['red', 'green', 'blue'],
      });

      const standardSchema = toStandardSchema(aiSdkSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.type).toBe('string');
      expect(outputSchema.enum).toEqual(['red', 'green', 'blue']);
      expect(outputSchema).toMatchSnapshot();
    });

    it('should expose getSchema method', () => {
      const aiSdkSchema = jsonSchema({
        type: 'string',
      });

      const standardSchema = toStandardSchema(aiSdkSchema);

      expect(standardSchema.getSchema()).toBe(aiSdkSchema);
    });

    it('should expose getJsonSchema method', () => {
      const originalJsonSchema = {
        type: 'string' as const,
        minLength: 1,
      };
      const aiSdkSchema = jsonSchema(originalJsonSchema);

      const standardSchema = toStandardSchema(aiSdkSchema);

      expect(standardSchema.getJsonSchema()).toEqual(originalJsonSchema);
    });

    it('should handle async validation', async () => {
      // Create schema with async validation
      const aiSdkSchema = jsonSchema<{ id: string }>(
        {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        {
          validate: async value => {
            // Simulate async validation
            await new Promise(resolve => setTimeout(resolve, 10));
            const obj = value as { id?: unknown };
            if (typeof obj.id !== 'string') {
              return { success: false, error: new Error('Invalid id') };
            }
            return { success: true, value: obj as { id: string } };
          },
        },
      );

      const standardSchema = toStandardSchema(aiSdkSchema);

      const result = await standardSchema['~standard'].validate({ id: 'test-123' });
      expect(result).toEqual({ value: { id: 'test-123' } });
    });
  });

  describe('isStandardSchemaWithJSON', () => {
    it('should return true for AI SDK wrapped schemas', () => {
      const aiSdkSchema = jsonSchema({ type: 'string' });
      const wrapper = toStandardSchema(aiSdkSchema);

      expect(isStandardSchemaWithJSON(wrapper)).toBe(true);
    });
  });
});
