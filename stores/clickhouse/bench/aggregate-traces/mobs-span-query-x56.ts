/**
 * X56b–X56f (OBS-719): approaches to organization-wide `/spans/query` over full retention on the
 * largest org. Each variant pages through `--pages` cursor pages, one statement at a time under
 * mobs-query's production limits (1 GiB / 9 s per statement), and is compared row-for-row with
 * today's statement (origin/main compiler) run as an oracle with external sort and a long limit.
 *
 * Variants (selection statement only; the payload statement reads the page's rows by key):
 *   base            origin/main: one statement, every span in the window sorted to collapse copies
 *   prefilter       OBS-719 branch: positive spanType/name conjuncts below the collapse
 *   inorder         prefilter + copies collapsed by GROUP BY identity in table-key order
 *   narrow          prefilter + adaptive narrowing: 1 h from the cursor, ×8 per attempt, then the
 *                   whole window
 *   narrow-inorder  narrow, each attempt collapsed in order
 *
 *   npx tsx mobs-span-query-x56.ts probe --platform <dir> --base <file> [--windows 30d,180d]
 *   npx tsx mobs-span-query-x56.ts run --platform <dir> --base <file> --label <id>
 *       [--windows 7d,30d,180d] [--shapes Q1,...] [--orders sd,sa,ed,ea] [--variants ...]
 *       [--pages 5] [--runs 2] [--oracle relaxed|prod|hand] [--settings '{"optimize_read_in_order":0}']
 *   npx tsx mobs-span-query-x56.ts report [--label <id>]
 *
 * Output: window, shape, order, variant, metrics, equality. No ids, keys, rows or values.
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import type { ClickHouseClient, ClickHouseSettings } from '@clickhouse/client';

import { assertReadOnlyStatement } from './client';
import { installOutputRedaction } from './env';
import {
  connect,
  errorCode,
  exec,
  fetchStat,
  MEASURE,
  pickProjects,
  PROD,
  SHAPES as X56A_SHAPES,
  scopeOf,
  windowRange,
} from './mobs-span-query-org';
import type { Mods, QueryStat, Scope } from './mobs-span-query-org';
import { loadSelection } from './profile';
import { RESULTS_DIR } from './run';

const OUT = join(RESULTS_DIR, 'mobs-span-query-x56.jsonl');
const HOUR = 3_600_000;
const GiB = 1024 ** 3;
const ORACLE: ClickHouseSettings = {
  max_memory_usage: String(6 * GiB),
  max_bytes_before_external_sort: String(GiB),
  max_execution_time: 300,
};
/** Independent reference: each span's latest copy by `argMax`, `where` written out by hand. */
const HAND_WHERE: Record<string, string> = {
  Q1: '1',
  Q2: "type = 'tool_call' AND failed",
  Q3: "type = 'model_generation'",
  Q4: "dateDiff('millisecond', firstStart, lastEnd) > 5000",
  Q6: `dateDiff('millisecond', firstStart, lastEnd) > ${30 * 86_400_000}`,
};
const HAND: ClickHouseSettings = {
  max_memory_usage: String(10 * GiB),
  max_bytes_before_external_group_by: String(3 * GiB),
  max_bytes_before_external_sort: String(GiB),
  max_execution_time: 900,
};

function handwritten(
  organizationId: string,
  timeRange: { from: string; to: string },
  shape: string,
  order: { field: string; direction: string },
  rows: number,
) {
  const param = (value: string) => value.replace('T', ' ').replace('Z', '');
  const dir = order.direction === 'asc' ? 'ASC' : 'DESC';
  return {
    // Aggregate aliases differ from the columns so no aggregate reads another one.
    query: `SELECT organizationId, projectId, resourceId, traceId, spanId, firstStart AS startedAt, lastEnd AS endedAt FROM (
        SELECT organizationId, projectId, resourceId, traceId, spanId, any(startedAt) AS firstStart,
          max(endedAt) AS lastEnd, any(spanType) AS type, argMax(isNotNull(error), endedAt) AS failed
        FROM mastra_span_events
        WHERE organizationId = {org:String} AND isNotNull(projectId)
          AND startedAt >= {from:DateTime64(3, 'UTC')} AND startedAt < {to:DateTime64(3, 'UTC')}
        GROUP BY organizationId, projectId, resourceId, traceId, spanId)
      WHERE ${HAND_WHERE[shape]}
      ORDER BY ${order.field === 'startedAt' ? 'firstStart' : 'lastEnd'} ${dir}, organizationId, projectId, resourceId ASC NULLS LAST, traceId, spanId
      LIMIT {rows:UInt64}`,
    query_params: { org: organizationId, from: param(timeRange.from), to: param(timeRange.to), rows },
  };
}

const IN_ORDER: ClickHouseSettings = { optimize_aggregation_in_order: 1 };

