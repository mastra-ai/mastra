/**
 * X48: the Metrics page on `aggregateTraces()`, against the read-only replica. Every statement is
 * compiled by mobs-query's own code (imported from --platform): `planPlatformTraceAggregate()` +
 * `compileClickHouseTraceAggregate()` / `aggregateTraces()` for the new cards, and
 * `metrics-aggregations.ts` (`getMetricAggregate()` and friends) for today's cards.
 *
 *   grid    one card shape at a time. Per cell: cold ×1, warm-up, warm ×reps under a 4 GiB / 30 s
 *           ceiling ("measure"), then the service call once under mobs-query's read limits ("prod").
 *   page    every card of a page at once, as the browser fires them, through the service functions
 *           and a client with mobs-query's connection pool (10). Reports per-card time and peaks and,
 *           per replica, the largest sum of peaks of statements that ran at the same time.
 *   parity  today's `metrics` value vs the `aggregateTraces()` value for the same project, window and
 *           filter, plus hand-written diagnostics that split each difference by cause.
 *   check   shapes O1 and O3 against hand-written SQL (latest root copy per trace).
 *   report  tables from results/mobs-metrics-page*.jsonl.
 *
 * Output: role, salted hash, scope, window, card, metrics. Ids and metadata never leave the process.
 *
 *   npx tsx mobs-metrics-page.ts grid --platform <mobs-query dir> --label x48 [--scopes ...] [--windows 24h,7d,30d]
 *       [--cells O1,P1,...] [--reps 3]
 *   npx tsx mobs-metrics-page.ts page --page org|project --windows 24h,30d --variants agg,both [--reps 3]
 *   npx tsx mobs-metrics-page.ts parity --windows 24h,7d
 *   npx tsx mobs-metrics-page.ts check --windows 7d
 *   npx tsx mobs-metrics-page.ts report
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import type { ClickHouseClient, ClickHouseSettings, QueryParams } from '@clickhouse/client';

import { assertReadOnlyStatement } from './client';
import { installOutputRedaction, loadCredentials } from './env';
import { loadSelection } from './profile';
import type { SelectedProject } from './profile';
import { PREFLIGHT_FILE, RESULTS_DIR } from './run';

const OUT = {
  grid: join(RESULTS_DIR, 'mobs-metrics-page.jsonl'),
  page: join(RESULTS_DIR, 'mobs-metrics-page-load.jsonl'),
  parity: join(RESULTS_DIR, 'mobs-metrics-page-parity.jsonl'),
  check: join(RESULTS_DIR, 'mobs-metrics-page-check.jsonl'),
};
const ALL_LOG = `clusterAllReplicas('all_groups.default', system.query_log)`;
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const GiB = 1024 ** 3;
export const MEASURE: ClickHouseSettings = {
  max_memory_usage: String(4 * GiB),
  max_execution_time: 30,
  filesystem_prefetches_limit: '8',
};
/** mobs-query's interactive read settings (`db/read-settings.ts` with `env.ts` defaults). */
export const PROD: ClickHouseSettings = {
  filesystem_prefetches_limit: '8',
  max_execution_time: 9,
  timeout_overflow_mode: 'throw',
  max_memory_usage: String(GiB),
  max_result_bytes: String(256 * 1024 ** 2),
  result_overflow_mode: 'throw',
  max_bytes_to_read: String(16 * GiB),
  read_overflow_mode: 'throw',
};

export type Role = 'p99' | 'largest';
export type ScopeKind = 'project' | 'org';
export type Interval = '1h' | '1d';
export type Scope = { organizationId: string; projectId?: string };

interface Tag {
  queryIds: string[];
  cold: boolean;
  settings: ClickHouseSettings;
}

export interface QueryStat {
  id: string;
  host: string;
  startUs: number;
  durationMs: number;
  memMiB: number;
  readRows: number;
  readMiB: number;
  resultRows: number;
  exc: number;
}

// ---------------------------------------------------------------------------------------------
// Client

const tags = new AsyncLocalStorage<Tag>();

