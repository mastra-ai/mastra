// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const moveFileInputSchema = z.object({
  fileId: z.string().describe('The ID of the file to move. Example: "1mD3ukEAmRqo8u0RF_Cr6IJl9f_uWTYH03vesDhB5Svw"'),
  fromFolderId: z
    .string()
    .describe('The ID of the current parent folder. Example: "1SpnQKJHqNDh-qhbj_zGD2aIm-G-RKC_k"'),
  toFolderId: z.string().describe('The ID of the destination folder. Example: "1Bl1rB7hkBbdzmKUka3zSj0bhAK3pGypD"'),
});

export const moveFileOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  mimeType: z.string().optional(),
  parents: z.array(z.string()),
});

export function moveFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_move_file',
    description: 'Move a file to a different folder',
    inputSchema: moveFileInputSchema,
    outputSchema: moveFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof moveFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update
      const response = await platformProxy.patch({
        endpoint: `/drive/v3/files/${input.fileId}`,
        params: {
          addParents: input.toFolderId,
          removeParents: input.fromFolderId,
          fields: 'id,name,mimeType,parents',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'File not found or could not be moved',
          fileId: input.fileId,
        });
      }

      return {
        id: response.data.id,
        name: response.data.name ?? undefined,
        mimeType: response.data.mimeType ?? undefined,
        parents: response.data.parents || [],
      };
    },
  });
}