export const SHAPES: Record<string, { where?: unknown; limit: number }> = {
  ...X56A_SHAPES,
  // Matches next to nothing and has no positive conjunct: every narrowing attempt runs, the last
  // over the whole window.
  Q6: { where: { op: 'gt', left: { path: 'durationMs' }, right: { literal: 30 * 86_400_000 } }, limit: 100 },
};
const ORDERS: Record<string, { field: 'startedAt' | 'endedAt'; direction: 'asc' | 'desc' }> = {
  sd: { field: 'startedAt', direction: 'desc' },
  sa: { field: 'startedAt', direction: 'asc' },
  ed: { field: 'endedAt', direction: 'desc' },
  ea: { field: 'endedAt', direction: 'asc' },
};

type Variant = 'base' | 'prefilter' | 'inorder' | 'matched' | 'narrow' | 'narrow-inorder' | 'narrow-matched';
type Row = Record<string, unknown>;
interface Statement {
  id: string;
  wallMs: number;
  attempt: number;
  ok: boolean;
  errorCode?: string;
  rows?: number;
  stat?: QueryStat;
}
interface PageRecord {
  at: string;
  label: string;
  hash: string;
  scope: Scope;
  window: string;
  shape: string;
  order: string;
  variant: Variant;
  run: number;
  page: number;
  ok: boolean;
  rows: number;
  statements: Statement[];
  equal?: boolean | null;
  oracle?: string;
  overlay?: ClickHouseSettings;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Plan = any;

const identity = ['organizationId', 'projectId', 'resourceId', 'traceId', 'spanId'] as const;
const key = (row: Row) => JSON.stringify([...identity.map(k => row[k] ?? null), row.startedAt, row.endedAt]);

function nextPlan(plan: Plan, last: Row): Plan {
  const cursor = Object.fromEntries(identity.map(k => [k, last[k] ?? null]));
  return { ...plan, cursor: { ...cursor, sortValue: String(last[plan.orderBy.field]) } };
}

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (value: unknown) => Date.parse(String(value).replace(' ', 'T') + (String(value).endsWith('Z') ? '' : 'Z'));

/**
 * Bounds of the narrowing attempt `width` ms past the cursor (or the window edge), or undefined
 * once it would cover the window. Copies of a span share `startedAt` and no span ends before it
 * starts, so a `startedAt`/`endedAt` floor or a `startedAt` ceiling keeps every copy of every
 * span that can sort before the bound.
 */
function attemptBounds(plan: Plan, width: number, firstStart?: number): Record<string, string> | undefined {
  const from = Date.parse(plan.timeRange.from);
  const to = Date.parse(plan.timeRange.to);
  const { field, direction } = plan.orderBy;
  if (direction === 'desc') {
    const floor = (plan.cursor ? ms(plan.cursor.sortValue) : to) - width;
    if (floor <= from) return undefined;
    return field === 'startedAt' ? { startedFrom: iso(floor), endedFrom: iso(floor) } : { endedFrom: iso(floor) };
  }
  const ceiling = Math.max(plan.cursor ? ms(plan.cursor.sortValue) : from, firstStart ?? from) + width;
  if (ceiling >= to) return undefined;
  return { startedTo: iso(ceiling) };
}

/** An attempt is the exact page once it returns n + 1 rows that all sort before its bound. */
function attemptExact(plan: Plan, rows: Row[], bounds: Record<string, string>): boolean {
  if (rows.length <= plan.limit) return false;
  // A startedAt ceiling also admits spans ending after it; the look-ahead row must end before it.
  if (plan.orderBy.field === 'endedAt' && plan.orderBy.direction === 'asc')
    return ms(rows[plan.limit]!.endedAt) < Date.parse(bounds.startedTo!);
  return true;
}

/** Ascending pages: rows after the cursor end at or after it, wherever the window starts. */
function cursorFloor(plan: Plan): Record<string, string> {
  return plan.orderBy.direction === 'asc' && plan.cursor ? { endedFrom: iso(ms(plan.cursor.sortValue)) } : {};
}

async function selectPage(
  raw: ClickHouseClient,
  mods: Mods,
  plan: Plan,
  variant: Variant,
  settings: ClickHouseSettings,
  overlay: ClickHouseSettings = {},
): Promise<{ rows: Row[]; statements: Statement[]; failed?: boolean }> {
  const statements: Statement[] = [];
  const run = async (
    attempt: number,
    compiled: { query: string; query_params: Record<string, unknown> },
    extra: ClickHouseSettings,
  ) => {
    const id = randomUUID();
    const start = performance.now();
    const wall = () => Math.round(performance.now() - start);
    try {
      const rows = (await exec(raw, mods, compiled, { ...settings, ...extra, ...overlay }, false, id)) as Row[];
      statements.push({ id, wallMs: wall(), attempt, ok: true, rows: rows.length });
      return rows;
    } catch (error) {
      statements.push({ id, wallMs: wall(), attempt, ok: false, errorCode: errorCode(error) });
      return undefined;
    }
  };
  // The branch compiles the probe separately and always collapses matched spans when `where` is set.
  const compileNew = (options: Record<string, unknown>) =>
    options.firstStart && mods.spanQuery.compileClickHouseSpanFirstStart
      ? mods.spanQuery.compileClickHouseSpanFirstStart(plan, options)
      : (mods.compilers.new as any)(plan, options);
  const once = async (
    compiled: { query: string; query_params: Record<string, unknown> },
    extra: ClickHouseSettings,
  ) => {
    const rows = await run(0, compiled, extra);
    return rows ? { rows, statements } : { rows: [], statements, failed: true };
  };
  if (variant === 'base') return once(mods.compilers.base(plan), {});
  const inOrder = variant === 'inorder' || variant === 'narrow-inorder';
  const matchedFirst = variant === 'matched' || variant === 'narrow-matched';
  const collapse = inOrder ? 'inOrder' : 'sort';
  const extra = inOrder ? IN_ORDER : {};
  if (variant === 'prefilter' || variant === 'inorder' || variant === 'matched')
    return once(compileNew({ ...cursorFloor(plan), collapse, matchedFirst }), extra);
  // Ascending pages widen from the first span that can follow the cursor, not the window's start.
  let firstStart: number | undefined;
  if (plan.orderBy.direction === 'asc') {
    const startFloor =
      plan.orderBy.field === 'startedAt' && plan.cursor ? { startedFrom: iso(ms(plan.cursor.sortValue)) } : {};
    const probe = await run(-1, compileNew({ ...cursorFloor(plan), ...startFloor, firstStart: true }), {});
    if (!probe) return { rows: [], statements, failed: true };
    if (!Number(probe[0]?.copies)) return { rows: [], statements };
    firstStart = ms(probe[0]!.first as string);
  }
  for (let attempt = 0, width = HOUR; ; attempt++, width *= 8) {
    const bounds = attemptBounds(plan, width, firstStart);
    const rows = await run(
      attempt,
      compileNew({ ...cursorFloor(plan), ...(bounds ?? {}), collapse, matchedFirst }),
      extra,
    );
    if (!rows) return { rows: [], statements, failed: true };
    if (!bounds || attemptExact(plan, rows, bounds)) return { rows, statements };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Attaches query_log stats to every statement in one lookup (the log flushes every few seconds). */
async function attachStats(raw: ClickHouseClient, statements: Statement[]) {
  const pending = new Map(statements.map(s => [s.id, s]));
  for (let attempt = 0; attempt < 40 && pending.size; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 2000));
    const result = await raw.query({
      query: `SELECT query_id AS id, query_duration_ms AS durationMs, round(memory_usage / 1048576, 1) AS memMiB,
              read_rows AS readRows, round(read_bytes / 1048576, 2) AS readMiB, result_rows AS resultRows, exception_code AS exc
       FROM clusterAllReplicas('all_groups.default', system.query_log)
       WHERE event_date >= yesterday() AND type IN ('QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart')
         AND query_id IN {ids:Array(String)}`,
      query_params: { ids: [...pending.keys()] },
      format: 'JSONEachRow',
      clickhouse_settings: { log_comment: 'aqa-bench:mobs-span-query-org:meta', max_execution_time: 60 },
    });
    for (const { id, ...stat } of await result.json<QueryStat & { id: string }>()) {
      const statement = pending.get(id);
      if (statement) statement.stat = stat;
      pending.delete(id);
    }
  }
}

async function probe(platform: string, base: string, windows: string[]) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection');
  const { mods, raw } = await connect(platform, base);
  const [, project] = pickProjects(selection.projects).find(([role]) => role === 'largest')!;
  const probes: Record<string, string> = {
    rows: 'count()',
    distinct: "uniqExact(cityHash64(organizationId, projectId, ifNull(resourceId, ''), traceId, spanId))",
    endsBeforeStart: 'countIf(endedAt < startedAt)',
    longestHours: "round(max(dateDiff('second', startedAt, endedAt)) / 3600, 1)",
  };
  const param = (value: string) => value.replace('T', ' ').replace('Z', '');
  try {
    for (const window of windows) {
      const { from, to } = windowRange(window);
      for (const [name, expression] of Object.entries(probes)) {
        const id = randomUUID();
        let value: unknown;
        let code: string | undefined;
        try {
          const rows = (await exec(
            raw,
            mods,
            {
              query: `SELECT ${expression} AS v FROM mastra_span_events
                PREWHERE endedAt >= {from:DateTime64(3, 'UTC')}
                WHERE startedAt >= {from:DateTime64(3, 'UTC')} AND startedAt < {to:DateTime64(3, 'UTC')}
                  AND organizationId = {org:String} AND isNotNull(projectId)`,
              query_params: { from: param(from), to: param(to), org: project.organizationId },
            },
            { max_memory_usage: String(4 * GiB), max_execution_time: 120 },
            false,
            id,
          )) as Row[];
          value = rows[0]?.v;
        } catch (error) {
          code = errorCode(error);
        }
        const stat = await fetchStat(raw, id);
        appendFileSync(
          OUT,
          `${JSON.stringify({ at: new Date().toISOString(), label: 'probe', window, probe: name, value, errorCode: code, stat })}\n`,
        );
        console.log(
          window,
          name,
          code ?? value,
          stat ? `${stat.durationMs} ms / ${stat.memMiB} MiB / read ${stat.readMiB} MiB` : '',
        );
      }
    }
  } finally {
    await raw.close();
  }
}