function guardedClient(raw: ClickHouseClient): ClickHouseClient {
  const query = (params: QueryParams) => {
    assertReadOnlyStatement(params.query);
    const tag = tags.getStore();
    if (!tag) throw new Error('query outside a measured call');
    const queryId = randomUUID();
    tag.queryIds.push(queryId);
    const pending = raw.query({
      ...params,
      query_id: queryId,
      clickhouse_settings: {
        ...params.clickhouse_settings,
        use_query_cache: 0,
        max_threads: 16,
        ...tag.settings,
        log_comment: 'aqa-bench:mobs-metrics-page',
        ...(tag.cold ? { enable_filesystem_cache: 0 } : {}),
      },
    });
    pending.catch(() => {});
    return pending;
  };
  return new Proxy(raw, {
    get(target, prop) {
      if (prop === 'query') return query;
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      throw new Error(`mobs-metrics-page: client method ${String(prop)} is not allowed`);
    },
  }) as ClickHouseClient;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadPlatform(dir: string) {
  const load = (path: string) => import(pathToFileURL(join(dir, path)).href) as Promise<any>;
  return {
    plan: await load('src/services/trace-aggregate-plan.ts'),
    sql: await load('src/services/trace-aggregate-sql.ts'),
    run: await load('src/services/trace-aggregate.ts'),
    metrics: await load('src/services/metrics-aggregations.ts'),
    obs: await load('src/services/observability.ts'),
  };
}
export type Mods = Awaited<ReturnType<typeof loadPlatform>>;

export async function connect(platform: string, maxOpenConnections: number) {
  const database = (JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string }).database;
  const credentials = loadCredentials();
  // mobs-query's own client copy: its compilers pass TupleParam, which a second copy would not recognize.
  const { createClient, ClickHouseLogLevel } = createRequire(join(platform, 'package.json'))(
    '@clickhouse/client',
  ) as typeof import('@clickhouse/client');
  const raw = createClient({
    url: credentials.origin,
    username: credentials.username,
    password: credentials.password,
    database,
    request_timeout: 120_000,
    max_open_connections: maxOpenConnections,
    log: { level: ClickHouseLogLevel.OFF },
  });
  return { raw, client: guardedClient(raw), mods: await loadPlatform(platform) };
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface Measured<T> {
  ok: boolean;
  errorCode?: string;
  wallMs: number;
  queryIds: string[];
  value?: T;
}

export async function measured<T>(
  cold: boolean,
  settings: ClickHouseSettings,
  fn: () => Promise<T>,
): Promise<Measured<T>> {
  const tag: Tag = { queryIds: [], cold, settings };
  const started = performance.now();
  try {
    const value = await tags.run(tag, fn);
    return { ok: true, wallMs: performance.now() - started, queryIds: tag.queryIds, value };
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    return {
      ok: false,
      errorCode: code === undefined ? ((error as Error)?.name ?? 'client') : String(code),
      wallMs: performance.now() - started,
      queryIds: tag.queryIds,
    };
  }
}

export async function rows<T>(
  raw: ClickHouseClient,
  sql: string,
  params: Record<string, unknown>,
  settings = {},
): Promise<T[]> {
  assertReadOnlyStatement(sql);
  const result = await raw.query({
    query: sql,
    query_params: params,
    format: 'JSONEachRow',
    clickhouse_settings: {
      log_comment: 'aqa-bench:mobs-metrics-page:meta',
      max_execution_time: 60,
      max_threads: 16,
      use_query_cache: 0,
      output_format_json_quote_64bit_integers: 0,
      ...settings,
    },
  });
  return result.json<T>();
}

export async function fetchStats(raw: ClickHouseClient, ids: string[]): Promise<Map<string, QueryStat>> {
  const found = new Map<string, QueryStat>();
  for (let attempt = 0; attempt < 30 && found.size < ids.length; attempt++) {
    if (attempt > 0) await sleep(2000);
    const missing = ids.filter(id => !found.has(id));
    const got = await rows<QueryStat>(
      raw,
      `SELECT query_id AS id, hostname() AS host, toUnixTimestamp64Micro(query_start_time_microseconds) AS startUs,
              query_duration_ms AS durationMs, round(memory_usage / 1048576, 1) AS memMiB,
              read_rows AS readRows, round(read_bytes / 1048576, 2) AS readMiB, result_rows AS resultRows,
              exception_code AS exc
       FROM ${ALL_LOG}
       WHERE event_date >= yesterday() AND type IN ('QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart')
         AND query_id IN {ids:Array(String)}`,
      { ids: missing },
    );
    for (const stat of got)
      found.set(stat.id, { ...stat, host: createHash('sha256').update(stat.host).digest('hex').slice(0, 6) });
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// Scopes and windows

export function pickProjects(projects: SelectedProject[]): Array<[Role, SelectedProject]> {
  const of = (bucket: string) => projects.filter(p => p.bucket === bucket);
  const perTrace = (p: SelectedProject) => (p.stats.spans30d ?? 0) / Math.max(1, p.stats.traces30d);
  const p99 = of('p99');
  // Same p99 pick as X41: the representative that is not the heaviest by span rows per trace.
  const heavy = [...p99].sort((a, b) => perTrace(b) - perTrace(a))[0];
  const p99rep = p99.find(p => p.representative && p !== heavy) ?? p99.find(p => p !== heavy);
  const largest = of('largest').find(p => p.representative);
  const out: Array<[Role, SelectedProject | undefined]> = [
    ['p99', p99rep],
    ['largest', largest],
  ];
  return out.filter((e): e is [Role, SelectedProject] => !!e[1]);
}

export function scopeOf(project: SelectedProject, kind: ScopeKind): Scope {
  return kind === 'project'
    ? { organizationId: project.organizationId, projectId: project.projectId }
    : { organizationId: project.organizationId };
}

export const windowMs = (window: string) => {
  const n = Number.parseInt(window, 10);
  return window.endsWith('h') ? n * HOUR : n * DAY;
};

export interface Range {
  from: Date;
  to: Date;
}
export const rangeOf = (to: Date, window: string, periodsBack = 0): Range => {
  const ms = windowMs(window);
  return { from: new Date(to.getTime() - (periodsBack + 1) * ms), to: new Date(to.getTime() - periodsBack * ms) };
};
export const timeRange = (r: Range) => ({ from: r.from.toISOString(), to: r.to.toISOString() });

/** The Metrics page's own bucket choice (`bucketPlan` in playground-ui): hourly to 14 d, then daily. */
export const pageInterval = (window: string): Interval => (windowMs(window) <= 14 * DAY ? '1h' : '1d');

/** `limit × buckets ≤ 10,000` (Core's planner): 20 groups, fewer when the buckets need it. */
export function seriesLimit(r: Range, interval: Interval) {
  const step = interval === '1h' ? HOUR : DAY;
  const buckets = Math.floor(r.to.getTime() / step) - Math.floor(r.from.getTime() / step) + 1;
  return Math.min(20, Math.floor(10_000 / buckets));
}

// ---------------------------------------------------------------------------------------------
// Card shapes (aggregateTraces request bodies)

const agentRoot = { op: 'eq', left: { path: 'entityType' }, right: { literal: 'agent' } };
export const withInterval = new Set(['O1s', 'O2', 'O12s', 'O4', 'P3', 'P4', 'P5']);
const ORG_SHAPES = ['O1', 'O1s', 'O2', 'O3s', 'O3f', 'O4', 'O5', 'O6', 'O7', 'P1', 'P2'];
const PROJECT_SHAPES = ['P1', 'P2', 'P3', 'P4', 'P5'];

export function shapeBody(shape: string, r: Range, interval?: Interval): Record<string, unknown> {
  const tr = { timeRange: timeRange(r) };
  const iv = () => ({ interval: interval!, limit: seriesLimit(r, interval!) });
  const slowest = {
    groupBy: ['projectId', 'entityName'],
    measures: ['count', 'errorRate', 'duration.p95'],
    orderBy: { field: 'duration.p95', direction: 'desc' },
    limit: 20,
  };
  switch (shape) {
    case 'O1': // Projects table
      return {
        ...tr,
        groupBy: ['projectId'],
        measures: ['count', 'errorRate', 'duration.p95', 'tokens.total.sum', 'cost.sum'],
        orderBy: { field: 'count', direction: 'desc' },
        limit: 50,
      };
    case 'O1s': // Projects table sparklines
      return {
        ...tr,
        groupBy: ['projectId'],
        measures: ['count', 'errorRate', 'duration.p95', 'tokens.total.sum', 'cost.sum'],
        ...iv(),
      };
    case 'O2': // Cost and tokens by project over time
      return {
        ...tr,
        groupBy: ['projectId'],
        measures: ['tokens.input.sum', 'tokens.output.sum', 'tokens.cached.sum', 'cost.sum'],
        ...iv(),
      };
    case 'O12s': // O1s and O2 as one request (sparklines and cost/tokens by project over time)
      return {
        ...tr,
        groupBy: ['projectId'],
        measures: [
          'count',
          'errorRate',
          'duration.p95',
          'tokens.total.sum',
          'tokens.input.sum',
          'tokens.output.sum',
          'tokens.cached.sum',
          'cost.sum',
        ],
        ...iv(),
      };
    case 'O3s': // Slowest entities
      return { ...tr, ...slowest };
    case 'O3f': // Most-failing entities
      return { ...tr, ...slowest, orderBy: { field: 'errorRate', direction: 'desc' } };
    case 'O4': // Environment health
      return { ...tr, groupBy: ['environment'], measures: ['errorRate', 'duration.p95'], ...iv() };
    case 'O5': // Active users and threads per project
      return {
        ...tr,
        groupBy: ['projectId'],
        measures: ['countDistinct.userId', 'countDistinct.threadId'],
        limit: 50,
      };
    case 'O6': // Cost coverage per project
      return { ...tr, groupBy: ['projectId'], measures: ['cost.sum'], limit: 50 };
    case 'O7': // Biggest movers: the previous period of O3s (r is already shifted)
      return { ...tr, ...slowest };
    case 'P1': // KPIs: agent runs, active threads
      return { ...tr, where: agentRoot, measures: ['count', 'countDistinct.threadId'] };
    case 'P2': // KPIs: tokens, cost
      return { ...tr, measures: ['tokens.total.sum', 'cost.sum'] };
    case 'P3': // Token usage over time
      return { ...tr, measures: ['tokens.input.sum', 'tokens.output.sum', 'tokens.cached.sum', 'cost.sum'], ...iv() };
    case 'P4': // Agent runs over time by status
      return { ...tr, where: agentRoot, groupBy: ['status'], measures: ['count'], ...iv() };
    case 'P5': // Failure rate over time
      return { ...tr, where: agentRoot, measures: ['count', 'errorRate'], ...iv() };
    default:
      throw new Error(`unknown shape ${shape}`);
  }
}

/** One grid cell per shape and interval: hourly to 7 d, hourly and daily at 30 d. */
function cellsFor(shapes: string[], window: string): Array<{ shape: string; interval?: Interval; id: string }> {
  return shapes.flatMap(shape => {
    if (!withInterval.has(shape)) return [{ shape, id: shape }];
    const intervals: Interval[] = windowMs(window) > 14 * DAY ? ['1h', '1d'] : ['1h'];
    return intervals.map(interval => ({ shape, interval, id: `${shape}:${interval}` }));
  });
}

export function compileShape(mods: Mods, shape: string, scope: Scope, to: Date, window: string, interval?: Interval) {
  const r = rangeOf(to, window, shape === 'O7' ? 1 : 0);
  const plan = mods.plan.planPlatformTraceAggregate(shapeBody(shape, r, interval), scope, []);
  const usage = mods.sql.traceAggregateUsageOptions();
  return { plan, usage, compiled: mods.sql.compileClickHouseTraceAggregate(plan, usage) };
}

// ---------------------------------------------------------------------------------------------
// grid

interface CallRecord {
  runId: string;
  label: string;
  role: Role;
  hash: string;
  scope: ScopeKind;
  window: string;
  request: string;
  arm: 'measure' | 'prod';
  phase: 'cold' | 'warm';
  rep: number;
  ok: boolean;
  errorCode?: string;
  wallMs: number;
  resultRows?: number;
  queries: QueryStat[];
}

const cellKey = (r: Pick<CallRecord, 'label' | 'hash' | 'scope' | 'window' | 'request'>) =>
  `${r.label}|${r.hash}|${r.scope}|${r.window}|${r.request}`;

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as T);
}

async function grid(options: {
  platform: string;
  label: string;
  reps: number;
  scopes: ScopeKind[];
  roles: Set<string>;
  windows: string[];
  cells?: Set<string>;
}) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const { raw, client, mods } = await connect(options.platform, 4);
  const runId = randomUUID().slice(0, 8);
  const done = new Set(readJsonl<CallRecord>(OUT.grid).map(cellKey));
  const to = new Date(Math.floor(Date.now() / 60_000) * 60_000);

  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      for (const scopeName of options.scopes) {
        const scope = scopeOf(project, scopeName);
        for (const window of options.windows) {
          const shapes = (scopeName === 'org' ? ORG_SHAPES : PROJECT_SHAPES).filter(
            s => !options.cells || options.cells.has(s),
          );
          for (const cell of cellsFor(shapes, window)) {
            const base = { label: options.label, hash: project.hash, scope: scopeName, window, request: cell.id };
            if (done.has(cellKey(base))) continue;
            const { plan, usage, compiled } = compileShape(mods, cell.shape, scope, to, window, cell.interval);
            const statement = () =>
              client
                .query({
                  query: compiled.query,
                  query_params: compiled.query_params,
                  format: 'JSONEachRow',
                  clickhouse_settings: {
                    ...mods.obs.CLICKHOUSE_SETTINGS,
                    ...(compiled.sharedSnapshot ? { enable_shared_storage_snapshot_in_query: 1 } : {}),
                  },
                })
                .then(res => res.json());

            const calls: Array<{ arm: 'measure' | 'prod'; phase: 'cold' | 'warm'; rep: number; r: Measured<unknown> }> =
              [];
            calls.push({ arm: 'measure', phase: 'cold', rep: 0, r: await measured(true, MEASURE, statement) });
            await measured(false, MEASURE, statement);
            for (let rep = 1; rep <= options.reps; rep++)
              calls.push({ arm: 'measure', phase: 'warm', rep, r: await measured(false, MEASURE, statement) });
            calls.push({
              arm: 'prod',
              phase: 'warm',
              rep: 1,
              r: await measured(false, PROD, () => mods.run.aggregateTraces(client, plan, usage)),
            });

            const stats = await fetchStats(
              raw,
              calls.flatMap(c => c.r.queryIds),
            );
            for (const { arm, phase, rep, r } of calls) {
              const record: CallRecord = {
                runId,
                role,
                ...base,
                arm,
                phase,
                rep,
                ok: r.ok,
                ...(r.errorCode ? { errorCode: r.errorCode } : {}),
                wallMs: Math.round(r.wallMs),
                queries: r.queryIds.map(id => stats.get(id)).filter((s): s is QueryStat => !!s),
              };
              appendFileSync(OUT.grid, `${JSON.stringify(record)}\n`);
            }
            const warm = calls.filter(c => c.arm === 'measure' && c.phase === 'warm');
            const peak = (c: (typeof calls)[number]) =>
              Math.max(0, ...c.r.queryIds.map(id => stats.get(id)?.memMiB ?? 0));
            const prod = calls.at(-1)!;
            console.log(
              `${options.label} ${role}/${project.hash} ${scopeName} ${window} ${cell.id}: warm ${median(warm.map(peak))} MiB ${median(warm.map(c => Math.round(c.r.wallMs)))} ms, cold ${calls[0]!.r.ok ? 'ok' : calls[0]!.r.errorCode}, svc ${prod.r.ok ? `ok ${peak(prod)} MiB` : `fail ${prod.r.errorCode}`}`,
            );
          }
        }
      }
    }
  } finally {
    await raw.close();
  }
}

