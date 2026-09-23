// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listRolesInputSchema = z.object({});

const RoleSchema = z.object({
  created_on: z.string().optional(),
  name: z.string(),
  is_default: z.boolean(),
  is_current: z.boolean(),
  is_inherited: z.boolean(),
  assigned_to_users: z.number().optional(),
  granted_to_roles: z.number().optional(),
  granted_roles: z.number().optional(),
  owner: z.string().optional(),
  comment: z.string().optional(),
});

export const listRolesOutputSchema = z.object({
  roles: z.array(RoleSchema),
});

const SnowflakeResultSetSchema = z.object({
  code: z.string(),
  statementHandle: z.string(),
  message: z.string(),
  resultSetMetaData: z
    .object({
      numRows: z.number(),
      format: z.string(),
      rowType: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          length: z.number().nullable().optional(),
          precision: z.number().nullable().optional(),
          scale: z.number().nullable().optional(),
          nullable: z.boolean().nullable().optional(),
        }),
      ),
      partitionInfo: z.array(
        z.object({
          rowCount: z.number(),
          uncompressedSize: z.number().optional(),
          compressedSize: z.number().optional(),
        }),
      ),
    })
    .optional(),
  data: z.array(z.array(z.union([z.string(), z.null()]))).optional(),
});

const SnowflakeAsyncStatusSchema = z.object({
  code: z.string(),
  statementHandle: z.string(),
  statementStatusUrl: z.string(),
  message: z.string(),
  sqlState: z.string().optional(),
});

async function fetchAllRows(
  platformProxy: PlatformProxy,
  resultSet: z.infer<typeof SnowflakeResultSetSchema>,
): Promise<Array<Record<string, string | null>>> {
  const columns = resultSet.resultSetMetaData?.rowType.map(col => col.name.toLowerCase()) ?? [];
  const initialData = resultSet.data ?? [];
  const partitionInfo = resultSet.resultSetMetaData?.partitionInfo ?? [];
  const statementHandle = resultSet.statementHandle;

  let allData = initialData.map(row => rowToRecord(row, columns));

  for (let partitionIndex = 1; partitionIndex < partitionInfo.length; partitionIndex = partitionIndex + 1) {
    // https://docs.snowflake.com/en/developer-guide/sql-api/handling-responses
    const partitionResponse = await platformProxy.get({
      endpoint: `/api/v2/statements/${encodeURIComponent(statementHandle)}`,
      params: {
        partition: String(partitionIndex),
      },
      retries: 3,
    });

    if (partitionResponse.status !== 200) {
      throw new platformProxy.ActionError({
        type: 'partition_fetch_failed',
        message: `Failed to fetch partition ${partitionIndex}`,
      });
    }

    const partitionSchema = z.object({
      data: z.array(z.array(z.string().nullable())),
    });

    const parsedPartition = partitionSchema.parse(partitionResponse.data);
    const partitionRows = parsedPartition.data.map(row => rowToRecord(row, columns));
    allData = allData.concat(partitionRows);
  }

  return allData;
}

function rowToRecord(row: Array<string | null>, columns: Array<string>): Record<string, string | null> {
  const record: Record<string, string | null> = {};
  row.forEach((value, index) => {
    const columnName = columns[index];
    if (columnName) {
      record[columnName] = value;
    }
  });
  return record;
}

function mapRowToRole(row: Record<string, string | null>): z.infer<typeof RoleSchema> {
  const createdOn = row['created_on'];
  const name = row['name'];
  const isDefault = row['is_default'];
  const isCurrent = row['is_current'];
  const isInherited = row['is_inherited'];
  const assignedToUsers = row['assigned_to_users'];
  const grantedToRoles = row['granted_to_roles'];
  const grantedRoles = row['granted_roles'];
  const owner = row['owner'];
  const comment = row['comment'];

  return {
    ...(createdOn !== null && createdOn !== '' && { created_on: createdOn }),
    name: name ?? '',
    is_default: isDefault === 'Y',
    is_current: isCurrent === 'Y',
    is_inherited: isInherited === 'Y',
    ...(assignedToUsers !== null && assignedToUsers !== '' && { assigned_to_users: Number(assignedToUsers) }),
    ...(grantedToRoles !== null && grantedToRoles !== '' && { granted_to_roles: Number(grantedToRoles) }),
    ...(grantedRoles !== null && grantedRoles !== '' && { granted_roles: Number(grantedRoles) }),
    ...(owner !== null && owner !== '' && { owner }),
    ...(comment !== null && comment !== '' && { comment }),
  };
}

export function listRolesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'snowflake_list_roles',
    description: 'List Snowflake roles with hierarchy and assignment counts.',
    inputSchema: listRolesInputSchema,
    outputSchema: listRolesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listRolesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.snowflake.com/en/developer-guide/sql-api/submitting-requests
      const response = await platformProxy.post({
        endpoint: '/api/v2/statements',
        data: {
          statement: 'SHOW ROLES',
        },
        retries: 3,
      });

      let resultData: unknown;

      if (response.status === 202) {
        const asyncStatus = SnowflakeAsyncStatusSchema.parse(response.data);
        const statementHandle = asyncStatus.statementHandle;

        let pollResponse = response;
        let pollAttempts = 0;
        const maxPollAttempts = 30;

        while (pollResponse.status === 202 && pollAttempts < maxPollAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          pollAttempts = pollAttempts + 1;
          // https://docs.snowflake.com/en/developer-guide/sql-api/handling-responses
          pollResponse = await platformProxy.get({
            endpoint: `/api/v2/statements/${encodeURIComponent(statementHandle)}`,
            retries: 3,
          });
        }

        if (pollResponse.status !== 200) {
          const failure = SnowflakeResultSetSchema.safeParse(pollResponse.data);
          throw new platformProxy.ActionError({
            type: 'execution_failed',
            message: 'Failed to execute SHOW ROLES statement',
            code: failure.success ? failure.data.code : undefined,
          });
        }

        resultData = pollResponse.data;
      } else if (response.status === 200) {
        resultData = response.data;
      } else {
        const failure = SnowflakeResultSetSchema.safeParse(response.data);
        throw new platformProxy.ActionError({
          type: 'submission_failed',
          message: 'Failed to submit SHOW ROLES statement',
          code: failure.success ? failure.data.code : undefined,
        });
      }

      const resultSet = SnowflakeResultSetSchema.parse(resultData);
      const allRows = await fetchAllRows(platformProxy, resultSet);
      const roles = allRows.map(row => mapRowToRole(row));

      return { roles };
    },
  });
}
