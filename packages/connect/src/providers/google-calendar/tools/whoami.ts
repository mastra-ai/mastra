// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const whoamiInputSchema = z.object({}).describe('No input required');

const ProviderCalendarSchema = z.object({
  id: z.string(),
});

export const whoamiOutputSchema = z
  .object({
    id: z
      .string()
      .describe(
        'The user\'s Google account ID. For Google Calendar this is the primary calendar ID, which matches the user\'s email address. Example: "user@example.com"',
      ),
    email: z.string().describe('The user\'s Google account email address. Example: "user@example.com"'),
  })
  .describe("The current user's Google account ID and email");

export function whoamiTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_whoami',
    description: "Return the current user's Google account ID and email",
    inputSchema: whoamiInputSchema,
    outputSchema: whoamiOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof whoamiOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.google.com/workspace/calendar/api/v3/reference/calendars/get
        endpoint: '/calendar/v3/calendars/primary',
        retries: 3,
      });

      const calendar = ProviderCalendarSchema.parse(response.data);

      return {
        id: calendar.id,
        email: calendar.id,
      };
    },
  });
}
