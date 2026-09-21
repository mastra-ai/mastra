// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listFeatureFlagsInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (offset) from the previous response. Omit for the first page.'),
  limit: z.number().optional().describe('Number of results to return per page.'),
  active: z.string().optional().describe('Filter by active status. One of: "STALE", "false", "true".'),
  created_by_id: z.string().optional().describe('Filter by creator user ID.'),
  evaluation_runtime: z
    .string()
    .optional()
    .describe('Filter by evaluation runtime. One of: "both", "client", "server".'),
  excluded_properties: z.string().optional().describe('Excluded properties filter.'),
  has_evaluation_contexts: z.string().optional().describe('Filter by evaluation contexts. One of: "false", "true".'),
  search: z.string().optional().describe('Search query string.'),
  tags: z.string().optional().describe('Filter by tags.'),
  type: z
    .string()
    .optional()
    .describe('Filter by flag type. One of: "boolean", "experiment", "multivariant", "remote_config".'),
});

const FeatureFlagSchema = z
  .object({
    id: z.number(),
    name: z.string().nullable().optional(),
    key: z.string(),
    filters: z.record(z.string(), z.unknown()).optional(),
    deleted: z.boolean().optional(),
    active: z.boolean().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    version: z.number().optional(),
    tags: z.array(z.string().nullable()).optional(),
    ensure_experience_continuity: z.boolean().optional(),
    experiment_set: z.array(z.number()).optional(),
    is_remote_configuration: z.boolean().optional(),
    evaluation_runtime: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const listFeatureFlagsOutputSchema = z.object({
  items: z.array(FeatureFlagSchema),
  count: z.number(),
  next_cursor: z.string().optional(),
  previous_cursor: z.string().optional(),
});

export function listFeatureFlagsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_feature_flags',
    description: 'List feature flags from PostHog.',
    inputSchema: listFeatureFlagsInputSchema,
    outputSchema: listFeatureFlagsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listFeatureFlagsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const params: Record<string, string | number> = {};
      if (input.cursor !== undefined) {
        params['offset'] = input.cursor;
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }
      if (input.active !== undefined) {
        params['active'] = input.active;
      }
      if (input.created_by_id !== undefined) {
        params['created_by_id'] = input.created_by_id;
      }
      if (input.evaluation_runtime !== undefined) {
        params['evaluation_runtime'] = input.evaluation_runtime;
      }
      if (input.excluded_properties !== undefined) {
        params['excluded_properties'] = input.excluded_properties;
      }
      if (input.has_evaluation_contexts !== undefined) {
        params['has_evaluation_contexts'] = input.has_evaluation_contexts;
      }
      if (input.search !== undefined) {
        params['search'] = input.search;
      }
      if (input.tags !== undefined) {
        params['tags'] = input.tags;
      }
      if (input.type !== undefined) {
        params['type'] = input.type;
      }

      const config: PlatformProxyRequest = {
        // https://posthog.com/docs/api/feature-flags
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/feature_flags/`,
        params,
        retries: 3,
      };
      const response = await platformProxy.get(config);

      const providerData = z
        .object({
          count: z.number(),
          next: z.string().nullable().optional(),
          previous: z.string().nullable().optional(),
          results: z.array(z.unknown()),
        })
        .parse(response.data);

      const items = providerData.results.map(item => {
        return FeatureFlagSchema.parse(item);
      });

      function extractOffsetFromUrl(url: string | null | undefined): string | undefined {
        if (!url) {
          return undefined;
        }
        // @allowTryCatch Malformed or relative URLs from the provider should gracefully fall back to undefined instead of crashing the action.
        try {
          const parsed = new URL(url);
          const offset = parsed.searchParams.get('offset');
          return offset ?? undefined;
        } catch {
          return undefined;
        }
      }

      const nextCursor = extractOffsetFromUrl(providerData.next);
      const previousCursor = extractOffsetFromUrl(providerData.previous);

      return {
        items,
        count: providerData.count,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
        ...(previousCursor !== undefined && { previous_cursor: previousCursor }),
      };
    },
  });
}
