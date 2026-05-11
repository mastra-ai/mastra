import type { BatchCreateLogsArgs, ListLogsArgs, ListLogsResponse, LiveCursor } from '@mastra/core/storage';
import type { DuckDBConnection } from '../../db/index';
import { buildWhereClause, buildOrderByClause, buildPaginationClause } from './filters';
import {
  createIngestedAt,
  createLiveCursor,
  createSyntheticNowCursor,
  getLiveCursorParts,
  normalizeObservabilityListArgs,
  parseJson,
  parseJsonArray,
  toDate,
  v,
  jsonV,
} from './helpers';

const COLUMNS = [
  'logId',
  'timestamp',
  'ingestedAt',
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

function rowToLogLiveCursor(row: Record<string, unknown>): LiveCursor | null {
  if (row.ingestedAt == null || row.logId == null) return null;
  return createLiveCursor(row.ingestedAt, String(row.logId));
}

async function getLogsSnapshotLiveCursor(
  db: DuckDBConnection,
  filterClause: string,
  filterParams: unknown[],
): Promise<LiveCursor> {
  const rows = await db.query<Record<string, unknown>>(
    `
      SELECT ingestedAt, logId
      FROM log_events
      ${filterClause ? `${filterClause} AND ingestedAt IS NOT NULL` : 'WHERE ingestedAt IS NOT NULL'}
      ORDER BY ingestedAt DESC, logId DESC
      LIMIT 1
    `,
    filterParams,
  );

  const cursor = rows[0] ? rowToLogLiveCursor(rows[0]) : null;
  return cursor ?? createSyntheticNowCursor();
}

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
  const ingestedAt = createIngestedAt();

  const tuples = args.logs.map(log => {
    return `(${[
      v(log.logId),
      v(log.timestamp),
      v(ingestedAt),
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
  const parsed = normalizeObservabilityListArgs(args, {
    orderBy: { field: 'timestamp', direction: 'DESC' } as const,
  });
  const filters = parsed.filters ?? {};
  const filter = buildWhereClause(filters as Record<string, unknown>);

  if (parsed.mode === 'delta') {
    if (!parsed.after) {
      return {
        delta: { limit: parsed.limit, hasMore: false },
        liveCursor: await getLogsSnapshotLiveCursor(db, filter.clause, filter.params),
        logs: [],
      };
    }

    const afterCursor = getLiveCursorParts(parsed.after);

    const rows = await db.query<Record<string, unknown>>(
      `
        SELECT *
        FROM log_events
        ${
          filter.clause
            ? `${filter.clause} AND ingestedAt IS NOT NULL AND (ingestedAt > ? OR (ingestedAt = ? AND logId > ?))`
            : 'WHERE ingestedAt IS NOT NULL AND (ingestedAt > ? OR (ingestedAt = ? AND logId > ?))'
        }
        ORDER BY ingestedAt ASC, logId ASC
        LIMIT ?
      `,
      [...filter.params, afterCursor.ingestedAt, afterCursor.ingestedAt, afterCursor.tieBreaker, parsed.limit + 1],
    );

    const pageRows = rows.slice(0, parsed.limit);
    const liveCursor =
      (pageRows.length > 0 ? rowToLogLiveCursor(pageRows[pageRows.length - 1]!) : null) ?? parsed.after;

    return {
      delta: { limit: parsed.limit, hasMore: rows.length > parsed.limit },
      liveCursor,
      logs: pageRows.map(row => rowToLogRecord(row)) as ListLogsResponse['logs'],
    };
  }

  const page = Number(parsed.pagination.page);
  const perPage = Number(parsed.pagination.perPage);
  const orderByClause = buildOrderByClause(parsed.orderBy);
  const { clause: paginationClause, params: paginationParams } = buildPaginationClause({ page, perPage });

  const countResult = await db.query<{ total: number }>(
    `SELECT COUNT(*) as total FROM log_events ${filter.clause}`,
    filter.params,
  );
  const total = Number(countResult[0]?.total ?? 0);

  const rows = await db.query(`SELECT * FROM log_events ${filter.clause} ${orderByClause} ${paginationClause}`, [
    ...filter.params,
    ...paginationParams,
  ]);

  const logs = rows.map(row => rowToLogRecord(row as Record<string, unknown>)) as ListLogsResponse['logs'];
  const liveCursor = await getLogsSnapshotLiveCursor(db, filter.clause, filter.params);

  return {
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    liveCursor,
    logs,
  };
}
