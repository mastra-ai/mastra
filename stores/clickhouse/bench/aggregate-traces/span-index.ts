/**
 * Read-only sizing for a span-name index (OBS-595), from the production read replica.
 * Aggregate-only: prints counts and sizes, never ids, names or row data.
 *
 *   pnpm tsx bench/aggregate-traces/span-index.ts [--days 7] [--only parts,index]
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { BenchClient, TIERS } from './client';
import { installOutputRedaction, loadCredentials } from './env';
import { PREFLIGHT_FILE, RESULTS_DIR } from './run';

const CHECKS: { id: string; sql: string }[] = [
  {
    // Clock skew: how far before its trace's root start a span ends (or starts). Single-root traces whose root
    // started 2-1 days ago; spans read back to 1 day before that, so skew up to a day is visible.
    id: 'skew',
    sql: `WITH roots AS (
        SELECT organizationId, projectId, traceId, min(startedAt) AS rootStart
        FROM mastra_trace_roots
        WHERE startedAt >= now() - INTERVAL 2 DAY AND startedAt < now() - INTERVAL 1 DAY
        GROUP BY organizationId, projectId, traceId
        HAVING uniqExact(spanId) = 1
      )
      SELECT
        count() AS spans,
        uniqExact(s.traceId) AS traces,
        countIf(s.endedAt < r.rootStart) AS endBeforeRoot,
        countIf(s.startedAt < r.rootStart) AS startBeforeRoot,
        uniqExactIf(s.traceId, s.endedAt < r.rootStart) AS tracesEndBeforeRoot,
        min(dateDiff('millisecond', r.rootStart, s.endedAt)) AS minEndMinusRootMs,
        quantileExactIf(0.001)(dateDiff('millisecond', r.rootStart, s.endedAt), s.endedAt < r.rootStart) AS p001EarlyEndMs,
        min(dateDiff('millisecond', r.rootStart, s.startedAt)) AS minStartMinusRootMs
      FROM mastra_span_events s
      INNER JOIN roots r ON s.organizationId = r.organizationId AND s.projectId = r.projectId AND s.traceId = r.traceId
      WHERE s.endedAt >= now() - INTERVAL 3 DAY`,
  },
  {
    // The early spans from 'skew', bucketed by how early they end, and whether their trace has a root (any time)
    // other than the one in the window, i.e. a multi-root trace.
    id: 'skew-detail',
    sql: `WITH roots AS (
        SELECT organizationId, projectId, traceId, min(startedAt) AS rootStart
        FROM mastra_trace_roots
        WHERE startedAt >= now() - INTERVAL 2 DAY AND startedAt < now() - INTERVAL 1 DAY
        GROUP BY organizationId, projectId, traceId
        HAVING uniqExact(spanId) = 1
      ),
      early AS (
        SELECT s.organizationId AS o, s.projectId AS p, s.traceId AS t,
          min(dateDiff('millisecond', r.rootStart, s.endedAt)) AS earliestMs
        FROM mastra_span_events s
        INNER JOIN roots r ON s.organizationId = r.organizationId AND s.projectId = r.projectId AND s.traceId = r.traceId
        WHERE s.endedAt >= now() - INTERVAL 3 DAY AND s.endedAt < r.rootStart
        GROUP BY o, p, t
      ),
      allRoots AS (
        SELECT organizationId AS o, projectId AS p, traceId AS t, uniqExact(spanId) AS rootsEver
        FROM mastra_trace_roots
        WHERE (organizationId, projectId, traceId) IN (SELECT o, p, t FROM early)
        GROUP BY o, p, t
      )
      SELECT
        multiIf(e.earliestMs > -1000, '<1s', e.earliestMs > -60000, '<1m', e.earliestMs > -3600000, '<1h', '>=1h') AS early,
        a.rootsEver > 1 AS multiRoot,
        count() AS traces
      FROM early e LEFT JOIN allRoots a ON e.o = a.o AND e.p = a.p AND e.t = a.t
      GROUP BY early, multiRoot ORDER BY early, multiRoot`,
  },
  {
    // Table shape: TTL, partitions and active parts drive how many object-storage reads a cold lookup needs.
    id: 'table',
    sql: `SELECT
        extract(any(t.create_table_query), 'TTL [^S]*') AS ttl,
        uniqExact(p.partition) AS partitions,
        count() AS activeParts,
        sum(p.rows) AS rows,
        formatReadableSize(sum(p.data_compressed_bytes)) AS compressed
      FROM system.parts p
      INNER JOIN system.tables t ON t.database = p.database AND t.name = p.table
      WHERE p.database = currentDatabase() AND p.table = 'mastra_span_events' AND p.active`,
  },
  {
    // Upper bound on index bytes: the compressed size of the columns the index would hold.
    id: 'columns',
    sql: `SELECT name AS column, formatReadableSize(data_compressed_bytes) AS compressed,
        round(data_compressed_bytes / (SELECT sum(data_compressed_bytes) FROM system.columns
          WHERE database = currentDatabase() AND table = 'mastra_span_events'), 4) AS shareOfTable
      FROM system.columns
      WHERE database = currentDatabase() AND table = 'mastra_span_events'
        AND name IN ('organizationId', 'projectId', 'traceId', 'name', 'endedAt', 'attributes', 'input', 'output')
      ORDER BY data_compressed_bytes DESC`,
  },
  {
    // Index rows vs span rows: one index row per (tenant, project, name, trace).
    id: 'index',
    sql: `SELECT
        count() AS spanRows,
        uniq(organizationId, projectId, name, traceId) AS indexRows,
        round(indexRows / spanRows, 3) AS ratio,
        uniq(organizationId, projectId, name) AS tenantNames
      FROM mastra_span_events
      WHERE endedAt >= now() - INTERVAL {days:UInt32} DAY`,
  },
  {
    // How many daily partitions one trace's spans touch, and how many distinct names a project has.
    id: 'spread',
    sql: `SELECT
        quantiles(0.5, 0.99)(days)[1] AS p50DaysPerTrace,
        quantiles(0.5, 0.99)(days)[2] AS p99DaysPerTrace,
        max(days) AS maxDaysPerTrace,
        countIf(days > 1) AS tracesSpanningDays,
        count() AS traces
      FROM (
        SELECT traceId, uniqExact(toDate(endedAt)) AS days
        FROM mastra_span_events
        WHERE endedAt >= now() - INTERVAL {days:UInt32} DAY
        GROUP BY organizationId, projectId, traceId
      )`,
  },
  {
    id: 'names',
    sql: `SELECT
        quantiles(0.5, 0.9, 0.99)(names) AS namesPerProject,
        max(names) AS maxNamesPerProject,
        count() AS projects
      FROM (
        SELECT uniqExact(name) AS names FROM mastra_span_events
        WHERE endedAt >= now() - INTERVAL {days:UInt32} DAY
        GROUP BY organizationId, projectId
      )`,
  },
];

async function main() {
  installOutputRedaction();
  const { values } = parseArgs({ options: { days: { type: 'string', default: '7' }, only: { type: 'string' } } });
  const client = new BenchClient({
    ...loadCredentials(),
    database: (JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string }).database,
  });
  const only = values.only ? new Set(values.only.split(',')) : undefined;
  const params = { days: Number(values.days) };
  try {
    for (const check of CHECKS.filter(c => !only || only.has(c.id))) {
      await new Promise(r => setTimeout(r, 2000));
      const outcome = await client.rows<Record<string, unknown>>(check.sql, params, {
        tier: TIERS[1],
        logComment: `aqa-bench:span-index:${check.id}`,
        settings: { max_execution_time: 120, max_result_rows: '100' },
      });
      const record = {
        id: check.id,
        days: params.days,
        ok: outcome.ok,
        errorCode: outcome.errorCode,
        rows: outcome.rows ?? [],
      };
      appendFileSync(join(RESULTS_DIR, 'span-index.jsonl'), `${JSON.stringify(record)}\n`);
      console.log(`== ${check.id} ${outcome.ok ? '' : `FAILED ${outcome.errorCode}`}`);
      for (const row of record.rows) console.log(JSON.stringify(row));
    }
  } finally {
    await client.close();
  }
}

await main();
