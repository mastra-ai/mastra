import type {
  BatchCreateScoresArgs,
  CreateScoreArgs,
  GetScoreAggregateArgs,
  GetScoreAggregateResponse,
  GetScoreBreakdownArgs,
  GetScoreBreakdownResponse,
  GetScorePercentilesArgs,
  GetScorePercentilesResponse,
  GetScoreTimeSeriesArgs,
  GetScoreTimeSeriesResponse,
  ListScoresArgs,
  ListScoresResponse,
  ScoreRecord,
  AggregationInterval,
  AggregationType,
} from '@mastra/core/storage';
import { parseFieldKey } from '@mastra/core/utils';
import type { DuckDBConnection } from '../../db/index';
import { buildWhereClause, buildOrderByClause, buildPaginationClause } from './filters';
import { v, jsonV, toDate, parseJson, parseJsonArray } from './helpers';

type LegacyScoreRecord = CreateScoreArgs['score'] & {
  source?: string | null;
};

const SCORE_GROUP_BY_COLUMNS = new Set([
  'timestamp',
  'traceId',
  'spanId',
  'experimentId',
  'scoreTraceId',
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
  'scorerId',
  'scorerVersion',
  'scoreSource',
  'score',
  'reason',
]);

function getAggregationSql(aggregation: AggregationType, measure = 'score'): string {
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

function buildScoreWhereClause(args: Pick<GetScoreAggregateArgs, 'scorerId' | 'scoreSource' | 'filters'>): {
  clause: string;
  params: unknown[];
} {
  const conditions = ['scorerId = ?'];
  const params: unknown[] = [args.scorerId];

  if (args.scoreSource !== undefined) {
    conditions.push('scoreSource = ?');
    params.push(args.scoreSource);
  }

  const { clause: filterClause, params: filterParams } = buildWhereClause(
    args.filters as Record<string, unknown> | undefined,
    { source: 'scoreSource' },
  );
  if (filterClause) {
    conditions.push(filterClause.replace('WHERE ', ''));
    params.push(...filterParams);
  }

  return { clause: `WHERE ${conditions.join(' AND ')}`, params };
}

function resolveScoreGroupBy(groupBy: string[]): { key: string; selectSql: string; groupSql: string }[] {
  return groupBy.map((key, index) => {
    const column = parseFieldKey(key);
    if (!SCORE_GROUP_BY_COLUMNS.has(column)) {
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

function rowToScoreRecord(row: Record<string, unknown>): Record<string, unknown> {
  return {
    scoreId: row.scoreId as string,
    timestamp: toDate(row.timestamp),
    traceId: (row.traceId as string) ?? null,
    spanId: (row.spanId as string) ?? null,
    experimentId: (row.experimentId as string) ?? null,
    scoreTraceId: (row.scoreTraceId as string) ?? null,
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
    scorerId: row.scorerId as string,
    scorerVersion: (row.scorerVersion as string) ?? null,
    source: (row.scoreSource as string) ?? null,
    scoreSource: (row.scoreSource as string) ?? null,
    score: Number(row.score),
    reason: (row.reason as string) ?? null,
    tags: parseJsonArray(row.tags) as string[] | null,
    metadata: parseJson(row.metadata) as Record<string, unknown> | null,
    scope: parseJson(row.scope) as Record<string, unknown> | null,
  };
}

function getComparisonDateRange(
  comparePeriod: NonNullable<GetScoreAggregateArgs['comparePeriod']>,
  timestamp: NonNullable<NonNullable<GetScoreAggregateArgs['filters']>['timestamp']>,
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

/** Insert a single score event. */
export async function createScore(db: DuckDBConnection, args: CreateScoreArgs): Promise<void> {
  const s = args.score as LegacyScoreRecord;
  const scoreSource = s.scoreSource ?? s.source ?? null;
  await db.execute(
    `INSERT INTO score_events (
      scoreId, timestamp, traceId, spanId, experimentId, scoreTraceId,
      entityType, entityId, entityName, entityVersionId, parentEntityVersionId, parentEntityType, parentEntityId, parentEntityName, rootEntityVersionId, rootEntityType, rootEntityId, rootEntityName,
      userId, organizationId, resourceId, runId, sessionId, threadId, requestId, environment, executionSource, serviceName,
      scorerId, scorerVersion, scoreSource, score, reason, tags, metadata, scope
    )
     VALUES (${[
       v(s.scoreId),
       v(s.timestamp),
       v(s.traceId),
       v(s.spanId ?? null),
       v(s.experimentId ?? null),
       v(s.scoreTraceId ?? null),
       v(s.entityType ?? null),
       v(s.entityId ?? null),
       v(s.entityName ?? null),
       v(s.entityVersionId ?? null),
       v(s.parentEntityVersionId ?? null),
       v(s.parentEntityType ?? null),
       v(s.parentEntityId ?? null),
       v(s.parentEntityName ?? null),
       v(s.rootEntityVersionId ?? null),
       v(s.rootEntityType ?? null),
       v(s.rootEntityId ?? null),
       v(s.rootEntityName ?? null),
       v(s.userId ?? null),
       v(s.organizationId ?? null),
       v(s.resourceId ?? null),
       v(s.runId ?? null),
       v(s.sessionId ?? null),
       v(s.threadId ?? null),
       v(s.requestId ?? null),
       v(s.environment ?? null),
       v(s.executionSource ?? null),
       v(s.serviceName ?? null),
       v(s.scorerId),
       v(s.scorerVersion ?? null),
       v(scoreSource),
       v(s.score),
       v(s.reason ?? null),
       jsonV(s.tags ?? null),
       jsonV(s.metadata),
       jsonV(s.scope ?? null),
     ].join(', ')})
     ON CONFLICT DO NOTHING`,
  );
}

/** Insert multiple score events in a single statement. */
export async function batchCreateScores(db: DuckDBConnection, args: BatchCreateScoresArgs): Promise<void> {
  if (args.scores.length === 0) return;

  const tuples = args.scores.map(s => {
    const legacyScore = s as LegacyScoreRecord;
    const scoreSource = legacyScore.scoreSource ?? legacyScore.source ?? null;
    return `(${[
      v(legacyScore.scoreId),
      v(legacyScore.timestamp),
      v(legacyScore.traceId),
      v(legacyScore.spanId ?? null),
      v(legacyScore.experimentId ?? null),
      v(legacyScore.scoreTraceId ?? null),
      v(legacyScore.entityType ?? null),
      v(legacyScore.entityId ?? null),
      v(legacyScore.entityName ?? null),
      v(legacyScore.entityVersionId ?? null),
      v(legacyScore.parentEntityVersionId ?? null),
      v(legacyScore.parentEntityType ?? null),
      v(legacyScore.parentEntityId ?? null),
      v(legacyScore.parentEntityName ?? null),
      v(legacyScore.rootEntityVersionId ?? null),
      v(legacyScore.rootEntityType ?? null),
      v(legacyScore.rootEntityId ?? null),
      v(legacyScore.rootEntityName ?? null),
      v(legacyScore.userId ?? null),
      v(legacyScore.organizationId ?? null),
      v(legacyScore.resourceId ?? null),
      v(legacyScore.runId ?? null),
      v(legacyScore.sessionId ?? null),
      v(legacyScore.threadId ?? null),
      v(legacyScore.requestId ?? null),
      v(legacyScore.environment ?? null),
      v(legacyScore.executionSource ?? null),
      v(legacyScore.serviceName ?? null),
      v(legacyScore.scorerId),
      v(legacyScore.scorerVersion ?? null),
      v(scoreSource),
      v(legacyScore.score),
      v(legacyScore.reason ?? null),
      jsonV(legacyScore.tags ?? null),
      jsonV(legacyScore.metadata),
      jsonV(legacyScore.scope ?? null),
    ].join(', ')})`;
  });

  await db.execute(
    `INSERT INTO score_events (
      scoreId, timestamp, traceId, spanId, experimentId, scoreTraceId,
      entityType, entityId, entityName, entityVersionId, parentEntityVersionId, parentEntityType, parentEntityId, parentEntityName, rootEntityVersionId, rootEntityType, rootEntityId, rootEntityName,
      userId, organizationId, resourceId, runId, sessionId, threadId, requestId, environment, executionSource, serviceName,
      scorerId, scorerVersion, scoreSource, score, reason, tags, metadata, scope
    )
     VALUES ${tuples.join(',\n       ')}
     ON CONFLICT DO NOTHING`,
  );
}

/** Query score events with filtering, ordering, and pagination. */
export async function listScores(db: DuckDBConnection, args: ListScoresArgs): Promise<ListScoresResponse> {
  const filters = args.filters ?? {};
  const page = Number(args.pagination?.page ?? 0);
  const perPage = Number(args.pagination?.perPage ?? 10);
  const orderBy = { field: args.orderBy?.field ?? 'timestamp', direction: args.orderBy?.direction ?? 'DESC' } as const;

  const { clause: filterClause, params: filterParams } = buildWhereClause(filters as Record<string, unknown>, {
    source: 'scoreSource',
  });
  const orderByClause = buildOrderByClause(orderBy);
  const { clause: paginationClause, params: paginationParams } = buildPaginationClause({ page, perPage });

  const countResult = await db.query<{ total: number }>(
    `SELECT COUNT(*) as total FROM score_events ${filterClause}`,
    filterParams,
  );
  const total = Number(countResult[0]?.total ?? 0);

  const rows = await db.query<Record<string, unknown>>(
    `SELECT * FROM score_events ${filterClause} ${orderByClause} ${paginationClause}`,
    [...filterParams, ...paginationParams],
  );

  return {
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    scores: rows.map(row => rowToScoreRecord(row)) as ListScoresResponse['scores'],
  };
}

export async function getScoreById(db: DuckDBConnection, scoreId: string): Promise<ScoreRecord | null> {
  const rows = await db.query<Record<string, unknown>>(`SELECT * FROM score_events WHERE scoreId = ? LIMIT 1`, [
    scoreId,
  ]);
  return rows[0] ? (rowToScoreRecord(rows[0]) as ScoreRecord) : null;
}

export async function getScoreAggregate(
  db: DuckDBConnection,
  args: GetScoreAggregateArgs,
): Promise<GetScoreAggregateResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const { clause, params } = buildScoreWhereClause(args);
  const rows = await db.query<Record<string, unknown>>(`SELECT ${aggSql} AS value FROM score_events ${clause}`, params);
  const value = rows[0]?.value === null || rows[0]?.value === undefined ? null : Number(rows[0]?.value);

  if (args.comparePeriod && args.filters?.timestamp) {
    const previousTimestamp = getComparisonDateRange(args.comparePeriod, args.filters.timestamp);
    if (previousTimestamp) {
      const prevRows = await db.query<Record<string, unknown>>(
        `SELECT ${aggSql} AS value FROM score_events ${
          buildScoreWhereClause({
            ...args,
            filters: { ...(args.filters ?? {}), timestamp: previousTimestamp },
          }).clause
        }`,
        buildScoreWhereClause({
          ...args,
          filters: { ...(args.filters ?? {}), timestamp: previousTimestamp },
        }).params,
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

export async function getScoreBreakdown(
  db: DuckDBConnection,
  args: GetScoreBreakdownArgs,
): Promise<GetScoreBreakdownResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const { clause, params } = buildScoreWhereClause(args);
  const resolvedGroupBy = resolveScoreGroupBy(args.groupBy);
  const sql = `SELECT ${resolvedGroupBy.map(entry => entry.selectSql).join(', ')}, ${aggSql} AS value FROM score_events ${clause} GROUP BY ${resolvedGroupBy
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

export async function getScoreTimeSeries(
  db: DuckDBConnection,
  args: GetScoreTimeSeriesArgs,
): Promise<GetScoreTimeSeriesResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const intervalSql = getIntervalSql(args.interval);
  const { clause, params } = buildScoreWhereClause(args);

  if (args.groupBy && args.groupBy.length > 0) {
    const resolvedGroupBy = resolveScoreGroupBy(args.groupBy);
    const sql = `
      SELECT time_bucket(INTERVAL '${intervalSql}', timestamp) AS bucket,
             ${resolvedGroupBy.map(entry => entry.selectSql).join(', ')},
             ${aggSql} AS value
      FROM score_events ${clause}
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
      FROM score_events ${clause}
      GROUP BY bucket
      ORDER BY bucket
    `,
    params,
  );

  return {
    series: [
      {
        name: args.scoreSource ? `${args.scorerId}|${args.scoreSource}` : args.scorerId,
        points: rows.map(row => ({
          timestamp: row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket)),
          value: Number(row.value ?? 0),
        })),
      },
    ],
  };
}

export async function getScorePercentiles(
  db: DuckDBConnection,
  args: GetScorePercentilesArgs,
): Promise<GetScorePercentilesResponse> {
  const intervalSql = getIntervalSql(args.interval);
  const { clause, params } = buildScoreWhereClause(args);
  const percentiles = getValidatedPercentiles(args.percentiles);

  const series = [];
  for (const percentile of percentiles) {
    const rows = await db.query<Record<string, unknown>>(
      `
        SELECT time_bucket(INTERVAL '${intervalSql}', timestamp) AS bucket,
               percentile_cont(${percentile}) WITHIN GROUP (ORDER BY score) AS pvalue
        FROM score_events ${clause}
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
