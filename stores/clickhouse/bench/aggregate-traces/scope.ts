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
  | 'arch'
  | 'hourly'
  | 'hk'
  | 'nord'
  | 'arch2'
  | 'arch3'
  | 'sk'
  | 'srio'
  | 'safe'
  | 'hkd'
  | 'mcall'
  | 'mcallf'
  | 'spanu';

/** Lab-only tables created by `lab.ts derive` (memory track 3); see `ROLLUP_DDL`. */
/** One row per model call (trace, span) holding that call's token/cost totals. */
export const MODEL_USAGE_TABLE = 'mastra_model_usage';
/** Span rows (payload columns empty) with the call's token/cost totals as typed columns. */
export const SPAN_USAGE_TABLE = 'mastra_span_events_u';
export const USAGE_ROLLUP_TABLE = 'mastra_trace_usage';
export const SPAN_NAME_INDEX_TABLE = 'mastra_trace_span_names';
/** Rollup column holding the per-trace sum of each usage metric, by name. */
export const USAGE_ROLLUP_COLUMNS = TRACE_AGGREGATE_USAGE_METRIC_NAMES.map((name, i) => ({ name, column: `u${i}` }));
export const USAGE_COST_NAMES: readonly string[] = TRACE_AGGREGATE_COST_METRIC_NAMES;
/** Pre-summed per (tenant, hour, low-cardinality root dimensions); see `ROLLUP_DDL`. */
export const HOURLY_TABLE = 'mastra_usage_hourly';
/** `mastra_trace_roots` plus per-trace usage columns (u0.., cost, priced, ...), as if written at trace end. */
export const ROOTS_USAGE_TABLE = 'mastra_trace_roots_u';
export const HOURLY_DIMENSIONS = ['entityType', 'entityName', 'environment', 'serviceName', 'executionSource'] as const;
const HOUR_MS = 3_600_000;

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
 * - `hk`: key every per-trace set and join by `cityHash64(traceId)` (UInt64) instead of the traceId string
 * - `nord`: no root dedupe (`LIMIT 1 BY traceId`); only correct if root writes are idempotent
 * - `arch2`: `arch` + `hk` + `nord`
 * - `arch3`: `arch2`, reading usage from columns on the root row (`mastra_trace_roots_u`) instead of joining the rollup
 * - `hourly`: answer the whole query from `mastra_usage_hourly` (counts, error counts and token/cost sums per tenant,
 *   hour and root dimension). Only for queries whose filters and groupBy use those dimensions, whose interval is a
 *   whole number of hours, and whose measures are additive (count, errorRate, token/cost sum/avg); anything else
 *   (relations, percentiles, distinct counts, threadId/userId/metadata) throws and stays on the per-trace path
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
    case 'hourly':
      return hourlyRollup(compiled);
    case 'hk':
      return hashedKeys(compiled);
    case 'nord':
      return rewriteEach(compiled, 'nord', [
        [/\n\s*ORDER BY (?:startedAt, )?traceId, dedupeKey\n\s*LIMIT 1 BY traceId/g, ''],
      ]);
    case 'arch2':
      return applyVariant(hashedKeys(applyVariant(compiled, 'arch')), 'nord');
    case 'arch3': {
      const out = applyVariant(compiled, 'arch2');
      return out.query.includes('usage AS (') ? usageOnRoot(out) : out;
    }
    case 'arch': {
      let out = readInOrderDedupe(applyVariant(compiled, 'shape'));
      if (out.query.includes('usage AS (')) out = usageRollup(out);
      if (out.query.includes('FROM current_spans s\n')) out = spanNameIndex(out);
      return out;
    }
    case 'shape': {
      const out = applyVariant(compiled, 'sk');
      return out.query.includes('usage AS (') ? applyVariant(out, 'nodedupe') : out;
    }
    // `shape` minus the token retry dedupe removal: every dedupe kept, no write-path assumptions.
    case 'sk': {
      const out = singleRootDedupe(scopedReread(compiled));
      return out.query.includes('current_spans AS (') ? spanSemiJoin(out) : out;
    }
    // Compiler-only changes that stay exact under duplicate writes: `sk` + `rio` + `hk`.
    case 'srio':
      return readInOrderDedupe(applyVariant(compiled, 'sk'));
    case 'safe':
      return hashedKeys(applyVariant(compiled, 'srio'));
    // Token/cost from one row per model call instead of one row per metric, deduped per call (latest wins).
    case 'mcall':
      return perCallUsage(applyVariant(compiled, 'safe'), MODEL_USAGE_TABLE, 'timestamp', '');
    // Same table read with FINAL: the engine dedupes (trace, span) in sort order instead of a hash table.
    case 'mcallf':
      return perCallUsage(applyVariant(compiled, 'safe'), MODEL_USAGE_TABLE, 'timestamp', '', true);
    case 'spanu':
      return perCallUsage(applyVariant(compiled, 'safe'), SPAN_USAGE_TABLE, 'endedAt', '\n        AND hasUsage = 1');
    // `safe` with the token retry dedupe keyed by integers: same rows kept, smaller hash table.
    case 'hkd':
      return rewriteEach(applyVariant(compiled, 'safe'), 'hkd', [
        [/(usage AS \(\n\s+SELECT )cityHash64\(traceId\) AS traceHash,/g, '$1th AS traceHash,'],
        [/(\n\s+)SELECT traceId,(\n\s+latest\.1 AS name)/g, '$1SELECT th,$2'],
        [/(\n\s+)SELECT traceId,(\n\s+argMax\()/g, '$1SELECT cityHash64(traceId) AS th,$2'],
        [/GROUP BY traceId, metricId/g, 'GROUP BY th, cityHash64(metricId)'],
      ]);
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

const HOURLY_CTES = new Set([
  'current_roots',
  'root_scope',
  'candidates',
  'usage',
  'facts',
  'grouped',
  'ranked',
  'expanded',
]);

function hourlyRollup(compiled: CompiledClickHouseTraceQuery): CompiledClickHouseTraceQuery {
  const q = compiled.query;
  const fail = (why: string): never => {
    throw new RewriteError(`Variant hourly: ${why}`);
  };
  for (const [, name] of q.matchAll(/(?:^WITH |^)(\w+) AS \(/gm)) {
    if (!HOURLY_CTES.has(name!)) fail(`needs per-trace data (${name})`);
  }
  const dims = new Set<string>(HOURLY_DIMENSIONS);
  const onlyDims = (expr: string, what: string) => {
    for (const [, col] of expr.matchAll(/\br\.(\w+)/g)) if (!dims.has(col!)) fail(`${what} uses ${col}`);
  };

  const cand = /candidates AS \(\n\s+SELECT \*\n\s+FROM root_scope r\n\s+WHERE ([\s\S]*?)\n {2}\),/.exec(q);
  if (!cand) fail('unexpected candidates CTE');
  const filter = cand![1]!;
  onlyDims(filter, 'filter');

  // Token aliases (t0..) in facts → hourly columns, via the metric name each usage sum reads.
  const usageCols = new Map<string, string>();
  for (const [, p, alias] of q.matchAll(/sumIf\(value, name = (\{trace_query_\d+:String\})\) AS (t\d+)/g)) {
    const col = USAGE_ROLLUP_COLUMNS.find(c => c.name === paramValue(compiled, p!));
    if (!col) fail('usage metric not in the rollup');
    usageCols.set(alias!, col!.column);
  }
  if (q.includes('usage AS (')) {
    const costParams =
      /name IN \((\{trace_query_\d+:String\}), (\{trace_query_\d+:String\})\) AND isNotNull\(estimatedCost\)/.exec(q);
    const names = costParams ? [paramValue(compiled, costParams[1]!), paramValue(compiled, costParams[2]!)] : [];
    if (names.length !== USAGE_COST_NAMES.length || names.some(n => !USAGE_COST_NAMES.includes(String(n)))) {
      fail('cost metric names differ from the rollup');
    }
  }

  const start = q.indexOf('facts AS (\n');
  const end = q.indexOf('\n  )', start);
  const body =
    /^facts AS \(\n\s+SELECT ([\s\S]*?)\n\s+FROM candidates r(?:\n\s+LEFT JOIN usage u ON u\.traceId = r\.traceId)?$/.exec(
      q.slice(start, end),
    );
  if (start < 0 || !body) fail('unexpected facts CTE');
  const kept: string[] = [];
  for (const item of body![1]!.split(/,\n\s+/)) {
    const alias = / AS (\w+)$/.exec(item)?.[1];
    if (alias && /^d\d+$/.test(alias)) {
      onlyDims(item, 'groupBy');
      kept.push(item);
    } else if (alias === 'bucket') {
      const width = /\) \* (\d+), 'UTC'\) AS bucket$/.exec(item)?.[1];
      if (!width || Number(width) % HOUR_MS !== 0) fail('interval is not whole hours');
      kept.push(item.replace(/\br\.startedAt\b/g, 'r.hour'));
    }
  }

  const { from, to } = windowParams(q);
  for (const p of [from, to]) {
    const v = paramValue(compiled, p);
    if (Date.parse(`${String(v).replace(' ', 'T')}Z`) % HOUR_MS !== 0) fail('time range is not hour-aligned');
  }
  const t = [...usageCols].map(([alias, col]) => `if(r.usageN > 0, r.${col}, NULL) AS ${alias}`);
  const facts = `facts AS (
    SELECT ${[
      ...kept,
      'r.n AS n',
      'r.errN AS errN',
      'r.usageN AS usageN',
      'r.pricedN AS pricedN',
      'r.coveredN AS coveredN',
      ...t,
      'if(r.pricedN > 0, r.cost, NULL) AS traceCost',
      'if(r.pricedN > 0, r.unitMin, NULL) AS unitMin',
      'if(r.pricedN > 0, r.unitMax, NULL) AS unitMax',
    ].join(',\n      ')}
    FROM (
      SELECT hour, ${HOURLY_DIMENSIONS.join(', ')},
        ${['n', 'errN', 'usageN', 'pricedN', 'coveredN', ...USAGE_ROLLUP_COLUMNS.map(c => c.column), 'cost'].map(c => `sum(${c}) AS ${c}`).join(', ')},
        min(unitMin) AS unitMin, max(unitMax) AS unitMax
      FROM ${HOURLY_TABLE}
      WHERE organizationId = ${tenantParam(q)} AND projectId = {${PROJECT_PARAM}:String}
        AND hour >= ${from} AND hour < ${to}
      GROUP BY hour, ${HOURLY_DIMENSIONS.join(', ')}
    ) r
    WHERE ${filter}
  )`;

  let rest = q.slice(end + '\n  )'.length);
  const at = rest.indexOf('FROM facts');
  if (at < 0 || rest.indexOf('FROM facts', at + 1) >= 0) fail('expected one aggregation over facts');
  const segStart = rest.lastIndexOf('SELECT ', at);
  let seg = rest.slice(segStart, at);
  const subs: Array<[RegExp, string]> = [
    [/\bcount\(\)/g, 'sum(n)'],
    [/\bcountIf\(isError\)/g, 'sum(errN)'],
    [/\bcountIf\(covered\)/g, 'sum(coveredN)'],
    [/\bcountIf\(usageBearing\)/g, 'sum(usageN)'],
    [/\bavgOrNull\(traceCost\)/g, '(sumOrNull(traceCost) / nullIf(sum(pricedN), 0))'],
    [/\bavgOrNull\(([t\d +]+)\)/g, '(sumOrNull($1) / nullIf(sum(usageN), 0))'],
  ];
  for (const [re, by] of subs) seg = seg.replace(re, by);
  if (/durationMs|traceSeed|uniq|quantile|countIf\(|avg|\bisError\b|usageBearing|covered\b/.test(seg)) {
    fail('measure is not additive');
  }
  rest = rest.slice(0, segStart) + seg + rest.slice(at);
  return { ...compiled, query: `WITH ${facts}${rest}` };
}

function hashedKeys(compiled: CompiledClickHouseTraceQuery): CompiledClickHouseTraceQuery {
  let query = compiled.query;
  let sets = 0;
  query = query.replace(
    /(\b(?:\w+\.)?traceId) IN \((\s*)SELECT (\w+\.)?traceId\b/g,
    (_m, outer: string, ws: string, inner = '') => {
      sets++;
      return `cityHash64(${outer}) IN (${ws}SELECT cityHash64(${inner}traceId)`;
    },
  );
  if (sets === 0) throw new RewriteError('Variant hk: no traceId sets');
  if (query.includes('usage AS (')) {
    const out = rewriteEach({ ...compiled, query }, 'hk', [
      [/(usage AS \(\n\s+SELECT )traceId,/g, '$1cityHash64(traceId) AS traceHash,'],
      [/(usage AS \([\s\S]*?)GROUP BY traceId\n/g, '$1GROUP BY traceHash\n'],
      [/ON u\.traceId = r\.traceId/g, 'ON u.traceHash = cityHash64(r.traceId)'],
    ]);
    query = out.query;
  }
  return { ...compiled, query };
}

/** Expects the `urollup` form of the usage CTE (`sum(uN) AS tM`). */
function usageOnRoot(compiled: CompiledClickHouseTraceQuery): CompiledClickHouseTraceQuery {
  const q = compiled.query;
  const start = q.indexOf('usage AS (');
  const end = q.indexOf('\n  ),', start);
  if (start < 0 || end < 0) throw new RewriteError('Variant arch3: no usage CTE');
  const block = q.slice(start, end);
  const cols = new Map([...block.matchAll(/sum\((u\d+)\) AS (t\d+)/g)].map(([, col, alias]) => [alias!, col!]));
  if (cols.size === 0) throw new RewriteError('Variant arch3: usage CTE is not the rollup form');
  let query = q.slice(0, start) + q.slice(end + '\n  ),'.length).replace(/^\n/, '');
  const fixed: Array<[RegExp, string | ((m: string, g: string) => string)]> = [
    [/\bFROM mastra_trace_roots\b/g, `FROM ${ROOTS_USAGE_TABLE}`],
    [/\n\s+LEFT JOIN usage u ON [^\n]+/g, ''],
    [/\bu\.(hasUsage|cost|priced|pricingFailure|unitMin|unitMax)\b/g, 'r.$1'],
    [/\bu\.(t\d+)\b/g, (_m, alias) => `r.${cols.get(alias) ?? fail(alias)}`],
  ];
  for (const [re, by] of fixed) {
    if (!re.test(query)) throw new RewriteError(`Variant arch3: no match for ${re}`);
    query = query.replace(re, by as string);
  }
  if (/\busage\b|\bu\./.test(query)) throw new RewriteError('Variant arch3: usage reference left');
  return { ...compiled, query };
  function fail(alias: string): never {
    throw new RewriteError(`Variant arch3: unknown usage alias ${alias}`);
  }
}

/** Replaces the `safe` usage CTE with a read of per-call usage rows (`lab.ts derive`), deduped per (trace, span). */
function perCallUsage(
  compiled: CompiledClickHouseTraceQuery,
  table: string,
  timeColumn: string,
  extraWhere: string,
  final = false,
): CompiledClickHouseTraceQuery {
  const q = compiled.query;
  const start = q.indexOf('usage AS (');
  const endMarker = '\n    GROUP BY traceHash\n  ),';
  const end = q.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new RewriteError(`Per-call usage (${table}): expected the safe usage CTE`);
  const block = q.slice(start, end + endMarker.length);
  const fields = [...USAGE_ROLLUP_COLUMNS.map(c => c.column), 'cost', 'pricedRows', 'failedRows', 'unitMin', 'unitMax'];
  const at = (field: string) => `l.${fields.indexOf(field) + 1}`;
  const sums = [...block.matchAll(/sumIf\(value, name = (\{trace_query_\d+:String\})\) AS (t\d+)/g)].map(
    ([, p, alias]) => {
      const col = USAGE_ROLLUP_COLUMNS.find(c => c.name === paramValue(compiled, p!));
      if (!col)
        throw new RewriteError(`Per-call usage: metric ${String(paramValue(compiled, p!))} not stored per call`);
      return `sum(${at(col.column)}) AS ${alias}`;
    },
  );
  if (sums.length === 0) throw new RewriteError('Per-call usage: no usage sums');
  const costParams =
    /name IN \((\{trace_query_\d+:String\}), (\{trace_query_\d+:String\})\) AND isNotNull\(estimatedCost\)/.exec(block);
  const costNames = costParams ? [paramValue(compiled, costParams[1]!), paramValue(compiled, costParams[2]!)] : [];
  if (costNames.length !== USAGE_COST_NAMES.length || costNames.some(n => !USAGE_COST_NAMES.includes(String(n)))) {
    throw new RewriteError('Per-call usage: cost metric names differ');
  }
  const ts = /timestamp >= (\{trace_query_\d+:DateTime64\(3, 'UTC'\)\})/.exec(block)?.[1];
  if (!ts) throw new RewriteError('Per-call usage: no timestamp bound');
  const replacement = `usage AS (
    SELECT th AS traceHash,
      toUInt8(1) AS hasUsage,
      ${sums.join(',\n      ')},
      sum(${at('cost')}) AS cost,
      toUInt8(sum(${at('pricedRows')}) > 0) AS priced,
      toUInt8(sum(${at('failedRows')}) > 0) AS pricingFailure,
      ifNull(min(${at('unitMin')}), '') AS unitMin,
      ifNull(max(${at('unitMax')}), '') AS unitMax
    FROM (
      SELECT cityHash64(traceId) AS th,
        ${final ? `tuple(${fields.join(', ')})` : `argMax(tuple(${fields.join(', ')}), ${timeColumn})`} AS l
      FROM ${table}${final ? ' FINAL' : ''}
      WHERE cityHash64(traceId) IN (SELECT cityHash64(traceId) FROM candidates)
        AND organizationId = ${tenantParam(block)} AND projectId = {${PROJECT_PARAM}:String}
        AND ${timeColumn} >= ${ts}${extraWhere}${final ? '' : '\n      GROUP BY th, cityHash64(spanId)'}
    )
    GROUP BY th
  ),`;
  return { ...compiled, query: q.slice(0, start) + replacement + q.slice(end + endMarker.length) };
}
