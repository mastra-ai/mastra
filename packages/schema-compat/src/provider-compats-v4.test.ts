import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { OpenAIReasoningSchemaCompatLayer } from './provider-compats/openai-reasoning';
import type { ModelInformation } from './types';

// Mock the regular 'zod' import to use zod v4
vi.mock('zod', () => ({
  z,
}));

describe('OpenAIReasoningSchemaCompatLayer with Zod v4', () => {
  // Test for issue #7791: TypeError: defaultDef.defaultValue is not a function
  it('should handle schemas with default values correctly', () => {
    const modelInfo: ModelInformation = {
      modelId: 'openai/o3-mini',
      supportsStructuredOutputs: false,
      provider: 'openai',
    };

    const compat = new OpenAIReasoningSchemaCompatLayer(modelInfo);

    // This schema reproduces the exact issue from the bug report
    const schema = z.object({
      force_new_login: z.boolean().default(false).describe('Force a new login'),
      optional_text: z.string().default('default text').describe('Optional text with default'),
      number_with_default: z.number().default(42).describe('Number with default value'),
    });

    // This should not throw "TypeError: defaultDef.defaultValue is not a function"
    const processedSchema = compat.processToAISDKSchema(schema);

    expect(processedSchema).toHaveProperty('jsonSchema');
    expect(processedSchema).toHaveProperty('validate');

    // Test validation with custom data
    const validData = {
      force_new_login: true,
      optional_text: 'custom text',
      number_with_default: 100,
    };

    const validationResult = processedSchema.validate!(validData);
    expect(validationResult).toHaveProperty('success');
    expect(validationResult.success).toBe(true);

    // Test with default values (empty object should use defaults)
    const defaultData = {};
    const defaultValidation = processedSchema.validate!(defaultData);
    expect(defaultValidation).toHaveProperty('success');
    expect(defaultValidation.success).toBe(true);

    // The validated value should include the defaults
    if (defaultValidation.success) {
      expect(defaultValidation.value).toEqual({
        force_new_login: false,
        optional_text: 'default text',
        number_with_default: 42,
      });
    }
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
