// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateRecordInputSchema = z.object({
  object: z.string(),
  record_id: z.string(),
  values: z.object({}).passthrough(),
});

const RecordIdSchema = z.object({
  workspace_id: z.string(),
  object_id: z.string(),
  record_id: z.string(),
});

const ProviderRecordSchema = z.object({
  id: RecordIdSchema,
  created_at: z.string(),
  web_url: z.string().nullish(),
  values: z.object({}).passthrough().nullish(),
});

const ProviderResponseSchema = z.object({
  data: ProviderRecordSchema,
});

export const updateRecordOutputSchema = z.object({
  id: z.object({
    workspace_id: z.string(),
    object_id: z.string(),
    record_id: z.string(),
  }),
  created_at: z.string(),
  web_url: z.string().nullish(),
  values: z.object({}).passthrough().nullish(),
});

export function updateRecordTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_update_record',
    description: 'Update a record in Attio.',
    inputSchema: updateRecordInputSchema,
    outputSchema: updateRecordOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateRecordOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.attio.com/rest-api/endpoint-reference/records/update-a-record-append-multiselect-values
      const response = await platformProxy.patch({
        endpoint: `/v2/objects/${input.object}/records/${input.record_id}`,
        data: {
          data: {
            values: input.values,
          },
        },
        retries: 3,
      });

      const parsed = ProviderResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Failed to parse provider response',
          details: parsed.error.issues,
        });
      }

      const record = parsed.data.data;

      return {
        id: record.id,
        created_at: record.created_at,
        ...(record.web_url != null && { web_url: record.web_url }),
        ...(record.values != null && { values: record.values }),
      };
    },
  });
}
