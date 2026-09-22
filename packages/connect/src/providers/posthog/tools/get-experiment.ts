// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getExperimentInputSchema = z.object({
  id: z.number().describe('Experiment ID. Example: 123'),
  project_id: z.number().describe('PostHog project ID. Example: 309484'),
});

export const getExperimentOutputSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    feature_flag_key: z.string(),
    feature_flag: z.record(z.string(), z.unknown()).optional(),
    holdout: z.record(z.string(), z.unknown()).nullable().optional(),
    holdout_id: z.number().nullable().optional(),
    exposure_cohort: z.number().nullable().optional(),
    parameters: z.record(z.string(), z.unknown()).nullable().optional(),
    secondary_metrics: z.unknown().optional(),
    saved_metrics: z.array(z.record(z.string(), z.unknown())).optional(),
    saved_metrics_ids: z.array(z.unknown()).nullable().optional(),
    filters: z.unknown().optional(),
    archived: z.boolean().optional(),
    deleted: z.boolean().optional(),
    created_by: z.record(z.string(), z.unknown()).optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    type: z.string().optional(),
    exposure_criteria: z.record(z.string(), z.unknown()).optional(),
    metrics: z.array(z.record(z.string(), z.unknown())).optional(),
    metrics_secondary: z.array(z.record(z.string(), z.unknown())).optional(),
    stats_config: z.unknown().optional(),
    scheduling_config: z.unknown().optional(),
    allow_unknown_events: z.boolean().optional(),
    conclusion: z.string().nullable().optional(),
    conclusion_comment: z.string().nullable().optional(),
    primary_metrics_ordered_uuids: z.unknown().optional(),
    secondary_metrics_ordered_uuids: z.unknown().optional(),
    only_count_matured_users: z.boolean().optional(),
    update_feature_flag_params: z.boolean().optional(),
    status: z.string().optional(),
    user_access_level: z.string().optional(),
  })
  .passthrough();

export function getExperimentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_get_experiment',
    description: 'Retrieve a single experiment from PostHog.',
    inputSchema: getExperimentInputSchema,
    outputSchema: getExperimentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getExperimentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://posthog.com/docs/api/experiments
        endpoint: `/api/projects/${encodeURIComponent(String(input.project_id))}/experiments/${encodeURIComponent(String(input.id))}/`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Experiment not found',
        });
      }

      const providerExperiment = getExperimentOutputSchema.parse(response.data);

      return providerExperiment;
    },
  });
}
