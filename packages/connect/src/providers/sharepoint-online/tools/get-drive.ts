// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getDriveInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "nangodevelopers.sharepoint.com,1d6e..."'),
  driveId: z.string().describe('SharePoint drive ID. Example: "b!IhduHTCTMEuqkrc..."'),
});

const ProviderDriveSchema = z.object({
  id: z.string(),
  name: z.string(),
  driveType: z.string(),
  webUrl: z.string(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  description: z.string().optional(),
  owner: z
    .object({
      group: z
        .object({
          id: z.string().optional(),
          displayName: z.string().optional(),
        })
        .optional(),
      user: z
        .object({
          id: z.string().optional(),
          displayName: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  quota: z
    .object({
      deleted: z.number().optional(),
      remaining: z.number().optional(),
      state: z.string().optional(),
      total: z.number().optional(),
      used: z.number().optional(),
    })
    .optional(),
});

export const getDriveOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  driveType: z.string(),
  webUrl: z.string(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  description: z.string().optional(),
  ownerGroupId: z.string().optional(),
  ownerGroupName: z.string().optional(),
  ownerUserId: z.string().optional(),
  ownerUserName: z.string().optional(),
  quotaDeleted: z.number().optional(),
  quotaRemaining: z.number().optional(),
  quotaState: z.string().optional(),
  quotaTotal: z.number().optional(),
  quotaUsed: z.number().optional(),
});

export function getDriveTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_get_drive',
    description: 'Retrieve a site drive by ID.',
    inputSchema: getDriveInputSchema,
    outputSchema: getDriveOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getDriveOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/drive-get
      const response = await platformProxy.get({
        endpoint: `v1.0/sites/${encodeURIComponent(input.siteId)}/drives/${encodeURIComponent(input.driveId)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Drive not found',
          siteId: input.siteId,
          driveId: input.driveId,
        });
      }

      const drive = ProviderDriveSchema.parse(response.data);

      return {
        id: drive.id,
        name: drive.name,
        driveType: drive.driveType,
        webUrl: drive.webUrl,
        ...(drive.createdDateTime !== undefined && { createdDateTime: drive.createdDateTime }),
        ...(drive.lastModifiedDateTime !== undefined && { lastModifiedDateTime: drive.lastModifiedDateTime }),
        ...(drive.description !== undefined && { description: drive.description }),
        ...(drive.owner?.group?.id !== undefined && { ownerGroupId: drive.owner.group.id }),
        ...(drive.owner?.group?.displayName !== undefined && { ownerGroupName: drive.owner.group.displayName }),
        ...(drive.owner?.user?.id !== undefined && { ownerUserId: drive.owner.user.id }),
        ...(drive.owner?.user?.displayName !== undefined && { ownerUserName: drive.owner.user.displayName }),
        ...(drive.quota?.deleted !== undefined && { quotaDeleted: drive.quota.deleted }),
        ...(drive.quota?.remaining !== undefined && { quotaRemaining: drive.quota.remaining }),
        ...(drive.quota?.state !== undefined && { quotaState: drive.quota.state }),
        ...(drive.quota?.total !== undefined && { quotaTotal: drive.quota.total }),
        ...(drive.quota?.used !== undefined && { quotaUsed: drive.quota.used }),
      };
    },
  });
}
