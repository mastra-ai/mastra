// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSurveysInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (offset) from the previous response. Omit for the first page.'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum number of surveys to return per page.'),
  search: z.string().optional().describe('Search query to filter surveys by name.'),
  archived: z.boolean().optional().describe('Filter to archived surveys only.'),
});

const SurveySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.string().optional(),
  schedule: z.string().optional(),
  linked_flag_id: z.number().nullable().optional(),
  linked_insight_id: z.number().nullable().optional(),
  targeting_flag_id: z.number().nullable().optional(),
  questions: z.unknown().nullable().optional(),
  conditions: z.unknown().nullable().optional(),
  appearance: z.unknown().nullable().optional(),
  created_at: z.string().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  responses_limit: z.number().nullable().optional(),
  iteration_count: z.number().nullable().optional(),
  iteration_frequency_days: z.number().nullable().optional(),
  current_iteration: z.number().nullable().optional(),
  current_iteration_start_date: z.string().nullable().optional(),
  enable_partial_responses: z.boolean().nullable().optional(),
  enable_iframe_embedding: z.boolean().nullable().optional(),
  base_language: z.string().nullable().optional(),
  user_access_level: z.string().nullable().optional(),
});

export const listSurveysOutputSchema = z.object({
  items: z.array(SurveySchema),
  next: z.string().optional(),
});

export function listSurveysTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_surveys',
    description: 'List surveys from PostHog.',
    inputSchema: listSurveysInputSchema,
    outputSchema: listSurveysOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSurveysOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input.cursor !== undefined) {
        const offset = parseInt(input.cursor, 10);
        if (Number.isNaN(offset)) {
          throw new platformProxy.ActionError({
            type: 'invalid_cursor',
            message: 'cursor must be a valid offset string',
          });
        }
        params['offset'] = offset;
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }
      if (input.search !== undefined) {
        params['search'] = input.search;
      }
      if (input.archived !== undefined) {
        params['archived'] = String(input.archived);
      }

      const response = await platformProxy.get({
        // https://posthog.com/docs/api/surveys
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/surveys/`,
        params,
        retries: 3,
      });

      const providerResponse = z
        .object({
          count: z.number().optional(),
          next: z.string().nullable().optional(),
          previous: z.string().nullable().optional(),
          results: z.array(z.unknown()),
        })
        .parse(response.data);

      const items = providerResponse.results.map(item => {
        const survey = SurveySchema.parse(item);
        return survey;
      });

      let next: string | undefined;
      if (providerResponse.next) {
        const offsetMatch = providerResponse.next.match(/[?&]offset=([^&]+)/);
        if (offsetMatch && offsetMatch[1]) {
          next = offsetMatch[1];
        }
      }

      return {
        items,
        ...(next !== undefined && { next }),
      };
    },
  });
}