// ---------------------------------------------------------------------------------------------
// page

export interface Card {
  card: string;
  source: 'agg' | 'metrics';
  fn: () => Promise<unknown>;
}

/** Today's Metrics page (Platform `MetricsCards`, playground-ui hooks), one entry per HTTP request. */
export function metricsCards(mods: Mods, client: ClickHouseClient, scope: Scope, r: Range, window: string): Card[] {
  const filters = { timestamp: { start: r.from, end: r.to } };
  const interval = pageInterval(window);
  const m = mods.metrics;
  const agg = (card: string, args: Record<string, unknown>): Card => ({
    card,
    source: 'metrics',
    fn: () => m.getMetricAggregate(client, { ...args, filters, comparePeriod: 'previous_period' }, scope),
  });
  const series = (card: string, name: string, aggregation: string, groupBy?: string[]): Card => ({
    card,
    source: 'metrics',
    fn: () =>
      m.getMetricTimeSeries(
        client,
        { name: [name], interval, aggregation, filters, ...(groupBy ? { groupBy } : {}) },
        scope,
      ),
  });
  const breakdown = (card: string, name: string, groupBy: string[], aggregation: string): Card => ({
    card,
    source: 'metrics',
    fn: () =>
      m.getMetricBreakdown(
        client,
        { name: [name], groupBy, aggregation, filters, ...(aggregation === 'sum' ? { orderDirection: 'DESC' } : {}) },
        scope,
      ),
  });
  const durations = {
    agents: 'mastra_agent_duration_ms',
    workflows: 'mastra_workflow_duration_ms',
    tools: 'mastra_tool_duration_ms',
  };
  return [
    agg('m:kpi-runs', { name: ['mastra_agent_duration_ms'], aggregation: 'count' }),
    agg('m:kpi-cost', {
      name: ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'],
      aggregation: 'sum',
    }),
    agg('m:kpi-tokens-in', { name: ['mastra_model_total_input_tokens'], aggregation: 'sum' }),
    agg('m:kpi-tokens-out', { name: ['mastra_model_total_output_tokens'], aggregation: 'sum' }),
    agg('m:kpi-threads', {
      name: ['mastra_agent_duration_ms'],
      aggregation: 'count_distinct',
      distinctColumn: 'threadId',
    }),
    series('m:activity-in', 'mastra_model_total_input_tokens', 'sum'),
    series('m:activity-out', 'mastra_model_total_output_tokens', 'sum'),
    series('m:activity-cache', 'mastra_model_input_cache_read_tokens', 'sum'),
    series('m:activity-runs', 'mastra_agent_duration_ms', 'count', ['status']),
    ...Object.entries(durations).map(([entity, name]) => ({
      card: `m:latency-${entity}`,
      source: 'metrics' as const,
      fn: () => m.getMetricPercentiles(client, { name, percentiles: [0.5, 0.95], interval, filters }, scope),
    })),
    ...Object.entries(durations).map(([entity, name]) =>
      breakdown(`m:volume-${entity}`, name, ['entityName', 'status'], 'count'),
    ),
    breakdown('m:usage-agents-in', 'mastra_model_total_input_tokens', ['entityName'], 'sum'),
    breakdown('m:usage-agents-out', 'mastra_model_total_output_tokens', ['entityName'], 'sum'),
  ];
}

