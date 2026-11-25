// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteSegmentInputSchema = z.object({
  segment_id: z.string().describe('The ID of the segment to delete.'),
});

export const deleteSegmentOutputSchema = z.object({
  success: z.boolean().describe('Whether the deletion was accepted.'),
});

export function deleteSegmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_delete_segment',
    description: 'Delete a segment.',
    inputSchema: deleteSegmentInputSchema,
    outputSchema: deleteSegmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteSegmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.twilio.com/docs/sendgrid/api-reference/segmenting-contacts-v2/delete-segment
      const response = await platformProxy.delete({
        endpoint: `/v3/marketing/segments/2.0/${encodeURIComponent(input.segment_id)}`,
        retries: 3,
      });

      return { success: response.status >= 200 && response.status < 300 };
    },
  });
}
