// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteRecordInputSchema = z.object({
  object_slug: z
    .string()
    .describe(
      'The UUID or slug of the object the record belongs to. Example: "people", "companies", or a custom object UUID.',
    ),
  record_id: z.string().describe('The UUID of the record to delete. Example: "891dcbfc-9141-415d-9b2a-2238a6cc012d"'),
});

const ProviderErrorSchema = z.object({
  status_code: z.number().optional(),
  type: z.string().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
});

export const deleteRecordOutputSchema = z.object({
  success: z.boolean(),
  record_id: z.string(),
  object_slug: z.string(),
});

export function deleteRecordTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_delete_record',
    description: 'Delete or archive a record in Attio.',
    inputSchema: deleteRecordInputSchema,
    outputSchema: deleteRecordOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteRecordOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.attio.com/rest-api/endpoint-reference/records/delete-a-record
      const response = await platformProxy.delete({
        endpoint: `/v2/objects/${input.object_slug}/records/${input.record_id}`,
        retries: 3,
      });

      if (response.status === 404) {
        const errorData = ProviderErrorSchema.safeParse(response.data);
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: errorData.success ? errorData.data.message : 'Record not found',
          object_slug: input.object_slug,
          record_id: input.record_id,
        });
      }

      // Attio returns 200 with empty object on success
      if (response.status !== 200) {
        const errorData = ProviderErrorSchema.safeParse(response.data);
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: errorData.success ? errorData.data.message : `Failed to delete record (status ${response.status})`,
          object_slug: input.object_slug,
          record_id: input.record_id,
        });
      }

      return {
        success: true,
        record_id: input.record_id,
        object_slug: input.object_slug,
      };
    },
  });
}
