// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const FilterSchema = z.object({
  column: z.string().describe('Column name to filter on. Example: "name"'),
  operator: z.string().describe('PostgREST operator. Example: "eq", "gte", "like"'),
  value: z.union([z.string(), z.number(), z.boolean()]).describe('Filter value. Example: "alpha"'),
});

export const queryTableRowsInputSchema = z.object({
  table: z.string().describe('Table name to query. Example: "nango_test"'),
  select: z.string().optional().describe('Columns to select. Example: "id,name,value"'),
  filters: z.array(FilterSchema).optional().describe('PostgREST filters'),
  order: z.string().optional().describe('Order by clause. Example: "name.desc"'),
  limit: z.number().int().positive().optional().describe('Maximum rows to return. Example: 100'),
  offset: z.number().int().min(0).optional().describe('Number of rows to skip. Example: 0'),
  count: z.boolean().optional().describe('Return total row count'),
});

export const queryTableRowsOutputSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).describe('Matching table rows'),
  count: z.number().int().optional().describe('Total row count when count was requested'),
  limit: z.number().int().optional(),
  offset: z.number().int().optional(),
});

const ConnectionConfigSchema = z.object({
  projectUrl: z.string().optional(),
});

export function queryTableRowsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_query_table_rows',
    description: 'Query rows from a Supabase table through PostgREST.',
    inputSchema: queryTableRowsInputSchema,
    outputSchema: queryTableRowsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof queryTableRowsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const rawConfig = connection.connection_config ?? {};
      const connectionConfig = ConnectionConfigSchema.parse(rawConfig);
      const projectUrl = connectionConfig.projectUrl;
      const baseUrlOverride = projectUrl
        ? projectUrl.startsWith('http')
          ? projectUrl
          : `https://${projectUrl}`
        : undefined;

      const params: Record<string, string> = {};
      if (input['select'] !== undefined) {
        params['select'] = input['select'];
      }
      if (input['order'] !== undefined) {
        params['order'] = input['order'];
      }
      const seenColumns = new Set<string>();
      for (const filter of input['filters'] || []) {
        if (seenColumns.has(filter.column)) {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: `Duplicate filter column "${filter.column}". Use a single filter per column or combine conditions with PostgREST "and" syntax.`,
          });
        }
        seenColumns.add(filter.column);
        params[filter.column] = `${filter.operator}.${filter.value}`;
      }

      const headers: Record<string, string> = {};
      if (input['count'] === true) {
        headers['Prefer'] = 'count=exact';
      }
      if (input['limit'] !== undefined) {
        const start = input['offset'] ?? 0;
        const end = start + input['limit'] - 1;
        headers['Range'] = `${start}-${end}`;
      }

      // https://supabase.com/docs/reference/api
      const response = await platformProxy.get({
        endpoint: `/rest/v1/${encodeURIComponent(input.table)}`,
        params,
        headers,
        retries: 3,
        baseUrlOverride,
      });

      const rows = z.array(z.record(z.string(), z.unknown())).parse(response.data);

      let count: number | undefined;
      if (input['count'] === true) {
        const contentRange = response.headers['content-range'];
        if (typeof contentRange === 'string') {
          const slashIndex = contentRange.lastIndexOf('/');
          if (slashIndex !== -1) {
            const totalStr = contentRange.slice(slashIndex + 1);
            const parsed = parseInt(totalStr, 10);
            if (!isNaN(parsed)) {
              count = parsed;
            }
          }
        }
      }

      return {
        rows,
        ...(count !== undefined && { count }),
        ...(input['limit'] !== undefined && { limit: input['limit'] }),
        ...(input['offset'] !== undefined && { offset: input['offset'] }),
      };
    },
  });
}
