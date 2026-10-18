// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteReleaseInputSchema = z.object({
  owner: z.string().describe('Repository owner. Example: "viictoo"'),
  repo: z.string().describe('Repository name. Example: "api-playground2"'),
  release_id: z.number().describe('Release ID to delete. Example: 12345678'),
});

export const deleteReleaseOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export function deleteReleaseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_delete_release',
    description: 'Delete a release by release ID.',
    inputSchema: deleteReleaseInputSchema,
    outputSchema: deleteReleaseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteReleaseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/releases/releases#delete-a-release
      await platformProxy.delete({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/releases/${input.release_id}`,
        retries: 10,
      });

      return {
        success: true,
        message: `Release ${input.release_id} deleted successfully`,
      };
    },
  });
}
