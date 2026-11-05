// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listDrivesInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "contoso.sharepoint.com,abc123"'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const DriveSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    driveType: z.string().optional(),
    createdDateTime: z.string().optional(),
    lastModifiedDateTime: z.string().optional(),
    webUrl: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

export const listDrivesOutputSchema = z.object({
  items: z.array(DriveSchema),
  nextCursor: z.string().optional(),
});

export function listDrivesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_list_drives',
    description: 'List document libraries on a site.',
    inputSchema: listDrivesInputSchema,
    outputSchema: listDrivesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDrivesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input.cursor) {
        params['$skiptoken'] = input.cursor;
      }

      // https://learn.microsoft.com/graph/api/site-list-drives
      const response = await platformProxy.get({
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/drives`,
        params,
        retries: 3,
      });

      const providerResponse = z
        .object({
          value: z.array(z.unknown()),
          '@odata.nextLink': z.string().optional(),
        })
        .parse(response.data);

      const items = providerResponse.value.map(item => {
        return DriveSchema.parse(item);
      });

      let nextCursor: string | undefined;
      if (providerResponse['@odata.nextLink']) {
        const nextLink = providerResponse['@odata.nextLink'];
        const url = new URL(nextLink);
        const skipToken = url.searchParams.get('$skiptoken');
        if (skipToken) {
          nextCursor = skipToken;
        }
      }

      return {
        items,
        ...(nextCursor !== undefined && { nextCursor }),
      };
    },
  });
}
