import { describe, it, expect } from 'vitest';
import type { ModelInformation } from '../types';
import { OpenAISchemaCompatLayer } from './openai';
import { createSuite, createOpenAISuite } from './test-suite';

describe('GroqSchemaCompatLayer', () => {
  const modelInfo: ModelInformation = {
    provider: 'groq.chat',
    modelId: 'llama-3.1-8b-instant',
    supportsStructuredOutputs: false,
  };

  const layer = new OpenAISchemaCompatLayer(modelInfo);
  createSuite(layer);
  createOpenAISuite(layer);

  describe('shouldApply', () => {
    it.each([
      ['should apply for groq models', 'groq.chat', 'llama-3.1-8b-instant', true],
      ['should apply for groq llama-3.3-70b model', 'groq.chat', 'llama-3.3-70b-versatile', true],
      ['should apply for groq mixtral model', 'groq.chat', 'mixtral-8x7b-32768', true],
      ['should not apply for non-Groq models', 'anthropic', 'claude-3-5-sonnet-20241022', false],
    ] as const)('%s', (_title, provider, modelId, expected) => {
      const modelInfo: ModelInformation = {
        provider,
        modelId,
        supportsStructuredOutputs: false,
      };

      const layer = new OpenAISchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(expected);
    });

    describe('getSchemaTarget', () => {
      it('should return jsonSchema7', () => {
        const modelInfo: ModelInformation = {
          provider: 'groq.chat',
          modelId: 'llama-3.1-8b-instant',
          supportsStructuredOutputs: false,
        };

        const layer = new OpenAISchemaCompatLayer(modelInfo);
        expect(layer.getSchemaTarget()).toBe('jsonSchema7');
      });
    });
  });
});
