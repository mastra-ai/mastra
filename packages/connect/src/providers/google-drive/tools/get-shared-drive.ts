// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getSharedDriveInputSchema = z.object({
  id: z.string().describe('The ID of the shared drive to retrieve. Example: "0ACo-2dj5Ql07Uk9PVA"'),
});

export const getSharedDriveOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  kind: z.string().optional(),
  themeId: z.string().optional(),
  colorRgb: z.string().optional(),
  backgroundImageFile: z.object({}).passthrough().optional(),
  capabilities: z.object({}).passthrough().optional(),
  restrictions: z.object({}).passthrough().optional(),
  hidden: z.boolean().optional(),
  createdTime: z.string().optional(),
  orgUnitId: z.string().optional(),
});

export function getSharedDriveTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_get_shared_drive',
    description: 'Get a shared drive by ID',
    inputSchema: getSharedDriveInputSchema,
    outputSchema: getSharedDriveOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSharedDriveOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/get
      const response = await platformProxy.get({
        endpoint: `/drive/v3/drives/${input.id}`,
        params: {
          useDomainAdminAccess: 'false',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Shared drive not found',
          id: input.id,
        });
      }

      const drive = response.data;

      return {
        id: drive.id,
        name: drive.name ?? undefined,
        kind: drive.kind ?? undefined,
        themeId: drive.themeId ?? undefined,
        colorRgb: drive.colorRgb ?? undefined,
        backgroundImageFile: drive.backgroundImageFile ?? undefined,
        capabilities: drive.capabilities ?? undefined,
        restrictions: drive.restrictions ?? undefined,
        hidden: drive.hidden ?? undefined,
        createdTime: drive.createdTime ?? undefined,
        orgUnitId: drive.orgUnitId ?? undefined,
      };
    },
  });
}
