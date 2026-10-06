/**
 * Suite-independent runner pieces: logging, records, escalation, pacing, measurement, preflight
 * and the per-session readonly check. Suites own their case catalogue, record shape and CLI.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { BenchClient, TIERS } from './client';
import type { QueryOutcome, Tier } from './client';
import type { BenchCredentials } from './env';
import { collectMetrics } from './metrics';
import type { QueryLogSource, QueryMetrics } from './metrics';
import { BUCKETS } from './profile';
import type { Bucket } from './profile';

export const PAUSE_MS = 2_000;
export const MAX_CONSECUTIVE_ERRORS = 3;

export const DEFAULT_TABLES = [
  'mastra_trace_roots',
  'mastra_span_events',
  'mastra_metric_events',
  'mastra_score_events_current',
  'mastra_feedback_events',
] as const;

export const WINDOW_ORDER = ['1d', '7d', '30d'] as const;
export type WindowStage = (typeof WINDOW_ORDER)[number];

export interface WindowDef {
  id: string;
  ms: number;
}

export function log(message: string): void {
  process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${message}\n`);
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

export function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function readRecords<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as T);
}

export function connect(credentials: BenchCredentials, database?: string, maxOpenConnections = 1): BenchClient {
  return new BenchClient({ ...credentials, database: database ?? credentials.database }, maxOpenConnections);
}

export function list<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T[]): T[] {
  if (!value) return fallback;
  const items = value.split(',').map(s => s.trim()) as T[];
  for (const item of items) if (!allowed.includes(item)) throw new Error(`Unknown value ${item}`);
  return items;
}

/** Stage of the run order a window belongs to (interval windows have custom lengths). */
export function windowStage(window: WindowDef): WindowStage {
  if (window.ms <= 86_400_000) return '1d';
  if (window.ms <= 7 * 86_400_000) return '7d';
  return '30d';
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
// Sequential context (one query at a time)
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

export async function pause(ctx: Pick<Context, 'lastQueryEnd' | 'pauseMs'>): Promise<void> {
  const wait = ctx.lastQueryEnd + ctx.pauseMs - Date.now();
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
}

export function logComment(ctx: Pick<Context, 'runId'>, ...parts: Array<string | number>): string {
  return ['aqa-bench', ctx.runId, ...parts].join(':');
}

export async function measure(
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

export const DEFAULT_REQUIRED_COLUMNS: Record<string, string[]> = {
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
  options: { tables?: readonly string[]; requiredColumns?: Record<string, string[]> } = {},
): Promise<Preflight> {
  const TABLES = options.tables ?? DEFAULT_TABLES;
  const REQUIRED_COLUMNS = options.requiredColumns ?? DEFAULT_REQUIRED_COLUMNS;
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

export function logPreflight(result: Preflight, tableCount: number): void {
  log(
    `database detected; ${result.tables.length}/${tableCount} tables present, missing: ${result.missingTables.join(', ') || 'none'}`,
  );
  log(`missing required columns: ${JSON.stringify(result.missingColumns)}`);
  log(`skip indexes: ${result.skipIndexes.map(i => `${i.table}.${i.name}(${i.type})`).join(', ') || 'none'}`);
  for (const t of result.tables)
    log(
      `  ${t.name}: ORDER BY (${t.sortingKey}) PARTITION BY ${t.partitionKey}; ~${Number(t.totalRows.toPrecision(2))} rows`,
    );
}
