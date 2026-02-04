import { jsonSchema as aiSdkJsonSchema } from '@internal/ai-v6';
import { type } from 'arktype';
import type { JSONSchema7 } from 'json-schema';
import { describe, it, expect } from 'vitest';
import zDefault from 'zod';
import z3 from 'zod/v3';
import z4 from 'zod/v4';
import {
  toStandardSchema,
  isStandardSchema,
  isStandardJSONSchema,
  isStandardSchemaWithJSON,
  standardSchemaToJSONSchema,
} from './standard-schema';

// Detect if the default 'zod' import is v4 (not aliased to v3 by vitest)
// When running under the v3 vitest project, 'zod' is aliased to 'zod-v3'
const isDefaultZodV4 = '_zod' in zDefault.string();

// ============================================================================
// Test Fixtures
// ============================================================================

// Zod v3 schemas
const zodV3StringSchema = z3.string();
const zodV3ObjectSchema = z3.object({
  name: z3.string(),
  age: z3.number(),
});
const zodV3ArraySchema = z3.array(z3.string());
const zodV3OptionalSchema = z3.object({
  required: z3.string(),
  optional: z3.string().optional(),
});

// Zod v4 schemas
const zodV4StringSchema = z4.string();
const zodV4ObjectSchema = z4.object({
  name: z4.string(),
  age: z4.number(),
});
const zodV4ArraySchema = z4.array(z4.string());
const zodV4OptionalSchema = z4.object({
  required: z4.string(),
  optional: z4.string().optional(),
});

// ArkType schemas
const arkTypeStringSchema = type('string');
const arkTypeObjectSchema = type({
  name: 'string',
  age: 'number',
});
const arkTypeArraySchema = type('string[]');
const arkTypeOptionalSchema = type({
  required: 'string',
  'optional?': 'string',
});

// AI SDK jsonSchema schemas
const aiSdkStringSchema = aiSdkJsonSchema({ type: 'string' });
const aiSdkObjectSchema = aiSdkJsonSchema({
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['name', 'age'],
});
const aiSdkArraySchema = aiSdkJsonSchema({
  type: 'array',
  items: { type: 'string' },
});

// Plain JSON Schema objects
const jsonSchemaString: JSONSchema7 = { type: 'string' };
const jsonSchemaObject: JSONSchema7 = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['name', 'age'],
};
const jsonSchemaArray: JSONSchema7 = {
  type: 'array',
  items: { type: 'string' },
};

// ============================================================================
// Tests for isStandardSchema
// ============================================================================

describe('isStandardSchema', () => {
  describe('with Zod v3', () => {
    it('should return true for Zod v3 schemas (native StandardSchema support)', () => {
      expect(isStandardSchema(zodV3StringSchema)).toBe(true);
      expect(isStandardSchema(zodV3ObjectSchema)).toBe(true);
      expect(isStandardSchema(zodV3ArraySchema)).toBe(true);
    });

    it('should return true for wrapped Zod v3 schemas', () => {
      const wrapped = toStandardSchema(zodV3ObjectSchema);
      expect(isStandardSchema(wrapped)).toBe(true);
    });
  });

  describe('with Zod v4 (default zod export)', () => {
    // Note: The default 'zod' export in v3.x is essentially the same as 'zod/v3'
    // Both implement StandardSchema but NOT StandardJSONSchema natively
    it('should return true for Zod v4 schemas (native StandardSchema support)', () => {
      expect(isStandardSchema(zodV4StringSchema)).toBe(true);
      expect(isStandardSchema(zodV4ObjectSchema)).toBe(true);
      expect(isStandardSchema(zodV4ArraySchema)).toBe(true);
    });

    it('should return true for wrapped Zod v4 schemas', () => {
      const wrapped = toStandardSchema(zodV4ObjectSchema);
      expect(isStandardSchema(wrapped)).toBe(true);
    });
  });

  describe('with ArkType', () => {
    it('should return true for ArkType schemas (native StandardSchema support)', () => {
      expect(isStandardSchema(arkTypeStringSchema)).toBe(true);
      expect(isStandardSchema(arkTypeObjectSchema)).toBe(true);
      expect(isStandardSchema(arkTypeArraySchema)).toBe(true);
    });
  });

  describe('with AI SDK jsonSchema', () => {
    it('should return true for AI SDK jsonSchema wrapped schemas', () => {
      const wrapped = toStandardSchema(aiSdkStringSchema);
      expect(isStandardSchema(wrapped)).toBe(true);
    });

    it('should return false for unwrapped AI SDK jsonSchema schemas', () => {
      // AI SDK Schema doesn't implement StandardSchema natively
      expect(isStandardSchema(aiSdkStringSchema)).toBe(false);
    });
  });

  describe('with plain JSON Schema', () => {
    it('should return true for wrapped JSON Schema objects', () => {
      const wrapped = toStandardSchema(jsonSchemaString);
      expect(isStandardSchema(wrapped)).toBe(true);
    });

    it('should return false for plain JSON Schema objects', () => {
      expect(isStandardSchema(jsonSchemaString)).toBe(false);
      expect(isStandardSchema(jsonSchemaObject)).toBe(false);
    });
  });

  describe('with invalid values', () => {
    it('should return false for null and undefined', () => {
      expect(isStandardSchema(null)).toBe(false);
      expect(isStandardSchema(undefined)).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isStandardSchema('string')).toBe(false);
      expect(isStandardSchema(123)).toBe(false);
      expect(isStandardSchema(true)).toBe(false);
    });

    it('should return false for empty objects', () => {
      expect(isStandardSchema({})).toBe(false);
    });

    it('should return false for objects with incomplete ~standard property', () => {
      expect(isStandardSchema({ '~standard': {} })).toBe(false);
      expect(isStandardSchema({ '~standard': { version: 1 } })).toBe(false);
      expect(isStandardSchema({ '~standard': { version: 1, vendor: 'test' } })).toBe(false);
    });

    it('should return false for objects with wrong version', () => {
      expect(
        isStandardSchema({
          '~standard': { version: 2, vendor: 'test', validate: () => {} },
        }),
      ).toBe(false);
    });
  });
});

