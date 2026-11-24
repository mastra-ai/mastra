// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateFeatureFlagInputSchema = z.object({
  id: z.number().describe('Feature flag ID. Example: 700471'),
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  name: z.string().optional().describe('Name of the feature flag.'),
  key: z.string().optional().describe('Unique key for the feature flag.'),
  active: z.boolean().optional().describe('Whether the feature flag is active.'),
  filters: z.record(z.string(), z.unknown()).optional().describe('Filter conditions for the feature flag.'),
  tags: z.array(z.string()).optional().describe('Tags associated with the feature flag.'),
  evaluation_contexts: z
    .array(z.record(z.string(), z.unknown()))
    .optional()
    .describe('Evaluation contexts for the feature flag.'),
});

const CreatedBySchema = z.object({
  id: z.number(),
  uuid: z.string().optional(),
  distinct_id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().optional(),
});

const ProviderFeatureFlagSchema = z.object({
  id: z.number(),
  name: z.string(),
  key: z.string(),
  filters: z.record(z.string(), z.unknown()).optional(),
  deleted: z.boolean().optional(),
  active: z.boolean().optional(),
  created_by: CreatedBySchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  version: z.number().optional(),
  last_modified_by: CreatedBySchema.optional(),
  ensure_experience_continuity: z.boolean().optional(),
  experiment_set: z.array(z.number()).optional(),
  experiment_set_metadata: z.array(z.record(z.string(), z.unknown())).optional(),
  surveys: z.unknown().optional(),
  features: z.unknown().optional(),
  rollback_conditions: z.unknown().nullable().optional(),
  performed_rollback: z.boolean().optional(),
  can_edit: z.boolean().optional(),
  tags: z.array(z.string().nullable()).optional(),
  evaluation_contexts: z.array(z.unknown()).optional(),
  usage_dashboard: z.number().optional(),
  analytics_dashboards: z.array(z.number()).optional(),
  has_enriched_analytics: z.boolean().optional(),
  user_access_level: z.string().optional(),
  creation_context: z.string().optional(),
  is_remote_configuration: z.boolean().optional(),
  has_encrypted_payloads: z.boolean().optional(),
  status: z.string().optional(),
  evaluation_runtime: z.string().optional(),
  bucketing_identifier: z.string().optional(),
  last_called_at: z.string().nullable().optional(),
  _create_in_folder: z.string().nullable().optional(),
  _should_create_usage_dashboard: z.boolean().optional(),
  is_used_in_replay_settings: z.boolean().optional(),
});

export const updateFeatureFlagOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  key: z.string(),
  filters: z.record(z.string(), z.unknown()).optional(),
  deleted: z.boolean().optional(),
  active: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  version: z.number().optional(),
  tags: z.array(z.string()).optional(),
  ensure_experience_continuity: z.boolean().optional(),
  can_edit: z.boolean().optional(),
  status: z.string().optional(),
  evaluation_runtime: z.string().optional(),
});

export function updateFeatureFlagTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_update_feature_flag',
    description: 'Update a feature flag in PostHog.',
    inputSchema: updateFeatureFlagInputSchema,
    outputSchema: updateFeatureFlagOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateFeatureFlagOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: {
        name?: string;
        key?: string;
        active?: boolean;
        filters?: Record<string, unknown>;
        tags?: string[];
        evaluation_contexts?: unknown[];
      } = {};

      if (input.name !== undefined) {
        data.name = input.name;
      }
      if (input.key !== undefined) {
        data.key = input.key;
      }
      if (input.active !== undefined) {
        data.active = input.active;
      }
      if (input.filters !== undefined) {
        data.filters = input.filters;
      }
      if (input.tags !== undefined) {
        data.tags = input.tags;
      }
      if (input.evaluation_contexts !== undefined) {
        data.evaluation_contexts = input.evaluation_contexts;
      }

      // https://posthog.com/docs/api/feature-flags
      const response = await platformProxy.patch({
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/feature_flags/${encodeURIComponent(String(input.id))}/`,
        data,
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid or empty response from PostHog API.',
        });
      }

      const providerFlag = ProviderFeatureFlagSchema.parse(response.data);

      return {
        id: providerFlag.id,
        name: providerFlag.name,
        key: providerFlag.key,
        ...(providerFlag.filters !== undefined && { filters: providerFlag.filters }),
        ...(providerFlag.deleted !== undefined && { deleted: providerFlag.deleted }),
        ...(providerFlag.active !== undefined && { active: providerFlag.active }),
        ...(providerFlag.created_at !== undefined && { created_at: providerFlag.created_at }),
        ...(providerFlag.updated_at !== undefined && { updated_at: providerFlag.updated_at }),
        ...(providerFlag.version !== undefined && { version: providerFlag.version }),
        ...(providerFlag.tags !== undefined && {
          tags: providerFlag.tags.filter((tag): tag is string => tag !== null),
        }),
        ...(providerFlag.ensure_experience_continuity !== undefined && {
          ensure_experience_continuity: providerFlag.ensure_experience_continuity,
        }),
        ...(providerFlag.can_edit !== undefined && { can_edit: providerFlag.can_edit }),
        ...(providerFlag.status !== undefined && { status: providerFlag.status }),
        ...(providerFlag.evaluation_runtime !== undefined && {
          evaluation_runtime: providerFlag.evaluation_runtime,
        }),
      };
    },
  });
}
