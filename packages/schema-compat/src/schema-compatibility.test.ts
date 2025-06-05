import type { LanguageModelV1 } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { SchemaCompatLayer } from './schema-compatibility';

class MockSchemaCompatibility extends SchemaCompatLayer {
  constructor(model: LanguageModelV1) {
    super(model);
  }

  shouldApply(): boolean {
    return true;
  }

  getSchemaTarget() {
    return 'jsonSchema7' as const;
  }

  processZodType(value: z.ZodTypeAny): any {
    return value;
  }
}

const mockModel = new MockLanguageModelV1({
  modelId: 'test-model',
  defaultObjectGenerationMode: 'json',
});

describe('SchemaCompatLayer', () => {
  let compatibility: MockSchemaCompatibility;

  beforeEach(() => {
    compatibility = new MockSchemaCompatibility(mockModel);
  });

  describe('constructor and getModel', () => {
    it('should store and return the model', () => {
      expect(compatibility.getModel()).toBe(mockModel);
    });
  });

  describe('mergeParameterDescription', () => {
    it('should return original description when no constraints', () => {
      const description = 'Original description';
      const constraints = {};

      const result = compatibility.mergeParameterDescription(description, constraints);

      expect(result).toBe(description);
    });

    it('should append constraints to description', () => {
      const description = 'Original description';
      const constraints = { minLength: 5, maxLength: 10 };

      const result = compatibility.mergeParameterDescription(description, constraints);

      expect(result).toBe('Original description\n{"minLength":5,"maxLength":10}');
    });

    it('should handle undefined description with constraints', () => {
      const constraints = { email: true };

      const result = compatibility.mergeParameterDescription(undefined, constraints);

      expect(result).toBe('{"email":true}');
    });

    it('should handle empty constraints', () => {
      const description = 'Test description';
      const constraints = {};

      const result = compatibility.mergeParameterDescription(description, constraints);

      expect(result).toBe(description);
    });
  });

  describe('defaultZodObjectHandler', () => {
    it('should process object shape correctly', () => {
      const testSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = compatibility.defaultZodObjectHandler(testSchema);

      expect(result).toBeInstanceOf(z.ZodObject);
      expect(result._def.typeName).toBe('ZodObject');
    });

    it('should preserve description', () => {
      const testSchema = z
        .object({
          name: z.string(),
        })
        .describe('Test object');

      const result = compatibility.defaultZodObjectHandler(testSchema);

      expect(result.description).toBe('Test object');
    });
  });

  describe('defaultUnsupportedZodTypeHandler', () => {
    it('should throw error for unsupported types', () => {
      const unsupportedSchema = z.never();

      expect(() => {
        compatibility.defaultUnsupportedZodTypeHandler(unsupportedSchema);
      }).toThrow('test-model does not support zod type: ZodNever');
    });

    it('should return value for supported types', () => {
      const supportedSchema = z.string();

      const result = compatibility.defaultUnsupportedZodTypeHandler(supportedSchema);

      expect(result).toBe(supportedSchema);
    });

    it('should respect custom throwOnTypes parameter', () => {
      const neverSchema = z.never();

      const result = compatibility.defaultUnsupportedZodTypeHandler(neverSchema, []);

      expect(result).toBe(neverSchema);
    });
  });

  describe('defaultZodArrayHandler', () => {
    it('should handle array with constraints', () => {
      const arraySchema = z.array(z.string()).min(2).max(10);

      const result = compatibility.defaultZodArrayHandler(arraySchema);

      expect(result).toBeInstanceOf(z.ZodArray);
      expect(result.description).toContain('minLength');
      expect(result.description).toContain('maxLength');
    });

    it('should handle array without constraints', () => {
      const arraySchema = z.array(z.string());

      const result = compatibility.defaultZodArrayHandler(arraySchema);

      expect(result).toBeInstanceOf(z.ZodArray);
    });

    it('should handle exact length constraint', () => {
      const arraySchema = z.array(z.string()).length(5);

      const result = compatibility.defaultZodArrayHandler(arraySchema);

      expect(result).toBeInstanceOf(z.ZodArray);
      expect(result.description).toContain('exactLength');
    });

    it('should preserve original description', () => {
      const arraySchema = z.array(z.string()).describe('String array');

      const result = compatibility.defaultZodArrayHandler(arraySchema);

      expect(result.description).toContain('String array');
    });
  });

  describe('defaultZodUnionHandler', () => {
    it('should handle union types', () => {
      const unionSchema = z.union([z.string(), z.number()]);

      const result = compatibility.defaultZodUnionHandler(unionSchema);

      expect(result).toBeInstanceOf(z.ZodUnion);
    });

    it('should preserve description', () => {
      const unionSchema = z.union([z.string(), z.number()]).describe('String or number');

      const result = compatibility.defaultZodUnionHandler(unionSchema);

      expect(result.description).toBe('String or number');
    });

    it('should throw error for union with less than 2 options', () => {
      const mockUnion = {
        _def: {
          typeName: 'ZodUnion' as const,
          options: [z.string()],
        },
      } as z.ZodUnion<[z.ZodString]>;

      expect(() => {
        compatibility.defaultZodUnionHandler(mockUnion);
      }).toThrow('Union must have at least 2 options');
    });
  });

  describe('defaultZodStringHandler', () => {
    it('should handle string with length constraints', () => {
      const stringSchema = z.string().min(5).max(10);

      const result = compatibility.defaultZodStringHandler(stringSchema);

      expect(result).toBeInstanceOf(z.ZodString);
      expect(result.description).toContain('minLength');
      expect(result.description).toContain('maxLength');
    });

    it('should handle email constraint', () => {
      const stringSchema = z.string().email();

      const result = compatibility.defaultZodStringHandler(stringSchema);

      expect(result).toBeInstanceOf(z.ZodString);
      expect(result.description).toContain('email');
    });

    it('should handle url constraint', () => {
      const stringSchema = z.string().url();

      const result = compatibility.defaultZodStringHandler(stringSchema);

      expect(result).toBeInstanceOf(z.ZodString);
      expect(result.description).toContain('url');
    });

    it('should handle uuid constraint', () => {
      const stringSchema = z.string().uuid();

      const result = compatibility.defaultZodStringHandler(stringSchema);

      expect(result).toBeInstanceOf(z.ZodString);
      expect(result.description).toContain('uuid');
    });

    it('should handle regex constraint', () => {
      const stringSchema = z.string().regex(/^[A-Z]+$/);

      const result = compatibility.defaultZodStringHandler(stringSchema);

      expect(result).toBeInstanceOf(z.ZodString);
      expect(result.description).toContain('regex');
    });

    it('should preserve checks not in handleChecks', () => {
      const stringSchema = z.string().min(5).max(10);

      const result = compatibility.defaultZodStringHandler(stringSchema, ['min']);

      expect(result).toBeInstanceOf(z.ZodString);
      expect(result.description).toContain('minLength');
    });
  });

  describe('defaultZodNumberHandler', () => {
    it('should handle number with min/max constraints', () => {
      const numberSchema = z.number().min(0).max(100);

      const result = compatibility.defaultZodNumberHandler(numberSchema);

      expect(result).toBeInstanceOf(z.ZodNumber);
      expect(result.description).toContain('gte');
      expect(result.description).toContain('lte');
    });

    it('should handle exclusive min/max', () => {
      const numberSchema = z.number().gt(0).lt(100);

      const result = compatibility.defaultZodNumberHandler(numberSchema);

      expect(result).toBeInstanceOf(z.ZodNumber);
      expect(result.description).toContain('gt');
      expect(result.description).toContain('lt');
    });

    it('should handle multipleOf constraint', () => {
      const numberSchema = z.number().multipleOf(5);

      const result = compatibility.defaultZodNumberHandler(numberSchema);

      expect(result).toBeInstanceOf(z.ZodNumber);
      expect(result.description).toContain('multipleOf');
    });

    it('should preserve int and finite checks', () => {
      const numberSchema = z.number().int().finite();
      const result = compatibility.defaultZodNumberHandler(numberSchema);
      expect(result).toBeInstanceOf(z.ZodNumber);
      expect(result._def.checks).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: 'int' }), expect.objectContaining({ kind: 'finite' })]),
      );
    });
  });

  describe('defaultZodDateHandler', () => {
    it('should convert date to string with date-time format', () => {
      const dateSchema = z.date();

      const result = compatibility.defaultZodDateHandler(dateSchema);

      expect(result).toBeInstanceOf(z.ZodString);
      expect(result.description).toContain('date-time');
      expect(result.description).toContain('dateFormat');
    });

    it('should handle date with min/max constraints', () => {
      const minDate = new Date('2023-01-01');
      const maxDate = new Date('2023-12-31');
      const dateSchema = z.date().min(minDate).max(maxDate);

      const result = compatibility.defaultZodDateHandler(dateSchema);

      expect(result).toBeInstanceOf(z.ZodString);
      expect(result.description).toContain('minDate');
      expect(result.description).toContain('maxDate');
      expect(result.description).toContain('2023-01-01');
      expect(result.description).toContain('2023-12-31');
    });
  });

  describe('defaultZodOptionalHandler', () => {
    it('should handle optional string', () => {
      const optionalSchema = z.string().optional();

      class TestCompatibility extends MockSchemaCompatibility {
        processZodType(value: z.ZodTypeAny): any {
          if (value._def.typeName === 'ZodString') {
            return z.string().describe('processed');
          }
          return value;
        }
      }

      const testCompat = new TestCompatibility(mockModel);
      const result = testCompat.defaultZodOptionalHandler(optionalSchema);

      expect(result._def.typeName).toBe('ZodOptional');
    });

    it('should return original value for unsupported types', () => {
      const optionalNever = z.never().optional();

      const result = compatibility.defaultZodOptionalHandler(optionalNever, ['ZodString']);

      expect(result).toBe(optionalNever);
    });
  });
});
