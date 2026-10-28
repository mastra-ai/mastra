// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MailFolderSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  parentFolderId: z.string().optional(),
  childFolderCount: z.number().optional(),
  unreadItemCount: z.number().optional(),
  totalItemCount: z.number().optional(),
  wellKnownName: z.string().nullable().optional(),
});

const ProviderResponseSchema = z.object({
  value: z.array(MailFolderSchema),
  '@odata.nextLink': z.string().optional(),
});

export const listMailFoldersInputSchema = z.object({
  limit: z.number().min(1).max(50).optional().describe('Number of folders to return per page. Max 50.'),
  nextLink: z.string().optional().describe('OData nextLink for pagination from previous response'),
});

export const listMailFoldersOutputSchema = z.object({
  folders: z.array(
    z.object({
      id: z.string(),
      displayName: z.string().optional(),
      parentFolderId: z.string().optional(),
      childFolderCount: z.number().optional(),
      unreadItemCount: z.number().optional(),
      totalItemCount: z.number().optional(),
      wellKnownName: z.string().optional(),
    }),
  ),
  nextLink: z.string().optional().describe('OData nextLink for retrieving the next page'),
});

export function listMailFoldersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_list_mail_folders',
    description: 'List top-level mail folders from the mailbox',
    inputSchema: listMailFoldersInputSchema,
    outputSchema: listMailFoldersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listMailFoldersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Microsoft Graph: use the full @odata.nextLink URL for subsequent pages
      // https://learn.microsoft.com/graph/api/user-list-mailfolders
      const endpoint = input.nextLink ?? '/v1.0/me/mailFolders';
      const params: Record<string, string | number> = {};
      if (!input.nextLink && input.limit) {
        params['$top'] = input.limit;
      }
      const response = await platformProxy.get({ endpoint, params, retries: 3 });

      const providerData = ProviderResponseSchema.parse(response.data);

      const folders = providerData.value.map(folder => ({
        id: folder.id,
        ...(folder.displayName != null && { displayName: folder.displayName }),
        ...(folder.parentFolderId !== undefined && { parentFolderId: folder.parentFolderId }),
        ...(folder.childFolderCount !== undefined && { childFolderCount: folder.childFolderCount }),
        ...(folder.unreadItemCount !== undefined && { unreadItemCount: folder.unreadItemCount }),
        ...(folder.totalItemCount !== undefined && { totalItemCount: folder.totalItemCount }),
        ...(folder.wellKnownName != null && { wellKnownName: folder.wellKnownName }),
      }));

      return {
        folders,
        ...(providerData['@odata.nextLink'] !== undefined && { nextLink: providerData['@odata.nextLink'] }),
      };
    },
  });
}
