// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listUsersInputSchema = z.object({});

const ResultSetMetaDataSchema = z.object({
  rowType: z
    .array(
      z.object({
        name: z.string(),
      }),
    )
    .optional(),
  partitionInfo: z
    .array(
      z.object({
        rowCount: z.number().optional(),
      }),
    )
    .optional(),
});

const ResultSetSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  statementHandle: z.string().optional(),
  resultSetMetaData: ResultSetMetaDataSchema.optional(),
  data: z.array(z.array(z.string().nullable())).optional(),
});

const OutputUserSchema = z.object({
  name: z.string(),
  created_on: z.string().optional(),
  login_name: z.string().optional(),
  display_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().optional(),
  disabled: z.boolean().optional(),
  must_change_password: z.boolean().optional(),
  default_warehouse: z.string().optional(),
  default_role: z.string().optional(),
  has_password: z.boolean().optional(),
  has_rsa_public_key: z.boolean().optional(),
  last_success_login: z.string().optional(),
  type: z.string().optional(),
});

export const listUsersOutputSchema = z.object({
  items: z.array(OutputUserSchema),
});

function parseBoolean(value: string | null): boolean | undefined {
  if (value == null) {
    return undefined;
  }
  return value === 'true';
}

export function listUsersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_list_users',
    description: 'List Snowflake users with login, email, role, and auth details.',
    inputSchema: listUsersInputSchema,
    outputSchema: listUsersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUsersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://docs.snowflake.com/en/developer-guide/sql-api/index
        endpoint: '/api/v2/statements',
        data: {
          statement: 'SHOW USERS',
        },
        retries: 3,
      };
      const response = await platformProxy.post(config);

      if (response.status === 401) {
        throw new platformProxy.ActionError({
          type: 'unauthorized',
          message: 'Authentication failed',
        });
      }

      if (response.status === 429) {
        throw new platformProxy.ActionError({
          type: 'rate_limited',
          message: 'API rate limit exceeded',
        });
      }

      if (response.status >= 400) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Snowflake API returned an error',
          status: response.status,
        });
      }

      const result = ResultSetSchema.parse(response.data);

      if (result.code && result.code !== '090001') {
        throw new platformProxy.ActionError({
          type: 'snowflake_error',
          message: result.message || 'Snowflake returned an error',
          code: result.code,
        });
      }

      const rowType = result.resultSetMetaData?.rowType;
      if (!rowType) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Missing result set metadata',
        });
      }

      const rows = result.data || [];
      const columnNames = rowType.map(col => col.name);

      const items = rows.map(row => {
        const raw: Record<string, string | null> = {};
        for (let i = 0; i < columnNames.length; i++) {
          const colName = columnNames[i];
          if (colName != null) {
            raw[colName] = row[i] ?? null;
          }
        }

        const disabled = parseBoolean(raw['disabled'] ?? null);
        const must_change_password = parseBoolean(raw['must_change_password'] ?? null);
        const has_password = parseBoolean(raw['has_password'] ?? null);
        const has_rsa_public_key = parseBoolean(raw['has_rsa_public_key'] ?? null);

        return {
          name: raw['name'] ?? '',
          ...(raw['created_on'] != null && { created_on: raw['created_on'] }),
          ...(raw['login_name'] != null && { login_name: raw['login_name'] }),
          ...(raw['display_name'] != null && { display_name: raw['display_name'] }),
          ...(raw['first_name'] != null && { first_name: raw['first_name'] }),
          ...(raw['last_name'] != null && { last_name: raw['last_name'] }),
          ...(raw['email'] != null && { email: raw['email'] }),
          ...(disabled !== undefined && { disabled }),
          ...(must_change_password !== undefined && { must_change_password }),
          ...(raw['default_warehouse'] != null && { default_warehouse: raw['default_warehouse'] }),
          ...(raw['default_role'] != null && { default_role: raw['default_role'] }),
          ...(has_password !== undefined && { has_password }),
          ...(has_rsa_public_key !== undefined && { has_rsa_public_key }),
          ...(raw['last_success_login'] != null && { last_success_login: raw['last_success_login'] }),
          ...(raw['type'] != null && { type: raw['type'] }),
        };
      });

      return { items };
    },
  });
}
