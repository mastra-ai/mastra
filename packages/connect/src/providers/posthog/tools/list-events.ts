// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listEventsInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  after: z.string().optional().describe('Only fetch events after this ISO 8601 timestamp.'),
  before: z.string().optional().describe('Only fetch events before this ISO 8601 timestamp.'),
  distinct_id: z.string().optional().describe('Filter by distinct_id.'),
  event: z.string().optional().describe('Filter by event name.'),
  limit: z.number().int().optional().describe('Number of results per page.'),
  offset: z.number().int().optional().describe('Offset for pagination.'),
  person_id: z.string().optional().describe('Filter by person_id.'),
  properties: z.string().optional().describe('JSON-encoded property filters.'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response next URL.'),
});

const ProviderEventSchema = z.object({
  id: z.string(),
  distinct_id: z.string(),
  properties: z.record(z.string(), z.unknown()).nullable().optional(),
  event: z.string(),
  timestamp: z.string(),
  person: z.unknown().nullable().optional(),
  elements: z.array(z.unknown()).nullable().optional(),
  elements_chain: z.string().nullable().optional(),
});

const ProviderResponseSchema = z.object({
  next: z.string().nullable().optional(),
  results: z.array(z.unknown()),
});

const EventSchema = z.object({
  id: z.string(),
  distinct_id: z.string(),
  properties: z.record(z.string(), z.unknown()).optional(),
  event: z.string(),
  timestamp: z.string(),
  person: z.unknown().optional(),
  elements: z.array(z.unknown()).optional(),
  elements_chain: z.string().optional(),
});

export const listEventsOutputSchema = z.object({
  events: z.array(EventSchema),
  next_cursor: z.string().optional(),
});

export function listEventsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_events',
    description: 'List events from PostHog.',
    inputSchema: listEventsInputSchema,
    outputSchema: listEventsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listEventsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const params: Record<string, string | number> = {};
      if (input.cursor) {
        const cursorUrl = new URL(input.cursor, 'https://example.com');
        cursorUrl.searchParams.forEach((value, key) => {
          params[key] = value;
        });
      } else {
        if (input.after !== undefined) {
          params['after'] = input.after;
        }
        if (input.before !== undefined) {
          params['before'] = input.before;
        }
        if (input.distinct_id !== undefined) {
          params['distinct_id'] = input.distinct_id;
        }
        if (input.event !== undefined) {
          params['event'] = input.event;
        }
        if (input.limit !== undefined) {
          params['limit'] = input.limit;
        }
        if (input.offset !== undefined) {
          params['offset'] = input.offset;
        }
        if (input.person_id !== undefined) {
          params['person_id'] = input.person_id;
        }
        if (input.properties !== undefined) {
          params['properties'] = input.properties;
        }
      }

      const response = await platformProxy.get({
        // https://posthog.com/docs/api/events
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/events/`,
        params,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);
      const results = z.array(ProviderEventSchema).parse(providerResponse.results);

      return {
        events: results.map(item => ({
          id: item.id,
          distinct_id: item.distinct_id,
          ...(item.properties !== undefined && item.properties !== null && { properties: item.properties }),
          event: item.event,
          timestamp: item.timestamp,
          ...(item.person !== undefined && item.person !== null && { person: item.person }),
          ...(item.elements !== undefined && item.elements !== null && { elements: item.elements }),
          ...(item.elements_chain !== undefined &&
            item.elements_chain !== null && { elements_chain: item.elements_chain }),
        })),
        ...(providerResponse.next != null && { next_cursor: providerResponse.next }),
      };
    },
  });
}
