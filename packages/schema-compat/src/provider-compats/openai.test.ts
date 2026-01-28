import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ModelInformation } from '../types';
import { OpenAISchemaCompatLayer } from './openai';

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

  it('should not apply for OpenAI models with structured outputs', () => {
    const modelInfo: ModelInformation = {
      provider: 'openai',
      modelId: 'gpt-4o',
      supportsStructuredOutputs: true,
    };

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    expect(layer.shouldApply()).toBe(false);
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
