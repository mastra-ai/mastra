import { describe, it, expect } from 'vitest';
import { generateDefaultValues } from '../generate-default-values';
import type { JsonSchema } from '@/lib/json-schema';

describe('generateDefaultValues', () => {
  describe('basic type defaults', () => {
    it('should generate empty string for string property', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({ name: '' });
    });

    it('should generate 0 for number property', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          count: { type: 'number' },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({ count: 0 });
    });

    it('should generate 0 for integer property', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          age: { type: 'integer' },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({ age: 0 });
    });

    it('should generate false for boolean property', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          active: { type: 'boolean' },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({ active: false });
    });

    it('should generate empty array for array property', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          items: { type: 'array' },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({ items: [] });
    });

    it('should generate null for null property', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          value: { type: 'null' },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({ value: null });
    });
  });

  describe('nested objects', () => {
    it('should generate defaults for nested object properties', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
          },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({
        user: { name: '', age: 0 },
      });
    });

    it('should handle deeply nested objects', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          a: {
            type: 'object',
            properties: {
              b: {
                type: 'object',
                properties: {
                  c: { type: 'string' },
                },
              },
            },
          },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({
        a: { b: { c: '' } },
      });
    });

    it('should return empty object for object without nested properties', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          data: { type: 'object' },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({ data: {} });
    });
  });

  describe('explicit defaults', () => {
    it('should use explicit default value when provided', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string', default: 'John' },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({ name: 'John' });
    });

    it('should use explicit default for number', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          count: { type: 'number', default: 10 },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({ count: 10 });
    });

    it('should use explicit default for boolean', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          active: { type: 'boolean', default: true },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({ active: true });
    });

    it('should use explicit default for nested object', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          config: { type: 'object', default: { key: 'value' } },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({ config: { key: 'value' } });
    });
  });

  describe('mixed types', () => {
    it('should handle mixed types at same level', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'number' },
          active: { type: 'boolean' },
          items: { type: 'array' },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({
        name: '',
        count: 0,
        active: false,
        items: [],
      });
    });
  });

  describe('edge cases', () => {
    it('should return empty object for undefined schema', () => {
      expect(generateDefaultValues(undefined)).toEqual({});
    });

    it('should return empty object for schema without properties', () => {
      const schema: JsonSchema = { type: 'object' };
      expect(generateDefaultValues(schema)).toEqual({});
    });

    it('should return empty object for empty properties', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {},
      };
      expect(generateDefaultValues(schema)).toEqual({});
    });

    it('should handle property with array type (union type)', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          value: { type: ['string', 'null'] },
        },
      };
      // Should use first type in array
      expect(generateDefaultValues(schema)).toEqual({ value: '' });
    });

    it('should handle unknown type with fallback to empty string', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          value: { type: 'unknown-type' },
        },
      };
      expect(generateDefaultValues(schema)).toEqual({ value: '' });
    });
  });

  describe('circular reference protection', () => {
    it('should handle very deep nesting by stopping at max depth', () => {
      // Create a deeply nested schema (deeper than MAX_DEPTH of 10)
      const createDeepSchema = (depth: number): JsonSchema => {
        if (depth === 0) {
          return {
            type: 'object',
            properties: {
              value: { type: 'string' },
            },
          };
        }
        return {
          type: 'object',
          properties: {
            nested: createDeepSchema(depth - 1).properties?.nested || { type: 'string' },
          },
        };
      };

      // This should not cause infinite recursion
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: {
                    type: 'object',
                    properties: {
                      level4: {
                        type: 'object',
                        properties: {
                          level5: {
                            type: 'object',
                            properties: {
                              level6: {
                                type: 'object',
                                properties: {
                                  level7: {
                                    type: 'object',
                                    properties: {
                                      level8: {
                                        type: 'object',
                                        properties: {
                                          level9: {
                                            type: 'object',
                                            properties: {
                                              level10: {
                                                type: 'object',
                                                properties: {
                                                  level11: { type: 'string' },
                                                },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      // Should complete without error and stop recursing at some point
      const result = generateDefaultValues(schema);
      expect(result).toBeDefined();
      expect(result.level1).toBeDefined();
    });
  });
});
