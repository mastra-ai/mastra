import { describe, it, expect } from 'vitest';
import { flattenSchemaToVariables } from '../schema-to-variables';
import type { JsonSchema } from '@/lib/json-schema';

describe('flattenSchemaToVariables', () => {
  it('should return empty array for undefined schema', () => {
    expect(flattenSchemaToVariables(undefined)).toEqual([]);
  });

  it('should return empty array for schema without properties', () => {
    const schema: JsonSchema = { type: 'object' };
    expect(flattenSchemaToVariables(schema)).toEqual([]);
  });

  it('should flatten simple string properties', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'User name' },
        email: { type: 'string' },
      },
    };

    const result = flattenSchemaToVariables(schema);

    expect(result).toEqual([
      { path: 'name', label: 'name', description: 'User name', type: 'string' },
      { path: 'email', label: 'email', description: undefined, type: 'string' },
    ]);
  });

  it('should flatten nested object properties', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
        },
      },
    };

    const result = flattenSchemaToVariables(schema);

    expect(result).toEqual([
      { path: 'user', label: 'user', description: undefined, type: 'object' },
      { path: 'user.name', label: 'user.name', description: undefined, type: 'string' },
      { path: 'user.email', label: 'user.email', description: undefined, type: 'string' },
    ]);
  });

  it('should handle deeply nested properties', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        company: {
          type: 'object',
          properties: {
            address: {
              type: 'object',
              properties: {
                city: { type: 'string', description: 'City name' },
              },
            },
          },
        },
      },
    };

    const result = flattenSchemaToVariables(schema);

    expect(result).toContainEqual({
      path: 'company.address.city',
      label: 'company.address.city',
      description: 'City name',
      type: 'string',
    });
  });

  it('should respect maxDepth parameter', () => {
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
                    level4: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = flattenSchemaToVariables(schema, 2);

    const paths = result.map(v => v.path);
    expect(paths).toContain('level1');
    expect(paths).toContain('level1.level2');
    expect(paths).not.toContain('level1.level2.level3');
    expect(paths).not.toContain('level1.level2.level3.level4');
  });

  it('should handle array items with object properties', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
        },
      },
    };

    const result = flattenSchemaToVariables(schema);

    expect(result).toContainEqual({ path: 'users', label: 'users', description: undefined, type: 'array' });
    expect(result).toContainEqual({ path: 'users[].name', label: 'users[].name', description: undefined, type: 'string' });
    expect(result).toContainEqual({
      path: 'users[].email',
      label: 'users[].email',
      description: undefined,
      type: 'string',
    });
  });

  it('should use title as description fallback', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        field: { type: 'string', title: 'Field Title' },
      },
    };

    const result = flattenSchemaToVariables(schema);

    expect(result[0].description).toBe('Field Title');
  });

  it('should prefer description over title', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        field: { type: 'string', title: 'Field Title', description: 'Field Description' },
      },
    };

    const result = flattenSchemaToVariables(schema);

    expect(result[0].description).toBe('Field Description');
  });

  it('should handle union types', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        field: { type: ['string', 'null'] },
      },
    };

    const result = flattenSchemaToVariables(schema);

    expect(result[0].type).toBe('string | null');
  });

  it('should handle complex real-world schema', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        userName: { type: 'string', description: 'The user name' },
        companyName: { type: 'string', description: 'The company name' },
        context: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'User role' },
            permissions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  level: { type: 'number' },
                },
              },
            },
          },
        },
      },
    };

    const result = flattenSchemaToVariables(schema);
    const paths = result.map(v => v.path);

    expect(paths).toContain('userName');
    expect(paths).toContain('companyName');
    expect(paths).toContain('context');
    expect(paths).toContain('context.role');
    expect(paths).toContain('context.permissions');
    expect(paths).toContain('context.permissions[].name');
    expect(paths).toContain('context.permissions[].level');
  });
});
