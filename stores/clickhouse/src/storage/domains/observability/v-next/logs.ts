import type { ClickHouseClient } from '@clickhouse/client';
import { listLogsArgsSchema } from '@mastra/core/storage';
import type { BatchCreateLogsArgs, ListLogsArgs, ListLogsResponse } from '@mastra/core/storage';

import { TABLE_LOG_EVENTS, TABLE_LOG_EVENTS_DELTA } from './ddl';
import { buildLogsFilterConditions, buildPaginationClause, buildSignalOrderByClause } from './filters';
import { CH_INSERT_SETTINGS, CH_SETTINGS, logRecordToRow, rowToLogRecord } from './helpers';
import type { ClickHouseDeltaCursorStrategy, ClickHouseDeltaCursor } from './polling';
import {
  assertCursorKind,
  assertDeltaPollingSupported,
  buildTupleCursorFilter,
  decodeDeltaCursor,
  deltaPollingFeatureEnabled,
  encodeDeltaCursor,
  invalidDeltaCursorError,
} from './polling';

const TUPLE_CURSOR_MIN_INGESTED_AT = '1970-01-01 00:00:00.000000000';
const TUPLE_CURSOR_MIN_TIMESTAMP = '1970-01-01 00:00:00.000';

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
  const deltaCursorEnabled = deltaPollingFeatureEnabled() && strategy !== null;
  const filter = buildLogsFilterConditions(parsed.filters, 'l');
  const pagination = buildPaginationClause(parsed.pagination);
  const orderBy = buildSignalOrderByClause(['timestamp'], parsed.orderBy, 'l');
  const whereClause = filter.conditions.length ? `WHERE ${filter.conditions.join(' AND ')}` : '';

  if (parsed.mode === 'delta') {
    assertDeltaPollingSupported(strategy);

    const currentDeltaCursor = await getDeltaCursor(client, whereClause, filter.params, strategy);
    if (parsed.after === undefined) {
      return {
        logs: [],
        delta: { limit: parsed.limit, hasMore: false },
        deltaCursor: currentDeltaCursor,
      };
    }

    const afterCursor = decodeDeltaCursor(parsed.after);
    const rows =
      afterCursor.kind === 'serial'
        ? await queryLogsAfterSerialCursor(
            client,
            whereClause,
            filter.params,
            parsed.limit,
            strategy,
            afterCursor.cursorId,
          )
        : await queryLogsAfterTupleCursor(
            client,
            whereClause,
            filter.params,
            parsed.limit,
            assertCursorKind(afterCursor, 'log'),
          );

    const visibleRows = rows.slice(0, parsed.limit);

    return {
      logs: visibleRows.map(rowToLogRecord),
      delta: { limit: parsed.limit, hasMore: rows.length > parsed.limit },
      deltaCursor:
        visibleRows.length > 0 ? buildLogsCursor(visibleRows[visibleRows.length - 1]!, strategy) : currentDeltaCursor,
    };
  }

  const currentDeltaCursor = deltaCursorEnabled
    ? await getDeltaCursor(client, whereClause, filter.params, strategy)
    : null;
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
  cursorIngestedAt?: string;
  timestamp: string;
  logId: string;
};

