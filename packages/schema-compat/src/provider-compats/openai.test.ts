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

describe('OpenAISchemaCompatLayer - MCP Tool Optional Fields (Issue #11016)', () => {
  /**
   * This test reproduces the bug reported in GitHub issue #11016:
   * https://github.com/mastra-ai/mastra/issues/11016
   *
   * When MCP tools with optional fields are used with OpenAI models:
   * 1. The JSON Schema from MCP has fields NOT in the "required" array (meaning they're optional)
   * 2. When converted to Zod, these fields become .optional()
   * 3. OpenAI's schema compat layer converts .optional() to .nullable() for strict mode
   * 4. BUT when OpenAI doesn't provide a value for these fields (omits them entirely),
   *    the validation fails with "Required" errors
   *
   * The issue is that the .optional() wrapper is being stripped during processing,
   * making the fields required (but nullable) instead of truly optional.
   */
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4.1',
    supportsStructuredOutputs: false,
  };

  it('should accept omitted optional fields (reproduces issue #11016)', () => {
    // This schema mimics the Perplexity MCP tool from the issue:
    // - systemContent and userContent are required
    // - All other fields are optional (not in required array)
    const schema = z.object({
      frequency_penalty: z.number().gt(0).optional(),
      presence_penalty: z.number().min(-2).max(2).optional(),
      stream: z.boolean().optional(),
      systemContent: z.string(),
      userContent: z.string(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    // When OpenAI calls the tool, it might only provide the required fields
    // and OMIT the optional ones entirely (not pass null, just not include them)
    const result = processed.safeParse({
      systemContent: 'You are a helpful assistant.',
      userContent: 'What is the weather?',
      // frequency_penalty: NOT PROVIDED
      // presence_penalty: NOT PROVIDED
      // stream: NOT PROVIDED
    });

    // This should succeed because these fields are optional
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        systemContent: 'You are a helpful assistant.',
        userContent: 'What is the weather?',
        frequency_penalty: undefined,
        presence_penalty: undefined,
        stream: undefined,
      });
    }
  });

  it('should accept null for optional fields and transform to undefined', () => {
    const schema = z.object({
      frequency_penalty: z.number().gt(0).optional(),
      presence_penalty: z.number().min(-2).max(2).optional(),
      stream: z.boolean().optional(),
      systemContent: z.string(),
      userContent: z.string(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    // When OpenAI passes null for optional fields (as per strict mode)
    const result = processed.safeParse({
      frequency_penalty: null,
      presence_penalty: null,
      stream: null,
      systemContent: 'You are a helpful assistant.',
      userContent: 'What is the weather?',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        systemContent: 'You are a helpful assistant.',
        userContent: 'What is the weather?',
        frequency_penalty: undefined,
        presence_penalty: undefined,
        stream: undefined,
      });
    }
  });

  it('should accept valid values for optional fields', () => {
    const schema = z.object({
      frequency_penalty: z.number().gt(0).optional(),
      presence_penalty: z.number().min(-2).max(2).optional(),
      stream: z.boolean().optional(),
      systemContent: z.string(),
      userContent: z.string(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    // When OpenAI provides values for optional fields
    const result = processed.safeParse({
      frequency_penalty: 0.5,
      presence_penalty: 1.0,
      stream: true,
      systemContent: 'You are a helpful assistant.',
      userContent: 'What is the weather?',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        frequency_penalty: 0.5,
        presence_penalty: 1.0,
        stream: true,
        systemContent: 'You are a helpful assistant.',
        userContent: 'What is the weather?',
      });
    }
  });

  it('should handle Google Calendar MCP schema with optional fields', () => {
    // This schema mimics the events_list tool from Google Calendar MCP
    // where maxAttendees and maxResults are optional integer fields
    const schema = z.object({
      calendarId: z.string(),
      maxAttendees: z.number().int().optional(),
      maxResults: z.number().int().optional(),
      orderBy: z.enum(['startTime', 'updated']).optional(),
      timeMin: z.string().optional(),
      timeMax: z.string().optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    // OpenAI omits optional fields
    const result = processed.safeParse({
      calendarId: 'primary',
      // All optional fields omitted
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.calendarId).toBe('primary');
      expect(result.data.maxAttendees).toBeUndefined();
      expect(result.data.maxResults).toBeUndefined();
    }
  });

  it('should handle mix of omitted and null optional fields', () => {
    const schema = z.object({
      required_field: z.string(),
      optional_string: z.string().optional(),
      optional_number: z.number().optional(),
      optional_boolean: z.boolean().optional(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    // Mix of omitted and null
    const result = processed.safeParse({
      required_field: 'test',
      optional_string: null, // Explicitly null
      // optional_number: omitted
      optional_boolean: null, // Explicitly null
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        required_field: 'test',
        optional_string: undefined,
        optional_number: undefined,
        optional_boolean: undefined,
      });
    }
  });
});
