/**
 * Post-compile SQL rewrites: project scoping (always) and the labelled what-if variants.
 *
 * Every rewrite asserts how many times its pattern matched and fails closed otherwise, so a
 * compiler change cannot silently produce an unscoped or unmodified benchmark query.
 */
import { TRACE_AGGREGATE_COST_METRIC_NAMES, TRACE_AGGREGATE_USAGE_METRIC_NAMES } from '@mastra/core/storage';

import type { CompiledClickHouseTraceQuery } from '../../src/storage/domains/observability/v-next/trace-query';

export const PROJECT_PARAM = 'bench_project_id';
export const ORG_PARAM = 'bench_org_id';

export type Relation = 'spans' | 'scores' | 'feedback';

const RELATION_CTE: Record<Relation, string> = {
  spans: 'current_spans AS (',
  scores: 'current_scores AS (',
  feedback: 'current_feedback AS (',
};

const USAGE_CTE = 'usage AS (';

const TENANT_FRAGMENT = /AND organizationId = (\{trace_query_\d+:String\})/g;

export class RewriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RewriteError';
  }
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * Adds `AND projectId = {bench_project_id:String}` after every tenant fragment the compiler emitted.
 * Expected fragments: the roots seed, `root_scope`, one per related collection, and one for the
 * token/cost `usage` CTE when present. Every fragment must bind the same organization.
 */
export function injectProjectScope(
  compiled: CompiledClickHouseTraceQuery,
  projectId: string,
  relations: readonly Relation[],
): CompiledClickHouseTraceQuery {
  for (const relation of ['spans', 'scores', 'feedback'] as const) {
    const present = countOccurrences(compiled.query, RELATION_CTE[relation]);
    const declared = relations.includes(relation) ? 1 : 0;
    if (present !== declared) {
      throw new RewriteError(`Relation ${relation}: expected ${declared} CTE(s), found ${present}`);
    }
  }
  const usage = countOccurrences(compiled.query, USAGE_CTE);
  if (usage > 1) throw new RewriteError(`Expected at most one usage CTE, found ${usage}`);
  const expected = 2 + relations.length + usage;
  const tenantParams = new Set<string>();
  let matched = 0;
  const query = compiled.query.replace(TENANT_FRAGMENT, (fragment, param: string) => {
    matched++;
    tenantParams.add(param);
    return `${fragment} AND projectId = {${PROJECT_PARAM}:String}`;
  });
  if (matched !== expected) {
    throw new RewriteError(`Expected ${expected} tenant-scoped scans, found ${matched}`);
  }
  const orgValues = new Set([...tenantParams].map(param => compiled.query_params[param.slice(1, -':String}'.length)]));
  if (orgValues.size !== 1 || orgValues.has(undefined)) {
    throw new RewriteError('Tenant fragments must all bind the same organization');
  }
  if (PROJECT_PARAM in compiled.query_params) throw new RewriteError('Project parameter name collides');
  return { ...compiled, query, query_params: { ...compiled.query_params, [PROJECT_PARAM]: projectId } };
}

/** Adds the org/project scope to the payload lookup used by `queryTraces()` page mode. */
export function scopePayloadQuery(
  compiled: CompiledClickHouseTraceQuery,
  organizationId: string,
  projectId: string,
): CompiledClickHouseTraceQuery {
  return replaceExactlyOnce(
    compiled,
    'WHERE (startedAt, traceId, spanId, endedAt) IN (',
    `WHERE organizationId = {${ORG_PARAM}:String} AND projectId = {${PROJECT_PARAM}:String} AND (startedAt, traceId, spanId, endedAt) IN (`,
    { [ORG_PARAM]: organizationId, [PROJECT_PARAM]: projectId },
  );
}

export type Variant =
  | 'base'
  | 'uniq'
  | 'exact'
  | 'w1'
  | 't2'
  | 'spill'
  | 'mkey'
  | 'nocm'
  | 'nodedupe'
  | 'final'
  | 'rs'
  | 'r1'
  | 'sp'
  | 'shape'
  | 'rio'
  | 'urollup'
  | 'snidx'
  | 'arch';

