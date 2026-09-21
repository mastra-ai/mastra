// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listInsightsInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  limit: z.number().optional().describe('Number of results to return per page. Example: 100'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (offset) from the previous response. Omit for the first page.'),
  saved: z.boolean().optional().describe('Filter to saved insights only.'),
  search: z.string().optional().describe('Search string to filter insights by name or description.'),
  short_id: z.string().optional().describe('Filter by insight short_id. Example: "ylBVGgvc"'),
  insight: z
    .string()
    .optional()
    .describe('Filter by insight type. One of: FUNNELS, JSON, LIFECYCLE, PATHS, RETENTION, SQL, STICKINESS, TRENDS'),
  favorited: z.boolean().optional().describe('Filter to favorited insights only.'),
});

const CreatedBySchema = z.object({
  id: z.number(),
  uuid: z.string().optional(),
  distinct_id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().optional(),
  is_email_verified: z.boolean().optional(),
  hedgehog_config: z.unknown().optional(),
  role_at_organization: z.string().optional(),
});

const InsightSchema = z.object({
  id: z.number(),
  short_id: z.string(),
  name: z.string().nullable().optional(),
  derived_name: z.string().nullable().optional(),
  query: z.unknown().optional(),
  order: z.number().nullable().optional(),
  deleted: z.boolean().optional(),
  dashboards: z.array(z.number()).optional(),
  dashboard_tiles: z.array(z.unknown()).optional(),
  last_refresh: z.string().nullable().optional(),
  cache_target_age: z.string().nullable().optional(),
  next_allowed_client_refresh: z.string().nullable().optional(),
  result: z.unknown().optional(),
  hasMore: z.boolean().nullable().optional(),
  columns: z.array(z.string()).nullable().optional(),
  created_at: z.string().optional(),
  created_by: CreatedBySchema.nullable().optional(),
  description: z.string().nullable().optional(),
  updated_at: z.string().optional(),
  tags: z.array(z.unknown()).nullable().optional(),
  favorited: z.boolean().optional(),
  last_modified_at: z.string().optional(),
  last_modified_by: CreatedBySchema.nullable().optional(),
  is_sample: z.boolean().optional(),
  effective_restriction_level: z.number().nullable().optional(),
  effective_privilege_level: z.number().nullable().optional(),
  user_access_level: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  is_cached: z.boolean().optional(),
  query_status: z.unknown().nullable().optional(),
  hogql: z.string().nullable().optional(),
  types: z.array(z.unknown()).nullable().optional(),
  resolved_date_range: z
    .object({
      date_from: z.string().optional(),
      date_to: z.string().optional(),
    })
    .nullable()
    .optional(),
  alerts: z.array(z.unknown()).nullable().optional(),
  last_viewed_at: z.string().nullable().optional(),
});

const ListResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable().optional(),
  previous: z.string().nullable().optional(),
  results: z.array(z.unknown()),
});

export const listInsightsOutputSchema = z.object({
  items: z.array(InsightSchema),
  next_cursor: z.string().optional(),
});

export function listInsightsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_insights',
    description: 'List insights from PostHog.',
    inputSchema: listInsightsInputSchema,
    outputSchema: listInsightsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listInsightsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const params: Record<string, string | number> = {
        limit: input.limit ?? 100,
      };

      if (input.cursor !== undefined) {
        params['offset'] = input.cursor;
      }
      if (input.saved !== undefined) {
        params['saved'] = String(input.saved);
      }
      if (input.search !== undefined) {
        params['search'] = input.search;
      }
      if (input.short_id !== undefined) {
        params['short_id'] = input.short_id;
      }
      if (input.insight !== undefined) {
        params['insight'] = input.insight;
      }
      if (input.favorited !== undefined) {
        params['favorited'] = String(input.favorited);
      }

      // https://posthog.com/docs/api/insights
      const response = await platformProxy.get({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/insights/`,
        params,
        retries: 3,
      });

      const listData = ListResponseSchema.parse(response.data);

      let nextCursor: string | undefined;
      if (listData.next) {
        const offsetMatch = listData.next.match(/[?&]offset=([^&]+)/);
        if (offsetMatch && offsetMatch[1]) {
          nextCursor = decodeURIComponent(offsetMatch[1]);
        }
      }

      return {
        items: listData.results.map(item => InsightSchema.parse(item)),
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
