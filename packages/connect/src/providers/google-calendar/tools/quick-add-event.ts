// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const quickAddEventInputSchema = z
  .object({
    text: z
      .string()
      .describe('The text describing the event to be created. Example: "Dinner with friends tomorrow at 7pm"'),
    calendarId: z
      .string()
      .optional()
      .describe(
        'Calendar identifier. Use "primary" for the primary calendar of the currently logged in user. Example: "primary"',
      ),
    sendUpdates: z
      .enum(['all', 'externalOnly', 'none'])
      .optional()
      .describe(
        'Guests who should receive notifications about the creation of the new event. Acceptable values are: all, externalOnly, none.',
      ),
  })
  .describe('Input for the quick add event action');

const ProviderEventTimeSchema = z.object({
  date: z.string().optional(),
  dateTime: z.string().optional(),
  timeZone: z.string().optional(),
});

const ProviderOrganizerSchema = z.object({
  email: z.string().optional(),
  displayName: z.string().optional(),
  self: z.boolean().optional(),
});

const ProviderAttendeeSchema = z.object({
  email: z.string().optional(),
  displayName: z.string().optional(),
  organizer: z.boolean().optional(),
  self: z.boolean().optional(),
  responseStatus: z.string().optional(),
  optional: z.boolean().optional(),
  resource: z.boolean().optional(),
});

const ProviderEventSchema = z.object({
  id: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  htmlLink: z.string().optional(),
  status: z.string().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  start: ProviderEventTimeSchema.optional(),
  end: ProviderEventTimeSchema.optional(),
  creator: ProviderOrganizerSchema.optional(),
  organizer: ProviderOrganizerSchema.optional(),
  attendees: z.array(ProviderAttendeeSchema).optional(),
});

export const quickAddEventOutputSchema = z
  .object({
    id: z.string().describe('The event ID. Example: "abc123"'),
    summary: z.string().optional().describe('Title of the event.'),
    description: z.string().optional().describe('Description of the event.'),
    location: z.string().optional().describe('Geographic location of the event.'),
    htmlLink: z.string().optional().describe('Link to the event in Google Calendar.'),
    status: z.string().optional().describe('Status of the event. Example: "confirmed"'),
    created: z.string().optional().describe('Creation time of the event as an RFC3339 timestamp.'),
    updated: z.string().optional().describe('Last modification time of the event as an RFC3339 timestamp.'),
    start: z
      .object({
        date: z.string().optional().describe('The date if this is an all-day event. Format: yyyy-mm-dd.'),
        dateTime: z.string().optional().describe('The start time as an RFC3339 timestamp.'),
        timeZone: z
          .string()
          .optional()
          .describe('Time zone in which the time is specified. Example: "America/Los_Angeles".'),
      })
      .optional()
      .describe('Start time of the event.'),
    end: z
      .object({
        date: z.string().optional().describe('The date if this is an all-day event. Format: yyyy-mm-dd.'),
        dateTime: z.string().optional().describe('The end time as an RFC3339 timestamp.'),
        timeZone: z
          .string()
          .optional()
          .describe('Time zone in which the time is specified. Example: "America/Los_Angeles".'),
      })
      .optional()
      .describe('End time of the event.'),
    creator: z
      .object({
        email: z.string().optional().describe('Creator email address.'),
        displayName: z.string().optional().describe('Creator display name.'),
        self: z
          .boolean()
          .optional()
          .describe('Whether the creator corresponds to the calendar on which this copy of the event appears.'),
      })
      .optional()
      .describe('Creator of the event.'),
    organizer: z
      .object({
        email: z.string().optional().describe('Organizer email address.'),
        displayName: z.string().optional().describe('Organizer display name.'),
        self: z
          .boolean()
          .optional()
          .describe('Whether the organizer corresponds to the calendar on which this copy of the event appears.'),
      })
      .optional()
      .describe('Organizer of the event.'),
    attendees: z
      .array(
        z.object({
          email: z.string().optional().describe('Attendee email address.'),
          displayName: z.string().optional().describe('Attendee display name.'),
          organizer: z.boolean().optional().describe('Whether the attendee is the organizer.'),
          self: z
            .boolean()
            .optional()
            .describe('Whether this entry represents the calendar on which this copy of the event appears.'),
          responseStatus: z.string().optional().describe('Attendee response status. Example: "accepted"'),
          optional: z.boolean().optional().describe('Whether this is an optional attendee.'),
          resource: z.boolean().optional().describe('Whether the attendee is a resource.'),
        }),
      )
      .optional()
      .describe('Attendees of the event.'),
  })
  .describe('The created event');

