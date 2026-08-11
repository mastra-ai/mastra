/**
 * Benchmark: PostgresStore.init() with vs. without single-backend pin.
 *
 * Spins up `PostgresStore` against a Postgres reached through Toxiproxy
 * so we can control round-trip latency. For each latency profile it runs
 * N iterations of init() in each of two modes:
 *
 *   1. "pinned"    — current behavior: PostgresStore.init() reserves
 *                    one PoolClient and routes every domain's DDL
 *                    through it before super.init() runs.
 *   2. "parallel"  — original (pre-#17679) behavior: invoke
 *                    MastraCompositeStore.prototype.init directly on
 *                    the PostgresStore instance, skipping the pin path
 *                    entirely. Every domain's init() fans out via
 *                    Promise.all against the full pool, exactly as it
 *                    did before this PR.
 *
 * Each iteration uses a fresh schema, so init() always does the full
 * createTable/alterTable/createIndex chain (no fast-path).
 *
 * After the cold modes, a "warm" mode measures init() against an
 * already-converged schema (converged once, then NOT dropped between
 * iterations) — the steady-state cost every restart pays. Warm
 * iterations also count the SQL statements each init() issues, using
 * pg_stat_statements (enabled via shared_preload_libraries in
 * docker-compose.benchmark.yaml), broken down by statement class.
 * Counting is database-scoped (pg_stat_statements joined to pg_database
 * on dbid, filtered to the benchmark database) and diff-based — never a
 * cluster-wide pg_stat_statements_reset().
 *
 * Run via: `pnpm bench:init`
 */

import { MastraCompositeStore } from '@mastra/core/storage';
import { Pool } from 'pg';
import { PostgresStore } from '../src/storage/index';

const TOXIPROXY_API = process.env.TOXIPROXY_API ?? 'http://localhost:8476';
const PROXY_NAME = 'pg';
const PROXY_LISTEN_HOST = 'localhost';
const PROXY_LISTEN_PORT = 5439;
const CLEANUP_CONNECTION = 'postgresql://postgres:postgres@localhost:5438/postgres';

const LATENCIES_MS = [0, 5, 25, 50];
const ITERATIONS = 5;
const POOL_MAX = 20;

interface Result {
  latencyMs: number;
  mode: 'pinned' | 'parallel';
  samplesMs: number[];
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
}

