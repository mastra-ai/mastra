import { describe, expect, it } from 'vitest';

import { jsonSchemaToZod } from '../json-schema-to-zod';

describe('jsonSchemaToZod', () => {
  describe('string schemas', () => {
    it('should handle basic string type', () => {
      const schema = { type: 'string' };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('hello').success).toBe(true);
      expect(zodSchema.safeParse(123).success).toBe(false);
      expect(zodSchema.safeParse(null).success).toBe(false);
    });

    it('should handle minLength constraint', () => {
      const schema = { type: 'string', minLength: 3 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('abc').success).toBe(true);
      expect(zodSchema.safeParse('abcd').success).toBe(true);
      expect(zodSchema.safeParse('ab').success).toBe(false);
      expect(zodSchema.safeParse('').success).toBe(false);
    });

    it('should handle maxLength constraint', () => {
      const schema = { type: 'string', maxLength: 5 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('abc').success).toBe(true);
      expect(zodSchema.safeParse('abcde').success).toBe(true);
      expect(zodSchema.safeParse('abcdef').success).toBe(false);
    });

    it('should handle combined minLength and maxLength', () => {
      const schema = { type: 'string', minLength: 2, maxLength: 5 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('ab').success).toBe(true);
      expect(zodSchema.safeParse('abcde').success).toBe(true);
      expect(zodSchema.safeParse('a').success).toBe(false);
      expect(zodSchema.safeParse('abcdef').success).toBe(false);
    });

    it('should handle pattern constraint', () => {
      const schema = { type: 'string', pattern: '^[a-z]+$' };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('hello').success).toBe(true);
      expect(zodSchema.safeParse('Hello').success).toBe(false);
      expect(zodSchema.safeParse('hello123').success).toBe(false);
    });

    it('should handle string enum', () => {
      const schema = { type: 'string', enum: ['red', 'green', 'blue'] };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('red').success).toBe(true);
      expect(zodSchema.safeParse('green').success).toBe(true);
      expect(zodSchema.safeParse('blue').success).toBe(true);
      expect(zodSchema.safeParse('yellow').success).toBe(false);
    });

    it('should handle single value enum', () => {
      const schema = { type: 'string', enum: ['only'] };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('only').success).toBe(true);
      expect(zodSchema.safeParse('other').success).toBe(false);
    });

    it('should handle email format', () => {
      const schema = { type: 'string', format: 'email' };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('test@example.com').success).toBe(true);
      expect(zodSchema.safeParse('invalid-email').success).toBe(false);
    });

    it('should handle url format', () => {
      const schema = { type: 'string', format: 'url' };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('https://example.com').success).toBe(true);
      expect(zodSchema.safeParse('not-a-url').success).toBe(false);
    });

    it('should handle uri format', () => {
      const schema = { type: 'string', format: 'uri' };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('https://example.com/path').success).toBe(true);
      expect(zodSchema.safeParse('not-a-uri').success).toBe(false);
    });

    it('should handle uuid format', () => {
      const schema = { type: 'string', format: 'uuid' };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
      expect(zodSchema.safeParse('not-a-uuid').success).toBe(false);
    });

    it('should handle date-time format', () => {
      const schema = { type: 'string', format: 'date-time' };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('2024-01-15T10:30:00Z').success).toBe(true);
      expect(zodSchema.safeParse('2024-01-15').success).toBe(false);
      expect(zodSchema.safeParse('not-a-date').success).toBe(false);
    });
  });

  describe('number schemas', () => {
    it('should handle basic number type', () => {
      const schema = { type: 'number' };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(42).success).toBe(true);
      expect(zodSchema.safeParse(3.14).success).toBe(true);
      expect(zodSchema.safeParse('42').success).toBe(false);
    });

    it('should handle integer type', () => {
      const schema = { type: 'integer' };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(42).success).toBe(true);
      expect(zodSchema.safeParse(-10).success).toBe(true);
      expect(zodSchema.safeParse(3.14).success).toBe(false);
    });

    it('should handle minimum constraint', () => {
      const schema = { type: 'number', minimum: 0 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(0).success).toBe(true);
      expect(zodSchema.safeParse(10).success).toBe(true);
      expect(zodSchema.safeParse(-1).success).toBe(false);
    });

    it('should handle maximum constraint', () => {
      const schema = { type: 'number', maximum: 100 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(100).success).toBe(true);
      expect(zodSchema.safeParse(50).success).toBe(true);
      expect(zodSchema.safeParse(101).success).toBe(false);
    });

    it('should handle exclusiveMinimum constraint', () => {
      const schema = { type: 'number', exclusiveMinimum: 0 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(1).success).toBe(true);
      expect(zodSchema.safeParse(0.001).success).toBe(true);
      expect(zodSchema.safeParse(0).success).toBe(false);
      expect(zodSchema.safeParse(-1).success).toBe(false);
    });

    it('should handle exclusiveMaximum constraint', () => {
      const schema = { type: 'number', exclusiveMaximum: 100 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(99).success).toBe(true);
      expect(zodSchema.safeParse(99.999).success).toBe(true);
      expect(zodSchema.safeParse(100).success).toBe(false);
      expect(zodSchema.safeParse(101).success).toBe(false);
    });

    it('should handle multipleOf constraint', () => {
      const schema = { type: 'number', multipleOf: 5 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(0).success).toBe(true);
      expect(zodSchema.safeParse(5).success).toBe(true);
      expect(zodSchema.safeParse(10).success).toBe(true);
      expect(zodSchema.safeParse(7).success).toBe(false);
    });

    it('should handle number enum', () => {
      const schema = { type: 'number', enum: [1, 2, 3] };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(1).success).toBe(true);
      expect(zodSchema.safeParse(2).success).toBe(true);
      expect(zodSchema.safeParse(4).success).toBe(false);
    });

    it('should handle combined constraints', () => {
      const schema = { type: 'integer', minimum: 0, maximum: 100 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(50).success).toBe(true);
      expect(zodSchema.safeParse(0).success).toBe(true);
      expect(zodSchema.safeParse(100).success).toBe(true);
      expect(zodSchema.safeParse(-1).success).toBe(false);
      expect(zodSchema.safeParse(101).success).toBe(false);
      expect(zodSchema.safeParse(50.5).success).toBe(false);
    });
  });

  describe('boolean and null schemas', () => {
    it('should handle boolean type', () => {
      const schema = { type: 'boolean' };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(true).success).toBe(true);
      expect(zodSchema.safeParse(false).success).toBe(true);
      expect(zodSchema.safeParse('true').success).toBe(false);
      expect(zodSchema.safeParse(1).success).toBe(false);
      expect(zodSchema.safeParse(null).success).toBe(false);
    });

    it('should handle null type', () => {
      const schema = { type: 'null' };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(null).success).toBe(true);
      expect(zodSchema.safeParse(undefined).success).toBe(false);
      expect(zodSchema.safeParse('null').success).toBe(false);
      expect(zodSchema.safeParse(0).success).toBe(false);
    });
  });

  describe('array schemas', () => {
    it('should handle basic array type', () => {
      const schema = { type: 'array' };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse([]).success).toBe(true);
      expect(zodSchema.safeParse([1, 2, 3]).success).toBe(true);
      expect(zodSchema.safeParse('not-array').success).toBe(false);
    });

    it('should handle array with items type', () => {
      const schema = { type: 'array', items: { type: 'string' } };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(['a', 'b', 'c']).success).toBe(true);
      expect(zodSchema.safeParse([]).success).toBe(true);
      expect(zodSchema.safeParse([1, 2, 3]).success).toBe(false);
      expect(zodSchema.safeParse(['a', 1, 'b']).success).toBe(false);
    });

    it('should handle minItems constraint', () => {
      const schema = { type: 'array', items: { type: 'number' }, minItems: 2 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse([1, 2]).success).toBe(true);
      expect(zodSchema.safeParse([1, 2, 3]).success).toBe(true);
      expect(zodSchema.safeParse([1]).success).toBe(false);
      expect(zodSchema.safeParse([]).success).toBe(false);
    });

    it('should handle maxItems constraint', () => {
      const schema = { type: 'array', items: { type: 'number' }, maxItems: 3 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse([1]).success).toBe(true);
      expect(zodSchema.safeParse([1, 2, 3]).success).toBe(true);
      expect(zodSchema.safeParse([1, 2, 3, 4]).success).toBe(false);
    });

    it('should handle nested array of objects', () => {
      const schema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
          },
          required: ['id'],
        },
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse([{ id: 1, name: 'test' }]).success).toBe(true);
      expect(zodSchema.safeParse([{ id: 1 }]).success).toBe(true);
      expect(zodSchema.safeParse([{ name: 'test' }]).success).toBe(false);
    });
  });

  describe('object schemas', () => {
    it('should handle basic object with properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({ name: 'John', age: 25 }).success).toBe(true);
      expect(zodSchema.safeParse({ name: 'John' }).success).toBe(true);
      expect(zodSchema.safeParse({}).success).toBe(true);
      expect(zodSchema.safeParse({ name: 123 }).success).toBe(false);
    });

    it('should handle required properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
        required: ['name'],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({ name: 'John', age: 25 }).success).toBe(true);
      expect(zodSchema.safeParse({ name: 'John' }).success).toBe(true);
      expect(zodSchema.safeParse({ age: 25 }).success).toBe(false);
      expect(zodSchema.safeParse({}).success).toBe(false);
    });

    it('should handle nested objects', () => {
      const schema = {
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
        },
        required: ['user'],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({ user: { name: 'John', email: 'john@example.com' } }).success).toBe(true);
      expect(zodSchema.safeParse({ user: { name: 'John' } }).success).toBe(true);
      expect(zodSchema.safeParse({ user: {} }).success).toBe(false);
      expect(zodSchema.safeParse({}).success).toBe(false);
    });

    it('should handle additionalProperties: false (strict mode)', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: false,
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({ name: 'John' }).success).toBe(true);
      expect(zodSchema.safeParse({}).success).toBe(true);
      expect(zodSchema.safeParse({ name: 'John', extra: 'field' }).success).toBe(false);
    });

    it('should handle additionalProperties with schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: { type: 'number' },
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({ name: 'John', score: 100 }).success).toBe(true);
      expect(zodSchema.safeParse({ name: 'John', a: 1, b: 2 }).success).toBe(true);
      expect(zodSchema.safeParse({ name: 'John', extra: 'string' }).success).toBe(false);
    });

    it('should handle object without properties but with additionalProperties schema', () => {
      const schema = {
        type: 'object',
        additionalProperties: { type: 'string' },
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({ a: 'hello', b: 'world' }).success).toBe(true);
      expect(zodSchema.safeParse({}).success).toBe(true);
      expect(zodSchema.safeParse({ a: 123 }).success).toBe(false);
    });

    it('should handle empty strict object', () => {
      const schema = {
        type: 'object',
        additionalProperties: false,
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({}).success).toBe(true);
      expect(zodSchema.safeParse({ any: 'property' }).success).toBe(false);
    });
  });

  describe('union types', () => {
    it('should handle anyOf', () => {
      const schema = {
        anyOf: [{ type: 'string' }, { type: 'number' }],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('hello').success).toBe(true);
      expect(zodSchema.safeParse(42).success).toBe(true);
      expect(zodSchema.safeParse(true).success).toBe(false);
    });

    it('should handle oneOf', () => {
      const schema = {
        oneOf: [{ type: 'string' }, { type: 'integer' }],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('hello').success).toBe(true);
      expect(zodSchema.safeParse(42).success).toBe(true);
      expect(zodSchema.safeParse(3.14).success).toBe(false);
    });

    it('should handle type arrays (e.g., ["string", "null"])', () => {
      const schema = { type: ['string', 'null'] };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('hello').success).toBe(true);
      expect(zodSchema.safeParse(null).success).toBe(true);
      expect(zodSchema.safeParse(42).success).toBe(false);
    });

    it('should handle anyOf with complex schemas', () => {
      const schema = {
        anyOf: [
          {
            type: 'object',
            properties: { type: { const: 'text' }, content: { type: 'string' } },
            required: ['type', 'content'],
          },
          {
            type: 'object',
            properties: { type: { const: 'number' }, value: { type: 'number' } },
            required: ['type', 'value'],
          },
        ],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({ type: 'text', content: 'hello' }).success).toBe(true);
      expect(zodSchema.safeParse({ type: 'number', value: 42 }).success).toBe(true);
      expect(zodSchema.safeParse({ type: 'text', value: 42 }).success).toBe(false);
    });

    it('should handle single item anyOf', () => {
      const schema = {
        anyOf: [{ type: 'string' }],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('hello').success).toBe(true);
      expect(zodSchema.safeParse(42).success).toBe(false);
    });

    it('should handle empty anyOf', () => {
      const schema = {
        anyOf: [],
      };
      const zodSchema = jsonSchemaToZod(schema);

      // Should return z.unknown() for empty anyOf
      expect(zodSchema.safeParse('anything').success).toBe(true);
    });

    it('should handle allOf (intersection)', () => {
      const schema = {
        allOf: [
          { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
          { type: 'object', properties: { age: { type: 'integer' } }, required: ['age'] },
        ],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({ name: 'John', age: 25 }).success).toBe(true);
      expect(zodSchema.safeParse({ name: 'John' }).success).toBe(false);
      expect(zodSchema.safeParse({ age: 25 }).success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty schema', () => {
      const schema = {};
      const zodSchema = jsonSchemaToZod(schema);

      // z.unknown() accepts anything
      expect(zodSchema.safeParse('anything').success).toBe(true);
      expect(zodSchema.safeParse(123).success).toBe(true);
      expect(zodSchema.safeParse(null).success).toBe(true);
      expect(zodSchema.safeParse({ complex: 'object' }).success).toBe(true);
    });

    it('should handle null schema input', () => {
      const zodSchema = jsonSchemaToZod(null as any);

      expect(zodSchema.safeParse('anything').success).toBe(true);
    });

    it('should handle undefined schema input', () => {
      const zodSchema = jsonSchemaToZod(undefined as any);

      expect(zodSchema.safeParse('anything').success).toBe(true);
    });

    it('should handle schema with no type but with properties', () => {
      const schema = {
        properties: {
          name: { type: 'string' },
        },
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({ name: 'John' }).success).toBe(true);
      expect(zodSchema.safeParse({ name: 123 }).success).toBe(false);
    });

    it('should handle schema with no type but with items', () => {
      const schema = {
        items: { type: 'string' },
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(['a', 'b']).success).toBe(true);
      expect(zodSchema.safeParse([1, 2]).success).toBe(false);
    });

    it('should handle schema with no type but with enum', () => {
      const schema = {
        enum: ['a', 'b', 'c'],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('a').success).toBe(true);
      expect(zodSchema.safeParse('b').success).toBe(true);
      expect(zodSchema.safeParse('d').success).toBe(false);
    });

    it('should handle const values', () => {
      const schema = { const: 'fixed-value' };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('fixed-value').success).toBe(true);
      expect(zodSchema.safeParse('other-value').success).toBe(false);
    });

    it('should handle const with number', () => {
      const schema = { const: 42 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(42).success).toBe(true);
      expect(zodSchema.safeParse(43).success).toBe(false);
    });

    it('should handle const with boolean', () => {
      const schema = { const: true };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(true).success).toBe(true);
      expect(zodSchema.safeParse(false).success).toBe(false);
    });

    it('should handle unknown type', () => {
      const schema = { type: 'unknown-type' };
      const zodSchema = jsonSchemaToZod(schema);

      // Should return z.unknown()
      expect(zodSchema.safeParse('anything').success).toBe(true);
    });

    it('should handle empty string enum', () => {
      const schema = { type: 'string', enum: [] };
      const zodSchema = jsonSchemaToZod(schema);

      // z.never() should reject everything
      expect(zodSchema.safeParse('anything').success).toBe(false);
    });

    it('should handle mixed type enum', () => {
      const schema = { enum: ['string', 42, true] };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse('string').success).toBe(true);
      expect(zodSchema.safeParse(42).success).toBe(true);
      expect(zodSchema.safeParse(true).success).toBe(true);
      expect(zodSchema.safeParse('other').success).toBe(false);
    });
  });

  describe('complex real-world schemas', () => {
    it('should handle a user registration schema', () => {
      const schema = {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 20, pattern: '^[a-zA-Z0-9_]+$' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          age: { type: 'integer', minimum: 18, maximum: 120 },
          newsletter: { type: 'boolean' },
        },
        required: ['username', 'email', 'password'],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(
        zodSchema.safeParse({
          username: 'john_doe',
          email: 'john@example.com',
          password: 'securepass123',
          age: 25,
          newsletter: true,
        }).success,
      ).toBe(true);

      expect(
        zodSchema.safeParse({
          username: 'john_doe',
          email: 'john@example.com',
          password: 'securepass123',
        }).success,
      ).toBe(true);

      expect(
        zodSchema.safeParse({
          username: 'jo', // too short
          email: 'john@example.com',
          password: 'securepass123',
        }).success,
      ).toBe(false);

      expect(
        zodSchema.safeParse({
          username: 'john_doe',
          email: 'invalid-email', // invalid format
          password: 'securepass123',
        }).success,
      ).toBe(false);
    });

    it('should handle a product catalog item schema', () => {
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', minLength: 1 },
          price: { type: 'number', minimum: 0, exclusiveMinimum: 0 },
          category: { type: 'string', enum: ['electronics', 'clothing', 'books', 'other'] },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
          metadata: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
        required: ['id', 'name', 'price', 'category'],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(
        zodSchema.safeParse({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Laptop',
          price: 999.99,
          category: 'electronics',
          tags: ['tech', 'computer'],
          metadata: { brand: 'Dell', model: 'XPS' },
        }).success,
      ).toBe(true);

      expect(
        zodSchema.safeParse({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Laptop',
          price: 0, // not > 0
          category: 'electronics',
        }).success,
      ).toBe(false);
    });

    it('should handle a workflow step definition schema', () => {
      const schema = {
        type: 'object',
        properties: {
          stepId: { type: 'string' },
          type: { type: 'string', enum: ['action', 'condition', 'parallel'] },
          config: {
            anyOf: [
              {
                type: 'object',
                properties: {
                  actionType: { const: 'http' },
                  url: { type: 'string', format: 'url' },
                  method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
                },
                required: ['actionType', 'url', 'method'],
              },
              {
                type: 'object',
                properties: {
                  actionType: { const: 'transform' },
                  expression: { type: 'string' },
                },
                required: ['actionType', 'expression'],
              },
            ],
          },
        },
        required: ['stepId', 'type'],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(
        zodSchema.safeParse({
          stepId: 'step-1',
          type: 'action',
          config: {
            actionType: 'http',
            url: 'https://api.example.com',
            method: 'POST',
          },
        }).success,
      ).toBe(true);

      expect(
        zodSchema.safeParse({
          stepId: 'step-2',
          type: 'action',
          config: {
            actionType: 'transform',
            expression: 'data.value * 2',
          },
        }).success,
      ).toBe(true);
    });
  });
});
