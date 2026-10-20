/**
 * X49: making the org Metrics page fit at 30 d on the largest org, against the read-only replica.
 * Reuses X48's harness (`mobs-metrics-page.ts`): same client guard, settings, card shapes and
 * mobs-query code imported from --platform.
 *
 *   facts   `usageId` adoption per day (token rows in `mastra_metric_events`, rows in
 *           `mastra_model_usage`), all orgs vs the largest org, and the replica count.
 *
 * Output: role, salted hash, window, candidate, metrics. Ids and metadata never leave the process.
 *
 *   stmt    one card's statement (default O6) split into its parts (selection, usage table,
 *           fallback, repeated-metricId set) and rewritten (`1pass`: fallback in one grouped pass;
 *           `fb-off`: usage table only). Measure arm, cold ×1 + warm ×reps; exact rewrites are
 *           checked against the compiled statement's result.
 *
 *   c2      the org token/cost cards from `metrics` (breakdown and time series grouped by projectId
 *           and name; needs `projectId` in mobs-query's METRIC_TYPED_COLUMNS) vs the same values
 *           from `aggregateTraces()`: cost, then parity per project and per project × bucket.
 *
 *   page    the whole org page (largest org) per candidate, all cards at once through the service
 *           functions under mobs-query's read limits: base (X48), c2, c2+O6, c3; suffix -staged
 *           (token cards after the rest), -seq (token cards one at a time after the rest) or
 *           -spread (one connection per card).
 *
 *   c2check the c2m page's reshaped requests (O1/O1s without token measures, O3s+O3f as one
 *           request ranked client-side) against X48's card requests, row by row.
 *
 *   c6      read-only assessment of back-filling `mastra_model_usage` with usageId = 'm:' || metricId
 *           for token rows without one: sizes, mixed traces, metricId reuse, back-fill read cost, and
 *           the usage read with the fallback off (proxied from `mastra_metric_events`).
 *
 *   nodes   per page load in results (--label): the node each load ran on (CPU and memory limits,
 *           thread-slot soft limit), its average CPU, thread slots, queries and replication fetches
 *           over the load, and any other query on that node overlapping it (system.metric_log /
 *           query_log via clusterAllReplicas). Explains outlier loads.
 *
 *   npx tsx mobs-org-page-fit.ts facts
 *   npx tsx mobs-org-page-fit.ts stmt --shape O6 --windows 7d,30d --variants full,1pass,fb-off [--explain]
 */
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { ClickHouseClient } from '@clickhouse/client';

import { installOutputRedaction } from './env';
import {
  compileShape,
  connect,
  fetchStats,
  GiB,
  HOUR,
  MEASURE,
  measured,
  metricsCards,
  pageInterval,
  pickProjects,
  PROD,
  rangeOf,
  rows,
  shapeBody,
  sleep,
  summarizePage,
  timeRange,
  withInterval,
} from './mobs-metrics-page';
import type { Measured, Mods, PageRecord, QueryStat, Range, Scope } from './mobs-metrics-page';
import { loadSelection } from './profile';
import type { SelectedProject } from './profile';
import { RESULTS_DIR } from './run';

const OUT = {
  facts: join(RESULTS_DIR, 'mobs-org-page-fit-facts.jsonl'),
  stmt: join(RESULTS_DIR, 'mobs-org-page-fit-stmt.jsonl'),
  c2: join(RESULTS_DIR, 'mobs-org-page-fit-c2.jsonl'),
  c2parity: join(RESULTS_DIR, 'mobs-org-page-fit-c2-parity.jsonl'),
  page: join(RESULTS_DIR, 'mobs-org-page-fit-load.jsonl'),
  c2check: join(RESULTS_DIR, 'mobs-org-page-fit-c2-check.jsonl'),
  c6: join(RESULTS_DIR, 'mobs-org-page-fit-c6.jsonl'),
};
const USAGE_NAMES = [
  'mastra_model_total_input_tokens',
  'mastra_model_total_output_tokens',
  'mastra_model_output_reasoning_tokens',
  'mastra_model_input_cache_read_tokens',
];
const HAS_USAGE_ID = `(usageId IS NOT NULL AND trimBoth(usageId) != '')`;

function largest(): SelectedProject {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const found = pickProjects(selection.projects).find(([role]) => role === 'largest');
  if (!found) throw new Error('no largest project in the selection');
  return found[1];
}

// ---------------------------------------------------------------------------------------------
// facts

async function facts(platform: string, since: string) {
  const project = largest();
  const { raw } = await connect(platform, 2);
  const org = project.organizationId;
  try {
    const replicas = await rows<{ replicas: number }>(
      raw,
      `SELECT count() AS replicas FROM clusterAllReplicas('all_groups.default', system.one)`,
      {},
    );
    const events = await rows<Record<string, number | string>>(
      raw,
      `SELECT toString(toDate(timestamp)) AS day,
              count() AS rows, countIf(${HAS_USAGE_ID}) AS withId,
              countIf(organizationId = {org:String}) AS orgRows,
              countIf(organizationId = {org:String} AND ${HAS_USAGE_ID}) AS orgWithId,
              uniqExactIf(organizationId, ${HAS_USAGE_ID}) AS orgsWithId,
              uniqExact(organizationId) AS orgs
       FROM mastra_metric_events
       WHERE name IN {names:Array(String)} AND timestamp >= {since:DateTime64(3, 'UTC')}
       GROUP BY day ORDER BY day`,
      { org, names: USAGE_NAMES, since },
    );
    const usage = await rows<Record<string, number | string>>(
      raw,
      `SELECT toString(toDate(timestamp)) AS day, count() AS rows, countIf(organizationId = {org:String}) AS orgRows,
              uniqExact(organizationId) AS orgs
       FROM mastra_model_usage
       WHERE timestamp >= {since:DateTime64(3, 'UTC')}
       GROUP BY day ORDER BY day`,
      { org, since },
    );
    const byDay = new Map(usage.map(u => [u.day, u]));
    console.log(`replicas: ${replicas[0]?.replicas}`);
    console.log(
      'day         token rows  %usageId  orgs w/ id  | largest org rows  %usageId | usage-table rows (largest org)',
    );
    for (const e of events) {
      const u = byDay.get(e.day);
      const pct = (a: unknown, b: unknown) => (Number(b) ? ((100 * Number(a)) / Number(b)).toFixed(1) : '-');
      console.log(
        `${e.day}  ${String(e.rows).padStart(10)}  ${pct(e.withId, e.rows).padStart(8)}  ${`${e.orgsWithId}/${e.orgs}`.padStart(10)}  | ${String(e.orgRows).padStart(16)}  ${pct(e.orgWithId, e.orgRows).padStart(8)} | ${u?.rows ?? 0} (${u?.orgRows ?? 0})`,
      );
    }
    appendFileSync(
      OUT.facts,
      `${JSON.stringify({ at: new Date().toISOString(), hash: project.hash, replicas: replicas[0]?.replicas, events, usage })}\n`,
    );
  } finally {
    await raw.close();
  }
}

// ---------------------------------------------------------------------------------------------
// stmt: one token/cost statement, split into its parts and rewritten

