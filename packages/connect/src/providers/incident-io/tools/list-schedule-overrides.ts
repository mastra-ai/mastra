// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listScheduleOverridesInputSchema = z
  .object({
    schedule_id: z.string(),
    rotation_id: z.string().optional(),
    layer_id: z.string().optional(),
    page_size: z.number().int().min(1).max(250).optional(),
    after: z.string().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    overrides: z.array(
      z
        .object({
          created_at: z.string(),
          end_at: z.string(),
          id: z.string(),
          layer_id: z.string(),
          rotation_id: z.string(),
          schedule_id: z.string(),
          start_at: z.string(),
          updated_at: z.string(),
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
        })
        .passthrough(),
    ),
    pagination_meta: z
      .object({ after: z.string().optional(), page_size: z.number().int().max(250) })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const listScheduleOverridesOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listScheduleOverridesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_schedule_overrides',
    description: 'List schedule overrides in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listScheduleOverridesInputSchema,
    outputSchema: listScheduleOverridesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listScheduleOverridesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['schedule_id'] !== undefined)
        params['schedule_id'] = Array.isArray(input['schedule_id'])
          ? input['schedule_id'].join(',')
          : String(input['schedule_id']);
      if (input['rotation_id'] !== undefined)
        params['rotation_id'] = Array.isArray(input['rotation_id'])
          ? input['rotation_id'].join(',')
          : String(input['rotation_id']);
      if (input['layer_id'] !== undefined)
        params['layer_id'] = Array.isArray(input['layer_id']) ? input['layer_id'].join(',') : String(input['layer_id']);
      if (input['page_size'] !== undefined)
        params['page_size'] = Array.isArray(input['page_size'])
          ? input['page_size'].join(',')
          : String(input['page_size']);
      if (input['after'] !== undefined)
        params['after'] = Array.isArray(input['after']) ? input['after'].join(',') : String(input['after']);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/schedule_overrides`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
