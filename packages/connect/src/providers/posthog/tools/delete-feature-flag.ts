// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteFeatureFlagInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.number().describe('Feature flag ID. Example: 700472'),
});

const ProviderFeatureFlagSchema = z
  .object({
    id: z.number(),
    key: z.string().optional(),
    deleted: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .passthrough();

export const deleteFeatureFlagOutputSchema = z.object({
  id: z.number(),
  key: z.string().optional(),
  deleted: z.boolean().optional(),
});

export function deleteFeatureFlagTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_delete_feature_flag',
    description: 'Delete or archive a feature flag in PostHog',
    inputSchema: deleteFeatureFlagInputSchema,
    outputSchema: deleteFeatureFlagOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteFeatureFlagOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      // https://posthog.com/docs/api/feature-flags
      const response = await platformProxy.patch({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/feature_flags/${encodeURIComponent(String(input.id))}/`,
        data: {
          deleted: true,
        },
        retries: 3,
      });

      const providerFlag = ProviderFeatureFlagSchema.parse(response.data);

      return {
        id: providerFlag.id,
        ...(providerFlag.key !== undefined && { key: providerFlag.key }),
        ...(providerFlag.deleted !== undefined && { deleted: providerFlag.deleted }),
      };
    },
  });
}
