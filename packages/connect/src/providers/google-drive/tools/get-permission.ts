// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPermissionInputSchema = z.object({
  fileId: z.string().describe('The ID of the file. Example: "1xABCDEF123456"'),
  permissionId: z.string().describe('The ID of the permission. Example: "12345678901234567890"'),
});

export const getPermissionOutputSchema = z.object({
  id: z.string(),
  type: z.string().describe('The type of the grantee. Valid values are user, group, domain, or anyone.'),
  role: z
    .string()
    .describe(
      'The role granted by this permission. Valid values are owner, organizer, fileOrganizer, writer, commenter, or reader.',
    ),
  emailAddress: z.string().optional().describe('The email address of the user or group this permission refers to.'),
  domain: z.string().optional().describe('The domain to which this permission refers.'),
  allowFileDiscovery: z
    .boolean()
    .optional()
    .describe('Whether the permission allows the file to be discovered through search.'),
  displayName: z.string().optional().describe('A displayable name for users, groups or domains.'),
  photoLink: z.string().optional().describe('A link to the profile photo, if available.'),
  expirationTime: z.string().optional().describe('The time at which this permission will expire (RFC 3339 date-time).'),
  permissionDetails: z
    .array(z.object({}).passthrough())
    .optional()
    .describe('Details of the permission, including specific permissions and whether they inherited from a parent.'),
  deleted: z.boolean().optional().describe('Whether this permission has been deleted.'),
  pendingOwner: z
    .boolean()
    .optional()
    .describe('Whether the account associated with this permission has been deleted.'),
  view: z.string().optional().describe('Indicates the view for this permission.'),
  createdTime: z.string().optional().describe('The time at which this permission was created (RFC 3339 date-time).'),
});

export function getPermissionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_get_permission',
    description: 'Get a permission by ID',
    inputSchema: getPermissionInputSchema,
    outputSchema: getPermissionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPermissionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/get
      const response = await platformProxy.get({
        endpoint: `/drive/v3/files/${input.fileId}/permissions/${input.permissionId}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Permission not found',
          fileId: input.fileId,
          permissionId: input.permissionId,
        });
      }

      const permission = response.data;

      return {
        id: permission.id,
        type: permission.type,
        role: permission.role,
        emailAddress: permission.emailAddress ?? undefined,
        domain: permission.domain ?? undefined,
        allowFileDiscovery: permission.allowFileDiscovery ?? undefined,
        displayName: permission.displayName ?? undefined,
        photoLink: permission.photoLink ?? undefined,
        expirationTime: permission.expirationTime ?? undefined,
        permissionDetails: permission.permissionDetails ?? undefined,
        deleted: permission.deleted ?? undefined,
        pendingOwner: permission.pendingOwner ?? undefined,
        view: permission.view ?? undefined,
        createdTime: permission.createdTime ?? undefined,
      };
    },
  });
}
