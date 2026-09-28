// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPropertyDefinitionsInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  limit: z.number().int().optional().describe('Number of results per page.'),
  search: z.string().optional().describe('Search query string.'),
  type: z
    .enum(['event', 'person', 'group', 'session'])
    .optional()
    .describe('Property type filter. Defaults to "event".'),
  event_names: z.string().optional().describe('Comma-separated event names to filter by.'),
  exclude_core_properties: z.boolean().optional().describe('Exclude core properties.'),
  exclude_hidden: z.boolean().optional().describe('Exclude hidden properties.'),
  is_numerical: z.boolean().optional().describe('Filter to numerical properties only.'),
  verified: z.boolean().optional().describe('Filter to verified properties only.'),
});

const UserSchema = z.object({
  id: z.number().optional(),
  uuid: z.string().optional(),
  distinct_id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().optional(),
  is_email_verified: z.boolean().optional(),
  hedgehog_config: z.record(z.string(), z.unknown()).optional(),
  role_at_organization: z.string().optional(),
});

const PropertyDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string().nullable()).nullable().optional(),
  is_numerical: z.boolean().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  updated_by: UserSchema.nullable().optional(),
  is_seen_on_filtered_events: z.boolean().nullable().optional(),
  property_type: z.string().nullable().optional(),
  verified: z.boolean().nullable().optional(),
  verified_at: z.string().nullable().optional(),
  verified_by: UserSchema.nullable().optional(),
  hidden: z.boolean().nullable().optional(),
});

const ProviderResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable().optional(),
  previous: z.string().nullable().optional(),
  results: z.array(PropertyDefinitionSchema),
});

export const listPropertyDefinitionsOutputSchema = z.object({
  items: z.array(PropertyDefinitionSchema),
  next_cursor: z.string().optional(),
});

export function listPropertyDefinitionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_property_definitions',
    description: 'List property definitions from PostHog.',
    inputSchema: listPropertyDefinitionsInputSchema,
    outputSchema: listPropertyDefinitionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPropertyDefinitionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: { [key: string]: string | number } = {};
      if (input.cursor !== undefined) {
        params['offset'] = input.cursor;
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }
      if (input.search !== undefined) {
        params['search'] = input.search;
      }
      if (input.type !== undefined) {
        params['type'] = input.type;
      }
      if (input.event_names !== undefined) {
        params['event_names'] = input.event_names;
      }
      if (input.exclude_core_properties !== undefined) {
        params['exclude_core_properties'] = String(input.exclude_core_properties);
      }
      if (input.exclude_hidden !== undefined) {
        params['exclude_hidden'] = String(input.exclude_hidden);
      }
      if (input.is_numerical !== undefined) {
        params['is_numerical'] = String(input.is_numerical);
      }
      if (input.verified !== undefined) {
        params['verified'] = String(input.verified);
      }

      // https://posthog.com/docs/api/property-definitions
      const response = await platformProxy.get({
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/property_definitions/`,
        params,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      let next_cursor: string | undefined;
      if (providerResponse.next) {
        const nextUrl = new URL(providerResponse.next, 'http://example.com');
        const nextOffset = nextUrl.searchParams.get('offset');
        if (nextOffset) {
          next_cursor = nextOffset;
        }
      }

      return {
        items: providerResponse.results,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
