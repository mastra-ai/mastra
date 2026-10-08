/**
 * A/B of Platform's read settings (platform#3407) on mobs-query's own read paths, against the read-only
 * replica. Each operation calls mobs-query's real service function, so the SQL is exactly what the
 * service sends; only the client is swapped for a guarded one that adds the variant's settings:
 *
 *   A (today)  server defaults (read-ahead pool 200), 60 s safety cap
 *   B (PR)     filesystem_prefetches_limit=8, max_execution_time=9, timeout_overflow_mode=throw
 *
 * Results are streamed and counted, never printed. Trace/span ids, scorer ids and feedback types are
 * picked from the project's own first page in memory only. Output: bucket + hash + metrics.
 *
 *   npx tsx mobs-ab.ts run [--platform <mobs-query dir>] [--reps 3] [--only op,op]
 *   npx tsx mobs-ab.ts report
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { ClickHouseLogLevel, createClient } from '@clickhouse/client';
import type { ClickHouseClient, ClickHouseSettings, QueryParams } from '@clickhouse/client';

import { assertReadOnlyStatement } from './client';
import { installOutputRedaction, loadCredentials, registerSensitive } from './env';
import { loadSelection } from './profile';
import type { SelectedProject } from './profile';
import { PREFLIGHT_FILE, RESULTS_DIR } from './run';

const OUT = join(RESULTS_DIR, 'mobs-ab.jsonl');
const ALL_LOG = `clusterAllReplicas('all_groups.default', system.query_log)`;
const OBS_TABLES = `['mastra_trace_roots', 'mastra_trace_branches', 'mastra_span_events', 'mastra_metric_events', 'mastra_score_events', 'mastra_feedback_events', 'mastra_log_events']`;
const GAP_MS = 150;

type Variant = 'A' | 'B';
const VARIANTS: Record<Variant, ClickHouseSettings> = {
  A: { max_execution_time: 60, timeout_overflow_mode: 'throw' },
  B: { filesystem_prefetches_limit: '8', max_execution_time: 9, timeout_overflow_mode: 'throw' },
};

interface CallRecord {
  runId: string;
  op: string;
  bucket: string;
  hash: string;
  variant: Variant;
  phase: 'cold' | 'warm';
  rep: number;
  ok: boolean;
  errorCode?: string;
  wallMs: number;
  queries: QueryStat[];
}

interface QueryStat {
  durationMs: number;
  memMiB: number;
  readRows: number;
  readMiB: number;
  sourceMiB: number;
  exc: number;
  nqh: string;
}

// ---------------------------------------------------------------------------
// Guarded client handed to mobs-query's service functions
// ---------------------------------------------------------------------------

interface Tagged {
  variant: Variant;
  cold: boolean;
  queryIds: string[];
}

function guardedClient(raw: ClickHouseClient, state: { current?: Tagged }): ClickHouseClient {
  const query = (params: QueryParams) => {
    assertReadOnlyStatement(params.query);
    const tag = state.current;
    if (!tag) throw new Error('query outside a measured call');
    const queryId = randomUUID();
    tag.queryIds.push(queryId);
    return raw.query({
      ...params,
      query_id: queryId,
      clickhouse_settings: {
        ...params.clickhouse_settings,
        ...VARIANTS[tag.variant],
        use_query_cache: 0,
        max_bytes_to_read: String(50e9),
        read_overflow_mode: 'throw',
        log_comment: `aqa-bench:mobs-ab:${tag.variant}`,
        ...(tag.cold ? { enable_filesystem_cache: 0 } : {}),
      },
    });
  };
  return new Proxy(raw, {
    get(target, prop) {
      if (prop === 'query') return query;
      if (prop === 'close') return () => Promise.resolve();
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      throw new Error(`mobs-ab: client method ${String(prop)} is not allowed`);
    },
  }) as ClickHouseClient;
}

async function drain(value: unknown): Promise<void> {
  if (value && typeof value === 'object' && 'rows' in value) {
    const rows = (value as { rows: unknown }).rows;
    if (rows && typeof rows === 'object' && Symbol.asyncIterator in rows) {
      for await (const _ of rows as AsyncIterable<unknown>) void _;
    }
  }
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

type Mods = Awaited<ReturnType<typeof loadPlatform>>;

interface Ctx {
  mods: Mods;
  deps: { clickhouseClient: ClickHouseClient };
  scope: { organizationId: string; projectId: string };
  /** Picked from the project's own data in memory; undefined when the project has none. */
  traceId?: string;
  spanId?: string;
  deltaCursor?: string;
  scorerId?: string;
  feedbackType?: string;
  since7d: string;
  since24h: string;
}

