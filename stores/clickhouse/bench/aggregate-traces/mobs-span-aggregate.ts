/**
 * X46 (OBS-390): can ClickHouse afford the `aggregateSpans()` contract? Prototype SQL only — the
 * store compilers are OBS-392. Selection mirrors mobs-query's `querySpans()` exactly (latest
 * completed copy per span over the window, then the compiled `where`), so `count` is the number of
 * rows `querySpans()` pages through. Groups/measures follow `TrustedSpanAggregatePlan`.
 *
 * Usage is per span, keyed by (org, project, traceId, spanId). `mastra_model_usage` has no `spanId`
 * column, so per-span usage can only come from `mastra_metric_events` (which has `spanId`), bounded
 * to the selected spans by hash and collapsed on `metricId`.
 *
 * Arms per cell, both at max_threads=16:
 *   measure  4 GiB / 30 s ceiling (cold ×1, unmeasured warm-up, warm ×reps), so peaks past the caps show
 *   prod     1 GiB / 9 s, one warm call: does the cell fit the service budget?
 *
 * Output: role, hash, scope, window, shape, metrics. No ids, keys, rows or values are printed.
 *
 *   npx tsx mobs-span-aggregate.ts run --platform <mobs-query dir> [--roles p99,largest] [--scopes project,org]
 *       [--windows 1d,7d,30d,90d,180d] [--shapes S1,...] [--reps 3]
 *   npx tsx mobs-span-aggregate.ts check --platform <mobs-query dir>   # counts vs hand-written SQL
 *   npx tsx mobs-span-aggregate.ts report
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import type { ClickHouseClient, ClickHouseSettings } from '@clickhouse/client';

import { assertReadOnlyStatement } from './client';
import { installOutputRedaction, loadCredentials } from './env';
import { loadSelection } from './profile';
import type { SelectedProject } from './profile';
import { PREFLIGHT_FILE, RESULTS_DIR } from './run';

const OUT = join(RESULTS_DIR, 'mobs-span-aggregate.jsonl');
const ALL_LOG = `clusterAllReplicas('all_groups.default', system.query_log)`;
const DAY = 86_400_000;
const GiB = 1024 ** 3;
const MEASURE: ClickHouseSettings = { max_memory_usage: String(4 * GiB), max_execution_time: 30 };
const PROD: ClickHouseSettings = { max_memory_usage: String(GiB), max_execution_time: 9 };
const MAX_ROWS = 10_000;

type Role = 'p99' | 'largest';
type Scope = 'project' | 'org';

const USAGE_NAMES = [
  'mastra_model_total_input_tokens',
  'mastra_model_total_output_tokens',
  'mastra_model_output_reasoning_tokens',
  'mastra_model_input_cache_read_tokens',
];
const COST_NAMES = USAGE_NAMES.slice(0, 2);

type Variant =
  | 'base'
  | 'pre'
  | 'copies'
  | 'stream'
  | 'branches'
  | 'branchesHash'
  | 'streamHash'
  | 'raw'
  | 'copiesInOrder'
  | 'copiesSpill';

/** Span types `mastra_mv_trace_branches` copies into `mastra_trace_branches`. */
const BRANCH_TYPES = new Set([
  'agent_run',
  'workflow_run',
  'processor_run',
  'scorer_run',
  'rag_ingestion',
  'tool_call',
  'mcp_tool_call',
  'mcp_server_request',
  'provider_tool_call',
]);

interface Shape {
  where?: Record<string, unknown>;
  groupBy: string[];
  measures: string[];
  interval?: '1h' | '1d';
  limit?: number;
  exactQuantiles?: boolean;
}

const spanType = (literal: string) => ({ op: 'eq', left: { path: 'spanType' }, right: { literal } });

export const SHAPES: Record<string, Shape> = {
  S1: { where: spanType('tool_call'), groupBy: ['name'], measures: ['count', 'duration.p95'] },
  S2: { groupBy: ['spanType'], measures: ['count', 'errorRate'] },
  S3: { where: spanType('tool_call'), groupBy: ['entityName'], measures: ['count', 'errorRate'] },
  S4: { groupBy: ['rootEntityName', 'spanType'], measures: ['count', 'duration.p95'] },
  S5: {
    where: spanType('model_generation'),
    groupBy: ['model'],
    measures: ['count', 'tokens.input.sum', 'tokens.output.sum', 'tokens.total.avg', 'cost.sum'],
  },
  // S5 without `model`: isolates the cost of reading `attributes` (where model/provider live).
  S5r: {
    where: spanType('model_generation'),
    groupBy: ['rootEntityName'],
    measures: ['count', 'tokens.input.sum', 'tokens.output.sum', 'tokens.total.avg', 'cost.sum'],
  },
  S6: { groupBy: ['spanType'], measures: ['count', 'countDistinct.traceId'] },
  S7: { groupBy: ['threadId'], measures: ['count', 'duration.p95'] },
  S8: { groupBy: ['name'], measures: ['count', 'errorRate'] },
  S9: { where: spanType('tool_call'), groupBy: ['name'], interval: '1h', measures: ['count'] },
  // Metrics page agent-run card (OBS-697): every agent run, nested ones included, by status.
  A1: { where: spanType('agent_run'), groupBy: ['status'], interval: '1d', measures: ['count'] },
  A2: { where: spanType('agent_run'), groupBy: ['status'], interval: '1h', measures: ['count'] },
};

