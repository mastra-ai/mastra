// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateListEntryInputSchema = z.object({
  list_id: z
    .string()
    .describe('A UUID or slug of the list the entry belongs to. Example: "39723680-f534-4fe7-ab80-c5278e20e37b"'),
  entry_id: z.string().describe('A UUID of the list entry to update. Example: "e9a7b33a-6dfc-483d-9a3b-fbc20068c162"'),
  entry_values: z
    .record(z.string(), z.unknown())
    .describe('An object mapping attribute API slugs or IDs to values to update.'),
});

const CreatedByActorSchema = z.object({
  id: z.string().nullable(),
  type: z.enum(['api-token', 'workspace-member', 'system', 'app']).or(z.string()).nullable(),
});

const EntryValueSchema = z
  .object({
    active_from: z.string(),
    active_until: z.string().nullable(),
    created_by_actor: CreatedByActorSchema,
    attribute_type: z.string(),
  })
  .passthrough();

export const updateListEntryOutputSchema = z.object({
  id: z.object({
    workspace_id: z.string(),
    list_id: z.string(),
    entry_id: z.string(),
  }),
  parent_record_id: z.string(),
  parent_object: z.string(),
  created_at: z.string(),
  entry_values: z.record(z.string(), z.array(EntryValueSchema)),
});

const ProviderResponseSchema = z.object({
  data: updateListEntryOutputSchema,
});

export function updateListEntryTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_update_list_entry',
    description: 'Update a list entry in Attio.',
    inputSchema: updateListEntryInputSchema,
    outputSchema: updateListEntryOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateListEntryOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://docs.attio.com/rest-api/endpoint-reference/list-entries/update-a-list-entry
        endpoint: `/v2/lists/${input.list_id}/entries/${input.entry_id}`,
        data: {
          data: {
            entry_values: input.entry_values,
          },
        },
        retries: 3,
      });

      const parsed = ProviderResponseSchema.parse(response.data);

      return parsed.data;
    },
  });
}
