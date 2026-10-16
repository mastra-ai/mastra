/**
 * X43 (OBS-516): is `POST /traces/aggregate` safe to take out from behind its flag? Controlled load on
 * Platform mobs-query against the read-only replica, for the requests un-flagging exposes.
 *
 *   sizes   per organization: root rows over 1/7/30/92/365 days and token rows over 30/92 days, so the
 *           X41/X42 picks can be re-checked and every org ranked against the size where a shape gets
 *           close to the caps. Orgs come out as salted hashes; only the picks are named (by bucket).
 *   run     the cells of `buildCells()`: A (the OBS-666 grouped view) and B (the OBS-516 Outcome
 *           cases), for the p99 and largest X41/X42 projects, per project and org-wide. Each cell is
 *           compiled by mobs-query's own planner and compiler (imported from --platform), then run as
 *             - `measure`: the compiled SQL under a 4 GiB / 60 s ceiling; a warm-up, then N warm reps;
 *             - `prod`:    `aggregateTraces()` itself (1 GiB / 9 s), once warm, and once cold
 *                          (`enable_filesystem_cache = 0`) on cells of 30 days or more, and on 7 days
 *                          for the largest org, as X41 did.
 *           Percentile cells also run the `measure` arm with `quantileDeterministic` swapped for
 *           `quantileExact`, and both fused into one `quantiles*` call, and record how far the exact p95
 *           is from the approximate one. max_threads=16 on every statement, one statement at a time.
 *   parity  ungrouped `count` against the `queryTraces()` page total for the largest org, 30 days.
 *   cold    the forced-cold control: `queryTraces()`'s first page of 25 (live today, no flag), ungrouped
 *           `count` and A's `entityName` view through `aggregateTraces()`, each once with the filesystem
 *           cache off, at 1/7/30 days. Says whether cold timeouts are an aggregate problem or the
 *           replica's cold read floor.
 *
 *   `run --variants exactInclusive` re-runs only the percentile cells' `measure` arm, with `approx` as
 *   the drift baseline, into its own file so the main table keeps its reps.
 *
 * Output: project hash, scope, window, case and numbers. No ids, values, keys or rows are printed.
 *
 *   npx tsx mobs-live.ts sizes|run|parity|cold --platform <mobs-query dir> [--groups A,B]
 *       [--projects p99,largest] [--scopes project,org] [--cases a,b] [--reps 3] [--variants v,w]
 *   npx tsx mobs-live.ts report
 */
