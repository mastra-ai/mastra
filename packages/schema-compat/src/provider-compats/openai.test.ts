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

    it('keeps shared annotations once and splits type-specific keywords into branches', () => {
      const result = compat.processToJSONSchema(structuredClone(searchToolSchema) as any) as Record<string, any>;
      const filter = result.properties.filter;

      // Shared annotation stays once on the containing property
      expect(filter.description).toBe('Filter object or saved filter name');
      expect(JSON.stringify(result).split('Filter object or saved filter name').length - 1).toBe(1);

      // Property itself no longer carries object-only structure
      expect(filter).not.toHaveProperty('properties');
      expect(filter).not.toHaveProperty('required');
      expect(filter).not.toHaveProperty('additionalProperties');
      expect(filter).not.toHaveProperty('x-optional');
      expect(filter).not.toHaveProperty('type');

      // anyOf has exactly object, string, and null branches
      const types = filter.anyOf.map((b: any) => b.type);
      expect(types).toEqual(['string', 'object', 'null']);

      // Only the object branch carries object structure
      const objectBranch = filter.anyOf.find((b: any) => b.type === 'object');
      expect(objectBranch.properties.field).toEqual({ type: 'string' });
      expect(objectBranch.additionalProperties).toBe(false);
      expect(objectBranch.required).toEqual(['field', 'note']);
      expect(objectBranch['x-optional']).toEqual(['note']);

      // The string branch carries no object-only keywords or nested subtree
      const stringBranch = filter.anyOf.find((b: any) => b.type === 'string');
      expect(stringBranch).toEqual({ type: 'string' });

      // Strict-mode invariants on the parent remain
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

    it('keeps enum and const constraints once while accepting optional nulls', async () => {
      const compatSchema = compat.processToCompatSchema({
        type: 'object',
        properties: {
          mode: { type: ['string', 'integer'], enum: ['fast', 'slow', 1, 2] },
          status: { type: 'string', const: 'ready' },
        },
        required: [],
      } as any);
      const result = compatSchema['~standard'].jsonSchema.input({ target: 'draft-07' }) as Record<string, any>;

      const mode = result.properties.mode;
      expect(mode.enum).toEqual(['fast', 'slow', 1, 2, null]);
      expect(mode.anyOf).toEqual([{ type: 'string' }, { type: 'integer' }, { type: 'null' }]);
      expect(JSON.stringify(mode).split('"enum"').length - 1).toBe(1);

      const status = result.properties.status;
      expect(status.enum).toEqual(['ready', null]);
      expect(status).not.toHaveProperty('const');

      const nullResult: any = await compatSchema['~standard'].validate({ mode: null, status: null });
      expect(nullResult).not.toHaveProperty('issues');
      expect(nullResult.value).toEqual({ mode: undefined, status: undefined });

      const validResult: any = await compatSchema['~standard'].validate({ mode: 'fast', status: 'ready' });
      expect(validResult).not.toHaveProperty('issues');
      const invalidResult: any = await compatSchema['~standard'].validate({ mode: 'invalid', status: 'waiting' });
      expect(invalidResult).toHaveProperty('issues');
    });

    it('does not duplicate subtrees for single-type optional object properties', () => {
      const result = compat.processToJSONSchema({
        type: 'object',
        properties: {
          settings: {
            type: 'object',
            description: 'Optional settings',
            properties: { theme: { type: 'string', description: 'THEME_MARKER' } },
            required: ['theme'],
            additionalProperties: false,
          },
        },
        required: [],
      } as any) as Record<string, any>;

      // The nested subtree is serialized once, in the object branch only
      expect(JSON.stringify(result).split('THEME_MARKER').length - 1).toBe(1);

      const settings = result.properties.settings;
      expect(settings.description).toBe('Optional settings');
      expect(settings).not.toHaveProperty('properties');
      expect(settings).not.toHaveProperty('required');
      expect(settings).not.toHaveProperty('additionalProperties');

      const objectBranch = settings.anyOf.find((b: any) => b.type === 'object');
      expect(objectBranch.properties.theme).toEqual({ type: 'string', description: 'THEME_MARKER' });
      expect(objectBranch.required).toEqual(['theme']);
      expect(objectBranch.additionalProperties).toBe(false);
    });

    it.each([
      ['multi-type', ['object', 'string']],
      ['single-type', 'object'],
    ] as const)('grows linearly for %s nested optional properties', (_, propertyType) => {
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
              type: propertyType,
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
