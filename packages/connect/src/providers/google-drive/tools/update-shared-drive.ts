// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateSharedDriveInputSchema = z.object({
  driveId: z.string().describe('The ID of the shared drive to update. Example: "0AN1234567890XYZ"'),
  name: z.string().optional().describe('The new name for the shared drive. Example: "Updated Shared Drive"'),
  colorRgb: z.string().optional().describe('The color of the shared drive as an RGB hex string. Example: "#0000FF"'),
  restrictions: z
    .object({
      adminManagedRestrictions: z.boolean().optional().describe('Whether the restrictions are managed by an admin'),
      copyRequiresWriterPermission: z
        .boolean()
        .optional()
        .describe('Whether the copy operation requires writer permission'),
      domainUsersOnly: z.boolean().optional().describe('Whether only domain users can access the shared drive'),
      driveMembersOnly: z.boolean().optional().describe('Whether only drive members can access the shared drive'),
    })
    .optional()
    .describe('Restrictions to apply to the shared drive'),
});

export const updateSharedDriveOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  colorRgb: z.string().optional(),
  kind: z.string(),
  createdTime: z.string().optional(),
  restrictions: z
    .object({
      adminManagedRestrictions: z.boolean().optional(),
      copyRequiresWriterPermission: z.boolean().optional(),
      domainUsersOnly: z.boolean().optional(),
      driveMembersOnly: z.boolean().optional(),
    })
    .optional(),
});

export function updateSharedDriveTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_update_shared_drive',
    description: "Update a shared drive's metadata",
    inputSchema: updateSharedDriveInputSchema,
    outputSchema: updateSharedDriveOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateSharedDriveOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: any = {};

      if (input.name !== undefined) {
        requestBody.name = input.name;
      }

      if (input.colorRgb !== undefined) {
        requestBody.colorRgb = input.colorRgb;
      }

      if (input.restrictions !== undefined) {
        requestBody.restrictions = {};
        if (input.restrictions.adminManagedRestrictions !== undefined) {
          requestBody.restrictions.adminManagedRestrictions = input.restrictions.adminManagedRestrictions;
        }
        if (input.restrictions.copyRequiresWriterPermission !== undefined) {
          requestBody.restrictions.copyRequiresWriterPermission = input.restrictions.copyRequiresWriterPermission;
        }
        if (input.restrictions.domainUsersOnly !== undefined) {
          requestBody.restrictions.domainUsersOnly = input.restrictions.domainUsersOnly;
        }
        if (input.restrictions.driveMembersOnly !== undefined) {
          requestBody.restrictions.driveMembersOnly = input.restrictions.driveMembersOnly;
        }
      }

      // https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/update
      const response = await platformProxy.patch({
        endpoint: `/drive/v3/drives/${input.driveId}`,
        params: {
          useDomainAdminAccess: 'false',
        },
        data: requestBody,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Shared drive not found or could not be updated',
          driveId: input.driveId,
        });
      }

      const drive = response.data;

      return {
        id: drive.id,
        name: drive.name ?? undefined,
        colorRgb: drive.colorRgb ?? undefined,
        kind: drive.kind ?? 'drive#drive',
        createdTime: drive.createdTime ?? undefined,
        restrictions: drive.restrictions
          ? {
              adminManagedRestrictions: drive.restrictions.adminManagedRestrictions,
              copyRequiresWriterPermission: drive.restrictions.copyRequiresWriterPermission,
              domainUsersOnly: drive.restrictions.domainUsersOnly,
              driveMembersOnly: drive.restrictions.driveMembersOnly,
            }
          : undefined,
      };
    },
  });
}
