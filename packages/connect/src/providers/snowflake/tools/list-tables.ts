// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listTablesInputSchema = z.object({
  database: z.string().describe('Database name. Example: "NANGO_TEST_DB"'),
  schema: z.string().describe('Schema name. Example: "SALES"'),
});

const OutputTableSchema = z.object({
  created_on: z.string().optional(),
  name: z.string(),
  database_name: z.string().optional(),
  schema_name: z.string().optional(),
  kind: z.string().optional(),
  rows: z.number().optional(),
  bytes: z.number().optional(),
  owner: z.string().optional(),
  retention_time: z.number().optional(),
  is_external: z.string().optional(),
  is_iceberg: z.string().optional(),
});

export const listTablesOutputSchema = z.object({
  tables: z.array(OutputTableSchema),
});

const SnowflakeStatementResponseSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  statementHandle: z.string().optional(),
  statementStatusUrl: z.string().optional(),
  data: z.array(z.array(z.unknown())).optional(),
  resultSetMetaData: z
    .object({
      rowType: z.array(
        z.object({
          name: z.string(),
          type: z.string().nullable().optional(),
          precision: z.number().nullable().optional(),
          scale: z.number().nullable().optional(),
          byteLength: z.number().nullable().optional(),
          length: z.number().nullable().optional(),
          nullable: z.boolean().nullable().optional(),
        }),
      ),
    })
    .optional(),
});

export function listTablesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_list_tables',
    description: 'List tables in a Snowflake schema',
    inputSchema: listTablesInputSchema,
    outputSchema: listTablesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listTablesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const statement = `SHOW TABLES IN SCHEMA "${input.database.replace(/"/g, '""')}"."${input.schema.replace(/"/g, '""')}"`;

      // https://docs.snowflake.com/en/developer-guide/sql-api/index
      const response = await platformProxy.post({
        endpoint: '/api/v2/statements',
        data: {
          statement,
        },
        retries: 3,
      });

      const parsed = SnowflakeStatementResponseSchema.parse(response.data);

      if (parsed.statementHandle && !parsed.data) {
        throw new platformProxy.ActionError({
          type: 'async_statement',
          message: 'Statement is executing asynchronously. Polling is not supported in this action.',
          statement_handle: parsed.statementHandle,
        });
      }

      const meta = parsed.resultSetMetaData;
      const rows = parsed.data;

      if (!meta || !rows || rows.length === 0) {
        return {
          tables: [],
        };
      }

      const colMap = new Map<string, number>();
      for (let i = 0; i < meta.rowType.length; i++) {
        const col = meta.rowType[i];
        if (!col) {
          continue;
        }
        colMap.set(col.name.toUpperCase(), i);
      }

      const getValue = (row: unknown[], colName: string): unknown => {
        const idx = colMap.get(colName.toUpperCase());
        if (idx === undefined) {
          return undefined;
        }
        return row[idx];
      };

      const tables = rows.map(row => {
        const createdOn = getValue(row, 'created_on');
        const name = getValue(row, 'name');
        const databaseName = getValue(row, 'database_name');
        const schemaName = getValue(row, 'schema_name');
        const kind = getValue(row, 'kind');
        const rowCount = getValue(row, 'rows');
        const bytes = getValue(row, 'bytes');
        const owner = getValue(row, 'owner');
        const retentionTime = getValue(row, 'retention_time');
        const isExternal = getValue(row, 'is_external');
        const isIceberg = getValue(row, 'is_iceberg');

        return {
          ...(createdOn !== undefined && createdOn !== null && { created_on: String(createdOn) }),
          name: name !== undefined && name !== null ? String(name) : '',
          ...(databaseName !== undefined && databaseName !== null && { database_name: String(databaseName) }),
          ...(schemaName !== undefined && schemaName !== null && { schema_name: String(schemaName) }),
          ...(kind !== undefined && kind !== null && { kind: String(kind) }),
          ...(rowCount !== undefined && rowCount !== null && { rows: Number(rowCount) }),
          ...(bytes !== undefined && bytes !== null && { bytes: Number(bytes) }),
          ...(owner !== undefined && owner !== null && { owner: String(owner) }),
          ...(retentionTime !== undefined && retentionTime !== null && { retention_time: Number(retentionTime) }),
          ...(isExternal !== undefined && isExternal !== null && { is_external: String(isExternal) }),
          ...(isIceberg !== undefined && isIceberg !== null && { is_iceberg: String(isIceberg) }),
        };
      });

      return {
        tables,
      };
    },
  });
}
