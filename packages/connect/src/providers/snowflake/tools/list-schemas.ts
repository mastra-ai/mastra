// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSchemasInputSchema = z.object({
  database: z.string().describe('Database name. Example: "NANGO_TEST_DB"'),
});

const SchemaOutput = z.object({
  created_on: z.string().optional().describe('Schema creation timestamp in ISO 8601 format'),
  name: z.string().describe('Schema name'),
  is_default: z.boolean().describe('Whether this is the default schema'),
  is_current: z.boolean().describe('Whether this is the current schema'),
  database_name: z.string().describe('Database name'),
  owner: z.string().describe('Owner of the schema'),
  comment: z.string().optional().describe('Comment on the schema'),
  retention_time: z.string().optional().describe('Retention time in days'),
});

export const listSchemasOutputSchema = z.object({
  schemas: z.array(SchemaOutput),
});

const RowTypeSchema = z
  .object({
    name: z.string(),
  })
  .passthrough();

const ResultSetMetaDataSchema = z.object({
  numRows: z.number().optional(),
  format: z.string().optional(),
  rowType: z.array(RowTypeSchema),
  partitionInfo: z
    .array(
      z.object({
        rowCount: z.number(),
        uncompressedSize: z.number().optional(),
        compressedSize: z.number().optional(),
      }),
    )
    .optional(),
});

const StatementResponseSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  statementHandle: z.string().optional(),
  statementStatusUrl: z.string().optional(),
  resultSetMetaData: ResultSetMetaDataSchema.optional(),
  data: z.array(z.array(z.unknown())).optional(),
});

function parseTimestamp(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const str = String(value);
  const seconds = parseFloat(str);
  if (Number.isNaN(seconds)) {
    return str;
  }
  return new Date(seconds * 1000).toISOString();
}

function parseBoolean(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  const str = String(value).toUpperCase();
  return str === 'Y' || str === 'TRUE' || str === '1';
}

function getColumnValue(row: unknown[], columnIndex: Map<string, number>, columnName: string): unknown {
  const index = columnIndex.get(columnName);
  if (index === undefined) {
    return undefined;
  }
  return row[index];
}

export function listSchemasTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_list_schemas',
    description: 'List schemas in a Snowflake database',
    inputSchema: listSchemasInputSchema,
    outputSchema: listSchemasOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSchemasOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const statement = `SHOW SCHEMAS IN DATABASE "${input.database.replace(/"/g, '""')}"`;

      // https://docs.snowflake.com/en/developer-guide/sql-api/reference#post-apiv2statements
      const response = await platformProxy.post({
        endpoint: '/api/v2/statements',
        data: {
          statement,
          database: input.database,
        },
        retries: 3,
      });

      const result = StatementResponseSchema.parse(response.data);

      if (!result.resultSetMetaData || !result.data) {
        return { schemas: [] };
      }

      const columns = result.resultSetMetaData.rowType.map(col => col.name.toLowerCase());
      const columnIndex = new Map<string, number>();
      for (let i = 0; i < columns.length; i++) {
        const columnName = columns[i];
        if (columnName === undefined) {
          continue;
        }
        columnIndex.set(columnName, i);
      }

      const allRows = result.data;
      const partitionInfo = result.resultSetMetaData.partitionInfo || [];

      if (partitionInfo.length > 1 && result.statementHandle) {
        for (let partition = 1; partition < partitionInfo.length; partition++) {
          // https://docs.snowflake.com/en/developer-guide/sql-api/reference#get-apiv2statementsstatementhandle
          const partitionResponse = await platformProxy.get({
            endpoint: `/api/v2/statements/${encodeURIComponent(result.statementHandle)}`,
            params: {
              partition: String(partition),
            },
            retries: 3,
          });

          const partitionResult = StatementResponseSchema.parse(partitionResponse.data);
          if (partitionResult.data) {
            allRows.push(...partitionResult.data);
          }
        }
      }

      const schemas: z.infer<typeof SchemaOutput>[] = [];

      for (const row of allRows) {
        const name = getColumnValue(row, columnIndex, 'name');
        if (typeof name !== 'string') {
          continue;
        }

        if (name === 'INFORMATION_SCHEMA') {
          continue;
        }

        const commentValue = getColumnValue(row, columnIndex, 'comment');
        const retentionTimeValue = getColumnValue(row, columnIndex, 'retention_time');

        schemas.push({
          created_on: parseTimestamp(getColumnValue(row, columnIndex, 'created_on')),
          name,
          is_default: parseBoolean(getColumnValue(row, columnIndex, 'is_default')),
          is_current: parseBoolean(getColumnValue(row, columnIndex, 'is_current')),
          database_name: String(getColumnValue(row, columnIndex, 'database_name') ?? ''),
          owner: String(getColumnValue(row, columnIndex, 'owner') ?? ''),
          ...(commentValue !== null &&
            commentValue !== undefined &&
            String(commentValue) !== '' && { comment: String(commentValue) }),
          ...(retentionTimeValue !== null &&
            retentionTimeValue !== undefined && { retention_time: String(retentionTimeValue) }),
        });
      }

      return { schemas };
    },
  });
}
