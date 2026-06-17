/**
 * Log operations for the v-next Postgres observability domain.
 */

import { listLogsArgsSchema } from '@mastra/core/storage';
import type { BatchCreateLogsArgs, ListLogsArgs, ListLogsResponse } from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_LOG_EVENTS } from './ddl';
import { applyCommonFilters, applySingleOrArrayFilter } from './filters';
import type { FilterAccumulator } from './filters';
import { logRecordToRow, rowToLogRecord } from './helpers';
import { listSignalDelta, listSignalPage } from './listing';
import { assertDeltaPollingEnabled, deltaPollingFeatureEnabled } from './polling';
import { buildInsert, LOG_SELECT_COLUMNS } from './sql';

function applyLogFilters(acc: FilterAccumulator, filters: ListLogsArgs['filters']): void {
  applyCommonFilters(acc, filters);
  applySingleOrArrayFilter(acc, 'level', filters?.level);
}

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
  return listSignalPage({
    client,
    table,
    filters,
    page,
    perPage,
    orderField,
    orderDir,
    includeDeltaCursor: deltaPollingFeatureEnabled(),
    selectColumns: LOG_SELECT_COLUMNS,
    responseKey: 'logs',
    applyFilters: applyLogFilters,
    mapRow: rowToLogRecord,
  });
}

async function listLogsDelta(
  client: DbClient,
  table: string,
  filters: ListLogsArgs['filters'],
  after: string | undefined,
  limit: number,
): Promise<ListLogsResponse> {
  return listSignalDelta({
    client,
    table,
    filters,
    after,
    limit,
    selectColumns: LOG_SELECT_COLUMNS,
    responseKey: 'logs',
    applyFilters: applyLogFilters,
    mapRow: rowToLogRecord,
  });
}