async function queryLogsAfterSerialCursor(
  client: ClickHouseClient,
  whereClause: string,
  params: Record<string, unknown>,
  limit: number,
  strategy: ClickHouseDeltaCursorStrategy,
  cursorId: string,
): Promise<LogDeltaRow[]> {
  if (strategy !== 'serial') {
    throw invalidDeltaCursorError();
  }

  return (await (
    await client.query({
      query: `
        SELECT
          l.* EXCEPT(timestamp, logId),
          l.timestamp AS timestamp,
          l.logId AS logId,
          toString(d.cursorId) AS cursorId,
          toString(d.ingestedAt) AS cursorIngestedAt
        FROM ${TABLE_LOG_EVENTS_DELTA} d
        INNER JOIN ${TABLE_LOG_EVENTS} l
          ON l.timestamp = d.timestamp
         AND l.logId = d.logId
        ${whereClause ? `${whereClause} AND d.cursorId > {afterCursor:UInt64}` : 'WHERE d.cursorId > {afterCursor:UInt64}'}
        ORDER BY d.cursorId ASC, l.logId ASC
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

async function queryLogsAfterTupleCursor(
  client: ClickHouseClient,
  whereClause: string,
  params: Record<string, unknown>,
  limit: number,
  afterCursor: Extract<ClickHouseDeltaCursor, { kind: 'log' }>,
): Promise<LogDeltaRow[]> {
  const tupleFilter = buildTupleCursorFilter([
    { expr: 'd.ingestedAt', param: 'afterIngestedAt', type: `DateTime64(9, 'UTC')`, value: afterCursor.ingestedAt },
    { expr: 'd.timestamp', param: 'afterTimestamp', type: `DateTime64(3, 'UTC')`, value: afterCursor.timestamp },
    { expr: 'd.logId', param: 'afterLogId', type: 'String', value: afterCursor.logId },
  ]);

  return (await (
    await client.query({
      query: `
        SELECT
          l.* EXCEPT(timestamp, logId),
          l.timestamp AS timestamp,
          l.logId AS logId,
          toString(d.ingestedAt) AS cursorIngestedAt
        FROM ${TABLE_LOG_EVENTS_DELTA} d
        INNER JOIN ${TABLE_LOG_EVENTS} l
          ON l.timestamp = d.timestamp
         AND l.logId = d.logId
        ${whereClause ? `${whereClause} AND ${tupleFilter.clause}` : `WHERE ${tupleFilter.clause}`}
        ORDER BY d.ingestedAt ASC, d.timestamp ASC, d.logId ASC
        LIMIT {fetchLimit:UInt32}
      `,
      query_params: {
        ...params,
        ...tupleFilter.params,
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
  strategy: ClickHouseDeltaCursorStrategy,
): Promise<string | null> {
  if (strategy === 'serial') {
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
      return encodeDeltaCursor({ version: 1, kind: 'serial', cursorId });
    }

    const streamRows = (await (
      await client.query({
        query: `SELECT toString(max(cursorId)) AS cursorId FROM ${TABLE_LOG_EVENTS_DELTA}`,
        format: 'JSONEachRow',
        clickhouse_settings: CH_SETTINGS,
      })
    ).json()) as Array<{ cursorId?: string | null }>;

    return encodeDeltaCursor({ version: 1, kind: 'serial', cursorId: streamRows[0]?.cursorId ?? '0' });
  }

  const rows = (await (
    await client.query({
      query: `
        SELECT
          toString(d.ingestedAt) AS cursorIngestedAt,
          toString(d.timestamp) AS timestamp,
          d.logId AS logId
        FROM ${TABLE_LOG_EVENTS_DELTA} d
        INNER JOIN ${TABLE_LOG_EVENTS} l
          ON l.timestamp = d.timestamp
         AND l.logId = d.logId
        ${whereClause}
        ORDER BY d.ingestedAt DESC, d.timestamp DESC, d.logId DESC
        LIMIT 1
      `,
      query_params: params,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as Array<{ cursorIngestedAt?: string; timestamp?: string; logId?: string }>;

  const row = rows[0];
  if (row?.cursorIngestedAt && row.timestamp && row.logId) {
    return encodeDeltaCursor({
      version: 1,
      kind: 'log',
      ingestedAt: row.cursorIngestedAt,
      timestamp: row.timestamp,
      logId: row.logId,
    });
  }

  const streamRows = (await (
    await client.query({
      query: `
        SELECT
          toString(ingestedAt) AS cursorIngestedAt,
          toString(timestamp) AS timestamp,
          logId AS logId
        FROM ${TABLE_LOG_EVENTS_DELTA}
        ORDER BY ingestedAt DESC, timestamp DESC, logId DESC
        LIMIT 1
      `,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as Array<{ cursorIngestedAt?: string; timestamp?: string; logId?: string }>;

  const streamRow = streamRows[0];
  return encodeDeltaCursor({
    version: 1,
    kind: 'log',
    ingestedAt: streamRow?.cursorIngestedAt ?? TUPLE_CURSOR_MIN_INGESTED_AT,
    timestamp: streamRow?.timestamp ?? TUPLE_CURSOR_MIN_TIMESTAMP,
    logId: streamRow?.logId ?? '0',
  });
}

function buildLogsCursor(row: LogDeltaRow, strategy: ClickHouseDeltaCursorStrategy): string | null {
  if (strategy === 'serial') {
    return row.cursorId ? encodeDeltaCursor({ version: 1, kind: 'serial', cursorId: row.cursorId }) : null;
  }

  return row.cursorIngestedAt
    ? encodeDeltaCursor({
        version: 1,
        kind: 'log',
        ingestedAt: row.cursorIngestedAt,
        timestamp: row.timestamp,
        logId: row.logId,
      })
    : null;
}
