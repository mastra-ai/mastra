import type {
  BatchCreateFeedbackArgs,
  CreateFeedbackArgs,
  GetFeedbackAggregateArgs,
  GetFeedbackAggregateResponse,
  GetFeedbackBreakdownArgs,
  GetFeedbackBreakdownResponse,
  GetFeedbackPercentilesArgs,
  GetFeedbackPercentilesResponse,
  GetFeedbackTimeSeriesArgs,
  GetFeedbackTimeSeriesResponse,
  ListFeedbackArgs,
  ListFeedbackResponse,
  AggregationInterval,
  AggregationType,
} from '@mastra/core/storage';
import { parseFieldKey } from '@mastra/core/utils';
import type { DuckDBConnection } from '../../db/index';
import { buildWhereClause, buildOrderByClause, buildPaginationClause } from './filters';
import { v, jsonV, toDate, parseJson, parseJsonArray } from './helpers';

type LegacyFeedbackRecord = CreateFeedbackArgs['feedback'] & {
  source?: string | null;
  userId?: string | null;
};

const FEEDBACK_GROUP_BY_COLUMNS = new Set([
  'timestamp',
  'traceId',
  'spanId',
  'experimentId',
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
  'feedbackUserId',
  'sourceId',
  'feedbackSource',
  'feedbackType',
  'value',
  'comment',
]);

function getAggregationSql(aggregation: AggregationType, measure = 'TRY_CAST(value AS DOUBLE)'): string {
  switch (aggregation) {
    case 'sum':
      return `SUM(${measure})`;
    case 'avg':
      return `AVG(${measure})`;
    case 'min':
      return `MIN(${measure})`;
    case 'max':
      return `MAX(${measure})`;
    case 'count':
      return `CAST(COUNT(${measure}) AS DOUBLE)`;
    case 'last':
      return `arg_max(${measure}, timestamp)`;
    default:
      return `SUM(${measure})`;
  }
}

function getIntervalSql(interval: AggregationInterval): string {
  switch (interval) {
    case '1m':
      return '1 minute';
    case '5m':
      return '5 minutes';
    case '15m':
      return '15 minutes';
    case '1h':
      return '1 hour';
    case '1d':
      return '1 day';
    default:
      return '1 hour';
  }
}

function getValidatedPercentiles(percentiles: number[]): number[] {
  if (!Array.isArray(percentiles) || percentiles.length === 0) {
    throw new Error('Percentiles must include at least one value between 0 and 1.');
  }

  return percentiles.map(percentile => {
    if (!Number.isFinite(percentile) || percentile < 0 || percentile > 1) {
      throw new Error('Percentiles must be finite numbers between 0 and 1.');
    }

    return percentile;
  });
}

function buildFeedbackWhereClause(
  args: Pick<GetFeedbackAggregateArgs, 'feedbackType' | 'feedbackSource' | 'filters'>,
  includeNumericGuard = false,
): { clause: string; params: unknown[] } {
  const conditions = ['feedbackType = ?'];
  const params: unknown[] = [args.feedbackType];

  if (args.feedbackSource !== undefined) {
    conditions.push('feedbackSource = ?');
    params.push(args.feedbackSource);
  }

  const { clause: filterClause, params: filterParams } = buildWhereClause(
    args.filters as Record<string, unknown> | undefined,
    { source: 'feedbackSource' },
  );
  if (filterClause) {
    conditions.push(filterClause.replace('WHERE ', ''));
    params.push(...filterParams);
  }

  if (includeNumericGuard) {
    conditions.push('TRY_CAST(value AS DOUBLE) IS NOT NULL');
  }

  return { clause: `WHERE ${conditions.join(' AND ')}`, params };
}

function resolveFeedbackGroupBy(groupBy: string[]): { key: string; selectSql: string; groupSql: string }[] {
  return groupBy.map((key, index) => {
    const column = parseFieldKey(key);
    if (!FEEDBACK_GROUP_BY_COLUMNS.has(column)) {
      throw new Error(`Invalid groupBy column(s): ${key}`);
    }

    const alias = `group_by_${index}`;
    return {
      key,
      selectSql: `${column} AS ${alias}`,
      groupSql: alias,
    };
  });
}

function toSeriesName(values: unknown[]): string {
  return values.map(value => (value === null || value === undefined ? '' : String(value))).join('|');
}

