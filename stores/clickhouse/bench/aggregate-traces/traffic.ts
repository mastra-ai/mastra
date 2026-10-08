/**
 * Read-only profile of real query traffic from `system.query_log`: how often observability reads hit
 * cold storage, how long they take and how much memory they use. Output is counts, percentiles and
 * schema names only: no query text, parameters, users or tenant ids leave the replica. The harness's own
 * queries (`log_comment` starting with `aqa-bench`) are excluded.
 *
 *   npx tsx traffic.ts [--days 7] [--only access,sources,...]
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { BenchClient, TIERS } from './client';
import { installOutputRedaction, loadCredentials } from './env';
import { PREFLIGHT_FILE, RESULTS_DIR } from './run';

const OUT = join(RESULTS_DIR, 'traffic.jsonl');

// `all_groups.default` spans every compute group sharing this storage, so it includes the primary service's reads.
const LOG = `clusterAllReplicas('all_groups.default', system.query_log)`;
const OBS_TABLES = `['mastra_trace_roots', 'mastra_span_events', 'mastra_metric_events', 'mastra_score_events', 'mastra_feedback_events', 'mastra_log_events']`;
/** Finished or failed reads on observability tables in the window, excluding this harness. */
const READS = `
  type IN ('QueryFinish', 'ExceptionWhileProcessing')
  AND event_date >= toDate(now() - INTERVAL {days:UInt32} DAY)
  AND event_time >= now() - INTERVAL {days:UInt32} DAY
  AND query_kind = 'Select' AND is_initial_query
  AND NOT startsWith(log_comment, 'aqa-bench')
  AND hasAny(arrayMap(t -> splitByChar('.', t)[-1], tables), ${OBS_TABLES})`;
/** Which observability table a read is "about": the most expensive one it touches. */
const FAMILY = `multiIf(
  has(arrayMap(t -> splitByChar('.', t)[-1], tables), 'mastra_span_events'), 'spans',
  has(arrayMap(t -> splitByChar('.', t)[-1], tables), 'mastra_metric_events'), 'metrics',
  has(arrayMap(t -> splitByChar('.', t)[-1], tables), 'mastra_trace_roots'), 'roots',
  has(arrayMap(t -> splitByChar('.', t)[-1], tables), 'mastra_log_events'), 'logs', 'scores/feedback')`;
const FROM_SOURCE = `ProfileEvents['CachedReadBufferReadFromSourceBytes']`;
const FROM_CACHE = `ProfileEvents['CachedReadBufferReadFromCacheBytes']`;
const PROFILE = `
  count() AS queries,
  countIf(exception_code != 0) AS failed,
  countIf(exception_code = 159) AS timeouts,
  countIf(exception_code = 241) AS memoryLimit,
  countIf(exception_code IN (394, 210, 209)) AS cancelledOrNetwork,
  countIf(query_duration_ms > 10000) AS over10s,
  countIf(query_duration_ms > 5000) AS over5s,
  round(quantile(0.5)(query_duration_ms)) AS p50ms,
  round(quantile(0.9)(query_duration_ms)) AS p90ms,
  round(quantile(0.99)(query_duration_ms)) AS p99ms,
  max(query_duration_ms) AS maxMs,
  round(quantile(0.5)(memory_usage) / 1048576, 1) AS p50MiB,
  round(quantile(0.9)(memory_usage) / 1048576, 1) AS p90MiB,
  round(quantile(0.99)(memory_usage) / 1048576, 1) AS p99MiB,
  round(max(memory_usage) / 1048576, 1) AS maxMiB,
  round(quantile(0.5)(read_bytes) / 1048576, 1) AS p50ReadMiB,
  round(quantile(0.99)(read_bytes) / 1048576, 1) AS p99ReadMiB,
  countIf(${FROM_SOURCE} > 0) AS touchedObjectStorage,
  countIf(${FROM_SOURCE} > 0 AND ${FROM_SOURCE} >= ${FROM_CACHE}) AS mostlyCold,
  round(sum(${FROM_SOURCE}) / nullIf(sum(${FROM_SOURCE}) + sum(${FROM_CACHE}), 0), 3) AS coldByteShare`;

