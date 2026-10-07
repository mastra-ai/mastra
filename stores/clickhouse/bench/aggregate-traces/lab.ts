/**
 * Local lab for query-shape experiments: a ClickHouse 26.4 container loaded with synthetic data shaped like the
 * replica (same DDL, same per-project volumes, same column widths, same token-row duplicate rate). No customer
 * data leaves the replica: `calibrate` reads DDL, column sizes and counts only.
 *
 *   tsx bench/aggregate-traces/lab.ts calibrate     # prod: DDL + aggregate shape stats -> results/lab-calibration.json
 *   tsx bench/aggregate-traces/lab.ts up            # local: start container, create schema
 *   tsx bench/aggregate-traces/lab.ts load          # local: generate synthetic data
 *   tsx bench/aggregate-traces/lab.ts pull          # prod -> local: replace the calibrated projects with real rows
 *
 * `pull` copies only the columns the compiled queries filter, group or join on. Identifiers and free-text values are
 * replaced on the replica by a salted hash (the salt lives in memory for one run); payload columns are never read and
 * are regenerated locally at the replica's average widths. Timestamps, numeric values and enum-like columns are kept.
 *   tsx bench/aggregate-traces/lab.ts down          # local: remove container
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { ClickHouseLogLevel, createClient } from '@clickhouse/client';
import { TokenMetrics } from '@mastra/core/observability';

import { CASES, compileCase, timeRangeFor } from './cases';
import { BenchClient, TIERS } from './client';
import { installOutputRedaction, loadCredentials } from './env';
import { BUCKETS, loadSelection } from './profile';
import type { Bucket, Selection } from './profile';
import { PREFLIGHT_FILE, RESULTS_DIR } from './run';
import {
  RewriteError,
  SPAN_NAME_INDEX_TABLE,
  USAGE_COST_NAMES,
  USAGE_ROLLUP_COLUMNS,
  USAGE_ROLLUP_TABLE,
} from './scope';
import type { Variant } from './scope';

export const CALIBRATION_FILE = `${RESULTS_DIR}/lab-calibration.json`;
export const LAB_SELECTION_FILE = `${RESULTS_DIR}/lab-selection.json`;

export const LAB = {
  container: 'aqa-bench-lab',
  image: 'clickhouse/clickhouse-server:26.4',
  port: 18123,
  url: 'http://localhost:18123',
  username: 'default',
  password: 'lab',
  database: 'lab',
} as const;

export const LAB_TABLES = [
  'mastra_trace_roots',
  'mastra_span_events',
  'mastra_metric_events',
  'mastra_feedback_events',
] as const;

const DAY = 86_400_000;
const CHUNK = 1024;
/** Keeps generation inside a laptop's docker VM: small blocks, one insert thread. */
const INSERT_SETTINGS = [
  'max_partitions_per_insert_block = 1000',
  // One chunk row per source block, so arrayJoin(range(lo, hi)) emits at most CHUNK rows at a time.
  'max_block_size = 1',
  'max_insert_block_size = 16384',
  'min_insert_block_size_rows = 16384',
  'min_insert_block_size_bytes = 67108864',
  'max_threads = 1',
  'max_insert_threads = 1',
].join(', ');
const TOKEN_NAMES = Object.values(TokenMetrics);

interface ColumnSize {
  table: string;
  name: string;
  type: string;
  compressed: number;
  uncompressed: number;
}

export interface ProjectShape {
  bucket: Bucket;
  hash: string;
  representative: boolean;
  traces: number;
  rootRows: number;
  spans: number;
  spanRows: number;
  spanNames: number;
  tokenRows: number;
  tokenMetricIds: number;
  tokenTraces: number;
  threads: number;
  entityNames: number;
}

export interface Calibration {
  calibratedAt: string;
  anchorTo: string;
  version: string;
  ddl: Record<string, string>;
  tables: Record<string, { rows: number; bytes: number; parts?: number }>;
  columns: ColumnSize[];
  distribution: { p25: number; p50: number; p75: number; p90: number; p99: number; max: number; projects: number };
  projects: ProjectShape[];
}

// ---------------------------------------------------------------------------
// calibrate (prod, read-only, aggregate-only)
// ---------------------------------------------------------------------------

const SHAPE_SQL = {
  roots: `SELECT count() AS rows, uniqExact(traceId) AS traces, uniq(threadId) AS threads, uniq(entityName) AS names
    FROM mastra_trace_roots WHERE organizationId = {o:String} AND projectId = {p:String}
      AND startedAt >= {from:DateTime64(3, 'UTC')} AND startedAt < {to:DateTime64(3, 'UTC')}`,
  spans: `SELECT count() AS rows, uniqExact(dedupeKey) AS spans, uniq(name) AS names
    FROM mastra_span_events WHERE organizationId = {o:String} AND projectId = {p:String}
      AND endedAt >= {from:DateTime64(3, 'UTC')} AND endedAt < {to:DateTime64(3, 'UTC')}`,
  tokens: `SELECT count() AS rows, uniqExact(metricId) AS ids, uniqExact(traceId) AS traces
    FROM mastra_metric_events WHERE organizationId = {o:String} AND projectId = {p:String}
      AND timestamp >= {from:DateTime64(3, 'UTC')} AND timestamp < {to:DateTime64(3, 'UTC')}
      AND name IN {names:Array(String)}`,
};

const chTime = (d: Date) => d.toISOString().replace('T', ' ').replace(/Z$/, '');