export function aggCards(
  mods: Mods,
  client: ClickHouseClient,
  page: 'org' | 'project',
  scope: Scope,
  to: Date,
  window: string,
) {
  const entries: Array<[string, string, number]> =
    page === 'org'
      ? [
          ['O1', 'O1', 0],
          ['O1s', 'O1s', 0],
          ['O2', 'O2', 0],
          ['O3s', 'O3s', 0],
          ['O3f', 'O3f', 0],
          ['O4', 'O4', 0],
          ['O5', 'O5', 0],
          ['O6', 'O6', 0],
          ['O7', 'O3s', 1],
          ['P1', 'P1', 0],
          ['P1prev', 'P1', 1],
          ['P2', 'P2', 0],
          ['P2prev', 'P2', 1],
        ]
      : [
          ['P1', 'P1', 0],
          ['P1prev', 'P1', 1],
          ['P2', 'P2', 0],
          ['P2prev', 'P2', 1],
          ['P3', 'P3', 0],
          ['P4', 'P4', 0], // the failure-rate card derives from P4's buckets, as it does from today's runs series
        ];
  return entries.map(([card, shape, back]) => aggCard(mods, client, scope, to, window, card, shape, back));
}

export function aggCard(
  mods: Mods,
  client: ClickHouseClient,
  scope: Scope,
  to: Date,
  window: string,
  card: string,
  shape: string,
  back: number,
): Card {
  const r = rangeOf(to, window, back);
  const plan = mods.plan.planPlatformTraceAggregate(
    shapeBody(shape, r, withInterval.has(shape) ? pageInterval(window) : undefined),
    scope,
    [],
  );
  return { card, source: 'agg', fn: () => mods.run.aggregateTraces(client, plan) };
}

export interface PageRecord {
  runId: string;
  label: string;
  page: 'org' | 'project';
  role: Role;
  hash: string;
  window: string;
  variant: string;
  phase: 'cold' | 'warm';
  rep: number;
  wallMs: number;
  cards: Array<{ card: string; source: string; ok: boolean; errorCode?: string; wallMs: number; queries: QueryStat[] }>;
}

async function pageLoad(options: {
  platform: string;
  label: string;
  page: 'org' | 'project';
  roles: Set<string>;
  windows: string[];
  variants: string[];
  reps: number;
}) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  // mobs-query's ClickHouse client keeps the library default of 10 sockets.
  const { raw, client, mods } = await connect(options.platform, 10);
  const runId = randomUUID().slice(0, 8);
  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      const scope = scopeOf(project, options.page);
      for (const window of options.windows) {
        for (const variant of options.variants) {
          for (const phase of ['cold', 'warm'] as const) {
            for (let rep = phase === 'cold' ? 0 : 1; rep <= (phase === 'cold' ? 0 : options.reps); rep++) {
              const to = new Date();
              const r = rangeOf(to, window);
              // verdict: the org-only cards on aggregateTraces(), KPIs kept on metrics (X48 verdicts).
              // merged: verdict with O1s + O2 as one request (O12s) and O6 read from O1.
              const verdict = variant.startsWith('verdict') || variant === 'merged';
              const merged = variant === 'merged';
              const cards = [
                ...(variant === 'metrics'
                  ? []
                  : aggCards(mods, client, options.page, scope, to, window).filter(
                      c => (!verdict || !/^P\d/.test(c.card)) && (!merged || !['O1s', 'O2', 'O6'].includes(c.card)),
                    )),
                ...(merged ? [aggCard(mods, client, scope, to, window, 'O12s', 'O12s', 0)] : []),
                ...(variant === 'agg'
                  ? []
                  : metricsCards(mods, client, scope, r, window).filter(
                      c => (variant !== 'verdict' && !merged) || c.card.startsWith('m:kpi-'),
                    )),
              ];
              const started = performance.now();
              const results = await Promise.all(cards.map(c => measured(phase === 'cold', PROD, c.fn)));
              const wallMs = Math.round(performance.now() - started);
              const stats = await fetchStats(
                raw,
                results.flatMap(x => x.queryIds),
              );
              const record: PageRecord = {
                runId,
                label: options.label,
                page: options.page,
                role,
                hash: project.hash,
                window,
                variant,
                phase,
                rep,
                wallMs,
                cards: cards.map((c, i) => ({
                  card: c.card,
                  source: c.source,
                  ok: results[i]!.ok,
                  ...(results[i]!.errorCode ? { errorCode: results[i]!.errorCode } : {}),
                  wallMs: Math.round(results[i]!.wallMs),
                  queries: results[i]!.queryIds.map(id => stats.get(id)).filter((s): s is QueryStat => !!s),
                })),
              };
              appendFileSync(OUT.page, `${JSON.stringify(record)}\n`);
              const s = summarizePage(record);
              console.log(
                `${options.label} ${options.page} ${role}/${project.hash} ${window} ${variant} ${phase}#${rep}: ${record.cards.length} cards, page ${wallMs} ms, slowest ${s.slowest}, max ${s.maxPeak} MiB, concurrent ${s.concurrent} MiB, sum ${s.sum} MiB, failed ${s.failed.join(',') || '-'}`,
              );
              await sleep(2000);
            }
          }
        }
      }
    }
  } finally {
    await raw.close();
  }
}

