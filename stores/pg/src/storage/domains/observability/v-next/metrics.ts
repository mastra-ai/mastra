/**
 * Metric operations for the v-next Postgres observability domain.
 *
 * Implements the full ObservabilityStorage metric surface — write, list,
 * aggregate, breakdown, time series, and percentiles. The OLAP queries
 * lean on standard Postgres aggregates (`SUM`, `AVG`, `percentile_cont`,
 * `FILTER (WHERE …)`) and a portable epoch-floor bucket expression so the
 * adapter works on vanilla Postgres and on a TimescaleDB hypertable
 * without query rewrites.
 */

import { listMetricsArgsSchema } from '@mastra/core/storage';
import type {
  BatchCreateMetricsArgs,
  GetMetricAggregateArgs,
  GetMetricAggregateResponse,
  GetMetricBreakdownArgs,
  GetMetricBreakdownResponse,
  GetMetricPercentilesArgs,
  GetMetricPercentilesResponse,
  GetMetricTimeSeriesArgs,
  GetMetricTimeSeriesResponse,
  ListMetricsArgs,
  ListMetricsResponse,
  MetricRecord,
} from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_METRIC_EVENTS } from './ddl';
import { applyCommonFilters, applySingleOrArrayFilter, newFilterAccumulator, whereOrEmpty } from './filters';
import { metricRecordToRow, rowToMetricRecord } from './helpers';
import {
  aggregationSql,
  bucketSql,
  changePercent,
  COMPLEX_GROUP_BY_EXCLUDED,
  COST_SUMMARY_SELECT,
  costSummaryFromRow,
  dimensionsFromRow,
  METRIC_TYPED_COLUMNS,
  pushLabelExclusions,
  resolveGroupBy,
  seriesNameFromDimensions,
  shiftRange,
} from './olap';
import { assertDeltaPollingEnabled, deltaPollingFeatureEnabled, encodeDeltaCursor, validateCursorId } from './polling';
import { buildInsert, METRIC_SELECT_COLUMNS } from './sql';

// ---------------------------------------------------------------------------
// Filter helpers specific to the metric signal
// ---------------------------------------------------------------------------

function applyMetricFilters(
  acc: ReturnType<typeof newFilterAccumulator>,
  filters: Record<string, any> | undefined,
): void {
  applyCommonFilters(acc, filters);
  applySingleOrArrayFilter(acc, 'name', filters?.name);
  applySingleOrArrayFilter(acc, 'provider', filters?.provider);
  applySingleOrArrayFilter(acc, 'model', filters?.model);
  applySingleOrArrayFilter(acc, 'costUnit', filters?.costUnit);
  if (filters?.labels) {
    acc.conditions.push(`"labels" @> $${acc.next++}::jsonb`);
    acc.params.push(JSON.stringify(filters.labels));
  }
}

