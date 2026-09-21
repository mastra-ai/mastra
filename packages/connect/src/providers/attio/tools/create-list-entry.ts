// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createListEntryInputSchema = z.object({
  list: z
    .string()
    .describe('A UUID or slug identifying the list. Example: "seed_list_1" or "39723680-f534-4fe7-ab80-c5278e20e37b"'),
  parent_record_id: z
    .string()
    .describe('A UUID identifying the record to add to the list. Example: "4c6ade84-19c7-4581-95aa-b1d5f4571c25"'),
  parent_object: z
    .string()
    .describe(
      'A UUID or slug identifying the object that the parent record belongs to. Example: "people" or "30ff61f7-6b37-414e-8d6f-fb42f963e996"',
    ),
  entry_values: z
    .record(z.string(), z.unknown())
    .describe(
      'Map of attribute keys (api_slug or attribute_id) to values. For multi-select attributes, use an array of values.',
    ),
});

const ActorSchema = z.object({
  id: z.string().nullable(),
  type: z.enum(['api-token', 'workspace-member', 'system', 'app']).or(z.string()),
});

const EntryValueSchema = z
  .object({
    active_from: z.string(),
    active_until: z.string().nullable(),
    created_by_actor: ActorSchema,
    attribute_type: z.string(),
  })
  .passthrough();

const EntryIdSchema = z.object({
  workspace_id: z.string(),
  list_id: z.string(),
  entry_id: z.string(),
});

const ProviderEntrySchema = z.object({
  id: EntryIdSchema,
  parent_record_id: z.string(),
  parent_object: z.string(),
  created_at: z.string(),
  entry_values: z.record(z.string(), z.array(EntryValueSchema)),
});

const ProviderResponseSchema = z.object({
  data: ProviderEntrySchema,
});

export const createListEntryOutputSchema = z.object({
  id: z.object({
    workspace_id: z.string(),
    list_id: z.string(),
    entry_id: z.string(),
  }),
  parent_record_id: z.string(),
  parent_object: z.string(),
  created_at: z.string(),
});

export function createListEntryTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_create_list_entry',
    description: 'Create a list entry in Attio by adding a record to a list',
    inputSchema: createListEntryInputSchema,
    outputSchema: createListEntryOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createListEntryOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.attio.com/reference/post_v2-lists-list-entries
      const response = await platformProxy.post({
        endpoint: `/v2/lists/${input.list}/entries`,
        data: {
          data: {
            parent_record_id: input.parent_record_id,
            parent_object: input.parent_object,
            entry_values: input.entry_values,
          },
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        id: {
          workspace_id: providerResponse.data.id.workspace_id,
          list_id: providerResponse.data.id.list_id,
          entry_id: providerResponse.data.id.entry_id,
        },
        parent_record_id: providerResponse.data.parent_record_id,
        parent_object: providerResponse.data.parent_object,
        created_at: providerResponse.data.created_at,
      };
    },
  });
}
