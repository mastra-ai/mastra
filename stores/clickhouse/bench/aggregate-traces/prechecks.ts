/**
 * Read-only facts the schema proposals depend on (SCHEMA-PROPOSALS.md). Every query aggregates across all
 * tenants and returns counts and ratios only: no ids, names or values leave the replica.
 *
 *   npx tsx prechecks.ts [--days 7]
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { TRACE_AGGREGATE_USAGE_METRIC_NAMES } from '@mastra/core/storage';

import { BenchClient, TIERS } from './client';
import { installOutputRedaction, loadCredentials } from './env';
import { loadSelection } from './profile';
import { PREFLIGHT_FILE, RESULTS_DIR } from './run';

const OUT = join(RESULTS_DIR, 'prechecks.jsonl');
const chTime = (d: Date) => d.toISOString().replace('T', ' ').replace(/Z$/, '');

/** Each check: one aggregate row. `{from}`/`{to}` bound the event window; `{names}` are the token metric names. */
const CHECKS: Array<{ id: string; question: string; sql: string }> = [
  {
    id: 'root-duplicates',
    question: 'Is a trace root ever stored more than once, and do the copies differ?',
    sql: `
      SELECT count() AS traces, sum(c) AS rows, countIf(c > 1) AS dupTraces, max(c) AS maxCopies,
             countIf(c > 1 AND ends > 1) AS dupDifferentEnd, countIf(c > 1 AND errs > 1) AS dupDifferentError
      FROM (
        SELECT cityHash64(organizationId, traceId) AS k, count() AS c,
               uniqExact(endedAt) AS ends, uniqExact(isNotNull(error)) AS errs
        FROM mastra_trace_roots
        WHERE endedAt >= {from:DateTime64(3)} AND endedAt < {to:DateTime64(3)}
        GROUP BY k
      )`,
  },
  {
    id: 'token-duplicates',
    question: 'Is a token metric row ever stored more than once?',
    sql: `
      SELECT count() AS metricIds, sum(c) AS rows, countIf(c > 1) AS dupMetricIds, max(c) AS maxCopies,
             countIf(c > 1 AND vals > 1) AS dupDifferentValue
      FROM (
        SELECT cityHash64(organizationId, traceId, metricId) AS k, count() AS c, uniqExact(value) AS vals
        FROM mastra_metric_events
        WHERE timestamp >= {from:DateTime64(3)} AND timestamp < {to:DateTime64(3)} AND name IN {names:Array(String)}
        GROUP BY k
      )`,
  },
  {
    id: 'span-duplicates',
    question: 'Is a span stored more than once, and can its name change between copies?',
    sql: `
      SELECT count() AS spans, sum(c) AS rows, countIf(c > 1) AS dupSpans, max(c) AS maxCopies,
             countIf(names > 1) AS spansWithNameChange
      FROM (
        SELECT cityHash64(organizationId, traceId, spanId) AS k, count() AS c, uniqExact(name) AS names
        FROM mastra_span_events
        WHERE endedAt >= {from:DateTime64(3)} AND endedAt < {to:DateTime64(3)}
        GROUP BY k
      )`,
  },
  {
    id: 'token-vs-root',
    question: 'Are token rows recorded after the root ends, or without any root (relevant to usage-on-root)?',
    sql: `
      SELECT count() AS tokenRows,
             countIf(r.k = 0) AS noRoot,
             countIf(r.k != 0 AND m.timestamp > r.rootEnd) AS afterRootEnd,
             countIf(r.k != 0 AND m.timestamp > r.rootEnd + INTERVAL 1 MINUTE) AS afterRootEndPlus1m,
             countIf(r.k != 0 AND toStartOfHour(m.timestamp) != toStartOfHour(r.rootStart)) AS otherHourThanRootStart,
             sumIf(m.value, r.k != 0 AND toStartOfHour(m.timestamp) != toStartOfHour(r.rootStart)) / nullIf(sum(m.value), 0) AS tokenShareOtherHour,
             countIf(isNull(m.rootEntityName)) AS nullRootEntityName,
             countIf(r.k != 0 AND isNotNull(m.rootEntityName) AND m.rootEntityName != r.rootEntity) AS rootEntityNameMismatch
      FROM (
        SELECT cityHash64(organizationId, traceId) AS k, timestamp, value, rootEntityName
        FROM mastra_metric_events
        WHERE timestamp >= {from:DateTime64(3)} AND timestamp < {to:DateTime64(3)} AND name IN {names:Array(String)}
      ) AS m
      LEFT JOIN (
        SELECT cityHash64(organizationId, traceId) AS k, any(startedAt) AS rootStart, max(endedAt) AS rootEnd,
               any(entityName) AS rootEntity
        FROM mastra_trace_roots
        WHERE endedAt >= {from:DateTime64(3)} - INTERVAL 1 DAY AND endedAt < {to:DateTime64(3)} + INTERVAL 1 DAY
        GROUP BY k
      ) AS r ON r.k = m.k
      SETTINGS join_use_nulls = 0`,
  },
  {
    id: 'hour-crossing',
    question: 'How many traces span an hour boundary (hour attribution for a rollup)?',
    sql: `
      SELECT count() AS traces, countIf(toStartOfHour(startedAt) != toStartOfHour(endedAt)) AS crossHour,
             quantile(0.5)(dateDiff('second', startedAt, endedAt)) AS p50s,
             quantile(0.99)(dateDiff('second', startedAt, endedAt)) AS p99s,
             max(dateDiff('second', startedAt, endedAt)) AS maxS
      FROM mastra_trace_roots
      WHERE endedAt >= {from:DateTime64(3)} AND endedAt < {to:DateTime64(3)}`,
  },
  {
    id: 'rollup-cardinality',
    question: 'How many rows would an hourly rollup and a span-name index hold?',
    sql: `
      SELECT
        (SELECT count() FROM mastra_trace_roots
          WHERE endedAt >= {from:DateTime64(3)} AND endedAt < {to:DateTime64(3)}) AS roots,
        (SELECT count() FROM (
           SELECT 1 FROM mastra_trace_roots
           WHERE endedAt >= {from:DateTime64(3)} AND endedAt < {to:DateTime64(3)}
           GROUP BY organizationId, projectId, toStartOfHour(startedAt), entityType, entityName, environment,
                    serviceName, executionSource)) AS hourlyRows,
        (SELECT count() FROM mastra_span_events
          WHERE endedAt >= {from:DateTime64(3)} AND endedAt < {to:DateTime64(3)}) AS spanRows,
        (SELECT count() FROM (
           SELECT 1 FROM mastra_span_events
           WHERE endedAt >= {from:DateTime64(3)} AND endedAt < {to:DateTime64(3)}
           GROUP BY organizationId, projectId, name, cityHash64(traceId))) AS spanNameRows`,
  },
  {
    id: 'token-per-span',
    question: 'Does each span carry at most one token row per metric name (needed for one row per model call)?',
    sql: `
      SELECT count() AS spanNames, countIf(ids > 1) AS spanNamesWithSeveralMetricIds, max(ids) AS maxIds,
             uniqExact(span) AS spans, sum(rows) AS rows, countIf(nullSpan) AS nullSpanId
      FROM (
        SELECT cityHash64(organizationId, traceId, spanId) AS span, name, uniqExact(metricId) AS ids, count() AS rows,
               any(isNull(spanId)) AS nullSpan
        FROM mastra_metric_events
        WHERE timestamp >= {from:DateTime64(3)} AND timestamp < {to:DateTime64(3)} AND name IN {names:Array(String)}
        GROUP BY span, name
      )`,
  },
  {
    id: 'token-span-type',
    question: 'Which span types carry the token rows (model calls vs ancestors with rolled-up internal usage)?',
    sql: `
      SELECT ifNull(s.spanType, 'no span') AS spanType, count() AS tokenRows
      FROM (
        SELECT cityHash64(organizationId, traceId, spanId) AS k
        FROM mastra_metric_events
        WHERE timestamp >= {from:DateTime64(3)} AND timestamp < {to:DateTime64(3)} AND name IN {names:Array(String)}
      ) AS m
      LEFT JOIN (
        SELECT cityHash64(organizationId, traceId, spanId) AS k, any(toString(spanType)) AS spanType
        FROM mastra_span_events
        WHERE endedAt >= {from:DateTime64(3)} - INTERVAL 1 HOUR AND endedAt < {to:DateTime64(3)} + INTERVAL 1 HOUR
        GROUP BY k
      ) AS s ON s.k = m.k
      GROUP BY spanType ORDER BY tokenRows DESC
      SETTINGS join_use_nulls = 1`,
  },
  {
    id: 'model-span-usage',
    question: 'Do copies of a model span carry the same usage?',
    sql: `
      SELECT count() AS dupModelSpans, countIf(usages > 1) AS withDifferentUsage
      FROM (
        SELECT cityHash64(organizationId, traceId, spanId) AS k, count() AS c,
               uniqExact(cityHash64(JSONExtractRaw(ifNull(attributes, '{}'), 'usage'))) AS usages
        FROM mastra_span_events
        WHERE endedAt >= {from:DateTime64(3)} AND endedAt < {to:DateTime64(3)} AND spanType = 'model_generation'
        GROUP BY k
        HAVING c > 1
      )`,
  },
];

async function main() {
  installOutputRedaction();
  const { values } = parseArgs({ options: { days: { type: 'string', default: '7' }, only: { type: 'string' } } });
  const selection = loadSelection();
  if (!selection) throw new Error('No selection; run profile first');
  const to = new Date(selection.anchorTo);
  const from = new Date(to.getTime() - Number(values.days) * 86_400_000);
  const params = { from: chTime(from), to: chTime(to), names: [...TRACE_AGGREGATE_USAGE_METRIC_NAMES] };
  const client = new BenchClient({
    ...loadCredentials(),
    database: (JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string }).database,
  });
  const only = values.only ? new Set(values.only.split(',')) : undefined;
  try {
    for (const check of CHECKS.filter(c => !only || only.has(c.id))) {
      await new Promise(r => setTimeout(r, 2000));
      const outcome = await client.rows<Record<string, unknown>>(check.sql, params, {
        tier: TIERS[1],
        logComment: `aqa-bench:precheck:${check.id}`,
        settings: { max_execution_time: 120, max_result_rows: '50' },
      });
      const record = {
        id: check.id,
        days: Number(values.days),
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