interface Compiled {
  query: string;
  query_params?: Record<string, unknown>;
  sharedSnapshot?: boolean;
}

/** The compiled statement's CTE list, without its final select. */
function ctePrefix(query: string): string {
  const at = query.lastIndexOf('\nSELECT ');
  if (at < 0) throw new Error('no final select');
  return query.slice(0, at + 1);
}

/** `fallback_usage` as one grouped pass per (trace, metricId, name) instead of finding repeats first. */
function onePassFallback(query: string): string {
  const start = query.indexOf('fallback_usage AS (');
  const from = query.indexOf('    FROM (\n', start) + '    FROM (\n'.length;
  const union = query.indexOf('\n      UNION ALL\n', start);
  const repeatedFilter =
    /\n\s*AND cityHash64\(metricId\) IN \(SELECT cityHash64\(metricId\) FROM mastra_metric_events[\s\S]*?HAVING count\(\) > 1\)/;
  const rest = query.slice(union + '\n      UNION ALL\n'.length);
  if (!repeatedFilter.test(rest)) throw new Error('repeated filter not found');
  // The second UNION branch took its column names from the first; name them here.
  const named = rest
    .replace(/sumIf\(dv, n = (\d)\)/g, (_, i: string) => `sumIf(dv, n = ${i}) AS t${Number(i) - 1}`)
    .replace('sumIf(dc, dp = 1),', 'sumIf(dc, dp = 1) AS c,')
    .replace('max(dp),', 'max(dp) AS p,')
    .replace('max(df),', 'max(df) AS f,')
    .replace('minIf(dumin, dp = 1),', 'minIf(dumin, dp = 1) AS umin,')
    .replace(/maxIf\(dumax, dp = 1\)\n/, 'maxIf(dumax, dp = 1) AS umax\n');
  return query.slice(0, from) + named.replace(repeatedFilter, '');
}

/**
 * `fallback_usage` with one read of the selected rows plus one read for the repeated-metricId set
 * (the compiled statement reads each twice). Rows of a repeated metricId keep their own group and
 * are collapsed with max(); every other row of a trace and name shares group 0 and is summed.
 */
function twoPassFallback(query: string): string {
  const start = query.indexOf('fallback_usage AS (');
  const end = query.indexOf(',\nusage AS (', start);
  const cte = query.slice(start, end);
  const scan =
    /(SELECT cityHash64\(organizationId, projectId, traceId\) AS traceHash, indexOf[\s\S]*?)\n\s*AND cityHash64\(metricId\) NOT IN/.exec(
      cte,
    )?.[1];
  const repeated = /\(SELECT cityHash64\(metricId\) FROM mastra_metric_events[\s\S]*?HAVING count\(\) > 1\)/.exec(
    cte,
  )?.[0];
  const priced = /sumIf\(assumeNotNull\(estimatedCost\), ([\s\S]*?)\) AS c,/.exec(cte)?.[1];
  const failed = /toUInt8\(max\(([\s\S]*?)\)\) AS f,/.exec(cte)?.[1];
  if (!scan || !repeated || !priced || !failed) throw new Error('fallback_usage shape not recognized');
  const withKey = scan.replace(
    ' AS n, value, estimatedCost, costUnit, costMetadata',
    ` AS n, value, estimatedCost, costUnit, costMetadata, if(cityHash64(metricId) IN ${repeated}, cityHash64(metricId), 0) AS mk`,
  );
  if (withKey === scan) throw new Error('scan columns not recognized');
  const rewritten = `fallback_usage AS (
    SELECT traceHash,
      sumIf(v, n = 1) AS t0,
      sumIf(v, n = 2) AS t1,
      sumIf(v, n = 3) AS t2,
      sumIf(v, n = 4) AS t3,
      sum(c) AS cost,
      max(p) AS priced,
      max(f) AS pricingFailure,
      minIf(umin, p = 1) AS unitMin,
      maxIf(umax, p = 1) AS unitMax
    FROM (
      SELECT traceHash, n, mk,
        if(mk = 0, sum(value), max(value)) AS v,
        if(mk = 0, sumIf(assumeNotNull(estimatedCost), ${priced}), maxIf(assumeNotNull(estimatedCost), ${priced})) AS c,
        toUInt8(max(${priced})) AS p,
        toUInt8(max(${failed})) AS f,
        minIf(assumeNotNull(costUnit), ${priced}) AS umin,
        maxIf(assumeNotNull(costUnit), ${priced}) AS umax
      FROM (
        ${withKey}
      )
      GROUP BY traceHash, n, mk
    )
    GROUP BY traceHash
  )`;
  return query.slice(0, start) + rewritten + query.slice(end);
}

function variantsOf(mods: Mods, shape: string, scope: Scope, to: Date, window: string) {
  const interval = withInterval.has(shape) ? pageInterval(window) : undefined;
  const base = compileShape(mods, shape, scope, to, window, interval).compiled as Compiled;
  const tableOnly = mods.sql.compileClickHouseTraceAggregate(
    compileShape(mods, shape, scope, to, window, interval).plan,
    { fallback: false, bound: 'window' },
  ) as Compiled;
  const prefix = ctePrefix(base.query);
  const repeated = /\(SELECT cityHash64\(metricId\) FROM mastra_metric_events[\s\S]*?HAVING count\(\) > 1\)/.exec(
    base.query,
  )?.[0];
  const v = (query: string, exact: boolean) => ({ query, params: base.query_params ?? {}, exact });
  return {
    full: v(base.query, true),
    '1pass': v(onePassFallback(base.query), true),
    '2pass': v(twoPassFallback(base.query), true),
    'part:fallback-2pass': v(
      `${ctePrefix(twoPassFallback(base.query))}SELECT count(), sum(t0) FROM fallback_usage`,
      false,
    ),
    'fb-off': { query: tableOnly.query, params: tableOnly.query_params ?? {}, exact: false },
    'part:selection': v(`${prefix}SELECT count() FROM candidates`, false),
    'part:table': v(`${prefix}SELECT count(), sum(t0) FROM table_usage`, false),
    'part:fallback': v(`${prefix}SELECT count(), sum(t0) FROM fallback_usage`, false),
    'part:fallback-1pass': v(
      `${ctePrefix(onePassFallback(base.query))}SELECT count(), sum(t0) FROM fallback_usage`,
      false,
    ),
    'part:repeated': v(`SELECT count() FROM ${repeated}`, false),
  } as Record<string, { query: string; params: Record<string, unknown>; exact: boolean }>;
}

/** Order-independent digest of a result with floats rounded to 9 significant digits. */
function digest(result: unknown): string {
  const norm = (x: unknown): unknown =>
    typeof x === 'number'
      ? Number(x.toPrecision(9))
      : Array.isArray(x)
        ? x.map(norm)
        : x && typeof x === 'object'
          ? Object.fromEntries(Object.entries(x).map(([k, val]) => [k, norm(val)]))
          : x;
  const lines = (result as unknown[]).map(r => JSON.stringify(norm(r))).sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 12);
}