import { createHmac, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import type { ClickHouseClient, ClickHouseSettings, QueryParams } from '@clickhouse/client';

import { assertReadOnlyStatement } from './client';
import { installOutputRedaction, loadCredentials, registerSensitive } from './env';
import { loadSelection } from './profile';
import type { SelectedProject } from './profile';
import { PREFLIGHT_FILE, RESULTS_DIR } from './run';

const RUN_OUT = join(RESULTS_DIR, 'mobs-live.jsonl');
const SIZES_OUT = join(RESULTS_DIR, 'mobs-live-sizes.json');
const PARITY_OUT = join(RESULTS_DIR, 'mobs-live-parity.json');
const PCT_OUT = join(RESULTS_DIR, 'mobs-live-percentiles.jsonl');
const COLD_OUT = join(RESULTS_DIR, 'mobs-live-cold.jsonl');
const RETRY_OUT = join(RESULTS_DIR, 'mobs-live-retry.jsonl');
const ALL_LOG = `clusterAllReplicas('all_groups.default', system.query_log)`;
const DAY = 86_400_000;
const GiB = 1024 ** 3;
const MEASURE: ClickHouseSettings = { max_memory_usage: String(4 * GiB), max_execution_time: 60 };
const COLD: ClickHouseSettings = { enable_filesystem_cache: 0 };

/** Service caps (`runTraceQuery`) and the X43 thresholds against them. */
export const CAP_MS = 9_000;
export const CAP_MIB = 1_024;
export const CLOSE_MS = 6_000;
export const CLOSE_MIB = 768;

type Role = 'p99' | 'largest';
type Scope = 'project' | 'org';
/**
 * `exact` is `quantileExact` (the value at rank ⌊level·n⌋), the planned comparison. `exactInclusive` is
 * `quantileExactInclusive`, which interpolates (R7) the way the reservoir sampler does below 8,192 values,
 * so its p95 drift is the approximation alone rather than a different percentile definition.
 */
export type Variant = 'approx' | 'exact' | 'exactInclusive' | 'approxFused' | 'exactFused';

const GROUPED_VIEW = [
  'count',
  'errorRate',
  'duration.p50',
  'duration.p95',
  'tokens.input.sum',
  'tokens.output.sum',
  'cost.sum',
];
const PERCENTILES = ['count', 'duration.p50', 'duration.p95', 'duration.p99'];

export interface CellContext {
  role: Role;
  scope: Scope;
  environment?: string;
  tool?: string;
  metadataKey?: string;
}

export interface Cell {
  group: 'A' | 'B';
  /** Case id, unique within a role/scope. */
  id: string;
  days: number;
  body: Record<string, unknown>;
  variants: Variant[];
  cold: boolean;
}

/** Every X43 cell for one project and scope. Bodies omit `timeRange`; `run` adds it per window. */
export function buildCells(ctx: CellContext): Cell[] {
  const cells: Cell[] = [];
  const cold = (days: number) => days >= 30 || (days >= 7 && ctx.role === 'largest');
  const add = (
    group: Cell['group'],
    id: string,
    days: number,
    body: Record<string, unknown>,
    variants: Variant[] = ['approx'],
  ) => cells.push({ group, id, days, body, variants, cold: cold(days) });

  // A: the OBS-666 grouped view, top 50 by count.
  const dims = ['entityName', 'status', 'environment', 'entityType', ...(ctx.scope === 'org' ? ['projectId'] : [])];
  for (const days of [1, 7, 30]) {
    for (const dim of dims) {
      add('A', `A:${dim}:${days}d`, days, {
        groupBy: [dim],
        measures: GROUPED_VIEW,
        orderBy: { field: 'count', direction: 'desc' },
        limit: 50,
      });
    }
  }

  // B: the Decisions doc's canonical examples.
  if (ctx.environment) {
    add('B', 'Ex1', 62, {
      where: { op: 'eq', left: { path: 'environment' }, right: { literal: ctx.environment } },
      groupBy: ['entityName'],
      interval: '1d',
      measures: ['count', 'errorRate'],
    });
  }
  add('B', 'Ex2', 31, {
    groupBy: ['entityName'],
    measures: ['count', 'duration.p95'],
    having: { op: 'gt', left: { path: 'duration.p95' }, right: { literal: 5000 } },
    orderBy: { field: 'duration.p95', direction: 'desc' },
    limit: 10,
  });
  if (ctx.tool && ctx.metadataKey) {
    add('B', 'Ex3', 31, {
      where: { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: ctx.tool } } } },
      groupBy: [`metadata.${ctx.metadataKey}`],
      measures: ['count', 'countDistinct.threadId'],
    });
  }
  add('B', 'Ex4', 92, {
    groupBy: ['entityName'],
    interval: '1d',
    measures: ['count', 'tokens.input.sum', 'tokens.output.sum', 'cost.sum'],
    orderBy: { field: 'cost.sum', direction: 'desc' },
    limit: 20,
  });

  // B: a 365-day window ("everything" at 6 months' retention).
  add('B', '365:entityName', 365, {
    groupBy: ['entityName'],
    measures: GROUPED_VIEW,
    orderBy: { field: 'count', direction: 'desc' },
    limit: 50,
  });
  add('B', '365:count', 365, { measures: ['count'] });

  // B: high-cardinality groupings.
  for (const dim of ['threadId', 'userId']) {
    for (const days of [30, 365]) {
      for (const limit of [100, 1000]) {
        add('B', `card:${dim}:${limit}:${days}d`, days, {
          groupBy: [dim],
          measures: ['count', 'errorRate', 'duration.p95'],
          limit,
        });
      }
    }
  }

  // B: the two-stage interval path (limit × buckets stays ≤ 10,000; 365 d has up to 366 daily buckets).
  add('B', 'iv:entityName:1h:7d', 7, {
    groupBy: ['entityName'],
    interval: '1h',
    measures: ['count', 'errorRate'],
    limit: 50,
  });
  add('B', 'iv:entityName:1d:30d', 30, {
    groupBy: ['entityName'],
    interval: '1d',
    measures: ['count', 'errorRate'],
    limit: 50,
  });
  add('B', 'iv:entityName:1d:365d', 365, {
    groupBy: ['entityName'],
    interval: '1d',
    measures: ['count', 'errorRate'],
    limit: 25,
  });
  add('B', 'iv:threadId:1d:30d', 30, {
    groupBy: ['threadId'],
    interval: '1d',
    measures: ['count', 'errorRate'],
    limit: 300,
  });

  // B: exact distinct counts over 365 days.
  for (const dim of ['entityName', 'threadId']) {
    add('B', `cd:${dim}:365d`, 365, {
      groupBy: [dim],
      measures: ['count', 'countDistinct.threadId', 'countDistinct.userId'],
      limit: dim === 'threadId' ? 1000 : 100,
    });
  }

  // B: approximate vs exact percentiles on the costliest groupings.
  const all: Variant[] = ['approx', 'exact', 'exactInclusive', 'approxFused', 'exactFused'];
  add('B', 'pct:threadId:365d', 365, { groupBy: ['threadId'], measures: PERCENTILES, limit: 1000 }, all);
  add(
    'B',
    'pct:entityName:1d:365d',
    365,
    { groupBy: ['entityName'], interval: '1d', measures: PERCENTILES, limit: 25 },
    all,
  );
  add('B', 'pct:none:30d', 30, { measures: PERCENTILES }, all);
  add('B', 'pct:none:365d', 365, { measures: PERCENTILES }, all);

  return cells;
}

const QUANTILE = /quantileDeterministic\(([\d.]+)\)\(durationMs, traceSeed\)/g;

/** The compiled SQL with its duration percentiles computed another way. `approx` is as compiled. */
export function rewritePercentiles(sql: string, variant: Variant): string {
  if (variant === 'approx') return sql;
  const levels = [...new Set([...sql.matchAll(QUANTILE)].map(m => m[1]!))].sort((a, b) => Number(a) - Number(b));
  if (levels.length === 0) throw new Error('no percentiles to rewrite');
  return sql.replace(QUANTILE, (_m, level: string) => {
    if (variant === 'exact') return `quantileExact(${level})(durationMs)`;
    if (variant === 'exactInclusive') return `quantileExactInclusive(${level})(durationMs)`;
    const index = levels.indexOf(level) + 1;
    return variant === 'exactFused'
      ? `quantilesExact(${levels.join(', ')})(durationMs)[${index}]`
      : `quantilesDeterministic(${levels.join(', ')})(durationMs, traceSeed)[${index}]`;
  });
}

