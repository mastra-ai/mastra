/**
 * Shared OLAP helpers for the v-next Postgres observability domain.
 *
 * Translates ClickHouse-flavored OLAP idioms (the v-next spec) into Postgres:
 *
 *   - `toStartOfInterval(ts, INTERVAL '5 MINUTE')` becomes a portable
 *     epoch-floor expression (`to_timestamp(floor(extract(epoch from ts) / N) * N)`)
 *     so arbitrary 1m / 5m / 15m / 1h / 1d buckets work without TimescaleDB.
 *     On a hypertable Postgres still uses chunk pruning over this expression.
 *   - `quantile(p)(value)` becomes `percentile_cont($p) WITHIN GROUP (ORDER BY value)`.
 *   - `argMax(value, ts)` ("last") becomes `(array_agg(value ORDER BY ts DESC))[1]`.
 *   - `sumIf` / `countDistinctIf` use SQL-standard `FILTER (WHERE …)` aggregates.
 *
 * GroupBy resolution mirrors the ClickHouse v-next behavior: typed columns
 * are quoted directly; unknown keys are treated as label / metadata keys and
 * accessed with `jsonb ->>`.
 */

import { METRIC_DISTINCT_COLUMNS } from '@mastra/core/storage';
import type { AggregationInterval, AggregationType, MetricDistinctColumn } from '@mastra/core/storage';
import { parseFieldKey } from '@mastra/core/utils';

import type { FilterAccumulator } from './filters';

/** Subset of the ComparePeriod enum we react to. */
export type ComparePeriod = 'previous_period' | 'previous_day' | 'previous_week';

/** Time range slice we reuse from filter args. */
export interface PgDateRange {
  start?: Date;
  end?: Date;
  startExclusive?: boolean;
  endExclusive?: boolean;
}

// ---------------------------------------------------------------------------
// Bucket / aggregation SQL
// ---------------------------------------------------------------------------

const INTERVAL_SECONDS: Record<AggregationInterval, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3_600,
  '1d': 86_400,
};

/**
 * Returns a bucket expression that floors `column` to the start of the
 * requested interval. The expression is portable across Postgres versions
 * and works equally on a Timescale hypertable.
 *
 * Buckets are UTC-aligned (floor of Unix epoch). A `1d` bucket spans
 * `00:00:00Z` → `23:59:59Z`, not local midnight. Charts that need
 * local-day buckets should set the desired offset on the time-range filter
 * rather than expect this helper to honor a session timezone.
 */
export function bucketSql(column: string, interval: AggregationInterval): string {
  const seconds = INTERVAL_SECONDS[interval] ?? 3_600;
  // to_timestamp + floor of unix-epoch is exact for all intervals up to 1 day.
  // The result is a timestamptz at UTC, which we render via the standard
  // pg driver (Date object) and pass straight back to clients.
  return `to_timestamp(floor(extract(epoch from ${column}) / ${seconds}) * ${seconds})`;
}

function resolveDistinctColumnSql(distinctColumn: MetricDistinctColumn | undefined): string {
  if (!distinctColumn) {
    throw new Error(`count_distinct aggregation requires a 'distinctColumn' argument`);
  }
  // Defense-in-depth: the schema enum already restricts this, but the value
  // flows into raw SQL so we re-check against the system-level allowlist.
  if (!(METRIC_DISTINCT_COLUMNS as readonly string[]).includes(distinctColumn)) {
    throw new Error(`Invalid distinctColumn: ${distinctColumn}`);
  }
  return `"${parseFieldKey(distinctColumn)}"`;
}

/** SQL aggregate for metric queries, including metric-specific distinct counts. */
export function metricAggregationSql(
  agg: AggregationType,
  measure: string,
  timestampColumn = 'timestamp',
  distinctColumn?: MetricDistinctColumn,
): string {
  if (agg === 'count_distinct') {
    return `COUNT(DISTINCT ${resolveDistinctColumnSql(distinctColumn)})::double precision`;
  }
  return aggregationSql(agg, measure, timestampColumn);
}

