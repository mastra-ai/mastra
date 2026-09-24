// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteLabelInputSchema = z.object({
  owner: z.string().describe('Repository owner. Example: "viictoo"'),
  repo: z.string().describe('Repository name. Example: "api-playground2"'),
  name: z.string().describe('Label name to delete. Example: "bug"'),
});

export const deleteLabelOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export function deleteLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_delete_label',
    description: 'Delete a repository label by name',
    inputSchema: deleteLabelInputSchema,
    outputSchema: deleteLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/issues/labels#delete-a-label
      await platformProxy.delete({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/labels/${encodeURIComponent(input.name)}`,
        retries: 3,
      });

      return {
        success: true,
        message: `Label "${input.name}" deleted successfully`,
      };
    },
  });
}
