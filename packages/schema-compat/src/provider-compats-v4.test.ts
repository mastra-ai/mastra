import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { OpenAISchemaCompatLayer } from './provider-compats/openai';
import { OpenAIReasoningSchemaCompatLayer } from './provider-compats/openai-reasoning';
import type { ModelInformation } from './types';

// Mock the regular 'zod' import to use zod v4
vi.mock('zod', () => ({
  z,
}));

describe('OpenAIReasoningSchemaCompatLayer with Zod v4', () => {
  it('should handle schemas with default values', () => {
    const modelInfo: ModelInformation = {
      modelId: 'openai/o3-mini',
      supportsStructuredOutputs: false,
      provider: 'openai',
    };

    const compat = new OpenAIReasoningSchemaCompatLayer(modelInfo);

    const schema = z.object({
      force_new_login: z.boolean().default(false).describe('Force a new login'),
      optional_text: z.string().default('default text').describe('Optional text with default'),
      number_with_default: z.number().default(42).describe('Number with default value'),
    });

    let processedSchema: any;
    expect(() => {
      processedSchema = compat.processToAISDKSchema(schema);
    }).not.toThrow();

    expect(processedSchema).toHaveProperty('jsonSchema');
    expect(processedSchema).toHaveProperty('validate');

    // Verify that default values are moved to descriptions
    const jsonSchema = processedSchema.jsonSchema;
    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties).toBeDefined();

    // Check that defaults are included in descriptions
    const forceNewLoginProp = jsonSchema.properties.force_new_login;
    expect(forceNewLoginProp.description).toContain('Force a new login');
    expect(forceNewLoginProp.description).toContain('constraints: the default value is false');

    const optionalTextProp = jsonSchema.properties.optional_text;
    expect(optionalTextProp.description).toContain('Optional text with default');
    expect(optionalTextProp.description).toContain('constraints: the default value is default text');

    const numberProp = jsonSchema.properties.number_with_default;
    expect(numberProp.description).toContain('Number with default value');
    expect(numberProp.description).toContain('the default value is 42');

    const validData = {
      force_new_login: true,
      optional_text: 'custom text',
      number_with_default: 100,
    };

    const validationResult = processedSchema!.validate!(validData);
    expect(validationResult).toHaveProperty('success');
    expect(validationResult.success).toBe(true);
  });

  it('should handle nested schemas with default values', () => {
    const modelInfo: ModelInformation = {
      modelId: 'openai/o3-mini',
      supportsStructuredOutputs: false,
      provider: 'openai',
    };

    const compat = new OpenAIReasoningSchemaCompatLayer(modelInfo);

    const schema = z.object({
      user: z.object({
        name: z.string().default('Anonymous'),
        age: z.number().default(18),
      }),
      settings: z.object({
        notifications: z.boolean().default(true),
      }),
    });

    // This should not throw an error
    const processedSchema = compat.processToAISDKSchema(schema);

    expect(processedSchema).toHaveProperty('jsonSchema');
    expect(processedSchema).toHaveProperty('validate');
  });
});