async function stmt(options: {
  platform: string;
  label: string;
  shape: string;
  windows: string[];
  variants: string[];
  reps: number;
  explain: boolean;
}) {
  const project = largest();
  const scope: Scope = { organizationId: project.organizationId };
  const { raw, client, mods } = await connect(options.platform, 2);
  const to = new Date(Math.floor(Date.now() / HOUR) * HOUR);
  try {
    for (const window of options.windows) {
      const all = variantsOf(mods, options.shape, scope, to, window);
      if (options.explain) {
        const plan = await rows<{ explain: string }>(raw, `EXPLAIN indexes = 1 ${all.full!.query}`, all.full!.params);
        const lines = plan.map(p => p.explain);
        // Index analysis per ReadFromMergeTree: table, then key/partition lines with parts/granules.
        const keep = lines.filter(l =>
          /ReadFromMergeTree|Parts:|Granules:|Keys:|Condition:|Name:|PrimaryKey|MinMax|Partition/.test(l),
        );
        console.log(keep.map(l => l.replace(/\{trace_query_\d+:[^}]+\}/g, '?')).join('\n'));
      }
      let reference: string | undefined;
      let referenceRows: Array<Record<string, unknown>> | undefined;
      for (const name of options.variants) {
        const variant = all[name];
        if (!variant) throw new Error(`unknown variant ${name}`);
        const run = () =>
          client
            .query({
              query: variant.query,
              query_params: variant.params,
              format: 'JSONEachRow',
              clickhouse_settings: mods.obs.CLICKHOUSE_SETTINGS,
            })
            .then(res => res.json());
        const calls: Array<{ phase: 'cold' | 'warm'; rep: number; r: Measured<unknown> }> = [];
        calls.push({ phase: 'cold', rep: 0, r: await measured(true, MEASURE, run) });
        await measured(false, MEASURE, run);
        for (let rep = 1; rep <= options.reps; rep++)
          calls.push({ phase: 'warm', rep, r: await measured(false, MEASURE, run) });
        const stats = await fetchStats(
          raw,
          calls.flatMap(c => c.r.queryIds),
        );
        const warm = calls.filter(c => c.phase === 'warm');
        const stat = (c: (typeof calls)[number]) => stats.get(c.r.queryIds[0]!);
        const med = (f: (s: QueryStat) => number) => median(warm.map(c => (stat(c) ? f(stat(c)!) : Number.NaN)));
        const result = warm.find(c => c.r.ok)?.r.value;
        const d = result === undefined ? undefined : digest(result);
        if (name === 'full') {
          reference = d;
          referenceRows = result as Array<Record<string, unknown>>;
        }
        const parity = !variant.exact ? '-' : d === reference ? 'same' : 'DIFFERENT';
        if ((parity === 'DIFFERENT' || name === 'fb-off') && referenceRows && result)
          explainDiff(referenceRows, result as Array<Record<string, unknown>>);
        const record = {
          label: options.label,
          hash: project.hash,
          shape: options.shape,
          window,
          variant: name,
          parity,
          warm: {
            memMiB: med(s => s.memMiB),
            ms: med(s => s.durationMs),
            readRows: med(s => s.readRows),
            readMiB: med(s => s.readMiB),
          },
          cold: { ok: calls[0]!.r.ok, errorCode: calls[0]!.r.errorCode, ms: stat(calls[0]!)?.durationMs },
          failed: warm.filter(c => !c.r.ok).map(c => c.r.errorCode),
        };
        appendFileSync(OUT.stmt, `${JSON.stringify(record)}\n`);
        console.log(
          `${options.shape} ${window} ${name.padEnd(20)} warm ${record.warm.memMiB} MiB ${record.warm.ms} ms read ${record.warm.readRows} rows ${record.warm.readMiB} MiB | cold ${record.cold.ok ? `ok ${record.cold.ms} ms` : record.cold.errorCode} | parity ${parity}${record.failed.length ? ` | warm failed ${record.failed.join(',')}` : ''}`,
        );
      }
    }
  } finally {
    await raw.close();
  }
}

// ---------------------------------------------------------------------------------------------
// c2: org token/cost cards from `metrics` (needs `projectId` in METRIC_TYPED_COLUMNS)

const TOKEN_NAMES = {
  in: 'mastra_model_total_input_tokens',
  out: 'mastra_model_total_output_tokens',
  cache: 'mastra_model_input_cache_read_tokens',
} as const;
type Tok = { in: number; out: number; cache: number; cost: number };
const zero = (): Tok => ({ in: 0, out: 0, cache: 0, cost: 0 });

/** Today's metrics cards an org page would use for O1/O1s/O2 tokens and cost. */
function metricsTokenCalls(mods: Mods, client: ClickHouseClient, scope: Scope, r: Range, window: string) {
  const args = {
    name: Object.values(TOKEN_NAMES),
    groupBy: ['projectId', 'name'],
    aggregation: 'sum',
    filters: { timestamp: { start: r.from, end: r.to } },
  };
  return {
    breakdown: () => mods.metrics.getMetricBreakdown(client, args, scope) as Promise<BreakdownResponse>,
    series: () =>
      mods.metrics.getMetricTimeSeries(
        client,
        { ...args, interval: pageInterval(window) },
        scope,
      ) as Promise<SeriesResponse>,
  };
}
type BreakdownResponse = {
  groups: Array<{ dimensions: Record<string, string | null>; value: number; estimatedCost: number | null }>;
};
type SeriesResponse = {
  series: Array<{
    name: string;
    points: Array<{ timestamp: Date | string; value: number; estimatedCost: number | null }>;
  }>;
};
type AggResponse = {
  rows: Array<{
    dimensions?: Record<string, string | null>;
    measures: Record<string, number | null>;
    bucket?: string;
    cost?: { coverage: number | null; unit: string | null };
  }>;
  truncated: boolean;
};

const nameKey = (name: string | null | undefined) =>
  (Object.entries(TOKEN_NAMES).find(([, v]) => v === name)?.[0] as keyof typeof TOKEN_NAMES | undefined) ?? undefined;

function addTok(
  map: Map<string, Tok>,
  key: string,
  name: string | null | undefined,
  value: number,
  cost: number | null,
) {
  const k = nameKey(name);
  if (!k) return;
  const t = map.get(key) ?? zero();
  t[k] += value;
  // Cost lives on the total input/output rows; cache-read rows' cost is already inside the input total.
  if (k !== 'cache') t.cost += cost ?? 0;
  map.set(key, t);
}

function aggTok(rows: AggResponse['rows'], keyOf: (row: AggResponse['rows'][number]) => string) {
  const map = new Map<string, Tok>();
  for (const row of rows)
    map.set(keyOf(row), {
      in: row.measures['tokens.input.sum'] ?? 0,
      out: row.measures['tokens.output.sum'] ?? 0,
      cache: row.measures['tokens.cached.sum'] ?? 0,
      cost: row.measures['cost.sum'] ?? 0,
    });
  return map;
}

