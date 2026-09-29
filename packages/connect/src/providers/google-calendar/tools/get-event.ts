// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const EventDateTimeSchema = z.object({
  date: z.string().optional().describe('The date, in the format "yyyy-mm-dd", if this is an all-day event.'),
  dateTime: z.string().optional().describe('The time, as a combined date-time value in RFC3339 format.'),
  timeZone: z.string().optional().describe('The time zone in which the time is specified.'),
});

const PersonSchema = z.object({
  email: z.string().optional().describe('Email address of the person.'),
  displayName: z.string().optional().describe('Display name of the person.'),
  self: z.boolean().optional().describe('Whether the person is the calendar owner.'),
});

const AttendeeSchema = z.object({
  email: z.string().optional().describe('Email address of the attendee.'),
  displayName: z.string().optional().describe('Display name of the attendee.'),
  organizer: z.boolean().optional().describe('Whether the attendee is the organizer of the event.'),
  self: z.boolean().optional().describe('Whether this entry represents the calendar owner.'),
  responseStatus: z
    .string()
    .optional()
    .describe('The attendee response status. Example: "accepted", "declined", "tentative", "needsAction".'),
  comment: z.string().optional().describe('Additional comment by the attendee.'),
  additionalGuests: z.number().optional().describe('Number of additional guests the attendee has brought.'),
});

const ReminderOverrideSchema = z.object({
  method: z.string().optional().describe('Notification method. Example: "email", "popup".'),
  minutes: z.number().optional().describe('Number of minutes before the event to send the reminder.'),
});

const RemindersSchema = z.object({
  useDefault: z.boolean().optional().describe('Whether the default reminders of the calendar apply.'),
  overrides: z.array(ReminderOverrideSchema).optional().describe('List of reminder overrides for this event.'),
});

export const getEventInputSchema = z
  .object({
    calendarId: z
      .string()
      .optional()
      .describe('Calendar identifier. Use "primary" for the primary calendar. Example: "primary"'),
    eventId: z.string().describe('Event identifier. Example: "abc123def456ghi"'),
  })
  .describe('Input to retrieve a Google Calendar event by ID.');

export const getEventOutputSchema = z
  .object({
    id: z.string().describe('Event identifier.'),
    summary: z.string().optional().describe('Title of the event.'),
    description: z.string().optional().describe('Description of the event.'),
    location: z.string().optional().describe('Geographic location of the event as free-form text.'),
    status: z.string().optional().describe('Status of the event. Example: "confirmed", "tentative", "cancelled".'),
    htmlLink: z.string().optional().describe('An absolute link to this event in the Google Calendar Web UI.'),
    created: z.string().optional().describe('Creation time of the event in RFC3339 format.'),
    updated: z.string().describe('Last modification time of the event in RFC3339 format.'),
    start: EventDateTimeSchema.optional().describe('Start time of the event.'),
    end: EventDateTimeSchema.optional().describe('End time of the event.'),
    endTimeUnspecified: z.boolean().optional().describe('Whether the end time is actually unspecified.'),
    creator: PersonSchema.optional().describe('The creator of the event.'),
    organizer: PersonSchema.optional().describe('The organizer of the event.'),
    attendees: z.array(AttendeeSchema).optional().describe('The attendees of the event.'),
    recurrence: z
      .array(z.string())
      .optional()
      .describe('List of RRULE, EXRULE, RDATE and EXDATE lines for a recurring event.'),
    recurringEventId: z
      .string()
      .optional()
      .describe('For an instance of a recurring event, the ID of the recurring event to which this instance belongs.'),
    originalStartTime: EventDateTimeSchema.optional().describe(
      'For an instance of a recurring event, the original start time.',
    ),
    transparency: z
      .string()
      .optional()
      .describe('Whether the event blocks time on the calendar. Example: "opaque", "transparent".'),
    visibility: z
      .string()
      .optional()
      .describe('Visibility of the event. Example: "default", "public", "private", "confidential".'),
    iCalUID: z.string().optional().describe('Event unique identifier as defined in RFC5545.'),
    sequence: z.number().optional().describe('Version number which increments on changes.'),
    guestsCanInviteOthers: z
      .boolean()
      .optional()
      .describe('Whether attendees other than the organizer can invite others to the event.'),
    guestsCanModify: z
      .boolean()
      .optional()
      .describe('Whether attendees other than the organizer can modify the event.'),
    guestsCanSeeOtherGuests: z
      .boolean()
      .optional()
      .describe('Whether attendees other than the organizer can see who the other attendees are.'),
    anyoneCanAddSelf: z.boolean().optional().describe('Whether anyone can invite themselves to the event.'),
    reminders: RemindersSchema.optional().describe('Information about the event reminders.'),
    eventType: z
      .string()
      .optional()
      .describe('Type of the event. Example: "default", "outOfOffice", "focusTime", "workingLocation".'),
  })
  .describe('A Google Calendar event.');

