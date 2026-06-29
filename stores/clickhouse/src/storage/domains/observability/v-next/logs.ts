import type { ClickHouseClient } from '@clickhouse/client';
import { listLogsArgsSchema } from '@mastra/core/storage';
import type { BatchCreateLogsArgs, ListLogsArgs, ListLogsResponse } from '@mastra/core/storage';

import { TABLE_LOG_EVENTS, TABLE_LOG_EVENTS_DELTA } from './ddl';
import { buildLogsFilterConditions, buildPaginationClause, buildSignalOrderByClause } from './filters';
import { CH_INSERT_SETTINGS, CH_SETTINGS, logRecordToRow, rowToLogRecord } from './helpers';
import type { ClickHouseDeltaCursorStrategy } from './polling';
import { assertDeltaPollingSupported, deltaPollingSupported, validateCursorId } from './polling';

export async function batchCreateLogs(client: ClickHouseClient, args: BatchCreateLogsArgs): Promise<void> {
  if (args.logs.length === 0) return;

  await client.insert({
    table: TABLE_LOG_EVENTS,
    values: args.logs.map(logRecordToRow),
    format: 'JSONEachRow',
    clickhouse_settings: CH_INSERT_SETTINGS,
  });
}

export async function listLogs(
  client: ClickHouseClient,
  args: ListLogsArgs,
  strategy: ClickHouseDeltaCursorStrategy | null,
): Promise<ListLogsResponse> {
  const parsed = listLogsArgsSchema.parse(args);
  const deltaCursorEnabled = deltaPollingSupported(strategy);
  const filter = buildLogsFilterConditions(parsed.filters, 'l');
  const pagination = buildPaginationClause(parsed.pagination);
  const orderBy = buildSignalOrderByClause(['timestamp'], parsed.orderBy, 'l');
  const whereClause = filter.conditions.length ? `WHERE ${filter.conditions.join(' AND ')}` : '';

  if (parsed.mode === 'delta') {
    assertDeltaPollingSupported(strategy);

    const streamHeadCursor = await getStreamHeadCursor(client);
    if (parsed.after === undefined) {
      return {
        logs: [],
        delta: { limit: parsed.limit, hasMore: false },
        deltaCursor: streamHeadCursor,
      };
    }

    const afterCursor = validateCursorId(parsed.after);
    const rows = await queryLogsAfterCursor(client, whereClause, filter.params, parsed.limit, afterCursor);

    const visibleRows = rows.slice(0, parsed.limit);

    return {
      logs: visibleRows.map(rowToLogRecord),
      delta: { limit: parsed.limit, hasMore: rows.length > parsed.limit },
      deltaCursor: visibleRows.length > 0 ? buildLogsCursor(visibleRows[visibleRows.length - 1]!) : streamHeadCursor,
    };
  }

  const currentDeltaCursor = deltaCursorEnabled ? await getDeltaCursor(client, whereClause, filter.params) : undefined;
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
    ...(deltaCursorEnabled ? { deltaCursor: currentDeltaCursor } : {}),
  };
}

type LogDeltaRow = Record<string, any> & {
  cursorId?: string;
  timestamp: string;
  logId: string;
};

async function queryLogsAfterCursor(
  client: ClickHouseClient,
  whereClause: string,
  params: Record<string, unknown>,
  limit: number,
  cursorId: string,
): Promise<LogDeltaRow[]> {
  return (await (
    await client.query({
      query: `
        SELECT
          l.* EXCEPT(timestamp, logId),
          l.timestamp AS timestamp,
          l.logId AS logId,
          toString(d.cursorId) AS cursorId
        FROM ${TABLE_LOG_EVENTS_DELTA} d
        INNER JOIN ${TABLE_LOG_EVENTS} l
          ON l.timestamp = d.timestamp
         AND l.logId = d.logId
        ${whereClause ? `${whereClause} AND d.cursorId > {afterCursor:UInt64}` : 'WHERE d.cursorId > {afterCursor:UInt64}'}
        ORDER BY d.cursorId ASC
        LIMIT {fetchLimit:UInt32}
      `,
      query_params: {
        ...params,
        afterCursor: cursorId,
        fetchLimit: limit + 1,
      },
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as LogDeltaRow[];
}

async function getDeltaCursor(
  client: ClickHouseClient,
  whereClause: string,
  params: Record<string, unknown>,
): Promise<string> {
  const rows = (await (
    await client.query({
      query: `
        SELECT toString(max(d.cursorId)) AS cursorId
        FROM ${TABLE_LOG_EVENTS_DELTA} d
        INNER JOIN ${TABLE_LOG_EVENTS} l
          ON l.timestamp = d.timestamp
         AND l.logId = d.logId
        ${whereClause}
      `,
      query_params: params,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as Array<{ cursorId?: string | null }>;

  const cursorId = rows[0]?.cursorId ?? null;
  if (cursorId) {
    return cursorId;
  }

  const streamRows = (await (
    await client.query({
      query: `SELECT toString(max(cursorId)) AS cursorId FROM ${TABLE_LOG_EVENTS_DELTA}`,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as Array<{ cursorId?: string | null }>;

  return streamRows[0]?.cursorId ?? '0';
}

async function getStreamHeadCursor(client: ClickHouseClient): Promise<string> {
  const streamRows = (await (
    await client.query({
      query: `SELECT toString(max(cursorId)) AS cursorId FROM ${TABLE_LOG_EVENTS_DELTA}`,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as Array<{ cursorId?: string | null }>;

  return streamRows[0]?.cursorId ?? '0';
}

function buildLogsCursor(row: LogDeltaRow): string {
  return row.cursorId ?? '0';
}
