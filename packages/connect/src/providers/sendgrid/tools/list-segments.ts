// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const SegmentStatusSchema = z.object({
  query_validation: z.string(),
  error_message: z.string().optional(),
});

const SegmentSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  contacts_count: z.number(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  sample_updated_at: z.string().optional(),
  next_sample_update: z.string().optional(),
  parent_list_ids: z.array(z.string()).optional(),
  query_version: z.string().optional(),
  status: SegmentStatusSchema.optional(),
});

export const listSegmentsInputSchema = z.object({
  ids: z.array(z.string()).optional().describe('Segment IDs to retrieve. When included, other filters are ignored.'),
  parent_list_ids: z.string().optional().describe('Comma-separated list IDs to filter segments by parent list.'),
  no_parent_list_id: z.boolean().optional().describe('Include segments with no parent list ID.'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (the full next-page URL) from the previous response. Omit for the first page.'),
});

export const listSegmentsOutputSchema = z.object({
  results: z.array(SegmentSchema),
  next_cursor: z.string().optional(),
});

export function listSegmentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_list_segments',
    description: 'List segments (Segmentation v2).',
    inputSchema: listSegmentsInputSchema,
    outputSchema: listSegmentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSegmentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // The endpoint is always the fixed segments collection — only the query parameters from a
      // previous response's opaque next-page URL are reused, so a caller cannot redirect this
      // action's authenticated request to an arbitrary SendGrid path via `cursor`.
      let params: Record<string, string>;

      if (input.cursor) {
        const cursorUrl = new URL(input.cursor);
        const queryParams: Record<string, string> = {};
        cursorUrl.searchParams.forEach((value, key) => {
          queryParams[key] = value;
        });
        params = queryParams;
      } else {
        params = {
          ...(input.ids !== undefined && input.ids.length > 0 && { ids: input.ids.join(',') }),
          ...(input.parent_list_ids !== undefined &&
            input.parent_list_ids.length > 0 && { parent_list_ids: input.parent_list_ids }),
          ...(input.no_parent_list_id !== undefined && { no_parent_list_id: String(input.no_parent_list_id) }),
        };
      }

      // https://www.twilio.com/docs/sendgrid/api-reference/segmenting-contacts-v2/get-list-of-segments
      const response = await platformProxy.get({
        endpoint: '/v3/marketing/segments/2.0',
        params,
        retries: 3,
      });

      const raw = response.data;

      if (typeof raw !== 'object' || raw === null || !('results' in raw)) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response shape from SendGrid segments API.',
        });
      }

      const providerResponse = z
        .object({
          results: z.array(z.unknown()),
          _metadata: z.object({ next: z.string().optional() }).optional(),
        })
        .parse(raw);

      const results = providerResponse.results.map((item: unknown) => {
        const segment = z
          .object({
            id: z.string(),
            name: z.string().nullable().optional(),
            contacts_count: z.number(),
            created_at: z.string().nullable().optional(),
            updated_at: z.string().nullable().optional(),
            sample_updated_at: z.string().nullable().optional(),
            next_sample_update: z.string().nullable().optional(),
            parent_list_ids: z.array(z.string()).nullable().optional(),
            query_version: z.string().nullable().optional(),
            status: z
              .object({
                query_validation: z.string(),
                error_message: z.string().nullable().optional(),
              })
              .nullable()
              .optional(),
          })
          .parse(item);

        return {
          id: segment.id,
          ...(segment.name != null && { name: segment.name }),
          contacts_count: segment.contacts_count,
          ...(segment.created_at != null && { created_at: segment.created_at }),
          ...(segment.updated_at != null && { updated_at: segment.updated_at }),
          ...(segment.sample_updated_at != null && { sample_updated_at: segment.sample_updated_at }),
          ...(segment.next_sample_update != null && { next_sample_update: segment.next_sample_update }),
          ...(segment.parent_list_ids != null && { parent_list_ids: segment.parent_list_ids }),
          ...(segment.query_version != null && { query_version: segment.query_version }),
          ...(segment.status != null && {
            status: {
              query_validation: segment.status.query_validation,
              ...(segment.status.error_message != null && { error_message: segment.status.error_message }),
            },
          }),
        };
      });

      return {
        results,
        ...(providerResponse._metadata?.next !== undefined && { next_cursor: providerResponse._metadata.next }),
      };
    },
  });
}
