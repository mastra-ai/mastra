/**
 * X56 (OBS-719): does organization-wide `/spans/query` fit 1 GiB / 9 s on the largest org once
 * positive spanType/name conjuncts run before the copy collapse and, org-wide, only copied spans are
 * sorted? Compares mobs-query's selection statement as on origin/main (`base`) with the OBS-719
 * branch (`new`), compiled by the real compilers, on the replica.
 *
 * Arms per cell (server-default threads, as mobs-query):
 *   measure  4 GiB / 30 s ceiling: cold ×1 (filesystem cache off), unmeasured warm-up, warm ×reps
 *   prod     1 GiB / 9 s and mobs-query's statement settings, one warm call
 *
 * Output: role, hash, scope, window, shape, variant, metrics. No ids, keys, rows or values are printed.
 *
 *   npx tsx mobs-span-query-org.ts run --platform <mobs-query dir> --base <base compiler file>
 *       [--roles largest] [--scopes org,project] [--windows 7d,14d,30d,180d] [--shapes Q1,...]
 *       [--variants base,new] [--reps 3]
 *   npx tsx mobs-span-query-org.ts parity --platform <dir> --base <file> [--window 7d] [--pages 5]
 *   npx tsx mobs-span-query-org.ts report
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import type { ClickHouseClient, ClickHouseSettings } from '@clickhouse/client';

import { assertReadOnlyStatement } from './client';
import { installOutputRedaction, loadCredentials } from './env';
import { loadSelection } from './profile';
import type { SelectedProject } from './profile';
import { PREFLIGHT_FILE, RESULTS_DIR } from './run';

const OUT = join(RESULTS_DIR, 'mobs-span-query-org.jsonl');
const PARITY_OUT = join(RESULTS_DIR, 'mobs-span-query-org-parity.jsonl');
const ALL_LOG = `clusterAllReplicas('all_groups.default', system.query_log)`;
const DAY = 86_400_000;
const GiB = 1024 ** 3;
export const MEASURE: ClickHouseSettings = { max_memory_usage: String(4 * GiB), max_execution_time: 30 };
// mobs-query's runTraceQuery settings for a statement with the whole 9 s left.
export const PROD: ClickHouseSettings = {
  max_memory_usage: String(GiB),
  max_execution_time: 9,
  filesystem_prefetches_limit: '8',
  timeout_overflow_mode: 'throw',
};

export type Role = 'largest' | 'p99';
export type Scope = 'project' | 'org';
type Variant = 'base' | 'new';

const eq = (path: string, literal: unknown) => ({ op: 'eq', left: { path }, right: { literal } });

/** `/spans/query` requests; Q1 and Q2 are X55's S5 page 1 and S4. */
export const SHAPES: Record<string, { where?: unknown; limit: number }> = {
  Q1: { limit: 1000 },
  Q2: { where: { op: 'and', args: [eq('spanType', 'tool_call'), eq('status', 'error')] }, limit: 100 },
  Q3: { where: eq('spanType', 'model_generation'), limit: 100 },
  Q4: { where: { op: 'gt', left: { path: 'durationMs' }, right: { literal: 5000 } }, limit: 100 },
};

export interface QueryStat {
  durationMs: number;
  memMiB: number;
  readRows: number;
  readMiB: number;
  resultRows: number;
  exc: number;
}

