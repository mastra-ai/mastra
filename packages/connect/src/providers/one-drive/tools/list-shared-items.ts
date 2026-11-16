// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSharedItemsInputSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe(
      'Pagination token from the previous response ($skiptoken value). Omit for the first page. Example: "abc123"',
    ),
});

const SharedByUserSchema = z.object({
  displayName: z.string().optional(),
  id: z.string().optional(),
  email: z.string().optional(),
});

const RemoteItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  shared: z
    .object({
      sharedBy: z
        .object({
          user: SharedByUserSchema.optional(),
        })
        .optional(),
      sharedDateTime: z.string().optional(),
    })
    .optional(),
  parentReference: z
    .object({
      driveId: z.string().optional(),
      driveType: z.string().optional(),
      id: z.string().optional(),
      path: z.string().optional(),
    })
    .optional(),
  file: z.unknown().optional(),
  folder: z.unknown().optional(),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  remoteItem: RemoteItemSchema.optional(),
  size: z.number().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  file: z.unknown().optional(),
  folder: z.unknown().optional(),
});

const ProviderResponseSchema = z.object({
  value: z.array(ProviderDriveItemSchema.passthrough()),
  '@odata.nextLink': z.string().optional(),
});

const SharedItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  remoteId: z.string(),
  remoteDriveId: z.string().optional(),
  size: z.number().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  sharedBy: z
    .object({
      displayName: z.string().optional(),
      id: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  sharedDateTime: z.string().optional(),
  isFolder: z.boolean().optional(),
});

export const listSharedItemsOutputSchema = z.object({
  items: z.array(SharedItemSchema),
  nextCursor: z.string().optional().describe('Pagination cursor for the next page of results.'),
});

export function listSharedItemsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_list_shared_items',
    description: 'List items shared with the user.',
    inputSchema: listSharedItemsInputSchema,
    outputSchema: listSharedItemsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSharedItemsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/drive-sharedwithme
        endpoint: '/v1.0/me/drive/sharedWithMe',
        params: {
          ...(input.cursor && { $skiptoken: input.cursor }),
        },
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      const items = providerData.value.map(item => {
        // Use remoteItem as the stable shared reference per API docs
        const remote = item.remoteItem;
        const sharedBy = remote?.shared?.sharedBy?.user;

        return {
          id: item.id,
          name: remote?.name ?? item.name,
          remoteId: remote?.id ?? item.id,
          remoteDriveId: remote?.parentReference?.driveId,
          size: remote?.size ?? item.size,
          webUrl: remote?.webUrl ?? item.webUrl,
          createdDateTime: remote?.createdDateTime ?? item.createdDateTime,
          lastModifiedDateTime: remote?.lastModifiedDateTime ?? item.lastModifiedDateTime,
          ...(sharedBy && {
            sharedBy: {
              displayName: sharedBy.displayName,
              id: sharedBy.id,
              email: sharedBy.email,
            },
          }),
          sharedDateTime: remote?.shared?.sharedDateTime,
          isFolder: remote?.folder !== undefined || item['folder'] !== undefined,
        };
      });

      // Extract $skiptoken from the nextLink URL so cursor input/output are consistent token values.
      let nextCursor: string | undefined;
      const nextLink = providerData['@odata.nextLink'];
      if (nextLink) {
        try {
          const url = new URL(nextLink);
          nextCursor = url.searchParams.get('$skiptoken') ?? undefined;
        } catch {
          nextCursor = nextLink;
        }
      }

      return {
        items,
        ...(nextCursor !== undefined && { nextCursor }),
      };
    },
  });
}
