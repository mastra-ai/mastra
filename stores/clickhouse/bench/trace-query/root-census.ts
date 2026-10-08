/**
 * QX23: how many root spans a trace has, and how copies of one root span differ. Replica-wide (every tenant),
 * aggregate-only: counts, quantiles and enum breakdowns (span/entity type). No ids, names or values leave the
 * replica; traces are grouped by a hash of (organizationId, projectId, traceId).
 *
 *   npx tsx bench/trace-query/root-census.ts [--days 7] [--to 2026-10-08T21:00:00Z] [--only overview,...]
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { BenchClient, TIERS } from '../shared/client';
import { installOutputRedaction, loadCredentials } from '../shared/env';
import { files, RESULTS_DIR } from './run';

const OUT = `${RESULTS_DIR}/root-census.jsonl`;
const chTime = (d: Date) => d.toISOString().replace('T', ' ').replace(/Z$/, '');

/** One row per (trace, root spanId) in the window: how many copies, and whether they differ. */
const SPANS = `
  spans AS (
    SELECT
      cityHash64(organizationId, projectId, traceId) AS t,
      any(cityHash64(organizationId)) AS org,
      spanId,
      min(dedupeKey) AS key,
      count() AS copies,
      uniqExact(startedAt) AS starts,
      uniqExact(endedAt) AS ends,
      uniqExact(isNotNull(error)) AS errs,
      dateDiff('second', min(endedAt), max(endedAt)) AS endGapS,
      min(startedAt) AS s,
      max(endedAt) AS e,
      any(spanType) AS spanType,
      any(entityType) AS entityType,
      any(parentEntityType) AS parentEntityType,
      any(runId) AS runId
    FROM mastra_trace_roots
    WHERE endedAt >= {from:DateTime64(3, 'UTC')} AND endedAt < {to:DateTime64(3, 'UTC')}
    GROUP BY t, spanId
  )`;

/** One row per trace: how many distinct root spans, and their shape. */
const TRACES = `
  traces AS (
    SELECT
      t,
      any(org) AS org,
      count() AS n,
      max(copies) > 1 AS hasCopies,
      max(starts) > 1 OR max(ends) > 1 OR max(errs) > 1 AS copiesDiffer,
      uniqExact(runId) AS runs,
      max(s) < min(e) AS allOverlap,
      argMin(spanId, key) != argMin(spanId, s) AS currentNotEarliest,
      uniqExact(entityType) AS entityTypes
    FROM spans
    GROUP BY t
  )`;

