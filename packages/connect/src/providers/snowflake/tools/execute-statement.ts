// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const BindingSchema = z.object({
  type: z.string(),
  value: z.string(),
});

export const executeStatementInputSchema = z.object({
  statement: z.string(),
  timeout: z.number().optional(),
  warehouse: z.string().optional(),
  database: z.string().optional(),
  schema: z.string().optional(),
  role: z.string().optional(),
  bindings: z.record(z.string(), BindingSchema).optional(),
});

const RowTypeSchema = z.object({
  name: z.string(),
  database: z.string().optional(),
  schema: z.string().optional(),
  table: z.string().optional(),
  type: z.string(),
  scale: z.number().nullable().optional(),
  precision: z.number().nullable().optional(),
  length: z.number().nullable().optional(),
  nullable: z.boolean(),
  byteLength: z.number().nullable().optional(),
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

const StatsSchema = z.object({
  numRowsInserted: z.number().optional(),
  numRowsUpdated: z.number().optional(),
  numRowsDeleted: z.number().optional(),
  numDuplicateRowsUpdated: z.number().optional(),
  numRowsUnloaded: z.number().optional(),
  numBytesUnloaded: z.number().optional(),
});

export const executeStatementOutputSchema = z.object({
  code: z.string(),
  sqlState: z.string().optional(),
  message: z.string(),
  statementHandle: z.string(),
  statementHandles: z.array(z.string()).optional(),
  statementStatusUrl: z.string(),
  createdOn: z.number().optional(),
  resultSetMetaData: ResultSetMetaDataSchema.optional(),
  data: z.array(z.array(z.unknown())).optional(),
  stats: StatsSchema.optional(),
});

export function executeStatementTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_execute_statement',
    description: 'Submit a SQL statement to Snowflake.',
    inputSchema: executeStatementInputSchema,
    outputSchema: executeStatementOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof executeStatementOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.snowflake.com/en/developer-guide/sql-api/reference
      const response = await platformProxy.post({
        endpoint: '/api/v2/statements',
        data: {
          statement: input.statement,
          ...(input.timeout !== undefined && { timeout: input.timeout }),
          ...(input.warehouse !== undefined && { warehouse: input.warehouse }),
          ...(input.database !== undefined && { database: input.database }),
          ...(input.schema !== undefined && { schema: input.schema }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.bindings !== undefined && { bindings: input.bindings }),
        },
        retries: 3,
      });

      const result = executeStatementOutputSchema.safeParse(response.data);
      if (!result.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response format from Snowflake SQL API',
          details: result.error.format(),
        });
      }

      return result.data;
    },
  });
}
