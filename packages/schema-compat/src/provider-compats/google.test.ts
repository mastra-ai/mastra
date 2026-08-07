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

    it('does not crash on zod v4 record schemas with the buggy zod <= 4.3.6 def shape (#17051)', () => {
      const schema = z.object({ flags: z.record(z.string(), z.boolean()) });
      // Zod v4 < 4.4.0 stores single-arg z.record(valueSchema) in def.keyType
      // and leaves def.valueType undefined, crashing toJSONSchema. Recreate
      // that def shape so the regression is testable on any zod version.
      const def = (schema.shape.flags as any)._zod.def;
      def.keyType = def.valueType;
      def.valueType = undefined;

      const result = applyCompatLayer({
        schema,
        compatLayers: [layer],
        mode: 'aiSdkSchema',
      });

      expect((result.jsonSchema as any).properties.flags.type).toBe('object');
    });

    it('removes non-string enum values from union branches', () => {
      const schema = layer.processToAISDKSchema(
        z.object({
          value: z.union([z.literal(false), z.literal('auto')]),
        }),
      );

      expect((schema.jsonSchema as any).properties.value.anyOf[0].enum).toBeUndefined();
      // const is rewritten to enum by the OpenAPI 3.0 sanitizer
      expect((schema.jsonSchema as any).properties.value.anyOf[1].enum).toEqual(['auto']);
    });
  });

  describe('processToJSONSchema — OpenAPI 3.0 compat (issue #17057)', () => {
    it('rewrites typeless z.any() properties into a permissive anyOf (issue #17325)', () => {
      // z.any() serialises to `{}` (no type), which Gemini rejects via OpenRouter even when
      // the property is optional, producing a misleading "required[0]: property is not defined"
      // error for valid required properties like `prompt`. The property must stay in the schema
      // (the model is expected to fill it, e.g. `resumeData` for tool suspend/resume), so it is
      // rewritten into a permissive anyOf instead of dropped.
      const schema = z.object({
        prompt: z.string().describe('Prompt for the sub-agent'),
        threadId: z.string().nullish().describe('Thread ID'),
        suspendedToolRunId: z.string().nullable().optional().describe('Suspended run ID'),
        resumeData: z.any().optional().describe('Resume data'),
      });

      const result = layer.processToJSONSchema(schema) as Record<string, any>;

      // Valid required + optional typed properties survive.
      expect(result.properties.prompt.type).toBe('string');
      expect(result.required).toContain('prompt');
      expect(result.properties.threadId).toBeDefined();
      expect(result.properties.suspendedToolRunId).toBeDefined();

      // The typeless property is kept and given a Gemini-compatible permissive shape.
      const resumeData = result.properties.resumeData;
      expect(resumeData).toBeDefined();
      expect(resumeData.type).toBeUndefined();
      expect(resumeData.nullable).toBe(true);
      expect(resumeData.anyOf.map((v: any) => v.type)).toEqual([
        'string',
        'number',
        'integer',
        'boolean',
        'object',
        'array',
      ]);
      expect(resumeData.description).toBe('Resume data');
    });

    it('gives the permissive anyOf array branch a Gemini-valid items schema', () => {
      // z.any() accepts array values too. Gemini's OpenAPI 3.0 schema requires `items`
      // whenever `type: 'array'` is present, so the array branch needs its own permissive
      // items schema — without it, an array-valued resumeData would fail Gemini's schema
      // validation even though the top-level property allows it.
      const schema = z.object({
        resumeData: z.any().optional().describe('Resume data'),
      });

      const result = layer.processToJSONSchema(schema) as Record<string, any>;
      const arrayBranch = result.properties.resumeData.anyOf.find((v: any) => v.type === 'array');

      expect(arrayBranch).toBeDefined();
      expect(arrayBranch.items).toBeDefined();
      expect(arrayBranch.items.anyOf.map((v: any) => v.type)).toEqual([
        'string',
        'number',
        'integer',
        'boolean',
        'object',
      ]);
    });

    it('rewrites oneOf to anyOf for discriminated unions', () => {
      const schema = z.object({
        event: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('click'), x: z.number() }),
          z.object({ kind: z.literal('hover'), seconds: z.number() }),
        ]),
      });

      const result = layer.processToJSONSchema(schema) as Record<string, any>;
      const json = JSON.stringify(result);

      // Must not contain oneOf
      expect(json).not.toContain('"oneOf"');
      // Must contain anyOf for the union
      expect(result.properties.event).toHaveProperty('anyOf');
      expect(result.properties.event.anyOf).toHaveLength(2);
    });

    it('rewrites const to enum for literal types', () => {
      const schema = z.object({ mode: z.literal('strict') });

      const result = layer.processToJSONSchema(schema) as Record<string, any>;
      const json = JSON.stringify(result);

      // Must not contain const
      expect(json).not.toContain('"const"');
      // mode should have enum: ['strict']
      expect(result.properties.mode.enum).toEqual(['strict']);
    });

    it('collapses nullable types', () => {
      const schema = z.object({ name: z.string().nullable() });

      const result = layer.processToJSONSchema(schema) as Record<string, any>;

      // Should collapse to type: 'string', nullable: true
      expect(result.properties.name.type).toBe('string');
      expect(result.properties.name.nullable).toBe(true);
      expect(result.properties.name.anyOf).toBeUndefined();
    });

    it('converts tuple items from array form to single anyOf schema', () => {
      const schema = z.object({ coords: z.tuple([z.number(), z.string()]) });

      const result = layer.processToJSONSchema(schema) as Record<string, any>;

      // items should be a single schema with anyOf, not an array
      expect(Array.isArray(result.properties.coords.items)).toBe(false);
      expect(result.properties.coords.items).toHaveProperty('anyOf');
    });

    it('strips $schema, additionalProperties, and propertyNames', () => {
      const schema = z.object({ name: z.string() });

      const result = layer.processToJSONSchema(schema) as Record<string, any>;
      const json = JSON.stringify(result);

      expect(json).not.toContain('"$schema"');
      expect(json).not.toContain('"additionalProperties"');
      expect(json).not.toContain('"propertyNames"');
    });

    it('inlines $ref and drops definitions for recursive schemas', () => {
      const Category: z.ZodType<{ name: string; children: any[] }> = z.object({
        name: z.string(),
        children: z.lazy(() => z.array(Category)),
      });

      const result = layer.processToJSONSchema(Category) as Record<string, any>;
      const json = JSON.stringify(result);

      // Must not contain $ref or definitions
      expect(json).not.toContain('"$ref"');
      expect(json).not.toContain('"definitions"');
      expect(json).not.toContain('"$defs"');
      // Should still have the basic structure
      expect(result.type).toBe('object');
      expect(result.properties.name.type).toBe('string');
      // children should be an array with items collapsed to { type: 'object' } for self-ref
      expect(result.properties.children.type).toBe('array');
    });

    it('handles record types by stripping additionalProperties', () => {
      const schema = z.object({ tags: z.record(z.string(), z.string()) });

      const result = layer.processToJSONSchema(schema) as Record<string, any>;
      const json = JSON.stringify(result);

      // additionalProperties should be stripped (record semantics become open shape)
      expect(json).not.toContain('"additionalProperties"');
    });

    it('handles type arrays from external JSON Schema input', () => {
      const result = applyCompatLayer({
        schema: {
          type: 'object',
          properties: {
            value: { type: ['string', 'null'] },
          },
        } as any,
        compatLayers: [layer],
        mode: 'jsonSchema',
      });

      expect((result as any).properties.value.type).toBe('string');
      expect((result as any).properties.value.nullable).toBe(true);
    });

    it('rewrites multi-non-null type arrays into a nullable anyOf', () => {
      // Gemini can't represent `type: ['string', 'number', 'null']` as a single
      // OpenAPI 3.0 type. Emit an `anyOf` of the per-type variants (the shape Gemini
      // accepts) plus `nullable: true` for the null member, rather than dropping
      // `type` and leaving the property typeless.
      const result = applyCompatLayer({
        schema: {
          type: 'object',
          properties: {
            value: { type: ['string', 'number', 'null'] },
          },
        } as any,
        compatLayers: [layer],
        mode: 'jsonSchema',
      });

      const value = (result as any).properties.value;
      expect(value.type).toBeUndefined();
      expect(value.nullable).toBe(true);
      expect(value.anyOf.map((v: any) => v.type)).toEqual(['string', 'number']);
    });

    it('types a required multi-type property instead of leaving it typeless', () => {
      // A required property with a multi-type array (e.g. from a raw JSON Schema / MCP
      // tool) is exempt from the optional-strip, so before this fix it reached Gemini
      // typeless and still triggered the INVALID_ARGUMENT 400.
      const result = applyCompatLayer({
        schema: {
          type: 'object',
          properties: {
            resumeData: {
              description: 'Resume data',
              type: ['string', 'number', 'integer', 'boolean', 'object', 'null'],
            },
          },
          required: ['resumeData'],
        } as any,
        compatLayers: [layer],
        mode: 'jsonSchema',
      });

      const resumeData = (result as any).properties.resumeData;
      expect(resumeData.type).toBeUndefined();
      expect(resumeData.nullable).toBe(true);
      expect(resumeData.anyOf.map((v: any) => v.type)).toEqual(['string', 'number', 'integer', 'boolean', 'object']);
      expect((result as any).required).toContain('resumeData');
    });
  });
});
