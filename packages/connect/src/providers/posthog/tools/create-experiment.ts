// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const VariantSchema = z.object({
  key: z.string(),
  name: z.string().optional(),
  rollout_percentage: z.number().optional(),
});

const ParametersInputSchema = z
  .object({
    feature_flag_variants: z.array(VariantSchema).optional(),
    excluded_variants: z.array(z.string()).optional(),
    minimum_detectable_effect: z.number().optional(),
    rollout_percentage: z.number().optional(),
  })
  .passthrough()
  .optional();

export const createExperimentInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  name: z.string().describe('Experiment name. Example: "Homepage CTA Test"'),
  feature_flag_key: z.string().describe('Feature flag key to link to this experiment. Example: "homepage-cta-v2"'),
  description: z.string().optional().nullable().describe('Optional description of the experiment.'),
  start_date: z.string().optional().nullable().describe('ISO 8601 start date. Example: "2024-01-15T00:00:00Z"'),
  end_date: z.string().optional().nullable().describe('ISO 8601 end date. Example: "2024-01-30T00:00:00Z"'),
  holdout_id: z.number().optional().nullable(),
  parameters: ParametersInputSchema,
  secondary_metrics: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
  saved_metrics_ids: z.array(z.number()).optional().nullable(),
  filters: z.record(z.string(), z.unknown()).optional().nullable(),
  archived: z.boolean().optional(),
  deleted: z.boolean().optional().nullable(),
  type: z.string().optional(),
  exposure_criteria: z.record(z.string(), z.unknown()).optional().nullable(),
  metrics: z.array(z.record(z.string(), z.unknown())).optional(),
  metrics_secondary: z.array(z.record(z.string(), z.unknown())).optional(),
  stats_config: z.record(z.string(), z.unknown()).optional().nullable(),
  scheduling_config: z.record(z.string(), z.unknown()).optional().nullable(),
  allow_unknown_events: z.boolean().optional(),
  _create_in_folder: z.string().optional(),
  conclusion: z.string().optional(),
  conclusion_comment: z.string().optional().nullable(),
  primary_metrics_ordered_uuids: z.array(z.string()).optional().nullable(),
  secondary_metrics_ordered_uuids: z.array(z.string()).optional().nullable(),
  only_count_matured_users: z.boolean().optional(),
  update_feature_flag_params: z.boolean().optional(),
});

export const createExperimentOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  feature_flag_key: z.string(),
  feature_flag: z.record(z.string(), z.unknown()).optional().nullable(),
  holdout_id: z.number().optional().nullable(),
  parameters: z.record(z.string(), z.unknown()).optional().nullable(),
  secondary_metrics: z.unknown().optional().nullable(),
  saved_metrics: z.array(z.record(z.string(), z.unknown())).optional(),
  saved_metrics_ids: z.array(z.unknown()).optional().nullable(),
  filters: z.unknown().optional().nullable(),
  archived: z.boolean().optional(),
  deleted: z.boolean().optional().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  type: z.string().optional(),
  exposure_criteria: z.record(z.string(), z.unknown()).optional().nullable(),
  metrics: z.array(z.record(z.string(), z.unknown())).optional(),
  metrics_secondary: z.array(z.record(z.string(), z.unknown())).optional(),
  stats_config: z.record(z.string(), z.unknown()).optional().nullable(),
  scheduling_config: z.record(z.string(), z.unknown()).optional().nullable(),
  allow_unknown_events: z.boolean().optional(),
  _create_in_folder: z.string().optional(),
  conclusion: z.string().optional().nullable(),
  conclusion_comment: z.string().optional().nullable(),
  primary_metrics_ordered_uuids: z.array(z.unknown()).optional().nullable(),
  secondary_metrics_ordered_uuids: z.array(z.unknown()).optional().nullable(),
  only_count_matured_users: z.boolean().optional(),
  update_feature_flag_params: z.boolean().optional(),
  status: z.string().optional(),
  user_access_level: z.string().optional(),
});

export function createExperimentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_create_experiment',
    description: 'Create an A/B experiment in PostHog.',
    inputSchema: createExperimentInputSchema,
    outputSchema: createExperimentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createExperimentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://posthog.com/docs/api/experiments
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/experiments/`,
        data: {
          name: input.name,
          feature_flag_key: input.feature_flag_key,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.start_date !== undefined && { start_date: input.start_date }),
          ...(input.end_date !== undefined && { end_date: input.end_date }),
          ...(input.holdout_id !== undefined && { holdout_id: input.holdout_id }),
          ...(input.parameters !== undefined && { parameters: input.parameters }),
          ...(input.secondary_metrics !== undefined && { secondary_metrics: input.secondary_metrics }),
          ...(input.saved_metrics_ids !== undefined && { saved_metrics_ids: input.saved_metrics_ids }),
          ...(input.filters !== undefined && { filters: input.filters }),
          ...(input.archived !== undefined && { archived: input.archived }),
          ...(input.deleted !== undefined && { deleted: input.deleted }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.exposure_criteria !== undefined && { exposure_criteria: input.exposure_criteria }),
          ...(input.metrics !== undefined && { metrics: input.metrics }),
          ...(input.metrics_secondary !== undefined && { metrics_secondary: input.metrics_secondary }),
          ...(input.stats_config !== undefined && { stats_config: input.stats_config }),
          ...(input.scheduling_config !== undefined && { scheduling_config: input.scheduling_config }),
          ...(input.allow_unknown_events !== undefined && { allow_unknown_events: input.allow_unknown_events }),
          ...(input._create_in_folder !== undefined && { _create_in_folder: input._create_in_folder }),
          ...(input.conclusion !== undefined && { conclusion: input.conclusion }),
          ...(input.conclusion_comment !== undefined && { conclusion_comment: input.conclusion_comment }),
          ...(input.primary_metrics_ordered_uuids !== undefined && {
            primary_metrics_ordered_uuids: input.primary_metrics_ordered_uuids,
          }),
          ...(input.secondary_metrics_ordered_uuids !== undefined && {
            secondary_metrics_ordered_uuids: input.secondary_metrics_ordered_uuids,
          }),
          ...(input.only_count_matured_users !== undefined && {
            only_count_matured_users: input.only_count_matured_users,
          }),
          ...(input.update_feature_flag_params !== undefined && {
            update_feature_flag_params: input.update_feature_flag_params,
          }),
        },
        retries: 3,
      });

      const experiment = createExperimentOutputSchema.parse(response.data);
      return experiment;
    },
  });
}
