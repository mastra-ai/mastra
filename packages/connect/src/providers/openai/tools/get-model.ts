// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getModelInputSchema = z.object({
  model: z.string().describe('Model ID. Example: "gpt-4o-mini"'),
});

const ProviderModelSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  owned_by: z.string(),
});

export const getModelOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  owned_by: z.string(),
});

export function getModelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_get_model',
    description: 'Retrieve a single model from OpenAI.',
    inputSchema: getModelInputSchema,
    outputSchema: getModelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getModelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://platform.openai.com/docs/api-reference/models/retrieve
      const response = await platformProxy.get({
        endpoint: `/v1/models/${encodeURIComponent(input.model)}`,
        retries: 3,
      });

      const providerModel = ProviderModelSchema.parse(response.data);

      return {
        id: providerModel.id,
        object: providerModel.object,
        created: providerModel.created,
        owned_by: providerModel.owned_by,
      };
    },
  });
}