/** Relative p95 difference of `other` against `base`, per matching group (and bucket). */
export function percentileDrift(
  base: Record<string, unknown>[],
  other: Record<string, unknown>[],
  column: string,
): { groups: number; median: number; max: number } {
  const key = (r: Record<string, unknown>) => `${r.d0 ?? ''}|${r.d1 ?? ''}|${r.bucket ?? ''}`;
  const index = new Map(base.map(r => [key(r), Number(r[column])]));
  const diffs: number[] = [];
  for (const r of other) {
    const a = index.get(key(r));
    const b = Number(r[column]);
    if (a === undefined || !Number.isFinite(a) || !Number.isFinite(b)) continue;
    diffs.push(a === b ? 0 : Math.abs(b - a) / Math.max(Math.abs(a), Math.abs(b)));
  }
  diffs.sort((x, y) => x - y);
  return {
    groups: diffs.length,
    median: diffs.length ? diffs[Math.floor((diffs.length - 1) / 2)]! : NaN,
    max: diffs.length ? diffs[diffs.length - 1]! : NaN,
  };
}

interface Tag {
  queryIds: string[];
  settings: ClickHouseSettings;
}

export interface QueryStat {
  durationMs: number;
  memMiB: number;
  readRows: number;
  readMiB: number;
  resultRows: number;
  exc: number;
  /** Bytes read from object storage vs the filesystem cache (absent on older records). */
  sourceMiB?: number;
  cacheMiB?: number;
}

export interface RunRecord {
  runId: string;
  role: Role;
  hash: string;
  scope: Scope;
  group: Cell['group'];
  id: string;
  days: number;
  variant: Variant;
  arm: 'measure' | 'prod';
  phase: 'warm' | 'cold';
  rep: number;
  ok: boolean;
  errorCode?: string;
  wallMs: number;
  rows?: number;
  truncated?: boolean;
  /** Exact-vs-approximate p95 drift, on percentile variants' first rep. */
  p95Drift?: { groups: number; median: number; max: number };
  queries: QueryStat[];
}

