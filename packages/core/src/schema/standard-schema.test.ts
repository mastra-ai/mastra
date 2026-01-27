import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { toStandardSchema } from './adapters/zod-v3';
import { isStandardSchema, isStandardJSONSchema, isStandardSchemaWithJSON } from './standard-schema';

describe('zod-v3 standard-schema adapter', () => {
  describe('isStandardSchema', () => {
    it('should return true for Zod schemas', () => {
      const zodSchema = z.object({ name: z.string() });
      expect(isStandardSchema(zodSchema)).toBe(true);
    });

    it('should return true for wrapped schemas', () => {
      const zodSchema = z.object({ name: z.string() });
      const standardSchema = toStandardSchema(zodSchema);
      expect(isStandardSchema(standardSchema)).toBe(true);
    });

    it('should return false for non-schemas', () => {
      expect(isStandardSchema(null)).toBe(false);
      expect(isStandardSchema(undefined)).toBe(false);
      expect(isStandardSchema({})).toBe(false);
      expect(isStandardSchema({ '~standard': {} })).toBe(false);
    });
  });

  describe('isStandardJSONSchema', () => {
    it('should return false for unwrapped Zod schemas', () => {
      const zodSchema = z.object({ name: z.string() });
      expect(isStandardJSONSchema(zodSchema)).toBe(false);
    });

    it('should return true for wrapped schemas', () => {
      const zodSchema = z.object({ name: z.string() });
      const standardSchema = toStandardSchema(zodSchema);
      expect(isStandardJSONSchema(standardSchema)).toBe(true);
    });

    it('should return false for non-schemas', () => {
      expect(isStandardJSONSchema(null)).toBe(false);
      expect(isStandardJSONSchema(undefined)).toBe(false);
      expect(isStandardJSONSchema({})).toBe(false);
    });
  });

  describe('isStandardSchemaWithJSON', () => {
    it('should return false for unwrapped Zod schemas', () => {
      const zodSchema = z.object({ name: z.string() });
      expect(isStandardSchemaWithJSON(zodSchema)).toBe(false);
    });

    it('should return true for wrapped schemas', () => {
      const zodSchema = z.object({ name: z.string() });
      const standardSchema = toStandardSchema(zodSchema);
      expect(isStandardSchemaWithJSON(standardSchema)).toBe(true);
    });
  });
});