/** SQL aggregate for the standard agg types over a numeric column. */
export function aggregationSql(agg: AggregationType, measure: string, timestampColumn = 'timestamp'): string {
  switch (agg) {
    case 'sum':
      return `SUM(${measure})`;
    case 'avg':
      return `AVG(${measure})`;
    case 'min':
      return `MIN(${measure})`;
    case 'max':
      return `MAX(${measure})`;
    case 'count':
      return `COUNT(${measure})::double precision`;
    case 'last':
      // Postgres has no `argMax`. Pull the latest non-null value via array_agg.
      return `(array_agg(${measure} ORDER BY "${timestampColumn}" DESC))[1]`;
    default:
      return `SUM(${measure})`;
  }
}

// ---------------------------------------------------------------------------
// GroupBy resolution
// ---------------------------------------------------------------------------

export interface ResolvedGroupBy {
  /** The key the caller asked for. Echoed back in dimensions. */
  requestedKey: string;
  /** SQL alias used for the column in SELECT / GROUP BY. */
  alias: string;
  /** The select expression (e.g. `"labels" ->> $1 AS group_by_0`). */
  selectSql: string;
  /** The bare SQL value expression (used in WHERE for label-exclusion). */
  valueSql: string;
}

/**
 * Resolves a list of groupBy keys against the set of typed columns for a
 * signal table. Unknown keys are treated as JSONB lookups against
 * `labelsColumn` (default `"labels"`) — used by metrics breakdowns.
 *
 * Throws when a key is structurally invalid (not SQL-safe) or matches an
 * excluded column type (jsonb / text[]).
 */
export function resolveGroupBy(
  acc: FilterAccumulator,
  groupBy: string[],
  options: {
    typedColumns: Set<string>;
    excludedColumns?: Set<string>;
    labelsColumn?: string;
  },
): ResolvedGroupBy[] {
  const labelsColumn = options.labelsColumn ?? null;
  const excluded = options.excludedColumns ?? new Set<string>();

  return groupBy.map((key, index) => {
    const alias = `group_by_${index}`;
    if (options.typedColumns.has(key)) {
      const parsed = parseFieldKey(key);
      if (excluded.has(parsed)) {
        throw new Error(`Invalid groupBy column(s): ${key}`);
      }
      return {
        requestedKey: key,
        alias,
        selectSql: `"${parsed}" AS ${alias}`,
        valueSql: `"${parsed}"`,
      };
    }
    if (!labelsColumn) {
      throw new Error(`Invalid groupBy column(s): ${key}`);
    }
    // Treat as a label / metadata key. Bind the key as a parameter; the
    // returned value is text, which we coerce to nullable string in JS.
    const valueSql = `"${labelsColumn}" ->> $${acc.next++}`;
    acc.params.push(key);
    return {
      requestedKey: key,
      alias,
      selectSql: `${valueSql} AS ${alias}`,
      valueSql,
    };
  });
}

/** Adds WHERE clauses that exclude rows missing a requested label key. */
export function pushLabelExclusions(acc: FilterAccumulator, resolved: ResolvedGroupBy[]): void {
  for (const entry of resolved) {
    if (entry.valueSql.includes('->>')) {
      acc.conditions.push(`${entry.valueSql} IS NOT NULL`);
      acc.conditions.push(`${entry.valueSql} <> ''`);
    }
  }
}

export function dimensionsFromRow(
  row: Record<string, unknown>,
  resolved: ResolvedGroupBy[],
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const entry of resolved) {
    const v = row[entry.alias];
    out[entry.requestedKey] = v == null || v === '' ? null : String(v);
  }
  return out;
}

export function seriesNameFromDimensions(values: unknown[]): string {
  return values.map(v => (v == null || v === '' ? '' : String(v))).join('|');
}

// ---------------------------------------------------------------------------
// Period-over-period helpers
// ---------------------------------------------------------------------------

