import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ModelInformation } from '../types';
import { AnthropicSchemaCompatLayer } from './anthropic';

describe('AnthropicSchemaCompatLayer', () => {
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

  describe('processZodType - Basic Transformations', () => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      supportsStructuredOutputs: false,
    };

    it('should handle simple object schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle optional fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle nullable fields', () => {
      const schema = z.object({
        name: z.string(),
        deletedAt: z.date().nullable(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe('processZodType - Nested Objects', () => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      supportsStructuredOutputs: false,
    };

    it('should handle nested object schema', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string(),
        }),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle deeply nested objects', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            bio: z.string().optional(),
            settings: z.object({
              theme: z.string().optional(),
              notifications: z.boolean(),
            }),
          }),
        }),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle optional nested objects', () => {
      const schema = z.object({
        name: z.string(),
        address: z
          .object({
            street: z.string(),
            city: z.string().optional(),
          })
          .optional(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe('processZodType - Arrays', () => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      supportsStructuredOutputs: false,
    };

    it('should handle simple array schema', () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle optional arrays', () => {
      const schema = z.object({
        name: z.string(),
        tags: z.array(z.string()).optional(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle arrays with object items', () => {
      const schema = z.object({
        users: z.array(
          z.object({
            name: z.string(),
            email: z.string().optional(),
          }),
        ),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle nested arrays', () => {
      const schema = z.object({
        matrix: z.array(z.array(z.number())),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe('processZodType - Unions', () => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      supportsStructuredOutputs: false,
    };

    it('should handle simple union schema', () => {
      const schema = z.object({
        value: z.union([z.string(), z.number()]),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle optional union schema', () => {
      const schema = z.object({
        name: z.string(),
        value: z.union([z.string(), z.number()]).optional(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle union of objects', () => {
      const schema = z.object({
        result: z.union([z.object({ success: z.boolean(), data: z.string() }), z.object({ error: z.string() })]),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe('processZodType - String Constraints', () => {
    describe('Claude 3.5 Sonnet (standard model)', () => {
      const modelInfo: ModelInformation = {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet',
        supportsStructuredOutputs: false,
      };

      it('should preserve string constraints', () => {
        const schema = z.object({
          email: z.string().email(),
          url: z.string().url(),
          text: z.string().min(10).max(1000),
        });

        const layer = new AnthropicSchemaCompatLayer(modelInfo);
        const jsonSchema = layer.toJSONSchema(schema);

        expect(jsonSchema).toMatchSnapshot();
      });
    });

    describe('Claude 3.5 Haiku', () => {
      const modelInfo: ModelInformation = {
        provider: 'anthropic',
        modelId: 'claude-3.5-haiku',
        supportsStructuredOutputs: false,
      };

      it('should handle string min/max constraints by adding to description', () => {
        const schema = z.object({
          text: z.string().min(10).max(1000),
        });

        const layer = new AnthropicSchemaCompatLayer(modelInfo);
        const jsonSchema = layer.toJSONSchema(schema);

        expect(jsonSchema).toMatchSnapshot();
      });

      it('should handle optional strings', () => {
        const schema = z.object({
          name: z.string(),
          bio: z.string().optional(),
        });

        const layer = new AnthropicSchemaCompatLayer(modelInfo);
        const jsonSchema = layer.toJSONSchema(schema);

        expect(jsonSchema).toMatchSnapshot();
      });

      it('should handle string with description and constraints', () => {
        const schema = z.object({
          text: z.string().min(10).max(1000).describe('A text field with constraints'),
        });

        const layer = new AnthropicSchemaCompatLayer(modelInfo);
        const jsonSchema = layer.toJSONSchema(schema);

        expect(jsonSchema).toMatchSnapshot();
      });
    });
  });

  describe('processZodType - Enums', () => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      supportsStructuredOutputs: false,
    };

    it('should handle enum schema', () => {
      const schema = z.object({
        status: z.enum(['pending', 'active', 'completed']),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle optional enum schema', () => {
      const schema = z.object({
        name: z.string(),
        status: z.enum(['pending', 'active', 'completed']).optional(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe('processZodType - Complex Schemas', () => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      supportsStructuredOutputs: false,
    };

    it('should handle complex real-world schema', () => {
      const schema = z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
        avatar: z.string().optional(),
        bio: z.string().optional(),
        deletedAt: z.date().nullable(),
        settings: z
          .object({
            theme: z.string().optional(),
            notifications: z.boolean(),
          })
          .optional(),
        tags: z.array(z.string()).optional(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle schema with all basic types', () => {
      const schema = z.object({
        stringField: z.string(),
        numberField: z.number(),
        booleanField: z.boolean(),
        arrayField: z.array(z.string()),
        objectField: z.object({ nested: z.string() }),
        enumField: z.enum(['a', 'b', 'c']),
        unionField: z.union([z.string(), z.number()]),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle partial objects', () => {
      const schema = z
        .object({
          City: z.string(),
          Name: z.string(),
          Slug: z.string(),
        })
        .partial();

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle passthrough objects', () => {
      const schema = z
        .object({
          queryText: z.string().describe('The query text'),
          topK: z.number().describe('Number of results'),
        })
        .passthrough();

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe('processZodType - Descriptions', () => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      supportsStructuredOutputs: false,
    };

    it('should preserve field descriptions', () => {
      const schema = z.object({
        name: z.string().describe('The user name'),
        age: z.number().describe('The user age'),
        email: z.string().describe('The user email address'),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle descriptions with nested objects', () => {
      const schema = z.object({
        user: z
          .object({
            name: z.string().describe('User name'),
            profile: z
              .object({
                bio: z.string().describe('User bio'),
              })
              .describe('User profile'),
          })
          .describe('User object'),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe('processZodType - Default Values', () => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      supportsStructuredOutputs: false,
    };

    it('should handle default values', () => {
      const schema = z.object({
        name: z.string(),
        confidence: z.number().default(1),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle string defaults', () => {
      const schema = z.object({
        name: z.string(),
        explanation: z.string().default(''),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle boolean defaults', () => {
      const schema = z.object({
        name: z.string(),
        enabled: z.boolean().default(false),
        active: z.boolean().default(true),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle array defaults', () => {
      const schema = z.object({
        name: z.string(),
        tags: z.array(z.string()).default([]),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe('processZodType - Records', () => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      supportsStructuredOutputs: false,
    };

    it('should handle record schema', () => {
      let settingsSchema;
      // @ts-expect-error - check if zod v4
      if ('_zod' in z.object()) {
        settingsSchema = z.record(z.string(), z.boolean());
      } else {
        settingsSchema = z.record(z.boolean());
      }
      const schema = z.object({
        settings: settingsSchema,
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should handle record with key and value types', () => {
      let metadataSchema;
      // @ts-expect-error - check if zod v4
      if ('_zod' in z.object()) {
        metadataSchema = z.record(z.string(), z.number());
      } else {
        metadataSchema = z.record(z.number());
      }
      const schema = z.object({
        metadata: metadataSchema,
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe('processToAISDKSchema', () => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      supportsStructuredOutputs: false,
    };

    it('should return schema with jsonSchema and validate function', () => {
      const schema = z.object({
        text: z.string().min(1).max(100),
        count: z.number().min(1),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const result = layer.processToAISDKSchema(schema);

      expect(result).toHaveProperty('jsonSchema');
      expect(result).toHaveProperty('validate');
      expect(typeof result.validate).toBe('function');
    });

    it('should validate correct data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const result = layer.processToAISDKSchema(schema);

      const validationResult = result.validate!({ name: 'John', age: 30 });
      expect(validationResult).toHaveProperty('success');
      expect(validationResult.success).toBe(true);
    });

    it('should reject invalid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const result = layer.processToAISDKSchema(schema);

      const validationResult = result.validate!({ name: 'John', age: 'not a number' });
      expect(validationResult).toHaveProperty('success');
      expect(validationResult.success).toBe(false);
    });
  });

  describe('Snapshot Tests - Full JSON Schema Output', () => {
    it('should match snapshot for claude-3-5-sonnet with complete schema', () => {
      const modelInfo: ModelInformation = {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet',
        supportsStructuredOutputs: false,
      };

      let metadataSchema;
      // @ts-expect-error - zod v3 does have _zod property
      if ('_zod' in z.object()) {
        metadataSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
      } else {
        metadataSchema = z.record(z.union([z.string(), z.number(), z.boolean()]));
      }

      const schema = z.object({
        user: z.object({
          id: z.string().describe('User ID'),
          name: z.string().describe('Full name'),
          email: z.string().email().describe('Email address'),
          age: z.number().min(0).max(120).optional(),
        }),
        preferences: z.object({
          theme: z.enum(['light', 'dark']),
          notifications: z.boolean(),
          language: z.string(),
        }),
        tags: z.array(z.string()).min(1).max(5),
        metadata: metadataSchema,
        settings: z
          .object({
            public: z.boolean(),
            featured: z.boolean().optional(),
          })
          .optional(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should match snapshot for claude-3.5-haiku with string constraints', () => {
      const modelInfo: ModelInformation = {
        provider: 'anthropic',
        modelId: 'claude-3.5-haiku',
        supportsStructuredOutputs: false,
      };

      const schema = z.object({
        title: z.string().min(5).max(100).describe('Article title'),
        content: z.string().min(100).max(10000).describe('Article content'),
        summary: z.string().max(500).optional(),
        tags: z.array(z.string()).optional(),
        metadata: z
          .object({
            author: z.string(),
            published: z.boolean(),
          })
          .optional(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should match snapshot for discriminated union pattern', () => {
      const modelInfo: ModelInformation = {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet',
        supportsStructuredOutputs: false,
      };

      const schema = z.object({
        result: z.union([
          z.object({
            type: z.literal('success'),
            data: z.object({
              id: z.string(),
              value: z.number(),
            }),
          }),
          z.object({
            type: z.literal('error'),
            error: z.object({
              code: z.string(),
              message: z.string(),
            }),
          }),
        ]),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });

    it('should match snapshot for API response schema', () => {
      const modelInfo: ModelInformation = {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet',
        supportsStructuredOutputs: false,
      };

      let metadataSchema;
      // @ts-expect-error - check if zod v4
      if ('_zod' in z.object()) {
        metadataSchema = z.record(z.string(), z.string());
      } else {
        metadataSchema = z.record(z.string());
      }

      const schema = z.object({
        status: z.number(),
        data: z
          .object({
            items: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                createdAt: z.string(),
                updatedAt: z.string().optional(),
                metadata: metadataSchema.optional(),
              }),
            ),
            pagination: z.object({
              page: z.number(),
              pageSize: z.number(),
              totalPages: z.number(),
              totalItems: z.number(),
            }),
          })
          .optional(),
        error: z
          .object({
            code: z.string(),
            message: z.string(),
            details: z.array(z.string()).optional(),
          })
          .optional(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      const jsonSchema = layer.toJSONSchema(schema);

      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe('processZodType - ZodNull', () => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
      supportsStructuredOutputs: false,
    };

    it('should handle standalone z.null() without throwing', () => {
      const schema = z.object({
        value: z.null(),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      expect(() => layer.toJSONSchema(schema)).not.toThrow();
    });

    it('should handle z.null() inside a union', () => {
      const schema = z.object({
        name: z.union([z.string(), z.null()]),
      });

      const layer = new AnthropicSchemaCompatLayer(modelInfo);
      expect(() => layer.toJSONSchema(schema)).not.toThrow();
    });
  });
});
