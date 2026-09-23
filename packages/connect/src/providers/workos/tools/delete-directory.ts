// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteDirectoryInputSchema = z.object({ directory_id: z.string() });

export const deleteDirectoryOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function deleteDirectoryTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_delete_directory',
    description: 'Delete a WorkOS directory.',
    inputSchema: deleteDirectoryInputSchema,
    outputSchema: deleteDirectoryOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteDirectoryOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://workos.com/docs/reference/directory-sync/directory
        endpoint: `/directories/${encodeURIComponent(input.directory_id)}`,
        retries: 3,
      });
      return { id: input.directory_id, success: true };
    },
  });
}