function guardedClient(
  raw: ClickHouseClient,
  state: { current?: Tag },
  { maxThreads = 16 }: { maxThreads?: number | null } = {},
): ClickHouseClient {
  const query = (params: QueryParams) => {
    assertReadOnlyStatement(params.query);
    const tag = state.current;
    if (!tag) throw new Error('query outside a measured call');
    const queryId = randomUUID();
    tag.queryIds.push(queryId);
    const pending = raw.query({
      ...params,
      query_id: queryId,
      clickhouse_settings: {
        ...params.clickhouse_settings,
        use_query_cache: 0,
        ...(maxThreads === null ? {} : { max_threads: maxThreads }),
        ...tag.settings,
        log_comment: 'aqa-bench:mobs-live',
      },
    });
    pending.catch(() => {});
    return pending;
  };
  return new Proxy(raw, {
    get(target, prop) {
      if (prop === 'query') return query;
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      throw new Error(`mobs-live: client method ${String(prop)} is not allowed`);
    },
  }) as ClickHouseClient;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadPlatform(dir: string) {
  const load = (path: string) => import(pathToFileURL(join(dir, path)).href) as Promise<any>;
  return {
    plan: await load('src/services/trace-aggregate-plan.ts'),
    sql: await load('src/services/trace-aggregate-sql.ts'),
    run: await load('src/services/trace-aggregate.ts'),
    obs: await load('src/services/observability.ts'),
    queryPlan: await load('src/services/trace-query-plan.ts'),
    query: await load('src/services/trace-query.ts'),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Same picks as X41/X42: the p99 representative that is not the heavy one, and the largest. */
function pickProjects(projects: SelectedProject[]): Array<[Role, SelectedProject]> {
  const of = (bucket: string) => projects.filter(p => p.bucket === bucket);
  const perTrace = (p: SelectedProject) => (p.stats.spans30d ?? 0) / Math.max(1, p.stats.traces30d);
  const p99 = of('p99');
  const heavy = [...p99].sort((a, b) => perTrace(b) - perTrace(a))[0];
  const p99rep = p99.find(p => p.representative && p !== heavy) ?? p99.find(p => p !== heavy);
  const largest = of('largest').find(p => p.representative);
  const out: Array<[Role, SelectedProject | undefined]> = [
    ['p99', p99rep],
    ['largest', largest],
  ];
  return out.filter((e): e is [Role, SelectedProject] => !!e[1]);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function measured<T>(
  state: { current?: Tag },
  settings: ClickHouseSettings,
  fn: () => Promise<T>,
): Promise<{ ok: boolean; errorCode?: string; wallMs: number; queryIds: string[]; value?: T }> {
  const tag: Tag = { queryIds: [], settings };
  state.current = tag;
  const started = performance.now();
  try {
    const value = await fn();
    return { ok: true, wallMs: performance.now() - started, queryIds: tag.queryIds, value };
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    return {
      ok: false,
      errorCode: code === undefined ? ((error as Error)?.name ?? 'client') : String(code),
      wallMs: performance.now() - started,
      queryIds: tag.queryIds,
    };
  } finally {
    state.current = undefined;
    await sleep(150);
  }
}

async function rows<T>(raw: ClickHouseClient, sql: string, params: Record<string, unknown>): Promise<T[]> {
  assertReadOnlyStatement(sql);
  const result = await raw.query({
    query: sql,
    query_params: params,
    format: 'JSONEachRow',
    clickhouse_settings: {
      log_comment: 'aqa-bench:mobs-live:meta',
      max_execution_time: 120,
      max_memory_usage: String(4 * GiB),
      max_threads: 16,
    },
  });
  return result.json<T>();
}

async function fetchStats(raw: ClickHouseClient, ids: string[]): Promise<Map<string, QueryStat>> {
  const found = new Map<string, QueryStat>();
  for (let attempt = 0; attempt < 30 && found.size < ids.length; attempt++) {
    if (attempt > 0) await sleep(2000);
    const missing = ids.filter(id => !found.has(id));
    const got = await rows<QueryStat & { id: string }>(
      raw,
      `SELECT query_id AS id, query_duration_ms AS durationMs, round(memory_usage / 1048576, 1) AS memMiB,
              read_rows AS readRows, round(read_bytes / 1048576, 2) AS readMiB, result_rows AS resultRows,
              exception_code AS exc,
              round(ProfileEvents['CachedReadBufferReadFromSourceBytes'] / 1048576, 1) AS sourceMiB,
              round(ProfileEvents['CachedReadBufferReadFromCacheBytes'] / 1048576, 1) AS cacheMiB
       FROM ${ALL_LOG}
       WHERE event_date >= yesterday() AND type IN ('QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart')
         AND query_id IN {ids:Array(String)}`,
      { ids: missing },
    );
    for (const { id, ...stat } of got) found.set(id, numericStat(stat));
  }
  return found;
}

/** The project's most common top-level metadata key over 30 days, kept in memory only. */
async function topMetadataKey(raw: ClickHouseClient, p: SelectedProject): Promise<string | undefined> {
  const [row] = await rows<{ k: string }>(
    raw,
    `SELECT k FROM mastra_trace_roots ARRAY JOIN mapKeys(metadataSearch) AS k
     WHERE organizationId = {org:String} AND projectId = {project:String} AND startedAt >= now() - INTERVAL 30 DAY
     GROUP BY k ORDER BY count() DESC LIMIT 1`,
    { org: p.organizationId, project: p.projectId },
  );
  if (row?.k) registerSensitive([row.k]);
  return row?.k;
}

/** The project's most common span name among tool calls over 30 days, kept in memory only. */
async function topToolName(raw: ClickHouseClient, p: SelectedProject): Promise<string | undefined> {
  const [row] = await rows<{ n: string }>(
    raw,
    `SELECT name AS n FROM mastra_span_events
     WHERE organizationId = {org:String} AND projectId = {project:String} AND startedAt >= now() - INTERVAL 30 DAY
       AND spanType = 'tool_call'
     GROUP BY n ORDER BY count() DESC LIMIT 1`,
    { org: p.organizationId, project: p.projectId },
  );
  if (row?.n) registerSensitive([row.n]);
  return row?.n;
}

async function connect(platform: string) {
  const database = (JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string }).database;
  const credentials = loadCredentials();
  // mobs-query's own client copy: its compilers pass TupleParam, which a second copy would not recognize.
  const { createClient, ClickHouseLogLevel } = createRequire(join(platform, 'package.json'))(
    '@clickhouse/client',
  ) as typeof import('@clickhouse/client');
  return createClient({
    url: credentials.origin,
    username: credentials.username,
    password: credentials.password,
    database,
    request_timeout: 180_000,
    max_open_connections: 4,
    log: { level: ClickHouseLogLevel.OFF },
  });
}

interface Options {
  platform: string;
  reps: number;
  scopes: Scope[];
  roles: Set<string>;
  groups: Set<string>;
  cases?: Set<string>;
  /** Percentile re-run: only these variants (plus `approx`), `measure` arm only, separate output. */
  variants?: Variant[];
}

function doneKeys(): Set<string> {
  if (!existsSync(RUN_OUT)) return new Set();
  return new Set(
    readFileSync(RUN_OUT, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as RunRecord)
      .map(r => `${r.hash}|${r.scope}|${r.id}`),
  );
}

const WINDOWS = [1, 7, 30, 92, 365];

export interface OrgSize {
  /** The pick's role for the X41/X42 orgs, otherwise a salted hash. */
  org: string;
  /** Root rows by window in days. */
  roots: Record<number, number>;
  usage30d: number;
  usage92d: number;
  /** `mastra_metric_events` token rows the fallback reads (no `usageId`). */
  metrics30d: number;
  metrics92d: number;
}

async function sizes(options: Options) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const raw = await connect(options.platform);
  try {
    const roots = await rows<Record<string, string>>(
      raw,
      `SELECT organizationId AS org, ${WINDOWS.map(d => `countIf(startedAt >= now() - INTERVAL ${d} DAY) AS r${d}`).join(', ')}
       FROM mastra_trace_roots WHERE startedAt >= now() - INTERVAL 365 DAY GROUP BY org`,
      {},
    );
    const tokens = await rows<Record<string, string>>(
      raw,
      `SELECT organizationId AS org, countIf(timestamp >= now() - INTERVAL 30 DAY) AS u30, count() AS u92
       FROM mastra_model_usage WHERE timestamp >= now() - INTERVAL 92 DAY GROUP BY org`,
      {},
    );
    const metrics = await rows<Record<string, string>>(
      raw,
      `SELECT organizationId AS org, countIf(timestamp >= now() - INTERVAL 30 DAY) AS m30, count() AS m92
       FROM mastra_metric_events WHERE timestamp >= now() - INTERVAL 92 DAY
         AND name IN ('mastra_model_total_input_tokens', 'mastra_model_total_output_tokens',
                      'mastra_model_output_reasoning_tokens', 'mastra_model_input_cache_read_tokens')
         AND (usageId IS NULL OR trimBoth(usageId) = '') AND isNotNull(traceId)
       GROUP BY org`,
      {},
    );
    const picks = new Map(pickProjects(selection.projects).map(([role, p]) => [p.organizationId, role]));
    const usage = new Map(tokens.map(t => [t.org, t]));
    const metric = new Map(metrics.map(t => [t.org, t]));
    const orgs = roots.map((r): OrgSize => {
      registerSensitive([r.org]);
      return {
        org: picks.get(r.org!) ?? createHmac('sha256', selection.salt).update(r.org!).digest('hex').slice(0, 8),
        roots: Object.fromEntries(WINDOWS.map(d => [d, Number(r[`r${d}`])])),
        usage30d: Number(usage.get(r.org)?.u30 ?? 0),
        usage92d: Number(usage.get(r.org)?.u92 ?? 0),
        metrics30d: Number(metric.get(r.org)?.m30 ?? 0),
        metrics92d: Number(metric.get(r.org)?.m92 ?? 0),
      };
    });
    orgs.sort((a, b) => b.roots[30]! - a.roots[30]!);
    writeFileSync(SIZES_OUT, JSON.stringify({ measuredAt: new Date().toISOString(), orgs }, null, 2));
    console.log(`${orgs.length} orgs with roots in 365 days → ${SIZES_OUT}`);
    for (const [i, o] of orgs.entries()) {
      if (i < 10 || picks.has(o.org) || [...picks.values()].includes(o.org as Role)) {
        console.log(
          `#${i + 1} ${o.org}: roots 1/7/30/92/365d ${WINDOWS.map(d => o.roots[d]).join('/')}, usage 30/92d ${o.usage30d}/${o.usage92d}, fallback token rows 30/92d ${o.metrics30d}/${o.metrics92d}`,
        );
      }
    }
  } finally {
    await raw.close();
  }
}

async function run(options: Options) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const raw = await connect(options.platform);
  const state: { current?: Tag } = {};
  const client = guardedClient(raw, state);
  const mods = await loadPlatform(options.platform);
  const usage = mods.sql.traceAggregateUsageOptions({});
  const runId = randomUUID().slice(0, 8);
  const rerun = options.variants;
  const out = rerun ? PCT_OUT : RUN_OUT;
  const done = rerun ? new Set<string>() : doneKeys();
  const to = new Date();

  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      const metadataKey = (await topMetadataKey(raw, project)) ?? undefined;
      const tool = (await topToolName(raw, project)) ?? undefined;
      const environment = project.literalSource.environment === 'discovered' ? project.literals.environment : undefined;
      for (const scopeName of options.scopes) {
        const scope =
          scopeName === 'project'
            ? { organizationId: project.organizationId, projectId: project.projectId }
            : { organizationId: project.organizationId };
        const cells = buildCells({ role, scope: scopeName, environment, tool, metadataKey });
        for (const cell of cells) {
          if (!options.groups.has(cell.group)) continue;
          if (options.cases && ![...options.cases].some(c => cell.id.startsWith(c))) continue;
          if (done.has(`${project.hash}|${scopeName}|${cell.id}`)) continue;
          if (rerun && cell.variants.length < 2) continue;
          const variants = rerun ? (['approx', ...rerun] as Variant[]) : cell.variants;
          const timeRange = { from: new Date(to.getTime() - cell.days * DAY).toISOString(), to: to.toISOString() };
          const body = { timeRange, ...cell.body };
          let plan: unknown;
          try {
            plan = mods.plan.planPlatformTraceAggregate(body, scope, []);
          } catch (error) {
            console.log(
              `${role}/${project.hash} ${scopeName} ${cell.id}: planner rejected (${(error as Error).message})`,
            );
            continue;
          }
          const compiled = mods.sql.compileClickHouseTraceAggregate(plan, usage);
          const base = {
            runId,
            role,
            hash: project.hash,
            scope: scopeName,
            group: cell.group,
            id: cell.id,
            days: cell.days,
          };
          type Call = Omit<RunRecord, 'queries' | keyof typeof base> & { ids: string[] };
          const calls: Call[] = [];

          // Cold first, before this cell's warm-up loads the filesystem cache.
          if (cell.cold && !rerun) {
            const r = await measured(state, COLD, () => mods.run.aggregateTraces(client, plan, usage));
            const value = r.value as { rows: unknown[]; truncated: boolean } | undefined;
            calls.push({
              variant: 'approx',
              arm: 'prod',
              phase: 'cold',
              rep: 1,
              ok: r.ok,
              ...(r.errorCode ? { errorCode: r.errorCode } : {}),
              wallMs: Math.round(r.wallMs),
              ...(value ? { rows: value.rows.length, truncated: value.truncated } : {}),
              ids: r.queryIds,
            });
          }

          let approxRows: Record<string, unknown>[] | undefined;
          const p95 = (cell.body.measures as string[]).indexOf('duration.p95');
          for (const variant of variants) {
            const query = rewritePercentiles(compiled.query, variant);
            const statement = () =>
              client
                .query({
                  query,
                  query_params: compiled.query_params,
                  format: 'JSONEachRow',
                  clickhouse_settings: { ...mods.obs.CLICKHOUSE_SETTINGS, filesystem_prefetches_limit: '8' },
                })
                .then(r => r.json() as Promise<Record<string, unknown>[]>);
            await measured(state, MEASURE, statement);
            for (let rep = 1; rep <= options.reps; rep++) {
              const r = await measured(state, MEASURE, statement);
              const out = r.value;
              if (variant === 'approx' && rep === 1) approxRows = out;
              const drift =
                variant !== 'approx' && rep === 1 && out && approxRows && p95 >= 0
                  ? percentileDrift(approxRows, out, `m${p95}`)
                  : undefined;
              calls.push({
                variant,
                arm: 'measure',
                phase: 'warm',
                rep,
                ok: r.ok,
                ...(r.errorCode ? { errorCode: r.errorCode } : {}),
                wallMs: Math.round(r.wallMs),
                ...(out ? { rows: out.length } : {}),
                ...(drift ? { p95Drift: drift } : {}),
                ids: r.queryIds,
              });
            }
          }

          if (!rerun) {
            const prod = await measured(state, {}, () => mods.run.aggregateTraces(client, plan, usage));
            const value = prod.value as { rows: unknown[]; truncated: boolean } | undefined;
            calls.push({
              variant: 'approx',
              arm: 'prod',
              phase: 'warm',
              rep: 1,
              ok: prod.ok,
              ...(prod.errorCode ? { errorCode: prod.errorCode } : {}),
              wallMs: Math.round(prod.wallMs),
              ...(value ? { rows: value.rows.length, truncated: value.truncated } : {}),
              ids: prod.queryIds,
            });
          }

          const stats = await fetchStats(
            raw,
            calls.flatMap(c => c.ids),
          );
          const records = calls.map(
            ({ ids, ...call }): RunRecord => ({
              ...base,
              ...call,
              queries: ids.map(id => stats.get(id)).filter((s): s is QueryStat => !!s),
            }),
          );
          for (const record of records) appendFileSync(out, `${JSON.stringify(record)}\n`);
          const row = summarizeCell(records);
          console.log(
            `${role}/${project.hash} ${scopeName} ${cell.id}: warm ${row.warmMs}ms/${row.warmMiB}MiB, svc ${row.svc}, cold ${row.cold}${row.flag ? ` [${row.flag}]` : ''}`,
          );
        }
      }
    }
  } finally {
    await raw.close();
  }
}