export function summarizePage(record: PageRecord) {
  const qs = record.cards.flatMap(c => c.queries);
  // Largest sum of peaks among statements that overlapped on one replica (an upper bound on what
  // the page held at once there: each statement's peak, not its memory at that instant).
  let concurrent = 0;
  const hosts = new Map<string, QueryStat[]>();
  for (const q of qs) hosts.set(q.host, [...(hosts.get(q.host) ?? []), q]);
  for (const list of hosts.values()) {
    const events = list.flatMap(q => [
      { t: Number(q.startUs), d: Number(q.memMiB) },
      { t: Number(q.startUs) + Number(q.durationMs) * 1000, d: -Number(q.memMiB) },
    ]);
    events.sort((a, b) => a.t - b.t || a.d - b.d);
    let now = 0;
    for (const e of events) {
      now += e.d;
      concurrent = Math.max(concurrent, now);
    }
  }
  const slowestCard = [...record.cards].sort((a, b) => b.wallMs - a.wallMs)[0]!;
  return {
    slowest: `${slowestCard.card} ${slowestCard.wallMs} ms`,
    maxPeak: Math.max(0, ...qs.map(q => Number(q.memMiB))),
    concurrent: Math.round(concurrent),
    sum: Math.round(qs.reduce((a, q) => a + Number(q.memMiB), 0)),
    hosts: hosts.size,
    statements: qs.length,
    readMiB: Math.round(qs.reduce((a, q) => a + Number(q.readMiB), 0)),
    failed: record.cards.filter(c => !c.ok).map(c => `${c.card}(${c.errorCode})`),
  };
}

// ---------------------------------------------------------------------------------------------
// parity

/** Hand-written breakdowns of each difference, all on one project and window. */
const DIAG = {
  /** Agent-run metric rows: nested vs root, with or without a root trace in the aggregate's selection. */
  runs: `
    WITH sel AS (
      SELECT traceId, argMax(spanId, (endedAt, dedupeKey)) AS rootSpan, argMax(entityType, (endedAt, dedupeKey)) AS et,
             argMax(isNotNull(error), (endedAt, dedupeKey)) AS err
      FROM mastra_trace_roots
      WHERE organizationId = {org:String} AND projectId = {project:String}
        AND startedAt >= {from:DateTime64(3)} AND startedAt < {to:DateTime64(3)} AND endedAt >= {from:DateTime64(3)}
      GROUP BY traceId
    ),
    near AS (
      SELECT DISTINCT traceId FROM mastra_trace_roots
      WHERE organizationId = {org:String} AND projectId = {project:String}
        AND startedAt >= {from:DateTime64(3)} - INTERVAL 7 DAY AND startedAt < {to:DateTime64(3)}
    ),
    m AS (
      SELECT traceId, spanId, threadId, labels['status'] AS status,
             ifNull(parentEntityType, '') = '' AS topLevel
      FROM mastra_metric_events
      WHERE organizationId = {org:String} AND projectId = {project:String} AND name = 'mastra_agent_duration_ms'
        AND timestamp >= {from:DateTime64(3)} AND timestamp <= {to:DateTime64(3)}
    )
    SELECT count() AS rows,
           countIf(topLevel) AS topLevelRows,
           countIf(m.spanId = s.rootSpan AND s.traceId != '') AS rootSpanRows,
           countIf(s.traceId != '' AND s.et = 'agent' AND m.spanId = s.rootSpan) AS rootAgentRunsInSelection,
           countIf(s.traceId != '' AND m.spanId != s.rootSpan) AS nestedInSelectedTrace,
           countIf(s.traceId = '' AND m.traceId IN (SELECT traceId FROM near)) AS traceStartedBeforeWindow,
           countIf(s.traceId = '' AND m.traceId NOT IN (SELECT traceId FROM near)) AS noRootFound,
           countIf(match(status, '(?i)error|fail')) AS failedRows,
           countIf(status = '') AS noStatusRows,
           uniq(m.threadId) AS threadsUniq,
           uniqExact(m.threadId) AS threadsExact,
           uniqExactIf(m.threadId, s.traceId != '' AND s.et = 'agent' AND m.spanId = s.rootSpan) AS threadsRootAgent
    FROM m LEFT JOIN sel s ON s.traceId = m.traceId
    SETTINGS join_use_nulls = 0`,
  /** Agent roots the aggregate counts, by whether today's metric has a row for them. */
  roots: `
    WITH sel AS (
      SELECT traceId, argMax(spanId, (endedAt, dedupeKey)) AS rootSpan, argMax(isNotNull(error), (endedAt, dedupeKey)) AS err,
             argMax(endedAt, (endedAt, dedupeKey)) AS ended
      FROM mastra_trace_roots
      WHERE organizationId = {org:String} AND projectId = {project:String} AND entityType = 'agent'
        AND startedAt >= {from:DateTime64(3)} AND startedAt < {to:DateTime64(3)} AND endedAt >= {from:DateTime64(3)}
      GROUP BY traceId
    ),
    m AS (
      SELECT DISTINCT traceId, spanId FROM mastra_metric_events
      WHERE organizationId = {org:String} AND projectId = {project:String} AND name = 'mastra_agent_duration_ms'
        AND timestamp >= {from:DateTime64(3)} - INTERVAL 1 DAY
    )
    SELECT count() AS roots, countIf(err) AS errors,
           countIf((traceId, rootSpan) IN (SELECT traceId, spanId FROM m)) AS withMetricRow,
           countIf(ended > {to:DateTime64(3)}) AS endedAfterWindow,
           (SELECT count() FROM (
              SELECT traceId FROM mastra_trace_roots
              WHERE organizationId = {org:String} AND projectId = {project:String} AND entityType = 'agent'
                AND startedAt >= {from:DateTime64(3)} AND startedAt < {to:DateTime64(3)}
              GROUP BY traceId HAVING max(isNull(endedAt)) = 1 AND countIf(isNotNull(endedAt)) = 0)) AS unfinished
    FROM sel`,
  /** Token rows today's KPI sums, by whether the aggregate attributes them to a selected trace. */
  tokens: `
    WITH sel AS (
      SELECT DISTINCT traceId FROM mastra_trace_roots
      WHERE organizationId = {org:String} AND projectId = {project:String}
        AND startedAt >= {from:DateTime64(3)} AND startedAt < {to:DateTime64(3)} AND endedAt >= {from:DateTime64(3)}
    )
    SELECT name,
           count() AS rows,
           sum(value) AS total,
           sumIf(value, isNull(traceId) OR traceId = '') AS noTrace,
           sumIf(value, traceId IN (SELECT traceId FROM sel)) AS inSelectedTrace,
           sumIf(value, isNotNull(traceId) AND traceId != '' AND traceId NOT IN (SELECT traceId FROM sel)) AS otherTrace,
           sumIf(estimatedCost, isNotNull(estimatedCost)) AS cost,
           sumIf(estimatedCost, isNotNull(estimatedCost) AND isNull(costUnit)) AS costNoUnit,
           sumIf(estimatedCost, isNotNull(estimatedCost) AND ifNull(JSONHas(costMetadata, 'error') AND JSONType(costMetadata, 'error') != 'Null', 0)) AS costWithError,
           uniqExactIf(costUnit, isNotNull(costUnit)) AS units,
           countIf(isNotNull(usageId) AND trimBoth(usageId) != '') AS usageIdRows
    FROM mastra_metric_events
    WHERE organizationId = {org:String} AND projectId = {project:String}
      AND name IN ('mastra_model_total_input_tokens', 'mastra_model_total_output_tokens', 'mastra_model_input_cache_read_tokens')
      AND timestamp >= {from:DateTime64(3)} AND timestamp <= {to:DateTime64(3)}
    GROUP BY name`,
  /** Token rows the aggregate adds: selected traces' rows stamped after the window ends. */
  late: `
    WITH sel AS (
      SELECT DISTINCT traceId FROM mastra_trace_roots
      WHERE organizationId = {org:String} AND projectId = {project:String}
        AND startedAt >= {from:DateTime64(3)} AND startedAt < {to:DateTime64(3)} AND endedAt >= {from:DateTime64(3)}
    )
    SELECT name, count() AS rows, sum(value) AS total
    FROM mastra_metric_events
    WHERE organizationId = {org:String} AND projectId = {project:String}
      AND name IN ('mastra_model_total_input_tokens', 'mastra_model_total_output_tokens', 'mastra_model_input_cache_read_tokens')
      AND timestamp > {to:DateTime64(3)} AND traceId IN (SELECT traceId FROM sel)
    GROUP BY name`,
};

