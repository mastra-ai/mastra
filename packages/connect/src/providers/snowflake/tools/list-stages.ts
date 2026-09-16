// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listStagesInputSchema = z.object({
  database: z.string().describe('Database name. Example: "NANGO_TEST_DB"'),
});

const StageSchema = z.object({
  created_on: z.string().optional(),
  name: z.string().optional(),
  database_name: z.string().optional(),
  schema_name: z.string().optional(),
  url: z.string().optional(),
  has_credentials: z.string().optional(),
  has_encryption_key: z.string().optional(),
  owner: z.string().optional(),
  comment: z.string().optional(),
  region: z.string().optional(),
  type: z.string().optional(),
  cloud: z.string().optional(),
});

export const listStagesOutputSchema = z.object({
  stages: z.array(StageSchema),
});

const RowTypeSchema = z.object({
  name: z.string(),
  type: z.string(),
  length: z.number().nullable().optional(),
  precision: z.number().nullable().optional(),
  scale: z.number().nullable().optional(),
  nullable: z.boolean().nullable().optional(),
});

const PartitionInfoSchema = z.object({
  rowCount: z.number(),
  uncompressedSize: z.number().optional(),
  compressedSize: z.number().optional(),
});

const ResultSetMetaDataSchema = z.object({
  numRows: z.number(),
  format: z.string(),
  rowType: z.array(RowTypeSchema),
  partitionInfo: z.array(PartitionInfoSchema).optional(),
});

const StatementResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  data: z.array(z.array(z.unknown())).optional(),
  resultSetMetaData: ResultSetMetaDataSchema.optional(),
  statementHandle: z.string().optional(),
  statementStatusUrl: z.string().optional(),
});

export function listStagesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_list_stages',
    description: 'List Snowflake stages in a database.',
    inputSchema: listStagesInputSchema,
    outputSchema: listStagesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listStagesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const submitResponse = await platformProxy.post({
        // https://docs.snowflake.com/en/developer-guide/sql-api/submitting-requests
        endpoint: '/api/v2/statements',
        data: {
          statement: `SHOW STAGES IN DATABASE "${input.database.replace(/"/g, '""')}"`,
        },
        retries: 3,
      });

      const submitResult = StatementResponseSchema.parse(submitResponse.data);

      let currentResult = submitResult;
      const maxAttempts = 30;
      let attempts = 0;

      while (!currentResult.data && currentResult.statementHandle && attempts < maxAttempts) {
        // https://docs.snowflake.com/en/developer-guide/sql-api/handling-responses
        const statusResponse = await platformProxy.get({
          endpoint: `/api/v2/statements/${encodeURIComponent(currentResult.statementHandle)}`,
          retries: 3,
        });
        currentResult = StatementResponseSchema.parse(statusResponse.data);
        attempts += 1;
        if (!currentResult.data && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const resultData = currentResult.data;
      const resultMetaData = currentResult.resultSetMetaData;

      if (!resultData || !resultMetaData) {
        throw new platformProxy.ActionError({
          type: 'unexpected_response',
          message: 'No data returned from Snowflake SQL API.',
        });
      }

      const columnIndices = new Map<string, number>();
      for (let i = 0; i < resultMetaData.rowType.length; i++) {
        const rowType = resultMetaData.rowType[i];
        if (rowType) {
          columnIndices.set(rowType.name, i);
        }
      }

      const stages = resultData.map(row => {
        const getValue = (columnName: string): string | undefined => {
          const idx = columnIndices.get(columnName);
          if (idx === undefined) {
            return undefined;
          }
          const value = row[idx];
          if (value === null || value === undefined) {
            return undefined;
          }
          return String(value);
        };

        const created_on = getValue('created_on');
        const name = getValue('name');
        const database_name = getValue('database_name');
        const schema_name = getValue('schema_name');
        const url = getValue('url');
        const has_credentials = getValue('has_credentials');
        const has_encryption_key = getValue('has_encryption_key');
        const owner = getValue('owner');
        const comment = getValue('comment');
        const region = getValue('region');
        const type = getValue('type');
        const cloud = getValue('cloud');

        return {
          ...(created_on !== undefined && { created_on }),
          ...(name !== undefined && { name }),
          ...(database_name !== undefined && { database_name }),
          ...(schema_name !== undefined && { schema_name }),
          ...(url !== undefined && { url }),
          ...(has_credentials !== undefined && { has_credentials }),
          ...(has_encryption_key !== undefined && { has_encryption_key }),
          ...(owner !== undefined && { owner }),
          ...(comment !== undefined && { comment }),
          ...(region !== undefined && { region }),
          ...(type !== undefined && { type }),
          ...(cloud !== undefined && { cloud }),
        };
      });

      return { stages };
    },
  });
}