async function setLatency(latencyMs: number): Promise<void> {
  // Recreate the proxy idempotently.
  await fetch(`${TOXIPROXY_API}/proxies/${PROXY_NAME}`, { method: 'DELETE' }).catch(() => {});
  const create = await fetch(`${TOXIPROXY_API}/proxies`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: PROXY_NAME,
      listen: '0.0.0.0:5432',
      upstream: 'db:5432',
      enabled: true,
    }),
  });
  if (!create.ok) throw new Error(`toxiproxy create failed: ${create.status} ${await create.text()}`);

  if (latencyMs > 0) {
    const tox = await fetch(`${TOXIPROXY_API}/proxies/${PROXY_NAME}/toxics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'latency',
        attributes: { latency: latencyMs, jitter: 0 },
        stream: 'downstream',
      }),
    });
    if (!tox.ok) throw new Error(`toxiproxy toxic failed: ${tox.status} ${await tox.text()}`);
  }
}

async function dropSchema(schema: string): Promise<void> {
  const cleanup = new Pool({ connectionString: CLEANUP_CONNECTION });
  try {
    await cleanup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await cleanup.end();
  }
}

/**
 * Run the original (pre-#17679) parallel init path: call
 * MastraCompositeStore.prototype.init directly on the PostgresStore
 * instance, skipping PostgresStore.init() entirely. This bypasses both
 * the routing.pin() call AND the pool.connect()/reserved-client cost
 * that the pin path adds, so the resulting wall-clock is a faithful
 * baseline of the pre-fix behavior (full pool budget available,
 * domain init() fanned out via Promise.all against the pool).
 */
function runParallelInit(store: PostgresStore): Promise<void> {
  return MastraCompositeStore.prototype.init.call(store);
}

async function timeOnce(mode: 'pinned' | 'parallel'): Promise<number> {
  const schema = `bench_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  const pool = new Pool({
    host: PROXY_LISTEN_HOST,
    port: PROXY_LISTEN_PORT,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    max: POOL_MAX,
  });

  const store = new PostgresStore({
    id: `bench-${mode}-${schema}`,
    pool,
    schemaName: schema,
  });

  const start = performance.now();
  try {
    if (mode === 'pinned') {
      await store.init();
    } else {
      await runParallelInit(store);
    }
  } finally {
    const elapsed = performance.now() - start;
    await store.close().catch(() => {});
    await pool.end().catch(() => {});
    await dropSchema(schema).catch(() => {});
    // Returned via closure below since we want to also return on error.
    (timeOnce as any)._last = elapsed;
  }
  return (timeOnce as any)._last as number;
}

/**
 * Statement classes for warm-mode counting. The classification rule is
 * the shared vocabulary for reasoning about init cost:
 *
 * - "information_schema probes"  — per-column existence checks
 * - "pg_indexes probes"          — per-index existence checks
 *                                  (FROM pg_indexes + indexname = ...)
 * - "snapshot catalog reads"     — schema-scoped catalog snapshot reads
 *                                  (pg_catalog.pg_tables / pg_class+
 *                                  pg_attribute / pg_index or
 *                                  pg_catalog.pg_indexes WITHOUT an
 *                                  indexname predicate)
 * - "ALTER TABLE" / "CREATE TABLE" / "CREATE INDEX" — DDL
 * - "other"                      — everything else the init issued
 */
const STATEMENT_CLASSES = [
  'information_schema probes',
  'pg_indexes probes',
  'snapshot catalog reads',
  'ALTER TABLE',
  'CREATE TABLE',
  'CREATE INDEX',
  'other',
] as const;
type StatementClass = (typeof STATEMENT_CLASSES)[number];

function classifyStatement(query: string): StatementClass {
  const q = query.replace(/\s+/g, ' ');
  if (/information_schema\./i.test(q)) return 'information_schema probes';
  // Per-index existence probe: pg_indexes with an indexname predicate.
  if (/from\s+pg_indexes/i.test(q) && /indexname\s*=/i.test(q)) return 'pg_indexes probes';
  // Schema-scoped catalog snapshot reads.
  if (/from\s+pg_catalog\.pg_tables\s+where\s+schemaname\s*=/i.test(q)) return 'snapshot catalog reads';
  if (/pg_catalog\.pg_class/i.test(q) && /pg_attribute/i.test(q)) return 'snapshot catalog reads';
  if (/from\s+pg_catalog\.pg_indexes/i.test(q) && !/indexname\s*=/i.test(q)) return 'snapshot catalog reads';
  if (/pg_catalog\.pg_index\b/i.test(q) && /indisreplident/i.test(q)) return 'snapshot catalog reads';
  if (/^\s*alter\s+table/i.test(q)) return 'ALTER TABLE';
  if (/^\s*create\s+table/i.test(q)) return 'CREATE TABLE';
  if (/^\s*create\s+(unique\s+)?index/i.test(q)) return 'CREATE INDEX';
  return 'other';
}

interface WarmResult {
  latencyMs: number;
  samplesMs: number[];
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  /** Per-init statement counts by class, averaged across iterations. */
  perClass: Record<StatementClass, number>;
  /** Per-init total statements, averaged across iterations. */
  totalStatements: number;
}

type StatementSnapshot = Map<string, number>;

/**
 * Snapshot pg_stat_statements call counts, scoped to the benchmark
 * database (dbid join — NOT cluster-wide). The snapshot query itself is
 * excluded via the pg_stat_statements text filter so counting doesn't
 * observe itself.
 */
async function snapshotStatements(stats: Pool): Promise<StatementSnapshot> {
  const { rows } = await stats.query<{ key: string; query: string; calls: string }>(
    `SELECT s.queryid::text || ':' || md5(s.query) AS key, s.query, s.calls::text AS calls
     FROM pg_stat_statements s
     JOIN pg_database d ON d.oid = s.dbid
     WHERE d.datname = current_database()
       AND s.query NOT LIKE '%pg_stat_statements%'`,
  );
  const snap: StatementSnapshot = new Map();
  for (const row of rows) {
    snap.set(`${row.key}|${row.query}`, Number(row.calls));
  }
  return snap;
}

function diffStatements(before: StatementSnapshot, after: StatementSnapshot): Record<StatementClass, number> {
  const counts = Object.fromEntries(STATEMENT_CLASSES.map(c => [c, 0])) as Record<StatementClass, number>;
  for (const [key, callsAfter] of after) {
    const callsBefore = before.get(key) ?? 0;
    const delta = callsAfter - callsBefore;
    if (delta <= 0) continue;
    const query = key.slice(key.indexOf('|') + 1);
    counts[classifyStatement(query)] += delta;
  }
  return counts;
}

let warmRunSeq = 0;

/** One pinned init() against an existing (converged) schema. */
async function warmInitOnce(schema: string): Promise<number> {
  const pool = new Pool({
    host: PROXY_LISTEN_HOST,
    port: PROXY_LISTEN_PORT,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    max: POOL_MAX,
  });
  const store = new PostgresStore({
    id: `bench-warm-${schema}-${warmRunSeq++}`,
    pool,
    schemaName: schema,
  });
  const start = performance.now();
  try {
    await store.init();
    return performance.now() - start;
  } finally {
    await store.close().catch(() => {});
    await pool.end().catch(() => {});
  }
}

/**
 * Warm-mode benchmark for one latency tier: converge a schema once
 * (discarded from measurement), then measure repeated init() runs
 * against it, counting statements per init via pg_stat_statements
 * snapshots taken over the direct (latency-free) connection.
 */
async function runWarmBench(latencyMs: number, stats: Pool): Promise<WarmResult | null> {
  const schema = `bench_warm_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  const samples: number[] = [];
  const perIterCounts: Record<StatementClass, number>[] = [];
  try {
    const convergeMs = await warmInitOnce(schema);
    console.info(`  warm converge: ${formatMs(convergeMs)} (discarded)`);

    for (let i = 0; i < ITERATIONS; i++) {
      try {
        const before = await snapshotStatements(stats);
        const ms = await warmInitOnce(schema);
        const after = await snapshotStatements(stats);
        const counts = diffStatements(before, after);
        const total = STATEMENT_CLASSES.reduce((acc, c) => acc + counts[c], 0);
        samples.push(ms);
        perIterCounts.push(counts);
        console.info(`  warm iter ${i + 1}: ${formatMs(ms)} (${total} statements)`);
      } catch (err) {
        console.error(`  warm iter ${i + 1} failed: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    console.error(`  warm converge failed: ${(err as Error).message}`);
  } finally {
    await dropSchema(schema).catch(() => {});
  }

  if (samples.length === 0) return null;

  const perClass = Object.fromEntries(
    STATEMENT_CLASSES.map(c => [
      c,
      Math.round(perIterCounts.reduce((acc, counts) => acc + counts[c], 0) / perIterCounts.length),
    ]),
  ) as Record<StatementClass, number>;
  const totalStatements = STATEMENT_CLASSES.reduce((acc, c) => acc + perClass[c], 0);

  const base = summarize(latencyMs, 'pinned', samples);
  return {
    latencyMs,
    samplesMs: samples,
    meanMs: base.meanMs,
    p50Ms: base.p50Ms,
    p95Ms: base.p95Ms,
    minMs: base.minMs,
    maxMs: base.maxMs,
    perClass,
    totalStatements,
  };
}

