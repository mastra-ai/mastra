import type {
  BatchCreateMetricsArgs,
  GetMetricAggregateArgs,
  GetMetricAggregateResponse,
  GetMetricBreakdownArgs,
  GetMetricBreakdownResponse,
  GetMetricTimeSeriesArgs,
  GetMetricTimeSeriesResponse,
  GetMetricPercentilesArgs,
  GetMetricPercentilesResponse,
  GetMetricNamesArgs,
  GetMetricNamesResponse,
  GetMetricLabelKeysArgs,
  GetMetricLabelKeysResponse,
  GetMetricLabelValuesArgs,
  GetMetricLabelValuesResponse,
  AggregationType,
  AggregationInterval,
} from '@mastra/core/storage';
import type { DuckDBConnection } from '../../db/index';
import { buildJsonPath, buildWhereClause } from './filters';
import { v, jsonV } from './helpers';

// ============================================================================
// Helpers
// ============================================================================

function getAggregationSql(aggregation: AggregationType): string {
  switch (aggregation) {
    case 'sum':
      return 'SUM(value)';
    case 'avg':
      return 'AVG(value)';
    case 'min':
      return 'MIN(value)';
    case 'max':
      return 'MAX(value)';
    case 'count':
      return 'CAST(COUNT(value) AS DOUBLE)';
    case 'last':
      return 'arg_max(value, timestamp)';
    default:
      return 'SUM(value)';
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

function buildMetricNameFilter(name: string | string[]): { clause: string; params: unknown[] } {
  if (Array.isArray(name)) {
    const placeholders = name.map(() => '?').join(', ');
    return { clause: `name IN (${placeholders})`, params: name };
  }
  return { clause: `name = ?`, params: [name] };
}

// ============================================================================
// Write
// ============================================================================

const METRIC_COLUMNS = [
  'timestamp',
  'name',
  'value',
  'labels',
  'traceId',
  'spanId',
  'entityType',
  'entityId',
  'entityName',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
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
  'source',
  'serviceName',
  'experimentId',
  'metadata',
  'scope',
] as const;

type MetricColumn = (typeof METRIC_COLUMNS)[number];

const METRIC_GROUP_BY_EXCLUDED: MetricColumn[] = ['value', 'labels', 'metadata', 'scope'];

const METRIC_COLUMNS_SQL = METRIC_COLUMNS.join(', ');
const METRIC_GROUP_BY_COLUMNS = new Set(METRIC_COLUMNS.filter(col => !METRIC_GROUP_BY_EXCLUDED.includes(col)));

function normalizeGroupByColumns(groupBy: string[]): MetricColumn[] {
  const invalid = groupBy.filter(col => !METRIC_GROUP_BY_COLUMNS.has(col as MetricColumn));
  if (invalid.length > 0) {
    throw new Error(`Invalid groupBy column(s): ${invalid.join(', ')}`);
  }
  return groupBy as MetricColumn[];
}

function buildCombinedWhereClause(
  nameClause: string,
  nameParams: unknown[],
  filterClause: string,
  filterParams: unknown[],
): { clause: string; params: unknown[] } {
  const conditions = [nameClause];
  const params: unknown[] = [...nameParams];

  if (filterClause) {
    conditions.push(filterClause.replace('WHERE ', ''));
    params.push(...filterParams);
  }

  return { clause: `WHERE ${conditions.join(' AND ')}`, params };
}

/** Insert multiple metric events in a single statement. */
export async function batchCreateMetrics(db: DuckDBConnection, args: BatchCreateMetricsArgs): Promise<void> {
  if (args.metrics.length === 0) return;

  const tuples = args.metrics.map(m => {
    return `(${[
      v(m.timestamp),
      v(m.name),
      v(m.value),
      v(JSON.stringify(m.labels ?? {})),
      v(m.traceId ?? null),
      v(m.spanId ?? null),
      v(m.entityType ?? null),
      v(m.entityId ?? null),
      v(m.entityName ?? null),
      v(m.parentEntityType ?? null),
      v(m.parentEntityId ?? null),
      v(m.parentEntityName ?? null),
      v(m.rootEntityType ?? null),
      v(m.rootEntityId ?? null),
      v(m.rootEntityName ?? null),
      v(m.userId ?? null),
      v(m.organizationId ?? null),
      v(m.resourceId ?? null),
      v(m.runId ?? null),
      v(m.sessionId ?? null),
      v(m.threadId ?? null),
      v(m.requestId ?? null),
      v(m.environment ?? null),
      v(m.source ?? null),
      v(m.serviceName ?? null),
      v(m.experimentId ?? null),
      jsonV(m.metadata),
      jsonV(m.scope),
    ].join(', ')})`;
  });

  await db.execute(`INSERT INTO metric_events (${METRIC_COLUMNS_SQL}) VALUES ${tuples.join(',\n')}`);
}

// ============================================================================
// OLAP Queries
// ============================================================================

/** Compute an aggregate value (sum, avg, min, max, etc.) for a metric, with optional period comparison. */
export async function getMetricAggregate(
  db: DuckDBConnection,
  args: GetMetricAggregateArgs,
): Promise<GetMetricAggregateResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const { clause: nameClause, params: nameParams } = buildMetricNameFilter(args.name);
  const { clause: filterClause, params: filterParams } = buildWhereClause(
    args.filters as Record<string, unknown> | undefined,
  );
  const { clause: whereClause, params: allParams } = buildCombinedWhereClause(
    nameClause,
    nameParams,
    filterClause,
    filterParams,
  );
  const sql = `SELECT ${aggSql} as value FROM metric_events ${whereClause}`;
  const result = await db.query<{ value: number | null }>(sql, allParams);
  const value = result[0]?.value ?? null;

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
        timestamp: {
          start: prevStart,
          end: prevEnd,
          startExclusive: ts.startExclusive,
          endExclusive: ts.endExclusive,
        },
      };
      const { clause: prevFilterClause, params: prevFilterParams } = buildWhereClause(
        prevFilters as Record<string, unknown>,
      );
      const { clause: prevWhereClause, params: prevParams } = buildCombinedWhereClause(
        nameClause,
        nameParams,
        prevFilterClause,
        prevFilterParams,
      );
      const prevSql = `SELECT ${aggSql} as value FROM metric_events ${prevWhereClause}`;
      const prevResult = await db.query<{ value: number | null }>(prevSql, prevParams);
      const previousValue = prevResult[0]?.value ?? null;

      let changePercent: number | null = null;
      if (previousValue !== null && previousValue !== 0 && value !== null) {
        changePercent = ((value - previousValue) / Math.abs(previousValue)) * 100;
      }

      return { value, previousValue, changePercent };
    }
  }

  return { value };
}