// ============================================================================
// Tests for isStandardJSONSchema
// ============================================================================

describe('isStandardJSONSchema', () => {
  describe('with Zod v3', () => {
    it('should return false for unwrapped Zod v3 schemas (no native JSON Schema support)', () => {
      expect(isStandardJSONSchema(zodV3StringSchema)).toBe(false);
      expect(isStandardJSONSchema(zodV3ObjectSchema)).toBe(false);
    });

    it('should return true for wrapped Zod v3 schemas', () => {
      const wrapped = toStandardSchema(zodV3ObjectSchema);
      expect(isStandardJSONSchema(wrapped)).toBe(true);
    });
  });

  describe('with Zod v4 (default zod export)', () => {
    // Note: The default 'zod' export in v3.x does NOT implement StandardJSONSchema natively
    it.skipIf(!isDefaultZodV4)('should return true for unwrapped Zod v4 schemas (native JSON Schema support)', () => {
      expect(isStandardJSONSchema(zodV4StringSchema)).toBe(true);
      expect(isStandardJSONSchema(zodV4ObjectSchema)).toBe(true);
    });

    it.skipIf(!isDefaultZodV4)('should return true for wrapped Zod v4 schemas', () => {
      const wrapped = toStandardSchema(zodV4ObjectSchema);
      expect(isStandardJSONSchema(wrapped)).toBe(true);
    });
  });

  describe('with ArkType', () => {
    it('should return true for ArkType schemas (native StandardJSONSchema support)', () => {
      expect(isStandardJSONSchema(arkTypeStringSchema)).toBe(true);
      expect(isStandardJSONSchema(arkTypeObjectSchema)).toBe(true);
    });
  });

  describe('with AI SDK jsonSchema', () => {
    it('should return true for wrapped AI SDK jsonSchema schemas', () => {
      const wrapped = toStandardSchema(aiSdkStringSchema);
      expect(isStandardJSONSchema(wrapped)).toBe(true);
    });

    it('should return false for unwrapped AI SDK jsonSchema schemas', () => {
      expect(isStandardJSONSchema(aiSdkStringSchema)).toBe(false);
    });
  });

  describe('with plain JSON Schema', () => {
    it('should return true for wrapped JSON Schema objects', () => {
      const wrapped = toStandardSchema(jsonSchemaString);
      expect(isStandardJSONSchema(wrapped)).toBe(true);
    });

    it('should return false for plain JSON Schema objects', () => {
      expect(isStandardJSONSchema(jsonSchemaString)).toBe(false);
      expect(isStandardJSONSchema(jsonSchemaObject)).toBe(false);
    });
  });

  describe('with invalid values', () => {
    it('should return false for null and undefined', () => {
      expect(isStandardJSONSchema(null)).toBe(false);
      expect(isStandardJSONSchema(undefined)).toBe(false);
    });

    it('should return false for objects without jsonSchema property', () => {
      expect(
        isStandardJSONSchema({
          '~standard': { version: 1, vendor: 'test', validate: () => {} },
        }),
      ).toBe(false);
    });

    it('should return false for objects with incomplete jsonSchema property', () => {
      expect(
        isStandardJSONSchema({
          '~standard': { version: 1, vendor: 'test', jsonSchema: {} },
        }),
      ).toBe(false);
      expect(
        isStandardJSONSchema({
          '~standard': { version: 1, vendor: 'test', jsonSchema: { input: () => {} } },
        }),
      ).toBe(false);
    });
  });
});

