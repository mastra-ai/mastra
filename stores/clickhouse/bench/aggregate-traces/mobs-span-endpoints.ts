/**
 * X55 (OBS-718): `querySpans()` / `aggregateSpans()` through the deployed mobs-query routes.
 *
 * Every request goes to production mobs-query (`/api/observability/spans/{query,aggregate}`) as
 * Daniel's Platform login (admin-cli token, never printed), strictly one at a time. Replica-side
 * cost comes from `system.query_log`, matched by the request's time window and query shape.
 * Hand-written SQL for correctness runs on the read-only replica.
 *
 *   npx tsx mobs-span-endpoints.ts access   --platform <mobs-query dir>   # member orgs, flags, volume
 *   npx tsx mobs-span-endpoints.ts contract --platform <mobs-query dir>
 *   npx tsx mobs-span-endpoints.ts check    --platform <mobs-query dir>
 *   npx tsx mobs-span-endpoints.ts perf     --platform <mobs-query dir> [--reps 3]
 *   npx tsx mobs-span-endpoints.ts report
 *
 * Output: opaque org/project hashes, statuses, timings, counts. No ids, tokens or row values.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import type { ClickHouseClient } from '@clickhouse/client';

import { assertReadOnlyStatement } from './client';
import { installOutputRedaction, registerSensitive } from './env';
import { connect, pickProjects } from './mobs-span-aggregate';
import { loadSelection } from './profile';
import { RESULTS_DIR } from './run';

const ADMIN_AUTH = join(
  process.env.PLATFORM_DIR ?? join(homedir(), 'Documents/Mastra/platform'),
  'scripts/admin-cli/src/auth.ts',
);
const PLATFORM_API = 'https://platform.mastra.ai';
const MOBS = 'https://observability.mastra.ai/api/observability';
const OUT = {
  access: join(RESULTS_DIR, 'mobs-span-endpoints-access.json'),
  contract: join(RESULTS_DIR, 'mobs-span-endpoints-contract.jsonl'),
  check: join(RESULTS_DIR, 'mobs-span-endpoints-check.jsonl'),
  perf: join(RESULTS_DIR, 'mobs-span-endpoints-perf.jsonl'),
};
const ALL_LOG = `clusterAllReplicas('all_groups.default', system.query_log)`;
const DAY = 86_400_000;
const HOUR = 3_600_000;

export const hash = (id: string) => createHash('sha256').update(id).digest('hex').slice(0, 6);

// ── deployed routes ─────────────────────────────────────────────────────

let token: string | undefined;
async function bearer(): Promise<string> {
  if (!token) {
    const auth = (await import(pathToFileURL(ADMIN_AUTH).href)) as { getToken: () => Promise<string> };
    token = await auth.getToken();
    registerSensitive([token]);
  }
  return token;
}

export interface Call {
  status: number;
  ms: number;
  requestId: string | null;
  body: unknown;
  startedAt: number;
  endedAt: number;
}

/** One request to production mobs-query. Callers must await each call before the next. */
export async function call(
  method: 'GET' | 'POST',
  path: string,
  scope: { org: string; project?: string },
  body?: unknown,
  retried = false,
): Promise<Call> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await bearer()}`,
    'X-Mastra-Organization-Id': scope.org,
    ...(scope.project ? { 'X-Mastra-Project-Id': scope.project } : {}),
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
  };
  const startedAt = Date.now();
  const started = performance.now();
  const res = await fetch(`${MOBS}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  const text = await res.text();
  const ms = performance.now() - started;
  // The admin-cli token expires during long runs; getToken() refreshes it.
  if (res.status === 401 && !retried) {
    token = undefined;
    return call(method, path, scope, body, true);
  }
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep text
  }
  return {
    status: res.status,
    ms,
    requestId: res.headers.get('x-request-id'),
    body: parsed,
    startedAt,
    endedAt: Date.now(),
  };
}

async function me(): Promise<{ userId: string; organizationId: string; memberOrgIds: string[] }> {
  const res = await fetch(`${PLATFORM_API}/v1/auth/me`, { headers: { Authorization: `Bearer ${await bearer()}` } });
  if (!res.ok) throw new Error(`/v1/auth/me: ${res.status}`);
  const data = (await res.json()) as { user: { id: string }; organizationId: string; memberOrgIds: string[] };
  return { userId: data.user.id, organizationId: data.organizationId, memberOrgIds: data.memberOrgIds };
}

// ── replica ─────────────────────────────────────────────────────────────

export async function rows<T>(raw: ClickHouseClient, sql: string, params: Record<string, unknown> = {}) {
  assertReadOnlyStatement(sql);
  const result = await raw.query({
    query: sql,
    query_params: params,
    format: 'JSONEachRow',
    clickhouse_settings: { log_comment: 'aqa-bench:mobs-span-endpoints', max_execution_time: 60 },
  });
  return (await result.json()) as T[];
}

// ── access ──────────────────────────────────────────────────────────────

/** Written to results/, so hashes only; raw ids are resolved again at run time. */
interface Access {
  sessionOrg: string;
  orgs: Array<{
    hash: string;
    capabilities: { spanQuery: boolean; spanAggregate: boolean; traceQuery: boolean } | null;
    capStatus: number;
    traces30d: number;
    spans7d: number;
    rank30d: number | null;
  }>;
  orgCount30d: number;
  targets: Array<{ role: string; orgHash: string; projectHash: string; member: boolean }>;
}

