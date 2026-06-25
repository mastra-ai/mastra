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
  }

  printResults(results);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
