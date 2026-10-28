// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateSurveyInputSchema = z.object({
  project_id: z.number().describe('PostHog project ID. Example: 309484'),
  survey_id: z.string().describe('Survey ID to update. Example: "019e8d61-0fbf-0000-0ddc-95116dc0275e"'),
  name: z.string().optional().describe('Survey name'),
  description: z.string().optional().describe('Survey description'),
  type: z.string().optional().describe('Survey type (e.g. popover, api)'),
  schedule: z.string().optional().describe('Survey schedule'),
  linked_flag_id: z.number().nullable().optional().describe('Linked feature flag ID'),
  linked_insight_id: z.number().nullable().optional().describe('Linked insight ID'),
  targeting_flag_id: z.number().nullable().optional().describe('Targeting flag ID'),
  targeting_flag_filters: z.record(z.string(), z.unknown()).nullable().optional().describe('Targeting flag filters'),
  remove_targeting_flag: z.boolean().nullable().optional().describe('Remove targeting flag'),
  questions: z.array(z.record(z.string(), z.unknown())).nullable().optional().describe('Survey questions'),
  conditions: z.record(z.string(), z.unknown()).nullable().optional().describe('Survey conditions'),
  appearance: z.record(z.string(), z.unknown()).nullable().optional().describe('Survey appearance settings'),
  start_date: z.string().nullable().optional().describe('Start date ISO string'),
  end_date: z.string().nullable().optional().describe('End date ISO string'),
  archived: z.boolean().optional().describe('Archive status'),
  responses_limit: z.number().nullable().optional().describe('Response limit'),
  iteration_count: z.number().nullable().optional().describe('Iteration count'),
  iteration_frequency_days: z.number().nullable().optional().describe('Iteration frequency in days'),
  iteration_start_dates: z.array(z.string()).nullable().optional().describe('Iteration start dates'),
  current_iteration: z.number().nullable().optional().describe('Current iteration number'),
  current_iteration_start_date: z.string().nullable().optional().describe('Current iteration start date'),
  response_sampling_start_date: z.string().nullable().optional().describe('Response sampling start date'),
  response_sampling_interval_type: z.string().nullable().optional().describe('Response sampling interval type'),
  response_sampling_interval: z.number().nullable().optional().describe('Response sampling interval'),
  response_sampling_limit: z.number().nullable().optional().describe('Response sampling limit'),
  response_sampling_daily_limits: z
    .record(z.string(), z.unknown())
    .nullable()
    .optional()
    .describe('Response sampling daily limits'),
  enable_partial_responses: z.boolean().nullable().optional().describe('Enable partial responses'),
  enable_iframe_embedding: z.boolean().nullable().optional().describe('Enable iframe embedding'),
  base_language: z.string().nullable().optional().describe('Base language code'),
  translations: z.record(z.string(), z.unknown()).nullable().optional().describe('Translations object'),
  form_content: z.record(z.string(), z.unknown()).nullable().optional().describe('Form content'),
});

const FlagSchema = z
  .object({
    id: z.number(),
    team_id: z.number(),
    name: z.string(),
    key: z.string(),
    filters: z.record(z.string(), z.unknown()).nullable().optional(),
    deleted: z.boolean(),
    active: z.boolean(),
    ensure_experience_continuity: z.boolean(),
    version: z.number(),
    evaluation_runtime: z.string(),
    bucketing_identifier: z.string(),
    evaluation_contexts: z.array(z.string()),
  })
  .passthrough()
  .nullable()
  .optional();

const CreatedBySchema = z
  .object({
    id: z.number(),
    uuid: z.string(),
    distinct_id: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    email: z.string(),
    is_email_verified: z.boolean(),
    hedgehog_config: z.unknown().nullable().optional(),
    role_at_organization: z.string(),
  })
  .passthrough()
  .nullable()
  .optional();

const SurveySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    type: z.string(),
    schedule: z.string().nullable().optional(),
    linked_flag: FlagSchema,
    linked_flag_id: z.number().nullable().optional(),
    linked_insight_id: z.number().nullable().optional(),
    targeting_flag: FlagSchema,
    internal_targeting_flag: FlagSchema,
    targeting_flag_id: z.number().nullable().optional(),
    targeting_flag_filters: z.record(z.string(), z.unknown()).nullable().optional(),
    remove_targeting_flag: z.boolean().nullable().optional(),
    questions: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
    conditions: z.record(z.string(), z.unknown()).nullable().optional(),
    appearance: z.record(z.string(), z.unknown()).nullable().optional(),
    created_at: z.string(),
    created_by: CreatedBySchema,
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    archived: z.boolean(),
    responses_limit: z.number().nullable().optional(),
    iteration_count: z.number().nullable().optional(),
    iteration_frequency_days: z.number().nullable().optional(),
    iteration_start_dates: z.array(z.string()).nullable().optional(),
    current_iteration: z.number().nullable().optional(),
    current_iteration_start_date: z.string().nullable().optional(),
    response_sampling_start_date: z.string().nullable().optional(),
    response_sampling_interval_type: z.string().nullable().optional(),
    response_sampling_interval: z.number().nullable().optional(),
    response_sampling_limit: z.number().nullable().optional(),
    response_sampling_daily_limits: z.record(z.string(), z.unknown()).nullable().optional(),
    enable_partial_responses: z.boolean().nullable().optional(),
    enable_iframe_embedding: z.boolean().nullable().optional(),
    base_language: z.string().nullable().optional(),
    translations: z.record(z.string(), z.unknown()).nullable().optional(),
    form_content: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .passthrough();

