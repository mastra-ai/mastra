import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { z as zV3 } from 'zod/v3';
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
  // propertyNames stripping
  //
  // z.record(...) emits a `propertyNames` keyword. OpenAI Structured Outputs
  // strict mode (the mode this layer targets) rejects `propertyNames`, so it must
  // be stripped, exactly as the Google layer already does. See google.test.ts.
  // =============================================================================

  describe('z.record handling (OpenAI strict mode)', () => {
    it('strips propertyNames emitted by z.record', () => {
      const schema = z.object({ metadata: z.record(z.string(), z.string()) });

      const json = JSON.stringify(compat.processToJSONSchema(schema));

      expect(json).not.toContain('"propertyNames"');
    });

    it('strips propertyNames on the reasoning layer too', () => {
      const reasoning = new OpenAIReasoningSchemaCompatLayer({
        provider: 'openai',
        modelId: 'o3-mini',
        supportsStructuredOutputs: true,
      });
      const schema = z.object({ metadata: z.record(z.string(), z.string()) });

      const json = JSON.stringify(reasoning.processToJSONSchema(schema));

      expect(json).not.toContain('"propertyNames"');
    });

    it('rewrites string-keyed records as key/value pair arrays', () => {
      const schema = z.object({ metadata: z.record(z.string(), z.string()) });

      const json = compat.processToJSONSchema(schema) as Record<string, any>;
      const metadata = json.properties.metadata;

      expect(metadata.type).toBe('array');
      expect(metadata['x-record']).toBe(true);
      expect(metadata.items).toMatchObject({
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['key', 'value'],
        additionalProperties: false,
      });
      expect(allPropsRequired(json).valid).toBe(true);
    });

    it('preserves the record value schema in the pair items', () => {
      const schema = z.object({ m: z.record(z.string(), z.object({ a: z.number() })) });

      const json = compat.processToJSONSchema(schema) as Record<string, any>;

      expect(json.properties.m.items.properties.value).toMatchObject({
        type: 'object',
        properties: { a: { type: 'number' } },
        required: ['a'],
        additionalProperties: false,
      });
    });

    it('folds pair arrays back into records during validation', async () => {
      const schema = z.object({ metadata: z.record(z.string(), z.string()) });

      const compatSchema = compat.processToCompatSchema(schema);
      const result = await compatSchema['~standard'].validate({
        metadata: [
          { key: 'a', value: '1' },
          { key: 'b', value: '2' },
        ],
      });

      expect(result).toEqual({ value: { metadata: { a: '1', b: '2' } } });
    });

    it('folds nested records back through multiple levels', async () => {
      const schema = z.object({ m: z.record(z.string(), z.record(z.string(), z.number())) });

      const compatSchema = compat.processToCompatSchema(schema);
      const result = await compatSchema['~standard'].validate({
        m: [{ key: 'outer', value: [{ key: 'inner', value: 1 }] }],
      });

      expect(result).toEqual({ value: { m: { outer: { inner: 1 } } } });
    });

    it('expands enum-keyed records into closed objects', async () => {
      const schema = z.object({ m: z.record(z.enum(['a', 'b']), z.string()) });

      const json = compat.processToJSONSchema(schema) as Record<string, any>;
      const m = json.properties.m;

      expect(m.properties).toEqual({ a: { type: 'string' }, b: { type: 'string' } });
      expect(m.required).toEqual(['a', 'b']);
      expect(m.additionalProperties).toBe(false);
      expect(JSON.stringify(json)).not.toContain('"propertyNames"');

      // No wire-format change, so the value validates without any fold-back.
      const compatSchema = compat.processToCompatSchema(schema);
      const result = await compatSchema['~standard'].validate({ m: { a: 'x', b: 'y' } });
      expect(result).toEqual({ value: { m: { a: 'x', b: 'y' } } });
    });

    it('handles optional records', async () => {
      const schema = z.object({ m: z.record(z.string(), z.string()).optional() });

      const json = compat.processToJSONSchema(schema) as Record<string, any>;
      const variants = json.properties.m.anyOf;

      expect(variants).toContainEqual({ type: 'null' });
      expect(variants.find((v: any) => v.type === 'array')?.['x-record']).toBe(true);

      const compatSchema = compat.processToCompatSchema(schema);
      const present = await compatSchema['~standard'].validate({ m: [{ key: 'a', value: 'b' }] });
      expect(present).toEqual({ value: { m: { a: 'b' } } });
      const absent = await compatSchema['~standard'].validate({ m: null });
      expect(absent).toEqual({ value: {} });
    });

    it('rewrites zod v3 records too', async () => {
      const schema = zV3.object({ metadata: zV3.record(zV3.string(), zV3.string()) });

      const json = compat.processToJSONSchema(schema) as Record<string, any>;
      expect(json.properties.metadata['x-record']).toBe(true);

      const compatSchema = compat.processToCompatSchema(schema);
      const result = await compatSchema['~standard'].validate({ metadata: [{ key: 'a', value: '1' }] });
      expect(result).toEqual({ value: { metadata: { a: '1' } } });
    });

    it('rewrites records on the reasoning layer', async () => {
      const reasoning = new OpenAIReasoningSchemaCompatLayer({
        provider: 'openai',
        modelId: 'o3-mini',
        supportsStructuredOutputs: true,
      });
      const schema = z.object({ metadata: z.record(z.string(), z.string()) });

      const json = reasoning.processToJSONSchema(schema) as Record<string, any>;
      expect(json.properties.metadata['x-record']).toBe(true);

      const compatSchema = reasoning.processToCompatSchema(schema);
      const result = await compatSchema['~standard'].validate({ metadata: [{ key: 'a', value: '1' }] });
      expect(result).toEqual({ value: { metadata: { a: '1' } } });
    });

    it('falls back to stripping propertyNames for top-level records', () => {
      const schema = z.record(z.string(), z.string());

      const json = compat.processToJSONSchema(schema) as Record<string, any>;

      expect(JSON.stringify(json)).not.toContain('"propertyNames"');
      expect(json.additionalProperties).toBe(false);
    });

    it('handles z.partialRecord: nullable values that fold back to absent keys', async () => {
      const schema = z.object({ m: z.partialRecord(z.enum(['a', 'b']), z.string()) });

      const json = compat.processToJSONSchema(schema) as Record<string, any>;
      const m = json.properties.m;
      // Strict mode requires every property, so keys are required but nullable.
      expect(m.required).toEqual(['a', 'b']);
      expect(m['x-optional']).toEqual(['a', 'b']);
      expect(JSON.stringify(json)).not.toContain('"propertyNames"');

      const compatSchema = compat.processToCompatSchema(schema);
      const full = await compatSchema['~standard'].validate({ m: { a: 'x', b: 'y' } });
      expect(full).toEqual({ value: { m: { a: 'x', b: 'y' } } });
      // null marks an omitted key; it must be deleted (not undefined) because
      // records validate any present key's value.
      const sparse = await compatSchema['~standard'].validate({ m: { a: 'x', b: null } });
      expect(sparse).toEqual({ value: { m: { a: 'x' } } });
    });

    it('rewrites records inside arrays', async () => {
      const schema = z.object({ list: z.array(z.record(z.string(), z.number())) });

      const json = compat.processToJSONSchema(schema) as Record<string, any>;
      expect(json.properties.list.items['x-record']).toBe(true);

      const compatSchema = compat.processToCompatSchema(schema);
      const result = await compatSchema['~standard'].validate({
        list: [[{ key: 'a', value: 1 }], [{ key: 'b', value: 2 }]],
      });
      expect(result).toEqual({ value: { list: [{ a: 1 }, { b: 2 }] } });
    });

    it('rewrites records inside unions', async () => {
      const schema = z.object({ u: z.union([z.record(z.string(), z.string()), z.number()]) });

      const json = compat.processToJSONSchema(schema) as Record<string, any>;
      expect(json.properties.u.anyOf.some((v: any) => v['x-record'] === true)).toBe(true);

      const compatSchema = compat.processToCompatSchema(schema);
      const asRecord = await compatSchema['~standard'].validate({ u: [{ key: 'a', value: 'b' }] });
      expect(asRecord).toEqual({ value: { u: { a: 'b' } } });
      const asNumber = await compatSchema['~standard'].validate({ u: 5 });
      expect(asNumber).toEqual({ value: { u: 5 } });
    });

    it('preserves .describe() text on rewritten records', () => {
      const schema = z.object({ m: z.record(z.string(), z.string()).describe('user metadata') });

      const json = compat.processToJSONSchema(schema) as Record<string, any>;

      expect(json.properties.m.description).toBe('user metadata');
    });

    it('folds back records whose values contain optional fields', async () => {
      const schema = z.object({
        m: z.record(z.string(), z.object({ a: z.string().optional() })),
      });

      const compatSchema = compat.processToCompatSchema(schema);
      const result = await compatSchema['~standard'].validate({
        m: [{ key: 'k', value: { a: null } }],
      });

      expect(result).toEqual({ value: { m: { k: {} } } });
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
