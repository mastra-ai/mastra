// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getActionInputSchema = z.object({ id: z.string() });

const ProviderResponseSchema = z
  .object({
    action: z
      .object({
        assignee: z
          .object({
            email: z.string().optional(),
            id: z.string(),
            name: z.string(),
            role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']),
            slack_user_id: z.string().optional(),
          })
          .passthrough()
          .optional(),
        completed_at: z.string().optional(),
        created_at: z.string(),
        creator: z
          .object({
            alert: z.object({ id: z.string(), title: z.string() }).passthrough().optional(),
            api_key: z.object({ id: z.string(), name: z.string() }).passthrough().optional(),
            user: z
              .object({
                email: z.string().optional(),
                id: z.string(),
                name: z.string(),
                role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']),
                slack_user_id: z.string().optional(),
              })
              .passthrough()
              .optional(),
            workflow: z.object({ id: z.string(), name: z.string() }).passthrough().optional(),
          })
          .passthrough(),
        description: z.string(),
        id: z.string(),
        incident_id: z.string(),
        status: z.enum(['outstanding', 'completed', 'deleted', 'not_doing']),
        updated_at: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const getActionOutputSchema = ProviderResponseSchema;

export function getActionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_action',
    description: 'Get action in incident.io.',
    inputSchema: getActionInputSchema,
    outputSchema: getActionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getActionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v3/actions/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
