// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createFeatureFlagInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  key: z.string().describe('Unique key for the feature flag. Example: "my-new-flag"'),
  name: z.string().optional().describe('Display name for the feature flag.'),
  filters: z.record(z.string(), z.unknown()).optional().describe('Filter conditions for the feature flag.'),
  active: z.boolean().optional().describe('Whether the feature flag is active.'),
  tags: z.array(z.string()).optional().describe('Tags to associate with the feature flag.'),
  evaluation_contexts: z
    .array(z.record(z.string(), z.unknown()))
    .optional()
    .describe('Evaluation contexts for the feature flag.'),
});

const ProviderFeatureFlagSchema = z
  .object({
    id: z.number(),
    key: z.string(),
    name: z.string().optional(),
    active: z.boolean().optional(),
    deleted: z.boolean().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    filters: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .passthrough();

export const createFeatureFlagOutputSchema = z.object({
  id: z.number(),
  key: z.string(),
  name: z.string().optional(),
  active: z.boolean().optional(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export function createFeatureFlagTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_create_feature_flag',
    description: 'Create a feature flag in PostHog.',
    inputSchema: createFeatureFlagInputSchema,
    outputSchema: createFeatureFlagOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createFeatureFlagOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://posthog.com/docs/api/feature-flags
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/feature_flags/`,
        data: {
          key: input.key,
          ...(input.name !== undefined && { name: input.name }),
          ...(input.filters !== undefined && { filters: input.filters }),
          ...(input.active !== undefined && { active: input.active }),
          ...(input.tags !== undefined && { tags: input.tags }),
          ...(input.evaluation_contexts !== undefined && { evaluation_contexts: input.evaluation_contexts }),
        },
        retries: 3,
      });

      const providerFlag = ProviderFeatureFlagSchema.parse(response.data);

      return {
        id: providerFlag.id,
        key: providerFlag.key,
        ...(providerFlag.name !== undefined && { name: providerFlag.name }),
        ...(providerFlag.active !== undefined && { active: providerFlag.active }),
        ...(providerFlag.deleted !== undefined && { deleted: providerFlag.deleted }),
        ...(providerFlag.created_at !== undefined && { created_at: providerFlag.created_at }),
        ...(providerFlag.updated_at !== undefined && { updated_at: providerFlag.updated_at }),
        ...(providerFlag.filters != null && { filters: providerFlag.filters }),
      };
    },
  });
}