async function parity(options: Options) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const raw = await connect(options.platform);
  const state: { current?: Tag } = {};
  const client = guardedClient(raw, state);
  const mods = await loadPlatform(options.platform);
  const to = new Date();
  const timeRange = { from: new Date(to.getTime() - 30 * DAY).toISOString(), to: to.toISOString() };
  const out: Array<Record<string, unknown>> = [];
  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      for (const scopeName of options.scopes) {
        const scope =
          scopeName === 'project'
            ? { organizationId: project.organizationId, projectId: project.projectId }
            : { organizationId: project.organizationId };
        const plan = mods.plan.planPlatformTraceAggregate({ timeRange, measures: ['count'] }, scope, []);
        const agg = await measured(state, {}, () =>
          mods.run.aggregateTraces(client, plan, mods.sql.traceAggregateUsageOptions({})),
        );
        const page = await measured(state, {}, () =>
          mods.query.queryTraces(
            client,
            mods.queryPlan.planPlatformTraceQuery({ timeRange, pagination: { page: 0, perPage: 1 } }, scope),
          ),
        );
        const count = (agg.value as { rows: Array<{ measures: { count: number } }> } | undefined)?.rows[0]?.measures
          .count;
        const total = (page.value as { pagination?: { total: number } } | undefined)?.pagination?.total;
        const result = {
          role,
          hash: project.hash,
          scope: scopeName,
          count,
          total,
          equal: count === total,
          aggOk: agg.ok,
          pageOk: page.ok,
          pageError: page.errorCode,
        };
        out.push(result);
        console.log(JSON.stringify(result));
      }
    }
    writeFileSync(PARITY_OUT, JSON.stringify(out, null, 2));
  } finally {
    await raw.close();
  }
}

