// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateEarlyAccessFeatureInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.string().describe('Early access feature ID. Example: "497f6eca-6276-4993-bfeb-53cbbbba6f08"'),
  name: z.string().optional().describe('Name of the early access feature.'),
  description: z.string().optional().describe('Description of the early access feature.'),
  stage: z
    .enum(['draft', 'concept', 'alpha', 'beta', 'general-availability'])
    .optional()
    .describe('Stage of the early access feature.'),
  documentation_url: z.string().optional().describe('URL to documentation for the early access feature.'),
});

const FeatureFlagSchema = z.object({
  id: z.number(),
  team_id: z.number(),
  name: z.string().nullable().optional(),
  key: z.string().nullable().optional(),
  filters: z.unknown().optional(),
  deleted: z.boolean().optional(),
  active: z.boolean().optional(),
  ensure_experience_continuity: z.boolean().optional(),
  version: z.number().optional(),
  evaluation_runtime: z.string().nullable().optional(),
  bucketing_identifier: z.string().nullable().optional(),
  evaluation_contexts: z.array(z.string()).optional(),
});

const ProviderResponseSchema = z.object({
  id: z.string(),
  feature_flag: FeatureFlagSchema.optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
  documentation_url: z.string().nullable().optional(),
  payload: z.unknown().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export const updateEarlyAccessFeatureOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  stage: z.string().optional(),
  documentation_url: z.string().optional(),
  payload: z.unknown().optional(),
  created_at: z.string().optional(),
  feature_flag_id: z.number().optional(),
});

export function updateEarlyAccessFeatureTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_update_early_access_feature',
    description: 'Update an early access feature in PostHog.',
    inputSchema: updateEarlyAccessFeatureInputSchema,
    outputSchema: updateEarlyAccessFeatureOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateEarlyAccessFeatureOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const data: { name?: string; description?: string; stage?: string; documentation_url?: string } = {};
      if (input.name !== undefined) {
        data.name = input.name;
      }
      if (input.description !== undefined) {
        data.description = input.description;
      }
      if (input.stage !== undefined) {
        data.stage = input.stage;
      }
      if (input.documentation_url !== undefined) {
        data.documentation_url = input.documentation_url;
      }

      // https://posthog.com/docs/api/early-access-feature
      const response = await platformProxy.patch({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/early_access_feature/${encodeURIComponent(input.id)}/`,
        data,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        id: providerResponse.id,
        ...(providerResponse.name != null && { name: providerResponse.name }),
        ...(providerResponse.description != null && { description: providerResponse.description }),
        ...(providerResponse.stage != null && { stage: providerResponse.stage }),
        ...(providerResponse.documentation_url != null && { documentation_url: providerResponse.documentation_url }),
        ...(providerResponse.payload != null && { payload: providerResponse.payload }),
        ...(providerResponse.created_at != null && { created_at: providerResponse.created_at }),
        ...(providerResponse.feature_flag != null && { feature_flag_id: providerResponse.feature_flag.id }),
      };
    },
  });
}
