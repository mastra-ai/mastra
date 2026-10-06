/**
 * Phase runner for the aggregateTraces() benchmark.
 *
 *   tsx bench/aggregate-traces/run.ts preflight
 *   tsx bench/aggregate-traces/run.ts profile
 *   tsx bench/aggregate-traces/run.ts run --buckets small,mid,p90 [--windows 1d,7d,30d] [--groups g] [--cases A,B]
 *                                         [--tier 1|2|3] [--gate-b-approved] [--dry-run]
 *   tsx bench/aggregate-traces/run.ts report
 *
 * Safety: see README.md. Credentials are loaded in-process and guarded before any network I/O.
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { anchorTo, CASES, compileCase, compilePayloadStage, timeRangeFor } from './cases';
import type { CaseDef, PageKey, WindowDef } from './cases';
import { BenchClient, isLimitCategory, TIERS } from './client';
import type { ErrorCategory, QueryOutcome, Tier } from './client';
import { installOutputRedaction, loadCredentials } from './env';
import type { BenchCredentials } from './env';
import { collectMetrics } from './metrics';
import type { QueryLogSource, QueryMetrics } from './metrics';
import {
  BUCKETS,
  candidates,
  discoverLiterals,
  distribution,
  gauge,
  loadSelection,
  newSalt,
  pickProjects,
  projectHash,
  projectStats,
  publicProfile,
  saveSelection,
} from './profile';
import type { Bucket, ProfileContext, Selection, SelectedProject, TableColumns } from './profile';
import type { Variant } from './scope';

export const RESULTS_DIR = join(import.meta.dirname, 'results');
export const RESULTS_FILE = join(RESULTS_DIR, 'runs.jsonl');
export const PREFLIGHT_FILE = join(RESULTS_DIR, 'preflight.json');
export const PROFILE_FILE = join(RESULTS_DIR, 'profile.json');

const TABLES = [
  'mastra_trace_roots',
  'mastra_span_events',
  'mastra_metric_events',
  'mastra_score_events_current',
  'mastra_feedback_events',
] as const;

const PAUSE_MS = 2_000;
const MAX_CONSECUTIVE_ERRORS = 3;

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export type Stage = 'main' | 'payload' | 'payload-scoped';

export interface RunRecord {
  runId: string;
  key: string;
  caseId: string;
  group: string;
  variant: Variant;
  stage: Stage;
  window: string;
  windowMs: number;
  bucket: Bucket;
  hash: string;
  traces30d: number;
  rep: number;
  cold: boolean;
  tier: number;
  anchorTo: string;
  ts: string;
  ok: boolean;
  errorCode?: string;
  errorCategory?: ErrorCategory;
  wallMs: number;
  streamedRows: number;
  metrics: QueryMetrics;
}

export function recordKey(caseId: string, variant: string, stage: Stage, window: string, hash: string): string {
  return `${caseId}|${variant}|${stage}|${window}|${hash}`;
}

export function readRecords(file = RESULTS_FILE): RunRecord[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as RunRecord);
}

/** Stage of the run order a window belongs to (interval windows have custom lengths). */
export function windowStage(window: WindowDef): '1d' | '7d' | '30d' {
  if (window.ms <= 86_400_000) return '1d';
  if (window.ms <= 7 * 86_400_000) return '7d';
  return '30d';
}

const WINDOW_ORDER = ['1d', '7d', '30d'] as const;

/** Gate B: these need explicit approval (`--gate-b-approved`). */
export function needsGateB(def: CaseDef, window: WindowDef, bucket: Bucket): boolean {
  const stage = windowStage(window);
  if (bucket === 'p99' && stage === '30d') return true;
  if (bucket === 'largest' && stage !== '1d') return true;
  if ((bucket === 'p99' || bucket === 'largest') && (def.group === 'highcard' || def.id === 'I4')) return true;
  return false;
}

export interface LimitHit {
  bucket: Bucket;
  windowMs: number;
}

/**
 * Escalation rule: after a limit hit, skip the case's larger windows in that bucket, and run only
 * its 1-day window in larger buckets.
 */