/** Compute the previous-period date range based on the comparePeriod selection. */
export function shiftRange(range: PgDateRange, period: ComparePeriod): PgDateRange | null {
  if (!range.start || !range.end) return null;
  const start = range.start.getTime();
  const end = range.end.getTime();
  const duration = end - start;

  let offset: number;
  switch (period) {
    case 'previous_day':
      offset = 86_400_000;
      break;
    case 'previous_week':
      offset = 7 * 86_400_000;
      break;
    case 'previous_period':
    default:
      offset = duration;
  }
  return {
    start: new Date(start - offset),
    end: new Date(end - offset),
    startExclusive: range.startExclusive,
    endExclusive: range.endExclusive,
  };
}

export function changePercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function bucketDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

export function validatePercentiles(percentiles: readonly number[]): void {
  if (!percentiles.length) {
    throw new Error('Percentiles must include at least one value between 0 and 1.');
  }
  for (const percentile of percentiles) {
    if (!Number.isFinite(percentile) || percentile < 0 || percentile > 1) {
      throw new Error(`Percentile value must be a finite number between 0 and 1, got ${percentile}`);
    }
  }
}

export function percentileSelectSql(percentiles: readonly number[], measureSql: string): string {
  return percentiles
    .map((percentile, index) => `percentile_cont(${percentile}) WITHIN GROUP (ORDER BY ${measureSql}) AS p${index}`)
    .join(', ');
}

export function percentileSeriesFromRows(
  rows: Record<string, unknown>[],
  percentiles: readonly number[],
): { percentile: number; points: { timestamp: Date; value: number }[] }[] {
  return percentiles.map((percentile, index) => ({
    percentile,
    points: rows.map(row => ({
      timestamp: bucketDate(row.bucket),
      value: Number(row[`p${index}`] ?? 0),
    })),
  }));
}

export function collectSeriesByDimensions<Row extends Record<string, unknown>, Entry>(
  rows: Row[],
  resolved: ResolvedGroupBy[],
  createEntry: (dimensionValues: unknown[]) => Entry,
  appendRow: (entry: Entry, row: Row, dimensionValues: unknown[]) => void,
): Entry[] {
  const seriesMap = new Map<string, Entry>();

  for (const row of rows) {
    const dimensionValues = resolved.map(entry => row[entry.alias]);
    const seriesKey = JSON.stringify(dimensionValues);
    let entry = seriesMap.get(seriesKey);
    if (!entry) {
      entry = createEntry(dimensionValues);
      seriesMap.set(seriesKey, entry);
    }
    appendRow(entry, row, dimensionValues);
  }

  return Array.from(seriesMap.values());
}

// ---------------------------------------------------------------------------
// Cost summary aggregates (used in metric OLAP responses)
// ---------------------------------------------------------------------------

export interface CostSummary {
  estimatedCost: number | null;
  costUnit: string | null;
}

/** SQL for the (estimatedCost, costUnit) pair embedded in metric OLAP responses. */
export const COST_SUMMARY_SELECT = `
  SUM("estimatedCost") FILTER (WHERE "estimatedCost" IS NOT NULL) AS "agg_estimatedCost",
  CASE
    WHEN COUNT(DISTINCT "costUnit") FILTER (WHERE "costUnit" IS NOT NULL) = 1
      THEN MIN("costUnit") FILTER (WHERE "costUnit" IS NOT NULL)
    ELSE NULL
  END AS "agg_costUnit"
`;

export function costSummaryFromRow(row: Record<string, unknown>): CostSummary {
  return {
    estimatedCost: row.agg_estimatedCost == null ? null : Number(row.agg_estimatedCost),
    costUnit: row.agg_costUnit == null || row.agg_costUnit === '' ? null : String(row.agg_costUnit),
  };
}

export const COMPLEX_GROUP_BY_EXCLUDED = new Set([
  'metadata',
  'metadataRaw',
  'metadataSearch',
  'scope',
  'attributes',
  'links',
  'input',
  'output',
  'error',
  'data',
  'labels',
  'costMetadata',
  'tags',
  'requestContext',
]);
