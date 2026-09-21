// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchEventsInputSchema = z
  .object({
    calendarId: z.string().optional().describe('Calendar identifier. Use "primary" for the primary calendar.'),
    query: z.string().optional().describe('Free text search terms to find events matching these terms.'),
    timeMin: z
      .string()
      .optional()
      .describe("Lower bound (exclusive) for an event's end time. Must be an RFC3339 timestamp."),
    timeMax: z
      .string()
      .optional()
      .describe("Upper bound (exclusive) for an event's start time. Must be an RFC3339 timestamp."),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(2500)
      .optional()
      .describe('Maximum number of events returned on one result page. Default is 250.'),
    cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  })
  .describe('Input for searching calendar events.');

const ProviderEventDateTimeSchema = z.object({
  date: z.string().optional(),
  dateTime: z.string().optional(),
  timeZone: z.string().optional(),
});

const ProviderPersonSchema = z.object({
  email: z.string().nullish(),
  displayName: z.string().nullish(),
});

const ProviderAttendeeSchema = z.object({
  email: z.string().nullish(),
  displayName: z.string().nullish(),
  responseStatus: z.string().nullish(),
});

const ProviderEventSchema = z.object({
  id: z.string(),
  summary: z.string().nullish(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  start: ProviderEventDateTimeSchema.nullish(),
  end: ProviderEventDateTimeSchema.nullish(),
  status: z.string().nullish(),
  htmlLink: z.string().nullish(),
  created: z.string().nullish(),
  updated: z.string().nullish(),
  organizer: ProviderPersonSchema.nullish(),
  creator: ProviderPersonSchema.nullish(),
  attendees: z.array(ProviderAttendeeSchema).nullish(),
  recurrence: z.array(z.string()).nullish(),
  recurringEventId: z.string().nullish(),
  iCalUID: z.string().nullish(),
  eventType: z.string().nullish(),
});

const ProviderEventsResponseSchema = z.object({
  items: z.array(ProviderEventSchema).optional(),
  nextPageToken: z.string().optional(),
});

const EventDateTimeSchema = z.object({
  dateTime: z.string().optional().describe('Date/time in RFC3339 format.'),
  date: z.string().optional().describe('Date in YYYY-MM-DD format for all-day events.'),
  timeZone: z.string().optional().describe('Time zone of the date/time.'),
});

const EventSchema = z.object({
  id: z.string().describe('Event identifier.'),
  summary: z.string().optional().describe('Title of the event.'),
  description: z.string().optional().describe('Description of the event.'),
  location: z.string().optional().describe('Geographic location of the event.'),
  start: EventDateTimeSchema.optional().describe('Start time of the event.'),
  end: EventDateTimeSchema.optional().describe('End time of the event.'),
  status: z.string().optional().describe('Event status. Possible values: confirmed, tentative, cancelled.'),
  htmlLink: z.string().optional().describe('Absolute link to the event in Google Calendar.'),
  created: z.string().optional().describe('Creation time of the event in RFC3339 format.'),
  updated: z.string().optional().describe('Last modification time of the event in RFC3339 format.'),
  organizer: z
    .object({
      email: z.string().optional().describe('Organizer email address.'),
      displayName: z.string().optional().describe('Organizer display name.'),
    })
    .optional()
    .describe('Organizer of the event.'),
  creator: z
    .object({
      email: z.string().optional().describe('Creator email address.'),
      displayName: z.string().optional().describe('Creator display name.'),
    })
    .optional()
    .describe('Creator of the event.'),
  attendees: z
    .array(
      z.object({
        email: z.string().optional().describe('Attendee email address.'),
        displayName: z.string().optional().describe('Attendee display name.'),
        responseStatus: z.string().optional().describe('Attendee response status.'),
      }),
    )
    .optional()
    .describe('Attendees of the event.'),
  recurrence: z.array(z.string()).optional().describe('Recurrence rules for recurring events.'),
  recurringEventId: z.string().optional().describe('Identifier of the recurring event for instances.'),
  iCalUID: z.string().optional().describe('Event unique identifier in iCalendar format.'),
  eventType: z
    .string()
    .optional()
    .describe(
      'Specific type of the event. Possible values: default, birthday, focusTime, fromGmail, outOfOffice, workingLocation.',
    ),
});

export const searchEventsOutputSchema = z
  .object({
    events: z.array(EventSchema).describe('List of matching events.'),
    nextPageToken: z
      .string()
      .optional()
      .describe('Token for the next page of results. Omitted if there are no more results.'),
  })
  .describe('Output of the search events action.');

function mapDateTime(dt: z.infer<typeof ProviderEventDateTimeSchema> | null | undefined) {
  if (!dt) {
    return undefined;
  }
  return {
    ...(dt.dateTime != null && { dateTime: dt.dateTime }),
    ...(dt.date != null && { date: dt.date }),
    ...(dt.timeZone != null && { timeZone: dt.timeZone }),
  };
}

function mapPerson(person: z.infer<typeof ProviderPersonSchema> | null | undefined) {
  if (!person) {
    return undefined;
  }
  return {
    ...(person.email != null && { email: person.email }),
    ...(person.displayName != null && { displayName: person.displayName }),
  };
}

function mapAttendee(attendee: z.infer<typeof ProviderAttendeeSchema>) {
  return {
    ...(attendee.email != null && { email: attendee.email }),
    ...(attendee.displayName != null && { displayName: attendee.displayName }),
    ...(attendee.responseStatus != null && { responseStatus: attendee.responseStatus }),
  };
}

export function searchEventsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_search_events',
    description: "Search a calendar's events by text query and optional time bounds",
    inputSchema: searchEventsInputSchema,
    outputSchema: searchEventsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchEventsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const calendarId = input.calendarId || 'primary';

      const response = await platformProxy.get({
        // https://developers.google.com/workspace/calendar/api/v3/reference/events/list
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        params: {
          ...(input.query !== undefined && { q: input.query }),
          ...(input.timeMin !== undefined && { timeMin: input.timeMin }),
          ...(input.timeMax !== undefined && { timeMax: input.timeMax }),
          ...(input.maxResults !== undefined && { maxResults: String(input.maxResults) }),
          ...(input.cursor !== undefined && { pageToken: input.cursor }),
        },
        retries: 3,
      });

      const providerResponse = ProviderEventsResponseSchema.parse(response.data);

      const events = (providerResponse.items || []).map(item => ({
        id: item.id,
        ...(item.summary != null && { summary: item.summary }),
        ...(item.description != null && { description: item.description }),
        ...(item.location != null && { location: item.location }),
        ...(item.start != null && { start: mapDateTime(item.start) }),
        ...(item.end != null && { end: mapDateTime(item.end) }),
        ...(item.status != null && { status: item.status }),
        ...(item.htmlLink != null && { htmlLink: item.htmlLink }),
        ...(item.created != null && { created: item.created }),
        ...(item.updated != null && { updated: item.updated }),
        ...(item.organizer != null && { organizer: mapPerson(item.organizer) }),
        ...(item.creator != null && { creator: mapPerson(item.creator) }),
        ...(item.attendees != null && { attendees: item.attendees.map(mapAttendee) }),
        ...(item.recurrence != null && { recurrence: item.recurrence }),
        ...(item.recurringEventId != null && { recurringEventId: item.recurringEventId }),
        ...(item.iCalUID != null && { iCalUID: item.iCalUID }),
        ...(item.eventType != null && { eventType: item.eventType }),
      }));

      return {
        events,
        ...(providerResponse.nextPageToken != null && { nextPageToken: providerResponse.nextPageToken }),
      };
    },
  });
}
