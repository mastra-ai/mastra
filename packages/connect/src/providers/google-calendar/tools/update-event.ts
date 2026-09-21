// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const EventTimeInputSchema = z.object({
  date: z.string().optional().describe('The date, in yyyy-mm-dd format, if this is an all-day event.'),
  dateTime: z.string().optional().describe('The combined date-time value formatted according to RFC3339.'),
  timeZone: z
    .string()
    .optional()
    .describe('The time zone in IANA Time Zone Database name format, e.g. America/Los_Angeles.'),
});

const AttendeeInputSchema = z.object({
  id: z.string().optional().describe('The attendee profile ID, if known.'),
  email: z.string().optional().describe("The attendee's email address."),
  displayName: z.string().optional().describe("The attendee's display name, if available."),
  // organizer and self are provider-managed and not settable by the caller; they are
  // exposed on the output/attendee-echo but intentionally omitted here.
  resource: z.boolean().optional().describe('Whether the attendee is a resource.'),
  optional: z.boolean().optional().describe('Whether this is an optional attendee.'),
  responseStatus: z
    .enum(['needsAction', 'declined', 'tentative', 'accepted'])
    .optional()
    .describe("The attendee's response status."),
  comment: z.string().optional().describe("The attendee's response comment."),
  additionalGuests: z.number().optional().describe('Number of additional guests the attendee is bringing.'),
});

const ReminderOverrideInputSchema = z.object({
  method: z.string().optional().describe('The reminder method: email or popup.'),
  minutes: z.number().optional().describe('Minutes before the event when the reminder should trigger.'),
});

const RemindersInputSchema = z.object({
  useDefault: z.boolean().optional().describe('Whether the default reminders of the calendar apply to the event.'),
  overrides: z.array(ReminderOverrideInputSchema).optional().describe('Custom reminder overrides for this event.'),
});

export const updateEventInputSchema = z
  .object({
    calendarId: z
      .string()
      .describe('Calendar identifier. Use "primary" for the primary calendar or a calendar ID from calendarList.list.'),
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
    // Not nullable: Google Calendar events always require a start and end time, so
    // clearing them via null is not a supported operation.
    start: EventTimeInputSchema.optional().describe('The inclusive start time of the event.'),
    end: EventTimeInputSchema.optional().describe('The exclusive end time of the event.'),
    attendees: z
      .array(AttendeeInputSchema)
      .optional()
      .describe(
        'The attendees of the event. Specifying this overwrites the existing attendee list. Pass an empty array to clear all attendees.',
      ),
    reminders: RemindersInputSchema.optional().describe('Reminders for the authenticated user for this event.'),
    status: z.string().optional().describe('Status of the event: confirmed, tentative, or cancelled.'),
    visibility: z
      .string()
      .nullable()
      .optional()
      .describe('Visibility of the event: default, public, private, or confidential. Set to null to clear.'),
    colorId: z
      .string()
      .nullable()
      .optional()
      .describe('Color ID of the event referencing the colors endpoint. Set to null to clear.'),
    sendUpdates: z.string().optional().describe('Guests to notify about the event update: all, externalOnly, or none.'),
  })
  .describe('Input for updating a calendar event.');

const ProviderEventTimeSchema = z.object({
  date: z.string().nullish(),
  dateTime: z.string().nullish(),
  timeZone: z.string().nullish(),
});

const ProviderAttendeeSchema = z.object({
  id: z.string().nullish(),
  email: z.string().nullish(),
  displayName: z.string().nullish(),
  organizer: z.boolean().nullish(),
  self: z.boolean().nullish(),
  resource: z.boolean().nullish(),
  optional: z.boolean().nullish(),
  responseStatus: z.string().nullish(),
  comment: z.string().nullish(),
  additionalGuests: z.number().nullish(),
});

const ProviderReminderOverrideSchema = z.object({
  method: z.string().nullish(),
  minutes: z.number().nullish(),
});

const ProviderRemindersSchema = z.object({
  useDefault: z.boolean().nullish(),
  overrides: z.array(ProviderReminderOverrideSchema).nullish(),
});

const ProviderPersonSchema = z.object({
  email: z.string().nullish(),
  displayName: z.string().nullish(),
  self: z.boolean().nullish(),
});