async function calibrate(): Promise<void> {
  const selection = loadSelection();
  if (!selection) throw new Error('No selection; run profile first');
  const preflight = JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string; version: string };
  const client = new BenchClient({ ...loadCredentials(), database: preflight.database });
  const tier = TIERS[1];
  const comment = (what: string) => `aqa-bench:lab-calibrate:${what}`;
  const must = async <Row>(sql: string, params: Record<string, unknown>, what: string) => {
    const out = await client.rows<Row>(sql, params, { tier, logComment: comment(what) });
    if (!out.ok) throw new Error(`calibrate ${what} failed (code ${out.errorCode})`);
    return out.rows ?? [];
  };

  try {
    const tables = await must<{ name: string; create_table_query: string; total_rows: string; total_bytes: string }>(
      `SELECT name, create_table_query, total_rows, total_bytes FROM system.tables
       WHERE database = currentDatabase() AND name IN {t:Array(String)}`,
      { t: [...LAB_TABLES] },
      'tables',
    );
    const columns = await must<{
      table: string;
      name: string;
      type: string;
      data_compressed_bytes: string;
      data_uncompressed_bytes: string;
    }>(
      `SELECT table, name, type, data_compressed_bytes, data_uncompressed_bytes FROM system.columns
       WHERE database = currentDatabase() AND table IN {t:Array(String)}`,
      { t: [...LAB_TABLES] },
      'columns',
    );

    const to = new Date(selection.anchorTo);
    const from = new Date(to.getTime() - 30 * DAY);
    const projects: ProjectShape[] = [];
    for (const p of selection.projects) {
      const params = { o: p.organizationId, p: p.projectId, from: chTime(from), to: chTime(to), names: TOKEN_NAMES };
      const [r] = await must<{ rows: string; traces: string; threads: string; names: string }>(
        SHAPE_SQL.roots,
        params,
        `roots:${p.hash}`,
      );
      const [s] = await must<{ rows: string; spans: string; names: string }>(
        SHAPE_SQL.spans,
        params,
        `spans:${p.hash}`,
      );
      const [t] = await must<{ rows: string; ids: string; traces: string }>(
        SHAPE_SQL.tokens,
        params,
        `tokens:${p.hash}`,
      );
      projects.push({
        bucket: p.bucket,
        hash: p.hash,
        representative: p.representative,
        traces: Number(r!.traces),
        rootRows: Number(r!.rows),
        threads: Number(r!.threads),
        entityNames: Number(r!.names),
        spans: Number(s!.spans),
        spanRows: Number(s!.rows),
        spanNames: Number(s!.names),
        tokenRows: Number(t!.rows),
        tokenMetricIds: Number(t!.ids),
        tokenTraces: Number(t!.traces),
      });
      process.stdout.write(`calibrated ${p.bucket}:${p.hash}\n`);
      await new Promise(res => setTimeout(res, 2_000));
    }

    const d = selection.distribution;
    const calibration: Calibration = {
      calibratedAt: new Date().toISOString(),
      anchorTo: selection.anchorTo,
      version: preflight.version,
      ddl: Object.fromEntries(tables.map(t => [t.name, t.create_table_query])),
      tables: Object.fromEntries(
        tables.map(t => [t.name, { rows: Number(t.total_rows), bytes: Number(t.total_bytes) }]),
      ),
      columns: columns.map(c => ({
        table: c.table,
        name: c.name,
        type: c.type,
        compressed: Number(c.data_compressed_bytes),
        uncompressed: Number(c.data_uncompressed_bytes),
      })),
      distribution: { p25: d.p25, p50: d.p50, p75: d.p75, p90: d.p90, p99: d.p99, max: d.max, projects: d.projects },
      projects,
    };
    writeFileSync(CALIBRATION_FILE, JSON.stringify(calibration, null, 2));
    process.stdout.write(`wrote ${CALIBRATION_FILE}\n`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// local container
// ---------------------------------------------------------------------------

function docker(args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8' }).trim();
}

/** Writable client for the local lab only; refuses anything but localhost. */
export function labAdmin() {
  if (new URL(LAB.url).hostname !== 'localhost') throw new Error('lab admin client must target localhost');
  return createClient({
    url: LAB.url,
    username: LAB.username,
    password: LAB.password,
    request_timeout: 900_000,
    clickhouse_settings: { wait_end_of_query: 1 },
    log: { level: ClickHouseLogLevel.OFF },
  });
}

/** Platform DDL -> plain local engines; TTLs dropped so synthetic data at the replica's anchor survives. */
export function localDdl(ddl: string, database: string): string {
  return ddl
    .replace(/^CREATE TABLE \S+\.(\S+)/, `CREATE TABLE IF NOT EXISTS ${database}.$1`)
    .replace(/Shared(\w*)MergeTree\([^)]*\)/, '$1MergeTree')
    .replace(/ TTL .+? (?=SETTINGS )/, ' ');
}

async function up(): Promise<void> {
  const calibration = readCalibration();
  // Few background merges: thousands of freshly generated parts would otherwise merge in parallel and OOM the VM.
  const config = `${RESULTS_DIR}/lab-server.xml`;
  writeFileSync(
    config,
    [
      '<clickhouse>',
      // Server-wide cap below the container limit, so a large query fails with MEMORY_LIMIT_EXCEEDED, not OOM-kill.
      '<max_server_memory_usage>4000000000</max_server_memory_usage>',
      '<mark_cache_size>268435456</mark_cache_size>',
      // Count allocations, not RSS (RSS includes ~1.3 GiB of code, shared pages and allocator slack at idle).
      '<memory_worker_correct_memory_tracker>0</memory_worker_correct_memory_tracker>',
      // System logs other than query_log only add idle memory; the docker VM has little to spare.
      ...[
        'text_log',
        'trace_log',
        'metric_log',
        'asynchronous_metric_log',
        'query_metric_log',
        'latency_log',
        'error_log',
        'part_log',
        'processors_profile_log',
        'opentelemetry_span_log',
        'query_thread_log',
        'query_views_log',
        'session_log',
        'backup_log',
        'blob_storage_log',
        'asynchronous_insert_log',
        'crash_log',
        'zookeeper_log',
        'transactions_info_log',
        'filesystem_cache_log',
        'background_schedule_pool_log',
        'dead_letter_queue',
      ].map(log => `<${log} remove="1"/>`),
      '<background_pool_size>2</background_pool_size>',
      '<background_merges_mutations_concurrency_ratio>1</background_merges_mutations_concurrency_ratio>',
      '<merge_tree>',
      '<number_of_free_entries_in_pool_to_execute_mutation>1</number_of_free_entries_in_pool_to_execute_mutation>',
      '<number_of_free_entries_in_pool_to_lower_max_size_of_merge>1</number_of_free_entries_in_pool_to_lower_max_size_of_merge>',
      '<number_of_free_entries_in_pool_to_execute_optimize_entire_partition>1</number_of_free_entries_in_pool_to_execute_optimize_entire_partition>',
      '</merge_tree>',
      '</clickhouse>',
    ].join('\n'),
  );
  const running = docker(['ps', '-a', '--filter', `name=^${LAB.container}$`, '--format', '{{.Names}}']);
  if (!running) {
    docker([
      'run',
      '-d',
      '--name',
      LAB.container,
      '-p',
      `${LAB.port}:8123`,
      '-e',
      `CLICKHOUSE_PASSWORD=${LAB.password}`,
      '-e',
      'CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1',
      '-v',
      `${config}:/etc/clickhouse-server/config.d/lab.xml:ro`,
      '--memory',
      '6g',
      '--ulimit',
      'nofile=262144:262144',
      LAB.image,
    ]);
  } else {
    docker(['start', LAB.container]);
  }
  const admin = labAdmin();
  try {
    for (let i = 0; ; i++) {
      try {
        await admin.ping();
        await admin.query({ query: 'SELECT 1' });
        break;
      } catch {
        if (i > 60) throw new Error('lab container did not come up');
        await new Promise(res => setTimeout(res, 1_000));
      }
    }
    await admin.command({ query: `CREATE DATABASE IF NOT EXISTS ${LAB.database}` });
    for (const table of LAB_TABLES) {
      const ddl = calibration.ddl[table];
      if (!ddl) continue;
      await admin.command({ query: localDdl(ddl, LAB.database) });
    }
    const version = await (
      await admin.query({ query: 'SELECT version() AS v', format: 'JSONEachRow' })
    ).json<{
      v: string;
    }>();
    process.stdout.write(`lab up: ${LAB.url} (ClickHouse ${version[0]?.v}), database ${LAB.database}\n`);
  } finally {
    await admin.close();
  }
}

// ---------------------------------------------------------------------------
// load: synthetic data with the replica's shape
// ---------------------------------------------------------------------------

/** Days of history to generate; the replica holds ~1.38x its 30-day trace volume. */
const HISTORY_DAYS = 41;
const FILLER = { spansPerTrace: 10.5, tokenRowsPerTrace: 5, tokenShare: 0.5, threadShare: 0.3, otherMetricRows: 0 };
const LAB_LITERALS = { environment: 'production', tool: 'tool-0', metadataKey: 'tenant', entityType: 'agent' };

export interface LabProject {
  k: number;
  bucket?: Bucket;
  hash?: string;
  representative?: boolean;
  traces: number;
  spans: number;
  spanNames: number;
  tokenRows: number;
  tokenTraces: number;
  threads: number;
  entities: number;
}

/** Project sizes for the whole tenant population: calibrated projects plus filler drawn from the distribution. */
export function labProjects(c: Calibration): LabProject[] {
  const d = c.distribution;
  const points: Array<[number, number]> = [
    [0, 1],
    [0.25, d.p25],
    [0.5, d.p50],
    [0.75, d.p75],
    [0.9, d.p90],
    [0.99, d.p99],
    [1, d.max],
  ];
  const at = (q: number) => {
    const i = points.findIndex(([pq]) => pq >= q);
    if (i <= 0) return points[0]![1];
    const [q0, v0] = points[i - 1]!;
    const [q1, v1] = points[i]!;
    const t = (q - q0) / (q1 - q0);
    return Math.max(1, Math.round(Math.exp(Math.log(v0) + t * (Math.log(v1) - Math.log(v0)))));
  };
  const projects: LabProject[] = c.projects.map((p, k) => ({
    k,
    bucket: p.bucket,
    hash: p.hash,
    representative: p.representative,
    traces: p.traces,
    spans: p.spans,
    spanNames: Math.max(1, p.spanNames),
    tokenRows: p.tokenRows,
    tokenTraces: p.tokenTraces,
    threads: p.threads,
    entities: Math.max(1, p.entityNames),
  }));
  const fillers = d.projects - projects.length;
  for (let j = 0; j < fillers; j++) {
    const k = projects.length;
    // Skip the top of the tail: the calibrated p99/largest projects stand in for it.
    const traces = Math.min(at((j + 0.5) / d.projects), d.p99);
    const tokens = (k * 7919) % 100 < FILLER.tokenShare * 100;
    const threaded = (k * 104729) % 100 < FILLER.threadShare * 100;
    projects.push({
      k,
      traces,
      spans: Math.round(traces * FILLER.spansPerTrace),
      spanNames: 30,
      tokenRows: tokens ? Math.round(traces * FILLER.tokenRowsPerTrace) : 0,
      tokenTraces: tokens ? Math.round(traces * 0.9) : 0,
      threads: threaded ? Math.max(1, Math.round(traces / 20)) : 0,
      entities: 5,
    });
  }
  return projects;
}

const HEX = (expr: string) => `lower(hex(MD5(${expr})))`;
const TRACE_ID = `${HEX(`concat(toString(k), ':', toString(i))`)}`;
const UNIT = (salt: string) => `(cityHash64(tid, '${salt}') % 1000000) / 1000000.0`;
/** Mostly-compressible filler of `len` bytes at the given compression ratio. */
const FILL = (len: number, ratio: number) =>
  len <= 0
    ? 'NULL'
    : // The `cityHash64(tid) % 2` term keeps the length non-constant, so the random part is generated per row.
      `concat(randomPrintableASCII(${Math.max(1, Math.round(len / ratio))} + cityHash64(tid) % 2), repeat('a', ${Math.max(0, len - Math.round(len / ratio))}))`;

function widths(c: Calibration, table: string) {
  const rows = c.tables[table]?.rows ?? 1;
  return (name: string, fallback: number, scale: number) => {
    const col = c.columns.find(x => x.table === table && x.name === name);
    if (!col || col.uncompressed === 0) return { len: Math.round(fallback * scale), ratio: 5 };
    return {
      len: Math.round((col.uncompressed / rows) * scale),
      ratio: Math.max(1, col.uncompressed / col.compressed),
    };
  };
}

/** Per-trace fields, shared by roots, spans and metrics so they join. `t` = trace start offset in ms. */
function traceFields() {
  return `
    ${TRACE_ID} AS tid,
    toDateTime64({from:DateTime64(3, 'UTC')}, 3, 'UTC')
      + toIntervalMillisecond(toUInt64(i * ${HISTORY_DAYS * DAY} / (traces * ${HISTORY_DAYS} / 30)) + cityHash64(tid, 'j') % 60000) AS started,
    toUInt32(least(exp(5 + 5 * pow(${UNIT('d')}, 2)), 600000)) AS dur,
    started + toIntervalMillisecond(dur) AS ended,
    concat('lab-org-', toString(k)) AS org,
    concat('lab-proj-', toString(k)) AS proj`;
}

function rootsInsert(c: Calibration, scale: number): string {
  const w = widths(c, 'mastra_trace_roots');
  const payload = (name: string, fallback: number) => {
    const { len, ratio } = w(name, fallback, scale);
    return `${FILL(len, ratio)} AS ${name}`;
  };
  return `INSERT INTO ${LAB.database}.mastra_trace_roots
    (dedupeKey, traceId, spanId, entityType, entityId, entityName, userId, organizationId, resourceId, runId, sessionId,
     threadId, environment, executionSource, serviceName, name, spanType, startedAt, endedAt, tags, metadataSearch,
     attributes, input, output, error, metadataRaw, requestContext, projectId)
    SELECT concat(tid, ':', substring(tid, 1, 16)) AS dk, tid, substring(tid, 1, 16),
      if(${UNIT('et')} < 0.7, 'agent', 'workflow_run'), concat('entity-', toString(cityHash64(tid, 'en') % entities)),
      concat('entity-', toString(cityHash64(tid, 'en') % entities)), NULL, org, proj, ${HEX(`concat(tid, 'run')`)}, NULL,
      if(threads > 0, concat('thread-', toString(cityHash64(tid, 'th') % threads)), NULL),
      if(${UNIT('env')} < 0.8, 'production', 'staging'), 'api', 'lab', concat('entity-', toString(cityHash64(tid, 'en') % entities)),
      'agent_run', started, ended, [], if(${UNIT('md')} < 0.5, map('tenant', concat('t', toString(i % 7))), map()),
      ${payload('attributes', 2800)}, ${payload('input', 6200)}, ${payload('output', 840)},
      if(${UNIT('err')} < 0.05, '{"message":"lab error"}', NULL), ${payload('metadataRaw', 60)}, ${payload('requestContext', 800)},
      proj
    FROM (
      SELECT k, i, entities, threads, ${traceFields()}
      FROM (SELECT k, traces, entities, threads, arrayJoin(range(lo, hi)) AS i
            FROM ${LAB.database}.lab_chunks AS c
            WHERE c.tbl = 'roots' AND k % {batches:UInt32} = {batch:UInt32}))
    SETTINGS ${INSERT_SETTINGS}`;
}

async function load(scale: number, batches: number): Promise<void> {
  const c = readCalibration();
  const projects = labProjects(c);
  const admin = labAdmin();
  const db = LAB.database;
  const from = chTime(new Date(new Date(c.anchorTo).getTime() - HISTORY_DAYS * DAY));
  try {
    await admin.command({ query: `DROP TABLE IF EXISTS ${db}.lab_projects` });
    await admin.command({
      query: `CREATE TABLE ${db}.lab_projects (k UInt32, traces UInt64, spans UInt64, spanNames UInt32, tokenRows UInt64,
        tokenTraces UInt64, threads UInt64, entities UInt32) ENGINE = Memory`,
    });
    await admin.insert({
      table: `${db}.lab_projects`,
      values: projects.map(({ k, traces, spans, spanNames, tokenRows, tokenTraces, threads, entities }) => ({
        k,
        traces,
        spans,
        spanNames,
        tokenRows,
        tokenTraces,
        threads,
        entities,
      })),
      format: 'JSONEachRow',
    });
    const history = HISTORY_DAYS / 30;
    const chunks: Array<Record<string, number | string>> = [];
    for (const p of projects) {
      for (const [tbl, n] of [
        ['roots', p.traces],
        ['spans', p.spans],
        ['tokens', p.tokenRows],
      ] as const) {
        const total = Math.floor(n * history);
        const { k, traces, spans, spanNames, tokenRows, tokenTraces, threads, entities } = p;
        for (let lo = 0; lo < total; lo += CHUNK) {
          chunks.push({
            tbl,
            lo,
            hi: Math.min(total, lo + CHUNK),
            k,
            traces,
            spans,
            spanNames,
            tokenRows,
            tokenTraces,
            threads,
            entities,
          });
        }
      }
    }
    await admin.command({ query: `DROP TABLE IF EXISTS ${db}.lab_chunks` });
    await admin.command({
      // Project fields are denormalised here: a join would squash chunk rows into large blocks before arrayJoin.
      query: `CREATE TABLE ${db}.lab_chunks (tbl LowCardinality(String), k UInt32, lo UInt64, hi UInt64, traces UInt64,
        spans UInt64, spanNames UInt32, tokenRows UInt64, tokenTraces UInt64, threads UInt64, entities UInt32)
        ENGINE = MergeTree ORDER BY (tbl, k, lo) SETTINGS index_granularity = 1`,
    });
    await admin.insert({ table: `${db}.lab_chunks`, values: chunks, format: 'JSONEachRow' });

    rmSync(LAB_PULLED_FILE, { force: true });
    for (const table of ['mastra_trace_roots', 'mastra_span_events', 'mastra_metric_events']) {
      await admin.command({ query: `TRUNCATE TABLE ${db}.${table}` });
      await admin.command({ query: `SYSTEM STOP MERGES ${db}.${table}` });
    }

    const f = traceFields();
    const statements: Array<[string, string]> = [
      ['roots', rootsInsert(c, scale)],
      [
        'spans',
        `INSERT INTO ${db}.mastra_span_events
          (dedupeKey, traceId, spanId, parentSpanId, entityType, entityName, organizationId, resourceId, environment,
           serviceName, name, spanType, startedAt, endedAt, input, output, projectId)
        SELECT concat(tid, ':', sid), tid, sid, substring(tid, 1, 16), 'agent', 'entity-0', org, proj, 'production', 'lab',
          if(nameIdx = 0, 'tool-0', concat('span-', toString(nameIdx))),
          if(nameIdx % 3 = 0, 'tool_call', 'model_generation'),
          started + toIntervalMillisecond(toUInt64(dur * ${UNIT('so')} / 2)),
          started + toIntervalMillisecond(toUInt64(dur * (0.5 + ${UNIT('so')} / 2))),
          ${FILL(200, 5)}, ${FILL(100, 5)}, proj
        FROM (
          SELECT k, i, n, ${f},
            substring(${HEX(`concat(toString(k), ':s:', toString(n))`)}, 1, 16) AS sid,
            toUInt32(floor(spanNames * pow((cityHash64(k, n, 'nm') % 1000000) / 1000000.0, 3))) AS nameIdx
          FROM (SELECT k, traces, spanNames, arrayJoin(range(lo, hi)) AS n, toUInt64(n * traces / spans) AS i
                FROM ${db}.lab_chunks AS c
                WHERE c.tbl = 'spans' AND k % {batches:UInt32} = {batch:UInt32}))
        SETTINGS ${INSERT_SETTINGS}`,
      ],
      [
        'tokens',
        `INSERT INTO ${db}.mastra_metric_events
          (timestamp, metricId, traceId, entityType, entityName, organizationId, resourceId, environment, name, value,
           provider, model, estimatedCost, costUnit, projectId)
        SELECT ended, ${HEX(`concat(toString(k), ':m:', toString(n))`)}, tid, 'agent', 'entity-0', org, proj, 'production',
          ['${TokenMetrics.TOTAL_INPUT}', '${TokenMetrics.TOTAL_OUTPUT}', '${TokenMetrics.INPUT_CACHE_READ}', '${TokenMetrics.INPUT_TEXT}'][n % 4 + 1],
          toFloat64(cityHash64(k, n) % 5000), 'lab', 'lab-model',
          if(n % 4 < 2, toFloat64(cityHash64(k, n) % 5000) / 1e6, NULL), if(n % 4 < 2, 'USD', NULL), proj
        FROM (
          SELECT k, n, ${f}
          FROM (SELECT k, traces, arrayJoin(range(lo, hi)) AS n,
                  toUInt64(toUInt64(n * tokenTraces / tokenRows) * traces / tokenTraces) AS i
                FROM ${db}.lab_chunks AS c
                WHERE c.tbl = 'tokens' AND k % {batches:UInt32} = {batch:UInt32}))
        SETTINGS ${INSERT_SETTINGS}`,
      ],
    ];
    for (const [what, sql] of statements) {
      for (let batch = 0; batch < batches; batch++) {
        const started = performance.now();
        await admin.command({ query: sql, query_params: { from, batches, batch } });
        process.stdout.write(
          `loaded ${what} batch ${batch + 1}/${batches} in ${Math.round(performance.now() - started)} ms\n`,
        );
      }
    }

    await compact(admin);

    const counts = await (
      await admin.query({
        query: `SELECT table, sum(rows) AS rows, count() AS parts, sum(bytes_on_disk) AS bytes FROM system.parts
          WHERE database = '${db}' AND active GROUP BY table ORDER BY table`,
        format: 'JSONEachRow',
      })
    ).json<{ table: string; rows: string; parts: string; bytes: string }>();
    for (const row of counts) {
      process.stdout.write(
        `${row.table}: ${Number(row.rows).toLocaleString()} rows, ${row.parts} parts, ${(Number(row.bytes) / 1e9).toFixed(2)} GB (replica: ${(c.tables[row.table]?.rows ?? 0).toLocaleString()} rows)\n`,
      );
    }
    writeLabSelection(c, projects);
  } finally {
    await admin.close();
  }
}

// ---------------------------------------------------------------------------
// pull (prod -> local, pseudonymized)
// ---------------------------------------------------------------------------

/** Salted hash computed on the replica; NULL stays NULL. Must match `pseudo()` below. */
const H = (expr: string) =>
  `if(isNull(${expr}), NULL, concat('h', substring(lower(hex(SHA256(concat({salt:String}, toString(${expr}))))), 1, 16)))`;
const HN = (expr: string) =>
  `concat('h', substring(lower(hex(SHA256(concat({salt:String}, toString(${expr}))))), 1, 16))`;
const HMAP = (expr: string) => `mapApply((k, v) -> (${HN('k')}, ${HN('v')}), ${expr})`;
const pseudo = (salt: string, value: string) =>
  `h${createHash('sha256')
    .update(salt + value)
    .digest('hex')
    .slice(0, 16)}`;

// Source columns are qualified with `src.`: the output aliases reuse the column names and would shadow them.
const ERROR_FLAG = `if(isNull(src.error), NULL, '{"message":"x"}')`;
const META_RAW = `toJSONString(${HMAP(`CAST(JSONExtractKeysAndValues(ifNull(src.metadataRaw, '{}'), 'String'), 'Map(String, String)')`)})`;

/** Kept as-is (timestamps, numbers, enums); everything else in the list is hashed. */
const PULL = {
  mastra_trace_roots: {
    time: 'startedAt',
    keep: [
      'entityType',
      'parentEntityType',
      'rootEntityType',
      'executionSource',
      'spanType',
      'isEvent',
      'startedAt',
      'endedAt',
    ],
    hash: [
      'dedupeKey',
      'traceId',
      'spanId',
      'parentSpanId',
      'experimentId',
      'entityId',
      'entityName',
      'entityVersionId',
      'parentEntityId',
      'parentEntityName',
      'rootEntityId',
      'rootEntityName',
      'userId',
      'resourceId',
      'runId',
      'sessionId',
      'threadId',
      'requestId',
      'environment',
      'serviceName',
      'name',
    ],
    custom: {
      tags: `arrayMap(t -> ${H('t')}, src.tags)`,
      metadataSearch: HMAP('src.metadataSearch'),
      error: ERROR_FLAG,
      metadataRaw: META_RAW,
    },
    fill: { attributes: 2800, input: 6200, output: 840, requestContext: 800, scope: 50, links: 0 },
    extra: '',
  },
  mastra_span_events: {
    time: 'endedAt',
    keep: [
      'entityType',
      'parentEntityType',
      'rootEntityType',
      'executionSource',
      'spanType',
      'isEvent',
      'startedAt',
      'endedAt',
    ],
    hash: [
      'dedupeKey',
      'traceId',
      'spanId',
      'parentSpanId',
      'entityId',
      'entityName',
      'parentEntityName',
      'rootEntityName',
      'userId',
      'resourceId',
      'runId',
      'sessionId',
      'threadId',
      'environment',
      'serviceName',
      'name',
    ],
    custom: { error: ERROR_FLAG },
    // Span input/output (~43 KB/row on the replica) are never read by these queries; keep them small.
    fill: { attributes: 1935, input: -300, output: -100, requestContext: 0, metadataRaw: 0, scope: 0, links: 0 },
    extra: '',
  },
  mastra_metric_events: {
    time: 'timestamp',
    keep: ['timestamp', 'entityType', 'name', 'value', 'estimatedCost', 'costUnit'],
    hash: ['metricId', 'traceId', 'spanId', 'entityName', 'resourceId', 'threadId', 'environment', 'provider', 'model'],
    custom: {
      costMetadata: `if(JSONHas(ifNull(src.costMetadata, '{}'), 'error') AND JSONType(ifNull(src.costMetadata, '{}'), 'error') != 'Null', '{"error":"x"}', NULL)`,
      labels: HMAP('src.labels'),
    },
    fill: {},
    extra: 'AND src.name IN {names:Array(String)}',
  },
} as const;
type PullTable = keyof typeof PULL;

function pullSelect(table: PullTable): string {
  const t = PULL[table];
  const cols = [
    ...t.keep.map(c => `src.${c} AS ${c}`),
    ...t.hash.map(c => `${H(`src.${c}`)} AS ${c}`),
    ...Object.entries(t.custom).map(([c, e]) => `${e} AS ${c}`),
    `{lo:String} AS organizationId`,
    `{lp:String} AS projectId`,
  ];
  return `SELECT ${cols.join(', ')} FROM ${table} AS src
    WHERE src.organizationId = {o:String} AND src.projectId = {p:String}
      AND src.${t.time} >= {from:DateTime64(3, 'UTC')} AND src.${t.time} < {to:DateTime64(3, 'UTC')} ${t.extra}`;
}

/**
 * Moves staged rows into the lab table, regenerating payload columns at the replica's widths. A fill value is the
 * fallback width when the replica reports none; negative means "this fixed width, ignore the replica"; 0 means NULL.
 */
function pullFinish(c: Calibration, table: PullTable, scale: number): string {
  const w = widths(c, table);
  const names = c.columns.filter(x => x.table === table).map(x => x.name);
  const fill = PULL[table].fill as Record<string, number>;
  const exprs = names.map(n => {
    if (!(n in fill)) return n;
    const f = fill[n]!;
    if (f <= 0) return `${FILL(-f, 5)} AS ${n}`;
    const { len, ratio } = w(n, f, scale);
    return `${FILL(len, ratio)} AS ${n}`;
  });
  return `INSERT INTO ${LAB.database}.${table} (${names.join(', ')})
    SELECT ${exprs.join(', ')} FROM (SELECT *, traceId AS tid FROM ${LAB.database}.pull_${table}
      WHERE organizationId = {lo:String} AND toDate(${PARTITION_COLUMN[table]}) = {d:Date})
    SETTINGS ${INSERT_SETTINGS.replace('max_block_size = 1', 'max_block_size = 512')}`;
}

const PULL_PAUSE_MS = 500;
/** Lab tables are partitioned by day on this column; finishing one partition at a time keeps write buffers small. */
const PARTITION_COLUMN: Record<PullTable, string> = {
  mastra_trace_roots: 'endedAt',
  mastra_span_events: 'endedAt',
  mastra_metric_events: 'timestamp',
};
const PULL_INSERT_ROWS = 20_000;
const LAB_PULL_PROGRESS_FILE = `${RESULTS_DIR}/lab-pull-progress.json`;
const PULL_SETTINGS = { max_threads: 2, max_result_rows: '2000000' };

async function pull(scale: number, only?: string[]): Promise<void> {
  const selection = loadSelection();
  if (!selection) throw new Error('No selection; run profile first');
  const c = readCalibration();
  const preflight = JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string };
  const projects = labProjects(c);
  const byHash = new Map(projects.filter(p => p.hash).map(p => [p.hash!, p]));
  const targets = selection.projects.filter(p => !only || only.includes(p.hash));
  const salt = randomBytes(16).toString('hex');
  const replica = new BenchClient({ ...loadCredentials(), database: preflight.database });
  const admin = labAdmin();
  const db = LAB.database;
  const to = new Date(c.anchorTo);
  const tables = Object.keys(PULL) as PullTable[];
  const literals: Record<string, Literals> = existsSync(LAB_PULLED_FILE)
    ? (JSON.parse(readFileSync(LAB_PULLED_FILE, 'utf8')) as Record<string, Literals>)
    : {};
  try {
    // Staging survives a failed run; projects already staged (with their literals saved) are skipped.
    const progress: { done: string[] } = existsSync(LAB_PULL_PROGRESS_FILE)
      ? (JSON.parse(readFileSync(LAB_PULL_PROGRESS_FILE, 'utf8')) as { done: string[] })
      : { done: [] };
    if (progress.done.length === 0) {
      for (const table of tables) {
        await admin.command({ query: `DROP TABLE IF EXISTS ${db}.pull_${table}` });
        await admin.command({ query: `CREATE TABLE ${db}.pull_${table} AS ${db}.${table}` });
      }
    }
    for (const sp of targets) {
      const lp = byHash.get(sp.hash);
      if (!lp) throw new Error(`Project ${sp.bucket}:${sp.hash} is not in the calibration`);
      const ids = { lo: `lab-org-${lp.k}`, lp: `lab-proj-${lp.k}` };
      if (progress.done.includes(sp.hash)) {
        process.stdout.write(`already staged ${sp.bucket}:${sp.hash}\n`);
        continue;
      }
      for (const table of tables) {
        await admin.command({
          query: `DELETE FROM ${db}.pull_${table} WHERE organizationId = {lo:String}`,
          query_params: ids,
          clickhouse_settings: { mutations_sync: '2' },
        });
      }
      let rows = 0;
      const started = performance.now();
      for (let d = HISTORY_DAYS; d > 0; d--) {
        const from = new Date(to.getTime() - d * DAY);
        const until = new Date(from.getTime() + DAY);
        for (const table of tables) {
          const out = await replica.rows<Record<string, unknown>>(
            pullSelect(table),
            {
              ...ids,
              salt,
              o: sp.organizationId,
              p: sp.projectId,
              from: chTime(from),
              to: chTime(until),
              names: TOKEN_NAMES,
            },
            { tier: TIERS[1], logComment: `aqa-bench:lab-pull:${table}:${sp.hash}:${d}`, settings: PULL_SETTINGS },
          );
          if (!out.ok)
            throw new Error(`pull ${table} ${sp.bucket}:${sp.hash} day -${d} failed (code ${out.errorCode})`);
          if (out.rows?.length) {
            try {
              for (let i = 0; i < out.rows.length; i += PULL_INSERT_ROWS) {
                await admin.insert({
                  table: `${db}.pull_${table}`,
                  values: out.rows.slice(i, i + PULL_INSERT_ROWS),
                  format: 'JSONEachRow',
                  clickhouse_settings: { date_time_input_format: 'best_effort', async_insert: 0 },
                });
              }
            } catch (error) {
              // The message would quote row values; report the code only.
              throw new Error(`lab insert ${table} failed (code ${(error as { code?: string }).code ?? '?'})`);
            }
            rows += out.rows.length;
          }
          await new Promise(r => setTimeout(r, PULL_PAUSE_MS));
        }
      }
      const real = sp.literals;
      literals[sp.hash] = {
        ...real,
        environment: pseudo(salt, real.environment),
        tool: pseudo(salt, real.tool),
        metadataKey: pseudo(salt, real.metadataKey),
      };
      progress.done.push(sp.hash);
      writeFileSync(LAB_PULL_PROGRESS_FILE, JSON.stringify({ done: progress.done }));
      writeFileSync(LAB_PULLED_FILE, JSON.stringify(literals, null, 2));
      process.stdout.write(
        `pulled ${sp.bucket}:${sp.hash}: ${rows.toLocaleString()} rows in ${Math.round((performance.now() - started) / 1000)} s\n`,
      );
    }

    const orgs = targets.map(sp => `lab-org-${byHash.get(sp.hash)!.k}`);
    for (const table of tables) {
      await admin.command({
        query: `DELETE FROM ${db}.${table} WHERE organizationId IN {orgs:Array(String)}`,
        query_params: { orgs },
        clickhouse_settings: { mutations_sync: '2' },
      });
      // One project and partition at a time: an insert spanning many partitions holds write buffers for each.
      for (const lo of orgs) {
        const days = await (
          await admin.query({
            query: `SELECT DISTINCT toDate(${PARTITION_COLUMN[table]}) AS d FROM ${db}.pull_${table} WHERE organizationId = {lo:String}`,
            query_params: { lo },
            format: 'JSONEachRow',
          })
        ).json<{ d: string }>();
        for (const { d } of days) {
          await admin.command({ query: pullFinish(c, table, scale), query_params: { lo, d } });
        }
      }
      await admin.command({ query: `DROP TABLE ${db}.pull_${table}` });
      process.stdout.write(`replaced ${table}\n`);
    }
    await compact(admin);
    rmSync(LAB_PULL_PROGRESS_FILE, { force: true });
    writeLabSelection(c, projects);
  } finally {
    await replica.close();
    await admin.close();
  }
}

