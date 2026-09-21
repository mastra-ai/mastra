// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createEarlyAccessFeatureInputSchema = z.object({
  project_id: z.number().describe('PostHog project ID. Example: 309484'),
  name: z.string().describe('Name of the early access feature. Example: "Beta Feature"'),
  description: z.string().optional().describe('Description of the feature. Example: "New dashboard beta"'),
  stage: z
    .string()
    .optional()
    .describe('Release stage. Examples: "draft", "concept", "alpha", "beta", "general_availability"'),
  documentation_url: z.string().optional().describe('URL to documentation. Example: "https://docs.example.com"'),
  payload: z.unknown().optional().describe('Custom payload object.'),
  feature_flag_id: z.number().optional().describe('ID of the associated feature flag. Example: 700471'),
  _create_in_folder: z.string().optional().describe('Folder to create the feature in.'),
});

const ProviderFeatureFlagSchema = z.object({
  id: z.number(),
  team_id: z.number(),
  name: z.string().nullable().optional(),
  key: z.string().nullable().optional(),
  filters: z.record(z.string(), z.unknown()).nullable().optional(),
  deleted: z.boolean().nullable().optional(),
  active: z.boolean().nullable().optional(),
  ensure_experience_continuity: z.boolean().nullable().optional(),
  version: z.number().nullable().optional(),
  evaluation_runtime: z.string().nullable().optional(),
  bucketing_identifier: z.string().nullable().optional(),
  evaluation_contexts: z.array(z.string()).nullable().optional(),
});

const ProviderOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  stage: z.string(),
  documentation_url: z.string().nullable().optional(),
  payload: z.unknown().nullable().optional(),
  created_at: z.string(),
  feature_flag_id: z.number().nullable().optional(),
  feature_flag: ProviderFeatureFlagSchema.nullable().optional(),
  _create_in_folder: z.string().nullable().optional(),
});

export const createEarlyAccessFeatureOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  stage: z.string(),
  documentation_url: z.string().optional(),
  payload: z.unknown().optional(),
  created_at: z.string(),
  feature_flag_id: z.number().optional(),
  feature_flag: z
    .object({
      id: z.number(),
      key: z.string().optional(),
    })
    .optional(),
});

export function createEarlyAccessFeatureTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_create_early_access_feature',
    description: 'Create an early access feature in PostHog.',
    inputSchema: createEarlyAccessFeatureInputSchema,
    outputSchema: createEarlyAccessFeatureOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createEarlyAccessFeatureOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://posthog.com/docs/api/early-access-feature
        endpoint: `/api/projects/${encodeURIComponent(String(input.project_id))}/early_access_feature/`,
        data: {
          name: input.name,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.stage !== undefined && { stage: input.stage }),
          ...(input.documentation_url !== undefined && { documentation_url: input.documentation_url }),
          ...(input.payload !== undefined && { payload: input.payload }),
          ...(input.feature_flag_id !== undefined && { feature_flag_id: input.feature_flag_id }),
          ...(input._create_in_folder !== undefined && { _create_in_folder: input._create_in_folder }),
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);

      const providerOutput = ProviderOutputSchema.parse(response.data);

      return {
        id: providerOutput.id,
        name: providerOutput.name,
        ...(providerOutput.description != null && { description: providerOutput.description }),
        stage: providerOutput.stage,
        ...(providerOutput.documentation_url != null && { documentation_url: providerOutput.documentation_url }),
        ...(providerOutput.payload != null && { payload: providerOutput.payload }),
        created_at: providerOutput.created_at,
        ...(providerOutput.feature_flag_id != null && { feature_flag_id: providerOutput.feature_flag_id }),
        ...(providerOutput.feature_flag != null && {
          feature_flag: {
            id: providerOutput.feature_flag.id,
            ...(providerOutput.feature_flag.key != null && { key: providerOutput.feature_flag.key }),
          },
        }),
      };
    },
  });
}
