// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteTableRowsInputSchema = z.object({
  table: z.string().describe('Name of the table to delete rows from. Example: "nango_test"'),
  filters: z
    .record(z.string(), z.string())
    .describe('PostgREST filters as query parameters. Example: {"name": "eq.del-row-1"}'),
  returnRepresentation: z
    .boolean()
    .optional()
    .describe('If true, adds Prefer: return=representation to return deleted rows'),
});

const DeletedRowSchema = z.record(z.string(), z.unknown());

export const deleteTableRowsOutputSchema = z.object({
  deletedCount: z.number().optional(),
  deletedRows: z.array(DeletedRowSchema).optional(),
});

export function deleteTableRowsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_delete_table_rows',
    description: 'Delete rows from a Supabase table.',
    inputSchema: deleteTableRowsInputSchema,
    outputSchema: deleteTableRowsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteTableRowsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (Object.keys(input.filters).length === 0) {
        throw new platformProxy.ActionError({
          type: 'validation_error',
          message: 'At least one filter is required to delete rows. Unfiltered DELETE affects every row.',
        });
      }

      const connection = await platformProxy.getConnection();
      let projectUrl: string | undefined;
      if (
        connection.connection_config &&
        typeof connection.connection_config === 'object' &&
        'projectUrl' in connection.connection_config &&
        typeof connection.connection_config['projectUrl'] === 'string'
      ) {
        projectUrl = connection.connection_config['projectUrl'];
      }
      const baseUrlOverride = projectUrl
        ? projectUrl.startsWith('http')
          ? projectUrl
          : `https://${projectUrl}`
        : undefined;

      const headers: Record<string, string> = {};
      if (input.returnRepresentation) {
        headers['Prefer'] = 'return=representation';
      }

      // https://supabase.com/docs/reference/api/delete-rows
      const response = await platformProxy.delete({
        endpoint: `/rest/v1/${encodeURIComponent(input.table)}`,
        params: input.filters,
        headers,
        retries: 3,
        baseUrlOverride,
      });

      if (input.returnRepresentation && Array.isArray(response.data)) {
        const deletedRows = response.data.map((row: unknown) => DeletedRowSchema.parse(row));
        return {
          deletedCount: deletedRows.length,
          deletedRows,
        };
      }

      return {};
    },
  });
}
