// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createListColumnInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'SharePoint site ID. Example: "nangodevelopers.sharepoint.com,ff9cef8d-d0e4-4638-a6a6-d5374e2b31e1,d12a8199-c77a-4e48-a193-2e1288b26f13"',
    ),
  listId: z.string().describe('SharePoint list ID. Example: "c662d085-19c0-4514-b514-d2acbdb8a4e4"'),
  name: z.string().describe('API-facing name of the column. Example: "TestColumn"'),
  displayName: z.string().optional().describe('User-facing name of the column. Example: "Test Column"'),
  description: z.string().optional().describe('User-facing description of the column.'),
  text: z.object({}).passthrough().optional().describe('Text column settings.'),
  number: z.object({}).passthrough().optional().describe('Number column settings.'),
  choice: z.object({}).passthrough().optional().describe('Choice column settings.'),
  dateTime: z.object({}).passthrough().optional().describe('DateTime column settings.'),
  boolean: z.object({}).passthrough().optional().describe('Boolean column settings.'),
  currency: z.object({}).passthrough().optional().describe('Currency column settings.'),
  personOrGroup: z.object({}).passthrough().optional().describe('Person or group column settings.'),
  lookup: z.object({}).passthrough().optional().describe('Lookup column settings.'),
  hyperlinkOrPicture: z.object({}).passthrough().optional().describe('Hyperlink or picture column settings.'),
  calculated: z.object({}).passthrough().optional().describe('Calculated column settings.'),
  term: z.object({}).passthrough().optional().describe('Term column settings.'),
  geolocation: z.object({}).passthrough().optional().describe('Geolocation column settings.'),
  enforceUniqueValues: z.boolean().optional().describe('Whether column values must be unique.'),
  hidden: z.boolean().optional().describe('Whether the column is hidden in the UI.'),
  indexed: z.boolean().optional().describe('Whether the column is indexed for search and sort.'),
  required: z.boolean().optional().describe('Whether the column value is required.'),
  readOnly: z.boolean().optional().describe('Whether the column values can be modified.'),
  columnGroup: z.string().optional().describe('Group name for organizing site columns.'),
  defaultValue: z.object({}).passthrough().optional().describe('Default value for the column.'),
  validation: z.object({}).passthrough().optional().describe('Validation formula and message for the column.'),
});

export const createListColumnOutputSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    displayName: z.string().optional(),
    description: z.string().optional(),
    text: z.record(z.string(), z.unknown()).optional(),
    number: z.record(z.string(), z.unknown()).optional(),
    choice: z.record(z.string(), z.unknown()).optional(),
    dateTime: z.record(z.string(), z.unknown()).optional(),
    boolean: z.record(z.string(), z.unknown()).optional(),
    currency: z.record(z.string(), z.unknown()).optional(),
    personOrGroup: z.record(z.string(), z.unknown()).optional(),
    lookup: z.record(z.string(), z.unknown()).optional(),
    hyperlinkOrPicture: z.record(z.string(), z.unknown()).optional(),
    calculated: z.record(z.string(), z.unknown()).optional(),
    term: z.record(z.string(), z.unknown()).optional(),
    geolocation: z.record(z.string(), z.unknown()).optional(),
    enforceUniqueValues: z.boolean().optional(),
    hidden: z.boolean().optional(),
    indexed: z.boolean().optional(),
    required: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    columnGroup: z.string().optional(),
    defaultValue: z.record(z.string(), z.unknown()).optional(),
    validation: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export function createListColumnTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_create_list_column',
    description: 'Create a column on a SharePoint list.',
    inputSchema: createListColumnInputSchema,
    outputSchema: createListColumnOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createListColumnOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const payload: Record<string, unknown> = {
        name: input.name,
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.text !== undefined && { text: input.text }),
        ...(input.number !== undefined && { number: input.number }),
        ...(input.choice !== undefined && { choice: input.choice }),
        ...(input.dateTime !== undefined && { dateTime: input.dateTime }),
        ...(input.boolean !== undefined && { boolean: input.boolean }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.personOrGroup !== undefined && { personOrGroup: input.personOrGroup }),
        ...(input.lookup !== undefined && { lookup: input.lookup }),
        ...(input.hyperlinkOrPicture !== undefined && { hyperlinkOrPicture: input.hyperlinkOrPicture }),
        ...(input.calculated !== undefined && { calculated: input.calculated }),
        ...(input.term !== undefined && { term: input.term }),
        ...(input.geolocation !== undefined && { geolocation: input.geolocation }),
        ...(input.enforceUniqueValues !== undefined && { enforceUniqueValues: input.enforceUniqueValues }),
        ...(input.hidden !== undefined && { hidden: input.hidden }),
        ...(input.indexed !== undefined && { indexed: input.indexed }),
        ...(input.required !== undefined && { required: input.required }),
        ...(input.readOnly !== undefined && { readOnly: input.readOnly }),
        ...(input.columnGroup !== undefined && { columnGroup: input.columnGroup }),
        ...(input.defaultValue !== undefined && { defaultValue: input.defaultValue }),
        ...(input.validation !== undefined && { validation: input.validation }),
      };

      const response = await platformProxy.post({
        // https://learn.microsoft.com/en-us/graph/api/list-post-columns
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/lists/${encodeURIComponent(input.listId)}/columns`,
        data: payload,
        retries: 3,
      });

      const providerColumn = createListColumnOutputSchema.parse(response.data);

      return providerColumn;
    },
  });
}
