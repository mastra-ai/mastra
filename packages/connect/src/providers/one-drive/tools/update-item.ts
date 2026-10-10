// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const FileSystemInfoSchema = z.object({
  createdDateTime: z
    .string()
    .optional()
    .describe('The UTC date and time the file was created. Example: 2024-01-15T10:00:00Z'),
  lastModifiedDateTime: z
    .string()
    .optional()
    .describe('The UTC date and time the file was last modified. Example: 2024-01-15T10:00:00Z'),
});

const ParentReferenceSchema = z.object({
  id: z.string().optional().describe('The ID of the parent item. Example: 01NKDM7HMOJTVYMDOSXFDK2QJDXCDI3WUK'),
  driveId: z
    .string()
    .optional()
    .describe('The ID of the drive containing the parent. Example: b!dRdbR4F600000000000000000000000'),
  path: z.string().optional().describe('The path of the parent. Example: /drive/root:/Documents'),
});

export const updateItemInputSchema = z.object({
  itemId: z.string().describe('The ID of the drive item to update. Example: 01NKDM7HMOJTVYMDOSXFDK2QJDXCDI3WUK'),
  name: z.string().optional().describe('The new name for the item. Example: new-file-name.docx'),
  description: z
    .string()
    .nullable()
    .optional()
    .describe('The description of the item. Set to null to clear. Example: Project documentation file'),
  fileSystemInfo: FileSystemInfoSchema.optional().describe('File system metadata to update'),
  parentReference: ParentReferenceSchema.optional().describe(
    'Parent reference to move the item to a different location',
  ),
});

const ProviderFileSchema = z.object({
  mimeType: z.string().optional(),
});

const ProviderFolderSchema = z.object({
  childCount: z.number().optional(),
});

const ProviderFileSystemInfoSchema = z.object({
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
});

const ProviderParentReferenceSchema = z.object({
  id: z.string().optional(),
  driveId: z.string().optional(),
  path: z.string().optional(),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  size: z.number().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  file: ProviderFileSchema.optional(),
  folder: ProviderFolderSchema.optional(),
  fileSystemInfo: ProviderFileSystemInfoSchema.optional(),
  parentReference: ProviderParentReferenceSchema.optional(),
});

export const updateItemOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  size: z.number().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  file: z
    .object({
      mimeType: z.string().optional(),
    })
    .optional(),
  folder: z
    .object({
      childCount: z.number().optional(),
    })
    .optional(),
  fileSystemInfo: z
    .object({
      createdDateTime: z.string().optional(),
      lastModifiedDateTime: z.string().optional(),
    })
    .optional(),
  parentReference: z
    .object({
      id: z.string().optional(),
      driveId: z.string().optional(),
      path: z.string().optional(),
    })
    .optional(),
});

interface PatchRequestBody {
  name?: string;
  description?: string | null;
  fileSystemInfo?: {
    createdDateTime?: string;
    lastModifiedDateTime?: string;
  };
  parentReference?: {
    id?: string;
    driveId?: string;
    path?: string;
  };
}

export function updateItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_update_item',
    description: 'Update mutable file or folder metadata.',
    inputSchema: updateItemInputSchema,
    outputSchema: updateItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: PatchRequestBody = {};

      if (input.name !== undefined) {
        data.name = input.name;
      }

      if (input.description !== undefined) {
        data.description = input.description;
      }

      if (input.fileSystemInfo !== undefined) {
        data.fileSystemInfo = {};
        if (input.fileSystemInfo.createdDateTime !== undefined) {
          data.fileSystemInfo.createdDateTime = input.fileSystemInfo.createdDateTime;
        }
        if (input.fileSystemInfo.lastModifiedDateTime !== undefined) {
          data.fileSystemInfo.lastModifiedDateTime = input.fileSystemInfo.lastModifiedDateTime;
        }
      }

      if (input.parentReference !== undefined) {
        data.parentReference = {};
        if (input.parentReference.id !== undefined) {
          data.parentReference.id = input.parentReference.id;
        }
        if (input.parentReference.driveId !== undefined) {
          data.parentReference.driveId = input.parentReference.driveId;
        }
        if (input.parentReference.path !== undefined) {
          data.parentReference.path = input.parentReference.path;
        }
      }

      const response = await platformProxy.patch({
        // https://learn.microsoft.com/graph/api/driveitem-update
        endpoint: `/v1.0/me/drive/items/${encodeURIComponent(input.itemId)}`,
        data: data,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Drive item not found or could not be updated',
          itemId: input.itemId,
        });
      }

      const item = ProviderDriveItemSchema.parse(response.data);

      const output: z.infer<typeof updateItemOutputSchema> = {
        id: item.id,
        name: item.name,
      };

      if (item.description !== undefined && item.description !== null) {
        output.description = item.description;
      }

      if (item.size !== undefined) {
        output.size = item.size;
      }

      if (item.webUrl !== undefined) {
        output.webUrl = item.webUrl;
      }

      if (item.createdDateTime !== undefined) {
        output.createdDateTime = item.createdDateTime;
      }

      if (item.lastModifiedDateTime !== undefined) {
        output.lastModifiedDateTime = item.lastModifiedDateTime;
      }

      if (item.file !== undefined) {
        output.file = item.file;
      }

      if (item.folder !== undefined) {
        output.folder = item.folder;
      }

      if (item.fileSystemInfo !== undefined) {
        output.fileSystemInfo = item.fileSystemInfo;
      }

      if (item.parentReference !== undefined) {
        output.parentReference = item.parentReference;
      }

      return output;
    },
  });
}