// ---------------------------------------------------------------------------
// derive / bloom (local schema experiments, memory track 3)
// ---------------------------------------------------------------------------

const q = (v: string) => `'${v.replace(/'/g, "\\'")}'`;
const COST_IN = `name IN (${USAGE_COST_NAMES.map(q).join(', ')})`;

/**
 * Write-path candidates. In production these would be materialized views on the signal tables (the SELECTs below
 * are their bodies); here they are backfilled day by day, so a trace whose rows span days has several partial rows,
 * as an MV would leave before merges.
 */
export const ROLLUP_DDL = {
  [USAGE_ROLLUP_TABLE]: `CREATE TABLE ${LAB.database}.${USAGE_ROLLUP_TABLE} (
    organizationId String, projectId String, traceId String,
    firstAt SimpleAggregateFunction(min, DateTime64(3, 'UTC')),
    ${USAGE_ROLLUP_COLUMNS.map(c => `${c.column} SimpleAggregateFunction(sum, Float64)`).join(', ')},
    cost SimpleAggregateFunction(sum, Float64),
    pricedRows SimpleAggregateFunction(sum, UInt64),
    failedRows SimpleAggregateFunction(sum, UInt64),
    unitMin SimpleAggregateFunction(min, Nullable(String)),
    unitMax SimpleAggregateFunction(max, Nullable(String))
  ) ENGINE = AggregatingMergeTree ORDER BY (organizationId, projectId, traceId)`,
  [SPAN_NAME_INDEX_TABLE]: `CREATE TABLE ${LAB.database}.${SPAN_NAME_INDEX_TABLE} (
    organizationId String, projectId String, name String, traceId String, endedAt DateTime64(3, 'UTC')
  ) ENGINE = ReplacingMergeTree PARTITION BY toDate(endedAt) ORDER BY (organizationId, projectId, name, traceId)`,
};

