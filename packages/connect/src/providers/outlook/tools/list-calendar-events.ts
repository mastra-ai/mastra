// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCalendarEventsInputSchema = z.object({
  calendar_id: z
    .string()
    .optional()
    .describe(
      'The ID of the calendar to list events from. If omitted, the default calendar is used. Example: "AQMkADAwATM0..."',
    ),
  start_date_time: z
    .string()
    .optional()
    .describe(
      'Start of the date range (ISO 8601 format). Required when using calendarView. Example: "2024-01-01T00:00:00Z"',
    ),
  end_date_time: z
    .string()
    .optional()
    .describe(
      'End of the date range (ISO 8601 format). Required when using calendarView. Example: "2024-01-31T23:59:59Z"',
    ),
  top: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum number of events to return per page. Default: 10, Max: 50.'),
});

const ProviderEventSchema = z.object({
  id: z.string(),
  subject: z.string().nullable().optional(),
  bodyPreview: z.string().nullable().optional(),
  start: z
    .object({
      dateTime: z.string(),
      timeZone: z.string(),
    })
    .optional(),
  end: z
    .object({
      dateTime: z.string(),
      timeZone: z.string(),
    })
    .optional(),
  location: z
    .object({
      displayName: z.string().nullable().optional(),
    })
    .optional(),
  isAllDay: z.boolean().optional(),
  showAs: z.string().optional(),
  webLink: z.string().nullable().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
});

const EventSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  body_preview: z.string().optional(),
  start_date_time: z.string().optional(),
  start_time_zone: z.string().optional(),
  end_date_time: z.string().optional(),
  end_time_zone: z.string().optional(),
  location: z.string().optional(),
  is_all_day: z.boolean().optional(),
  show_as: z.string().optional(),
  web_link: z.string().optional(),
  created_date_time: z.string().optional(),
  last_modified_date_time: z.string().optional(),
});

export const listCalendarEventsOutputSchema = z.object({
  events: z.array(EventSchema),
  next_link: z.string().optional(),
});

export function listCalendarEventsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_list_calendar_events',
    description: 'List events from a calendar or date window.',
    inputSchema: listCalendarEventsInputSchema,
    outputSchema: listCalendarEventsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCalendarEventsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if ((input.start_date_time && !input.end_date_time) || (!input.start_date_time && input.end_date_time)) {
        throw new platformProxy.ActionError({
          message: 'Both start_date_time and end_date_time must be provided together for a date-window query',
        });
      }

      const top = input.top || 10;
      const params: Record<string, string | number> = {
        $top: top,
      };

      let endpoint: string;

      if (input.start_date_time && input.end_date_time) {
        // https://learn.microsoft.com/graph/api/calendar-list-calendarview
        endpoint = '/v1.0/me/calendarView';
        params['startDateTime'] = input.start_date_time;
        params['endDateTime'] = input.end_date_time;
      } else if (input.calendar_id) {
        // https://learn.microsoft.com/graph/api/calendar-list-events
        endpoint = `/v1.0/me/calendars/${encodeURIComponent(input.calendar_id)}/events`;
      } else {
        // https://learn.microsoft.com/graph/api/user-list-events
        endpoint = '/v1.0/me/events';
      }

      // https://learn.microsoft.com/graph/api/calendar-list-events
      const response = await platformProxy.get({
        endpoint: endpoint,
        params: params,
        retries: 3,
      });

      const providerEvents = z.array(ProviderEventSchema).parse(response.data.value || []);

      const events = providerEvents.map(event => ({
        id: event.id,
        ...(event.subject != null && { subject: event.subject }),
        ...(event.bodyPreview != null && {
          body_preview: event.bodyPreview,
        }),
        ...(event.start != null && {
          start_date_time: event.start.dateTime,
          start_time_zone: event.start.timeZone,
        }),
        ...(event.end != null && {
          end_date_time: event.end.dateTime,
          end_time_zone: event.end.timeZone,
        }),
        ...(event.location?.displayName != null && {
          location: event.location.displayName,
        }),
        ...(event.isAllDay != null && { is_all_day: event.isAllDay }),
        ...(event.showAs != null && { show_as: event.showAs }),
        ...(event.webLink != null && { web_link: event.webLink }),
        ...(event.createdDateTime != null && {
          created_date_time: event.createdDateTime,
        }),
        ...(event.lastModifiedDateTime != null && {
          last_modified_date_time: event.lastModifiedDateTime,
        }),
      }));

      return {
        events: events,
        ...(response.data['@odata.nextLink'] != null && {
          next_link: response.data['@odata.nextLink'],
        }),
      };
    },
  });
}
