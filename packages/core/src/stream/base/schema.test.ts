import type { JSONSchema7 } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { getTransformedSchema, getResponseFormat, toJSONSchema } from './schema';

describe('getTransformedSchema', () => {
  describe('object schemas', () => {
    it('should return object schema with outputFormat "object"', () => {
      const schema: JSONSchema7 = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };

      const result = getTransformedSchema(schema);
      expect(result.outputFormat).toBe('object');
      expect(result.jsonSchema).toEqual(schema);
    });
  });

  describe('array schemas', () => {
    it('should wrap array schema in object with "elements" property', () => {
      const schema: JSONSchema7 = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'array',
        items: { type: 'string' },
      };

      const result = getTransformedSchema(schema);

      expect(result.outputFormat).toBe('array');
      expect(result.jsonSchema).toEqual({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          elements: { type: 'array', items: { type: 'string' } },
        },
        required: ['elements'],
        additionalProperties: false,
      });
    });

    it('should handle array of objects', () => {
      const schema: JSONSchema7 = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
          },
        },
      };

      const result = getTransformedSchema(schema);

      expect(result.outputFormat).toBe('array');
      expect(result.jsonSchema).toMatchInlineSnapshot(`
        {
          "$schema": undefined,
          "additionalProperties": false,
          "properties": {
            "elements": {
              "items": {
                "properties": {
                  "id": {
                    "type": "number",
                  },
                  "name": {
                    "type": "string",
                  },
                },
                "type": "object",
              },
              "type": "array",
            },
          },
          "required": [
            "elements",
          ],
          "type": "object",
        }
      `);
    });
  });

  describe('enum schemas', () => {
    it('should wrap string enum in object with "result" property', () => {
      const schema: JSONSchema7 = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'string',
        enum: ['red', 'green', 'blue'],
      };

      const result = getTransformedSchema(schema);
      expect(result.outputFormat).toBe('enum');
      expect(result.jsonSchema).toEqual({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          result: { type: 'string', enum: ['red', 'green', 'blue'] },
        },
        required: ['result'],
        additionalProperties: false,
      });
    });

    it('should handle number enum', () => {
      const schema: JSONSchema7 = {
        type: 'number',
        enum: [1, 2, 3],
      };

      const result = getTransformedSchema(schema);

      expect(result.outputFormat).toBe('enum');
      expect(result.jsonSchema).toMatchInlineSnapshot(`
        {
          "$schema": undefined,
          "additionalProperties": false,
          "properties": {
            "result": {
              "enum": [
                1,
                2,
                3,
              ],
              "type": "number",
            },
          },
          "required": [
            "result",
          ],
          "type": "object",
        }
      `);
    });

    it('should default to string type when enum has no type', () => {
      const schema: JSONSchema7 = {
        enum: ['a', 'b', 'c'],
      };

      const result = getTransformedSchema(schema);

      expect(result.outputFormat).toBe('enum');
      expect(result.jsonSchema).toMatchInlineSnapshot(`
        {
          "$schema": undefined,
          "additionalProperties": false,
          "properties": {
            "result": {
              "enum": [
                "a",
                "b",
                "c",
              ],
              "type": "string",
            },
          },
          "required": [
            "result",
          ],
          "type": "object",
        }
      `);
    });
  });
});

describe('getResponseFormat', () => {
  describe('with schema', () => {
    it('should return json type with JSONSchema7 for object', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: { name: { type: 'string' } },
      };

      const result = getResponseFormat(schema);

      expect.assertions(2);
      expect(result.type).toBe('json');
      if (result.type === 'json') {
        expect(result.schema).toMatchInlineSnapshot(`
          {
            "properties": {
              "name": {
                "type": "string",
              },
            },
            "type": "object",
          }
        `);
      }
    });

    it('should return json type with wrapped array schema', () => {
      const schema: JSONSchema7 = {
        type: 'array',
        items: { type: 'string' },
      };

      const result = getResponseFormat(schema);

      expect.assertions(2);
      expect(result.type).toBe('json');
      if (result.type === 'json') {
        expect(result.schema).toMatchInlineSnapshot(`
          {
            "$schema": undefined,
            "additionalProperties": false,
            "properties": {
              "elements": {
                "items": {
                  "type": "string",
                },
                "type": "array",
              },
            },
            "required": [
              "elements",
            ],
            "type": "object",
          }
        `);
      }
    });

    it('should return json type with wrapped enum schema', () => {
      const schema: JSONSchema7 = {
        enum: ['a', 'b'],
      };

      const result = getResponseFormat(schema);
      expect.assertions(2);
      expect(result.type).toBe('json');
      if (result.type === 'json') {
        expect(result.schema).toMatchInlineSnapshot(`
          {
            "$schema": undefined,
            "additionalProperties": false,
            "properties": {
              "result": {
                "enum": [
                  "a",
                  "b",
                ],
                "type": "string",
              },
            },
            "required": [
              "result",
            ],
            "type": "object",
          }
        `);
      }
    });
  });

  describe('without schema', () => {
    it('should return text type when schema is undefined', () => {
      const result = getResponseFormat(undefined);

      expect(result).toEqual({ type: 'text' });
    });

    it('should return text type when called with no arguments', () => {
      const result = getResponseFormat();

      expect(result).toEqual({ type: 'text' });
    });
  });
});

describe('toJSONSchema', () => {
  it('should convert StandardSchema to JSONSchema7', () => {
    // Create a mock StandardSchema
    const mockJsonSchema: JSONSchema7 = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    };

    const mockStandardSchema = z.object({
      name: z.string().optional(),
    });

    const result = toJSONSchema(mockStandardSchema);

    expect(result).toEqual(mockJsonSchema);
  });
});
