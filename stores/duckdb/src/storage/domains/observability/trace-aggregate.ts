import * as coreStorage from '@mastra/core/storage';
import type {
  TraceAggregateCountDistinctField,
  TraceAggregateDimension,
  TraceAggregateResponse,
  TraceAggregateRow,
  TrustedTraceAggregateHavingPredicate,
  TrustedTraceAggregateMeasure,
  TrustedTraceAggregateMeasureName,
  TrustedTraceAggregatePlan,
} from '@mastra/core/storage';

import type { DuckDBConnection } from '../../db/index';
import {
  asIsoTimestamp,
  compileDuckDBTraceCandidates,
  durationMsSql,
  isDuckDBResourceLimit,
  TRACE_METADATA_VALUE_SQL,
  TRACE_STATUS_SQL,
  traceMetadataPathValues,
} from './trace-query';
import type { CompiledDuckDBTraceQuery } from './trace-query';

/** Trace-root column expressions (alias `r`) for each groupable dimension; same values `where` sees. */
const DIMENSION_SQL: Record<string, string> = {
  entityType: 'r.entityType',
  entityName: 'r.entityName',
  environment: 'r.environment',
  status: TRACE_STATUS_SQL,
  serviceName: 'r.serviceName',
  executionSource: 'r.executionSource',
  threadId: 'r.threadId',
  resourceId: 'r.resourceId',
  userId: 'r.userId',
  sessionId: 'r.sessionId',
  organizationId: 'r.organizationId',
  experimentId: 'r.experimentId',
};

const PERCENTILES: Record<string, number> = {
  'duration.p50': 0.5,
  'duration.p90': 0.9,
  'duration.p95': 0.95,
  'duration.p99': 0.99,
};

