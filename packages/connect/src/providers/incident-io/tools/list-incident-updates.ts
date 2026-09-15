// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listIncidentUpdatesInputSchema = z
  .object({
    incident_id: z.string().optional(),
    page_size: z.number().int().min(1).max(250).optional(),
    after: z.string().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    incident_updates: z.array(
      z
        .object({
          created_at: z.string(),
          id: z.string(),
          incident_id: z.string(),
          merged_into_incident_id: z.string().optional(),
          message: z.string().optional(),
          new_incident_status: z
            .object({
              category: z.enum(['triage', 'declined', 'merged', 'canceled', 'live', 'learning', 'closed', 'paused']),
              created_at: z.string(),
              description: z.string(),
              id: z.string(),
              name: z.string(),
              rank: z.number().int(),
              updated_at: z.string(),
            })
            .passthrough(),
          new_severity: z
            .object({
              created_at: z.string(),
              description: z.string(),
              id: z.string(),
              name: z.string().max(50),
              rank: z.number().int(),
              updated_at: z.string(),
            })
            .passthrough()
            .optional(),
          updater: z
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
        })
        .passthrough(),
    ),
    pagination_meta: z
      .object({ after: z.string().optional(), page_size: z.number().int().max(250) })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const listIncidentUpdatesOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listIncidentUpdatesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_incident_updates',
    description: 'List incident updates in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listIncidentUpdatesInputSchema,
    outputSchema: listIncidentUpdatesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIncidentUpdatesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['incident_id'] !== undefined)
        params['incident_id'] = Array.isArray(input['incident_id'])
          ? input['incident_id'].join(',')
          : String(input['incident_id']);
      if (input['page_size'] !== undefined)
        params['page_size'] = Array.isArray(input['page_size'])
          ? input['page_size'].join(',')
          : String(input['page_size']);
      if (input['after'] !== undefined)
        params['after'] = Array.isArray(input['after']) ? input['after'].join(',') : String(input['after']);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/incident_updates`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
