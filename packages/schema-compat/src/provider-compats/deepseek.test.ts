import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ModelInformation } from '../types';
import { DeepSeekSchemaCompatLayer } from './deepseek';
import { createSuite } from './test-suite';

describe('DeepSeekSchemaCompatLayer', () => {
  const modelInfo: ModelInformation = {
    provider: 'deepseek',
    modelId: 'deepseek-chat',
    supportsStructuredOutputs: false,
  };

  const layer = new DeepSeekSchemaCompatLayer(modelInfo);
  createSuite(layer);

  describe('shouldApply', () => {
    it('should apply for deepseek models', () => {
      const modelInfo: ModelInformation = {
        provider: 'deepseek',
        modelId: 'deepseek-chat',
        supportsStructuredOutputs: false,
      };

      const layer = new DeepSeekSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
    });

    it('should apply for deepseek-coder model', () => {
      const modelInfo: ModelInformation = {
        provider: 'deepseek',
        modelId: 'deepseek-coder',
        supportsStructuredOutputs: false,
      };

      const layer = new DeepSeekSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
    });

    it('should NOT apply for deepseek-r1 model', () => {
      const modelInfo: ModelInformation = {
        provider: 'deepseek',
        modelId: 'deepseek-r1',
        supportsStructuredOutputs: false,
      };

      const layer = new DeepSeekSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(false);
    });

    it('should NOT apply for deepseek-r1-distill model', () => {
      const modelInfo: ModelInformation = {
        provider: 'deepseek',
        modelId: 'deepseek-r1-distill-llama-70b',
        supportsStructuredOutputs: false,
      };

      const layer = new DeepSeekSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(false);
    });

    it('should not apply for non-DeepSeek models', () => {
      const modelInfo: ModelInformation = {
        provider: 'openai',
        modelId: 'gpt-4o',
        supportsStructuredOutputs: false,
      };

      const layer = new DeepSeekSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(false);
    });
  });

  describe('getSchemaTarget', () => {
    it('should return jsonSchema7', () => {
      const modelInfo: ModelInformation = {
        provider: 'deepseek',
        modelId: 'deepseek-chat',
        supportsStructuredOutputs: false,
      };

      const layer = new DeepSeekSchemaCompatLayer(modelInfo);
      expect(layer.getSchemaTarget()).toBe('jsonSchema7');
    });
  });

  describe('number constraint handling', () => {
    it('strips the safe-integer bounds that z.number().int() emits', () => {
      const schema = z.object({ count: z.number().int() });

      const layer = new DeepSeekSchemaCompatLayer(modelInfo);
      const count = (layer.toJSONSchema(schema).properties as Record<string, any>).count;

      // Without the number handler these leak as minimum: -9007199254740991 /
      // maximum: 9007199254740991, which is meaningless noise for the model.
      expect(count.type).toBe('integer');
      expect(count.minimum).toBeUndefined();
      expect(count.maximum).toBeUndefined();
    });

    it('moves numeric min/max into the description instead of leaking keywords', () => {
      const schema = z.object({ score: z.number().min(1).max(50) });

      const layer = new DeepSeekSchemaCompatLayer(modelInfo);
      const score = (layer.toJSONSchema(schema).properties as Record<string, any>).score;

      expect(score.minimum).toBeUndefined();
      expect(score.maximum).toBeUndefined();
      expect(score.description).toContain('greater than or equal to 1');
      expect(score.description).toContain('lower than or equal to 50');
    });
  });
});
