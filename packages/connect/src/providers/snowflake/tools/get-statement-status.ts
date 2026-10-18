// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getStatementStatusInputSchema = z.object({
  statementHandle: z
    .string()
    .describe('The handle of the SQL statement to check. Example: "01c4d2c3-0001-e881-001c-d6c3000130ea"'),
});

const RowTypeSchema = z.object({
  name: z.string(),
  type: z.string(),
  database: z.string().optional(),
  schema: z.string().optional(),
  table: z.string().optional(),
  scale: z.number().nullable().optional(),
  precision: z.number().nullable().optional(),
  length: z.number().nullable().optional(),
  byteLength: z.number().nullable().optional(),
  nullable: z.boolean().optional(),
  collation: z.string().nullable().optional(),
});

const PartitionInfoSchema = z.object({
  rowCount: z.number(),
  uncompressedSize: z.number(),
  compressedSize: z.number().optional(),
});

const ResultSetMetaDataSchema = z.object({
  numRows: z.number().optional(),
  format: z.string().optional(),
  rowType: z.array(RowTypeSchema).optional(),
  partitionInfo: z.array(PartitionInfoSchema).optional(),
});

export const getStatementStatusOutputSchema = z.object({
  statementHandle: z.string(),
  sqlState: z.string().optional(),
  message: z.string().optional(),
  code: z.string().optional(),
  createdOn: z.number().optional(),
  statementStatusUrl: z.string().optional(),
  resultSetMetaData: ResultSetMetaDataSchema.optional(),
  data: z.array(z.array(z.unknown())).optional(),
});

export function getStatementStatusTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_get_statement_status',
    description: 'Get Snowflake SQL statement execution status and inline results.',
    inputSchema: getStatementStatusInputSchema,
    outputSchema: getStatementStatusOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getStatementStatusOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.snowflake.com/en/developer-guide/sql-api/reference#get-statements
        endpoint: `/api/v2/statements/${encodeURIComponent(input.statementHandle)}`,
        retries: 3,
      });

      const parsed = getStatementStatusOutputSchema.parse(response.data);
      return parsed;
    },
  });
}
