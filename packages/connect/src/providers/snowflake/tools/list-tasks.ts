// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listTasksInputSchema = z.object({
  database: z.string().describe('Database name to list tasks from. Example: "NANGO_TEST_DB"'),
});

const TaskSchema = z.object({
  created_on: z.string().optional(),
  name: z.string().optional(),
  database_name: z.string().optional(),
  schema_name: z.string().optional(),
  owner: z.string().optional(),
  warehouse: z.string().optional(),
  schedule: z.string().optional(),
  state: z.string().optional(),
  definition: z.string().optional(),
  condition: z.string().optional(),
});

export const listTasksOutputSchema = z.object({
  tasks: z.array(TaskSchema),
});

const SqlApiResponseSchema = z.object({
  code: z.string(),
  statementHandle: z.string().optional(),
  message: z.string().optional(),
  resultSetMetaData: z
    .object({
      numRows: z.number().nullable().optional(),
      rowType: z
        .array(
          z.object({
            name: z.string(),
            type: z.string().nullable().optional(),
            length: z.number().nullable().optional(),
            precision: z.number().nullable().optional(),
            scale: z.number().nullable().optional(),
            nullable: z.boolean().nullable().optional(),
          }),
        )
        .optional(),
      partitionInfo: z
        .array(
          z.object({
            rowCount: z.number().nullable().optional(),
            uncompressedSize: z.number().nullable().optional(),
            compressedSize: z.number().nullable().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  data: z.array(z.array(z.unknown())).optional(),
});

export function listTasksTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_list_tasks',
    description: 'List Snowflake tasks in a database',
    inputSchema: listTasksInputSchema,
    outputSchema: listTasksOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listTasksOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const safeDatabase = input.database.replace(/"/g, '""');
      const statement = `SHOW TASKS IN DATABASE "${safeDatabase}"`;

      const postConfig: PlatformProxyRequest = {
        // https://docs.snowflake.com/en/developer-guide/sql-api/submitting-requests
        endpoint: '/api/v2/statements',
        data: {
          statement,
        },
        retries: 3,
      };

      const postResponse = await platformProxy.post(postConfig);
      let responseData = SqlApiResponseSchema.parse(postResponse.data);

      let attempts = 0;
      const maxAttempts = 10;
      while (!responseData.data && responseData.statementHandle && attempts < maxAttempts) {
        const getConfig: PlatformProxyRequest = {
          // https://docs.snowflake.com/en/developer-guide/sql-api/handling-responses
          endpoint: `/api/v2/statements/${encodeURIComponent(responseData.statementHandle)}`,
          retries: 3,
        };

        const getResponse = await platformProxy.get(getConfig);
        responseData = SqlApiResponseSchema.parse(getResponse.data);
        attempts += 1;

        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const rowType = responseData.resultSetMetaData?.rowType;
      const rows = responseData.data;

      if (!rowType || !rows) {
        return { tasks: [] };
      }

      const columnMap = new Map<string, number>();
      for (let i = 0; i < rowType.length; i += 1) {
        const col = rowType[i];
        if (!col) {
          continue;
        }
        columnMap.set(col.name.toUpperCase(), i);
      }

      const getValue = (row: unknown[], colName: string): string | undefined => {
        const index = columnMap.get(colName.toUpperCase());
        if (index === undefined) {
          return undefined;
        }
        const value = row[index];
        if (value === null || value === undefined) {
          return undefined;
        }
        return String(value);
      };

      const tasks = rows.map(row => ({
        created_on: getValue(row, 'created_on'),
        name: getValue(row, 'name'),
        database_name: getValue(row, 'database_name'),
        schema_name: getValue(row, 'schema_name'),
        owner: getValue(row, 'owner'),
        warehouse: getValue(row, 'warehouse'),
        schedule: getValue(row, 'schedule'),
        state: getValue(row, 'state'),
        definition: getValue(row, 'definition'),
        condition: getValue(row, 'condition'),
      }));

      return { tasks };
    },
  });
}