export const ROLLUP_SELECT = {
  [USAGE_ROLLUP_TABLE]: `SELECT ifNull(organizationId, '') AS organizationId, ifNull(projectId, '') AS projectId,
      assumeNotNull(traceId) AS traceId, min(timestamp) AS firstAt,
      ${USAGE_ROLLUP_COLUMNS.map(c => `sumIf(value, name = ${q(c.name)}) AS ${c.column}`).join(', ')},
      sumIf(assumeNotNull(estimatedCost), priced) AS cost, countIf(priced) AS pricedRows, countIf(failed) AS failedRows,
      minIf(costUnit, priced) AS unitMin, maxIf(costUnit, priced) AS unitMax
    FROM (
      SELECT *, ${COST_IN} AND ifNull(JSONHas(costMetadata, 'error') AND JSONType(costMetadata, 'error') != 'Null', 0) AS hasErr,
        ${COST_IN} AND isNotNull(estimatedCost) AND isNotNull(costUnit) AND NOT hasErr AS priced,
        ${COST_IN} AND (hasErr OR (isNotNull(estimatedCost) AND isNull(costUnit))) AS failed
      FROM ${LAB.database}.mastra_metric_events
      WHERE isNotNull(traceId) AND name IN (${USAGE_ROLLUP_COLUMNS.map(c => q(c.name)).join(', ')})
        AND toDate(timestamp) = {d:Date})
    GROUP BY organizationId, projectId, traceId`,
  [SPAN_NAME_INDEX_TABLE]: `SELECT ifNull(organizationId, '') AS organizationId, ifNull(projectId, '') AS projectId,
      name, assumeNotNull(traceId) AS traceId, max(endedAt) AS lastEndedAt
    FROM ${LAB.database}.mastra_span_events
    WHERE isNotNull(traceId) AND toDate(endedAt) = {d:Date}
    GROUP BY organizationId, projectId, name, traceId`,
};