async function access(platform: string) {
  const identity = await me();
  registerSensitive([identity.userId, identity.organizationId, ...identity.memberOrgIds]);
  const orgIds = [...new Set([identity.organizationId, ...identity.memberOrgIds])];
  console.log(`member orgs: ${orgIds.length}`);

  const { raw } = await connect(platform);
  const ranks = await rows<{ o: string; traces: string; rank: string; n: string }>(
    raw,
    `SELECT o, traces, rank, n FROM (
       SELECT organizationId AS o, count() AS traces,
              row_number() OVER (ORDER BY count() DESC) AS rank, count() OVER () AS n
       FROM mastra_trace_roots
       WHERE startedAt >= now() - INTERVAL 30 DAY
       GROUP BY organizationId)
     WHERE o IN {orgs:Array(String)}`,
    { orgs: orgIds },
  );
  const spans = await rows<{ o: string; spans: string }>(
    raw,
    `SELECT organizationId AS o, count() AS spans FROM mastra_span_events
     WHERE organizationId IN {orgs:Array(String)} AND startedAt >= now() - INTERVAL 7 DAY
     GROUP BY organizationId`,
    { orgs: orgIds },
  );
  const orgCount30d = Number(ranks[0]?.n ?? 0);

  const selection = loadSelection();
  if (!selection) throw new Error('no project selection; run the harness profile step first');
  const targets = pickProjects(selection.projects).map(([role, p]) => ({
    role,
    orgHash: hash(p.organizationId),
    projectHash: hash(p.projectId),
    member: orgIds.includes(p.organizationId),
  }));

  const orgs: Access['orgs'] = [];
  for (const org of orgIds) {
    const res = await call('GET', '/capabilities', { org });
    const caps = (res.body as { capabilities?: Record<string, unknown> })?.capabilities;
    const r = ranks.find(x => x.o === org);
    orgs.push({
      hash: hash(org),
      capStatus: res.status,
      capabilities: caps
        ? {
            spanQuery: caps.spanQuery === true,
            spanAggregate: caps.spanAggregate === true,
            traceQuery: caps.traceQuery === true,
          }
        : null,
      traces30d: Number(r?.traces ?? 0),
      spans7d: Number(spans.find(x => x.o === org)?.spans ?? 0),
      rank30d: r ? Number(r.rank) : null,
    });
  }
  orgs.sort((a, b) => b.traces30d - a.traces30d);
  const result: Access = { sessionOrg: hash(identity.organizationId), orgs, orgCount30d, targets };
  writeFileSync(OUT.access, JSON.stringify(result, null, 2));

  console.log(`orgs with traces in 30 d: ${orgCount30d}`);
  for (const o of orgs)
    console.log(
      `  org ${o.hash}${o.hash === result.sessionOrg ? ' (session)' : ''}: caps ${o.capStatus} ` +
        `spanQuery=${o.capabilities?.spanQuery} spanAggregate=${o.capabilities?.spanAggregate} ` +
        `rank30d=${o.rank30d ?? '-'} traces30d=${o.traces30d} spans7d=${o.spans7d}`,
    );
  for (const t of targets)
    console.log(`  target ${t.role}: org ${t.orgHash} project ${t.projectHash} member=${t.member}`);
  await raw.close();
}

export function loadAccess(): Access {
  return JSON.parse(readFileSync(OUT.access, 'utf8')) as Access;
}

// ── scopes and requests ─────────────────────────────────────────────────

export interface Scopes {
  /** Largest org (a member org) and its largest project. */
  L: { org: string; project: string };
  /** Biggest other member org, the p99 stand-in (one project). */
  M: { org: string; project: string };
  /** p99 target org: not a member. */
  X: { org: string; project: string };
}

export async function scopes(raw: ClickHouseClient): Promise<Scopes> {
  const a = loadAccess();
  const selection = loadSelection();
  if (!selection) throw new Error('no project selection; run the harness profile step first');
  const picked = new Map(pickProjects(selection.projects));
  const largest = { org: picked.get('largest')!.organizationId, project: picked.get('largest')!.projectId };
  const p99 = { org: picked.get('p99')!.organizationId, project: picked.get('p99')!.projectId };
  const identity = await me();
  registerSensitive([identity.userId, identity.organizationId, ...identity.memberOrgIds]);
  const mHash = a.orgs.find(o => o.hash !== hash(largest.org) && o.capabilities?.spanAggregate)!.hash;
  const mOrg = [identity.organizationId, ...identity.memberOrgIds].find(o => hash(o) === mHash)!;
  const [m] = await rows<{ p: string }>(
    raw,
    `SELECT projectId AS p FROM mastra_span_events WHERE organizationId = {o:String}
       AND startedAt >= now() - INTERVAL 7 DAY GROUP BY p ORDER BY count() DESC LIMIT 1`,
    { o: mOrg },
  );
  registerSensitive([m!.p]);
  return {
    L: { org: largest.org, project: largest.project },
    M: { org: mOrg, project: m!.p },
    X: { org: p99.org, project: p99.project },
  };
}

