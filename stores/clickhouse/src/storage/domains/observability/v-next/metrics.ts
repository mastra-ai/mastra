import type { ClickHouseClient } from '@clickhouse/client';
import { listMetricsArgsSchema } from '@mastra/core/storage';
import type {
  AggregationInterval,
  AggregationType,
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
} from '@mastra/core/storage';
import { parseFieldKey } from '@mastra/core/utils';

import { TABLE_METRIC_EVENTS, TABLE_DISCOVERY_VALUES, TABLE_DISCOVERY_PAIRS } from './ddl';
import { buildMetricsFilterConditions, buildPaginationClause, buildSignalOrderByClause } from './filters';
import type { FilterResult } from './filters';
import { CH_INSERT_SETTINGS, CH_SETTINGS, metricRecordToRow, rowToMetricRecord } from './helpers';

// ============================================================================
// Helpers
// ============================================================================

/** Map typed columns to their ClickHouse column names. */
const METRIC_TYPED_COLUMNS = new Set([
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
]);

/** Columns excluded from groupBy because they are complex types. */
const GROUP_BY_EXCLUDED = new Set(['metadata', 'scope', 'costMetadata', 'tags']);

function getAggregationSql(aggregation: AggregationType, measure = 'value'): string {
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

function getCostSummarySelect(prefix = ''): string {
  const ref = (col: string) => `${prefix}${col}`;
  // Use prefixed aliases to avoid ClickHouse alias-resolution conflicts
  // when source columns (estimatedCost, costUnit) also appear in WHERE.
  return `sumIf(${ref('estimatedCost')}, ${ref('estimatedCost')} IS NOT NULL) AS agg_estimatedCost, CASE WHEN countDistinctIf(${ref('costUnit')}, ${ref('costUnit')} IS NOT NULL) = 1 THEN minIf(${ref('costUnit')}, ${ref('costUnit')} IS NOT NULL) ELSE NULL END AS agg_costUnit`;
}

interface CostSummary {
  estimatedCost: number | null;
  costUnit: string | null;
}

function normalizeCostSummaryRow(row: Record<string, unknown>): CostSummary {
  return {
    estimatedCost: row.agg_estimatedCost == null ? null : Number(row.agg_estimatedCost),
    costUnit: row.agg_costUnit == null || row.agg_costUnit === '' ? null : String(row.agg_costUnit),
  };
}

function buildMetricNameFilter(names: string[]): FilterResult {
  return {
    conditions: [`name IN {metricNames:Array(String)}`],
    params: { metricNames: names },
  };
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

interface ResolvedGroupBy {
  kind: 'column' | 'label';
  key: string;
  valueSql: string;
  selectSql: string;
  groupSql: string;
  resultKey: string;
}

function resolveGroupBy(groupBy: string[]): ResolvedGroupBy[] {
  return groupBy.map((key, index) => {
    if (METRIC_TYPED_COLUMNS.has(key)) {
      const parsed = parseFieldKey(key);
      if (GROUP_BY_EXCLUDED.has(parsed)) {
        throw new Error(`Invalid groupBy column(s): ${key}`);
      }
      return {
        kind: 'column' as const,
        key,
        valueSql: parsed,
        selectSql: `${parsed} AS ${parsed}`,
        groupSql: parsed,
        resultKey: parsed,
      };
    }

    // Treat as label key — access from ClickHouse Map column
    const alias = `group_by_${index}`;
    const valueSql = `labels[{label_key_${index}:String}]`;
    return {
      kind: 'label' as const,
      key,
      valueSql,
      selectSql: `${valueSql} AS ${alias}`,
      groupSql: alias,
      resultKey: alias,
    };
  });
}

function addGroupByLabelParams(resolved: ResolvedGroupBy[]): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (let i = 0; i < resolved.length; i++) {
    if (resolved[i]!.kind === 'label') {
      params[`label_key_${i}`] = resolved[i]!.key;
    }
  }
  return params;
}

/** Builds WHERE conditions that exclude rows missing a requested label key. */
function buildLabelExclusionConditions(resolved: ResolvedGroupBy[]): string[] {
  return resolved.filter(e => e.kind === 'label').map(e => `${e.valueSql} != ''`);
}

function toSeriesDisplayValue(value: unknown): string {
  return value == null || value === '' ? '' : String(value);
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

export async function batchCreateMetrics(client: ClickHouseClient, args: BatchCreateMetricsArgs): Promise<void> {
  if (args.metrics.length === 0) return;

  await client.insert({
    table: TABLE_METRIC_EVENTS,
    values: args.metrics.map(metricRecordToRow),
    format: 'JSONEachRow',
    clickhouse_settings: CH_INSERT_SETTINGS,
  });
}

// ============================================================================
// List
// ============================================================================

export async function listMetrics(client: ClickHouseClient, args: ListMetricsArgs): Promise<ListMetricsResponse> {
  const parsed = listMetricsArgsSchema.parse(args);
  const filter = buildMetricsFilterConditions(parsed.filters, 'm');
  const pagination = buildPaginationClause(parsed.pagination);
  const orderBy = buildSignalOrderByClause(['timestamp'], parsed.orderBy, 'm');
  const whereClause = filter.conditions.length ? `WHERE ${filter.conditions.join(' AND ')}` : '';

  const countResult = await queryJson<{ total?: number }>(
    client,
    `SELECT count() AS total FROM ${TABLE_METRIC_EVENTS} AS m ${whereClause}`,
    filter.params,
  );

  const rows = await queryJson<Record<string, any>>(
    client,
    `SELECT * FROM ${TABLE_METRIC_EVENTS} AS m ${whereClause} ORDER BY ${orderBy} LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
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
    metrics: rows.map(rowToMetricRecord),
  };
}

// ============================================================================
// OLAP Queries
// ============================================================================

export async function getMetricAggregate(
  client: ClickHouseClient,
  args: GetMetricAggregateArgs,
): Promise<GetMetricAggregateResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const nameFilter = buildMetricNameFilter(args.name);
  const signalFilter = buildMetricsFilterConditions(args.filters);
  const combined = mergeFilters(nameFilter, signalFilter);
  const whereClause = toWhereClause(combined);

  const sql = `SELECT ${aggSql} AS value, ${getCostSummarySelect()} FROM ${TABLE_METRIC_EVENTS} ${whereClause}`;
  const result = await queryJson<Record<string, unknown>>(client, sql, combined.params);
  const row = result[0] ?? {};
  const value = row.value == null ? null : Number(row.value);
  const costSummary = normalizeCostSummaryRow(row);

  // Period comparison
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
      const prevSignalFilter = buildMetricsFilterConditions(prevFilters);
      const prevCombined = mergeFilters(nameFilter, prevSignalFilter);
      const prevWhereClause = toWhereClause(prevCombined);

      const prevSql = `SELECT ${aggSql} AS value, ${getCostSummarySelect()} FROM ${TABLE_METRIC_EVENTS} ${prevWhereClause}`;
      const prevResult = await queryJson<Record<string, unknown>>(client, prevSql, prevCombined.params);
      const prevRow = prevResult[0] ?? {};
      const previousValue = prevRow.value == null ? null : Number(prevRow.value);
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

export async function getMetricBreakdown(
  client: ClickHouseClient,
  args: GetMetricBreakdownArgs,
): Promise<GetMetricBreakdownResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const nameFilter = buildMetricNameFilter(args.name);
  const signalFilter = buildMetricsFilterConditions(args.filters);
  const combined = mergeFilters(nameFilter, signalFilter);

  const resolvedGroupBy = resolveGroupBy(args.groupBy);
  const labelParams = addGroupByLabelParams(resolvedGroupBy);
  const labelExclusions = buildLabelExclusionConditions(resolvedGroupBy);
  const selectGroupBy = resolvedGroupBy.map(e => e.selectSql).join(', ');
  const groupByCols = resolvedGroupBy.map(e => e.groupSql).join(', ');

  // Merge label exclusion conditions so rows missing a requested label key are excluded
  const allConditions = [...combined.conditions, ...labelExclusions];
  const fullWhereClause = allConditions.length ? `WHERE ${allConditions.join(' AND ')}` : '';

  const sql = `
    SELECT ${selectGroupBy}, ${aggSql} AS value, ${getCostSummarySelect()}
    FROM ${TABLE_METRIC_EVENTS}
    ${fullWhereClause}
    GROUP BY ${groupByCols}
    ORDER BY value DESC
  `;
  const rows = await queryJson<Record<string, unknown>>(client, sql, { ...combined.params, ...labelParams });

  const groups = rows.map(row => {
    const dimensions: Record<string, string | null> = {};
    for (const entry of resolvedGroupBy) {
      const val = row[entry.resultKey];
      dimensions[entry.key] = val == null || val === '' ? null : String(val);
    }
    const cs = normalizeCostSummaryRow(row);
    return {
      dimensions,
      value: Number(row.value ?? 0),
      estimatedCost: cs.estimatedCost,
      costUnit: cs.costUnit,
    };
  });

  return { groups };
}

export async function getMetricTimeSeries(
  client: ClickHouseClient,
  args: GetMetricTimeSeriesArgs,
): Promise<GetMetricTimeSeriesResponse> {
  const aggSql = getAggregationSql(args.aggregation);
  const intervalSql = getIntervalSql(args.interval);
  const nameFilter = buildMetricNameFilter(args.name);
  const signalFilter = buildMetricsFilterConditions(args.filters);
  const combined = mergeFilters(nameFilter, signalFilter);
  const whereClause = toWhereClause(combined);

  if (args.groupBy && args.groupBy.length > 0) {
    const resolvedGroupBy = resolveGroupBy(args.groupBy);
    const labelParams = addGroupByLabelParams(resolvedGroupBy);
    const labelExclusions = buildLabelExclusionConditions(resolvedGroupBy);
    const selectGroupBy = resolvedGroupBy.map(e => e.selectSql).join(', ');
    const groupByCols = resolvedGroupBy.map(e => e.groupSql).join(', ');

    const allConditions = [...combined.conditions, ...labelExclusions];
    const tsWhereClause = allConditions.length ? `WHERE ${allConditions.join(' AND ')}` : '';

    const sql = `
      SELECT toStartOfInterval(timestamp, ${intervalSql}) AS bucket,
             ${selectGroupBy},
             ${aggSql} AS value,
             ${getCostSummarySelect()}
      FROM ${TABLE_METRIC_EVENTS}
      ${tsWhereClause}
      GROUP BY bucket, ${groupByCols}
      ORDER BY bucket
    `;
    const rows = await queryJson<Record<string, unknown>>(client, sql, { ...combined.params, ...labelParams });

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
      const cs = normalizeCostSummaryRow(row);

      if (!seriesMap.has(seriesKey)) {
        seriesMap.set(seriesKey, { name, costUnits: new Set(), points: [] });
      }
      const entry = seriesMap.get(seriesKey)!;
      if (cs.costUnit) entry.costUnits.add(cs.costUnit);
      entry.points.push({
        timestamp: row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket)),
        value: Number(row.value ?? 0),
        estimatedCost: cs.estimatedCost,
      });
    }

    const series = Array.from(seriesMap.values()).map(s => ({
      name: s.name,
      costUnit: s.costUnits.size === 1 ? Array.from(s.costUnits)[0]! : null,
      points: s.points,
    }));

    return { series };
  }

  // No groupBy — single series using metric name(s)
  const metricName = args.name.join('|');
  const sql = `
    SELECT toStartOfInterval(timestamp, ${intervalSql}) AS bucket,
           ${aggSql} AS value,
           ${getCostSummarySelect()}
    FROM ${TABLE_METRIC_EVENTS}
    ${whereClause}
    GROUP BY bucket
    ORDER BY bucket
  `;
  const rows = await queryJson<Record<string, unknown>>(client, sql, combined.params);

  const overallCostUnits = new Set<string>();
  for (const row of rows) {
    const cs = normalizeCostSummaryRow(row);
    if (cs.costUnit) overallCostUnits.add(cs.costUnit);
  }

  return {
    series: [
      {
        name: metricName,
        costUnit: overallCostUnits.size === 1 ? Array.from(overallCostUnits)[0]! : null,
        points: rows.map(row => {
          const cs = normalizeCostSummaryRow(row);
          return {
            timestamp: row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket)),
            value: Number(row.value ?? 0),
            estimatedCost: cs.estimatedCost,
          };
        }),
      },
    ],
  };
}

export async function getMetricPercentiles(
  client: ClickHouseClient,
  args: GetMetricPercentilesArgs,
): Promise<GetMetricPercentilesResponse> {
  const intervalSql = getIntervalSql(args.interval);
  const signalFilter = buildMetricsFilterConditions(args.filters);
  const nameFilter: FilterResult = {
    conditions: [`name = {percentileName:String}`],
    params: { percentileName: args.name },
  };
  const combined = mergeFilters(nameFilter, signalFilter);
  const whereClause = toWhereClause(combined);

  const series = [];
  for (const p of args.percentiles) {
    if (p < 0 || p > 1) {
      throw new Error(`Percentile value must be between 0 and 1, got ${p}`);
    }
    const sql = `
      SELECT toStartOfInterval(timestamp, ${intervalSql}) AS bucket,
             quantile(${p})(value) AS pvalue
      FROM ${TABLE_METRIC_EVENTS}
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

// ============================================================================
// Discovery / Metadata — reads from helper tables, not source tables.
// Per design: returns empty results until helper tables have been refreshed.
// ============================================================================

export async function getMetricNames(
  client: ClickHouseClient,
  args: GetMetricNamesArgs,
): Promise<GetMetricNamesResponse> {
  const conditions: string[] = [`kind = 'metricName'`];
  const params: Record<string, unknown> = {};

  if (args.prefix) {
    conditions.push(`value LIKE {namePrefix:String}`);
    params.namePrefix = `${args.prefix}%`;
  }

  const limitClause = args.limit ? `LIMIT {nameLimit:UInt32}` : '';
  if (args.limit) params.nameLimit = args.limit;

  const rows = await queryJson<{ value: string }>(
    client,
    `SELECT value FROM ${TABLE_DISCOVERY_VALUES} WHERE ${conditions.join(' AND ')} ORDER BY value ${limitClause}`,
    params,
  );

  return { names: rows.map(r => r.value) };
}

export async function getMetricLabelKeys(
  client: ClickHouseClient,
  args: GetMetricLabelKeysArgs,
): Promise<GetMetricLabelKeysResponse> {
  const rows = await queryJson<{ value: string }>(
    client,
    `SELECT value FROM ${TABLE_DISCOVERY_VALUES} WHERE kind = 'metricLabelKey' AND key1 = {metricName:String} ORDER BY value`,
    { metricName: args.metricName },
  );
  return { keys: rows.map(r => r.value) };
}

export async function getMetricLabelValues(
  client: ClickHouseClient,
  args: GetMetricLabelValuesArgs,
): Promise<GetMetricLabelValuesResponse> {
  const conditions: string[] = [`kind = 'metricLabelValue'`, `key1 = {metricName:String}`, `key2 = {labelKey:String}`];
  const params: Record<string, unknown> = {
    metricName: args.metricName,
    labelKey: args.labelKey,
  };

  if (args.prefix) {
    conditions.push(`value LIKE {valPrefix:String}`);
    params.valPrefix = `${args.prefix}%`;
  }

  const limitClause = args.limit ? `LIMIT {valLimit:UInt32}` : '';
  if (args.limit) params.valLimit = args.limit;

  const rows = await queryJson<{ value: string }>(
    client,
    `SELECT value FROM ${TABLE_DISCOVERY_PAIRS} WHERE ${conditions.join(' AND ')} ORDER BY value ${limitClause}`,
    params,
  );

  return { values: rows.map(r => r.value) };
}
