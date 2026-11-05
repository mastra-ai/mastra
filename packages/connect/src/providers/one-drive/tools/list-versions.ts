// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listVersionsInputSchema = z.object({
  itemId: z.string().describe('The ID of the file to list versions for. Example: "0123456789ABC!123"'),
});

const LastModifiedUserSchema = z.object({
  id: z.string().optional(),
  displayName: z.string().optional(),
});

const LastModifiedBySchema = z.object({
  user: LastModifiedUserSchema.optional(),
});

const DriveItemVersionSchema = z.object({
  id: z.string(),
  lastModifiedBy: LastModifiedBySchema.optional(),
  lastModifiedDateTime: z.string().optional(),
  size: z.number().optional(),
});

const VersionsResponseSchema = z.object({
  value: z.array(DriveItemVersionSchema),
});

const VersionOutputSchema = z.object({
  id: z.string(),
  lastModifiedBy: z
    .object({
      user: z
        .object({
          id: z.string().optional(),
          displayName: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  lastModifiedDateTime: z.string().optional(),
  size: z.number().optional(),
});

export const listVersionsOutputSchema = z.object({
  versions: z.array(VersionOutputSchema),
});

export function listVersionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_list_versions',
    description: 'List versions for a file.',
    inputSchema: listVersionsInputSchema,
    outputSchema: listVersionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listVersionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/driveitem-list-versions
        endpoint: `/v1.0/me/drive/items/${encodeURIComponent(input.itemId)}/versions`,
        retries: 3,
      });

      const parsed = VersionsResponseSchema.safeParse(response.data);

      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Microsoft Graph API',
          details: parsed.error.issues,
        });
      }

      return {
        versions: parsed.data.value.map(version => ({
          id: version.id,
          ...(version.lastModifiedBy !== undefined && {
            lastModifiedBy: {
              ...(version.lastModifiedBy.user !== undefined && {
                user: {
                  ...(version.lastModifiedBy.user.id !== undefined && {
                    id: version.lastModifiedBy.user.id,
                  }),
                  ...(version.lastModifiedBy.user.displayName !== undefined && {
                    displayName: version.lastModifiedBy.user.displayName,
                  }),
                },
              }),
            },
          }),
          ...(version.lastModifiedDateTime !== undefined && {
            lastModifiedDateTime: version.lastModifiedDateTime,
          }),
          ...(version.size !== undefined && { size: version.size }),
        })),
      };
    },
  });
}
