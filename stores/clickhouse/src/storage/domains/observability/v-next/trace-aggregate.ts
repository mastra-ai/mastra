import type { ClickHouseClient } from '@clickhouse/client';
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

import { TABLE_METRIC_EVENTS } from './ddl';
import type { CompiledClickHouseTraceQuery } from './trace-query';
import {
  compileClickHouseTraceCandidates,
  durationMsSql,
  ParameterBuilder,
  runWithClickHouseTraceQueryTimeout,
  TRACE_STATUS_SQL,
  traceMetadataValueSql,
} from './trace-query';

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

const COMPARISON_SQL = { eq: '=', ne: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=' } as const;

/**
 * Compiles a trusted aggregate plan. The plan's caps are enforced by the planner and trusted here.
 *
 * Every candidate root is first reduced to a `facts` row (dimension values, duration, error flag,
 * countDistinct inputs, bucket). Without `interval`, groups are filtered, ordered, and limited in
 * one grouped select. With `interval`, one `GROUPING SETS` pass computes both the whole-window
 * group rows and the per-bucket rows: group rows are ranked (having → orderBy), and each bucket
 * row inherits its group's rank. ClickHouse re-executes a CTE at every reference, so this keeps
 * the candidate scan to a single pass instead of joining bucket rows back to a ranked CTE.
 */
export function compileClickHouseTraceAggregate(plan: TrustedTraceAggregatePlan): CompiledClickHouseTraceQuery {
  const parameters = new ParameterBuilder();
  const ctes = compileClickHouseTraceCandidates(plan, '*', parameters);

  const dimensionSql = (field: TraceAggregateDimension): string => {
    if (field.startsWith('metadata.')) {
      return traceMetadataValueSql(parameters.add(field.slice('metadata.'.length), 'String'));
    }
    const sql = Object.hasOwn(DIMENSION_SQL, field) ? DIMENSION_SQL[field] : undefined;
    if (sql === undefined) throw new Error(`Unsupported trusted trace-aggregate field: ${field}`);
    return sql;
  };
  const distinctSql = (field: TraceAggregateCountDistinctField): string =>
    field === 'traceId' ? 'r.traceId' : dimensionSql(field);

  const dimensionColumns = plan.dimensions.map((_, index) => `d${index}`);
  const distinctColumns = new Map<string, string>();
  const factColumns = plan.dimensions.map(
    (dimension, index) => `CAST(${dimensionSql(dimension)} AS Nullable(String)) AS d${index}`,
  );
  for (const measure of plan.measures) {
    if (measure.type !== 'countDistinct' || distinctColumns.has(measure.field)) continue;
    const column = `cd${distinctColumns.size}`;
    distinctColumns.set(measure.field, column);
    factColumns.push(`CAST(${distinctSql(measure.field)} AS Nullable(String)) AS ${column}`);
  }
  factColumns.push(
    `toFloat64(${durationMsSql('r.startedAt', 'r.endedAt')}) AS durationMs`,
    `isNotNull(r.error) AS isError`,
    `cityHash64(r.traceId) AS traceSeed`,
  );
  if (plan.interval !== undefined) {
    const intervalMs = coreStorage.TRACE_AGGREGATE_INTERVAL_MS[plan.interval];
    if (intervalMs === undefined) throw new Error(`Unsupported trusted trace-aggregate interval: ${plan.interval}`);
    // UTC-aligned bucket containing startedAt; may begin before timeRange.from.
    factColumns.push(
      `fromUnixTimestamp64Milli(intDiv(toUnixTimestamp64Milli(r.startedAt), ${intervalMs}) * ${intervalMs}, 'UTC') AS bucket`,
    );
  }
  const measureKinds = new Set(plan.measures.map(measure => measureRule(measure.name)?.kind));
  const hasCost = measureKinds.has('cost');
  let usageJoin = '';
  if (hasCost || measureKinds.has('tokens')) {
    ctes.push(compileUsageCte(plan, parameters));
    usageJoin = '\n    LEFT JOIN usage u ON u.traceId = r.traceId';
    // A non-matching LEFT JOIN row holds column defaults (0, ''), not NULL, unless
    // `join_use_nulls` is set, so every usage column is read through the `hasUsage` marker.
    // A usage-bearing trace with no row of a name contributes 0; any other trace contributes NULL.
    USAGE_METRIC_NAMES.forEach((_, index) => factColumns.push(`if(u.hasUsage = 1, u.t${index}, NULL) AS t${index}`));
    factColumns.push(
      `u.hasUsage = 1 AS usageBearing`,
      `if(u.hasUsage = 1 AND u.priced = 1, u.cost, NULL) AS traceCost`,
      `u.hasUsage = 1 AND u.priced = 1 AND u.pricingFailure = 0 AS covered`,
      `if(u.hasUsage = 1 AND u.priced = 1, u.unitMin, NULL) AS unitMin`,
      `if(u.hasUsage = 1 AND u.priced = 1, u.unitMax, NULL) AS unitMax`,
    );
  }
  ctes.push(`facts AS (
    SELECT ${factColumns.join(',\n      ')}
    FROM candidates r${usageJoin}
  )`);

  // More than one distinct priced unit in the group; NULL (treated as false) when nothing is priced.
  const mixedUnitsSql = 'minOrNull(unitMin) != maxOrNull(unitMax)';

  // All measures are Float64 so having literals compare as Float64 parameters.
  const measureSql = (name: TrustedTraceAggregateMeasureName): string => {
    if (name === 'count') return 'toFloat64(count())';
    const rule = measureRule(name);
    // The -OrNull aggregates skip the NULL per-trace values of traces that are not usage-bearing
    // (tokens) or not priced (cost), and return NULL rather than 0 when no trace qualifies.
    if (rule?.kind === 'tokens' && rule.metricNames) {
      const value = rule.metricNames.map(metricName => `t${usageMetricIndex(metricName)}`).join(' + ');
      return `toFloat64(${rule.statistic === 'avg' ? 'avgOrNull' : 'sumOrNull'}(${value}))`;
    }
    if (rule?.kind === 'cost') {
      const aggregate = rule.statistic === 'avg' ? 'avgOrNull' : 'sumOrNull';
      return `if(${mixedUnitsSql}, NULL, toFloat64(${aggregate}(traceCost)))`;
    }
    if (name === 'errorCount') return 'toFloat64(countIf(isError))';
    if (name === 'errorRate') return 'countIf(isError) / count()';
    if (name === 'duration.avg') return 'avg(durationMs)';
    if (name === 'duration.min') return 'min(durationMs)';
    if (name === 'duration.max') return 'max(durationMs)';
    const percentile = PERCENTILES[name];
    // Seeding the reservoir sample by trace makes identical requests return identical
    // percentiles, rankings, and `truncated`; it stays approximate past 8192 traces (Decision 3).
    if (percentile !== undefined) return `quantileDeterministic(${percentile})(durationMs, traceSeed)`;
    const measure = plan.measures.find(
      (candidate): candidate is Extract<TrustedTraceAggregateMeasure, { type: 'countDistinct' }> =>
        candidate.type === 'countDistinct' && candidate.name === name,
    );
    const distinctColumn = measure && distinctColumns.get(measure.field);
    if (distinctColumn === undefined) throw new Error(`Unsupported trusted trace-aggregate measure: ${name}`);
    return `toFloat64(uniqExact(${distinctColumn}))`;
  };

  const compileHaving = (predicate: TrustedTraceAggregateHavingPredicate): string => {
    if (predicate.type === 'boolean') {
      return predicate.args.map(arg => `(${compileHaving(arg)})`).join(predicate.operator === 'and' ? ' AND ' : ' OR ');
    }
    if (predicate.type === 'not') return `NOT (${compileHaving(predicate.arg)})`;
    const measure = measureSql(predicate.measure);
    if (predicate.type === 'membership') {
      if (predicate.values.length === 0) return predicate.operator === 'in' ? '0' : '1';
      const list = predicate.values.map(value => parameters.add(value, 'Float64')).join(', ');
      return `${measure} ${predicate.operator === 'in' ? 'IN' : 'NOT IN'} (${list})`;
    }
    const operator = COMPARISON_SQL[predicate.operator];
    if (operator === undefined) throw new Error(`Unsupported trusted trace-aggregate operator: ${predicate.operator}`);
    return `${measure} ${operator} ${parameters.add(predicate.value, 'Float64')}`;
  };

  // `count() > 0` keeps an ungrouped aggregate over an empty population from yielding a zero row.
  const havingSql = ['count() > 0', ...(plan.having ? [`(${compileHaving(plan.having)})`] : [])].join(' AND ');
  const direction = plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC';
  let orderTarget: string;
  if (plan.orderBy.target === 'measure') {
    orderTarget = measureSql(plan.orderBy.measure);
  } else {
    const index = plan.dimensions.indexOf(plan.orderBy.dimension);
    if (index === -1) throw new Error(`Unsupported trusted trace-aggregate order dimension: ${plan.orderBy.dimension}`);
    orderTarget = dimensionColumns[index]!;
  }
  // ClickHouse compares String bytewise, matching PostgreSQL `COLLATE "C"` and the reference evaluator.
  const tiebreakSql = dimensionColumns.map(column => `${column} ASC NULLS LAST`);
  const measureColumns = plan.measures.map((measure, index) => `${measureSql(measure.name)} AS m${index}`);
  const measureNames = plan.measures.map((_, index) => `m${index}`);
  if (hasCost) {
    const mixedUnit = parameters.add(coreStorage.TRACE_AGGREGATE_MIXED_COST_UNIT, 'String');
    measureColumns.push(
      `countIf(covered) / nullIf(countIf(usageBearing), 0) AS costCoverage`,
      `if(${mixedUnitsSql}, ${mixedUnit}, minOrNull(unitMin)) AS costUnit`,
    );
    measureNames.push('costCoverage', 'costUnit');
  }

  if (plan.interval === undefined) {
    const limit = parameters.add(plan.limit + 1, 'UInt64');
    return {
      query: `WITH ${ctes.join(',\n')}
SELECT ${[...dimensionColumns, ...measureColumns].join(', ')}
FROM facts
${dimensionColumns.length > 0 ? `GROUP BY ${dimensionColumns.join(', ')}\n` : ''}HAVING ${havingSql}
ORDER BY ${[`${orderTarget} ${direction} NULLS LAST`, ...tiebreakSql].join(', ')}
LIMIT ${limit}`,
      query_params: parameters.params,
    };
  }

  const maxRank = parameters.add(plan.limit, 'UInt64');
  const groupOrderSql = [`__order ${direction} NULLS LAST`, ...tiebreakSql].join(', ');
  const groupPartition = dimensionColumns.length > 0 ? `PARTITION BY ${dimensionColumns.join(', ')}` : '';
  ctes.push(
    // `grouping(bucket) = 1` marks the whole-window row of each group; the others are bucket rows.
    `grouped AS (
    SELECT ${[
      ...dimensionColumns,
      'bucket',
      'grouping(bucket) = 1 AS __isGroup',
      ...measureColumns,
      // A NULL (UNKNOWN) having result over a null token or cost measure never keeps a group.
      `ifNull(${havingSql}, 0) AS __keep`,
      `${orderTarget} AS __order`,
    ].join(', ')}
    FROM facts
    GROUP BY GROUPING SETS ((${[...dimensionColumns, 'bucket'].join(', ')}), (${dimensionColumns.join(', ')}))
  )`,
    // Stage 1: rank whole-window group rows that pass `having`.
    `ranked AS (
    SELECT *,
      if(__isGroup AND __keep, row_number() OVER (PARTITION BY __isGroup, __keep ORDER BY ${groupOrderSql}), 0) AS __groupRank,
      countIf(__isGroup AND __keep) OVER () AS __survivingGroups
    FROM grouped
  )`,
    // Stage 2: every bucket row inherits its group's rank.
    `expanded AS (
    SELECT *, maxIf(__groupRank, __isGroup) OVER (${groupPartition}) AS __rank
    FROM ranked
  )`,
  );
  return {
    query: `WITH ${ctes.join(',\n')}
SELECT ${[...dimensionColumns, 'bucket', ...measureNames, `toUInt8(__survivingGroups > ${maxRank}) AS truncated`].join(', ')}
FROM expanded
WHERE NOT __isGroup AND __rank BETWEEN 1 AND ${maxRank}
ORDER BY __rank ASC, bucket ASC`,
    query_params: parameters.params,
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

/**
 * Builds `usage`: one row per candidate trace that has at least one token metric row, holding
 * per-name token sums (`t<i>`, indexed by `TRACE_AGGREGATE_USAGE_METRIC_NAMES`) and the trace's
 * pricing state. Metric rows are matched by traceId, usage metric name, tenant scope, and
 * `timestamp >= from` only: a trace that starts in the window can emit metrics after `to`, and
 * the candidates semi-join already bounds the scan.
 *
 * Rows are deduplicated with `LIMIT 1 BY metricId` at query time. `ReplacingMergeTree` only
 * collapses rows with equal sort keys `(name, timestamp, metricId)`, so retried copies with
 * different timestamps never merge, and copies with equal keys stay separate until a background
 * merge runs.
 */
function compileUsageCte(plan: TrustedTraceAggregatePlan, parameters: ParameterBuilder): string {
  const names = USAGE_METRIC_NAMES.map(name => parameters.add(name, 'String'));
  const costNames = coreStorage.TRACE_AGGREGATE_COST_METRIC_NAMES.map(name => names[usageMetricIndex(name)]);
  const scope = plan.scope
    ? `\n        AND organizationId = ${parameters.add(plan.scope.organizationId, 'String')}${
        plan.scope.resourceId === undefined
          ? ''
          : `\n        AND resourceId = ${parameters.add(plan.scope.resourceId, 'String')}`
      }`
    : '';
  const costRow = `name IN (${costNames.join(', ')})`;
  const priced = `${costRow} AND isNotNull(estimatedCost) AND isNotNull(costUnit) AND NOT hasError`;
  const failed = `${costRow} AND (hasError OR (isNotNull(estimatedCost) AND isNull(costUnit)))`;
  return `usage AS (
    SELECT traceId,
      toUInt8(1) AS hasUsage,
      ${names.map((name, index) => `sumIf(value, name = ${name}) AS t${index}`).join(',\n      ')},
      sumIf(assumeNotNull(estimatedCost), ${priced}) AS cost,
      toUInt8(countIf(${priced}) > 0) AS priced,
      toUInt8(countIf(${failed}) > 0) AS pricingFailure,
      minIf(assumeNotNull(costUnit), ${priced}) AS unitMin,
      maxIf(assumeNotNull(costUnit), ${priced}) AS unitMax
    FROM (
      SELECT traceId, name, value, estimatedCost, costUnit,
        ifNull(JSONHas(costMetadata, 'error') AND JSONType(costMetadata, 'error') != 'Null', 0) AS hasError
      FROM ${TABLE_METRIC_EVENTS}
      WHERE traceId IN (SELECT traceId FROM candidates)
        AND name IN (${names.join(', ')})
        AND timestamp >= ${parameters.add(plan.timeRange.from, "DateTime64(3, 'UTC')")}${scope}
      LIMIT 1 BY metricId
    )
    GROUP BY traceId
  )`;
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export async function aggregateTraces(
  client: ClickHouseClient,
  plan: TrustedTraceAggregatePlan,
  timeoutMs: number,
): Promise<TraceAggregateResponse> {
  const result = await runWithClickHouseTraceQueryTimeout(client, { timeoutMs }, compileClickHouseTraceAggregate(plan));

  let truncated: boolean;
  let resultRows: Record<string, unknown>[];
  if (plan.interval === undefined) {
    truncated = result.length > plan.limit;
    resultRows = result.slice(0, plan.limit);
  } else {
    truncated = Number(result[0]?.truncated ?? 0) === 1;
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
        plan.dimensions.map((dimension, index) => [dimension, (row[`d${index}`] as string | null) ?? null]),
      );
    }
    if (plan.interval !== undefined) shaped.bucket = new Date(row.bucket as string).toISOString();
    return shaped;
  });
  return { rows, truncated };
}
