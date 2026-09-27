// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getEarlyAccessFeatureInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.string().describe('Early access feature ID. Example: "019e8d60-fbc1-0000-d729-cb62a5d65a45"'),
});

const FeatureFlagSchema = z.object({
  id: z.number(),
  team_id: z.number(),
  name: z.string(),
  key: z.string(),
  filters: z.record(z.string(), z.unknown()),
  deleted: z.boolean(),
  active: z.boolean(),
  ensure_experience_continuity: z.boolean(),
  version: z.number(),
  evaluation_runtime: z.string(),
  bucketing_identifier: z.string(),
  evaluation_contexts: z.array(z.string()),
});

export const getEarlyAccessFeatureOutputSchema = z.object({
  id: z.string(),
  feature_flag: FeatureFlagSchema,
  name: z.string(),
  description: z.string().optional(),
  stage: z.string(),
  documentation_url: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string(),
});

export function getEarlyAccessFeatureTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_get_early_access_feature',
    description: 'Retrieve a single early access feature from PostHog.',
    inputSchema: getEarlyAccessFeatureInputSchema,
    outputSchema: getEarlyAccessFeatureOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getEarlyAccessFeatureOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://posthog.com/docs/api/early-access-feature
      const response = await platformProxy.get({
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/early_access_feature/${encodeURIComponent(input.id)}/`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Early access feature not found',
          project_id: input.project_id,
          id: input.id,
        });
      }

      const providerFeature = getEarlyAccessFeatureOutputSchema.parse(response.data);

      return {
        id: providerFeature.id,
        feature_flag: providerFeature.feature_flag,
        name: providerFeature.name,
        ...(providerFeature.description !== undefined && { description: providerFeature.description }),
        stage: providerFeature.stage,
        ...(providerFeature.documentation_url !== undefined && {
          documentation_url: providerFeature.documentation_url,
        }),
        ...(providerFeature.payload !== undefined && { payload: providerFeature.payload }),
        created_at: providerFeature.created_at,
      };
    },
  });
}
