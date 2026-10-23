// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listViewsInputSchema = z.object({
  database_name: z.string().describe('Database name. Example: "NANGO_TEST_DB"'),
  schema_name: z.string().describe('Schema name. Example: "SALES"'),
});

const ViewSchema = z.object({
  created_on: z.string(),
  name: z.string(),
  database_name: z.string(),
  schema_name: z.string(),
  owner: z.string().optional(),
  comment: z.string().optional(),
  text: z.string().optional(),
  is_secure: z.boolean(),
  is_materialized: z.boolean(),
  change_tracking: z.string().optional(),
});

export const listViewsOutputSchema = z.object({
  items: z.array(ViewSchema),
});

const ResultSetMetaDataSchema = z.object({
  numRows: z.number().optional(),
  format: z.string().optional(),
  rowType: z.array(
    z.object({
      name: z.string(),
      type: z.string().optional(),
      length: z.number().nullable().optional(),
      precision: z.number().nullable().optional(),
      scale: z.number().nullable().optional(),
      nullable: z.boolean().optional(),
    }),
  ),
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

const ResultSetSchema = z.object({
  code: z.string(),
  statementHandle: z.string().optional(),
  message: z.string().optional(),
  createdOn: z.number().optional(),
  sqlState: z.string().optional(),
  statementStatusUrl: z.string().optional(),
  resultSetMetaData: ResultSetMetaDataSchema,
  data: z.array(z.array(z.string().nullable())),
});

export function listViewsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_list_views',
    description: 'List views in a Snowflake schema.',
    inputSchema: listViewsInputSchema,
    outputSchema: listViewsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listViewsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const statement = `SHOW VIEWS IN SCHEMA "${input.database_name.replace(/"/g, '""')}"."${input.schema_name.replace(/"/g, '""')}"`;

      const response = await platformProxy.post({
        // https://docs.snowflake.com/en/developer-guide/sql-api/submitting-requests
        endpoint: '/api/v2/statements',
        data: {
          statement: statement,
          resultSetMetaData: {
            format: 'jsonv2',
          },
        },
        retries: 3,
      });

      const resultSet = ResultSetSchema.parse(response.data);
      const columnNames = resultSet.resultSetMetaData.rowType.map(col => col.name);

      const views = resultSet.data
        .map(row => {
          const rowMap: Record<string, string | null> = {};
          for (let i = 0; i < columnNames.length; i++) {
            const col = columnNames[i];
            if (col) {
              rowMap[col] = row[i] ?? null;
            }
          }
          return rowMap;
        })
        .map(row => {
          const createdOn = row['created_on'] ?? '';
          const name = row['name'] ?? '';
          const databaseName = row['database_name'] ?? '';
          const schemaName = row['schema_name'] ?? '';
          const owner = row['owner'] ?? null;
          const comment = row['comment'] ?? null;
          const text = row['text'] ?? null;
          const isSecure = row['is_secure'] === 'true';
          const isMaterialized = row['is_materialized'] === 'true';
          const changeTracking = row['change_tracking'] ?? null;

          return {
            created_on: createdOn,
            name: name,
            database_name: databaseName,
            schema_name: schemaName,
            ...(owner !== null && owner !== '' && { owner: owner }),
            ...(comment !== null && comment !== '' && { comment: comment }),
            ...(text !== null && text !== '' && { text: text }),
            is_secure: isSecure,
            is_materialized: isMaterialized,
            ...(changeTracking !== null && changeTracking !== '' && { change_tracking: changeTracking }),
          };
        });

      return {
        items: views,
      };
    },
  });
}
