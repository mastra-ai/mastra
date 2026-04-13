import type { StandardSchemaV1 } from '@standard-schema/spec';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { standardSchemaToJSONSchema } from '../schema';
import type { SchemaCompatLayer } from '../schema-compatibility';

type SuccessResult<T = unknown> = StandardSchemaV1.SuccessResult<T>;

/**
 * Universal test suite — works for ALL providers.
 * Tests JSON schema generation, shouldApply, passthrough/additionalProperties,
 * ZodIntersection, preserve non-null values, empty objects, valid edge values.
 */
export function createSuite(layer: SchemaCompatLayer) {
  describe('Basic Transformations', () => {
    it('should keep nullable as nullable without transform', () => {
      const schema = z.object({
        name: z.string(),
        deletedAt: z.date().nullable(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ name: 'John', deletedAt: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', deletedAt: null });
    });

    it('should preserve non-null values', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
        deletedAt: z.date().nullable(),
      });

      const processed = layer.processToCompatSchema(schema);

      const date = new Date('2024-01-01');
      const result = processed['~standard'].validate({
        name: 'John',
        age: 25,
        deletedAt: date,
      }) as SuccessResult;

      expect(result.value).toEqual({
        name: 'John',
        age: 25,
        deletedAt: date,
      });
    });
  });

  describe('Nested Objects', () => {
    it('should handle nullable nested objects without transform', () => {
      const schema = z.object({
        name: z.string(),
        metadata: z
          .object({
            createdBy: z.string(),
            updatedBy: z.string().nullable(),
          })
          .nullable(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({
        name: 'John',
        metadata: { createdBy: 'admin', updatedBy: null },
      }) as SuccessResult;

      expect(result.value).toEqual({
        name: 'John',
        metadata: { createdBy: 'admin', updatedBy: null },
      });
    });
  });

  describe('Arrays', () => {
    it('should handle nullable arrays', () => {
      const schema = z.object({
        name: z.string(),
        tags: z.array(z.string()).nullable(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ name: 'John', tags: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', tags: null });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty objects', () => {
      const schema = z.object({});

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({}) as SuccessResult;
      expect(result.value).toEqual({});
    });

    it('should handle 0 as a valid value', () => {
      const schema = z.object({
        count: z.number().optional(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ count: 0 }) as SuccessResult;
      expect(result.value).toEqual({ count: 0 });
    });

    it('should handle false as a valid value', () => {
      const schema = z.object({
        enabled: z.boolean().optional(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ enabled: false }) as SuccessResult;
      expect(result.value).toEqual({ enabled: false });
    });

    it('should handle empty string as a valid value', () => {
      const schema = z.object({
        bio: z.string().optional(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ bio: '' }) as SuccessResult;
      expect(result.value).toEqual({ bio: '' });
    });

    it('should handle empty arrays as valid values', () => {
      const schema = z.object({
        tags: z.array(z.string()).optional(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ tags: [] }) as SuccessResult;
      expect(result.value).toEqual({ tags: [] });
    });
  });

  describe('shouldApply', () => {
    it('should apply for OpenAI models without structured outputs', () => {
      expect(layer.shouldApply()).toBe(true);
    });

    it('should apply for OpenAI models with structured outputs', () => {
      expect(layer.shouldApply()).toBe(true);
    });
  });

  describe('Passthrough/LooseObject Schemas', () => {
    it('should produce valid additionalProperties for passthrough schemas', () => {
      // This is the pattern used by vectorQueryTool in @mastra/rag
      const schema = z
        .object({
          queryText: z.string().describe('The query text'),
          topK: z.coerce.number().describe('Number of results'),
        })
        .passthrough();

      // Convert to JSON Schema
      const jsonSchema = layer.processToJSONSchema(schema);

      // OpenAI requires additionalProperties to be either:
      // - false (no additional properties allowed)
      // - true (any additional properties allowed)
      // - an object with a "type" key (typed additional properties)
      // An empty object {} is NOT valid for OpenAI
      const additionalProps = jsonSchema.additionalProperties;

      if (typeof additionalProps === 'object' && additionalProps !== null) {
        // If it's an object, it must have a 'type' key
        expect(additionalProps).toHaveProperty('type');
      } else {
        // Otherwise it should be a boolean (true or false)
        expect(typeof additionalProps === 'boolean' || additionalProps === undefined).toBe(true);
      }
    });

    it('should handle partial().passthrough() pattern', () => {
      // This pattern is also used in some tools
      const schema = z
        .object({
          City: z.string(),
          Name: z.string(),
          Slug: z.string(),
        })
        .partial()
        .passthrough();

      const jsonSchema = layer.processToJSONSchema(schema);
      const additionalProps = jsonSchema.additionalProperties;

      if (typeof additionalProps === 'object' && additionalProps !== null) {
        expect(additionalProps).toHaveProperty('type');
      } else {
        expect(typeof additionalProps === 'boolean' || additionalProps === undefined).toBe(true);
      }
    });
  });

  describe('ZodIntersection', () => {
    it('should handle simple two-object intersection without throwing', () => {
      const schemaA = z.object({ name: z.string() });
      const schemaB = z.object({ age: z.number() });
      const schema = z.object({ person: schemaA.and(schemaB) });

      expect(() => layer.processToJSONSchema(schema)).not.toThrow();

      const jsonSchema = layer.processToJSONSchema(schema);
      expect(jsonSchema.properties?.person).toBeDefined();
    });

    it('should handle chained .and().and() (three-way merge)', () => {
      const schemaA = z.object({ name: z.string() });
      const schemaB = z.object({ age: z.number() });
      const schemaC = z.object({ email: z.string() });
      const schema = z.object({ person: schemaA.and(schemaB).and(schemaC) });

      expect(layer.processToJSONSchema(schema)).toMatchSnapshot();
    });

    it('should handle intersection inside a parent object', () => {
      const schema = z.object({
        metadata: z.object({ key: z.string() }).and(z.object({ value: z.number() })),
        label: z.string(),
      });

      expect(layer.processToJSONSchema(schema)).toMatchSnapshot();
    });

    it('should handle optional intersection wrapper', () => {
      const schema = z.object({
        data: z
          .object({ a: z.string() })
          .and(z.object({ b: z.number() }))
          .optional(),
      });

      expect(layer.processToJSONSchema(schema)).toMatchSnapshot();
    });

    it('should handle intersection nested inside a union (allOf inside anyOf)', () => {
      const schema = z.object({
        locate: z.object({
          prompt: z.union([
            z.string(),
            z.object({ prompt: z.string() }).and(
              z.object({
                images: z.array(z.object({ name: z.string(), url: z.string() })),
                convertHttpImage2Base64: z.boolean(),
              }),
            ),
          ]),
        }),
      });

      expect(layer.processToJSONSchema(schema)).toMatchSnapshot();
    });
  });
}

/**
 * OpenAI-specific test suite — only for layers that implement #traverse behavior.
 * Tests null→undefined transforms, default value application from null,
 * allPropsRequired, and strict mode compliance.
 */
export function createOpenAISuite(layer: SchemaCompatLayer) {
  describe('Basic Transformations (null→undefined)', () => {
    it('should keep optional with transform', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ name: 'John', age: null }) as SuccessResult;
      expect(result.issues).toBeUndefined();
      expect(result.value).toEqual({ name: 'John', age: undefined });
    });

    it('should handle mix of optional and nullable correctly', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
        email: z.string().optional(),
        deletedAt: z.date().nullable(),
        updatedAt: z.date().nullable(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({
        name: 'John',
        age: null,
        email: null,
        deletedAt: null,
        updatedAt: null,
      }) as SuccessResult;

      expect(result.value).toEqual({
        name: 'John',
        age: undefined,
        email: undefined,
        deletedAt: null,
        updatedAt: null,
      });
    });
  });

  describe('Nested Objects (null→undefined)', () => {
    it('should handle optional fields in nested objects', () => {
      const schema = z.object({
        name: z.string(),
        address: z.object({
          street: z.string(),
          city: z.string().optional(),
          zip: z.string().optional(),
        }),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({
        name: 'John',
        address: { street: '123 Main', city: null, zip: null },
      }) as SuccessResult;

      expect(result.value).toEqual({
        name: 'John',
        address: { street: '123 Main', city: undefined, zip: undefined },
      });
    });

    it('should handle optional nested objects', () => {
      const schema = z.object({
        name: z.string(),
        address: z
          .object({
            street: z.string(),
            city: z.string().optional(),
          })
          .optional(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ name: 'John', address: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', address: undefined });
    });

    it('should handle deeply nested optional fields', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            bio: z.string().optional(),
            settings: z.object({
              theme: z.string().optional(),
              notifications: z.boolean(),
            }),
          }),
        }),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({
        user: {
          profile: {
            bio: null,
            settings: { theme: null, notifications: true },
          },
        },
      }) as SuccessResult;

      expect(result.value).toEqual({
        user: {
          profile: {
            bio: undefined,
            settings: { theme: undefined, notifications: true },
          },
        },
      });
    });
  });

  describe('Arrays (null→undefined)', () => {
    it('should handle optional arrays', () => {
      const schema = z.object({
        name: z.string(),
        tags: z.array(z.string()).optional(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ name: 'John', tags: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', tags: undefined });
    });

    it('should handle arrays with optional items', () => {
      const schema = z.object({
        users: z.array(
          z.object({
            name: z.string(),
            email: z.string().optional(),
          }),
        ),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({
        users: [
          { name: 'John', email: null },
          { name: 'Jane', email: 'jane@example.com' },
        ],
      }) as SuccessResult;

      expect(result.value).toEqual({
        users: [
          { name: 'John', email: undefined },
          { name: 'Jane', email: 'jane@example.com' },
        ],
      });
    });
  });

  describe('Complex Combinations (null→undefined)', () => {
    it('should handle .optional().nullable()', () => {
      const schema = z.object({
        name: z.string(),
        value: z.number().optional().nullable(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ name: 'John', value: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', value: undefined });
    });

    it('should handle .nullable().optional()', () => {
      const schema = z.object({
        name: z.string(),
        value: z.number().nullable().optional(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ name: 'John', value: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', value: undefined });
    });

    it('should handle unions with optional', () => {
      const schema = z.object({
        name: z.string(),
        value: z.union([z.string(), z.number()]).optional(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ name: 'John', value: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', value: undefined });
    });

    it('should handle complex real-world schema', () => {
      const schema = z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
        avatar: z.string().optional(),
        bio: z.string().optional(),
        deletedAt: z.date().nullable(),
        settings: z
          .object({
            theme: z.string().optional(),
            notifications: z.boolean(),
          })
          .optional(),
        tags: z.array(z.string()).optional(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({
        id: '123',
        email: 'john@example.com',
        name: 'John',
        avatar: null,
        bio: null,
        deletedAt: null,
        settings: { theme: null, notifications: true },
        tags: null,
      }) as SuccessResult;

      expect(result.value).toEqual({
        id: '123',
        email: 'john@example.com',
        name: 'John',
        avatar: undefined,
        bio: undefined,
        deletedAt: null,
        settings: { theme: undefined, notifications: true },
        tags: undefined,
      });
    });
  });

  describe('Edge Cases (null→undefined)', () => {
    it('should handle objects with all optional fields', () => {
      const schema = z.object({
        field1: z.string().optional(),
        field2: z.number().optional(),
        field3: z.boolean().optional(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({
        field1: null,
        field2: null,
        field3: null,
      }) as SuccessResult;

      expect(result.value).toEqual({
        field1: undefined,
        field2: undefined,
        field3: undefined,
      });
    });
  });

  describe('Partial Nested Objects (GitHub #11457)', () => {
    // This test suite verifies the behavior related to GitHub issue #11457
    // When a nested object has .partial() applied, all its properties become optional.
    // For OpenAI strict mode, .optional() is converted to .nullable() so fields remain
    // in the JSON schema's required array. The validation layer (validateToolInput in @mastra/core)
    // handles converting undefined → null before validation so the full flow works correctly.
    it('should validate partial nested objects when null is provided for optional fields', () => {
      // This is the schema from the bug report
      const inputSchema = z.object({
        eventId: z.string(),
        request: z
          .object({
            City: z.string(),
            Name: z.string(),
            Slug: z.string(),
          })
          .partial()
          .passthrough(),
        eventImageFile: z.any().optional(),
      });

      // Process through OpenAI compat layer
      const processedSchema = layer.processToCompatSchema(inputSchema);

      // For OpenAI strict mode, optional fields are converted to nullable.
      // When null is provided (as the LLM should do), validation passes and
      // the transform converts null → undefined.
      const testDataWithNull = {
        eventId: '123',
        request: { Name: 'Test', City: null, Slug: null },
        eventImageFile: null,
      };

      const result = processedSchema['~standard'].validate(testDataWithNull) as SuccessResult;
      expect(result.issues).toBeUndefined();
      // Verify the transform converted null → undefined
      const data = result.value as Record<string, any>;
      expect(data.request.City).toBeUndefined();
      expect(data.request.Slug).toBeUndefined();
      expect(data.eventImageFile).toBeUndefined();
    });

    it('should convert null to undefined via transform for optional properties', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      });

      const processed = layer.processToCompatSchema(schema);

      // When null is provided (as the LLM should do for optional fields), validation
      // passes and the transform converts null → undefined
      const result = processed['~standard'].validate({ name: 'John', age: null }) as SuccessResult;

      expect(result.issues).toBeUndefined();
      const data = result.value as Record<string, any>;
      expect(data.name).toBe('John');
      expect(data.age).toBeUndefined(); // null was transformed to undefined
    });

    it('should keep fields in required array for OpenAI strict mode compliance', () => {
      // This test verifies that .optional() fields remain in the required array in the JSON Schema
      // The JSON schema puts all fields in required (for OpenAI strict mode), but validation
      // still uses the original Zod schema which accepts undefined for optional fields.
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      });

      const processed = layer.processToCompatSchema(schema);

      // The JSON schema should have all properties in required
      const jsonSchema = processed['~standard'].jsonSchema.input({ target: 'draft-07' });
      expect(jsonSchema.required).toContain('age');
      expect(jsonSchema.required).toContain('name');

      // But validation against the original schema still accepts omitted optional fields
      const result = processed['~standard'].validate({ name: 'John' }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John' });
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize correctly with JSON.stringify (undefined dropped)', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
        email: z.string().optional(),
        deletedAt: z.date().nullable(),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({
        name: 'John',
        age: null,
        email: null,
        deletedAt: null,
      }) as SuccessResult;

      const json = JSON.stringify(result.value);
      expect(json).toBe('{"name":"John","deletedAt":null}');
    });
  });

  describe('Default Values', () => {
    it('should convert default to nullable with transform that returns default value', () => {
      const schema = z.object({
        name: z.string(),
        confidence: z.number().default(1),
      });

      const processed = layer.processToCompatSchema(schema);

      // When null is passed, should get the default value
      const result = processed['~standard'].validate({ name: 'John', confidence: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', confidence: 1 });
    });

    it('should preserve provided values for default fields', () => {
      const schema = z.object({
        name: z.string(),
        confidence: z.number().default(1),
      });

      const processed = layer.processToCompatSchema(schema);

      // When actual value is passed, should keep it
      const result = processed['~standard'].validate({ name: 'John', confidence: 0.5 }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', confidence: 0.5 });
    });

    it('should handle string defaults', () => {
      const schema = z.object({
        name: z.string(),
        explanation: z.string().default(''),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ name: 'John', explanation: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', explanation: '' });
    });

    it('should handle default with function', () => {
      const schema = z.object({
        name: z.string(),
        createdAt: z.string().default(() => 'default-timestamp'),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ name: 'John', createdAt: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', createdAt: 'default-timestamp' });
    });

    it('should handle multiple default fields', () => {
      const schema = z.object({
        nonEnglish: z.boolean(),
        translated: z.boolean(),
        confidence: z.number().min(0).max(1).default(1),
        explanation: z.string().default(''),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({
        nonEnglish: true,
        translated: true,
        confidence: null,
        explanation: null,
      }) as SuccessResult;

      expect(result.value).toEqual({
        nonEnglish: true,
        translated: true,
        confidence: 1,
        explanation: '',
      });
    });

    it('should handle mix of optional and default fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
        score: z.number().default(0),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({
        name: 'John',
        age: null,
        score: null,
      }) as SuccessResult;

      expect(result.value).toEqual({
        name: 'John',
        age: undefined,
        score: 0,
      });
    });

    it('should handle default with nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          settings: z.object({
            theme: z.string().default('light'),
          }),
        }),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({
        user: {
          name: 'John',
          settings: { theme: null },
        },
      }) as SuccessResult;

      expect(result.value).toEqual({
        user: {
          name: 'John',
          settings: { theme: 'light' },
        },
      });
    });

    it('should handle boolean defaults', () => {
      const schema = z.object({
        name: z.string(),
        enabled: z.boolean().default(false),
        active: z.boolean().default(true),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ name: 'John', enabled: null, active: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', enabled: false, active: true });
    });

    it('should handle array defaults', () => {
      const schema = z.object({
        name: z.string(),
        tags: z.array(z.string()).default([]),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ name: 'John', tags: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', tags: [] });
    });

    it('should handle object defaults', () => {
      const schema = z.object({
        name: z.string(),
        config: z
          .object({
            theme: z.string(),
            size: z.number(),
          })
          .default({ theme: 'dark', size: 12 }),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ name: 'John', config: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', config: { theme: 'dark', size: 12 } });
    });

    it('should preserve 0 value and not replace with default', () => {
      const schema = z.object({
        score: z.number().default(100),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ score: 0 }) as SuccessResult;
      expect(result.value).toEqual({ score: 0 });
    });

    it('should preserve false value and not replace with default', () => {
      const schema = z.object({
        enabled: z.boolean().default(true),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ enabled: false }) as SuccessResult;
      expect(result.value).toEqual({ enabled: false });
    });

    it('should preserve empty string value and not replace with default', () => {
      const schema = z.object({
        bio: z.string().default('No bio provided'),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({ bio: '' }) as SuccessResult;
      expect(result.value).toEqual({ bio: '' });
    });

    it('should handle default in arrays of objects', () => {
      const schema = z.object({
        items: z.array(
          z.object({
            name: z.string(),
            quantity: z.number().default(1),
          }),
        ),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({
        items: [
          { name: 'Apple', quantity: null },
          { name: 'Banana', quantity: 5 },
        ],
      }) as SuccessResult;

      expect(result.value).toEqual({
        items: [
          { name: 'Apple', quantity: 1 },
          { name: 'Banana', quantity: 5 },
        ],
      });
    });

    it('should handle default with nullable inner type', () => {
      const schema = z.object({
        name: z.string(),
        deletedAt: z.string().nullable().default(null),
      });

      const processed = layer.processToCompatSchema(schema);

      // When null is passed, should get the default (which is null)
      const result = processed['~standard'].validate({ name: 'John', deletedAt: null }) as SuccessResult;
      expect(result.value).toEqual({ name: 'John', deletedAt: null });
    });

    it('should handle mix of default, optional, and nullable in same schema', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        nullable: z.string().nullable(),
        withDefault: z.string().default('default'),
      });

      const processed = layer.processToCompatSchema(schema);

      const result = processed['~standard'].validate({
        required: 'value',
        optional: null,
        nullable: null,
        withDefault: null,
      }) as SuccessResult;

      expect(result.value).toEqual({
        required: 'value',
        optional: undefined,
        nullable: null,
        withDefault: 'default',
      });
    });
  });

  // =============================================================================
  // OpenAI strict mode: all properties must be in the `required` array.
  //
  // Two bugs fixed:
  //   1. agent.ts guard skipped compat layer when modelId was falsy
  //   2. processToJSONSchema() didn't ensure all properties were required
  // =============================================================================

  /** processToCompatSchema (structured output path) -> jsonSchema */
  function toJsonViaCompat(schema: any) {
    const processed = layer.processToCompatSchema(schema);
    return standardSchemaToJSONSchema(processed, { io: 'input' });
  }

  /** Check if all properties are in the required array (OpenAI strict mode requirement) */
  function allPropsRequired(jsonSchema: any): { valid: boolean; missing: string[] } {
    if (!jsonSchema.properties) return { valid: true, missing: [] };
    const propKeys = Object.keys(jsonSchema.properties);
    const required = jsonSchema.required || [];
    const missing = propKeys.filter(k => !required.includes(k));
    return { valid: missing.length === 0, missing };
  }

  /** Exact schema from packages/core/src/loop/network/validation.ts:361-368 */
  const defaultCompletionSchema = z.object({
    isComplete: z.boolean().describe('Whether the task is complete'),
    completionReason: z.string().describe('Explanation of why the task is or is not complete'),
    finalResult: z.string().optional().describe('The final result text to return to the user'),
  });

  describe('defaultCompletionSchema', () => {
    it('processToCompatSchema should put all properties in required', () => {
      const json = toJsonViaCompat(defaultCompletionSchema);
      const check = allPropsRequired(json);
      expect(check.valid).toBe(true);
    });

    it('processToCompatSchema should make finalResult accept null', () => {
      const json = toJsonViaCompat(defaultCompletionSchema);
      const finalResult = json.properties!['finalResult'] as any;
      const acceptsNull =
        (Array.isArray(finalResult.type) && finalResult.type.includes('null')) ||
        (finalResult.anyOf && finalResult.anyOf.some((s: any) => s.type === 'null'));
      expect(acceptsNull).toBe(true);
    });
  });

  describe('processToJSONSchema should put all props in required', () => {
    it('optional, optionalWithDefault, and nullish fields should be in required', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        optionalWithDefault: z.string().optional().default('test'),
        nullish: z.string().nullish(),
      });

      const json = layer.processToJSONSchema(schema);
      const check = allPropsRequired(json);
      expect(check.valid).toBe(true);
    });

    it('list_files-like schema should have all fields in required', () => {
      const schema = z.object({
        path: z.string().default('./'),
        maxDepth: z.number().optional().default(3),
        exclude: z.string().optional(),
        pattern: z.union([z.string(), z.array(z.string())]).optional(),
      });

      const json = layer.processToJSONSchema(schema);
      const check = allPropsRequired(json);
      expect(check.valid).toBe(true);
    });

    it('execute_command-like schema with nullish should have all fields in required', () => {
      const schema = z.object({
        command: z.string(),
        timeout: z.number().nullish(),
        cwd: z.string().nullish(),
        background: z.boolean().optional(),
      });

      const json = layer.processToJSONSchema(schema);
      const check = allPropsRequired(json);
      expect(check.valid).toBe(true);
    });
  });

  describe('Workspace tool schemas', () => {
    it('file_stat - no optional fields', () => {
      const schema = z.object({ path: z.string() });
      expect(allPropsRequired(toJsonViaCompat(schema)).valid).toBe(true);
    });

    it('write_file - .optional().default()', () => {
      const schema = z.object({
        path: z.string(),
        content: z.string(),
        overwrite: z.boolean().optional().default(true),
      });
      expect(allPropsRequired(toJsonViaCompat(schema)).valid).toBe(true);
    });

    it('list_files - mixed optional patterns', () => {
      const schema = z.object({
        path: z.string().default('./'),
        maxDepth: z.number().optional().default(3),
        showHidden: z.boolean().optional().default(false),
        dirsOnly: z.boolean().optional().default(false),
        exclude: z.string().optional(),
        extension: z.string().optional(),
        pattern: z.union([z.string(), z.array(z.string())]).optional(),
      });
      expect(allPropsRequired(toJsonViaCompat(schema)).valid).toBe(true);
    });

    it('grep - .optional() and .optional().default() mix', () => {
      const schema = z.object({
        pattern: z.string(),
        path: z.string().optional().default('./'),
        contextLines: z.number().optional().default(0),
        maxCount: z.number().optional(),
        caseSensitive: z.boolean().optional().default(true),
        includeHidden: z.boolean().optional().default(false),
      });
      expect(allPropsRequired(toJsonViaCompat(schema)).valid).toBe(true);
    });

    it('execute_command - .nullish() and .optional()', () => {
      const schema = z.object({
        command: z.string(),
        timeout: z.number().nullish(),
        cwd: z.string().nullish(),
        tail: z.number().nullish(),
        background: z.boolean().optional(),
      });
      expect(allPropsRequired(toJsonViaCompat(schema)).valid).toBe(true);
    });

    it('index - .record().optional()', () => {
      const schema = z.object({
        path: z.string(),
        content: z.string(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      });
      expect(allPropsRequired(toJsonViaCompat(schema)).valid).toBe(true);
    });
  });
}
