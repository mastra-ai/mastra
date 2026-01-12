import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { jsonQueryParam, pickParams, wrapSchemaForQueryParams } from './route-builder';

describe('pickParams', () => {
  it('should extract matching keys from params object', () => {
    const schema = z.object({
      page: z.number(),
      perPage: z.number(),
    });

    const params = {
      page: 1,
      perPage: 10,
      mastra: 'should-be-excluded',
      requestContext: 'should-be-excluded',
    };

    const result = pickParams(schema, params);

    expect(result).toEqual({ page: 1, perPage: 10 });
    expect(result).not.toHaveProperty('mastra');
    expect(result).not.toHaveProperty('requestContext');
  });

  it('should handle missing optional keys', () => {
    const schema = z.object({
      page: z.number().optional(),
      perPage: z.number().optional(),
    });

    const params = { page: 1 };

    const result = pickParams(schema, params);

    expect(result).toEqual({ page: 1 });
    expect(result).not.toHaveProperty('perPage');
  });

  it('should handle empty params', () => {
    const schema = z.object({
      page: z.number().optional(),
    });

    const result = pickParams(schema, {});

    expect(result).toEqual({});
  });
});

describe('jsonQueryParam', () => {
  describe('with array schema', () => {
    const tagsSchema = jsonQueryParam(z.array(z.string()));

    it('should parse valid JSON string array', () => {
      const result = tagsSchema.safeParse('["tag1", "tag2", "tag3"]');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(['tag1', 'tag2', 'tag3']);
      }
    });

    it('should accept already-parsed array', () => {
      const result = tagsSchema.safeParse(['tag1', 'tag2']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(['tag1', 'tag2']);
      }
    });

    it('should fail on invalid JSON', () => {
      const result = tagsSchema.safeParse('not valid json');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid JSON');
      }
    });

    it('should fail on wrong type in JSON', () => {
      const result = tagsSchema.safeParse('{"not": "an array"}');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });

    it('should fail on array with wrong element types', () => {
      const result = tagsSchema.safeParse('[1, 2, 3]');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('with object schema', () => {
    const dateRangeSchema = jsonQueryParam(
      z.object({
        gte: z.coerce.date().optional(),
        lte: z.coerce.date().optional(),
      }),
    );

    it('should parse valid JSON string object', () => {
      const result = dateRangeSchema.safeParse('{"gte": "2024-01-01"}');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gte).toBeInstanceOf(Date);
        expect(result.data.gte?.toISOString()).toContain('2024-01-01');
      }
    });

    it('should accept already-parsed object', () => {
      const result = dateRangeSchema.safeParse({ gte: '2024-01-01' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gte).toBeInstanceOf(Date);
      }
    });

    it('should handle nested date coercion', () => {
      const result = dateRangeSchema.safeParse('{"gte": "2024-01-01", "lte": "2024-12-31"}');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gte).toBeInstanceOf(Date);
        expect(result.data.lte).toBeInstanceOf(Date);
      }
    });

    it('should fail on invalid date string', () => {
      const result = dateRangeSchema.safeParse('{"gte": "not-a-date"}');

      expect(result.success).toBe(false);
    });
  });

  describe('with record schema', () => {
    const metadataSchema = jsonQueryParam(z.record(z.string(), z.unknown()));

    it('should parse valid JSON string record', () => {
      const result = metadataSchema.safeParse('{"key1": "value1", "key2": 123}');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ key1: 'value1', key2: 123 });
      }
    });

    it('should accept already-parsed record', () => {
      const result = metadataSchema.safeParse({ key1: 'value1' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ key1: 'value1' });
      }
    });
  });

  describe('with optional wrapper', () => {
    const optionalTagsSchema = jsonQueryParam(z.array(z.string()).optional());

    it('should handle undefined', () => {
      const result = optionalTagsSchema.safeParse(undefined);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });

    it('should still parse valid JSON string', () => {
      const result = optionalTagsSchema.safeParse('["tag1"]');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(['tag1']);
      }
    });
  });

  describe('error messages', () => {
    const schema = jsonQueryParam(z.array(z.string()));

    it('should provide clear JSON parse error', () => {
      const result = schema.safeParse('{invalid json}');

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessage = result.error.errors.map(e => e.message).join(', ');
        expect(errorMessage).toContain('Invalid JSON');
      }
    });

    it('should provide schema validation error for valid JSON with wrong structure', () => {
      const result = schema.safeParse('{"not": "array"}');

      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have validation error, not JSON parse error
        const errorMessage = result.error.errors.map(e => e.message).join(', ');
        expect(errorMessage).not.toContain('Invalid JSON');
      }
    });
  });
});

