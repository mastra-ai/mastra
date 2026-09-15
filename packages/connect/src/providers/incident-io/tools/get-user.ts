// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getUserInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    user: z
      .object({
        base_role: z
          .object({ description: z.string().optional(), id: z.string(), name: z.string(), slug: z.string() })
          .passthrough(),
        custom_roles: z.array(
          z
            .object({ description: z.string().optional(), id: z.string(), name: z.string(), slug: z.string() })
            .passthrough(),
        ),
        email: z.string().optional(),
        id: z.string(),
        is_active: z.boolean(),
        name: z.string(),
        role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']),
        seats: z
          .object({
            on_call: z.enum(['full_access', 'viewer_only', 'none']),
            response: z.enum(['full_access', 'viewer_only', 'none']),
          })
          .passthrough(),
        slack_user_id: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export const getUserOutputSchema = ProviderResponseSchema;

export function getUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_user',
    description: 'Get user in incident.io.',
    inputSchema: getUserInputSchema,
    outputSchema: getUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/users/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
