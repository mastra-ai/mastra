// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listWarehousesInputSchema = z.object({});

const SnowflakeColumnSchema = z.object({
  name: z.string(),
});

const SnowflakeResultSetMetaDataSchema = z.object({
  rowType: z.array(SnowflakeColumnSchema),
});

const SnowflakeResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  data: z.array(z.array(z.unknown())),
  resultSetMetaData: SnowflakeResultSetMetaDataSchema,
});

const WarehouseSchema = z.object({
  name: z.string(),
  state: z.string(),
  type: z.string(),
  size: z.string(),
  min_cluster_count: z.number(),
  max_cluster_count: z.number(),
  started_clusters: z.number(),
  running: z.number(),
  queued: z.number(),
  is_default: z.boolean(),
  is_current: z.boolean(),
  auto_suspend: z.number(),
  auto_resume: z.boolean(),
  owner: z.string(),
  enable_query_acceleration: z.boolean(),
  resource_monitor: z.string().optional(),
});

export const listWarehousesOutputSchema = z.object({
  warehouses: z.array(WarehouseSchema),
});

function parseNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value === 'Y' || value === 'true';
  }
  return false;
}

export function listWarehousesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_list_warehouses',
    description: 'List Snowflake warehouses with size, state, and resource usage.',
    inputSchema: listWarehousesInputSchema,
    outputSchema: listWarehousesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWarehousesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.snowflake.com/en/developer-guide/sql-api/reference/api-reference-v2.html#post-api-v2-statements
      const response = await platformProxy.post({
        endpoint: '/api/v2/statements',
        data: {
          statement: 'SHOW WAREHOUSES',
        },
        retries: 3,
      });

      const raw = response.data;
      if (!raw) {
        throw new platformProxy.ActionError({
          type: 'empty_response',
          message: 'No response data from Snowflake SQL API',
        });
      }

      const parsed = SnowflakeResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response structure from Snowflake SQL API',
        });
      }

      const result = parsed.data;
      const columnNames = result.resultSetMetaData.rowType.map(col => col.name);

      const warehouses = result.data.map(row => {
        const rowMap: Record<string, unknown> = {};
        row.forEach((cell, index) => {
          const colName = columnNames[index];
          if (colName !== undefined) {
            rowMap[colName] = cell;
          }
        });

        return {
          name: typeof rowMap['name'] === 'string' ? rowMap['name'] : '',
          state: typeof rowMap['state'] === 'string' ? rowMap['state'] : '',
          type: typeof rowMap['type'] === 'string' ? rowMap['type'] : '',
          size: typeof rowMap['size'] === 'string' ? rowMap['size'] : '',
          min_cluster_count: parseNumber(rowMap['min_cluster_count']),
          max_cluster_count: parseNumber(rowMap['max_cluster_count']),
          started_clusters: parseNumber(rowMap['started_clusters']),
          running: parseNumber(rowMap['running']),
          queued: parseNumber(rowMap['queued']),
          is_default: parseBoolean(rowMap['is_default']),
          is_current: parseBoolean(rowMap['is_current']),
          auto_suspend: parseNumber(rowMap['auto_suspend']),
          auto_resume: parseBoolean(rowMap['auto_resume']),
          owner: typeof rowMap['owner'] === 'string' ? rowMap['owner'] : '',
          enable_query_acceleration: parseBoolean(rowMap['enable_query_acceleration']),
          resource_monitor:
            typeof rowMap['resource_monitor'] === 'string' && rowMap['resource_monitor'] !== 'null'
              ? rowMap['resource_monitor']
              : undefined,
        };
      });

      return { warehouses };
    },
  });
}
