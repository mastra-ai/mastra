import type { ClickHouseClient } from '@clickhouse/client';
import { listFeedbackArgsSchema } from '@mastra/core/storage';
import type {
  AggregationInterval,
  AggregationType,
  BatchCreateFeedbackArgs,
  CreateFeedbackArgs,
  ListFeedbackArgs,
  ListFeedbackResponse,
  GetFeedbackAggregateArgs,
  GetFeedbackAggregateResponse,
  GetFeedbackBreakdownArgs,
  GetFeedbackBreakdownResponse,
  GetFeedbackTimeSeriesArgs,
  GetFeedbackTimeSeriesResponse,
  GetFeedbackPercentilesArgs,
  GetFeedbackPercentilesResponse,
} from '@mastra/core/storage';
import { parseFieldKey } from '@mastra/core/utils';

import { TABLE_FEEDBACK_EVENTS } from './ddl';
import { buildFeedbackFilterConditions, buildPaginationClause, buildSignalOrderByClause } from './filters';
import type { FilterResult } from './filters';
import { CH_INSERT_SETTINGS, CH_SETTINGS, feedbackRecordToRow, rowToFeedbackRecord } from './helpers';

// ============================================================================
// Helpers
// ============================================================================

const FEEDBACK_TYPED_COLUMNS = new Set([
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
  'valueNumber',
  'comment',
]);

const GROUP_BY_EXCLUDED = new Set(['metadata', 'scope', 'tags']);

