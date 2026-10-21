/**
 * X52 (OBS-392 review): bounding the per-span usage read of `aggregateSpans()`.
 *
 * mobs-query's span aggregate (platform#3633) reads usage rows from `mastra_metric_events` with
 * tenant + `timestamp >= from` only, so its cost grows with how far back `from` is, not with the
 * window's length. Variants, applied to the SQL platform#3633 compiles (no prototype compiler):
 *
 *   current     tenant + `timestamp >= from`
 *   upper       + `timestamp < to + LAG`, LAG = the longest span-start → usage-row lag allowed
 *   semi        + `traceId IN usage_traces`, a light CTE: distinct trace IDs of spans starting in the
 *               window (same table, tenant and positive spanType/name prefilter as the selection;
 *               no copy collapse, no predicate — a superset of the selected spans' traces)
 *   semiSel     + `traceId IN (SELECT traceId FROM selected)` (re-runs the full selection)
 *   semiUpper   semi + upper
 *
 *   npx tsx mobs-span-usage-bound.ts facts --platform <mobs-query dir>
 *   npx tsx mobs-span-usage-bound.ts run --platform <mobs-query dir> [--variants current,upper,semi]
 *       [--cells now7,hist7,branch180] [--reps 2] [--lag-hours 24]
 *
 * Run against platform#3633 at f642fc541, before it shipped `upper`: from 67d257f93 on, the
 * compiled SQL already carries `timestamp < to + 30 d`, so `current` there means `upper`.
 *
 * Output: role, hash, scope, window, shape, variant, metrics. No ids, keys, rows or values printed.
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import type { ClickHouseClient, ClickHouseSettings } from '@clickhouse/client';

import { assertReadOnlyStatement } from './client';
import { installOutputRedaction } from './env';
import { connect, pickProjects } from './mobs-span-aggregate';
import { loadSelection } from './profile';
import { RESULTS_DIR } from './run';

const OUT = join(RESULTS_DIR, 'mobs-span-usage-bound.jsonl');
const ALL_LOG = `clusterAllReplicas('all_groups.default', system.query_log)`;
const DAY = 86_400_000;
const GiB = 1024 ** 3;
const MEASURE: ClickHouseSettings = { max_memory_usage: String(4 * GiB), max_execution_time: 30 };
const PROD: ClickHouseSettings = { max_memory_usage: String(GiB), max_execution_time: 9 };
const USAGE_NAMES = [
  'mastra_model_total_input_tokens',
  'mastra_model_total_output_tokens',
  'mastra_model_output_reasoning_tokens',
  'mastra_model_input_cache_read_tokens',
];
const BRANCH_TYPES = [
  'agent_run',
  'workflow_run',
  'processor_run',
  'scorer_run',
  'rag_ingestion',
  'tool_call',
  'mcp_tool_call',
  'mcp_server_request',
  'provider_tool_call',
];

type Variant = 'current' | 'upper' | 'semi' | 'semiSel' | 'semiUpper';
const spanType = (literal: string) => ({ op: 'eq', left: { path: 'spanType' }, right: { literal } });
const USAGE_MEASURES = ['count', 'tokens.input.sum', 'tokens.output.sum', 'tokens.total.avg', 'cost.sum'];

/** U1 reads span events (non-branch path); U2 reads trace branches. */
const SHAPES: Record<string, { where: unknown; groupBy: string[]; measures: string[] }> = {
  U1: { where: spanType('model_generation'), groupBy: ['rootEntityName'], measures: USAGE_MEASURES },
  U2: { where: spanType('agent_run'), groupBy: ['entityName'], measures: USAGE_MEASURES },
};

