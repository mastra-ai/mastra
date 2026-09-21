// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getRecordInputSchema = z.object({
  object: z.string().describe('A UUID or slug to identify the object. Example: "people"'),
  record_id: z.string().describe('UUID of the record to retrieve. Example: "4c6ade84-19c7-4581-95aa-b1d5f4571c25"'),
});

const RecordIdSchema = z.object({
  workspace_id: z.string(),
  object_id: z.string(),
  record_id: z.string(),
});

const ValueItemSchema = z
  .object({
    active_from: z.string(),
    active_until: z.string().nullable().optional(),
    created_by_actor: z.object({
      id: z.string().nullable().optional(),
      type: z.string().nullable().optional(),
    }),
    attribute_type: z.string(),
  })
  .passthrough();

const ArrayOfValueItemsSchema = z.array(ValueItemSchema);

const ProviderRecordSchema = z.object({
  id: RecordIdSchema,
  created_at: z.string(),
  web_url: z.string(),
  values: z.record(z.string(), ArrayOfValueItemsSchema),
});

export const getRecordOutputSchema = z.object({
  id: RecordIdSchema,
  created_at: z.string(),
  web_url: z.string(),
  values: z.record(z.string(), ArrayOfValueItemsSchema),
});

export function getRecordTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_get_record',
    description: 'Retrieve a single record from Attio.',
    inputSchema: getRecordInputSchema,
    outputSchema: getRecordOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getRecordOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.attio.com/rest-api/endpoint-reference/records/get-a-record
      const response = await platformProxy.get({
        endpoint: `/v2/objects/${input.object}/records/${input.record_id}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Record not found',
          object: input.object,
          record_id: input.record_id,
        });
      }

      if (!response.data || typeof response.data !== 'object' || !('data' in response.data)) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from API',
        });
      }

      const providerRecord = ProviderRecordSchema.parse(response.data.data);

      return {
        id: providerRecord.id,
        created_at: providerRecord.created_at,
        web_url: providerRecord.web_url,
        values: providerRecord.values,
      };
    },
  });
}