function getAggregationSql(aggregation: AggregationType, measure = 'valueNumber'): string {
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

function buildFeedbackIdentityFilter(
  args: Pick<GetFeedbackAggregateArgs, 'feedbackType' | 'feedbackSource'>,
): FilterResult {
  const conditions: string[] = ['feedbackType = {olapFeedbackType:String}'];
  const params: Record<string, unknown> = { olapFeedbackType: args.feedbackType };

  if (args.feedbackSource !== undefined) {
    conditions.push('feedbackSource = {olapFeedbackSource:String}');
    params.olapFeedbackSource = args.feedbackSource;
  }

  // Only aggregate rows with numeric values
  conditions.push('valueNumber IS NOT NULL');

  return { conditions, params };
}

function resolveFeedbackGroupBy(groupBy: string[]): { key: string; selectSql: string; groupSql: string }[] {
  return groupBy.map((key, index) => {
    const column = parseFieldKey(key);
    if (!FEEDBACK_TYPED_COLUMNS.has(column) || GROUP_BY_EXCLUDED.has(column)) {
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

// ============================================================================
// Write
// ============================================================================

export async function createFeedback(client: ClickHouseClient, args: CreateFeedbackArgs): Promise<void> {
  await batchCreateFeedback(client, { feedbacks: [args.feedback] });
}

export async function batchCreateFeedback(client: ClickHouseClient, args: BatchCreateFeedbackArgs): Promise<void> {
  if (args.feedbacks.length === 0) return;

  await client.insert({
    table: TABLE_FEEDBACK_EVENTS,
    values: args.feedbacks.map(feedbackRecordToRow),
    format: 'JSONEachRow',
    clickhouse_settings: CH_INSERT_SETTINGS,
  });
}

// ============================================================================
// List
// ============================================================================

export async function listFeedback(client: ClickHouseClient, args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
  const parsed = listFeedbackArgsSchema.parse(args);
  const filter = buildFeedbackFilterConditions(parsed.filters, 'f');
  const pagination = buildPaginationClause(parsed.pagination);
  const orderBy = buildSignalOrderByClause(['timestamp'], parsed.orderBy, 'f');
  const whereClause = filter.conditions.length ? `WHERE ${filter.conditions.join(' AND ')}` : '';

  const countResult = await queryJson<{ total?: number }>(
    client,
    `SELECT count() AS total FROM ${TABLE_FEEDBACK_EVENTS} AS f ${whereClause}`,
    filter.params,
  );

  const rows = await queryJson<Record<string, any>>(
    client,
    `SELECT * FROM ${TABLE_FEEDBACK_EVENTS} AS f ${whereClause} ORDER BY ${orderBy} LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
    { ...filter.params, limit: pagination.limit, offset: pagination.offset },
  );

  const total = Number(countResult[0]?.total ?? 0);

  return {
    pagination: {
      total,
      page: pagination.page,
      perPage: pagination.perPage,
      hasMore: (pagination.page + 1) * pagination.perPage < total,
    },
    feedback: rows.map(rowToFeedbackRecord),
  };
}

// ============================================================================
// OLAP Queries
// ============================================================================

export async function getFeedbackAggregate(
  client: ClickHouseClient,
  args: GetFeedbackAggregateArgs,
): Promise<GetFeedbackAggregateResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const identity = buildFeedbackIdentityFilter(args);
  const signalFilter = buildFeedbackFilterConditions(args.filters);
  const combined = mergeFilters(identity, signalFilter);
  const whereClause = toWhereClause(combined);

  const sql = `SELECT ${aggSql} AS value FROM ${TABLE_FEEDBACK_EVENTS} ${whereClause}`;
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
      const prevSignalFilter = buildFeedbackFilterConditions(prevFilters);
      const prevCombined = mergeFilters(identity, prevSignalFilter);
      const prevWhereClause = toWhereClause(prevCombined);

      const prevResult = await queryJson<Record<string, unknown>>(
        client,
        `SELECT ${aggSql} AS value FROM ${TABLE_FEEDBACK_EVENTS} ${prevWhereClause}`,
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

export async function getFeedbackBreakdown(
  client: ClickHouseClient,
  args: GetFeedbackBreakdownArgs,
): Promise<GetFeedbackBreakdownResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const identity = buildFeedbackIdentityFilter(args);
  const signalFilter = buildFeedbackFilterConditions(args.filters);
  const combined = mergeFilters(identity, signalFilter);
  const whereClause = toWhereClause(combined);
  const resolved = resolveFeedbackGroupBy(args.groupBy);

  const sql = `SELECT ${resolved.map(e => e.selectSql).join(', ')}, ${aggSql} AS value FROM ${TABLE_FEEDBACK_EVENTS} ${whereClause} GROUP BY ${resolved.map(e => e.groupSql).join(', ')} ORDER BY value DESC`;
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

export async function getFeedbackTimeSeries(
  client: ClickHouseClient,
  args: GetFeedbackTimeSeriesArgs,
): Promise<GetFeedbackTimeSeriesResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const intervalSql = getIntervalSql(args.interval);
  const identity = buildFeedbackIdentityFilter(args);
  const signalFilter = buildFeedbackFilterConditions(args.filters);
  const combined = mergeFilters(identity, signalFilter);
  const whereClause = toWhereClause(combined);

  if (args.groupBy && args.groupBy.length > 0) {
    const resolved = resolveFeedbackGroupBy(args.groupBy);
    const sql = `
      SELECT toStartOfInterval(timestamp, ${intervalSql}) AS bucket,
             ${resolved.map(e => e.selectSql).join(', ')},
             ${aggSql} AS value
      FROM ${TABLE_FEEDBACK_EVENTS} ${whereClause}
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
    FROM ${TABLE_FEEDBACK_EVENTS} ${whereClause}
    GROUP BY bucket
    ORDER BY bucket
  `;
  const rows = await queryJson<Record<string, unknown>>(client, sql, combined.params);

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
  client: ClickHouseClient,
  args: GetFeedbackPercentilesArgs,
): Promise<GetFeedbackPercentilesResponse> {
  const intervalSql = getIntervalSql(args.interval);
  const identity = buildFeedbackIdentityFilter(args);
  const signalFilter = buildFeedbackFilterConditions(args.filters);
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
             quantile(${p})(valueNumber) AS pvalue
      FROM ${TABLE_FEEDBACK_EVENTS}
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