// ============================================================================
// Tests for isStandardSchemaWithJSON
// ============================================================================

describe('isStandardSchemaWithJSON', () => {
  describe('with Zod v3', () => {
    it('should return false for unwrapped Zod v3 schemas', () => {
      expect(isStandardSchemaWithJSON(zodV3StringSchema)).toBe(false);
      expect(isStandardSchemaWithJSON(zodV3ObjectSchema)).toBe(false);
    });

    it('should return true for wrapped Zod v3 schemas', () => {
      const wrapped = toStandardSchema(zodV3ObjectSchema);
      expect(isStandardSchemaWithJSON(wrapped)).toBe(true);
    });
  });

  describe('with Zod v4 (default zod export)', () => {
    it.skipIf(!isDefaultZodV4)('should return true for unwrapped Zod v4 schemas', () => {
      expect(isStandardSchemaWithJSON(zodV4StringSchema)).toBe(true);
      expect(isStandardSchemaWithJSON(zodV4ObjectSchema)).toBe(true);
    });

    it.skipIf(!isDefaultZodV4)('should return true for wrapped Zod v4 schemas', () => {
      const wrapped = toStandardSchema(zodV4ObjectSchema);
      expect(isStandardSchemaWithJSON(wrapped)).toBe(true);
    });
  });

  describe('with ArkType', () => {
    it('should return true for ArkType schemas (both interfaces natively)', () => {
      expect(isStandardSchemaWithJSON(arkTypeStringSchema)).toBe(true);
      expect(isStandardSchemaWithJSON(arkTypeObjectSchema)).toBe(true);
    });
  });

  describe('with AI SDK jsonSchema', () => {
    it('should return true for wrapped AI SDK jsonSchema schemas', () => {
      const wrapped = toStandardSchema(aiSdkStringSchema);
      expect(isStandardSchemaWithJSON(wrapped)).toBe(true);
    });

    it('should return false for unwrapped AI SDK jsonSchema schemas', () => {
      expect(isStandardSchemaWithJSON(aiSdkStringSchema)).toBe(false);
    });
  });

  describe('with plain JSON Schema', () => {
    it('should return true for wrapped JSON Schema objects', () => {
      const wrapped = toStandardSchema(jsonSchemaString);
      expect(isStandardSchemaWithJSON(wrapped)).toBe(true);
    });

    it('should return false for plain JSON Schema objects', () => {
      expect(isStandardSchemaWithJSON(jsonSchemaString)).toBe(false);
    });
  });
});

// ============================================================================
// Tests for toStandardSchema
// ============================================================================