async function coldControl(options: Options) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const raw = await connect(options.platform);
  const state: { current?: Tag } = {};
  const client = guardedClient(raw, state);
  const mods = await loadPlatform(options.platform);
  const usage = mods.sql.traceAggregateUsageOptions({});
  const to = new Date();
  const ops: Array<[string, (timeRange: { from: string; to: string }, scope: object) => () => Promise<unknown>]> = [
    [
      'list:25',
      (timeRange, scope) => () =>
        mods.query.queryTraces(
          client,
          mods.queryPlan.planPlatformTraceQuery({ timeRange, pagination: { page: 0, perPage: 25 } }, scope),
        ),
    ],
    [
      'agg:count',
      (timeRange, scope) => () =>
        mods.run.aggregateTraces(
          client,
          mods.plan.planPlatformTraceAggregate({ timeRange, measures: ['count'] }, scope, []),
          usage,
        ),
    ],
    [
      'agg:A:entityName',
      (timeRange, scope) => () =>
        mods.run.aggregateTraces(
          client,
          mods.plan.planPlatformTraceAggregate(
            {
              timeRange,
              groupBy: ['entityName'],
              measures: GROUPED_VIEW,
              orderBy: { field: 'count', direction: 'desc' },
              limit: 50,
            },
            scope,
            [],
          ),
          usage,
        ),
    ],
  ];
  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      for (const scopeName of options.scopes) {
        const scope =
          scopeName === 'project'
            ? { organizationId: project.organizationId, projectId: project.projectId }
            : { organizationId: project.organizationId };
        for (const days of [1, 7, 30]) {
          const timeRange = { from: new Date(to.getTime() - days * DAY).toISOString(), to: to.toISOString() };
          for (const [op, make] of ops) {
            const r = await measured(state, COLD, make(timeRange, scope));
            const stats = await fetchStats(raw, r.queryIds);
            const queries = r.queryIds
              .map(id => stats.get(id))
              .filter((q): q is QueryStat => !!q)
              .map(numericStat);
            const record = {
              role,
              hash: project.hash,
              scope: scopeName,
              days,
              op,
              ok: r.ok,
              errorCode: r.errorCode,
              wallMs: Math.round(r.wallMs),
              queries,
            };
            appendFileSync(COLD_OUT, `${JSON.stringify(record)}\n`);
            const ms = queries.reduce((t, q) => t + q.durationMs, 0);
            const mib = Math.max(0, ...queries.map(q => q.memMiB));
            const read = Math.max(0, ...queries.map(q => q.readMiB));
            console.log(
              `${role} ${scopeName} ${days}d ${op}: ${r.ok ? 'ok' : `fail ${r.errorCode ?? queries.find(q => q.exc)?.exc}`} ${ms}ms/${mib}MiB, read ${read}MiB`,
            );
          }
        }
      }
    }
  } finally {
    await raw.close();
  }
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
};
/** ClickHouse quotes 64-bit integers in JSON; records written before this read them as strings. */
const numericStat = (q: QueryStat): QueryStat => ({
  durationMs: Number(q.durationMs),
  memMiB: Number(q.memMiB),
  readRows: Number(q.readRows),
  readMiB: Number(q.readMiB),
  resultRows: Number(q.resultRows),
  exc: Number(q.exc),
  ...(q.sourceMiB === undefined ? {} : { sourceMiB: Number(q.sourceMiB), cacheMiB: Number(q.cacheMiB) }),
});
const peak = (r: RunRecord) => Math.max(0, ...r.queries.map(q => Number(q.memMiB)));
const took = (r: RunRecord) => (r.queries.length ? r.queries.reduce((s, q) => s + Number(q.durationMs), 0) : r.wallMs);
const code = (r: RunRecord) => r.queries.map(q => Number(q.exc)).find(exc => exc !== 0) ?? r.errorCode;

