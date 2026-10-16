/**
 * Memory track 3, S5 (lab only): what writer retries do to write-time usage rollups, and whether a narrow
 * per-metric usage table read with FINAL in key order stays exact and small.
 *
 *   tsx bench/aggregate-traces/retries.ts [--project <hash>] [--dup-percent 1]
 *
 * Needs `lab.ts pull` and `lab.ts derive`. Builds three tables from the lab's token rows:
 * - `mastra_trace_usage_h`: per-trace AggregatingMergeTree rollup keyed by cityHash64(traceId) (what an MV would fill)
 * - `mastra_usage_rows`: one row per metricId, ReplacingMergeTree ORDER BY (org, project, traceHash, metricId)
 * then re-inserts a share of one project's token rows into both (a retried write) and compares E4/T1/T3 results and
 * memory against the same queries before the duplicates.
 */
import { parseArgs } from 'node:util';

import type { ClickHouseSettings } from '@clickhouse/client';

import { CASES, compileCase, timeRangeFor } from './cases';
import { BenchClient, TIERS } from './client';
import { installOutputRedaction } from './env';
import { LAB, labAdmin, labCredentials, loadLabSelection, sqlString } from './lab';
import { USAGE_COST_NAMES, USAGE_ROLLUP_COLUMNS } from './scope';

const db = LAB.database;
const q = sqlString;
const COST_IN = `name IN (${USAGE_COST_NAMES.map(q).join(', ')})`;
const USAGE_IN = `name IN (${USAGE_ROLLUP_COLUMNS.map(c => q(c.name)).join(', ')})`;
const ROW_FIELDS = `organizationId, projectId, cityHash64(traceId) AS traceHash, metricId, timestamp,
  ${USAGE_ROLLUP_COLUMNS.map(c => `if(name = ${q(c.name)}, value, 0) AS ${c.column}`).join(', ')},
  if(priced, assumeNotNull(estimatedCost), 0) AS cost, toUInt8(priced) AS priced, toUInt8(failed) AS failed,
  if(priced, costUnit, NULL) AS unit`;
const SOURCE = `(SELECT *, ${COST_IN} AND ifNull(JSONHas(costMetadata, 'error') AND JSONType(costMetadata, 'error') != 'Null', 0) AS hasErr,
    ${COST_IN} AND isNotNull(estimatedCost) AND isNotNull(costUnit) AND NOT hasErr AS priced,
    ${COST_IN} AND (hasErr OR (isNotNull(estimatedCost) AND isNull(costUnit))) AS failed
  FROM ${db}.mastra_metric_events WHERE isNotNull(traceId) AND ${USAGE_IN})`;

const DDL = [
  `DROP TABLE IF EXISTS ${db}.mastra_trace_usage_h`,
  `CREATE TABLE ${db}.mastra_trace_usage_h (organizationId String, projectId String, traceHash UInt64,
    firstAt SimpleAggregateFunction(min, DateTime64(3, 'UTC')),
    ${USAGE_ROLLUP_COLUMNS.map(c => `${c.column} SimpleAggregateFunction(sum, Float64)`).join(', ')},
    cost SimpleAggregateFunction(sum, Float64), pricedRows SimpleAggregateFunction(sum, UInt64),
    failedRows SimpleAggregateFunction(sum, UInt64),
    unitMin SimpleAggregateFunction(min, LowCardinality(Nullable(String))),
    unitMax SimpleAggregateFunction(max, LowCardinality(Nullable(String))))
    ENGINE = AggregatingMergeTree ORDER BY (organizationId, projectId, traceHash)`,
  `DROP TABLE IF EXISTS ${db}.mastra_usage_rows`,
  `CREATE TABLE ${db}.mastra_usage_rows (organizationId String, projectId String, traceHash UInt64, metricId String,
    timestamp DateTime64(3, 'UTC'), ${USAGE_ROLLUP_COLUMNS.map(c => `${c.column} Float64`).join(', ')},
    cost Float64, priced UInt8, failed UInt8, unit LowCardinality(Nullable(String)))
    ENGINE = ReplacingMergeTree ORDER BY (organizationId, projectId, traceHash, metricId)`,
];

const rollupInsert = (where: string) => `INSERT INTO ${db}.mastra_trace_usage_h
  SELECT organizationId, projectId, traceHash, min(timestamp),
    ${USAGE_ROLLUP_COLUMNS.map(c => `sum(${c.column})`).join(', ')}, sum(cost), sum(priced), sum(failed),
    min(unit), max(unit)
  FROM (SELECT ${ROW_FIELDS} FROM ${SOURCE} WHERE ${where})
  GROUP BY organizationId, projectId, traceHash`;
const rowsInsert = (where: string) =>
  `INSERT INTO ${db}.mastra_usage_rows SELECT ${ROW_FIELDS} FROM ${SOURCE} WHERE ${where}`;

const sub = (s: string, a: string | RegExp, b: string) => {
  const out = s.replace(a, b);
  if (out === s) throw new Error(`rewrite anchor missing: ${String(a)}`);
  return out;
};

