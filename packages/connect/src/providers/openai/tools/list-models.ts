// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listModelsInputSchema = z.object({
  // No input parameters required for listing models
});

const ProviderModelSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  owned_by: z.string(),
});

const ProviderResponseSchema = z.object({
  object: z.string(),
  data: z.array(ProviderModelSchema),
});

const ModelSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  owned_by: z.string(),
});

export const listModelsOutputSchema = z.object({
  models: z.array(ModelSchema),
});

export function listModelsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_list_models',
    description: 'List all models available to the authenticated organization',
    inputSchema: listModelsInputSchema,
    outputSchema: listModelsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listModelsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://platform.openai.com/docs/api-reference/models/list
      const response = await platformProxy.get({
        endpoint: '/v1/models',
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        models: providerData.data.map(model => ({
          id: model.id,
          object: model.object,
          created: model.created,
          owned_by: model.owned_by,
        })),
      };
    },
  });
}
