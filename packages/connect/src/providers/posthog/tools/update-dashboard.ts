// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateDashboardInputSchema = z.object({
  project_id: z.number().describe('PostHog project ID. Example: 309484'),
  id: z.number().describe('Dashboard ID. Example: 1663108'),
  name: z.string().nullable().optional().describe('Dashboard name. Set to null to clear.'),
  description: z.string().optional().describe('Dashboard description'),
  pinned: z.boolean().optional().describe('Whether the dashboard is pinned'),
  last_accessed_at: z.string().nullable().optional().describe('ISO timestamp of last access'),
  deleted: z.boolean().optional().describe('Soft-delete flag'),
  breakdown_colors: z.unknown().optional().describe('Breakdown colors configuration'),
  data_color_theme_id: z.number().nullable().optional().describe('Data color theme ID'),
  tags: z.array(z.unknown()).optional().describe('Dashboard tags'),
  restriction_level: z.number().optional().describe('Restriction level'),
  last_refresh: z.string().nullable().optional().describe('ISO timestamp of last refresh'),
  quick_filter_ids: z.array(z.string()).nullable().optional().describe('Quick filter insight IDs'),
  use_template: z.string().optional().describe('Template name'),
  use_dashboard: z.number().nullable().optional().describe('ID of dashboard to copy from'),
  delete_insights: z.boolean().optional().describe('Whether to delete insights when copying'),
  _create_in_folder: z.string().optional().describe('Folder to create the dashboard in'),
});

const ProviderDashboardSchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  pinned: z.boolean().nullable().optional(),
  created_at: z.string().nullable().optional(),
  created_by: z.record(z.string(), z.unknown()).nullable().optional(),
  last_accessed_at: z.string().nullable().optional(),
  last_viewed_at: z.string().nullable().optional(),
  is_shared: z.boolean().nullable().optional(),
  deleted: z.boolean().nullable().optional(),
  creation_mode: z.string().nullable().optional(),
  filters: z.record(z.string(), z.unknown()).nullable().optional(),
  variables: z.record(z.string(), z.unknown()).nullable().optional(),
  breakdown_colors: z.unknown().nullable().optional(),
  data_color_theme_id: z.number().nullable().optional(),
  tags: z.array(z.unknown()).nullable().optional(),
  restriction_level: z.number().nullable().optional(),
  effective_restriction_level: z.number().nullable().optional(),
  effective_privilege_level: z.number().nullable().optional(),
  user_access_level: z.string().nullable().optional(),
  access_control_version: z.string().nullable().optional(),
  last_refresh: z.string().nullable().optional(),
  persisted_filters: z.record(z.string(), z.unknown()).nullable().optional(),
  persisted_variables: z.record(z.string(), z.unknown()).nullable().optional(),
  team_id: z.number().nullable().optional(),
  quick_filter_ids: z.array(z.unknown()).nullable().optional(),
  tiles: z.array(z.unknown()).nullable().optional(),
  use_template: z.string().nullable().optional(),
  use_dashboard: z.number().nullable().optional(),
  delete_insights: z.boolean().nullable().optional(),
  _create_in_folder: z.string().nullable().optional(),
});

export const updateDashboardOutputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().optional(),
  pinned: z.boolean().optional(),
  created_at: z.string().optional(),
  created_by: z.record(z.string(), z.unknown()).optional(),
  last_accessed_at: z.string().optional(),
  last_viewed_at: z.string().optional(),
  is_shared: z.boolean().optional(),
  deleted: z.boolean().optional(),
  creation_mode: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
  breakdown_colors: z.unknown().optional(),
  data_color_theme_id: z.number().optional(),
  tags: z.array(z.unknown()).optional(),
  restriction_level: z.number().optional(),
  effective_restriction_level: z.number().optional(),
  effective_privilege_level: z.number().optional(),
  user_access_level: z.string().optional(),
  access_control_version: z.string().optional(),
  last_refresh: z.string().optional(),
  persisted_filters: z.record(z.string(), z.unknown()).optional(),
  persisted_variables: z.record(z.string(), z.unknown()).optional(),
  team_id: z.number().optional(),
  quick_filter_ids: z.array(z.unknown()).optional(),
  tiles: z.array(z.unknown()).optional(),
  use_template: z.string().optional(),
  use_dashboard: z.number().optional(),
  delete_insights: z.boolean().optional(),
  _create_in_folder: z.string().optional(),
});

