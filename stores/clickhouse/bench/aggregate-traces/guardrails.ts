/**
 * Read-only sizing data for OBS-591 (per-query memory cap, result/read limits, concurrency) from
 * `system.query_log`. Output is counts and percentiles per read client and table family, plus
 * literal-free normalized query heads for the heaviest shapes: no parameters, users or tenant ids.
 *
 *   npx tsx guardrails.ts [--only clients,heavy,concurrency,server] [--days 2]
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { BenchClient, TIERS } from './client';
import { installOutputRedaction, loadCredentials } from './env';
import { PREFLIGHT_FILE } from './run';

const { values } = parseArgs({ options: { only: { type: 'string' }, days: { type: 'string' } } });
const only = values.only?.split(',');
const days = Number(values.days ?? 2);

const LOG = `clusterAllReplicas('all_groups.default', system.query_log)`;
const OBS_TABLES = `['mastra_trace_roots', 'mastra_span_events', 'mastra_metric_events', 'mastra_score_events', 'mastra_feedback_events', 'mastra_log_events', 'mastra_trace_branches', 'mastra_model_usage']`;
const SHORT = `arrayMap(t -> splitByChar('.', t)[-1], tables)`;
const READS = `
  type IN ('QueryFinish', 'ExceptionWhileProcessing')
  AND event_time >= now() - INTERVAL ${days} DAY
  AND query_kind = 'Select' AND is_initial_query
  AND NOT startsWith(log_comment, 'aqa-bench')
  AND hasAny(${SHORT}, ${OBS_TABLES})`;
const FAMILY = `multiIf(
  has(${SHORT}, 'mastra_span_events'), 'spans',
  has(${SHORT}, 'mastra_metric_events'), 'metrics',
  has(${SHORT}, 'mastra_trace_branches'), 'branches',
  has(${SHORT}, 'mastra_trace_roots'), 'roots',
  has(${SHORT}, 'mastra_log_events'), 'logs', 'other')`;
// Which Platform client sent the read, told apart by the settings each one applies.
const CLIENT = `multiIf(
  Settings['max_memory_usage'] = '134217728', 'agent-learning trace reader',
  Settings['max_memory_usage'] = '268435456', 'agent-learning traceReadSettings',
  Settings['max_execution_time'] = '9', 'mobs-query interactive',
  has(${SHORT}, 'mastra_span_events') AND length(tables) >= 8, 'cleanup /tenants',
  Settings['filesystem_prefetches_limit'] = '8', 'source read (pf8, no timeout)',
  'unsettled')`;
const MIB = 1048576;
const PROFILE = `
  count() AS n,
  countIf(exception_code != 0) AS failed,
  countIf(exception_code = 241) AS mem241,
  countIf(exception_code = 159) AS t159,
  round(quantile(0.5)(memory_usage) / ${MIB}) AS p50MiB,
  round(quantile(0.99)(memory_usage) / ${MIB}) AS p99MiB,
  round(quantile(0.999)(memory_usage) / ${MIB}) AS p999MiB,
  round(max(memory_usage) / ${MIB}) AS maxMiB,
  countIf(memory_usage > 256 * ${MIB}) AS gt256,
  countIf(memory_usage > 512 * ${MIB}) AS gt512,
  countIf(memory_usage > 768 * ${MIB}) AS gt768,
  countIf(memory_usage > 1024 * ${MIB}) AS gt1G,
  countIf(memory_usage > 2048 * ${MIB}) AS gt2G,
  round(quantile(0.999)(read_bytes) / ${MIB}) AS p999ReadMiB,
  round(max(read_bytes) / ${MIB}) AS maxReadMiB,
  max(read_rows) AS maxReadRows,
  max(result_rows) AS maxResultRows,
  round(max(result_bytes) / ${MIB}, 1) AS maxResultMiB,
  round(quantile(0.99)(query_duration_ms)) AS p99ms,
  max(query_duration_ms) AS maxMs`;

async function main() {
  installOutputRedaction();
  const { database } = JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string };
  const client = new BenchClient({ ...loadCredentials(), database });
  const run = async (id: string, sql: string) => {
    if (only && !only.includes(id)) return;
    const outcome = await client.rows<Record<string, unknown>>(
      sql,
      {},
      {
        tier: { ...TIERS[1], maxExecutionTimeS: 120 },
        logComment: `aqa-bench:guardrails:${id}`,
      },
    );
    if (!outcome.ok) {
      console.log(`${id}: failed (code ${outcome.errorCode ?? '?'})`);
      return;
    }
    console.log(`\n## ${id}`);
    for (const row of outcome.rows!) console.log(JSON.stringify(row));
  };

  await run(
    'window',
    `SELECT min(event_time) AS first, max(event_time) AS last, count() AS reads, uniqExact(hostName()) AS hosts
     FROM ${LOG} WHERE ${READS}`,
  );
  await run(
    'clients',
    `SELECT ${CLIENT} AS client, ${FAMILY} AS family, ${PROFILE}
     FROM ${LOG} WHERE ${READS} GROUP BY client, family ORDER BY client, n DESC`,
  );
  await run(
    'heavy',
    `SELECT ${CLIENT} AS client, ${FAMILY} AS family, normalized_query_hash AS shape, count() AS n,
       countIf(memory_usage > 512 * ${MIB}) AS gt512, round(max(memory_usage) / ${MIB}) AS maxMiB,
       round(max(read_bytes) / ${MIB}) AS maxReadMiB, max(result_rows) AS maxResultRows,
       substring(normalizeQuery(any(query)), 1, 140) AS head
     FROM ${LOG} WHERE ${READS}
     GROUP BY client, family, shape HAVING maxMiB > 384 ORDER BY maxMiB DESC LIMIT 25`,
  );
  // OBS-591 what-if: reads per client that the new default limits would have stopped (memory over
  // 1 GiB, more than 16 GiB read, more than 256 MiB returned). Cleanup is exempt from all three.
  await run(
    'whatif',
    `SELECT ${CLIENT} AS client, count() AS n,
       countIf(memory_usage > 1024 * ${MIB}) AS overMem1G,
       countIf(read_bytes > 16 * 1024 * ${MIB}) AS overRead16G,
       countIf(result_bytes > 256 * ${MIB}) AS overResult256M,
       countIf(memory_usage > 1024 * ${MIB} OR read_bytes > 16 * 1024 * ${MIB}
         OR result_bytes > 256 * ${MIB}) AS stopped,
       round(max(memory_usage) / ${MIB}) AS maxMiB,
       round(max(read_bytes) / ${MIB}) AS maxReadMiB,
       round(max(result_bytes) / ${MIB}, 1) AS maxResultMiB
     FROM ${LOG} WHERE ${READS} GROUP BY client ORDER BY n DESC`,
  );
  // The reads over 1 GiB outside cleanup: which shapes, when, and how big their inputs were.
  await run(
    'over1g',
    `SELECT ${CLIENT} AS client, ${FAMILY} AS family, normalized_query_hash AS shape,
       count() AS n, min(event_time) AS first, max(event_time) AS last,
       round(quantile(0.5)(memory_usage) / ${MIB}) AS p50MiB, round(max(memory_usage) / ${MIB}) AS maxMiB,
       round(max(read_bytes) / ${MIB}) AS maxReadMiB, max(read_rows) AS maxReadRows,
       max(result_rows) AS maxResultRows, round(max(result_bytes) / ${MIB}, 1) AS maxResultMiB,
       max(query_duration_ms) AS maxMs, countIf(exception_code != 0) AS failed,
       any(Settings['filesystem_prefetches_limit']) AS prefetch, any(Settings['max_threads']) AS threads,
       substring(normalizeQuery(any(query)), 1, 160) AS head
     FROM ${LOG} WHERE ${READS} AND memory_usage > 1024 * ${MIB} AND ${CLIENT} != 'cleanup /tenants'
     GROUP BY client, family, shape ORDER BY n DESC`,
  );
  // Same shapes below 1 GiB: how often they run and how their memory is distributed.
  await run(
    'over1g-shapes',
    `WITH heavy AS (
       SELECT DISTINCT normalized_query_hash FROM ${LOG}
       WHERE ${READS} AND memory_usage > 1024 * ${MIB} AND ${CLIENT} != 'cleanup /tenants')
     SELECT normalized_query_hash AS shape, toStartOfHour(event_time) AS hour, count() AS n,
       round(quantile(0.5)(memory_usage) / ${MIB}) AS p50MiB,
       round(quantile(0.99)(memory_usage) / ${MIB}) AS p99MiB,
       round(max(memory_usage) / ${MIB}) AS maxMiB,
       countIf(memory_usage > 1024 * ${MIB}) AS over1G,
       round(quantile(0.5)(read_bytes) / ${MIB}) AS p50ReadMiB
     FROM ${LOG} WHERE ${READS} AND normalized_query_hash IN heavy
     GROUP BY shape, hour ORDER BY shape, hour`,
  );
  // Wording of each limit error as this server reports it (the text up to the first ':', which is
  // the fixed message template), so error classification can be checked against production.
  await run(
    'limit-messages',
    `SELECT exception_code AS code,
       extract(exception, 'DB::Exception: ([^:]*)') AS template, count() AS n
     FROM ${LOG}
     WHERE type IN ('ExceptionBeforeStart', 'ExceptionWhileProcessing')
       AND event_time >= now() - INTERVAL ${days} DAY
       AND exception_code IN (241, 202, 307, 158, 396)
     GROUP BY code, template ORDER BY code, n DESC`,
  );
  // In-flight reads and memory per second (each read counted in every second it ran).
  await run(
    'concurrency',
    `WITH per_second AS (
       SELECT sec, ${CLIENT} AS client, count() AS inflight, sum(memory_usage) AS mem
       FROM ${LOG}
       ARRAY JOIN range(toUInt32(toUnixTimestamp(query_start_time)), toUInt32(toUnixTimestamp(event_time)) + 1) AS sec
       WHERE ${READS}
       GROUP BY sec, client)
     SELECT client, count() AS seconds, max(inflight) AS peakInflight,
       quantile(0.99)(inflight) AS p99Inflight, quantile(0.999)(inflight) AS p999Inflight,
       round(max(mem) / 1073741824, 2) AS peakGiB, round(quantile(0.999)(mem) / 1073741824, 2) AS p999GiB
     FROM per_second GROUP BY client ORDER BY peakInflight DESC`,
  );
  await run(
    'concurrency-all',
    `WITH per_second AS (
       SELECT sec, count() AS inflight, sum(memory_usage) AS mem
       FROM ${LOG}
       ARRAY JOIN range(toUInt32(toUnixTimestamp(query_start_time)), toUInt32(toUnixTimestamp(event_time)) + 1) AS sec
       WHERE ${READS}
       GROUP BY sec)
     SELECT max(inflight) AS peakInflight, quantile(0.99)(inflight) AS p99Inflight,
       round(max(mem) / 1073741824, 2) AS peakGiB, round(quantile(0.999)(mem) / 1073741824, 2) AS p999GiB
     FROM per_second`,
  );
  // Server-level limits visible from the replica (same service tier as the primary).
  await run(
    'server',
    `SELECT name, value FROM system.server_settings
     WHERE name IN ('max_concurrent_queries', 'max_concurrent_select_queries', 'max_server_memory_usage',
       'max_server_memory_usage_to_ram_ratio', 'concurrent_threads_soft_limit_num')`,
  );
  await run(
    'profile-defaults',
    `SELECT name, value, changed FROM system.settings
     WHERE name IN ('max_memory_usage', 'max_memory_usage_for_user', 'max_concurrent_queries_for_user',
       'max_concurrent_queries_for_all_users', 'max_bytes_before_external_group_by', 'max_bytes_before_external_sort',
       'max_bytes_ratio_before_external_group_by', 'max_bytes_ratio_before_external_sort', 'queue_max_wait_ms')`,
  );
  await run(
    'memory',
    `SELECT round(value / 1073741824, 1) AS gib, metric FROM system.asynchronous_metrics WHERE metric IN ('OSMemoryTotal', 'CGroupMemoryTotal')`,
  );
}

await main();