const DERIVED_SOURCE = { [USAGE_ROLLUP_TABLE]: 'mastra_metric_events', [SPAN_NAME_INDEX_TABLE]: 'mastra_span_events' };

async function tableSizes(admin: ReturnType<typeof labAdmin>, tables: string[]) {
  return (
    await admin.query({
      query: `SELECT table, sum(rows) AS rows, sum(data_compressed_bytes) AS bytes FROM system.parts
        WHERE database = '${LAB.database}' AND active AND table IN {t:Array(String)} GROUP BY table`,
      query_params: { t: tables },
      format: 'JSONEachRow',
    })
  ).json<{ table: string; rows: string; bytes: string }>();
}

async function derive(): Promise<void> {
  const admin = labAdmin();
  const db = LAB.database;
  try {
    for (const [table, ddl] of Object.entries(ROLLUP_DDL)) {
      const source = DERIVED_SOURCE[table as keyof typeof DERIVED_SOURCE];
      const time = source === 'mastra_metric_events' ? 'timestamp' : 'endedAt';
      await admin.command({ query: `DROP TABLE IF EXISTS ${db}.${table}` });
      await admin.command({ query: ddl });
      const days = await (
        await admin.query({
          query: `SELECT DISTINCT toDate(${time}) AS d FROM ${db}.${source} ORDER BY d`,
          format: 'JSONEachRow',
        })
      ).json<{ d: string }>();
      const started = performance.now();
      for (const { d } of days) {
        await admin.command({
          query: `INSERT INTO ${db}.${table} ${ROLLUP_SELECT[table as keyof typeof ROLLUP_SELECT]} SETTINGS max_threads = 2`,
          query_params: { d },
        });
      }
      const [src, out] = [source, table].map(async t => (await tableSizes(admin, [t]))[0]);
      const [a, b] = await Promise.all([src, out]);
      process.stdout.write(
        `${table}: ${Number(b?.rows).toLocaleString()} rows, ${(Number(b?.bytes) / 2 ** 20).toFixed(1)} MiB ` +
          `(source ${source}: ${Number(a?.rows).toLocaleString()} rows, ${(Number(a?.bytes) / 2 ** 20).toFixed(1)} MiB) ` +
          `in ${Math.round((performance.now() - started) / 1000)} s\n`,
      );
    }
  } finally {
    await admin.close();
  }
}

