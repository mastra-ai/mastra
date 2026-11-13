// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const copyPresentationInputSchema = z.object({
  driveId: z.string().describe('The ID of the drive containing the presentation to copy. Example: "b!..."'),
  itemId: z.string().describe('The ID of the presentation to copy. Example: "01RFYLAY..."'),
  name: z.string().optional().describe('Optional new name for the copy. Example: "copy.pptx"'),
  destinationDriveId: z
    .string()
    .optional()
    .describe(
      'Optional ID of the destination drive. Defaults to the source drive if omitted. Requires destinationFolderId to also be set.',
    ),
  destinationFolderId: z
    .string()
    .optional()
    .describe('Optional ID of the destination folder. Defaults to the source folder if omitted.'),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
});

export const copyPresentationOutputSchema = z.object({
  id: z
    .string()
    .optional()
    .describe('The ID of the copied presentation. Only present when the API returns it synchronously.'),
  name: z
    .string()
    .optional()
    .describe('The name of the copied presentation. Only present when the API returns it synchronously.'),
  webUrl: z
    .string()
    .optional()
    .describe('The web URL of the copied presentation. Only present when the API returns it synchronously.'),
  status: z
    .string()
    .describe('The copy status: "completed" for synchronous copies, "pending" for asynchronous copies.'),
  monitorUrl: z
    .string()
    .optional()
    .describe('URL to poll for asynchronous copy progress. Only present when status is "pending".'),
});

export function copyPresentationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_powerpoint_copy_presentation',
    description: 'Copy a presentation to a (possibly different) folder, optionally renaming it.',
    inputSchema: copyPresentationInputSchema,
    outputSchema: copyPresentationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof copyPresentationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (input.destinationDriveId !== undefined && input.destinationFolderId === undefined) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'destinationFolderId is required when destinationDriveId is provided.',
        });
      }

      const body: Record<string, unknown> = {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.destinationFolderId !== undefined && {
          parentReference: {
            driveId: input.destinationDriveId ?? input.driveId,
            id: input.destinationFolderId,
          },
        }),
      };

      // https://learn.microsoft.com/en-us/graph/api/driveitem-copy
      const response = await platformProxy.post({
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/copy`,
        data: body,
        retries: 3,
      });

      if (response.status === 202) {
        const location = response.headers['location'];
        const monitorUrl = typeof location === 'string' ? location : undefined;

        return {
          status: 'pending',
          ...(monitorUrl !== undefined && { monitorUrl }),
        };
      }

      if (response.status !== 200) {
        throw new platformProxy.ActionError({
          type: 'copy_failed',
          message: `Copy request failed with status ${response.status}`,
        });
      }

      const rawData: unknown = response.data;

      if (typeof rawData === 'object' && rawData !== null) {
        const providerItem = ProviderDriveItemSchema.safeParse(rawData);

        if (providerItem.success) {
          return {
            id: providerItem.data.id,
            name: providerItem.data.name,
            ...(providerItem.data.webUrl !== undefined && { webUrl: providerItem.data.webUrl }),
            status: 'completed',
          };
        }
      }

      return {
        status: 'completed',
      };
    },
  });
}
