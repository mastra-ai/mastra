// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPermissionsInputSchema = z.object({
  itemId: z.string().describe('The ID of the drive item. Example: "5D33DD65C6932946!70859"'),
});

const IdentitySetSchema = z.object({
  user: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional(),
  application: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional(),
  device: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional(),
});

const SharingLinkSchema = z.object({
  webUrl: z.string().optional(),
  type: z.string().optional(),
  application: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional(),
});

const ItemReferenceSchema = z.object({
  driveId: z.string().optional(),
  id: z.string().optional(),
  path: z.string().optional(),
});

const PermissionSchema = z.object({
  id: z.string(),
  roles: z.array(z.string()),
  link: SharingLinkSchema.optional(),
  grantedTo: IdentitySetSchema.optional(),
  grantedToV2: IdentitySetSchema.optional(),
  inheritedFrom: ItemReferenceSchema.optional(),
});

export const listPermissionsOutputSchema = z.object({
  permissions: z.array(PermissionSchema),
});

export function listPermissionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_list_permissions',
    description: 'List sharing permissions on an item',
    inputSchema: listPermissionsInputSchema,
    outputSchema: listPermissionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPermissionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/driveitem-list-permissions
        endpoint: `/v1.0/me/drive/items/${encodeURIComponent(input.itemId)}/permissions`,
        retries: 3,
      });

      if (!response.data || !response.data.value) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'No permissions found for the specified item',
          itemId: input.itemId,
        });
      }

      const permissions = z.array(PermissionSchema).parse(response.data.value);

      return {
        permissions: permissions,
      };
    },
  });
}
