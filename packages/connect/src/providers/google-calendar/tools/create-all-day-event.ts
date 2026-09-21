// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createAllDayEventInputSchema = z
  .object({
    calendarId: z.string().optional().describe('Calendar identifier. Use "primary" for the user\'s primary calendar.'),
    summary: z.string().optional().describe('Title of the event.'),
    startDate: z.string().describe('Start date of the all-day event in yyyy-mm-dd format (inclusive).'),
    endDate: z.string().describe('End date of the all-day event in yyyy-mm-dd format (exclusive).'),
    description: z.string().optional().describe('Description of the event.'),
    location: z.string().optional().describe('Geographic location of the event as free-form text.'),
  })
  .describe('Input to create an all-day calendar event.');

const ProviderEventSchema = z.object({
  id: z.string(),
  summary: z.string().optional().nullable(),
  start: z.object({
    date: z.string().optional(),
    dateTime: z.string().optional(),
    timeZone: z.string().optional(),
  }),
  end: z.object({
    date: z.string().optional(),
    dateTime: z.string().optional(),
    timeZone: z.string().optional(),
  }),
  htmlLink: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
});

export const createAllDayEventOutputSchema = z
  .object({
    id: z.string().describe('Opaque identifier of the created event.'),
    summary: z.string().optional().describe('Title of the event.'),
    startDate: z.string().optional().describe('Start date of the all-day event in yyyy-mm-dd format.'),
    endDate: z.string().optional().describe('End date of the all-day event in yyyy-mm-dd format.'),
    htmlLink: z.string().optional().describe('URL to view the event in Google Calendar.'),
    status: z.string().optional().describe('Status of the event, e.g. "confirmed".'),
  })
  .describe('Created all-day calendar event.');

export function createAllDayEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_create_all_day_event',
    description: 'Create an all-day calendar event using start and end dates',
    inputSchema: createAllDayEventInputSchema,
    outputSchema: createAllDayEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createAllDayEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const calendarId = input.calendarId || 'primary';

      const response = await platformProxy.post({
        // https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        data: {
          summary: input.summary,
          start: {
            date: input.startDate,
          },
          end: {
            date: input.endDate,
          },
          description: input.description,
          location: input.location,
        },
        retries: 3,
      });

      const providerEvent = ProviderEventSchema.parse(response.data);

      return {
        id: providerEvent.id,
        ...(providerEvent.summary != null && { summary: providerEvent.summary }),
        ...(providerEvent.start.date != null && { startDate: providerEvent.start.date }),
        ...(providerEvent.end.date != null && { endDate: providerEvent.end.date }),
        ...(providerEvent.htmlLink != null && { htmlLink: providerEvent.htmlLink }),
        ...(providerEvent.status != null && { status: providerEvent.status }),
      };
    },
  });
}
