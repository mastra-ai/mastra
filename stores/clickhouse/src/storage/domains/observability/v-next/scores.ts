import type { ClickHouseClient } from '@clickhouse/client';
import type {
  AggregationInterval,
  AggregationType,
  BatchCreateScoresArgs,
  CreateScoreArgs,
  ListScoresArgs,
  ListScoresResponse,
  ScoreRecord,
  GetScoreAggregateArgs,
  GetScoreAggregateResponse,
  GetScoreBreakdownArgs,
  GetScoreBreakdownResponse,
  GetScoreTimeSeriesArgs,
  GetScoreTimeSeriesResponse,
  GetScorePercentilesArgs,
  GetScorePercentilesResponse,
  LiveCursor,
} from '@mastra/core/storage';
import { parseFieldKey } from '@mastra/core/utils';

import { TABLE_SCORE_CURSOR_EVENTS, TABLE_SCORE_EVENTS } from './ddl';
import { buildPaginationClause, buildScoresFilterConditions, buildSignalOrderByClause } from './filters';
import type { FilterResult } from './filters';
import {
  CH_INSERT_SETTINGS,
  CH_SETTINGS,
  appendWhereClause,
  buildFirstSeenCursorSql,
  buildOpaqueLiveCursorUpperBoundCondition,
  createOpaqueLiveCursor,
  getOpaqueLiveCursorQueryParams,
  normalizeObservabilityListArgs,
  rowToOpaqueLiveCursor,
  toDateRangeOrUndefined,
  toStringArrayOrUndefined,
  toStringOrUndefined,
  toUnknownRecordOrUndefined,
  rowToScoreRecord,
  scoreRecordToRow,
} from './helpers';

type NormalizedScoresFilters = Parameters<typeof buildScoresFilterConditions>[0];
type ScoresOrderBy = { field: 'timestamp' | 'score'; direction: 'ASC' | 'DESC' };

function normalizeScoresFilters(filters: ListScoresArgs['filters']): NormalizedScoresFilters {
  const record = toUnknownRecordOrUndefined(filters);
  if (!record) return undefined;

  return {
    ...record,
    timestamp: toDateRangeOrUndefined(record.timestamp),
    scorerId: Array.isArray(record.scorerId)
      ? toStringArrayOrUndefined(record.scorerId)
      : toStringOrUndefined(record.scorerId),
    scoreSource: toStringOrUndefined(record.scoreSource),
    source: toStringOrUndefined(record.source),
    executionSource: toStringOrUndefined(record.executionSource),
  } as NormalizedScoresFilters;
}

// ============================================================================
// Helpers
// ============================================================================

