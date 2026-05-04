import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { toStandardSchema } from './zod-v4';

describe('zod-v4 standard-schema adapter', () => {
  describe('toStandardSchema', () => {
    it('should wrap a Zod v4 schema with StandardJSONSchemaV1 interface', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const standardSchema = toStandardSchema(zodSchema);

      expect('~standard' in standardSchema).toBe(true);
      expect(standardSchema['~standard'].version).toBe(1);
      expect(standardSchema['~standard'].vendor).toBe('zod');
    });

    it('should preserve Zod v4 validation functionality', async () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number().min(0),
      });

      const standardSchema = toStandardSchema(zodSchema);

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

      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toBeDefined();
      expect((jsonSchema.properties as any).name.type).toBe('string');
      expect((jsonSchema.properties as any).age.type).toBe('number');
      expect((jsonSchema.properties as any).isActive.type).toBe('boolean');
      expect(jsonSchema.required).toEqual(['name', 'age', 'isActive']);
    });

    it('should convert input to JSON Schema', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const standardSchema = toStandardSchema(zodSchema);
      const inputJsonSchema = standardSchema['~standard'].jsonSchema.input({ target: 'draft-07' });
      const outputJsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      // For Zod schemas, input and output JSON schemas are the same
      expect(inputJsonSchema).toEqual(outputJsonSchema);
    });

    it('should preserve original Zod v4 methods', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const standardSchema = toStandardSchema(zodSchema);

      expect(typeof standardSchema.parse).toBe('function');
      expect(typeof standardSchema.safeParse).toBe('function');

      const result = standardSchema.safeParse({ name: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: 'test' });
      }
    });

    it('should handle the ask_user schema pattern', () => {
      const zodSchema = z.object({
        question: z.string().min(1),
        options: z
          .array(
            z.object({
              label: z.string(),
              description: z.string().optional(),
            }),
          )
          .optional(),
      });

      const standardSchema = toStandardSchema(zodSchema);
      const jsonSchema = standardSchema['~standard'].jsonSchema.input({ target: 'draft-07' });

      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.required).toEqual(['question']);
      expect((jsonSchema.properties as any).question.type).toBe('string');
      expect((jsonSchema.properties as any).options.type).toBe('array');
      expect((jsonSchema.properties as any).options.items.type).toBe('object');
      expect((jsonSchema.properties as any).options.items.properties.label.type).toBe('string');
      expect((jsonSchema.properties as any).options.items.properties.description.type).toBe('string');
    });

    it('should handle empty object schemas', () => {
      const zodSchema = z.object({});

      const standardSchema = toStandardSchema(zodSchema);
      const jsonSchema = standardSchema['~standard'].jsonSchema.input({ target: 'draft-07' });

      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toEqual({});
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
      });

      const standardSchema = toStandardSchema(personSchema);
      const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(jsonSchema.type).toBe('object');
      expect((jsonSchema.properties as any).addresses.type).toBe('array');
      expect((jsonSchema.properties as any).addresses.items.type).toBe('object');
    });

    it('should handle optional and nullable fields', () => {
      const zodSchema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        nullable: z.string().nullable(),
      });

      const standardSchema = toStandardSchema(zodSchema);
      const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.required).toBeDefined();
      expect((jsonSchema.required as string[]).includes('required')).toBe(true);
      expect((jsonSchema.required as string[]).includes('optional')).toBe(false);
    });

    it('should handle enum schemas', () => {
      const zodSchema = z.object({
        status: z.enum(['pending', 'in_progress', 'completed']),
      });

      const standardSchema = toStandardSchema(zodSchema);
      const jsonSchema = standardSchema['~standard'].jsonSchema.input({ target: 'draft-07' });

      expect(jsonSchema.type).toBe('object');
      expect((jsonSchema.properties as any).status.enum).toEqual(['pending', 'in_progress', 'completed']);
    });

    it('should handle the task_write schema pattern', () => {
      const taskItemSchema = z.object({
        content: z.string().min(1),
        status: z.enum(['pending', 'in_progress', 'completed']),
        activeForm: z.string().min(1),
      });
      const taskWriteSchema = z.object({
        tasks: z.array(taskItemSchema),
      });

      const standardSchema = toStandardSchema(taskWriteSchema);
      const jsonSchema = standardSchema['~standard'].jsonSchema.input({ target: 'draft-07' });

      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.required).toEqual(['tasks']);
      const items = (jsonSchema.properties as any).tasks.items;
      expect(items.type).toBe('object');
      expect(items.required).toEqual(['content', 'status', 'activeForm']);
    });

    it('should pass adapter options to z.toJSONSchema', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const standardSchema = toStandardSchema(zodSchema, { unrepresentable: 'any' });
      const jsonSchema = standardSchema['~standard'].jsonSchema.input({ target: 'draft-07' });

      expect(jsonSchema.type).toBe('object');
    });
  });

  describe('$schema mapping', () => {
    it('should not produce console warnings when using draft-07 target', () => {
      const zodSchema = z.object({ name: z.string() });
      const standardSchema = toStandardSchema(zodSchema);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      const draftWarnings = warnSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('Invalid target'),
      );
      expect(draftWarnings).toHaveLength(0);

      warnSpy.mockRestore();
    });

    it('should not produce console warnings when using draft-04 target', () => {
      const zodSchema = z.object({ name: z.string() });
      const standardSchema = toStandardSchema(zodSchema);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      standardSchema['~standard'].jsonSchema.output({ target: 'draft-04' });

      const draftWarnings = warnSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('Invalid target'),
      );
      expect(draftWarnings).toHaveLength(0);

      warnSpy.mockRestore();
    });

    it('should not produce console warnings when using draft-07 target', () => {
      const zodSchema = z.object({ name: z.string() });
      const standardSchema = toStandardSchema(zodSchema);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      const draftWarnings = warnSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('Invalid target'),
      );
      expect(draftWarnings).toHaveLength(0);
      expect(jsonSchema.$schema).toBeDefined(); // $schema should be set when target is valid

      warnSpy.mockRestore();
    });
  });
});