async function run(options: {
  platform: string;
  base: string;
  label: string;
  windows: string[];
  shapes: string[];
  orders: string[];
  variants: Variant[];
  scopes: Scope[];
  pages: number;
  runs: number;
  oracle?: 'relaxed' | 'prod' | 'hand';
  overlay: ClickHouseSettings;
}) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection');
  const { mods, raw } = await connect(options.platform, options.base);
  const [, project] = pickProjects(selection.projects).find(([role]) => role === 'largest')!;
  try {
    for (const scopeName of options.scopes) {
      for (const window of options.windows) {
        const timeRange = windowRange(window);
        for (const shapeId of options.shapes) {
          const shape = SHAPES[shapeId]!;
          for (const orderId of options.orders) {
            const request = {
              timeRange,
              ...(shape.where ? { where: shape.where } : {}),
              orderBy: [ORDERS[orderId]],
              page: { limit: shape.limit },
            };
            const first = mods.plan.planPlatformSpanQuery(request, scopeOf(project, scopeName));
            const label = [scopeName, window, shapeId, orderId].join(' ');
            // Oracle: today's statement paged by its own cursors (relaxed limits, or production
            // limits), or the hand-written statement sliced into pages.
            let oracle: string[][] | undefined;
            if (options.oracle === 'hand') {
              const id = randomUUID();
              try {
                const all = (await exec(
                  raw,
                  mods,
                  handwritten(
                    project.organizationId,
                    timeRange,
                    shapeId,
                    ORDERS[orderId]!,
                    options.pages * shape.limit + 1,
                  ),
                  HAND,
                  false,
                  id,
                )) as Row[];
                const keys = all.map(key);
                oracle = Array.from({ length: options.pages }, (_, i) =>
                  keys.slice(i * shape.limit, (i + 1) * shape.limit + 1),
                );
                const stat = await fetchStat(raw, id);
                console.log(label, 'hand oracle', `${stat?.durationMs} ms / ${stat?.memMiB} MiB, rows ${all.length}`);
              } catch (error) {
                console.log(label, 'hand oracle failed', errorCode(error));
              }
            } else if (options.oracle) {
              oracle = [];
              let plan = first;
              for (let page = 1; page <= options.pages; page++) {
                const { rows, failed, statements } = await selectPage(
                  raw,
                  mods,
                  plan,
                  'base',
                  options.oracle === 'prod' ? PROD : ORACLE,
                );
                if (failed) {
                  console.log(label, `oracle p${page} failed`, statements.at(-1)?.errorCode);
                  oracle = undefined;
                  break;
                }
                console.log(label, `oracle p${page}`, `${statements.at(-1)?.wallMs} ms wall`);
                oracle.push(rows.map(key));
                if (rows.length <= plan.limit) break;
                plan = nextPlan(plan, rows[plan.limit - 1]!);
              }
            }
            const cell: PageRecord[] = [];
            for (const variant of options.variants) {
              for (let runIndex = 1; runIndex <= options.runs; runIndex++) {
                let plan = first;
                for (let page = 1; page <= options.pages; page++) {
                  const result = await selectPage(raw, mods, plan, variant, PROD, options.overlay);
                  const expected = oracle?.[page - 1];
                  const equal =
                    result.failed || !expected
                      ? null
                      : JSON.stringify(expected) === JSON.stringify(result.rows.map(key));
                  const record: PageRecord = {
                    at: new Date().toISOString(),
                    label: options.label,
                    hash: project.hash,
                    scope: scopeName,
                    window,
                    shape: shapeId,
                    order: orderId,
                    variant,
                    run: runIndex,
                    page,
                    ok: !result.failed,
                    rows: result.rows.length,
                    statements: result.statements,
                    equal,
                    ...(options.oracle ? { oracle: options.oracle } : {}),
                    ...(Object.keys(options.overlay).length ? { overlay: options.overlay } : {}),
                  };
                  cell.push(record);
                  if (result.failed || result.rows.length <= plan.limit) break;
                  plan = nextPlan(plan, result.rows[plan.limit - 1]!);
                }
              }
            }
            await attachStats(
              raw,
              cell.flatMap(r => r.statements),
            );
            for (const record of cell) {
              appendFileSync(OUT, `${JSON.stringify(record)}\n`);
              const total = record.statements.reduce((sum, s) => sum + Number(s.stat?.durationMs ?? 0), 0);
              const peak = Math.max(0, ...record.statements.map(s => s.stat?.memMiB ?? 0));
              console.log(
                label,
                `${record.variant} r${record.run} p${record.page}`,
                record.ok ? 'ok' : `FAIL ${record.statements.at(-1)?.errorCode}`,
                `${record.statements.length} stmt, ${total} ms, peak ${peak} MiB, rows ${record.rows}`,
                record.equal == null ? '' : record.equal ? 'equal' : 'DIFF',
              );
            }
          }
        }
      }
    }
  } finally {
    await raw.close();
  }
}

