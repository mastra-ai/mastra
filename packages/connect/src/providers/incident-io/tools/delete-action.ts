// AUTO-GENERATED from rhysbalevicius/integration-templates @ 3ad35d4bf046 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deleteActionInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z.object({}).passthrough();

export const deleteActionOutputSchema = ProviderResponseSchema;

export function deleteActionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_delete_action',
    description: 'Delete action in incident.io.',
    inputSchema: deleteActionInputSchema,
    outputSchema: deleteActionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteActionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v3/actions/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.delete(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
