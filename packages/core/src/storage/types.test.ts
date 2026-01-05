import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { buildStorageSchema } from './types';

describe('buildStorageSchema', () => {
  describe('basic types', () => {
    it('should map z.string() to text', () => {
      const schema = z.object({ field: z.string() });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('text');
      expect(result.field.nullable).toBe(false);
    });

    it('should map z.boolean() to boolean', () => {
      const schema = z.object({ field: z.boolean() });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('boolean');
      expect(result.field.nullable).toBe(false);
    });

    it('should map z.date() to timestamp', () => {
      const schema = z.object({ field: z.date() });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('timestamp');
      expect(result.field.nullable).toBe(false);
    });

    it('should map z.object() to jsonb', () => {
      const schema = z.object({ field: z.object({ nested: z.string() }) });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('jsonb');
      expect(result.field.nullable).toBe(false);
    });

    it('should map z.array() to jsonb', () => {
      const schema = z.object({ field: z.array(z.string()) });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('jsonb');
      expect(result.field.nullable).toBe(false);
    });

    it('should map z.record() to jsonb', () => {
      // Zod 4 requires both key and value schemas: z.record(keySchema, valueSchema)
      const schema = z.object({ field: z.record(z.string(), z.string()) });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('jsonb');
      expect(result.field.nullable).toBe(false);
    });
  });

  describe('numeric types', () => {
    it('should map z.number() to float', () => {
      const schema = z.object({ field: z.number() });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('float');
      expect(result.field.nullable).toBe(false);
    });

    it('should map z.number().int() to integer', () => {
      const schema = z.object({ field: z.number().int() });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('integer');
      expect(result.field.nullable).toBe(false);
    });

    it('should map z.bigint() to bigint', () => {
      const schema = z.object({ field: z.bigint() });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('bigint');
      expect(result.field.nullable).toBe(false);
    });
  });

  describe('UUID type', () => {
    it('should map z.string().uuid() to uuid', () => {
      const schema = z.object({ field: z.string().uuid() });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('uuid');
      expect(result.field.nullable).toBe(false);
    });

    it('should map plain z.string() to text (not uuid)', () => {
      const schema = z.object({ field: z.string() });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('text');
      expect(result.field.nullable).toBe(false);
    });
  });

  describe('enum types', () => {
    it('should map z.nativeEnum() to text', () => {
      enum TestEnum {
        A = 'a',
        B = 'b',
      }
      const schema = z.object({ field: z.nativeEnum(TestEnum) });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('text');
      expect(result.field.nullable).toBe(false);
    });
  });

  describe('nullable handling', () => {
    it('should mark z.nullable() fields as nullable', () => {
      const schema = z.object({ field: z.string().nullable() });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('text');
      expect(result.field.nullable).toBe(true);
    });

    it('should mark z.optional() fields as nullable', () => {
      const schema = z.object({ field: z.string().optional() });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('text');
      expect(result.field.nullable).toBe(true);
    });

    it('should unwrap z.default() and preserve type', () => {
      const schema = z.object({ field: z.string().default('test') });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('text');
      expect(result.field.nullable).toBe(false);
    });

    it('should handle nullable numeric types', () => {
      const schema = z.object({
        intField: z.number().int().nullable(),
        floatField: z.number().nullable(),
        bigintField: z.bigint().nullable(),
      });
      const result = buildStorageSchema(schema);
      expect(result.intField.type).toBe('integer');
      expect(result.intField.nullable).toBe(true);
      expect(result.floatField.type).toBe('float');
      expect(result.floatField.nullable).toBe(true);
      expect(result.bigintField.type).toBe('bigint');
      expect(result.bigintField.nullable).toBe(true);
    });

    it('should handle nullable uuid', () => {
      const schema = z.object({ field: z.string().uuid().nullable() });
      const result = buildStorageSchema(schema);
      expect(result.field.type).toBe('uuid');
      expect(result.field.nullable).toBe(true);
    });
  });

  describe('complex schema', () => {
    it('should handle a schema with multiple field types', () => {
      const schema = z.object({
        id: z.string().uuid(),
        name: z.string(),
        age: z.number().int(),
        score: z.number(),
        bigNum: z.bigint(),
        active: z.boolean(),
        createdAt: z.date(),
        metadata: z.object({ key: z.string() }).nullable(),
        tags: z.array(z.string()),
      });

      const result = buildStorageSchema(schema);

      expect(result.id.type).toBe('uuid');
      expect(result.id.nullable).toBe(false);
      expect(result.name.type).toBe('text');
      expect(result.name.nullable).toBe(false);
      expect(result.age.type).toBe('integer');
      expect(result.age.nullable).toBe(false);
      expect(result.score.type).toBe('float');
      expect(result.score.nullable).toBe(false);
      expect(result.bigNum.type).toBe('bigint');
      expect(result.bigNum.nullable).toBe(false);
      expect(result.active.type).toBe('boolean');
      expect(result.active.nullable).toBe(false);
      expect(result.createdAt.type).toBe('timestamp');
      expect(result.createdAt.nullable).toBe(false);
      expect(result.metadata.type).toBe('jsonb');
      expect(result.metadata.nullable).toBe(true);
      expect(result.tags.type).toBe('jsonb');
      expect(result.tags.nullable).toBe(false);
    });
  });
});
