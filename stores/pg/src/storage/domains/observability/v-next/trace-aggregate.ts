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

import type { DbClient } from '../../../client';
import {
  compilePostgresTraceCandidates,
  durationMsSql,
  runWithPostgresTraceQueryTimeout,
  TRACE_STATUS_SQL,
  traceMetadataValueSql,
} from './trace-query';

export interface CompiledPostgresTraceAggregate {
  text: string;
  values: unknown[];
}

/** Trace-root column expressions (alias `r`) for each groupable dimension; same values `where` sees. */
const DIMENSION_SQL: Record<string, string> = {
  entityType: 'r."entityType"',
  entityName: 'r."entityName"',
  environment: 'r."environment"',
  status: TRACE_STATUS_SQL,
  serviceName: 'r."serviceName"',
  executionSource: 'r."executionSource"',
  threadId: 'r."threadId"',
  resourceId: 'r."resourceId"',
  userId: 'r."userId"',
  sessionId: 'r."sessionId"',
  organizationId: 'r."organizationId"',
  experimentId: 'r."experimentId"',
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
 */
export function compilePostgresTraceAggregate(
  schema: string,
  plan: TrustedTraceAggregatePlan,
): CompiledPostgresTraceAggregate {
  const { ctes, values } = compilePostgresTraceCandidates(schema, plan, 'r.*');
  const param = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };
  const dimensionSql = (field: TraceAggregateDimension): string => {
    if (field.startsWith('metadata.')) return traceMetadataValueSql(param(field.slice('metadata.'.length)));
    const sql = Object.hasOwn(DIMENSION_SQL, field) ? DIMENSION_SQL[field] : undefined;
    if (sql === undefined) throw new Error(`Unsupported trusted trace-aggregate field: ${field}`);
    return sql;
  };
  const distinctSql = (field: TraceAggregateCountDistinctField): string =>
    field === 'traceId' ? 'r."traceId"' : dimensionSql(field);

  const dimensionColumns = plan.dimensions.map((_, index) => `"d${index}"`);
  const distinctColumns = new Map<string, string>();
  const factColumns = plan.dimensions.map((dimension, index) => `(${dimensionSql(dimension)})::text AS "d${index}"`);
  for (const measure of plan.measures) {
    if (measure.type !== 'countDistinct' || distinctColumns.has(measure.field)) continue;
    const column = `"cd${distinctColumns.size}"`;
    distinctColumns.set(measure.field, column);
    factColumns.push(`(${distinctSql(measure.field)})::text AS ${column}`);
  }
  factColumns.push(
    `(${durationMsSql('r."startedAt"', 'r."endedAt"')})::float8 AS "durationMs"`,
    `r."error" IS NOT NULL AS "isError"`,
  );
  if (plan.interval !== undefined) {
    const intervalMs = coreStorage.TRACE_AGGREGATE_INTERVAL_MS[plan.interval];
    if (intervalMs === undefined) throw new Error(`Unsupported trusted trace-aggregate interval: ${plan.interval}`);
    // UTC-aligned bucket containing startedAt; may begin before timeRange.from.
    factColumns.push(
      `to_timestamp(floor(EXTRACT(EPOCH FROM r."startedAt") * 1000 / ${intervalMs}) * ${intervalMs} / 1000.0) AS "bucket"`,
    );
  }
  ctes.push(`facts AS (
    SELECT ${factColumns.join(',\n      ')}
    FROM candidates r
  )`);

  // All measures are float8 so having literals compare without integer-cast errors.
  const measureSql = (name: TrustedTraceAggregateMeasureName, alias = ''): string => {
    const column = (name: string) => `${alias}"${name}"`;
    if (name === 'count') return 'COUNT(*)::float8';
    if (name === 'errorCount') return `(COUNT(*) FILTER (WHERE ${column('isError')}))::float8`;
    if (name === 'errorRate') return `(COUNT(*) FILTER (WHERE ${column('isError')}))::float8 / COUNT(*)`;
    if (name === 'duration.avg') return `AVG(${column('durationMs')})`;
    if (name === 'duration.min') return `MIN(${column('durationMs')})`;
    if (name === 'duration.max') return `MAX(${column('durationMs')})`;
    const percentile = PERCENTILES[name];
    if (percentile !== undefined) {
      return `percentile_cont(${percentile}) WITHIN GROUP (ORDER BY ${column('durationMs')})`;
    }
    const measure = plan.measures.find(
      (candidate): candidate is Extract<TrustedTraceAggregateMeasure, { type: 'countDistinct' }> =>
        candidate.type === 'countDistinct' && candidate.name === name,
    );
    const distinctColumn = measure && distinctColumns.get(measure.field);
    if (distinctColumn === undefined) throw new Error(`Unsupported trusted trace-aggregate measure: ${name}`);
    return `(COUNT(DISTINCT ${alias}${distinctColumn}))::float8`;
  };

  const compileHaving = (predicate: TrustedTraceAggregateHavingPredicate): string => {
    if (predicate.type === 'boolean') {
      return predicate.args.map(arg => `(${compileHaving(arg)})`).join(predicate.operator === 'and' ? ' AND ' : ' OR ');
    }
    if (predicate.type === 'not') return `NOT (${compileHaving(predicate.arg)})`;
    const measure = measureSql(predicate.measure);
    if (predicate.type === 'membership') {
      if (predicate.values.length === 0) return predicate.operator === 'in' ? 'FALSE' : 'TRUE';
      const list = predicate.values.map(value => `${param(value)}::float8`).join(', ');
      return `${measure} ${predicate.operator === 'in' ? 'IN' : 'NOT IN'} (${list})`;
    }
    const operator = COMPARISON_SQL[predicate.operator];
    if (operator === undefined) throw new Error(`Unsupported trusted trace-aggregate operator: ${predicate.operator}`);
    return `${measure} ${operator} ${param(predicate.value)}::float8`;
  };

  // `count > 0` keeps an ungrouped aggregate over an empty population from yielding a zero row.
  const havingSql = ['COUNT(*) > 0', ...(plan.having ? [`(${compileHaving(plan.having)})`] : [])].join(' AND ');
  const direction = plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC';
  let orderTarget: string;
  if (plan.orderBy.target === 'measure') {
    orderTarget = measureSql(plan.orderBy.measure);
  } else {
    const index = plan.dimensions.indexOf(plan.orderBy.dimension);
    if (index === -1) throw new Error(`Unsupported trusted trace-aggregate order dimension: ${plan.orderBy.dimension}`);
    orderTarget = `${dimensionColumns[index]} COLLATE "C"`;
  }
  const orderSql = [
    `${orderTarget} ${direction} NULLS LAST`,
    ...dimensionColumns.map(column => `${column} COLLATE "C" ASC NULLS LAST`),
  ].join(', ');
  const groupSql = dimensionColumns.length > 0 ? dimensionColumns.join(', ') : '()';
  const limitParameter = param(plan.limit + 1);

  if (plan.interval === undefined) {
    const projected = [
      ...dimensionColumns,
      ...plan.measures.map((measure, index) => `${measureSql(measure.name)} AS "m${index}"`),
    ];
    return {
      text: `WITH ${ctes.join(',\n')}
SELECT ${projected.join(', ')}
FROM facts
GROUP BY ${groupSql}
HAVING ${havingSql}
ORDER BY ${orderSql}
LIMIT ${limitParameter}`,
      values,
    };
  }

  const maxRankParameter = param(plan.limit);
  ctes.push(`ranked AS (
    SELECT ${[...dimensionColumns, `row_number() OVER (ORDER BY ${orderSql}) AS "rank"`].join(', ')}
    FROM facts
    GROUP BY ${groupSql}
    HAVING ${havingSql}
    ORDER BY ${orderSql}
    LIMIT ${limitParameter}
  )`);
  const joinSql =
    dimensionColumns.length > 0
      ? dimensionColumns.map(column => `f.${column} IS NOT DISTINCT FROM g.${column}`).join(' AND ')
      : 'TRUE';
  const projected = [
    ...dimensionColumns.map(column => `f.${column}`),
    'f."bucket"',
    ...plan.measures.map((measure, index) => `${measureSql(measure.name, 'f.')} AS "m${index}"`),
    `(SELECT COUNT(*) FROM ranked) > ${maxRankParameter} AS "truncated"`,
  ];
  return {
    text: `WITH ${ctes.join(',\n')}
SELECT ${projected.join(', ')}
FROM facts f
JOIN ranked g ON ${joinSql}
WHERE g."rank" <= ${maxRankParameter}
GROUP BY ${['g."rank"', ...dimensionColumns.map(column => `f.${column}`), 'f."bucket"'].join(', ')}
ORDER BY g."rank" ASC, f."bucket" ASC`,
    values,
  };
}

function toIsoTimestamp(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(value as string).toISOString();
}

export async function aggregateTraces(
  client: DbClient,
  schema: string,
  plan: TrustedTraceAggregatePlan,
  timeoutMs: number,
): Promise<TraceAggregateResponse> {
  const compiled = compilePostgresTraceAggregate(schema, plan);
  const result = await runWithPostgresTraceQueryTimeout(client, timeoutMs, transaction =>
    transaction.any<Record<string, unknown>>(compiled.text, compiled.values),
  );

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
        plan.dimensions.map((dimension, index) => [dimension, (row[`d${index}`] as string | null) ?? null]),
      );
    }
    if (plan.interval !== undefined) shaped.bucket = toIsoTimestamp(row.bucket);
    return shaped;
  });
  return { rows, truncated };
}