function report(label?: string) {
  if (!existsSync(OUT)) return;
  const records = readFileSync(OUT, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(r => r.label !== 'probe' && (!label || r.label === label)) as PageRecord[];
  const seriesKey = (r: PageRecord) =>
    [
      r.label,
      r.scope,
      r.window,
      r.shape,
      r.order,
      r.overlay
        ? `${r.variant}+${Object.entries(r.overlay)
            .map(([k, v]) => `${k}=${v}`)
            .join(',')}`
        : r.variant,
    ].join(' ');
  // Warm = the last run of each series.
  const lastRun = new Map<string, number>();
  for (const r of records) lastRun.set(seriesKey(r), Math.max(lastRun.get(seriesKey(r)) ?? 0, r.run));
  const groups = new Map<string, PageRecord[]>();
  for (const r of records)
    if (r.run === lastRun.get(seriesKey(r))) groups.set(seriesKey(r), [...(groups.get(seriesKey(r)) ?? []), r]);
  const pageMs = (p: PageRecord) => p.statements.reduce((s, x) => s + Number(x.stat?.durationMs ?? 0), 0);
  const pageMem = (p: PageRecord) => Math.max(0, ...p.statements.map(x => x.stat?.memMiB ?? 0));
  const pageRead = (p: PageRecord) => p.statements.reduce((s, x) => s + (x.stat?.readMiB ?? 0), 0);
  console.log(
    '| label | scope | window | shape | order | variant | pages ok | statements/page (max) | page ms (max) | statement ms (max) | peak MiB | read MiB/page (max) | equal pages | reference |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, pages] of groups) {
    const failed = pages.find(p => !p.ok);
    const equal = pages.map(p => p.equal);
    const eq = equal.every(e => e == null)
      ? '–'
      : equal.some(e => e === false)
        ? `DIFF ${equal.filter(e => e === false).length}`
        : `${equal.filter(e => e).length}/${pages.length}`;
    const statementMs = Math.max(0, ...pages.flatMap(p => p.statements.map(s => s.stat?.durationMs ?? 0)));
    console.log(
      `| ${k.split(' ').join(' | ')} | ${pages.filter(p => p.ok).length}/${pages.length}${failed ? ` (p${failed.page}: ${failed.statements.at(-1)?.errorCode})` : ''} | ${Math.max(...pages.map(p => p.statements.length))} | ${Math.max(...pages.map(pageMs))} | ${statementMs} | ${Math.max(...pages.map(pageMem))} | ${Math.round(Math.max(...pages.map(pageRead)))} | ${eq} | ${eq === '–' ? '–' : (pages[0]!.oracle ?? 'relaxed')} |`,
    );
  }
}

const routeKey = (row: Row) =>
  JSON.stringify([row.projectId, row.traceId, row.spanId, ms(row.startedAt), ms(row.endedAt)]);

/**
 * X56f: the branch's real `querySpans()` (production runner: 1 GiB, 9 s shared by the page's
 * statements, payload hydration included), paged by its own cursors, against today's statement
 * at relaxed limits paged in the same cell. Every statement is tagged for query_log.
 */
async function route(options: {
  platform: string;
  base: string;
  label: string;
  windows: string[];
  shapes: string[];
  orders: string[];
  pages: number;
  cold: boolean;
  /** X56o: start descending listings at a cursor this many days before the window's end. */
  depths?: number[];
}) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection');
  // @clickhouse/client's default pool, which mobs-query uses.
  const { mods, raw } = await connect(options.platform, options.base, 10);
  const [, project] = pickProjects(selection.projects).find(([role]) => role === 'largest')!;
  try {
    for (const window of options.windows)
      for (const shapeId of options.shapes)
        for (const orderId of options.orders)
          for (const depth of options.depths ?? [undefined]) {
            const shape = SHAPES[shapeId]!;
            const timeRange = windowRange(window);
            const request = {
              timeRange,
              ...(shape.where ? { where: shape.where } : {}),
              orderBy: [ORDERS[orderId]],
              page: { limit: shape.limit },
            };
            const scope = scopeOf(project, 'org');
            const label = ['org', window, shapeId, orderId, ...(depth ? [`@${depth}d`] : [])].join(' ');
            const oracle: string[][] = [];
            let plan = mods.plan.planPlatformSpanQuery(request, scope);
            // A cursor before every span at that instant: identity fields sort first.
            if (depth) {
              const at = new Date(Date.parse(timeRange.to) - depth * 86_400_000).toISOString();
              plan = nextPlan(plan, {
                projectId: '',
                resourceId: '',
                traceId: '',
                spanId: '',
                [plan.orderBy.field]: at,
              } as Row);
            }
            const first = plan;
            if (depth) {
              // Today's whole-window collapse at production limits, for comparison.
              const today = await selectPage(raw, mods, first, 'base', PROD);
              await attachStats(raw, today.statements);
              const st = today.statements[0]!;
              appendFileSync(
                OUT,
                `${JSON.stringify({ at: new Date().toISOString(), label: options.label, hash: project.hash, scope: 'org', window, shape: shapeId, order: orderId, depth, variant: 'today', phase: options.cold ? 'cold' : 'warm', page: 1, ok: !today.failed, rows: today.rows.length, statements: today.statements })}\n`,
              );
              console.log(
                label,
                'today p1',
                today.failed ? `FAIL ${st.errorCode}` : 'ok',
                `${st.wallMs} ms, peak ${st.stat?.memMiB} MiB, read ${st.stat?.readMiB} MiB`,
              );
            }
            for (let page = 1; page <= options.pages; page++) {
              const { rows, failed } = await selectPage(raw, mods, plan, 'base', ORACLE);
              if (failed) break;
              oracle.push(rows.slice(0, plan.limit).map(routeKey));
              if (rows.length <= plan.limit) break;
              plan = nextPlan(plan, rows[plan.limit - 1]!);
            }
            let after: string | undefined;
            for (let page = 1; page <= options.pages; page++) {
              const statements: Statement[] = [];
              const tagged = {
                query: (args: Parameters<ClickHouseClient['query']>[0]) => {
                  assertReadOnlyStatement(args.query);
                  const id = randomUUID();
                  const kind = /AS edge/.test(args.query)
                    ? 'probe'
                    : /candidates AS/.test(args.query)
                      ? 'select'
                      : 'payload';
                  statements.push({ id, wallMs: 0, attempt: statements.length, ok: true, kind } as Statement);
                  return raw.query({
                    ...args,
                    query_id: id,
                    clickhouse_settings: {
                      ...args.clickhouse_settings,
                      use_query_cache: 0,
                      log_comment: 'aqa-bench:mobs-span-query-x56:route',
                      ...(options.cold ? { enable_filesystem_cache: 0 } : {}),
                    },
                  });
                },
              } as unknown as ClickHouseClient;
              const start = performance.now();
              let result: { spans: Row[]; page: { next: string | null } } | undefined;
              let error: unknown;
              try {
                result = await mods.spanQuery.querySpans(
                  tagged,
                  page === 1 && depth
                    ? first
                    : mods.plan.planPlatformSpanQuery(
                        { ...request, page: { ...request.page, ...(after ? { after } : {}) } },
                        scope,
                      ),
                );
              } catch (caught) {
                error = caught;
              }
              const wallMs = Math.round(performance.now() - start);
              await attachStats(raw, statements);
              for (const statement of statements) statement.ok = !Number(statement.stat?.exc ?? 0);
              const expected = oracle[page - 1];
              const equal =
                result && expected ? JSON.stringify(result.spans.map(routeKey)) === JSON.stringify(expected) : null;
              const record = {
                at: new Date().toISOString(),
                label: options.label,
                hash: project.hash,
                scope: 'org',
                window,
                shape: shapeId,
                order: orderId,
                ...(depth ? { depth } : {}),
                variant: 'route',
                phase: options.cold ? 'cold' : 'warm',
                run: options.cold ? 0 : 1,
                page,
                ok: !!result,
                rows: result?.spans.length ?? 0,
                statements,
                equal,
                oracle: 'relaxed',
                wallMs,
                ...(error ? { error: String((error as Error).name ?? error) } : {}),
              };
              appendFileSync(OUT, `${JSON.stringify(record)}\n`);
              const peak = Math.max(0, ...statements.map(s => s.stat?.memMiB ?? 0));
              const read = statements.reduce((sum, s) => sum + Number(s.stat?.readMiB ?? 0), 0);
              const sel = statements.filter(s => (s as { kind?: string }).kind !== 'payload');
              const selMs = sel.reduce((sum, s) => sum + Number(s.stat?.durationMs ?? 0), 0);
              const selPeak = Math.max(0, ...sel.map(s => Number(s.stat?.memMiB ?? 0)));
              console.log(
                label,
                `route${options.cold ? ' cold' : ''} p${page}`,
                result ? 'ok' : `FAIL ${record.error}`,
                `${statements.length} stmt, ${wallMs} ms wall, peak ${peak} MiB, read ${Math.round(read)} MiB, rows ${record.rows}`,
                `| selection ${sel.length} stmt ${selMs} ms ${selPeak} MiB`,
                equal === null ? 'noref' : equal ? 'equal' : 'DIFF',
              );
              after = result?.page.next ?? undefined;
              if (!after) break;
            }
          }
  } finally {
    await raw.close();
  }
}

