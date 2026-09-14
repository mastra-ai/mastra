// AUTO-GENERATED from rhysbalevicius/integration-templates @ 3ad35d4bf046 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listUsersInputSchema = z
  .object({
    email: z.string().optional(),
    slack_user_id: z.string().optional(),
    include_inactive: z.boolean().optional(),
    page_size: z.number().int().min(1).max(10000).optional(),
    after: z.string().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    pagination_meta: z.object({ after: z.string().optional(), page_size: z.number().int().max(250) }).passthrough(),
    users: z.array(
      z
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
    ),
  })
  .passthrough();

export const listUsersOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listUsersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_users',
    description: 'List users in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listUsersInputSchema,
    outputSchema: listUsersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUsersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['email'] !== undefined)
        params['email'] = Array.isArray(input['email']) ? input['email'].join(',') : String(input['email']);
      if (input['slack_user_id'] !== undefined)
        params['slack_user_id'] = Array.isArray(input['slack_user_id'])
          ? input['slack_user_id'].join(',')
          : String(input['slack_user_id']);
      if (input['include_inactive'] !== undefined)
        params['include_inactive'] = Array.isArray(input['include_inactive'])
          ? input['include_inactive'].join(',')
          : String(input['include_inactive']);
      if (input['page_size'] !== undefined)
        params['page_size'] = Array.isArray(input['page_size'])
          ? input['page_size'].join(',')
          : String(input['page_size']);
      if (input['after'] !== undefined)
        params['after'] = Array.isArray(input['after']) ? input['after'].join(',') : String(input['after']);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/users`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