const SCORE_TYPED_COLUMNS = new Set([
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

const GROUP_BY_EXCLUDED = new Set(['metadata', 'scope', 'tags']);

// TODO(2.0): Factor the repeated first-seen cursor join pattern across ClickHouse observability signals.
const SCORE_FIRST_SEEN_SQL = buildFirstSeenCursorSql(TABLE_SCORE_CURSOR_EVENTS, ['scoreId']);

function getAggregationSql(aggregation: AggregationType, measure = 'score'): string {
  switch (aggregation) {
    case 'sum':
      return `sum(${measure})`;
    case 'avg':
      return `avg(${measure})`;
    case 'min':
      return `min(${measure})`;
    case 'max':
      return `max(${measure})`;
    case 'count':
      return `toFloat64(count(${measure}))`;
    case 'last':
      return `argMax(${measure}, timestamp)`;
    default:
      return `sum(${measure})`;
  }
}

function getIntervalSql(interval: AggregationInterval): string {
  switch (interval) {
    case '1m':
      return 'INTERVAL 1 MINUTE';
    case '5m':
      return 'INTERVAL 5 MINUTE';
    case '15m':
      return 'INTERVAL 15 MINUTE';
    case '1h':
      return 'INTERVAL 1 HOUR';
    case '1d':
      return 'INTERVAL 1 DAY';
    default:
      return 'INTERVAL 1 HOUR';
  }
}

function mergeFilters(...parts: FilterResult[]): FilterResult {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  for (const part of parts) {
    conditions.push(...part.conditions);
    Object.assign(params, part.params);
  }
  return { conditions, params };
}

function toWhereClause(filter: FilterResult): string {
  return filter.conditions.length ? `WHERE ${filter.conditions.join(' AND ')}` : '';
}

function buildScoreIdentityFilter(args: Pick<GetScoreAggregateArgs, 'scorerId' | 'scoreSource'>): FilterResult {
  const conditions: string[] = ['scorerId = {olapScorerId:String}'];
  const params: Record<string, unknown> = { olapScorerId: args.scorerId };

  if (args.scoreSource !== undefined) {
    conditions.push('scoreSource = {olapScoreSource:String}');
    params.olapScoreSource = args.scoreSource;
  }

  return { conditions, params };
}

function resolveScoreGroupBy(groupBy: string[]): { key: string; selectSql: string; groupSql: string }[] {
  return groupBy.map((key, index) => {
    const column = parseFieldKey(key);
    if (!SCORE_TYPED_COLUMNS.has(column) || GROUP_BY_EXCLUDED.has(column)) {
      throw new Error(`Invalid groupBy column(s): ${key}`);
    }
    const alias = `group_by_${index}`;
    return { key, selectSql: `${column} AS ${alias}`, groupSql: alias };
  });
}

function toSeriesName(values: unknown[]): string {
  return values.map(v => (v == null ? '' : String(v))).join('|');
}

async function queryJson<T>(client: ClickHouseClient, query: string, params: Record<string, unknown>): Promise<T[]> {
  return (await (
    await client.query({
      query,
      query_params: params,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as T[];
}

function rowToScoreLiveCursor(row: Record<string, unknown>): LiveCursor | null {
  return rowToOpaqueLiveCursor(row);
}

async function getScoresSnapshotLiveCursor(
  client: ClickHouseClient,
  whereClause: string,
  params: Record<string, unknown>,
): Promise<LiveCursor> {
  const rows = await queryJson<Record<string, unknown>>(
    client,
    `
      SELECT toString(cursor.cursorId) AS cursorId
      FROM ${TABLE_SCORE_EVENTS} AS s
      INNER JOIN (${SCORE_FIRST_SEEN_SQL}) AS cursor USING (scoreId)
      ${whereClause}
      ORDER BY cursor.cursorId DESC
      LIMIT 1
    `,
    params,
  );

  const cursor = rows[0] ? rowToScoreLiveCursor(rows[0]) : null;
  return cursor ?? createOpaqueLiveCursor('0');
}

// ============================================================================
// Write
// ============================================================================

export async function createScore(client: ClickHouseClient, args: CreateScoreArgs): Promise<void> {
  await batchCreateScores(client, { scores: [args.score] });
}

export async function batchCreateScores(client: ClickHouseClient, args: BatchCreateScoresArgs): Promise<void> {
  if (args.scores.length === 0) return;

  await client.insert({
    table: TABLE_SCORE_EVENTS,
    values: args.scores.map(scoreRecordToRow),
    format: 'JSONEachRow',
    clickhouse_settings: CH_INSERT_SETTINGS,
  });

  await client.insert({
    table: TABLE_SCORE_CURSOR_EVENTS,
    values: args.scores.map(score => ({ scoreId: score.scoreId })),
    format: 'JSONEachRow',
    clickhouse_settings: CH_INSERT_SETTINGS,
  });
}

// ============================================================================
// List
// ============================================================================

export async function listScores(client: ClickHouseClient, args: ListScoresArgs): Promise<ListScoresResponse> {
  const parsed = normalizeObservabilityListArgs<ListScoresArgs['filters'], NormalizedScoresFilters, ScoresOrderBy>(
    args,
    {
      orderBy: { field: 'timestamp', direction: 'DESC' } satisfies ScoresOrderBy,
      normalizeFilters: normalizeScoresFilters,
    },
  );
  const filter = buildScoresFilterConditions(parsed.filters, 's');
  const whereClause = filter.conditions.length ? `WHERE ${filter.conditions.join(' AND ')}` : '';

  if (parsed.mode === 'delta') {
    if (!parsed.after) {
      return {
        delta: { limit: parsed.limit, hasMore: false },
        liveCursor: await getScoresSnapshotLiveCursor(client, whereClause, filter.params),
        scores: [],
      };
    }

    const rows = await queryJson<Record<string, any>>(
      client,
      `
        SELECT s.*, toString(cursor.cursorId) AS cursorId
        FROM ${TABLE_SCORE_EVENTS} AS s
        INNER JOIN (${SCORE_FIRST_SEEN_SQL}) AS cursor USING (scoreId)
        ${appendWhereClause(whereClause, 'cursor.cursorId > {afterCursorId:UInt64}')}
        ORDER BY cursor.cursorId ASC
        LIMIT {limit:UInt32}
      `,
      {
        ...filter.params,
        ...getOpaqueLiveCursorQueryParams(parsed.after, 'after'),
        limit: parsed.limit + 1,
      },
    );

    const pageRows = rows.slice(0, parsed.limit);
    const liveCursor =
      (pageRows.length > 0 ? rowToScoreLiveCursor(pageRows[pageRows.length - 1]!) : null) ?? parsed.after;

    return {
      delta: { limit: parsed.limit, hasMore: rows.length > parsed.limit },
      liveCursor,
      scores: pageRows.map(rowToScoreRecord),
    };
  }

  const pagination = buildPaginationClause(parsed.pagination);
  const orderBy = buildSignalOrderByClause(['timestamp', 'score'], parsed.orderBy, 's');
  const snapshotCursor = await getScoresSnapshotLiveCursor(client, whereClause, filter.params);
  const snapshotWhereClause = appendWhereClause(
    whereClause,
    buildOpaqueLiveCursorUpperBoundCondition('cursor.cursorId', 'snapshot', { includeNullCursorId: true }),
  );
  const snapshotParams = { ...filter.params, ...getOpaqueLiveCursorQueryParams(snapshotCursor, 'snapshot') };

  const countResult = await queryJson<{ total?: number }>(
    client,
    `SELECT count() AS total FROM ${TABLE_SCORE_EVENTS} AS s LEFT JOIN (${SCORE_FIRST_SEEN_SQL}) AS cursor USING (scoreId) ${snapshotWhereClause}`,
    snapshotParams,
  );

  const rows = await queryJson<Record<string, any>>(
    client,
    `SELECT s.* FROM ${TABLE_SCORE_EVENTS} AS s LEFT JOIN (${SCORE_FIRST_SEEN_SQL}) AS cursor USING (scoreId) ${snapshotWhereClause} ORDER BY ${orderBy} LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
    { ...snapshotParams, limit: pagination.limit, offset: pagination.offset },
  );

  const total = Number(countResult[0]?.total ?? 0);

  return {
    pagination: {
      total,
      page: pagination.page,
      perPage: pagination.perPage,
      hasMore: (pagination.page + 1) * pagination.perPage < total,
    },
    liveCursor: snapshotCursor,
    scores: rows.map(rowToScoreRecord),
  };
}

export async function getScoreById(client: ClickHouseClient, scoreId: string): Promise<ScoreRecord | null> {
  const rows = await queryJson<Record<string, any>>(
    client,
    `SELECT * FROM ${TABLE_SCORE_EVENTS} WHERE scoreId = {scoreId:String} LIMIT 1`,
    { scoreId },
  );

  return rows[0] ? rowToScoreRecord(rows[0]) : null;
}

// ============================================================================
// OLAP Queries
// ============================================================================

export async function getScoreAggregate(
  client: ClickHouseClient,
  args: GetScoreAggregateArgs,
): Promise<GetScoreAggregateResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const identity = buildScoreIdentityFilter(args);
  const signalFilter = buildScoresFilterConditions(args.filters);
  const combined = mergeFilters(identity, signalFilter);
  const whereClause = toWhereClause(combined);

  const sql = `SELECT ${aggSql} AS value FROM ${TABLE_SCORE_EVENTS} ${whereClause}`;
  const result = await queryJson<Record<string, unknown>>(client, sql, combined.params);
  const value = result[0]?.value == null ? null : Number(result[0]?.value);

  if (args.comparePeriod && args.filters?.timestamp) {
    const ts = args.filters.timestamp;
    if (ts.start && ts.end) {
      const duration = ts.end.getTime() - ts.start.getTime();
      let prevStart: Date;
      let prevEnd: Date;

      switch (args.comparePeriod) {
        case 'previous_period':
          prevStart = new Date(ts.start.getTime() - duration);
          prevEnd = new Date(ts.end.getTime() - duration);
          break;
        case 'previous_day':
          prevStart = new Date(ts.start.getTime() - 86400000);
          prevEnd = new Date(ts.end.getTime() - 86400000);
          break;
        case 'previous_week':
          prevStart = new Date(ts.start.getTime() - 604800000);
          prevEnd = new Date(ts.end.getTime() - 604800000);
          break;
        default:
          prevStart = new Date(ts.start.getTime() - duration);
          prevEnd = new Date(ts.end.getTime() - duration);
      }

      const prevFilters = {
        ...(args.filters ?? {}),
        timestamp: { start: prevStart, end: prevEnd, startExclusive: ts.startExclusive, endExclusive: ts.endExclusive },
      };
      const prevSignalFilter = buildScoresFilterConditions(prevFilters);
      const prevCombined = mergeFilters(identity, prevSignalFilter);
      const prevWhereClause = toWhereClause(prevCombined);

      const prevResult = await queryJson<Record<string, unknown>>(
        client,
        `SELECT ${aggSql} AS value FROM ${TABLE_SCORE_EVENTS} ${prevWhereClause}`,
        prevCombined.params,
      );
      const previousValue = prevResult[0]?.value == null ? null : Number(prevResult[0]?.value);

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
  client: ClickHouseClient,
  args: GetScoreBreakdownArgs,
): Promise<GetScoreBreakdownResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const identity = buildScoreIdentityFilter(args);
  const signalFilter = buildScoresFilterConditions(args.filters);
  const combined = mergeFilters(identity, signalFilter);
  const whereClause = toWhereClause(combined);
  const resolved = resolveScoreGroupBy(args.groupBy);

  const sql = `SELECT ${resolved.map(e => e.selectSql).join(', ')}, ${aggSql} AS value FROM ${TABLE_SCORE_EVENTS} ${whereClause} GROUP BY ${resolved.map(e => e.groupSql).join(', ')} ORDER BY value DESC`;
  const rows = await queryJson<Record<string, unknown>>(client, sql, combined.params);

  return {
    groups: rows.map(row => ({
      dimensions: Object.fromEntries(
        resolved.map((entry, index) => {
          const v = row[`group_by_${index}`];
          return [entry.key, v == null ? null : String(v)];
        }),
      ),
      value: Number(row.value ?? 0),
    })),
  };
}

export async function getScoreTimeSeries(
  client: ClickHouseClient,
  args: GetScoreTimeSeriesArgs,
): Promise<GetScoreTimeSeriesResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const intervalSql = getIntervalSql(args.interval);
  const identity = buildScoreIdentityFilter(args);
  const signalFilter = buildScoresFilterConditions(args.filters);
  const combined = mergeFilters(identity, signalFilter);
  const whereClause = toWhereClause(combined);

  if (args.groupBy && args.groupBy.length > 0) {
    const resolved = resolveScoreGroupBy(args.groupBy);
    const sql = `
      SELECT toStartOfInterval(timestamp, ${intervalSql}) AS bucket,
             ${resolved.map(e => e.selectSql).join(', ')},
             ${aggSql} AS value
      FROM ${TABLE_SCORE_EVENTS} ${whereClause}
      GROUP BY bucket, ${resolved.map(e => e.groupSql).join(', ')}
      ORDER BY bucket
    `;
    const rows = await queryJson<Record<string, unknown>>(client, sql, combined.params);
    const seriesMap = new Map<string, { name: string; points: { timestamp: Date; value: number }[] }>();

    for (const row of rows) {
      const groupValues = resolved.map((_, index) => row[`group_by_${index}`]);
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

  const sql = `
    SELECT toStartOfInterval(timestamp, ${intervalSql}) AS bucket,
           ${aggSql} AS value
    FROM ${TABLE_SCORE_EVENTS} ${whereClause}
    GROUP BY bucket
    ORDER BY bucket
  `;
  const rows = await queryJson<Record<string, unknown>>(client, sql, combined.params);

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
  client: ClickHouseClient,
  args: GetScorePercentilesArgs,
): Promise<GetScorePercentilesResponse> {
  const intervalSql = getIntervalSql(args.interval);
  const identity = buildScoreIdentityFilter(args);
  const signalFilter = buildScoresFilterConditions(args.filters);
  const combined = mergeFilters(identity, signalFilter);
  const whereClause = toWhereClause(combined);

  if (!Array.isArray(args.percentiles) || args.percentiles.length === 0) {
    throw new Error('Percentiles must include at least one value between 0 and 1.');
  }

  const series = [];
  for (const p of args.percentiles) {
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      throw new Error(`Percentile value must be a finite number between 0 and 1, got ${p}`);
    }
    const sql = `
      SELECT toStartOfInterval(timestamp, ${intervalSql}) AS bucket,
             quantile(${p})(score) AS pvalue
      FROM ${TABLE_SCORE_EVENTS}
      ${whereClause}
      GROUP BY bucket
      ORDER BY bucket
    `;
    const rows = await queryJson<Record<string, unknown>>(client, sql, combined.params);

    series.push({
      percentile: p,
      points: rows.map(row => ({
        timestamp: row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket)),
        value: Number(row.pvalue ?? 0),
      })),
    });
  }

  return { series };
}