export function updateDashboardTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_update_dashboard',
    description: 'Update a dashboard in PostHog',
    inputSchema: updateDashboardInputSchema,
    outputSchema: updateDashboardOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateDashboardOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const patchData: Record<string, unknown> = {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.pinned !== undefined && { pinned: input.pinned }),
        ...(input.last_accessed_at !== undefined && { last_accessed_at: input.last_accessed_at }),
        ...(input.deleted !== undefined && { deleted: input.deleted }),
        ...(input.breakdown_colors !== undefined && { breakdown_colors: input.breakdown_colors }),
        ...(input.data_color_theme_id !== undefined && { data_color_theme_id: input.data_color_theme_id }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.restriction_level !== undefined && { restriction_level: input.restriction_level }),
        ...(input.last_refresh !== undefined && { last_refresh: input.last_refresh }),
        ...(input.quick_filter_ids !== undefined && { quick_filter_ids: input.quick_filter_ids }),
        ...(input.use_template !== undefined && { use_template: input.use_template }),
        ...(input.use_dashboard !== undefined && { use_dashboard: input.use_dashboard }),
        ...(input.delete_insights !== undefined && { delete_insights: input.delete_insights }),
        ...('_create_in_folder' in input &&
          input._create_in_folder !== undefined && { _create_in_folder: input._create_in_folder }),
      };

      const response = await platformProxy.patch({
        // https://posthog.com/docs/api/dashboards
        endpoint: `/api/projects/${encodeURIComponent(input.project_id.toString())}/dashboards/${encodeURIComponent(input.id.toString())}/`,
        data: patchData,
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from PostHog dashboard update endpoint',
        });
      }

      const providerDashboard = ProviderDashboardSchema.parse(response.data);

      return {
        id: providerDashboard.id,
        ...(providerDashboard.name != null && { name: providerDashboard.name }),
        ...(providerDashboard.description != null && { description: providerDashboard.description }),
        ...(providerDashboard.pinned != null && { pinned: providerDashboard.pinned }),
        ...(providerDashboard.created_at != null && { created_at: providerDashboard.created_at }),
        ...(providerDashboard.created_by != null && { created_by: providerDashboard.created_by }),
        ...(providerDashboard.last_accessed_at != null && { last_accessed_at: providerDashboard.last_accessed_at }),
        ...(providerDashboard.last_viewed_at != null && { last_viewed_at: providerDashboard.last_viewed_at }),
        ...(providerDashboard.is_shared != null && { is_shared: providerDashboard.is_shared }),
        ...(providerDashboard.deleted != null && { deleted: providerDashboard.deleted }),
        ...(providerDashboard.creation_mode != null && { creation_mode: providerDashboard.creation_mode }),
        ...(providerDashboard.filters != null && { filters: providerDashboard.filters }),
        ...(providerDashboard.variables != null && { variables: providerDashboard.variables }),
        ...(providerDashboard.breakdown_colors != null && { breakdown_colors: providerDashboard.breakdown_colors }),
        ...(providerDashboard.data_color_theme_id != null && {
          data_color_theme_id: providerDashboard.data_color_theme_id,
        }),
        ...(providerDashboard.tags != null && { tags: providerDashboard.tags }),
        ...(providerDashboard.restriction_level != null && { restriction_level: providerDashboard.restriction_level }),
        ...(providerDashboard.effective_restriction_level != null && {
          effective_restriction_level: providerDashboard.effective_restriction_level,
        }),
        ...(providerDashboard.effective_privilege_level != null && {
          effective_privilege_level: providerDashboard.effective_privilege_level,
        }),
        ...(providerDashboard.user_access_level != null && { user_access_level: providerDashboard.user_access_level }),
        ...(providerDashboard.access_control_version != null && {
          access_control_version: providerDashboard.access_control_version,
        }),
        ...(providerDashboard.last_refresh != null && { last_refresh: providerDashboard.last_refresh }),
        ...(providerDashboard.persisted_filters != null && { persisted_filters: providerDashboard.persisted_filters }),
        ...(providerDashboard.persisted_variables != null && {
          persisted_variables: providerDashboard.persisted_variables,
        }),
        ...(providerDashboard.team_id != null && { team_id: providerDashboard.team_id }),
        ...(providerDashboard.quick_filter_ids != null && { quick_filter_ids: providerDashboard.quick_filter_ids }),
        ...(providerDashboard.tiles != null && { tiles: providerDashboard.tiles }),
        ...(providerDashboard.use_template != null && { use_template: providerDashboard.use_template }),
        ...(providerDashboard.use_dashboard != null && { use_dashboard: providerDashboard.use_dashboard }),
        ...(providerDashboard.delete_insights != null && { delete_insights: providerDashboard.delete_insights }),
        ...(providerDashboard._create_in_folder != null && { _create_in_folder: providerDashboard._create_in_folder }),
      };
    },
  });
}