describe('wrapSchemaForQueryParams', () => {
  describe('complex type detection', () => {
    it('should wrap array fields', () => {
      const baseSchema = z.object({
        tags: z.array(z.string()),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);
      const result = querySchema.safeParse({ tags: '["a", "b"]' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual(['a', 'b']);
      }
    });

    it('should wrap object fields', () => {
      const baseSchema = z.object({
        dateRange: z.object({
          start: z.coerce.date().optional(),
          end: z.coerce.date().optional(),
        }),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);
      const result = querySchema.safeParse({ dateRange: '{"start": "2024-01-01"}' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dateRange.start).toBeInstanceOf(Date);
      }
    });

    it('should wrap record fields', () => {
      const baseSchema = z.object({
        metadata: z.record(z.string(), z.unknown()),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);
      const result = querySchema.safeParse({ metadata: '{"key": "value"}' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toEqual({ key: 'value' });
      }
    });

    it('should NOT wrap string fields', () => {
      const baseSchema = z.object({
        name: z.string(),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);
      const result = querySchema.safeParse({ name: 'test-name' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('test-name');
      }
    });

    it('should NOT wrap number fields (use z.coerce)', () => {
      const baseSchema = z.object({
        page: z.coerce.number(),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);
      const result = querySchema.safeParse({ page: '10' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(10);
      }
    });

    it('should NOT wrap boolean fields (use z.coerce)', () => {
      const baseSchema = z.object({
        enabled: z.coerce.boolean(),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);
      const result = querySchema.safeParse({ enabled: 'true' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
      }
    });

    it('should NOT wrap enum fields', () => {
      const baseSchema = z.object({
        status: z.enum(['active', 'inactive']),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);
      const result = querySchema.safeParse({ status: 'active' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('active');
      }
    });

    it('should NOT wrap nativeEnum fields', () => {
      enum Status {
        ACTIVE = 'active',
        INACTIVE = 'inactive',
      }

      const baseSchema = z.object({
        status: z.nativeEnum(Status),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);
      const result = querySchema.safeParse({ status: 'active' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(Status.ACTIVE);
      }
    });
  });

  describe('optional/nullable handling', () => {
    it('should wrap optional array fields', () => {
      const baseSchema = z.object({
        tags: z.array(z.string()).optional(),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);

      // Test with JSON string
      const withValue = querySchema.safeParse({ tags: '["tag1"]' });
      expect(withValue.success).toBe(true);
      if (withValue.success) {
        expect(withValue.data.tags).toEqual(['tag1']);
      }

      // Test without value
      const withoutValue = querySchema.safeParse({});
      expect(withoutValue.success).toBe(true);
      if (withoutValue.success) {
        expect(withoutValue.data.tags).toBeUndefined();
      }
    });

    it('should wrap nullable array fields', () => {
      const baseSchema = z.object({
        tags: z.array(z.string()).nullable(),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);

      // Test with JSON string
      const withValue = querySchema.safeParse({ tags: '["tag1"]' });
      expect(withValue.success).toBe(true);
      if (withValue.success) {
        expect(withValue.data.tags).toEqual(['tag1']);
      }

      // Test with null
      const withNull = querySchema.safeParse({ tags: null });
      expect(withNull.success).toBe(true);
      if (withNull.success) {
        expect(withNull.data.tags).toBeNull();
      }
    });

    it('should wrap nested optional fields created by .partial()', () => {
      // When .partial() is called on a schema with already-optional fields,
      // it creates nested optionals: ZodOptional<ZodOptional<ZodObject>>
      const dateRangeSchema = z.object({
        start: z.coerce.date().optional(),
        end: z.coerce.date().optional(),
      });

      const baseSchema = z.object({
        startedAt: dateRangeSchema.optional(), // already optional
      });

      // .partial() wraps all fields with another ZodOptional
      const partialSchema = baseSchema.partial();
      const querySchema = wrapSchemaForQueryParams(partialSchema);

      // Test with JSON string - this was failing before the fix
      const withValue = querySchema.safeParse({ startedAt: '{"start": "2024-01-01"}' });
      expect(withValue.success).toBe(true);
      if (withValue.success) {
        expect(withValue.data.startedAt?.start).toBeInstanceOf(Date);
      }

      // Test without value
      const withoutValue = querySchema.safeParse({});
      expect(withoutValue.success).toBe(true);
    });
  });

  describe('mixed schema', () => {
    it('should correctly handle schema with mixed simple and complex fields', () => {
      const baseSchema = z.object({
        // Simple fields
        page: z.coerce.number().int().min(0).optional(),
        perPage: z.coerce.number().int().min(1).max(100).optional(),
        status: z.enum(['active', 'inactive']).optional(),
        // Complex fields
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        dateRange: z
          .object({
            start: z.coerce.date().optional(),
            end: z.coerce.date().optional(),
          })
          .optional(),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);

      const result = querySchema.safeParse({
        page: '0',
        perPage: '50',
        status: 'active',
        tags: '["tag1", "tag2"]',
        metadata: '{"env": "production"}',
        dateRange: '{"start": "2024-01-01"}',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Simple fields coerced correctly
        expect(result.data.page).toBe(0);
        expect(result.data.perPage).toBe(50);
        expect(result.data.status).toBe('active');

        // Complex fields parsed from JSON
        expect(result.data.tags).toEqual(['tag1', 'tag2']);
        expect(result.data.metadata).toEqual({ env: 'production' });
        expect(result.data.dateRange?.start).toBeInstanceOf(Date);
      }
    });

    it('should collect multiple validation errors', () => {
      const baseSchema = z.object({
        page: z.coerce.number().int().min(0),
        perPage: z.coerce.number().int().min(1).max(100),
        tags: z.array(z.string()),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);

      const result = querySchema.safeParse({
        page: 'not-a-number',
        perPage: '999', // exceeds max
        tags: 'invalid json{',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have multiple errors
        expect(result.error.errors.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('already parsed values passthrough', () => {
    it('should accept already-parsed array', () => {
      const baseSchema = z.object({
        tags: z.array(z.string()),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);
      const result = querySchema.safeParse({ tags: ['already', 'parsed'] });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual(['already', 'parsed']);
      }
    });

    it('should accept already-parsed object', () => {
      const baseSchema = z.object({
        config: z.object({
          enabled: z.boolean(),
        }),
      });

      const querySchema = wrapSchemaForQueryParams(baseSchema);
      const result = querySchema.safeParse({ config: { enabled: true } });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config).toEqual({ enabled: true });
      }
    });
  });
});
