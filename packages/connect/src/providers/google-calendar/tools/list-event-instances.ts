// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listEventInstancesInputSchema = z
  .object({
    calendarId: z
      .string()
      .describe('Calendar identifier. Use "primary" for the primary calendar of the authenticated user.'),
    eventId: z.string().describe('Recurring event identifier whose instances will be listed.'),
    cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(2500)
      .optional()
      .describe('Maximum number of events returned on one result page. Default is 250, maximum is 2500.'),
    showDeleted: z
      .boolean()
      .optional()
      .describe('Whether to include deleted (cancelled) events in the result. Default is false.'),
    timeMin: z
      .string()
      .optional()
      .describe(
        "Lower bound (inclusive) for an event's end time to filter by, as an RFC3339 timestamp with mandatory time zone offset.",
      ),
    timeMax: z
      .string()
      .optional()
      .describe(
        "Upper bound (exclusive) for an event's start time to filter by, as an RFC3339 timestamp with mandatory time zone offset.",
      ),
    timeZone: z
      .string()
      .optional()
      .describe('Time zone used in the response. Default is the time zone of the calendar.'),
  })
  .describe('Input for listing instances of a recurring event');

const EventTimeSchema = z.object({
  date: z.string().optional().describe('The date in yyyy-mm-dd format if this is an all-day event.'),
  dateTime: z.string().optional().describe('The time as an RFC3339 formatted date-time value.'),
  timeZone: z.string().optional().describe('Time zone in which the time is specified, e.g. "Europe/Zurich".'),
});

const EventPersonSchema = z.object({
  id: z.string().optional().describe('Profile ID, if available.'),
  email: z.string().optional().describe('Email address, if available.'),
  displayName: z.string().optional().describe('Display name, if available.'),
  self: z
    .boolean()
    .optional()
    .describe('Whether this entry corresponds to the calendar on which this copy of the event appears.'),
});

const EventSchema = z.object({
  id: z.string().describe('Opaque identifier of the event.'),
  summary: z.string().optional().describe('Title of the event.'),
  description: z.string().optional().describe('Description of the event.'),
  location: z.string().optional().describe('Geographic location of the event as free-form text.'),
  start: EventTimeSchema.optional().describe('The inclusive start time of the event.'),
  end: EventTimeSchema.optional().describe('The exclusive end time of the event.'),
  status: z.string().optional().describe('Status of the event. Possible values: confirmed, tentative, cancelled.'),
  htmlLink: z.string().optional().describe('Absolute link to this event in the Google Calendar Web UI.'),
  created: z.string().optional().describe('Creation time of the event as an RFC3339 timestamp.'),
  updated: z.string().optional().describe('Last modification time of the event as an RFC3339 timestamp.'),
  organizer: EventPersonSchema.optional().describe('The organizer of the event.'),
  creator: EventPersonSchema.optional().describe('The creator of the event.'),
  recurringEventId: z
    .string()
    .optional()
    .describe('For an instance of a recurring event, the id of the recurring event to which this instance belongs.'),
  originalStartTime: EventTimeSchema.optional().describe(
    'For an instance, the original scheduled start time before any modifications.',
  ),
  iCalUID: z.string().optional().describe('Event unique identifier as defined in RFC5545.'),
  eventType: z
    .string()
    .optional()
    .describe(
      'Specific type of the event. Possible values: default, birthday, focusTime, outOfOffice, workingLocation, fromGmail.',
    ),
  transparency: z
    .string()
    .optional()
    .describe('Whether the event blocks time on the calendar. Possible values: opaque, transparent.'),
  visibility: z
    .string()
    .optional()
    .describe('Visibility of the event. Possible values: default, public, private, confidential.'),
});

export const listEventInstancesOutputSchema = z
  .object({
    items: z.array(EventSchema).describe('List of event instances for the specified recurring event.'),
    nextPageToken: z
      .string()
      .optional()
      .describe('Token for accessing the next page of results. Omitted when no further results are available.'),
  })
  .describe('Output for listing instances of a recurring event');

const ProviderEventTimeSchema = z.object({
  date: z.string().nullish(),
  dateTime: z.string().nullish(),
  timeZone: z.string().nullish(),
});

const ProviderEventPersonSchema = z.object({
  id: z.string().nullish(),
  email: z.string().nullish(),
  displayName: z.string().nullish(),
  self: z.boolean().nullish(),
});

