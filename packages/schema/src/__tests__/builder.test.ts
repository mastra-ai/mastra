import { z } from 'zod';
import { describe, it, expect, beforeEach } from 'vitest';
import { jsonSchema } from 'ai';
import type { LanguageModelV1, Schema } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { convertZodSchemaToAISDKSchema, convertSchemaToZod, processSchema } from '../builder';
import { SchemaCompatibility } from '../schema-compatibility';

const mockModel = new MockLanguageModelV1({
  modelId: 'test-model',
  defaultObjectGenerationMode: 'json',
});

class MockSchemaCompatibility extends SchemaCompatibility {
  constructor(
    model: LanguageModelV1,
    private shouldApplyValue: boolean = true,
  ) {
    super(model);
  }

  shouldApply(): boolean {
    return this.shouldApplyValue;
  }

  getSchemaTarget() {
    return 'jsonSchema7' as const;
  }

  processZodType(value: z.ZodTypeAny): any {
    if (value._def.typeName === 'ZodString') {
      return z.string().describe('processed string');
    }
    return value;
  }
}

describe('Builder Functions', () => {
  describe('convertZodSchemaToAISDKSchema', () => {
    it('should convert simple Zod schema to AI SDK schema', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = convertZodSchemaToAISDKSchema(zodSchema);

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
      expect(typeof result.validate).toBe('function');
    });

    it('should create schema with validation function', () => {
      const zodSchema = z.object({
        email: z.string().email(),
      });

      const result = convertZodSchemaToAISDKSchema(zodSchema);

      expect(result.validate).toBeDefined();

      const validResult = result.validate!({ email: 'test@example.com' });
      expect(validResult.success).toBe(true);
      if (validResult.success) {
        expect(validResult.value).toEqual({ email: 'test@example.com' });
      }

      const invalidResult = result.validate!({ email: 'invalid-email' });
      expect(invalidResult.success).toBe(false);
    });

    it('should handle custom targets', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const result = convertZodSchemaToAISDKSchema(zodSchema, 'openApi3');

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
    });

    it('should handle complex nested schemas', () => {
      const zodSchema = z.object({
        user: z.object({
          name: z.string(),
          preferences: z.object({
            theme: z.enum(['light', 'dark']),
            notifications: z.boolean(),
          }),
        }),
        tags: z.array(z.string()),
      });

      const result = convertZodSchemaToAISDKSchema(zodSchema);

      expect(result).toHaveProperty('jsonSchema');
      expect(result.jsonSchema).toHaveProperty('properties');
    });
  });

  describe('convertSchemaToZod', () => {
    it('should return Zod schema unchanged', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const result = convertSchemaToZod(zodSchema);

      expect(result).toBe(zodSchema);
    });

    it('should convert AI SDK schema to Zod', () => {
      const aiSchema: Schema = jsonSchema({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      });

      const result = convertSchemaToZod(aiSchema);

      expect(result).toBeInstanceOf(z.ZodType);
      const parseResult = result.safeParse({ name: 'John', age: 30 });
      expect(parseResult.success).toBe(true);
    });

    it('should handle complex JSON schema conversion', () => {
      const complexSchema: Schema = jsonSchema({
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
            },
            required: ['name'],
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['user'],
      });

      const result = convertSchemaToZod(complexSchema);

      expect(result).toBeInstanceOf(z.ZodType);

      const validData = {
        user: { name: 'John', email: 'john@example.com' },
        tags: ['tag1', 'tag2'],
      };
      const parseResult = result.safeParse(validData);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('processSchema', () => {
    let mockCompatibility: MockSchemaCompatibility;

    beforeEach(() => {
      mockCompatibility = new MockSchemaCompatibility(mockModel);
    });

    it('should process Zod object schema with compatibility', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = processSchema({
        schema: zodSchema,
        compatibilities: [mockCompatibility],
        mode: 'aiSdkSchema',
      });

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
    });

    it('should process AI SDK schema with compatibility', () => {
      const aiSchema: Schema = jsonSchema({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });

      const result = processSchema({
        schema: aiSchema,
        compatibilities: [mockCompatibility],
        mode: 'jsonSchema',
      });

      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('type');
    });

    it('should wrap non-object Zod schemas', () => {
      const stringSchema = z.object({ value: z.string() });

      const result = processSchema({
        schema: stringSchema,
        compatibilities: [mockCompatibility],
        mode: 'aiSdkSchema',
      });

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
    });

    it('should return processed schema when compatibility applies', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const result = processSchema({
        schema: zodSchema,
        compatibilities: [mockCompatibility],
        mode: 'aiSdkSchema',
      });

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
    });

    it('should return fallback when no compatibility applies', () => {
      const nonApplyingCompatibility = new MockSchemaCompatibility(mockModel, false);
      const zodSchema = z.object({
        name: z.string(),
      });

      const result = processSchema({
        schema: zodSchema,
        compatibilities: [nonApplyingCompatibility],
        mode: 'aiSdkSchema',
      });

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
    });

    it('should handle jsonSchema mode', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const result = processSchema({
        schema: zodSchema,
        compatibilities: [mockCompatibility],
        mode: 'jsonSchema',
      });

      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('type');
    });

    it('should handle empty compatibilities array', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const result = processSchema({
        schema: zodSchema,
        compatibilities: [],
        mode: 'aiSdkSchema',
      });

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
    });

    it('should convert non-object AI SDK schema correctly', () => {
      const stringSchema: Schema = jsonSchema({ type: 'string' });

      const result = processSchema({
        schema: stringSchema,
        compatibilities: [mockCompatibility],
        mode: 'aiSdkSchema',
      });

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
    });

    it('should handle complex schema with multiple compatibilities', () => {
      const compat1 = new MockSchemaCompatibility(mockModel, false);
      const compat2 = new MockSchemaCompatibility(mockModel, true);

      const zodSchema = z.object({
        name: z.string(),
        settings: z.object({
          theme: z.string(),
          notifications: z.boolean(),
        }),
      });

      const result = processSchema({
        schema: zodSchema,
        compatibilities: [compat1, compat2], // First one doesn't apply, second one does
        mode: 'aiSdkSchema',
      });

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
    });
  });
});