/**
 * X56g/X56h: `querySpans()` payload statements, captured from real pages and re-run cold
 * (filesystem cache off) under each setting variant, in rotating order. X56g compared a
 * partition-bounded payload statement (no gain, dropped); X56h compares read concurrency.
 */
const HYDRATE_VARIANTS: Record<string, ClickHouseSettings> = {
  today: {},
  prefetch64: { filesystem_prefetches_limit: '64' },
  streams16: {
    max_threads: 16,
    filesystem_prefetches_limit: '64',
    allow_asynchronous_read_from_io_pool_for_merge_tree: 1,
    max_streams_for_merge_tree_reading: 16,
  },
  streams32: {
    max_threads: 32,
    filesystem_prefetches_limit: '64',
    allow_asynchronous_read_from_io_pool_for_merge_tree: 1,
    max_streams_for_merge_tree_reading: 32,
  },
  asyncOnly: { allow_asynchronous_read_from_io_pool_for_merge_tree: 1 },
  threads64: { max_threads: 64, filesystem_prefetches_limit: '64' },
  async: {
    max_threads: 64,
    filesystem_prefetches_limit: '64',
    allow_asynchronous_read_from_io_pool_for_merge_tree: 1,
    max_streams_for_merge_tree_reading: 64,
  },
  concurrent: {
    filesystem_prefetches_limit: '64',
    merge_tree_min_rows_for_concurrent_read: '1',
    merge_tree_min_bytes_for_concurrent_read: '1',
    max_threads: 32,
  },
};

