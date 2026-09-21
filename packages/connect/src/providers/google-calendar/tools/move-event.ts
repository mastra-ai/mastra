// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const moveEventInputSchema = z
  .object({
    calendarId: z
      .string()
      .describe('Calendar identifier of the source calendar where the event currently is. Example: "primary"'),
    eventId: z.string().describe('Event identifier. Example: "abc123def456"'),
    destinationCalendarId: z
      .string()
      .describe('Calendar identifier of the target calendar where the event is to be moved to. Example: "primary"'),
    sendUpdates: z
      .enum(['all', 'externalOnly', 'none'])
      .optional()
      .describe("Guests who should receive notifications about the change of the event's organizer."),
  })
  .describe('Input parameters for moving a calendar event to another calendar.');

const ProviderEventSchema = z.object({
  id: z.string(),
  summary: z.string().nullish(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  status: z.string().nullish(),
  htmlLink: z.string().nullish(),
  created: z.string().nullish(),
  updated: z.string().nullish(),
  start: z
    .object({
      dateTime: z.string().nullish(),
      date: z.string().nullish(),
      timeZone: z.string().nullish(),
    })
    .nullish(),
  end: z
    .object({
      dateTime: z.string().nullish(),
      date: z.string().nullish(),
      timeZone: z.string().nullish(),
    })
    .nullish(),
  organizer: z
    .object({
      email: z.string().nullish(),
      displayName: z.string().nullish(),
      self: z.boolean().nullish(),
    })
    .nullish(),
  creator: z
    .object({
      email: z.string().nullish(),
      displayName: z.string().nullish(),
      self: z.boolean().nullish(),
    })
    .nullish(),
  iCalUID: z.string().nullish(),
});

export const moveEventOutputSchema = z
  .object({
    id: z.string().describe('Opaque identifier of the event.'),
    summary: z.string().optional().describe('Title of the event.'),
    description: z.string().optional().describe('Description of the event.'),
    location: z.string().optional().describe('Geographic location of the event as free-form text.'),
    status: z
      .string()
      .optional()
      .describe('Status of the event. Possible values are "confirmed", "tentative", or "cancelled".'),
    htmlLink: z.string().optional().describe('An absolute link to this event in the Google Calendar Web UI.'),
    created: z.string().optional().describe('Creation time of the event as an RFC3339 timestamp.'),
    updated: z.string().optional().describe('Last modification time of the event as an RFC3339 timestamp.'),
    start: z
      .object({
        dateTime: z
          .string()
          .optional()
          .describe('The start time as a combined date-time value (formatted according to RFC3339).'),
        date: z.string().optional().describe('The date, in the format "yyyy-mm-dd", if this is an all-day event.'),
        timeZone: z
          .string()
          .optional()
          .describe(
            'The time zone in which the time is specified (formatted as an IANA Time Zone Database name, e.g. "Europe/Zurich").',
          ),
      })
      .optional()
      .describe('The start time of the event.'),
    end: z
      .object({
        dateTime: z
          .string()
          .optional()
          .describe('The end time as a combined date-time value (formatted according to RFC3339).'),
        date: z.string().optional().describe('The date, in the format "yyyy-mm-dd", if this is an all-day event.'),
        timeZone: z
          .string()
          .optional()
          .describe(
            'The time zone in which the time is specified (formatted as an IANA Time Zone Database name, e.g. "Europe/Zurich").',
          ),
      })
      .optional()
      .describe('The (exclusive) end time of the event.'),
    organizer: z
      .object({
        email: z.string().optional().describe("The organizer's email address, if available."),
        displayName: z.string().optional().describe("The organizer's name, if available."),
        self: z
          .boolean()
          .optional()
          .describe('Whether the organizer corresponds to the calendar on which this copy of the event appears.'),
      })
      .optional()
      .describe('The organizer of the event.'),
    creator: z
      .object({
        email: z.string().optional().describe("The creator's email address, if available."),
        displayName: z.string().optional().describe("The creator's name, if available."),
        self: z
          .boolean()
          .optional()
          .describe('Whether the creator corresponds to the calendar on which this copy of the event appears.'),
      })
      .optional()
      .describe('The creator of the event.'),
    iCalUID: z.string().optional().describe('Event unique identifier as defined in RFC5545.'),
  })
  .describe('The moved event as it appears on the destination calendar.');

export function moveEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_move_event',
    description: 'Move an event to another calendar, changing its organizer.',
    inputSchema: moveEventInputSchema,
    outputSchema: moveEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof moveEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/calendar/api/v3/reference/events/move
      await platformProxy.post({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}/move`,
        params: {
          destination: input.destinationCalendarId,
          ...(input.sendUpdates != null && { sendUpdates: input.sendUpdates }),
        },
        retries: 3,
      });

      // https://developers.google.com/workspace/calendar/api/v3/reference/events/get
      const getResponse = await platformProxy.get({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.destinationCalendarId)}/events/${encodeURIComponent(input.eventId)}`,
        retries: 3,
      });

      const providerEvent = ProviderEventSchema.parse(getResponse.data);

      return {
        id: providerEvent.id,
        ...(providerEvent.summary != null && { summary: providerEvent.summary }),
        ...(providerEvent.description != null && { description: providerEvent.description }),
        ...(providerEvent.location != null && { location: providerEvent.location }),
        ...(providerEvent.status != null && { status: providerEvent.status }),
        ...(providerEvent.htmlLink != null && { htmlLink: providerEvent.htmlLink }),
        ...(providerEvent.created != null && { created: providerEvent.created }),
        ...(providerEvent.updated != null && { updated: providerEvent.updated }),
        ...(providerEvent.start != null && {
          start: {
            ...(providerEvent.start.dateTime != null && { dateTime: providerEvent.start.dateTime }),
            ...(providerEvent.start.date != null && { date: providerEvent.start.date }),
            ...(providerEvent.start.timeZone != null && { timeZone: providerEvent.start.timeZone }),
          },
        }),
        ...(providerEvent.end != null && {
          end: {
            ...(providerEvent.end.dateTime != null && { dateTime: providerEvent.end.dateTime }),
            ...(providerEvent.end.date != null && { date: providerEvent.end.date }),
            ...(providerEvent.end.timeZone != null && { timeZone: providerEvent.end.timeZone }),
          },
        }),
        ...(providerEvent.organizer != null && {
          organizer: {
            ...(providerEvent.organizer.email != null && { email: providerEvent.organizer.email }),
            ...(providerEvent.organizer.displayName != null && { displayName: providerEvent.organizer.displayName }),
            ...(providerEvent.organizer.self != null && { self: providerEvent.organizer.self }),
          },
        }),
        ...(providerEvent.creator != null && {
          creator: {
            ...(providerEvent.creator.email != null && { email: providerEvent.creator.email }),
            ...(providerEvent.creator.displayName != null && { displayName: providerEvent.creator.displayName }),
            ...(providerEvent.creator.self != null && { self: providerEvent.creator.self }),
          },
        }),
        ...(providerEvent.iCalUID != null && { iCalUID: providerEvent.iCalUID }),
      };
    },
  });
}