/** Lab-only tables created by `lab.ts derive` (memory track 3); see `ROLLUP_DDL`. */
export const USAGE_ROLLUP_TABLE = 'mastra_trace_usage';
export const SPAN_NAME_INDEX_TABLE = 'mastra_trace_span_names';
/** Rollup column holding the per-trace sum of each usage metric, by name. */
export const USAGE_ROLLUP_COLUMNS = TRACE_AGGREGATE_USAGE_METRIC_NAMES.map((name, i) => ({ name, column: `u${i}` }));
export const USAGE_COST_NAMES: readonly string[] = TRACE_AGGREGATE_COST_METRIC_NAMES;

/** Variants that only change per-query settings. They may only tighten the tier's limits. */
export const VARIANT_SETTINGS: Partial<Record<Variant, Record<string, string | number>>> = {
  t2: { max_threads: 2 },
  spill: {
    max_bytes_before_external_group_by: String(256 * 2 ** 20),
    max_bytes_before_external_sort: String(256 * 2 ** 20),
  },
};

/**
 * Applies a labelled what-if variant to an already project-scoped query.
 * - `uniq`: `uniqExact` → `uniq`
 * - `exact`: `quantileDeterministic(p)(durationMs, traceSeed)` → `quantileExact(p)(durationMs)`
 * - `w1`: tenant- and project-scope the outer `current_roots` re-read by `traceId`
 * - `t2` / `spill`: SQL unchanged; see `VARIANT_SETTINGS`
 * - `mkey`: dedupe token metric rows on `metricId` alone instead of `(traceId, metricId)`;
 *   `metricId` is unique per row, so `traceId` is constant within each key
 * - `nocm` (diagnostic): skip the per-row `costMetadata` JSON parse (`hasError` = 0)
 * - `nodedupe` (diagnostic): drop the `(traceId, metricId)` retry dedupe and aggregate raw rows
 * - `final`: replace that dedupe with a `FINAL` read, letting ReplacingMergeTree collapse retried rows
 *
 * Query-shape candidates (memory track 2):
 * - `rs`: scope the outer `current_roots` re-read to the tenant and time window, and add `endedAt >= from` to it and
 *   to the seed so `PARTITION BY toDate(endedAt)` prunes (a trace that starts in the window ends after `from`)
 * - `r1`: one `LIMIT 1 BY traceId` over `ORDER BY traceId, dedupeKey` instead of a dedupeKey pass then a traceId pass
 * - `sp`: span relation as a plain semi-join: no `LIMIT 1 BY dedupeKey` (it only feeds `traceId IN`), plus
 *   `endedAt >= from` for partition pruning
 * - `shape`: all of the above, plus `nodedupe` when the query has token/cost usage
 *
 * Schema candidates (memory track 3, lab only; need the tables from `lab.ts derive`):
 * - `urollup`: read token/cost usage from a per-trace rollup (`mastra_trace_usage`) instead of raw metric rows
 * - `snidx`: answer `spans.some(name = ?)` from a `(org, project, name, traceId)` index (`mastra_trace_span_names`)
 *   instead of scanning spans; only when the span predicate uses `name` alone
 * - `rio` (compiler): `r1`, ordered `startedAt, traceId, dedupeKey` so the root dedupe follows the sort key
 *   (rows of one trace are adjacent) instead of sorting every root row by traceId. Picks the lowest dedupeKey among
 *   duplicates that share startedAt, which is every duplicate of a retried root write
 * - `arch`: `shape` + `rio`, plus whichever of `urollup` / `snidx` apply
 */
