// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getScheduleSyncRuleInputSchema = z.object({ schedule_id: z.string(), id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    schedule_sync_rule: z
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
        sync_type: z.enum(['on_call', 'all_users', 'next_on_call']),
        updated_at: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const getScheduleSyncRuleOutputSchema = ProviderResponseSchema;

export function getScheduleSyncRuleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_schedule_sync_rule',
    description: 'Get schedule sync rule in incident.io.',
    inputSchema: getScheduleSyncRuleInputSchema,
    outputSchema: getScheduleSyncRuleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getScheduleSyncRuleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/schedules/${encodeURIComponent(input['schedule_id'])}/sync_rules/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
