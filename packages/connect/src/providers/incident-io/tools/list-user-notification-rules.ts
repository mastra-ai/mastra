// AUTO-GENERATED from rhysbalevicius/integration-templates @ 3ad35d4bf046 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listUserNotificationRulesInputSchema = z.object({ user_id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    notification_rules: z.array(
      z
        .object({
          app: z
            .object({ push_notification_criticality: z.enum(['critical', 'active']) })
            .passthrough()
            .optional(),
          delay_seconds: z.number().int().min(0).max(1200).optional(),
          id: z.string(),
          method_target: z
            .object({
              all: z.object({}).passthrough().optional(),
              specific: z.object({ id: z.string() }).passthrough().optional(),
              type: z.enum(['specific', 'all']),
            })
            .passthrough(),
          method_type: z.enum(['app', 'email', 'microsoft_teams', 'phone', 'slack', 'whatsapp_message']),
          phone: z
            .object({ channel: z.enum(['sms', 'voice']) })
            .passthrough()
            .optional(),
          rule_type: z.enum(['high_urgency', 'low_urgency']),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listUserNotificationRulesOutputSchema = ProviderResponseSchema;

export function listUserNotificationRulesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_user_notification_rules',
    description: 'List user notification rules in incident.io.',
    inputSchema: listUserNotificationRulesInputSchema,
    outputSchema: listUserNotificationRulesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUserNotificationRulesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/users/${encodeURIComponent(input['user_id'])}/notification_rules`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
