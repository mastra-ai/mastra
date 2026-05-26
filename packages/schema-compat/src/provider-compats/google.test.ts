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

  describe('OpenAPI 3.0 alignment (issue #17057)', () => {
    it('rewrites oneOf from z.discriminatedUnion to anyOf', () => {
      const schema = z.object({
        shape: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('circle'), r: z.number() }),
          z.object({ kind: z.literal('square'), s: z.number() }),
        ]),
      });

      const out = layer.processToJSONSchema(schema, 'input') as any;

      expect(out.properties.shape.oneOf).toBeUndefined();
      expect(out.properties.shape.anyOf).toHaveLength(2);
      expect(out.properties.shape.anyOf[0].properties.kind).toMatchObject({ type: 'string' });
      expect(out.properties.shape.anyOf[1].properties.kind).toMatchObject({ type: 'string' });
    });

    it('converts string literal const to single-value enum', () => {
      const schema = z.object({ status: z.literal('active') });

      const out = layer.processToJSONSchema(schema, 'input') as any;

      expect(out.properties.status.const).toBeUndefined();
      expect(out.properties.status.enum).toEqual(['active']);
    });

    it('does not emit additionalProperties: false for object schemas', () => {
      const schema = z.object({ name: z.string(), age: z.number() });

      const out = layer.processToJSONSchema(schema, 'input') as any;

      expect(out.additionalProperties).toBeUndefined();
    });

    it('strips propertyNames from z.record output', () => {
      const schema = z.object({ flags: z.record(z.string(), z.boolean()) });

      const out = layer.processToJSONSchema(schema, 'input') as any;

      expect(out.properties.flags.propertyNames).toBeUndefined();
      expect(out.properties.flags.type).toBe('object');
    });

    it('strips $schema', () => {
      const schema = z.object({ name: z.string() });

      const out = layer.processToJSONSchema(schema, 'input') as any;

      expect(out.$schema).toBeUndefined();
    });

    it('collapses anyOf null branch to {nullable: true} on processToJSONSchema', () => {
      const schema = z.object({ count: z.number().nullable() });

      const out = layer.processToJSONSchema(schema, 'input') as any;

      expect(out.properties.count.anyOf).toBeUndefined();
      expect(out.properties.count.type).toBe('number');
      expect(out.properties.count.nullable).toBe(true);
    });

    it('rewrites array-form items from z.tuple to a single-schema anyOf', () => {
      const schema = z.object({ pair: z.tuple([z.string(), z.number()]) });

      const out = layer.processToJSONSchema(schema, 'input') as any;

      // Google's Schema typedef has `items?: Schema` (singular). The array form
      // makes Gemini REST return HTTP 400 ("Proto field is not repeating, cannot start list").
      expect(Array.isArray(out.properties.pair.items)).toBe(false);
      expect(out.properties.pair.items.anyOf).toHaveLength(2);
      expect(out.properties.pair.items.anyOf[0]).toMatchObject({ type: 'string' });
      expect(out.properties.pair.items.anyOf[1]).toMatchObject({ type: 'number' });
    });

    it('inlines $ref and drops definitions for recursive schemas (z.lazy)', () => {
      type Tree = { name: string; children?: Tree[] };
      const tree: z.ZodType<Tree> = z.lazy(() => z.object({ name: z.string(), children: z.array(tree).optional() }));
      const schema = z.object({ root: tree });

      const out = layer.processToJSONSchema(schema, 'input') as any;

      expect(out.definitions).toBeUndefined();
      // Outer ref is inlined to the actual node shape (one expansion).
      expect(out.properties.root.$ref).toBeUndefined();
      expect(out.properties.root.type).toBe('object');
      expect(out.properties.root.properties.name).toMatchObject({ type: 'string' });
      // Inner recursive ref collapses to opaque `{type: 'object'}` (no further `$ref`).
      expect(out.properties.root.properties.children.items.$ref).toBeUndefined();
      expect(out.properties.root.properties.children.items.type).toBe('object');
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
      expect((schema.jsonSchema as any).properties.value.anyOf[1].const).toBeUndefined();
      expect((schema.jsonSchema as any).properties.value.anyOf[1].enum).toEqual(['auto']);
    });
  });
});