async function parity(options: { platform: string; label: string; roles: Set<string>; windows: string[] }) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const { raw, client, mods } = await connect(options.platform, 4);
  const m = mods.metrics;
  // Both sides see the same closed window: it ends at the last full hour.
  const to = new Date(Math.floor(Date.now() / HOUR) * HOUR);
  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      const scope = scopeOf(project, 'project');
      for (const window of options.windows) {
        const r = rangeOf(to, window);
        const interval = pageInterval(window);
        const filters = { timestamp: { start: r.from, end: r.to } };
        const call = <T>(fn: () => Promise<T>) =>
          measured(false, MEASURE, fn).then(x => {
            if (!x.ok) throw new Error(`call failed ${x.errorCode}`);
            return x.value as T;
          });
        const metricAgg = (args: Record<string, unknown>) =>
          call<MetricAggregate>(() => m.getMetricAggregate(client, { ...args, filters }, scope));
        const metricSeries = (args: Record<string, unknown>) =>
          call<Series>(() => m.getMetricTimeSeries(client, { ...args, interval, filters }, scope));
        const agg = (body: Record<string, unknown>) =>
          call(() =>
            mods.run.aggregateTraces(
              client,
              mods.plan.planPlatformTraceAggregate({ timeRange: timeRange(r), ...body }, scope, []),
            ),
          ) as Promise<{
            rows: Array<{
              measures: Record<string, number | null>;
              dimensions?: Record<string, string | null>;
              bucket?: string;
              cost?: { coverage: number | null; unit: string | null };
            }>;
          }>;

        const metrics = {
          runs: await metricAgg({ name: ['mastra_agent_duration_ms'], aggregation: 'count' }),
          tokensIn: await metricAgg({ name: ['mastra_model_total_input_tokens'], aggregation: 'sum' }),
          tokensOut: await metricAgg({ name: ['mastra_model_total_output_tokens'], aggregation: 'sum' }),
          cost: await metricAgg({
            name: ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'],
            aggregation: 'sum',
          }),
          threads: await metricAgg({
            name: ['mastra_agent_duration_ms'],
            aggregation: 'count_distinct',
            distinctColumn: 'threadId',
          }),
          seriesIn: await metricSeries({ name: ['mastra_model_total_input_tokens'], aggregation: 'sum' }),
          seriesOut: await metricSeries({ name: ['mastra_model_total_output_tokens'], aggregation: 'sum' }),
          seriesCache: await metricSeries({ name: ['mastra_model_input_cache_read_tokens'], aggregation: 'sum' }),
          seriesRuns: await metricSeries({
            name: ['mastra_agent_duration_ms'],
            aggregation: 'count',
            groupBy: ['status'],
          }),
        };
        const limit = seriesLimit(r, interval);
        const aggregate = {
          kpiRuns: await agg({ where: agentRoot, measures: ['count', 'countDistinct.threadId', 'errorRate'] }),
          kpiTokens: await agg({
            measures: ['tokens.total.sum', 'tokens.input.sum', 'tokens.output.sum', 'tokens.cached.sum', 'cost.sum'],
          }),
          kpiTokensAgent: await agg({ where: agentRoot, measures: ['tokens.total.sum', 'cost.sum'] }),
          kpiThreadsAll: await agg({ measures: ['count', 'countDistinct.threadId'] }),
          series: await agg({
            measures: ['tokens.input.sum', 'tokens.output.sum', 'tokens.cached.sum', 'cost.sum'],
            interval,
            limit,
          }),
          runs: await agg({ where: agentRoot, groupBy: ['status'], measures: ['count'], interval, limit }),
          failure: await agg({ where: agentRoot, measures: ['count', 'errorRate'], interval, limit }),
        };

        const params = { org: project.organizationId, project: project.projectId, from: r.from, to: r.to };
        const fmt = (d: Date) => d.toISOString().replace('T', ' ').replace('Z', '');
        const p = { ...params, from: fmt(r.from), to: fmt(r.to) };
        const diag = {
          runs: (await rows<Record<string, number>>(raw, DIAG.runs, p))[0],
          roots: (await rows<Record<string, number>>(raw, DIAG.roots, p))[0],
          tokens: await rows<Record<string, number | string>>(raw, DIAG.tokens, p),
          late: await rows<Record<string, number | string>>(raw, DIAG.late, p),
        };

        const record = {
          label: options.label,
          role,
          hash: project.hash,
          window,
          interval,
          to: to.toISOString(),
          metrics: {
            runs: metrics.runs.value,
            tokensIn: metrics.tokensIn.value,
            tokensOut: metrics.tokensOut.value,
            cost: metrics.cost.estimatedCost,
            costUnit: metrics.cost.costUnit,
            threads: metrics.threads.value,
            series: {
              in: points(metrics.seriesIn),
              out: points(metrics.seriesOut),
              cache: points(metrics.seriesCache),
              cost: costPoints([metrics.seriesIn, metrics.seriesOut]),
              runs: Object.fromEntries(
                (
                  metrics.seriesRuns.series as Array<{
                    name: string;
                    points: Array<{ timestamp: Date; value: number }>;
                  }>
                ).map(s => [s.name, points({ series: [s] })]),
              ),
            },
          },
          aggregate: {
            kpiRuns: aggregate.kpiRuns.rows[0]?.measures ?? null,
            kpiTokens: aggregate.kpiTokens.rows[0] ?? null,
            kpiTokensAgent: aggregate.kpiTokensAgent.rows[0] ?? null,
            kpiThreadsAll: aggregate.kpiThreadsAll.rows[0]?.measures ?? null,
            series: aggregate.series.rows.map(x => ({ bucket: x.bucket, ...x.measures })),
            runs: aggregate.runs.rows.map(x => ({
              bucket: x.bucket,
              status: x.dimensions?.status ?? null,
              count: x.measures.count,
            })),
            failure: aggregate.failure.rows.map(x => ({ bucket: x.bucket, ...x.measures })),
          },
          diag,
        };
        appendFileSync(OUT.parity, `${JSON.stringify(record)}\n`);
        console.log(`parity ${role}/${project.hash} ${window}: recorded`);
      }
    }
  } finally {
    await raw.close();
  }
}