const CHECKS: Array<{ id: string; question: string; sql: string }> = [
  {
    id: 'access',
    question: 'Can this user read query_log on every replica, and how far back does it go?',
    sql: `SELECT count() AS rows, uniqExact(hostName()) AS replicas, min(event_date) AS oldestDay
          FROM ${LOG} WHERE event_date >= today() - 1`,
  },
  {
    id: 'sources',
    question: 'Who reads observability tables here: is Platform (mobs-query) traffic visible?',
    sql: `SELECT cityHash64(user) % 100000 AS userHash, interface,
                 splitByChar(' ', http_user_agent)[1] AS agent,
                 count() AS queries, uniqExact(normalized_query_hash) AS shapes,
                 min(event_date) AS firstDay, max(event_date) AS lastDay
          FROM ${LOG} WHERE ${READS}
          GROUP BY userHash, interface, agent ORDER BY queries DESC LIMIT 20`,
  },
  {
    id: 'by-family',
    question: 'Per table family: volume, failures, latency, memory and cold reads',
    sql: `SELECT ${FAMILY} AS family, ${PROFILE} FROM ${LOG} WHERE ${READS} GROUP BY family ORDER BY queries DESC`,
  },
  {
    id: 'by-day',
    question: 'Per day: is the traffic steady, and does the cold share vary?',
    sql: `SELECT event_date AS day, ${PROFILE} FROM ${LOG} WHERE ${READS} GROUP BY day ORDER BY day`,
  },
  {
    id: 'cold-vs-warm',
    question: 'Latency and memory of reads that went to object storage vs reads served from cache',
    sql: `SELECT ${FAMILY} AS family,
                 if(${FROM_SOURCE} > 0 AND ${FROM_SOURCE} >= ${FROM_CACHE}, 'cold',
                    if(${FROM_SOURCE} > 0, 'partly-cold', 'warm')) AS cache, ${PROFILE}
          FROM ${LOG} WHERE ${READS} GROUP BY family, cache ORDER BY family, cache`,
  },
  {
    id: 'shapes',
    question: 'The 25 query shapes that cost the most total time (no query text, only tables and features)',
    sql: `SELECT toString(normalized_query_hash % 1000000) AS shape,
                 any(${FAMILY}) AS family,
                 any(arraySort(arrayDistinct(arrayMap(t -> splitByChar('.', t)[-1], tables)))) AS tableSet,
                 any(position(query, 'GROUP BY') > 0) AS grouped,
                 any(position(query, 'quantile') > 0) AS percentiles,
                 any(position(query, 'uniq') > 0) AS distinct,
                 any(position(query, ' JOIN ') > 0) AS joins,
                 round(sum(query_duration_ms) / 1000) AS totalSeconds, ${PROFILE}
          FROM ${LOG} WHERE ${READS}
          GROUP BY shape ORDER BY totalSeconds DESC LIMIT 25`,
  },
  {
    id: 'concurrency',
    question: 'Peak observability reads running in the same second, and memory in flight then',
    sql: `SELECT max(n) AS peakConcurrent, quantile(0.99)(n) AS p99Concurrent,
                 round(max(mem) / 1048576) AS peakInFlightMiB
          FROM (
            SELECT s, count() AS n, sum(memory_usage) AS mem
            FROM (SELECT arrayJoin(range(toUInt32(query_start_time), toUInt32(event_time) + 1)) AS s, memory_usage
                  FROM ${LOG} WHERE ${READS})
            GROUP BY s
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
        logComment: `aqa-bench:traffic:${check.id}`,
        settings: { max_execution_time: 120, max_result_rows: '100' },
      });
      const record = {
        id: check.id,
        days: params.days,
        ok: outcome.ok,
        errorCode: outcome.errorCode,
        wallMs: Math.round(outcome.wallMs),
        rows: outcome.rows ?? [],
      };
      appendFileSync(OUT, `${JSON.stringify(record)}\n`);
      process.stdout.write(
        `${check.id}: ${outcome.ok ? JSON.stringify(record.rows) : `failed ${outcome.errorCode}`}\n`,
      );
    }
  } finally {
    await client.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
