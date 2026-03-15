import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ModelInformation } from '../types';
import { isZodType } from '../utils';
import { zodToJsonSchema } from '../zod-to-json';
import { OpenAISchemaCompatLayer } from './openai';
import { OpenAIReasoningSchemaCompatLayer } from './openai-reasoning';

describe('OpenAISchemaCompatLayer - Basic Transformations', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  };

  it('should convert optional to nullable with transform', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', age: null });
    expect(result).toEqual({ name: 'John', age: undefined });
  });

  it('should keep nullable as nullable without transform', () => {
    const schema = z.object({
      name: z.string(),
      deletedAt: z.date().nullable(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', deletedAt: null });
    expect(result).toEqual({ name: 'John', deletedAt: null });
  });

  it('should handle mix of optional and nullable correctly', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
      email: z.string().optional(),
      deletedAt: z.date().nullable(),
      updatedAt: z.date().nullable(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      name: 'John',
      age: null,
      email: null,
      deletedAt: null,
      updatedAt: null,
    });

    expect(result).toEqual({
      name: 'John',
      age: undefined,
      email: undefined,
      deletedAt: null,
      updatedAt: null,
    });
  });

  it('should preserve non-null values', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
      deletedAt: z.date().nullable(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const date = new Date('2024-01-01');
    const result = processed.parse({
      name: 'John',
      age: 25,
      deletedAt: date,
    });

    expect(result).toEqual({
      name: 'John',
      age: 25,
      deletedAt: date,
    });
  });
});

describe('OpenAISchemaCompatLayer - Nested Objects', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  };

  it('should handle optional fields in nested objects', () => {
    const schema = z.object({
      name: z.string(),
      address: z.object({
        street: z.string(),
        city: z.string().optional(),
        zip: z.string().optional(),
      }),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      name: 'John',
      address: { street: '123 Main', city: null, zip: null },
    });

    expect(result).toEqual({
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

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', address: null });
    expect(result).toEqual({ name: 'John', address: undefined });
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

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      user: {
        profile: {
          bio: null,
          settings: { theme: null, notifications: true },
        },
      },
    });

    expect(result).toEqual({
      user: {
        profile: {
          bio: undefined,
          settings: { theme: undefined, notifications: true },
        },
      },
    });
  });

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

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      name: 'John',
      metadata: { createdBy: 'admin', updatedBy: null },
    });

    expect(result).toEqual({
      name: 'John',
      metadata: { createdBy: 'admin', updatedBy: null },
    });
  });
});

