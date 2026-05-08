/**
 * Log operations for the v-next Postgres observability domain.
 */

import { listLogsArgsSchema } from '@mastra/core/storage';
import type { BatchCreateLogsArgs, ListLogsArgs, ListLogsResponse, LogRecord } from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_LOG_EVENTS } from './ddl';
import { applyCommonFilters, applySingleOrArrayFilter, newFilterAccumulator, whereOrEmpty } from './filters';
import { logRecordToRow, rowToLogRecord } from './helpers';
import { buildInsert, LOG_SELECT_COLUMNS } from './sql';

export async function batchCreateLogs(client: DbClient, schema: string, args: BatchCreateLogsArgs): Promise<void> {
  if (args.logs.length === 0) return;
  const rows = args.logs.map(logRecordToRow);
  const insert = buildInsert(schema, TABLE_LOG_EVENTS, rows);
  if (insert) await client.query(insert.text, insert.values);
}

export async function listLogs(client: DbClient, schema: string, args: ListLogsArgs): Promise<ListLogsResponse> {
  const { filters, pagination, orderBy } = listLogsArgsSchema.parse(args);
  const page = pagination?.page ?? 0;
  const perPage = pagination?.perPage ?? 10;

  const table = qualifiedTable(schema, TABLE_LOG_EVENTS);
  const acc = newFilterAccumulator();
  applyCommonFilters(acc, filters);
  applySingleOrArrayFilter(acc, 'level', filters?.level);

  const whereClause = whereOrEmpty(acc);
  const orderField = orderBy?.field ?? 'timestamp';
  const orderDir = orderBy?.direction ?? 'DESC';

  const countRow = await client.oneOrNone<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} ${whereClause}`,
    acc.params,
  );
  const count = Number(countRow?.count ?? 0);
  if (count === 0) {
    return { pagination: { total: 0, page, perPage, hasMore: false }, logs: [] };
  }

  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT ${LOG_SELECT_COLUMNS}
     FROM ${table}
     ${whereClause}
     ORDER BY "${orderField}" ${orderDir}
     LIMIT $${acc.next++} OFFSET $${acc.next++}`,
    [...acc.params, perPage, page * perPage],
  );

  const logs: LogRecord[] = rows.map(rowToLogRecord);
  return {
    pagination: { total: count, page, perPage, hasMore: (page + 1) * perPage < count },
    logs,
  };
}