export function skippedByEscalation(hits: LimitHit[], bucket: Bucket, window: WindowDef): boolean {
  const index = BUCKETS.indexOf(bucket);
  return hits.some(hit => {
    const hitIndex = BUCKETS.indexOf(hit.bucket);
    if (hitIndex === index) return window.ms > hit.windowMs;
    if (index > hitIndex) return windowStage(window) !== '1d';
    return false;
  });
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface Context {
  client: BenchClient;
  queryLog: QueryLogSource;
  runId: string;
  tier: Tier;
  lastQueryEnd: number;
  resultsFile: string;
  pauseMs: number;
  /** Overrides the per-bucket repetition count (local smoke run only). */
  reps?: number;
  /** Print redacted error messages (local smoke run only). */
  verbose?: boolean;
}

async function pause(ctx: Context): Promise<void> {
  const wait = ctx.lastQueryEnd + ctx.pauseMs - Date.now();
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
}

function logComment(ctx: Context, ...parts: Array<string | number>): string {
  return ['aqa-bench', ctx.runId, ...parts].join(':');
}

function log(message: string): void {
  process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${message}\n`);
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function connect(credentials: BenchCredentials, database?: string): BenchClient {
  return new BenchClient({ ...credentials, database: database ?? credentials.database });
}

// ---------------------------------------------------------------------------
// preflight
// ---------------------------------------------------------------------------

export interface Preflight {
  checkedAt: string;
  readonly: number;
  version: string;
  queryLog: QueryLogSource;
  database: string;
  tables: Array<{ name: string; sortingKey: string; partitionKey: string; totalRows: number; totalBytes: number }>;
  missingTables: string[];
  missingColumns: Record<string, string[]>;
  skipIndexes: Array<{ table: string; name: string; type: string; expr: string }>;
  skipIndexSource: 'data_skipping_indices' | 'create_table_query';
  columns: Record<string, string[]>;
}

const REQUIRED_COLUMNS: Record<string, string[]> = {
  mastra_trace_roots: [
    'organizationId',
    'projectId',
    'traceId',
    'spanId',
    'dedupeKey',
    'startedAt',
    'endedAt',
    'environment',
    'entityType',
    'entityName',
    'threadId',
    'userId',
    'metadataSearch',
    'metadataRaw',
    'parentSpanId',
  ],
  mastra_span_events: ['organizationId', 'projectId', 'traceId', 'spanId', 'spanType', 'name', 'endedAt', 'dedupeKey'],
};

/** Extracts `INDEX name expr TYPE type GRANULARITY n` clauses from a CREATE TABLE statement. */
export function parseSkipIndexes(table: string, ddl: string) {
  return [...ddl.matchAll(/\bINDEX\s+(\S+)\s+(.+?)\s+TYPE\s+(.+?)\s+GRANULARITY\s+\d+/g)].map(m => ({
    table,
    name: m[1]!.replace(/`/g, ''),
    expr: m[2]!,
    type: m[3]!,
  }));
}

/**
 * `readonly=2` is required unless `acceptReadonly0` is set. That opt-in exists for a service that is
 * read-only compute at the service level: the session itself may write, so the only statement guard
 * left in the harness is the client allowlist. `readonly=1` is always refused (it rejects the limits).
 */
