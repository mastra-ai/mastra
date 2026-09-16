// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const CapabilitySupportSchema = z.object({
  supported: z.boolean(),
});

const ContextManagementCapabilitySchema = z.object({
  clear_thinking_20251015: CapabilitySupportSchema,
  clear_tool_uses_20250919: CapabilitySupportSchema,
  compact_20260112: CapabilitySupportSchema,
  supported: z.boolean(),
});

const EffortCapabilitySchema = z.object({
  high: CapabilitySupportSchema,
  low: CapabilitySupportSchema,
  max: CapabilitySupportSchema,
  medium: CapabilitySupportSchema,
  supported: z.boolean(),
  xhigh: CapabilitySupportSchema.optional(),
});

const ThinkingTypesSchema = z.object({
  adaptive: CapabilitySupportSchema,
  enabled: CapabilitySupportSchema,
});

const ThinkingCapabilitySchema = z.object({
  supported: z.boolean(),
  types: ThinkingTypesSchema,
});

const ModelCapabilitiesSchema = z.object({
  batch: CapabilitySupportSchema,
  citations: CapabilitySupportSchema,
  code_execution: CapabilitySupportSchema,
  context_management: ContextManagementCapabilitySchema,
  effort: EffortCapabilitySchema,
  image_input: CapabilitySupportSchema,
  pdf_input: CapabilitySupportSchema,
  structured_outputs: CapabilitySupportSchema,
  thinking: ThinkingCapabilitySchema,
});

const ModelSchema = z.object({
  id: z.string(),
  capabilities: ModelCapabilitiesSchema,
  created_at: z.string(),
  display_name: z.string(),
  max_input_tokens: z.number(),
  max_tokens: z.number(),
  type: z.string(),
});

export const getModelInputSchema = z.object({
  model_id: z.string().min(1).describe('Model identifier or alias. Example: "claude-opus-4-6"'),
});

export const getModelOutputSchema = ModelSchema;

export function getModelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'anthropic_get_model',
    description: 'Retrieve a single model from Anthropic.',
    inputSchema: getModelInputSchema,
    outputSchema: getModelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getModelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.anthropic.com/en/api/models-get
      const response = await platformProxy.get({
        endpoint: `/v1/models/${encodeURIComponent(input.model_id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Model not found',
          model_id: input.model_id,
        });
      }

      const model = ModelSchema.parse(response.data);
      return model;
    },
  });
}
