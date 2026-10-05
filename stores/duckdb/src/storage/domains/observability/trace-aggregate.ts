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
export function compileDuckDBTraceAggregate(plan: TrustedTraceAggregatePlan): CompiledDuckDBTraceQuery {
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
  ctes.push(`facts AS (
    SELECT ${factColumns.join(',\n      ')}
    FROM candidates r
  )`);

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

export async function aggregateTraces(
  db: DuckDBConnection,
  plan: TrustedTraceAggregatePlan,
): Promise<TraceAggregateResponse> {
  const compiled = compileDuckDBTraceAggregate(plan);
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
        plan.measures.map((measure, index) => [measure.name, Number(row[`m${index}`])]),
      ) as TraceAggregateRow['measures'],
    };
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
