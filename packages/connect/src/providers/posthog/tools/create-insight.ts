// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createInsightInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  name: z.string().describe('Name of the insight. Example: "Page views trend"'),
  query: z
    .record(z.string(), z.unknown())
    .describe(
      'PostHog query object. Example: {"kind":"InsightVizNode","source":{"kind":"TrendsQuery","series":[{"kind":"EventsNode","event":"$pageview"}]}}',
    ),
  description: z.string().optional().describe('Description of the insight.'),
  tags: z.array(z.string()).optional().describe('Tags for the insight.'),
  dashboards: z.array(z.number()).optional().describe('Dashboard IDs to add the insight to.'),
  favorited: z.boolean().optional().describe('Whether the insight is favorited.'),
  order: z.number().optional().describe('Display order of the insight.'),
  derived_name: z.string().optional().describe('Derived name of the insight.'),
});

const ProviderInsightSchema = z.object({
  id: z.number(),
  short_id: z.string(),
  name: z.string().nullable().optional(),
  derived_name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  query: z.record(z.string(), z.unknown()).nullable().optional(),
  order: z.number().nullable().optional(),
  deleted: z.boolean().nullable().optional(),
  dashboards: z.array(z.number()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  favorited: z.boolean().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export const createInsightOutputSchema = z.object({
  id: z.number(),
  short_id: z.string(),
  name: z.string().optional(),
  derived_name: z.string().optional(),
  description: z.string().optional(),
  query: z.record(z.string(), z.unknown()).optional(),
  order: z.number().optional(),
  deleted: z.boolean().optional(),
  dashboards: z.array(z.number()).optional(),
  tags: z.array(z.string()).optional(),
  favorited: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export function createInsightTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_create_insight',
    description: 'Create a insight in PostHog.',
    inputSchema: createInsightInputSchema,
    outputSchema: createInsightOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createInsightOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const response = await platformProxy.post({
        // https://posthog.com/docs/api/insights
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/insights/`,
        data: {
          name: input.name,
          query: input.query,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.tags !== undefined && { tags: input.tags }),
          ...(input.dashboards !== undefined && { dashboards: input.dashboards }),
          ...(input.favorited !== undefined && { favorited: input.favorited }),
          ...(input.order !== undefined && { order: input.order }),
          ...(input.derived_name !== undefined && { derived_name: input.derived_name }),
        },
        retries: 3,
      });

      const providerInsight = ProviderInsightSchema.parse(response.data);

      return {
        id: providerInsight.id,
        short_id: providerInsight.short_id,
        ...(providerInsight.name != null && { name: providerInsight.name }),
        ...(providerInsight.derived_name != null && { derived_name: providerInsight.derived_name }),
        ...(providerInsight.description != null && { description: providerInsight.description }),
        ...(providerInsight.query != null && { query: providerInsight.query }),
        ...(providerInsight.order != null && { order: providerInsight.order }),
        ...(providerInsight.deleted != null && { deleted: providerInsight.deleted }),
        ...(providerInsight.dashboards != null && { dashboards: providerInsight.dashboards }),
        ...(providerInsight.tags != null && { tags: providerInsight.tags }),
        ...(providerInsight.favorited != null && { favorited: providerInsight.favorited }),
        ...(providerInsight.created_at != null && { created_at: providerInsight.created_at }),
        ...(providerInsight.updated_at != null && { updated_at: providerInsight.updated_at }),
      };
    },
  });
}