/** traceId bloom filters on the three signal tables (toggle per query with `use_skip_indexes`). */
async function bloom(): Promise<void> {
  const admin = labAdmin();
  const db = LAB.database;
  try {
    for (const table of ['mastra_trace_roots', 'mastra_span_events', 'mastra_metric_events']) {
      const before = (await tableSizes(admin, [table]))[0];
      const started = performance.now();
      await admin.command({
        query: `ALTER TABLE ${db}.${table} ADD INDEX IF NOT EXISTS idx_trace_id traceId TYPE bloom_filter(0.01) GRANULARITY 1`,
      });
      await admin.command({
        query: `ALTER TABLE ${db}.${table} MATERIALIZE INDEX idx_trace_id`,
        clickhouse_settings: { mutations_sync: '2' },
      });
      const size = await (
        await admin.query({
          query: `SELECT sum(secondary_indices_compressed_bytes) AS b FROM system.parts
            WHERE database = '${db}' AND table = '${table}' AND active`,
          format: 'JSONEachRow',
        })
      ).json<{ b: string }>();
      process.stdout.write(
        `${table}: bloom index ${(Number(size[0]?.b) / 2 ** 20).toFixed(1)} MiB on ${(Number(before?.bytes) / 2 ** 20).toFixed(0)} MiB of data, ` +
          `${Math.round((performance.now() - started) / 1000)} s\n`,
      );
    }
  } finally {
    await admin.close();
  }
}