interface QueryStat {
  durationMs: number;
  memMiB: number;
  readRows: number;
  readMiB: number;
  resultRows: number;
  exc: number;
}

interface CallRecord {
  runId: string;
  role: Role;
  hash: string;
  scope: Scope;
  window: string;
  shape: string;
  variant?: Variant;
  arm: 'measure' | 'prod';
  phase: 'cold' | 'warm';
  rep: number;
  ok: boolean;
  errorCode?: string;
  wallMs: number;
  groups?: number;
  truncated?: boolean;
  queries: QueryStat[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadPlatform(dir: string) {
  const load = (path: string) => import(pathToFileURL(join(dir, path)).href) as Promise<any>;
  const core = createRequire(join(dir, 'package.json'))('@mastra/core/storage');
  return {
    core,
    sql: await load('src/services/trace-query-sql.ts'),
    obs: await load('src/services/observability.ts'),
    createClient: createRequire(join(dir, 'package.json'))('@clickhouse/client').createClient,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
type Mods = Awaited<ReturnType<typeof loadPlatform>>;

class Params {
  values: Record<string, unknown> = {};
  add(value: unknown, type: string) {
    const name = `x46_${Object.keys(this.values).length}`;
    this.values[name] = value;
    return `{${name}:${type}}`;
  }
}

const chTime = (iso: string) => new Date(iso).toISOString().replace('T', ' ').replace(/Z$/, '');

function fieldSql(mods: Mods, field: string): string {
  try {
    return mods.sql.spanQuerySourceFieldSql(field);
  } catch {
    return `e.${field}`;
  }
}

/** Compiles one shape for one tenant and window. Mirrors `querySpans()` selection. */
export function compileSpanAggregate(
  mods: Mods,
  shape: Shape,
  timeRange: { from: string; to: string },
  scope: { organizationId: string; projectId?: string },
  variant: Variant = 'base',
) {
  const p = new Params();
  const from = p.add(chTime(timeRange.from), "DateTime64(3, 'UTC')");
  const to = p.add(chTime(timeRange.to), "DateTime64(3, 'UTC')");
  const tenant = [`e.organizationId = ${p.add(scope.organizationId, 'String')}`];
  if (scope.projectId) tenant.push(`e.projectId = ${p.add(scope.projectId, 'String')}`);

  const plan = mods.core.planSpanQuery({ timeRange, ...(shape.where ? { where: shape.where } : {}) });
  const predicate = plan.where ? mods.sql.compileSpanQueryPredicate(plan.where) : { sql: '1', params: {} };
  const predicateFields = new Set<string>();
  const walk = (node: any) => {
    if (!node) return;
    if (node.type === 'boolean') node.args.forEach(walk);
    else if (node.type === 'not') walk(node.arg);
    else predicateFields.add(node.field);
  };
  walk(plan.where);

  const usage = shape.measures.some(m => m.startsWith('tokens.') || m.startsWith('cost.'));
  const needs = new Set<string>(['startedAt', 'endedAt', ...predicateFields, ...shape.groupBy]);
  if (shape.measures.some(m => m.startsWith('duration.'))) needs.add('durationMs');
  if (shape.measures.some(m => m.startsWith('error'))) needs.add('status');
  const identity = ['organizationId', 'projectId', 'traceId', 'spanId'];
  const columns = [...needs].filter(f => !identity.includes(f)).map(f => `${fieldSql(mods, f)} AS ${f}`);

  const dims = shape.groupBy.map(d => `s.${d}`);
  const measureSql = (m: string): string => {
    if (m === 'count') return 'toFloat64(count())';
    if (m === 'errorRate') return "countIf(s.status = 'error') / count()";
    if (m === 'duration.p95') return `${shape.exactQuantiles ? 'quantileExact' : 'quantile'}(0.95)(s.durationMs)`;
    if (m === 'countDistinct.traceId') return 'toFloat64(uniqExact(s.traceId))';
    if (m === 'tokens.input.sum') return 'sumOrNull(u.t0)';
    if (m === 'tokens.output.sum') return 'sumOrNull(u.t1)';
    if (m === 'tokens.total.avg') return 'avgOrNull(u.t0 + u.t1)';
    if (m === 'cost.sum')
      return 'if(uniqExactIf(u.unit, u.priced = 1) > 1, NULL, sumOrNull(if(u.priced = 1, u.cost, NULL)))';
    throw new Error(`unsupported measure ${m}`);
  };
  const extra = shape.measures.includes('cost.sum')
    ? [
        'if(countIf(u.hasUsage = 1) = 0, NULL, countIf(u.priced = 1 AND u.failed = 0) / countIf(u.hasUsage = 1)) AS costCoverage',
      ]
    : [];
  const measures = [...shape.measures.map((m, i) => `${measureSql(m)} AS m${i}`), ...extra];

  // `pre`: a positive spanType condition is applied before collapsing copies (span type never
  // differs between copies, OBS-664), so the collapse only sorts the spans the query can match.
  // `copies`: `pre`, plus the trace-scope collapse (hash only spans that have copies, keep their
  // latest) instead of sorting every span, and usage bounded by tenant + window instead of a
  // second pass over the selection.
  const prefilterType =
    variant !== 'base' && shape.where?.op === 'eq' && (shape.where.left as { path: string }).path === 'spanType'
      ? (shape.where.right as { literal: string }).literal
      : undefined;
  const prefilter = prefilterType ? ` AND e.spanType = ${p.add(prefilterType, 'String')}` : '';
  const table =
    (variant === 'branches' || variant === 'branchesHash') && prefilterType && BRANCH_TYPES.has(prefilterType)
      ? 'mastra_trace_branches'
      : 'mastra_span_events';
  const scan = `FROM ${table} e
    PREWHERE e.endedAt >= ${from}
    WHERE e.startedAt >= ${from} AND e.startedAt < ${to} AND ${tenant.join(' AND ')}${prefilter}`;
  // `stream` / `branches`: collapse copies with argMax per span, grouped in the table's key order
  // (span_events: org, project, traceId; trace_branches: org, project, spanType, startedAt, traceId)
  // so `optimize_aggregation_in_order` flushes each key prefix and memory stays per trace, not per window.
  const streaming =
    variant === 'stream' || variant === 'branches' || variant === 'branchesHash' || variant === 'streamHash';
  // `*Hash`: the same argMax collapse as a plain hash aggregation (no in-order read).
  const inOrder = variant === 'stream' || variant === 'branches';
  const groupKeys =
    table === 'mastra_trace_branches'
      ? ['organizationId', 'projectId', 'spanType', 'startedAt', 'traceId', 'spanId']
      : ['organizationId', 'projectId', 'traceId', 'spanId'];
  const eHash = 'cityHash64(e.organizationId, e.projectId, e.traceId, e.spanId)';
  const collapsed = columns.map(column => {
    const [expr, alias] = column.split(/ AS (?=\w+$)/);
    if (alias === 'endedAt') return `max(e.endedAt) AS c_endedAt`;
    if (groupKeys.includes(alias!)) return `e.${alias} AS c_${alias}`;
    // Tuple-wrapped so a NULL in the latest copy wins, as with LIMIT 1 BY (argMax skips NULL args).
    return `argMax(tuple(${expr}), e.endedAt).1 AS c_${alias}`;
  });
  const ctes = streaming
    ? [
        `collapsed AS (
    SELECT ${identity.map(f => `e.${f} AS k_${f}`).join(', ')}, ${collapsed.join(', ')}
    ${scan}
    GROUP BY ${groupKeys.map(k => (identity.includes(k) ? `k_${k}` : `c_${k}`)).join(', ')}
  )`,
        `candidates AS (
    SELECT ${identity.map(f => `k_${f} AS ${f}`).join(', ')}, ${columns
      .map(c => c.split(/ AS (?=\w+$)/)[1])
      .map(a => `c_${a} AS ${a}`)
      .join(', ')}
    FROM collapsed
  )`,
      ]
    : variant === 'raw'
      ? // I/O floor only (overcounts copies): what the scan costs with no collapse at all.
        [
          `candidates AS (
    SELECT ${identity.map(f => `e.${f} AS ${f}`).join(', ')}, ${columns.join(', ')}
    ${scan}
  )`,
        ]
      : variant === 'copies' || variant === 'copiesInOrder' || variant === 'copiesSpill'
        ? [
            // `copiesInOrder`: detect copies grouped in span_events key order, so the hash set
            // only ever holds one trace's spans instead of every span in the window.
            variant === 'copiesInOrder'
              ? `copied AS (
    SELECT any(${eHash}) AS span
    ${scan}
    GROUP BY e.organizationId, e.projectId, e.traceId, e.spanId HAVING count() > 1
  )`
              : `copied AS (
    SELECT ${eHash} AS span
    ${scan}
    GROUP BY span HAVING count() > 1
  )`,
            // Spans without copies pass straight through; the few with copies (exporter retries,
            // including byte-identical ones) are collapsed to their latest in order.
            `candidates AS (
    SELECT ${identity.map(f => `e.${f} AS ${f}`).join(', ')}, ${columns.join(', ')}
    ${scan}
      AND ${eHash} NOT IN (SELECT span FROM copied)
    UNION ALL
    SELECT * FROM (
      SELECT ${identity.map(f => `e.${f} AS ${f}`).join(', ')}, ${columns.join(', ')}
      ${scan}
        AND ${eHash} IN (SELECT span FROM copied)
      ORDER BY organizationId, projectId, traceId, spanId, e.endedAt DESC
      LIMIT 1 BY organizationId, projectId, traceId, spanId
    )
  )`,
          ]
        : [
            `candidates AS (
    SELECT ${identity.map(f => `e.${f} AS ${f}`).join(', ')}, ${columns.join(', ')}
    ${scan}
    ORDER BY organizationId, projectId, traceId, spanId, e.endedAt DESC
    LIMIT 1 BY organizationId, projectId, traceId, spanId
  )`,
          ];
  ctes.push(
    `selected AS (
    SELECT *, cityHash64(organizationId, projectId, traceId, spanId) AS spanHash
    FROM candidates s WHERE s.startedAt >= ${from} AND s.startedAt < ${to} AND (${predicate.sql})
  )`,
  );
  if (usage) {
    const names = USAGE_NAMES.map(n => p.add(n, 'String'));
    const costNames = COST_NAMES.map(n => p.add(n, 'String'));
    const hasError = `ifNull(JSONHas(costMetadata, 'error') AND JSONType(costMetadata, 'error') != 'Null', 0)`;
    const costRow = `name IN (${costNames.join(', ')})`;
    const mt = tenant.map(t => t.replace('e.', ''));
    ctes.push(`usage AS (
    SELECT spanHash,
      sumIf(v, n = 1) AS t0, sumIf(v, n = 2) AS t1,
      sumIf(c, pr = 1) AS cost, max(pr) AS priced, max(fl) AS failed,
      anyIf(unit, pr = 1) AS unit, toUInt8(1) AS hasUsage
    FROM (
      SELECT cityHash64(organizationId, projectId, traceId, spanId) AS spanHash, metricId,
        indexOf([${names.join(', ')}], name) AS n,
        max(value) AS v,
        max(if(${costRow} AND isNotNull(estimatedCost) AND isNotNull(costUnit) AND NOT ${hasError}, estimatedCost, 0)) AS c,
        max(toUInt8(${costRow} AND isNotNull(estimatedCost) AND isNotNull(costUnit) AND NOT ${hasError})) AS pr,
        max(toUInt8(${costRow} AND (${hasError} OR (isNotNull(estimatedCost) AND isNull(costUnit))))) AS fl,
        any(costUnit) AS unit
      FROM mastra_metric_events
      WHERE ${mt.join(' AND ')} AND name IN (${names.join(', ')}) AND timestamp >= ${from}
        AND isNotNull(spanId) AND isNotNull(traceId)
        ${variant === 'base' || variant === 'pre' ? 'AND cityHash64(organizationId, projectId, traceId, spanId) IN (SELECT spanHash FROM selected)' : ''}
      GROUP BY spanHash, metricId, n
    )
    GROUP BY spanHash
  )`);
  }
  const join = usage ? ' LEFT JOIN usage u ON u.spanHash = s.spanHash' : '';
  const dimSelect = dims.map((d, i) => `${d} AS d${i}`);
  const orderDims = shape.groupBy.map((_, i) => `d${i} ASC NULLS LAST`);
  const order = ['m0 DESC', ...orderDims].join(', ');

  let query: string;
  if (!shape.interval) {
    const limit = p.add((shape.limit ?? 100) + 1, 'UInt32');
    query = `WITH ${ctes.join(',\n  ')}
  SELECT ${[...dimSelect, ...measures].join(', ')}
  FROM selected s${join}
  ${dims.length ? `GROUP BY ${dims.join(', ')}` : ''}
  ORDER BY ${order}
  LIMIT ${limit}`;
  } else {
    const buckets = Math.ceil(
      (Date.parse(timeRange.to) - Date.parse(timeRange.from)) / (shape.interval === '1d' ? DAY : 3_600_000),
    );
    const limitN = Math.min(shape.limit ?? 100, Math.floor(MAX_ROWS / buckets));
    const limit = p.add(limitN + 1, 'UInt32');
    const key = `toString(tuple(${dims.join(', ')}))`;
    ctes.push(`top AS (
    SELECT ${key} AS k FROM selected s GROUP BY ${dims.join(', ')}
    ORDER BY count() DESC, ${dims.map(d => `${d} ASC NULLS LAST`).join(', ')} LIMIT ${limit}
  )`);
    query = `WITH ${ctes.join(',\n  ')}
  SELECT ${[...dimSelect, `${shape.interval === '1d' ? 'toStartOfDay' : 'toStartOfHour'}(s.startedAt) AS bucket`, ...measures].join(', ')}
  FROM selected s${join}
  WHERE ${key} IN (SELECT k FROM top)
  GROUP BY ${[...dims, 'bucket'].join(', ')}
  ORDER BY ${orderDims.join(', ')}, bucket`;
  }
  return {
    query,
    query_params: { ...p.values, ...predicate.params },
    settings:
      inOrder || variant === 'copiesInOrder'
        ? ({ optimize_aggregation_in_order: 1 } as ClickHouseSettings)
        : variant === 'copiesSpill'
          ? // `copiesSpill`: the copies plan with GROUP BY / ORDER BY spilling to disk past 300 MB.
            ({
              max_bytes_before_external_group_by: 300_000_000,
              max_bytes_before_external_sort: 300_000_000,
            } as ClickHouseSettings)
          : {},
  };
}

export function pickProjects(projects: SelectedProject[]): Array<[Role, SelectedProject]> {
  const of = (bucket: string) => projects.filter(p => p.bucket === bucket);
  const p99 = of('p99').find(p => p.representative) ?? of('p99')[0];
  const largest = of('largest').find(p => p.representative);
  return (
    [
      ['p99', p99],
      ['largest', largest],
    ] as Array<[Role, SelectedProject | undefined]>
  ).filter((e): e is [Role, SelectedProject] => !!e[1]);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function connect(platform: string) {
  const mods = await loadPlatform(platform);
  const database = (JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string }).database;
  const credentials = loadCredentials();
  const raw: ClickHouseClient = mods.createClient({
    url: credentials.origin,
    username: credentials.username,
    password: credentials.password,
    database,
    request_timeout: 120_000,
    max_open_connections: 4,
    log: { level: 127 },
  });
  return { mods, raw };
}

async function exec(
  raw: ClickHouseClient,
  mods: Mods,
  compiled: { query: string; query_params: Record<string, unknown>; settings?: ClickHouseSettings },
  settings: ClickHouseSettings,
  cold: boolean,
  queryId: string,
): Promise<unknown[]> {
  assertReadOnlyStatement(compiled.query);
  const result = await raw.query({
    query: compiled.query,
    query_params: compiled.query_params,
    query_id: queryId,
    format: 'JSONEachRow',
    clickhouse_settings: {
      ...mods.obs.CLICKHOUSE_SETTINGS,
      use_query_cache: 0,
      max_threads: 16,
      ...compiled.settings,
      ...settings,
      log_comment: 'aqa-bench:mobs-span-aggregate',
      ...(cold ? { enable_filesystem_cache: 0 } : {}),
    },
  });
  return result.json();
}

async function fetchStats(raw: ClickHouseClient, ids: string[]): Promise<Map<string, QueryStat>> {
  const found = new Map<string, QueryStat>();
  for (let attempt = 0; attempt < 30 && found.size < ids.length; attempt++) {
    if (attempt > 0) await sleep(2000);
    const result = await raw.query({
      query: `SELECT query_id AS id, query_duration_ms AS durationMs, round(memory_usage / 1048576, 1) AS memMiB,
              read_rows AS readRows, round(read_bytes / 1048576, 2) AS readMiB, result_rows AS resultRows,
              exception_code AS exc
       FROM ${ALL_LOG}
       WHERE event_date >= yesterday() AND type IN ('QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart')
         AND query_id IN {ids:Array(String)}`,
      query_params: { ids: ids.filter(id => !found.has(id)) },
      format: 'JSONEachRow',
      clickhouse_settings: { log_comment: 'aqa-bench:mobs-span-aggregate:meta', max_execution_time: 60 },
    });
    for (const { id, ...stat } of await result.json<QueryStat & { id: string }>()) found.set(id, stat);
  }
  return found;
}

function done(): Set<string> {
  if (!existsSync(OUT)) return new Set();
  return new Set(
    readFileSync(OUT, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as CallRecord)
      .map(r => `${r.hash}|${r.scope}|${r.window}|${r.shape}${r.variant ? `|${r.variant}` : ''}`),
  );
}

function scopes(project: SelectedProject, names: Scope[], role: Role) {
  return names
    .filter(name => name === 'project' || role === 'largest')
    .map(name => ({
      name,
      scope:
        name === 'project'
          ? { organizationId: project.organizationId, projectId: project.projectId }
          : { organizationId: project.organizationId },
    }));
}

async function run(options: {
  platform: string;
  reps: number;
  roles: Set<string>;
  scopes: Scope[];
  windows: string[];
  shapes: string[];
  variant: Variant;
}) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const { mods, raw } = await connect(options.platform);
  const runId = randomUUID().slice(0, 8);
  const skip = done();
  const to = new Date();
  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      for (const { name: scopeName, scope } of scopes(project, options.scopes, role)) {
        for (const shapeId of options.shapes) {
          // Windows run shortest first; once a shape misses the prod budget, longer windows are skipped.
          let overBudget = false;
          for (const window of options.windows) {
            const days = Number.parseInt(window, 10);
            if (SHAPES[shapeId]!.interval === '1h' && days * 24 > 1000) continue; // the planner rejects > 1,000 hourly buckets
            const key = `${project.hash}|${scopeName}|${window}|${shapeId}${options.variant === 'base' ? '' : `|${options.variant}`}`;
            if (skip.has(key)) continue;
            const base = {
              runId,
              role,
              hash: project.hash,
              scope: scopeName,
              window,
              shape: shapeId,
              ...(options.variant === 'base' ? {} : { variant: options.variant }),
            };
            if (overBudget) {
              appendFileSync(
                OUT,
                `${JSON.stringify({ ...base, arm: 'prod', phase: 'warm', rep: 0, ok: false, errorCode: 'skipped', wallMs: 0, queries: [] })}\n`,
              );
              continue;
            }
            const timeRange = { from: new Date(to.getTime() - days * DAY).toISOString(), to: to.toISOString() };
            const compiled = compileSpanAggregate(mods, SHAPES[shapeId]!, timeRange, scope, options.variant);
            const calls: Array<Omit<CallRecord, 'queries' | keyof typeof base> & { id: string }> = [];
            const call = async (arm: 'measure' | 'prod', phase: 'cold' | 'warm', rep: number, record = true) => {
              const id = randomUUID();
              const started = performance.now();
              let ok = true;
              let errorCode: string | undefined;
              let result: unknown[] = [];
              try {
                result = await exec(raw, mods, compiled, arm === 'prod' ? PROD : MEASURE, phase === 'cold', id);
              } catch (error) {
                ok = false;
                const code = (error as { code?: unknown })?.code;
                errorCode = code === undefined ? ((error as Error)?.name ?? 'client') : String(code);
              }
              const wallMs = Math.round(performance.now() - started);
              const limit = SHAPES[shapeId]!.interval ? undefined : (SHAPES[shapeId]!.limit ?? 100);
              if (record)
                calls.push({
                  arm,
                  phase,
                  rep,
                  ok,
                  ...(errorCode ? { errorCode } : {}),
                  wallMs,
                  ...(ok ? { groups: result.length, truncated: limit !== undefined && result.length > limit } : {}),
                  id,
                });
              await sleep(150);
              return ok;
            };
            await call('measure', 'cold', 0);
            await call('measure', 'warm', 0, false);
            for (let rep = 1; rep <= options.reps; rep++) await call('measure', 'warm', rep);
            overBudget = !(await call('prod', 'warm', 1));
            const stats = await fetchStats(
              raw,
              calls.map(c => c.id),
            );
            for (const { id, ...rest } of calls) {
              const stat = stats.get(id);
              appendFileSync(OUT, `${JSON.stringify({ ...base, ...rest, queries: stat ? [stat] : [] })}\n`);
            }
            const warm = calls.filter(c => c.arm === 'measure' && c.phase === 'warm').map(c => stats.get(c.id));
            const prod = calls.find(c => c.arm === 'prod')!;
            console.log(
              [role, project.hash, scopeName, window, shapeId].join(' '),
              'warm',
              warm.map(s => (s ? `${s.durationMs}ms/${s.memMiB}MiB` : '?')).join(' '),
              'cold',
              calls[0]!.ok ? `${stats.get(calls[0]!.id)?.durationMs}ms` : `fail ${calls[0]!.errorCode}`,
              'prod',
              prod.ok ? 'ok' : `FAIL ${prod.errorCode}`,
              prod.ok ? `groups=${prod.groups}${prod.truncated ? '+' : ''}` : '',
            );
          }
        }
      }
    }
  } finally {
    await raw.close();
  }
}

/** Hand-written SQL, independent of the prototype compiler, for the counts the shapes must match. */
async function check(platform: string, window: string) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection');
  const { mods, raw } = await connect(platform);
  const to = new Date();
  const days = Number.parseInt(window, 10);
  const timeRange = { from: new Date(to.getTime() - days * DAY).toISOString(), to: to.toISOString() };
  const q = async (sql: string, params: Record<string, unknown>) =>
    exec(raw, mods, { query: sql, query_params: params }, MEASURE, false, randomUUID()) as Promise<any[]>;
  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      for (const { name, scope } of scopes(project, ['project', 'org'], role)) {
        try {
          const tenant = `organizationId = {org:String}${scope.projectId ? ' AND projectId = {project:String}' : ''}`;
          const params = {
            org: scope.organizationId,
            project: scope.projectId ?? '',
            from: chTime(timeRange.from),
            to: chTime(timeRange.to),
          };
          // Latest completed copy per span, written independently of compileSpanAggregate.
          const current = `SELECT traceId, spanId, argMax(spanType, endedAt) AS type, argMax(error, endedAt) AS err
          FROM mastra_span_events
          WHERE ${tenant} AND endedAt >= {from:DateTime64(3, 'UTC')}
            AND startedAt >= {from:DateTime64(3, 'UTC')} AND startedAt < {to:DateTime64(3, 'UTC')}
          GROUP BY organizationId, projectId, traceId, spanId`;
          const truth = await q(
            `SELECT type, count() AS n, uniqExact(traceId) AS traces, countIf(isNotNull(err)) AS errors FROM (${current}) GROUP BY type`,
            params,
          );
          const byType = new Map(truth.map(r => [r.type, r]));
          const s2 = await exec(
            raw,
            mods,
            compileSpanAggregate(mods, SHAPES.S2!, timeRange, scope),
            MEASURE,
            false,
            randomUUID(),
          );
          const s6 = await exec(
            raw,
            mods,
            compileSpanAggregate(mods, SHAPES.S6!, timeRange, scope),
            MEASURE,
            false,
            randomUUID(),
          );
          let mismatches = 0;
          for (const row of s2 as any[]) {
            const t = byType.get(row.d0);
            if (!t || t.n !== row.m0 || Math.abs(t.errors / t.n - row.m1) > 1e-9) mismatches++;
          }
          for (const row of s6 as any[]) {
            const t = byType.get(row.d0);
            if (!t || t.n !== row.m0 || t.traces !== row.m1) mismatches++;
          }
          const total = truth.reduce((sum, r) => sum + r.n, 0);
          const s2total = (s2 as any[]).reduce((sum, r) => sum + r.m0, 0);
          // Tokens on model_generation spans: distinct metricId, matched to selected spans by (traceId, spanId).
          const [tokens] = await q(
            `SELECT sum(v) AS input FROM (
             SELECT metricId, max(value) AS v FROM mastra_metric_events
             WHERE ${tenant} AND name = 'mastra_model_total_input_tokens' AND timestamp >= {from:DateTime64(3, 'UTC')}
               AND (traceId, spanId) IN (SELECT traceId, spanId FROM (${current}) WHERE type = 'model_generation')
             GROUP BY metricId)`,
            params,
          );
          const s5 = (await exec(
            raw,
            mods,
            compileSpanAggregate(mods, { ...SHAPES.S5!, limit: 1000 }, timeRange, scope),
            MEASURE,
            false,
            randomUUID(),
          )) as any[];
          const s5input = s5.reduce((sum, r) => sum + (r.m1 ?? 0), 0);
          const s5count = s5.reduce((sum, r) => sum + r.m0, 0);
          console.log(
            [role, project.hash, name, window].join(' '),
            `types=${truth.length} totalMatch=${total === s2total} s2/s6 mismatches=${mismatches}`,
            `modelSpans=${s5count === (byType.get('model_generation')?.n ?? 0)}`,
            `inputTokens=${Math.abs((tokens?.input ?? 0) - s5input) < 1e-6 * Math.max(1, s5input)}`,
          );
        } catch (error) {
          console.log(
            [role, project.hash, name, window].join(' '),
            'check failed:',
            (error as Error).message.slice(0, 120),
          );
        }
      }
    }
  } finally {
    await raw.close();
  }
}

