// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deletePresentationInputSchema = z.object({
  driveId: z.string().describe('Drive ID. Example: "b!123"'),
  itemId: z.string().describe('Item ID of the presentation. Example: "01RFYLAY..."'),
});

export const deletePresentationOutputSchema = z.object({
  success: z.boolean(),
});

export function deletePresentationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_powerpoint_delete_presentation',
    description: 'Delete a presentation.',
    inputSchema: deletePresentationInputSchema,
    outputSchema: deletePresentationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deletePresentationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://learn.microsoft.com/en-us/graph/api/driveitem-delete
        endpoint: `v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}`,
        retries: 10,
      };

      await platformProxy.delete(config);

      return {
        success: true,
      };
    },
  });
}
