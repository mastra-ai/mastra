import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { OpenAIReasoningSchemaCompatLayer } from './provider-compats/openai-reasoning';
import { OpenAISchemaCompatLayer } from './provider-compats/openai';
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

    // Convert to JSON Schema
    const jsonSchema = layer.processToJSONSchema(schema);

    // OpenAI requires additionalProperties to be either:
    // - false (no additional properties allowed)
    // - true (any additional properties allowed)
    // - an object with a "type" key (typed additional properties)
    // An empty object {} is NOT valid for OpenAI and will cause error:
    // "Invalid schema for function: In context=('additionalProperties',), schema must have a 'type' key."
    const additionalProps = jsonSchema.additionalProperties;

    // Check that additionalProperties is valid for OpenAI
    if (typeof additionalProps === 'object' && additionalProps !== null) {
      // If it's an object, it must have a 'type' key
      expect(additionalProps).toHaveProperty('type');
    } else {
      // Otherwise it should be a boolean (true or false) or undefined
      expect(typeof additionalProps === 'boolean' || additionalProps === undefined).toBe(true);
    }
  });

  it('should produce valid additionalProperties for looseObject schemas', () => {
    // looseObject is equivalent to object().passthrough() in Zod v4
    const schema = z.looseObject({
      queryText: z.string().describe('The query text'),
      topK: z.coerce.number().describe('Number of results'),
    });

    const layer = new OpenAISchemaCompatLayer(modelInfo);

    // Convert to JSON Schema
    const jsonSchema = layer.processToJSONSchema(schema);

    const additionalProps = jsonSchema.additionalProperties;

    if (typeof additionalProps === 'object' && additionalProps !== null) {
      expect(additionalProps).toHaveProperty('type');
    } else {
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
