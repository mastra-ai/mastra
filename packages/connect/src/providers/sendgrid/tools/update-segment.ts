// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateSegmentInputSchema = z.object({
  segment_id: z.string().describe('The ID of the segment to update. Example: "994709ee-75dd-497e-bf46-9f337eaad764"'),
  name: z.string().min(1).max(100).optional().describe('New name for the segment. Must be unique.'),
  query_dsl: z
    .string()
    .optional()
    .describe(
      'New SQL query for the segment. Example: "SELECT contact_id, updated_at FROM contact_data WHERE email LIKE \'%gmail.com\'"',
    ),
});

const ProviderSegmentStatusSchema = z.object({
  query_validation: z.string(),
  error_message: z.string().nullable().optional(),
});

const ProviderSegmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  query_dsl: z.string(),
  contacts_count: z.number().int().optional(),
  contacts_sample: z.array(z.unknown()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  sample_updated_at: z.string().nullish(),
  next_sample_update: z.string().nullish(),
  parent_list_ids: z.array(z.string()).nullish(),
  query_version: z.string().optional(),
  status: ProviderSegmentStatusSchema.optional(),
  refreshes_used: z.number().int().optional(),
  max_refreshes: z.number().int().optional(),
  last_refreshed_at: z.string().nullish(),
});

export const updateSegmentOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  query_dsl: z.string(),
  contacts_count: z.number().int().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  sample_updated_at: z.string().optional(),
  next_sample_update: z.string().optional(),
  parent_list_ids: z.array(z.string()).optional(),
  query_version: z.string().optional(),
  status: ProviderSegmentStatusSchema.optional(),
  refreshes_used: z.number().int().optional(),
  max_refreshes: z.number().int().optional(),
  last_refreshed_at: z.string().optional(),
});

export function updateSegmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_update_segment',
    description: "Update a segment's name or query.",
    inputSchema: updateSegmentInputSchema,
    outputSchema: updateSegmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateSegmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.twilio.com/docs/sendgrid/api-reference/segmenting-contacts-v2/update-segment
      const response = await platformProxy.patch({
        endpoint: `/v3/marketing/segments/2.0/${encodeURIComponent(input.segment_id)}`,
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.query_dsl !== undefined && { query_dsl: input.query_dsl }),
        },
        retries: 3,
      });

      const segment = ProviderSegmentSchema.parse(response.data);

      return {
        id: segment.id,
        name: segment.name,
        query_dsl: segment.query_dsl,
        ...(segment.contacts_count != null && { contacts_count: segment.contacts_count }),
        ...(segment.created_at != null && { created_at: segment.created_at }),
        ...(segment.updated_at != null && { updated_at: segment.updated_at }),
        ...(segment.sample_updated_at != null && { sample_updated_at: segment.sample_updated_at }),
        ...(segment.next_sample_update != null && { next_sample_update: segment.next_sample_update }),
        ...(segment.parent_list_ids != null && { parent_list_ids: segment.parent_list_ids }),
        ...(segment.query_version != null && { query_version: segment.query_version }),
        ...(segment.status != null && { status: segment.status }),
        ...(segment.refreshes_used != null && { refreshes_used: segment.refreshes_used }),
        ...(segment.max_refreshes != null && { max_refreshes: segment.max_refreshes }),
        ...(segment.last_refreshed_at != null && { last_refreshed_at: segment.last_refreshed_at }),
      };
    },
  });
}
