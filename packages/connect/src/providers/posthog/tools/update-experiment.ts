// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateExperimentInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.number().describe('Experiment ID. Example: 123'),
  name: z.string().optional().describe('Experiment name'),
  description: z.string().nullable().optional().describe('Experiment description'),
  start_date: z.string().nullable().optional().describe('Start date in ISO 8601 format. Example: 2019-08-24T14:15:22Z'),
  end_date: z.string().nullable().optional().describe('End date in ISO 8601 format. Example: 2019-08-24T14:15:22Z'),
  feature_flag_key: z.string().optional().describe('Feature flag key'),
  archived: z.boolean().optional().describe('Whether the experiment is archived'),
  conclusion: z.string().optional().describe('Experiment conclusion. Example: won, lost, inconclusive'),
  conclusion_comment: z.string().nullable().optional().describe('Comment explaining the conclusion'),
});

const ProviderExperimentSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  feature_flag_key: z.string(),
  feature_flag: z.record(z.string(), z.unknown()).nullable().optional(),
  holdout: z.record(z.string(), z.unknown()).nullable().optional(),
  holdout_id: z.number().nullable().optional(),
  exposure_cohort: z.number().nullable().optional(),
  parameters: z.record(z.string(), z.unknown()).nullable().optional(),
  secondary_metrics: z.unknown().nullable().optional(),
  saved_metrics: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  saved_metrics_ids: z.array(z.unknown()).nullable().optional(),
  filters: z.unknown().nullable().optional(),
  archived: z.boolean().optional(),
  deleted: z.boolean().optional(),
  created_by: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  type: z.string().optional(),
  exposure_criteria: z.record(z.string(), z.unknown()).nullable().optional(),
  metrics: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  metrics_secondary: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  stats_config: z.unknown().nullable().optional(),
  scheduling_config: z.unknown().nullable().optional(),
  allow_unknown_events: z.boolean().optional(),
  conclusion: z.string().nullable().optional(),
  conclusion_comment: z.string().nullable().optional(),
  primary_metrics_ordered_uuids: z.unknown().nullable().optional(),
  secondary_metrics_ordered_uuids: z.unknown().nullable().optional(),
  only_count_matured_users: z.boolean().optional(),
  update_feature_flag_params: z.boolean().optional(),
  status: z.string().optional(),
  user_access_level: z.string().nullable().optional(),
});

export const updateExperimentOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  feature_flag_key: z.string(),
  holdout_id: z.number().nullable().optional(),
  exposure_cohort: z.number().nullable().optional(),
  archived: z.boolean().optional(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  type: z.string().optional(),
  conclusion: z.string().optional(),
  conclusion_comment: z.string().optional(),
  status: z.string().optional(),
  allow_unknown_events: z.boolean().optional(),
  only_count_matured_users: z.boolean().optional(),
  update_feature_flag_params: z.boolean().optional(),
});

export function updateExperimentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_update_experiment',
    description: 'Update an experiment in PostHog',
    inputSchema: updateExperimentInputSchema,
    outputSchema: updateExperimentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateExperimentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const data: Record<string, unknown> = {};
      if (input.name !== undefined) {
        data['name'] = input.name;
      }
      if (input.description !== undefined) {
        data['description'] = input.description;
      }
      if (input.start_date !== undefined) {
        data['start_date'] = input.start_date;
      }
      if (input.end_date !== undefined) {
        data['end_date'] = input.end_date;
      }
      if (input.feature_flag_key !== undefined) {
        data['feature_flag_key'] = input.feature_flag_key;
      }
      if (input.archived !== undefined) {
        data['archived'] = input.archived;
      }
      if (input.conclusion !== undefined) {
        data['conclusion'] = input.conclusion;
      }
      if (input.conclusion_comment !== undefined) {
        data['conclusion_comment'] = input.conclusion_comment;
      }

      const config: PlatformProxyRequest = {
        // https://posthog.com/docs/api/experiments#update-experiments
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/experiments/${encodeURIComponent(input.id)}/`,
        data,
        retries: 3,
      };

      const response = await platformProxy.patch(config);

      const providerExperiment = ProviderExperimentSchema.parse(response.data);

      return {
        id: providerExperiment.id,
        name: providerExperiment.name,
        ...(providerExperiment.description !== undefined &&
          providerExperiment.description !== null && { description: providerExperiment.description }),
        ...(providerExperiment.start_date !== undefined &&
          providerExperiment.start_date !== null && { start_date: providerExperiment.start_date }),
        ...(providerExperiment.end_date !== undefined &&
          providerExperiment.end_date !== null && { end_date: providerExperiment.end_date }),
        feature_flag_key: providerExperiment.feature_flag_key,
        ...(providerExperiment.holdout_id !== undefined && { holdout_id: providerExperiment.holdout_id }),
        ...(providerExperiment.exposure_cohort !== undefined && {
          exposure_cohort: providerExperiment.exposure_cohort,
        }),
        ...(providerExperiment.archived !== undefined && { archived: providerExperiment.archived }),
        ...(providerExperiment.deleted !== undefined && { deleted: providerExperiment.deleted }),
        ...(providerExperiment.created_at !== undefined && { created_at: providerExperiment.created_at }),
        ...(providerExperiment.updated_at !== undefined && { updated_at: providerExperiment.updated_at }),
        ...(providerExperiment.type !== undefined && { type: providerExperiment.type }),
        ...(providerExperiment.conclusion !== undefined &&
          providerExperiment.conclusion !== null && { conclusion: providerExperiment.conclusion }),
        ...(providerExperiment.conclusion_comment !== undefined &&
          providerExperiment.conclusion_comment !== null && {
            conclusion_comment: providerExperiment.conclusion_comment,
          }),
        ...(providerExperiment.status !== undefined && { status: providerExperiment.status }),
        ...(providerExperiment.allow_unknown_events !== undefined && {
          allow_unknown_events: providerExperiment.allow_unknown_events,
        }),
        ...(providerExperiment.only_count_matured_users !== undefined && {
          only_count_matured_users: providerExperiment.only_count_matured_users,
        }),
        ...(providerExperiment.update_feature_flag_params !== undefined && {
          update_feature_flag_params: providerExperiment.update_feature_flag_params,
        }),
      };
    },
  });
}
