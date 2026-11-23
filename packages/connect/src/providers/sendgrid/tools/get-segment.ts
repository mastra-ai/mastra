// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getSegmentInputSchema = z.object({
  segment_id: z.string().describe('Segment ID. Example: "994709ee-75dd-497e-bf46-9f337eaad764"'),
});

const ContactSampleSchema = z
  .object({
    id: z.string().optional(),
    email: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
  })
  .passthrough();

export const getSegmentOutputSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    query_dsl: z.string().optional(),
    contacts_count: z.number().optional(),
    contacts_sample: z.array(ContactSampleSchema).optional(),
    next_sample_update: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export function getSegmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_get_segment',
    description: 'Get a single segment by id, including a contact sample.',
    inputSchema: getSegmentInputSchema,
    outputSchema: getSegmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSegmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://www.twilio.com/docs/sendgrid/api-reference/segmenting-contacts-v2/get-segment-by-id
        endpoint: `/v3/marketing/segments/2.0/${encodeURIComponent(input.segment_id)}`,
        retries: 3,
      });

      const segment = getSegmentOutputSchema.parse(response.data);
      return segment;
    },
  });
}
