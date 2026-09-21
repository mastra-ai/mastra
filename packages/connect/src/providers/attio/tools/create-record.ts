// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createRecordInputSchema = z.object({
  object: z.string(),
  values: z.record(z.string(), z.array(z.unknown())),
});

const RecordIdSchema = z.object({
  workspace_id: z.string(),
  object_id: z.string(),
  record_id: z.string(),
});

const CreatedByActorSchema = z.object({
  id: z.string().nullable(),
  type: z.string().nullable(),
});

const ValueSchema = z
  .object({
    active_from: z.string(),
    active_until: z.string().nullable(),
    created_by_actor: CreatedByActorSchema,
    attribute_type: z.string(),
  })
  .passthrough();

const ProviderRecordSchema = z.object({
  id: RecordIdSchema,
  created_at: z.string(),
  web_url: z.string(),
  values: z.record(z.string(), z.array(ValueSchema)),
});

const ProviderResponseSchema = z.object({
  data: ProviderRecordSchema,
});

export const createRecordOutputSchema = z.object({
  id: z.object({
    workspace_id: z.string(),
    object_id: z.string(),
    record_id: z.string(),
  }),
  created_at: z.string(),
  web_url: z.string(),
});

export function createRecordTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_create_record',
    description: 'Create a record in Attio',
    inputSchema: createRecordInputSchema,
    outputSchema: createRecordOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createRecordOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.attio.com/rest-api/endpoint-reference/records/create-a-record
      const response = await platformProxy.post({
        endpoint: `/v2/objects/${input.object}/records`,
        data: {
          data: {
            values: input.values,
          },
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'empty_response',
          message: 'Received empty response from Attio API',
        });
      }

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        id: providerResponse.data.id,
        created_at: providerResponse.data.created_at,
        web_url: providerResponse.data.web_url,
      };
    },
  });
}
