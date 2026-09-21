// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DefaultReminderSchema = z.object({
  method: z.string().describe('The method used by this reminder. Possible values: "email", "popup".'),
  minutes: z
    .number()
    .describe(
      'Number of minutes before the start of the event when the reminder should trigger. Valid values are between 0 and 40320.',
    ),
});

const NotificationSchema = z.object({
  type: z
    .string()
    .describe(
      'The type of notification. Possible values: "eventCreation", "eventChange", "eventCancellation", "eventResponse", "agenda".',
    ),
  method: z.string().describe('The method used to deliver the notification. Possible value: "email".'),
});

export const insertCalendarToListInputSchema = z
  .object({
    calendarId: z
      .string()
      .describe('Identifier of the calendar to add to the list. Example: "primary" or an email address.'),
    colorRgbFormat: z
      .boolean()
      .optional()
      .describe(
        'Whether to use the foregroundColor and backgroundColor fields to write calendar colors. If true, colorId is set automatically to the best matching option. Default is false.',
      ),
    backgroundColor: z
      .string()
      .optional()
      .describe('The main color of the calendar in hexadecimal format "#0088aa". Requires colorRgbFormat=true.'),
    foregroundColor: z
      .string()
      .optional()
      .describe('The foreground color of the calendar in hexadecimal format "#ffffff". Requires colorRgbFormat=true.'),
    colorId: z
      .string()
      .optional()
      .describe(
        'The color ID referring to an entry in the calendar section of the colors definition. Superseded by backgroundColor and foregroundColor when colorRgbFormat=true.',
      ),
    hidden: z.boolean().optional().describe('Whether the calendar has been hidden from the list.'),
    selected: z
      .boolean()
      .optional()
      .describe('Whether the calendar content shows up in the calendar UI. Default is false.'),
    summaryOverride: z
      .string()
      .optional()
      .describe('The summary that the authenticated user has set for this calendar.'),
    defaultReminders: z
      .array(DefaultReminderSchema)
      .optional()
      .describe('The default reminders that the authenticated user has for this calendar.'),
    notificationSettings: z
      .object({
        notifications: z
          .array(NotificationSchema)
          .optional()
          .describe('The list of notifications set for this calendar.'),
      })
      .optional()
      .describe('The notifications that the authenticated user is receiving for this calendar.'),
  })
  .describe("Input for inserting an existing calendar into the user's calendar list.");

