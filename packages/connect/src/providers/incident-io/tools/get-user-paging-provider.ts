// AUTO-GENERATED from rhysbalevicius/integration-templates @ 3ad35d4bf046 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getUserPagingProviderInputSchema = z.object({ user_id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({ preferred_escalation_provider: z.enum(['native', 'opsgenie', 'pagerduty', 'splunk_on_call']).optional() })
  .passthrough();

export const getUserPagingProviderOutputSchema = ProviderResponseSchema;

export function getUserPagingProviderTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_user_paging_provider',
    description: 'Get a user paging provider in incident.io.',
    inputSchema: getUserPagingProviderInputSchema,
    outputSchema: getUserPagingProviderOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserPagingProviderOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/users/${encodeURIComponent(input['user_id'])}/paging_provider`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
