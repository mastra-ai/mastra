// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createMailFolderInputSchema = z.object({
  parentFolderId: z.string().describe('The unique identifier of the parent mail folder. Example: "AQMkAGI2..."'),
  displayName: z.string().describe('The display name of the new mail folder. Example: "Work"'),
  hidden: z.boolean().optional().describe('Whether the folder should be hidden from standard folder lists.'),
});

const ProviderMailFolderSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  parentFolderId: z.string().optional(),
  childFolderCount: z.number().optional(),
  unreadItemCount: z.number().optional(),
  totalItemCount: z.number().optional(),
  isHidden: z.boolean().optional(),
});

export const createMailFolderOutputSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  parentFolderId: z.string().optional(),
  childFolderCount: z.number().optional(),
  unreadItemCount: z.number().optional(),
  totalItemCount: z.number().optional(),
  isHidden: z.boolean().optional(),
});

export function createMailFolderTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_create_mail_folder',
    description: 'Create a child mail folder in Outlook.',
    inputSchema: createMailFolderInputSchema,
    outputSchema: createMailFolderOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createMailFolderOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      type RequestBody = {
        displayName: string;
        isHidden?: boolean;
      };

      const requestBody: RequestBody = {
        displayName: input.displayName,
      };

      if (input.hidden !== undefined) {
        requestBody.isHidden = input.hidden;
      }

      // https://learn.microsoft.com/graph/api/mailfolder-post-childfolders
      const response = await platformProxy.post({
        endpoint: `/v1.0/me/mailFolders/${encodeURIComponent(input.parentFolderId)}/childFolders`,
        data: requestBody,
        retries: 3,
      });

      const providerFolder = ProviderMailFolderSchema.parse(response.data);

      return {
        id: providerFolder.id,
        displayName: providerFolder.displayName,
        parentFolderId: providerFolder.parentFolderId,
        childFolderCount: providerFolder.childFolderCount,
        unreadItemCount: providerFolder.unreadItemCount,
        totalItemCount: providerFolder.totalItemCount,
        isHidden: providerFolder.isHidden,
      };
    },
  });
}
