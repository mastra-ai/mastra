import { describe, it, expect } from 'vitest';
// With vitest workspace alias, 'zod' resolves to 'zod-v3' for this test file
import { z } from 'zod';
import { toStandardSchema } from './zod-v3';

describe('zod-v3 standard-schema adapter', () => {
  describe('toStandardSchema', () => {
    it('should wrap a Zod schema with StandardJSONSchemaV1 interface', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const standardSchema = toStandardSchema(zodSchema);

      // Should have ~standard property
      expect('~standard' in standardSchema).toBe(true);
      expect(standardSchema['~standard'].version).toBe(1);
      expect(standardSchema['~standard'].vendor).toBe('zod');
    });

    it('should preserve Zod validation functionality', async () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number().min(0),
      });

      const standardSchema = toStandardSchema(zodSchema);

      // Test validation through ~standard.validate
      const validResult = await standardSchema['~standard'].validate({ name: 'John', age: 30 });
      expect(validResult).toEqual({ value: { name: 'John', age: 30 } });

      const invalidResult = await standardSchema['~standard'].validate({ name: 123, age: -1 });
      expect('issues' in invalidResult).toBe(true);
      if ('issues' in invalidResult && invalidResult.issues) {
        expect(invalidResult.issues.length).toBeGreaterThan(0);
      }
    });

    it('should add jsonSchema converter', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const standardSchema = toStandardSchema(zodSchema);

      // Should have jsonSchema property
      expect('jsonSchema' in standardSchema['~standard']).toBe(true);
      expect(typeof standardSchema['~standard'].jsonSchema.input).toBe('function');
      expect(typeof standardSchema['~standard'].jsonSchema.output).toBe('function');
    });

    it('should convert to JSON Schema with draft-07 target', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
        isActive: z.boolean(),
      });

      const standardSchema = toStandardSchema(zodSchema);
      const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should convert to JSON Schema with openapi-3.0 target', () => {
      const zodSchema = z.object({
        email: z.string().email(),
      });

      const standardSchema = toStandardSchema(zodSchema);
      const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'openapi-3.0' });

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should convert input to JSON Schema', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const standardSchema = toStandardSchema(zodSchema);
      const inputJsonSchema = standardSchema['~standard'].jsonSchema.input({ target: 'draft-07' });
      const outputJsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      // For Zod schemas, input and output JSON schemas are typically the same
      expect(inputJsonSchema).toEqual(outputJsonSchema);
    });

    it('should throw for unsupported targets', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const standardSchema = toStandardSchema(zodSchema);

      expect(() => {
        standardSchema['~standard'].jsonSchema.output({ target: 'unknown-target' as any });
      }).toThrow(/Unsupported JSON Schema target/);
    });

    it('should preserve original Zod methods', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const standardSchema = toStandardSchema(zodSchema);

      // Should still work as a Zod schema
      expect.assertions(4);
      expect(typeof standardSchema.parse).toBe('function');
      expect(typeof standardSchema.safeParse).toBe('function');

      const result = standardSchema.safeParse({ name: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: 'test' });
      }
    });

    it('should handle complex nested schemas', () => {
      const addressSchema = z.object({
        street: z.string(),
        city: z.string(),
        zip: z.string(),
      });

      const personSchema = z.object({
        name: z.string(),
        addresses: z.array(addressSchema),
        metadata: z.record(z.string()),
      });

      const standardSchema = toStandardSchema(personSchema);
      const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle optional and nullable fields', () => {
      const zodSchema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        nullable: z.string().nullable(),
      });

      const standardSchema = toStandardSchema(zodSchema);
      const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(jsonSchema.required).toBeDefined();
      expect((jsonSchema.required as string[]).includes('required')).toBe(true);
      expect(jsonSchema).toMatchSnapshot();
    });
  });
});
