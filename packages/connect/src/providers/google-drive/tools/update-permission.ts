// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updatePermissionInputSchema = z.object({
  fileId: z.string().describe('The ID of the file or shared drive.'),
  permissionId: z.string().describe('The ID of the permission.'),
  role: z
    .enum(['owner', 'organizer', 'fileOrganizer', 'writer', 'commenter', 'reader'])
    .describe('The new role for the permission.'),
});

export const updatePermissionOutputSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  role: z.string(),
  emailAddress: z.string().optional(),
  domain: z.string().optional(),
  displayName: z.string().optional(),
  allowFileDiscovery: z.boolean().optional(),
  kind: z.string().optional(),
});

export function updatePermissionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_update_permission',
    description: 'Update a permission on a file',
    inputSchema: updatePermissionInputSchema,
    outputSchema: updatePermissionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updatePermissionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/update
      const response = await platformProxy.patch({
        endpoint: `/drive/v3/files/${input.fileId}/permissions/${input.permissionId}`,
        data: {
          role: input.role,
        },
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

      return {
        id: response.data.id,
        type: response.data.type ?? undefined,
        role: response.data.role,
        emailAddress: response.data.emailAddress ?? undefined,
        domain: response.data.domain ?? undefined,
        displayName: response.data.displayName ?? undefined,
        allowFileDiscovery: response.data.allowFileDiscovery ?? undefined,
        kind: response.data.kind ?? undefined,
      };
    },
  });
}
