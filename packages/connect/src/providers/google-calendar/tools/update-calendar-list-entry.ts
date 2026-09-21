// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DefaultReminderSchema = z.object({
  method: z.enum(['email', 'popup']).describe('Reminder delivery method. Possible values: "email", "popup".'),
  minutes: z
    .number()
    .int()
    .min(0)
    .max(40320)
    .describe('Minutes before event start when the reminder triggers. Valid values: 0 to 40320.'),
});

const NotificationSchema = z.object({
  type: z
    .enum(['eventCreation', 'eventChange', 'eventCancellation', 'eventResponse', 'agenda'])
    .describe(
      'Notification type. Possible values: "eventCreation", "eventChange", "eventCancellation", "eventResponse", "agenda".',
    ),
  method: z.enum(['email']).describe('Notification delivery method. Possible value: "email".'),
});

const NotificationSettingsSchema = z.object({
  notifications: z.array(NotificationSchema).describe('List of notifications set for this calendar.'),
});

export const updateCalendarListEntryInputSchema = z
  .object({
    calendarId: z
      .string()
      .describe('Calendar identifier. Use "primary" for the primary calendar of the authenticated user.'),
    colorRgbFormat: z
      .boolean()
      .optional()
      .describe(
        'Whether to use foregroundColor and backgroundColor to write calendar colors in RGB. If true, colorId is set automatically.',
      ),
    summaryOverride: z.string().optional().describe('Custom summary the user has set for this calendar.'),
    hidden: z.boolean().optional().describe('Whether the calendar is hidden from the list.'),
    selected: z.boolean().optional().describe('Whether the calendar content shows up in the calendar UI.'),
    colorId: z
      .string()
      .optional()
      .describe('Index-based color ID referring to an entry in the calendar colors definition.'),
    backgroundColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .describe('Background color in hexadecimal format "#0088aa". Requires colorRgbFormat=true.'),
    foregroundColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .describe('Foreground color in hexadecimal format "#ffffff". Requires colorRgbFormat=true.'),
    defaultReminders: z
      .array(DefaultReminderSchema)
      .optional()
      .describe('Default reminders that the authenticated user has for this calendar.'),
    notificationSettings: NotificationSettingsSchema.optional().describe(
      'Notifications that the authenticated user is receiving for this calendar.',
    ),
  })
  .describe('Input for updating a calendar list entry');

