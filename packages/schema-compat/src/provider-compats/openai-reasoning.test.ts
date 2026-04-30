import { describe, expect, it } from 'vitest';
import type { ModelInformation } from '../types';
import { OpenAIReasoningSchemaCompatLayer } from './openai-reasoning';
import { createSuite } from './test-suite';

describe('OpenAIReasoningSchemaCompatLayer', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'o1',
    supportsStructuredOutputs: false,
  };

  const compat = new OpenAIReasoningSchemaCompatLayer(modelInfo);
  createSuite(compat);

  describe('shouldApply', () => {
    it('should apply for OpenAI models without structured outputs', () => {
      const modelInfo: ModelInformation = {
        provider: 'openai',
        modelId: 'o4',
        supportsStructuredOutputs: false,
      };

      const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
    });

    it('should apply for OpenAI models with structured outputs', () => {
      const modelInfo: ModelInformation = {
        provider: 'openai',
        modelId: 'o4',
        supportsStructuredOutputs: true,
      };

      const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
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
});