async function hydrate(options: {
  platform: string;
  base: string;
  label: string;
  windows: string[];
  shapes: string[];
  orders: string[];
  pages: number;
  variants: string[];
  probe?: boolean;
  /** X56p: filesystem cache on, after one warm-up run of each statement. */
  warm?: boolean;
  /** X56p: time each page's first selection statement instead (with `depths`, deep descending pages). */
  select?: boolean;
  depths?: number[];
}) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection');
  const { mods, raw } = await connect(options.platform, options.base);
  const [, project] = pickProjects(selection.projects).find(([role]) => role === 'largest')!;
  let rotation = 0;
  try {
    for (const window of options.windows)
      for (const shapeId of options.shapes)
        for (const orderId of options.orders)
          for (const depth of options.depths ?? [undefined]) {
            const shape = SHAPES[shapeId]!;
            const request = {
              timeRange: windowRange(window),
              ...(shape.where ? { where: shape.where } : {}),
              orderBy: [ORDERS[orderId]],
              page: { limit: shape.limit },
            };
            const scope = scopeOf(project, 'org');
            let after: string | undefined;
            for (let page = 1; page <= options.pages; page++) {
              const captured: Array<{ query: string; query_params: Record<string, unknown> }> = [];
              const capturing = {
                query: (args: Parameters<ClickHouseClient['query']>[0]) => {
                  assertReadOnlyStatement(args.query);
                  captured.push({ query: args.query, query_params: args.query_params as Record<string, unknown> });
                  return raw.query({
                    ...args,
                    query_id: randomUUID(),
                    clickhouse_settings: {
                      ...args.clickhouse_settings,
                      use_query_cache: 0,
                      log_comment: 'aqa-bench:mobs-span-query-x56:capture',
                    },
                  });
                },
              } as unknown as ClickHouseClient;
              let next: string | null = null;
              let pagePlan = mods.plan.planPlatformSpanQuery(
                { ...request, page: { ...request.page, ...(after ? { after } : {}) } },
                scope,
              );
              if (depth && page === 1) {
                const at = new Date(Date.parse(request.timeRange.to) - depth * 86_400_000).toISOString();
                pagePlan = nextPlan(pagePlan, {
                  projectId: '',
                  resourceId: '',
                  traceId: '',
                  spanId: '',
                  [pagePlan.orderBy.field]: at,
                } as Row);
              }
              try {
                const result = await mods.spanQuery.querySpans(capturing, pagePlan);
                next = result.page.next;
              } catch {
                // The payload statements were still captured; time them below.
              }
              const payloads = options.select
                ? captured
                    .filter(c => c.query.includes('candidates AS'))
                    .slice(0, 1)
                    .map(c => ({ ...c, kind: 'select' }))
                : options.probe
                  ? captured
                      .filter(c => c.query.includes('AS edge'))
                      .slice(0, 1)
                      .map(c => ({ ...c, kind: 'probe' }))
                  : captured
                      .filter(c => c.query.includes('any(tuple('))
                      .map(c => ({ ...c, kind: c.query.includes('AS input') ? 'legacy' : 'payload' }))
                      .filter(
                        (c, index, all) =>
                          c.kind === 'payload' || all.slice(0, index).filter(d => d.kind === 'legacy').length < 2,
                      );
              for (const payload of payloads) {
                const statements: Array<Statement & { variant: string }> = [];
                const order = options.variants.map(
                  (_, i) => options.variants[(i + rotation) % options.variants.length]!,
                );
                rotation++;
                if (options.warm)
                  await exec(raw, mods, payload, { ...PROD, ...HYDRATE_VARIANTS.streams32 }, false, randomUUID()).catch(
                    () => undefined,
                  );
                for (const variant of order) {
                  const id = randomUUID();
                  const start = performance.now();
                  try {
                    const out = await exec(
                      raw,
                      mods,
                      payload,
                      {
                        ...PROD,
                        ...HYDRATE_VARIANTS[variant],
                        ...(options.warm ? {} : { enable_filesystem_cache: 0 }),
                      },
                      false,
                      id,
                    );
                    statements.push({
                      id,
                      variant,
                      wallMs: Math.round(performance.now() - start),
                      attempt: 0,
                      ok: true,
                      rows: out.length,
                    });
                  } catch (error) {
                    statements.push({
                      id,
                      variant,
                      wallMs: Math.round(performance.now() - start),
                      attempt: 0,
                      ok: false,
                      errorCode: errorCode(error),
                    });
                  }
                }
                await attachStats(raw, statements);
                appendFileSync(
                  OUT,
                  `${JSON.stringify({ at: new Date().toISOString(), label: options.label, hash: project.hash, scope: 'org', window, shape: shapeId, order: orderId, variant: 'hydrate', kind: payload.kind, ...(depth ? { depth } : {}), phase: options.warm ? 'warm' : 'cold', page, statements })}\n`,
                );
                console.log(
                  [
                    'org',
                    window,
                    shapeId,
                    orderId,
                    ...(depth ? [`@${depth}d`] : []),
                    `p${page}`,
                    payload.kind,
                    options.warm ? 'warm' : 'cold',
                  ].join(' '),
                  statements
                    .sort((a, b) => options.variants.indexOf(a.variant) - options.variants.indexOf(b.variant))
                    .map(
                      s =>
                        `${s.variant} ${s.ok ? 'ok' : `FAIL ${s.errorCode}`} ${s.stat?.durationMs ?? s.wallMs} ms, ${s.stat?.memMiB} MiB, read ${s.stat?.readMiB} MiB`,
                    )
                    .join(' | '),
                );
              }
              after = next ?? undefined;
              if (!after) break;
            }
          }
  } finally {
    await raw.close();
  }
}