/** Per measure: total relative difference, worst per-key relative difference, and share of mass in other keys. */
function compareTok(a: Map<string, Tok>, b: Map<string, Tok>) {
  const out: Record<string, { a: number; b: number; totalRel: number; worstKeyRel: number; moved: number }> = {};
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const m of ['in', 'out', 'cache', 'cost'] as const) {
    let ta = 0;
    let tb = 0;
    let absDiff = 0;
    let worst = 0;
    for (const k of keys) {
      const x = a.get(k)?.[m] ?? 0;
      const y = b.get(k)?.[m] ?? 0;
      ta += x;
      tb += y;
      absDiff += Math.abs(x - y);
      if (Math.max(x, y) > 0) worst = Math.max(worst, Math.abs(x - y) / Math.max(x, y));
    }
    const rel = (x: number) => Math.round(x * 1e5) / 1e3; // percent, 3 decimals
    out[m] = {
      a: ta,
      b: tb,
      totalRel: rel(ta ? (tb - ta) / ta : 0),
      worstKeyRel: rel(worst),
      // Mass that sits under a different key once the net total difference is set aside.
      moved: rel(ta ? (absDiff - Math.abs(tb - ta)) / 2 / ta : 0),
    };
  }
  return out;
}

/** Cost from `mastra_metric_events` per project, without rows whose pricing failed (aggregateTraces' rule). */
const CLEAN_COST_SQL = `
SELECT projectId AS p,
       sumIf(estimatedCost, isNotNull(estimatedCost) AND isNotNull(costUnit)
             AND NOT ifNull(JSONHas(costMetadata, 'error') AND JSONType(costMetadata, 'error') != 'Null', 0)) AS clean,
       sumIf(estimatedCost, isNotNull(estimatedCost)) AS any
FROM mastra_metric_events
WHERE organizationId = {org:String} AND name IN {names:Array(String)}
  AND timestamp >= {from:DateTime64(3, 'UTC')} AND timestamp <= {to:DateTime64(3, 'UTC')}
GROUP BY p`;

async function c2(options: { platform: string; label: string; windows: string[]; reps: number }) {
  const project = largest();
  const scope: Scope = { organizationId: project.organizationId };
  const { raw, client, mods } = await connect(options.platform, 4);
  // An hour behind now, so late rows barely move either side between the two reads.
  const to = new Date(Math.floor(Date.now() / HOUR) * HOUR - HOUR);
  try {
    for (const window of options.windows) {
      const r = rangeOf(to, window);
      const calls = metricsTokenCalls(mods, client, scope, r, window);
      const aggBody = (interval?: string) => ({
        timeRange: timeRange(r),
        groupBy: ['projectId'],
        measures: ['tokens.input.sum', 'tokens.output.sum', 'tokens.cached.sum', 'cost.sum'],
        ...(interval
          ? { interval, limit: Math.min(50, Math.floor(10_000 / bucketCount(r, interval))) }
          : { limit: 50 }),
      });
      const aggTotals = () =>
        mods.run.aggregateTraces(
          client,
          mods.plan.planPlatformTraceAggregate(aggBody(), scope, []),
        ) as Promise<AggResponse>;
      const aggSeries = () =>
        mods.run.aggregateTraces(
          client,
          mods.plan.planPlatformTraceAggregate(aggBody(pageInterval(window)), scope, []),
        ) as Promise<AggResponse>;

      const values: Record<string, unknown> = {};
      const named: Record<string, () => Promise<unknown>> = {
        'm:proj-breakdown': calls.breakdown,
        'm:proj-series': calls.series,
        'agg:proj-totals': aggTotals,
        'agg:proj-series': aggSeries,
      };
      for (const [name, fn] of Object.entries(named)) {
        const runs: Array<Measured<unknown>> = [await measured(true, MEASURE, fn)];
        await measured(false, MEASURE, fn);
        for (let rep = 1; rep <= options.reps; rep++) runs.push(await measured(false, MEASURE, fn));
        const stats = await fetchStats(
          raw,
          runs.flatMap(x => x.queryIds),
        );
        const sum = (x: Measured<unknown>, f: (s: QueryStat) => number) =>
          x.queryIds.reduce((acc, id) => acc + (stats.get(id) ? f(stats.get(id)!) : 0), 0);
        const peak = (x: Measured<unknown>) => Math.max(0, ...x.queryIds.map(id => stats.get(id)?.memMiB ?? 0));
        const warm = runs.slice(1);
        values[name] = warm.find(x => x.ok)?.value;
        const record = {
          label: options.label,
          hash: project.hash,
          window,
          call: name,
          statements: runs[1]?.queryIds.length,
          warm: {
            memMiB: median(warm.map(peak)),
            ms: median(warm.map(x => Math.round(x.wallMs))),
            readRows: median(warm.map(x => sum(x, s => s.readRows))),
            readMiB: median(warm.map(x => Math.round(sum(x, s => s.readMiB)))),
          },
          cold: { ok: runs[0]!.ok, errorCode: runs[0]!.errorCode, ms: Math.round(runs[0]!.wallMs) },
          failed: warm.filter(x => !x.ok).map(x => x.errorCode),
        };
        appendFileSync(OUT.c2, `${JSON.stringify(record)}\n`);
        console.log(
          `c2 ${window} ${name.padEnd(17)} warm ${record.warm.memMiB} MiB ${record.warm.ms} ms read ${record.warm.readRows} rows ${record.warm.readMiB} MiB | cold ${record.cold.ok ? `ok ${record.cold.ms} ms` : record.cold.errorCode}${record.failed.length ? ` | warm failed ${record.failed.join(',')}` : ''}`,
        );
      }

      // Parity, per project (totals) and per project × bucket (series).
      const mTotals = new Map<string, Tok>();
      for (const g of (values['m:proj-breakdown'] as BreakdownResponse).groups)
        addTok(mTotals, g.dimensions.projectId ?? '', g.dimensions.name, g.value, g.estimatedCost);
      const mSeries = new Map<string, Tok>();
      for (const s of (values['m:proj-series'] as SeriesResponse).series) {
        const [p, name] = s.name.split('|');
        for (const pt of s.points)
          addTok(mSeries, `${p}|${new Date(pt.timestamp).toISOString()}`, name, pt.value, pt.estimatedCost);
      }
      const aT = values['agg:proj-totals'] as AggResponse;
      const aS = values['agg:proj-series'] as AggResponse;
      const aTotals = aggTok(aT.rows, row => row.dimensions?.projectId ?? '');
      const aSeries = aggTok(
        aS.rows,
        row => `${row.dimensions?.projectId ?? ''}|${new Date(row.bucket!).toISOString()}`,
      );
      const clean = await rows<{ p: string; clean: number; any: number }>(raw, CLEAN_COST_SQL, {
        org: project.organizationId,
        names: [TOKEN_NAMES.in, TOKEN_NAMES.out],
        from: r.from.toISOString().replace('T', ' ').replace('Z', ''),
        to: r.to.toISOString().replace('T', ' ').replace('Z', ''),
      });
      const cleanCost = new Map(clean.map(c => [c.p, { ...zero(), cost: c.clean }]));
      const aCost = new Map([...aTotals].map(([k, t]) => [k, { ...zero(), cost: t.cost }]));
      const parity = {
        label: options.label,
        hash: project.hash,
        window,
        projects: { metrics: mTotals.size, agg: aTotals.size, aggTruncated: aT.truncated || aS.truncated },
        // b relative to a: metrics (a) vs aggregateTraces (b).
        totals: compareTok(mTotals, aTotals),
        series: compareTok(mSeries, aSeries),
        breakdownVsSeries: compareTok(mTotals, collapse(mSeries)),
        costWithoutPricingErrors: compareTok(cleanCost, aCost).cost,
        costAllRowsVsClean: compareTok(new Map(clean.map(c => [c.p, { ...zero(), cost: c.any }])), cleanCost).cost,
      };
      appendFileSync(OUT.c2parity, `${JSON.stringify(parity)}\n`);
      const show = (
        label: string,
        c: Record<string, { totalRel: number; worstKeyRel: number; moved: number } | undefined>,
      ) =>
        console.log(
          `  ${label.padEnd(24)} ${Object.entries(c)
            .map(([m, x]) => `${m} total ${x?.totalRel}% worst ${x?.worstKeyRel}% moved ${x?.moved}%`)
            .join(' | ')}`,
        );
      console.log(
        `  projects metrics ${parity.projects.metrics}, agg ${parity.projects.agg}, truncated ${parity.projects.aggTruncated}`,
      );
      show('totals (agg vs metrics)', parity.totals);
      show('series (agg vs metrics)', parity.series);
      show('series vs breakdown', parity.breakdownVsSeries);
      show('agg cost vs clean cost', { cost: parity.costWithoutPricingErrors });
      show('clean vs all-rows cost', { cost: parity.costAllRowsVsClean });
    }
  } finally {
    await raw.close();
  }
}

