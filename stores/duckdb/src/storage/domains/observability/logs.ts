import { listLogsArgsSchema } from '@mastra/core/storage';
import type { BatchCreateLogsArgs, ListLogsArgs, ListLogsResponse } from '@mastra/core/storage';
import type { DuckDBConnection } from '../../db/index';
import { buildWhereClause, buildOrderByClause, buildPaginationClause } from './filters';
import { v, jsonV, toDate, parseJson, parseJsonArray } from './helpers';
import {
  assertDeltaPollingEnabled,
  deltaPollingFeatureEnabled,
  encodeDeltaCursor,
  extendWhereClause,
  validateCursorId,
} from './polling';

const COLUMNS = [
  'logId',
  'timestamp',
  'cursorId',
  'level',
  'message',
  'data',
  'traceId',
  'spanId',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityVersionId',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'rootEntityVersionId',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'executionSource',
  'serviceName',
  'experimentId',
  'tags',
  'metadata',
  'scope',
] as const;

const COLUMNS_SQL = COLUMNS.join(', ');

function rowToLogRecord(row: Record<string, unknown>): Record<string, unknown> {
  return {
    logId: row.logId as string,
    timestamp: toDate(row.timestamp),
    level: row.level as string,
    message: row.message as string,
    data: parseJson(row.data),
    traceId: (row.traceId as string) ?? null,
    spanId: (row.spanId as string) ?? null,
    entityType: (row.entityType as string) ?? null,
    entityId: (row.entityId as string) ?? null,
    entityName: (row.entityName as string) ?? null,
    entityVersionId: (row.entityVersionId as string) ?? null,
    parentEntityVersionId: (row.parentEntityVersionId as string) ?? null,
    parentEntityType: (row.parentEntityType as string) ?? null,
    parentEntityId: (row.parentEntityId as string) ?? null,
    parentEntityName: (row.parentEntityName as string) ?? null,
    rootEntityVersionId: (row.rootEntityVersionId as string) ?? null,
    rootEntityType: (row.rootEntityType as string) ?? null,
    rootEntityId: (row.rootEntityId as string) ?? null,
    rootEntityName: (row.rootEntityName as string) ?? null,
    userId: (row.userId as string) ?? null,
    organizationId: (row.organizationId as string) ?? null,
    resourceId: (row.resourceId as string) ?? null,
    runId: (row.runId as string) ?? null,
    sessionId: (row.sessionId as string) ?? null,
    threadId: (row.threadId as string) ?? null,
    requestId: (row.requestId as string) ?? null,
    environment: (row.environment as string) ?? null,
    executionSource: (row.executionSource as string) ?? null,
    serviceName: (row.serviceName as string) ?? null,
    experimentId: (row.experimentId as string) ?? null,
    tags: parseJsonArray(row.tags),
    metadata: parseJson(row.metadata),
    scope: parseJson(row.scope),
  };
}

/** Insert multiple log events in a single statement. */
export async function batchCreateLogs(db: DuckDBConnection, args: BatchCreateLogsArgs): Promise<void> {
  if (args.logs.length === 0) return;

  const tuples = args.logs.map(log => {
    return `(${[
      v(log.logId),
      v(log.timestamp),
      "nextval('log_events_cursor_id_seq')",
      v(log.level),
      v(log.message),
      jsonV(log.data),
      v(log.traceId ?? null),
      v(log.spanId ?? null),
      v(log.entityType ?? null),
      v(log.entityId ?? null),
      v(log.entityName ?? null),
      v(log.entityVersionId ?? null),
      v(log.parentEntityVersionId ?? null),
      v(log.parentEntityType ?? null),
      v(log.parentEntityId ?? null),
      v(log.parentEntityName ?? null),
      v(log.rootEntityVersionId ?? null),
      v(log.rootEntityType ?? null),
      v(log.rootEntityId ?? null),
      v(log.rootEntityName ?? null),
      v(log.userId ?? null),
      v(log.organizationId ?? null),
      v(log.resourceId ?? null),
      v(log.runId ?? null),
      v(log.sessionId ?? null),
      v(log.threadId ?? null),
      v(log.requestId ?? null),
      v(log.environment ?? null),
      v(log.executionSource ?? null),
      v(log.serviceName ?? null),
      v(log.experimentId ?? null),
      jsonV(log.tags),
      jsonV(log.metadata),
      jsonV(log.scope),
    ].join(', ')})`;
  });

  await db.execute(`INSERT INTO log_events (${COLUMNS_SQL}) VALUES ${tuples.join(',\n')} ON CONFLICT DO NOTHING`);
}

