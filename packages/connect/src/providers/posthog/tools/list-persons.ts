// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listPersonsInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  distinct_id: z.string().optional().describe('Filter by distinct ID.'),
  email: z.string().optional().describe('Filter by email.'),
  search: z.string().optional().describe('Search query string.'),
  properties: z.array(z.unknown()).optional().describe('Filter by properties.'),
  limit: z.number().int().min(1).max(100).optional().describe('Number of results to return per page.'),
});

const ProviderPersonSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  distinct_ids: z.array(z.string()).optional(),
  properties: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string().optional(),
  uuid: z.string().optional(),
  last_seen_at: z.string().nullable().optional(),
});

export const listPersonsOutputSchema = z.object({
  persons: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      distinct_ids: z.array(z.string()).optional(),
      properties: z.record(z.string(), z.unknown()).optional(),
      created_at: z.string().optional(),
      uuid: z.string().optional(),
      last_seen_at: z.string().optional(),
    }),
  ),
  next_cursor: z.string().optional(),
});

export function listPersonsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_persons',
    description: 'List persons from PostHog.',
    inputSchema: listPersonsInputSchema,
    outputSchema: listPersonsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPersonsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const params: Record<string, string | number> = {
        ...(input.cursor !== undefined && { offset: input.cursor }),
        ...(input.distinct_id !== undefined && { distinct_id: input.distinct_id }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.search !== undefined && { search: input.search }),
        ...(input.properties !== undefined && { properties: JSON.stringify(input.properties) }),
        ...(input.limit !== undefined && { limit: input.limit }),
      };

      const config: PlatformProxyRequest = {
        // https://posthog.com/docs/api/persons
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/persons/`,
        params,
        retries: 3,
      };
      const response = await platformProxy.get(config);

      const ProviderListResponseSchema = z.object({
        results: z.array(z.unknown()),
        next: z.string().nullable().optional(),
        previous: z.string().nullable().optional(),
      });

      const providerResponse = ProviderListResponseSchema.parse(response.data);

      const persons: z.infer<typeof listPersonsOutputSchema>['persons'] = [];
      for (const item of providerResponse.results) {
        const parsed = ProviderPersonSchema.safeParse(item);
        if (!parsed.success) {
          continue;
        }
        const person = parsed.data;
        persons.push({
          id: person.id,
          ...(person.name != null && { name: person.name }),
          ...(person.distinct_ids !== undefined && { distinct_ids: person.distinct_ids }),
          ...(person.properties != null && { properties: person.properties }),
          ...(person.created_at !== undefined && { created_at: person.created_at }),
          ...(person.uuid !== undefined && { uuid: person.uuid }),
          ...(person.last_seen_at != null && { last_seen_at: person.last_seen_at }),
        });
      }

      let next_cursor: string | undefined;
      if (providerResponse.next) {
        const match = providerResponse.next.match(/[?&]offset=([^&]+)/);
        if (match && match[1]) {
          next_cursor = decodeURIComponent(match[1]);
        }
      }

      return {
        persons,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
