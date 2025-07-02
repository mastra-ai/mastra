import { MockLanguageModelV1 } from 'ai/test';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  AnthropicSchemaCompatLayer,
  OpenAISchemaCompatLayer,
  OpenAIReasoningSchemaCompatLayer,
  GoogleSchemaCompatLayer,
  DeepSeekSchemaCompatLayer,
  MetaSchemaCompatLayer,
} from './index';

describe('Provider Compatibility Classes', () => {
  const mockModels = {
    anthropic: new MockLanguageModelV1({
      modelId: 'claude-3-sonnet-20240229',
      doGenerate: async () => ({ response: { id: 'test' } }) as any,
    }),
    openai: new MockLanguageModelV1({
      modelId: 'openai/gpt-4',
      doGenerate: async () => ({ response: { id: 'test' } }) as any,
    }),
    openaiReasoning: new MockLanguageModelV1({
      modelId: 'openai/o3-mini',
      doGenerate: async () => ({ response: { id: 'test' } }) as any,
    }),
    google: new MockLanguageModelV1({
      modelId: 'gemini-pro',
      doGenerate: async () => ({ response: { id: 'test' } }) as any,
    }),
    deepseek: new MockLanguageModelV1({
      modelId: 'deepseek-chat',
      doGenerate: async () => ({ response: { id: 'test' } }) as any,
    }),
    meta: new MockLanguageModelV1({
      modelId: 'llama-3.1-405b-instruct',
      doGenerate: async () => ({ response: { id: 'test' } }) as any,
    }),
  };

  describe('AnthropicSchemaCompatLayer', () => {
    it('should apply for Anthropic models', () => {
      const compat = new AnthropicSchemaCompatLayer(mockModels.anthropic);
      expect(compat.shouldApply()).toBe(true);
    });

    it('should not apply for non-Anthropic models', () => {
      const compat = new AnthropicSchemaCompatLayer(mockModels.openai);
      expect(compat.shouldApply()).toBe(false);
    });

    it('should return correct schema target', () => {
      const compat = new AnthropicSchemaCompatLayer(mockModels.anthropic);
      expect(compat.getSchemaTarget()).toBe('jsonSchema7');
    });

    it('should process schemas correctly', () => {
      const compat = new AnthropicSchemaCompatLayer(mockModels.anthropic);
      const schema = z.object({
        text: z.string().min(1).max(100),
        count: z.number().min(1),
      });

      const result = compat.processToAISDKSchema(schema);

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');

      const validData = {
        text: 'Hello, world!',
        count: 10,
      };

      const validationResult = result.validate!(validData);
      expect(typeof validationResult).toBe('object');
      expect(validationResult).toHaveProperty('success');
    });
  });

  describe('OpenAISchemaCompatLayer', () => {
    it('should apply for OpenAI models without structured outputs support', () => {
      const compat = new OpenAISchemaCompatLayer(mockModels.openai);
      expect(compat.shouldApply()).toBe(true);
    });

    it('should return correct schema target', () => {
      const compat = new OpenAISchemaCompatLayer(mockModels.openai);
      expect(compat.getSchemaTarget()).toBe('jsonSchema7');
    });

    it('should process complex schemas', () => {
      const compat = new OpenAISchemaCompatLayer(mockModels.openai);
      const schema = z.object({
        user: z.object({
          name: z.string().email(),
          preferences: z.array(z.enum(['dark', 'light'])),
        }),
        settings: z.record(z.boolean()),
      });

      const result = compat.processToAISDKSchema(schema);

      const validData = {
        user: {
          name: 'John Doe',
          preferences: ['dark'],
        },
        settings: {
          public: true,
          featured: false,
        },
      };

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');

      const validationResult = result.validate!(validData);
      expect(typeof validationResult).toBe('object');
      expect(validationResult).toHaveProperty('success');
    });
  });

  describe('OpenAIReasoningSchemaCompatLayer', () => {
    it('should have consistent behavior', () => {
      const compat = new OpenAIReasoningSchemaCompatLayer(mockModels.openaiReasoning);
      expect(compat.shouldApply()).toBe(true);
    });

    it('should return correct schema target', () => {
      const compat = new OpenAIReasoningSchemaCompatLayer(mockModels.openaiReasoning);
      expect(compat.getSchemaTarget()).toBe('openApi3');
    });
  });

  describe('GoogleSchemaCompatLayer', () => {
    it('should have consistent behavior', () => {
      const compat = new GoogleSchemaCompatLayer(mockModels.google);
      expect(typeof compat.shouldApply()).toBe('boolean');
    });

    it('should return correct schema target', () => {
      const compat = new GoogleSchemaCompatLayer(mockModels.google);
      expect(compat.getSchemaTarget()).toBe('jsonSchema7');
    });

    it('should handle date types correctly', () => {
      const compat = new GoogleSchemaCompatLayer(mockModels.google);
      const schema = z.object({
        startDate: z.date(),
        endDate: z.date().optional(),
        title: z.string(),
      });

      const result = compat.processToAISDKSchema(schema);

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');

      const validData = {
        startDate: new Date(),
        title: 'Hello, world!',
      };

      const validationResult = result.validate!(validData);
      expect(typeof validationResult).toBe('object');
      expect(validationResult).toHaveProperty('success');
    });
  });

  describe('DeepSeekSchemaCompatLayer', () => {
    it('should apply for DeepSeek models', () => {
      const compat = new DeepSeekSchemaCompatLayer(mockModels.deepseek);
      expect(compat.shouldApply()).toBe(true);
    });

    it('should not apply for non-DeepSeek models', () => {
      const compat = new DeepSeekSchemaCompatLayer(mockModels.openai);
      expect(compat.shouldApply()).toBe(false);
    });

    it('should return correct schema target', () => {
      const compat = new DeepSeekSchemaCompatLayer(mockModels.deepseek);
      expect(compat.getSchemaTarget()).toBe('jsonSchema7');
    });

    it('should handle string constraints', () => {
      const compat = new DeepSeekSchemaCompatLayer(mockModels.deepseek);
      const schema = z.object({
        email: z.string().email(),
        url: z.string().url(),
        uuid: z.string().uuid(),
        text: z.string().min(10).max(1000),
      });

      const result = compat.processToAISDKSchema(schema);

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');

      const validData = {
        email: 'john@example.com',
        url: 'https://example.com',
        uuid: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Hello, world!',
      };

      const validationResult = result.validate!(validData);
      expect(typeof validationResult).toBe('object');
      expect(validationResult).toHaveProperty('success');
    });
  });

  describe('MetaSchemaCompatLayer', () => {
    it('should have consistent behavior', () => {
      const compat = new MetaSchemaCompatLayer(mockModels.meta);
      expect(typeof compat.shouldApply()).toBe('boolean');
    });

    it('should return correct schema target', () => {
      const compat = new MetaSchemaCompatLayer(mockModels.meta);
      expect(compat.getSchemaTarget()).toBe('jsonSchema7');
    });

    it('should handle array and union types', () => {
      const compat = new MetaSchemaCompatLayer(mockModels.meta);
      const schema = z.object({
        tags: z.array(z.string()).min(1).max(10),
        status: z.union([z.literal('active'), z.literal('inactive')]),
        priority: z.enum(['low', 'medium', 'high']),
      });

      const result = compat.processToAISDKSchema(schema);

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');

      const validData = {
        tags: ['tag1'],
        status: 'active',
        priority: 'high',
      };

      const validationResult = result.validate!(validData);
      expect(typeof validationResult).toBe('object');
      expect(validationResult).toHaveProperty('success');
    });
  });

  describe('Integration tests', () => {
    it('should handle schema processing across providers', () => {
      const complexSchema = z.object({
        user: z.object({
          name: z.string().min(1).max(100),
          email: z.string().email(),
          age: z.number().min(0).max(120).optional(),
        }),
        preferences: z.object({
          theme: z.enum(['light', 'dark']),
          notifications: z.boolean(),
          language: z.string().regex(/^[a-z]{2}$/),
        }),
        tags: z.array(z.string()).min(1).max(5),
        metadata: z.record(z.union([z.string(), z.number(), z.boolean()])),
        createdAt: z.date(),
        settings: z
          .object({
            public: z.boolean(),
            featured: z.boolean().optional(),
          })
          .optional(),
      });

      const providers = [
        new AnthropicSchemaCompatLayer(mockModels.anthropic),
        new OpenAISchemaCompatLayer(mockModels.openai),
        new OpenAIReasoningSchemaCompatLayer(mockModels.openaiReasoning),
        new GoogleSchemaCompatLayer(mockModels.google),
        new DeepSeekSchemaCompatLayer(mockModels.deepseek),
        new MetaSchemaCompatLayer(mockModels.meta),
      ];

      providers.forEach(provider => {
        const result = provider.processToAISDKSchema(complexSchema);

        expect(result).toHaveProperty('jsonSchema');
        expect(result).toHaveProperty('validate');
        expect(typeof result.validate).toBe('function');

        const validData = {
          user: {
            name: 'John Doe',
            email: 'john@example.com',
          },
          preferences: {
            theme: 'dark' as const,
            notifications: true,
            language: 'en',
          },
          tags: ['tag1'],
          metadata: {
            key1: 'value1',
          },
          createdAt: new Date(),
        };

        const validationResult = result.validate!(validData);
        expect(typeof validationResult).toBe('object');
        expect(validationResult).toHaveProperty('success');
      });
    });
  });
});