const ProviderCalendarListEntrySchema = z.object({
  kind: z.string().optional(),
  etag: z.string().optional(),
  id: z.string(),
  summary: z.string().optional(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  timeZone: z.string().optional().nullable(),
  summaryOverride: z.string().optional().nullable(),
  colorId: z.string().optional().nullable(),
  backgroundColor: z.string().optional().nullable(),
  foregroundColor: z.string().optional().nullable(),
  hidden: z.boolean().optional().nullable(),
  selected: z.boolean().optional().nullable(),
  accessRole: z.string().optional(),
  defaultReminders: z
    .array(
      z.object({
        method: z.string(),
        minutes: z.number(),
      }),
    )
    .optional(),
  notificationSettings: z
    .object({
      notifications: z.array(
        z.object({
          type: z.string(),
          method: z.string(),
        }),
      ),
    })
    .optional(),
  primary: z.boolean().optional(),
  deleted: z.boolean().optional(),
  conferenceProperties: z
    .object({
      allowedConferenceSolutionTypes: z.array(z.string()),
    })
    .optional()
    .nullable(),
  autoAcceptInvitations: z.boolean().optional(),
});

export const updateCalendarListEntryOutputSchema = z
  .object({
    id: z.string().describe('Identifier of the calendar.'),
    summary: z.string().optional().describe('Title of the calendar.'),
    description: z.string().optional().describe('Description of the calendar.'),
    location: z.string().optional().describe('Geographic location of the calendar.'),
    timeZone: z.string().optional().describe('Time zone of the calendar.'),
    summaryOverride: z.string().optional().describe('Custom summary set by the user.'),
    colorId: z.string().optional().describe('Index-based color ID.'),
    backgroundColor: z.string().optional().describe('Background color in hexadecimal format.'),
    foregroundColor: z.string().optional().describe('Foreground color in hexadecimal format.'),
    hidden: z.boolean().optional().describe('Whether the calendar is hidden from the list.'),
    selected: z.boolean().optional().describe('Whether the calendar shows in the UI.'),
    accessRole: z.string().optional().describe('Effective access role of the user on the calendar.'),
    defaultReminders: z
      .array(z.object({ method: z.string(), minutes: z.number() }))
      .optional()
      .describe('Default reminders for this calendar.'),
    notificationSettings: z
      .object({ notifications: z.array(z.object({ type: z.string(), method: z.string() })) })
      .optional()
      .describe('Notification settings for this calendar.'),
    primary: z.boolean().optional().describe('Whether this is the primary calendar of the authenticated user.'),
    deleted: z.boolean().optional().describe('Whether this calendar list entry has been deleted.'),
    conferenceProperties: z
      .object({
        allowedConferenceSolutionTypes: z
          .array(z.string())
          .describe('Supported conference solution types for this calendar.'),
      })
      .optional()
      .describe('Conferencing properties for this calendar.'),
  })
  .describe('Updated calendar list entry');

export function updateCalendarListEntryTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_update_calendar_list_entry',
    description: "Update a calendar list entry's settings",
    inputSchema: updateCalendarListEntryInputSchema,
    outputSchema: updateCalendarListEntryOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateCalendarListEntryOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const body: Record<string, unknown> = {};
      if (input.summaryOverride !== undefined) {
        body['summaryOverride'] = input.summaryOverride;
      }
      if (input.hidden !== undefined) {
        body['hidden'] = input.hidden;
      }
      if (input.selected !== undefined) {
        body['selected'] = input.selected;
      }
      if (input.colorId !== undefined) {
        body['colorId'] = input.colorId;
      }
      if (input.backgroundColor !== undefined) {
        body['backgroundColor'] = input.backgroundColor;
      }
      if (input.foregroundColor !== undefined) {
        body['foregroundColor'] = input.foregroundColor;
      }
      if (input.defaultReminders !== undefined) {
        body['defaultReminders'] = input.defaultReminders;
      }
      if (input.notificationSettings !== undefined) {
        body['notificationSettings'] = input.notificationSettings;
      }

      // https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/update
      const response = await platformProxy.put({
        endpoint: `/calendar/v3/users/me/calendarList/${encodeURIComponent(input.calendarId)}`,
        ...(input.colorRgbFormat !== undefined && { params: { colorRgbFormat: String(input.colorRgbFormat) } }),
        data: body,
        retries: 10,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Calendar list entry not found or update failed',
          calendarId: input.calendarId,
        });
      }

      const entry = ProviderCalendarListEntrySchema.parse(response.data);

      return {
        id: entry.id,
        ...(entry.summary !== undefined && { summary: entry.summary }),
        ...(entry.description != null && { description: entry.description }),
        ...(entry.location != null && { location: entry.location }),
        ...(entry.timeZone != null && { timeZone: entry.timeZone }),
        ...(entry.summaryOverride != null && { summaryOverride: entry.summaryOverride }),
        ...(entry.colorId != null && { colorId: entry.colorId }),
        ...(entry.backgroundColor != null && { backgroundColor: entry.backgroundColor }),
        ...(entry.foregroundColor != null && { foregroundColor: entry.foregroundColor }),
        ...(entry.hidden != null && { hidden: entry.hidden }),
        ...(entry.selected != null && { selected: entry.selected }),
        ...(entry.accessRole !== undefined && { accessRole: entry.accessRole }),
        ...(entry.defaultReminders !== undefined && { defaultReminders: entry.defaultReminders }),
        ...(entry.notificationSettings !== undefined && { notificationSettings: entry.notificationSettings }),
        ...(entry.primary !== undefined && { primary: entry.primary }),
        ...(entry.deleted !== undefined && { deleted: entry.deleted }),
        ...(entry.conferenceProperties != null && { conferenceProperties: entry.conferenceProperties }),
      };
    },
  });
}