interface Op {
  id: string;
  /** Runs on every selected project; the rest run on one representative project per bucket. */
  everyProject?: boolean;
  needs?: Array<'traceId' | 'spanId' | 'deltaCursor' | 'scorerId' | 'feedbackType'>;
  run: (ctx: Ctx) => Promise<unknown>;
}

const URL_BASE = 'http://localhost/x';

function listRequest(ctx: Ctx, parse: (url: string) => { args: { filters?: unknown }; mode: unknown }, qs: string) {
  const request = parse(`${URL_BASE}?${qs}`);
  return {
    ...request,
    args: {
      ...request.args,
      filters: ctx.mods.obs.applyScopeToFilters(request.args.filters as Record<string, unknown>, ctx.scope),
    },
  };
}

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

const OPS: Op[] = [
  {
    id: 'traces_light_page',
    everyProject: true,
    run: c => c.mods.obs.listTracesLight(c.deps, listRequest(c, c.mods.obs.parseListTracesArgs, 'page=0&perPage=25')),
  },
  {
    id: 'traces_light_7d',
    everyProject: true,
    run: c =>
      c.mods.obs.listTracesLight(
        c.deps,
        listRequest(
          c,
          c.mods.obs.parseListTracesArgs,
          `page=0&perPage=25&filters=${json({ startedAt: { start: c.since7d } })}`,
        ),
      ),
  },
  {
    id: 'traces_full_page',
    everyProject: true,
    run: c => c.mods.obs.listTraces(c.deps, listRequest(c, c.mods.obs.parseListTracesArgs, 'page=0&perPage=25')),
  },
  {
    id: 'traces_light_delta_head',
    everyProject: true,
    run: c =>
      c.mods.obs.listTracesLight(c.deps, listRequest(c, c.mods.obs.parseListTracesArgs, 'mode=delta&limit=100')),
  },
  {
    id: 'traces_light_delta_poll',
    everyProject: true,
    needs: ['deltaCursor'],
    run: c =>
      c.mods.obs.listTracesLight(
        c.deps,
        listRequest(
          c,
          c.mods.obs.parseListTracesArgs,
          `mode=delta&limit=100&after=${encodeURIComponent(c.deltaCursor!)}`,
        ),
      ),
  },
  {
    id: 'branches_page',
    everyProject: true,
    run: c => c.mods.obs.listBranches(c.deps, listRequest(c, c.mods.obs.parseListBranchesArgs, 'page=0&perPage=25')),
  },
  {
    id: 'get_trace',
    everyProject: true,
    needs: ['traceId'],
    run: c => c.mods.obs.getScopedTrace(c.deps, c.traceId!, c.scope),
  },
  {
    id: 'get_trace_light',
    everyProject: true,
    needs: ['traceId'],
    run: c => c.mods.obs.getScopedTraceLight(c.deps, c.traceId!, c.scope),
  },
  { id: 'get_trajectory', needs: ['traceId'], run: c => c.mods.obs.getScopedTrajectory(c.deps, c.traceId!, c.scope) },
  {
    id: 'get_branch',
    needs: ['traceId', 'spanId'],
    run: c => c.mods.obs.getScopedBranch(c.deps, { traceId: c.traceId!, spanId: c.spanId! }, c.scope),
  },
  {
    id: 'get_span',
    needs: ['traceId', 'spanId'],
    run: c => c.mods.obs.getScopedSpan(c.deps, c.traceId!, c.spanId!, c.scope),
  },
  {
    id: 'legacy_scores_by_span',
    needs: ['traceId', 'spanId'],
    run: c =>
      c.mods.obs.listLegacyScoresBySpan(c.deps, {
        traceId: c.traceId!,
        spanId: c.spanId!,
        scope: c.scope,
        pagination: { page: 0, perPage: 10 },
      }),
  },
  {
    id: 'logs_page',
    run: c => c.mods.obs.listLogs(c.deps, listRequest(c, c.mods.obs.parseListLogsArgs, 'page=0&perPage=25')),
  },
  {
    id: 'metrics_page',
    run: c => c.mods.obs.listMetrics(c.deps, listRequest(c, c.mods.obs.parseListMetricsArgs, 'page=0&perPage=25')),
  },
  {
    id: 'scores_page',
    run: c => c.mods.obs.listScores(c.deps, c.mods.obs.parseListScoresArgs(`${URL_BASE}?page=0&perPage=25`), c.scope),
  },
  {
    id: 'feedback_page',
    run: c => c.mods.obs.listFeedback(c.deps, listRequest(c, c.mods.obs.parseListFeedbackArgs, 'page=0&perPage=25')),
  },
  { id: 'disc_entity_types', run: c => c.mods.obs.getDiscoveryEntityTypes(c.deps, c.scope) },
  { id: 'disc_entity_names', run: c => c.mods.obs.getDiscoveryEntityNames(c.deps, c.scope, URL_BASE) },
  { id: 'disc_service_names', run: c => c.mods.obs.getDiscoveryServiceNames(c.deps, c.scope) },
  { id: 'disc_environments', run: c => c.mods.obs.getDiscoveryEnvironments(c.deps, c.scope) },
  { id: 'disc_tags', run: c => c.mods.obs.getDiscoveryTags(c.deps, c.scope, URL_BASE) },
  { id: 'disc_metric_names', run: c => c.mods.obs.getDiscoveryMetricNames(c.deps, c.scope, URL_BASE) },
  ...(['24h', '7d'] as const).flatMap((window): Op[] => {
    const filters = (c: Ctx) => ({ timestamp: { start: window === '24h' ? c.since24h : c.since7d } });
    const name = ['mastra_model_total_input_tokens'];
    return [
      {
        id: `metric_aggregate_${window}`,
        run: c =>
          c.mods.metrics.getMetricAggregate(
            c.deps.clickhouseClient,
            c.mods.schemas.getMetricAggregateArgsSchema.parse({ name, aggregation: 'sum', filters: filters(c) }),
            c.scope,
          ),
      },
      {
        id: `metric_breakdown_${window}`,
        run: c =>
          c.mods.metrics.getMetricBreakdown(
            c.deps.clickhouseClient,
            c.mods.schemas.getMetricBreakdownArgsSchema.parse({
              name,
              aggregation: 'sum',
              groupBy: ['entityName'],
              filters: filters(c),
            }),
            c.scope,
          ),
      },
      {
        id: `metric_timeseries_${window}`,
        run: c =>
          c.mods.metrics.getMetricTimeSeries(
            c.deps.clickhouseClient,
            c.mods.schemas.getMetricTimeSeriesArgsSchema.parse({
              name,
              aggregation: 'sum',
              interval: '1h',
              filters: filters(c),
            }),
            c.scope,
          ),
      },
      {
        id: `metric_percentiles_${window}`,
        run: c =>
          c.mods.metrics.getMetricPercentiles(
            c.deps.clickhouseClient,
            c.mods.schemas.getMetricPercentilesArgsSchema.parse({
              name: name[0],
              percentiles: [0.5, 0.95],
              interval: '1h',
              filters: filters(c),
            }),
            c.scope,
          ),
      },
    ];
  }),
  {
    id: 'score_aggregate',
    needs: ['scorerId'],
    run: c =>
      c.mods.scores.getScoreAggregate(
        c.deps.clickhouseClient,
        c.mods.schemas.getScoreAggregateArgsSchema.parse({ scorerId: c.scorerId, aggregation: 'avg' }),
        c.scope,
      ),
  },
  {
    id: 'score_timeseries',
    needs: ['scorerId'],
    run: c =>
      c.mods.scores.getScoreTimeSeries(
        c.deps.clickhouseClient,
        c.mods.schemas.getScoreTimeSeriesArgsSchema.parse({ scorerId: c.scorerId, aggregation: 'avg', interval: '1h' }),
        c.scope,
      ),
  },
  {
    id: 'feedback_aggregate',
    needs: ['feedbackType'],
    run: c =>
      c.mods.feedback.getFeedbackAggregate(
        c.deps.clickhouseClient,
        c.mods.schemas.getFeedbackAggregateArgsSchema.parse({ feedbackType: c.feedbackType, aggregation: 'count' }),
        c.scope,
      ),
  },
];

