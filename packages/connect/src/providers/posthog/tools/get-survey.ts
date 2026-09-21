// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getSurveyInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.string().describe('Survey ID. Example: "019e8d61-0fbf-0000-0ddc-95116dc0275e"'),
});

export const getSurveyOutputSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    type: z.string().optional(),
    schedule: z.string().nullable().optional(),
    linked_flag: z.record(z.string(), z.unknown()).nullable().optional(),
    linked_flag_id: z.number().nullable().optional(),
    linked_insight_id: z.number().nullable().optional(),
    targeting_flag: z.record(z.string(), z.unknown()).nullable().optional(),
    internal_targeting_flag: z.record(z.string(), z.unknown()).nullable().optional(),
    questions: z.array(z.unknown()).nullable().optional(),
    conditions: z.record(z.string(), z.unknown()).nullable().optional(),
    appearance: z.unknown().nullable().optional(),
    created_at: z.string().nullable().optional(),
    created_by: z.record(z.string(), z.unknown()).nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    archived: z.boolean().optional(),
    responses_limit: z.number().nullable().optional(),
    feature_flag_keys: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
    iteration_count: z.number().nullable().optional(),
    iteration_frequency_days: z.number().nullable().optional(),
    iteration_start_dates: z.array(z.string()).nullable().optional(),
    current_iteration: z.number().nullable().optional(),
    current_iteration_start_date: z.string().nullable().optional(),
    response_sampling_start_date: z.string().nullable().optional(),
    response_sampling_interval_type: z.string().nullable().optional(),
    response_sampling_interval: z.number().nullable().optional(),
    response_sampling_limit: z.number().nullable().optional(),
    response_sampling_daily_limits: z.unknown().nullable().optional(),
    enable_partial_responses: z.boolean().nullable().optional(),
    enable_iframe_embedding: z.boolean().nullable().optional(),
    base_language: z.string().nullable().optional(),
    translations: z.unknown().nullable().optional(),
    user_access_level: z.string().nullable().optional(),
    form_content: z.unknown().nullable().optional(),
  })
  .passthrough();

export function getSurveyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_get_survey',
    description: 'Retrieve a single survey from PostHog.',
    inputSchema: getSurveyInputSchema,
    outputSchema: getSurveyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSurveyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const response = await platformProxy.get({
        // https://posthog.com/docs/api/surveys
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/surveys/${encodeURIComponent(input.id)}/`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Survey not found',
          id: input.id,
        });
      }

      const survey = getSurveyOutputSchema.parse(response.data);
      return survey;
    },
  });
}
