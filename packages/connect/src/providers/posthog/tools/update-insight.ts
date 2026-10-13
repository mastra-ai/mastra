// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateInsightInputSchema = z.object({
  id: z.number().describe('Insight ID. Example: 9037904'),
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  name: z.string().nullable().optional().describe('Insight name. Pass null to clear.'),
  derived_name: z.string().nullable().optional(),
  description: z.string().nullable().optional().describe('Insight description. Pass null to clear.'),
  query: z.unknown().optional(),
  order: z.number().nullable().optional(),
  deleted: z.boolean().optional(),
  dashboards: z.array(z.number()).optional(),
  tags: z.array(z.string()).optional(),
  favorited: z.boolean().optional(),
  _create_in_folder: z.string().optional(),
});

const ProviderInsightSchema = z.object({
  id: z.number(),
  short_id: z.string(),
  name: z.string().nullable().optional(),
  derived_name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  query: z.unknown().optional(),
  order: z.number().nullable().optional(),
  deleted: z.boolean().optional(),
  dashboards: z.array(z.number()).optional(),
  tags: z.array(z.string()).optional(),
  favorited: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const updateInsightOutputSchema = z.object({
  id: z.number(),
  short_id: z.string(),
  name: z.string().optional(),
  derived_name: z.string().optional(),
  description: z.string().optional(),
  query: z.unknown().optional(),
  order: z.number().optional(),
  deleted: z.boolean().optional(),
  dashboards: z.array(z.number()).optional(),
  tags: z.array(z.string()).optional(),
  favorited: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export function updateInsightTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_update_insight',
    description: 'Update a insight in PostHog.',
    inputSchema: updateInsightInputSchema,
    outputSchema: updateInsightOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateInsightOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      // https://posthog.com/docs/api/insights
      const response = await platformProxy.patch({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/insights/${encodeURIComponent(String(input.id))}/`,
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.derived_name !== undefined && { derived_name: input.derived_name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.query !== undefined && { query: input.query }),
          ...(input.order !== undefined && { order: input.order }),
          ...(input.deleted !== undefined && { deleted: input.deleted }),
          ...(input.dashboards !== undefined && { dashboards: input.dashboards }),
          ...(input.tags !== undefined && { tags: input.tags }),
          ...(input.favorited !== undefined && { favorited: input.favorited }),
          ...(input._create_in_folder !== undefined && { _create_in_folder: input._create_in_folder }),
        },
        retries: 10,
      });

      const providerInsight = ProviderInsightSchema.parse(response.data);

      return {
        id: providerInsight.id,
        short_id: providerInsight.short_id,
        ...(providerInsight.name != null && { name: providerInsight.name }),
        ...(providerInsight.derived_name != null && { derived_name: providerInsight.derived_name }),
        ...(providerInsight.description != null && { description: providerInsight.description }),
        ...(providerInsight.query !== undefined && { query: providerInsight.query }),
        ...(providerInsight.order != null && { order: providerInsight.order }),
        ...(providerInsight.deleted !== undefined && { deleted: providerInsight.deleted }),
        ...(providerInsight.dashboards !== undefined && { dashboards: providerInsight.dashboards }),
        ...(providerInsight.tags !== undefined && { tags: providerInsight.tags }),
        ...(providerInsight.favorited !== undefined && { favorited: providerInsight.favorited }),
        ...(providerInsight.created_at !== undefined && { created_at: providerInsight.created_at }),
        ...(providerInsight.updated_at !== undefined && { updated_at: providerInsight.updated_at }),
      };
    },
  });
}
