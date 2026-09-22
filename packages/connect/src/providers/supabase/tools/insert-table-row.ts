// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const insertTableRowInputSchema = z.object({
  table: z.string().describe('The table name to insert into. Example: "nango_test"'),
  row: z
    .record(z.string(), z.unknown())
    .describe('The row object to insert. Example: {"name": "new-record", "value": "delta"}'),
});

export const insertTableRowOutputSchema = z.array(z.record(z.string(), z.unknown()));

const ConnectionConfigSchema = z.object({
  projectUrl: z.string().optional(),
});

export function insertTableRowTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_insert_table_row',
    description: 'Insert a row into a Supabase table.',
    inputSchema: insertTableRowInputSchema,
    outputSchema: insertTableRowOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof insertTableRowOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = ConnectionConfigSchema.parse(connection.connection_config || {});
      const rawUrl = connectionConfig.projectUrl;
      const baseUrlOverride = rawUrl ? (rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`) : undefined;

      if (!baseUrlOverride) {
        throw new platformProxy.ActionError({
          type: 'invalid_connection_config',
          message: 'Missing projectUrl in connection configuration.',
        });
      }

      // https://supabase.com/docs/reference/api/postgrest-v1-insert-row
      const response = await platformProxy.post({
        endpoint: `/rest/v1/${encodeURIComponent(input.table)}`,
        data: input.row,
        headers: {
          Prefer: 'return=representation',
        },
        baseUrlOverride,
        retries: 1,
      });

      return insertTableRowOutputSchema.parse(response.data);
    },
  });
}
