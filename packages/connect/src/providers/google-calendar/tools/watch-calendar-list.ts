// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const watchCalendarListInputSchema = z
  .object({
    id: z
      .string()
      .describe(
        'A UUID or similar unique string that identifies this channel. Example: "01234567-89ab-cdef-0123456789ab"',
      ),
    address: z
      .string()
      .describe(
        'The address where notifications are delivered for this channel. Example: "https://example.com/webhook"',
      ),
    token: z
      .string()
      .optional()
      .describe(
        'An arbitrary string delivered to the target address with each notification delivered over this channel. Optional.',
      ),
    ttl: z
      .number()
      .optional()
      .describe('The time-to-live in seconds for the notification channel. Default is 604800 seconds (7 days).'),
  })
  .describe('Input parameters for subscribing to calendar list changes.');

export const watchCalendarListOutputSchema = z
  .object({
    kind: z.string().describe('Identifies this as a notification channel. Value is "api#channel".'),
    id: z.string().describe('A UUID or similar unique string that identifies this channel.'),
    resourceId: z
      .string()
      .describe(
        'An opaque ID that identifies the resource being watched on this channel. Stable across different API versions.',
      ),
    resourceUri: z.string().describe('A version-specific identifier for the watched resource.'),
    token: z
      .string()
      .optional()
      .describe(
        'An arbitrary string delivered to the target address with each notification delivered over this channel. Optional.',
      ),
    expiration: z
      .number()
      .optional()
      .describe(
        'Date and time of notification channel expiration, expressed as a Unix timestamp, in milliseconds. Optional.',
      ),
  })
  .describe('Output of a calendar list watch subscription.');

const ProviderResponseSchema = z.object({
  kind: z.string(),
  id: z.string(),
  resourceId: z.string(),
  resourceUri: z.string(),
  token: z.string().optional(),
  expiration: z.union([z.string(), z.number()]).optional(),
});

export function watchCalendarListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_watch_calendar_list',
    description: 'Subscribe to changes in the calendar list',
    inputSchema: watchCalendarListInputSchema,
    outputSchema: watchCalendarListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof watchCalendarListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {
        id: input.id,
        type: 'web_hook',
        address: input.address,
      };

      if (input.token !== undefined) {
        requestBody['token'] = input.token;
      }

      if (input.ttl !== undefined) {
        requestBody['params'] = {
          ttl: input.ttl.toString(),
        };
      }

      // https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/watch
      const response = await platformProxy.post({
        endpoint: '/calendar/v3/users/me/calendarList/watch',
        data: requestBody,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        kind: providerResponse.kind,
        id: providerResponse.id,
        resourceId: providerResponse.resourceId,
        resourceUri: providerResponse.resourceUri,
        ...(providerResponse.token != null && { token: providerResponse.token }),
        ...(providerResponse.expiration != null && { expiration: Number(providerResponse.expiration) }),
      };
    },
  });
}