/** Runs every shape as `base` and `copies` on one window and compares the rows. */
async function parity(
  platform: string,
  window: string,
  roles: Set<string>,
  scopeNames: Scope[],
  variant: Variant,
  shapeIds: string[],
) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection');
  const { mods, raw } = await connect(platform);
  // Six hours back so late-arriving spans don't land between the two runs.
  const to = new Date(Date.now() - 6 * 3_600_000);
  const days = Number.parseInt(window, 10);
  const timeRange = { from: new Date(to.getTime() - days * DAY).toISOString(), to: to.toISOString() };
  const norm = (rows: unknown[]) =>
    rows
      .map(row =>
        JSON.stringify(
          Object.entries(row as Record<string, unknown>).map(([k, v]) =>
            typeof v === 'number' ? [k, Number(v.toPrecision(9))] : [k, v],
          ),
        ),
      )
      .sort();
  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!roles.has(role)) continue;
      for (const { name, scope } of scopes(project, scopeNames, role)) {
        for (const shapeId of shapeIds) {
          const shape = SHAPES[shapeId]!;
          if (shape.interval === '1h' && days * 24 > 1000) continue;
          // Unlimited so a tie at the limit can't hide a difference.
          // `quantile` samples, so two plans can return slightly different p95s; compare exact ones.
          const full = { ...shape, limit: 10_000, exactQuantiles: true };
          try {
            const base = norm(
              await exec(
                raw,
                mods,
                compileSpanAggregate(mods, full, timeRange, scope, 'base'),
                MEASURE,
                false,
                randomUUID(),
              ),
            );
            const copies = norm(
              await exec(
                raw,
                mods,
                compileSpanAggregate(mods, full, timeRange, scope, variant),
                MEASURE,
                false,
                randomUUID(),
              ),
            );
            const again = norm(
              await exec(
                raw,
                mods,
                compileSpanAggregate(mods, full, timeRange, scope, 'base'),
                MEASURE,
                false,
                randomUUID(),
              ),
            );
            const diff = (x: string[], y: string[]) =>
              x.filter(r => !y.includes(r)).length + y.filter(r => !x.includes(r)).length;
            // `control` is base against itself: approximate quantiles differ between runs.
            console.log(
              [role, project.hash, name, window, shapeId].join(' '),
              `rows=${base.length}/${copies.length} diff=${diff(base, copies)} control=${diff(base, again)}`,
            );
          } catch (error) {
            console.log(
              [role, project.hash, name, window, shapeId].join(' '),
              'failed:',
              (error as Error).message.slice(0, 100),
            );
          }
        }
      }
    }
  } finally {
    await raw.close();
  }
}