interface CallRecord {
  at: string;
  role: Role;
  hash: string;
  scope: Scope;
  window: string;
  shape: string;
  variant: Variant;
  arm: 'measure' | 'prod';
  phase: 'cold' | 'warm';
  rep: number;
  ok: boolean;
  errorCode?: string;
  wallMs: number;
  rows?: number;
  stat?: QueryStat;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadPlatform(dir: string, baseFile: string) {
  const load = (path: string) => import(pathToFileURL(path).href) as Promise<any>;
  const require = createRequire(join(dir, 'package.json'));
  const spanQuery = await load(join(dir, 'src/services/span-query.ts'));
  return {
    spanQuery,
    plan: await load(join(dir, 'src/services/trace-query-plan.ts')),
    obs: await load(join(dir, 'src/services/observability.ts')),
    compilers: {
      base: (await load(resolve(baseFile))).compileClickHouseSpanQuery,
      new: spanQuery.compileClickHouseSpanQuery,
    } as Record<Variant, (plan: unknown) => { query: string; query_params: Record<string, unknown> }>,
    createClient: require('@clickhouse/client').createClient,
  };
}
export type Mods = Awaited<ReturnType<typeof loadPlatform>>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function pickProjects(projects: SelectedProject[]): Array<[Role, SelectedProject]> {
  const of = (bucket: string) => projects.filter(p => p.bucket === bucket);
  const largest = of('largest').find(p => p.representative);
  const p99 = of('p99').find(p => p.representative) ?? of('p99')[0];
  return (
    [
      ['largest', largest],
      ['p99', p99],
    ] as Array<[Role, SelectedProject | undefined]>
  ).filter((e): e is [Role, SelectedProject] => !!e[1]);
}

export function scopeOf(project: SelectedProject, name: Scope) {
  return name === 'project'
    ? { organizationId: project.organizationId, projectId: project.projectId }
    : { organizationId: project.organizationId };
}

export async function connect(platform: string, baseFile: string, connections = 2) {
  const mods = await loadPlatform(platform, baseFile);
  const database = (JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string }).database;
  const credentials = loadCredentials();
  const raw: ClickHouseClient = mods.createClient({
    url: credentials.origin,
    username: credentials.username,
    password: credentials.password,
    database,
    request_timeout: 120_000,
    max_open_connections: connections,
    log: { level: 127 },
  });
  return { mods, raw };
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function exec(
  raw: ClickHouseClient,
  mods: Mods,
  compiled: { query: string; query_params: Record<string, unknown> },
  settings: ClickHouseSettings,
  cold: boolean,
  queryId: string,
): Promise<Record<string, unknown>[]> {
  assertReadOnlyStatement(compiled.query);
  const result = await raw.query({
    query: compiled.query,
    query_params: compiled.query_params,
    query_id: queryId,
    format: 'JSONEachRow',
    clickhouse_settings: {
      ...mods.obs.CLICKHOUSE_SETTINGS,
      use_query_cache: 0,
      ...settings,
      log_comment: 'aqa-bench:mobs-span-query-org',
      ...(cold ? { enable_filesystem_cache: 0 } : {}),
    },
  });
  return result.json();
}

export async function fetchStat(raw: ClickHouseClient, id: string): Promise<QueryStat | undefined> {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (attempt > 0) await sleep(2000);
    const result = await raw.query({
      query: `SELECT query_duration_ms AS durationMs, round(memory_usage / 1048576, 1) AS memMiB,
              read_rows AS readRows, round(read_bytes / 1048576, 2) AS readMiB, result_rows AS resultRows,
              exception_code AS exc
       FROM ${ALL_LOG}
       WHERE event_date >= yesterday() AND type IN ('QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart')
         AND query_id = {id:String}`,
      query_params: { id },
      format: 'JSONEachRow',
      clickhouse_settings: { log_comment: 'aqa-bench:mobs-span-query-org:meta', max_execution_time: 60 },
    });
    const [stat] = await result.json<QueryStat>();
    if (stat) return stat;
  }
  return undefined;
}

export function windowRange(window: string, to = new Date(Date.now() - 6 * 3_600_000)) {
  const amount = Number.parseInt(window, 10);
  const span = window.endsWith('h') ? amount * 3_600_000 : amount * DAY;
  return { from: new Date(to.getTime() - span).toISOString(), to: to.toISOString() };
}

export function errorCode(error: unknown): string {
  const e = error as { code?: string; type?: string; message?: string };
  return String(e.code ?? e.type ?? e.message?.slice(0, 40) ?? 'error');
}

function done(): Set<string> {
  if (!existsSync(OUT)) return new Set();
  return new Set(
    readFileSync(OUT, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as CallRecord)
      .map(r => `${r.hash}|${r.scope}|${r.window}|${r.shape}|${r.variant}`),
  );
}