async function main() {
  installOutputRedaction();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      platform: { type: 'string' },
      base: { type: 'string' },
      label: { type: 'string' },
      windows: { type: 'string', default: '7d,30d,180d' },
      shapes: { type: 'string', default: 'Q1,Q2,Q3,Q4,Q6' },
      orders: { type: 'string', default: 'sd,sa,ed,ea' },
      variants: { type: 'string', default: 'narrow' },
      scopes: { type: 'string', default: 'org' },
      pages: { type: 'string', default: '5' },
      runs: { type: 'string', default: '2' },
      oracle: { type: 'string' },
      settings: { type: 'string', default: '{}' },
      cold: { type: 'boolean', default: false },
      depths: { type: 'string' },
      warm: { type: 'boolean', default: false },
      select: { type: 'boolean', default: false },
      probe: { type: 'boolean', default: false },
    },
  });
  const command = positionals[0];
  if (command === 'report') return report(values.label);
  if (!values.platform || !values.base) throw new Error('--platform and --base are required');
  if (command === 'probe') return probe(values.platform, values.base, values.windows!.split(','));
  if (command === 'hydrate' && values.label)
    return hydrate({
      probe: values.probe!,
      warm: values.warm!,
      select: values.select!,
      ...(values.depths ? { depths: values.depths.split(',').map(Number) } : {}),
      platform: values.platform,
      base: values.base,
      label: values.label,
      windows: values.windows!.split(','),
      shapes: values.shapes!.split(','),
      orders: values.orders!.split(','),
      pages: Number(values.pages),
      variants: values.variants === 'narrow' ? Object.keys(HYDRATE_VARIANTS) : values.variants!.split(','),
    });
  if (command === 'route' && values.label)
    return route({
      platform: values.platform,
      base: values.base,
      label: values.label,
      windows: values.windows!.split(','),
      shapes: values.shapes!.split(','),
      orders: values.orders!.split(','),
      pages: Number(values.pages),
      cold: values.cold!,
      ...(values.depths ? { depths: values.depths.split(',').map(Number) } : {}),
    });
  if (command !== 'run' || !values.label)
    throw new Error('usage: probe | run --label <id> | route --label <id> | report');
  await run({
    platform: values.platform,
    base: values.base,
    label: values.label,
    windows: values.windows!.split(','),
    shapes: values.shapes!.split(','),
    orders: values.orders!.split(','),
    variants: values.variants!.split(',') as Variant[],
    scopes: values.scopes!.split(',') as Scope[],
    pages: Number(values.pages),
    runs: Number(values.runs),
    oracle: values.oracle as 'relaxed' | 'prod' | 'hand' | undefined,
    overlay: JSON.parse(values.settings!) as ClickHouseSettings,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
