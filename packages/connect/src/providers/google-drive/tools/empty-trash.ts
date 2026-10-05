// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const emptyTrashInputSchema = z.object({});

export const emptyTrashOutputSchema = z.object({
  success: z.boolean(),
});

export function emptyTrashTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_empty_trash',
    description: 'Permanently delete all trashed files',
    inputSchema: emptyTrashInputSchema,
    outputSchema: emptyTrashOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof emptyTrashOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/files/emptyTrash
      await platformProxy.delete({
        endpoint: '/drive/v3/files/trash',
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