describe('OpenAISchemaCompatLayer - Arrays', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  };

  it('should handle optional arrays', () => {
    const schema = z.object({
      name: z.string(),
      tags: z.array(z.string()).optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', tags: null });
    expect(result).toEqual({ name: 'John', tags: undefined });
  });

  it('should handle nullable arrays', () => {
    const schema = z.object({
      name: z.string(),
      tags: z.array(z.string()).nullable(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', tags: null });
    expect(result).toEqual({ name: 'John', tags: null });
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

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      users: [
        { name: 'John', email: null },
        { name: 'Jane', email: 'jane@example.com' },
      ],
    });

    expect(result).toEqual({
      users: [
        { name: 'John', email: undefined },
        { name: 'Jane', email: 'jane@example.com' },
      ],
    });
  });
});

describe('OpenAISchemaCompatLayer - Complex Combinations', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  };

  it('should handle .optional().nullable()', () => {
    const schema = z.object({
      name: z.string(),
      value: z.number().optional().nullable(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', value: null });
    expect(result).toEqual({ name: 'John', value: undefined });
  });

  it('should handle .nullable().optional()', () => {
    const schema = z.object({
      name: z.string(),
      value: z.number().nullable().optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', value: null });
    expect(result).toEqual({ name: 'John', value: undefined });
  });

  it('should handle unions with optional', () => {
    const schema = z.object({
      name: z.string(),
      value: z.union([z.string(), z.number()]).optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', value: null });
    expect(result).toEqual({ name: 'John', value: undefined });
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

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      id: '123',
      email: 'john@example.com',
      name: 'John',
      avatar: null,
      bio: null,
      deletedAt: null,
      settings: { theme: null, notifications: true },
      tags: null,
    });

    expect(result).toEqual({
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

describe('OpenAISchemaCompatLayer - Edge Cases', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  };

  it('should handle empty objects', () => {
    const schema = z.object({});

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({});
    expect(result).toEqual({});
  });

  it('should handle objects with all optional fields', () => {
    const schema = z.object({
      field1: z.string().optional(),
      field2: z.number().optional(),
      field3: z.boolean().optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      field1: null,
      field2: null,
      field3: null,
    });

    expect(result).toEqual({
      field1: undefined,
      field2: undefined,
      field3: undefined,
    });
  });

  it('should handle 0 as a valid value', () => {
    const schema = z.object({
      count: z.number().optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ count: 0 });
    expect(result).toEqual({ count: 0 });
  });

  it('should handle false as a valid value', () => {
    const schema = z.object({
      enabled: z.boolean().optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ enabled: false });
    expect(result).toEqual({ enabled: false });
  });

  it('should handle empty string as a valid value', () => {
    const schema = z.object({
      bio: z.string().optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ bio: '' });
    expect(result).toEqual({ bio: '' });
  });

  it('should handle empty arrays as valid values', () => {
    const schema = z.object({
      tags: z.array(z.string()).optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ tags: [] });
    expect(result).toEqual({ tags: [] });
  });
});

describe('OpenAISchemaCompatLayer - Partial Nested Objects (GitHub #11457)', () => {
  // This test suite verifies the behavior related to GitHub issue #11457
  // When a nested object has .partial() applied, all its properties become optional.
  // For OpenAI strict mode, .optional() is converted to .nullable() so fields remain
  // in the JSON schema's required array. The validation layer (validateToolInput in @mastra/core)
  // handles converting undefined → null before validation so the full flow works correctly.

  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  };

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
    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processedSchema = layer.processZodType(inputSchema);

    // For OpenAI strict mode, optional fields are converted to nullable.
    // When null is provided (as the LLM should do), validation passes and
    // the transform converts null → undefined.
    const testDataWithNull = {
      eventId: '123',
      request: { Name: 'Test', City: null, Slug: null },
      eventImageFile: null,
    };

    const result = processedSchema.safeParse(testDataWithNull);
    expect(result.success).toBe(true);
    if (result.success) {
      // Verify the transform converted null → undefined
      expect(result.data.request.City).toBeUndefined();
      expect(result.data.request.Slug).toBeUndefined();
      expect(result.data.eventImageFile).toBeUndefined();
    }
  });

  it('should convert null to undefined via transform for optional properties', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    // When null is provided (as the LLM should do for optional fields), validation
    // passes and the transform converts null → undefined
    const result = processed.safeParse({ name: 'John', age: null });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('John');
      expect(result.data.age).toBeUndefined(); // null was transformed to undefined
    }
  });

  it('should keep fields in required array for OpenAI strict mode compliance', () => {
    // This test verifies that .optional() fields remain in the required array
    // by checking that the schema rejects omitted fields (undefined) at the schema level.
    // The validation layer (validateToolInput) handles this by converting undefined → null.
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    // At the schema level, undefined is NOT accepted (this is correct for strict mode)
    // The validation layer (validateToolInput in @mastra/core) converts undefined → null
    const result = processed.safeParse({ name: 'John' }); // age is undefined/omitted

    // Schema expects null, not undefined - this is intentional for OpenAI strict mode
    expect(result.success).toBe(false);
  });
});

describe('OpenAISchemaCompatLayer - JSON Serialization', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  };

  it('should serialize correctly with JSON.stringify (undefined dropped)', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
      email: z.string().optional(),
      deletedAt: z.date().nullable(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      name: 'John',
      age: null,
      email: null,
      deletedAt: null,
    });

    const json = JSON.stringify(result);
    expect(json).toBe('{"name":"John","deletedAt":null}');
  });
});

