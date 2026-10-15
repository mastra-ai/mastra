/**
 * X42 (OBS-666): group-by dimension audit for the Traces table on Platform mobs-query, against the
 * read-only replica.
 *
 *   cardinality  per dimension: approximate distinct values, fill rate (non-null share of root rows)
 *                and the share of root rows the top 50 groups cover. Reads mastra_trace_roots directly.
 *   run          per dimension: the grouped request the Traces table would send (count, errorRate,
 *                p50/p95 duration, input/output tokens, cost; top 50 by count), compiled by mobs-query's
 *                own planner and compiler (imported from --platform). Supported dimensions go through
 *                the planner as-is. Candidates that no planner accepts yet are compiled as `entityName`
 *                and the one root column in the dimension expression is swapped, which is the SQL a
 *                registry entry would produce. Arms as in X41: `measure` (4 GiB / 60 s ceiling, warm-up
 *                then N warm reps) and `prod` (`aggregateTraces()` itself under 1 GiB / 9 s, supported
 *                dimensions only). max_threads=16 on every statement. No cold runs.
 *
 * Output: project hash, scope, window, dimension and numbers. No ids, values, keys or rows are printed.
 *
 *   npx tsx mobs-dimensions.ts cardinality|run --platform <mobs-query dir> [--projects p99,largest]
 *       [--scopes project,org] [--windows 7d,30d] [--dims a,b] [--reps 3]
 *   npx tsx mobs-dimensions.ts report
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

const CARD_OUT = join(RESULTS_DIR, 'mobs-dimensions-cardinality.jsonl');
const RUN_OUT = join(RESULTS_DIR, 'mobs-dimensions.jsonl');
const ALL_LOG = `clusterAllReplicas('all_groups.default', system.query_log)`;
const DAY = 86_400_000;
const GiB = 1024 ** 3;
const MEASURE: ClickHouseSettings = { max_memory_usage: String(4 * GiB), max_execution_time: 60 };

type Role = 'p99' | 'largest';
type Scope = 'project' | 'org';

/** Dimension → how it is compiled. `core`: planner as-is. `swap`: entityName with this root column. */
type DimensionSpec = { kind: 'core'; path: string } | { kind: 'swap'; column: string } | { kind: 'none' };
const DIMENSIONS: Record<string, DimensionSpec> = {
  none: { kind: 'none' },
  entityType: { kind: 'core', path: 'entityType' },
  entityName: { kind: 'core', path: 'entityName' },
  environment: { kind: 'core', path: 'environment' },
  status: { kind: 'core', path: 'status' },
  serviceName: { kind: 'core', path: 'serviceName' },
  executionSource: { kind: 'core', path: 'executionSource' },
  resourceId: { kind: 'core', path: 'resourceId' },
  userId: { kind: 'core', path: 'userId' },
  sessionId: { kind: 'core', path: 'sessionId' },
  experimentId: { kind: 'core', path: 'experimentId' },
  metadata: { kind: 'core', path: 'metadata.*' },
  projectId: { kind: 'core', path: 'projectId' },
  entityId: { kind: 'swap', column: 'entityId' },
  entityVersionId: { kind: 'swap', column: 'entityVersionId' },
  rootEntityName: { kind: 'swap', column: 'rootEntityName' },
  spanType: { kind: 'swap', column: 'spanType' },
  name: { kind: 'swap', column: 'name' },
  product: { kind: 'swap', column: 'product' },
};

/** Columns whose cardinality is reported (grouped or not). */
const CARD_COLUMNS: Record<string, string> = {
  entityType: 'entityType',
  entityName: 'entityName',
  environment: 'environment',
  status: `if(isNotNull(error), 'error', 'success')`,
  serviceName: 'serviceName',
  executionSource: 'executionSource',
  resourceId: 'resourceId',
  userId: 'userId',
  sessionId: 'sessionId',
  threadId: 'threadId',
  experimentId: 'experimentId',
  organizationId: 'organizationId',
  projectId: 'projectId',
  entityId: 'entityId',
  entityVersionId: 'entityVersionId',
  rootEntityName: 'rootEntityName',
  parentEntityName: 'parentEntityName',
  spanType: 'spanType',
  name: 'name',
  product: 'product',
};

const MEASURES = [
  'count',
  'errorRate',
  'duration.p50',
  'duration.p95',
  'tokens.input.sum',
  'tokens.output.sum',
  'cost.sum',
];

