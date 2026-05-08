import { METRIC_DISTINCT_COLUMNS } from '@mastra/core/storage';
import type {
  BatchCreateMetricsArgs,
  ListMetricsArgs,
  ListMetricsResponse,
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
  MetricDistinctColumn,
} from '@mastra/core/storage';
import { parseFieldKey } from '@mastra/core/utils';
import type { DuckDBConnection } from '../../db/index';
import { buildJsonPath, buildOrderByClause, buildPaginationClause, buildWhereClause } from './filters';
import { parseJson, parseJsonArray, toDate, v, jsonV } from './helpers';

// ============================================================================
// Helpers
// ============================================================================

function resolveDistinctColumnSql(distinctColumn: MetricDistinctColumn | undefined): string {
  if (!distinctColumn) {
    throw new Error(`count_distinct aggregation requires a 'distinctColumn' argument`);
  }
  // Defense-in-depth: the schema enum already restricts this, but the value
  // flows into raw SQL so we re-check against the system-level allowlist.
  if (!(METRIC_DISTINCT_COLUMNS as readonly string[]).includes(distinctColumn)) {
    throw new Error(`Invalid distinctColumn: ${distinctColumn}`);
  }
  return parseFieldKey(distinctColumn);
}

function getAggregationSql(
  aggregation: AggregationType,
  measure = 'value',
  distinctColumn?: MetricDistinctColumn,
): string {
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
    case 'count_distinct': {
      // DuckDB has `approx_count_distinct` (HyperLogLog) for dashboard scale.
      return `CAST(approx_count_distinct(${resolveDistinctColumnSql(distinctColumn)}) AS DOUBLE)`;
    }
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

function buildMetricNameFilter(name: string | string[]): { clause: string; params: unknown[] } {
  if (Array.isArray(name)) {
    const placeholders = name.map(() => '?').join(', ');
    return { clause: `name IN (${placeholders})`, params: name };
  }
  return { clause: `name = ?`, params: [name] };
}

const METRIC_COLUMNS = [
  'metricId',
  'timestamp',
  'name',
  'value',
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
  'provider',
  'model',
  'estimatedCost',
  'costUnit',
  'tags',
  'labels',
  'costMetadata',
  'metadata',
  'scope',
] as const;

type MetricColumn = (typeof METRIC_COLUMNS)[number];

const METRIC_COLUMNS_SQL = METRIC_COLUMNS.join(', ');
const METRIC_COLUMN_SET = new Set<string>(METRIC_COLUMNS);
const METRIC_LABEL_ONLY_GROUP_BY_EXCLUDED = new Set<MetricColumn>(['metadata', 'scope', 'costMetadata', 'tags']);

type ResolvedGroupBy =
  | { kind: 'column'; key: string; selectSql: string; groupSql: string; resultKey: string }
  | { kind: 'label'; key: string; selectSql: string; groupSql: string; resultKey: string };

type CostSummary = {
  estimatedCost: number | null;
  costUnit: string | null;
};

function buildGroupByAlias(index: number): string {
  return `group_by_${index}`;
}

function toSeriesDisplayValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function getCostSummarySelect(prefix = ''): string {
  const ref = (column: string) => `${prefix}${column}`;
  return [
    `SUM(${ref('estimatedCost')}) FILTER (WHERE ${ref('estimatedCost')} IS NOT NULL) AS estimatedCost`,
    `,`,
    `CASE`,
    `  WHEN COUNT(DISTINCT ${ref('costUnit')}) FILTER (WHERE ${ref('costUnit')} IS NOT NULL) = 1`,
    `  THEN MIN(${ref('costUnit')}) FILTER (WHERE ${ref('costUnit')} IS NOT NULL)`,
    `  ELSE NULL`,
    `END AS costUnit`,
  ].join(' ');
}

function normalizeCostSummaryRow(row: Record<string, unknown>): CostSummary {
  return {
    estimatedCost: row.estimatedCost === null || row.estimatedCost === undefined ? null : Number(row.estimatedCost),
    costUnit: row.costUnit === null || row.costUnit === undefined ? null : String(row.costUnit),
  };
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

function resolveGroupBy(groupBy: string[]): ResolvedGroupBy[] {
  return groupBy.map((key, index) => {
    if (METRIC_COLUMN_SET.has(key)) {
      const parsed = parseFieldKey(key);
      if (METRIC_LABEL_ONLY_GROUP_BY_EXCLUDED.has(parsed as MetricColumn)) {
        throw new Error(`Invalid groupBy column(s): ${key}`);
      }

      return {
        kind: 'column',
        key,
        selectSql: `${parsed} AS "${key}"`,
        groupSql: parsed,
        resultKey: key,
      };
    }

    const labelPath = buildJsonPath(key).replace(/'/g, "''");
    const labelExpr = `json_extract_string(labels, '${labelPath}')`;
    const alias = buildGroupByAlias(index);
    return {
      kind: 'label',
      key,
      selectSql: `${labelExpr} AS ${alias}`,
      groupSql: alias,
      resultKey: alias,
    };
  });
}

function rowToMetricRecord(row: Record<string, unknown>): Record<string, unknown> {
  return {
    metricId: row.metricId as string,
    timestamp: toDate(row.timestamp),
    name: row.name as string,
    value: Number(row.value),
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
    provider: (row.provider as string) ?? null,
    model: (row.model as string) ?? null,
    estimatedCost: row.estimatedCost === null || row.estimatedCost === undefined ? null : Number(row.estimatedCost),
    costUnit: (row.costUnit as string) ?? null,
    costMetadata: parseJson(row.costMetadata) as Record<string, unknown> | null,
    tags: parseJsonArray(row.tags) as string[] | null,
    labels: (parseJson(row.labels) as Record<string, string> | null) ?? {},
    metadata: parseJson(row.metadata) as Record<string, unknown> | null,
    scope: parseJson(row.scope) as Record<string, unknown> | null,
  };
}

// ============================================================================
// Write
// ============================================================================

/** Insert multiple metric events in a single statement. */
export async function batchCreateMetrics(db: DuckDBConnection, args: BatchCreateMetricsArgs): Promise<void> {
  if (args.metrics.length === 0) return;

  const tuples = args.metrics.map(m => {
    return `(${[
      v(m.metricId),
      v(m.timestamp),
      v(m.name),
      v(m.value),
      v(m.traceId ?? null),
      v(m.spanId ?? null),
      v(m.entityType ?? null),
      v(m.entityId ?? null),
      v(m.entityName ?? null),
      v(m.entityVersionId ?? null),
      v(m.parentEntityVersionId ?? null),
      v(m.parentEntityType ?? null),
      v(m.parentEntityId ?? null),
      v(m.parentEntityName ?? null),
      v(m.rootEntityVersionId ?? null),
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
      v(m.executionSource ?? null),
      v(m.serviceName ?? null),
      v(m.experimentId ?? null),
      v(m.provider ?? null),
      v(m.model ?? null),
      v(m.estimatedCost ?? null),
      v(m.costUnit ?? null),
      jsonV(m.tags ?? null),
      v(JSON.stringify(m.labels ?? {})),
      jsonV(m.costMetadata ?? null),
      jsonV(m.metadata ?? null),
      jsonV(m.scope ?? null),
    ].join(', ')})`;
  });

  await db.execute(
    `INSERT INTO metric_events (${METRIC_COLUMNS_SQL}) VALUES ${tuples.join(',\n')} ON CONFLICT DO NOTHING`,
  );
}

/** Query metric events with filtering, ordering, and pagination. */
export async function listMetrics(db: DuckDBConnection, args: ListMetricsArgs): Promise<ListMetricsResponse> {
  const filters = args.filters ?? {};
  const page = Number(args.pagination?.page ?? 0);
  const perPage = Number(args.pagination?.perPage ?? 10);
  const orderBy = { field: args.orderBy?.field ?? 'timestamp', direction: args.orderBy?.direction ?? 'DESC' } as const;

  const { clause: filterClause, params: filterParams } = buildWhereClause(filters as Record<string, unknown>);
  const orderByClause = buildOrderByClause(orderBy);
  const { clause: paginationClause, params: paginationParams } = buildPaginationClause({ page, perPage });

  const countResult = await db.query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM metric_events ${filterClause}`,
    filterParams,
  );
  const total = Number(countResult[0]?.total ?? 0);

  const rows = await db.query<Record<string, unknown>>(
    `SELECT * FROM metric_events ${filterClause} ${orderByClause} ${paginationClause}`,
    [...filterParams, ...paginationParams],
  );

  return {
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    metrics: rows.map(row => rowToMetricRecord(row)) as ListMetricsResponse['metrics'],
  };
}

// ============================================================================
// OLAP Queries
// ============================================================================

/** Compute an aggregate value (sum, avg, min, max, etc.) for a metric, with optional period comparison. */
export async function getMetricAggregate(
  db: DuckDBConnection,
  args: GetMetricAggregateArgs,
): Promise<GetMetricAggregateResponse> {
  const aggSql = getAggregationSql(args.aggregation, 'value', args.distinctColumn);
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

  const sql = `SELECT ${aggSql} AS value, ${getCostSummarySelect()} FROM metric_events ${whereClause}`;
  const result = await db.query<Record<string, unknown>>(sql, allParams);
  const row = result[0] ?? {};
  const value = row.value === null || row.value === undefined ? null : Number(row.value);
  const costSummary = normalizeCostSummaryRow(row);

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

      const prevSql = `SELECT ${aggSql} AS value, ${getCostSummarySelect()} FROM metric_events ${prevWhereClause}`;
      const prevResult = await db.query<Record<string, unknown>>(prevSql, prevParams);
      const prevRow = prevResult[0] ?? {};
      const previousValue = prevRow.value === null || prevRow.value === undefined ? null : Number(prevRow.value);
      const previousCostSummary = normalizeCostSummaryRow(prevRow);

      let changePercent: number | null = null;
      if (previousValue !== null && previousValue !== 0 && value !== null) {
        changePercent = ((value - previousValue) / Math.abs(previousValue)) * 100;
      }

      let costChangePercent: number | null = null;
      if (
        previousCostSummary.estimatedCost !== null &&
        previousCostSummary.estimatedCost !== 0 &&
        costSummary.estimatedCost !== null
      ) {
        costChangePercent =
          ((costSummary.estimatedCost - previousCostSummary.estimatedCost) /
            Math.abs(previousCostSummary.estimatedCost)) *
          100;
      }

      return {
        value,
        estimatedCost: costSummary.estimatedCost,
        costUnit: costSummary.costUnit,
        previousValue,
        previousEstimatedCost: previousCostSummary.estimatedCost,
        changePercent,
        costChangePercent,
      };
    }
  }

  return { value, estimatedCost: costSummary.estimatedCost, costUnit: costSummary.costUnit };
}

/** Aggregate a metric grouped by one or more dimensions. */
export async function getMetricBreakdown(
  db: DuckDBConnection,
  args: GetMetricBreakdownArgs,
): Promise<GetMetricBreakdownResponse> {
  const aggSql = getAggregationSql(args.aggregation, 'value', args.distinctColumn);
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

  const resolvedGroupBy = resolveGroupBy(args.groupBy);
  const selectGroupBy = resolvedGroupBy.map(entry => entry.selectSql).join(', ');
  const groupByCols = resolvedGroupBy.map(entry => entry.groupSql).join(', ');

  const orderDirection = args.orderDirection === 'ASC' ? 'ASC' : 'DESC';
  const limitClause = typeof args.limit === 'number' ? `LIMIT ?` : '';
  const limitParams = typeof args.limit === 'number' ? [args.limit] : [];

  const sql = `SELECT ${selectGroupBy}, ${aggSql} AS value, ${getCostSummarySelect()} FROM metric_events ${whereClause} GROUP BY ${groupByCols} ORDER BY value ${orderDirection} ${limitClause}`;
  const rows = await db.query<Record<string, unknown>>(sql, [...allParams, ...limitParams]);

  const groups = rows.map(row => {
    const dimensions: Record<string, string | null> = {};
    for (const entry of resolvedGroupBy) {
      const value = row[entry.resultKey];
      dimensions[entry.key] = value === null || value === undefined ? null : String(value);
    }

    const costSummary = normalizeCostSummaryRow(row);
    return {
      dimensions,
      value: Number(row.value ?? 0),
      estimatedCost: costSummary.estimatedCost,
      costUnit: costSummary.costUnit,
    };
  });

  return { groups };
}

/** Aggregate a metric into time-bucketed series, with optional group-by dimensions. */
export async function getMetricTimeSeries(
  db: DuckDBConnection,
  args: GetMetricTimeSeriesArgs,
): Promise<GetMetricTimeSeriesResponse> {
  const aggSql = getAggregationSql(args.aggregation, 'value', args.distinctColumn);
  const intervalSql = getIntervalSql(args.interval);
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

  if (args.groupBy && args.groupBy.length > 0) {
    const resolvedGroupBy = resolveGroupBy(args.groupBy);
    const selectGroupBy = resolvedGroupBy.map(entry => entry.selectSql).join(', ');
    const groupByCols = resolvedGroupBy.map(entry => entry.groupSql).join(', ');
    const sql = `
      SELECT time_bucket(INTERVAL '${intervalSql}', timestamp) AS bucket,
             ${selectGroupBy},
             ${aggSql} AS value,
             ${getCostSummarySelect()}
      FROM metric_events ${whereClause}
      GROUP BY bucket, ${groupByCols}
      ORDER BY bucket
    `;
    const rows = await db.query<Record<string, unknown>>(sql, allParams);

    const seriesMap = new Map<
      string,
      {
        name: string;
        costUnits: Set<string>;
        points: { timestamp: Date; value: number; estimatedCost: number | null }[];
      }
    >();

    for (const row of rows) {
      const dimensionValues = resolvedGroupBy.map(entry => row[entry.resultKey]);
      const seriesKey = JSON.stringify(dimensionValues);
      const name = dimensionValues.map(toSeriesDisplayValue).join('|');
      const costSummary = normalizeCostSummaryRow(row);

      if (!seriesMap.has(seriesKey)) {
        seriesMap.set(seriesKey, {
          name,
          costUnits: new Set(),
          points: [],
        });
      }

      if (costSummary.costUnit) {
        seriesMap.get(seriesKey)!.costUnits.add(costSummary.costUnit);
      }

      seriesMap.get(seriesKey)!.points.push({
        timestamp: row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket)),
        value: Number(row.value ?? 0),
        estimatedCost: costSummary.estimatedCost,
      });
    }

    return {
      series: Array.from(seriesMap.values()).map(series => ({
        name: series.name,
        costUnit: series.costUnits.size === 1 ? Array.from(series.costUnits)[0]! : null,
        points: series.points,
      })),
    };
  }

  const sql = `
    SELECT time_bucket(INTERVAL '${intervalSql}', timestamp) AS bucket,
           ${aggSql} AS value,
           ${getCostSummarySelect()}
    FROM metric_events ${whereClause}
    GROUP BY bucket
    ORDER BY bucket
  `;
  const rows = await db.query<Record<string, unknown>>(sql, allParams);
  const metricName = Array.isArray(args.name) ? args.name.join(',') : args.name;
  const overallCostUnits = new Set(
    rows.map(row => row.costUnit).filter((value): value is string => typeof value === 'string'),
  );

  return {
    series: [
      {
        name: metricName,
        costUnit: overallCostUnits.size === 1 ? Array.from(overallCostUnits)[0]! : null,
        points: rows.map(row => {
          const costSummary = normalizeCostSummaryRow(row);
          return {
            timestamp: row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket)),
            value: Number(row.value ?? 0),
            estimatedCost: costSummary.estimatedCost,
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
      SELECT time_bucket(INTERVAL '${intervalSql}', timestamp) AS bucket,
             percentile_cont(${p}) WITHIN GROUP (ORDER BY value) AS pvalue
      FROM metric_events ${whereClause}
      GROUP BY bucket
      ORDER BY bucket
    `;
    const rows = await db.query<Record<string, unknown>>(sql, allParams);

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
    `SELECT DISTINCT unnest(json_keys(labels)) AS key FROM metric_events WHERE name = ? AND labels IS NOT NULL`,
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
  const params: unknown[] = [args.metricName, labelPath];

  if (args.prefix) {
    conditions.push(`json_extract_string(labels, ?) LIKE ?`);
    params.push(labelPath, `${args.prefix}%`);
  }

  const limitClause = args.limit ? `LIMIT ?` : '';
  if (args.limit) params.push(args.limit);

  const rows = await db.query<{ val: string }>(
    `SELECT DISTINCT json_extract_string(labels, ?) AS val FROM metric_events WHERE ${conditions.join(' AND ')} ORDER BY val ${limitClause}`,
    [labelPath, ...params],
  );

  return { values: rows.map(r => r.val) };
}
