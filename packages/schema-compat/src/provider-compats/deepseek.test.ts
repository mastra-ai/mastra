import { describe, it, expect } from 'vitest';
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
});
