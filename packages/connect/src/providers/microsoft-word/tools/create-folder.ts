// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createFolderInputSchema = z.object({
  driveId: z
    .string()
    .describe(
      'The ID of the drive where the folder will be created. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"',
    ),
  name: z.string().describe('The name of the new folder. Example: "My Documents"'),
  parentId: z
    .string()
    .optional()
    .describe(
      'The ID of the parent folder. If omitted, the folder is created at the root of the drive. Example: "01RFYLAYGCHWM67HNJIZBJNCQTFNXT6YGT"',
    ),
  conflictBehavior: z
    .enum(['rename', 'replace', 'fail'])
    .optional()
    .describe('Behavior if a folder with the same name already exists. Defaults to "rename".'),
});

const ParentReferenceSchema = z.object({
  driveId: z.string().optional(),
  id: z.string().optional(),
  path: z.string().optional(),
});

const FolderSchema = z.object({
  childCount: z.number().optional(),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string().nullable().optional(),
  createdDateTime: z.string().nullable().optional(),
  lastModifiedDateTime: z.string().nullable().optional(),
  size: z.number().nullable().optional(),
  parentReference: ParentReferenceSchema.nullable().optional(),
  folder: FolderSchema.nullable().optional(),
});

export const createFolderOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  size: z.number().optional(),
  parentReference: ParentReferenceSchema.optional(),
  folder: FolderSchema.optional(),
});

export function createFolderTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_word_create_folder',
    description: 'Create a folder in a drive to organize Word documents.',
    inputSchema: createFolderInputSchema,
    outputSchema: createFolderOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createFolderOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const parentId = input.parentId ?? 'root';
      const endpoint =
        parentId === 'root'
          ? `/v1.0/drives/${encodeURIComponent(input.driveId)}/root/children`
          : `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(parentId)}/children`;

      const conflictBehavior = input.conflictBehavior ?? 'rename';

      const config: PlatformProxyRequest = {
        // https://learn.microsoft.com/en-us/graph/api/driveitem-post-children
        endpoint,
        data: {
          name: input.name,
          folder: {},
          '@microsoft.graph.conflictBehavior': conflictBehavior,
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);

      const providerItem = ProviderDriveItemSchema.parse(response.data);

      return {
        id: providerItem.id,
        name: providerItem.name,
        ...(providerItem.webUrl != null && { webUrl: providerItem.webUrl }),
        ...(providerItem.createdDateTime != null && { createdDateTime: providerItem.createdDateTime }),
        ...(providerItem.lastModifiedDateTime != null && { lastModifiedDateTime: providerItem.lastModifiedDateTime }),
        ...(providerItem.size != null && { size: providerItem.size }),
        ...(providerItem.parentReference != null && { parentReference: providerItem.parentReference }),
        ...(providerItem.folder != null && { folder: providerItem.folder }),
      };
    },
  });
}
