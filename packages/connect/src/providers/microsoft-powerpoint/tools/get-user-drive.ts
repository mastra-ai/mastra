// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUserDriveInputSchema = z.object({
  userId: z.string().describe('User ID or user principal name. Example: "test_api@nango.dev"'),
});

const ProviderDriveSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  driveType: z.string().optional(),
  webUrl: z.string().optional(),
  owner: z
    .object({
      user: z
        .object({
          displayName: z.string().optional(),
          id: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  quota: z
    .object({
      total: z.number().optional(),
      used: z.number().optional(),
      remaining: z.number().optional(),
    })
    .optional(),
});

export const getUserDriveOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  driveType: z.string().optional(),
  webUrl: z.string().optional(),
  ownerName: z.string().optional(),
  ownerId: z.string().optional(),
  quotaTotal: z.number().optional(),
  quotaUsed: z.number().optional(),
  quotaRemaining: z.number().optional(),
});

export function getUserDriveTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_powerpoint_get_user_drive',
    description: "Get a user's personal OneDrive (drive).",
    inputSchema: getUserDriveInputSchema,
    outputSchema: getUserDriveOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserDriveOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/drive-get
        // Docs list Application as unsupported for this route, but it works with app-only auth given Files.Read.All (verified against a live CC connection).
        endpoint: `/v1.0/users/${encodeURIComponent(input.userId)}/drive`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Drive not found for user',
          userId: input.userId,
        });
      }

      const drive = ProviderDriveSchema.parse(response.data);

      return {
        id: drive.id,
        ...(drive.name != null && { name: drive.name }),
        ...(drive.driveType != null && { driveType: drive.driveType }),
        ...(drive.webUrl != null && { webUrl: drive.webUrl }),
        ...(drive.owner?.user?.displayName != null && { ownerName: drive.owner.user.displayName }),
        ...(drive.owner?.user?.id != null && { ownerId: drive.owner.user.id }),
        ...(drive.quota?.total != null && { quotaTotal: drive.quota.total }),
        ...(drive.quota?.used != null && { quotaUsed: drive.quota.used }),
        ...(drive.quota?.remaining != null && { quotaRemaining: drive.quota.remaining }),
      };
    },
  });
}
