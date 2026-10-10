// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listWorkbooksInputSchema = z.object({
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  query: z.string().optional().describe('Search query for workbook names. Omit to list all workbooks.'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  file: z
    .object({
      mimeType: z.string().optional(),
    })
    .optional(),
  '@microsoft.graph.downloadUrl': z.string().optional(),
});

const ProviderListResponseSchema = z.object({
  value: z.array(z.unknown()),
  '@odata.nextLink': z.string().optional(),
});

const WorkbookSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string().optional(),
  downloadUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
});

export const listWorkbooksOutputSchema = z.object({
  workbooks: z.array(WorkbookSchema),
  nextCursor: z.string().optional(),
});

export function listWorkbooksTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_list_workbooks',
    description: 'List and search .xlsx files within a drive.',
    inputSchema: listWorkbooksInputSchema,
    outputSchema: listWorkbooksOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWorkbooksOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const baseUrl = 'https://graph.microsoft.com';
      let endpoint: string;
      const params: Record<string, string> = {};

      if (input.cursor) {
        if (input.cursor.startsWith(baseUrl)) {
          endpoint = input.cursor.slice(baseUrl.length);
        } else {
          endpoint = input.cursor;
        }
      } else {
        const encodedDriveId = encodeURIComponent(input.driveId);
        // OData string literals require embedded single quotes to be doubled.
        // Search covers the whole drive recursively, unlike root/children which only lists the root folder.
        const searchTerm = input.query ? input.query.replace(/'/g, "''") : '.xlsx';
        endpoint = `/v1.0/drives/${encodedDriveId}/root/search(q='${encodeURIComponent(searchTerm)}')`;
        params['$top'] = '50';
      }

      const callConfig = {
        endpoint,
        retries: 3,
      };

      if (Object.keys(params).length > 0) {
        Object.assign(callConfig, { params });
      }

      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/driveitem-search
        ...callConfig,
        retries: 10,
      });

      const listResponse = ProviderListResponseSchema.parse(response.data);
      const items = listResponse.value;
      const nextLink = listResponse['@odata.nextLink'];

      const targetMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const workbooks = items
        .map(item => {
          const parsed = ProviderDriveItemSchema.safeParse(item);
          if (!parsed.success) {
            return null;
          }
          const driveItem = parsed.data;
          const itemMimeType = driveItem.file?.mimeType;
          if (itemMimeType !== targetMimeType) {
            return null;
          }
          return {
            id: driveItem.id,
            name: driveItem.name,
            ...(driveItem.webUrl !== undefined && { webUrl: driveItem.webUrl }),
            ...(driveItem['@microsoft.graph.downloadUrl'] !== undefined && {
              downloadUrl: driveItem['@microsoft.graph.downloadUrl'],
            }),
            ...(driveItem.size !== undefined && { size: driveItem.size }),
            ...(driveItem.createdDateTime !== undefined && { createdDateTime: driveItem.createdDateTime }),
            ...(driveItem.lastModifiedDateTime !== undefined && {
              lastModifiedDateTime: driveItem.lastModifiedDateTime,
            }),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return {
        workbooks,
        ...(nextLink !== undefined && { nextCursor: nextLink }),
      };
    },
  });
}
