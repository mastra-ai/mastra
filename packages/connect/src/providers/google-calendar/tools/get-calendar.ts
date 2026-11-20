// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getCalendarInputSchema = z
  .object({
    calendarId: z
      .string()
      .describe('Calendar identifier. Use "primary" for the primary calendar of the logged-in user.'),
  })
  .describe('Input for getting a calendar by ID.');

const ProviderConferencePropertiesSchema = z.object({
  allowedConferenceSolutionTypes: z.array(z.string()).optional(),
});

const ProviderEventLabelSchema = z.object({
  id: z.string().optional(),
  backgroundColor: z.string().optional(),
  name: z.string().optional(),
});

const ProviderLabelPropertiesSchema = z.object({
  eventLabels: z.array(ProviderEventLabelSchema).optional(),
});

const ProviderCalendarSchema = z.object({
  kind: z.string().optional(),
  etag: z.string().optional(),
  id: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  timeZone: z.string().optional(),
  dataOwner: z.string().optional(),
  conferenceProperties: ProviderConferencePropertiesSchema.optional(),
  labelProperties: ProviderLabelPropertiesSchema.optional(),
  autoAcceptInvitations: z.boolean().optional(),
});

export const getCalendarOutputSchema = z
  .object({
    id: z.string().describe('Identifier of the calendar.'),
    etag: z.string().optional().describe('ETag of the resource.'),
    kind: z.string().optional().describe('Type of the resource ("calendar#calendar").'),
    summary: z.string().optional().describe('Title of the calendar.'),
    description: z.string().optional().describe('Description of the calendar.'),
    location: z.string().optional().describe('Geographic location of the calendar as free-form text.'),
    timeZone: z
      .string()
      .optional()
      .describe('Time zone of the calendar as an IANA Time Zone Database name, e.g. "Europe/Zurich".'),
    dataOwner: z.string().optional().describe('Email of the owner of the calendar. Set only for secondary calendars.'),
    conferenceProperties: z
      .object({
        allowedConferenceSolutionTypes: z
          .array(z.string())
          .optional()
          .describe('Types of conference solutions supported for this calendar.'),
      })
      .optional()
      .describe('Conferencing properties for this calendar.'),
    labelProperties: z
      .object({
        eventLabels: z
          .array(
            z.object({
              id: z.string().optional().describe('The ID of the label.'),
              backgroundColor: z.string().optional().describe('Background color of the label in hexadecimal format.'),
              name: z.string().optional().describe('Name of the label.'),
            }),
          )
          .optional()
          .describe('Event labels defined on this calendar.'),
      })
      .optional()
      .describe('Label properties defined on this calendar.'),
    autoAcceptInvitations: z
      .boolean()
      .optional()
      .describe('Whether this calendar automatically accepts invitations. Only valid for resource calendars.'),
  })
  .describe('Calendar metadata returned by the Google Calendar API.');

export function getCalendarTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_get_calendar',
    description: 'Get a calendar by ID',
    inputSchema: getCalendarInputSchema,
    outputSchema: getCalendarOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCalendarOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/calendar/api/v3/reference/calendars/get
      const response = await platformProxy.get({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Calendar not found',
          calendarId: input.calendarId,
        });
      }

      const providerCalendar = ProviderCalendarSchema.parse(response.data);

      return {
        id: providerCalendar.id,
        ...(providerCalendar.etag !== undefined && { etag: providerCalendar.etag }),
        ...(providerCalendar.kind !== undefined && { kind: providerCalendar.kind }),
        ...(providerCalendar.summary !== undefined && { summary: providerCalendar.summary }),
        ...(providerCalendar.description !== undefined && { description: providerCalendar.description }),
        ...(providerCalendar.location !== undefined && { location: providerCalendar.location }),
        ...(providerCalendar.timeZone !== undefined && { timeZone: providerCalendar.timeZone }),
        ...(providerCalendar.dataOwner !== undefined && { dataOwner: providerCalendar.dataOwner }),
        ...(providerCalendar.conferenceProperties !== undefined && {
          conferenceProperties: {
            ...(providerCalendar.conferenceProperties.allowedConferenceSolutionTypes !== undefined && {
              allowedConferenceSolutionTypes: providerCalendar.conferenceProperties.allowedConferenceSolutionTypes,
            }),
          },
        }),
        ...(providerCalendar.labelProperties !== undefined && {
          labelProperties: {
            ...(providerCalendar.labelProperties.eventLabels !== undefined && {
              eventLabels: providerCalendar.labelProperties.eventLabels,
            }),
          },
        }),
        ...(providerCalendar.autoAcceptInvitations !== undefined && {
          autoAcceptInvitations: providerCalendar.autoAcceptInvitations,
        }),
      };
    },
  });
}