export async function preflight(
  client: BenchClient,
  ctx: Pick<Context, 'runId'> & { acceptReadonly0?: boolean },
): Promise<Preflight> {
  const tier = TIERS[1];
  const comment = (step: string) => `aqa-bench:${ctx.runId}:preflight:${step}`;

  // 1. Read-only check. readonly=1 rejects the per-query limits, which surfaces as code 164.
  const ro = await client.rows<{ ro: string; v: string }>(
    "SELECT getSetting('readonly') AS ro, version() AS v",
    {},
    { tier, logComment: comment('readonly') },
  );
  if (!ro.ok) {
    if (ro.errorCode === '164') throw new Error('Session is readonly=1: per-query limits are rejected. Aborting.');
    throw new Error(`Read-only check failed (code ${ro.errorCode ?? '?'}). Aborting.`);
  }
  const readonly = Number(ro.rows![0]!.ro);
  if (readonly === 0 && ctx.acceptReadonly0) {
    log(
      'WARNING: session readonly=0 accepted (--accept-readonly-0); relying on the read-only service and the client allowlist',
    );
  } else if (readonly !== 2) {
    throw new Error(
      `Session readonly=${readonly}; the harness requires readonly=2 (or readonly=0 with --accept-readonly-0). Aborting.`,
    );
  }
  log(`readonly=${readonly}, ClickHouse ${ro.rows![0]!.v}`);

  // 2. query_log access (metric columns only).
  let queryLog: QueryLogSource = 'none';
  for (const source of ['cluster', 'local'] as const) {
    const metrics = await collectMetrics(
      client,
      source,
      ro as QueryOutcome<unknown>,
      tier,
      comment('query_log'),
      30_000,
    );
    if (metrics.source === 'query_log') {
      queryLog = source;
      break;
    }
  }
  log(`query_log source: ${queryLog}`);

  // 3. Database detection by table name.
  const located = await client.rows<{ database: string; name: string }>(
    'SELECT database, name FROM system.tables WHERE name = {t:String}',
    { t: 'mastra_trace_roots' },
    { tier, logComment: comment('databases') },
  );
  const databases = [...new Set((located.rows ?? []).map(r => r.database))];
  if (databases.length !== 1)
    throw new Error(`Expected exactly one database with mastra_trace_roots, found ${databases.length}`);
  const database = databases[0]!;

  // 4. Schema metadata: tables, columns, skip indexes. No row data.
  const tables = await client.rows<{
    name: string;
    sorting_key: string;
    partition_key: string;
    total_rows: string;
    total_bytes: string;
    create_table_query: string;
  }>(
    'SELECT name, sorting_key, partition_key, total_rows, total_bytes, create_table_query FROM system.tables WHERE database = {db:String} AND name IN {t:Array(String)}',
    { db: database, t: [...TABLES] },
    { tier, logComment: comment('tables') },
  );
  const columnRows = await client.rows<{ table: string; name: string }>(
    'SELECT table, name FROM system.columns WHERE database = {db:String} AND table IN {t:Array(String)}',
    { db: database, t: [...TABLES] },
    { tier, logComment: comment('columns') },
  );
  const indexes = await client.rows<{ table: string; name: string; type: string; expr: string }>(
    'SELECT table, name, type, expr FROM system.data_skipping_indices WHERE database = {db:String} AND table IN {t:Array(String)}',
    { db: database, t: [...TABLES] },
    { tier, logComment: comment('indexes') },
  );
  for (const outcome of [tables, columnRows]) {
    if (!outcome.ok) throw new Error(`Schema metadata query failed (code ${outcome.errorCode ?? '?'})`);
  }
  // Without access to system.data_skipping_indices, read the INDEX clauses from the table DDL.
  const skipIndexes = indexes.ok
    ? indexes.rows!
    : tables.rows!.flatMap(t => parseSkipIndexes(t.name, t.create_table_query));
  const skipIndexSource: Preflight['skipIndexSource'] = indexes.ok ? 'data_skipping_indices' : 'create_table_query';
  const columns: Record<string, string[]> = {};
  for (const row of columnRows.rows!) (columns[row.table] ??= []).push(row.name);
  const missingColumns: Record<string, string[]> = {};
  for (const [table, required] of Object.entries(REQUIRED_COLUMNS)) {
    const missing = required.filter(column => !columns[table]?.includes(column));
    if (missing.length) missingColumns[table] = missing;
  }
  const present = new Set(tables.rows!.map(t => t.name));
  return {
    checkedAt: new Date().toISOString(),
    readonly,
    version: ro.rows![0]!.v,
    queryLog,
    database,
    tables: tables.rows!.map(t => ({
      name: t.name,
      sortingKey: t.sorting_key,
      partitionKey: t.partition_key,
      totalRows: Number(t.total_rows),
      totalBytes: Number(t.total_bytes),
    })),
    missingTables: TABLES.filter(t => !present.has(t)),
    missingColumns,
    skipIndexes,
    skipIndexSource,
    columns,
  };
}

// ---------------------------------------------------------------------------
// profile
// ---------------------------------------------------------------------------

