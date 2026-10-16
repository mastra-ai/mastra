/**
 * X44 (OBS-667): cost of trace-scope root `name` / `spanType` filters and value suggestions, against
 * the read-only replica, each request next to the identical request on `entityName`.
 *
 * Requests go through the real OSS ClickHouse store functions (`queryTraces`, `aggregateTraces`,
 * `getTraceQueryValues`) and Core planner loaded from `--mastra` (a checkout of mastra#27321; this
 * worktree's compiler predates the fields). Project scope is added the way X41/X42 add it: after every
 * compiled `AND organizationId = …` tenant fragment. mobs-query is not used: it does not map the fields.
 *
 *   a  queryTraces page 0 / 25 with `name = <common>` and `name = <rare>`, vs `entityName` values of the
 *      closest trace count
 *   b  queryTraces with `spanType = <most common>`, vs the closest `entityName`
 *   c  aggregateTraces grouped by entityName (count, errorRate, duration.p95; top 50) with `name = <common>`
 *   d  value suggestions (limit 50) for `name`, `spanType`, vs `entityName`
 *
 * Warm-up then N reps, max_threads=16, 4 GiB / 60 s ceiling. Equivalence: each filtered request's trace
 * count (page total or summed group counts) must equal a hand-written `uniqExact(traceId)` over
 * mastra_trace_roots; discovery counts must equal a hand-written GROUP BY.
 *
 * Output: project hash, scope, window, request and numbers. Literal values are kept in memory only.
 *
 *   npx tsx root-filters.ts run --mastra <dir> [--scopes project,org] [--windows 7d,30d] [--reps 3]
 *   npx tsx root-filters.ts report
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
import { PREFLIGHT_FILE, RESULTS_DIR } from './run';

const OUT = join(RESULTS_DIR, 'root-filters.jsonl');
const ALL_LOG = `clusterAllReplicas('all_groups.default', system.query_log)`;
const DAY = 86_400_000;
const GiB = 1024 ** 3;
const MEASURE: ClickHouseSettings = { max_memory_usage: String(4 * GiB), max_execution_time: 60 };
const TENANT_FRAGMENT = /AND organizationId = (\{trace_query_\d+:String\})/g;
const PROJECT_PARAM = 'bench_project_id';

type Scope = 'project' | 'org';
type Field = 'name' | 'spanType' | 'entityName';

interface QueryStat {
  durationMs: number;
  memMiB: number;
  readRows: number;
  readMiB: number;
  exc: number;
}

interface Record_ {
  runId: string;
  hash: string;
  scope: Scope;
  window: string;
  request: string;
  field: Field;
  rep: number;
  ok: boolean;
  errorCode?: string;
  wallMs: number;
  /** Trace count the request reported and the hand-written count. */
  traces?: number;
  expected?: number;
  /** Literal's share of the window's traces. */
  selectivity?: number;
  queries: QueryStat[];
}

interface Tag {
  queryIds: string[];
  projectId?: string;
}