type MetricAggregate = { value: number; estimatedCost: number | null; costUnit: string | null };
type Series = {
  series: Array<{
    name: string;
    points: Array<{ timestamp: Date | string; value: number; estimatedCost?: number | null }>;
  }>;
};
const points = (s: Series) => {
  const out: Record<string, number> = {};
  for (const x of s.series)
    for (const pt of x.points) {
      const k = new Date(pt.timestamp).toISOString();
      out[k] = (out[k] ?? 0) + Number(pt.value);
    }
  return out;
};
const costPoints = (list: Series[]) => {
  const out: Record<string, number> = {};
  for (const s of list)
    for (const x of s.series)
      for (const pt of x.points) {
        const k = new Date(pt.timestamp).toISOString();
        out[k] = (out[k] ?? 0) + Number(pt.estimatedCost ?? 0);
      }
  return out;
};

// ---------------------------------------------------------------------------------------------
// check

const CHECK_SQL = `
  SELECT projectId, en, count() AS n, countIf(err) AS errors
  FROM (
    SELECT projectId, traceId, argMax(entityName, (endedAt, dedupeKey)) AS en, argMax(isNotNull(error), (endedAt, dedupeKey)) AS err
    FROM mastra_trace_roots
    WHERE organizationId = {org:String} AND isNotNull(projectId)
      AND startedAt >= {from:DateTime64(3)} AND startedAt < {to:DateTime64(3)} AND endedAt >= {from:DateTime64(3)}
    GROUP BY projectId, traceId
  )
  GROUP BY projectId, en`;

async function check(options: { platform: string; label: string; roles: Set<string>; windows: string[] }) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const { raw, client, mods } = await connect(options.platform, 4);
  const to = new Date(Math.floor(Date.now() / HOUR) * HOUR);
  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      const scope = scopeOf(project, 'org');
      for (const window of options.windows) {
        const r = rangeOf(to, window);
        const fmt = (d: Date) => d.toISOString().replace('T', ' ').replace('Z', '');
        const truth = await rows<{ projectId: string; en: string | null; n: number; errors: number }>(
          raw,
          CHECK_SQL,
          { org: project.organizationId, from: fmt(r.from), to: fmt(r.to) },
          { max_memory_usage: String(4 * GiB) },
        );
        const byProject = new Map<string, { n: number; errors: number }>();
        const byEntity = new Map<string, { n: number; errors: number }>();
        for (const t of truth) {
          const p = byProject.get(t.projectId) ?? { n: 0, errors: 0 };
          p.n += Number(t.n);
          p.errors += Number(t.errors);
          byProject.set(t.projectId, p);
          byEntity.set(`${t.projectId}|${t.en ?? ''}`, { n: Number(t.n), errors: Number(t.errors) });
        }
        const run = async (shape: string) => {
          const plan = mods.plan.planPlatformTraceAggregate(shapeBody(shape, r), scope, []);
          const x = await measured(false, MEASURE, () => mods.run.aggregateTraces(client, plan));
          if (!x.ok) throw new Error(`${shape} failed ${x.errorCode}`);
          return (
            x.value as { rows: Array<{ dimensions: Record<string, string | null>; measures: Record<string, number> }> }
          ).rows;
        };
        const compare = (
          shape: string,
          got: Array<{ dimensions: Record<string, string | null>; measures: Record<string, number> }>,
          key: (d: Record<string, string | null>) => string,
          want: Map<string, { n: number; errors: number }>,
        ) => {
          let countMismatch = 0;
          let errorMismatch = 0;
          for (const g of got) {
            const w = want.get(key(g.dimensions));
            const count = g.measures.count ?? 0;
            if (!w || w.n !== count) countMismatch++;
            if (!w || Math.round((g.measures.errorRate ?? 0) * count) !== w.errors) errorMismatch++;
          }
          const record = {
            label: options.label,
            role,
            hash: project.hash,
            window,
            shape,
            groups: got.length,
            countMismatch,
            errorMismatch,
          };
          appendFileSync(OUT.check, `${JSON.stringify(record)}\n`);
          console.log(
            `check ${role}/${project.hash} org ${window} ${shape}: ${got.length} groups, count mismatches ${countMismatch}, error mismatches ${errorMismatch}`,
          );
        };
        const o1 = await run('O1');
        compare('O1', o1, d => d.projectId ?? '', byProject);
        // O1 lists the top 50 projects by count: every project with roots must be either listed or smaller.
        const listed = new Set(o1.map(g => g.dimensions.projectId));
        const smallest = Math.min(...o1.map(g => g.measures.count ?? 0));
        const missed = [...byProject].filter(([id, v]) => !listed.has(id) && v.n > smallest).length;
        console.log(
          `check ${role}/${project.hash} org ${window} O1: ${byProject.size} projects with roots, larger-but-unlisted ${missed}`,
        );
        compare('O3s', await run('O3s'), d => `${d.projectId}|${d.entityName ?? ''}`, byEntity);
        compare('O3f', await run('O3f'), d => `${d.projectId}|${d.entityName ?? ''}`, byEntity);
      }
    }
  } finally {
    await raw.close();
  }
}

