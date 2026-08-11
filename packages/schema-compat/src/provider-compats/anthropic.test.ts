import { describe, it, expect } from 'vitest';
import { z as zV3 } from 'zod/v3';
import { z } from 'zod/v4';
import { standardSchemaToJSONSchema } from '../standard-schema/standard-schema';
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

  describe('tool input root schemas', () => {
    it('should convert a top-level object union to an object schema', () => {
      const schema = z.union([z.object({ content: z.string() }), z.object({ sourceUrl: z.string().url() })]);

      const jsonSchema = layer.processToJSONSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          content: { type: 'string' },
          sourceUrl: { type: 'string' },
        },
        additionalProperties: false,
      });
      expect(jsonSchema).not.toHaveProperty('anyOf');
      expect(jsonSchema).not.toHaveProperty('oneOf');
      expect(jsonSchema).not.toHaveProperty('allOf');
    });

    it('should preserve differing schemas for shared keys via a property-level anyOf', () => {
      const schema = z.union([
        z.object({ value: z.string(), label: z.string() }),
        z.object({ value: z.number(), label: z.string() }),
      ]);

      const jsonSchema = layer.processToJSONSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          value: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          label: { type: 'string' },
        },
        required: ['value', 'label'],
        additionalProperties: false,
      });
      expect(jsonSchema).not.toHaveProperty('anyOf');
      expect(jsonSchema).not.toHaveProperty('oneOf');
    });
  });

  describe('number bounds', () => {
    it('should strip number bounds from JSON Schema while preserving Zod validation', async () => {
      const schema = z.object({
        score: z.number().min(0).max(1),
      });
      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const compatSchema = layer.processToCompatSchema(schema);
      const jsonSchema = standardSchemaToJSONSchema(compatSchema);
      const schemaJson = JSON.stringify(jsonSchema);

      expect(schemaJson).toContain('score');
      expect(schemaJson).not.toContain('minimum');
      expect(schemaJson).not.toContain('maximum');

      const validResult = await compatSchema['~standard'].validate({ score: 0.5 });
      expect(validResult).toEqual({ value: { score: 0.5 } });

      const invalidResult = await compatSchema['~standard'].validate({ score: 1.2 });
      expect('issues' in invalidResult).toBe(true);
    });
  });

  describe('Haiku string length constraints', () => {
    const haikuModelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3.5-haiku-20241022',
      supportsStructuredOutputs: false,
    };

    it('strips string min/max from JSON Schema and does not enforce them at validation time', async () => {
      const schema = z.object({
        message: z.string().min(10).describe('A message with minimum 10 characters'),
      });
      const layer = new AnthropicSchemaCompatLayer(haikuModelInfo);
      const compatSchema = layer.processToCompatSchema(schema);
      const jsonSchemaOut = standardSchemaToJSONSchema(compatSchema);
      const schemaJson = JSON.stringify(jsonSchemaOut);

      expect(schemaJson).not.toContain('minLength');
      expect(schemaJson).not.toContain('maxLength');

      const shortResult = await compatSchema['~standard'].validate({ message: 'Hi' });
      expect(shortResult).toEqual({ value: { message: 'Hi' } });
    });

    it('preserves cross-field refine validation on Haiku', async () => {
      const schema = z
        .object({
          start: z.number(),
          end: z.number(),
        })
        .refine(value => value.end > value.start, { message: 'end must be greater than start' });

      const layer = new AnthropicSchemaCompatLayer(haikuModelInfo);
      const compatSchema = layer.processToCompatSchema(schema);

      const validResult = await compatSchema['~standard'].validate({ start: 1, end: 10 });
      expect(validResult).toEqual({ value: { start: 1, end: 10 } });

      const invalidResult = await compatSchema['~standard'].validate({ start: 10, end: 1 });
      expect('issues' in invalidResult).toBe(true);
    });

    it('keeps Zod v3 validation synchronous when the compat package uses Zod v4', () => {
      const schema = zV3
        .object({
          email: zV3.string().email().min(100),
        })
        .refine(value => value.email !== 'blocked@example.com');
      const compatSchema = new AnthropicSchemaCompatLayer(haikuModelInfo).processToCompatSchema(schema);

      const validResult = compatSchema['~standard'].validate({ email: 'hello@example.com' });
      expect(validResult).not.toBeInstanceOf(Promise);
      expect(validResult).toEqual({ value: { email: 'hello@example.com' } });

      const invalidFormatResult = compatSchema['~standard'].validate({ email: 'invalid' });
      expect(invalidFormatResult).not.toBeInstanceOf(Promise);
      expect(invalidFormatResult).toHaveProperty('issues');

      const invalidRefineResult = compatSchema['~standard'].validate({ email: 'blocked@example.com' });
      expect(invalidRefineResult).not.toBeInstanceOf(Promise);
      expect(invalidRefineResult).toHaveProperty('issues');
    });

    it('preserves string formats while relaxing only min/max', async () => {
      const schema = z.object({
        email: z.string().email().min(100),
        id: z.string().uuid().max(1),
      });
      const compatSchema = new AnthropicSchemaCompatLayer(haikuModelInfo).processToCompatSchema(schema);

      const validResult = await compatSchema['~standard'].validate({
        email: 'hello@example.com',
        id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(validResult).toEqual({
        value: {
          email: 'hello@example.com',
          id: '123e4567-e89b-12d3-a456-426614174000',
        },
      });

      const invalidResult = await compatSchema['~standard'].validate({ email: 'not-an-email', id: 'not-a-uuid' });
      expect('issues' in invalidResult).toBe(true);
    });

    it('preserves strict and catchall object policies', async () => {
      const strictSchema = z.strictObject({ message: z.string().min(100) });
      const catchallSchema = z.object({ message: z.string().min(100) }).catchall(z.number());
      const layer = new AnthropicSchemaCompatLayer(haikuModelInfo);

      const strictResult = await layer.processToCompatSchema(strictSchema)['~standard'].validate({
        message: 'short',
        extra: true,
      });
      expect('issues' in strictResult).toBe(true);

      const validCatchallResult = await layer.processToCompatSchema(catchallSchema)['~standard'].validate({
        message: 'short',
        extra: 1,
      });
      expect(validCatchallResult).toEqual({ value: { message: 'short', extra: 1 } });

      const invalidCatchallResult = await layer.processToCompatSchema(catchallSchema)['~standard'].validate({
        message: 'short',
        extra: 'invalid',
      });
      expect('issues' in invalidCatchallResult).toBe(true);
    });

    it('preserves nested tuple, record, lazy, and transform behavior', async () => {
      let transformCalls = 0;
      const nestedValue = z.lazy(() =>
        z.object({
          entries: z.record(
            z.string(),
            z.tuple([
              z.string().email().min(100),
              z
                .string()
                .min(100)
                .transform(value => {
                  transformCalls++;
                  return value.toUpperCase();
                }),
            ]),
          ),
        }),
      );
      const compatSchema = new AnthropicSchemaCompatLayer(haikuModelInfo).processToCompatSchema(nestedValue);

      const result = await compatSchema['~standard'].validate({
        entries: { item: ['hello@example.com', 'short'] },
      });
      expect(result).toEqual({ value: { entries: { item: ['hello@example.com', 'SHORT'] } } });
      expect(transformCalls).toBe(1);
    });
  });
});
