// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getChangesStartPageTokenInputSchema = z.object({});

export const getChangesStartPageTokenOutputSchema = z.object({
  startPageToken: z.string().describe('The starting page token for listing future changes'),
});

export function getChangesStartPageTokenTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_get_changes_start_page_token',
    description: 'Get the starting token for listing future changes',
    inputSchema: getChangesStartPageTokenInputSchema,
    outputSchema: getChangesStartPageTokenOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getChangesStartPageTokenOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/getStartPageToken
      const response = await platformProxy.get({
        endpoint: '/drive/v3/changes/startPageToken',
        retries: 3,
      });

      if (!response.data || !response.data.startPageToken) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: 'Failed to get start page token from Google Drive',
        });
      }

      return {
        startPageToken: response.data.startPageToken,
      };
    },
  });
}