function report() {
  const records = readFileSync(OUT, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as CallRecord);
  const cells = new Map<string, CallRecord[]>();
  for (const r of records) {
    const key = [r.role, r.scope, r.window, r.shape + (r.variant ? `/${r.variant}` : '')].join(' ');
    cells.set(key, [...(cells.get(key) ?? []), r]);
  }
  const median = (xs: number[]) => xs.map(Number).sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  console.log(
    '| role | scope | window | shape | warm median ms | warm max MiB | read MiB | cold | prod 1 GiB/9 s | groups |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const [key, rs] of cells) {
    const warm = rs.filter(r => r.arm === 'measure' && r.phase === 'warm' && r.queries[0]);
    const cold = rs.find(r => r.phase === 'cold');
    const prod = rs.find(r => r.arm === 'prod');
    const q = warm.map(r => r.queries[0]!);
    console.log(
      `| ${key.split(' ').join(' | ')} | ${q.length ? median(q.map(s => s.durationMs)) : '–'} | ${
        q.length ? Math.max(...q.map(s => s.memMiB)) : '–'
      } | ${q.length ? median(q.map(s => s.readMiB)) : '–'} | ${
        cold ? (cold.ok ? `${cold.queries[0]?.durationMs ?? '?'} ms` : `fail ${cold.errorCode}`) : '–'
      } | ${prod ? (prod.ok ? `ok ${prod.queries[0]?.durationMs ?? '?'} ms / ${prod.queries[0]?.memMiB ?? '?'} MiB` : prod.errorCode === 'skipped' ? 'skipped' : `FAIL ${prod.errorCode}`) : '–'} | ${
        prod?.groups ?? '–'
      }${prod?.truncated ? '+' : ''} |`,
    );
  }
}