export function applyVariant(compiled: CompiledClickHouseTraceQuery, variant: Variant): CompiledClickHouseTraceQuery {
  switch (variant) {
    case 'base':
    case 't2':
    case 'spill':
      return compiled;
    case 'nocm':
      return rewriteEach(compiled, variant, [
        [
          /if\(name IN \([^()]*\), ifNull\(JSONHas\(costMetadata, 'error'\) AND JSONType\(costMetadata, 'error'\) != 'Null', 0\), 0\) AS hasError/g,
          'toUInt8(0) AS hasError',
        ],
      ]);
    case 'nodedupe':
    case 'final':
      return rewriteEach(compiled, variant, [
        ...(variant === 'final'
          ? ([[/FROM mastra_metric_events\n/g, 'FROM mastra_metric_events FINAL\n']] as Array<[RegExp, string]>)
          : []),
        [/argMax\((tuple\(name, value, estimatedCost, costUnit, hasError\)), timestamp\) AS latest/g, '$1 AS latest'],
        [/\n\s*GROUP BY traceId, metricId/g, ''],
      ]);
    case 'mkey': {
      let query = compiled.query;
      const rewrites: Array<[RegExp, string]> = [
        [/SELECT traceId,(\s+)latest\.1 AS name/g, 'SELECT mkTraceId AS traceId,$1latest.1 AS name'],
        [/SELECT traceId,(\s+)argMax\(tuple\(/g, 'SELECT any(traceId) AS mkTraceId,$1argMax(tuple('],
        [/GROUP BY traceId, metricId/g, 'GROUP BY metricId'],
      ];
      for (const [pattern, replacement] of rewrites) {
        const count = query.match(pattern)?.length ?? 0;
        if (count !== 1) throw new RewriteError(`Variant mkey: expected 1 match for ${pattern}, found ${count}`);
        query = query.replace(pattern, replacement);
      }
      return { ...compiled, query };
    }
    case 'uniq': {
      const count = countOccurrences(compiled.query, 'uniqExact(');
      if (count === 0) throw new RewriteError('Variant uniq: no uniqExact() to rewrite');
      return { ...compiled, query: compiled.query.split('uniqExact(').join('uniq(') };
    }
    case 'exact': {
      let count = 0;
      const query = compiled.query.replace(
        /quantileDeterministic\(([0-9.]+)\)\(durationMs, traceSeed\)/g,
        (_match, level: string) => {
          count++;
          return `quantileExact(${level})(durationMs)`;
        },
      );
      if (count === 0) throw new RewriteError('Variant exact: no quantileDeterministic() to rewrite');
      if (query.includes('quantileDeterministic')) throw new RewriteError('Variant exact: unrewritten quantile left');
      return { ...compiled, query };
    }
    case 'rs':
      return scopedReread(compiled);
    case 'r1':
      return singleRootDedupe(compiled);
    case 'sp':
      return spanSemiJoin(compiled);
    case 'urollup':
      return usageRollup(compiled);
    case 'snidx':
      return spanNameIndex(compiled);
    case 'rio':
      return readInOrderDedupe(singleRootDedupe(compiled));
    case 'arch': {
      let out = readInOrderDedupe(applyVariant(compiled, 'shape'));
      if (out.query.includes('usage AS (')) out = usageRollup(out);
      if (out.query.includes('FROM current_spans s\n')) out = spanNameIndex(out);
      return out;
    }
    case 'shape': {
      let out = singleRootDedupe(scopedReread(compiled));
      if (out.query.includes('current_spans AS (')) out = spanSemiJoin(out);
      if (out.query.includes('usage AS (')) out = applyVariant(out, 'nodedupe');
      return out;
    }
    case 'w1': {
      const tenantParam = /AND organizationId = (\{trace_query_\d+:String\}) AND projectId/.exec(compiled.query)?.[1];
      if (!tenantParam) throw new RewriteError('Variant w1: query is not project-scoped');
      const pattern = /(SELECT \*\s+FROM mastra_trace_roots\s+WHERE )(traceId IN \()/g;
      let count = 0;
      const query = compiled.query.replace(pattern, (_match, head: string, tail: string) => {
        count++;
        return `${head}organizationId = ${tenantParam} AND projectId = {${PROJECT_PARAM}:String} AND ${tail}`;
      });
      if (count !== 1) throw new RewriteError(`Variant w1: expected 1 outer current_roots read, found ${count}`);
      return { ...compiled, query };
    }
  }
}

function replaceExactlyOnce(
  compiled: CompiledClickHouseTraceQuery,
  needle: string,
  replacement: string,
  params: Record<string, string>,
): CompiledClickHouseTraceQuery {
  const count = countOccurrences(compiled.query, needle);
  if (count !== 1) throw new RewriteError(`Expected one occurrence of the rewrite anchor, found ${count}`);
  return {
    ...compiled,
    query: compiled.query.replace(needle, replacement),
    query_params: { ...compiled.query_params, ...params },
  };
}

function rewriteEach(
  compiled: CompiledClickHouseTraceQuery,
  variant: Variant,
  rewrites: Array<[RegExp, string]>,
): CompiledClickHouseTraceQuery {
  let query = compiled.query;
  for (const [pattern, replacement] of rewrites) {
    const count = query.match(pattern)?.length ?? 0;
    if (count !== 1) throw new RewriteError(`Variant ${variant}: expected 1 match for ${pattern}, found ${count}`);
    query = query.replace(pattern, replacement);
  }
  return { ...compiled, query };
}

function windowParams(query: string): { from: string; to: string } {
  const from = /startedAt >= (\{trace_query_\d+:DateTime64\(3, 'UTC'\)\})/.exec(query)?.[1];
  const to = /startedAt < (\{trace_query_\d+:DateTime64\(3, 'UTC'\)\})/.exec(query)?.[1];
  if (!from || !to) throw new RewriteError('query has no startedAt window');
  return { from, to };
}

function scopedReread(compiled: CompiledClickHouseTraceQuery): CompiledClickHouseTraceQuery {
  const tenantParam = /AND organizationId = (\{trace_query_\d+:String\}) AND projectId/.exec(compiled.query)?.[1];
  if (!tenantParam) throw new RewriteError('Variant rs: query is not project-scoped');
  const { from, to } = windowParams(compiled.query);
  return rewriteEach(compiled, 'rs', [
    [
      /(SELECT \*\s+FROM mastra_trace_roots\s+WHERE )(traceId IN \()/g,
      `$1organizationId = ${tenantParam} AND projectId = {${PROJECT_PARAM}:String}
        AND startedAt >= ${from} AND startedAt < ${to} AND endedAt >= ${from} AND $2`,
    ],
    [
      /(FROM mastra_trace_roots r\s+WHERE startedAt >= \{trace_query_\d+:DateTime64\(3, 'UTC'\)\})/g,
      `$1 AND endedAt >= ${from}`,
    ],
  ]);
}

function singleRootDedupe(compiled: CompiledClickHouseTraceQuery): CompiledClickHouseTraceQuery {
  return rewriteEach(compiled, 'r1', [
    [/\n\s*ORDER BY dedupeKey\n\s*LIMIT 1 BY dedupeKey\n(\s*\)\n\s*ORDER BY traceId, dedupeKey)/g, '\n$1'],
  ]);
}

function spanSemiJoin(compiled: CompiledClickHouseTraceQuery): CompiledClickHouseTraceQuery {
  const { from } = windowParams(compiled.query);
  return rewriteEach(compiled, 'sp', [
    [/(FROM mastra_span_events\n[\s\S]*?)\n\s*ORDER BY dedupeKey\n\s*LIMIT 1 BY dedupeKey\n(\s*\),)/g, '$1\n$2'],
    [/(AND traceId IN \(SELECT traceId FROM root_scope\))/g, `$1\n      AND endedAt >= ${from}`],
  ]);
}

function tenantParam(query: string): string {
  const param = new RegExp(
    `AND organizationId = (\\{trace_query_\\d+:String\\}) AND projectId = \\{${PROJECT_PARAM}:String\\}`,
  ).exec(query)?.[1];
  if (!param) throw new RewriteError('query is not project-scoped');
  return param;
}

function paramValue(compiled: CompiledClickHouseTraceQuery, placeholder: string): unknown {
  const key = /^\{([^:]+):/.exec(placeholder)?.[1];
  return key ? compiled.query_params[key] : undefined;
}

function usageRollup(compiled: CompiledClickHouseTraceQuery): CompiledClickHouseTraceQuery {
  const q = compiled.query;
  const start = q.indexOf('usage AS (');
  const endMarker = '\n    GROUP BY traceId\n  ),';
  const end = q.indexOf(endMarker, start);
  if (start < 0 || end < 0 || q.indexOf('usage AS (', start + 1) >= 0) {
    throw new RewriteError('Variant urollup: expected one usage CTE');
  }
  const block = q.slice(start, end + endMarker.length);
  const sums = [...block.matchAll(/sumIf\(value, name = (\{trace_query_\d+:String\})\) AS (t\d+)/g)].map(
    ([, p, alias]) => {
      const name = paramValue(compiled, p!);
      const col = USAGE_ROLLUP_COLUMNS.find(c => c.name === name);
      if (!col) throw new RewriteError(`Variant urollup: usage metric ${String(name)} is not in the rollup`);
      return `sum(${col.column}) AS ${alias}`;
    },
  );
  if (sums.length === 0) throw new RewriteError('Variant urollup: no usage sums');
  const costParams =
    /name IN \((\{trace_query_\d+:String\}), (\{trace_query_\d+:String\})\) AND isNotNull\(estimatedCost\)/.exec(block);
  const costNames = costParams ? [paramValue(compiled, costParams[1]!), paramValue(compiled, costParams[2]!)] : [];
  if (costNames.length !== USAGE_COST_NAMES.length || costNames.some(n => !USAGE_COST_NAMES.includes(String(n)))) {
    throw new RewriteError('Variant urollup: cost metric names differ from the rollup');
  }
  const ts = /timestamp >= (\{trace_query_\d+:DateTime64\(3, 'UTC'\)\})/.exec(block)?.[1];
  if (!ts) throw new RewriteError('Variant urollup: no usage timestamp bound');
  const replacement = `usage AS (
    SELECT traceId,
      toUInt8(1) AS hasUsage,
      ${sums.join(',\n      ')},
      sum(cost) AS cost,
      toUInt8(sum(pricedRows) > 0) AS priced,
      toUInt8(sum(failedRows) > 0) AS pricingFailure,
      ifNull(min(unitMin), '') AS unitMin,
      ifNull(max(unitMax), '') AS unitMax
    FROM ${USAGE_ROLLUP_TABLE}
    WHERE traceId IN (SELECT traceId FROM candidates)
      AND organizationId = ${tenantParam(block)} AND projectId = {${PROJECT_PARAM}:String}
      AND firstAt >= ${ts}
    GROUP BY traceId
  ),`;
  return { ...compiled, query: q.slice(0, start) + replacement + q.slice(end + endMarker.length) };
}

function spanNameIndex(compiled: CompiledClickHouseTraceQuery): CompiledClickHouseTraceQuery {
  const tenant = tenantParam(compiled.query);
  const { from } = windowParams(compiled.query);
  let count = 0;
  const query = compiled.query.replace(
    /FROM current_spans s\n(\s+)WHERE isNotNull\(s\.traceId\)\n(\s+)AND (\(.*\))\n/g,
    (_m, i1: string, i2: string, predicate: string) => {
      if (/\bs\.(?!name\b)/.test(predicate)) {
        throw new RewriteError('Variant snidx: span predicate uses more than the span name');
      }
      count++;
      return (
        `FROM ${SPAN_NAME_INDEX_TABLE} s\n${i1}WHERE isNotNull(s.traceId)\n` +
        `${i2}AND s.organizationId = ${tenant} AND s.projectId = {${PROJECT_PARAM}:String} AND s.endedAt >= ${from}\n` +
        `${i2}AND ${predicate}\n`
      );
    },
  );
  if (count === 0) throw new RewriteError('Variant snidx: no span relation');
  return { ...compiled, query };
}

function readInOrderDedupe(compiled: CompiledClickHouseTraceQuery): CompiledClickHouseTraceQuery {
  return rewriteEach(compiled, 'rio', [
    [/ORDER BY traceId, dedupeKey(\n\s+LIMIT 1 BY traceId)/g, 'ORDER BY startedAt, traceId, dedupeKey$1'],
  ]);
}
