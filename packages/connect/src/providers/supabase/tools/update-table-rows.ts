// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateTableRowsInputSchema = z.object({
  table: z.string().min(1).describe('Table name to update. Example: "nango_test"'),
  updates: z.record(z.string(), z.unknown()).describe('Object containing column updates.'),
  filters: z
    .record(z.string(), z.string())
    .describe('PostgREST filters as query params. Example: {"id":"eq.964cc467-144e-4215-b7d0-d124607a6d72"}'),
});

const ConnectionConfigSchema = z
  .object({
    projectUrl: z.string().optional(),
  })
  .passthrough();

const ProviderRowSchema = z.record(z.string(), z.unknown());

export const updateTableRowsOutputSchema = z.array(ProviderRowSchema);

export function updateTableRowsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_update_table_rows',
    description: 'Update rows in a Supabase table.',
    inputSchema: updateTableRowsInputSchema,
    outputSchema: updateTableRowsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateTableRowsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (Object.keys(input.filters).length === 0) {
        throw new platformProxy.ActionError({
          type: 'validation_error',
          message: 'At least one filter is required to prevent updating all rows.',
        });
      }

      const connection = await platformProxy.getConnection();
      const rawConfig =
        typeof connection.connection_config === 'object' && connection.connection_config !== null
          ? connection.connection_config
          : {};
      const connectionConfig = ConnectionConfigSchema.parse(rawConfig);
      const projectUrl = connectionConfig.projectUrl;
      const baseUrlOverride = projectUrl
        ? projectUrl.startsWith('http')
          ? projectUrl
          : `https://${projectUrl}`
        : undefined;

      // https://supabase.com/docs/reference/api/patch-tablerows
      const response = await platformProxy.patch({
        endpoint: `/rest/v1/${encodeURIComponent(input.table)}`,
        params: input.filters,
        headers: {
          Prefer: 'return=representation',
        },
        data: input.updates,
        retries: 1,
        baseUrlOverride,
      });

      const rows = z.array(ProviderRowSchema).parse(response.data);
      return rows;
    },
  });
}
