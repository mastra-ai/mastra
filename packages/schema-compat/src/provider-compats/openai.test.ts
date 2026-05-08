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