describe('OpenAISchemaCompatLayer - Default Values', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  };

  it('should convert default to nullable with transform that returns default value', () => {
    const schema = z.object({
      name: z.string(),
      confidence: z.number().default(1),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    // When null is passed, should get the default value
    const result = processed.parse({ name: 'John', confidence: null });
    expect(result).toEqual({ name: 'John', confidence: 1 });
  });

  it('should preserve provided values for default fields', () => {
    const schema = z.object({
      name: z.string(),
      confidence: z.number().default(1),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    // When actual value is passed, should keep it
    const result = processed.parse({ name: 'John', confidence: 0.5 });
    expect(result).toEqual({ name: 'John', confidence: 0.5 });
  });

  it('should handle string defaults', () => {
    const schema = z.object({
      name: z.string(),
      explanation: z.string().default(''),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', explanation: null });
    expect(result).toEqual({ name: 'John', explanation: '' });
  });

  it('should handle default with function', () => {
    const schema = z.object({
      name: z.string(),
      createdAt: z.string().default(() => 'default-timestamp'),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', createdAt: null });
    expect(result).toEqual({ name: 'John', createdAt: 'default-timestamp' });
  });

  it('should handle multiple default fields', () => {
    const schema = z.object({
      nonEnglish: z.boolean(),
      translated: z.boolean(),
      confidence: z.number().min(0).max(1).default(1),
      explanation: z.string().default(''),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      nonEnglish: true,
      translated: true,
      confidence: null,
      explanation: null,
    });

    expect(result).toEqual({
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

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      name: 'John',
      age: null,
      score: null,
    });

    expect(result).toEqual({
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

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      user: {
        name: 'John',
        settings: { theme: null },
      },
    });

    expect(result).toEqual({
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

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', enabled: null, active: null });
    expect(result).toEqual({ name: 'John', enabled: false, active: true });
  });

  it('should handle array defaults', () => {
    const schema = z.object({
      name: z.string(),
      tags: z.array(z.string()).default([]),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', tags: null });
    expect(result).toEqual({ name: 'John', tags: [] });
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

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', config: null });
    expect(result).toEqual({ name: 'John', config: { theme: 'dark', size: 12 } });
  });

  it('should preserve 0 value and not replace with default', () => {
    const schema = z.object({
      score: z.number().default(100),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ score: 0 });
    expect(result).toEqual({ score: 0 });
  });

  it('should preserve false value and not replace with default', () => {
    const schema = z.object({
      enabled: z.boolean().default(true),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ enabled: false });
    expect(result).toEqual({ enabled: false });
  });

  it('should preserve empty string value and not replace with default', () => {
    const schema = z.object({
      bio: z.string().default('No bio provided'),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ bio: '' });
    expect(result).toEqual({ bio: '' });
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

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      items: [
        { name: 'Apple', quantity: null },
        { name: 'Banana', quantity: 5 },
      ],
    });

    expect(result).toEqual({
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

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    // When null is passed, should get the default (which is null)
    const result = processed.parse({ name: 'John', deletedAt: null });
    expect(result).toEqual({ name: 'John', deletedAt: null });
  });

  it('should handle mix of default, optional, and nullable in same schema', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
      nullable: z.string().nullable(),
      withDefault: z.string().default('default'),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      required: 'value',
      optional: null,
      nullable: null,
      withDefault: null,
    });

    expect(result).toEqual({
      required: 'value',
      optional: undefined,
      nullable: null,
      withDefault: 'default',
    });
  });
});

describe('OpenAISchemaCompatLayer - shouldApply', () => {
  it('should apply for OpenAI models without structured outputs', () => {
    const modelInfo: ModelInformation = {
      provider: 'openai',
      modelId: 'gpt-4o',
      supportsStructuredOutputs: false,
    };

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    expect(layer.shouldApply()).toBe(true);
  });

  it('should apply for OpenAI models with structured outputs', () => {
    const modelInfo: ModelInformation = {
      provider: 'openai',
      modelId: 'gpt-4o',
      supportsStructuredOutputs: true,
    };

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    expect(layer.shouldApply()).toBe(true);
  });

  it('should not apply for non-OpenAI models', () => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      supportsStructuredOutputs: false,
    };

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    expect(layer.shouldApply()).toBe(false);
  });
});

describe('OpenAISchemaCompatLayer - Passthrough/LooseObject Schemas', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    supportsStructuredOutputs: false,
  };

  it('should produce valid additionalProperties for passthrough schemas', () => {
    // This is the pattern used by vectorQueryTool in @mastra/rag
    const schema = z
      .object({
        queryText: z.string().describe('The query text'),
        topK: z.coerce.number().describe('Number of results'),
      })
      .passthrough();

    const layer = new OpenAISchemaCompatLayer(modelInfo);

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

    const layer = new OpenAISchemaCompatLayer(modelInfo);

    const jsonSchema = layer.processToJSONSchema(schema);

    const additionalProps = jsonSchema.additionalProperties;

    if (typeof additionalProps === 'object' && additionalProps !== null) {
      expect(additionalProps).toHaveProperty('type');
    } else {
      expect(typeof additionalProps === 'boolean' || additionalProps === undefined).toBe(true);
    }
  });
});

// =============================================================================
// OpenAI strict mode: all properties must be in the `required` array.
//
// Two bugs fixed:
//   1. agent.ts guard skipped compat layer when modelId was falsy
//   2. processToJSONSchema() didn't ensure all properties were required
// =============================================================================

/** processZodType (structured output path) -> zodToJsonSchema */
function toJsonViaCompat(schema: any) {
  const compat = new OpenAISchemaCompatLayer({
    provider: 'openai.responses',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  });
  const transformed = compat.processZodType(schema);
  return zodToJsonSchema(transformed);
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

describe('OpenAISchemaCompatLayer - defaultCompletionSchema', () => {
  it('processZodType should put all properties in required', () => {
    const json = toJsonViaCompat(defaultCompletionSchema);
    const check = allPropsRequired(json);
    expect(check.valid).toBe(true);
  });

  it('processZodType should make finalResult accept null', () => {
    const json = toJsonViaCompat(defaultCompletionSchema);
    const finalResult = json.properties!['finalResult'] as any;
    const acceptsNull =
      (Array.isArray(finalResult.type) && finalResult.type.includes('null')) ||
      (finalResult.anyOf && finalResult.anyOf.some((s: any) => s.type === 'null'));
    expect(acceptsNull).toBe(true);
  });
});

describe('OpenAISchemaCompatLayer - shouldApply with undefined modelId', () => {
  it('should not crash and should apply when provider is OpenAI', () => {
    const compat = new OpenAISchemaCompatLayer({
      provider: 'openai.responses',
      modelId: undefined as any,
      supportsStructuredOutputs: false,
    });
    expect(compat.shouldApply()).toBe(true);
  });

  it('should not crash and should return false for non-OpenAI provider', () => {
    const compat = new OpenAISchemaCompatLayer({
      provider: 'anthropic.messages',
      modelId: undefined as any,
      supportsStructuredOutputs: false,
    });
    expect(compat.shouldApply()).toBe(false);
  });
});

describe('OpenAISchemaCompatLayer - processToJSONSchema should put all props in required', () => {
  const openaiCompat = new OpenAISchemaCompatLayer({
    provider: 'openai.responses',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  });

  it('optional, optionalWithDefault, and nullish fields should be in required', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
      optionalWithDefault: z.string().optional().default('test'),
      nullish: z.string().nullish(),
    });

    const json = openaiCompat.processToJSONSchema(schema);
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

    const json = openaiCompat.processToJSONSchema(schema);
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

    const json = openaiCompat.processToJSONSchema(schema);
    const check = allPropsRequired(json);
    expect(check.valid).toBe(true);
  });
});

describe('OpenAISchemaCompatLayer - Workspace tool schemas', () => {
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
      metadata: z.record(z.unknown()).optional(),
    });
    expect(allPropsRequired(toJsonViaCompat(schema)).valid).toBe(true);
  });
});