function rowToFeedbackRecord(row: Record<string, unknown>): Record<string, unknown> {
  const rawValue = row.value;
  let value: number | string = rawValue as string;
  const numValue = Number(rawValue);
  if (!isNaN(numValue)) value = numValue;

  return {
    feedbackId: row.feedbackId as string,
    timestamp: toDate(row.timestamp),
    traceId: (row.traceId as string) ?? null,
    spanId: (row.spanId as string) ?? null,
    experimentId: (row.experimentId as string) ?? null,
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
    feedbackUserId: (row.feedbackUserId as string) ?? null,
    sourceId: (row.sourceId as string) ?? null,
    source: row.feedbackSource as string,
    feedbackSource: row.feedbackSource as string,
    feedbackType: row.feedbackType as string,
    value,
    comment: (row.comment as string) ?? null,
    tags: parseJsonArray(row.tags) as string[] | null,
    metadata: parseJson(row.metadata) as Record<string, unknown> | null,
    scope: parseJson(row.scope) as Record<string, unknown> | null,
  };
}

function getComparisonDateRange(
  comparePeriod: NonNullable<GetFeedbackAggregateArgs['comparePeriod']>,
  timestamp: NonNullable<NonNullable<GetFeedbackAggregateArgs['filters']>['timestamp']>,
) {
  if (!timestamp.start || !timestamp.end) return null;

  const duration = timestamp.end.getTime() - timestamp.start.getTime();
  switch (comparePeriod) {
    case 'previous_period':
      return {
        start: new Date(timestamp.start.getTime() - duration),
        end: new Date(timestamp.end.getTime() - duration),
        startExclusive: timestamp.startExclusive,
        endExclusive: timestamp.endExclusive,
      };
    case 'previous_day':
      return {
        start: new Date(timestamp.start.getTime() - 86400000),
        end: new Date(timestamp.end.getTime() - 86400000),
        startExclusive: timestamp.startExclusive,
        endExclusive: timestamp.endExclusive,
      };
    case 'previous_week':
      return {
        start: new Date(timestamp.start.getTime() - 604800000),
        end: new Date(timestamp.end.getTime() - 604800000),
        startExclusive: timestamp.startExclusive,
        endExclusive: timestamp.endExclusive,
      };
  }
}

/** Insert a single feedback event. */
export async function createFeedback(db: DuckDBConnection, args: CreateFeedbackArgs): Promise<void> {
  const f = args.feedback as LegacyFeedbackRecord;
  const feedbackSource = f.feedbackSource ?? f.source ?? '';
  const feedbackUserId = f.feedbackUserId ?? f.userId ?? null;
  await db.execute(
    `INSERT INTO feedback_events (
      feedbackId, timestamp, traceId, spanId, experimentId,
      entityType, entityId, entityName, entityVersionId, parentEntityVersionId, parentEntityType, parentEntityId, parentEntityName, rootEntityVersionId, rootEntityType, rootEntityId, rootEntityName,
      userId, organizationId, resourceId, runId, sessionId, threadId, requestId, environment, executionSource, serviceName,
      feedbackUserId, sourceId, feedbackSource, feedbackType, value, comment, tags, metadata, scope
    )
     VALUES (${[
       v(f.feedbackId),
       v(f.timestamp),
       v(f.traceId),
       v(f.spanId ?? null),
       v(f.experimentId ?? null),
       v(f.entityType ?? null),
       v(f.entityId ?? null),
       v(f.entityName ?? null),
       v(f.entityVersionId ?? null),
       v(f.parentEntityVersionId ?? null),
       v(f.parentEntityType ?? null),
       v(f.parentEntityId ?? null),
       v(f.parentEntityName ?? null),
       v(f.rootEntityVersionId ?? null),
       v(f.rootEntityType ?? null),
       v(f.rootEntityId ?? null),
       v(f.rootEntityName ?? null),
       v(f.userId ?? null),
       v(f.organizationId ?? null),
       v(f.resourceId ?? null),
       v(f.runId ?? null),
       v(f.sessionId ?? null),
       v(f.threadId ?? null),
       v(f.requestId ?? null),
       v(f.environment ?? null),
       v(f.executionSource ?? null),
       v(f.serviceName ?? null),
       v(feedbackUserId),
       v(f.sourceId ?? null),
       v(feedbackSource),
       v(f.feedbackType),
       v(String(f.value)),
       v(f.comment ?? null),
       jsonV(f.tags ?? null),
       jsonV(f.metadata),
       jsonV(f.scope ?? null),
     ].join(', ')})
     ON CONFLICT DO NOTHING`,
  );
}

