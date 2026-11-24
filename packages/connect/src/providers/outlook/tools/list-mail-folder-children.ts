// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listMailFolderChildrenInputSchema = z.object({
  folderId: z
    .string()
    .describe(
      'The ID of the mail folder to list children for. Example: "AAMkAGVmODUyMzE1LTM0MDctNDNlMS05YjQ1LTI4MjE5MjJmYzY1ZgAuAAAAAADY3h3zQIGrQ6Pm8GPMwoNdAQCr0pwLSY4vT6AX1L4UHn_uAAAAAAEJAAA="',
    ),
  limit: z.number().optional().describe('Maximum number of folders to return per page. Default is 10.'),
  cursor: z
    .string()
    .optional()
    .describe('Full @odata.nextLink URL from the previous response for pagination. Omit for the first page.'),
});

const ProviderMailFolderSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable().optional(),
  parentFolderId: z.string().optional(),
  childFolderCount: z.number().optional(),
  unreadItemCount: z.number().optional(),
  totalItemCount: z.number().optional(),
  sizeInBytes: z.number().optional(),
  isHidden: z.boolean().optional(),
});

const ProviderResponseSchema = z.object({
  value: z.array(ProviderMailFolderSchema),
  '@odata.nextLink': z.string().optional(),
});

const OutputFolderSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  parentFolderId: z.string().optional(),
  childFolderCount: z.number().optional(),
  unreadItemCount: z.number().optional(),
  totalItemCount: z.number().optional(),
  sizeInBytes: z.number().optional(),
  isHidden: z.boolean().optional(),
});

export const listMailFolderChildrenOutputSchema = z.object({
  folders: z.array(OutputFolderSchema),
  next_cursor: z
    .string()
    .optional()
    .describe('Cursor to fetch the next page of results. Absent if there are no more pages.'),
});

export function listMailFolderChildrenTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_list_mail_folder_children',
    description: 'List child folders under a mail folder',
    inputSchema: listMailFolderChildrenInputSchema,
    outputSchema: listMailFolderChildrenOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listMailFolderChildrenOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Microsoft Graph: use the full @odata.nextLink URL for subsequent pages
      // https://learn.microsoft.com/graph/api/mailfolder-list-childfolders
      const endpoint = input.cursor ?? `/v1.0/me/mailFolders/${encodeURIComponent(input.folderId)}/childFolders`;
      const params = input.cursor ? {} : { $top: String(input.limit ?? 10) };
      const response = await platformProxy.get({ endpoint, params, retries: 3 });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        folders: providerResponse.value.map(folder => ({
          id: folder.id,
          ...(folder.displayName != null && { displayName: folder.displayName }),
          ...(folder.parentFolderId !== undefined && { parentFolderId: folder.parentFolderId }),
          ...(folder.childFolderCount !== undefined && { childFolderCount: folder.childFolderCount }),
          ...(folder.unreadItemCount !== undefined && { unreadItemCount: folder.unreadItemCount }),
          ...(folder.totalItemCount !== undefined && { totalItemCount: folder.totalItemCount }),
          ...(folder.sizeInBytes !== undefined && { sizeInBytes: folder.sizeInBytes }),
          ...(folder.isHidden !== undefined && { isHidden: folder.isHidden }),
        })),
        ...(providerResponse['@odata.nextLink'] !== undefined && { next_cursor: providerResponse['@odata.nextLink'] }),
      };
    },
  });
}
