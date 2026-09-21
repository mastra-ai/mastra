// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteActionInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.number().describe('Action ID to delete. Example: 275761'),
});

export const deleteActionOutputSchema = z.object({
  success: z.boolean(),
  id: z.number(),
});

export function deleteActionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_delete_action',
    description: 'Delete an action in PostHog.',
    inputSchema: deleteActionInputSchema,
    outputSchema: deleteActionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteActionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      // https://posthog.com/docs/api/actions
      // PostHog does not allow hard deletes; PATCH with deleted:true is required.
      await platformProxy.patch({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/actions/${encodeURIComponent(String(input.id))}/`,
        data: {
          deleted: true,
        },
        retries: 3,
      });

      return {
        success: true,
        id: input.id,
      };
    },
  });
}