interface Tag {
  queryIds: string[];
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

interface RunRecord {
  runId: string;
  role: Role;
  hash: string;
  scope: Scope;
  window: string;
  dimension: string;
  arm: 'measure' | 'prod';
  rep: number;
  ok: boolean;
  errorCode?: string;
  wallMs: number;
  groups?: number;
  truncated?: boolean;
  queries: QueryStat[];
}

interface CardRecord {
  role: Role;
  hash: string;
  scope: Scope;
  window: string;
  dimension: string;
  /** Approximate distinct non-null values (`uniq`). */
  distinct: number;
  /** Share of root rows with a non-null value. */
  fill: number;
  /** Share of root rows in the 50 largest groups (null counts as a group). */
  top50?: number;
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
        log_comment: 'aqa-bench:mobs-dimensions',
      },
    });
    pending.catch(() => {});
    return pending;
  };
  return new Proxy(raw, {
    get(target, prop) {
      if (prop === 'query') return query;
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      throw new Error(`mobs-dimensions: client method ${String(prop)} is not allowed`);
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
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function pickProjects(projects: SelectedProject[]): Array<[Role, SelectedProject]> {
  const of = (bucket: string) => projects.filter(p => p.bucket === bucket);
  const perTrace = (p: SelectedProject) => (p.stats.spans30d ?? 0) / Math.max(1, p.stats.traces30d);
  // Same p99 representative as X41 (the heaviest p99 project by spans per trace is X41's heavy-p99).
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
      log_comment: 'aqa-bench:mobs-dimensions:meta',
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

function tenantSql(scope: Scope) {
  return scope === 'project'
    ? 'organizationId = {org:String} AND projectId = {project:String}'
    : 'organizationId = {org:String}';
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
  windows: string[];
  roles: Set<string>;
  dims?: Set<string>;
}

function doneKeys(file: string): Set<string> {
  if (!existsSync(file)) return new Set();
  return new Set(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as { hash: string; scope: string; window: string; dimension: string })
      .map(r => `${r.hash}|${r.scope}|${r.window}|${r.dimension}`),
  );
}

async function cardinality(options: Options) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const raw = await connect(options.platform);
  const done = doneKeys(CARD_OUT);
  const to = new Date();
  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      for (const scope of options.scopes) {
        for (const window of options.windows) {
          const days = Number.parseInt(window, 10);
          const params = {
            org: project.organizationId,
            project: project.projectId,
            from: new Date(to.getTime() - days * DAY).toISOString().replace('T', ' ').replace('Z', ''),
          };
          const where = `${tenantSql(scope)} AND startedAt >= parseDateTime64BestEffort({from:String}, 3, 'UTC')`;
          const write = (
            dimension: string,
            record: Omit<CardRecord, 'role' | 'hash' | 'scope' | 'window' | 'dimension'>,
          ) => {
            const r: CardRecord = { role, hash: project.hash, scope, window, dimension, ...record };
            appendFileSync(CARD_OUT, `${JSON.stringify(r)}\n`);
            console.log(
              `${role}/${project.hash} ${scope} ${window} ${dimension}: distinct ${r.distinct}, fill ${r.fill.toFixed(3)}${r.top50 === undefined ? '' : `, top50 ${r.top50.toFixed(3)}`}`,
            );
          };
          const key = (dimension: string) => `${project.hash}|${scope}|${window}|${dimension}`;

          // One pass for distinct counts and fill rates of every column.
          if (!done.has(key('entityName'))) {
            const cols = Object.entries(CARD_COLUMNS);
            const [stats] = await rows<Record<string, number>>(
              raw,
              `SELECT count() AS total, ${cols
                .map(([name, sql]) => `uniq(${sql}) AS d_${name}, countIf(isNotNull(${sql})) AS n_${name}`)
                .join(', ')}
               FROM mastra_trace_roots WHERE ${where}`,
              params,
            );
            const total = Number(stats!.total) || 1;
            const top50 = new Map<string, number>();
            for (const [name, sql] of cols) {
              if (name === 'organizationId') continue;
              const [row] = await rows<{ top: number }>(
                raw,
                `SELECT sum(c) AS top FROM (
                   SELECT ${sql} AS v, count() AS c FROM mastra_trace_roots WHERE ${where}
                   GROUP BY v ORDER BY c DESC LIMIT 50)`,
                params,
              );
              top50.set(name, Number(row!.top) / total);
            }
            for (const [name] of cols) {
              write(name, {
                distinct: Number(stats![`d_${name}`]),
                fill: Number(stats![`n_${name}`]) / total,
                ...(top50.has(name) ? { top50: top50.get(name)! } : {}),
              });
            }
          }
          if (!done.has(key('tags'))) {
            const [t] = await rows<{ d: number; n: number; total: number }>(
              raw,
              `SELECT uniqArray(tags) AS d, countIf(notEmpty(tags)) AS n, count() AS total
               FROM mastra_trace_roots WHERE ${where}`,
              params,
            );
            write('tags', { distinct: Number(t!.d), fill: Number(t!.n) / (Number(t!.total) || 1) });
          }
          if (!done.has(key('metadataKeys'))) {
            const [m] = await rows<{ d: number; n: number; total: number }>(
              raw,
              `SELECT uniqArray(mapKeys(metadataSearch)) AS d, countIf(notEmpty(mapKeys(metadataSearch))) AS n,
                      count() AS total
               FROM mastra_trace_roots WHERE ${where}`,
              params,
            );
            write('metadataKeys', { distinct: Number(m!.d), fill: Number(m!.n) / (Number(m!.total) || 1) });
          }
          if (!done.has(key('metadata'))) {
            const metadataKey = await topMetadataKey(raw, project);
            if (metadataKey) {
              const [m] = await rows<{ d: number; n: number; total: number }>(
                raw,
                `SELECT uniq(metadataSearch[{k:String}]) AS d, countIf(mapContains(metadataSearch, {k:String})) AS n,
                        count() AS total
                 FROM mastra_trace_roots WHERE ${where}`,
                { ...params, k: metadataKey },
              );
              write('metadata', { distinct: Number(m!.d), fill: Number(m!.n) / (Number(m!.total) || 1) });
            }
          }
        }
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
  const done = doneKeys(RUN_OUT);
  const to = new Date();

  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      const metadataKey = await topMetadataKey(raw, project);
      for (const scopeName of options.scopes) {
        const scope =
          scopeName === 'project'
            ? { organizationId: project.organizationId, projectId: project.projectId }
            : { organizationId: project.organizationId };
        for (const window of options.windows) {
          const days = Number.parseInt(window, 10);
          const timeRange = { from: new Date(to.getTime() - days * DAY).toISOString(), to: to.toISOString() };
          for (const [dimension, spec] of Object.entries(DIMENSIONS)) {
            if (options.dims && !options.dims.has(dimension)) continue;
            if (dimension === 'projectId' && scopeName === 'project') continue;
            if (dimension === 'metadata' && !metadataKey) continue;
            const base = { hash: project.hash, scope: scopeName, window, dimension };
            if (done.has(`${base.hash}|${base.scope}|${base.window}|${base.dimension}`)) continue;

            const groupBy =
              spec.kind === 'none'
                ? []
                : spec.kind === 'swap'
                  ? ['entityName']
                  : [spec.path === 'metadata.*' ? `metadata.${metadataKey}` : spec.path];
            const body = {
              timeRange,
              measures: MEASURES,
              groupBy,
              orderBy: { field: 'count', direction: 'desc' },
              limit: 50,
            };
            const plan = mods.plan.planPlatformTraceAggregate(body, scope, []);
            const compiled = mods.sql.compileClickHouseTraceAggregate(plan, usage);
            let query: string = compiled.query;
            if (spec.kind === 'swap') {
              const from = 'CAST(r.entityName AS Nullable(String)) AS d0';
              if (query.split(from).length !== 2) throw new Error(`swap anchor not unique for ${dimension}`);
              query = query.replace(from, `CAST(r.${spec.column} AS Nullable(String)) AS d0`);
            }
            const statement = () =>
              client
                .query({
                  query,
                  query_params: compiled.query_params,
                  format: 'JSONEachRow',
                  clickhouse_settings: { ...mods.obs.CLICKHOUSE_SETTINGS, filesystem_prefetches_limit: '8' },
                })
                .then(r => r.json() as Promise<unknown[]>);

            const calls: Array<Omit<RunRecord, 'queries' | 'runId' | keyof typeof base | 'role'> & { ids: string[] }> =
              [];
            await measured(state, MEASURE, statement);
            for (let rep = 1; rep <= options.reps; rep++) {
              const r = await measured(state, MEASURE, statement);
              const out = r.value as unknown[] | undefined;
              calls.push({
                arm: 'measure',
                rep,
                ok: r.ok,
                ...(r.errorCode ? { errorCode: r.errorCode } : {}),
                wallMs: Math.round(r.wallMs),
                ...(out ? { groups: Math.min(out.length, 50), truncated: out.length > 50 } : {}),
                ids: r.queryIds,
              });
            }
            if (spec.kind !== 'swap') {
              const prod = await measured(state, {}, () => mods.run.aggregateTraces(client, plan, usage));
              const value = prod.value as { rows: unknown[]; truncated: boolean } | undefined;
              calls.push({
                arm: 'prod',
                rep: 1,
                ok: prod.ok,
                ...(prod.errorCode ? { errorCode: prod.errorCode } : {}),
                wallMs: Math.round(prod.wallMs),
                ...(value ? { groups: value.rows.length, truncated: value.truncated } : {}),
                ids: prod.queryIds,
              });
            }

            const stats = await fetchStats(
              raw,
              calls.flatMap(c => c.ids),
            );
            for (const { ids, ...call } of calls) {
              const record: RunRecord = {
                runId,
                role,
                ...base,
                ...call,
                queries: ids.map(id => stats.get(id)).filter((s): s is QueryStat => !!s),
              };
              appendFileSync(RUN_OUT, `${JSON.stringify(record)}\n`);
            }
            const warm = calls.filter(c => c.arm === 'measure');
            const peak = Math.max(...warm.map(c => Math.max(0, ...c.ids.map(id => stats.get(id)?.memMiB ?? 0))));
            const prodCall = calls.find(c => c.arm === 'prod');
            console.log(
              `${role}/${project.hash} ${scopeName} ${window} ${dimension}: warm peak ${peak} MiB, groups ${warm[0]?.groups ?? '-'}${warm[0]?.truncated ? '+' : ''}, service ${prodCall ? (prodCall.ok ? 'ok' : `fail ${prodCall.errorCode}`) : 'n/a'}`,
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
  const card = existsSync(CARD_OUT)
    ? readFileSync(CARD_OUT, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as CardRecord)
    : [];
  console.log('## Cardinality\nrole | scope | window | dimension | distinct | fill | top50');
  console.log('---|---|---|---|---|---|---');
  for (const c of card)
    console.log(
      [c.role, c.scope, c.window, c.dimension, c.distinct, c.fill.toFixed(3), c.top50?.toFixed(3) ?? '-'].join(' | '),
    );

  const records = existsSync(RUN_OUT)
    ? readFileSync(RUN_OUT, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as RunRecord)
    : [];
  const cells = new Map<string, RunRecord[]>();
  for (const r of records) {
    const k = `${r.role}|${r.scope}|${r.window}|${r.dimension}`;
    cells.set(k, [...(cells.get(k) ?? []), r]);
  }
  const peak = (r: RunRecord) => Math.max(0, ...r.queries.map(q => q.memMiB));
  const dur = (r: RunRecord) => r.queries.reduce((a, q) => a + Number(q.durationMs), 0);
  console.log(
    '\n## Grouped request\nrole | scope | window | dimension | warm MiB (med/max) | warm ms (med/max) | groups | prod',
  );
  console.log('---|---|---|---|---|---|---|---');
  for (const rs of cells.values()) {
    const r0 = rs[0]!;
    const warm = rs.filter(r => r.arm === 'measure');
    const prod = rs.find(r => r.arm === 'prod');
    const failed = warm.find(r => !r.ok);
    console.log(
      [
        r0.role,
        r0.scope,
        r0.window,
        r0.dimension,
        `${median(warm.map(peak))} / ${Math.max(...warm.map(peak))}${failed ? ` (${failed.errorCode})` : ''}`,
        `${median(warm.map(dur))} / ${Math.max(...warm.map(dur))}`,
        `${warm[0]?.groups ?? '-'}${warm[0]?.truncated ? '+' : ''}`,
        prod ? (prod.ok ? `ok ${peak(prod)} MiB ${dur(prod)} ms` : `fail ${prod.errorCode}`) : 'n/a (candidate)',
      ].join(' | '),
    );
  }
}

installOutputRedaction();
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    platform: { type: 'string', default: '/tmp/platform-663/servers/mobs-query' },
    reps: { type: 'string', default: '3' },
    scopes: { type: 'string', default: 'project,org' },
    windows: { type: 'string', default: '7d,30d' },
    projects: { type: 'string', default: 'p99,largest' },
    dims: { type: 'string' },
  },
});
const options: Options = {
  platform: values.platform,
  reps: Number(values.reps),
  scopes: values.scopes.split(',') as Scope[],
  windows: values.windows.split(','),
  roles: new Set(values.projects.split(',')),
  ...(values.dims ? { dims: new Set(values.dims.split(',')) } : {}),
};
if (positionals[0] === 'cardinality') await cardinality(options);
else if (positionals[0] === 'run') await run(options);
else if (positionals[0] === 'report') report();
else {
  console.error('usage: mobs-dimensions.ts cardinality|run|report');
  process.exit(1);
}
