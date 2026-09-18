/** Reproduce with: pnpm --filter @mastra/pg exec tsx scripts/benchmark-trace-delta.ts */
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { coreFeatures } from '@mastra/core/features';
import { encodeTraceQueryDeltaCursor, parseTraceQueryRequest, planTraceQuery } from '@mastra/core/storage';
import { Pool } from 'pg';
import { PoolAdapter } from '../src/storage/client';
import { ObservabilityStoragePostgresVNext } from '../src/storage/domains/observability/v-next';
import { compilePostgresTraceQuery } from '../src/storage/domains/observability/v-next/trace-query';

const pool = new Pool({
  connectionString: process.env.PG_VNEXT_TIMESCALE_URL ?? 'postgres://postgres:postgres@localhost:5435/mastra',
});
const client = new PoolAdapter(pool);
const schema = `trace_delta_benchmark_${Date.now()}`;
const storage = new ObservabilityStoragePostgresVNext({ client, schemaName: schema });
const timeRange = { from: '2026-08-17T00:00:00.000Z', to: '2026-09-17T00:00:00.000Z' };
const output = process.env.PG_DELTA_BENCHMARK_OUTPUT ?? '/tmp/pg-trace-delta-benchmark';
coreFeatures.add('observability-delta-polling');
await mkdir(output, { recursive: true });
try {
  await client.none(`CREATE SCHEMA "${schema}"`);
  await client.none('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE');
  await storage.init();
  const table = `"${schema}"."mastra_span_events"`;
  await client.none(`INSERT INTO ${table} ("traceId", "spanId", "name", "spanType", "startedAt", "endedAt", "isPending")
    SELECT 'historical-' || n, 'root-' || n, 'root', 'agent_run',
      '2026-08-17'::timestamptz + (n % 31) * interval '1 day',
      '2026-08-17'::timestamptz + (n % 31) * interval '1 day' + interval '1 second', false
    FROM generate_series(1, 100000) n`);
  await client.none(`ANALYZE ${table}`);
  const horizon = async () =>
    (await client.one<{ x: string }>('SELECT pg_snapshot_xmin(pg_current_snapshot())::text AS x')).x;
  const bootstrap = await horizon();
  const results: Record<string, unknown>[] = [];
  const explain = async (label: string, text: string, values: unknown[]) => {
    const row = await client.one<{ 'QUERY PLAN': any[] }>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${text}`, values);
    const result = row['QUERY PLAN'][0];
    await writeFile(`${output}/${label}.json`, JSON.stringify(result, null, 2));
    await writeFile(`${output}/${label}.sql`, `${text}\n-- parameters: ${JSON.stringify(values)}\n`);
    const roots = (node: any): any =>
      node['Subplan Name'] === 'CTE root_scope' ? node : node.Plans?.map(roots).find(Boolean);
    const materializedRoots = roots(result.Plan)?.['Actual Rows'];
    if (label.endsWith('-after') && materializedRoots !== (label === 'empty-after' ? 0 : 10)) {
      throw new Error(`Unexpected materialized candidate count for ${label}: ${materializedRoots}`);
    }
    results.push({
      label,
      executionMs: result['Execution Time'],
      planningMs: result['Planning Time'],
      sharedHitBlocks: result.Plan['Shared Hit Blocks'],
      sharedReadBlocks: result.Plan['Shared Read Blocks'],
      materializedRoots,
    });
  };
  const poll = async (label: string, where?: unknown) => {
    const initial = planTraceQuery(
      parseTraceQueryRequest({ timeRange, mode: 'delta', limit: 100, ...(where ? { where } : {}) }),
    );
    if (initial.paginationMode !== 'delta') throw new Error('Expected delta plan');
    const after = encodeTraceQueryDeltaCursor(initial, 'pg', `${bootstrap}:0`);
    const plan = planTraceQuery(
      parseTraceQueryRequest({ timeRange, mode: 'delta', after, limit: 100, ...(where ? { where } : {}) }),
    );
    const compiled = compilePostgresTraceQuery(schema, plan, 'data', await horizon());
    // Reconstruct the pre-fix placement, preserving exactly the same bounds,
    // parameter values, latest-root logic and predicates for a controlled comparison.
    const before = compiled.text
      .replace(/\n      AND \(r\."xactId", r\."cursorId"\) > \(\$3::xid8, \$4::bigint\)/, '')
      .replace(/\n      AND r\."xactId" < \$5::xid8/, '')
      .replace(
        'SELECT * FROM candidates\n',
        'SELECT * FROM candidates\nWHERE ("xactId", "cursorId") > ($3::xid8, $4::bigint) AND "xactId" < $5::xid8\n',
      );
    if (before === compiled.text || before.includes('AND r."xactId" < $5::xid8')) {
      throw new Error('Failed to reconstruct the previous transaction-bound placement');
    }
    await explain(`${label}-before`, before, compiled.values);
    await explain(`${label}-after`, compiled.text, compiled.values);
  };
  await poll('empty');
  await client.none(`INSERT INTO ${table} ("traceId", "spanId", "name", "spanType", "startedAt", "endedAt", "isPending")
    SELECT 'delta-' || n, 'delta-root-' || n, 'root', 'agent_run', '2026-09-16'::timestamptz, '2026-09-16'::timestamptz + interval '1 second', false
    FROM generate_series(1, 10) n`);
  await poll('small');
  await poll('related', { spans: { some: { op: 'eq', left: { path: 'name' }, right: { literal: 'root' } } } });
  const page = planTraceQuery(parseTraceQueryRequest({ timeRange, pagination: { page: 0, perPage: 100 } }));
  if (page.paginationMode !== 'page') throw new Error('Expected page plan');
  for (const mode of ['count', 'data'] as const) {
    const query = compilePostgresTraceQuery(schema, page, mode);
    await explain(`numbered-page-${mode}`, query.text, query.values);
  }
  await explain('numbered-page-horizon', 'SELECT pg_snapshot_xmin(pg_current_snapshot())::text AS "xactId"', []);
  const timings: { enabled: boolean; ms: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const enabled = i % 2 === 1;
    if (enabled) coreFeatures.add('observability-delta-polling');
    else coreFeatures.delete('observability-delta-polling');
    const start = performance.now();
    await storage.queryTraces(page);
    if (i >= 2) timings.push({ enabled, ms: performance.now() - start });
  }
  await writeFile(
    `${output}/summary.json`,
    JSON.stringify(
      {
        roots: 100000,
        deltaRoots: 10,
        timeRange,
        version: await client.one('SELECT version()'),
        results,
        pageTimings: timings,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ output, results, pageTimings: timings }, null, 2));
} finally {
  await client.none(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
}