/** Aggregate a metric grouped by one or more dimensions. */
export async function getMetricBreakdown(
  db: DuckDBConnection,
  args: GetMetricBreakdownArgs,
): Promise<GetMetricBreakdownResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const { clause: nameClause, params: nameParams } = buildMetricNameFilter(args.name);
  const { clause: filterClause, params: filterParams } = buildWhereClause(
    args.filters as Record<string, unknown> | undefined,
  );

  const allConditions = [nameClause];
  const allParams = [...nameParams];
  if (filterClause) {
    allConditions.push(filterClause.replace('WHERE ', ''));
    allParams.push(...filterParams);
  }

  const whereClause = `WHERE ${allConditions.join(' AND ')}`;
  const groupBy = normalizeGroupByColumns(args.groupBy);
  const groupByCols = groupBy.join(', ');

  const sql = `SELECT ${groupByCols}, ${aggSql} as value FROM metric_events ${whereClause} GROUP BY ${groupByCols} ORDER BY value DESC`;
  const rows = await db.query(sql, allParams);

  const groups = rows.map(row => {
    const r = row as Record<string, unknown>;
    const dimensions: Record<string, string> = {};
    for (const col of groupBy) {
      dimensions[col] = String(r[col] ?? '');
    }
    return { dimensions, value: Number(r.value ?? 0) };
  });

  return { groups };
}

/** Aggregate a metric into time-bucketed series, with optional group-by dimensions. */
export async function getMetricTimeSeries(
  db: DuckDBConnection,
  args: GetMetricTimeSeriesArgs,
): Promise<GetMetricTimeSeriesResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const intervalSql = getIntervalSql(args.interval);
  const { clause: nameClause, params: nameParams } = buildMetricNameFilter(args.name);
  const { clause: filterClause, params: filterParams } = buildWhereClause(
    args.filters as Record<string, unknown> | undefined,
  );

  const allConditions = [nameClause];
  const allParams = [...nameParams];
  if (filterClause) {
    allConditions.push(filterClause.replace('WHERE ', ''));
    allParams.push(...filterParams);
  }

  const whereClause = `WHERE ${allConditions.join(' AND ')}`;

  if (args.groupBy && args.groupBy.length > 0) {
    const groupBy = normalizeGroupByColumns(args.groupBy);
    const groupByCols = groupBy.join(', ');
    const sql = `
      SELECT time_bucket(INTERVAL '${intervalSql}', timestamp) as bucket,
             ${groupByCols}, ${aggSql} as value
      FROM metric_events ${whereClause}
      GROUP BY bucket, ${groupByCols}
      ORDER BY bucket
    `;
    const rows = await db.query(sql, allParams);

    const seriesMap = new Map<string, { timestamp: Date; value: number }[]>();
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const key = groupBy.map(col => String(r[col] ?? '')).join('|');
      if (!seriesMap.has(key)) seriesMap.set(key, []);
      seriesMap.get(key)!.push({
        timestamp: new Date(r.bucket as string),
        value: Number(r.value ?? 0),
      });
    }

    return {
      series: Array.from(seriesMap.entries()).map(([name, points]) => ({ name, points })),
    };
  }

  const sql = `
    SELECT time_bucket(INTERVAL '${intervalSql}', timestamp) as bucket,
           ${aggSql} as value
    FROM metric_events ${whereClause}
    GROUP BY bucket
    ORDER BY bucket
  `;
  const rows = await db.query(sql, allParams);

  const metricName = Array.isArray(args.name) ? args.name.join(',') : args.name;
  return {
    series: [
      {
        name: metricName,
        points: rows.map(row => {
          const r = row as Record<string, unknown>;
          return {
            timestamp: r.bucket instanceof Date ? r.bucket : new Date(String(r.bucket)),
            value: Number(r.value ?? 0),
          };
        }),
      },
    ],
  };
}