export const updateSurveyOutputSchema = SurveySchema;

export function updateSurveyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_update_survey',
    description: 'Update a survey in PostHog.',
    inputSchema: updateSurveyInputSchema,
    outputSchema: updateSurveyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateSurveyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: Record<string, unknown> = {};

      if (input.name !== undefined) {
        data['name'] = input.name;
      }
      if (input.description !== undefined) {
        data['description'] = input.description;
      }
      if (input.type !== undefined) {
        data['type'] = input.type;
      }
      if (input.schedule !== undefined) {
        data['schedule'] = input.schedule;
      }
      if (input.linked_flag_id !== undefined) {
        data['linked_flag_id'] = input.linked_flag_id;
      }
      if (input.linked_insight_id !== undefined) {
        data['linked_insight_id'] = input.linked_insight_id;
      }
      if (input.targeting_flag_id !== undefined) {
        data['targeting_flag_id'] = input.targeting_flag_id;
      }
      if (input.targeting_flag_filters !== undefined) {
        data['targeting_flag_filters'] = input.targeting_flag_filters;
      }
      if (input.remove_targeting_flag !== undefined) {
        data['remove_targeting_flag'] = input.remove_targeting_flag;
      }
      if (input.questions !== undefined) {
        data['questions'] = input.questions;
      }
      if (input.conditions !== undefined) {
        data['conditions'] = input.conditions;
      }
      if (input.appearance !== undefined) {
        data['appearance'] = input.appearance;
      }
      if (input.start_date !== undefined) {
        data['start_date'] = input.start_date;
      }
      if (input.end_date !== undefined) {
        data['end_date'] = input.end_date;
      }
      if (input.archived !== undefined) {
        data['archived'] = input.archived;
      }
      if (input.responses_limit !== undefined) {
        data['responses_limit'] = input.responses_limit;
      }
      if (input.iteration_count !== undefined) {
        data['iteration_count'] = input.iteration_count;
      }
      if (input.iteration_frequency_days !== undefined) {
        data['iteration_frequency_days'] = input.iteration_frequency_days;
      }
      if (input.iteration_start_dates !== undefined) {
        data['iteration_start_dates'] = input.iteration_start_dates;
      }
      if (input.current_iteration !== undefined) {
        data['current_iteration'] = input.current_iteration;
      }
      if (input.current_iteration_start_date !== undefined) {
        data['current_iteration_start_date'] = input.current_iteration_start_date;
      }
      if (input.response_sampling_start_date !== undefined) {
        data['response_sampling_start_date'] = input.response_sampling_start_date;
      }
      if (input.response_sampling_interval_type !== undefined) {
        data['response_sampling_interval_type'] = input.response_sampling_interval_type;
      }
      if (input.response_sampling_interval !== undefined) {
        data['response_sampling_interval'] = input.response_sampling_interval;
      }
      if (input.response_sampling_limit !== undefined) {
        data['response_sampling_limit'] = input.response_sampling_limit;
      }
      if (input.response_sampling_daily_limits !== undefined) {
        data['response_sampling_daily_limits'] = input.response_sampling_daily_limits;
      }
      if (input.enable_partial_responses !== undefined) {
        data['enable_partial_responses'] = input.enable_partial_responses;
      }
      if (input.enable_iframe_embedding !== undefined) {
        data['enable_iframe_embedding'] = input.enable_iframe_embedding;
      }
      if (input.base_language !== undefined) {
        data['base_language'] = input.base_language;
      }
      if (input.translations !== undefined) {
        data['translations'] = input.translations;
      }
      if (input.form_content !== undefined) {
        data['form_content'] = input.form_content;
      }

      // https://posthog.com/docs/api/surveys
      const response = await platformProxy.patch({
        endpoint: `/api/projects/${encodeURIComponent(String(input.project_id))}/surveys/${encodeURIComponent(input.survey_id)}/`,
        data,
        retries: 1,
      });

      const survey = SurveySchema.parse(response.data);
      return survey;
    },
  });
}