describe('OpenAISchemaCompatLayer - Zod pattern coverage', () => {
  const patterns: Array<{ name: string; schema: any }> = [
    { name: '.optional()', schema: z.object({ f: z.string().optional() }) },
    { name: '.default()', schema: z.object({ f: z.string().default('x') }) },
    { name: '.optional().default()', schema: z.object({ f: z.string().optional().default('x') }) },
    { name: '.nullable()', schema: z.object({ f: z.string().nullable() }) },
    { name: '.nullish()', schema: z.object({ f: z.string().nullish() }) },
    { name: '.optional() on number', schema: z.object({ f: z.number().optional() }) },
    { name: '.optional() on boolean', schema: z.object({ f: z.boolean().optional() }) },
    { name: '.optional() on enum', schema: z.object({ f: z.enum(['a', 'b']).optional() }) },
    { name: '.optional() on array', schema: z.object({ f: z.array(z.string()).optional() }) },
    { name: '.optional() on object', schema: z.object({ f: z.object({ n: z.string() }).optional() }) },
    { name: '.optional() on union', schema: z.object({ f: z.union([z.string(), z.array(z.string())]).optional() }) },
    { name: '.optional() on record', schema: z.object({ f: z.record(z.unknown()).optional() }) },
  ];

  patterns.forEach(({ name, schema }) => {
    it(`${name}: all fields in required after compat`, () => {
      const check = allPropsRequired(toJsonViaCompat(schema));
      expect(check.valid).toBe(true);
    });
  });
});

