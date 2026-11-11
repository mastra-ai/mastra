import type { JSONSchema7 } from 'json-schema';
import { describe, it, expect, vi } from 'vitest';
import { isStandardSchemaWithJSON } from '../standard-schema';
import { toStandardSchema } from './json-schema';

describe('json-schema standard-schema adapter', () => {
  describe('toStandardSchema', () => {
    it('should wrap a JSON Schema with StandardSchemaV1 interface', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };

      const standardSchema = toStandardSchema(jsonSchema);

      // Should have ~standard property
      expect('~standard' in standardSchema).toBe(true);
      expect(standardSchema['~standard'].version).toBe(1);
      expect(standardSchema['~standard'].vendor).toBe('json-schema');
    });

    it('should validate data correctly', async () => {
      const jsonSchema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 },
        },
        required: ['name', 'age'],
      };

      const standardSchema = toStandardSchema<{ name: string; age: number }>(jsonSchema);

      // Test valid data
      const validResult = await standardSchema['~standard'].validate({ name: 'John', age: 30 });
      expect(validResult).toEqual({ value: { name: 'John', age: 30 } });

      // Test invalid data - missing required field
      const invalidResult = await standardSchema['~standard'].validate({ name: 'John' });
      expect('issues' in invalidResult).toBe(true);
      if ('issues' in invalidResult && invalidResult.issues) {
        expect(invalidResult.issues.length).toBeGreaterThan(0);
      }
    });

    it('should have jsonSchema converter', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const standardSchema = toStandardSchema(jsonSchema);

      // Should have jsonSchema property
      expect('jsonSchema' in standardSchema['~standard']).toBe(true);
      expect(typeof standardSchema['~standard'].jsonSchema.input).toBe('function');
      expect(typeof standardSchema['~standard'].jsonSchema.output).toBe('function');
    });

    it('should return JSON Schema with draft-07 target', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.type).toBe('object');
      expect(outputSchema.properties).toBeDefined();
      expect(outputSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(outputSchema).toMatchSnapshot();
    });

    it('should return JSON Schema with draft-2020-12 target', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'string',
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-2020-12' });

      expect(outputSchema.type).toBe('string');
      expect(outputSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(outputSchema).toMatchSnapshot();
    });

    it('should return JSON Schema with openapi-3.0 target (no $schema)', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'string',
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'openapi-3.0' });

      expect(outputSchema.type).toBe('string');
      // OpenAPI 3.0 doesn't use $schema
      expect(outputSchema.$schema).toBeUndefined();
      expect(outputSchema).toMatchSnapshot();
    });

    it('should not overwrite existing $schema', () => {
      const jsonSchema: JSONSchema7 = {
        $schema: 'http://custom-schema.org/schema#',
        type: 'string',
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.$schema).toBe('http://custom-schema.org/schema#');
      expect(outputSchema).toMatchSnapshot();
    });

    it('should handle nested object schemas', () => {
      const jsonSchema: JSONSchema7 = {
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
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.type).toBe('object');
      expect((outputSchema.properties as any).user.type).toBe('object');
      expect((outputSchema.properties as any).tags.type).toBe('array');
      expect(outputSchema).toMatchSnapshot();
    });

    it('should handle array schemas', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
        minItems: 1,
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.type).toBe('array');
      expect(outputSchema.minItems).toBe(1);
    });

    it('should handle enum schemas', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'string',
        enum: ['red', 'green', 'blue'],
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });

      expect(outputSchema.type).toBe('string');
      expect(outputSchema.enum).toEqual(['red', 'green', 'blue']);
    });

    it('should validate enum values correctly', async () => {
      const jsonSchema: JSONSchema7 = {
        type: 'string',
        enum: ['red', 'green', 'blue'],
      };

      const standardSchema = toStandardSchema<'red' | 'green' | 'blue'>(jsonSchema);

      const validResult = await standardSchema['~standard'].validate('red');
      expect(validResult).toEqual({ value: 'red' });

      const invalidResult = await standardSchema['~standard'].validate('yellow');
      expect('issues' in invalidResult).toBe(true);
    });

    it('should preserve recursive $ref schemas when converting output JSON Schema', () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          root: { $ref: '#/$defs/node' },
        },
        required: ['root'],
        $defs: {
          node: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              children: {
                type: 'array',
                items: { $ref: '#/$defs/node' },
              },
            },
            required: ['name'],
          },
        },
      } as JSONSchema7 & {
        properties: {
          root: { $ref: string };
        };
        $defs: {
          node: {
            properties: {
              children: {
                items: { $ref: string };
              };
            };
          };
        };
      };

      const standardSchema = toStandardSchema(jsonSchema);
      const outputSchema = standardSchema['~standard'].jsonSchema.output({
        target: 'draft-07',
      }) as unknown as typeof jsonSchema & {
        $schema?: string;
      };

      expect(outputSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(outputSchema.properties.root).toEqual({ $ref: '#/$defs/node' });
      expect(outputSchema.$defs.node.properties.children.items).toEqual({ $ref: '#/$defs/node' });
    });

    it('should expose getSchema method', () => {
      const jsonSchema: JSONSchema7 = {
        type: 'string',
      };

      const standardSchema = toStandardSchema(jsonSchema);

      expect(standardSchema.getSchema()).toEqual(jsonSchema);
    });
  });

  describe('draft 2020-12 schema support', () => {
    it('should validate correctly when $schema is draft 2020-12', async () => {
      const jsonSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object' as const,
        properties: {
          url: { type: 'string' as const },
          formats: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
        },
        required: ['url'],
      };

      const standardSchema = toStandardSchema(jsonSchema);

      // Valid input should pass
      const validResult = await standardSchema['~standard'].validate({
        url: 'https://example.com',
        formats: ['markdown'],
      });
      expect('value' in validResult).toBe(true);

      // Invalid input should fail
      const invalidResult = await standardSchema['~standard'].validate({
        formats: ['markdown'],
        // missing required 'url'
      });
      expect('issues' in invalidResult).toBe(true);
      if ('issues' in invalidResult && invalidResult.issues) {
        expect(invalidResult.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('format keywords', () => {
    const dialects: [string, string | undefined][] = [
      ['draft-07', undefined],
      ['draft-2020-12', 'https://json-schema.org/draft/2020-12/schema'],
    ];

    it.each(dialects)('enforces standard string formats (%s)', async (_name, $schema) => {
      const schema = {
        ...($schema ? { $schema } : {}),
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          at: { type: 'string', format: 'date-time' },
        },
        required: ['email', 'at'],
      } as JSONSchema7;

      const standardSchema = toStandardSchema(schema);

      const valid = await standardSchema['~standard'].validate({
        email: 'ada@example.com',
        at: '2026-11-05T10:00:00Z',
      });
      expect('value' in valid).toBe(true);

      const badEmail = await standardSchema['~standard'].validate({
        email: 'not-an-email',
        at: '2026-11-05T10:00:00Z',
      });
      expect('issues' in badEmail).toBe(true);

      const badDate = await standardSchema['~standard'].validate({
        email: 'ada@example.com',
        at: 'tomorrow',
      });
      expect('issues' in badDate).toBe(true);

      // `date-time` requires a timezone offset.
      const noOffset = await standardSchema['~standard'].validate({
        email: 'ada@example.com',
        at: '2024-01-01T10:00:00',
      });
      expect('issues' in noOffset).toBe(true);
    });

    it('does not warn about unknown formats', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const standardSchema = toStandardSchema({
          type: 'object',
          properties: { since: { type: 'string', format: 'date-time' } },
          required: ['since'],
        } as JSONSchema7);

        await standardSchema['~standard'].validate({ since: '2026-11-05T10:00:00Z' });

        const messages = warn.mock.calls.flat().join(' ');
        expect(messages).not.toContain('unknown format');
      } finally {
        warn.mockRestore();
      }
    });

    it('keeps caller-provided formats ahead of the built-in ones', async () => {
      const standardSchema = toStandardSchema(
        {
          type: 'object',
          properties: { email: { type: 'string', format: 'email' } },
          required: ['email'],
        } as JSONSchema7,
        { ajvOptions: { formats: { email: /@mastra\.ai$/ } } },
      );

      const allowed = await standardSchema['~standard'].validate({ email: 'ada@mastra.ai' });
      expect('value' in allowed).toBe(true);

      const rejected = await standardSchema['~standard'].validate({ email: 'ada@example.com' });
      expect('issues' in rejected).toBe(true);
    });

    it('allows opting out of format validation', async () => {
      const standardSchema = toStandardSchema(
        {
          type: 'object',
          properties: { at: { type: 'string', format: 'date-time' } },
          required: ['at'],
        } as JSONSchema7,
        { ajvOptions: { validateFormats: false } },
      );

      const result = await standardSchema['~standard'].validate({ at: 'not-a-date' });
      expect('value' in result).toBe(true);
    });

    it('enforces formatMinimum now that formats are registered', async () => {
      const standardSchema = toStandardSchema({
        type: 'object',
        properties: { d: { type: 'string', format: 'date', formatMinimum: '2020-01-01' } },
        required: ['d'],
      } as JSONSchema7);

      expect('value' in (await standardSchema['~standard'].validate({ d: '2021-01-01' }))).toBe(true);
      expect('issues' in (await standardSchema['~standard'].validate({ d: '2019-01-01' }))).toBe(true);
    });
  });

  describe('isStandardSchemaWithJSON', () => {
    it('should return true for JSON Schema wrapped schemas', () => {
      const jsonSchema: JSONSchema7 = { type: 'string' };
      const wrapper = toStandardSchema(jsonSchema);

      expect(isStandardSchemaWithJSON(wrapper)).toBe(true);
    });

    it('should return false for non-json-schema vendors', () => {
      // Mock a standard schema with different vendor
      const mockSchema = {
        '~standard': {
          version: 1,
          vendor: 'other-vendor',
        },
      };

      expect(isStandardSchemaWithJSON(mockSchema)).toBe(false);
    });

    it('should return false for non-schema values', () => {
      expect(isStandardSchemaWithJSON(null)).toBe(false);
      expect(isStandardSchemaWithJSON(undefined)).toBe(false);
      expect(isStandardSchemaWithJSON({})).toBe(false);
    });
  });
});