/** Additional WHERE for metric-name restriction (OLAP queries take a `name` array). */
function pushMetricNameFilter(acc: ReturnType<typeof newFilterAccumulator>, names: readonly string[]): void {
  if (!names.length) return;
  const placeholders = names.map(() => `$${acc.next++}`).join(', ');
  acc.conditions.push(`"name" IN (${placeholders})`);
  acc.params.push(...names);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function batchCreateMetrics(
  client: DbClient,
  schema: string,
  args: BatchCreateMetricsArgs,
): Promise<void> {
  if (args.metrics.length === 0) return;
  const rows = args.metrics.map(metricRecordToRow);
  const insert = buildInsert(schema, TABLE_METRIC_EVENTS, rows);
  if (insert) await client.query(insert.text, insert.values);
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listMetrics(
  client: DbClient,
  schema: string,
  args: ListMetricsArgs,
): Promise<ListMetricsResponse> {
  const { mode, filters, pagination, orderBy, after, limit } = listMetricsArgsSchema.parse(args);
  const table = qualifiedTable(schema, TABLE_METRIC_EVENTS);

  if (mode === 'delta') {
    assertDeltaPollingEnabled();
    return listMetricsDelta(client, table, filters, after, limit);
  }

  return listMetricsPage(client, table, filters, pagination.page, pagination.perPage, orderBy.field, orderBy.direction);
}

async function listMetricsPage(
  client: DbClient,
  table: string,
  filters: ListMetricsArgs['filters'],
  page: number,
  perPage: number,
  orderField: 'timestamp',
  orderDir: 'ASC' | 'DESC',
): Promise<ListMetricsResponse> {
  const acc = newFilterAccumulator();
  applyMetricFilters(acc, filters);
  const whereClause = whereOrEmpty(acc);

  const countRow = await client.oneOrNone<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} ${whereClause}`,
    acc.params,
  );
  const count = Number(countRow?.count ?? 0);

  let metrics: MetricRecord[] = [];
  if (count > 0) {
    const rows = await client.manyOrNone<Record<string, any>>(
      `SELECT ${METRIC_SELECT_COLUMNS}
       FROM ${table}
       ${whereClause}
       ORDER BY "${orderField}" ${orderDir}
       LIMIT $${acc.next++} OFFSET $${acc.next++}`,
      [...acc.params, perPage, page * perPage],
    );
    metrics = rows.map(rowToMetricRecord);
  }

  const deltaCursor = deltaPollingFeatureEnabled()
    ? await readMetricsStreamHeadCursor(client, table, filters)
    : undefined;

  return {
    pagination: { total: count, page, perPage, hasMore: (page + 1) * perPage < count },
    metrics,
    ...(deltaCursor !== undefined ? { deltaCursor } : {}),
  };
}

async function listMetricsDelta(
  client: DbClient,
  table: string,
  filters: ListMetricsArgs['filters'],
  after: string | undefined,
  limit: number,
): Promise<ListMetricsResponse> {
  if (after === undefined) {
    const deltaCursor = await readMetricsStreamHeadCursor(client, table, filters);
    return { metrics: [], delta: { limit, hasMore: false }, deltaCursor };
  }

  const afterId = validateCursorId(after);
  const acc = newFilterAccumulator();
  applyMetricFilters(acc, filters);
  acc.conditions.push(`"cursorId" > $${acc.next++}::bigint`);
  acc.params.push(afterId);

  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT ${METRIC_SELECT_COLUMNS}
     FROM ${table}
     ${whereOrEmpty(acc)}
     ORDER BY "cursorId" ASC
     LIMIT $${acc.next++}`,
    [...acc.params, limit + 1],
  );

  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  const deltaCursor =
    visible.length > 0
      ? encodeDeltaCursor(visible[visible.length - 1]!.cursorId)
      : await readMetricsStreamHeadCursor(client, table, filters);

  return {
    metrics: visible.map(rowToMetricRecord),
    delta: { limit, hasMore },
    deltaCursor,
  };
}

async function readMetricsStreamHeadCursor(
  client: DbClient,
  table: string,
  filters: ListMetricsArgs['filters'],
): Promise<string> {
  const acc = newFilterAccumulator();
  applyMetricFilters(acc, filters);
  const filtered = await client.oneOrNone<{ cursorId: string | null }>(
    `SELECT MAX("cursorId")::text AS "cursorId" FROM ${table} ${whereOrEmpty(acc)}`,
    acc.params,
  );
  if (filtered?.cursorId != null) return encodeDeltaCursor(filtered.cursorId);

  const head = await client.oneOrNone<{ cursorId: string | null }>(
    `SELECT MAX("cursorId")::text AS "cursorId" FROM ${table}`,
  );
  return encodeDeltaCursor(head?.cursorId);
}

// ---------------------------------------------------------------------------
// OLAP — aggregate
// ---------------------------------------------------------------------------