/** One cell's approximate-path numbers and its fail/close flag against the service caps. */
export function summarizeCell(records: RunRecord[]) {
  const warm = records.filter(r => r.arm === 'measure' && r.variant === 'approx' && r.phase === 'warm');
  const prod = records.find(r => r.arm === 'prod' && r.phase === 'warm');
  const cold = records.find(r => r.arm === 'prod' && r.phase === 'cold');
  const warmMs = median(warm.map(took));
  const warmP95Ms = Math.max(...warm.map(took));
  const warmMiB = median(warm.map(peak));
  const fail =
    (prod && !prod.ok) || warm.some(r => !r.ok) || warmMs > CAP_MS || warmMiB > CAP_MIB
      ? `FAIL${prod && !prod.ok ? ` svc ${code(prod)}` : ''}`
      : undefined;
  const close =
    !fail && (warmMs > CLOSE_MS || warmMiB > CLOSE_MIB || (cold && !cold.ok))
      ? `CLOSE${cold && !cold.ok ? ` cold ${code(cold)}` : ''}`
      : undefined;
  const fmt = (r?: RunRecord) =>
    !r ? '-' : r.ok ? `${took(r)}ms/${peak(r)}MiB` : `fail ${code(r)} @${took(r)}ms/${peak(r)}MiB`;
  return {
    warmMs,
    warmP95Ms,
    warmMiB,
    readMiB: median(warm.map(r => Math.max(0, ...r.queries.map(q => Number(q.readMiB))))),
    resultRows: warm[0]?.rows,
    svc: fmt(prod),
    svcTruncated: prod?.truncated,
    cold: fmt(cold),
    flag: fail ?? close,
  };
}

function report() {
  if (!existsSync(RUN_OUT)) throw new Error('Run `run` first');
  const records = readFileSync(RUN_OUT, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l) as RunRecord);
  const cells = new Map<string, RunRecord[]>();
  for (const r of records) {
    const key = `${r.role}|${r.scope}|${r.id}`;
    cells.set(key, [...(cells.get(key) ?? []), r]);
  }
  // The percentile re-run has its own `approx` baseline; it only feeds the percentile table.
  const pct = new Map<string, RunRecord[]>();
  const rerun = existsSync(PCT_OUT)
    ? readFileSync(PCT_OUT, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l) as RunRecord)
    : [];
  for (const r of rerun) {
    const key = `${r.role}|${r.scope}|${r.id}|rerun`;
    pct.set(key, [...(pct.get(key) ?? []), r]);
  }
  console.log(
    'role | scope | case | days | warm ms (med/max) | warm MiB (med) | read MiB | rows | svc (warm) | cold | flag',
  );
  for (const [key, rs] of cells) {
    const [role, scope, id] = key.split('|');
    const s = summarizeCell(rs);
    console.log(
      `${role} | ${scope} | ${id} | ${rs[0]!.days} | ${s.warmMs}/${s.warmP95Ms} | ${s.warmMiB} | ${s.readMiB} | ${s.resultRows ?? '-'}${s.svcTruncated ? '+' : ''} | ${s.svc} | ${s.cold} | ${s.flag ?? ''}`,
    );
  }

  console.log('\n## percentiles: approx vs exact (measure arm, warm medians)');
  console.log('role | scope | case | variant | ms | MiB | vs approx MiB | p95 drift med/max (groups)');
  for (const [key, rs] of [...cells, ...pct]) {
    if (!rs.some(r => r.variant !== 'approx')) continue;
    const [role, scope, cellId, again] = key.split('|');
    const id = again ? `${cellId} (re-run)` : cellId;
    const of = (v: Variant) => rs.filter(r => r.arm === 'measure' && r.variant === v);
    const approxMiB = median(of('approx').map(peak));
    for (const v of ['approx', 'approxFused', 'exact', 'exactInclusive', 'exactFused'] as Variant[]) {
      const vs = of(v);
      if (!vs.length) continue;
      const mib = median(vs.map(peak));
      const drift = vs.find(r => r.p95Drift)?.p95Drift;
      console.log(
        `${role} | ${scope} | ${id} | ${v} | ${median(vs.map(took))} | ${mib}${vs.some(r => !r.ok) ? ` (fail ${vs.map(code).filter(Boolean).join(',')})` : ''} | ${v === 'approx' ? '' : `${(((mib - approxMiB) / approxMiB) * 100).toFixed(1)}%`} | ${drift ? `${(drift.median * 100).toFixed(2)}%/${(drift.max * 100).toFixed(2)}% (${drift.groups})` : ''}`,
      );
    }
  }
}

/**
 * OBS-676: cold reads the way prod runs them. mobs-query's own `withQueryRetry` wraps the guarded
 * client, `max_threads` stays at the server default, and the filesystem cache stays on. Each cell
 * reads a window nobody has read recently (shifted into older data, disjoint per org), so the first
 * attempt is cold and the retry, if any, reads what it cached. Every attempt is logged with its
 * object-storage and cache bytes, so one run answers both "would main have 504'd" (the first
 * attempt, which is main's only one) and "does the branch finish". `--cache off` is X43's control:
 * cache disabled, current windows.
 */
