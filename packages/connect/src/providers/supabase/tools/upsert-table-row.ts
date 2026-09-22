// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const upsertTableRowInputSchema = z.object({
  table: z.string().describe('Table name. Example: "nango_test"'),
  row: z
    .record(z.string(), z.unknown())
    .describe('Row object to upsert. Must include the primary key column(s) for conflict detection.'),
  on_conflict: z
    .string()
    .optional()
    .describe('Comma-separated conflict target column(s) if different from the primary key. Example: "name"'),
});

export const upsertTableRowOutputSchema = z.object({
  row: z.record(z.string(), z.unknown()).describe('The upserted row'),
});

export function upsertTableRowTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_upsert_table_row',
    description: 'Insert or update a row in a Supabase table, merging on conflict.',
    inputSchema: upsertTableRowInputSchema,
    outputSchema: upsertTableRowOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof upsertTableRowOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfigSchema = z.object({
        projectUrl: z.string().optional(),
      });
      const connectionConfig = connectionConfigSchema.parse(connection.connection_config || {});
      const baseUrlOverride = connectionConfig.projectUrl
        ? connectionConfig.projectUrl.startsWith('http')
          ? connectionConfig.projectUrl
          : `https://${connectionConfig.projectUrl}`
        : undefined;

      const response = await platformProxy.post({
        // https://supabase.com/docs/reference/api
        endpoint: `/rest/v1/${encodeURIComponent(input.table)}`,
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        params: input.on_conflict ? { on_conflict: input.on_conflict } : {},
        data: input.row,
        baseUrlOverride,
        retries: 3,
      });

      const upsertedRows = z.array(z.record(z.string(), z.unknown())).parse(response.data);
      if (upsertedRows.length === 0) {
        throw new platformProxy.ActionError({
          type: 'upsert_failed',
          message: 'Upsert returned no rows.',
        });
      }

      const firstRow = upsertedRows[0];
      if (!firstRow) {
        throw new platformProxy.ActionError({
          type: 'upsert_failed',
          message: 'Upsert returned no rows.',
        });
      }

      return {
        row: firstRow,
      };
    },
  });
}
