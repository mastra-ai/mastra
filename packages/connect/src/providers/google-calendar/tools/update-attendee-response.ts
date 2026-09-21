// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateAttendeeResponseInputSchema = z
  .object({
    calendarId: z
      .string()
      .optional()
      .describe('Calendar identifier. Use "primary" for the primary calendar. Example: "primary"'),
    eventId: z.string().describe('Event identifier. Example: "abc123def456"'),
    attendeeEmail: z
      .string()
      .describe('Email address of the attendee whose response status should be updated. Example: "user@example.com"'),
    responseStatus: z
      .enum(['needsAction', 'declined', 'tentative', 'accepted'])
      .describe("The attendee's new response status. Possible values: needsAction, declined, tentative, accepted."),
  })
  .describe('Input for updating an attendee response status on a Google Calendar event.');

const AttendeeSchema = z
  .object({
    email: z.string().describe("The attendee's email address."),
    responseStatus: z.string().describe("The attendee's response status."),
    displayName: z.string().optional().describe("The attendee's display name, if available."),
    optional: z.boolean().optional().describe('Whether this is an optional attendee.'),
    organizer: z.boolean().optional().describe('Whether the attendee is the organizer of the event.'),
    self: z.boolean().optional().describe('Whether the attendee is the calendar owner.'),
  })
  .describe('An attendee of a Google Calendar event.');

export const updateAttendeeResponseOutputSchema = z
  .object({
    eventId: z.string().describe('The updated event identifier.'),
    calendarId: z.string().describe('The calendar identifier.'),
    attendee: AttendeeSchema.describe('The updated attendee details.'),
  })
  .describe('Output of updating an attendee response status on a Google Calendar event.');

export function updateAttendeeResponseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_update_attendee_response',
    description: "Fetch an event and update one attendee's response status",
    inputSchema: updateAttendeeResponseInputSchema,
    outputSchema: updateAttendeeResponseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateAttendeeResponseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const calendarId = input.calendarId || 'primary';
      const eventId = input.eventId;
      const attendeeEmail = input.attendeeEmail;
      const responseStatus = input.responseStatus;

      // https://developers.google.com/workspace/calendar/api/v3/reference/events/get
      const getResponse = await platformProxy.get({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        retries: 3,
      });

      const rawEvent = getResponse.data;

      if (!rawEvent || typeof rawEvent !== 'object') {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Event not found or invalid response from provider.',
        });
      }

      const attendees = Array.isArray(rawEvent.attendees) ? rawEvent.attendees : [];
      const attendeeIndex = attendees.findIndex((a: unknown) => {
        if (a && typeof a === 'object' && 'email' in a && typeof a.email === 'string') {
          return a.email.toLowerCase() === attendeeEmail.toLowerCase();
        }
        return false;
      });

      if (attendeeIndex === -1) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Attendee with email ${attendeeEmail} not found on event.`,
          attendeeEmail: attendeeEmail,
          eventId: eventId,
        });
      }

      const updatedAttendees = attendees.map((a: unknown, index: number) => {
        if (index === attendeeIndex) {
          if (a && typeof a === 'object') {
            return { ...a, responseStatus: responseStatus };
          }
          return a;
        }
        return a;
      });

      // https://developers.google.com/workspace/calendar/api/v3/reference/events/patch
      const patchResponse = await platformProxy.patch({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        data: {
          attendees: updatedAttendees,
        },
        retries: 1,
      });

      const patchedEvent = patchResponse.data;

      if (!patchedEvent || typeof patchedEvent !== 'object') {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Invalid response after patching event.',
        });
      }

      const patchedAttendees = Array.isArray(patchedEvent.attendees) ? patchedEvent.attendees : [];
      const matchedAttendee = patchedAttendees.find((a: unknown) => {
        if (a && typeof a === 'object' && 'email' in a && typeof a.email === 'string') {
          return a.email.toLowerCase() === attendeeEmail.toLowerCase();
        }
        return false;
      });

      if (!matchedAttendee || typeof matchedAttendee !== 'object') {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Attendee missing from patched event response.',
        });
      }

      return {
        eventId: String(patchedEvent.id || eventId),
        calendarId: calendarId,
        attendee: {
          email: String(matchedAttendee.email),
          responseStatus: String(matchedAttendee.responseStatus || responseStatus),
          ...(matchedAttendee.displayName != null && { displayName: String(matchedAttendee.displayName) }),
          ...(matchedAttendee.optional != null && { optional: Boolean(matchedAttendee.optional) }),
          ...(matchedAttendee.organizer != null && { organizer: Boolean(matchedAttendee.organizer) }),
          ...(matchedAttendee.self != null && { self: Boolean(matchedAttendee.self) }),
        },
      };
    },
  });
}
