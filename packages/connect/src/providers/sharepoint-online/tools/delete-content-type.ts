// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteContentTypeInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'SharePoint site ID. Example: "contoso.sharepoint.com,12345678-1234-1234-1234-123456789012,abcdef12-3456-7890-abcd-ef1234567890"',
    ),
  contentTypeId: z.string().describe('SharePoint content type ID. Example: "0x0101009D1CB325DA4B6BDA4F5C51B469A07A12"'),
});

export const deleteContentTypeOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteContentTypeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_delete_content_type',
    description: 'Delete a content type from a SharePoint site.',
    inputSchema: deleteContentTypeInputSchema,
    outputSchema: deleteContentTypeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteContentTypeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/contenttype-delete
      await platformProxy.delete({
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/contentTypes/${encodeURIComponent(input.contentTypeId)}`,
        retries: 3,
      });

      return { success: true };
    },
  });
}
