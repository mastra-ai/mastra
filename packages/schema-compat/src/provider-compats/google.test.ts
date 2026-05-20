import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ModelInformation } from '../types';
import { applyCompatLayer } from '../utils';
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

    it('should apply for gemini models via random provider', () => {
      const modelInfo: ModelInformation = {
        provider: 'random',
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

  describe('processToAISDKSchema', () => {
    it('removes JSON Schema type arrays for Gemini compatibility', () => {
      const schema = applyCompatLayer({
        schema: {
          type: 'object',
          properties: {
            nullableString: {
              type: ['string', 'null'],
              description: 'A nullable string',
            },
            jsonValue: {
              type: ['string', 'number', 'integer', 'boolean', 'object', 'null'],
              description: 'A JSON-serializable value',
            },
            literalUnion: {
              anyOf: [
                { type: 'boolean', enum: [false] },
                { type: 'string', enum: ['auto'] },
              ],
            },
          },
        },
        compatLayers: [layer],
        mode: 'aiSdkSchema',
      });

      expect(schema.jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          nullableString: {
            type: 'string',
            nullable: true,
            description: 'A nullable string',
          },
          jsonValue: {},
        },
      });
      expect((schema.jsonSchema as any).properties.jsonValue.type).toBeUndefined();
      expect((schema.jsonSchema as any).properties.jsonValue.nullable).toBeUndefined();
    });

    it('removes non-string enum values from union branches', () => {
      const schema = layer.processToAISDKSchema(
        z.object({
          value: z.union([z.literal(false), z.literal('auto')]),
        }),
      );

      expect((schema.jsonSchema as any).properties.value.anyOf[0].enum).toBeUndefined();
      expect((schema.jsonSchema as any).properties.value.anyOf[1].const).toBe('auto');
    });
  });
});
