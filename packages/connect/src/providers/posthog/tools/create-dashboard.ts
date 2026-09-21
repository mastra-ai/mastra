// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createDashboardInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  name: z.string().describe('Dashboard name.'),
  description: z.string().optional().describe('Dashboard description.'),
  pinned: z.boolean().optional().describe('Whether the dashboard is pinned.'),
  tags: z.array(z.string()).optional().describe('Dashboard tags.'),
  use_template: z.string().optional().describe('Template to use for the dashboard.'),
  use_dashboard: z.number().optional().describe('Existing dashboard ID to duplicate.'),
  delete_insights: z.boolean().optional().describe('Whether to delete insights when duplicating.'),
  data_color_theme_id: z.number().nullable().optional().describe('Data color theme ID.'),
});

const ProviderDashboardSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
  created_at: z.string().optional(),
  created_by: z
    .object({
      id: z.number().optional(),
      uuid: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  last_accessed_at: z.string().nullable().optional(),
  last_viewed_at: z.string().nullable().optional(),
  is_shared: z.boolean().optional(),
  deleted: z.boolean().optional(),
  creation_mode: z.string().optional(),
  filters: z.unknown().optional(),
  variables: z.unknown().optional(),
  breakdown_colors: z.unknown().nullable().optional(),
  data_color_theme_id: z.number().nullable().optional(),
  tags: z.array(z.unknown()).nullable().optional(),
  restriction_level: z.number().optional(),
  effective_restriction_level: z.number().optional(),
  effective_privilege_level: z.number().optional(),
  user_access_level: z.string().optional(),
  access_control_version: z.string().optional(),
  last_refresh: z.string().nullable().optional(),
  persisted_filters: z.unknown().optional(),
  persisted_variables: z.unknown().optional(),
  team_id: z.number().optional(),
  quick_filter_ids: z.array(z.string()).nullable().optional(),
  tiles: z.array(z.unknown()).optional(),
  use_template: z.string().optional(),
  use_dashboard: z.number().optional(),
  delete_insights: z.boolean().optional(),
  _create_in_folder: z.string().optional(),
});

export const createDashboardOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  pinned: z.boolean().optional(),
  created_at: z.string().optional(),
  team_id: z.number().optional(),
  deleted: z.boolean().optional(),
  is_shared: z.boolean().optional(),
  creation_mode: z.string().optional(),
  filters: z.unknown().optional(),
  variables: z.unknown().optional(),
  data_color_theme_id: z.number().nullable().optional(),
  tags: z.array(z.unknown()).optional(),
  restriction_level: z.number().optional(),
  effective_restriction_level: z.number().optional(),
  effective_privilege_level: z.number().optional(),
  user_access_level: z.string().optional(),
  access_control_version: z.string().optional(),
  last_refresh: z.string().optional(),
  quick_filter_ids: z.array(z.string()).optional(),
  tiles: z.array(z.unknown()).optional(),
});

export function createDashboardTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_create_dashboard',
    description: 'Create a dashboard in PostHog.',
    inputSchema: createDashboardInputSchema,
    outputSchema: createDashboardOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createDashboardOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://posthog.com/docs/api/dashboards#create-environments-dashboards
      const response = await platformProxy.post({
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/dashboards/`,
        data: {
          name: input.name,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.pinned !== undefined && { pinned: input.pinned }),
          ...(input.tags !== undefined && { tags: input.tags }),
          ...(input.use_template !== undefined && { use_template: input.use_template }),
          ...(input.use_dashboard !== undefined && { use_dashboard: input.use_dashboard }),
          ...(input.delete_insights !== undefined && { delete_insights: input.delete_insights }),
          ...(input.data_color_theme_id !== undefined && { data_color_theme_id: input.data_color_theme_id }),
        },
        retries: 3,
      });

      const dashboard = ProviderDashboardSchema.parse(response.data);

      return {
        id: dashboard.id,
        name: dashboard.name,
        ...(dashboard.description != null && { description: dashboard.description }),
        ...(dashboard.pinned !== undefined && { pinned: dashboard.pinned }),
        ...(dashboard.created_at !== undefined && { created_at: dashboard.created_at }),
        ...(dashboard.team_id !== undefined && { team_id: dashboard.team_id }),
        ...(dashboard.deleted !== undefined && { deleted: dashboard.deleted }),
        ...(dashboard.is_shared !== undefined && { is_shared: dashboard.is_shared }),
        ...(dashboard.creation_mode !== undefined && { creation_mode: dashboard.creation_mode }),
        ...(dashboard.filters !== undefined && { filters: dashboard.filters }),
        ...(dashboard.variables !== undefined && { variables: dashboard.variables }),
        ...(dashboard.data_color_theme_id !== undefined && { data_color_theme_id: dashboard.data_color_theme_id }),
        ...(dashboard.tags !== undefined && { tags: dashboard.tags ?? [] }),
        ...(dashboard.restriction_level !== undefined && { restriction_level: dashboard.restriction_level }),
        ...(dashboard.effective_restriction_level !== undefined && {
          effective_restriction_level: dashboard.effective_restriction_level,
        }),
        ...(dashboard.effective_privilege_level !== undefined && {
          effective_privilege_level: dashboard.effective_privilege_level,
        }),
        ...(dashboard.user_access_level !== undefined && { user_access_level: dashboard.user_access_level }),
        ...(dashboard.access_control_version !== undefined && {
          access_control_version: dashboard.access_control_version,
        }),
        ...(dashboard.last_refresh != null && { last_refresh: dashboard.last_refresh }),
        ...(dashboard.quick_filter_ids !== undefined && { quick_filter_ids: dashboard.quick_filter_ids ?? [] }),
        ...(dashboard.tiles !== undefined && { tiles: dashboard.tiles }),
      };
    },
  });
}