async function main() {
  installOutputRedaction();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      platform: { type: 'string' },
      reps: { type: 'string', default: '3' },
      roles: { type: 'string', default: 'p99,largest' },
      scopes: { type: 'string', default: 'project,org' },
      windows: { type: 'string', default: '1d,7d,30d,90d,180d' },
      shapes: { type: 'string', default: Object.keys(SHAPES).join(',') },
      window: { type: 'string', default: '7d' },
      variant: { type: 'string', default: 'base' },
    },
  });
  const command = positionals[0];
  if (command === 'report') return report();
  if (!values.platform) throw new Error('--platform <mobs-query dir> is required');
  if (command === 'check') return check(values.platform, values.window!);
  if (command === 'parity')
    return parity(
      values.platform,
      values.window!,
      new Set(values.roles!.split(',')),
      values.scopes!.split(',') as Scope[],
      values.variant as Variant,
      values.shapes!.split(','),
    );
  if (command !== 'run') throw new Error('usage: run | check | report');
  await run({
    platform: values.platform,
    reps: Number(values.reps),
    roles: new Set(values.roles!.split(',')),
    scopes: values.scopes!.split(',') as Scope[],
    windows: values.windows!.split(','),
    shapes: values.shapes!.split(','),
    variant: values.variant as Variant,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
