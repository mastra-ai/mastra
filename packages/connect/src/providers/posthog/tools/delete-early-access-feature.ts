// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteEarlyAccessFeatureInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.string().describe('Early access feature ID. Example: "497f6eca-6276-4993-bfeb-53cbbbba6f08"'),
});

export const deleteEarlyAccessFeatureOutputSchema = z.object({
  success: z.boolean(),
  id: z.string(),
});

export function deleteEarlyAccessFeatureTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_delete_early_access_feature',
    description: 'Delete an early access feature in PostHog.',
    inputSchema: deleteEarlyAccessFeatureInputSchema,
    outputSchema: deleteEarlyAccessFeatureOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteEarlyAccessFeatureOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      // https://posthog.com/docs/api/early-access-feature
      await platformProxy.delete({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/early_access_feature/${encodeURIComponent(input.id)}/`,
        retries: 3,
      });

      return {
        success: true,
        id: input.id,
      };
    },
  });
}
