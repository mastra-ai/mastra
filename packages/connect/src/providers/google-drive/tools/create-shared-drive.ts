// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createSharedDriveInputSchema = z.object({
  name: z.string().describe('The name of the shared drive. Example: "Project Resources"'),
  requestId: z
    .string()
    .describe(
      'A unique ID (such as a random UUID) that uniquely identifies this request for idempotent creation. A repeated request with the same request ID will not create duplicates.',
    ),
});

export const createSharedDriveOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string().optional(),
  colorRgb: z.string().optional(),
  backgroundImageLink: z.string().optional(),
  capabilities: z.any().optional(),
  themeId: z.string().optional(),
  createdTime: z.string().optional(),
  hidden: z.boolean().optional(),
  restrictions: z.any().optional(),
  orgUnitId: z.string().optional(),
});

export function createSharedDriveTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_create_shared_drive',
    description: 'Create a shared drive',
    inputSchema: createSharedDriveInputSchema,
    outputSchema: createSharedDriveOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSharedDriveOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/create
      const response = await platformProxy.post({
        endpoint: '/drive/v3/drives',
        params: {
          requestId: input.requestId,
        },
        data: {
          name: input.name,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'creation_failed',
          message: 'Failed to create shared drive',
        });
      }

      const drive = response.data;

      return {
        id: drive.id,
        name: drive.name,
        kind: drive.kind ?? undefined,
        colorRgb: drive.colorRgb ?? undefined,
        backgroundImageLink: drive.backgroundImageLink ?? undefined,
        capabilities: drive.capabilities ?? undefined,
        themeId: drive.themeId ?? undefined,
        createdTime: drive.createdTime ?? undefined,
        hidden: drive.hidden ?? undefined,
        restrictions: drive.restrictions ?? undefined,
        orgUnitId: drive.orgUnitId ?? undefined,
      };
    },
  });
}
