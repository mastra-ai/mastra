// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listUpcomingEventsInputSchema = z
  .object({
    calendarId: z
      .string()
      .optional()
      .describe(
        'Calendar identifier. Use "primary" for the primary calendar or a specific calendar ID. Defaults to "primary" when omitted.',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(2500)
      .optional()
      .describe('Maximum number of events to return per page (1-2500). Default: 250'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(2500)
      .optional()
      .describe(
        'Alias for `limit`, kept consistent with the other list actions in this integration. Takes precedence over `limit` if both are set.',
      ),
    cursor: z
      .string()
      .optional()
      .describe('Pagination cursor (pageToken) from the previous response. Omit for the first page.'),
    timeMin: z
      .string()
      .optional()
      .describe('Lower bound for event end time as an RFC3339 timestamp. Defaults to the current time when omitted.'),
  })
  .describe('Input for listing upcoming calendar events.');

const ProviderTimeSchema = z.object({
  date: z.string().optional(),
  dateTime: z.string().optional(),
  timeZone: z.string().optional(),
});

const ProviderPersonSchema = z.object({
  id: z.string().optional(),
  email: z.string().optional(),
  displayName: z.string().optional(),
  self: z.boolean().optional(),
});

const ProviderAttendeeSchema = z.object({
  email: z.string().optional(),
  displayName: z.string().optional(),
  responseStatus: z.string().optional(),
});

const ProviderEventSchema = z.object({
  id: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: ProviderTimeSchema.optional(),
  end: ProviderTimeSchema.optional(),
  status: z.string().optional(),
  htmlLink: z.string().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  creator: ProviderPersonSchema.optional(),
  organizer: ProviderPersonSchema.optional(),
  attendees: z.array(ProviderAttendeeSchema).optional(),
  recurringEventId: z.string().optional(),
  eventType: z.string().optional(),
});

const ProviderListResponseSchema = z.object({
  items: z.array(ProviderEventSchema).optional(),
  nextPageToken: z.string().optional(),
  nextSyncToken: z.string().optional(),
});

const EventTimeSchema = z.object({
  date: z.string().optional().describe('The date in yyyy-mm-dd format if this is an all-day event.'),
  dateTime: z.string().optional().describe('The start/end time as an RFC3339 timestamp if this is a timed event.'),
  timeZone: z.string().optional().describe('The time zone in which the time is specified, e.g. "America/Los_Angeles".'),
});

const EventPersonSchema = z.object({
  id: z.string().optional().describe('Profile ID of the person, if available.'),
  email: z.string().optional().describe('Email address of the person, if available.'),
  displayName: z.string().optional().describe('Display name of the person, if available.'),
  self: z
    .boolean()
    .optional()
    .describe('Whether this person corresponds to the calendar on which this copy of the event appears.'),
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
  creator: EventPersonSchema.optional().describe('The creator of the event.'),
  organizer: EventPersonSchema.optional().describe('The organizer of the event.'),
  attendees: z
    .array(
      z.object({
        email: z.string().optional().describe('Email address of the attendee.'),
        displayName: z.string().optional().describe('Display name of the attendee.'),
        responseStatus: z.string().optional().describe('Response status of the attendee.'),
      }),
    )
    .optional()
    .describe('Attendees of the event.'),
  recurringEventId: z
    .string()
    .optional()
    .describe('For instances of recurring events, the ID of the parent recurring event.'),
  eventType: z
    .string()
    .optional()
    .describe(
      'Type of the event. Possible values: default, birthday, focusTime, outOfOffice, workingLocation, fromGmail.',
    ),
});

export const listUpcomingEventsOutputSchema = z
  .object({
    events: z.array(EventSchema).describe('Upcoming events ordered by start time.'),
    nextPageToken: z
      .string()
      .optional()
      .describe('Token to retrieve the next page of results. Omitted when there are no more pages.'),
  })
  .describe('Output containing upcoming calendar events and an optional pagination token.');

export function listUpcomingEventsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_list_upcoming_events',
    description: 'List upcoming events from now, ordered by start time',
    inputSchema: listUpcomingEventsInputSchema,
    outputSchema: listUpcomingEventsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUpcomingEventsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const calendarId = input.calendarId || 'primary';
      const timeMin = input.timeMin || new Date().toISOString();

      const response = await platformProxy.get({
        // https://developers.google.com/workspace/calendar/api/v3/reference/events/list
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        params: {
          timeMin: timeMin,
          orderBy: 'startTime',
          singleEvents: 'true',
          ...((input.maxResults ?? input.limit) !== undefined && {
            maxResults: String(input.maxResults ?? input.limit),
          }),
          ...(input.cursor && { pageToken: input.cursor }),
        },
        retries: 3,
      });

      const providerResponse = ProviderListResponseSchema.parse(response.data);

      const events = (providerResponse.items || []).map(item => {
        const event: z.infer<typeof EventSchema> = {
          id: item.id || '',
          ...(item.summary !== undefined && { summary: item.summary }),
          ...(item.description !== undefined && { description: item.description }),
          ...(item.location !== undefined && { location: item.location }),
          ...(item.start !== undefined && {
            start: {
              ...(item.start.date !== undefined && { date: item.start.date }),
              ...(item.start.dateTime !== undefined && { dateTime: item.start.dateTime }),
              ...(item.start.timeZone !== undefined && { timeZone: item.start.timeZone }),
            },
          }),
          ...(item.end !== undefined && {
            end: {
              ...(item.end.date !== undefined && { date: item.end.date }),
              ...(item.end.dateTime !== undefined && { dateTime: item.end.dateTime }),
              ...(item.end.timeZone !== undefined && { timeZone: item.end.timeZone }),
            },
          }),
          ...(item.status !== undefined && { status: item.status }),
          ...(item.htmlLink !== undefined && { htmlLink: item.htmlLink }),
          ...(item.created !== undefined && { created: item.created }),
          ...(item.updated !== undefined && { updated: item.updated }),
          ...(item.creator !== undefined && {
            creator: {
              ...(item.creator.id !== undefined && { id: item.creator.id }),
              ...(item.creator.email !== undefined && { email: item.creator.email }),
              ...(item.creator.displayName !== undefined && { displayName: item.creator.displayName }),
              ...(item.creator.self !== undefined && { self: item.creator.self }),
            },
          }),
          ...(item.organizer !== undefined && {
            organizer: {
              ...(item.organizer.id !== undefined && { id: item.organizer.id }),
              ...(item.organizer.email !== undefined && { email: item.organizer.email }),
              ...(item.organizer.displayName !== undefined && { displayName: item.organizer.displayName }),
              ...(item.organizer.self !== undefined && { self: item.organizer.self }),
            },
          }),
          ...(item.attendees !== undefined && {
            attendees: item.attendees.map(attendee => ({
              ...(attendee.email !== undefined && { email: attendee.email }),
              ...(attendee.displayName !== undefined && { displayName: attendee.displayName }),
              ...(attendee.responseStatus !== undefined && { responseStatus: attendee.responseStatus }),
            })),
          }),
          ...(item.recurringEventId !== undefined && { recurringEventId: item.recurringEventId }),
          ...(item.eventType !== undefined && { eventType: item.eventType }),
        };
        return event;
      });

      return {
        events,
        ...(providerResponse.nextPageToken !== undefined && { nextPageToken: providerResponse.nextPageToken }),
      };
    },
  });
}