/**
 * One merge at a time, partition by partition: background merges over thousands of fresh parts exhaust a laptop's
 * docker VM. Leaves one part per partition (the replica has ~5-10), which slightly understates read amplification.
 */
async function compact(admin: ReturnType<typeof labAdmin>): Promise<void> {
  const db = LAB.database;
  for (const table of ['mastra_trace_roots', 'mastra_span_events', 'mastra_metric_events']) {
    const partitions = await (
      await admin.query({
        query: `SELECT DISTINCT partition_id FROM system.parts WHERE database = '${db}' AND table = '${table}' AND active`,
        format: 'JSONEachRow',
      })
    ).json<{ partition_id: string }>();
    await admin.command({ query: `SYSTEM START MERGES ${db}.${table}` });
    for (const { partition_id } of partitions) {
      await admin.command({
        query: `OPTIMIZE TABLE ${db}.${table} PARTITION ID '${partition_id}' FINAL`,
        clickhouse_settings: { optimize_throw_if_noop: 0 },
      });
    }
    process.stdout.write(`compacted ${table} (${partitions.length} partitions)\n`);
  }
}

type Literals = Selection['projects'][number]['literals'];

/** Hashed literals of projects replaced by `pull`; `load` regenerates them, so a reload must drop this file. */
const LAB_PULLED_FILE = `${RESULTS_DIR}/lab-pulled.json`;