function bucketCount(r: Range, interval: string) {
  const step = interval === '1h' ? HOUR : 24 * HOUR;
  return Math.floor(r.to.getTime() / step) - Math.floor(r.from.getTime() / step) + 1;
}

function collapse(series: Map<string, Tok>) {
  const out = new Map<string, Tok>();
  for (const [k, t] of series) {
    const p = k.slice(0, k.lastIndexOf('|'));
    const o = out.get(p) ?? zero();
    for (const m of ['in', 'out', 'cache', 'cost'] as const) o[m] += t[m];
    out.set(p, o);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// page: the org page with each candidate, fired as the browser would

interface FitCard {
  card: string;
  source: 'agg' | 'metrics';
  /** Reads token/cost rows through `aggregateTraces()` (the cards that time out in X48). */
  heavy: boolean;
  fn: () => Promise<unknown>;
}

const LITE = ['count', 'errorRate', 'duration.p95'];

function orgCards(mods: Mods, client: ClickHouseClient, scope: Scope, to: Date, window: string, variant: string) {
  const r = rangeOf(to, window);
  const interval = pageInterval(window);
  const agg = (card: string, body: Record<string, unknown>, heavy: boolean): FitCard => {
    const plan = mods.plan.planPlatformTraceAggregate(body, scope, []);
    return { card, source: 'agg', heavy, fn: () => mods.run.aggregateTraces(client, plan) };
  };
  const shape = (card: string, name: string, back = 0, heavy = false) =>
    agg(card, shapeBody(name, rangeOf(to, window, back), withInterval.has(name) ? interval : undefined), heavy);
  const kpis: FitCard[] = metricsCards(mods, client, scope, r, window)
    .filter(c => c.card.startsWith('m:kpi-'))
    .map(c => ({ ...c, heavy: false }));
  const cheap = [shape('O3s', 'O3s'), shape('O3f', 'O3f'), shape('O4', 'O4'), shape('O5', 'O5'), shape('O7', 'O3s', 1)];
  const tr = { timeRange: timeRange(r) };
  const seriesLimit = Math.min(50, Math.floor(10_000 / bucketCount(r, interval)));
  // O3s and O3f as one request: every entity (limit 1000, truncation checked), ranked client-side.
  const o3 = agg(
    'O3',
    {
      ...tr,
      groupBy: ['projectId', 'entityName'],
      measures: LITE,
      orderBy: { field: 'count', direction: 'desc' },
      limit: 1000,
    },
    false,
  );
  switch (variant.replace(MODE, '')) {
    // X48's org page: every card on aggregateTraces(), KPIs included.
    case 'base':
      return [
        shape('O1', 'O1', 0, true),
        shape('O1s', 'O1s', 0, true),
        shape('O2', 'O2', 0, true),
        shape('O6', 'O6', 0, true),
        ...cheap,
        shape('P1', 'P1'),
        shape('P1prev', 'P1', 1),
        shape('P2', 'P2', 0, true),
        shape('P2prev', 'P2', 1, true),
      ];
    // Candidate 2: tokens and cost from one metrics series by project; trace measures stay on aggregateTraces().
    case 'c2':
    case 'c2m':
    case 'c2+O6': {
      const tokens = metricsTokenCalls(mods, client, scope, r, window);
      const rest = variant.startsWith('c2m') ? [o3, ...cheap.filter(c => !c.card.startsWith('O3'))] : cheap;
      return [
        agg(
          'O1',
          { ...tr, groupBy: ['projectId'], measures: LITE, orderBy: { field: 'count', direction: 'desc' }, limit: 50 },
          false,
        ),
        agg('O1s', { ...tr, groupBy: ['projectId'], measures: LITE, interval, limit: seriesLimit }, false),
        { card: 'm:proj-tokens', source: 'metrics' as const, heavy: false, fn: tokens.series },
        ...(variant.startsWith('c2+O6') ? [shape('O6', 'O6', 0, true)] : []),
        ...rest,
        ...kpis,
      ];
    }
    // Candidate 3: one aggregateTraces() statement for O1, O1s, O2 and O6 (and the token/cost KPIs).
    case 'c3':
      return [
        agg(
          'S',
          {
            ...tr,
            groupBy: ['projectId'],
            measures: [
              ...LITE,
              'tokens.total.sum',
              'tokens.input.sum',
              'tokens.output.sum',
              'tokens.cached.sum',
              'cost.sum',
            ],
            interval,
            limit: seriesLimit,
          },
          true,
        ),
        ...cheap,
        ...kpis,
      ];
    default:
      throw new Error(`unknown variant ${variant}`);
  }
}

const MODE = /-(staged|seq|spread|cap\d+)$/;

async function fire(cards: FitCard[], mode: string, cold: boolean) {
  const run = (c: FitCard) => measured(cold, PROD, c.fn);
  if (mode.startsWith('cap')) {
    // At most N cards in flight; the next starts when one finishes.
    const results: Array<Measured<unknown>> = new Array(cards.length);
    let next = 0;
    const worker = async () => {
      while (next < cards.length) {
        const i = next++;
        results[i] = await run(cards[i]!);
      }
    };
    await Promise.all(Array.from({ length: Number(mode.slice(3)) }, worker));
    return results;
  }
  if (mode === 'staged' || mode === 'seq') {
    const light = cards.filter(c => !c.heavy);
    const heavy = cards.filter(c => c.heavy);
    const out = new Map<FitCard, Measured<unknown>>();
    const lightResults = await Promise.all(light.map(run));
    light.forEach((c, i) => out.set(c, lightResults[i]!));
    if (mode === 'staged') {
      const heavyResults = await Promise.all(heavy.map(run));
      heavy.forEach((c, i) => out.set(c, heavyResults[i]!));
    } else for (const c of heavy) out.set(c, await run(c));
    return cards.map(c => out.get(c)!);
  }
  return Promise.all(cards.map(run));
}

async function page(options: { platform: string; label: string; windows: string[]; variants: string[]; reps: number }) {
  const project = largest();
  const scope: Scope = { organizationId: project.organizationId };
  const { raw, client, mods } = await connect(options.platform, 10);
  const runId = randomUUID().slice(0, 8);
  // spread: one client (one socket) per card, as separate mobs-query pods would hold.
  const spread = await Promise.all(Array.from({ length: 16 }, () => connect(options.platform, 1)));
  try {
    for (const window of options.windows) {
      for (const variant of options.variants) {
        const mode = MODE.exec(variant)?.[1] ?? 'all';
        for (const phase of ['cold', 'warm'] as const) {
          for (let rep = phase === 'cold' ? 0 : 1; rep <= (phase === 'cold' ? 0 : options.reps); rep++) {
            const to = new Date();
            const cards =
              mode === 'spread'
                ? orgCards(mods, client, scope, to, window, variant).map(
                    (_, i) => orgCards(mods, spread[i]!.client, scope, to, window, variant)[i]!,
                  )
                : orgCards(mods, client, scope, to, window, variant);
            const started = performance.now();
            const results = await fire(cards, mode, phase === 'cold');
            const wallMs = Math.round(performance.now() - started);
            const stats = await fetchStats(
              raw,
              results.flatMap(x => x.queryIds),
            );
            const record: PageRecord = {
              runId,
              label: options.label,
              page: 'org',
              role: 'largest',
              hash: project.hash,
              window,
              variant,
              phase,
              rep,
              wallMs,
              cards: cards.map((c, i) => ({
                card: c.card,
                source: c.source,
                ok: results[i]!.ok,
                ...(results[i]!.errorCode ? { errorCode: results[i]!.errorCode } : {}),
                wallMs: Math.round(results[i]!.wallMs),
                queries: results[i]!.queryIds.map(id => stats.get(id)).filter((s): s is QueryStat => !!s),
              })),
            };
            appendFileSync(OUT.page, `${JSON.stringify(record)}\n`);
            const s = summarizePage(record);
            const qs = record.cards.flatMap(c => c.queries);
            const maxStmt = Math.max(0, ...qs.map(q => Number(q.durationMs)));
            const hosts = new Set(qs.map(q => q.host)).size;
            console.log(
              `${options.label} org ${window} ${variant} ${phase}#${rep}: ${cards.length} cards, page ${wallMs} ms, slowest ${s.slowest}, max stmt ${maxStmt} ms, max ${s.maxPeak} MiB, concurrent ${s.concurrent} MiB, replicas ${hosts}, failed ${s.failed.join(',') || '-'}`,
            );
            await sleep(2000);
          }
        }
      }
    }
  } finally {
    await raw.close();
    await Promise.all(spread.map(x => x.raw.close()));
  }
}

// ---------------------------------------------------------------------------------------------
// c2check: the c2m page's reshaped requests return what X48's cards return

async function c2check(options: { platform: string; label: string; windows: string[] }) {
  const project = largest();
  const scope: Scope = { organizationId: project.organizationId };
  const { raw, client, mods } = await connect(options.platform, 4);
  const to = new Date(Math.floor(Date.now() / HOUR) * HOUR - HOUR);
  type Row = AggResponse['rows'][number];
  const run = async (body: Record<string, unknown>) => {
    const x = await measured(false, MEASURE, () =>
      mods.run.aggregateTraces(client, mods.plan.planPlatformTraceAggregate(body, scope, [])),
    );
    if (!x.ok) throw new Error(`failed ${x.errorCode}`);
    return x.value as AggResponse;
  };
  const key = (r: Row) => JSON.stringify([r.dimensions, r.bucket ?? null]);
  const same = (a: Row[], b: Row[], measures: string[]) => {
    const other = new Map(b.map(r => [key(r), r]));
    let mismatched = 0;
    for (const r of a) {
      const o = other.get(key(r));
      if (!o || measures.some(m => r.measures[m] !== o.measures[m])) mismatched++;
    }
    return { rows: a.length, other: b.length, mismatched, orderSame: a.map(key).join() === b.map(key).join() };
  };
  try {
    for (const window of options.windows) {
      const r = rangeOf(to, window);
      const interval = pageInterval(window);
      const tr = { timeRange: timeRange(r) };
      const limit = Math.min(50, Math.floor(10_000 / bucketCount(r, interval)));
      const o1 = await run(shapeBody('O1', r));
      const o1lite = await run({
        ...tr,
        groupBy: ['projectId'],
        measures: LITE,
        orderBy: { field: 'count', direction: 'desc' },
        limit: 50,
      });
      const o1s = await run({ ...shapeBody('O1s', r, interval), limit });
      const o1slite = await run({ ...tr, groupBy: ['projectId'], measures: LITE, interval, limit });
      const o3s = await run(shapeBody('O3s', r));
      const o3f = await run(shapeBody('O3f', r));
      const o3 = await run({
        ...tr,
        groupBy: ['projectId', 'entityName'],
        measures: LITE,
        orderBy: { field: 'count', direction: 'desc' },
        limit: 1000,
      });
      // The compiled ORDER BY: the measure descending (nulls last), then each dimension ascending (nulls last).
      const rank = (m: string) => (a: Row, b: Row) => {
        const x = a.measures[m] ?? -Infinity;
        const y = b.measures[m] ?? -Infinity;
        if (x !== y) return y - x;
        for (const d of ['projectId', 'entityName']) {
          const p = a.dimensions?.[d];
          const q = b.dimensions?.[d];
          if (p === q) continue;
          if (p == null) return 1;
          if (q == null) return -1;
          return p < q ? -1 : 1;
        }
        return 0;
      };
      const record = {
        label: options.label,
        hash: project.hash,
        window,
        O1: same(o1.rows, o1lite.rows, LITE),
        O1s: same(o1s.rows, o1slite.rows, LITE),
        O3truncated: o3.truncated,
        O3s: same(o3s.rows, [...o3.rows].sort(rank('duration.p95')).slice(0, 20), LITE),
        O3f: same(o3f.rows, [...o3.rows].sort(rank('errorRate')).slice(0, 20), LITE),
      };
      appendFileSync(OUT.c2check, `${JSON.stringify(record)}\n`);
      console.log(JSON.stringify(record));
    }
  } finally {
    await raw.close();
  }
}

// ---------------------------------------------------------------------------------------------
// c6: back-fill and fill-forward `mastra_model_usage` with usageId = 'm:' || metricId (read-only)

const TOKEN_ROW = `name IN {names:Array(String)} AND organizationId IS NOT NULL AND projectId IS NOT NULL AND traceId IS NOT NULL`;
const NO_ID = `(usageId IS NULL OR trimBoth(usageId) = '')`;
const DERIVED_KEY = `if(${NO_ID}, concat('m:', metricId), usageId)`;

async function c6(options: { platform: string; label: string; reps: number }) {
  const project = largest();
  const { raw, client, mods } = await connect(options.platform, 2);
  const names = USAGE_NAMES;
  const log = (what: string, value: unknown) => {
    appendFileSync(OUT.c6, `${JSON.stringify({ label: options.label, hash: project.hash, what, value })}\n`);
    console.log(`${what}: ${JSON.stringify(value)}`);
  };
  const timed = async (what: string, sql: string, params: Record<string, unknown>) => {
    const run = () =>
      client
        .query({
          query: sql,
          query_params: params,
          format: 'JSONEachRow',
          clickhouse_settings: mods.obs.CLICKHOUSE_SETTINGS,
        })
        .then(res => res.json());
    const runs: Array<Measured<unknown>> = [];
    for (let rep = 0; rep <= options.reps; rep++) runs.push(await measured(false, MEASURE, run));
    const stats = await fetchStats(
      raw,
      runs.flatMap(x => x.queryIds),
    );
    const warm = runs.slice(1).map(x => stats.get(x.queryIds[0]!));
    log(what, {
      ok: runs.slice(1).every(x => x.ok),
      memMiB: median(warm.map(s => s?.memMiB ?? Number.NaN)),
      ms: median(warm.map(s => s?.durationMs ?? Number.NaN)),
      readRows: median(warm.map(s => s?.readRows ?? Number.NaN)),
      readMiB: median(warm.map(s => s?.readMiB ?? Number.NaN)),
      result: runs.find(x => x.ok)?.value,
    });
  };
  try {
    // (b) Size: token rows per month, with/without usageId, rows the MV skips, repeated metricIds.
    log(
      'token rows by month (all orgs)',
      await rows(
        raw,
        `SELECT toStartOfMonth(timestamp) AS month, count() AS rows,
                countIf(${NO_ID}) AS noUsageId,
                countIf(${NO_ID} AND (organizationId IS NULL OR projectId IS NULL OR traceId IS NULL)) AS noUsageIdSkipped,
                countIf(${NO_ID}) - uniqExactIf(metricId, ${NO_ID}) AS repeatedMetricIdRows,
                countIf(NOT ${NO_ID} AND startsWith(usageId, 'm:')) AS realIdsWithPrefix
         FROM mastra_metric_events WHERE name IN {names:Array(String)}
         GROUP BY month ORDER BY month`,
        { names },
        { max_execution_time: 300 },
      ),
    );
    log(
      'table sizes',
      await rows(
        raw,
        `SELECT table, sum(rows) AS rows, round(sum(bytes_on_disk) / 1048576, 1) AS diskMiB,
                round(sum(data_uncompressed_bytes) / 1048576, 1) AS rawMiB
         FROM system.parts WHERE active AND database = currentDatabase()
           AND table IN ('mastra_model_usage', 'mastra_metric_events') GROUP BY table`,
        {},
      ),
    );
    // Token rows' share of mastra_metric_events, to scale its bytes to the token rows.
    log(
      'token row share of mastra_metric_events',
      await rows(raw, `SELECT countIf(name IN {names:Array(String)}) / count() AS share FROM mastra_metric_events`, {
        names,
      }),
    );

    // (a) Mixed traces: rows without a usageId in traces that also have usageId rows. The fallback's
    // trace-level anti-join drops them today; per-metricId keys would count them.
    log(
      'mixed traces since 2026-10-08 (all orgs)',
      await rows(
        raw,
        `SELECT count() AS traces, countIf(withId > 0 AND withoutId > 0) AS mixed,
                sumIf(withoutId, withId > 0) AS droppedRows, sum(withoutId) AS rowsWithoutId,
                sumIf(tokensWithoutId, withId > 0) AS droppedTokens, sum(tokens) AS tokens
         FROM (
           SELECT organizationId, projectId, traceId,
                  countIf(NOT ${NO_ID}) AS withId, countIf(${NO_ID}) AS withoutId,
                  sumIf(value, ${NO_ID} AND name IN {totals:Array(String)}) AS tokensWithoutId,
                  sumIf(value, name IN {totals:Array(String)}) AS tokens
           FROM mastra_metric_events
           WHERE ${TOKEN_ROW} AND timestamp >= '2026-10-08'
           GROUP BY organizationId, projectId, traceId)`,
        { names, totals: USAGE_NAMES.slice(0, 2) },
        { max_execution_time: 300 },
      ),
    );
    // metricId reuse across tenants or traces (a derived key is only unique within its trace).
    log(
      'metricIds in more than one trace (all orgs, 30 d)',
      await rows(
        raw,
        `SELECT count() AS metricIds, countIf(traces > 1) AS inSeveralTraces FROM (
           SELECT metricId, uniqExact(organizationId, projectId, traceId) AS traces
           FROM mastra_metric_events WHERE ${TOKEN_ROW} AND timestamp >= now() - INTERVAL 30 DAY
           GROUP BY metricId)`,
        { names },
        { max_execution_time: 300 },
      ),
    );

    // (b) Back-fill read cost: the MV's projection over the busiest month, all orgs.
    await timed(
      'backfill read, one month (2026-09), all orgs',
      `SELECT count() AS rows, sum(cityHash64(organizationId, projectId, traceId, metricId, timestamp, value,
              estimatedCost, costUnit, costMetadata, spanId)) AS h
       FROM mastra_metric_events
       WHERE ${TOKEN_ROW} AND ${NO_ID} AND timestamp >= '2026-09-01' AND timestamp < '2026-10-01'`,
      { names },
    );

    // (c) Query cost with the fallback off over a back-filled table, largest org: table_usage computed
    // from mastra_metric_events with the derived key. Its memory is the real grouping; its reads are
    // an upper bound (mastra_metric_events rows are wider than usage-table rows).
    for (const days of [7, 30]) {
      await timed(
        `table_usage over derived keys, largest org, ${days} d`,
        `SELECT count() AS traces, sum(t0) AS t0 FROM (
           SELECT traceHash, sum(ifNull(t0, 0)) AS t0, sum(ifNull(t1, 0)) AS t1, sum(ifNull(t2, 0)) AS t2,
                  sum(ifNull(t3, 0)) AS t3, sum(ifNull(ic, 0) + ifNull(oc, 0)) AS cost, max(p) AS priced,
                  max(f) AS pricingFailure, min(umin) AS unitMin, max(umax) AS unitMax
           FROM (
             SELECT cityHash64(organizationId, projectId, traceId) AS traceHash,
                    max(if(name = {n0:String}, value, NULL)) AS t0, max(if(name = {n1:String}, value, NULL)) AS t1,
                    max(if(name = {n2:String}, value, NULL)) AS t2, max(if(name = {n3:String}, value, NULL)) AS t3,
                    max(if(name = {n0:String} AND isNotNull(estimatedCost), estimatedCost, NULL)) AS ic,
                    max(if(name = {n1:String} AND isNotNull(estimatedCost), estimatedCost, NULL)) AS oc,
                    max(toUInt8(isNotNull(estimatedCost))) AS p, max(toUInt8(isNull(costUnit))) AS f,
                    min(costUnit) AS umin, max(costUnit) AS umax
             FROM mastra_metric_events
             WHERE ${TOKEN_ROW} AND organizationId = {org:String} AND timestamp >= now() - INTERVAL ${days} DAY
             GROUP BY traceHash, ${DERIVED_KEY})
           GROUP BY traceHash)`,
        { names, n0: names[0], n1: names[1], n2: names[2], n3: names[3], org: project.organizationId },
      );
      log(
        `usage-table rows after back-fill, largest org, ${days} d`,
        await rows(
          raw,
          `SELECT uniqExact(organizationId, projectId, traceId, ${DERIVED_KEY}) AS keys, count() AS tokenRows
           FROM mastra_metric_events
           WHERE ${TOKEN_ROW} AND organizationId = {org:String} AND timestamp >= now() - INTERVAL ${days} DAY`,
          { names, org: project.organizationId },
        ),
      );
    }
    log(
      'usage-table read bytes per row today, largest org 30 d',
      await rows(
        raw,
        `SELECT count() AS rows FROM mastra_model_usage
         WHERE organizationId = {org:String} AND timestamp >= now() - INTERVAL 30 DAY`,
        { org: project.organizationId },
      ),
    );
  } finally {
    await raw.close();
  }
}

// ---------------------------------------------------------------------------------------------
// nodes: what the replica node was doing during each recorded page load

async function nodes(options: { platform: string; label: string }) {
  const loads = readFileSync(OUT.page, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as PageRecord)
    .filter(r => r.label === options.label && r.phase === 'warm');
  const { raw } = await connect(options.platform, 1);
  const host = (name: string) => createHash('sha256').update(name).digest('hex').slice(0, 6);
  try {
    for (const r of await rows<{ host: string; metric: string; value: number }>(
      raw,
      `SELECT hostname() AS host, metric, value FROM clusterAllReplicas('all_groups.default', system.asynchronous_metrics)
       WHERE metric IN ('CGroupMaxCPU', 'CGroupMemoryTotal') ORDER BY host, metric`,
      {},
    ))
      console.log(
        host(r.host),
        r.metric,
        r.metric === 'CGroupMemoryTotal' ? `${Math.round(r.value / GiB)} GiB` : r.value,
      );
    for (const load of loads) {
      const queries = load.cards.flatMap(c => c.queries);
      const start = Math.min(...queries.map(q => q.startUs)) / 1e6;
      const range = { a: Math.floor(start), b: Math.ceil(start + load.wallMs / 1000) };
      const node = await rows<Record<string, number | string>>(
        raw,
        `SELECT hostname() AS host, round(avg(ProfileEvent_OSCPUVirtualTimeMicroseconds) / 1e6, 1) AS cpuCores,
                round(avg(CurrentMetric_ConcurrencyControlAcquired), 1) AS slots,
                round(avg(CurrentMetric_ConcurrencyControlSoftLimit)) AS slotLimit,
                round(avg(CurrentMetric_Query), 1) AS queries, round(avg(CurrentMetric_BackgroundFetchesPoolTask), 1) AS fetches
         FROM clusterAllReplicas('all_groups.default', system.metric_log)
         WHERE event_date = today() AND event_time >= toDateTime({a:UInt32}) AND event_time < toDateTime({b:UInt32})
         GROUP BY host`,
        range,
        { max_execution_time: 100 },
      );
      const others = await rows<{ host: string }>(
        raw,
        `SELECT hostname() AS host FROM clusterAllReplicas('all_groups.default', system.query_log)
         WHERE event_date = today() AND type != 'QueryStart' AND query_id NOT IN {ids:Array(String)}
           AND event_time >= toDateTime({a:UInt32}) AND query_start_time <= toDateTime({b:UInt32})
           AND (ProfileEvents['OSCPUVirtualTimeMicroseconds'] >= 300000 OR query_duration_ms >= 1000)`,
        { ...range, ids: queries.map(q => q.id) },
        { max_execution_time: 100 },
      );
      const ran = new Set(queries.map(q => q.host));
      const failed = load.cards.filter(c => !c.ok).map(c => c.card);
      console.log(
        `${load.window} ${load.variant} warm#${load.rep}: ${load.wallMs} ms, failed ${failed.join(',') || '-'}`,
      );
      for (const n of node.filter(n => ran.has(host(String(n.host)))))
        console.log(
          `  node ${host(String(n.host))}: cpu ${n.cpuCores} cores, slots ${n.slots}/${n.slotLimit}, queries ${n.queries}, fetches ${n.fetches}, ` +
            `other heavy queries ${others.filter(o => ran.has(host(o.host))).length}`,
        );
    }
  } finally {
    await raw.close();
  }
}

/** Prints which numeric columns differ between two results keyed by their string columns (never the keys). */
function explainDiff(a: Array<Record<string, unknown>>, b: Array<Record<string, unknown>>) {
  const key = (r: Record<string, unknown>) =>
    JSON.stringify(Object.entries(r).filter(([, v]) => typeof v !== 'number'));
  const other = new Map(b.map(r => [key(r), r]));
  let missing = 0;
  for (const [i, r] of a.entries()) {
    const o = other.get(key(r));
    if (!o) {
      missing++;
      continue;
    }
    for (const [col, v] of Object.entries(r)) {
      if (typeof v !== 'number' || v === o[col]) continue;
      const rel = Math.abs(v - Number(o[col])) / Math.max(Math.abs(v), 1e-300);
      console.log(`  row ${i} ${col}: relative difference ${rel.toExponential(2)}`);
    }
  }
  if (missing || a.length !== b.length) console.log(`  rows ${a.length} vs ${b.length}, ${missing} unmatched keys`);
}

function median(values: number[]): number {
  const sorted = values.filter(v => !Number.isNaN(v)).sort((a, b) => a - b);
  if (!sorted.length) return Number.NaN;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
}

// ---------------------------------------------------------------------------------------------

installOutputRedaction();
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    platform: { type: 'string', default: '/tmp/platform-x48/servers/mobs-query' },
    since: { type: 'string', default: '2026-09-20' },
    label: { type: 'string', default: 'x49' },
    shape: { type: 'string', default: 'O6' },
    windows: { type: 'string', default: '30d' },
    variants: { type: 'string', default: 'full,1pass,fb-off' },
    reps: { type: 'string', default: '3' },
    explain: { type: 'boolean', default: false },
  },
});
switch (positionals[0]) {
  case 'facts':
    await facts(values.platform, values.since);
    break;
  case 'stmt':
    await stmt({
      platform: values.platform,
      label: values.label,
      shape: values.shape,
      windows: values.windows.split(','),
      variants: values.variants.split(','),
      reps: Number(values.reps),
      explain: values.explain,
    });
    break;
  case 'c2':
    await c2({
      platform: values.platform,
      label: values.label,
      windows: values.windows.split(','),
      reps: Number(values.reps),
    });
    break;
  case 'page':
    await page({
      platform: values.platform,
      label: values.label,
      windows: values.windows.split(','),
      variants: values.variants.split(','),
      reps: Number(values.reps),
    });
    break;
  case 'c2check':
    await c2check({ platform: values.platform, label: values.label, windows: values.windows.split(',') });
    break;
  case 'c6':
    await c6({ platform: values.platform, label: values.label, reps: Number(values.reps) });
    break;
  case 'nodes':
    await nodes({ platform: values.platform, label: values.label });
    break;
  default:
    console.error('usage: mobs-org-page-fit.ts facts|stmt|c2|c2check|page|c6|nodes');
    process.exit(1);
}
