// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPermissionInputSchema = z.object({
  itemId: z
    .string()
    .describe('The ID of the drive item. Example: "01A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6"'),
  permissionId: z.string().describe('The ID of the permission. Example: "1"'),
});

const IdentitySetSchema = z.object({
  user: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  application: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional(),
});

const ProviderPermissionSchema = z.object({
  id: z.string(),
  roles: z.array(z.string()).optional(),
  grantedTo: IdentitySetSchema.optional(),
  grantedToIdentities: z.array(IdentitySetSchema).optional(),
  invitation: z
    .object({
      email: z.string().optional(),
      redeemedBy: z.string().optional(),
    })
    .optional(),
  inheritedFrom: z
    .object({
      driveId: z.string().optional(),
      id: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  link: z
    .object({
      type: z.string().optional(),
      scope: z.string().optional(),
      webUrl: z.string().optional(),
      application: z
        .object({
          id: z.string().optional(),
          displayName: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  expirationDateTime: z.string().optional(),
  hasPassword: z.boolean().optional(),
  shareId: z.string().optional(),
});

export const getPermissionOutputSchema = z.object({
  id: z.string(),
  roles: z.array(z.string()).optional(),
  grantedTo: IdentitySetSchema.optional(),
  grantedToIdentities: z.array(IdentitySetSchema).optional(),
  invitation: z
    .object({
      email: z.string().optional(),
      redeemedBy: z.string().optional(),
    })
    .optional(),
  inheritedFrom: z
    .object({
      driveId: z.string().optional(),
      id: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  link: z
    .object({
      type: z.string().optional(),
      scope: z.string().optional(),
      webUrl: z.string().optional(),
      application: z
        .object({
          id: z.string().optional(),
          displayName: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  expirationDateTime: z.string().optional(),
  hasPassword: z.boolean().optional(),
  shareId: z.string().optional(),
});

export function getPermissionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_get_permission',
    description: 'Retrieve a sharing permission on an item',
    inputSchema: getPermissionInputSchema,
    outputSchema: getPermissionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPermissionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/permission-get
      const response = await platformProxy.get({
        endpoint: `/v1.0/me/drive/items/${encodeURIComponent(input.itemId)}/permissions/${encodeURIComponent(input.permissionId)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Permission not found',
          itemId: input.itemId,
          permissionId: input.permissionId,
        });
      }

      const permission = ProviderPermissionSchema.parse(response.data);

      return {
        id: permission.id,
        ...(permission.roles !== undefined && { roles: permission.roles }),
        ...(permission.grantedTo !== undefined && { grantedTo: permission.grantedTo }),
        ...(permission.grantedToIdentities !== undefined && { grantedToIdentities: permission.grantedToIdentities }),
        ...(permission.invitation !== undefined && { invitation: permission.invitation }),
        ...(permission.inheritedFrom !== undefined && { inheritedFrom: permission.inheritedFrom }),
        ...(permission.link !== undefined && { link: permission.link }),
        ...(permission.expirationDateTime !== undefined && { expirationDateTime: permission.expirationDateTime }),
        ...(permission.hasPassword !== undefined && { hasPassword: permission.hasPassword }),
        ...(permission.shareId !== undefined && { shareId: permission.shareId }),
      };
    },
  });
}
