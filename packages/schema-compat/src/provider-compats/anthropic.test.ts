import { describe, it, expect } from 'vitest';
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
});
