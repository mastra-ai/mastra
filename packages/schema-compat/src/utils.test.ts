import { jsonSchema } from 'ai';
import type { LanguageModelV1, Schema } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { SchemaCompatLayer } from './schema-compatibility';
import { convertZodSchemaToAISDKSchema, convertSchemaToZod, applyCompatLayer } from './utils';

const mockModel = new MockLanguageModelV1({
  modelId: 'test-model',
  defaultObjectGenerationMode: 'json',
});

class MockSchemaCompatibility extends SchemaCompatLayer {
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
    if (value instanceof z.ZodObject) {
      return this.defaultZodObjectHandler(value);
    }
    if (value instanceof z.ZodArray) {
      return this.defaultZodArrayHandler(value);
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

    it('should handle array schemas', () => {
      const zodSchema = z.array(z.string());
      const result = convertZodSchemaToAISDKSchema(zodSchema);
      expect(result.jsonSchema.type).toBe('array');
      expect((result.jsonSchema.items as any)?.type).toBe('string');
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

    it('should convert AI SDK array schema to Zod', () => {
      const aiSchema: Schema = jsonSchema({
        type: 'array',
        items: {
          type: 'string',
        },
      });

      const result = convertSchemaToZod(aiSchema);

      expect(result).toBeInstanceOf(z.ZodArray);
      expect((result as z.ZodArray<any>).element).toBeInstanceOf(z.ZodString);
    });
  });

  describe('applyCompatLayer', () => {
    let mockCompatibility: MockSchemaCompatibility;

    beforeEach(() => {
      mockCompatibility = new MockSchemaCompatibility(mockModel);
    });

    it('should process Zod object schema with compatibility', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = applyCompatLayer({
        schema: zodSchema,
        compatLayers: [mockCompatibility],
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

      const result = applyCompatLayer({
        schema: aiSchema,
        compatLayers: [mockCompatibility],
        mode: 'jsonSchema',
      });

      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('type');
    });

    it('should handle object schema with string property', () => {
      const stringSchema = z.object({ value: z.string() });

      const result = applyCompatLayer({
        schema: stringSchema,
        compatLayers: [mockCompatibility],
        mode: 'aiSdkSchema',
      });

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
    });

    it('should return processed schema when compatibility applies', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const result = applyCompatLayer({
        schema: zodSchema,
        compatLayers: [mockCompatibility],
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

      const result = applyCompatLayer({
        schema: zodSchema,
        compatLayers: [nonApplyingCompatibility],
        mode: 'aiSdkSchema',
      });

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
    });

    it('should handle jsonSchema mode', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const result = applyCompatLayer({
        schema: zodSchema,
        compatLayers: [mockCompatibility],
        mode: 'jsonSchema',
      });

      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('type');
    });

    it('should handle empty compatLayers array', () => {
      const zodSchema = z.object({
        name: z.string(),
      });

      const result = applyCompatLayer({
        schema: zodSchema,
        compatLayers: [],
        mode: 'aiSdkSchema',
      });

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
    });

    it('should handle complex schema with multiple compatLayers', () => {
      const compat1 = new MockSchemaCompatibility(mockModel, false);
      const compat2 = new MockSchemaCompatibility(mockModel, true);

      vi.spyOn(compat1, 'processZodType');
      vi.spyOn(compat2, 'processZodType');

      const zodSchema = z.object({
        name: z.string(),
        settings: z.object({
          theme: z.string(),
          notifications: z.boolean(),
        }),
      });

      const result = applyCompatLayer({
        schema: zodSchema,
        compatLayers: [compat1, compat2],
        mode: 'aiSdkSchema',
      });

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
      expect(compat1.processZodType).not.toHaveBeenCalled();
      expect(compat2.processZodType).toHaveBeenCalled();
    });

    it('should process Zod array schema with compatibility', () => {
      const arraySchema = z.array(z.string());

      const result = applyCompatLayer({
        schema: arraySchema,
        compatLayers: [mockCompatibility],
        mode: 'aiSdkSchema',
      });

      expect(result.jsonSchema.type).toBe('array');
      if (
        result.jsonSchema.items &&
        !Array.isArray(result.jsonSchema.items) &&
        typeof result.jsonSchema.items === 'object'
      ) {
        expect(result.jsonSchema.items.type).toBe('string');
        expect(result.jsonSchema.items.description).toBe('processed string');
      } else {
        expect.fail('items is not a single schema object');
      }
    });

    it('should process AI SDK array schema with compatibility', () => {
      const aiSchema: Schema = jsonSchema({
        type: 'array',
        items: {
          type: 'string',
        },
      });

      const result = applyCompatLayer({
        schema: aiSchema,
        compatLayers: [mockCompatibility],
        mode: 'aiSdkSchema',
      });

      expect(result.jsonSchema.type).toBe('array');
      if (
        result.jsonSchema.items &&
        !Array.isArray(result.jsonSchema.items) &&
        typeof result.jsonSchema.items === 'object'
      ) {
        expect(result.jsonSchema.items.type).toBe('string');
        expect(result.jsonSchema.items.description).toBe('processed string');
      } else {
        expect.fail('items is not a single schema object');
      }
    });

    it('should handle a complex array of objects schema', () => {
      const complexArraySchema = z.array(
        z.object({
          id: z.string(),
          user: z.object({
            name: z.string(),
          }),
        }),
      );

      const result = applyCompatLayer({
        schema: complexArraySchema,
        compatLayers: [mockCompatibility],
        mode: 'aiSdkSchema',
      });

      const { jsonSchema } = result;
      expect(jsonSchema.type).toBe('array');

      const items = jsonSchema.items;
      if (items && !Array.isArray(items) && typeof items === 'object') {
        expect(items.type).toBe('object');
        expect(items.properties).toHaveProperty('id');
        expect(items.properties).toHaveProperty('user');

        const idProperty = items.properties!.id as any;
        expect(idProperty.description).toBe('processed string');

        const userProperty = items.properties!.user as any;
        expect(userProperty.type).toBe('object');
        expect(userProperty.properties).toHaveProperty('name');

        const nameProperty = userProperty.properties.name as any;
        expect(nameProperty.description).toBe('processed string');
      } else {
        expect.fail('items is not a single schema object');
      }
    });

    it('should handle a scalar zod schema', () => {
      const scalarSchema = z.string().email();

      const result = applyCompatLayer({
        schema: scalarSchema,
        compatLayers: [mockCompatibility],
        mode: 'aiSdkSchema',
      });

      const { jsonSchema } = result;
      expect(jsonSchema.type).toBe('string');
      expect(jsonSchema.description).toBe('processed string');
    });
  });
});