function guardedClient(raw: ClickHouseClient, state: { current?: Tag }): ClickHouseClient {
  const query = (params: QueryParams) => {
    const tag = state.current;
    if (!tag) throw new Error('query outside a measured call');
    let sql = params.query;
    let queryParams = params.query_params ?? {};
    if (tag.projectId !== undefined) {
      sql = sql.replace(TENANT_FRAGMENT, fragment => `${fragment} AND projectId = {${PROJECT_PARAM}:String}`);
      queryParams = { ...queryParams, [PROJECT_PARAM]: tag.projectId };
    }
    assertReadOnlyStatement(sql);
    const queryId = randomUUID();
    tag.queryIds.push(queryId);
    const pending = raw.query({
      ...params,
      query: sql,
      query_params: queryParams,
      query_id: queryId,
      clickhouse_settings: {
        ...params.clickhouse_settings,
        use_query_cache: 0,
        max_threads: 16,
        ...MEASURE,
        log_comment: 'aqa-bench:root-filters',
      },
    });
    pending.catch(() => {});
    return pending;
  };
  return new Proxy(raw, {
    get(target, prop) {
      if (prop === 'query') return query;
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      throw new Error(`root-filters: client method ${String(prop)} is not allowed`);
    },
  }) as ClickHouseClient;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadMastra(dir: string) {
  const store = join(dir, 'stores/clickhouse');
  const load = (path: string) => import(pathToFileURL(join(store, path)).href) as Promise<any>;
  const core = (await import(
    pathToFileURL(createRequire(join(store, 'package.json')).resolve('@mastra/core/storage')).href
  )) as any;
  if (!core.TRACE_AGGREGATE_DIMENSION_REGISTRY?.spanType)
    throw new Error(`${dir}: core has no root spanType dimension`);
  return {
    core,
    query: await load('src/storage/domains/observability/v-next/trace-query.ts'),
    aggregate: await load('src/storage/domains/observability/v-next/trace-aggregate.ts'),
    createClient: (
      createRequire(join(store, 'package.json'))('@clickhouse/client') as typeof import('@clickhouse/client')
    ).createClient,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function measured<T>(state: { current?: Tag }, projectId: string | undefined, fn: () => Promise<T>) {
  const tag: Tag = { queryIds: [], projectId };
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
      value: undefined,
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
      log_comment: 'aqa-bench:root-filters:meta',
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
              read_rows AS readRows, round(read_bytes / 1048576, 2) AS readMiB, exception_code AS exc
       FROM ${ALL_LOG}
       WHERE event_date >= yesterday() AND type IN ('QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart')
         AND query_id IN {ids:Array(String)}`,
      { ids: missing },
    );
    for (const { id, ...stat } of got) {
      // UInt64 columns arrive as JSON strings.
      found.set(id, {
        ...stat,
        durationMs: Number(stat.durationMs),
        memMiB: Number(stat.memMiB),
        readRows: Number(stat.readRows),
        readMiB: Number(stat.readMiB),
      });
    }
  }
  return found;
}

interface Options {
  mastra: string;
  reps: number;
  scopes: Scope[];
  windows: string[];
}

async function run(options: Options) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const project = selection.projects.find(p => p.bucket === 'largest' && p.representative);
  if (!project) throw new Error('No largest representative project');
  const mods = await loadMastra(options.mastra);
  const database = (JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string }).database;
  const credentials = loadCredentials();
  const raw = mods.createClient({
    url: credentials.origin,
    username: credentials.username,
    password: credentials.password,
    database,
    request_timeout: 180_000,
    max_open_connections: 4,
  });
  const state: { current?: Tag } = {};
  const client = guardedClient(raw, state);
  const runId = randomUUID().slice(0, 8);
  const to = new Date();
  to.setUTCMinutes(0, 0, 0);
  const { core } = mods;

  try {
    for (const scope of options.scopes) {
      const projectId = scope === 'project' ? project.projectId : undefined;
      const planScope = { scope: { organizationId: project.organizationId } };
      for (const window of options.windows) {
        const days = Number.parseInt(window, 10);
        const timeRange = { from: new Date(to.getTime() - days * DAY).toISOString(), to: to.toISOString() };
        const tenantWhere = `organizationId = {org:String}${projectId ? ' AND projectId = {project:String}' : ''}
          AND startedAt >= parseDateTime64BestEffort({from:String}, 3, 'UTC')
          AND startedAt < parseDateTime64BestEffort({to:String}, 3, 'UTC')`;
        const tenantParams = { org: project.organizationId, project: project.projectId, ...timeRange };

        // Hand-written per-value trace counts, also the equivalence reference for discovery.
        const counts = async (field: Field) => {
          const got = await rows<{ v: string; c: string }>(
            raw,
            `SELECT ${field} AS v, uniqExact(traceId) AS c FROM mastra_trace_roots
             WHERE ${tenantWhere} AND isNotNull(${field}) GROUP BY v ORDER BY c DESC, v ASC`,
            tenantParams,
          );
          registerSensitive(got.map(r => r.v));
          return got.map(r => ({ value: r.v, count: Number(r.c) }));
        };
        const [totalRow] = await rows<{ total: string }>(
          raw,
          `SELECT uniqExact(traceId) AS total FROM mastra_trace_roots WHERE ${tenantWhere}`,
          tenantParams,
        );
        const total = Number(totalRow?.total ?? 0);
        const byField = {
          name: await counts('name'),
          spanType: await counts('spanType'),
          entityName: await counts('entityName'),
        };
        const closestEntity = (count: number) =>
          [...byField.entityName].sort((a, b) => Math.abs(a.count - count) - Math.abs(b.count - count))[0]!;
        const commonName = byField.name[0]!;
        const rareName = byField.name.at(-1)!;
        const commonType = byField.spanType[0]!;
        console.log(
          `${project.hash} ${scope} ${window}: ${total} traces; name ${byField.name.length} values (common ${commonName.count}, rare ${rareName.count}), spanType ${byField.spanType.length}, entityName ${byField.entityName.length}`,
        );

        const eq = (field: Field, value: string) => ({ op: 'eq', left: { path: field }, right: { literal: value } });
        type Req = { request: string; field: Field; expected: number; exec: () => Promise<number> };
        const listReq = (request: string, field: Field, literal: { value: string; count: number }): Req => ({
          request,
          field,
          expected: literal.count,
          exec: async () => {
            const plan = core.planTraceQuery(
              core.parseTraceQueryRequest({
                timeRange,
                where: eq(field, literal.value),
                pagination: { page: 0, perPage: 25 },
              }),
              planScope,
            );
            const res = await mods.query.queryTraces(client, plan, 60_000, null);
            return Number(res.pagination.total);
          },
        });
        const aggReq = (field: Field, literal: { value: string; count: number }): Req => ({
          request: 'c:aggregate-common',
          field,
          expected: literal.count,
          exec: async () => {
            const plan = core.planTraceAggregate(
              core.parseTraceAggregateRequest({
                timeRange,
                where: eq(field, literal.value),
                groupBy: ['entityName'],
                measures: ['count', 'errorRate', 'duration.p95'],
                orderBy: { field: 'count', direction: 'desc' },
                limit: 50,
              }),
              planScope,
            );
            const res = await mods.aggregate.aggregateTraces(client, plan, 60_000);
            if (res.truncated) throw new Error('aggregate truncated; summed count would be partial');
            return res.rows.reduce((sum: number, row: { measures: { count: number } }) => sum + row.measures.count, 0);
          },
        });
        const valuesReq = (field: Field): Req => {
          const top = byField[field].slice(0, 50);
          return {
            request: 'd:values',
            field,
            expected: top.reduce((s, v) => s + v.count, 0),
            exec: async () => {
              const plan = core.planTraceQueryValues(
                core.parseGetTraceQueryValuesArgs({ timeRange, predicateScope: 'trace', path: field, limit: 50 }),
                planScope,
              );
              const res = await mods.query.getTraceQueryValues(client, plan, { timeoutMs: 60_000 });
              const want = new Map(top.map(v => [v.value, v.count]));
              for (const v of res.values)
                if (want.get(v.value) !== v.count) throw new Error(`values mismatch on ${field}`);
              if (res.values.length !== top.length) throw new Error(`values length mismatch on ${field}`);
              return res.values.reduce((s: number, v: { count: number }) => s + v.count, 0);
            },
          };
        };

        const requests: Array<Req & { selectivity?: number }> = [
          { ...listReq('a:list-common', 'name', commonName), selectivity: commonName.count / total },
          {
            ...listReq('a:list-common', 'entityName', closestEntity(commonName.count)),
            selectivity: closestEntity(commonName.count).count / total,
          },
          { ...listReq('a:list-rare', 'name', rareName), selectivity: rareName.count / total },
          {
            ...listReq('a:list-rare', 'entityName', closestEntity(rareName.count)),
            selectivity: closestEntity(rareName.count).count / total,
          },
          { ...listReq('b:list-spanType', 'spanType', commonType), selectivity: commonType.count / total },
          {
            ...listReq('b:list-spanType', 'entityName', closestEntity(commonType.count)),
            selectivity: closestEntity(commonType.count).count / total,
          },
          { ...aggReq('name', commonName), selectivity: commonName.count / total },
          {
            ...aggReq('entityName', closestEntity(commonName.count)),
            selectivity: closestEntity(commonName.count).count / total,
          },
          valuesReq('name'),
          valuesReq('spanType'),
          valuesReq('entityName'),
        ];

        for (const req of requests) {
          const calls: Array<{ rep: number; r: Awaited<ReturnType<typeof measured<number>>> }> = [];
          await measured(state, projectId, req.exec);
          for (let rep = 1; rep <= options.reps; rep++)
            calls.push({ rep, r: await measured(state, projectId, req.exec) });
          const stats = await fetchStats(
            raw,
            calls.flatMap(c => c.r.queryIds),
          );
          for (const { rep, r } of calls) {
            const record: Record_ = {
              runId,
              hash: project.hash,
              scope,
              window,
              request: req.request,
              field: req.field,
              rep,
              ok: r.ok,
              ...(r.errorCode ? { errorCode: r.errorCode } : {}),
              wallMs: Math.round(r.wallMs),
              ...(r.value === undefined ? {} : { traces: r.value }),
              expected: req.expected,
              ...(req.selectivity === undefined ? {} : { selectivity: Number(req.selectivity.toFixed(4)) }),
              queries: r.queryIds.map(id => stats.get(id)).filter((s): s is QueryStat => !!s),
            };
            appendFileSync(OUT, `${JSON.stringify(record)}\n`);
          }
          const first = calls[0]!.r;
          console.log(
            `  ${req.request} ${req.field}: ${calls.every(c => c.r.ok) ? 'ok' : `fail ${first.errorCode}`}, traces ${first.value ?? '-'} vs ${req.expected}${first.value === req.expected ? '' : ' MISMATCH'}`,
          );
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
    .map(line => JSON.parse(line) as Record_);
  const latest = records.at(-1)?.runId;
  const cells = new Map<string, Record_[]>();
  for (const r of records.filter(r => r.runId === latest)) {
    const key = `${r.scope}|${r.window}|${r.request}|${r.field}`;
    cells.set(key, [...(cells.get(key) ?? []), r]);
  }
  console.log(
    '| scope | window | request | field | sel | peak MiB | ms (sum) | read MiB | ok | equiv | vs entityName |',
  );
  console.log('| - | - | - | - | - | - | - | - | - | - | - |');
  const summary = new Map<string, { mem: number; ms: number; read: number }>();
  for (const [key, rs] of cells) {
    summary.set(key, {
      mem: median(rs.map(r => Math.max(0, ...r.queries.map(q => Number(q.memMiB))))),
      ms: median(rs.map(r => r.queries.reduce((s, q) => s + Number(q.durationMs), 0))),
      read: median(rs.map(r => r.queries.reduce((s, q) => s + Number(q.readMiB), 0))),
    });
  }
  for (const [key, rs] of cells) {
    const [scope, window, request, field] = key.split('|');
    const s = summary.get(key)!;
    const base = summary.get(`${scope}|${window}|${request}|entityName`)!;
    const pct = (a: number, b: number) => `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%`;
    const vs =
      field === 'entityName'
        ? 'baseline'
        : `mem ${pct(s.mem, base.mem)}, ms ${pct(s.ms, base.ms)}, read ${pct(s.read, base.read)}`;
    const sel = rs[0]!.selectivity;
    console.log(
      `| ${scope} | ${window} | ${request} | ${field} | ${sel === undefined ? '' : sel.toFixed(4)} | ${s.mem} | ${s.ms} | ${s.read.toFixed(1)} | ${rs.filter(r => r.ok).length}/${rs.length} | ${rs.every(r => r.traces === r.expected) ? 'yes' : 'NO'} | ${vs} |`,
    );
  }
}

async function main() {
  installOutputRedaction();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      mastra: { type: 'string' },
      reps: { type: 'string', default: '3' },
      scopes: { type: 'string', default: 'project,org' },
      windows: { type: 'string', default: '7d,30d' },
    },
  });
  const command = positionals[0];
  if (command === 'report') return report();
  if (command !== 'run' || !values.mastra) throw new Error('usage: root-filters.ts run --mastra <dir> | report');
  if (!existsSync(join(values.mastra, 'stores/clickhouse')))
    throw new Error(`${values.mastra} is not a mastra checkout`);
  await run({
    mastra: values.mastra,
    reps: Number(values.reps),
    scopes: values.scopes.split(',') as Scope[],
    windows: values.windows.split(','),
  });
}

await main();