const CHECKS: Array<{ id: string; question: string; sql: string }> = [
  {
    id: 'overview',
    question: 'How many traces have more than one root span, or more than one copy of one?',
    sql: `WITH ${SPANS}, ${TRACES}
      SELECT
        count() AS traces,
        uniqExact(org) AS orgs,
        countIf(n > 1) AS multiRootTraces,
        uniqExactIf(org, n > 1) AS multiRootOrgs,
        max(n) AS maxRoots,
        quantileExactIf(0.5)(n, n > 1) AS p50RootsWhenMulti,
        quantileExactIf(0.99)(n, n > 1) AS p99RootsWhenMulti,
        countIf(hasCopies) AS tracesWithCopies,
        countIf(copiesDiffer) AS tracesWithDifferingCopies,
        uniqExactIf(org, copiesDiffer) AS differingCopyOrgs
      FROM traces`,
  },
  {
    id: 'multi-root-shape',
    question:
      'In traces with several root spans: one run or several, overlapping or sequential, which one is "current"?',
    sql: `WITH ${SPANS}, ${TRACES}
      SELECT
        count() AS multiRootTraces,
        countIf(runs = n) AS eachRootItsOwnRun,
        countIf(runs = 1) AS allRootsOneRun,
        countIf(allOverlap) AS allRootsOverlapInTime,
        countIf(NOT allOverlap) AS rootsSequentialOrPartly,
        countIf(currentNotEarliest) AS currentRootIsNotTheEarliest,
        countIf(entityTypes > 1) AS mixedEntityTypes
      FROM traces
      WHERE n > 1`,
  },
  {
    id: 'multi-root-types',
    question: 'What kinds of spans are the roots of multi-root traces (vs all roots)?',
    sql: `WITH ${SPANS}, ${TRACES}
      SELECT
        spanType,
        ifNull(entityType, '(null)') AS entityType,
        isNotNull(parentEntityType) AS hasParentEntity,
        count() AS rootSpans,
        countIf(t IN (SELECT t FROM traces WHERE n > 1)) AS rootSpansInMultiRootTraces
      FROM spans
      GROUP BY spanType, entityType, hasParentEntity
      ORDER BY rootSpansInMultiRootTraces DESC, rootSpans DESC
      LIMIT 40`,
  },
  {
    id: 'multi-root-combos',
    question: 'How do root types combine in one trace, and which type is the current (lowest-key) root?',
    sql: `WITH ${SPANS}
      SELECT rootTypes, currentRootType, earliestRootType, oneRun,
             count() AS traces, uniqExact(org) AS orgs, quantileExact(0.5)(roots) AS p50Roots
      FROM (
        SELECT
          any(org) AS org,
          arrayStringConcat(arraySort(groupUniqArray(spanType)), '+') AS rootTypes,
          argMin(spanType, key) AS currentRootType,
          argMin(spanType, s) AS earliestRootType,
          uniqExact(runId) = 1 AS oneRun,
          count() AS roots
        FROM spans
        GROUP BY t
        HAVING roots > 1
      )
      GROUP BY rootTypes, currentRootType, earliestRootType, oneRun
      ORDER BY traces DESC
      LIMIT 20`,
  },
  {
    id: 'multi-root-resumes',
    question: 'Are the extra roots of multi-root traces marked as resumed runs?',
    sql: `
      SELECT
        spanType,
        JSONExtractBool(ifNull(metadataRaw, '{}'), 'resumed') AS resumed,
        endsWith(name, '(resumed)') AS resumedName,
        isNotNull(parentEntityType) AS hasParentEntity,
        count() AS rootSpans,
        uniqExact(cityHash64(organizationId, projectId, traceId)) AS traces,
        uniqExact(cityHash64(organizationId)) AS orgs
      FROM mastra_trace_roots
      WHERE endedAt >= {from:DateTime64(3, 'UTC')} AND endedAt < {to:DateTime64(3, 'UTC')}
        AND cityHash64(organizationId, projectId, traceId) IN (
          SELECT cityHash64(organizationId, projectId, traceId) FROM mastra_trace_roots
          WHERE endedAt >= {from:DateTime64(3, 'UTC')} AND endedAt < {to:DateTime64(3, 'UTC')}
          GROUP BY organizationId, projectId, traceId
          HAVING uniqExact(spanId) > 1
        )
      GROUP BY spanType, resumed, resumedName, hasParentEntity
      ORDER BY rootSpans DESC
      LIMIT 40`,
  },
  {
    id: 'copy-differences',
    question: 'When one root span is stored more than once, what differs between the copies?',
    sql: `WITH ${SPANS}
      SELECT
        countIf(copies > 1) AS spansWithCopies,
        max(copies) AS maxCopies,
        countIf(copies > 1 AND starts > 1) AS startDiffers,
        countIf(copies > 1 AND ends > 1) AS endDiffers,
        countIf(copies > 1 AND errs > 1) AS errorPresenceDiffers,
        quantileExactIf(0.5)(endGapS, ends > 1) AS p50EndGapS,
        quantileExactIf(0.99)(endGapS, ends > 1) AS p99EndGapS,
        maxIf(endGapS, ends > 1) AS maxEndGapS
      FROM spans`,
  },
  {
    id: 'copy-difference-types',
    question: 'Which kinds of root spans have copies with a different end time?',
    sql: `WITH ${SPANS}
      SELECT spanType, ifNull(entityType, '(null)') AS entityType, count() AS spans, uniqExact(org) AS orgs,
             quantileExact(0.5)(endGapS) AS p50EndGapS
      FROM spans
      WHERE copies > 1 AND ends > 1
      GROUP BY spanType, entityType
      ORDER BY spans DESC
      LIMIT 20`,
  },
  {
    id: 'copy-content',
    question: 'Do copies with a different end time also carry a different input, output or metadata?',
    sql: `WITH ${SPANS}
      SELECT
        count() AS spans,
        countIf(outs > 1) AS outputDiffers,
        countIf(ins > 1) AS inputDiffers,
        countIf(metas > 1) AS metadataDiffers,
        countIf(outs > 1 AND emptyOut = 1) AS someCopyHasNoOutput
      FROM (
        SELECT
          cityHash64(organizationId, projectId, traceId) AS t, spanId,
          uniqExact(cityHash64(output)) AS outs,
          uniqExact(cityHash64(input)) AS ins,
          uniqExact(cityHash64(metadataRaw)) AS metas,
          max(output IS NULL OR output = '') AS emptyOut
        FROM mastra_trace_roots
        WHERE endedAt >= {from:DateTime64(3, 'UTC')} AND endedAt < {to:DateTime64(3, 'UTC')}
          AND (cityHash64(organizationId, projectId, traceId), spanId) IN (SELECT t, spanId FROM spans WHERE ends > 1)
        GROUP BY t, spanId
      )`,
  },
];

async function main() {
  installOutputRedaction();
  const { values } = parseArgs({
    options: {
      days: { type: 'string', default: '7' },
      to: { type: 'string' },
      only: { type: 'string' },
    },
  });
  const to = values.to ? new Date(values.to) : new Date();
  const from = new Date(to.getTime() - Number(values.days) * 86_400_000);
  const params = { from: chTime(from), to: chTime(to) };
  const database = (JSON.parse(readFileSync(files(RESULTS_DIR).preflight, 'utf8')) as { database: string }).database;
  const client = new BenchClient({ ...loadCredentials(), database });
  const only = values.only ? new Set(values.only.split(',')) : undefined;
  mkdirSync(RESULTS_DIR, { recursive: true });
  try {
    for (const check of CHECKS.filter(c => !only || only.has(c.id))) {
      await new Promise(r => setTimeout(r, 3000));
      const outcome = await client.rows<Record<string, unknown>>(check.sql, params, {
        tier: TIERS[1],
        logComment: `aqa-bench:qx23:${check.id}`,
        settings: { max_execution_time: 120, max_result_rows: '50' },
      });
      const record = {
        exp: 'QX23',
        id: check.id,
        days: Number(values.days),
        to: to.toISOString(),
        ok: outcome.ok,
        errorCode: outcome.errorCode,
        wallMs: Math.round(outcome.wallMs),
        memoryBytes: Number(outcome.summary?.memory_usage ?? 0),
        readBytes: Number(outcome.summary?.read_bytes ?? 0),
        rows: outcome.rows ?? [],
      };
      appendFileSync(OUT, `${JSON.stringify(record)}\n`);
      process.stdout.write(
        `${check.id}: ${outcome.ok ? JSON.stringify(record.rows) : `failed ${outcome.errorCode} ${outcome.errorMessage ?? ''}`}\n`,
      );
    }
  } finally {
    await client.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