/** Windows: `now7` ends now; `hist7` ends `histEndDays` ago (ending 90 days ago). */
interface Cell {
  id: string;
  days: number;
  endDaysAgo: number;
  shapes: string[];
  scopes: Array<'project' | 'org'>;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const chTime = (date: Date) => date.toISOString().replace('T', ' ').replace(/Z$/, '');

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadCompiler(dir: string) {
  const load = (path: string) => import(pathToFileURL(join(dir, path)).href) as Promise<any>;
  return {
    plan: (await load('src/services/span-aggregate-plan.ts')).planPlatformSpanAggregate,
    compile: (await load('src/services/span-aggregate-sql.ts')).compileClickHouseSpanAggregate,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Rewrites platform#3633's compiled usage read into `variant`. */
export function applyVariant(
  compiled: { query: string; query_params: Record<string, unknown> },
  variant: Variant,
  context: {
    from: Date;
    to: Date;
    lagHours: number;
    scope: { organizationId: string; projectId?: string };
    branch: boolean;
    spanType: string;
  },
) {
  const params: Record<string, unknown> = { ...compiled.query_params };
  const add = (value: unknown, type: string) => {
    const name = `x52_${Object.keys(params).length}`;
    params[name] = value;
    return `{${name}:${type}}`;
  };
  const anchor = 'AND isNotNull(spanId)';
  const occurrences = compiled.query.split(anchor).length - 1;
  if (occurrences !== 4)
    throw new Error(
      `expected 4 usage row filters, found ${occurrences}:\n${compiled.query
        .split('\n')
        .filter(line => line.includes(anchor) || line.includes('FROM '))
        .join('\n')}`,
    );
  if (!compiled.query.startsWith('WITH ')) throw new Error('expected a WITH query');
  let extra = '';
  let query = compiled.query;
  if (variant === 'upper' || variant === 'semiUpper') {
    const upper = new Date(context.to.getTime() + context.lagHours * 3_600_000);
    extra += `\n          AND timestamp < ${add(chTime(upper), "DateTime64(3, 'UTC')")}`;
  }
  if (variant === 'semi' || variant === 'semiUpper') {
    const from = add(chTime(context.from), "DateTime64(3, 'UTC')");
    const to = add(chTime(context.to), "DateTime64(3, 'UTC')");
    const tenant =
      `e.organizationId = ${add(context.scope.organizationId, 'String')}` +
      (context.scope.projectId === undefined
        ? ' AND isNotNull(e.projectId)'
        : ` AND e.projectId = ${add(context.scope.projectId, 'String')}`);
    const cte = `usage_traces AS (
    SELECT DISTINCT e.traceId AS traceId
    FROM ${context.branch ? 'mastra_trace_branches' : 'mastra_span_events'} e
    PREWHERE e.endedAt >= ${from}
    WHERE e.startedAt >= ${from} AND e.startedAt < ${to} AND ${tenant}
      AND e.spanType = ${add(context.spanType, 'String')}
  ),\n  `;
    query = `WITH ${cte}${query.slice('WITH '.length)}`;
    extra += `\n          AND traceId IN (SELECT traceId FROM usage_traces)`;
  }
  if (variant === 'semiSel') extra += `\n          AND traceId IN (SELECT traceId FROM selected)`;
  return { query: query.split(anchor).join(`${anchor}${extra}`), query_params: params };
}

async function exec(
  raw: ClickHouseClient,
  compiled: { query: string; query_params: Record<string, unknown> },
  settings: ClickHouseSettings,
  cold: boolean,
  queryId: string,
) {
  assertReadOnlyStatement(compiled.query);
  const result = await raw.query({
    query: compiled.query,
    query_params: compiled.query_params,
    query_id: queryId,
    format: 'JSONEachRow',
    clickhouse_settings: {
      date_time_input_format: 'best_effort',
      date_time_output_format: 'iso',
      use_client_time_zone: 1,
      output_format_json_quote_64bit_integers: 0,
      use_query_cache: 0,
      max_threads: 16,
      ...settings,
      log_comment: 'aqa-bench:mobs-span-usage-bound',
      ...(cold ? { enable_filesystem_cache: 0 } : {}),
    },
  });
  return result.json<Record<string, unknown>>();
}

interface QueryStat {
  durationMs: number;
  memMiB: number;
  readRows: number;
  readMiB: number;
  exc: number;
}

async function fetchStats(raw: ClickHouseClient, ids: string[]): Promise<Map<string, QueryStat>> {
  const found = new Map<string, QueryStat>();
  for (let attempt = 0; attempt < 30 && found.size < ids.length; attempt++) {
    if (attempt > 0) await sleep(2000);
    const result = await raw.query({
      query: `SELECT query_id AS id, query_duration_ms AS durationMs, round(memory_usage / 1048576, 1) AS memMiB,
              read_rows AS readRows, round(read_bytes / 1048576, 2) AS readMiB, exception_code AS exc
       FROM ${ALL_LOG}
       WHERE event_date >= yesterday() AND type IN ('QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart')
         AND query_id IN {ids:Array(String)}`,
      query_params: { ids: ids.filter(id => !found.has(id)) },
      format: 'JSONEachRow',
      clickhouse_settings: { log_comment: 'aqa-bench:mobs-span-usage-bound:meta', max_execution_time: 60 },
    });
    for (const { id, ...stat } of await result.json<QueryStat & { id: string }>()) found.set(id, stat);
  }
  return found;
}

/** Aggregate-only facts (no ids or values): usage span types, branch coverage, usage lag, extent. */
async function facts(platform: string) {
  const { raw } = await connect(platform);
  const q = async (label: string, query: string, params: Record<string, unknown> = {}) => {
    assertReadOnlyStatement(query);
    console.log(`\n## ${label}`);
    const started = performance.now();
    const result = await raw.query({
      query,
      query_params: params,
      format: 'JSONEachRow',
      clickhouse_settings: {
        max_memory_usage: String(8 * GiB),
        max_execution_time: 300,
        max_threads: 16,
        output_format_json_quote_64bit_integers: 0,
        log_comment: 'aqa-bench:mobs-span-usage-bound:facts',
      },
    });
    const rows = await result.json<Record<string, unknown>>();
    console.log(`(${Math.round(performance.now() - started)} ms)`);
    for (const row of rows) console.log(JSON.stringify(row));
    appendFileSync(OUT, `${JSON.stringify({ facts: label, rows })}\n`);
  };
  const usage = `name IN {names:Array(String)}`;
  const names = { names: USAGE_NAMES, branch: BRANCH_TYPES };
  const days = (process.env.X52_DAYS ?? '').split(',').filter(Boolean);
  const lagDays = Number(process.env.X52_LAG_DAYS ?? 1);
  const durationDays = Number(process.env.X52_DURATION_DAYS ?? 1);
  try {
    await q(
      'extent (active partitions)',
      `SELECT table, min(partition) AS first, max(partition) AS last, count(DISTINCT partition) AS days,
         round(sum(data_compressed_bytes) / 1073741824, 1) AS GiB
       FROM system.parts
       WHERE active AND database = currentDatabase()
         AND table IN ('mastra_span_events', 'mastra_trace_branches', 'mastra_metric_events')
       GROUP BY table ORDER BY table`,
    );
    // Which span type each usage row's spanId names, every tenant, one recent day.
    await q(
      'usage rows by span type of their spanId (6 h ending at midnight, all tenants)',
      `WITH m AS (
         SELECT cityHash64(organizationId, projectId, traceId, spanId) AS k, count() AS n
         FROM mastra_metric_events
         WHERE ${usage} AND timestamp >= today() - INTERVAL 6 HOUR AND timestamp < today() AND isNotNull(spanId)
         GROUP BY k
       ),
       s AS (
         SELECT cityHash64(organizationId, projectId, traceId, spanId) AS k, any(spanType) AS spanType
         FROM mastra_span_events
         WHERE endedAt >= today() - INTERVAL 7 HOUR AND endedAt < today() + INTERVAL 1 HOUR
           AND cityHash64(organizationId, projectId, traceId, spanId) IN (SELECT k FROM m)
         GROUP BY k
       )
       SELECT if(s.k = 0, '(no span)', s.spanType) AS type, sum(m.n) AS usageRows, count() AS spans,
         has({branch:Array(String)}, type) AS branch
       FROM m LEFT JOIN s ON s.k = m.k
       GROUP BY type ORDER BY usageRows DESC`,
      names,
    );
    await q(
      'usage rows without spanId (yesterday, all tenants)',
      `SELECT isNull(spanId) AS noSpanId, count() AS rows FROM mastra_metric_events
       WHERE ${usage} AND timestamp >= yesterday() AND timestamp < today() GROUP BY noSpanId`,
      names,
    );
    // How long after its span starts a usage row is stamped (bounds `timestamp < to + LAG`).
    await q(
      `usage row lag after span start, seconds (usage rows of the last ${lagDays} days, all tenants)`,
      `WITH m AS (
         SELECT cityHash64(organizationId, projectId, traceId, spanId) AS k, min(timestamp) AS first, max(timestamp) AS last
         FROM mastra_metric_events
         WHERE ${usage} AND timestamp >= today() - ${lagDays} AND timestamp < today() AND isNotNull(spanId)
         GROUP BY k
       )
       SELECT count() AS spans,
         quantilesExact(0.5, 0.99, 0.999, 0.9999)(dateDiff('second', s.startedAt, m.last)) AS q,
         max(dateDiff('second', s.startedAt, m.last)) AS maxLag,
         countIf(dateDiff('second', s.startedAt, m.last) > 3600) AS over1h,
         countIf(dateDiff('second', s.startedAt, m.last) > 86400) AS over1d,
         countIf(m.first < s.startedAt) AS beforeStart
       FROM m INNER JOIN (
         SELECT cityHash64(organizationId, projectId, traceId, spanId) AS k, min(startedAt) AS startedAt
         FROM mastra_span_events
         WHERE endedAt >= today() - ${lagDays} - 1 AND endedAt < today() + INTERVAL 1 HOUR AND cityHash64(organizationId, projectId, traceId, spanId) IN (SELECT k FROM m)
         GROUP BY k
       ) s ON s.k = m.k`,
      names,
    );
    await q(
      `span duration, seconds (spans ending in the last ${durationDays} days, all tenants)`,
      `SELECT spanType IN {branch:Array(String)} AS branch, count() AS spans,
         quantiles(0.99, 0.9999)(dateDiff('second', startedAt, endedAt)) AS q,
         max(dateDiff('second', startedAt, endedAt)) AS maxSeconds,
         countIf(endedAt > startedAt + INTERVAL 1 DAY) AS over1d,
         countIf(endedAt > startedAt + INTERVAL 7 DAY) AS over7d
       FROM mastra_span_events WHERE endedAt >= today() - ${durationDays} AND endedAt < today() GROUP BY branch`,
      names,
    );
    // Branch coverage: branch-type spans per end day in span_events vs trace_branches, for the
    // first days either table holds and two recent days.
    for (const day of days) {
      await q(
        `branch-type rows ending on ${day}, span_events vs trace_branches (all tenants)`,
        `SELECT
           (SELECT count() FROM mastra_span_events WHERE toDate(endedAt) = {day:Date} AND spanType IN {branch:Array(String)}) AS spanEvents,
           (SELECT count() FROM mastra_trace_branches WHERE toDate(endedAt) = {day:Date}) AS traceBranches`,
        { ...names, day },
      );
    }
  } finally {
    await raw.close();
  }
}

async function run(options: { platform: string; variants: Variant[]; cells: Cell[]; reps: number; lagHours: number }) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const { raw } = await connect(options.platform);
  const compiler = await loadCompiler(options.platform);
  const runId = randomUUID().slice(0, 8);
  const now = Date.now();
  const largest = pickProjects(selection.projects).find(([role]) => role === 'largest')?.[1];
  if (!largest) throw new Error('No largest project in the selection');
  try {
    for (const cell of options.cells) {
      for (const scopeName of cell.scopes) {
        const scope =
          scopeName === 'project'
            ? { organizationId: largest.organizationId, projectId: largest.projectId }
            : { organizationId: largest.organizationId };
        for (const shapeId of cell.shapes) {
          const shape = SHAPES[shapeId]!;
          const to = new Date(now - cell.endDaysAgo * DAY);
          const from = new Date(to.getTime() - cell.days * DAY);
          const plan = compiler.plan(
            { timeRange: { from: from.toISOString(), to: to.toISOString() }, ...shape },
            scope,
            [],
          );
          const base = compiler.compile(plan);
          for (const variant of options.variants) {
            const compiled = applyVariant(base, variant, {
              from,
              to,
              lagHours: options.lagHours,
              scope,
              branch: shapeId === 'U2',
              spanType: shapeId === 'U2' ? 'agent_run' : 'model_generation',
            });
            const record = {
              runId,
              hash: largest.hash,
              scope: scopeName,
              cell: cell.id,
              shape: shapeId,
              variant,
              lagHours: options.lagHours,
            };
            const calls: Array<{
              id: string;
              arm: string;
              phase: string;
              ok: boolean;
              errorCode?: string;
              result?: unknown[];
            }> = [];
            const call = async (arm: 'measure' | 'prod', phase: 'cold' | 'warm', keep = true) => {
              const id = randomUUID();
              let ok = true;
              let errorCode: string | undefined;
              let result: unknown[] | undefined;
              try {
                result = await exec(raw, compiled, arm === 'prod' ? PROD : MEASURE, phase === 'cold', id);
              } catch (error) {
                ok = false;
                const code = (error as { code?: unknown })?.code;
                errorCode = code === undefined ? ((error as Error)?.name ?? 'client') : String(code);
              }
              if (keep) calls.push({ id, arm, phase, ok, ...(errorCode ? { errorCode } : {}), result });
              await sleep(150);
            };
            await call('measure', 'cold');
            await call('measure', 'warm', false);
            for (let rep = 0; rep < options.reps; rep++) await call('measure', 'warm');
            await call('prod', 'warm');
            const stats = await fetchStats(
              raw,
              calls.map(c => c.id),
            );
            // Parity: every successful call must return the same groups and measures as `current`.
            const digest = (rows: unknown[] | undefined) =>
              rows
                ? JSON.stringify(rows, (_, value) =>
                    typeof value === 'number' && !Number.isInteger(value) ? Number(value.toPrecision(9)) : value,
                  )
                : undefined;
            for (const { id, result, ...rest } of calls)
              appendFileSync(
                OUT,
                `${JSON.stringify({ ...record, ...rest, digest: digest(result) ? hash(digest(result)!) : undefined, stat: stats.get(id) })}\n`,
              );
            const warm = calls.filter(c => c.arm === 'measure' && c.phase === 'warm').map(c => stats.get(c.id));
            const prod = calls.find(c => c.arm === 'prod')!;
            const cold = calls[0]!;
            console.log(
              [scopeName, cell.id, shapeId, variant].join(' '),
              'warm',
              warm.map(s => (s ? `${s.durationMs}ms/${s.memMiB}MiB/${s.readMiB}MiBread` : '?')).join(' '),
              'cold',
              cold.ok ? `${stats.get(cold.id)?.durationMs}ms` : `fail ${cold.errorCode}`,
              'prod',
              prod.ok ? 'ok' : `FAIL ${prod.errorCode}`,
              'digest',
              digest(calls.find(c => c.ok)?.result) ? hash(digest(calls.find(c => c.ok)!.result)!) : '-',
            );
          }
        }
      }
    }
  } finally {
    await raw.close();
  }
}

function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
}

const CELLS: Record<string, Cell> = {
  now7: { id: 'now7', days: 7, endDaysAgo: 0, shapes: ['U1', 'U2'], scopes: ['project', 'org'] },
  hist7: { id: 'hist7', days: 7, endDaysAgo: 90, shapes: ['U1', 'U2'], scopes: ['project', 'org'] },
  past7: { id: 'past7', days: 7, endDaysAgo: 14, shapes: ['U1', 'U2'], scopes: ['project', 'org'] },
  branch180: { id: 'branch180', days: 180, endDaysAgo: 0, shapes: ['U2'], scopes: ['org'] },
};

async function main() {
  installOutputRedaction();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      platform: { type: 'string' },
      variants: { type: 'string', default: 'current,upper,semi,semiSel,semiUpper' },
      cells: { type: 'string', default: 'now7,hist7,branch180' },
      reps: { type: 'string', default: '2' },
      'lag-hours': { type: 'string', default: '24' },
    },
  });
  if (!values.platform) throw new Error('--platform <mobs-query dir> is required');
  if (positionals[0] === 'facts') return facts(values.platform);
  if (positionals[0] === 'run')
    return run({
      platform: values.platform,
      variants: values.variants.split(',') as Variant[],
      cells: values.cells.split(',').map(id => CELLS[id]!),
      reps: Number(values.reps),
      lagHours: Number(values['lag-hours']),
    });
  throw new Error('usage: facts | run');
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();