describe('OpenAISchemaCompatLayer with Zod v4 - Passthrough Schemas', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    supportsStructuredOutputs: false,
  };

  // OpenAI requires additionalProperties to be either:
  // - false (no additional properties allowed)
  // - true (any additional properties allowed)
  // - an object with a "type" key (typed additional properties)
  // An empty object {} is NOT valid for OpenAI and will cause error:
  // "Invalid schema for function: In context=('additionalProperties',), schema must have a 'type' key."
  function expectValidOpenAIAdditionalProperties(additionalProps: unknown) {
    if (typeof additionalProps === 'object' && additionalProps !== null) {
      expect(additionalProps).toHaveProperty('type');
    } else {
      expect(typeof additionalProps === 'boolean' || additionalProps === undefined).toBe(true);
    }
  }

  it('should produce valid additionalProperties for passthrough schemas', () => {
    // This is the pattern used by vectorQueryTool in @mastra/rag
    // See GitHub issue #11823
    const schema = z
      .object({
        queryText: z.string().describe('The query text'),
        topK: z.coerce.number().describe('Number of results'),
      })
      .passthrough();

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const jsonSchema = layer.processToJSONSchema(schema);

    expectValidOpenAIAdditionalProperties(jsonSchema.additionalProperties);
    // Passthrough should convert to true to preserve intent of allowing extra properties
    expect(jsonSchema.additionalProperties).toBe(true);
  });

  it('should produce valid additionalProperties for looseObject schemas', () => {
    // looseObject is equivalent to object().passthrough() in Zod v4
    const schema = z.looseObject({
      queryText: z.string().describe('The query text'),
      topK: z.coerce.number().describe('Number of results'),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const jsonSchema = layer.processToJSONSchema(schema);

    expectValidOpenAIAdditionalProperties(jsonSchema.additionalProperties);
    expect(jsonSchema.additionalProperties).toBe(true);
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

    expectValidOpenAIAdditionalProperties(jsonSchema.additionalProperties);
    expect(jsonSchema.additionalProperties).toBe(true);
  });

  it('should handle nested passthrough objects', () => {
    const schema = z.object({
      outer: z
        .object({
          inner: z.string(),
        })
        .passthrough(),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const jsonSchema = layer.processToJSONSchema(schema);

    expectValidOpenAIAdditionalProperties(jsonSchema.additionalProperties);
    const outerProps = jsonSchema.properties?.outer as any;
    expectValidOpenAIAdditionalProperties(outerProps?.additionalProperties);
    expect(outerProps?.additionalProperties).toBe(true);
  });

  it('should preserve typed catchall with string type', () => {
    // .catchall(z.string()) produces additionalProperties: { type: "string" }
    const schema = z
      .object({
        name: z.string(),
        age: z.number(),
      })
      .catchall(z.string());

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const jsonSchema = layer.processToJSONSchema(schema);

    expectValidOpenAIAdditionalProperties(jsonSchema.additionalProperties);
    expect(jsonSchema.additionalProperties).toEqual({ type: 'string' });
  });

  it('should preserve typed catchall with number type', () => {
    const schema = z
      .object({
        name: z.string(),
      })
      .catchall(z.number());

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const jsonSchema = layer.processToJSONSchema(schema);

    expectValidOpenAIAdditionalProperties(jsonSchema.additionalProperties);
    expect(jsonSchema.additionalProperties).toEqual({ type: 'number' });
  });

  it('should preserve typed catchall with object type', () => {
    // Object catchalls are valid as long as they have proper structure
    const schema = z
      .object({
        id: z.string(),
      })
      .catchall(
        z.object({
          value: z.string(),
          count: z.number(),
        }),
      );

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const jsonSchema = layer.processToJSONSchema(schema);

    expectValidOpenAIAdditionalProperties(jsonSchema.additionalProperties);
    expect(jsonSchema.additionalProperties).toHaveProperty('type', 'object');
    expect(jsonSchema.additionalProperties).toHaveProperty('properties');
  });

  it('should preserve typed catchall with array type', () => {
    const schema = z
      .object({
        name: z.string(),
      })
      .catchall(z.array(z.string()));

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const jsonSchema = layer.processToJSONSchema(schema);

    expectValidOpenAIAdditionalProperties(jsonSchema.additionalProperties);
    expect(jsonSchema.additionalProperties).toHaveProperty('type', 'array');
  });
});

describe('OpenAISchemaCompatLayer with Zod v4 - Optional/Nullable Fields (GitHub #12047)', () => {
  // This test suite verifies that optional/nullable fields produce valid OpenAI JSON schemas.
  // OpenAI requires properties to have a 'type' key, not just 'anyOf'.
  // With Zod v4, z.toJSONSchema() produces anyOf: [{type: X}, {type: "null"}] for nullable,
  // which OpenAI rejects with: "must have a 'type' key"

  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  };

  /**
   * OpenAI requires each property to have a 'type' key.
   * anyOf without a type key is not valid for OpenAI structured outputs.
   */
  function expectValidOpenAIPropertySchema(prop: any) {
    // Property must have a 'type' key OR be a valid anyOf/oneOf that OpenAI accepts
    // For now, we require 'type' to be present
    expect(prop).toHaveProperty('type');
  }

  it('should produce JSON schema with type key for optional string fields', () => {
    // This is the exact pattern used in validation.ts finalResultSchema
    const schema = z.object({
      finalResult: z
        .string()
        .optional()
        .describe('The final result text to return to the user'),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const jsonSchema = layer.processToJSONSchema(schema);

    // finalResult should have a type key, not just anyOf
    const finalResultProp = jsonSchema.properties?.finalResult as any;
    expectValidOpenAIPropertySchema(finalResultProp);
  });

  it('should produce JSON schema with type key for nullable string fields', () => {
    const schema = z.object({
      result: z.string().nullable().describe('A nullable result'),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const jsonSchema = layer.processToJSONSchema(schema);

    const resultProp = jsonSchema.properties?.result as any;
    expectValidOpenAIPropertySchema(resultProp);
  });

  it('should produce JSON schema with type key for optional boolean fields', () => {
    // This is the exact pattern used in validation.ts defaultCompletionSchema
    const schema = z.object({
      isComplete: z.boolean().describe('Whether the task is complete'),
      completionReason: z.string().describe('Explanation'),
      finalResult: z
        .string()
        .optional()
        .describe('The final result text'),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const jsonSchema = layer.processToJSONSchema(schema);

    // All properties should have type keys
    expect(jsonSchema.properties?.isComplete).toHaveProperty('type');
    expect(jsonSchema.properties?.completionReason).toHaveProperty('type');
    expectValidOpenAIPropertySchema(jsonSchema.properties?.finalResult);
  });

  it('should produce JSON schema with type key for nested optional fields', () => {
    const schema = z.object({
      outer: z.object({
        inner: z.string().optional(),
      }),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);
    const jsonSchema = layer.processToJSONSchema(schema);

    const outerProp = jsonSchema.properties?.outer as any;
    const innerProp = outerProp?.properties?.inner as any;
    expectValidOpenAIPropertySchema(innerProp);
  });
});
