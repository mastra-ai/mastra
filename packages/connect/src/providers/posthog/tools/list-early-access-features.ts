// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listEarlyAccessFeaturesInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  limit: z.number().optional().describe('Maximum number of results to return per page. Example: 100'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (offset value) from the previous response. Omit for the first page.'),
});

const FeatureFlagSchema = z.object({
  id: z.number(),
  team_id: z.number().optional(),
  name: z.string().optional(),
  key: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  deleted: z.boolean().optional(),
  active: z.boolean().optional(),
  ensure_experience_continuity: z.boolean().optional(),
  version: z.number().optional(),
  evaluation_runtime: z.string().optional(),
  bucketing_identifier: z.string().optional(),
  evaluation_contexts: z.array(z.string()).optional(),
});

const EarlyAccessFeatureSchema = z.object({
  id: z.string(),
  feature_flag: FeatureFlagSchema.optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  stage: z.string().optional(),
  documentation_url: z.string().optional(),
  payload: z.unknown().optional(),
  created_at: z.string().optional(),
});

const ProviderListResponseSchema = z.object({
  count: z.number().optional(),
  next: z.string().nullable().optional(),
  previous: z.string().nullable().optional(),
  results: z.array(EarlyAccessFeatureSchema).optional(),
});

export const listEarlyAccessFeaturesOutputSchema = z.object({
  count: z.number().optional(),
  next_cursor: z.string().optional(),
  previous_cursor: z.string().optional(),
  results: z.array(EarlyAccessFeatureSchema),
});

function extractOffsetFromUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') {
    return undefined;
  }
  // @allowTryCatch new URL() throws on malformed URLs; we want to gracefully return undefined instead of crashing the action.
  try {
    const parsed = new URL(url);
    const offset = parsed.searchParams.get('offset');
    if (offset !== null) {
      return offset;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function listEarlyAccessFeaturesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_early_access_features',
    description: 'List early access features from PostHog.',
    inputSchema: listEarlyAccessFeaturesInputSchema,
    outputSchema: listEarlyAccessFeaturesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listEarlyAccessFeaturesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const params: Record<string, string | number> = {};
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }
      if (input.cursor !== undefined) {
        params['offset'] = input.cursor;
      }

      const response = await platformProxy.get({
        // https://posthog.com/docs/api/early-access-feature
        endpoint: `/api/projects/${encodeURIComponent(String(projectId))}/early_access_feature/`,
        params,
        retries: 3,
      });

      const providerData = ProviderListResponseSchema.parse(response.data);

      const nextCursor = extractOffsetFromUrl(providerData.next);
      const previousCursor = extractOffsetFromUrl(providerData.previous);

      return {
        ...(providerData.count !== undefined && { count: providerData.count }),
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
        ...(previousCursor !== undefined && { previous_cursor: previousCursor }),
        results: providerData.results ?? [],
      };
    },
  });
}
