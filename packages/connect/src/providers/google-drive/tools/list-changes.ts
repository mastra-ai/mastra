// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const StartPageTokenResponseSchema = z.object({
  startPageToken: z.string(),
});

const DriveApiFileSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  mimeType: z.string().nullish(),
  modifiedTime: z.string().nullish(),
});

const DriveApiChangeSchema = z.object({
  changeType: z.string().nullish(),
  file: DriveApiFileSchema.nullish(),
  fileId: z.string(),
  removed: z.boolean().optional(),
  time: z.string().nullish(),
});

const ListChangesResponseSchema = z.object({
  changes: z.array(DriveApiChangeSchema).optional(),
  nextPageToken: z.string().optional(),
  newStartPageToken: z.string().optional(),
});

export const listChangesInputSchema = z.object({
  pageToken: z
    .string()
    .optional()
    .describe(
      'The token for continuing a previous list request. Omit for first request, in which case the action will get a start page token automatically.',
    ),
  driveId: z.string().optional().describe('The shared drive ID. If specified, changes will be limited to this drive.'),
  includeItemsFromAllDrives: z
    .boolean()
    .optional()
    .describe('Whether to include changes from all shared drives. Default: false'),
  includeRemoved: z
    .boolean()
    .optional()
    .describe('Whether to include changes indicating items have been removed. Default: true'),
  pageSize: z
    .number()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum number of changes to return per page. Default: 100'),
});

const FileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  mimeType: z.string().optional(),
  modifiedTime: z.string().optional(),
});

const ChangeSchema = z.object({
  changeType: z.string().optional(),
  file: FileSchema.optional(),
  fileId: z.string(),
  removed: z.boolean().optional(),
  time: z.string().optional(),
});

export const listChangesOutputSchema = z.object({
  changes: z.array(ChangeSchema),
  nextPageToken: z.string().optional(),
  newStartPageToken: z.string().optional(),
});

export function listChangesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_list_changes',
    description: 'List changes to files and shared drives',
    inputSchema: listChangesInputSchema,
    outputSchema: listChangesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listChangesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let pageToken = input.pageToken;

      // If no page token provided, get the start page token
      if (!pageToken) {
        // https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/getStartPageToken
        const startTokenResponse = await platformProxy.get({
          endpoint: '/drive/v3/changes/startPageToken',
          retries: 3,
        });
        pageToken = StartPageTokenResponseSchema.parse(startTokenResponse.data).startPageToken;
      }

      const params: Record<string, string | number> = {
        pageToken,
      };

      if (input.driveId) {
        params['driveId'] = input.driveId;
      }

      if (input.includeItemsFromAllDrives !== undefined) {
        params['includeItemsFromAllDrives'] = String(input.includeItemsFromAllDrives);
      }

      if (input.includeRemoved !== undefined) {
        params['includeRemoved'] = String(input.includeRemoved);
      } else {
        params['includeRemoved'] = 'true';
      }

      if (input.pageSize) {
        params['pageSize'] = input.pageSize;
      }

      // https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list
      const response = await platformProxy.get({
        endpoint: '/drive/v3/changes',
        params,
        retries: 3,
      });

      const data = ListChangesResponseSchema.parse(response.data);

      const changes = (data.changes || []).map(change => ({
        changeType: change.changeType ?? undefined,
        file: change.file
          ? {
              id: change.file.id,
              name: change.file.name ?? undefined,
              mimeType: change.file.mimeType ?? undefined,
              modifiedTime: change.file.modifiedTime ?? undefined,
            }
          : undefined,
        fileId: change.fileId,
        removed: change.removed ?? false,
        time: change.time ?? undefined,
      }));

      return {
        changes,
        nextPageToken: data.nextPageToken || undefined,
        newStartPageToken: data.newStartPageToken || undefined,
      };
    },
  });
}