/** Query log events with filtering, ordering, and pagination. */
export async function listLogs(db: DuckDBConnection, args: ListLogsArgs): Promise<ListLogsResponse> {
  const { mode, filters, pagination, orderBy, after, limit } = listLogsArgsSchema.parse(args);
  const filterRecord = filters as Record<string, unknown> | undefined;
  const page = Number(pagination.page);
  const perPage = Number(pagination.perPage);

  const { clause: filterClause, params: filterParams } = buildWhereClause(filterRecord);

  if (mode === 'delta') {
    assertDeltaPollingEnabled();

    const streamHeadCursor = await getStreamHeadCursor(db);
    if (after === undefined) {
      return {
        logs: [],
        delta: { limit, hasMore: false },
        deltaCursor: streamHeadCursor,
      };
    }

    const afterCursorId = validateCursorId(after);
    const deltaWhereClause = extendWhereClause(filterClause, ['cursorId IS NOT NULL', `cursorId > CAST(? AS BIGINT)`]);
    const rows = await db.query<Record<string, unknown>>(
      `SELECT * FROM log_events ${deltaWhereClause} ORDER BY cursorId ASC LIMIT ?`,
      [...filterParams, afterCursorId, limit + 1],
    );

    const visibleRows = rows.slice(0, limit).map(row => ({
      cursorId: row.cursorId,
      log: rowToLogRecord(row),
    }));

    return {
      logs: visibleRows.map(row => row.log) as ListLogsResponse['logs'],
      delta: { limit, hasMore: rows.length > limit },
      deltaCursor:
        visibleRows.length > 0 ? encodeDeltaCursor(visibleRows[visibleRows.length - 1]?.cursorId) : streamHeadCursor,
    };
  }

  const orderByClause = buildOrderByClause(orderBy);
  const { clause: paginationClause, params: paginationParams } = buildPaginationClause({ page, perPage });
  const currentDeltaCursor = deltaPollingFeatureEnabled()
    ? await getDeltaCursor(db, filterClause, filterParams)
    : undefined;

  const countResult = await db.query<{ total: number }>(
    `SELECT COUNT(*) as total FROM log_events ${filterClause}`,
    filterParams,
  );
  const total = Number(countResult[0]?.total ?? 0);

  const rows = await db.query(`SELECT * FROM log_events ${filterClause} ${orderByClause} ${paginationClause}`, [
    ...filterParams,
    ...paginationParams,
  ]);

  const logs = rows.map(row => rowToLogRecord(row as Record<string, unknown>)) as ListLogsResponse['logs'];

  return {
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    logs,
    ...(deltaPollingFeatureEnabled() ? { deltaCursor: currentDeltaCursor } : {}),
  };
}

async function getDeltaCursor(db: DuckDBConnection, filterClause: string, filterParams: unknown[]): Promise<string> {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT max(cursorId) AS cursorId FROM log_events ${filterClause}`,
    filterParams,
  );

  const cursorId = rows[0]?.cursorId;
  if (cursorId !== null && cursorId !== undefined) {
    return encodeDeltaCursor(cursorId);
  }

  const streamRows = await db.query<Record<string, unknown>>(`SELECT max(cursorId) AS cursorId FROM log_events`);
  return encodeDeltaCursor(streamRows[0]?.cursorId);
}

async function getStreamHeadCursor(db: DuckDBConnection): Promise<string> {
  const streamRows = await db.query<Record<string, unknown>>(`SELECT max(cursorId) AS cursorId FROM log_events`);
  return encodeDeltaCursor(streamRows[0]?.cursorId);
}