/** Insert multiple feedback events in a single statement. */
export async function batchCreateFeedback(db: DuckDBConnection, args: BatchCreateFeedbackArgs): Promise<void> {
  if (args.feedbacks.length === 0) return;

  const tuples = args.feedbacks.map(f => {
    const legacyFeedback = f as LegacyFeedbackRecord;
    const feedbackSource = legacyFeedback.feedbackSource ?? legacyFeedback.source ?? '';
    const feedbackUserId = legacyFeedback.feedbackUserId ?? legacyFeedback.userId ?? null;
    return `(${[
      v(legacyFeedback.feedbackId),
      v(legacyFeedback.timestamp),
      v(legacyFeedback.traceId),
      v(legacyFeedback.spanId ?? null),
      v(legacyFeedback.experimentId ?? null),
      v(legacyFeedback.entityType ?? null),
      v(legacyFeedback.entityId ?? null),
      v(legacyFeedback.entityName ?? null),
      v(legacyFeedback.entityVersionId ?? null),
      v(legacyFeedback.parentEntityVersionId ?? null),
      v(legacyFeedback.parentEntityType ?? null),
      v(legacyFeedback.parentEntityId ?? null),
      v(legacyFeedback.parentEntityName ?? null),
      v(legacyFeedback.rootEntityVersionId ?? null),
      v(legacyFeedback.rootEntityType ?? null),
      v(legacyFeedback.rootEntityId ?? null),
      v(legacyFeedback.rootEntityName ?? null),
      v(legacyFeedback.userId ?? null),
      v(legacyFeedback.organizationId ?? null),
      v(legacyFeedback.resourceId ?? null),
      v(legacyFeedback.runId ?? null),
      v(legacyFeedback.sessionId ?? null),
      v(legacyFeedback.threadId ?? null),
      v(legacyFeedback.requestId ?? null),
      v(legacyFeedback.environment ?? null),
      v(legacyFeedback.executionSource ?? null),
      v(legacyFeedback.serviceName ?? null),
      v(feedbackUserId),
      v(legacyFeedback.sourceId ?? null),
      v(feedbackSource),
      v(legacyFeedback.feedbackType),
      v(String(legacyFeedback.value)),
      v(legacyFeedback.comment ?? null),
      jsonV(legacyFeedback.tags ?? null),
      jsonV(legacyFeedback.metadata),
      jsonV(legacyFeedback.scope ?? null),
    ].join(', ')})`;
  });

  await db.execute(
    `INSERT INTO feedback_events (
      feedbackId, timestamp, traceId, spanId, experimentId,
      entityType, entityId, entityName, entityVersionId, parentEntityVersionId, parentEntityType, parentEntityId, parentEntityName, rootEntityVersionId, rootEntityType, rootEntityId, rootEntityName,
      userId, organizationId, resourceId, runId, sessionId, threadId, requestId, environment, executionSource, serviceName,
      feedbackUserId, sourceId, feedbackSource, feedbackType, value, comment, tags, metadata, scope
    )
     VALUES ${tuples.join(',\n       ')}
     ON CONFLICT DO NOTHING`,
  );
}

/** Query feedback events with filtering, ordering, and pagination. */
export async function listFeedback(db: DuckDBConnection, args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
  const filters = args.filters ?? {};
  const page = Number(args.pagination?.page ?? 0);
  const perPage = Number(args.pagination?.perPage ?? 10);
  const orderBy = { field: args.orderBy?.field ?? 'timestamp', direction: args.orderBy?.direction ?? 'DESC' } as const;

  const { clause: filterClause, params: filterParams } = buildWhereClause(filters as Record<string, unknown>, {
    source: 'feedbackSource',
  });
  const orderByClause = buildOrderByClause(orderBy);
  const { clause: paginationClause, params: paginationParams } = buildPaginationClause({ page, perPage });

  const countResult = await db.query<{ total: number }>(
    `SELECT COUNT(*) as total FROM feedback_events ${filterClause}`,
    filterParams,
  );
  const total = Number(countResult[0]?.total ?? 0);

  const rows = await db.query<Record<string, unknown>>(
    `SELECT * FROM feedback_events ${filterClause} ${orderByClause} ${paginationClause}`,
    [...filterParams, ...paginationParams],
  );

  return {
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    feedback: rows.map(row => rowToFeedbackRecord(row)) as ListFeedbackResponse['feedback'],
  };
}

export async function getFeedbackAggregate(
  db: DuckDBConnection,
  args: GetFeedbackAggregateArgs,
): Promise<GetFeedbackAggregateResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const { clause, params } = buildFeedbackWhereClause(args, true);
  const rows = await db.query<Record<string, unknown>>(
    `SELECT ${aggSql} AS value FROM feedback_events ${clause}`,
    params,
  );
  const value = rows[0]?.value === null || rows[0]?.value === undefined ? null : Number(rows[0]?.value);

  if (args.comparePeriod && args.filters?.timestamp) {
    const previousTimestamp = getComparisonDateRange(args.comparePeriod, args.filters.timestamp);
    if (previousTimestamp) {
      const previousWhere = buildFeedbackWhereClause(
        {
          ...args,
          filters: { ...(args.filters ?? {}), timestamp: previousTimestamp },
        },
        true,
      );
      const prevRows = await db.query<Record<string, unknown>>(
        `SELECT ${aggSql} AS value FROM feedback_events ${previousWhere.clause}`,
        previousWhere.params,
      );
      const previousValue =
        prevRows[0]?.value === null || prevRows[0]?.value === undefined ? null : Number(prevRows[0]?.value);
      let changePercent: number | null = null;
      if (previousValue !== null && previousValue !== 0 && value !== null) {
        changePercent = ((value - previousValue) / Math.abs(previousValue)) * 100;
      }
      return { value, previousValue, changePercent };
    }
  }

  return { value };
}

