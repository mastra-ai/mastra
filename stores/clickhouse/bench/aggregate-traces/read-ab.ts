/**
 * A/B of `filesystem_prefetches_limit=8` on the Platform reads that don't set it yet:
 * the cleanup `/tenants` listing (mobs-query) and the per-trace source reads the entity-signals
 * workers run through agent-learning-db (span stats, full spans, root entity version).
 *
 * Results are streamed and discarded; trace ids are picked in memory and never printed.
 * Output is per shape: memory, latency and bytes read, default vs limit 8.
 *
 *   npx tsx read-ab.ts [--reps 3]
 */
import { parseArgs } from 'node:util';
import type { ClickHouseSettings } from '@clickhouse/client';

import { BenchClient, TIERS } from './client';
import { installOutputRedaction, loadCredentials } from './env';
import { collectMetrics } from './metrics';
import { loadSelection } from './profile';

const TENANT_TABLES = [
  'mastra_span_events',
  'mastra_trace_roots',
  'mastra_trace_branches',
  'mastra_metric_events',
  'mastra_log_events',
  'mastra_score_events',
  'mastra_feedback_events',
  'mastra_model_usage',
  'mastra_discovery_values',
  'mastra_discovery_pairs',
  'mastra_trace_roots_delta',
  'mastra_trace_branches_delta',
  'mastra_metric_events_delta',
  'mastra_log_events_delta',
  'mastra_score_events_delta',
  'mastra_feedback_events_delta',
];

// Copies of the production SQL (mobs-query internal-cleanup.ts, agent-learning-db source-traces.ts).
const TENANTS = `SELECT organizationId, projectId AS resourceId FROM (${TENANT_TABLES.map(
  t => `(SELECT DISTINCT organizationId, projectId FROM ${t} ORDER BY organizationId, projectId LIMIT {limit:UInt32})`,
).join(' UNION DISTINCT ')}) ORDER BY organizationId, projectId LIMIT {limit:UInt32}`;
const SCOPE = `organizationId = {organizationId:String} AND traceId = {traceId:String}
  AND ({projectId:String} = '' OR projectId = {projectId:String})`;
const SPAN_STATS = `SELECT count() AS spanCount, sum(length(ifNull(toString(attributes), '')) + length(ifNull(toString(metadataRaw), ''))
  + length(ifNull(toString(input), '')) + length(ifNull(toString(output), '')) + length(ifNull(toString(error), ''))) AS payloadBytes
  FROM mastra_span_events WHERE ${SCOPE}`;
const SPANS = `SELECT traceId, spanId, parentSpanId, spanType, entityType, entityId, entityName, entityVersionId,
  toString(startedAt) AS startedAt, toString(endedAt) AS endedAt, attributes, metadataRaw, input, output, error
  FROM mastra_span_events WHERE ${SCOPE} ORDER BY startedAt ASC, spanId ASC`;
const VERSION = `SELECT entityVersionId, metadataRaw FROM mastra_span_events WHERE ${SCOPE}
  AND spanType = 'agent_run' AND (parentSpanId IS NULL OR parentSpanId = '') ORDER BY startedAt ASC, spanId ASC LIMIT 1`;

// mobs-query's trace-detail read (loadScopedTraceSpans), for one trace.
const DETAIL = `SELECT * FROM (SELECT * FROM mastra_span_events WHERE traceId = {traceId:String}
  AND organizationId = {organizationId:String} AND projectId = {projectId:String}
  ORDER BY dedupeKey, endedAt DESC LIMIT 1 BY organizationId, projectId, dedupeKey)
  ORDER BY traceId ASC, startedAt ASC`;