/** Compute percentile time series for a metric using `percentile_cont`. */
export async function getMetricPercentiles(
  db: DuckDBConnection,
  args: GetMetricPercentilesArgs,
): Promise<GetMetricPercentilesResponse> {
  const intervalSql = getIntervalSql(args.interval);
  const { clause: filterClause, params: filterParams } = buildWhereClause(
    args.filters as Record<string, unknown> | undefined,
  );

  const allConditions = [`name = ?`];
  const allParams: unknown[] = [args.name];
  if (filterClause) {
    allConditions.push(filterClause.replace('WHERE ', ''));
    allParams.push(...filterParams);
  }

  const whereClause = `WHERE ${allConditions.join(' AND ')}`;

  const series = [];
  for (const p of args.percentiles) {
    const sql = `
      SELECT time_bucket(INTERVAL '${intervalSql}', timestamp) as bucket,
             percentile_cont(${p}) WITHIN GROUP (ORDER BY value) as pvalue
      FROM metric_events ${whereClause}
      GROUP BY bucket
      ORDER BY bucket
    `;
    const rows = await db.query(sql, allParams);

    series.push({
      percentile: p,
      points: rows.map(row => {
        const r = row as Record<string, unknown>;
        return {
          timestamp: new Date(r.bucket as string),
          value: Number(r.pvalue ?? 0),
        };
      }),
    });
  }

  return { series };
}

// ============================================================================
// Discovery / Metadata
// ============================================================================

/** Return distinct metric names, optionally filtered by prefix. */
export async function getMetricNames(db: DuckDBConnection, args: GetMetricNamesArgs): Promise<GetMetricNamesResponse> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (args.prefix) {
    conditions.push(`name LIKE ?`);
    params.push(`${args.prefix}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = args.limit ? `LIMIT ?` : '';
  if (args.limit) params.push(args.limit);

  const rows = await db.query<{ name: string }>(
    `SELECT DISTINCT name FROM metric_events ${whereClause} ORDER BY name ${limitClause}`,
    params,
  );

  return { names: rows.map(r => r.name) };
}

/** Return distinct label keys for a given metric name. */
export async function getMetricLabelKeys(
  db: DuckDBConnection,
  args: GetMetricLabelKeysArgs,
): Promise<GetMetricLabelKeysResponse> {
  const rows = await db.query<{ key: string }>(
    `SELECT DISTINCT unnest(json_keys(labels)) as key FROM metric_events WHERE name = ? AND labels IS NOT NULL`,
    [args.metricName],
  );
  return { keys: rows.map(r => r.key) };
}

/** Return distinct values for a specific label key on a metric. */
export async function getMetricLabelValues(
  db: DuckDBConnection,
  args: GetMetricLabelValuesArgs,
): Promise<GetMetricLabelValuesResponse> {
  const labelPath = buildJsonPath(args.labelKey);
  const conditions = [`name = ?`, `json_extract_string(labels, ?) IS NOT NULL`];
  const params: unknown[] = [labelPath, args.metricName, labelPath];

  if (args.prefix) {
    conditions.push(`json_extract_string(labels, ?) LIKE ?`);
    params.push(labelPath, `${args.prefix}%`);
  }

  const limitClause = args.limit ? `LIMIT ?` : '';
  if (args.limit) params.push(args.limit);

  const rows = await db.query<{ val: string }>(
    `SELECT DISTINCT json_extract_string(labels, ?) as val FROM metric_events WHERE ${conditions.join(' AND ')} ORDER BY val ${limitClause}`,
    params,
  );

  return { values: rows.map(r => r.val) };
}
