// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listDriveItemPermissionsInputSchema = z.object({
  site_id: z
    .string()
    .describe(
      'SharePoint site ID. Example: "contoso.sharepoint.com,12345678-1234-1234-1234-123456789012,abcdef12-3456-7890-abcd-ef1234567890"',
    ),
  drive_id: z.string().describe('Drive ID. Example: "b!abcdef1234567890abcdef1234567890abcdef12"'),
  item_id: z.string().describe('Drive item ID. Example: "1234567890ABC!123"'),
});

const IdentitySchema = z.object({
  id: z.string().optional(),
  displayName: z.string().optional(),
});

const IdentitySetSchema = z.object({
  user: IdentitySchema.optional(),
  application: IdentitySchema.optional(),
  device: IdentitySchema.optional(),
  group: IdentitySchema.optional(),
});

const SharePointIdentitySchema = z.object({
  id: z.string().optional(),
  displayName: z.string().optional(),
  loginName: z.string().optional(),
});

const SharePointIdentitySetSchema = z.object({
  user: IdentitySchema.optional(),
  application: IdentitySchema.optional(),
  device: IdentitySchema.optional(),
  group: IdentitySchema.optional(),
  siteUser: SharePointIdentitySchema.optional(),
  siteGroup: SharePointIdentitySchema.optional(),
});

const ItemReferenceSchema = z.object({
  driveId: z.string().optional(),
  id: z.string().optional(),
  path: z.string().optional(),
  shareId: z.string().optional(),
});

const SharingInvitationSchema = z.object({
  email: z.string().optional(),
  signInRequired: z.boolean().optional(),
});

const SharingLinkSchema = z.object({
  webUrl: z.string().optional(),
  type: z.string().optional(),
  scope: z.string().optional(),
  application: IdentitySchema.optional(),
});

const PermissionSchema = z
  .object({
    id: z.string(),
    roles: z.array(z.string()).optional(),
    grantedTo: IdentitySetSchema.optional(),
    grantedToIdentities: z.array(IdentitySetSchema).optional(),
    grantedToV2: SharePointIdentitySetSchema.optional(),
    grantedToIdentitiesV2: z.array(SharePointIdentitySetSchema).optional(),
    inheritedFrom: ItemReferenceSchema.optional(),
    invitation: SharingInvitationSchema.optional(),
    link: SharingLinkSchema.optional(),
    shareId: z.string().optional(),
    expirationDateTime: z.string().optional(),
    hasPassword: z.boolean().optional(),
  })
  .passthrough();

export const listDriveItemPermissionsOutputSchema = z.object({
  permissions: z.array(PermissionSchema),
});

export function listDriveItemPermissionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_list_drive_item_permissions',
    description: 'List all permissions on a drive item.',
    inputSchema: listDriveItemPermissionsInputSchema,
    outputSchema: listDriveItemPermissionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDriveItemPermissionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/driveitem-list-permissions
        endpoint: `/v1.0/sites/${encodeURIComponent(input.site_id)}/drives/${encodeURIComponent(input.drive_id)}/items/${encodeURIComponent(input.item_id)}/permissions`,
        retries: 3,
      });

      const providerResponse = z
        .object({
          value: z.array(z.unknown()),
        })
        .safeParse(response.data);

      if (!providerResponse.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response format from Microsoft Graph API',
        });
      }

      const permissions = providerResponse.data.value.map((item: unknown) => {
        const parsed = PermissionSchema.safeParse(item);
        if (!parsed.success) {
          throw new platformProxy.ActionError({
            type: 'invalid_response',
            message: 'Failed to parse a permission object from the Microsoft Graph API response',
          });
        }
        return parsed.data;
      });

      return {
        permissions,
      };
    },
  });
}