export async function profile(ctx: Context, pre: Preflight): Promise<Selection> {
  const to = anchorTo(new Date());
  const profileCtx: ProfileContext = {
    client: ctx.client,
    tier: ctx.tier,
    logComment: step => logComment(ctx, 'profile', step),
    pause: async () => {
      await pause(ctx);
      ctx.lastQueryEnd = Date.now();
    },
  };
  const g = await gauge(profileCtx, to);
  log(`1-day gauge: ${g.projects} projects, ${g.traces} traces, ${Math.round(g.wallMs)} ms`);
  const d = await distribution(profileCtx, to);
  log(
    `30-day distribution: ${d.projects} projects; p25=${d.p25} p50=${d.p50} p75=${d.p75} p90=${d.p90} p99=${d.p99} max=${d.max}`,
  );
  const picked = pickProjects(await candidates(profileCtx, to, d));
  const salt = newSalt();
  const columnSets: TableColumns = Object.fromEntries(Object.entries(pre.columns).map(([t, c]) => [t, new Set(c)]));
  const projects: SelectedProject[] = [];
  for (const candidate of picked) {
    const stats = await projectStats(profileCtx, to, candidate, columnSets);
    const { literals, literalSource } = await discoverLiterals(profileCtx, to, candidate);
    const project: SelectedProject = {
      bucket: candidate.bucket,
      organizationId: candidate.organizationId,
      projectId: candidate.projectId,
      hash: projectHash(salt, candidate),
      representative: candidate.representative ?? false,
      stats,
      literals,
      literalSource,
    };
    projects.push(project);
    log(`selected ${project.bucket}:${project.hash} (~${Number(stats.traces30d.toPrecision(2))} traces/30d)`);
  }
  return {
    version: 1,
    salt,
    database: pre.database,
    profiledAt: new Date().toISOString(),
    anchorTo: to.toISOString(),
    distribution: d,
    projects,
  };
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

export interface RunFilter {
  buckets: Bucket[];
  windows: Array<'1d' | '7d' | '30d'>;
  groups?: string[];
  cases?: string[];
  gateBApproved: boolean;
}

interface Planned {
  def: CaseDef;
  variant: Variant;
  window: WindowDef;
  project: SelectedProject;
}

export function planRuns(selection: Pick<Selection, 'projects'>, filter: RunFilter): Planned[] {
  const out: Planned[] = [];
  for (const bucket of BUCKETS.filter(b => filter.buckets.includes(b))) {
    const projects = selection.projects.filter(p => p.bucket === bucket);
    for (const stage of WINDOW_ORDER.filter(w => filter.windows.includes(w))) {
      const defs = CASES.filter(
        def =>
          (!filter.groups || filter.groups.includes(def.group)) && (!filter.cases || filter.cases.includes(def.id)),
      ).sort((a, b) => a.cost - b.cost);
      for (const def of defs) {
        for (const window of def.windows.filter(w => windowStage(w) === stage)) {
          if (!filter.gateBApproved && needsGateB(def, window, bucket)) continue;
          for (const project of projects.filter(p => def.core || p.representative)) {
            for (const variant of def.variants) out.push({ def, variant, window, project });
          }
        }
      }
    }
  }
  return out;
}

function repsFor(bucket: Bucket): number {
  return bucket === 'p99' || bucket === 'largest' ? 4 : 6;
}

async function measure(
  ctx: Context,
  sql: string,
  params: Record<string, unknown>,
  comment: string,
  cold: boolean,
): Promise<{ outcome: QueryOutcome; metrics: QueryMetrics }> {
  await pause(ctx);
  const outcome = await ctx.client.discard(sql, params, { tier: ctx.tier, logComment: comment, cold });
  ctx.lastQueryEnd = Date.now();
  const metrics = await collectMetrics(ctx.client, ctx.queryLog, outcome, ctx.tier, `${comment}:metrics`);
  return { outcome, metrics };
}

/** Page keys for the payload stage: the exact list query wrapped to project only key columns. */
async function pageKeys(
  ctx: Context,
  sql: string,
  params: Record<string, unknown>,
  comment: string,
): Promise<PageKey[]> {
  await pause(ctx);
  const outcome = await ctx.client.rows<PageKey>(
    `SELECT toString(traceId) AS traceId, toString(rootSpanId) AS rootSpanId, startedAt, endedAt FROM (${sql}) WHERE __metadata = 0`,
    params,
    { tier: ctx.tier, logComment: comment },
  );
  ctx.lastQueryEnd = Date.now();
  if (!outcome.ok) throw new Error(`Page key query failed (code ${outcome.errorCode ?? '?'})`);
  return outcome.rows!.map(row => ({
    ...row,
    startedAt: new Date(row.startedAt).toISOString(),
    endedAt: new Date(row.endedAt).toISOString(),
  }));
}

export async function runCases(ctx: Context, selection: Selection, filter: RunFilter) {
  const to = new Date(selection.anchorTo);
  const existing = readRecords(ctx.resultsFile);
  const done = new Set(existing.map(r => r.key));
  const hits = new Map<string, LimitHit[]>();
  for (const record of existing) {
    if (!record.ok && !record.cold && record.errorCategory && isLimitCategory(record.errorCategory)) {
      const k = `${record.caseId}|${record.variant}`;
      hits.set(k, [...(hits.get(k) ?? []), { bucket: record.bucket, windowMs: record.windowMs }]);
    }
  }
  const planned = planRuns(selection, filter);
  log(`${planned.length} case/variant/window/project combinations planned (${done.size} keys already recorded)`);
  mkdirSync(RESULTS_DIR, { recursive: true });
  let consecutiveErrors = 0;

  for (const { def, variant, window, project } of planned) {
    const hitKey = `${def.id}|${variant}`;
    if (skippedByEscalation(hits.get(hitKey) ?? [], project.bucket, window)) {
      log(`skip ${def.id}/${variant}/${window.id} on ${project.bucket}:${project.hash} (escalation rule)`);
      continue;
    }
    const compiled = compileCase(def, variant, project.literals, timeRangeFor(window, to), project);
    const stages: Stage[] = def.kind === 'traces' ? ['main', 'payload', 'payload-scoped'] : ['main'];
    let payloadKeys: PageKey[] | undefined;

    for (const stage of stages) {
      const key = recordKey(def.id, variant, stage, window.id, project.hash);
      if (done.has(key)) continue;
      let sql = compiled.query;
      let params: Record<string, unknown> = compiled.query_params;
      if (stage !== 'main') {
        payloadKeys ??= await pageKeys(
          ctx,
          compiled.query,
          compiled.query_params,
          logComment(ctx, def.id, 'keys', project.bucket, project.hash),
        );
        if (payloadKeys.length === 0) {
          log(`skip ${def.id}/${stage}/${window.id} on ${project.bucket}:${project.hash} (empty page)`);
          continue;
        }
        const payload = compilePayloadStage(payloadKeys, project, stage === 'payload-scoped');
        sql = payload.query;
        params = payload.query_params;
      }
      const label = `${def.id}${variant === 'base' ? '' : `-${variant}`}${stage === 'main' ? '' : `:${stage}`}`;
      for (let rep = 0; rep < (ctx.reps ?? repsFor(project.bucket)); rep++) {
        const cold = rep === 0;
        const comment = logComment(ctx, label, window.id, project.bucket, project.hash, rep);
        const { outcome, metrics } = await measure(ctx, sql, params, comment, cold);
        const record: RunRecord = {
          runId: ctx.runId,
          key,
          caseId: def.id,
          group: def.group,
          variant,
          stage,
          window: window.id,
          windowMs: window.ms,
          bucket: project.bucket,
          hash: project.hash,
          traces30d: project.stats.traces30d,
          rep,
          cold,
          tier: ctx.tier.id,
          anchorTo: selection.anchorTo,
          ts: new Date().toISOString(),
          ok: outcome.ok,
          errorCode: outcome.errorCode,
          errorCategory: outcome.errorCategory,
          wallMs: Math.round(outcome.wallMs),
          streamedRows: outcome.streamedRows,
          metrics,
        };
        appendFileSync(ctx.resultsFile, `${JSON.stringify(record)}\n`);
        const status = outcome.ok
          ? `${Math.round(metrics.durationMs)} ms, ${(metrics.readBytes / 1e6).toFixed(1)} MB read, ${((metrics.memoryBytes ?? 0) / 2 ** 20).toFixed(0)} MiB`
          : `FAILED ${outcome.errorCategory} (code ${outcome.errorCode ?? '?'})${ctx.verbose ? `: ${outcome.errorMessage}` : ''}`;
        log(`${project.bucket}:${project.hash} ${label} ${window.id} rep${rep}${cold ? ' cold' : ''}: ${status}`);
        if (outcome.ok) {
          consecutiveErrors = 0;
          continue;
        }
        if (outcome.errorCategory && isLimitCategory(outcome.errorCategory)) {
          // A cold read from object storage can exceed limits that warm runs stay well inside; keep
          // measuring warm, and only let warm limit hits drive the escalation rule.
          if (cold) continue;
          hits.set(hitKey, [...(hits.get(hitKey) ?? []), { bucket: project.bucket, windowMs: window.ms }]);
          break;
        }
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          throw new Error(`Aborting: ${MAX_CONSECUTIVE_ERRORS} consecutive non-limit errors`);
        }
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function list<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T[]): T[] {
  if (!value) return fallback;
  const items = value.split(',').map(s => s.trim()) as T[];
  for (const item of items) if (!allowed.includes(item)) throw new Error(`Unknown value ${item}`);
  return items;
}

async function main(): Promise<void> {
  installOutputRedaction();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      buckets: { type: 'string' },
      windows: { type: 'string' },
      groups: { type: 'string' },
      cases: { type: 'string' },
      tier: { type: 'string', default: '1' },
      'gate-b-approved': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'tier-3-approved': { type: 'boolean', default: false },
      'accept-readonly-0': { type: 'boolean', default: false },
    },
  });
  const command = positionals[0];
  const runId = randomUUID().slice(0, 8);

  if (command === 'report') {
    const { writeReport } = await import('./report');
    writeReport();
    return;
  }

  const tierId = Number(values.tier) as 1 | 2 | 3;
  if (!TIERS[tierId]) throw new Error('--tier must be 1, 2 or 3');
  if (tierId === 3 && !values['tier-3-approved']) throw new Error('Tier 3 requires explicit approval');

  if (command === 'run' && values['dry-run']) {
    const selection = loadSelection();
    if (!selection) throw new Error('No selection; run `profile` first');
    const planned = planRuns(selection, parseFilter(values));
    for (const p of planned) log(`${p.project.bucket}:${p.project.hash} ${p.def.id}/${p.variant}/${p.window.id}`);
    log(`${planned.length} combinations`);
    return;
  }

  const credentials = loadCredentials();
  if (command === 'preflight') {
    const client = connect(credentials);
    try {
      const result = await preflight(client, { runId, acceptReadonly0: values['accept-readonly-0'] });
      writeJson(PREFLIGHT_FILE, result);
      log(
        `database detected; ${result.tables.length}/${TABLES.length} tables present, missing: ${result.missingTables.join(', ') || 'none'}`,
      );
      log(`missing required columns: ${JSON.stringify(result.missingColumns)}`);
      log(`skip indexes: ${result.skipIndexes.map(i => `${i.table}.${i.name}(${i.type})`).join(', ') || 'none'}`);
      for (const t of result.tables)
        log(
          `  ${t.name}: ORDER BY (${t.sortingKey}) PARTITION BY ${t.partitionKey}; ~${Number(t.totalRows.toPrecision(2))} rows`,
        );
    } finally {
      await client.close();
    }
    return;
  }

  if (!existsSync(PREFLIGHT_FILE)) throw new Error('Run `preflight` first');
  const pre = readJson<Preflight>(PREFLIGHT_FILE);
  if (Object.keys(pre.missingColumns).length) throw new Error('Preflight reported missing required columns');
  const client = connect(credentials, pre.database);
  const ctx: Context = {
    client,
    queryLog: pre.queryLog,
    runId,
    tier: TIERS[tierId],
    lastQueryEnd: 0,
    resultsFile: RESULTS_FILE,
    pauseMs: PAUSE_MS,
  };
  try {
    // Every session re-verifies that its readonly level is the one preflight accepted.
    await preflightReadonly(client, runId, pre.readonly);
    if (command === 'profile') {
      if (loadSelection()) throw new Error('A selection already exists; delete it deliberately to re-profile');
      const selection = await profile(ctx, pre);
      saveSelection(selection);
      writeJson(PROFILE_FILE, publicProfile(selection));
      log(`profile saved (${selection.projects.length} projects)`);
    } else if (command === 'run') {
      const selection = loadSelection();
      if (!selection) throw new Error('No selection; run `profile` first');
      await runCases(ctx, selection, parseFilter(values));
    } else {
      throw new Error('Usage: run.ts preflight | profile | run --buckets … | report');
    }
  } finally {
    await client.close();
  }
}

export async function preflightReadonly(client: BenchClient, runId: string, expected: number): Promise<void> {
  const ro = await client.rows<{ ro: string }>(
    "SELECT getSetting('readonly') AS ro",
    {},
    {
      tier: TIERS[1],
      logComment: `aqa-bench:${runId}:readonly`,
    },
  );
  if (expected !== 0 && expected !== 2) throw new Error('Preflight recorded an unsupported readonly level. Aborting.');
  if (!ro.ok || Number(ro.rows?.[0]?.ro) !== expected) {
    throw new Error(`Session readonly level differs from preflight (expected ${expected}). Aborting.`);
  }
}

function parseFilter(values: Record<string, string | boolean | undefined>): RunFilter {
  if (!values.buckets) throw new Error('--buckets is required');
  return {
    buckets: list(values.buckets as string, BUCKETS, []),
    windows: list(values.windows as string | undefined, WINDOW_ORDER, [...WINDOW_ORDER]),
    groups: values.groups ? (values.groups as string).split(',') : undefined,
    cases: values.cases ? (values.cases as string).split(',') : undefined,
    gateBApproved: Boolean(values['gate-b-approved']),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
