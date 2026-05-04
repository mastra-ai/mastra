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
    it('should apply for groq models', () => {
      const modelInfo: ModelInformation = {
        provider: 'groq.chat',
        modelId: 'llama-3.1-8b-instant',
        supportsStructuredOutputs: false,
      };

      const layer = new OpenAISchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
    });

    it('should apply for groq llama-3.3-70b model', () => {
      const modelInfo: ModelInformation = {
        provider: 'groq.chat',
        modelId: 'llama-3.3-70b-versatile',
        supportsStructuredOutputs: false,
      };

      const layer = new OpenAISchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
    });

    it('should apply for groq mixtral model', () => {
      const modelInfo: ModelInformation = {
        provider: 'groq.chat',
        modelId: 'mixtral-8x7b-32768',
        supportsStructuredOutputs: false,
      };

      const layer = new OpenAISchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
    });

    it('should not apply for non-Groq models', () => {
      const modelInfo: ModelInformation = {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet-20241022',
        supportsStructuredOutputs: false,
      };

      const layer = new OpenAISchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(false);
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