export function quickAddEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_quick_add_event',
    description: 'Create an event from a text string',
    inputSchema: quickAddEventInputSchema,
    outputSchema: quickAddEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof quickAddEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const calendarId = input.calendarId ?? 'primary';

      const response = await platformProxy.post({
        // https://developers.google.com/workspace/calendar/api/v3/reference/events/quickAdd
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/quickAdd`,
        params: {
          text: input.text,
          ...(input.sendUpdates !== undefined && { sendUpdates: input.sendUpdates }),
        },
        retries: 10,
      });

      const providerEvent = ProviderEventSchema.parse(response.data);

      return {
        id: providerEvent.id,
        ...(providerEvent.summary !== undefined && { summary: providerEvent.summary }),
        ...(providerEvent.description !== undefined && { description: providerEvent.description }),
        ...(providerEvent.location !== undefined && { location: providerEvent.location }),
        ...(providerEvent.htmlLink !== undefined && { htmlLink: providerEvent.htmlLink }),
        ...(providerEvent.status !== undefined && { status: providerEvent.status }),
        ...(providerEvent.created !== undefined && { created: providerEvent.created }),
        ...(providerEvent.updated !== undefined && { updated: providerEvent.updated }),
        ...(providerEvent.start !== undefined && {
          start: {
            ...(providerEvent.start.date !== undefined && { date: providerEvent.start.date }),
            ...(providerEvent.start.dateTime !== undefined && { dateTime: providerEvent.start.dateTime }),
            ...(providerEvent.start.timeZone !== undefined && { timeZone: providerEvent.start.timeZone }),
          },
        }),
        ...(providerEvent.end !== undefined && {
          end: {
            ...(providerEvent.end.date !== undefined && { date: providerEvent.end.date }),
            ...(providerEvent.end.dateTime !== undefined && { dateTime: providerEvent.end.dateTime }),
            ...(providerEvent.end.timeZone !== undefined && { timeZone: providerEvent.end.timeZone }),
          },
        }),
        ...(providerEvent.creator !== undefined && {
          creator: {
            ...(providerEvent.creator.email !== undefined && { email: providerEvent.creator.email }),
            ...(providerEvent.creator.displayName !== undefined && { displayName: providerEvent.creator.displayName }),
            ...(providerEvent.creator.self !== undefined && { self: providerEvent.creator.self }),
          },
        }),
        ...(providerEvent.organizer !== undefined && {
          organizer: {
            ...(providerEvent.organizer.email !== undefined && { email: providerEvent.organizer.email }),
            ...(providerEvent.organizer.displayName !== undefined && {
              displayName: providerEvent.organizer.displayName,
            }),
            ...(providerEvent.organizer.self !== undefined && { self: providerEvent.organizer.self }),
          },
        }),
        ...(providerEvent.attendees !== undefined && {
          attendees: providerEvent.attendees.map(attendee => ({
            ...(attendee.email !== undefined && { email: attendee.email }),
            ...(attendee.displayName !== undefined && { displayName: attendee.displayName }),
            ...(attendee.organizer !== undefined && { organizer: attendee.organizer }),
            ...(attendee.self !== undefined && { self: attendee.self }),
            ...(attendee.responseStatus !== undefined && { responseStatus: attendee.responseStatus }),
            ...(attendee.optional !== undefined && { optional: attendee.optional }),
            ...(attendee.resource !== undefined && { resource: attendee.resource }),
          })),
        }),
      };
    },
  });
}
