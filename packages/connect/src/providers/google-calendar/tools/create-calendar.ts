// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createCalendarInputSchema = z
  .object({
    summary: z.string().describe('Title of the new calendar.'),
    description: z.string().optional().describe('Description of the calendar.'),
    location: z.string().optional().describe('Geographic location of the calendar as free-form text.'),
    time_zone: z.string().optional().describe('Time zone for the calendar. Example: "America/Los_Angeles".'),
  })
  .describe('Input parameters for creating a new Google Calendar.');

const ProviderCalendarSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  timeZone: z.string().optional(),
});

export const createCalendarOutputSchema = z
  .object({
    id: z.string().describe('Identifier of the created calendar.'),
    summary: z.string().describe('Title of the created calendar.'),
    description: z.string().optional().describe('Description of the calendar.'),
    location: z.string().optional().describe('Geographic location of the calendar.'),
    time_zone: z.string().optional().describe('Time zone for the calendar.'),
  })
  .describe('Output of the created Google Calendar.');

export function createCalendarTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_create_calendar',
    description: 'Create a new secondary Google Calendar with the specified title.',
    inputSchema: createCalendarInputSchema,
    outputSchema: createCalendarOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCalendarOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert
        endpoint: '/calendar/v3/calendars',
        data: {
          summary: input.summary,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.location !== undefined && { location: input.location }),
          ...(input.time_zone !== undefined && { timeZone: input.time_zone }),
        },
        retries: 1,
      });

      const providerCalendar = ProviderCalendarSchema.parse(response.data);

      return {
        id: providerCalendar.id,
        summary: providerCalendar.summary,
        ...(providerCalendar.description !== undefined && { description: providerCalendar.description }),
        ...(providerCalendar.location !== undefined && { location: providerCalendar.location }),
        ...(providerCalendar.timeZone !== undefined && { time_zone: providerCalendar.timeZone }),
      };
    },
  });
}