async function runMetricAggregateQuery(
  client: DbClient,
  schema: string,
  filters: Record<string, any> | undefined,
  names: readonly string[],
  aggregation: GetMetricAggregateArgs['aggregation'],
): Promise<{ value: number | null; cost: ReturnType<typeof costSummaryFromRow> }> {
  const acc = newFilterAccumulator();
  pushMetricNameFilter(acc, names);
  applyMetricFilters(acc, filters);
  const where = whereOrEmpty(acc);

  const sql = `
    SELECT ${aggregationSql(aggregation, '"value"')} AS "value",
           ${COST_SUMMARY_SELECT}
    FROM ${qualifiedTable(schema, TABLE_METRIC_EVENTS)}
    ${where}
  `;
  const row = (await client.oneOrNone<Record<string, unknown>>(sql, acc.params)) ?? {};
  return {
    value: row.value == null ? null : Number(row.value),
    cost: costSummaryFromRow(row),
  };
}

export async function getMetricAggregate(
  client: DbClient,
  schema: string,
  args: GetMetricAggregateArgs,
): Promise<GetMetricAggregateResponse> {
  const { value, cost } = await runMetricAggregateQuery(client, schema, args.filters, args.name, args.aggregation);

  if (args.comparePeriod && args.filters?.timestamp) {
    const prevRange = shiftRange(args.filters.timestamp, args.comparePeriod);
    if (prevRange) {
      const prevFilters = { ...(args.filters ?? {}), timestamp: prevRange };
      const prev = await runMetricAggregateQuery(client, schema, prevFilters, args.name, args.aggregation);
      return {
        value,
        estimatedCost: cost.estimatedCost,
        costUnit: cost.costUnit,
        previousValue: prev.value,
        previousEstimatedCost: prev.cost.estimatedCost,
        changePercent: changePercent(value, prev.value),
        costChangePercent: changePercent(cost.estimatedCost, prev.cost.estimatedCost),
      };
    }
  }

  return { value, estimatedCost: cost.estimatedCost, costUnit: cost.costUnit };
}

// ---------------------------------------------------------------------------
// OLAP — breakdown
// ---------------------------------------------------------------------------