describe('toStandardSchema', () => {
  describe('with Zod v3', () => {
    it('should wrap Zod v3 string schema', () => {
      const result = toStandardSchema(zodV3StringSchema);
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });

    it('should wrap Zod v3 object schema', () => {
      const result = toStandardSchema(zodV3ObjectSchema);
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });

    it('should wrap Zod v3 array schema', () => {
      const result = toStandardSchema(zodV3ArraySchema);
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });

    it('should wrap Zod v3 schema with optional fields', () => {
      const result = toStandardSchema(zodV3OptionalSchema);
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });

    it('should validate correctly with wrapped Zod v3 schema', async () => {
      const result = toStandardSchema(zodV3ObjectSchema);
      const validData = { name: 'John', age: 30 };
      const validation = await result['~standard'].validate(validData);
      expect(validation.issues).toBeUndefined();
      if (!validation.issues) {
        expect(validation.value).toEqual(validData);
      }
    });

    it('should return issues for invalid data with wrapped Zod v3 schema', async () => {
      const result = toStandardSchema(zodV3ObjectSchema);
      const invalidData = { name: 123, age: 'not a number' };
      const validation = await result['~standard'].validate(invalidData);
      expect(validation.issues).toBeDefined();
      expect(validation.issues!.length).toBeGreaterThan(0);
    });
  });

  describe('with Zod v4 (default zod export)', () => {
    // Note: The default 'zod' export in v3.x needs wrapping (same as zod/v3)
    it.skipIf(!isDefaultZodV4)('should wrap Zod v4 schema', () => {
      const result = toStandardSchema(zodV4ObjectSchema);
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });

    it.skipIf(!isDefaultZodV4)('should validate correctly with wrapped Zod v4 schema', async () => {
      const result = toStandardSchema(zodV4ObjectSchema);
      const validData = { name: 'John', age: 30 };
      const validation = await result['~standard'].validate(validData);
      expect(validation.issues).toBeUndefined();
      if (!validation.issues) {
        expect(validation.value).toEqual(validData);
      }
    });
  });

  describe('with ArkType', () => {
    it('should return ArkType schema as-is (already StandardSchemaWithJSON)', () => {
      const result = toStandardSchema(arkTypeObjectSchema);
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });

    it('should validate correctly with ArkType schema', async () => {
      const result = toStandardSchema(arkTypeObjectSchema);
      const validData = { name: 'John', age: 30 };
      const validation = await result['~standard'].validate(validData);
      expect(validation.issues).toBeUndefined();
      if (!validation.issues) {
        expect(validation.value).toEqual(validData);
      }
    });
  });

  describe('with AI SDK jsonSchema', () => {
    it('should wrap AI SDK string schema', () => {
      const result = toStandardSchema(aiSdkStringSchema);
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });

    it('should wrap AI SDK object schema', () => {
      const result = toStandardSchema(aiSdkObjectSchema);
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });

    it('should wrap AI SDK array schema', () => {
      const result = toStandardSchema(aiSdkArraySchema);
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });

    it('should validate correctly with wrapped AI SDK schema', async () => {
      const result = toStandardSchema(aiSdkObjectSchema);
      const validData = { name: 'John', age: 30 };
      const validation = await result['~standard'].validate(validData);
      expect(validation.issues).toBeUndefined();
      if (!validation.issues) {
        expect(validation.value).toEqual(validData);
      }
    });
  });

  describe('with plain JSON Schema', () => {
    it('should wrap JSON Schema string', () => {
      const result = toStandardSchema(jsonSchemaString);
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });

    it('should wrap JSON Schema object', () => {
      const result = toStandardSchema(jsonSchemaObject);
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });

    it('should wrap JSON Schema array', () => {
      const result = toStandardSchema(jsonSchemaArray);
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });

    it('should validate correctly with wrapped JSON Schema', async () => {
      const result = toStandardSchema(jsonSchemaObject);
      const validData = { name: 'John', age: 30 };
      const validation = await result['~standard'].validate(validData);
      expect(validation.issues).toBeUndefined();
      if (!validation.issues) {
        expect(validation.value).toEqual(validData);
      }
    });

    it('should return issues for invalid data with wrapped JSON Schema', async () => {
      const result = toStandardSchema(jsonSchemaObject);
      const invalidData = { name: 123, age: 'not a number' };
      const validation = await result['~standard'].validate(invalidData);
      expect(validation.issues).toBeDefined();
      expect(validation.issues!.length).toBeGreaterThan(0);
    });
  });

  describe('idempotency', () => {
    it('should return already wrapped schema as-is', () => {
      const wrapped = toStandardSchema(zodV3ObjectSchema);
      const rewrapped = toStandardSchema(wrapped);
      expect(rewrapped).toBe(wrapped);
    });

    it('should wrap and return Zod v4 schema', () => {
      const result = toStandardSchema(zodV4ObjectSchema);
      // Zod v3.x (default export) needs wrapping
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });

    it('should return ArkType schema as-is', () => {
      const result = toStandardSchema(arkTypeObjectSchema);
      // ArkType already implements StandardSchemaWithJSON
      expect(isStandardSchemaWithJSON(result)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw for non-object values', () => {
      expect(() => toStandardSchema(null as any)).toThrow('Unsupported schema type');
      expect(() => toStandardSchema(undefined as any)).toThrow('Unsupported schema type');
      expect(() => toStandardSchema('string' as any)).toThrow('Unsupported schema type');
      expect(() => toStandardSchema(123 as any)).toThrow('Unsupported schema type');
    });
  });
});

// ============================================================================
// Tests for standardSchemaToJSONSchema
// ============================================================================

describe('standardSchemaToJSONSchema', () => {
  describe('with Zod v3', () => {
    it('should convert wrapped Zod v3 schema to JSON Schema', () => {
      const wrapped = toStandardSchema(zodV3ObjectSchema);
      const result = standardSchemaToJSONSchema(wrapped);

      expect(result.type).toBe('object');
      expect(result.properties).toBeDefined();
      expect(result.properties!.name).toEqual({ type: 'string' });
      expect(result.properties!.age).toEqual({ type: 'number' });
      expect(result.required).toContain('name');
      expect(result.required).toContain('age');
    });

    it('should handle optional fields in Zod v3', () => {
      const wrapped = toStandardSchema(zodV3OptionalSchema);
      const result = standardSchemaToJSONSchema(wrapped);

      expect(result.required).toContain('required');
      expect(result.required).not.toContain('optional');
    });
  });

  describe('with Zod v4', () => {
    it.skipIf(!isDefaultZodV4)('should convert wrapped Zod v4 schema to JSON Schema', () => {
      // Note: Zod v3.x (exported as default from 'zod') doesn't have native StandardJSONSchema
      // so we need to wrap it first
      const wrapped = toStandardSchema(zodV4ObjectSchema);
      const result = standardSchemaToJSONSchema(wrapped);

      expect(result.type).toBe('object');
      expect(result.properties).toBeDefined();
      expect(result.properties!.name).toEqual({ type: 'string' });
      expect(result.properties!.age).toEqual({ type: 'number' });
    });

    it.skipIf(!isDefaultZodV4)('should handle optional fields in Zod v4', () => {
      const wrapped = toStandardSchema(zodV4OptionalSchema);
      const result = standardSchemaToJSONSchema(wrapped);

      expect(result.required).toContain('required');
      expect(result.required).not.toContain('optional');
    });
  });

  describe('with ArkType', () => {
    it('should convert ArkType schema to JSON Schema', () => {
      const result = standardSchemaToJSONSchema(arkTypeObjectSchema);

      expect(result.type).toBe('object');
      expect(result.properties).toBeDefined();
      expect(result.properties!.name).toEqual({ type: 'string' });
      expect(result.properties!.age).toEqual({ type: 'number' });
    });

    it('should handle optional fields in ArkType', () => {
      const result = standardSchemaToJSONSchema(arkTypeOptionalSchema);

      expect(result.required).toContain('required');
      expect(result.required).not.toContain('optional');
    });
  });

  describe('with AI SDK jsonSchema', () => {
    it('should convert wrapped AI SDK schema to JSON Schema', () => {
      const wrapped = toStandardSchema(aiSdkObjectSchema);
      const result = standardSchemaToJSONSchema(wrapped);

      expect(result.type).toBe('object');
      expect(result.properties).toBeDefined();
      expect(result.properties!.name).toEqual({ type: 'string' });
      expect(result.properties!.age).toEqual({ type: 'number' });
    });
  });

  describe('with plain JSON Schema', () => {
    it('should convert wrapped JSON Schema back to JSON Schema', () => {
      const wrapped = toStandardSchema(jsonSchemaObject);
      const result = standardSchemaToJSONSchema(wrapped);

      expect(result.type).toBe('object');
      expect(result.properties).toBeDefined();
      expect(result.properties!.name).toEqual({ type: 'string' });
      expect(result.properties!.age).toEqual({ type: 'number' });
    });
  });

  describe('options', () => {
    it('should use draft-07 target by default', () => {
      const wrapped = toStandardSchema(zodV3ObjectSchema);
      const result = standardSchemaToJSONSchema(wrapped);

      // draft-07 should not have $schema by default from our conversion
      expect(result.type).toBe('object');
    });

    it('should use output io by default', () => {
      const wrapped = toStandardSchema(zodV3ObjectSchema);
      const result = standardSchemaToJSONSchema(wrapped, { io: 'output' });

      expect(result.type).toBe('object');
    });

    it('should support input io option', () => {
      const wrapped = toStandardSchema(zodV3ObjectSchema);
      const result = standardSchemaToJSONSchema(wrapped, { io: 'input' });

      expect(result.type).toBe('object');
    });
  });
});