export const RETRY_CELLS: Array<{ op: 'list:25' | 'agg:A:entityName'; days: number; endDaysAgo: number }> = [
  { op: 'list:25', days: 7, endDaysAgo: 7 },
  { op: 'agg:A:entityName', days: 7, endDaysAgo: 14 },
  { op: 'list:25', days: 30, endDaysAgo: 21 },
  { op: 'agg:A:entityName', days: 30, endDaysAgo: 51 },
];

async function retryRun(options: Options & { ranks: number[]; cache: 'off' | 'cold-window' }) {
  const raw = await connect(options.platform);
  const state: { current?: Tag } = {};
  const quiet = { warn() {}, error() {}, info() {}, debug() {} };
  const { withQueryRetry } = (await import(pathToFileURL(join(options.platform, 'src/db/query-retry.ts')).href)) as {
    withQueryRetry: (client: ClickHouseClient, logger: unknown) => ClickHouseClient;
  };
  const client = withQueryRetry(guardedClient(raw, state, { maxThreads: null }), quiet);
  const mods = await loadPlatform(options.platform);
  const usage = mods.sql.traceAggregateUsageOptions({});
  const selection = loadSelection();
  try {
    const ranked = await rows<{ org: string; roots: string }>(
      raw,
      `SELECT organizationId AS org, count() AS roots
       FROM mastra_trace_roots WHERE startedAt >= now() - INTERVAL 30 DAY GROUP BY org ORDER BY roots DESC LIMIT 20`,
      {},
    );
    const now = Date.now();
    for (const rank of options.ranks) {
      const entry = ranked[rank - 1];
      if (!entry) continue;
      registerSensitive([entry.org]);
      const [first] = await rows<{ oldest: string }>(
        raw,
        `SELECT toString(min(startedAt)) AS oldest FROM mastra_trace_roots WHERE organizationId = {org:String}`,
        { org: entry.org },
      );
      const oldest = first?.oldest ?? '';
      const org = selection
        ? createHmac('sha256', selection.salt).update(entry.org).digest('hex').slice(0, 8)
        : `rank${rank}`;
      const scope = { organizationId: entry.org };
      const cells = options.cache === 'off' ? RETRY_CELLS.map(c => ({ ...c, endDaysAgo: 0 })) : RETRY_CELLS;
      for (const cell of cells) {
        const end = now - cell.endDaysAgo * DAY;
        const timeRange = { from: new Date(end - cell.days * DAY).toISOString(), to: new Date(end).toISOString() };
        const call =
          cell.op === 'list:25'
            ? () =>
                mods.query.queryTraces(
                  client,
                  mods.queryPlan.planPlatformTraceQuery({ timeRange, pagination: { page: 0, perPage: 25 } }, scope),
                )
            : () =>
                mods.run.aggregateTraces(
                  client,
                  mods.plan.planPlatformTraceAggregate(
                    {
                      timeRange,
                      groupBy: ['entityName'],
                      measures: GROUPED_VIEW,
                      orderBy: { field: 'count', direction: 'desc' },
                      limit: 50,
                    },
                    scope,
                    [],
                  ),
                  usage,
                );
        const r = await measured(state, options.cache === 'off' ? COLD : {}, call);
        const stats = await fetchStats(raw, r.queryIds);
        const record = {
          at: new Date().toISOString(),
          cache: options.cache,
          rank,
          org,
          rootsOldest: oldest.slice(0, 10),
          ...cell,
          ok: r.ok,
          errorCode: r.errorCode,
          wallMs: Math.round(r.wallMs),
          queries: r.queryIds.map(id => stats.get(id)).filter((q): q is QueryStat => !!q),
        };
        appendFileSync(RETRY_OUT, `${JSON.stringify(record)}\n`);
        const attempts = record.queries.map(
          q => `${q.exc ? `✗${q.exc}` : 'ok'} ${q.durationMs}ms src ${q.sourceMiB}/cache ${q.cacheMiB}MiB`,
        );
        console.log(
          `#${rank} ${cell.op} ${cell.days}d -${cell.endDaysAgo}d ${r.ok ? 'OK' : `FAIL ${r.errorCode}`} ${record.wallMs}ms | ${attempts.join(' ; ')}`,
        );
      }
    }
  } finally {
    await raw.close();
  }
}

async function main() {
  installOutputRedaction();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      platform: { type: 'string', default: '/tmp/platform-516/servers/mobs-query' },
      projects: { type: 'string', default: 'p99,largest' },
      scopes: { type: 'string', default: 'project,org' },
      groups: { type: 'string', default: 'A,B' },
      cases: { type: 'string' },
      reps: { type: 'string', default: '3' },
      variants: { type: 'string' },
      ranks: { type: 'string', default: '1,2,3,8' },
      cache: { type: 'string', default: 'cold-window' },
    },
  });
  const options: Options = {
    platform: values.platform!,
    reps: Number(values.reps),
    scopes: values.scopes!.split(',') as Scope[],
    roles: new Set(values.projects!.split(',')),
    groups: new Set(values.groups!.split(',')),
    ...(values.cases ? { cases: new Set(values.cases.split(',')) } : {}),
    ...(values.variants ? { variants: values.variants.split(',') as Variant[] } : {}),
  };
  const command = positionals[0];
  if (command === 'sizes') await sizes(options);
  else if (command === 'run') await run(options);
  else if (command === 'parity') await parity(options);
  else if (command === 'cold') await coldControl(options);
  else if (command === 'retry')
    await retryRun({
      ...options,
      ranks: values.ranks!.split(',').map(Number),
      cache: values.cache === 'off' ? 'off' : 'cold-window',
    });
  else if (command === 'report') report();
  else throw new Error('usage: mobs-live.ts sizes|run|parity|cold|retry|report');
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
