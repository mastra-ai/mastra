// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const SurveyQuestionSchema = z.object({
  type: z.string().describe('Question type. Examples: "open", "multiple_choice", "single_choice", "rating", "link"'),
  question: z.string().describe('The question text.'),
  id: z.string().optional(),
  description: z.string().nullable().optional(),
  optional: z.boolean().optional(),
  buttonText: z.string().optional(),
  display: z.string().optional().describe('For rating questions. Examples: "number", "emoji"'),
  scale: z.number().optional().describe('For rating questions. Examples: 2, 3, 5, 7, 10'),
  lowerBoundLabel: z.string().optional(),
  upperBoundLabel: z.string().optional(),
  choices: z.array(z.string()).optional().describe('For multiple/single choice questions.'),
  link: z.string().nullable().optional().describe('For link questions.'),
  hasOpenChoice: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
});

export const createSurveyInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  name: z.string().describe('Name of the survey.'),
  type: z.string().describe('Survey type. Examples: "popover", "api", "widget", "external_survey"'),
  description: z.string().optional(),
  questions: z.array(SurveyQuestionSchema).optional(),
  appearance: z.record(z.string(), z.unknown()).optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  start_date: z.string().nullable().optional().describe('ISO 8601 timestamp. Example: "2024-01-01T00:00:00Z"'),
  end_date: z.string().nullable().optional().describe('ISO 8601 timestamp. Example: "2024-12-31T23:59:59Z"'),
  linked_flag_id: z.number().nullable().optional(),
  linked_insight_id: z.number().nullable().optional(),
  targeting_flag_filters: z.record(z.string(), z.unknown()).optional(),
  archived: z.boolean().optional(),
  schedule: z.string().nullable().optional(),
});

const ProviderUserSchema = z.object({
  id: z.number(),
  uuid: z.string().optional(),
  distinct_id: z.string().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

const ProviderSurveySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  type: z.string(),
  schedule: z.string().nullable().optional(),
  linked_flag_id: z.number().nullable().optional(),
  linked_insight_id: z.number().nullable().optional(),
  targeting_flag_id: z.number().nullable().optional(),
  targeting_flag_filters: z.unknown().nullable().optional(),
  remove_targeting_flag: z.boolean().nullable().optional(),
  questions: z.array(z.unknown()).nullable().optional(),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
  appearance: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string(),
  created_by: ProviderUserSchema.nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  archived: z.boolean().nullable().optional(),
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
  response_sampling_daily_limits: z.unknown().nullable().optional(),
  enable_partial_responses: z.boolean().nullable().optional(),
  enable_iframe_embedding: z.boolean().nullable().optional(),
  base_language: z.string().nullable().optional(),
  translations: z.unknown().nullable().optional(),
  user_access_level: z.string().nullable().optional(),
  form_content: z.unknown().nullable().optional(),
});

export const createSurveyOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.string(),
  schedule: z.string().optional(),
  linked_flag_id: z.number().optional(),
  linked_insight_id: z.number().optional(),
  targeting_flag_id: z.number().optional(),
  questions: z.array(z.unknown()).optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  appearance: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  archived: z.boolean().optional(),
});

export function createSurveyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_create_survey',
    description: 'Create a survey in PostHog.',
    inputSchema: createSurveyInputSchema,
    outputSchema: createSurveyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSurveyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://posthog.com/docs/api/surveys
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/surveys/`,
        data: {
          name: input.name,
          type: input.type,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.questions !== undefined && { questions: input.questions }),
          ...(input.appearance !== undefined && { appearance: input.appearance }),
          ...(input.conditions !== undefined && { conditions: input.conditions }),
          ...(input.start_date !== undefined && { start_date: input.start_date }),
          ...(input.end_date !== undefined && { end_date: input.end_date }),
          ...(input.linked_flag_id !== undefined && { linked_flag_id: input.linked_flag_id }),
          ...(input.linked_insight_id !== undefined && { linked_insight_id: input.linked_insight_id }),
          ...(input.targeting_flag_filters !== undefined && { targeting_flag_filters: input.targeting_flag_filters }),
          ...(input.archived !== undefined && { archived: input.archived }),
          ...(input.schedule !== undefined && { schedule: input.schedule }),
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'PostHog did not return survey data.',
        });
      }

      const providerSurvey = ProviderSurveySchema.parse(response.data);

      return {
        id: providerSurvey.id,
        name: providerSurvey.name,
        ...(providerSurvey.description != null && { description: providerSurvey.description }),
        type: providerSurvey.type,
        ...(providerSurvey.schedule != null && { schedule: providerSurvey.schedule }),
        ...(providerSurvey.linked_flag_id != null && { linked_flag_id: providerSurvey.linked_flag_id }),
        ...(providerSurvey.linked_insight_id != null && { linked_insight_id: providerSurvey.linked_insight_id }),
        ...(providerSurvey.targeting_flag_id != null && { targeting_flag_id: providerSurvey.targeting_flag_id }),
        ...(providerSurvey.questions != null && { questions: providerSurvey.questions }),
        ...(providerSurvey.conditions != null && { conditions: providerSurvey.conditions }),
        ...(providerSurvey.appearance != null && { appearance: providerSurvey.appearance }),
        created_at: providerSurvey.created_at,
        ...(providerSurvey.start_date != null && { start_date: providerSurvey.start_date }),
        ...(providerSurvey.end_date != null && { end_date: providerSurvey.end_date }),
        ...(providerSurvey.archived != null && { archived: providerSurvey.archived }),
      };
    },
  });
}
