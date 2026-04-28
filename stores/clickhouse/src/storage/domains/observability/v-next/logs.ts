import type { ClickHouseClient } from '@clickhouse/client';
import { listLogsArgsSchema } from '@mastra/core/storage';
import type { BatchCreateLogsArgs, ListLogsArgs, ListLogsResponse } from '@mastra/core/storage';

import { TABLE_LOG_EVENTS } from './ddl';
import { buildLogsFilterConditions, buildPaginationClause, buildSignalOrderByClause } from './filters';
import { CH_INSERT_SETTINGS, CH_SETTINGS, logRecordToRow, rowToLogRecord } from './helpers';

export async function batchCreateLogs(client: ClickHouseClient, args: BatchCreateLogsArgs): Promise<void> {
  if (args.logs.length === 0) return;

  await client.insert({
    table: TABLE_LOG_EVENTS,
    values: args.logs.map(logRecordToRow),
    format: 'JSONEachRow',
    clickhouse_settings: CH_INSERT_SETTINGS,
  });
}

export async function listLogs(client: ClickHouseClient, args: ListLogsArgs): Promise<ListLogsResponse> {
  const parsed = listLogsArgsSchema.parse(args);
  const filter = buildLogsFilterConditions(parsed.filters, 'l');
  const pagination = buildPaginationClause(parsed.pagination);
  const orderBy = buildSignalOrderByClause(['timestamp'], parsed.orderBy, 'l');
  const whereClause = filter.conditions.length ? `WHERE ${filter.conditions.join(' AND ')}` : '';

  const countResult = (await (
    await client.query({
      query: `SELECT count() AS total FROM ${TABLE_LOG_EVENTS} AS l ${whereClause}`,
      query_params: filter.params,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as Array<{ total?: number }>;

  const rows = (await (
    await client.query({
      query: `
        SELECT *
        FROM ${TABLE_LOG_EVENTS} AS l
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT {limit:UInt32} OFFSET {offset:UInt32}
      `,
      query_params: {
        ...filter.params,
        limit: pagination.limit,
        offset: pagination.offset,
      },
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as Record<string, any>[];

  const total = Number(countResult[0]?.total ?? 0);

  return {
    pagination: {
      total,
      page: pagination.page,
      perPage: pagination.perPage,
      hasMore: (pagination.page + 1) * pagination.perPage < total,
    },
    logs: rows.map(rowToLogRecord),
  };
}
