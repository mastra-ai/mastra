// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listColumnsInputSchema = z.object({
  database: z.string().describe('Database name. Example: "NANGO_TEST_DB"'),
  schema: z.string().describe('Schema name. Example: "SALES"'),
  table: z.string().describe('Table name. Example: "CUSTOMERS"'),
});

const ColumnSchema = z.object({
  table_name: z.string(),
  schema_name: z.string(),
  column_name: z.string(),
  data_type: z.string(),
  nullable: z.boolean(),
  default: z.string().optional(),
  kind: z.string(),
  autoincrement: z.string().optional(),
});

export const listColumnsOutputSchema = z.object({
  columns: z.array(ColumnSchema),
});

const ResultSetSchema = z.object({
  resultSetMetaData: z.object({
    rowType: z.array(
      z.object({
        name: z.string(),
      }),
    ),
  }),
  data: z.array(z.array(z.unknown())),
});

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return false;
}

function getCell(row: unknown[], index: number): unknown {
  if (index >= 0 && index < row.length) {
    return row[index];
  }
  return undefined;
}

export function listColumnsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_list_columns',
    description: 'List columns in a Snowflake table with data types, nullability, and defaults.',
    inputSchema: listColumnsInputSchema,
    outputSchema: listColumnsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listColumnsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const statement = `SHOW COLUMNS IN TABLE "${input.database.replace(/"/g, '""')}"."${input.schema.replace(/"/g, '""')}"."${input.table.replace(/"/g, '""')}"`;

      const response = await platformProxy.post({
        // https://docs.snowflake.com/en/developer-guide/sql-api/reference
        endpoint: '/api/v2/statements',
        data: {
          statement,
        },
        retries: 3,
      });

      const resultSet = ResultSetSchema.parse(response.data);

      const nameToIndex = new Map<string, number>();
      for (let i = 0; i < resultSet.resultSetMetaData.rowType.length; i++) {
        const col = resultSet.resultSetMetaData.rowType[i];
        if (col) {
          nameToIndex.set(col.name, i);
        }
      }

      const columns = resultSet.data.map(row => {
        const get = (name: string): unknown => {
          const idx = nameToIndex.get(name);
          if (idx === undefined) {
            return undefined;
          }
          return getCell(row, idx);
        };

        const table_name = String(get('table_name') ?? '');
        const schema_name = String(get('schema_name') ?? '');
        const column_name = String(get('column_name') ?? '');
        const data_type = String(get('data_type') ?? '');
        const nullable = parseBoolean(get('null?'));
        const defaultVal = get('default');
        const kind = String(get('kind') ?? '');
        const autoincrement = get('autoincrement');

        return {
          table_name,
          schema_name,
          column_name,
          data_type,
          nullable,
          ...(defaultVal !== undefined && defaultVal !== null && { default: String(defaultVal) }),
          kind,
          ...(autoincrement !== undefined && autoincrement !== null && { autoincrement: String(autoincrement) }),
        };
      });

      return { columns };
    },
  });
}
