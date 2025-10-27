import { MockLanguageModelV1 } from 'ai/test';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod/v3';
import { SchemaCompatLayer } from './schema-compatibility';
import type { ModelInformation } from './types';

class MockSchemaCompatibility extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  shouldApply(): boolean {
    return true;
  }

  getSchemaTarget() {
    return 'jsonSchema7' as const;
  }

  processZodType(value: z.ZodTypeAny): z.ZodTypeAny {
    if (this.isObj(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (this.isArr(value)) {
      // For these tests, we will handle all checks by converting them to descriptions.
      return this.defaultZodArrayHandler(value, ['min', 'max', 'length']);
    } else if (this.isOptional(value)) {
      return this.defaultZodOptionalHandler(value);
    } else if (this.isUnion(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (this.isString(value)) {
      // Add a marker to confirm it was processed
      return z.string().describe(`${value.description || 'string'}:processed`);
    } else {
      return value;
    }
  }
}

const mockModel = new MockLanguageModelV1({
  modelId: 'test-model',
  defaultObjectGenerationMode: 'json',
});

const constraintsPrefix = `The following constraint hints should be followed, but these constraints are not a schema shape: `;

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
      const constraints = [];

      const result = compatibility.mergeParameterDescription(description, constraints);

      expect(result).toBe(description);
    });

    it('should append constraints to description', () => {
      const description = 'Original description';
      const constraints = ['minimum length 5', 'maximum length 10'];

      const result = compatibility.mergeParameterDescription(description, constraints);

      expect(result).toBe(`Original description\nconstraints: minimum length 5, maximum length 10`);
    });

    it('should handle undefined description with constraints', () => {
      const constraints = ['a valid email'];

      const result = compatibility.mergeParameterDescription(undefined, constraints);

      expect(result).toBe(`constraints: a valid email`);
    });

    it('should handle empty constraints', () => {
      const description = 'Test description';
      const constraints = [];

      const result = compatibility.mergeParameterDescription(description, constraints);

      expect(result).toBe(description);
    });
  });

  describe('defaultZodObjectHandler', () => {
    it('should process object shape correctly and recursively', () => {
      const testSchema = z.object({
        name: z.string().describe('The name'),
        age: z.number(), // not a string, so won't get a description
      });

      const result = compatibility.defaultZodObjectHandler(testSchema) as z.ZodObject<any, any, any>;
      const newShape = result.shape;

      expect(newShape.name).toBeInstanceOf(z.ZodString);
      expect(newShape.name.description).toBe('The name:processed');
      expect(newShape.age.description).toBeUndefined();
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

    it('should preserve strictness', () => {
      const strictSchema = z.object({ name: z.string() }).strict();
      const result = compatibility.defaultZodObjectHandler(strictSchema);
      expect(result._def.unknownKeys).toBe('strict');

      const nonStrictSchema = z.object({ name: z.string() });
      const nonStrictResult = compatibility.defaultZodObjectHandler(nonStrictSchema);
      expect(nonStrictResult._def.unknownKeys).toBe('strip'); // default
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
    it('should handle array with constraints and convert to description', () => {
      const arraySchema = z.array(z.string()).min(2).max(10);
      const result = compatibility.defaultZodArrayHandler(arraySchema);
      expect(result.description).toContain('constraints: minimum length 2, maximum length 10');
    });

    it('should preserve constraints not in handleChecks', () => {
      const arraySchema = z.array(z.string()).min(2).max(10);
      // Only handle 'min', so 'max' should be preserved as a validator
      const result = compatibility.defaultZodArrayHandler(arraySchema, ['min']);

      expect(result.description).toContain('constraints: minimum length 2');
      expect(result.description).not.toContain('constraints: maximum length 10');
      expect(result._def.maxLength?.value).toBe(10); // Preserved
    });

    it('should handle exact length constraint', () => {
      const arraySchema = z.array(z.string()).length(5);
      const result = compatibility.defaultZodArrayHandler(arraySchema);
      expect(result.description).toContain('constraints: exact length 5');
    });

    it('should preserve original description', () => {
      const arraySchema = z.array(z.string()).describe('String array').min(1);
      const result = compatibility.defaultZodArrayHandler(arraySchema);
      expect(result.description).toContain('String array');
      expect(result.description).toContain('constraints: minimum length 1');
    });
  });

  describe('defaultZodUnionHandler', () => {
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

    it('should handle union types and process recursively', () => {
      const unionSchema = z.union([z.string().describe('A string'), z.number()]);
      const result = compatibility.defaultZodUnionHandler(unionSchema) as z.ZodUnion<any>;
      const processedString = result.options[0];
      expect(processedString.description).toBe('A string:processed');
    });

    it('should preserve description', () => {
      const unionSchema = z.union([z.string(), z.number()]).describe('String or number');
      const result = compatibility.defaultZodUnionHandler(unionSchema);
      expect(result.description).toBe('String or number');
    });
  });

  describe('defaultZodStringHandler', () => {
    it('should handle string with length constraints', () => {
      const stringSchema = z.string().min(5).max(10);

      const result = compatibility.defaultZodStringHandler(stringSchema);

      expect(result).toBeInstanceOf(z.ZodString);
      expect(result.description).toContain('constraints: minimum length 5, maximum length 10');
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
      expect(result.description).toContain('constraints: minimum length 5');
    });
  });

  describe('defaultZodNumberHandler', () => {
    it('should handle number with min/max constraints', () => {
      const numberSchema = z.number().min(0).max(100);

      const result = compatibility.defaultZodNumberHandler(numberSchema);

      expect(result).toBeInstanceOf(z.ZodNumber);
      expect(result.description).toContain('constraints: greater than or equal to 0, lower than or equal to 100');
    });

    it('should handle exclusive min/max', () => {
      const numberSchema = z.number().gt(0).lt(100);

      const result = compatibility.defaultZodNumberHandler(numberSchema);

      expect(result).toBeInstanceOf(z.ZodNumber);
      expect(result.description).toContain('constraints: greater than 0, lower than 100');
    });

    it('should handle multipleOf constraint', () => {
      const numberSchema = z.number().multipleOf(5);

      const result = compatibility.defaultZodNumberHandler(numberSchema);

      expect(result).toBeInstanceOf(z.ZodNumber);
      expect(result.description).toContain('constraints: multiple of 5');
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
      expect(result.description).toContain('constraints: Date format is date-time');
    });

    it('should handle date with min/max constraints', () => {
      const minDate = new Date('2023-01-01');
      const maxDate = new Date('2023-12-31');
      const dateSchema = z.date().min(minDate).max(maxDate);

      const result = compatibility.defaultZodDateHandler(dateSchema);

      expect(result).toBeInstanceOf(z.ZodString);
      expect(result.description).toContain('Date must be newer than');
      expect(result.description).toContain('Date must be older than');
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

  describe('Top-level schema processing (processToAISDKSchema)', () => {
    it('should process a simple object schema', () => {
      const objectSchema = z.object({ user: z.string().describe('user name') });
      const result = compatibility.processToAISDKSchema(objectSchema);
      const userProp = result.jsonSchema.properties?.user as any;
      expect(userProp.description).toBe('user name:processed');
    });

    it('should preserve top-level array constraints during processing', () => {
      const arraySchema = z.array(z.string().describe('item')).min(1);

      // In our mock, 'min' is converted to a description.
      const result = compatibility.processToAISDKSchema(arraySchema);

      expect(result.jsonSchema.type).toBe('array');
      expect(result.jsonSchema.description).toContain('minimum length 1');
      // The validator itself should be gone
      expect(
        result.validate?.([
          /* empty array */
        ]).success,
      ).toBe(true);

      // Now test that a constraint is preserved if not handled
      class PreservingMock extends MockSchemaCompatibility {
        processZodType(value: z.ZodTypeAny): z.ZodTypeAny {
          if (value instanceof z.ZodArray) {
            return this.defaultZodArrayHandler(value as any, [
              /* handle nothing */
            ]);
          }
          return super.processZodType(value);
        }
      }
      const preservingCompat = new PreservingMock(mockModel);
      const preservingResult = preservingCompat.processToAISDKSchema(arraySchema);
      expect(preservingResult.jsonSchema.description).toBeUndefined();
      expect(
        preservingResult.validate?.([
          /* empty array */
        ]).success,
      ).toBe(false); // validator preserved
    });

    it('should preserve top-level object constraints (strict)', () => {
      const strictSchema = z.object({ name: z.string() }).strict();
      const result = compatibility.processToAISDKSchema(strictSchema);
      expect(result.jsonSchema.additionalProperties).toBe(false);
    });

    it('should process array of objects, including nested properties', () => {
      const arraySchema = z.array(
        z.object({
          name: z.string().describe('The name'),
          value: z.number().describe('The value'), // number is not processed in our mock
        }),
      );
      const result = compatibility.processToAISDKSchema(arraySchema);
      const items = result.jsonSchema.items as any;
      expect(items.properties.name.description).toBe('The name:processed');
      expect(items.properties.value.description).toBe('The value');
    });

    it('should handle optional object schemas', () => {
      const optionalSchema = z
        .object({
          name: z.string(),
        })
        .optional();

      const result = compatibility.processToAISDKSchema(optionalSchema);
      expect(result.validate!({ name: 'test' }).success).toBe(true);
      expect(result.validate!(undefined).success).toBe(true);

      const jsonSchema = result.jsonSchema;
      const objectDef = (jsonSchema.anyOf as any[])?.find(def => def.type === 'object');
      expect(objectDef.properties.name.description).toBe('string:processed');
    });

    it('should handle optional array schemas', () => {
      const optionalSchema = z.array(z.string()).optional();
      const result = compatibility.processToAISDKSchema(optionalSchema);
      expect(result.validate!(['test']).success).toBe(true);
      expect(result.validate!(undefined).success).toBe(true);

      const jsonSchema = result.jsonSchema;
      const arrayDef = (jsonSchema.anyOf as any[])?.find(def => def.type === 'array');
      const items = arrayDef.items as any;
      expect(items.description).toBe('string:processed');
    });

    it('should handle optional scalar schemas', () => {
      const optionalSchema = z.string().optional();
      const result = compatibility.processToAISDKSchema(optionalSchema);
      expect(result.validate!('test').success).toBe(true);
      expect(result.validate!(undefined).success).toBe(true);

      const jsonSchema = result.jsonSchema;
      const stringDef = (jsonSchema.anyOf as any[])?.find(def => def.type === 'string');
      expect(stringDef.description).toBe('string:processed');
    });
  });
});
