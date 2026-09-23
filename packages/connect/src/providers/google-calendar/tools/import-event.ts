// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

const EventDateTimeSchema = z.object({
  date: z.string().optional().describe('The date, in yyyy-mm-dd format, for all-day events.'),
  dateTime: z.string().optional().describe('The time as an RFC3339 combined date-time value.'),
  timeZone: z.string().optional().describe('The time zone, e.g. Europe/Zurich.'),
});

const AttendeeInputSchema = z.object({
  email: z.string().email().describe('The attendee email address.'),
  displayName: z.string().optional().describe('The attendee display name.'),
  responseStatus: z
    .enum(['needsAction', 'declined', 'tentative', 'accepted'])
    .optional()
    .describe('The attendee response status.'),
  optional: z.boolean().optional().describe('Whether this is an optional attendee.'),
  resource: z.boolean().optional().describe('Whether the attendee is a resource.'),
  comment: z.string().optional().describe("The attendee's response comment."),
  additionalGuests: z.number().optional().describe('Number of additional guests the attendee is bringing.'),
});

const AttendeeInputSchemaWidened = z.object({
  email: z.string().email().describe('The attendee email address.'),
  displayName: z.string().optional().describe('The attendee display name.'),
  responseStatus: z
    .enum(['needsAction', 'declined', 'tentative', 'accepted'])
    .or(z.string())
    .optional()
    .describe('The attendee response status.'),
  optional: z.boolean().optional().describe('Whether this is an optional attendee.'),
  resource: z.boolean().optional().describe('Whether the attendee is a resource.'),
  comment: z.string().optional().describe("The attendee's response comment."),
  additionalGuests: z.number().optional().describe('Number of additional guests the attendee is bringing.'),
});

const AttendeeOutputSchema = AttendeeInputSchemaWidened.extend({
  email: z.string().optional().describe('The attendee email address.'),
});

const OrganizerInputSchema = z.object({
  displayName: z.string().optional().describe('The organizer display name.'),
  email: z.string().email().optional().describe('The organizer email address.'),
});

export const importEventInputSchema = z
  .object({
    calendarId: z.string().optional().describe('Calendar identifier. Defaults to "primary".'),
    iCalUID: z.string().describe('iCalendar UID for the event.'),
    start: EventDateTimeSchema.describe('Start time of the event.'),
    end: EventDateTimeSchema.describe('End time of the event.'),
    summary: z.string().optional().describe('Title of the event.'),
    description: z.string().optional().describe('Description of the event.'),
    location: z.string().optional().describe('Geographic location of the event.'),
    attendees: z.array(AttendeeInputSchema).optional().describe('Attendees of the event.'),
    organizer: OrganizerInputSchema.optional().describe('The organizer of the event.'),
    conferenceDataVersion: z
      .number()
      .int()
      .min(0)
      .max(1)
      .optional()
      .describe('Version number of conference data supported by the API client.'),
    supportsAttachments: z
      .boolean()
      .optional()
      .describe('Whether API client performing operation supports event attachments.'),
  })
  .describe('Input for importing an event into a Google Calendar.');

export const importEventOutputSchema = z
  .object({
    id: z.string().describe('Identifier of the imported event.'),
    iCalUID: z.string().describe('iCalendar UID of the event.'),
    summary: z.string().optional().describe('Title of the event.'),
    start: EventDateTimeSchema.optional().describe('Start time of the event.'),
    end: EventDateTimeSchema.optional().describe('End time of the event.'),
    description: z.string().optional().describe('Description of the event.'),
    location: z.string().optional().describe('Geographic location of the event.'),
    status: z.string().optional().describe('Status of the event.'),
    htmlLink: z.string().optional().describe('Link to the event in Google Calendar.'),
    attendees: z.array(AttendeeOutputSchema).optional().describe('Attendees of the event.'),
    organizer: OrganizerInputSchema.optional().describe('The organizer of the event.'),
  })
  .describe('Output of the imported Google Calendar event.');

const ProviderAttendeeSchema = z.object({
  email: z.string().optional(),
  displayName: z.string().optional(),
  responseStatus: z.enum(['needsAction', 'declined', 'tentative', 'accepted']).or(z.string()).optional(),
  optional: z.boolean().optional(),
  resource: z.boolean().optional(),
  comment: z.string().optional(),
  additionalGuests: z.number().optional(),
});

const ProviderEventSchema = z.object({
  id: z.string(),
  iCalUID: z.string(),
  summary: z.string().optional(),
  start: EventDateTimeSchema.optional(),
  end: EventDateTimeSchema.optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  status: z.string().optional(),
  htmlLink: z.string().optional(),
  attendees: z.array(ProviderAttendeeSchema).optional(),
  organizer: z
    .object({
      displayName: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
});

export function importEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_import_event',
    description: 'Import an event as a private copy using an iCalendar UID.',
    inputSchema: importEventInputSchema,
    outputSchema: importEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof importEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const calendarId = input.calendarId ?? 'primary';

      const body: Record<string, unknown> = {
        iCalUID: input.iCalUID,
        start: input.start,
        end: input.end,
        ...(input.summary !== undefined && { summary: input.summary }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.location !== undefined && { location: input.location }),
        ...(input.attendees !== undefined && { attendees: input.attendees }),
        ...(input.organizer !== undefined && { organizer: input.organizer }),
      };

      const config: PlatformProxyRequest = {
        // https://developers.google.com/workspace/calendar/api/v3/reference/events/import
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/import`,
        params: {
          ...(input.conferenceDataVersion !== undefined && {
            conferenceDataVersion: String(input.conferenceDataVersion),
          }),
          ...(input.supportsAttachments !== undefined && { supportsAttachments: String(input.supportsAttachments) }),
        },
        data: body,
        retries: 3,
      };

      const response = await platformProxy.post(config);

      const event = ProviderEventSchema.parse(response.data);

      return {
        id: event.id,
        iCalUID: event.iCalUID,
        ...(event.summary !== undefined && { summary: event.summary }),
        ...(event.start !== undefined && { start: event.start }),
        ...(event.end !== undefined && { end: event.end }),
        ...(event.description !== undefined && { description: event.description }),
        ...(event.location !== undefined && { location: event.location }),
        ...(event.status !== undefined && { status: event.status }),
        ...(event.htmlLink !== undefined && { htmlLink: event.htmlLink }),
        ...(event.attendees !== undefined && { attendees: event.attendees }),
        ...(event.organizer !== undefined && {
          organizer: {
            ...(event.organizer.displayName !== undefined && { displayName: event.organizer.displayName }),
            ...(event.organizer.email !== undefined && { email: event.organizer.email }),
          },
        }),
      };
    },
  });
}
