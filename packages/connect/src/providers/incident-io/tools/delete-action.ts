// AUTO-GENERATED from rhysbalevicius/integration-templates @ c4fb0d5d5b2c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deleteActionInputSchema = z.object({ id: z.string() }).passthrough();

export const deleteActionOutputSchema = z.object({}).passthrough();

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
      await platformProxy.delete(config);
      return {};
    },
  });
}
