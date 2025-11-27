import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ModelInformation } from '../types';
import { OpenAIReasoningSchemaCompatLayer } from './openai-reasoning';

describe('OpenAIReasoningSchemaCompatLayer - Basic Transformations', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'o1',
    supportsStructuredOutputs: false,
  };

  it('should convert optional to nullable with transform', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', age: null });
    expect(result).toEqual({ name: 'John', age: undefined });
  });

  it('should keep nullable as nullable without transform', () => {
    const schema = z.object({
      name: z.string(),
      deletedAt: z.date().nullable(),
    });

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', deletedAt: null });
    expect(result).toEqual({ name: 'John', deletedAt: null });
  });

  it('should handle mix of optional and nullable correctly', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
      deletedAt: z.date().nullable(),
    });

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      name: 'John',
      age: null,
      deletedAt: null,
    });

    expect(result).toEqual({
      name: 'John',
      age: undefined,
      deletedAt: null,
    });
  });
});

describe('OpenAIReasoningSchemaCompatLayer - Complex Types', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'o3',
    supportsStructuredOutputs: false,
  };

  it('should handle .optional().nullable()', () => {
    const schema = z.object({
      name: z.string(),
      value: z.number().optional().nullable(),
    });

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', value: null });
    expect(result).toEqual({ name: 'John', value: undefined });
  });

  it('should handle .nullable().optional()', () => {
    const schema = z.object({
      name: z.string(),
      value: z.number().nullable().optional(),
    });

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', value: null });
    expect(result).toEqual({ name: 'John', value: undefined });
  });

  it('should handle .default() with optional', () => {
    const schema = z.object({
      name: z.string(),
      count: z.number().default(0).optional(),
    });

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({ name: 'John', count: null });
    expect(result).toEqual({ name: 'John', count: undefined });
  });

  it('should handle nested objects with optional fields', () => {
    const schema = z.object({
      name: z.string(),
      metadata: z.object({
        bio: z.string().optional(),
        age: z.number().optional(),
      }),
    });

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    const result = processed.parse({
      name: 'John',
      metadata: { bio: null, age: null },
    });

    expect(result).toEqual({
      name: 'John',
      metadata: { bio: undefined, age: undefined },
    });
  });
});

describe('OpenAIReasoningSchemaCompatLayer - Reasoning Models Detection', () => {
  it('should detect o1 models', () => {
    const modelInfo: ModelInformation = {
      provider: 'openai',
      modelId: 'o1-preview',
      supportsStructuredOutputs: false,
    };

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    expect(layer['isReasoningModel']()).toBe(true);
  });

  it('should detect o3 models', () => {
    const modelInfo: ModelInformation = {
      provider: 'openai',
      modelId: 'o3-mini',
      supportsStructuredOutputs: false,
    };

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    expect(layer['isReasoningModel']()).toBe(true);
  });

  it('should detect o4 models', () => {
    const modelInfo: ModelInformation = {
      provider: 'openai',
      modelId: 'o4',
      supportsStructuredOutputs: false,
    };

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    expect(layer['isReasoningModel']()).toBe(true);
  });

  it('should not detect gpt-4o as reasoning model', () => {
    const modelInfo: ModelInformation = {
      provider: 'openai',
      modelId: 'gpt-4o',
      supportsStructuredOutputs: false,
    };

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    expect(layer['isReasoningModel']()).toBe(false);
  });
});

describe('OpenAIReasoningSchemaCompatLayer - shouldApply', () => {
  it('should apply for reasoning models with structured outputs', () => {
    const modelInfo: ModelInformation = {
      provider: 'openai',
      modelId: 'o1',
      supportsStructuredOutputs: true,
    };

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    expect(layer.shouldApply()).toBe(true);
  });

  it('should apply for reasoning models without structured outputs', () => {
    const modelInfo: ModelInformation = {
      provider: 'openai',
      modelId: 'o1',
      supportsStructuredOutputs: false,
    };

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    expect(layer.shouldApply()).toBe(true);
  });

  it('should not apply for non-reasoning OpenAI models', () => {
    const modelInfo: ModelInformation = {
      provider: 'openai',
      modelId: 'gpt-4o',
      supportsStructuredOutputs: false,
    };

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    expect(layer.shouldApply()).toBe(false);
  });

  it('should not apply for non-OpenAI models', () => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      supportsStructuredOutputs: false,
    };

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    expect(layer.shouldApply()).toBe(false);
  });
});

describe('OpenAIReasoningSchemaCompatLayer - Passthrough Setting', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'o1',
    supportsStructuredOutputs: false,
  };

  it('should strip extra fields by default', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    // Should strip extra fields
    const result = processed.parse({
      name: 'John',
      age: null,
      extraField: 'should be stripped',
    });

    expect(result).toEqual({
      name: 'John',
      age: undefined,
    });
  });

  it('should not allow passthrough even if schema has .passthrough()', () => {
    const schema = z
      .object({
        name: z.string(),
        age: z.number().optional(),
      })
      .passthrough();

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    // Should strip extra fields even though original schema had .passthrough()
    const result = processed.parse({
      name: 'John',
      age: null,
      extraField: 'should be stripped',
    });

    expect(result).toEqual({
      name: 'John',
      age: undefined,
    });
  });
});

describe('OpenAIReasoningSchemaCompatLayer - ZodAny Handling', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'o1',
    supportsStructuredOutputs: false,
  };

  it('should convert ZodAny to string with description', () => {
    const schema = z.object({
      name: z.string(),
      data: z.any(),
    });

    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    const processed = layer.processZodType(schema);

    // Should accept string for any field
    const result = processed.parse({
      name: 'John',
      data: 'some string value',
    });

    expect(result).toEqual({
      name: 'John',
      data: 'some string value',
    });
  });
});
