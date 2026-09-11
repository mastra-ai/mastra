import Ajv from 'ajv';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ModelInformation } from '../types';
import { isZodType } from '../utils';
import { zodToJsonSchema } from '../zod-to-json';
import { OpenAISchemaCompatLayer } from './openai';
import { OpenAIReasoningSchemaCompatLayer } from './openai-reasoning';
import { createSuite, createOpenAISuite } from './test-suite';

/** Check if all properties are in the required array (OpenAI strict mode requirement) */
function allPropsRequired(jsonSchema: any): { valid: boolean; missing: string[] } {
  if (!jsonSchema.properties) return { valid: true, missing: [] };
  const propKeys = Object.keys(jsonSchema.properties);
  const required = jsonSchema.required || [];
  const missing = propKeys.filter(k => !required.includes(k));
  return { valid: missing.length === 0, missing };
}

describe('OpenAISchemaCompatLayer', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  };

  const compat = new OpenAISchemaCompatLayer(modelInfo);
  createSuite(compat);
  createOpenAISuite(compat);

  // Optional properties from external JSON Schema / MCP tools must not have their
  // nested subtrees copied across the containing property and anyOf branches, which
  // caused exponential schema growth with nesting depth.
  describe('optional properties from external JSON Schema', () => {
    const searchToolSchema = {
      type: 'object',
      properties: {
        query: { type: 'string' },
        filter: {
          type: ['string', 'object'],
          description: 'Filter object or saved filter name',
          properties: {
            field: { type: 'string' },
            note: { type: 'string' },
          },
          required: ['field'],
          additionalProperties: false,
        },
      },
      required: ['query'],
    };

    it('keeps recursive object structure only in the object branch', () => {
      const result = compat.processToJSONSchema(structuredClone(searchToolSchema) as any) as Record<string, any>;
      const filter = result.properties.filter;

      expect(filter).not.toHaveProperty('properties');
      expect(filter).not.toHaveProperty('required');
      expect(filter).not.toHaveProperty('additionalProperties');
      expect(filter).not.toHaveProperty('x-optional');
      expect(filter).not.toHaveProperty('type');

      const types = filter.anyOf.map((b: any) => b.type);
      expect(types).toEqual(['string', 'object', 'null']);

      expect(filter.description).toBe('Filter object or saved filter name');
      const objectBranch = filter.anyOf.find((b: any) => b.type === 'object');
      expect(objectBranch.properties.field).toEqual({ type: 'string' });
      expect(objectBranch.additionalProperties).toBe(false);
      expect(objectBranch.required).toEqual(['field', 'note']);
      expect(objectBranch['x-optional']).toEqual(['note']);

      const stringBranch = filter.anyOf.find((b: any) => b.type === 'string');
      expect(stringBranch).toEqual({ type: 'string' });
      expect(JSON.stringify(result).split('Filter object or saved filter name').length - 1).toBe(1);

      expect(result.required).toContain('filter');
      expect(result['x-optional']).toContain('filter');
      expect(result.additionalProperties).toBe(false);
    });

    it('still accepts an object, a string, and null through the compat validation path', async () => {
      const compatSchema = compat.processToCompatSchema(structuredClone(searchToolSchema) as any);

      const objectResult = await compatSchema['~standard'].validate({ query: 'a', filter: { field: 'name' } });
      expect(objectResult).not.toHaveProperty('issues');

      const stringResult = await compatSchema['~standard'].validate({ query: 'a', filter: 'saved-filter' });
      expect(stringResult).not.toHaveProperty('issues');

      // null was promoted by the compat layer, so it converts back to undefined
      const nullResult: any = await compatSchema['~standard'].validate({ query: 'a', filter: null });
      expect(nullResult).not.toHaveProperty('issues');
      expect(nullResult.value.filter).toBeUndefined();
    });

    it('converts branch-local nested optional nulls back to undefined', async () => {
      const compatSchema = compat.processToCompatSchema(structuredClone(searchToolSchema) as any);

      // `note` is optional inside the object branch; strict mode makes the model emit null
      const result: any = await compatSchema['~standard'].validate({
        query: 'a',
        filter: { field: 'name', note: null },
      });
      expect(result).not.toHaveProperty('issues');
      expect(result.value.filter.note).toBeUndefined();
    });

    it('keeps recursive object structure only in the object branch for single-type properties', () => {
      const result = compat.processToJSONSchema({
        type: 'object',
        properties: {
          filter: {
            type: 'object',
            description: 'Nested filter',
            properties: {
              field: { type: 'string', description: 'SINGLE_OBJECT_SENTINEL' },
              operator: { type: 'string' },
            },
            required: ['field', 'operator'],
            additionalProperties: false,
            anyOf: [
              {
                type: 'object',
                properties: {
                  operator: { type: 'string' },
                  field: { description: 'SINGLE_OBJECT_SENTINEL', type: 'string' },
                },
                required: ['operator', 'field'],
                additionalProperties: false,
              },
              { type: 'null' },
            ],
          },
        },
        required: [],
      } as any) as Record<string, any>;

      const filter = result.properties.filter;
      expect(filter).not.toHaveProperty('properties');
      expect(filter).not.toHaveProperty('required');
      expect(filter).not.toHaveProperty('additionalProperties');
      expect(filter).not.toHaveProperty('x-optional');
      expect(filter).not.toHaveProperty('type');
      expect(filter.description).toBe('Nested filter');

      const objectBranch = filter.anyOf.find((b: any) => b.type === 'object');
      expect(objectBranch.properties).toEqual({
        field: {
          type: 'string',
          description: 'SINGLE_OBJECT_SENTINEL',
        },
        operator: { type: 'string' },
      });
      expect(objectBranch.required).toEqual(['field', 'operator']);
      expect(objectBranch.additionalProperties).toBe(false);
      expect(filter.anyOf.find((b: any) => b.type === 'null')).toEqual({ type: 'null' });
      expect(JSON.stringify(filter).split('SINGLE_OBJECT_SENTINEL').length - 1).toBe(1);
    });

    it('keeps enum and const constraints out of the null branch for single-type properties', async () => {
      const schema = {
        type: 'object',
        properties: {
          filter: {
            type: 'object',
            enum: [{ field: 'name' }],
            properties: { field: { type: 'string' } },
            required: ['field'],
            additionalProperties: false,
          },
          tags: {
            type: 'array',
            const: ['stable'],
            items: { type: 'string' },
          },
        },
        required: [],
      } as any;
      const compatSchema = compat.processToCompatSchema(schema);
      const result = compatSchema['~standard'].jsonSchema.input({ target: 'draft-07' }) as Record<string, any>;

      const filter = result.properties.filter;
      expect(filter).not.toHaveProperty('enum');
      expect(filter.anyOf).toEqual([
        {
          type: 'object',
          enum: [{ field: 'name' }],
          properties: { field: { type: 'string' } },
          required: ['field'],
          additionalProperties: false,
        },
        { type: 'null' },
      ]);

      const tags = result.properties.tags;
      expect(tags).not.toHaveProperty('const');
      expect(tags.anyOf).toEqual([{ type: 'array', items: { type: 'string' }, const: ['stable'] }, { type: 'null' }]);

      const nullResult: any = await compatSchema['~standard'].validate({ filter: null, tags: null });
      expect(nullResult).not.toHaveProperty('issues');
      expect(nullResult.value).toEqual({ filter: undefined, tags: undefined });
    });

    it('preserves meaningful anyOf and oneOf constraints inside the non-null branch', () => {
      const result = compat.processToJSONSchema({
        type: 'object',
        properties: {
          anyFilter: {
            type: 'object',
            anyOf: [
              { properties: { kind: { const: 'x' } }, required: ['kind'] },
              { properties: { kind: { const: 'y' } }, required: ['kind'] },
            ],
            properties: { kind: { type: 'string' } },
            required: ['kind'],
            additionalProperties: false,
          },
          oneFilter: {
            type: 'object',
            oneOf: [
              { properties: { kind: { const: 'x' } }, required: ['kind'] },
              { properties: { kind: { const: 'y' } }, required: ['kind'] },
            ],
            properties: { kind: { type: 'string' } },
            required: ['kind'],
            additionalProperties: false,
          },
          arrayFilter: {
            type: 'array',
            items: { type: 'string' },
            anyOf: [{ maxItems: 0 }, { minItems: 2 }],
          },
        },
        required: [],
      } as any) as Record<string, any>;

      const anyObjectBranch = result.properties.anyFilter.anyOf.find((branch: any) => branch.type === 'object');
      expect(anyObjectBranch.anyOf).toHaveLength(2);
      expect(result.properties.anyFilter).not.toHaveProperty('oneOf');

      const oneObjectBranch = result.properties.oneFilter.anyOf.find((branch: any) => branch.type === 'object');
      expect(oneObjectBranch.oneOf).toHaveLength(2);
      expect(result.properties.oneFilter).not.toHaveProperty('oneOf');

      const arrayObjectBranch = result.properties.arrayFilter.anyOf.find((branch: any) => branch.type === 'array');
      expect(arrayObjectBranch.anyOf).toHaveLength(2);

      const validate = new Ajv({ strict: false }).compile(result);
      expect(validate({ anyFilter: null, oneFilter: null, arrayFilter: null })).toBe(true);
      expect(validate({ anyFilter: { kind: 'x' }, oneFilter: { kind: 'y' }, arrayFilter: ['a', 'b'] })).toBe(true);
      expect(validate({ anyFilter: null, oneFilter: null, arrayFilter: [] })).toBe(true);
      expect(validate({ anyFilter: { kind: 'z' }, oneFilter: { kind: 'x' }, arrayFilter: null })).toBe(false);
      expect(validate({ anyFilter: { kind: 'x' }, oneFilter: { kind: 'z' }, arrayFilter: null })).toBe(false);
      expect(validate({ anyFilter: null, oneFilter: null, arrayFilter: ['a'] })).toBe(false);
    });

    it('keeps items only in the array branch for array/string unions', () => {
      const result = compat.processToJSONSchema({
        type: 'object',
        properties: {
          tags: {
            type: ['array', 'string'],
            items: { type: 'string' },
          },
        },
        required: [],
      } as any) as Record<string, any>;

      const tags = result.properties.tags;
      expect(tags).not.toHaveProperty('items');

      const arrayBranch = tags.anyOf.find((b: any) => b.type === 'array');
      expect(arrayBranch.items).toEqual({ type: 'string' });

      const stringBranch = tags.anyOf.find((b: any) => b.type === 'string');
      expect(stringBranch).toEqual({ type: 'string' });
    });

    it('preserves meaningful constraints for nullable multi-type properties', () => {
      const result = compat.processToJSONSchema({
        type: 'object',
        properties: {
          unionValue: {
            type: ['object', 'string'],
            properties: { kind: { const: 'x' } },
            required: ['kind'],
            additionalProperties: false,
            anyOf: [
              { type: 'string', enum: ['ok', 'blocked'] },
              {
                type: 'object',
                properties: { kind: { const: 'x' } },
                required: ['kind'],
                additionalProperties: false,
              },
            ],
          },
          oneValue: {
            type: ['object', 'string'],
            properties: { kind: { const: 'x' } },
            required: ['kind'],
            additionalProperties: false,
            oneOf: [
              { type: 'string', const: 'ok' },
              {
                type: 'object',
                properties: { kind: { const: 'x' } },
                required: ['kind'],
                additionalProperties: false,
              },
            ],
          },
          notValue: {
            type: ['string', 'number'],
            not: { const: 'blocked' },
          },
          conditionalValue: {
            type: ['string', 'number'],
            if: { type: 'string' },
            then: { minLength: 2 },
            else: { minimum: 2 },
          },
        },
        required: [],
      } as any) as Record<string, any>;

      for (const property of Object.values(result.properties) as any[]) {
        expect(property.anyOf.find((branch: any) => branch.type === 'null')).toEqual({ type: 'null' });
      }
      for (const branch of result.properties.unionValue.anyOf.filter((branch: any) => branch.type !== 'null')) {
        expect(branch.anyOf).toHaveLength(2);
      }
      for (const branch of result.properties.oneValue.anyOf.filter((branch: any) => branch.type !== 'null')) {
        expect(branch.oneOf).toHaveLength(2);
      }
      for (const branch of result.properties.notValue.anyOf.filter((branch: any) => branch.type !== 'null')) {
        expect(branch.not).toEqual(expect.any(Object));
      }
      for (const branch of result.properties.conditionalValue.anyOf.filter((branch: any) => branch.type !== 'null')) {
        expect(branch.if).toEqual(expect.any(Object));
        expect(branch.then).toEqual(expect.any(Object));
        expect(branch.else).toEqual(expect.any(Object));
      }

      const validate = new Ajv({ strict: false }).compile(result);
      expect(validate({ unionValue: null, oneValue: null, notValue: null, conditionalValue: null })).toBe(true);
      expect(validate({ unionValue: { kind: 'x' }, oneValue: 'ok', notValue: 'ok', conditionalValue: 'ok' })).toBe(
        true,
      );
      expect(validate({ unionValue: 'blocked', oneValue: { kind: 'x' }, notValue: 2, conditionalValue: 2 })).toBe(true);
      expect(validate({ unionValue: 'invalid', oneValue: null, notValue: null, conditionalValue: null })).toBe(false);
      expect(validate({ unionValue: null, oneValue: 'invalid', notValue: null, conditionalValue: null })).toBe(false);
      expect(validate({ unionValue: null, oneValue: null, notValue: 'blocked', conditionalValue: null })).toBe(false);
      expect(validate({ unionValue: null, oneValue: null, notValue: null, conditionalValue: 'x' })).toBe(false);
      expect(validate({ unionValue: null, oneValue: null, notValue: null, conditionalValue: 1 })).toBe(false);
    });

    it('keeps semantically equal object const and enum values for nullable multi-type properties', () => {
      const result = compat.processToJSONSchema({
        type: 'object',
        properties: {
          value: {
            type: ['object', 'string'],
            const: { first: 1, second: 2 },
            enum: [{ second: 2, first: 1 }],
            properties: {
              first: { type: 'number' },
              second: { type: 'number' },
            },
            required: ['first', 'second'],
            additionalProperties: false,
          },
        },
        required: [],
      } as any) as Record<string, any>;

      expect(result.properties.value.enum).toEqual([{ first: 1, second: 2 }, null]);
      const validate = new Ajv({ strict: false }).compile(result);
      expect(validate({ value: null })).toBe(true);
      expect(validate({ value: { second: 2, first: 1 } })).toBe(true);
      expect(validate({ value: { first: 1, second: 3 } })).toBe(false);
    });

    it('compares const JSON values without treating nested keys as schema keywords', () => {
      const result = compat.processToJSONSchema({
        type: 'object',
        properties: {
          value: {
            type: 'object',
            properties: {
              required: { type: 'array', items: { type: 'string' } },
            },
            required: ['required'],
            additionalProperties: false,
            const: { required: ['first', 'second'] },
            anyOf: [
              {
                type: 'object',
                properties: {
                  required: { type: 'array', items: { type: 'string' } },
                },
                required: ['required'],
                additionalProperties: false,
                const: { required: ['second', 'first'] },
              },
              { type: 'null' },
            ],
          },
        },
        required: [],
      } as any) as Record<string, any>;

      const objectBranch = result.properties.value.anyOf.find((branch: any) => branch.type === 'object');
      expect(objectBranch.anyOf).toHaveLength(2);

      const validate = new Ajv({ strict: false }).compile(result);
      expect(validate({ value: null })).toBe(true);
      expect(validate({ value: { required: ['first', 'second'] } })).toBe(false);
      expect(validate({ value: { required: ['second', 'first'] } })).toBe(false);
    });

    it('preserves meaningful constraints for nullable single-type primitive properties', () => {
      const result = compat.processToJSONSchema({
        type: 'object',
        properties: {
          choice: {
            type: 'string',
            anyOf: [{ const: 'a' }, { const: 'b' }],
          },
          excluded: {
            type: 'string',
            not: { const: 'blocked' },
          },
        },
        required: [],
      } as any) as Record<string, any>;

      const choiceBranch = result.properties.choice.anyOf.find((branch: any) => branch.type === 'string');
      expect(choiceBranch.anyOf).toHaveLength(2);
      const excludedBranch = result.properties.excluded.anyOf.find((branch: any) => branch.type === 'string');
      expect(excludedBranch.not).toEqual(expect.any(Object));
      expect(result.properties.excluded).not.toHaveProperty('not');

      const validate = new Ajv({ strict: false }).compile(result);
      expect(validate({ choice: null, excluded: null })).toBe(true);
      expect(validate({ choice: 'a', excluded: 'ok' })).toBe(true);
      expect(validate({ choice: 'b', excluded: 'allowed' })).toBe(true);
      expect(validate({ choice: 'c', excluded: null })).toBe(false);
      expect(validate({ choice: null, excluded: 'blocked' })).toBe(false);
    });

    it('handles type arrays that already include null', () => {
      const result = compat.processToJSONSchema({
        type: 'object',
        properties: {
          value: { type: ['string', 'null'], minLength: 2 },
        },
        required: [],
      } as any) as Record<string, any>;

      const value = result.properties.value;
      // string constraints were already folded into the description by preprocessing
      expect(value.anyOf).toEqual([{ type: 'string' }, { type: 'null' }]);
      expect(value.description).toContain('minimum length 2');
      expect(value).not.toHaveProperty('type');
      expect(value).not.toHaveProperty('minLength');
    });

    it('preserves parent date metadata when traversing a multi-type property', async () => {
      const dateSchema = {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: (value: any) =>
            value.timestamp instanceof Date
              ? { value }
              : { issues: [{ message: 'timestamp must be a Date', path: ['timestamp'] }] },
          jsonSchema: {
            input: () => ({
              type: 'object',
              properties: {
                timestamp: {
                  type: ['string', 'number'],
                  format: 'date-time',
                  'x-date': true,
                },
              },
              required: [],
            }),
            output: () => ({}),
          },
        },
      } as any;
      const compatSchema = compat.processToCompatSchema(dateSchema);

      const result: any = await compatSchema['~standard'].validate({ timestamp: '2026-08-12T12:00:00.000Z' });
      expect(result).not.toHaveProperty('issues');
      expect(result.value.timestamp).toEqual(new Date('2026-08-12T12:00:00.000Z'));
    });

    it('keeps multi-type enum constraints once while accepting optional nulls', async () => {
      const compatSchema = compat.processToCompatSchema({
        type: 'object',
        properties: {
          mode: { type: ['string', 'integer'], enum: ['fast', 'slow', 1, 2] },
        },
        required: [],
      } as any);
      const result = compatSchema['~standard'].jsonSchema.input({ target: 'draft-07' }) as Record<string, any>;

      const mode = result.properties.mode;
      expect(mode.enum).toEqual(['fast', 'slow', 1, 2, null]);
      expect(mode.anyOf).toEqual([{ type: 'string' }, { type: 'integer' }, { type: 'null' }]);
      expect(JSON.stringify(mode).split('"enum"').length - 1).toBe(1);

      const nullResult: any = await compatSchema['~standard'].validate({ mode: null });
      expect(nullResult).not.toHaveProperty('issues');
      expect(nullResult.value).toEqual({ mode: undefined });

      const validResult: any = await compatSchema['~standard'].validate({ mode: 'fast' });
      expect(validResult).not.toHaveProperty('issues');
      const invalidResult: any = await compatSchema['~standard'].validate({ mode: 'invalid' });
      expect(invalidResult).toHaveProperty('issues');
    });

    it('grows linearly for reordered nested single-type optional objects', () => {
      function reverseSchemaOrder(value: unknown): unknown {
        if (Array.isArray(value)) return value.map(reverseSchemaOrder).reverse();
        if (!value || typeof value !== 'object') return value;
        return Object.fromEntries(
          Object.entries(value)
            .reverse()
            .map(([key, child]) => [key, reverseSchemaOrder(child)]),
        );
      }

      function nested(depth: number): Record<string, any> {
        if (depth === 0) {
          return {
            type: 'object',
            properties: {
              sentinel: { type: 'string', description: 'SINGLE_TYPE_SENTINEL' },
              sibling: { type: 'number' },
            },
            required: ['sentinel', 'sibling'],
            additionalProperties: false,
          };
        }
        const child = nested(depth - 1);
        return {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              properties: { child },
              required: ['child'],
              additionalProperties: false,
              anyOf: [
                {
                  type: 'object',
                  properties: { child: reverseSchemaOrder(child) },
                  required: ['child'],
                  additionalProperties: false,
                },
                { type: 'null' },
              ],
            },
          },
          required: [],
          additionalProperties: false,
        };
      }

      const sizes: number[] = [];
      for (const depth of [1, 2, 8]) {
        const json = JSON.stringify(compat.processToJSONSchema(nested(depth) as any));
        expect(json.split('SINGLE_TYPE_SENTINEL').length - 1).toBe(1);
        sizes.push(json.length);
      }

      const perLevel = sizes[1]! - sizes[0]!;
      expect(sizes[2]!).toBe(sizes[1]! + 6 * perLevel);
    });

    it('grows linearly for nested multi-type optional properties', () => {
      function nested(depth: number): Record<string, any> {
        if (depth === 0) {
          return {
            type: 'object',
            properties: { sentinel: { type: 'string', description: 'SENTINEL_MARKER' } },
            required: ['sentinel'],
            additionalProperties: false,
          };
        }
        return {
          type: 'object',
          properties: {
            filter: {
              type: ['object', 'string'],
              properties: { child: nested(depth - 1) },
              required: ['child'],
              additionalProperties: false,
            },
          },
          required: [],
          additionalProperties: false,
        };
      }

      const sizes: number[] = [];
      for (const depth of [1, 2, 8]) {
        const json = JSON.stringify(compat.processToJSONSchema(nested(depth) as any));
        expect(json.split('SENTINEL_MARKER').length - 1).toBe(1);
        sizes.push(json.length);
      }

      const perLevel = sizes[1]! - sizes[0]!;
      expect(sizes[2]!).toBe(sizes[1]! + 6 * perLevel);
    });
  });

  describe('optional scalar enum and const properties', () => {
    it('accepts null while retaining enum and const validation', () => {
      const result = compat.processToJSONSchema({
        type: 'object',
        properties: {
          format: { enum: ['image', 'text'] },
          kind: { const: 'input' },
        },
        required: [],
      } as any) as Record<string, any>;

      expect(result.properties.format).toEqual({
        anyOf: [{ type: 'string', enum: ['image', 'text'] }, { type: 'null' }],
      });
      expect(result.properties.kind).toEqual({
        anyOf: [{ type: 'string', const: 'input' }, { type: 'null' }],
      });

      const validate = new Ajv({ strict: false }).compile(result);
      expect(validate({ format: null, kind: null })).toBe(true);
      expect(validate({ format: 'image', kind: 'input' })).toBe(true);
      expect(validate({ format: 'audio', kind: 'output' })).toBe(false);
    });
  });

  // OpenAI strict mode rejects `propertyNames`, which z.record() emits for its key type.
  // See https://github.com/mastra-ai/mastra/issues/19273
  describe('z.record() under strict mode', () => {
    it('drops propertyNames from a top-level record', () => {
      const json = compat.processToJSONSchema(z.record(z.string(), z.string()));

      expect(json).not.toHaveProperty('propertyNames');
    });

    it('drops propertyNames from a nested record', () => {
      const json = compat.processToJSONSchema(z.object({ flags: z.record(z.string(), z.string()) }));

      expect(json.properties!['flags']).not.toHaveProperty('propertyNames');
    });
  });

  describe('shouldApply', () => {
    it('should apply for OpenAI models without structured outputs', () => {
      const modelInfo: ModelInformation = {
        provider: 'openai',
        modelId: 'gpt-4o',
        supportsStructuredOutputs: false,
      };

      const layer = new OpenAISchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
    });

    it('should apply for OpenAI models with structured outputs', () => {
      const modelInfo: ModelInformation = {
        provider: 'openai',
        modelId: 'gpt-4o',
        supportsStructuredOutputs: true,
      };

      const layer = new OpenAISchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(true);
    });

    it('should not apply for non-OpenAI models', () => {
      const modelInfo: ModelInformation = {
        provider: 'anthropic',
        modelId: 'claude-3-5-sonnet',
        supportsStructuredOutputs: false,
      };

      const layer = new OpenAISchemaCompatLayer(modelInfo);
      expect(layer.shouldApply()).toBe(false);
    });
  });

  // =============================================================================
  // Agent network structured output flow simulation
  //
  // When modelId is falsy (e.g., agent networks), the compat layer must still run.
  // execute.ts enables strictJsonSchema independently, so unprocessed schemas get rejected.
  // =============================================================================

  describe('agent network defaultCompletionSchema with falsy modelId', () => {
    // Exact schema from packages/core/src/loop/network/validation.ts:370-377
    const defaultCompletionSchemaNetwork = z.object({
      isComplete: z.boolean().describe('Whether the task is complete'),
      completionReason: z.string().describe('Explanation of why the task is or is not complete'),
      finalResult: z
        .string()
        .optional()
        .describe('The final result text to return to the user. omit if primitive result is sufficient'),
    });

    /**
     * Simulates the agent.ts structured output flow:
     *   1. Check if provider/modelId includes 'openai'
     *   2. Check isZodType(schema)
     *   3. Construct compat layer, call processToCompatSchema()
     *   4. Extract JSON schema from the compat schema
     *   5. strict mode enabled if provider.startsWith('openai')
     */
    function simulateAgentStructuredOutputFlow(schema: any, targetProvider: string, targetModelId: string | undefined) {
      let jsonSchema: Record<string, unknown>;

      // Optional chaining on targetModelId
      if (targetProvider.includes('openai') || targetModelId?.includes('openai')) {
        // Compat runs even with falsy modelId (no targetModelId guard)
        if (isZodType(schema)) {
          const modelInfo = {
            provider: targetProvider,
            modelId: targetModelId ?? '',
            supportsStructuredOutputs: false,
          };
          const isReasoningModel = /^o[1-5]/.test(targetModelId ?? '');
          const compat = isReasoningModel
            ? new OpenAIReasoningSchemaCompatLayer(modelInfo)
            : new OpenAISchemaCompatLayer(modelInfo);
          if (compat.shouldApply()) {
            const processed = compat.processToCompatSchema(schema);
            jsonSchema = processed['~standard'].jsonSchema.input({ target: 'draft-07' });
          } else {
            jsonSchema = zodToJsonSchema(schema) as Record<string, unknown>;
          }
        } else {
          jsonSchema = zodToJsonSchema(schema) as Record<string, unknown>;
        }
      } else {
        jsonSchema = zodToJsonSchema(schema) as Record<string, unknown>;
      }

      // Strict mode check is independent of compat layer
      const strictModeEnabled = targetProvider.startsWith('openai');

      return { jsonSchema, strictModeEnabled };
    }

    it('happy path: valid modelId → compat layer runs → schema is strict-mode compliant', () => {
      const { jsonSchema, strictModeEnabled } = simulateAgentStructuredOutputFlow(
        defaultCompletionSchemaNetwork,
        'openai.responses',
        'gpt-4o',
      );
      expect(strictModeEnabled).toBe(true);
      expect(allPropsRequired(jsonSchema).valid).toBe(true);
    });

    it('undefined modelId → compat layer still runs → schema is strict-mode compliant', () => {
      // Agent network with OpenAI, modelId is falsy.
      const { jsonSchema, strictModeEnabled } = simulateAgentStructuredOutputFlow(
        defaultCompletionSchemaNetwork,
        'openai.responses',
        undefined,
      );

      expect(strictModeEnabled).toBe(true);
      expect(allPropsRequired(jsonSchema).valid).toBe(true);
    });

    it('empty string modelId → compat layer still runs → schema is strict-mode compliant', () => {
      const { jsonSchema, strictModeEnabled } = simulateAgentStructuredOutputFlow(
        defaultCompletionSchemaNetwork,
        'openai.responses',
        '',
      );

      expect(strictModeEnabled).toBe(true);
      expect(allPropsRequired(jsonSchema).valid).toBe(true);
    });
  });
});
