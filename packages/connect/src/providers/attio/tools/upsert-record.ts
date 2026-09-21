// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const upsertRecordInputSchema = z.object({
  object: z.string().describe('A UUID or slug to identify the object the record belongs to. Example: people'),
  matching_attribute: z
    .string()
    .describe('The ID or slug of the attribute to use to check if a record already exists. Example: email_addresses'),
  values: z
    .record(z.string(), z.array(z.unknown()))
    .describe('An object with attribute api_slug or attribute_id as the key, and an array of values as the values.'),
});

const ProviderRecordIdSchema = z.object({
  workspace_id: z.string(),
  object_id: z.string(),
  record_id: z.string(),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    id: ProviderRecordIdSchema,
    created_at: z.unknown().optional(),
    values: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const upsertRecordOutputSchema = z.object({
  workspace_id: z.string(),
  object_id: z.string(),
  record_id: z.string(),
  created_at: z.unknown().optional(),
  values: z.record(z.string(), z.unknown()).optional(),
});

export function upsertRecordTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_upsert_record',
    description: 'Create or update a record in Attio by matching attribute value.',
    inputSchema: upsertRecordInputSchema,
    outputSchema: upsertRecordOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof upsertRecordOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.put({
        // https://docs.attio.com/rest-api/endpoint-reference/records/assert-a-record
        endpoint: `/v2/objects/${encodeURIComponent(input.object)}/records`,
        params: {
          matching_attribute: input.matching_attribute,
        },
        data: {
          data: {
            values: input.values,
          },
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        workspace_id: providerResponse.data.id.workspace_id,
        object_id: providerResponse.data.id.object_id,
        record_id: providerResponse.data.id.record_id,
        ...(providerResponse.data.created_at != null && { created_at: providerResponse.data.created_at }),
        ...(providerResponse.data.values != null && { values: providerResponse.data.values }),
      };
    },
  });
}