describe('OpenAISchemaCompatLayer - Responses API via LiteLLM proxy', () => {
  it('compat layer applies for openai.responses provider', () => {
    const compat = new OpenAISchemaCompatLayer({
      provider: 'openai.responses',
      modelId: 'codex-mini',
      supportsStructuredOutputs: false,
    });
    expect(compat.shouldApply()).toBe(true);
  });

  it('compat layer applies when modelId contains openai (LiteLLM proxy)', () => {
    const compat = new OpenAISchemaCompatLayer({
      provider: 'litellm.chat',
      modelId: 'openai/codex-mini',
      supportsStructuredOutputs: false,
    });
    expect(compat.shouldApply()).toBe(true);
  });

  it('processZodType fixes optional fields for Responses API', () => {
    const schema = z.object({
      result: z.string(),
      confidence: z.number().optional(),
      reasoning: z.string().optional(),
    });

    const compat = new OpenAISchemaCompatLayer({
      provider: 'openai.responses',
      modelId: 'codex-mini',
      supportsStructuredOutputs: false,
    });
    const transformed = compat.processZodType(schema);
    const fixed = allPropsRequired(zodToJsonSchema(transformed));
    expect(fixed.valid).toBe(true);
  });

  it('processToJSONSchema should also produce valid schemas for tool schemas', () => {
    const schema = z.object({
      query: z.string(),
      limit: z.number().optional(),
      tags: z.array(z.string()).optional(),
    });

    const compat = new OpenAISchemaCompatLayer({
      provider: 'openai.responses',
      modelId: 'codex-mini',
      supportsStructuredOutputs: false,
    });
    const json = compat.processToJSONSchema(schema);
    const check = allPropsRequired(json);
    expect(check.valid).toBe(true);
  });
});

// =============================================================================
// Agent network structured output flow simulation
//
// When modelId is falsy (e.g., agent networks), the compat layer must still run.
// execute.ts enables strictJsonSchema independently, so unprocessed schemas get rejected.
// =============================================================================

describe('OpenAISchemaCompatLayer - agent network defaultCompletionSchema with falsy modelId', () => {
  // Exact schema from packages/core/src/loop/network/validation.ts:370-377
  const defaultCompletionSchemaNetwork = z.object({
    isComplete: z.boolean().describe('Whether the task is complete'),
    completionReason: z.string().describe('Explanation of why the task is or is not complete'),
    finalResult: z
      .string()
      .optional()
      .describe('The final result text to return to the user. omit if primitive result is sufficient'),
  });

  /**
   * Simulates the agent.ts structured output flow:
   *   1. Check if provider/modelId includes 'openai'
   *   2. Check isZodType(schema)
   *   3. Construct compat layer, call processZodType()
   *   4. zodToJsonSchema() converts the (possibly transformed) schema
   *   5. strict mode enabled if provider.startsWith('openai')
   */
  function simulateAgentStructuredOutputFlow(schema: any, targetProvider: string, targetModelId: string | undefined) {
    let processedSchema = schema;

    // Optional chaining on targetModelId
    if (targetProvider.includes('openai') || targetModelId?.includes('openai')) {
      // Compat runs even with falsy modelId (no targetModelId guard)
      if (isZodType(schema)) {
        const modelInfo = {
          provider: targetProvider,
          modelId: targetModelId ?? '',
          supportsStructuredOutputs: false,
        };
        const isReasoningModel = /^o[1-5]/.test(targetModelId ?? '');
        const compat = isReasoningModel
          ? new OpenAIReasoningSchemaCompatLayer(modelInfo)
          : new OpenAISchemaCompatLayer(modelInfo);
        if (compat.shouldApply()) {
          processedSchema = compat.processZodType(schema);
        }
      }
    }

    // zodToJsonSchema runs regardless
    const jsonSchema = zodToJsonSchema(processedSchema);

    // Strict mode check is independent of compat layer
    const strictModeEnabled = targetProvider.startsWith('openai');

    return { jsonSchema, strictModeEnabled };
  }

  it('happy path: valid modelId → compat layer runs → schema is strict-mode compliant', () => {
    const { jsonSchema, strictModeEnabled } = simulateAgentStructuredOutputFlow(
      defaultCompletionSchemaNetwork,
      'openai.responses',
      'gpt-4o',
    );
    expect(strictModeEnabled).toBe(true);
    expect(allPropsRequired(jsonSchema).valid).toBe(true);
  });

  it('undefined modelId → compat layer still runs → schema is strict-mode compliant', () => {
    // Agent network with OpenAI, modelId is falsy.
    const { jsonSchema, strictModeEnabled } = simulateAgentStructuredOutputFlow(
      defaultCompletionSchemaNetwork,
      'openai.responses',
      undefined,
    );

    expect(strictModeEnabled).toBe(true);
    expect(allPropsRequired(jsonSchema).valid).toBe(true);
  });

  it('empty string modelId → compat layer still runs → schema is strict-mode compliant', () => {
    const { jsonSchema, strictModeEnabled } = simulateAgentStructuredOutputFlow(
      defaultCompletionSchemaNetwork,
      'openai.responses',
      '',
    );

    expect(strictModeEnabled).toBe(true);
    expect(allPropsRequired(jsonSchema).valid).toBe(true);
  });
});

