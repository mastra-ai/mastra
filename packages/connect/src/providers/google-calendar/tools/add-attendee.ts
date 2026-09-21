// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addAttendeeInputSchema = z
  .object({
    calendarId: z.string().describe('Calendar identifier. Use "primary" for the primary calendar. Example: "primary"'),
    eventId: z.string().describe('Event identifier. Example: "abc123def456"'),
    email: z
      .string()
      .describe('The attendee\'s email address. Must be a valid RFC5322 address. Example: "attendee@example.com"'),
    displayName: z.string().optional().describe('The attendee\'s display name, if available. Example: "Jane Doe"'),
    optional: z.boolean().optional().describe('Whether this is an optional attendee. Defaults to false.'),
    responseStatus: z
      .enum(['needsAction', 'declined', 'tentative', 'accepted'])
      .optional()
      .describe('The attendee\'s response status. Defaults to "needsAction" for new attendees.'),
    comment: z.string().optional().describe("The attendee's response comment. Optional."),
    additionalGuests: z
      .number()
      .int()
      .optional()
      .describe('Number of additional guests the attendee is bringing. Defaults to 0.'),
    resource: z
      .boolean()
      .optional()
      .describe(
        'Whether the attendee is a resource. Can only be set when the attendee is first added. Defaults to false.',
      ),
    sendUpdates: z
      .enum(['all', 'externalOnly', 'none'])
      .optional()
      .describe('Guests who should receive notifications about the event update. Defaults to API behavior if omitted.'),
  })
  .describe('Input to add an attendee to a Google Calendar event');

const ProviderAttendeeSchema = z.object({
  email: z.string(),
  displayName: z.string().optional(),
  optional: z.boolean().optional(),
  responseStatus: z.enum(['needsAction', 'declined', 'tentative', 'accepted']).or(z.string()).optional(),
  comment: z.string().optional(),
  additionalGuests: z.number().int().optional(),
  resource: z.boolean().optional(),
});

const ProviderEventSchema = z.object({
  id: z.string(),
  attendees: z.array(ProviderAttendeeSchema).optional(),
});

export const addAttendeeOutputSchema = z
  .object({
    eventId: z.string().describe('The event identifier.'),
    attendees: z
      .array(
        z.object({
          email: z.string().describe("The attendee's email address."),
          displayName: z.string().optional().describe("The attendee's display name."),
          optional: z.boolean().optional().describe('Whether this attendee is optional.'),
          responseStatus: z.string().optional().describe("The attendee's response status."),
          comment: z.string().optional().describe("The attendee's comment."),
          additionalGuests: z.number().int().optional().describe('Number of additional guests.'),
          resource: z.boolean().optional().describe('Whether the attendee is a resource.'),
        }),
      )
      .describe('The full attendee list after adding the new attendee.'),
  })
  .describe('Output containing the updated event ID and attendee list');

export function addAttendeeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_add_attendee',
    description: 'Fetch an event, append an attendee, and patch the attendee list',
    inputSchema: addAttendeeInputSchema,
    outputSchema: addAttendeeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addAttendeeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/calendar/api/v3/reference/events/get
      const getResponse = await platformProxy.get({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
        retries: 3,
      });

      if (!getResponse.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Event not found',
          calendarId: input.calendarId,
          eventId: input.eventId,
        });
      }

      const event = ProviderEventSchema.parse(getResponse.data);
      const existingAttendees = event.attendees ?? [];

      const newAttendee = {
        email: input.email,
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.optional !== undefined && { optional: input.optional }),
        ...(input.responseStatus !== undefined && { responseStatus: input.responseStatus }),
        ...(input.comment !== undefined && { comment: input.comment }),
        ...(input.additionalGuests !== undefined && { additionalGuests: input.additionalGuests }),
        ...(input.resource !== undefined && { resource: input.resource }),
      };

      const updatedAttendees = [...existingAttendees, newAttendee];

      const patchParams: Record<string, string> = {};
      if (input.sendUpdates !== undefined) {
        patchParams['sendUpdates'] = input.sendUpdates;
      }

      // https://developers.google.com/workspace/calendar/api/v3/reference/events/patch
      const patchResponse = await platformProxy.patch({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
        params: patchParams,
        data: {
          attendees: updatedAttendees,
        },
        retries: 1,
      });

      const updatedEvent = ProviderEventSchema.parse(patchResponse.data);

      return {
        eventId: updatedEvent.id,
        attendees: (updatedEvent.attendees ?? []).map(attendee => ({
          email: attendee.email,
          ...(attendee.displayName != null && { displayName: attendee.displayName }),
          ...(attendee.optional !== undefined && { optional: attendee.optional }),
          ...(attendee.responseStatus != null && { responseStatus: attendee.responseStatus }),
          ...(attendee.comment != null && { comment: attendee.comment }),
          ...(attendee.additionalGuests !== undefined && { additionalGuests: attendee.additionalGuests }),
          ...(attendee.resource !== undefined && { resource: attendee.resource }),
        })),
      };
    },
  });
}