function writeLabSelection(c: Calibration, projects: LabProject[]): void {
  const pulled: Record<string, Literals> = existsSync(LAB_PULLED_FILE)
    ? (JSON.parse(readFileSync(LAB_PULLED_FILE, 'utf8')) as Record<string, Literals>)
    : {};
  const selection: Selection = {
    version: 1,
    salt: 'lab',
    database: LAB.database,
    profiledAt: new Date().toISOString(),
    anchorTo: c.anchorTo,
    distribution: { windowDays: 30, traces: 0, nullProjectTraces: 0, ...c.distribution },
    projects: projects
      .filter(p => p.bucket && p.hash)
      .map(p => ({
        organizationId: `lab-org-${p.k}`,
        projectId: `lab-proj-${p.k}`,
        bucket: p.bucket!,
        hash: p.hash!,
        representative: Boolean(p.representative),
        stats: {
          traces30d: p.traces,
          spans30d: p.spans,
          threads30d: p.threads,
          users30d: 0,
          tokenRows30d: p.tokenRows,
        },
        literals: pulled[p.hash!] ?? LAB_LITERALS,
        literalSource: {},
      })),
  };
  writeFileSync(LAB_SELECTION_FILE, JSON.stringify(selection, null, 2));
  process.stdout.write(`wrote ${LAB_SELECTION_FILE}\n`);
}

export function loadLabSelection(): Selection {
  if (!existsSync(LAB_SELECTION_FILE)) throw new Error(`Missing ${LAB_SELECTION_FILE}; run lab load first`);
  return JSON.parse(readFileSync(LAB_SELECTION_FILE, 'utf8')) as Selection;
}

export function labCredentials() {
  return { origin: LAB.url, username: LAB.username, password: LAB.password, database: LAB.database };
}

/**
 * Runs every case at every window on the lab's calibrated projects (below largest) with each shape variant and
 * checks the rows match the compiled query's. Synthetic data, so parsing results is fine here.
 */
async function equiv(variants: Variant[]): Promise<void> {
  const selection = loadLabSelection();
  const client = new BenchClient(labCredentials());
  const to = new Date(selection.anchorTo);
  const projects = selection.projects.filter(p => p.bucket !== 'largest');
  // Float aggregates may differ in the last bits when rows arrive in a different order.
  const canon = (rows: Array<Record<string, unknown>>) =>
    rows
      .map(r => ({ key: JSON.stringify(r, (_k, v: unknown) => (typeof v === 'number' ? 0 : v)), row: r }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const same = (a: ReturnType<typeof canon>, b: ReturnType<typeof canon>) =>
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i]!;
      if (x.key !== y.key) return false;
      return Object.entries(x.row).every(([f, v]) => {
        const w = y.row[f];
        if (typeof v !== 'number' || typeof w !== 'number') return true;
        return Math.abs(v - w) <= 1e-9 * Math.max(Math.abs(v), Math.abs(w), 1e-12);
      });
    });
  let compared = 0;
  let skipped = 0;
  const failures: string[] = [];
  try {
    for (const def of CASES) {
      for (const window of def.windows) {
        for (const project of projects) {
          const range = timeRangeFor(window, to);
          const run = async (variant: Variant) => {
            const c = compileCase(def, variant, project.literals, range, project);
            const out = await client.rows<Record<string, unknown>>(c.query, c.query_params, {
              tier: TIERS[1],
              logComment: `aqa-bench:lab-equiv:${def.id}:${variant}`,
            });
            if (!out.ok)
              throw new Error(`${def.id} ${variant} ${window.id} failed (${out.errorCode}): ${out.errorMessage}`);
            return canon(out.rows ?? []);
          };
          const base = await run('base');
          for (const variant of variants) {
            let got: ReturnType<typeof canon>;
            try {
              got = await run(variant);
            } catch (error) {
              if (error instanceof RewriteError) {
                skipped++;
                continue;
              }
              throw error;
            }
            compared++;
            if (!same(got, base)) failures.push(`${def.id} ${variant} ${window.id} ${project.bucket}:${project.hash}`);
          }
        }
      }
    }
  } finally {
    await client.close();
  }
  process.stdout.write(
    `equivalence: ${compared} comparisons, ${skipped} not applicable, ${failures.length} mismatches\n`,
  );
  for (const f of failures) process.stdout.write(`  mismatch: ${f}\n`);
  if (failures.length) process.exitCode = 1;
}

function down(): void {
  docker(['rm', '-f', LAB.container]);
  process.stdout.write('lab removed\n');
}

export function readCalibration(): Calibration {
  if (!existsSync(CALIBRATION_FILE)) throw new Error(`Missing ${CALIBRATION_FILE}; run calibrate first`);
  return JSON.parse(readFileSync(CALIBRATION_FILE, 'utf8')) as Calibration;
}

export { BUCKETS };

async function main(): Promise<void> {
  installOutputRedaction();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      scale: { type: 'string', default: '1' },
      batches: { type: 'string', default: '8' },
      variants: { type: 'string' },
      projects: { type: 'string' },
    },
  });
  const command = positionals[0];
  if (command === 'calibrate') return calibrate();
  if (command === 'up') return up();
  if (command === 'down') return down();
  if (command === 'equiv') return equiv(((values.variants as string) ?? 'rs,r1,sp,shape').split(',') as Variant[]);
  if (command === 'compact') {
    const admin = labAdmin();
    try {
      return await compact(admin);
    } finally {
      await admin.close();
    }
  }
  if (command === 'load') return load(Number(values.scale), Number(values.batches));
  if (command === 'derive') return derive();
  if (command === 'bloom') return bloom();
  if (command === 'pull') return pull(Number(values.scale), (values.projects as string | undefined)?.split(','));
  throw new Error('usage: lab.ts calibrate|up|load|pull|derive|bloom|compact|equiv|down');
}

if (process.argv[1]?.endsWith('lab.ts')) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