const COMPARISON_SQL = { eq: '=', ne: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=' } as const;

/**
 * Compiles a trusted aggregate plan. The plan's caps are enforced by the planner and trusted here.
 *
 * Every candidate root is first reduced to a `facts` row (dimension values, duration, error flag,
 * countDistinct inputs, bucket) so grouping, measures, and joins only reference plain columns.
 * Without `interval`, groups are filtered, ordered, and limited in one grouped select. With
 * `interval`, a `ranked` CTE ranks groups on whole-window measures, then only the top `limit`
 * groups are expanded into per-bucket rows.
 *
 * Parameters are positional, so `values` is appended in the order placeholders appear in the text.
 */
export interface DuckDBTraceAggregateOptions {
  /**
   * `metric_events` has its `metricId` primary key, so retried writes cannot be stored twice and
   * the usage stage skips its dedupe. Defaults to `false` (dedupe) when the table was not checked.
   */
  metricIdsUnique?: boolean;
}

export function compileDuckDBTraceAggregate(
  plan: TrustedTraceAggregatePlan,
  options: DuckDBTraceAggregateOptions = {},
): CompiledDuckDBTraceQuery {
  const { ctes, values } = compileDuckDBTraceCandidates(plan, 'r.*');

  const dimensionSql = (field: TraceAggregateDimension): { sql: string; values: unknown[] } => {
    if (field.startsWith('metadata.')) {
      return { sql: TRACE_METADATA_VALUE_SQL, values: traceMetadataPathValues(field.slice('metadata.'.length)) };
    }
    const sql = Object.hasOwn(DIMENSION_SQL, field) ? DIMENSION_SQL[field] : undefined;
    if (sql === undefined) throw new Error(`Unsupported trusted trace-aggregate field: ${field}`);
    return { sql, values: [] };
  };
  const distinctSql = (field: TraceAggregateCountDistinctField) =>
    field === 'traceId' ? { sql: 'r.traceId', values: [] } : dimensionSql(field);

  const dimensionColumns = plan.dimensions.map((_, index) => `d${index}`);
  const distinctColumns = new Map<string, string>();
  const factColumns: string[] = [];
  plan.dimensions.forEach((dimension, index) => {
    const compiled = dimensionSql(dimension);
    factColumns.push(`CAST(${compiled.sql} AS VARCHAR) AS d${index}`);
    values.push(...compiled.values);
  });
  for (const measure of plan.measures) {
    if (measure.type !== 'countDistinct' || distinctColumns.has(measure.field)) continue;
    const column = `cd${distinctColumns.size}`;
    distinctColumns.set(measure.field, column);
    const compiled = distinctSql(measure.field);
    factColumns.push(`CAST(${compiled.sql} AS VARCHAR) AS ${column}`);
    values.push(...compiled.values);
  }
  factColumns.push(
    `CAST(${durationMsSql('r.startedAt', 'r.endedAt')} AS DOUBLE) AS durationMs`,
    `r.error IS NOT NULL AS isError`,
  );
  if (plan.interval !== undefined) {
    const intervalMs = coreStorage.TRACE_AGGREGATE_INTERVAL_MS[plan.interval];
    if (intervalMs === undefined) throw new Error(`Unsupported trusted trace-aggregate interval: ${plan.interval}`);
    // UTC-aligned bucket containing startedAt; may begin before timeRange.from.
    factColumns.push(`epoch_ms((epoch_ms(r.startedAt) // ${intervalMs}) * ${intervalMs}) AS bucket`);
  }
  const measureKinds = new Set(plan.measures.map(measure => measureRule(measure.name)?.kind));
  const hasCost = measureKinds.has('cost');
  if (!hasCost && !measureKinds.has('tokens')) {
    ctes.push(`facts AS (
    SELECT ${factColumns.join(',\n      ')}
    FROM candidates r
  )`);
  } else {
    // `candidates` holds full-width root rows; read it once into narrow per-trace facts, which both
    // the usage scan and the final join use. Its placeholders precede the usage stage's in the text.
    ctes.push(`base_facts AS (
    SELECT r.traceId, ${factColumns.join(',\n      ')}
    FROM candidates r
  )`);
    ctes.push(...compileUsageCtes(plan, values, { hasCost, dedupe: !options.metricIdsUnique }));
    // NULL for traces without usage; 0 for a usage-bearing trace with no row of that name.
    const usageColumns = USAGE_METRIC_NAMES.map(
      (_, index) => `CASE WHEN u.traceId IS NOT NULL THEN COALESCE(u.t${index}, 0) END AS t${index}`,
    );
    usageColumns.push(`u.traceId IS NOT NULL AS usageBearing`);
    if (hasCost) {
      usageColumns.push(
        `CASE WHEN u.priced THEN u.cost END AS traceCost`,
        `COALESCE(u.priced AND NOT u.pricingFailure, FALSE) AS covered`,
        `u.unitMin AS unitMin`,
        `u.unitMax AS unitMax`,
      );
    }
    ctes.push(`facts AS (
    SELECT b.*,
      ${usageColumns.join(',\n      ')}
    FROM base_facts b
    LEFT JOIN usage u ON u.traceId = b.traceId
  )`);
  }

  // All measures are DOUBLE so having literals compare without integer-cast surprises.
  const measureSql = (name: TrustedTraceAggregateMeasureName, alias = ''): string => {
    const column = (name: string) => `${alias}${name}`;
    if (name === 'count') return 'CAST(count(*) AS DOUBLE)';
    if (name === 'errorCount') return `CAST(count_if(${column('isError')}) AS DOUBLE)`;
    if (name === 'errorRate') return `CAST(count_if(${column('isError')}) AS DOUBLE) / count(*)`;
    if (name === 'duration.avg') return `avg(${column('durationMs')})`;
    if (name === 'duration.min') return `min(${column('durationMs')})`;
    if (name === 'duration.max') return `max(${column('durationMs')})`;
    const percentile = PERCENTILES[name];
    if (percentile !== undefined) return `quantile_cont(${column('durationMs')}, ${percentile})`;
    const rule = measureRule(name);
    // avg/sum skip the NULL per-trace values of traces without usage (tokens) or pricing (cost),
    // and return NULL when no trace qualifies.
    if (rule?.kind === 'tokens' && rule.metricNames) {
      const value = rule.metricNames.map(metricName => column(`t${usageMetricIndex(metricName)}`)).join(' + ');
      return `CAST(${rule.statistic === 'avg' ? 'avg' : 'sum'}(${value}) AS DOUBLE)`;
    }
    if (rule?.kind === 'cost') {
      const aggregate = rule.statistic === 'avg' ? 'avg' : 'sum';
      return `CASE WHEN ${mixedUnitsSql(alias)} THEN NULL ELSE CAST(${aggregate}(${column('traceCost')}) AS DOUBLE) END`;
    }
    const measure = plan.measures.find(
      (candidate): candidate is Extract<TrustedTraceAggregateMeasure, { type: 'countDistinct' }> =>
        candidate.type === 'countDistinct' && candidate.name === name,
    );
    const distinctColumn = measure && distinctColumns.get(measure.field);
    if (distinctColumn === undefined) throw new Error(`Unsupported trusted trace-aggregate measure: ${name}`);
    return `CAST(count(DISTINCT ${alias}${distinctColumn}) AS DOUBLE)`;
  };

  const havingValues: unknown[] = [];
  const compileHaving = (predicate: TrustedTraceAggregateHavingPredicate): string => {
    if (predicate.type === 'boolean') {
      return predicate.args.map(arg => `(${compileHaving(arg)})`).join(predicate.operator === 'and' ? ' AND ' : ' OR ');
    }
    if (predicate.type === 'not') return `NOT (${compileHaving(predicate.arg)})`;
    const measure = measureSql(predicate.measure);
    if (predicate.type === 'membership') {
      if (predicate.values.length === 0) return predicate.operator === 'in' ? 'FALSE' : 'TRUE';
      havingValues.push(...predicate.values);
      const list = predicate.values.map(() => 'CAST(? AS DOUBLE)').join(', ');
      return `${measure} ${predicate.operator === 'in' ? 'IN' : 'NOT IN'} (${list})`;
    }
    const operator = COMPARISON_SQL[predicate.operator];
    if (operator === undefined) throw new Error(`Unsupported trusted trace-aggregate operator: ${predicate.operator}`);
    havingValues.push(predicate.value);
    return `${measure} ${operator} CAST(? AS DOUBLE)`;
  };

  // `count > 0` keeps an ungrouped aggregate over an empty population from yielding a zero row.
  const havingSql = ['count(*) > 0', ...(plan.having ? [`(${compileHaving(plan.having)})`] : [])].join(' AND ');
  const direction = plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC';
  let orderTarget: string;
  if (plan.orderBy.target === 'measure') {
    orderTarget = measureSql(plan.orderBy.measure);
  } else {
    const index = plan.dimensions.indexOf(plan.orderBy.dimension);
    if (index === -1) throw new Error(`Unsupported trusted trace-aggregate order dimension: ${plan.orderBy.dimension}`);
    orderTarget = dimensionColumns[index]!;
  }
  const orderSql = [
    `${orderTarget} ${direction} NULLS LAST`,
    ...dimensionColumns.map(column => `${column} ASC NULLS LAST`),
  ].join(', ');
  const groupSql = dimensionColumns.length > 0 ? `\nGROUP BY ${dimensionColumns.join(', ')}` : '';

  if (plan.interval === undefined) {
    const projected = [
      ...dimensionColumns,
      ...plan.measures.map((measure, index) => `${measureSql(measure.name)} AS m${index}`),
      ...(hasCost ? costColumns('') : []),
    ];
    values.push(...havingValues, plan.limit + 1);
    return {
      sql: `WITH ${ctes.join(',\n  ')}
SELECT ${projected.join(', ')}
FROM facts${groupSql}
HAVING ${havingSql}
ORDER BY ${orderSql}
LIMIT ?`,
      values,
    };
  }

  ctes.push(`ranked AS (
    SELECT ${[...dimensionColumns, `row_number() OVER (ORDER BY ${orderSql}) AS rank`].join(', ')}
    FROM facts${groupSql}
    HAVING ${havingSql}
    ORDER BY ${orderSql}
    LIMIT ?
  )`);
  values.push(...havingValues, plan.limit + 1);
  const joinSql =
    dimensionColumns.length > 0
      ? dimensionColumns.map(column => `f.${column} IS NOT DISTINCT FROM g.${column}`).join(' AND ')
      : 'TRUE';
  const projected = [
    ...dimensionColumns.map(column => `f.${column}`),
    'f.bucket',
    ...plan.measures.map((measure, index) => `${measureSql(measure.name, 'f.')} AS m${index}`),
    ...(hasCost ? costColumns('f.') : []),
    `(SELECT count(*) FROM ranked) > ? AS truncated`,
  ];
  values.push(plan.limit, plan.limit);
  return {
    sql: `WITH ${ctes.join(',\n  ')}
SELECT ${projected.join(', ')}
FROM facts f
JOIN ranked g ON ${joinSql}
WHERE g.rank <= ?
GROUP BY ${['g.rank', ...dimensionColumns.map(column => `f.${column}`), 'f.bucket'].join(', ')}
ORDER BY g.rank ASC, f.bucket ASC`,
    values,
  };
}

const USAGE_METRIC_NAMES: readonly string[] = coreStorage.TRACE_AGGREGATE_USAGE_METRIC_NAMES;

function measureRule(name: string): coreStorage.TraceAggregateMeasureRule | undefined {
  return coreStorage.isTraceAggregateCanonicalMeasure(name)
    ? coreStorage.TRACE_AGGREGATE_MEASURE_REGISTRY[name]
    : undefined;
}

function usageMetricIndex(name: string): number {
  const index = USAGE_METRIC_NAMES.indexOf(name);
  if (index === -1) throw new Error(`Unsupported trusted trace-aggregate token metric: ${name}`);
  return index;
}

/** More than one distinct priced unit in the group; NULL (treated as false) when nothing is priced. */
function mixedUnitsSql(alias: string): string {
  return `min(${alias}unitMin) <> max(${alias}unitMax)`;
}

/** Row cost fields, projected only for cost requests. */
function costColumns(alias: string): string[] {
  const mixed = coreStorage.TRACE_AGGREGATE_MIXED_COST_UNIT.replaceAll("'", "''");
  return [
    `CAST(count_if(${alias}covered) AS DOUBLE) / NULLIF(count_if(${alias}usageBearing), 0) AS costCoverage`,
    `CASE WHEN ${mixedUnitsSql(alias)} THEN '${mixed}' ELSE min(${alias}unitMin) END AS costUnit`,
  ];
}

/**
 * Builds `usage_bounds`, `usage_rows`, and `usage`: one row per candidate trace that has at least
 * one token metric row, holding per-name token sums (`t<i>`, indexed by
 * `TRACE_AGGREGATE_USAGE_METRIC_NAMES`) and, for cost requests, the trace's pricing state. Metric
 * rows are matched by traceId, usage metric name, tenant scope, and `timestamp >= from` only: a
 * trace that starts in the window can emit metrics after `to`, and the semi-join bounds the scan.
 *
 * DuckDB cannot push the `traceId IN (...)` semi-join into the table scan, so `usage_bounds`
 * first reads the exact timestamp range of the qualifying rows from narrow columns, and
 * `usage_rows` decompresses the wide columns only inside that range.
 *
 * Without the `metricId` primary key, retried copies are collapsed with `DISTINCT ON`; copies are
 * identical, so whichever survives is the same.
 *
 * Placeholders are bound in text order: `param` pushes each value as its placeholder is emitted.
 */
function compileUsageCtes(
  plan: TrustedTraceAggregatePlan,
  values: unknown[],
  { hasCost, dedupe }: { hasCost: boolean; dedupe: boolean },
): string[] {
  const param = (value: unknown) => {
    values.push(value);
    return '?';
  };
  const list = (items: readonly unknown[]) => items.map(param).join(', ');
  const scope = (alias: string) => {
    if (!plan.scope) return '';
    let sql = `\n        AND ${alias}organizationId = ${param(plan.scope.organizationId)}`;
    if (plan.scope.resourceId !== undefined)
      sql += `\n        AND ${alias}resourceId = ${param(plan.scope.resourceId)}`;
    return sql;
  };
  const costNames = coreStorage.TRACE_AGGREGATE_COST_METRIC_NAMES;

  const bounds = `usage_bounds AS (
      SELECT min(timestamp) AS minTs, max(timestamp) AS maxTs
      FROM metric_events
      WHERE traceId IN (SELECT traceId FROM base_facts)
        AND name IN (${list(USAGE_METRIC_NAMES)})
        AND timestamp >= CAST(${param(plan.timeRange.from)} AS TIMESTAMP)${scope('')}
    )`;

  const costSelect = hasCost
    ? `,
        m.estimatedCost,
        m.costUnit,
        m.name IN (${list(costNames)}) AS costRow,
        CASE WHEN m.name IN (${list(costNames)})
          THEN COALESCE(json_type(m.costMetadata, '$.error'), 'NULL') <> 'NULL'
          ELSE FALSE
        END AS hasError`
    : '';
  const rows = `usage_rows AS (
      SELECT ${dedupe ? 'DISTINCT ON (m.metricId) ' : ''}m.traceId, m.name, m.value${costSelect}
      FROM metric_events m
      WHERE m.timestamp >= (SELECT minTs FROM usage_bounds)
        AND m.timestamp <= (SELECT maxTs FROM usage_bounds)
        AND m.traceId IN (SELECT traceId FROM base_facts)
        AND m.name IN (${list(USAGE_METRIC_NAMES)})${scope('m.')}
    )`;

  const columns = USAGE_METRIC_NAMES.map(name => `sum(value) FILTER (WHERE name = ${param(name)})`).map(
    (sql, index) => `${sql} AS t${index}`,
  );
  if (hasCost) {
    const priced = 'costRow AND estimatedCost IS NOT NULL AND costUnit IS NOT NULL AND NOT hasError';
    columns.push(
      `sum(estimatedCost) FILTER (WHERE ${priced}) AS cost`,
      `bool_or(${priced}) AS priced`,
      `bool_or(costRow AND (hasError OR (estimatedCost IS NOT NULL AND costUnit IS NULL))) AS pricingFailure`,
      `min(costUnit) FILTER (WHERE ${priced}) AS unitMin`,
      `max(costUnit) FILTER (WHERE ${priced}) AS unitMax`,
    );
  }
  const usage = `usage AS (
      SELECT traceId,
        ${columns.join(',\n        ')}
      FROM usage_rows
      GROUP BY traceId
    )`;
  return [bounds, rows, usage];
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export async function aggregateTraces(
  db: DuckDBConnection,
  plan: TrustedTraceAggregatePlan,
  options: DuckDBTraceAggregateOptions = {},
): Promise<TraceAggregateResponse> {
  const compiled = compileDuckDBTraceAggregate(plan, options);
  let result: Record<string, unknown>[];
  try {
    result = await db.query<Record<string, unknown>>(compiled.sql, compiled.values);
  } catch (error) {
    if (isDuckDBResourceLimit(error)) throw new coreStorage.TraceQueryResourceLimitError();
    throw error;
  }

  let truncated: boolean;
  let resultRows: Record<string, unknown>[];
  if (plan.interval === undefined) {
    truncated = result.length > plan.limit;
    resultRows = result.slice(0, plan.limit);
  } else {
    truncated = result[0]?.truncated === true;
    resultRows = result;
  }

  const rows = resultRows.map(row => {
    // Measures holds exactly the requested names, which the core record type cannot express.
    const shaped: TraceAggregateRow = {
      measures: Object.fromEntries(
        plan.measures.map((measure, index) => [measure.name, nullableNumber(row[`m${index}`])]),
      ) as TraceAggregateRow['measures'],
    };
    if ('costCoverage' in row) {
      shaped.cost = { coverage: nullableNumber(row.costCoverage), unit: (row.costUnit as string | null) ?? null };
    }
    if (plan.dimensions.length > 0) {
      shaped.dimensions = Object.fromEntries(
        plan.dimensions.map((dimension, index) => {
          const value = row[`d${index}`];
          return [dimension, value == null ? null : String(value)];
        }),
      );
    }
    if (plan.interval !== undefined) shaped.bucket = asIsoTimestamp(row.bucket);
    return shaped;
  });
  return { rows, truncated };
}