/** `arch` reads the string-keyed rollup; point it at the hashed rollup or the per-metric table instead. */
function usageFrom(query: string, source: 'rollup' | 'rows'): string {
  let o = sub(query, 'usage AS (\n    SELECT traceId,', 'usage AS (\n    SELECT traceHash,');
  const from =
    source === 'rollup'
      ? `${db}.mastra_trace_usage_h`
      : `(SELECT organizationId, projectId, traceHash, timestamp AS firstAt,
          ${USAGE_ROLLUP_COLUMNS.map(c => c.column).join(', ')}, cost, priced AS pricedRows, failed AS failedRows,
          unit AS unitMin, unit AS unitMax
        FROM ${db}.mastra_usage_rows FINAL)`;
  o = sub(
    o,
    'FROM mastra_trace_usage\n    WHERE traceId IN (SELECT traceId FROM candidates)',
    `FROM ${from}\n    WHERE traceHash IN (SELECT cityHash64(traceId) FROM candidates)`,
  );
  o = sub(
    o,
    /(AND firstAt >= \{trace_query_\d+:DateTime64\(3, 'UTC'\)\}\n\s+)GROUP BY traceId/,
    '$1GROUP BY traceHash',
  );
  return sub(
    o,
    'LEFT JOIN usage u ON u.traceId = r.traceId',
    'LEFT JOIN usage u ON u.traceHash = cityHash64(r.traceId)',
  );
}

async function main(): Promise<void> {
  installOutputRedaction();
  const { values } = parseArgs({
    options: { project: { type: 'string', default: 'a62771ca' }, 'dup-percent': { type: 'string', default: '1' } },
  });
  const selection = loadLabSelection();
  const project = selection.projects.find(p => p.hash === values.project);
  if (!project) throw new Error(`No lab project ${values.project}`);
  const dupPercent = Number(values['dup-percent']);
  const admin = labAdmin();
  const client = new BenchClient(labCredentials());
  const range = timeRangeFor({ id: '30d', ms: 30 * 86_400_000 }, new Date(selection.anchorTo));

  const measure = async (label: string) => {
    const out: Record<string, string> = {};
    for (const id of ['E4', 'T1', 'T3']) {
      const c = compileCase(
        CASES.find(d => d.id === id)!,
        'arch',
        project.literals,
        range,
        project,
      );
      for (const source of ['rollup', 'rows'] as const) {
        const sql = usageFrom(c.query, source);
        const settings: ClickHouseSettings = source === 'rows' ? { optimize_aggregation_in_order: 1 } : {};
        let mem = 0;
        let ms = 0;
        for (let r = 0; r < 3; r++) {
          const o = await client.discard(sql, c.query_params, {
            tier: TIERS[1],
            logComment: 'aqa-bench:lab-retries',
            settings,
          });
          if (!o.ok) throw new Error(`${id} ${source} failed (${o.errorCode})`);
          mem = Number(o.summary?.memory_usage ?? 0);
          ms = o.wallMs;
        }
        const rows = await client.rows<Record<string, unknown>>(sql, c.query_params, {
          tier: TIERS[1],
          logComment: 'aqa-bench:lab-retries',
          settings,
        });
        const sig = JSON.stringify(
          (rows.rows ?? [])
            .map(r => Object.values(r).map(v => (typeof v === 'number' ? Number(v.toPrecision(10)) : v)))
            .sort(),
        );
        out[`${id} ${source}`] = sig;
        process.stdout.write(
          `${label.padEnd(16)} ${id} ${source.padEnd(6)} ${(mem / 2 ** 20).toFixed(0)} MiB ${Math.round(ms)} ms\n`,
        );
      }
    }
    return out;
  };

  try {
    for (const sql of DDL) await admin.command({ query: sql });
    await admin.command({ query: rollupInsert('1'), clickhouse_settings: { max_threads: 2 } });
    await admin.command({ query: rowsInsert('1'), clickhouse_settings: { max_threads: 2 } });
    for (const t of ['mastra_trace_usage_h', 'mastra_usage_rows']) {
      await admin.command({ query: `OPTIMIZE TABLE ${db}.${t} FINAL` });
    }
    const before = await measure('clean');

    // A retried batch: the same rows written again, as a separate insert (an MV fires again for it).
    const dup = `organizationId = ${q(project.organizationId)} AND cityHash64(metricId) % 100 < ${dupPercent}`;
    await admin.command({ query: rollupInsert(dup) });
    await admin.command({ query: rowsInsert(dup) });
    const after = await measure(`${dupPercent}% retried`);

    for (const key of Object.keys(before)) {
      process.stdout.write(`${key}: ${before[key] === after[key] ? 'unchanged by retries' : 'CHANGED by retries'}\n`);
    }
    const sizes = await (
      await admin.query({
        query: `SELECT table, sum(rows) AS rows, sum(data_compressed_bytes) AS bytes FROM system.parts
          WHERE database = '${db}' AND active AND table IN ('mastra_trace_usage_h', 'mastra_usage_rows', 'mastra_metric_events')
          GROUP BY table`,
        format: 'JSONEachRow',
      })
    ).json<{ table: string; rows: string; bytes: string }>();
    for (const s of sizes) {
      process.stdout.write(
        `${s.table}: ${Number(s.rows).toLocaleString()} rows, ${(Number(s.bytes) / 2 ** 20).toFixed(1)} MiB\n`,
      );
    }
  } finally {
    await client.close();
    await admin.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
