// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const CalendarItemSchema = z.object({
  id: z.string().describe('The identifier of a calendar or a group'),
});

export const queryFreeBusyInputSchema = z
  .object({
    timeMin: z
      .string()
      .describe('The start of the interval for the query in RFC3339 format. Example: "2024-01-01T00:00:00Z"'),
    timeMax: z
      .string()
      .describe('The end of the interval for the query in RFC3339 format. Example: "2024-01-02T00:00:00Z"'),
    timeZone: z.string().optional().describe('Time zone used in the response. Defaults to UTC if omitted.'),
    groupExpansionMax: z
      .number()
      .int()
      .optional()
      .describe('Maximal number of calendar identifiers to be provided for a single group. Maximum value is 100.'),
    calendarExpansionMax: z
      .number()
      .int()
      .optional()
      .describe('Maximal number of calendars for which FreeBusy information is to be provided. Maximum value is 50.'),
    items: z.array(CalendarItemSchema).describe('List of calendars and/or groups to query'),
  })
  .describe('Input for querying free/busy information for one or more calendars.');

const ErrorSchema = z
  .object({
    domain: z.string().describe('Error domain.'),
    reason: z.string().describe('Error reason.'),
  })
  .describe('An error entry returned for a specific calendar or group.');

const BusyPeriodSchema = z
  .object({
    start: z.string().describe('The inclusive start of the busy period in RFC3339 format.'),
    end: z.string().describe('The exclusive end of the busy period in RFC3339 format.'),
  })
  .describe('A single busy time block for a calendar.');

const CalendarFreeBusySchema = z
  .object({
    errors: z.array(ErrorSchema).optional().describe('Optional errors if computation for this calendar failed.'),
    // Google omits `busy` entirely when a calendar-level error occurs; default to [] so
    // that case parses instead of throwing and the caller still sees the error.
    busy: z.array(BusyPeriodSchema).default([]).describe('List of busy time ranges for this calendar.'),
  })
  .describe('Free/busy information for a single calendar.');

const GroupSchema = z
  .object({
    errors: z.array(ErrorSchema).optional().describe('Optional errors if the group could not be expanded.'),
    // Google omits `calendars` entirely when a group fails to expand; default to [] so
    // that case parses instead of throwing and the caller still sees the error.
    calendars: z
      .array(z.string())
      .default([])
      .describe('List of calendar identifiers that this group was expanded to.'),
  })
  .describe('Free/busy information for a single group of calendars.');

export const queryFreeBusyOutputSchema = z
  .object({
    kind: z.string().describe('Type of the resource ("calendar#freeBusy").'),
    timeMin: z.string().describe('The start of the queried interval in RFC3339 format.'),
    timeMax: z.string().describe('The end of the queried interval in RFC3339 format.'),
    groups: z
      .record(z.string(), GroupSchema)
      .optional()
      .describe('Free/busy information for groups, keyed by group identifier.'),
    calendars: z
      .record(z.string(), CalendarFreeBusySchema)
      .describe('Free/busy information for each requested calendar, keyed by calendar identifier.'),
  })
  .describe('Output containing free/busy blocks for the requested calendars.');

const ProviderResponseSchema = z.object({
  kind: z.string(),
  timeMin: z.string(),
  timeMax: z.string(),
  groups: z.record(z.string(), GroupSchema).optional(),
  calendars: z.record(z.string(), CalendarFreeBusySchema).optional(),
});

export function queryFreeBusyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_query_free_busy',
    description: 'Return free/busy blocks for one or more calendars in a time range',
    inputSchema: queryFreeBusyInputSchema,
    outputSchema: queryFreeBusyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof queryFreeBusyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
        endpoint: '/calendar/v3/freeBusy',
        data: {
          timeMin: input.timeMin,
          timeMax: input.timeMax,
          ...(input.timeZone !== undefined && { timeZone: input.timeZone }),
          ...(input.groupExpansionMax !== undefined && { groupExpansionMax: input.groupExpansionMax }),
          ...(input.calendarExpansionMax !== undefined && { calendarExpansionMax: input.calendarExpansionMax }),
          items: input.items,
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        kind: providerResponse.kind,
        timeMin: providerResponse.timeMin,
        timeMax: providerResponse.timeMax,
        ...(providerResponse.groups !== undefined && { groups: providerResponse.groups }),
        calendars: providerResponse.calendars ?? {},
      };
    },
  });
}
