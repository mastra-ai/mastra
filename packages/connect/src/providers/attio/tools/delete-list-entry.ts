// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteListEntryInputSchema = z.object({
  list_id: z
    .string()
    .describe('The ID of the list containing the entry to delete. Example: "39723680-f534-4fe7-ab80-c5278e20e37b"'),
  entry_id: z.string().describe('The ID of the list entry to delete. Example: "e9a7b33a-6dfc-483d-9a3b-fbc20068c162"'),
});

export const deleteListEntryOutputSchema = z.object({
  success: z.boolean(),
  deleted_entry_id: z.string(),
  list_id: z.string(),
});

export function deleteListEntryTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_delete_list_entry',
    description: 'Delete or archive a list entry in Attio',
    inputSchema: deleteListEntryInputSchema,
    outputSchema: deleteListEntryOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteListEntryOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.attio.com/rest-api/reference/delete-v2-lists-list-entries-entry-id
      await platformProxy.delete({
        endpoint: `/v2/lists/${input.list_id}/entries/${input.entry_id}`,
        retries: 3,
      });

      return {
        success: true,
        deleted_entry_id: input.entry_id,
        list_id: input.list_id,
      };
    },
  });
}
