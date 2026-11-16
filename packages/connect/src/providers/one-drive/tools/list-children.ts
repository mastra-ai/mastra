// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listChildrenInputSchema = z.object({
  itemId: z
    .string()
    .optional()
    .describe('Item ID of the folder. Use "root" or omit to list root children. Example: "0123456789ABCDEF!123"'),
});

const FileSystemInfoSchema = z.object({
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
});

const FolderSchema = z.object({
  childCount: z.number().optional(),
});

const DeletedSchema = z.object({
  state: z.string().optional(),
});

const DriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  fileSystemInfo: FileSystemInfoSchema.optional(),
  folder: FolderSchema.optional(),
  deleted: DeletedSchema.optional(),
});

export const listChildrenOutputSchema = z.object({
  items: z.array(DriveItemSchema),
  nextLink: z.string().optional(),
});

export function listChildrenTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_list_children',
    description: 'List items under a folder',
    inputSchema: listChildrenInputSchema,
    outputSchema: listChildrenOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listChildrenOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const itemId = input.itemId || 'root';
      const encodedItemId = encodeURIComponent(itemId);

      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/driveitem-list-children
        endpoint: `/v1.0/me/drive/items/${encodedItemId}/children`,
        retries: 3,
      });

      if (!response.data || !Array.isArray(response.data.value)) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Microsoft Graph API',
        });
      }

      const items = response.data.value.map((item: unknown) => {
        const parsed = DriveItemSchema.safeParse(item);
        if (!parsed.success) {
          throw new platformProxy.ActionError({
            type: 'parse_error',
            message: 'Failed to parse drive item',
            details: parsed.error.message,
          });
        }
        return parsed.data;
      });

      return {
        items,
        ...(response.data['@odata.nextLink'] !== undefined && {
          nextLink: response.data['@odata.nextLink'],
        }),
      };
    },
  });
}