async function run(options: {
  platform: string;
  base: string;
  reps: number;
  roles: Set<string>;
  scopes: Scope[];
  windows: string[];
  shapes: string[];
  variants: Variant[];
}) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection');
  const { mods, raw } = await connect(options.platform, options.base);
  const finished = done();
  // A cell whose prod arm failed skips longer windows of the same role/scope/shape/variant.
  const failedProd = new Set<string>();
  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      for (const scopeName of options.scopes) {
        for (const shapeId of options.shapes) {
          for (const variant of options.variants) {
            for (const window of options.windows) {
              const key = `${project.hash}|${scopeName}|${window}|${shapeId}|${variant}`;
              const series = `${project.hash}|${scopeName}|${shapeId}|${variant}`;
              if (finished.has(key)) continue;
              const timeRange = windowRange(window);
              const shape = SHAPES[shapeId]!;
              const plan = mods.plan.planPlatformSpanQuery(
                { timeRange, ...(shape.where ? { where: shape.where } : {}), page: { limit: shape.limit } },
                scopeOf(project, scopeName),
              );
              const compiled = mods.compilers[variant](plan);
              const record = (
                r: Omit<CallRecord, 'at' | 'role' | 'hash' | 'scope' | 'window' | 'shape' | 'variant'>,
              ) => {
                const full: CallRecord = {
                  at: new Date().toISOString(),
                  role,
                  hash: project.hash,
                  scope: scopeName,
                  window,
                  shape: shapeId,
                  variant,
                  ...r,
                };
                appendFileSync(OUT, `${JSON.stringify(full)}\n`);
                console.log(
                  [role, project.hash, scopeName, window, shapeId, variant, r.arm, r.phase, r.rep].join(' '),
                  r.ok
                    ? `ok ${r.stat?.durationMs} ms / ${r.stat?.memMiB} MiB / read ${r.stat?.readMiB} MiB`
                    : `FAIL ${r.errorCode} (${r.stat?.memMiB ?? '?'} MiB)`,
                );
              };
              const call = async (arm: 'measure' | 'prod', phase: 'cold' | 'warm', rep: number, log = true) => {
                const id = randomUUID();
                const start = performance.now();
                let ok = true;
                let code: string | undefined;
                let rows: number | undefined;
                try {
                  rows = (await exec(raw, mods, compiled, arm === 'prod' ? PROD : MEASURE, phase === 'cold', id))
                    .length;
                } catch (error) {
                  ok = false;
                  code = errorCode(error);
                }
                const wallMs = Math.round(performance.now() - start);
                if (!log) return ok;
                record({ arm, phase, rep, ok, errorCode: code, wallMs, rows, stat: await fetchStat(raw, id) });
                return ok;
              };
              if (failedProd.has(series)) {
                record({ arm: 'prod', phase: 'warm', rep: 0, ok: false, errorCode: 'skipped', wallMs: 0 });
                continue;
              }
              const coldOk = await call('measure', 'cold', 0);
              if (coldOk) {
                await call('measure', 'warm', 0, false);
                for (let rep = 1; rep <= options.reps; rep++) await call('measure', 'warm', rep);
              }
              if (!(await call('prod', 'warm', 0))) failedProd.add(series);
            }
          }
        }
      }
    }
  } finally {
    await raw.close();
  }
}

type SpanRow = Record<string, unknown>;

/**
 * Row-for-row: the page plus its look-ahead row (the next cursor's row), then `pages` pages by
 * cursor, under base and new, plus base against itself as a control.
 */
