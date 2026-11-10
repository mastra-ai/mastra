// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ColumnDefinitionSchema = z
  .object({
    name: z.string(),
    text: z.object({}).optional(),
    number: z.object({}).optional(),
    dateTime: z.object({}).optional(),
    choice: z.object({}).optional(),
    boolean: z.object({}).optional(),
    hyperlinkOrPicture: z.object({}).optional(),
    personOrGroup: z.object({}).optional(),
    lookup: z.object({}).optional(),
    currency: z.object({}).optional(),
  })
  .passthrough();

export const createListInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'SharePoint site ID. Example: "contoso.sharepoint.com,12345678-1234-1234-1234-123456789012,00000000-0000-0000-0000-000000000000"',
    ),
  displayName: z.string().describe('Display name of the list'),
  description: z.string().optional().describe('Description of the list'),
  template: z
    .string()
    .optional()
    .describe(
      'List template. Example: "genericList", "documentLibrary", "survey", "links", "announcements". Defaults to "genericList"',
    ),
  columns: z.array(ColumnDefinitionSchema).optional().describe('Optional column definitions to create with the list'),
  contentTypesEnabled: z.boolean().optional().describe('Whether content types are enabled for the list'),
});

const ProviderListSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  webUrl: z.string().optional().nullable(),
  createdDateTime: z.string().optional().nullable(),
  lastModifiedDateTime: z.string().optional().nullable(),
  list: z
    .object({
      template: z.string().optional().nullable(),
      contentTypesEnabled: z.boolean().optional().nullable(),
      hidden: z.boolean().optional().nullable(),
    })
    .optional()
    .nullable(),
  columns: z.array(z.object({}).passthrough()).optional().nullable(),
});

export const createListOutputSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  template: z.string().optional(),
  contentTypesEnabled: z.boolean().optional(),
  hidden: z.boolean().optional(),
  columns: z.array(z.object({}).passthrough()).optional(),
});

export function createListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_create_list',
    description: 'Create a SharePoint list on a site',
    inputSchema: createListInputSchema,
    outputSchema: createListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {
        displayName: input.displayName,
        list: {
          template: input.template ?? 'genericList',
        },
      };

      if (input.description !== undefined) {
        requestBody['description'] = input.description;
      }

      if (input.columns !== undefined && input.columns.length > 0) {
        requestBody['columns'] = input.columns;
      }

      if (input.contentTypesEnabled !== undefined) {
        requestBody['contentTypesEnabled'] = input.contentTypesEnabled;
      }

      // https://learn.microsoft.com/graph/api/list-create
      const response = await platformProxy.post({
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/lists`,
        data: requestBody,
        retries: 3,
      });

      const providerList = ProviderListSchema.parse(response.data);

      return {
        id: providerList.id,
        displayName: providerList.displayName,
        ...(providerList.name !== undefined && providerList.name !== null && { name: providerList.name }),
        ...(providerList.description !== undefined &&
          providerList.description !== null && { description: providerList.description }),
        ...(providerList.webUrl !== undefined && providerList.webUrl !== null && { webUrl: providerList.webUrl }),
        ...(providerList.createdDateTime !== undefined &&
          providerList.createdDateTime !== null && { createdDateTime: providerList.createdDateTime }),
        ...(providerList.lastModifiedDateTime !== undefined &&
          providerList.lastModifiedDateTime !== null && { lastModifiedDateTime: providerList.lastModifiedDateTime }),
        ...(providerList.list !== undefined &&
          providerList.list !== null &&
          providerList.list.template !== undefined &&
          providerList.list.template !== null && { template: providerList.list.template }),
        ...(providerList.list !== undefined &&
          providerList.list !== null &&
          providerList.list.contentTypesEnabled !== undefined &&
          providerList.list.contentTypesEnabled !== null && {
            contentTypesEnabled: providerList.list.contentTypesEnabled,
          }),
        ...(providerList.list !== undefined &&
          providerList.list !== null &&
          providerList.list.hidden !== undefined &&
          providerList.list.hidden !== null && { hidden: providerList.list.hidden }),
        ...(providerList.columns !== undefined && providerList.columns !== null && { columns: providerList.columns }),
      };
    },
  });
}