// ---------------------------------------------------------------------------------------------
// report

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
};

function report() {
  const records = readJsonl<CallRecord>(OUT.grid);
  const cells = new Map<string, CallRecord[]>();
  for (const r of records) cells.set(cellKey(r), [...(cells.get(cellKey(r)) ?? []), r]);
  const peak = (r: CallRecord) => Math.max(0, ...r.queries.map(q => Number(q.memMiB)));
  const dur = (r: CallRecord) => r.queries.reduce((a, q) => a + Number(q.durationMs), 0);
  const read = (r: CallRecord) => Math.round(r.queries.reduce((a, q) => a + Number(q.readMiB), 0));
  const readRows = (r: CallRecord) => r.queries.reduce((a, q) => a + Number(q.readRows), 0);
  console.log(
    '## grid\nlabel | role | scope | window | card | cold MiB / ms | warm MiB med/max | warm ms | read MiB | read Mrows | result rows | svc',
  );
  console.log('---|---|---|---|---|---|---|---|---|---|---|---');
  for (const rs of cells.values()) {
    const r0 = rs[0]!;
    const cold = rs.find(r => r.arm === 'measure' && r.phase === 'cold');
    const warm = rs.filter(r => r.arm === 'measure' && r.phase === 'warm');
    const prod = rs.find(r => r.arm === 'prod');
    const fail = (r?: CallRecord) => (r && !r.ok ? ` ✗${r.errorCode}` : '');
    console.log(
      [
        r0.label,
        `${r0.role}/${r0.hash}`,
        r0.scope,
        r0.window,
        r0.request,
        cold ? `${peak(cold)} / ${dur(cold)}${fail(cold)}` : '-',
        `${median(warm.map(peak))} / ${Math.max(...warm.map(peak))}${warm.some(r => !r.ok) ? ` ✗${warm.find(r => !r.ok)!.errorCode}` : ''}`,
        median(warm.map(dur)),
        median(warm.map(read)),
        (median(warm.map(readRows)) / 1e6).toFixed(1),
        Math.max(0, ...warm.flatMap(r => r.queries.map(q => Number(q.resultRows)))),
        prod ? (prod.ok ? `ok ${peak(prod)} MiB ${dur(prod)} ms` : `✗${prod.errorCode} (${prod.wallMs} ms)`) : '-',
      ].join(' | '),
    );
  }

  const pages = readJsonl<PageRecord>(OUT.page);
  if (pages.length) {
    console.log(
      '\n## page\nlabel | page | role | window | variant | phase#rep | cards | stmts | page ms | slowest | max MiB | concurrent MiB | sum MiB | read MiB | failed',
    );
    console.log('---|---|---|---|---|---|---|---|---|---|---|---|---|---|---');
    for (const p of pages) {
      const s = summarizePage(p);
      console.log(
        [
          p.label,
          p.page,
          `${p.role}/${p.hash}`,
          p.window,
          p.variant,
          `${p.phase}#${p.rep}`,
          p.cards.length,
          s.statements,
          p.wallMs,
          s.slowest,
          s.maxPeak,
          s.concurrent,
          s.sum,
          s.readMiB,
          s.failed.join(',') || '-',
        ].join(' | '),
      );
    }
  }

  for (const c of readJsonl<Record<string, unknown>>(OUT.check)) console.log(`check ${JSON.stringify(c)}`);
}

// ---------------------------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();

async function main() {
  installOutputRedaction();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      platform: { type: 'string', default: '/tmp/platform-x48/servers/mobs-query' },
      label: { type: 'string', default: 'x48' },
      reps: { type: 'string', default: '3' },
      scopes: { type: 'string', default: 'project,org' },
      windows: { type: 'string', default: '24h,7d,30d' },
      projects: { type: 'string', default: 'p99,largest' },
      cells: { type: 'string' },
      page: { type: 'string', default: 'org' },
      variants: { type: 'string', default: 'agg,both' },
    },
  });
  const common = {
    platform: values.platform,
    label: values.label,
    roles: new Set(values.projects.split(',')),
    windows: values.windows.split(','),
  };
  switch (positionals[0]) {
    case 'grid':
      await grid({
        ...common,
        reps: Number(values.reps),
        scopes: values.scopes.split(',') as ScopeKind[],
        ...(values.cells ? { cells: new Set(values.cells.split(',')) } : {}),
      });
      break;
    case 'page':
      await pageLoad({
        ...common,
        page: values.page as 'org' | 'project',
        variants: values.variants.split(','),
        reps: Number(values.reps),
      });
      break;
    case 'parity':
      await parity(common);
      break;
    case 'check':
      await check(common);
      break;
    case 'dry': {
      // Plans and compiles every grid cell offline (no connection), so planner rejections surface first.
      const mods = await loadPlatform(values.platform);
      const to = new Date(Math.floor(Date.now() / HOUR) * HOUR);
      let cells = 0;
      let rejected = 0;
      for (const [scope, shapes] of [
        [{ organizationId: 'o' }, ORG_SHAPES],
        [{ organizationId: 'o', projectId: 'p' }, PROJECT_SHAPES],
      ] as const)
        for (const window of common.windows)
          for (const cell of cellsFor(shapes, window)) {
            cells++;
            try {
              compileShape(mods, cell.shape, scope, to, window, cell.interval);
            } catch (error) {
              rejected++;
              console.log(
                `${scope.projectId ? 'project' : 'org'} ${window} ${cell.id}: ${(error as Error).message.slice(0, 400)}`,
              );
            }
          }
      console.log(`${cells} cells, ${rejected} rejected`);
      break;
    }
    case 'report':
      report();
      break;
    default:
      console.error('usage: mobs-metrics-page.ts grid|page|parity|check|dry|report');
      process.exit(1);
  }
}