// ---------------------------------------------------------------------------
// Platform modules (resolved from the mobs-query checkout so its own dependencies load)
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any -- the Platform modules are loaded dynamically from another repo */
async function loadPlatform(dir: string) {
  const load = (path: string) => import(pathToFileURL(join(dir, path)).href) as Promise<any>;
  const require = createRequire(join(dir, 'package.json'));
  return {
    obs: await load('src/services/observability.ts'),
    metrics: await load('src/services/metrics-aggregations.ts'),
    scores: await load('src/services/scores-aggregations.ts'),
    feedback: await load('src/services/feedback-aggregations.ts'),
    schemas: (await import(pathToFileURL(require.resolve('@mastra/core/storage')).href)) as any,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function measuredCall(
  state: { current?: Tagged },
  op: Op,
  ctx: Ctx,
  variant: Variant,
  cold: boolean,
): Promise<{ ok: boolean; errorCode?: string; wallMs: number; queryIds: string[]; value?: unknown }> {
  const tag: Tagged = { variant, cold, queryIds: [] };
  state.current = tag;
  const started = performance.now();
  try {
    const value = await op.run(ctx);
    await drain(value);
    return { ok: true, wallMs: performance.now() - started, queryIds: tag.queryIds, value };
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    return {
      ok: false,
      errorCode: code === undefined ? 'client' : String(code),
      wallMs: performance.now() - started,
      queryIds: tag.queryIds,
    };
  } finally {
    state.current = undefined;
    await sleep(GAP_MS);
  }
}

async function rows<T>(raw: ClickHouseClient, sql: string, params: Record<string, unknown>): Promise<T[]> {
  assertReadOnlyStatement(sql);
  const result = await raw.query({
    query: sql,
    query_params: params,
    format: 'JSONEachRow',
    clickhouse_settings: {
      log_comment: 'aqa-bench:mobs-ab:meta',
      max_execution_time: 60,
      output_format_json_quote_64bit_integers: 0,
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
      `SELECT query_id AS id, query_duration_ms AS durationMs, round(memory_usage / 1048576, 1) AS memMiB, read_rows AS readRows,
              round(read_bytes / 1048576, 2) AS readMiB,
              round(ProfileEvents['CachedReadBufferReadFromSourceBytes'] / 1048576, 2) AS sourceMiB,
              exception_code AS exc, toString(normalized_query_hash) AS nqh
       FROM ${ALL_LOG}
       WHERE event_date >= yesterday() AND type IN ('QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart')
         AND query_id IN {ids:Array(String)}`,
      { ids: missing },
    );
    for (const { id, ...stat } of got) found.set(id, stat);
  }
  return found;
}

/** In-memory inputs for detail operations: the newest trace, one of its spans, a delta cursor, a scorer and a feedback type. */
async function pickInputs(state: { current?: Tagged }, ctx: Ctx): Promise<void> {
  state.current = { variant: 'A', cold: false, queryIds: [] };
  try {
    const page = await ctx.mods.obs.listTracesLight(
      ctx.deps,
      listRequest(ctx, ctx.mods.obs.parseListTracesArgs, 'page=0&perPage=25'),
    );
    for await (const row of page.rows as AsyncIterable<{ traceId?: string }>) ctx.traceId ??= row.traceId;
    if (ctx.traceId) {
      const trace = await ctx.mods.obs.getScopedTraceLight(ctx.deps, ctx.traceId, ctx.scope);
      const spans: Array<{ spanId?: string; parentSpanId?: string | null }> = [];
      if (trace)
        for await (const row of trace.rows as AsyncIterable<{ spanId?: string; parentSpanId?: string | null }>)
          spans.push(row);
      ctx.spanId = (spans.find(s => s.parentSpanId) ?? spans[0])?.spanId;
    }
    const head = await ctx.mods.obs.listTracesLight(
      ctx.deps,
      listRequest(ctx, ctx.mods.obs.parseListTracesArgs, 'mode=delta&limit=100'),
    );
    await drain(head);
    ctx.deltaCursor = head.deltaCursor;
    const scores = await ctx.mods.obs.listScores(
      ctx.deps,
      ctx.mods.obs.parseListScoresArgs(`${URL_BASE}?page=0&perPage=25`),
      ctx.scope,
    );
    for await (const row of scores.rows as AsyncIterable<{ scorerId?: string }>) ctx.scorerId ??= row.scorerId;
    const feedback = await ctx.mods.obs.listFeedback(
      ctx.deps,
      listRequest(ctx, ctx.mods.obs.parseListFeedbackArgs, 'page=0&perPage=25'),
    );
    for await (const row of feedback.rows as AsyncIterable<{ feedbackType?: string }>)
      ctx.feedbackType ??= row.feedbackType;
  } finally {
    state.current = undefined;
  }
  registerSensitive([ctx.traceId, ctx.spanId, ctx.deltaCursor, ctx.scorerId, ctx.feedbackType]);
}

function doneKeys(): Set<string> {
  if (!existsSync(OUT)) return new Set();
  return new Set(
    readFileSync(OUT, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as CallRecord)
      .map(r => `${r.op}|${r.hash}`),
  );
}

async function run(options: { platform: string; reps: number; only?: Set<string> }) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const database = (JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string }).database;
  const credentials = loadCredentials();
  const raw = createClient({
    url: credentials.origin,
    username: credentials.username,
    password: credentials.password,
    database,
    request_timeout: 120_000,
    // Services hold a row stream open while issuing a second query (count, payload), so one socket deadlocks.
    max_open_connections: 4,
    log: { level: ClickHouseLogLevel.OFF },
  });
  const state: { current?: Tagged } = {};
  const deps = { clickhouseClient: guardedClient(raw, state) };
  const mods = await loadPlatform(options.platform);
  const runId = randomUUID().slice(0, 8);
  const done = doneKeys();
  let consecutiveErrors = 0;

  try {
    for (const project of selection.projects as SelectedProject[]) {
      const ops = OPS.filter(
        op => (op.everyProject || project.representative) && (!options.only || options.only.has(op.id)),
      );
      if (ops.every(op => done.has(`${op.id}|${project.hash}`))) continue;
      const ctx: Ctx = {
        mods,
        deps,
        scope: { organizationId: project.organizationId, projectId: project.projectId },
        since7d: ago(7 * 86_400_000),
        since24h: ago(86_400_000),
      };
      await pickInputs(state, ctx);
      console.log(`${project.bucket}/${project.hash}: ${ops.length} ops`);

      // query_log flushes every few seconds; collect each project's stats once, after all its calls.
      const pending: Array<{
        op: Op;
        calls: Array<
          { variant: Variant; phase: 'cold' | 'warm'; rep: number } & Awaited<ReturnType<typeof measuredCall>>
        >;
      }> = [];
      for (const op of ops) {
        if (done.has(`${op.id}|${project.hash}`)) continue;
        if (op.needs?.some(key => ctx[key] === undefined)) {
          console.log(`  ${op.id}: skipped (project has no ${op.needs.filter(k => ctx[k] === undefined).join(', ')})`);
          continue;
        }
        // Cold first (cache bypassed, so neither cold run warms the other), then one unmeasured warm-up,
        // then warm repetitions alternating A/B so drift affects both equally.
        const plan: Array<{ variant: Variant; phase: 'cold' | 'warm'; rep: number }> = [
          ...(['A', 'B'] as const).map(variant => ({ variant, phase: 'cold' as const, rep: 0 })),
          ...Array.from({ length: options.reps }, (_, i) =>
            (i % 2 === 0 ? (['A', 'B'] as const) : (['B', 'A'] as const)).map(variant => ({
              variant,
              phase: 'warm' as const,
              rep: i + 1,
            })),
          ).flat(),
        ];
        await measuredCall(state, op, ctx, 'A', false);
        const calls: (typeof pending)[number]['calls'] = [];
        for (const step of plan)
          calls.push({ ...step, ...(await measuredCall(state, op, ctx, step.variant, step.phase === 'cold')) });
        pending.push({ op, calls });

        const failures = calls.filter(c => !c.ok);
        const unexpected = failures.filter(c => c.errorCode !== '159' && c.errorCode !== '241');
        consecutiveErrors = unexpected.length === calls.length ? consecutiveErrors + 1 : 0;
        console.log(
          `  ${op.id}: ${calls.length - failures.length}/${calls.length} ok${failures.length ? ` (codes ${[...new Set(failures.map(f => f.errorCode))].join(',')})` : ''}`,
        );
        if (consecutiveErrors >= 3)
          throw new Error('Aborting: three operations failed every call with non-limit errors');
      }

      const ids = pending.flatMap(p => p.calls.flatMap(c => c.queryIds));
      const stats = await fetchStats(raw, ids);
      if (stats.size < ids.length)
        console.log(`  query_log: ${ids.length - stats.size} of ${ids.length} queries not found`);
      for (const { op, calls } of pending) {
        for (const call of calls) {
          const record: CallRecord = {
            runId,
            op: op.id,
            bucket: project.bucket,
            hash: project.hash,
            variant: call.variant,
            phase: call.phase,
            rep: call.rep,
            ok: call.ok,
            ...(call.errorCode ? { errorCode: call.errorCode } : {}),
            wallMs: Math.round(call.wallMs),
            queries: call.queryIds.map(id => stats.get(id)).filter((s): s is QueryStat => !!s),
          };
          appendFileSync(OUT, `${JSON.stringify(record)}\n`);
        }
      }
    }
  } finally {
    await raw.close();
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const median = (xs: number[]) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const callMs = (r: CallRecord) => sum(r.queries.map(q => q.durationMs));
const callMiB = (r: CallRecord) => Math.max(0, ...r.queries.map(q => q.memMiB));

async function report() {
  const records = readFileSync(OUT, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as CallRecord);

  const ops = [...new Set(records.map(r => r.op))];
  const buckets = ['small', 'mid', 'p90', 'p99', 'largest'];
  const table: Array<Record<string, string | number>> = [];
  for (const op of ops) {
    for (const bucket of buckets) {
      const rs = records.filter(r => r.op === op && r.bucket === bucket);
      if (rs.length === 0) continue;
      const pick = (variant: Variant, phase: 'cold' | 'warm') =>
        rs.filter(r => r.variant === variant && r.phase === phase);
      const fmt = (xs: number[]) => (xs.length ? Math.round(median(xs)) : '-');
      const failed = (variant: Variant) =>
        rs
          .filter(r => r.variant === variant && !r.ok)
          .map(r => r.errorCode)
          .join(',') || '';
      table.push({
        op,
        bucket,
        n: rs.length,
        warmMsA: fmt(
          pick('A', 'warm')
            .filter(r => r.ok)
            .map(callMs),
        ),
        warmMsB: fmt(
          pick('B', 'warm')
            .filter(r => r.ok)
            .map(callMs),
        ),
        warmMiBA: fmt(
          pick('A', 'warm')
            .filter(r => r.ok)
            .map(callMiB),
        ),
        warmMiBB: fmt(
          pick('B', 'warm')
            .filter(r => r.ok)
            .map(callMiB),
        ),
        coldMsA: fmt(
          pick('A', 'cold')
            .filter(r => r.ok)
            .map(callMs),
        ),
        coldMsB: fmt(
          pick('B', 'cold')
            .filter(r => r.ok)
            .map(callMs),
        ),
        maxMsA: Math.max(0, ...rs.filter(r => r.variant === 'A').map(callMs)),
        maxMsB: Math.max(0, ...rs.filter(r => r.variant === 'B').map(callMs)),
        failA: failed('A'),
        failB: failed('B'),
      });
    }
  }
  console.table(table);

  // How much of Platform's real observability read traffic these shapes cover.
  if (process.argv.includes('--traffic')) {
    const credentials = loadCredentials();
    const database = (JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string }).database;
    const raw = createClient({
      url: credentials.origin,
      username: credentials.username,
      password: credentials.password,
      database,
      log: { level: ClickHouseLogLevel.OFF },
    });
    try {
      const hashes = new Map<string, Set<string>>();
      for (const r of records)
        for (const q of r.queries) (hashes.get(q.nqh) ?? hashes.set(q.nqh, new Set()).get(q.nqh)!).add(r.op);
      const reads = `type IN ('QueryFinish', 'ExceptionWhileProcessing') AND event_date >= today() - 3 AND query_kind = 'Select' AND is_initial_query
        AND NOT startsWith(log_comment, 'aqa-bench') AND hasAny(arrayMap(t -> splitByChar('.', t)[-1], tables), ${OBS_TABLES})
        -- mobs-query's fingerprint: its CLICKHOUSE_SETTINGS (ISO output in the client time zone). Agent Learning's
        -- trace reader (row-capped) and other services read with different settings and are not measured here.
        AND Settings['date_time_output_format'] = 'iso' AND Settings['use_client_time_zone'] = '1'`;
      const byHash = await rows<{ nqh: string; queries: number; p50MiB: number; p99MiB: number; p99ms: number }>(
        raw,
        `SELECT toString(normalized_query_hash) AS nqh, count() AS queries, round(quantile(0.5)(memory_usage) / 1048576) AS p50MiB,
                round(quantile(0.99)(memory_usage) / 1048576) AS p99MiB, quantile(0.99)(query_duration_ms) AS p99ms
         FROM ${ALL_LOG} WHERE ${reads} GROUP BY nqh ORDER BY queries DESC`,
        {},
      );
      const total = sum(byHash.map(h => h.queries));
      const covered = byHash.filter(h => hashes.has(h.nqh));
      console.log(
        `mobs-query observability reads (3 days): ${total}; shapes covered by this A/B: ${sum(covered.map(h => h.queries))} (${((100 * sum(covered.map(h => h.queries))) / total).toFixed(1)}%)`,
      );
      console.table(
        covered.slice(0, 25).map(h => ({
          ops: [...hashes.get(h.nqh)!].join(','),
          queries: h.queries,
          p50MiB: h.p50MiB,
          p99MiB: h.p99MiB,
          p99ms: h.p99ms,
        })),
      );
      const uncovered = byHash.filter(h => !hashes.has(h.nqh)).slice(0, 15);
      const features = await rows<{ nqh: string; tbls: string; agent: string; cols: number }>(
        raw,
        `SELECT toString(normalized_query_hash) AS nqh, arrayStringConcat(arraySort(arrayDistinct(arrayMap(t -> splitByChar('.', t)[-1], any(tables)))), ',') AS tbls,
                splitByChar(' ', any(http_user_agent))[1] AS agent, length(any(columns)) AS cols
         FROM ${ALL_LOG} WHERE ${reads} AND toString(normalized_query_hash) IN {ids:Array(String)} GROUP BY nqh`,
        { ids: uncovered.map(h => h.nqh) },
      );
      const featureOf = new Map(features.map(f => [f.nqh, f]));
      console.log('Largest uncovered shapes:');
      console.table(
        uncovered.map(h => ({
          queries: h.queries,
          p50MiB: h.p50MiB,
          p99MiB: h.p99MiB,
          p99ms: h.p99ms,
          tables: featureOf.get(h.nqh)?.tbls,
          agent: featureOf.get(h.nqh)?.agent,
          cols: featureOf.get(h.nqh)?.cols,
        })),
      );
    } finally {
      await raw.close();
    }
  }
}

installOutputRedaction();
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    platform: { type: 'string', default: '/tmp/platform-obs-590/servers/mobs-query' },
    reps: { type: 'string', default: '3' },
    only: { type: 'string' },
    traffic: { type: 'boolean', default: false },
  },
});
if (positionals[0] === 'run') {
  await run({
    platform: values.platform!,
    reps: Number(values.reps),
    only: values.only ? new Set(values.only.split(',')) : undefined,
  });
} else if (positionals[0] === 'report') {
  await report();
} else {
  console.log('usage: npx tsx mobs-ab.ts run|report');
}
