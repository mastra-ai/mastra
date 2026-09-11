// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listActionsInputSchema = z.object({
  page_size: z.number().int().min(1).max(250).optional(),
  after: z.string().optional(),
  incident_id: z.string().optional(),
  incident_mode: z.enum(['standard', 'retrospective', 'test', 'tutorial', 'stream']).optional(),
});

const ProviderResponseSchema = z
  .object({
    actions: z.array(
      z
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
    ),
    pagination_meta: z.object({ after: z.string().optional(), page_size: z.number().int().max(250) }).passthrough(),
  })
  .passthrough();

export const listActionsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listActionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_actions',
    description: 'List actions in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listActionsInputSchema,
    outputSchema: listActionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listActionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input['page_size'] !== undefined) params['page_size'] = input['page_size'];
      if (input['after'] !== undefined) params['after'] = input['after'];
      if (input['incident_id'] !== undefined) params['incident_id'] = input['incident_id'];
      if (input['incident_mode'] !== undefined) params['incident_mode'] = input['incident_mode'];
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v3/actions`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