const ProviderCalendarListEntrySchema = z.object({
  kind: z.string().nullish(),
  etag: z.string().nullish(),
  id: z.string(),
  summary: z.string().nullish(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  timeZone: z.string().nullish(),
  summaryOverride: z.string().nullish(),
  colorId: z.string().nullish(),
  backgroundColor: z.string().nullish(),
  foregroundColor: z.string().nullish(),
  hidden: z.boolean().nullish(),
  selected: z.boolean().nullish(),
  accessRole: z.string().nullish(),
  primary: z.boolean().nullish(),
  deleted: z.boolean().nullish(),
  defaultReminders: z
    .array(
      z.object({
        method: z.string().nullish(),
        minutes: z.number().nullish(),
      }),
    )
    .nullish(),
  notificationSettings: z
    .object({
      notifications: z
        .array(
          z.object({
            type: z.string().nullish(),
            method: z.string().nullish(),
          }),
        )
        .nullish(),
    })
    .nullish(),
  conferenceProperties: z
    .object({
      allowedConferenceSolutionTypes: z.array(z.string()).nullish(),
    })
    .nullish(),
});

export const insertCalendarToListOutputSchema = z
  .object({
    kind: z.string().optional().describe('Type of the resource ("calendar#calendarListEntry").'),
    etag: z.string().optional().describe('ETag of the resource.'),
    id: z.string().describe('Identifier of the calendar.'),
    summary: z.string().optional().describe('Title of the calendar.'),
    description: z.string().optional().describe('Description of the calendar.'),
    location: z.string().optional().describe('Geographic location of the calendar as free-form text.'),
    timeZone: z.string().optional().describe('The time zone of the calendar.'),
    summaryOverride: z
      .string()
      .optional()
      .describe('The summary that the authenticated user has set for this calendar.'),
    colorId: z.string().optional().describe('The color ID of the calendar.'),
    backgroundColor: z.string().optional().describe('The main color of the calendar in hexadecimal format.'),
    foregroundColor: z.string().optional().describe('The foreground color of the calendar in hexadecimal format.'),
    hidden: z.boolean().optional().describe('Whether the calendar has been hidden from the list.'),
    selected: z.boolean().optional().describe('Whether the calendar content shows up in the calendar UI.'),
    accessRole: z
      .string()
      .optional()
      .describe('The effective access role that the authenticated user has on the calendar.'),
    primary: z.boolean().optional().describe('Whether the calendar is the primary calendar of the authenticated user.'),
    deleted: z
      .boolean()
      .optional()
      .describe('Whether this calendar list entry has been deleted from the calendar list.'),
    defaultReminders: z
      .array(DefaultReminderSchema)
      .optional()
      .describe('The default reminders that the authenticated user has for this calendar.'),
    notificationSettings: z
      .object({
        notifications: z
          .array(NotificationSchema)
          .optional()
          .describe('The list of notifications set for this calendar.'),
      })
      .optional()
      .describe('The notifications that the authenticated user is receiving for this calendar.'),
    conferenceProperties: z
      .object({
        allowedConferenceSolutionTypes: z
          .array(z.string())
          .optional()
          .describe('The types of conference solutions that are supported for this calendar.'),
      })
      .optional()
      .describe('Conferencing properties for this calendar.'),
  })
  .describe('A calendar list entry representing the inserted calendar.');

export function insertCalendarToListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_insert_calendar_to_list',
    description: "Add an existing calendar to the user's list with optional colors",
    inputSchema: insertCalendarToListInputSchema,
    outputSchema: insertCalendarToListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof insertCalendarToListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const body: Record<string, unknown> = {
        id: input.calendarId,
      };

      if (input.backgroundColor !== undefined) {
        body['backgroundColor'] = input.backgroundColor;
      }
      if (input.foregroundColor !== undefined) {
        body['foregroundColor'] = input.foregroundColor;
      }
      if (input.colorId !== undefined) {
        body['colorId'] = input.colorId;
      }
      if (input.hidden !== undefined) {
        body['hidden'] = input.hidden;
      }
      if (input.selected !== undefined) {
        body['selected'] = input.selected;
      }
      if (input.summaryOverride !== undefined) {
        body['summaryOverride'] = input.summaryOverride;
      }
      if (input.defaultReminders !== undefined) {
        body['defaultReminders'] = input.defaultReminders;
      }
      if (input.notificationSettings !== undefined) {
        body['notificationSettings'] = input.notificationSettings;
      }

      const response = await platformProxy.post({
        // https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/insert
        endpoint: '/calendar/v3/users/me/calendarList',
        params: {
          ...(input.colorRgbFormat !== undefined && { colorRgbFormat: String(input.colorRgbFormat) }),
        },
        data: body,
        retries: 10,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Google Calendar API',
        });
      }

      const entry = ProviderCalendarListEntrySchema.parse(response.data);

      return {
        ...(entry.kind != null && { kind: entry.kind }),
        ...(entry.etag != null && { etag: entry.etag }),
        id: entry.id,
        ...(entry.summary != null && { summary: entry.summary }),
        ...(entry.description != null && { description: entry.description }),
        ...(entry.location != null && { location: entry.location }),
        ...(entry.timeZone != null && { timeZone: entry.timeZone }),
        ...(entry.summaryOverride != null && { summaryOverride: entry.summaryOverride }),
        ...(entry.colorId != null && { colorId: entry.colorId }),
        ...(entry.backgroundColor != null && { backgroundColor: entry.backgroundColor }),
        ...(entry.foregroundColor != null && { foregroundColor: entry.foregroundColor }),
        ...(entry.hidden != null && { hidden: entry.hidden }),
        ...(entry.selected != null && { selected: entry.selected }),
        ...(entry.accessRole != null && { accessRole: entry.accessRole }),
        ...(entry.primary != null && { primary: entry.primary }),
        ...(entry.deleted != null && { deleted: entry.deleted }),
        ...(entry.defaultReminders != null && {
          defaultReminders: (() => {
            const reminders: Array<{ method: string; minutes: number }> = [];
            for (const r of entry.defaultReminders) {
              if (typeof r.method === 'string' && typeof r.minutes === 'number') {
                reminders.push({ method: r.method, minutes: r.minutes });
              }
            }
            return reminders;
          })(),
        }),
        ...(entry.notificationSettings != null && {
          notificationSettings: {
            ...(entry.notificationSettings.notifications != null && {
              notifications: (() => {
                const notifications: Array<{ type: string; method: string }> = [];
                for (const n of entry.notificationSettings.notifications) {
                  if (typeof n.type === 'string' && typeof n.method === 'string') {
                    notifications.push({ type: n.type, method: n.method });
                  }
                }
                return notifications;
              })(),
            }),
          },
        }),
        ...(entry.conferenceProperties != null && {
          conferenceProperties: {
            ...(entry.conferenceProperties.allowedConferenceSolutionTypes != null && {
              allowedConferenceSolutionTypes: entry.conferenceProperties.allowedConferenceSolutionTypes,
            }),
          },
        }),
      };
    },
  });
}