function printWarmResults(warmResults: WarmResult[]): void {
  if (warmResults.length === 0) return;

  console.info('=== warm init() — already-converged schema, pinned path ===');
  console.info(`iterations per cell: ${ITERATIONS} (schema converged once, then reused)\n`);

  const header = ['latency', 'mean', 'p50', 'p95', 'min', 'max', 'stmts/init'];
  const rows: string[][] = [header];
  for (const r of [...warmResults].sort((a, b) => a.latencyMs - b.latencyMs)) {
    rows.push([
      `${r.latencyMs}ms`,
      formatMs(r.meanMs),
      formatMs(r.p50Ms),
      formatMs(r.p95Ms),
      formatMs(r.minMs),
      formatMs(r.maxMs),
      `${r.totalStatements}`,
    ]);
  }
  const widths = header.map((_, i) => Math.max(...rows.map(row => (row[i] ?? '').length)));
  for (const row of rows) {
    console.info(row.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  '));
  }

  console.info('\nWarm init statement classes (per init, mean across iterations):');
  for (const r of [...warmResults].sort((a, b) => a.latencyMs - b.latencyMs)) {
    console.info(`  ${r.latencyMs}ms latency:`);
    for (const cls of STATEMENT_CLASSES) {
      console.info(`    ${`${cls}:`.padEnd(28)}${r.perClass[cls]}`);
    }
    console.info(`    ${'total:'.padEnd(28)}${r.totalStatements}`);
  }
  console.info('');
}

function summarize(latencyMs: number, mode: 'pinned' | 'parallel', samples: number[]): Result {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    latencyMs,
    mode,
    samplesMs: samples,
    meanMs: sum / sorted.length,
    p50Ms: sorted[Math.floor(sorted.length * 0.5)]!,
    p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!,
    minMs: sorted[0]!,
    maxMs: sorted[sorted.length - 1]!,
  };
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(0)}ms`;
}

function printResults(results: Result[]): void {
  console.info('\n=== PostgresStore.init() benchmark ===');
  console.info(`iterations per cell: ${ITERATIONS}, pool.max: ${POOL_MAX}, ~21 domains per init\n`);

  const byLatency = new Map<number, Record<string, Result>>();
  for (const r of results) {
    const bucket = byLatency.get(r.latencyMs) ?? {};
    bucket[r.mode] = r;
    byLatency.set(r.latencyMs, bucket);
  }

  const header = ['latency', 'mode', 'mean', 'p50', 'p95', 'min', 'max'];
  const rows: string[][] = [header];
  for (const [latencyMs, bucket] of [...byLatency.entries()].sort((a, b) => a[0] - b[0])) {
    for (const mode of ['parallel', 'pinned'] as const) {
      const r = bucket[mode];
      if (!r) continue;
      rows.push([
        `${latencyMs}ms`,
        mode,
        formatMs(r.meanMs),
        formatMs(r.p50Ms),
        formatMs(r.p95Ms),
        formatMs(r.minMs),
        formatMs(r.maxMs),
      ]);
    }
  }

  const widths = header.map((_, i) => Math.max(...rows.map(r => (r[i] ?? '').length)));
  for (const row of rows) {
    console.info(row.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  '));
  }

  console.info('\nRelative cost of `pinned` vs `parallel` (mean):');
  for (const [latencyMs, bucket] of [...byLatency.entries()].sort((a, b) => a[0] - b[0])) {
    if (bucket.pinned && bucket.parallel) {
      const ratio = bucket.pinned.meanMs / bucket.parallel.meanMs;
      const delta = bucket.pinned.meanMs - bucket.parallel.meanMs;
      console.info(`  ${latencyMs}ms latency: ${ratio.toFixed(2)}x (${delta >= 0 ? '+' : ''}${formatMs(delta)})`);
    }
  }
  console.info('');
}

async function main(): Promise<void> {
  const results: Result[] = [];
  const warmResults: WarmResult[] = [];

  // Direct (latency-free) connection for pg_stat_statements snapshots.
  const stats = new Pool({ connectionString: CLEANUP_CONNECTION });
  try {
    await stats.query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
    await stats.query('SELECT 1 FROM pg_stat_statements LIMIT 1');
  } catch (err) {
    throw new Error(
      `warm-mode statement counting needs pg_stat_statements (shared_preload_libraries in docker-compose.benchmark.yaml): ${(err as Error).message}`,
    );
  }

  try {
    for (const latencyMs of LATENCIES_MS) {
      console.info(`\n--- ${latencyMs}ms one-way latency ---`);
      await setLatency(latencyMs);

      for (const mode of ['parallel', 'pinned'] as const) {
        const samples: number[] = [];
        // Warm up once so JIT/connection-establishment cost isn't charged
        // to the first measured iteration.
        try {
          await timeOnce(mode);
        } catch (err) {
          console.error(`  warmup ${mode} failed: ${(err as Error).message}`);
        }

        for (let i = 0; i < ITERATIONS; i++) {
          try {
            const ms = await timeOnce(mode);
            samples.push(ms);
            console.info(`  ${mode} iter ${i + 1}: ${formatMs(ms)}`);
          } catch (err) {
            console.error(`  ${mode} iter ${i + 1} failed: ${(err as Error).message}`);
          }
        }

        if (samples.length > 0) {
          results.push(summarize(latencyMs, mode, samples));
        }
      }

      const warm = await runWarmBench(latencyMs, stats);
      if (warm) warmResults.push(warm);
    }
  } finally {
    await stats.end().catch(() => {});
  }

  printResults(results);
  printWarmResults(warmResults);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
