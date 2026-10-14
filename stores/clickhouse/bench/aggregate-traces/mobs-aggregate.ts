/**
 * X41 (OBS-515): Platform `aggregateTraces()` on mobs-query against the read-only replica. Every cell
 * compiles the request with mobs-query's own planner and compiler (imported from --platform), so the
 * SQL is exactly what `POST /traces/aggregate` sends.
 *
 * Two arms per cell, both at max_threads=16 (the prod server default):
 *   measure  the compiled statement with mobs-query's settings but a 4 GiB / 60 s ceiling, so the
 *            peak and duration past the caps are visible
 *   prod     `aggregateTraces()` itself: 1 GiB, 9 s, client-side abort (one warm call)
 *
 * Requests (see REQUESTS): A count+errorRate by entityName per day; B count+p95 by entityName with
 * having/orderBy; C spans.some(tool_call > 1 s) by the project's top metadata key + threads;
 * D tokens/cost by entityName per day (variants D0 usage table only, D1 fallback bounded by the
 * selection, D2 fallback bounded by tenant + window); E ungrouped count, checked against the
 * `queryTraces()` page total.
 *
 * Output: bucket, hash, scope, window, request, metrics. No ids, keys, rows or counts are printed.
 *
 *   npx tsx mobs-aggregate.ts run --platform <mobs-query dir> --label main [--scopes project,org]
 *       [--windows 7d,30d] [--projects p90,p99,heavy-p99,largest] [--requests A,B,C,D,E] [--reps 3]
 *   npx tsx mobs-aggregate.ts report
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
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

const OUT = join(RESULTS_DIR, 'mobs-aggregate.jsonl');
const ALL_LOG = `clusterAllReplicas('all_groups.default', system.query_log)`;
const DAY = 86_400_000;
const GiB = 1024 ** 3;
const MEASURE: ClickHouseSettings = { max_memory_usage: String(4 * GiB), max_execution_time: 60 };

/** Projects by role. heavy-p99 is the p99 project with the most span rows per trace. */
type Role = 'p90' | 'p99' | 'heavy-p99' | 'largest';
type Scope = 'project' | 'org';
type Variant = 'D0' | 'D1' | 'D2';
const USAGE: Record<Variant, { fallback: boolean; bound: 'candidates' | 'window' }> = {
  D0: { fallback: false, bound: 'candidates' },
  D1: { fallback: true, bound: 'candidates' },
  D2: { fallback: true, bound: 'window' },
};

interface Tag {
  queryIds: string[];
  cold: boolean;
  settings: ClickHouseSettings;
}

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
  label: string;
  role: Role;
  hash: string;
  scope: Scope;
  window: string;
  request: string;
  arm: 'measure' | 'prod';
  phase: 'cold' | 'warm';
  rep: number;
  ok: boolean;
  errorCode?: string;
  wallMs: number;
  /** E only: aggregate count equals the queryTraces page total (30 days at most). */
  parity?: boolean;
  queries: QueryStat[];
}

