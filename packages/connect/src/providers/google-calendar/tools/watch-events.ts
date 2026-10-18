// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const watchEventsInputSchema = z
  .object({
    calendarId: z
      .string()
      .describe('Calendar identifier. Use "primary" for the primary calendar of the authenticated user.'),
    channelId: z.string().describe('A UUID or similar unique string that identifies this notification channel.'),
    address: z.string().describe('The URL where notifications are delivered for this channel.'),
    type: z
      .string()
      .optional()
      .describe('The type of delivery mechanism. Valid values are "web_hook" or "webhook". Defaults to "web_hook".'),
    token: z
      .string()
      .optional()
      .describe('An arbitrary string delivered to the target address with each notification.'),
    ttl: z
      .number()
      .int()
      .optional()
      .describe('Time-to-live in seconds for the notification channel. Default is 604800 seconds (7 days).'),
  })
  .describe('Input to subscribe to event changes on a Google Calendar.');

export const watchEventsOutputSchema = z
  .object({
    kind: z.string().describe('Identifies this as a notification channel. Value is "api#channel".'),
    id: z.string().describe('A UUID or similar unique string that identifies this channel.'),
    resourceId: z.string().describe('An opaque ID that identifies the resource being watched on this channel.'),
    resourceUri: z.string().describe('A version-specific identifier for the watched resource.'),
    token: z
      .string()
      .optional()
      .describe('An arbitrary string delivered to the target address with each notification.'),
    expiration: z
      .string()
      .optional()
      .describe('Expiration time as a Unix timestamp (long), or omitted if no expiration.'),
  })
  .describe('Output of a successful calendar event watch subscription, containing channel and resource identifiers.');

export function watchEventsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_watch_events',
    description: 'Subscribe to event changes on a calendar',
    inputSchema: watchEventsInputSchema,
    outputSchema: watchEventsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof watchEventsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const body: {
        id: string;
        type: string;
        address: string;
        token?: string;
        params?: {
          ttl?: string;
        };
      } = {
        id: input.channelId,
        type: input.type || 'web_hook',
        address: input.address,
      };

      if (input.token !== undefined) {
        body.token = input.token;
      }

      if (input.ttl !== undefined) {
        body.params = { ttl: String(input.ttl) };
      }

      const response = await platformProxy.post({
        // https://developers.google.com/workspace/calendar/api/v3/reference/events/watch
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/watch`,
        data: body,
        retries: 3,
      });

      const providerResponse = z
        .object({
          kind: z.string(),
          id: z.string(),
          resourceId: z.string(),
          resourceUri: z.string(),
          token: z.string().optional(),
          expiration: z.union([z.number(), z.string()]).optional(),
        })
        .parse(response.data);

      const parsedExpiration =
        providerResponse.expiration !== undefined ? String(providerResponse.expiration) : undefined;

      return {
        kind: providerResponse.kind,
        id: providerResponse.id,
        resourceId: providerResponse.resourceId,
        resourceUri: providerResponse.resourceUri,
        ...(providerResponse.token !== undefined && { token: providerResponse.token }),
        ...(parsedExpiration !== undefined && { expiration: parsedExpiration }),
      };
    },
  });
}