const DEFAULT_ARMS: Array<readonly [string, ClickHouseSettings]> = [
  ['default', {}],
  ['pf8', { filesystem_prefetches_limit: '8' }],
];
// OBS-591 (--source): platform#3446's source settings vs those plus the new caps and the timeout a
// source client with the default 10 s request timeout sends.
const SOURCE_ARMS: Array<readonly [string, ClickHouseSettings]> = [
  ['pf8', { filesystem_prefetches_limit: '8' }],
  [
    'pf8+caps',
    {
      filesystem_prefetches_limit: '8',
      max_memory_usage: String(1024 ** 3),
      max_result_bytes: String(256 * 1024 ** 2),
      result_overflow_mode: 'throw',
      max_bytes_to_read: String(16 * 1024 ** 3),
      read_overflow_mode: 'throw',
      max_execution_time: 9,
      timeout_overflow_mode: 'throw',
    },
  ],
];

// OBS-591: how per-trace reads of the biggest recent trace behave under the new 1 GiB cap.
const BIG_TRACE_ARMS: Array<readonly [string, ClickHouseSettings]> = [
  ['pf8 t16', { filesystem_prefetches_limit: '8', max_threads: 16 }],
  ['pf8 t4', { filesystem_prefetches_limit: '8', max_threads: 4 }],
  ['pf8 t2', { filesystem_prefetches_limit: '8', max_threads: 2 }],
  ['pf8 t1', { filesystem_prefetches_limit: '8', max_threads: 1 }],
  ['pf8 t16 b1k', { filesystem_prefetches_limit: '8', max_threads: 16, max_block_size: '1024' }],
  ['pf8 t4 b128', { filesystem_prefetches_limit: '8', max_threads: 4, max_block_size: '128' }],
];

// --proof: mobs-query's settings today (platform#3407, 4 GiB profile cap) vs those plus the OBS-591 caps.
const PROOF_ARMS: Array<readonly [string, ClickHouseSettings]> = [
  ['today', { filesystem_prefetches_limit: '8' }],
  [
    'caps',
    {
      filesystem_prefetches_limit: '8',
      max_memory_usage: String(1024 ** 3),
      max_result_bytes: String(256 * 1024 ** 2),
      result_overflow_mode: 'throw',
      max_bytes_to_read: String(16 * 1024 ** 3),
      read_overflow_mode: 'throw',
    },
  ],
];

const { values } = parseArgs({
  options: {
    reps: { type: 'string', default: '3' },
    tenants: { type: 'boolean' },
    'big-trace': { type: 'boolean' },
    only: { type: 'string' },
    source: { type: 'boolean' },
    proof: { type: 'boolean' },
    by: { type: 'string', default: 'spans' },
    from: { type: 'string', default: '' },
    to: { type: 'string', default: '' },
  },
});
const reps = Number(values.reps);

