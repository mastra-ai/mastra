// AUTO-GENERATED from rhysbalevicius/integration-templates @ c4fb0d5d5b2c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listUserNotificationMethodsInputSchema = z.object({ user_id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    notification_methods: z.array(
      z
        .object({
          address: z.string(),
          id: z.string(),
          is_usable: z.boolean(),
          method_type: z.enum(['app', 'email', 'microsoft_teams', 'phone', 'slack', 'whatsapp_message']).or(z.string()),
          phone_details: z.object({ supports_sms: z.boolean(), supports_voice: z.boolean() }).passthrough().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listUserNotificationMethodsOutputSchema = ProviderResponseSchema;

export function listUserNotificationMethodsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_user_notification_methods',
    description: 'List user notification methods in incident.io.',
    inputSchema: listUserNotificationMethodsInputSchema,
    outputSchema: listUserNotificationMethodsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUserNotificationMethodsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/users/${encodeURIComponent(input['user_id'])}/notification_methods`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
