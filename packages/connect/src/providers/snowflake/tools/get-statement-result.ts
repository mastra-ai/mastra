// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getStatementResultInputSchema = z.object({
  statement_handle: z
    .string()
    .describe(
      'The statement handle returned by the execute-statement endpoint. Example: "01c4d2c3-0001-e881-001c-d6c3000130ea"',
    ),
  partition: z.number().optional().describe('The partition number to fetch. Defaults to 0.'),
});

const ProviderColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
  precision: z.number().nullish(),
  scale: z.number().nullish(),
  byteLength: z.number().nullish(),
  length: z.number().nullish(),
  nullable: z.boolean().nullish(),
});

const ProviderResultSetMetaDataSchema = z.object({
  numRows: z.number().optional(),
  format: z.string().optional(),
  rowType: z.array(ProviderColumnSchema).optional(),
  partitionInfo: z.array(z.object({ rowCount: z.number() })).optional(),
});

const ProviderResponseSchema = z.object({
  statementHandle: z.string().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
  statementState: z.string().optional(),
  resultSetMetaData: ProviderResultSetMetaDataSchema.optional(),
  data: z.array(z.array(z.unknown())).optional(),
  nextPartitionNum: z.number().optional(),
});

const OutputColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
  precision: z.number().optional(),
  scale: z.number().optional(),
  byte_length: z.number().optional(),
  length: z.number().optional(),
  nullable: z.boolean().optional(),
});

export const getStatementResultOutputSchema = z.object({
  statement_handle: z.string(),
  statement_state: z.string().optional(),
  num_rows: z.number().optional(),
  columns: z.array(OutputColumnSchema).optional(),
  rows: z.array(z.array(z.unknown())).optional(),
  next_partition_num: z.number().optional(),
});

export function getStatementResultTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_get_statement_result',
    description: 'Fetch a Snowflake SQL statement result partition.',
    inputSchema: getStatementResultInputSchema,
    outputSchema: getStatementResultOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getStatementResultOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const partition = input.partition ?? 0;

      const config: PlatformProxyRequest = {
        // https://docs.snowflake.com/en/developer-guide/sql-api/index
        endpoint: `/api/v2/statements/${encodeURIComponent(input.statement_handle)}`,
        params: {
          partition: String(partition),
        },
        retries: 3,
      };

      const response = await platformProxy.get(config);

      if (response.data === null || response.data === undefined || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid or empty response from Snowflake API.',
        });
      }

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const statementHandle = providerResponse.statementHandle || input.statement_handle;
      const statementState = providerResponse.statementState;
      const numRows = providerResponse.resultSetMetaData?.numRows;
      const nextPartitionNum = providerResponse.nextPartitionNum;

      const columns = providerResponse.resultSetMetaData?.rowType?.map(col => ({
        name: col.name,
        type: col.type,
        ...(typeof col.precision === 'number' && { precision: col.precision }),
        ...(typeof col.scale === 'number' && { scale: col.scale }),
        ...(typeof col.byteLength === 'number' && { byte_length: col.byteLength }),
        ...(typeof col.length === 'number' && { length: col.length }),
        ...(typeof col.nullable === 'boolean' && { nullable: col.nullable }),
      }));

      return {
        statement_handle: statementHandle,
        ...(statementState !== undefined && { statement_state: statementState }),
        ...(numRows !== undefined && { num_rows: numRows }),
        ...(columns !== undefined && { columns }),
        ...(providerResponse.data !== undefined && { rows: providerResponse.data }),
        ...(nextPartitionNum !== undefined && { next_partition_num: nextPartitionNum }),
      };
    },
  });
}