const ProviderEventSchema = z.object({
  id: z.string(),
  summary: z.string().nullish(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  status: z.string().nullish(),
  visibility: z.string().nullish(),
  htmlLink: z.string().nullish(),
  created: z.string().nullish(),
  updated: z.string().nullish(),
  start: ProviderEventTimeSchema.nullish(),
  end: ProviderEventTimeSchema.nullish(),
  attendees: z.array(ProviderAttendeeSchema).nullish(),
  reminders: ProviderRemindersSchema.nullish(),
  organizer: ProviderPersonSchema.nullish(),
  creator: ProviderPersonSchema.nullish(),
  iCalUID: z.string().nullish(),
  eventType: z.string().nullish(),
});

const EventTimeOutputSchema = z.object({
  date: z.string().optional().describe('The date in yyyy-mm-dd format if this is an all-day event.'),
  dateTime: z.string().optional().describe('The combined date-time value in RFC3339 format.'),
  timeZone: z.string().optional().describe('The time zone in IANA format.'),
});

const AttendeeOutputSchema = z.object({
  id: z.string().optional().describe('The attendee profile ID, if known.'),
  email: z.string().optional().describe("The attendee's email address."),
  displayName: z.string().optional().describe("The attendee's display name."),
  organizer: z.boolean().optional().describe('Whether the attendee is the organizer.'),
  self: z
    .boolean()
    .optional()
    .describe('Whether this entry represents the calendar on which this copy of the event appears.'),
  resource: z.boolean().optional().describe('Whether the attendee is a resource.'),
  optional: z.boolean().optional().describe('Whether this is an optional attendee.'),
  responseStatus: z.string().optional().describe("The attendee's response status."),
  comment: z.string().optional().describe("The attendee's response comment."),
  additionalGuests: z.number().optional().describe('Number of additional guests the attendee is bringing.'),
});

const ReminderOverrideOutputSchema = z.object({
  method: z.string().optional().describe('The reminder method.'),
  minutes: z.number().optional().describe('Minutes before the event when the reminder triggers.'),
});

const RemindersOutputSchema = z.object({
  useDefault: z.boolean().optional().describe('Whether default calendar reminders apply.'),
  overrides: z.array(ReminderOverrideOutputSchema).optional().describe('Custom reminder overrides.'),
});

export const updateEventOutputSchema = z
  .object({
    id: z.string().describe('Opaque identifier of the event.'),
    summary: z.string().optional().describe('Title of the event.'),
    description: z.string().optional().describe('Description of the event.'),
    location: z.string().optional().describe('Geographic location of the event.'),
    status: z.string().optional().describe('Status of the event.'),
    visibility: z.string().optional().describe('Visibility of the event: default, public, private, or confidential.'),
    htmlLink: z.string().optional().describe('Absolute link to this event in the Google Calendar Web UI.'),
    created: z.string().optional().describe('Creation time of the event as an RFC3339 timestamp.'),
    updated: z.string().optional().describe('Last modification time of the event as an RFC3339 timestamp.'),
    start: EventTimeOutputSchema.optional().describe('Start time of the event.'),
    end: EventTimeOutputSchema.optional().describe('End time of the event.'),
    attendees: z.array(AttendeeOutputSchema).optional().describe('The attendees of the event.'),
    reminders: RemindersOutputSchema.optional().describe('Reminders for the event.'),
    organizer: z
      .object({
        email: z.string().optional().describe("The organizer's email address."),
        displayName: z.string().optional().describe("The organizer's display name."),
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
        displayName: z.string().optional().describe("The creator's display name."),
        self: z
          .boolean()
          .optional()
          .describe('Whether the creator corresponds to the calendar on which this copy appears.'),
      })
      .optional()
      .describe('The creator of the event.'),
    iCalUID: z.string().optional().describe('Event unique identifier as defined in RFC5545.'),
    eventType: z.string().optional().describe('Specific type of the event, e.g. default.'),
  })
  .describe('The updated calendar event.');

export function updateEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_update_event',
    description: 'Update a calendar event',
    inputSchema: updateEventInputSchema,
    outputSchema: updateEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input.sendUpdates !== undefined) {
        params['sendUpdates'] = input.sendUpdates;
      }

      // https://developers.google.com/calendar/api/v3/reference/events/patch
      const response = await platformProxy.patch({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
        params,
        data: {
          ...(input.summary !== undefined && { summary: input.summary }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.location !== undefined && { location: input.location }),
          ...(input.start !== undefined && { start: input.start }),
          ...(input.end !== undefined && { end: input.end }),
          ...(input.attendees !== undefined && { attendees: input.attendees }),
          ...(input.reminders !== undefined && { reminders: input.reminders }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.visibility !== undefined && { visibility: input.visibility }),
          ...(input.colorId !== undefined && { colorId: input.colorId }),
        },
        retries: 10,
      });

      const providerEvent = ProviderEventSchema.parse(response.data);

      return {
        id: providerEvent.id,
        ...(providerEvent.summary != null && { summary: providerEvent.summary }),
        ...(providerEvent.description != null && { description: providerEvent.description }),
        ...(providerEvent.location != null && { location: providerEvent.location }),
        ...(providerEvent.status != null && { status: providerEvent.status }),
        ...(providerEvent.visibility != null && { visibility: providerEvent.visibility }),
        ...(providerEvent.htmlLink != null && { htmlLink: providerEvent.htmlLink }),
        ...(providerEvent.created != null && { created: providerEvent.created }),
        ...(providerEvent.updated != null && { updated: providerEvent.updated }),
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
        ...(providerEvent.attendees != null && {
          attendees: providerEvent.attendees.map(attendee => ({
            ...(attendee.id != null && { id: attendee.id }),
            ...(attendee.email != null && { email: attendee.email }),
            ...(attendee.displayName != null && { displayName: attendee.displayName }),
            ...(attendee.organizer != null && { organizer: attendee.organizer }),
            ...(attendee.self != null && { self: attendee.self }),
            ...(attendee.resource != null && { resource: attendee.resource }),
            ...(attendee.optional != null && { optional: attendee.optional }),
            ...(attendee.responseStatus != null && { responseStatus: attendee.responseStatus }),
            ...(attendee.comment != null && { comment: attendee.comment }),
            ...(attendee.additionalGuests != null && { additionalGuests: attendee.additionalGuests }),
          })),
        }),
        ...(providerEvent.reminders != null && {
          reminders: {
            ...(providerEvent.reminders.useDefault != null && { useDefault: providerEvent.reminders.useDefault }),
            ...(providerEvent.reminders.overrides != null && {
              overrides: providerEvent.reminders.overrides.map(override => ({
                ...(override.method != null && { method: override.method }),
                ...(override.minutes != null && { minutes: override.minutes }),
              })),
            }),
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
        ...(providerEvent.eventType != null && { eventType: providerEvent.eventType }),
      };
    },
  });
}