async function parity(options: {
  platform: string;
  base: string;
  window: string;
  pages: number;
  roles: Set<string>;
  scopes: Scope[];
  shapes: string[];
}) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection');
  const { mods, raw } = await connect(options.platform, options.base);
  const timeRange = windowRange(options.window);
  const identity = ['organizationId', 'projectId', 'resourceId', 'traceId', 'spanId'] as const;
  const pageThrough = async (variant: Variant, request: Record<string, unknown>, scope: object, limit: number) => {
    const out: string[] = [];
    let plan = mods.plan.planPlatformSpanQuery({ ...request, page: { limit } }, scope);
    for (let page = 0; page < options.pages; page++) {
      const rows = (await exec(raw, mods, mods.compilers[variant](plan), MEASURE, false, randomUUID())) as SpanRow[];
      out.push(...rows.map(row => JSON.stringify(row)));
      if (rows.length <= limit) break;
      const last = rows[limit - 1]!;
      const cursor = Object.fromEntries(identity.map(key => [key, last[key] ?? null]));
      plan = { ...plan, cursor: { ...cursor, sortValue: String(last[plan.orderBy.field]) } };
    }
    return out;
  };
  const diff = (x: string[], y: string[]) => {
    let d = Math.abs(x.length - y.length);
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) d++;
    return d;
  };
  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      for (const scopeName of options.scopes) {
        for (const shapeId of options.shapes) {
          const shape = SHAPES[shapeId]!;
          const request = { timeRange, ...(shape.where ? { where: shape.where } : {}) };
          const scope = scopeOf(project, scopeName);
          const label = [role, project.hash, scopeName, options.window, shapeId].join(' ');
          try {
            // Page 1 with its look-ahead row, at the shape's limit.
            const base = await pageThrough('base', request, scope, shape.limit);
            const next = await pageThrough('new', request, scope, shape.limit);
            const again = await pageThrough('base', request, scope, shape.limit);
            const result = {
              at: new Date().toISOString(),
              role,
              hash: project.hash,
              scope: scopeName,
              window: options.window,
              shape: shapeId,
              pages: options.pages,
              rows: [base.length, next.length],
              diff: diff(base, next),
              control: diff(base, again),
            };
            appendFileSync(PARITY_OUT, `${JSON.stringify(result)}\n`);
            console.log(label, `rows=${base.length}/${next.length} diff=${result.diff} control=${result.control}`);
          } catch (error) {
            console.log(label, 'failed:', errorCode(error));
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
    const key = [r.role, r.scope, r.window, r.shape, r.variant].join(' ');
    cells.set(key, [...(cells.get(key) ?? []), r]);
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  console.log(
    '| role | scope | window | shape | variant | warm median ms | warm max MiB | read MiB | cold | prod 1 GiB/9 s | rows |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [key, rs] of cells) {
    const warm = rs.filter(r => r.arm === 'measure' && r.phase === 'warm' && r.ok && r.stat).map(r => r.stat!);
    const cold = rs.find(r => r.phase === 'cold');
    const prod = rs.find(r => r.arm === 'prod');
    const prodText = !prod
      ? '–'
      : prod.ok
        ? `ok ${prod.stat?.durationMs ?? '?'} ms / ${prod.stat?.memMiB ?? '?'} MiB`
        : prod.errorCode === 'skipped'
          ? 'skipped'
          : `FAIL ${prod.errorCode} (${prod.stat?.memMiB ?? '?'} MiB, ${prod.stat?.durationMs ?? '?'} ms)`;
    console.log(
      `| ${key.split(' ').join(' | ')} | ${warm.length ? median(warm.map(s => s.durationMs)) : '–'} | ${
        warm.length ? Math.max(...warm.map(s => s.memMiB)) : '–'
      } | ${warm.length ? median(warm.map(s => s.readMiB)) : '–'} | ${
        cold ? (cold.ok ? `${cold.stat?.durationMs ?? '?'} ms` : `fail ${cold.errorCode}`) : '–'
      } | ${prodText} | ${prod?.rows ?? '–'} |`,
    );
  }
}

async function main() {
  installOutputRedaction();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      platform: { type: 'string' },
      base: { type: 'string' },
      reps: { type: 'string', default: '3' },
      roles: { type: 'string', default: 'largest' },
      scopes: { type: 'string', default: 'org,project' },
      windows: { type: 'string', default: '7d,14d,30d,180d' },
      shapes: { type: 'string', default: Object.keys(SHAPES).join(',') },
      variants: { type: 'string', default: 'base,new' },
      window: { type: 'string', default: '7d' },
      pages: { type: 'string', default: '5' },
    },
  });
  const command = positionals[0];
  if (command === 'report') return report();
  if (!values.platform || !values.base)
    throw new Error('--platform <mobs-query dir> and --base <compiler file> are required');
  const common = {
    platform: values.platform,
    base: values.base,
    roles: new Set(values.roles!.split(',')),
    scopes: values.scopes!.split(',') as Scope[],
    shapes: values.shapes!.split(','),
  };
  if (command === 'parity') return parity({ ...common, window: values.window!, pages: Number(values.pages) });
  if (command !== 'run') throw new Error('usage: run | parity | report');
  await run({
    ...common,
    reps: Number(values.reps),
    windows: values.windows!.split(','),
    variants: values.variants!.split(',') as Variant[],
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