export async function getMetricBreakdown(
  client: DbClient,
  schema: string,
  args: GetMetricBreakdownArgs,
): Promise<GetMetricBreakdownResponse> {
  const acc = newFilterAccumulator();
  // GroupBy may bind label-key parameters first, but later WHERE conditions
  // also bind via the same accumulator. The resolution function pushes
  // label-key params via `acc.next++` so positional indexes line up.
  const resolved = resolveGroupBy(acc, args.groupBy, {
    typedColumns: METRIC_TYPED_COLUMNS,
    excludedColumns: COMPLEX_GROUP_BY_EXCLUDED,
    labelsColumn: 'labels',
  });
  pushMetricNameFilter(acc, args.name);
  applyMetricFilters(acc, args.filters);
  pushLabelExclusions(acc, resolved);

  const sql = `
    SELECT ${resolved.map(e => e.selectSql).join(', ')},
           ${aggregationSql(args.aggregation, '"value"')} AS "value",
           ${COST_SUMMARY_SELECT}
    FROM ${qualifiedTable(schema, TABLE_METRIC_EVENTS)}
    ${whereOrEmpty(acc)}
    GROUP BY ${resolved.map(e => e.alias).join(', ')}
    ORDER BY "value" DESC NULLS LAST
  `;

  const rows = await client.manyOrNone<Record<string, unknown>>(sql, acc.params);

  return {
    groups: rows.map(row => {
      const cs = costSummaryFromRow(row);
      return {
        dimensions: dimensionsFromRow(row, resolved),
        value: Number(row.value ?? 0),
        estimatedCost: cs.estimatedCost,
        costUnit: cs.costUnit,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// OLAP — time series
// ---------------------------------------------------------------------------

export async function getMetricTimeSeries(
  client: DbClient,
  schema: string,
  args: GetMetricTimeSeriesArgs,
): Promise<GetMetricTimeSeriesResponse> {
  const bucket = bucketSql('"timestamp"', args.interval);

  if (args.groupBy && args.groupBy.length > 0) {
    const acc = newFilterAccumulator();
    const resolved = resolveGroupBy(acc, args.groupBy, {
      typedColumns: METRIC_TYPED_COLUMNS,
      excludedColumns: COMPLEX_GROUP_BY_EXCLUDED,
      labelsColumn: 'labels',
    });
    pushMetricNameFilter(acc, args.name);
    applyMetricFilters(acc, args.filters);
    pushLabelExclusions(acc, resolved);

    const sql = `
      SELECT ${bucket} AS bucket,
             ${resolved.map(e => e.selectSql).join(', ')},
             ${aggregationSql(args.aggregation, '"value"')} AS "value",
             ${COST_SUMMARY_SELECT}
      FROM ${qualifiedTable(schema, TABLE_METRIC_EVENTS)}
      ${whereOrEmpty(acc)}
      GROUP BY bucket, ${resolved.map(e => e.alias).join(', ')}
      ORDER BY bucket
    `;

    const rows = await client.manyOrNone<Record<string, unknown>>(sql, acc.params);

    const seriesMap = new Map<
      string,
      {
        name: string;
        costUnits: Set<string>;
        points: { timestamp: Date; value: number; estimatedCost: number | null }[];
      }
    >();

    for (const row of rows) {
      const dimValues = resolved.map(e => row[e.alias]);
      const seriesKey = JSON.stringify(dimValues);
      const cs = costSummaryFromRow(row);

      let entry = seriesMap.get(seriesKey);
      if (!entry) {
        entry = { name: seriesNameFromDimensions(dimValues), costUnits: new Set(), points: [] };
        seriesMap.set(seriesKey, entry);
      }
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

  // No groupBy — single series per metric name set
  const acc = newFilterAccumulator();
  pushMetricNameFilter(acc, args.name);
  applyMetricFilters(acc, args.filters);

  const sql = `
    SELECT ${bucket} AS bucket,
           ${aggregationSql(args.aggregation, '"value"')} AS "value",
           ${COST_SUMMARY_SELECT}
    FROM ${qualifiedTable(schema, TABLE_METRIC_EVENTS)}
    ${whereOrEmpty(acc)}
    GROUP BY bucket
    ORDER BY bucket
  `;
  const rows = await client.manyOrNone<Record<string, unknown>>(sql, acc.params);

  const overallCostUnits = new Set<string>();
  for (const row of rows) {
    const cs = costSummaryFromRow(row);
    if (cs.costUnit) overallCostUnits.add(cs.costUnit);
  }

  return {
    series: [
      {
        name: args.name.join('|'),
        costUnit: overallCostUnits.size === 1 ? Array.from(overallCostUnits)[0]! : null,
        points: rows.map(row => {
          const cs = costSummaryFromRow(row);
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

// ---------------------------------------------------------------------------
// OLAP — percentiles
// ---------------------------------------------------------------------------

export async function getMetricPercentiles(
  client: DbClient,
  schema: string,
  args: GetMetricPercentilesArgs,
): Promise<GetMetricPercentilesResponse> {
  if (!args.percentiles.length) {
    throw new Error('Percentiles must include at least one value between 0 and 1.');
  }
  for (const p of args.percentiles) {
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      throw new Error(`Percentile value must be a finite number between 0 and 1, got ${p}`);
    }
  }

  const bucket = bucketSql('"timestamp"', args.interval);

  // Compute all requested percentiles in a single query — Postgres allows
  // multiple `percentile_cont` aggregates per row, which avoids re-scanning.
  const acc = newFilterAccumulator();
  pushMetricNameFilter(acc, [args.name]);
  applyMetricFilters(acc, args.filters);

  const percentileSelect = args.percentiles
    .map((p, i) => `percentile_cont(${p}) WITHIN GROUP (ORDER BY "value") AS p${i}`)
    .join(', ');

  const sql = `
    SELECT ${bucket} AS bucket, ${percentileSelect}
    FROM ${qualifiedTable(schema, TABLE_METRIC_EVENTS)}
    ${whereOrEmpty(acc)}
    GROUP BY bucket
    ORDER BY bucket
  `;
  const rows = await client.manyOrNone<Record<string, unknown>>(sql, acc.params);

  return {
    series: args.percentiles.map((p, i) => ({
      percentile: p,
      points: rows.map(row => ({
        timestamp: row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket)),
        value: Number(row[`p${i}`] ?? 0),
      })),
    })),
  };
}
