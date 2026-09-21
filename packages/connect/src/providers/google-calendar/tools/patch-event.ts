// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const EventTimeSchema = z
  .object({
    date: z.string().optional().describe('The date, in the format "yyyy-mm-dd", if this is an all-day event.'),
    dateTime: z
      .string()
      .optional()
      .describe(
        'The time, as a combined date-time value (formatted according to RFC3339). A time zone offset is required unless a time zone is explicitly specified in timeZone.',
      ),
    timeZone: z
      .string()
      .optional()
      .describe(
        'The time zone in which the time is specified. Formatted as an IANA Time Zone Database name, e.g. "Europe/Zurich".',
      ),
  })
  .describe('Start or end time of the event. Either date or dateTime must be specified.');

const AttendeeSchema = z
  .object({
    email: z.string().optional().describe("The attendee's email address. Required when adding an attendee."),
    displayName: z.string().optional().describe("The attendee's name, if available."),
    optional: z.boolean().optional().describe('Whether this is an optional attendee.'),
    responseStatus: z
      .string()
      .optional()
      .describe("The attendee's response status. Possible values: needsAction, declined, tentative, accepted."),
  })
  .describe('An attendee of the event.');

export const patchEventInputSchema = z
  .object({
    calendarId: z
      .string()
      .optional()
      .describe(
        'Calendar identifier. Use "primary" for the primary calendar of the logged-in user. Defaults to "primary".',
      ),
    eventId: z.string().describe('Event identifier.'),
    summary: z.string().nullable().optional().describe('Title of the event. Set to null to clear.'),
    description: z
      .string()
      .nullable()
      .optional()
      .describe('Description of the event. Can contain HTML. Set to null to clear.'),
    location: z
      .string()
      .nullable()
      .optional()
      .describe('Geographic location of the event as free-form text. Set to null to clear.'),
    start: EventTimeSchema.nullable()
      .optional()
      .describe('The (inclusive) start time of the event. Set to null to clear.'),
    end: EventTimeSchema.nullable().optional().describe('The (exclusive) end time of the event. Set to null to clear.'),
    attendees: z
      .array(AttendeeSchema)
      .nullable()
      .optional()
      .describe(
        'The attendees of the event. If specified, overwrites the existing attendee list. Set to null to clear.',
      ),
    colorId: z.string().nullable().optional().describe('The color of the event. Set to null to clear.'),
    visibility: z
      .string()
      .nullable()
      .optional()
      .describe(
        'Visibility of the event. Possible values: default, public, private, confidential. Set to null to clear.',
      ),
    sendUpdates: z
      .string()
      .optional()
      .describe(
        'Guests who should receive notifications about the event update. Possible values: all, externalOnly, none.',
      ),
  })
  .describe('Input for partially updating a Google Calendar event.');

export const patchEventOutputSchema = z
  .object({
    id: z.string().describe('Opaque identifier of the event.'),
    calendarId: z.string().describe('Calendar identifier the event belongs to.'),
    summary: z.string().optional().describe('Title of the event.'),
    description: z.string().optional().describe('Description of the event.'),
    location: z.string().optional().describe('Geographic location of the event.'),
    start: EventTimeSchema.optional().describe('The (inclusive) start time of the event.'),
    end: EventTimeSchema.optional().describe('The (exclusive) end time of the event.'),
    status: z.string().optional().describe('Status of the event. Possible values: confirmed, tentative, cancelled.'),
    htmlLink: z.string().optional().describe('An absolute link to this event in the Google Calendar Web UI.'),
    created: z.string().optional().describe('Creation time of the event as an RFC3339 timestamp.'),
    updated: z.string().optional().describe('Last modification time of the main event data as an RFC3339 timestamp.'),
    organizer: z
      .object({
        email: z.string().optional().describe("The organizer's email address."),
        displayName: z.string().optional().describe("The organizer's name."),
        self: z
          .boolean()
          .optional()
          .describe('Whether the organizer corresponds to the calendar on which this copy appears.'),
      })
      .optional()
      .describe('The organizer of the event.'),
    creator: z
      .object({
        email: z.string().optional().describe("The creator's email address."),
        displayName: z.string().optional().describe("The creator's name."),
        self: z
          .boolean()
          .optional()
          .describe('Whether the creator corresponds to the calendar on which this copy appears.'),
      })
      .optional()
      .describe('The creator of the event.'),
  })
  .describe('Output of a partially updated Google Calendar event.');

const ProviderEventSchema = z.object({
  id: z.string(),
  summary: z.string().nullish(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  start: EventTimeSchema.nullish(),
  end: EventTimeSchema.nullish(),
  status: z.string().nullish(),
  htmlLink: z.string().nullish(),
  created: z.string().nullish(),
  updated: z.string().nullish(),
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
});

export function patchEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_patch_event',
    description: 'Partially update only provided event fields like time, location, or description',
    inputSchema: patchEventInputSchema,
    outputSchema: patchEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof patchEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const calendarId = input.calendarId || 'primary';

      const body: Record<string, unknown> = {};
      if (input.summary !== undefined) {
        body['summary'] = input.summary;
      }
      if (input.description !== undefined) {
        body['description'] = input.description;
      }
      if (input.location !== undefined) {
        body['location'] = input.location;
      }
      if (input.start !== undefined) {
        body['start'] = input.start;
      }
      if (input.end !== undefined) {
        body['end'] = input.end;
      }
      if (input.attendees !== undefined) {
        body['attendees'] = input.attendees;
      }
      if (input.colorId !== undefined) {
        body['colorId'] = input.colorId;
      }
      if (input.visibility !== undefined) {
        body['visibility'] = input.visibility;
      }

      const params: Record<string, string> = {};
      if (input.sendUpdates !== undefined) {
        params['sendUpdates'] = input.sendUpdates;
      }

      // https://developers.google.com/workspace/calendar/api/v3/reference/events/patch
      const response = await platformProxy.patch({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`,
        params,
        data: body,
        retries: 3,
      });

      const providerEvent = ProviderEventSchema.parse(response.data);

      return {
        id: providerEvent.id,
        calendarId,
        ...(providerEvent.summary != null && { summary: providerEvent.summary }),
        ...(providerEvent.description != null && { description: providerEvent.description }),
        ...(providerEvent.location != null && { location: providerEvent.location }),
        ...(providerEvent.start != null && {
          start: {
            ...(providerEvent.start.date != null && { date: providerEvent.start.date }),
            ...(providerEvent.start.dateTime != null && { dateTime: providerEvent.start.dateTime }),
            ...(providerEvent.start.timeZone != null && { timeZone: providerEvent.start.timeZone }),
          },
        }),
        ...(providerEvent.end != null && {
          end: {
            ...(providerEvent.end.date != null && { date: providerEvent.end.date }),
            ...(providerEvent.end.dateTime != null && { dateTime: providerEvent.end.dateTime }),
            ...(providerEvent.end.timeZone != null && { timeZone: providerEvent.end.timeZone }),
          },
        }),
        ...(providerEvent.status != null && { status: providerEvent.status }),
        ...(providerEvent.htmlLink != null && { htmlLink: providerEvent.htmlLink }),
        ...(providerEvent.created != null && { created: providerEvent.created }),
        ...(providerEvent.updated != null && { updated: providerEvent.updated }),
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
      };
    },
  });
}
