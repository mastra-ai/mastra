// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listAnnotationsInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination offset cursor from the previous response. Omit for the first page.'),
  limit: z.number().optional().describe('Number of results to return per page.'),
  search: z.string().optional().describe('Search query string to filter annotations.'),
});

const CreatedBySchema = z.object({
  id: z.number(),
  uuid: z.string(),
  distinct_id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().optional(),
  is_email_verified: z.boolean().optional(),
  hedgehog_config: z.record(z.string(), z.unknown()).nullable().optional(),
  role_at_organization: z.string().optional(),
});

const ProviderAnnotationSchema = z.object({
  id: z.number(),
  content: z.string().nullable().optional(),
  date_marker: z.string().nullable().optional(),
  creation_type: z.string().optional(),
  dashboard_item: z.number().nullable().optional(),
  dashboard_id: z.number().nullable().optional(),
  dashboard_name: z.string().nullable().optional(),
  insight_short_id: z.string().nullable().optional(),
  insight_name: z.string().nullable().optional(),
  insight_derived_name: z.string().nullable().optional(),
  created_by: CreatedBySchema.nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted: z.boolean().optional(),
  scope: z.string().optional(),
});

const ProviderListResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable().optional(),
  previous: z.string().nullable().optional(),
  results: z.array(ProviderAnnotationSchema),
});

const OutputAnnotationSchema = z.object({
  id: z.number(),
  content: z.string().optional(),
  date_marker: z.string().optional(),
  creation_type: z.string().optional(),
  dashboard_item: z.number().optional(),
  dashboard_id: z.number().optional(),
  dashboard_name: z.string().optional(),
  insight_short_id: z.string().optional(),
  insight_name: z.string().optional(),
  insight_derived_name: z.string().optional(),
  created_by: z
    .object({
      id: z.number(),
      uuid: z.string(),
      distinct_id: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
      is_email_verified: z.boolean().optional(),
      hedgehog_config: z.record(z.string(), z.unknown()).nullable().optional(),
      role_at_organization: z.string().optional(),
    })
    .optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted: z.boolean().optional(),
  scope: z.string().optional(),
});

export const listAnnotationsOutputSchema = z.object({
  results: z.array(OutputAnnotationSchema),
  next_cursor: z.string().optional(),
});

export function listAnnotationsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_annotations',
    description: 'List annotations from PostHog.',
    inputSchema: listAnnotationsInputSchema,
    outputSchema: listAnnotationsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listAnnotationsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const params: Record<string, string | number> = {};
      if (input.cursor !== undefined) {
        params['offset'] = parseInt(input.cursor, 10);
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }
      if (input.search !== undefined) {
        params['search'] = input.search;
      }

      // https://posthog.com/docs/api/annotations
      const response = await platformProxy.get({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/annotations/`,
        params,
        retries: 3,
      });

      const providerResponse = ProviderListResponseSchema.parse(response.data);

      const results = providerResponse.results.map(annotation => {
        return {
          id: annotation.id,
          ...(annotation.content != null && { content: annotation.content }),
          ...(annotation.date_marker != null && { date_marker: annotation.date_marker }),
          ...(annotation.creation_type !== undefined && { creation_type: annotation.creation_type }),
          ...(annotation.dashboard_item != null && { dashboard_item: annotation.dashboard_item }),
          ...(annotation.dashboard_id != null && { dashboard_id: annotation.dashboard_id }),
          ...(annotation.dashboard_name != null && { dashboard_name: annotation.dashboard_name }),
          ...(annotation.insight_short_id != null && { insight_short_id: annotation.insight_short_id }),
          ...(annotation.insight_name != null && { insight_name: annotation.insight_name }),
          ...(annotation.insight_derived_name != null && { insight_derived_name: annotation.insight_derived_name }),
          ...(annotation.created_by != null && { created_by: annotation.created_by }),
          ...(annotation.created_at !== undefined && { created_at: annotation.created_at }),
          ...(annotation.updated_at !== undefined && { updated_at: annotation.updated_at }),
          ...(annotation.deleted !== undefined && { deleted: annotation.deleted }),
          ...(annotation.scope !== undefined && { scope: annotation.scope }),
        };
      });

      let next_cursor: string | undefined;
      if (providerResponse.next) {
        const nextUrl = new URL(providerResponse.next);
        const nextOffset = nextUrl.searchParams.get('offset');
        if (nextOffset) {
          next_cursor = nextOffset;
        }
      }

      return {
        results,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