function guardedClient(raw: ClickHouseClient, state: { current?: Tag }): ClickHouseClient {
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
        max_threads: 16,
        ...tag.settings,
        log_comment: 'aqa-bench:mobs-aggregate',
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
      throw new Error(`mobs-aggregate: client method ${String(prop)} is not allowed`);
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
    queryPlan: await load('src/services/trace-query-plan.ts'),
    query: await load('src/services/trace-query.ts'),
    obs: await load('src/services/observability.ts'),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
type Mods = Awaited<ReturnType<typeof loadPlatform>>;

const longTool = {
  op: 'and',
  args: [
    { op: 'eq', left: { path: 'spanType' }, right: { literal: 'tool_call' } },
    { op: 'gt', left: { path: 'durationMs' }, right: { literal: 1000 } },
  ],
};

const REQUESTS: Record<string, (metadataKey: string | undefined) => Record<string, unknown>> = {
  // limit 50 keeps limit × buckets under the 10,000-row cap at 180 days.
  A: () => ({ measures: ['count', 'errorRate'], groupBy: ['entityName'], interval: '1d', limit: 50 }),
  B: () => ({
    measures: ['count', 'duration.p95'],
    groupBy: ['entityName'],
    having: { op: 'gt', left: { path: 'count' }, right: { literal: 10 } },
    orderBy: { field: 'duration.p95', direction: 'desc' },
    limit: 10,
  }),
  C: key => ({
    where: { spans: { some: longTool } },
    measures: ['count', 'countDistinct.threadId'],
    groupBy: [key ? `metadata.${key}` : 'entityName'],
  }),
  D: () => ({
    measures: ['tokens.input.sum', 'tokens.output.sum', 'cost.sum'],
    groupBy: ['entityName'],
    interval: '1d',
    orderBy: { field: 'cost.sum', direction: 'desc' },
    limit: 50,
  }),
  E: () => ({ measures: ['count'] }),
};

function pickProjects(projects: SelectedProject[]): Array<[Role, SelectedProject]> {
  const of = (bucket: string) => projects.filter(p => p.bucket === bucket);
  const perTrace = (p: SelectedProject) => (p.stats.spans30d ?? 0) / Math.max(1, p.stats.traces30d);
  const p99 = of('p99');
  // The p90 representative has no token rows; take the p90 project that has them so D measures something.
  const p90 = of('p90').sort((a, b) => (b.stats.tokenRows30d ?? 0) - (a.stats.tokenRows30d ?? 0))[0];
  const heavy = [...p99].sort((a, b) => perTrace(b) - perTrace(a))[0];
  const p99rep = p99.find(p => p.representative && p !== heavy) ?? p99.find(p => p !== heavy);
  const largest = of('largest').find(p => p.representative);
  const out: Array<[Role, SelectedProject | undefined]> = [
    ['p90', p90],
    ['p99', p99rep],
    ['heavy-p99', heavy],
    ['largest', largest],
  ];
  return out.filter((e): e is [Role, SelectedProject] => !!e[1]);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function measured<T>(
  state: { current?: Tag },
  cold: boolean,
  settings: ClickHouseSettings,
  fn: () => Promise<T>,
): Promise<{ ok: boolean; errorCode?: string; wallMs: number; queryIds: string[]; value?: T }> {
  const tag: Tag = { queryIds: [], cold, settings };
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
    clickhouse_settings: { log_comment: 'aqa-bench:mobs-aggregate:meta', max_execution_time: 60 },
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
              exception_code AS exc
       FROM ${ALL_LOG}
       WHERE event_date >= yesterday() AND type IN ('QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart')
         AND query_id IN {ids:Array(String)}`,
      { ids: missing },
    );
    for (const { id, ...stat } of got) found.set(id, stat);
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

function doneKeys(): Set<string> {
  if (!existsSync(OUT)) return new Set();
  return new Set(
    readFileSync(OUT, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as CallRecord)
      .map(r => cellKey(r)),
  );
}

const cellKey = (r: Pick<CallRecord, 'label' | 'hash' | 'scope' | 'window' | 'request'>) =>
  `${r.label}|${r.hash}|${r.scope}|${r.window}|${r.request}`;

async function run(options: {
  platform: string;
  label: string;
  reps: number;
  scopes: Scope[];
  windows: string[];
  roles: Set<string>;
  requests: string[];
}) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const database = (JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string }).database;
  const credentials = loadCredentials();
  // mobs-query's own client copy: its compilers pass TupleParam, which a second copy would not recognize.
  const { createClient, ClickHouseLogLevel } = createRequire(join(options.platform, 'package.json'))(
    '@clickhouse/client',
  ) as typeof import('@clickhouse/client');
  const raw = createClient({
    url: credentials.origin,
    username: credentials.username,
    password: credentials.password,
    database,
    request_timeout: 120_000,
    max_open_connections: 4,
    log: { level: ClickHouseLogLevel.OFF },
  });
  const state: { current?: Tag } = {};
  const client = guardedClient(raw, state);
  const mods: Mods = await loadPlatform(options.platform);
  const runId = randomUUID().slice(0, 8);
  const done = doneKeys();
  const to = new Date();

  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      const metadataKey = options.requests.includes('C') ? await topMetadataKey(raw, project) : undefined;
      for (const scopeName of options.scopes) {
        const scope =
          scopeName === 'project'
            ? { organizationId: project.organizationId, projectId: project.projectId }
            : { organizationId: project.organizationId };
        for (const window of options.windows) {
          const days = Number.parseInt(window, 10);
          const timeRange = { from: new Date(to.getTime() - days * DAY).toISOString(), to: to.toISOString() };
          // The fallback variants are compared on the largest project; elsewhere D is the default (D1).
          const requests = options.requests.flatMap(id =>
            id === 'D' ? (role === 'largest' ? ['D0', 'D1', 'D2'] : ['D1']) : [id],
          );
          for (const request of requests) {
            const base = { label: options.label, hash: project.hash, scope: scopeName, window, request };
            if (done.has(cellKey(base))) continue;
            const body = { timeRange, ...REQUESTS[request[0]!]!(metadataKey) };
            const usage = USAGE[request as Variant] ?? USAGE.D1;
            const plan = mods.plan.planPlatformTraceAggregate(body, scope, []);
            const compiled = mods.sql.compileClickHouseTraceAggregate(plan, usage);
            const statement = () =>
              client
                .query({
                  query: compiled.query,
                  query_params: compiled.query_params,
                  format: 'JSONEachRow',
                  clickhouse_settings: { ...mods.obs.CLICKHOUSE_SETTINGS, filesystem_prefetches_limit: '8' },
                })
                .then(r => r.json());

            // Cold, an unmeasured warm-up, then warm repetitions; then the real service call once.
            const calls: Array<Omit<CallRecord, 'queries' | 'runId' | keyof typeof base | 'role'> & { ids: string[] }> =
              [];
            const push = (
              arm: 'measure' | 'prod',
              phase: 'cold' | 'warm',
              rep: number,
              r: Awaited<ReturnType<typeof measured>>,
              parity?: boolean,
            ) =>
              calls.push({
                arm,
                phase,
                rep,
                ok: r.ok,
                ...(r.errorCode ? { errorCode: r.errorCode } : {}),
                wallMs: Math.round(r.wallMs),
                ...(parity === undefined ? {} : { parity }),
                ids: r.queryIds,
              });
            push('measure', 'cold', 0, await measured(state, true, MEASURE, statement));
            await measured(state, false, MEASURE, statement);
            for (let rep = 1; rep <= options.reps; rep++)
              push('measure', 'warm', rep, await measured(state, false, MEASURE, statement));
            const prod = await measured(state, false, {}, () => mods.run.aggregateTraces(client, plan, usage));
            let parity: boolean | undefined;
            if (request === 'E' && prod.ok && days <= 30) {
              const listed = await measured(state, false, {}, () =>
                mods.query.queryTraces(
                  client,
                  mods.queryPlan.planPlatformTraceQuery({ timeRange, pagination: { page: 0, perPage: 1 } }, scope, []),
                ),
              );
              const count =
                (prod.value as { rows: Array<{ measures: { count: number } }> }).rows[0]?.measures.count ?? 0;
              parity = listed.ok
                ? count === (listed.value as { pagination: { total: number } }).pagination.total
                : undefined;
            }
            push('prod', 'warm', 1, prod, parity);

            const ids = calls.flatMap(c => c.ids);
            const stats = await fetchStats(raw, ids);
            for (const { ids: queryIds, ...call } of calls) {
              const record: CallRecord = {
                runId,
                role,
                ...base,
                ...call,
                queries: queryIds.map(id => stats.get(id)).filter((s): s is QueryStat => !!s),
              };
              appendFileSync(OUT, `${JSON.stringify(record)}\n`);
            }
            const warm = calls.filter(c => c.arm === 'measure' && c.phase === 'warm');
            const peaks = warm.map(c =>
              c.ids.map(id => stats.get(id)?.memMiB ?? 0).reduce((a, b) => Math.max(a, b), 0),
            );
            console.log(
              `${options.label} ${role}/${project.hash} ${scopeName} ${window} ${request}: warm peak ${Math.max(...peaks)} MiB, service ${prod.ok ? 'ok' : `fail ${prod.errorCode}`}${parity === undefined ? '' : `, parity ${parity}`}`,
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

function report() {
  const records = readFileSync(OUT, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as CallRecord);
  const cells = new Map<string, CallRecord[]>();
  for (const r of records) cells.set(cellKey(r), [...(cells.get(cellKey(r)) ?? []), r]);
  const peak = (r: CallRecord) => Math.max(0, ...r.queries.map(q => q.memMiB));
  const dur = (r: CallRecord) => r.queries.reduce((a, q) => a + Number(q.durationMs), 0);
  const read = (r: CallRecord) => Math.round(r.queries.reduce((a, q) => a + Number(q.readMiB), 0));
  console.log(
    'label | role | scope | window | req | cold MiB | warm MiB (med/max) | warm ms (med) | read MiB | prod | parity',
  );
  console.log('---|---|---|---|---|---|---|---|---|---|---');
  for (const rs of cells.values()) {
    const r0 = rs[0]!;
    const cold = rs.find(r => r.arm === 'measure' && r.phase === 'cold');
    const warm = rs.filter(r => r.arm === 'measure' && r.phase === 'warm');
    const prod = rs.find(r => r.arm === 'prod');
    const fail = (r?: CallRecord) => (r && !r.ok ? ` (${r.errorCode})` : '');
    console.log(
      [
        r0.label,
        `${r0.role}/${r0.hash}`,
        r0.scope,
        r0.window,
        r0.request,
        `${cold ? peak(cold) : '-'}${fail(cold)}`,
        `${median(warm.map(peak))} / ${Math.max(...warm.map(peak))}${warm.some(r => !r.ok) ? ` (${warm.find(r => !r.ok)!.errorCode})` : ''}`,
        median(warm.map(dur)),
        median(warm.map(read)),
        prod ? (prod.ok ? `ok ${peak(prod)} MiB ${dur(prod)} ms` : `fail ${prod.errorCode}`) : '-',
        prod?.parity === undefined ? '' : String(prod.parity),
      ].join(' | '),
    );
  }
}

installOutputRedaction();
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    platform: { type: 'string', default: '/tmp/platform-515/servers/mobs-query' },
    label: { type: 'string', default: 'main' },
    reps: { type: 'string', default: '3' },
    scopes: { type: 'string', default: 'project,org' },
    windows: { type: 'string', default: '7d,30d' },
    projects: { type: 'string', default: 'p90,p99,heavy-p99,largest' },
    requests: { type: 'string', default: 'A,B,C,D,E' },
  },
});
if (positionals[0] === 'run') {
  await run({
    platform: values.platform,
    label: values.label,
    reps: Number(values.reps),
    scopes: values.scopes.split(',') as Scope[],
    windows: values.windows.split(','),
    roles: new Set(values.projects.split(',')),
    requests: values.requests.split(','),
  });
} else if (positionals[0] === 'report') {
  report();
} else {
  console.error('usage: mobs-aggregate.ts run|report');
  process.exit(1);
}
