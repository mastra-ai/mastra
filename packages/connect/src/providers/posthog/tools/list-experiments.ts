// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listExperimentsInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (offset) from the previous response. Omit for the first page.'),
  limit: z.number().int().optional().describe('Number of results per page. Example: 20'),
  status: z.string().optional().describe('Filter by status. One of: all, complete, draft, paused, running, stopped'),
  archived: z.boolean().optional().describe('Filter by archived state'),
  search: z.string().optional().describe('Search query string'),
});

const ProviderExperimentSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  feature_flag_key: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  archived: z.boolean().nullable().optional(),
  deleted: z.boolean().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

const ExperimentSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  feature_flag_key: z.string().optional(),
  status: z.string().optional(),
  archived: z.boolean().optional(),
  deleted: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const listExperimentsOutputSchema = z.object({
  experiments: z.array(ExperimentSchema),
  next_cursor: z.string().optional(),
});

const ListResponseSchema = z.object({
  count: z.number().optional(),
  next: z.string().nullable().optional(),
  previous: z.string().nullable().optional(),
  results: z.array(ProviderExperimentSchema),
});

export function listExperimentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_experiments',
    description: 'List experiments from PostHog.',
    inputSchema: listExperimentsInputSchema,
    outputSchema: listExperimentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listExperimentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};

      if (input.cursor !== undefined) {
        params['offset'] = input.cursor;
      }

      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }

      if (input.status !== undefined) {
        params['status'] = input.status;
      }

      if (input.archived !== undefined) {
        params['archived'] = input.archived ? 'true' : 'false';
      }

      if (input.search !== undefined) {
        params['search'] = input.search;
      }

      const response = await platformProxy.get({
        // https://posthog.com/docs/api/experiments
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/experiments/`,
        params,
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Invalid response from PostHog experiments endpoint',
        });
      }

      const listData = ListResponseSchema.parse(response.data);

      const experiments = listData.results.map(exp => ({
        id: exp.id,
        name: exp.name,
        ...(exp.description != null && { description: exp.description }),
        ...(exp.start_date != null && { start_date: exp.start_date }),
        ...(exp.end_date != null && { end_date: exp.end_date }),
        ...(exp.feature_flag_key != null && { feature_flag_key: exp.feature_flag_key }),
        ...(exp.status != null && { status: exp.status }),
        ...(exp.archived != null && { archived: exp.archived }),
        ...(exp.deleted != null && { deleted: exp.deleted }),
        ...(exp.created_at != null && { created_at: exp.created_at }),
        ...(exp.updated_at != null && { updated_at: exp.updated_at }),
      }));

      let next_cursor: string | undefined;
      if (typeof listData.next === 'string') {
        const offsetMatch = listData.next.match(/[?&]offset=([^&]+)/);
        if (offsetMatch) {
          next_cursor = offsetMatch[1];
        }
      }

      return {
        experiments,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
