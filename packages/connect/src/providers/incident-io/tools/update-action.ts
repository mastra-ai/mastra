// AUTO-GENERATED from rhysbalevicius/integration-templates @ c4fb0d5d5b2c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateActionInputSchema = z
  .object({
    id: z.string(),
    body: z
      .object({
        assignee_id: z.string().nullable().optional(),
        description: z.string(),
        status: z.enum(['outstanding', 'completed', 'deleted', 'not_doing']),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    action: z
      .object({
        assignee: z
          .object({
            email: z.string().optional(),
            id: z.string(),
            name: z.string(),
            role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']).or(z.string()),
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
                role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']).or(z.string()),
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
        status: z.enum(['outstanding', 'completed', 'deleted', 'not_doing']).or(z.string()),
        updated_at: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const updateActionOutputSchema = ProviderResponseSchema;

export function updateActionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_update_action',
    description: 'Update action in incident.io.',
    inputSchema: updateActionInputSchema,
    outputSchema: updateActionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateActionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v3/actions/${encodeURIComponent(input['id'])}`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.put(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
