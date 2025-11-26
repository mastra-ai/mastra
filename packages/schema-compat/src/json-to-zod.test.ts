import { describe, it, expect } from 'vitest';
import type { JsonSchema } from './json-to-zod';
import { jsonSchemaToZod } from './json-to-zod';

describe('jsonSchemaToZod', () => {
  describe('DiscriminatedUnion Detection', () => {
    it('should detect discriminatedUnion when multiple anyOf entries share a const property', () => {
      const schema: JsonSchema = {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'cat' },
              name: { type: 'string' },
              meow: { type: 'boolean' },
            },
            required: ['type', 'name'],
          },
          {
            type: 'object',
            properties: {
              type: { const: 'dog' },
              name: { type: 'string' },
              bark: { type: 'boolean' },
            },
            required: ['type', 'name'],
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('z.discriminatedUnion');
      expect(result).toContain('"type"');
      expect(result).toContain('cat');
      expect(result).toContain('dog');
    });

    it('should detect discriminatedUnion with three anyOf entries sharing const property', () => {
      const schema: JsonSchema = {
        anyOf: [
          {
            type: 'object',
            properties: {
              status: { const: 'pending' },
              id: { type: 'string' },
            },
            required: ['status'],
          },
          {
            type: 'object',
            properties: {
              status: { const: 'approved' },
              id: { type: 'string' },
              approvedBy: { type: 'string' },
            },
            required: ['status'],
          },
          {
            type: 'object',
            properties: {
              status: { const: 'rejected' },
              id: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['status'],
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('z.discriminatedUnion');
      expect(result).toContain('"status"');
      expect(result).toContain('pending');
      expect(result).toContain('approved');
      expect(result).toContain('rejected');
    });

    it('should detect discriminatedUnion when discriminator is not the first property', () => {
      const schema: JsonSchema = {
        anyOf: [
          {
            type: 'object',
            properties: {
              name: { type: 'string' },
              kind: { const: 'A' },
              value: { type: 'number' },
            },
            required: ['kind'],
          },
          {
            type: 'object',
            properties: {
              name: { type: 'string' },
              kind: { const: 'B' },
              value: { type: 'string' },
            },
            required: ['kind'],
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('z.discriminatedUnion');
      expect(result).toContain('"kind"');
    });

    it('should NOT create discriminatedUnion when anyOf entries have different const properties', () => {
      const schema: JsonSchema = {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'cat' },
              name: { type: 'string' },
            },
          },
          {
            type: 'object',
            properties: {
              color: { const: 'red' },
              name: { type: 'string' },
            },
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).not.toContain('z.discriminatedUnion');
    });

    it('should NOT create discriminatedUnion when only one anyOf entry has const property', () => {
      const schema: JsonSchema = {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'cat' },
              name: { type: 'string' },
            },
          },
          {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).not.toContain('z.discriminatedUnion');
    });

    it('should NOT create discriminatedUnion when anyOf entries are not all objects', () => {
      const schema: JsonSchema = {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'cat' },
            },
          },
          {
            type: 'string',
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).not.toContain('z.discriminatedUnion');
    });

    it('should NOT create discriminatedUnion when anyOf entries do not have properties', () => {
      const schema: JsonSchema = {
        anyOf: [
          {
            type: 'object',
          },
          {
            type: 'object',
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).not.toContain('z.discriminatedUnion');
    });

    it('should create discriminatedUnion when at least one common const property exists', () => {
      const schema: JsonSchema = {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'cat' },
              name: { type: 'string' },
            },
          },
          {
            type: 'object',
            properties: {
              type: { const: 'dog' },
              name: { type: 'string' },
              breed: { const: 'labrador' },
            },
          },
        ],
      };

      // This should still create discriminatedUnion because 'type' is common
      const result = jsonSchemaToZod(schema);
      expect(result).toContain('z.discriminatedUnion');
      expect(result).toContain('"type"');
    });

    it('should preserve discriminatedUnion when nested inside allOf intersection', () => {
      const schema: JsonSchema = {
        allOf: [
          {
            anyOf: [
              {
                type: 'object',
                properties: {
                  type: { const: 'byCity' },
                  city: { type: 'string' },
                },
                required: ['type', 'city'],
              },
              {
                type: 'object',
                properties: {
                  type: { const: 'byCoords' },
                  lat: { type: 'number' },
                  lon: { type: 'number' },
                },
                required: ['type', 'lat', 'lon'],
              },
            ],
          },
          {
            type: 'object',
            properties: {
              orderBy: { type: 'string' },
            },
            required: ['orderBy'],
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('z.discriminatedUnion');
      expect(result).toContain('.intersection('); // intersection with the ordering object
    });

    it('should handle discriminatedUnion with multiple const properties and use first common one', () => {
      const schema: JsonSchema = {
        anyOf: [
          {
            type: 'object',
            properties: {
              category: { const: 'animal' },
              type: { const: 'cat' },
              name: { type: 'string' },
            },
            required: ['category', 'type'],
          },
          {
            type: 'object',
            properties: {
              category: { const: 'animal' },
              type: { const: 'dog' },
              name: { type: 'string' },
            },
            required: ['category', 'type'],
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('z.discriminatedUnion');
      // Should use the first common discriminator (category)
      expect(result).toContain('"category"');
    });
  });

  describe('Object Parsing', () => {
    describe('Properties', () => {
      it('should parse simple object with properties', () => {
        const schema: JsonSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('z.object');
        expect(result).toContain('"name"');
        expect(result).toContain('"age"');
        expect(result).toContain('z.string()');
        expect(result).toContain('z.number()');
      });

      it('should mark optional properties correctly', () => {
        const schema: JsonSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name'],
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('"name":');
        expect(result).toContain('"age":');
        // age should be optional
        expect(result).toMatch(/"age":\s*[^,]+\.optional\(\)/);
        // name should not be optional
        expect(result).not.toMatch(/"name":\s*[^,]+\.optional\(\)/);
      });

      it('should handle empty object', () => {
        const schema: JsonSchema = {
          type: 'object',
          properties: {},
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('z.object({})');
      });

      it('should handle properties with default values', () => {
        const schema: JsonSchema = {
          type: 'object',
          properties: {
            name: { type: 'string', default: 'John' },
            age: { type: 'number' },
          },
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('"name":');
        // name should not be optional because it has a default
        expect(result).not.toMatch(/"name":\s*[^,]+\.optional\(\)/);
      });
    });

    describe('AdditionalProperties', () => {
      it('should handle additionalProperties: true', () => {
        const schema: JsonSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          additionalProperties: true,
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('.catchall');
        expect(result).toContain('z.any()');
      });

      it('should handle additionalProperties with schema', () => {
        const schema: JsonSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          additionalProperties: { type: 'string' },
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('.catchall');
        expect(result).toContain('z.string()');
      });

      it('should not add strict() when additionalProperties: false', () => {
        const schema: JsonSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          additionalProperties: false,
        };

        const result = jsonSchemaToZod(schema);
        expect(result).not.toContain('.strict()');
      });

      it('should handle object with only additionalProperties (no properties)', () => {
        const schema: JsonSchema = {
          type: 'object',
          additionalProperties: { type: 'number' },
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('z.record');
        expect(result).toContain('z.number()');
      });
    });

    describe('PatternProperties', () => {
      it('should handle patternProperties with single pattern', () => {
        const schema: JsonSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          patternProperties: {
            '^[0-9]+$': { type: 'number' },
          },
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('.catchall');
        expect(result).toContain('.superRefine');
        expect(result).toContain('key.match(new RegExp');
        expect(result).toContain('^[0-9]+$');
      });

      it('should handle patternProperties with multiple patterns', () => {
        const schema: JsonSchema = {
          type: 'object',
          patternProperties: {
            '^str_': { type: 'string' },
            '^num_': { type: 'number' },
          },
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('z.record');
        expect(result).toContain('z.union');
        expect(result).toContain('.superRefine');
        expect(result).toContain('^str_');
        expect(result).toContain('^num_');
      });

      it('should handle patternProperties with additionalProperties', () => {
        const schema: JsonSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          patternProperties: {
            '^meta_': { type: 'string' },
          },
          additionalProperties: { type: 'number' },
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('.catchall');
        expect(result).toContain('z.union');
        expect(result).toContain('.superRefine');
        expect(result).toContain('evaluated');
      });

      it('should generate superRefine with proper error messages', () => {
        const schema: JsonSchema = {
          type: 'object',
          patternProperties: {
            '^test_': { type: 'string' },
          },
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('ctx.addIssue');
        expect(result).toContain('Invalid input: Key matching regex');
        expect(result).toContain('must match schema');
        expect(result).toContain("code: 'custom'");
      });

      it('should handle patternProperties with additionalProperties error handling', () => {
        const schema: JsonSchema = {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          patternProperties: {
            '^meta_': { type: 'string' },
          },
          additionalProperties: { type: 'number' },
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('Invalid input: must match catchall schema');
        expect(result).toContain('if (!evaluated)');
      });

      it('should handle patternProperties without properties', () => {
        const schema: JsonSchema = {
          type: 'object',
          patternProperties: {
            '^[a-z]+$': { type: 'string' },
          },
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('z.record');
        expect(result).toContain('.superRefine');
      });
    });

    describe('Combinations', () => {
      it('should handle properties + additionalProperties', () => {
        const schema: JsonSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          additionalProperties: { type: 'number' },
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('z.object');
        expect(result).toContain('.catchall');
      });

      it('should handle properties + patternProperties', () => {
        const schema: JsonSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          patternProperties: {
            '^meta_': { type: 'string' },
          },
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('z.object');
        expect(result).toContain('.catchall');
        expect(result).toContain('.superRefine');
      });

      it('should handle all three: properties + patternProperties + additionalProperties', () => {
        const schema: JsonSchema = {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          patternProperties: {
            '^meta_': { type: 'string' },
          },
          additionalProperties: { type: 'number' },
        };

        const result = jsonSchemaToZod(schema);
        expect(result).toContain('z.object');
        expect(result).toContain('.catchall');
        expect(result).toContain('z.union');
        expect(result).toContain('.superRefine');
      });
    });
  });

  describe('Recursion and Seen Caching', () => {
    it('should handle seen caching for recursive schemas', () => {
      const recursiveSchema: JsonSchema = {
        type: 'object',
        properties: {
          value: { type: 'string' },
          next: {
            type: 'object',
            properties: {
              value: { type: 'string' },
            },
          },
        },
      };

      // Use the same schema reference to test caching
      const result1 = jsonSchemaToZod(recursiveSchema);
      const result2 = jsonSchemaToZod(recursiveSchema);
      expect(result1).toBe(result2);
    });

    it('should handle depth: undefined (no limit)', () => {
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
                      value: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = jsonSchemaToZod(schema, { depth: undefined });
      expect(result).not.toContain('z.any()');
      expect(result).toContain('value');
    });
  });

  describe('Defaults Handling', () => {
    it('should add .default() for object with default', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        default: { name: 'John' },
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('.default(');
      expect(result).toContain('"John"');
    });

    it('should add .default() for string with default', () => {
      const schema: JsonSchema = {
        type: 'string',
        default: 'hello',
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('.default(');
      expect(result).toContain('"hello"');
    });

    it('should add .default() for number with default', () => {
      const schema: JsonSchema = {
        type: 'number',
        default: 42,
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('.default(');
      expect(result).toContain('42');
    });

    it('should add .default() for boolean with default', () => {
      const schema: JsonSchema = {
        type: 'boolean',
        default: true,
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('.default(');
      expect(result).toContain('true');
    });

    it('should handle withoutDefaults option', () => {
      const schema: JsonSchema = {
        type: 'string',
        default: 'test',
      };

      const result = jsonSchemaToZod(schema, { withoutDefaults: true });
      expect(result).not.toContain('.default(');
    });

    it('should handle default: null', () => {
      const schema: JsonSchema = {
        type: 'string',
        default: null,
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('.default(');
      expect(result).toContain('null');
    });
  });

  describe('Readonly Handling', () => {
    it('should add .readonly() for readOnly: true', () => {
      const schema: JsonSchema = {
        type: 'string',
        readOnly: true,
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('.readonly()');
    });

    it('should not add .readonly() for readOnly: false', () => {
      const schema: JsonSchema = {
        type: 'string',
        readOnly: false,
      };

      const result = jsonSchemaToZod(schema);
      expect(result).not.toContain('.readonly()');
    });

    it('should add .readonly() for object with readOnly', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        readOnly: true,
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('.readonly()');
    });
  });

  describe('Description Handling', () => {
    it('should add .describe() for schema with description', () => {
      const schema: JsonSchema = {
        type: 'string',
        description: 'A test string',
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('.describe(');
      expect(result).toContain('"A test string"');
    });

    it('should add .describe() for object with description', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        description: 'User object',
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('.describe(');
      expect(result).toContain('"User object"');
    });

    it('should handle withoutDescribes option', () => {
      const schema: JsonSchema = {
        type: 'string',
        description: 'Test',
      };

      const result = jsonSchemaToZod(schema, { withoutDescribes: true });
      expect(result).not.toContain('.describe(');
    });

    it('should handle description with special characters', () => {
      const schema: JsonSchema = {
        type: 'string',
        description: 'Test "quotes" and \'apostrophes\'',
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('.describe(');
      // Should properly escape the description
      expect(result).toContain('Test');
    });
  });

  describe('Complex Combinations', () => {
    it('should handle object with all features: description, default, readOnly, properties, additionalProperties', () => {
      const schema: JsonSchema = {
        type: 'object',
        description: 'Complex user object',
        default: { name: 'John', age: 30 },
        readOnly: true,
        properties: {
          name: { type: 'string', description: 'User name' },
          age: { type: 'number' },
        },
        additionalProperties: { type: 'string' },
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('.describe(');
      expect(result).toContain('.default(');
      expect(result).toContain('.readonly()');
      expect(result).toContain('.catchall(');
      expect(result).toContain('z.object');
    });

    it('should handle discriminatedUnion with description and defaults', () => {
      const schema: JsonSchema = {
        description: 'Animal discriminator',
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'cat', description: 'Cat type' },
              name: { type: 'string', default: 'Fluffy' },
            },
            required: ['type'],
          },
          {
            type: 'object',
            properties: {
              type: { const: 'dog', description: 'Dog type' },
              name: { type: 'string', default: 'Rex' },
            },
            required: ['type'],
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('z.discriminatedUnion');
      expect(result).toContain('.describe(');
    });
  });

  describe('Edge Cases', () => {
    it('should handle anyOf with allOf', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        allOf: [
          {
            properties: {
              age: { type: 'number' },
            },
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('.and(');
    });

    it('should handle anyOf with oneOf', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        oneOf: [
          {
            properties: {
              type: { type: 'string' },
            },
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('.and(');
    });

    it('should handle object without type but with properties', () => {
      const schema: JsonSchema = {
        properties: {
          name: { type: 'string' },
        },
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('z.any');
    });

    it('should handle nested objects with all features', () => {
      const schema: JsonSchema = {
        type: 'object',
        description: 'Root object',
        properties: {
          nested: {
            type: 'object',
            description: 'Nested object',
            properties: {
              value: {
                type: 'string',
                default: 'test',
                readOnly: true,
                description: 'Nested value',
              },
            },
            additionalProperties: { type: 'number' },
          },
        },
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toContain('z.object');
      expect(result).toContain('nested');
      expect(result).toContain('value');
    });
  });

  describe('Snapshot Tests', () => {
    it('should match snapshot for complex discriminatedUnion schema', () => {
      const schema: JsonSchema = {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'user' },
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
            },
            required: ['type', 'id', 'email'],
          },
          {
            type: 'object',
            properties: {
              type: { const: 'admin' },
              id: { type: 'string' },
              name: { type: 'string' },
              permissions: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['type', 'id', 'permissions'],
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot for complex object with patternProperties and additionalProperties', () => {
      const schema: JsonSchema = {
        type: 'object',
        description: 'Complex object with patterns',
        properties: {
          id: { type: 'string', description: 'Unique identifier' },
          name: { type: 'string', default: 'Unknown' },
        },
        patternProperties: {
          '^meta_': { type: 'string' },
          '^data_': { type: 'number' },
        },
        additionalProperties: { type: 'boolean' },
        readOnly: true,
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot for deeply nested recursive schema', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          value: { type: 'string' },
          children: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                value: { type: 'string' },
                children: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      value: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot for object with allOf, oneOf, and anyOf', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          base: { type: 'string' },
        },
        allOf: [
          {
            properties: {
              allOfProp: { type: 'number' },
            },
          },
        ],
        oneOf: [
          {
            properties: {
              oneOfProp: { type: 'boolean' },
            },
          },
        ],
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'variant' },
              variantProp: { type: 'string' },
            },
            required: ['type'],
          },
        ],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toMatchSnapshot();
    });

    it('should match snapshot for complete feature set', () => {
      const schema: JsonSchema = {
        type: 'object',
        description: 'Complete feature test',
        default: { id: '1', name: 'Test' },
        readOnly: false,
        properties: {
          id: {
            type: 'string',
            description: 'ID field',
            default: 'default-id',
            readOnly: true,
          },
          name: {
            type: 'string',
            description: 'Name field',
          },
          metadata: {
            type: 'object',
            description: 'Metadata object',
            properties: {
              created: { type: 'string' },
            },
            additionalProperties: { type: 'string' },
          },
        },
        patternProperties: {
          '^custom_': { type: 'string' },
        },
        additionalProperties: { type: 'number' },
        required: ['id'],
      };

      const result = jsonSchemaToZod(schema);
      expect(result).toMatchSnapshot();
    });
  });
});
