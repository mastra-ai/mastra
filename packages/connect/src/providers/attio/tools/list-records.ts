// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listRecordsInputSchema = z.object({
  object: z.string(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

const RecordValueSchema = z.object({
  active_from: z.string(),
  active_until: z.string().nullable().optional(),
  attribute_type: z.string(),
  created_at: z.string().optional(),
  record_id: z.string().optional(),
  updated_at: z.string().optional(),
  value: z.unknown().optional(),
});

const RecordSchema = z.object({
  id: z.object({
    record_id: z.string(),
    object_id: z.string(),
  }),
  created_at: z.string(),
  values: z.record(z.string(), z.array(RecordValueSchema)).optional(),
});

const ProviderResponseSchema = z.object({
  data: z.array(RecordSchema),
  next_cursor: z.string().optional(),
  next_starting_after: z.string().optional(),
});

const RecordValueOutputSchema = z.object({
  active_from: z.string(),
  active_until: z.string().optional(),
  attribute_type: z.string(),
  created_at: z.string().optional(),
  record_id: z.string().optional(),
  updated_at: z.string().optional(),
  value: z.unknown().optional(),
});

export const listRecordsOutputSchema = z.object({
  records: z.array(
    z.object({
      id: z.string(),
      object_id: z.string(),
      created_at: z.string(),
      values: z.record(z.string(), z.array(RecordValueOutputSchema)).optional(),
    }),
  ),
  next_cursor: z.string().optional(),
});

export function listRecordsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_list_records',
    description: 'List records from Attio',
    inputSchema: listRecordsInputSchema,
    outputSchema: listRecordsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listRecordsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: {
        limit?: number;
        starting_after?: string;
        filter?: Record<string, unknown>;
      } = {
        ...(input.limit && { limit: input.limit }),
        ...(input.cursor && { starting_after: input.cursor }),
        ...(input.filters && { filter: input.filters }),
      };

      // https://docs.attio.com/rest-api/records/query-records
      const response = await platformProxy.post({
        endpoint: `/v2/objects/${input.object}/records/query`,
        data: requestBody,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        records: providerResponse.data.map(record => {
          const mappedValues: Record<string, z.infer<typeof RecordValueOutputSchema>[]> = {};
          if (record.values) {
            const entries = Object.entries(record.values);
            for (const [key, values] of entries) {
              const validatedValues = z.array(RecordValueSchema).parse(values);
              mappedValues[key] = validatedValues.map(value => {
                const output: z.infer<typeof RecordValueOutputSchema> = {
                  active_from: value.active_from,
                  attribute_type: value.attribute_type,
                };
                if (value.active_until != null) {
                  output.active_until = value.active_until;
                }
                if (value.created_at != null) {
                  output.created_at = value.created_at;
                }
                if (value.record_id != null) {
                  output.record_id = value.record_id;
                }
                if (value.updated_at != null) {
                  output.updated_at = value.updated_at;
                }
                if (value.value !== undefined) {
                  output.value = value.value;
                }
                return output;
              });
            }
          }

          return {
            id: record.id.record_id,
            object_id: record.id.object_id,
            created_at: record.created_at,
            ...(Object.keys(mappedValues).length > 0 && { values: mappedValues }),
          };
        }),
        ...(providerResponse.next_cursor != null && { next_cursor: providerResponse.next_cursor }),
      };
    },
  });
}