describe('OpenAISchemaCompatLayer - processToAISDKSchema', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  };

  it('should add additionalProperties: false to nested objects in anyOf (from optional)', () => {
    const schema = z.object({
      name: z.string(),
      importSpec: z
        .object({
          module: z.string(),
          names: z.array(z.string()).min(1),
          isDefault: z.boolean().optional(),
        })
        .optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);

    const aiSdkSchema = layer.processToAISDKSchema(schema);
    const resultSchema = (aiSdkSchema as any).jsonSchema;

    // Root should have additionalProperties: false
    expect(resultSchema.additionalProperties).toBe(false);

    // All properties should be required
    expect(resultSchema.required).toContain('name');
    expect(resultSchema.required).toContain('importSpec');

    // The importSpec should have been processed
    const importSpecSchema = resultSchema.properties?.importSpec;
    expect(importSpecSchema).toBeDefined();

    // Find all object-typed nodes in anyOf and ensure they have additionalProperties: false
    if (importSpecSchema?.anyOf) {
      const objectVariant = importSpecSchema.anyOf.find((s: any) => s.type === 'object' || s.properties);
      if (objectVariant) {
        expect(objectVariant.additionalProperties).toBe(false);
      }
    }
  });

  it('should ensure all properties are required in tool schemas', () => {
    const schema = z.object({
      name: z.string(),
      details: z.string().optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const aiSdkSchema = layer.processToAISDKSchema(schema);

    const jsonSchema = (aiSdkSchema as any).jsonSchema;

    // All properties should be required (OpenAI strict mode)
    expect(jsonSchema.required).toContain('name');
    expect(jsonSchema.required).toContain('details');
  });

  it('should preserve validation in the returned AI SDK schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const aiSdkSchema = layer.processToAISDKSchema(schema);

    // Valid input should pass
    const validResult = aiSdkSchema.validate!({ name: 'John', age: null });
    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.value).toEqual({ name: 'John', age: undefined });
    }

    // Invalid input should fail
    const invalidResult = aiSdkSchema.validate!({ name: 123 });
    expect(invalidResult.success).toBe(false);
  });
});

describe('OpenAISchemaCompatLayer - ZodIntersection', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  };

  it('should handle simple two-object intersection without throwing', () => {
    const schemaA = z.object({ name: z.string() });
    const schemaB = z.object({ age: z.number() });
    const schema = z.object({ person: schemaA.and(schemaB) });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    expect(() => layer.processToJSONSchema(schema)).not.toThrow();

    const jsonSchema = layer.processToJSONSchema(schema);
    expect(jsonSchema.properties?.person).toBeDefined();
  });

  it('should handle chained .and().and() (three-way merge)', () => {
    const schemaA = z.object({ name: z.string() });
    const schemaB = z.object({ age: z.number() });
    const schemaC = z.object({ email: z.string() });
    const schema = z.object({ person: schemaA.and(schemaB).and(schemaC) });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    expect(() => layer.processToJSONSchema(schema)).not.toThrow();
  });

  it('should handle intersection inside a parent object', () => {
    const schema = z.object({
      metadata: z.object({ key: z.string() }).and(z.object({ value: z.number() })),
      label: z.string(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    expect(() => layer.processToJSONSchema(schema)).not.toThrow();
  });

  it('should handle optional intersection wrapper', () => {
    const schema = z.object({
      data: z
        .object({ a: z.string() })
        .and(z.object({ b: z.number() }))
        .optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    expect(() => layer.processToJSONSchema(schema)).not.toThrow();
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

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    expect(() => layer.processToJSONSchema(schema)).not.toThrow();
  });
});
