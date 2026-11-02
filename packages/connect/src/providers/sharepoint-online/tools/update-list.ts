// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateListInputSchema = z.object({
  siteId: z
    .string()
    .describe(
      'SharePoint site ID. Example: "contoso.sharepoint.com,550e8400-e29b-41d4-a716-446655440000,6f8d1c89-3b96-41d4-a78c-1234567890ab"',
    ),
  listId: z.string().describe('List ID. Example: "550e8400-e29b-41d4-a716-446655440000"'),
  displayName: z.string().optional().describe('New display name for the list.'),
  description: z.string().optional().describe('New description for the list.'),
});

const ListInfoSchema = z
  .object({
    hidden: z.boolean().optional(),
    template: z.string().optional(),
  })
  .optional();

export const updateListOutputSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  name: z.string().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  eTag: z.string().optional(),
  list: ListInfoSchema,
});

export function updateListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_update_list',
    description: 'Update mutable list properties.',
    inputSchema: updateListInputSchema,
    outputSchema: updateListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {};

      if (input.displayName !== undefined) {
        requestBody['displayName'] = input.displayName;
      }
      if (input.description !== undefined) {
        requestBody['description'] = input.description;
      }

      if (Object.keys(requestBody).length === 0) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'At least one of displayName or description must be provided to update.',
        });
      }

      const response = await platformProxy.patch({
        // https://learn.microsoft.com/graph/api/resources/list
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/lists/${encodeURIComponent(input.listId)}`,
        data: requestBody,
        retries: 3,
      });

      return updateListOutputSchema.parse(response.data);
    },
  });
}