const ProviderEventSchema = z.object({
  id: z.string(),
  summary: z.string().nullish(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  start: ProviderEventTimeSchema.nullish(),
  end: ProviderEventTimeSchema.nullish(),
  status: z.string().nullish(),
  htmlLink: z.string().nullish(),
  created: z.string().nullish(),
  updated: z.string().nullish(),
  organizer: ProviderEventPersonSchema.nullish(),
  creator: ProviderEventPersonSchema.nullish(),
  recurringEventId: z.string().nullish(),
  originalStartTime: ProviderEventTimeSchema.nullish(),
  iCalUID: z.string().nullish(),
  eventType: z.string().nullish(),
  transparency: z.string().nullish(),
  visibility: z.string().nullish(),
});

const ProviderListResponseSchema = z.object({
  items: z.array(z.unknown()).optional(),
  nextPageToken: z.string().optional(),
});

function mapEventTime(time: z.infer<typeof ProviderEventTimeSchema> | null | undefined) {
  if (time == null) {
    return undefined;
  }
  return {
    ...(time.date != null && { date: time.date }),
    ...(time.dateTime != null && { dateTime: time.dateTime }),
    ...(time.timeZone != null && { timeZone: time.timeZone }),
  };
}

function mapPerson(person: z.infer<typeof ProviderEventPersonSchema> | null | undefined) {
  if (person == null) {
    return undefined;
  }
  return {
    ...(person.id != null && { id: person.id }),
    ...(person.email != null && { email: person.email }),
    ...(person.displayName != null && { displayName: person.displayName }),
    ...(person.self != null && { self: person.self }),
  };
}

export function listEventInstancesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_list_event_instances',
    description: 'List instances of a recurring event',
    inputSchema: listEventInstancesInputSchema,
    outputSchema: listEventInstancesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listEventInstancesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/calendar/api/v3/reference/events/instances
      const response = await platformProxy.get({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}/instances`,
        params: {
          ...(input.cursor !== undefined && { pageToken: input.cursor }),
          ...(input.maxResults !== undefined && { maxResults: String(input.maxResults) }),
          ...(input.showDeleted !== undefined && { showDeleted: String(input.showDeleted) }),
          ...(input.timeMin !== undefined && { timeMin: input.timeMin }),
          ...(input.timeMax !== undefined && { timeMax: input.timeMax }),
          ...(input.timeZone !== undefined && { timeZone: input.timeZone }),
        },
        retries: 3,
      });

      const providerResponse = ProviderListResponseSchema.parse(response.data);

      const items = (providerResponse.items ?? []).map(rawItem => {
        const providerEvent = ProviderEventSchema.parse(rawItem);

        return {
          id: providerEvent.id,
          ...(providerEvent.summary != null && { summary: providerEvent.summary }),
          ...(providerEvent.description != null && { description: providerEvent.description }),
          ...(providerEvent.location != null && { location: providerEvent.location }),
          ...(providerEvent.start != null && { start: mapEventTime(providerEvent.start) }),
          ...(providerEvent.end != null && { end: mapEventTime(providerEvent.end) }),
          ...(providerEvent.status != null && { status: providerEvent.status }),
          ...(providerEvent.htmlLink != null && { htmlLink: providerEvent.htmlLink }),
          ...(providerEvent.created != null && { created: providerEvent.created }),
          ...(providerEvent.updated != null && { updated: providerEvent.updated }),
          ...(providerEvent.organizer != null && { organizer: mapPerson(providerEvent.organizer) }),
          ...(providerEvent.creator != null && { creator: mapPerson(providerEvent.creator) }),
          ...(providerEvent.recurringEventId != null && { recurringEventId: providerEvent.recurringEventId }),
          ...(providerEvent.originalStartTime != null && {
            originalStartTime: mapEventTime(providerEvent.originalStartTime),
          }),
          ...(providerEvent.iCalUID != null && { iCalUID: providerEvent.iCalUID }),
          ...(providerEvent.eventType != null && { eventType: providerEvent.eventType }),
          ...(providerEvent.transparency != null && { transparency: providerEvent.transparency }),
          ...(providerEvent.visibility != null && { visibility: providerEvent.visibility }),
        };
      });

      return {
        items,
        ...(providerResponse.nextPageToken != null && { nextPageToken: providerResponse.nextPageToken }),
      };
    },
  });
}
