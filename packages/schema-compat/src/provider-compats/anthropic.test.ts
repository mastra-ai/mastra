import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { standardSchemaToJSONSchema } from '../standard-schema/standard-schema';
import type { ModelInformation } from '../types';
import { AnthropicSchemaCompatLayer } from './anthropic';
import { createSuite } from './test-suite';

describe('AnthropicSchemaCompatLayer', () => {
  const modelInfo: ModelInformation = {
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet',
    supportsStructuredOutputs: false,
  };

  const layer = new AnthropicSchemaCompatLayer(modelInfo);
  createSuite(layer);

  describe('shouldApply', () => {
    it('should apply for Claude models', () => {
      const modelInfo: ModelInformation = {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet',
        supportsStructuredOutputs: false,
      };

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
    });

    it('should apply for claude-3.5-haiku model', () => {
      const modelInfo: ModelInformation = {
        provider: 'anthropic',
        modelId: 'claude-3.5-haiku',
        supportsStructuredOutputs: false,
      };

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
    });

    it('should not apply for non-Claude models', () => {
      const modelInfo: ModelInformation = {
        provider: 'openai',
        modelId: 'gpt-4o',
        supportsStructuredOutputs: false,
      };

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(false);
    });
  });

  describe('getSchemaTarget', () => {
    it('should return jsonSchema7', () => {
      const modelInfo: ModelInformation = {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet',
        supportsStructuredOutputs: false,
      };

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      expect(layer.getSchemaTarget()).toBe('jsonSchema7');
    });
  });

  describe('number bounds', () => {
    it('should strip number bounds from JSON Schema while preserving Zod validation', async () => {
      const schema = z.object({
        score: z.number().min(0).max(1),
      });
      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const compatSchema = layer.processToCompatSchema(schema);
      const jsonSchema = standardSchemaToJSONSchema(compatSchema);
      const schemaJson = JSON.stringify(jsonSchema);

      expect(schemaJson).toContain('score');
      expect(schemaJson).not.toContain('minimum');
      expect(schemaJson).not.toContain('maximum');

      const validResult = await compatSchema['~standard'].validate({ score: 0.5 });
      expect(validResult).toEqual({ value: { score: 0.5 } });

      const invalidResult = await compatSchema['~standard'].validate({ score: 1.2 });
      expect('issues' in invalidResult).toBe(true);
    });
  });
});
