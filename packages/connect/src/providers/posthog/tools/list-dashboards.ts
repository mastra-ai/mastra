// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listDashboardsInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  limit: z.number().optional().describe('Number of results per page. Example: 20'),
  search: z.string().optional().describe('Search query string'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const CreatedBySchema = z.object({
  id: z.number(),
  uuid: z.string(),
  distinct_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  is_email_verified: z.boolean(),
  role_at_organization: z.string().optional(),
});

const ProviderDashboardSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  pinned: z.boolean().optional(),
  created_at: z.string(),
  created_by: CreatedBySchema.nullable().optional(),
  last_accessed_at: z.string().nullable().optional(),
  last_viewed_at: z.string().nullable().optional(),
  is_shared: z.boolean().optional(),
  deleted: z.boolean().optional(),
  creation_mode: z.string().optional(),
  tags: z.array(z.unknown()).optional(),
  restriction_level: z.number().optional(),
  effective_restriction_level: z.number().optional(),
  effective_privilege_level: z.number().optional(),
  user_access_level: z.string().optional(),
  access_control_version: z.string().optional(),
  last_refresh: z.string().nullable().optional(),
  team_id: z.number().optional(),
});

const ProviderListResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable().optional(),
  previous: z.string().nullable().optional(),
  results: z.array(ProviderDashboardSchema),
});

const DashboardSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  pinned: z.boolean().optional(),
  created_at: z.string(),
  created_by: CreatedBySchema.optional(),
  last_accessed_at: z.string().optional(),
  last_viewed_at: z.string().optional(),
  is_shared: z.boolean().optional(),
  deleted: z.boolean().optional(),
  creation_mode: z.string().optional(),
  tags: z.array(z.unknown()).optional(),
  restriction_level: z.number().optional(),
  effective_restriction_level: z.number().optional(),
  effective_privilege_level: z.number().optional(),
  user_access_level: z.string().optional(),
  last_refresh: z.string().optional(),
  team_id: z.number().optional(),
});

export const listDashboardsOutputSchema = z.object({
  items: z.array(DashboardSchema),
  next_cursor: z.string().optional(),
});

export function listDashboardsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_dashboards',
    description: 'List dashboards from PostHog.',
    inputSchema: listDashboardsInputSchema,
    outputSchema: listDashboardsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDashboardsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;
      const offset = input.cursor ? parseInt(input.cursor, 10) : 0;

      // https://posthog.com/docs/api/dashboards
      const response = await platformProxy.get({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/dashboards/`,
        params: {
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(offset > 0 && { offset: String(offset) }),
          ...(input.search !== undefined && { search: input.search }),
        },
        retries: 3,
      });

      const parsed = ProviderListResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Provider returned an unexpected response format.',
        });
      }

      const data = parsed.data;

      let nextCursor: string | undefined;
      if (data.next) {
        const offsetMatch = data.next.match(/[?&]offset=([^&]+)/);
        if (offsetMatch && offsetMatch[1]) {
          nextCursor = offsetMatch[1];
        }
      }

      return {
        items: data.results.map(dashboard => ({
          id: dashboard.id,
          name: dashboard.name,
          ...(dashboard.description !== undefined && { description: dashboard.description }),
          ...(dashboard.pinned !== undefined && { pinned: dashboard.pinned }),
          created_at: dashboard.created_at,
          ...(dashboard.created_by != null && { created_by: dashboard.created_by }),
          ...(dashboard.last_accessed_at != null && { last_accessed_at: dashboard.last_accessed_at }),
          ...(dashboard.last_viewed_at != null && { last_viewed_at: dashboard.last_viewed_at }),
          ...(dashboard.is_shared !== undefined && { is_shared: dashboard.is_shared }),
          ...(dashboard.deleted !== undefined && { deleted: dashboard.deleted }),
          ...(dashboard.creation_mode !== undefined && { creation_mode: dashboard.creation_mode }),
          ...(dashboard.tags !== undefined && { tags: dashboard.tags }),
          ...(dashboard.restriction_level !== undefined && { restriction_level: dashboard.restriction_level }),
          ...(dashboard.effective_restriction_level !== undefined && {
            effective_restriction_level: dashboard.effective_restriction_level,
          }),
          ...(dashboard.effective_privilege_level !== undefined && {
            effective_privilege_level: dashboard.effective_privilege_level,
          }),
          ...(dashboard.user_access_level !== undefined && { user_access_level: dashboard.user_access_level }),
          ...(dashboard.last_refresh != null && { last_refresh: dashboard.last_refresh }),
          ...(dashboard.team_id !== undefined && { team_id: dashboard.team_id }),
        })),
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
