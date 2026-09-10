// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteResponseInputSchema = z.object({
  response_id: z.string().describe('The ID of the response to delete. Example: "resp_abc123"'),
});

const ProviderResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  deleted: z.boolean(),
});

export const deleteResponseOutputSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});

export function deleteResponseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_delete_response',
    description: 'Delete a stored OpenAI response',
    inputSchema: deleteResponseInputSchema,
    outputSchema: deleteResponseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteResponseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://platform.openai.com/docs/api-reference/responses/delete
        endpoint: `/v1/responses/${encodeURIComponent(input.response_id)}`,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        id: providerResponse.id,
        deleted: providerResponse.deleted,
      };
    },
  });
}
