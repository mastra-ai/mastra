// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createActionInputSchema = z
  .object({
    body: z
      .object({ assignee_id: z.string().optional(), description: z.string(), incident_id: z.string() })
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

export const createActionOutputSchema = ProviderResponseSchema;

export function createActionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_create_action',
    description: 'Create action in incident.io.',
    inputSchema: createActionInputSchema,
    outputSchema: createActionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createActionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v3/actions`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