const ProviderEventDateTimeSchema = z.object({
  date: z.string().nullish(),
  dateTime: z.string().nullish(),
  timeZone: z.string().nullish(),
});

const ProviderPersonSchema = z.object({
  email: z.string().nullish(),
  displayName: z.string().nullish(),
  self: z.boolean().nullish(),
});

const ProviderAttendeeSchema = z.object({
  email: z.string().nullish(),
  displayName: z.string().nullish(),
  organizer: z.boolean().nullish(),
  self: z.boolean().nullish(),
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

const ProviderEventSchema = z.object({
  id: z.string(),
  summary: z.string().nullish(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  status: z.string().nullish(),
  htmlLink: z.string().nullish(),
  created: z.string().nullish(),
  updated: z.string(),
  start: ProviderEventDateTimeSchema.nullish(),
  end: ProviderEventDateTimeSchema.nullish(),
  endTimeUnspecified: z.boolean().nullish(),
  creator: ProviderPersonSchema.nullish(),
  organizer: ProviderPersonSchema.nullish(),
  attendees: z.array(ProviderAttendeeSchema).nullish(),
  recurrence: z.array(z.string()).nullish(),
  recurringEventId: z.string().nullish(),
  originalStartTime: ProviderEventDateTimeSchema.nullish(),
  transparency: z.string().nullish(),
  visibility: z.string().nullish(),
  iCalUID: z.string().nullish(),
  sequence: z.number().nullish(),
  guestsCanInviteOthers: z.boolean().nullish(),
  guestsCanModify: z.boolean().nullish(),
  guestsCanSeeOtherGuests: z.boolean().nullish(),
  anyoneCanAddSelf: z.boolean().nullish(),
  reminders: ProviderRemindersSchema.nullish(),
  eventType: z.string().nullish(),
});

function normalizeEventDateTime(
  value: z.infer<typeof ProviderEventDateTimeSchema> | null | undefined,
): z.infer<typeof EventDateTimeSchema> | undefined {
  if (value == null) {
    return undefined;
  }
  return {
    ...(value.date != null && { date: value.date }),
    ...(value.dateTime != null && { dateTime: value.dateTime }),
    ...(value.timeZone != null && { timeZone: value.timeZone }),
  };
}

function normalizePerson(
  value: z.infer<typeof ProviderPersonSchema> | null | undefined,
): z.infer<typeof PersonSchema> | undefined {
  if (value == null) {
    return undefined;
  }
  return {
    ...(value.email != null && { email: value.email }),
    ...(value.displayName != null && { displayName: value.displayName }),
    ...(value.self != null && { self: value.self }),
  };
}

function normalizeAttendees(
  value: z.infer<typeof ProviderAttendeeSchema>[] | null | undefined,
): z.infer<typeof AttendeeSchema>[] | undefined {
  if (value == null) {
    return undefined;
  }
  return value.map(attendee => ({
    ...(attendee.email != null && { email: attendee.email }),
    ...(attendee.displayName != null && { displayName: attendee.displayName }),
    ...(attendee.organizer != null && { organizer: attendee.organizer }),
    ...(attendee.self != null && { self: attendee.self }),
    ...(attendee.responseStatus != null && { responseStatus: attendee.responseStatus }),
    ...(attendee.comment != null && { comment: attendee.comment }),
    ...(attendee.additionalGuests != null && { additionalGuests: attendee.additionalGuests }),
  }));
}

function normalizeReminders(
  value: z.infer<typeof ProviderRemindersSchema> | null | undefined,
): z.infer<typeof RemindersSchema> | undefined {
  if (value == null) {
    return undefined;
  }
  return {
    ...(value.useDefault != null && { useDefault: value.useDefault }),
    ...(value.overrides != null && {
      overrides: value.overrides.map(override => ({
        ...(override.method != null && { method: override.method }),
        ...(override.minutes != null && { minutes: override.minutes }),
      })),
    }),
  };
}

export function getEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_get_event',
    description: 'Get an event by ID',
    inputSchema: getEventInputSchema,
    outputSchema: getEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const calendarId = input.calendarId ?? 'primary';

      const response = await platformProxy.get({
        // https://developers.google.com/workspace/calendar/api/v3/reference/events/get
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Event not found',
          calendarId,
          eventId: input.eventId,
        });
      }

      const providerEvent = ProviderEventSchema.parse(response.data);

      return {
        id: providerEvent.id,
        ...(providerEvent.summary != null && { summary: providerEvent.summary }),
        ...(providerEvent.description != null && { description: providerEvent.description }),
        ...(providerEvent.location != null && { location: providerEvent.location }),
        ...(providerEvent.status != null && { status: providerEvent.status }),
        ...(providerEvent.htmlLink != null && { htmlLink: providerEvent.htmlLink }),
        ...(providerEvent.created != null && { created: providerEvent.created }),
        updated: providerEvent.updated,
        start: normalizeEventDateTime(providerEvent.start),
        end: normalizeEventDateTime(providerEvent.end),
        ...(providerEvent.endTimeUnspecified != null && { endTimeUnspecified: providerEvent.endTimeUnspecified }),
        creator: normalizePerson(providerEvent.creator),
        organizer: normalizePerson(providerEvent.organizer),
        attendees: normalizeAttendees(providerEvent.attendees),
        ...(providerEvent.recurrence != null && { recurrence: providerEvent.recurrence }),
        ...(providerEvent.recurringEventId != null && { recurringEventId: providerEvent.recurringEventId }),
        originalStartTime: normalizeEventDateTime(providerEvent.originalStartTime),
        ...(providerEvent.transparency != null && { transparency: providerEvent.transparency }),
        ...(providerEvent.visibility != null && { visibility: providerEvent.visibility }),
        ...(providerEvent.iCalUID != null && { iCalUID: providerEvent.iCalUID }),
        ...(providerEvent.sequence != null && { sequence: providerEvent.sequence }),
        ...(providerEvent.guestsCanInviteOthers != null && {
          guestsCanInviteOthers: providerEvent.guestsCanInviteOthers,
        }),
        ...(providerEvent.guestsCanModify != null && { guestsCanModify: providerEvent.guestsCanModify }),
        ...(providerEvent.guestsCanSeeOtherGuests != null && {
          guestsCanSeeOtherGuests: providerEvent.guestsCanSeeOtherGuests,
        }),
        ...(providerEvent.anyoneCanAddSelf != null && { anyoneCanAddSelf: providerEvent.anyoneCanAddSelf }),
        reminders: normalizeReminders(providerEvent.reminders),
        ...(providerEvent.eventType != null && { eventType: providerEvent.eventType }),
      };
    },
  });
}