async function main() {
  installOutputRedaction();
  const selection = loadSelection();
  if (!selection) throw new Error('no selection file; run profile first');
  const client = new BenchClient({ ...loadCredentials(), database: selection.database });
  const tier = { ...TIERS[1], maxResultRows: 100_000 };

  const measure = async (
    label: string,
    sql: string,
    params: Record<string, unknown>,
    settings: ClickHouseSettings,
    arms: ReadonlyArray<readonly [string, ClickHouseSettings]> = values.source ? SOURCE_ARMS : DEFAULT_ARMS,
  ) => {
    const out: string[] = [];
    for (const [arm, extra] of arms) {
      const runs: Awaited<ReturnType<typeof collectMetrics>>[] = [];
      // Rep 0 warms the cache for this arm; the reported numbers are warm (99.5% of production reads).
      for (let rep = 0; rep <= reps; rep++) {
        const logComment = `aqa-bench:read-ab:${label}:${arm}:${rep}`;
        const outcome = await client.discard(sql, params, { tier, logComment, settings: { ...settings, ...extra } });
        const m = await collectMetrics(client, 'cluster', outcome, tier, `aqa-bench:read-ab:qlog`);
        if (rep > 0) runs.push(m);
        await new Promise(r => setTimeout(r, 1_000));
      }
      const med = (f: (m: (typeof runs)[number]) => number | null) =>
        [...runs.map(r => Number(f(r) ?? 0))].sort((a, b) => a - b)[Math.floor(runs.length / 2)]!;
      out.push(
        `${arm}: ${Math.round(med(m => m.memoryBytes) / 1048576)} MiB, ${Math.round(med(m => m.durationMs))} ms, ` +
          `${Math.round(med(m => m.readBytes) / 1048576)} MiB read${runs.some(r => r.exceptionCode) ? ` (errors ${[...new Set(runs.map(r => r.exceptionCode))].join(',')})` : ''}`,
      );
    }
    console.log(`${label.padEnd(24)} ${out.join(' | ')}`);
  };

  if (values['big-trace']) {
    // The trace with the most span rows written in the last day, or (--by payload) the one with the
    // largest payload ended in the given window. Held in memory only.
    const pick = await client.rows<{
      organizationId: string;
      projectId: string;
      traceId: string;
      spans: string;
      payloadMiB: string;
    }>(
      values.by === 'payload'
        ? `SELECT organizationId, projectId, traceId, count() AS spans,
             round(sum(length(ifNull(toString(input), '')) + length(ifNull(toString(output), ''))
               + length(ifNull(toString(attributes), ''))) / 1048576) AS payloadMiB
             FROM mastra_span_events WHERE endedAt BETWEEN {from:DateTime} AND {to:DateTime}
             GROUP BY organizationId, projectId, traceId ORDER BY payloadMiB DESC LIMIT 1`
        : `SELECT organizationId, projectId, traceId, count() AS spans, 0 AS payloadMiB FROM mastra_span_events
             WHERE endedAt >= now() - INTERVAL 1 DAY GROUP BY organizationId, projectId, traceId
             ORDER BY spans DESC LIMIT 1`,
      { from: values.from, to: values.to },
      { tier: { ...tier, maxExecutionTimeS: 120 }, logComment: 'aqa-bench:read-ab:pick-big' },
    );
    const big = pick.rows?.[0];
    if (!big) throw new Error('no trace found');
    console.log(`picked trace: ${big.spans} span rows, ${big.payloadMiB} MiB payload`);
    const params = { organizationId: big.organizationId, projectId: big.projectId, traceId: big.traceId };
    for (const [label, sql] of [
      ['big span stats', SPAN_STATS],
      ['big spans', SPANS],
      ['big detail', DETAIL],
    ] as const) {
      if (values.only && !label.includes(values.only)) continue;
      await measure(
        label,
        sql,
        params,
        { max_memory_usage: String(4 * 1024 ** 3), max_result_rows: '0' },
        values.proof ? PROOF_ARMS : BIG_TRACE_ARMS,
      );
    }
    await client.close();
    return;
  }

  await measure('tenants (first page)', TENANTS, { limit: 1000 }, { apply_deleted_mask: 0 });
  if (values.tenants) {
    for (const table of TENANT_TABLES)
      await measure(
        table.replace('mastra_', ''),
        `SELECT DISTINCT organizationId, projectId FROM ${table} ORDER BY organizationId, projectId LIMIT {limit:UInt32}`,
        { limit: 1000 },
        { apply_deleted_mask: 0 },
      );
    await client.close();
    return;
  }

  for (const bucket of ['median', 'p99', 'largest'] as const) {
    const project = selection.projects.find(p => p.bucket === bucket && p.representative);
    if (!project) continue;
    // One recent agent trace, held in memory only.
    const pick = await client.rows<{ traceId: string }>(
      `SELECT traceId FROM mastra_trace_roots WHERE organizationId = {o:String} AND projectId = {p:String}
         AND entityType = 'agent' AND startedAt >= now() - INTERVAL 1 DAY ORDER BY startedAt DESC LIMIT 1`,
      { o: project.organizationId, p: project.projectId },
      { tier, logComment: 'aqa-bench:read-ab:pick' },
    );
    const traceId = pick.rows?.[0]?.traceId;
    if (!traceId) {
      console.log(`${bucket}: no recent agent trace`);
      continue;
    }
    const params = { organizationId: project.organizationId, projectId: project.projectId, traceId };
    await measure(`${bucket} span stats`, SPAN_STATS, params, {});
    await measure(`${bucket} spans`, SPANS, params, {});
    await measure(`${bucket} version`, VERSION, params, {});
  }
  await client.close();
}

await main();
