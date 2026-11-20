import { describe, expect, it } from 'vitest';
import type { ModelInformation } from '../types';
import { OpenAIReasoningSchemaCompatLayer } from './openai-reasoning';
import { createSuite, createOpenAISuite } from './test-suite';

describe('OpenAIReasoningSchemaCompatLayer', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'o1',
    supportsStructuredOutputs: false,
  };

  const compat = new OpenAIReasoningSchemaCompatLayer(modelInfo);
  createSuite(compat);
  createOpenAISuite(compat);

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

    it('should apply for @ai-sdk/azure reasoning models', () => {
      const layer = new OpenAIReasoningSchemaCompatLayer({
        provider: 'azure.responses',
        modelId: 'o3-mini',
        supportsStructuredOutputs: false,
      });
      expect(layer.shouldApply()).toBe(true);
    });

    it.each([
      ['azure.responses', 'my-o3-deployment'],
      ['azure.responses', 'O4-mini'],
      ['openai', 'ft:o4-mini-2025-04-16:org::abc123'],
    ])('should apply for o-series model ids and deployment names (%s, %s)', (provider, modelId) => {
      const layer = new OpenAIReasoningSchemaCompatLayer({ provider, modelId, supportsStructuredOutputs: false });
      expect(layer.shouldApply()).toBe(true);
    });

    it.each([
      ['azure.chat', 'gpt-4o'],
      ['azure.responses', 'claude-o3-test'],
      ['azure.chat', 'demo1-gpt'],
      ['azure.chat', 'proto3-chat'],
      ['azure.responses', 'solo4'],
      ['azure.deepseek', 'my-o3-deployment'],
    ])('should not apply for other @ai-sdk/azure models (%s, %s)', (provider, modelId) => {
      const layer = new OpenAIReasoningSchemaCompatLayer({ provider, modelId, supportsStructuredOutputs: false });
      expect(layer.shouldApply()).toBe(false);
    });
  });
});