/** A window ending on the hour, at least an hour ago, so late rows can't move the numbers between reads. */
export function windowOf(ms: number, endHoursAgo = 1) {
  const to = Math.floor((Date.now() - endHoursAgo * HOUR) / HOUR) * HOUR;
  return { from: new Date(to - ms).toISOString(), to: new Date(to).toISOString() };
}

export const eq = (path: string, literal: string | number | boolean) => ({
  op: 'eq',
  left: { path },
  right: { literal },
});
export const and = (...args: unknown[]) => ({ op: 'and', args });

// ── contract ────────────────────────────────────────────────────────────

async function contract(platform: string) {
  const { raw } = await connect(platform);
  const s = await scopes(raw);
  await raw.close();
  const day = windowOf(DAY);
  const hour = windowOf(HOUR);
  const d15 = windowOf(15 * DAY);
  const count = { measures: ['count'] };

  type Case = {
    id: string;
    expect: number | string;
    method?: 'GET' | 'POST';
    path: string;
    scope: { org: string; project?: string };
    body?: unknown;
    inspect?: (body: unknown) => Record<string, unknown>;
  };
  const spansOf = (b: unknown) => (b as { spans?: Array<{ organizationId: string; projectId: string }> }).spans ?? [];
  const tenantCheck = (org: string, project?: string) => (b: unknown) => {
    const spans = spansOf(b);
    return {
      rows: spans.length,
      otherOrg: spans.filter(r => r.organizationId !== org).length,
      otherProject: project === undefined ? null : spans.filter(r => r.projectId !== project).length,
      projects: new Set(spans.map(r => r.projectId)).size,
    };
  };
  const aggCount = (b: unknown) => {
    const r = b as { rows?: Array<{ dimensions?: Record<string, string | null>; measures: { count: number } }> };
    return {
      groups: r.rows?.length ?? null,
      count: r.rows?.reduce((n, x) => n + (x.measures.count ?? 0), 0) ?? null,
      orgGroups: r.rows?.map(x => (x.dimensions?.organizationId ? hash(x.dimensions.organizationId) : null)),
    };
  };
  const errorCode = (b: unknown) => {
    const e = b as { code?: string; issues?: Array<{ code?: string }>; title?: string; status?: number };
    return { code: e.code, issue: e.issues?.[0]?.code, title: e.title };
  };

  const cases: Case[] = [
    // flag readout and tenant gate
    {
      id: 'caps-nonmember',
      expect: 200,
      method: 'GET',
      path: '/capabilities',
      scope: { org: s.X.org },
      inspect: b => ({
        spanQuery: (b as any).capabilities?.spanQuery,
        spanAggregate: (b as any).capabilities?.spanAggregate,
      }),
    },
    {
      id: 'query-nonmember',
      expect: 403,
      path: '/spans/query',
      scope: { org: s.X.org },
      body: { timeRange: hour, page: { limit: 1 } },
      inspect: errorCode,
    },
    {
      id: 'agg-nonmember',
      expect: 403,
      path: '/spans/aggregate',
      scope: { org: s.X.org },
      body: { timeRange: hour, ...count },
      inspect: errorCode,
    },
    {
      id: 'agg-nonmember-project',
      expect: 403,
      path: '/spans/aggregate',
      scope: { org: s.X.org, project: s.X.project },
      body: { timeRange: hour, ...count },
      inspect: errorCode,
    },
    // request validation (rejected before any statement)
    {
      id: 'query-bad-json',
      expect: 400,
      path: '/spans/query',
      scope: { org: s.M.org },
      body: '{"timeRange":',
      inspect: errorCode,
    },
    {
      id: 'agg-bad-json',
      expect: 400,
      path: '/spans/aggregate',
      scope: { org: s.M.org },
      body: '{"timeRange":',
      inspect: errorCode,
    },
    {
      id: 'agg-bad-measure',
      expect: 422,
      path: '/spans/aggregate',
      scope: { org: s.M.org },
      body: { timeRange: hour, measures: ['nope.sum'] },
      inspect: errorCode,
    },
    // Core dropped the 31-day span query cap in mastra#27042; a 32-day page must succeed.
    {
      id: 'query-32d',
      expect: 200,
      path: '/spans/query',
      scope: { org: s.M.org },
      body: { timeRange: windowOf(32 * DAY), page: { limit: 1 } },
      inspect: tenantCheck(s.M.org),
    },
    {
      id: 'agg-model-dim',
      expect: 422,
      path: '/spans/aggregate',
      scope: { org: s.M.org },
      body: { timeRange: hour, groupBy: ['model'], ...count },
      inspect: errorCode,
    },
    // org window cap
    {
      id: 'agg-L-org-15d-nowhere',
      expect: 'time_range_too_large',
      path: '/spans/aggregate',
      scope: { org: s.L.org },
      body: { timeRange: d15, ...count },
      inspect: errorCode,
    },
    {
      id: 'agg-L-org-15d-modelgen',
      expect: 'time_range_too_large',
      path: '/spans/aggregate',
      scope: { org: s.L.org },
      body: { timeRange: d15, where: eq('spanType', 'model_generation'), ...count },
      inspect: errorCode,
    },
    {
      id: 'agg-M-org-15d-modelgen',
      expect: 'time_range_too_large',
      path: '/spans/aggregate',
      scope: { org: s.M.org },
      body: { timeRange: d15, where: eq('spanType', 'model_generation'), ...count },
      inspect: errorCode,
    },
    {
      id: 'agg-M-org-15d-toolcall',
      expect: 200,
      path: '/spans/aggregate',
      scope: { org: s.M.org },
      body: { timeRange: d15, where: eq('spanType', 'tool_call'), ...count },
      inspect: aggCount,
    },
    {
      id: 'agg-M-org-15d-branch-plus-model',
      expect: 'time_range_too_large',
      path: '/spans/aggregate',
      scope: { org: s.M.org },
      body: {
        timeRange: d15,
        where: { op: 'in', value: { path: 'spanType' }, set: ['tool_call', 'model_generation'] },
        ...count,
      },
      inspect: errorCode,
    },
    {
      id: 'agg-M-project-15d-nowhere',
      expect: 200,
      path: '/spans/aggregate',
      scope: { org: s.M.org, project: s.M.project },
      body: { timeRange: d15, ...count },
      inspect: aggCount,
    },
    // tenant scoping
    {
      id: 'query-L-org-1h',
      expect: 200,
      path: '/spans/query',
      scope: { org: s.L.org },
      body: { timeRange: hour, page: { limit: 1000 } },
      inspect: tenantCheck(s.L.org),
    },
    {
      id: 'query-L-project-1h',
      expect: 200,
      path: '/spans/query',
      scope: { org: s.L.org, project: s.L.project },
      body: { timeRange: hour, page: { limit: 1000 } },
      inspect: tenantCheck(s.L.org, s.L.project),
    },
    {
      id: 'query-M-org-with-L-project',
      expect: 200,
      path: '/spans/query',
      scope: { org: s.M.org, project: s.L.project },
      body: { timeRange: day, page: { limit: 10 } },
      inspect: tenantCheck(s.M.org, s.L.project),
    },
    {
      id: 'agg-M-org-with-L-project',
      expect: 200,
      path: '/spans/aggregate',
      scope: { org: s.M.org, project: s.L.project },
      body: { timeRange: day, ...count },
      inspect: aggCount,
    },
    {
      id: 'agg-L-org-by-org',
      expect: 200,
      path: '/spans/aggregate',
      scope: { org: s.L.org },
      body: { timeRange: hour, groupBy: ['organizationId'], ...count },
      inspect: aggCount,
    },
  ];

  for (const c of cases) {
    const res = await call(c.method ?? 'POST', c.path, c.scope, c.body);
    const detail = c.inspect ? c.inspect(res.body) : {};
    const ok =
      typeof c.expect === 'number'
        ? res.status === c.expect
        : res.status === 422 && (detail as { issue?: string }).issue === c.expect;
    const record = {
      id: c.id,
      expect: c.expect,
      status: res.status,
      ok,
      ms: Math.round(res.ms),
      requestId: res.requestId,
      ...detail,
      at: res.startedAt,
    };
    log(OUT.contract, record);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.id}: ${res.status} ${Math.round(res.ms)}ms ${JSON.stringify(detail)}`);
  }
}

// ── correctness ─────────────────────────────────────────────────────────

const USAGE_LAG_DAYS = 30;
const TOKEN_IN = 'mastra_model_total_input_tokens';
const TOKEN_OUT = 'mastra_model_total_output_tokens';

type Scope = { org: string; project?: string };
type AggRow = { dimensions?: Record<string, string | null>; measures: Record<string, number | null> };

/**
 * Hand SQL for one grouped shape, written independently of mobs-query's compiler: the window's spans
 * (startedAt in [from, to), ended), copies collapsed to the latest `endedAt`, optional `spanType`
 * filter, then grouped. Usage is joined per span from `mastra_metric_events`, retried `metricId`s
 * collapsed with max(), bounded `from <= timestamp < to + 30 d`.
 */
async function handGroups(
  raw: ClickHouseClient,
  scope: Scope,
  range: { from: string; to: string },
  spanType: string | null,
  groupBy: string[],
  usage: boolean,
): Promise<Map<string, Record<string, number>>> {
  const params: Record<string, unknown> = {
    org: scope.org,
    from: range.from.replace('T', ' ').replace('Z', ''),
    to: range.to.replace('T', ' ').replace('Z', ''),
    until: new Date(Date.parse(range.to) + USAGE_LAG_DAYS * DAY).toISOString().replace('T', ' ').replace('Z', ''),
    project: scope.project ?? '',
    spanType: spanType ?? '',
  };
  const tenant = `organizationId = {org:String}${scope.project ? ' AND projectId = {project:String}' : ''}`;
  const dims = groupBy.map(d => (d === 'status' ? `if(isNull(x_error), 'success', 'error')` : `x_${d}`));
  const sql = `
    WITH spans AS (
      SELECT projectId, traceId, spanId,
        argMax(tuple(spanType), endedAt).1 AS x_spanType,
        argMax(tuple(entityName), endedAt).1 AS x_entityName,
        argMax(tuple(parentEntityName), endedAt).1 AS x_parentEntityName,
        argMax(tuple(error), endedAt).1 AS x_error
      FROM mastra_span_events
      WHERE ${tenant}
        AND startedAt >= toDateTime64({from:String}, 3, 'UTC') AND startedAt < toDateTime64({to:String}, 3, 'UTC')
        AND endedAt >= toDateTime64({from:String}, 3, 'UTC')
        ${spanType ? 'AND spanType = {spanType:String}' : ''}
      GROUP BY organizationId, projectId, resourceId, traceId, spanId
    )${
      usage
        ? `,
    u AS (
      SELECT projectId, traceId, spanId, sumIf(v, name = '${TOKEN_IN}') AS tin, sumIf(v, name = '${TOKEN_OUT}') AS tout
      FROM (
        SELECT projectId, traceId, spanId, metricId, name, max(value) AS v
        FROM mastra_metric_events
        WHERE ${tenant} AND name IN ('${TOKEN_IN}', '${TOKEN_OUT}')
          AND timestamp >= toDateTime64({from:String}, 3, 'UTC') AND timestamp < toDateTime64({until:String}, 3, 'UTC')
          AND isNotNull(traceId) AND isNotNull(spanId)
        GROUP BY projectId, traceId, spanId, metricId, name)
      GROUP BY projectId, traceId, spanId
    )`
        : ''
    }
    SELECT ${dims.map((d, i) => `toString(${d}) AS d${i}`).join(', ')}, count() AS count,
      countIf(isNotNull(x_error)) AS errorCount${usage ? ', sum(u.tin) AS tin, sum(u.tout) AS tout' : ''}
    FROM spans s
    ${usage ? 'LEFT JOIN u ON u.projectId = s.projectId AND u.traceId = s.traceId AND u.spanId = s.spanId' : ''}
    GROUP BY ${dims.map((_, i) => `d${i}`).join(', ')}
    SETTINGS join_use_nulls = 0, max_memory_usage = 8589934592, max_execution_time = 120`;
  const out = await rows<Record<string, string | null>>(raw, sql, params);
  const map = new Map<string, Record<string, number>>();
  for (const r of out) {
    const key = groupBy.map((_, i) => r[`d${i}`] ?? '∅').join('|');
    map.set(key, {
      count: Number(r.count),
      errorCount: Number(r.errorCount),
      ...(usage ? { 'tokens.input.sum': Number(r.tin), 'tokens.output.sum': Number(r.tout) } : {}),
    });
  }
  return map;
}

function compareGroups(
  api: AggRow[],
  hand: Map<string, Record<string, number>>,
  groupBy: string[],
  measures: string[],
) {
  const apiMap = new Map(api.map(r => [groupBy.map(d => r.dimensions?.[d] ?? '∅').join('|'), r.measures]));
  const keys = new Set([...apiMap.keys(), ...hand.keys()]);
  let mismatched = 0;
  let missingApi = 0;
  let missingHand = 0;
  const totals: Record<string, { api: number; hand: number }> = {};
  for (const k of keys) {
    const a = apiMap.get(k);
    const h = hand.get(k);
    if (!a) missingApi++;
    if (!h) missingHand++;
    for (const m of measures) {
      const av = Number(a?.[m] ?? 0);
      const hv = Number(h?.[m] ?? 0);
      totals[m] ??= { api: 0, hand: 0 };
      totals[m].api += av;
      totals[m].hand += hv;
      if (a && h && av !== hv) mismatched++;
    }
  }
  return { groups: keys.size, mismatched, missingApi, missingHand, totals };
}

/** `querySpans()` paged to the end; null when it would take more than `maxPages` requests. */
async function pagedTotal(scope: Scope, range: { from: string; to: string }, where: unknown, maxPages: number) {
  let after: string | undefined;
  let total = 0;
  let pages = 0;
  let ms = 0;
  const seen = new Set<string>();
  let dupes = 0;
  do {
    const res = await call('POST', '/spans/query', scope, {
      timeRange: range,
      ...(where ? { where } : {}),
      page: { limit: 1000, ...(after ? { after } : {}) },
    });
    if (res.status !== 200) return { total: null, pages, ms, status: res.status, dupes };
    const b = res.body as {
      spans: Array<{ projectId: string; traceId: string; spanId: string }>;
      page: { next: string | null };
    };
    for (const s of b.spans) {
      const k = `${s.projectId}|${s.traceId}|${s.spanId}`;
      if (seen.has(k)) dupes++;
      seen.add(k);
    }
    total += b.spans.length;
    pages++;
    ms += res.ms;
    after = b.page.next ?? undefined;
    if (pages >= maxPages && after)
      return { total: null, pages, ms: Math.round(ms), status: 200, dupes, truncated: true };
  } while (after);
  return { total, pages, ms: Math.round(ms), status: 200, dupes };
}

async function check(platform: string, parityOnly = false) {
  const { raw } = await connect(platform);
  const s = await scopes(raw);
  const scopeList: Array<[string, Scope]> = [
    ['M-project', s.M],
    ['M-org', { org: s.M.org }],
    ['L-project', s.L],
    ['L-org', { org: s.L.org }],
  ];
  const windows: Array<[string, number]> = [
    ['24h', DAY],
    ['7d', 7 * DAY],
  ];
  const shapes = [
    {
      id: 'A-type-status',
      spanType: null,
      groupBy: ['spanType', 'status'],
      measures: ['count', 'errorCount'],
      usage: false,
    },
    {
      id: 'B-tool-entity',
      spanType: 'tool_call',
      groupBy: ['entityName'],
      measures: ['count', 'errorCount'],
      usage: false,
    },
    {
      id: 'C-model-parent',
      spanType: 'model_generation',
      groupBy: ['parentEntityName'],
      measures: ['count', 'tokens.input.sum', 'tokens.output.sum'],
      usage: true,
    },
  ];

  for (const [wLabel, ms] of parityOnly ? [] : windows) {
    const range = windowOf(ms, 2);
    for (const [sLabel, scope] of scopeList) {
      for (const shape of shapes) {
        // The largest org's every-span 7 d hand SQL is a 4.6M-span sort; the filtered shapes cover it.
        if (sLabel === 'L-org' && wLabel === '7d' && !shape.spanType) continue;
        const where = shape.spanType ? eq('spanType', shape.spanType) : undefined;
        const res = await call('POST', '/spans/aggregate', scope, {
          timeRange: range,
          ...(where ? { where } : {}),
          groupBy: shape.groupBy,
          measures: shape.measures,
          limit: 1000,
        });
        const body = res.body as { rows?: AggRow[]; truncated?: boolean };
        if (res.status !== 200 || !body.rows) {
          log(OUT.check, { kind: 'groups', shape: shape.id, scope: sLabel, window: wLabel, status: res.status });
          console.log(`FAIL ${shape.id} ${sLabel} ${wLabel}: ${res.status}`);
          continue;
        }
        const hand = await handGroups(raw, scope, range, shape.spanType, shape.groupBy, shape.usage);
        const cmp = compareGroups(body.rows, hand, shape.groupBy, shape.measures);
        const record = {
          kind: 'groups',
          shape: shape.id,
          scope: sLabel,
          window: wLabel,
          status: res.status,
          ms: Math.round(res.ms),
          truncated: body.truncated,
          ...cmp,
        };
        log(OUT.check, record);
        console.log(
          `${cmp.mismatched || cmp.missingApi || cmp.missingHand ? 'DIFF' : 'ok  '} ${shape.id} ${sLabel} ${wLabel}: ` +
            `groups=${cmp.groups} mismatched=${cmp.mismatched} missingApi=${cmp.missingApi} missingHand=${cmp.missingHand} ` +
            Object.entries(cmp.totals)
              .map(([m, t]) => `${m}=${t.api}/${t.hand}`)
              .join(' '),
        );
      }
    }
  }

  // aggregateSpans() count vs querySpans() paged to the end, for scopes small enough to page.
  const parity: Array<[string, Scope, number, unknown]> = [
    ['M-project all 24h', s.M, DAY, undefined],
    ['M-org tool_call 7d', { org: s.M.org }, 7 * DAY, eq('spanType', 'tool_call')],
    ['L-project agent_run 24h', s.L, DAY, eq('spanType', 'agent_run')],
    ['L-org tool_call error 7d', { org: s.L.org }, 7 * DAY, and(eq('spanType', 'tool_call'), eq('status', 'error'))],
    ['L-org model_generation 24h', { org: s.L.org }, DAY, eq('spanType', 'model_generation')],
  ];
  for (const [label, scope, ms, where] of parity) {
    const range = windowOf(ms, 2);
    const agg = await call('POST', '/spans/aggregate', scope, {
      timeRange: range,
      ...(where ? { where } : {}),
      measures: ['count'],
    });
    const count = (agg.body as { rows?: AggRow[] }).rows?.[0]?.measures.count ?? null;
    const paged = await pagedTotal(scope, range, where, 80);
    const record = { kind: 'parity', label, aggStatus: agg.status, count, ...paged };
    log(OUT.check, record);
    console.log(
      `${paged.total !== null && count === paged.total && paged.dupes === 0 ? 'ok  ' : 'DIFF'} ${label}: aggregate=${count} paged=${paged.total} pages=${paged.pages} dupes=${paged.dupes}`,
    );
  }
  await raw.close();
}

// ── performance ─────────────────────────────────────────────────────────

interface PerfCall {
  run: string;
  shape: string;
  scope: string;
  window: string;
  rep: number;
  page: number;
  status: number;
  ms: number;
  requestId: string | null;
  code?: string;
  startedAt: number;
  endedAt: number;
}

type ShapeKind = 'aggregate' | 'query';
const perfShapes: Array<{ id: string; kind: ShapeKind; pages?: number; body: (w: string) => Record<string, unknown> }> =
  [
    // S1 agent runs by status over time, nested runs included (every agent_run span).
    {
      id: 'S1',
      kind: 'aggregate',
      body: w => ({
        where: eq('spanType', 'agent_run'),
        groupBy: ['status'],
        interval: w === '24h' || w === '7d' ? '1h' : '1d',
        measures: ['count', 'errorCount'],
        limit: 10,
      }),
    },
    // S2 tool calls by name with error rate and p95.
    {
      id: 'S2',
      kind: 'aggregate',
      body: () => ({
        where: eq('spanType', 'tool_call'),
        groupBy: ['entityName'],
        measures: ['count', 'errorRate', 'duration.p95'],
        limit: 100,
      }),
    },
    // S3 tokens/cost per agent. parentEntityName is never stored, so model_generation's own entityName (the agent).
    {
      id: 'S3',
      kind: 'aggregate',
      body: () => ({
        where: eq('spanType', 'model_generation'),
        groupBy: ['entityName'],
        measures: ['count', 'tokens.input.sum', 'tokens.output.sum', 'cost.sum'],
        limit: 100,
      }),
    },
    // S4 one page of failed tool calls.
    {
      id: 'S4',
      kind: 'query',
      body: () => ({ where: and(eq('spanType', 'tool_call'), eq('status', 'error')), page: { limit: 100 } }),
    },
    // S5 five pages of every span.
    { id: 'S5', kind: 'query', pages: 5, body: () => ({ page: { limit: 1000 } }) },
  ];

async function perf(platform: string, reps: number, only?: string[]) {
  const { raw } = await connect(platform);
  const s = await scopes(raw);
  const caps = await call('GET', '/capabilities', { org: s.L.org });
  const retentionDays = Number(
    (caps.body as { capabilities?: { traceRetentionDays?: number } }).capabilities?.traceRetentionDays ?? 90,
  );
  console.log(`retention ${retentionDays} d`);
  const run = new Date().toISOString();
  const scopeList: Array<[string, Scope]> = [
    ['L-project', s.L],
    ['L-org', { org: s.L.org }],
    ['M-org', { org: s.M.org }],
  ];
  const windows: Array<[string, number]> = [
    ['24h', DAY],
    ['7d', 7 * DAY],
    ['30d', 30 * DAY],
    ['retention', retentionDays * DAY],
  ];
  const calls: PerfCall[] = [];
  for (const [wLabel, ms] of windows) {
    const range = windowOf(ms);
    for (const [sLabel, scope] of scopeList) {
      for (const shape of perfShapes.filter(x => !only || only.includes(x.id))) {
        for (let rep = 0; rep <= reps; rep++) {
          let after: string | undefined;
          let stop = false;
          for (let page = 0; page < (shape.pages ?? 1); page++) {
            const body = shape.body(wLabel);
            if (after) body.page = { ...(body.page as object), after };
            const res = await call('POST', shape.kind === 'aggregate' ? '/spans/aggregate' : '/spans/query', scope, {
              timeRange: range,
              ...body,
            });
            const b = res.body as { issues?: Array<{ code?: string }>; code?: string; page?: { next: string | null } };
            const c: PerfCall = {
              run,
              shape: shape.id,
              scope: sLabel,
              window: wLabel,
              rep,
              page,
              status: res.status,
              ms: Math.round(res.ms),
              requestId: res.requestId,
              code: b?.issues?.[0]?.code ?? b?.code,
              startedAt: res.startedAt,
              endedAt: res.endedAt,
            };
            calls.push(c);
            log(OUT.perf, { kind: 'call', ...c });
            console.log(
              `${shape.id} ${sLabel} ${wLabel} rep${rep}${shape.pages ? ` p${page}` : ''}: ${res.status} ${c.ms}ms${c.code ? ` ${c.code}` : ''}`,
            );
            // Never repeat a request that failed: no deliberate limit hits on production.
            if (res.status !== 200) stop = true;
            after = b?.page?.next ?? undefined;
            if (stop || !after) break;
            await sleep(300);
          }
          if (stop) break;
          await sleep(500);
        }
      }
    }
  }

  // query_log flushes every ~7.5 s.
  await sleep(15_000);
  const first = Math.floor(calls[0]!.startedAt / 1000) - 5;
  const last = Math.ceil(calls.at(-1)!.endedAt / 1000) + 5;
  const statements = await rows<{
    host: string;
    kind: ShapeKind;
    start: string;
    end: string;
    ms: string;
    mem: string;
    readRows: string;
    readBytes: string;
    diskBytes: string;
    cacheBytes: string;
    exception: string;
    type: string;
  }>(
    raw,
    `SELECT hostName() AS host,
       if(position(query, 'members AS (') > 0, 'aggregate', 'query') AS kind,
       toUnixTimestamp64Milli(query_start_time_microseconds) AS start,
       toUnixTimestamp64Milli(event_time_microseconds) AS end,
       query_duration_ms AS ms, memory_usage AS mem, read_rows AS readRows, read_bytes AS readBytes,
       ProfileEvents['OSReadBytes'] AS diskBytes, ProfileEvents['CachedReadBufferReadFromCacheBytes'] AS cacheBytes,
       exception_code AS exception, toString(type) AS type
     FROM ${ALL_LOG}
     WHERE event_time >= toDateTime({a:UInt32}) AND event_time <= toDateTime({b:UInt32})
       AND type != 'QueryStart'
       AND Settings['max_memory_usage'] = '1073741824'
       AND positionCaseInsensitive(log_comment, 'aqa-bench') = 0
       AND (position(query, 'members AS (') > 0
         OR (position(query, 'WITH candidates AS (') > 0 AND has(tables, currentDatabase() || '.mastra_span_events'))
         OR position(query, '{page:Array(Tuple') > 0)`,
    { a: first, b: last },
  );
  const hosts = new Map<string, string>();
  for (const c of calls) {
    const kind: ShapeKind = perfShapes.find(x => x.id === c.shape)!.kind;
    const mine = statements.filter(
      st => st.kind === kind && Number(st.start) >= c.startedAt - 300 && Number(st.end) <= c.endedAt + 300,
    );
    for (const st of mine) hosts.set(st.host, hash(st.host));
    log(OUT.perf, {
      kind: 'stats',
      run,
      shape: c.shape,
      scope: c.scope,
      window: c.window,
      rep: c.rep,
      page: c.page,
      status: c.status,
      ms: c.ms,
      statements: mine.length,
      chMs: mine.reduce((n, st) => n + Number(st.ms), 0),
      maxStmtMs: Math.max(0, ...mine.map(st => Number(st.ms))),
      maxMiB: Math.round(Math.max(0, ...mine.map(st => Number(st.mem))) / 1048576),
      readRows: mine.reduce((n, st) => n + Number(st.readRows), 0),
      readMiB: Math.round(mine.reduce((n, st) => n + Number(st.readBytes), 0) / 1048576),
      diskMiB: Math.round(mine.reduce((n, st) => n + Number(st.diskBytes), 0) / 1048576),
      cacheMiB: Math.round(mine.reduce((n, st) => n + Number(st.cacheBytes), 0) / 1048576),
      exceptions: mine.filter(st => st.exception !== '0').map(st => Number(st.exception)),
      hosts: [...new Set(mine.map(st => hash(st.host)))],
    });
  }
  console.log(`matched ${statements.length} statements on ${hosts.size} host(s)`);
  await raw.close();
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

interface Stats {
  run: string;
  shape: string;
  scope: string;
  window: string;
  rep: number;
  status: number;
  ms: number;
  maxStmtMs: number;
  maxMiB: number;
  readMiB: number;
  statements: number;
  exceptions: number[];
}

/** Per cell, the latest run of each shape: cold (rep 0) and warm median / worst. */
function report() {
  const all = readFileSync(OUT.perf, 'utf8')
    .trim()
    .split('\n')
    .map(l => JSON.parse(l) as Stats & { kind: string })
    .filter(x => x.kind === 'stats');
  // Per shape, the run with the most calls (the full cold + warm grid).
  const counts = new Map<string, number>();
  for (const x of all) counts.set(`${x.shape}\t${x.run}`, (counts.get(`${x.shape}\t${x.run}`) ?? 0) + 1);
  const latest = new Map<string, string>();
  for (const [key, n] of counts) {
    const [shape, run] = key.split('\t') as [string, string];
    const best = latest.get(shape);
    if (!best || n >= counts.get(`${shape}\t${best}`)!) latest.set(shape, run);
  }
  const cells = new Map<string, Stats[]>();
  for (const x of all.filter(x => latest.get(x.shape) === x.run)) {
    const k = `${x.shape} ${x.scope} ${x.window}`;
    cells.set(k, [...(cells.get(k) ?? []), x]);
  }
  const med = (a: number[]) => [...a].sort((p, q) => p - q)[Math.floor((a.length - 1) / 2)];
  console.log('cell | cold status ms stmtMs MiB | warm n medMs maxStmtMs maxMiB readMiB');
  for (const [k, v] of cells) {
    const reps = [...new Set(v.map(x => x.rep))].map(rep => {
      const r = v.filter(x => x.rep === rep);
      return {
        status: r.find(x => x.status !== 200)?.status ?? 200,
        ms: r.reduce((n, x) => n + x.ms, 0),
        stmt: Math.max(...r.map(x => x.maxStmtMs)),
        mib: Math.max(...r.map(x => x.maxMiB)),
        read: r.reduce((n, x) => n + x.readMiB, 0),
        ex: [...new Set(r.flatMap(x => x.exceptions).filter(Boolean))],
      };
    });
    const [cold, ...warm] = reps;
    console.log(
      `${k} | ${cold!.status} ${cold!.ms} ${cold!.stmt} ${cold!.mib}${cold!.ex.length ? ` ex${cold!.ex}` : ''} | ` +
        (warm.length
          ? `${warm.length} ${med(warm.map(x => x.ms))} ${Math.max(...warm.map(x => x.stmt))} ${Math.max(...warm.map(x => x.mib))} ${med(warm.map(x => x.read))}`
          : '-'),
    );
  }
}

export const log = (file: string, record: unknown) => appendFileSync(file, `${JSON.stringify(record)}\n`);
export { ALL_LOG, DAY, HOUR, OUT };

async function main() {
  installOutputRedaction();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      platform: { type: 'string' },
      reps: { type: 'string', default: '3' },
      'parity-only': { type: 'boolean', default: false },
      shapes: { type: 'string' },
    },
  });
  const [command] = positionals;
  const platform = values.platform ?? '/tmp/platform-x48/servers/mobs-query';
  switch (command) {
    case 'access':
      return access(platform);
    case 'contract':
      return contract(platform);
    case 'check':
      return check(platform, values['parity-only']);
    case 'perf':
      return perf(platform, Number(values.reps), values.shapes?.split(','));
    case 'report':
      return report();
    default:
      throw new Error(`unknown command ${command}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();
