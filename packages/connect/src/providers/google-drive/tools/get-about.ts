// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getAboutInputSchema = z.object({});

export const getAboutOutputSchema = z.object({
  kind: z.string(),
  user: z
    .object({
      kind: z.string(),
      displayName: z.string().optional(),
      photoLink: z.string().optional(),
      me: z.boolean().optional(),
      permissionId: z.string().optional(),
      emailAddress: z.string().optional(),
    })
    .passthrough(),
  storageQuota: z
    .object({
      limit: z.string().optional(),
      usage: z.string().optional(),
      usageInDrive: z.string().optional(),
      usageInDriveTrash: z.string().optional(),
    })
    .passthrough()
    .optional(),
  importFormats: z.record(z.string(), z.array(z.string())).optional(),
  exportFormats: z.record(z.string(), z.array(z.string())).optional(),
  maxImportSizes: z.record(z.string(), z.string()).optional(),
  maxUploadSize: z.string().optional(),
  appInstalled: z.boolean().optional(),
  folderColorPalette: z.array(z.string()).optional(),
  teamDriveThemes: z
    .array(
      z.object({
        id: z.string(),
        backgroundImageLink: z.string(),
        colorRgb: z.string(),
      }),
    )
    .optional(),
  driveThemes: z
    .array(
      z.object({
        id: z.string(),
        backgroundImageLink: z.string(),
        colorRgb: z.string(),
      }),
    )
    .optional(),
  canCreateTeamDrives: z.boolean().optional(),
  canCreateDrives: z.boolean().optional(),
});

export function getAboutTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_get_about',
    description: "Get the user's drive info and storage quota",
    inputSchema: getAboutInputSchema,
    outputSchema: getAboutOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getAboutOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get
      const response = await platformProxy.get({
        endpoint: '/drive/v3/about',
        params: {
          fields: '*',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Drive info not found',
        });
      }

      return response.data;
    },
  });
}
