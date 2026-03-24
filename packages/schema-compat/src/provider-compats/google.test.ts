import { describe, it, expect } from 'vitest';
import type { ModelInformation } from '../types';
import { GoogleSchemaCompatLayer } from './google';
import { createSuite } from './test-suite';

describe('GoogleSchemaCompatLayer', () => {
  const modelInfo: ModelInformation = {
    provider: 'google',
    modelId: 'gemini-pro',
    supportsStructuredOutputs: false,
  };

  const layer = new GoogleSchemaCompatLayer(modelInfo);
  createSuite(layer);

  describe('shouldApply', () => {
    it('should apply when provider includes google', () => {
      const modelInfo: ModelInformation = {
        provider: 'google',
        modelId: 'gemini-pro',
        supportsStructuredOutputs: false,
      };

      const layer = new GoogleSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
    });

    it('should apply when modelId includes google', () => {
      const modelInfo: ModelInformation = {
        provider: 'vertex-ai',
        modelId: 'google/gemini-1.5-pro',
        supportsStructuredOutputs: false,
      };

      const layer = new GoogleSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
    });

    it('should apply for gemini models via google provider', () => {
      const modelInfo: ModelInformation = {
        provider: 'google',
        modelId: 'gemini-1.5-flash',
        supportsStructuredOutputs: false,
      };

      const layer = new GoogleSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
    });

    it('should not apply for non-Google models', () => {
      const modelInfo: ModelInformation = {
        provider: 'openai',
        modelId: 'gpt-4o',
        supportsStructuredOutputs: false,
      };

      const layer = new GoogleSchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(false);
    });
  });

  describe('getSchemaTarget', () => {
    it('should return jsonSchema7', () => {
      const modelInfo: ModelInformation = {
        provider: 'google',
        modelId: 'gemini-pro',
        supportsStructuredOutputs: false,
      };

      const layer = new GoogleSchemaCompatLayer(modelInfo);
      expect(layer.getSchemaTarget()).toBe('jsonSchema7');
    });
  });
});
