// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCalendarListInputSchema = z
  .object({
    cursor: z.string().optional().describe('Pagination token from the previous response. Omit for the first page.'),
    maxResults: z
      .number()
      .min(1)
      .max(250)
      .optional()
      .describe(
        'Maximum number of entries returned on one result page. By default 100 entries. The page size can never be larger than 250 entries.',
      ),
    minAccessRole: z
      .string()
      .optional()
      .describe(
        'The minimum access role for the user in the returned entries. Possible values: freeBusyReader, reader, writer, writerWithoutPrivateAccess, owner.',
      ),
    showDeleted: z
      .boolean()
      .optional()
      .describe('Whether to include deleted calendar list entries in the result. Optional. The default is false.'),
    showHidden: z.boolean().optional().describe('Whether to show hidden entries. Optional. The default is false.'),
  })
  .describe("Input for listing calendars in the user's calendar list");

const ProviderCalendarListEntrySchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  timeZone: z.string().optional(),
  summaryOverride: z.string().optional(),
  colorId: z.string().optional(),
  backgroundColor: z.string().optional(),
  foregroundColor: z.string().optional(),
  hidden: z.boolean().optional(),
  selected: z.boolean().optional(),
  accessRole: z.string().optional(),
  primary: z.boolean().optional(),
  deleted: z.boolean().optional(),
  dataOwner: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  kind: z.string(),
  etag: z.string().optional(),
  nextPageToken: z.string().optional(),
  nextSyncToken: z.string().optional(),
  items: z.array(ProviderCalendarListEntrySchema).optional(),
});

const CalendarListItemSchema = z.object({
  id: z.string().describe('Identifier of the calendar.'),
  summary: z.string().describe('Title of the calendar.'),
  description: z.string().optional().describe('Description of the calendar.'),
  location: z.string().optional().describe('Geographic location of the calendar as free-form text.'),
  timeZone: z.string().optional().describe('The time zone of the calendar.'),
  summaryOverride: z.string().optional().describe('The summary that the authenticated user has set for this calendar.'),
  colorId: z
    .string()
    .optional()
    .describe(
      'The color of the calendar. This is an ID referring to an entry in the calendar section of the colors definition.',
    ),
  backgroundColor: z.string().optional().describe('The main color of the calendar in the hexadecimal format.'),
  foregroundColor: z.string().optional().describe('The foreground color of the calendar in the hexadecimal format.'),
  hidden: z.boolean().optional().describe('Whether the calendar has been hidden from the list.'),
  selected: z.boolean().optional().describe('Whether the calendar content shows up in the calendar UI.'),
  accessRole: z
    .string()
    .optional()
    .describe('The effective access role that the authenticated user has on the calendar.'),
  primary: z.boolean().optional().describe('Whether the calendar is the primary calendar of the authenticated user.'),
  deleted: z.boolean().optional().describe('Whether this calendar list entry has been deleted from the calendar list.'),
  dataOwner: z.string().optional().describe('The email of the owner of the calendar.'),
});

export const listCalendarListOutputSchema = z
  .object({
    calendars: z.array(CalendarListItemSchema).describe("Calendars that are present on the user's calendar list."),
    nextPageToken: z
      .string()
      .optional()
      .describe('Token used to access the next page of this result. Omitted if no further results are available.'),
  })
  .describe("Output for listing calendars in the user's calendar list");

export function listCalendarListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_list_calendar_list',
    description: "List calendars in the user's calendar list",
    inputSchema: listCalendarListInputSchema,
    outputSchema: listCalendarListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCalendarListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list
        endpoint: '/calendar/v3/users/me/calendarList',
        params: {
          ...(input.cursor !== undefined && { pageToken: input.cursor }),
          ...(input.maxResults !== undefined && { maxResults: String(input.maxResults) }),
          ...(input.minAccessRole !== undefined && { minAccessRole: input.minAccessRole }),
          ...(input.showDeleted !== undefined && { showDeleted: String(input.showDeleted) }),
          ...(input.showHidden !== undefined && { showHidden: String(input.showHidden) }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const calendars = (providerResponse.items || []).map(entry => ({
        id: entry.id,
        summary: entry.summary,
        ...(entry.description !== undefined && { description: entry.description }),
        ...(entry.location !== undefined && { location: entry.location }),
        ...(entry.timeZone !== undefined && { timeZone: entry.timeZone }),
        ...(entry.summaryOverride !== undefined && { summaryOverride: entry.summaryOverride }),
        ...(entry.colorId !== undefined && { colorId: entry.colorId }),
        ...(entry.backgroundColor !== undefined && { backgroundColor: entry.backgroundColor }),
        ...(entry.foregroundColor !== undefined && { foregroundColor: entry.foregroundColor }),
        ...(entry.hidden !== undefined && { hidden: entry.hidden }),
        ...(entry.selected !== undefined && { selected: entry.selected }),
        ...(entry.accessRole !== undefined && { accessRole: entry.accessRole }),
        ...(entry.primary !== undefined && { primary: entry.primary }),
        ...(entry.deleted !== undefined && { deleted: entry.deleted }),
        ...(entry.dataOwner !== undefined && { dataOwner: entry.dataOwner }),
      }));

      return {
        calendars,
        ...(providerResponse.nextPageToken !== undefined && { nextPageToken: providerResponse.nextPageToken }),
      };
    },
  });
}
