// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listScheduleSyncRulesInputSchema = z
  .object({
    page_size: z.number().int().min(1).max(250).optional(),
    after: z.string().optional(),
    schedule_id: z.string(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    pagination_meta: z
      .object({ after: z.string().optional(), page_size: z.number().int().max(250) })
      .passthrough()
      .optional(),
    schedule_sync_rules: z.array(
      z
        .object({
          created_at: z.string(),
          id: z.string(),
          permanent_member_user_ids: z.array(z.string()),
          rotation_id: z.string().optional(),
          schedule_id: z.string(),
          schedule_sync_target: z
            .object({
              add_bot_to_group: z.boolean(),
              created_at: z.string(),
              id: z.string(),
              linked_schedules: z.array(
                z.object({ id: z.string(), name: z.string(), team_ids: z.array(z.string()) }).passthrough(),
              ),
              slack_team_id: z.string(),
              slack_user_group_id: z.string(),
              updated_at: z.string(),
            })
            .passthrough(),
          schedule_sync_target_id: z.string(),
          sync_type: z.enum(['on_call', 'all_users', 'next_on_call']).or(z.string()),
          updated_at: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listScheduleSyncRulesOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listScheduleSyncRulesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_schedule_sync_rules',
    description: 'List schedule sync rules in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listScheduleSyncRulesInputSchema,
    outputSchema: listScheduleSyncRulesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listScheduleSyncRulesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['page_size'] !== undefined) params['page_size'] = String(input['page_size']);
      if (input['after'] !== undefined) params['after'] = String(input['after']);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/schedules/${encodeURIComponent(input['schedule_id'])}/sync_rules`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