export async function getFeedbackBreakdown(
  db: DuckDBConnection,
  args: GetFeedbackBreakdownArgs,
): Promise<GetFeedbackBreakdownResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const { clause, params } = buildFeedbackWhereClause(args, true);
  const resolvedGroupBy = resolveFeedbackGroupBy(args.groupBy);
  const sql = `SELECT ${resolvedGroupBy.map(entry => entry.selectSql).join(', ')}, ${aggSql} AS value FROM feedback_events ${clause} GROUP BY ${resolvedGroupBy
    .map(entry => entry.groupSql)
    .join(', ')} ORDER BY value DESC`;
  const rows = await db.query<Record<string, unknown>>(sql, params);

  return {
    groups: rows.map(row => ({
      dimensions: Object.fromEntries(
        resolvedGroupBy.map((entry, index) => {
          const value = row[`group_by_${index}`];
          return [entry.key, value === null || value === undefined ? null : String(value)];
        }),
      ),
      value: Number(row.value ?? 0),
    })),
  };
}

export async function getFeedbackTimeSeries(
  db: DuckDBConnection,
  args: GetFeedbackTimeSeriesArgs,
): Promise<GetFeedbackTimeSeriesResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const intervalSql = getIntervalSql(args.interval);
  const { clause, params } = buildFeedbackWhereClause(args, true);

  if (args.groupBy && args.groupBy.length > 0) {
    const resolvedGroupBy = resolveFeedbackGroupBy(args.groupBy);
    const sql = `
      SELECT time_bucket(INTERVAL '${intervalSql}', timestamp) AS bucket,
             ${resolvedGroupBy.map(entry => entry.selectSql).join(', ')},
             ${aggSql} AS value
      FROM feedback_events ${clause}
      GROUP BY bucket, ${resolvedGroupBy.map(entry => entry.groupSql).join(', ')}
      ORDER BY bucket
    `;
    const rows = await db.query<Record<string, unknown>>(sql, params);
    const seriesMap = new Map<string, { name: string; points: { timestamp: Date; value: number }[] }>();

    for (const row of rows) {
      const groupValues = resolvedGroupBy.map((_, index) => row[`group_by_${index}`]);
      const key = JSON.stringify(groupValues);
      if (!seriesMap.has(key)) {
        seriesMap.set(key, { name: toSeriesName(groupValues), points: [] });
      }
      seriesMap.get(key)!.points.push({
        timestamp: row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket)),
        value: Number(row.value ?? 0),
      });
    }

    return { series: Array.from(seriesMap.values()) };
  }

  const rows = await db.query<Record<string, unknown>>(
    `
      SELECT time_bucket(INTERVAL '${intervalSql}', timestamp) AS bucket,
             ${aggSql} AS value
      FROM feedback_events ${clause}
      GROUP BY bucket
      ORDER BY bucket
    `,
    params,
  );

  return {
    series: [
      {
        name: args.feedbackSource ? `${args.feedbackType}|${args.feedbackSource}` : args.feedbackType,
        points: rows.map(row => ({
          timestamp: row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket)),
          value: Number(row.value ?? 0),
        })),
      },
    ],
  };
}

export async function getFeedbackPercentiles(
  db: DuckDBConnection,
  args: GetFeedbackPercentilesArgs,
): Promise<GetFeedbackPercentilesResponse> {
  const intervalSql = getIntervalSql(args.interval);
  const { clause, params } = buildFeedbackWhereClause(args, true);
  const percentiles = getValidatedPercentiles(args.percentiles);

  const series = [];
  for (const percentile of percentiles) {
    const rows = await db.query<Record<string, unknown>>(
      `
        SELECT time_bucket(INTERVAL '${intervalSql}', timestamp) AS bucket,
               percentile_cont(${percentile}) WITHIN GROUP (ORDER BY TRY_CAST(value AS DOUBLE)) AS pvalue
        FROM feedback_events ${clause}
        GROUP BY bucket
        ORDER BY bucket
      `,
      params,
    );

    series.push({
      percentile,
      points: rows.map(row => ({
        timestamp: row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket)),
        value: Number(row.pvalue ?? 0),
      })),
    });
  }

  return { series };
}
