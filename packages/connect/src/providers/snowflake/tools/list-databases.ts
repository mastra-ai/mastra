// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listDatabasesInputSchema = z.object({});

const ProviderDatabaseSchema = z.object({
  created_on: z.string().nullish(),
  name: z.string(),
  is_default: z.string().nullish(),
  is_current: z.string().nullish(),
  origin: z.string().nullish(),
  owner: z.string().nullish(),
  comment: z.string().nullish(),
  retention_time: z.string().nullish(),
  kind: z.string().nullish(),
});

export const listDatabasesOutputSchema = z.object({
  databases: z.array(ProviderDatabaseSchema),
});

export function listDatabasesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_list_databases',
    description: 'List Snowflake databases.',
    inputSchema: listDatabasesInputSchema,
    outputSchema: listDatabasesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDatabasesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://docs.snowflake.com/en/developer-guide/sql-api/submitting-requests
        endpoint: '/api/v2/statements',
        data: {
          statement: 'SHOW DATABASES',
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);

      const resultSetSchema = z.object({
        code: z.string(),
        resultSetMetaData: z.object({
          rowType: z.array(
            z.object({
              name: z.string(),
            }),
          ),
        }),
        data: z.array(z.array(z.unknown())),
      });

      const resultSet = resultSetSchema.parse(response.data);
      const columns = resultSet.resultSetMetaData.rowType.map(col => col.name.toLowerCase());

      const databases = resultSet.data.map(row => {
        const rowObject: Record<string, unknown> = {};
        for (const [i, col] of columns.entries()) {
          rowObject[col] = row[i];
        }
        return ProviderDatabaseSchema.parse(rowObject);
      });

      return {
        databases,
      };
    },
  });
}
