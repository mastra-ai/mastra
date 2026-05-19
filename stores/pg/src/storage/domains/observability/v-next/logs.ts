/**
 * Log operations for the v-next Postgres observability domain.
 */

import { listLogsArgsSchema } from '@mastra/core/storage';
import type { BatchCreateLogsArgs, ListLogsArgs, ListLogsResponse, LogRecord } from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_LOG_EVENTS } from './ddl';
import { applyCommonFilters, applySingleOrArrayFilter, newFilterAccumulator, whereOrEmpty } from './filters';
import { logRecordToRow, rowToLogRecord } from './helpers';
import { assertDeltaPollingEnabled, deltaPollingFeatureEnabled, encodeDeltaCursor, validateCursorId } from './polling';
import { buildInsert, LOG_SELECT_COLUMNS } from './sql';

export async function batchCreateLogs(client: DbClient, schema: string, args: BatchCreateLogsArgs): Promise<void> {
  if (args.logs.length === 0) return;
  const rows = args.logs.map(logRecordToRow);
  const insert = buildInsert(schema, TABLE_LOG_EVENTS, rows);
  if (insert) await client.query(insert.text, insert.values);
}

export async function listLogs(client: DbClient, schema: string, args: ListLogsArgs): Promise<ListLogsResponse> {
  const { mode, filters, pagination, orderBy, after, limit } = listLogsArgsSchema.parse(args);
  const table = qualifiedTable(schema, TABLE_LOG_EVENTS);

  if (mode === 'delta') {
    assertDeltaPollingEnabled();
    return listLogsDelta(client, table, filters, after, limit);
  }

  return listLogsPage(client, table, filters, pagination.page, pagination.perPage, orderBy.field, orderBy.direction);
}

async function listLogsPage(
  client: DbClient,
  table: string,
  filters: ListLogsArgs['filters'],
  page: number,
  perPage: number,
  orderField: 'timestamp',
  orderDir: 'ASC' | 'DESC',
): Promise<ListLogsResponse> {
  const acc = newFilterAccumulator();
  applyCommonFilters(acc, filters);
  applySingleOrArrayFilter(acc, 'level', filters?.level);
  const whereClause = whereOrEmpty(acc);

  const countRow = await client.oneOrNone<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} ${whereClause}`,
    acc.params,
  );
  const count = Number(countRow?.count ?? 0);

  let logs: LogRecord[] = [];
  if (count > 0) {
    const rows = await client.manyOrNone<Record<string, any>>(
      `SELECT ${LOG_SELECT_COLUMNS}
       FROM ${table}
       ${whereClause}
       ORDER BY "${orderField}" ${orderDir}
       LIMIT $${acc.next++} OFFSET $${acc.next++}`,
      [...acc.params, perPage, page * perPage],
    );
    logs = rows.map(rowToLogRecord);
  }

  const deltaCursor = deltaPollingFeatureEnabled() ? await readStreamHeadCursor(client, table, filters) : undefined;

  return {
    pagination: { total: count, page, perPage, hasMore: (page + 1) * perPage < count },
    logs,
    ...(deltaCursor !== undefined ? { deltaCursor } : {}),
  };
}

async function listLogsDelta(
  client: DbClient,
  table: string,
  filters: ListLogsArgs['filters'],
  after: string | undefined,
  limit: number,
): Promise<ListLogsResponse> {
  // Bootstrap: no cursor yet → return the current stream head so the caller can poll forward.
  if (after === undefined) {
    const deltaCursor = await readStreamHeadCursor(client, table, filters);
    return { logs: [], delta: { limit, hasMore: false }, deltaCursor };
  }

  const afterId = validateCursorId(after);
  const acc = newFilterAccumulator();
  applyCommonFilters(acc, filters);
  applySingleOrArrayFilter(acc, 'level', filters?.level);
  acc.conditions.push(`"cursorId" > $${acc.next++}::bigint`);
  acc.params.push(afterId);

  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT ${LOG_SELECT_COLUMNS}
     FROM ${table}
     ${whereOrEmpty(acc)}
     ORDER BY "cursorId" ASC
     LIMIT $${acc.next++}`,
    [...acc.params, limit + 1],
  );

  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  const deltaCursor =
    visible.length > 0
      ? encodeDeltaCursor(visible[visible.length - 1]!.cursorId)
      : await readStreamHeadCursor(client, table, filters);

  return {
    logs: visible.map(rowToLogRecord),
    delta: { limit, hasMore },
    deltaCursor,
  };
}

/**
 * Returns the current head cursor for the (optionally filtered) stream.
 * Falls back to the unfiltered head when the filtered set is empty so the
 * caller can resume polling against the whole table later.
 */
async function readStreamHeadCursor(
  client: DbClient,
  table: string,
  filters: ListLogsArgs['filters'],
): Promise<string> {
  const acc = newFilterAccumulator();
  applyCommonFilters(acc, filters);
  applySingleOrArrayFilter(acc, 'level', filters?.level);
  const filtered = await client.oneOrNone<{ cursorId: string | null }>(
    `SELECT MAX("cursorId")::text AS "cursorId" FROM ${table} ${whereOrEmpty(acc)}`,
    acc.params,
  );
  if (filtered?.cursorId != null) return encodeDeltaCursor(filtered.cursorId);

  const head = await client.oneOrNone<{ cursorId: string | null }>(
    `SELECT MAX("cursorId")::text AS "cursorId" FROM ${table}`,
  );
  return encodeDeltaCursor(head?.cursorId);
}
