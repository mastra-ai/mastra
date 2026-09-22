// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const watchSettingsInputSchema = z
  .object({
    id: z.string().describe('A UUID or similar unique string that identifies this channel.'),
    token: z
      .string()
      .optional()
      .describe('An arbitrary string delivered to the target address with each notification.'),
    type: z.string().describe('The delivery mechanism type. Valid values are "web_hook" or "webhook".'),
    address: z.string().describe('The address where notifications are delivered for this channel.'),
    params: z
      .object({
        ttl: z
          .string()
          .optional()
          .describe('The time-to-live in seconds for the notification channel. Default is 604800.'),
      })
      .optional()
      .describe('Additional parameters controlling delivery channel behavior.'),
  })
  .describe('Input for subscribing to calendar settings changes.');

const ProviderChannelSchema = z.object({
  kind: z.string(),
  id: z.string(),
  resourceId: z.string(),
  resourceUri: z.string(),
  token: z.string().optional(),
  expiration: z.union([z.number(), z.string()]).optional(),
});

export const watchSettingsOutputSchema = z
  .object({
    kind: z.string().describe('Identifies this as a notification channel. Always "api#channel".'),
    id: z.string().describe('The UUID or unique string that identifies this channel.'),
    resourceId: z.string().describe('An opaque ID that identifies the watched resource.'),
    resourceUri: z.string().describe('A version-specific identifier for the watched resource.'),
    token: z.string().optional().describe('The arbitrary string delivered with each notification.'),
    expiration: z
      .number()
      .optional()
      .describe('Date and time of channel expiration as a Unix timestamp in milliseconds.'),
  })
  .describe('Output of a calendar settings watch channel subscription.');

export function watchSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_watch_settings',
    description: 'Subscribe to changes in calendar settings',
    inputSchema: watchSettingsInputSchema,
    outputSchema: watchSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof watchSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/workspace/calendar/api/v3/reference/settings/watch
        endpoint: '/calendar/v3/users/me/settings/watch',
        data: {
          id: input.id,
          ...(input.token !== undefined && { token: input.token }),
          type: input.type,
          address: input.address,
          ...(input.params !== undefined && {
            params: {
              ...(input.params.ttl !== undefined && { ttl: input.params.ttl }),
            },
          }),
        },
        retries: 3,
      });

      const channel = ProviderChannelSchema.parse(response.data);

      return {
        kind: channel.kind,
        id: channel.id,
        resourceId: channel.resourceId,
        resourceUri: channel.resourceUri,
        ...(channel.token !== undefined && { token: channel.token }),
        ...(channel.expiration !== undefined && { expiration: Number(channel.expiration) }),
      };
    },
  });
}
