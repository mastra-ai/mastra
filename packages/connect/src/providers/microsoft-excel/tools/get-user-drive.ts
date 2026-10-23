// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUserDriveInputSchema = z.object({
  userId: z.string().optional().describe('User ID or user principal name. Example: "api@nango.dev"'),
});

const ProviderDriveSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  driveType: z.string().optional(),
  webUrl: z.string().optional(),
});

export const getUserDriveOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  driveType: z.string().optional(),
  webUrl: z.string().optional(),
});

export function getUserDriveTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_get_user_drive',
    description: "Get the connected user's OneDrive, or another user's drive when userId is provided.",
    inputSchema: getUserDriveInputSchema,
    outputSchema: getUserDriveOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserDriveOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/resources/drive
        endpoint: input.userId ? `/v1.0/users/${encodeURIComponent(input.userId)}/drive` : '/v1.0/me/drive',
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Drive not found for the given user',
          userId: input.userId,
        });
      }

      const providerDrive = ProviderDriveSchema.parse(response.data);

      return {
        id: providerDrive.id,
        ...(providerDrive.name !== undefined && { name: providerDrive.name }),
        ...(providerDrive.driveType !== undefined && { driveType: providerDrive.driveType }),
        ...(providerDrive.webUrl !== undefined && { webUrl: providerDrive.webUrl }),
      };
    },
  });
}
