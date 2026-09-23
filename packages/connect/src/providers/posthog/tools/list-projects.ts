// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listProjectsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination offset from the previous response. Omit for the first page.'),
  limit: z.number().optional().describe('Number of results to return per page.'),
  search: z.string().optional().describe('Search query string.'),
});

const ProviderProjectSchema = z.object({
  id: z.number(),
  uuid: z.string(),
  organization: z.string(),
  api_token: z.string(),
  name: z.string(),
  completed_snippet_onboarding: z.boolean().nullish(),
  has_completed_onboarding_for: z.unknown().nullish(),
  ingested_event: z.boolean().nullish(),
  is_demo: z.boolean().nullish(),
  timezone: z.string().nullish(),
  access_control: z.boolean().nullish(),
});

const ProviderListResponseSchema = z.object({
  count: z.number().optional(),
  next: z.string().nullish(),
  previous: z.string().nullish(),
  results: z.array(z.unknown()),
});

const OutputProjectSchema = z.object({
  id: z.number(),
  uuid: z.string(),
  organization: z.string(),
  api_token: z.string(),
  name: z.string(),
  completed_snippet_onboarding: z.boolean().optional(),
  has_completed_onboarding_for: z.unknown().optional(),
  ingested_event: z.boolean().optional(),
  is_demo: z.boolean().optional(),
  timezone: z.string().optional(),
  access_control: z.boolean().optional(),
});

export const listProjectsOutputSchema = z.object({
  items: z.array(OutputProjectSchema),
  next_cursor: z.string().optional(),
});

export function listProjectsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_projects',
    description: 'List projects from PostHog',
    inputSchema: listProjectsInputSchema,
    outputSchema: listProjectsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listProjectsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const offset = input.cursor ? parseInt(input.cursor, 10) : 0;
      if (isNaN(offset)) {
        throw new platformProxy.ActionError({
          type: 'invalid_cursor',
          message: 'Cursor must be a valid offset number',
        });
      }

      const response = await platformProxy.get({
        // https://posthog.com/docs/api/projects
        endpoint: '/api/projects/',
        params: {
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.cursor !== undefined && { offset: String(offset) }),
          ...(input.search !== undefined && { search: input.search }),
        },
        retries: 3,
      });

      const providerResponse = ProviderListResponseSchema.parse(response.data);
      const results = providerResponse.results;
      const nextCursor = providerResponse.next != null ? String(offset + results.length) : undefined;

      const items = results.map(item => {
        const project = ProviderProjectSchema.parse(item);
        return {
          id: project.id,
          uuid: project.uuid,
          organization: project.organization,
          api_token: project.api_token,
          name: project.name,
          ...(project.completed_snippet_onboarding != null && {
            completed_snippet_onboarding: project.completed_snippet_onboarding,
          }),
          ...(project.has_completed_onboarding_for != null && {
            has_completed_onboarding_for: project.has_completed_onboarding_for,
          }),
          ...(project.ingested_event != null && { ingested_event: project.ingested_event }),
          ...(project.is_demo != null && { is_demo: project.is_demo }),
          ...(project.timezone != null && { timezone: project.timezone }),
          ...(project.access_control != null && { access_control: project.access_control }),
        };
      });

      return {
        items,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
